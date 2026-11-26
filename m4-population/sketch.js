// ============================================================================
// 晶靈樹醫的森林 — M4 Step 1：有機森林環境重塑（去 AI 方塊感＋景深霧氣＋微生態植物）
// ============================================================================

const R = 120;      // 母樹樹幹半徑
const H0 = 210;     // 母樹板根起始高度
const OUT = 255;    // 板根向外延伸半徑

// 網址參數支援（截圖與展示用：?night / ?dusk / ?shot / ?en=0.1）
const NIGHT0 = /night/.test(location.search);
const DUSK0  = /dusk/.test(location.search);
const SHOT   = /shot/.test(location.search);
const EN0    = parseFloat((location.search.match(/[?&]en=([\d.]+)/) || [])[1]);

const CYCLE = 90; // 日夜循環總秒數
const START = DUSK0 ? 0.5 : NIGHT0 ? 1 : 0;
let night = START;
let nightLock = (NIGHT0 || DUSK0) ? START : null;

// DOM 介面參照
const phaseEl  = document.getElementById('phase');
const fpsEl    = document.getElementById('fps');
const enBar    = document.querySelector('#energy i');
const faceBtn  = document.getElementById('faceBtn');
const nightBtn = document.getElementById('nightBtn');

let faceCam = false;
let showDebug = false;
let workMs = 0;

function toggleFace() {
  faceCam = !faceCam;
  if (faceBtn) {
    faceBtn.classList.toggle('on', faceCam);
    faceBtn.textContent = faceCam ? '取消直視' : '正面看我';
  }
}

function cycleNightMode() {
  nightLock = nightLock === null ? 0 : nightLock === 0 ? 1 : null;
  if (nightBtn) {
    nightBtn.textContent =
      nightLock === null ? '日夜：自動' : nightLock === 0 ? '日夜：白天' : '日夜：夜晚';
    nightBtn.classList.toggle('on', nightLock !== null);
  }
}

if (faceBtn) faceBtn.addEventListener('click', toggleFace);
if (nightBtn) nightBtn.addEventListener('click', cycleNightMode);

// 觸控視角面板狀態
const cam = { l: 0, r: 0, u: 0, d: 0, zi: 0, zo: 0 };
function isUI(ev) {
  return !!(ev && ev.target && ev.target.closest && ev.target.closest('.ui'));
}
document.querySelectorAll('[data-cam]').forEach((b) => {
  const k = b.dataset.cam;
  const on = () => { cam[k] = 1; b.classList.add('on'); };
  const off = () => { cam[k] = 0; b.classList.remove('on'); };
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); on(); });
  b.addEventListener('pointerup', off);
  b.addEventListener('pointerleave', off);
  b.addEventListener('pointercancel', off);
});

// 攝影機與互動狀態
let yaw = 0.72, pitch = 0.22, camD = 350;
let tx = 0, ty = -120, tz = 0;
let ex = 0, ey = 0, ez = 0;
let shake = 0, moved = 0, pressF = 0;
let hoverFly = false, pressing = false, padDrag = null;

// 貼圖與靜態合併幾何
let barkTex, groundTex;
let finGeom, farGeom, moundGeom, shroomGeom, horizonGeom;

// 世界物件陣列
const finAngs = [], gaps = [], mounds = [], shrooms = [], farTrees = [];
const spores = [], leaves = [], fungi = [], drops = [], flow = [], ripples = [], sparks = [];
const glass = [], reeds = [], vines = [], mistBands = [], companions = [];

// 暫時保留 M3 主角與 4 隻夥伴（Step 2 會重構成平等的 Creature 類別＋生物設計工坊）
const HOME = { x: 260, y: -130, z: 110 };
const P = {
  x: 260, y: -130, z: 110,
  vx: 0, vy: 0, vz: 0,
  yaw: Math.PI, pit: 0, roll: 0,
  hyd: 1, glow: 0.6, curl: 0, qt: 0, react: 0,
  en: 0.5, spin: 0, pets: 0, petT: -999, idleT: 0, treatT: 0
};

// 彎曲清溪中心線與半寬函式
const cx = (z) => 420 + 60 * Math.sin(z * 0.004);
const hw = (z) => 88 + 14 * Math.sin(z * 0.011);
const fh = (t) => H0 * Math.pow(1 - t, 1.85);

function angDiff(a, b) {
  let d = (a - b) % TWO_PI;
  if (d > PI) d -= TWO_PI;
  if (d < -PI) d += TWO_PI;
  return d;
}

function groundY(x, z) {
  const r = Math.hypot(x, z);
  const th = Math.atan2(z, x);
  let m = 0;
  if (r > R - 10 && r < OUT) {
    const t = (r - (R - 10)) / (OUT - R + 10);
    for (const a of finAngs) {
      const d = angDiff(th, a);
      if (Math.abs(d) < 1.2 && Math.abs(r * Math.sin(d)) < 22) {
        m = Math.max(m, fh(t));
      }
    }
  }
  return m;
}

// ============================================================================
// 日夜天球軌道與大氣插值
// ============================================================================
function getOrbitTime() {
  if (nightLock === 0) return 0.2;
  if (nightLock === 1) return 0.72;
  if (nightLock === 0.5) return 0.48;
  return (millis() * 0.001 / CYCLE) % 1;
}

function sunPos() {
  const t = getOrbitTime();
  const a = (t - 0.2 + 0.25) * TWO_PI;
  return { x: Math.cos(a) * 820, y: -Math.sin(a) * 620, z: Math.sin(a * 0.6) * 300 };
}

function moonPos() {
  const t = getOrbitTime();
  const a = (t - 0.2 + 0.25) * TWO_PI + PI;
  return { x: Math.cos(a) * 820, y: -Math.sin(a) * 620, z: Math.sin(a * 0.6) * 300 };
}

function smooth5(u) {
  u = constrain(u, 0, 1);
  return u * u * u * (u * (u * 6 - 15) + 10);
}

function mixNight(a, b, c) {
  const dk = Math.min(1, night * 2);
  const nt = Math.max(0, night * 2 - 1);
  return lerp(lerp(a, b, dk), c, nt);
}

function nightCurve(t) {
  if (t < 0.40) return 0;
  if (t < 0.54) return smooth5((t - 0.40) / 0.14);
  if (t < 0.88) return 1;
  return 1 - smooth5((t - 0.88) / 0.12);
}

function skyColor() {
  return [
    mixNight(24, 54, 8),
    mixNight(46, 38, 13),
    mixNight(42, 46, 25)
  ];
}

function drawSun() {
  const s = sunPos();
  if (s.y > 70) return;
  const fade = constrain(-s.y / 120, 0, 1) * (1 - constrain(night * 1.4 - 0.2, 0, 1));
  if (fade < 0.02) return;
  noLights();
  push();
  translate(s.x, s.y, s.z);
  fill(255, 248, 220, 230 * fade);
  sphere(42, 20, 14);
  drawingContext.depthMask(false);
  blendMode(ADD);
  rotateY(Math.atan2(ex - s.x, ez - s.z));
  for (let k = 0; k < 14; k++) {
    const rr = 42 + k * 9;
    fill(255, lerp(225, 140, night * 2), 80, lerp(18, 5, night) * (1 - k / 14) * fade);
    circle(0, 0, rr * 2);
  }
  blendMode(BLEND);
  drawingContext.depthMask(true);
  pop();
  lights3();
}

function drawMoon() {
  const m = moonPos();
  if (m.y > 70) return;
  const fade = constrain(-m.y / 120, 0, 1) * night;
  if (fade < 0.02) return;
  noLights();
  push();
  translate(m.x, m.y, m.z);
  fill(240, 246, 255, 245 * fade);
  sphere(46, 20, 14);
  drawingContext.depthMask(false);
  blendMode(ADD);
  rotateY(Math.atan2(ex - m.x, ez - m.z));
  for (let k = 0; k < 22; k++) {
    const rr = 46 + k * 5.5;
    fill(150, 188, 255, 4.2 * fade * (1 - k / 22));
    circle(0, 0, rr * 2);
  }
  blendMode(BLEND);
  drawingContext.depthMask(true);
  pop();
  lights3();
}

const fpos = (f) => [Math.cos(f.a) * (R + 4), -f.h, Math.sin(f.a) * (R + 4)];
const dpos = (d) => [Math.cos(d.a) * (R + 3), -d.h, Math.sin(d.a) * (R + 3)];

