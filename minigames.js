/* =================================================================
   SHINOBI LIFE SIMULATOR — minigames.js
   Two real, playable skill games driving actual progression.

     chakra    — closing-ring timing test (tree walk / water walk /
                 meditation / leaf focus / shaping / nature training)
     precision — moving reticle + wind, thrown at a ringed target

   Input: touch, mouse, keyboard (Space/Enter), and gamepad button
   when a controller is connected. Accessibility: slow mode, wider
   windows, and an automatic mode with reduced rewards.
   ================================================================= */
(function () {
  "use strict";
  const SLS = window.SLS;
  const { C, RNG, State, Save, Log, Personality, Academy, Achievements } = SLS;

  const GRADES = [
    { id: "perfect", name: "PERFECT", cls: "g-perfect", mult: 2.4, xp: 26 },
    { id: "great",   name: "GREAT",   cls: "g-great",   mult: 1.7, xp: 18 },
    { id: "good",    name: "GOOD",    cls: "g-good",    mult: 1.15, xp: 12 },
    { id: "okay",    name: "OKAY",    cls: "g-okay",    mult: 0.6,  xp: 6 },
    { id: "failed",  name: "FAILED",  cls: "g-failed",  mult: 0,    xp: 1 }
  ];
  const grade = (id) => GRADES.find(g => g.id === id) || GRADES[4];

  const Minigames = {
    active: null,
    _raf: null,
    _handlers: [],
    _padPoll: null,
    _padWasDown: false,

    /* ---- chakra variants keep one mechanic but vary the feel ---- */
    chakraVariants: [
      { id: "tree",    name: "Tree Walking",     scene: "field",     stat: "chakraControl", speed: 1.00, desc: "Hold your chakra steady as you run up the trunk." },
      { id: "water",   name: "Water Walking",    scene: "river",     stat: "chakraControl", speed: 1.15, desc: "Constant output — the surface punishes any spike." },
      { id: "leaf",    name: "Leaf Concentration", scene: "yard",    stat: "chakraControl", speed: 0.85, desc: "Keep a single leaf pinned to your forehead." },
      { id: "medit",   name: "Meditation",       scene: "waterfall", stat: "willpower",     speed: 0.78, desc: "Match your breathing to the falling water." },
      { id: "shaping", name: "Chakra Shaping",   scene: "field",     stat: "ninjutsu",      speed: 1.25, desc: "Compress raw chakra into a stable sphere." },
      { id: "nature",  name: "Nature Training",  scene: "forest",    stat: "ninjutsu",      speed: 1.35, desc: "Force your nature through a resisting medium." }
    ],

    /* =============================================================
       Entry point — called by Engine.doActivity for minigame acts
       ============================================================= */
    launch(kind, activity, onDone) {
      const g = State.g;
      this.cleanup();
      if (g.settings.autoMinigames) return this.auto(kind, activity, onDone);

      if (kind === "chakra") {
        // Meditation always uses its own variant; training picks by mastery.
        const v = activity && activity.id === "meditate"
          ? this.chakraVariants.find(x => x.id === "medit")
          : RNG.pick(this.chakraVariants.filter(x => x.id !== "medit"));
        this.startChakra(v, activity, onDone);
      } else {
        this.startPrecision(activity, onDone);
      }
    },

    /* Accessibility: skip play, take reduced rewards. */
    auto(kind, activity, onDone) {
      const rounds = [];
      for (let i = 0; i < 3; i++) rounds.push(RNG.pick(["good", "okay", "okay", "good", "great"]));
      const v = kind === "chakra"
        ? (activity && activity.id === "meditate" ? this.chakraVariants[3] : this.chakraVariants[0])
        : null;
      this.finish(kind, v, activity, rounds, onDone, true);
    },

    /* Difficulty scales with mastery, exhaustion, injury and the drill. */
    difficulty(statKey, variantSpeed) {
      const g = State.g;
      const mastery = (g.char.stats[statKey] || 0);
      const exhaustion = 1 - (g.stamina / Math.max(1, g.char.maxStamina));   // 0 fresh → 1 spent
      const injury = 1 - (g.health / Math.max(1, g.char.maxHealth));
      const level = Math.min(1, mastery / 90);
      let speed = (0.85 + level * 0.9 + exhaustion * 0.35 + injury * 0.3) * (variantSpeed || 1);
      if (g.settings.slowMinigames) speed *= 0.6;
      const windowScale = g.settings.wideWindows ? 1.8 : 1;
      return { speed: Math.max(0.4, Math.min(3.2, speed)), windowScale, exhaustion, injury };
    },

    /* =============================================================
       CHAKRA — a large ring closes onto a fixed target ring.
       Accuracy = |movingRadius − targetRadius| in SVG units.
       ============================================================= */
    startChakra(variant, activity, onDone) {
      const g = State.g;
      if (variant.scene) g.scene = variant.scene;
      const D = this.difficulty(variant.stat, variant.speed);
      this.active = {
        kind: "chakra", variant, activity, onDone, D,
        round: 0, rounds: [], total: 3,
        r: 100, dir: -1, running: false, last: 0
      };
      this.renderChakra();
      this.nextChakraRound();
    },

    nextChakraRound() {
      const a = this.active; if (!a) return;
      a.r = 100;
      a.dir = -1;
      a.running = true;
      a.last = performance.now();
      a.locked = false;
      this.bindInput(() => this.hitChakra());
      const step = (now) => {
        if (!this.active || this.active !== a || !a.running) return;
        const dt = Math.min(64, now - a.last); a.last = now;
        // px per second, rising slightly each round
        const v = 46 * a.D.speed * (1 + a.round * 0.16);
        a.r += a.dir * v * (dt / 1000);
        if (a.r <= 18) {                      // overshot the target entirely
          a.r = 18; a.running = false;
          this.gradeChakra(999);
          return;
        }
        this.paintChakra();
        this._raf = requestAnimationFrame(step);
      };
      this._raf = requestAnimationFrame(step);
    },

    hitChakra() {
      const a = this.active;
      if (!a || a.kind !== "chakra" || !a.running || a.locked) return;
      a.locked = true; a.running = false;
      if (this._raf) cancelAnimationFrame(this._raf);
      this.gradeChakra(Math.abs(a.r - 42));    // 42 = target ring radius
    },

    gradeChakra(delta) {
      const a = this.active; if (!a) return;
      const w = a.D.windowScale;
      let id = "failed";
      if (delta <= 2.5 * w) id = "perfect";
      else if (delta <= 6 * w) id = "great";
      else if (delta <= 12 * w) id = "good";
      else if (delta <= 22 * w) id = "okay";
      a.rounds.push(id);
      this.showGrade(grade(id));
      a.round++;
      setTimeout(() => {
        if (!this.active || this.active !== a) return;
        if (a.round >= a.total) this.finish("chakra", a.variant, a.activity, a.rounds, a.onDone);
        else { this.renderChakra(); this.nextChakraRound(); }
      }, 620);
    },

    renderChakra() {
      const a = this.active; if (!a) return;
      const g = State.g;
      SLS.UI.modal(`
        <div class="mg" id="mg-root">
          <h2 class="modal-title">🌀 ${a.variant.name}</h2>
          <p class="mg-sub">${a.variant.desc}</p>
          <div class="mg-meta">
            <span>Round <b>${a.round + 1}</b>/${a.total}</span>
            <span>Chakra Control <b>${Math.round(State.stat("chakraControl"))}</b></span>
            ${a.D.exhaustion > 0.5 ? '<span class="warn">Exhausted</span>' : ""}
            ${a.D.injury > 0.4 ? '<span class="warn">Injured</span>' : ""}
          </div>
          <div class="mg-stage">
            <svg viewBox="0 0 240 240" class="mg-svg" id="mg-svg">
              <circle cx="120" cy="120" r="104" fill="none" stroke="#2a323d" stroke-width="1"/>
              <circle cx="120" cy="120" r="42" fill="none" stroke="#d9a441" stroke-width="3"/>
              <circle cx="120" cy="120" r="42" fill="#d9a441" opacity="0.07"/>
              <circle id="mg-ring" cx="120" cy="120" r="100" fill="none" stroke="#e23b3b" stroke-width="4" opacity="0.95"/>
              <circle cx="120" cy="120" r="7" fill="#e8ddc4" opacity="0.8"/>
              <text id="mg-grade" x="120" y="196" text-anchor="middle" class="mg-grade-text"></text>
            </svg>
          </div>
          <button class="btn btn-primary btn-block mg-hit" id="mg-hit" type="button">RELEASE</button>
          <p class="mg-hint">Tap the button, tap the circle, or press <b>Space</b> when the ring meets the gold circle.</p>
          <div class="mg-rounds">${a.rounds.map(r => `<span class="pip ${grade(r).cls}">${grade(r).name[0]}</span>`).join("")}</div>
          <button class="btn btn-ghost btn-sm mg-quit" type="button" onclick="SLS.Minigames.abort()">Give up</button>
        </div>`, true);
      this.paintChakra();
    },

    paintChakra() {
      const a = this.active; if (!a) return;
      const el = document.getElementById("mg-ring");
      if (el) {
        el.setAttribute("r", Math.max(1, a.r).toFixed(1));
        const near = Math.abs(a.r - 42) < 8;
        el.setAttribute("stroke", near ? "#f0c877" : "#e23b3b");
      }
    },

    /* =============================================================
       PRECISION — moving reticle, wind drift, ringed target.
       ============================================================= */
    startPrecision(activity, onDone) {
      const g = State.g;
      g.scene = "range";
      const D = this.difficulty("weapon", 1);
      const tier = C.rankTier(g.rank);
      this.active = {
        kind: "precision", activity, onDone, D,
        round: 0, rounds: [], total: 3,
        x: 50, y: 50, vx: 1, vy: 0,
        // Wind and vertical drift only once the student is past the basics
        wind: 0, moving: tier >= 2 || (g.academy.tracks.accuracy || 0) > 45,
        training: tier < 2
      };
      this.renderPrecision();
      this.nextPrecisionRound();
    },

    nextPrecisionRound() {
      const a = this.active; if (!a) return;
      a.x = 8; a.vx = 1; a.y = 50; a.vy = a.moving ? (RNG.chance(0.5) ? 1 : -1) : 0;
      a.wind = a.moving ? RNG.rand(-1.1, 1.1) : 0;
      a.running = true; a.locked = false; a.last = performance.now();
      this.bindInput(() => this.hitPrecision());
      const step = (now) => {
        if (!this.active || this.active !== a || !a.running) return;
        const dt = Math.min(64, now - a.last); a.last = now;
        const sp = 52 * a.D.speed * (1 + a.round * 0.2);
        a.x += a.vx * sp * (dt / 1000);
        if (a.x >= 92) { a.x = 92; a.vx = -1; }
        if (a.x <= 8) { a.x = 8; a.vx = 1; }
        if (a.vy) {
          a.y += a.vy * sp * 0.55 * (dt / 1000);
          if (a.y >= 82) { a.y = 82; a.vy = -1; }
          if (a.y <= 18) { a.y = 18; a.vy = 1; }
        }
        a.x += a.wind * 0.02;
        this.paintPrecision();
        this._raf = requestAnimationFrame(step);
      };
      this._raf = requestAnimationFrame(step);
    },

    hitPrecision() {
      const a = this.active;
      if (!a || a.kind !== "precision" || !a.running || a.locked) return;
      a.locked = true; a.running = false;
      if (this._raf) cancelAnimationFrame(this._raf);
      const dx = a.x - 50, dy = a.y - 50;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const w = a.D.windowScale;
      let id = "failed";
      if (dist <= 4 * w) id = "perfect";
      else if (dist <= 9 * w) id = "great";
      else if (dist <= 17 * w) id = "good";
      else if (dist <= 28 * w) id = "okay";
      a.rounds.push(id);
      this.markHit(a.x, a.y);
      this.showGrade(grade(id));
      a.round++;
      setTimeout(() => {
        if (!this.active || this.active !== a) return;
        if (a.round >= a.total) this.finish("precision", null, a.activity, a.rounds, a.onDone);
        else { this.renderPrecision(); this.nextPrecisionRound(); }
      }, 640);
    },

    renderPrecision() {
      const a = this.active; if (!a) return;
      const tool = a.training ? "wooden practice kunai" : "steel kunai";
      SLS.UI.modal(`
        <div class="mg" id="mg-root">
          <h2 class="modal-title">🎯 Precision Training</h2>
          <p class="mg-sub">Throwing ${tool}. ${a.moving ? "The reticle drifts — read the wind." : "Steady target, fixed line."}</p>
          <div class="mg-meta">
            <span>Round <b>${a.round + 1}</b>/${a.total}</span>
            <span>Accuracy <b>${Math.round(State.stat("weapon"))}</b></span>
            ${a.wind ? `<span>Wind <b>${a.wind > 0 ? "→" : "←"}</b></span>` : ""}
          </div>
          <div class="mg-stage">
            <svg viewBox="0 0 100 100" class="mg-svg" id="mg-svg">
              <circle cx="50" cy="50" r="34" fill="#e6dcc4"/>
              <circle cx="50" cy="50" r="26" fill="#c9573f"/>
              <circle cx="50" cy="50" r="17" fill="#e6dcc4"/>
              <circle cx="50" cy="50" r="9"  fill="#c9573f"/>
              <circle cx="50" cy="50" r="4"  fill="#2a2118"/>
              <g id="mg-marks"></g>
              <g id="mg-reticle">
                <circle cx="50" cy="50" r="6" fill="none" stroke="#8fd8ff" stroke-width="1.4"/>
                <line x1="42" y1="50" x2="58" y2="50" stroke="#8fd8ff" stroke-width="0.8"/>
                <line x1="50" y1="42" x2="50" y2="58" stroke="#8fd8ff" stroke-width="0.8"/>
              </g>
              <text id="mg-grade" x="50" y="96" text-anchor="middle" class="mg-grade-text-sm"></text>
            </svg>
          </div>
          <button class="btn btn-primary btn-block mg-hit" id="mg-hit" type="button">THROW</button>
          <p class="mg-hint">Tap, click the target, or press <b>Space</b> to throw.</p>
          <div class="mg-rounds">${a.rounds.map(r => `<span class="pip ${grade(r).cls}">${grade(r).name[0]}</span>`).join("")}</div>
          <button class="btn btn-ghost btn-sm mg-quit" type="button" onclick="SLS.Minigames.abort()">Give up</button>
        </div>`, true);
      this.paintPrecision();
    },

    paintPrecision() {
      const a = this.active; if (!a) return;
      const el = document.getElementById("mg-reticle");
      if (el) el.setAttribute("transform", `translate(${(a.x - 50).toFixed(2)},${(a.y - 50).toFixed(2)})`);
    },
    markHit(x, y) {
      const marks = document.getElementById("mg-marks");
      if (marks) marks.insertAdjacentHTML("beforeend",
        `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.8" fill="#2a2118"/>`);
    },

    /* =============================================================
       shared: input binding, grade flash, scoring, cleanup
       ============================================================= */
    bindInput(fn) {
      this.unbindInput();
      const handler = (e) => {
        if (e.type === "keydown") {
          if (e.code !== "Space" && e.code !== "Enter" && e.key !== " " && e.key !== "Enter") return;
          e.preventDefault();
        }
        fn();
      };
      const btn = document.getElementById("mg-hit");
      const svg = document.getElementById("mg-svg");
      if (btn) { btn.addEventListener("click", handler); this._handlers.push([btn, "click", handler]); }
      if (svg) { svg.addEventListener("pointerdown", handler); this._handlers.push([svg, "pointerdown", handler]); }
      window.addEventListener("keydown", handler);
      this._handlers.push([window, "keydown", handler]);

      // Optional gamepad support (any face button).
      if (navigator.getGamepads) {
        this._padWasDown = false;
        this._padPoll = setInterval(() => {
          const pads = navigator.getGamepads ? navigator.getGamepads() : [];
          for (let i = 0; i < pads.length; i++) {
            const p = pads[i]; if (!p) continue;
            const down = p.buttons.slice(0, 4).some(b => b && b.pressed);
            if (down && !this._padWasDown) { this._padWasDown = true; fn(); return; }
            if (!down) this._padWasDown = false;
          }
        }, 60);
      }
    },
    unbindInput() {
      this._handlers.forEach(([el, type, fn]) => { try { el.removeEventListener(type, fn); } catch (e) { } });
      this._handlers = [];
      if (this._padPoll) { clearInterval(this._padPoll); this._padPoll = null; }
    },

    showGrade(gr) {
      const el = document.getElementById("mg-grade");
      if (el) { el.textContent = gr.name; el.setAttribute("class", "mg-grade-text " + gr.cls + " pop-in"); }
      const ring = document.getElementById("mg-ring");
      if (ring && gr.id === "perfect") ring.setAttribute("stroke", "#f0c877");
      SLS.UI && SLS.UI.flashScene(gr.id === "perfect" ? "gold" : gr.id === "failed" ? "red" : null);
    },

    /* Convert the three grades into real, permanent progression. */
    finish(kind, variant, activity, rounds, onDone, wasAuto) {
      const g = State.g;
      this.unbindInput();
      if (this._raf) cancelAnimationFrame(this._raf);

      const results = rounds.map(r => grade(r));
      const totalMult = results.reduce((s, r) => s + r.mult, 0);
      const xp = results.reduce((s, r) => s + r.xp, 0);
      const perfects = results.filter(r => r.id === "perfect").length;
      const fails = results.filter(r => r.id === "failed").length;
      const autoPenalty = wasAuto ? 0.55 : 1;

      const lines = [];
      const statKey = kind === "chakra" ? (variant ? variant.stat : "chakraControl") : "weapon";
      const gain = totalMult * 0.55 * autoPenalty;
      State.gainStat(statKey, gain);
      lines.push(`${statKey === "chakraControl" ? "Chakra Control" : statKey.charAt(0).toUpperCase() + statKey.slice(1)} +${gain.toFixed(1)}`);

      if (kind === "chakra") {
        State.gainStat("chakraControl", totalMult * 0.2 * autoPenalty);
        const nat = g.char.natures[0];
        if (nat) { State.gainElement(nat, Math.round(totalMult * 1.6)); lines.push(`${nat} mastery +${Math.round(totalMult * 1.6)}`); }
        if (g.academy.enrolled && !g.academy.graduated) {
          const t = Academy.track("control", totalMult * 3.2 * autoPenalty);
          lines.push(`Academy Chakra Control ${Math.round(t)}%`);
        }
        // Failure destabilises chakra; success tops it up.
        if (fails >= 2) { State.spendChakra(Math.round(g.char.maxChakra * 0.12)); lines.push("Chakra destabilised by repeated failure"); }
        else State.gainChakra(Math.round(totalMult * 4));
      } else {
        State.gainStat("speed", totalMult * 0.16 * autoPenalty);
        if (g.equipped.weapon) {
          const id = g.equipped.weapon;
          g.weaponMastery[id] = Math.min(100, (g.weaponMastery[id] || 0) + totalMult * 1.8 * autoPenalty);
          lines.push(`Weapon mastery ${Math.round(g.weaponMastery[id])}%`);
        }
        if (g.academy.enrolled && !g.academy.graduated) {
          const t = Academy.track("accuracy", totalMult * 3.4 * autoPenalty);
          lines.push(`Academy Accuracy ${Math.round(t)}%`);
        }
      }

      State.gainXP(Math.round(xp * autoPenalty));
      lines.push(`+${Math.round(xp * autoPenalty)} XP`);
      if (activity && activity.academy) Academy.attendance(3);

      // Perfect runs occasionally grant a genuine insight.
      let insight = null;
      if (perfects >= 2 && RNG.chance(0.35)) {
        insight = SLS.Techniques.learnRandom();
        if (insight) lines.push(`Insight: learned ${insight.name}!`);
        else { State.gainStat(statKey, 1.5); lines.push("A moment of clarity (+bonus)"); }
        Personality.add("disciplined", 2);
      }
      if (perfects === 3) { g.flags.perfectDrills = (g.flags.perfectDrills || 0) + 1; }
      if (fails === 3) Personality.add("reckless", 1); else Personality.add("disciplined", 1);

      const summary = results.map(r => r.name).join(" · ");
      Log.line(`${kind === "chakra" ? (variant ? variant.name : "Chakra training") : "Precision training"}: ${summary}.`, perfects >= 2 ? "good" : "");
      Achievements.check();
      Save.autosave();

      this.active = null;
      SLS.UI.modal(`
        <h2 class="modal-title">Drill Complete</h2>
        <div class="mg-rounds big">${results.map(r => `<span class="pip ${r.cls}">${r.name}</span>`).join("")}</div>
        <ul class="mg-results">${lines.map(l => `<li>${l}</li>`).join("")}</ul>
        ${wasAuto ? '<p class="mg-hint">Automatic mode — reduced rewards.</p>' : ""}
        <div class="modal-choices"><button class="btn btn-primary btn-block" type="button"
          onclick="SLS.UI.closeModal(); SLS.UI.renderAll();">Done</button></div>`, false);
      if (onDone) onDone({ results, insight });
    },

    abort() {
      const a = this.active;
      this.cleanup();
      SLS.UI.closeModal();
      SLS.UI.renderAll();
      if (a && a.onDone) a.onDone({ aborted: true });
    },

    cleanup() {
      this.unbindInput();
      if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
      this.active = null;
    }
  };

  SLS.Minigames = Minigames;
})();
