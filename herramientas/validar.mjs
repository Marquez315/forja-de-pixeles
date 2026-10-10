#!/usr/bin/env node
// Uso: node herramientas/validar.mjs proyectos/mi-proyecto.json
// Revisa que el proyecto se pueda abrir en la app y avisa de problemas típicos en los niveles.
import { leerProyecto, F, fallar, args } from './lib.mjs';
const { pos } = args(process.argv.slice(2));
if (!pos[0]) fallar('Falta el archivo. Uso: node herramientas/validar.mjs proyectos/mi-proyecto.json');
let P, obj;
try { ({ P, obj } = leerProyecto(pos[0])); } catch (e) { fallar(e.message); }
let avisos = 0;
const av = m => { avisos++; console.log('  ⚠ ' + m); };
console.log('✓ El archivo se puede abrir. Personaje ' + P.size + '×' + P.size + ', paleta de ' + (P.pal.length - 1) + ' colores, ' + P.levels.length + ' nivel(es).');
for (const c of F.CLIP_DEFS) { const n = P.clips[c[0]].frames.length; if (n === 1 && P.clips[c[0]].frames[0].every(v => !v)) av('El movimiento "' + c[0] + '" está vacío.'); }
P.levels.forEach((l, i) => {
  const m = l.map, solid = new Set(P.solid), at = (x, y) => (x < 0 || x >= m.w || y < 0 || y >= m.h) ? 0 : m.data[y * m.w + x];
  console.log('Nivel ' + (i + 1) + ' «' + l.name + '» ' + m.w + '×' + m.h + ' · escena: ' + (l.scene || 'ninguna'));
  if (solid.has(at(m.spawn[0], m.spawn[1]))) av('El inicio (' + m.spawn + ') está dentro de un tile sólido.');
  let suelo = false; for (let y = m.spawn[1]; y < m.h; y++) if (solid.has(at(m.spawn[0], y))) { suelo = true; break; }
  if (!suelo) av('Bajo el inicio no hay suelo: el personaje caería al vacío.');
  if (!m.goal) av(i < P.levels.length - 1 ? 'No tiene meta: no se podrá pasar al nivel siguiente.' : 'No tiene meta: el juego no tiene final.');
  else if (solid.has(at(m.goal[0], m.goal[1]))) av('La meta (' + m.goal + ') está dentro de un tile sólido.');
  const sinSolido = [...new Set(Array.from(m.data))].filter(v => v && !solid.has(v) && !P.tiles[v - 1].some(x => x)); if (sinSolido.length) av('Usa tiles vacíos (sin dibujo): ' + sinSolido.join(', '));
  if (!l.bg.some(b => b.some(v => v))) av('El fondo está vacío: añade "scene" (' + F.SCENES.map(s => s[0]).join(', ') + ') o un "bg".');
});
const mus = P.music;
console.log('Música: ' + mus.canciones.length + ' canción(es), ' + Object.keys(mus.sonidos).length + ' sonido(s).');
if (mus.canciones.length) P.levels.forEach((l, i) => { if (!Number.isInteger(l.cancion)) av('El nivel ' + (i + 1) + ' «' + l.name + '» no tiene música asignada.'); });
for (const [ev] of F.MUS_EVENTOS) if (!mus.eventos[ev]) av('La acción «' + ev + '» no tiene sonido asignado.');
if (obj.musica) {
  const n = (obj.musica.canciones || []).length - mus.canciones.length, m = Object.keys(obj.musica.sonidos || {}).length - Object.keys(mus.sonidos).length;
  if (n > 0) av(n + ' canción(es) del archivo se descartaron por tener errores (revisa docs/MUSICA.md).');
  if (m > 0) av(m + ' sonido(s) del archivo se descartaron por tener errores (revisa docs/MUSICA.md).');
}
console.log(avisos ? '\n' + avisos + ' aviso(s). Revísalos; puede que sean intencionales.' : '\nTodo en orden.');
