// ============================================================================
// 晶靈樹醫的森林 — M4 Step 2：平等的 Creature 類別＋自由觀察視角＋效能優化
// ============================================================================

const R = 120;      // 母樹樹幹半徑
const H0 = 210;     // 母樹板根起始高度
const OUT = 255;    // 板根向外延伸半徑

const NIGHT0 = /night/.test(location.search);
const DUSK0  = /dusk/.test(location.search);
const SHOT   = /shot/.test(location.search);
const CYCLE  = 90;
const START  = DUSK0 ? 0.5 : NIGHT0 ? 1 : 0;

let night = START;
let nightLock = (NIGHT0 || DUSK0) ? START : null;

// 個性定義表（Step 3 生物設計工坊會直接沿用這組個性）
const TRAITS = {
  guide:   { label: '活潑領航', desc: '喜歡沿著清溪與林間巡遊，會帶動附近同伴一起滑翔' },
  sleepy:  { label: '慵懶愛睡', desc: '喜歡縮在樹根陰影打盹，被同伴靠近叫醒時會伸懶腰' },
  curious: { label: '好奇親人', desc: '看見附近有生物就會主動飛過去打招呼、繞圈觀察' },
  healer:  { label: '溫柔樹醫', desc: '特別照顧真菌與虛弱的同伴，會主動分享核心微光' },
  shy:     { label: '害羞內向', desc: '有人靠太近會悄悄退後躲起來，安靜時會吐出微光泡泡' }
};

// 生物外觀基礎幾何常數
const LOBES = [
  [0, 0, -11, 12], [-10, -1, -9, 9], [10, 0, -9, 9], [-5, 15, -5, 8],
  [8, 14, -5, 7], [-17, 6, -4, 8], [16, 7, -3, 8.5], [-15, -7, -3, 9],
  [14, -8, -4, 9.5], [0, -16, -4, 9], [0, 0, 0, 13.5]
];
const STR = [[-11, -5, -9], [11, -5, -9], [-9, 8, -9], [9, 8, -9]];

// DOM 元素參照
const phaseEl   = document.getElementById('phase');
const fpsEl     = document.getElementById('fps');
const obsNameEl = document.getElementById('obsName');
const obsTraitEl = document.getElementById('obsTrait');
const obsMetaEl = document.getElementById('obsMeta');
const enWrapEl  = document.getElementById('energyWrap');
const enBar     = document.querySelector('#energy i');
const followBtn = document.getElementById('followBtn');
const nextBtn   = document.getElementById('nextBtn');
const faceBtn   = document.getElementById('faceBtn');
const nightBtn  = document.getElementById('nightBtn');

// 視角與觀察狀態（預設自由漫遊森林，沒有單一主角綁定）
let yaw = 0.68, pitch = 0.24, camD = 390;
let tx = 180, ty = -105, tz = 90;
let ex = 0, ey = 0, ez = 0;
let shake = 0, moved = 0, pressF = 0;
let hoverFly = false, pressing = false, padDrag = null;
let faceCam = false, showDebug = false, workMs = 0;
let selectedId = null;
let followMode = false;
let globalQuakeT = 0;

// 貼圖與靜態合併幾何
let barkTex, groundTex;
let finGeom, farGeom, moundGeom, shroomGeom, glassGeom, horizonGeom;

// 世界物件
const finAngs = [], gaps = [], mounds = [], shrooms = [], farTrees = [];
const spores = [], leaves = [], fungi = [], drops = [], flow = [], ripples = [], sparks = [];
const glass = [], reeds = [], vines = [], mistBands = [];
const creatures = [];

const cx = (z) => 420 + 60 * Math.sin(z * 0.004);
const hw = (z) => 88 + 14 * Math.sin(z * 0.011);
const fh = (t) => H0 * Math.pow(1 - t, 1.85);
const fpos = (f) => [Math.cos(f.a) * (R + 4), -f.h, Math.sin(f.a) * (R + 4)];
const dpos = (d) => [Math.cos(d.a) * (R + 3), -d.h, Math.sin(d.a) * (R + 3)];

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
// UI 控制函式
// ============================================================================
function getSelectedCreature() {
  return creatures.find((c) => c.id === selectedId) || null;
}

function refreshObserverUI() {
  const sel = getSelectedCreature();
  if (!sel) {
    if (obsNameEl) obsNameEl.textContent = '自由漫遊森林';
    if (obsTraitEl) obsTraitEl.textContent = `共 ${creatures.length} 隻棲居者`;
    if (obsMetaEl) obsMetaEl.textContent = 'WASD 自由飛覽；點擊任一生物可接管操控牠';
    if (enWrapEl) enWrapEl.style.display = 'none';
    if (followBtn) {
      followBtn.textContent = '操控生物';
      followBtn.classList.remove('on');
    }
    return;
  }

  const traitInfo = TRAITS[sel.trait] || TRAITS.curious;
  if (obsNameEl) obsNameEl.textContent = `操控中：${sel.name}`;
  if (obsTraitEl) obsTraitEl.textContent = traitInfo.label;
  if (obsMetaEl) obsMetaEl.textContent = `設計者：${sel.creator} ・ 目前完全由你操控（WASD 移動・放開後才恢復自主生活）`;
  if (enWrapEl) enWrapEl.style.display = 'flex';
  if (enBar) {
    enBar.style.width = (sel.en * 100).toFixed(1) + '%';
    enBar.style.background = sel.en < 0.25 ? '#c96a5a' : sel.en < 0.6 ? '#ffc46a' : `rgb(${sel.coreColor.join(',')})`;
  }
  if (followBtn) {
    followBtn.textContent = '放開（自由飛）';
    followBtn.classList.add('on');
  }
}

function selectCreature(c) {
  selectedId = c ? c.id : null;
  followMode = !!c;
  refreshObserverUI();
}

function cycleNextCreature() {
  if (creatures.length === 0) return;
  const idx = creatures.findIndex((c) => c.id === selectedId);
  const next = creatures[(idx + 1) % creatures.length];
  selectCreature(next);
}

function toggleFollow() {
  const sel = getSelectedCreature();
  if (!sel) {
    if (creatures.length > 0) selectCreature(creatures[0]);
    return;
  }
  selectCreature(null);
}

