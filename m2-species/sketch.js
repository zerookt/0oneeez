// ==============================================================
// M2 物種雛形：晶靈露露（Lulu / 露生水滴精靈）- 3D 全景版
// 特色：3D 輕柔果凍水滴、不似鳥類、軟萌依偎神木、互利共生
// ==============================================================

let lulu;             // 3D 角色本體
let sunDust = [];     // 3D 森林游移光塵
let loveSparks = [];  // 依偎親近神木時散發的治癒微光

function setup() {
  createCanvas(800, 600, WEBGL);

  // 1. 初始化 3D 角色（位於神木板根旁）
  lulu = new DewSpirit(-125, 10, 40);

  // 2. 初始化 3D 空間中漂浮的金色光斑與光塵（木漏れ日）
  for (let i = 0; i < 40; i++) {
    sunDust.push(new SunParticle());
  }
}

function draw() {
  // 深林底色（深邃翠綠）
  background(20, 32, 26);

  // 一、3D 全域光照系統（營造立體果凍光澤與深林氛圍）
  ambientLight(70, 95, 85);

  // 穿透林冠的溫暖陽光（來自右上方）
  directionalLight(255, 245, 215, 0.4, 0.7, -0.6);

  // 露露體內散發的柔和治癒冷光
  pointLight(160, 255, 230, lulu.x, lulu.y, lulu.z + 50);

  // 依據滑鼠位置微幅旋轉鏡頭（帶來強烈 3D 空間景深感）
  let camRotY = map(mouseX, 0, width, -0.22, 0.22);
  let camRotX = map(mouseY, 0, height, 0.18, -0.18);
  rotateY(camRotY);
  rotateX(camRotX);

  // 二、繪製 3D 世界環境
  draw3DTree();   // 左側古老神木與樹洞
  draw3DStream(); // 右下方緩流清溪與圓潤海玻璃卵石

  // 三、3D 游移光斑粒子
  for (let p of sunDust) {
    p.update();
    p.display();
  }

  // 四、3D 角色：露露更新與繪製
  lulu.update();
  lulu.display();

  // 五、治癒微光愛心粒子
  for (let i = loveSparks.length - 1; i >= 0; i--) {
    loveSparks[i].update();
    loveSparks[i].display();
    if (loveSparks[i].isDead()) {
      loveSparks.splice(i, 1);
    }
  }
}

// 點擊滑鼠：露露開心地蹭蹭神木、分泌治癒凝膠
function mousePressed() {
  lulu.triggerNuzzle();
}

// --------------------------------------------------------------
// 1. 3D 物種 Class：晶靈露露（DewSpirit）
// 軟萌、水滴型態、如果凍般輕柔半透明、依偎大樹共生
// --------------------------------------------------------------
class DewSpirit {
  constructor(x, y, z) {
    this.baseX = x;
    this.baseY = y;
    this.baseZ = z;
    this.x = x;
    this.y = y;
    this.z = z;

    // 狀態機：依偎親近大樹（Nuzzling）
    this.isNuzzling = false;
    this.nuzzleTimer = 0;
    this.nextAutoNuzzle = 150; // 每 2.5 秒左右自發蹭蹭大樹

    // 能量核心亮度
    this.corePulse = 0;
  }

  update() {
    // 輕柔上下浮動（宛如在林間空氣與露水微風中漂浮）
    this.floatOffset = sin(frameCount * 0.04) * 10;
    // 呼吸律動（軟糯如果凍般縮放）
    this.squishX = 1 + sin(frameCount * 0.06) * 0.06;
    this.squishY = 1 - sin(frameCount * 0.06) * 0.05;

    // 自動依偎大樹
    this.nextAutoNuzzle--;
    if (this.nextAutoNuzzle <= 0 && !this.isNuzzling) {
      this.triggerNuzzle();
      this.nextAutoNuzzle = floor(random(140, 240));
    }

    // 依偎動作進行中（輕輕湊上前貼蹭樹皮，散發治癒微光）
    if (this.isNuzzling) {
      this.nuzzleTimer++;
      // 向左側神木靠近並輕輕貼住
      let progress = sin(this.nuzzleTimer * 0.1);
      this.x = this.baseX - progress * 22;
      this.y = this.baseY + this.floatOffset - progress * 4;

      // 產生治癒與親暱微光粒子
      if (this.nuzzleTimer % 7 === 0) {
        loveSparks.push(new LoveSpark(this.x - 30, this.y - 10, this.z));
      }

      if (this.nuzzleTimer > 35) {
        this.isNuzzling = false;
        this.nuzzleTimer = 0;
      }
    } else {
      this.x = this.baseX;
      this.y = this.baseY + this.floatOffset;
      this.z = this.baseZ;
    }

    // 肚子內部核心的脈動
    this.corePulse = sin(frameCount * 0.08) * 0.3 + 0.7;
  }

