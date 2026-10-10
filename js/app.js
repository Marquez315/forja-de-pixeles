
/* ========================================================================
   app.js · interfaz (DOM): editor, mapa, niveles, prueba, exportación
   ======================================================================== */
const $=id=>document.getElementById(id);
const el=(tag,props,kids)=>{const e=document.createElement(tag);if(props)for(const k in props){if(k==='class')e.className=props[k];else if(k==='text')e.textContent=props[k];else e.setAttribute(k,props[k])}(kids||[]).forEach(c=>e.append(c));return e};
let P=null, dl=null, sampleFn=null;const HAS_CLAUDE=!!(window.claude&&window.claude.use);
const UI={view:'edit',obj:'char',clip:'idle',frame:0,tool:'pencil',color:1,mirror:false,zoom:8,tile:0,layer:0,seed:1,mtool:'paint',mtile:1,mzoom:2,playing:true,grid:true,onion:true};
const SAVE_KEY='forja-pixel';
const undoS=[],redoS=[];
const SEG={};

/* ---------- acceso al buffer actual ---------- */
function cur(){
  if(UI.obj==='char'){const c=P.clips[UI.clip];UI.frame=clamp(UI.frame,0,c.frames.length-1);return {buf:c.frames[UI.frame],w:P.size,h:P.size}}
  if(UI.obj==='tiles')return {buf:P.tiles[UI.tile],w:TILE,h:TILE};
  return {buf:P.bg[UI.layer],w:BGW,h:BGH}}
function bufCanvas(buf,w,h){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d'),id=x.createImageData(w,h);
  const cols=P.pal.map(h2=>h2?hexRgb(h2):null);
  for(let i=0;i<buf.length;i++){const v=cols[buf[i]];if(v){id.data[i*4]=v[0];id.data[i*4+1]=v[1];id.data[i*4+2]=v[2];id.data[i*4+3]=255}}
  x.putImageData(id,0,0);return c}

/* ---------- autoguardado ---------- */
let saveT=0;
function dirty(){clearTimeout(saveT);saveT=setTimeout(()=>{try{localStorage.setItem(SAVE_KEY,JSON.stringify(Object.assign(projectToObj(P,true),{lv:P.lv})))}catch(e){}},900)}
function toast(msg){const t=$('toast');t.textContent=msg;t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>{t.hidden=true},2800)}
function confirmBtn(btn,fn){let t=0;const orig=btn.textContent;btn.addEventListener('click',()=>{
  if(t){clearTimeout(t);t=0;btn.textContent=orig;btn.classList.remove('warn');fn()}
  else{btn.textContent='Pulsa otra vez para confirmar';btn.classList.add('warn');t=setTimeout(()=>{t=0;btn.textContent=orig;btn.classList.remove('warn')},3500)}})}

/* ---------- deshacer ---------- */
function pushUndo(buf,prev){undoS.push({buf,prev});if(undoS.length>150)undoS.shift();redoS.length=0;updUndo()}
function undo(){const e=undoS.pop();if(!e)return;redoS.push({buf:e.buf,prev:e.buf.slice()});e.buf.set(e.prev);afterEdit()}
function redo(){const e=redoS.pop();if(!e)return;undoS.push({buf:e.buf,prev:e.buf.slice()});e.buf.set(e.prev);afterEdit()}
function updUndo(){$('undo').disabled=!undoS.length;$('redo').disabled=!redoS.length}
function clearUndo(){undoS.length=0;redoS.length=0;updUndo()}
function afterEdit(){updUndo();render();refreshThumbs();dirty()}

/* ---------- renderizado del lienzo ---------- */
const ed=$('ed'),edx=ed.getContext('2d');let hover=null;
function autoZoom(){const {w,h}=cur(),wrap=$('cwrap'),aw=Math.max(120,wrap.clientWidth-26);UI.zoom=clamp(Math.floor(Math.min(aw/w,520/h)),2,28)}
function render(){
  const {buf,w,h}=cur(),z=UI.zoom;if(ed.width!==w*z||ed.height!==h*z){ed.width=w*z;ed.height=h*z}
  edx.clearRect(0,0,ed.width,ed.height);edx.imageSmoothingEnabled=false;
  if(UI.obj==='char'&&UI.onion&&UI.frame>0){edx.globalAlpha=0.28;edx.drawImage(bufCanvas(P.clips[UI.clip].frames[UI.frame-1],w,h),0,0,w*z,h*z);edx.globalAlpha=1}
  edx.drawImage(bufCanvas(buf,w,h),0,0,w*z,h*z);
  if(UI.grid&&z>=6){edx.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--grid');edx.lineWidth=1;edx.beginPath();
    for(let x=1;x<w;x++){edx.moveTo(x*z+0.5,0);edx.lineTo(x*z+0.5,h*z)}for(let y=1;y<h;y++){edx.moveTo(0,y*z+0.5);edx.lineTo(w*z,y*z+0.5)}edx.stroke()}
  if(UI.mirror){edx.strokeStyle='#ff6b94';edx.lineWidth=2;edx.beginPath();edx.moveTo(w*z/2,0);edx.lineTo(w*z/2,h*z);edx.stroke()}
  if(hover&&hover.x>=0&&hover.y>=0&&hover.x<w&&hover.y<h){edx.strokeStyle='#ffffff';edx.lineWidth=1;edx.strokeRect(hover.x*z+0.5,hover.y*z+0.5,z-1,z-1);edx.strokeStyle='#000';edx.strokeRect(hover.x*z+1.5,hover.y*z+1.5,z-3,z-3)}
  $('zlab').textContent='x'+z}

/* ---------- herramientas ---------- */
const TOOLS=[['pencil','Lápiz','B','M4 20l4-1 11-11-3-3L5 16z'],['eraser','Borrador','E','M5 15l8-8 6 6-6 6H8zM9 19h10'],['fill','Relleno','G','M6 12l6-7 7 7-6 7zM20 17v2'],
  ['line','Línea','L','M5 19L19 5'],['rect','Rectángulo','R','M5 6h14v12H5z'],['rectf','Rectángulo lleno','','M5 6h14v12H5z M8 9h8v6H8z'],['ell','Elipse','O','M12 5a8 6 0 1 0 .01 0z'],['ellf','Elipse llena','','M12 5a8 6 0 1 0 .01 0z M12 9a4 2 0 1 0 .01 0z'],['pick','Cuentagotas','I','M15 4l5 5-9 9H6v-5z']];
function buildTools(){
  const box=$('tools');box.textContent='';
  TOOLS.forEach(([id,name,key,path])=>{const b=el('button',{class:'tool',title:name+(key?' ('+key+')':''),'aria-label':name,'aria-pressed':String(UI.tool===id),'data-t':id});
    b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+path+'"/></svg>'+(key?'<span class="k">'+key+'</span>':'');b.onclick=()=>{UI.tool=id;buildTools()};box.append(b)});
  box.append(el('div',{class:'tsep'}));
  const act=(label,title,fn,pressed)=>{const b=el('button',{class:'tool',title,'aria-label':title,text:label});if(pressed!==undefined)b.setAttribute('aria-pressed',String(pressed));b.onclick=fn;box.append(b)};
  act('SIM','Simetría horizontal (M)',()=>{UI.mirror=!UI.mirror;buildTools();render()},UI.mirror);
  act('↔','Voltear horizontal',()=>xform('fh'));act('↕','Voltear vertical',()=>xform('fv'));
  act('◀','Mover un píxel a la izquierda',()=>xform('l'));act('▶','Mover un píxel a la derecha',()=>xform('r'));act('▲','Mover un píxel arriba',()=>xform('u'));act('▼','Mover un píxel abajo',()=>xform('d'));
  act('CLR','Vaciar lienzo',()=>{const {buf}=cur();const prev=buf.slice();buf.fill(0);pushUndo(buf,prev);afterEdit()})}
function xform(k){const {buf,w,h}=cur(),prev=buf.slice(),src=prev;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){let sx=x,sy=y;
    if(k==='fh')sx=w-1-x;else if(k==='fv')sy=h-1-y;else if(k==='l')sx=(x+1)%w;else if(k==='r')sx=(x-1+w)%w;else if(k==='u')sy=(y+1)%h;else sy=(y-1+h)%h;
    buf[y*w+x]=src[sy*w+sx]}pushUndo(buf,prev);afterEdit()}
function line(x0,y0,x1,y1,cb){const dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1;let e=dx+dy;
  for(;;){cb(x0,y0);if(x0===x1&&y0===y1)break;const e2=2*e;if(e2>=dy){e+=dy;x0+=sx}if(e2<=dx){e+=dx;y0+=sy}}}
