# Forja de Píxeles

Editor de pixel art para hacer juegos, sin instalar nada: dibujas un **personaje animado**, los **tiles**, los **fondos con parallax** y arma **varios niveles** con inicio y meta. También compones la **música y los sonidos** del juego. Después lo pruebas ahí mismo, con salto, colgarse y trepar paredes, y con sonido.

Está pensado para publicarse en **GitHub Pages** y para seguir mejorándolo con **Claude**: crear personajes y fondos distintos, niveles nuevos, más escenas.

**Crear con IA:** la pestaña **Crear con IA** arma las instrucciones para Claude.ai (personaje, tiles, fondos, niveles), tú pegas lo que responda y la app lo carga con vista previa. No necesita claves ni servidores: funciona en cualquier navegador, también como app instalada.

**Música y sonidos:** la pestaña **Música** trae canciones y sonidos de ejemplo para agregar con un clic, un editor de notas (tocas la cuadrícula y suena), y deja pedirle música y efectos a Claude.ai con el mismo método de copiar y pegar. Cada nivel puede tener su canción y cada acción (saltar, aterrizar, llegar a la meta…) su sonido. Todo se escucha en **Probar** y viaja en el ZIP y en el `game.html` exportados. Detalles: `docs/MUSICA.md`.

## Publicarlo en GitHub Pages

1. Crea un repositorio nuevo en GitHub (por ejemplo `forja-de-pixeles`) y sube **todo el contenido de esta carpeta** (con `index.html` en la raíz).
2. En el repositorio: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, rama `main`, carpeta `/ (root)`. Guarda.
3. En un minuto aparece la dirección `https://TU-USUARIO.github.io/forja-de-pixeles/`.
4. En el teléfono, ábrela con Chrome (**Instalar app**) o con Safari (**Compartir → Añadir a pantalla de inicio**). Después de la primera visita funciona también sin internet.

> Si cambias archivos del sitio, sube el número de `VERSION` en `sw.js` para que los dispositivos descarguen la versión nueva.

## Probarlo en tu computadora

El navegador no deja cargar la galería con doble clic. Desde esta carpeta:

```
python3 -m http.server 8000
```

y abre `http://localhost:8000` (en Windows: `py -m http.server 8000`).

## Cómo está organizado

| Carpeta o archivo | Para qué sirve |
|---|---|
| `index.html`, `css/app.css` | La pantalla de la app |
| `js/core.js` | Lógica pura: paleta, generador de personaje, tiles, fondos, niveles, guardado |
| `js/game.js` | El motor del juego (física, cámara, meta, niveles) |
| `js/musica.js` | Música y sonidos: sintetizador chiptune, formato, ejemplos y las instrucciones para Claude |
| `js/musica-ui.js` | La pestaña Música: editor de notas, ejemplos, sonidos, Claude.ai y descargas |
| `js/ia.js` | Crear con IA: instrucciones para Claude, lectura de su respuesta y comprobador de niveles |
| `js/app.js` | Los botones y pestañas: dibujar, crear con IA, mapa, probar, exportar |
| `proyectos/` | Proyectos guardados (JSON). La app los lista en **Exportar → Proyectos del repositorio** |
| `herramientas/` | Programas de Node para validar, previsualizar y generar proyectos |
| `docs/FORMATO.md` | Cómo es un proyecto por dentro (para escribirlo a mano o con Claude) |
| `docs/IA.md` | Cómo funciona «Crear con IA» y el formato de la respuesta de Claude |
| `docs/MUSICA.md` | Cómo funcionan la música y los sonidos, y su formato |
| `CLAUDE.md` | Instrucciones para que Claude trabaje en este repositorio |
| `sw.js`, `manifest.webmanifest`, `icons/` | Lo que permite instalarla y usarla sin conexión |

## Flujo de trabajo

1. En la app: dibuja o genera el personaje, los tiles, los fondos y los niveles.
2. **Exportar → Proyecto .json (para el repo)** y guarda el archivo en `proyectos/`.
3. Ejecuta `node herramientas/actualizar-indice.mjs` para que aparezca en la galería.
4. Sube los cambios a GitHub.

Tus proyectos también se guardan solos en el navegador donde trabajas; no se comparten entre dispositivos. Para pasarlos de uno a otro usa **Exportar → Proyecto .json** y **Importar**.

## Herramientas (necesitan Node 18 o más nuevo)

```
node herramientas/validar.mjs proyectos/robot-nieve.json        # ¿se abre? ¿hay inicio, meta y suelo?
node herramientas/alcanzable.mjs proyectos/robot-nieve.json     # un robot intenta llegar a la meta de cada nivel
node herramientas/previsualizar.mjs proyectos/robot-nieve.json  # crea PNG en vista-previa/ para mirar el resultado
node herramientas/generar.mjs --nombre mi-aventura --pelo long --colores 5 --escenas bosque-nieve,cueva
node herramientas/audio.mjs proyectos/robot-nieve.json          # genera los .wav de la música y los sonidos
node herramientas/actualizar-indice.mjs                         # reescribe proyectos/index.json
```

## Crear con IA, paso a paso

1. Abre la pestaña **Crear con IA**, marca qué quieres (por ejemplo «Juego completo») y descríbelo con tus palabras.
2. **Copiar instrucciones** y pégalas en un chat nuevo de [Claude.ai](https://claude.ai/new).
3. Copia la respuesta de Claude, pégala en el paso 4 y pulsa **Revisar respuesta**. Verás el personaje, los tiles y cada nivel con su fondo.
4. **Aplicar al proyecto**. Si no te gusta, **Deshacer lo aplicado**; y si Claude se equivocó en algo, **Copiar el error para Claude** y se lo devuelves para que lo corrija.

Dentro de Claude (publicada como artefacto) aparece además **Crear ahora con Claude**, que lo hace todo en un clic.

## Pedirle cosas a Claude

Con el repositorio abierto en Claude (Claude Code, o pegando archivos en el chat), puedes pedir por ejemplo:

- «Crea un nivel de hielo con saltos largos y una pared para trepar, y agrégalo a `robot-nieve`.»
- «Dibuja un personaje nuevo: una bruja con sombrero, de 32 px, con los 7 movimientos.»
- «Agrega una escena de desierto al generador de fondos.»
- «Revisa que todos los niveles se puedan pasar.»
- «Compón una canción tensa para el nivel de la cueva y un sonido para cuando recojo una gema.»

`CLAUDE.md` le explica cómo hacerlo y cómo comprobar su propio trabajo con las herramientas.

---

Creado para la educación.

Créditos: [@codeclubnanduti](https://www.instagram.com/codeclubnanduti/#) · [@didactica_aumentada3.0](https://www.instagram.com/didactica_aumentada3.0/#)
