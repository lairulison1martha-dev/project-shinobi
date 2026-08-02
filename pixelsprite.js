/* =================================================================
   SHINOBI LIFE SIMULATOR — pixelsprite.js
   -----------------------------------------------------------------
   Original parametric PIXEL-ART character renderer.

   The reference sheet is reproduced as a jointed pixel figure drawn to
   an offscreen canvas: spiky navy hair, high collar, clan mark, arm
   wraps, leg wraps, sandals, katana across the back. Every animation
   frame is a set of joint angles, so all nine states exist for every
   age stage without hand-drawing hundreds of cells.

   No external images. Everything is drawn pixel-by-pixel at runtime.

   Exposes: SLS.PX
     PX.drawFrame(ctx, cfg)         — render one frame
     PX.poseFor(state, frame, cfg)  — joint angles for an animation frame
     PX.anim(state, stage)          — {frames, dur, loop, next, interruptible}
     PX.states                      — animation table
     PX.spriteCanvas(cfg, w, h)     — standalone canvas (strips, portraits)
   ================================================================= */
(function () {
  "use strict";
  const SLS = (window.SLS = window.SLS || {});
  const PX = {};
  SLS.PX = PX;

  /* ---------------------------------------------------------------
     PALETTE — sampled from the approved sprite sheet
     --------------------------------------------------------------- */
  const P = {
    hairDark:  "#151a2b",
    hair:      "#1e2740",
    hairLit:   "#2d3a5c",
    skin:      "#e8b489",
    skinShade: "#c68d63",
    skinLine:  "#8a5a3c",
    cloth:     "#2b3247",   // shirt (lighter navy)
    pants:     "#191d27",   // trousers (darker, separates the legs)
    sleeve:    "#333c54",   // upper arm, lighter still so arms clear the torso
    clothDark: "#141822",
    clothLit:  "#3d4762",
    collar:    "#1a1f2e",
    wrap:      "#d9d2c0",   // arm / leg bandage wraps
    wrapShade: "#b3ab97",
    glove:     "#1b1f2b",
    sandal:    "#2a2622",
    strap:     "#6b4a2c",
    strapLit:  "#8a6238",
    clanRed:   "#a8302e",
    clanWhite: "#d8d2c4",
    metal:     "#b9c2cc",
    metalLit:  "#e2e9f0",
    metalDark: "#6d7581",
    eyeWhite:  "#f2f2f2",
    eyeDark:   "#20242e",
    sharingan: "#c62828",
    byakugan:  "#e8eaf2",
    bloodline: "#8a2be2",
    shadow:    "rgba(0,0,0,0.42)"
  };
  PX.palette = P;

  /* ---------------------------------------------------------------
     AGE STAGES — proportions per life stage.
     h = overall height in px, head = head radius, limb = limb length
     factor, gear = may show weapons/headband.
     --------------------------------------------------------------- */
  const STAGES = {
    newborn:    { h: 20, head: 7.0, limb: 0.42, hair: 0.55, gear: false, crawl: true },
    toddler:    { h: 28, head: 6.4, limb: 0.60, hair: 0.70, gear: false },
    child:      { h: 36, head: 6.0, limb: 0.74, hair: 0.82, gear: false },
    academyAge: { h: 44, head: 5.8, limb: 0.86, hair: 0.92, gear: "training" },
    adolescent: { h: 52, head: 5.6, limb: 0.95, hair: 1.00, gear: true },
    teen:       { h: 56, head: 5.4, limb: 1.00, hair: 1.00, gear: true },
    youngAdult: { h: 60, head: 5.2, limb: 1.04, hair: 1.00, gear: true },
    adult:      { h: 60, head: 5.2, limb: 1.06, hair: 0.98, gear: true },
    veteran:    { h: 58, head: 5.3, limb: 1.04, hair: 0.94, gear: true },
    elder:      { h: 54, head: 5.5, limb: 0.98, hair: 0.86, gear: true }
  };
  PX.stages = STAGES;

  /* ---------------------------------------------------------------
     ANIMATION TABLE — frame counts, timing, loop + transition rules
     Mirrors the reference sheet exactly.
     --------------------------------------------------------------- */
  PX.states = {
    idle:    { frames: 4, dur: 260, loop: true,  interruptible: true,  next: null,     label: "Idle" },
    walk:    { frames: 6, dur: 130, loop: true,  interruptible: true,  next: null,     label: "Walk" },
    run:     { frames: 6, dur: 95,  loop: true,  interruptible: true,  next: null,     label: "Run" },
    combat:  { frames: 4, dur: 220, loop: true,  interruptible: true,  next: null,     label: "Combat" },
    attack:  { frames: 6, dur: 80,  loop: false, interruptible: false, next: "combat", label: "Attack", hitFrame: 3 },
    jutsu:   { frames: 7, dur: 110, loop: false, interruptible: false, next: "combat", label: "Jutsu",  hitFrame: 6 },
    jump:    { frames: 5, dur: 120, loop: false, interruptible: false, next: "idle",   label: "Jump" },
    injured: { frames: 3, dur: 420, loop: true,  interruptible: true,  next: null,     label: "Injured" },
    dead:    { frames: 1, dur: 999999, loop: false, interruptible: false, next: null,  label: "Dead" }
  };

  /* Which states each age stage is allowed to play (a baby cannot fight). */
  PX.stageStates = {
    newborn:    ["idle", "injured", "dead"],
    toddler:    ["idle", "walk", "jump", "injured", "dead"],
    child:      ["idle", "walk", "run", "jump", "injured", "dead"],
    academyAge: ["idle", "walk", "run", "combat", "attack", "jutsu", "jump", "injured", "dead"],
    adolescent: ["idle", "walk", "run", "combat", "attack", "jutsu", "jump", "injured", "dead"],
    teen:       ["idle", "walk", "run", "combat", "attack", "jutsu", "jump", "injured", "dead"],
    youngAdult: ["idle", "walk", "run", "combat", "attack", "jutsu", "jump", "injured", "dead"],
    adult:      ["idle", "walk", "run", "combat", "attack", "jutsu", "jump", "injured", "dead"],
    veteran:    ["idle", "walk", "run", "combat", "attack", "jutsu", "jump", "injured", "dead"],
    elder:      ["idle", "walk", "run", "combat", "attack", "jutsu", "jump", "injured", "dead"]
  };
  PX.allows = function (stage, state) {
    const list = PX.stageStates[stage] || PX.stageStates.adult;
    return list.indexOf(state) !== -1;
  };
  /* Nearest legal fallback when a stage cannot play a state. */
  PX.fallback = function (stage, state) {
    if (PX.allows(stage, state)) return state;
    const chain = { run: "walk", walk: "idle", combat: "idle", attack: "idle",
                    jutsu: "idle", jump: "idle", injured: "idle" };
    let s = state, guard = 0;
    while (s && !PX.allows(stage, s) && guard++ < 6) s = chain[s];
    return s || "idle";
  };

  /* ---------------------------------------------------------------
     POSES — joint angles per frame. Angles in degrees, 0 = straight
     down. Positive swings the limb forward (toward facing).
     --------------------------------------------------------------- */
  const D = Math.PI / 180;

  function lerpPose(a, b, t) {
    const o = {};
    Object.keys(a).forEach(k => {
      o[k] = typeof a[k] === "number" ? a[k] + (b[k] - a[k]) * t : a[k];
    });
    return o;
  }

  const BASE = {
    bodyY: 0, lean: 0, headTilt: 0, headX: 0,
    armLA: 6, armLB: 10, armRA: -6, armRB: 10,
    legLA: 3, legLB: 2, legRA: -3, legRB: 2,
    crouch: 0, blink: 0, weapon: "back", fx: null, airborne: 0
  };
  const pose = (o) => Object.assign({}, BASE, o);

  /* Each entry is an array of keyframes, one per animation frame. */
  const POSES = {
    // Gentle breathing + a blink on frame 3 (matches sheet's 4-frame idle)
    idle: [
      pose({ bodyY: 0,    armLA: 6,  armRA: -6, legLA: 3,  legRA: -3 }),
      pose({ bodyY: -0.6, armLA: 8,  armRA: -8, legLA: 3,  legRA: -3 }),
      pose({ bodyY: -0.9, armLA: 9,  armRA: -9, legLA: 3,  legRA: -3 }),
      pose({ bodyY: -0.3, armLA: 7,  armRA: -7, legLA: 3,  legRA: -3, blink: 1 })
    ],
    // Six-frame contact/pass/contact cycle
    walk: [
      pose({ bodyY: 0,    lean: 3, armLA: 26,  armRA: -26, legLA: -24, legRA: 24, legLB: 6,  legRB: 14 }),
      pose({ bodyY: -1.2, lean: 3, armLA: 14,  armRA: -14, legLA: -8,  legRA: 12, legLB: 2,  legRB: 26 }),
      pose({ bodyY: -0.4, lean: 3, armLA: 2,   armRA: -2,  legLA: 8,   legRA: -6, legLB: 0,  legRB: 10 }),
      pose({ bodyY: 0,    lean: 3, armLA: -26, armRA: 26,  legLA: 24,  legRA: -24, legLB: 14, legRB: 6 }),
      pose({ bodyY: -1.2, lean: 3, armLA: -14, armRA: 14,  legLA: 12,  legRA: -8, legLB: 26, legRB: 2 }),
      pose({ bodyY: -0.4, lean: 3, armLA: -2,  armRA: 2,   legLA: -6,  legRA: 8,  legLB: 10, legRB: 0 })
    ],
    // Deeper lean, bigger stride, arms pumped back (sheet's run)
    run: [
      pose({ bodyY: -1, lean: 14, armLA: 62,  armRA: -70, armLB: 62, armRB: 58, legLA: -46, legRA: 40, legLB: 10, legRB: 52 }),
      pose({ bodyY: -3, lean: 14, armLA: 40,  armRA: -46, armLB: 54, armRB: 46, legLA: -18, legRA: 22, legLB: 4,  legRB: 74 }),
      pose({ bodyY: -1, lean: 14, armLA: 10,  armRA: -12, armLB: 40, armRB: 34, legLA: 14,  legRA: -6, legLB: 0,  legRB: 40 }),
      pose({ bodyY: -1, lean: 14, armLA: -70, armRA: 62,  armLB: 58, armRB: 62, legLA: 40,  legRA: -46, legLB: 52, legRB: 10 }),
      pose({ bodyY: -3, lean: 14, armLA: -46, armRA: 40,  armLB: 46, armRB: 54, legLA: 22,  legRA: -18, legLB: 74, legRB: 4 }),
      pose({ bodyY: -1, lean: 14, armLA: -12, armRA: 10,  armLB: 34, armRB: 40, legLA: -6,  legRA: 14,  legLB: 40, legRB: 0 })
    ],
    // Wide braced stance, lead hand open (sheet frame 4)
    combat: [
      pose({ bodyY: 0,    lean: 7, crouch: 2.2, armLA: 44, armLB: 66, armRA: -32, armRB: 54, legLA: -20, legRA: 22, legLB: 16, legRB: 14 }),
      pose({ bodyY: -0.7, lean: 7, crouch: 2.0, armLA: 47, armLB: 62, armRA: -35, armRB: 50, legLA: -20, legRA: 22, legLB: 16, legRB: 14 }),
      pose({ bodyY: -1.0, lean: 8, crouch: 2.2, armLA: 45, armLB: 64, armRA: -33, armRB: 52, legLA: -20, legRA: 22, legLB: 16, legRB: 14 }),
      pose({ bodyY: -0.4, lean: 7, crouch: 2.1, armLA: 43, armLB: 68, armRA: -31, armRB: 56, legLA: -20, legRA: 22, legLB: 16, legRB: 14 })
    ],
    // Katana slash: wind-up, draw, strike, follow-through, recover
    attack: [
      pose({ lean: -6, crouch: 2, armLA: -50, armLB: 30, armRA: -40, armRB: 70, legLA: -16, legRA: 18, weapon: "draw" }),
      pose({ lean: 4,  crouch: 3, armLA: -80, armLB: 20, armRA: -70, armRB: 40, legLA: -22, legRA: 24, weapon: "hand", fx: "wind" }),
      pose({ lean: 16, crouch: 4, armLA: 40,  armLB: 10, armRA: 20,  armRB: 20, legLA: -30, legRA: 30, weapon: "hand", fx: "slashA" }),
      pose({ lean: 22, crouch: 5, armLA: 82,  armLB: 6,  armRA: 54,  armRB: 14, legLA: -34, legRA: 34, weapon: "hand", fx: "slashB" }),
      pose({ lean: 14, crouch: 3, armLA: 66,  armLB: 24, armRA: 40,  armRB: 30, legLA: -26, legRA: 26, weapon: "hand", fx: "slashC" }),
      pose({ lean: 7,  crouch: 2, armLA: 44,  armLB: 66, armRA: -32, armRB: 54, legLA: -20, legRA: 22, weapon: "hand" })
    ],
    // Hand signs → gather → release (fireball on the last frame)
    jutsu: [
      pose({ lean: 0, crouch: 1, armLA: 62, armLB: 96, armRA: 58, armRB: 96, weapon: "back", fx: "sign" }),
      pose({ lean: 0, crouch: 1, armLA: 70, armLB: 104, armRA: 66, armRB: 104, weapon: "back", fx: "sign" }),
      pose({ lean: 0, crouch: 2, armLA: 58, armLB: 92, armRA: 54, armRB: 92, weapon: "back", fx: "sign2" }),
      pose({ lean: 2, crouch: 2, armLA: 66, armLB: 100, armRA: 62, armRB: 100, weapon: "back", fx: "charge" }),
      pose({ lean: -4, crouch: 3, armLA: 72, armLB: 88, armRA: 68, armRB: 88, weapon: "back", fx: "charge2" }),
      pose({ lean: 8, crouch: 2, armLA: 84, armLB: 26, armRA: 78, armRB: 30, legLA: -18, legRA: 20, weapon: "back", fx: "release" }),
      pose({ lean: 10, crouch: 2, armLA: 88, armLB: 14, armRA: 82, armRB: 18, legLA: -20, legRA: 22, weapon: "back", fx: "projectile" })
    ],
    // Crouch → launch → apex → descend → land
    jump: [
      pose({ bodyY: 2,   crouch: 6, armLA: -30, armRA: 30,  legLA: -8, legRA: 8,  legLB: 40, legRB: 40 }),
      pose({ bodyY: -10, airborne: 1, lean: 8,  armLA: 70,  armRA: -60, legLA: -30, legRA: 26, legLB: 50, legRB: 14 }),
      pose({ bodyY: -16, airborne: 1, lean: 4,  armLA: 40,  armRA: -34, legLA: -22, legRA: 30, legLB: 62, legRB: 22 }),
      pose({ bodyY: -8,  airborne: 1, lean: -4, armLA: 10,  armRA: -8,  legLA: -6,  legRA: 10, legLB: 34, legRB: 18 }),
      pose({ bodyY: 1,   crouch: 4, armLA: -16, armRA: 16,  legLA: -6,  legRA: 6,  legLB: 28, legRB: 28 })
    ],
    // Hunched, one arm clutching the ribs
    injured: [
      pose({ bodyY: 2, lean: 16, crouch: 5, headTilt: 10, armLA: 54, armLB: 78, armRA: 18, armRB: 40, legLA: -10, legRA: 12, legLB: 16, legRB: 12 }),
      pose({ bodyY: 3, lean: 18, crouch: 6, headTilt: 12, armLA: 56, armLB: 82, armRA: 20, armRB: 44, legLA: -10, legRA: 12, legLB: 18, legRB: 14 }),
      pose({ bodyY: 2, lean: 15, crouch: 5, headTilt: 9,  armLA: 52, armLB: 76, armRA: 16, armRB: 38, legLA: -10, legRA: 12, legLB: 16, legRB: 12 })
    ],
    dead: [
      pose({ bodyY: 0, lean: 90, crouch: 0, headTilt: 20, armLA: 70, armRA: -70, legLA: -14, legRA: 16, prone: 1 })
    ]
  };
  PX.poses = POSES;

  /* Rare idle variations layered on top of the base idle loop. */
  PX.idleVariations = {
    headband: { frames: 6, dur: 190, build: () => [
      pose({ armLA: 40, armLB: 96 }), pose({ armLA: 62, armLB: 118 }),
      pose({ armLA: 68, armLB: 124 }), pose({ armLA: 64, armLB: 120 }),
      pose({ armLA: 40, armLB: 96 }),  pose({})
    ] },
    lookAround: { frames: 6, dur: 240, build: () => [
      pose({ headX: -2 }), pose({ headX: -3 }), pose({ headX: 0 }),
      pose({ headX: 3 }),  pose({ headX: 2 }),  pose({})
    ] },
    touchHilt: { frames: 6, dur: 200, build: () => [
      pose({ armRA: -34, armRB: 54 }), pose({ armRA: -52, armRB: 76 }),
      pose({ armRA: -58, armRB: 82 }), pose({ armRA: -54, armRB: 78 }),
      pose({ armRA: -30, armRB: 40 }), pose({})
    ] },
    stretch: { frames: 6, dur: 230, build: () => [
      pose({ armLA: 40, armRA: -40 }), pose({ armLA: 100, armRA: -100, bodyY: -1 }),
      pose({ armLA: 128, armRA: -128, bodyY: -2 }), pose({ armLA: 110, armRA: -110, bodyY: -1 }),
      pose({ armLA: 50, armRA: -50 }), pose({})
    ] },
    chakraFlicker: { frames: 6, dur: 170, build: () => [
      pose({ fx: "flicker" }), pose({ fx: "flicker" }), pose({ fx: "flicker" }),
      pose({}), pose({}), pose({})
    ] },
    shiftStance: { frames: 6, dur: 210, build: () => [
      pose({ legLA: 6, legRA: -6 }), pose({ legLA: 10, legRA: -9, bodyY: -1 }),
      pose({ legLA: 8, legRA: -8 }), pose({ legLA: 4, legRA: -4 }),
      pose({ legLA: 3, legRA: -3 }), pose({})
    ] }
  };

  PX.poseFor = function (state, frameIdx, cfg) {
    const list = POSES[state] || POSES.idle;
    const i = Math.max(0, Math.min(list.length - 1, frameIdx | 0));
    return list[i];
  };

  /* ---------------------------------------------------------------
     PIXEL DRAWING PRIMITIVES (integer grid, no anti-aliasing)
     --------------------------------------------------------------- */
  /* Darken/lighten a hex colour by an amount (used for coherent hair shading). */
  function shade(hex, amt) {
    if (!hex || hex[0] !== "#") return hex;
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) + amt, g2 = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
    r = Math.max(0, Math.min(255, r)); g2 = Math.max(0, Math.min(255, g2)); b = Math.max(0, Math.min(255, b));
    return "#" + ((r << 16) | (g2 << 8) | b).toString(16).padStart(6, "0");
  }
  PX.shade = shade;

  function mkCtx(ctx) {
    return {
      rect(x, y, w, h, c) {
        if (w <= 0 || h <= 0) return;
        ctx.fillStyle = c;
        ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
      },
      px(x, y, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); },
      /* Thick pixel line used for every limb segment. */
      limb(x1, y1, x2, y2, t, c) {
        const dx = x2 - x1, dy = y2 - y1;
        const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
        ctx.fillStyle = c;
        const half = t / 2;
        for (let i = 0; i <= steps; i++) {
          const x = x1 + (dx * i) / steps, y = y1 + (dy * i) / steps;
          ctx.fillRect(Math.round(x - half), Math.round(y - half), Math.max(1, Math.round(t)), Math.max(1, Math.round(t)));
        }
      },
      circle(cx, cy, r, c) {
        ctx.fillStyle = c;
        for (let y = -r; y <= r; y++) {
          const w = Math.floor(Math.sqrt(Math.max(0, r * r - y * y)));
          if (w > 0) ctx.fillRect(Math.round(cx - w), Math.round(cy + y), Math.max(1, w * 2), 1);
        }
      },
      ellipse(cx, cy, rx, ry, c) {
        ctx.fillStyle = c;
        for (let y = -ry; y <= ry; y++) {
          const w = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
          if (w > 0) ctx.fillRect(Math.round(cx - w), Math.round(cy + y), Math.max(1, w * 2), 1);
        }
      }
    };
  }

  /* Rotate a point around a joint. */
  function joint(ox, oy, len, angDeg, facing) {
    const a = angDeg * D;
    return { x: ox + Math.sin(a) * len * facing, y: oy + Math.cos(a) * len };
  }

  /* Shared geometry so the renderer, the portrait cropper and any caller
     all agree on where the figure sits inside a given canvas. */
  PX.geom = function (stageId, W, H) {
    const stage = STAGES[stageId] || STAGES.teen;
    const groundY = H - Math.max(2, H * 0.045);
    // Adults fill ~82% of the canvas; younger stages scale down proportionally.
    const bodyH = H * 0.80 * (stage.h / 60);
    const headR = bodyH * (stage.head / stage.h) * 1.28;   // chibi head
    return { stage, groundY, bodyH, headR,
             headCy: groundY - bodyH * 0.86 - 1 - headR * 0.82 };
  };

  /* ---------------------------------------------------------------
     MAIN FRAME RENDERER
     cfg = { stage, state, frame, facing, weapon, dojutsu, nature,
             hairColor, skinTone, clanMark, rankTier, pose }
     --------------------------------------------------------------- */
  PX.drawFrame = function (ctx, cfg) {
    cfg = cfg || {};
    const stage = STAGES[cfg.stage] || STAGES.teen;
    const st = cfg.state || "idle";
    const p = cfg.pose || PX.poseFor(st, cfg.frame || 0, cfg);
    const facing = cfg.facing === -1 ? -1 : 1;
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const g = mkCtx(ctx);

    const skin = cfg.skinTone || P.skin;
    const skinSh = cfg.skinShade || P.skinShade;
    const hair = cfg.hairColor || P.hair;
    const hairD = cfg.hairColor ? shade(cfg.hairColor, -26) : P.hairDark;
    const cloth = P.cloth, clothD = P.clothDark;

    // ---- layout ----
    // The figure is sized as a fraction of the canvas so it always fills the
    // frame, while stage.h keeps the *relative* difference between ages.
    const G0 = PX.geom(cfg.stage, W, H);
    const groundY = G0.groundY;
    const bodyH = G0.bodyH;
    const headR = G0.headR;
    const cx = W / 2 + (p.headX || 0) * 0;
    const feetY = groundY - (p.airborne ? 10 : 0) + (p.bodyY || 0);
    const crouch = p.crouch || 0;

    const hipY = feetY - bodyH * 0.42 + crouch;
    const shoulderY = feetY - bodyH * 0.86 + crouch;
    const neckY = shoulderY - 1;
    const headCy = neckY - headR * 0.82;
    const leanOff = (p.lean || 0) * 0.10 * facing;
    const shoulderX = cx + leanOff;
    const headX = shoulderX + leanOff * 0.9 + (p.headX || 0) * facing;

    const limbT = Math.max(2, Math.round(bodyH * 0.078));
    const armLen = bodyH * 0.21 * stage.limb;
    const legLen = bodyH * 0.24 * stage.limb;
    const torsoW = Math.max(5, Math.round(bodyH * 0.25));

    // ---- ground shadow ----
    const shW = Math.max(4, torsoW * (p.airborne ? 0.7 : 1.25));
    g.ellipse(cx, groundY + 2, shW, Math.max(1, shW * 0.22), P.shadow);

    if (cfg.prone || p.prone) {
      // Dead: lay the figure on its side, pivoting about the feet.
      ctx.save();
      const px0 = cx, py0 = groundY - bodyH * 0.5;
      ctx.translate(px0, py0);
      ctx.rotate(85 * D * facing);
      ctx.translate(-px0, -py0);
    }

    /* ---------- chakra-nature aura (behind everything) ---------- */
    // Kept deliberately faint so it reads as a glow, never a blob over the art.
    if (cfg.natureAura && cfg.natureColor) {
      ctx.save(); ctx.globalAlpha = 0.13;
      g.ellipse(cx, feetY - bodyH * 0.48, torsoW * 1.45, bodyH * 0.40, cfg.natureColor);
      ctx.globalAlpha = 0.08;
      g.ellipse(cx, feetY - bodyH * 0.48, torsoW * 2.0, bodyH * 0.52, cfg.natureColor);
      ctx.restore();
    }
    if (cfg.cloak && cfg.cloakColor) {
      ctx.save(); ctx.globalAlpha = 0.30;
      g.ellipse(cx, feetY - bodyH * 0.48, torsoW * 1.8, bodyH * 0.50, cfg.cloakColor);
      ctx.restore();
    }

    /* ---------- katana on the back (drawn behind the body) ---------- */
    const showWeapon = stage.gear && cfg.weapon;
    if (showWeapon && p.weapon === "back") {
      // Short diagonal sheath tucked behind the shoulder, hilt poking above it.
      const by = shoulderY + 1;
      const x1 = shoulderX - torsoW * 0.55 * facing, y1 = by + bodyH * 0.22;
      const x2 = shoulderX + torsoW * 0.62 * facing, y2 = by - bodyH * 0.12;
      g.limb(x1, y1, x2, y2, Math.max(2, bodyH * 0.030), P.metalDark);
      // hilt above the shoulder line
      const hx = x2 + (x2 - x1) * 0.16, hy = y2 + (y2 - y1) * 0.16;
      g.limb(x2, y2, hx, hy, Math.max(2, bodyH * 0.034), P.strap);
    }

    /* ---------- back arm ---------- */
    const drawArm = (angA, angB, isBack) => {
      const sx = shoulderX - (isBack ? 1 : -1) * facing * (torsoW * 0.46);
      const sy = shoulderY + 1;
      const e = joint(sx, sy, armLen, angA, facing);
      const hnd = joint(e.x, e.y, armLen * 0.95, angA + angB * 0.55, facing);
      const c = isBack ? P.clothDark : P.sleeve;
      g.limb(sx, sy, e.x, e.y, limbT, c);
      // forearm wrap (reference has bandages from elbow to wrist)
      g.limb(e.x, e.y, hnd.x, hnd.y, limbT - 0.5, isBack ? P.wrapShade : P.wrap);
      // glove / hand
      g.rect(hnd.x - limbT * 0.40, hnd.y - limbT * 0.42, limbT * 0.80, limbT * 0.84, isBack ? "#20252f" : P.glove);
      g.rect(hnd.x - limbT * 0.42, hnd.y - limbT * 0.46, limbT * 0.84, Math.max(1, limbT * 0.20), isBack ? P.wrapShade : P.wrap);
      return hnd;
    };

    const drawLeg = (angA, angB, isBack) => {
      const hx = shoulderX - (isBack ? 1 : -1) * facing * (torsoW * 0.24) - leanOff;
      const hy = hipY;
      const k = joint(hx, hy, legLen, angA, facing);
      const ft = joint(k.x, k.y, legLen * 0.95, angA - angB * 0.35, facing);
      const c = isBack ? P.clothDark : P.pants;
      g.limb(hx, hy, k.x, k.y, limbT + 0.5, c);
      g.limb(k.x, k.y, ft.x, ft.y, limbT, c);
      // shin wraps run from mid-calf to the ankle, then the sandal
      const wrapC = isBack ? P.wrapShade : P.wrap;
      g.limb(k.x + (ft.x - k.x) * 0.35, k.y + (ft.y - k.y) * 0.35, ft.x, ft.y, limbT * 0.92, wrapC);
      g.rect(ft.x - limbT * 0.8, ft.y, limbT * 1.7, Math.max(2, bodyH * 0.028), P.sandal);
      g.rect(ft.x - limbT * 0.8, ft.y, limbT * 1.7, 1, "#3d3830");
      return ft;
    };

    // back limbs
    drawArm(p.armRA, p.armRB, true);
    drawLeg(p.legRA, p.legRB, true);

    /* ---------- torso ---------- */
    const torsoTop = shoulderY - 1;
    const torsoH = hipY - torsoTop;
    g.rect(shoulderX - torsoW / 2, torsoTop, torsoW, torsoH, cloth);
    // rim light / shade down the sides so the body is not a flat silhouette
    g.rect(shoulderX + torsoW * 0.36, torsoTop, Math.max(1, torsoW * 0.14), torsoH, P.clothLit);
    g.rect(shoulderX - torsoW * 0.5, torsoTop, Math.max(1, torsoW * 0.12), torsoH, P.clothDark);
    // high collar + scarf reaching the chin (reference silhouette)
    const collH = Math.max(3, bodyH * 0.075);
    g.rect(shoulderX - torsoW * 0.46, torsoTop - collH * 0.75, torsoW * 0.92, collH, P.collar);
    g.rect(shoulderX - torsoW * 0.46, torsoTop - collH * 0.75, torsoW * 0.92, Math.max(1, collH * 0.28), "#2b3145");
    // scarf tail flicking to the back
    g.limb(shoulderX - torsoW * 0.44 * facing, torsoTop,
           shoulderX - torsoW * 0.95 * facing, torsoTop + bodyH * 0.16, Math.max(2, bodyH * 0.035), P.collar);
    // waist sash / belt
    g.rect(shoulderX - torsoW / 2, hipY - 3, torsoW, Math.max(2, bodyH * 0.03), P.clothDark);
    g.rect(shoulderX - torsoW * 0.18, hipY - 3, torsoW * 0.22, 2, P.strapLit);
    // chest strap (katana harness) — only when geared
    if (showWeapon) {
      g.limb(shoulderX - torsoW * 0.42 * facing, torsoTop + 1,
             shoulderX + torsoW * 0.34 * facing, hipY - 3, 1.6, P.strap);
    }
    // clan mark on the shoulder
    if (cfg.clanMark && torsoW >= 6) {
      const mx = shoulderX + torsoW * 0.30 * facing, my = torsoTop + 2.5;
      g.circle(mx, my, 1.9, P.clanRed);
      g.px(mx, my - 1, P.clanWhite);
    }

    /* ---------- front limbs ---------- */
    const frontHand = drawArm(p.armLA, p.armLB, false);
    drawLeg(p.legLA, p.legLB, false);

    /* ---------- head ---------- */
    const hR = headR;
    // neck
    g.rect(headX - 1.2, neckY - 2, 2.4, 3, skinSh);
    // face
    g.ellipse(headX, headCy, hR * 0.86, hR * 0.94, skin);
    // jaw shading
    g.rect(headX - hR * 0.5, headCy + hR * 0.45, hR, 1, skinSh);

    // ---- hair: dense spiky mass (reference silhouette) ----
    // Short, thick, overlapping wedges so the crown reads as one solid
    // shape rather than separate antennae.
    const hs = stage.hair;
    const HR = hR * hs;
    // back mass + top volume
    g.ellipse(headX, headCy - hR * 0.46, HR * 1.12, HR * 0.84, hairD);
    g.ellipse(headX, headCy - hR * 0.62, HR * 1.02, HR * 0.66, hair);
    // radiating spikes: [angle°, length×HR, width×HR]
    const spikes = [
      [-74, 1.30, 0.52], [-56, 1.46, 0.50], [-34, 1.52, 0.48], [-12, 1.44, 0.46],
      [ 10, 1.48, 0.46], [ 32, 1.50, 0.48], [ 54, 1.42, 0.50], [ 74, 1.26, 0.52],
      [-96, 1.02, 0.46], [ 96, 1.02, 0.46], [-114, 0.86, 0.42], [114, 0.86, 0.42]
    ];
    spikes.forEach((s, i) => {
      const a = s[0] * D;
      const ox = headX + Math.sin(a) * HR * 0.42;
      const oy = headCy - hR * 0.34 - Math.cos(a) * HR * 0.20;
      const tx = headX + Math.sin(a) * HR * s[1];
      const ty = headCy - hR * 0.34 - Math.cos(a) * HR * s[1];
      g.limb(ox, oy, tx, ty, Math.max(1.6, HR * s[2]), i % 2 ? hairD : hair);
    });
    // side fringe framing the face
    g.limb(headX - HR * 0.88, headCy - hR * 0.26, headX - HR * 0.70, headCy + hR * 0.58, Math.max(1.6, HR * 0.34), hair);
    g.limb(headX + HR * 0.88, headCy - hR * 0.26, headX + HR * 0.70, headCy + hR * 0.58, Math.max(1.6, HR * 0.34), hair);

    /* ---------- headband (only once graduated) ---------- */
    if (cfg.headband && stage.gear) {
      const by = headCy - hR * 0.34;
      g.rect(headX - hR * 0.92, by - 1.4, hR * 1.84, 2.8, P.clothDark);
      const pw = Math.max(3, hR * 0.78);
      g.rect(headX - pw / 2, by - 1.5, pw, 3, P.metal);
      g.rect(headX - pw / 2, by - 1.5, pw, 1, P.metalLit);
      // engraved village swirl
      g.px(headX, by, P.metalDark);
      g.px(headX - 1, by, P.metalDark);
      g.px(headX, by + 1, P.metalDark);
      // trailing cloth
      g.limb(headX - hR * 0.9, by, headX - hR * 1.1, by + hR * 1.2, 1.6, P.clothDark);
    }

    /* ---------- eyes / dojutsu ---------- */
    if (!p.prone && hR >= 4) {
      const eyeY = headCy + hR * 0.06;
      const dx = hR * 0.34;
      const blink = p.blink === 1;
      const dj = cfg.dojutsu;
      if (blink) {
        g.rect(headX - dx - 1.4, eyeY, 2.8, 1, P.skinLine);
        g.rect(headX + dx - 1.4, eyeY, 2.8, 1, P.skinLine);
      } else if (dj === "sharingan") {
        [-1, 1].forEach(s => {
          g.rect(headX + s * dx - 1.5, eyeY - 1, 3, 2.4, P.eyeWhite);
          g.rect(headX + s * dx - 1.2, eyeY - 0.8, 2.4, 2, P.sharingan);
          g.px(headX + s * dx, eyeY, P.eyeDark);
          // tomoe specks
          g.px(headX + s * dx - 1, eyeY - 1, "#4a0d0d");
          g.px(headX + s * dx + 1, eyeY + 1, "#4a0d0d");
        });
      } else if (dj === "byakugan") {
        [-1, 1].forEach(s => {
          g.rect(headX + s * dx - 1.6, eyeY - 1, 3.2, 2.4, P.byakugan);
          g.px(headX + s * dx, eyeY, "#c9cede");
        });
      } else {
        [-1, 1].forEach(s => {
          g.rect(headX + s * dx - 1.4, eyeY - 0.6, 2.8, 2, P.eyeWhite);
          g.rect(headX + s * dx - 0.6, eyeY - 0.4, 1.6, 1.8, P.eyeDark);
        });
      }
      // brow, nose and mouth for a readable anime face
      const ey = Math.max(1.6, hR * 0.20);                 // eye half-height
      const bw = Math.max(3, hR * 0.42), bh = Math.max(1, hR * 0.10);
      g.rect(headX - dx - bw / 2, eyeY - ey * 1.9, bw, bh, hairD);
      g.rect(headX + dx - bw / 2, eyeY - ey * 1.9, bw, bh, hairD);
      g.rect(headX - Math.max(1, hR * 0.05), eyeY + ey * 1.2, Math.max(1, hR * 0.10), Math.max(1, hR * 0.10), P.skinShade);
      g.rect(headX - Math.max(1, hR * 0.14), eyeY + ey * 2.1, Math.max(2, hR * 0.28), Math.max(1, hR * 0.09), P.skinLine);
    }

    /* ---------- held weapon + effects ---------- */
    if (showWeapon && (p.weapon === "hand" || p.weapon === "draw")) {
      const wl = bodyH * 0.42;
      const ang = (p.armLA || 0) + 40;
      const tip = joint(frontHand.x, frontHand.y, wl, ang, facing);
      g.limb(frontHand.x, frontHand.y, tip.x, tip.y, 1.8, P.metalLit);
      g.limb(frontHand.x, frontHand.y, frontHand.x - (tip.x - frontHand.x) * 0.12,
             frontHand.y - (tip.y - frontHand.y) * 0.12, 2.4, P.strap);
    }

    // Attack arc / jutsu effects
    const fx = p.fx;
    if (fx && cfg.effects !== false) {
      ctx.save();
      if (fx === "slashA" || fx === "slashB" || fx === "slashC") {
        const r = bodyH * (fx === "slashB" ? 0.52 : 0.44);
        const a0 = fx === "slashA" ? -0.7 : fx === "slashB" ? 0.1 : 0.7;
        ctx.strokeStyle = "rgba(240,245,255,0.85)";
        ctx.lineWidth = fx === "slashB" ? 2.4 : 1.6;
        ctx.beginPath();
        ctx.arc(shoulderX, shoulderY + 2, r, a0 - 0.9, a0 + 0.5);
        ctx.stroke();
      } else if (fx === "sign" || fx === "sign2") {
        g.rect(frontHand.x - 2, frontHand.y - 2, 4, 4, "rgba(180,220,255,0.55)");
      } else if (fx === "charge" || fx === "charge2") {
        const r = fx === "charge2" ? 5 : 3.4;
        g.circle(frontHand.x, frontHand.y - 1, r, cfg.natureColor || "#ff8a3d");
        ctx.globalAlpha = 0.5;
        g.circle(frontHand.x, frontHand.y - 1, r + 2, cfg.natureColor || "#ffb066");
      } else if (fx === "release") {
        g.circle(frontHand.x + 4 * facing, frontHand.y, 4, cfg.natureColor || "#ff7a2d");
      } else if (fx === "projectile") {
        const px2 = frontHand.x + 10 * facing;
        g.circle(px2, frontHand.y, 3.6, cfg.natureColor || "#ff7a2d");
        ctx.globalAlpha = 0.7;
        g.circle(px2 - 3 * facing, frontHand.y, 2.2, "#ffd08a");
      } else if (fx === "flicker") {
        ctx.globalAlpha = 0.5;
        g.ellipse(cx, feetY - bodyH * 0.5, torsoW * 1.5, bodyH * 0.42, cfg.natureColor || "#7ec2f0");
      } else if (fx === "wind") {
        ctx.globalAlpha = 0.16;
        g.ellipse(cx, feetY - bodyH * 0.5, torsoW * 0.85, bodyH * 0.22, "#cfd8e6");
      }
      ctx.restore();
    }

    // Injury overlay
    if (cfg.injured) {
      g.rect(headX - hR * 0.5, headCy + hR * 0.2, 3, 1, "#a33");
      g.rect(shoulderX - torsoW * 0.3, torsoTop + torsoH * 0.5, torsoW * 0.5, 1.4, P.wrap);
    }

    if (cfg.prone || p.prone) ctx.restore();
  };

  /* ---------------------------------------------------------------
     Convenience: build a standalone canvas for one frame
     (used by the ANIMATIONS strip panel and portraits)
     --------------------------------------------------------------- */
  PX.spriteCanvas = function (cfg, w, h, scale) {
    const c = document.createElement("canvas");
    c.width = w || 48; c.height = h || 64;
    const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    PX.drawFrame(ctx, cfg);
    if (scale && scale !== 1) {
      const o = document.createElement("canvas");
      o.width = c.width * scale; o.height = c.height * scale;
      const octx = o.getContext("2d");
      octx.imageSmoothingEnabled = false;
      octx.drawImage(c, 0, 0, o.width, o.height);
      return o;
    }
    return c;
  };

  /* Portrait bust for the profile / top bar — crops to the head using the
     same geometry the renderer used, so it never drifts out of frame. */
  PX.portraitCanvas = function (cfg, size) {
    const s = size || 64;
    const c = document.createElement("canvas");
    c.width = s; c.height = s;
    const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    const TW = 120, TH = 160;                    // render big, then crop
    const tmp = document.createElement("canvas");
    tmp.width = TW; tmp.height = TH;
    const tctx = tmp.getContext("2d");
    tctx.imageSmoothingEnabled = false;
    PX.drawFrame(tctx, Object.assign({}, cfg, {
      state: "idle", frame: 0, pose: PX.poseFor("idle", 0, cfg),
      effects: false, natureAura: false, cloak: null
    }));
    const G = PX.geom(cfg.stage, TW, TH);
    const box = G.headR * 3.6;
    ctx.fillStyle = "#0a0d12"; ctx.fillRect(0, 0, s, s);
    ctx.drawImage(tmp, TW / 2 - box / 2, G.headCy - box * 0.52, box, box, 0, 0, s, s);
    return c;
  };

})();
