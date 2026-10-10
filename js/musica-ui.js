/* ========================================================================
   musica-ui.js · pestaña «Música» (DOM). Usa P, $, el, toast, copyText, saveFile, dirty, sampleFn y setView de app.js,
   y todo lo de musica.js (makeAudio, ejemplos, musicaPrompt…).
   ======================================================================== */
const AUD=makeAudio(musicaPorDefecto());
const PV=makeAudio({}); /* segundo reproductor, solo para escuchar ejemplos y pruebas sin tocar la música del proyecto */
const MU={song:0,track:0,oct:4,paint:null,sfx:'',cTok:0,cKit:null,cErr:'',cCtl:null,raf:0,noSound:false};
const MU_NOTAS=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const MU_BAT=[['k','Bombo'],['s','Caja'],['h','Hi-hat'],['o','Hi-hat abierto'],['t','Tom'],['c','Platillo']];
const MU_ROWS=24; /* dos octavas visibles */
const muMusic=()=>{if(!P.music)P.music=musicaPorDefecto();return P.music};
const muSong=()=>muMusic().canciones[MU.song]||null;
const muTrack=()=>{const s=muSong();return s?s.pistas[MU.track]||null:null};
const muSync=()=>{AUD.setData(muMusic())};
const muToks=t=>t.notas.split(/\s+/).filter(Boolean);
function muPlaySfx(nombre){muSync();AUD.unlock();AUD.sfx(nombre)}
function muStopSong(){AUD.stopSong();$('mPlay').textContent='▶ Escuchar'}
function muSongOpt(i,c){return '<option value="'+i+'">'+(i+1)+'. '+c.nombre.replace(/[<>&]/g,'')+'</option>'}

/* ---------- audio dentro del juego (las usa app.js) ---------- */
function audioEvento(ev){if(MU.noSound)return;AUD.event(ev)}
function audioNivel(i){muSync();const l=P.levels[i],c=l&&Number.isInteger(l.cancion)?l.cancion:-1;if(c>=0&&!MU.noSound){AUD.playSong(c)}else AUD.stopSong()}
function audioParar(){AUD.stopSong()}
function musicaSalir(){muStopSong()}
$('sndOn').onchange=e=>{MU.noSound=!e.target.checked;muSync();if(MU.noSound)AUD.stopSong();else if(UI.view==='play')audioNivel(P.lv)};
function audioArchivos(){
  const m=muMusic(),A=makeAudio(m),out=[];
  m.canciones.forEach((c,i)=>out.push({name:'musica/'+(i+1)+'_'+musicaIdLibre({},c.nombre)+'.wav',data:A.wav(A.cancion(c))}));
  for(const k of Object.keys(m.sonidos))out.push({name:'sonidos/'+k+'.wav',data:A.wav(A.sonido(m.sonidos[k]))});
  return out}

/* ---------- cuadrícula de notas ---------- */
const roll=$('mRoll'),rx=roll.getContext('2d');
const CELL_W=16,CELL_H=10,LAB=34;
function muCols(){const s=muSong();return s?s.pasos:32}
function muRowsInfo(t){
  if(!t)return {n:0,label:i=>''};
  if(t.voz==='ruido')return {n:MU_BAT.length,label:i=>MU_BAT[i][1],tok:i=>MU_BAT[i][0]};
  /* fila 0 = nota más aguda de la ventana */
  const top=(MU.oct+2)*12-1;return {n:MU_ROWS,midi:i=>top-i,label:i=>{const m=top-i;return MU_NOTAS[m%12]+(Math.floor(m/12))},tok:i=>{const m=top-i;return MU_NOTAS[m%12]+Math.floor(m/12)}}}
