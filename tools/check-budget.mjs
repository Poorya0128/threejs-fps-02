// Shows what the judge will read: the source files in dossier order and their bytes against the
// 160 KiB (163,840 B) text cap. Source = .html .js .mjs .css .glsl .vert .frag .wgsl .json under game/,
// not under a dir named vendor, not *.min.js/.min.mjs/.min.css. Order: index.html, then a depth-first walk of
// static imports from its module scripts, then the rest by path. Exit 1 if the target budget is exceeded.
// Usage: node tools/check-budget.mjs [--target 153600]
import { readFileSync, readdirSync, lstatSync, existsSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { parse } from 'acorn';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const GAME = join(ROOT, 'game');
const CAP = 163840;
const t = process.argv.indexOf('--target');
const TARGET = t > 0 ? Number(process.argv[t + 1]) : 150 * 1024;
const HEADER_ESTIMATE = 80; // the dossier puts a header line (path, lines, bytes) above each file

const isSource = (rel) =>
  /\.(html|js|mjs|css|glsl|vert|frag|wgsl|json)$/.test(rel) &&
  !/\.min\.(js|mjs|css)$/.test(rel) && !rel.split('/').slice(0, -1).includes('vendor');

const all = [];
(function walk(dir) {
  for (const n of readdirSync(dir).sort()) {
    const p = join(dir, n);
    if (lstatSync(p).isDirectory()) walk(p);
    else all.push(relative(GAME, p).split('\\').join('/'));
  }
})(GAME);
const sources = all.filter(isSource);

const html = readFileSync(join(GAME, 'index.html'), 'utf8');
const map = (() => {
  const m = html.match(/<script\b[^>]*type\s*=\s*["']?importmap["']?[^>]*>([\s\S]*?)<\/script>/i);
  try { return m ? JSON.parse(m[1]).imports ?? {} : {}; } catch { return {}; }
})();

const order = ['index.html'];
const seen = new Set(order);
const resolveSpec = (spec, fromRel) => {
  if (spec.startsWith('./') || spec.startsWith('../')) return relative(GAME, resolve(GAME, dirname(fromRel), spec)).split('\\').join('/');
  if (map[spec]) return relative(GAME, resolve(GAME, map[spec])).split('\\').join('/');
  return null;
};
const staticImports = (code) => {
  try {
    return parse(code, { ecmaVersion: 'latest', sourceType: 'module' }).body
      .filter((n) => n.source && /^(ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration)$/.test(n.type))
      .map((n) => n.source.value);
  } catch { return []; }
};
const dfs = (rel) => {
  if (seen.has(rel) || !existsSync(join(GAME, rel))) return;
  seen.add(rel);
  if (isSource(rel)) order.push(rel);
  for (const s of staticImports(readFileSync(join(GAME, rel), 'utf8'))) { const r = resolveSpec(s, rel); if (r) dfs(r); }
};
for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
  if (!/type\s*=\s*["']?module/i.test(m[1])) continue;
  const src = m[1].match(/\bsrc\s*=\s*["']?([^"'\s>]+)/);
  if (src) dfs(resolveSpec(src[1].startsWith('.') ? src[1] : './' + src[1], 'index.html'));
  else for (const s of staticImports(m[2])) { const r = resolveSpec(s, 'index.html'); if (r) dfs(r); }
}
for (const s of sources) if (!seen.has(s)) order.push(s);

let used = 0, cutAt = null;
console.log('Judge reading order:');
for (const rel of order) {
  const bytes = lstatSync(join(GAME, rel)).size;
  const lines = readFileSync(join(GAME, rel), 'utf8').split('\n').length;
  used += bytes + HEADER_ESTIMATE;
  if (used > CAP && !cutAt) cutAt = rel;
  console.log(`  ${(bytes / 1024).toFixed(1).padStart(6)} KiB  ${String(lines).padStart(5)} lines  ${rel}${used > CAP ? '   <-- CUT/HIDDEN' : ''}`);
}
const total = order.reduce((s, r) => s + lstatSync(join(GAME, r)).size, 0);
console.log(`Source total ${(total / 1024).toFixed(1)} KiB in ${order.length} files; target ${(TARGET / 1024).toFixed(0)} KiB; cap 160 KiB.`);
const unreached = sources.filter((s) => !seen.has(s));
if (unreached.length) console.log(`Not reached by imports (read last, by path): ${unreached.join(', ')}`);
if (cutAt) console.log(`FAIL: text cap reached at ${cutAt}; the judge will not see everything after it.`);
else if (total > TARGET) console.log('FAIL: over the target budget; trim before shipping.');
else console.log('PASS');
process.exit(cutAt || total > TARGET ? 1 : 0);
