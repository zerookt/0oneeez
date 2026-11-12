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
const finAngs=[],gaps=[],mounds=[],shrooms=[],farTrees=[],spores=[],leaves=[],fungi=[],drops=[],flow=[],ripples=[],sparks=[],glass=[],companions=[];
const HOME={x:260,y:-130,z:110};   // 牠的棲息點：閒置時會依戀地飄回母樹旁依偎
const P={x:260,y:-130,z:110,vx:0,vy:0,vz:0,yaw:3.14159,pit:0,roll:0,hyd:1,glow:.6,curl:0,qt:0,react:0,en:.5,spin:0,pets:0,petT:-999,idleT:0,treatT:0};
const cx=z=>420+60*Math.sin(z*.004), hw=z=>88+14*Math.sin(z*.011);
const fh=t=>H0*Math.pow(1-t,2);
function angDiff(a,b){let d=(a-b)%TWO_PI;if(d>PI)d-=TWO_PI;if(d<-PI)d+=TWO_PI;return d}
function groundY(x,z){const r=Math.hypot(x,z),th=atan2(z,x);let m=0;
  if(r>R-10&&r<OUT){const t=(r-(R-10))/(OUT-R+10);for(const a of finAngs){const d=angDiff(th,a);if(abs(d)<1.2&&abs(r*sin(d))<22)m=max(m,fh(t))}}
  return m}

// ── 天體軌道與日夜計算 ──────────────────────────────────────────────
// 取得當前在 90 秒循環中的進度（支援 N 鍵鎖定白天 / 黃昏 / 夜晚）
function getOrbitTime(){
  if(nightLock===0)return .2;
  if(nightLock===1)return .72;
  if(nightLock===.5)return .48;
  return (millis()*.001/CYCLE)%1;
}
// 太陽與月亮的位置：隨時間在穹頂呈 180 度對稱升降
function sunPos(){
  const t=getOrbitTime(), a=(t-0.2+0.25)*TWO_PI;
  return {x:cos(a)*820, y:-sin(a)*620, z:sin(a*.6)*300};
}
function moonPos(){
  const t=getOrbitTime(), a=(t-0.2+0.25)*TWO_PI+PI;
  return {x:cos(a)*820, y:-sin(a)*620, z:sin(a*.6)*300};
}
function sunAngle(){return (getOrbitTime()-0.2+0.25)*TWO_PI}

// 平滑過渡曲線（Hermite 內插）
function smooth5(u){u=constrain(u,0,1);return u*u*u*(u*(u*6-15)+10)}

// 四階段環境色彩插值：白天 → 黃昏（暖金赤橘） → 深邃星夜（冷銀深藍）
function mixNight(a,b,c){const dk=Math.min(1,night*2),nt=Math.max(0,night*2-1);return lerp(lerp(a,b,dk),c,nt)}

// 日夜曲線：加長黃昏與破曉時間，讓暮色與晨曦有自然的微光層次
function nightCurve(t){
  if(t<.40)return 0;                            // 白天（約 36 秒，林冠均勻漫射光）
  if(t<.54)return smooth5((t-.40)/.14);         // 黃昏暮光過渡（約 12.6 秒，夕陽斜射與紫橘漸層）
  if(t<.88)return 1;                            // 深邃夜晚（約 30.6 秒，月光與真菌冷光）
  return 1-smooth5((t-.88)/.12);                // 晨曦破曉過渡（約 10.8 秒，從容迎接晨光）
}

// 太陽本體：日落時沉入樹林地平線，日出時自東方破曉
function drawSun(){
  const s=sunPos();
  if(s.y>70)return; // 沉入地平線以下不畫
  const fade=constrain(-s.y/120,0,1)*(1-constrain(night*1.4-.2,0,1));
  if(fade<.02)return;
  noLights();
  push();translate(s.x,s.y,s.z);
  fill(255,248,220,230*fade);sphere(42,20,14);
  drawingContext.depthMask(false);blendMode(ADD);
  rotateY(atan2(ex-s.x,ez-s.z));
  for(let k=0;k<14;k++){
    const rr=42+k*9;
    fill(255,lerp(225,140,night*2),80,lerp(18,5,night)*(1-k/14)*fade);
    circle(0,0,rr*2);
  }
  blendMode(BLEND);drawingContext.depthMask(true);
  pop();
  lights3();
}

