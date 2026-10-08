// ==========================================
// M2 物種雛形：晶靈樹醫（Pippa / 皮皮）
// 世界觀：五千年後的超大森林（靜謐清溪苔地）
// ==========================================

let tree;          // 古老神木
let stream;        // 緩流清溪
let sunflecks = []; // 金色游移光斑群
let sparkles = [];  // 啄木時的蜜露光點粒子
let pippa;         // 晶靈樹醫主角

function setup() {
  createCanvas(800, 600);

  // 1. 建立環境物件
  tree = new TreeTrunk();
  stream = new Stream();

  // 2. 建立 5 片穿透樹梢的游移金色光斑（木漏れ日）
  for (let i = 0; i < 5; i++) {
    sunflecks.push(new Sunfleck());
  }

  // 3. 建立物種個體：皮皮（附著在大樹幹上）
  pippa = new TreeDoctor(205, 300);
}

function draw() {
  // 森林底色：深謐靜態的林下綠意
  background(26, 38, 30);

  // 一、繪製環境底層
  tree.display();   // 神木板根與樹皮
  stream.display(); // 清溪與溪底陶瓷卵石

  // 二、游移光斑更新與繪製
  for (let sf of sunflecks) {
    sf.update();
    sf.display();
  }

  // 三、物種個體更新與繪製
  pippa.update();
  pippa.display();

  // 四、啄木時產生的蜜露與孢子光點粒子
  for (let i = sparkles.length - 1; i >= 0; i--) {
    sparkles[i].update();
    sparkles[i].display();
    if (sparkles[i].isDead()) {
      sparkles.splice(i, 1);
    }
  }

  // 五、微光環境遮罩（讓光影更柔和溫暖）
  drawAtmosphere();
}

// 點擊滑鼠：刺激皮皮進行開心的「啄木吃蜜露」動作
function mousePressed() {
  pippa.startPeck();
}

// ------------------------------------------
// 1. 物種 Class：晶靈樹醫（TreeDoctor）
// ------------------------------------------
class TreeDoctor {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.baseY = y;

    // 狀態機變數
    this.isPecking = false;
    this.peckTimer = 0;
    this.peckCount = 0;
    this.nextAutoPeck = 180; // 自動啄木計時器（約每 3 秒一次）

