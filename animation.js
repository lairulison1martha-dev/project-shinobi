/* =================================================================
   SHINOBI LIFE SIMULATOR — animation.js
   -----------------------------------------------------------------
   Central animation state machine. Gameplay code never touches frames;
   it calls setState()/playOnce() and this module owns everything else:
   timing, looping, queueing, interrupts, idle variety, the inactivity
   jump, facing, equipment/dojutsu/age binding, and effect sync.

   One requestAnimationFrame loop for the whole game. It pauses when the
   tab is hidden or the canvas is off-screen.

   API
     AnimationManager.setState(state, opts)
     AnimationManager.playOnce(anim, onComplete)
     AnimationManager.returnToDefault()
     AnimationManager.setContext(context)
     AnimationManager.resetIdleTimer()
     AnimationManager.setFacing(dir)
     AnimationManager.setEquipment(equipment)
     AnimationManager.setDojutsu(dojutsu)
     AnimationManager.setAgeStage(stage)
     AnimationManager.attach(canvas)
   ================================================================= */
(function () {
  "use strict";
  const SLS = (window.SLS = window.SLS || {});
  const PX = SLS.PX;

  /* Context → default looping state when nothing else is playing. */
  const CONTEXT_DEFAULT = {
    HOME: "idle",
    EXPLORING: "walk",
    TRAVELLING: "run",
    COMBAT: "combat",
    TRAINING: "idle",
    INJURED: "injured",
    DEAD: "dead"
  };

  const AM = {
    /* ---- runtime ---- */
    canvas: null, ctx: null,
    state: "idle", prevState: "idle",
    frame: 0, elapsed: 0, lastTs: 0,
    queue: [], onComplete: null,
    context: "HOME",
    facing: 1,
    running: false, rafId: null,
    visible: true,

    /* ---- character binding ---- */
    stage: "teen",
    equipment: { weapon: null, headband: false },
    dojutsu: null,
    natureColor: null, natureAura: false,
    cloak: null, cloakColor: null,
    injured: false,
    hairColor: null, skinTone: null, clanMark: false,
    descriptor: null,                 // layer stack description (SLS.Layers)

    /* ---- idle behaviour ---- */
    idleTimer: 0,
    IDLE_JUMP_AFTER: 150000,          // 2.5 min of true inactivity
    variation: null, variationFrames: null, variationDur: 0,
    varCooldown: 0,
    VAR_MIN_GAP: 9000,

    /* ---- effect hooks ---- */
    effectListeners: [],
    onFrame: null,          // FX rides this single loop; no second rAF

    /* =============================================================
       SETUP
       ============================================================= */
    attach(canvas) {
      if (!canvas) return;
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.ctx.imageSmoothingEnabled = false;
      this.start();
      return this;
    },

    detach() { this.stop(); this.canvas = null; this.ctx = null; },

    start() {
      if (this.running) return;
      this.running = true;
      this.lastTs = performance.now();
      const loop = (ts) => {
        if (!this.running) return;
        this.tick(ts);
        this.rafId = requestAnimationFrame(loop);
      };
      this.rafId = requestAnimationFrame(loop);
    },
    stop() {
      this.running = false;
      if (this.rafId) cancelAnimationFrame(this.rafId);
      this.rafId = null;
    },

    /* =============================================================
       PUBLIC API
       ============================================================= */
    setState(state, opts) {
      opts = opts || {};
      const legal = PX.fallback(this.stage, state);
      const cur = PX.states[this.state];
      // A non-interruptible animation (attack/jutsu/jump) finishes first
      // unless the caller forces it or we are dying.
      if (cur && !cur.interruptible && !opts.force && this.state !== legal && state !== "dead") {
        this.queue.push({ state: legal, opts });
        return false;
      }
      if (this.state === legal && !opts.restart) return true;
      this.prevState = this.state;
      this.state = legal;
      this.frame = 0;
      this.elapsed = 0;
      this.variation = null;
      if (opts.facing !== undefined) this.facing = opts.facing;
      this.onComplete = opts.onComplete || null;
      this.frameAudio(PX.states[legal] || {});     // frame-0 cue (e.g. jutsu charge)
      return true;
    },

    playOnce(anim, onComplete) {
      const legal = PX.fallback(this.stage, anim);
      this.prevState = this.state;
      this.state = legal;
      this.frame = 0;
      this.elapsed = 0;
      this.variation = null;
      this.onComplete = onComplete || null;
      this.frameAudio(PX.states[legal] || {});     // frame-0 cue (e.g. jutsu charge)
      return true;
    },

    returnToDefault() {
      const def = this.defaultState();
      this.setState(def, { force: true });
    },

    defaultState() {
      if (this.context === "DEAD") return "dead";
      if (this.injured && this.context !== "COMBAT") return "injured";
      return CONTEXT_DEFAULT[this.context] || "idle";
    },

    setContext(context, opts) {
      if (this.context === context) return;
      this.context = context;
      this.resetIdleTimer();
      const def = this.defaultState();
      const cur = PX.states[this.state];
      // Let a one-shot finish; it will fall through to the new default.
      if (cur && cur.interruptible) this.setState(def, opts || {});
      else this.queue.push({ state: def, opts: opts || {} });
    },

    resetIdleTimer() { this.idleTimer = 0; },
    setFacing(dir) { this.facing = dir === -1 || dir === "left" ? -1 : 1; },
    setEquipment(eq) { this.equipment = Object.assign({ weapon: null, headband: false }, eq || {}); },
    setDojutsu(d) { this.dojutsu = d || null; },
    setAgeStage(stage) {
      if (this.stage === stage) return;
      this.stage = stage;
      // Re-validate the current state against the new stage's allowed set.
      const legal = PX.fallback(stage, this.state);
      if (legal !== this.state) { this.state = legal; this.frame = 0; this.elapsed = 0; }
    },
    setInjured(v) {
      this.injured = !!v;
      if (this.injured && this.context === "HOME") this.setState("injured", { force: true });
      else if (!this.injured && this.state === "injured") this.returnToDefault();
    },
    setNature(color, showAura) { this.natureColor = color || null; this.natureAura = !!showAura; },
    /* Full layer descriptor (clan, eyes, gear, aura…). UI passes the
       whole thing in one call; the individual setters above still work
       for code that only needs one field. */
    setDescriptor(desc) { this.descriptor = desc || null; },
    setCloak(id, color) { this.cloak = id && id !== "none" ? id : null; this.cloakColor = color || null; },
    setLooks(hairColor, skinTone, clanMark) {
      this.hairColor = hairColor || null;
      this.skinTone = skinTone || null;
      this.clanMark = !!clanMark;
    },

    /* Fire a callback when a specific animation frame lands (hit sync). */
    onEffect(fn) { this.effectListeners.push(fn); },
    _emit(name, data) { this.effectListeners.forEach(f => { try { f(name, data); } catch (e) { } }); },

    /* =============================================================
       FRAME LOOP
       ============================================================= */
    tick(ts) {
      const dt = Math.min(120, ts - this.lastTs);
      this.lastTs = ts;
      if (!this.canvas || !this.ctx) return;
      // Pause work entirely when hidden or scrolled out of view.
      if (document.hidden || !this.visible) return;

      const def = PX.states[this.state] || PX.states.idle;
      this.elapsed += dt;

      // ---- idle inactivity → single jump ----
      if (this.state === "idle" && this.context === "HOME") {
        this.idleTimer += dt;
        if (this.idleTimer >= this.IDLE_JUMP_AFTER && PX.allows(this.stage, "jump")) {
          this.idleTimer = 0;
          this.playOnce("jump");
        }
      }
      if (this.varCooldown > 0) this.varCooldown -= dt;

      // ---- advance frame ----
      const dur = this.variation ? this.variationDur : def.dur;
      if (this.elapsed >= dur) {
        this.elapsed -= dur;
        this.frame++;
        const total = this.variation ? this.variationFrames.length : def.frames;
        if (this.frame >= total) {
          if (this.variation) {
            this.variation = null; this.frame = 0;
          } else if (def.loop) {
            this.frame = 0;
            this.maybeVariation();
          } else {
            // one-shot finished
            this.frame = total - 1;
            const cb = this.onComplete; this.onComplete = null;
            const nxt = this.queue.shift();
            if (nxt) { this.state = PX.fallback(this.stage, nxt.state); this.frame = 0; this.elapsed = 0; }
            else if (def.next) { this.state = PX.fallback(this.stage, this.resolveNext(def.next)); this.frame = 0; this.elapsed = 0; }
            if (cb) cb();
          }
        }
        // Frame-synchronised effects and audio.
        if (def.hitFrame != null && this.frame === def.hitFrame) {
          this._emit(this.state === "attack" ? "hit" : "release", { state: this.state, frame: this.frame });
        }
        this.frameAudio(def);
      }

      this.render();
      if (this.onFrame) this.onFrame(dt);
    },

    /* Footsteps land on contact frames, not on button press. */
    frameAudio(def) {
      const AU = SLS.AudioManager; if (!AU || !AU.unlocked) return;
      const st = this.state, f = this.frame;
      if (st === "walk" && (f === 0 || f === 3)) AU.playSFX(this.stepSound(), { volume: 0.5, rate: 0.95 + Math.random() * 0.1 });
      else if (st === "run" && (f === 0 || f === 3)) AU.playSFX(this.stepSound(), { volume: 0.65, rate: 1.05 + Math.random() * 0.1 });
      else if (st === "jump" && f === 1) AU.playSFX("jump", { volume: 0.6 });
      else if (st === "jump" && f === 4) AU.playSFX("land", { volume: 0.6 });
      else if (st === "attack" && f === 1) AU.playSFX("swing", { volume: 0.6 });
      else if (st === "attack" && f === (def.hitFrame || 3)) AU.playSFX(this.equipment.weapon ? "swordHit" : "punch", { volume: 0.75 });
      else if (st === "jutsu" && f === 0) AU.playSFX("charge", { volume: 0.5 });
      else if (st === "jutsu" && f === (def.hitFrame || 6)) AU.playSFX(this.jutsuSound, { volume: 0.8 });
    },
    stepSound() {
      const s = this.sceneSurface;
      return s === "wood" ? "stepWood" : s === "dirt" ? "stepDirt" : "stepGrass";
    },
    sceneSurface: "grass",
    jutsuSound: "fire",

    /* `next: "combat"` means combat if we're fighting, otherwise idle. */
    resolveNext(next) {
      if (next === "combat") return this.context === "COMBAT" ? "combat" : this.defaultState();
      return next;
    },

    maybeVariation() {
      if (this.state !== "idle" || this.context !== "HOME") return;
      if (this.varCooldown > 0) return;
      if (Math.random() > 0.18) return;
      const keys = Object.keys(PX.idleVariations);
      // Weighted: subtle ones more often than the showy stretch.
      const weights = { lookAround: 4, headband: 3, touchHilt: 3, shiftStance: 3, chakraFlicker: 2, stretch: 1 };
      const pool = [];
      keys.forEach(k => { const w = weights[k] || 1; for (let i = 0; i < w; i++) pool.push(k); });
      const pick = pool[Math.floor(Math.random() * pool.length)];
      const v = PX.idleVariations[pick];
      if (!v) return;
      // No weapon-touch variation without a weapon.
      if (pick === "touchHilt" && !this.equipment.weapon) return;
      if (pick === "headband" && !this.equipment.headband) return;
      this.variation = pick;
      this.variationFrames = v.build();
      this.variationDur = v.dur;
      this.frame = 0; this.elapsed = 0;
      this.varCooldown = this.VAR_MIN_GAP;
    },

    /* =============================================================
       RENDER — sprite sheet first, procedural fallback second
       ============================================================= */
    sheetFor(stage) {
      const A = SLS.Assets; if (!A) return null;
      const folder = A.stageFolder[stage];
      const def = folder && A.characters[folder];
      if (!def) return null;
      const img = A.load(def.sheet);
      return (img && img.__ready && !img.__failed) ? { def, img } : null;
    },

    render() {
      const ctx = this.ctx; if (!ctx) return;
      const c = this.canvas;
      ctx.clearRect(0, 0, c.width, c.height);

      // --- preferred path: blit the frame from the character atlas ---
      const sheet = this.variation ? null : this.sheetFor(this.stage);
      const row = sheet && sheet.def.rows[this.state];
      if (sheet && row) {
        const fw = sheet.def.frameWidth, fh = sheet.def.frameHeight;
        const f = Math.min(this.frame, row.frames - 1);
        const sx = f * fw, sy = row.row * fh;
        const scale = Math.min(c.width / fw, c.height / fh);
        const dw = fw * scale, dh = fh * scale;
        const dx = (c.width - dw) / 2, dy = c.height - dh;   // anchor 0.5 / 1.0
        ctx.save();
        if (this.facing === -1) { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sheet.img, sx, sy, fw, fh, dx, dy, dw, dh);
        // Layer stack composes inside the same flip, so overlays stay
        // pinned to the body when the character faces left.
        this.composeLayers(ctx, dx, dy, dw, dh, { sx, sy, sw: fw, sh: fh });
        ctx.restore();
        return;
      }

      // --- fallback: procedural renderer (also used for idle variations) ---
      const p = this.variation
        ? this.variationFrames[Math.min(this.frame, this.variationFrames.length - 1)]
        : PX.poseFor(this.state, this.frame, this);
      PX.drawFrame(ctx, {
        stage: this.stage,
        state: this.state,
        frame: this.frame,
        pose: p,
        facing: this.facing,
        weapon: this.equipment.weapon,
        headband: this.equipment.headband,
        dojutsu: this.dojutsu,
        natureColor: this.natureColor,
        natureAura: this.natureAura,
        cloak: this.cloak, cloakColor: this.cloakColor,
        injured: this.injured,
        hairColor: this.hairColor, skinTone: this.skinTone, clanMark: this.clanMark,
        prone: this.state === "dead"
      });
    },

    /* Everything that is not the base animation — clan, hair, eyes,
       headband, outfit, armour, weapon, accessories, injuries, dojutsu,
       aura, transformation, summon, jinchuriki — is composed on top by
       SLS.Layers. The base atlas is never swapped for an equipment or
       eye change. Falls back to the old flat overlays if layers.js is
       not present. */
    composeLayers(ctx, dx, dy, dw, dh, cell) {
      const L = SLS.Layers;
      if (L && this.descriptor) {
        L.compose(ctx, {
          dx, dy, dw, dh, cell,
          stage: this.stage, state: this.state, frame: this.frame,
          desc: this.descriptor, time: this.lastTs,
          stageFolder: (SLS.Assets && SLS.Assets.stageFolder[this.stage]) || this.stage
        });
        return;
      }
      this.drawLegacyOverlays(ctx, dx, dy, dw, dh);
    },

    /* Pre-layers overlay path, kept so the renderer still works if the
       layer module fails to load. */
    drawLegacyOverlays(ctx, dx, dy, dw, dh) {
      const cx = dx + dw / 2;
      if (this.natureAura && this.natureColor) {
        ctx.save(); ctx.globalAlpha = 0.14; ctx.fillStyle = this.natureColor;
        ctx.beginPath(); ctx.ellipse(cx, dy + dh * 0.58, dw * 0.30, dh * 0.34, 0, 0, 6.283); ctx.fill();
        ctx.restore();
      }
      if (this.cloak && this.cloakColor) {
        ctx.save(); ctx.globalAlpha = 0.30; ctx.fillStyle = this.cloakColor;
        ctx.beginPath(); ctx.ellipse(cx, dy + dh * 0.55, dw * 0.38, dh * 0.44, 0, 0, 6.283); ctx.fill();
        ctx.restore();
      }
      if (this.dojutsu) {
        const col = this.dojutsu === "sharingan" ? "rgba(226,59,59,.30)"
          : this.dojutsu === "byakugan" ? "rgba(224,232,246,.28)" : "rgba(150,90,220,.28)";
        ctx.save(); ctx.globalAlpha = 1; ctx.fillStyle = col;
        ctx.beginPath(); ctx.ellipse(cx, dy + dh * 0.17, dw * 0.13, dh * 0.055, 0, 0, 6.283); ctx.fill();
        ctx.restore();
      }
      if (this.injured) {
        ctx.save(); ctx.globalAlpha = 0.18; ctx.fillStyle = "#c62828";
        ctx.fillRect(dx, dy, dw, dh); ctx.restore();
      }
    },

    /* Force an immediate redraw (after equipment/dojutsu changes). */
    refresh() { if (this.ctx) this.render(); },

    /* Snapshot of the current animation for UI labels. */
    info() {
      const d = PX.states[this.state] || {};
      return { state: this.state, label: d.label || this.state, frame: this.frame,
               frames: d.frames || 1, context: this.context, stage: this.stage };
    }
  };

  SLS.AnimationManager = AM;

  /* Pause/resume with tab visibility (performance requirement). */
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) AM.stop();
    else { AM.lastTs = performance.now(); AM.start(); }
  });

  /* Any real interaction resets the inactivity clock. */
  ["pointerdown", "keydown", "touchstart", "wheel"].forEach(evt => {
    window.addEventListener(evt, () => AM.resetIdleTimer(), { passive: true });
  });

})();