// ============================================================================
// 初始化 setup()
// ============================================================================
function setup() {
  createCanvas(innerWidth, innerHeight, WEBGL);
  pixelDensity(min(1.5, devicePixelRatio));
  if (!isNaN(EN0)) P.en = constrain(EN0, 0, 1);
  if (SHOT) {
    document.querySelectorAll('#hudTopLeft,#topRightBtns,#hint,#pad').forEach((e) => {
      e.style.display = 'none';
    });
  }

  randomSeed(11);
  noiseSeed(5);

  for (let i = 0; i < 8; i++) if (i !== 1) finAngs.push(i * PI / 4);
  for (let k = 2; k < 8; k++) gaps.push((k + 0.5) * PI / 4);
  gaps.push(PI / 4);

  barkTex = makeBark();
  groundTex = makeGround();

  const okFromStream = (x, z) => Math.abs(x - cx(z)) > 150;

  while (mounds.length < 32) {
    const x = random(-1300, 1300);
    const z = random(-1300, 1300);
    if (Math.hypot(x, z) > 290 && okFromStream(x, z)) {
      mounds.push({
        x, z,
        r: random(26, 78),
        h: random(0.22, 0.36),
        c: [random(36, 62), random(88, 128), random(46, 72)]
      });
    }
  }

  while (shrooms.length < 24) {
    const x = random(-950, 950);
    const z = random(-950, 950);
    if (Math.hypot(x, z) > 265 && okFromStream(x, z)) {
      shrooms.push({ x, z, s: random(3, 7.5) });
    }
  }

  // 人工海玻璃與陶瓷卵石（M1 殘留物）
  const glassCols = [
    [100, 230, 175], // 磨砂可樂瓶翡翠綠
    [235, 155, 65],  // 琥珀啤酒玻璃
    [70, 140, 245],  // 鈷藍藥劑玻璃
    [235, 245, 240], // 乳白海鹽磨砂玻璃
    [245, 242, 232], // 青花瓷胎白
    [210, 115, 82]   // 赤陶磚卵石
  ];
  glass.push({ x: cx(100) - 36, z: 100, r: 26, c: [100, 230, 175], kind: 1, th: 0.48, rot: 0.35, landmark: true });
  glass.push({ x: cx(-220) + 38, z: -220, r: 24, c: [235, 155, 65], kind: 1, th: 0.5, rot: -0.6, landmark: true });
  glass.push({ x: cx(380) - 24, z: 380, r: 22, c: [70, 140, 245], kind: 1, th: 0.46, rot: 1.1, landmark: true });

  while (glass.length < 40) {
    const z = random(-1100, 1100);
    const w = hw(z) * 0.85;
    glass.push({
      x: cx(z) + random(-w, w),
      z,
      r: random(8, 16),
      c: glassCols[glass.length % glassCols.length],
      kind: glass.length % 3,
      th: random(0.28, 0.46),
      rot: random(TWO_PI),
      landmark: false
    });
  }

  // 溪邊隨水流搖曳的水草叢
  for (let i = 0; i < 42; i++) {
    const z = random(-1050, 1050);
    const side = i % 2 === 0 ? -1 : 1;
    const x = cx(z) + side * (hw(z) * random(0.82, 1.15));
    reeds.push({
      x, z,
      blades: floor(random(3, 6)),
      h: random(18, 42),
      ph: random(TWO_PI),
      hue: random(-10, 15)
    });
  }

  // 樹冠垂掛的氣根／藤蔓
  for (let i = 0; i < 20; i++) {
    const ang = random(TWO_PI);
    const dist = i < 10 ? random(R + 40, R + 170) : random(320, 750);
    const vx = Math.cos(ang) * dist;
    const vz = Math.sin(ang) * dist;
    if (Math.abs(vx - cx(vz)) < hw(vz) + 25) continue;
    vines.push({
      x: vx,
      z: vz,
      topY: random(-820, -640),
      len: random(220, 440),
      ph: random(TWO_PI)
    });
  }

  // 低空緩慢飄浮的林間薄霧帶
  for (let i = 0; i < 4; i++) {
    mistBands.push({
      r: 420 + i * 260,
      y: -14 - i * 18,
      speed: (i % 2 === 0 ? 1 : -1) * random(0.0008, 0.0018),
      ph: random(TWO_PI)
    });
  }

  // 4 隻野生獨立 NPC（將在 Step 2 重構成統一 Creature 類別）
  const npcCfg = [
    { name: '暮暮', home: { x: -135, y: -65, z: -150 }, s: 0.76, c: [255, 185, 90], role: 'sleepy' },
    { name: '瀾瀾', home: { x: cx(240), y: -25, z: 240 }, s: 0.78, c: [110, 215, 255], role: 'forager' },
    { name: '苗苗', home: { x: Math.cos(PI * 0.75) * (R + 14), y: -190, z: Math.sin(PI * 0.75) * (R + 14) }, s: 0.70, c: [115, 245, 165], role: 'doctor' },
    { name: '幽幽', home: { x: R + 52, y: -24, z: 40 }, s: 0.65, c: [245, 230, 185], role: 'shy' }
  ];
  for (const cfg of npcCfg) {
    companions.push({
      x: cfg.home.x, y: cfg.home.y, z: cfg.home.z,
      home: { ...cfg.home },
      vx: 0, vy: 0, vz: 0,
      yaw: random(TWO_PI), pit: 0, roll: 0,
      s: cfg.s, c: cfg.c, en: 0.8,
      glow: cfg.role === 'sleepy' ? 0.12 : 0.55,
      curl: cfg.role === 'sleepy' ? 0.75 : 0,
      react: 0, role: cfg.role, name: cfg.name,
      ph: random(TWO_PI), greetT: 0
    });
  }

  while (farTrees.length < 13) {
    const a = random(TWO_PI);
    const d = random(640, 1620);
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (Math.abs(x - cx(z)) < 175) continue;
    farTrees.push({ x, z, r: random(85, 165), f: constrain(d / 1800, 0, 1) });
  }

  for (let i = 0; i < 7; i++) fungi.push({ a: random(gaps) + random(-0.08, 0.08), h: random(55, 420), s: 1, hl: 0 });
  for (let i = 0; i < 9; i++) drops.push({ a: random(gaps) + random(-0.08, 0.08), h: random(60, 420), s: 1, ph: random(6) });
  for (let i = 0; i < 110; i++) spores.push({ x: random(-850, 850), y: random(-540, -10), z: random(-850, 850), s: random(2, 5), ph: random(6) });

  tx = P.x; ty = P.y; tz = P.z;

  // ★ 靜態合併幾何（注意：不再使用 texture(whiteTex)，保留原本頂點漸層顏色！）
  noStroke();
  finGeom = buildGeometry(buildMainFins);
  finGeom.computeNormals();

  farGeom = buildGeometry(buildFarFins);
  farGeom.computeNormals();

  moundGeom = buildGeometry(buildMounds);
  shroomGeom = buildGeometry(buildShrooms);
  horizonGeom = buildGeometry(buildHorizonRing);

  // 觸控視角面板事件
  const padSurf = document.getElementById('padsurf');
  if (padSurf) {
    padSurf.addEventListener('pointerdown', (e) => {
      padDrag = { x: e.clientX, y: e.clientY };
      try { padSurf.setPointerCapture(e.pointerId); } catch (err) {}
      padSurf.style.cursor = 'grabbing';
      e.preventDefault();
    });
    padSurf.addEventListener('pointermove', (e) => {
      if (!padDrag) return;
      yaw -= (e.clientX - padDrag.x) * 0.012;
      pitch = constrain(pitch + (e.clientY - padDrag.y) * 0.008, -0.45, 1.35);
      padDrag = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    });
    const endPad = () => { padDrag = null; padSurf.style.cursor = 'grab'; };
    padSurf.addEventListener('pointerup', endPad);
    padSurf.addEventListener('pointercancel', endPad);
    padSurf.addEventListener('lostpointercapture', endPad);
  }
}

// ============================================================================
// 程序化貼圖：有青苔漸層的樹皮 & 邊緣融進林霧的苔地
// ============================================================================
function makeBark() {
  const g = createGraphics(256, 512);
  g.pixelDensity(1);
  g.noStroke();
  for (let y = 0; y < 512; y += 3) {
    for (let x = 0; x < 256; x += 2) {
      const a = (x / 256) * TWO_PI;
      const c1 = Math.cos(a) * 1.6;
      const c2 = Math.sin(a) * 1.6;
      const n = noise(c1 + 9, c2 + 9, y * 0.012) * 0.7 + noise(c1 * 3 + 3, c2 * 3 + 3, y * 0.05) * 0.3;
      let r = 56 + n * 58;
      let gg = 40 + n * 38;
      let b = 30 + n * 26;
      const mossMask = constrain(
        constrain((y - 310) / 140, 0, 1) * noise(c1 * 2 + 40, c2 * 2, y * 0.03) * 1.85 +
        constrain(noise(c1 * 2 + 70, c2 * 2 + 70, y * 0.02) - 0.58, 0, 1) * 3.1,
        0, 1
      );
      r = lerp(r, 46 + n * 26, mossMask);
      gg = lerp(gg, 106 + n * 58, mossMask);
      b = lerp(b, 46 + n * 22, mossMask);
      g.fill(r, gg, b);
      g.rect(x, y, 2, 3);
    }
  }
  g.stroke(24, 15, 11, 145);
  g.strokeWeight(1.5);
  for (let i = 0; i < 65; i++) {
    const x = random(256);
    const y = random(512);
    g.line(x, y, x + random(-3, 3), y + random(24, 80));
  }
  return g;
}

function makeGround() {
  const g = createGraphics(512, 512);
  g.pixelDensity(1);
  g.noStroke();
  g.background(24, 46, 42); // 與遠景背景接近的底色
  for (let i = 0; i < 6200; i++) {
    const x = random(512);
    const y = random(512);
    const n = noise(x * 0.013, y * 0.013);
    const edgeFade = constrain((dist(x, y, 256, 256) / 256 - 0.50) * 2.1, 0, 1);
    g.fill(
      lerp(28 + n * 34, 24, edgeFade),
      lerp(66 + n * 74, 46, edgeFade),
      lerp(44 + n * 26, 42, edgeFade),
      205
    );
    g.circle(x, y, random(5, 14));
  }
  // 細碎林下微光與苔點
  for (let i = 0; i < 750; i++) {
    const x = random(512), y = random(512);
    if (dist(x, y, 256, 256) > 210) continue;
    g.fill(155, 215, 138, 95);
    g.circle(x, y, random(1.4, 2.8));
  }
  // 河床微凹陰影
  for (let py = 0; py < 512; py += 2) {
    const wx = cx((py / 512) * 4000 - 2000);
    g.fill(18, 36, 34, 175);
    g.circle(((wx + 2000) / 4000) * 512, py, 36);
  }
  return g;
}

