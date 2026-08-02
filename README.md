# 忍 Shinobi Life Simulator

A **visual 2D ninja life simulator**. You are born as a newborn in a hidden village and
watch your character physically grow — through infancy, the Academy, Genin life, adulthood
and old age — while your appearance changes to reflect your age, rank, clothing, weapon,
bloodline, dojutsu, chakra nature, summons and Jinchuriki status.

Runs entirely in the browser. No build step, no backend, no dependencies, no remote
URLs — all art and audio are generated originals stored under `assets/`.

**To play: open `index.html` in any modern browser.** (Or serve the folder over HTTP to
enable offline PWA install — see *Running* below.)

---

## Core loop

1. **Be born.** Pick a village, roll your newborn (clan, bloodline, chakra nature, family,
   looks), choose a difficulty, and start at **age 0**.
2. **Each year, pick activities** from the *Actions* tab. What you can do is strictly
   limited by your age, life stage, rank and training.
3. **Advance the year.** Your sprite visibly grows, life events fire, and the world moves.
4. **Enrol at the Academy at 6**, study six subjects, and **earn** your graduation.
5. **Graduate → Genin** — headband, squad, sensei, and missions unlock.
6. Keep going: missions, exploration, bloodlines, summons, and (very rarely) a Tailed Beast.

## Controls

| Action | How |
|---|---|
| Choose an activity | Tap/click a card in **Actions** |
| Advance a year | **Advance Year** button (bottom bar; label changes with context) |
| Undo a year | **↺ De-Age** button (disabled in Ironman) |
| Minigames | Tap the big button, tap the target, press **Space/Enter**, or use a gamepad face button |
| Navigate | Tab bar, or the **Village** map |

## Key systems

**Life stage ≠ rank.** Age gives you a life stage (Newborn → Toddler → Young Child →
Academy Age → Adolescent → Teen → Young Adult → Adult → Veteran → Elder). Rank is *earned*
(Civilian → Academy Student → Genin → Chunin → Jonin → Elite → ANBU → Captain → Village
Leader → Legendary). A 12-year-old who failed the exam is still an Academy Student; a true
prodigy can sit the exam early.

**Age restrictions are enforced in the rules layer, not the UI.** Babies cannot hold
weapons, fight, take missions, shop for weapons or leave the village — and calling the
functions directly will not bypass it. Shops refuse to sell weapons to children.

**Academy.** Six tracked subjects (Knowledge, Chakra Control, Taijutsu, Accuracy, Clone,
Transformation) plus attendance. Graduation needs age, attendance, marks, and both core
techniques. Skipping class costs attendance and your teacher's respect. Intelligence drives
the written exam; chakra control drives the practical. A teacher who respects you may vouch
for a near miss — but relationships never *guarantee* graduation.

**Missions** are hard-locked until you actually graduate. Ranks D → SS.

**De-Age.** Before every year a full state snapshot is taken (up to 8). De-aging restores
*everything* together — money, items, techniques, achievements, missions, summons, bonds,
memories and story flags — so nothing can be duplicated. Disabled in Ironman.

**Minigames.** Two real skill games that drive progression:
*Chakra Control* (a closing ring you release on target — tree walking, water walking, leaf
focus, meditation, shaping, nature training) and *Precision* (a drifting reticle with wind).
Both grade Failed / Okay / Good / Great / Perfect, scale difficulty with mastery,
exhaustion and injury, and can award a rare technique insight on a great run.
Accessibility: slow mode, wider timing windows, and automatic mode (reduced rewards).

**Relationships.** Every bond tracks ten meters (affection, trust, respect, loyalty, fear,
rivalry, attraction, jealousy, resentment, familiarity) and permanent **memories**
(`savedMe`, `betrayedMe`, `keptPromise`, `abandonedMe`, …). Betrayal *scars* a bond —
gifts and kindness barely move it afterwards. Only de-aging can truly undo it.

**Personality** is grown, not chosen. Repeated choices build traits (kind/cruel,
brave/timid, calm/reckless, loyal/independent, honest/manipulative, ambitious, …), opposing
traits erode each other, and your strongest traits show on the Character screen.

**Clans & bloodlines** follow inheritance, never random rolls: Uchiha → Sharingan,
Hyuga → Byakugan, Kaguya → Dead Bone Pulse, Yuki → Ice, Nara → Shadow, Yamanaka → Mind,
Akimichi → Expansion, Aburame → Insects, Inuzuka → hounds, Hozuki → Hydrification,
Senju → vitality, Uzumaki → sealing. Rare clans stay rare.

**Dojutsu are visible on the sprite.** The Sharingan awakens through emotional weight and
combat, advancing one → two → three tomoe, with Mangekyo requiring an extreme event and
the Eternal form a transplant path. Chakra drains **only while active**, and overuse causes
strain, forced deactivation, and — for the Mangekyo — permanent vision damage.

**Chakra natures and bloodlines render behind the character** (flames, water, wind, rock,
sparks; ice, wood, lava, shadow, insects, bone, seals).

**Tailed Beasts are never chosen.** They appear only through rare random world events
(~1–8% a year depending on your rank, deep exploration, sealing study and war). Meeting one
does **not** make you a host — you can speak, observe, help, alert the village, flee, fight
or attempt a sealing. Freeing one may earn a *willing* bond. Once sealed, a miniature of
the beast appears in the scene with its mood, trust and synchronisation, and its chakra
cloak renders behind you. Low trust means refusal, mockery and seized control; high trust
unlocks transformation stages.

