'use strict';
/* ========================================================================
   core.js · lógica pura, sin DOM (también la cargan las herramientas de Node en /herramientas):
   paleta, generador de personaje, tiles, fondos con parallax, niveles, serialización y ZIP.
   El motor del juego está en game.js y la interfaz en app.js., motor de juego
   ======================================================================== */
const PAL_CHARS="123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0!#$%&*+-/:;<=>?@^_~";
const FORMAT="forja-pixel-2";
const MAXPAL=81, PROTECT=22, TILE=16, NTILES=16, BGW=256, BGH=144;
const BASE_PAL=['','#1b1426','#f2b88c','#d58f6a','#5a3a2a','#3f7fd9','#2d5aa8','#3a3d6e','#2a2c52','#6b3f2a','#ffffff','#e0b13a',
  '#5fb85a','#3f8f4a','#8a5a3c','#6a4129','#8d93a6','#5f6578','#b4bacb','#a8743f','#7c522b','#e24a4a','#f2d34a'];
const CLIP_DEFS=[['idle','Quieto',2,3,true],['walk','Caminar',6,10,true],['run','Correr',6,14,true],['jump','Saltar',3,8,false],
  ['fall','Caer',2,8,true],['wallhang','Colgado',2,3,true],['wallclimb','Trepar',4,8,true]];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

/* ---------- niveles ---------- */
const LEVEL_W=40,LEVEL_H=18,MAXLEVELS=20;
function blankLevel(name,w,h){w=w||LEVEL_W;h=h||LEVEL_H;
  return {name:name||'Nivel',scene:null,seed:1,map:{w,h,data:new Uint8Array(w*h),spawn:[2,h-4],goal:null},bg:[new Uint8Array(BGW*BGH),new Uint8Array(BGW*BGH),new Uint8Array(BGW*BGH)]}}
/* P.levels es la lista de niveles y P.lv el nivel activo. P.map, P.bg y P.scene apuntan siempre al nivel activo. */
function attachLevels(P){if(!P.levels||!P.levels.length)P.levels=[blankLevel('Nivel 1')];P.lv=clamp(P.lv|0,0,P.levels.length-1);
  for(const k of ['map','bg','scene'])Object.defineProperty(P,k,{get(){return this.levels[this.lv][k]},set(v){this.levels[this.lv][k]=v},configurable:true,enumerable:false});return P}
/* Nivel desde filas de texto. En las filas: 1-9 a-g = tiles 1 a 16, S = inicio, M = meta, cualquier otro carácter = vacío. */
function levelFromAscii(name,rows,scene){
  const h=rows.length,w=rows[0].length,l=blankLevel(name,w,h);l.scene=scene||null;l.map.spawn=[1,h-2];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const c=rows[y][x];
    if(c==='S')l.map.spawn=[x,y];else if(c==='M')l.map.goal=[x,y];
    else{const i=PAL_CHARS.indexOf(c)+1;if(c!=='.'&&i>=1&&i<=16)l.map.data[y*w+x]=i}}
  return l}
const LEVEL_TEMPLATES={
 bosque:{name:'Bosque',scene:'bosque-dia',rows:[
  '........................................','........................................','........................................','........................................',
  '.....................................M..','...........................3..333333333.','...........................3..3.........','...........................3..3.........',
  '...........................3..3.........','...........................3..3.........','...........................3..3.........','.....................333...3..3.........',
  '...........................3..3.........','.........5.......444..........3.........','..S..6..55......6...6...6.....3..6......','111111111111..11111111111111111111111111',
  '222222222222..22222222222222222222222222','222222222222..22222222222222222222222222']},
 cueva:{name:'Cueva',scene:'cueva',rows:[
  '77777777777777777777777777777777777777777777','77777777777777777777777777777777777777777777','....7....7.....7.....7....7......7......7...','....7....7.....7.....7....7......7......7...',
  '.........7...........7...........7..........','.....................7....................M.','....................................77777777','....................................7.......',
  '....................................7.......','....................................7.......','....................................7.......','....................................7.......',
  '....................................7.......','...........................7........7.......','................77.......7..........7.......','..S...6.........77.6...........6....7.......',
  '7777777777...7777777777......777777777777777','7777777777...7777777777......777777777777777']},
 torre:{name:'Torre',scene:'ciudad-noche',rows:[
  '3..............3','3..............3','3..............3','3..M...........3','344444.........3','3..............3','3.......44444..3','3..............3','344444.........3','3..............3',
  '3.......44444..3','3..............3','344444.........3','3..............3','3.......44444..3','3..............3','344444.........3','3..............3',
  '3.......44444..3','3..............3','344444.........3','3..............3','3.......44444..3','3..............3','344444.........3','3..............3',
  '3.......44444..3','3..............3','344444.........3','3..............3','3.......44444..3','3..S...........3','1111111111111111','2222222222222222']}};
function hexRgb(h){const n=parseInt(h.slice(1),16);return [n>>16&255,n>>8&255,n&255]}
function rgbHex(r,g,b){return '#'+[r,g,b].map(v=>clamp(Math.round(v),0,255).toString(16).padStart(2,'0')).join('')}
function hslHex(h,s,l){s/=100;l/=100;const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l);const f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));return rgbHex(f(0)*255,f(8)*255,f(4)*255)}
function rng(seed){let a=seed>>>0;return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function addColor(P,hex){hex=hex.toLowerCase();const i=P.pal.indexOf(hex,1);if(i>0)return i;
  if(P.pal.length<=MAXPAL){P.pal.push(hex);return P.pal.length-1}
  const [r,g,b]=hexRgb(hex);let best=1,bd=1e9;
  for(let k=1;k<P.pal.length;k++){const [r2,g2,b2]=hexRgb(P.pal[k]);const d=(r-r2)**2+(g-g2)**2+(b-b2)**2;if(d<bd){bd=d;best=k}}
  return best}

/* ---------- lienzo virtual 32x32 para el generador de personaje ---------- */
function mk(n){return {n,b:new Uint8Array(n*n)}}
function px(c,x,y,i){x=Math.round(x);y=Math.round(y);if(x>=0&&y>=0&&x<c.n&&y<c.n)c.b[y*c.n+x]=i}
function rect(c,x,y,w,h,i){for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++)px(c,x+xx,y+yy,i)}
function thick(c,x0,y0,x1,y1,k,i){const n=Math.max(2,Math.ceil(Math.max(Math.abs(x1-x0),Math.abs(y1-y0))*2));
  for(let s=0;s<=n;s++){const t=s/n,cx=x0+(x1-x0)*t,cy=y0+(y1-y0)*t,bx=Math.round(cx-k/2+0.5),by=Math.round(cy-k/2+0.5);rect(c,bx,by,k,k,i)}}
