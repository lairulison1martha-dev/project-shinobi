/* =================================================================
   SHINOBI LIFE SIMULATOR — assets.js
   -----------------------------------------------------------------
   Single source of truth for every local asset path plus the frame
   data that drives sprite-sheet playback. Nothing else in the game
   hard-codes a file path.

   All assets live under assets/ in this repository — no remote URLs.

   Exposes: SLS.Assets
     Assets.characters[stage]  — sheet + per-animation row/frame data
     Assets.backgrounds[scene] — day/night image pair + parallax layers
     Assets.audio.{music,ambience,sfx}
     Assets.load(url)          — cached image loader with fallback
     Assets.missing()          — list of assets that failed to load
   ================================================================= */
(function () {
  "use strict";
  const SLS = (window.SLS = window.SLS || {});
  const A = {};
  SLS.Assets = A;

  /* Age-stage folder ← engine life-stage id. */
  A.stageFolder = {
    newborn: "newborn", toddler: "toddler", child: "child", academyAge: "academy",
    adolescent: "genin", teen: "teen", youngAdult: "adult", adult: "adult",
    veteran: "veteran", elder: "elder"
  };

  /* ---------------- CHARACTER SPRITE SHEETS ----------------
     frameWidth/Height are the cell size inside the atlas; each row is
     one animation. hitFrame drives effect + sound synchronisation. */
  A.characters = {
    newborn: {
      sheet: "assets/characters/newborn/base.png", frameWidth: 192, frameHeight: 256,
      anchor: { x: 0.5, y: 1.0 },
      rows: { idle: { row: 0, frames: 4, dur: 260, loop: true, interruptible: true, next: null, hitFrame: null }, injured: { row: 1, frames: 3, dur: 420, loop: true, interruptible: true, next: null, hitFrame: null }, dead: { row: 2, frames: 1, dur: 999999, loop: false, interruptible: false, next: null, hitFrame: null } }
    },
    toddler: {
      sheet: "assets/characters/toddler/base.png", frameWidth: 192, frameHeight: 256,
      anchor: { x: 0.5, y: 1.0 },
      rows: { idle: { row: 0, frames: 4, dur: 260, loop: true, interruptible: true, next: null, hitFrame: null }, walk: { row: 1, frames: 6, dur: 130, loop: true, interruptible: true, next: null, hitFrame: null }, jump: { row: 2, frames: 5, dur: 120, loop: false, interruptible: false, next: "idle", hitFrame: null }, injured: { row: 3, frames: 3, dur: 420, loop: true, interruptible: true, next: null, hitFrame: null }, dead: { row: 4, frames: 1, dur: 999999, loop: false, interruptible: false, next: null, hitFrame: null } }
    },
    child: {
      sheet: "assets/characters/child/base.png", frameWidth: 192, frameHeight: 256,
      anchor: { x: 0.5, y: 1.0 },
      rows: { idle: { row: 0, frames: 4, dur: 260, loop: true, interruptible: true, next: null, hitFrame: null }, walk: { row: 1, frames: 6, dur: 130, loop: true, interruptible: true, next: null, hitFrame: null }, run: { row: 2, frames: 6, dur: 95, loop: true, interruptible: true, next: null, hitFrame: null }, jump: { row: 3, frames: 5, dur: 120, loop: false, interruptible: false, next: "idle", hitFrame: null }, injured: { row: 4, frames: 3, dur: 420, loop: true, interruptible: true, next: null, hitFrame: null }, dead: { row: 5, frames: 1, dur: 999999, loop: false, interruptible: false, next: null, hitFrame: null } }
    },
    academy: {
      sheet: "assets/characters/academy/base.png", frameWidth: 192, frameHeight: 256,
      anchor: { x: 0.5, y: 1.0 },
      rows: { idle: { row: 0, frames: 4, dur: 260, loop: true, interruptible: true, next: null, hitFrame: null }, walk: { row: 1, frames: 6, dur: 130, loop: true, interruptible: true, next: null, hitFrame: null }, run: { row: 2, frames: 6, dur: 95, loop: true, interruptible: true, next: null, hitFrame: null }, combat: { row: 3, frames: 4, dur: 220, loop: true, interruptible: true, next: null, hitFrame: null }, attack: { row: 4, frames: 6, dur: 80, loop: false, interruptible: false, next: "combat", hitFrame: 3 }, jutsu: { row: 5, frames: 7, dur: 110, loop: false, interruptible: false, next: "combat", hitFrame: 6 }, jump: { row: 6, frames: 5, dur: 120, loop: false, interruptible: false, next: "idle", hitFrame: null }, injured: { row: 7, frames: 3, dur: 420, loop: true, interruptible: true, next: null, hitFrame: null }, dead: { row: 8, frames: 1, dur: 999999, loop: false, interruptible: false, next: null, hitFrame: null } }
    },
    genin: {
      sheet: "assets/characters/genin/base.png", frameWidth: 192, frameHeight: 256,
      anchor: { x: 0.5, y: 1.0 },
      rows: { idle: { row: 0, frames: 4, dur: 260, loop: true, interruptible: true, next: null, hitFrame: null }, walk: { row: 1, frames: 6, dur: 130, loop: true, interruptible: true, next: null, hitFrame: null }, run: { row: 2, frames: 6, dur: 95, loop: true, interruptible: true, next: null, hitFrame: null }, combat: { row: 3, frames: 4, dur: 220, loop: true, interruptible: true, next: null, hitFrame: null }, attack: { row: 4, frames: 6, dur: 80, loop: false, interruptible: false, next: "combat", hitFrame: 3 }, jutsu: { row: 5, frames: 7, dur: 110, loop: false, interruptible: false, next: "combat", hitFrame: 6 }, jump: { row: 6, frames: 5, dur: 120, loop: false, interruptible: false, next: "idle", hitFrame: null }, injured: { row: 7, frames: 3, dur: 420, loop: true, interruptible: true, next: null, hitFrame: null }, dead: { row: 8, frames: 1, dur: 999999, loop: false, interruptible: false, next: null, hitFrame: null } }
    },
    teen: {
      sheet: "assets/characters/teen/base.png", frameWidth: 192, frameHeight: 256,
      anchor: { x: 0.5, y: 1.0 },
      rows: { idle: { row: 0, frames: 4, dur: 260, loop: true, interruptible: true, next: null, hitFrame: null }, walk: { row: 1, frames: 6, dur: 130, loop: true, interruptible: true, next: null, hitFrame: null }, run: { row: 2, frames: 6, dur: 95, loop: true, interruptible: true, next: null, hitFrame: null }, combat: { row: 3, frames: 4, dur: 220, loop: true, interruptible: true, next: null, hitFrame: null }, attack: { row: 4, frames: 6, dur: 80, loop: false, interruptible: false, next: "combat", hitFrame: 3 }, jutsu: { row: 5, frames: 7, dur: 110, loop: false, interruptible: false, next: "combat", hitFrame: 6 }, jump: { row: 6, frames: 5, dur: 120, loop: false, interruptible: false, next: "idle", hitFrame: null }, injured: { row: 7, frames: 3, dur: 420, loop: true, interruptible: true, next: null, hitFrame: null }, dead: { row: 8, frames: 1, dur: 999999, loop: false, interruptible: false, next: null, hitFrame: null } }
    },
    adult: {
      sheet: "assets/characters/adult/base.png", frameWidth: 192, frameHeight: 256,
      anchor: { x: 0.5, y: 1.0 },
      rows: { idle: { row: 0, frames: 4, dur: 260, loop: true, interruptible: true, next: null, hitFrame: null }, walk: { row: 1, frames: 6, dur: 130, loop: true, interruptible: true, next: null, hitFrame: null }, run: { row: 2, frames: 6, dur: 95, loop: true, interruptible: true, next: null, hitFrame: null }, combat: { row: 3, frames: 4, dur: 220, loop: true, interruptible: true, next: null, hitFrame: null }, attack: { row: 4, frames: 6, dur: 80, loop: false, interruptible: false, next: "combat", hitFrame: 3 }, jutsu: { row: 5, frames: 7, dur: 110, loop: false, interruptible: false, next: "combat", hitFrame: 6 }, jump: { row: 6, frames: 5, dur: 120, loop: false, interruptible: false, next: "idle", hitFrame: null }, injured: { row: 7, frames: 3, dur: 420, loop: true, interruptible: true, next: null, hitFrame: null }, dead: { row: 8, frames: 1, dur: 999999, loop: false, interruptible: false, next: null, hitFrame: null } }
    },
    veteran: {
      sheet: "assets/characters/veteran/base.png", frameWidth: 192, frameHeight: 256,
      anchor: { x: 0.5, y: 1.0 },
      rows: { idle: { row: 0, frames: 4, dur: 260, loop: true, interruptible: true, next: null, hitFrame: null }, walk: { row: 1, frames: 6, dur: 130, loop: true, interruptible: true, next: null, hitFrame: null }, run: { row: 2, frames: 6, dur: 95, loop: true, interruptible: true, next: null, hitFrame: null }, combat: { row: 3, frames: 4, dur: 220, loop: true, interruptible: true, next: null, hitFrame: null }, attack: { row: 4, frames: 6, dur: 80, loop: false, interruptible: false, next: "combat", hitFrame: 3 }, jutsu: { row: 5, frames: 7, dur: 110, loop: false, interruptible: false, next: "combat", hitFrame: 6 }, jump: { row: 6, frames: 5, dur: 120, loop: false, interruptible: false, next: "idle", hitFrame: null }, injured: { row: 7, frames: 3, dur: 420, loop: true, interruptible: true, next: null, hitFrame: null }, dead: { row: 8, frames: 1, dur: 999999, loop: false, interruptible: false, next: null, hitFrame: null } }
    },
    elder: {
      sheet: "assets/characters/elder/base.png", frameWidth: 192, frameHeight: 256,
      anchor: { x: 0.5, y: 1.0 },
      rows: { idle: { row: 0, frames: 4, dur: 260, loop: true, interruptible: true, next: null, hitFrame: null }, walk: { row: 1, frames: 6, dur: 130, loop: true, interruptible: true, next: null, hitFrame: null }, run: { row: 2, frames: 6, dur: 95, loop: true, interruptible: true, next: null, hitFrame: null }, combat: { row: 3, frames: 4, dur: 220, loop: true, interruptible: true, next: null, hitFrame: null }, attack: { row: 4, frames: 6, dur: 80, loop: false, interruptible: false, next: "combat", hitFrame: 3 }, jutsu: { row: 5, frames: 7, dur: 110, loop: false, interruptible: false, next: "combat", hitFrame: 6 }, jump: { row: 6, frames: 5, dur: 120, loop: false, interruptible: false, next: "idle", hitFrame: null }, injured: { row: 7, frames: 3, dur: 420, loop: true, interruptible: true, next: null, hitFrame: null }, dead: { row: 8, frames: 1, dur: 999999, loop: false, interruptible: false, next: null, hitFrame: null } }
    }
  };

  /* ---------------- BACKGROUNDS ----------------
     Each scene has a day and night plate plus parallax layer hints the
     scene renderer uses for drift speed. */
  A.backgrounds = {};
  [
    ["overlook","Village Overlook"],["village","Village Street"],["home","Family Home"],
    ["classroom","Academy Classroom"],["yard","Academy Yard"],["field","Training Field"],
    ["range","Throwing Range"],["forest","Deep Forest"],["river","Riverbank"],
    ["waterfall","Waterfall"],["mountain","Mountain Pass"],["cave","Hidden Cave"],
    ["ruins","Ancient Ruins"],["camp","Mission Camp"],["arena","Exam Arena"]
  ].forEach(([id, name]) => {
    A.backgrounds[id] = {
      name,
      // Sky + far ridge + baked atmosphere. WebP: these are smooth
      // gradients, so lossy WebP is ~2% of the PNG size with no visible
      // loss at display scale.
      day:   "assets/backgrounds/" + id + ".webp",
      night: "assets/backgrounds/" + id + "-night.webp",
      // Transparent midground/foreground plates drawn over the base and
      // drifted for parallax. A missing plate never breaks the scene —
      // it just loses the depth.
      plates: {
        mid:  "assets/backgrounds/" + id + "-mid.webp",
        near: "assets/backgrounds/" + id + "-near.webp"
      }
    };
  });

  /* ---------------- AUDIO ---------------- */
  const M = (n) => "assets/audio/music/" + n + ".wav";
  const AM = (n) => "assets/audio/ambience/" + n + ".wav";
  A.audio = {
    music: {
      title: M("title"), village: M("village"), academy: M("academy"), training: M("training"),
      explore: M("explore"), combat: M("combat"), boss: M("boss"), emotional: M("emotional"),
      victory: M("victory"), defeat: M("defeat"), beast: M("beast"), ending: M("ending")
    },
    ambience: {
      village: AM("village"), forest: AM("forest"), river: AM("river"), academy: AM("academy"),
      battle: AM("battle"), night: AM("night"), cave: AM("cave")
    },
    sfx: {
      // UI
      tap: "assets/audio/ui/tap.wav", confirm: "assets/audio/ui/confirm.wav",
      cancel: "assets/audio/ui/cancel.wav", open: "assets/audio/ui/open.wav",
      close: "assets/audio/ui/close.wav", locked: "assets/audio/ui/locked.wav",
      achievement: "assets/audio/ui/achievement.wav",
      // movement
      stepGrass: "assets/audio/movement/step-grass.wav",
      stepDirt: "assets/audio/movement/step-dirt.wav",
      stepWood: "assets/audio/movement/step-wood.wav",
      jump: "assets/audio/movement/jump.wav", land: "assets/audio/movement/land.wav",
      run: "assets/audio/movement/run.wav",
      // combat
      punch: "assets/audio/combat/punch.wav", kick: "assets/audio/combat/kick.wav",
      swing: "assets/audio/combat/swing.wav", swordHit: "assets/audio/combat/sword-hit.wav",
      kunai: "assets/audio/combat/kunai.wav", shuriken: "assets/audio/combat/shuriken.wav",
      block: "assets/audio/combat/block.wav", dodge: "assets/audio/combat/dodge.wav",
      hit: "assets/audio/combat/hit.wav", critical: "assets/audio/combat/critical.wav",
      hurt: "assets/audio/combat/hurt.wav", defeat: "assets/audio/combat/defeat.wav",
      // jutsu
      charge: "assets/audio/jutsu/charge.wav", fire: "assets/audio/jutsu/fire.wav",
      water: "assets/audio/jutsu/water.wav", wind: "assets/audio/jutsu/wind.wav",
      earth: "assets/audio/jutsu/earth.wav", lightning: "assets/audio/jutsu/lightning.wav",
      healing: "assets/audio/jutsu/healing.wav", summon: "assets/audio/jutsu/summon.wav",
      sealing: "assets/audio/jutsu/sealing.wav", dojutsu: "assets/audio/jutsu/dojutsu.wav",
      // progression
      levelup: "assets/audio/events/levelup.wav", rankup: "assets/audio/events/rankup.wav",
      graduation: "assets/audio/events/graduation.wav",
      missionAccept: "assets/audio/events/mission-accept.wav",
      missionComplete: "assets/audio/events/mission-complete.wav",
      bloodline: "assets/audio/events/bloodline.wav", contract: "assets/audio/events/contract.wav",
      jinchuriki: "assets/audio/events/jinchuriki.wav"
    }
  };

  /* Chakra-nature → jutsu sound + effect colour, used by the FX system. */
  A.natureFx = {
    Fire:      { sfx: "fire",      color: "#ff7a2d", glow: "#ffd08a", particle: "flame" },
    Water:     { sfx: "water",     color: "#4b93d1", glow: "#9fd6f0", particle: "splash" },
    Wind:      { sfx: "wind",      color: "#63c28a", glow: "#bdf0d2", particle: "slash" },
    Earth:     { sfx: "earth",     color: "#b58b4a", glow: "#e0c08a", particle: "rock" },
    Lightning: { sfx: "lightning", color: "#d9c74b", glow: "#fbf5a8", particle: "spark" },
    Wood:      { sfx: "earth",     color: "#4f7d43", glow: "#a9d18a", particle: "leaf" },
    Ice:       { sfx: "water",     color: "#7fb6d9", glow: "#e6f6ff", particle: "shard" },
    Lava:      { sfx: "fire",      color: "#d64518", glow: "#ffb347", particle: "ember" },
    Shadow:    { sfx: "wind",      color: "#3a3050", glow: "#8f7fc0", particle: "wisp" },
    Healing:   { sfx: "heal",      color: "#4fbf87", glow: "#d8ffe9", particle: "mote" },
    Beast:     { sfx: "beast",     color: "#e2560f", glow: "#ffd166", particle: "bubble" }
  };

  /* ---------------- LAYER OVERLAY REGISTRY ----------------
     Optional authored art for the composited layers. Anything listed
     here that exists on disk is blitted by SLS.Layers in place of the
     procedural painter; anything missing falls back automatically, so
     art can be dropped in one file at a time.

     Overlay atlases must use the SAME cell grid as the stage base
     sheet (192x256) and the same row order, which is what lets one
     overlay serve every animation without duplicating a sheet.

     `byStage` lets a layer supply per-stage art where proportions
     differ; a bare `sheet` is used for every stage. */
  A.overlays = {
    clan:   { uchiha: { byStage: {} }, hyuga: { byStage: {} }, uzumaki: { byStage: {} },
              senju: { byStage: {} }, nara: { byStage: {} }, common: { byStage: {} } },
    hair:   {}, eyes: {}, headband: {}, outfit: {}, armor: {},
    weapon: {}, accessory: {}, injury: {}, dojutsu: {},
    aura:   {}, transformation: {}, summon: {}, jinchuriki: {}
  };
  /* Folder each overlay layer's art is expected in, so the pipeline and
     any future art drop agree on one location. */
  A.overlayFolder = {
    clan: "assets/characters/", hair: "assets/outfits/", eyes: "assets/eyes/",
    headband: "assets/outfits/", outfit: "assets/outfits/", armor: "assets/outfits/",
    weapon: "assets/weapons/", accessory: "assets/outfits/", injury: "assets/effects/",
    dojutsu: "assets/eyes/", aura: "assets/effects/", transformation: "assets/effects/",
    summon: "assets/summons/", jinchuriki: "assets/tailed-beasts/"
  };

  /* ---------------- DATA FILES ----------------
     Anchors pin every overlay to the animated body; characters.json is
     the data-driven character database. Both are fetched once and are
     entirely optional — the renderer computes anchors live if the file
     is unavailable (e.g. opened over file://). */
  A.anchorTable = null;
  A.characterDB = null;
  A.data = {
    anchors: "assets/data/anchors.json",
    characters: "assets/data/characters.json"
  };
  /* ---------------- UI ICON SET ----------------
     Authored SVG sprite injected once, then referenced with <use>. Each
     glyph inherits currentColor so it picks up the surrounding panel
     colour. Every icon keeps a text fallback: if the sprite cannot be
     fetched (file://, offline first run) the original glyph stays and
     nothing breaks. */
  A.iconSprite = "assets/ui/icons.svg";
  A.iconsReady = false;
  /* text glyph → icon id. Drives the render-time swap in ui.js. */
  A.iconMap = {
    "🎽": "headband", "🗡": "sword", "⚔": "blades", "⚔️": "blades",
    "🦺": "armor", "🛡": "shield", "⭕": "ring", "📜": "scroll", "📖": "book",
    "✊": "fist", "🐾": "paw", "💰": "coin", "❤": "heart", "❤️": "heart",
    "⚡": "bolt", "⭐": "star", "👑": "crown", "🏆": "trophy", "🏅": "medal",
    "🔒": "lock", "💥": "burst", "🤝": "bond", "👥": "people", "🏃": "run",
    "🏠": "home", "🏫": "school", "🎓": "school", "⛩": "torii", "🏪": "shop",
    "🌲": "tree", "🏞": "mountain", "🎯": "target", "🧭": "compass",
    "🔥": "fire", "💧": "water", "💨": "wind", "🌪": "wind", "🧱": "earth",
    "🌀": "spiral", "☀": "sun", "🌸": "blossom", "🍁": "leaf", "❄": "snow",
    "💾": "save", "📤": "export", "📥": "import", "🔄": "reset", "↔": "swap",
    "🏋": "dumbbell", "🧘": "meditate"
  };
  A.loadIcons = function () {
    if (location.protocol === "file:") return Promise.resolve(false);
    return fetch(A.iconSprite)
      .then(r => (r.ok ? r.text() : null))
      .then(txt => {
        if (!txt) return false;
        const host = document.createElement("div");
        host.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
        host.setAttribute("aria-hidden", "true");
        host.innerHTML = txt;
        document.body.appendChild(host);
        A.iconsReady = true;
        return true;
      })
      .catch(() => false);
  };
  /* Markup for one icon, or null when the sprite is unavailable. */
  A.icon = function (glyph, cls) {
    if (!A.iconsReady) return null;
    const id = A.iconMap[glyph];
    if (!id) return null;
    return '<svg class="ico ' + (cls || "") + '" viewBox="0 0 24 24" aria-hidden="true">'
         + '<use href="#ico-' + id + '"></use></svg>';
  };

  A.loadData = function () {
    if (location.protocol === "file:") {
      // fetch() is blocked for file://; fall back to live computation.
      if (SLS.PX && SLS.PX.anchorTable) A.anchorTable = SLS.PX.anchorTable(192, 256);
      return Promise.resolve();
    }
    const get = (url) => fetch(url).then(r => r.ok ? r.json() : null).catch(() => null);
    return Promise.all([get(A.data.anchors), get(A.data.characters)]).then(([an, ch]) => {
      A.anchorTable = an || (SLS.PX && SLS.PX.anchorTable ? SLS.PX.anchorTable(192, 256) : null);
      A.characterDB = ch;
    });
  };

  /* ---------------- LOADER ----------------
     Cached, fault-tolerant image loading. A missing asset is logged
     exactly once and the caller falls back to procedural drawing. */
  const cache = new Map();
  const missing = new Set();
  A.load = function (url, onReady) {
    if (!url) return null;
    if (cache.has(url)) {
      const c = cache.get(url);
      // Never call back synchronously for an already-decoded image: callers
      // check __ready themselves, and a sync call would re-enter their render.
      if (onReady && !c.__ready && !c.__failed) {
        c.addEventListener("load", () => onReady(c), { once: true });
      }
      return c;
    }
    const img = new Image();
    img.decoding = "async";
    img.__ready = false;
    img.onload = () => { img.__ready = true; if (onReady) onReady(img); };
    img.onerror = () => {
      if (!missing.has(url)) { missing.add(url); console.warn("[assets] missing:", url); }
      img.__failed = true;
    };
    img.src = url;
    cache.set(url, img);
    return img;
  };
  A.ready = function (url) { const i = cache.get(url); return !!(i && i.__ready); };
  A.failed = function (url) { const i = cache.get(url); return !!(i && i.__failed); };
  A.missing = function () { return Array.from(missing); };

  /* Preload only what the first screen needs; everything else is lazy. */
  A.preloadEssential = function (stageId) {
    const folder = A.stageFolder[stageId] || "genin";
    const c = A.characters[folder];
    if (c) A.load(c.sheet);
    A.load(A.backgrounds.overlook.day);
  };
  A.preloadScene = function (sceneId, night) {
    const b = A.backgrounds[sceneId];
    if (!b) return;
    A.load(night ? b.night : b.day);
    if (b.plates) { A.load(b.plates.mid); A.load(b.plates.near); }
  };

})();