  triggerNuzzle() {
    this.isNuzzling = true;
    this.nuzzleTimer = 0;
  }

  display() {
    push();
    translate(this.x, this.y, this.z);

    // 依偎時身體微微向左傾斜貼向大樹
    let tilt = this.isNuzzling ? -0.15 : sin(frameCount * 0.03) * 0.05;
    rotateZ(tilt);

    // 1. 軟萌飄逸的小水滴耳朵 / 觸角（像兔子或精靈般的柔嫩感）
    this.drawEars();

    // 2. 輕柔半透明果凍水滴主體（超有質感的立體反光）
    this.drawJellyBody();

    // 3. 腹內發光的溫暖治癒核心（象徵與神木交換的蜜露能量）
    this.drawGlowingCore();

    // 4. 水汪汪大眼睛與粉嫩腮紅（呆萌可愛臉龐）
    this.drawCuteFace();

    // 5. 抱抱樹木的小短手與小尾巴
    this.drawLimbs();

    pop();
  }

  // 1. 輕柔水滴耳朵（隨風與呼吸悠然擺動）
  drawEars() {
    let earSway = sin(frameCount * 0.06) * 0.12;

    // 左耳（偏向大樹）
    push();
    translate(-22, -45, 0);
    rotateZ(-0.35 + earSway);
    specularMaterial(175, 245, 225);
    shininess(80);
    noStroke();
    ellipsoid(10, 24, 10);
    pop();

    // 右耳
    push();
    translate(22, -45, 0);
    rotateZ(0.35 - earSway);
    specularMaterial(175, 245, 225);
    shininess(80);
    noStroke();
    ellipsoid(10, 24, 10);
    pop();
  }

  // 2. 圓滾滾水滴果凍軀幹（立體軟糯、高光晶瑩）
  drawJellyBody() {
    push();
    scale(this.squishX, this.squishY, this.squishX);

    // 果凍外層（淺碧玉薄荷綠，極高光澤度呈現晶透質感）
    specularMaterial(185, 245, 230);
    shininess(100);
    noStroke();
    ellipsoid(46, 52, 42);

    // 頭部上方水滴小隆起（更具水靈感）
    push();
    translate(0, -32, 0);
    ellipsoid(32, 28, 30);
    pop();

    pop();
  }

  // 3. 腹部內部發光的金色能量核心（半透明體內透出的溫柔微光）
  drawGlowingCore() {
    push();
    translate(0, 10, 5);
    emissiveMaterial(255, 215, 120); // 自體發光
    noStroke();
    sphere(16 * this.corePulse);
    pop();
  }

  // 4. 呆萌小臉：大眼睛與粉嫩腮紅
  drawCuteFace() {
    // 視線會微微跟著滑鼠游標轉動
    let eyeTrackX = map(mouseX, 0, width, -3, 3);
    let eyeTrackY = map(mouseY, 0, height, -2, 2);

    // 左眼
    push();
    translate(-16, -10, 36);
    // 深黑水汪汪眼珠
    specularMaterial(30, 45, 40);
    shininess(90);
    noStroke();
    sphere(8);
    // 眼睛大高光（Pixar 靈動小白點）
    translate(-2 + eyeTrackX * 0.4, -2 + eyeTrackY * 0.4, 7);
    emissiveMaterial(255, 255, 255);
    sphere(2.6);
    pop();

    // 右眼
    push();
    translate(16, -10, 36);
    specularMaterial(30, 45, 40);
    shininess(90);
    noStroke();
    sphere(8);
    // 眼睛大高光
    translate(-2 + eyeTrackX * 0.4, -2 + eyeTrackY * 0.4, 7);
    emissiveMaterial(255, 255, 255);
    sphere(2.6);
    pop();

    // 害羞粉嫩腮紅（左右各一顆）
    push();
    translate(-26, 4, 32);
    emissiveMaterial(255, 160, 175);
    noStroke();
    ellipsoid(7, 4, 4);
    pop();

    push();
    translate(26, 4, 32);
    emissiveMaterial(255, 160, 175);
    noStroke();
    ellipsoid(7, 4, 4);
    pop();

    // 圓嘟嘟的小微笑小嘴吻（不再是尖尖的鳥喙！）
    push();
    translate(0, 3, 38);
    emissiveMaterial(255, 190, 190);
    noStroke();
    sphere(2.5);
    pop();
  }

