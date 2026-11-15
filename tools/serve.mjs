// Minimal static server for game/ (dev only). Usage: node tools/serve.mjs [port]
// Also exported as startServer(port) for smoke.mjs and shoot.mjs.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve, dirname, relative } from 'node:path';

const GAME = resolve(dirname(new URL(import.meta.url).pathname), '..', 'game');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.glsl': 'text/plain', '.dat': 'application/octet-stream',
};

export function startServer(port = 8080) {
  const server = createServer(async (req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = resolve(GAME, '.' + url);
    if (relative(GAME, file).startsWith('..')) { res.writeHead(403).end(); return; }
    try {
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    } catch { res.writeHead(404).end('not found'); }
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok(server)));
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const port = Number(process.argv[2] ?? 8080);
  await startServer(port);
  console.log(`Serving game/ at http://127.0.0.1:${port}/`);
}