**Also included:** weapon mastery with age/rank/strength gates and on-sprite carry
positions, summoning contracts found in the world, 90+ achievements with hidden legendary
entries, eight endings, dynamic scenes with ink/leaf/smoke/scroll transitions, and a
full timeline and journal.


## Visual dashboard (v3)

The UI follows an approved 2D shinobi dashboard mockup and is **mobile-first** —
there is no fixed desktop canvas, no `transform: scale`, and no zoom-to-fit. The
layout is fluid CSS grid/flexbox with `clamp()` sizing, `100dvh`, safe-area
insets and no horizontal overflow at any width.

**Portrait phone order:** top resource bar → character scene → equipment /
bloodline / nature → identity → health-chakra-stamina → quick jutsu → profile →
stats → rank → animation gallery (collapsible) → sticky bottom navigation.

**Breakpoints:** single column < 700px · two columns ≥ 700px · the full
three-column dashboard ≥ 1080px · condensed columns in landscape.

The character is the visual hero: roughly **32% of viewport height on phones**
and **41% on desktop**, never shrunk to make room for panels.

### Pixel-art sprite system (`pixelsprite.js`)

A parametric pixel-art shinobi drawn to canvas at runtime — no external images.
Chibi proportions with a large spiky-haired head, headband, high collar and
scarf, clan mark, sleeve/forearm wraps, gloves, shin wraps and sandals, plus the
katana across the back. Nine animation states (idle, walk, run, combat, attack,
jutsu, jump, injured, dead) exist for every age stage, driven by joint angles
rather than hand-drawn cells. Dojutsu render as layered eye overlays that keep
the animation frames intact.

### Animation controller (`animation.js`)

A single `requestAnimationFrame` loop that pauses when the tab is hidden or the
stage scrolls out of view. `AnimationManager` owns state transitions, queueing,
interrupt rules, facing, idle variations, the inactivity jump, and hit-frame
effect sync — gameplay code only calls `setState`/`playOnce`/`setContext`.

## Assets & audio (v4)

`assets.js` is the single manifest for every path plus the sprite frame data
(row, frame count, duration, loop, hit frame). Nothing else hard-codes a path.

**Sprites** — nine PNG atlases (one per age stage) exported from the parametric
pixel renderer, 192×256 cells. `animation.js` blits from the atlas and falls back
to the procedural renderer if a sheet is missing, so the game never breaks.
Aura, beast cloak, dojutsu glow and injury are drawn as overlays, so equipment
changes never swap the character image.

**Backgrounds** — 30 PNG plates (15 scenes × day/night) with a procedural
atmosphere layer composited on top.

**Audio** — `audio.js` is a Web Audio engine with master/music/ambience/SFX
buses, crossfades, mute, persistence and tab-visibility pausing. Nothing
autoplays: a **"Tap to enter the village"** gate performs the iOS unlock, then
scene-mapped music and ambience start. 62 original clips: 12 music loops, 7
ambience beds, 43 SFX. Sounds are frame-synced — footsteps on contact frames,
sword on the swing frame, impact on the hit frame, jutsu on the release frame.

**Effects** — `fx.js` pools 90 particles max and rides the single animation
loop. Per-nature bursts, slash trails, impact sparks, screen shake, flashes,
damage numbers and a low-health vignette, all respecting the accessibility
switches.

## Running

Open `index.html` directly — everything works offline from the file system.

To install as an app (and enable the service worker), serve the folder over HTTP:

```bash
python3 -m http.server 8000    # then open http://localhost:8000
```

On iOS: Share → **Add to Home Screen** for a fullscreen, offline, safe-area-aware app.

## Project structure

| File | Purpose |
|---|---|
| `index.html` | Screens: loading → creation → game shell |
| `style.css` | Dark ink theme, scene/sprite/minigame styling, responsive + safe areas |
| `data.js` | All content: stages, ranks, clans, bloodlines, weapons, summons, beasts, scenes, activities, encounters, events |
| `sprite.js` | Procedural layered SVG character + scene renderer |
| `core.js` | RNG, State, Save (versioned migration), Snapshots, Gen, **Rules** (all gating) |
| `systems.js` | Personality, Relations, Academy, Techniques, Shop, Achievements, Endings |
| `world.js` | Dojutsu, Summons, Beasts, Combat, Missions, Exploration, Engine |
| `minigames.js` | Chakra timing + precision throwing |
| `ui.js` | Rendering, flows, bootstrap |
| `sw.js`, `manifest.webmanifest`, `icon-*.png` | PWA / offline install |

Everything is data-driven: add a clan, weapon, scene, encounter or event by appending to
the relevant table in `data.js` — no engine changes needed.

## Saves

Autosaves to `localStorage` (`shinobi-save-v1`). **Version-2 migration** upgrades saves from
the original release in place — old ranks map to the new ladder, an Academy record is
inferred, flat relationships expand to the ten-meter model, and all new fields get sensible
defaults. The pre-migration save is copied to `shinobi-save-backup` first. Export/import
codes are available in Settings.