// ============================================================================
// 有機曲面幾何建構（告別白色樓梯板根）
// ============================================================================
function addOrganicFin(rInner, rOuter, hStart, baseW, curveAmp, fogFactor, seedOffset) {
  const segs = 14;
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const x = lerp(rInner, rOuter, t);
    const wave = Math.sin(t * PI * 2.4 + seedOffset) * 6 * (1 - t);
    const h = Math.max(0, hStart * Math.pow(1 - t, 1.85) + wave);
    const wb = baseW * (1 - 0.58 * t) * (1 + 0.1 * Math.sin(t * 8 + seedOffset));
    const wt = wb * 0.24;
    const zc = curveAmp * Math.sin(t * PI * 1.25 + seedOffset);
    pts.push({ x, h, wb, wt, zc, t });
  }

  const f = fogFactor;
  const colBark = (t) => [
    lerp(82, 54, t * 0.85) * f,
    lerp(56, 98, t * 0.85) * f,
    lerp(40, 48, t * 0.85) * f
  ];
  const colMoss = (t) => [
    lerp(62, 56, t) * f,
    lerp(122, 112, t) * f,
    lerp(56, 54, t) * f
  ];

  beginShape(TRIANGLES);
  for (let i = 0; i < segs; i++) {
    const a = pts[i];
    const b = pts[i + 1];

    const cBa = colBark(a.t);
    const cBb = colBark(b.t);
    const cMa = colMoss(a.t);
    const cMb = colMoss(b.t);

    // 左側斜面（朝向 -z）
    fill(...cBa); vertex(a.x, 1, a.zc - a.wb);
    fill(...cBb); vertex(b.x, 1, b.zc - b.wb);
    fill(...cMb); vertex(b.x, -b.h, b.zc - b.wt);

    fill(...cBa); vertex(a.x, 1, a.zc - a.wb);
    fill(...cMb); vertex(b.x, -b.h, b.zc - b.wt);
    fill(...cMa); vertex(a.x, -a.h, a.zc - a.wt);

    // 右側斜面（朝向 +z）
    fill(...cBa); vertex(a.x, 1, a.zc + a.wb);
    fill(...cMa); vertex(a.x, -a.h, a.zc + a.wt);
    fill(...cMb); vertex(b.x, -b.h, b.zc + b.wt);

    fill(...cBa); vertex(a.x, 1, a.zc + a.wb);
    fill(...cMb); vertex(b.x, -b.h, b.zc + b.wt);
    fill(...cBb); vertex(b.x, 1, b.zc + b.wb);

    // 頂部苔蘚脊面（朝上 -y）
    fill(...cMa); vertex(a.x, -a.h, a.zc + a.wt);
    fill(...cMa); vertex(a.x, -a.h, a.zc - a.wt);
    fill(...cMb); vertex(b.x, -b.h, b.zc - b.wt);

    fill(...cMa); vertex(a.x, -a.h, a.zc + a.wt);
    fill(...cMb); vertex(b.x, -b.h, b.zc - b.wt);
    fill(...cMb); vertex(b.x, -b.h, b.zc + b.wt);
  }
  endShape();
}

function buildMainFins() {
  for (let idx = 0; idx < finAngs.length; idx++) {
    const a = finAngs[idx];
    push();
    rotateY(-a);
    addOrganicFin(R - 14, OUT + 10, H0, 22, (idx % 2 === 0 ? 1 : -1) * 14, 1.0, idx * 0.9);
    pop();
  }
}

function buildFarFins() {
  for (const f of farTrees) {
    const s = f.r / R;
    const h0 = H0 * s;
    const o = f.r + (OUT - R) * s;
    const finCount = 5;
    const fog = 1 - f.f * 0.72;
    push();
    translate(f.x, 0, f.z);
    const a0 = f.x * 0.013 + f.z * 0.007;
    for (let k = 0; k < finCount; k++) {
      push();
      rotateY(a0 + (k * TWO_PI) / finCount);
      addOrganicFin(f.r - 12 * s, o, h0, 20 * s, (k % 2 === 0 ? 1 : -1) * 10 * s, fog, k * 1.1);
      pop();
    }
    pop();
  }
}

function buildMounds() {
  for (const m of mounds) {
    // 雙層有機苔丘：底層深苔＋上層亮苔微隆
    push();
    translate(m.x, 2, m.z);
    rotateY(m.x * 0.01);
    scale(1.15, m.h, 0.92);
    fill(m.c[0] * 0.8, m.c[1] * 0.85, m.c[2] * 0.85);
    sphere(m.r, 12, 8);
    pop();

    push();
    translate(m.x + m.r * 0.18, 0, m.z - m.r * 0.12);
    scale(0.85, m.h * 1.15, 0.85);
    fill(m.c[0], m.c[1], m.c[2]);
    sphere(m.r * 0.72, 10, 7);
    pop();
  }
}

function buildShrooms() {
  for (const s of shrooms) {
    push();
    translate(s.x, 0, s.z);
    fill(190, 208, 198);
    translate(0, -s.s * 0.9, 0);
    cylinder(s.s * 0.26, s.s * 1.8, 6, 1);
    translate(0, -s.s * 0.9, 0);
    scale(1.1, 0.55, 1.1);
    fill(110, 225, 205);
    sphere(s.s, 8, 6);
    pop();
  }
}

// 遠處森林剪影環：讓天地交界自然融進霧氣裡
function buildHorizonRing() {
  const segs = 36;
  const rad = 1850;
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * TWO_PI;
    const h = 520 + ((i * 137) % 340);
    const w = 340;
    push();
    translate(Math.cos(a) * rad, -h * 0.45, Math.sin(a) * rad);
    rotateY(-a + HALF_PI);
    fill(18, 38, 35, 180);
    plane(w, h);
    pop();
  }
}

// ============================================================================
// 指標與射線互動（點擊生物、真菌、或水面光紋）
// ============================================================================
function screenRay(sx, sy) {
  const mx = sx == null ? mouseX : sx;
  const my = sy == null ? mouseY : sy;
  const f = createVector(tx - ex, ty - ey, tz - ez).normalize();
  const up = createVector(0, 1, 0);
  const r = p5.Vector.cross(f, up).normalize();
  const d = p5.Vector.cross(r, f);
  const th = Math.tan(PI / 6);
  const nx = (mx / width - 0.5) * 2;
  const ny = (my / height - 0.5) * 2;
  return f.copy().add(r.mult(nx * th * width / height)).add(d.mult(ny * th)).normalize();
}

function mouseTarget() {
  const ray = screenRay(mouseX, mouseY);
  const boost = mouseIsPressed && moved < 6 && frameCount - pressF > 12;
  const dep = constrain(Math.hypot(P.x - ex, P.y - ey, P.z - ez) * (boost ? 2.4 : 1), 120, 1400);
  return [ex + ray.x * dep, ey + ray.y * dep, ez + ray.z * dep, boost];
}

function pippaHit(sx, sy) {
  const ray = screenRay(sx, sy);
  const ox = P.x - ex, oy = P.y - ey, oz = P.z - ez;
  const t = ox * ray.x + oy * ray.y + oz * ray.z;
  if (t <= 0) return false;
  return Math.hypot(P.x - (ex + ray.x * t), P.y - (ey + ray.y * t), P.z - (ez + ray.z * t)) < 30;
}

function fungusHit(sx, sy) {
  const ray = screenRay(sx, sy);
  let best = null, bd = 1e9;
  for (const f of fungi) {
    if (f.s < 0.06) continue;
    const p = fpos(f);
    const ox = p[0] - ex, oy = p[1] - ey, oz = p[2] - ez;
    const t = ox * ray.x + oy * ray.y + oz * ray.z;
    if (t <= 0) continue;
    const dd = Math.hypot(p[0] - (ex + ray.x * t), p[1] - (ey + ray.y * t), p[2] - (ez + ray.z * t));
    if (dd < 26 + 18 * f.s && dd < bd) {
      bd = dd;
      best = f;
    }
  }
  return best;
}

// 點水面／地面起柔和光紋漣漪（不再誤觸地震）
function tapGroundOrWater(sx, sy) {
  const ray = screenRay(sx, sy);
  if (ray.y <= 0.03) return; // 往天空點不產生地面漣漪
  const t = -ey / ray.y;
  if (t <= 0 || t > 2200) return;
  const gx = ex + ray.x * t;
  const gz = ez + ray.z * t;
  const onStream = Math.abs(gx - cx(gz)) < hw(gz) + 20;
  ripples.push({ x: gx, z: gz, t: 0, water: onStream });
  for (let i = 0; i < 6; i++) {
    const a = random(TWO_PI);
    sparks.push({
      x: gx, y: -4, z: gz,
      vx: Math.cos(a) * 0.6, vy: random(-0.9, -0.3), vz: Math.sin(a) * 0.6,
      life: 0.9, r: random(1.2, 2.0),
      c: onStream ? [160, 235, 255] : [175, 245, 185]
    });
  }
}

function reactToPet() {
  P.react = 72;
  P.glow = 1;
  P.pets = (frameCount - P.petT < 80) ? P.pets + 1 : 1;
  P.petT = frameCount;
  if (P.pets >= 3) {
    P.pets = 0;
    P.spin = 48;
    P.en = min(1, P.en + 0.04);
    for (let i = 0; i < 18; i++) {
      const a = random(TWO_PI), s = random(1, 2.4);
      sparks.push({
        x: P.x, y: P.y, z: P.z,
        vx: Math.cos(a) * s, vy: random(-2, -0.4), vz: Math.sin(a) * s,
        life: 1, r: random(1.5, 3), c: [255, 240, 170]
      });
    }
  }
  for (let i = 0; i < 20; i++) {
    const a = random(TWO_PI), s = random(0.6, 1.8);
    sparks.push({
      x: P.x + random(-6, 6), y: P.y + random(-6, 6), z: P.z + random(-6, 6),
      vx: Math.cos(a) * s, vy: random(-1.5, -0.2), vz: Math.sin(a) * s,
      life: 1, r: random(1.2, 2.5),
      c: random() < 0.45 ? [255, 140, 180] : random() < 0.5 ? [255, 225, 140] : [190, 250, 235]
    });
  }
}

