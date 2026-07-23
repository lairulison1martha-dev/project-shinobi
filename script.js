/* =================================================================
   SHINOBI LIFE SIMULATOR — script.js
   -----------------------------------------------------------------
   A single-file, dependency-free ninja life-sim RPG.

   Module map (all under the global `SLS` namespace):
     RNG          - random helpers
     Data         - static content tables
     Generators   - procedural content (techniques, missions, events,
                    NPCs, characters, world events, bosses)
     State        - the single game-state object + helpers
     Save         - localStorage persistence (autosave / export / import)
     Engine       - core yearly loop, activities, progression, death
     Combat       - turn-based battles + personality-driven enemy AI
     Missions     - mission board + resolution
     Exams        - rank-promotion milestone challenges
     Minigames    - training minigames
     Relations    - relationships / bonds
     Shop         - economy, inventory, equipment
     Achievements - unlock tracking (incl. hidden legendary)
     Endings      - multiple life endings
     Audio        - sound-ready stub layer
     UI           - all DOM rendering + tab handling + toasts + modal
     Game         - bootstrap / init

   The whole thing is wrapped in an IIFE and exposes `window.SLS`
   so generated markup can call handlers via onclick.
   ================================================================= */
(function () {
  "use strict";

  const SLS = {};
  window.SLS = SLS;

  /* ===============================================================
     RNG — random helpers
     =============================================================== */
  const RNG = {
    randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; },
    rand(min, max) { return Math.random() * (max - min) + min; },
    chance(p) { return Math.random() < p; },
    pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
    pickN(arr, n) {
      const copy = arr.slice(); const out = [];
      while (n-- > 0 && copy.length) out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
      return out;
    },
    // weighted pick: items = [{v, w}]
    weighted(items) {
      const total = items.reduce((s, i) => s + i.w, 0);
      let r = Math.random() * total;
      for (const it of items) { if ((r -= it.w) <= 0) return it.v; }
      return items[items.length - 1].v;
    },
    roll(sides) { return Math.floor(Math.random() * sides) + 1; }
  };
  SLS.RNG = RNG;

  /* ===============================================================
     DATA — static content tables
     =============================================================== */
  const Data = {
    // Six hidden villages, each nudges starting stats + affinity odds.
    villages: [
      { id: "leaf", name: "Hidden Leaf", crest: "🍃", desc: "Village of camaraderie and the Will of Fire.", affinity: "Fire", bonus: { willpower: 4, taijutsu: 3 } },
      { id: "sand", name: "Hidden Sand", crest: "🏜️", desc: "Desert warriors, masters of puppetry and wind.", affinity: "Wind", bonus: { speed: 4, ninjutsu: 2 } },
      { id: "mist", name: "Hidden Mist", crest: "🌊", desc: "The Bloody Mist — brutal swordsmen and silent killers.", affinity: "Water", bonus: { weapon: 5, strength: 2 } },
      { id: "cloud", name: "Hidden Cloud", crest: "⚡", desc: "Mountain village of raw power and lightning speed.", affinity: "Lightning", bonus: { strength: 4, speed: 3 } },
      { id: "stone", name: "Hidden Stone", crest: "🪨", desc: "Immovable earth ninja with iron resolve.", affinity: "Earth", bonus: { health: 6, strength: 3 } },
      { id: "rain", name: "Hidden Rain", crest: "🌧️", desc: "Secretive village forged by endless war.", affinity: "Water", bonus: { intelligence: 4, genjutsu: 3 } }
    ],

    difficulties: [
      { id: "casual", name: "Casual", desc: "Faster growth, forgiving combat.", gainMul: 1.35, dangerMul: 0.7, ironman: false },
      { id: "normal", name: "Normal", desc: "The balanced shinobi path.", gainMul: 1.0, dangerMul: 1.0, ironman: false },
      { id: "hardcore", name: "Hardcore", desc: "Slow growth, deadly foes.", gainMul: 0.78, dangerMul: 1.4, ironman: false },
      { id: "ironman", name: "Ironman", desc: "One save. Death is permanent.", gainMul: 0.85, dangerMul: 1.5, ironman: true }
    ],

    elements: ["Fire", "Water", "Wind", "Earth", "Lightning"],
    // Technique categories (types)
    techTypes: ["Ninjutsu", "Taijutsu", "Genjutsu", "Medical", "Sealing", "Summoning", "Weapon Arts"],

    // Rare bloodlines (kekkei genkai). Low spawn weight.
    bloodlines: [
      { id: "sharingan", name: "Mirror Eye", desc: "Copy techniques and see through illusions.", bonus: { genjutsu: 12, ninjutsu: 8, intelligence: 6 } },
      { id: "byakugan", name: "All-Seeing Eye", desc: "360° vision and precise chakra strikes.", bonus: { taijutsu: 12, speed: 6, intelligence: 6 } },
      { id: "ice", name: "Ice Release", desc: "Fuse water and wind into deadly ice.", bonus: { ninjutsu: 12, chakra: 20 } },
      { id: "wood", name: "Wood Release", desc: "Grow forests from raw life energy.", bonus: { ninjutsu: 10, health: 30, chakra: 25 } },
      { id: "steel", name: "Steel Skin", desc: "Harden your body into living metal.", bonus: { strength: 12, health: 25 } },
      { id: "storm", name: "Storm Release", desc: "Bend lightning-charged water at will.", bonus: { ninjutsu: 10, speed: 6 } }
    ],

    // Clans — one assigned at birth. Rare clans have low weight.
    clans: [
      { id: "civilian", name: "No Clan", w: 40, desc: "Common blood, boundless potential.", bonus: {}, bloodlineChance: 0.0 },
      { id: "inaba", name: "Inaba", w: 14, desc: "Tactical beast-tamers.", bonus: { speed: 3, intelligence: 2 }, bloodlineChance: 0.02 },
      { id: "moryo", name: "Moryo", w: 12, desc: "Shadow manipulators.", bonus: { genjutsu: 4 }, bloodlineChance: 0.02 },
      { id: "kaguya", name: "Kaguya", w: 8, desc: "Savage bone warriors.", bonus: { strength: 4, taijutsu: 3 }, bloodlineChance: 0.05 },
      { id: "senju", name: "Senju", w: 5, desc: "The clan of a thousand skills.", bonus: { health: 12, chakra: 10, willpower: 4 }, bloodlineChance: 0.18 },
      { id: "uzumaki", name: "Uzumaki", w: 5, desc: "Vast chakra and sealing mastery.", bonus: { chakra: 30, health: 15 }, bloodlineChance: 0.10 },
      { id: "uchiwa", name: "Uchiwa", w: 4, desc: "Fire-blooded prodigies.", bonus: { ninjutsu: 5, genjutsu: 3 }, bloodlineChance: 0.45 },
      { id: "hyoga", name: "Hyoga", w: 4, desc: "Noble gentle-fist lineage.", bonus: { taijutsu: 5, speed: 3 }, bloodlineChance: 0.45 }
    ],

    personalities: [
      "Brave", "Calm", "Reckless", "Cunning", "Loyal", "Ambitious", "Lazy", "Kind",
      "Cold", "Cheerful", "Serious", "Rebellious", "Stoic", "Prideful", "Curious", "Vengeful"
    ],

    // 16 tracked character stats (some are meters, some are attributes)
    statDefs: [
      { key: "intelligence", name: "Intelligence" },
      { key: "strength", name: "Strength" },
      { key: "speed", name: "Speed" },
      { key: "taijutsu", name: "Taijutsu" },
      { key: "ninjutsu", name: "Ninjutsu" },
      { key: "genjutsu", name: "Genjutsu" },
      { key: "weapon", name: "Weapon Skill" },
      { key: "willpower", name: "Willpower" },
      { key: "chakraControl", name: "Chakra Control" }
    ],

    // Life stages by age
    lifeStages: [
      { min: 0, max: 5, name: "Baby" },
      { min: 6, max: 11, name: "Academy Student" },
      { min: 12, max: 15, name: "Genin" },
      { min: 16, max: 19, name: "Chunin" },
      { min: 20, max: 29, name: "Jonin" },
      { min: 30, max: 44, name: "Elite Ninja" },
      { min: 45, max: 59, name: "Anbu" },
      { min: 60, max: 200, name: "Veteran Shinobi" }
    ],

    // Formal ranks (progression ladder). Index used for gating.
    ranks: ["Academy Student", "Genin", "Chunin", "Jonin", "Elite", "Captain", "Anbu", "Village Leader", "Legendary Shinobi"],

    // Mission ranks and their power/reward tuning
    missionRanks: {
      D: { power: 12, pay: [40, 90], xp: 12, danger: 0.08 },
      C: { power: 26, pay: [110, 240], xp: 26, danger: 0.16 },
      B: { power: 45, pay: [280, 520], xp: 46, danger: 0.28 },
      A: { power: 70, pay: [600, 1100], xp: 78, danger: 0.42 },
      S: { power: 105, pay: [1400, 2600], xp: 130, danger: 0.58 },
      SS: { power: 150, pay: [3200, 6000], xp: 220, danger: 0.72 }
    },

    // Name fragments for procedural NPC + player names
    namesA: ["Kaze", "Rai", "Hino", "Mizu", "Tsuchi", "Yami", "Hikari", "Kuro", "Shiro", "Aka", "Ao", "Gin", "Kin", "Hebi", "Taka", "Ryu", "Ushi", "Ken", "Sora", "Tsuki"],
    namesB: ["maru", "ta", "ko", "shi", "ro", "mi", "na", "suke", "hime", "jiro", "saburo", "ne", "ki", "to", "ya", "zen", "gen", "sai"],

    // Shop catalog templates (expanded procedurally by tier)
    shopBase: [
      { type: "weapon", name: "Kunai Set", ico: "🔪", stat: "weapon" },
      { type: "weapon", name: "Shuriken Pouch", ico: "✳️", stat: "weapon" },
      { type: "weapon", name: "Ninja Blade", ico: "🗡️", stat: "weapon" },
      { type: "weapon", name: "War Fan", ico: "🪭", stat: "weapon" },
      { type: "armor", name: "Mesh Armor", ico: "🦺", stat: "health" },
      { type: "armor", name: "Flak Jacket", ico: "🧥", stat: "health" },
      { type: "clothing", name: "Shinobi Garb", ico: "👘", stat: "willpower" },
      { type: "training", name: "Weight Set", ico: "🏋️", stat: "strength" },
      { type: "training", name: "Chakra Weights", ico: "⚖️", stat: "chakraControl" },
      { type: "food", name: "Ration Pack", ico: "🍙", stat: "health", consumable: true },
      { type: "food", name: "Soldier Pill", ico: "💊", stat: "chakra", consumable: true },
      { type: "house", name: "Small Apartment", ico: "🏠", stat: "willpower", house: true },
      { type: "house", name: "Clan Estate", ico: "🏯", stat: "willpower", house: true }
    ],

    // Village map nodes
    mapNodes: [
      { id: "training", ico: "🌲", name: "Training Grounds", sub: "Train & minigames", tab: "actions" },
      { id: "academy", ico: "🏫", name: "Academy", sub: "Study & learn", tab: "actions" },
      { id: "market", ico: "🏪", name: "Market District", sub: "Buy gear", tab: "shop" },
      { id: "hq", ico: "🏯", name: "Mission HQ", sub: "Accept missions", tab: "missions" },
      { id: "gate", ico: "⛩️", name: "Village Gate", sub: "Explore beyond", tab: "actions" },
      { id: "hall", ico: "📜", name: "Hall of Records", sub: "Techniques", tab: "techniques" }
    ]
  };
  SLS.Data = Data;

  /* ===============================================================
     GENERATORS — procedural content
     =============================================================== */
  const Gen = {
    name() { return RNG.pick(Data.namesA) + RNG.pick(Data.namesB); },

    // ---- Techniques: build a large pool (hundreds) --------------
    _techPool: null,
    techniques() {
      if (this._techPool) return this._techPool;
      const pool = [];
      const tiers = [
        { t: 1, adj: ["Lesser", "Basic", "Novice"], rank: "D", cost: 8, power: 10, req: 5 },
        { t: 2, adj: ["Greater", "Trained", "Focused"], rank: "C", cost: 16, power: 22, req: 20 },
        { t: 3, adj: ["Master", "Grand", "Twin"], rank: "B", cost: 28, power: 40, req: 40 },
        { t: 4, adj: ["Forbidden", "Ultimate", "Sage"], rank: "A", cost: 46, power: 68, req: 65 },
        { t: 5, adj: ["Legendary", "Divine", "Ancient"], rank: "S", cost: 70, power: 100, req: 90 }
      ];
      // Nouns per category to build flavourful names
      const nouns = {
        "Ninjutsu": { Fire: ["Fireball", "Phoenix Flame", "Ember Storm", "Blazing Fang"], Water: ["Water Dragon", "Tearing Torrent", "Mist Veil", "Shark Bomb"], Wind: ["Gale Palm", "Cutting Wind", "Vacuum Sphere", "Tempest"], Earth: ["Mud Wall", "Stone Spear", "Earth Dragon", "Quagmire"], Lightning: ["Lightning Fang", "Thunder Clap", "Chidori Spark", "Storm Blade"] },
        "Taijutsu": { All: ["Leaf Whirlwind", "Iron Fist", "Shadow Dance", "Rising Knee", "Falcon Drop", "Gentle Palm"] },
        "Genjutsu": { All: ["Demonic Illusion", "False Surroundings", "Mind Fog", "Nightmare Weave", "Mirror Haze"] },
        "Medical": { All: ["Mystic Palm", "Cell Regeneration", "Poison Purge", "Chakra Scalpel", "Healing Rain"] },
        "Sealing": { All: ["Five-Element Seal", "Contract Seal", "Barrier Wall", "Reaper Seal", "Storage Scroll"] },
        "Summoning": { All: ["Toad Summon", "Serpent Summon", "Hawk Summon", "Slug Summon", "Wolf Pack"] },
        "Weapon Arts": { All: ["Blade Storm", "Kunai Rain", "Wire Trap", "Chain Sweep", "Crescent Slash"] }
      };
      let id = 0;
      for (const type of Data.techTypes) {
        const groups = nouns[type];
        const keys = Object.keys(groups);
        for (const key of keys) {
          for (const base of groups[key]) {
            for (const tier of tiers) {
              // not every tier for every noun — keep variety but bounded
              if (RNG.chance(0.72)) {
                const adj = RNG.pick(tier.adj);
                const element = (type === "Ninjutsu") ? key : (RNG.chance(0.35) ? RNG.pick(Data.elements) : null);
                pool.push({
                  id: "tq" + (id++),
                  name: adj + " " + base,
                  type,
                  element,
                  rank: tier.rank,
                  tier: tier.t,
                  cost: tier.cost + RNG.randInt(-3, 5),
                  power: tier.power + RNG.randInt(-4, 6),
                  req: tier.req,
                  // stat that gates learning
                  gate: type === "Taijutsu" ? "taijutsu" : type === "Genjutsu" ? "genjutsu" : type === "Weapon Arts" ? "weapon" : type === "Medical" ? "intelligence" : "ninjutsu"
                });
              }
            }
          }
        }
      }
      this._techPool = pool;
      return pool;
    },

    // ---- Missions ----------------------------------------------
    _missionTemplates: [
      { rank: "D", verb: "Retrieve", obj: ["a lost cat", "stolen groceries", "a farmer's tools", "a missing scroll"] },
      { rank: "D", verb: "Guard", obj: ["a merchant stall", "the village gate", "a rice shipment"] },
      { rank: "C", verb: "Escort", obj: ["a bridge builder", "a traveling merchant", "a minor noble"] },
      { rank: "C", verb: "Investigate", obj: ["bandit sightings", "a haunted shrine", "missing livestock"] },
      { rank: "B", verb: "Eliminate", obj: ["a bandit camp", "a rogue mercenary", "a smuggling ring"] },
      { rank: "B", verb: "Retrieve", obj: ["a stolen artifact", "classified documents", "a kidnapped heir"] },
      { rank: "A", verb: "Assassinate", obj: ["a corrupt official", "an enemy commander", "a missing-nin"] },
      { rank: "A", verb: "Defend", obj: ["a border outpost", "an allied village", "a vital bridge"] },
      { rank: "S", verb: "Hunt", obj: ["an S-rank missing-nin", "a rogue jinchuriki", "a criminal ringleader"] },
      { rank: "S", verb: "Infiltrate", obj: ["an enemy fortress", "a hidden black market", "a rival village"] },
      { rank: "SS", verb: "Confront", obj: ["a legendary criminal", "an immortal swordsman", "the masked mastermind"] }
    ],
    mission(rankFilter) {
      const pool = rankFilter ? this._missionTemplates.filter(t => t.rank === rankFilter) : this._missionTemplates;
      const t = RNG.pick(pool);
      const cfg = Data.missionRanks[t.rank];
      const pay = RNG.randInt(cfg.pay[0], cfg.pay[1]);
      return {
        id: "m" + Date.now() + RNG.randInt(0, 9999),
        rank: t.rank,
        title: t.verb + " " + RNG.pick(t.obj),
        desc: "A rank-" + t.rank + " assignment. Requires strength worthy of the task.",
        power: cfg.power + RNG.randInt(-4, 6),
        pay, xp: cfg.xp, danger: cfg.danger,
        combat: ["B", "A", "S", "SS"].includes(t.rank) && RNG.chance(0.6)
      };
    },
    missionBoard(n) {
      // Offer missions scaled around the player's rank.
      const board = [];
      const ri = State.g ? State.rankIndex() : 1;
      const allowed = ri <= 1 ? ["D", "C"] : ri === 2 ? ["D", "C", "B"] : ri === 3 ? ["C", "B", "A"] : ["B", "A", "S", "SS"];
      for (let i = 0; i < n; i++) board.push(this.mission(RNG.pick(allowed)));
      return board;
    },

    // ---- NPCs (thousands, generated lazily) --------------------
    npc(opts) {
      opts = opts || {};
      const village = opts.village || RNG.pick(Data.villages).name;
      const clan = RNG.pick(Data.clans);
      return {
        id: "npc" + (State.g ? State.g.npcSeq++ : RNG.randInt(0, 1e9)),
        name: this.name(),
        village,
        clan: clan.name,
        rank: opts.rank || RNG.pick(Data.ranks.slice(0, 6)),
        personality: RNG.pick(Data.personalities),
        power: opts.power || RNG.randInt(10, 90),
        fav: RNG.pick(this.techniques()).name,
        affinity: opts.rare ? null : null
      };
    },

    // ---- Character (birth) -------------------------------------
    character(villageId, name, difficultyId) {
      const village = Data.villages.find(v => v.id === villageId) || Data.villages[0];
      const difficulty = Data.difficulties.find(d => d.id === difficultyId) || Data.difficulties[1];
      const clan = RNG.weighted(Data.clans.map(c => ({ v: c, w: c.w })));

      // Base stats with mild randomness
      const base = () => RNG.randInt(3, 10);
      const stats = {
        intelligence: base(), strength: base(), speed: base(),
        taijutsu: base(), ninjutsu: base(), genjutsu: base(),
        weapon: base(), willpower: base(), chakraControl: base()
      };
      // Apply village bonus
      for (const k in village.bonus) if (k in stats) stats[k] += village.bonus[k];
      // Apply clan bonus (stats only; meters handled below)
      for (const k in clan.bonus) if (k in stats) stats[k] += clan.bonus[k];

      // Chakra reserves & health & stamina meters
      let maxChakra = RNG.randInt(60, 120);
      let maxHealth = RNG.randInt(80, 130);
      let maxStamina = RNG.randInt(70, 110);
      for (const src of [village.bonus, clan.bonus]) {
        if (src.chakra) maxChakra += src.chakra;
        if (src.health) maxHealth += src.health;
      }

      // Chakra affinity: sometimes multiple
      const affinities = [village.affinity];
      if (RNG.chance(0.28)) { const extra = RNG.pick(Data.elements); if (!affinities.includes(extra)) affinities.push(extra); }

      // Bloodline: rare, boosted by clan chance
      let bloodline = null;
      if (RNG.chance(clan.bloodlineChance || 0.03)) {
        bloodline = RNG.pick(Data.bloodlines);
        for (const k in bloodline.bonus) {
          if (k in stats) stats[k] += bloodline.bonus[k];
          else if (k === "chakra") maxChakra += bloodline.bonus[k];
          else if (k === "health") maxHealth += bloodline.bonus[k];
        }
      }

      const family = {
        motherAlive: RNG.chance(0.85),
        fatherAlive: RNG.chance(0.85),
        siblings: RNG.randInt(0, 3),
        heritage: RNG.pick(["Merchant", "Shinobi", "Farmer", "Noble", "Blacksmith", "Medic", "Wandering"])
      };

      const traits = RNG.pickN(Data.personalities, RNG.randInt(2, 3));

      return {
        name: name || this.name(),
        village: village.id, villageName: village.name, crest: village.crest,
        difficulty: difficulty.id,
        clan: clan.name, clanId: clan.id,
        affinities, bloodline: bloodline ? bloodline.name : null, bloodlineDesc: bloodline ? bloodline.desc : null,
        traits, family,
        stats,
        maxChakra, maxHealth, maxStamina
      };
    },

    // ---- Random personal life events ---------------------------
    // Templates use {stat} deltas + choices. Substitution via {name}/{place}.
    event() {
      const npcName = this.name();
      const place = RNG.pick(["the market", "the training field", "a quiet teahouse", "the village gate", "the forest", "a rooftop", "the academy yard", "a hot spring"]);
      const templates = [
        { title: "A Stranger's Challenge", text: `A cocky genin named ${npcName} challenges you to a duel near ${place}.`,
          choices: [
            { label: "Accept the duel", sub: "Fight for pride", fx: { combat: "duel" } },
            { label: "Decline politely", sub: "Keep the peace", fx: { willpower: -1, rep: 1 } }
          ] },
        { title: "Rare Scroll Discovery", text: `While exploring ${place}, you find a weathered scroll humming with chakra.`,
          choices: [
            { label: "Study it now", sub: "Risky but rewarding", fx: { learnTech: true, chakra: -20 } },
            { label: "Store it safely", sub: "For later", fx: { item: "scroll" } }
          ] },
        { title: "A Wounded Traveler", text: `You find an injured traveler collapsed at ${place}.`,
          choices: [
            { label: "Heal them", sub: "Costs chakra", fx: { chakra: -15, rep: 3, intelligence: 1 } },
            { label: "Rob them", sub: "Dishonorable", fx: { wealth: 120, rep: -6, fame: 1 } },
            { label: "Walk away", sub: "Not your problem", fx: {} }
          ] },
        { title: "Festival Invitation", text: `${npcName} invites you to the village festival.`,
          choices: [
            { label: "Go together", sub: "Build a bond", fx: { relation: 8, willpower: 2 } },
            { label: "Train instead", sub: "No days off", fx: { strength: 1, speed: 1, willpower: -1 } }
          ] },
        { title: "Assassination Attempt", text: `A masked figure lunges at you from the shadows near ${place}!`,
          choices: [
            { label: "Fight back", sub: "Survive", fx: { combat: "assassin" } },
            { label: "Flee", sub: "Speed check", fx: { flee: true } }
          ] },
        { title: "A Sensei's Offer", text: `A retired jonin, ${npcName}, offers to mentor you.`,
          choices: [
            { label: "Accept mentorship", sub: "Gain a sensei", fx: { sensei: true } },
            { label: "Refuse", sub: "Walk alone", fx: { willpower: 2 } }
          ] },
        { title: "Lost Child", text: `A crying child is lost near ${place}.`,
          choices: [
            { label: "Help them home", sub: "Kindness", fx: { rep: 4, willpower: 1 } },
            { label: "Ignore them", sub: "", fx: { rep: -2 } }
          ] },
        { title: "Gambling Den", text: `You stumble upon a shady gambling den behind ${place}.`,
          choices: [
            { label: "Bet big", sub: "Fortune favors...", fx: { gamble: true } },
            { label: "Leave", sub: "", fx: {} }
          ] },
        { title: "Rival Appears", text: `${npcName} declares themselves your eternal rival!`,
          choices: [
            { label: "Accept the rivalry", sub: "Push each other", fx: { rival: true } },
            { label: "Laugh it off", sub: "", fx: { fame: -1 } }
          ] },
        { title: "Poisoned Blade", text: `You nick yourself on a poisoned trap wire at ${place}.`,
          choices: [
            { label: "Endure it", sub: "Willpower", fx: { health: -25, willpower: 3 } },
            { label: "Rush to a medic", sub: "Costs money", fx: { wealth: -80, health: -5 } }
          ] },
        { title: "Secret Mission", text: `An anbu operative slips you a coded request behind ${place}.`,
          choices: [
            { label: "Take the mission", sub: "High risk", fx: { combat: "secret" } },
            { label: "Report it", sub: "Play it safe", fx: { rep: 3 } }
          ] },
        { title: "Meditative Vision", text: `Deep meditation grants you a fleeting vision of your chakra network.`,
          choices: [
            { label: "Embrace it", sub: "", fx: { chakraControl: 3, ninjutsu: 2 } },
            { label: "Resist it", sub: "", fx: { willpower: 3 } }
          ] }
      ];
      return RNG.pick(templates);
    },

    // ---- World / village-scale events --------------------------
    worldEvent() {
      const events = [
        { title: "The Great Ninja War Erupts", text: "War breaks out between the great villages. Every shinobi is called to the front.", fx: { warYears: 3 }, kind: "war" },
        { title: "Kage Summit", text: "The village leaders gather for a historic summit. Tensions run high.", fx: { rep: 5 }, kind: "politics" },
        { title: "Village Festival", text: "A grand festival lifts the whole village's spirits.", fx: { willpower: 3, health: 10 }, kind: "festival" },
        { title: "Natural Disaster", text: "An earthquake devastates the village. Everyone must help rebuild.", fx: { health: -15, rep: 4 }, kind: "disaster" },
        { title: "Political Conflict", text: "A power struggle erupts within the village council.", fx: { fame: 2 }, kind: "politics" },
        { title: "Missing-Nin Incident", text: "A powerful missing-nin raids the outskirts of the village!", fx: { combat: "missingnin" }, kind: "attack" },
        { title: "Golden Age of Prosperity", text: "Trade flourishes; missions and pay are plentiful this year.", fx: { wealth: 400 }, kind: "boom" }
      ];
      return RNG.pick(events);
    },

    // ---- Bosses ------------------------------------------------
    boss(kind) {
      const bosses = {
        missingnin: { name: "Rogue S-Rank Missing-Nin", ava: "🥷", hp: 320, cp: 160, atk: 46, def: 26, spd: 34, ai: "Tactical", reward: 2200, xp: 260 },
        assassin: { name: "Masked Assassin", ava: "🎭", hp: 200, cp: 120, atk: 40, def: 18, spd: 44, ai: "Reckless", reward: 900, xp: 130 },
        secret: { name: "Enemy Anbu Captain", ava: "🐈‍⬛", hp: 260, cp: 150, atk: 42, def: 24, spd: 36, ai: "Tactical", reward: 1600, xp: 190 },
        summon: { name: "Giant Serpent Summon", ava: "🐍", hp: 520, cp: 100, atk: 54, def: 34, spd: 20, ai: "Aggressive", reward: 3000, xp: 340 },
        org: { name: "Criminal Syndicate Leader", ava: "☠️", hp: 600, cp: 220, atk: 60, def: 38, spd: 30, ai: "Tactical", reward: 4200, xp: 480 },
        legend: { name: "Legendary Shinobi", ava: "👹", hp: 800, cp: 320, atk: 72, def: 46, spd: 40, ai: "Tactical", reward: 6000, xp: 700 }
      };
      const b = Object.assign({}, bosses[kind] || bosses.missingnin);
      b.boss = true; b.maxHp = b.hp; b.maxCp = b.cp; b.charge = 0;
      return b;
    }
  };
  SLS.Gen = Gen;

  /* ===============================================================
     STATE — the single game-state object
     =============================================================== */
  const State = {
    g: null, // active game

    fresh(character) {
      const diff = Data.difficulties.find(d => d.id === character.difficulty) || Data.difficulties[1];
      return {
        version: 1,
        seed: Date.now(),
        char: character,
        age: 0,
        level: 1,
        xp: 0,
        xpNext: 40,
        rank: "Academy Student",
        // meters
        health: character.maxHealth,
        chakra: character.maxChakra,
        stamina: character.maxStamina,
        // social / economy meters
        wealth: RNG.randInt(50, 150),
        fame: 0,
        reputation: 0, // global
        villageRep: {}, // per-village reputation
        // progression
        elementMastery: {}, // element -> 0..100
        // collections
        techniques: [], // learned technique ids
        techMastery: {}, // techId -> 0..100
        inventory: [],
        equipped: { weapon: null, armor: null },
        relationships: [], // {npc, type, affinity}
        team: [],
        // logs
        timeline: [],
        journal: [],
        achievements: {}, // id -> true
        // flags
        flags: { warYears: 0, hasSensei: false, dead: false, retired: false },
        missionsDone: 0,
        bossesBeaten: 0,
        difficultyCfg: diff,
        settings: { autosave: true, sound: true },
        npcSeq: 1,
        pendingBoard: null
      };
    },

    start(character) {
      this.g = this.fresh(character);
      this.g.villageRep[character.villageName] = 5;
      Engine.log(`Born into the ${character.villageName} as a member of the ${character.clan} clan.`, "big");
      Engine.timeline(0, `Born in the ${character.villageName}.`);
      Achievements.check();
      return this.g;
    },

    // ----- derived helpers -----
    stage() {
      const a = this.g.age;
      const s = Data.lifeStages.find(st => a >= st.min && a <= st.max);
      return s ? s.name : "Legendary Shinobi";
    },
    rankIndex() { return Math.max(0, Data.ranks.indexOf(this.g.rank)); },

    // combined stat including equipment bonus
    stat(key) {
      let v = this.g.char.stats[key] || 0;
      for (const slot of ["weapon", "armor"]) {
        const it = this.g.equipped[slot];
        if (it && it.stat === key) v += it.bonus;
      }
      return v;
    },
    // overall power rating used across missions/combat
    power() {
      const s = this.g.char.stats;
      const gear = (this.g.equipped.weapon ? this.g.equipped.weapon.bonus : 0) + (this.g.equipped.armor ? this.g.equipped.armor.bonus : 0);
      return Math.round(
        (s.strength + s.speed + s.taijutsu + s.ninjutsu + s.genjutsu + s.weapon) / 2 +
        s.chakraControl + this.g.level * 2 + gear + this.g.techniques.length
      );
    },

    addWealth(n) { this.g.wealth = Math.max(0, this.g.wealth + n); },
    addRep(n) {
      this.g.reputation += n;
      const vn = this.g.char.villageName;
      this.g.villageRep[vn] = (this.g.villageRep[vn] || 0) + n;
    },
    heal(n) { this.g.health = Math.min(this.g.char.maxHealth, this.g.health + n); },
    damage(n) { this.g.health = Math.max(0, this.g.health - n); },
    spendChakra(n) { this.g.chakra = Math.max(0, this.g.chakra - n); },
    spendStamina(n) { this.g.stamina = Math.max(0, this.g.stamina - n); },

    gainStat(key, n) {
      const mul = this.g.difficultyCfg.gainMul;
      this.g.char.stats[key] = Math.min(999, (this.g.char.stats[key] || 0) + n * mul);
      this.g.char.stats[key] = Math.round(this.g.char.stats[key] * 10) / 10;
    },
    gainXP(n) {
      this.g.xp += Math.round(n * this.g.difficultyCfg.gainMul);
      while (this.g.xp >= this.g.xpNext && this.g.level < 100) {
        this.g.xp -= this.g.xpNext;
        this.g.level++;
        this.g.xpNext = Math.round(this.g.xpNext * 1.18 + 12);
        this.g.char.maxHealth += 6; this.g.char.maxChakra += 5; this.g.char.maxStamina += 3;
        this.heal(6); this.g.chakra += 5;
        Engine.log(`Reached level ${this.g.level}!`, "good");
        Audio.play("levelup");
      }
    },
    gainElementMastery(el, n) {
      if (!el) return;
      this.g.elementMastery[el] = Math.min(100, (this.g.elementMastery[el] || 0) + n);
    }
  };
  SLS.State = State;

  /* ===============================================================
     SAVE — localStorage persistence
     =============================================================== */
  const Save = {
    KEY: "shinobi-save-v1",
    save() {
      if (!State.g) return;
      try { localStorage.setItem(this.KEY, JSON.stringify(State.g)); } catch (e) { /* quota */ }
    },
    autosave() { if (State.g && State.g.settings.autosave) this.save(); },
    load() {
      try {
        const raw = localStorage.getItem(this.KEY);
        if (!raw) return null;
        const g = JSON.parse(raw);
        if (!g || g.version !== 1) return null;
        return g;
      } catch (e) { return null; }
    },
    has() { return !!localStorage.getItem(this.KEY); },
    wipe() { localStorage.removeItem(this.KEY); },
    export() {
      if (!State.g) return "";
      return btoa(unescape(encodeURIComponent(JSON.stringify(State.g))));
    },
    import(str) {
      try {
        const g = JSON.parse(decodeURIComponent(escape(atob(str.trim()))));
        if (g && g.version === 1) { State.g = g; return true; }
      } catch (e) { }
      return false;
    }
  };
  SLS.Save = Save;

  /* ===============================================================
     AUDIO — sound-ready stub (no bundled files; hook points only)
     =============================================================== */
  const Audio = {
    enabled: true,
    // Map of logical sound keys → future asset URLs.
    sounds: {
      click: null, levelup: null, hit: null, win: null, lose: null,
      unlock: null, coin: null, promote: null, event: null
    },
    play(key) {
      if (!Audio.enabled || !State.g || !State.g.settings.sound) return;
      // When real audio is added, instantiate/pool Audio objects here.
      // Left as a no-op so the architecture stays sound-ready.
    }
  };
  SLS.Audio = Audio;

  /* ===============================================================
     ENGINE — yearly loop, activities, progression, aging, death
     =============================================================== */
  const Engine = {
    log(text, kind) {
      if (!State.g) return;
      State.g.journal.unshift({ age: State.g.age, text, kind: kind || "" });
      if (State.g.journal.length > 200) State.g.journal.pop();
    },
    timeline(age, text) {
      State.g.timeline.push({ age, text });
    },

    // ---- Activities (do not advance the year; cost stamina) -----
    activities: {
      train: { name: "Train", ico: "🥋", desc: "Push your body & chakra.", cost: 20 },
      study: { name: "Study", ico: "📚", desc: "Sharpen the mind.", cost: 15 },
      meditate: { name: "Meditate", ico: "🧘", desc: "Restore chakra, grow control.", cost: 8 },
      spar: { name: "Spar", ico: "⚔️", desc: "Duel a fellow ninja.", cost: 25 },
      minigame: { name: "Chakra Drills", ico: "🌀", desc: "Play a training minigame.", cost: 15 },
      befriend: { name: "Build Bonds", ico: "🤝", desc: "Meet someone new.", cost: 10 },
      team: { name: "Form Team", ico: "👥", desc: "Recruit a squad.", cost: 15 },
      tournament: { name: "Tournament", ico: "🏆", desc: "Enter a fighting bracket.", cost: 30 },
      explore: { name: "Explore", ico: "🧭", desc: "Venture beyond the walls.", cost: 20 },
      rest: { name: "Rest", ico: "😴", desc: "Recover health & stamina.", cost: 0 }
    },

    canAct(cost) { return State.alive() && State.g.stamina >= cost; },

    doActivity(key) {
      if (!State.g || State.g.flags.dead || State.g.flags.retired) return;
      const a = this.activities[key];
      if (!a) return;
      if (State.g.stamina < a.cost) { UI.toast("Too tired", "Rest or advance the year.", "bad"); return; }
      Audio.play("click");
      State.spendStamina(a.cost);

      switch (key) {
        case "train": UI.trainMenu(); return; // opens sub-menu, refunds handled there
        case "study": {
          State.gainStat("intelligence", RNG.rand(0.6, 1.4));
          State.gainStat("ninjutsu", RNG.rand(0.3, 0.9));
          State.gainStat("genjutsu", RNG.rand(0.2, 0.7));
          State.gainXP(10);
          this.log("Studied scrolls at the academy.", "");
          break;
        }
        case "meditate": {
          State.gainStat("chakraControl", RNG.rand(0.5, 1.3));
          State.gainStat("willpower", RNG.rand(0.2, 0.8));
          State.g.chakra = Math.min(State.g.char.maxChakra, State.g.chakra + 35);
          if (State.g.char.affinities[0]) State.gainElementMastery(State.g.char.affinities[0], RNG.randInt(1, 3));
          State.gainXP(6);
          this.log("Meditated and replenished chakra.", "");
          break;
        }
        case "rest": {
          State.heal(RNG.randInt(12, 24));
          State.g.stamina = State.g.char.maxStamina;
          State.g.chakra = Math.min(State.g.char.maxChakra, State.g.chakra + 25);
          this.log("Rested and recovered.", "");
          break;
        }
        case "spar": { this.sparMatch(); return; }
        case "minigame": { Minigames.menu(); return; }
        case "befriend": { Relations.meet(); break; }
        case "team": { Relations.formTeam(); break; }
        case "tournament": { this.tournament(); return; }
        case "explore": { this.explore(); break; }
      }
      Achievements.check();
      Save.autosave();
      UI.renderAll();
    },

    trainStat(stat) {
      State.gainStat(stat, RNG.rand(0.8, 1.8));
      State.gainStat("chakraControl", RNG.rand(0.1, 0.4));
      State.gainXP(12);
      this.log(`Trained hard, improving ${stat}.`, "");
      Achievements.check(); Save.autosave(); UI.closeModal(); UI.renderAll();
    },

    sparMatch() {
      const lvl = Math.max(1, State.g.level + RNG.randInt(-2, 1));
      const enemy = this.makeEnemy(lvl, "friendly");
      enemy.name = "Rival " + Gen.name();
      Combat.start(enemy, { friendly: true }, (res) => {
        if (res.win) { State.gainXP(20); State.addRep(1); this.log(`Won a spar against ${enemy.name}.`, "good"); }
        else { this.log(`Lost a spar against ${enemy.name}.`, ""); }
        Achievements.check(); Save.autosave(); UI.renderAll();
      });
    },

    tournament() {
      UI.modal(`<h2 class="modal-title">🏆 Village Tournament</h2>
        <p class="modal-text">Three rounds of combat await. Win them all for glory and gold.</p>
        <div class="modal-choices">
          <button class="choice-btn" onclick="SLS.Engine.tournamentRound(1,0)">Enter the Arena<span class="choice-sub">Round 1 of 3</span></button>
          <button class="choice-btn" onclick="SLS.UI.closeModal()">Withdraw</button>
        </div>`);
    },
    tournamentRound(round, wins) {
      UI.closeModal();
      const enemy = this.makeEnemy(State.g.level + round, "tournament");
      enemy.name = "Contender " + Gen.name();
      Combat.start(enemy, { tournament: true }, (res) => {
        if (!res.win) {
          const prize = wins * 250;
          if (prize) State.addWealth(prize);
          this.log(`Knocked out of the tournament in round ${round}.` + (prize ? ` Won ${prize} ryo.` : ""), "");
          UI.toast("Tournament over", `Placed after ${wins} win(s).`, wins >= 2 ? "good" : "");
          Achievements.check(); Save.autosave(); UI.renderAll();
          return;
        }
        wins++;
        if (round >= 3) {
          const prize = 1500;
          State.addWealth(prize); State.g.fame += 8; State.addRep(6); State.gainXP(120);
          State.g.flags.tournamentChamp = true;
          this.log(`Won the village tournament! (+${prize} ryo)`, "big");
          UI.toast("Champion!", "You won the tournament!", "legendary");
          Achievements.check(); Save.autosave(); UI.renderAll();
        } else {
          UI.modal(`<h2 class="modal-title">Round ${round} won!</h2>
            <p class="modal-text">You advance to round ${round + 1}.</p>
            <div class="modal-choices">
              <button class="choice-btn" onclick="SLS.Engine.tournamentRound(${round + 1}, ${wins})">Fight on<span class="choice-sub">Round ${round + 1} of 3</span></button>
            </div>`);
        }
      });
    },

    explore() {
      const roll = RNG.randInt(1, 100);
      if (roll <= 30) { const g = RNG.randInt(40, 200); State.addWealth(g); this.log(`Explored and found ${g} ryo.`, "good"); UI.toast("Found treasure", `+${g} ryo`, "good"); }
      else if (roll <= 55) { Shop.giveItem(Shop.randomItem()); this.log("Explored and found a useful item.", "good"); }
      else if (roll <= 75) { State.gainStat("speed", 1); State.gainStat("willpower", 0.5); State.gainXP(14); this.log("A long journey toughened you.", ""); }
      else if (roll <= 90) { const t = this.tryRandomTechnique(); this.log(t ? `Discovered a technique scroll: ${t}!` : "Explored distant lands.", t ? "good" : ""); }
      else { State.damage(RNG.randInt(10, 25)); this.log("Ran into trouble while exploring and got hurt.", "bad"); UI.toast("Ambushed!", "Lost some health exploring.", "bad"); }
    },

    tryRandomTechnique() {
      const pool = Gen.techniques().filter(t => !State.g.techniques.includes(t.id) && t.tier <= State.rankIndex() + 2);
      if (!pool.length) return null;
      const t = RNG.pick(pool);
      State.g.techniques.push(t.id);
      State.g.techMastery[t.id] = 5;
      Audio.play("unlock");
      return t.name;
    },

    // ---- Enemy builder for generic fights ----------------------
    makeEnemy(level, kind) {
      level = Math.max(1, level);
      const scale = State.g.difficultyCfg.dangerMul;
      const ai = RNG.pick(["Aggressive", "Defensive", "Tactical", "Reckless"]);
      const hp = Math.round((60 + level * 14) * scale);
      const cp = Math.round(40 + level * 8);
      return {
        name: Gen.name(), ava: RNG.pick(["🥷", "🧑‍🎤", "🗡️", "🏹", "👺", "🐗"]),
        level, ai,
        hp, maxHp: hp, cp, maxCp: cp, charge: 0,
        atk: Math.round((10 + level * 2.4) * scale),
        def: Math.round((5 + level * 1.5)),
        spd: Math.round(8 + level * 1.8 + RNG.randInt(-3, 3)),
        reward: kind === "friendly" ? 0 : Math.round(level * 30),
        xp: Math.round(level * 8)
      };
    },

    // ---- The core: advance one year ----------------------------
    advanceYear() {
      if (!State.g || State.g.flags.dead || State.g.flags.retired) return;
      Audio.play("click");
      const g = State.g;
      g.age++;

      // Passive recovery each year
      g.stamina = g.char.maxStamina;
      g.chakra = Math.min(g.char.maxChakra, g.chakra + Math.round(g.char.maxChakra * 0.4));
      State.heal(Math.round(g.char.maxHealth * 0.25));

      // War countdown & pressure
      if (g.flags.warYears > 0) g.flags.warYears--;

      // Small yearly stat drift from living
      if (g.age <= 15) { State.gainStat("intelligence", 0.2); }

      // Aging: after 50, chance of decline & rising mortality
      if (g.age >= 50) {
        if (RNG.chance(0.4)) {
          const s = RNG.pick(["speed", "strength", "taijutsu"]);
          g.char.stats[s] = Math.max(1, g.char.stats[s] - RNG.rand(0.5, 1.5));
        }
      }

      Engine.timeline(g.age, `Turned ${g.age}. (${State.stage()})`);

      // Decide this year's single interaction, then finish.
      // Priority: due exam > forced war attack > world event > personal event > nothing.
      const exam = Exams.due();
      if (exam) { Exams.trigger(exam, () => Engine.postYear()); return; }

      if (g.flags.warYears > 0 && RNG.chance(0.5)) {
        return this.runWorldEvent({ title: "Battlefield", text: "The war rages on. Enemy shinobi ambush your unit!", fx: { combat: "missingnin" }, kind: "attack" });
      }

      if (RNG.chance(0.14)) { return this.runWorldEvent(Gen.worldEvent()); }
      if (RNG.chance(0.55)) { return this.runPersonalEvent(Gen.event()); }

      Engine.postYear();
    },

    runWorldEvent(ev) {
      Audio.play("event");
      Engine.log(`World Event: ${ev.title}`, "big");
      Engine.timeline(State.g.age, `⚔ ${ev.title}`);
      const fx = ev.fx || {};
      if (fx.warYears) State.g.flags.warYears = fx.warYears;
      // Apply flat effects (non-combat)
      this.applyFx(fx, null);
      if (fx.combat) {
        UI.modal(`<h2 class="modal-title">${ev.title}</h2><p class="modal-text">${ev.text}</p>
          <div class="modal-choices"><button class="choice-btn" onclick="SLS.Engine.resolveEventCombat('${fx.combat}')">Face the threat<span class="choice-sub">Boss battle</span></button></div>`);
      } else {
        UI.modal(`<h2 class="modal-title">${ev.title}</h2><p class="modal-text">${ev.text}</p>
          <div class="modal-choices"><button class="choice-btn" onclick="SLS.UI.closeModal(); SLS.Engine.postYear();">Continue</button></div>`);
      }
    },

    runPersonalEvent(ev) {
      Audio.play("event");
      UI.eventModal(ev, () => Engine.postYear());
    },

    resolveEventCombat(kind) {
      UI.closeModal();
      const boss = Gen.boss(kind);
      Combat.start(boss, { boss: true }, (res) => {
        if (res.win) {
          State.addWealth(boss.reward); State.gainXP(boss.xp); State.g.fame += 6; State.addRep(5);
          State.g.bossesBeaten++;
          Engine.log(`Defeated ${boss.name}! (+${boss.reward} ryo)`, "big");
          UI.toast("Victory!", `Defeated ${boss.name}`, "legendary");
        } else if (res.fled) {
          Engine.log(`Fled from ${boss.name}.`, "");
        } else {
          State.damage(Math.round(State.g.char.maxHealth * 0.3));
          Engine.log(`Was defeated by ${boss.name} and barely survived.`, "bad");
        }
        Achievements.check();
        Engine.postYear();
      });
    },

    // Apply a plain effects object from an event choice.
    applyFx(fx, ev) {
      if (!fx) return;
      if (typeof fx.wealth === "number") State.addWealth(fx.wealth);
      if (typeof fx.chakra === "number") State.g.chakra = Math.max(0, Math.min(State.g.char.maxChakra, State.g.chakra + fx.chakra));
      if (typeof fx.health === "number") { fx.health < 0 ? State.damage(-fx.health) : State.heal(fx.health); }
      if (typeof fx.rep === "number") State.addRep(fx.rep);
      if (typeof fx.fame === "number") State.g.fame = Math.max(0, State.g.fame + fx.fame);
      ["intelligence", "strength", "speed", "taijutsu", "ninjutsu", "genjutsu", "weapon", "willpower", "chakraControl"].forEach(k => {
        if (typeof fx[k] === "number") State.gainStat(k, fx[k]);
      });
      if (fx.item === "scroll") { Shop.giveItem({ type: "scroll", name: "Mysterious Scroll", ico: "📜", stat: "ninjutsu", bonus: 3, value: 200 }); }
      if (fx.learnTech) { const t = this.tryRandomTechnique(); if (t) UI.toast("Technique learned!", t, "good"); }
      if (fx.relation) Relations.meet(fx.relation);
      if (fx.rival) Relations.meet(6, "Rival");
      if (fx.sensei) { State.g.flags.hasSensei = true; Relations.meet(12, "Sensei"); UI.toast("New Sensei", "A mentor takes you under their wing.", "good"); }
      if (fx.gamble) {
        if (RNG.chance(0.45)) { const w = RNG.randInt(200, 600); State.addWealth(w); UI.toast("Jackpot!", `+${w} ryo`, "good"); }
        else { const l = Math.min(State.g.wealth, RNG.randInt(100, 400)); State.addWealth(-l); UI.toast("Lost the bet", `-${l} ryo`, "bad"); }
      }
    },

    // Called after any yearly interaction resolves.
    postYear() {
      UI.closeModal();
      const g = State.g;
      if (g.flags.dead || g.flags.retired) return;

      Engine.checkPromotion();
      Achievements.check();

      // Death checks
      if (g.health <= 0) { return Endings.trigger("fallen"); }
      // Old-age mortality
      if (g.age >= 60) {
        const p = Math.min(0.85, (g.age - 60) * 0.05 + 0.05);
        if (RNG.chance(p)) { return Endings.trigger(Endings.decide()); }
      }
      if (g.age >= 90) { return Endings.trigger(Endings.decide()); }

      Save.autosave();
      UI.renderAll();
    },

    // Natural rank promotion from stats/level (exams handle the big jumps).
    checkPromotion() {
      const g = State.g;
      const ri = State.rankIndex();
      const p = State.power();
      // Auto-promote through higher ranks by power & age once past Chunin.
      const thresholds = [
        { rank: "Jonin", power: 120, age: 18 },
        { rank: "Elite", power: 200, age: 24 },
        { rank: "Captain", power: 300, age: 30 },
        { rank: "Anbu", power: 400, age: 34 },
        { rank: "Village Leader", power: 600, age: 42 },
        { rank: "Legendary Shinobi", power: 850, age: 50 }
      ];
      for (const t of thresholds) {
        const ti = Data.ranks.indexOf(t.rank);
        if (ti > ri && p >= t.power && g.age >= t.age) {
          this.promote(t.rank);
          break;
        }
      }
    },
    promote(rank) {
      State.g.rank = rank;
      State.addRep(8); State.g.fame += 5;
      Audio.play("promote");
      Engine.log(`Promoted to ${rank}!`, "big");
      Engine.timeline(State.g.age, `★ Became ${rank}.`);
      UI.toast("Promotion!", `You are now a ${rank}.`, "legendary");
    }
  };
  SLS.Engine = Engine;
  State.alive = function () { return State.g && !State.g.flags.dead && !State.g.flags.retired; };

  /* ===============================================================
     COMBAT — turn-based battles with personality-driven enemy AI
     =============================================================== */
  const Combat = {
    cur: null,

    playerFighter() {
      const g = State.g, s = g.char.stats;
      return {
        name: g.char.name, ava: g.char.crest || "🥷", isPlayer: true,
        hp: Math.max(1, Math.round(g.health)), maxHp: g.char.maxHealth,
        cp: Math.round(g.chakra), maxCp: g.char.maxChakra,
        atk: Math.round(s.strength + s.taijutsu * 0.6 + s.weapon * 0.4 + g.level * 1.5 + (g.equipped.weapon ? g.equipped.weapon.bonus : 0)),
        ninAtk: Math.round(s.ninjutsu + s.genjutsu * 0.5 + s.chakraControl * 0.6 + g.level),
        def: Math.round(s.strength * 0.4 + g.level + (g.equipped.armor ? g.equipped.armor.bonus : 0)),
        spd: Math.round(s.speed + g.level),
        charge: 0, dodging: false, countering: false, teamCd: 0
      };
    },

    start(enemy, opts, onEnd) {
      opts = opts || {};
      this.cur = { player: this.playerFighter(), enemy, opts, onEnd, log: [], over: false, turn: 0 };
      this.pushLog(`A battle begins against ${enemy.name}!`);
      UI.combat(this.cur);
    },

    pushLog(html) { this.cur.log.unshift(html); if (this.cur.log.length > 40) this.cur.log.pop(); },

    dmgCalc(atk, def, variance) {
      const mult = 1 - def / (def + 60);
      let d = atk * mult * RNG.rand(0.85, 1.15) * (variance || 1);
      return Math.max(1, Math.round(d));
    },

    // ---- player actions ----
    player(action) {
      const c = this.cur; if (!c || c.over) return;
      const p = c.player, e = c.enemy;
      p.dodging = false; p.countering = false;
      Audio.play("hit");

      if (action === "attack") {
        const crit = RNG.chance(0.08 + Math.max(0, (p.spd - e.spd)) * 0.004);
        let d = this.dmgCalc(p.atk, e.def, crit ? 1.7 : 1);
        e.hp -= d; p.charge = Math.min(100, p.charge + 18);
        this.pushLog(`You strike for <span class="dmg">${d}</span>${crit ? ' <span class="crit">CRIT!</span>' : ''}.`);
      } else if (action === "chakra") {
        if (p.cp < 20) { UI.toast("Not enough chakra", "", "bad"); return; }
        p.cp -= 20;
        const crit = RNG.chance(0.1);
        let d = this.dmgCalc(p.ninAtk * 1.7, e.def, crit ? 1.8 : 1);
        e.hp -= d; p.charge = Math.min(100, p.charge + 26);
        const el = State.g.char.affinities[0];
        if (el) State.gainElementMastery(el, 1);
        this.pushLog(`Your chakra attack blasts for <span class="dmg">${d}</span>${crit ? ' <span class="crit">CRIT!</span>' : ''}.`);
      } else if (action === "dodge") {
        p.dodging = true; p.cp = Math.min(p.maxCp, p.cp + 10); p.charge = Math.min(100, p.charge + 10);
        this.pushLog(`You ready to dodge the next attack.`);
      } else if (action === "counter") {
        p.countering = true; p.charge = Math.min(100, p.charge + 12);
        this.pushLog(`You brace to counter.`);
      } else if (action === "defend") {
        p.defending = true; p.cp = Math.min(p.maxCp, p.cp + 16); p.charge = Math.min(100, p.charge + 8);
        this.pushLog(`You take a defensive stance.`);
      } else if (action === "team") {
        if (!State.g.team.length) { UI.toast("No team", "Form a team first.", "bad"); return; }
        if (p.teamCd > 0) { UI.toast("Team not ready", `${p.teamCd} turn(s) left.`, "bad"); return; }
        let d = this.dmgCalc((p.atk + p.ninAtk) * 1.4 + State.g.team.length * 10, e.def, 1.2);
        e.hp -= d; p.teamCd = 3; p.charge = Math.min(100, p.charge + 20);
        this.pushLog(`Your squad unleashes a combo for <span class="dmg">${d}</span>!`);
      } else if (action === "ultimate") {
        if (p.charge < 100) { UI.toast("Not charged", "Build your charge meter.", "bad"); return; }
        p.charge = 0;
        let d = this.dmgCalc(p.atk * 1.5 + p.ninAtk * 2.2, e.def, 2.0);
        e.hp -= d;
        this.pushLog(`<span class="crit">ULTIMATE JUTSU!</span> You devastate the foe for <span class="dmg">${d}</span>!`);
        Audio.play("win");
      } else { return; }

      if (p.teamCd > 0 && action !== "team") p.teamCd--;
      if (e.hp <= 0) return this.end(true);
      this.enemyTurn();
    },

    // ---- enemy AI (personality-driven) ----
    enemyTurn() {
      const c = this.cur; if (c.over) return;
      const p = c.player, e = c.enemy;
      c.turn++;
      e.charge = Math.min(100, (e.charge || 0) + 14);
      const hpPct = e.hp / e.maxHp;

      let move = "attack";
      const canChakra = e.cp >= 18;
      switch (e.ai) {
        case "Aggressive": move = canChakra && RNG.chance(0.45) ? "chakra" : "attack"; break;
        case "Defensive": move = hpPct < 0.35 ? "defend" : (canChakra && RNG.chance(0.3) ? "chakra" : "attack"); break;
        case "Tactical": move = e.charge >= 100 ? "ultimate" : hpPct < 0.3 ? "defend" : canChakra && RNG.chance(0.5) ? "chakra" : "attack"; break;
        case "Reckless": move = e.charge >= 100 ? "ultimate" : canChakra && RNG.chance(0.6) ? "chakra" : "attack"; break;
      }

      const applyToPlayer = (raw, label, isCrit) => {
        // Dodge chance
        if (p.dodging && RNG.chance(0.7)) { this.pushLog(`You dodge the ${label}!`); return; }
        let d = raw;
        if (p.defending) d = Math.round(d * 0.4);
        p.hp -= d; p.charge = Math.min(100, p.charge + 10);
        this.pushLog(`${e.name}'s ${label} hits you for <span class="dmg">${d}</span>${isCrit ? ' <span class="crit">CRIT!</span>' : ''}.`);
        UI.shakePlayer();
        // Counter
        if (p.countering) {
          const cd = Math.round(d * 0.6 + p.atk * 0.3);
          e.hp -= cd;
          this.pushLog(`You counter for <span class="dmg">${cd}</span>!`);
        }
      };

      if (move === "defend") { e.defending = true; e.cp = Math.min(e.maxCp, e.cp + 14); this.pushLog(`${e.name} defends.`); }
      else if (move === "chakra") { e.cp -= 18; const crit = RNG.chance(0.08); applyToPlayer(this.dmgCalc(e.atk * 1.5, p.def, crit ? 1.7 : 1), "chakra attack", crit); }
      else if (move === "ultimate") { e.charge = 0; applyToPlayer(this.dmgCalc(e.atk * 2.3, p.def, 1.6), "ULTIMATE", true); }
      else { const crit = RNG.chance(0.06); applyToPlayer(this.dmgCalc(e.atk, p.def, crit ? 1.6 : 1), "attack", crit); }

      p.defending = false;
      if (p.hp <= 0) return this.end(false);
      UI.combat(c);
    },

    end(win) {
      const c = this.cur; c.over = true;
      const p = c.player;
      // Persist meters back (injuries/chakra carry over), unless friendly spar.
      if (!c.opts.friendly) {
        State.g.health = Math.max(win ? 1 : 1, Math.round(Math.max(0, p.hp)));
        State.g.chakra = Math.max(0, Math.round(p.cp));
      } else {
        State.g.chakra = Math.max(0, Math.round(p.cp));
        if (!win) State.damage(RNG.randInt(4, 10));
      }
      Audio.play(win ? "win" : "lose");
      this.pushLog(win ? `<span class="crit">Victory!</span>` : `You were defeated…`);
      UI.combat(c);
      const btn = win ? "Claim Victory" : "Retreat";
      setTimeout(() => {
        UI.combatEnd(win, () => { if (c.onEnd) c.onEnd({ win, fled: false }); }, btn);
      }, 400);
    },

    flee() {
      const c = this.cur; if (!c || c.over) return;
      const p = c.player, e = c.enemy;
      if (RNG.chance(0.5 + (p.spd - e.spd) * 0.01)) {
        c.over = true;
        State.g.health = Math.max(1, Math.round(p.hp));
        State.g.chakra = Math.max(0, Math.round(p.cp));
        UI.closeModal();
        if (c.onEnd) c.onEnd({ win: false, fled: true });
      } else {
        this.pushLog(`You failed to escape!`);
        this.enemyTurn();
      }
    }
  };
  SLS.Combat = Combat;

  /* ===============================================================
     MISSIONS
     =============================================================== */
  const Missions = {
    refresh() { State.g.pendingBoard = Gen.missionBoard(6); UI.renderPanel("missions"); },
    board() {
      if (!State.g.pendingBoard) State.g.pendingBoard = Gen.missionBoard(6);
      return State.g.pendingBoard;
    },
    accept(id) {
      const board = this.board();
      const m = board.find(x => x.id === id);
      if (!m) return;
      if (State.g.stamina < 15) { UI.toast("Too tired", "Rest before a mission.", "bad"); return; }
      State.spendStamina(15);

      if (m.combat) {
        const enemy = Engine.makeEnemy(Math.round(m.power / 4) + 4, "mission");
        enemy.name = "Mission Target " + Gen.name();
        Combat.start(enemy, {}, (res) => { this.resolve(m, res.win); });
      } else {
        // Stat-based success check
        const chance = Math.min(0.95, 0.35 + (State.power() - m.power) * 0.02);
        this.resolve(m, RNG.chance(Math.max(0.05, chance)));
      }
    },
    resolve(m, success) {
      const board = this.board();
      const idx = board.findIndex(x => x.id === m.id);
      if (idx >= 0) board.splice(idx, 1);

      if (success) {
        State.addWealth(m.pay); State.gainXP(m.xp); State.addRep(Math.round(m.xp / 8));
        State.g.fame += (["A", "S", "SS"].includes(m.rank) ? 4 : 1);
        State.g.missionsDone++;
        if (State.g.char.affinities[0]) State.gainElementMastery(State.g.char.affinities[0], RNG.randInt(1, 3));
        Engine.log(`Completed ${m.rank}-rank mission: ${m.title}. (+${m.pay} ryo)`, "good");
        UI.toast("Mission complete", `${m.title} (+${m.pay} ryo)`, "good");
      } else {
        const dmg = Math.round(m.power * State.g.difficultyCfg.dangerMul * RNG.rand(0.6, 1.4));
        State.damage(dmg); State.addRep(-2);
        Engine.log(`Failed ${m.rank}-rank mission: ${m.title}. (-${dmg} HP)`, "bad");
        UI.toast("Mission failed", `${m.title}`, "bad");
      }
      Achievements.check();
      if (State.g.health <= 0) return Endings.trigger("fallen");
      Save.autosave();
      UI.renderPanel("missions"); UI.renderHUD();
    }
  };
  SLS.Missions = Missions;

  /* ===============================================================
     EXAMS — rank-promotion milestone challenges
     =============================================================== */
  const Exams = {
    schedule: [
      { id: "graduation", age: 12, rank: "Genin", name: "Academy Graduation", req: 40 },
      { id: "chunin", age: 16, rank: "Chunin", name: "Chunin Exams", req: 90, combat: true },
      { id: "jonin", age: 22, rank: "Jonin", name: "Jonin Evaluation", req: 160, combat: true },
      { id: "anbu", age: 30, rank: "Anbu", name: "ANBU Selection", req: 320, combat: true }
    ],
    due() {
      if (!State.g) return null;
      const done = State.g.flags.examsDone || (State.g.flags.examsDone = {});
      const ri = State.rankIndex();
      for (const ex of this.schedule) {
        const exRankIdx = Data.ranks.indexOf(ex.rank);
        if (!done[ex.id] && State.g.age >= ex.age && exRankIdx > ri) return ex;
      }
      return null;
    },
    trigger(ex, done) {
      UI.modal(`<h2 class="modal-title">📜 ${ex.name}</h2>
        <p class="modal-text">The time has come to prove yourself and earn the rank of <b>${ex.rank}</b>. Your current power is <b>${State.power()}</b> (needed: ~${ex.req}).</p>
        <div class="modal-choices">
          <button class="choice-btn" onclick="SLS.Exams.attempt('${ex.id}')">Take the exam<span class="choice-sub">${ex.combat ? "Includes a combat trial" : "Written & practical trial"}</span></button>
          <button class="choice-btn" onclick="SLS.Exams.skip('${ex.id}')">Not this year<span class="choice-sub">Try again later</span></button>
        </div>`);
      this._done = done;
    },
    skip(id) { UI.closeModal(); if (this._done) this._done(); },
    attempt(id) {
      const ex = this.schedule.find(e => e.id === id);
      UI.closeModal();
      const proceed = (passed) => {
        (State.g.flags.examsDone || (State.g.flags.examsDone = {}));
        if (passed) {
          State.g.flags.examsDone[id] = true;
          Engine.promote(ex.rank);
          UI.modal(`<h2 class="modal-title">🎉 Passed!</h2><p class="modal-text">You are now a ${ex.rank}!</p>
            <div class="modal-choices"><button class="choice-btn" onclick="SLS.UI.closeModal(); SLS.Exams._finish();">Continue</button></div>`);
        } else {
          Engine.log(`Failed the ${ex.name}. Train harder and try again.`, "bad");
          UI.modal(`<h2 class="modal-title">Not yet…</h2><p class="modal-text">You failed the ${ex.name}. You can attempt it again next year.</p>
            <div class="modal-choices"><button class="choice-btn" onclick="SLS.UI.closeModal(); SLS.Exams._finish();">Continue</button></div>`);
        }
      };
      if (ex.combat) {
        const enemy = Engine.makeEnemy(Math.round(ex.req / 12) + 3, "exam");
        enemy.name = "Exam Proctor " + Gen.name();
        Combat.start(enemy, { exam: true }, (res) => {
          const power = State.power();
          proceed(res.win || power >= ex.req * 1.2);
        });
      } else {
        const power = State.power();
        const chance = Math.min(0.95, 0.3 + (power - ex.req) * 0.03);
        proceed(RNG.chance(Math.max(0.1, chance)));
      }
    },
    _finish() { if (this._done) { const d = this._done; this._done = null; d(); } }
  };
  SLS.Exams = Exams;

  /* ===============================================================
     MINIGAMES — interactive training drills
     =============================================================== */
  const Minigames = {
    games: [
      { id: "tree", name: "Tree Walking", ico: "🌲", stat: "chakraControl", desc: "Stop the marker in the glowing zone." },
      { id: "water", name: "Water Walking", ico: "🌊", stat: "chakraControl", desc: "Balance your chakra output." },
      { id: "precision", name: "Chakra Precision", ico: "🎯", stat: "ninjutsu", desc: "Hit the target zone." },
      { id: "seals", name: "Hand Seal Practice", ico: "🤲", stat: "ninjutsu", desc: "Speed and accuracy." },
      { id: "meditation", name: "Meditation", ico: "🧘", stat: "willpower", desc: "Find your center." }
    ],
    menu() {
      const buttons = this.games.map(g =>
        `<button class="choice-btn" onclick="SLS.Minigames.play('${g.id}')">${g.ico} ${g.name}<span class="choice-sub">${g.desc}</span></button>`
      ).join("");
      UI.modal(`<h2 class="modal-title">🌀 Training Drills</h2><p class="modal-text">Master your chakra through practice.</p>
        <div class="modal-choices">${buttons}
        <button class="choice-btn" onclick="SLS.UI.closeModal()">Cancel</button></div>`);
    },
    play(id) {
      const game = this.games.find(g => g.id === id);
      this._game = game; this._round = 0; this._score = 0;
      this._render();
      this._start();
    },
    _render() {
      const g = this._game;
      UI.modal(`<h2 class="modal-title">${g.ico} ${g.name}</h2>
        <p class="modal-text">${g.desc} — Round ${this._round + 1} of 3</p>
        <div style="position:relative;height:26px;background:var(--ink-1);border:1px solid var(--ink-4);border-radius:999px;overflow:hidden;margin:16px 0;">
          <div id="mg-zone" style="position:absolute;top:0;bottom:0;background:rgba(217,164,65,.35);border-left:1px solid var(--gold);border-right:1px solid var(--gold);"></div>
          <div id="mg-marker" style="position:absolute;top:0;bottom:0;width:4px;background:var(--chakra);box-shadow:0 0 8px var(--chakra);left:0;"></div>
        </div>
        <div class="modal-choices">
          <button class="btn btn-primary btn-block" onclick="SLS.Minigames._stop()">STOP</button>
        </div>
        <p class="hint" id="mg-score">Score: ${this._score}</p>`, true);
    },
    _start() {
      // random target zone
      const zoneW = 18 + RNG.randInt(0, 14); // percent
      const zoneL = RNG.randInt(5, 95 - zoneW);
      const zone = document.getElementById("mg-zone");
      if (zone) { zone.style.left = zoneL + "%"; zone.style.width = zoneW + "%"; }
      this._zone = [zoneL, zoneL + zoneW];
      this._pos = 0; this._dir = 1;
      const speed = 1.4 + this._round * 0.5;
      const marker = document.getElementById("mg-marker");
      clearInterval(this._timer);
      this._timer = setInterval(() => {
        this._pos += this._dir * speed;
        if (this._pos >= 100) { this._pos = 100; this._dir = -1; }
        if (this._pos <= 0) { this._pos = 0; this._dir = 1; }
        if (marker) marker.style.left = this._pos + "%";
      }, 16);
    },
    _stop() {
      clearInterval(this._timer);
      const hit = this._pos >= this._zone[0] && this._pos <= this._zone[1];
      const center = (this._zone[0] + this._zone[1]) / 2;
      const perfect = Math.abs(this._pos - center) < 3;
      if (perfect) { this._score += 3; UI.toast("Perfect!", "", "good"); }
      else if (hit) { this._score += 1; }
      this._round++;
      if (this._round >= 3) return this._finish();
      const scoreEl = document.getElementById("mg-score");
      if (scoreEl) scoreEl.textContent = "Score: " + this._score;
      this._render(); this._start();
    },
    _finish() {
      clearInterval(this._timer);
      const g = this._game;
      const gain = this._score * 0.6 + 0.4;
      State.gainStat(g.stat, gain);
      State.gainStat("chakraControl", 0.3);
      State.gainXP(8 + this._score * 4);
      if (State.g.char.affinities[0]) State.gainElementMastery(State.g.char.affinities[0], this._score);
      Engine.log(`Trained ${g.name} (score ${this._score}), improving ${g.stat}.`, "");
      UI.modal(`<h2 class="modal-title">Drill Complete</h2>
        <p class="modal-text">Final score: <b>${this._score}</b> / 9.<br>Your ${g.stat} improved by ${gain.toFixed(1)}.</p>
        <div class="modal-choices"><button class="choice-btn" onclick="SLS.UI.closeModal(); SLS.UI.renderAll();">Done</button></div>`);
      Achievements.check(); Save.autosave();
    }
  };
  SLS.Minigames = Minigames;

  /* ===============================================================
     RELATIONS — bonds
     =============================================================== */
  const Relations = {
    meet(affinity, forceType) {
      const npc = Gen.npc({ village: State.g.char.villageName, rank: State.g.rank });
      const type = forceType || RNG.pick(["Friend", "Friend", "Rival", "Ally", "Romance"]);
      const rel = { npc, type, affinity: affinity || RNG.randInt(3, 12) };
      State.g.relationships.push(rel);
      Engine.log(`Met ${npc.name} (${npc.clan} clan) — a new ${type.toLowerCase()}.`, "");
      UI.toast("New bond", `${npc.name} — ${type}`, "good");
      return rel;
    },
    formTeam() {
      if (State.rankIndex() < 1) { UI.toast("Too soon", "Graduate first to form a team.", "bad"); return; }
      if (State.g.team.length >= 3) { UI.toast("Team full", "You already have a full squad.", ""); return; }
      const member = Gen.npc({ village: State.g.char.villageName, rank: State.g.rank });
      State.g.team.push(member);
      Engine.log(`${member.name} joined your team!`, "good");
      UI.toast("Teammate added", member.name, "good");
    },
    interact(idx) {
      const rel = State.g.relationships[idx];
      if (!rel) return;
      if (State.g.stamina < 8) { UI.toast("Too tired", "", "bad"); return; }
      State.spendStamina(8);
      rel.affinity = Math.min(100, rel.affinity + RNG.randInt(3, 9));
      State.gainStat("willpower", 0.3);
      Engine.log(`Spent time with ${rel.npc.name}. Your bond deepened.`, "");
      Achievements.check(); Save.autosave(); UI.renderPanel("relationships"); UI.renderHUD();
    }
  };
  SLS.Relations = Relations;

  /* ===============================================================
     SHOP / ECONOMY / INVENTORY
     =============================================================== */
  const Shop = {
    _catalog: null,
    catalog() {
      if (this._catalog) return this._catalog;
      const list = [];
      let id = 0;
      Data.shopBase.forEach(base => {
        const tiers = base.consumable ? [1] : [1, 2, 3];
        tiers.forEach(t => {
          const bonus = base.consumable ? 0 : t * RNG.randInt(2, 4) + 2;
          const value = base.consumable ? RNG.randInt(30, 80) : (t * t * 120 + RNG.randInt(0, 60));
          list.push({
            id: "it" + (id++),
            type: base.type, name: (t > 1 ? ["", "", "Fine ", "Master "][t] : "") + base.name,
            ico: base.ico, stat: base.stat, bonus, value,
            consumable: !!base.consumable, house: !!base.house, tier: t
          });
        });
      });
      // A few scrolls that unlock techniques
      for (let i = 0; i < 4; i++) list.push({ id: "it" + (id++), type: "scroll", name: "Technique Scroll", ico: "📜", stat: "ninjutsu", bonus: 0, value: 350, scroll: true });
      this._catalog = list;
      return list;
    },
    randomItem() { return RNG.pick(this.catalog().filter(i => !i.house)); },
    giveItem(item) {
      State.g.inventory.push(Object.assign({ uid: "u" + Date.now() + RNG.randInt(0, 999) }, item));
    },
    buy(id) {
      const item = this.catalog().find(i => i.id === id);
      if (!item) return;
      if (State.g.wealth < item.value) { UI.toast("Too expensive", "Not enough ryo.", "bad"); return; }
      State.addWealth(-item.value);
      Audio.play("coin");
      if (item.scroll) {
        const t = Engine.tryRandomTechnique();
        Engine.log(`Bought a scroll and learned ${t || "a technique"}.`, "good");
        UI.toast("Technique learned!", t || "", "good");
      } else if (item.consumable) {
        this.giveItem(item);
        Engine.log(`Bought ${item.name}.`, "");
      } else {
        this.giveItem(item);
        Engine.log(`Bought ${item.name}.`, "");
      }
      Achievements.check(); Save.autosave(); UI.renderPanel("shop"); UI.renderHUD();
    },
    use(uid) {
      const i = State.g.inventory.findIndex(x => x.uid === uid);
      if (i < 0) return;
      const item = State.g.inventory[i];
      if (item.consumable) {
        if (item.stat === "health") State.heal(40);
        else if (item.stat === "chakra") State.g.chakra = Math.min(State.g.char.maxChakra, State.g.chakra + 50);
        State.g.inventory.splice(i, 1);
        Engine.log(`Used ${item.name}.`, "");
      } else if (item.type === "weapon" || item.type === "armor") {
        const slot = item.type;
        State.g.equipped[slot] = item;
        Engine.log(`Equipped ${item.name}.`, "");
        UI.toast("Equipped", item.name, "good");
      } else if (item.house) {
        State.g.flags.hasHouse = true;
        UI.toast("Home", `You now own a ${item.name}.`, "good");
      } else {
        State.gainStat(item.stat, item.bonus);
        State.g.inventory.splice(i, 1);
        Engine.log(`Used ${item.name}, gaining ${item.stat}.`, "");
      }
      Achievements.check(); Save.autosave(); UI.renderPanel("inventory"); UI.renderHUD();
    }
  };
  SLS.Shop = Shop;

  /* ===============================================================
     TECHNIQUES panel helpers
     =============================================================== */
  const Techniques = {
    learn(id) {
      const t = Gen.techniques().find(x => x.id === id);
      if (!t || State.g.techniques.includes(id)) return;
      const gate = State.g.char.stats[t.gate] || 0;
      if (gate < t.req) { UI.toast("Not ready", `Requires ${t.gate} ${t.req} (you: ${Math.round(gate)}).`, "bad"); return; }
      if (State.g.chakra < t.cost) { UI.toast("Not enough chakra", "", "bad"); return; }
      State.spendChakra(t.cost);
      State.g.techniques.push(id);
      State.g.techMastery[id] = 5;
      Audio.play("unlock");
      Engine.log(`Learned technique: ${t.name}!`, "good");
      UI.toast("Technique learned!", t.name, "good");
      if (t.element) State.gainElementMastery(t.element, 4);
      Achievements.check(); Save.autosave(); UI.renderPanel("techniques"); UI.renderHUD();
    },
    train(id) {
      if (!State.g.techniques.includes(id)) return;
      if (State.g.stamina < 10) { UI.toast("Too tired", "", "bad"); return; }
      State.spendStamina(10);
      State.g.techMastery[id] = Math.min(100, (State.g.techMastery[id] || 0) + RNG.randInt(6, 14));
      const t = Gen.techniques().find(x => x.id === id);
      if (t) { State.gainStat(t.gate, 0.4); if (t.element) State.gainElementMastery(t.element, 2); }
      State.gainXP(8);
      Achievements.check(); Save.autosave(); UI.renderPanel("techniques"); UI.renderHUD();
    }
  };
  SLS.Techniques = Techniques;

  /* ===============================================================
     ACHIEVEMENTS (100+, incl. hidden legendary)
     =============================================================== */
  const Achievements = {
    list: (function () {
      const a = [];
      // Mission milestones
      [1, 10, 25, 50, 100, 200].forEach(n => a.push({ id: "miss" + n, name: `${n} Missions`, desc: `Complete ${n} missions.`, test: g => g.missionsDone >= n }));
      // Wealth
      [500, 2000, 10000, 50000].forEach(n => a.push({ id: "gold" + n, name: `${n} Ryo`, desc: `Amass ${n} ryo.`, test: g => g.wealth >= n }));
      // Level
      [5, 10, 25, 50, 75, 100].forEach(n => a.push({ id: "lvl" + n, name: `Level ${n}`, desc: `Reach level ${n}.`, test: g => g.level >= n }));
      // Techniques
      [1, 10, 25, 50, 100].forEach(n => a.push({ id: "tech" + n, name: `${n} Techniques`, desc: `Learn ${n} techniques.`, test: g => g.techniques.length >= n }));
      // Bosses
      [1, 5, 10].forEach(n => a.push({ id: "boss" + n, name: `${n} Bosses`, desc: `Defeat ${n} bosses.`, test: g => g.bossesBeaten >= n }));
      // Ranks
      Data.ranks.forEach(r => a.push({ id: "rank_" + r, name: `Rank: ${r}`, desc: `Reach the rank of ${r}.`, test: g => Data.ranks.indexOf(g.rank) >= Data.ranks.indexOf(r) }));
      // Bonds
      [1, 5, 15].forEach(n => a.push({ id: "bond" + n, name: `${n} Bonds`, desc: `Form ${n} relationships.`, test: g => g.relationships.length >= n }));
      // Elements
      Data.elements.forEach(e => a.push({ id: "elem_" + e, name: `${e} Adept`, desc: `Reach 50 ${e} mastery.`, test: g => (g.elementMastery[e] || 0) >= 50 }));
      a.push({ id: "allelem", name: "Elemental Master", desc: "Master every element (80+).", test: g => Data.elements.every(e => (g.elementMastery[e] || 0) >= 80) });
      // Age
      [16, 30, 50, 70, 90].forEach(n => a.push({ id: "age" + n, name: `Age ${n}`, desc: `Live to age ${n}.`, test: g => g.age >= n }));
      // Fame / rep
      a.push({ id: "fame50", name: "Renowned", desc: "Reach 50 fame.", test: g => g.fame >= 50 });
      a.push({ id: "rep100", name: "Village Hero", desc: "Reach 100 reputation.", test: g => g.reputation >= 100 });
      a.push({ id: "team", name: "Squad Leader", desc: "Form a full 3-member team.", test: g => g.team.length >= 3 });
      a.push({ id: "house", name: "Homeowner", desc: "Own a home.", test: g => g.flags.hasHouse });
      a.push({ id: "sensei", name: "Apprentice", desc: "Gain a sensei.", test: g => g.flags.hasSensei });
      a.push({ id: "champ", name: "Tournament Champion", desc: "Win a tournament.", test: g => g.flags.tournamentChamp });
      // Hidden legendary achievements
      a.push({ id: "leg_kage", name: "Shadow of the Village", desc: "Become the Village Leader.", legendary: true, hidden: true, test: g => g.rank === "Village Leader" || g.rank === "Legendary Shinobi" });
      a.push({ id: "leg_legend", name: "Living Legend", desc: "Become a Legendary Shinobi.", legendary: true, hidden: true, test: g => g.rank === "Legendary Shinobi" });
      a.push({ id: "leg_blood", name: "Chosen Blood", desc: "Be born with a bloodline.", legendary: true, hidden: true, test: g => !!g.char.bloodline });
      a.push({ id: "leg_perfect", name: "Perfect Shinobi", desc: "Reach 900 total power.", legendary: true, hidden: true, test: () => State.power() >= 900 });
      a.push({ id: "leg_old", name: "Immortal Spirit", desc: "Live to age 90.", legendary: true, hidden: true, test: g => g.age >= 90 });
      return a;
    })(),
    check() {
      if (!State.g) return;
      this.list.forEach(a => {
        if (!State.g.achievements[a.id] && a.test(State.g)) {
          State.g.achievements[a.id] = true;
          Audio.play("unlock");
          UI.toast(a.legendary ? "⭐ LEGENDARY ACHIEVEMENT" : "🏅 Achievement Unlocked", a.name, a.legendary ? "legendary" : "good");
          Engine.log(`Achievement unlocked: ${a.name}.`, a.legendary ? "big" : "good");
        }
      });
    },
    count() { return Object.keys(State.g.achievements).length; }
  };
  SLS.Achievements = Achievements;

  /* ===============================================================
     ENDINGS — multiple life conclusions
     =============================================================== */
  const Endings = {
    types: {
      leader: { name: "The Village Leader", ico: "🏯", text: "You rose to lead your village, guiding a new generation of shinobi. Your name is carved into history." },
      hero: { name: "Legendary Hero", ico: "🌟", text: "Songs are sung of your deeds. You died a legend, beloved by your village." },
      wanderer: { name: "The Wandering Ninja", ico: "🍃", text: "You spent your final years roaming the world, a free spirit until the end." },
      missing: { name: "The Missing-Nin", ico: "🥷", text: "You turned your back on the village and lived by your own code — feared and hunted to the last." },
      retired: { name: "The Retired Master", ico: "🍵", text: "You laid down your blade and lived out your days in peace, training the young." },
      fallen: { name: "The Fallen Warrior", ico: "⚰️", text: "You fell in battle, as a true shinobi. Your comrades will remember your sacrifice." }
    },
    decide() {
      const g = State.g;
      if (g.rank === "Village Leader" || g.rank === "Legendary Shinobi") return RNG.chance(0.5) ? "leader" : "hero";
      if (g.reputation < 0) return "missing";
      if (g.fame >= 30 || g.bossesBeaten >= 5) return "hero";
      if (State.rankIndex() >= 4) return "retired";
      return "wanderer";
    },
    trigger(type) {
      const g = State.g;
      g.flags.dead = true;
      const e = this.types[type] || this.types.retired;
      Audio.play("lose");
      Engine.timeline(g.age, `☯ Passed away at ${g.age}. (${e.name})`);
      Save.autosave();
      const stats = [
        ["Final Rank", g.rank], ["Age", g.age], ["Level", g.level],
        ["Missions", g.missionsDone], ["Bosses Slain", g.bossesBeaten],
        ["Techniques", g.techniques.length], ["Fame", g.fame],
        ["Reputation", g.reputation], ["Power", State.power()],
        ["Achievements", Achievements.count() + " / " + Achievements.list.length]
      ].map(([k, v]) => `<div class="kv"><span class="k">${k}</span><span>${v}</span></div>`).join("");
      UI.modal(`<h2 class="modal-title">${e.ico} ${e.name}</h2>
        <p class="modal-text">${e.text}</p>
        <div class="info-card" style="margin:12px 0;"><h4>Life Summary — ${g.char.name}</h4>${stats}</div>
        <div class="modal-choices">
          <button class="btn btn-primary btn-block" onclick="SLS.Game.newLife()">Begin a New Life</button>
        </div>`, true);
    }
  };
  SLS.Endings = Endings;

  /* ===============================================================
     UI — rendering, tabs, toasts, modal
     =============================================================== */
  const UI = {
    el(id) { return document.getElementById(id); },
    esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); },

    // ---------- Toast ----------
    toast(title, sub, kind) {
      const box = this.el("toasts");
      const t = document.createElement("div");
      t.className = "toast " + (kind || "");
      t.innerHTML = `<div class="t-title">${this.esc(title)}</div>${sub ? `<div class="t-sub">${this.esc(sub)}</div>` : ""}`;
      box.appendChild(t);
      setTimeout(() => t.remove(), 4000);
    },

    // ---------- Modal ----------
    modal(html, wide) {
      const ov = this.el("modal-overlay");
      this.el("modal").className = "modal" + (wide ? " wide" : "");
      this.el("modal-body").innerHTML = html;
      ov.classList.add("open");
      ov.setAttribute("aria-hidden", "false");
    },
    closeModal() {
      const ov = this.el("modal-overlay");
      ov.classList.remove("open");
      ov.setAttribute("aria-hidden", "true");
    },

    // Event modal with choices that resolve then call onDone
    eventModal(ev, onDone) {
      this._eventDone = onDone; this._event = ev;
      const choices = ev.choices.map((c, i) =>
        `<button class="choice-btn" onclick="SLS.UI.eventChoice(${i})">${this.esc(c.label)}${c.sub ? `<span class="choice-sub">${this.esc(c.sub)}</span>` : ""}</button>`
      ).join("");
      this.modal(`<h2 class="modal-title">${this.esc(ev.title)}</h2><p class="modal-text">${this.esc(ev.text)}</p><div class="modal-choices">${choices}</div>`);
    },
    eventChoice(i) {
      const ev = this._event, c = ev.choices[i], fx = c.fx || {};
      Engine.log(`${ev.title}: chose "${c.label}".`, "");
      // Combat-triggering choices
      if (fx.combat) {
        this.closeModal();
        const boss = Gen.boss(fx.combat === "duel" ? "assassin" : fx.combat);
        if (fx.combat === "duel") { boss.name = "Challenger " + Gen.name(); boss.hp = Math.round(boss.hp * 0.5); boss.maxHp = boss.hp; }
        Combat.start(boss, {}, (res) => {
          if (res.win) { State.gainXP(60); State.addRep(3); State.g.fame += 2; Engine.log(`Won the fight against ${boss.name}.`, "good"); }
          else if (res.fled) { Engine.log("Escaped the encounter.", ""); }
          else { State.damage(20); Engine.log(`Lost the fight against ${boss.name}.`, "bad"); }
          this._finishEvent();
        });
        return;
      }
      if (fx.flee) {
        const ok = RNG.chance(0.4 + State.stat("speed") * 0.01);
        if (ok) Engine.log("You escaped safely.", "good");
        else { State.damage(RNG.randInt(15, 35)); Engine.log("You were caught and hurt while fleeing.", "bad"); }
      }
      Engine.applyFx(fx, ev);
      this.closeModal();
      this._finishEvent();
    },
    _finishEvent() {
      Achievements.check();
      if (State.g.health <= 0) return Endings.trigger("fallen");
      const done = this._eventDone; this._eventDone = null;
      if (done) done();
    },

    // ---------- Combat rendering ----------
    combat(c) {
      const p = c.player, e = c.enemy;
      const bar = (cur, max, cls) => `<div class="mini-bar ${cls}"><i style="width:${Math.max(0, Math.min(100, cur / max * 100))}%"></i></div>`;
      const actions = c.over ? "" : `
        <div class="combat-actions">
          <button class="btn" onclick="SLS.Combat.player('attack')">⚔️ Attack</button>
          <button class="btn" onclick="SLS.Combat.player('chakra')">🌀 Chakra (20)</button>
          <button class="btn" onclick="SLS.Combat.player('dodge')">💨 Dodge</button>
          <button class="btn" onclick="SLS.Combat.player('counter')">🛡️ Counter</button>
          <button class="btn" onclick="SLS.Combat.player('defend')">🧱 Defend</button>
          <button class="btn" onclick="SLS.Combat.player('team')">👥 Team</button>
          <button class="btn btn-gold" onclick="SLS.Combat.player('ultimate')">💥 Ultimate</button>
          ${c.opts.boss || c.opts.exam ? `<button class="btn btn-ghost" onclick="SLS.Combat.flee()">🏃 Flee</button>` : `<button class="btn btn-ghost" onclick="SLS.Combat.flee()">🏃 Flee</button>`}
        </div>`;
      this.modal(`<div class="combat">
        <div class="combat-arena">
          <div class="fighter" id="fighter-player">
            <div class="f-ava">${p.ava}</div>
            <div class="f-name">${this.esc(p.name)}</div>
            <div class="f-bars">${bar(p.hp, p.maxHp, "hp")}${bar(p.cp, p.maxCp, "cp")}
              <div style="font-size:.7rem;color:var(--muted);margin-top:3px;">Charge ${p.charge}%</div></div>
          </div>
          <div class="vs">VS</div>
          <div class="fighter" id="fighter-enemy">
            <div class="f-ava">${e.ava}</div>
            <div class="f-name">${this.esc(e.name)}${e.boss ? " 👑" : ""}</div>
            <div class="f-bars">${bar(e.hp, e.maxHp, "hp")}${bar(e.cp, e.maxCp, "cp")}
              <div style="font-size:.7rem;color:var(--muted);margin-top:3px;">${e.ai} AI</div></div>
          </div>
        </div>
        <div class="combat-log">${c.log.map(l => `<p>${l}</p>`).join("")}</div>
        ${actions}
      </div>`, true);
    },
    shakePlayer() {
      const f = this.el("fighter-player");
      if (f) { f.classList.remove("hurt"); void f.offsetWidth; f.classList.add("hurt"); }
    },
    combatEnd(win, onClose, label) {
      const body = this.el("modal-body");
      const btn = document.createElement("div");
      btn.className = "modal-choices";
      btn.style.marginTop = "10px";
      btn.innerHTML = `<button class="btn btn-primary btn-block">${label || (win ? "Continue" : "Continue")}</button>`;
      btn.querySelector("button").onclick = () => { UI.closeModal(); onClose(); };
      body.appendChild(btn);
    },

    // ---------- Training sub-menu ----------
    trainMenu() {
      // refund stamina cost already paid in doActivity? No—train cost applied, keep it.
      const stats = ["strength", "speed", "taijutsu", "ninjutsu", "genjutsu", "weapon"];
      const buttons = stats.map(s =>
        `<button class="choice-btn" onclick="SLS.Engine.trainStat('${s}')">Train ${s.charAt(0).toUpperCase() + s.slice(1)}<span class="choice-sub">Current: ${Math.round(State.g.char.stats[s])}</span></button>`
      ).join("");
      this.modal(`<h2 class="modal-title">🥋 Training</h2><p class="modal-text">Which discipline will you focus on?</p><div class="modal-choices">${buttons}</div>`);
    },

    // ---------- HUD ----------
    renderHUD() {
      const g = State.g; if (!g) return;
      this.el("hud-crest").textContent = g.char.crest || "忍";
      this.el("hud-name").textContent = g.char.name;
      this.el("hud-sub").textContent = `${g.rank} · ${g.char.villageName}`;
      this.el("hud-age").textContent = g.age;
      this.el("hud-level").textContent = g.level;
      this.el("hud-wealth").textContent = g.wealth;
      this.el("hud-fame").textContent = g.fame;
      this.el("bar-health").style.width = (g.health / g.char.maxHealth * 100) + "%";
      this.el("bar-chakra").style.width = (g.chakra / g.char.maxChakra * 100) + "%";
      this.el("bar-stamina").style.width = (g.stamina / g.char.maxStamina * 100) + "%";
      this.el("year-stage").textContent = State.stage();
      this.el("year-hint").textContent = g.stamina < 10 ? "Low stamina — advance the year to recover." : "Choose actions, then advance the year.";
    },

    // ---------- Panels ----------
    activeTab: "character",
    switchTab(tab) {
      this.activeTab = tab;
      document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
      document.querySelectorAll(".panel-view").forEach(p => p.classList.remove("active"));
      this.el("panel-" + tab).classList.add("active");
      this.renderPanel(tab);
    },
    renderAll() { this.renderHUD(); this.renderPanel(this.activeTab); },
    renderPanel(tab) {
      const fn = this["panel_" + tab];
      if (fn) this.el("panel-" + tab).innerHTML = fn.call(this);
    },

    statBar(key, name) {
      const v = State.g.char.stats[key] || 0;
      return `<div class="stat-row"><span class="stat-name">${name}</span>
        <span class="stat-bar"><i style="width:${Math.min(100, v)}%"></i></span>
        <span class="stat-val">${Math.round(v)}</span></div>`;
    },

    panel_character() {
      const g = State.g, ch = g.char;
      const affinities = ch.affinities.map(a => `<span class="tag el-${a}">${a}</span>`).join(" ");
      const traits = ch.traits.map(t => `<span class="tag">${t}</span>`).join(" ");
      const blood = ch.bloodline ? `<span class="tag bloodline">${ch.bloodline}</span>` : `<span class="tag">None</span>`;
      const fam = ch.family;
      return `<div class="grid-2">
        <div class="panel">
          <h2 class="panel-title">${this.esc(ch.name)}</h2>
          <p class="section-note">${g.rank} of the ${ch.villageName} ${ch.crest}</p>
          <div class="kv"><span class="k">Age</span><span>${g.age} (${State.stage()})</span></div>
          <div class="kv"><span class="k">Level</span><span>${g.level} — ${g.xp}/${g.xpNext} XP</span></div>
          <div class="kv"><span class="k">Clan</span><span>${ch.clan}</span></div>
          <div class="kv"><span class="k">Bloodline</span><span>${blood}</span></div>
          <div class="kv"><span class="k">Affinities</span><span>${affinities}</span></div>
          <div class="kv"><span class="k">Difficulty</span><span>${g.difficultyCfg.name}</span></div>
          <div class="kv"><span class="k">Total Power</span><span>${State.power()}</span></div>
          <div style="margin-top:8px;">${traits}</div>
        </div>
        <div class="panel">
          <h2 class="panel-title small">Family & Standing</h2>
          <div class="kv"><span class="k">Heritage</span><span>${fam.heritage}</span></div>
          <div class="kv"><span class="k">Mother</span><span>${fam.motherAlive ? "Alive" : "Deceased"}</span></div>
          <div class="kv"><span class="k">Father</span><span>${fam.fatherAlive ? "Alive" : "Deceased"}</span></div>
          <div class="kv"><span class="k">Siblings</span><span>${fam.siblings}</span></div>
          <div class="kv"><span class="k">Wealth</span><span>${g.wealth} ryo</span></div>
          <div class="kv"><span class="k">Fame</span><span>${g.fame}</span></div>
          <div class="kv"><span class="k">Reputation</span><span>${g.reputation}</span></div>
          <div class="kv"><span class="k">Home</span><span>${g.flags.hasHouse ? "Owned" : "None"}</span></div>
          <div class="kv"><span class="k">Achievements</span><span>${Achievements.count()} / ${Achievements.list.length}</span></div>
        </div>
      </div>`;
    },

    panel_stats() {
      const rows = Data.statDefs.map(s => this.statBar(s.key, s.name)).join("");
      const em = Data.elements.map(e => {
        const v = State.g.elementMastery[e] || 0;
        return `<div class="stat-row"><span class="stat-name el-${e}" style="color:var(--${e.toLowerCase()})">${e}</span>
          <span class="stat-bar"><i style="width:${v}%"></i></span><span class="stat-val">${v}</span></div>`;
      }).join("");
      return `<div class="panel"><h2 class="panel-title">Attributes</h2>
        <div class="stat-list">${rows}</div></div>
        <div class="panel"><h2 class="panel-title">Element Mastery</h2>
        <div class="stat-list">${em}</div></div>
        <div class="panel"><h2 class="panel-title">Meters</h2>
        <div class="stat-list">
          <div class="stat-row"><span class="stat-name">Health</span><span class="stat-bar"><i style="width:${State.g.health / State.g.char.maxHealth * 100}%;background:var(--bad)"></i></span><span class="stat-val">${Math.round(State.g.health)}</span></div>
          <div class="stat-row"><span class="stat-name">Chakra</span><span class="stat-bar"><i style="width:${State.g.chakra / State.g.char.maxChakra * 100}%;background:var(--water)"></i></span><span class="stat-val">${Math.round(State.g.chakra)}</span></div>
          <div class="stat-row"><span class="stat-name">Stamina</span><span class="stat-bar"><i style="width:${State.g.stamina / State.g.char.maxStamina * 100}%;background:var(--lightning)"></i></span><span class="stat-val">${Math.round(State.g.stamina)}</span></div>
          <div class="stat-row"><span class="stat-name">Willpower</span><span class="stat-bar"><i style="width:${Math.min(100, State.g.char.stats.willpower)}%"></i></span><span class="stat-val">${Math.round(State.g.char.stats.willpower)}</span></div>
        </div></div>`;
    },

    panel_actions() {
      const g = State.g;
      const acts = Object.keys(Engine.activities).map(key => {
        const a = Engine.activities[key];
        const disabled = g.stamina < a.cost;
        return `<button class="action-btn" ${disabled ? "disabled" : ""} onclick="SLS.Engine.doActivity('${key}')">
          <span class="action-ico">${a.ico}</span>
          <span class="action-name">${a.name}</span>
          <span class="action-desc">${a.desc}${a.cost ? ` · ${a.cost} stamina` : ""}</span>
        </button>`;
      }).join("");
      return `<div class="panel">
        <h2 class="panel-title">Choose Your Actions</h2>
        <p class="section-note">Spend stamina on activities, then advance the year to recover and face what fate brings. Stamina left: <b>${Math.round(g.stamina)}/${g.char.maxStamina}</b></p>
        <div class="action-grid">${acts}</div>
      </div>`;
    },

    panel_missions() {
      const board = Missions.board();
      const cards = board.length ? board.map(m => `
        <div class="list-card">
          <div class="list-head"><span class="list-title">${this.esc(m.title)}</span><span class="badge rank-${m.rank}">${m.rank}</span></div>
          <div class="list-desc">${m.desc}${m.combat ? " ⚔️ Combat" : ""}</div>
          <div class="list-foot">
            <span class="list-desc">💰 ${m.pay} ryo · ${m.xp} XP · Power ~${m.power}</span>
            <button class="btn btn-sm btn-primary" onclick="SLS.Missions.accept('${m.id}')">Accept</button>
          </div>
        </div>`).join("") : `<p class="empty">No missions available. Refresh the board.</p>`;
      return `<div class="panel">
        <div class="creation-row"><h2 class="panel-title">Mission Board</h2>
          <button class="btn btn-sm" onclick="SLS.Missions.refresh()">🔄 New Board</button></div>
        <p class="section-note">Completed: ${State.g.missionsDone}. Accepting a mission costs 15 stamina.</p>
        <div class="grid-auto">${cards}</div>
      </div>`;
    },

    _techFilter: "All",
    setTechFilter(f) { this._techFilter = f; this.renderPanel("techniques"); },
    panel_techniques() {
      const all = Gen.techniques();
      const owned = State.g.techniques;
      const filters = ["All", "Owned"].concat(Data.techTypes);
      const frow = filters.map(f => `<button class="chip ${this._techFilter === f ? "selected" : ""}" onclick="SLS.UI.setTechFilter('${f}')">${f}</button>`).join("");
      let list = all;
      if (this._techFilter === "Owned") list = all.filter(t => owned.includes(t.id));
      else if (this._techFilter !== "All") list = all.filter(t => t.type === this._techFilter);
      // Sort: owned first, then by tier
      list = list.slice().sort((a, b) => (owned.includes(b.id) - owned.includes(a.id)) || a.tier - b.tier);
      list = list.slice(0, 120); // cap render for performance
      const cards = list.map(t => {
        const has = owned.includes(t.id);
        const mastery = State.g.techMastery[t.id] || 0;
        const gateVal = Math.round(State.g.char.stats[t.gate] || 0);
        const canLearn = gateVal >= t.req && State.g.chakra >= t.cost;
        return `<div class="list-card">
          <div class="list-head"><span class="list-title">${this.esc(t.name)}</span>
            <span class="badge rank-${t.rank}">${t.rank}</span></div>
          <div class="list-desc">${t.type}${t.element ? ` · <span class="badge el-${t.element}">${t.element}</span>` : ""} · Cost ${t.cost} chakra · Power ${t.power}</div>
          ${has ? `<div class="mastery"><i style="width:${mastery}%"></i></div><div class="list-desc">Mastery ${mastery}%</div>` : `<div class="list-desc">Requires ${t.gate} ${t.req} (you: ${gateVal})</div>`}
          <div class="list-foot">
            ${has
              ? `<span class="badge owned">Learned</span><button class="btn btn-sm" onclick="SLS.Techniques.train('${t.id}')">Train (10 stam)</button>`
              : `<span class="badge ${canLearn ? "" : "locked"}">${canLearn ? "Available" : "Locked"}</span><button class="btn btn-sm btn-primary" ${canLearn ? "" : "disabled"} onclick="SLS.Techniques.learn('${t.id}')">Learn</button>`}
          </div>
        </div>`;
      }).join("");
      return `<div class="panel">
        <h2 class="panel-title">Technique Collection</h2>
        <p class="section-note">Known: ${owned.length} of ${all.length} techniques across all disciplines.</p>
        <div class="filter-row">${frow}</div>
        <div class="grid-auto">${cards || `<p class="empty">No techniques match this filter.</p>`}</div>
      </div>`;
    },

    panel_relationships() {
      const rels = State.g.relationships;
      const team = State.g.team;
      const relCards = rels.length ? rels.map((r, i) => `
        <div class="list-card">
          <div class="list-head"><span class="list-title">${this.esc(r.npc.name)}</span><span class="badge">${r.type}</span></div>
          <div class="list-desc">${r.npc.clan} clan · ${r.npc.rank} · ${r.npc.personality}</div>
          <div class="mastery"><i style="width:${r.affinity}%"></i></div>
          <div class="list-foot"><span class="list-desc">Bond ${r.affinity}%</span>
            <button class="btn btn-sm" onclick="SLS.Relations.interact(${i})">Spend time (8 stam)</button></div>
        </div>`).join("") : `<p class="empty">No bonds yet. Use "Build Bonds" in Actions.</p>`;
      const teamCards = team.length ? team.map(m => `
        <div class="list-card"><div class="list-head"><span class="list-title">${this.esc(m.name)}</span><span class="badge">${m.rank}</span></div>
        <div class="list-desc">${m.clan} clan · ${m.personality} · Power ${m.power}</div></div>`).join("") : `<p class="empty">No team. Use "Form Team" in Actions.</p>`;
      return `<div class="panel"><h2 class="panel-title">Your Squad ${team.length}/3</h2><div class="grid-auto">${teamCards}</div></div>
        <div class="panel"><h2 class="panel-title">Bonds</h2><div class="grid-auto">${relCards}</div></div>`;
    },

    panel_inventory() {
      const inv = State.g.inventory;
      const eq = State.g.equipped;
      const eqLine = `<div class="kv"><span class="k">Weapon</span><span>${eq.weapon ? eq.weapon.name + " (+" + eq.weapon.bonus + ")" : "None"}</span></div>
        <div class="kv"><span class="k">Armor</span><span>${eq.armor ? eq.armor.name + " (+" + eq.armor.bonus + ")" : "None"}</span></div>`;
      const cards = inv.length ? inv.map(it => `
        <div class="list-card">
          <div class="list-head"><span class="list-title">${it.ico} ${this.esc(it.name)}</span><span class="badge">${it.type}</span></div>
          <div class="list-desc">${it.consumable ? "Consumable" : it.house ? "Property" : `+${it.bonus} ${it.stat}`}</div>
          <div class="list-foot"><span></span>
            <button class="btn btn-sm btn-primary" onclick="SLS.Shop.use('${it.uid}')">${it.type === "weapon" || it.type === "armor" ? "Equip" : it.house ? "Claim" : "Use"}</button></div>
        </div>`).join("") : `<p class="empty">Your pack is empty. Visit the Market.</p>`;
      return `<div class="panel"><h2 class="panel-title">Equipped</h2>${eqLine}</div>
        <div class="panel"><h2 class="panel-title">Inventory (${inv.length})</h2><div class="grid-auto">${cards}</div></div>`;
    },

    panel_shop() {
      const cat = Shop.catalog();
      const cards = cat.map(i => `
        <div class="list-card">
          <div class="list-head"><span class="list-title">${i.ico} ${this.esc(i.name)}</span><span class="badge">${i.type}</span></div>
          <div class="list-desc">${i.scroll ? "Unlocks a random technique" : i.consumable ? "One-time use" : `+${i.bonus} ${i.stat}`}</div>
          <div class="list-foot"><span class="list-desc">💰 ${i.value} ryo</span>
            <button class="btn btn-sm btn-primary" ${State.g.wealth < i.value ? "disabled" : ""} onclick="SLS.Shop.buy('${i.id}')">Buy</button></div>
        </div>`).join("");
      return `<div class="panel"><h2 class="panel-title">Market District</h2>
        <p class="section-note">Your ryo: <b>${State.g.wealth}</b></p>
        <div class="grid-auto">${cards}</div></div>`;
    },

    panel_map() {
      const nodes = Data.mapNodes.map(n => `
        <div class="map-node" onclick="SLS.UI.switchTab('${n.tab}')">
          <div class="map-ico">${n.ico}</div><div class="map-name">${n.name}</div><div class="map-sub">${n.sub}</div>
        </div>`).join("");
      return `<div class="panel"><h2 class="panel-title">${State.g.char.villageName} ${State.g.char.crest}</h2>
        <p class="section-note">Navigate your village.</p>
        <div class="map-grid">${nodes}</div></div>`;
    },

    panel_timeline() {
      const items = State.g.timeline.slice().reverse().map(t =>
        `<div class="tl-item"><div class="tl-age">Age ${t.age}</div><div class="tl-text">${this.esc(t.text)}</div></div>`
      ).join("");
      return `<div class="panel"><h2 class="panel-title">Life Timeline</h2>
        <div class="timeline">${items || `<p class="empty">Your story begins…</p>`}</div></div>`;
    },

    panel_journal() {
      const entries = State.g.journal.map(j =>
        `<div class="journal-entry ${j.kind || ""}"><span class="journal-age">Age ${j.age}</span> — ${this.esc(j.text)}</div>`
      ).join("");
      // Achievements section
      const achs = Achievements.list.map(a => {
        const un = State.g.achievements[a.id];
        if (a.hidden && !un) return `<div class="ach legendary"><div class="ach-name">🔒 ???</div><div class="ach-desc">Hidden legendary achievement.</div></div>`;
        return `<div class="ach ${un ? "unlocked" : ""} ${a.legendary ? "legendary" : ""}"><div class="ach-name">${un ? "🏅" : "🔒"} ${a.name}</div><div class="ach-desc">${a.desc}</div></div>`;
      }).join("");
      return `<div class="panel"><h2 class="panel-title">Journal</h2>
        <div style="max-height:340px;overflow-y:auto;">${entries || `<p class="empty">Nothing written yet.</p>`}</div></div>
        <div class="panel"><h2 class="panel-title">Achievements (${Achievements.count()}/${Achievements.list.length})</h2>
        <div class="ach-grid">${achs}</div></div>`;
    },

    panel_settings() {
      const s = State.g.settings;
      return `<div class="panel"><h2 class="panel-title">Settings</h2>
        <div class="setting-row"><span>Autosave</span>
          <label class="switch"><input type="checkbox" ${s.autosave ? "checked" : ""} onchange="SLS.Game.toggleSetting('autosave', this.checked)"><span class="slider"></span></label></div>
        <div class="setting-row"><span>Sound (ready for future audio)</span>
          <label class="switch"><input type="checkbox" ${s.sound ? "checked" : ""} onchange="SLS.Game.toggleSetting('sound', this.checked)"><span class="slider"></span></label></div>
        <div class="setting-row"><span>Difficulty</span><span>${State.g.difficultyCfg.name}</span></div>
      </div>
      <div class="panel"><h2 class="panel-title">Save Data</h2>
        <p class="section-note">Autosaves to this browser. Export a code to back up or transfer.</p>
        <div class="chip-row" style="margin-bottom:12px;">
          <button class="btn btn-sm" onclick="SLS.Game.doExport()">📤 Export Save</button>
          <button class="btn btn-sm" onclick="SLS.Game.doImport()">📥 Import Save</button>
          <button class="btn btn-sm" onclick="SLS.Game.manualSave()">💾 Save Now</button>
        </div>
        <div class="setting-row"><span style="color:var(--bad)">Reset & abandon this life</span>
          <button class="btn btn-sm" style="border-color:var(--bad);color:var(--bad)" onclick="SLS.Game.hardReset()">Reset</button></div>
      </div>`;
    }
  };
  SLS.UI = UI;

  /* ===============================================================
     GAME — bootstrap, character creation wiring, init
     =============================================================== */
  const Game = {
    rolled: null,        // rolled character preview
    selVillage: null,
    selDifficulty: "normal",

    init() {
      this.registerServiceWorker();
      this.buildCreationUI();
      this.wireGlobalButtons();
      // Resume existing save?
      const saved = Save.load();
      if (saved) {
        State.g = saved;
        this.enterGame();
        UI.toast("Welcome back", `${saved.char.name}, age ${saved.age}`, "good");
      }
    },

    // Register the PWA service worker for offline/home-screen use. Only runs
    // when served over http(s); silently skipped on file:// (the game is fully
    // self-contained and already works offline when opened directly).
    registerServiceWorker() {
      if (!("serviceWorker" in navigator)) return;
      if (location.protocol !== "http:" && location.protocol !== "https:") return;
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js").catch(() => { /* offline PWA is best-effort */ });
      });
    },

    // ----- Character creation screen -----
    buildCreationUI() {
      // Villages
      const vg = UI.el("village-select");
      vg.innerHTML = Data.villages.map(v => `
        <div class="village-card" data-village="${v.id}">
          <div class="vc-top"><span class="vc-crest">${v.crest}</span><span class="vc-name">${v.name}</span></div>
          <div class="vc-desc">${v.desc}</div>
        </div>`).join("");
      vg.querySelectorAll(".village-card").forEach(card => {
        card.addEventListener("click", () => {
          this.selVillage = card.dataset.village;
          vg.querySelectorAll(".village-card").forEach(c => c.classList.remove("selected"));
          card.classList.add("selected");
          if (!this.rolled) this.reroll(); else { this.rolled.village = this.selVillage; this.reroll(); }
          this.updateBegin();
        });
      });
      // Difficulties
      const ds = UI.el("difficulty-select");
      ds.innerHTML = Data.difficulties.map(d =>
        `<button type="button" class="chip ${d.id === "normal" ? "selected" : ""}" data-diff="${d.id}" title="${d.desc}">${d.name}</button>`
      ).join("");
      ds.querySelectorAll(".chip").forEach(c => {
        c.addEventListener("click", () => {
          this.selDifficulty = c.dataset.diff;
          ds.querySelectorAll(".chip").forEach(x => x.classList.remove("selected"));
          c.classList.add("selected");
        });
      });
    },

    reroll() {
      const vid = this.selVillage || RNG.pick(Data.villages).id;
      const name = UI.el("input-name").value.trim();
      this.rolled = Gen.character(vid, name, this.selDifficulty);
      this.renderPreview();
    },
    renderPreview() {
      const c = this.rolled; if (!c) return;
      const affinities = c.affinities.map(a => `<span class="tag el-${a}">${a}</span>`).join(" ");
      const traits = c.traits.map(t => `<span class="tag">${t}</span>`).join(" ");
      const blood = c.bloodline ? `<span class="tag bloodline" title="${c.bloodlineDesc}">✦ ${c.bloodline}</span>` : `<span class="tag">None</span>`;
      const rareClan = ["senju", "uzumaki", "uchiwa", "hyoga"].includes(c.clanId);
      UI.el("creation-preview").innerHTML = `
        <div class="preview-line"><span class="pl-key">Clan</span><span class="pl-val">${rareClan ? `<span class="tag rare">${c.clan}</span>` : c.clan}</span></div>
        <div class="preview-line"><span class="pl-key">Bloodline</span><span class="pl-val">${blood}</span></div>
        <div class="preview-line"><span class="pl-key">Affinity</span><span class="pl-val">${affinities}</span></div>
        <div class="preview-line"><span class="pl-key">Chakra Reserves</span><span class="pl-val">${c.maxChakra}</span></div>
        <div class="preview-line"><span class="pl-key">Health</span><span class="pl-val">${c.maxHealth}</span></div>
        <div class="preview-line"><span class="pl-key">Heritage</span><span class="pl-val">${c.family.heritage}</span></div>
        <div class="preview-line"><span class="pl-key">Traits</span><span class="pl-val">${traits}</span></div>`;
    },
    updateBegin() {
      const btn = UI.el("btn-begin");
      const ok = !!this.selVillage;
      btn.disabled = !ok;
      UI.el("begin-hint").textContent = ok ? "Your fate awaits." : "Select a village to continue.";
    },

    wireGlobalButtons() {
      UI.el("btn-reroll").addEventListener("click", () => { if (!this.selVillage) this.selVillage = RNG.pick(Data.villages).id, this.markVillage(); this.reroll(); });
      UI.el("input-name").addEventListener("input", () => { if (this.rolled) this.rolled.name = UI.el("input-name").value.trim() || this.rolled.name; });
      UI.el("btn-begin").addEventListener("click", () => this.begin());
      UI.el("btn-advance").addEventListener("click", () => Engine.advanceYear());
      // Tabs
      document.querySelectorAll(".tab").forEach(t => t.addEventListener("click", () => UI.switchTab(t.dataset.tab)));
      // Close modal on overlay click (only for non-blocking modals — skip if combat/event active)
      UI.el("modal-overlay").addEventListener("click", (e) => {
        if (e.target.id === "modal-overlay") {
          // don't allow closing combat/exam/event via backdrop
          if (Combat.cur && !Combat.cur.over) return;
          // keep event modals blocking too
        }
      });
    },
    markVillage() {
      document.querySelectorAll(".village-card").forEach(c => c.classList.toggle("selected", c.dataset.village === this.selVillage));
    },

    begin() {
      if (!this.rolled) this.reroll();
      const name = UI.el("input-name").value.trim();
      this.rolled.name = name || this.rolled.name;
      this.rolled.difficulty = this.selDifficulty;
      State.start(this.rolled);
      Save.save();
      this.enterGame();
      UI.toast("A shinobi is born", `${State.g.char.name} of the ${State.g.char.villageName}`, "legendary");
    },

    enterGame() {
      UI.el("screen-creation").classList.remove("active");
      UI.el("screen-game").classList.add("active");
      UI.switchTab("character");
      UI.renderAll();
    },

    // ----- Settings actions -----
    toggleSetting(key, val) { State.g.settings[key] = val; if (key === "sound") Audio.enabled = val; Save.autosave(); },
    manualSave() { Save.save(); UI.toast("Saved", "Progress stored.", "good"); },
    doExport() {
      const code = Save.export();
      UI.modal(`<h2 class="modal-title">Export Save</h2><p class="modal-text">Copy this code to back up your shinobi.</p>
        <textarea class="text-input" style="height:120px;resize:vertical" readonly onclick="this.select()">${code}</textarea>
        <div class="modal-choices"><button class="choice-btn" onclick="SLS.UI.closeModal()">Done</button></div>`);
    },
    doImport() {
      UI.modal(`<h2 class="modal-title">Import Save</h2><p class="modal-text">Paste a save code to restore.</p>
        <textarea id="import-box" class="text-input" style="height:120px;resize:vertical" placeholder="Paste code…"></textarea>
        <div class="modal-choices">
          <button class="choice-btn" onclick="SLS.Game.confirmImport()">Import</button>
          <button class="choice-btn" onclick="SLS.UI.closeModal()">Cancel</button></div>`);
    },
    confirmImport() {
      const code = UI.el("import-box").value;
      if (Save.import(code)) { Save.save(); UI.closeModal(); this.enterGame(); UI.toast("Imported", "Save restored.", "good"); }
      else UI.toast("Invalid code", "Could not import.", "bad");
    },
    hardReset() {
      if (State.g && State.g.difficultyCfg.ironman) {
        // Ironman: reset is permadeath-equivalent
      }
      UI.modal(`<h2 class="modal-title">Abandon this life?</h2><p class="modal-text">This permanently deletes your current shinobi and save.</p>
        <div class="modal-choices">
          <button class="choice-btn" style="border-color:var(--bad)" onclick="SLS.Game.confirmReset()">Yes, start over</button>
          <button class="choice-btn" onclick="SLS.UI.closeModal()">Cancel</button></div>`);
    },
    confirmReset() { Save.wipe(); location.reload(); },

    newLife() {
      // On death, wipe save and return to creation for a fresh character.
      Save.wipe();
      State.g = null;
      UI.closeModal();
      UI.el("screen-game").classList.remove("active");
      UI.el("screen-creation").classList.add("active");
      this.rolled = null; this.selVillage = null; this.selDifficulty = "normal";
      this.buildCreationUI();
      UI.el("input-name").value = "";
      UI.el("btn-begin").disabled = true;
    }
  };
  SLS.Game = Game;

  // ---- Boot ----
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => Game.init());
  else Game.init();

})();

