const R=120,H0=200,OUT=240,RS=.62;   // RS＝渲染縮放：用較小的解析度算，再由 CSS 放大，最省效能
const BARE=/bare/.test(location.search);   // 網址加 ?bare 可只留場地主體，用來抓效能兇手
const fpsEl=document.getElementById('fps');
const faceBtn=document.getElementById('faceBtn');
let faceCam=false,uiClick=false;   // faceCam＝轉為正面直視鏡頭
function toggleFace(){faceCam=!faceCam;
  if(faceBtn){faceBtn.classList.toggle('on',faceCam);faceBtn.textContent=faceCam?'取消直視':'正面看我'}}
if(faceBtn)faceBtn.addEventListener('mousedown',()=>{uiClick=true});
if(faceBtn)faceBtn.addEventListener('click',()=>{toggleFace();uiClick=false});
let barkTex,groundTex,yaw=.7,pitch=.2,camD=340,tx=0,ty=-120,tz=0,ex=0,ey=0,ez=0,shake=0,moved=0,pressF=0,hoverFly=false,pressing=false;
const finAngs=[],gaps=[],mounds=[],shrooms=[],farTrees=[],spores=[],leaves=[],fungi=[],drops=[],flow=[],ripples=[],sparks=[];
const HOME={x:260,y:-130,z:110};   // 牠的棲息點：沒輸入時會慢慢飄回這裡停住
const P={x:260,y:-130,z:110,vx:0,vy:0,vz:0,yaw:3.14159,pit:0,roll:0,hyd:1,glow:.6,curl:0,qt:0,react:0};
const cx=z=>420+60*Math.sin(z*.004), hw=z=>88+14*Math.sin(z*.011);
const fh=t=>H0*Math.pow(1-t,2);
function angDiff(a,b){let d=(a-b)%TWO_PI;if(d>PI)d-=TWO_PI;if(d<-PI)d+=TWO_PI;return d}
function groundY(x,z){const r=Math.hypot(x,z),th=atan2(z,x);let m=0;
  if(r>R-10&&r<OUT){const t=(r-(R-10))/(OUT-R+10);for(const a of finAngs){const d=angDiff(th,a);if(abs(d)<1.2&&abs(r*sin(d))<22)m=max(m,fh(t))}}
  return m}
function sunPos(){const a=.75+.5*sin(frameCount*.0035);return{x:cos(a)*300,z:sin(a)*300}}
const fpos=f=>[cos(f.a)*(R+4),-f.h,sin(f.a)*(R+4)];
const dpos=d=>[cos(d.a)*(R+3),-d.h,sin(d.a)*(R+3)];