function ellCells(x0,y0,x1,y1,filled,cb){const l=Math.min(x0,x1),r=Math.max(x0,x1),t=Math.min(y0,y1),b=Math.max(y0,y1),cx=(l+r)/2,cy=(t+b)/2,rx=(r-l)/2+0.5,ry=(b-t)/2+0.5;
  const inside=(x,y,a,c)=>a>0&&c>0&&((x-cx)/a)**2+((y-cy)/c)**2<=1;
  for(let y=t;y<=b;y++)for(let x=l;x<=r;x++)if(inside(x,y,rx,ry)&&(filled||!inside(x,y,rx-1,ry-1)))cb(x,y)}
function flood(buf,w,h,x,y,v){const t=buf[y*w+x];if(t===v)return;const st=[[x,y]];
  while(st.length){const [cx,cy]=st.pop();if(cx<0||cy<0||cx>=w||cy>=h||buf[cy*w+cx]!==t)continue;buf[cy*w+cx]=v;st.push([cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1])}}
let drawing=null;
function cellOf(e){const r=ed.getBoundingClientRect(),{w,h}=cur();return {x:Math.floor((e.clientX-r.left)*(w/r.width)),y:Math.floor((e.clientY-r.top)*(h/r.height))}}
function put(buf,w,h,x,y,v){if(x>=0&&y>=0&&x<w&&y<h)buf[y*w+x]=v;if(UI.mirror){const x2=w-1-x;if(x2>=0&&y>=0&&x2<w&&y<h)buf[y*w+x2]=v}}
ed.addEventListener('contextmenu',e=>e.preventDefault());
ed.addEventListener('pointerdown',e=>{
  const {buf,w,h}=cur(),c=cellOf(e);if(c.x<0||c.y<0||c.x>=w||c.y>=h)return;ed.setPointerCapture(e.pointerId);
  let tool=UI.tool;if(e.button===2)tool='eraser';
  const val=tool==='eraser'?0:UI.color;
  if(tool==='pick'){UI.color=buf[c.y*w+c.x];buildPalette();return}
  const snap=buf.slice();
  if(tool==='fill'){flood(buf,w,h,c.x,c.y,val);if(UI.mirror)flood(buf,w,h,w-1-c.x,c.y,val);pushUndo(buf,snap);afterEdit();return}
  drawing={tool,val,snap,x0:c.x,y0:c.y,lx:c.x,ly:c.y};
  if(tool==='pencil'||tool==='eraser'){put(buf,w,h,c.x,c.y,val)}
  render()});
ed.addEventListener('pointermove',e=>{
  const c=cellOf(e),{buf,w,h}=cur();hover=c;
  $('info').textContent=(c.x>=0&&c.y>=0&&c.x<w&&c.y<h)?('x '+c.x+' · y '+c.y+' · color '+buf[c.y*w+c.x]):'';
  if(drawing){const d=drawing,t=d.tool;
    if(t==='pencil'||t==='eraser'){line(d.lx,d.ly,c.x,c.y,(x,y)=>put(buf,w,h,x,y,d.val));d.lx=c.x;d.ly=c.y}
    else{buf.set(d.snap);
      if(t==='line')line(d.x0,d.y0,c.x,c.y,(x,y)=>put(buf,w,h,x,y,d.val));
      else if(t==='rect'||t==='rectf'){const l=Math.min(d.x0,c.x),r=Math.max(d.x0,c.x),tp=Math.min(d.y0,c.y),b=Math.max(d.y0,c.y);
        for(let y=tp;y<=b;y++)for(let x=l;x<=r;x++)if(t==='rectf'||x===l||x===r||y===tp||y===b)put(buf,w,h,x,y,d.val)}
      else ellCells(d.x0,d.y0,c.x,c.y,t==='ellf',(x,y)=>put(buf,w,h,x,y,d.val))}}
  render()});
function endDraw(){if(!drawing)return;const {buf}=cur();let ch2=false;for(let i=0;i<buf.length;i++)if(buf[i]!==drawing.snap[i]){ch2=true;break}
  if(ch2)pushUndo(buf,drawing.snap);drawing=null;afterEdit()}
ed.addEventListener('pointerup',endDraw);ed.addEventListener('pointercancel',endDraw);
ed.addEventListener('pointerleave',()=>{hover=null;if(!drawing)render()});

/* ---------- paleta ---------- */
function buildPalette(){
  const box=$('sws');box.textContent='';UI.color=Math.min(UI.color,P.pal.length-1);
  for(let i=0;i<P.pal.length;i++){const b=el('button',{class:'sw','aria-label':i?('Color '+i+' '+P.pal[i]):'Transparente (borrar)',title:i?('Color '+i+' · '+P.pal[i]):'Transparente','aria-pressed':String(UI.color===i)});
    if(i)b.append(Object.assign(el('i'),{style:'background:'+P.pal[i]}));else b.textContent='∅';b.onclick=()=>{UI.color=i;buildPalette()};box.append(b)}
  const ci=$('colIn');ci.disabled=UI.color===0;if(UI.color)ci.value=P.pal[UI.color];
  $('colInfo').textContent=UI.color?('Índice '+UI.color+' de '+(P.pal.length-1)+' · máx '+MAXPAL):'Transparente'}
$('colIn').addEventListener('input',e=>{if(!UI.color)return;P.pal[UI.color]=e.target.value.toLowerCase();const s=$('sws').children[UI.color];if(s)s.firstChild.style.background=P.pal[UI.color];render();refreshThumbs();dirty()});
$('addCol').onclick=()=>{if(P.pal.length>MAXPAL){toast('La paleta está llena ('+MAXPAL+' colores). Usa Limpiar paleta.');return}P.pal.push($('colIn').value||'#888888');UI.color=P.pal.length-1;buildPalette();dirty()};
$('cleanPal').onclick=()=>{const before=P.pal.length-1,after=compactPalette(P);clearUndo();UI.color=Math.min(UI.color,after);buildPalette();render();refreshThumbs();dirty();toast(before===after?'No había colores sin usar.':'Quité '+(before-after)+' colores sin usar.')};

/* ---------- vista edición: paneles ---------- */
function setObj(o){UI.obj=o;document.querySelectorAll('#objseg button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.o===o)));
  $('p-char').hidden=o!=='char';$('p-tiles').hidden=o!=='tiles';$('p-bg').hidden=o!=='bg';
  $('onionL').hidden=o!=='char';$('claudeCard').hidden=o==='bg'||!HAS_CLAUDE;autoZoom();buildPanels();render()}
document.querySelectorAll('#objseg button').forEach(b=>b.onclick=()=>setObj(b.dataset.o));
function buildPanels(){
  // movimientos
  const cb=$('clips');cb.textContent='';
  CLIP_DEFS.forEach(d=>{const c=P.clips[d[0]];const b=el('button',{class:'chip','aria-pressed':String(UI.clip===d[0])},[document.createTextNode(d[1]),Object.assign(el('small'),{textContent:c.frames.length})]);
    b.onclick=()=>{UI.clip=d[0];UI.frame=0;pvT=0;buildPanels();render()};cb.append(b)});
  const c=P.clips[UI.clip];UI.frame=clamp(UI.frame,0,c.frames.length-1);
  const fb=$('frames');fb.textContent='';
  c.frames.forEach((f,i)=>{const cv=document.createElement('canvas');cv.width=P.size;cv.height=P.size;cv.getContext('2d').drawImage(bufCanvas(f,P.size,P.size),0,0);
    const b=el('button',{class:'fr','aria-label':'Frame '+(i+1),'aria-pressed':String(i===UI.frame)},[cv,Object.assign(el('b'),{textContent:i+1})]);
    b.onclick=()=>{UI.frame=i;buildPanels();render()};fb.append(b)});
  $('fps').value=c.fps;$('fpsv').textContent=c.fps;$('loopT').checked=c.loop;
  $('gSize').value=String(P.size);$('gHair').value=P.gen.hair||'short';$('gOut').checked=P.gen.outline!==false;
  // tiles
  const mk2=(box,sel,fn)=>{box.textContent='';for(let i=0;i<NTILES;i++){const cv=document.createElement('canvas');cv.width=TILE;cv.height=TILE;
    const b=el('button',{class:'tt','aria-label':'Tile '+(i+1),'aria-pressed':String(sel(i))},[cv,Object.assign(el('b'),{textContent:i+1})]);
    if(P.solid.includes(i+1))b.append(el('span',{class:'dot'}));b.onclick=()=>fn(i);box.append(b)}};
  mk2($('tgrid'),i=>i===UI.tile,i=>{UI.tile=i;buildPanels();render()});
  mk2($('mgrid'),i=>i+1===UI.mtile,i=>{UI.mtile=i+1;if(UI.mtool==='erase'||UI.mtool==='spawn'||UI.mtool==='goal')setMtool('paint');buildPanels()});
  $('solidT').checked=P.solid.includes(UI.tile+1);
  // fondos
  const sb=$('scenes');sb.textContent='';SCENES.forEach(s=>{const b=el('button',{class:'btn',text:s[1]});b.onclick=()=>{genScene(P,s[0],UI.seed);clearUndo();afterEdit();buildPalette();buildPanels();toast(s[1]+' lista')};sb.append(b)});
  document.querySelectorAll('#layseg button').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.l===UI.layer)));
  $('seedv').textContent='Variación '+UI.seed;
  refreshThumbs()}