function feedFungus(f) {
  f.hl = 1;
  f.s = max(0.05, f.s - 0.35);
  P.en = min(1, P.en + 0.18);
  P.react = 72;
  P.treatT = 48;
  const p = fpos(f);
  for (let i = 0; i < 16; i++) {
    flow.push({ x: p[0] + random(-14, 14), y: p[1] + random(-14, 14), z: p[2], c: random() < 0.5 ? [255, 215, 90] : [160, 255, 180] });
  }
  for (let i = 0; i < 10; i++) {
    const a = random(TWO_PI);
    sparks.push({ x: p[0], y: p[1], z: p[2], vx: Math.cos(a) * 1.1, vy: random(-0.8, 0.4), vz: Math.sin(a) * 1.1, life: 1.2, r: random(1.4, 2.6), c: [160, 255, 190] });
  }
}

function quake() {
  P.qt = 55;
  shake = 12;
  P.curl = 1.0;
  for (let i = 0; i < 24; i++) {
    leaves.push({
      x: tx + random(-450, 450), y: random(-950, -300), z: tz + random(-450, 450),
      vy: random(0.8, 1.8), ph: random(6),
      c: random() < 0.6 ? [90, 150, 70] : [210, 170, 70]
    });
  }
}

// ============================================================================
// 每幀邏輯更新 update()
// ============================================================================
function update() {
  let ix = 0, iz = 0, iy = 0;
  if (keyIsDown(87)) iz += 1;
  if (keyIsDown(83)) iz -= 1;
  if (keyIsDown(65) || keyIsDown(LEFT_ARROW)) ix -= 1;
  if (keyIsDown(68) || keyIsDown(RIGHT_ARROW)) ix += 1;
  if (keyIsDown(UP_ARROW) || keyIsDown(32)) iy -= 1;
  if (keyIsDown(DOWN_ARROW) || keyIsDown(SHIFT)) iy += 1;
  const kb = ix || iz || iy;

  if (kb || hoverFly || pressing) P.idleT = 0;
  else P.idleT++;

  P.en = max(0, P.en - (0.00005 + min(9, Math.hypot(P.vx, P.vy, P.vz)) * 0.000012));
  const vigor = 0.35 + 0.65 * min(1, P.en * 2);

  if (P.qt > 0) {
    P.qt--;
    P.curl = min(1, P.curl + 0.25);
    P.vx *= 0.85; P.vy *= 0.85; P.vz *= 0.85;
  } else {
    P.curl = max(0, P.curl - 0.035);
    if (kb) {
      const fl = Math.hypot(tx - ex, tz - ez) || 1;
      const fx = (tx - ex) / fl, fz = (tz - ez) / fl;
      P.vx += (fx * iz - fz * ix) * 0.9 * vigor;
      P.vz += (fz * iz + fx * ix) * 0.9 * vigor;
      P.vy += iy * 0.8 * vigor;
      P.vx *= 0.96; P.vy *= 0.96; P.vz *= 0.96;
      const sp = Math.hypot(P.vx, P.vy, P.vz), mx = 9 * vigor;
      if (sp > mx) { P.vx *= mx / sp; P.vy *= mx / sp; P.vz *= mx / sp; }
    } else {
      let boost = false, g = null;
      if (hoverFly || pressing) {
        const m = mouseTarget();
        g = [m[0], m[1], m[2]];
        boost = m[3];
      }
      if (g) {
        const ax = g[0] - P.x, ay = g[1] - P.y, az = g[2] - P.z;
        const d = Math.hypot(ax, ay, az) || 1;
        const k = min(0.5, d * 0.006) / d * vigor;
        P.vx += ax * k; P.vy += ay * k; P.vz += az * k;
        P.vx *= 0.93; P.vy *= 0.93; P.vz *= 0.93;
        const sp = Math.hypot(P.vx, P.vy, P.vz), mx = (boost ? 11 : 7.5) * vigor;
        if (sp > mx) { P.vx *= mx / sp; P.vy *= mx / sp; P.vz *= mx / sp; }
      } else if (P.idleT > 320 && P.en > 0.15 && P.qt <= 0) {
        const ax = HOME.x - P.x, ay = HOME.y - P.y, az = HOME.z - P.z;
        const d = Math.hypot(ax, ay, az) || 1;
        if (d > 35) {
          P.vx += (ax / d) * 0.14 * vigor;
          P.vy += (ay / d) * 0.12 * vigor;
          P.vz += (az / d) * 0.14 * vigor;
        }
        P.vx *= 0.92; P.vy *= 0.92; P.vz *= 0.92;
      } else {
        P.vx *= 0.9; P.vy *= 0.9; P.vz *= 0.9;
      }
    }
  }

  if (P.en < 0.12 && !kb && !hoverFly && !pressing && P.qt <= 0) {
    let best = null, bd = 1e9;
    for (const f of fungi) {
      if (f.s < 0.2) continue;
      const p = fpos(f);
      const dd = Math.hypot(P.x - p[0], P.y - p[1], P.z - p[2]);
      if (dd < bd) { bd = dd; best = p; }
    }
    if (best) {
      const dx = best[0] - P.x, dy = best[1] - P.y, dz = best[2] - P.z;
      const dl = Math.hypot(dx, dy, dz) || 1;
      P.vx += (dx / dl) * 0.5; P.vy += (dy / dl) * 0.5; P.vz += (dz / dl) * 0.5;
      P.vx *= 0.96; P.vy *= 0.96; P.vz *= 0.96;
    }
  }

  const bobAmp = P.en <= 0.05 ? 0.03 : (0.06 + 0.11 * min(1, P.en * 2));
  P.x += P.vx;
  P.y += P.vy + Math.sin(frameCount * 0.05) * bobAmp;
  P.z += P.vz;

  const r = Math.hypot(P.x, P.z);
  if (r < R + 26) { P.x *= (R + 26) / r; P.z *= (R + 26) / r; }
  for (const f of farTrees) {
    const dx = P.x - f.x, dz = P.z - f.z;
    const dd = Math.hypot(dx, dz);
    if (dd < f.r + 24) {
      P.x = f.x + (dx / dd) * (f.r + 24);
      P.z = f.z + (dz / dd) * (f.r + 24);
    }
  }
  P.y = constrain(P.y, -1100, -16 - groundY(P.x, P.z));
  P.x = constrain(P.x, -1500, 1500);
  P.z = constrain(P.z, -1500, 1500);

  if (faceCam) {
    const dx = ex - P.x, dy = ey - P.y, dz = ez - P.z;
    const dl = Math.hypot(dx, dy, dz) || 1;
    P.yaw += angDiff(Math.atan2(dx, dz), P.yaw) * 0.08;
    P.pit = lerp(P.pit, -Math.asin(constrain(dy / dl, -1, 1)), 0.08);
    P.roll *= 0.9;
  } else {
    const sp = Math.hypot(P.vx, P.vz);
    if (sp > 0.3) {
      const t = Math.atan2(P.vx, P.vz);
      const d = angDiff(t, P.yaw);
      P.yaw += d * 0.1;
      P.roll = lerp(P.roll, constrain(d * 2.4, -0.6, 0.6), 0.1);
    } else {
      P.roll *= 0.9;
    }
    P.pit = lerp(P.pit, constrain(-P.vy * 0.1, -0.6, 0.6), 0.1);
  }

  if (P.react > 0) P.react--;
  if (P.spin > 0) P.spin--;
  if (P.treatT > 0) P.treatT--;

  let targetGlow = 0;
  if (P.en > 0.05) targetGlow = Math.pow((P.en - 0.05) / 0.95, 1.25);
  if (P.react > 0) targetGlow = min(1, targetGlow + (P.react / 72) * 0.35);
  P.glow = lerp(P.glow, targetGlow, P.glow < targetGlow ? 0.038 : 0.065);
  P.hyd = max(0, P.hyd - 0.0002);

  if (P.curl < 0.3) {
    for (const f of fungi) {
      const p = fpos(f);
      if (f.s > 0.06 && Math.hypot(P.x - p[0], P.y - p[1], P.z - p[2]) < 95) {
        f.s -= 0.006;
        f.hl = min(1, f.hl + 0.01);
        P.en = min(1, P.en + 0.0028);
        if (frameCount % 2 === 0) flow.push({ x: p[0] + random(-8, 8), y: p[1] + random(-8, 8), z: p[2], c: [180, 240, 200] });
      } else {
        f.s = min(1, f.s + 0.0003);
      }
      if (f.s > 0.5) f.hl = max(0, f.hl - 0.0004);
    }
    for (const d of drops) {
      const p = dpos(d);
      if (d.s > 0.2 && Math.hypot(P.x - p[0], P.y - p[1], P.z - p[2]) < 80) {
        d.s -= 0.012;
        P.en = min(1, P.en + 0.004);
        P.hyd = min(1, P.hyd + 0.004);
        if (frameCount % 2 === 0) flow.push({ x: p[0], y: p[1], z: p[2], c: [255, 205, 80] });
      }
      d.s = min(1, d.s + 0.0012);
    }
    if (P.y > -34 && Math.abs(P.x - cx(P.z)) < hw(P.z) + 10) {
      P.hyd = min(1, P.hyd + 0.01);
      if (frameCount % 10 === 0) ripples.push({ x: P.x, z: P.z, t: 0, water: true });
    }
  }

  // 4 隻 NPC 行為更新（將在 Step 2 全面轉為統一 Creature 類別與互動物件）
  for (const c of companions) {
    const dxP = P.x - c.x, dyP = P.y - c.y, dzP = P.z - c.z;
    const distP = Math.hypot(dxP, dyP, dzP) || 1;
    const isNear = distP < 115;

    let gX = c.home.x, gY = c.home.y, gZ = c.home.z;
    if (c.role === 'sleepy') {
      if (!isNear) {
        gY += Math.sin(frameCount * 0.03 + c.ph) * 3;
        c.curl = lerp(c.curl, 0.75, 0.04);
        c.glow = lerp(c.glow, 0.12, 0.04);
        c.greetT = 0;
      } else {
        c.curl = lerp(c.curl, 0, 0.08);
        c.glow = lerp(c.glow, 0.9, 0.06);
        c.yaw = lerp(c.yaw, Math.atan2(dxP, dzP), 0.1);
        if (c.greetT === 0) {
          c.greetT = 70; c.react = 65; c.vy -= 2.4;
          for (let k = 0; k < 14; k++) {
            const a = random(TWO_PI);
            sparks.push({ x: c.x, y: c.y, z: c.z, vx: Math.cos(a) * 1.2, vy: random(-1.4, 0.2), vz: Math.sin(a) * 1.2, life: 1, r: random(1.5, 2.8), c: [255, 215, 110] });
          }
        }
      }
    } else if (c.role === 'forager') {
      if (!isNear) {
        gX += Math.sin(frameCount * 0.03 + c.ph) * 42;
        gZ += Math.cos(frameCount * 0.025 + c.ph) * 65;
        gY += Math.sin(frameCount * 0.06) * 3.5;
        if (frameCount % 45 === 0) ripples.push({ x: c.x, z: c.z, t: 0, water: true });
      } else {
        const ang = frameCount * 0.06 + c.ph;
        gX = P.x + Math.cos(ang) * 48;
        gZ = P.z + Math.sin(ang) * 48;
        gY = P.y + Math.sin(frameCount * 0.08) * 12;
        c.react = 45;
        if (frameCount % 6 === 0) {
          flow.push({ x: c.x, y: c.y, z: c.z, c: [120, 230, 255] });
          P.hyd = min(1, P.hyd + 0.003);
          P.en = min(1, P.en + 0.0015);
        }
      }
    } else if (c.role === 'doctor') {
      if (!isNear) {
        gY += Math.sin(frameCount * 0.05 + c.ph) * 5;
        c.yaw = Math.atan2(-c.home.x, -c.home.z);
        if (frameCount % 50 === 0) sparks.push({ x: c.x, y: c.y, z: c.z, vx: random(-0.4, 0.4), vy: random(-0.6, 0.2), vz: random(-0.4, 0.4), life: 1, r: random(1.2, 2.2), c: [130, 255, 170] });
      } else {
        c.yaw = lerp(c.yaw, Math.atan2(dxP, dzP), 0.1);
        c.pit = Math.sin(frameCount * 0.25) * 0.3;
        c.react = 45;
        if (P.treatT > 0 && frameCount % 4 === 0) flow.push({ x: c.x, y: c.y, z: c.z, c: [140, 255, 185] });
      }
    } else if (c.role === 'shy') {
      if (!isNear) {
        gX += Math.cos(frameCount * 0.028 + c.ph) * 36;
        gZ += Math.sin(frameCount * 0.028 + c.ph) * 36;
        gY += Math.sin(frameCount * 0.04) * 6;
      } else {
        gX = c.home.x - (dxP / distP) * 28;
        gZ = c.home.z - (dzP / distP) * 28;
        c.yaw = lerp(c.yaw, Math.atan2(dxP, dzP), 0.1);
        c.react = 40;
        if (frameCount % 45 === 0) {
          for (let k = 0; k < 4; k++) {
            sparks.push({ x: c.x, y: c.y, z: c.z, vx: random(-0.5, 0.5), vy: random(-0.8, -0.1), vz: random(-0.5, 0.5), life: 1.2, r: random(1.6, 2.8), c: [255, 245, 190] });
          }
        }
      }
    }

    const dx = gX - c.x, dy = gY - c.y, dz = gZ - c.z;
    const dl = Math.hypot(dx, dy, dz) || 1;
    const spd = min(6.5, dl * 0.06);
    c.vx = lerp(c.vx, (dx / dl) * spd, 0.065);
    c.vy = lerp(c.vy, (dy / dl) * spd, 0.065);
    c.vz = lerp(c.vz, (dz / dl) * spd, 0.065);
    c.x += c.vx; c.y += c.vy; c.z += c.vz;

    const csp = Math.hypot(c.vx, c.vz);
    if (csp > 0.15) {
      const t = Math.atan2(c.vx, c.vz);
      c.yaw += angDiff(t, c.yaw) * 0.09;
      c.roll = lerp(c.roll, constrain(angDiff(t, c.yaw) * 1.8, -0.4, 0.4), 0.08);
    }
    c.pit = lerp(c.pit, constrain(-c.vy * 0.1, -0.4, 0.4), 0.08);

    if (P.qt > 0) c.curl = min(1, c.curl + 0.22);
    else if (c.role !== 'sleepy' || isNear) c.curl = max(0, c.curl - 0.035);

    if (c.react > 0) c.react--;
    if (c.role !== 'sleepy') {
      const targetG = P.en <= 0.05 ? 0 : (isNear ? 0.8 : 0.48) + (c.react > 0 ? 0.2 : 0);
      c.glow = lerp(c.glow, targetG, 0.05);
    }
  }
}