  // 5. 抱抱神木的軟綿綿小手手與小尾巴
  drawLimbs() {
    // 左小手（向左伸展，準備擁抱樹木）
    push();
    let reach = this.isNuzzling ? -12 : 0;
    translate(-36 + reach, 14, 18);
    rotateZ(0.4);
    specularMaterial(175, 240, 220);
    shininess(80);
    noStroke();
    ellipsoid(10, 7, 8);
    pop();

    // 右小手
    push();
    translate(36, 14, 18);
    rotateZ(-0.4);
    specularMaterial(175, 240, 220);
    shininess(80);
    noStroke();
    ellipsoid(10, 7, 8);
    pop();

    // 身後圓滾滾的小水滴尾巴
    push();
    translate(0, 32, -32);
    specularMaterial(170, 240, 220);
    shininess(80);
    noStroke();
    sphere(12);
    pop();
  }
}

// --------------------------------------------------------------
// 2. 3D 環境：古老神木與樹洞（TreeTrunk）
// --------------------------------------------------------------
function draw3DTree() {
  push();
  // 樹幹位於畫面左側
  translate(-310, 20, -40);
  rotateZ(0.04);

  // 1. 深棕厚實巨木主幹
  specularMaterial(52, 40, 34);
  shininess(15);
  noStroke();
  cylinder(140, 800, 28, 1);

  // 2. 樹皮上天鵝絨般的厚實綠苔斑塊
  push();
  translate(85, -40, 50);
  specularMaterial(70, 115, 65);
  shininess(8);
  ellipsoid(28, 90, 20);
  pop();

  push();
  translate(95, 110, 30);
  specularMaterial(60, 105, 55);
  shininess(8);
  ellipsoid(32, 110, 24);
  pop();

  // 3. 樹皮滲出的琥珀金「神木甘甜蜜露」（露露最愛吸吮的能量）
  push();
  translate(138, 5, 20);
  emissiveMaterial(255, 195, 70); // 自體發光金黃琥珀
  noStroke();
  sphere(11);
  pop();

  // 4. 板根天然樹洞（露露睡覺的小家）
  push();
  translate(110, 220, 30);
  emissiveMaterial(18, 12, 10);
  noStroke();
  ellipsoid(35, 60, 40);
  pop();

  pop();
}

// --------------------------------------------------------------
// 3. 3D 環境：清澈緩流與陶瓷卵石（Stream & Technofossils）
// --------------------------------------------------------------
function draw3DStream() {
  push();
  // 水面位於右下方
  translate(180, 250, 40);
  rotateX(1.3); // 躺平成為溪水表面

  // 1. 清澈水面波光
  specularMaterial(60, 140, 130);
  shininess(120);
  noStroke();
  plane(380, 280);

  // 2. 溪水底層溫潤光滑的「五千年陶瓷與海玻璃卵石」
  // 淺青海玻璃
  push();
  translate(-40, -30, -15);
  specularMaterial(140, 220, 210);
  shininess(90);
  ellipsoid(26, 18, 14);
  pop();

  // 象牙白陶瓷卵石
  push();
  translate(30, 20, -18);
  specularMaterial(240, 235, 225);
  shininess(70);
  ellipsoid(32, 22, 18);
  pop();

  // 淡藍琉璃碎石
  push();
  translate(90, -45, -12);
  specularMaterial(170, 215, 235);
  shininess(90);
  ellipsoid(22, 16, 12);
  pop();

  pop();
}

// --------------------------------------------------------------
// 4. 3D 效果：森林金色游移光塵（SunParticle / 木漏れ日）
// --------------------------------------------------------------
class SunParticle {
  constructor() {
    this.x = random(-350, 350);
    this.y = random(-280, 280);
    this.z = random(-150, 150);
    this.size = random(2.5, 6.5);
    this.speedY = random(-0.3, -0.8);
    this.drift = random(0.01, 0.03);
  }

  update() {
    this.y += this.speedY;
    this.x += sin(frameCount * this.drift) * 0.4;
    // 飄出上方則循環到底部
    if (this.y < -300) {
      this.y = 300;
      this.x = random(-350, 350);
    }
  }

  display() {
    push();
    translate(this.x, this.y, this.z);
    emissiveMaterial(255, 235, 150);
    noStroke();
    sphere(this.size * 0.5);
    pop();
  }
}

// --------------------------------------------------------------
// 5. 3D 效果：依偎神木時噴發的治癒微光星芒（LoveSpark）
// --------------------------------------------------------------
class LoveSpark {
  constructor(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.vx = random(-1.2, 0.5);
    this.vy = random(-1.8, -0.4);
    this.vz = random(-0.8, 0.8);
    this.life = 255;
    this.size = random(4, 9);
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.z += this.vz;
    this.life -= 8;
  }

  display() {
    push();
    translate(this.x, this.y, this.z);
    emissiveMaterial(255, 210, 150);
    noStroke();
    sphere(this.size * (this.life / 255));
    pop();
  }

  isDead() {
    return this.life <= 0;
  }
}
