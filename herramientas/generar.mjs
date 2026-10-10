#!/usr/bin/env node
// Crea un proyecto nuevo con personaje, tiles y niveles de ejemplo, y lo guarda en proyectos/.
// Uso: node herramientas/generar.mjs --nombre mi-aventura [--tam 32] [--pelo short|long|helmet] [--colores 7]
//        [--niveles bosque,cueva,torre] [--escenas bosque-nieve,cueva,ciudad-noche] [--semilla 3] [--descripcion "texto"]
// --niveles elige la plantilla de mapa de cada nivel; --escenas elige el fondo de cada uno (en el mismo orden).
import fs from 'node:fs';
import path from 'node:path';
import { F, RAIZ, fallar, args } from './lib.mjs';
const { op } = args(process.argv.slice(2));
if (op.ayuda || !op.nombre) { console.log('Uso: node herramientas/generar.mjs --nombre mi-aventura [--tam 32] [--pelo short|long|helmet] [--colores 7] [--niveles bosque,cueva,torre] [--escenas ...] [--semilla 1] [--descripcion "..."]\nPlantillas de nivel: ' + Object.keys(F.LEVEL_TEMPLATES).join(', ') + '\nEscenas: ' + F.SCENES.map(s => s[0]).join(', ')); process.exit(op.ayuda ? 0 : 1); }
const slug = String(op.nombre).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
if (!slug) fallar('El nombre no es válido.');
const plant = String(op.niveles || 'bosque,cueva,torre').split(',').map(s => s.trim()).filter(Boolean);
const esc = op.escenas ? String(op.escenas).split(',').map(s => s.trim()) : [];
const levels = plant.map((t, i) => ({ template: t, scene: esc[i] || undefined }));
for (const e of esc) if (e && !F.SCENES.some(s => s[0] === e)) fallar('Escena desconocida: ' + e + '. Hay: ' + F.SCENES.map(s => s[0]).join(', '));
let P; try { P = F.newProject({ size: +(op.tam || 32), hair: op.pelo || 'short', colors: op.colores ? +op.colores : 0, levels, seed: +(op.semilla || 1) }); } catch (e) { fallar(e.message); }
const obj = F.projectToObj(P, false);
const archivo = path.join(RAIZ, 'proyectos', slug + '.json');
fs.mkdirSync(path.dirname(archivo), { recursive: true });
fs.writeFileSync(archivo, JSON.stringify({ meta: { nombre: op.nombre === true ? slug : String(op.nombre), descripcion: String(op.descripcion || '') }, ...obj }));
console.log('✓ Creado proyectos/' + slug + '.json (' + P.levels.length + ' niveles). Ahora ejecuta: node herramientas/actualizar-indice.mjs');
