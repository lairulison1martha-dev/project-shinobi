/* =================================================================
   SHINOBI LIFE SIMULATOR — layers.js
   -----------------------------------------------------------------
   LAYERED CHARACTER COMPOSITOR.

   The stage atlases in assets/characters/<stage>/ stay the single
   source of animation: age, proportions, movement, states, timing.
   Everything else — clan, hair, eyes, headband, outfit, armour,
   weapon, accessories, injuries, dojutsu, aura, transformation,
   summon and jinchuriki — is composed on top as a reusable layer.

   That means a Hyuga genin with a katana and an active Byakugan costs
   one base atlas plus a handful of small overlays, not a bespoke
   sprite sheet. Nothing here duplicates an animation.

   Each layer resolves in two steps:
     1. an overlay atlas PNG aligned cell-for-cell with the base sheet
        (drop art into assets/<folder>/ and it is picked up), else
     2. a procedural painter pinned to the frame's attachment anchors.

   Render order is fixed by ORDER below.

   Exposes: SLS.Layers
     Layers.compose(ctx, opts)   — draw the full stack for one frame
     Layers.describe(g)          — game state → layer descriptor
     Layers.fromPreset(id)       — characters.json entry → descriptor
   ================================================================= */
(function () {
  "use strict";
  const SLS = (window.SLS = window.SLS || {});
  const TAU = Math.PI * 2;

  /* Fixed bottom-to-top paint order. */
  const ORDER = [
    "clan", "hair", "eyes", "headband", "outfit", "armor", "weapon",
    "accessory", "injury", "dojutsu", "aura", "transformation",
    "summon", "jinchuriki"
  ];

  /* ---------------------------------------------------------------
     CLAN VISUAL IDENTITY
     Overlays only — a clan never swaps the animation atlas.
     --------------------------------------------------------------- */
  const CLANS = {
    uchiha: {
      crest: "fan", crestColor: "#b3382f", crestAlt: "#e7e3dc",
      hair: "#1b1d29", robe: "#1d2230", trim: "#2f3646",
      armor: "dark", eyeDefault: "normal", accent: "#d4453a"
    },
    hyuga: {
      crest: "flame", crestColor: "#e8e4d8", crestAlt: "#6f7b8c",
      hair: "#2a2b33", robe: "#e5e0d2", trim: "#b9b19c",
      armor: "robe", eyeDefault: "byakugan", accent: "#cfd8e6", stance: "gentlefist"
    },
    uzumaki: {
      crest: "spiral", crestColor: "#c8483a", crestAlt: "#f0e7d4",
      hair: "#b8392c", robe: "#2c3550", trim: "#c8483a",
      armor: "light", eyeDefault: "normal", accent: "#e2603f", chains: true
    },
    senju: {
      crest: "leaf", crestColor: "#4f7d43", crestAlt: "#d9cfae",
      hair: "#3a2a1e", robe: "#3d4a35", trim: "#7d6a3f",
      armor: "leaf", eyeDefault: "normal", accent: "#6fa055", wood: true
    },
    nara: {
      crest: "deer", crestColor: "#2b2f38", crestAlt: "#9aa3b0",
      hair: "#1f2129", robe: "#28303a", trim: "#3c4654",
      armor: "dark", eyeDefault: "normal", accent: "#5b6472", shadow: true
    }
  };
  /* Every other clan falls back to the common look. */
  const CLAN_COMMON = {
    crest: null, crestColor: "#8a7a5c", crestAlt: "#d9cfae",
    hair: null, robe: null, trim: null, armor: null,
    eyeDefault: "normal", accent: "#c9a227"
  };

  /* ---------------------------------------------------------------
     DOJUTSU — eyes are always their own layer. Changing an eye never
     duplicates an animation sheet.
     --------------------------------------------------------------- */
  const EYES = {
    normal:    { sclera: "#f2efe6", iris: "#2a2f3a", glow: null },
    sharingan: { sclera: "#f2efe6", iris: "#c0181c", ring: "#5c0a0a", glow: "#e23b3b", tomoe: 3 },
    mangekyo:  { sclera: "#f2efe6", iris: "#d01a1a", ring: "#3d0505", glow: "#ff4d4d", pattern: "shuriken" },
    eternal:   { sclera: "#f6f2e8", iris: "#e02222", ring: "#2b0303", glow: "#ff6a6a", pattern: "eternal" },
    byakugan:  { sclera: "#eef2fa", iris: "#dfe6f2", ring: "#b9c4d6", glow: "#cfe0ff", veins: true },
    rinnegan:  { sclera: "#d9c9ee", iris: "#8f6fd0", ring: "#5b3f97", glow: "#b58cff", rings: 4 }
  };
  /* Legacy ids used elsewhere in the game map onto the above. */
  const EYE_ALIAS = {
    none: "normal", null: "normal", sharingan1: "sharingan", sharingan2: "sharingan",
    sharingan3: "sharingan", mangekyo: "mangekyo", eternalMangekyo: "eternal",
    ems: "eternal", byakugan: "byakugan", rinnegan: "rinnegan"
  };

  /* ---------------------------------------------------------------
     CHAKRA NATURES — procedural, higher fidelity than a flat blob.
     --------------------------------------------------------------- */
  const NATURES = {
    Fire:      { a: "#ff7a2d", b: "#ffd08a", rise: -1, wob: 1.5, blend: "lighter", licks: 7 },
    Water:     { a: "#3f87cf", b: "#a5dcf3", rise: 0.4, wob: 0.9, blend: "lighter", licks: 5 },
    Wind:      { a: "#5fc48a", b: "#c6f4d8", rise: -0.3, wob: 2.2, blend: "lighter", licks: 4, ring: true },
    Earth:     { a: "#a87c45", b: "#e2c48c", rise: 0.9, wob: 0.5, blend: "source-over", licks: 5, shard: true },
    Lightning: { a: "#d9c74b", b: "#fdfbc8", rise: -0.6, wob: 3.4, blend: "lighter", licks: 6, bolt: true },
    Wood:      { a: "#4f7d43", b: "#a9d18a", rise: -0.5, wob: 0.7, blend: "source-over", licks: 5, branch: true },
    Ice:       { a: "#7fb6d9", b: "#e6f6ff", rise: -0.2, wob: 0.6, blend: "lighter", licks: 4, shard: true },
    Lava:      { a: "#d64518", b: "#ffb347", rise: -0.8, wob: 1.2, blend: "lighter", licks: 6 },
    Shadow:    { a: "#221d2e", b: "#6b5b8f", rise: 0.2, wob: 1.0, blend: "source-over", licks: 5 },
    Healing:   { a: "#4fbf87", b: "#d8ffe9", rise: -1.2, wob: 0.8, blend: "lighter", licks: 5, motes: true },
    Beast:     { a: "#e2560f", b: "#ffd166", rise: -1.4, wob: 2.0, blend: "lighter", licks: 9, bubble: true }
  };
  const NATURE_ALIAS = { "Tailed Beast": "Beast", tailed: "Beast", beast: "Beast", heal: "Healing" };

  /* ---------------------------------------------------------------
     WEAPONS — one reusable painter per silhouette, pinned to the hand
     or back anchor for the current frame.
     --------------------------------------------------------------- */
  const WEAPONS = {
    kunai:  { len: 0.26, kind: "blade", metal: "#b8bec9", grip: "#2a2118", guard: true },
    shuriken:{len: 0.14, kind: "star",  metal: "#aeb5c0", grip: null },
    katana: { len: 0.62, kind: "blade", metal: "#d3d9e2", grip: "#1d2733", guard: true, curve: 0.08 },
    tanto:  { len: 0.34, kind: "blade", metal: "#c7ced8", grip: "#232b1c", guard: true },
    naginata:{len: 0.86, kind: "pole",  metal: "#cfd6e0", grip: "#3a2a1c" },
    scythe: { len: 0.78, kind: "pole",  metal: "#c2c9d4", grip: "#2b2118", hook: true },
    bow:    { len: 0.52, kind: "bow",   metal: "#8a6a3c", grip: "#5a4326" },
    warfan: { len: 0.44, kind: "fan",   metal: "#e6dfcc", grip: "#7a2f26" },
    scroll: { len: 0.24, kind: "scroll",metal: "#e8dcbb", grip: "#8a3a2e" },
    chain:  { len: 0.50, kind: "chain", metal: "#9aa3b0", grip: null }
  };
  /* Game weapon ids (w_katana etc.) → painter key. */
  function weaponKey(id) {
    if (!id) return null;
    const s = String(id).replace(/^w_/, "").toLowerCase();
    if (WEAPONS[s]) return s;
    if (s.includes("katana") || s.includes("sword") || s.includes("blade")) return "katana";
    if (s.includes("kunai") || s.includes("dagger")) return "kunai";
    if (s.includes("shuriken") || s.includes("star")) return "shuriken";
    if (s.includes("tanto") || s.includes("knife")) return "tanto";
    if (s.includes("naginata") || s.includes("spear") || s.includes("staff")) return "naginata";
    if (s.includes("scythe")) return "scythe";
    if (s.includes("bow")) return "bow";
    if (s.includes("fan")) return "warfan";
    if (s.includes("scroll")) return "scroll";
    if (s.includes("chain") || s.includes("whip")) return "chain";
    return "kunai";
  }

  /* =================================================================
     SMALL DRAWING HELPERS
     ================================================================= */
  function rgba(hex, a) {
    const h = String(hex || "#fff").replace("#", "");
    const f = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
    const n = parseInt(f, 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  }
  function ell(ctx, x, y, rx, ry, fill, a) {
    ctx.save(); if (a != null) ctx.globalAlpha = a;
    ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.4, rx), Math.max(0.4, ry), 0, 0, TAU);
    ctx.fill(); ctx.restore();
  }
  function line(ctx, x1, y1, x2, y2, w, col, a) {
    ctx.save(); if (a != null) ctx.globalAlpha = a;
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.6, w); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
  }
  /* Deterministic per-frame jitter so effects shimmer without storing state. */
  function noise(i, t) { return Math.sin(i * 12.9898 + t * 0.004) * 43758.5453 % 1; }

  /* =================================================================
     PROCEDURAL LAYER PAINTERS
     Every painter receives:
       ctx  — destination 2d context
       P    — { A: anchors in device px, s: cell scale, dw, dh, dx, dy,
                t: timestamp, d: descriptor, state, frame }
     ================================================================= */
  const PAINT = {

    /* ---- 1. CLAN — crest, robe accent, clan-specific effects ---- */
    clan(ctx, P) {
      const c = P.clanDef; if (!c || !P.d.clan || P.d.clan === "civilian") return;
      const A = P.A, s = P.s;
      const hr = A.headR;

      // Shoulder / back crest.
      if (c.crest && hr > 3.2) {
        const cx = A.shoulderL.x, cy = A.shoulderL.y + hr * 0.34;
        const r = Math.max(1.6, hr * 0.42);
        ctx.save();
        if (c.crest === "fan") {
          // Uchiha uchiwa: white upper half, red lower, short handle.
          ctx.fillStyle = c.crestAlt;
          ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, TAU); ctx.fill();
          ctx.fillStyle = c.crestColor;
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI); ctx.fill();
          line(ctx, cx, cy + r * 0.8, cx, cy + r * 1.7, r * 0.3, c.crestColor);
        } else if (c.crest === "spiral") {
          ctx.strokeStyle = c.crestColor; ctx.lineWidth = Math.max(0.7, r * 0.34);
          ctx.beginPath();
          for (let i = 0; i <= 26; i++) {
            const a = i / 26 * TAU * 1.6, rr = r * (i / 26);
            const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
            i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
          }
          ctx.stroke();
        } else if (c.crest === "flame") {
          ctx.fillStyle = c.crestColor;
          ctx.beginPath(); ctx.moveTo(cx, cy - r);
          ctx.quadraticCurveTo(cx + r, cy, cx, cy + r);
          ctx.quadraticCurveTo(cx - r, cy, cx, cy - r); ctx.fill();
        } else if (c.crest === "leaf") {
          ctx.fillStyle = c.crestColor;
          ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.6, r, -0.5, 0, TAU); ctx.fill();
          line(ctx, cx - r * 0.4, cy + r * 0.6, cx + r * 0.4, cy - r * 0.6, r * 0.16, c.crestAlt, 0.7);
        } else if (c.crest === "deer") {
          // stylised antler pair
          [-1, 1].forEach(sd => {
            line(ctx, cx, cy + r * 0.6, cx + sd * r * 0.5, cy - r * 0.7, r * 0.2, c.crestAlt);
            line(ctx, cx + sd * r * 0.28, cy - r * 0.1, cx + sd * r * 0.85, cy - r * 0.25, r * 0.16, c.crestAlt);
          });
        }
        ctx.restore();
      }

      // Uzumaki chakra chains — only while channelling.
      if (c.chains && (P.state === "jutsu" || P.d.auraOn)) {
        const t = P.t;
        for (let i = 0; i < 3; i++) {
          const ph = t * 0.003 + i * 2.1;
          const x0 = A.torso.x, y0 = A.torso.y;
          ctx.save(); ctx.globalCompositeOperation = "lighter";
          for (let k = 1; k <= 6; k++) {
            const rr = hr * (0.5 + k * 0.42);
            const px = x0 + Math.cos(ph + k * 0.7) * rr;
            const py = y0 + Math.sin(ph + k * 0.7) * rr * 0.6;
            ell(ctx, px, py, Math.max(0.7, s * 0.014), Math.max(0.7, s * 0.014), "#ffd98a", 0.5 - k * 0.06);
          }
          ctx.restore();
        }
      }

      // Nara shadow tendrils reaching from the feet.
      if (c.shadow) {
        const gx = A.ground.x, gy = A.ground.y;
        ctx.save(); ctx.globalAlpha = 0.5;
        for (let i = 0; i < 3; i++) {
          const dir = (i - 1) * 0.7 + Math.sin(P.t * 0.001 + i) * 0.2;
          const len = P.dw * (0.16 + i * 0.05);
          line(ctx, gx, gy, gx + Math.cos(dir) * len, gy + Math.abs(Math.sin(dir)) * len * 0.2, s * 0.02, "#14121c");
        }
        ctx.restore();
      }

      // Senju wood accents on the forearms.
      if (c.wood) {
        [A.handL, A.handR].forEach(h => {
          line(ctx, h.x, h.y, h.x, h.y - hr * 0.5, s * 0.018, "#5d7f3f", 0.75);
          ell(ctx, h.x + hr * 0.12, h.y - hr * 0.42, s * 0.012, s * 0.02, "#8fbf6a", 0.8);
        });
      }
    },

    /* ---- 2. HAIR — recolour + clan volume over the baked crown ---- */
    hair(ctx, P) {
      const col = P.d.hairColor || (P.clanDef && P.clanDef.hair);
      if (!col) return;
      const A = P.A, hr = A.headR;
      if (hr < 2.5 || A.prone) return;
      // "color" keeps the atlas's baked shading luminance and swaps only
      // hue/saturation — a real recolour rather than a dark blob on top.
      ctx.save();
      ctx.globalCompositeOperation = "color";
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(A.head.x, A.head.y - hr * 0.52, hr * 0.98, hr * 0.78, 0, 0, TAU);
      ctx.fill();
      ctx.restore();

      // Long hair: two narrow strands falling past the jaw, recoloured the
      // same way rather than painted as opaque shapes — an opaque fill here
      // reads as black wings over the face.
      if (P.d.hairLong && hr >= 5) {
        const drop = Math.min(A.chest.y - A.head.y, hr * 1.5);
        ctx.save();
        ctx.globalCompositeOperation = "color";
        ctx.globalAlpha = 0.8; ctx.fillStyle = col;
        [-1, 1].forEach(sd => {
          ctx.beginPath();
          ctx.ellipse(A.head.x + sd * hr * 0.74, A.head.y + drop * 0.34,
                      hr * 0.24, drop * 0.55, sd * 0.10, 0, TAU);
          ctx.fill();
        });
        ctx.restore();
      }
    },

    /* ---- 3. EYES — base eye colour only; dojutsu is its own layer ---- */
    eyes(ctx, P) {
      if (P.A.prone || P.A.blink) return;
      const key = P.d.eyes && P.d.eyes !== "normal" ? null : P.d.eyeColor;
      if (!key) return;
      const A = P.A, hr = A.headR; if (hr < 3) return;
      [A.eyeL, A.eyeR].forEach(e => {
        ell(ctx, e.x, e.y, hr * 0.10, hr * 0.13, key, 0.95);
      });
    },

    /* ---- 4. HEADBAND — forehead protector, plate + cloth ---- */
    headband(ctx, P) {
      const hb = P.d.headband; if (!hb) return;
      const A = P.A, hr = A.headR, s = P.s;
      if (hr < 3 || A.prone) return;
      const y = A.brow.y, x = A.head.x;
      const w = hr * 1.7, h = Math.max(1.2, hr * 0.22);
      const cloth = hb.cloth || "#1b2230";
      const metal = hb.metal || "#c3cad6";
      // cloth band
      ctx.save(); ctx.fillStyle = cloth;
      ctx.fillRect(x - w / 2, y - h / 2, w, h); ctx.restore();
      // metal plate with a lit top edge
      const pw = w * 0.46, ph = h * 1.15;
      const grd = ctx.createLinearGradient(0, y - ph / 2, 0, y + ph / 2);
      grd.addColorStop(0, "#eef2f8"); grd.addColorStop(0.45, metal); grd.addColorStop(1, "#79828f");
      ctx.save(); ctx.fillStyle = grd;
      ctx.fillRect(x - pw / 2, y - ph / 2, pw, ph);
      // engraved village mark
      ctx.strokeStyle = "rgba(30,36,46,.85)"; ctx.lineWidth = Math.max(0.5, s * 0.006);
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.8, ph * 0.26), 0.6, 4.4);
      ctx.stroke();
      ctx.restore();
      // trailing tails behind the head
      const dir = -1;
      line(ctx, x + dir * w * 0.5, y, x + dir * w * 0.72, y + hr * 1.15, Math.max(0.8, s * 0.012), cloth, 0.95);
      line(ctx, x + dir * w * 0.44, y, x + dir * w * 0.60, y + hr * 1.35, Math.max(0.7, s * 0.010), cloth, 0.8);
    },

    /* ---- 5. OUTFIT — clan robe tint + collar/sash detail ---- */
    outfit(ctx, P) {
      const col = P.d.outfitColor || (P.clanDef && P.clanDef.robe);
      if (!col) return;
      const A = P.A, hr = A.headR, s = P.s;
      const top = A.chest.y - hr * 0.42, bot = A.hip.y;
      const w = A.torsoW * 1.02;
      // Recolour the torso the same way as hair: keep the atlas shading,
      // change only the hue. Never paint an opaque slab over the body.
      ctx.save();
      ctx.globalCompositeOperation = "color";
      ctx.globalAlpha = 0.75; ctx.fillStyle = col;
      ctx.fillRect(A.torso.x - w / 2, top, w, Math.max(1, bot - top));
      ctx.restore();
      // trim down the front opening
      const trim = P.d.trimColor || (P.clanDef && P.clanDef.trim);
      if (trim) {
        line(ctx, A.torso.x, top, A.torso.x, bot, Math.max(0.6, s * 0.008), trim, 0.6);
        // sash at the waist
        ctx.save(); ctx.globalAlpha = 0.7; ctx.fillStyle = trim;
        ctx.fillRect(A.hip.x - w / 2, A.hip.y - hr * 0.10, w, Math.max(1, hr * 0.14));
        ctx.restore();
      }
      // Hyuga open robe: pale lapels framing the chest
      if (P.clanDef && P.clanDef.armor === "robe") {
        ctx.save(); ctx.globalAlpha = 0.45; ctx.fillStyle = "#f3efe2";
        [-1, 1].forEach(sd => {
          ctx.beginPath();
          ctx.moveTo(A.torso.x + sd * w * 0.14, top);
          ctx.lineTo(A.torso.x + sd * w * 0.44, top);
          ctx.lineTo(A.torso.x + sd * w * 0.30, bot);
          ctx.lineTo(A.torso.x + sd * w * 0.10, bot);
          ctx.closePath(); ctx.fill();
        });
        ctx.restore();
      }
    },

    /* ---- 6. ARMOR — chest guard, pauldrons, greaves ---- */
    armor(ctx, P) {
      const kind = P.d.armor; if (!kind || kind === "none") return;
      const A = P.A, hr = A.headR, s = P.s;
      const pal = ({
        dark:  { plate: "#2f353f", edge: "#59616d" },
        light: { plate: "#6d6250", edge: "#a99a7d" },
        leaf:  { plate: "#4a5a3c", edge: "#8fa06a" },
        flak:  { plate: "#3d5a3a", edge: "#7d8f5e" },
        robe:  null
      })[kind] || { plate: "#3a4250", edge: "#6d7686" };
      if (!pal) return;
      // A vest sitting on the chest — deliberately shorter and narrower
      // than the torso so the base art still reads around it.
      const w = A.torsoW * 0.94, top = A.chest.y - hr * 0.30, h = (A.hip.y - top) * 0.72;
      ctx.save();
      ctx.fillStyle = pal.plate; ctx.globalAlpha = 0.72;
      ctx.fillRect(A.torso.x - w / 2, top, w, Math.max(1, h));
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = pal.edge; ctx.lineWidth = Math.max(0.4, s * 0.005);
      ctx.strokeRect(A.torso.x - w / 2, top, w, Math.max(1, h));
      // horizontal plate seams
      for (let i = 1; i < 3; i++) {
        const y = top + h * (i / 3);
        line(ctx, A.torso.x - w / 2, y, A.torso.x + w / 2, y, s * 0.004, pal.edge, 0.45);
      }
      ctx.restore();
      // pauldrons on both shoulders
      [A.shoulderL, A.shoulderR].forEach(sh => {
        ell(ctx, sh.x, sh.y, hr * 0.30, hr * 0.20, pal.plate, 0.8);
        ell(ctx, sh.x, sh.y - hr * 0.04, hr * 0.22, hr * 0.10, pal.edge, 0.45);
      });
    },

    /* ---- 7. WEAPON — pinned to hand or back for this frame ---- */
    weapon(ctx, P) {
      const key = weaponKey(P.d.weapon); if (!key) return;
      const W = WEAPONS[key]; if (!W) return;
      const A = P.A, s = P.s;
      const mode = A.weaponMode;               // set by the pose, not the caller
      // Scaled off the body, not the cell, so a katana reads as a katana at
      // every life stage instead of overrunning the frame.
      const L = W.len * A.headR * 3.1;
      const thick = Math.max(0.9, s * 0.014);

      if (mode === "back" || !mode) {
        // Sheathed diagonally across the back.
        const x1 = A.shoulderR.x - A.torsoW * 0.2, y1 = A.hip.y;
        const x2 = A.shoulderL.x + A.torsoW * 0.2, y2 = A.chest.y - A.headR * 0.5;
        line(ctx, x1, y1, x2, y2, thick * 1.5, "#232a33", 0.95);
        line(ctx, x2, y2, x2 + (x2 - x1) * 0.22, y2 + (y2 - y1) * 0.22, thick * 1.7, W.grip || "#2a2118");
        return;
      }

      // In hand: draw along the forearm direction.
      const h = A.handL;
      const ang = Math.atan2(h.y - A.shoulderL.y, h.x - A.shoulderL.x);
      const tx = h.x + Math.cos(ang) * L, ty = h.y + Math.sin(ang) * L;

      if (W.kind === "blade") {
        // grip
        line(ctx, h.x - Math.cos(ang) * L * 0.16, h.y - Math.sin(ang) * L * 0.16, h.x, h.y, thick * 1.6, W.grip);
        // guard
        if (W.guard) {
          const px = -Math.sin(ang), py = Math.cos(ang);
          line(ctx, h.x + px * thick * 1.8, h.y + py * thick * 1.8,
                    h.x - px * thick * 1.8, h.y - py * thick * 1.8, thick * 0.9, "#8a7340");
        }
        // blade with a lit edge
        line(ctx, h.x, h.y, tx, ty, thick * 1.15, W.metal);
        const ox = -Math.sin(ang) * thick * 0.4, oy = Math.cos(ang) * thick * 0.4;
        line(ctx, h.x + ox, h.y + oy, tx + ox, ty + oy, thick * 0.34, "#ffffff", 0.75);
      } else if (W.kind === "star") {
        ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(P.t * 0.02);
        ctx.fillStyle = W.metal;
        for (let i = 0; i < 4; i++) {
          ctx.rotate(TAU / 4);
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L * 0.5, -L * 0.16); ctx.lineTo(L * 0.5, L * 0.16);
          ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      } else if (W.kind === "pole") {
        line(ctx, h.x - Math.cos(ang) * L * 0.4, h.y - Math.sin(ang) * L * 0.4, tx, ty, thick * 1.1, W.grip);
        line(ctx, h.x + Math.cos(ang) * L * 0.62, h.y + Math.sin(ang) * L * 0.62, tx, ty, thick * 1.3, W.metal);
      } else if (W.kind === "bow") {
        ctx.save(); ctx.strokeStyle = W.metal; ctx.lineWidth = thick;
        ctx.beginPath(); ctx.arc(h.x, h.y, L * 0.5, ang - 1.2, ang + 1.2); ctx.stroke();
        ctx.strokeStyle = "rgba(240,240,240,.7)"; ctx.lineWidth = thick * 0.4;
        ctx.beginPath();
        ctx.moveTo(h.x + Math.cos(ang - 1.2) * L * 0.5, h.y + Math.sin(ang - 1.2) * L * 0.5);
        ctx.lineTo(h.x + Math.cos(ang + 1.2) * L * 0.5, h.y + Math.sin(ang + 1.2) * L * 0.5);
        ctx.stroke(); ctx.restore();
      } else if (W.kind === "fan") {
        ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(ang);
        ctx.fillStyle = W.metal; ctx.globalAlpha = 0.95;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, L * 0.7, -0.7, 0.7); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = W.grip; ctx.lineWidth = thick * 0.5;
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath(); ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(i * 0.32) * L * 0.7, Math.sin(i * 0.32) * L * 0.7); ctx.stroke();
        }
        ctx.restore();
      } else if (W.kind === "scroll") {
        ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(ang);
        ctx.fillStyle = W.metal; ctx.fillRect(-L * 0.1, -L * 0.28, L * 0.2, L * 0.56);
        ctx.fillStyle = W.grip;
        ctx.fillRect(-L * 0.14, -L * 0.32, L * 0.28, L * 0.09);
        ctx.fillRect(-L * 0.14, L * 0.23, L * 0.28, L * 0.09);
        ctx.restore();
      } else if (W.kind === "chain") {
        for (let i = 0; i < 8; i++) {
          const f = i / 8, wob = Math.sin(P.t * 0.006 + i * 0.9) * L * 0.10;
          ell(ctx, h.x + Math.cos(ang) * L * f + wob, h.y + Math.sin(ang) * L * f,
              thick * 0.5, thick * 0.5, W.metal, 0.9);
        }
      }
    },

    /* ---- 8. ACCESSORIES — scarf, gloves, belt, pouches, sandals ---- */
    accessory(ctx, P) {
      const acc = P.d.accessories; if (!acc || !acc.length) return;
      const A = P.A, hr = A.headR, s = P.s, t = P.t;
      const has = (k) => acc.indexOf(k) >= 0;

      if (has("scarf")) {
        const col = P.d.scarfColor || "#a33a2c";
        const y = A.chest.y - hr * 0.48;
        ctx.save(); ctx.fillStyle = col; ctx.globalAlpha = 0.95;
        ctx.fillRect(A.torso.x - A.torsoW * 0.50, y - hr * 0.10, A.torsoW * 1.00, Math.max(1, hr * 0.20));
        // tail streaming behind, driven by the frame clock
        const sway = Math.sin(t * 0.004) * hr * 0.35;
        ctx.beginPath();
        ctx.moveTo(A.torso.x - A.torsoW * 0.44, y);
        ctx.quadraticCurveTo(A.torso.x - A.torsoW * 0.90 + sway, y + hr * 0.55,
                             A.torso.x - A.torsoW * 1.05 + sway, y + hr * 1.05);
        ctx.lineTo(A.torso.x - A.torsoW * 0.78 + sway, y + hr * 1.02);
        ctx.quadraticCurveTo(A.torso.x - A.torsoW * 0.66, y + hr * 0.5, A.torso.x - A.torsoW * 0.26, y);
        ctx.closePath(); ctx.fill(); ctx.restore();
      }
      if (has("gloves")) {
        [A.handL, A.handR].forEach(h => ell(ctx, h.x, h.y, s * 0.022, s * 0.022, "#22282f", 0.95));
      }
      if (has("belt")) {
        ctx.save(); ctx.fillStyle = "#3a2c1e";
        ctx.fillRect(A.hip.x - A.torsoW * 0.56, A.hip.y - hr * 0.1, A.torsoW * 1.12, Math.max(1, hr * 0.18));
        ctx.fillStyle = "#c9a227";
        ctx.fillRect(A.hip.x - hr * 0.16, A.hip.y - hr * 0.1, hr * 0.32, Math.max(1, hr * 0.18));
        ctx.restore();
      }
      if (has("pouch")) {
        ell(ctx, A.hip.x + A.torsoW * 0.62, A.hip.y + hr * 0.12, hr * 0.26, hr * 0.30, "#4a3826", 0.95);
        line(ctx, A.hip.x + A.torsoW * 0.62 - hr * 0.2, A.hip.y + hr * 0.02,
                  A.hip.x + A.torsoW * 0.62 + hr * 0.2, A.hip.y + hr * 0.02, s * 0.006, "#2b2016");
      }
      if (has("sandals")) {
        [A.footL, A.footR].forEach(f => {
          ctx.save(); ctx.fillStyle = "#2f2a22";
          ctx.fillRect(f.x - s * 0.030, f.y, s * 0.060, Math.max(1, s * 0.016));
          ctx.restore();
        });
      }
      if (has("cloak")) {
        // Hangs behind the body as a cape silhouette, so the character's
        // front stays visible instead of being boxed in.
        const col = P.d.cloakColor || "#1c222c";
        const sway = Math.sin(t * 0.003) * hr * 0.35;
        ctx.save(); ctx.globalAlpha = 0.80; ctx.fillStyle = col;
        [-1, 1].forEach(sd => {
          ctx.beginPath();
          ctx.moveTo(A.torso.x + sd * A.torsoW * 0.42, A.shoulderL.y - hr * 0.05);
          ctx.quadraticCurveTo(A.torso.x + sd * A.torsoW * 1.05 + sway, A.hip.y + hr * 0.5,
                               A.torso.x + sd * A.torsoW * 0.95 + sway, A.ground.y - hr * 0.15);
          ctx.lineTo(A.torso.x + sd * A.torsoW * 0.34 + sway * 0.5, A.ground.y - hr * 0.15);
          ctx.lineTo(A.torso.x + sd * A.torsoW * 0.30, A.shoulderL.y - hr * 0.05);
          ctx.closePath(); ctx.fill();
        });
        // collar across the shoulders ties the two halves together
        ctx.globalAlpha = 0.9;
        ctx.fillRect(A.torso.x - A.torsoW * 0.55, A.shoulderL.y - hr * 0.20,
                     A.torsoW * 1.10, Math.max(1, hr * 0.22));
        ctx.restore();
      }
    },

    /* ---- 9. INJURIES — bandages, cuts, blood ---- */
    injury(ctx, P) {
      const lvl = P.d.injury || 0; if (!lvl) return;
      const A = P.A, hr = A.headR, s = P.s;
      // bandage across the arm
      line(ctx, A.shoulderL.x, A.shoulderL.y, A.handL.x, A.handL.y, s * 0.020, "#ded6c4", 0.85);
      if (lvl >= 2) {
        // cheek cut
        line(ctx, A.head.x + hr * 0.34, A.head.y + hr * 0.10,
                  A.head.x + hr * 0.54, A.head.y + hr * 0.30, s * 0.007, "#a3302a", 0.9);
        // torso wrap
        ctx.save(); ctx.globalAlpha = 0.8; ctx.fillStyle = "#ded6c4";
        ctx.fillRect(A.torso.x - A.torsoW * 0.6, A.torso.y - hr * 0.1, A.torsoW * 1.2, Math.max(1, hr * 0.26));
        ctx.restore();
      }
      if (lvl >= 3) {
        ctx.save(); ctx.globalAlpha = 0.16; ctx.fillStyle = "#8c1d1d";
        ctx.fillRect(P.dx, P.dy, P.dw, P.dh); ctx.restore();
      }
    },

    /* ---- 10. DOJUTSU — the eye layer, never a new sheet ---- */
    dojutsu(ctx, P) {
      const id = EYE_ALIAS[P.d.eyes] || P.d.eyes;
      const E = EYES[id]; if (!E || id === "normal") return;
      const A = P.A, hr = A.headR;
      if (A.prone || A.blink || hr < 2.6) return;
      const r = Math.max(0.9, hr * 0.15);

      [A.eyeL, A.eyeR].forEach((e, side) => {
        // sclera
        ell(ctx, e.x, e.y, r * 1.25, r * 1.05, E.sclera, 1);
        // iris
        ell(ctx, e.x, e.y, r, r * 0.95, E.iris, 1);
        if (E.ring) { ctx.save(); ctx.strokeStyle = E.ring; ctx.lineWidth = Math.max(0.4, r * 0.22);
          ctx.beginPath(); ctx.arc(e.x, e.y, r * 0.78, 0, TAU); ctx.stroke(); ctx.restore(); }

        if (E.tomoe) {                       // Sharingan — orbiting tomoe
          const spin = P.t * 0.0016;
          for (let i = 0; i < E.tomoe; i++) {
            const a = spin + i * TAU / E.tomoe;
            const px = e.x + Math.cos(a) * r * 0.56, py = e.y + Math.sin(a) * r * 0.52;
            ell(ctx, px, py, r * 0.24, r * 0.24, "#1a0303", 1);
            line(ctx, px, py, px - Math.cos(a + 1.2) * r * 0.3, py - Math.sin(a + 1.2) * r * 0.3, r * 0.16, "#1a0303");
          }
          ell(ctx, e.x, e.y, r * 0.24, r * 0.24, "#1a0303", 1);
        }
        if (E.pattern === "shuriken") {      // Mangekyo — bladed pinwheel
          ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(P.t * 0.0009);
          ctx.fillStyle = "#1a0303";
          for (let i = 0; i < 3; i++) {
            ctx.rotate(TAU / 3);
            ctx.beginPath(); ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(r * 0.9, -r * 0.25, r * 0.95, r * 0.30);
            ctx.closePath(); ctx.fill();
          }
          ctx.restore();
        }
        if (E.pattern === "eternal") {       // EMS — two interlocked patterns
          ctx.save(); ctx.translate(e.x, e.y);
          ctx.fillStyle = "#1a0303";
          for (let k = 0; k < 2; k++) {
            ctx.rotate(0.5);
            for (let i = 0; i < 3; i++) {
              ctx.rotate(TAU / 3);
              ctx.beginPath(); ctx.moveTo(0, 0);
              ctx.lineTo(r * 0.95, -r * 0.20); ctx.lineTo(r * 0.80, r * 0.34);
              ctx.closePath(); ctx.fill();
            }
          }
          ctx.restore();
        }
        if (E.rings) {                       // Rinnegan — concentric ripples
          ctx.save(); ctx.strokeStyle = E.ring; ctx.lineWidth = Math.max(0.35, r * 0.16);
          for (let i = 1; i <= E.rings; i++) {
            ctx.globalAlpha = 0.85 - i * 0.12;
            ctx.beginPath(); ctx.arc(e.x, e.y, r * (i / E.rings) * 0.95, 0, TAU); ctx.stroke();
          }
          ctx.restore();
          ell(ctx, e.x, e.y, r * 0.18, r * 0.18, "#2b1b47", 1);
        }
        if (E.veins) {                       // Byakugan — bulging temple veins
          ctx.save(); ctx.globalAlpha = 0.55; ctx.strokeStyle = "#9fb0c8";
          ctx.lineWidth = Math.max(0.35, r * 0.16);
          const dir = side === 0 ? -1 : 1;
          [[-0.5, -0.9], [0.1, -1.15], [-0.9, -0.3]].forEach(v => {
            ctx.beginPath();
            ctx.moveTo(e.x + dir * r * 1.2, e.y);
            ctx.lineTo(e.x + dir * r * (1.2 + Math.abs(v[0])), e.y + r * v[1]);
            ctx.stroke();
          });
          ctx.restore();
        }
        if (E.glow) {
          ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.35;
          ell(ctx, e.x, e.y, r * 2.4, r * 2.0, E.glow); ctx.restore();
        }
      });
    },

    /* ---- 11. CHAKRA AURA — procedural, per nature ---- */
    aura(ctx, P) {
      if (!P.d.auraOn) return;
      const key = NATURE_ALIAS[P.d.nature] || P.d.nature;
      const N = NATURES[key]; if (!N) return;
      const A = P.A, t = P.t, s = P.s;
      const cx = A.centre.x, cy = A.centre.y;
      const rx = A.torsoW * 0.95, ry = P.dh * 0.17;
      const power = (P.d.auraPower == null ? 1 : P.d.auraPower) * 0.55;

      ctx.save();
      ctx.globalCompositeOperation = N.blend;

      // Rim glow hugging the silhouette — bright at the edge, hollow in
      // the middle, so the character art is never washed out.
      const g1 = ctx.createRadialGradient(cx, cy, Math.max(rx, ry) * 0.35, cx, cy, Math.max(rx, ry) * 1.25);
      g1.addColorStop(0, rgba(N.a, 0));
      g1.addColorStop(0.55, rgba(N.a, 0.16 * power));
      g1.addColorStop(0.8, rgba(N.b, 0.13 * power));
      g1.addColorStop(1, rgba(N.a, 0));
      ctx.fillStyle = g1;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx * 1.35, ry * 1.30, 0, 0, TAU); ctx.fill();

      // Thin tongues of chakra licking up the edges of the body.
      for (let i = 0; i < N.licks; i++) {
        const ph = t * 0.004 + i * 1.7;
        const sway = Math.sin(ph * N.wob) * rx * 0.20;
        const side = i % 2 ? 1 : -1;
        const bx = cx + side * rx * (0.75 + (i / N.licks) * 0.30) + sway * 0.4;
        const by = cy + ry * (0.55 - (i / N.licks) * 0.9);
        const hgt = ry * (0.30 + ((Math.sin(ph * 1.3) + 1) / 2) * 0.34) * power;
        const wdt = Math.max(0.8, rx * 0.09);
        ctx.globalAlpha = 0.30 * power;
        ctx.fillStyle = i % 2 ? N.b : N.a;
        ctx.beginPath();
        ctx.moveTo(bx - wdt, by);
        ctx.quadraticCurveTo(bx + sway * 0.6, by - hgt * 0.55, bx + sway, by - hgt);
        ctx.quadraticCurveTo(bx + sway * 0.6 + wdt, by - hgt * 0.45, bx + wdt, by);
        ctx.closePath(); ctx.fill();
      }

      // Nature-specific signatures.
      if (N.bolt) {                       // Lightning — forked arcs
        ctx.globalAlpha = 0.55 * power;
        for (let i = 0; i < 3; i++) {
          const a0 = t * 0.01 + i * 2.2;
          let px = cx + Math.cos(a0) * rx * 0.8, py = cy + Math.sin(a0) * ry * 0.8;
          ctx.strokeStyle = N.b; ctx.lineWidth = Math.max(0.5, s * 0.008);
          ctx.beginPath(); ctx.moveTo(px, py);
          for (let k = 0; k < 4; k++) {
            px += (noise(i * 7 + k, t) - 0.5) * rx * 0.5;
            py -= ry * 0.28;
            ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
      }
      if (N.ring) {                       // Wind — orbiting pressure ring
        ctx.globalAlpha = 0.26 * power; ctx.strokeStyle = N.b;
        ctx.lineWidth = Math.max(0.5, s * 0.007);
        ctx.beginPath();
        ctx.ellipse(cx, cy + ry * 0.4, rx * 1.5, ry * 0.32, Math.sin(t * 0.002) * 0.25, 0, TAU);
        ctx.stroke();
      }
      if (N.shard) {                      // Earth / Ice — floating fragments
        for (let i = 0; i < 5; i++) {
          const a = t * 0.001 + i * 1.3;
          const px = cx + Math.cos(a) * rx * 1.1, py = cy + Math.sin(a * 1.4) * ry * 0.8;
          ctx.globalAlpha = 0.55 * power; ctx.fillStyle = i % 2 ? N.a : N.b;
          ctx.save(); ctx.translate(px, py); ctx.rotate(a);
          ctx.fillRect(-s * 0.009, -s * 0.009, s * 0.018, s * 0.018);
          ctx.restore();
        }
      }
      if (N.branch) {                     // Wood — sprouting shoots
        ctx.globalAlpha = 0.55 * power; ctx.strokeStyle = N.a;
        ctx.lineWidth = Math.max(0.5, s * 0.008);
        for (let i = 0; i < 3; i++) {
          const bx = cx + (i - 1) * rx * 0.9;
          ctx.beginPath(); ctx.moveTo(bx, A.ground.y);
          ctx.quadraticCurveTo(bx + rx * 0.2, cy, bx + rx * 0.05, cy - ry * 0.5);
          ctx.stroke();
          ell(ctx, bx + rx * 0.05, cy - ry * 0.5, s * 0.014, s * 0.020, N.b, 0.8);
        }
      }
      if (N.motes) {                      // Healing — rising sparks
        for (let i = 0; i < 8; i++) {
          const ph = (t * 0.0006 + i / 8) % 1;
          const px = cx + Math.sin(i * 2.3 + t * 0.001) * rx * 0.9;
          const py = cy + ry * 0.9 - ph * ry * 2.2;
          ctx.globalAlpha = (1 - ph) * 0.8;
          ell(ctx, px, py, s * 0.008, s * 0.008, N.b);
        }
      }
      if (N.bubble) {                     // Tailed Beast — boiling chakra
        for (let i = 0; i < 6; i++) {
          const ph = (t * 0.0009 + i / 6) % 1;
          const px = cx + Math.sin(i * 1.9 + t * 0.002) * rx * 1.2;
          const py = cy + ry * 0.8 - ph * ry * 1.8;
          ctx.globalAlpha = (1 - ph) * 0.55;
          ell(ctx, px, py, s * 0.016 * (1 - ph * 0.4), s * 0.016 * (1 - ph * 0.4), N.b);
        }
      }
      ctx.restore();
    },

    /* ---- 12. TRANSFORMATION — sage marks, mode overlays ---- */
    transformation(ctx, P) {
      const tf = P.d.transformation; if (!tf || tf === "none") return;
      const A = P.A, hr = A.headR, t = P.t;
      if (tf === "sage") {
        // pigment around the eyes
        [A.eyeL, A.eyeR].forEach((e, i) => {
          ctx.save(); ctx.globalAlpha = 0.8; ctx.fillStyle = "#c2452f";
          ctx.beginPath();
          ctx.moveTo(e.x + (i ? 1 : -1) * hr * 0.30, e.y - hr * 0.12);
          ctx.lineTo(e.x + (i ? 1 : -1) * hr * 0.62, e.y - hr * 0.02);
          ctx.lineTo(e.x + (i ? 1 : -1) * hr * 0.30, e.y + hr * 0.14);
          ctx.closePath(); ctx.fill(); ctx.restore();
        });
      } else if (tf === "curse") {
        // creeping seal marks across half the body
        ctx.save(); ctx.globalAlpha = 0.75; ctx.fillStyle = "#3b2d5a";
        for (let i = 0; i < 12; i++) {
          const px = A.torso.x - A.torsoW * 0.5 + noise(i, 0) * A.torsoW;
          const py = A.chest.y + (i / 12) * (A.hip.y - A.chest.y);
          ctx.beginPath(); ctx.arc(px, py, Math.max(0.6, hr * 0.10), 0, TAU); ctx.fill();
        }
        ctx.restore();
      } else if (tf === "chakra-mode") {
        ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.30 + Math.sin(t * 0.006) * 0.06;
        const gd = ctx.createLinearGradient(0, A.head.y - hr, 0, A.ground.y);
        gd.addColorStop(0, rgba(P.d.auraColor || "#ffd166", 0.55));
        gd.addColorStop(1, rgba(P.d.auraColor || "#ffb020", 0.1));
        ctx.fillStyle = gd;
        ctx.beginPath();
        ctx.ellipse(A.torso.x, A.torso.y, A.torsoW * 1.5, (A.ground.y - A.head.y) * 0.62, 0, 0, TAU);
        ctx.fill(); ctx.restore();
      }
    },

    /* ---- 13. SUMMON COMPANION — small partner beside the character ---- */
    summon(ctx, P) {
      const sm = P.d.summon; if (!sm || sm === "none") return;
      const A = P.A, s = P.s, t = P.t;
      const bob = Math.sin(t * 0.004) * s * 0.012;
      const x = A.ground.x - A.torsoW * 2.0, y = A.ground.y + bob;
      const size = s * 0.075;
      const pal = ({
        toad:   ["#4f7d43", "#8fbf6a", "#2c4a26"],
        snake:  ["#7a5f9e", "#c3a8e0", "#3d2c56"],
        slug:   ["#c9d5e2", "#f0f6ff", "#8a97a8"],
        hawk:   ["#7a5a3a", "#c9a86a", "#3d2c1c"],
        wolf:   ["#5a5f6b", "#9aa3b0", "#2e323b"],
        hound:  ["#8a7355", "#d0bb96", "#4a3d2c"]
      })[sm] || ["#6b6f7a", "#a8adb8", "#35383f"];

      ctx.save();
      // shadow
      ell(ctx, x, A.ground.y + s * 0.006, size * 0.9, size * 0.22, "#000", 0.28);
      // body + head
      ell(ctx, x, y - size * 0.45, size * 0.85, size * 0.62, pal[0], 1);
      ell(ctx, x - size * 0.55, y - size * 0.85, size * 0.5, size * 0.45, pal[0], 1);
      // belly highlight
      ell(ctx, x, y - size * 0.30, size * 0.55, size * 0.34, pal[1], 0.75);
      // eye
      ell(ctx, x - size * 0.68, y - size * 0.95, size * 0.13, size * 0.13, "#f5f2e8", 1);
      ell(ctx, x - size * 0.70, y - size * 0.95, size * 0.07, size * 0.07, pal[2], 1);
      // legs / tail depending on species
      if (sm === "snake") {
        ctx.strokeStyle = pal[0]; ctx.lineWidth = size * 0.28; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(x + size * 0.5, y - size * 0.2);
        ctx.quadraticCurveTo(x + size * 1.4, y - size * 0.6, x + size * 1.1, y + size * 0.1);
        ctx.stroke();
      } else if (sm === "hawk") {
        ctx.fillStyle = pal[2];
        ctx.beginPath(); ctx.moveTo(x, y - size * 0.7);
        ctx.lineTo(x + size * 1.3, y - size * 1.2 + bob * 2);
        ctx.lineTo(x + size * 0.2, y - size * 0.2); ctx.closePath(); ctx.fill();
      } else {
        [0.35, -0.35].forEach(o => line(ctx, x + size * o, y, x + size * o, y + size * 0.35, size * 0.22, pal[2]));
        line(ctx, x + size * 0.8, y - size * 0.5, x + size * 1.3, y - size * 0.9, size * 0.16, pal[0]);
      }
      ctx.restore();
    },

    /* ---- 14. JINCHURIKI AURA — cloak shroud, tails, eye burn ---- */
    jinchuriki(ctx, P) {
      const j = P.d.jinchuriki; if (!j || !j.stage) return;
      const A = P.A, t = P.t, s = P.s;
      const col = j.color || "#e2560f";
      const tails = Math.max(0, Math.min(9, j.tails || 0));
      const inten = Math.min(1, 0.22 + tails * 0.055);

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      // Boiling shroud, hollow through the middle so the host stays visible
      // even at nine tails.
      const cx = A.torso.x, cy = A.torso.y;
      const rx = A.torsoW * 1.25, ry = (A.ground.y - A.head.y) * 0.46;
      const g = ctx.createRadialGradient(cx, cy, Math.max(rx, ry) * 0.4, cx, cy, ry * 1.15);
      g.addColorStop(0, rgba(col, 0));
      g.addColorStop(0.6, rgba(col, 0.20 * inten));
      g.addColorStop(0.88, rgba(col, 0.16 * inten));
      g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
      const pulse = 1 + Math.sin(t * 0.007) * 0.05;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx * pulse, ry * pulse, 0, 0, TAU); ctx.fill();

      // ragged edge flames
      ctx.globalAlpha = 0.34 * inten; ctx.fillStyle = col;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU + t * 0.0012;
        const rr = 1 + Math.sin(t * 0.006 + i) * 0.16;
        const px = cx + Math.cos(a) * rx * rr, py = cy + Math.sin(a) * ry * rr;
        ell(ctx, px, py, s * 0.012, s * 0.018, col);
      }

      // tails sweeping behind
      ctx.globalAlpha = 0.42 * inten; ctx.strokeStyle = col;
      ctx.lineWidth = Math.max(0.8, s * 0.014); ctx.lineCap = "round";
      for (let i = 0; i < tails; i++) {
        const spread = (i - (tails - 1) / 2) * 0.30;
        const wag = Math.sin(t * 0.005 + i * 0.8) * 0.22;
        const a = Math.PI * 0.5 + spread + wag;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.quadraticCurveTo(cx + Math.cos(a) * rx * 1.4, cy - ry * 0.4,
                             cx + Math.cos(a) * rx * 2.2, cy + Math.sin(a) * ry * 0.7);
        ctx.stroke();
      }
      ctx.restore();

      // burning eyes at higher tail counts
      if (tails >= 1 && !A.blink && !A.prone) {
        [A.eyeL, A.eyeR].forEach(e => {
          ctx.save(); ctx.globalCompositeOperation = "lighter";
          ell(ctx, e.x, e.y, A.headR * 0.20, A.headR * 0.17, "#ffdd66", 0.95);
          ctx.restore();
        });
      }
    }
  };

  /* =================================================================
     OVERLAY ATLAS SUPPORT
     If art exists for a layer at the same cell grid as the base sheet,
     it is blitted instead of running the procedural painter. Authored
     art therefore drops in with no code change.
     ================================================================= */
  function overlaySheet(layer, key, stageFolder) {
    const A = SLS.Assets; if (!A || !A.overlays) return null;
    const group = A.overlays[layer]; if (!group) return null;
    const entry = group[key]; if (!entry) return null;
    const url = typeof entry === "string" ? entry
      : (entry.byStage && entry.byStage[stageFolder]) || entry.sheet;
    if (!url) return null;
    const img = A.load(url);
    return (img && img.__ready && !img.__failed) ? img : null;
  }

  /* =================================================================
     PUBLIC API
     ================================================================= */
  const Layers = {
    ORDER, CLANS, EYES, NATURES, WEAPONS,
    clanDef(id) { return CLANS[id] || CLAN_COMMON; },

    /* Anchors for this stage/state/frame, in device pixels inside the
       destination rect. Falls back to live computation when the baked
       anchor table has not loaded yet. */
    anchorsFor(stage, state, frame, rect) {
      const A = SLS.Assets;
      let a = null;
      const table = A && A.anchorTable;
      if (table && table[stage] && table[stage][state]) {
        const arr = table[stage][state];
        a = arr[Math.min(frame, arr.length - 1)];
      }
      if (!a && SLS.PX && SLS.PX.anchors) {
        a = SLS.PX.anchors({ stage, state, frame });
      }
      if (!a) return null;
      // normalised → device px inside {dx,dy,dw,dh}
      const m = (p) => ({ x: rect.dx + p.x * rect.dw, y: rect.dy + p.y * rect.dh });
      const out = {
        headR: a.headR * rect.dw, torsoW: a.torsoW * rect.dw, limbT: a.limbT * rect.dw,
        prone: a.prone, blink: a.blink, weaponMode: a.weaponMode
      };
      ["head", "brow", "eyeL", "eyeR", "neck", "chest", "torso", "shoulderL", "shoulderR",
       "hip", "handL", "handR", "footL", "footR", "ground", "centre"].forEach(k => {
        if (a[k]) out[k] = m(a[k]);
      });
      return out;
    },

    /* Draw the full stack over an already-blitted base frame. */
    compose(ctx, o) {
      const rect = { dx: o.dx, dy: o.dy, dw: o.dw, dh: o.dh };
      const A = this.anchorsFor(o.stage, o.state, o.frame, rect);
      if (!A) return;
      const d = o.desc || {};
      const P = {
        A, d, s: o.dw, dx: o.dx, dy: o.dy, dw: o.dw, dh: o.dh,
        t: o.time == null ? performance.now() : o.time,
        state: o.state, frame: o.frame,
        clanDef: this.clanDef(d.clan),
        stageFolder: o.stageFolder
      };
      // The death pose rotates the whole figure about its midpoint, which
      // the flat anchor table cannot express. Body-pinned layers are held
      // back there; ambient ones (aura, summon, beast cloak) still play.
      const BODY = ["clan", "hair", "eyes", "headband", "outfit", "armor",
                    "weapon", "accessory", "injury", "dojutsu", "transformation"];

      for (let i = 0; i < ORDER.length; i++) {
        const layer = ORDER[i];
        if (d.hide && d.hide.indexOf(layer) >= 0) continue;
        if (A.prone && BODY.indexOf(layer) >= 0) continue;
        // 1. authored overlay atlas, aligned to the base cell grid
        const key = d[layer + "Art"] || d[layer];
        const img = (typeof key === "string") && overlaySheet(layer, key, o.stageFolder);
        if (img && o.cell) {
          ctx.save(); ctx.imageSmoothingEnabled = false;
          ctx.drawImage(img, o.cell.sx, o.cell.sy, o.cell.sw, o.cell.sh, o.dx, o.dy, o.dw, o.dh);
          ctx.restore();
          continue;
        }
        // 2. procedural painter
        const fn = PAINT[layer];
        if (!fn) continue;
        ctx.save();
        try { fn(ctx, P); } catch (e) { /* one bad layer must never kill the frame */ }
        ctx.restore();
      }
    },

    /* ---------------------------------------------------------------
       Game state → layer descriptor. This is the only place that knows
       how the engine's fields map onto visual layers, so gameplay code
       stays untouched.
       --------------------------------------------------------------- */
    describe(g) {
      if (!g) return {};
      const C = SLS.C || {};
      const clanId = (g.char && g.char.clan) || "civilian";
      const cd = this.clanDef(clanId);
      const dj = g.dojutsu || {};
      const j = g.jinchuriki || null;
      const nat = (g.char && g.char.natures && g.char.natures[0]) || null;
      const graduated = !!(g.academy && g.academy.graduated);

      // Dojutsu stage id → eye layer id.
      let eyes = "normal";
      if (dj.active && dj.type && dj.stage && dj.stage !== "none") {
        const st = String(dj.stage).toLowerCase();
        if (dj.type === "byakugan") eyes = "byakugan";
        else if (dj.type === "rinnegan") eyes = "rinnegan";
        else if (st.indexOf("eternal") >= 0 || st === "ems") eyes = "eternal";
        else if (st.indexOf("mangekyo") >= 0) eyes = "mangekyo";
        else eyes = "sharingan";
      }

      const acc = [];
      if (graduated) acc.push("sandals");
      if (g.equipped && g.equipped.armor) acc.push("belt", "pouch");
      if (clanId === "uzumaki" || clanId === "uchiha") acc.push("scarf");
      if (g.equipped && g.equipped.weapon) acc.push("gloves");
      if (j && j.cloak && j.cloak !== "none") acc.push("cloak");

      const maxHp = (g.char && g.char.maxHealth) || 100;
      const hp = g.health == null ? maxHp : g.health;
      const injury = g.flags && g.flags.dead ? 3
        : hp < maxHp * 0.25 ? 3 : hp < maxHp * 0.5 ? 2 : hp < maxHp * 0.75 ? 1 : 0;

      return {
        clan: clanId,
        hairColor: (g.char && g.char.hairColor) || cd.hair,
        hairLong: clanId === "hyuga" || clanId === "uzumaki",
        eyes,
        eyeColor: (g.char && g.char.eyeColor) || null,
        headband: graduated ? { cloth: "#1b2230", metal: "#c3cad6" } : null,
        outfitColor: cd.robe, trimColor: cd.trim,
        armor: (g.equipped && g.equipped.armor) ? (cd.armor || "flak") : null,
        weapon: (g.equipped && g.equipped.weapon) || null,
        accessories: acc,
        scarfColor: cd.accent,
        cloakColor: j && C.beast ? (C.beast(j.beastId) || {}).color : null,
        injury,
        nature: nat,
        auraOn: !!nat && !(g.flags && g.flags.dead),
        auraPower: Math.min(1.4, 0.6 + (g.chakraControl || 0) / 100),
        auraColor: cd.accent,
        transformation: (g.transformation) || "none",
        summon: (g.summon && g.summon.active) || (cd.summon) || "none",
        jinchuriki: j && j.beastId ? {
          stage: j.cloak && j.cloak !== "none" ? j.cloak : null,
          tails: j.tails || 0,
          color: C.beast ? (C.beast(j.beastId) || {}).color : "#e2560f"
        } : null
      };
    },

    /* characters.json entry → descriptor, so presets render with the
       exact same pipeline as the player. */
    fromPreset(id) {
      const A = SLS.Assets;
      const db = A && A.characterDB;
      const p = db && db.characters && db.characters[id];
      if (!p) return null;
      const cd = this.clanDef(p.clan);
      return {
        clan: p.clan || "civilian",
        hairColor: p.hair || cd.hair,
        hairLong: !!p.hairLong,
        eyes: p.eyes || cd.eyeDefault || "normal",
        headband: p.headband ? { cloth: "#1b2230", metal: "#c3cad6" } : null,
        outfitColor: p.outfit || cd.robe,
        trimColor: cd.trim,
        armor: p.armor || null,
        weapon: p.weapon || null,
        accessories: p.accessories || [],
        scarfColor: cd.accent,
        injury: 0,
        nature: p.aura || null,
        auraOn: !!p.aura,
        auraPower: 1,
        auraColor: cd.accent,
        transformation: p.transformation || "none",
        summon: p.summon || "none",
        jinchuriki: p.jinchuriki || null,
        _preset: p
      };
    }
  };

  SLS.Layers = Layers;
})();
