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
      day:   "assets/backgrounds/" + id + ".png",
      night: "assets/backgrounds/" + id + "-night.png",
      // parallax drift (px/sec) for the procedural overlay layers
      layers: { sky: 0, far: 2, mid: 5, near: 10 }
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
    Lightning: { sfx: "lightning", color: "#d9c74b", glow: "#fbf5a8", particle: "spark" }
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
    if (b) A.load(night ? b.night : b.day);
  };

})();
