/* =================================================================
   SHINOBI LIFE SIMULATOR — ui.js
   Dashboard rendering + gameplay↔animation wiring + bootstrap.
   Layout follows the approved mockup; all gameplay systems are
   untouched and simply re-presented here.
   ================================================================= */
(function () {
  "use strict";
  const SLS = window.SLS;
  const { C, RNG, State, Save, Log, Rules, Gen, Snap, Sprite, PX, Relations, Personality,
          Academy, Techniques, Shop, Achievements, Endings, Dojutsu, Summons, Beasts,
          Combat, Missions, Explore, Engine, Minigames, AnimationManager, Assets, FX } = SLS;
  const AU = SLS.AudioManager;
  const AM = AnimationManager;

  /* Legacy Audio.play(key) shim → real AudioManager sfx names. */
  const KEYMAP = { click:"tap", levelup:"levelup", hit:"hit", win:"missionComplete",
    lose:"defeat", unlock:"achievement", coin:"confirm", promote:"rankup", event:"open" };
  const Audio = { play(k) { if (AU) AU.playSFX(KEYMAP[k] || k); } };
  SLS.Audio = Audio;

  const el = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));
  const pct = (a, b) => Math.max(0, Math.min(100, (a / Math.max(1, b)) * 100));

  /* Nature icon + colour used across cards, auras and jutsu slots. */
  const NAT = (n) => C.natures[n] || { color: "#8892a0", glow: "#aab", icon: "◈" };
  const SEASONS = [["Spring","🌸"],["Summer","☀️"],["Autumn","🍁"],["Winter","❄️"]];

  const UI = {
    tab: "overview",
    nav: "home",
    _lastStage: null,

    /* =============================================================
       LOADING
       ============================================================= */
    loading(context, done) {
      const msgs = C.loadingMessages[context] || C.loadingMessages.boot;
      const list = RNG.pickN(msgs, Math.min(3, msgs.length));
      const scr = el("screen-loading");
      el("load-msg").textContent = list[0] + "…";
      el("load-bar-fill").style.width = "0%";
      scr.classList.add("active"); scr.classList.remove("fading");
      let i = 0, p = 0;
      const rot = setInterval(() => {
        i = (i + 1) % list.length;
        const m = el("load-msg");
        if (m) { m.style.opacity = "0"; setTimeout(() => { m.textContent = list[i] + "…"; m.style.opacity = "1"; }, 170); }
      }, 620);
      const tick = setInterval(() => {
        p = Math.min(100, p + RNG.randInt(9, 22));
        const f = el("load-bar-fill"); if (f) f.style.width = p + "%";
        if (p >= 100) {
          clearInterval(tick); clearInterval(rot);
          setTimeout(() => {
            scr.classList.add("fading");
            setTimeout(() => { scr.classList.remove("active", "fading"); if (done) done(); }, 500);
          }, 220);
        }
      }, 190);
    },

    /* =============================================================
       TOASTS / MODAL
       ============================================================= */
    toast(title, sub, kind) {
      const box = el("toasts"); if (!box) return;
      const t = document.createElement("div");
      t.className = "toast " + (kind || "");
      t.innerHTML = `<div class="t-title">${esc(title)}</div>${sub ? `<div class="t-sub">${esc(sub)}</div>` : ""}`;
      box.appendChild(t);
      setTimeout(() => t.remove(), 4200);
    },
    modal(html, wide) {
      const ov = el("modal-overlay");
      el("modal").className = "modal" + (wide ? " wide" : "");
      el("modal-body").innerHTML = html;
      ov.classList.add("open"); ov.setAttribute("aria-hidden", "false");
      AM.resetIdleTimer();
    },
    closeModal() {
      const ov = el("modal-overlay");
      ov.classList.remove("open"); ov.setAttribute("aria-hidden", "true");
    },
    flashScene(color) {
      const s = el("stage-flash"); if (!s || !color) return;
      s.className = "stage-flash flash-" + color;
      setTimeout(() => { s.className = "stage-flash"; }, 400);
    },
    shake() {
      const c = el("char-canvas");
      if (c) { c.style.transform = "translateX(-50%) translateX(4px)"; setTimeout(() => { c.style.transform = "translateX(-50%)"; }, 90); }
    },
    transition(kind, then) {
      const t = el("stage-wipe");
      if (!t || (State.g && State.g.settings.reducedFX)) { if (then) then(); return; }
      t.className = "stage-wipe play " + (kind || "ink");
      setTimeout(() => { if (then) then(); }, 230);
      setTimeout(() => { t.className = "stage-wipe"; }, 700);
    },

    /* =============================================================
       ANIMATION BINDING — keeps the sprite in sync with game state
       ============================================================= */
    syncAnimation() {
      const g = State.g; if (!g) return;
      const nat = g.char.natures[0];
      AM.setAgeStage(g.stageId);
      AM.setEquipment({
        weapon: g.equipped.weapon && C.rankTier(g.rank) >= 1 ? g.equipped.weapon : null,
        headband: !!g.academy.graduated
      });
      AM.setDojutsu(g.dojutsu && g.dojutsu.active && g.dojutsu.stage !== "none" ? g.dojutsu.type : null);
      AM.setNature(nat ? NAT(nat).color : null, !!nat);
      AM.setLooks(g.char.hairColor, g.char.skin, g.char.clan !== "civilian");
      const j = g.jinchuriki;
      AM.setCloak(j && j.cloak, j ? (C.beast(j.beastId) || {}).color : null);
      AM.setInjured(g.health < g.char.maxHealth * 0.3 && !g.flags.dead);
      AM.sceneSurface = ({ classroom: "wood", home: "wood", cave: "dirt", mountain: "dirt",
        range: "dirt", arena: "dirt" })[g.scene] || "grass";
      if (FX) FX.lowHealth(g.health < g.char.maxHealth * 0.25 && !g.flags.dead);
      if (g.flags.dead) AM.setContext("DEAD");
      AM.refresh();
    },

    /* Play a one-shot animation for an activity, then settle back. */
    animateActivity(id) {
      const map = {
        chakra_train: "jutsu", meditate: "jutsu", jutsu_study: "jutsu", clone_prac: "jutsu", henge_prac: "jutsu",
        precision: "attack", shuriken_les: "attack", weapon_train: "attack", tai_lesson: "attack",
        conditioning: "run", balance: "jump", play: "jump", explore: "walk", spar_lesson: "combat"
      };
      const a = map[id];
      if (!a) return;
      if (a === "walk" || a === "run") { AM.setContext(a === "run" ? "TRAVELLING" : "EXPLORING"); return; }
      if (a === "combat") { AM.setContext("COMBAT"); return; }
      AM.playOnce(a, () => AM.returnToDefault());
    },

    /* =============================================================
       TOP BAR
       ============================================================= */
    renderTopBar() {
      const g = State.g; if (!g) return;
      const v = C.village(g.char.village);
      const clan = C.clan(g.char.clan);
      const port = el("tb-portrait");
      port.innerHTML = "";
      port.appendChild(PX.portraitCanvas(this.spriteCfg(), 46));
      el("tb-clan").textContent = (clan.id === "civilian" ? g.char.name.split(" ")[0] : clan.name).toUpperCase();
      el("tb-rank").textContent = State.rankName().toUpperCase();
      el("tb-level").textContent = g.level;
      el("tb-exp-fill").style.width = pct(g.xp, g.xpNext) + "%";
      el("tb-exp-num").textContent = `${g.xp} / ${g.xpNext}`;
      el("tb-crest").textContent = v.crest;
      el("tb-village").textContent = v.name;
      el("tb-country").textContent = ({ leaf:"Fire Country", sand:"Wind Country", mist:"Water Country",
        cloud:"Lightning Country", stone:"Earth Country", rain:"Rain Country" })[v.id] || "—";
      el("tb-stam").textContent = `${Math.round(g.stamina)} / ${g.char.maxStamina}`;
      el("tb-stam-fill").style.width = pct(g.stamina, g.char.maxStamina) + "%";
      el("tb-ryo").textContent = g.wealth.toLocaleString();
      el("tb-prestige").textContent = Math.max(0, g.fame * 10 + g.reputation);
    },

    spriteCfg() {
      const g = State.g;
      const nat = g.char.natures[0];
      // When the baked atlas is in use it carries one fixed colourway, so the
      // portrait must match it rather than the character's rolled palette.
      const baked = AM && AM.sheetFor && AM.sheetFor(g.stageId);
      const hair = baked ? "#1e2740" : g.char.hairColor;
      const skin = baked ? "#e8b489" : g.char.skin;
      return {
        stage: g.stageId, state: "idle", frame: 0,
        weapon: g.equipped.weapon, headband: !!g.academy.graduated,
        dojutsu: g.dojutsu && g.dojutsu.active && g.dojutsu.stage !== "none" ? g.dojutsu.type : null,
        hairColor: hair, skinTone: skin, clanMark: g.char.clan !== "civilian",
        natureColor: nat ? NAT(nat).color : null, effects: false
      };
    },

    /* =============================================================
       LEFT COLUMN
       ============================================================= */
    renderProfile() {
      const g = State.g, ch = g.char;
      const clan = C.clan(ch.clan), v = C.village(ch.village);
      const bl = ch.bloodline ? C.bloodlines[ch.bloodline] : null;
      const port = el("profile-portrait");
      port.innerHTML = ""; port.appendChild(PX.portraitCanvas(this.spriteCfg(), 84));

      const team = g.team.length
        ? "Team " + (g.flags.teamNo || (g.flags.teamNo = RNG.randInt(1, 12)))
        : "—";
      const rows = [
        ["Name", ch.name], ["Age", g.age], ["Clan", clan.name], ["Title", State.rankName()],
        ["Village", v.name], ["Team", team],
        ["Nature", ch.natures.map(n => NAT(n).icon + " " + n).join(", ")],
        ["Bloodline", bl ? bl.name : "None"],
        ["Chakra Res.", g.char.maxChakra],
        ["Reputation", `${g.reputation} ${g.reputation >= 60 ? "(Trusted)" : g.reputation < 0 ? "(Feared)" : ""}`]
      ];
      el("profile-list").innerHTML = rows.map(([k, val]) =>
        `<dt>${esc(k)}</dt><dd>${esc(val)}</dd>`).join("");

      // clan crest — original geometric mark tinted per clan
      el("clan-crest").innerHTML = `<svg viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r="18" fill="#0a0d12" stroke="${clan.id === "civilian" ? "#3a4150" : "#a8302e"}" stroke-width="2"/>
        <path d="M20 6 a14 14 0 0 1 0 28 a7 7 0 0 0 0 -14 a7 7 0 0 1 0 -14z"
          fill="${clan.id === "civilian" ? "#39404c" : "#a8302e"}"/>
        <circle cx="20" cy="13" r="3.4" fill="#d8d2c4"/></svg>`;
    },

    renderStats() {
      const g = State.g;
      const rows = [
        ["❤", "Health", Math.round(g.health), g.char.maxHealth, "#57b894", `${Math.round(g.health)} / ${g.char.maxHealth}`],
        ["◆", "Chakra", Math.round(g.chakra), g.char.maxChakra, "#4b93d1", `${Math.round(g.chakra)} / ${g.char.maxChakra}`],
        ["✦", "Strength", State.stat("strength"), 100, "#d98a4b", null],
        ["⚡", "Speed", State.stat("speed"), 100, "#d9c74b", null],
        ["✷", "Ninjutsu", State.stat("ninjutsu"), 100, "#a986e0", null],
        ["✊", "Taijutsu", State.stat("taijutsu"), 100, "#e8623d", null],
        ["◉", "Genjutsu", State.stat("genjutsu"), 100, "#d05a8a", null],
        ["🛡", "Defense", State.stat("chakraControl"), 100, "#6b9fd0", null]
      ];
      el("stats-list").innerHTML = rows.map(([ico, name, val, max, col, txt]) =>
        `<div class="stat-line">
           <span class="si" style="color:${col}">${ico}</span>
           <span class="sn">${name}</span>
           <span class="sbar"><i style="width:${pct(val, max)}%;background:linear-gradient(90deg,${col}99,${col})"></i></span>
           <span class="sv">${txt || Math.round(val)}</span>
         </div>`).join("");
    },

    renderRank() {
      const g = State.g;
      const ladder = [
        { id: "student", name: "Academy", ico: "◎" },
        { id: "genin",   name: "Genin",   ico: "◍" },
        { id: "chunin",  name: "Chunin",  ico: "◈" },
        { id: "jonin",   name: "Jonin",   ico: "✦" },
        { id: "kage",    name: "Kage",    ico: "✵" }
      ];
      const tier = C.rankTier(g.rank);
      el("rank-track").innerHTML = ladder.map(r => {
        const t = C.rankTier(r.id);
        const cls = t === tier ? "current" : t < tier ? "done" : "";
        return `<div class="rank-node ${cls}"><div class="rn-ico">${r.ico}</div><div class="rn-name">${r.name}</div></div>`;
      }).join("");

      // Next milestone + honest progress toward it
      let name = "—", p = 0;
      if (!g.academy.enrolled && !g.academy.graduated && g.age < 6) { name = "Academy Entry"; p = pct(g.age, 6); }
      else if (g.academy.enrolled && !g.academy.graduated) {
        name = "Genin Exams";
        const chk = Rules.graduationCheck(g);
        const avg = Academy.average();
        p = chk.eligible ? 100 : Math.min(99, (avg / C.graduation.minTrackAvg) * 60 + (g.academy.attendance / C.graduation.minAttendance) * 25 + Math.min(15, (g.age / C.graduation.minAge) * 15));
      } else if (tier >= 2) {
        const nextRules = { 2: ["Chunin Exams", 90, 8], 3: ["Jonin Selection", 170, 25], 4: ["Elite Trials", 260, 45],
                            5: ["ANBU Selection", 340, 60], 6: ["Captain Review", 430, 80], 7: ["Kage Nomination", 600, 110] };
        const r = nextRules[tier];
        if (r) { name = r[0]; p = Math.min(99, (State.power() / r[1]) * 60 + (g.missionsDone / r[2]) * 40); }
        else { name = "Legend"; p = 100; }
      } else { name = "Academy Entry"; p = 0; }
      el("rank-exam-name").textContent = name;
      el("rank-exam-fill").style.width = Math.round(p) + "%";
      el("rank-exam-pct").textContent = Math.round(p) + "%";
    },

    /* =============================================================
       CENTRE STAGE
       ============================================================= */
    renderStage() {
      const g = State.g; if (!g) return;
      const night = (g.age % 4) === 3;
      const sceneId = g.scene || "overlook";
      const bgDef = Assets && Assets.backgrounds[sceneId];
      const url = bgDef && (night ? bgDef.night : bgDef.day);
      // Re-render once the plate decodes so the first paint is not stuck on
      // the procedural fallback.
      const img = url && Assets.load(url, () => {
        if (State.g && (State.g.scene || "overlook") === sceneId) this.renderStage();
      });
      if (img && img.__ready && !img.__failed) {
        // Final art plate + a procedural atmosphere layer on top.
        el("stage-bg").innerHTML = `<div class="bg-plate" style="background-image:url('${url}')"></div>`
          + `<div class="bg-weather ${night ? "night" : "day"}"></div>`;
      } else {
        el("stage-bg").innerHTML = Sprite.scene(sceneId, { night });
      }
      if (Assets) Assets.preloadScene(sceneId, night);
      if (AU) AU.setScene(sceneId, { night, combat: AM.context === "COMBAT" });
      el("stage-label").textContent = (C.scenes[g.scene] || C.scenes.overlook).name;

      // equipment stack
      const slots = [
        { key: "headband", ico: "🎽", label: "Headband", has: !!g.academy.graduated },
        { key: "weapon",   ico: "🗡", label: "Weapon",   has: !!g.equipped.weapon, name: g.equipped.weapon && (C.weapon(g.equipped.weapon)||{}).name },
        { key: "armor",    ico: "🦺", label: "Armour",   has: !!g.equipped.armor, name: g.equipped.armor && (C.gear.find(x=>x.id===g.equipped.armor)||{}).name },
        { key: "accessory",ico: "⭕", label: "Accessory", has: false },
        { key: "scroll",   ico: "📜", label: "Scroll",   has: g.inventory.some(i => (Shop.item(i)||{}).type === "scroll") }
      ];
      el("eq-slots").innerHTML = slots.map(s =>
        `<div class="eq-slot ${s.has ? "filled" : "empty"}" title="${esc(s.name || s.label)}"
              onclick="SLS.UI.navTo('character')">${s.ico}</div>`).join("");

      // bloodline card
      const bl = g.char.bloodline ? C.bloodlines[g.char.bloodline] : null;
      const dj = g.dojutsu || {};
      const blLvl = bl ? (dj.type ? Math.max(1, PX.states ? (C.dojutsuStages[dj.type] || []).findIndex(s => s.id === dj.stage) : 1) : 1) : 0;
      const blMax = bl && dj.type ? (C.dojutsuStages[dj.type] || []).length - 1 : 3;
      el("card-bloodline").innerHTML = bl
        ? `<div class="mc-head">BLOODLINE</div>
           <div class="mc-ico" style="border-color:${dj.active ? "#e23b3b" : "#3d4450"};color:#e05a5a">${dj.type === "sharingan" ? "◉" : dj.type === "byakugan" ? "◎" : "✦"}</div>
           <div class="mc-lvl">LVL ${Math.max(1, blLvl)}</div>
           <div class="mc-bar"><i style="width:${pct(Math.max(1, blLvl), Math.max(1, blMax))}%"></i></div>
           <div class="mc-num">${esc(bl.name)}</div>`
        : `<div class="mc-head">BLOODLINE</div><div class="mc-ico" style="opacity:.4">—</div>
           <div class="mc-lvl">NONE</div><div class="mc-num">Common blood</div>`;

      // nature card
      const nat = g.char.natures[0];
      const natLvl = nat ? Math.max(1, Math.ceil((g.elementMastery[nat] || 0) / 20)) : 0;
      el("card-nature").innerHTML = nat
        ? `<div class="mc-head">NATURE</div>
           <div class="mc-ico" style="border-color:${NAT(nat).color};color:${NAT(nat).color}">${NAT(nat).icon}</div>
           <div class="mc-lvl">LVL ${natLvl}</div>
           <div class="mc-bar"><i style="width:${g.elementMastery[nat] || 0}%;background:linear-gradient(90deg,${NAT(nat).color}99,${NAT(nat).color})"></i></div>
           <div class="mc-num">${Math.round(g.elementMastery[nat] || 0)} / 100</div>`
        : `<div class="mc-head">NATURE</div><div class="mc-ico" style="opacity:.4">—</div><div class="mc-lvl">—</div>`;

      // jinchuriki miniature
      const jm = el("jin-mini");
      if (g.jinchuriki) {
        const b = C.beast(g.jinchuriki.beastId);
        jm.className = "jin-mini on";
        jm.innerHTML = `<span class="jm-ico">${b ? b.glyph : "◉"}</span>
          <span class="jm-txt"><span class="jm-name">${esc(b ? b.name : "Beast")}</span><br>
          ${esc(g.jinchuriki.mood)} · sync ${Math.round(g.jinchuriki.sync)}%</span>`;
      } else { jm.className = "jin-mini"; jm.innerHTML = ""; }

      this.renderMobileBlocks();
      this.renderQuickJutsu();
    },

    /* Phone-only identity + vitals shown directly beneath the hero. */
    renderMobileBlocks() {
      const g = State.g;
      const clan = C.clan(g.char.clan);
      const mi = el("m-identity");
      if (mi) mi.innerHTML = `<span class="mi-name">${esc(g.char.name)}</span>
        <span class="mi-sub">${esc(State.rankName())} · Age ${g.age}</span>
        <span class="mi-clan">${esc(clan.name)} · ${esc(C.stageFor(g.age).name)}</span>`;
      const mv = el("m-vitals");
      if (mv) {
        const row = (label, cur, max, col) => `<div class="mv">
          <div class="mv-top"><span class="mv-label">${label}</span><span class="mv-num">${Math.round(cur)}/${Math.round(max)}</span></div>
          <div class="mv-bar"><i style="width:${pct(cur,max)}%;background:linear-gradient(90deg,${col}99,${col})"></i></div></div>`;
        mv.innerHTML = row("HEALTH", g.health, g.char.maxHealth, "#57b894")
          + row("CHAKRA", g.chakra, g.char.maxChakra, "#4b93d1")
          + row("STAMINA", g.stamina, g.char.maxStamina, "#d9c74b");
      }
    },

    renderQuickJutsu() {
      const g = State.g;
      const known = g.techniques.map(id => Gen.tech(id)).filter(Boolean)
        .sort((a, b) => (g.techMastery[b.id] || 0) - (g.techMastery[a.id] || 0)).slice(0, 6);
      const icons = { Ninjutsu: "🔥", Taijutsu: "✊", Genjutsu: "◉", Medical: "✚", Sealing: "📜", Summoning: "🐾", "Weapon Arts": "✷" };
      const cells = [];
      for (let i = 0; i < 6; i++) {
        const t = known[i];
        if (!t) { cells.push(`<div class="qj-slot locked" title="Empty slot">·</div>`); continue; }
        const ico = t.element ? NAT(t.element).icon : (icons[t.type] || "✦");
        const canCast = g.chakra >= t.cost && Rules.canFight(g).ok;
        cells.push(`<div class="qj-slot ${canCast ? "ready" : "locked"}" title="${esc(t.name)} — ${t.cost} chakra"
            onclick="SLS.UI.castJutsu('${t.id}')">${ico}<span class="qj-cost">${t.cost}</span></div>`);
      }
      el("qj-slots").innerHTML = cells.join("");
    },

    /* Cast a quick jutsu from the bar — real chakra spend + animation. */
    castJutsu(id) {
      const g = State.g;
      const t = Gen.tech(id); if (!t) return;
      const fight = Rules.canFight(g);
      if (!fight.ok) { this.toast("Too young", fight.reason, "bad"); return; }
      if (g.chakra < t.cost) { this.toast("Not enough chakra", `${t.name} needs ${t.cost}.`, "bad"); return; }
      State.spendChakra(t.cost);
      g.techMastery[id] = Math.min(100, (g.techMastery[id] || 0) + RNG.randInt(2, 5));
      if (t.element) State.gainElement(t.element, 2);
      State.gainStat(t.gate, 0.3); State.gainXP(6);
      const nat = t.element || g.char.natures[0];
      AM.jutsuSound = (Assets && Assets.natureFx[nat] ? Assets.natureFx[nat].sfx : "fire");
      AM.playOnce("jutsu", () => AM.returnToDefault());
      this.flashScene("gold");
      Log.line(`Practised ${t.name}.`, "");
      Save.autosave();
      setTimeout(() => this.renderAll(), 800);
    },

    /* =============================================================
       ANIMATION PARCHMENT PANEL
       ============================================================= */
    renderAnimPanel() {
      const g = State.g; if (!g) return;
      const stage = g.stageId;
      const order = ["idle", "walk", "run", "attack", "jutsu", "jump"];
      const cfg = this.spriteCfg();
      const cur = AM.info().state;
      const html = order.filter(s => PX.allows(stage, s)).map(state => {
        const def = PX.states[state];
        const frames = [];
        for (let f = 0; f < Math.min(def.frames, 5); f++) {
          frames.push(PX.spriteCanvas(Object.assign({}, cfg, {
            state, frame: f, pose: PX.poseFor(state, f, cfg), effects: true
          }), 48, 64));
        }
        const label = state === "attack" ? "ATTACK (KATANA)" : state === "jutsu" ? "JUTSU (FIREBALL)" : state.toUpperCase();
        return { state, label, frames, active: state === cur };
      });
      const host = el("anim-strips");
      host.innerHTML = "";
      const summary = el("anim-summary");
      if (summary) summary.textContent = "ANIMATIONS · " + ((PX.states[cur]||{}).label || cur).toUpperCase();
      const det = el("anim-collapse");
      if (det) det.open = window.innerWidth >= 1080;
      html.forEach(s => {
        const d = document.createElement("div");
        d.className = "anim-strip" + (s.active ? " active" : "");
        d.innerHTML = `<div class="anim-strip-name">${s.label}</div><div class="anim-strip-frames"></div>`;
        const box = d.querySelector(".anim-strip-frames");
        s.frames.forEach(c => box.appendChild(c));
        host.appendChild(d);
      });
      this.renderLegend();
    },

    renderLegend() {
      const cur = AM.info().state;
      const legend = [
        ["idle","IDLE","#5b8fd0"],["walk","WALK","#57b894"],["run","RUN","#63c28a"],
        ["combat","COMBAT","#d6584f"],["attack","ATTACK","#e23b3b"],["jutsu","JUTSU","#a986e0"],
        ["injured","INJURED","#d98a4b"],["dead","DEAD","#8a3030"]
      ];
      el("anim-legend").innerHTML = legend.map(([id, name, col]) =>
        `<div class="leg-item ${id === cur ? "on" : ""}"><span class="leg-dot" style="background:${col}"></span>${name}</div>`).join("");
      const badge = el("anim-badge");
      if (badge) badge.textContent = (PX.states[cur] || {}).label ? PX.states[cur].label.toUpperCase() : cur.toUpperCase();
    },

    /* =============================================================
       ACTIONS + YEAR
       ============================================================= */
    renderActions() {
      const g = State.g;
      const wanted = [
        { id: "train",     label: "TRAIN",      ico: "🏋", desc: "Increase stats",       act: "conditioning" },
        { id: "study",     label: "STUDY",      ico: "📖", desc: "Learn & improve jutsu", act: "jutsu_study" },
        { id: "meditate",  label: "MEDITATE",   ico: "🧘", desc: "Recover chakra",        act: "meditate" },
        { id: "spar",      label: "SPAR",       ico: "⚔", desc: "Improve combat",        act: "spar" },
        { id: "explore",   label: "EXPLORE",    ico: "🧭", desc: "Find items & events",   act: "explore" },
        { id: "missions",  label: "MISSIONS",   ico: "📜", desc: "Earn ryo & reputation", nav: "missions" },
        { id: "bonds",     label: "BONDS",      ico: "🤝", desc: "Build relationships",   act: "socialise" },
        { id: "tournament",label: "TOURNAMENT", ico: "🏆", desc: "Win prizes & glory",    act: "tournament" }
      ];
      el("action-bar").innerHTML = wanted.map(w => {
        let cost = "—", disabled = false, reason = "";
        if (w.nav) {
          const m = Rules.canMission(g);
          disabled = !m.ok; reason = m.reason; cost = "Varies";
        } else {
          const a = C.activities.find(x => x.id === w.act);
          if (!a) { disabled = true; reason = "Unavailable"; }
          else {
            const r = Rules.activity(a.id, g);
            disabled = !r.ok; reason = r.reason || "";
            cost = a.cost ? "-" + a.cost : "free";
          }
        }
        const handler = w.nav ? `SLS.UI.navTo('missions')` : `SLS.UI.doActivity('${w.act}')`;
        return `<button class="act-btn" type="button" ${disabled ? "disabled" : ""}
            title="${esc(disabled ? reason : w.desc)}" onclick="${handler}">
          <span class="act-ico">${w.ico}</span>
          <span class="act-name">${w.label}</span>
          <span class="act-cost ${cost === "free" ? "free" : ""}">${cost}</span>
          <span class="act-desc">${esc(w.desc)}</span></button>`;
      }).join("");
    },

    renderYear() {
      const g = State.g;
      const s = SEASONS[g.age % 4];
      el("year-season-ico").textContent = s[1];
      el("year-label").textContent = `Year ${g.age} • ${s[0]}`;
      const adv = el("btn-advance");
      adv.textContent = Engine.advanceLabel().toUpperCase();
      adv.disabled = !!g.flags.dead;
      el("year-note").textContent = this.pendingHint();
      const d = el("btn-deage");
      const can = Snap.can() && !g.flags.dead;
      d.disabled = !can;
      d.textContent = can ? `↺ De-Age to ${Snap.peekAge()}` : "↺ De-Age One Year";
      d.title = g.diffCfg.ironman ? "Ironman: de-aging disabled" : can ? "" : "Advance a year first";
    },

    pendingHint() {
      const g = State.g;
      if (g.flags.dead) return "Your story has ended.";
      if (g.age >= 6 && g.age <= 11 && !g.academy.enrolled && !g.academy.graduated) return "You may enrol at the Academy.";
      if (g.academy.enrolled && !g.academy.graduated) {
        const chk = Rules.graduationCheck(g);
        if (chk.eligible) return "Ready for the graduation exam.";
        return `Academy ${Math.round(Academy.average())}% · attendance ${Math.round(g.academy.attendance)}%`;
      }
      if (g.stamina < 12) return "Low stamina — advance to recover.";
      return "Recover stamina & chakra · trigger events";
    },

    /* =============================================================
       TABS + NAV
       ============================================================= */
    showTab(tab) {
      this.tab = tab;
      document.querySelectorAll(".stab").forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
      document.querySelectorAll(".stage-view").forEach(v => v.classList.remove("active"));
      const v = el("view-" + tab);
      if (v) v.classList.add("active");
      if (tab !== "overview") this.renderView(tab);
      AM.resetIdleTimer();
    },

    navTo(nav) {
      if (AU) AU.playSFX("open");
      this.nav = nav;
      document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.nav === nav));
      const map = { home: "overview", team: "bonds", missions: "missions" };
      if (map[nav]) { this.showTab(map[nav]); return; }
      // Everything else renders into the RECORDS view as a full page.
      this.showTab("records");
      this.renderView("records", nav);
    },

    renderAll() {
      if (!State.g) return;
      this.renderTopBar();
      this.renderProfile();
      this.renderStats();
      this.renderRank();
      this.renderStage();
      this.renderActions();
      this.renderYear();
      this.syncAnimation();
      if (this._lastStage !== State.g.stageId) { this._lastStage = State.g.stageId; this.renderAnimPanel(); }
      else this.renderLegend();
      if (this.tab !== "overview") this.renderView(this.tab);
    },

    renderView(tab, page) {
      const host = el("view-" + tab); if (!host) return;
      const which = tab === "records" ? (page || this.nav) : tab;
      const fn = this["view_" + which];
      host.innerHTML = fn ? fn.call(this) : this.view_records();
    },

    /* =============================================================
       CENTRE VIEWS
       ============================================================= */
    view_abilities() {
      const g = State.g;
      const all = Gen.techniques();
      const filters = ["Owned", "Available", "All"].concat(C.techTypes);
      const f = this._techFilter || "Owned";
      const frow = filters.map(x => `<button class="chip ${f === x ? "selected" : ""}" type="button" onclick="SLS.UI.setTechFilter('${x}')">${x}</button>`).join("");
      let list = all;
      if (f === "Owned") list = all.filter(t => g.techniques.indexOf(t.id) !== -1);
      else if (f === "Available") list = all.filter(t => g.techniques.indexOf(t.id) === -1 && Techniques.canLearn(t).ok);
      else if (f !== "All") list = all.filter(t => t.type === f);
      list = list.slice().sort((a, b) => (g.techniques.indexOf(b.id) !== -1) - (g.techniques.indexOf(a.id) !== -1) || a.tier - b.tier).slice(0, 80);
      const cards = list.map(t => {
        const has = g.techniques.indexOf(t.id) !== -1;
        const can = Techniques.canLearn(t);
        const m = g.techMastery[t.id] || 0;
        return `<div class="list-card">
          <div class="list-head"><span class="list-title">${esc(t.name)}</span><span class="badge rank-${t.rank}">${t.rank}</span></div>
          <div class="list-desc">${t.type}${t.element ? ` · <span style="color:${NAT(t.element).color}">${t.element}</span>` : ""} · ${t.cost} chakra</div>
          ${has ? `<div class="mastery"><i style="width:${m}%"></i></div><div class="list-desc">Mastery ${Math.round(m)}%</div>`
                : `<div class="list-desc">${esc(can.ok ? "Ready to learn" : can.reason)}</div>`}
          <div class="list-foot">${has
            ? `<span class="badge owned">Learned</span><button class="btn btn-sm" type="button" onclick="SLS.UI.trainTech('${t.id}')">Train</button>`
            : `<span class="badge ${can.ok ? "" : "locked"}">${can.ok ? "Available" : "Locked"}</span>
               <button class="btn btn-sm btn-primary" type="button" ${can.ok ? "" : "disabled"} onclick="SLS.UI.learnTech('${t.id}')">Learn</button>`}
          </div></div>`;
      }).join("");
      return `<div class="panel ink-panel"><h3 class="brush-title">TECHNIQUES</h3>
        <p class="section-note">Known ${g.techniques.length} of ${all.length}. Combat jutsu requires Genin rank.</p>
        <div class="filter-row">${frow}</div>
        <div class="grid-auto">${cards || `<p class="empty">Nothing matches this filter.</p>`}</div></div>`;
    },
    setTechFilter(f) { this._techFilter = f; this.renderView("abilities"); },

    view_inventory() {
      const g = State.g;
      const w = g.equipped.weapon ? C.weapon(g.equipped.weapon) : null;
      const a = g.equipped.armor ? C.gear.find(x => x.id === g.equipped.armor) : null;
      const counts = {}; g.inventory.forEach(id => counts[id] = (counts[id] || 0) + 1);
      const items = Object.keys(counts).map(id => {
        const it = Shop.item(id); if (!it) return "";
        const can = Rules.canEquip(id, g);
        const isGear = !it.consumable;
        return `<div class="list-card">
          <div class="list-head"><span class="list-title">${esc(it.name)}${counts[id] > 1 ? ` ×${counts[id]}` : ""}</span><span class="badge">${it.type}</span></div>
          <div class="list-desc">${esc(it.desc || "")}</div>
          <div class="list-foot"><span class="badge ${isGear && !can.ok ? "locked" : ""}">${isGear ? (can.ok ? "Usable" : esc(can.reason)) : "Consumable"}</span>
            <button class="btn btn-sm btn-primary" type="button" ${isGear && !can.ok ? "disabled" : ""} onclick="SLS.UI.useItem('${id}')">${isGear ? "Equip" : "Use"}</button></div>
        </div>`;
      }).join("");
      return `<div class="panel ink-panel"><h3 class="brush-title">EQUIPPED</h3>
          <div class="kv"><span class="k">Weapon</span><span>${w ? esc(w.name) + ` <button class="btn btn-sm" onclick="SLS.UI.unequip('weapon')">Remove</button>` : "None"}</span></div>
          <div class="kv"><span class="k">Armour</span><span>${a ? esc(a.name) + ` <button class="btn btn-sm" onclick="SLS.UI.unequip('armor')">Remove</button>` : "None"}</span></div>
          <div class="kv"><span class="k">Headband</span><span>${g.academy.graduated ? "Worn" : "Not earned"}</span></div>
        </div>
        <div class="panel ink-panel"><h3 class="brush-title">PACK (${g.inventory.length})</h3>
        <div class="grid-auto">${items || `<p class="empty">Your pack is empty.</p>`}</div></div>`;
    },

    view_missions() {
      const g = State.g;
      const gate = Rules.canMission(g);
      if (!gate.ok) {
        return `<div class="panel ink-panel locked-panel"><div class="lock-ico">🔒</div>
          <h3 class="panel-title">Mission Desk</h3><p class="lock-msg">${esc(gate.reason)}</p>
          ${!g.academy.enrolled && !g.academy.graduated && g.age >= 6 && g.age <= 11
            ? `<button class="btn btn-gold" type="button" onclick="SLS.UI.doActivity('enroll')">Enrol at the Academy</button>` : ""}</div>`;
      }
      const board = Missions.board();
      const cards = board.length ? board.map(m => `
        <div class="list-card">
          <div class="list-head"><span class="list-title">${esc(m.title)}</span><span class="badge rank-${m.rank}">${m.rank}</span></div>
          <div class="list-desc">${m.combat ? "⚔️ Expect combat · " : ""}Difficulty ~${m.power}</div>
          <div class="list-foot"><span class="list-desc">💰 ${m.pay} ryo · ${m.xp} XP</span>
            <button class="btn btn-sm btn-primary" type="button" onclick="SLS.UI.acceptMission('${m.id}')">Accept</button></div>
        </div>`).join("") : `<p class="empty">No missions posted.</p>`;
      return `<div class="panel ink-panel"><div class="row-between"><h3 class="brush-title">MISSION DESK</h3>
          <button class="btn btn-sm" type="button" onclick="SLS.Missions.refresh();SLS.UI.renderView('missions')">🔄 New Board</button></div>
        <p class="section-note">Completed ${g.missionsDone}. Each mission costs 15 stamina.</p>
        <div class="grid-auto">${cards}</div></div>`;
    },

    view_bonds() {
      const g = State.g;
      const rels = g.relationships.slice().sort((a, b) => Relations.score(b) - Relations.score(a));
      if (!rels.length) return `<div class="panel ink-panel"><p class="empty">No bonds yet.</p></div>`;
      const cards = rels.map(r => {
        const m = r.meters;
        const top = C.relMeters.map(k => ({ k, v: m[k] || 0 })).filter(x => Math.abs(x.v) >= 8)
          .sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).slice(0, 4);
        return `<div class="list-card bond-card">
          <div class="list-head"><span class="list-title">${esc(r.npc.name)}</span><span class="badge">${esc(r.type)}</span></div>
          <div class="list-desc">${esc(C.clan(r.npc.clan).name)} · ${esc(r.npc.personality)}${r.locked ? ' · <span class="locked-tag">bond scarred</span>' : ""}</div>
          <div class="meter-mini">${top.length ? top.map(x => `<span class="mm ${x.v < 0 ? "neg" : ""}">${x.k} <b>${Math.round(x.v)}</b></span>`).join("") : '<span class="mm">barely acquainted</span>'}</div>
          ${r.memories.length ? `<div class="memories">${r.memories.map(t => `<span class="mem">${esc(C.memories[t] || t)}</span>`).join("")}</div>` : ""}
          <div class="list-foot bond-actions">
            <button class="btn btn-sm" type="button" onclick="SLS.UI.bond('${r.id}','talk')">Talk</button>
            <button class="btn btn-sm" type="button" onclick="SLS.UI.bond('${r.id}','train')">Train</button>
            <button class="btn btn-sm" type="button" onclick="SLS.UI.bond('${r.id}','confide')">Confide</button>
            <button class="btn btn-sm" type="button" onclick="SLS.UI.bond('${r.id}','gift')">Gift 60₽</button>
          </div></div>`;
      }).join("");
      return `<div class="panel ink-panel"><h3 class="brush-title">BONDS</h3>
        <p class="section-note">Ten meters per person. Betrayal scars a bond permanently.</p>
        <div class="grid-auto">${cards}</div></div>`;
    },

    view_records() {
      const g = State.g;
      const traits = Personality.top(6);
      const tl = g.timeline.slice().reverse().slice(0, 40).map(t =>
        `<div class="tl-item"><div class="tl-age">Age ${t.age}</div><div class="tl-text">${esc(t.text)}</div></div>`).join("");
      const jr = g.journal.slice(0, 40).map(j =>
        `<div class="journal-entry ${j.kind || ""}"><span class="journal-age">Age ${j.age}</span> ${esc(j.text)}</div>`).join("");
      const achs = Achievements.list.map(a => {
        const un = g.achievements[a.id];
        if (a.hidden && !un) return `<div class="ach legendary"><div class="ach-name">🔒 ???</div><div class="ach-desc">Hidden legendary.</div></div>`;
        return `<div class="ach ${un ? "unlocked" : ""} ${a.legendary ? "legendary" : ""}"><div class="ach-name">${un ? "🏅" : "🔒"} ${esc(a.name)}</div><div class="ach-desc">${esc(a.desc)}</div></div>`;
      }).join("");
      return `<div class="panel ink-panel"><h3 class="brush-title">PERSONALITY</h3>
          ${traits.length ? `<div class="trait-row">${traits.map(t => `<span class="tag trait">${esc(t.name)} <b>${Math.round(t.v)}</b></span>`).join("")}</div>`
            : `<p class="empty">No strong traits yet.</p>`}</div>
        <div class="panel ink-panel"><h3 class="brush-title">TIMELINE</h3><div class="scroll-box"><div class="timeline">${tl || `<p class="empty">Your story begins…</p>`}</div></div></div>
        <div class="panel ink-panel"><h3 class="brush-title">JOURNAL</h3><div class="scroll-box">${jr || `<p class="empty">Nothing yet.</p>`}</div></div>
        <div class="panel ink-panel"><h3 class="brush-title">ACHIEVEMENTS (${Achievements.count()}/${Achievements.list.length})</h3>
          <div class="ach-grid">${achs}</div></div>`;
    },

    view_character() { return this.view_records(); },

    view_academy() {
      const g = State.g;
      if (g.academy.graduated) {
        return `<div class="panel ink-panel"><h3 class="brush-title">ACADEMY</h3>
          <p class="section-note">You graduated at age ${g.flags.gradAge != null ? g.flags.gradAge : "—"}. The classroom is behind you.</p>
          <div class="kv"><span class="k">Rank</span><span>${esc(State.rankName())}</span></div>
          <div class="kv"><span class="k">Squad</span><span>${g.team.map(id => { const r = Relations.find(id); return r ? esc(r.npc.name) : ""; }).filter(Boolean).join(", ") || "—"}</span></div>
          <div class="kv"><span class="k">Sensei</span><span>${(function(){const s=Relations.find(g.senseiId);return s?esc(s.npc.name):"—";})()}</span></div></div>`;
      }
      if (!g.academy.enrolled) {
        const r = Rules.activity("enroll", g);
        return `<div class="panel ink-panel locked-panel"><div class="lock-ico">🏫</div>
          <h3 class="panel-title">Ninja Academy</h3>
          <p class="lock-msg">${r.ok ? "You are old enough to enrol." : esc(r.reason)}</p>
          ${r.ok ? `<button class="btn btn-gold" type="button" onclick="SLS.UI.doActivity('enroll')">Enrol Now</button>` : ""}</div>`;
      }
      const chk = Rules.graduationCheck(g);
      const tracks = C.academyTracks.map(t =>
        `<div class="track"><span>${t.name}</span><div class="bar"><i style="width:${g.academy.tracks[t.id] || 0}%"></i></div><b>${Math.round(g.academy.tracks[t.id] || 0)}%</b></div>`).join("");
      const lessons = C.activities.filter(a => a.academy).map(a => {
        const r = Rules.activity(a.id, g);
        return `<button class="act-btn" type="button" ${r.ok ? "" : "disabled"} title="${esc(r.ok ? a.desc : r.reason)}"
          onclick="SLS.UI.doActivity('${a.id}')"><span class="act-ico">${a.ico}</span>
          <span class="act-name">${esc(a.name)}</span><span class="act-cost">-${a.cost}</span></button>`;
      }).join("");
      return `<div class="panel ink-panel"><h3 class="brush-title">ACADEMY — YEAR ${g.academy.year}</h3>
          ${tracks}
          <div class="track"><span>Attendance</span><div class="bar"><i class="att" style="width:${g.academy.attendance}%"></i></div><b>${Math.round(g.academy.attendance)}%</b></div>
          <p class="section-note" style="margin-top:10px">${chk.eligible ? "You are ready to sit the graduation exam." : esc(chk.reason)}</p>
          ${chk.eligible ? `<button class="btn btn-gold btn-block" type="button" onclick="SLS.UI.doActivity('grad_exam')">Attempt Graduation</button>` : ""}
        </div>
        <div class="panel ink-panel"><h3 class="brush-title">LESSONS</h3>
          <div class="action-bar" style="grid-template-columns:repeat(auto-fill,minmax(96px,1fr))">${lessons}</div></div>`;
    },

    view_map() {
      const g = State.g;
      const nodes = [
        { ico:"🏞", name:"Village Overlook", sub:"Home", scene:"overlook" },
        { ico:"🏠", name:"Home", sub:"Family & rest", scene:"home" },
        { ico:"🏫", name:"Academy", sub:"Lessons", scene:"classroom" },
        { ico:"🌲", name:"Training Field", sub:"Chakra & body", scene:"field" },
        { ico:"🎯", name:"Throwing Range", sub:"Precision", scene:"range" },
        { ico:"🏪", name:"Market", sub:"Supplies", scene:"village" },
        { ico:"⛩", name:"Village Gate", sub:"Explore beyond", scene:"forest" },
        { ico:"💧", name:"Waterfall", sub:"Meditation", scene:"waterfall" }
      ].map(n => `<button class="map-node" type="button" onclick="SLS.UI.goPlace('${n.scene}')">
        <div class="map-ico">${n.ico}</div><div class="map-name">${esc(n.name)}</div><div class="map-sub">${esc(n.sub)}</div></button>`).join("");
      return `<div class="panel ink-panel"><h3 class="brush-title">${esc(C.village(g.char.village).name).toUpperCase()}</h3>
        <p class="section-note">Move around the village — the scene behind your character follows you.</p>
        <div class="map-grid">${nodes}</div></div>`;
    },

    view_shop() {
      const g = State.g;
      const cards = Shop.catalog().map(it => {
        const can = Rules.canBuy(it.id, g);
        return `<div class="list-card">
          <div class="list-head"><span class="list-title">${esc(it.name)}</span><span class="badge">${it.type}</span></div>
          <div class="list-desc">${esc(it.desc || "")}</div>
          <div class="list-desc">${it.minAge ? `Age ${it.minAge}+` : "Any age"}${it.minRank && it.minRank !== "civilian" ? ` · ${C.rank(it.minRank).name}+` : ""}${it.str ? ` · ${it.str} str` : ""}</div>
          <div class="list-foot"><span class="list-desc">💰 ${it.price}</span>
            <button class="btn btn-sm btn-primary" type="button" ${can.ok ? "" : "disabled"} title="${esc(can.ok ? "" : can.reason)}" onclick="SLS.UI.buy('${it.id}')">Buy</button></div>
        </div>`;
      }).join("");
      return `<div class="panel ink-panel"><h3 class="brush-title">MARKET DISTRICT</h3>
        <p class="section-note">Your ryo: <b>${g.wealth}</b>. Shopkeepers will not arm children.</p>
        <div class="grid-auto">${cards}</div></div>`;
    },

    view_summons() {
      const g = State.g;
      if (C.rankTier(g.rank) < 2) {
        return `<div class="panel ink-panel locked-panel"><div class="lock-ico">🔒</div><h3 class="panel-title">Summoning</h3>
          <p class="lock-msg">Contracts are found in the world — and only a full ninja may sign one.</p></div>`;
      }
      const contracts = g.summonContracts.map(c => {
        const s = C.summon(c.id);
        return `<div class="list-card">
          <div class="list-head"><span class="list-title">${s.glyph} ${esc(s.name)}</span><span class="badge">${g.activeSummon === c.id ? "Active" : c.stage}</span></div>
          <div class="list-desc">${esc(s.desc)}</div>
          <div class="track"><span>Bond</span><div class="bar"><i style="width:${c.bond}%"></i></div><b>${Math.round(c.bond)}%</b></div>
          <div class="track"><span>Mastery</span><div class="bar"><i style="width:${c.mastery}%"></i></div><b>${Math.round(c.mastery)}%</b></div>
          <div class="list-foot"><button class="btn btn-sm" type="button" onclick="SLS.UI.setSummon('${c.id}')">${g.activeSummon === c.id ? "Dismiss" : "Set active"}</button>
            <button class="btn btn-sm btn-primary" type="button" onclick="SLS.UI.trainSummon()">Train bond</button></div></div>`;
      }).join("");
      let jin = "";
      if (g.jinchuriki) {
        const j = g.jinchuriki, b = C.beast(j.beastId);
        const stages = C.cloakStages.map(s => `<button class="chip ${j.cloak === s.id ? "selected" : ""}" type="button" ${j.sync >= s.sync ? "" : "disabled"}
          onclick="SLS.UI.setCloak('${s.id}')">${esc(s.name)}</button>`).join("");
        jin = `<div class="panel ink-panel beast-panel"><h3 class="brush-title">${esc(b.name).toUpperCase()} — ${b.tails}-TAILS</h3>
          <p class="section-note">${esc(b.desc)} Currently <b>${esc(j.mood)}</b>.</p>
          <div class="track"><span>Trust</span><div class="bar"><i style="width:${j.trust}%"></i></div><b>${Math.round(j.trust)}%</b></div>
          <div class="track"><span>Anger</span><div class="bar"><i class="anger" style="width:${j.anger}%"></i></div><b>${Math.round(j.anger)}%</b></div>
          <div class="track"><span>Sync</span><div class="bar"><i class="xp" style="width:${j.sync}%"></i></div><b>${Math.round(j.sync)}%</b></div>
          <div class="filter-row" style="margin-top:8px">${stages}</div>
          <div class="bond-actions">
            <button class="btn btn-sm" type="button" onclick="SLS.UI.commune('talk')">Speak</button>
            <button class="btn btn-sm" type="button" onclick="SLS.UI.commune('meditate')">Synchronise</button>
            <button class="btn btn-sm" type="button" onclick="SLS.UI.commune('demand')">Demand power</button></div></div>`;
      }
      return `<div class="panel ink-panel"><h3 class="brush-title">SUMMONING CONTRACTS</h3>
        <p class="section-note">Contracts are discovered by exploring, never bought.</p>
        <div class="grid-auto">${contracts || `<p class="empty">No contracts yet. Explore shrines and deep forest.</p>`}</div></div>${jin}`;
    },

    view_settings() {
      const g = State.g, s = g.settings;
      const sw = (k, label, note) => `<div class="setting-row"><span>${label}${note ? `<br><small class="dim">${note}</small>` : ""}</span>
        <label class="switch"><input type="checkbox" ${s[k] ? "checked" : ""} onchange="SLS.UI.setSetting('${k}',this.checked)"><span class="slider"></span></label></div>`;
      return `<div class="panel ink-panel"><h3 class="brush-title">SETTINGS</h3>
          ${sw("autosave","Autosave")}${sw("sound","Sound","ready for future audio")}${sw("reducedFX","Reduced motion")}
        </div>
        <div class="panel ink-panel"><h3 class="brush-title">AUDIO</h3>
          ${(function(){
            if (!AU) return '<p class="empty">Audio unavailable.</p>';
            const v = AU.settings;
            const row = (k, label, fn) => `<div class="vol-row"><span>${label}</span>
              <input type="range" min="0" max="100" value="${Math.round(v[k]*100)}"
                oninput="SLS.UI.setVol('${fn}', this.value)"><b>${Math.round(v[k]*100)}</b></div>`;
            return `<div class="setting-row"><span>Mute all</span>
              <label class="switch"><input type="checkbox" ${v.muted?"checked":""}
                onchange="SLS.UI.setMute(this.checked)"><span class="slider"></span></label></div>`
              + row("master","Master","setMasterVolume") + row("music","Music","setMusicVolume")
              + row("sfx","Sound effects","setSFXVolume") + row("ambience","Ambience","setAmbienceVolume");
          })()}
        </div>
        <div class="panel ink-panel"><h3 class="brush-title">ACCESSIBILITY</h3>
          ${sw("reducedShake","Reduce screen shake")}${sw("reducedFlash","Reduce flashes")}
        </div>
        <div class="panel ink-panel"><h3 class="brush-title">MINIGAME ACCESSIBILITY</h3>
          ${sw("slowMinigames","Slow mode","40% slower timing")}${sw("wideWindows","Wider timing windows")}${sw("autoMinigames","Automatic mode","reduced rewards")}
        </div>
        <div class="panel ink-panel"><h3 class="brush-title">SAVE DATA</h3>
          <p class="section-note">Difficulty <b>${g.diffCfg.name}</b>${g.diffCfg.ironman ? " — de-aging disabled" : ""} · snapshots ${g.snapshots.length}/${Snap.MAX}</p>
          <div class="chip-row"><button class="btn btn-sm" type="button" onclick="SLS.UI.doExport()">📤 Export</button>
            <button class="btn btn-sm" type="button" onclick="SLS.UI.doImport()">📥 Import</button>
            <button class="btn btn-sm" type="button" onclick="SLS.Save.save();SLS.UI.toast('Saved','Progress stored.','good')">💾 Save now</button></div>
          <div class="setting-row"><span style="color:var(--bad)">Abandon this life</span>
            <button class="btn btn-sm danger" type="button" onclick="SLS.UI.hardReset()">Reset</button></div></div>`;
    },

    /* =============================================================
       HANDLERS
       ============================================================= */
    doActivity(id) {
      if (AU) AU.playSFX("tap");
      const g = State.g;
      const a = C.activities.find(x => x.id === id);
      const changeScene = a && a.scene && a.scene !== g.scene;
      AM.resetIdleTimer();
      const run = () => {
        this.animateActivity(id);
        Engine.doActivity(id, (res) => {
          this.renderAll();
          if (res && res.text) this.toast(a ? a.name : "Done", res.text.slice(0, 90), "");
        });
      };
      if (changeScene) this.transition(RNG.pick(["ink", "leaves", "smoke"]), run); else run();
    },
    goPlace(scene) {
      State.g.scene = scene;
      this.transition("ink", () => { this.renderStage(); this.showTab("overview");
        document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.nav === "home"));
        this.nav = "home"; });
    },
    acceptMission(id) {
      if (AU) AU.playSFX("missionAccept");
      AM.setContext("TRAVELLING");
      Missions.accept(id, () => { AM.setContext("HOME"); this.renderAll(); });
    },
    learnTech(id) { const r = Techniques.learn(id); if (!r.ok) this.toast("Cannot learn", r.reason, "bad"); else { this.toast("Technique learned", r.tech.name, "good"); AM.playOnce("jutsu", () => AM.returnToDefault()); } this.renderAll(); },
    trainTech(id) { const r = Techniques.train(id); if (!r.ok) this.toast("Cannot train", r.reason, "bad"); else AM.playOnce("jutsu", () => AM.returnToDefault()); this.renderAll(); },
    buy(id) { const r = Shop.buy(id); if (!r.ok) this.toast("Cannot buy", r.reason, "bad"); else this.toast("Purchased", r.learned ? "Learned " + r.learned.name : r.item.name, "good"); this.renderAll(); },
    useItem(id) { const r = Shop.use(id); if (!r.ok) this.toast("Cannot use", r.reason, "bad"); this.renderAll(); },
    unequip(slot) { Shop.unequip(slot); this.renderAll(); },
    bond(id, mode) { const r = Relations.interact(id, mode); if (!r.ok) this.toast("Not now", r.reason, "bad"); else this.toast("Bond", r.text.slice(0, 80), "good"); this.renderAll(); },
    setSummon(id) { Summons.setActive(State.g.activeSummon === id ? null : id); this.renderAll(); },
    trainSummon() { const r = Summons.train(); if (!r.ok) this.toast("Cannot train", r.reason, "bad"); this.renderAll(); },
    commune(mode) { const r = Beasts.commune(mode); if (!r.ok) this.toast("Not now", r.reason, "bad"); else this.toast("Tailed Beast", r.text, ""); this.renderAll(); },
    setCloak(id) { const r = Beasts.setCloak(id); if (!r.ok && r.reason) this.toast("Refused", r.reason, "bad"); this.renderAll(); },
    toggleDojutsu() { const r = Dojutsu.toggle(); if (!r.ok) this.toast("Cannot", r.reason, "bad"); this.renderAll(); },
    setSetting(k, v) { State.g.settings[k] = v; Save.autosave(); if (AU) AU.playSFX("tap"); },
    setVol(fn, val) { if (AU && AU[fn]) { AU[fn](val / 100); this.renderView("records", "settings"); } },
    setMute(v) { if (AU) { AU.setMuted(v); if (!v) { const g = State.g; AU.setScene(g ? g.scene : "overlook", {}); } }
      this.renderView("records", "settings"); },

    /* =============================================================
       COMBAT UI
       ============================================================= */
    combat(c) {
      const p = c.player, e = c.enemy, g = State.g;
      const bar = (cur, max, cls) => `<div class="mini-bar ${cls}"><i style="width:${pct(cur, max)}%"></i></div>`;
      const actions = c.over ? "" : `<div class="combat-actions">
          <button class="btn" type="button" onclick="SLS.UI.cbt('attack')">⚔️ Attack</button>
          <button class="btn" type="button" onclick="SLS.UI.cbt('chakra')">🌀 Jutsu (18)</button>
          <button class="btn" type="button" onclick="SLS.UI.cbt('dodge')">💨 Dodge</button>
          <button class="btn" type="button" onclick="SLS.UI.cbt('counter')">🛡️ Counter</button>
          <button class="btn" type="button" onclick="SLS.UI.cbt('defend')">🧱 Defend</button>
          ${g.team.length ? `<button class="btn" type="button" onclick="SLS.UI.cbt('team')">👥 Team</button>` : ""}
          ${g.activeSummon ? `<button class="btn" type="button" onclick="SLS.UI.cbt('summon')">🐾 Summon</button>` : ""}
          <button class="btn btn-gold" type="button" onclick="SLS.UI.cbt('ultimate')">💥 Ultimate ${p.charge}%</button>
          <button class="btn btn-ghost" type="button" onclick="SLS.UI.cbtFlee()">🏃 Flee</button></div>`;
      this.modal(`<div class="combat">
        <div class="combat-arena">
          <div class="fighter" id="combat-player"><div class="f-ava">${p.glyph}</div><div class="f-name">${esc(p.name)}</div>
            <div class="f-bars">${bar(p.hp,p.maxHp,"hp")}${bar(p.cp,p.maxCp,"cp")}<div class="f-sub">Charge ${p.charge}%</div></div></div>
          <div class="vs">VS</div>
          <div class="fighter"><div class="f-ava">${e.glyph}</div><div class="f-name">${esc(e.name)}${e.boss?" 👑":""}</div>
            <div class="f-bars">${bar(e.hp,e.maxHp,"hp")}${bar(e.cp,e.maxCp,"cp")}<div class="f-sub">${esc(e.ai)} AI</div></div></div>
        </div>
        <div class="combat-log">${c.log.map(l => `<p>${l}</p>`).join("")}</div>${actions}</div>`, true);
    },
    /* Combat actions route through here so the sprite animates in step. */
    cbt(action) {
      AM.resetIdleTimer();
      if (action === "attack") AM.playOnce("attack");
      else if (action === "chakra" || action === "ultimate" || action === "summon") AM.playOnce("jutsu");
      else AM.setState("combat", { force: true });
      Combat.player(action);
    },
    cbtFlee() { AM.setContext("TRAVELLING"); Combat.flee(); },
    combatEnd(win, cb) {
      const body = el("modal-body"); if (!body) { cb(); return; }
      const d = document.createElement("div");
      d.className = "modal-choices";
      d.innerHTML = `<button class="btn btn-primary btn-block" type="button">${win ? "Victory" : "Continue"}</button>`;
      d.querySelector("button").onclick = () => { this.closeModal(); AM.setContext("HOME"); cb(); };
      body.appendChild(d);
    },

    /* =============================================================
       FLOWS (graduation / explore / social / beast / event / ending)
       ============================================================= */
    sceneEvent(title, text, onDone) {
      this.modal(`<h2 class="modal-title">${title}</h2><p class="modal-text">${esc(text)}</p>
        <div class="modal-choices"><button class="btn btn-primary btn-block" type="button"
          onclick="SLS.UI.closeModal(); SLS.UI.renderAll(); SLS.UI._resume();">Continue</button></div>`);
      this._resumeFn = onDone;
    },
    _resume() { const f = this._resumeFn; this._resumeFn = null; if (f) f(); },

    graduationFlow(onDone) {
      const g = State.g;
      const chk = Rules.graduationCheck(g);
      if (!chk.eligible) { this.toast("Not eligible", chk.reason, "bad"); if (onDone) onDone(); return; }
      g.scene = "arena"; this.renderStage(); AM.setContext("COMBAT");
      this.modal(`<h2 class="modal-title">🎓 Graduation Exam</h2>
        <p class="modal-text">A written paper, then the practical — clone and transformation under the instructor's eye.${chk.prodigy ? "<br><b>You are sitting this early, as a prodigy.</b>" : ""}</p>
        <div class="modal-choices">
          <button class="btn btn-gold btn-block" type="button" onclick="SLS.UI._doExam()">Begin the exam</button>
          <button class="btn btn-ghost btn-block" type="button" onclick="SLS.UI.closeModal();SLS.UI.renderAll();SLS.UI._resume();">Not this year</button></div>`);
      this._resumeFn = onDone;
    },
    _doExam() {
      const r = Academy.attemptExam();
      if (!r.ok) { this.toast("Not eligible", r.reason, "bad"); this.closeModal(); this._resume(); return; }
      AM.playOnce("jutsu", () => AM.returnToDefault());
      if (r.passed) {
        const g = State.g;
        g.flags.gradAge = g.age;
        const out = Academy.graduate();
        Achievements.check();
        this.syncAnimation(); this.renderAll();
        this.modal(`<h2 class="modal-title">🎓 You are a Genin</h2>
          <div class="grad-scene"><div class="grad-band">🎽</div>
            <p class="modal-text">Written <b>${r.written}</b> · Practical <b>${r.practical}</b>${r.mercy ? " <small>(your teacher vouched for you)</small>" : ""}</p>
            <p class="modal-text">You are handed a forehead protector bearing the mark of your village.</p>
            <ul class="reward-list"><li>Rank: <b>Genin</b> — missions unlocked</li>
              <li>Forehead protector now worn by your sprite</li>
              <li>Squad: ${out.mates.map(m => esc(m.npc.name)).join(" & ")}</li>
              <li>Sensei: ${esc(out.sensei.npc.name)}</li>
              <li>Kunai and shuriken issued</li></ul></div>
          <div class="modal-choices"><button class="btn btn-gold btn-block" type="button"
            onclick="SLS.UI.closeModal(); SLS.UI.renderAll(); SLS.UI._resume();">Take the headband</button></div>`, true);
      } else {
        const fail = !r.writtenPass && !r.practicalPass ? "Both halves went badly."
          : !r.writtenPass ? "You failed the written paper." : "Your clones came out wrong.";
        Log.line(`Failed the graduation exam. ${fail}`, "bad");
        this.modal(`<h2 class="modal-title">Not this year</h2>
          <p class="modal-text">${esc(fail)} Written <b>${r.written}</b> · Practical <b>${r.practical}</b>.</p>
          <div class="modal-choices"><button class="btn btn-primary btn-block" type="button"
            onclick="SLS.UI.closeModal(); SLS.UI.renderAll(); SLS.UI._resume();">Keep training</button></div>`);
      }
    },

    exploreFlow(onDone) {
      const deep = C.rankTier(State.g.rank) >= 4 && RNG.chance(0.4);
      const r = Explore.begin(deep);
      if (!r.ok) { this.toast("Cannot leave", r.reason, "bad"); if (onDone) onDone(); return; }
      this._resumeFn = onDone;
      this.renderStage();
      // Travel on foot, breaking into a run when the encounter is dangerous.
      const enc = r.enc;
      AM.setContext(enc.danger >= 2 ? "TRAVELLING" : "EXPLORING");
      const opts = Explore.options(enc);
      setTimeout(() => {
        AM.setContext(enc.danger >= 2 ? "COMBAT" : "HOME");
        this.modal(`<h2 class="modal-title">${enc.glyph} ${esc(enc.name)}</h2>
          <p class="modal-text">${esc(enc.text)}</p>
          <div class="modal-choices">${opts.map((o, i) =>
            `<button class="choice-btn" type="button" onclick="SLS.UI._encChoose(${i})">${esc(o.label)}</button>`).join("")}</div>
          ${opts.length < enc.options.length ? `<p class="mg-hint">Some options are closed to you at your age and rank.</p>` : ""}`);
      }, 900);
      this._enc = enc;
    },
    _encChoose(i) {
      const enc = this._enc;
      this.closeModal();
      const o = Explore.options(enc)[i];
      if (o && o.fx && o.fx.flee) AM.setContext("TRAVELLING");
      if (o && o.fx && o.fx.combat) AM.setContext("COMBAT");
      Explore.choose(enc, i, (res) => {
        if (res && res.beast) { this.beastFlow(res.beast); return; }
        AM.setContext("HOME");
        if (res && res.text) this.sceneEvent(enc.glyph + " " + enc.name, res.text, () => { this.renderAll(); this._resume(); });
        else { this.renderAll(); this._resume(); }
      });
    },

    socialFlow(onDone) {
      const g = State.g;
      const existing = g.relationships.filter(r => r.type !== "Tailed Beast" && r.type !== "Summon");
      this._resumeFn = onDone;
      this.modal(`<h2 class="modal-title">🤝 Build Bonds</h2><p class="modal-text">Who do you spend your time with?</p>
        <div class="modal-choices">
          <button class="choice-btn" type="button" onclick="SLS.UI._socialNew()">Meet someone new<span class="choice-sub">A stranger becomes an acquaintance</span></button>
          ${existing.slice(0, 6).map(r => `<button class="choice-btn" type="button" onclick="SLS.UI._socialWith('${r.id}')">${esc(r.npc.name)}<span class="choice-sub">${esc(r.type)} · bond ${Relations.score(r)}</span></button>`).join("")}</div>`);
    },
    _socialNew() { const r = Relations.meetNew(); this.closeModal(); this.sceneEvent("🤝 A New Face", `You meet ${r.npc.name}, a ${r.type.toLowerCase()} of the ${C.clan(r.npc.clan).name} line.`, () => { this.renderAll(); this._resume(); }); },
    _socialWith(id) { const r = Relations.interact(id, "talk"); this.closeModal(); this.sceneEvent("🤝 Time Together", r.ok ? r.text : r.reason, () => { this.renderAll(); this._resume(); }); },

    beastFlow(beast) {
      const g = State.g;
      Beasts.encounter(beast);
      this.renderStage();
      const canSeal = C.rankTier(g.rank) >= 3 || g.flags.sealingStudy || g.char.bloodline === "sealing";
      this.modal(`<h2 class="modal-title">${beast.glyph} ${esc(beast.name)}</h2>
        <p class="modal-text">${esc(beast.desc)} The ${beast.tails}-Tails regards you with something between contempt and curiosity.</p>
        <p class="modal-text"><b>Finding it does not make you its host.</b></p>
        <div class="modal-choices">
          <button class="choice-btn" type="button" onclick="SLS.UI._beastAct('speak')">Speak to it<span class="choice-sub">Beasts are people, not weapons</span></button>
          <button class="choice-btn" type="button" onclick="SLS.UI._beastAct('observe')">Observe from cover</button>
          <button class="choice-btn" type="button" onclick="SLS.UI._beastAct('help')">Help it<span class="choice-sub">It is in pain</span></button>
          <button class="choice-btn" type="button" onclick="SLS.UI._beastAct('alert')">Alert the village</button>
          <button class="choice-btn" type="button" onclick="SLS.UI._beastAct('fight')">Fight it<span class="choice-sub">Almost certainly fatal</span></button>
          ${canSeal ? `<button class="choice-btn" type="button" onclick="SLS.UI._beastAct('seal')">Attempt a sealing</button>` : ""}
          <button class="choice-btn" type="button" onclick="SLS.UI._beastAct('run')">Run</button></div>`, true);
      this._beast = beast;
    },
    _beastAct(act) {
      const beast = this._beast, g = State.g;
      this.closeModal();
      const finish = (t, x) => this.sceneEvent(t, x, () => { this.renderAll(); this._resume(); });
      if (act === "run") { AM.setContext("TRAVELLING"); Personality.add("calm", 1); setTimeout(() => AM.setContext("HOME"), 1200); return finish("You run", `You put every tree you can between yourself and ${beast.name}.`); }
      if (act === "observe") { State.gainStat("intelligence", 2); return finish("You watch", `You study ${beast.name} from cover and learn more than any scroll could teach.`); }
      if (act === "alert") { State.addRep(8); Personality.add("loyal", 2); return finish("You report it", `The village mobilises. ${beast.name} is driven off, and your name reaches the Kage's office.`); }
      if (act === "speak") {
        if (RNG.chance(0.35 + Personality.value("kind") * 0.03)) { g.flags.beastFriend = beast.id; Personality.add("brave", 2);
          return finish("It answers", `${beast.name} speaks. It does not attack. Something has begun.`); }
        return finish("No answer", `${beast.name} looks through you as though you were weather.`);
      }
      if (act === "help") {
        Personality.add("kind", 3); Personality.add("brave", 2);
        if (RNG.chance(0.4)) { Beasts.becomeHost(beast, "saved"); this.syncAnimation(); this.renderStage();
          return finish("A willing bond", `You free ${beast.name}. Rather than flee, it chooses you as its host — by consent, not capture.`); }
        return finish("It leaves", `You cut the last chain. ${beast.name} vanishes into the treeline.`);
      }
      if (act === "fight") {
        AM.setContext("COMBAT");
        const foe = Combat.makeBeastFoe(beast);
        Combat.start(foe, { boss: true }, (res) => {
          AM.setContext("HOME");
          if (res.blocked) { this.renderAll(); this._resume(); return; }
          if (res.win) { g.bossesBeaten++; State.gainXP(foe.xp); g.fame += 20; State.addRep(15); Achievements.check();
            finish("Impossible", `${beast.name} withdraws, wounded and furious.`); }
          else { State.damage(Math.round(g.char.maxHealth * 0.4)); finish("Crushed", `${beast.name} swats you aside. You wake two days later.`); }
        });
        return;
      }
      if (act === "seal") {
        AM.playOnce("jutsu", () => AM.returnToDefault());
        const r = Beasts.attemptSeal(beast, "sealed");
        this.syncAnimation(); this.renderStage();
        if (r.ok) return finish("Sealed", `Against every odd, the seal takes. ${beast.name} is inside you now — and it is screaming.`);
        return finish("The seal fails", r.reason);
      }
      this.renderAll(); this._resume();
    },

    eventFlow(ev, onDone) {
      this._resumeFn = onDone; this._event = ev;
      this.modal(`<h2 class="modal-title">${esc(ev.title)}</h2><p class="modal-text">${esc(ev.text)}</p>
        ${ev.irreversible ? `<p class="warn-line">⚑ This choice is permanent. Only de-aging can undo it.</p>` : ""}
        <div class="modal-choices">${ev.choices.map((c, i) =>
          `<button class="choice-btn" type="button" onclick="SLS.UI._eventChoose(${i})">${esc(c.label)}</button>`).join("")}</div>`);
    },
    _eventChoose(i) {
      const ev = this._event;
      const res = Engine.applyEventChoice(ev, i);
      this.closeModal();
      if (res && res.combat) {
        AM.setContext("COMBAT");
        const enemy = Combat.makeEnemy(Math.max(2, State.g.level + 1), res.combat);
        Combat.start(enemy, {}, (r) => { AM.setContext("HOME");
          if (r.win) { State.gainXP(40); State.addRep(3); Log.line("You won your first real fight.", "good"); }
          this.renderAll(); this._resume(); });
        return;
      }
      this.syncAnimation();
      this.renderAll(); this._resume();
    },

    ending(e) {
      const g = State.g;
      AM.setContext("DEAD");
      const rows = [["Final Rank", State.rankName()], ["Age", g.age], ["Level", g.level],
        ["Missions", g.missionsDone], ["Techniques", g.techniques.length], ["Bonds", g.relationships.length],
        ["Fame", g.fame], ["Reputation", g.reputation], ["Power", State.power()],
        ["Achievements", `${Achievements.count()} / ${Achievements.list.length}`]]
        .map(([k, v]) => `<div class="kv"><span class="k">${k}</span><span>${v}</span></div>`).join("");
      this.modal(`<h2 class="modal-title">${e.ico} ${esc(e.name)}</h2><p class="modal-text">${esc(e.text)}</p>
        <div class="info-card"><h4>${esc(g.char.name)}</h4>${rows}</div>
        <div class="modal-choices">
          ${Snap.can() ? `<button class="btn btn-block" type="button" onclick="SLS.UI.deAge(true)">↺ Turn back the final year</button>` : ""}
          <button class="btn btn-gold btn-block" type="button" onclick="SLS.UI.newLife()">Begin a New Life</button></div>`, true);
    },

    /* =============================================================
       ADVANCE / DE-AGE
       ============================================================= */
    advanceYear() {
      const g = State.g;
      if (!g || g.flags.dead) return;
      AM.resetIdleTimer();
      Engine.advanceYear((res) => {
        this.transition("leaves", () => {
          this.syncAnimation();
          this.renderAll();
          if (res.stageChanged) {
            this.renderAnimPanel();
            this.toast("You grew", `You are now a ${C.stageFor(g.age).name}.`, "legendary");
            AM.playOnce("jump", () => AM.returnToDefault());
          }
          this._queue = res.queue || [];
          this.drainQueue();
        });
      });
    },
    drainQueue() {
      const next = (this._queue || []).shift();
      const finish = () => {
        const ending = Engine.postYear();
        this.syncAnimation();
        this.renderAll();
        if (ending) this.ending(ending);
      };
      if (!next) return finish();
      if (next.kind === "beast") { this.beastFlow(next.beast); this._resumeFn = () => this.drainQueue(); return; }
      if (next.kind === "event") { this.eventFlow(next.event, () => this.drainQueue()); return; }
      finish();
    },

    deAge(fromEnding) {
      const g = State.g;
      if (g.diffCfg.ironman) { this.toast("Ironman", "De-aging is disabled in Ironman mode.", "bad"); return; }
      if (!Snap.can()) { this.toast("No snapshot", "Advance a year first.", "bad"); return; }
      const target = Snap.peekAge();
      this.modal(`<h2 class="modal-title">↺ Turn Back a Year?</h2>
        <p class="modal-text">Return to the beginning of your previous year? Everything gained, lost, chosen, or changed during the current year will be undone.</p>
        <p class="section-note">You will return to <b>age ${target}</b> — money, items, techniques, achievements, missions, summons, bonds and story choices all revert together.</p>
        <div class="modal-choices">
          <button class="btn btn-gold btn-block" type="button" onclick="SLS.UI._doDeAge()">Yes, turn back the year</button>
          <button class="btn btn-ghost btn-block" type="button" onclick="SLS.UI.closeModal()">Cancel</button></div>`);
    },
    _doDeAge() {
      if (Snap.restore()) {
        this.closeModal();
        this.transition("scroll", () => {
          AM.setContext("HOME");
          this.syncAnimation();
          this.renderAnimPanel();
          this.renderAll();
          this.toast("Year undone", `You are ${State.g.age} again.`, "legendary");
        });
      } else { this.closeModal(); this.toast("Failed", "No snapshot available.", "bad"); }
    },

    /* =============================================================
       SAVE UI
       ============================================================= */
    doExport() {
      this.modal(`<h2 class="modal-title">Export Save</h2><p class="modal-text">Copy this code to back up your shinobi.</p>
        <textarea class="text-input mono" readonly onclick="this.select()">${Save.export()}</textarea>
        <div class="modal-choices"><button class="btn btn-primary btn-block" type="button" onclick="SLS.UI.closeModal()">Done</button></div>`);
    },
    doImport() {
      this.modal(`<h2 class="modal-title">Import Save</h2><p class="modal-text">Paste a save code.</p>
        <textarea id="import-box" class="text-input mono" placeholder="Paste code…"></textarea>
        <div class="modal-choices"><button class="btn btn-primary btn-block" type="button" onclick="SLS.UI._confirmImport()">Import</button>
          <button class="btn btn-ghost btn-block" type="button" onclick="SLS.UI.closeModal()">Cancel</button></div>`);
    },
    _confirmImport() {
      const v = el("import-box").value;
      if (Save.import(v)) { Save.save(); this.closeModal(); Game.enterGame(); this.toast("Imported", "Save restored.", "good"); }
      else this.toast("Invalid code", "Could not import that save.", "bad");
    },
    hardReset() {
      this.modal(`<h2 class="modal-title">Abandon this life?</h2><p class="modal-text">This permanently deletes your current shinobi.</p>
        <div class="modal-choices"><button class="btn btn-block danger" type="button" onclick="SLS.Save.wipe();location.reload()">Yes, start over</button>
          <button class="btn btn-ghost btn-block" type="button" onclick="SLS.UI.closeModal()">Cancel</button></div>`);
    },
    newLife() { Save.wipe(); location.reload(); }
  };
  SLS.UI = UI;

  /* =================================================================
     GAME — creation + bootstrap
     ================================================================= */
  const Game = {
    rolled: null, village: null, difficulty: "normal",

    init() {
      this.registerSW();
      if (AU) AU.init();
      this.wire();
      this.wireTapGate();
      const saved = Save.load();
      if (saved) {
        UI.loading("load", () => {
          this.showTapGate(() => {
            State.g = saved;
            this.enterGame();
            UI.toast("Welcome back", `${saved.char.name}, age ${saved.age}`, "good");
          });
        });
      } else {
        UI.loading("boot", () => {
          this.showTapGate(() => { el("screen-creation").classList.add("active"); this.buildCreation(); });
        });
      }
    },

    /* iOS blocks audio until a real gesture: gate the first entry on a tap. */
    wireTapGate() {
      const gate = el("tap-gate");
      if (!gate) return;
      const enter = () => {
        gate.classList.remove("on");
        gate.setAttribute("aria-hidden", "true");
        if (AU) {
          AU.unlock();
          if (!AU.isMuted()) {
            const g = State.g;
            if (g) AU.setScene(g.scene || "overlook", { night: (g.age % 4) === 3 });
            else AU.playMusic("title", 700);
          }
        }
        if (this._afterGate) { const f = this._afterGate; this._afterGate = null; f(); }
      };
      gate.addEventListener("click", enter);
      gate.addEventListener("touchend", enter, { passive: true });
      this._gateEnter = enter;
    },
    showTapGate(then) {
      const gate = el("tap-gate");
      this._afterGate = then;
      if (!gate) { if (then) then(); return; }
      gate.classList.add("on");
      gate.setAttribute("aria-hidden", "false");
    },

    registerSW() {
      if (!("serviceWorker" in navigator)) return;
      if (location.protocol !== "http:" && location.protocol !== "https:") return;
      window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
    },

    buildCreation() {
      const vg = el("village-select");
      vg.innerHTML = C.villages.map(v => `<button class="village-card" type="button" data-v="${v.id}">
        <div class="vc-top"><span class="vc-crest">${v.crest}</span><span class="vc-name">${v.name}</span></div>
        <div class="vc-desc">${v.desc}</div></button>`).join("");
      vg.querySelectorAll(".village-card").forEach(c => c.addEventListener("click", () => {
        this.village = c.dataset.v;
        vg.querySelectorAll(".village-card").forEach(x => x.classList.remove("selected"));
        c.classList.add("selected");
        this.reroll();
        el("btn-begin").disabled = false;
        el("begin-hint").textContent = "Your fate awaits.";
      }));
      const ds = el("difficulty-select");
      ds.innerHTML = C.difficulties.map(d => `<button type="button" class="chip ${d.id === "normal" ? "selected" : ""}" data-d="${d.id}" title="${d.desc}">${d.name}</button>`).join("");
      ds.querySelectorAll(".chip").forEach(c => c.addEventListener("click", () => {
        this.difficulty = c.dataset.d;
        ds.querySelectorAll(".chip").forEach(x => x.classList.remove("selected"));
        c.classList.add("selected");
        el("diff-note").textContent = (C.difficulties.find(d => d.id === this.difficulty) || {}).desc || "";
      }));
      el("diff-note").textContent = C.difficulties[1].desc;
    },

    reroll() {
      const v = this.village || RNG.pick(C.villages).id;
      this.rolled = Gen.character(v, (el("input-name").value || "").trim(), {});
      this.renderPreview();
    },
    renderPreview() {
      const c = this.rolled; if (!c) return;
      const clan = C.clan(c.clan);
      const bl = c.bloodline ? C.bloodlines[c.bloodline] : null;
      const host = el("creation-sprite");
      host.innerHTML = "";
      // Show the newborn using the same pixel renderer the game uses.
      host.appendChild(PX.spriteCanvas({
        stage: "newborn", state: "idle", frame: 0,
        hairColor: c.hairColor, skinTone: c.skin, clanMark: clan.id !== "civilian",
        natureColor: c.natures[0] ? NAT(c.natures[0]).color : null, effects: false
      }, 48, 64, 3));
      const rare = ["uchiha","hyuga","senju","uzumaki","kaguya","yuki"].indexOf(clan.id) !== -1;
      el("creation-preview").innerHTML = `
        <div class="preview-line"><span class="pl-key">Clan</span><span class="pl-val">${rare ? `<span class="tag rare">${clan.name}</span>` : clan.name}</span></div>
        <div class="preview-line"><span class="pl-key">Bloodline</span><span class="pl-val">${bl ? `<span class="tag bloodline">✦ ${bl.name}</span>` : "None"}</span></div>
        <div class="preview-line"><span class="pl-key">Chakra Nature</span><span class="pl-val">${c.natures.map(n => `<span class="tag nat-${n}">${NAT(n).icon} ${n}</span>`).join(" ")}</span></div>
        <div class="preview-line"><span class="pl-key">Chakra Reserves</span><span class="pl-val">${c.maxChakra}</span></div>
        <div class="preview-line"><span class="pl-key">Health</span><span class="pl-val">${c.maxHealth}</span></div>
        <div class="preview-line"><span class="pl-key">Family</span><span class="pl-val">${c.family.heritage} · ${c.family.siblings} sibling(s)</span></div>
        ${bl ? `<p class="section-note">${esc(bl.desc)}</p>` : ""}`;
    },

    wire() {
      el("btn-reroll").addEventListener("click", () => { if (!this.village) this.village = RNG.pick(C.villages).id; this.reroll(); });
      el("input-name").addEventListener("input", () => { if (this.rolled) this.rolled.name = el("input-name").value.trim() || this.rolled.name; });
      el("btn-begin").addEventListener("click", () => this.begin());
      el("btn-looks").addEventListener("click", () => {
        if (!this.rolled) return;
        this.rolled.hairColor = RNG.pick(C.hairColors);
        this.rolled.skin = RNG.pick(C.skinTones);
        this.rolled.eyeColor = RNG.pick(C.eyeColors);
        this.renderPreview();
      });
      el("btn-advance").addEventListener("click", () => UI.advanceYear());
      el("btn-deage").addEventListener("click", () => UI.deAge());
      el("tb-settings").addEventListener("click", () => UI.navTo("settings"));
      document.querySelectorAll(".stab").forEach(t => t.addEventListener("click", () => UI.showTab(t.dataset.tab)));
      document.querySelectorAll(".nav-btn").forEach(b => b.addEventListener("click", () => UI.navTo(b.dataset.nav)));
    },

    begin() {
      if (!this.rolled) this.reroll();
      this.rolled.name = (el("input-name").value || "").trim() || this.rolled.name;
      UI.loading("newGame", () => {
        State.start(this.rolled, this.difficulty);
        State.g.scene = "overlook";
        Save.save();
        this.enterGame();
        UI.toast("A shinobi is born", `${State.g.char.name} of the ${C.village(State.g.char.village).name}`, "legendary");
      });
    },

    enterGame() {
      el("screen-creation").classList.remove("active");
      el("screen-game").classList.add("active");
      if (!State.g.scene || State.g.scene === "home") State.g.scene = "overlook";
      AM.attach(el("char-canvas"));
      if (FX) {
        FX.attach(el("fx-canvas"));
        // Piggyback on the single animation loop — no second rAF.
        const stageEl = el("char-stage");
        AM.onFrame = (dt) => { FX.update(dt); FX.render(); FX.applyShake(stageEl); };
        AM.onEffect((name) => {
          const g = State.g; if (!g) return;
          const nat = g.char.natures[0] || "Fire";
          if (name === "hit") { FX.slash(); FX.burst("impact", { count: 10, shake: 5, flash: false }); }
          else if (name === "release") { FX.burst(nat, { count: 20, speed: 90, shake: 4 }); }
        });
      }
      AM.setContext(State.g.flags.dead ? "DEAD" : "HOME");
      UI._lastStage = null;
      UI.showTab("overview");
      UI.renderAll();
      UI.renderAnimPanel();
      Achievements.check();
      // Pause the sprite loop when the stage scrolls out of view (mobile).
      if ("IntersectionObserver" in window) {
        const io = new IntersectionObserver(es => { AM.visible = es[0].isIntersecting; }, { threshold: 0.01 });
        io.observe(el("char-stage"));
      }
    }
  };
  SLS.Game = Game;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => Game.init());
  else Game.init();

})();
