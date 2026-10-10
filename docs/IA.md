# Crear con IA (Claude)

La pestaña **Crear con IA** deja que Claude diseñe personajes, tiles, fondos y niveles sin que la persona tenga que escribir JSON. Funciona en cualquier navegador (GitHub Pages, el teléfono, sin conexión) porque el puente es un texto que se copia y se pega:

1. La persona marca qué quiere (personaje, tiles, fondos, niveles) y lo describe.
2. **Copiar instrucciones**: `iaPrompt` (en `js/ia.js`) arma un texto con el formato exacto, la paleta actual, las medidas de salto y un ejemplo de nivel.
3. Se pega en un chat de Claude.ai. Claude responde con **un solo JSON** (el "paquete").
4. Se pega la respuesta en la app. `iaParse` + `iaApply` la aplican a una **copia** del proyecto, se muestra una vista previa y, si todo está bien, **Aplicar al proyecto**. Hay **Deshacer lo aplicado**.
5. Si la respuesta tiene errores, la app dice cuál es y ofrece **Copiar el error para Claude** para que lo corrija.

Si la app corre dentro de Claude (artefacto), aparece además **Crear ahora con Claude**, que hace los pasos 2–4 sola.

## El paquete (respuesta de Claude)

Todas las claves son opcionales; solo se piden las que la persona marcó.

```json
{
  "personaje": {
    "size": 32,
    "peinado": "short | long | helmet",
    "contorno": true,
    "colores": { "piel": "#f2b88c", "piel_sombra": "#d58f6a", "pelo": "#5a3a2a", "ropa": "#3f7fd9", "ropa_sombra": "#2d5aa8",
                 "pantalon": "#3a3d6e", "pantalon_sombra": "#2a2c52", "botas": "#6b3f2a", "cinturon": "#e0b13a", "contorno": "#1b1426" },
    "movimientos": { "idle": { "fps": 3, "loop": true, "frames": [ ["…size filas de size caracteres…"] ] } }
  },
  "colores_nuevos": ["#ff00aa"],
  "tiles": { "dibujos": { "8": ["…16 filas de 16…"] }, "solidos": [1, 2, 3, 4, 5, 7, 8] },
  "fondos": [ { "nivel": 1, "tema": { "kind": "bosque", "sky": ["#…","#…","#…","#…"] }, "semilla": 7 } ],
  "niveles": [ { "name": "Pantano", "theme": { "kind": "bosque" }, "seed": 4, "map": { "w": 40, "h": 18, "rows": ["…"] } } ],
  "nota": "Una frase para la persona."
}
```

Reglas de `iaApply`:

- **`personaje`**: si trae `size`, `peinado` o `contorno`, la app regenera los 7 movimientos con el esqueleto base (`genCharacter`) y después aplica `colores` y los `movimientos` dibujados a mano. Si solo trae `colores`, conserva los dibujos y recolorea los índices 1–9 y 11. Los movimientos que Claude no dibuja los anima la app.
- **`colores_nuevos`**: se agregan al final de la paleta (máximo 16). Las instrucciones dicen con qué carácter se escribe cada uno. Si la paleta cambió entre copiar y pegar, la app reasigna esos caracteres sola.
- **`tiles`**: `dibujos` reemplaza los tiles indicados (1–16); `solidos` es la lista completa de tiles que bloquean.
- **`fondos`**: cambia el fondo de niveles que ya existen (`nivel` cuenta desde 1) con un `tema` de colores o con una `scene` conocida.
- **`niveles`**: se agregan al final (o el primero reemplaza el nivel actual si se elige así). Máximo 20 niveles. Se muestran avisos (sin suelo bajo el inicio, sin meta, tiles sin dibujo…) y hay un botón para que un robot compruebe que se puede pasar (`iaAlcanzable`, el mismo método de `herramientas/alcanzable.mjs`; puede tardar hasta un minuto).
- Un `bg` dibujado a mano no se acepta de Claude (son 110 mil caracteres); para fondos propios se usa `tema`.

## Tema de fondo (`theme`)

Un nivel (y `fondos[].tema`) puede traer colores propios en vez de una `scene` ya hecha. Los tipos de dibujo (`kind`) son los de `genScene`: `bosque`, `ciudad` y `cueva`.

| Clave | Qué es |
|---|---|
| `kind` | `bosque`, `ciudad` o `cueva` (obligatorio) |
| `sky` | 4 colores del cielo, de arriba abajo |
| `cloud` | 2 colores de nube (luz y sombra) |
| `orb` | sol, luna o estrellas |
| `far` | 2 colores de montañas o edificios lejanos |
| `hill` | 2 colores de colinas cercanas |
| `tree` | 2 colores de árboles |
| `bld` | 2 colores de edificios cercanos |
| `win` | ventanas encendidas o cristales |
| `estrellas` | `true` para cielo con estrellas (de noche) |

Lo que falte se completa con un tema base. Al guardar, el nivel conserva `scene: "personalizada"` y su `theme`, así el fondo se regenera igual en el repositorio.

## Para ampliar

- **Otro tipo de escenario** (desierto, mar, espacio…): agrega una rama en `genScene` (`js/core.js`) y su nombre a `SCENE_KINDS`; después súmalo a la explicación de `fondos` en `iaPrompt`.
- **Enemigos u objetos**: el formato de proyecto todavía no los tiene. Habría que agregarlos a `docs/FORMATO.md`, a `core.js` (guardar/leer), al motor `game.js` y luego a `iaPrompt`/`iaApply`.