function refreshThumbs(){
  document.querySelectorAll('#frames canvas').forEach((cv,i)=>{const f=P.clips[UI.clip].frames[i];if(!f)return;const x=cv.getContext('2d');x.clearRect(0,0,cv.width,cv.height);x.drawImage(bufCanvas(f,P.size,P.size),0,0)});
  for(const id of ['tgrid','mgrid'])document.querySelectorAll('#'+id+' canvas').forEach((cv,i)=>{const x=cv.getContext('2d');x.clearRect(0,0,TILE,TILE);x.drawImage(bufCanvas(P.tiles[i],TILE,TILE),0,0)});
  const bp=$('bgpv'),bx=bp.getContext('2d');bx.clearRect(0,0,BGW,BGH);for(const b of P.bg)bx.drawImage(bufCanvas(b,BGW,BGH),0,0)}
document.querySelectorAll('#layseg button').forEach(b=>b.onclick=()=>{UI.layer=+b.dataset.l;buildPanels();render()});
$('reseed').onclick=()=>{UI.seed=(UI.seed%99)+1;$('seedv').textContent='Variación '+UI.seed;if(P.scene){genScene(P,P.scene,UI.seed);clearUndo();afterEdit();buildPalette()}else toast('Elige una escena primero.')};
$('fAdd').onclick=()=>{const c=P.clips[UI.clip];if(c.frames.length>=16){toast('Máximo 16 frames por movimiento.');return}c.frames.splice(UI.frame+1,0,new Uint8Array(P.size*P.size));UI.frame++;buildPanels();render();dirty()};
$('fDup').onclick=()=>{const c=P.clips[UI.clip];if(c.frames.length>=16){toast('Máximo 16 frames por movimiento.');return}c.frames.splice(UI.frame+1,0,c.frames[UI.frame].slice());UI.frame++;buildPanels();render();dirty()};
$('fDel').onclick=()=>{const c=P.clips[UI.clip];if(c.frames.length<=1){toast('Cada movimiento necesita al menos un frame.');return}c.frames.splice(UI.frame,1);UI.frame=Math.max(0,UI.frame-1);clearUndo();buildPanels();render();dirty()};
$('fL').onclick=()=>{const c=P.clips[UI.clip],i=UI.frame;if(i>0){[c.frames[i-1],c.frames[i]]=[c.frames[i],c.frames[i-1]];UI.frame--;buildPanels();render();dirty()}};
$('fR').onclick=()=>{const c=P.clips[UI.clip],i=UI.frame;if(i<c.frames.length-1){[c.frames[i+1],c.frames[i]]=[c.frames[i],c.frames[i+1]];UI.frame++;buildPanels();render();dirty()}};
$('fps').oninput=e=>{P.clips[UI.clip].fps=+e.target.value;$('fpsv').textContent=e.target.value;dirty()};
$('loopT').onchange=e=>{P.clips[UI.clip].loop=e.target.checked;dirty()};
$('flipClip').onclick=()=>{const c=P.clips[UI.clip],s=P.size;c.frames.forEach(f=>{const p=f.slice();for(let y=0;y<s;y++)for(let x=0;x<s;x++)f[y*s+x]=p[y*s+s-1-x]});clearUndo();buildPanels();render();dirty();toast('Movimiento reflejado')};
confirmBtn($('gen'),()=>{genCharacter(P,{size:+$('gSize').value,hair:$('gHair').value,outline:$('gOut').checked});UI.frame=0;clearUndo();autoZoom();buildPanels();render();dirty();toast('Personaje generado con '+CLIP_DEFS.length+' movimientos')});
$('rndCol').onclick=()=>{randomCharColors(P,rng(Date.now()&0xffff));buildPalette();render();buildPanels();dirty()};
$('solidT').onchange=e=>{const id=UI.tile+1;P.solid=P.solid.filter(v=>v!==id);if(e.target.checked)P.solid.push(id);buildPanels();dirty()};
$('tClear').onclick=()=>{const b=P.tiles[UI.tile],prev=b.slice();b.fill(0);pushUndo(b,prev);afterEdit()};
confirmBtn($('tReset'),()=>{for(let i=0;i<7;i++)P.tiles[i]=makeTile(i+1);P.solid=[1,2,3,4,5,7];clearUndo();buildPanels();render();dirty()});
$('zin').onclick=()=>{UI.zoom=Math.min(32,UI.zoom+1);render()};$('zout').onclick=()=>{UI.zoom=Math.max(1,UI.zoom-1);render()};
$('gridT').onchange=e=>{UI.grid=e.target.checked;render()};$('onionT').onchange=e=>{UI.onion=e.target.checked;render()};
$('undo').onclick=undo;$('redo').onclick=redo;
confirmBtn($('newproj'),()=>{P=newProject();clearUndo();UI.clip='idle';UI.frame=0;UI.tile=0;UI.color=1;bootUI();dirty();toast('Proyecto nuevo')});

/* ---------- vista previa animada ---------- */
const pv=$('pv'),pvx=pv.getContext('2d');let pvT=0,pvLast=0;
$('pvPlay').onclick=()=>{UI.playing=!UI.playing;$('pvPlay').textContent=UI.playing?'⏸ Pausa':'▶ Reproducir'};
function pvLoop(ts){requestAnimationFrame(pvLoop);if(UI.view!=='edit'||UI.obj!=='char')return;
  const dt=pvLast?(ts-pvLast)/1000:0;pvLast=ts;if(UI.playing)pvT+=dt;
  const c=P.clips[UI.clip],n=c.frames.length;let f=Math.floor(pvT*c.fps);f=c.loop?f%n:Math.min(n-1,f);if(!UI.playing)f=UI.frame;
  const s=P.size,sc=Math.max(1,Math.floor(128/s));pv.width=s*sc;pv.height=s*sc;pvx.imageSmoothingEnabled=false;pvx.clearRect(0,0,pv.width,pv.height);
  pvx.drawImage(bufCanvas(c.frames[Math.min(f,n-1)],s,s),0,0,s*sc,s*sc)}
requestAnimationFrame(pvLoop);

/* ---------- pestañas ---------- */
function setView(v){
  if(UI.view==='play'&&v!=='play')stopGame();
  UI.view=v;for(const k of ['edit','ia','map','play','export'])$('v-'+k).hidden=k!==v;
  document.querySelectorAll('#tabs .tab').forEach(t=>t.setAttribute('aria-selected',String(t.dataset.v===v)));
  if(v==='edit'){autoZoom();buildPanels();render()}
  if(v==='ia')renderIA();
  if(v==='map'){buildPanels();renderMap()}
  if(v==='play')startGame();
  if(v==='export')renderExport()}
document.querySelectorAll('#tabs .tab').forEach(t=>t.onclick=()=>setView(t.dataset.v));

/* ---------- niveles ---------- */
function refreshLevels(){
  const opts=P.levels.map((l,i)=>'<option value="'+i+'">'+(i+1)+'. '+l.name.replace(/[<>&]/g,'')+'</option>').join('');
  for(const id of ['lvSel','lvSel2']){const e=$(id);if(e){e.innerHTML=opts;e.value=String(P.lv)}}
  $('lvName').value=P.levels[P.lv].name;$('lvInfo').textContent='Nivel '+(P.lv+1)+' de '+P.levels.length}
