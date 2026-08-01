/* =================================================================
   SHINOBI LIFE SIMULATOR — ui.js
   Loading screen · character scene · panels · flows · bootstrap
   All DOM work lives here so the systems stay presentation-free.
   ================================================================= */
(function () {
  "use strict";
  const SLS = window.SLS;
  const { C, RNG, State, Save, Log, Rules, Gen, Snap, Sprite, Relations, Personality,
          Academy, Techniques, Shop, Achievements, Endings, Dojutsu, Summons, Beasts,
          Combat, Missions, Explore, Engine, Minigames } = SLS;

  /* ---------------- Audio (sound-ready stub) ---------------- */
  const Audio = {
    keys: ["click", "levelup", "hit", "win", "lose", "unlock", "coin", "promote", "event", "grade"],
    play() { /* hook point: real audio can be dropped in without touching callers */ }
  };
  SLS.Audio = Audio;

  const el = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const pct = (a, b) => Math.max(0, Math.min(100, (a / Math.max(1, b)) * 100));

  const UI = {
    tab: "character",
    _pendingQueue: [],

    /* =============================================================
       LOADING SCREEN
       ============================================================= */
    loading(context, done) {
      const msgs = C.loadingMessages[context] || C.loadingMessages.boot;
      const list = RNG.pickN(msgs, Math.min(3, msgs.length));
      const scr = el("screen-loading");
      el("load-msg").textContent = list[0] + "…";
      el("load-bar-fill").style.width = "0%";
      scr.classList.add("active");
      scr.classList.remove("fading");

      let i = 0, p = 0;
      const rotate = setInterval(() => {
        i = (i + 1) % list.length;
        const m = el("load-msg");
        if (m) { m.style.opacity = "0"; setTimeout(() => { m.textContent = list[i] + "…"; m.style.opacity = "1"; }, 180); }
      }, 620);

      const tick = setInterval(() => {
        p = Math.min(100, p + RNG.randInt(9, 22));
        const f = el("load-bar-fill");
        if (f) f.style.width = p + "%";
        if (p >= 100) {
          clearInterval(tick); clearInterval(rotate);
          setTimeout(() => {
            scr.classList.add("fading");
            setTimeout(() => { scr.classList.remove("active", "fading"); if (done) done(); }, 520);
          }, 240);
        }
      }, 190);
    },

    /* =============================================================
       TOASTS & MODAL
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
      ov.classList.add("open");
      ov.setAttribute("aria-hidden", "false");
    },
    closeModal() {
      const ov = el("modal-overlay");
      ov.classList.remove("open");
      ov.setAttribute("aria-hidden", "true");
    },
    flashScene(color) {
      const s = el("scene-flash"); if (!s || !color) return;
      s.className = "scene-flash flash-" + color;
      setTimeout(() => { s.className = "scene-flash"; }, 420);
    },
    shake() {
      const f = el("combat-player");
      if (f) { f.classList.remove("hurt"); void f.offsetWidth; f.classList.add("hurt"); }
    },

    /* Scene transition wipe used when changing activity backdrops. */
    transition(kind, then) {
      const t = el("scene-transition");
      if (!t || (State.g && State.g.settings.reducedFX)) { if (then) then(); return; }
      t.className = "scene-transition play " + (kind || "ink");
      setTimeout(() => { if (then) then(); }, 240);
      setTimeout(() => { t.className = "scene-transition"; }, 720);
    },

    /* =============================================================
       CHARACTER SCENE (sprite + scene + overlays)
       ============================================================= */
    renderScene() {
      const g = State.g; if (!g) return;
      const host = el("char-scene"); if (!host) return;
      const night = (g.age % 4) === 3;
      host.innerHTML =
        `<div class="scene-bg">${Sprite.scene(g.scene || "home", { night })}</div>
         <div class="scene-char" id="scene-char">${Sprite.character(g)}</div>
         <div class="scene-flash" id="scene-flash"></div>
         <div class="scene-transition" id="scene-transition"></div>
         <div class="scene-label">${esc((C.scenes[g.scene] || C.scenes.home).name)}</div>
         ${this.beastBadge()}`;
    },

    beastBadge() {
      const g = State.g;
      if (!g.jinchuriki) return "";                       // never shown before sealing
      const j = g.jinchuriki, b = C.beast(j.beastId);
      if (!b) return "";
      const maxCloak = C.cloakStages.slice().reverse().find(s => j.sync >= s.sync) || C.cloakStages[0];
      return `<div class="beast-badge" title="${esc(b.desc)}">
        <div class="bb-art">${Sprite.beastMini(b)}</div>
        <div class="bb-info">
          <div class="bb-name">${esc(b.name)} <span class="bb-tails">${b.tails}-Tails</span></div>
          <div class="bb-mood mood-${esc(j.mood)}">${esc(j.mood)}</div>
          <div class="bb-meters">
            <span>Trust <b>${Math.round(j.trust)}</b></span>
            <span>Sync <b>${Math.round(j.sync)}</b></span>
          </div>
          <div class="bb-form">${esc(maxCloak.name)}</div>
        </div>
      </div>`;
    },

    /* Growth animation when the sprite changes shape. */
    animateGrowth(kind) {
      const c = el("scene-char");
      if (!c || (State.g && State.g.settings.reducedFX)) return;
      c.classList.remove("grow-pulse", "grow-big");
      void c.offsetWidth;
      c.classList.add(kind === "stage" ? "grow-big" : "grow-pulse");
    },

    /* =============================================================
       HUD + YEAR BAR
       ============================================================= */
    renderHUD() {
      const g = State.g; if (!g) return;
      const v = C.village(g.char.village);
      el("hud-crest").textContent = v.crest;
      el("hud-name").textContent = g.char.name;
      el("hud-sub").textContent = `${State.rankName()} · ${C.stageFor(g.age).name} · ${v.name}`;
      el("hud-age").textContent = g.age;
      el("hud-level").textContent = g.level;
      el("hud-wealth").textContent = g.wealth;
      el("hud-fame").textContent = g.fame;
      el("bar-health").style.width = pct(g.health, g.char.maxHealth) + "%";
      el("bar-chakra").style.width = pct(g.chakra, g.char.maxChakra) + "%";
      el("bar-stamina").style.width = pct(g.stamina, g.char.maxStamina) + "%";

      el("year-stage").textContent = `Age ${g.age} · ${C.stageFor(g.age).name}`;
      const todo = this.pendingHint();
      el("year-hint").textContent = todo;
      el("btn-advance").textContent = Engine.advanceLabel() + " ▸";

      const deAge = el("btn-deage");
      const can = Snap.can() && !g.flags.dead;
      deAge.disabled = !can;
      deAge.title = g.diffCfg.ironman ? "Ironman mode: de-aging is disabled."
        : can ? `Return to age ${Snap.peekAge()}` : "No snapshot yet — advance a year first.";
    },

    pendingHint() {
      const g = State.g;
      if (g.flags.dead) return "Your story has ended.";
      if (g.age >= 6 && g.age <= 11 && !g.academy.enrolled && !g.academy.graduated) return "You are old enough to enrol at the Academy.";
      if (g.academy.enrolled && !g.academy.graduated) {
        const chk = Rules.graduationCheck(g);
        if (chk.eligible) return "You are ready to attempt the graduation exam.";
        return `Academy: ${Math.round(Academy.average())}% marks · ${Math.round(g.academy.attendance)}% attendance`;
      }
      if (g.stamina < 12) return "Low stamina — advance the year to recover.";
      if (C.rankTier(g.rank) >= 2 && g.missionsDone === 0) return "Your first mission is waiting at the Mission Desk.";
      return "Choose activities, then advance the year.";
    },

    /* =============================================================
       TABS
       ============================================================= */
    switchTab(tab) {
      this.tab = tab;
      document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
      document.querySelectorAll(".panel-view").forEach(p => p.classList.remove("active"));
      const p = el("panel-" + tab);
      if (p) p.classList.add("active");
      this.renderPanel(tab);
    },
    renderAll() { this.renderHUD(); this.renderScene(); this.renderPanel(this.tab); },
    renderPanel(tab) {
      const fn = this["panel_" + tab];
      const host = el("panel-" + tab);
      if (fn && host) host.innerHTML = fn.call(this);
    },

    /* =============================================================
       PANELS
       ============================================================= */
    panel_character() {
      const g = State.g, ch = g.char;
      const clan = C.clan(ch.clan), v = C.village(ch.village);
      const bl = ch.bloodline ? C.bloodlines[ch.bloodline] : null;
      const natures = ch.natures.map(n => `<span class="tag nat-${n}">${C.natures[n] ? C.natures[n].icon : ""} ${n}</span>`).join(" ");
      const traits = Personality.top(5);
      const w = g.equipped.weapon ? C.weapon(g.equipped.weapon) : null;
      const arm = g.equipped.armor ? C.gear.find(x => x.id === g.equipped.armor) : null;
      const sum = g.activeSummon ? C.summon(g.activeSummon) : null;
      const bonds = g.relationships.slice().sort((a, b) => Relations.score(b) - Relations.score(a)).slice(0, 4);
      const d = g.dojutsu;
      const dojuLine = d.type
        ? `${C.bloodlines[d.type] ? C.bloodlines[d.type].name : d.type} — ${d.stage === "none" ? "dormant" : (Dojutsu.stageObj() || {}).name || d.stage}${d.active ? " (active)" : ""}${d.damaged ? " · damaged" : ""}`
        : "None";

      return `
      <div class="char-grid">
        <div class="panel char-panel">
          <div class="char-head">
            <h2 class="panel-title">${esc(ch.name)}</h2>
            <span class="badge">${esc(State.rankName())}</span>
          </div>
          <p class="section-note">${C.stageFor(g.age).name} of the ${esc(v.name)} ${v.crest} · ${esc(clan.name)} clan</p>
          <div class="meter-row">
            <div class="meter"><span>Health</span><div class="bar"><i class="health" style="width:${pct(g.health, ch.maxHealth)}%"></i></div><b>${Math.round(g.health)}/${ch.maxHealth}</b></div>
            <div class="meter"><span>Chakra</span><div class="bar"><i class="chakra" style="width:${pct(g.chakra, ch.maxChakra)}%"></i></div><b>${Math.round(g.chakra)}/${ch.maxChakra}</b></div>
            <div class="meter"><span>Stamina</span><div class="bar"><i class="stamina" style="width:${pct(g.stamina, ch.maxStamina)}%"></i></div><b>${Math.round(g.stamina)}/${ch.maxStamina}</b></div>
            <div class="meter"><span>Level ${g.level}</span><div class="bar"><i class="xp" style="width:${pct(g.xp, g.xpNext)}%"></i></div><b>${g.xp}/${g.xpNext}</b></div>
          </div>
        </div>

        <div class="panel">
          <h3 class="panel-title small">Identity</h3>
          <div class="kv"><span class="k">Age / Stage</span><span>${g.age} · ${C.stageFor(g.age).name}</span></div>
          <div class="kv"><span class="k">Rank</span><span>${esc(State.rankName())}</span></div>
          <div class="kv"><span class="k">Clan</span><span>${esc(clan.name)}</span></div>
          <div class="kv"><span class="k">Bloodline</span><span>${bl ? `<span class="tag bloodline">${esc(bl.name)}</span>` : "None"}</span></div>
          <div class="kv"><span class="k">Dojutsu</span><span>${esc(dojuLine)}</span></div>
          <div class="kv"><span class="k">Chakra Natures</span><span>${natures}</span></div>
          <div class="kv"><span class="k">Total Power</span><span>${State.power()}</span></div>
          ${d.type && Dojutsu.awakened() ? `<button class="btn btn-sm btn-block" type="button" onclick="SLS.UI.toggleDojutsu()">${d.active ? "Deactivate" : "Activate"} ${esc((C.bloodlines[d.type] || {}).name || "Dojutsu")}</button>` : ""}
        </div>

        <div class="panel">
          <h3 class="panel-title small">Equipment & Allies</h3>
          <div class="kv"><span class="k">Weapon</span><span>${w ? esc(w.name) + ` <small>(${Math.round(g.weaponMastery[w.id] || 0)}% mastery)</small>` : "None"}</span></div>
          <div class="kv"><span class="k">Armour</span><span>${arm ? esc(arm.name) : "None"}</span></div>
          <div class="kv"><span class="k">Summon</span><span>${sum ? sum.glyph + " " + esc(sum.name) : "None"}</span></div>
          <div class="kv"><span class="k">Squad</span><span>${g.team.length ? g.team.map(id => { const r = Relations.find(id); return r ? esc(r.npc.name) : ""; }).filter(Boolean).join(", ") : "None"}</span></div>
          <div class="kv"><span class="k">Sensei</span><span>${(function () { const s = Relations.find(g.senseiId); return s ? esc(s.npc.name) : "None"; })()}</span></div>
          <div class="kv"><span class="k">Jinchuriki</span><span>${g.jinchuriki ? esc(g.jinchuriki.name) + ` (${g.jinchuriki.tails}-Tails)` : "No"}</span></div>
        </div>

        <div class="panel">
          <h3 class="panel-title small">Academy & Standing</h3>
          ${g.academy.graduated
            ? `<div class="kv"><span class="k">Academy</span><span>Graduated ✓</span></div>`
            : g.academy.enrolled
              ? C.academyTracks.map(t => `<div class="track"><span>${t.name}</span><div class="bar"><i style="width:${g.academy.tracks[t.id] || 0}%"></i></div><b>${Math.round(g.academy.tracks[t.id] || 0)}%</b></div>`).join("")
                + `<div class="track"><span>Attendance</span><div class="bar"><i class="att" style="width:${g.academy.attendance}%"></i></div><b>${Math.round(g.academy.attendance)}%</b></div>`
              : `<div class="kv"><span class="k">Academy</span><span>Not enrolled</span></div>`}
          <div class="kv"><span class="k">Reputation</span><span>${g.reputation}</span></div>
          <div class="kv"><span class="k">Fame</span><span>${g.fame}</span></div>
          <div class="kv"><span class="k">Missions</span><span>${g.missionsDone}</span></div>
          <div class="kv"><span class="k">Achievements</span><span>${Achievements.count()} / ${Achievements.list.length}</span></div>
        </div>

        <div class="panel">
          <h3 class="panel-title small">Personality</h3>
          ${traits.length ? `<div class="trait-row">${traits.map(t => `<span class="tag trait">${esc(t.name)} <b>${Math.round(t.v)}</b></span>`).join("")}</div>
            <p class="section-note">Traits grow from the choices you repeat.</p>`
            : `<p class="empty">No strong traits yet — your choices will shape you.</p>`}
        </div>

        <div class="panel">
          <h3 class="panel-title small">Closest Bonds</h3>
          ${bonds.length ? bonds.map(r => `<div class="kv"><span class="k">${esc(r.npc.name)} <small>(${esc(r.type)})</small></span><span>${Relations.score(r)}</span></div>`).join("")
            : `<p class="empty">No bonds yet.</p>`}
        </div>
      </div>`;
    },

    panel_stats() {
      const g = State.g;
      const rows = [
        ["intelligence", "Intelligence"], ["strength", "Strength"], ["speed", "Speed"],
        ["taijutsu", "Taijutsu"], ["ninjutsu", "Ninjutsu"], ["genjutsu", "Genjutsu"],
        ["weapon", "Weapon Skill"], ["willpower", "Willpower"], ["chakraControl", "Chakra Control"]
      ].map(([k, n]) => {
        const base = g.char.stats[k] || 0, eff = State.stat(k);
        return `<div class="stat-row"><span class="stat-name">${n}</span>
          <span class="stat-bar"><i style="width:${Math.min(100, eff)}%"></i></span>
          <span class="stat-val">${Math.round(eff)}${eff > base ? `<small class="buff">+${Math.round(eff - base)}</small>` : ""}</span></div>`;
      }).join("");
      const em = C.natureList.map(e => {
        const v2 = g.elementMastery[e] || 0;
        return `<div class="stat-row"><span class="stat-name" style="color:${C.natures[e].color}">${C.natures[e].icon} ${e}</span>
          <span class="stat-bar"><i style="width:${v2}%;background:${C.natures[e].color}"></i></span><span class="stat-val">${Math.round(v2)}</span></div>`;
      }).join("");
      const wm = Object.keys(g.weaponMastery || {}).filter(k => g.weaponMastery[k] > 0);
      return `<div class="panel"><h2 class="panel-title">Attributes</h2><div class="stat-list">${rows}</div></div>
        <div class="panel"><h2 class="panel-title">Element Mastery</h2><div class="stat-list">${em}</div></div>
        <div class="panel"><h2 class="panel-title">Weapon Mastery</h2>
          ${wm.length ? wm.map(k => { const w = C.weapon(k); return `<div class="track"><span>${w ? esc(w.name) : k}</span><div class="bar"><i style="width:${g.weaponMastery[k]}%"></i></div><b>${Math.round(g.weaponMastery[k])}%</b></div>`; }).join("")
            : `<p class="empty">No weapon training yet.</p>`}</div>`;
    },

    panel_actions() {
      const g = State.g;
      const avail = Rules.availableActivities(g);
      if (!avail.length) return `<div class="panel"><p class="empty">Nothing to do at this age but grow.</p></div>`;
      const cards = avail.map(a => {
        const r = Rules.activity(a.id, g);
        const locked = !r.ok;
        return `<button class="action-btn${locked ? " locked" : ""}" type="button" ${locked ? "disabled" : ""}
            onclick="SLS.UI.doActivity('${a.id}')" title="${esc(locked ? r.reason : a.desc)}">
          <span class="action-ico">${a.ico}</span>
          <span class="action-name">${esc(a.name)}</span>
          <span class="action-desc">${esc(locked ? r.reason : a.desc)}</span>
          ${a.cost ? `<span class="action-cost">${a.cost} stamina</span>` : `<span class="action-cost free">free</span>`}
        </button>`;
      }).join("");
      const stageNote = C.stageFor(g.age).note;
      return `<div class="panel">
        <h2 class="panel-title">Activities — ${C.stageFor(g.age).name}</h2>
        <p class="section-note">${esc(stageNote)} Stamina <b>${Math.round(g.stamina)}/${g.char.maxStamina}</b>.
          What you may do is limited by your age, rank and training.</p>
        <div class="action-grid">${cards}</div>
      </div>`;
    },

    panel_missions() {
      const g = State.g;
      const gate = Rules.canMission(g);
      if (!gate.ok) {
        return `<div class="panel locked-panel">
          <div class="lock-ico">🔒</div>
          <h2 class="panel-title">Mission Desk</h2>
          <p class="lock-msg">${esc(gate.reason)}</p>
          ${!g.academy.enrolled && !g.academy.graduated && g.age >= 6 && g.age <= 11
            ? `<button class="btn btn-primary" type="button" onclick="SLS.UI.switchTab('actions')">Go enrol at the Academy</button>` : ""}
          ${g.academy.enrolled ? `<p class="section-note">Academy marks ${Math.round(Academy.average())}% · attendance ${Math.round(g.academy.attendance)}%</p>` : ""}
        </div>`;
      }
      const board = Missions.board();
      const cards = board.length ? board.map(m => `
        <div class="list-card">
          <div class="list-head"><span class="list-title">${esc(m.title)}</span><span class="badge rank-${m.rank}">${m.rank}</span></div>
          <div class="list-desc">${m.combat ? "⚔️ Expect combat · " : ""}Difficulty ~${m.power}</div>
          <div class="list-foot"><span class="list-desc">💰 ${m.pay} ryo · ${m.xp} XP</span>
            <button class="btn btn-sm btn-primary" type="button" onclick="SLS.UI.acceptMission('${m.id}')">Accept</button></div>
        </div>`).join("") : `<p class="empty">No missions posted. Check back next year.</p>`;
      return `<div class="panel">
        <div class="row-between"><h2 class="panel-title">Mission Desk</h2>
          <button class="btn btn-sm" type="button" onclick="SLS.Missions.refresh();SLS.UI.renderPanel('missions')">🔄 New Board</button></div>
        <p class="section-note">Completed ${g.missionsDone}. Each mission costs 15 stamina.</p>
        <div class="grid-auto">${cards}</div></div>`;
    },

    _techFilter: "Owned",
    setTechFilter(f) { this._techFilter = f; this.renderPanel("techniques"); },
    panel_techniques() {
      const g = State.g;
      const all = Gen.techniques();
      const filters = ["Owned", "Available", "All"].concat(C.techTypes);
      const frow = filters.map(f => `<button class="chip ${this._techFilter === f ? "selected" : ""}" type="button" onclick="SLS.UI.setTechFilter('${f}')">${f}</button>`).join("");
      let list = all;
      if (this._techFilter === "Owned") list = all.filter(t => g.techniques.indexOf(t.id) !== -1);
      else if (this._techFilter === "Available") list = all.filter(t => g.techniques.indexOf(t.id) === -1 && Techniques.canLearn(t).ok);
      else if (this._techFilter !== "All") list = all.filter(t => t.type === this._techFilter);
      list = list.slice().sort((a, b) => (g.techniques.indexOf(b.id) !== -1) - (g.techniques.indexOf(a.id) !== -1) || a.tier - b.tier).slice(0, 90);

      const cards = list.map(t => {
        const has = g.techniques.indexOf(t.id) !== -1;
        const can = Techniques.canLearn(t);
        const m = g.techMastery[t.id] || 0;
        return `<div class="list-card">
          <div class="list-head"><span class="list-title">${esc(t.name)}</span><span class="badge rank-${t.rank}">${t.rank}</span></div>
          <div class="list-desc">${t.type}${t.element ? ` · <span style="color:${C.natures[t.element].color}">${t.element}</span>` : ""} · ${t.cost} chakra</div>
          ${has ? `<div class="mastery"><i style="width:${m}%"></i></div><div class="list-desc">Mastery ${Math.round(m)}%</div>`
                : `<div class="list-desc">${esc(can.ok ? "Ready to learn" : can.reason)}</div>`}
          <div class="list-foot">
            ${has ? `<span class="badge owned">Learned</span><button class="btn btn-sm" type="button" onclick="SLS.UI.trainTech('${t.id}')">Train</button>`
                  : `<span class="badge ${can.ok ? "" : "locked"}">${can.ok ? "Available" : "Locked"}</span>
                     <button class="btn btn-sm btn-primary" type="button" ${can.ok ? "" : "disabled"} onclick="SLS.UI.learnTech('${t.id}')">Learn</button>`}
          </div></div>`;
      }).join("");
      return `<div class="panel"><h2 class="panel-title">Techniques</h2>
        <p class="section-note">Known ${g.techniques.length} of ${all.length}. Combat jutsu requires Genin rank.</p>
        <div class="filter-row">${frow}</div>
        <div class="grid-auto">${cards || `<p class="empty">Nothing matches this filter.</p>`}</div></div>`;
    },

    panel_bonds() {
      const g = State.g;
      const rels = g.relationships.slice().sort((a, b) => Relations.score(b) - Relations.score(a));
      if (!rels.length) return `<div class="panel"><p class="empty">No bonds yet.</p></div>`;
      const cards = rels.map(r => {
        const m = r.meters;
        const top = C.relMeters.map(k => ({ k, v: m[k] || 0 })).filter(x => Math.abs(x.v) >= 8)
          .sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).slice(0, 4);
        return `<div class="list-card bond-card">
          <div class="list-head">
            <span class="list-title">${esc(r.npc.name)}</span>
            <span class="badge">${esc(r.type)}</span>
          </div>
          <div class="list-desc">${esc(C.clan(r.npc.clan).name)} · ${esc(r.npc.personality)}${r.locked ? ' · <span class="locked-tag">bond scarred</span>' : ""}</div>
          <div class="meter-mini">${top.length ? top.map(x => `<span class="mm ${x.v < 0 ? "neg" : ""}">${x.k} <b>${Math.round(x.v)}</b></span>`).join("") : '<span class="mm">barely acquainted</span>'}</div>
          ${r.memories.length ? `<div class="memories">${r.memories.map(t => `<span class="mem" title="${esc(C.memories[t] || t)}">${esc(C.memories[t] || t)}</span>`).join("")}</div>` : ""}
          <div class="list-foot bond-actions">
            <button class="btn btn-sm" type="button" onclick="SLS.UI.bond('${r.id}','talk')">Talk</button>
            <button class="btn btn-sm" type="button" onclick="SLS.UI.bond('${r.id}','train')">Train</button>
            <button class="btn btn-sm" type="button" onclick="SLS.UI.bond('${r.id}','confide')">Confide</button>
            <button class="btn btn-sm" type="button" onclick="SLS.UI.bond('${r.id}','gift')">Gift 60₽</button>
          </div></div>`;
      }).join("");
      return `<div class="panel"><h2 class="panel-title">Bonds</h2>
        <p class="section-note">Ten meters per person. Betrayal scars a bond permanently — only de-aging can undo it.</p>
        <div class="grid-auto">${cards}</div></div>`;
    },

    panel_inventory() {
      const g = State.g;
      const w = g.equipped.weapon ? C.weapon(g.equipped.weapon) : null;
      const a = g.equipped.armor ? C.gear.find(x => x.id === g.equipped.armor) : null;
      const counts = {};
      g.inventory.forEach(id => counts[id] = (counts[id] || 0) + 1);
      const items = Object.keys(counts).map(id => {
        const it = Shop.item(id); if (!it) return "";
        const can = Rules.canEquip(id, g);
        const isGear = !it.consumable;
        return `<div class="list-card">
          <div class="list-head"><span class="list-title">${esc(it.name)}${counts[id] > 1 ? ` ×${counts[id]}` : ""}</span><span class="badge">${it.type}</span></div>
          <div class="list-desc">${esc(it.desc || "")}</div>
          <div class="list-desc">${it.dmg ? `Damage ${it.dmg} · ` : ""}${it.def ? `Defence ${it.def} · ` : ""}${it.minAge ? `Age ${it.minAge}+ · ` : ""}${it.minRank ? C.rank(it.minRank).name : ""}</div>
          <div class="list-foot">
            <span class="badge ${isGear && !can.ok ? "locked" : ""}">${isGear ? (can.ok ? "Usable" : esc(can.reason)) : "Consumable"}</span>
            <button class="btn btn-sm btn-primary" type="button" ${isGear && !can.ok ? "disabled" : ""} onclick="SLS.UI.useItem('${id}')">${isGear ? "Equip" : "Use"}</button>
          </div></div>`;
      }).join("");
      return `<div class="panel"><h2 class="panel-title">Equipped</h2>
          <div class="kv"><span class="k">Weapon</span><span>${w ? esc(w.name) : "None"} ${w ? `<button class="btn btn-sm" type="button" onclick="SLS.UI.unequip('weapon')">Remove</button>` : ""}</span></div>
          <div class="kv"><span class="k">Armour</span><span>${a ? esc(a.name) : "None"} ${a ? `<button class="btn btn-sm" type="button" onclick="SLS.UI.unequip('armor')">Remove</button>` : ""}</span></div>
        </div>
        <div class="panel"><h2 class="panel-title">Pack (${g.inventory.length})</h2>
        <div class="grid-auto">${items || `<p class="empty">Your pack is empty.</p>`}</div></div>`;
    },

    panel_market() {
      const g = State.g;
      const cards = Shop.catalog().map(it => {
        const can = Rules.canBuy(it.id, g);
        return `<div class="list-card">
          <div class="list-head"><span class="list-title">${esc(it.name)}</span><span class="badge">${it.type}</span></div>
          <div class="list-desc">${esc(it.desc || "")}</div>
          <div class="list-desc">${it.minAge ? `Age ${it.minAge}+` : "Any age"}${it.minRank && it.minRank !== "civilian" ? ` · ${C.rank(it.minRank).name}+` : ""}${it.str ? ` · ${it.str} strength` : ""}</div>
          <div class="list-foot"><span class="list-desc">💰 ${it.price}</span>
            <button class="btn btn-sm btn-primary" type="button" ${can.ok ? "" : "disabled"} title="${esc(can.ok ? "" : can.reason)}" onclick="SLS.UI.buy('${it.id}')">Buy</button></div>
        </div>`;
      }).join("");
      return `<div class="panel"><h2 class="panel-title">Market District</h2>
        <p class="section-note">Your ryo: <b>${g.wealth}</b>. Shopkeepers will not sell weapons to children.</p>
        <div class="grid-auto">${cards}</div></div>`;
    },

    panel_summons() {
      const g = State.g;
      if (C.rankTier(g.rank) < 2) {
        return `<div class="panel locked-panel"><div class="lock-ico">🔒</div><h2 class="panel-title">Summoning</h2>
          <p class="lock-msg">Summoning contracts are found in the world — and only a full ninja may sign one.</p></div>`;
      }
      const contracts = g.summonContracts.map(c => {
        const s = C.summon(c.id);
        return `<div class="list-card">
          <div class="list-head"><span class="list-title">${s.glyph} ${esc(s.name)}</span>
            <span class="badge">${g.activeSummon === c.id ? "Active" : c.stage}</span></div>
          <div class="list-desc">${esc(s.desc)}</div>
          <div class="track"><span>Bond</span><div class="bar"><i style="width:${c.bond}%"></i></div><b>${Math.round(c.bond)}%</b></div>
          <div class="track"><span>Mastery</span><div class="bar"><i style="width:${c.mastery}%"></i></div><b>${Math.round(c.mastery)}%</b></div>
          <div class="list-foot">
            <button class="btn btn-sm" type="button" onclick="SLS.UI.setSummon('${c.id}')">${g.activeSummon === c.id ? "Dismiss" : "Set active"}</button>
            <button class="btn btn-sm btn-primary" type="button" onclick="SLS.UI.trainSummon()">Train bond</button>
          </div></div>`;
      }).join("");
      const jin = g.jinchuriki ? this.jinchurikiCard() : "";
      return `<div class="panel"><h2 class="panel-title">Summoning Contracts</h2>
        <p class="section-note">Contracts are discovered by exploring, not bought.</p>
        <div class="grid-auto">${contracts || `<p class="empty">No contracts yet. Explore shrines and the deep forest.</p>`}</div></div>${jin}`;
    },

    jinchurikiCard() {
      const g = State.g, j = g.jinchuriki, b = C.beast(j.beastId);
      const stages = C.cloakStages.map(s => {
        const unlocked = j.sync >= s.sync;
        return `<button class="chip ${j.cloak === s.id ? "selected" : ""}" type="button" ${unlocked ? "" : "disabled"}
          title="${unlocked ? "" : `Requires ${s.sync}% sync`}" onclick="SLS.UI.setCloak('${s.id}')">${esc(s.name)}</button>`;
      }).join("");
      return `<div class="panel beast-panel">
        <h2 class="panel-title">${b.glyph} ${esc(b.name)} — the ${b.tails}-Tails</h2>
        <p class="section-note">${esc(b.desc)} Currently <b>${esc(j.mood)}</b>.</p>
        <div class="track"><span>Trust</span><div class="bar"><i style="width:${j.trust}%"></i></div><b>${Math.round(j.trust)}%</b></div>
        <div class="track"><span>Anger</span><div class="bar"><i class="anger" style="width:${j.anger}%"></i></div><b>${Math.round(j.anger)}%</b></div>
        <div class="track"><span>Synchronisation</span><div class="bar"><i class="xp" style="width:${j.sync}%"></i></div><b>${Math.round(j.sync)}%</b></div>
        <p class="section-note">Transformation</p>
        <div class="filter-row">${stages}</div>
        <div class="bond-actions">
          <button class="btn btn-sm" type="button" onclick="SLS.UI.commune('talk')">Speak with it</button>
          <button class="btn btn-sm" type="button" onclick="SLS.UI.commune('meditate')">Synchronise</button>
          <button class="btn btn-sm" type="button" onclick="SLS.UI.commune('demand')">Demand power</button>
        </div></div>`;
    },

    panel_village() {
      const g = State.g;
      const nodes = [
        { ico: "🏠", name: "Home", sub: "Family and rest", scene: "home", tab: "actions" },
        { ico: "🏫", name: "Academy", sub: g.academy.graduated ? "Where it started" : "Lessons and exams", scene: "classroom", tab: "actions" },
        { ico: "🌲", name: "Training Field", sub: "Chakra and conditioning", scene: "field", tab: "actions" },
        { ico: "🎯", name: "Throwing Range", sub: "Precision drills", scene: "range", tab: "actions" },
        { ico: "🏪", name: "Market", sub: "Weapons and supplies", scene: "village", tab: "market" },
        { ico: "🏯", name: "Mission Desk", sub: C.rankTier(g.rank) >= 2 ? "Take a mission" : "Genin only", scene: "village", tab: "missions" },
        { ico: "⛩️", name: "Village Gate", sub: C.rankTier(g.rank) >= 2 ? "Leave and explore" : "Closed to children", scene: "forest", tab: "actions" },
        { ico: "📜", name: "Hall of Records", sub: "Techniques", scene: "classroom", tab: "techniques" }
      ].map(n => `<button class="map-node" type="button" onclick="SLS.UI.goPlace('${n.scene}','${n.tab}')">
          <div class="map-ico">${n.ico}</div><div class="map-name">${esc(n.name)}</div><div class="map-sub">${esc(n.sub)}</div>
        </button>`).join("");
      return `<div class="panel"><h2 class="panel-title">${esc(C.village(g.char.village).name)} ${C.village(g.char.village).crest}</h2>
        <p class="section-note">Move around the village — the scene behind your character changes with you.</p>
        <div class="map-grid">${nodes}</div></div>`;
    },

    panel_timeline() {
      const g = State.g;
      const items = g.timeline.slice().reverse().map(t =>
        `<div class="tl-item"><div class="tl-age">Age ${t.age}</div><div class="tl-text">${esc(t.text)}</div></div>`).join("");
      return `<div class="panel"><h2 class="panel-title">Life Timeline</h2>
        <div class="timeline">${items || `<p class="empty">Your story begins…</p>`}</div></div>`;
    },

    panel_journal() {
      const g = State.g;
      const entries = g.journal.map(j =>
        `<div class="journal-entry ${j.kind || ""}"><span class="journal-age">Age ${j.age}</span> ${esc(j.text)}</div>`).join("");
      const achs = Achievements.list.map(a => {
        const un = g.achievements[a.id];
        if (a.hidden && !un) return `<div class="ach legendary"><div class="ach-name">🔒 ???</div><div class="ach-desc">Hidden legendary achievement.</div></div>`;
        return `<div class="ach ${un ? "unlocked" : ""} ${a.legendary ? "legendary" : ""}">
          <div class="ach-name">${un ? "🏅" : "🔒"} ${esc(a.name)}</div><div class="ach-desc">${esc(a.desc)}</div></div>`;
      }).join("");
      return `<div class="panel"><h2 class="panel-title">Journal</h2>
          <div class="scroll-box">${entries || `<p class="empty">Nothing written yet.</p>`}</div></div>
        <div class="panel"><h2 class="panel-title">Achievements (${Achievements.count()}/${Achievements.list.length})</h2>
          <div class="ach-grid">${achs}</div></div>`;
    },

    panel_settings() {
      const g = State.g, s = g.settings;
      const sw = (key, label, note) => `<div class="setting-row"><span>${label}${note ? `<small>${note}</small>` : ""}</span>
        <label class="switch"><input type="checkbox" ${s[key] ? "checked" : ""} onchange="SLS.UI.setSetting('${key}', this.checked)"><span class="slider"></span></label></div>`;
      return `<div class="panel"><h2 class="panel-title">Settings</h2>
          ${sw("autosave", "Autosave")}
          ${sw("sound", "Sound", "ready for future audio")}
          ${sw("reducedFX", "Reduced motion", "fewer animations")}
        </div>
        <div class="panel"><h2 class="panel-title">Minigame Accessibility</h2>
          ${sw("slowMinigames", "Slow mode", "40% slower timing")}
          ${sw("wideWindows", "Wider timing windows", "much more forgiving")}
          ${sw("autoMinigames", "Automatic mode", "skip play, reduced rewards")}
        </div>
        <div class="panel"><h2 class="panel-title">Save Data</h2>
          <p class="section-note">Difficulty: <b>${g.diffCfg.name}</b>${g.diffCfg.ironman ? " — de-aging disabled" : ""}.
            Snapshots stored: <b>${g.snapshots.length}</b>/${Snap.MAX}.</p>
          <div class="chip-row">
            <button class="btn btn-sm" type="button" onclick="SLS.UI.doExport()">📤 Export</button>
            <button class="btn btn-sm" type="button" onclick="SLS.UI.doImport()">📥 Import</button>
            <button class="btn btn-sm" type="button" onclick="SLS.Save.save();SLS.UI.toast('Saved','Progress stored.','good')">💾 Save now</button>
          </div>
          <div class="setting-row"><span style="color:var(--bad)">Abandon this life</span>
            <button class="btn btn-sm danger" type="button" onclick="SLS.UI.hardReset()">Reset</button></div>
        </div>`;
    },

    /* =============================================================
       ACTIONS / HANDLERS
       ============================================================= */
    doActivity(id) {
      const a = C.activities.find(x => x.id === id);
      const g = State.g;
      const changeScene = a && a.scene && a.scene !== g.scene;
      const run = () => {
        Engine.doActivity(id, (res) => {
          this.renderAll();
          if (res && res.text) this.toast(a.name, res.text.slice(0, 90), "");
        });
      };
      if (changeScene) this.transition(RNG.pick(["ink", "leaves", "smoke"]), run);
      else run();
    },
    goPlace(scene, tab) {
      State.g.scene = scene;
      this.transition("ink", () => { this.renderScene(); this.switchTab(tab); });
    },
    acceptMission(id) { Missions.accept(id, () => this.renderAll()); },
    learnTech(id) { const r = Techniques.learn(id); if (!r.ok) this.toast("Cannot learn", r.reason, "bad"); else this.toast("Technique learned", r.tech.name, "good"); this.renderAll(); },
    trainTech(id) { const r = Techniques.train(id); if (!r.ok) this.toast("Cannot train", r.reason, "bad"); this.renderAll(); },
    buy(id) { const r = Shop.buy(id); if (!r.ok) this.toast("Cannot buy", r.reason, "bad"); else this.toast("Purchased", r.learned ? "Learned " + r.learned.name : r.item.name, "good"); this.renderAll(); },
    useItem(id) { const r = Shop.use(id); if (!r.ok) this.toast("Cannot use", r.reason, "bad"); this.renderAll(); },
    unequip(slot) { Shop.unequip(slot); this.renderAll(); },
    bond(id, mode) { const r = Relations.interact(id, mode); if (!r.ok) this.toast("Not now", r.reason, "bad"); else this.toast("Bond", r.text.slice(0, 80), "good"); this.renderAll(); },
    setSummon(id) { Summons.setActive(State.g.activeSummon === id ? null : id); this.renderAll(); },
    trainSummon() { const r = Summons.train(); if (!r.ok) this.toast("Cannot train", r.reason, "bad"); this.renderAll(); },
    commune(mode) { const r = Beasts.commune(mode); if (!r.ok) this.toast("Not now", r.reason, "bad"); else this.toast("Tailed Beast", r.text, ""); this.renderAll(); },
    setCloak(id) { const r = Beasts.setCloak(id); if (!r.ok && r.reason) this.toast("Refused", r.reason, "bad"); this.renderAll(); },
    toggleDojutsu() { const r = Dojutsu.toggle(); if (!r.ok) this.toast("Cannot", r.reason, "bad"); this.renderAll(); },
    setSetting(k, v) { State.g.settings[k] = v; Save.autosave(); if (k === "reducedFX") this.renderScene(); },

    /* =============================================================
       COMBAT UI
       ============================================================= */
    combat(c) {
      const p = c.player, e = c.enemy;
      const bar = (cur, max, cls) => `<div class="mini-bar ${cls}"><i style="width:${pct(cur, max)}%"></i></div>`;
      const g = State.g;
      const canTeam = g.team.length > 0, canSummon = !!g.activeSummon;
      const actions = c.over ? "" : `<div class="combat-actions">
          <button class="btn" type="button" onclick="SLS.Combat.player('attack')">⚔️ Attack</button>
          <button class="btn" type="button" onclick="SLS.Combat.player('chakra')">🌀 Jutsu (18)</button>
          <button class="btn" type="button" onclick="SLS.Combat.player('dodge')">💨 Dodge</button>
          <button class="btn" type="button" onclick="SLS.Combat.player('counter')">🛡️ Counter</button>
          <button class="btn" type="button" onclick="SLS.Combat.player('defend')">🧱 Defend</button>
          ${canTeam ? `<button class="btn" type="button" onclick="SLS.Combat.player('team')">👥 Team</button>` : ""}
          ${canSummon ? `<button class="btn" type="button" onclick="SLS.Combat.player('summon')">🐾 Summon</button>` : ""}
          <button class="btn btn-gold" type="button" onclick="SLS.Combat.player('ultimate')">💥 Ultimate ${p.charge}%</button>
          <button class="btn btn-ghost" type="button" onclick="SLS.Combat.flee()">🏃 Flee</button>
        </div>`;
      this.modal(`<div class="combat">
        <div class="combat-arena">
          <div class="fighter" id="combat-player">
            <div class="f-ava">${p.glyph}</div><div class="f-name">${esc(p.name)}</div>
            <div class="f-bars">${bar(p.hp, p.maxHp, "hp")}${bar(p.cp, p.maxCp, "cp")}
              <div class="f-sub">Charge ${p.charge}%</div></div>
          </div>
          <div class="vs">VS</div>
          <div class="fighter">
            <div class="f-ava">${e.glyph}</div><div class="f-name">${esc(e.name)}${e.boss ? " 👑" : ""}</div>
            <div class="f-bars">${bar(e.hp, e.maxHp, "hp")}${bar(e.cp, e.maxCp, "cp")}
              <div class="f-sub">${esc(e.ai)} AI</div></div>
          </div>
        </div>
        <div class="combat-log">${c.log.map(l => `<p>${l}</p>`).join("")}</div>
        ${actions}</div>`, true);
    },
    combatEnd(win, cb) {
      const body = el("modal-body"); if (!body) { cb(); return; }
      const d = document.createElement("div");
      d.className = "modal-choices";
      d.innerHTML = `<button class="btn btn-primary btn-block" type="button">${win ? "Victory" : "Continue"}</button>`;
      d.querySelector("button").onclick = () => { this.closeModal(); cb(); };
      body.appendChild(d);
    },

    /* =============================================================
       FLOWS
       ============================================================= */
    sceneEvent(title, text, onDone) {
      this.modal(`<h2 class="modal-title">${title}</h2><p class="modal-text">${esc(text)}</p>
        <div class="modal-choices"><button class="btn btn-primary btn-block" type="button"
          onclick="SLS.UI.closeModal(); SLS.UI.renderAll(); SLS.UI._resume();">Continue</button></div>`);
      this._resumeFn = onDone;
    },
    _resume() { const f = this._resumeFn; this._resumeFn = null; if (f) f(); },

    /* --- Graduation --- */
    graduationFlow(onDone) {
      const g = State.g;
      const chk = Rules.graduationCheck(g);
      if (!chk.eligible) { this.toast("Not eligible", chk.reason, "bad"); if (onDone) onDone(); return; }
      g.scene = "arena";
      this.renderScene();
      this.modal(`<h2 class="modal-title">🎓 Graduation Exam</h2>
        <p class="modal-text">Two parts: a written paper, then the practical — clone and transformation under the instructor's eye.${chk.prodigy ? "<br><b>You are sitting this early, as a prodigy.</b>" : ""}</p>
        <div class="modal-choices">
          <button class="btn btn-primary btn-block" type="button" onclick="SLS.UI._doExam()">Begin the exam</button>
          <button class="btn btn-ghost btn-block" type="button" onclick="SLS.UI.closeModal();SLS.UI.renderAll();SLS.UI._resume();">Not this year</button>
        </div>`);
      this._resumeFn = onDone;
    },
    _doExam() {
      const r = Academy.attemptExam();
      if (!r.ok) { this.toast("Not eligible", r.reason, "bad"); this.closeModal(); this._resume(); return; }
      if (r.passed) {
        const g = State.g;
        g.flags.gradAge = g.age;
        const out = Academy.graduate();
        Achievements.check();
        this.renderScene();
        this.animateGrowth("stage");
        this.modal(`<h2 class="modal-title">🎓 You are a Genin</h2>
          <div class="grad-scene">
            <div class="grad-band">🎽</div>
            <p class="modal-text">Written <b>${r.written}</b> · Practical <b>${r.practical}</b>${r.mercy ? " <small>(your teacher vouched for you)</small>" : ""}</p>
            <p class="modal-text">You are handed a forehead protector bearing the mark of your village. It is heavier than you expected.</p>
            <ul class="reward-list">
              <li>Rank: <b>Genin</b> — missions unlocked</li>
              <li>Forehead protector equipped</li>
              <li>Squad: ${out.mates.map(m => esc(m.npc.name)).join(" & ")}</li>
              <li>Sensei: ${esc(out.sensei.npc.name)}</li>
              <li>Kunai and shuriken issued</li>
            </ul>
          </div>
          <div class="modal-choices"><button class="btn btn-primary btn-block" type="button"
            onclick="SLS.UI.closeModal(); SLS.UI.renderAll(); SLS.UI._resume();">Take the headband</button></div>`, true);
      } else {
        const fail = !r.writtenPass && !r.practicalPass ? "Both halves went badly."
          : !r.writtenPass ? "You failed the written paper." : "Your clones came out wrong.";
        Log.line(`Failed the graduation exam. ${fail}`, "bad");
        this.modal(`<h2 class="modal-title">Not this year</h2>
          <p class="modal-text">${esc(fail)} Written <b>${r.written}</b> · Practical <b>${r.practical}</b>.</p>
          <p class="modal-text">You remain an Academy Student. You may try again next year.</p>
          <div class="modal-choices"><button class="btn btn-primary btn-block" type="button"
            onclick="SLS.UI.closeModal(); SLS.UI.renderAll(); SLS.UI._resume();">Keep training</button></div>`);
      }
    },

    /* --- Exploration --- */
    exploreFlow(onDone) {
      const deep = C.rankTier(State.g.rank) >= 4 && RNG.chance(0.4);
      const r = Explore.begin(deep);
      if (!r.ok) { this.toast("Cannot leave", r.reason, "bad"); if (onDone) onDone(); return; }
      this._resumeFn = onDone;
      this.renderScene();
      const enc = r.enc;
      const opts = Explore.options(enc);
      this.modal(`<h2 class="modal-title">${enc.glyph} ${esc(enc.name)}</h2>
        <p class="modal-text">${esc(enc.text)}</p>
        <div class="modal-choices">${opts.map((o, i) =>
          `<button class="choice-btn" type="button" onclick="SLS.UI._encChoose(${i})">${esc(o.label)}</button>`).join("")}</div>
        ${opts.length < enc.options.length ? `<p class="mg-hint">Some options are closed to you at your age and rank.</p>` : ""}`);
      this._enc = enc;
    },
    _encChoose(i) {
      const enc = this._enc;
      this.closeModal();
      Explore.choose(enc, i, (res) => {
        if (res && res.beast) { this.beastFlow(res.beast); return; }
        if (res && res.text) this.sceneEvent(enc.glyph + " " + enc.name, res.text, () => { this.renderAll(); this._resume(); });
        else { this.renderAll(); this._resume(); }
      });
    },

    /* --- Social --- */
    socialFlow(onDone) {
      const g = State.g;
      const existing = g.relationships.filter(r => r.type !== "Tailed Beast" && r.type !== "Summon");
      this._resumeFn = onDone;
      this.modal(`<h2 class="modal-title">🤝 Build Bonds</h2>
        <p class="modal-text">Who do you spend your time with?</p>
        <div class="modal-choices">
          <button class="choice-btn" type="button" onclick="SLS.UI._socialNew()">Meet someone new<span class="choice-sub">A stranger becomes an acquaintance</span></button>
          ${existing.slice(0, 6).map(r => `<button class="choice-btn" type="button" onclick="SLS.UI._socialWith('${r.id}')">${esc(r.npc.name)}<span class="choice-sub">${esc(r.type)} · bond ${Relations.score(r)}</span></button>`).join("")}
        </div>`);
    },
    _socialNew() { const r = Relations.meetNew(); this.closeModal(); this.sceneEvent("🤝 A New Face", `You meet ${r.npc.name}, a ${r.type.toLowerCase()} from the ${C.clan(r.npc.clan).name} line.`, () => { this.renderAll(); this._resume(); }); },
    _socialWith(id) { const r = Relations.interact(id, "talk"); this.closeModal(); this.sceneEvent("🤝 Time Together", r.ok ? r.text : r.reason, () => { this.renderAll(); this._resume(); }); },

    /* --- Tailed beast encounter --- */
    beastFlow(beast) {
      const g = State.g;
      Beasts.encounter(beast);
      this.renderScene();
      const canSeal = C.rankTier(g.rank) >= 3 || g.flags.sealingStudy || g.char.bloodline === "sealing";
      this.modal(`<h2 class="modal-title">${beast.glyph} ${esc(beast.name)}</h2>
        <p class="modal-text">${esc(beast.desc)} The ${beast.tails}-Tails regards you with something between contempt and curiosity.</p>
        <p class="modal-text"><b>Finding it does not make you its host.</b> What do you do?</p>
        <div class="modal-choices">
          <button class="choice-btn" type="button" onclick="SLS.UI._beastAct('speak')">Speak to it<span class="choice-sub">Beasts are people, not weapons</span></button>
          <button class="choice-btn" type="button" onclick="SLS.UI._beastAct('observe')">Observe from cover<span class="choice-sub">Learn without being seen</span></button>
          <button class="choice-btn" type="button" onclick="SLS.UI._beastAct('help')">Help it<span class="choice-sub">It is in pain</span></button>
          <button class="choice-btn" type="button" onclick="SLS.UI._beastAct('alert')">Alert the village<span class="choice-sub">Let the Kage decide</span></button>
          <button class="choice-btn" type="button" onclick="SLS.UI._beastAct('fight')">Fight it<span class="choice-sub">Almost certainly fatal</span></button>
          ${canSeal ? `<button class="choice-btn" type="button" onclick="SLS.UI._beastAct('seal')">Attempt a sealing<span class="choice-sub">Extremely dangerous</span></button>` : ""}
          <button class="choice-btn" type="button" onclick="SLS.UI._beastAct('run')">Run<span class="choice-sub">Live to tell it</span></button>
        </div>`, true);
      this._beast = beast;
    },
    _beastAct(act) {
      const beast = this._beast, g = State.g;
      this.closeModal();
      const finish = (title, text) => this.sceneEvent(title, text, () => { this.renderAll(); this._resume(); });

      if (act === "run") { Personality.add("calm", 1); return finish("You run", `You put every tree you can between yourself and ${beast.name}. It does not follow.`); }
      if (act === "observe") {
        State.gainStat("intelligence", 2); g.flags.chasingRumour = false;
        return finish("You watch", `You study ${beast.name} from cover and learn more about tailed-beast chakra than any scroll could teach.`);
      }
      if (act === "alert") {
        State.addRep(8); Personality.add("loyal", 2);
        return finish("You report it", `The village mobilises. ${beast.name} is driven off, and your name is mentioned in the Kage's office.`);
      }
      if (act === "speak") {
        const kind = Personality.value("kind");
        if (RNG.chance(0.35 + kind * 0.03)) {
          g.flags.beastFriend = beast.id;
          Personality.add("brave", 2);
          return finish("It answers", `${beast.name} speaks. It does not thank you, and it does not attack. Something has begun.`);
        }
        return finish("No answer", `${beast.name} looks through you as though you were weather, and leaves.`);
      }
      if (act === "help") {
        Personality.add("kind", 3); Personality.add("brave", 2);
        if (RNG.chance(0.4)) {
          const r = Beasts.becomeHost(beast, "saved");
          this.renderScene();
          return finish("A willing bond", `You free ${beast.name} from the seal-chains binding it. Rather than flee, it chooses you as its host. You are a Jinchuriki — by consent, not capture.`);
        }
        return finish("It leaves", `You cut the last chain. ${beast.name} looks at you for a long moment, then vanishes into the treeline.`);
      }
      if (act === "fight") {
        const foe = Combat.makeBeastFoe(beast);
        Combat.start(foe, { boss: true, forced: false }, (res) => {
          if (res.blocked) { this.renderAll(); this._resume(); return; }
          if (res.win) {
            g.bossesBeaten++; State.gainXP(foe.xp); g.fame += 20; State.addRep(15);
            Achievements.check();
            finish("Impossible", `You have done something no Genin should survive. ${beast.name} withdraws, wounded and furious.`);
          } else {
            State.damage(Math.round(g.char.maxHealth * 0.4));
            finish("Crushed", `${beast.name} swats you aside like an insect. You wake up two days later.`);
          }
        });
        return;
      }
      if (act === "seal") {
        const r = Beasts.attemptSeal(beast, "sealed");
        this.renderScene();
        if (r.ok) return finish("Sealed", `Against every odd, the seal takes. ${beast.name} is inside you now — and it is screaming.`);
        return finish("The seal fails", r.reason);
      }
      this.renderAll(); this._resume();
    },

    /* --- Life events --- */
    eventFlow(ev, onDone) {
      this._resumeFn = onDone;
      this._event = ev;
      this.modal(`<h2 class="modal-title">${esc(ev.title)}</h2>
        <p class="modal-text">${esc(ev.text)}</p>
        ${ev.irreversible ? `<p class="warn-line">⚑ This choice is permanent. Only de-aging can undo it.</p>` : ""}
        <div class="modal-choices">${ev.choices.map((c, i) =>
          `<button class="choice-btn" type="button" onclick="SLS.UI._eventChoose(${i})">${esc(c.label)}</button>`).join("")}</div>`);
    },
    _eventChoose(i) {
      const ev = this._event;
      const res = Engine.applyEventChoice(ev, i);
      this.closeModal();
      if (res && res.combat) {
        const enemy = Combat.makeEnemy(Math.max(2, State.g.level + 1), res.combat);
        Combat.start(enemy, {}, (r) => {
          if (r.win) { State.gainXP(40); State.addRep(3); Log.line("You won your first real fight.", "good"); }
          this.renderAll(); this._resume();
        });
        return;
      }
      this.renderAll();
      this._resume();
    },

    /* --- Ending --- */
    ending(e) {
      const g = State.g;
      const rows = [
        ["Final Rank", State.rankName()], ["Age", g.age], ["Level", g.level],
        ["Missions", g.missionsDone], ["Techniques", g.techniques.length],
        ["Bonds", g.relationships.length], ["Fame", g.fame], ["Reputation", g.reputation],
        ["Power", State.power()], ["Achievements", `${Achievements.count()} / ${Achievements.list.length}`]
      ].map(([k, v]) => `<div class="kv"><span class="k">${k}</span><span>${v}</span></div>`).join("");
      this.modal(`<h2 class="modal-title">${e.ico} ${esc(e.name)}</h2>
        <p class="modal-text">${esc(e.text)}</p>
        <div class="info-card"><h4>${esc(g.char.name)}</h4>${rows}</div>
        <div class="modal-choices">
          ${Snap.can() ? `<button class="btn btn-block" type="button" onclick="SLS.UI.deAge(true)">↺ Turn back the final year</button>` : ""}
          <button class="btn btn-primary btn-block" type="button" onclick="SLS.UI.newLife()">Begin a New Life</button>
        </div>`, true);
    },

    /* =============================================================
       ADVANCE / DE-AGE
       ============================================================= */
    advanceYear() {
      const g = State.g;
      if (!g || g.flags.dead) return;
      const before = g.stageId;
      Engine.advanceYear((res) => {
        this.transition("leaves", () => {
          this.renderScene();
          this.animateGrowth(res.stageChanged ? "stage" : "year");
          this.renderHUD();
          this.renderPanel(this.tab);
          if (res.stageChanged) this.toast("You grew", `You are now a ${C.stageFor(g.age).name}.`, "legendary");
          this._pendingQueue = res.queue || [];
          this.drainQueue();
        });
      });
    },
    drainQueue() {
      const next = this._pendingQueue.shift();
      const finish = () => {
        const ending = Engine.postYear();
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
        <p class="section-note">You will return to <b>age ${target}</b>. This includes money, items, techniques, achievements, missions, summons, bonds and story choices.</p>
        <div class="modal-choices">
          <button class="btn btn-primary btn-block" type="button" onclick="SLS.UI._doDeAge()">Yes, turn back the year</button>
          <button class="btn btn-ghost btn-block" type="button" onclick="SLS.UI.closeModal()${fromEnding ? ";SLS.UI.ending(SLS.Endings.types[SLS.Endings.decide()])" : ""}">Cancel</button>
        </div>`);
    },
    _doDeAge() {
      if (Snap.restore()) {
        this.closeModal();
        this.transition("scroll", () => {
          this.renderAll();
          this.animateGrowth("stage");
          this.toast("Year undone", `You are ${State.g.age} again.`, "legendary");
        });
      } else {
        this.closeModal();
        this.toast("Failed", "No snapshot available.", "bad");
      }
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
        <div class="modal-choices">
          <button class="btn btn-primary btn-block" type="button" onclick="SLS.UI._confirmImport()">Import</button>
          <button class="btn btn-ghost btn-block" type="button" onclick="SLS.UI.closeModal()">Cancel</button></div>`);
    },
    _confirmImport() {
      const v = el("import-box").value;
      if (Save.import(v)) { Save.save(); this.closeModal(); Game.enterGame(); this.toast("Imported", "Save restored.", "good"); }
      else this.toast("Invalid code", "Could not import that save.", "bad");
    },
    hardReset() {
      this.modal(`<h2 class="modal-title">Abandon this life?</h2>
        <p class="modal-text">This permanently deletes your current shinobi.</p>
        <div class="modal-choices">
          <button class="btn btn-block danger" type="button" onclick="SLS.Save.wipe();location.reload()">Yes, start over</button>
          <button class="btn btn-ghost btn-block" type="button" onclick="SLS.UI.closeModal()">Cancel</button></div>`);
    },
    newLife() { Save.wipe(); location.reload(); }
  };
  SLS.UI = UI;

  /* =================================================================
     GAME — character creation & bootstrap
     ================================================================= */
  const Game = {
    rolled: null, village: null, difficulty: "normal",

    init() {
      this.registerSW();
      this.wire();
      const saved = Save.load();
      if (saved) {
        UI.loading("load", () => {
          State.g = saved;
          this.enterGame();
          UI.toast("Welcome back", `${saved.char.name}, age ${saved.age}`, "good");
        });
      } else {
        UI.loading("boot", () => { el("screen-creation").classList.add("active"); this.buildCreation(); });
      }
    },

    registerSW() {
      if (!("serviceWorker" in navigator)) return;
      if (location.protocol !== "http:" && location.protocol !== "https:") return;
      window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => { }); });
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
      const nameInput = el("input-name");
      this.rolled = Gen.character(v, (nameInput.value || "").trim(), {});
      this.renderPreview();
    },
    renderPreview() {
      const c = this.rolled; if (!c) return;
      const clan = C.clan(c.clan);
      const bl = c.bloodline ? C.bloodlines[c.bloodline] : null;
      // Preview uses the real sprite renderer at newborn proportions.
      const fake = { char: c, stageId: "newborn", age: 0, rank: "civilian", equipped: {}, dojutsu: { type: c.dojutsuType, stage: "none", active: false }, jinchuriki: null, activeSummon: null, scars: 0 };
      el("creation-sprite").innerHTML = Sprite.character(fake);
      const rare = ["uchiha", "hyuga", "senju", "uzumaki", "kaguya", "yuki"].indexOf(clan.id) !== -1;
      el("creation-preview").innerHTML = `
        <div class="preview-line"><span class="pl-key">Clan</span><span class="pl-val">${rare ? `<span class="tag rare">${clan.name}</span>` : clan.name}</span></div>
        <div class="preview-line"><span class="pl-key">Bloodline</span><span class="pl-val">${bl ? `<span class="tag bloodline">✦ ${bl.name}</span>` : "None"}</span></div>
        <div class="preview-line"><span class="pl-key">Chakra Nature</span><span class="pl-val">${c.natures.map(n => `<span class="tag nat-${n}">${C.natures[n].icon} ${n}</span>`).join(" ")}</span></div>
        <div class="preview-line"><span class="pl-key">Chakra Reserves</span><span class="pl-val">${c.maxChakra}</span></div>
        <div class="preview-line"><span class="pl-key">Health</span><span class="pl-val">${c.maxHealth}</span></div>
        <div class="preview-line"><span class="pl-key">Family</span><span class="pl-val">${c.family.heritage} · ${c.family.siblings} sibling(s)</span></div>
        ${bl ? `<p class="section-note">${esc(bl.desc)}</p>` : ""}`;
    },

    wire() {
      el("btn-reroll").addEventListener("click", () => { if (!this.village) this.village = RNG.pick(C.villages).id; this.reroll(); });
      el("input-name").addEventListener("input", () => { if (this.rolled) this.rolled.name = el("input-name").value.trim() || this.rolled.name; });
      el("btn-begin").addEventListener("click", () => this.begin());
      el("btn-advance").addEventListener("click", () => UI.advanceYear());
      el("btn-deage").addEventListener("click", () => UI.deAge());
      document.querySelectorAll(".tab").forEach(t => t.addEventListener("click", () => UI.switchTab(t.dataset.tab)));
      // Appearance shuffle
      el("btn-looks").addEventListener("click", () => {
        if (!this.rolled) return;
        this.rolled.hairStyle = RNG.pick(C.hairStyles);
        this.rolled.hairColor = RNG.pick(C.hairColors);
        this.rolled.skin = RNG.pick(C.skinTones);
        this.rolled.eyeColor = RNG.pick(C.eyeColors);
        this.renderPreview();
      });
    },

    begin() {
      if (!this.rolled) this.reroll();
      this.rolled.name = (el("input-name").value || "").trim() || this.rolled.name;
      UI.loading("newGame", () => {
        State.start(this.rolled, this.difficulty);
        Save.save();
        this.enterGame();
        UI.toast("A shinobi is born", `${State.g.char.name} of the ${C.village(State.g.char.village).name}`, "legendary");
      });
    },

    enterGame() {
      el("screen-creation").classList.remove("active");
      el("screen-game").classList.add("active");
      UI.switchTab("character");
      UI.renderAll();
      Achievements.check();
    }
  };
  SLS.Game = Game;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => Game.init());
  else Game.init();

})();
