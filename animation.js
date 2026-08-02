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

    /* ---- idle behaviour ---- */
    idleTimer: 0,
    IDLE_JUMP_AFTER: 150000,          // 2.5 min of true inactivity
    variation: null, variationFrames: null, variationDur: 0,
    varCooldown: 0,
    VAR_MIN_GAP: 9000,

    /* ---- effect hooks ---- */
    effectListeners: [],

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
        // hit-frame effect sync
        if (def.hitFrame != null && this.frame === def.hitFrame) {
          this._emit(this.state === "attack" ? "hit" : "release", { state: this.state, frame: this.frame });
        }
      }

      this.render();
    },

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
       RENDER
       ============================================================= */
    render() {
      const ctx = this.ctx; if (!ctx) return;
      const c = this.canvas;
      ctx.clearRect(0, 0, c.width, c.height);
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
