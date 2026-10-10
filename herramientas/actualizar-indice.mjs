#!/usr/bin/env node
// Uso: node herramientas/actualizar-indice.mjs
// Revisa cada archivo de proyectos/*.json y vuelve a escribir proyectos/index.json (la lista que muestra la app en Exportar).
// El nombre y la descripción salen del campo "meta" del proyecto; si falta, se usa el nombre del archivo.
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ, F } from './lib.mjs';
const dir = path.join(RAIZ, 'proyectos'), lista = [];
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'index.json').sort()) {
  try { const o = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); F.objToProject(o);
    lista.push({ nombre: (o.meta && o.meta.nombre) || f.replace(/\.json$/, ''), descripcion: (o.meta && o.meta.descripcion) || '', archivo: f }); }
  catch (e) { console.log('⚠ Se omite ' + f + ': ' + e.message); }
}
fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify({ proyectos: lista }, null, 2) + '\n');
console.log('✓ index.json con ' + lista.length + ' proyecto(s): ' + lista.map(p => p.archivo).join(', '));
