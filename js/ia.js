'use strict';
/* ========================================================================
   ia.js · crear con IA (Claude). Lógica pura, sin DOM (también se puede cargar en Node).
   1) iaPrompt: arma las instrucciones que la persona pega en Claude.ai (o que la app envía directo si corre dentro de Claude).
   2) iaParse + iaApply: leen la respuesta de Claude (un JSON "paquete") y la aplican a un proyecto.
   3) iaAlcanzable: un robot comprueba que cada nivel nuevo se pueda pasar.
   Formato del paquete: docs/IA.md
   ======================================================================== */
const IA_ROLES={piel:2,piel_sombra:3,pelo:4,ropa:5,ropa_sombra:6,pantalon:7,pantalon_sombra:8,botas:9,cinturon:11,contorno:1};
const IA_CLIP_MIN={idle:2,walk:4,run:4,jump:3,fall:2,wallhang:2,wallclimb:4};
const IA_MAX_NUEVOS=16;

/* ---------- instrucciones para Claude ---------- */
/* o: {descripcion, personaje:{size}, movimientos:[nombres], tiles:'vacios'|'base'|'todos', fondos:'actual'|'todos', niveles:{n,w,h,dificultad}}
   Una sección está activa cuando su clave existe en o. Devuelve {texto, base} (base = cantidad de colores de la paleta al armar el texto). */
