/* =================================================================
   SHINOBI LIFE SIMULATOR — audio.js
   -----------------------------------------------------------------
   Web Audio engine: music, ambience and SFX with crossfades, volume
   buses, mute, persistence, tab-visibility pausing, and iOS-safe
   unlocking (Safari blocks audio until a real user gesture).

   Nothing autoplays on load. The first tap unlocks the context,
   preloads essential clips and starts music only if sound is enabled.

   API
     AudioManager.init() / unlock()
     AudioManager.playMusic(track, fadeMs) / stopMusic(fadeMs)
     AudioManager.playAmbience(track, fadeMs)
     AudioManager.playSFX(name, {volume, rate, delay})
     AudioManager.setMasterVolume(v) / setMusicVolume(v)
     AudioManager.setSFXVolume(v)   / setAmbienceVolume(v)
     AudioManager.setMuted(v)
   ================================================================= */
(function () {
  "use strict";
  const SLS = (window.SLS = window.SLS || {});
  const KEY = "shinobi-audio-v1";

  const AudioManager = {
    ctx: null, unlocked: false, inited: false,
    buses: {},                      // master / music / ambience / sfx gain nodes
    buffers: new Map(),             // url -> AudioBuffer
    pending: new Map(),             // url -> Promise
    missing: new Set(),
    current: { music: null, ambience: null },
    nodes: { music: null, ambience: null },
    settings: { master: 0.8, music: 0.55, sfx: 0.9, ambience: 0.5, muted: false },

    /* ---------------- setup ---------------- */
    init() {
      if (this.inited) return;
      this.inited = true;
      this.loadSettings();
      // Unlock on the first real gesture — required by iOS Safari.
      const unlock = () => this.unlock();
      ["pointerdown", "touchend", "keydown"].forEach(e =>
        window.addEventListener(e, unlock, { once: false, passive: true }));
      document.addEventListener("visibilitychange", () => {
        if (!this.ctx) return;
        if (document.hidden) { try { this.ctx.suspend(); } catch (e) {} }
        else if (!this.settings.muted) { try { this.ctx.resume(); } catch (e) {} }
      });
    },

    loadSettings() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) Object.assign(this.settings, JSON.parse(raw));
      } catch (e) { }
    },
    saveSettings() {
      try { localStorage.setItem(KEY, JSON.stringify(this.settings)); } catch (e) { }
    },

    unlock() {
      if (this.unlocked) return true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try {
        this.ctx = new AC();
        const mk = (out) => { const g = this.ctx.createGain(); g.connect(out); return g; };
        this.buses.master = mk(this.ctx.destination);
        this.buses.music = mk(this.buses.master);
        this.buses.ambience = mk(this.buses.master);
        this.buses.sfx = mk(this.buses.master);
        this.applyVolumes();
        // A silent blip completes the gesture handshake on iOS.
        const b = this.ctx.createBuffer(1, 1, 22050);
        const s = this.ctx.createBufferSource();
        s.buffer = b; s.connect(this.buses.master); s.start(0);
        if (this.ctx.state === "suspended") this.ctx.resume();
        this.unlocked = true;
        this.preloadEssential();
        return true;
      } catch (e) { return false; }
    },

    applyVolumes() {
      if (!this.ctx) return;
      const s = this.settings, m = s.muted ? 0 : 1;
      const set = (bus, v) => { if (bus) bus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02); };
      set(this.buses.master, s.master * m);
      set(this.buses.music, s.music);
      set(this.buses.ambience, s.ambience);
      set(this.buses.sfx, s.sfx);
    },

    /* ---------------- buffers ---------------- */
    load(url) {
      if (!url) return Promise.resolve(null);
      // Opened straight from disk: fetch() is blocked by CORS for file://.
      // Degrade to silence once, without spamming the console.
      if (location.protocol === "file:") {
        if (!this._fileWarned) {
          this._fileWarned = true;
          console.info("[audio] disabled on file:// — serve over http to enable sound");
        }
        return Promise.resolve(null);
      }
      if (this.buffers.has(url)) return Promise.resolve(this.buffers.get(url));
      if (this.pending.has(url)) return this.pending.get(url);
      const p = fetch(url)
        .then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then(ab => new Promise((res, rej) => this.ctx.decodeAudioData(ab, res, rej)))
        .then(buf => { this.buffers.set(url, buf); this.pending.delete(url); return buf; })
        .catch(() => {
          // Log a missing clip exactly once, then stay silent.
          if (!this.missing.has(url)) { this.missing.add(url); console.warn("[audio] missing:", url); }
          this.buffers.set(url, null); this.pending.delete(url); return null;
        });
      this.pending.set(url, p);
      return p;
    },

    preloadEssential() {
      const A = SLS.Assets; if (!A) return;
      // Only the clips the first minute needs; everything else is lazy.
      ["tap", "confirm", "cancel", "levelup", "achievement"].forEach(k => this.load(A.audio.sfx[k]));
    },

    /* ---------------- music / ambience ---------------- */
    _playLoop(kind, url, fadeMs) {
      if (!this.unlocked || !url) return;
      const bus = this.buses[kind];
      const prevKey = this.current[kind];
      if (prevKey === url && this.nodes[kind]) return;      // already playing — never restart
      this.current[kind] = url;
      this.load(url).then(buf => {
        if (!buf || this.current[kind] !== url) return;
        const fade = (fadeMs == null ? 800 : fadeMs) / 1000;
        const now = this.ctx.currentTime;
        // fade the outgoing track out and stop it
        const old = this.nodes[kind];
        if (old) {
          try {
            old.gain.gain.cancelScheduledValues(now);
            old.gain.gain.setValueAtTime(old.gain.gain.value, now);
            old.gain.gain.linearRampToValueAtTime(0, now + fade);
            old.src.stop(now + fade + 0.05);
          } catch (e) { }
        }
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(1, now + fade);
        g.connect(bus);
        const src = this.ctx.createBufferSource();
        src.buffer = buf; src.loop = true; src.connect(g); src.start(0);
        this.nodes[kind] = { src, gain: g };
      });
    },
    playMusic(track, fadeMs) {
      const A = SLS.Assets; if (!A) return;
      this._playLoop("music", A.audio.music[track] || track, fadeMs);
    },
    playAmbience(track, fadeMs) {
      const A = SLS.Assets; if (!A) return;
      this._playLoop("ambience", A.audio.ambience[track] || track, fadeMs);
    },
    _stop(kind, fadeMs) {
      const n = this.nodes[kind];
      this.current[kind] = null;
      if (!n || !this.ctx) return;
      const now = this.ctx.currentTime, fade = (fadeMs == null ? 600 : fadeMs) / 1000;
      try {
        n.gain.gain.cancelScheduledValues(now);
        n.gain.gain.setValueAtTime(n.gain.gain.value, now);
        n.gain.gain.linearRampToValueAtTime(0, now + fade);
        n.src.stop(now + fade + 0.05);
      } catch (e) { }
      this.nodes[kind] = null;
    },
    stopMusic(fadeMs) { this._stop("music", fadeMs); },
    stopAmbience(fadeMs) { this._stop("ambience", fadeMs); },

    /* ---------------- SFX ---------------- */
    playSFX(name, opts) {
      if (!this.unlocked || this.settings.muted) return;
      const A = SLS.Assets; if (!A) return;
      const url = A.audio.sfx[name] || name;
      opts = opts || {};
      this.load(url).then(buf => {
        if (!buf) return;
        const now = this.ctx.currentTime + (opts.delay || 0);
        const g = this.ctx.createGain();
        g.gain.value = opts.volume == null ? 1 : opts.volume;
        g.connect(this.buses.sfx);
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        if (opts.rate) src.playbackRate.value = opts.rate;
        src.connect(g);
        src.start(now);
      });
    },

    /* ---------------- settings ---------------- */
    setMasterVolume(v) { this.settings.master = clamp(v); this.applyVolumes(); this.saveSettings(); },
    setMusicVolume(v) { this.settings.music = clamp(v); this.applyVolumes(); this.saveSettings(); },
    setSFXVolume(v) { this.settings.sfx = clamp(v); this.applyVolumes(); this.saveSettings(); },
    setAmbienceVolume(v) { this.settings.ambience = clamp(v); this.applyVolumes(); this.saveSettings(); },
    setMuted(v) {
      this.settings.muted = !!v;
      this.applyVolumes(); this.saveSettings();
      if (this.ctx) { if (v) { try { this.ctx.suspend(); } catch (e) {} } else { try { this.ctx.resume(); } catch (e) {} } }
    },
    isMuted() { return this.settings.muted; },

    /* Scene → music + ambience mapping, so callers just name a context. */
    setScene(sceneId, opts) {
      opts = opts || {};
      const musicFor = {
        overlook: "village", village: "village", home: "village", classroom: "academy",
        yard: "academy", field: "training", range: "training", forest: "explore",
        river: "explore", waterfall: "emotional", mountain: "explore", cave: "explore",
        ruins: "explore", camp: "explore", arena: "combat"
      };
      const ambFor = {
        overlook: "village", village: "village", home: "village", classroom: "academy",
        yard: "academy", field: "village", range: "village", forest: "forest",
        river: "river", waterfall: "river", mountain: "forest", cave: "cave",
        ruins: "cave", camp: "battle", arena: "battle"
      };
      if (opts.combat) this.playMusic(opts.boss ? "boss" : "combat", 500);
      else this.playMusic(musicFor[sceneId] || "village", 900);
      this.playAmbience(opts.night ? "night" : (ambFor[sceneId] || "village"), 900);
    }
  };
  function clamp(v) { return Math.max(0, Math.min(1, Number(v) || 0)); }

  SLS.AudioManager = AudioManager;
})();