// 月亮本體：在夜空緩慢巡遊，自帶多層同心圓柔和冷月暈
function drawMoon(){
  const m=moonPos();
  if(m.y>70)return; // 沉入地平線以下不畫
  const fade=constrain(-m.y/120,0,1)*night;
  if(fade<.02)return;
  noLights();
  push();translate(m.x,m.y,m.z);
  fill(240,246,255,245*fade);sphere(46,20,14);
  drawingContext.depthMask(false);blendMode(ADD);
  rotateY(atan2(ex-m.x,ez-m.z));
  for(let k=0;k<22;k++){
    const rr=46+k*5.5;
    fill(150,188,255,4.2*fade*(1-k/22));
    circle(0,0,rr*2);
  }
  blendMode(BLEND);drawingContext.depthMask(true);
  pop();
  lights3();
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
  // 人工海玻璃與人造殘留物（M1 第 4 點）：五千年流水沖刷的磨砂海玻璃、厚瓶底與陶瓷片
  const glassCols=[
    [100,230,175], // 磨砂可樂瓶翡翠綠
    [235,155,65],  // 琥珀啤酒玻璃
    [70,140,245],  // 鈷藍藥劑玻璃
    [235,245,240], // 乳白海鹽磨砂玻璃
    [245,242,232], // 青花瓷胎白
    [210,115,82]   // 赤陶磚卵石
  ];
  // 3 座地標級大型厚底凹槽酒瓶殘片（一眼可辨識）
  glass.push({x:cx(100)-36,z:100,r:26,c:[100,230,175],kind:1,th:.48,rot:0.35,landmark:true});
  glass.push({x:cx(-220)+38,z:-220,r:24,c:[235,155,65],kind:1,th:.5,rot:-0.6,landmark:true});
  glass.push({x:cx(380)-24,z:380,r:22,c:[70,140,245],kind:1,th:.46,rot:1.1,landmark:true});

  while(glass.length<40){
    const z=random(-1100,1100), w=hw(z)*.85;
    const kind=glass.length%3; // 0: 圓潤海玻璃卵石, 1: 圓形瓶底厚殘片, 2: 陶瓷片
    glass.push({
      x:cx(z)+random(-w,w),
      z,
      r:random(8,16),      // 放大尺寸，更具視覺辨識度
      c:glassCols[glass.length%glassCols.length],
      kind,
      th:random(0.28,0.46),
      rot:random(TWO_PI),
      landmark:false
    });
  }

  // ★ 4 隻野生獨立棲居的 NPC 樹醫（分布在不同生態棲位，只有 Pippa 接近時才會觸發獨特互動本性）
  const npcCfg=[
    {name:'暮暮',home:{x:-135,y:-65,z:-150},s:.76,c:[255,185,90], role:'sleepy'}, // 樹洞板根空腔：愛睡覺的瞌睡樹醫
    {name:'瀾瀾',home:{x:cx(240),y:-25,z:240},s:.78,c:[110,215,255],role:'forager'},// 清溪水面：採集甘露的水上舞者
    {name:'苗苗',home:{x:cos(PI*.75)*(R+14),y:-190,z:sin(PI*.75)*(R+14)},s:.70,c:[115,245,165],role:'doctor'}, // 樹幹真菌旁：勤勉的實習醫生
    {name:'幽幽',home:{x:R+52,y:-24,z:40},s:.65,c:[245,230,185], role:'shy'}      // 鈦金屬科研環旁：害羞捉迷藏的守護者
  ];
  for(let i=0;i<npcCfg.length;i++){
    const cfg=npcCfg[i];
    companions.push({
      x:cfg.home.x,y:cfg.home.y,z:cfg.home.z,
      home:{...cfg.home},
      vx:0,vy:0,vz:0,
      yaw:random(TWO_PI),pit:0,roll:0,
      s:cfg.s,c:cfg.c,en:.8,
      glow:cfg.role==='sleepy'?.12:.55,
      curl:cfg.role==='sleepy'?.75:0,
      react:0,role:cfg.role,name:cfg.name,
      ph:random(TWO_PI),
      greetT:0
    });
  }
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

// 樹醫巡診與治癒：淨化病變真菌、結出甘露、吸收能量
function feedFungus(f){
  f.hl=1;f.s=max(.05,f.s-.35);
  P.en=min(1,P.en+.18);P.react=72;P.treatT=48;
  const p=fpos(f);
  // 治癒光塵與養分逆流
  for(let i=0;i<16;i++)flow.push({x:p[0]+random(-14,14),y:p[1]+random(-14,14),z:p[2],c:random()<.5?[255,215,90]:[160,255,180]});
  for(let i=0;i<10;i++){const a=random(TWO_PI);
    sparks.push({x:p[0],y:p[1],z:p[2],vx:cos(a)*1.1,vy:random(-.8,.4),vz:sin(a)*1.1,life:1.2,r:random(1.4,2.6),c:[160,255,190]})}
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

  if(kb||hoverFly||pressing){P.idleT=0}else{P.idleT++}

  // 能量消耗
  P.en=max(0,P.en-(.00005+min(9,Math.hypot(P.vx,P.vy,P.vz))*.000012));
  const vigor=.35+.65*min(1,P.en*2);              // 沒力時速度只剩 35%

  if(P.qt>0){
    P.qt--;
    P.curl=min(1,P.curl+.25);                     // 受驚嚇時抱頭縮成防禦球
    P.vx*=.85;P.vy*=.85;P.vz*=.85;
  }else{
    P.curl=max(0,P.curl-.035);
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
      }else if(P.idleT>320&&P.en>.15&&P.qt<=0){
        // ★ 天性：閒置超過 5 秒時，自動依戀母樹，慢慢飄回板根空腔依偎休憩
        const ax=HOME.x-P.x,ay=HOME.y-P.y,az=HOME.z-P.z,d=Math.hypot(ax,ay,az)||1;
        if(d>35){P.vx+=ax/d*.14*vigor;P.vy+=ay/d*.12*vigor;P.vz+=az/d*.14*vigor}
        P.vx*=.92;P.vy*=.92;P.vz*=.92;
      }else{
        // 浮游減速
        P.vx*=.9;P.vy*=.9;P.vz*=.9;
      }
    }
  }

  // ★ 天性：缺乏能量（<12%）又沒人操控時，求生天性促使牠自動尋找最近的真菌或蜜露進食
  if(P.en<.12&&!kb&&!hoverFly&&!pressing&&P.qt<=0){
    let best=null,bd=1e9;
    for(const f of fungi){if(f.s<.2)continue;const p=fpos(f),dd=Math.hypot(P.x-p[0],P.y-p[1],P.z-p[2]);if(dd<bd){bd=dd;best=p}}
    if(best){const dx=best[0]-P.x,dy=best[1]-P.y,dz=best[2]-P.z,dl=Math.hypot(dx,dy,dz)||1,k=.5/dl;
      P.vx+=dx*k;P.vy+=dy*k;P.vz+=dz*k;P.vx*=.96;P.vy*=.96;P.vz*=.96}
  }

  // 沉重與漂浮幅度：缺乏能量時呼吸起伏緩慢低垂
  const bobAmp=P.en<=.05?0.03:(.06+.11*min(1,P.en*2));
  P.x+=P.vx;P.y+=P.vy+sin(frameCount*.05)*bobAmp;P.z+=P.vz;

  // 碰撞限制
  let r=Math.hypot(P.x,P.z);if(r<R+26){P.x*=(R+26)/r;P.z*=(R+26)/r}
  for(const f of farTrees){const dx=P.x-f.x,dz=P.z-f.z,dd=Math.hypot(dx,dz);if(dd<f.r+24){P.x=f.x+dx/dd*(f.r+24);P.z=f.z+dz/dd*(f.r+24)}}
  P.y=constrain(P.y,-1100,-16-groundY(P.x,P.z));P.x=constrain(P.x,-1500,1500);P.z=constrain(P.z,-1500,1500);

  // 朝向姿態
  if(faceCam){
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
  if(P.react>0)P.react--;
  if(P.spin>0)P.spin--;
  if(P.treatT>0)P.treatT--;

  // ★ 核心能量發光邏輯：
  // 當能量 <= 5% 時，核心徹底失去光芒（熄滅歸零）；
  // 當補充能量後，glow 平滑遞增逐漸復甦點亮（不再是生硬的一瞬間暴亮）
  let targetGlow=0;
  if(P.en>.05){
    targetGlow=Math.pow((P.en-.05)/.95,1.25);
  }
  if(P.react>0)targetGlow=min(1,targetGlow+(P.react/72)*.35);
  P.glow=lerp(P.glow,targetGlow,P.glow<targetGlow?.038:.065);
  P.hyd=max(0,P.hyd-.0002);

  // 互利共生：巡診吃真菌，吸取甘露
  if(P.curl<.3){
    for(const f of fungi){const p=fpos(f);
      if(f.s>.06&&Math.hypot(P.x-p[0],P.y-p[1],P.z-p[2])<95){f.s-=.006;f.hl=min(1,f.hl+.01);P.en=min(1,P.en+.0028);
        if(frameCount%2==0)flow.push({x:p[0]+random(-8,8),y:p[1]+random(-8,8),z:p[2],c:[180,240,200]})}
      else f.s=min(1,f.s+.0003);
      if(f.s>.5)f.hl=max(0,f.hl-.0004)}
    for(const d of drops){const p=dpos(d);
      if(d.s>.2&&Math.hypot(P.x-p[0],P.y-p[1],P.z-p[2])<80){d.s-=.012;P.en=min(1,P.en+.004);P.hyd=min(1,P.hyd+.004);
        if(frameCount%2==0)flow.push({x:p[0],y:p[1],z:p[2],c:[255,205,80]})}
      d.s=min(1,d.s+.0012)}
    if(P.y>-34&&abs(P.x-cx(P.z))<hw(P.z)+10){P.hyd=min(1,P.hyd+.01);if(frameCount%10==0)ripples.push({x:P.x,z:P.z,t:0})}
  }

  // ── 4 隻野生獨立 NPC 樹醫（各自守護獨立生態棲位，接近時才觸發專屬本性互動） ──
  for(let i=0;i<companions.length;i++){
    const c=companions[i];
    const dxP=P.x-c.x, dyP=P.y-c.y, dzP=P.z-c.z;
    const distP=Math.hypot(dxP,dyP,dzP)||1;
    const isNear=distP<115; // 進入感應與互動距離

    let tx=c.home.x, ty=c.home.y, tz=c.home.z;

    if(c.role==='sleepy'){
      // 1. 暮暮（樹洞瞌睡者）：平時縮成一團在深處打瞌睡，Pippa 接近才伸懶腰甦醒打招呼
      if(!isNear){
        ty+=sin(frameCount*.03+c.ph)*3;
        c.curl=lerp(c.curl,.75,.04);
        c.glow=lerp(c.glow,.12,.04);
        c.greetT=0;
      }else{
        c.curl=lerp(c.curl,0,.08);
        c.glow=lerp(c.glow,.9,.06);
        c.yaw=lerp(c.yaw,atan2(dxP,dzP),.1);
        if(c.greetT===0){
          c.greetT=70;c.react=65;c.vy-=2.4; // 驚喜伸懶腰彈跳
          for(let k=0;k<14;k++){const a=random(TWO_PI);
            sparks.push({x:c.x,y:c.y,z:c.z,vx:cos(a)*1.2,vy:random(-1.4,.2),vz:sin(a)*1.2,life:1,r:random(1.5,2.8),c:[255,215,110]})}
        }
      }
    }else if(c.role==='forager'){
      // 2. 瀾瀾（溪流採集者）：平時在水面點水掠過，Pippa 接近時螺旋飛舞贈送純淨甘露
      if(!isNear){
        tx+=sin(frameCount*.03+c.ph)*42;
        tz+=cos(frameCount*.025+c.ph)*65;
        ty+=sin(frameCount*.06)*3.5;
        if(frameCount%45===0)ripples.push({x:c.x,z:c.z,t:0});
      }else{
        // 繞著 Pippa 歡快盤旋，並向 Pippa 輸送甘露水氣
        const ang=frameCount*.06+c.ph;
        tx=P.x+cos(ang)*48;
        tz=P.z+sin(ang)*48;
        ty=P.y+sin(frameCount*.08)*12;
        c.react=45;
        if(frameCount%6===0){
          flow.push({x:c.x,y:c.y,z:c.z,c:[120,230,255]});
          P.hyd=min(1,P.hyd+.003);P.en=min(1,P.en+.0015);
        }
      }
    }else if(c.role==='doctor'){
      // 3. 苗苗（真菌實習生）：平時對著樹幹真菌噴灑微光，Pippa 接近時興奮點頭並產生治癒共鳴光束
      if(!isNear){
        ty+=sin(frameCount*.05+c.ph)*5;
        c.yaw=atan2(-c.home.x,-c.home.z); // 面對母樹
        if(frameCount%50===0)sparks.push({x:c.x,y:c.y,z:c.z,vx:random(-.4,.4),vy:random(-.6,.2),vz:random(-.4,.4),life:1,r:random(1.2,2.2),c:[130,255,170]});
      }else{
        c.yaw=lerp(c.yaw,atan2(dxP,dzP),.1);
        c.pit=sin(frameCount*.25)*.3; // 興奮點頭致敬
        c.react=45;
        if(P.treatT>0&&frameCount%4===0){
          flow.push({x:c.x,y:c.y,z:c.z,c:[140,255,185]});
        }
      }
    }else if(c.role==='shy'){
      // 4. 幽幽（鈦金屬環捉迷藏者）：平時慢悠悠繞金屬環，Pippa 接近時躲在金屬環後偷看，停留會吐泡泡捉迷藏
      if(!isNear){
        tx+=cos(frameCount*.028+c.ph)*36;
        tz+=sin(frameCount*.028+c.ph)*36;
        ty+=sin(frameCount*.04)*6;
      }else{
        // 害羞躲在金屬環背側偷看
        const hideX=c.home.x-(dxP/distP)*28;
        const hideZ=c.home.z-(dzP/distP)*28;
        tx=hideX;tz=hideZ;
        c.yaw=lerp(c.yaw,atan2(dxP,dzP),.1);
        c.react=40;
        if(frameCount%45===0){
          for(let k=0;k<4;k++){
            sparks.push({x:c.x,y:c.y,z:c.z,vx:random(-.5,.5),vy:random(-.8,-.1),vz:random(-.5,.5),life:1.2,r:random(1.6,2.8),c:[255,245,190]});
          }
        }
      }
    }

    // 平滑漂浮移動
    const dx=tx-c.x,dy=ty-c.y,dz=tz-c.z;
    const dl=Math.hypot(dx,dy,dz)||1,spd=min(6.5,dl*.06);
    c.vx=lerp(c.vx,(dx/dl)*spd,.065);
    c.vy=lerp(c.vy,(dy/dl)*spd,.065);
    c.vz=lerp(c.vz,(dz/dl)*spd,.065);
    c.x+=c.vx;c.y+=c.vy;c.z+=c.vz;

    // 姿態轉向
    const csp=Math.hypot(c.vx,c.vz);
    if(csp>.15){
      const t=atan2(c.vx,c.vz);
      c.yaw+=angDiff(t,c.yaw)*.09;
      c.roll=lerp(c.roll,constrain(angDiff(t,c.yaw)*1.8,-.4,.4),.08);
    }
    c.pit=lerp(c.pit,constrain(-c.vy*.1,-.4,.4),.08);

    // 地震時全體縮成防禦球
    if(P.qt>0)c.curl=min(1,c.curl+.22);
    else if(c.role!=='sleepy'||isNear)c.curl=max(0,c.curl-.035);

    if(c.react>0)c.react--;
    if(c.role!=='sleepy'){
      const targetG=P.en<=.05?0:(isNear?.8:.48)+(c.react>0?.2:0);
      c.glow=lerp(c.glow,targetG,.05);
    }
  }
}