function muTokRow(info,tok,t){
  if(t.voz==='ruido'){const k=MU_BAT.findIndex(b=>b[0]===tok);return k}
  const m=/^([A-G])([#b]?)(\d)$/.exec(tok);if(!m)return -1;
  const semi={C:0,D:2,E:4,F:5,G:7,A:9,B:11}[m[1]]+(m[2]==='#'?1:m[2]==='b'?-1:0),midi=(+m[3])*12+semi,top=(MU.oct+2)*12-1,r=top-midi;return r>=0&&r<info.n?r:-1}
function muAutoOct(t){
  if(t.voz==='ruido')return MU.oct;const v=[];for(const x of muToks(t)){const m=/^([A-G])([#b]?)(\d)$/.exec(x);if(m)v.push((+m[3])*12+{C:0,D:2,E:4,F:5,G:7,A:9,B:11}[m[1]]+(m[2]==='#'?1:m[2]==='b'?-1:0))}
  if(!v.length)return t.voz==='triangulo'||t.voz==='sierra'||t.voz==='seno'?2:4;
  return clamp(Math.floor(Math.min(...v)/12),0,5)}
function muCss(n){return getComputedStyle(document.documentElement).getPropertyValue(n).trim()||'#888'}
function drawRoll(){
  const t=muTrack(),s=muSong();if(!t||!s){roll.width=LAB+CELL_W*8;roll.height=60;rx.clearRect(0,0,roll.width,roll.height);return}
  const info=muRowsInfo(t),cols=s.pasos,W=LAB+cols*CELL_W,H=info.n*(t.voz==='ruido'?CELL_H*2:CELL_H),ch=H/info.n;
  roll.width=W;roll.height=H;rx.clearRect(0,0,W,H);
  const fg=muCss('--fg'),line=muCss('--line'),acc=muCss('--accent'),teal=muCss('--teal'),p2=muCss('--panel2'),muted=muCss('--muted');
  const ppp=s.pasos_por_pulso||2,perBar=ppp*4;
  for(let r=0;r<info.n;r++){const lab=info.label(r),black=t.voz!=='ruido'&&lab.indexOf('#')>=0;
    rx.fillStyle=black?p2:'transparent';rx.fillRect(LAB,r*ch,W-LAB,ch);
    if(t.voz!=='ruido'&&lab[0]==='C'&&lab.indexOf('#')<0){rx.fillStyle=line;rx.fillRect(LAB,r*ch+ch-1,W-LAB,1)}
    rx.fillStyle=muted;rx.font='8px monospace';rx.textBaseline='middle';rx.fillText(t.voz==='ruido'?lab.slice(0,5):lab,2,r*ch+ch/2)}
  for(let c=0;c<=cols;c++){rx.fillStyle=c%perBar===0?muted:(c%ppp===0?line:p2);rx.fillRect(LAB+c*CELL_W,0,1,H)}
  const tk=muToks(t);
  for(let c=0;c<cols;c++){const tok=tk[c];if(!tok||tok==='.'||tok==='-')continue;
    const r=muTokRow(info,tok,t);if(r<0)continue;let L=1;if(t.voz!=='ruido')while(c+L<cols&&tk[c+L]==='-')L++;
    rx.fillStyle=t.voz==='ruido'?teal:acc;rx.fillRect(LAB+c*CELL_W+1,r*ch+1,L*CELL_W-2,ch-2)}
  /* notas que quedan fuera de la ventana */
  if(t.voz!=='ruido'){let fuera=false;for(const x of tk){if(x!=='.'&&x!=='-'&&muTokRow(info,x,t)<0)fuera=true}
    $('mOctInfo').textContent='Ventana: '+info.label(info.n-1)+' a '+info.label(0)+(fuera?' · hay notas fuera de la ventana (usa ▲ ▼)':'')}
  else $('mOctInfo').textContent='Batería: una fila por sonido'}
function muPlayhead(){
  cancelAnimationFrame(MU.raf);
  const loop=()=>{drawRoll();const s=muSong(),pos=AUD.songPos();
    if(s&&pos>=0&&AUD.playing()===MU.song){const stepDur=60/s.bpm/(s.pasos_por_pulso||2),col=pos/stepDur;rx.fillStyle='rgba(255,255,255,.35)';rx.fillRect(LAB+Math.floor(col)*CELL_W,0,CELL_W,roll.height);MU.raf=requestAnimationFrame(loop)}
    else{$('mPlay').textContent='▶ Escuchar'}};
  MU.raf=requestAnimationFrame(loop)}
function muSetTokens(t,tk){t.notas=tk.join(' ')}
function muCell(e){
  const r=roll.getBoundingClientRect(),sx=roll.width/r.width,sy=roll.height/r.height,x=(e.clientX-r.left)*sx-LAB,y=(e.clientY-r.top)*sy;
  const t=muTrack(),s=muSong();if(!t||!s||x<0)return null;const info=muRowsInfo(t),ch=roll.height/info.n;
  const c=Math.floor(x/CELL_W),row=Math.floor(y/ch);if(c<0||c>=s.pasos||row<0||row>=info.n)return null;return {c,row,info}}
roll.addEventListener('pointerdown',e=>{
  const h=muCell(e);if(!h)return;e.preventDefault();roll.setPointerCapture(e.pointerId);
  const t=muTrack(),tk=muToks(t),tok=h.info.tok(h.row);
  if(t.voz==='ruido'){const was=tk[h.c]===tok;tk[h.c]=was?'.':tok;muSetTokens(t,tk);if(!was)muPreview(t,tok);MU.paint=null;drawRoll();muTextSync();dirty();return}
  /* tono: ¿hay una nota en esa casilla (inicio o tramo alargado) en esa fila? */
  let st=h.c;while(st>0&&tk[st]==='-')st--;
  const cur=tk[st];
  if(cur&&cur!=='.'&&cur!=='-'&&muTokRow(h.info,cur,t)===h.row&&st<=h.c){
    let L=1;while(st+L<tk.length&&tk[st+L]==='-')L++;if(h.c<st+L){for(let i=st;i<st+L;i++)tk[i]='.';muSetTokens(t,tk);MU.paint=null;drawRoll();muTextSync();dirty();return}}
  /* poner nota nueva (cortando lo que hubiera en esa casilla) */
  tk[h.c]=tok;let k=h.c+1;while(k<tk.length&&tk[k]==='-'){tk[k]='.';k++}
  muSetTokens(t,tk);MU.paint={row:h.row,start:h.c,tok,end:h.c};muPreview(t,tok);drawRoll();muTextSync();dirty()});
roll.addEventListener('pointermove',e=>{
  if(!MU.paint)return;const h=muCell(e);if(!h)return;const t=muTrack(),tk=muToks(t),pt=MU.paint;
  if(h.c<=pt.end||h.c<pt.start)return;
  for(let c=pt.end+1;c<=h.c;c++)tk[c]='-';pt.end=h.c;muSetTokens(t,tk);drawRoll();muTextSync();dirty()});
const muUp=()=>{MU.paint=null};roll.addEventListener('pointerup',muUp);roll.addEventListener('pointercancel',muUp);
/* suena la nota al ponerla, para que se oiga lo que se dibuja */
function muPreview(t,tok){
  const A=PV;if(!A.unlock())return;const d=t.voz==='ruido'?{onda:'ruido',vol:0.6,tramos:{k:[[150,45,140]],s:[[900,300,120]],h:[[8000,8000,40]],o:[[8000,8000,160]],t:[[160,80,180]],c:[[6000,3000,450]]}[tok]||[[800,400,100]]}
    :{onda:t.voz,vol:0.55,tramos:[[Math.round(440*Math.pow(2,(muMidi(tok)-69)/12)),0,170]]};
  d.tramos=d.tramos.map(x=>[x[0],x[1]||x[0],x[2]]);A.setData({sonidos:{p:d},eventos:{},vol:{m:muMusic().vol.m,e:Math.max(0.5,muMusic().vol.e)}});A.sfx('p')}
function muMidi(tok){const m=/^([A-G])([#b]?)(\d)$/.exec(tok);if(!m)return 69;return 12*(+m[3]+1)+{C:0,D:2,E:4,F:5,G:7,A:9,B:11}[m[1]]+(m[2]==='#'?1:m[2]==='b'?-1:0)}

/* ---------- panel de la canción ---------- */
function muTextSync(){const t=muTrack();if($('mText')!==document.activeElement)$('mText').value=t?muToks(t).join(' '):''}
function renderSongPanel(){
  const m=muMusic(),has=m.canciones.length>0;MU.song=clamp(MU.song,0,Math.max(0,m.canciones.length-1));
  $('mSong').innerHTML=has?m.canciones.map((c,i)=>muSongOpt(i,c)).join(''):'<option>(sin canciones)</option>';$('mSong').value=String(MU.song);$('mSong').disabled=!has;
  for(const id of ['mPlay','mDup','mDel'])$(id).disabled=!has;
  $('mSongBox').hidden=!has;$('mRollCard').hidden=!has;$('mEmpty').hidden=has;
  if(!has){renderGame();return}
  const s=muSong();$('mName').value=s.nombre;$('mBpm').value=s.bpm;$('mSteps').value=String(s.pasos);$('mLoop').checked=s.loop!==false;
  const stepsOpts=[16,32,48,64];if(!stepsOpts.includes(s.pasos))$('mSteps').innerHTML=[...stepsOpts,s.pasos].sort((a,b)=>a-b).map(n=>'<option value="'+n+'">'+n+' pasos</option>').join('');
  else $('mSteps').innerHTML=[['16','16 (2 compases)'],['32','32 (4 compases)'],['48','48 (6 compases)'],['64','64 (8 compases)']].map(a=>'<option value="'+a[0]+'">'+a[1]+'</option>').join('');
  $('mSteps').value=String(s.pasos);
  MU.track=clamp(MU.track,0,s.pistas.length-1);
  {const key=MU.song+':'+MU.track;if(MU.lastKey!==key){MU.lastKey=key;MU.oct=muAutoOct(s.pistas[MU.track])}}
  const tr=$('mTracks');tr.textContent='';
  s.pistas.forEach((p,i)=>{const b=el('button',{class:'chip',type:'button','aria-pressed':String(i===MU.track),text:p.nombre});b.onclick=()=>{MU.track=i;renderSongPanel()};tr.append(b)});
  $('mTAdd').disabled=s.pistas.length>=MUS_MAX_PISTAS;$('mTDel').disabled=s.pistas.length<=1;
  const t=muTrack();$('mVoice').value=t.voz;$('mVol').value=Math.round(t.vol*100);
  $('mOctRow').hidden=t.voz==='ruido';
  $('mHelp').textContent=t.voz==='ruido'?'Toca una casilla para poner o quitar un golpe de batería. Cada columna es un paso.':'Toca una casilla para poner una nota; toca otra vez para quitarla. Arrastra hacia la derecha para alargarla. Las líneas gruesas separan los compases.';
  muTextSync();drawRoll();renderGame()}
$('mVoice').innerHTML=MUS_VOCES.map(v=>'<option value="'+v+'">'+MUS_NOMBRE_VOZ[v]+'</option>').join('');
$('sWave').innerHTML=MUS_VOCES.map(v=>'<option value="'+v+'">'+MUS_NOMBRE_VOZ[v]+'</option>').join('');
$('mSong').onchange=e=>{muStopSong();MU.song=+e.target.value;MU.track=0;renderSongPanel()};
$('mPlay').onclick=()=>{
  if(AUD.playing()===MU.song&&AUD.songPos()>=0){muStopSong();return}
  muSync();AUD.stopSong();AUD.unlock();if(AUD.playSong(MU.song)){$('mPlay').textContent='■ Parar';muPlayhead()}else toast('Tu navegador no puede reproducir audio.')};
function muRestart(){if(AUD.playing()===MU.song){muSync();AUD.stopSong();AUD.playSong(MU.song);muPlayhead()}else muSync()}
$('mNew').onclick=()=>{const m=muMusic();if(m.canciones.length>=MUS_MAX_CANCIONES){toast('Máximo '+MUS_MAX_CANCIONES+' canciones.');return}
  m.canciones.push({nombre:'Canción '+(m.canciones.length+1),bpm:120,pasos_por_pulso:2,pasos:32,loop:true,pistas:[
    {nombre:'Melodía',voz:'pulso25',vol:0.5,notas:Array(32).fill('.').join(' ')},{nombre:'Bajo',voz:'triangulo',vol:0.7,notas:Array(32).fill('.').join(' ')},{nombre:'Batería',voz:'ruido',vol:0.55,notas:Array(32).fill('.').join(' ')}]});
  MU.song=m.canciones.length-1;MU.track=0;muStopSong();renderSongPanel();dirty();toast('Canción nueva: toca las casillas para poner notas')};
$('mDup').onclick=()=>{const m=muMusic();if(m.canciones.length>=MUS_MAX_CANCIONES){toast('Máximo '+MUS_MAX_CANCIONES+' canciones.');return}
  const c=JSON.parse(JSON.stringify(muSong()));c.nombre=(c.nombre+' copia').slice(0,40);m.canciones.splice(MU.song+1,0,c);
  for(const l of P.levels)if(Number.isInteger(l.cancion)&&l.cancion>MU.song)l.cancion++;
  MU.song++;renderSongPanel();dirty()};
confirmBtn($('mDel'),()=>{const m=muMusic();muStopSong();m.canciones.splice(MU.song,1);
  for(const l of P.levels){if(l.cancion===MU.song)delete l.cancion;else if(Number.isInteger(l.cancion)&&l.cancion>MU.song)l.cancion--}
  MU.song=Math.max(0,MU.song-1);MU.track=0;renderSongPanel();dirty()});
$('mName').oninput=e=>{muSong().nombre=e.target.value.slice(0,40)||'Canción';const o=$('mSong').options[MU.song];if(o)o.textContent=(MU.song+1)+'. '+muSong().nombre;renderGame();dirty()};
$('mBpm').onchange=e=>{muSong().bpm=Math.round(clamp(+e.target.value||120,50,220));e.target.value=muSong().bpm;muRestart();dirty()};
$('mLoop').onchange=e=>{muSong().loop=e.target.checked;dirty()};
$('mSteps').onchange=e=>{const s=muSong(),n=+e.target.value;
  for(const p of s.pistas){const tk=muToks(p);while(tk.length<n)tk.push('.');tk.length=n;p.notas=tk.join(' ')}
  s.pasos=n;muStopSong();renderSongPanel();dirty()};
$('mTAdd').onclick=()=>{const s=muSong();if(s.pistas.length>=MUS_MAX_PISTAS)return;s.pistas.push({nombre:'Pista '+(s.pistas.length+1),voz:'pulso50',vol:0.4,notas:Array(s.pasos).fill('.').join(' ')});MU.track=s.pistas.length-1;renderSongPanel();dirty()};
confirmBtn($('mTDel'),()=>{const s=muSong();if(s.pistas.length<=1)return;s.pistas.splice(MU.track,1);MU.track=Math.max(0,MU.track-1);muRestart();renderSongPanel();dirty()});
$('mVoice').onchange=e=>{const t=muTrack(),era=t.voz==='ruido',es=e.target.value==='ruido';
  if(era!==es){t.notas=Array(muSong().pasos).fill('.').join(' ');toast(es?'La batería usa golpes, no notas: la pista quedó vacía.':'La pista pasó a tener tono: quedó vacía.')}
  t.voz=e.target.value;if(!/^(Batería|Melodía|Bajo|Pista \d+)$/.test(t.nombre)){}else if(es)t.nombre='Batería';
  muRestart();renderSongPanel();dirty()};
$('mVol').oninput=e=>{muTrack().vol=+e.target.value/100;dirty()};$('mVol').onchange=muRestart;
$('mOctUp').onclick=()=>{MU.oct=Math.min(5,MU.oct+1);drawRoll()};$('mOctDn').onclick=()=>{MU.oct=Math.max(0,MU.oct-1);drawRoll()};
$('mText').oninput=e=>{const t=muTrack(),s=muSong();if(!t)return;
  const tk=e.target.value.split(/\s+/).filter(Boolean),ok=t.voz==='ruido'?MUS_BAT:MUS_NOTA,bad=tk.findIndex(x=>!ok.test(x)),m=$('mTextMsg');
  if(bad>=0){m.className='out bad';m.textContent='Paso '+(bad+1)+': «'+tk[bad]+'» no es válido. Usa notas como C4, F#3, Bb5, «.» silencio y «-» alargar.';return}
  if(tk.length!==s.pasos){m.className='out bad';m.textContent='Hay '+tk.length+' pasos y la canción tiene '+s.pasos+'. Deben ser exactamente '+s.pasos+'.';return}
  m.className='out';m.textContent='✓ '+tk.length+' pasos';t.notas=tk.join(' ');drawRoll();dirty()};
$('mText').onchange=muRestart;
/* nombre de la pista (doble clic en el chip) */
$('mTracks').addEventListener('dblclick',()=>{const t=muTrack();if(!t)return;const n=prompt('Nombre de la pista',t.nombre);if(n!=null&&n.trim()){t.nombre=n.trim().slice(0,40);renderSongPanel();dirty()}});

/* ---------- en tu juego ---------- */
function renderGame(){
  const m=muMusic(),lv=$('mLevels');lv.textContent='';
  const opts='<option value="-1">Sin música</option>'+m.canciones.map((c,i)=>muSongOpt(i,c)).join('');
  P.levels.forEach((l,i)=>{const row=el('div',{class:'evrow'}),lab=el('span',{text:(i+1)+'. '+l.name}),sel=el('select',{'aria-label':'Música del nivel '+(i+1)});
    sel.innerHTML=opts;sel.value=String(Number.isInteger(l.cancion)?l.cancion:-1);
    sel.onchange=()=>{if(+sel.value<0)delete l.cancion;else l.cancion=+sel.value;dirty()};row.append(lab,sel);lv.append(row)});
  const ev=$('mEvents');ev.textContent='';const names=Object.keys(m.sonidos);
  const so='<option value="">Sin sonido</option>'+names.map(n=>'<option value="'+n+'">'+n+'</option>').join('');
  for(const [id,label] of MUS_EVENTOS){const row=el('div',{class:'evrow'}),sel=el('select',{'aria-label':'Sonido de '+label}),b=el('button',{class:'btn sm',type:'button','aria-label':'Probar '+label,text:'▶'});
    sel.innerHTML=so;sel.value=m.eventos[id]||'';
    sel.onchange=()=>{if(sel.value)m.eventos[id]=sel.value;else delete m.eventos[id];dirty();if(sel.value)muPlaySfx(sel.value)};
    b.onclick=()=>{if(m.eventos[id])muPlaySfx(m.eventos[id])};row.append(el('span',{text:label}),sel,b);ev.append(row)}
  $('mVolM').value=Math.round(m.vol.m*100);$('mVolE').value=Math.round(m.vol.e*100)}
$('mVolM').oninput=e=>{muMusic().vol.m=+e.target.value/100;muSync();dirty()};
$('mVolE').oninput=e=>{muMusic().vol.e=+e.target.value/100;muSync();dirty()};
$('mVolE').onchange=()=>{const n=muMusic().eventos.salto;if(n)muPlaySfx(n)};
$('mTry').onclick=()=>setView('play');

/* ---------- ejemplos ---------- */
function exRow(titulo,desc,onPlay,onAdd,addText){
  const r=el('div',{class:'exrow'}),b=el('button',{class:'btn sm',type:'button','aria-label':'Escuchar '+titulo,text:'▶'}),a=el('button',{class:'btn sm',type:'button',text:addText||'Agregar'}),t=el('div',{class:'extxt'});
  t.append(el('b',{text:titulo}));if(desc)t.append(el('small',{text:desc}));b.onclick=onPlay;a.onclick=onAdd;r.append(b,t,a);return r}
function renderExamples(){
  const es=$('mExSongs');es.textContent='';
  MUS_CANCIONES_EJEMPLO.forEach(e=>es.append(exRow(e.c.nombre,e.descripcion,()=>{
      const A=PV;A.setData({canciones:[musicaCancion(e.c)],sonidos:{},eventos:{},vol:muMusic().vol});muStopSong();AUD.stopSong();A.unlock();A.stopSong();A.playSong(0)},
    ()=>{const m=muMusic();if(m.canciones.length>=MUS_MAX_CANCIONES){toast('Máximo '+MUS_MAX_CANCIONES+' canciones. Elimina una para agregar otra.');return}
      m.canciones.push(musicaCancion(e.c));MU.song=m.canciones.length-1;MU.track=0;muStopSong();renderSongPanel();dirty();toast('Agregada: '+e.c.nombre)})));
  const ss=$('mExSfx');ss.textContent='';
  MUS_SONIDOS_EJEMPLO.forEach(e=>ss.append(exRow(e.nombre,'',()=>{const A=PV;A.setData({sonidos:{x:musicaSonido(e.def)},eventos:{},vol:{m:0.6,e:Math.max(0.6,muMusic().vol.e)}});A.sfx('x')},
    ()=>{const m=muMusic();const have=Object.keys(m.sonidos).find(k=>JSON.stringify(m.sonidos[k])===JSON.stringify(musicaSonido(e.def)));
      if(have){toast('«'+have+'» ya está en Mis sonidos.');MU.sfx=have;renderSounds();return}
      if(Object.keys(m.sonidos).length>=MUS_MAX_SONIDOS){toast('Máximo '+MUS_MAX_SONIDOS+' sonidos.');return}
      const id=musicaIdLibre(m.sonidos,e.id);m.sonidos[id]=musicaSonido(e.def);MU.sfx=id;renderSounds();renderGame();dirty();toast('Agregado: '+id+' (elige para qué acción lo usas, arriba)')})))}

/* ---------- mis sonidos ---------- */
function muTramosTxt(d){return d.tramos.map(t=>t.join(' ')).join('\n')}
function drawSfxWave(d){
  const c=$('sWavePv'),x=c.getContext('2d'),f=makeAudio({}).sonido(d),W=c.width,H=c.height;x.clearRect(0,0,W,H);
  x.strokeStyle=muCss('--accent');x.lineWidth=1;x.beginPath();const step=Math.max(1,Math.floor(f.length/W));
  for(let i=0;i<W;i++){let mx=0;for(let k=0;k<step;k++)mx=Math.max(mx,Math.abs(f[i*step+k]||0));const h=Math.min(1,mx*1.6)*H/2;x.moveTo(i+0.5,H/2-h);x.lineTo(i+0.5,H/2+h)}x.stroke()}
function renderSounds(){
  const m=muMusic(),names=Object.keys(m.sonidos),has=names.length>0;
  if(!names.includes(MU.sfx))MU.sfx=names[0]||'';
  $('sSel').innerHTML=has?names.map(n=>'<option value="'+n+'">'+n+'</option>').join(''):'<option>(sin sonidos)</option>';$('sSel').value=MU.sfx;$('sSel').disabled=!has;
  $('sPlay').disabled=!has;$('sDel').disabled=!has;$('sBox').hidden=!has;if(!has)return;
  const d=m.sonidos[MU.sfx];$('sWave').value=d.onda;$('sVol').value=Math.round(d.vol*100);if($('sTr')!==document.activeElement)$('sTr').value=muTramosTxt(d);$('sMsg').textContent='';drawSfxWave(d)}
$('sSel').onchange=e=>{MU.sfx=e.target.value;renderSounds()};
$('sPlay').onclick=()=>{if(MU.sfx)muPlaySfx(MU.sfx)};
$('sNew').onclick=()=>{const m=muMusic();if(Object.keys(m.sonidos).length>=MUS_MAX_SONIDOS){toast('Máximo '+MUS_MAX_SONIDOS+' sonidos.');return}
  const id=musicaIdLibre(m.sonidos,'sonido');m.sonidos[id]={onda:'pulso50',vol:0.45,tramos:[[440,880,150]]};MU.sfx=id;renderSounds();renderGame();dirty();muPlaySfx(id)};
confirmBtn($('sDel'),()=>{const m=muMusic();delete m.sonidos[MU.sfx];for(const k of Object.keys(m.eventos))if(m.eventos[k]===MU.sfx)delete m.eventos[k];renderSounds();renderGame();dirty()});
function sfxEdit(){
  const m=muMusic(),old=m.sonidos[MU.sfx];if(!old)return;
  const tramos=$('sTr').value.split('\n').map(l=>l.trim()).filter(Boolean).map(l=>l.split(/[\s,]+/).map(Number));
  try{const d=musicaSonido({onda:$('sWave').value,vol:+$('sVol').value/100,tramos},MU.sfx);m.sonidos[MU.sfx]=d;$('sMsg').className='out';$('sMsg').textContent='';drawSfxWave(d);dirty();return true}
  catch(e){$('sMsg').className='out bad';$('sMsg').textContent=e.message}}
$('sWave').onchange=()=>{if(sfxEdit())muPlaySfx(MU.sfx)};
$('sVol').onchange=()=>{if(sfxEdit())muPlaySfx(MU.sfx)};
$('sTr').oninput=sfxEdit;$('sTr').onchange=()=>{if(sfxEdit())muPlaySfx(MU.sfx)};

/* ---------- Claude.ai ---------- */
function cOpts(){const o={descripcion:$('cDesc').value,canciones:+$('cCan').value,sonidos:+$('cSon').value};return(o.canciones||o.sonidos)?o:null}
function cBuild(av){const o=cOpts();if(!o){if(av)toast('Elige cuántas canciones o sonidos quieres.');return null}return musicaPrompt(o).texto}
$('cCopy').onclick=()=>{const t=cBuild(true);if(t)copyText(t,$('cCopyOut'))};
function cFail(msg){MU.cErr=msg;MU.cKit=null;$('cApply').disabled=true;$('cPrev').hidden=true;const m=$('cMsg');m.className='out bad';m.textContent='✗ '+msg;$('cErrCopy').hidden=false;$('cErrOut').textContent=''}
function cReview(){
  $('cErrCopy').hidden=true;$('cErrOut').textContent='';let kit;
  try{kit=musicaLeerKit(musicaParse($('cResp').value))}catch(e){cFail(e.message);return}
  MU.cKit=kit;MU.cErr='';const m=$('cMsg');m.className='out';m.textContent='✓ La respuesta es válida. Escúchala y, si te gusta, agrégala al proyecto.';
  const body=$('cPrevBody');body.textContent='';
  const A=PV;
  kit.canciones.forEach(c=>body.append(exRow(c.nombre,c.bpm+' bpm · '+c.pistas.length+' pistas · '+c.pasos+' pasos',()=>{muStopSong();AUD.stopSong();A.setData({canciones:[c],sonidos:{},eventos:{},vol:muMusic().vol});A.unlock();A.stopSong();A.playSong(0)},()=>{},'')));
  Object.keys(kit.sonidos).forEach(k=>body.append(exRow('Sonido «'+k+'»','',()=>{A.setData({sonidos:{x:kit.sonidos[k]},eventos:{},vol:{m:0.6,e:Math.max(0.6,muMusic().vol.e)}});A.unlock();A.sfx('x')},()=>{},'')));
  body.querySelectorAll('.exrow .btn:last-child').forEach(b=>b.remove());
  if(kit.nota)body.append(el('p',{class:'note',text:'Nota de Claude: '+kit.nota}));
  if(kit.avisos.length){const w=el('ul',{class:'warn'});kit.avisos.forEach(t=>w.append(el('li',{text:'⚠ '+t})));body.append(w)}
  $('cPrev').hidden=false;$('cApply').disabled=false}
$('cReview').onclick=cReview;$('cResp').addEventListener('paste',()=>setTimeout(cReview,60));
$('cErrCopy').onclick=()=>copyText(musicaTextoError(MU.cErr),$('cErrOut'));
$('cApply').onclick=()=>{if(!MU.cKit)return;muMusic();const r=musicaApply(P,MU.cKit);
  if(r.cancionNueva>=0){MU.song=r.cancionNueva;MU.track=0}MU.cKit=null;$('cApply').disabled=true;$('cPrev').hidden=true;$('cMsg').className='out';$('cMsg').textContent='✓ '+r.resumen.join(' ');
  muStopSong();renderSongPanel();renderSounds();renderGame();dirty();toast('Agregado al proyecto')};
$('cDirect').onclick=async()=>{
  if(!sampleFn){$('cMsg').textContent='Esta función solo está disponible dentro de Claude.';return}
  const t=cBuild(true);if(!t)return;const m=$('cMsg');
  MU.cCtl=new AbortController();$('cDirect').disabled=true;$('cStop').hidden=false;m.className='out';m.textContent='Claude está componiendo… (puede tardar un minuto)';
  try{const r=await sampleFn.json(t,{signal:MU.cCtl.signal,modelTier:'default',cache:false});$('cResp').value=JSON.stringify(r);cReview()}
  catch(e){const code=e&&e.code;m.className='out bad';m.textContent=code==='cancelled'?'Detenido.':code==='not_granted'?'No diste permiso para usar Claude en esta página.':code==='rate_limited'?'Demasiadas peticiones. Espera un momento.':code==='invalid_json'?'La respuesta no tuvo el formato esperado. Prueba otra vez o usa «Copiar instrucciones».':('No se pudo crear: '+((e&&e.message)||'error'))}
  finally{$('cDirect').disabled=false;$('cStop').hidden=true;MU.cCtl=null}};
$('cStop').onclick=()=>{if(MU.cCtl)MU.cCtl.abort()};

/* ---------- descargar ---------- */
const muFile=n=>musicaIdLibre({},n);
$('xSongWav').onclick=async()=>{const s=muSong();if(!s){toast('No hay canción para descargar.');return}const A=makeAudio({});await saveFile(muFile(s.nombre)+'.wav',new Blob([A.wav(A.cancion(s))],{type:'audio/wav'}))};
$('xSfxWav').onclick=async()=>{const d=muMusic().sonidos[MU.sfx];if(!d){toast('No hay sonido para descargar.');return}const A=makeAudio({});await saveFile(MU.sfx+'.wav',new Blob([A.wav(A.sonido(d))],{type:'audio/wav'}))};
$('xAudioZip').onclick=async()=>{const f=audioArchivos();if(!f.length){toast('Todavía no hay audio.');return}
  toast('Preparando audio…');await saveFile('audio-forja-pixel.zip',makeZip(f.concat([{name:'musica.json',data:new TextEncoder().encode(JSON.stringify(muMusic(),null,1))}])))};
$('xMusJson').onclick=()=>saveFile('musica.json',JSON.stringify(muMusic(),null,1));

/* ---------- arranque de la pestaña ---------- */
function renderMusic(){
  muMusic();muSync();$('cDirect').hidden=!sampleFn;
  renderSongPanel();renderSounds();renderExamples()}