function iaPrompt(P,o){
  const base=P.pal.length-1,sec=[],pc=o.personaje,mv=(o.movimientos||[]).filter(n=>IA_CLIP_MIN[n]);
  const legend=[];for(let i=1;i<P.pal.length;i++)legend.push(PAL_CHARS[i-1]+'='+P.pal[i]);
  const libres=[];for(let k=0;k<Math.min(IA_MAX_NUEVOS,MAXPAL-base);k++)libres.push(PAL_CHARS[base+k]);
  const sizeTxt=pc&&pc.size&&pc.size!==P.size?pc.size:P.size;
  const quiere=[];if(pc)quiere.push('un personaje');if(o.tiles)quiere.push('tiles');if(o.fondos)quiere.push('fondos');if(o.niveles)quiere.push('niveles');
  const unir=a=>a.length>1?a.slice(0,-1).join(', ')+' y '+a[a.length-1]:a.join('');

  let n=1;
  if(pc){
    sec.push('### '+(n++)+'. Personaje (clave `personaje`)\n'+
      'Diseña el personaje: su aspecto, su paleta y su estilo. La app ya sabe dibujar el esqueleto con los 7 movimientos (quieto, caminar, correr, saltar, caer, colgarse de pared, trepar); tú decides cómo se ve.\n'+
      '- `size`: 16, 24, 32, 48 o 64 (usa '+sizeTxt+').\n'+
      '- `peinado`: `short`, `long` o `helmet` (el casco usa grises de piedra).\n'+
      '- `contorno`: true o false (borde oscuro alrededor).\n'+
      '- `colores`: objeto con `#rrggbb` para `piel`, `piel_sombra`, `pelo`, `ropa`, `ropa_sombra`, `pantalon`, `pantalon_sombra`, `botas`, `cinturon` y, si quieres, `contorno`. Las sombras deben ser algo más oscuras que su color base.\n'+
      (mv.length?'\nAdemás, dibuja **a mano** estos movimientos en `personaje.movimientos`: '+mv.map(x=>'`'+x+'`').join(', ')+'.\n'+
        '- Cada movimiento es `{"fps":N,"loop":true|false,"frames":[ frame, frame, … ]}` y cada frame es una lista de '+sizeTxt+' filas de texto de '+sizeTxt+' caracteres.\n'+
        '- Frames mínimos por movimiento: '+mv.map(x=>x+' '+IA_CLIP_MIN[x]).join(', ')+' (máximo 16). Entre un frame y el siguiente mueve piernas y brazos, no cambies la silueta ni la paleta.\n'+
        '- Todos los frames miran a la **derecha**. En `wallhang` y `wallclimb` la pared está a la **derecha** del personaje y las manos van hacia ella.\n'+
        '- Los pies tocan la fila inferior del dibujo y el personaje queda centrado en horizontal.\n'+
        '- Para dibujarlo usa los caracteres de los roles de color (tabla de abajo): `1` contorno, `2` piel, `3` piel sombra, `4` pelo, `5` ropa, `6` ropa sombra, `7` pantalón, `8` pantalón sombra, `9` botas, `b` dorado. Si usas `colores`, esos mismos caracteres tomarán tus colores.\n'+
        '- Si cambias `size` respecto del actual, dibuja todos los movimientos que quieras conservar con ese tamaño; los que no incluyas los hará la app con el esqueleto base.\n'+
        (P.size===sizeTxt?'\nReferencia: así está ahora el primer frame de `idle` (úsalo para respetar proporciones y posición):\n```\n'+bufRows(P.clips.idle.frames[0],P.size,P.size).join('\n')+'\n```\n':'')
        :'\nNo dibujes frames: la app genera los movimientos sola. No incluyas `movimientos`.\n'));
  }
  if(o.tiles){
    const modo=o.tiles,lista=modo==='base'?'1 a 7':modo==='todos'?'1 a 16':'8 a 16';
    sec.push('### '+(n++)+'. Tiles (clave `tiles`)\n'+
      'Dibuja los tiles número '+lista+'. Formato: `"tiles":{"dibujos":{"8":[16 filas],"9":[16 filas]},"solidos":[1,2,3,4,5,7,8]}`.\n'+
      '- Cada tile mide 16×16: 16 filas de 16 caracteres. Deben encajar sin costuras con ellos mismos al repetirse.\n'+
      '- `solidos` es la lista **completa** de tiles que bloquean al personaje (ahora: '+P.solid.join(', ')+'). Los decorativos (flores, cartel, enredadera) no van ahí.\n'+
      '- Los tiles actuales: 1 pasto con tierra (superficie), 2 tierra con piedras, 3 ladrillo de piedra, 4 tablones de madera, 5 caja de madera, 6 flor (decorativo), 7 piedra lisa; del 8 al 16 están vacíos. Si rediseñas uno, conserva su papel.\n'+
      '- Piensa en el uso: el tile 1 es el borde superior del suelo; el 2 va debajo; los de plataforma tienen luz arriba y sombra abajo.');
  }
  if(o.fondos){
    sec.push('### '+(n++)+'. Fondos (clave `fondos`)\n'+
      'Un fondo por nivel: `"fondos":[{"nivel":1,"tema":{ … },"semilla":7}]` (`nivel` cuenta desde 1; '+(o.fondos==='todos'?'haz uno para cada uno de los '+P.levels.length+' niveles ('+P.levels.map((l,i)=>(i+1)+' «'+l.name+'»').join(', ')+')':'haz el del nivel '+(P.lv+1)+' «'+P.levels[P.lv].name+'»')+'). `semilla` es un número de 1 a 99 que cambia la variación.\n'+
      'Las capas con parallax (cielo, lejos, cerca) las dibuja la app; tú eliges el tipo de escenario y los colores en `tema`:\n'+
      '- `kind`: `bosque` (montañas lejanas, colinas y pinos), `ciudad` (edificios con ventanas) o `cueva` (estalactitas, estalagmitas y cristales). Elige el que mejor encaje; los colores hacen el resto (por ejemplo un desierto puede ser `bosque` con arena y cactus-verdes en vez de pinos oscuros).\n'+
      '- `sky`: 4 colores de arriba abajo, `cloud`: 2 (nube y sombra), `orb`: sol, luna o estrellas, `far`: 2 (montañas o edificios lejanos), `hill`: 2 (colinas cercanas), `tree`: 2 (árboles), `bld`: 2 (edificios cercanos), `win`: ventanas o cristales, `estrellas`: true si es de noche.\n'+
      '- Todos son `#rrggbb`. Cuida el contraste: lo cercano más oscuro o saturado que lo lejano, y el cielo más claro cerca del horizonte.');
  }
  if(o.niveles){
    const nv=o.niveles,tpl=LEVEL_TEMPLATES.bosque.rows;
    sec.push('### '+(n++)+'. Niveles (clave `niveles`)\n'+
      'Crea '+nv.n+' nivel'+(nv.n>1?'es':'')+' nuevo'+(nv.n>1?'s':'')+' en `"niveles":[ … ]`. Cada uno: `{"name":"…","theme":{ … },"seed":3,"map":{"w":'+nv.w+',"h":'+nv.h+',"rows":[ … ]}}`.\n'+
      '- Tamaño pedido: '+nv.w+' de ancho y '+nv.h+' de alto (ancho 16–120, alto 9–60). `rows` tiene exactamente `h` filas y todas miden exactamente `w` caracteres.\n'+
      '- Los mapas no usan la paleta de colores. Caracteres del mapa: `.` vacío, `1-9` y `a-g` son los tiles 1 a 16, `S` es el inicio (una vez) y `M` la meta (una vez). Los tiles sólidos ahora son: '+P.solid.map(i=>PAL_CHARS[i-1]).join(' ')+' (tiles '+P.solid.join(', ')+'); el `6` (flor) es decorativo.\n'+
      '- Fondo del nivel: `theme` (mismo formato que en Fondos) o, si prefieres uno ya hecho, `"scene":"'+SCENES.map(s=>s[0]).join('|')+'"`. No uses otras escenas.\n'+
      '- Siempre debe haber suelo bajo `S` y la meta `M` tiene que poder alcanzarse. Medidas del salto: sube hasta 3 tiles (cómodo: 2); camina ≈ 3 tiles de distancia saltando y corre ≈ 5 (cómodo: pozos de 3, corriendo 4 como máximo). En el aire contra una pared el personaje se cuelga, trepa con ↑ y salta de pared.\n'+
      '- Dificultad: '+nv.dificultad+'. Varía el ritmo: tramo plano, pozos, plataformas escalonadas, una pared para trepar, un recoveco. Pon la meta lejos del inicio.\n'+
      '- Un suelo continuo en la parte baja y paredes laterales altas hacen que no se pueda caer fuera del mundo; los pozos van solo donde quieras que haya riesgo.\n\n'+
      'Ejemplo de un nivel válido (mapa 40×18, tiles 1/2 suelo, 3 pared, 4 y 5 plataformas, 6 flores):\n```\n'+tpl.join('\n')+'\n```');
  }

  const parts=[
    '# Tarea: crear '+unir(quiere)+' para mi videojuego de pixel art\n\n'+
    'Eres artista de pixel art y diseñador de niveles. Voy a pegar tu respuesta en mi app «Forja de Píxeles», así que tu respuesta tiene que ser **un único objeto JSON válido** dentro de un bloque ```json, sin texto antes ni después (si quieres decirme algo, usa la clave `"nota"` con una o dos frases).\n\n'+
    '## Lo que quiero\n'+(o.descripcion&&o.descripcion.trim()?o.descripcion.trim():'(Sin descripción: sorpréndeme con algo coherente y bonito.)')+'\n\n'+
    '## Qué debe tener tu JSON\n'+
    'Un objeto con **solo** estas claves (omite las que no pido): '+[pc&&'`personaje`',(pc||o.tiles||o.niveles)&&'`colores_nuevos`',o.tiles&&'`tiles`',o.fondos&&'`fondos`',o.niveles&&'`niveles`','`nota`'].filter(Boolean).join(', ')+'.\n\n'+
    sec.join('\n\n')];

  if(pc&&mv.length||o.tiles){
    parts.push('## Cómo se dibuja (para personajes a mano y tiles)\n'+
      '- Un dibujo es una lista de filas de texto. `.` es transparente; cualquier otro carácter es un color de la paleta, según su posición.\n'+
      '- Paleta actual (carácter=color): '+legend.join(' ')+'\n'+
      '- Los colores 1–22 son los base: 1 contorno, 2–3 piel, 4 pelo, 5–6 ropa, 7–8 pantalón, 9 botas, 10 blanco, 11 dorado, 12–13 verdes de pasto, 14–15 tierra, 16–18 piedra, 19–20 madera, 21 rojo, 22 amarillo.\n'+
      (libres.length?'- Si necesitas colores que no existen, ponlos en `"colores_nuevos":["#rrggbb", …]` (máximo '+libres.length+'). El primero se escribe en los dibujos con el carácter `'+libres[0]+'`'+(libres.length>1?', el segundo con `'+libres[1]+'`':'')+(libres.length>2?', el tercero con `'+libres[2]+'`':'')+(libres.length>3?' y así en orden: '+libres.join(' ')+'.':'.')+'\n'
        :'- La paleta está llena ('+base+' de '+MAXPAL+'): no agregues `colores_nuevos`; usa solo los colores de la paleta.\n')+
      '- **Cuenta bien**: cada fila debe medir exactamente el ancho pedido y cada dibujo exactamente el alto pedido. Una fila de más o de menos hace que la app rechace la respuesta.');
  }else if(pc||o.niveles||o.fondos){
    parts.push('## Colores\nTodos los colores van como `#rrggbb` (minúsculas o mayúsculas, con `#`).');
  }
  parts.push('## Antes de responder\nRevisa que el JSON sea válido (comillas dobles, sin comas finales, sin comentarios) y que las filas midan lo que tienen que medir.');
  return {texto:parts.join('\n\n')+'\n',base};
}

