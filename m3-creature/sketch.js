const R=120,H0=200,OUT=240;
const BARE=/bare/.test(location.search);   // 網址加 ?bare 可只留場地主體，用來抓效能兇手
const NIGHT0=/night/.test(location.search); // 網址加 ?night 一開場就是夜晚（示範、截圖用）
const SHOT=/shot/.test(location.search);    // 網址加 ?shot 隱藏所有介面，用來截乾淨的圖
const EN0=parseFloat((location.search.match(/[?&]en=([\d.]+)/)||[])[1]);   // 網址加 ?en=0.1 可以指定開場能量
const enBar=document.querySelector('#energy i');
const DUSK0=/dusk/.test(location.search);    // 網址加 ?dusk 直接停在黃昏
const CYCLE=90;                             // 一輪日夜 90 秒：白天約 40 秒、黃昏 9 秒、夜晚 36 秒、黎明 4.5 秒
const START=DUSK0?.5:NIGHT0?1:0;
let night=START;                            // 0＝白天、0.5＝黃昏、1＝深夜；所有燈光與顏色都照這個數字插值
let nightLock=(NIGHT0||DUSK0)?START:null;   // N 鍵：null＝自動循環、0＝鎖定白天、1＝鎖定夜晚
const phaseEl=document.getElementById('phase');
const fpsEl=document.getElementById('fps');
const faceBtn=document.getElementById('faceBtn');
let faceCam=false,workMs=0;   // faceCam＝正面直視鏡頭；workMs＝這一幀實際運算花幾毫秒
function toggleFace(){faceCam=!faceCam;
  if(faceBtn){faceBtn.classList.toggle('on',faceCam);faceBtn.textContent=faceCam?'取消直視':'正面看我'}}
if(faceBtn)faceBtn.addEventListener('click',()=>toggleFace());
// 觸控面板：按住方向鈕就持續轉，放開就停（滑鼠、觸控都通用）
const cam={l:0,r:0,u:0,d:0,zi:0,zo:0};
// 判斷事件是不是發生在「面板／按鈕」上，是的話就別讓它觸發場景拖曳或震動
function isUI(ev){return !!(ev&&ev.target&&ev.target.closest&&ev.target.closest('.ui'))}
document.querySelectorAll('[data-cam]').forEach(b=>{
  const k=b.dataset.cam,on=()=>{cam[k]=1;b.classList.add('on')},off=()=>{cam[k]=0;b.classList.remove('on')};
  b.addEventListener('pointerdown',e=>{e.preventDefault();on()});
  b.addEventListener('pointerup',off);b.addEventListener('pointerleave',off);b.addEventListener('pointercancel',off)});
let barkTex,groundTex,whiteTex,yaw=.7,pitch=.2,camD=340,tx=0,ty=-120,tz=0,ex=0,ey=0,ez=0,shake=0,moved=0,pressF=0,hoverFly=false,pressing=false;
// 不會動的裝飾（板根、苔丘、磨菇）先在 setup 合併成一塊幾何，之後每幀只要 1 次繪製呼叫
let finGeom,farGeom,moundGeom,shroomGeom,padDrag=null;
const finAngs=[],gaps=[],mounds=[],shrooms=[],farTrees=[],spores=[],leaves=[],fungi=[],drops=[],flow=[],ripples=[],sparks=[],glass=[];
const HOME={x:260,y:-130,z:110};   // 牠的棲息點：沒輸入時會慢慢飄回這裡停住
const P={x:260,y:-130,z:110,vx:0,vy:0,vz:0,yaw:3.14159,pit:0,roll:0,hyd:1,glow:.6,curl:0,qt:0,react:0,en:.5,spin:0,pets:0,petT:-999};
const cx=z=>420+60*Math.sin(z*.004), hw=z=>88+14*Math.sin(z*.011);
const fh=t=>H0*Math.pow(1-t,2);
function angDiff(a,b){let d=(a-b)%TWO_PI;if(d>PI)d-=TWO_PI;if(d<-PI)d+=TWO_PI;return d}
function groundY(x,z){const r=Math.hypot(x,z),th=atan2(z,x);let m=0;
  if(r>R-10&&r<OUT){const t=(r-(R-10))/(OUT-R+10);for(const a of finAngs){const d=angDiff(th,a);if(abs(d)<1.2&&abs(r*sin(d))<22)m=max(m,fh(t))}}
  return m}
function sunPos(){const a=.75+.5*sin(frameCount*.0035);return{x:cos(a)*300,z:sin(a)*300}}
function sunAngle(){return .75+.5*sin(frameCount*.0035)}                     // 太陽在天空的位置（很慢地繞）
function moonPos(){const a=-1.41+.12*sin(frameCount*.0015);return{x:cos(a)*690,z:sin(a)*690,y:-430}}  // 月亮固定在右上方的天空，非常慢地漂
// 日夜曲線：t 是一輪裡的進度（0~1），回傳「夜晚程度」0~1
function smooth5(u){u=constrain(u,0,1);return u*u*u*(u*(u*6-15)+10)}        // 進出都平滑，不會像突然關燈
// 三段式顏色插值：night 0~0.5 走「白天→黃昏」，0.5~1 走「黃昏→夜晚」
function mixNight(a,b,c){const dk=Math.min(1,night*2),nt=Math.max(0,night*2-1);return lerp(lerp(a,b,dk),c,nt)}
function nightCurve(t){
  if(t<.45)return 0;                        // 白天（約 40 秒）
  if(t<.55)return smooth5((t-.45)/.10);     // 黃昏過渡（約 9 秒）
  if(t<.95)return 1;                        // 夜晚（約 36 秒）
  return 1-smooth5((t-.95)/.05);            // 黎明（約 4.5 秒）
}
// 月亮本體：掛在太陽的相反側，只有夜裡才畫。用 noLights 畫，才不會被昏暗的環境光吃掉
function drawMoon(){
  if(night<.02)return;
  const m=moonPos();
  noLights();
  push();translate(m.x,m.y,m.z);
  fill(244,248,255,110+145*night);sphere(46,20,14);   // 黃昏時月亮還沒那麼亮
  pop();
  lights3();                                    // 立刻把燈光還原，後面的樹才不會跟著變色
}
const fpos=f=>[cos(f.a)*(R+4),-f.h,sin(f.a)*(R+4)];
const dpos=d=>[cos(d.a)*(R+3),-d.h,sin(d.a)*(R+3)];

