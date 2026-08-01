/* =================================================================
   SHINOBI LIFE SIMULATOR — systems.js
   Relations (multi-meter + memory) · Personality · Academy
   Techniques · Shop/Inventory · Achievements · Endings
   ================================================================= */
(function () {
  "use strict";
  const SLS = window.SLS;
  const { C, RNG, State, Save, Log, Rules, Gen } = SLS;

  /* =================================================================
     PERSONALITY — grown by repeated choices, never picked from a list
     ================================================================= */
  const Personality = {
    add(trait, n) {
      const g = State.g; if (!g || !trait) return;
      if (C.traitIds.indexOf(trait) === -1) return;
      g.personality[trait] = (g.personality[trait] || 0) + (n || 1);
      // Opposing traits erode one another so a character has a real shape.
      const def = C.traits.find(t => t.id === trait);
      if (def && def.opposite && g.personality[def.opposite]) {
        g.personality[def.opposite] = Math.max(0, g.personality[def.opposite] - (n || 1) * 0.5);
      }
    },
    value(trait) { return (State.g.personality[trait] || 0); },
    /* Strongest traits, for display and for gating dialogue. */
    top(n) {
      const g = State.g;
      return Object.keys(g.personality)
        .map(id => ({ id, name: (C.traits.find(t => t.id === id) || { name: id }).name, v: g.personality[id] }))
        .filter(t => t.v > 0)
        .sort((a, b) => b.v - a.v)
        .slice(0, n || 4);
    },
    has(trait, min) { return this.value(trait) >= (min || 3); }
  };
  SLS.Personality = Personality;

  /* =================================================================
     RELATIONS — every bond carries ten meters and permanent memories
     ================================================================= */
  const Relations = {
    blankMeters() {
      const m = {};
      C.relMeters.forEach(k => m[k] = 0);
      return m;
    },

    create(type, opts) {
      opts = opts || {};
      const g = State.g;
      const npc = opts.npc || Gen.npc(opts);
      const rel = {
        id: "rel" + (g.npcSeq++),
        npc, type: type || "Friend",
        meters: Object.assign(this.blankMeters(), opts.meters || {}),
        memories: [],
        locked: false          // set by irreversible acts
      };
      g.relationships.push(rel);
      return rel;
    },

    /* Family exists from birth — you are born into a web of bonds. */
    seedFamily() {
      const g = State.g; if (!g) return;
      const clan = C.clan(g.char.clan);
      const fam = g.char.family || {};
      if (fam.motherAlive !== false) {
        this.create("Parent", { npc: Gen.npc({ clanId: clan.id, glyph: "👩", rank: "civilian" }),
          meters: { affection: 55, trust: 60, loyalty: 55, familiarity: 70, respect: 30 } });
      }
      if (fam.fatherAlive !== false) {
        this.create("Parent", { npc: Gen.npc({ clanId: clan.id, glyph: "👨", rank: "civilian" }),
          meters: { affection: 50, trust: 55, loyalty: 50, familiarity: 68, respect: 32 } });
      }
      for (let i = 0; i < Math.min(3, fam.siblings || 0); i++) {
        this.create("Sibling", { npc: Gen.npc({ clanId: clan.id, glyph: RNG.pick(["👦", "👧"]) }),
          meters: { affection: 40, trust: 42, familiarity: 62, rivalry: RNG.randInt(0, 25) } });
      }
      if (clan.id !== "civilian") {
        this.create("Clan Elder", { npc: Gen.npc({ clanId: clan.id, glyph: "🧓", rank: "jonin", power: 60 }),
          meters: { respect: 35, trust: 25, familiarity: 30 } });
      }
    },

    find(id) { return State.g.relationships.find(r => r.id === id) || null; },
    byType(type) { return State.g.relationships.filter(r => r.type === type); },

    /* Adjust meters. Locked bonds resist positive repair — that is the point. */
    adjust(rel, deltas, opts) {
      if (!rel) return;
      opts = opts || {};
      Object.keys(deltas || {}).forEach(k => {
        if (C.relMeters.indexOf(k) === -1) return;
        let d = deltas[k];
        const positive = d > 0;
        if (rel.locked && positive && !opts.force) d *= 0.15;   // betrayal cannot be gifted away
        rel.meters[k] = Math.max(-100, Math.min(100, (rel.meters[k] || 0) + d));
      });
    },

    /* Permanent memory tags NPCs bring up later. */
    remember(rel, tag, opts) {
      if (!rel || !C.memories[tag]) return;
      if (rel.memories.indexOf(tag) !== -1) return;
      rel.memories.push(tag);
      const harsh = ["betrayedMe", "abandonedMe", "brokePromise", "humiliated"];
      if (harsh.indexOf(tag) !== -1) rel.locked = true;
      if (!(opts && opts.quiet)) {
        Log.line(`${rel.npc.name} will remember that.`, harsh.indexOf(tag) !== -1 ? "bad" : "good");
      }
    },

    /* Anyone who witnessed an irreversible act reacts to it. */
    broadcast(tag, deltas, filter) {
      const g = State.g;
      g.relationships.forEach(r => {
        if (filter && !filter(r)) return;
        this.adjust(r, deltas, { force: true });
        if (tag) this.remember(r, tag, { quiet: true });
      });
    },

    /* Overall warmth used for sorting / display. */
    score(rel) {
      const m = rel.meters;
      return Math.round((m.affection + m.trust + m.respect + m.loyalty + m.familiarity) / 5
        - (m.resentment + m.fear * 0.5 + m.jealousy * 0.5) / 3);
    },

    /* Spending time together — the ordinary way bonds grow. */
    interact(relId, mode) {
      const g = State.g;
      const rel = this.find(relId);
      if (!rel) return { ok: false, reason: "No such bond." };
      const cost = 6;
      if (g.stamina < cost) return { ok: false, reason: "Too tired." };
      State.spendStamina(cost);

      let text = "";
      if (mode === "train") {
        this.adjust(rel, { respect: RNG.randInt(3, 7), familiarity: RNG.randInt(3, 6), rivalry: rel.type === "Rival" ? 3 : 0 });
        State.gainStat("taijutsu", 0.4); State.gainXP(8);
        Personality.add("disciplined", 1);
        text = `You train alongside ${rel.npc.name}. Sweat earns respect.`;
      } else if (mode === "confide") {
        this.adjust(rel, { trust: RNG.randInt(4, 8), affection: RNG.randInt(2, 5), familiarity: 3 });
        Personality.add("honest", 1);
        text = `You tell ${rel.npc.name} something true about yourself.`;
      } else if (mode === "gift") {
        if (g.wealth < 60) return { ok: false, reason: "You cannot afford a gift." };
        State.addWealth(-60);
        this.adjust(rel, { affection: RNG.randInt(3, 7), familiarity: 2 });
        text = `You give ${rel.npc.name} a small gift.`;
        if (rel.locked) text += " They accept it politely, but nothing has really changed.";
      } else {
        this.adjust(rel, { affection: RNG.randInt(2, 5), familiarity: RNG.randInt(3, 6) });
        Personality.add("social", 1);
        text = `You spend the afternoon with ${rel.npc.name}.`;
      }
      Log.line(text, "");
      Save.autosave();
      return { ok: true, text };
    },

    /* Legacy v1 bonds → new model (referenced by core.js migration). */
    wrapLegacy(r) {
      const aff = (r && r.affinity) || 10;
      return {
        id: "rel_l" + Math.random().toString(36).slice(2, 8),
        npc: { id: "legacy", name: (r && r.npc && r.npc.name) || "Old Friend", clan: "civilian",
               village: "leaf", personality: "Calm", glyph: "🧑", rank: "civilian", power: 20 },
        type: (r && r.type) || "Childhood Friend",
        meters: Object.assign(Relations.blankMeters(), { affection: aff, trust: aff, familiarity: aff, respect: 10 }),
        memories: [], locked: false
      };
    },

    /* Meet someone new. */
    meetNew(typeHint) {
      const g = State.g;
      const stageIdx = C.stageIndex(g.stageId);
      let type = typeHint;
      if (!type) {
        if (g.academy.enrolled && !g.academy.graduated) type = RNG.pick(["Classmate", "Classmate", "Rival", "Childhood Friend"]);
        else if (C.rankTier(g.rank) >= 2) type = RNG.pick(["Teammate", "Rival", "Childhood Friend", "Romantic Interest"]);
        else type = RNG.pick(["Childhood Friend", "Classmate"]);
      }
      if (type === "Romantic Interest" && stageIdx < 4) type = "Childhood Friend";   // no romance before adolescence
      const rel = this.create(type, { meters: { familiarity: RNG.randInt(5, 18), affection: RNG.randInt(2, 12) } });
      if (stageIdx <= 3) this.remember(rel, "childhoodFriend", { quiet: true });
      Log.line(`Met ${rel.npc.name} — a new ${type.toLowerCase()}.`, "good");
      return rel;
    }
  };
  SLS.Relations = Relations;

  /* =================================================================
     ACADEMY — enrolment, lessons, attendance, graduation
     ================================================================= */
  const Academy = {
    enroll() {
      const g = State.g;
      const r = Rules.activity("enroll");
      if (!r.ok) return { ok: false, reason: r.reason };
      g.academy.enrolled = true;
      g.academy.year = 1;
      g.academy.attendance = 60;
      g.rank = "student";                      // the first earned rank
      // A teacher and a first classmate arrive with enrolment.
      const teacher = Relations.create("Teacher", { npc: Gen.npc({ glyph: "🧑‍🏫", rank: "chunin", power: 55 }),
        meters: { respect: 20, trust: 15, familiarity: 20 } });
      g.academy.teacherId = teacher.id;
      Relations.create("Classmate", { meters: { familiarity: 12, affection: 6 } });
      Log.line("Enrolled at the Ninja Academy.", "big");
      Log.time(g.age, "🏫 Enrolled at the Ninja Academy.");
      return { ok: true, teacher };
    },

    track(id, amount) {
      const g = State.g;
      const cur = g.academy.tracks[id] || 0;
      // Mild diminishing returns: a focused student graduates around 11-12,
      // a lazy one does not graduate at all.
      const gain = amount * g.diffCfg.gain * (1 - cur / 180);
      g.academy.tracks[id] = Math.max(0, Math.min(100, cur + Math.max(0.5, gain)));
      return g.academy.tracks[id];
    },
    attendance(delta) {
      const g = State.g;
      g.academy.attendance = Math.max(0, Math.min(100, g.academy.attendance + delta));
    },
    average() {
      const a = State.g.academy;
      const vals = C.academyTracks.map(t => a.tracks[t.id] || 0);
      return vals.reduce((s, v) => s + v, 0) / vals.length;
    },

    /* Each Academy lesson feeds a track, attendance, and a stat. */
    lesson(activityId) {
      const g = State.g;
      const int = State.stat("intelligence"), ctrl = State.stat("chakraControl");
      let text = "", track = null, gain = 0;
      switch (activityId) {
        case "attend":
          // A full school day nudges every subject along.
          this.attendance(7);
          this.track("knowledge", 5 + int * 0.12); this.track("taijutsu", 3);
          this.track("clone", 2.5); this.track("henge", 2.5); this.track("accuracy", 2.5); this.track("control", 2.5);
          State.gainStat("intelligence", 0.4); State.gainXP(8);
          text = "You sat through a full day of lessons."; break;
        case "study_theory":
          track = "knowledge"; gain = this.track("knowledge", 12 + int * 0.2);
          State.gainStat("intelligence", 0.7); State.gainXP(9);
          text = `Chakra theory is starting to make sense. (Knowledge ${Math.round(gain)}%)`; break;
        case "clone_prac":
          track = "clone"; gain = this.track("clone", 11 + ctrl * 0.22);
          State.gainStat("ninjutsu", 0.5); State.gainStat("chakraControl", 0.4); State.gainXP(10);
          text = `You split your chakra again and again. (Clone ${Math.round(gain)}%)`; break;
        case "henge_prac":
          track = "henge"; gain = this.track("henge", 11 + ctrl * 0.22);
          State.gainStat("ninjutsu", 0.5); State.gainStat("genjutsu", 0.3); State.gainXP(10);
          text = `You hold another shape a little longer each try. (Transformation ${Math.round(gain)}%)`; break;
        case "tai_lesson":
          track = "taijutsu"; gain = this.track("taijutsu", 12);
          State.gainStat("taijutsu", 0.8); State.gainStat("strength", 0.4); State.gainXP(11);
          text = `Stances, strikes, and a fresh set of bruises. (Taijutsu ${Math.round(gain)}%)`; break;
        case "spar_lesson":
          track = "taijutsu"; gain = this.track("taijutsu", 14);
          State.gainStat("taijutsu", 1); State.gainStat("speed", 0.5); State.damage(RNG.randInt(1, 5)); State.gainXP(13);
          Personality.add("brave", 1);
          text = `A supervised bout with a classmate. (Taijutsu ${Math.round(gain)}%)`; break;
        case "classmates":
          this.attendance(2);
          { const pool = State.g.relationships.filter(r => r.type === "Classmate");
            const rel = pool.length && RNG.chance(0.65) ? RNG.pick(pool) : Relations.meetNew("Classmate");
            Relations.adjust(rel, { affection: RNG.randInt(3, 7), familiarity: RNG.randInt(4, 8) });
            Personality.add("social", 1);
            text = `You spend the break with ${rel.npc.name}.`; }
          break;
        case "teacher_talk":
          { const t = Relations.find(State.g.academy.teacherId) || Relations.byType("Teacher")[0];
            if (t) { Relations.adjust(t, { respect: 4, trust: 4, familiarity: 4 }); }
            this.track("knowledge", 3); this.attendance(2); State.gainXP(6);
            text = t ? `${t.npc.name} walks you through what you got wrong.` : "You review your work alone."; }
          break;
        case "skip_class":
          this.attendance(-14);
          { const t = Relations.find(State.g.academy.teacherId);
            if (t) Relations.adjust(t, { respect: -6, trust: -5 }); }
          Personality.add("independent", 2); Personality.add("disciplined", -1);
          State.g.stamina = Math.min(State.g.char.maxStamina, State.g.stamina + 10);
          text = "You spent the day on a rooftop instead. Nobody said anything — yet.";
          if (RNG.chance(0.35)) { State.addRep(-2); text += " Word got back to your family."; }
          break;
      }
      Log.line(text, "");
      return { text, track };
    },

    /* The graduation exam: written half (intelligence) + practical half (control). */
    attemptExam() {
      const g = State.g;
      const check = Rules.graduationCheck(g);
      if (!check.eligible) return { ok: false, reason: check.reason };
      g.academy.examsTaken++;

      const written = State.stat("intelligence") * 2.2 + (g.academy.tracks.knowledge || 0) * 0.7 + RNG.randInt(-12, 12);
      const practical = State.stat("chakraControl") * 2.0
        + ((g.academy.tracks.clone || 0) + (g.academy.tracks.henge || 0)) * 0.35
        + (g.academy.tracks.taijutsu || 0) * 0.2 + RNG.randInt(-12, 12);
      const writtenPass = written >= 58;
      const practicalPass = practical >= 60;

      // A teacher who respects you gives the benefit of the doubt on a near miss.
      const teacher = Relations.find(g.academy.teacherId);
      let mercy = false;
      if (!practicalPass && teacher && teacher.meters.respect >= 55 && practical >= 52) { mercy = true; }

      const passed = writtenPass && (practicalPass || mercy);
      return { ok: true, passed, written: Math.round(written), practical: Math.round(practical),
        writtenPass, practicalPass: practicalPass || mercy, mercy, prodigy: check.prodigy };
    },

    /* Promote to Genin and hand out everything that comes with it. */
    graduate() {
      const g = State.g;
      g.academy.graduated = true;
      g.academy.enrolled = false;
      g.rank = "genin";
      g.flags.hasHeadband = true;

      // Squad of two plus a jonin sensei.
      const mates = [];
      for (let i = 0; i < 2; i++) {
        const rel = Relations.create("Teammate", { npc: Gen.npc({ rank: "genin", power: RNG.randInt(18, 34) }),
          meters: { familiarity: 25, trust: 18, respect: 15, affection: 12 } });
        g.team.push(rel.id);
        mates.push(rel);
      }
      const sensei = Relations.create("Sensei", { npc: Gen.npc({ glyph: "🥷", rank: "jonin", power: RNG.randInt(70, 95) }),
        meters: { respect: 30, trust: 25, familiarity: 20 } });
      g.senseiId = sensei.id;

      // Starter kit — now legally equippable as a Genin.
      ["w_kunai", "w_shuriken"].forEach(id => { if (g.inventory.indexOf(id) === -1) g.inventory.push(id); });
      if (Rules.canEquip("w_kunai", g).ok) g.equipped.weapon = "w_kunai";

      State.addRep(10); g.fame += 4; State.gainXP(120);
      Log.line("Graduated from the Ninja Academy. You are a Genin.", "big");
      Log.time(g.age, "🎓 Graduated — became a Genin.");
      return { mates, sensei };
    },

    /* Yearly drift: attendance decays if you never show up. */
    yearTick() {
      const g = State.g;
      if (!g.academy.enrolled || g.academy.graduated) return;
      g.academy.year++;
      this.attendance(-6);
      if (g.academy.attendance < 30 && RNG.chance(0.4)) {
        Log.line("The Academy sent a warning letter about your attendance.", "bad");
      }
    }
  };
  SLS.Academy = Academy;

  /* =================================================================
     TECHNIQUES
     ================================================================= */
  const Techniques = {
    canLearn(t) {
      const g = State.g;
      if (g.techniques.indexOf(t.id) !== -1) return { ok: false, reason: "Already learned." };
      if (C.rankTier(g.rank) < 1) return { ok: false, reason: "You have no training yet." };
      // Real combat jutsu is barred until the Academy is behind you.
      const combatType = ["Ninjutsu", "Genjutsu", "Weapon Arts", "Summoning"].indexOf(t.type) !== -1;
      if (combatType && t.tier >= 2 && C.rankTier(g.rank) < 2) return { ok: false, reason: "Requires Genin rank." };
      const gate = g.char.stats[t.gate] || 0;
      if (gate < t.req) return { ok: false, reason: `Requires ${t.gate} ${t.req} (you have ${Math.round(gate)}).` };
      if (g.chakra < t.cost) return { ok: false, reason: "Not enough chakra." };
      return { ok: true };
    },
    learn(id) {
      const g = State.g, t = Gen.tech(id);
      if (!t) return { ok: false, reason: "Unknown technique." };
      const c = this.canLearn(t);
      if (!c.ok) return c;
      State.spendChakra(t.cost);
      g.techniques.push(t.id);
      g.techMastery[t.id] = 5;
      if (t.element) State.gainElement(t.element, 4);
      Log.line(`Learned ${t.name}.`, "good");
      Save.autosave();
      return { ok: true, tech: t };
    },
    learnRandom() {
      const g = State.g;
      const pool = Gen.techniques().filter(t => g.techniques.indexOf(t.id) === -1 && this.canLearn(t).ok);
      if (!pool.length) return null;
      const t = RNG.pick(pool);
      g.techniques.push(t.id); g.techMastery[t.id] = 5;
      if (t.element) State.gainElement(t.element, 3);
      return t;
    },
    train(id) {
      const g = State.g;
      if (g.techniques.indexOf(id) === -1) return { ok: false, reason: "Not learned." };
      if (g.stamina < 8) return { ok: false, reason: "Too tired." };
      State.spendStamina(8);
      g.techMastery[id] = Math.min(100, (g.techMastery[id] || 0) + RNG.randInt(5, 12));
      const t = Gen.tech(id);
      if (t) { State.gainStat(t.gate, 0.35); if (t.element) State.gainElement(t.element, 2); }
      State.gainXP(7);
      Save.autosave();
      return { ok: true };
    }
  };
  SLS.Techniques = Techniques;

  /* =================================================================
     SHOP & INVENTORY — refuses to arm children
     ================================================================= */
  const Shop = {
    catalog() { return C.weapons.concat(C.gear); },
    item(id) { return C.weapon(id) || C.gear.find(x => x.id === id) || null; },

    buy(id) {
      const g = State.g;
      const r = Rules.canBuy(id, g);
      if (!r.ok) return r;
      const it = this.item(id);
      State.addWealth(-it.price);
      if (it.type === "scroll") {
        const t = Techniques.learnRandom();
        Log.line(t ? `Bought a scroll and learned ${t.name}.` : "Bought a scroll, but could not decipher it yet.", t ? "good" : "");
        Save.autosave();
        return { ok: true, learned: t };
      }
      g.inventory.push(id);
      Log.line(`Bought ${it.name}.`, "");
      Save.autosave();
      return { ok: true, item: it };
    },

    use(id, index) {
      const g = State.g;
      const it = this.item(id);
      if (!it) return { ok: false, reason: "Unknown item." };
      const idx = index != null ? index : g.inventory.indexOf(id);
      if (idx < 0) return { ok: false, reason: "Not in your pack." };

      if (it.consumable) {
        if (it.heal) State.heal(it.heal);
        if (it.chakra) State.gainChakra(it.chakra);
        if (it.stat) State.gainStat(it.stat, it.bonus || 1);
        g.inventory.splice(idx, 1);
        Log.line(`Used ${it.name}.`, "");
        Save.autosave();
        return { ok: true, consumed: true };
      }
      // Equip path — gated by age/rank/strength.
      const can = Rules.canEquip(id, g);
      if (!can.ok) return can;
      const slot = C.weapon(id) ? "weapon" : "armor";
      const prev = g.equipped[slot];
      g.equipped[slot] = id;
      g.inventory.splice(idx, 1);
      if (prev) g.inventory.push(prev);
      if (slot === "weapon" && g.weaponMastery[id] == null) g.weaponMastery[id] = 0;
      Log.line(`Equipped ${it.name}.`, "good");
      Save.autosave();
      return { ok: true, equipped: it };
    },

    unequip(slot) {
      const g = State.g;
      const id = g.equipped[slot];
      if (!id) return { ok: false };
      g.equipped[slot] = null;
      g.inventory.push(id);
      Save.autosave();
      return { ok: true };
    },

    trainWeapon() {
      const g = State.g;
      const id = g.equipped.weapon;
      if (!id) return { ok: false, reason: "No weapon equipped." };
      if (g.stamina < 12) return { ok: false, reason: "Too tired." };
      State.spendStamina(12);
      const gain = RNG.randInt(4, 9) * g.diffCfg.gain;
      g.weaponMastery[id] = Math.min(100, (g.weaponMastery[id] || 0) + gain);
      State.gainStat("weapon", 0.7); State.gainStat("strength", 0.25); State.gainXP(10);
      const w = C.weapon(id);
      Log.line(`Drilled with your ${w ? w.name : "weapon"}. (Mastery ${Math.round(g.weaponMastery[id])}%)`, "");
      Save.autosave();
      return { ok: true, mastery: g.weaponMastery[id] };
    }
  };
  SLS.Shop = Shop;

  /* =================================================================
     ACHIEVEMENTS — including hidden legendary entries
     ================================================================= */
  const Achievements = {
    list: (function () {
      const a = [];
      const add = (id, name, desc, test, extra) => a.push(Object.assign({ id, name, desc, test }, extra || {}));
      [1, 5, 10, 25, 50, 100, 200].forEach(n => add("miss" + n, `${n} Missions`, `Complete ${n} missions.`, g => g.missionsDone >= n));
      [500, 2000, 10000, 50000].forEach(n => add("ryo" + n, `${n} Ryo`, `Hold ${n} ryo at once.`, g => g.wealth >= n));
      [5, 10, 25, 50, 75, 100].forEach(n => add("lvl" + n, `Level ${n}`, `Reach level ${n}.`, g => g.level >= n));
      [1, 10, 25, 50, 100].forEach(n => add("tech" + n, `${n} Techniques`, `Learn ${n} techniques.`, g => g.techniques.length >= n));
      [1, 5, 10].forEach(n => add("boss" + n, `${n} Great Foes`, `Defeat ${n} major enemies.`, g => g.bossesBeaten >= n));
      C.ranks.slice(1).forEach(r => add("rank_" + r.id, `Rank: ${r.name}`, `Reach ${r.name}.`, g => C.rankTier(g.rank) >= r.tier));
      [1, 5, 15, 30].forEach(n => add("bond" + n, `${n} Bonds`, `Form ${n} relationships.`, g => g.relationships.length >= n));
      C.natureList.forEach(e => add("el_" + e, `${e} Adept`, `Reach 50 ${e} mastery.`, g => (g.elementMastery[e] || 0) >= 50));
      add("allelem", "Elemental Master", "Reach 80 mastery in every element.", g => C.natureList.every(e => (g.elementMastery[e] || 0) >= 80));
      [16, 30, 50, 70, 90].forEach(n => add("age" + n, `Age ${n}`, `Live to ${n}.`, g => g.age >= n));
      add("grad", "Graduate", "Graduate from the Academy.", g => g.academy.graduated);
      add("prodigy", "Prodigy", "Graduate before age 11.", g => g.academy.graduated && g.flags.gradAge != null && g.flags.gradAge < 11);
      add("perfect_att", "Model Student", "Reach 95% Academy attendance.", g => (g.academy.attendance || 0) >= 95);
      add("squad", "Squad Assembled", "Be assigned a Genin team.", g => (g.team || []).length >= 2);
      add("weapon50", "Weapon Adept", "Reach 50% mastery with a weapon.", g => Object.keys(g.weaponMastery || {}).some(k => g.weaponMastery[k] >= 50));
      add("weapon100", "Weapon Master", "Reach 100% mastery with a weapon.", g => Object.keys(g.weaponMastery || {}).some(k => g.weaponMastery[k] >= 100));
      add("summon1", "Contracted", "Sign a summoning contract.", g => (g.summonContracts || []).length >= 1);
      add("summon3", "Beast Speaker", "Sign three summoning contracts.", g => (g.summonContracts || []).length >= 3);
      add("fame50", "Renowned", "Reach 50 fame.", g => g.fame >= 50);
      add("rep100", "Village Hero", "Reach 100 reputation.", g => g.reputation >= 100);
      add("family", "Family Bonds", "Keep 3 bonds above 70 affection.", g => g.relationships.filter(r => (r.meters.affection || 0) >= 70).length >= 3);
      add("trait5", "Strong Character", "Develop a trait to 10.", g => Object.keys(g.personality || {}).some(k => g.personality[k] >= 10));
      // Hidden legendary
      add("leg_kage", "Shadow of the Village", "Become the Village Leader.", g => C.rankTier(g.rank) >= 8, { legendary: true, hidden: true });
      add("leg_legend", "Living Legend", "Become a Legendary Shinobi.", g => g.rank === "legend", { legendary: true, hidden: true });
      add("leg_blood", "Chosen Blood", "Be born with a bloodline.", g => !!g.char.bloodline, { legendary: true, hidden: true });
      add("leg_sharingan", "Copy Wheel", "Awaken the three-tomoe Sharingan.", g => g.dojutsu.type === "sharingan" && ["tomoe3", "mangekyo", "eternal"].indexOf(g.dojutsu.stage) !== -1, { legendary: true, hidden: true });
      add("leg_mangekyo", "Beyond Sight", "Awaken the Mangekyo Sharingan.", g => ["mangekyo", "eternal"].indexOf(g.dojutsu.stage) !== -1, { legendary: true, hidden: true });
      add("leg_jin", "Host", "Become a Jinchuriki.", g => !!g.jinchuriki, { legendary: true, hidden: true });
      add("leg_bond", "Perfect Synchronisation", "Reach 90 synchronisation with a Tailed Beast.", g => g.jinchuriki && g.jinchuriki.sync >= 90, { legendary: true, hidden: true });
      add("leg_old", "Immortal Spirit", "Live to age 90.", g => g.age >= 90, { legendary: true, hidden: true });
      return a;
    })(),

    check() {
      const g = State.g; if (!g) return [];
      const won = [];
      this.list.forEach(a => {
        if (g.achievements[a.id]) return;
        let ok = false;
        try { ok = !!a.test(g); } catch (e) { ok = false; }
        if (ok) {
          g.achievements[a.id] = true;
          won.push(a);
          Log.line(`Achievement: ${a.name}.`, a.legendary ? "big" : "good");
          SLS.UI && SLS.UI.toast(a.legendary ? "⭐ Legendary Achievement" : "🏅 Achievement", a.name, a.legendary ? "legendary" : "good");
        }
      });
      return won;
    },
    count() { return Object.keys(State.g.achievements || {}).length; }
  };
  SLS.Achievements = Achievements;

  /* =================================================================
     ENDINGS
     ================================================================= */
  const Endings = {
    types: {
      leader:   { name: "The Village Leader",  ico: "🏯", text: "You rose to lead your village, guiding a new generation. Your face is carved into the mountain." },
      hero:     { name: "Legendary Hero",      ico: "🌟", text: "Songs are sung of your deeds. You died a legend, mourned by an entire nation." },
      wanderer: { name: "The Wandering Ninja", ico: "🍃", text: "You spent your final years roaming, owing nothing to anyone." },
      missing:  { name: "The Missing-Nin",     ico: "🥷", text: "You turned your back on the village and lived by your own code — hunted to the last." },
      retired:  { name: "The Retired Master",  ico: "🍵", text: "You laid down your blade and taught the young until your hands finally stilled." },
      fallen:   { name: "The Fallen Warrior",  ico: "⚰️", text: "You fell in battle, as shinobi so often do. Your comrades carried you home." },
      host:     { name: "The Perfect Host",    ico: "🦊", text: "You and your beast ended as one mind. Neither of you was ever a prisoner again." },
      civilian: { name: "The Quiet Life",      ico: "🏡", text: "You never wore a headband. You lived, you loved, and the village never knew your name." }
    },
    decide() {
      const g = State.g;
      if (g.flags.defected) return "missing";
      if (g.jinchuriki && g.jinchuriki.sync >= 85) return "host";
      if (C.rankTier(g.rank) >= 8) return RNG.chance(0.5) ? "leader" : "hero";
      if (!g.academy.graduated) return "civilian";
      if (g.fame >= 40 || g.bossesBeaten >= 5) return "hero";
      if (C.rankTier(g.rank) >= 4) return "retired";
      return "wanderer";
    },
    trigger(type) {
      const g = State.g;
      g.flags.dead = true;
      const e = this.types[type] || this.types.retired;
      Log.time(g.age, `☯ Passed away at ${g.age}. (${e.name})`);
      Save.save();
      return e;
    }
  };
  SLS.Endings = Endings;

})();
