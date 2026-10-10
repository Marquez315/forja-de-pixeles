#!/usr/bin/env node
// Uso: node herramientas/alcanzable.mjs proyectos/mi-proyecto.json [número-de-nivel] [--limite 300000]
// Un "robot" prueba combinaciones de teclas con el mismo motor del juego y busca si se puede llegar de INICIO a META.
// Si dice "sí", el nivel se puede pasar. Si dice "no se encontró", puede ser imposible o muy difícil: míralo y ajústalo.
import vm from 'node:vm';
import { leerProyecto, F, fallar, args } from './lib.mjs';
const { pos, op } = args(process.argv.slice(2));
if (!pos[0]) fallar('Falta el archivo. Uso: node herramientas/alcanzable.mjs proyectos/mi-proyecto.json [nivel]');
let P; try { ({ P } = leerProyecto(pos[0])); } catch (e) { fallar(e.message); }
const limite = +(op.limite || 300000);
const stub = new Proxy({}, { get: (t, k) => k === 'measureText' ? () => ({ width: 10 }) : () => {}, set: () => true });
const canvas = { getContext: () => stub, width: 0, height: 0 };
const clips = {}; F.CLIP_DEFS.forEach((d, i) => clips[d[0]] = { row: i, frames: 2, fps: 6, loop: true });
const acts = []; for (const d of [-1, 0, 1]) for (const run of [0, 1]) for (const jump of [0, 1]) for (const up of [0, 1]) acts.push({ d, run, jump, up });

class Heap { constructor() { this.a = []; } get length() { return this.a.length; }
  push(x) { const a = this.a; a.push(x); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p].f <= a[i].f) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a, t = a[0], l = a.pop(); if (a.length) { a[0] = l; let i = 0; for (;;) { let m = i; const L = 2 * i + 1, R = L + 1; if (L < a.length && a[L].f < a[m].f) m = L; if (R < a.length && a[R].f < a[m].f) m = R; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return t; } }

function resolver(li) {
  const L = P.levels[li], m = L.map;
  if (!m.goal) return { ok: false, motivo: 'el nivel no tiene meta' };
  const D = { vw: F.BGW, vh: F.BGH, tile: F.TILE, size: P.size, clips, solid: P.solid, start: 0,
    levels: [{ name: L.name, map: { w: m.w, h: m.h, data: Array.from(m.data), spawn: m.spawn, goal: null }, bgs: [] }] };
  const g = F.makeGame(canvas, D); g.reset();
  const T = F.TILE, gx = m.goal[0] * T + T / 2, gy = (m.goal[1] + 1) * T, hbh = Math.round(P.size * 0.8);
  const key = s => [Math.round(s.p.x / 3), Math.round(s.p.y / 3), Math.round(s.p.vx * 2), Math.round(s.p.vy), s.p.ground ? 1 : 0, s.p.cling, s.jumpPrev, s.p.lock > 0 ? 1 : 0].join(',');
  const h = s => Math.abs(s.p.x - gx) + Math.abs(s.p.y - gy) * 1.3;
  const ini = g.save(), open = new Heap(), seen = new Set([key(ini)]);
  open.push({ s: ini, f: h(ini), n: 0 });
  const setK = a => { g.setKey('left', a.d < 0); g.setKey('right', a.d > 0); g.setKey('run', a.run); g.setKey('jump', a.jump); g.setKey('up', a.up); };
  let it = 0, mejor = 1e9;
  while (open.length && it < limite) {
    const cur = open.pop(); it++;
    for (const a of acts) {
      g.load(cur.s); setK(a); for (let k = 0; k < 5; k++) g.tick();
      const st = g.save(), p = st.p;
      if (p.y > m.h * T + 80) continue;
      if (Math.abs(p.x - gx) < 14 && p.y > m.goal[1] * T - T && p.y - hbh < (m.goal[1] + 1) * T) return { ok: true, pasos: cur.n + 1, it };
      const k2 = key(st); if (seen.has(k2)) continue; seen.add(k2);
      const hv = h(st); mejor = Math.min(mejor, hv); open.push({ s: st, f: hv + cur.n * 0.15, n: cur.n + 1 });
    }
  }
  return { ok: false, it, mejor: Math.round(mejor), motivo: open.length ? 'se alcanzó el límite de búsqueda' : 'se agotaron las posibilidades' };
}
const niveles = pos[1] ? [(+pos[1]) - 1] : P.levels.map((_, i) => i);
let fallos = 0;
for (const i of niveles) {
  if (!P.levels[i]) fallar('No existe el nivel ' + (i + 1));
  const t = Date.now(), r = resolver(i), seg = ((Date.now() - t) / 1000).toFixed(1);
  if (r.ok) console.log('✓ Nivel ' + (i + 1) + ' «' + P.levels[i].name + '»: se puede llegar a la meta (~' + Math.round(r.pasos * 5 / 60) + ' s de juego, búsqueda ' + seg + ' s).');
  else { fallos++; console.log('✗ Nivel ' + (i + 1) + ' «' + P.levels[i].name + '»: no se encontró camino (' + r.motivo + (r.mejor !== undefined ? '; lo más cerca que llegó: ' + r.mejor + ' px' : '') + '). Revisa saltos largos, paredes sin agarre o plataformas muy altas.'); }
}
process.exit(fallos ? 1 : 0);