function setup(){
  createCanvas(innerWidth,innerHeight,WEBGL);pixelDensity(min(1.5,devicePixelRatio));
  if(!isNaN(EN0))P.en=constrain(EN0,0,1);
  if(SHOT)document.querySelectorAll('#fps,#phase,#energy,#hint,#pad,#faceBtn').forEach(e=>e.style.display='none');
  randomSeed(11);noiseSeed(5);
  const padSurf=document.getElementById('padsurf');
  for(let i=0;i<8;i++)if(i!==1)finAngs.push(i*PI/4);
  for(let k=2;k<8;k++)gaps.push((k+.5)*PI/4);gaps.push(PI/4);
  barkTex=makeBark();groundTex=makeGround();
  const ok=(x,z)=>abs(x-cx(z))>150;
  while(mounds.length<28){const x=random(-1200,1200),z=random(-1200,1200);if(Math.hypot(x,z)>300&&ok(x,z))mounds.push({x,z,r:random(22,70),c:[random(40,70),random(95,140),random(55,80)]})}
  while(shrooms.length<18){const x=random(-900,900),z=random(-900,900);if(Math.hypot(x,z)>270&&ok(x,z))shrooms.push({x,z,s:random(3,7)})}
  // 人工海玻璃：五千年溪水磨圓的玻璃瓶／陶瓷碎片（M1 世界觀第 4 點），沿著溪床放，夜裡才反月光
  const glassCols=[[140,205,190],[220,190,140],[225,235,230],[170,195,220]];
  while(glass.length<14){const z=random(-950,950),w=hw(z)*.78;
    glass.push({x:cx(z)+random(-w,w),z,r:random(3,8),c:glassCols[glass.length%4]})}
  while(farTrees.length<11){const a=random(TWO_PI),d=random(650,1650),x=cos(a)*d,z=sin(a)*d;if(x>280&&x<580)continue;
    farTrees.push({x,z,r:random(90,170),f:constrain(d/1750,0,1)})}
  for(let i=0;i<7;i++)fungi.push({a:random(gaps)+random(-.08,.08),h:random(55,420),s:1,hl:0});
  for(let i=0;i<9;i++)drops.push({a:random(gaps)+random(-.08,.08),h:random(60,420),s:1,ph:random(6)});
  for(let i=0;i<100;i++)spores.push({x:random(-800,800),y:random(-520,-10),z:random(-800,800),s:random(2,5),ph:random(6)});
  const w0=P;tx=w0.x;ty=w0.y;tz=w0.z;

  // ★ 效能關鍵：把「不會動」的裝飾合併成一塊幾何。畫面上幾百次繪製呼叫 → 4 次
  noStroke();
  // 白色 1×1 貼圖：畫「合併幾何」前先綁它，把殘留的樹皮／地面貼圖蓋掉
  whiteTex=createImage(1,1);whiteTex.set(0,0,[255,255,255,255]);whiteTex.updatePixels();
  finGeom=buildGeometry(buildMainFins);
  farGeom=buildGeometry(buildFarFins);
  moundGeom=buildGeometry(buildMounds);
  shroomGeom=buildGeometry(buildShrooms);

  // ★ 觸控面板的「滑動區」：手指在方塊上滑動就等於拖曳轉視角
  if(padSurf){
    padSurf.addEventListener('pointerdown',e=>{padDrag={x:e.clientX,y:e.clientY};
      try{padSurf.setPointerCapture(e.pointerId)}catch(err){}
      padSurf.style.cursor='grabbing';e.preventDefault()});
    padSurf.addEventListener('pointermove',e=>{if(!padDrag)return;
      yaw-=(e.clientX-padDrag.x)*.012;                                   // 左右滑＝水平轉
      pitch=constrain(pitch+(e.clientY-padDrag.y)*.008,-.45,1.35);        // 上下滑＝俯仰
      padDrag={x:e.clientX,y:e.clientY};e.preventDefault()});
    const endPad=()=>{padDrag=null;padSurf.style.cursor='grab'};
    padSurf.addEventListener('pointerup',endPad);
    padSurf.addEventListener('pointercancel',endPad);
    padSurf.addEventListener('lostpointercapture',endPad);
  }
}

function makeBark(){
  const g=createGraphics(256,512);g.pixelDensity(1);g.noStroke();
  for(let y=0;y<512;y+=3)for(let x=0;x<256;x+=2){
    const a=x/256*TWO_PI,c1=cos(a)*1.6,c2=sin(a)*1.6;
    const n=noise(c1+9,c2+9,y*.012)*.7+noise(c1*3+3,c2*3+3,y*.05)*.3;
    let r=58+n*60,gg=42+n*40,b=32+n*28;
    const m=constrain(constrain((y-340)/120,0,1)*noise(c1*2+40,c2*2,y*.03)*1.7+constrain(noise(c1*2+70,c2*2+70,y*.02)-.62,0,1)*3,0,1);
    r=lerp(r,52+n*25,m);gg=lerp(gg,110+n*60,m);b=lerp(b,48+n*20,m);
    g.fill(r,gg,b);g.rect(x,y,2,3);
  }
  g.stroke(25,16,12,150);g.strokeWeight(1.5);
  for(let i=0;i<60;i++){const x=random(256),y=random(512);g.line(x,y,x+random(-3,3),y+random(20,70))}
  return g}
function makeGround(){
  const g=createGraphics(512,512);g.pixelDensity(1);g.noStroke();g.background(34,70,52);
  for(let i=0;i<5200;i++){const x=random(512),y=random(512),n=noise(x*.012,y*.012),m=constrain((dist(x,y,256,256)/256-.55)*2.2,0,1);
    g.fill(lerp(30+n*35,22,m),lerp(70+n*80,44,m),lerp(46+n*30,40,m),200);g.circle(x,y,random(5,14))}
  for(let i=0;i<700;i++){g.fill(170,225,150,110);g.circle(random(512),random(512),random(1.5,3))}
  for(let py=0;py<512;py+=2){const wx=cx(py/512*4000-2000);g.fill(24,44,40,170);g.circle((wx+2000)/4000*512,py,34)}
  return g}

