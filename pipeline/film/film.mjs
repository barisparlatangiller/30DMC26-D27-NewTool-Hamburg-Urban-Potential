import { open } from './harness.mjs'; import fs from 'fs'; import { spawn } from 'child_process';
const PORT = +(process.env.PORT || 8802), FPS = 30, DUR = 18, F0 = +(process.env.F0 || 0), F1 = +(process.env.F1 || DUR * FPS), NAME = process.env.NAME || 'day27_homes_or_workshops';
const { b, p, srv } = await open(PORT);
await p.addStyleTag({ path: '/home/claude/d27film2/film.css' }); await p.addScriptTag({ path: '/home/claude/d27film2/film.js' });
await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(1500);
const shot = async t => { await p.evaluate(t => FILM(t), t); await p.waitForFunction(() => window.__idle, null, { timeout: 60000 }); return p.screenshot({ type: 'jpeg', quality: 92 }); };
const stills = (process.env.STILLS || '').split(',').filter(Boolean).map(Number);
if (stills.length) { for (const t of stills) { await shot(t); await p.waitForTimeout(800); fs.writeFileSync(`out/still_${t}.jpg`, await shot(t)); } await b.close(); srv.close(); process.exit(0); }
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `out/${NAME}.tmp.mp4`]);
for (let n = F0; n < F1; n++) { const buf = await shot(n / FPS); if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r)); if (n % 30 === 0) fs.writeFileSync(`out/log_${NAME}.txt`, `frame ${n}/${F1}\n`); }
ff.stdin.end(); await new Promise(r => ff.on('close', r)); fs.renameSync(`out/${NAME}.tmp.mp4`, `out/${NAME}.mp4`);
await b.close(); srv.close(); process.exit(0);