/* Texto para devolverle a Claude cuando su respuesta no se pudo aplicar. */
function iaTextoError(msg){
  return 'Tu respuesta anterior no se pudo cargar en la app. El problema es este:\n\n'+msg+'\n\n'+
    'Corrígelo y devuélveme el JSON completo otra vez (solo el bloque ```json, sin texto extra). Revisa que cada fila mida exactamente lo que debe medir.'}

/* ---------- lectura de la respuesta ---------- */
function iaParse(texto){
  const t=String(texto||'');const i=t.indexOf('{'),j=t.lastIndexOf('}');
  if(i<0||j<i)throw new Error('No encuentro un JSON en el texto pegado. Copia la respuesta completa de Claude.');
  try{return JSON.parse(t.slice(i,j+1))}catch(e){
    throw new Error('El JSON no es válido ('+e.message+'). Suele ser una coma de más, una comilla sin cerrar o una respuesta cortada a la mitad: pídele a Claude «continúa y devuelve el JSON completo».')}}

/* ---------- aplicar el paquete a un proyecto ---------- */
/* P: proyecto (se modifica; pásale una copia). kit: objeto leído de la respuesta. ctx: {base, reemplazar}
   base = colores de la paleta cuando se armaron las instrucciones; reemplazar = índice de un nivel que se sustituye por el primero de "niveles" (-1 = agregar).
   Devuelve {resumen, avisos, personaje (¿tocó el personaje?), clipsNuevos, tiles:[números], niveles:[índices tocados], nuevos:[índices agregados], creados:[índices de lo que vino en "niveles"]}. Si algo está mal lanza Error con un mensaje en español. */
