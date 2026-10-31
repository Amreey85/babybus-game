/**
 * End-to-end gameplay test in a real Chromium browser (Playwright).
 * Usage: npm run build && npm run test:gameplay
 * Optional: GAME_URL=http://localhost:4173 to test an already running server.
 * Writes screenshots to tests/gameplay/screenshots and a JSON report to tests/gameplay/report.json.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = dirname(fileURLToPath(import.meta.url));
const shots = join(here, 'screenshots');
mkdirSync(shots, { recursive: true });

let server = null;
let base = process.env.GAME_URL;
if (!base) {
  server = spawn('npx', ['vite', 'preview', '--port', '4174', '--strictPort'], { cwd: join(here, '..', '..'), stdio: 'ignore' });
  base = 'http://localhost:4174';
  await new Promise((r) => setTimeout(r, 2500));
}
const URL = `${base}/?test=1`;
const URL_FAST = `${base}/?test=1&quality=low`;

const results = [];
const errors = [];
let failed = 0;
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail: String(detail) });
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== '' ? `  (${detail})` : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });

async function newPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, ...opts });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return { ctx, page };
}
const state = (page) => page.evaluate(() => window.__SLSRA__.state());
const stage = async (page) => (await state(page)).stage;
async function waitFor(page, fn, timeout = 15000, every = 100) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await fn()) return true;
    await sleep(every);
  }
  return false;
}
const playing = async (page) => (await stage(page))?.phase === 'play';
async function teleport(page, x, y) {
  await waitFor(page, () => playing(page), 10000);
  await page.evaluate(([a, b]) => window.__SLSRA__.teleport(a, b), [x, y]);
  await sleep(150);
}
async function hold(page, key, until, timeout = 10000) {
  await page.keyboard.down(key);
  const ok = await waitFor(page, until, timeout, 50);
  await page.keyboard.up(key);
  return ok;
}
async function startStage(page, hero = 'biscuit', diff = 'junior') {
  await page.getByTestId('play').click();
  await page.getByTestId(`hero-${hero}`).click();
  await page.getByTestId(`diff-${diff}`).click();
  return waitFor(page, async () => (await stage(page))?.phase === 'intro', 30000);
}

try {
  // ---------------- Desktop journey ----------------
  const { ctx, page } = await newPage();
  await page.goto(URL);
  const titleOk = await waitFor(page, async () => (await page.getByTestId('play').count()) > 0, 20000);
  check('Title screen loads with Play button', titleOk);
  await sleep(2500);
  await page.screenshot({ path: join(shots, '01-title.png') });

  await page.getByTestId('lang-toggle').click();
  const bm = await page.getByTestId('play').innerText();
  check('Language switches to Bahasa Melayu', bm.includes('Main'), bm);
  await page.screenshot({ path: join(shots, '02-title-bm.png') });
  await page.getByTestId('lang-toggle').click();
  check('Language switches back to English', (await page.getByTestId('play').innerText()).includes('Play'));

  await page.getByTestId('play').click();
  check('Hero select shows three heroes', (await page.locator('[data-testid^="hero-"]').count()) === 3);
  await sleep(1500);
  await page.screenshot({ path: join(shots, '03-heroes.png') });
  await page.getByTestId('hero-pepper').click();
  await sleep(400);
  check('Difficulty select shows three modes', (await page.locator('[data-testid^="diff-"]').count()) === 3);
  await page.screenshot({ path: join(shots, '04-difficulty.png') });
  await page.getByTestId('diff-junior').click();
  const introOk = await waitFor(page, async () => (await stage(page))?.phase === 'intro', 30000);
  check('Stage 1 loads and intro starts', introOk);
  await sleep(1200);
  check('Intro caption shown', await page.getByTestId('caption').isVisible());
  await page.screenshot({ path: join(shots, '05-intro.png') });
  await page.getByTestId('skip-intro').click();
  await sleep(300);
  let s = await stage(page);
  check('Intro can be skipped', s.phase === 'play', s.phase);
  check('Hero selection carried into stage (save)', (await state(page)).save.hero === 'pepper');
  await sleep(800);
  await page.screenshot({ path: join(shots, '06-gameplay-start.png') });

  // Movement.
  const x0 = (await stage(page)).x;
  await hold(page, 'ArrowRight', async () => (await stage(page)).x > x0 + 4);
  s = await stage(page);
  check('Keyboard: hero moves right', s.x > x0 + 4, `x ${x0.toFixed(1)} -> ${s.x.toFixed(1)}`);
  await hold(page, 'KeyA', async () => (await stage(page)).x < s.x - 1);
  const s2 = await stage(page);
  check('Keyboard: A moves left', s2.x < s.x, `${s.x.toFixed(1)} -> ${s2.x.toFixed(1)}`);

  // Jump.
  await waitFor(page, async () => (await stage(page)).onGround, 5000);
  let peak = 0;
  await hold(page, 'Space', async () => {
    const st = await stage(page);
    peak = Math.max(peak, st.y);
    return peak > 1.5;
  }, 5000);
  check('Keyboard: Space jumps', peak > 1.5, `peak y=${peak.toFixed(2)}`);
  check('Lands back on ground', await waitFor(page, async () => (await stage(page)).onGround, 8000));

  // Walk through the first three stars.
  await hold(page, 'ArrowRight', async () => (await stage(page)).x > 16, 20000);
  s = await stage(page);
  check('First three stars collected', s.stars >= 3, `${s.stars}/${s.totalStars}`);
  await page.screenshot({ path: join(shots, '07-stars.png') });

  // Simultaneous move + jump over the first crate.
  await teleport(page, 38, 0);
  await page.keyboard.down('ArrowRight');
  await waitFor(page, async () => (await stage(page)).x > 39.6, 8000, 30);
  await page.keyboard.down('Space');
  await waitFor(page, async () => (await stage(page)).y > 1.3, 5000, 30);
  await page.screenshot({ path: join(shots, '08-jump-crate.png') });
  await waitFor(page, async () => (await stage(page)).x > 44.5, 8000);
  await page.keyboard.up('Space');
  await page.keyboard.up('ArrowRight');
  s = await stage(page);
  check('Move + jump together clears the crate', s.x > 44, `x=${s.x.toFixed(1)}`);

  // Water and respawn.
  const r0 = (await stage(page)).respawns;
  await teleport(page, 59.5, 1);
  await waitFor(page, async () => (await stage(page)).respawns > r0, 8000);
  await waitFor(page, () => playing(page), 8000);
  s = await stage(page);
  check('Falling in the canal respawns safely (no game over)', s.respawns === r0 + 1 && s.phase === 'play' && s.x < 59, `x=${s.x.toFixed(1)} respawns=${s.respawns}`);

  // Checkpoint.
  await teleport(page, 76, 0.2);
  await hold(page, 'ArrowRight', async () => (await stage(page)).checkpoint === 'cp1', 8000);
  await sleep(1500);
  await page.screenshot({ path: join(shots, '09-checkpoint.png') });
  check('Checkpoint activates', (await stage(page)).checkpoint === 'cp1');
  await teleport(page, 104, 0.5);
  await waitFor(page, async () => (await stage(page)).respawns > r0 + 1, 8000);
  await waitFor(page, () => playing(page), 8000);
  s = await stage(page);
  check('Respawn returns to the checkpoint', Math.abs(s.x - 78) < 1.5, `x=${s.x.toFixed(1)}`);

  // Kitten rescue.
  await teleport(page, 128.5, 0.2);
  await sleep(1200);
  await page.screenshot({ path: join(shots, '10-kitten.png') });
  check('Help prompt appears near the kitten', await page.locator('.wl.prompt').first().isVisible());
  await page.keyboard.down('KeyE');
  await waitFor(page, async () => (await stage(page)).kitten === 'following', 4000);
  await page.keyboard.up('KeyE');
  s = await stage(page);
  check('Interact (E) rescues the kitten', s.kitten === 'following', s.kitten);
  await hold(page, 'ArrowRight', async () => (await stage(page)).x > 136, 10000);
  await sleep(800);
  await page.screenshot({ path: join(shots, '10b-kitten-follows.png') });
  await teleport(page, 171, 0.2);
  await hold(page, 'ArrowRight', async () => (await stage(page)).kitten === 'reunited', 10000);
  await sleep(1500);
  await page.screenshot({ path: join(shots, '11-reunited.png') });
  check('Kitten reunited with Mama Cat (badge)', (await stage(page)).kitten === 'reunited');

  // Hint button.
  await page.getByTestId('hint-btn').click();
  await waitFor(page, async () => (await page.locator('.wl.arrow:visible').count()) > 0, 3000);
  check('Hint button shows a pointer arrow', (await page.locator('.wl.arrow').count()) > 0 && (await page.locator('.wl.arrow').first().isVisible()));

  // Pause with Esc, resume.
  await page.keyboard.press('Escape');
  await sleep(300);
  check('Esc opens pause menu', await page.getByTestId('pause-modal').isVisible());
  const xp = (await stage(page)).x;
  await sleep(500);
  check('Game is frozen while paused', Math.abs((await stage(page)).x - xp) < 0.01);
  await page.screenshot({ path: join(shots, '12-pause.png') });
  await page.getByTestId('resume').click();
  await sleep(300);
  check('Resume closes pause menu', !(await state(page)).paused);

  // Finish.
  await teleport(page, 222, 0.2);
  await hold(page, 'ArrowRight', async () => (await stage(page)).phase === 'complete', 10000);
  await sleep(2500);
  await page.screenshot({ path: join(shots, '13-celebrate.png') });
  const doneOk = await waitFor(page, async () => (await page.getByTestId('replay').count()) > 0, 20000);
  check('Stage completion screen appears', doneOk);
  await sleep(1200);
  await page.screenshot({ path: join(shots, '14-complete.png') });
  check('Rescue badge shown on completion', await page.getByTestId('result-badge').isVisible());
  check('Next stage clearly unavailable', await page.getByTestId('next-stage').isDisabled());
  let sv = (await state(page)).save;
  check('Progress saved to localStorage', sv.stages.stage1?.completed === true && sv.unlockedStage === 2, JSON.stringify(sv.stages.stage1));
  check('Rescue badge and medal saved', sv.badges.includes('badge.kitten') && sv.medals.includes('medal.stage1'));
  const raw = await page.evaluate(() => localStorage.getItem('sheriff-labrador-sra.save.v1'));
  check('Save is in browser storage', !!raw && raw.includes('"completed":true'));

  // Replay.
  await page.getByTestId('replay').click();
  const replayOk = await waitFor(page, async () => (await stage(page))?.phase === 'intro', 30000);
  check('Replay restarts Stage 1 from the beginning', replayOk && (await stage(page)).stars === 0);
  await page.getByTestId('skip-intro').click();
  await sleep(300);

  // Quit with warning.
  await page.getByTestId('pause-btn').click();
  await page.getByTestId('quit').click();
  await sleep(300);
  const quitText = await page.getByTestId('quit-modal').innerText();
  check('Quit asks for confirmation with a no-resume warning', /can't be continued/i.test(quitText) && /Stage 1/.test(quitText), quitText.replace(/\s+/g, ' '));
  await page.screenshot({ path: join(shots, '15-quit-warning.png') });
  await page.getByTestId('quit-cancel').click();
  await sleep(200);
  check('Keep playing returns to the game', (await stage(page))?.phase === 'play' && !(await state(page)).paused);
  await page.getByTestId('pause-btn').click();
  await page.getByTestId('quit').click();
  await page.getByTestId('quit-confirm').click();
  await sleep(800);
  s = await state(page);
  check('Quit returns to title and discards the run', s.screen === 'title' && s.stage === null);

  // Stage map.
  await page.getByTestId('stages').click();
  await sleep(300);
  const tile2 = await page.getByTestId('stage-2').innerText();
  check('Stage 2 marked unlocked but coming soon', /coming soon/i.test(tile2), tile2.replace(/\s+/g, ' '));
  check('Stage 3 locked', (await page.getByTestId('stage-3').getAttribute('aria-disabled')) === 'true');
  await page.screenshot({ path: join(shots, '16-stage-map.png') });
  await page.getByTestId('back').click();

  // Rewards.
  await page.getByTestId('rewards').click();
  await sleep(300);
  check('Rewards screen shows the badge unlocked', (await page.locator('.reward:not(.locked)').count()) >= 2);
  await page.screenshot({ path: join(shots, '17-rewards.png') });
  await page.getByTestId('back').click();

  // Settings and audio controls.
  await page.getByTestId('settings').click();
  await page.getByTestId('set-music').fill('20');
  await page.getByTestId('set-sfx').fill('35');
  await page.locator('[data-testid="set-lang"] button').nth(1).click();
  await sleep(200);
  await page.screenshot({ path: join(shots, '18-settings-bm.png') });
  sv = (await state(page)).save;
  check('Music and sound volumes saved independently', Math.abs(sv.settings.musicVolume - 0.2) < 0.01 && Math.abs(sv.settings.sfxVolume - 0.35) < 0.01);
  check('Language saved', sv.settings.language === 'ms');
  await page.getByTestId('settings-close').click();

  // Refresh: progress persists; Continue available; no mid-stage resume.
  await page.reload();
  await waitFor(page, async () => (await page.getByTestId('play').count()) > 0, 20000);
  check('After refresh: Continue shown and progress kept', (await page.getByTestId('continue').count()) === 1 && (await state(page)).save.stages.stage1?.completed === true);
  check('After refresh: language kept (BM)', (await page.getByTestId('play').innerText()).includes('Main'));
  await ctx.close();

  // ---------------- Little Explorer auto-jump ----------------
  {
    const { ctx: c2, page: p2 } = await newPage({ viewport: { width: 960, height: 540 } });
    await p2.goto(URL_FAST);
    await waitFor(p2, async () => (await p2.getByTestId('play').count()) > 0, 20000);
    await startStage(p2, 'poppy', 'explorer');
    await p2.getByTestId('skip-intro').click();
    await teleport(p2, 36, 0.2);
    await hold(p2, 'ArrowRight', async () => (await stage(p2)).x > 63, 20000);
    const se = await stage(p2);
    check('Little Explorer: jump helper clears crates and canal holding only Right', se.x > 62 && se.respawns === 0, `x=${se.x.toFixed(1)} respawns=${se.respawns}`);
    await teleport(p2, 130, 0.2);
    await waitFor(p2, async () => (await stage(p2)).kitten === 'following', 5000);
    check('Little Explorer: kitten rescued automatically on touch', (await stage(p2)).kitten === 'following');
    await p2.screenshot({ path: join(shots, '19-explorer.png') });
    await c2.close();
  }

  // ---------------- Super Sheriff ----------------
  {
    const { ctx: c3, page: p3 } = await newPage({ viewport: { width: 960, height: 540 } });
    await p3.goto(URL_FAST);
    await waitFor(p3, async () => (await p3.getByTestId('play').count()) > 0, 20000);
    await startStage(p3, 'biscuit', 'super');
    await p3.getByTestId('skip-intro').click();
    await waitFor(p3, () => playing(p3), 5000);
    const ss = await stage(p3);
    check('Super Sheriff loads with the same 28 main stars', ss.totalStars === 28, ss.totalStars);
    await teleport(p3, 95, 7);
    await waitFor(p3, async () => (await stage(p3)).bonusStars >= 1, 4000);
    check('Super Sheriff: hidden bonus star collectable', (await stage(p3)).bonusStars >= 1);
    await teleport(p3, 147, 0.3);
    let top = 0;
    await hold(p3, 'ArrowRight', async () => { const st = await stage(p3); top = Math.max(top, st.y); return st.x > 149.6; }, 8000);
    await waitFor(p3, async () => { const st = await stage(p3); top = Math.max(top, st.y); return top > 5; }, 6000, 40);
    check('Bounce pad launches the hero high', top > 5, `peak y=${top.toFixed(1)}`);
    await p3.screenshot({ path: join(shots, '20-super-bounce.png') });
    await sleep(1000);
    await c3.close();
  }

  // ---------------- Mobile landscape touch ----------------
  {
    const { ctx: c4, page: p4 } = await newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await p4.goto(URL_FAST);
    await waitFor(p4, async () => (await p4.getByTestId('play').count()) > 0, 20000);
    await sleep(1500);
    await p4.screenshot({ path: join(shots, '21-mobile-title.png') });
    await p4.getByTestId('play').tap();
    await p4.getByTestId('hero-biscuit').tap();
    await p4.getByTestId('diff-junior').tap();
    await waitFor(p4, async () => (await stage(p4))?.phase === 'intro', 30000);
    await p4.getByTestId('skip-intro').tap();
    await waitFor(p4, () => playing(p4), 5000);
    check('Touch controls visible on a phone', await p4.locator('.touch.active [data-action="jump"]').isVisible());
    const bx = await p4.locator('[data-action="right"]').boundingBox();
    const jb = await p4.locator('[data-action="jump"]').boundingBox();
    const cdp = await c4.newCDPSession(p4);
    const pt = (b, id) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2, id });
    const x1 = (await stage(p4)).x;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt(bx, 1)] });
    await waitFor(p4, async () => (await stage(p4)).x > x1 + 1, 8000, 50);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt(bx, 1), pt(jb, 2)] });
    let mid = { y: 0 };
    await waitFor(p4, async () => { const st = await stage(p4); if (st.y > mid.y) mid = st; return st.y > 1; }, 4000, 40);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [pt(bx, 1)] });
    await waitFor(p4, async () => (await stage(p4)).x > x1 + 3, 6000, 50);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const x2 = (await stage(p4)).x;
    check('Multi-touch: hold Right and tap Jump together', x2 > x1 + 2 && mid.y > 0.5, `x ${x1.toFixed(1)} -> ${x2.toFixed(1)}, y=${mid.y.toFixed(2)}`);
    await p4.screenshot({ path: join(shots, '22-mobile-gameplay.png') });
    const scrollY = await p4.evaluate(() => window.scrollY + document.documentElement.scrollTop);
    check('No page scrolling during play', scrollY === 0);
    await p4.setViewportSize({ width: 390, height: 844 });
    await sleep(600);
    check('Portrait phone shows "turn your device" message', await p4.locator('#rotate').isVisible());
    check('Portrait rotation pauses the game', (await state(p4)).paused === true);
    await p4.screenshot({ path: join(shots, '23-mobile-portrait.png') });
    await c4.close();
  }

  // ---------------- Tablet ----------------
  {
    const { ctx: c5, page: p5 } = await newPage({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true });
    await p5.goto(URL_FAST);
    await waitFor(p5, async () => (await p5.getByTestId('play').count()) > 0, 20000);
    await p5.getByTestId('play').tap();
    await sleep(1200);
    await p5.screenshot({ path: join(shots, '24-tablet-heroes.png') });
    const over = await p5.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    check('Tablet layout has no horizontal overflow', !over);
    await c5.close();
  }

  // ---------------- Tab switching ----------------
  {
    const { ctx: c6, page: p6 } = await newPage({ viewport: { width: 960, height: 540 } });
    await p6.goto(URL_FAST);
    await waitFor(p6, async () => (await p6.getByTestId('play').count()) > 0, 20000);
    await startStage(p6);
    await p6.getByTestId('skip-intro').click();
    await waitFor(p6, () => playing(p6), 5000);
    await p6.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await sleep(200);
    check('Switching tabs pauses the game automatically', (await state(p6)).paused === true);
    await c6.close();
  }
} catch (e) {
  check('Test run completed without exceptions', false, e.stack || e.message);
}

const realErrors = errors.filter((e) => !/favicon|fonts\.g/i.test(e));
check('No JavaScript errors in the browser console', realErrors.length === 0, realErrors.slice(0, 5).join(' | '));

writeFileSync(join(here, 'report.json'), JSON.stringify({ date: new Date().toISOString(), passed: results.filter((r) => r.ok).length, failed, results }, null, 2));
console.log(`\n${results.length - failed}/${results.length} checks passed`);
await browser.close();
server?.kill();
process.exit(failed ? 1 : 0);
