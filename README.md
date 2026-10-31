# babybus-game
a simple yet intuitive game based on babybus sheriff labrador with gameplay like suoer mario

---

## Sheriff Labrador: Super Rescue Adventure

A browser-based 2.5D platform game for children aged 4–10. Characters, town and
animals are fully 3D, while movement stays on a simple side-scrolling plane:
**left, right, jump, help**.

> Private prototype. All characters, names, models, music and sounds are original
> and made for this project. It is not affiliated with or endorsed by BabyBus, and
> it uses no BabyBus assets.

### What is playable now (Milestone 1)

**Stage 1 – Welcome to Labrador Town**, fully playable:

- Animated 3D title screen, large Play button, Continue, Stages, Rewards, Settings
- Choose one of three original heroes: **Sheriff Biscuit**, **Officer Pepper**, **Cadet Poppy**
- Three age modes: **Little Explorer** (4–5), **Junior Detective** (6–7), **Super Sheriff** (8–10)
- Skippable animated introduction
- Walk, jump and bounce tutorials; 28 stars (+3 hidden stars in Super Sheriff)
- Checkpoints, gentle splash-and-respawn (no game over, unlimited retries)
- Lost-kitten rescue: find Kitty, she follows you home to Mama Cat, you earn the Rescue Badge
- Finish-line celebration, star rating, Rescue Badge and Labrador Town Medal
- Progress saved in the browser; Stage 2 unlocks on the map as "coming soon"
- Pause, restart, and **Quit with a warning** that the adventure can't be resumed and play restarts from Stage 1
- English and Bahasa Melayu, separate music and sound volume, jump helper, voice hints, graphics quality
- Touch controls (multi-touch) on phones and tablets, keyboard on laptops

### Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move left | A / ← | Left arrow button |
| Move right | D / → | Right arrow button |
| Jump | Space / ↑ / W | Yellow jump button |
| Help / interact | E / Enter | Pink hand button |
| Pause | Esc / P | Pause button (top right) |

### Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # production build in dist/
npm run preview      # serve the production build on :4173
```

### Tests

```bash
npm test               # unit + integration tests (Vitest)
npm run build && npm run test:gameplay   # end-to-end gameplay in real Chromium (Playwright)
```

The gameplay test drives the real game in a browser: menus, hero and age-mode
selection, keyboard and multi-touch input, jumping, stars, canal respawn,
checkpoints, kitten rescue, finish, rewards, saving, replay, quit warning,
language switch, audio settings, refresh, portrait-phone handling and tab switching.
Screenshots go to `tests/gameplay/screenshots/` and results to `tests/gameplay/report.json`.

Append `?test=1` to the URL to expose read-only test hooks, and `?quality=low` to force
the fast graphics mode.

### Tech

Babylon.js 8 · TypeScript · Vite · Web Audio (procedural music and effects) · localStorage.
Deploys as a static site (see `vercel.json`). See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
and [docs/ROADMAP.md](docs/ROADMAP.md).