function iaApply(P,kit,ctx){
  ctx=ctx||{};if(!kit||typeof kit!=='object'||Array.isArray(kit))throw new Error('La respuesta debe ser un objeto JSON con claves como "personaje", "tiles", "fondos" o "niveles".');
  const R={resumen:[],avisos:[],clipsNuevos:[],tiles:[],niveles:[],nuevos:[],creados:[],personaje:false};
  const claves=['personaje','colores_nuevos','tiles','fondos','niveles'];
  if(!claves.some(k=>kit[k]!==undefined))throw new Error('El JSON no trae ninguna de las claves esperadas ('+claves.join(', ')+').');
  const hexOk=v=>typeof v==='string'&&/^#[0-9a-fA-F]{6}$/.test(v);
  const cur0=P.pal.length-1,base=Number.isInteger(ctx.base)?ctx.base:cur0,delta=cur0-base;

  /* colores nuevos: se agregan al final de la paleta */
  let nNuevos=0;
  if(kit.colores_nuevos!==undefined){
    if(!Array.isArray(kit.colores_nuevos))throw new Error('"colores_nuevos" debe ser una lista de colores #rrggbb.');
    if(kit.colores_nuevos.length>IA_MAX_NUEVOS)throw new Error('"colores_nuevos" tiene '+kit.colores_nuevos.length+' colores y el máximo es '+IA_MAX_NUEVOS+'.');
    if(cur0+kit.colores_nuevos.length>MAXPAL)throw new Error('No caben '+kit.colores_nuevos.length+' colores más: la paleta tiene '+cur0+' de '+MAXPAL+'. Usa «Limpiar paleta» en Dibujar y prueba otra vez.');
    kit.colores_nuevos.forEach((c,i)=>{if(!hexOk(c))throw new Error('"colores_nuevos" #'+(i+1)+' no es un color válido: '+JSON.stringify(c)+' (usa #rrggbb).')});
    nNuevos=kit.colores_nuevos.length;
    for(const c of kit.colores_nuevos)P.pal.push(c.toLowerCase());
    if(nNuevos)R.resumen.push(nNuevos+' color'+(nNuevos>1?'es':'')+' nuevo'+(nNuevos>1?'s':'')+' en la paleta');
  }
  /* los índices > base de un dibujo se mueven si la paleta cambió desde que se copiaron las instrucciones */
  const maxIdx=base+nNuevos;
  const leer=(rows,w,h,tag)=>{
    let b;try{b=rowsBuf(rows,w,h,maxIdx)}catch(e){throw new Error(tag+': '+e.message)}
    if(delta)for(let i=0;i<b.length;i++)if(b[i]>base)b[i]+=delta;return b};

  /* personaje */
  if(kit.personaje!==undefined){
    const pj=kit.personaje;if(!pj||typeof pj!=='object'||Array.isArray(pj))throw new Error('"personaje" debe ser un objeto.');
    R.personaje=true;const size=pj.size===undefined?P.size:pj.size;
    if(![16,24,32,48,64].includes(size))throw new Error('personaje.size no es válido: '+JSON.stringify(pj.size)+' (usa 16, 24, 32, 48 o 64).');
    if(pj.peinado!==undefined&&!['short','long','helmet'].includes(pj.peinado))throw new Error('personaje.peinado debe ser short, long o helmet (llegó '+JSON.stringify(pj.peinado)+').');
    const regen=size!==P.size||pj.peinado!==undefined||pj.contorno!==undefined;
    if(regen){
      const g=P.gen||{hair:'short',outline:true};
      genCharacter(P,{size,hair:pj.peinado||g.hair||'short',outline:pj.contorno===undefined?g.outline!==false:!!pj.contorno});
      R.resumen.push('Personaje nuevo de '+size+'×'+size+' con los 7 movimientos del esqueleto base');
    }
    if(pj.colores!==undefined){
      if(!pj.colores||typeof pj.colores!=='object')throw new Error('personaje.colores debe ser un objeto como {"piel":"#f2b88c", …}.');
      let k=0;for(const nombre of Object.keys(pj.colores)){
        const idx=IA_ROLES[nombre];if(!idx)throw new Error('personaje.colores: "'+nombre+'" no existe. Usa: '+Object.keys(IA_ROLES).join(', ')+'.');
        if(!hexOk(pj.colores[nombre]))throw new Error('personaje.colores.'+nombre+' no es un color válido: '+JSON.stringify(pj.colores[nombre])+' (usa #rrggbb).');
        P.pal[idx]=pj.colores[nombre].toLowerCase();k++}
      if(k)R.resumen.push('Colores del personaje: '+k+' cambiado'+(k>1?'s':''))}
    if(pj.movimientos!==undefined){
      const mo=pj.movimientos;if(!mo||typeof mo!=='object'||Array.isArray(mo))throw new Error('personaje.movimientos debe ser un objeto con un movimiento por clave (idle, walk, …).');
      for(const nombre of Object.keys(mo)){
        const d=CLIP_DEFS.find(x=>x[0]===nombre);if(!d)throw new Error('personaje.movimientos: "'+nombre+'" no existe. Usa: '+CLIP_DEFS.map(x=>x[0]).join(', ')+'.');
        const c=mo[nombre];if(!c||!Array.isArray(c.frames)||!c.frames.length)throw new Error('Movimiento "'+nombre+'": falta la lista "frames".');
        if(c.frames.length>16)throw new Error('Movimiento "'+nombre+'": '+c.frames.length+' frames y el máximo es 16.');
        const frames=c.frames.map((f,i)=>leer(f,size,size,'Movimiento "'+nombre+'", frame '+(i+1)));
        P.clips[nombre]={fps:clamp(+c.fps||d[3],1,24),loop:c.loop===undefined?d[4]:!!c.loop,frames};
        R.clipsNuevos.push(nombre)}
      if(R.clipsNuevos.length)R.resumen.push('Movimientos dibujados a mano: '+R.clipsNuevos.join(', '));
    }
  }

  /* tiles */
  if(kit.tiles!==undefined){
    const t=kit.tiles;if(!t||typeof t!=='object'||Array.isArray(t))throw new Error('"tiles" debe ser un objeto con "dibujos" y "solidos".');
    const dib=t.dibujos===undefined?{}:t.dibujos;if(!dib||typeof dib!=='object'||Array.isArray(dib))throw new Error('tiles.dibujos debe ser un objeto {"8":[16 filas], …}.');
    for(const k of Object.keys(dib)){const num=+k;if(!Number.isInteger(num)||num<1||num>NTILES)throw new Error('tiles.dibujos: "'+k+'" no es un número de tile válido (1 a '+NTILES+').');
      P.tiles[num-1]=leer(dib[k],TILE,TILE,'Tile '+num);R.tiles.push(num)}
    if(t.solidos!==undefined){
      if(!Array.isArray(t.solidos)||t.solidos.some(v=>!Number.isInteger(v)||v<1||v>NTILES))throw new Error('tiles.solidos debe ser una lista de números de tile entre 1 y '+NTILES+'.');
      P.solid=[...new Set(t.solidos)].sort((a,b)=>a-b)}
    if(R.tiles.length)R.resumen.push('Tiles dibujados: '+R.tiles.join(', ')+' · sólidos: '+P.solid.join(', '));
    else if(t.solidos!==undefined)R.resumen.push('Tiles sólidos: '+P.solid.join(', '));
  }

  /* fondos de niveles que ya existían */
  const lv0=P.lv;
  if(kit.fondos!==undefined){
    if(!Array.isArray(kit.fondos))throw new Error('"fondos" debe ser una lista: [{"nivel":1,"tema":{…},"semilla":3}].');
    kit.fondos.forEach((f,i)=>{
      const tag='fondos['+(i+1)+']';if(!f||typeof f!=='object')throw new Error(tag+' no es un objeto.');
      const li=(f.nivel|0)-1;if(li<0||li>=P.levels.length)throw new Error(tag+': el nivel '+JSON.stringify(f.nivel)+' no existe (el proyecto tiene '+P.levels.length+').');
      const seed=clamp(f.semilla|0||1,1,99);P.lv=li;
      if(f.tema!==undefined){try{P.levels[li].theme=cleanTheme(f.tema)}catch(e){throw new Error(tag+': '+e.message)}genScene(P,'personalizada',seed)}
      else if(f.scene&&SCENES.some(s=>s[0]===f.scene))genScene(P,f.scene,seed);
      else throw new Error(tag+': falta "tema" (o una "scene" válida: '+SCENES.map(s=>s[0]).join(', ')+').');
      R.niveles.push(li)});
    if(kit.fondos.length)R.resumen.push('Fondos nuevos: nivel'+(kit.fondos.length>1?'es ':' ')+kit.fondos.map(f=>f.nivel).join(', '))}

  /* niveles nuevos */
  if(kit.niveles!==undefined){
    if(!Array.isArray(kit.niveles)||!kit.niveles.length)throw new Error('"niveles" debe ser una lista con al menos un nivel.');
    const rep=Number.isInteger(ctx.reemplazar)&&ctx.reemplazar>=0&&ctx.reemplazar<P.levels.length?ctx.reemplazar:-1;
    const agregar=kit.niveles.length-(rep>=0?1:0);
    if(P.levels.length+agregar>MAXLEVELS)throw new Error('Con estos niveles el proyecto pasaría de '+MAXLEVELS+' (tiene '+P.levels.length+'). Elimina alguno antes.');
    const ls=kit.niveles.map((lo,i)=>{
      if(!lo||typeof lo!=='object')throw new Error('Nivel '+(i+1)+': no es un objeto.');
      if(lo.scene&&lo.scene!=='personalizada'&&!lo.theme&&!SCENES.some(s=>s[0]===lo.scene))throw new Error('Nivel '+(i+1)+': la escena "'+lo.scene+'" no existe. Usa una de ('+SCENES.map(s=>s[0]).join(', ')+') o un "theme" con colores.');
      const copia=Object.assign({},lo);delete copia.bg;
      return parseLevel(copia,i,P.pal.length-1)});
    ls.forEach((L,i)=>{
      let idx;if(i===0&&rep>=0){P.levels[rep]=L;idx=rep}else{P.levels.push(L);idx=P.levels.length-1;R.nuevos.push(idx)}
      if(L.needBg){P.lv=idx;genScene(P,L.scene,L.seed)}delete L.needBg;
      R.niveles.push(idx);R.creados.push(idx);
      for(const a of iaAvisos(P,idx))R.avisos.push('Nivel '+(idx+1)+' «'+L.name+'»: '+a)});
    R.resumen.push(ls.length+' nivel'+(ls.length>1?'es':'')+(rep>=0?' (el primero reemplaza al nivel '+(rep+1)+')':' agregado'+(ls.length>1?'s':''))+': '+ls.map(l=>l.name+' '+l.map.w+'×'+l.map.h).join(', '))}

  P.lv=clamp(R.nuevos.length?R.nuevos[0]:(R.niveles.length?R.niveles[0]:lv0),0,P.levels.length-1);
  if(!R.resumen.length)R.resumen.push('La respuesta no cambió nada.');
  if(typeof kit.nota==='string'&&kit.nota.trim())R.nota=kit.nota.trim().slice(0,400);
  return R}