// ── 不會動的裝飾：在 setup 用 buildGeometry 合併成一整塊，之後每幀只要 1 次繪製呼叫 ──
function drawFarTrunk(f){                    // 遠樹的貼圖樹幹留在外面（貼圖合併風險高，只 22 次）
  const s=f.r/R;
  push();translate(f.x,0,f.z);
  push();translate(0,-900,0);texture(barkTex);cylinder(f.r,1800,10,1,false,false);pop();
  push();translate(0,-30*s,0);texture(barkTex);cylinder(f.r+16*s,60*s,10,1,false,false);pop();
  pop();
}
function buildFarFins(){                     // 所有遠樹的板根鰭＋根部苔丘，全部併成一塊
  for(const f of farTrees){
    const s=f.r/R,h0=H0*s,o=f.r+(OUT-R)*s,fin=4,D=3,len=(o-f.r+12*s)/D,fog=1-f.f;
    push();translate(f.x,0,f.z);
    const a0=f.x*.013+f.z*.007;              // 每棵樹的板根角度不同
    for(let k=0;k<fin;k++){push();rotateY(a0+k*TWO_PI/fin);
      for(let i=0;i<D;i++){const t=(i+.5)/D,hh=h0*Math.pow(1-t,2);
        push();translate(f.r-12*s+t*(o-f.r+12*s),-hh/2,0);
        const c=lerpColor(color(84,60,44),color(66,112,56),t*.85);
        fill(red(c)*fog,green(c)*fog,blue(c)*fog);box(len+.5,hh,34*s);pop()}
      pop()}
    push();translate(cos(PI/4)*(f.r+52*s),-2,sin(PI/4)*(f.r+52*s));scale(1,.2,1);fill(58*fog,132*fog,70*fog);sphere(58*s,14,10);pop();
    pop();
  }
}
function buildMainFins(){                    // 主體樹的板根鰭＋綠頂
  const N=10,len=(OUT-R+12)/N;
  for(const a of finAngs){push();rotateY(-a);
    for(let i=0;i<N;i++){const t=(i+.5)/N,h=fh(t);push();translate(R-12+t*(OUT-R+12),-h/2,0);
      fill(lerpColor(color(84,60,44),color(70,100,58),t*.7));box(len+.5,h,34);
      translate(0,-h/2,0);fill(66,122,60);box(len+.8,3,38);pop()}
    pop()}
}
function buildMounds(){
  for(const m of mounds){push();translate(m.x,0,m.z);scale(1,.35,1);fill(m.c[0],m.c[1],m.c[2]);sphere(m.r,10,8);pop()}
}
function buildShrooms(){
  for(const s of shrooms){push();translate(s.x,0,s.z);fill(200,215,205);translate(0,-s.s*.9,0);cylinder(s.s*.3,s.s*1.8,6,1);
    translate(0,-s.s*.9,0);scale(1,.6,1);fill(120,230,210);sphere(s.s,8,6);pop()}
}

function mouseTarget(){
  const f=createVector(tx-ex,ty-ey,tz-ez).normalize(),up=createVector(0,1,0);
  const r=p5.Vector.cross(f,up).normalize(),d=p5.Vector.cross(r,f),th=tan(PI/6);
  const nx=(mouseX/width-.5)*2,ny=(mouseY/height-.5)*2;
  const ray=f.copy().add(r.mult(nx*th*width/height)).add(d.mult(ny*th)).normalize();
  const boost=mouseIsPressed&&moved<6&&frameCount-pressF>12;
  const dep=constrain(Math.hypot(P.x-ex,P.y-ey,P.z-ez)*(boost?2.4:1),120,1400);
  return[ex+ray.x*dep,ey+ray.y*dep,ez+ray.z*dep,boost]}

// 判斷滑鼠指標是不是指在牠身上：把滑鼠射線和牠的球心做最近距離，小於半徑就算點到
function pippaHit(sx,sy){
  const mx=sx==null?mouseX:sx,my=sy==null?mouseY:sy;
  const f=createVector(tx-ex,ty-ey,tz-ez).normalize(),up=createVector(0,1,0);
  const r=p5.Vector.cross(f,up).normalize(),d=p5.Vector.cross(r,f),th=tan(PI/6);
  const nx=(mx/width-.5)*2,ny=(my/height-.5)*2;
  const ray=f.copy().add(r.mult(nx*th*width/height)).add(d.mult(ny*th)).normalize();
  const ox=P.x-ex,oy=P.y-ey,oz=P.z-ez,t=ox*ray.x+oy*ray.y+oz*ray.z;
  if(t<=0)return false;                       // 在鏡頭後面
  return Math.hypot(P.x-(ex+ray.x*t),P.y-(ey+ray.y*t),P.z-(ez+ray.z*t))<28;
}

// 被摸到的反應：核心閃一下、身體彈一下、噴出一圈彩色小光點
function reactToPet(){
  P.react=72;P.glow=1;
  P.pets=(frameCount-P.petT<80)?P.pets+1:1;P.petT=frameCount;   // 連點三下 → 開心打滾
  if(P.pets>=3){P.pets=0;P.spin=48;P.en=min(1,P.en+.04);
    for(let i=0;i<18;i++){const a=random(TWO_PI),s=random(1,2.4);
      sparks.push({x:P.x,y:P.y,z:P.z,vx:cos(a)*s,vy:random(-2,-.4),vz:sin(a)*s,life:1,r:random(1.5,3),c:[255,240,170]})}}
  for(let i=0;i<22;i++){const a=random(TWO_PI),s=random(.6,1.8);
    sparks.push({x:P.x+random(-6,6),y:P.y+random(-6,6),z:P.z+random(-6,6),
      vx:cos(a)*s,vy:random(-1.5,-.2),vz:sin(a)*s,life:1,r:random(1.2,2.6),
      c:random()<.45?[255,140,180]:random()<.5?[255,225,140]:[190,250,235]})}
}

