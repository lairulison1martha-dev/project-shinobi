/* =================================================================
   SHINOBI LIFE SIMULATOR — core.js
   RNG · State · Save (versioned migration) · Snapshots (de-age)
   Gen (character & NPC creation) · Rules (central age/rank gating)
   ================================================================= */
(function () {
  "use strict";
  const SLS = (window.SLS = window.SLS || {});
  const C = SLS.C;

  /* ---------------- RNG ---------------- */
  const RNG = {
    randInt: (a, b) => Math.floor(Math.random() * (b - a + 1)) + a,
    rand: (a, b) => Math.random() * (b - a) + a,
    chance: (p) => Math.random() < p,
    pick: (a) => a[Math.floor(Math.random() * a.length)],
    pickN(a, n) { const c = a.slice(), o = []; while (n-- > 0 && c.length) o.push(c.splice(Math.floor(Math.random() * c.length), 1)[0]); return o; },
    weighted(items) {
      const t = items.reduce((s, i) => s + i.w, 0); let r = Math.random() * t;
      for (const i of items) if ((r -= i.w) <= 0) return i.v;
      return items[items.length - 1].v;
    }
  };
  SLS.RNG = RNG;

  /* =================================================================
     STATE
     ================================================================= */
  const State = {
    g: null,
    SAVE_VERSION: 2,

    fresh(char, difficultyId) {
      const diff = C.difficulties.find(d => d.id === difficultyId) || C.difficulties[1];
      return {
        version: State.SAVE_VERSION,
        created: Date.now(),
        char,                       // appearance, clan, bloodline, natures
        age: 0,
        stageId: "newborn",
        rank: "civilian",           // rank is EARNED, never granted by age
        level: 1, xp: 0, xpNext: 40,

        health: char.maxHealth, chakra: char.maxChakra, stamina: char.maxStamina,
        wealth: RNG.randInt(0, 40), fame: 0, reputation: 0, villageRep: {},

        dojutsu: { type: char.dojutsuType || null, stage: "none", active: false, strain: 0, damaged: false },
        academy: { enrolled: false, year: 0, attendance: 0, graduated: false, examsTaken: 0,
                   tracks: { knowledge: 0, control: 0, taijutsu: 0, accuracy: 0, clone: 0, henge: 0 } },
        personality: {},            // traitId -> growth points
        elementMastery: {},
        techniques: [], techMastery: {},
        weaponMastery: {},
        inventory: [], equipped: { weapon: null, armor: null },
        relationships: [], team: [], senseiId: null,
        summonContracts: [], activeSummon: null,
        jinchuriki: null,           // set only when actually sealed
        beastEncounters: [],        // ids already met (some vanish forever)
        scars: 0, injuries: [],
        missionsDone: 0, bossesBeaten: 0, pendingBoard: null,
        timeline: [], journal: [], achievements: {},
        flags: {}, eventsSeen: {},
        snapshots: [],              // de-age history (capped)
        scene: "home",
        difficulty: diff.id, diffCfg: diff,
        settings: { autosave: true, sound: true, slowMinigames: false, wideWindows: false, autoMinigames: false, reducedFX: false },
        npcSeq: 1
      };
    },

    start(char, difficultyId) {
      this.g = this.fresh(char, difficultyId);
      const v = C.village(char.village);
      this.g.villageRep[v.id] = 5;
      Log.line(`Born in the ${v.name} to the ${C.clan(char.clan).name} line.`, "big");
      Log.time(0, `Born in the ${v.name}.`);
      // Late-bound on purpose: systems.js installs the real Relations module
      // after core.js loads, so this must resolve at call time.
      SLS.Relations.seedFamily();
      return this.g;
    },

    /* ---- derived ---- */
    stage() { return C.lifeStages.find(s => s.id === this.g.stageId) || C.lifeStages[0]; },
    rankTier() { return C.rankTier(this.g.rank); },
    rankName() { return C.rank(this.g.rank).name; },
    isAlive() { return this.g && !this.g.flags.dead && !this.g.flags.retired; },

    /* Effective stat = base + gear + active dojutsu bonuses. */
    stat(key) {
      const g = this.g;
      let v = g.char.stats[key] || 0;
      const w = g.equipped.weapon && C.weapon(g.equipped.weapon);
      const a = g.equipped.armor && C.gear.find(x => x.id === g.equipped.armor);
      if (a && a.def && key === "strength") v += a.def * 0.3;
      if (w && key === "weapon") v += w.dmg * 0.4;
      if (g.dojutsu.active && g.dojutsu.type) {
        const stages = C.dojutsuStages[g.dojutsu.type] || [];
        const st = stages.find(s => s.id === g.dojutsu.stage);
        if (st && st.bonus[key]) v += st.bonus[key];
      }
      const mast = g.equipped.weapon ? (g.weaponMastery[g.equipped.weapon] || 0) : 0;
      if (key === "weapon") v += mast * 0.12;
      return Math.round(v * 10) / 10;
    },

    power() {
      const s = this.g.char.stats;
      const gear = (this.g.equipped.weapon ? (C.weapon(this.g.equipped.weapon) || { dmg: 0 }).dmg : 0)
        + (this.g.equipped.armor ? ((C.gear.find(x => x.id === this.g.equipped.armor) || { def: 0 }).def) : 0);
      let p = (this.stat("strength") + this.stat("speed") + this.stat("taijutsu") + this.stat("ninjutsu")
        + this.stat("genjutsu") + this.stat("weapon")) / 2 + this.stat("chakraControl")
        + this.g.level * 2 + gear + this.g.techniques.length * 0.6;
      if (this.g.jinchuriki) p += this.g.jinchuriki.sync * 0.4;
      return Math.round(p);
    },

    /* ---- mutators ---- */
    gainStat(key, n) {
      const g = this.g;
      g.char.stats[key] = Math.round(Math.min(999, (g.char.stats[key] || 0) + n * g.diffCfg.gain) * 10) / 10;
    },
    gainXP(n) {
      const g = this.g;
      g.xp += Math.round(n * g.diffCfg.gain);
      while (g.xp >= g.xpNext && g.level < 100) {
        g.xp -= g.xpNext; g.level++;
        g.xpNext = Math.round(g.xpNext * 1.16 + 12);
        g.char.maxHealth += 5; g.char.maxChakra += 4; g.char.maxStamina += 3;
        this.heal(5); g.chakra = Math.min(g.char.maxChakra, g.chakra + 4);
        Log.line(`Reached level ${g.level}.`, "good");
        SLS.UI && SLS.UI.toast("Level up", "Level " + g.level, "good");
      }
    },
    addWealth(n) { this.g.wealth = Math.max(0, Math.round(this.g.wealth + n)); },
    addRep(n) {
      this.g.reputation += n;
      const v = this.g.char.village;
      this.g.villageRep[v] = (this.g.villageRep[v] || 0) + n;
    },
    heal(n) { this.g.health = Math.min(this.g.char.maxHealth, this.g.health + n); },
    damage(n) { this.g.health = Math.max(0, this.g.health - n); if (n >= 25 && RNG.chance(0.3)) this.g.scars = Math.min(3, this.g.scars + 1); },
    spendChakra(n) { this.g.chakra = Math.max(0, this.g.chakra - n); },
    spendStamina(n) { this.g.stamina = Math.max(0, this.g.stamina - n); },
    gainChakra(n) { this.g.chakra = Math.min(this.g.char.maxChakra, this.g.chakra + n); },
    gainElement(el, n) { if (el) this.g.elementMastery[el] = Math.min(100, (this.g.elementMastery[el] || 0) + n); },

    setStageFromAge() {
      const st = C.stageFor(this.g.age);
      const changed = st.id !== this.g.stageId;
      this.g.stageId = st.id;
      return changed;
    }
  };
  SLS.State = State;

  /* =================================================================
     LOG (journal + timeline)
     ================================================================= */
  const Log = {
    line(text, kind) {
      const g = State.g; if (!g) return;
      g.journal.unshift({ age: g.age, text, kind: kind || "" });
      if (g.journal.length > 160) g.journal.pop();
    },
    time(age, text) {
      const g = State.g; if (!g) return;
      g.timeline.push({ age, text });
      if (g.timeline.length > 220) g.timeline.shift();
    }
  };
  SLS.Log = Log;

  /* =================================================================
     SAVE — versioned, migrating, with a one-time backup
     ================================================================= */
  const Save = {
    KEY: "shinobi-save-v1",       // kept for backward compatibility
    BACKUP: "shinobi-save-backup",

    save() {
      if (!State.g) return;
      try { localStorage.setItem(this.KEY, JSON.stringify(State.g)); } catch (e) { /* quota */ }
    },
    autosave() { if (State.g && State.g.settings && State.g.settings.autosave) this.save(); },
    has() { try { return !!localStorage.getItem(this.KEY); } catch (e) { return false; } },
    wipe() { try { localStorage.removeItem(this.KEY); } catch (e) { } },

    load() {
      let raw;
      try { raw = localStorage.getItem(this.KEY); } catch (e) { return null; }
      if (!raw) return null;
      let g;
      try { g = JSON.parse(raw); } catch (e) { return null; }
      if (!g || typeof g !== "object") return null;
      if ((g.version || 1) < State.SAVE_VERSION) {
        try { localStorage.setItem(this.BACKUP, raw); } catch (e) { }
        g = this.migrate(g);
      }
      return this.repair(g);
    },

    /* v1 (original release) → v2 (revamp). Never throws away a save. */
    migrate(old) {
      const g = old;
      const oldChar = g.char || {};
      // v1 stored village as an id + villageName, stats inline, rank as a display name.
      const villageId = oldChar.village && C.village(oldChar.village) ? oldChar.village : "leaf";
      const clanId = (function () {
        const n = (oldChar.clan || "").toLowerCase();
        const hit = C.clans.find(c => c.name.toLowerCase() === n);
        return hit ? hit.id : "civilian";
      })();
      const natures = Array.isArray(oldChar.affinities) ? oldChar.affinities.filter(a => C.natures[a]) : [];

      g.char = {
        name: oldChar.name || "Unnamed",
        village: villageId,
        clan: clanId,
        bloodline: null,
        natures: natures.length ? natures : [C.village(villageId).nature],
        stats: Object.assign(
          { intelligence: 5, strength: 5, speed: 5, taijutsu: 5, ninjutsu: 5, genjutsu: 5, weapon: 5, willpower: 5, chakraControl: 5 },
          oldChar.stats || {}),
        maxHealth: oldChar.maxHealth || 100,
        maxChakra: oldChar.maxChakra || 90,
        maxStamina: oldChar.maxStamina || 90,
        hairStyle: RNG.pick(C.hairStyles), hairColor: RNG.pick(C.hairColors),
        skin: RNG.pick(C.skinTones), eyeColor: RNG.pick(C.eyeColors), body: "a",
        family: oldChar.family || { motherAlive: true, fatherAlive: true, siblings: 0, heritage: "Shinobi" }
      };
      // Map old display rank → new rank id (old game auto-ranked by age; keep earned progress).
      const rankMap = { "Academy Student": "student", "Genin": "genin", "Chunin": "chunin", "Jonin": "jonin", "Elite": "elite", "Captain": "captain", "Anbu": "anbu", "Village Leader": "kage", "Legendary Shinobi": "legend" };
      g.rank = rankMap[g.rank] || (g.age >= 12 ? "genin" : g.age >= 6 ? "student" : "civilian");
      // Old saves never tracked the Academy: infer a finished Academy for Genin+.
      const grad = C.rankTier(g.rank) >= 2;
      g.academy = { enrolled: !grad && C.rankTier(g.rank) >= 1, year: grad ? 6 : Math.max(0, (g.age || 0) - 6),
        attendance: grad ? 80 : 40, graduated: grad, examsTaken: grad ? 1 : 0,
        tracks: grad ? { knowledge: 70, control: 70, taijutsu: 70, accuracy: 70, clone: 70, henge: 70 }
                     : { knowledge: 20, control: 20, taijutsu: 20, accuracy: 20, clone: 10, henge: 10 } };
      // Old flat relationships → new multi-meter model (late-bound, see above).
      g.relationships = (g.relationships || []).map(r => SLS.Relations.wrapLegacy(r));
      g.version = State.SAVE_VERSION;
      return g;
    },

    /* Fill in anything missing so old/partial saves can never crash the game. */
    repair(g) {
      const d = State.fresh(g.char || {}, g.difficulty || "normal");
      const keep = ["char", "age", "rank", "level", "xp", "xpNext", "health", "chakra", "stamina",
        "wealth", "fame", "reputation", "missionsDone", "bossesBeaten", "scars", "created"];
      const out = Object.assign({}, d, g);
      keep.forEach(k => { if (g[k] !== undefined) out[k] = g[k]; });
      // Nested defaults
      out.char = Object.assign({}, d.char, g.char || {});
      out.char.stats = Object.assign({}, d.char.stats, (g.char && g.char.stats) || {});
      out.char.natures = Array.isArray(out.char.natures) && out.char.natures.length ? out.char.natures : [C.village(out.char.village || "leaf").nature];
      out.dojutsu = Object.assign({ type: null, stage: "none", active: false, strain: 0, damaged: false }, g.dojutsu || {});
      out.academy = Object.assign({}, d.academy, g.academy || {});
      out.academy.tracks = Object.assign({}, d.academy.tracks, (g.academy && g.academy.tracks) || {});
      out.equipped = Object.assign({ weapon: null, armor: null }, g.equipped || {});
      out.settings = Object.assign({}, d.settings, g.settings || {});
      ["personality", "elementMastery", "techMastery", "weaponMastery", "villageRep", "achievements", "flags", "eventsSeen"]
        .forEach(k => { if (!out[k] || typeof out[k] !== "object") out[k] = {}; });
      ["techniques", "inventory", "relationships", "team", "summonContracts", "timeline", "journal",
        "snapshots", "beastEncounters", "injuries"].forEach(k => { if (!Array.isArray(out[k])) out[k] = []; });
      out.diffCfg = C.difficulties.find(x => x.id === out.difficulty) || C.difficulties[1];
      out.stageId = (C.stageFor(out.age || 0)).id;
      out.version = State.SAVE_VERSION;
      // Equipment that is no longer legal (e.g. migrated rank) goes back to the pack.
      Rules.enforceEquipment(out);
      return out;
    },

    export() { try { return btoa(unescape(encodeURIComponent(JSON.stringify(State.g)))); } catch (e) { return ""; } },
    import(str) {
      try {
        const g = JSON.parse(decodeURIComponent(escape(atob((str || "").trim()))));
        if (!g || !g.char) return false;
        State.g = this.repair((g.version || 1) < State.SAVE_VERSION ? this.migrate(g) : g);
        return true;
      } catch (e) { return false; }
    }
  };
  SLS.Save = Save;

  /* =================================================================
     SNAPSHOTS — full-state capture powering De-Age.
     Restoring the entire state is what makes reward duplication
     impossible: money, items, techniques, achievements, missions,
     summons and beasts all revert together.
     ================================================================= */
  const Snap = {
    MAX: 8,
    capture(reason) {
      const g = State.g; if (!g) return;
      if (g.diffCfg.ironman) return;              // Ironman: no rewind
      const copy = JSON.parse(JSON.stringify(g));
      delete copy.snapshots;                       // never nest snapshots
      g.snapshots.push({ age: g.age, at: Date.now(), reason: reason || "year", data: copy });
      while (g.snapshots.length > this.MAX) g.snapshots.shift();
    },
    /* Death does not block a rewind — the death screen offers it as a last
       chance. The year-bar button is disabled separately while dead. */
    can() {
      const g = State.g;
      return !!(g && !g.diffCfg.ironman && g.snapshots && g.snapshots.length > 0);
    },
    restore() {
      const g = State.g;
      if (!this.can()) return false;
      const snap = g.snapshots.pop();
      const kept = g.snapshots;                    // keep remaining history
      const restored = snap.data;
      restored.snapshots = kept;
      restored.diffCfg = C.difficulties.find(x => x.id === restored.difficulty) || C.difficulties[1];
      State.g = restored;
      Rules.enforceEquipment(State.g);
      Log.line(`Turned back the year to age ${restored.age}.`, "big");
      Save.save();
      return true;
    },
    peekAge() {
      const g = State.g;
      return (g && g.snapshots && g.snapshots.length) ? g.snapshots[g.snapshots.length - 1].age : null;
    }
  };
  SLS.Snap = Snap;

  /* =================================================================
     RULES — the single authority on what a character may do.
     Every gate is validated here, not in the UI, so hidden buttons
     or direct console calls cannot bypass it.
     ================================================================= */
  const Rules = {
    /* Can this activity be performed right now? → {ok, reason} */
    activity(id, g) {
      g = g || State.g;
      if (!g) return { ok: false, reason: "No game in progress." };
      if (g.flags.dead || g.flags.retired) return { ok: false, reason: "Your story has ended." };
      const a = C.activities.find(x => x.id === id);
      if (!a) return { ok: false, reason: "Unknown activity." };

      if (a.stages && a.stages.indexOf(g.stageId) === -1) {
        return { ok: false, reason: `Not possible as a ${C.stageFor(g.age).name.toLowerCase()}.` };
      }
      if (a.minAge != null && g.age < a.minAge) return { ok: false, reason: `Requires age ${a.minAge}.` };
      if (a.maxAge != null && g.age > a.maxAge) return { ok: false, reason: `Only before age ${a.maxAge + 1}.` };
      if (a.rank && C.rankTier(g.rank) < C.rankTier(a.rank)) {
        return { ok: false, reason: `Requires ${C.rank(a.rank).name} rank.` };
      }
      if (a.academy && !(g.academy.enrolled && !g.academy.graduated)) {
        return { ok: false, reason: "Requires being enrolled at the Academy." };
      }
      if (a.id === "enroll") {
        if (g.academy.enrolled || g.academy.graduated) return { ok: false, reason: "Already enrolled." };
        if (g.age < 6) return { ok: false, reason: "Children enrol at age 6." };
      }
      if (a.id === "grad_exam") {
        const gr = this.graduationCheck(g);
        if (!gr.eligible) return { ok: false, reason: gr.reason };
      }
      if (a.cost && g.stamina < a.cost) return { ok: false, reason: "Not enough stamina." };
      return { ok: true };
    },

    /* Missions are hard-locked behind actual graduation. */
    canMission(g) {
      g = g || State.g;
      if (!g) return { ok: false, reason: "No game in progress." };
      if (!g.academy.graduated || C.rankTier(g.rank) < 2) {
        return { ok: false, reason: "Missions are unavailable. Graduate from the Ninja Academy and become a Genin first." };
      }
      if (g.flags.dead || g.flags.retired) return { ok: false, reason: "Your story has ended." };
      return { ok: true };
    },

    /* Weapons/armour gate on age, rank and strength. */
    canEquip(itemId, g) {
      g = g || State.g;
      const w = C.weapon(itemId) || C.gear.find(x => x.id === itemId);
      if (!w) return { ok: false, reason: "Unknown item." };
      if (w.minAge != null && g.age < w.minAge) return { ok: false, reason: `Requires age ${w.minAge}.` };
      if (w.minRank && C.rankTier(g.rank) < C.rankTier(w.minRank)) return { ok: false, reason: `Requires ${C.rank(w.minRank).name}.` };
      if (w.str && (g.char.stats.strength || 0) < w.str) return { ok: false, reason: `Requires ${w.str} strength.` };
      return { ok: true };
    },

    /* Called after de-aging / migrating: silently return illegal gear to inventory. */
    enforceEquipment(g) {
      g = g || State.g; if (!g || !g.equipped) return;
      ["weapon", "armor"].forEach(slot => {
        const id = g.equipped[slot];
        if (!id) return;
        if (!this.canEquip(id, g).ok) {
          g.equipped[slot] = null;
          if (Array.isArray(g.inventory) && g.inventory.indexOf(id) === -1) g.inventory.push(id);  // item is never destroyed
        }
      });
    },

    /* Can the player buy this at all (shops refuse to arm toddlers). */
    canBuy(itemId, g) {
      g = g || State.g;
      const it = C.weapon(itemId) || C.gear.find(x => x.id === itemId);
      if (!it) return { ok: false, reason: "Unknown item." };
      if (it.minAge != null && g.age < it.minAge) return { ok: false, reason: `Sold only to those aged ${it.minAge}+.` };
      if (it.minRank && C.rankTier(g.rank) < C.rankTier(it.minRank)) return { ok: false, reason: `Requires ${C.rank(it.minRank).name}.` };
      if (g.wealth < it.price) return { ok: false, reason: "Not enough ryo." };
      return { ok: true };
    },

    /* Combat jutsu / real fighting is barred for the very young. */
    canFight(g) {
      g = g || State.g;
      const tier = C.stageIndex(g.stageId);
      if (tier <= 2) return { ok: false, reason: "You are far too young to fight." };   // newborn/toddler/child
      if (!g.academy.enrolled && !g.academy.graduated && tier <= 3) return { ok: false, reason: "You have no training at all." };
      return { ok: true };
    },

    canLeaveVillage(g) {
      g = g || State.g;
      if (C.rankTier(g.rank) < 2) return { ok: false, reason: "Only Genin and above may leave the village alone." };
      return { ok: true };
    },

    /* Graduation eligibility — real requirements, not a rubber stamp. */
    graduationCheck(g) {
      g = g || State.g;
      const G = C.graduation, a = g.academy;
      if (!a.enrolled) return { eligible: false, reason: "You are not enrolled at the Academy." };
      if (a.graduated) return { eligible: false, reason: "You have already graduated." };
      const tracks = C.academyTracks.map(t => a.tracks[t.id] || 0);
      const avg = tracks.reduce((s, v) => s + v, 0) / tracks.length;
      const prodigy = g.age >= G.prodigyAge && avg >= G.prodigyTrackAvg;
      if (g.age < G.minAge && !prodigy) {
        return { eligible: false, reason: `Students sit the exam at age ${G.minAge} (or earlier only as a true prodigy).` };
      }
      if (a.attendance < G.minAttendance) return { eligible: false, reason: `Attendance too low (${Math.round(a.attendance)}%, need ${G.minAttendance}%).` };
      if (avg < G.minTrackAvg) return { eligible: false, reason: `Academy marks too low (${Math.round(avg)}%, need ${G.minTrackAvg}%).` };
      if ((a.tracks.clone || 0) < G.minCoreTech) return { eligible: false, reason: `Clone Technique not ready (${Math.round(a.tracks.clone)}%).` };
      if ((a.tracks.henge || 0) < G.minCoreTech) return { eligible: false, reason: `Transformation not ready (${Math.round(a.tracks.henge)}%).` };
      return { eligible: true, avg, prodigy };
    },

    /* Which activities should the Actions panel offer this year? */
    availableActivities(g) {
      g = g || State.g;
      return C.activities.filter(a => {
        const r = this.activity(a.id, g);
        // Show enroll/graduate only when actually relevant, hide hard-impossible ones.
        if (a.special === "enroll") return r.ok || (g.age >= 6 && g.age <= 11 && !g.academy.graduated && !g.academy.enrolled);
        if (a.special === "graduate") return g.academy.enrolled && !g.academy.graduated;
        if (a.academy) return g.academy.enrolled && !g.academy.graduated;
        if (a.stages) return a.stages.indexOf(g.stageId) !== -1;
        if (a.rank) return C.rankTier(g.rank) >= C.rankTier(a.rank);
        return true;
      });
    }
  };
  SLS.Rules = Rules;

  /* =================================================================
     GEN — character birth & NPC generation
     ================================================================= */
  const Gen = {
    name() { return RNG.pick(C.nameA) + RNG.pick(C.nameB); },

    /* Roll a newborn: clan → bloodline inheritance → natures → looks. */
    character(villageId, name, opts) {
      opts = opts || {};
      const v = C.village(villageId);
      // Clans are village-appropriate and weighted, so rare blood stays rare.
      const pool = C.clans.filter(c => c.villages.indexOf(v.id) !== -1);
      const clan = opts.clanId ? C.clan(opts.clanId) : RNG.weighted(pool.map(c => ({ v: c, w: c.weight })));

      // Bloodline strictly follows clan inheritance — never random across clans.
      let bloodline = null, dojutsuType = null;
      if (clan.bloodline && RNG.chance(clan.inherit)) {
        bloodline = clan.bloodline;
        const bl = C.bloodlines[bloodline];
        if (bl && bl.kind === "dojutsu") dojutsuType = bloodline;
      } else if (!clan.bloodline && RNG.chance(0.012)) {
        // Very rare spontaneous mutation, limited to nature-type bloodlines.
        bloodline = RNG.pick(["ice", "storm", "magnet", "lava"]);
      }

      const base = () => RNG.randInt(2, 6);
      const stats = { intelligence: base(), strength: base(), speed: base(), taijutsu: base(),
        ninjutsu: base(), genjutsu: base(), weapon: base(), willpower: base(), chakraControl: base() };
      let maxHealth = RNG.randInt(55, 80), maxChakra = RNG.randInt(40, 70), maxStamina = RNG.randInt(60, 85);
      const applyBonus = (b) => {
        if (!b) return;
        for (const k in b) {
          if (k === "chakra") maxChakra += b[k];
          else if (k === "health") maxHealth += b[k];
          else if (k in stats) stats[k] += b[k];
        }
      };
      applyBonus(clan.bonus);
      if (bloodline) applyBonus(C.bloodlines[bloodline] && C.bloodlines[bloodline].bonus);

      // Natures: village default, clan preference, small chance of a second.
      const natures = [];
      const first = clan.nature || v.nature;
      natures.push(first);
      if (RNG.chance(0.22)) { const extra = RNG.pick(C.natureList); if (natures.indexOf(extra) === -1) natures.push(extra); }
      if (bloodline === "ice") { ["Water", "Wind"].forEach(n => { if (natures.indexOf(n) === -1) natures.push(n); }); }
      if (bloodline === "wood") { ["Water", "Earth"].forEach(n => { if (natures.indexOf(n) === -1) natures.push(n); }); }
      if (bloodline === "lava") { ["Fire", "Earth"].forEach(n => { if (natures.indexOf(n) === -1) natures.push(n); }); }

      const family = {
        motherAlive: RNG.chance(0.9), fatherAlive: RNG.chance(0.88),
        siblings: RNG.randInt(0, 3),
        heritage: clan.id === "civilian" ? RNG.pick(["Merchant", "Farmer", "Blacksmith", "Medic", "Innkeeper"]) : "Shinobi"
      };

      return {
        name: name || this.name(),
        village: v.id,
        clan: clan.id,
        bloodline, dojutsuType,
        natures,
        stats, maxHealth, maxChakra, maxStamina,
        hairStyle: opts.hairStyle || RNG.pick(C.hairStyles),
        hairColor: opts.hairColor || RNG.pick(C.hairColors),
        skin: opts.skin || RNG.pick(C.skinTones),
        eyeColor: opts.eyeColor || RNG.pick(C.eyeColors),
        body: opts.body || RNG.pick(C.bodyTypes).id,
        family
      };
    },

    npc(opts) {
      opts = opts || {};
      const g = State.g;
      const villageId = opts.village || (g ? g.char.village : "leaf");
      const pool = C.clans.filter(c => c.villages.indexOf(villageId) !== -1);
      const clan = opts.clanId ? C.clan(opts.clanId) : RNG.weighted(pool.map(c => ({ v: c, w: c.weight })));
      return {
        id: "npc" + (g ? g.npcSeq++ : RNG.randInt(1, 1e9)),
        name: opts.name || this.name(),
        village: villageId,
        clan: clan.id,
        rank: opts.rank || "civilian",
        personality: opts.personality || RNG.pick(["Brave", "Calm", "Proud", "Kind", "Sharp", "Blunt", "Shy", "Fierce", "Loyal", "Aloof"]),
        power: opts.power != null ? opts.power : RNG.randInt(5, 40),
        glyph: opts.glyph || RNG.pick(["🧑", "🧒", "👦", "👧", "🧑‍🦰", "👨", "👩"]),
        fav: null
      };
    },

    /* Technique pool — generated once, cached, driven by nature/type. */
    _tech: null,
    techniques() {
      if (this._tech) return this._tech;
      const out = []; let id = 0;
      const tiers = [
        { t: 1, rank: "D", adj: ["Basic", "Lesser", "Novice"], cost: 6, power: 8, req: 6 },
        { t: 2, rank: "C", adj: ["Trained", "Focused", "Greater"], cost: 14, power: 20, req: 18 },
        { t: 3, rank: "B", adj: ["Master", "Twin", "Grand"], cost: 26, power: 38, req: 36 },
        { t: 4, rank: "A", adj: ["Forbidden", "Ultimate", "Sage"], cost: 44, power: 64, req: 60 },
        { t: 5, rank: "S", adj: ["Legendary", "Divine", "Ancient"], cost: 66, power: 96, req: 85 }
      ];
      const nouns = {
        Ninjutsu: { Fire: ["Fireball", "Phoenix Flame", "Ember Storm", "Blazing Fang"], Water: ["Water Dragon", "Tearing Torrent", "Mist Veil", "Shark Bomb"],
          Wind: ["Gale Palm", "Cutting Wind", "Vacuum Sphere", "Tempest"], Earth: ["Mud Wall", "Stone Spear", "Earth Dragon", "Quagmire"],
          Lightning: ["Lightning Fang", "Thunder Clap", "Spark Lance", "Storm Blade"] },
        Taijutsu: { All: ["Leaf Whirlwind", "Iron Fist", "Shadow Dance", "Rising Knee", "Falcon Drop", "Gentle Palm"] },
        Genjutsu: { All: ["Demonic Illusion", "False Surroundings", "Mind Fog", "Nightmare Weave", "Mirror Haze"] },
        Medical: { All: ["Mystic Palm", "Cell Regeneration", "Poison Purge", "Chakra Scalpel", "Healing Rain"] },
        Sealing: { All: ["Five-Element Seal", "Contract Seal", "Barrier Wall", "Reaper Seal", "Storage Scroll"] },
        Summoning: { All: ["Beast Call", "Blood Contract", "Guardian Summon", "Swarm Call"] },
        "Weapon Arts": { All: ["Blade Storm", "Kunai Rain", "Wire Trap", "Chain Sweep", "Crescent Slash"] }
      };
      const gateFor = (type) => type === "Taijutsu" ? "taijutsu" : type === "Genjutsu" ? "genjutsu"
        : type === "Weapon Arts" ? "weapon" : type === "Medical" ? "intelligence" : "ninjutsu";
      C.techTypes.forEach(type => {
        const groups = nouns[type] || { All: ["Technique"] };
        Object.keys(groups).forEach(key => {
          groups[key].forEach(base => {
            tiers.forEach(tier => {
              if (!RNG.chance(0.72)) return;
              out.push({
                id: "tq" + (id++),
                name: RNG.pick(tier.adj) + " " + base,
                type, element: type === "Ninjutsu" ? key : (RNG.chance(0.3) ? RNG.pick(C.natureList) : null),
                rank: tier.rank, tier: tier.t,
                cost: tier.cost + RNG.randInt(-2, 4),
                power: tier.power + RNG.randInt(-3, 5),
                req: tier.req, gate: gateFor(type)
              });
            });
          });
        });
      });
      this._tech = out;
      return out;
    },
    tech(id) { return this.techniques().find(t => t.id === id) || null; }
  };
  SLS.Gen = Gen;
  C.techTypes = ["Ninjutsu", "Taijutsu", "Genjutsu", "Medical", "Sealing", "Summoning", "Weapon Arts"];

  /* Safety net: if systems.js somehow fails to load, these no-op stand-ins keep
     the game from throwing. systems.js overwrites SLS.Relations with the real
     module, and core.js resolves it at call time (never captured in a local). */
  SLS.Relations = SLS.Relations || {
    seedFamily() { },
    wrapLegacy(r) {
      const aff = (r && r.affinity) || 10;
      const meters = {};
      C.relMeters.forEach(k => meters[k] = 0);
      meters.affection = meters.trust = meters.familiarity = aff;
      return { id: "rel_l" + Math.random().toString(36).slice(2, 8),
        npc: { id: "legacy", name: (r && r.npc && r.npc.name) || "Old Friend", clan: "civilian",
               village: "leaf", personality: "Calm", glyph: "🧑", rank: "civilian", power: 20 },
        type: (r && r.type) || "Childhood Friend", meters, memories: [], locked: false };
    }
  };

})();