    // 核心能量亮度
    this.coreEnergy = 150;
  }

  update() {
    // 呼吸律動（讓半透明果凍肚子明顯縮放）
    this.breath = sin(frameCount * 0.06) * 4.5;

    // 自動啄木計時器（每 2 秒左右敲擊一次，更生動）
    this.nextAutoPeck--;
    if (this.nextAutoPeck <= 0 && !this.isPecking) {
      this.startPeck();
      this.nextAutoPeck = floor(random(100, 180));
    }

    // 啄木動作進行中
    if (this.isPecking) {
      this.peckTimer++;
      // 快速前後敲擊樹皮
      this.peckOffset = sin(this.peckTimer * 0.9) * 14;

      // 啄擊接觸時噴出金色蜜露微光
      if (this.peckTimer % 6 === 0) {
        sparkles.push(new Sparkle(this.x - 38, this.y - 12 + this.peckOffset));
      }

      if (this.peckTimer > 28) {
        this.isPecking = false;
        this.peckOffset = 0;
      }
    } else {
      this.peckOffset = 0;
    }

    // 核心能量隨時間脈動發光
    this.coreEnergy = 170 + sin(frameCount * 0.09) * 60;
  }

  startPeck() {
    this.isPecking = true;
    this.peckTimer = 0;
  }

  display() {
    push();
    translate(this.x, this.y);

    // 1. 支撐尾巴（像啄木鳥一樣向下抵住樹幹）
    this.drawTail();

    // 2. 吸盤四肢（緊貼在樹皮上）
    this.drawLimbs();

    // 3. 半透明水凝膠身體主體
    this.drawBody();

    // 4. 腹內發光的能量核心腺體
    this.drawCore();

    // 5. 頭部、角質喙吻與感測羽耳
    this.drawHead();

    pop();
  }

  // 尾巴繪製
  drawTail() {
    push();
    stroke(120, 220, 190, 100);
    strokeWeight(1.5);
    fill(140, 235, 205, 120);

    beginShape();
    vertex(10, 25);
    bezierVertex(18, 55, -5, 75, -15, 80); // 抵住樹幹的尖端
    bezierVertex(-2, 60, 5, 40, -5, 28);
    endShape(CLOSE);
    pop();
  }

  // 四肢與吸盤
  drawLimbs() {
    push();
    fill(150, 240, 210, 160);
    stroke(100, 200, 170, 120);
    strokeWeight(1);

    // 前肢（貼向樹幹左側）
    ellipse(-28 + this.peckOffset * 0.3, -10, 14, 8);
    // 前肢透明吸盤肉墊
    fill(220, 255, 240, 200);
    ellipse(-33 + this.peckOffset * 0.3, -10, 6, 6);

    // 後肢（貼向樹幹下方）
    fill(150, 240, 210, 160);
    ellipse(-18, 30, 16, 9);
    fill(220, 255, 240, 200);
    ellipse(-23, 31, 7, 7);
    pop();
  }

  // 半透明如果凍的肚子與身體
  drawBody() {
    push();
    noStroke();

    // 外層光暈（柔光被囊）
    fill(130, 230, 190, 45);
    ellipse(0, 5, 62 + this.breath, 72 - this.breath);

    // 主體如果凍般的半透明水凝膠（淡青翠綠）
    stroke(160, 245, 215, 180);
    strokeWeight(1.5);
    fill(150, 235, 200, 130);
    ellipse(0, 5, 54 + this.breath, 64 - this.breath);

    // 身體背部的高光反射（展現濕潤露水質感）
    noStroke();
    fill(255, 255, 255, 130);
    ellipse(12, -8, 16, 28);
    fill(255, 255, 255, 180);
    ellipse(14, -12, 6, 12);
    pop();
  }

  // 腹腔內脈動的金色能量核心（代表吃下的蜜露與光能）
  drawCore() {
    push();
    noStroke();
    // 溫暖的琥珀金發光核心
    fill(255, 215, 110, this.coreEnergy * 0.4);
    ellipse(0, 10, 30, 30);

    fill(255, 230, 140, this.coreEnergy);
    ellipse(0, 10, 16, 16);

    fill(255, 255, 240, 230);
    ellipse(-2, 8, 6, 6);
    pop();
  }

  // 頭部、喙嘴與眼睛
  drawHead() {
    push();
    // 啄木時頭部會往前傾斜
    translate(-12 + this.peckOffset, -22);

    // 1. 感測羽耳（兩簇柔嫩的菌絲觸角，隨風微動）
    stroke(140, 230, 180, 160);
    strokeWeight(2);
    noFill();
    let earWiggle = sin(frameCount * 0.1) * 3;
    // 右羽耳
    bezier(8, -12, 12, -26 + earWiggle, 20, -32, 26, -30 + earWiggle);
    // 左羽耳
    bezier(-4, -14, -8, -28 - earWiggle, -16, -34, -20, -32 - earWiggle);

    // 2. 圓滾滾的半透明小腦袋
    noStroke();
    fill(160, 240, 210, 170);
    ellipse(0, 0, 38, 34);

    // 3. 堅韌小巧的角質喙吻（像啄木鳥一樣對準大樹）
    stroke(220, 180, 100, 220);
    strokeWeight(1);
    fill(245, 210, 120);
    triangle(-16, -4, -16, 4, -32, 0); // 喙尖朝向左側大樹

    // 4. 大眼睛（眼神會微微看向滑鼠位置）
    let lookX = map(mouseX, 0, width, -2, 2);
    let lookY = map(mouseY, 0, height, -2, 2);

    // 眼白/眼眶
    fill(240, 255, 250);
    ellipse(-3, -3, 13, 13);

    // 深邃水汪汪黑眼珠
    fill(35, 55, 45);
    ellipse(-3 + lookX, -3 + lookY, 9, 9);

    // 眼神高光小白點
    fill(255);
    ellipse(-5 + lookX * 0.5, -5 + lookY * 0.5, 3.5, 3.5);

    // 5. 害羞腮紅（淡淡的透明蜜桃粉）
    noStroke();
    fill(255, 170, 170, 80);
    ellipse(4, 5, 8, 5);

    pop();
  }
}

// ------------------------------------------
// 2. 環境 Class：古老神木樹幹（TreeTrunk）
// ------------------------------------------
class TreeTrunk {
  constructor() {
    this.trunkWidth = 210;
  }

  display() {
    push();
    noStroke();

    // 巨木主幹本體（古老深棕色）
    fill(48, 38, 34);
    rect(0, 0, this.trunkWidth, height);

    // 神木巨大的弧形板根輪廓（延伸向地表與清溪）
    fill(58, 45, 40);
    beginShape();
    vertex(0, 0);
    vertex(this.trunkWidth, 0);
    bezierVertex(this.trunkWidth + 20, 280, this.trunkWidth + 80, 480, this.trunkWidth + 180, height);
    vertex(0, height);
    endShape(CLOSE);

    // 樹皮深層縱向裂紋
    stroke(30, 22, 19, 180);
    strokeWeight(3);
    for (let x = 30; x < this.trunkWidth + 60; x += 35) {
      beginShape();
      for (let y = 0; y <= height; y += 40) {
        let xOffset = sin((y + x) * 0.03) * 8;
        vertex(x + xOffset, y);
      }
      endShape();
    }

    // 樹皮上的厚實天鵝絨苔蘚群（翠綠斑塊）
    noStroke();
    fill(72, 115, 68, 190);
    ellipse(120, 160, 70, 120);
    ellipse(160, 280, 60, 140);
    ellipse(220, 420, 90, 80);
    fill(98, 145, 90, 150);
    ellipse(115, 155, 45, 80);
    ellipse(155, 275, 40, 90);

    // 樹皮傷口分泌的琥珀金「神木甘甜蜜露」（皮皮的最愛）
    fill(255, 190, 60, 200);
    ellipse(172, 298, 12, 16);
    fill(255, 235, 150, 240);
    ellipse(170, 295, 5, 7);

    // 小樹洞（皮皮晚上睡覺的板根避難所）
    fill(22, 16, 14);
    ellipse(120, 440, 50, 75);

    pop();
  }
}