// 滑鼠射線打到哪朵真菌（餵食用）
function fungusHit(sx,sy){
  const mx=sx==null?mouseX:sx,my=sy==null?mouseY:sy;
  const f0=createVector(tx-ex,ty-ey,tz-ez).normalize(),up=createVector(0,1,0);
  const rr=p5.Vector.cross(f0,up).normalize(),d=p5.Vector.cross(rr,f0),th=tan(PI/6);
  const nx=(mx/width-.5)*2,ny=(my/height-.5)*2;
  const ray=f0.copy().add(rr.mult(nx*th*width/height)).add(d.mult(ny*th)).normalize();
  let best=null,bd=1e9;
  for(const f of fungi){if(f.s<.06)continue;const p=fpos(f);
    const ox=p[0]-ex,oy=p[1]-ey,oz=p[2]-ez,t=ox*ray.x+oy*ray.y+oz*ray.z;
    if(t<=0)continue;
    const dd=Math.hypot(p[0]-(ex+ray.x*t),p[1]-(ey+ray.y*t),p[2]-(ez+ray.z*t));
    if(dd<26+18*f.s&&dd<bd){bd=dd;best=f}}
  return best;
}

// 餵食：被吸走的真菌會噴出光點飛向她，能量上升
function feedFungus(f){
  f.hl=1;f.s=max(.05,f.s-.3);
  P.en=min(1,P.en+.12);P.react=72;P.glow=1;
  const p=fpos(f);
  for(let i=0;i<12;i++)flow.push({x:p[0]+random(-12,12),y:p[1]+random(-12,12),z:p[2],c:random()<.5?[255,205,80]:[200,255,160]});
  for(let i=0;i<8;i++){const a=random(TWO_PI);
    sparks.push({x:p[0],y:p[1],z:p[2],vx:cos(a)*.9,vy:random(-.6,.6),vz:sin(a)*.9,life:1,r:random(1,2.2),c:[190,255,170]})}
}

function update(){
  // 鍵盤飛行：方向以鏡頭的水平朝向為準
  let ix=0,iz=0,iy=0;
  if(keyIsDown(87)||keyIsDown(UP_ARROW))iz+=1;     // W / ↑ 前進
  if(keyIsDown(83)||keyIsDown(DOWN_ARROW))iz-=1;   // S / ↓ 後退
  if(keyIsDown(65)||keyIsDown(LEFT_ARROW))ix-=1;   // A / ← 左移
  if(keyIsDown(68)||keyIsDown(RIGHT_ARROW))ix+=1;  // D / → 右移
  if(keyIsDown(32))iy-=1;                          // Space 上升
  if(keyIsDown(SHIFT))iy+=1;                       // Shift 下降
  const kb=ix||iz||iy;
  P.en=max(0,P.en-(.00005+min(9,Math.hypot(P.vx,P.vy,P.vz))*.000012));   // 移動消耗能量
  const vigor=.4+.6*min(1,P.en*2);                                        // 沒力時只剩四成速度
  if(P.qt>0){P.qt--;P.curl=min(1,P.curl+.2);P.vx*=.88;P.vy*=.88;P.vz*=.88}
  else{
    P.curl=max(0,P.curl-.05);
    if(kb){
      const fl=Math.hypot(tx-ex,tz-ez)||1,fx=(tx-ex)/fl,fz=(tz-ez)/fl;
      P.vx+=(fx*iz-fz*ix)*.9*vigor;P.vz+=(fz*iz+fx*ix)*.9*vigor;P.vy+=iy*.8*vigor;
      P.vx*=.96;P.vy*=.96;P.vz*=.96;
      const sp=Math.hypot(P.vx,P.vy,P.vz),mx=9*vigor;if(sp>mx){P.vx*=mx/sp;P.vy*=mx/sp;P.vz*=mx/sp}
    }else{
      let boost=false,g=null;
      if(hoverFly||pressing){const m=mouseTarget();g=[m[0],m[1],m[2]];boost=m[3]}
      if(g){
        let ax=g[0]-P.x,ay=g[1]-P.y,az=g[2]-P.z;const d=Math.hypot(ax,ay,az)||1,k=min(.5,d*.006)/d*vigor;
        P.vx+=ax*k;P.vy+=ay*k;P.vz+=az*k;
        P.vx*=.93;P.vy*=.93;P.vz*=.93;
        const sp=Math.hypot(P.vx,P.vy,P.vz),mx=(boost?11:7.5)*vigor;if(sp>mx){P.vx*=mx/sp;P.vy*=mx/sp;P.vz*=mx/sp}
      }else{
        // 沒有輸入：慢慢減速停在原地（不會自己飄回去），只留呼吸般的浮動
        P.vx*=.9;P.vy*=.9;P.vz*=.9;
      }
    }
  }
  // 沒力氣了（能量 <12%）又沒在操控：自己慢慢飄去最近的菌叢吃一頓
  if(P.en<.12&&!kb&&!hoverFly&&!pressing&&P.qt<=0){
    let best=null,bd=1e9;
    for(const f of fungi){if(f.s<.2)continue;const p=fpos(f),dd=Math.hypot(P.x-p[0],P.y-p[1],P.z-p[2]);if(dd<bd){bd=dd;best=p}}
    if(best){const dx=best[0]-P.x,dy=best[1]-P.y,dz=best[2]-P.z,dl=Math.hypot(dx,dy,dz)||1,k=.5/dl;
      P.vx+=dx*k;P.vy+=dy*k;P.vz+=dz*k;P.vx*=.96;P.vy*=.96;P.vz*=.96}
  }
  P.x+=P.vx;P.y+=P.vy+sin(frameCount*.07)*.15*(.45+.55*min(1,P.en*2));P.z+=P.vz;
  // collisions: trunk, far trunks, ground & roots, bounds
  let r=Math.hypot(P.x,P.z);if(r<R+26){P.x*=(R+26)/r;P.z*=(R+26)/r}
  for(const f of farTrees){const dx=P.x-f.x,dz=P.z-f.z,dd=Math.hypot(dx,dz);if(dd<f.r+24){P.x=f.x+dx/dd*(f.r+24);P.z=f.z+dz/dd*(f.r+24)}}
  P.y=constrain(P.y,-1100,-16-groundY(P.x,P.z));P.x=constrain(P.x,-1500,1500);P.z=constrain(P.z,-1500,1500);
  // orientation
  if(faceCam){
    // 正面直視：把臉轉向攝影機（用鏡頭到牠的方向反推 yaw / pit）
    const dx=ex-P.x,dy=ey-P.y,dz=ez-P.z,dl=Math.hypot(dx,dy,dz)||1;
    P.yaw+=angDiff(Math.atan2(dx,dz),P.yaw)*.08;
    P.pit=lerp(P.pit,-Math.asin(constrain(dy/dl,-1,1)),.08);
    P.roll*=.9;
  }else{
    const sp=Math.hypot(P.vx,P.vz);
    if(sp>.3){const t=atan2(P.vx,P.vz),d=angDiff(t,P.yaw);P.yaw+=d*.1;P.roll=lerp(P.roll,constrain(d*2.4,-.6,.6),.1)}
    else P.roll*=.9;
    P.pit=lerp(P.pit,constrain(-P.vy*.1,-.6,.6),.1);
  }
  if(P.react>0)P.react--;                    // 被點到之後的反應計時
  if(P.spin>0)P.spin--;
  // 發光亮度由能量決定：能量 0.5 時剛好是原本的亮度，沒能量就幾乎不亮
  P.glow=max(P.glow-.02,.18+.64*P.en);
  P.hyd=max(0,P.hyd-.0002);
  // symbiosis: she drinks harmful fungus (and spreads healing moss), the tree offers nectar
  if(P.curl<.3){
    for(const f of fungi){const p=fpos(f);
      if(f.s>.06&&Math.hypot(P.x-p[0],P.y-p[1],P.z-p[2])<95){f.s-=.006;f.hl=min(1,f.hl+.01);P.en=min(1,P.en+.0025);
        if(frameCount%2==0)flow.push({x:p[0]+random(-8,8),y:p[1]+random(-8,8),z:p[2],c:[200,140,230]})}
      else f.s=min(1,f.s+.0003);
      if(f.s>.5)f.hl=max(0,f.hl-.0004)}
    for(const d of drops){const p=dpos(d);
      if(d.s>.2&&Math.hypot(P.x-p[0],P.y-p[1],P.z-p[2])<80){d.s-=.012;P.en=min(1,P.en+.004);P.hyd=min(1,P.hyd+.004);
        if(frameCount%2==0)flow.push({x:p[0],y:p[1],z:p[2],c:[255,205,80]})}
      d.s=min(1,d.s+.0012)}
    if(P.y>-34&&abs(P.x-cx(P.z))<hw(P.z)+10){P.hyd=min(1,P.hyd+.01);if(frameCount%10==0)ripples.push({x:P.x,z:P.z,t:0})}
  }
}