// ============================================================================
// 光照與場景繪製
// ============================================================================
function lights3() {
  const s = sunPos(), m = moonPos();
  const sl = Math.hypot(s.x, s.y, s.z) || 1;
  const ml = Math.hypot(m.x, m.y, m.z) || 1;

  ambientLight(mixNight(92, 86, 18), mixNight(122, 66, 26), mixNight(112, 68, 46));

  const dirX = lerp(-s.x / sl, -m.x / ml, night);
  const dirY = lerp(-s.y / sl, -m.y / ml, night);
  const dirZ = lerp(-s.z / sl, -m.z / ml, night);
  directionalLight(
    mixNight(255, 255, 145),
    mixNight(238, 165, 170),
    mixNight(190, 105, 228),
    dirX, dirY, dirZ
  );

  directionalLight(mixNight(55, 80, 24), mixNight(85, 68, 34), mixNight(105, 92, 55), 0.5, 0.4, 0.6);

  if (P.glow > 0.04) {
    const pl = constrain((P.glow - 0.04) / 0.96, 0, 1);
    lightFalloff(1, 0.0038, 0.000028);
    pointLight(255 * pl, 208 * pl, (60 + 195 * pl) * pl, P.x, P.y - 4, P.z);
  }
}

function drawLivingPlants() {
  // 溪邊隨水流擺動的水草叢
  for (const r of reeds) {
    const sway = Math.sin(frameCount * 0.032 + r.ph) * 0.22;
    push();
    translate(r.x, 0, r.z);
    for (let b = 0; b < r.blades; b++) {
      const ang = (b / r.blades) * TWO_PI + r.ph;
      const bh = r.h * (0.72 + (b % 3) * 0.16);
      push();
      rotateY(ang);
      rotateZ(0.14 + sway + b * 0.05);
      translate(0, -bh * 0.5, 0);
      fill(44 + r.hue, 118 + r.hue * 1.5, 64);
      beginShape(TRIANGLES);
      vertex(-2.2, bh * 0.5, 0);
      vertex(2.2, bh * 0.5, 0);
      vertex(0, -bh * 0.5, 1.5);
      endShape();
      pop();
    }
    pop();
  }

  // 樹冠垂下的微風氣根藤蔓
  for (const v of vines) {
    const swayX = Math.sin(frameCount * 0.02 + v.ph) * 0.05;
    const swayZ = Math.cos(frameCount * 0.017 + v.ph) * 0.04;
    push();
    translate(v.x, v.topY, v.z);
    rotateZ(swayX);
    rotateX(swayZ);
    translate(0, v.len * 0.5, 0);
    fill(42, 74, 48, 210);
    cylinder(1.6, v.len, 5, 1, false, false);
    pop();
  }
}

function drawForestMist() {
  noLights();
  drawingContext.depthMask(false);
  const sky = skyColor();

  // 遠方地平線霧幕（遮住地面切邊）
  push();
  fill(sky[0], sky[1], sky[2], 215);
  model(horizonGeom);
  pop();

  // 低空飄動的薄霧環
  for (const m of mistBands) {
    const wob = Math.sin(frameCount * 0.015 + m.ph) * 14;
    push();
    translate(wob, m.y, Math.cos(frameCount * 0.012 + m.ph) * 14);
    rotateX(HALF_PI);
    rotateZ(frameCount * m.speed);
    fill(
      mixNight(150, 175, 70),
      mixNight(210, 145, 105),
      mixNight(185, 155, 155),
      mixNight(14, 18, 22)
    );
    torus(m.r, 85, 24, 4);
    pop();
  }
  drawingContext.depthMask(true);
}