function chain(c,pts,k,cols,ring){if(ring){const t=mk(c.n);for(let i=0;i<pts.length-1;i++)thick(t,pts[i][0],pts[i][1],pts[i+1][0],pts[i+1][1],k+2,1);
    for(let i=0;i<t.b.length;i++)if(t.b[i]&&c.b[i]){const v=ring(c.b[i]);if(v)c.b[i]=v}}
  for(let i=0;i<pts.length-1;i++)thick(c,pts[i][0],pts[i][1],pts[i+1][0],pts[i+1][1],k,cols[i])}
function blob(c,cells,col,O){if(O)for(const [x,y] of cells){px(c,x-1,y,1);px(c,x+1,y,1);px(c,x,y-1,1);px(c,x,y+1,1)}for(const [x,y] of cells)px(c,x,y,col)}
function ik(rx,ry,tx,ty,l1,l2,bend){let dx=tx-rx,dy=ty-ry,d=Math.hypot(dx,dy);const max=l1+l2-0.001;
  if(d>max){tx=rx+dx*max/d;ty=ry+dy*max/d;dx=tx-rx;dy=ty-ry;d=max}if(d<0.001)d=0.001;
  const a=(l1*l1-l2*l2+d*d)/(2*d),h=Math.sqrt(Math.max(0,l1*l1-a*a)),ux=dx/d,uy=dy/d;
  return [[rx+ux*a+(-uy)*h*bend,ry+uy*a+ux*h*bend],[tx,ty]]}
const G=30,AY=29,HX=16;
function drawChar(p,opt){
  const c=mk(32),O=opt.outline,hx=p.hipX,hy=p.hipY,tl=p.torsoLen||7,lean=p.lean||0,sx=hx+lean,sy=hy-tl;
  const AL=p.armLen||4;const arm=(a,far)=>{const [j,e]=ik(sx,sy+1,a[0],a[1],AL,AL,a[2]);chain(c,[[sx,sy+1],j,e],2,far?[6,3]:[5,2],(!far&&O)?(u=>u===2||u===3?3:u===4?0:6):null)};
  const leg=(a,far)=>{const [j,e]=ik(hx,hy+1,a[0],a[1],5,5,-1);chain(c,[[hx,hy+1],j,e],3,far?[8,8]:[7,7],(!far&&O)?(u=>u===9?0:8):null);
    const ax=Math.round(e[0]),ay=Math.round(e[1]);const cells=[];for(let yy=0;yy<2;yy++)for(let xx=-1;xx<3;xx++)cells.push([ax+xx,ay+yy]);blob(c,cells,far?8:9,false)};
  arm(p.armF,true);leg(p.legF,true);if(p.armsBack)arm(p.armN,false);
  const hx0=Math.round(sx)-3,ty=Math.round(sy)-9+(p.headDy||0);
  if(opt.hair==='long'){const cells=[];for(let y=ty+2;y<=ty+10;y++)for(let x=hx0-1;x<=hx0+1;x++)cells.push([x,y]);blob(c,cells,4,false)}
  const torso=[];for(let r=0;r<tl;r++){const xc=Math.round(hx+lean*(1-r/Math.max(1,tl-1)));for(let x=xc-3;x<=xc+2;x++)torso.push([x,Math.round(sy)+r])}
  blob(c,torso,5,false);
  for(let r=0;r<tl;r++){const xc=Math.round(hx+lean*(1-r/Math.max(1,tl-1)));px(c,xc-3,Math.round(sy)+r,6)}
  {const xc=hx,yb=Math.round(sy)+tl-1;for(let x=xc-3;x<=xc+2;x++)px(c,x,yb,11)}
  const pelvis=[];for(let y=hy;y<hy+2;y++)for(let x=hx-3;x<=hx+2;x++)pelvis.push([x,y]);blob(c,pelvis,7,false);
  const head=[];for(let y=0;y<8;y++)for(let x=0;x<8;x++){if((x===0||x===7)&&(y===0||y===7))continue;head.push([hx0+x,ty+y])}
  blob(c,head,2,false);
  if(opt.hair==='helmet'){for(let y=0;y<4;y++)for(let x=0;x<8;x++)if(!((x===0||x===7)&&y===0))px(c,hx0+x,ty+y,16);
    for(let y=4;y<7;y++){px(c,hx0,ty+y,16);px(c,hx0+1,ty+y,16)}for(let x=4;x<8;x++)px(c,hx0+x,ty+4,17);
    for(let x=1;x<7;x++)px(c,hx0+x,ty,18)}
  else{for(let y=0;y<3;y++)for(let x=0;x<8;x++)if(!((x===0||x===7)&&y===0))px(c,hx0+x,ty+y,4);
    for(let y=3;y<6;y++){px(c,hx0,ty+y,4);px(c,hx0+1,ty+y,4)}px(c,hx0+6,ty+3,4);px(c,hx0+7,ty+3,4);
    if(opt.hair==='long')for(let y=6;y<10;y++){px(c,hx0-1,ty+y,4);px(c,hx0,ty+y,4)}}
  px(c,hx0+5,ty+4,1);px(c,hx0+3,ty+7,3);px(c,hx0+4,ty+7,3);
  leg(p.legN,false);if(!p.armsBack)arm(p.armN,false);
  if(O){const src=c.b.slice(),n=c.n;for(let y=0;y<n;y++)for(let x=0;x<n;x++){if(src[y*n+x])continue;
    if((x>0&&src[y*n+x-1])||(x<n-1&&src[y*n+x+1])||(y>0&&src[(y-1)*n+x])||(y<n-1&&src[(y+1)*n+x]))c.b[y*n+x]=1}}
  return c.b}
