/* ========================================================================
   game.js · motor del juego (autocontenido: también se incluye dentro del game.html exportado).
   makeGame(canvas, D) con D = {vw,vh,tile,size,clips,solid,sheet,tileset,start,levels:[{name,map:{w,h,data,spawn,goal},bgs:[3 imágenes]}]}
   Al tocar la meta pasa al nivel siguiente; en el último muestra "¡Juego completo!".
   ======================================================================== */
function makeGame(canvas,D){
  const snd=D.sfx||function(){};
  const ctx=canvas.getContext('2d'),VW=D.vw,VH=D.vh;canvas.width=VW;canvas.height=VH;ctx.imageSmoothingEnabled=false;
  let li=clamp0(D.start|0,0,D.levels.length-1),L=D.levels[li],M=L.map;const T=D.tile,S=D.size,solid={};D.solid.forEach(id=>{solid[id]=1});
  const hbw=Math.max(6,Math.round(S*0.28)),hbh=Math.round(S*0.8),feetRow=Math.round(S*31/32);
  let banner=null,won=false,flag=0;const K={left:0,right:0,up:0,down:0,jump:0,run:0};let jumpPrev=0;
  const KEYS={ArrowLeft:'left',a:'left',A:'left',ArrowRight:'right',d:'right',D:'right',ArrowUp:'up',w:'up',W:'up',ArrowDown:'down',s:'down',S:'down',' ':'jump',z:'jump',Z:'jump',k:'jump',K:'jump',Shift:'run'};
  const p={x:0,y:0,vx:0,vy:0,face:1,ground:false,cling:0,coyote:0,jbuf:0,lock:0,anim:'idle',t:0};
  const cam={x:0,y:0};let raf=0,running=false,last=0,acc=0;
  function tileSolid(tx,ty){if(tx<0||tx>=M.w)return true;if(ty<0||ty>=M.h)return false;const id=M.data[ty*M.w+tx];return id>0&&!!solid[id]}
  function hit(l,t,r,b){const x0=Math.floor(l/T),x1=Math.floor((r-0.001)/T),y0=Math.floor(t/T),y1=Math.floor((b-0.001)/T);
    for(let ty=y0;ty<=y1;ty++)for(let tx=x0;tx<=x1;tx++)if(tileSolid(tx,ty))return true;return false}
  function touching(d){const px=p.x+d*(hbw/2+1);for(const yy of [p.y-3,p.y-hbh/2,p.y-hbh+3])if(tileSolid(Math.floor(px/T),Math.floor(yy/T)))return true;return false}
  function clamp0(v,a,b){return Math.max(a,Math.min(b,v))}
  function loadLevel(i){li=clamp0(i,0,D.levels.length-1);L=D.levels[li];M=L.map;reset();banner={text:(li+1)+'/'+D.levels.length+' · '+L.name,t:110};if(D.onLevel)D.onLevel(li)}
  function reset(){p.x=M.spawn[0]*T+T/2;p.y=(M.spawn[1]+1)*T-0.01;p.vx=p.vy=0;p.face=1;p.ground=false;p.cling=0;p.lock=0;p.anim='idle';p.t=0;cam.x=p.x-VW/2;cam.y=p.y-VH/2;camClamp()}
  function camClamp(){const mx=M.w*T-VW,my=M.h*T-VH;cam.x=mx<=0?mx/2:clamp(cam.x,0,mx);cam.y=my<=0?my:clamp(cam.y,0,my)}
  function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
  function appr(v,t,a){return v<t?Math.min(t,v+a):Math.max(t,v-a)}
  function step(){
    const wasG=p.ground,wasC=p.cling;
    const dir=(K.right?1:0)-(K.left?1:0),jp=K.jump&&!jumpPrev;jumpPrev=K.jump;
    if(jp)p.jbuf=7;else if(p.jbuf>0)p.jbuf--;if(p.lock>0)p.lock--;
    const wl=touching(-1),wr=touching(1),wd=(wl&&!wr)?-1:(wr&&!wl)?1:(wl&&wr)?(dir||p.face):0;
    p.cling=0;if(!p.ground&&wd!==0&&dir===wd&&p.lock===0&&p.vy>-2.2)p.cling=wd;if(p.cling&&!wasC)snd('colgarse');
    const maxS=K.run?2.4:1.5;
    if(p.cling){p.vx=0;p.face=p.cling}
    else if(p.lock===0){p.vx=appr(p.vx,dir*maxS,dir?(p.ground?0.35:0.22):(p.ground?0.4:0.06));if(dir)p.face=dir}
    else p.vx=appr(p.vx,dir*maxS,0.05);
    if(p.ground)p.coyote=6;else if(p.coyote>0)p.coyote--;
    if(p.cling){p.vy=K.up?-0.9:K.down?1.3:0;
      if(p.jbuf>0){snd('salto_pared');p.vy=-5.2;p.vx=-p.cling*2.3;p.face=-p.cling;p.lock=10;p.cling=0;p.jbuf=0}}
    else{p.vy=Math.min(6.5,p.vy+0.36);
      if(p.jbuf>0&&p.coyote>0){snd('salto');p.vy=-5.7;p.jbuf=0;p.coyote=0;p.ground=false}
      if(!K.jump&&p.vy<-2.4)p.vy=-2.4}
    p.x+=p.vx;
    if(hit(p.x-hbw/2,p.y-hbh,p.x+hbw/2,p.y)){if(p.vx>0)p.x=Math.floor((p.x+hbw/2)/T)*T-hbw/2-0.001;else if(p.vx<0)p.x=(Math.floor((p.x-hbw/2)/T)+1)*T+hbw/2+0.001;p.vx=0}
    p.y+=p.vy;p.ground=false;
    if(hit(p.x-hbw/2,p.y-hbh,p.x+hbw/2,p.y)){if(p.vy>0){if(!wasG&&p.vy>2.4)snd('aterrizar');p.y=Math.floor(p.y/T)*T-0.001;p.ground=true}else if(p.vy<0)p.y=(Math.floor((p.y-hbh)/T)+1)*T+hbh+0.001;p.vy=0}
    if(p.y>M.h*T+90){snd('caer');reset()}
    flag+=1;if(banner&&banner.t>0)banner.t--;
    if(M.goal&&!won&&p.x+hbw/2>M.goal[0]*T-4&&p.x-hbw/2<(M.goal[0]+1)*T+4&&p.y>M.goal[1]*T-T&&p.y-hbh<(M.goal[1]+1)*T){
      if(li<D.levels.length-1){snd('meta');loadLevel(li+1)}else{snd('ganar');won=true;banner={text:'¡Juego completo!',t:9999,sub:'Pulsa salto para empezar de nuevo'}}}
    if(won&&jp){won=false;banner=null;loadLevel(0)}
    let a='idle';
    if(p.cling)a=(K.up||K.down)?'wallclimb':'wallhang';
    else if(!p.ground)a=p.vy<0?'jump':'fall';
    else if(Math.abs(p.vx)>0.15)a=Math.abs(p.vx)>1.9?'run':'walk';
    if(!D.clips[a])a='idle';
    if(a!==p.anim){p.anim=a;p.t=0}else p.t+=1/60;
    cam.x+=(p.x-VW/2-cam.x)*0.12;cam.y+=(p.y-hbh/2-VH/2-cam.y)*0.12;camClamp()}
  function draw(){
    ctx.fillStyle='#101018';ctx.fillRect(0,0,VW,VH);
    const fx=[0.02,0.15,0.35];
    L.bgs.forEach((im,i)=>{if(!im)return;const o=-(((cam.x*fx[i])%VW)+VW)%VW;ctx.drawImage(im,Math.round(o),0);ctx.drawImage(im,Math.round(o)+VW,0)});
    const cx=Math.round(cam.x),cy=Math.round(cam.y);
    const x0=Math.max(0,Math.floor(cx/T)),x1=Math.min(M.w-1,Math.floor((cx+VW)/T)),y0=Math.max(0,Math.floor(cy/T)),y1=Math.min(M.h-1,Math.floor((cy+VH)/T));
    for(let ty=y0;ty<=y1;ty++)for(let tx=x0;tx<=x1;tx++){const id=M.data[ty*M.w+tx];if(id>0)ctx.drawImage(D.tileset,(id-1)*T,0,T,T,tx*T-cx,ty*T-cy,T,T)}
    if(M.goal){const gx=M.goal[0]*T-cx+T/2,gy=(M.goal[1]+1)*T-cy,w=Math.round(Math.sin(flag/9)*2);
      ctx.fillStyle='#ece8f6';ctx.fillRect(Math.round(gx-1),gy-T*2,2,T*2);ctx.fillStyle='#ff6b94';
      for(let r=0;r<8;r++){const ww=10-Math.round(r*0.9)+(r%2?w:0);ctx.fillRect(Math.round(gx+1),gy-T*2+r,Math.max(2,ww),1)}
      ctx.fillStyle='#e0b13a';ctx.fillRect(Math.round(gx-2),gy-T*2-2,4,2)}
    const c=D.clips[p.anim]||D.clips.idle,n=c.frames;let f;
    if(p.anim==='jump'){const u=clamp((p.vy+5.7)/5.7,0,1);f=Math.min(n-1,Math.floor(u*n))}
    else{f=Math.floor(p.t*c.fps);f=c.loop?f%n:Math.min(n-1,f)}
    const dx=Math.round(p.x-cx-S/2),dy=Math.round(p.y-cy-feetRow);
    ctx.save();if(p.face<0){ctx.translate(dx+S/2,0);ctx.scale(-1,1);ctx.translate(-(dx+S/2),0)}
    ctx.drawImage(D.sheet,f*S,c.row*S,S,S,dx,dy,S,S);ctx.restore();
    ctx.font='bold 8px monospace';ctx.textBaseline='top';ctx.fillStyle='rgba(0,0,0,.55)';const hud=(li+1)+'/'+D.levels.length+' '+L.name;ctx.fillRect(3,3,ctx.measureText(hud).width+6,12);ctx.fillStyle='#fff';ctx.fillText(hud,6,5);
    if(banner&&banner.t>0){ctx.font='bold 14px monospace';ctx.textAlign='center';const a=Math.min(1,banner.t/25);ctx.globalAlpha=a;ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(0,VH/2-22,VW,banner.sub?44:30);
      ctx.fillStyle='#fff';ctx.fillText(banner.text,VW/2,VH/2-16);if(banner.sub){ctx.font='8px monospace';ctx.fillText(banner.sub,VW/2,VH/2+4)}ctx.globalAlpha=1;ctx.textAlign='left'}}
  function frame(ts){if(!running)return;if(!last)last=ts;acc+=Math.min(100,ts-last);last=ts;while(acc>=1000/60){step();acc-=1000/60}draw();raf=requestAnimationFrame(frame)}
  function kd(e){const k=KEYS[e.key];if(!k)return;K[k]=1;if(e.key.startsWith('Arrow')||e.key===' ')e.preventDefault()}
  function ku(e){const k=KEYS[e.key];if(k)K[k]=0}
  function blur(){for(const k in K)K[k]=0}
  return {start(){if(running)return;running=true;last=0;acc=0;won=false;banner=null;window.addEventListener('keydown',kd);window.addEventListener('keyup',ku);window.addEventListener('blur',blur);reset();banner={text:(li+1)+'/'+D.levels.length+' · '+L.name,t:110};raf=requestAnimationFrame(frame)},
    stop(){running=false;cancelAnimationFrame(raf);window.removeEventListener('keydown',kd);window.removeEventListener('keyup',ku);window.removeEventListener('blur',blur);blur()},
    reset,loadLevel,setKey(k,v){if(k in K)K[k]=v?1:0},state(){return p},tick(){step()},level(){return li},
    save(){return {p:Object.assign({},p),jumpPrev,li,won}},load(s){Object.assign(p,s.p);jumpPrev=s.jumpPrev;if(s.li!==li){li=s.li;L=D.levels[li];M=L.map}won=s.won}}}