function setup(){
  createCanvas(innerWidth*RS,innerHeight*RS,WEBGL);pixelDensity(1);
  randomSeed(11);noiseSeed(5);
  for(let i=0;i<8;i++)if(i!==1)finAngs.push(i*PI/4);
  for(let k=2;k<8;k++)gaps.push((k+.5)*PI/4);gaps.push(PI/4);
  barkTex=makeBark();groundTex=makeGround();
  const ok=(x,z)=>abs(x-cx(z))>150;
  while(mounds.length<18){const x=random(-1200,1200),z=random(-1200,1200);if(Math.hypot(x,z)>300&&ok(x,z))mounds.push({x,z,r:random(22,70),c:[random(40,70),random(95,140),random(55,80)]})}
  while(shrooms.length<14){const x=random(-900,900),z=random(-900,900);if(Math.hypot(x,z)>270&&ok(x,z))shrooms.push({x,z,s:random(3,7)})}
  while(farTrees.length<8){const a=random(TWO_PI),d=random(650,1650),x=cos(a)*d,z=sin(a)*d;if(x>280&&x<580)continue;
    farTrees.push({x,z,r:random(90,170),f:constrain(d/1750,0,1)})}
  for(let i=0;i<10;i++)fungi.push({a:random(gaps)+random(-.08,.08),h:random(55,420),s:1,hl:0});
  for(let i=0;i<9;i++)drops.push({a:random(gaps)+random(-.08,.08),h:random(60,420),s:1,ph:random(6)});
  for(let i=0;i<50;i++)spores.push({x:random(-800,800),y:random(-520,-10),z:random(-800,800),s:random(2,5),ph:random(6)});
  const w0=P;tx=w0.x;ty=w0.y;tz=w0.z;
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

// 遠方的老樹：沿用主體樹的做法——貼圖樹幹、根裙、板根鰭，但大幅降低細節以維持流暢
function drawFarTree(f){
  const s=f.r/R,h0=H0*s,o=f.r+(OUT-R)*s,fin=3,D=4,len=(o-f.r+12*s)/D;
  const fog=1-f.f;
  push();translate(f.x,0,f.z);
  push();translate(0,-900,0);texture(barkTex);cylinder(f.r,1800,8,1,false,false);pop();
  push();translate(0,-30*s,0);texture(barkTex);cylinder(f.r+16*s,60*s,8,1,false,false);pop();
  const a0=f.x*.013+f.z*.007;            // 每棵樹的板根角度不同
  for(let k=0;k<fin;k++){push();rotateY(a0+k*TWO_PI/fin);
    for(let i=0;i<D;i++){const t=(i+.5)/D,hh=h0*Math.pow(1-t,2);   // 外側偏綠，代替綠頂那一顆方塊
      push();translate(f.r-12*s+t*(o-f.r+12*s),-hh/2,0);
      const c=lerpColor(color(84,60,44),color(60,120,58),t*.9);
      fill(red(c)*fog,green(c)*fog,blue(c)*fog);box(len+.5,hh,34*s);pop()}
    pop()}
  pop();
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
function pippaHit(){
  const f=createVector(tx-ex,ty-ey,tz-ez).normalize(),up=createVector(0,1,0);
  const r=p5.Vector.cross(f,up).normalize(),d=p5.Vector.cross(r,f),th=tan(PI/6);
  const nx=(mouseX/width-.5)*2,ny=(mouseY/height-.5)*2;
  const ray=f.copy().add(r.mult(nx*th*width/height)).add(d.mult(ny*th)).normalize();
  const ox=P.x-ex,oy=P.y-ey,oz=P.z-ez,t=ox*ray.x+oy*ray.y+oz*ray.z;
  if(t<=0)return false;                       // 在鏡頭後面
  return Math.hypot(P.x-(ex+ray.x*t),P.y-(ey+ray.y*t),P.z-(ez+ray.z*t))<28;
}

// 被摸到的反應：核心閃一下、身體彈一下、噴出一圈彩色小光點
function reactToPet(){
  P.react=72;P.glow=1;
  for(let i=0;i<22;i++){const a=random(TWO_PI),s=random(.6,1.8);
    sparks.push({x:P.x+random(-6,6),y:P.y+random(-6,6),z:P.z+random(-6,6),
      vx:cos(a)*s,vy:random(-1.5,-.2),vz:sin(a)*s,life:1,r:random(1.2,2.6),
      c:random()<.45?[255,140,180]:random()<.5?[255,225,140]:[190,250,235]})}
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
  if(P.qt>0){P.qt--;P.curl=min(1,P.curl+.2);P.vx*=.88;P.vy*=.88;P.vz*=.88}
  else{
    P.curl=max(0,P.curl-.05);
    if(kb){
      const fl=Math.hypot(tx-ex,tz-ez)||1,fx=(tx-ex)/fl,fz=(tz-ez)/fl;
      P.vx+=(fx*iz-fz*ix)*.9;P.vz+=(fz*iz+fx*ix)*.9;P.vy+=iy*.8;
      P.vx*=.96;P.vy*=.96;P.vz*=.96;
      const sp=Math.hypot(P.vx,P.vy,P.vz),mx=9;if(sp>mx){P.vx*=mx/sp;P.vy*=mx/sp;P.vz*=mx/sp}
    }else{
      let boost=false,g=null;
      if(hoverFly||pressing){const m=mouseTarget();g=[m[0],m[1],m[2]];boost=m[3]}
      if(g){
        let ax=g[0]-P.x,ay=g[1]-P.y,az=g[2]-P.z;const d=Math.hypot(ax,ay,az)||1,k=min(.5,d*.006)/d;
        P.vx+=ax*k;P.vy+=ay*k;P.vz+=az*k;
        P.vx*=.93;P.vy*=.93;P.vz*=.93;
        const sp=Math.hypot(P.vx,P.vy,P.vz),mx=boost?11:7.5;if(sp>mx){P.vx*=mx/sp;P.vy*=mx/sp;P.vz*=mx/sp}
      }else{
        // 沒有輸入：慢慢減速停在原地（不會自己飄回去），只留呼吸般的浮動
        P.vx*=.9;P.vy*=.9;P.vz*=.9;
      }
    }
  }
  P.x+=P.vx;P.y+=P.vy+sin(frameCount*.07)*.15;P.z+=P.vz;
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
  P.glow=max(.5,P.glow-.003);P.hyd=max(0,P.hyd-.0002);
  // symbiosis: she drinks harmful fungus (and spreads healing moss), the tree offers nectar
  if(P.curl<.3){
    for(const f of fungi){const p=fpos(f);
      if(f.s>.06&&Math.hypot(P.x-p[0],P.y-p[1],P.z-p[2])<95){f.s-=.006;f.hl=min(1,f.hl+.01);P.glow=min(1,P.glow+.012);
        if(frameCount%2==0)flow.push({x:p[0]+random(-8,8),y:p[1]+random(-8,8),z:p[2],c:[200,140,230]})}
      else f.s=min(1,f.s+.0003);
      if(f.s>.5)f.hl=max(0,f.hl-.0004)}
    for(const d of drops){const p=dpos(d);
      if(d.s>.2&&Math.hypot(P.x-p[0],P.y-p[1],P.z-p[2])<80){d.s-=.012;P.glow=min(1,P.glow+.01);P.hyd=min(1,P.hyd+.004);
        if(frameCount%2==0)flow.push({x:p[0],y:p[1],z:p[2],c:[255,205,80]})}
      d.s=min(1,d.s+.0012)}
    if(P.y>-34&&abs(P.x-cx(P.z))<hw(P.z)+10){P.hyd=min(1,P.hyd+.01);if(frameCount%10==0)ripples.push({x:P.x,z:P.z,t:0})}
  }
}

function quake(){
  P.qt=150;shake=16;
  for(let i=0;i<40;i++)leaves.push({x:tx+random(-450,450),y:random(-950,-300),z:tz+random(-450,450),vy:random(.8,1.8),ph:random(6),c:random()<.6?[90,150,70]:[210,170,70]})}

function lights3(){
  ambientLight(95,120,110);
  directionalLight(255,235,190,-.3,.8,-.4);
  directionalLight(60,90,110,.5,.3,.6);
  lightFalloff(1,.004,.00003);pointLight(255,190,70+80*P.glow,P.x,P.y-6,P.z);
}

function draw(){
  noStroke();
  ex=tx+camD*cos(pitch)*sin(yaw);ey=min(ty-camD*sin(pitch),-12);ez=tz+camD*cos(pitch)*cos(yaw);
  update();
  tx=lerp(tx,P.x,.07);ty=lerp(ty,P.y,.07);tz=lerp(tz,P.z,.07);
  if(P.qt>0)shake=max(shake,P.qt/150*10);shake*=.93;
  background(22,44,40);
  if(frameCount%15===0&&fpsEl)fpsEl.textContent=Math.round(frameRate())+' fps';
  perspective(PI/3,width/height,5,12000);
  camera(ex+random(-shake,shake),ey+random(-shake,shake),ez,tx,ty,tz,0,1,0);
  lights3();

  if(!BARE)for(const f of farTrees)if(Math.hypot(f.x-P.x,f.z-P.z)<1400)drawFarTree(f);   // 太遠的不畫，省效能
  push();rotateX(HALF_PI);texture(groundTex);plane(4000,4000);pop();
  if(!BARE)for(const m of mounds){push();translate(m.x,0,m.z);scale(1,.35,1);fill(m.c[0],m.c[1],m.c[2]);sphere(m.r,10,8);pop()}
  push();translate(0,-1100,0);texture(barkTex);cylinder(R,2200,40,1,false,false);pop();
  push();translate(0,-30,0);texture(barkTex);cylinder(R+16,60,40,1,false,false);pop();
  const N=8,len=(OUT-R+12)/N;
  for(const a of finAngs){push();rotateY(-a);
    for(let i=0;i<N;i++){const t=(i+.5)/N,h=fh(t);push();translate(R-12+t*(OUT-R+12),-h/2,0);
      fill(lerpColor(color(84,60,44),color(60,120,58),t*.9));box(len+.5,h,34);pop()}
    pop()}
  const dx=cos(PI/4),dz=sin(PI/4);
  push();translate(dx*(R+52),-2,dz*(R+52));scale(1,.2,1);fill(58,132,70);sphere(58,14,10);pop();
  const bump=[[0,0,1],[-9,5,.7],[8,6,.8],[-5,-8,.6],[7,-7,.7],[1,11,.5]];
  for(const f of fungi){push();translate(cos(f.a)*(R+1),-f.h,sin(f.a)*(R+1));rotateY(HALF_PI-f.a);
    for(const b of bump){
      if(f.s>.03){push();translate(b[0]*f.s,b[1]*f.s,0);scale(1,1,.45);fill(185,150,200);sphere(7*b[2]*f.s,10,8);pop();
        push();translate(b[0]*f.s,b[1]*f.s,3.4*b[2]*f.s);fill(235,150,90);sphere(1.6*f.s,6,5);pop()}
      if(f.hl>.02){push();translate(b[0]*1.2,b[1]*1.2,2);fill(120,238,160);sphere(3.6*b[2]*f.hl*(1+.12*sin(frameCount*.06+b[0])),8,6);pop()}}
    pop()}
  if(!BARE)for(const s of shrooms){push();translate(s.x,0,s.z);fill(200,215,205);translate(0,-s.s*.9,0);cylinder(s.s*.3,s.s*1.8,6,1);
    translate(0,-s.s*.9,0);scale(1,.6,1);fill(120,230,210);sphere(s.s,8,6);pop()}

  noLights();
  fill(38,108,118,175);beginShape(TRIANGLE_STRIP);
  for(let z=-1900;z<=1900;z+=60){const c=cx(z),h=hw(z);vertex(c-h,-1.5,z);vertex(c+h,-1.5,z)}endShape();
  fill(120,210,210,55);beginShape(TRIANGLE_STRIP);
  for(let z=-1900;z<=1900;z+=60){const c=cx(z),h=hw(z)*.45;vertex(c-h,-2,z);vertex(c+h,-2,z)}endShape();
  for(let k=0;k<34;k++){const z=((k*131+frameCount*1.3)%3800)-1900,x=cx(z)+((k*37)%100-50)*1.2;
    push();translate(x,-2.6,z);rotateX(HALF_PI);fill(225,255,255,75);ellipse(0,0,6,26);pop()}
  for(const d of drops){push();translate(...dpos(d));
    const s=d.s*(1+.06*sin(frameCount*.05+d.ph));fill(255,200,70,215);sphere(4.5*s+.01,10,8);
    translate(-1.2,-1.4,3);fill(255,255,255,200);sphere(1.2*s+.01,6,5);pop()}
  drawingContext.depthMask(false);blendMode(ADD);
  const sf=sunPos();
  if(!BARE)for(let k=0;k<6;k++){push();translate(sf.x,-2.8,sf.z);rotateX(HALF_PI);fill(255,230,150,14+k*5);ellipse(0,0,150-k*20,115-k*15);pop()}
  const sh=[[sf.x,sf.z,1],[-260,-380,.5],[-420,260,.6],[160,-520,.5],[-120,520,.45]];
  if(!BARE)for(const s of sh){push();translate(s[0],-550,s[1]);rotateY(atan2(ex-s[0],ez-s[1]));rotateZ(.14);
    for(let k=0;k<5;k++){fill(255,235,160,9*s[2]);plane(40+k*34,1200)}pop()}
  for(const s of shrooms){push();translate(s.x,-1.5,s.z);rotateX(HALF_PI);fill(110,230,210,16);circle(0,0,s.s*9);pop()}
  for(const f of fungi)if(f.hl>.05){push();translate(...fpos(f));fill(150,255,170,16*f.hl);sphere(20+4*sin(frameCount*.05),10,8);pop()}
  // 被摸到時噴出的小光點
  for(let i=sparks.length-1;i>=0;i--){const s=sparks[i];
    s.x+=s.vx;s.y+=s.vy;s.z+=s.vz;s.vy+=.012;s.vx*=.97;s.vz*=.97;s.life-=.014;
    if(s.life<=0){sparks.splice(i,1);continue}
    push();translate(s.x,s.y,s.z);fill(s.c[0],s.c[1],s.c[2],235*s.life);sphere(s.r*s.life,6,5);pop()}
  push();stroke(255,238,170,170);
  if(!BARE)for(const p of spores){p.x+=sin(frameCount*.01+p.ph)*.25;p.y+=cos(frameCount*.013+p.ph)*.15-.03;p.z+=cos(frameCount*.009+p.ph)*.25;
    if(p.y<-540)p.y=-10;if(p.y>-6)p.y=-520;strokeWeight(p.s*(1+.4*sin(frameCount*.05+p.ph)));point(p.x,p.y,p.z)}
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
}

// Pippa: a drifting cluster of translucent jade-pearl bubbles with a golden core
const LOBES=[[0,0,-11,12],[-10,-1,-9,9],[10,0,-9,9],[-5,15,-5,8],[8,14,-5,7],[-17,6,-4,8],[16,7,-3,8.5],[-15,-7,-3,9],[14,-8,-4,9.5],[0,-16,-4,9],[0,0,0,13.5]];
const TINT=[[200,248,228],[214,214,248],[250,222,232],[255,240,200]];
const STR=[[-11,-5,-9],[11,-5,-9],[-9,8,-9],[9,8,-9]];
const strand=(i,u,T,spd)=>{const t=STR[i];return[t[0]*(1+u*1.5)+sin(T*.1+u*5+i*1.7)*u*7*(.5+spd),t[1]*(1+u*1.1)+cos(T*.08+u*4+i)*u*6+u*u*10,t[2]-u*(1-P.curl*.8)*50]};
function drawPippa(){
  const c=P.curl,spd=min(Math.hypot(P.vx,P.vy,P.vz)/6,1),T=frameCount,g=P.glow,pale=(1-P.hyd)*.5;
  const happy=P.react>0,bounce=happy?1+.22*sin((72-P.react)*.45)*(P.react/72):1;   // 被摸到時彈一下
  push();translate(P.x,P.y,P.z);rotateY(P.yaw);rotateX(P.pit);rotateZ(P.roll);
  scale(bounce*(.9+.1*P.hyd)*(1-.2*c)*(1+.05*sin(T*.9)*c),bounce*(.9+.1*P.hyd)*(1-.2*c)*(1+.04*sin(T*.05)),bounce*(1-.2*c)*(1+.06*spd));
  // trailing tendrils ending in warm glowing orbs
  for(let i=0;i<4;i++){
    for(let k=1;k<7;k++){push();translate(...strand(i,k/7,T,spd));fill(235,245,255,170);sphere(.7,5,4);pop()}
    const e=strand(i,1,T,spd);
    push();translate(...e);emissiveMaterial(255*g,215*g,120*g);fill(255,235,170);sphere(2.8,10,8);pop();
    push();translate(...e);fill(255,230,150,50);sphere(6+1.5*sin(T*.07+i),10,8);pop()}
  // golden energy core + tiny glowing cells
  const pul=.6+.4*sin(T*.07);
  push();translate(0,1,1);emissiveMaterial(255*g,190*g,50);fill(255,205,70);sphere(4.4+1.1*pul*g,12,10);pop();
  push();translate(0,1,1);fill(255,210,90,55);sphere(9+3*g*pul,12,10);pop();
  LOBES.forEach((l,i)=>{for(let q=0;q<2;q++){const a=i*2.3+q*3.1,b=i*1.1+q*2;
    push();translate(l[0]+cos(a)*l[3]*.6,l[1]+sin(b)*l[3]*.6,l[2]+sin(a)*l[3]*.5);
    emissiveMaterial(255*g,225*g,140*g);fill(255,235,160);sphere(.9+.3*sin(T*.08+i+q),6,5);pop()}});
  // face
  const blink=T%220<6;
  for(const s of[-1,1]){push();translate(s*5.6,-1,11.6);
    if(happy)scale(1.25,.32,1);else if(blink)scale(1.3,.22,1);   // 開心瞇眼 / 眨眼
    fill(22,52,90);sphere(2.4,12,10);
    if(!blink&&!happy){translate(.8,-1,1.9);fill(255);sphere(.9,6,5);translate(-1.6,1.8,0);fill(160,215,255);sphere(.45,5,4)}pop();
    push();translate(s*9.4,3.2,8.8);scale(happy?1.4:1,.7,.35);fill(255,150,175,happy?235:200);sphere(3,8,6);pop()}
  push();translate(0,4.2,12.8);scale(1.6,happy?1.2:.5,.4);fill(220,120,140);sphere(1,6,5);pop();
  // glass lobes: nearly clear body + additive rim shell + sharp specular glints (back to front)
  drawingContext.depthMask(false);
  LOBES.forEach((l,i)=>{
    const t=TINT[i%4],k=i==10?.8:1,r=l[3]*(1+.05*sin(T*.05+i*1.3)),m=1-c*.5;
    push();translate(l[0]*m+sin(T*.03+i)*.8,l[1]*m+cos(T*.025+i*2)*.8,l[2]*m);
    // faint cool shell just outside the body -> reads as a glassy rim
    blendMode(ADD);fill(170,232,238,24*k);sphere(r*1.07,12,9);blendMode(BLEND);
    // body: 半透明，還看得到金色核心與背景，但不再透明到像空的
    fill(lerp(t[0],235,pale),lerp(t[1],235,pale),lerp(t[2],235,pale),72*k);sphere(r,16,12);
    // the glass cue: one sharp glint + a tiny secondary sparkle
    push();translate(-r*.42,-r*.52,r*.54);scale(1,.5,.3);fill(255,255,255,240);sphere(r*.19,8,6);pop();
    push();translate(r*.46,r*.36,-r*.08);fill(255,255,255,150);sphere(r*.07,6,5);pop();
    pop()});
  drawingContext.depthMask(true);
  pop();
}

function keyPressed(){
  if(key==='m'||key==='M'){hoverFly=!hoverFly;return false}
  if(key==='f'||key==='F'){toggleFace();return false}
  if(key==='r'||key==='R'){P.x=HOME.x;P.y=HOME.y;P.z=HOME.z;P.vx=P.vy=P.vz=0;return false}
  if(keyCode===32||(keyCode>=37&&keyCode<=40))return false;   // 空白與方向鍵不要捲動頁面
}
function mousePressed(){if(uiClick)return;moved=0;pressF=frameCount;pressing=true}
function mouseDragged(){yaw-=(mouseX-pmouseX)*.006;pitch=constrain(pitch+(mouseY-pmouseY)*.006,-.25,1.35);moved+=abs(mouseX-pmouseX)+abs(mouseY-pmouseY);return false}
function mouseReleased(){if(uiClick)return;pressing=false;if(moved<6&&frameCount-pressF<=12){if(pippaHit())reactToPet();else quake()}}
function mouseWheel(e){camD=constrain(camD*exp(e.delta*.001),150,1200);return false}
function windowResized(){resizeCanvas(innerWidth*RS,innerHeight*RS)}
