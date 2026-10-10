// Biblioteca común de las herramientas: carga js/core.js y js/game.js en Node (sin navegador).
import vm from 'node:vm';
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext({ console, Blob, TextEncoder, window: {} });
for (const f of ['js/core.js', 'js/musica.js', 'js/game.js']) vm.runInContext(fs.readFileSync(path.join(RAIZ, f), 'utf8'), ctx, { filename: f });
export const F = vm.runInContext(`({objToProject,projectToObj,newProject,SCENES,LEVEL_TEMPLATES,makeGame,levelFromAscii,blankLevel,attachLevels,randomCharColors,genCharacter,rng,bufRows,rowsBuf,BGW,BGH,TILE,NTILES,CLIP_DEFS,PAL_CHARS,FORMAT,MAXPAL,MAXLEVELS,genScene,hexRgb,crc32,makeZip,THEMES,makeAudio,musicaCancion,musicaSonido,musicaLimpia,musicaPorDefecto,MUS_CANCIONES_EJEMPLO,MUS_SONIDOS_EJEMPLO,MUS_EVENTOS,musicaIdLibre})`, ctx);

export function leerProyecto(archivo) {
  let txt;
  try { txt = fs.readFileSync(archivo, 'utf8'); } catch (e) { throw new Error('No puedo leer ' + archivo + ': ' + e.message); }
  let obj;
  try { obj = JSON.parse(txt); } catch (e) { throw new Error('El archivo no es un JSON válido: ' + e.message); }
  return { obj, P: F.objToProject(obj) };
}

/* ---- PNG sencillo (RGBA 8 bits) ---- */
export function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const chunk = (t, d) => { const b = Buffer.alloc(12 + d.length); b.writeUInt32BE(d.length, 0); b.write(t, 4, 'latin1'); d.copy(b, 8); b.writeUInt32BE(F.crc32(b.subarray(4, 8 + d.length)) >>> 0, 8 + d.length); return b; };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
/* Lienzo RGBA en memoria */
export function lienzo(w, h, fondo) {
  const d = new Uint8ClampedArray(w * h * 4);
  if (fondo) for (let i = 0; i < w * h; i++) { d[i * 4] = fondo[0]; d[i * 4 + 1] = fondo[1]; d[i * 4 + 2] = fondo[2]; d[i * 4 + 3] = 255; }
  return { w, h, d };
}
/* Dibuja un buffer de paleta (Uint8Array) en el lienzo en (ox,oy) con escala z; recorte opcional de origen (sx,sy,sw,sh) */
export function pegar(cv, buf, bw, bh, pal, ox, oy, z = 1, sx = 0, sy = 0, sw = bw, sh = bh) {
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    const v = buf[(sy + y) * bw + sx + x]; if (!v) continue; const c = F.hexRgb(pal[v]);
    for (let dy = 0; dy < z; dy++) for (let dx = 0; dx < z; dx++) {
      const X = ox + x * z + dx, Y = oy + y * z + dy; if (X < 0 || Y < 0 || X >= cv.w || Y >= cv.h) continue;
      const i = (Y * cv.w + X) * 4; cv.d[i] = c[0]; cv.d[i + 1] = c[1]; cv.d[i + 2] = c[2]; cv.d[i + 3] = 255;
    }
  }
}
export function rect(cv, x0, y0, w, h, rgb) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { if (x < 0 || y < 0 || x >= cv.w || y >= cv.h) continue; const i = (y * cv.w + x) * 4; cv.d[i] = rgb[0]; cv.d[i + 1] = rgb[1]; cv.d[i + 2] = rgb[2]; cv.d[i + 3] = 255; }
}
export const guardarPng = (archivo, cv) => { fs.mkdirSync(path.dirname(archivo), { recursive: true }); fs.writeFileSync(archivo, png(cv.w, cv.h, cv.d)); };

export function args(argv) {
  const pos = [], op = {};
  for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { const k = a.slice(2); const n = argv[i + 1]; if (n === undefined || n.startsWith('--')) op[k] = true; else { op[k] = n; i++; } } else pos.push(a); }
  return { pos, op };
}
export function fallar(msg) { console.error('✗ ' + msg); process.exit(1); }
