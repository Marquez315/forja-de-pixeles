# Música y sonidos

La pestaña **Música** deja crear canciones al estilo de las consolas retro (NES, Game Boy), ponerles sonido a las acciones del juego y pedirle música o efectos a Claude.ai. Todo se sintetiza en el navegador (`js/musica.js`): no hay archivos de audio que cargar, así que funciona igual en GitHub Pages, en el teléfono y sin conexión.

## Cómo se usa (en la app)

1. **Canciones de ejemplo** → «Agregar» copia una al proyecto (6 de ejemplo: bosque, cueva, ciudad, nieve, jefe y victoria). El botón ▶ la escucha antes.
2. **Editar**: elige una pista (Melodía, Bajo, Batería…) y toca la cuadrícula. Cada columna es un paso, cada fila una nota. Arrastra hacia la derecha para alargar una nota. También se puede editar como texto.
3. **En tu juego**: elige qué canción suena en cada nivel y qué sonido hace cada acción (saltar, aterrizar, colgarse, llegar a la meta…). Se escucha en la pestaña **Probar**.
4. **Pedir a Claude.ai**: describe lo que quieres, copia las instrucciones, pégalas en Claude.ai, pega su respuesta y la app la revisa (con ▶ para escucharla) antes de agregarla. Si la respuesta tiene un error, **Copiar el error para Claude** arma el mensaje para corregirlo. Dentro de Claude (artefacto) aparece **Crear ahora con Claude**.
5. **Exportar**: el ZIP de la pestaña Exportar trae `musica.json`, las canciones en `musica/*.wav`, los efectos en `sonidos/*.wav` y un `game.html` que ya reproduce todo (el navegador pide pulsar una tecla antes de dejar sonar el audio).

## Formato (clave `musica` del proyecto)

```json
"musica": {
  "canciones": [
    { "nombre": "Aventura", "bpm": 132, "pasos_por_pulso": 2, "pasos": 32, "loop": true,
      "pistas": [
        { "nombre": "Melodía", "voz": "pulso25", "vol": 0.5, "notas": "C5 . E5 . G5 - E5 -  F5 - A5 - G5 - E5 .  …" },
        { "nombre": "Batería", "voz": "ruido",   "vol": 0.55, "notas": "k . h . s . h h  …" }
      ] }
  ],
  "sonidos": { "salto": { "onda": "pulso50", "vol": 0.45, "tramos": [[260, 620, 110]] } },
  "eventos": { "salto": "salto", "meta": "meta" },
  "vol": { "m": 0.6, "e": 0.8 }
}
```

Y cada nivel puede traer `"cancion": N` (posición en `musica.canciones`, empezando en 0). Un proyecto sin `musica` se abre con los sonidos básicos y sin canciones.

### Canciones
- `bpm` 50–220. `pasos_por_pulso`: 1, 2 o 4 (normalmente 2: cada paso es una corchea). `pasos`: 8–128 (**32 = 4 compases**). `loop`: si se repite. Máximo 8 canciones y 6 pistas por canción.
- `notas` es un texto con **un paso por palabra**. Debe haber exactamente `pasos` palabras por pista (si no, se ajusta y la app avisa).
  - Pistas con tono: nota = letra + `#` o `b` opcional + octava 1–7 (`C4`, `F#3`, `Bb5`); `.` silencio; `-` alarga la nota anterior un paso más.
  - Pista `ruido` (batería): `k` bombo, `s` caja, `h` hi-hat, `o` hi-hat abierto, `t` tom, `c` platillo, `.` silencio.
- `voz`: `pulso12`, `pulso25`, `pulso50` (cuadradas con distinto timbre), `triangulo`, `sierra`, `seno`, `ruido`.
- `vol` 0–1 por pista. Si el audio satura (`node herramientas/audio.mjs` avisa), baja el volumen de alguna pista.

### Sonidos
- `onda`: igual que `voz`. `vol`: 0.05–1. `tramos`: lista de `[frecuenciaInicial, frecuenciaFinal, milisegundos]`. En cada tramo el tono se desliza de una frecuencia a la otra (20–8000 Hz; `0` = silencio). Hasta 12 tramos y 2,5 s. Máximo 24 sonidos por proyecto (el nombre: minúsculas, números y `_`).
- `eventos` relaciona una acción del juego con un sonido. Acciones: `salto`, `salto_pared`, `aterrizar`, `colgarse`, `meta`, `ganar` (terminar el juego) y `caer` (caer al vacío).

## Para quien programa

- `js/musica.js` no toca el DOM. `makeAudio(M)` es autocontenida (se copia dentro del `game.html` exportado con `makeAudio.toString()`, igual que `makeGame`) y solo usa `AudioContext` cuando se reproduce algo; en Node genera los `.wav` (`cancion(c)`, `sonido(d)`, `wav(f32)`).
- `js/musica-ui.js` es la pantalla. `app.js` solo llama a `audioEvento`, `audioNivel`, `audioParar` y `audioArchivos`.
- El motor del juego avisa de las acciones con `D.sfx('salto')`, etc. Si agregas una acción nueva: llama a `snd('nombre')` en `makeGame` (`js/game.js`), agrégala a `MUS_EVENTOS` y a `musicaPorDefecto`, y crea o asigna su sonido.
- Instrucciones para Claude: `musicaPrompt`; lectura: `musicaParse` + `musicaLeerKit`; aplicar: `musicaApply`. Si cambias el formato, actualiza también `musicaPrompt` y este documento.
- Herramientas: `node herramientas/validar.mjs proyecto.json` avisa de niveles sin música o acciones sin sonido; `node herramientas/audio.mjs proyecto.json` genera los `.wav` en `vista-previa/` y dice cuánto dura cada uno.