function draw() {
  noStroke();
  const t0 = millis();

  const cyc = (millis() * 0.001 / CYCLE) % 1;
  night += ((nightLock !== null ? nightLock : nightCurve(cyc)) - night) * 0.12;

  if (phaseEl && (frameCount % 12 === 0 || frameCount < 3)) {
    phaseEl.textContent = night > 0.75 ? '☾ 星夜苔林' : night > 0.25 ? '◐ 暮色林冠' : '☀ 靜謐晨林';
  }

  yaw += (cam.l - cam.r) * 0.035;
  pitch = constrain(pitch + (cam.d - cam.u) * 0.02, -0.45, 1.35);
  camD = constrain(camD * (1 + (cam.zo - cam.zi) * 0.012), 150, 1200);
  ex = tx + camD * Math.cos(pitch) * Math.sin(yaw);
  ey = min(ty - camD * Math.sin(pitch), -12);
  ez = tz + camD * Math.cos(pitch) * Math.cos(yaw);

  update();
  tx = lerp(tx, P.x, 0.07);
  ty = lerp(ty, P.y, 0.07);
  tz = lerp(tz, P.z, 0.07);

  if (P.qt > 0) shake = max(shake, (P.qt / 40) * 9);
  shake *= 0.93;

  const sky = skyColor();
  background(sky[0], sky[1], sky[2]);

  if (showDebug && fpsEl && (frameCount % 15 === 0 || frameCount < 3)) {
    fpsEl.textContent = Math.round(frameRate()) + ' fps ・ ' + workMs.toFixed(1) + ' ms';
  }
  if (enBar && frameCount % 6 === 0) {
    enBar.style.width = (P.en * 100).toFixed(1) + '%';
    enBar.style.background = P.en < 0.25 ? '#c96a5a' : P.en < 0.6 ? '#ffc46a' : '#f3dba0';
  }

  perspective(PI / 3, width / height, 5, 12000);
  camera(ex + random(-shake, shake), ey + random(-shake, shake), ez, tx, ty, tz, 0, 1, 0);

  lights3();
  drawSun();
  drawMoon();

  // ★ 1. 畫有頂點色的合併幾何（先 fill(255) 確保沒有殘留貼圖，再畫 model）
  fill(255);
  model(farGeom);
  model(moundGeom);
  model(finGeom);
  model(shroomGeom);

  // ★ 2. 畫有貼圖的地面與樹幹（用 push/pop 隔離 texture，不污染其他幾何）
  push();
  rotateX(HALF_PI);
  texture(groundTex);
  plane(4000, 4000);
  pop();

  for (const f of farTrees) {
    const s = f.r / R;
    push();
    translate(f.x, 0, f.z);
    push();
    translate(0, -900, 0);
    texture(barkTex);
    cylinder(f.r, 1800, 12, 1, false, false);
    pop();
    push();
    translate(0, -30 * s, 0);
    texture(barkTex);
    cylinder(f.r + 16 * s, 60 * s, 12, 1, false, false);
    pop();
    pop();
  }

  // 主體巨樹樹幹
  push();
  translate(0, -1100, 0);
  texture(barkTex);
  cylinder(R, 2200, 26, 1, false, false);
  pop();
  push();
  translate(0, -30, 0);
  texture(barkTex);
  cylinder(R + 16, 60, 26, 1, false, false);
  pop();

  // 被古樹板根吞沒的鈦合金科研環遺跡
  push();
  translate(R + 28, -18, 24);
  rotateZ(0.42);
  rotateY(-0.52);
  specularMaterial(210, 225, 245);
  shininess(40);
  fill(160, 178, 198);
  torus(52, 11, 16, 26);
  for (let b = 0; b < 4; b++) {
    push();
    rotateZ(b * HALF_PI);
    translate(52, 0, 0);
    fill(185, 198, 215);
    box(14, 18, 16);
    pop();
  }
  for (let c = 0; c < 3; c++) {
    push();
    translate(-16 + c * 14, 32, -8);
    rotateX(1.15);
    fill(85, 95, 108);
    cylinder(4.5, 65, 8, 1);
    pop();
  }
  fill(45, 105, 50, 225);
  translate(6, -8, 4);
  scale(1.2, 0.6, 1.2);
  sphere(36, 12, 10);
  pop();

  // 會動的水草與垂掛藤蔓
  drawLivingPlants();

  // 樹幹真菌
  const bump = [[0, 0, 1], [-9, 5, 0.7], [8, 6, 0.8], [-5, -8, 0.6], [7, -7, 0.7], [1, 11, 0.5]];
  for (const f of fungi) {
    push();
    translate(Math.cos(f.a) * (R + 1), -f.h, Math.sin(f.a) * (R + 1));
    rotateY(HALF_PI - f.a);
    for (const b of bump) {
      if (f.s > 0.03) {
        push();
        translate(b[0] * f.s, b[1] * f.s, 0);
        scale(1, 1, 0.45);
        fill(185, 150, 200);
        sphere(7 * b[2] * f.s, 10, 8);
        pop();

        push();
        translate(b[0] * f.s, b[1] * f.s, 3.4 * b[2] * f.s);
        fill(235, 150, 90);
        sphere(1.6 * f.s, 6, 5);
        pop();
      }
      if (f.hl > 0.02) {
        push();
        translate(b[0] * 1.2, b[1] * 1.2, 2);
        fill(120, 238, 160);
        sphere(3.6 * b[2] * f.hl * (1 + 0.12 * Math.sin(frameCount * 0.06 + b[0])), 8, 6);
        pop();
      }
    }
    pop();
  }

  // 海玻璃與陶瓷殘留物
  for (const g of glass) {
    push();
    translate(g.x, -0.6, g.z);
    rotateY(g.rot);
    scale(1, g.th, 1);
    if (g.landmark) {
      fill(g.c[0], g.c[1], g.c[2], 235);
      cylinder(g.r, 9, 14, 1, true, true);
      translate(0, -5, 0);
      fill(g.c[0] * 0.75, g.c[1] * 0.75, g.c[2] * 0.75, 245);
      cylinder(g.r * 0.6, 2, 10, 1, true, true);
    } else if (g.kind === 1) {
      fill(g.c[0], g.c[1], g.c[2], 230);
      cylinder(g.r, 5, 10, 1, true, true);
    } else if (g.kind === 2) {
      fill(g.c[0], g.c[1], g.c[2], 245);
      box(g.r * 1.5, 3.8, g.r * 1.2);
    } else {
      fill(g.c[0], g.c[1], g.c[2], 235);
      sphere(g.r, 10, 8);
    }
    pop();
  }

  // 林霧與遠景融合
  drawForestMist();

  // 清溪水流與發光粒子層
  noLights();
  fill(mixNight(38, 46, 10), mixNight(108, 66, 26), mixNight(118, 86, 48), lerp(175, 205, night));
  beginShape(TRIANGLE_STRIP);
  for (let z = -1900; z <= 1900; z += 60) {
    const c = cx(z), h = hw(z);
    vertex(c - h, -1.5, z);
    vertex(c + h, -1.5, z);
  }
  endShape();

  fill(mixNight(120, 96, 78), mixNight(210, 140, 118), mixNight(210, 150, 196), lerp(55, 18, night));
  beginShape(TRIANGLE_STRIP);
  for (let z = -1900; z <= 1900; z += 60) {
    const c = cx(z), h = hw(z) * 0.45;
    vertex(c - h, -2, z);
    vertex(c + h, -2, z);
  }
  endShape();

  for (let k = 0; k < 18; k++) {
    const z = ((k * 131 + frameCount * 1.3) % 3800) - 1900;
    const x = cx(z) + (((k * 37) % 100) - 50) * 1.2;
    push();
    translate(x, -2.6, z);
    rotateX(HALF_PI);
    fill(lerp(225, 212, night), lerp(255, 236, night), 255, lerp(75, 58, night));
    ellipse(0, 0, 6, 26);
    pop();
  }

  for (const d of drops) {
    push();
    translate(...dpos(d));
    const s = d.s * (1 + 0.06 * Math.sin(frameCount * 0.05 + d.ph));
    fill(255, 200, 70, 215);
    sphere((4.5 + 1.6 * night) * s + 0.01, 10, 8);
    translate(-1.2, -1.4, 3);
    fill(255, 255, 255, 200);
    sphere(1.2 * s + 0.01, 6, 5);
    pop();
  }

  drawingContext.depthMask(false);
  blendMode(ADD);

  const sf = sunPos(), mf = 1 - night;
  if (mf > 0.01 && sf.y < 50) {
    const sunH = constrain(-sf.y / 300, 0, 1);
    const rayR = mixNight(255, 255, 160);
    const rayG = mixNight(235, 170, 190);
    const rayB = mixNight(160, 85, 255);
    for (let k = 0; k < 3; k++) {
      push();
      translate(sf.x, -2.8, sf.z);
      rotateX(HALF_PI);
      fill(rayR, rayG, rayB, (18 + k * 8) * mf * sunH);
      ellipse(0, 0, 150 - k * 34, 115 - k * 24);
      pop();
    }
    const shafts = [[sf.x, sf.z, 1], [-260, -380, 0.5], [-420, 260, 0.6], [160, -520, 0.5], [-120, 520, 0.45]];
    for (const s of shafts) {
      push();
      translate(s[0], -550, s[1]);
      rotateY(Math.atan2(ex - s[0], ez - s[1]));
      rotateZ(0.14);
      for (let k = 0; k < 2; k++) {
        fill(rayR, rayG, rayB, 14 * s[2] * mf * sunH);
        plane(56 + k * 74, 1200);
      }
      pop();
    }
  }

  if (night > 0.01) {
    const m = moonPos();
    const mz = constrain(P.z + m.z * 0.25, -1500, 1500);
    const wob = 1 + 0.06 * Math.sin(frameCount * 0.02);
    for (let k = 0; k < 3; k++) {
      push();
      translate(cx(mz), -2.1, mz);
      rotateX(HALF_PI);
      fill(180, 212, 255, (10 - k * 2.5) * night);
      ellipse(0, 0, hw(mz) * (1.1 + k * 0.7) * wob, 1500);
      pop();
    }
    for (const g of glass) {
      const vx = ex - g.x, vy = ey + 0.8, vz = ez - g.z;
      const vl = Math.hypot(vx, vy, vz) || 1;
      const gx = m.x - g.x, gy = m.y + 0.8, gz = m.z - g.z;
      const gl = Math.hypot(gx, gy, gz) || 1;
      const sp = Math.pow(Math.max(0, (vx * gx + vy * gy + vz * gz) / (vl * gl)), 6);
      push();
      translate(g.x, -0.8, g.z);
      fill(g.c[0], g.c[1], g.c[2], 14 * night);
      sphere(g.r, 8, 6);
      if (sp > 0.015) {
        fill(205, 228, 255, 200 * night * sp);
        sphere(g.r * 0.85, 8, 6);
        fill(235, 248, 255, 140 * night * sp);
        sphere(g.r * 0.4, 6, 5);
      }
      pop();
    }
  }

  for (const s of shrooms) {
    push();
    translate(s.x, -1.5, s.z);
    rotateX(HALF_PI);
    fill(110, 230, 210, min(30, 16 * (1 + 0.7 * night)));
    circle(0, 0, s.s * 9);
    pop();
  }
  for (const f of fungi) {
    if (f.hl > 0.05) {
      push();
      translate(...fpos(f));
      fill(150, 255, 170, min(50, 16 * f.hl * (1 + 1.3 * night)));
      sphere(20 + 4 * Math.sin(frameCount * 0.05), 10, 8);
      pop();
    }
  }
  if (night > 0.02) {
    for (const d of drops) {
      const p = dpos(d);
      push();
      translate(...p);
      fill(255, 200, 80, 55 * night * d.s);
      sphere(11 * d.s, 8, 6);
      pop();
    }
  }

  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    s.x += s.vx; s.y += s.vy; s.z += s.vz;
    s.vy += 0.012; s.vx *= 0.97; s.vz *= 0.97; s.life -= 0.014;
    if (s.life <= 0) { sparks.splice(i, 1); continue; }
    push();
    translate(s.x, s.y, s.z);
    fill(s.c[0], s.c[1], s.c[2], 235 * s.life);
    sphere(s.r * s.life, 6, 5);
    pop();
  }

  push();
  stroke(255, 238, 170, 150 + 95 * night);
  strokeWeight(3.4);
  beginShape(POINTS);
  for (const p of spores) {
    p.x += Math.sin(frameCount * 0.01 + p.ph) * 0.25;
    p.y += Math.cos(frameCount * 0.013 + p.ph) * 0.15 - 0.03;
    p.z += Math.cos(frameCount * 0.009 + p.ph) * 0.25;
    if (p.y < -540) p.y = -10;
    if (p.y > -6) p.y = -520;
    vertex(p.x, p.y, p.z);
  }
  endShape();

  strokeWeight(5);
  for (let i = flow.length - 1; i >= 0; i--) {
    const q = flow[i];
    q.x += (P.x - q.x) * 0.1;
    q.y += (P.y - q.y) * 0.1;
    q.z += (P.z - q.z) * 0.1;
    if (Math.hypot(P.x - q.x, P.y - q.y, P.z - q.z) < 12) { flow.splice(i, 1); continue; }
    stroke(q.c[0], q.c[1], q.c[2], 220);
    point(q.x, q.y, q.z);
  }

  noFill();
  strokeWeight(1.8);
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    r.t += 0.02;
    if (r.t > 1) { ripples.splice(i, 1); continue; }
    const col = r.water ? [185, 245, 255] : [165, 250, 195];
    stroke(col[0], col[1], col[2], 210 * (1 - r.t));
    push();
    translate(r.x, -2.8, r.z);
    rotateX(HALF_PI);
    circle(0, 0, 12 + r.t * 88);
    pop();
  }
  pop();

  blendMode(BLEND);
  for (let i = leaves.length - 1; i >= 0; i--) {
    const l = leaves[i];
    l.y += l.vy;
    l.x += Math.sin(frameCount * 0.05 + l.ph) * 0.8;
    if (l.y > -2) { leaves.splice(i, 1); continue; }
    push();
    translate(l.x, l.y, l.z);
    rotateX(frameCount * 0.05 + l.ph);
    rotateZ(frameCount * 0.03 + l.ph);
    fill(l.c[0], l.c[1], l.c[2]);
    plane(12, 6);
    pop();
  }
  drawingContext.depthMask(true);

  lights3();
  drawPippa();
  for (let i = 0; i < companions.length; i++) drawCompanion(companions[i], i);

  workMs = workMs * 0.85 + (millis() - t0) * 0.15;
}

