'use strict';
/* ========================================================================
   musica.js · música y sonidos del juego. Lógica pura (sin DOM; también se carga en Node).
   1) makeAudio: sintetizador chiptune + reproductor. Es AUTOCONTENIDA: se copia dentro del game.html exportado (makeAudio.toString()).
      Solo toca AudioContext cuando se reproduce algo, así que se puede usar en Node para generar los .wav.
   2) Formato de canciones y sonidos, ejemplos, limpieza/validación.
   3) musicaPrompt / musicaParse / musicaApply: pedirle música y sonidos a Claude.ai.
   Formato: docs/MUSICA.md
   ======================================================================== */
const MUS_VOCES=['pulso12','pulso25','pulso50','triangulo','sierra','seno','ruido'];
const MUS_NOMBRE_VOZ={pulso12:'Pulso fino',pulso25:'Pulso 25%',pulso50:'Cuadrada',triangulo:'Triángulo',sierra:'Sierra',seno:'Seno',ruido:'Batería'};
const MUS_EVENTOS=[['salto','Saltar'],['salto_pared','Salto de pared'],['aterrizar','Aterrizar'],['colgarse','Colgarse de la pared'],['meta','Llegar a la meta'],['ganar','Terminar el juego'],['caer','Caer al vacío']];
const MUS_MAX_CANCIONES=8,MUS_MAX_SONIDOS=24,MUS_MAX_PISTAS=6;

/* ---------- sintetizador y reproductor ---------- */
/* M = {canciones:[…], sonidos:{nombre:{…}}, eventos:{evento:nombreDeSonido}, vol:{m:0-1, e:0-1}}.
   Devuelve {cancion(i)→Float32Array, sonido(nombre)→Float32Array, wav(f32)→Uint8Array, RATE, setData, playSong, stopSong, sfx, event, unlock, mute, songPos, playing}. */