function quake(){
  P.qt=40;shake=11;   // 40 幀約 0.7 秒（原本 150 幀＝2.5 秒太久了）
  for(let i=0;i<24;i++)leaves.push({x:tx+random(-450,450),y:random(-950,-300),z:tz+random(-450,450),vy:random(.8,1.8),ph:random(6),c:random()<.6?[90,150,70]:[210,170,70]})}

function lights3(){
  // 三段式：白天 → 黃昏（暖橘）→ 夜晚（冷藍）；night 0~0.5 走黃昏，0.5~1 走夜晚
  ambientLight(mixNight(95,72,18),mixNight(120,64,26),mixNight(110,74,48));
  directionalLight(mixNight(255,255,150),mixNight(235,172,175),mixNight(190,112,225),lerp(-.3,.35,night),lerp(.8,.55,night),lerp(-.4,.45,night));  // 白天暖陽 → 黃昏低斜橘光 → 夜裡冷月光
  directionalLight(mixNight(60,88,26),mixNight(90,72,36),mixNight(110,96,58),.5,.3,.6);
  lightFalloff(1,.004,.00003);pointLight(255,208,60+230*P.glow,P.x,P.y-4,P.z);   // 牠自己的光：亮度跟著能量走
}

function draw(){
  noStroke();
  const t0=millis();
  // ── 日夜：先算出這一幀的夜晚程度（0 白天、1 深夜），下面所有燈光與顏色都靠它
  const cyc=(millis()*.001/CYCLE)%1;
  night+=((nightLock!==null?nightLock:nightCurve(cyc))-night)*.12;
  if(phaseEl&&(frameCount%12===0||frameCount<3))phaseEl.textContent=night>.75?'☾ 夜晚':night>.25?'🌗 黃昏':'☀ 白天';
  // 觸控面板：按住就持續轉視角（左右＝yaw、上下＝pitch、＋－＝遠近）
  yaw+=(cam.l-cam.r)*.035;                        // ◀ ▶ 按鈕：轉的方向和「拖曳」一致
  pitch=constrain(pitch+(cam.d-cam.u)*.02,-.45,1.35);
  camD=constrain(camD*(1+(cam.zo-cam.zi)*.012),150,1200);
  ex=tx+camD*cos(pitch)*sin(yaw);ey=min(ty-camD*sin(pitch),-12);ez=tz+camD*cos(pitch)*cos(yaw);
  update();
  tx=lerp(tx,P.x,.07);ty=lerp(ty,P.y,.07);tz=lerp(tz,P.z,.07);
  if(P.qt>0)shake=max(shake,P.qt/40*9);shake*=.93;
  background(mixNight(22,52,7),mixNight(44,36,11),mixNight(40,44,22));   // 入夜後天空轉深靛藍
  if((frameCount%15===0||frameCount<3)&&fpsEl)fpsEl.textContent=Math.round(frameRate())+' fps ・ 運算 '+workMs.toFixed(1)+' ms';
  if(enBar&&frameCount%6===0){enBar.style.width=(P.en*100).toFixed(1)+'%';
    enBar.style.background=P.en<.25?'#c96a5a':P.en<.6?'#ffc46a':'#ffe6a8';}
  perspective(PI/3,width/height,5,12000);
  camera(ex+random(-shake,shake),ey+random(-shake,shake),ez,tx,ty,tz,0,1,0);
  lights3();
  drawMoon();

  // 合併幾何（板根／苔丘）：幾百個方塊合成 1 次繪製呼叫
  texture(whiteTex);
  if(!BARE){model(farGeom);model(moundGeom)}
  model(finGeom);
  // 有貼圖的東西畫在後面，免得殘留的貼圖影響上面的合併幾何
  push();rotateX(HALF_PI);texture(groundTex);plane(4000,4000);pop();
  for(const f of farTrees)drawFarTrunk(f);
  push();translate(0,-1100,0);texture(barkTex);cylinder(R,2200,24,1,false,false);pop();
  push();translate(0,-30,0);texture(barkTex);cylinder(R+16,60,24,1,false,false);pop();
  const dx=cos(PI/4),dz=sin(PI/4);
  push();translate(dx*(R+52),-2,dz*(R+52));scale(1,.2,1);fill(58,132,70);sphere(58,14,10);pop();
  const bump=[[0,0,1],[-9,5,.7],[8,6,.8],[-5,-8,.6],[7,-7,.7],[1,11,.5]];
  for(const f of fungi){push();translate(cos(f.a)*(R+1),-f.h,sin(f.a)*(R+1));rotateY(HALF_PI-f.a);
    for(const b of bump){
      if(f.s>.03){push();translate(b[0]*f.s,b[1]*f.s,0);scale(1,1,.45);fill(185,150,200);sphere(7*b[2]*f.s,10,8);pop();
        push();translate(b[0]*f.s,b[1]*f.s,3.4*b[2]*f.s);fill(235,150,90);sphere(1.6*f.s,6,5);pop()}
      if(f.hl>.02){push();translate(b[0]*1.2,b[1]*1.2,2);fill(120,238,160);sphere(3.6*b[2]*f.hl*(1+.12*sin(frameCount*.06+b[0])),8,6);pop()}}
    pop()}
  if(!BARE){texture(whiteTex);model(shroomGeom)}
  // 人工海玻璃卵石：五千年溪水磨圓的玻璃瓶與陶瓷碎片，白天只是暗暗的石頭
  for(const g of glass){
    push();translate(g.x,-.8,g.z);scale(1,.38,1);
    fill(g.c[0],g.c[1],g.c[2],235);sphere(g.r,8,6);pop();
  }

  noLights();
  fill(mixNight(38,46,10),mixNight(108,66,26),mixNight(118,86,48),lerp(175,205,night));beginShape(TRIANGLE_STRIP);
  for(let z=-1900;z<=1900;z+=60){const c=cx(z),h=hw(z);vertex(c-h,-1.5,z);vertex(c+h,-1.5,z)}endShape();
  fill(mixNight(120,96,78),mixNight(210,140,118),mixNight(210,150,196),lerp(55,18,night));beginShape(TRIANGLE_STRIP);
  for(let z=-1900;z<=1900;z+=60){const c=cx(z),h=hw(z)*.45;vertex(c-h,-2,z);vertex(c+h,-2,z)}endShape();
  for(let k=0;k<18;k++){const z=((k*131+frameCount*1.3)%3800)-1900,x=cx(z)+((k*37)%100-50)*1.2;
    push();translate(x,-2.6,z);rotateX(HALF_PI);fill(lerp(225,212,night),lerp(255,236,night),255,lerp(75,58,night));ellipse(0,0,6,26);pop()}
  for(const d of drops){push();translate(...dpos(d));
    const s=d.s*(1+.06*sin(frameCount*.05+d.ph));fill(255,200,70,215);sphere((4.5+1.6*night)*s+.01,10,8);
    translate(-1.2,-1.4,3);fill(255,255,255,200);sphere(1.2*s+.01,6,5);pop()}
  drawingContext.depthMask(false);blendMode(ADD);
  const sf=sunPos(),mf=1-night;                    // mf＝白天的比例，太陽的光斑與光束靠它淡出
  if(!BARE&&mf>.01)for(let k=0;k<3;k++){push();translate(sf.x,-2.8,sf.z);rotateX(HALF_PI);fill(255,230,150,(18+k*8)*mf);ellipse(0,0,150-k*34,115-k*24);pop()}
  const sh=[[sf.x,sf.z,1],[-260,-380,.5],[-420,260,.6],[160,-520,.5],[-120,520,.45]];
  if(!BARE&&mf>.01)for(const s of sh){push();translate(s[0],-550,s[1]);rotateY(atan2(ex-s[0],ez-s[1]));rotateZ(.14);
    for(let k=0;k<2;k++){fill(255,235,160,16*s[2]*mf);plane(56+k*74,1200)}pop()}
  // ── 夜裡才出現的光 ──────────────────────────────────────────────
  if(night>.01){
    const m=moonPos();
    // 月亮的光暈：很多層很淡的同心圓疊起來（ADD 疊加），邊緣才會柔
    push();translate(m.x,m.y,m.z);rotateY(atan2(ex-m.x,ez-m.z));
    for(let k=0;k<24;k++){
      const rr=46+k*5;                              // 從月亮半徑往外長到 161
      fill(150,188,255,4.5*night*(1-k/24));
      circle(0,0,rr*2);
    }
    pop();
    // 月光打在溪面上：沿著水流方向的一條冷色反光帶，會微微晃動
    const mz=constrain(P.z+m.z*.25,-1500,1500),wob=1+.06*sin(frameCount*.02);
    for(let k=0;k<3;k++){push();translate(cx(mz),-2.1,mz);rotateX(HALF_PI);
      fill(180,212,255,(10-k*2.5)*night);ellipse(0,0,hw(mz)*(1.1+k*.7)*wob,1500);pop()}
    // 海玻璃的反光：月亮在你背後、你正看著它時最亮，轉個角度就暗掉（假反射，但看起來會閃）
    for(const g of glass){
      const vx=ex-g.x,vy=ey+.8,vz=ez-g.z,vl=Math.hypot(vx,vy,vz)||1;
      const gx=m.x-g.x,gy=m.y+.8,gz=m.z-g.z,gl=Math.hypot(gx,gy,gz)||1;
      const sp=Math.pow(Math.max(0,(vx*gx+vy*gy+vz*gz)/(vl*gl)),6);
      push();translate(g.x,-.8,g.z);
      fill(g.c[0],g.c[1],g.c[2],14*night);sphere(g.r,8,6);        // 一點自體微光，免得夜裡整顆消失
      if(sp>.015){fill(205,228,255,200*night*sp);sphere(g.r*.85,8,6);
        fill(235,248,255,140*night*sp);sphere(g.r*.4,6,5)}
      pop();
    }
  }
  // ──────────────────────────────────────────────────────────────
  for(const s of shrooms){push();translate(s.x,-1.5,s.z);rotateX(HALF_PI);fill(110,230,210,min(30,16*(1+.7*night)));circle(0,0,s.s*9);pop()}
  for(const f of fungi)if(f.hl>.05){push();translate(...fpos(f));fill(150,255,170,min(50,16*f.hl*(1+1.3*night)));sphere(20+4*sin(frameCount*.05),10,8);pop()}
  if(night>.02)for(const d of drops){const p=dpos(d);push();translate(...p);fill(255,200,80,55*night*d.s);sphere(11*d.s,8,6);pop()}   // 蜜露在夜裡比較亮
  // 被摸到時噴出的小光點
  for(let i=sparks.length-1;i>=0;i--){const s=sparks[i];
    s.x+=s.vx;s.y+=s.vy;s.z+=s.vz;s.vy+=.012;s.vx*=.97;s.vz*=.97;s.life-=.014;
    if(s.life<=0){sparks.splice(i,1);continue}
    push();translate(s.x,s.y,s.z);fill(s.c[0],s.c[1],s.c[2],235*s.life);sphere(s.r*s.life,6,5);pop()}
  push();stroke(255,238,170,150+95*night);strokeWeight(3.4);
  // 孢子改成一次畫完（原本 100 顆 = 100 次繪製呼叫，現在 = 1 次）
  if(!BARE){beginShape(POINTS);
    for(const p of spores){p.x+=sin(frameCount*.01+p.ph)*.25;p.y+=cos(frameCount*.013+p.ph)*.15-.03;p.z+=cos(frameCount*.009+p.ph)*.25;
      if(p.y<-540)p.y=-10;if(p.y>-6)p.y=-520;vertex(p.x,p.y,p.z)}
    endShape()}
  strokeWeight(5);
  for(let i=flow.length-1;i>=0;i--){const q=flow[i];q.x+=(P.x-q.x)*.1;q.y+=(P.y-q.y)*.1;q.z+=(P.z-q.z)*.1;
    if(Math.hypot(P.x-q.x,P.y-q.y,P.z-q.z)<12){flow.splice(i,1);continue}
    stroke(q.c[0],q.c[1],q.c[2],220);point(q.x,q.y,q.z)}
  noFill();strokeWeight(1.5);
  for(let i=ripples.length-1;i>=0;i--){const r=ripples[i];r.t+=.02;if(r.t>1){ripples.splice(i,1);continue}
    stroke(220,255,255,200*(1-r.t));push();translate(r.x,-2.8,r.z);rotateX(HALF_PI);circle(0,0,10+r.t*80);pop()}
  pop();
  blendMode(BLEND);
  for(let i=leaves.length-1;i>=0;i--){const l=leaves[i];l.y+=l.vy;l.x+=sin(frameCount*.05+l.ph)*.8;if(l.y>-2){leaves.splice(i,1);continue}
    push();translate(l.x,l.y,l.z);rotateX(frameCount*.05+l.ph);rotateZ(frameCount*.03+l.ph);fill(l.c[0],l.c[1],l.c[2]);plane(12,6);pop()}
  drawingContext.depthMask(true);

  lights3();
  [[-20,-10],[8,-18],[4,14]].forEach((o,i)=>{push();translate(dx*(R+52)-dz*o[0]+dx*o[1],-7,dz*(R+52)+dx*o[0]+dz*o[1]);
    fill(255,205,90);sphere(2+.5*sin(frameCount*.06+i*2),8,6);fill(215,255,240,105);sphere(7,14,10);pop()});
  drawPippa();
  workMs=workMs*.85+(millis()-t0)*.15;   // 平滑後的「每幀實際運算時間」
}

