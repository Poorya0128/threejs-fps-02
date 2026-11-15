// Local re-implementation of the make.fun gate rows (game_files, three_js, references, screenshots,
// dossier size, js_parses). The real gate is sealed; this is a strict approximation. Exit code 1 on failure.
// Usage: node tools/check-gate.mjs [--out <dir produced by main.ts>]
import { lstatSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, dirname, resolve, sep } from 'node:path';
import { parse } from 'acorn';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const outArg = process.argv.indexOf('--out');
const OUT = outArg > 0 ? resolve(process.argv[outArg + 1]) : null;
const GAME = OUT ? join(OUT, 'game') : join(ROOT, 'game');
const SHOTS = OUT ? join(OUT, 'screenshots') : join(ROOT, 'screenshots');

const CORE_SHA = '613e370f76638fdef83926642bf256dc9615684922de1ce1f63a8583e5d78578';
const MODULE_SHA = 'ef510bae547ab3789d6ed543333a8bf42510a8c70743b766c4e19039b976c26b';
const MiB = 1024 * 1024;
const rows = [];
const row = (name, ok, detail) => rows.push({ name, ok, detail });
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const inside = (base, p) => { const r = relative(base, p); return r !== '' && !r.startsWith('..') && !r.startsWith(sep); };

function walk(dir, list = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = lstatSync(p);
    list.push({ p, st });
    if (st.isDirectory()) walk(p, list);
  }
  return list;
}

// ---- game_files
let entries = [];
{
  const problems = [];
  if (!existsSync(GAME)) problems.push('game/ missing');
  else {
    entries = walk(GAME);
    let bytes = 0;
    for (const { p, st } of entries) {
      if (st.isSymbolicLink()) problems.push(`symlink: ${relative(GAME, p)}`);
      else if (!st.isFile() && !st.isDirectory()) problems.push(`not a plain file: ${relative(GAME, p)}`);
      if (st.isFile()) bytes += st.size;
      if (Buffer.byteLength(relative(GAME, p)) > 1000) problems.push(`path too long: ${relative(GAME, p).slice(0, 60)}…`);
    }
    if (entries.length > 993) problems.push(`${entries.length} entries > 993`);
    if (bytes > 48 * MiB) problems.push(`${bytes} bytes > 48 MiB`);
    const idx = join(GAME, 'index.html');
    if (!existsSync(idx) || !lstatSync(idx).isFile()) problems.push('game/index.html missing');
    else if (lstatSync(idx).size > MiB) problems.push('index.html > 1 MiB');
    row('game_files', problems.length === 0, problems.join('; ') || `${entries.length} entries, ${(bytes / MiB).toFixed(2)} MiB`);
  }
  if (!existsSync(GAME)) row('game_files', false, problems.join('; '));
}