// ============================================================================
// 生物繪製（Step 2 會把 Pippa 與同伴重構為可自訂外觀的 Creature 類別）
// ============================================================================
const LOBES = [
  [0, 0, -11, 12], [-10, -1, -9, 9], [10, 0, -9, 9], [-5, 15, -5, 8],
  [8, 14, -5, 7], [-17, 6, -4, 8], [16, 7, -3, 8.5], [-15, -7, -3, 9],
  [14, -8, -4, 9.5], [0, -16, -4, 9], [0, 0, 0, 13.5]
];
const TINT = [[248, 245, 234], [243, 242, 243], [252, 246, 236], [245, 242, 244]];
const STR = [[-11, -5, -9], [11, -5, -9], [-9, 8, -9], [9, 8, -9]];

function strand(i, u, T, spd) {
  const t = STR[i];
  const sag = (1 - constrain(P.en * 2.5, 0, 1)) * u * u * 24;
  return [
    t[0] * (1 + u * 1.5) + Math.sin(T * 0.1 + u * 5 + i * 1.7) * u * 7 * (0.5 + spd) * (0.4 + 0.6 * constrain(P.en * 2, 0, 1)),
    t[1] * (1 + u * 1.1) + Math.cos(T * 0.08 + u * 4 + i) * u * 6 + u * u * 10 + sag,
    t[2] - u * (1 - P.curl * 0.8) * 50
  ];
}

function drawPippa() {
  const c = P.curl;
  const spd = min(Math.hypot(P.vx, P.vy, P.vz) / 6, 1);
  const T = frameCount;
  const pale = (1 - P.hyd) * 0.5;
  const isExhausted = P.en < 0.12;
  const flick = P.en <= 0.05 ? 0 : P.en < 0.25 ? constrain(0.35 + 0.65 * Math.sin(T * 0.35), 0, 1) : 1;
  const g = constrain(P.glow * flick, 0, 1);
  const happy = P.react > 0;
  const bounce = happy ? 1 + 0.22 * Math.sin((72 - P.react) * 0.45) * (P.react / 72) : 1;

  push();
  translate(P.x, P.y, P.z);
  rotateY(P.yaw);
  rotateX(P.pit);
  rotateZ(P.roll + (P.spin > 0 ? (1 - P.spin / 48) * TWO_PI : 0));

  const breatheFreq = isExhausted ? 0.025 : 0.05;
  const breatheAmp = isExhausted ? 0.018 : 0.04;
  scale(
    bounce * (0.9 + 0.1 * P.hyd) * (1 - 0.2 * c) * (1 + 0.05 * Math.sin(T * 0.9) * c),
    bounce * (0.9 + 0.1 * P.hyd) * (1 - 0.2 * c) * (1 + breatheAmp * Math.sin(T * breatheFreq)),
    bounce * (1 - 0.2 * c) * (1 + 0.06 * spd)
  );

  for (let i = 0; i < 4; i++) {
    for (let k = 1; k < 5; k++) {
      push();
      translate(...strand(i, k / 5, T, spd));
      fill(246, 244, 236, 242);
      sphere(0.75, 5, 4);
      pop();
    }
    const e = strand(i, 1, T, spd);
    push();
    translate(...e);
    if (g > 0.05) {
      emissiveMaterial(255 * g, 215 * g, 120 * g);
      fill(255, 235, 170);
    } else {
      fill(128, 138, 144, 185);
    }
    sphere(2.8, 10, 8);
    pop();
    if (g > 0.12) {
      push();
      translate(...e);
      fill(255, 230, 150, 50 * g);
      sphere(6 + 1.5 * Math.sin(T * 0.07 + i), 10, 8);
      pop();
    }
  }

  drawingContext.depthMask(false);
  LOBES.forEach((l, i) => {
    const t = TINT[i % 4];
    const r = l[3] * (1 + 0.05 * Math.sin(T * 0.05 + i * 1.3));
    const m = 1 - c * 0.5;
    push();
    translate(l[0] * m + Math.sin(T * 0.03 + i) * 0.8, l[1] * m + Math.cos(T * 0.025 + i * 2) * 0.8, l[2] * m);
    fill(
      lerp(lerp(t[0], 252, pale), 255, night * 0.5),
      lerp(lerp(t[1], 252, pale), 240, night * 0.5),
      lerp(lerp(t[2], 252, pale), 206, night * 0.5),
      153 + 32 * night
    );
    sphere(r, 18, 13);
    pop();
  });

  if (night > 0.25) {
    blendMode(ADD);
    push(); translate(-4, 15, -2); scale(1, 0.5, 0.6); fill(170, 200, 255, 26 * night); sphere(7.2, 12, 10); pop();
    push(); translate(9, 12, 3); scale(0.9, 0.45, 0.6); fill(150, 185, 255, 17 * night); sphere(5.6, 10, 8); pop();
    blendMode(BLEND);
  }

  if (P.treatT > 0) {
    blendMode(ADD);
    const trP = 1 - P.treatT / 48;
    push();
    rotateX(HALF_PI);
    stroke(140, 255, 190, 160 * (1 - trP));
    strokeWeight(2.5);
    noFill();
    circle(0, 0, 22 + trP * 65);
    pop();
    noStroke();
    blendMode(BLEND);
  }

  const isShocked = P.qt > 0;
  const isHealing = P.treatT > 0;
  const blinkCycle = T % 240;
  const blink = (blinkCycle < 7) || (blinkCycle > 15 && blinkCycle < 21 && (T % 480 < 240));
  const lookX = constrain(P.vx * 0.12, -0.6, 0.6);
  const lookY = constrain(P.vy * 0.12, -0.5, 0.5);

  for (const s of [-1, 1]) {
    push();
    translate(s * 4.4 + lookX * 0.3, -1 + lookY * 0.3, 11.9);
    if (happy) {
      rotateZ(s * -0.22); scale(1.35, 0.28, 1); fill(36, 40, 50); sphere(1.3, 8, 6);
    } else if (isShocked) {
      rotateZ(s * 0.35); scale(1.25, 0.18, 1); fill(36, 40, 50); sphere(1.2, 8, 6);
    } else if (P.en <= 0.05) {
      rotateZ(s * 0.15); scale(1.15, 0.1, 1); fill(45, 50, 58); sphere(1.15, 6, 4);
    } else if (blink || P.en < 0.25) {
      scale(1.25, P.en < 0.25 ? 0.38 : 0.18, 1); fill(36, 40, 50); sphere(1.25, 8, 6);
    } else {
      scale(1.05, 1.2, 1); fill(32, 36, 46); sphere(1.28, 10, 8);
      if (P.en > 0.08) {
        push();
        translate(s * 0.38 + lookX * 0.4, -0.42 + lookY * 0.4, 0.98);
        fill(isHealing ? 160 : 255, 255, isHealing ? 210 : 255, 245);
        sphere(0.42, 6, 5);
        pop();
        push();
        translate(-s * 0.25 + lookX * 0.2, 0.38 + lookY * 0.2, 0.9);
        fill(255, 255, 255, 185);
        sphere(0.24, 5, 4);
        pop();
      }
    }
    pop();

    push();
    translate(s * 8.4, 3.2, 8.8);
    const blushScale = happy ? (1.4 + 0.12 * Math.sin(T * 0.3)) : isShocked ? 0.78 : (1 + 0.04 * Math.sin(T * 0.06));
    const blushAlpha = isShocked ? 110 : happy ? 245 : (175 + 40 * constrain(P.en * 2, 0, 1));
    scale(blushScale, 0.65 * blushScale, 0.35);
    fill(255, happy ? 135 : 155, 175, blushAlpha);
    sphere(3, 8, 6);
    pop();
  }

  push();
  translate(0, 4.2 + (isShocked ? -0.4 : 0), 12.8);
  if (happy) {
    scale(1.8, 1.35, 0.45); fill(235, 105, 130); sphere(1.15, 8, 6);
  } else if (isShocked) {
    scale(1.1, 1.25, 0.5); fill(195, 95, 115); sphere(0.9, 8, 6);
  } else if (P.treatT > 0) {
    const sip = 1 + 0.25 * Math.sin(T * 0.4);
    scale(1.4 * sip, 0.8 * sip, 0.4); fill(225, 120, 145); sphere(0.95, 6, 5);
  } else if (P.en <= 0.05) {
    scale(1.3, 0.35, 0.3); fill(180, 110, 125); sphere(0.85, 6, 5);
  } else {
    const breath = 1 + 0.05 * Math.sin(T * 0.08);
    scale(1.5 * breath, 0.55 * breath, 0.4); fill(220, 120, 140); sphere(1, 6, 5);
  }
  pop();

  const gr = 1 + 0.06 * Math.sin(T * (isExhausted ? 0.025 : 0.07));
  push();
  if (g <= 0.04) {
    fill(108, 118, 125, 95);
    sphere(0.18 * gr, 6, 4);
  } else {
    emissiveMaterial(lerp(210, 255, g) * g, lerp(80, 206, g) * g, lerp(40, 110, g) * g);
    fill(lerp(120, 255, g), lerp(130, 232, g), lerp(140, 186, g), 38);
    sphere(0.15 * gr, 6, 4);
    blendMode(ADD);
    if (g > 0.08) { const l1 = constrain((g - 0.08) / 0.35, 0, 1); fill(255, 222, 134, 175 * l1); sphere(2.0 * gr * l1, 8, 6); }
    if (g > 0.25) { const l2 = constrain((g - 0.25) / 0.35, 0, 1); fill(255, 204, 96, 95 * l2); sphere(3.6 * gr * l2, 10, 8); }
    if (g > 0.45) { const l3 = constrain((g - 0.45) / 0.35, 0, 1); fill(255, 186, 66, 48 * l3); sphere(5.8 * gr * l3, 10, 8); }
    if (g > 0.70) { const l4 = constrain((g - 0.70) / 0.30, 0, 1); fill(255, 170, 48, 20 * l4); sphere(8.6 * gr * l4, 12, 10); }
    blendMode(BLEND);
  }
  pop();
  drawingContext.depthMask(true);
  pop();
}

