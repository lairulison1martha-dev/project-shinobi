/* =================================================================
   SHINOBI LIFE SIMULATOR — data.js
   -----------------------------------------------------------------
   All revamp content lives here as pure data so new stages, clans,
   bloodlines, weapons, summons, beasts, scenes, activities and events
   can be added without touching engine code.

   Exposes: window.SLS.C  (Content)
   ================================================================= */
(function () {
  "use strict";
  const SLS = (window.SLS = window.SLS || {});

  const C = {};
  SLS.C = C;

  /* ---------------------------------------------------------------
     LIFE STAGES — completely independent of ninja rank.
     `build` drives the sprite proportions (see sprite.js).
     --------------------------------------------------------------- */
  C.lifeStages = [
    { id: "newborn",   name: "Newborn",       min: 0,  max: 1,   build: { h: 0.40, head: 1.45, limb: 0.75 }, note: "Swaddled and helpless." },
    { id: "toddler",   name: "Toddler",       min: 2,  max: 3,   build: { h: 0.52, head: 1.32, limb: 0.82 }, note: "Wobbling first steps." },
    { id: "child",     name: "Young Child",   min: 4,  max: 5,   build: { h: 0.62, head: 1.22, limb: 0.88 }, note: "Curious and playful." },
    { id: "academyAge",name: "Academy Age",   min: 6,  max: 11,  build: { h: 0.72, head: 1.12, limb: 0.94 }, note: "Old enough for the Academy." },
    { id: "adolescent",name: "Adolescent",    min: 12, max: 15,  build: { h: 0.84, head: 1.04, limb: 1.00 }, note: "Growing into a shinobi." },
    { id: "teen",      name: "Teen Shinobi",  min: 16, max: 19,  build: { h: 0.92, head: 0.99, limb: 1.03 }, note: "Fast, sharp, still proving it." },
    { id: "youngAdult",name: "Young Adult",   min: 20, max: 29,  build: { h: 1.00, head: 0.95, limb: 1.06 }, note: "In your prime." },
    { id: "adult",     name: "Adult",         min: 30, max: 44,  build: { h: 1.00, head: 0.95, limb: 1.08 }, note: "Seasoned and respected." },
    { id: "veteran",   name: "Veteran",       min: 45, max: 59,  build: { h: 0.98, head: 0.96, limb: 1.06 }, note: "Scarred by long service." },
    { id: "elder",     name: "Elder",         min: 60, max: 300, build: { h: 0.94, head: 0.99, limb: 1.00 }, note: "A living piece of history." }
  ];
  C.stageFor = (age) => C.lifeStages.find(s => age >= s.min && age <= s.max) || C.lifeStages[C.lifeStages.length - 1];
  C.stageIndex = (id) => C.lifeStages.findIndex(s => s.id === id);

  /* ---------------------------------------------------------------
     RANKS — earned, never granted by age alone.
     --------------------------------------------------------------- */
  C.ranks = [
    { id: "civilian", name: "Civilian",        tier: 0 },
    { id: "student",  name: "Academy Student", tier: 1 },
    { id: "genin",    name: "Genin",           tier: 2 },
    { id: "chunin",   name: "Chunin",          tier: 3 },
    { id: "jonin",    name: "Jonin",           tier: 4 },
    { id: "elite",    name: "Elite Jonin",     tier: 5 },
    { id: "anbu",     name: "ANBU",            tier: 6 },
    { id: "captain",  name: "ANBU Captain",    tier: 7 },
    { id: "kage",     name: "Village Leader",  tier: 8 },
    { id: "legend",   name: "Legendary Shinobi", tier: 9 }
  ];
  C.rank = (id) => C.ranks.find(r => r.id === id) || C.ranks[0];
  C.rankTier = (id) => C.rank(id).tier;

  /* ---------------------------------------------------------------
     VILLAGES
     --------------------------------------------------------------- */
  C.villages = [
    { id: "leaf",  name: "Hidden Leaf",  crest: "🍃", nature: "Fire",      desc: "Village of camaraderie and the Will of Fire.", palette: ["#1d3b24", "#3f6b3a"] },
    { id: "sand",  name: "Hidden Sand",  crest: "🏜️", nature: "Wind",      desc: "Desert warriors, masters of puppetry and wind.", palette: ["#5a4526", "#a8863f"] },
    { id: "mist",  name: "Hidden Mist",  crest: "🌊", nature: "Water",     desc: "The Bloody Mist — silent killers and swordsmen.", palette: ["#1d3540", "#3b6e7d"] },
    { id: "cloud", name: "Hidden Cloud", crest: "⚡", nature: "Lightning", desc: "Mountain village of raw power and speed.", palette: ["#2c3350", "#5b6690"] },
    { id: "stone", name: "Hidden Stone", crest: "🪨", nature: "Earth",     desc: "Immovable earth ninja with iron resolve.", palette: ["#3d332a", "#6f6152"] },
    { id: "rain",  name: "Hidden Rain",  crest: "🌧️", nature: "Water",     desc: "Secretive village forged by endless war.", palette: ["#22293a", "#46536b"] }
  ];
  C.village = (id) => C.villages.find(v => v.id === id) || C.villages[0];

  /* ---------------------------------------------------------------
     BLOODLINES (Kekkei Genkai) — tied to clans, never random.
     `awaken` describes how it becomes active.
     --------------------------------------------------------------- */
  C.bloodlines = {
    sharingan:  { name: "Sharingan",        kind: "dojutsu", awaken: "emotion", desc: "Copy Wheel Eye — sees and copies technique.", aura: "fire" },
    byakugan:   { name: "Byakugan",         kind: "dojutsu", awaken: "innate",  desc: "All-seeing white eye with near-360° vision.", aura: "none" },
    shikotsu:   { name: "Dead Bone Pulse",  kind: "body",    awaken: "innate",  desc: "Grow and weaponise your own bones.", aura: "bone" },
    ice:        { name: "Ice Release",      kind: "nature",  awaken: "innate",  desc: "Fuse water and wind into ice.", aura: "ice" },
    wood:       { name: "Wood Release",     kind: "nature",  awaken: "rare",    desc: "Fuse water and earth into living wood.", aura: "wood" },
    lava:       { name: "Lava Release",     kind: "nature",  awaken: "rare",    desc: "Fuse fire and earth into molten rock.", aura: "lava" },
    storm:      { name: "Storm Release",    kind: "nature",  awaken: "rare",    desc: "Guide charged water as beams of light.", aura: "storm" },
    magnet:     { name: "Magnet Release",   kind: "nature",  awaken: "rare",    desc: "Bend iron sand and metal to your will.", aura: "magnet" },
    shadow:     { name: "Shadow Possession",kind: "hiden",   awaken: "innate",  desc: "Bind an enemy by joining their shadow.", aura: "shadow" },
    mind:       { name: "Mind Body Switch", kind: "hiden",   awaken: "innate",  desc: "Project your consciousness into another.", aura: "mind" },
    expansion:  { name: "Body Expansion",   kind: "hiden",   awaken: "innate",  desc: "Convert calories into raw size and force.", aura: "none" },
    insects:    { name: "Insect Host",      kind: "hiden",   awaken: "innate",  desc: "Host a hive that feeds on chakra.", aura: "insects" },
    houndbond:  { name: "Beast Mimicry",    kind: "hiden",   awaken: "innate",  desc: "Fight as one with a canine partner.", aura: "none" },
    hydration:  { name: "Hydrification",    kind: "body",    awaken: "innate",  desc: "Turn your body to living water.", aura: "water" },
    vitality:   { name: "Senju Vitality",   kind: "body",    awaken: "innate",  desc: "Overwhelming life force and stamina.", aura: "none" },
    sealing:    { name: "Uzumaki Sealing",  kind: "body",    awaken: "innate",  desc: "Vast chakra and mastery of seals.", aura: "seal" }
  };

  /* ---------------------------------------------------------------
     CLANS — canon-inspired. `weight` controls rarity at birth.
     `bloodline` + `inherit` = chance a born member actually carries it.
     --------------------------------------------------------------- */
  C.clans = [
    { id: "civilian", name: "Civilian",  weight: 40, villages: ["leaf","sand","mist","cloud","stone","rain"], bloodline: null, inherit: 0,
      desc: "No clan name to lean on — only your own effort.", bonus: { willpower: 2 } },
    { id: "uchiha",   name: "Uchiha",    weight: 4,  villages: ["leaf"], bloodline: "sharingan", inherit: 0.85,
      desc: "Fire-blooded prodigies bearing the Sharingan.", bonus: { ninjutsu: 5, genjutsu: 4, intelligence: 2 }, nature: "Fire" },
    { id: "hyuga",    name: "Hyuga",     weight: 5,  villages: ["leaf"], bloodline: "byakugan", inherit: 0.95,
      desc: "Noble house of the Gentle Fist and the Byakugan.", bonus: { taijutsu: 6, chakraControl: 4, speed: 2 } },
    { id: "senju",    name: "Senju",     weight: 3,  villages: ["leaf"], bloodline: "vitality", inherit: 0.7,
      desc: "The clan of a thousand skills and endless vitality.", bonus: { health: 20, willpower: 5, ninjutsu: 3 } },
    { id: "uzumaki",  name: "Uzumaki",   weight: 5,  villages: ["leaf","mist"], bloodline: "sealing", inherit: 0.8,
      desc: "Red-haired sealing masters with monstrous chakra.", bonus: { chakra: 40, health: 15, willpower: 4 } },
    { id: "kaguya",   name: "Kaguya",    weight: 2,  villages: ["mist"], bloodline: "shikotsu", inherit: 0.35,
      desc: "Savage bone-wielding warriors of a dying line.", bonus: { strength: 6, taijutsu: 5 } },
    { id: "nara",     name: "Nara",      weight: 8,  villages: ["leaf"], bloodline: "shadow", inherit: 0.9,
      desc: "Lazy geniuses who bind enemies with shadow.", bonus: { intelligence: 7, genjutsu: 2 } },
    { id: "yamanaka", name: "Yamanaka",  weight: 8,  villages: ["leaf"], bloodline: "mind", inherit: 0.9,
      desc: "Mind-walkers and the village's intelligence corps.", bonus: { intelligence: 5, genjutsu: 5 } },
    { id: "akimichi", name: "Akimichi",  weight: 8,  villages: ["leaf"], bloodline: "expansion", inherit: 0.9,
      desc: "Warm-hearted giants who turn food into power.", bonus: { strength: 7, health: 18 } },
    { id: "aburame",  name: "Aburame",   weight: 7,  villages: ["leaf"], bloodline: "insects", inherit: 0.95,
      desc: "Silent hosts to a chakra-eating hive.", bonus: { intelligence: 4, chakraControl: 4 } },
    { id: "inuzuka",  name: "Inuzuka",   weight: 8,  villages: ["leaf"], bloodline: "houndbond", inherit: 0.95,
      desc: "Feral trackers who fight beside their hounds.", bonus: { speed: 6, taijutsu: 4 }, companion: "hound" },
    { id: "hozuki",   name: "Hozuki",    weight: 4,  villages: ["mist"], bloodline: "hydration", inherit: 0.75,
      desc: "Water-bodied fighters who cannot be cut.", bonus: { ninjutsu: 5, health: 10 }, nature: "Water" },
    { id: "yuki",     name: "Yuki",      weight: 2,  villages: ["mist"], bloodline: "ice", inherit: 0.5,
      desc: "Hunted survivors of the ice-wielding bloodline.", bonus: { ninjutsu: 5, speed: 4 }, nature: "Water" },
    { id: "kurama",   name: "Kurama",    weight: 3,  villages: ["leaf"], bloodline: null, inherit: 0,
      desc: "Masters of illusion so real they wound.", bonus: { genjutsu: 8 } },
    { id: "sarutobi", name: "Sarutobi",  weight: 6,  villages: ["leaf"], bloodline: null, inherit: 0,
      desc: "Loyal soldiers of the Will of Fire.", bonus: { ninjutsu: 3, willpower: 4, taijutsu: 2 }, nature: "Fire" },
    { id: "kamizuki", name: "Kamizuki",  weight: 7,  villages: ["sand","stone","cloud","rain"], bloodline: null, inherit: 0,
      desc: "A steady frontier line of border guards.", bonus: { weapon: 4, willpower: 2 } }
  ];
  C.clan = (id) => C.clans.find(c => c.id === id) || C.clans[0];

  /* Dojutsu progression stages (Sharingan line + Byakugan). */
  C.dojutsuStages = {
    sharingan: [
      { id: "none",     name: "Dormant",                  tomoe: 0, drain: 0,  bonus: {} },
      { id: "tomoe1",   name: "One-Tomoe Sharingan",      tomoe: 1, drain: 4,  bonus: { genjutsu: 4, speed: 2 } },
      { id: "tomoe2",   name: "Two-Tomoe Sharingan",      tomoe: 2, drain: 6,  bonus: { genjutsu: 8, speed: 4, intelligence: 3 } },
      { id: "tomoe3",   name: "Three-Tomoe Sharingan",    tomoe: 3, drain: 9,  bonus: { genjutsu: 14, speed: 7, intelligence: 6, ninjutsu: 4 } },
      { id: "mangekyo", name: "Mangekyo Sharingan",       tomoe: 4, drain: 18, bonus: { genjutsu: 24, ninjutsu: 12, speed: 9 }, risk: "vision" },
      { id: "eternal",  name: "Eternal Mangekyo Sharingan", tomoe: 5, drain: 15, bonus: { genjutsu: 32, ninjutsu: 18, speed: 12 } }
    ],
    byakugan: [
      { id: "none",   name: "Dormant",   drain: 0, bonus: {} },
      { id: "active", name: "Byakugan",  drain: 5, bonus: { taijutsu: 10, intelligence: 6, chakraControl: 5 } }
    ]
  };

  /* ---------------------------------------------------------------
     CHAKRA NATURES — drive the background aura layer.
     --------------------------------------------------------------- */
  C.natures = {
    Fire:      { color: "#e8623d", glow: "#ff9a5b", icon: "🔥" },
    Water:     { color: "#4b93d1", glow: "#7ec2f0", icon: "💧" },
    Wind:      { color: "#63c28a", glow: "#9ce6b8", icon: "🌪️" },
    Earth:     { color: "#b58b4a", glow: "#d9b478", icon: "🪨" },
    Lightning: { color: "#d9c74b", glow: "#f5e97e", icon: "⚡" }
  };
  C.natureList = Object.keys(C.natures);

  /* ---------------------------------------------------------------
     WEAPONS — every one gates on age / rank / strength.
     `carry` decides where it is drawn on the sprite.
     --------------------------------------------------------------- */
  C.weapons = [
    { id: "w_woodkunai", name: "Wooden Training Kunai", type: "training", minAge: 6,  minRank: "student", str: 0,  price: 40,   dmg: 2,  carry: "hand",  color: "#a97b4e", desc: "Blunt practice tool used at the Academy." },
    { id: "w_woodsword", name: "Wooden Sword",          type: "training", minAge: 6,  minRank: "student", str: 4,  price: 70,   dmg: 3,  carry: "back",  color: "#a97b4e", desc: "Bokken for safe sparring." },
    // Kunai and shuriken are light enough that any graduate can carry them.
    { id: "w_kunai",     name: "Kunai",                 type: "blade",    minAge: 12, minRank: "genin",   str: 0,  price: 150,  dmg: 6,  carry: "hand",  color: "#c9d2dc", desc: "Standard-issue ninja blade." },
    { id: "w_shuriken",  name: "Shuriken Pouch",        type: "thrown",   minAge: 12, minRank: "genin",   str: 0,  price: 180,  dmg: 5,  carry: "waist", color: "#c9d2dc", desc: "A bandolier of throwing stars." },
    { id: "w_shortsword",name: "Short Sword",           type: "blade",    minAge: 12, minRank: "genin",   str: 8,  price: 420,  dmg: 11, carry: "waist", color: "#dfe6ee", desc: "Fast, close-quarters steel." },
    { id: "w_katana",    name: "Katana",                type: "blade",    minAge: 14, minRank: "chunin",  str: 14, price: 1200, dmg: 18, carry: "back",  color: "#eef3f8", desc: "A finely folded blade." },
    { id: "w_staff",     name: "Bo Staff",              type: "blunt",    minAge: 12, minRank: "genin",   str: 10, price: 300,  dmg: 9,  carry: "back",  color: "#8a6a3f", desc: "Reach and control." },
    { id: "w_warfan",    name: "War Fan",               type: "special",  minAge: 14, minRank: "chunin",  str: 12, price: 1500, dmg: 16, carry: "back",  color: "#d95d6a", desc: "Channels wind with every sweep." },
    { id: "w_bow",       name: "Shinobi Bow",           type: "ranged",   minAge: 14, minRank: "chunin",  str: 12, price: 900,  dmg: 15, carry: "back",  color: "#7c5a34", desc: "Silent death at distance." },
    { id: "w_scythe",    name: "Chain Scythe",          type: "special",  minAge: 16, minRank: "chunin",  str: 16, price: 2000, dmg: 21, carry: "back",  color: "#b8c2cc", desc: "Unpredictable arcs of steel." },
    { id: "w_greatsword",name: "Executioner's Blade",   type: "blade",    minAge: 16, minRank: "jonin",   str: 26, price: 5000, dmg: 34, carry: "beside",color: "#dbe3ea", desc: "A slab of steel taller than most ninja." },
    { id: "w_chakrablade",name:"Chakra Blades",         type: "blade",    minAge: 16, minRank: "jonin",   str: 18, price: 6500, dmg: 30, carry: "hand",  color: "#8fd8ff", desc: "Steel that conducts raw chakra." },
    { id: "w_puppet",    name: "Battle Puppet",         type: "special",  minAge: 14, minRank: "chunin",  str: 8,  price: 4200, dmg: 24, carry: "beside",color: "#c1a06a", desc: "A jointed killer on chakra strings." }
  ];
  C.weapon = (id) => C.weapons.find(w => w.id === id) || null;

  /* Armour / clothing / consumables kept simple and gated the same way. */
  C.gear = [
    { id: "g_academy",  name: "Academy Tunic",   type: "armor", minAge: 6,  minRank: "student", price: 120,  def: 2,  desc: "Standard Academy uniform." },
    { id: "g_mesh",     name: "Mesh Undershirt", type: "armor", minAge: 12, minRank: "genin",   price: 320,  def: 5,  desc: "Chain mesh worn under clothing." },
    { id: "g_flak",     name: "Flak Jacket",     type: "armor", minAge: 12, minRank: "chunin",  price: 1400, def: 12, desc: "Plated vest issued to Chunin." },
    { id: "g_anbu",     name: "ANBU Guard",      type: "armor", minAge: 16, minRank: "anbu",    price: 4800, def: 22, desc: "Light armour of the black ops." },
    { id: "g_ration",   name: "Ration Pack",     type: "food",  minAge: 0,  minRank: "civilian",price: 45,   heal: 35, consumable: true, desc: "Restores health." },
    { id: "g_pill",     name: "Soldier Pill",    type: "food",  minAge: 6,  minRank: "student", price: 90,   chakra: 60, consumable: true, desc: "Restores chakra." },
    { id: "g_weights",  name: "Training Weights",type: "train", minAge: 6,  minRank: "student", price: 260,  stat: "strength", bonus: 3, consumable: true, desc: "Permanent strength gain." },
    { id: "g_scroll",   name: "Technique Scroll",type: "scroll",minAge: 6,  minRank: "student", price: 500,  consumable: true, desc: "Teaches a random technique." }
  ];

  /* ---------------------------------------------------------------
     SUMMONING CONTRACTS — must be found, never chosen at birth.
     --------------------------------------------------------------- */
  C.summons = [
    { id: "toad",   name: "Toad",   glyph: "🐸", color: "#5b8c3a", role: "support", desc: "Boisterous mountain toads who honour their word." },
    { id: "snake",  name: "Snake",  glyph: "🐍", color: "#7a9b3f", role: "assassin", desc: "Cold, patient, and always calculating." },
    { id: "slug",   name: "Slug",   glyph: "🐌", color: "#c0a6d0", role: "medical", desc: "Healing slugs that divide to shield allies." },
    { id: "hound",  name: "Hound",  glyph: "🐕", color: "#9a7449", role: "tracker", desc: "Loyal ninken with a nose for anything." },
    { id: "hawk",   name: "Hawk",   glyph: "🦅", color: "#8f6b3f", role: "scout", desc: "Sharp-eyed hunters of the high wind." },
    { id: "crow",   name: "Crow",   glyph: "🐦‍⬛", color: "#3a3f4a", role: "illusion", desc: "Clever birds that carry genjutsu in their wings." },
    { id: "wolf",   name: "Wolf",   glyph: "🐺", color: "#6d7684", role: "pack", desc: "They never hunt alone." },
    { id: "cat",    name: "Nin-Cat",glyph: "🐈", color: "#a9803f", role: "spy", desc: "Sarcastic informants of the shadow market." },
    { id: "turtle", name: "Turtle", glyph: "🐢", color: "#4c7a5a", role: "guardian", desc: "Ancient shields with unshakeable patience." },
    { id: "beetle", name: "Beetle", glyph: "🪲", color: "#4a5a3a", role: "swarm", desc: "Armoured insects that drain chakra." },
    { id: "kirin",  name: "Storm Kirin", glyph: "🦌", color: "#6fa8dc", role: "legendary", rare: true, desc: "A mythic beast of thunder and mist." }
  ];
  C.summon = (id) => C.summons.find(s => s.id === id) || null;

  /* ---------------------------------------------------------------
     TAILED BEASTS — never selectable; found only by rare chance.
     --------------------------------------------------------------- */
  C.beasts = [
    { id: "b1", tails: 1, name: "Shukaku",  glyph: "🦝", color: "#d8c48a", nature: "Wind",      region: "sand",  rarity: 0.16, temper: "manic",     desc: "A sand-formed tanuki that never sleeps." },
    { id: "b2", tails: 2, name: "Matatabi", glyph: "🐈‍⬛", color: "#5fa8d3", nature: "Fire",     region: "cloud", rarity: 0.14, temper: "proud",     desc: "A two-tailed cat wreathed in blue flame." },
    { id: "b3", tails: 3, name: "Isobu",    glyph: "🐢", color: "#7fb0a5", nature: "Water",     region: "mist",  rarity: 0.13, temper: "timid",     desc: "An armoured turtle of the deep coast." },
    { id: "b4", tails: 4, name: "Son Goku", glyph: "🦍", color: "#c86a3a", nature: "Earth",     region: "stone", rarity: 0.12, temper: "honourable",desc: "A lava-maned ape who despises captivity." },
    { id: "b5", tails: 5, name: "Kokuo",    glyph: "🐎", color: "#d9d2c4", nature: "Water",     region: "stone", rarity: 0.11, temper: "calm",      desc: "A dolphin-horse of immense steam-driven power." },
    { id: "b6", tails: 6, name: "Saiken",   glyph: "🐌", color: "#c3d17a", nature: "Water",     region: "mist",  rarity: 0.10, temper: "gentle",    desc: "A slug that weeps corrosive mist." },
    { id: "b7", tails: 7, name: "Chomei",   glyph: "🪲", color: "#8fc98a", nature: "Wind",      region: "rain",  rarity: 0.09, temper: "playful",   desc: "A scarab whose wings scatter scales of light." },
    { id: "b8", tails: 8, name: "Gyuki",    glyph: "🐂", color: "#7b8fa6", nature: "Lightning", region: "cloud", rarity: 0.07, temper: "stubborn",  desc: "An ox-squid that has broken a hundred seals." },
    { id: "b9", tails: 9, name: "Kurama",   glyph: "🦊", color: "#e05a2b", nature: "Fire",      region: "leaf",  rarity: 0.05, temper: "hateful",   desc: "The Nine-Tailed Fox. Hatred given a shape." }
  ];
  C.beast = (id) => C.beasts.find(b => b.id === id) || null;

  /* Jinchuriki transformation stages, unlocked by synchronization. */
  C.cloakStages = [
    { id: "none",    name: "Sealed",        sync: 0,   bonus: 0,   drain: 0 },
    { id: "veil",    name: "Chakra Veil",   sync: 25,  bonus: 0.15, drain: 8 },
    { id: "cloak1",  name: "One-Tail Cloak",sync: 45,  bonus: 0.35, drain: 16 },
    { id: "cloak2",  name: "Partial Form",  sync: 65,  bonus: 0.6,  drain: 28 },
    { id: "full",    name: "Full Bijuu Mode", sync: 88, bonus: 1.1, drain: 45 }
  ];

  /* ---------------------------------------------------------------
     ACADEMY CURRICULUM — progress tracks that gate graduation.
     --------------------------------------------------------------- */
  C.academyTracks = [
    { id: "knowledge", name: "Academic Knowledge", stat: "intelligence" },
    { id: "control",   name: "Chakra Control",     stat: "chakraControl" },
    { id: "taijutsu",  name: "Taijutsu Basics",    stat: "taijutsu" },
    { id: "accuracy",  name: "Accuracy",           stat: "weapon" },
    { id: "clone",     name: "Clone Technique",    stat: "ninjutsu" },
    { id: "henge",     name: "Transformation",     stat: "ninjutsu" }
  ];

  C.graduation = {
    minAge: 11,
    prodigyAge: 9,          // exceptional students may sit the exam early
    minAttendance: 55,
    minTrackAvg: 55,
    minCoreTech: 50,        // clone + henge must each reach this
    prodigyTrackAvg: 82     // bar for graduating ahead of schedule
  };

  /* ---------------------------------------------------------------
     SCENES — original CSS/SVG backdrops (no external images).
     --------------------------------------------------------------- */
  C.scenes = {
    home:      { name: "Family Home",     sky: ["#2a1f18", "#181310"], ground: "#3a2a1e", props: "home" },
    village:   { name: "Village Street",  sky: ["#243044", "#141a26"], ground: "#2b2f3a", props: "village" },
    classroom: { name: "Academy Classroom", sky: ["#2b2418", "#191510"], ground: "#3c3122", props: "classroom" },
    yard:      { name: "Academy Yard",    sky: ["#22321f", "#141c14"], ground: "#33452c", props: "yard" },
    field:     { name: "Training Field",  sky: ["#1f2e22", "#131b16"], ground: "#2e4030", props: "field" },
    range:     { name: "Throwing Range",  sky: ["#2d2a1c", "#1a1812"], ground: "#3d3826", props: "range" },
    forest:    { name: "Deep Forest",     sky: ["#16241c", "#0d1512"], ground: "#1f3226", props: "forest" },
    river:     { name: "Riverbank",       sky: ["#1b2c38", "#101a22"], ground: "#23404f", props: "river" },
    waterfall: { name: "Waterfall",       sky: ["#182935", "#0e1720"], ground: "#1f3a49", props: "waterfall" },
    mountain:  { name: "Mountain Pass",   sky: ["#2a2a33", "#16161c"], ground: "#3a3a44", props: "mountain" },
    cave:      { name: "Hidden Cave",     sky: ["#151318", "#0a090c"], ground: "#241f28", props: "cave" },
    ruins:     { name: "Ancient Ruins",   sky: ["#241f2c", "#12101a"], ground: "#332c3c", props: "ruins" },
    camp:      { name: "Mission Camp",    sky: ["#221a1a", "#130f0f"], ground: "#332727", props: "camp" },
    arena:     { name: "Exam Arena",      sky: ["#2c2320", "#181312"], ground: "#3e332e", props: "arena" }
  };

  /* ---------------------------------------------------------------
     ACTIVITIES — the heart of the age-gating rules.
     stages: allowed life-stage ids.  rank: minimum rank id.
     academy: requires active enrolment.  cost = stamina.
     --------------------------------------------------------------- */
  C.activities = [
    // --- Infancy / early childhood ---
    { id: "bond_family",  name: "Bond with Family",  ico: "👪", scene: "home",   cost: 0,  stages: ["newborn","toddler","child","academyAge","adolescent"], desc: "Time with the people who raised you." },
    { id: "babble",       name: "Babble & Crawl",    ico: "🍼", scene: "home",   cost: 0,  stages: ["newborn"], desc: "Everything is new and enormous." },
    { id: "play",         name: "Play Outside",      ico: "🪁", scene: "village",cost: 0,  stages: ["toddler","child","academyAge"], desc: "Run, fall, laugh, repeat." },
    { id: "observe",      name: "Watch the Shinobi", ico: "👀", scene: "village",cost: 0,  stages: ["toddler","child","academyAge"], desc: "Study the ninja on the rooftops." },
    { id: "balance",      name: "Balance Practice",  ico: "🤸", scene: "yard",   cost: 4,  stages: ["child","academyAge","adolescent"], desc: "Coordination drills on a log." },
    { id: "history",      name: "Village History",   ico: "📖", scene: "home",   cost: 4,  stages: ["child","academyAge","adolescent","teen","youngAdult","adult","veteran","elder"], desc: "Learn who came before you." },
    { id: "sense",        name: "Sense Chakra",      ico: "🫧", scene: "home",   cost: 4,  stages: ["child","academyAge","adolescent","teen","youngAdult","adult","veteran","elder"], desc: "Feel the warmth moving inside you." },

    // --- Academy ---
    { id: "enroll",       name: "Enrol in the Academy", ico: "🏫", scene: "classroom", cost: 0, minAge: 6, maxAge: 11, special: "enroll", desc: "Sign the register and take your seat." },
    { id: "attend",       name: "Attend Class",      ico: "🏫", scene: "classroom", cost: 6,  academy: true, desc: "Lessons, drills, and roll call." },
    { id: "study_theory", name: "Chakra Theory",     ico: "📚", scene: "classroom", cost: 6,  academy: true, desc: "The written half of being a ninja." },
    { id: "clone_prac",   name: "Clone Practice",    ico: "👥", scene: "classroom", cost: 8,  academy: true, desc: "Split your chakra evenly. Again." },
    { id: "henge_prac",   name: "Transformation Practice", ico: "🎭", scene: "classroom", cost: 8, academy: true, desc: "Hold another shape without slipping." },
    { id: "tai_lesson",   name: "Taijutsu Lesson",   ico: "🥋", scene: "yard",   cost: 10, academy: true, desc: "Stances, strikes, and bruises." },
    { id: "shuriken_les", name: "Shuriken Lesson",   ico: "🎯", scene: "range",  cost: 10, academy: true, minigame: "precision", desc: "Wooden targets and endless throws." },
    { id: "spar_lesson",  name: "Supervised Spar",   ico: "🤼", scene: "yard",   cost: 12, academy: true, desc: "Fight a classmate, sensei watching." },
    { id: "classmates",   name: "Time with Classmates", ico: "🧑‍🤝‍🧑", scene: "classroom", cost: 4, academy: true, desc: "Friendships forged over lunch." },
    { id: "teacher_talk", name: "Speak to Your Teacher", ico: "🧑‍🏫", scene: "classroom", cost: 4, academy: true, desc: "Advice from the front of the room." },
    { id: "skip_class",   name: "Skip Class",        ico: "🚪", scene: "village", cost: 0, academy: true, desc: "Nobody will notice. Probably." },
    { id: "grad_exam",    name: "Attempt Graduation", ico: "🎓", scene: "arena", cost: 20, academy: true, special: "graduate", desc: "The exam that makes you a Genin." },

    // --- Chakra & physical training (age-scaled) ---
    { id: "chakra_train", name: "Chakra Control Training", ico: "🌀", scene: "field", cost: 12, stages: ["academyAge","adolescent","teen","youngAdult","adult","veteran","elder"], minigame: "chakra", desc: "Tree climbing, water walking, focus." },
    { id: "meditate",     name: "Meditate",          ico: "🧘", scene: "waterfall", cost: 6, stages: ["child","academyAge","adolescent","teen","youngAdult","adult","veteran","elder"], minigame: "chakra", desc: "Still the mind, deepen the well." },
    { id: "conditioning", name: "Physical Conditioning", ico: "🏋️", scene: "field", cost: 14, stages: ["academyAge","adolescent","teen","youngAdult","adult","veteran"], desc: "Weights, laps, and aching legs." },
    { id: "precision",    name: "Precision Training",ico: "🎯", scene: "range",  cost: 12, stages: ["academyAge","adolescent","teen","youngAdult","adult","veteran"], minigame: "precision", desc: "Throw until the target is boring." },
    { id: "weapon_train", name: "Weapon Practice",   ico: "⚔️", scene: "yard",   cost: 12, rank: "genin", desc: "Drill your equipped weapon." },
    { id: "jutsu_study",  name: "Study Techniques",  ico: "📜", scene: "home",   cost: 10, rank: "student", desc: "Learn new jutsu from scrolls." },

    // --- Genin and beyond ---
    { id: "explore",      name: "Explore",           ico: "🧭", scene: "forest", cost: 14, rank: "genin", special: "explore", desc: "Leave the walls and see what finds you." },
    { id: "spar",         name: "Spar a Rival",      ico: "⚔️", scene: "yard",   cost: 16, rank: "genin", special: "spar", desc: "A real fight with real stakes." },
    { id: "team_train",   name: "Team Training",     ico: "👥", scene: "field",  cost: 12, rank: "genin", desc: "Drill formations with your squad." },
    { id: "socialise",    name: "Build Bonds",       ico: "🤝", scene: "village",cost: 6,  stages: ["child","academyAge","adolescent","teen","youngAdult","adult","veteran","elder"], special: "social", desc: "Meet someone new, or deepen an old tie." },
    { id: "rest",         name: "Rest",              ico: "😴", scene: "home",   cost: 0,  desc: "Recover health, chakra and stamina." },
    { id: "work",         name: "Odd Jobs",          ico: "💰", scene: "village",cost: 10, stages: ["academyAge","adolescent","teen","youngAdult","adult","veteran"], desc: "Honest work for honest ryo." }
  ];

  /* ---------------------------------------------------------------
     EXPLORATION ENCOUNTERS — choices gate on the player's state.
     --------------------------------------------------------------- */
  C.encounters = [
    { id: "deer",    name: "Grazing Deer",     glyph: "🦌", scene: "forest", danger: 0,
      text: "A deer lifts its head, watching you without fear.",
      options: [
        { label: "Observe quietly", fx: { intelligence: 1, calm: 1 }, text: "You memorise how it moves. Stillness has its own lesson." },
        { label: "Feed it", fx: { kind: 2, rep: 1 }, text: "It takes the offering from your palm and wanders off." },
        { label: "Hunt it", need: { rank: "genin" }, fx: { wealth: 90, cruel: 1 }, text: "You sell the meat in the market. It feeds a family for a week." }
      ] },
    { id: "herbs",   name: "Rare Herbs",       glyph: "🌿", scene: "forest", danger: 0,
      text: "A cluster of medicinal herbs grows in the shade.",
      options: [
        { label: "Gather them", fx: { wealth: 120, intelligence: 1 }, text: "The apothecary pays well for a clean harvest." },
        { label: "Leave them to seed", fx: { kind: 1, rep: 1 }, text: "Next season there will be more. That matters too." }
      ] },
    { id: "traveler",name: "Injured Traveller",glyph: "🧑‍🦯", scene: "mountain", danger: 0,
      text: "A traveller has fallen on the rocks, their leg badly broken.",
      options: [
        { label: "Carry them to the village", fx: { kind: 3, rep: 4, stamina: -10 }, memory: "savedMe", text: "They never forget the face that carried them home." },
        { label: "Bandage and leave supplies", fx: { kind: 1, rep: 2 }, text: "Enough to survive the night, at least." },
        { label: "Rob them", fx: { wealth: 260, cruel: 3, rep: -6 }, memory: "abandonedMe", text: "You take their purse and walk. They watch you go." },
        { label: "Walk past", fx: { cruel: 1, rep: -2 }, text: "Not your problem. You tell yourself that twice." }
      ] },
    { id: "scroll",  name: "Hidden Scroll",    glyph: "📜", scene: "ruins", danger: 0,
      text: "A sealed scroll is wedged inside a cracked stone pillar.",
      options: [
        { label: "Open it now", fx: { learnTech: 1, chakra: -20 }, text: "The seal bites your fingers, but the technique is yours." },
        { label: "Take it home to study", fx: { item: "g_scroll" }, text: "Better to read it somewhere safe." }
      ] },
    { id: "bandits", name: "Bandit Ambush",    glyph: "🗡️", scene: "forest", danger: 2,
      text: "Three bandits step out of the treeline, blades already drawn.",
      options: [
        { label: "Fight them", need: { rank: "genin" }, fx: { combat: "bandit" }, text: "" },
        { label: "Use a technique", need: { rank: "genin", chakra: 20 }, fx: { combat: "bandit", buff: 1, chakra: -20 }, text: "" },
        { label: "Hide", fx: { check: "speed", ok: { brave: -1 }, fail: { health: -14 } }, text: "" },
        { label: "Run for the village", fx: { flee: 1 }, text: "" }
      ] },
    { id: "roguenin",name: "Rogue Shinobi",    glyph: "🥷", scene: "mountain", danger: 3,
      text: "A scratched headband. A missing-nin, and they have already seen you.",
      options: [
        { label: "Stand and fight", need: { rank: "genin" }, fx: { combat: "rogue" }, text: "" },
        { label: "Call for help", fx: { rep: 2, flee: 1 }, text: "You signal the patrol and fall back. No shame in living." },
        { label: "Flee", fx: { flee: 1, brave: -1 }, text: "" }
      ] },
    { id: "hurtwolf",name: "Wounded Wolf",     glyph: "🐺", scene: "forest", danger: 1,
      text: "A wolf is caught in an old trap, snarling through its pain.",
      options: [
        { label: "Free it carefully", fx: { kind: 3, brave: 2, summonChance: "wolf" }, text: "It limps away — then stops, and looks back at you." },
        { label: "Put it down", fx: { cruel: 2 }, text: "Mercy, of a kind. You do not enjoy it." },
        { label: "Leave it", fx: {}, text: "Nature is not your responsibility today." }
      ] },
    { id: "elder",   name: "Wandering Master", glyph: "🧙", scene: "mountain", danger: 0,
      text: "An old shinobi sits by a fire, apparently expecting you.",
      options: [
        { label: "Ask for training", fx: { teach: 1, stamina: -10 }, text: "They correct your stance in three words. Everything clicks." },
        { label: "Share your food", fx: { kind: 2, teach: 1 }, text: "Kindness buys a longer lesson than money would." },
        { label: "Keep moving", fx: {}, text: "You leave them to their fire." }
      ] },
    { id: "cavechakra", name: "Strange Chakra", glyph: "🕳️", scene: "cave", danger: 2, deep: true,
      text: "Something enormous is breathing far below. The air tastes like iron.",
      options: [
        { label: "Descend toward it", need: { rank: "genin" }, fx: { beastChance: 1 }, text: "" },
        { label: "Mark the spot and leave", fx: { rep: 2, intelligence: 1 }, text: "You report the coordinates. The village will decide." },
        { label: "Run", fx: { flee: 1 }, text: "Every instinct you own agrees on this one." }
      ] },
    { id: "shrine",  name: "Forgotten Shrine", glyph: "⛩️", scene: "ruins", danger: 0,
      text: "A shrine to a summoning clan, its contract stone still warm.",
      options: [
        { label: "Press your hand to the stone", fx: { summonChance: "any" }, text: "" },
        { label: "Pray and leave", fx: { willpower: 2, calm: 1 }, text: "Something old acknowledges you, and lets you go." }
      ] }
  ];

  /* ---------------------------------------------------------------
     LIFE EVENTS — fire by life stage / condition, not random noise.
     `once` events never repeat.
     --------------------------------------------------------------- */
  C.lifeEvents = [
    { id: "first_steps", stage: "toddler", once: true, weight: 10, title: "First Steps",
      text: "You let go of the table, wobble, and take three whole steps before landing on your backside.",
      choices: [{ label: "Try again immediately", fx: { willpower: 2, speed: 1, brave: 1 } }, { label: "Cry for your mother", fx: { family: 4 } }] },
    { id: "first_words", stage: "toddler", once: true, weight: 10, title: "First Words",
      text: "Your family leans in as you form your very first word.",
      choices: [{ label: "Say a parent's name", fx: { family: 6 } }, { label: "Say the village's name", fx: { rep: 2, willpower: 1 } }] },
    { id: "chakra_sign", stage: "child", once: true, weight: 9, title: "Early Chakra Signs",
      text: "You knock a cup off the table without touching it. The room goes very quiet.",
      choices: [{ label: "Do it again on purpose", fx: { chakraControl: 3, ambitious: 1 } }, { label: "Hide it", fx: { intelligence: 2, independent: 1 } }] },
    { id: "clan_ceremony", stage: "child", once: true, weight: 8, clanOnly: true, title: "Clan Ceremony",
      text: "Your clan gathers to formally acknowledge you as one of their own.",
      choices: [{ label: "Swear the oath proudly", fx: { willpower: 3, rep: 3, loyal: 2 } }, { label: "Stay silent through it", fx: { independent: 2 } }] },
    { id: "childhood_friend", stage: "child", once: true, weight: 10, title: "A Childhood Friend",
      text: "Another child shares their lunch with you without being asked.",
      choices: [{ label: "Share yours tomorrow", fx: { newBond: "friend", kind: 2 } }, { label: "Take it and run", fx: { cruel: 2 } }] },
    { id: "future_rival", stage: "academyAge", once: true, weight: 9, title: "A Future Rival",
      text: "A classmate beats you at everything today, then smirks about it.",
      choices: [{ label: "Swear to surpass them", fx: { newBond: "rival", ambitious: 2, willpower: 2 } }, { label: "Congratulate them honestly", fx: { newBond: "friend", kind: 2, honest: 2 } }] },
    { id: "bullying", stage: "academyAge", weight: 6, title: "Bullying in the Yard",
      text: "Three older students are cornering a smaller classmate behind the Academy.",
      choices: [
        { label: "Step in front of them", fx: { brave: 3, kind: 2, rep: 3, health: -8 }, memory: "savedMe" },
        { label: "Fetch a teacher", fx: { honest: 2, rep: 1 } },
        { label: "Walk away", fx: { cruel: 1 } },
        { label: "Join in", fx: { cruel: 3, rep: -4 }, memory: "betrayedMe" }
      ] },
    { id: "teacher_praise", stage: "academyAge", weight: 6, academy: true, title: "Teacher's Praise",
      text: "Your instructor holds up your work as an example to the whole class.",
      choices: [{ label: "Accept it modestly", fx: { teacher: 6, kind: 1 } }, { label: "Show off", fx: { teacher: 2, arrogant: 2, rep: 1 } }] },
    { id: "sibling_born", stage: "child", once: true, weight: 5, title: "A Sibling is Born",
      text: "Your family has grown by one very loud new arrival.",
      choices: [{ label: "Promise to protect them", fx: { family: 6, protective: 3 } }, { label: "Resent the attention", fx: { family: -3, ambitious: 1 } }] },
    { id: "family_loss", stage: "academyAge", once: true, weight: 3, title: "A Death in the Family",
      text: "A mission notice arrives. Someone who raised you is not coming home.",
      irreversible: true,
      choices: [
        { label: "Vow to grow strong enough", fx: { willpower: 5, ambitious: 3, sharinganTrigger: 1 }, memory: "familyLoss" },
        { label: "Withdraw from everyone", fx: { independent: 4, family: -4, sharinganTrigger: 1 }, memory: "familyLoss" }
      ] },
    { id: "team_conflict", rank: "genin", weight: 6, title: "Teammate Conflict",
      text: "Your squadmate blames you loudly for a mistake that was, honestly, half theirs.",
      choices: [
        { label: "Take the blame anyway", fx: { team: 8, kind: 2, loyal: 2 } },
        { label: "Argue back", fx: { team: -6, arrogant: 2 } },
        { label: "Explain calmly", fx: { team: 4, calm: 3, honest: 2 } }
      ] },
    { id: "first_battle", rank: "genin", once: true, weight: 8, title: "First Real Battle",
      text: "The bandit in front of you is not a training dummy, and neither are you any more.",
      choices: [{ label: "Fight", fx: { combat: "bandit" } }, { label: "Let your sensei handle it", fx: { brave: -2, team: -2 } }] },
    { id: "chunin_invite", rank: "genin", once: true, weight: 7, minAge: 13, title: "Chunin Exam Invitation",
      text: "Your sensei nominates your squad for the Chunin Exams.",
      choices: [{ label: "Accept the nomination", fx: { flagChunin: 1, ambitious: 2 } }, { label: "Decline — not ready", fx: { calm: 2 } }] },
    { id: "festival", weight: 5, minAge: 4, title: "Village Festival",
      text: "Lanterns fill the streets and the whole village is out celebrating.",
      choices: [{ label: "Go with someone you care about", fx: { bondBoost: 8, social: 2 } }, { label: "Train through it", fx: { willpower: 2, disciplined: 3, social: -1 } }] },
    { id: "rogue_offer", rank: "genin", weight: 2, minAge: 14, title: "A Whisper at the Gate",
      text: "A masked figure offers you power, if you will simply walk away from the village tonight.",
      irreversible: true,
      choices: [
        { label: "Refuse and report it", fx: { rep: 6, loyal: 4 } },
        { label: "Refuse and say nothing", fx: { independent: 3 } },
        { label: "Leave the village", fx: { defect: 1, ambitious: 5 }, memory: "betrayedMe" }
      ] }
  ];

  /* ---------------------------------------------------------------
     PERSONALITY TRAITS — grown through repeated choices.
     --------------------------------------------------------------- */
  C.traits = [
    { id: "kind",        name: "Kind",        opposite: "cruel" },
    { id: "cruel",       name: "Cruel",       opposite: "kind" },
    { id: "brave",       name: "Brave",       opposite: "timid" },
    { id: "timid",       name: "Timid",       opposite: "brave" },
    { id: "calm",        name: "Calm",        opposite: "reckless" },
    { id: "reckless",    name: "Reckless",    opposite: "calm" },
    { id: "loyal",       name: "Loyal",       opposite: "independent" },
    { id: "independent", name: "Independent", opposite: "loyal" },
    { id: "honest",      name: "Honest",      opposite: "manipulative" },
    { id: "manipulative",name: "Manipulative",opposite: "honest" },
    { id: "ambitious",   name: "Ambitious",   opposite: null },
    { id: "disciplined", name: "Disciplined", opposite: null },
    { id: "protective",  name: "Protective",  opposite: null },
    { id: "arrogant",    name: "Arrogant",    opposite: null },
    { id: "social",      name: "Social",      opposite: null },
    { id: "vengeful",    name: "Vengeful",    opposite: null },
    { id: "merciful",    name: "Merciful",    opposite: "vengeful" }
  ];
  C.traitIds = C.traits.map(t => t.id);

  /* Relationship meters carried by every important NPC. */
  C.relMeters = ["affection", "trust", "respect", "loyalty", "fear", "rivalry", "attraction", "jealousy", "resentment", "familiarity"];

  C.relTypes = [
    "Parent", "Sibling", "Clan Elder", "Childhood Friend", "Classmate",
    "Rival", "Teacher", "Sensei", "Teammate", "Romantic Interest",
    "Village Leader", "Summon", "Enemy", "Tailed Beast"
  ];

  /* Named memory tags NPCs carry forever. */
  C.memories = {
    savedMe:           "You saved their life.",
    betrayedMe:        "You betrayed them.",
    keptPromise:       "You kept your promise.",
    brokePromise:      "You broke your promise.",
    abandonedMe:       "You abandoned them when it mattered.",
    childhoodFriend:   "You grew up together.",
    formerRival:       "You were rivals once.",
    witnessedSecret:   "They know your secret.",
    familyLoss:        "They shared your loss.",
    missionTrauma:     "You survived something terrible together.",
    romanticRejection: "You turned them down.",
    humiliated:        "You humiliated them publicly."
  };

  /* Loading screen flavour, keyed by context. */
  C.loadingMessages = {
    boot:    ["Preparing the village", "Gathering chakra", "Unrolling the scrolls", "Lighting the lanterns"],
    newGame: ["Reading your destiny", "Choosing your bloodline", "Opening the Academy gates", "Writing your first page"],
    load:    ["Restoring your timeline", "Recalling your bonds", "Re-sealing your chakra", "Turning back the pages"]
  };

  /* Name fragments for procedural NPCs. */
  C.nameA = ["Kaze","Rai","Hino","Mizu","Tsuchi","Yami","Hikari","Kuro","Shiro","Aka","Ao","Gin","Kin","Hebi","Taka","Ryu","Ken","Sora","Tsuki","Nami","Iwa","Kumo","Sasa","Momo","Hana"];
  C.nameB = ["maru","ta","ko","shi","ro","mi","na","suke","hime","jiro","saburo","ne","ki","to","ya","zen","gen","sai","kai","rin","emi","yo"];

  /* Appearance options for the layered sprite. */
  C.hairStyles = ["short", "spiky", "long", "ponytail", "bob", "messy", "bun"];
  C.hairColors = ["#2b2b33", "#4a2f22", "#6b4a2a", "#8c6b3f", "#c8a24a", "#b23a3a", "#3a4d8c", "#d8d8e0", "#5a3a6b"];
  C.skinTones  = ["#f2d3b8", "#e8c09a", "#d9a377", "#bc8156", "#96603c", "#6f4527"];
  C.eyeColors  = ["#3a2c22", "#4a6b8c", "#3f7a4a", "#6b4a8c", "#8c6b2a", "#7a3030"];
  C.bodyTypes  = [{ id: "a", name: "Body A" }, { id: "b", name: "Body B" }];

  C.difficulties = [
    { id: "casual",   name: "Casual",   desc: "Faster growth, forgiving world.", gain: 1.35, danger: 0.7, ironman: false },
    { id: "normal",   name: "Normal",   desc: "The balanced shinobi path.",       gain: 1.0,  danger: 1.0, ironman: false },
    { id: "hardcore", name: "Hardcore", desc: "Slow growth, deadly foes.",        gain: 0.78, danger: 1.4, ironman: false },
    { id: "ironman",  name: "Ironman",  desc: "One save. No de-aging. Death is final.", gain: 0.85, danger: 1.5, ironman: true }
  ];

})();
