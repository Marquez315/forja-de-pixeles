#!/usr/bin/env node
// Uso: node herramientas/previsualizar.mjs proyectos/mi-proyecto.json [carpeta-salida]
// Crea PNG para mirar el resultado: hoja de sprites, tiles y una imagen por nivel (con fondo, meta e inicio).
import path from 'node:path';
import { leerProyecto, F, lienzo, pegar, rect, guardarPng, fallar, args } from './lib.mjs';
const { pos } = args(process.argv.slice(2));
if (!pos[0]) fallar('Falta el archivo. Uso: node herramientas/previsualizar.mjs proyectos/mi-proyecto.json [carpeta-salida]');
let P; try { ({ P } = leerProyecto(pos[0])); } catch (e) { fallar(e.message); }
const base = path.basename(pos[0]).replace(/\.json$/, ''), out = pos[1] || path.join('vista-previa', base);
// hoja de sprites x4 con fondo gris
const s = P.size, maxF = Math.max(...F.CLIP_DEFS.map(d => P.clips[d[0]].frames.length)), z = Math.max(1, Math.floor(256 / s));
const sh = lienzo(maxF * s * z, F.CLIP_DEFS.length * s * z, [70, 74, 90]);
F.CLIP_DEFS.forEach((d, r) => P.clips[d[0]].frames.forEach((f, i) => pegar(sh, f, s, s, P.pal, i * s * z, r * s * z, z)));
guardarPng(path.join(out, 'personaje.png'), sh);
// tiles x4
const ts = lienzo(F.NTILES * F.TILE * 4, F.TILE * 4, [70, 74, 90]);
P.tiles.forEach((b, i) => pegar(ts, b, F.TILE, F.TILE, P.pal, i * F.TILE * 4, 0, 4)); guardarPng(path.join(out, 'tiles.png'), ts);
// niveles x2
P.levels.forEach((l, i) => {
  const m = l.map, T = F.TILE, zz = 2, cv = lienzo(m.w * T * zz, m.h * T * zz, F.hexRgb(P.pal[l.bg[0][0]] || '#101018'));
  for (const b of l.bg) for (let ox = 0; ox < m.w * T; ox += F.BGW) pegar(cv, b, F.BGW, F.BGH, P.pal, ox * zz, (m.h * T - F.BGH) * zz, zz);
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) { const id = m.data[y * m.w + x]; if (id) pegar(cv, P.tiles[id - 1], T, T, P.pal, x * T * zz, y * T * zz, zz); }
  const sp = m.spawn; pegar(cv, P.clips.idle.frames[0], s, s, P.pal, (sp[0] * T + T / 2 - s / 2) * zz, ((sp[1] + 1) * T - Math.round(s * 31 / 32)) * zz, zz);
  if (m.goal) { const g = m.goal; rect(cv, (g[0] * T + 7) * zz, (g[1] * T - T + 1) * zz, 2 * zz, 2 * T * zz - zz, [236, 232, 246]); rect(cv, (g[0] * T + 9) * zz, (g[1] * T - T + 1) * zz, 6 * zz, 4 * zz, [255, 107, 148]); }
  guardarPng(path.join(out, 'nivel-' + (i + 1) + '.png'), cv);
});
console.log('✓ Imágenes en ' + out + '/ (personaje.png, tiles.png, nivel-1.png … nivel-' + P.levels.length + '.png)');