function gaitPose(t,o){
  const hx=HX,hy=G-o.hipH+o.bob*Math.cos(4*Math.PI*t),lean=o.lean,sx=hx+lean,sy=hy-7;
  const foot=p=>{p=((p%1)+1)%1;if(p<0.5)return [hx+o.S*(1-4*p),AY];const q=(p-0.5)*2;return [hx-o.S+2*o.S*q,AY-o.L*Math.sin(Math.PI*q)]};
  const hand=p=>{p=((p%1)+1)%1;if(p<0.5)return [sx+o.armA*(1-4*p),sy+o.armY];const q=(p-0.5)*2;return [sx-o.armA+2*o.armA*q,sy+o.armY-o.lift*Math.sin(Math.PI*q)]};
  return {hipX:hx,hipY:hy,lean,torsoLen:7,legN:foot(t),legF:foot(t+0.5),armN:[...hand(t+0.5),1],armF:[...hand(t),1]}}
function poseFor(name,i,n){const hx=HX;
  switch(name){
  case 'idle':{const b=i%2,hy=20,tl=7-b,sy=hy-tl;return {hipX:hx,hipY:hy,lean:0,torsoLen:tl,legN:[hx+2,AY],legF:[hx-2,AY],armN:[hx+1,sy+7,1],armF:[hx-1,sy+7,1]}}
  case 'walk':return gaitPose(i/n,{S:4,L:3,bob:1,hipH:10,lean:0,armA:3,armY:6.5,lift:1});
  case 'run':return gaitPose(i/n,{S:6,L:5,bob:1.5,hipH:9.5,lean:3,armA:5,armY:4,lift:2.5});
  case 'jump':{const f=Math.min(2,Math.round(i*2/Math.max(1,n-1)));
    if(f===0){const hy=24,tl=6,lean=2,sx=hx+lean,sy=hy-tl;return {hipX:hx,hipY:hy,lean,torsoLen:tl,legN:[hx+3,AY],legF:[hx-3,AY],armN:[sx-4,sy+4,1],armF:[sx-5,sy+3,1]}}
    if(f===1){const hy=18,lean=1,sx=hx+lean,sy=hy-7;return {hipX:hx,hipY:hy,lean,torsoLen:7,legN:[hx+3,25],legF:[hx-2,27],armN:[sx+6,sy-3,-1],armF:[sx-4,sy-4,-1]}}
    const hy=17,lean=1,sx=hx+lean,sy=hy-7;return {hipX:hx,hipY:hy,lean,torsoLen:7,legN:[hx+4,23],legF:[hx-1,24],armN:[sx+6,sy,1],armF:[sx-4,sy-1,1]}}
  case 'fall':{const b=i%2,hy=19,sx=hx,sy=hy-7;return {hipX:hx,hipY:hy,lean:0,torsoLen:7,legN:[hx+1+b,27+b],legF:[hx-2-b,28+b],armN:[sx+6,sy-3+2*b,-1],armF:[sx-5,sy-3+2*b,-1]}}
  case 'wallhang':{const b=i%2,hy=24+b,lean=2,sx=hx+lean,sy=hy-7;return {hipX:hx,hipY:hy,lean,torsoLen:7,armLen:5.5,armsBack:true,legN:[hx+6,hy+5],legF:[hx+3,hy+4+b],armN:[sx+8,sy-6-b,-1],armF:[sx+7,sy-4,-1]}}
  case 'wallclimb':{const t=i/n,hy=24,lean=2,sx=hx+lean,sy=hy-7,w=2*Math.PI*t;
    return {hipX:hx,hipY:hy,lean,torsoLen:7,armLen:5.5,armsBack:true,legN:[hx+6,hy+5-3*Math.max(0,Math.sin(w+Math.PI/2))],legF:[hx+3,hy+5-3*Math.max(0,Math.sin(w+1.5*Math.PI))],
      armN:[sx+8,sy-5-2.5*Math.sin(w),-1],armF:[sx+7,sy-4-2.5*Math.sin(w+Math.PI),-1]}}
  }}
function resample(v,size){if(size===32)return v.slice();const o=new Uint8Array(size*size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)o[y*size+x]=v[Math.floor(y*32/size)*32+Math.floor(x*32/size)];return o}
function genCharacter(P,opt){
  P.size=opt.size;P.clips={};
  for(const [name,,n,fps,loop] of CLIP_DEFS){
    const frames=[];for(let i=0;i<n;i++)frames.push(resample(drawChar(poseFor(name,i,n),opt),opt.size));
    P.clips[name]={fps,loop,frames}}
  P.gen={hair:opt.hair,outline:opt.outline}}
function randomCharColors(P,r){
  const skins=[['#f2b88c','#d58f6a'],['#ffdbb0','#e8b98a'],['#c68642','#a46a30'],['#8d5524','#6e3f17'],['#5c3a21','#432813']];
  const hairs=['#5a3a2a','#1f1a24','#c8872e','#a33a2a','#e7d28a','#6a3d8f','#3a7a6a'];
  const sk=skins[Math.floor(r()*skins.length)],h=Math.floor(r()*360),h2=(h+120+Math.floor(r()*100))%360;
  P.pal[2]=sk[0];P.pal[3]=sk[1];P.pal[4]=hairs[Math.floor(r()*hairs.length)];
  P.pal[5]=hslHex(h,62,52);P.pal[6]=hslHex(h,62,36);P.pal[7]=hslHex(h2,38,34);P.pal[8]=hslHex(h2,38,22);
  P.pal[9]=hslHex(Math.floor(r()*40)+10,40,26);P.pal[11]=hslHex(Math.floor(r()*60)+30,80,56)}

