import { createRequire } from 'module'; const { chromium } = createRequire('/home/claude/d15/')('playwright');
import http from 'http'; import fs from 'fs'; import path from 'path';
export async function open(port) {
  const root = '/home/claude/30dmc26-d27-newtool-hamburg-urban-potential/docs';
  const types = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.geojson': 'application/json', '.woff2': 'font/woff2', '.jpg': 'image/jpeg' };
  const FONTS = { 'inter': '/home/claude/d21test/fonts/fontsource-inter/files/', 'jb': '/home/claude/d14film/fonts/' };
  const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/index.html';
    let f = u.startsWith('/ff/inter/') ? FONTS.inter + u.slice(10) : u.startsWith('/ff/jb/') ? FONTS.jb + u.slice(7) : path.join(root, u);
    fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(u)] || 'application/octet-stream' }); r.end(d); }); }).listen(port);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.route(/maplibre-gl@4\.7\.1\/dist\/(.*)/, rt => rt.fulfill({ path: '/home/claude/d17test/maplibre-gl-4.7.1/package/dist/' + rt.request().url().split('/dist/')[1] }));
  await p.route(/deck\.gl@9\.0\.38\/dist\.min\.js/, rt => rt.fulfill({ path: '/home/claude/d16/node_modules/deck.gl/dist.min.js', contentType: 'application/javascript' }));
  await p.route(/basemaps\.cartocdn\.com/, rt => rt.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#f3f0ea' } }] }) }));
  await p.route(/fonts\.googleapis\.com|geodienste\.hamburg\.de|arcgisonline/, rt => rt.abort());
  await p.goto(`http://localhost:${port}/`); await p.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  return { b, p, srv };
}