// ★ 地震警覺天性：抱頭收縮成珍珠防禦球，提防危險
function quake(){
  P.qt=55;shake=12;P.curl=1.0;
  for(let i=0;i<24;i++)leaves.push({x:tx+random(-450,450),y:random(-950,-300),z:tz+random(-450,450),vy:random(.8,1.8),ph:random(6),c:random()<.6?[90,150,70]:[210,170,70]})}

function lights3(){
  const s=sunPos(), m=moonPos();
  const sl=Math.hypot(s.x,s.y,s.z)||1, sx=s.x/sl, sy=s.y/sl, sz=s.z/sl;
  const ml=Math.hypot(m.x,m.y,m.z)||1, mx=m.x/ml, my=m.y/ml, mz=m.z/ml;

  // 三段式大氣散射環境光：白天（林冠漫射）→ 黃昏（暖霞金橘）→ 夜晚（冷藍靜謐）
  ambientLight(mixNight(92,86,16), mixNight(122,66,24), mixNight(112,68,44));

  // 主方向光：白天來自太陽方向，黃昏壓低為地平線斜射，入夜平滑轉為月光方向
  const dirX=lerp(-sx,-mx,night);
  const dirY=lerp(-sy,-my,night);
  const dirZ=lerp(-sz,-mz,night);
  directionalLight(
    mixNight(255,255,145),
    mixNight(238,165,170),
    mixNight(190,105,228),
    dirX, dirY, dirZ
  );

  // 輔助天空散射光（柔和補光）
  directionalLight(mixNight(55,80,24),mixNight(85,68,34),mixNight(105,92,55),.5,.4,.6);

  // 核心自體發光：缺乏能量時徹底熄滅不發光
  if(P.glow>.04){
    const pl=constrain((P.glow-.04)/.96,0,1);
    lightFalloff(1,.0038,.000028);
    pointLight(255*pl,208*pl,(60+195*pl)*pl,P.x,P.y-4,P.z);
  }
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
  drawSun();
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

  // ★ 被古樹板根吞沒的大型鈦金屬科研環遺跡（五千年不朽金屬，帶有工業安裝座與導管）
  push();
  translate(R+28,-18,24);
  rotateZ(.42);rotateY(-.52);
  specularMaterial(210,225,245);shininess(40);
  fill(160,178,198);torus(52,11,16,26); // 大尺寸雙層鈦金屬環
  for(let b=0;b<4;b++){
    push();rotateZ(b*HALF_PI);translate(52,0,0);fill(185,198,215);box(14,18,16);pop();
  }
  // 樹幹裂縫延伸出的古老鋼纜束
  for(let c=0;c<3;c++){
    push();translate(-16+c*14,32,-8);rotateX(1.15);fill(85,95,108);cylinder(4.5,65,8,1);pop();
  }
  // 苔蘚半附著包裹
  fill(45,105,50,220);translate(6,-8,4);scale(1.2,.6,1.2);sphere(36,12,10);
  pop();

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

  // ★ 人工海玻璃與人造陶瓷殘留物（醒目的大型凹槽酒瓶底、磨砂卵石與陶片）
  for(const g of glass){
    push();translate(g.x,-.6,g.z);rotateY(g.rot);scale(1,g.th,1);
    if(g.landmark){
      // 地標級大型凹槽酒瓶底
      fill(g.c[0],g.c[1],g.c[2],235);cylinder(g.r,9,14,1,true,true);
      translate(0,-5,0);fill(g.c[0]*.75,g.c[1]*.75,g.c[2]*.75,245);cylinder(g.r*.6,2,10,1,true,true);
    }else if(g.kind===1){
      fill(g.c[0],g.c[1],g.c[2],230);cylinder(g.r,5,10,1,true,true);
    }else if(g.kind===2){
      fill(g.c[0],g.c[1],g.c[2],245);box(g.r*1.5,3.8,g.r*1.2);
    }else{
      fill(g.c[0],g.c[1],g.c[2],235);sphere(g.r,10,8);
    }
    pop();
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
  const sf=sunPos(),mf=1-night;
  if(!BARE&&mf>.01&&sf.y<50){
    const sunH=constrain(-sf.y/300,0,1);
    const rayR=mixNight(255,255,160),rayG=mixNight(235,170,190),rayB=mixNight(160,85,255);
    for(let k=0;k<3;k++){
      push();translate(sf.x,-2.8,sf.z);rotateX(HALF_PI);
      fill(rayR,rayG,rayB,(18+k*8)*mf*sunH);
      ellipse(0,0,150-k*34,115-k*24);pop();
    }
    const sh=[[sf.x,sf.z,1],[-260,-380,.5],[-420,260,.6],[160,-520,.5],[-120,520,.45]];
    for(const s of sh){
      push();translate(s[0],-550,s[1]);rotateY(atan2(ex-s[0],ez-s[1]));rotateZ(.14);
      for(let k=0;k<2;k++){fill(rayR,rayG,rayB,16*s[2]*mf*sunH);plane(56+k*74,1200)}pop();
    }
  }
  // ── 夜裡才出現的溪面月光與海玻璃反光 ────────────────────────────
  if(night>.01){
    const m=moonPos();
    // 月光打在溪面上：沿著水流方向的一條冷色反光帶，會微微晃動
    const mz=constrain(P.z+m.z*.25,-1500,1500),wob=1+.06*sin(frameCount*.02);
    for(let k=0;k<3;k++){push();translate(cx(mz),-2.1,mz);rotateX(HALF_PI);
      fill(180,212,255,(10-k*2.5)*night);ellipse(0,0,hw(mz)*(1.1+k*.7)*wob,1500);pop()}
    // 海玻璃與陶瓷的反光：月亮在背後、視線正看著它時折射出閃耀高光
    for(const g of glass){
      const vx=ex-g.x,vy=ey+.8,vz=ez-g.z,vl=Math.hypot(vx,vy,vz)||1;
      const gx=m.x-g.x,gy=m.y+.8,gz=m.z-g.z,gl=Math.hypot(gx,gy,gz)||1;
      const sp=Math.pow(Math.max(0,(vx*gx+vy*gy+vz*gz)/(vl*gl)),6);
      push();translate(g.x,-.8,g.z);
      fill(g.c[0],g.c[1],g.c[2],14*night);sphere(g.r,8,6);
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
  for(let i=0;i<companions.length;i++)drawCompanion(companions[i],i);
  workMs=workMs*.85+(millis()-t0)*.15;   // 平滑後的「每幀實際運算時間」
}

// Pippa: a drifting cluster of off-white pearl bubbles with a warm light glowing from its centre
const LOBES=[[0,0,-11,12],[-10,-1,-9,9],[10,0,-9,9],[-5,15,-5,8],[8,14,-5,7],[-17,6,-4,8],[16,7,-3,8.5],[-15,-7,-3,9],[14,-8,-4,9.5],[0,-16,-4,9],[0,0,0,13.5]];
const TINT=[[248,245,234],[243,242,243],[252,246,236],[245,242,244]];   // 米白色（四種只差一點點的白）
const STR=[[-11,-5,-9],[11,-5,-9],[-9,8,-9],[9,8,-9]];
const strand=(i,u,T,spd)=>{
  const t=STR[i];
  // 缺乏能量時尾鬚自然下垂（重力垂墜）
  const sag=(1-constrain(P.en*2.5,0,1))*u*u*24;
  return [
    t[0]*(1+u*1.5)+sin(T*.1+u*5+i*1.7)*u*7*(.5+spd)*(0.4+0.6*constrain(P.en*2,0,1)),
    t[1]*(1+u*1.1)+cos(T*.08+u*4+i)*u*6+u*u*10+sag,
    t[2]-u*(1-P.curl*.8)*50
  ];
};

function drawPippa(){
  const c=P.curl,spd=min(Math.hypot(P.vx,P.vy,P.vz)/6,1),T=frameCount,pale=(1-P.hyd)*.5;
  const isExhausted=P.en<.12;

  // 快沒能量時（< 25%），微弱的餘燼會一閃一閃喘息；若能量近乎耗盡（<= 5%）則直接熄滅
  const flick=P.en<=.05?0:P.en<.25?constrain(.35+.65*sin(T*.35),0,1):1;
  const g=constrain(P.glow*flick,0,1);
  const happy=P.react>0,bounce=happy?1+.22*sin((72-P.react)*.45)*(P.react/72):1;

  push();translate(P.x,P.y,P.z);rotateY(P.yaw);rotateX(P.pit);rotateZ(P.roll+(P.spin>0?(1-P.spin/48)*TWO_PI:0));

  // 活力縮放：極度虛弱時呼吸變緩慢沉重
  const breatheFreq=isExhausted?.025:.05;
  const breatheAmp=isExhausted?.018:.04;
  scale(
    bounce*(.9+.1*P.hyd)*(1-.2*c)*(1+.05*sin(T*.9)*c),
    bounce*(.9+.1*P.hyd)*(1-.2*c)*(1+breatheAmp*sin(T*breatheFreq)),
    bounce*(1-.2*c)*(1+.06*spd)
  );

  // ★ 尾巴觸鬚：缺乏能量時失去自發光，末梢受重力下垂
  for(let i=0;i<4;i++){
    for(let k=1;k<5;k++){
      push();translate(...strand(i,k/5,T,spd));
      fill(246,244,236,242);sphere(.75,5,4);pop();
    }
    const e=strand(i,1,T,spd);
    push();translate(...e);
    if(g>.05){
      emissiveMaterial(255*g,215*g,120*g);
      fill(255,235,170);
    }else{
      fill(128,138,144,185); // 熄滅時的灰暗小珠
    }
    sphere(2.8,10,8);
    pop();

    if(g>.12){
      push();translate(...e);fill(255,230,150,50*g);sphere(6+1.5*sin(T*.07+i),10,8);pop();
    }
  }

  // 外層：米白色的雲霧狀身體（半透明、沒有玻璃高光）
  drawingContext.depthMask(false);
  LOBES.forEach((l,i)=>{
    const t=TINT[i%4],k=i==10?.8:1,r=l[3]*(1+.05*sin(T*.05+i*1.3)),m=1-c*.5;
    push();translate(l[0]*m+sin(T*.03+i)*.8,l[1]*m+cos(T*.025+i*2)*.8,l[2]*m);
    fill(lerp(lerp(t[0],252,pale),255,night*.5),lerp(lerp(t[1],252,pale),240,night*.5),lerp(lerp(t[2],252,pale),206,night*.5),153+32*night);
    sphere(r,18,13);
    pop();
  });

  // 夜裡才出現的月光反光：很淡的一層冷白光落在身體上緣（白天完全看不到）
  if(night>.25){
    blendMode(ADD);
    push();translate(-4,15,-2);scale(1,.5,.6);fill(170,200,255,26*night);sphere(7.2,12,10);pop();
    push();translate(9,12,3);scale(.9,.45,.6);fill(150,185,255,17*night);sphere(5.6,10,8);pop();
    blendMode(BLEND);
  }

  // ★ 樹醫巡診波紋：進行治癒時身體散發翠綠金環
  if(P.treatT>0){
    blendMode(ADD);
    const trP=1-P.treatT/48;
    push();rotateX(HALF_PI);
    stroke(140,255,190,160*(1-trP));strokeWeight(2.5);noFill();
    circle(0,0,22+trP*65);
    pop();
    noStroke();
    blendMode(BLEND);
  }

  // ── 生動表情系統：眼神高光、視線微動、多種生動情境微表情 ──
  const isShocked=P.qt>0;
  const isHealing=P.treatT>0;
  const blinkCycle=T%240;
  const blink=(blinkCycle<7)||(blinkCycle>15&&blinkCycle<21&&(T%480<240));

  // 視線眼神微動：隨移動速度好奇轉動視線
  const lookX=constrain(P.vx*.12,-.6,.6);
  const lookY=constrain(P.vy*.12,-.5,.5);

  // 1. 雙眼與眼神光
  for(const s of[-1,1]){
    push();
    translate(s*4.4+lookX*.3,-1+lookY*.3,11.9);

    if(happy){
      // 開心微笑月牙弧形眼（^ ^）
      rotateZ(s*-.22);
      scale(1.35,.28,1);
      fill(36,40,50);sphere(1.3,8,6);
    }else if(isShocked){
      // 受到驚嚇時緊閉的防禦防震眼（> <）
      rotateZ(s*.35);
      scale(1.25,.18,1);
      fill(36,40,50);sphere(1.2,8,6);
    }else if(P.en<=.05){
      // 徹底耗盡無力時：下垂閉闔細線
      rotateZ(s*.15);
      scale(1.15,.1,1);
      fill(45,50,58);sphere(1.15,6,4);
    }else if(blink||P.en<.25){
      // 眨眼或疲憊半閉眼
      scale(1.25,P.en<.25?.38:.18,1);
      fill(36,40,50);sphere(1.25,8,6);
    }else{
      // 正常悠游：圓潤杏眼 + 晶瑩水潤雙高光（賦予靈魂生動感）
      scale(1.05,1.2,1);
      fill(32,36,46);sphere(1.28,10,8);

      if(P.en>.08){
        // 主高光（右上角水潤大光點；治癒時映照出柔和翡翠綠）
        push();
        translate(s*.38+lookX*.4,-.42+lookY*.4,.98);
        if(isHealing)fill(160,255,210,240);else fill(255,255,255,245);
        sphere(.42,6,5);pop();
        // 副高光（左下角晶透微光點）
        push();
        translate(-s*.25+lookX*.2,.38+lookY*.2,.9);
        fill(255,255,255,185);sphere(.24,5,4);pop();
      }
    }
    pop();

    // 2. 靈動腮紅：反映心跳脈動與情緒擴散
    push();
    translate(s*8.4,3.2,8.8);
    const blushScale=happy?(1.4+.12*sin(T*.3)):isShocked?.78:(1+.04*sin(T*.06));
    const blushAlpha=isShocked?110:happy?245:(175+40*constrain(P.en*2,0,1));
    scale(blushScale,.65*blushScale,.35);
    fill(255,happy?135:155,175,blushAlpha);
    sphere(3,8,6);
    pop();
  }

  // 3. 嘴巴表情動態
  push();
  translate(0,4.2+(isShocked?-.4:0),12.8);
  if(happy){
    // 開心小笑嘴（微開的小月牙）
    scale(1.8,1.35,.45);
    fill(235,105,130);sphere(1.15,8,6);
  }else if(isShocked){
    // 受到驚嚇時的小圓「O」型喘息
    scale(1.1,1.25,.5);
    fill(195,95,115);sphere(.9,8,6);
  }else if(P.treatT>0){
    // 樹醫治癒時專注吸吮的小嘴律動
    const sip=1+.25*sin(T*.4);
    scale(1.4*sip,.8*sip,.4);
    fill(225,120,145);sphere(.95,6,5);
  }else if(P.en<=.05){
    // 能量耗盡時下垂微癟的小嘴角
    scale(1.3,.35,.3);
    fill(180,110,125);sphere(.85,6,5);
  }else{
    // 平時微嘟呼吸的放鬆小嘴
    const breath=1+.05*sin(T*.08);
    scale(1.5*breath,.55*breath,.4);
    fill(220,120,140);sphere(1,6,5);
  }
  pop();

  // ★ 身體最正中心的晶體：固定在 (0,0,0)
  // 缺乏能量時徹底冷寂熄滅（暗灰石英）；補充能量後由中心火星逐步擴散點亮
  const gr=1+.06*sin(T*(isExhausted?.025:.07));
  push();
  if(g<=.04){
    // 徹底熄滅狀態：冷寂、灰石英無光核
    fill(108,118,125,95);
    sphere(0.18*gr,6,4);
  }else{
    // 甦醒狀態：微弱時偏深紅橘餘燼，漸漸轉為明亮琥珀金光
    const emberR=lerp(210,255,g);
    const emberG=lerp(80,206,g);
    const emberB=lerp(40,110,g);
    emissiveMaterial(emberR*g,emberG*g,emberB*g);
    fill(lerp(120,255,g),lerp(130,232,g),lerp(140,186,g),38);
    sphere(0.15*gr,6,4);

    // 四圈光暈依能量門檻「由內而外」層層甦醒綻放
    blendMode(ADD);
    if(g>.08){
      const l1=constrain((g-.08)/.35,0,1);
      fill(255,222,134,175*l1);sphere(2.0*gr*l1,8,6);
    }
    if(g>.25){
      const l2=constrain((g-.25)/.35,0,1);
      fill(255,204,96,95*l2);sphere(3.6*gr*l2,10,8);
    }
    if(g>.45){
      const l3=constrain((g-.45)/.35,0,1);
      fill(255,186,66,48*l3);sphere(5.8*gr*l3,10,8);
    }
    if(g>.70){
      const l4=constrain((g-.70)/.30,0,1);
      fill(255,170,48,20*l4);sphere(8.6*gr*l4,12,10);
    }
    blendMode(BLEND);
  }
  pop();
  drawingContext.depthMask(true);
  pop();
}

// ── 繪製實習樹醫同伴（族群成員） ────────────────────────────
function drawCompanion(c, idx){
  const spd=min(Math.hypot(c.vx,c.vy,c.vz)/5,1), T=frameCount;
  const isShocked=P.qt>0, happy=c.react>0;
  const g=constrain(c.glow,0,1);
  push();
  translate(c.x,c.y,c.z);
  rotateY(c.yaw);rotateX(c.pit);rotateZ(c.roll);
  scale(c.s*(1-.2*c.curl), c.s*(1-.2*c.curl)*(1+.04*sin(T*.07+c.ph)), c.s*(1-.2*c.curl)*(1+.05*spd));

  // 尾部觸鬚
  for(let i=0;i<4;i++){
    const t=STR[i];
    for(let k=1;k<4;k++){
      push();
      translate(t[0]*(1+k*.4)+sin(T*.1+k*3+i)*k*2, t[1]*(1+k*.3)+cos(T*.09+k*2)*k*2+k*k*3, t[2]-k*11);
      fill(246,244,236,235);sphere(.6,5,4);pop();
    }
    push();
    translate(t[0]*2.2+sin(T*.12+i)*6, t[1]*1.8+cos(T*.1+i)*5+22, t[2]-36);
    emissiveMaterial(c.c[0]*g,c.c[1]*g,c.c[2]*g);
    fill(255,245,215);sphere(2,8,6);
    pop();
  }

  // 身體雲霧球
  drawingContext.depthMask(false);
  LOBES.forEach((l,i)=>{
    const t=TINT[i%4], r=l[3]*.95*(1+.04*sin(T*.05+i)), m=1-c.curl*.5;
    push();translate(l[0]*m,l[1]*m,l[2]*m);
    fill(t[0],t[1],t[2],145+25*night);sphere(r,14,10);pop();
  });

  // 臉部表情：水潤高光
  const blink=(T+idx*40)%210<6;
  for(const s of[-1,1]){
    push();translate(s*4.2,-.8,11.5);
    if(happy)scale(1.3,.28,1);
    else if(isShocked)scale(1.2,.18,1);
    else if(blink)scale(1.2,.2,1);
    else scale(1.05,1.18,1);
    fill(36,40,50);sphere(1.15,8,6);
    if(!isShocked&&!blink){
      push();translate(s*.32,-.38,.88);fill(255,255,255,240);sphere(.36,5,4);pop();
    }
    pop();
    // 腮紅
    push();translate(s*7.8,3,8.5);scale(happy?1.3:1,.65,.35);fill(255,160,180,happy?240:170);sphere(2.6,8,6);pop();
  }
  // 小嘴
  push();translate(0,3.8,12.2);scale(1.3,happy?1.2:.6,.4);fill(225,120,140);sphere(.85,6,5);pop();

  // 各自專屬特徵的晶核
  const gr=1+.06*sin(T*.08+c.ph);
  push();
  emissiveMaterial(c.c[0]*g,c.c[1]*g,c.c[2]*g);
  fill(c.c[0],c.c[1],c.c[2],42);
  sphere(0.16*gr,6,4);
  if(g>.1){
    blendMode(ADD);
    fill(c.c[0],c.c[1],c.c[2],150*g);sphere(1.8*gr,8,6);
    fill(c.c[0],c.c[1],c.c[2],70*g); sphere(3.4*gr,10,8);
    blendMode(BLEND);
  }
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