function drawCompanion(c, idx) {
  const spd = min(Math.hypot(c.vx, c.vy, c.vz) / 5, 1);
  const T = frameCount;
  const isShocked = P.qt > 0;
  const happy = c.react > 0;
  const g = constrain(c.glow, 0, 1);

  push();
  translate(c.x, c.y, c.z);
  rotateY(c.yaw);
  rotateX(c.pit);
  rotateZ(c.roll);
  scale(
    c.s * (1 - 0.2 * c.curl),
    c.s * (1 - 0.2 * c.curl) * (1 + 0.04 * Math.sin(T * 0.07 + c.ph)),
    c.s * (1 - 0.2 * c.curl) * (1 + 0.05 * spd)
  );

  for (let i = 0; i < 4; i++) {
    const t = STR[i];
    for (let k = 1; k < 4; k++) {
      push();
      translate(t[0] * (1 + k * 0.4) + Math.sin(T * 0.1 + k * 3 + i) * k * 2, t[1] * (1 + k * 0.3) + Math.cos(T * 0.09 + k * 2) * k * 2 + k * k * 3, t[2] - k * 11);
      fill(246, 244, 236, 235);
      sphere(0.6, 5, 4);
      pop();
    }
    push();
    translate(t[0] * 2.2 + Math.sin(T * 0.12 + i) * 6, t[1] * 1.8 + Math.cos(T * 0.1 + i) * 5 + 22, t[2] - 36);
    emissiveMaterial(c.c[0] * g, c.c[1] * g, c.c[2] * g);
    fill(255, 245, 215);
    sphere(2, 8, 6);
    pop();
  }

  drawingContext.depthMask(false);
  LOBES.forEach((l, i) => {
    const t = TINT[i % 4];
    const r = l[3] * 0.95 * (1 + 0.04 * Math.sin(T * 0.05 + i));
    const m = 1 - c.curl * 0.5;
    push();
    translate(l[0] * m, l[1] * m, l[2] * m);
    fill(t[0], t[1], t[2], 145 + 25 * night);
    sphere(r, 14, 10);
    pop();
  });

  const blink = (T + idx * 40) % 210 < 6;
  for (const s of [-1, 1]) {
    push();
    translate(s * 4.2, -0.8, 11.5);
    if (happy) scale(1.3, 0.28, 1);
    else if (isShocked) scale(1.2, 0.18, 1);
    else if (blink) scale(1.2, 0.2, 1);
    else scale(1.05, 1.18, 1);
    fill(36, 40, 50);
    sphere(1.15, 8, 6);
    if (!isShocked && !blink) {
      push(); translate(s * 0.32, -0.38, 0.88); fill(255, 255, 255, 240); sphere(0.36, 5, 4); pop();
    }
    pop();
    push();
    translate(s * 7.8, 3, 8.5);
    scale(happy ? 1.3 : 1, 0.65, 0.35);
    fill(255, 160, 180, happy ? 240 : 170);
    sphere(2.6, 8, 6);
    pop();
  }

  push();
  translate(0, 3.8, 12.2);
  scale(1.3, happy ? 1.2 : 0.6, 0.4);
  fill(225, 120, 140);
  sphere(0.85, 6, 5);
  pop();

  const gr = 1 + 0.06 * Math.sin(T * 0.08 + c.ph);
  push();
  emissiveMaterial(c.c[0] * g, c.c[1] * g, c.c[2] * g);
  fill(c.c[0], c.c[1], c.c[2], 42);
  sphere(0.16 * gr, 6, 4);
  if (g > 0.1) {
    blendMode(ADD);
    fill(c.c[0], c.c[1], c.c[2], 150 * g); sphere(1.8 * gr, 8, 6);
    fill(c.c[0], c.c[1], c.c[2], 70 * g); sphere(3.4 * gr, 10, 8);
    blendMode(BLEND);
  }
  pop();
  drawingContext.depthMask(true);
  pop();
}

// ============================================================================
// 鍵盤、滑鼠、觸控事件
// ============================================================================
function keyPressed() {
  if (key === 'n' || key === 'N') { cycleNightMode(); return false; }
  if (key === 'm' || key === 'M') { hoverFly = !hoverFly; return false; }
  if (key === 'f' || key === 'F') { toggleFace(); return false; }
  if (key === 'q' || key === 'Q') { quake(); return false; }
  if (key === 'i' || key === 'I') {
    showDebug = !showDebug;
    if (fpsEl) fpsEl.classList.toggle('show', showDebug);
    return false;
  }
  if (key === 'r' || key === 'R') {
    P.x = HOME.x; P.y = HOME.y; P.z = HOME.z;
    P.vx = P.vy = P.vz = 0;
    return false;
  }
  if (keyCode === 32 || (keyCode >= 37 && keyCode <= 40)) return false;
}

let tPrev = null;
function lookStart(ev) {
  if (isUI(ev)) return;
  moved = 0;
  pressF = frameCount;
  pressing = true;
  return false;
}
function lookDrag() {
  yaw -= (mouseX - pmouseX) * 0.006;
  pitch = constrain(pitch + (mouseY - pmouseY) * 0.006, -0.45, 1.35);
  moved += Math.abs(mouseX - pmouseX) + Math.abs(mouseY - pmouseY);
}
function lookTap(sx, sy) {
  pressing = false;
  if (moved < 6 && frameCount - pressF <= 12) {
    if (pippaHit(sx, sy)) {
      reactToPet();
    } else {
      const f = fungusHit(sx, sy);
      if (f) feedFungus(f);
      else tapGroundOrWater(sx, sy);
    }
  }
}

function mousePressed(ev) { lookStart(ev); }
function mouseDragged(ev) { if (isUI(ev)) return; lookDrag(); return false; }
function mouseReleased(ev) { if (isUI(ev)) return; lookTap(); }

function touchStarted(ev) {
  if (isUI(ev)) return;
  const t = ev.touches && ev.touches[0];
  if (!t) return;
  tPrev = { x: t.clientX, y: t.clientY };
  return lookStart();
}
function touchMoved(ev) {
  if (isUI(ev)) return false;
  const t = ev.touches && ev.touches[0];
  if (!t || !tPrev) return false;
  yaw -= (t.clientX - tPrev.x) * 0.006;
  pitch = constrain(pitch + (t.clientY - tPrev.y) * 0.006, -0.45, 1.35);
  moved += Math.abs(t.clientX - tPrev.x) + Math.abs(t.clientY - tPrev.y);
  tPrev = { x: t.clientX, y: t.clientY };
  return false;
}
function touchEnded(ev) {
  if (isUI(ev)) return false;
  const t = ev.changedTouches && ev.changedTouches[0];
  tPrev = null;
  lookTap(t ? t.clientX : null, t ? t.clientY : null);
  return false;
}
function mouseWheel(e) {
  camD = constrain(camD * Math.exp(e.delta * 0.001), 150, 1200);
  return false;
}
function windowResized() {
  resizeCanvas(innerWidth, innerHeight);
}
