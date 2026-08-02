/* =================================================================
   SHINOBI LIFE SIMULATOR — world.js
   Combat · Missions · Exploration · Dojutsu · Summons
   Tailed Beasts & Jinchuriki · Engine (yearly loop + life events)
   ================================================================= */
(function () {
  "use strict";
  const SLS = window.SLS;
  const { C, RNG, State, Save, Log, Rules, Gen, Relations, Personality, Academy,
          Techniques, Shop, Achievements, Endings } = SLS;

  /* =================================================================
     DOJUTSU — owned ≠ active. Chakra only drains while switched on.
     ================================================================= */
  const Dojutsu = {
    owns() { const d = State.g.dojutsu; return !!(d && d.type); },
    stages() { return C.dojutsuStages[State.g.dojutsu.type] || []; },
    stageObj() { return this.stages().find(s => s.id === State.g.dojutsu.stage) || this.stages()[0]; },
    awakened() { return this.owns() && State.g.dojutsu.stage !== "none"; },

    /* First awakening + advancement, driven by emotion/combat/loss. */
    tryAwaken(trigger, strength) {
      const g = State.g;
      if (!this.owns() || g.dojutsu.damaged) return null;
      const stages = this.stages();
      const idx = stages.findIndex(s => s.id === g.dojutsu.stage);
      if (idx < 0 || idx >= stages.length - 1) return null;
      const next = stages[idx + 1];

      if (g.dojutsu.type === "byakugan") {
        // Byakugan is innate: it simply comes in once the child has any training.
        if (idx === 0 && (C.rankTier(g.rank) >= 1 || g.age >= 5)) {
          g.dojutsu.stage = "active";
          Log.line("Your Byakugan awakened. The world turns transparent.", "big");
          Log.time(g.age, "👁 Byakugan awakened.");
          return next;
        }
        return null;
      }

      // Sharingan line: needs real emotional weight, and more each step.
      const need = [0, 1, 2, 4, 9, 99][idx + 1] || 99;   // Mangekyo needs an extreme event
      const s = strength || 1;
      g.flags.emotionCharge = (g.flags.emotionCharge || 0) + s;
      if (next.id === "mangekyo" && trigger !== "extreme") return null;
      if (next.id === "eternal") return null;             // transplant path only
      if (g.flags.emotionCharge < need) return null;

      g.dojutsu.stage = next.id;
      g.dojutsu.active = true;
      Log.line(`Your eyes burn — the ${next.name} awakens.`, "big");
      Log.time(g.age, `👁 Awakened the ${next.name}.`);
      return next;
    },

    toggle() {
      const g = State.g;
      if (!this.awakened()) return { ok: false, reason: "You have no awakened dojutsu." };
      if (g.dojutsu.damaged) return { ok: false, reason: "Your eyes are too damaged to focus." };
      g.dojutsu.active = !g.dojutsu.active;
      return { ok: true, active: g.dojutsu.active };
    },

    /* Called once per activity/turn while active. */
    drainTick(mult) {
      const g = State.g;
      if (!g.dojutsu.active || !this.awakened()) return;
      const st = this.stageObj();
      const cost = (st.drain || 0) * (mult || 1);
      if (cost <= 0) return;
      if (g.chakra < cost) {
        g.dojutsu.active = false;
        Log.line("Your chakra gave out and your eyes went dark.", "bad");
        return;
      }
      State.spendChakra(cost);
      g.dojutsu.strain = (g.dojutsu.strain || 0) + (st.risk === "vision" ? 2.2 : 0.8);
      if (g.dojutsu.strain > 100) {
        g.dojutsu.strain = 100;
        g.dojutsu.active = false;
        if (st.risk === "vision" && RNG.chance(0.35)) {
          g.dojutsu.damaged = true;
          Log.line("You have pushed the Mangekyo too far. Your sight is permanently dimmed.", "bad");
        } else {
          Log.line("Severe eye strain forces your dojutsu shut.", "bad");
        }
      }
    },
    restTick() {
      const g = State.g;
      if (g.dojutsu && g.dojutsu.strain > 0) g.dojutsu.strain = Math.max(0, g.dojutsu.strain - 18);
    }
  };
  SLS.Dojutsu = Dojutsu;

  /* =================================================================
     SUMMONS
     ================================================================= */
  const Summons = {
    sign(id) {
      const g = State.g;
      const s = C.summon(id);
      if (!s) return { ok: false, reason: "No such contract." };
      if (g.summonContracts.some(c => c.id === id)) return { ok: false, reason: "Already signed." };
      if (C.rankTier(g.rank) < 2) return { ok: false, reason: "Only a full ninja may sign a contract." };
      g.summonContracts.push({ id, name: s.name, bond: RNG.randInt(10, 25), trust: RNG.randInt(10, 20), level: 1, mastery: 0, stage: "small" });
      if (!g.activeSummon) g.activeSummon = id;
      Relations.create("Summon", { npc: { id: "sum_" + id, name: s.name + " Chief", clan: "civilian", village: g.char.village,
        personality: "Ancient", glyph: s.glyph, rank: "jonin", power: 70 }, meters: { respect: 25, trust: 20, familiarity: 15 } });
      Log.line(`Signed the ${s.name} summoning contract.`, "big");
      Log.time(g.age, `📜 Signed the ${s.name} contract.`);
      return { ok: true, summon: s };
    },
    setActive(id) {
      const g = State.g;
      if (id && !g.summonContracts.some(c => c.id === id)) return { ok: false };
      g.activeSummon = id || null;
      Save.autosave();
      return { ok: true };
    },
    train() {
      const g = State.g;
      const c = g.summonContracts.find(x => x.id === g.activeSummon);
      if (!c) return { ok: false, reason: "No active summon." };
      if (g.stamina < 10) return { ok: false, reason: "Too tired." };
      State.spendStamina(10); State.spendChakra(10);
      c.bond = Math.min(100, c.bond + RNG.randInt(4, 9));
      c.mastery = Math.min(100, c.mastery + RNG.randInt(3, 8));
      if (c.mastery > 40 && c.stage === "small") c.stage = "medium";
      if (c.mastery > 80 && c.stage === "medium") c.stage = "large";
      State.gainXP(10);
      Save.autosave();
      return { ok: true, contract: c };
    }
  };
  SLS.Summons = Summons;

  /* =================================================================
     TAILED BEASTS — never chosen, only stumbled into
     ================================================================= */
  const Beasts = {
    /* Weighted roll biased by region and any rumours the player chased. */
    roll() {
      const g = State.g;
      const pool = C.beasts.filter(b => g.beastEncounters.indexOf(b.id) === -1 || RNG.chance(0.25));
      if (!pool.length) return null;
      const region = g.char.village;
      const items = pool.map(b => ({
        v: b,
        // Home region raises the odds, but never guarantees a specific beast.
        w: b.rarity * (b.region === region ? 2.6 : 1) * (g.flags.rumourBeast === b.id ? 1.8 : 1)
      }));
      return RNG.weighted(items);
    },

    /* Chance that any beast shows up at all this year. */
    encounterChance() {
      const g = State.g;
      if (C.rankTier(g.rank) < 2) return 0;                 // must be a real ninja
      if (g.jinchuriki) return 0.01;                        // already host: near-zero
      let p = 0.012;
      if (g.flags.deepExplored) p += 0.02;
      if (g.flags.sealingStudy) p += 0.012;
      if (g.flags.chasingRumour) p += 0.018;
      if (C.rankTier(g.rank) >= 4) p += 0.012;
      if (g.flags.warYears > 0) p += 0.015;
      return Math.min(0.085, p);
    },

    /* Finding one does NOT make you a host. */
    encounter(beast) {
      const g = State.g;
      if (!beast) return null;
      if (g.beastEncounters.indexOf(beast.id) === -1) g.beastEncounters.push(beast.id);
      g.flags.chasingRumour = false;
      Log.line(`You have encountered ${beast.name}, the ${beast.tails}-Tails.`, "big");
      Log.time(g.age, `🌀 Encountered ${beast.name}.`);
      return beast;
    },

    /* Sealing is rare, dangerous, and can kill you. */
    attemptSeal(beast, method) {
      const g = State.g;
      if (g.jinchuriki) return { ok: false, reason: "You already carry a beast." };
      const seal = State.stat("chakraControl") + State.stat("intelligence") * 0.6
        + (g.flags.sealingStudy ? 22 : 0) + (g.char.bloodline === "sealing" ? 30 : 0);
      const need = 55 + beast.tails * 6;
      const roll = seal + RNG.randInt(-18, 18);
      if (roll < need * 0.55) {
        // Catastrophic failure
        State.damage(Math.round(g.char.maxHealth * 0.6));
        Log.line(`The seal collapsed. ${beast.name} tore free and left you for dead.`, "bad");
        return { ok: false, failed: true, reason: `The sealing failed catastrophically.` };
      }
      if (roll < need) {
        State.damage(Math.round(g.char.maxHealth * 0.3));
        Log.line(`The seal slipped. ${beast.name} escaped into the night.`, "bad");
        return { ok: false, failed: true, reason: "The seal would not hold." };
      }
      return this.becomeHost(beast, method || "sealed");
    },

    becomeHost(beast, method) {
      const g = State.g;
      const willing = method === "bond" || method === "saved";
      g.jinchuriki = {
        beastId: beast.id, name: beast.name, tails: beast.tails,
        trust: willing ? RNG.randInt(30, 45) : RNG.randInt(0, 12),
        respect: willing ? RNG.randInt(20, 35) : RNG.randInt(0, 10),
        anger: willing ? RNG.randInt(0, 15) : RNG.randInt(45, 75),
        fear: 0, sync: willing ? 20 : 5,
        cloak: "none", mood: willing ? "wary" : "furious", method
      };
      g.char.maxChakra += 60 + beast.tails * 12;
      State.gainChakra(60);
      Relations.create("Tailed Beast", {
        npc: { id: "beast_" + beast.id, name: beast.name, clan: "civilian", village: g.char.village,
               personality: beast.temper, glyph: beast.glyph, rank: "legend", power: 300 },
        meters: { trust: g.jinchuriki.trust, respect: g.jinchuriki.respect, resentment: g.jinchuriki.anger, fear: 0, familiarity: 20 }
      });
      Log.line(`${beast.name} has been sealed inside you. You are a Jinchuriki.`, "big");
      Log.time(g.age, `🔒 Became the host of ${beast.name}.`);
      Achievements.check();
      return { ok: true, host: true };
    },

    /* Talking to your beast is the main way trust moves. */
    commune(mode) {
      const g = State.g, j = g.jinchuriki;
      if (!j) return { ok: false, reason: "You carry no beast." };
      if (g.stamina < 8) return { ok: false, reason: "Too tired." };
      State.spendStamina(8);
      const beast = C.beast(j.beastId);
      let text = "";
      if (mode === "talk") {
        const kind = Personality.value("kind"), arrogant = Personality.value("arrogant");
        const delta = RNG.randInt(2, 6) + (kind > 3 ? 2 : 0) - (arrogant > 4 ? 2 : 0);
        j.trust = Math.min(100, j.trust + Math.max(0, delta));
        j.anger = Math.max(0, j.anger - RNG.randInt(1, 4));
        text = j.trust < 25
          ? `${beast.name} does not answer. The silence is loud.`
          : `${beast.name} speaks with you. Slowly, something shifts.`;
      } else if (mode === "demand") {
        j.anger = Math.min(100, j.anger + RNG.randInt(4, 10));
        j.trust = Math.max(0, j.trust - RNG.randInt(2, 6));
        Personality.add("arrogant", 1);
        text = `You demand power. ${beast.name} laughs at you.`;
      } else if (mode === "meditate") {
        j.sync = Math.min(100, j.sync + RNG.randInt(2, 5) + (j.trust > 50 ? 3 : 0));
        State.gainStat("chakraControl", 0.6);
        text = `You sit with ${beast.name}'s chakra until it stops fighting you.`;
      }
      // Sync tracks trust; a hateful beast will never synchronise.
      j.sync = Math.min(100, Math.max(0, Math.round(j.sync * 0.94 + j.trust * 0.06)));
      j.mood = j.anger > 60 ? "furious" : j.trust > 65 ? "warm" : j.trust > 35 ? "wary" : "cold";
      const rel = State.g.relationships.find(r => r.type === "Tailed Beast");
      if (rel) Relations.adjust(rel, { trust: (j.trust - rel.meters.trust) * 0.4, resentment: (j.anger - rel.meters.resentment) * 0.4 }, { force: true });
      this.updateCloak();
      Save.autosave();
      return { ok: true, text };
    },

    updateCloak() {
      const g = State.g, j = g.jinchuriki;
      if (!j) return;
      const avail = C.cloakStages.filter(s => j.sync >= s.sync);
      j.maxCloak = avail[avail.length - 1].id;
    },
    setCloak(id) {
      const g = State.g, j = g.jinchuriki;
      if (!j) return { ok: false };
      const st = C.cloakStages.find(s => s.id === id);
      if (!st) return { ok: false };
      if (j.sync < st.sync) return { ok: false, reason: `Requires ${st.sync}% synchronisation.` };
      if (st.id !== "none" && j.anger > 70 && RNG.chance(0.4)) {
        j.anger = Math.min(100, j.anger + 8);
        State.damage(RNG.randInt(8, 20));
        Log.line(`${j.name} seized control for a moment. You woke up bleeding.`, "bad");
        j.cloak = "none";
        return { ok: false, reason: "The beast refused you — violently." };
      }
      j.cloak = st.id;
      return { ok: true, stage: st };
    }
  };
  SLS.Beasts = Beasts;

  /* =================================================================
     COMBAT — turn-based, personality-driven enemy AI
     ================================================================= */
  const Combat = {
    cur: null,

    makeEnemy(level, kind) {
      level = Math.max(1, Math.round(level));
      const scale = State.g.diffCfg.danger;
      const hp = Math.round((40 + level * 12) * scale);
      return {
        name: kind === "bandit" ? "Bandit " + Gen.name() : kind === "rogue" ? "Missing-Nin " + Gen.name() : Gen.name(),
        glyph: kind === "bandit" ? "🗡️" : kind === "rogue" ? "🥷" : RNG.pick(["🥷", "👺", "🐗", "🏹"]),
        level, ai: RNG.pick(["Aggressive", "Defensive", "Tactical", "Reckless"]),
        hp, maxHp: hp, cp: 30 + level * 6, maxCp: 30 + level * 6, charge: 0,
        atk: Math.round((7 + level * 2.1) * scale), def: Math.round(3 + level * 1.3),
        spd: Math.round(6 + level * 1.5 + RNG.randInt(-2, 2)),
        reward: Math.round(level * 26), xp: Math.round(level * 9)
      };
    },
    makeBeastFoe(beast) {
      const hp = 400 + beast.tails * 90;
      return { name: beast.name, glyph: beast.glyph, level: 40 + beast.tails * 5, ai: "Reckless",
        hp, maxHp: hp, cp: 200, maxCp: 200, charge: 0,
        atk: 40 + beast.tails * 5, def: 28 + beast.tails * 2, spd: 26,
        reward: 0, xp: 300 + beast.tails * 40, boss: true, beast: true };
    },

    playerFighter() {
      const g = State.g;
      const jb = g.jinchuriki && g.jinchuriki.cloak !== "none"
        ? (C.cloakStages.find(s => s.id === g.jinchuriki.cloak) || { bonus: 0 }).bonus : 0;
      const mult = 1 + jb;
      return {
        name: g.char.name, glyph: C.village(g.char.village).crest, isPlayer: true,
        hp: Math.max(1, Math.round(g.health)), maxHp: g.char.maxHealth,
        cp: Math.round(g.chakra), maxCp: g.char.maxChakra,
        atk: Math.round((State.stat("strength") + State.stat("taijutsu") * 0.6 + State.stat("weapon") * 0.5 + g.level * 1.4) * mult),
        nin: Math.round((State.stat("ninjutsu") + State.stat("genjutsu") * 0.5 + State.stat("chakraControl") * 0.6 + g.level) * mult),
        def: Math.round(State.stat("strength") * 0.4 + g.level + (g.equipped.armor ? (C.gear.find(x => x.id === g.equipped.armor) || { def: 0 }).def : 0)),
        spd: Math.round(State.stat("speed") + g.level),
        charge: 0, dodging: false, countering: false, defending: false, teamCd: 0
      };
    },

    start(enemy, opts, onEnd) {
      const can = Rules.canFight();
      if (!can.ok && !(opts && opts.forced)) { SLS.UI && SLS.UI.toast("Too young", can.reason, "bad"); if (onEnd) onEnd({ win: false, blocked: true }); return; }
      this.cur = { player: this.playerFighter(), enemy, opts: opts || {}, onEnd, log: [], over: false, turn: 0 };
      this.push(`${enemy.name} moves to attack!`);
      // Drop into the combat stance, facing the enemy.
      if (SLS.AnimationManager) { SLS.AnimationManager.setFacing(1); SLS.AnimationManager.setContext("COMBAT"); }
      SLS.UI && SLS.UI.combat(this.cur);
    },
    push(html) { if (!this.cur) return; this.cur.log.unshift(html); if (this.cur.log.length > 30) this.cur.log.pop(); },
    dmg(atk, def, mult) { return Math.max(1, Math.round(atk * (1 - def / (def + 55)) * RNG.rand(0.85, 1.15) * (mult || 1))); },

    player(action) {
      const c = this.cur; if (!c || c.over) return;
      const p = c.player, e = c.enemy;
      p.dodging = false; p.countering = false;

      if (action === "attack") {
        const crit = RNG.chance(0.08 + Math.max(0, p.spd - e.spd) * 0.004);
        const d = this.dmg(p.atk, e.def, crit ? 1.7 : 1);
        e.hp -= d; p.charge = Math.min(100, p.charge + 18);
        if (State.g.equipped.weapon) {
          const wid = State.g.equipped.weapon;
          State.g.weaponMastery[wid] = Math.min(100, (State.g.weaponMastery[wid] || 0) + 0.6);
        }
        this.push(`You strike for <span class="dmg">${d}</span>${crit ? ' <span class="crit">CRIT!</span>' : ""}.`);
      } else if (action === "chakra") {
        if (p.cp < 18) { SLS.UI.toast("Not enough chakra", "", "bad"); return; }
        p.cp -= 18;
        const d = this.dmg(p.nin * 1.7, e.def, RNG.chance(0.1) ? 1.8 : 1);
        e.hp -= d; p.charge = Math.min(100, p.charge + 26);
        State.gainElement(State.g.char.natures[0], 1);
        this.push(`Your jutsu blasts for <span class="dmg">${d}</span>.`);
      } else if (action === "dodge") {
        p.dodging = true; p.cp = Math.min(p.maxCp, p.cp + 8); p.charge = Math.min(100, p.charge + 10);
        this.push("You read their footwork and prepare to slip aside.");
      } else if (action === "counter") {
        p.countering = true; p.charge = Math.min(100, p.charge + 12);
        this.push("You brace to turn their strike back on them.");
      } else if (action === "defend") {
        p.defending = true; p.cp = Math.min(p.maxCp, p.cp + 14); p.charge = Math.min(100, p.charge + 8);
        this.push("You take a defensive stance.");
      } else if (action === "team") {
        if (!State.g.team.length) { SLS.UI.toast("No squad", "You have no team yet.", "bad"); return; }
        if (p.teamCd > 0) { SLS.UI.toast("Not ready", `${p.teamCd} turn(s).`, "bad"); return; }
        const d = this.dmg((p.atk + p.nin) * 1.35 + State.g.team.length * 8, e.def, 1.2);
        e.hp -= d; p.teamCd = 3; p.charge = Math.min(100, p.charge + 18);
        this.push(`Your squad strikes together for <span class="dmg">${d}</span>!`);
        State.g.team.forEach(id => { const r = Relations.find(id); if (r) Relations.adjust(r, { trust: 1, familiarity: 1 }); });
      } else if (action === "summon") {
        const c2 = State.g.summonContracts.find(x => x.id === State.g.activeSummon);
        if (!c2) { SLS.UI.toast("No summon", "Sign a contract first.", "bad"); return; }
        if (p.cp < 25) { SLS.UI.toast("Not enough chakra", "", "bad"); return; }
        p.cp -= 25;
        const d = this.dmg(p.nin * 1.2 + c2.mastery * 0.9 + c2.bond * 0.4, e.def, 1.3);
        e.hp -= d;
        this.push(`${c2.name} answers your call and strikes for <span class="dmg">${d}</span>!`);
      } else if (action === "ultimate") {
        if (p.charge < 100) { SLS.UI.toast("Not charged", "Keep fighting to build charge.", "bad"); return; }
        p.charge = 0;
        const d = this.dmg(p.atk * 1.4 + p.nin * 2.1, e.def, 2.0);
        e.hp -= d;
        this.push(`<span class="crit">ULTIMATE!</span> You devastate them for <span class="dmg">${d}</span>!`);
      } else return;

      if (p.teamCd > 0 && action !== "team") p.teamCd--;
      Dojutsu.drainTick(0.4);
      if (e.hp <= 0) return this.end(true);
      this.enemyTurn();
    },

    enemyTurn() {
      const c = this.cur; if (!c || c.over) return;
      const p = c.player, e = c.enemy;
      c.turn++;
      e.charge = Math.min(100, (e.charge || 0) + 14);
      const pct = e.hp / e.maxHp;
      const canCp = e.cp >= 16;
      let move = "attack";
      switch (e.ai) {
        case "Aggressive": move = canCp && RNG.chance(0.45) ? "chakra" : "attack"; break;
        case "Defensive":  move = pct < 0.35 ? "defend" : (canCp && RNG.chance(0.28) ? "chakra" : "attack"); break;
        case "Tactical":   move = e.charge >= 100 ? "ultimate" : pct < 0.3 ? "defend" : (canCp && RNG.chance(0.5) ? "chakra" : "attack"); break;
        case "Reckless":   move = e.charge >= 100 ? "ultimate" : (canCp && RNG.chance(0.62) ? "chakra" : "attack"); break;
      }
      const hit = (raw, label, crit) => {
        if (p.dodging && RNG.chance(0.68)) { this.push(`You dodge the ${label}.`); return; }
        let d = raw;
        if (p.defending) d = Math.round(d * 0.4);
        p.hp -= d; p.charge = Math.min(100, p.charge + 10);
        this.push(`${e.name}'s ${label} hits you for <span class="dmg">${d}</span>${crit ? ' <span class="crit">CRIT!</span>' : ""}.`);
        SLS.UI && SLS.UI.shake();
        if (p.countering) {
          const cd = Math.round(d * 0.6 + p.atk * 0.3);
          e.hp -= cd;
          this.push(`You counter for <span class="dmg">${cd}</span>!`);
        }
        // Taking a real beating can awaken the Sharingan.
        if (d > p.maxHp * 0.22) Dojutsu.tryAwaken("combat", 1);
      };
      if (move === "defend") { e.defending = true; e.cp = Math.min(e.maxCp, e.cp + 12); this.push(`${e.name} guards.`); }
      else if (move === "chakra") { e.cp -= 16; hit(this.dmg(e.atk * 1.5, p.def, 1), "jutsu", RNG.chance(0.08)); }
      else if (move === "ultimate") { e.charge = 0; hit(this.dmg(e.atk * 2.2, p.def, 1.5), "ultimate technique", true); }
      else { hit(this.dmg(e.atk, p.def, RNG.chance(0.06) ? 1.6 : 1), "attack", false); }

      p.defending = false;
      if (p.hp <= 0) return this.end(false);
      SLS.UI && SLS.UI.combat(c);
    },

    flee() {
      const c = this.cur; if (!c || c.over) return;
      const p = c.player, e = c.enemy;
      if (RNG.chance(0.5 + (p.spd - e.spd) * 0.012)) {
        c.over = true;
        State.g.health = Math.max(1, Math.round(p.hp));
        State.g.chakra = Math.max(0, Math.round(p.cp));
        SLS.UI.closeModal();
        if (c.onEnd) c.onEnd({ win: false, fled: true });
      } else { this.push("You failed to break away!"); this.enemyTurn(); }
    },

    end(win) {
      const c = this.cur; c.over = true;
      const p = c.player;
      State.g.health = Math.max(1, Math.round(Math.max(0, p.hp)));
      State.g.chakra = Math.max(0, Math.round(p.cp));
      // Low health after the fight puts the sprite into the injured state.
      if (SLS.AnimationManager) SLS.AnimationManager.setInjured(State.g.health < State.g.char.maxHealth * 0.3);
      if (!win) State.damage(0);
      this.push(win ? '<span class="crit">Victory!</span>' : "You were beaten down…");
      SLS.UI && SLS.UI.combat(c);
      setTimeout(() => { SLS.UI && SLS.UI.combatEnd(win, () => { if (c.onEnd) c.onEnd({ win, fled: false }); }); }, 350);
    }
  };
  SLS.Combat = Combat;

  /* =================================================================
     MISSIONS — hard-locked behind graduation
     ================================================================= */
  const Missions = {
    RANKS: { D: { power: 10, pay: [60, 130], xp: 14, danger: 0.08 },
             C: { power: 26, pay: [160, 320], xp: 28, danger: 0.16 },
             B: { power: 46, pay: [380, 700], xp: 50, danger: 0.28 },
             A: { power: 72, pay: [800, 1500], xp: 84, danger: 0.42 },
             S: { power: 108, pay: [1800, 3200], xp: 140, danger: 0.58 },
             SS:{ power: 155, pay: [4000, 7000], xp: 230, danger: 0.72 } },
    TEMPLATES: [
      { rank: "D", v: "Retrieve", o: ["a lost cat", "stolen groceries", "a farmer's tools"] },
      { rank: "D", v: "Weed",     o: ["the elder's garden", "the shrine path"] },
      { rank: "D", v: "Guard",    o: ["a merchant stall", "the village gate"] },
      { rank: "C", v: "Escort",   o: ["a bridge builder", "a travelling merchant"] },
      { rank: "C", v: "Investigate", o: ["bandit sightings", "a haunted shrine"] },
      { rank: "B", v: "Eliminate", o: ["a bandit camp", "a smuggling ring"] },
      { rank: "B", v: "Recover",  o: ["a stolen artefact", "classified documents"] },
      { rank: "A", v: "Assassinate", o: ["a corrupt official", "an enemy commander"] },
      { rank: "A", v: "Defend",   o: ["a border outpost", "an allied village"] },
      { rank: "S", v: "Hunt",     o: ["an S-rank missing-nin", "a criminal ringleader"] },
      { rank: "SS", v: "Confront", o: ["a legendary criminal", "the masked mastermind"] }
    ],

    allowedRanks() {
      const t = C.rankTier(State.g.rank);
      if (t < 2) return [];
      if (t === 2) return ["D", "D", "C"];
      if (t === 3) return ["D", "C", "C", "B"];
      if (t === 4) return ["C", "B", "B", "A"];
      if (t === 5) return ["B", "A", "A", "S"];
      return ["B", "A", "S", "S", "SS"];
    },

    generate(rank) {
      const t = RNG.pick(this.TEMPLATES.filter(x => x.rank === rank)) || this.TEMPLATES[0];
      const cfg = this.RANKS[t.rank];
      return {
        id: "m" + Date.now().toString(36) + RNG.randInt(100, 999),
        rank: t.rank, title: `${t.v} ${RNG.pick(t.o)}`,
        power: cfg.power + RNG.randInt(-3, 5),
        pay: RNG.randInt(cfg.pay[0], cfg.pay[1]), xp: cfg.xp, danger: cfg.danger,
        combat: ["B", "A", "S", "SS"].indexOf(t.rank) !== -1 && RNG.chance(0.6)
      };
    },
    board() {
      const g = State.g;
      if (!Rules.canMission(g).ok) return [];
      if (!g.pendingBoard || !g.pendingBoard.length) this.refresh();
      return g.pendingBoard;
    },
    refresh() {
      const g = State.g;
      const allowed = this.allowedRanks();
      g.pendingBoard = allowed.length ? Array.from({ length: 6 }, () => this.generate(RNG.pick(allowed))) : [];
      return g.pendingBoard;
    },

    /* Validated here, not in the UI — hidden buttons cannot bypass it. */
    accept(id, onDone) {
      const g = State.g;
      const gate = Rules.canMission(g);
      if (!gate.ok) { SLS.UI && SLS.UI.toast("Locked", gate.reason, "bad"); return { ok: false, reason: gate.reason }; }
      const m = (g.pendingBoard || []).find(x => x.id === id);
      if (!m) return { ok: false, reason: "Mission no longer available." };
      if (g.stamina < 15) { SLS.UI && SLS.UI.toast("Too tired", "Rest first.", "bad"); return { ok: false, reason: "Too tired." }; }
      State.spendStamina(15);
      g.scene = "camp";

      if (m.combat) {
        const enemy = Combat.makeEnemy(Math.max(2, Math.round(m.power / 3.5)), "rogue");
        Combat.start(enemy, {}, (res) => { this.resolve(m, res.win); if (onDone) onDone(); });
      } else {
        const chance = Math.min(0.95, Math.max(0.05, 0.35 + (State.power() - m.power) * 0.02));
        this.resolve(m, RNG.chance(chance));
        if (onDone) onDone();
      }
      return { ok: true };
    },

    resolve(m, success) {
      const g = State.g;
      const i = (g.pendingBoard || []).findIndex(x => x.id === m.id);
      if (i >= 0) g.pendingBoard.splice(i, 1);
      if (success) {
        State.addWealth(m.pay); State.gainXP(m.xp); State.addRep(Math.round(m.xp / 7));
        g.fame += ["A", "S", "SS"].indexOf(m.rank) !== -1 ? 4 : 1;
        g.missionsDone++;
        State.gainElement(g.char.natures[0], RNG.randInt(1, 3));
        g.team.forEach(id => { const r = Relations.find(id); if (r) Relations.adjust(r, { trust: 2, familiarity: 2, respect: 1 }); });
        Log.line(`Completed ${m.rank}-rank mission: ${m.title}. (+${m.pay} ryo)`, "good");
        SLS.UI && SLS.UI.toast("Mission complete", `+${m.pay} ryo`, "good");
      } else {
        const dmg = Math.round(m.power * g.diffCfg.danger * RNG.rand(0.5, 1.2));
        State.damage(dmg); State.addRep(-2);
        Log.line(`Failed ${m.rank}-rank mission: ${m.title}. (-${dmg} HP)`, "bad");
        SLS.UI && SLS.UI.toast("Mission failed", m.title, "bad");
        if (RNG.chance(0.25)) {
          const mate = g.team.length ? Relations.find(RNG.pick(g.team)) : null;
          if (mate) { Relations.remember(mate, "missionTrauma"); Relations.adjust(mate, { trust: 4, familiarity: 5 }); }
        }
      }
      Achievements.check();
      if (g.health <= 0) { SLS.UI && SLS.UI.ending(Endings.trigger("fallen")); return; }
      Save.autosave();
    }
  };
  SLS.Missions = Missions;

  /* =================================================================
     EXPLORATION — real encounters with state-gated choices
     ================================================================= */
  const Explore = {
    pickEncounter(deep) {
      const g = State.g;
      const pool = C.encounters.filter(e => {
        if (e.deep && !deep) return false;
        if (e.danger > 0 && C.rankTier(g.rank) < 2) return false;
        return true;
      });
      return RNG.pick(pool);
    },

    /* Which options this character may actually take. */
    options(enc) {
      const g = State.g;
      return enc.options.filter(o => {
        if (!o.need) return true;
        if (o.need.rank && C.rankTier(g.rank) < C.rankTier(o.need.rank)) return false;
        if (o.need.chakra && g.chakra < o.need.chakra) return false;
        if (o.need.stat && State.stat(o.need.stat) < o.need.min) return false;
        return true;
      });
    },

    begin(deep) {
      const g = State.g;
      const gate = Rules.canLeaveVillage(g);
      if (!gate.ok) return { ok: false, reason: gate.reason };
      const enc = this.pickEncounter(deep);
      g.scene = enc.scene || "forest";
      if (deep) g.flags.deepExplored = true;
      return { ok: true, enc };
    },

    choose(enc, optIndex, onDone) {
      const g = State.g;
      const opts = this.options(enc);
      const o = opts[optIndex];
      if (!o) { if (onDone) onDone(); return; }
      const fx = o.fx || {};
      let text = o.text || "";

      // Combat branches hand off to the battle system.
      if (fx.combat) {
        const lvl = fx.combat === "rogue" ? Math.max(5, g.level + 4) : Math.max(2, g.level + 1);
        const enemy = Combat.makeEnemy(lvl, fx.combat);
        if (fx.buff) State.spendChakra(fx.chakra ? Math.abs(fx.chakra) : 20);
        Combat.start(enemy, {}, (res) => {
          if (res.win) {
            State.addWealth(enemy.reward); State.gainXP(enemy.xp); State.addRep(2);
            Personality.add("brave", 2);
            Log.line(`Defeated ${enemy.name} in the wild. (+${enemy.reward} ryo)`, "good");
            Dojutsu.tryAwaken("combat", 1);
          } else if (!res.blocked) {
            Log.line(`You were beaten by ${enemy.name} and limped home.`, "bad");
          }
          Achievements.check();
          if (onDone) onDone();
        });
        return;
      }

      // Stat checks
      if (fx.check) {
        const ok = State.stat(fx.check) + RNG.randInt(0, 12) > 14;
        const branch = ok ? fx.ok : fx.fail;
        text = ok ? "You slip away unseen." : "They spot you — it costs you.";
        this.applyFx(branch || {});
      }
      if (fx.flee) { text = text || "You break away and head for the walls."; }

      this.applyFx(fx);

      // Special hooks
      if (fx.summonChance) {
        const wanted = fx.summonChance === "any" ? RNG.pick(C.summons.filter(s => !s.rare)).id : fx.summonChance;
        if (C.rankTier(g.rank) >= 2 && RNG.chance(0.55)) {
          const r = Summons.sign(wanted);
          if (r.ok) text += ` A contract scroll unrolls itself before you — the ${r.summon.name} clan accepts you.`;
        } else {
          text += " Something watches you, considers, and withdraws.";
        }
      }
      if (fx.beastChance) {
        const beast = Beasts.roll();
        if (beast && RNG.chance(0.55)) {
          Beasts.encounter(beast);
          if (onDone) onDone({ beast });
          return;
        }
        text += " Whatever it was, it is gone by the time you reach the bottom.";
      }
      if (fx.teach) {
        const t = Techniques.learnRandom();
        if (t) text += ` They teach you ${t.name}.`;
        State.gainStat("taijutsu", 1); State.gainXP(25);
      }
      if (fx.learnTech) {
        const t = Techniques.learnRandom();
        text += t ? ` You learn ${t.name}.` : " The technique is beyond you for now.";
      }
      if (fx.item) { g.inventory.push(fx.item); }
      if (o.memory) {
        // Encounter memories attach to a witness if there is one.
        const witness = g.relationships.filter(r => ["Teammate", "Sensei"].indexOf(r.type) !== -1)[0];
        if (witness) Relations.remember(witness, o.memory);
      }

      Log.line(text || `${enc.name}: you chose "${o.label}".`, "");
      Achievements.check();
      Save.autosave();
      if (onDone) onDone({ text });
    },

    /* Shared effect applier for encounters and life events. */
    applyFx(fx) {
      if (!fx) return;
      const g = State.g;
      const stats = ["intelligence", "strength", "speed", "taijutsu", "ninjutsu", "genjutsu", "weapon", "willpower", "chakraControl"];
      stats.forEach(k => { if (typeof fx[k] === "number") State.gainStat(k, fx[k]); });
      C.traitIds.forEach(t => { if (typeof fx[t] === "number") Personality.add(t, fx[t]); });
      if (typeof fx.wealth === "number") State.addWealth(fx.wealth);
      if (typeof fx.rep === "number") State.addRep(fx.rep);
      if (typeof fx.fame === "number") g.fame = Math.max(0, g.fame + fx.fame);
      if (typeof fx.health === "number") { fx.health < 0 ? State.damage(-fx.health) : State.heal(fx.health); }
      if (typeof fx.chakra === "number") { fx.chakra < 0 ? State.spendChakra(-fx.chakra) : State.gainChakra(fx.chakra); }
      if (typeof fx.stamina === "number") { fx.stamina < 0 ? State.spendStamina(-fx.stamina) : (g.stamina = Math.min(g.char.maxStamina, g.stamina + fx.stamina)); }
      if (typeof fx.family === "number") {
        Relations.byType("Parent").concat(Relations.byType("Sibling"))
          .forEach(r => Relations.adjust(r, { affection: fx.family, trust: fx.family * 0.6 }));
      }
      if (typeof fx.team === "number") {
        g.team.forEach(id => { const r = Relations.find(id); if (r) Relations.adjust(r, { trust: fx.team, affection: fx.team * 0.6 }); });
      }
      if (typeof fx.teacher === "number") {
        const t = Relations.find(g.academy.teacherId); if (t) Relations.adjust(t, { respect: fx.teacher, trust: fx.teacher * 0.7 });
      }
      if (typeof fx.bondBoost === "number") {
        const best = g.relationships.slice().sort((a, b) => Relations.score(b) - Relations.score(a))[0];
        if (best) Relations.adjust(best, { affection: fx.bondBoost, familiarity: fx.bondBoost * 0.5 });
      }
      if (fx.newBond) Relations.meetNew(fx.newBond === "rival" ? "Rival" : "Childhood Friend");
      if (fx.sharinganTrigger) Dojutsu.tryAwaken("emotion", 3);
      if (fx.flagChunin) g.flags.chuninEligible = true;
      if (fx.defect) {
        g.flags.defected = true;
        g.rank = g.rank;                       // rank retained but village turns on you
        State.addRep(-60);
        Relations.broadcast("betrayedMe", { trust: -60, loyalty: -60, resentment: 50, fear: 20 },
          r => ["Parent", "Sibling", "Teammate", "Sensei", "Teacher"].indexOf(r.type) !== -1);
        Log.line("You left the village behind. There is no going back.", "big");
        Log.time(g.age, "🚪 Abandoned the village.");
      }
    }
  };
  SLS.Explore = Explore;

  /* =================================================================
     ENGINE — the yearly loop
     ================================================================= */
  const Engine = {
    /* Contextual label for the advance button. */
    advanceLabel() {
      const g = State.g;
      if (!g) return "Advance Year";
      if (g.age === 0) return "Grow to Age 1";
      if (g.age === 1) return "Begin Childhood";
      if (g.age === 5 && !g.academy.enrolled) return "Reach Academy Age";
      if (g.academy.enrolled && !g.academy.graduated) {
        const chk = Rules.graduationCheck(g);
        return chk.eligible ? "Attempt Graduation Year" : "Start the Next School Year";
      }
      if (g.academy.graduated && C.rankTier(g.rank) === 2 && g.missionsDone === 0) return "Begin Genin Life";
      return "Advance to Next Year";
    },

    /* Perform one activity (does NOT advance the year). */
    doActivity(id, onDone) {
      const g = State.g;
      const gate = Rules.activity(id, g);
      if (!gate.ok) { SLS.UI && SLS.UI.toast("Not available", gate.reason, "bad"); return { ok: false, reason: gate.reason }; }
      const a = C.activities.find(x => x.id === id);
      if (a.scene) g.scene = a.scene;
      if (a.cost) State.spendStamina(a.cost);

      // Route specials
      if (a.special === "enroll") {
        const r = Academy.enroll();
        if (r.ok) SLS.UI.sceneEvent("🏫 Academy Enrolment", `You take your seat in the classroom. Your teacher, ${r.teacher.npc.name}, calls the register.`, onDone);
        return r;
      }
      if (a.special === "graduate") { SLS.UI.graduationFlow(onDone); return { ok: true }; }
      if (a.special === "explore")  { SLS.UI.exploreFlow(onDone); return { ok: true }; }
      if (a.special === "spar")     { this.spar(onDone); return { ok: true }; }
      if (a.special === "social")   { SLS.UI.socialFlow(onDone); return { ok: true }; }
      if (a.minigame && !g.settings.autoMinigames) { SLS.Minigames.launch(a.minigame, a, onDone); return { ok: true }; }

      const res = this.resolveActivity(a);
      Achievements.check();
      Save.autosave();
      if (onDone) onDone(res);
      return { ok: true, res };
    },

    /* Non-minigame activity outcomes. */
    resolveActivity(a, bonus) {
      const g = State.g;
      bonus = bonus || 1;
      let text = "";
      if (a.academy) { const r = Academy.lesson(a.id); text = r.text; Academy.attendance(a.id === "skip_class" ? 0 : 3); }
      else switch (a.id) {
        case "babble":
          State.gainStat("willpower", 0.3); State.gainStat("intelligence", 0.3);
          text = "You explore the world by putting most of it in your mouth."; break;
        case "bond_family": {
          Relations.byType("Parent").concat(Relations.byType("Sibling")).forEach(r =>
            Relations.adjust(r, { affection: RNG.randInt(3, 7), trust: RNG.randInt(2, 5), familiarity: 3 }));
          State.gainStat("willpower", 0.4); Personality.add("loyal", 1);
          text = "A warm, ordinary day with your family."; break; }
        case "play":
          State.gainStat("speed", 0.5); State.gainStat("strength", 0.3); Personality.add("social", 1);
          text = "You run yourself ragged and sleep well tonight."; break;
        case "observe":
          State.gainStat("intelligence", 0.6); Personality.add("disciplined", 1);
          text = "You watch the shinobi move across the rooftops and try to copy them."; break;
        case "balance":
          State.gainStat("speed", 0.6); State.gainStat("chakraControl", 0.4);
          text = "You walk the log until you stop falling off."; break;
        case "history":
          State.gainStat("intelligence", 0.8); State.addRep(1);
          text = "You read about the founding of your village."; break;
        case "sense":
          State.gainStat("chakraControl", 0.7); State.gainChakra(10);
          text = "You sit still until you can feel your own chakra moving."; break;
        case "conditioning":
          State.gainStat("strength", 1.0 * bonus); State.gainStat("taijutsu", 0.5); State.gainXP(12);
          text = "Weights, laps, and aching legs."; break;
        case "weapon_train": {
          const r = Shop.trainWeapon();
          text = r.ok ? `You drill until the movement stops being a decision. (Mastery ${Math.round(r.mastery)}%)` : r.reason;
          break; }
        case "jutsu_study": {
          const t = Techniques.learnRandom();
          State.gainStat("ninjutsu", 0.6); State.gainXP(12);
          text = t ? `You decipher a scroll and learn ${t.name}.` : "You study, but nothing new clicks yet."; break; }
        case "team_train": {
          g.team.forEach(id => { const r = Relations.find(id); if (r) Relations.adjust(r, { trust: 4, respect: 3, familiarity: 4 }); });
          State.gainStat("taijutsu", 0.6); State.gainXP(14); Personality.add("loyal", 1);
          text = "Formations, signals, and trust drills with your squad."; break; }
        case "work":
          { const pay = RNG.randInt(40, 120) + State.stat("intelligence") * 2;
            State.addWealth(pay); Personality.add("disciplined", 1);
            text = `You take odd jobs around the village. (+${Math.round(pay)} ryo)`; } break;
        case "rest":
          State.heal(RNG.randInt(14, 26));
          g.stamina = g.char.maxStamina;
          State.gainChakra(Math.round(g.char.maxChakra * 0.4));
          Dojutsu.restTick();
          text = "You rest, and your body quietly repairs itself."; break;
        default:
          State.gainXP(6); text = "Time passes."; break;
      }
      if (text) Log.line(text, "");
      Dojutsu.drainTick(0.5);
      return { text };
    },

    spar(onDone) {
      const g = State.g;
      const rivals = g.relationships.filter(r => ["Rival", "Teammate", "Classmate"].indexOf(r.type) !== -1);
      const rel = rivals.length ? RNG.pick(rivals) : Relations.meetNew("Rival");
      const enemy = Combat.makeEnemy(Math.max(1, g.level + RNG.randInt(-2, 1)), "spar");
      enemy.name = rel.npc.name; enemy.glyph = rel.npc.glyph;
      Combat.start(enemy, { friendly: true }, (res) => {
        if (res.blocked) { if (onDone) onDone(); return; }
        if (res.win) {
          State.gainXP(24); Relations.adjust(rel, { respect: 6, rivalry: 5, familiarity: 3 });
          Personality.add("brave", 1);
          Log.line(`You won a spar against ${rel.npc.name}.`, "good");
        } else {
          Relations.adjust(rel, { respect: 2, rivalry: 7, familiarity: 3 });
          Personality.add("ambitious", 1);
          Log.line(`${rel.npc.name} beat you this time.`, "");
          Dojutsu.tryAwaken("combat", 1);
        }
        Achievements.check(); Save.autosave();
        if (onDone) onDone();
      });
    },

    /* ---------------- the year ---------------- */
    advanceYear(onDone) {
      const g = State.g;
      if (!g || g.flags.dead || g.flags.retired) return;

      SLS.Snap.capture("year");          // snapshot BEFORE anything changes

      g.age++;
      const stageChanged = State.setStageFromAge();

      // Recovery + upkeep
      g.stamina = g.char.maxStamina;
      State.gainChakra(Math.round(g.char.maxChakra * 0.45));
      State.heal(Math.round(g.char.maxHealth * 0.28));
      Dojutsu.restTick();
      if (g.flags.warYears > 0) g.flags.warYears--;

      // Growing up gives free growth while young
      if (g.age <= 12) { State.gainStat("intelligence", 0.3); State.gainStat("strength", 0.2); State.gainStat("speed", 0.2); }
      if (g.age >= 50 && RNG.chance(0.45)) {
        const s = RNG.pick(["speed", "strength", "taijutsu"]);
        g.char.stats[s] = Math.max(1, g.char.stats[s] - RNG.rand(0.4, 1.4));
      }
      Academy.yearTick();
      if (g.pendingBoard) Missions.refresh();

      Log.time(g.age, `Turned ${g.age}. (${C.stageFor(g.age).name})`);
      if (stageChanged) {
        Log.line(`You are now a ${C.stageFor(g.age).name.toLowerCase()}.`, "big");
        Log.time(g.age, `✦ Became a ${C.stageFor(g.age).name}.`);
      }

      Achievements.check();

      // Decide this year's single interruption.
      const queue = [];
      const beastChance = Beasts.encounterChance();
      if (RNG.chance(beastChance)) {
        const b = Beasts.roll();
        if (b) queue.push({ kind: "beast", beast: b });
      }
      if (!queue.length) {
        const ev = this.pickLifeEvent();
        if (ev) queue.push({ kind: "event", event: ev });
      }

      Save.autosave();
      if (onDone) onDone({ stageChanged, queue });
    },

    pickLifeEvent() {
      const g = State.g;
      const pool = C.lifeEvents.filter(e => {
        if (e.once && g.eventsSeen[e.id]) return false;
        if (e.stage && e.stage !== g.stageId) return false;
        if (e.rank && C.rankTier(g.rank) < C.rankTier(e.rank)) return false;
        if (e.minAge != null && g.age < e.minAge) return false;
        if (e.academy && !(g.academy.enrolled && !g.academy.graduated)) return false;
        if (e.clanOnly && g.char.clan === "civilian") return false;
        return true;
      });
      if (!pool.length) return null;
      if (!RNG.chance(0.62)) return null;
      const ev = RNG.weighted(pool.map(e => ({ v: e, w: e.weight || 5 })));
      return ev;
    },

    applyEventChoice(ev, idx) {
      const g = State.g;
      const ch = ev.choices[idx];
      if (!ch) return "";
      g.eventsSeen[ev.id] = true;
      Explore.applyFx(ch.fx || {});
      if (ch.fx && ch.fx.combat) {
        return { combat: ch.fx.combat };
      }
      if (ch.memory) {
        const target = g.relationships.filter(r => ["Teammate", "Classmate", "Rival", "Childhood Friend"].indexOf(r.type) !== -1)[0]
          || g.relationships[0];
        if (target) Relations.remember(target, ch.memory);
      }
      if (ev.irreversible) {
        Log.line(`${ev.title}: this choice cannot be undone.`, "big");
        Log.time(g.age, `⚑ ${ev.title}`);
      }
      Achievements.check();
      Save.autosave();
      return "";
    },

    /* Called after every yearly interruption resolves. */
    postYear() {
      const g = State.g;
      if (!g || g.flags.dead) return null;
      Achievements.check();
      if (g.health <= 0) return Endings.trigger("fallen");
      if (g.age >= 60) {
        const p = Math.min(0.8, (g.age - 60) * 0.045 + 0.03);
        if (RNG.chance(p)) return Endings.trigger(Endings.decide());
      }
      if (g.age >= 95) return Endings.trigger(Endings.decide());
      // Rank progression above Genin comes from power + deeds, not age alone.
      this.checkPromotion();
      Save.autosave();
      return null;
    },

    checkPromotion() {
      const g = State.g;
      if (C.rankTier(g.rank) < 2) return;         // Genin only via graduation
      const p = State.power();
      const rules = [
        { id: "chunin",  power: 90,  age: 12, missions: 8 },
        { id: "jonin",   power: 170, age: 17, missions: 25 },
        { id: "elite",   power: 260, age: 22, missions: 45 },
        { id: "anbu",    power: 340, age: 25, missions: 60 },
        { id: "captain", power: 430, age: 28, missions: 80 },
        { id: "kage",    power: 600, age: 34, missions: 110 },
        { id: "legend",  power: 850, age: 40, missions: 150 }
      ];
      for (const r of rules) {
        if (C.rankTier(r.id) > C.rankTier(g.rank) && p >= r.power && g.age >= r.age && g.missionsDone >= r.missions) {
          this.promote(r.id);
          break;
        }
      }
    },
    promote(rankId) {
      const g = State.g;
      g.rank = rankId;
      State.addRep(10); g.fame += 5;
      const name = C.rank(rankId).name;
      Log.line(`Promoted to ${name}.`, "big");
      Log.time(g.age, `★ Promoted to ${name}.`);
      SLS.UI && SLS.UI.toast("Promotion", `You are now ${name}.`, "legendary");
      Achievements.check();
    }
  };
  SLS.Engine = Engine;

})();
