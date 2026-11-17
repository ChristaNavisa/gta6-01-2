// VERDE BAY — tiny static server for local playtesting.
// Serves game/ at http://localhost:8080. Node standard library only.
// Run: node serve.ts (then open http://localhost:8080 in a browser).
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';

const GAME_DIR = new URL('./game/', import.meta.url).pathname;
const PORT = parseInt(process.argv[2] || '8080', 10);

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  const file = join(GAME_DIR, url === '/' ? 'index.html' : url);
  const safe = normalize(file);
  if (!safe.startsWith(GAME_DIR) || !existsSync(safe) || statSync(safe).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(safe)] || 'application/octet-stream' });
  createReadStream(safe).pipe(res);
});

server.listen(PORT, () => {
  console.log(`VERDE BAY serving game/ at http://localhost:${PORT}/`);
});