/* Avisos típicos de un nivel (los mismos de herramientas/validar.mjs). */
function iaAvisos(P,li){
  const l=P.levels[li],m=l.map,solid=new Set(P.solid),at=(x,y)=>(x<0||x>=m.w||y<0||y>=m.h)?0:m.data[y*m.w+x],av=[];
  if(solid.has(at(m.spawn[0],m.spawn[1])))av.push('el inicio está dentro de un tile sólido.');
  let suelo=false;for(let y=m.spawn[1];y<m.h;y++)if(solid.has(at(m.spawn[0],y))){suelo=true;break}
  if(!suelo)av.push('bajo el inicio no hay suelo: el personaje caería al vacío.');
  if(!m.goal)av.push('no tiene meta (M): no se podrá pasar de nivel.');
  else if(solid.has(at(m.goal[0],m.goal[1])))av.push('la meta está dentro de un tile sólido.');
  const vacios=[...new Set(Array.from(m.data))].filter(v=>v&&!P.tiles[v-1].some(x=>x));
  if(vacios.length)av.push('usa tiles sin dibujo: '+vacios.join(', ')+'.');
  return av}

/* ---------- ¿se puede pasar el nivel? (un robot prueba teclas con el mismo motor del juego) ---------- */
/* opt: {tiempoMs (por defecto 60000), limite (pasos, por defecto 300000), cancelado(), progreso(pasos)}.
   Devuelve {ok:true, segundos} o {ok:false, motivo, agotado}. Es asíncrona para no congelar la pantalla: cede el control cada 250 pasos.
   Un nivel difícil puede tardar medio minuto; si se acaba el tiempo no significa que sea imposible. */