// Pippa: a drifting cluster of off-white pearl bubbles with a warm light glowing from its centre
const LOBES=[[0,0,-11,12],[-10,-1,-9,9],[10,0,-9,9],[-5,15,-5,8],[8,14,-5,7],[-17,6,-4,8],[16,7,-3,8.5],[-15,-7,-3,9],[14,-8,-4,9.5],[0,-16,-4,9],[0,0,0,13.5]];
const TINT=[[248,245,234],[243,242,243],[252,246,236],[245,242,244]];   // 米白色（四種只差一點點的白）
const STR=[[-11,-5,-9],[11,-5,-9],[-9,8,-9],[9,8,-9]];
const strand=(i,u,T,spd)=>{const t=STR[i];return[t[0]*(1+u*1.5)+sin(T*.1+u*5+i*1.7)*u*7*(.5+spd),t[1]*(1+u*1.1)+cos(T*.08+u*4+i)*u*6+u*u*10,t[2]-u*(1-P.curl*.8)*50]};
function drawPippa(){
  const c=P.curl,spd=min(Math.hypot(P.vx,P.vy,P.vz)/6,1),T=frameCount,pale=(1-P.hyd)*.5;
  const flick=P.en<.25?constrain(.45+.55*sin(T*.45),.15,1):1;      // 快沒能量時光會一閃一閃
  const g=P.glow*flick;
  const happy=P.react>0,bounce=happy?1+.22*sin((72-P.react)*.45)*(P.react/72):1;   // 被摸到時彈一下
  push();translate(P.x,P.y,P.z);rotateY(P.yaw);rotateX(P.pit);rotateZ(P.roll+(P.spin>0?(1-P.spin/48)*TWO_PI:0));
  scale(bounce*(.9+.1*P.hyd)*(1-.2*c)*(1+.05*sin(T*.9)*c),bounce*(.9+.1*P.hyd)*(1-.2*c)*(1+.04*sin(T*.05)),bounce*(1-.2*c)*(1+.06*spd));
  // trailing tendrils ending in warm glowing orbs
  for(let i=0;i<4;i++){
    for(let k=1;k<5;k++){push();translate(...strand(i,k/5,T,spd));fill(246,244,236,242);sphere(.75,5,4);pop()}
    const e=strand(i,1,T,spd);
    push();translate(...e);emissiveMaterial(255*g,215*g,120*g);fill(255,235,170);sphere(2.8,10,8);pop();
    push();translate(...e);fill(255,230,150,50);sphere(6+1.5*sin(T*.07+i),10,8);pop()}
  // 外層：米白色的雲霧狀身體（半透明、沒有玻璃高光）
  drawingContext.depthMask(false);
  LOBES.forEach((l,i)=>{
    const t=TINT[i%4],k=i==10?.8:1,r=l[3]*(1+.05*sin(T*.05+i*1.3)),m=1-c*.5;
    push();translate(l[0]*m+sin(T*.03+i)*.8,l[1]*m+cos(T*.025+i*2)*.8,l[2]*m);
    // （原本這裡有一圈半透明的冷色光邊，是「雲狀透明感」的來源，已移除 → 讓身體成為實心米白）
    // body: 米白色、60% 不透明（更霧）
    fill(lerp(lerp(t[0],252,pale),255,night*.5),lerp(lerp(t[1],252,pale),240,night*.5),lerp(lerp(t[2],252,pale),206,night*.5),153+32*night);sphere(r,18,13);   // 夜裡身體自己透出一點暖光，白天完全不變
    // （玻璃感的高光反光已移除 → 改成單純的雲霧狀）
    pop()});
  // 夜裡才出現的月光反光：很淡的一層冷白光落在身體上緣（白天完全看不到）
  if(night>.25){
    blendMode(ADD);
    push();translate(-4,15,-2);scale(1,.5,.6);fill(170,200,255,26*night);sphere(7.2,12,10);pop();
    push();translate(9,12,3);scale(.9,.45,.6);fill(150,185,255,17*night);sphere(5.6,10,8);pop();
    blendMode(BLEND);
  }
  // ★ 臉一定要畫在身體之後：身體是不透明的，先畫的臉會被整顆蓋掉（這就是剛剛「看不出是生物」的原因）
  const blink=T%220<6;
  for(const s of[-1,1]){push();translate(s*4.4,-1,11.9);        // 眼距
    if(happy)scale(1.25,.32,1);else if(blink)scale(1.3,.22,1);else if(P.en<.3)scale(1.15,.5,1);   // 開心瞇眼 / 眨眼 / 沒力半閉
    fill(40,44,54);sphere(1.25,8,6);pop();
    push();translate(s*8.4,3.2,8.8);scale(happy?1.4:1,.7,.35);fill(255,150,175,happy?235:200);sphere(3,8,6);pop()}
  push();translate(0,4.2,12.8);scale(1.6,happy?1.2:.5,.4);fill(220,120,140);sphere(1,6,5);pop();
  // ★ 身體最正中心的晶體：固定在 (0,0,0)，很小、透明度 85%，散發橘色暖光
  const gr=1+.06*sin(T*.07);
  push();
  fill(255,232,186,38);                                       // 晶體本體：透明度 85%（38/255 ≈ 15% 不透明）
  emissiveMaterial(255*g,206*g,110*g);sphere(0.15*gr,6,4);    // 晶體本體（更小、偏橘、會發光）
  blendMode(ADD);                                             // 橘色暖光：從 2 一路散到 8.6，越外圈越橘越淡
  fill(255,222,134,175*g);sphere(2.0*gr,8,6);
  fill(255,204,96,95*g);  sphere(3.6*gr,10,8);
  fill(255,186,66,48*g);  sphere(5.8*gr,10,8);
  fill(255,170,48,20*g);  sphere(8.6*gr,12,10);
  blendMode(BLEND);
  pop();
  drawingContext.depthMask(true);
  pop();
}