function gotoLevel(i){P.lv=clamp(i,0,P.levels.length-1);clearUndo();refreshLevels();buildPalette();if(UI.view==='map')renderMap();else{buildPanels();render()}dirty()}
$('lvSel').onchange=e=>gotoLevel(+e.target.value);$('lvSel2').onchange=e=>gotoLevel(+e.target.value);
$('lvName').oninput=e=>{P.levels[P.lv].name=e.target.value.slice(0,40)||'Nivel';for(const id of ['lvSel','lvSel2']){const o=$(id).options[P.lv];if(o)o.textContent=(P.lv+1)+'. '+P.levels[P.lv].name}dirty()};
$('lvAdd').onclick=()=>{if(P.levels.length>=MAXLEVELS){toast('Máximo '+MAXLEVELS+' niveles.');return}
  const l=blankLevel('Nivel '+(P.levels.length+1));P.levels.push(l);P.lv=P.levels.length-1;genScene(P,'bosque-dia',1);
  const m=l.map;for(let x=0;x<m.w;x++){m.data[(m.h-3)*m.w+x]=1;m.data[(m.h-2)*m.w+x]=2;m.data[(m.h-1)*m.w+x]=2}m.spawn=[2,m.h-4];m.goal=[m.w-3,m.h-4];
  clearUndo();refreshLevels();buildPalette();renderMap();dirty();toast('Nivel nuevo')};
$('lvDup').onclick=()=>{if(P.levels.length>=MAXLEVELS){toast('Máximo '+MAXLEVELS+' niveles.');return}
  const o=P.levels[P.lv],m=o.map,l={name:o.name+' copia',scene:o.scene,seed:o.seed,map:{w:m.w,h:m.h,data:m.data.slice(),spawn:m.spawn.slice(),goal:m.goal?m.goal.slice():null},bg:o.bg.map(b=>b.slice())};if(o.theme)l.theme=JSON.parse(JSON.stringify(o.theme));
  P.levels.splice(P.lv+1,0,l);P.lv++;clearUndo();refreshLevels();renderMap();dirty();toast('Nivel duplicado')};
confirmBtn($('lvDel'),()=>{if(P.levels.length<=1){toast('Tiene que quedar al menos un nivel.');return}P.levels.splice(P.lv,1);P.lv=Math.min(P.lv,P.levels.length-1);clearUndo();refreshLevels();buildPalette();renderMap();dirty()});
$('lvUp').onclick=()=>{const i=P.lv;if(i>0){[P.levels[i-1],P.levels[i]]=[P.levels[i],P.levels[i-1]];P.lv--;refreshLevels();dirty()}};
$('lvDn').onclick=()=>{const i=P.lv;if(i<P.levels.length-1){[P.levels[i+1],P.levels[i]]=[P.levels[i],P.levels[i+1]];P.lv++;refreshLevels();dirty()}};

/* ---------- mapa ---------- */
const mapc=$('mapc'),mapx=mapc.getContext('2d');let mdrag=false,bgCache=null;
function setMtool(m){UI.mtool=m;document.querySelectorAll('#mseg button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.m===m)))}
document.querySelectorAll('#mseg button').forEach(b=>b.onclick=()=>setMtool(b.dataset.m));
function renderMap(){
  const M=P.map,z=UI.mzoom,W=M.w*TILE*z,H=M.h*TILE*z;if(mapc.width!==W||mapc.height!==H){mapc.width=W;mapc.height=H}
  mapx.imageSmoothingEnabled=false;mapx.clearRect(0,0,W,H);
  if($('mbgT').checked){const sc=P.pal[P.bg[0][0]];if(sc){mapx.fillStyle=sc;mapx.fillRect(0,0,W,(M.h*TILE-BGH)*z)}for(const b of P.bg){const cv=bufCanvas(b,BGW,BGH);for(let ox=0;ox<M.w*TILE;ox+=BGW)mapx.drawImage(cv,0,0,BGW,BGH,ox*z,(M.h*TILE-BGH)*z,BGW*z,BGH*z)}}
  const ts=P.tiles.map(b=>bufCanvas(b,TILE,TILE));
  for(let y=0;y<M.h;y++)for(let x=0;x<M.w;x++){const id=M.data[y*M.w+x];if(id>0)mapx.drawImage(ts[id-1],x*TILE*z,y*TILE*z,TILE*z,TILE*z)}
  mapx.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--grid');mapx.lineWidth=1;mapx.beginPath();
  for(let x=1;x<M.w;x++){mapx.moveTo(x*TILE*z+0.5,0);mapx.lineTo(x*TILE*z+0.5,H)}for(let y=1;y<M.h;y++){mapx.moveTo(0,y*TILE*z+0.5);mapx.lineTo(W,y*TILE*z+0.5)}mapx.stroke();
  if(M.goal){const g=M.goal;mapx.fillStyle='#ff6b94';mapx.fillRect(g[0]*TILE*z+z*7,g[1]*TILE*z-z*TILE+z*1,z*2,z*TILE*2-z*1);mapx.fillRect(g[0]*TILE*z+z*9,g[1]*TILE*z-z*TILE+z*1,z*6,z*4);
    mapx.strokeStyle='#ff6b94';mapx.lineWidth=2;mapx.strokeRect(g[0]*TILE*z+1,g[1]*TILE*z+1,TILE*z-2,TILE*z-2);mapx.fillStyle='#ff6b94';mapx.font='bold '+(5*z)+'px monospace';mapx.fillText('META',g[0]*TILE*z-2,g[1]*TILE*z-z*TILE-3)}
  const sp=M.spawn;mapx.strokeStyle='#4fd6c4';mapx.lineWidth=2;mapx.strokeRect(sp[0]*TILE*z+1,sp[1]*TILE*z+1,TILE*z-2,TILE*z-2);
  mapx.fillStyle='#4fd6c4';mapx.font='bold '+(5*z)+'px monospace';mapx.fillText('INICIO',sp[0]*TILE*z-2,sp[1]*TILE*z-3);
  $('mw').value=M.w;$('mh').value=M.h;$('minfo').textContent=M.w+'×'+M.h+' tiles · '+(M.w*TILE)+'×'+(M.h*TILE)+' px'+(M.goal?'':' · sin meta')}
function mcell(e){const r=mapc.getBoundingClientRect();return {x:Math.floor((e.clientX-r.left)*(mapc.width/r.width)/(TILE*UI.mzoom)),y:Math.floor((e.clientY-r.top)*(mapc.height/r.height)/(TILE*UI.mzoom))}}
function mapPaint(e){const c=mcell(e),M=P.map;if(c.x<0||c.y<0||c.x>=M.w||c.y>=M.h)return;
  if(UI.mtool==='spawn'){M.spawn=[c.x,c.y]}else if(UI.mtool==='goal'){M.goal=[c.x,c.y]}else M.data[c.y*M.w+c.x]=UI.mtool==='erase'?0:UI.mtile;renderMap();dirty()}
mapc.addEventListener('pointerdown',e=>{mdrag=true;mapc.setPointerCapture(e.pointerId);mapPaint(e)});
mapc.addEventListener('pointermove',e=>{if(mdrag&&UI.mtool!=='spawn'&&UI.mtool!=='goal')mapPaint(e)});
mapc.addEventListener('pointerup',()=>{mdrag=false});mapc.addEventListener('pointercancel',()=>{mdrag=false});
$('mbgT').onchange=renderMap;
$('mApply').onclick=()=>{const nw=clamp(+$('mw').value|0,16,120),nh=clamp(+$('mh').value|0,9,60),M=P.map,nd=new Uint8Array(nw*nh);
  for(let y=0;y<Math.min(nh,M.h);y++)for(let x=0;x<Math.min(nw,M.w);x++)nd[y*nw+x]=M.data[y*M.w+x];
  P.map={w:nw,h:nh,data:nd,spawn:[Math.min(M.spawn[0],nw-1),Math.min(M.spawn[1],nh-1)],goal:M.goal&&M.goal[0]<nw&&M.goal[1]<nh?M.goal:null};renderMap();dirty()};
confirmBtn($('mClear'),()=>{P.map.data.fill(0);P.map.goal=null;renderMap();dirty()});
$('mTest').onclick=()=>setView('play');

/* ---------- juego ---------- */
let game=null;
function sheetCanvas(){const s=P.size,maxF=Math.max(...CLIP_DEFS.map(d=>P.clips[d[0]].frames.length)),cv=document.createElement('canvas');cv.width=maxF*s;cv.height=CLIP_DEFS.length*s;const x=cv.getContext('2d');
  CLIP_DEFS.forEach((d,r)=>P.clips[d[0]].frames.forEach((f,i)=>x.drawImage(bufCanvas(f,s,s),i*s,r*s)));return cv}
function tilesetCanvas(){const cv=document.createElement('canvas');cv.width=NTILES*TILE;cv.height=TILE;const x=cv.getContext('2d');P.tiles.forEach((b,i)=>x.drawImage(bufCanvas(b,TILE,TILE),i*TILE,0));return cv}
function gameMeta(){
  const clips={};CLIP_DEFS.forEach((d,r)=>{const c=P.clips[d[0]];clips[d[0]]={row:r,frames:c.frames.length,fps:c.fps,loop:c.loop}});
  return {vw:BGW,vh:BGH,tile:TILE,size:P.size,clips,solid:P.solid.slice(),
    levels:P.levels.map(l=>({name:l.name,map:{w:l.map.w,h:l.map.h,data:Array.from(l.map.data),spawn:l.map.spawn.slice(),goal:l.map.goal?l.map.goal.slice():null}}))}}
function gameData(){const D=gameMeta();D.sheet=sheetCanvas();D.tileset=tilesetCanvas();D.start=P.lv;D.levels.forEach((l,i)=>{l.bgs=P.levels[i].bg.map(b=>bufCanvas(b,BGW,BGH))});return D}
function startGame(){stopGame();const D=gameData();D.onLevel=i=>{if(P.lv!==i){P.lv=i;refreshLevels()}};game=makeGame($('game'),D);game.start();$('game').focus({preventScroll:true})}
function stopGame(){if(game){game.stop();game=null}}
$('gReset').onclick=()=>{if(game)game.reset();$('game').focus({preventScroll:true})};
document.querySelectorAll('#pad button').forEach(b=>{const k=b.dataset.k;
  const on=e=>{e.preventDefault();if(game)game.setKey(k,1)},off=e=>{e.preventDefault();if(game)game.setKey(k,0)};
  b.addEventListener('pointerdown',on);b.addEventListener('pointerup',off);b.addEventListener('pointerleave',off);b.addEventListener('pointercancel',off)});

/* ---------- exportar ---------- */
function atlasObj(){
  const s=P.size,anim={},frames={};
  CLIP_DEFS.forEach((d,r)=>{const c=P.clips[d[0]];anim[d[0]]={row:r,frames:c.frames.length,fps:c.fps,loop:c.loop};c.frames.forEach((f,i)=>{frames[d[0]+'_'+i]={x:i*s,y:r*s,w:s,h:s}})});
  return {tool:'Forja de Píxeles',image:'spritesheet.png',frameSize:s,facing:'derecha',
    notas:'Todos los frames miran a la derecha. wallhang y wallclimb dibujan la pared a la derecha del personaje; para una pared a la izquierda, refleja el sprite en horizontal.',
    anchor:{x:s/2,y:Math.round(s*31/32),nota:'punto de apoyo de los pies dentro de cada frame'},
    hitbox:{width:Math.max(6,Math.round(s*0.28)),height:Math.round(s*0.8),nota:'caja de colisión sugerida, con origen en los pies'},animations:anim,frames}}
function levelsObj(){return {tileSize:TILE,tileset:'tileset.png',tilesetColumns:NTILES,solidTiles:P.solid.slice(),
  nota:'data va por filas, de arriba a abajo. 0 = vacío; 1..16 = tile número N del tileset (columna N-1). spawn y goal están en coordenadas de tile (goal puede ser null).',
  levels:P.levels.map((l,i)=>({name:l.name,width:l.map.w,height:l.map.h,spawn:{tileX:l.map.spawn[0],tileY:l.map.spawn[1]},goal:l.map.goal?{tileX:l.map.goal[0],tileY:l.map.goal[1]}:null,
    background:['cielo','lejos','cerca'].map(n=>'bg_'+(i+1)+'_'+n+'.png'),data:Array.from(l.map.data)}))}}
const toBlob=cv=>new Promise(res=>cv.toBlob(res,'image/png'));
async function pngBytes(cv){return new Uint8Array(await (await toBlob(cv)).arrayBuffer())}
async function saveFile(name,data){
  if(dl){try{await dl.save({filename:name,data});toast('Guardado: '+name);return true}
    catch(e){if(e&&e.code==='declined')return false}}
  try{const type=/\.json$/.test(name)?'application/json':/\.html$/.test(name)?'text/html':/\.png$/.test(name)?'image/png':/\.zip$/.test(name)?'application/zip':'text/plain';
    const blob=data instanceof Blob?data:new Blob([data],{type});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),5000);toast('Descargado: '+name);return true}
  catch(e){toast('No se pudo descargar: '+((e&&e.message)||'error'));return false}}