/* ---------- tiles base 16x16 ---------- */
function hh(x,y,s){let h=(x*374761393+y*668265263+s*2147483647)|0;h=(h^(h>>>13))*1274126177|0;return((h^(h>>>16))>>>0)}
function makeTile(id){const b=new Uint8Array(TILE*TILE);const set=(x,y,v)=>{if(x>=0&&y>=0&&x<TILE&&y<TILE)b[y*TILE+x]=v};
  const dirt=()=>{for(let y=0;y<TILE;y++)for(let x=0;x<TILE;x++){set(x,y,14);if(hh(x,y,1)%9===0)set(x,y,15)}};
  if(id===1){dirt();for(let x=0;x<TILE;x++){const bl=3+(hh(x,0,2)%3);for(let y=0;y<bl;y++)set(x,y,y===bl-1?13:12)}for(let x=0;x<TILE;x++)if(hh(x,5,3)%3===0)set(x,0,13)}
  else if(id===2){dirt();for(let k=0;k<3;k++){const x=2+hh(k,1,4)%11,y=2+hh(k,2,4)%11;set(x,y,16);set(x+1,y,16);set(x,y+1,17);set(x+1,y+1,17)}}
  else if(id===3){for(let y=0;y<TILE;y++)for(let x=0;x<TILE;x++)set(x,y,16);
    for(let x=0;x<TILE;x++){set(x,7,17);set(x,15,17);set(x,0,18);set(x,8,18)}
    for(let y=0;y<7;y++)set(7,y,17);for(let y=8;y<15;y++){set(3,y,17);set(11,y,17)}for(let y=1;y<7;y++)if(y%3===0)set(2,y,17)}
  else if(id===4){for(let y=0;y<TILE;y++)for(let x=0;x<TILE;x++)set(x,y,19);
    for(const yy of [0,5,10,15])for(let x=0;x<TILE;x++)set(x,yy,20);
    for(const [x,y] of [[1,2],[14,2],[1,7],[14,7],[1,12],[14,12]])set(x,y,20);for(let x=0;x<TILE;x++)set(x,1,19)}
  else if(id===5){for(let y=0;y<TILE;y++)for(let x=0;x<TILE;x++){const e=x===0||y===0||x===15||y===15||x===1&&y>0&&y<15||x===14||y===1||y===14;set(x,y,e?20:19)}
    for(let i=2;i<14;i++){set(i,i,20);set(15-i,i,20)}}
  else if(id===6){for(let y=9;y<TILE;y++)set(8,y,13);set(7,12,12);set(6,11,12);set(9,13,12);set(10,12,12);
    for(const [x,y] of [[7,6],[9,6],[8,5],[8,7]])set(x,y,21);set(8,6,22);
    for(let x=2;x<TILE-2;x+=3){set(x,TILE-1,12);set(x,TILE-2,13)}set(3,TILE-3,12);set(12,TILE-3,12)}
  else if(id===7){for(let y=0;y<TILE;y++)for(let x=0;x<TILE;x++){set(x,y,17);if(hh(x,y,7)%6===0)set(x,y,16)}
    for(let x=0;x<TILE;x++){set(x,0,1);set(x,15,1)}}
  return b}

/* ---------- fondos con parallax (se repiten en horizontal) ---------- */
const THEMES={
  dia:{sky:['#3f8fe0','#5aaaf0','#86c8f5','#b9e4f8'],cloud:['#ffffff','#d7e8f5'],orb:'#fff1a8',far:['#8da8cc','#7690b8'],hill:['#5aa860','#438a4e'],tree:['#2f7048','#25593a'],bld:['#7d86a6','#656d8d'],win:'#f6e7a0'},
  tarde:{sky:['#3b2f6b','#8a3f7a','#e0675f','#ffb36b'],cloud:['#ffb8a0','#d98aa0'],orb:'#ffd98a',far:['#5a4a86','#493b73'],hill:['#3c4a6e','#2e3a5a'],tree:['#1f2c4a','#18233b'],bld:['#4a3d70','#3a2f5c'],win:'#ffd36e'},
  noche:{sky:['#0b1030','#141b4a','#1f2a63','#2d3b7c'],cloud:['#3a4684','#2b356b'],orb:'#e9efff',far:['#27326a','#1d2757'],hill:['#1c2a4a','#15213b'],tree:['#101c33','#0b1527'],bld:['#1a2248','#121936'],win:'#ffd36e'},
  nieve:{sky:['#5d7ea8','#8fb0d0','#bcd6e8','#e4f0f8'],cloud:['#ffffff','#dbe8f2'],orb:'#fffbe0',far:['#a8bfd8','#8aa5c4'],hill:['#e8f1f8','#c3d6e6'],tree:['#2f5a48','#244a3b'],bld:['#7d86a6','#656d8d'],win:'#f6e7a0'},
  otono:{sky:['#4a6fa8','#7f9fc4','#e8b27a','#f6d9a0'],cloud:['#fff0d8','#e8c9a8'],orb:'#fff1a8',far:['#a8744a','#8a5a3a'],hill:['#c9772a','#a65c1e'],tree:['#7a3b1e','#5e2c15'],bld:['#7d86a6','#656d8d'],win:'#f6e7a0'},
  cueva:{sky:['#120d1f','#1a1330','#241a40','#2d2150'],cloud:['#3a2c5c','#2c2147'],orb:'#5ff0d0',far:['#3a2c5c','#2c2147'],hill:['#4a3a6e','#382c58'],tree:['#241a3c','#1a122c'],bld:['#4a3a6e','#382c58'],win:'#5ff0d0'}};