function keyPressed(){
  if(key==='n'||key==='N'){nightLock=nightLock===null?0:nightLock===0?1:null;return false}   // 自動 → 鎖白天 → 鎖夜晚 → 自動
  if(key==='m'||key==='M'){hoverFly=!hoverFly;return false}
  if(key==='f'||key==='F'){toggleFace();return false}
  if(key==='r'||key==='R'){P.x=HOME.x;P.y=HOME.y;P.z=HOME.z;P.vx=P.vy=P.vz=0;return false}
  if(keyCode===32||(keyCode>=37&&keyCode<=40))return false;   // 空白與方向鍵不要捲動頁面
}
// 拖曳＝轉視角（滑鼠與觸控共用同一套邏輯）
let tPrev=null;                                  // 觸控上一次的座標
function lookStart(ev){if(isUI(ev))return;moved=0;pressF=frameCount;pressing=true;return false}
function lookDrag(){yaw-=(mouseX-pmouseX)*.006;pitch=constrain(pitch+(mouseY-pmouseY)*.006,-.45,1.35);moved+=abs(mouseX-pmouseX)+abs(mouseY-pmouseY)}
function lookTap(sx,sy){pressing=false;if(moved<6&&frameCount-pressF<=12){
  if(pippaHit(sx,sy))reactToPet();
  else{const f=fungusHit(sx,sy);if(f)feedFungus(f);else quake()}}}