function gameHtml(){
  const D=gameMeta();
  const eng=makeGame.toString();
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Juego de prueba</title>'+
  '<style>html,body{margin:0;height:100%;background:#0e0b16;color:#ddd;font:14px system-ui,sans-serif}body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px}canvas{width:min(96vw,calc(96vh*16/9));image-rendering:pixelated;background:#101018;outline:none}p{margin:0;opacity:.7}</style></head><body>'+
  '<canvas id="c" tabindex="0"></canvas><p>Mover: ← → · Saltar: Espacio · Correr: Shift · Colgarte: empuja hacia una pared en el aire · Trepar: ↑ ↓</p>'+
  '<script>\nconst D='+JSON.stringify(D)+';\nfunction clamp(v,a,b){return Math.max(a,Math.min(b,v))}\n'+eng+'\n'+
  'function load(s){return new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=()=>no(new Error("No se pudo cargar "+s));i.src=s})}\n'+
  'const bgNames=D.levels.map((l,i)=>["cielo","lejos","cerca"].map(n=>"bg_"+(i+1)+"_"+n+".png"));\n'+
  'Promise.all([load("spritesheet.png"),load("tileset.png"),...bgNames.map(r=>Promise.all(r.map(load)))]).then(([sheet,tileset,...bgs])=>{D.sheet=sheet;D.tileset=tileset;D.levels.forEach((l,i)=>{l.bgs=bgs[i]});const g=makeGame(document.getElementById("c"),D);g.start();document.getElementById("c").focus()}).catch(e=>{document.body.append(e.message+" (abre este archivo junto a los .png)")});\n'+
  '<'+'/script></body></html>'}
function claudeGuide(){
  const s=P.size,a=atlasObj();
  return '# Assets de mi juego (hechos con Forja de Píxeles)\n\n'+
  '## Qué hay en este paquete\n'+
  '- `spritesheet.png` + `atlas.json`: personaje de '+s+'×'+s+' px. Una fila por movimiento: '+CLIP_DEFS.map((d,i)=>d[0]+' (fila '+i+')').join(', ')+'.\n'+
  '- `tileset.png` + `levels.json`: tiles de '+TILE+'×'+TILE+' px en una sola fila y '+P.levels.length+' nivel(es) ('+P.levels.map(l=>l.name+' '+l.map.w+'×'+l.map.h).join(', ')+'). Cada nivel trae `data` (tiles), `spawn`, `goal` y sus 3 fondos. `solidTiles` lista los tiles que bloquean.\n'+
  '- `bg_N_cielo.png`, `bg_N_lejos.png`, `bg_N_cerca.png` (N = número de nivel): tres capas de '+BGW+'×'+BGH+' px que se repiten en horizontal (parallax).\n'+
  '- `project.json`: proyecto editable completo (paleta + todos los píxeles). Se puede volver a cargar en la app con Importar.\n'+
  '- `game.html`: juego de prueba con todos los niveles (plataformas, salto, colgarse y trepar paredes, salto de pared, meta que pasa al nivel siguiente).\n\n'+
  '## Convenciones\n'+
  '- Todos los frames miran a la derecha; para ir a la izquierda, refleja el sprite.\n'+
  '- `wallhang` y `wallclimb` tienen la pared a la derecha del personaje.\n'+
  '- Punto de apoyo de los pies: x='+a.anchor.x+', y='+a.anchor.y+' dentro del frame. Caja de colisión sugerida: '+a.hitbox.width+'×'+a.hitbox.height+' px.\n'+
  '- El estado de movimiento se elige así: en el suelo parado = idle; en el suelo con velocidad = walk o run; subiendo = jump; cayendo = fall; pegado a una pared = wallhang (quieto) o wallclimb (subiendo o bajando).\n\n'+
  '## Formato de project.json ("forja-pixel-2")\n'+
  '- `palette`: lista de colores `#rrggbb`. El carácter `1` es el color 1, `2` el 2… (orden: `1-9 a-z A-Z 0 ! # $ % & * + - / : ; < = > ? @ ^ ~`, hasta 81 colores). `.` es transparente.\n'+
  '- `clips`: un movimiento por nombre, con `fps`, `loop` y `frames` (cada frame = lista de filas de texto del mismo ancho y alto que `size`).\n'+
  '- `tiles`: 16 tiles de 16×16 en texto. `solid`: números de tile (1 a 16) que bloquean.\n'+
  '- `levels`: lista de niveles. Cada uno: `name`, `scene` (opcional), `map:{w,h,spawn:[x,y],goal:[x,y],rows}`. En `rows`, `1-9 a-g` son los tiles 1 a 16, `S` marca el inicio y `M` la meta; todo lo demás es vacío.\n'+
  '- Fondos: si un nivel NO trae `bg` y su `scene` es una de ('+SCENES.map(x=>x[0]).join(', ')+'), la app lo genera sola. Si trae `bg`, son 3 capas de '+BGW+'×'+BGH+' filas de texto.\n\n'+
  '## Qué puedes pedirle a Claude\n'+
  '- "Crea un nivel de nieve con saltos largos y paredes para trepar; devuélveme el project.json completo."\n'+
  '- "Dibújame otro personaje (un robot, una bruja…) con los 7 movimientos, mismo tamaño y paleta."\n'+
  '- "Convierte esto en un juego con Phaser 3 / Godot / canvas puro usando atlas.json y levels.json."\n\n'+
  '## Cómo devolver cambios a la app\n'+
  'Claude puede editar `project.json` y devolverlo completo. En la app: Exportar → Importar proyecto → pegar o subir el JSON. Todas las filas de un frame miden lo mismo que el tamaño del sprite.\n'}