// ---- three_js + import map
const html = existsSync(join(GAME, 'index.html')) ? readFileSync(join(GAME, 'index.html'), 'utf8') : '';
const importMaps = [...html.matchAll(/<script\b[^>]*\btype\s*=\s*["']?importmap["']?[^>]*>([\s\S]*?)<\/script>/gi)];
let imports = {};
{
  const problems = [];
  const mod = join(GAME, 'three.module.min.js');
  const core = join(GAME, 'three.core.min.js');
  if (!existsSync(mod) || sha(mod) !== MODULE_SHA) problems.push('three.module.min.js missing or not byte-exact');
  if (!existsSync(core) || sha(core) !== CORE_SHA) problems.push('three.core.min.js missing or not byte-exact');
  if (importMaps.length !== 1) problems.push(`${importMaps.length} import maps (need exactly 1)`);
  else {
    try {
      imports = JSON.parse(importMaps[0][1]).imports ?? {};
      const target = imports.three;
      if (typeof target !== 'string' || !/^\.{1,2}\//.test(target)) problems.push('"three" must map to a relative path');
      else if (resolve(GAME, target) !== mod) problems.push(`"three" maps to ${target}, not three.module.min.js`);
    } catch (e) { problems.push(`import map is not JSON: ${e.message}`); }
  }
  row('three_js', problems.length === 0, problems.join('; ') || 'three.js 0.187.0 vendored, import map OK');
}

// ---- references + js_parses
{
  const problems = [];
  let firstUnparsed = null;
  const check = (spec, fromFile, what) => {
    const clean = spec.split(/[?#]/)[0];
    let target = null;
    if (/^[a-z][a-z0-9+.-]*:/i.test(spec) || spec.startsWith('//')) return problems.push(`${what} uses a URL scheme: ${spec}`);
    if (clean.startsWith('./') || clean.startsWith('../')) target = resolve(dirname(fromFile), clean);
    else if (clean.startsWith('/')) return problems.push(`${what} is root-absolute: ${spec}`);
    else if (fromFile.endsWith('.html') && what !== 'import') target = resolve(dirname(fromFile), clean);
    else if (imports[clean]) target = resolve(GAME, imports[clean]);
    else {
      const prefix = Object.keys(imports).find((k) => k.endsWith('/') && clean.startsWith(k));
      if (!prefix) return problems.push(`unmapped bare specifier "${spec}" in ${relative(GAME, fromFile)}`);
      target = resolve(GAME, imports[prefix] + clean.slice(prefix.length));
    }
    if (!inside(GAME, target) || !existsSync(target) || !lstatSync(target).isFile())
      problems.push(`${what} "${spec}" in ${relative(GAME, fromFile)} does not resolve to a file inside game/`);
  };
  const scanModule = (code, file) => {
    let ast;
    try { ast = parse(code, { ecmaVersion: 'latest', sourceType: 'module' }); }
    catch (e) { firstUnparsed ??= `${relative(GAME, file)}: ${e.message}`; return; }
    const visit = (node) => {
      if (!node || typeof node.type !== 'string') return;
      if ((node.type === 'ImportDeclaration' || node.type === 'ExportAllDeclaration' ||
           (node.type === 'ExportNamedDeclaration' && node.source)) && node.source) check(node.source.value, file, 'import');
      if (node.type === 'ImportExpression') {
        if (node.source.type === 'Literal') check(node.source.value, file, 'import');
        else problems.push(`non-literal dynamic import() in ${relative(GAME, file)}`);
      }
      for (const key in node) {
        const v = node[key];
        if (Array.isArray(v)) v.forEach(visit);
        else if (v && typeof v === 'object' && key !== 'loc') visit(v);
      }
    };
    visit(ast);
  };
  const idx = join(GAME, 'index.html');
  for (const m of html.matchAll(/<(script|link|img|source|video|audio|iframe)\b([^>]*)>/gi)) {
    const attr = m[1].toLowerCase() === 'link' ? 'href' : 'src';
    const a = m[2].match(new RegExp(`\\b${attr}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
    if (a) check(a[1] ?? a[2] ?? a[3], idx, `<${m[1]} ${attr}>`);
  }
  for (const [, v] of Object.entries(imports)) check(v, idx, 'import-map value');
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))
    if (/type\s*=\s*["']?module/i.test(m[1]) && !/\bsrc\s*=/.test(m[1])) scanModule(m[2], idx);
  for (const { p, st } of entries)
    if (st.isFile() && /\.(m?js)$/.test(p)) scanModule(readFileSync(p, 'utf8'), p);
  row('references', problems.length === 0, problems.slice(0, 8).join('; ') || 'all references local and resolvable');
  row('js_parses', true, firstUnparsed ? `FIRST UNPARSED: ${firstUnparsed}` : 'all modules parse');
  if (firstUnparsed) rows.at(-1).warn = true;
}

// ---- screenshots
{
  const problems = [];
  const files = existsSync(SHOTS) ? readdirSync(SHOTS).filter((n) => !n.startsWith('.')).sort() : [];
  if (files.length < 3 || files.length > 4) problems.push(`${files.length} screenshots (need 3–4)`);
  const info = [];
  for (const n of files) {
    const p = join(SHOTS, n);
    const st = lstatSync(p);
    if (!/^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/.test(n)) problems.push(`bad name ${n}`);
    if (!st.isFile()) { problems.push(`${n} not a regular file`); continue; }
    if (st.size > 256 * 1024) problems.push(`${n} is ${st.size} bytes > 256 KiB`);
    const b = readFileSync(p);
    const dim = imageSize(b);
    if (!dim) { problems.push(`${n} is not a whole PNG/JPEG`); continue; }
    const long = Math.max(dim.w, dim.h), short = Math.min(dim.w, dim.h);
    if (long > 1280 || short < 480) problems.push(`${n} is ${dim.w}×${dim.h}`);
    info.push(`${n} ${dim.w}×${dim.h} ${(st.size / 1024).toFixed(0)}KiB${st.size > 180 * 1024 ? ' (over 180 KiB target)' : ''}`);
  }
  row('screenshots', problems.length === 0, problems.join('; ') || info.join(', '));
}

// ---- output dir (only with --out)
if (OUT) {
  const problems = [];
  const all = walk(OUT);
  const bytes = all.reduce((s, e) => s + (e.st.isFile() ? e.st.size : 0), 0);
  if (all.length > 1000) problems.push(`${all.length} entries > 1000`);
  if (bytes > 64 * MiB) problems.push(`${bytes} bytes > 64 MiB`);
  const d = join(OUT, 'dossier.json');
  if (!existsSync(d)) problems.push('dossier.json missing');
  else if (lstatSync(d).size > 1.5 * MiB) problems.push(`dossier.json ${lstatSync(d).size} bytes > 1.5 MiB`);
  row('output', problems.length === 0, problems.join('; ') ||
    `${all.length} entries, dossier.json ${(lstatSync(d).size / 1024).toFixed(0)} KiB`);
}

function imageSize(b) {
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47 && b.toString('ascii', 12, 16) === 'IHDR') {
    if (b.toString('ascii', b.length - 8, b.length - 4) !== 'IEND') return null;
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    if (b[b.length - 2] !== 0xff || b[b.length - 1] !== 0xd9) return null;
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc)
        return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return null;
}

let failed = false;
for (const r of rows) {
  const tag = r.warn ? 'WARN' : r.ok ? 'PASS' : 'FAIL';
  if (!r.ok) failed = true;
  console.log(`${tag.padEnd(5)} ${r.name.padEnd(12)} ${r.detail}`);
}
process.exit(failed ? 1 : 0);
