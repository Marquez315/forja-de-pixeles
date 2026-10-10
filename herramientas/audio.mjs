#!/usr/bin/env node
// Uso: node herramientas/audio.mjs proyectos/mi-proyecto.json [carpeta-de-salida]
// Genera los .wav de todas las canciones y sonidos del proyecto (por defecto en vista-previa/<proyecto>/audio/)
// y escribe cuánto dura cada uno, para comprobar la música sin abrir el navegador.
import fs from 'node:fs';
import path from 'node:path';
import { leerProyecto, F, RAIZ, fallar, args } from './lib.mjs';
const { pos } = args(process.argv.slice(2));
if (!pos[0]) fallar('Falta el archivo. Uso: node herramientas/audio.mjs proyectos/mi-proyecto.json [carpeta]');
let P; try { ({ P } = leerProyecto(pos[0])); } catch (e) { fallar(e.message); }
const sal = pos[1] || path.join(RAIZ, 'vista-previa', path.basename(pos[0], '.json'), 'audio');
fs.mkdirSync(sal, { recursive: true });
const A = F.makeAudio(P.music), nombre = t => F.musicaIdLibre({}, t);
let n = 0;
P.music.canciones.forEach((c, i) => {
  const f = A.cancion(c), pico = f.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  fs.writeFileSync(path.join(sal, 'cancion_' + (i + 1) + '_' + nombre(c.nombre) + '.wav'), A.wav(f)); n++;
  console.log('♪ ' + c.nombre + ': ' + (f.length / A.RATE).toFixed(1) + ' s, ' + c.bpm + ' bpm, ' + c.pistas.length + ' pistas' + (c.loop ? ', en bucle' : '') + (pico > 0.98 ? ' ⚠ suena saturada: baja el volumen de alguna pista' : ''));
});
for (const k of Object.keys(P.music.sonidos)) {
  const f = A.sonido(P.music.sonidos[k]); fs.writeFileSync(path.join(sal, 'sonido_' + k + '.wav'), A.wav(f)); n++;
  console.log('• ' + k + ': ' + Math.round(f.length / A.RATE * 1000) + ' ms');
}
console.log('✓ ' + n + ' archivo(s) .wav en ' + sal);