const SCENES=[['bosque-dia','Bosque · día','dia','bosque'],['bosque-tarde','Bosque · atardecer','tarde','bosque'],['bosque-noche','Bosque · noche','noche','bosque'],
  ['ciudad-tarde','Ciudad · atardecer','tarde','ciudad'],['ciudad-noche','Ciudad · noche','noche','ciudad'],['cueva','Cueva de cristales','cueva','cueva'],
  ['ciudad-dia','Ciudad · día','dia','ciudad'],['bosque-nieve','Bosque · nieve','nieve','bosque'],['bosque-otono','Bosque · otoño','otono','bosque']];
/* Tema de colores propio para un fondo (lo escribe una persona o una IA). Los tipos de dibujo disponibles son bosque, ciudad y cueva.
   Claves: sky (4 colores de arriba abajo), cloud (2), orb (sol, luna o estrellas), far (2), hill (2), tree (2), bld (2), win (ventanas o cristales), estrellas (true/false).
   Lo que falte se completa con un tema base, así que basta con dar los colores que importan. */
const SCENE_KINDS=['bosque','ciudad','cueva'];
function cleanTheme(t){
  if(!t||typeof t!=='object'||Array.isArray(t))throw new Error('El tema del fondo debe ser un objeto con \"kind\" y colores.');
  if(!SCENE_KINDS.includes(t.kind))throw new Error('Tema: \"kind\" debe ser uno de '+SCENE_KINDS.join(', ')+' (llegó \"'+t.kind+'\").');
  const base=THEMES[t.kind==='cueva'?'cueva':'dia'],o={kind:t.kind,estrellas:t.estrellas===undefined?t.kind==='cueva':!!t.estrellas};
  const hex=(v,n)=>{if(typeof v!=='string'||!/^#[0-9a-fA-F]{6}$/.test(v))throw new Error('Tema: color no válido en \"'+n+'\": '+JSON.stringify(v)+' (usa #rrggbb).');return v.toLowerCase()};
  for(const [k,len] of [['sky',4],['cloud',2],['far',2],['hill',2],['tree',2],['bld',2]]){
    if(t[k]===undefined)o[k]=base[k].slice();
    else{if(!Array.isArray(t[k])||t[k].length!==len)throw new Error('Tema: \"'+k+'\" necesita exactamente '+len+' colores.');o[k]=t[k].map(c=>hex(c,k))}}
  for(const k of ['orb','win'])o[k]=t[k]===undefined?base[k]:hex(t[k],k);
  return o}
const BAYER=[[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
function genScene(P,key,seed){
  P.bg=[new Uint8Array(BGW*BGH),new Uint8Array(BGW*BGH),new Uint8Array(BGW*BGH)];compactPalette(P);
  const lvl=P.levels[P.lv],custom=key==='personalizada'&&!!lvl.theme;if(!custom)delete lvl.theme;
  const sc=custom?['personalizada','Personalizada',null,lvl.theme.kind]:(SCENES.find(s=>s[0]===key)||SCENES[0]),th=custom?lvl.theme:THEMES[sc[2]],kind=sc[3],W=BGW,H=BGH,r=rng(seed*7919+13);
  const tn=custom?(kind==='cueva'?'cueva':th.estrellas?'noche':'dia'):sc[2];
  const C=h=>addColor(P,h);const L=()=>new Uint8Array(W*H);
  const set=(b,x,y,v)=>{x=((Math.round(x)%W)+W)%W;y=Math.round(y);if(y>=0&&y<H)b[y*W+x]=v};
  const wrapDo=(x,fn)=>{fn(x);fn(x-W);fn(x+W)};
  const sky=L(),far=L(),near=L();
  const sc0=th.sky.map(C),nb=sc0.length;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const pos=y/H*nb;let k=Math.floor(pos);if(k>=nb)k=nb-1;const f=pos-k;let v=sc0[k];
    if(f>0.6&&k<nb-1){const t=(f-0.6)/0.4;if(t>BAYER[y&3][x&3]/16)v=sc0[k+1]}sky[y*W+x]=v}
  if(tn==='noche'||tn==='cueva'){const n=Math.floor(W*H/(tn==='cueva'?1500:850)),oc=C(th.orb);
    for(let i=0;i<n;i++){const x=Math.floor(r()*W),y=Math.floor(r()*H*(tn==='cueva'?0.9:0.55));set(sky,x,y,oc);
      if(r()<0.12){set(sky,x+1,y,oc);set(sky,x-1,y,oc);set(sky,x,y+1,oc);set(sky,x,y-1,oc)}}}
  if(kind!=='cueva'){const ox=W*(0.55+r()*0.3),oy=H*(0.16+r()*0.12),rad=Math.round(H*0.075),oc=C(th.orb);
    for(let y=-rad;y<=rad;y++)for(let x=-rad;x<=rad;x++)if(x*x+y*y<=rad*rad)set(sky,ox+x,oy+y,oc)
    if(tn==='noche'){const cr=C(th.sky[1]);set(sky,ox-2,oy-1,cr);set(sky,ox-1,oy-1,cr);set(sky,ox+2,oy+2,cr)}}
  if(kind!=='cueva'&&tn!=='noche'||(tn==='noche'&&r()<0.8&&kind==='bosque')){
    const cc=[C(th.cloud[0]),C(th.cloud[1])],cn=4+Math.floor(r()*3);
    for(let i=0;i<cn;i++){const cx=r()*W,cy=H*(0.12+r()*0.3),rx=12+r()*14,ry=4+r()*3.5;
      wrapDo(cx,bx=>{for(const [dx,s] of [[0,1],[rx*0.7,0.7],[-rx*0.7,0.7],[rx*1.3,0.5],[-rx*1.3,0.5]]){const rxx=rx*s,ryy=ry*(0.55+0.45*s);
        for(let y=-Math.ceil(ryy);y<=ryy;y++)for(let x=-Math.ceil(rxx);x<=rxx;x++)if((x/rxx)**2+(y/ryy)**2<=1){const py=cy+y+ (1-s)*ry*0.9;set(sky,bx+dx+x,py,(py-cy)/ry>0.35?cc[1]:cc[0])}}})}}
  const ridge=(amps,fr,base,ph)=>{const a=new Array(W);for(let x=0;x<W;x++){let y=base;for(let k=0;k<amps.length;k++)y+=amps[k]*H*Math.sin(2*Math.PI*fr[k]*x/W+ph[k]);a[x]=y}return a};
  const fill=(b,top,col,col2,band)=>{for(let x=0;x<W;x++){for(let y=Math.max(0,Math.round(top[x]));y<H;y++){let v=col;if(col2!==undefined&&y>top[x]+band&&((x+y)&1)===0)v=col2;b[y*W+x]=v}}};
  if(kind==='bosque'){
    const f0=C(th.far[0]),f1=C(th.far[1]);
    fill(far,ridge([0.10,0.05,0.02],[1,3,7],H*0.45,[r()*6,r()*6,r()*6]),f1);
    fill(far,ridge([0.08,0.05,0.025],[2,5,9],H*0.58,[r()*6,r()*6,r()*6]),f0,f1,10);
    const h0=C(th.hill[0]),h1=C(th.hill[1]),t0=C(th.tree[0]),t1=C(th.tree[1]);
    const ph=ridge([0.04,0.02],[2,5],H*0.8,[r()*6,r()*6]);
    for(let x=0;x<W;x++)for(let y=Math.max(0,Math.round(ph[x]));y<H;y++)near[y*W+x]=(y>ph[x]+5&&((x+y)&1)===0)?h1:(y>ph[x]+8?h1:h0);
    let x=r()*8;while(x<W){const hgt=16+Math.floor(r()*16),base=Math.round(ph[Math.floor(x)%W])+2;
      wrapDo(x,bx=>{for(let rr=0;rr<hgt;rr++){const tier=Math.floor(rr/(hgt/3)),loc=rr-tier*(hgt/3),hw=Math.round(1+loc*0.55+tier*1.3);
          for(let d=-hw;d<=hw;d++)set(near,bx+d,base-hgt+rr,d>0?t1:t0)}
        for(let q=0;q<3;q++){set(near,bx,base+q-1,t1);set(near,bx+1,base+q-1,t1)}});
      x+=11+Math.floor(r()*15)}
  }else if(kind==='ciudad'){
    const b0=C(th.bld[0]),b1=C(th.bld[1]),wc=C(th.win);
    let x=0;while(x<W){const w=Math.min(W-x,8+Math.floor(r()*9)),h=Math.round(H*(0.28+r()*0.28));for(let xx=0;xx<w;xx++)for(let y=H-h;y<H;y++)far[y*W+x+xx]=(xx===w-1)?b1:b0;
      if(r()<0.35)for(let y=H-h-6;y<H-h;y++)far[y*W+x+Math.floor(w/2)]=b0;x+=w}
    x=0;const ground=H-8;while(x<W){const w=Math.min(W-x,18+Math.floor(r()*16)),h=Math.round(H*(0.4+r()*0.35));
      for(let xx=0;xx<w;xx++)for(let y=H-h;y<H;y++)near[y*W+x+xx]=(y===H-h)?b0:b1;
      for(let wy=H-h+4;wy<ground-3;wy+=6)for(let wx=3;wx<w-3;wx+=5){const lit=r()<0.45;for(let a=0;a<2;a++)for(let b=0;b<3;b++)near[(wy+b)*W+x+wx+a]=lit?wc:b0}
      x+=w}
    for(let yy=ground;yy<H;yy++)for(let xx=0;xx<W;xx++)near[yy*W+xx]=b0;
  }else{
    const f0=C(th.far[0]),f1=C(th.far[1]),h0=C(th.hill[0]),h1=C(th.hill[1]),t0=C(th.tree[0]),cr=C(th.win);
    for(let x=0;x<W;x++)for(let y=0;y<7+Math.round(3*Math.sin(x*0.3));y++)far[y*W+x]=f1;
    for(let x=0;x<W;x++)for(let y=H-8-Math.round(2*Math.sin(x*0.4));y<H;y++)far[y*W+x]=f1;
    let x=r()*8;while(x<W){const len=10+Math.floor(r()*20),bw=3+Math.floor(r()*3),top=r()<0.55;
      wrapDo(x,bx=>{for(let yy=0;yy<len;yy++){const hw=Math.round(bw*(1-yy/len));for(let d=-hw;d<=hw;d++)set(far,bx+d,top?yy:H-1-yy,d>0?f1:f0)}});x+=9+Math.floor(r()*10)}
    for(let xx=0;xx<W;xx++)for(let y=0;y<10+Math.round(2*Math.sin(xx*0.2));y++)near[y*W+xx]=t0;
    for(let xx=0;xx<W;xx++)for(let y=H-6;y<H;y++)near[y*W+xx]=t0;
    x=r()*10;while(x<W){const len=12+Math.floor(r()*26),bw=4+Math.floor(r()*4);
      wrapDo(x,bx=>{for(let yy=0;yy<len;yy++){const hw=Math.round(bw*(1-yy/len));for(let d=-hw;d<=hw;d++)set(near,bx+d,yy+8,d>0?h1:h0)}});x+=16+Math.floor(r()*22)}
    for(let i=0;i<7;i++){const cx=r()*W,hgt=8+Math.floor(r()*8);
      wrapDo(cx,bx=>{for(let yy=0;yy<hgt;yy++){const hw=yy<hgt*0.4?Math.round(yy/hgt*5):Math.round((hgt-yy)/hgt*3.4);for(let d=-hw;d<=hw;d++)set(near,bx+d,H-6-hgt+yy,(d<0&&yy>2)?C('#c7fff2'):cr)}})}
  }
  P.bg=[sky,far,near];P.scene=key;P.levels[P.lv].seed=seed}
function compactPalette(P){
  const used=new Set();const all=[...P.tiles];for(const l of P.levels)all.push(...l.bg);for(const n of CLIP_DEFS)for(const f of P.clips[n[0]].frames)all.push(f);
  for(const b of all)for(let i=0;i<b.length;i++)used.add(b[i]);
  const map=new Uint8Array(P.pal.length),np=P.pal.slice(0,PROTECT+1);for(let i=0;i<=PROTECT;i++)map[i]=i;
  for(let i=PROTECT+1;i<P.pal.length;i++){if(used.has(i)){map[i]=np.length;np.push(P.pal[i])}else map[i]=0}
  for(const b of all)for(let i=0;i<b.length;i++)b[i]=map[b[i]];P.pal=np;return P.pal.length-1}

/* ---------- serialización ---------- */
const ch=i=>i===0?'.':PAL_CHARS[i-1];
function bufRows(b,w,h){const o=[];for(let y=0;y<h;y++){let s='';for(let x=0;x<w;x++)s+=ch(b[y*w+x]);o.push(s)}return o}
function rowsBuf(rows,w,h,max){const b=new Uint8Array(w*h);if(!Array.isArray(rows)||rows.length!==h)throw new Error('Filas incorrectas: se esperaban '+h+' y hay '+(Array.isArray(rows)?rows.length:0));
  for(let y=0;y<h;y++){const s=String(rows[y]);if(s.length!==w)throw new Error('La fila '+(y+1)+' mide '+s.length+' y debería medir '+w);
    for(let x=0;x<w;x++){const c=s[x];const i=c==='.'?0:PAL_CHARS.indexOf(c)+1;if(c!=='.'&&i<1)throw new Error('Carácter no válido en la fila '+(y+1)+': "'+c+'"');if(i>max)throw new Error('Índice de paleta fuera de rango en la fila '+(y+1)+': "'+c+'" (la paleta tiene '+max+' colores)');b[y*w+x]=i}}
  return b}
function levelToObj(l,withBg){const m=l.map,rows=[];
  for(let y=0;y<m.h;y++){let r='';for(let x=0;x<m.w;x++)r+=ch(m.data[y*m.w+x]);rows.push(r)}
  const o={name:l.name,scene:l.scene||null,seed:l.seed||1,map:{w:m.w,h:m.h,spawn:m.spawn.slice(),goal:m.goal?m.goal.slice():null,rows}};if(l.theme)o.theme=l.theme;
  if(withBg)o.bg={w:BGW,h:BGH,layers:l.bg.map(b=>bufRows(b,BGW,BGH))};return o}
function projectToObj(P,withBg){
  const o={};if(P.meta)o.meta=P.meta;Object.assign(o,{format:FORMAT,size:P.size,palette:P.pal.slice(1),clips:{},tile:TILE,tiles:P.tiles.map(b=>bufRows(b,TILE,TILE)),solid:[...P.solid],gen:P.gen,levels:P.levels.map(l=>levelToObj(l,withBg))});
  for(const d of CLIP_DEFS){const c=P.clips[d[0]];o.clips[d[0]]={fps:c.fps,loop:c.loop,frames:c.frames.map(f=>bufRows(f,P.size,P.size))}}
  return o}
/* Lee un nivel de un JSON. Si no trae "bg" pero sí una "scene" conocida, el fondo se genera solo (lo hace objToProject). */
function parseLevel(lo,i,max){
  const tag='Nivel '+(i+1)+': ';const m=lo&&lo.map;if(!m||!Array.isArray(m.rows))throw new Error(tag+'falta el mapa (map.rows).');
  const mw=clamp(m.w|0,16,120),mh=clamp(m.h|0,9,60);if(m.rows.length!==mh)throw new Error(tag+'el mapa tiene '+m.rows.length+' filas y "h" dice '+mh+'.');
  const data=new Uint8Array(mw*mh);let spawn=null,goal=null;
  for(let y=0;y<mh;y++){const s=String(m.rows[y]);if(s.length!==mw)throw new Error(tag+'la fila '+(y+1)+' del mapa mide '+s.length+' y debería medir '+mw+'.');
    for(let x=0;x<mw;x++){const c=s[x];if(c==='S'){spawn=[x,y];continue}if(c==='M'){goal=[x,y];continue}
      const k=c==='.'?0:PAL_CHARS.indexOf(c)+1;data[y*mw+x]=(k>=1&&k<=NTILES)?k:0}}
  const pt=(v,d)=>Array.isArray(v)&&v.length>=2?[clamp(v[0]|0,0,mw-1),clamp(v[1]|0,0,mh-1)]:d;
  let theme=null;if(lo.theme!=null){try{theme=cleanTheme(lo.theme)}catch(e){throw new Error(tag+e.message)}}
  if(lo.scene==='personalizada'&&!theme)throw new Error(tag+'la escena \"personalizada\" necesita un \"theme\" con colores.');
  const L={name:String(lo.name||('Nivel '+(i+1))).slice(0,40),scene:theme?'personalizada':(lo.scene||null),seed:clamp(lo.seed|0||1,1,99),
    map:{w:mw,h:mh,data,spawn:spawn||pt(m.spawn,[1,mh-2]),goal:goal||pt(m.goal,null)},bg:null,needBg:false};if(theme)L.theme=theme;
  const b=lo.bg;
  if(b&&Array.isArray(b.layers)&&b.layers.length===3&&b.w===BGW&&b.h===BGH){try{L.bg=b.layers.map(l=>rowsBuf(l,BGW,BGH,max))}catch(e){throw new Error(tag+'fondo: '+e.message)}}
  else{L.bg=[new Uint8Array(BGW*BGH),new Uint8Array(BGW*BGH),new Uint8Array(BGW*BGH)];L.needBg=!!(L.scene&&(theme||SCENES.some(s=>s[0]===L.scene)))}
  return L}
function objToProject(o){
  if(!o||(o.format!=='forja-pixel-1'&&o.format!==FORMAT))throw new Error('Este JSON no es un proyecto de Forja de Píxeles (falta format "'+FORMAT+'").');
  if(![16,24,32,48,64].includes(o.size))throw new Error('Tamaño de sprite no válido: '+o.size+' (usa 16, 24, 32, 48 o 64).');
  if(!Array.isArray(o.palette)||o.palette.length<PROTECT||o.palette.length>MAXPAL)throw new Error('La paleta debe tener entre '+PROTECT+' y '+MAXPAL+' colores.');
  for(const c of o.palette)if(!/^#[0-9a-fA-F]{6}$/.test(c))throw new Error('Color no válido en la paleta: '+c);
  const P={size:o.size,pal:['',...o.palette.map(c=>c.toLowerCase())],clips:{},tiles:[],solid:[],levels:[],lv:0,gen:o.gen||{hair:'short',outline:true}};if(o.meta&&typeof o.meta==='object')P.meta={nombre:String(o.meta.nombre||'').slice(0,60),descripcion:String(o.meta.descripcion||'').slice(0,200)};
  const max=P.pal.length-1;
  for(const d of CLIP_DEFS){const c=o.clips&&o.clips[d[0]];
    if(c&&Array.isArray(c.frames)&&c.frames.length){try{P.clips[d[0]]={fps:clamp(+c.fps||d[3],1,24),loop:!!c.loop,frames:c.frames.slice(0,16).map(f=>rowsBuf(f,o.size,o.size,max))}}catch(e){throw new Error('Movimiento "'+d[0]+'": '+e.message)}}
    else P.clips[d[0]]={fps:d[3],loop:d[4],frames:[new Uint8Array(o.size*o.size)]}}
  for(let i=0;i<NTILES;i++){try{P.tiles.push(o.tiles&&o.tiles[i]?rowsBuf(o.tiles[i],TILE,TILE,max):new Uint8Array(TILE*TILE))}catch(e){throw new Error('Tile '+(i+1)+': '+e.message)}}
  P.solid=(Array.isArray(o.solid)?o.solid:[]).filter(i=>i>=1&&i<=NTILES);
  let los=o.levels;
  if(o.format==='forja-pixel-1')los=[{name:'Nivel 1',scene:o.scene,map:o.map,bg:o.bg}];
  if(!Array.isArray(los)||!los.length)throw new Error('Falta la lista de niveles (levels).');
  los=los.slice(0,MAXLEVELS);
  for(let i=0;i<los.length;i++)P.levels.push(parseLevel(los[i],i,max));
  attachLevels(P);
  for(let i=0;i<P.levels.length;i++){const L=P.levels[i];if(L.needBg){P.lv=i;genScene(P,L.scene,L.seed)}delete L.needBg}
  P.lv=clamp(o.lv|0,0,P.levels.length-1);return P}

/* ---------- ZIP (sin compresión) ---------- */
const CRCT=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(u8){let c=0xFFFFFFFF;for(let i=0;i<u8.length;i++)c=CRCT[(c^u8[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0}
function makeZip(files){const enc=new TextEncoder(),parts=[],central=[];let off=0;
  for(const f of files){const nm=enc.encode(f.name),data=f.data,crc=crc32(data);
    const lh=new DataView(new ArrayBuffer(30));lh.setUint32(0,0x04034b50,true);lh.setUint16(4,20,true);lh.setUint16(6,0x0800,true);lh.setUint16(8,0,true);lh.setUint16(10,0,true);lh.setUint16(12,33,true);
    lh.setUint32(14,crc,true);lh.setUint32(18,data.length,true);lh.setUint32(22,data.length,true);lh.setUint16(26,nm.length,true);lh.setUint16(28,0,true);
    parts.push(new Uint8Array(lh.buffer),nm,data);
    const ch2=new DataView(new ArrayBuffer(46));ch2.setUint32(0,0x02014b50,true);ch2.setUint16(4,20,true);ch2.setUint16(6,20,true);ch2.setUint16(8,0x0800,true);ch2.setUint16(10,0,true);ch2.setUint16(12,0,true);ch2.setUint16(14,33,true);
    ch2.setUint32(16,crc,true);ch2.setUint32(20,data.length,true);ch2.setUint32(24,data.length,true);ch2.setUint16(28,nm.length,true);ch2.setUint32(42,off,true);
    central.push(new Uint8Array(ch2.buffer),nm);off+=30+nm.length+data.length}
  let csize=0;for(const c of central)csize+=c.length;
  const end=new DataView(new ArrayBuffer(22));end.setUint32(0,0x06054b50,true);end.setUint16(8,files.length,true);end.setUint16(10,files.length,true);end.setUint32(12,csize,true);end.setUint32(16,off,true);
  return new Blob([...parts,...central,new Uint8Array(end.buffer)],{type:'application/zip'})}


/* ---------- proyecto nuevo (lo usan la app y las herramientas de Node) ---------- */
/* opt: {size, hair:'short'|'long'|'helmet', outline, colors:semilla, levels:['bosque','cueva','torre'] o [{template,scene,name}]} */
function newProject(opt){opt=opt||{};const size=opt.size||32,hair=opt.hair||'short',outline=opt.outline!==false;
  const p={size,pal:BASE_PAL.slice(),clips:{},tiles:[],solid:[1,2,3,4,5,7],levels:[],lv:0,gen:{hair,outline}};
  genCharacter(p,{size,hair,outline});if(opt.colors)randomCharColors(p,rng(opt.colors));
  for(let i=0;i<NTILES;i++)p.tiles.push(i<7?makeTile(i+1):new Uint8Array(TILE*TILE));
  attachLevels(p);p.levels=[];
  for(const e of (opt.levels||['bosque','cueva','torre'])){const o=typeof e==='string'?{template:e}:e,t=LEVEL_TEMPLATES[o.template];
    if(!t)throw new Error('Plantilla de nivel desconocida: '+o.template+' (hay: '+Object.keys(LEVEL_TEMPLATES).join(', ')+')');
    p.levels.push(levelFromAscii(o.name||t.name,t.rows,o.scene||t.scene))}
  p.levels.forEach((l,i)=>{p.lv=i;genScene(p,l.scene,opt.seed||1)});p.lv=0;return p}
