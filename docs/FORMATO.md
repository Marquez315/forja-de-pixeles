# Formato de proyecto `forja-pixel-2`

Un proyecto es un único JSON. Todo lo dibujado se guarda como **filas de texto**, así se puede leer, escribir y revisar sin herramientas especiales.

```json
{
  "meta": { "nombre": "Mi aventura", "descripcion": "Texto para la galería" },
  "format": "forja-pixel-2",
  "size": 32,
  "palette": ["#1b1426", "#f2b88c", "..."],
  "clips": {
    "idle": { "fps": 3, "loop": true, "frames": [ ["....", "...."], ["....", "...."] ] }
  },
  "tile": 16,
  "tiles": [ ["................", "..."] ],
  "solid": [1, 2, 3, 4, 5, 7],
  "gen": { "hair": "short", "outline": true },
  "levels": [
    {
      "name": "Bosque", "scene": "bosque-dia", "seed": 1,
      "map": { "w": 40, "h": 18, "spawn": [2, 14], "goal": [37, 4], "rows": ["...", "..."] }
    }
  ]
}
```

## Campos
- `meta`: opcional; solo lo usa la galería (`proyectos/index.json`). La app no lo conserva al volver a guardar: se agrega a mano o con `generar.mjs`.
- `size`: 16, 24, 32, 48 o 64.
- `palette`: de 22 a 81 colores `#rrggbb`. El color número 1 es el primero de la lista.
- **Caracteres**: `.` es transparente. Después, en orden: `1 2 3 4 5 6 7 8 9`, `a`–`z`, `A`–`Z`, `0`, `! # $ % & * + - / : ; < = > ? @ ^ ~` (los colores 1 a 81). En los mapas, `1-9 a-g` son los tiles 1 a 16.
- `clips`: `idle, walk, run, jump, fall, wallhang, wallclimb`. Hasta 16 frames cada uno; `fps` de 1 a 24; cada frame tiene `size` filas de `size` caracteres.
- `tiles`: hasta 16 tiles de 16×16. `solid`: números de tile (1-16) que bloquean al personaje.
- `levels`: de 1 a 20. En cada nivel:
  - `map.rows`: `h` filas de `w` caracteres. `.` vacío; `1-9 a-g` tiles; `S` inicio; `M` meta. También se aceptan `map.spawn` y `map.goal` como `[x, y]` en tiles.
  - `scene`: una de `bosque-dia, bosque-tarde, bosque-noche, ciudad-tarde, ciudad-noche, cueva, ciudad-dia, bosque-nieve, bosque-otono` (o `personalizada` si hay `theme`). Si no hay `bg`, el fondo se genera con esta escena y `seed`.
  - `theme` (opcional): colores propios para el fondo generado: `{ "kind": "bosque|ciudad|cueva", "sky": [4 colores], "cloud": [2], "orb": "#…", "far": [2], "hill": [2], "tree": [2], "bld": [2], "win": "#…", "estrellas": false }`. Solo `kind` es obligatorio; lo que falte se completa solo. Si hay `theme`, la escena pasa a ser `"personalizada"`. Detalle en `docs/IA.md`.
  - `cancion` (opcional): número de la canción de `musica.canciones` (desde 0) que suena en el nivel.
  - `bg` (opcional): `{ "w": 256, "h": 144, "layers": [cielo, lejos, cerca] }`, cada capa con 144 filas de 256 caracteres. Se repite en horizontal.

- `musica` (opcional): canciones, sonidos y qué sonido hace cada acción del juego. Formato completo en `docs/MUSICA.md`. Los proyectos sin `musica` se abren con los sonidos básicos y sin canciones.

## Compatibilidad
Los archivos antiguos `forja-pixel-1` (un solo mapa en `map`, fondo en `bg`) se abren como un proyecto de un nivel.

## Al exportar un ZIP
`musica.json` guarda la música del proyecto, `musica/` trae las canciones en .wav y `sonidos/` los efectos en .wav.
`levels.json` guarda cada nivel con `data` (tiles por filas, 0 = vacío), `spawn`, `goal` y los nombres de sus tres fondos `bg_N_cielo.png`, `bg_N_lejos.png`, `bg_N_cerca.png`.
