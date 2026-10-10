# Instrucciones para Claude: Forja de Píxeles

App web estática (sin build, sin dependencias) para hacer pixel art de videojuegos. Se publica tal cual en GitHub Pages. Idioma de la app, los textos y los commits: **español**.

## Reglas generales
- No agregues frameworks ni pasos de compilación. Todo es HTML + CSS + JavaScript simple.
- `js/core.js`, `js/game.js`, `js/ia.js` y `js/musica.js` no pueden tocar el DOM: las herramientas de Node los cargan tal cual.
- `makeGame` en `js/game.js` se copia dentro del `game.html` exportado (`makeGame.toString()`): debe seguir siendo una función autocontenida (solo usa `D` y sus propias funciones).
- `makeAudio` en `js/musica.js` también se copia dentro del `game.html` exportado (`makeAudio.toString()`): debe seguir autocontenida (no usa nada de fuera, salvo `AudioContext` al reproducir).
- El pie de página de `index.html` («Creado para la educación» y los créditos a @codeclubnanduti y @didactica_aumentada3.0) y la última línea del README no se quitan ni se cambian.
- Después de cambiar cualquier archivo del sitio, sube `VERSION` en `sw.js`.
- Formato de proyecto: ver `docs/FORMATO.md`. Los cambios al formato deben seguir leyendo proyectos viejos (`objToProject` ya acepta `forja-pixel-1`).

## Crear o cambiar contenido (lo más común)
Los proyectos viven en `proyectos/*.json`. Para tocarlos:

1. Edita el JSON (o genera uno con `node herramientas/generar.mjs --ayuda`).
2. `node herramientas/validar.mjs proyectos/X.json` debe terminar en "Todo en orden".
3. `node herramientas/alcanzable.mjs proyectos/X.json` debe decir ✓ en cada nivel. Si falla, ajusta el nivel (ver medidas abajo).
4. `node herramientas/previsualizar.mjs proyectos/X.json` y mira los PNG de `vista-previa/` antes de dar el trabajo por terminado.
5. `node herramientas/actualizar-indice.mjs` si agregaste o renombraste un proyecto. Pon `meta.nombre` y `meta.descripcion` en el JSON.

### Niveles
- En `map.rows`: `.` vacío, `1-9 a-g` = tiles 1 a 16, `S` inicio, `M` meta. Todas las filas con el mismo largo (`w`), y exactamente `h` filas. Ancho 16-120, alto 9-60.
- Si el nivel no trae `bg` pero sí `scene`, el fondo se genera solo. Escenas: `bosque-dia, bosque-tarde, bosque-noche, ciudad-tarde, ciudad-noche, cueva, ciudad-dia, bosque-nieve, bosque-otono`. Usa `seed` (1-99) para variar.
- Deja siempre suelo bajo el inicio y una meta alcanzable. Para pasar de nivel hace falta meta; en el último, la meta termina el juego.
- Medidas del salto (medidas con el motor): sube hasta 3 tiles como máximo (cómodo: 2); camina ≈ 3 tiles de distancia, corre ≈ 5 (cómodo: pozos de 3 corriendo 4 como mucho). En el aire contra una pared el personaje se cuelga, trepa con ↑ y salta de pared con salto.
- Tiles sólidos por defecto: 1, 2, 3, 4, 5 y 7. El 6 (flor) es decorativo.

### Personajes
- Tamaños: 16, 24, 32, 48 o 64. Siete movimientos: `idle, walk, run, jump, fall, wallhang, wallclimb`. Todos miran a la derecha; en `wallhang` y `wallclimb` la pared está a la derecha.
- Cada frame son filas de texto del tamaño exacto del sprite. `.` transparente; los demás caracteres son colores de la paleta (índice 1 = `1`, …, ver `PAL_CHARS` en `core.js`).
- Los colores 1-22 de la paleta están reservados para el personaje y los tiles base (`BASE_PAL`): piel 2-3, pelo 4, ropa 5-8, botas 9, contorno 1. Para un personaje distinto, cambia esos colores o agrega colores nuevos al final de `palette`.
- Para el generador automático: `genCharacter` en `core.js` (peinados `short`, `long`, `helmet`).

### Crear con IA (pestaña «Crear con IA»)
- Lógica en `js/ia.js` (instrucciones para Claude, lectura de la respuesta, comprobador de niveles) y pantalla en `js/app.js`/`index.html`. Formato del «paquete» y reglas: `docs/IA.md`.
- Si cambias el formato del proyecto (nuevos campos, tiles, movimientos, escenas), actualiza también `iaPrompt` y `iaApply`, y la explicación de `docs/IA.md`; así Claude.ai sigue pidiendo y recibiendo lo correcto.
- Los fondos pueden llevar colores propios con `theme` (ver `docs/FORMATO.md`); `cleanTheme` en `core.js` lo valida.

### Música y sonidos
- Datos en `musica` del proyecto (canciones, sonidos, eventos, volumen) y `cancion` en cada nivel. Formato y reglas: `docs/MUSICA.md`. Lógica en `js/musica.js` (sintetizador, validación, `musicaPrompt`) y pantalla en `js/musica-ui.js`.
- Para componer o editar a mano: las `notas` de cada pista llevan exactamente `pasos` palabras. Comprueba con `node herramientas/validar.mjs proyectos/X.json` y escucha el resultado generando los `.wav` con `node herramientas/audio.mjs proyectos/X.json`.
- Si agregas una acción al juego, avisa del sonido desde `makeGame` con `snd('nombre')` y suma la acción a `MUS_EVENTOS`.

### Fondos y escenas nuevas
- Temas de color: `THEMES` en `core.js` (y `theme` por nivel para colores propios; los tipos de dibujo están en `SCENE_KINDS`). Escenas: `SCENES` (clave, nombre, tema, tipo). Los tipos de dibujo son `bosque`, `ciudad` y `cueva` (función `genScene`). Para un tipo nuevo, agrega una rama en `genScene` que llene las capas `sky`, `far` y `near` (256×144, deben repetirse sin cortes en horizontal).
- Un fondo dibujado a mano va en `bg.layers`: 3 capas (cielo, lejos, cerca) de 144 filas de 256 caracteres.

## Verificar la app en un navegador
Con `python3 -m http.server 8000` y Playwright se puede abrir `http://localhost:8000`, pasar por las pestañas (Dibujar, Crear con IA, Mapa, Música, Probar y Exportar) y mirar la consola: no debe haber errores (salvo fallar al cargar Google Fonts si no hay red).