async function buildZip(){
  const enc=new TextEncoder(),files=[];
  files.push({name:'spritesheet.png',data:await pngBytes(sheetCanvas())},{name:'tileset.png',data:await pngBytes(tilesetCanvas())});
  for(let li=0;li<P.levels.length;li++)for(let i=0;i<3;i++)files.push({name:'bg_'+(li+1)+'_'+['cielo','lejos','cerca'][i]+'.png',data:await pngBytes(bufCanvas(P.levels[li].bg[i],BGW,BGH))});
  files.push({name:'atlas.json',data:enc.encode(JSON.stringify(atlasObj(),null,2))},{name:'levels.json',data:enc.encode(JSON.stringify(levelsObj()))},
    {name:'project.json',data:enc.encode(JSON.stringify(projectToObj(P,true)))},{name:'game.html',data:enc.encode(gameHtml())},{name:'LEEME_CLAUDE.md',data:enc.encode(claudeGuide())});
  return makeZip(files)}
function claudeText(){
  const o=projectToObj(P,false);
  return claudeGuide().replace('# Assets de mi juego','# Quiero hacer un juego con estos assets').replace(/## Qué hay en este paquete[\s\S]*?## Convenciones/,'## Qué tienes aquí\nA continuación va el proyecto de pixel art (sin los fondos, que se generan solos con `scene`). Incluye el personaje con sus movimientos, los tiles y los niveles (mapas en texto).\n\n## Convenciones')+
  '\n## Mi petición\n(escribe aquí lo que quieres que haga Claude)\n\n## Datos del proyecto (JSON)\n```json\n'+JSON.stringify(o)+'\n```\n'}
async function copyText(txt,out){let ok=false;try{await navigator.clipboard.writeText(txt);ok=true}catch(e){}
  if(!ok){const ta=el('textarea',{rows:'6','aria-label':'Texto para copiar'});ta.value=txt;out.textContent='';out.append(ta);ta.focus();ta.select();try{ok=document.execCommand('copy')}catch(e){}
    toast(ok?'Copiado':'Selecciona el texto y cópialo (Ctrl+C)');return}
  out.textContent='Copiado ('+Math.round(txt.length/1000)+' mil caracteres). Pégalo en un chat con Claude.';toast('Copiado al portapapeles')}
function renderExport(){const cv=sheetCanvas(),t=$('sheetpv');t.width=cv.width;t.height=cv.height;t.style.width=cv.width*Math.max(1,Math.floor(560/cv.width))+'px';const x=t.getContext('2d');x.imageSmoothingEnabled=false;x.clearRect(0,0,t.width,t.height);x.drawImage(cv,0,0);loadGallery()}
$('xZip').onclick=async()=>{toast('Preparando ZIP…');try{await saveFile('forja-pixel.zip',await buildZip())}catch(e){toast('No se pudo crear el ZIP: '+e.message)}};
$('xCopy').onclick=()=>copyText(claudeText(),$('xCopyOut'));
$('xSheet').onclick=async()=>saveFile('spritesheet.png',await toBlob(sheetCanvas()));
$('xAtlas').onclick=()=>saveFile('atlas.json',JSON.stringify(atlasObj(),null,2));
$('xTiles').onclick=async()=>saveFile('tileset.png',await toBlob(tilesetCanvas()));
$('xMap').onclick=()=>saveFile('levels.json',JSON.stringify(levelsObj()));
$('xBg').onclick=async()=>{const L=P.levels[P.lv];for(let i=0;i<3;i++){if(!await saveFile('bg_'+(P.lv+1)+'_'+['cielo','lejos','cerca'][i]+'.png',await toBlob(bufCanvas(L.bg[i],BGW,BGH))))break}};
$('xProj').onclick=()=>saveFile('proyecto.json',JSON.stringify(Object.assign(projectToObj(P,true))));
$('xProjLite').onclick=()=>saveFile('proyecto.json',JSON.stringify(projectToObj(P,false),null,1));
$('xGame').onclick=()=>saveFile('game.html',gameHtml());
function importText(txt){
  const i=txt.indexOf('{'),j=txt.lastIndexOf('}');if(i<0||j<i)throw new Error('No encuentro un JSON en el texto.');
  P=objToProject(JSON.parse(txt.slice(i,j+1)));clearUndo();UI.clip='idle';UI.frame=0;UI.tile=0;UI.color=1;bootUI();dirty()}
$('impGo').onclick=()=>{try{importText($('impText').value);$('impOut').textContent='Proyecto cargado.';toast('Proyecto cargado')}catch(e){$('impOut').textContent='No se pudo cargar: '+e.message}};
$('impFile').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{importText(String(r.result));$('impOut').textContent='Proyecto cargado.';toast('Proyecto cargado')}catch(er){$('impOut').textContent='No se pudo cargar: '+er.message}};r.readAsText(f)};

/* ---------- galería: proyectos de la carpeta /proyectos del repositorio ---------- */
let gallery=null;
async function loadGallery(){
  if(gallery!==null)return;gallery=[];const sel=$('galSel'),out=$('galOut');
  try{const r=await fetch('proyectos/index.json',{cache:'no-cache'});if(!r.ok)throw new Error('HTTP '+r.status);gallery=(await r.json()).proyectos||[]}
  catch(e){gallery=null;out.textContent='La galería necesita abrir la app desde GitHub Pages o un servidor (no funciona con doble clic en el archivo).';$('galGo').disabled=true;return}
  sel.innerHTML=gallery.map((g,i)=>'<option value="'+i+'">'+String(g.nombre).replace(/[<>&]/g,'')+'</option>').join('');
  $('galGo').disabled=!gallery.length;showGalDesc()}
function showGalDesc(){const g=gallery&&gallery[+$('galSel').value];$('galOut').textContent=g?(g.descripcion||''):''}
$('galSel').onchange=showGalDesc;
$('galGo').onclick=async()=>{const g=gallery&&gallery[+$('galSel').value];if(!g)return;
  try{const r=await fetch('proyectos/'+g.archivo,{cache:'no-cache'});if(!r.ok)throw new Error('HTTP '+r.status);importText(await r.text());toast('Abierto: '+g.nombre)}
  catch(e){$('galOut').textContent='No se pudo abrir: '+e.message}};

