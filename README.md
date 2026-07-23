# 忍 Shinobi Life Simulator

An original, browser-based **ninja life-sim RPG**. Be born in a hidden village, forge
your path from a helpless baby to a Legendary Shinobi, and live a full life of training,
missions, turn-based battles, techniques, bonds, and hundreds of random events — all
saved automatically to your browser.

No installation, no build step, no dependencies. **Just open `index.html`.**

---

## How to Play

1. Open `index.html` in any modern browser.
2. Choose one of six **hidden villages**, re-roll your randomly generated newborn shinobi
   (clan, bloodline, chakra affinity, family, traits), pick a **difficulty**, and name them.
3. In **Actions**, spend stamina each year on activities (train, study, meditate, spar,
   minigames, explore, tournaments, build bonds, form a team…).
4. Press **Advance Year** to age up, recover, and face whatever fate brings — random
   events, world events, exams, and eventually your ending.

Your game **autosaves**. You can also export/import a save code in **Settings**.

## Features

- **6 hidden villages**, rare **clans** & **bloodlines**, chakra affinities, personality traits
- **16 stats**, Level 1–100, per-element mastery, technique mastery, per-village reputation
- **Turn-based combat** with attack, chakra jutsu, dodge, counter, defend, team attacks &
  ultimate jutsu, versus personality-driven enemy AI (Aggressive / Defensive / Tactical / Reckless)
- **Boss battles**, **exams** (Academy Graduation, Chunin, Jonin, ANBU), and **world events**
  (ninja wars, Kage summits, festivals, disasters, missing-nin)
- **Missions** ranked D → SS, a full **economy**, **inventory** & equipment, a **market**
- **Hundreds of procedurally generated techniques** across 7 disciplines, plus procedural
  missions, random life events, and thousands of unique NPCs
- **Training minigames**, **100+ achievements** (with hidden legendaries), and **6 endings**
- Four **difficulty modes** including **Ironman** (single save, permadeath)
- Responsive dark "ninja scroll" UI, smooth animations, and a **sound-ready** audio layer

## Project Structure

| File | Purpose |
|------|---------|
| `index.html` | Page structure: creation screen, tabbed game shell, modal & toast layers |
| `style.css`  | Dark ink theme, responsive layout, animations (CSS variables for easy theming) |
| `script.js`  | All game logic, split into clearly-commented modules (see below) |

`script.js` is organized into modules under the global `SLS` namespace for easy expansion:
`RNG · Data · Generators · State · Save · Engine · Combat · Missions · Exams · Minigames ·
Relations · Shop · Techniques · Achievements · Endings · Audio · UI · Game`.

Adding content is intentionally easy — most systems are data-driven: extend the tables in
`Data` (villages, clans, techniques, missions, events, shop, achievements) or the template
arrays in `Generators`.