function makeAudio(M){
  const RATE=22050,SEMI={C:0,D:2,E:4,F:5,G:7,A:9,B:11},TAU=6.283185307179586;
  const GAIN={pulso12:0.42,pulso25:0.5,pulso50:0.5,triangulo:0.9,sierra:0.4,seno:0.8},DEC={pulso12:0.35,pulso25:0.35,pulso50:0.3,triangulo:0.05,sierra:0.3,seno:0.12};
  function mkr(seed){let a=(seed|0)||1;return function(){a^=a<<13;a^=a>>>17;a^=a<<5;return(a>>>0)/4294967296}}
  function freq(tok){const m=/^([A-G])([#b]?)(\d)$/.exec(tok);if(!m)return 0;const n=SEMI[m[1]]+(m[2]==='#'?1:m[2]==='b'?-1:0);return 440*Math.pow(2,(12*(+m[3]+1)+n-69)/12)}
  function wave(v,ph){
    if(v==='pulso12')return ph<0.125?1:-1;if(v==='pulso25')return ph<0.25?1:-1;if(v==='pulso50')return ph<0.5?1:-1;
    if(v==='triangulo')return ph<0.5?4*ph-1:3-4*ph;if(v==='sierra')return 2*ph-1;if(v==='seno')return Math.sin(TAU*ph);return 0}
  function cancion(s){
    const spp=s.pasos_por_pulso||2,stepN=Math.max(1,Math.round(60/s.bpm/spp*RATE)),N=stepN*s.pasos,out=new Float32Array(N),loop=s.loop!==false,rnd=mkr(12345);
    function add(i,v){if(i>=N){if(!loop)return;i%=N}out[i]+=v}
    function nota(voz,f,start,len,vol){
      const rel=Math.round(0.025*RATE),att=Math.round(0.003*RATE),dec=DEC[voz],g=GAIN[voz]*vol,inc=f/RATE;let ph=0;
      for(let i=0;i<len+rel;i++){
        const e=i<att?i/att:i<len?1-dec*(i/len):(1-dec)*(1-(i-len)/rel);
        add(start+i,wave(voz,ph)*g*e);ph+=inc;if(ph>=1)ph-=1}}
    function bateria(d,start,vol){
      const g=vol*0.8;let prev=0,ph=0;
      const len={k:0.16,s:0.17,h:0.05,o:0.2,t:0.22,c:0.55}[d],n=Math.round(len*RATE);
      for(let i=0;i<n;i++){const t=i/RATE;let v=0;
        if(d==='k'){ph+=(45+120*Math.exp(-t*32))/RATE;v=Math.sin(TAU*ph)*Math.exp(-t*16)}
        else if(d==='s'){v=(rnd()*2-1)*Math.exp(-t*20)*0.7+Math.sin(TAU*190*t)*Math.exp(-t*34)*0.5}
        else if(d==='t'){ph+=(80+90*Math.exp(-t*14))/RATE;v=Math.sin(TAU*ph)*Math.exp(-t*12)}
        else{const r=rnd()*2-1,hp=r-prev;prev=r;v=hp*0.7*Math.exp(-t*(d==='h'?90:d==='o'?18:6))}
        add(start+i,v*g)}}
    for(const p of s.pistas){
      const tk=p.notas.split(/\s+/).filter(Boolean),vol=p.vol==null?0.6:p.vol;
      for(let k=0;k<s.pasos;k++){const t=tk[k];if(!t||t==='.'||t==='-')continue;
        if(p.voz==='ruido'){if('kshotc'.indexOf(t)>=0)bateria(t,k*stepN,vol);continue}
        const f=freq(t);if(!f)continue;let L=1;while(k+L<s.pasos&&tk[k+L]==='-')L++;nota(p.voz,f,k*stepN,L*stepN,vol)}}
    for(let i=0;i<N;i++)out[i]=Math.tanh(out[i]*0.75);
    return out}
  function sonido(d){
    const tr=d.tramos,vol=d.vol==null?0.5:d.vol,voz=d.onda||'pulso50',rnd=mkr(777);let total=0;
    for(const t of tr)total+=Math.round(t[2]/1000*RATE);
    const out=new Float32Array(total);let o=0,ph=0,hold=0,hv=0;const g=(voz==='ruido'?0.8:GAIN[voz]||0.5)*2.2;
    tr.forEach((t,ti)=>{const n=Math.round(t[2]/1000*RATE),fin=ti===tr.length-1?0:0.45,att=Math.round(0.002*RATE);
      for(let i=0;i<n;i++){const p=i/n,sil=!(t[0]>0),f=sil?0:t[0]*Math.pow((t[1]>0?t[1]:t[0])/t[0],p),e=(1-(1-fin)*p)*Math.min(1,i/att);let v=0;
        if(!sil){if(voz==='ruido'){if(--hold<=0){hv=rnd()*2-1;hold=Math.max(1,RATE/Math.max(f,40))}v=hv}else{v=wave(voz,ph);ph+=f/RATE;if(ph>=1)ph-=1}}
        out[o++]=Math.tanh(v*g*vol*e)}});
    return out}
  function wav(f32){
    const n=f32.length,b=new Uint8Array(44+n*2),v=new DataView(b.buffer),w=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};
    w(0,'RIFF');v.setUint32(4,36+n*2,true);w(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,RATE,true);v.setUint32(28,RATE*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);w(36,'data');v.setUint32(40,n*2,true);
    for(let i=0;i<n;i++){const x=Math.max(-1,Math.min(1,f32[i]));v.setInt16(44+i*2,x<0?x*32768:x*32767,true)}return b}
  /* ----- reproductor (solo se activa al reproducir) ----- */
  let ac=null,gm=null,ge=null,cur=null,curI=-1,t0=0,dur=0,mut=false;const cache={};
  function ctx(){if(ac)return ac;const C=typeof AudioContext!=='undefined'?AudioContext:(typeof webkitAudioContext!=='undefined'?webkitAudioContext:null);if(!C)return null;
    ac=new C();gm=ac.createGain();ge=ac.createGain();gm.connect(ac.destination);ge.connect(ac.destination);vols();return ac}
  function vols(){if(!gm)return;const v=M.vol||{};gm.gain.value=mut?0:(v.m==null?0.6:v.m);ge.gain.value=mut?0:(v.e==null?0.8:v.e)}
  function buffer(f32){const b=ac.createBuffer(1,f32.length,RATE);b.getChannelData(0).set(f32);return b}
  function unlock(){const c=ctx();if(c&&c.state==='suspended')c.resume();return !!c}
  function stopSong(){if(cur){try{cur.stop()}catch(e){}try{cur.disconnect()}catch(e){}cur=null}curI=-1}
  function playSong(i){
    if(i===curI&&cur)return true;stopSong();const s=M.canciones&&M.canciones[i];if(!s||!unlock())return false;
    const key='c'+i+'|'+JSON.stringify(s);if(!cache[key]){for(const k in cache)if(k[0]==='c'&&k.split('|')[0]==='c'+i)delete cache[k];cache[key]=cancion(s)}
    const b=buffer(cache[key]);cur=ac.createBufferSource();cur.buffer=b;cur.loop=s.loop!==false;cur.connect(gm);cur.start();curI=i;t0=ac.currentTime;dur=b.duration;
    const me=cur;cur.onended=()=>{if(cur===me){cur=null;curI=-1}};return true}
  function sfx(nombre){
    const d=M.sonidos&&M.sonidos[nombre];if(!d||!unlock())return false;
    const key='s'+nombre+'|'+JSON.stringify(d);if(!cache[key])cache[key]=sonido(d);
    const src=ac.createBufferSource();src.buffer=buffer(cache[key]);src.connect(ge);src.start();return true}
  return {RATE,cancion,sonido,wav,unlock,playSong,stopSong,sfx,
    event(ev){const n=M.eventos&&M.eventos[ev];if(n)sfx(n)},
    setData(m){M=m;vols()},mute(b){mut=!!b;vols()},playing(){return curI},
    songPos(){return cur&&dur?(ac.currentTime-t0)%dur:-1}}}

/* ---------- ejemplos ---------- */
const MUS_SONIDOS_EJEMPLO=[
  {id:'salto',nombre:'Salto',def:{onda:'pulso50',vol:0.45,tramos:[[260,620,110]]}},
  {id:'salto_pared',nombre:'Salto de pared',def:{onda:'pulso25',vol:0.45,tramos:[[330,700,70],[500,900,90]]}},
  {id:'aterrizar',nombre:'Aterrizar',def:{onda:'ruido',vol:0.35,tramos:[[300,90,70]]}},
  {id:'colgarse',nombre:'Colgarse',def:{onda:'pulso50',vol:0.3,tramos:[[700,700,30],[0,0,15],[900,900,40]]}},
  {id:'meta',nombre:'Meta alcanzada',def:{onda:'pulso25',vol:0.45,tramos:[[523,523,90],[659,659,90],[784,784,90],[1047,1047,260]]}},
  {id:'ganar',nombre:'Fanfarria final',def:{onda:'pulso50',vol:0.45,tramos:[[523,523,110],[0,0,30],[523,523,110],[0,0,30],[523,523,110],[659,659,170],[523,523,110],[784,784,420]]}},
  {id:'caer',nombre:'Caída',def:{onda:'pulso50',vol:0.45,tramos:[[600,120,420]]}},
  {id:'moneda',nombre:'Moneda',def:{onda:'pulso25',vol:0.4,tramos:[[988,988,70],[1319,1319,300]]}},
  {id:'vida',nombre:'Vida extra',def:{onda:'pulso25',vol:0.4,tramos:[[660,660,80],[880,880,80],[1320,1320,80],[1760,1760,240]]}},
  {id:'poder',nombre:'Poder',def:{onda:'pulso50',vol:0.4,tramos:[[392,392,70],[494,494,70],[587,587,70],[784,784,70],[988,988,200]]}},
  {id:'rebote',nombre:'Rebote',def:{onda:'triangulo',vol:0.6,tramos:[[200,500,120]]}},
  {id:'golpe',nombre:'Golpe',def:{onda:'ruido',vol:0.5,tramos:[[900,150,110]]}},
  {id:'dano',nombre:'Daño',def:{onda:'sierra',vol:0.45,tramos:[[400,100,250]]}},
  {id:'laser',nombre:'Láser',def:{onda:'pulso25',vol:0.4,tramos:[[1800,200,180]]}},
  {id:'explosion',nombre:'Explosión',def:{onda:'ruido',vol:0.55,tramos:[[500,60,600]]}},
  {id:'clic',nombre:'Clic',def:{onda:'pulso50',vol:0.3,tramos:[[1200,1200,25]]}}];

const MUS_CANCIONES_EJEMPLO=[
  {id:'bosque',descripcion:'Alegre y saltarina, en Do mayor. Para niveles de bosque.',c:{nombre:'Aventura en el bosque',bpm:132,pasos_por_pulso:2,pasos:32,loop:true,pistas:[
    {nombre:'Melodía',voz:'pulso25',vol:0.5,notas:'C5 . E5 . G5 - E5 -  F5 - A5 - G5 - E5 .  D5 . F5 . A5 - F5 -  G5 - E5 - C5 - . .'},
    {nombre:'Arpegio',voz:'pulso50',vol:0.28,notas:'C4 E4 G4 E4 C4 E4 G4 E4  F3 A3 C4 A3 F3 A3 C4 A3  D4 F4 A4 F4 D4 F4 A4 F4  G3 B3 D4 B3 G3 B3 D4 B3'},
    {nombre:'Bajo',voz:'triangulo',vol:0.7,notas:'C3 - C3 . G2 - G2 .  F2 - F2 . C3 - C3 .  D3 - D3 . A2 - A2 .  G2 - G2 . G2 - B2 .'},
    {nombre:'Batería',voz:'ruido',vol:0.55,notas:'k . h . s . h h  k . h . s . h h  k . h . s . h h  k . h . s . t t'}]}},
  {id:'cueva',descripcion:'Lenta y misteriosa, en La menor. Para cuevas y ruinas.',c:{nombre:'Cueva misteriosa',bpm:92,pasos_por_pulso:2,pasos:32,loop:true,pistas:[
    {nombre:'Melodía',voz:'triangulo',vol:0.8,notas:'A4 - . . E4 - . .  C5 - B4 - A4 - . .  G4 - . . E4 - D4 -  E4 - - - . . . .'},
    {nombre:'Eco',voz:'pulso12',vol:0.22,notas:'A5 . . . E5 . . .  F5 . . . C5 . . .  G5 . . . D5 . . .  E5 . . . B4 . . .'},
    {nombre:'Zumbido grave',voz:'seno',vol:0.5,notas:'A2 - - - - - - -  F2 - - - - - - -  G2 - - - - - - -  E2 - - - - - - -'},
    {nombre:'Gotas',voz:'ruido',vol:0.4,notas:'k . . . . . . .  k . . . . . t .  k . . . . . . .  k . . . t . t .'}]}},
  {id:'ciudad',descripcion:'Ritmo sintético de noche, en Re menor. Para ciudades.',c:{nombre:'Ciudad de noche',bpm:112,pasos_por_pulso:2,pasos:32,loop:true,pistas:[
    {nombre:'Melodía',voz:'pulso25',vol:0.5,notas:'A4 - . F4 A4 - D5 -  D5 - . Bb4 D5 - F5 -  C5 - . A4 C5 - F5 -  E5 - D5 - C5 - . .'},
    {nombre:'Colchón',voz:'pulso50',vol:0.2,notas:'A3 - - - - - - -  D4 - - - - - - -  C4 - - - - - - -  E4 - - - - - - -'},
    {nombre:'Bajo',voz:'sierra',vol:0.45,notas:'D2 . D3 . D2 . D3 D2  Bb2 . Bb3 . Bb2 . Bb3 Bb2  F2 . F3 . F2 . F3 F2  C3 . C4 . C3 . C4 C3'},
    {nombre:'Batería',voz:'ruido',vol:0.55,notas:'k . h . s . h .  k . h k s . h .  k . h . s . h .  k . h k s . s s'}]}},
  {id:'nieve',descripcion:'Suave, como una cajita de música, en Fa mayor. Para nieve.',c:{nombre:'Nieve tranquila',bpm:84,pasos_por_pulso:2,pasos:32,loop:true,pistas:[
    {nombre:'Cajita',voz:'triangulo',vol:0.7,notas:'F5 . A5 . C6 . A5 .  D5 . F5 . A5 . F5 .  Bb4 . D5 . F5 . D5 .  C5 . E5 . G5 . E5 .'},
    {nombre:'Eco',voz:'pulso12',vol:0.18,notas:'. F5 . A5 . C6 . A5  . D5 . F5 . A5 . F5  . Bb4 . D5 . F5 . D5  . C5 . E5 . G5 . E5'},
    {nombre:'Bajo',voz:'seno',vol:0.55,notas:'F3 - - - - - - -  D3 - - - - - - -  Bb2 - - - - - - -  C3 - - - - - - -'}]}},
  {id:'jefe',descripcion:'Rápida y tensa, en Mi menor. Para el jefe final.',c:{nombre:'Jefe final',bpm:164,pasos_por_pulso:2,pasos:32,loop:true,pistas:[
    {nombre:'Melodía',voz:'pulso25',vol:0.5,notas:'E5 . E5 B4 E5 . G5 F#5  E5 . E5 B4 E5 . A5 G5  E5 . E5 B4 E5 . B5 A5  G5 F#5 E5 D#5 E5 . . .'},
    {nombre:'Arpegio',voz:'pulso12',vol:0.22,notas:'B4 E5 G5 E5 B4 E5 G5 E5  B4 E5 G5 E5 B4 E5 G5 E5  B4 E5 G5 E5 B4 E5 G5 E5  B4 D#5 F#5 D#5 B4 D#5 F#5 D#5'},
    {nombre:'Bajo',voz:'sierra',vol:0.45,notas:'E2 E2 E3 E2 E2 E3 E2 G2  E2 E2 E3 E2 E2 E3 G2 A2  E2 E2 E3 E2 E2 E3 E2 G2  B2 B2 B3 B2 B2 B3 B2 B2'},
    {nombre:'Batería',voz:'ruido',vol:0.6,notas:'k h s h k k s h  k h s h k k s h  k h s h k k s h  k s t t s s c .'}]}},
  {id:'victoria',descripcion:'Fanfarria corta que suena una sola vez (sin repetir).',c:{nombre:'¡Victoria!',bpm:150,pasos_por_pulso:2,pasos:16,loop:false,pistas:[
    {nombre:'Melodía',voz:'pulso25',vol:0.5,notas:'C5 C5 C5 . G4 . . .  E5 - . . G5 - - -'},
    {nombre:'Armonía',voz:'pulso50',vol:0.28,notas:'E4 E4 E4 . C4 . . .  G4 - . . C5 - - -'},
    {nombre:'Bajo',voz:'triangulo',vol:0.7,notas:'C3 . . . C3 . . .  C3 - . . C3 - - -'}]}}];

/* ---------- proyecto: datos de música por defecto ---------- */
function musicaPorDefecto(){
  const sonidos={},eventos={};
  for(const [ev] of MUS_EVENTOS){const e=MUS_SONIDOS_EJEMPLO.find(x=>x.id===ev);if(e){sonidos[ev]=JSON.parse(JSON.stringify(e.def));eventos[ev]=ev}}
  return {canciones:[],sonidos,eventos,vol:{m:0.6,e:0.8}}}
const musicaCopia=m=>JSON.parse(JSON.stringify(m));

/* ---------- validación ---------- */
const MUS_NOTA=/^([A-G][#b]?[1-7]|\.|-)$/,MUS_BAT=/^[kshotc.\-]$/;
const musNombre=(s,d)=>(String(s==null?'':s).replace(/[<>]/g,'').trim().slice(0,40))||d;
/* Limpia una canción. av = lista a la que se agregan avisos. Lanza Error (en español) si algo no se puede usar. */
function musicaCancion(c,tag,av){
  tag=tag||'Canción';av=av||[];
  if(!c||typeof c!=='object'||Array.isArray(c))throw new Error(tag+': debe ser un objeto con nombre, bpm y pistas.');
  if(!Array.isArray(c.pistas)||!c.pistas.length)throw new Error(tag+': falta la lista de pistas ("pistas").');
  if(c.pistas.length>MUS_MAX_PISTAS)throw new Error(tag+': hay '+c.pistas.length+' pistas y el máximo es '+MUS_MAX_PISTAS+'.');
  const bpm=Math.round(clamp(+c.bpm||120,50,220)),ppp=[1,2,4].includes(+c.pasos_por_pulso)?+c.pasos_por_pulso:2;
  const pistas=c.pistas.map((p,i)=>{
    const t=tag+', pista '+(i+1)+': ';
    if(!p||typeof p!=='object')throw new Error(t+'debe ser un objeto con voz y notas.');
    if(!MUS_VOCES.includes(p.voz))throw new Error(t+'la voz "'+p.voz+'" no existe (usa: '+MUS_VOCES.join(', ')+').');
    const raw=Array.isArray(p.notas)?p.notas.map(String):String(p.notas==null?'':p.notas).split(/\s+/).filter(Boolean);
    if(!raw.length)throw new Error(t+'faltan las notas.');
    const ok=p.voz==='ruido'?MUS_BAT:MUS_NOTA;
    raw.forEach((x,k)=>{if(!ok.test(x))throw new Error(t+'el paso '+(k+1)+' tiene "'+x+'", que no es válido'+(p.voz==='ruido'?' (batería: k s h o t c . o -).':' (usa notas como C4, F#3, Bb5; "." silencio; "-" alargar; octavas 1 a 7).'))});
    return {nombre:musNombre(p.nombre,MUS_NOMBRE_VOZ[p.voz]),voz:p.voz,vol:Math.round(clamp(p.vol==null?0.6:+p.vol,0,1)*100)/100,toks:raw}});
  let pasos=Math.round(+c.pasos)||Math.max(...pistas.map(p=>p.toks.length));pasos=clamp(pasos,8,128);
  pistas.forEach((p,i)=>{if(p.toks.length!==pasos){av.push(tag+', pista '+(i+1)+' «'+p.nombre+'»: tenía '+p.toks.length+' pasos y la canción tiene '+pasos+'; se ajustó.');
    while(p.toks.length<pasos)p.toks.push('.');p.toks.length=pasos}});
  return {nombre:musNombre(c.nombre,'Canción'),bpm,pasos_por_pulso:ppp,pasos,loop:c.loop!==false,pistas:pistas.map(p=>({nombre:p.nombre,voz:p.voz,vol:p.vol,notas:p.toks.join(' ')}))}}
function musicaSonido(d,tag){
  tag=tag||'Sonido';
  if(!d||typeof d!=='object'||Array.isArray(d))throw new Error(tag+': debe ser un objeto con onda y tramos.');
  const onda=d.onda==null?'pulso50':d.onda;if(!MUS_VOCES.includes(onda))throw new Error(tag+': la onda "'+onda+'" no existe (usa: '+MUS_VOCES.join(', ')+').');
  if(!Array.isArray(d.tramos)||!d.tramos.length)throw new Error(tag+': faltan los tramos: una lista como [[frecuenciaInicial, frecuenciaFinal, milisegundos], …].');
  let total=0;const tramos=[];
  d.tramos.slice(0,12).forEach((t,i)=>{
    if(!Array.isArray(t)||t.length<3||t.slice(0,3).some(v=>typeof v!=='number'||!isFinite(v)))throw new Error(tag+', tramo '+(i+1)+': debe ser [frecuenciaInicial, frecuenciaFinal, milisegundos] con números.');
    const f=v=>v<=0?0:Math.round(clamp(v,20,8000)),ms=Math.round(clamp(t[2],10,1000));if(total+ms>2500)return;total+=ms;tramos.push([f(t[0]),f(t[1]),ms])});
  return {onda,vol:Math.round(clamp(d.vol==null?0.5:+d.vol,0.05,1)*100)/100,tramos}}
/* Música de un proyecto guardado: lo que no sirva se omite en vez de impedir abrir el proyecto. */
function musicaLimpia(m){
  const base=musicaPorDefecto();if(!m||typeof m!=='object')return base;
  const o={canciones:[],sonidos:{},eventos:{},vol:{m:base.vol.m,e:base.vol.e}};
  if(Array.isArray(m.canciones))for(const c of m.canciones.slice(0,MUS_MAX_CANCIONES)){try{o.canciones.push(musicaCancion(c,'Canción'))}catch(e){}}
  if(m.sonidos&&typeof m.sonidos==='object'){for(const k of Object.keys(m.sonidos).slice(0,MUS_MAX_SONIDOS)){if(!/^[a-z0-9_]{1,24}$/.test(k))continue;try{o.sonidos[k]=musicaSonido(m.sonidos[k],k)}catch(e){}}}
  else o.sonidos=base.sonidos;
  if(m.eventos&&typeof m.eventos==='object')for(const [ev] of MUS_EVENTOS){const n=m.eventos[ev];if(typeof n==='string'&&o.sonidos[n])o.eventos[ev]=n}
  else o.eventos=base.eventos;
  if(m.vol&&typeof m.vol==='object'){if(typeof m.vol.m==='number')o.vol.m=clamp(m.vol.m,0,1);if(typeof m.vol.e==='number')o.vol.e=clamp(m.vol.e,0,1)}
  return o}
/* Nombre libre para un sonido nuevo ('moneda', 'moneda_2'…). */
function musicaIdLibre(sonidos,base){let id=String(base||'sonido').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_]+/g,'_').replace(/^_+|_+$/g,'').slice(0,20)||'sonido';
  if(!sonidos[id])return id;for(let i=2;i<100;i++){if(!sonidos[id+'_'+i])return id+'_'+i}return id+'_x'}

/* ---------- Claude: instrucciones, lectura y aplicación ---------- */
/* o: {descripcion, canciones:n (0-3), sonidos:n (0-8), bpm?}  → {texto} */
function musicaPrompt(o){
  const nc=o.canciones|0,ns=o.sonidos|0,quiere=[];if(nc)quiere.push(nc===1?'una canción':nc+' canciones');if(ns)quiere.push(ns===1?'un efecto de sonido':ns+' efectos de sonido');
  const ejC=MUS_CANCIONES_EJEMPLO[0].c,ejCorto={nombre:'Ejemplo corto',bpm:120,pasos_por_pulso:2,pasos:16,loop:true,pistas:[
    {nombre:'Melodía',voz:'pulso25',vol:0.5,notas:'E5 . G5 . A5 - G5 .  E5 . D5 . C5 - . .'},
    {nombre:'Bajo',voz:'triangulo',vol:0.7,notas:'C3 - . . G2 - . .  A2 - . . F2 - . .'},
    {nombre:'Batería',voz:'ruido',vol:0.5,notas:'k . h . s . h .  k . h . s . h h'}]};
  const claves=[nc&&'`canciones`',ns&&'`sonidos`','`nota`'].filter(Boolean).join(', ');
  const p=['# Tarea: crear '+quiere.join(' y ')+' para mi videojuego de pixel art\n\n'+
    'Eres compositor y diseñador de sonido de videojuegos retro (chiptune, como NES y Game Boy). Voy a pegar tu respuesta en mi app «Forja de Píxeles», así que tu respuesta tiene que ser **un único objeto JSON válido** dentro de un bloque ```json, sin texto antes ni después (si quieres decirme algo, usa la clave `"nota"` con una o dos frases).\n\n'+
    '## Lo que quiero\n'+(o.descripcion&&o.descripcion.trim()?o.descripcion.trim():'(Sin descripción: sorpréndeme con algo coherente y pegadizo.)')+'\n\n'+
    '## Qué debe tener tu JSON\nUn objeto con **solo** estas claves: '+claves+'.\n']
  if(nc)p.push('### Canciones (clave `canciones`: lista de '+nc+')\n'+
    'Cada canción es una **cuadrícula de pasos**: cada pista es un texto con un paso por palabra, separadas por espacios. Una canción se repite en bucle, así que haz que el final enlace bien con el principio.\n'+
    '- `nombre` (corto), `bpm` (50–220), `pasos_por_pulso` (usa 2: cada paso es una corchea), `pasos` (8–128; **32 = 4 compases** es lo normal), `loop` (true/false).\n'+
    '- `pistas`: de 1 a '+MUS_MAX_PISTAS+'. Cada una: `nombre`, `voz`, `vol` (0 a 1) y `notas`.\n'+
    '- `voz`: `pulso25` (melodía brillante), `pulso12` (fina, para arpegios y ecos), `pulso50` (cuadrada, armonía), `triangulo` (bajos suaves), `sierra` (bajos y leads agresivos), `seno` (graves y colchones), `ruido` (batería).\n'+
    '- `notas` en pistas con tono: una palabra por paso. Nota = letra + `#` o `b` opcional + octava 1–7, por ejemplo `C4`, `F#3`, `Bb5` (rango cómodo: C2 a C6). `.` = silencio. `-` = sigue sonando la nota anterior (alarga la nota un paso más).\n'+
    '- `notas` en la pista `ruido` (batería): `k` bombo, `s` caja, `h` hi-hat cerrado, `o` hi-hat abierto, `t` tom, `c` platillo, `.` silencio.\n'+
    '- **Cuenta bien**: cada pista debe tener exactamente tantas palabras como `pasos`. Con 32 pasos son 4 compases de 8 pasos. Te recomiendo escribirlas en grupos de 8 separados por dos espacios.\n'+
    '- Estructura típica: melodía (`pulso25`), arpegio o armonía (`pulso50` o `pulso12`, vol bajo ~0.25), bajo (`triangulo` o `sierra`) y batería (`ruido`). Usa una tonalidad y escala coherentes.\n\n'+
    'Ejemplo de una canción completa:\n```json\n'+JSON.stringify(ejCorto)+'\n```');
  if(ns)p.push('### Efectos de sonido (clave `sonidos`: objeto nombre → efecto, '+ns+' efecto'+(ns>1?'s':'')+')\n'+
    'Cada nombre va en minúsculas, sin espacios ni tildes (por ejemplo `moneda`, `laser_azul`). Cada efecto es:\n'+
    '- `onda`: una de '+MUS_VOCES.map(v=>'`'+v+'`').join(', ')+' (`ruido` sirve para golpes y explosiones).\n'+
    '- `vol`: 0.05 a 1 (usa 0.3–0.6).\n'+
    '- `tramos`: lista de `[frecuenciaInicial, frecuenciaFinal, milisegundos]`. En cada tramo el tono se desliza de una frecuencia a la otra (Hz, 20–8000; `0` = silencio). Cada tramo suena como una nota con su propio golpe. Máximo 12 tramos y 2,5 segundos en total.\n'+
    '- Referencias: salto = `[[260,620,110]]` (sube); moneda = `[[988,988,70],[1319,1319,300]]` (dos notas); caída = `[[600,120,420]]` (baja); explosión con `ruido` = `[[500,60,600]]`.\n\n'+
    'Ejemplo:\n```json\n'+JSON.stringify({sonidos:{moneda:{onda:'pulso25',vol:0.4,tramos:[[988,988,70],[1319,1319,300]]}}})+'\n```');
  p.push('## Antes de responder\nRevisa que el JSON sea válido (comillas dobles, sin comas finales, sin comentarios) y que cada pista de cada canción tenga exactamente `pasos` palabras.');
  return {texto:p.join('\n\n')+'\n'}}
function musicaTextoError(msg){return 'Tu respuesta anterior no se pudo cargar en la app. El problema es este:\n\n'+msg+'\n\nCorrígelo y devuélveme el JSON completo otra vez (solo el bloque ```json, sin texto extra). Cuenta bien los pasos de cada pista.'}
function musicaParse(texto){
  const t=String(texto||''),i=t.indexOf('{'),j=t.lastIndexOf('}');
  if(i<0||j<i)throw new Error('No encuentro un JSON en el texto pegado. Copia la respuesta completa de Claude.');
  try{return JSON.parse(t.slice(i,j+1))}catch(e){throw new Error('El JSON no es válido ('+e.message+'). Suele ser una coma de más o una respuesta cortada a la mitad: pídele a Claude «continúa y devuelve el JSON completo».')}}
/* Valida la respuesta de Claude (sin tocar el proyecto). Devuelve {canciones:[limpias], sonidos:{id:limpio}, avisos, nota}. */
function musicaLeerKit(kit){
  if(!kit||typeof kit!=='object'||Array.isArray(kit))throw new Error('La respuesta debe ser un objeto JSON con las claves "canciones" y/o "sonidos".');
  const av=[],r={canciones:[],sonidos:{},avisos:av,nota:typeof kit.nota==='string'?kit.nota.slice(0,300):''};
  if(kit.canciones!=null){if(!Array.isArray(kit.canciones))throw new Error('"canciones" debe ser una lista.');kit.canciones.slice(0,3).forEach((c,i)=>r.canciones.push(musicaCancion(c,'Canción '+(i+1),av)))}
  if(kit.sonidos!=null){if(typeof kit.sonidos!=='object'||Array.isArray(kit.sonidos))throw new Error('"sonidos" debe ser un objeto: {"nombre": {onda, vol, tramos}}.');
    for(const k of Object.keys(kit.sonidos).slice(0,8))r.sonidos[k]=musicaSonido(kit.sonidos[k],'Sonido «'+k+'»')}
  if(!r.canciones.length&&!Object.keys(r.sonidos).length)throw new Error('La respuesta no trae ninguna canción ni sonido (claves "canciones" o "sonidos").');
  return r}
/* Agrega lo leído a P.music. Devuelve {resumen:[…], cancionNueva:índice|-1}. */
function musicaApply(P,r){
  const m=P.music,res=[];let cn=-1;
  for(const c of r.canciones){if(m.canciones.length>=MUS_MAX_CANCIONES){res.push('No cabe «'+c.nombre+'»: el máximo es '+MUS_MAX_CANCIONES+' canciones.');continue}m.canciones.push(c);cn=m.canciones.length-1;res.push('Canción nueva: «'+c.nombre+'» ('+c.bpm+' bpm, '+c.pistas.length+' pistas).')}
  for(const k of Object.keys(r.sonidos)){if(Object.keys(m.sonidos).length>=MUS_MAX_SONIDOS){res.push('No cabe el sonido «'+k+'»: el máximo es '+MUS_MAX_SONIDOS+'.');continue}const id=musicaIdLibre(m.sonidos,k);m.sonidos[id]=r.sonidos[k];res.push('Sonido nuevo: «'+id+'».')}
  return {resumen:res,cancionNueva:cn}}