/* ---------- Pedir a Claude (sample) ---------- */
let aiCtl=null;
$('aiGo').onclick=async()=>{
  if(!sampleFn){$('aiOut').textContent='Esta función solo está disponible dentro de Claude.';return}
  const ask=$('aiText').value.trim();if(!ask){$('aiOut').textContent='Escribe qué quieres mejorar.';return}
  const {buf,w,h}=cur(),used=new Set(buf);const legend=[];for(let i=1;i<P.pal.length;i++)legend.push(PAL_CHARS[i-1]+'='+P.pal[i]);
  const prompt='Eres artista de pixel art para videojuegos. Te paso un dibujo de '+w+'x'+h+' píxeles como '+h+' filas de texto de '+w+' caracteres. "." es transparente; cualquier otro carácter es un color de la paleta.\n\n'+
    'Paleta: '+legend.join(' ')+'\n\nDibujo actual:\n'+bufRows(buf,w,h).join('\n')+'\n\nInstrucción de la persona: '+ask+'\n\n'+
    'Reglas: mantén exactamente '+w+' columnas y '+h+' filas; usa solo "." y caracteres de la paleta; conserva la silueta y la pose salvo que la instrucción pida cambiarlas; no añadas texto fuera del JSON.\n'+
    'Responde únicamente con un JSON de esta forma: {"rows":["...","..."],"nota":"una frase sobre qué cambiaste"}';
  aiCtl=new AbortController();$('aiGo').disabled=true;$('aiStop').hidden=false;$('aiOut').textContent='Claude está dibujando…';
  try{const r=await sampleFn.json(prompt,{signal:aiCtl.signal,modelTier:'default',cache:false});
    const nb=rowsBuf(r.rows,w,h,P.pal.length-1),prev=buf.slice();buf.set(nb);pushUndo(buf,prev);afterEdit();$('aiOut').textContent=(r.nota?String(r.nota):'Listo.')+' Puedes deshacer con Ctrl+Z.'}
  catch(e){const code=e&&e.code;$('aiOut').textContent=code==='cancelled'?'Detenido.':code==='not_granted'?'No diste permiso para usar Claude en esta página.':code==='rate_limited'?'Demasiadas peticiones. Espera un momento.':code==='invalid_json'?'La respuesta no tuvo el formato esperado. Prueba de nuevo con una instrucción más concreta.':('No se pudo aplicar: '+((e&&e.message)||'error'))}
  finally{$('aiGo').disabled=false;$('aiStop').hidden=true;aiCtl=null}};
$('aiStop').onclick=()=>{if(aiCtl)aiCtl.abort()};

/* ---------- Crear con IA (js/ia.js arma las instrucciones y lee la respuesta) ---------- */
const IA={base:0,stage:null,res:null,snap:null,tok:0,err:'',ctl:null,clips:new Set()};
const IA_PRESETS=[['Juego completo',{pj:1,tl:1,fo:0,nv:1,n:3}],['Solo personaje',{pj:1,tl:0,fo:0,nv:0}],['Solo niveles',{pj:0,tl:0,fo:0,nv:1,n:2}],['Solo fondos',{pj:0,tl:0,fo:1,nv:0}],['Solo tiles',{pj:0,tl:1,fo:0,nv:0}]];
function iaSync(){for(const [c,o] of [['iaPj','iaPjOpt'],['iaTl','iaTlOpt'],['iaFo','iaFoOpt'],['iaNv','iaNvOpt']])$(o).hidden=!$(c).checked}
function iaClips(){const box=$('iaClips');box.textContent='';
  CLIP_DEFS.forEach(d=>{const b=el('button',{class:'chip',type:'button','aria-pressed':String(IA.clips.has(d[0]))},[document.createTextNode(d[1])]);
    b.onclick=()=>{IA.clips.has(d[0])?IA.clips.delete(d[0]):IA.clips.add(d[0]);iaClips()};box.append(b)})}
(function iaStatic(){
  const pb=$('iaPresets');
  IA_PRESETS.forEach(([n,v])=>{const b=el('button',{class:'chip',type:'button',text:n});
    b.onclick=()=>{$('iaPj').checked=!!v.pj;$('iaTl').checked=!!v.tl;$('iaFo').checked=!!v.fo;$('iaNv').checked=!!v.nv;if(v.n)$('iaN').value=v.n;IA.clips.clear();iaClips();iaSync()};pb.append(b)});
  ['iaPj','iaTl','iaFo','iaNv'].forEach(id=>{$(id).onchange=iaSync});iaClips();iaSync()})();
function renderIA(){
  const sz=$('iaSize'),prev=sz.value;
  sz.innerHTML='<option value="'+P.size+'">Mantener el actual ('+P.size+' px)</option>'+[16,24,32,48,64].filter(s=>s!==P.size).map(s=>'<option value="'+s+'">'+s+' px</option>').join('');
  sz.value=[...sz.options].some(o=>o.value===prev)?prev:String(P.size);
  const fo=$('iaFondos'),fv=fo.value;
  fo.innerHTML='<option value="actual">Solo el nivel actual ('+(P.lv+1)+' «'+P.levels[P.lv].name.replace(/[<>&]/g,'')+'»)</option>'+(P.levels.length>1?'<option value="todos">Todos los niveles ('+P.levels.length+')</option>':'');
  if(fv&&[...fo.options].some(o=>o.value===fv))fo.value=fv;
  $('iaDirect').hidden=!sampleFn;iaSync()}
function iaOpts(){
  const o={descripcion:$('iaDesc').value},n=v=>Math.round(+v)||0;
  if($('iaPj').checked){o.personaje={size:+$('iaSize').value||P.size};o.movimientos=[...IA.clips]}
  if($('iaTl').checked)o.tiles=$('iaTiles').value;
  if($('iaFo').checked)o.fondos=$('iaFondos').value;
  if($('iaNv').checked)o.niveles={n:clamp(n($('iaN').value)||1,1,5),w:clamp(n($('iaW').value)||40,16,120),h:clamp(n($('iaH').value)||18,9,60),dificultad:$('iaDif').value};
  return(o.personaje||o.tiles||o.fondos||o.niveles)?o:null}
function iaBuild(avisar){const o=iaOpts();if(!o){if(avisar)toast('Marca al menos una cosa para crear.');return null}
  const r=iaPrompt(P,o);IA.base=r.base;$('iaPromptView').value=r.texto;return r.texto}
$('iaCopy').onclick=()=>{const t=iaBuild(true);if(t)copyText(t,$('iaCopyOut'))};
$('iaDet').addEventListener('toggle',()=>{if($('iaDet').open&&!iaBuild(false))$('iaPromptView').value='Marca al menos una cosa para crear.'});
$('iaDirect').onclick=async()=>{
  if(!sampleFn){$('iaMsg').textContent='Esta función solo está disponible dentro de Claude.';return}
  const t=iaBuild(true);if(!t)return;const m=$('iaMsg');
  IA.ctl=new AbortController();$('iaDirect').disabled=true;$('iaStop').hidden=false;m.className='out';m.textContent='Claude está creando… (puede tardar un minuto)';
  try{const r=await sampleFn.json(t,{signal:IA.ctl.signal,modelTier:'default',cache:false});$('iaResp').value=JSON.stringify(r);iaReview()}
  catch(e){const code=e&&e.code;m.className='out bad';m.textContent=code==='cancelled'?'Detenido.':code==='not_granted'?'No diste permiso para usar Claude en esta página.':code==='rate_limited'?'Demasiadas peticiones. Espera un momento.':code==='invalid_json'?'La respuesta no tuvo el formato esperado. Prueba otra vez o usa «Copiar instrucciones».':('No se pudo crear: '+((e&&e.message)||'error'))}
  finally{$('iaDirect').disabled=false;$('iaStop').hidden=true;IA.ctl=null}};
$('iaStop').onclick=()=>{if(IA.ctl)IA.ctl.abort()};

function cloneProject(p){return objToProject(Object.assign(projectToObj(p,true),{lv:p.lv}))}
function iaFail(msg){IA.err=msg;IA.stage=null;$('iaApplyBtn').disabled=true;$('iaPrev').hidden=true;
  const m=$('iaMsg');m.className='out bad';m.textContent='✗ '+msg;$('iaErrCopy').hidden=false;$('iaErrOut').textContent=''}
function iaReview(){
  const tok=++IA.tok;$('iaErrCopy').hidden=true;$('iaErrOut').textContent='';
  let kit;try{kit=iaParse($('iaResp').value)}catch(e){iaFail(e.message);return}
  let S,res;try{S=cloneProject(P);res=iaApply(S,kit,{base:IA.base||undefined,reemplazar:$('iaWhere').value==='reemplazar'?P.lv:-1})}catch(e){iaFail(e.message);return}
  IA.stage=S;IA.res=res;IA.err='';const m=$('iaMsg');m.className='out';m.textContent='✓ La respuesta es válida. Revisa la vista previa y pulsa «Aplicar al proyecto».';
  iaPreview(S,res,tok);$('iaPrev').hidden=false;$('iaApplyBtn').disabled=false;$('iaPrev').scrollIntoView({behavior:'smooth',block:'nearest'})}
$('iaReview').onclick=iaReview;
$('iaResp').addEventListener('paste',()=>setTimeout(iaReview,60));
$('iaErrCopy').onclick=()=>copyText(iaTextoError(IA.err),$('iaErrOut'));