function mousePressed(ev){lookStart(ev)}
function mouseDragged(ev){if(isUI(ev))return;lookDrag();return false}
function mouseReleased(ev){if(isUI(ev))return;lookTap()}
// 觸控：不靠 p5 的 mouseX（觸控時不一定會更新），直接讀手指的座標
function touchStarted(ev){if(isUI(ev))return;const t=ev.touches&&ev.touches[0];if(!t)return;
  tPrev={x:t.clientX,y:t.clientY};return lookStart()}
function touchMoved(ev){if(isUI(ev))return false;const t=ev.touches&&ev.touches[0];if(!t||!tPrev)return false;
  yaw-=(t.clientX-tPrev.x)*.006;
  pitch=constrain(pitch+(t.clientY-tPrev.y)*.006,-.45,1.35);
  moved+=abs(t.clientX-tPrev.x)+abs(t.clientY-tPrev.y);
  tPrev={x:t.clientX,y:t.clientY};return false}
function touchEnded(ev){if(isUI(ev))return false;const t=ev.changedTouches&&ev.changedTouches[0];
  tPrev=null;lookTap(t?t.clientX:null,t?t.clientY:null);return false}
function mouseWheel(e){camD=constrain(camD*exp(e.delta*.001),150,1200);return false}
function windowResized(){resizeCanvas(innerWidth,innerHeight)}