async function iaAlcanzable(P,li,opt){
  opt=opt||{};const limite=opt.limite||300000,tiempoMs=opt.tiempoMs||60000,t0=Date.now(),L=P.levels[li],m=L.map;
  if(!m.goal)return {ok:false,motivo:'el nivel no tiene meta'};
  const stub=new Proxy({},{get:(t,k)=>k==='measureText'?()=>({width:10}):()=>{},set:()=>true}),canvas={getContext:()=>stub,width:0,height:0};
  const clips={};CLIP_DEFS.forEach((d,i)=>clips[d[0]]={row:i,frames:2,fps:6,loop:true});
  const D={vw:BGW,vh:BGH,tile:TILE,size:P.size,clips,solid:P.solid,start:0,levels:[{name:L.name,map:{w:m.w,h:m.h,data:Array.from(m.data),spawn:m.spawn,goal:null},bgs:[]}]};
  const g=makeGame(canvas,D);g.reset();
  const T=TILE,gx=m.goal[0]*T+T/2,gy=(m.goal[1]+1)*T,hbh=Math.round(P.size*0.8);
  const key=s=>[Math.round(s.p.x/3),Math.round(s.p.y/3),Math.round(s.p.vx*2),Math.round(s.p.vy),s.p.ground?1:0,s.p.cling,s.jumpPrev,s.p.lock>0?1:0].join(',');
  const h=s=>Math.abs(s.p.x-gx)+Math.abs(s.p.y-gy)*1.3;
  const acts=[];for(const d of [-1,0,1])for(const run of [0,1])for(const jump of [0,1])for(const up of [0,1])acts.push({d,run,jump,up});
  const heap=[],push=x=>{heap.push(x);let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(heap[p].f<=heap[i].f)break;[heap[p],heap[i]]=[heap[i],heap[p]];i=p}};
  const pop=()=>{const t=heap[0],l=heap.pop();if(heap.length){heap[0]=l;let i=0;for(;;){let q=i;const a=2*i+1,b=a+1;if(a<heap.length&&heap[a].f<heap[q].f)q=a;if(b<heap.length&&heap[b].f<heap[q].f)q=b;if(q===i)break;[heap[q],heap[i]]=[heap[i],heap[q]];i=q}}return t};
  const ini=g.save(),seen=new Set([key(ini)]);push({s:ini,f:h(ini),n:0});
  const setK=a=>{g.setKey('left',a.d<0);g.setKey('right',a.d>0);g.setKey('run',a.run);g.setKey('jump',a.jump);g.setKey('up',a.up)};
  let it=0;
  while(heap.length&&it<limite){
    if(it%250===0){await new Promise(r=>setTimeout(r,0));if(opt.cancelado&&opt.cancelado())return {ok:false,motivo:'cancelado',cancelado:true};
      if(opt.progreso)opt.progreso(it);if(Date.now()-t0>tiempoMs)return {ok:false,agotado:true,motivo:'el robot no lo logró en '+Math.round(tiempoMs/1000)+' s (puede ser muy difícil o imposible: pruébalo tú en la pestaña Probar)'}}
    const cur=pop();it++;
    for(const a of acts){
      g.load(cur.s);setK(a);for(let k=0;k<5;k++)g.tick();
      const st=g.save(),p=st.p;if(p.y>m.h*T+80)continue;
      if(Math.abs(p.x-gx)<14&&p.y>m.goal[1]*T-T&&p.y-hbh<(m.goal[1]+1)*T)return {ok:true,segundos:Math.round((cur.n+1)*5/60)};
      const k2=key(st);if(seen.has(k2))continue;seen.add(k2);push({s:st,f:h(st)+cur.n*0.15,n:cur.n+1})}}
  return {ok:false,agotado:!!heap.length,motivo:heap.length?'el robot llegó al límite de búsqueda sin encontrar camino':'el robot probó todas las posibilidades y no llegó a la meta'}}
