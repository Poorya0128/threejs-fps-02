// Captures the 3–4 screenshots from the game's own ?scenario= setups (real renders, never edited).
// Writes screenshots/01-cover.jpg … 04-roundend.jpg at 1280×720, lowering JPEG quality until ≤ 180 KiB.
// Usage: node tools/shoot.mjs [--only cover]   (set HEADED=1 to use a real GPU window if available)
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { startServer } from './serve.mjs';
import { launch, openPage } from './browser.mjs';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const SHOTS = [['01-cover', 'cover'], ['02-buy', 'buy'], ['03-fuse', 'fuse'], ['04-roundend', 'roundend']];
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const LIMIT = 180 * 1024;
const PORT = 8124;

mkdirSync(join(ROOT, 'screenshots'), { recursive: true });
const server = await startServer(PORT);
const browser = await launch();
let failed = false;

for (const [file, scenario] of SHOTS) {
  if (only && only !== scenario) continue;
  const { page, errors, external } = await openPage(browser, `http://127.0.0.1:${PORT}/index.html?scenario=${scenario}`);
  try {
    await page.waitForFunction(() => window.__saltline?.scenarioReady === true, null, { timeout: 60000 });
  } catch { console.log(`FAIL ${scenario}: scenarioReady never became true`); failed = true; await page.close(); continue; }
  await page.evaluate(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))));
  let quality = 88, buf;
  do { buf = await page.screenshot({ type: 'jpeg', quality }); quality -= 4; } while (buf.length > LIMIT && quality >= 50);
  writeFileSync(join(ROOT, 'screenshots', `${file}.jpg`), buf);
  const bad = errors.length || external.length || buf.length > LIMIT;
  if (bad) failed = true;
  console.log(`${bad ? 'FAIL' : 'PASS'} ${file}.jpg  ${(buf.length / 1024).toFixed(0)} KiB  q${quality + 4}`
    + (errors.length ? `  errors: ${errors.slice(0, 3).join(' | ')}` : '') + (external.length ? `  external: ${external[0]}` : ''));
  await page.close();
}
await browser.close();
server.close();
console.log('Now LOOK at every image: HUD fully visible, bots readable, nothing black or empty.');
process.exit(failed ? 1 : 0);