function palCv(buf,w,h,pal){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d'),id=x.createImageData(w,h);
  for(let i=0;i<buf.length;i++){const v=buf[i];if(v&&pal[v]){const r=hexRgb(pal[v]);id.data[i*4]=r[0];id.data[i*4+1]=r[1];id.data[i*4+2]=r[2];id.data[i*4+3]=255}}
  x.putImageData(id,0,0);return c}
function scaledCv(src,w,h,sc){const c=document.createElement('canvas');c.width=w*sc;c.height=h*sc;const x=c.getContext('2d');x.imageSmoothingEnabled=false;x.drawImage(src,0,0,w*sc,h*sc);return c}
function iaStrip(title,items,w,h,sc,pal){
  const box=el('div'),t=el('div',{class:'px',text:title});t.style.marginBottom='6px';box.append(t);const row=el('div',{class:'iastrip'});
  items.forEach(([cap,buf])=>{const f=el('figure');f.append(scaledCv(palCv(buf,w,h,pal),w,h,sc),el('figcaption',{text:cap}));row.append(f)});box.append(row);return box}
function iaLevelCv(S,li){
  const L=S.levels[li],m=L.map,U=8,W=m.w*U,H=m.h*U,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');x.imageSmoothingEnabled=false;
  x.fillStyle='#101018';x.fillRect(0,0,W,H);const bw=BGW*(H/BGH);
  for(const b of L.bg){const cv=palCv(b,BGW,BGH,S.pal);for(let ox=0;ox<W;ox+=bw)x.drawImage(cv,ox,0,bw,H)}
  const tc=S.tiles.map(t=>palCv(t,TILE,TILE,S.pal));
  for(let y=0;y<m.h;y++)for(let xx=0;xx<m.w;xx++){const v=m.data[y*m.w+xx];if(v)x.drawImage(tc[v-1],xx*U,y*U,U,U)}
  const mark=(p,col,txt)=>{if(!p)return;x.fillStyle=col;x.fillRect(p[0]*U,p[1]*U,U,U);x.fillStyle='#000';x.font='bold '+U+'px monospace';x.textBaseline='top';x.fillText(txt,p[0]*U+1,p[1]*U)};
  mark(m.spawn,'#4fd6c4','S');mark(m.goal,'#ffd36e','M');return c}
function iaCheckRow(S,li,tok){
  const row=el('div',{class:'row'}),b=el('button',{class:'btn sm',type:'button',text:'Comprobar que se puede pasar'}),out=el('span',{class:'note'});let busy=false,cancel=false;
  b.onclick=async()=>{
    if(busy){cancel=true;return}
    busy=true;cancel=false;b.textContent='Cancelar';out.className='note';const t0=Date.now();out.textContent='El robot está probando…';
    const r=await iaAlcanzable(S,li,{tiempoMs:60000,cancelado:()=>cancel||IA.tok!==tok,progreso:()=>{out.textContent='El robot está probando… '+Math.round((Date.now()-t0)/1000)+' s'}});
    busy=false;b.textContent='Comprobar otra vez';
    if(r.ok){out.className='note okc';out.textContent='✓ Se puede llegar a la meta (~'+r.segundos+' s de juego).'}
    else if(r.cancelado)out.textContent='Comprobación cancelada.';
    else{out.className='note warn';out.textContent='⚠ '+r.motivo}};
  row.append(b,out);return row}
function iaPreview(S,res,tok){
  const body=$('iaPrevBody');body.textContent='';const pal=S.pal;
  const ul=el('ul');res.resumen.forEach(t=>ul.append(el('li',{text:t})));body.append(ul);
  if(res.nota)body.append(el('p',{class:'note',text:'Nota de Claude: '+res.nota}));
  if(res.personaje||res.clipsNuevos.length){const sc=Math.max(1,Math.floor(72/S.size));
    body.append(iaStrip('Personaje (primer frame de cada movimiento)',CLIP_DEFS.map(d=>[d[1],S.clips[d[0]].frames[0]]),S.size,S.size,sc,pal));
    for(const n of res.clipsNuevos){const c=S.clips[n];body.append(iaStrip('A mano: '+n+' · '+c.frames.length+' frames · '+c.fps+' fps',c.frames.map((f,i)=>[String(i+1),f]),S.size,S.size,sc,pal))}}
  if(res.tiles.length)body.append(iaStrip('Tiles',res.tiles.map(n=>[n+(S.solid.includes(n)?' ■':''),S.tiles[n-1]]),TILE,TILE,5,pal));
  for(const li of [...new Set(res.niveles)]){const L=S.levels[li],box=el('div',{class:'lvl'});
    box.append(el('div',{class:'px',text:'Nivel '+(li+1)+' · '+L.name+' · '+L.map.w+'×'+L.map.h+(L.theme?' · fondo con colores propios':'')}),iaLevelCv(S,li));
    if(res.creados.includes(li))box.append(iaCheckRow(S,li,tok));body.append(box)}
  if(res.avisos.length){const w=el('ul',{class:'warn'});res.avisos.forEach(t=>w.append(el('li',{text:'⚠ '+t})));body.append(w)}}
$('iaApplyBtn').onclick=()=>{
  if(!IA.stage)return;IA.snap=JSON.stringify(Object.assign(projectToObj(P,true),{lv:P.lv}));
  P=IA.stage;IA.stage=null;IA.base=0;IA.tok++;clearUndo();UI.clip='idle';UI.frame=0;UI.tile=0;UI.color=1;
  bootUI();dirty();renderIA();$('iaApplyBtn').disabled=true;$('iaUndo').hidden=false;
  const m=$('iaMsg');m.className='out';m.textContent='✓ Aplicado. Míralo en Dibujar, Mapa y Probar. Si no te gusta, usa «Deshacer lo aplicado».';toast('Aplicado al proyecto')};
$('iaUndo').onclick=()=>{
  if(!IA.snap)return;try{P=objToProject(JSON.parse(IA.snap))}catch(e){toast('No se pudo deshacer: '+e.message);return}
  IA.snap=null;IA.tok++;clearUndo();UI.clip='idle';UI.frame=0;UI.tile=0;UI.color=1;bootUI();dirty();renderIA();
  $('iaUndo').hidden=true;$('iaApplyBtn').disabled=true;toast('Cambios deshechos')};

/* ---------- teclado ---------- */
document.addEventListener('keydown',e=>{
  const t=e.target,tag=t&&t.tagName;if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return;
  if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key.toLowerCase()==='z'){if(UI.view==='edit'){e.preventDefault();undo()}return}
  if((e.ctrlKey||e.metaKey)&&(e.key.toLowerCase()==='y'||(e.shiftKey&&e.key.toLowerCase()==='z'))){if(UI.view==='edit'){e.preventDefault();redo()}return}
  if(UI.view!=='edit'||e.ctrlKey||e.metaKey||e.altKey)return;
  const map={b:'pencil',e:'eraser',g:'fill',l:'line',r:'rect',o:'ell',i:'pick'},k=e.key.toLowerCase();
  if(map[k]){UI.tool=map[k];buildTools()}else if(k==='m'){UI.mirror=!UI.mirror;buildTools();render()}
  else if(UI.obj==='char'&&(e.key==='['||e.key===',')&&UI.frame>0){UI.frame--;buildPanels();render()}
  else if(UI.obj==='char'&&(e.key===']'||e.key==='.')&&UI.frame<P.clips[UI.clip].frames.length-1){UI.frame++;buildPanels();render()}});
window.addEventListener('resize',()=>{if(UI.view==='edit'){autoZoom();render()}});
document.querySelectorAll('.tab').forEach(t=>t.addEventListener('keydown',e=>{const tabs=[...document.querySelectorAll('.tab')],i=tabs.indexOf(t);
  if(e.key==='ArrowRight'){tabs[(i+1)%tabs.length].focus()}else if(e.key==='ArrowLeft'){tabs[(i-1+tabs.length)%tabs.length].focus()}}));

/* ---------- arranque ---------- */
function bootUI(){refreshLevels();buildTools();buildPalette();setObj(UI.obj);updUndo();if(UI.view==='map')renderMap();if(UI.view==='export')renderExport();if(UI.view==='ia')renderIA()}
(function init(){
  let saved=null;try{const s=localStorage.getItem(SAVE_KEY);if(s)saved=objToProject(JSON.parse(s))}catch(e){saved=null}
  P=saved||newProject();bootUI();
  if(window.claude&&window.claude.use){
    window.claude.use('downloads').then(d=>{dl=d}).catch(()=>{});
    window.claude.use('sample').then(s=>{sampleFn=s;if(UI.view==='ia')renderIA();if(!s)$('claudeCard').querySelector('.btn.teal').title='Solo disponible dentro de Claude'}).catch(()=>{});
  }
})();
