/* =================================================================
   SHINOBI LIFE SIMULATOR — sprite.js
   -----------------------------------------------------------------
   Original layered 2D character renderer. Everything is procedural
   SVG generated from game state — no external art, no image URLs.

   Layer order (back → front):
     scene background → nature aura → bloodline aura → beast cloak
     → companion → shadow → legs → torso/clothing → arms → head
     → hair-back/front → eyes (dojutsu) → headband → scars → weapon

   Exposes: SLS.Sprite.character(g), SLS.Sprite.scene(id), SLS.Sprite.beastMini(b)
   ================================================================= */
(function () {
  "use strict";
  const SLS = (window.SLS = window.SLS || {});
  const C = SLS.C;
  const Sprite = {};
  SLS.Sprite = Sprite;

  // Feet sit near the bottom of the viewBox so "meet" bottom-anchoring
  // leaves no dead space under the character.
  const VB_W = 200, VB_H = 226, FEET_Y = 214;

  /* ---------------- helpers ---------------- */
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const shade = (hex, amt) => {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
    r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
    return "#" + ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
  };

  /* Outfit palette chosen from life stage + rank. */
  function outfit(g) {
    const tier = C.rankTier(g.rank);
    const stage = g.stageId;
    const v = C.village(g.char.village);
    const base = v.palette[1];
    if (stage === "newborn") return { main: "#e6dccb", trim: "#cbbfa8", style: "swaddle" };
    if (stage === "toddler") return { main: shade(base, 40), trim: "#e6dccb", style: "romper" };
    if (stage === "child" && tier < 1) return { main: shade(base, 20), trim: "#d9cfba", style: "tunic" };
    if (tier <= 1) return { main: shade(base, 10), trim: "#e2d9c6", style: "academy" };   // Academy Student
    if (tier === 2) return { main: base, trim: "#2f3a44", style: "genin" };               // Genin
    if (tier === 3 || tier === 4) return { main: shade(base, -18), trim: "#3c6b46", style: "flak" };
    if (tier === 5) return { main: shade(base, -26), trim: "#4a4f57", style: "flak" };
    if (tier === 6 || tier === 7) return { main: "#22262c", trim: "#6b7280", style: "anbu" };
    return { main: "#2a2118", trim: "#d9a441", style: "legend" };                          // Kage / Legend
  }

  /* Body geometry derived from the life-stage build profile. */
  function geometry(g) {
    const stage = C.lifeStages.find(s => s.id === g.stageId) || C.lifeStages[0];
    const b = stage.build;
    const height = 168 * b.h;
    const headR = height * 0.118 * b.head;
    const headCy = FEET_Y - height + headR;
    const legLen = height * 0.40 * b.limb;
    const torsoBot = FEET_Y - legLen;
    const torsoTop = headCy + headR * 0.92;
    const shoulderW = height * 0.15 * b.limb;
    return { stage, height, headR, headCy, legLen, torsoBot, torsoTop, shoulderW, cx: VB_W / 2 };
  }

  /* ---------------- auras ---------------- */
  function natureAura(g) {
    const nats = (g.char.natures || []).filter(n => C.natures[n]);
    if (!nats.length) return "";
    let out = "";
    nats.slice(0, 3).forEach((n, i) => {
      const nat = C.natures[n];
      const r = 62 + i * 13;
      out += `<circle class="aura-ring" cx="100" cy="128" r="${r}" fill="none"
        stroke="${nat.color}" stroke-width="2" opacity="0.30"
        stroke-dasharray="${6 + i * 3} ${10 + i * 2}" style="animation-duration:${16 + i * 5}s"/>`;
      // orbiting motes
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + i;
        out += `<circle class="aura-mote" cx="${(100 + Math.cos(a) * r).toFixed(1)}" cy="${(128 + Math.sin(a) * r * 0.62).toFixed(1)}"
          r="${2.4 - i * 0.3}" fill="${nat.glow}" opacity="0.55" style="animation-delay:${(k * 0.4 + i * 0.2).toFixed(1)}s"/>`;
      }
    });
    return `<g class="layer-nature">${out}</g>`;
  }

  function bloodlineAura(g) {
    const bl = g.char.bloodline && C.bloodlines[g.char.bloodline];
    if (!bl || bl.aura === "none") return "";
    const A = bl.aura;
    const P = (s) => `<g class="layer-blood">${s}</g>`;
    switch (A) {
      case "ice": return P(`${[0,1,2,3,4].map(i=>`<path class="mote-slow" d="M${40+i*30} ${70+((i%3)*22)} l5 9 -5 9 -5 -9z" fill="#bfe8ff" opacity="0.5" style="animation-delay:${i*0.5}s"/>`).join("")}`);
      case "wood": return P(`<path d="M28 214 q14 -52 34 -66 M172 214 q-14 -52 -34 -66" stroke="#4d7a3a" stroke-width="4" fill="none" opacity="0.5" stroke-linecap="round"/>
        ${[0,1,2,3].map(i=>`<ellipse class="mote-slow" cx="${48+i*35}" cy="${150-i*14}" rx="7" ry="4" fill="#5f9647" opacity="0.45" style="animation-delay:${i*0.6}s"/>`).join("")}`);
      case "lava": return P(`${[0,1,2].map(i=>`<circle class="aura-mote" cx="${60+i*40}" cy="${168-i*10}" r="${5-i}" fill="#e8622d" opacity="0.5" style="animation-delay:${i*0.5}s"/>`).join("")}`);
      case "storm": return P(`<path class="flicker" d="M62 74 l12 26 -9 3 12 24" stroke="#8fd8ff" stroke-width="2.5" fill="none" opacity="0.6"/>
        <path class="flicker" d="M140 84 l-10 24 8 3 -10 22" stroke="#8fd8ff" stroke-width="2.5" fill="none" opacity="0.5" style="animation-delay:.7s"/>`);
      case "magnet": return P(`${[0,1,2,3,4,5].map(i=>`<rect class="mote-slow" x="${44+i*22}" y="${96+(i%3)*26}" width="4" height="4" fill="#b9a06a" opacity="0.55" style="animation-delay:${i*0.3}s"/>`).join("")}`);
      case "shadow": return P(`<ellipse cx="100" cy="216" rx="66" ry="12" fill="#0a0a12" opacity="0.55"/>
        <path class="mote-slow" d="M100 214 q-46 -6 -60 -34" stroke="#1a1a28" stroke-width="6" fill="none" opacity="0.6" stroke-linecap="round"/>`);
      case "mind": return P(`${[0,1,2].map(i=>`<circle class="aura-ring" cx="100" cy="${74+i*4}" r="${26+i*9}" fill="none" stroke="#c0a6d0" stroke-width="1.5" opacity="0.4" style="animation-duration:${10+i*4}s"/>`).join("")}`);
      case "insects": return P(`${[0,1,2,3,4,5,6].map(i=>`<circle class="mote-fast" cx="${52+i*16}" cy="${92+((i*37)%60)}" r="1.8" fill="#7d8a5a" opacity="0.7" style="animation-delay:${i*0.25}s"/>`).join("")}`);
      case "bone": return P(`${[0,1,2].map(i=>`<path class="mote-slow" d="M${52+i*48} 190 l0 -26" stroke="#e8e2d4" stroke-width="5" stroke-linecap="round" opacity="0.5" style="animation-delay:${i*0.5}s"/>`).join("")}`);
      case "seal": return P(`<circle class="aura-ring" cx="100" cy="146" r="52" fill="none" stroke="#c8783a" stroke-width="2" opacity="0.4" stroke-dasharray="4 8"/>
        <circle cx="100" cy="146" r="34" fill="none" stroke="#c8783a" stroke-width="1.5" opacity="0.3"/>`);
      case "water": return P(`${[0,1,2,3].map(i=>`<path class="mote-slow" d="M${46+i*36} ${176-i*8} q9 -10 18 0" stroke="#6fc0f0" stroke-width="2.5" fill="none" opacity="0.5" style="animation-delay:${i*0.4}s"/>`).join("")}`);
      case "fire": return P(`${[0,1,2].map(i=>`<path class="flicker" d="M${64+i*36} 182 q6 -20 0 -30 q10 12 6 30z" fill="#e8623d" opacity="0.45" style="animation-delay:${i*0.4}s"/>`).join("")}`);
      default: return "";
    }
  }

  /* Tailed-beast chakra cloak, only while active. */
  function beastCloak(g) {
    const j = g.jinchuriki;
    if (!j || !j.beastId || !j.cloak || j.cloak === "none") return "";
    const beast = C.beast(j.beastId); if (!beast) return "";
    const stage = C.cloakStages.find(s => s.id === j.cloak) || C.cloakStages[1];
    const intensity = 0.25 + C.cloakStages.indexOf(stage) * 0.13;
    return `<g class="layer-cloak">
      <ellipse cx="100" cy="140" rx="${52 + C.cloakStages.indexOf(stage) * 8}" ry="${78 + C.cloakStages.indexOf(stage) * 8}"
        fill="${beast.color}" opacity="${intensity.toFixed(2)}" class="cloak-pulse"/>
      <ellipse cx="100" cy="140" rx="${40 + C.cloakStages.indexOf(stage) * 6}" ry="${64 + C.cloakStages.indexOf(stage) * 6}"
        fill="${shade(beast.color, 50)}" opacity="${(intensity * 0.7).toFixed(2)}" class="cloak-pulse" style="animation-delay:.4s"/>
    </g>`;
  }

  /* ---------------- companion ---------------- */
  function companion(g) {
    const sid = g.activeSummon;
    if (!sid) return "";
    const s = C.summon(sid); if (!s) return "";
    return `<g class="layer-companion companion-bob" transform="translate(158,196)">
      <ellipse cx="0" cy="14" rx="15" ry="4" fill="#000" opacity="0.35"/>
      <circle cx="0" cy="0" r="15" fill="${s.color}" opacity="0.9"/>
      <text x="0" y="7" font-size="18" text-anchor="middle">${s.glyph}</text>
    </g>`;
  }

  /* ---------------- eyes / dojutsu ---------------- */
  function eyes(g, G) {
    const eyeY = G.headCy + G.headR * 0.08;
    const dx = G.headR * 0.42;
    const rx = Math.max(2.4, G.headR * 0.17);
    const ry = Math.max(2.6, G.headR * 0.20);
    const d = g.dojutsu || {};
    const active = d.active && d.stage && d.stage !== "none";
    const baseColor = g.char.eyeColor || "#3a2c22";

    // Byakugan — pale, pupil-less, faint veins when active.
    if (active && d.type === "byakugan") {
      return `<g class="layer-eyes">
        ${[-1, 1].map(s => `
          <ellipse cx="${G.cx + s * dx}" cy="${eyeY}" rx="${rx * 1.15}" ry="${ry}" fill="#eef0f6"/>
          <ellipse cx="${G.cx + s * dx}" cy="${eyeY}" rx="${rx * 0.5}" ry="${ry * 0.55}" fill="#dfe3ee"/>
          <path d="M${G.cx + s * dx - rx * 1.9} ${eyeY - ry * 0.7} q${s * rx * 0.7} ${ry * 0.5} ${s * rx * 0.5} ${ry * 1.4}"
            stroke="#b9a8c8" stroke-width="0.9" fill="none" opacity="0.85"/>`).join("")}
        <circle cx="${G.cx}" cy="${eyeY}" r="${G.headR * 1.5}" fill="#e6e9f5" opacity="0.08" class="doju-glow"/>
      </g>`;
    }

    // Sharingan line — red iris, tomoe or pinwheel.
    if (active && d.type === "sharingan") {
      const st = C.dojutsuStages.sharingan.find(s => s.id === d.stage) || C.dojutsuStages.sharingan[1];
      const irisR = rx * 0.78;
      const drawEye = (s) => {
        const ex = G.cx + s * dx;
        let inner = "";
        if (st.id === "mangekyo" || st.id === "eternal") {
          // original pinwheel shape (three curved blades)
          const blades = [0, 120, 240].map(a =>
            `<path d="M0 0 L${(irisR * 0.95).toFixed(2)} ${(-irisR * 0.28).toFixed(2)} A${irisR} ${irisR} 0 0 1 ${(irisR * 0.28).toFixed(2)} ${(irisR * 0.9).toFixed(2)} Z"
              fill="#12060a" transform="rotate(${a})"/>`).join("");
          inner = `<g transform="translate(${ex},${eyeY})" class="${st.id === "eternal" ? "doju-spin-slow" : ""}">${blades}</g>`;
          if (st.id === "eternal") inner += `<circle cx="${ex}" cy="${eyeY}" r="${irisR * 1.05}" fill="none" stroke="#12060a" stroke-width="0.8"/>`;
        } else {
          const n = st.tomoe || 1;
          inner = Array.from({ length: n }, (_, i) => {
            const a = (i / n) * Math.PI * 2 - Math.PI / 2;
            const tx = ex + Math.cos(a) * irisR * 0.55, ty = eyeY + Math.sin(a) * irisR * 0.55;
            return `<circle cx="${tx.toFixed(2)}" cy="${ty.toFixed(2)}" r="${(irisR * 0.26).toFixed(2)}" fill="#14070a"/>`;
          }).join("");
        }
        return `<ellipse cx="${ex}" cy="${eyeY}" rx="${rx * 1.1}" ry="${ry}" fill="#fff5f2"/>
          <circle cx="${ex}" cy="${eyeY}" r="${irisR}" fill="#c62828"/>
          <circle cx="${ex}" cy="${eyeY}" r="${irisR * 0.3}" fill="#1a0709"/>
          ${inner}`;
      };
      return `<g class="layer-eyes">${drawEye(-1)}${drawEye(1)}
        <circle cx="${G.cx}" cy="${eyeY}" r="${G.headR * 1.4}" fill="#e23b3b" opacity="0.10" class="doju-glow"/></g>`;
    }

    // Ordinary eyes (also used when a dojutsu is owned but dormant).
    return `<g class="layer-eyes">
      ${[-1, 1].map(s => `
        <ellipse cx="${G.cx + s * dx}" cy="${eyeY}" rx="${rx}" ry="${ry}" fill="#fdfdfd"/>
        <circle cx="${G.cx + s * dx}" cy="${eyeY}" r="${rx * 0.62}" fill="${baseColor}"/>
        <circle cx="${G.cx + s * dx - rx * 0.2}" cy="${eyeY - ry * 0.25}" r="${rx * 0.2}" fill="#fff" opacity="0.9"/>`).join("")}
    </g>`;
  }

  /* ---------------- hair ---------------- */
  function hair(g, G, back) {
    const col = g.char.hairColor || "#2b2b33";
    const st = g.char.hairStyle || "short";
    const r = G.headR, cx = G.cx, cy = G.headCy;
    if (back) {
      if (st === "long") return `<path d="M${cx - r * 1.05} ${cy} q0 ${r * 2.4} ${r * 0.5} ${r * 2.6} l${r * 1.1} 0 q${r * 0.5} ${-r * 0.2} ${r * 0.5} ${-r * 2.6}z" fill="${shade(col, -14)}"/>`;
      if (st === "ponytail") return `<path d="M${cx + r * 0.7} ${cy - r * 0.3} q${r * 1.4} ${r * 0.6} ${r * 0.7} ${r * 2.2} q${-r * 0.5} ${-r * 0.8} ${-r * 0.9} ${-r * 1.4}z" fill="${shade(col, -14)}"/>`;
      if (st === "bun") return `<circle cx="${cx}" cy="${cy - r * 1.15}" r="${r * 0.45}" fill="${shade(col, -12)}"/>`;
      return "";
    }
    // front / top
    const cap = `<path d="M${cx - r * 1.04} ${cy - r * 0.06} a${r * 1.04} ${r * 1.04} 0 0 1 ${r * 2.08} 0 q${-r * 0.5} ${-r * 0.55} ${-r * 1.04} ${-r * 0.5} q${-r * 0.55} ${-r * 0.05} ${-r * 1.04} ${r * 0.5}z" fill="${col}"/>`;
    let extra = "";
    if (st === "spiky" || st === "messy") {
      extra = [-0.75, -0.35, 0, 0.35, 0.75].map((o, i) =>
        `<path d="M${cx + o * r} ${cy - r * 0.72} l${(i % 2 ? 5 : -5) * (r / 18)} ${-r * (st === "spiky" ? 0.62 : 0.42)} l${6 * (r / 18)} ${r * 0.34}z" fill="${col}"/>`).join("");
    } else if (st === "bob") {
      extra = `<path d="M${cx - r * 1.06} ${cy - r * 0.1} q0 ${r * 1.15} ${r * 0.28} ${r * 1.25} l${r * 0.3} 0 q${-r * 0.3} ${-r * 0.5} ${-r * 0.28} ${-r * 1.2}z" fill="${col}"/>
        <path d="M${cx + r * 1.06} ${cy - r * 0.1} q0 ${r * 1.15} ${-r * 0.28} ${r * 1.25} l${-r * 0.3} 0 q${r * 0.3} ${-r * 0.5} ${r * 0.28} ${-r * 1.2}z" fill="${col}"/>`;
    }
    const fringe = `<path d="M${cx - r * 0.95} ${cy - r * 0.18} q${r * 0.45} ${r * 0.4} ${r * 0.95} ${r * 0.06} q${r * 0.5} ${r * 0.34} ${r * 0.95} ${-r * 0.06} l0 ${-r * 0.3} l${-r * 1.9} 0z" fill="${shade(col, 10)}"/>`;
    return cap + extra + fringe;
  }

  /* ---------------- clothing / body ---------------- */
  function bodyLayers(g, G) {
    const o = outfit(g);
    const skin = g.char.skin || "#e8c09a";
    const cx = G.cx;
    const torsoH = G.torsoBot - G.torsoTop;
    const bodyW = G.shoulderW * 2;

    // Newborn: a swaddled bundle that meets the chin — no limbs shown.
    if (o.style === "swaddle") {
      const headBottom = G.headCy + G.headR * 0.86;
      const bundleTop = headBottom - 1;
      const bundleH = FEET_Y - bundleTop;
      const cyB = bundleTop + bundleH / 2;
      const ryB = bundleH / 2;
      const rxB = G.shoulderW * 1.55;
      return `<g class="layer-body">
        <ellipse cx="${cx}" cy="${cyB.toFixed(1)}" rx="${rxB.toFixed(1)}" ry="${ryB.toFixed(1)}" fill="${o.main}"/>
        <path d="M${(cx - rxB * 0.92).toFixed(1)} ${(cyB - ryB * 0.15).toFixed(1)}
                 q${(rxB * 0.92).toFixed(1)} ${(ryB * 0.5).toFixed(1)} ${(rxB * 1.84).toFixed(1)} 0"
          stroke="${o.trim}" stroke-width="2.5" fill="none" opacity="0.9"/>
        <path d="M${(cx - rxB * 0.7).toFixed(1)} ${(cyB + ryB * 0.42).toFixed(1)}
                 q${(rxB * 0.7).toFixed(1)} ${(ryB * 0.34).toFixed(1)} ${(rxB * 1.4).toFixed(1)} 0"
          stroke="${o.trim}" stroke-width="2" fill="none" opacity="0.6"/>
      </g>`;
    }

    const legY = G.torsoBot, legH = G.legLen;
    const legW = Math.max(4, G.shoulderW * 0.42);
    const armW = Math.max(3.5, G.shoulderW * 0.34);
    const trouser = shade(o.main, -26);

    const legs = `<g class="layer-legs">
      <rect x="${cx - legW * 1.25}" y="${legY}" width="${legW}" height="${legH}" rx="${legW * 0.4}" fill="${trouser}"/>
      <rect x="${cx + legW * 0.25}" y="${legY}" width="${legW}" height="${legH}" rx="${legW * 0.4}" fill="${trouser}"/>
      <rect x="${cx - legW * 1.35}" y="${FEET_Y - legH * 0.12}" width="${legW * 1.2}" height="${legH * 0.13}" rx="2" fill="#2b2b31"/>
      <rect x="${cx + legW * 0.15}" y="${FEET_Y - legH * 0.12}" width="${legW * 1.2}" height="${legH * 0.13}" rx="2" fill="#2b2b31"/>
    </g>`;

    // torso
    let torso = `<rect x="${cx - G.shoulderW}" y="${G.torsoTop}" width="${bodyW}" height="${torsoH}" rx="${G.shoulderW * 0.42}" fill="${o.main}"/>`;
    if (o.style === "academy") {
      torso += `<path d="M${cx - G.shoulderW * 0.55} ${G.torsoTop} l${G.shoulderW * 0.55} ${torsoH * 0.28} l${G.shoulderW * 0.55} ${-torsoH * 0.28}z" fill="${o.trim}"/>`;
    } else if (o.style === "genin") {
      torso += `<rect x="${cx - G.shoulderW}" y="${G.torsoTop + torsoH * 0.55}" width="${bodyW}" height="${torsoH * 0.14}" fill="${o.trim}"/>`;
    } else if (o.style === "flak") {
      torso += `<rect x="${cx - G.shoulderW * 0.94}" y="${G.torsoTop + torsoH * 0.12}" width="${bodyW * 0.94}" height="${torsoH * 0.62}" rx="3" fill="${o.trim}"/>
        <line x1="${cx}" y1="${G.torsoTop + torsoH * 0.12}" x2="${cx}" y2="${G.torsoTop + torsoH * 0.74}" stroke="${shade(o.trim, -30)}" stroke-width="1.5"/>`;
    } else if (o.style === "anbu") {
      torso += `<path d="M${cx - G.shoulderW} ${G.torsoTop + torsoH * 0.1} h${bodyW} v${torsoH * 0.3} h${-bodyW}z" fill="${o.trim}" opacity="0.75"/>`;
    } else if (o.style === "legend") {
      torso += `<path d="M${cx - G.shoulderW * 1.15} ${G.torsoTop} l${G.shoulderW * 0.3} ${torsoH * 1.05} h${bodyW * 0.85} l${G.shoulderW * 0.3} ${-torsoH * 1.05}z" fill="${o.main}" opacity="0.9"/>
        <rect x="${cx - G.shoulderW}" y="${G.torsoTop + torsoH * 0.5}" width="${bodyW}" height="${torsoH * 0.1}" fill="${o.trim}"/>`;
    }

    const armY = G.torsoTop + torsoH * 0.08;
    const armH = torsoH * 0.82;
    const arms = `<g class="layer-arms">
      <rect x="${cx - G.shoulderW - armW * 0.85}" y="${armY}" width="${armW}" height="${armH}" rx="${armW * 0.5}" fill="${o.main}"/>
      <rect x="${cx + G.shoulderW - armW * 0.15}" y="${armY}" width="${armW}" height="${armH}" rx="${armW * 0.5}" fill="${o.main}"/>
      <circle cx="${cx - G.shoulderW - armW * 0.35}" cy="${armY + armH}" r="${armW * 0.55}" fill="${skin}"/>
      <circle cx="${cx + G.shoulderW + armW * 0.35}" cy="${armY + armH}" r="${armW * 0.55}" fill="${skin}"/>
    </g>`;

    return legs + `<g class="layer-torso">${torso}</g>` + arms;
  }

  /* ---------------- headband ---------------- */
  function headband(g, G) {
    if (C.rankTier(g.rank) < 2) return "";   // only after graduation
    const v = C.village(g.char.village);
    const r = G.headR, cx = G.cx, cy = G.headCy;
    const y = cy - r * 0.52;
    return `<g class="layer-headband">
      <rect x="${cx - r * 1.02}" y="${y - r * 0.2}" width="${r * 2.04}" height="${r * 0.42}" rx="2" fill="#243044"/>
      <rect x="${cx - r * 0.42}" y="${y - r * 0.23}" width="${r * 0.84}" height="${r * 0.46}" rx="2" fill="#c9ccd2"/>
      <text x="${cx}" y="${y + r * 0.17}" font-size="${r * 0.5}" text-anchor="middle">${v.crest}</text>
    </g>`;
  }

  /* ---------------- weapon ---------------- */
  function weapon(g, G) {
    const wid = g.equipped && g.equipped.weapon;
    if (!wid) return "";
    const w = C.weapon(wid); if (!w) return "";
    const cx = G.cx, torsoH = G.torsoBot - G.torsoTop;
    const armX = cx + G.shoulderW + 5;
    const scale = Math.max(0.6, G.height / 168);

    if (w.carry === "back") {
      const L = 70 * scale;
      return `<g class="layer-weapon" transform="translate(${cx - G.shoulderW - 4},${G.torsoTop + torsoH * 0.1}) rotate(-32)">
        <rect x="0" y="0" width="${5 * scale}" height="${L}" rx="2" fill="${w.color}"/>
        <rect x="${-2 * scale}" y="${L * 0.72}" width="${9 * scale}" height="${4 * scale}" fill="#6b4a2a"/>
        <rect x="${0.5 * scale}" y="${L * 0.76}" width="${4 * scale}" height="${L * 0.24}" fill="#4a3520"/>
      </g>`;
    }
    if (w.carry === "waist") {
      return `<g class="layer-weapon" transform="translate(${cx + G.shoulderW * 0.2},${G.torsoBot - 2}) rotate(72)">
        <rect x="0" y="0" width="${4 * scale}" height="${34 * scale}" rx="2" fill="${w.color}"/>
        <rect x="${-1.5 * scale}" y="${26 * scale}" width="${7 * scale}" height="${3 * scale}" fill="#5a4530"/>
      </g>`;
    }
    if (w.carry === "beside") {
      const H = 96 * scale;
      return `<g class="layer-weapon" transform="translate(${cx + G.shoulderW + 16},${FEET_Y - H})">
        <ellipse cx="${6 * scale}" cy="${H + 3}" rx="${11 * scale}" ry="3" fill="#000" opacity="0.35"/>
        <rect x="0" y="0" width="${13 * scale}" height="${H * 0.72}" rx="3" fill="${w.color}"/>
        <rect x="${4 * scale}" y="${H * 0.72}" width="${5 * scale}" height="${H * 0.28}" fill="#5a4530"/>
      </g>`;
    }
    // hand
    return `<g class="layer-weapon" transform="translate(${armX},${G.torsoTop + torsoH * 0.86})">
      <rect x="0" y="${-14 * scale}" width="${3.4 * scale}" height="${20 * scale}" rx="1.6" fill="${w.color}"/>
      <rect x="${-1.4 * scale}" y="${4 * scale}" width="${6 * scale}" height="${3 * scale}" fill="#5a4530"/>
    </g>`;
  }

  /* ---------------- scars / injuries ---------------- */
  function scars(g, G) {
    const n = Math.min(3, (g.scars || 0));
    if (!n) return "";
    let out = "";
    for (let i = 0; i < n; i++) {
      const y = G.headCy + G.headR * (0.1 + i * 0.25);
      out += `<line x1="${G.cx - G.headR * 0.8}" y1="${y}" x2="${G.cx - G.headR * 0.35}" y2="${y + G.headR * 0.22}" stroke="#a8583f" stroke-width="1.2" opacity="0.8"/>`;
    }
    return `<g class="layer-scars">${out}</g>`;
  }

  /* =================================================================
     PUBLIC: full character SVG
     ================================================================= */
  Sprite.character = function (g) {
    if (!g || !g.char) return "";
    const G = geometry(g);
    const skin = g.char.skin || "#e8c09a";
    const head = `<g class="layer-head">
      <circle cx="${G.cx}" cy="${G.headCy}" r="${G.headR}" fill="${skin}"/>
      <path d="M${G.cx - G.headR * 0.34} ${G.headCy + G.headR * 0.5} q${G.headR * 0.34} ${G.headR * 0.22} ${G.headR * 0.68} 0"
        stroke="${shade(skin, -50)}" stroke-width="1" fill="none" opacity="0.65"/>
    </g>`;
    const neck = G.stage.id === "newborn" ? "" :
      `<rect x="${G.cx - G.headR * 0.28}" y="${G.headCy + G.headR * 0.72}" width="${G.headR * 0.56}" height="${G.headR * 0.42}" fill="${shade(skin, -18)}"/>`;

    return `<svg class="char-svg" viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="xMidYMax meet"
      xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Your shinobi">
      ${natureAura(g)}
      ${bloodlineAura(g)}
      ${beastCloak(g)}
      ${companion(g)}
      <ellipse cx="${G.cx}" cy="${FEET_Y + 4}" rx="${G.shoulderW * 1.5}" ry="${5 + G.height * 0.02}" fill="#000" opacity="0.38"/>
      <g class="char-figure">
        ${hair(g, G, true)}
        ${bodyLayers(g, G)}
        ${neck}
        ${head}
        ${hair(g, G, false)}
        ${eyes(g, G)}
        ${headband(g, G)}
        ${scars(g, G)}
        ${weapon(g, G)}
      </g>
    </svg>`;
  };

  /* =================================================================
     PUBLIC: scene backdrop SVG (original procedural art)
     ================================================================= */
  Sprite.scene = function (id, opts) {
    opts = opts || {};
    const s = C.scenes[id] || C.scenes.village;
    // Daylight scenes (the village overlook) never darken all the way to night.
    const night = !!opts.night && !s.day;
    const sky0 = night ? shade(s.sky[0], -14) : s.sky[0];
    const sky1 = night ? shade(s.sky[1], -10) : s.sky[1];
    const gid = "sky_" + id;
    let props = "";

    const trees = (n, y, col) => Array.from({ length: n }, (_, i) => {
      const x = 14 + i * (272 / n) + (i % 2) * 12;
      const h = 46 + (i % 3) * 16;
      return `<path d="M${x} ${y} l-13 ${-h * 0.5} h7 l-9 ${-h * 0.5} h24 l-9 ${h * 0.5} h7z" fill="${col}"/>
              <rect x="${x - 2}" y="${y}" width="4" height="8" fill="#2a1f16"/>`;
    }).join("");

    switch (s.props) {
      case "overlook":
        // Daylight village seen from a hillside path: monument cliff, rooftops, trees.
        props = `
          <ellipse cx="60" cy="26" rx="26" ry="10" fill="#fff" opacity="0.55"/>
          <ellipse cx="200" cy="18" rx="32" ry="11" fill="#fff" opacity="0.45"/>
          <path d="M0 96 L54 44 L106 96z" fill="#6d7f8c"/>
          <path d="M78 96 L140 34 L202 96z" fill="#7d8e9a"/>
          <path d="M170 96 L226 46 L282 96z" fill="#6d7f8c"/>
          <!-- monument: a carved cliff face with weathered stone heads -->
          <path d="M92 88 L96 46 L214 44 L218 88z" fill="#7c8994"/>
          <path d="M92 88 L96 46 L120 46 L116 88z" fill="#8d99a4" opacity="0.7"/>
          ${[0,1,2,3].map(i => `<g transform="translate(${101 + i*29},50)">
            <path d="M2 34 L1 12 Q11 3 21 12 L20 34z" fill="#93a0ab"/>
            <path d="M1 12 Q11 3 21 12 L21 16 Q11 9 1 16z" fill="#6e7b87"/>
            <rect x="5" y="18" width="4" height="2" fill="#57636e"/>
            <rect x="13" y="18" width="4" height="2" fill="#57636e"/>
            <rect x="9" y="24" width="4" height="2" fill="#6b7681" opacity="0.8"/>
          </g>`).join("")}
          <rect x="92" y="86" width="126" height="3" fill="#5f6b76"/>
          <!-- village rooftops: a dense far row, then a nearer row -->
          ${[0,1,2,3,4,5,6,7,8,9,10,11].map(i=>{
            const x = 4 + i*25, h = 14 + (i%3)*5, y = 118 - h;
            const col = ["#8c5a3c","#a06a44","#7a4d34"][i%3];
            return `<rect x="${x}" y="${y}" width="19" height="${h}" fill="#c3b092" opacity="0.85"/>
                    <path d="M${x-3} ${y} L${x+9.5} ${y-8} L${x+22} ${y}z" fill="${col}" opacity="0.85"/>`;
          }).join("")}
          ${[0,1,2,3,4,5,6,7].map(i=>{
            const x = 2 + i*38, h = 22 + (i%3)*7, y = 146 - h;
            const col = ["#7d4d33","#96603e","#6c422c"][i%3];
            return `<rect x="${x}" y="${y}" width="28" height="${h}" fill="#cbb89a"/>
                    <path d="M${x-4} ${y} L${x+14} ${y-11} L${x+32} ${y}z" fill="${col}"/>
                    <rect x="${x+7}" y="${y+8}" width="7" height="8" fill="#46566a" opacity="0.75"/>
                    <rect x="${x+18}" y="${y+8}" width="5" height="8" fill="#46566a" opacity="0.6"/>`;
          }).join("")}
          <!-- foreground foliage framing -->
          <path d="M0 0 q34 26 18 58 q-12 -22 -34 -30z" fill="#2c4a2a" opacity="0.9"/>
          <path d="M300 0 q-40 22 -22 62 q14 -26 38 -34z" fill="#25401f" opacity="0.9"/>
          <ellipse cx="150" cy="152" rx="120" ry="12" fill="#7a6a46" opacity="0.7"/>`;
        break;
      case "home":
        props = `<rect x="26" y="86" width="96" height="62" fill="#3a2b20"/>
          <path d="M18 88 L74 54 L130 88z" fill="#4a3527"/>
          <rect x="58" y="112" width="24" height="36" fill="#241a13"/>
          <rect x="92" y="100" width="20" height="18" fill="#c9a05a" opacity="0.75"/>
          <ellipse cx="230" cy="150" rx="40" ry="9" fill="#000" opacity="0.15"/>`;
        break;
      case "village":
        props = `<rect x="10" y="72" width="60" height="76" fill="#2f3440"/><rect x="76" y="54" width="48" height="94" fill="#363c4a"/>
          <rect x="130" y="80" width="66" height="68" fill="#2f3440"/><rect x="202" y="60" width="54" height="88" fill="#363c4a"/>
          ${[20, 88, 140, 212].map(x => `<rect x="${x}" y="${x % 40 ? 92 : 74}" width="12" height="14" fill="#d9a441" opacity="0.55"/>`).join("")}
          <path d="M0 148 h300" stroke="#1c2029" stroke-width="4"/>`;
        break;
      case "classroom":
        props = `<rect x="0" y="40" width="300" height="108" fill="#2f2619"/>
          <rect x="20" y="52" width="104" height="52" rx="3" fill="#1d1710" stroke="#4a3a24" stroke-width="2"/>
          <text x="72" y="84" font-size="15" text-anchor="middle" fill="#8a7a58">忍</text>
          ${[0, 1, 2].map(r => [0, 1, 2].map(c2 =>
            `<rect x="${16 + c2 * 96}" y="${112 + r * 14}" width="72" height="8" rx="2" fill="#4a3826"/>`).join("")).join("")}
          <rect x="150" y="56" width="46" height="34" fill="#3a2f1e"/>`;
        break;
      case "yard":
        props = `${trees(6, 108, "#22381f")}
          ${[60, 140, 220].map(x => `<rect x="${x}" y="98" width="9" height="50" rx="3" fill="#4a3826"/>
            <rect x="${x - 6}" y="96" width="21" height="7" rx="2" fill="#5c4730"/>`).join("")}`;
        break;
      case "field":
        props = `${trees(5, 100, "#20331d")}
          <ellipse cx="150" cy="150" rx="150" ry="16" fill="#35492f" opacity="0.6"/>
          <rect x="238" y="92" width="10" height="56" rx="3" fill="#4a3826"/>`;
        break;
      case "range":
        props = `${[54, 150, 246].map((x, i) => `
          <rect x="${x - 4}" y="${96 - i * 4}" width="8" height="52" fill="#4a3826"/>
          <circle cx="${x}" cy="${86 - i * 4}" r="22" fill="#e6dcc4"/>
          <circle cx="${x}" cy="${86 - i * 4}" r="15" fill="#c9573f"/>
          <circle cx="${x}" cy="${86 - i * 4}" r="8" fill="#e6dcc4"/>
          <circle cx="${x}" cy="${86 - i * 4}" r="3" fill="#2a2118"/>`).join("")}`;
        break;
      case "forest":
        props = `${trees(9, 122, "#16281a")}${trees(6, 148, "#1d3522")}
          ${[40, 120, 220].map((x, i) => `<circle class="mote-slow" cx="${x}" cy="${60 + i * 18}" r="2" fill="#7fd8a0" opacity="0.5" style="animation-delay:${i}s"/>`).join("")}`;
        break;
      case "river":
        props = `<rect x="0" y="112" width="300" height="36" fill="#2a5468" opacity="0.9"/>
          ${[0, 1, 2, 3].map(i => `<path class="mote-slow" d="M${20 + i * 78} ${122 + i * 5} q16 -6 32 0" stroke="#6fb0d8" stroke-width="2" fill="none" opacity="0.6" style="animation-delay:${i * 0.5}s"/>`).join("")}
          ${trees(4, 112, "#1b3324")}`;
        break;
      case "waterfall":
        props = `<rect x="96" y="20" width="52" height="118" fill="#4a86a8" opacity="0.72"/>
          ${[0, 1, 2, 3].map(i => `<rect class="fall" x="${102 + i * 12}" y="20" width="4" height="118" fill="#9fd6f0" opacity="0.5" style="animation-delay:${i * 0.3}s"/>`).join("")}
          <ellipse cx="122" cy="140" rx="46" ry="12" fill="#5f9fc0" opacity="0.6"/>
          <rect x="0" y="20" width="96" height="120" fill="#26333c"/><rect x="148" y="20" width="152" height="112" fill="#26333c"/>`;
        break;
      case "mountain":
        props = `<path d="M-10 148 L70 44 L150 148z" fill="#333944"/><path d="M110 148 L200 30 L290 148z" fill="#3c4350"/>
          <path d="M180 62 L200 30 L220 62 L200 54z" fill="#dfe6ee" opacity="0.85"/>
          <path d="M52 68 L70 44 L88 68 L70 60z" fill="#dfe6ee" opacity="0.7"/>`;
        break;
      case "cave":
        props = `<path d="M0 148 L0 60 Q80 12 150 34 Q230 14 300 62 L300 148z" fill="#100e14"/>
          ${[0, 1, 2, 3, 4].map(i => `<path d="M${34 + i * 56} 34 l7 32 l7 -32z" fill="#1d1a24"/>`).join("")}
          ${[0, 1, 2].map(i => `<circle class="mote-slow" cx="${70 + i * 80}" cy="${96 + i * 8}" r="2.5" fill="#8f6fd8" opacity="0.6" style="animation-delay:${i * 0.7}s"/>`).join("")}`;
        break;
      case "ruins":
        props = `${[26, 92, 168, 238].map((x, i) => `<rect x="${x}" y="${64 + (i % 2) * 18}" width="20" height="${84 - (i % 2) * 18}" fill="#3a3444"/>
          <rect x="${x - 4}" y="${60 + (i % 2) * 18}" width="28" height="7" fill="#464056"/>`).join("")}
          <path d="M0 148 h300" stroke="#2a2434" stroke-width="6"/>`;
        break;
      case "camp":
        props = `<path d="M60 148 L96 88 L132 148z" fill="#3a2f28"/>
          <circle class="flicker" cx="200" cy="132" r="13" fill="#e8783d" opacity="0.8"/>
          <circle class="flicker" cx="200" cy="132" r="7" fill="#f6c667" opacity="0.9" style="animation-delay:.3s"/>
          ${[186, 200, 214].map(x => `<rect x="${x}" y="138" width="12" height="4" rx="2" fill="#4a3826" transform="rotate(${x % 3 ? 12 : -12} ${x} 140)"/>`).join("")}`;
        break;
      case "arena":
        props = `<ellipse cx="150" cy="146" rx="140" ry="26" fill="#4a3d34"/>
          <ellipse cx="150" cy="144" rx="118" ry="20" fill="#5a4a3e"/>
          ${[20, 280].map(x => `<rect x="${x - 8}" y="72" width="16" height="76" fill="#3a2f28"/>`).join("")}
          ${[60, 150, 240].map(x => `<rect x="${x - 3}" y="60" width="6" height="26" fill="#8c2f2f"/>`).join("")}`;
        break;
    }

    return `<svg class="scene-svg" viewBox="0 0 300 160" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${sky0}"/><stop offset="100%" stop-color="${sky1}"/>
      </linearGradient></defs>
      <rect width="300" height="160" fill="url(#${gid})"/>
      ${night ? `<circle cx="248" cy="30" r="13" fill="#e8e4d0" opacity="0.85"/>` : `<circle cx="248" cy="30" r="15" fill="#f0d68a" opacity="0.5"/>`}
      ${night ? Array.from({ length: 14 }, (_, i) => `<circle cx="${(i * 53) % 290 + 6}" cy="${(i * 29) % 54 + 6}" r="1" fill="#fff" opacity="${0.3 + (i % 3) * 0.2}"/>`).join("") : ""}
      ${props}
      <rect y="146" width="300" height="14" fill="${s.ground}"/>
    </svg>`;
  };

  /* =================================================================
     PUBLIC: tailed-beast miniature (only shown once sealed)
     ================================================================= */
  Sprite.beastMini = function (beast, mood) {
    if (!beast) return "";
    return `<svg viewBox="0 0 60 60" class="beast-mini-svg" aria-hidden="true">
      <circle cx="30" cy="30" r="26" fill="${beast.color}" opacity="0.22"/>
      <circle cx="30" cy="30" r="20" fill="${beast.color}" opacity="0.38" class="cloak-pulse"/>
      <text x="30" y="39" font-size="26" text-anchor="middle">${beast.glyph}</text>
    </svg>`;
  };

  /* Small standalone portrait used in NPC / summon cards. */
  Sprite.token = function (glyph, color) {
    return `<svg viewBox="0 0 40 40" class="token-svg" aria-hidden="true">
      <circle cx="20" cy="20" r="18" fill="${color || "#333c48"}" opacity="0.35"/>
      <text x="20" y="27" font-size="19" text-anchor="middle">${esc(glyph)}</text>
    </svg>`;
  };

})();
