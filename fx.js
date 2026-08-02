/* =================================================================
   SHINOBI LIFE SIMULATOR — fx.js
   -----------------------------------------------------------------
   Particle + screen effects layer drawn over the character stage.

   One pooled particle array, a hard cap, and a single update driven by
   the existing animation loop — no extra rAF. Effects only fire on the
   animation's release/hit frame, never on button press.

   Respects the accessibility switches: reduced motion, reduced screen
   shake and reduced flashes.

   Exposes: SLS.FX
     FX.attach(canvas)
     FX.burst(kind, opts)      — jutsu / combat effect
     FX.shake(power) / FX.flash(color, alpha)
     FX.damage(n, opts)        — floating damage number
     FX.update(dt) / FX.render()
   ================================================================= */
(function () {
  "use strict";
  const SLS = (window.SLS = window.SLS || {});
  const MAX = 90;                       // hard particle cap (mobile safe)

  const FX = {
    canvas: null, ctx: null,
    pool: [], live: 0,
    shakeAmt: 0, flashCol: null, flashAmt: 0,
    numbers: [],

    attach(canvas) {
      this.canvas = canvas;
      this.ctx = canvas ? canvas.getContext("2d") : null;
      if (!this.pool.length) for (let i = 0; i < MAX; i++) this.pool.push({ dead: true });
      return this;
    },

    settings() {
      const s = (SLS.State && SLS.State.g && SLS.State.g.settings) || {};
      return { motion: !s.reducedFX, shake: !s.reducedShake && !s.reducedFX, flash: !s.reducedFlash && !s.reducedFX };
    },

    _spawn(p) {
      for (let i = 0; i < this.pool.length; i++) {
        if (this.pool[i].dead) { Object.assign(this.pool[i], p, { dead: false }); return; }
      }
    },

    /* ---------------- effect kinds ----------------
       Each nature/combat kind is a particle recipe. */
    burst(kind, opts) {
      opts = opts || {};
      if (!this.settings().motion) return;
      const c = this.canvas; if (!c) return;
      const x = opts.x != null ? opts.x : c.width * 0.5;
      const y = opts.y != null ? opts.y : c.height * 0.45;
      const A = SLS.Assets;
      const nat = A && A.natureFx[kind];
      const col = opts.color || (nat && nat.color) || "#f0c877";
      const glow = opts.glow || (nat && nat.glow) || "#fff";
      const n = Math.min(opts.count || 16, 26);

      const R = () => Math.random();
      for (let i = 0; i < n; i++) {
        const a = R() * Math.PI * 2;
        const sp = (opts.speed || 60) * (0.4 + R() * 0.9);
        let vx = Math.cos(a) * sp, vy = Math.sin(a) * sp;
        let life = 0.5 + R() * 0.6, size = 2 + R() * 3, grav = 30;
        switch (kind) {
          case "Fire":      vy -= 40; grav = -18; size = 3 + R() * 4; break;
          case "Water":     grav = 90; break;
          case "Wind":      vx *= 1.8; vy *= 0.4; grav = 0; life = 0.7; break;
          case "Earth":     grav = 140; size = 3 + R() * 4; break;
          case "Lightning": vx *= 1.5; vy *= 1.5; life = 0.3; size = 2; break;
          case "heal":      vy = -30 - R() * 40; grav = -10; break;
          case "seal":      grav = 0; life = 0.9; break;
          case "impact":    grav = 120; life = 0.35; break;
          case "dust":      vy = -10 - R() * 20; grav = 20; size = 2 + R() * 5; break;
          case "spark":     grav = 160; life = 0.4; size = 2; break;
        }
        this._spawn({ x, y, vx, vy, life, max: life, size, grav,
          col: R() < 0.35 ? glow : col, kind });
      }
      if (opts.flash !== false && this.settings().flash) this.flash(glow, kind === "Lightning" ? 0.45 : 0.22);
      if (opts.shake) this.shake(opts.shake);
    },

    /* Slash trail drawn as a short arc of particles. */
    slash(opts) {
      opts = opts || {};
      if (!this.settings().motion) return;
      const c = this.canvas; if (!c) return;
      const x = opts.x != null ? opts.x : c.width * 0.55;
      const y = opts.y != null ? opts.y : c.height * 0.4;
      for (let i = 0; i < 10; i++) {
        const t = i / 10, a = -0.9 + t * 1.8;
        this._spawn({ x: x + Math.cos(a) * 26, y: y + Math.sin(a) * 26,
          vx: Math.cos(a) * 20, vy: Math.sin(a) * 20, life: 0.22, max: 0.22,
          size: 3, grav: 0, col: "#f2f6ff", kind: "slash" });
      }
    },

    shake(power) { if (this.settings().shake) this.shakeAmt = Math.min(14, this.shakeAmt + (power || 6)); },
    flash(col, amt) { if (this.settings().flash) { this.flashCol = col || "#fff"; this.flashAmt = Math.max(this.flashAmt, amt || 0.3); } },

    damage(n, opts) {
      opts = opts || {};
      const c = this.canvas; if (!c) return;
      this.numbers.push({ n: String(n), x: (opts.x != null ? opts.x : c.width * 0.5) + (Math.random() * 24 - 12),
        y: opts.y != null ? opts.y : c.height * 0.35, life: 0.9, max: 0.9,
        crit: !!opts.crit, heal: !!opts.heal });
      if (this.numbers.length > 8) this.numbers.shift();
    },

    /* ---------------- loop ---------------- */
    update(dt) {
      const s = dt / 1000;
      for (let i = 0; i < this.pool.length; i++) {
        const p = this.pool[i]; if (p.dead) continue;
        p.life -= s;
        if (p.life <= 0) { p.dead = true; continue; }
        p.x += p.vx * s; p.y += p.vy * s; p.vy += p.grav * s;
      }
      for (let i = this.numbers.length - 1; i >= 0; i--) {
        const d = this.numbers[i]; d.life -= s; d.y -= 26 * s;
        if (d.life <= 0) this.numbers.splice(i, 1);
      }
      if (this.shakeAmt > 0) this.shakeAmt = Math.max(0, this.shakeAmt - 34 * s);
      if (this.flashAmt > 0) this.flashAmt = Math.max(0, this.flashAmt - 1.6 * s);
    },

    render() {
      const ctx = this.ctx, c = this.canvas; if (!ctx || !c) return;
      ctx.clearRect(0, 0, c.width, c.height);
      // particles
      for (let i = 0; i < this.pool.length; i++) {
        const p = this.pool[i]; if (p.dead) continue;
        const t = p.life / p.max;
        ctx.globalAlpha = Math.max(0, Math.min(1, t));
        ctx.fillStyle = p.col;
        const sz = p.size * (p.kind === "Fire" ? t : 1);
        ctx.fillRect(Math.round(p.x - sz / 2), Math.round(p.y - sz / 2), Math.max(1, sz), Math.max(1, sz));
      }
      // damage numbers
      this.numbers.forEach(d => {
        const t = d.life / d.max;
        ctx.globalAlpha = Math.max(0, t);
        ctx.font = (d.crit ? "bold 22px " : "bold 16px ") + "system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,.75)";
        ctx.strokeText(d.n, d.x, d.y);
        ctx.fillStyle = d.heal ? "#7fe0a0" : d.crit ? "#ffd166" : "#ff8a8a";
        ctx.fillText(d.n, d.x, d.y);
      });
      // full-frame flash
      if (this.flashAmt > 0) {
        ctx.globalAlpha = Math.min(0.6, this.flashAmt);
        ctx.fillStyle = this.flashCol || "#fff";
        ctx.fillRect(0, 0, c.width, c.height);
      }
      ctx.globalAlpha = 1;
    },

    /* Screen shake is applied to the stage element, not the canvas. */
    applyShake(el) {
      if (!el) return;
      if (this.shakeAmt <= 0) { el.style.transform = ""; return; }
      const a = this.shakeAmt;
      el.style.transform = `translate(${(Math.random() * 2 - 1) * a}px, ${(Math.random() * 2 - 1) * a * 0.6}px)`;
    },

    /* Low-health vignette state for the stage element. */
    lowHealth(on) {
      const el = document.getElementById("char-stage");
      if (el) el.classList.toggle("low-health", !!on && this.settings().flash);
    }
  };

  SLS.FX = FX;
})();
