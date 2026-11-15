// Visual QA captures (dev only, never shipped): renders fixed camera views (?cam=) and the 4 screenshot
// scenarios into out/lookdev/<run>/ as PNG, and logs draw calls, triangles and frame time from
// window.__saltline.stats. Views are listed in tools/lookdev-views.json; keep them stable so runs compare.
// Usage: node tools/lookdev.mjs [--only <name>] [--hud]     then open the images and run the art-review checklist.
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { startServer } from './serve.mjs';
import { launch, openPage } from './browser.mjs';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const viewsFile = join(ROOT, 'tools', 'lookdev-views.json');
const views = existsSync(viewsFile) ? JSON.parse(readFileSync(viewsFile, 'utf8')) : [];
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const hud = process.argv.includes('--hud') ? '&hud=1' : '';
const run = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const dir = join(ROOT, 'out', 'lookdev', run);
const PORT = 8125;
mkdirSync(dir, { recursive: true });

const jobs = [
  ...views.map((v) => [v.name, `cam=${v.cam.join(',')}${hud}`]),
  ...['cover', 'buy', 'fuse', 'roundend'].map((s) => [`scenario-${s}`, `scenario=${s}`]),
].filter(([name]) => !only || name === only);

const server = await startServer(PORT);
const browser = await launch();
const report = [];
for (const [name, query] of jobs) {
  const { page, errors, external } = await openPage(browser, `http://127.0.0.1:${PORT}/index.html?${query}`);
  try {
    await page.waitForFunction(() => window.__saltline?.scenarioReady === true, null, { timeout: 60000 });
    await page.evaluate(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))));
    await page.screenshot({ path: join(dir, `${name}.png`) });
    const s = await page.evaluate(() => window.__saltline.stats ?? null);
    const line = `${name.padEnd(22)} draws ${s?.drawCalls ?? '?'}  tris ${s?.triangles ?? '?'}  frame ${s?.frameMs?.toFixed?.(1) ?? '?'} ms`
      + (errors.length ? `  ERRORS: ${errors.slice(0, 2).join(' | ')}` : '') + (external.length ? `  EXTERNAL: ${external[0]}` : '');
    report.push(line);
    console.log(line);
  } catch { report.push(`${name}: not ready (scenarioReady never true)`); console.log(report.at(-1)); }
  await page.close();
}
writeFileSync(join(dir, 'report.txt'), report.join('\n') + '\n');
await browser.close();
server.close();
console.log(`\nImages in ${dir}. Open each one and go through ART.md §13 before changing anything else.`);
console.log('Note: headless uses software GL (SwiftShader); frame times are not representative of a real GPU.');