// ------------------------------------------
// 3. 環境 Class：緩流清溪與陶瓷卵石（Stream）
// ------------------------------------------
class Stream {
  constructor() {
    this.pebbles = [
      { x: 520, y: 530, r: 24, col: [160, 215, 210, 190] }, // 淺青海玻璃
      { x: 570, y: 560, r: 32, col: [240, 235, 220, 200] }, // 圓潤白陶瓷
      { x: 640, y: 525, r: 28, col: [130, 180, 170, 180] }, // 青瓷碎片
      { x: 710, y: 550, r: 36, col: [190, 225, 235, 210] }, // 淺藍玉石
      { x: 480, y: 575, r: 22, col: [230, 210, 185, 170] }  // 陶土鵝卵石
    ];
  }

  display() {
    push();
    noStroke();

    // 1. 溪底基層
    fill(35, 50, 42);
    beginShape();
    vertex(360, height);
    bezierVertex(450, 480, 600, 460, width, 470);
    vertex(width, height);
    endShape(CLOSE);

    // 2. 五千年被流水沖刷得圓潤的人造陶瓷卵石與海玻璃
    for (let p of this.pebbles) {
      fill(p.col[0], p.col[1], p.col[2], p.col[3]);
      ellipse(p.x, p.y, p.r * 1.3, p.r);
      // 石頭上的溫潤反光
      fill(255, 255, 255, 120);
      ellipse(p.x - p.r * 0.2, p.y - p.r * 0.2, p.r * 0.4, p.r * 0.25);
    }

    // 3. 清澈見底的緩流溪水（疊加半透明水波層）
    fill(80, 150, 140, 95);
    beginShape();
    vertex(360, height);
    let waveOffset = sin(frameCount * 0.03) * 6;
    bezierVertex(440, 475 + waveOffset, 610, 455 - waveOffset, width, 465 + waveOffset);
    vertex(width, height);
    endShape(CLOSE);

    // 4. 水面微光反光波紋
    stroke(200, 245, 235, 120);
    strokeWeight(1.5);
    noFill();
    for (let i = 0; i < 3; i++) {
      let py = 490 + i * 35 + sin(frameCount * 0.04 + i) * 4;
      line(430 + i * 70, py, 580 + i * 70, py);
    }

    pop();
  }
}

// ------------------------------------------
// 4. 環境 Class：金色游移光斑（Sunfleck / 木漏れ日）
// ------------------------------------------
class Sunfleck {
  constructor() {
    this.x = random(100, width - 50);
    this.y = random(80, height - 80);
    this.rx = random(60, 130);
    this.ry = random(40, 90);
    this.baseAlpha = random(20, 45);
    this.angle = random(TWO_PI);
    this.speed = random(0.008, 0.02);
  }

  update() {
    // 緩慢游移與輕柔呼吸
    this.angle += this.speed;
    this.currentX = this.x + sin(this.angle) * 20;
    this.currentY = this.y + cos(this.angle * 0.8) * 15;
    this.alpha = this.baseAlpha + sin(frameCount * 0.03) * 10;
  }

  display() {
    push();
    noStroke();
    // 溫暖金色光斑疊層
    fill(255, 235, 160, this.alpha * 0.5);
    ellipse(this.currentX, this.currentY, this.rx * 1.3, this.ry * 1.3);

    fill(255, 240, 180, this.alpha);
    ellipse(this.currentX, this.currentY, this.rx, this.ry);
    pop();
  }
}

// ------------------------------------------
// 5. 效果 Class：蜜露與真菌孢子微光粒子（Sparkle）
// ------------------------------------------
class Sparkle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = random(-2, 0.5);
    this.vy = random(-1.5, 1.5);
    this.life = 255;
    this.size = random(3, 7);
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life -= 12;
  }

  display() {
    push();
    noStroke();
    fill(255, 225, 120, this.life);
    ellipse(this.x, this.y, this.size, this.size);
    fill(255, 255, 255, this.life);
    ellipse(this.x, this.y, this.size * 0.5, this.size * 0.5);
    pop();
  }

  isDead() {
    return this.life <= 0;
  }
}

// ------------------------------------------
// 6. 全局氛圍光照（微光柔和濾鏡）
// ------------------------------------------
function drawAtmosphere() {
  push();
  noStroke();
  // 淡淡的青綠森林氣息
  fill(30, 60, 45, 20);
  rect(0, 0, width, height);
  pop();
}
