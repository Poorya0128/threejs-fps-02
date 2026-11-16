// Plays full bots-only matches (?autoplay=1) and fails on console errors, network requests outside
// 127.0.0.1, or matches that never end. Needs the window.__saltline contract from AGENTS.md.
// Usage: node tools/smoke.mjs [--seeds 1,2,3] [--speed 8] [--timeout 240] [--norender]
// --norender appends &norender=1 (game skips rasterization, sim only): SwiftShader renders
// ~0.6 fps at 1280x720 with the M3 rigs, so a rendered full match cannot finish inside the
// timeout; rendering itself is verified by tools/lookdev.mjs and tools/shoot.mjs instead.
// Pass criteria are unchanged with or without it.
import { startServer } from './serve.mjs';
import { launch, openPage } from './browser.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const seeds = arg('--seeds', '1,2,3').split(',').map(Number);
const speed = Number(arg('--speed', '8'));
const timeoutS = Number(arg('--timeout', '240'));
const norender = process.argv.includes('--norender');
const PORT = 8123;

const server = await startServer(PORT);
const browser = await launch();
const reasons = new Set();
let failed = false;

for (const seed of seeds) {
  const t0 = Date.now();
  const { page, errors, external } = await openPage(browser, `http://127.0.0.1:${PORT}/index.html?autoplay=1&speed=${speed}&seed=${seed}${norender ? '&norender=1' : ''}`);
  let s = null;
  const seen = new Set();
  while (Date.now() - t0 < timeoutS * 1000) {
    s = await page.evaluate(() => window.__saltline && JSON.parse(JSON.stringify(window.__saltline)));
    if (s?.lastWinReason) seen.add(s.lastWinReason);
    if (s?.matchOver || errors.length) break;
    await page.waitForTimeout(500);
  }
  seen.forEach((r) => reasons.add(r));
  const fps = await page.evaluate(() => new Promise((ok) => {
    let n = 0; const t = performance.now();
    const f = () => (++n < 60 ? requestAnimationFrame(f) : ok(Math.round(60000 / (performance.now() - t))));
    requestAnimationFrame(f);
  }));
  const ok = s?.matchOver && s.roundsPlayed >= 7 && !errors.length && !external.length;
  if (!ok) failed = true;
  console.log(`${ok ? 'PASS' : 'FAIL'} seed ${seed}: ${s ? `${s.roundsPlayed} rounds, score ${s.score?.strand}-${s.score?.bastion}, over=${s.matchOver}` : 'no window.__saltline'}`
    + `, win reasons ${[...seen].join('/') || 'none'}, ~${fps} fps (software GL), ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  errors.slice(0, 5).forEach((e) => console.log('   console error:', e));
  external.slice(0, 5).forEach((u) => console.log('   external request:', u));
  await page.close();
}
console.log(`Win reasons seen over all seeds: ${[...reasons].join(', ') || 'none'}`
  + (reasons.size < 3 ? '  (WARN: expect elimination plus objective outcomes across seeds)' : ''));
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