function toggleFace() {
  faceCam = !faceCam;
  if (faceBtn) {
    faceBtn.classList.toggle('on', faceCam);
    faceBtn.textContent = faceCam ? '取消直視' : '正面看牠';
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

if (followBtn) followBtn.addEventListener('click', toggleFollow);
if (nextBtn) nextBtn.addEventListener('click', cycleNextCreature);
if (faceBtn) faceBtn.addEventListener('click', toggleFace);
if (nightBtn) nightBtn.addEventListener('click', cycleNightMode);

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
  return [mixNight(24, 54, 8), mixNight(46, 38, 13), mixNight(42, 46, 25)];
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
  sphere(42, 16, 12);
  drawingContext.depthMask(false);
  blendMode(ADD);
  rotateY(Math.atan2(ex - s.x, ez - s.z));
  for (let k = 0; k < 10; k++) {
    const rr = 42 + k * 12;
    fill(255, lerp(225, 140, night * 2), 80, lerp(22, 6, night) * (1 - k / 10) * fade);
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
  sphere(46, 16, 12);
  drawingContext.depthMask(false);
  blendMode(ADD);
  rotateY(Math.atan2(ex - m.x, ez - m.z));
  for (let k = 0; k < 14; k++) {
    const rr = 46 + k * 8;
    fill(150, 188, 255, 5.5 * fade * (1 - k / 14));
    circle(0, 0, rr * 2);
  }
  blendMode(BLEND);
  drawingContext.depthMask(true);
  pop();
  lights3();
}

// ============================================================================
// 物件導向生物類別：Creature（每隻生物平等獨立，擁有外觀、發光與個性）
// ============================================================================
class Creature {
  constructor(cfg) {
    this.id = cfg.id;
    this.name = cfg.name;
    this.creator = cfg.creator || '原始森林';
    this.bodyColor = cfg.bodyColor || [246, 244, 236];
    this.coreColor = cfg.coreColor || [255, 210, 110];
    this.glowPower = cfg.glowPower != null ? cfg.glowPower : 1.0;
    this.size = cfg.size != null ? cfg.size : 0.85;
    this.trait = cfg.trait || 'curious';

    this.home = cfg.home ? { ...cfg.home } : { x: 220, y: -110, z: 100 };
    this.x = cfg.x != null ? cfg.x : this.home.x;
    this.y = cfg.y != null ? cfg.y : this.home.y;
    this.z = cfg.z != null ? cfg.z : this.home.z;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;

    this.yaw = random(TWO_PI);
    this.pit = 0;
    this.roll = 0;

    this.en = cfg.en != null ? cfg.en : 0.72;
    this.hyd = 1.0;
    this.glow = this.trait === 'sleepy' ? 0.15 : 0.6;
    this.curl = this.trait === 'sleepy' ? 0.6 : 0;

    this.react = 0;
    this.spin = 0;
    this.treatT = 0;
    this.pets = 0;
    this.petT = -999;
    this.greetT = 0;
    this.ph = random(TWO_PI);
    this.wanderAng = random(TWO_PI);
  }

  // 互動者輕撫生物
  pet() {
    this.react = 72;
    this.glow = min(1.3, this.glowPower + 0.3);
    this.pets = (frameCount - this.petT < 80) ? this.pets + 1 : 1;
    this.petT = frameCount;
    if (this.pets >= 3) {
      this.pets = 0;
      this.spin = 48;
      this.en = min(1, this.en + 0.05);
      for (let i = 0; i < 14; i++) {
        const a = random(TWO_PI), s = random(1, 2.3);
        sparks.push({
          x: this.x, y: this.y, z: this.z,
          vx: Math.cos(a) * s, vy: random(-2, -0.4), vz: Math.sin(a) * s,
          life: 1, r: random(1.5, 2.8), c: [...this.coreColor]
        });
      }
    }
    for (let i = 0; i < 16; i++) {
      const a = random(TWO_PI), s = random(0.6, 1.8);
      sparks.push({
        x: this.x + random(-6, 6), y: this.y + random(-6, 6), z: this.z + random(-6, 6),
        vx: Math.cos(a) * s, vy: random(-1.5, -0.2), vz: Math.sin(a) * s,
        life: 1, r: random(1.2, 2.4),
        c: random() < 0.5 ? [...this.coreColor] : [220, 250, 235]
      });
    }
  }

  update(all, isManual, guideVec) {
    // 能量緩慢消耗
    const speedNow = Math.hypot(this.vx, this.vy, this.vz);
    this.en = max(0, this.en - (0.00003 + min(8, speedNow) * 0.000008));
    const vigor = 0.38 + 0.62 * min(1, this.en * 2);

    // 1. 地震防禦狀態
    if (globalQuakeT > 0) {
      this.curl = min(1, this.curl + 0.22);
      this.vx *= 0.85; this.vy *= 0.85; this.vz *= 0.85;
    } else if (isManual) {
      // 2. 被選取時：完全人為操控（停下自主亂跑，沒有按鍵就乖乖原地懸浮等待）
      this.curl = max(0, this.curl - 0.06);
      if (guideVec) {
        const fl = Math.hypot(tx - ex, tz - ez) || 1;
        const fx = (tx - ex) / fl, fz = (tz - ez) / fl;
        this.vx += (fx * guideVec.z - fz * guideVec.x) * 0.85 * vigor;
        this.vz += (fz * guideVec.z + fx * guideVec.x) * 0.85 * vigor;
        this.vy += guideVec.y * 0.78 * vigor;
        this.vx *= 0.94; this.vy *= 0.94; this.vz *= 0.94;
        this.home = { x: this.x, y: this.y, z: this.z };
      } else {
        this.vx *= 0.84;
        this.vy *= 0.84;
        this.vz *= 0.84;
      }
    } else {
      // 3. 自主生命本能（依各自個性與生態需求行動）
      let ax = 0, ay = 0, az = 0;

      // 尋覓鄰近同伴（社交互動）
      let nearest = null, nearestD = 1e9;
      for (const other of all) {
        if (other === this) continue;
        const dx = other.x - this.x;
        const dy = other.y - this.y;
        const dz = other.z - this.z;
        const d = Math.hypot(dx, dy, dz) || 1;
        if (d < nearestD) { nearestD = d; nearest = other; }
        // 柔軟防重疊推力（Separation）
        if (d < 54) {
          const pushF = (54 - d) * 0.015;
          ax -= (dx / d) * pushF;
          ay -= (dy / d) * pushF;
          az -= (dz / d) * pushF;
        }
      }

      // 能量低時優先尋找最近真菌進食
      if (this.en < 0.28) {
        this.curl = max(0, this.curl - 0.04);
        let bestP = null, bd = 1e9;
        for (const f of fungi) {
          if (f.s < 0.15) continue;
          const p = fpos(f);
          const dd = Math.hypot(p[0] - this.x, p[1] - this.y, p[2] - this.z);
          if (dd < bd) { bd = dd; bestP = p; }
        }
        if (bestP) {
          const d = Math.hypot(bestP[0] - this.x, bestP[1] - this.y, bestP[2] - this.z) || 1;
          ax += ((bestP[0] - this.x) / d) * 0.42;
          ay += ((bestP[1] - this.y) / d) * 0.42;
          az += ((bestP[2] - this.z) / d) * 0.42;
        }
      } else {
        // 依個性展現獨特行為
        this.wanderAng += Math.sin(frameCount * 0.015 + this.ph) * 0.04;
        const roamX = this.home.x + Math.cos(this.wanderAng) * 110;
        const roamZ = this.home.z + Math.sin(this.wanderAng) * 110;
        const roamY = this.home.y + Math.sin(frameCount * 0.025 + this.ph) * 28;

        if (this.trait === 'sleepy') {
          if (nearest && nearestD < 105) {
            // 被同伴靠近叫醒，伸懶腰發亮打招呼
            this.curl = max(0, this.curl - 0.07);
            if (this.greetT <= 0) {
              this.greetT = 90;
              this.react = 60;
              this.vy -= 1.8;
              sparks.push({ x: this.x, y: this.y, z: this.z, vx: 0, vy: -1.2, vz: 0, life: 1, r: 2.2, c: [...this.coreColor] });
            }
          } else {
            // 平常喜歡回到樹根窩打瞌睡
            this.curl = lerp(this.curl, 0.55 + night * 0.25, 0.03);
            ax += (this.home.x - this.x) * 0.004;
            ay += (this.home.y - this.y) * 0.004;
            az += (this.home.z - this.z) * 0.004;
          }
        } else if (this.trait === 'curious') {
          this.curl = max(0, this.curl - 0.04);
          if (nearest && nearestD < 260 && nearestD > 68) {
            // 主動靠近同伴打招呼
            ax += ((nearest.x - this.x) / nearestD) * 0.24;
            ay += ((nearest.y - this.y) / nearestD) * 0.2;
            az += ((nearest.z - this.z) / nearestD) * 0.24;
            if (nearestD < 105 && frameCount % 90 === 0) {
              this.react = 42;
              flow.push({ x: this.x, y: this.y, z: this.z, target: nearest, c: [...this.coreColor] });
            }
          } else {
            ax += (roamX - this.x) * 0.0035;
            ay += (roamY - this.y) * 0.004;
            az += (roamZ - this.z) * 0.0035;
          }
        } else if (this.trait === 'shy') {
          this.curl = max(0, this.curl - 0.04);
          if (nearest && nearestD < 115) {
            // 害羞往外躲開一點，並吐出光泡
            ax -= ((nearest.x - this.x) / nearestD) * 0.26;
            az -= ((nearest.z - this.z) / nearestD) * 0.26;
            if (frameCount % 55 === 0) {
              sparks.push({ x: this.x, y: this.y, z: this.z, vx: random(-0.4, 0.4), vy: -0.7, vz: random(-0.4, 0.4), life: 1.1, r: 2.1, c: [...this.coreColor] });
            }
          } else {
            ax += (roamX - this.x) * 0.003;
            ay += (roamY - this.y) * 0.0035;
            az += (roamZ - this.z) * 0.003;
          }
        } else if (this.trait === 'healer') {
          this.curl = max(0, this.curl - 0.04);
          // 優先去幫虛弱的同伴分擔光點
          const needy = all.find((o) => o !== this && o.en < 0.45);
          if (needy) {
            const dx = needy.x - this.x, dy = needy.y - this.y, dz = needy.z - this.z;
            const d = Math.hypot(dx, dy, dz) || 1;
            if (d > 65) {
              ax += (dx / d) * 0.26;
              ay += (dy / d) * 0.22;
              az += (dz / d) * 0.26;
            } else if (frameCount % 8 === 0) {
              this.treatT = 36;
              needy.en = min(1, needy.en + 0.015);
              flow.push({ x: this.x, y: this.y, z: this.z, target: needy, c: [140, 255, 185] });
            }
          } else {
            ax += (roamX - this.x) * 0.0035;
            ay += (roamY - this.y) * 0.004;
            az += (roamZ - this.z) * 0.0035;
          }
        } else {
          // guide：沿著清溪與林間巡遊領航
          this.curl = max(0, this.curl - 0.04);
          const streamZ = Math.sin(frameCount * 0.005 + this.ph) * 320;
          const gx = cx(streamZ) + Math.cos(frameCount * 0.012 + this.ph) * 90;
          const gy = -85 + Math.sin(frameCount * 0.02 + this.ph) * 45;
          ax += (gx - this.x) * 0.0035;
          ay += (gy - this.y) * 0.004;
          az += (streamZ - this.z) * 0.0035;
          if (nearest && nearestD < 130) {
            // 與附近夥伴同步節奏（Alignment）
            ax += (nearest.vx - this.vx) * 0.04;
            az += (nearest.vz - this.vz) * 0.04;
          }
        }
      }

      this.vx = (this.vx + ax * vigor) * 0.94;
      this.vy = (this.vy + ay * vigor) * 0.94;
      this.vz = (this.vz + az * vigor) * 0.94;
    }

    // 速度上限與漂浮位移
    const maxSpd = (isManual ? 8.2 : 4.2) * vigor;
    const sp = Math.hypot(this.vx, this.vy, this.vz);
    if (sp > maxSpd) {
      this.vx *= maxSpd / sp;
      this.vy *= maxSpd / sp;
      this.vz *= maxSpd / sp;
    }

    const bobAmp = this.en <= 0.05 ? 0.03 : (0.06 + 0.1 * min(1, this.en * 2));
    this.x += this.vx;
    this.y += this.vy + Math.sin(frameCount * 0.05 + this.ph) * bobAmp;
    this.z += this.vz;

    // 樹木與邊界碰撞
    const r = Math.hypot(this.x, this.z);
    if (r < R + 28) {
      this.x *= (R + 28) / r;
      this.z *= (R + 28) / r;
    }
    for (const f of farTrees) {
      const dx = this.x - f.x, dz = this.z - f.z;
      const dd = Math.hypot(dx, dz);
      if (dd < f.r + 24) {
        this.x = f.x + (dx / dd) * (f.r + 24);
        this.z = f.z + (dz / dd) * (f.r + 24);
      }
    }
    this.y = constrain(this.y, -920, -18 - groundY(this.x, this.z));
    this.x = constrain(this.x, -1350, 1350);
    this.z = constrain(this.z, -1350, 1350);

    // 朝向姿態
    if (faceCam && this.id === selectedId) {
      const dx = ex - this.x, dy = ey - this.y, dz = ez - this.z;
      const dl = Math.hypot(dx, dy, dz) || 1;
      this.yaw += angDiff(Math.atan2(dx, dz), this.yaw) * 0.08;
      this.pit = lerp(this.pit, -Math.asin(constrain(dy / dl, -1, 1)), 0.08);
      this.roll *= 0.9;
    } else {
      const hsp = Math.hypot(this.vx, this.vz);
      if (hsp > 0.22) {
        const tYaw = Math.atan2(this.vx, this.vz);
        const dYaw = angDiff(tYaw, this.yaw);
        this.yaw += dYaw * 0.09;
        this.roll = lerp(this.roll, constrain(dYaw * 2.0, -0.5, 0.5), 0.1);
      } else {
        this.roll *= 0.9;
      }
      this.pit = lerp(this.pit, constrain(-this.vy * 0.1, -0.5, 0.5), 0.1);
    }

    if (this.react > 0) this.react--;
    if (this.spin > 0) this.spin--;
    if (this.treatT > 0) this.treatT--;
    if (this.greetT > 0) this.greetT--;

    // 發光復甦與自然取食
    let targetGlow = this.en > 0.05 ? Math.pow((this.en - 0.05) / 0.95, 1.2) * this.glowPower : 0;
    if (this.trait === 'sleepy' && this.curl > 0.4) targetGlow *= 0.3;
    if (this.react > 0) targetGlow = min(1.3, targetGlow + (this.react / 72) * 0.35);
    this.glow = lerp(this.glow, targetGlow, 0.05);
    this.hyd = max(0, this.hyd - 0.00018);

    if (this.curl < 0.35) {
      for (const f of fungi) {
        const p = fpos(f);
        if (f.s > 0.08 && Math.hypot(this.x - p[0], this.y - p[1], this.z - p[2]) < 90) {
          f.s -= 0.005;
          f.hl = min(1, f.hl + 0.01);
          this.en = min(1, this.en + 0.0028);
          if (frameCount % 3 === 0) flow.push({ x: p[0], y: p[1], z: p[2], target: this, c: [175, 245, 195] });
        }
      }
      for (const d of drops) {
        const p = dpos(d);
        if (d.s > 0.25 && Math.hypot(this.x - p[0], this.y - p[1], this.z - p[2]) < 75) {
          d.s -= 0.01;
          this.en = min(1, this.en + 0.004);
          this.hyd = min(1, this.hyd + 0.005);
          if (frameCount % 3 === 0) flow.push({ x: p[0], y: p[1], z: p[2], target: this, c: [255, 205, 80] });
        }
      }
      if (this.y > -34 && Math.abs(this.x - cx(this.z)) < hw(this.z) + 10) {
        this.hyd = min(1, this.hyd + 0.008);
        if (frameCount % 20 === 0) ripples.push({ x: this.x, z: this.z, t: 0, water: true });
      }
    }
  }

  strandPos(i, u, T, spd) {
    const t = STR[i];
    const sag = (1 - constrain(this.en * 2.5, 0, 1)) * u * u * 22;
    return [
      t[0] * (1 + u * 1.45) + Math.sin(T * 0.1 + u * 5 + i * 1.7 + this.ph) * u * 6.5 * (0.5 + spd),
      t[1] * (1 + u * 1.1) + Math.cos(T * 0.08 + u * 4 + i) * u * 5.5 + u * u * 9 + sag,
      t[2] - u * (1 - this.curl * 0.8) * 46
    ];
  }

  render() {
    const c = this.curl;
    const spd = min(Math.hypot(this.vx, this.vy, this.vz) / 6, 1);
    const T = frameCount;
    const isExhausted = this.en < 0.12;
    const flick = this.en <= 0.05 ? 0 : this.en < 0.25 ? constrain(0.35 + 0.65 * Math.sin(T * 0.35), 0, 1) : 1;
    const g = constrain(this.glow * flick, 0, 1.3);
    const happy = this.react > 0;
    const bounce = happy ? 1 + 0.2 * Math.sin((72 - this.react) * 0.45) * (this.react / 72) : 1;
    const isSel = this.id === selectedId;

    push();
    translate(this.x, this.y, this.z);

    // 被選中觀察時，腳下淡淡的識別光圈
    if (isSel) {
      push();
      rotateX(HALF_PI);
      noFill();
      stroke(this.coreColor[0], this.coreColor[1], this.coreColor[2], 145);
      strokeWeight(1.8);
      circle(0, 0, 44 * this.size + Math.sin(T * 0.08) * 3);
      noStroke();
      pop();
    }

    rotateY(this.yaw);
    rotateX(this.pit);
    rotateZ(this.roll + (this.spin > 0 ? (1 - this.spin / 48) * TWO_PI : 0));

    const breatheAmp = isExhausted ? 0.018 : 0.04;
    const sc = this.size * bounce * (1 - 0.2 * c);
    scale(
      sc * (1 + 0.04 * Math.sin(T * 0.9) * c),
      sc * (1 + breatheAmp * Math.sin(T * 0.05 + this.ph)),
      sc * (1 + 0.06 * spd)
    );

    // 觸鬚尾巴（從 4 顆精簡為 3 顆維持 60fps）
    const bc = this.bodyColor;
    const cc = this.coreColor;
    for (let i = 0; i < 4; i++) {
      for (let k = 1; k < 4; k++) {
        push();
        translate(...this.strandPos(i, k / 4, T, spd));
        fill(bc[0], bc[1], bc[2], 235);
        sphere(0.75, 4, 4);
        pop();
      }
      const endP = this.strandPos(i, 1, T, spd);
      push();
      translate(...endP);
      if (g > 0.05) {
        emissiveMaterial(cc[0] * g, cc[1] * g, cc[2] * g);
        fill(cc[0], cc[1], cc[2]);
      } else {
        fill(128, 138, 144, 185);
      }
      sphere(2.6, 6, 5);
      pop();
    }

    // 半透明雲霧身體
    drawingContext.depthMask(false);
    for (let i = 0; i < LOBES.length; i++) {
      const l = LOBES[i];
      const v = (i % 4) * 3 - 4;
      const r = l[3] * (1 + 0.045 * Math.sin(T * 0.05 + i * 1.3 + this.ph));
      const m = 1 - c * 0.5;
      push();
      translate(
        l[0] * m + Math.sin(T * 0.03 + i) * 0.7,
        l[1] * m + Math.cos(T * 0.025 + i * 2) * 0.7,
        l[2] * m
      );
      fill(
        constrain(bc[0] + v, 0, 255),
        constrain(bc[1] + v, 0, 255),
        constrain(bc[2] + v, 0, 255),
        150 + 28 * night
      );
      sphere(r, 11, 8);
      pop();
    }

    // 治療波紋
    if (this.treatT > 0) {
      blendMode(ADD);
      const trP = 1 - this.treatT / 36;
      push();
      rotateX(HALF_PI);
      stroke(140, 255, 190, 150 * (1 - trP));
      strokeWeight(2.2);
      noFill();
      circle(0, 0, 22 + trP * 58);
      pop();
      noStroke();
      blendMode(BLEND);
    }

    // 表情（雙眼高光、腮紅、嘴巴）
    const isShocked = globalQuakeT > 0;
    const blink = ((T + this.id * 37) % 230) < 7;
    const lookX = constrain(this.vx * 0.12, -0.5, 0.5);
    const lookY = constrain(this.vy * 0.12, -0.4, 0.4);

    for (const s of [-1, 1]) {
      push();
      translate(s * 4.4 + lookX * 0.3, -1 + lookY * 0.3, 11.9);
      if (happy) {
        rotateZ(s * -0.22); scale(1.35, 0.28, 1); fill(36, 40, 50); sphere(1.25, 6, 5);
      } else if (isShocked) {
        rotateZ(s * 0.35); scale(1.25, 0.18, 1); fill(36, 40, 50); sphere(1.2, 6, 5);
      } else if (this.en <= 0.05 || (this.trait === 'sleepy' && c > 0.35)) {
        rotateZ(s * 0.15); scale(1.15, 0.12, 1); fill(45, 50, 58); sphere(1.15, 5, 4);
      } else if (blink || this.en < 0.25) {
        scale(1.2, this.en < 0.25 ? 0.36 : 0.18, 1); fill(36, 40, 50); sphere(1.2, 6, 5);
      } else {
        scale(1.05, 1.2, 1); fill(32, 36, 46); sphere(1.24, 7, 6);
        if (this.en > 0.08) {
          push();
          translate(s * 0.36 + lookX * 0.35, -0.4 + lookY * 0.35, 0.94);
          fill(255, 255, 255, 240);
          sphere(0.4, 5, 4);
          pop();
        }
      }
      pop();

      push();
      translate(s * 8.2, 3.1, 8.6);
      scale(happy ? 1.35 : 1, 0.65, 0.35);
      fill(255, happy ? 135 : 155, 175, happy ? 240 : 170);
      sphere(2.8, 6, 5);
      pop();
    }

    push();
    translate(0, 4.1, 12.6);
    if (happy) { scale(1.7, 1.3, 0.45); fill(235, 105, 130); sphere(1.1, 6, 5); }
    else if (isShocked) { scale(1.1, 1.2, 0.5); fill(195, 95, 115); sphere(0.9, 6, 5); }
    else { scale(1.4, 0.55, 0.4); fill(220, 120, 140); sphere(0.95, 5, 4); }
    pop();

    // 正中心發光核心＋層層光暈
    const gr = 1 + 0.06 * Math.sin(T * 0.07 + this.ph);
    push();
    if (g <= 0.04) {
      fill(108, 118, 125, 95);
      sphere(0.18 * gr, 5, 4);
    } else {
      emissiveMaterial(cc[0] * g, cc[1] * g, cc[2] * g);
      fill(cc[0], cc[1], cc[2], 42);
      sphere(0.15 * gr, 5, 4);
      blendMode(ADD);
      if (g > 0.08) { const l1 = constrain((g - 0.08) / 0.35, 0, 1); fill(cc[0], cc[1], cc[2], 165 * l1); sphere(2.0 * gr * l1, 7, 5); }
      if (g > 0.28) { const l2 = constrain((g - 0.28) / 0.35, 0, 1); fill(cc[0], cc[1], cc[2], 85 * l2); sphere(3.8 * gr * l2, 7, 5); }
      if (g > 0.55) { const l3 = constrain((g - 0.55) / 0.35, 0, 1); fill(cc[0], cc[1], cc[2], 40 * l3); sphere(6.2 * gr * l3, 8, 6); }
      blendMode(BLEND);
    }
    pop();

    drawingContext.depthMask(true);
    pop();
  }
}

// ============================================================================
// 初始化 setup()
// ============================================================================
function setup() {
  createCanvas(innerWidth, innerHeight, WEBGL);
  pixelDensity(min(1.25, devicePixelRatio)); // 兼顧清晰度與高幀率效能
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

  while (mounds.length < 30) {
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

  while (shrooms.length < 22) {
    const x = random(-950, 950);
    const z = random(-950, 950);
    if (Math.hypot(x, z) > 265 && okFromStream(x, z)) {
      shrooms.push({ x, z, s: random(3, 7.5) });
    }
  }

  const glassCols = [
    [100, 230, 175], [235, 155, 65], [70, 140, 245],
    [235, 245, 240], [245, 242, 232], [210, 115, 82]
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

  for (let i = 0; i < 40; i++) {
    const z = random(-1050, 1050);
    const side = i % 2 === 0 ? -1 : 1;
    const x = cx(z) + side * (hw(z) * random(0.82, 1.15));
    reeds.push({ x, z, blades: floor(random(3, 5)), h: random(18, 40), ph: random(TWO_PI), hue: random(-10, 15) });
  }

  for (let i = 0; i < 18; i++) {
    const ang = random(TWO_PI);
    const dist = i < 9 ? random(R + 40, R + 170) : random(320, 750);
    const vx = Math.cos(ang) * dist;
    const vz = Math.sin(ang) * dist;
    if (Math.abs(vx - cx(vz)) < hw(vz) + 25) continue;
    vines.push({ x: vx, z: vz, topY: random(-820, -640), len: random(220, 420), ph: random(TWO_PI) });
  }

  for (let i = 0; i < 2; i++) {
    mistBands.push({ r: 520 + i * 320, y: -18 - i * 24, speed: (i % 2 === 0 ? 1 : -1) * 0.001, ph: random(TWO_PI) });
  }

  while (farTrees.length < 12) {
    const a = random(TWO_PI);
    const d = random(640, 1620);
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (Math.abs(x - cx(z)) < 175) continue;
    farTrees.push({ x, z, r: random(85, 165), f: constrain(d / 1800, 0, 1) });
  }

  for (let i = 0; i < 7; i++) fungi.push({ a: random(gaps) + random(-0.08, 0.08), h: random(55, 420), s: 1, hl: 0 });
  for (let i = 0; i < 9; i++) drops.push({ a: random(gaps) + random(-0.08, 0.08), h: random(60, 420), s: 1, ph: random(6) });
  for (let i = 0; i < 100; i++) spores.push({ x: random(-850, 850), y: random(-540, -10), z: random(-850, 850), s: random(2, 5), ph: random(6) });

  // ★ 初始 5 位平等棲居森林的生物（不再區分主角與配角）
  const initialSeeds = [
    { id: 1, name: '皮皮 Pippa', creator: '原始森林', bodyColor: [248, 245, 234], coreColor: [255, 206, 110], glowPower: 1.0, size: 0.95, trait: 'curious', home: { x: 255, y: -125, z: 110 } },
    { id: 2, name: '暮暮', creator: '原始森林', bodyColor: [242, 236, 224], coreColor: [255, 185, 90],  glowPower: 0.85, size: 0.78, trait: 'sleepy',  home: { x: -145, y: -65, z: -155 } },
    { id: 3, name: '瀾瀾', creator: '原始森林', bodyColor: [232, 246, 250], coreColor: [110, 215, 255], glowPower: 1.0, size: 0.80, trait: 'guide',   home: { x: cx(240), y: -38, z: 240 } },
    { id: 4, name: '苗苗', creator: '原始森林', bodyColor: [236, 248, 238], coreColor: [115, 245, 165], glowPower: 0.95, size: 0.74, trait: 'healer',  home: { x: Math.cos(PI * 0.75) * (R + 36), y: -185, z: Math.sin(PI * 0.75) * (R + 36) } },
    { id: 5, name: '幽幽', creator: '原始森林', bodyColor: [244, 240, 248], coreColor: [235, 215, 255], glowPower: 0.85, size: 0.68, trait: 'shy',     home: { x: R + 75, y: -32, z: 50 } }
  ];
  for (const cfg of initialSeeds) creatures.push(new Creature(cfg));

  // ★ 合併所有靜態幾何（包含海玻璃與地平線剪影），大幅降低每幀繪製次數
  noStroke();
  finGeom = buildGeometry(buildMainFins);
  finGeom.computeNormals();

  farGeom = buildGeometry(buildFarFins);
  farGeom.computeNormals();

  moundGeom = buildGeometry(buildMounds);
  shroomGeom = buildGeometry(buildShrooms);
  glassGeom = buildGeometry(buildGlass);
  horizonGeom = buildGeometry(buildHorizonRing);

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

  refreshObserverUI();
}

// ============================================================================
// 貼圖與靜態合併幾何建構
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
      let r = 56 + n * 58, gg = 40 + n * 38, b = 30 + n * 26;
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
    const x = random(256), y = random(512);
    g.line(x, y, x + random(-3, 3), y + random(24, 80));
  }
  return g;
}

function makeGround() {
  const g = createGraphics(512, 512);
  g.pixelDensity(1);
  g.noStroke();
  g.background(24, 46, 42);
  for (let i = 0; i < 5800; i++) {
    const x = random(512), y = random(512);
    const n = noise(x * 0.013, y * 0.013);
    const edgeFade = constrain((dist(x, y, 256, 256) / 256 - 0.50) * 2.1, 0, 1);
    g.fill(lerp(28 + n * 34, 24, edgeFade), lerp(66 + n * 74, 46, edgeFade), lerp(44 + n * 26, 42, edgeFade), 205);
    g.circle(x, y, random(5, 14));
  }
  for (let i = 0; i < 650; i++) {
    const x = random(512), y = random(512);
    if (dist(x, y, 256, 256) > 210) continue;
    g.fill(155, 215, 138, 95);
    g.circle(x, y, random(1.4, 2.8));
  }
  for (let py = 0; py < 512; py += 2) {
    const wx = cx((py / 512) * 4000 - 2000);
    g.fill(18, 36, 34, 175);
    g.circle(((wx + 2000) / 4000) * 512, py, 36);
  }
  return g;
}

function addOrganicFin(rInner, rOuter, hStart, baseW, curveAmp, fogFactor, seedOffset) {
  const segs = 12;
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
  const colBark = (t) => [lerp(82, 54, t * 0.85) * f, lerp(56, 98, t * 0.85) * f, lerp(40, 48, t * 0.85) * f];
  const colMoss = (t) => [lerp(62, 56, t) * f, lerp(122, 112, t) * f, lerp(56, 54, t) * f];

  beginShape(TRIANGLES);
  for (let i = 0; i < segs; i++) {
    const a = pts[i], b = pts[i + 1];
    const cBa = colBark(a.t), cBb = colBark(b.t), cMa = colMoss(a.t), cMb = colMoss(b.t);

    fill(...cBa); vertex(a.x, 1, a.zc - a.wb);
    fill(...cBb); vertex(b.x, 1, b.zc - b.wb);
    fill(...cMb); vertex(b.x, -b.h, b.zc - b.wt);

    fill(...cBa); vertex(a.x, 1, a.zc - a.wb);
    fill(...cMb); vertex(b.x, -b.h, b.zc - b.wt);
    fill(...cMa); vertex(a.x, -a.h, a.zc - a.wt);

    fill(...cBa); vertex(a.x, 1, a.zc + a.wb);
    fill(...cMa); vertex(a.x, -a.h, a.zc + a.wt);
    fill(...cMb); vertex(b.x, -b.h, b.zc + b.wt);

    fill(...cBa); vertex(a.x, 1, a.zc + a.wb);
    fill(...cMb); vertex(b.x, -b.h, b.zc + b.wt);
    fill(...cBb); vertex(b.x, 1, b.zc + b.wb);

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
    push();
    rotateY(-finAngs[idx]);
    addOrganicFin(R - 14, OUT + 10, H0, 22, (idx % 2 === 0 ? 1 : -1) * 14, 1.0, idx * 0.9);
    pop();
  }
}

function buildFarFins() {
  for (const f of farTrees) {
    const s = f.r / R, h0 = H0 * s, o = f.r + (OUT - R) * s, fog = 1 - f.f * 0.72;
    push();
    translate(f.x, 0, f.z);
    const a0 = f.x * 0.013 + f.z * 0.007;
    for (let k = 0; k < 5; k++) {
      push();
      rotateY(a0 + (k * TWO_PI) / 5);
      addOrganicFin(f.r - 12 * s, o, h0, 20 * s, (k % 2 === 0 ? 1 : -1) * 10 * s, fog, k * 1.1);
      pop();
    }
    pop();
  }
}

function buildMounds() {
  for (const m of mounds) {
    push();
    translate(m.x, 2, m.z);
    rotateY(m.x * 0.01);
    scale(1.15, m.h, 0.92);
    fill(m.c[0] * 0.8, m.c[1] * 0.85, m.c[2] * 0.85);
    sphere(m.r, 10, 7);
    pop();

    push();
    translate(m.x + m.r * 0.18, 0, m.z - m.r * 0.12);
    scale(0.85, m.h * 1.15, 0.85);
    fill(m.c[0], m.c[1], m.c[2]);
    sphere(m.r * 0.72, 9, 6);
    pop();
  }
}

function buildShrooms() {
  for (const s of shrooms) {
    push();
    translate(s.x, 0, s.z);
    fill(190, 208, 198);
    translate(0, -s.s * 0.9, 0);
    cylinder(s.s * 0.26, s.s * 1.8, 5, 1);
    translate(0, -s.s * 0.9, 0);
    scale(1.1, 0.55, 1.1);
    fill(110, 225, 205);
    sphere(s.s, 7, 5);
    pop();
  }
}

function buildGlass() {
  for (const g of glass) {
    push();
    translate(g.x, -0.6, g.z);
    rotateY(g.rot);
    scale(1, g.th, 1);
    if (g.landmark) {
      fill(g.c[0], g.c[1], g.c[2], 235);
      cylinder(g.r, 9, 12, 1, true, true);
      translate(0, -5, 0);
      fill(g.c[0] * 0.75, g.c[1] * 0.75, g.c[2] * 0.75, 245);
      cylinder(g.r * 0.6, 2, 10, 1, true, true);
    } else if (g.kind === 1) {
      fill(g.c[0], g.c[1], g.c[2], 230);
      cylinder(g.r, 5, 8, 1, true, true);
    } else if (g.kind === 2) {
      fill(g.c[0], g.c[1], g.c[2], 245);
      box(g.r * 1.5, 3.8, g.r * 1.2);
    } else {
      fill(g.c[0], g.c[1], g.c[2], 235);
      sphere(g.r, 8, 6);
    }
    pop();
  }
}

function buildHorizonRing() {
  const segs = 24;
  const rad = 1880;
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * TWO_PI;
    const h = 480 + ((i * 137) % 280);
    push();
    translate(Math.cos(a) * rad, -h * 0.45, Math.sin(a) * rad);
    rotateY(-a + HALF_PI);
    fill(18, 38, 35);
    plane(520, h);
    pop();
  }
}

// ============================================================================
// 指標射線與世界互動
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

function creatureHit(sx, sy) {
  const ray = screenRay(sx, sy);
  let best = null, bd = 1e9;
  for (const c of creatures) {
    const ox = c.x - ex, oy = c.y - ey, oz = c.z - ez;
    const t = ox * ray.x + oy * ray.y + oz * ray.z;
    if (t <= 0) continue;
    const dd = Math.hypot(c.x - (ex + ray.x * t), c.y - (ey + ray.y * t), c.z - (ez + ray.z * t));
    if (dd < 30 * c.size && dd < bd) {
      bd = dd;
      best = c;
    }
  }
  return best;
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

function tapGroundOrWater(sx, sy) {
  const ray = screenRay(sx, sy);
  if (ray.y <= 0.03) return;
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

function feedFungus(f) {
  f.hl = 1;
  f.s = max(0.05, f.s - 0.35);
  const p = fpos(f);
  // 找最近的一隻生物（或目前觀察的生物）前來吸取甘露共鳴
  let receiver = getSelectedCreature();
  if (!receiver && creatures.length > 0) {
    receiver = creatures.reduce((a, b) =>
      Math.hypot(a.x - p[0], a.y - p[1], a.z - p[2]) < Math.hypot(b.x - p[0], b.y - p[1], b.z - p[2]) ? a : b
    );
  }
  if (receiver) {
    receiver.en = min(1, receiver.en + 0.18);
    receiver.react = 65;
    receiver.treatT = 36;
  }
  for (let i = 0; i < 14; i++) {
    flow.push({ x: p[0] + random(-14, 14), y: p[1] + random(-14, 14), z: p[2], target: receiver, c: random() < 0.5 ? [255, 215, 90] : [160, 255, 180] });
  }
}

function quake() {
  globalQuakeT = 55;
  shake = 12;
  for (let i = 0; i < 20; i++) {
    leaves.push({
      x: tx + random(-450, 450), y: random(-950, -300), z: tz + random(-450, 450),
      vy: random(0.8, 1.8), ph: random(6), c: random() < 0.6 ? [90, 150, 70] : [210, 170, 70]
    });
  }
}

// ============================================================================
// 每幀邏輯與植物批次繪製
// ============================================================================
function updateWorld() {
  if (globalQuakeT > 0) globalQuakeT--;

  // 鍵盤方向輸入（自由模式移動觀察鏡頭；跟隨模式引導該生物）
  let ix = 0, iz = 0, iy = 0;
  if (keyIsDown(87)) iz += 1;
  if (keyIsDown(83)) iz -= 1;
  if (keyIsDown(65) || keyIsDown(LEFT_ARROW)) ix -= 1;
  if (keyIsDown(68) || keyIsDown(RIGHT_ARROW)) ix += 1;
  if (keyIsDown(UP_ARROW) || keyIsDown(32)) iy -= 1;
  if (keyIsDown(DOWN_ARROW) || keyIsDown(SHIFT)) iy += 1;
  const hasKb = !!(ix || iz || iy);

  const sel = getSelectedCreature();
  const guideVec = hasKb ? { x: ix, y: iy, z: iz } : null;

  for (const c of creatures) {
    const isManual = sel === c;
    c.update(creatures, isManual, guideVec);
  }

  // 更新菌叢與蜜露再生
  for (const f of fungi) {
    f.s = min(1, f.s + 0.0003);
    if (f.s > 0.5) f.hl = max(0, f.hl - 0.0004);
  }
  for (const d of drops) {
    d.s = min(1, d.s + 0.0012);
  }

  // 鏡頭追蹤邏輯：跟隨模式鎖定選中生物；自由模式由 WASD 自由滑翔觀察
  if (followMode && sel) {
    tx = lerp(tx, sel.x, 0.08);
    ty = lerp(ty, sel.y, 0.08);
    tz = lerp(tz, sel.z, 0.08);
  } else if (hasKb) {
    const fl = Math.hypot(tx - ex, tz - ez) || 1;
    const fx = (tx - ex) / fl, fz = (tz - ez) / fl;
    tx = constrain(tx + (fx * iz - fz * ix) * 7.5, -1200, 1200);
    tz = constrain(tz + (fz * iz + fx * ix) * 7.5, -1200, 1200);
    ty = constrain(ty + iy * 6.0, -780, -18);
  }
}

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

  // 由目前被觀察的生物或最亮的一隻生物提供局部溫暖點光源
  const lit = getSelectedCreature() || creatures[0];
  if (lit && lit.glow > 0.06) {
    const pl = constrain(lit.glow, 0, 1);
    lightFalloff(1, 0.0038, 0.000028);
    pointLight(lit.coreColor[0] * pl, lit.coreColor[1] * pl, lit.coreColor[2] * pl, lit.x, lit.y - 4, lit.z);
  }
}

// ★ 效能優化：全部水草與藤蔓各用單一次 beginShape(TRIANGLES) 畫完，不再呼叫 200 次獨立幾何！
function drawLivingPlantsBatched() {
  // 1. 溪邊水草（1 次繪製呼叫）
  beginShape(TRIANGLES);
  for (const r of reeds) {
    const sway = Math.sin(frameCount * 0.032 + r.ph) * 5.5;
    for (let b = 0; b < r.blades; b++) {
      const ang = (b / r.blades) * TWO_PI + r.ph;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const bh = r.h * (0.72 + (b % 3) * 0.16);
      const w = 2.4;
      fill(44 + r.hue, 118 + r.hue * 1.4, 64);
      vertex(r.x - sa * w, 0, r.z + ca * w);
      vertex(r.x + sa * w, 0, r.z - ca * w);
      fill(66 + r.hue, 148 + r.hue * 1.4, 78);
      vertex(r.x + ca * 4 + sway, -bh, r.z + sa * 4 + sway * 0.4);
    }
  }
  endShape();

  // 2. 樹冠藤蔓（1 次繪製呼叫）
  beginShape(TRIANGLES);
  for (const v of vines) {
    const sx = Math.sin(frameCount * 0.02 + v.ph) * 14;
    const sz = Math.cos(frameCount * 0.017 + v.ph) * 10;
    const y0 = v.topY;
    const y1 = v.topY + v.len;
    fill(38, 68, 44);
    vertex(v.x - 1.8, y0, v.z);
    vertex(v.x + 1.8, y0, v.z);
    fill(54, 96, 56);
    vertex(v.x + sx, y1, v.z + sz);
  }
  endShape();
}

function drawForestMist() {
  noLights();
  const sky = skyColor();

  // 遠景地平線剪影（不透明，不吃像素重疊效能）
  push();
  fill(sky[0] * 0.85, sky[1] * 0.9, sky[2] * 0.92);
  model(horizonGeom);
  pop();

  drawingContext.depthMask(false);
  for (const m of mistBands) {
    const wob = Math.sin(frameCount * 0.015 + m.ph) * 12;
    push();
    translate(wob, m.y, Math.cos(frameCount * 0.012 + m.ph) * 12);
    rotateX(HALF_PI);
    rotateZ(frameCount * m.speed);
    fill(
      mixNight(150, 175, 70),
      mixNight(210, 145, 105),
      mixNight(185, 155, 155),
      mixNight(13, 17, 20)
    );
    torus(m.r, 75, 16, 4);
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

  updateWorld();

  ex = tx + camD * Math.cos(pitch) * Math.sin(yaw);
  ey = min(ty - camD * Math.sin(pitch), -12);
  ez = tz + camD * Math.cos(pitch) * Math.cos(yaw);

  if (globalQuakeT > 0) shake = max(shake, (globalQuakeT / 40) * 9);
  shake *= 0.93;

  const sky = skyColor();
  background(sky[0], sky[1], sky[2]);

  if (showDebug && fpsEl && (frameCount % 15 === 0 || frameCount < 3)) {
    fpsEl.textContent = Math.round(frameRate()) + ' fps ・ ' + workMs.toFixed(1) + ' ms';
  }
  if (frameCount % 10 === 0 && getSelectedCreature()) {
    refreshObserverUI();
  }

  perspective(PI / 3, width / height, 5, 12000);
  camera(ex + random(-shake, shake), ey + random(-shake, shake), ez, tx, ty, tz, 0, 1, 0);

  lights3();
  drawSun();
  drawMoon();

  // ★ 1. 靜態合併幾何（fill(255) 清空殘留貼圖，保留頂點漸層色）
  fill(255);
  model(farGeom);
  model(moundGeom);
  model(finGeom);
  model(shroomGeom);
  model(glassGeom);

  // ★ 2. 貼圖地面與樹幹（用 push/pop 隔離 texture）
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
    cylinder(f.r, 1800, 9, 1, false, false);
    pop();
    push();
    translate(0, -30 * s, 0);
    texture(barkTex);
    cylinder(f.r + 16 * s, 60 * s, 9, 1, false, false);
    pop();
    pop();
  }

  push();
  translate(0, -1100, 0);
  texture(barkTex);
  cylinder(R, 2200, 22, 1, false, false);
  pop();
  push();
  translate(0, -30, 0);
  texture(barkTex);
  cylinder(R + 16, 60, 22, 1, false, false);
  pop();

  // 鈦合金科研環遺跡
  push();
  translate(R + 28, -18, 24);
  rotateZ(0.42);
  rotateY(-0.52);
  specularMaterial(210, 225, 245);
  shininess(40);
  fill(160, 178, 198);
  torus(52, 11, 12, 22);
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
    cylinder(4.5, 65, 7, 1);
    pop();
  }
  fill(45, 105, 50, 225);
  translate(6, -8, 4);
  scale(1.2, 0.6, 1.2);
  sphere(36, 10, 8);
  pop();

  drawLivingPlantsBatched();

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
        sphere(7 * b[2] * f.s, 7, 5);
        pop();
        push();
        translate(b[0] * f.s, b[1] * f.s, 3.4 * b[2] * f.s);
        fill(235, 150, 90);
        sphere(1.6 * f.s, 5, 4);
        pop();
      }
      if (f.hl > 0.02) {
        push();
        translate(b[0] * 1.2, b[1] * 1.2, 2);
        fill(120, 238, 160);
        sphere(3.6 * b[2] * f.hl * (1 + 0.12 * Math.sin(frameCount * 0.06 + b[0])), 6, 4);
        pop();
      }
    }
    pop();
  }

  drawForestMist();

  // 清溪水流與發光粒子
  noLights();
  fill(mixNight(38, 46, 10), mixNight(108, 66, 26), mixNight(118, 86, 48), lerp(175, 205, night));
  beginShape(TRIANGLE_STRIP);
  for (let z = -1900; z <= 1900; z += 80) {
    const c = cx(z), h = hw(z);
    vertex(c - h, -1.5, z);
    vertex(c + h, -1.5, z);
  }
  endShape();

  fill(mixNight(120, 96, 78), mixNight(210, 140, 118), mixNight(210, 150, 196), lerp(55, 18, night));
  beginShape(TRIANGLE_STRIP);
  for (let z = -1900; z <= 1900; z += 80) {
    const c = cx(z), h = hw(z) * 0.45;
    vertex(c - h, -2, z);
    vertex(c + h, -2, z);
  }
  endShape();

  for (let k = 0; k < 14; k++) {
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
    sphere((4.5 + 1.6 * night) * s + 0.01, 7, 5);
    pop();
  }

  drawingContext.depthMask(false);
  blendMode(ADD);

  const sf = sunPos(), mf = 1 - night;
  if (mf > 0.01 && sf.y < 50) {
    const sunH = constrain(-sf.y / 300, 0, 1);
    const rayR = mixNight(255, 255, 160), rayG = mixNight(235, 170, 190), rayB = mixNight(160, 85, 255);
    const shafts = [[sf.x, sf.z, 1], [-260, -380, 0.5], [-420, 260, 0.6], [160, -520, 0.5]];
    for (const s of shafts) {
      push();
      translate(s[0], -550, s[1]);
      rotateY(Math.atan2(ex - s[0], ez - s[1]));
      rotateZ(0.14);
      fill(rayR, rayG, rayB, 14 * s[2] * mf * sunH);
      plane(90, 1200);
      pop();
    }
  }

  if (night > 0.01) {
    const m = moonPos();
    const mz = constrain(tz + m.z * 0.25, -1500, 1500);
    const wob = 1 + 0.06 * Math.sin(frameCount * 0.02);
    for (let k = 0; k < 2; k++) {
      push();
      translate(cx(mz), -2.1, mz);
      rotateX(HALF_PI);
      fill(180, 212, 255, (10 - k * 3) * night);
      ellipse(0, 0, hw(mz) * (1.2 + k * 0.8) * wob, 1500);
      pop();
    }
    // 夜間僅對地標海玻璃與近處玻璃做高光反光計算，避免過度繪製
    for (let i = 0; i < glass.length; i++) {
      const g = glass[i];
      if (!g.landmark && i % 2 !== 0) continue;
      const vx = ex - g.x, vy = ey + 0.8, vz = ez - g.z;
      const vl = Math.hypot(vx, vy, vz) || 1;
      const gx = m.x - g.x, gy = m.y + 0.8, gz = m.z - g.z;
      const gl = Math.hypot(gx, gy, gz) || 1;
      const sp = Math.pow(Math.max(0, (vx * gx + vy * gy + vz * gz) / (vl * gl)), 6);
      if (sp > 0.02) {
        push();
        translate(g.x, -0.8, g.z);
        fill(205, 228, 255, 190 * night * sp);
        sphere(g.r * 0.85, 6, 5);
        pop();
      }
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
      sphere(20 + 4 * Math.sin(frameCount * 0.05), 7, 5);
      pop();
    }
  }

  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    s.x += s.vx; s.y += s.vy; s.z += s.vz;
    s.vy += 0.012; s.vx *= 0.97; s.vz *= 0.97; s.life -= 0.016;
    if (s.life <= 0) { sparks.splice(i, 1); continue; }
    push();
    translate(s.x, s.y, s.z);
    fill(s.c[0], s.c[1], s.c[2], 235 * s.life);
    sphere(s.r * s.life, 5, 4);
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
    const tgt = q.target || creatures[0];
    if (!tgt) { flow.splice(i, 1); continue; }
    q.x += (tgt.x - q.x) * 0.11;
    q.y += (tgt.y - q.y) * 0.11;
    q.z += (tgt.z - q.z) * 0.11;
    if (Math.hypot(tgt.x - q.x, tgt.y - q.y, tgt.z - q.z) < 12) { flow.splice(i, 1); continue; }
    stroke(q.c[0], q.c[1], q.c[2], 220);
    point(q.x, q.y, q.z);
  }

  noFill();
  strokeWeight(1.8);
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    r.t += 0.022;
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
  for (const c of creatures) c.render();

  workMs = workMs * 0.85 + (millis() - t0) * 0.15;
}

// ============================================================================
// 鍵盤、滑鼠、觸控操作
// ============================================================================
function keyPressed() {
  if (key === 'n' || key === 'N') { cycleNightMode(); return false; }
  if (key === 'f' || key === 'F') { toggleFace(); return false; }
  if (key === 'q' || key === 'Q') { quake(); return false; }
  if (key === 'i' || key === 'I') {
    showDebug = !showDebug;
    if (fpsEl) fpsEl.classList.toggle('show', showDebug);
    return false;
  }
  if (keyCode === TAB) { cycleNextCreature(); return false; }
  if (keyCode === ESCAPE) { selectCreature(null); return false; }
  if (key === 'r' || key === 'R') {
    selectCreature(null);
    tx = 180; ty = -105; tz = 90; yaw = 0.68; pitch = 0.24; camD = 390;
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
    const hitC = creatureHit(sx, sy);
    if (hitC) {
      hitC.pet();
      selectCreature(hitC);
    } else {
      const f = fungusHit(sx, sy);
      if (f) feedFungus(f);
      else tapGroundOrWater(sx, sy);
    }
  }
}

function doubleClicked(ev) {
  if (isUI(ev)) return;
  const hitC = creatureHit();
  if (hitC) selectCreature(hitC);
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
