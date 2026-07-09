import * as THREE from 'three';
import './styles.css';

const canvas = document.querySelector('#game-canvas');
const scoreEl = document.querySelector('#score');
const waveEl = document.querySelector('#wave');
const livesEl = document.querySelector('#lives');
const powerEl = document.querySelector('#power');
const overlay = document.querySelector('#overlay');
const stageBanner = document.querySelector('#stage-banner');
const startButton = document.querySelector('#start-button');
const pauseButton = document.querySelector('#pause-button');

const GAME_WIDTH = 16;
const GAME_HEIGHT = 20;
const HALF_W = GAME_WIDTH / 2;
const HALF_H = GAME_HEIGHT / 2;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02040b);

const camera = new THREE.OrthographicCamera(-HALF_W, HALF_W, HALF_H, -HALF_H, 0.1, 80);
camera.position.set(0, 0, 30);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  canvas,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const pointerWorld = new THREE.Vector3();
const keys = new Set();

const STAGES = [
  {
    name: 'Kumes Saldirisi',
    background: 0x02040b,
    drift: 0.34,
    formation: 'block',
    meteorMin: 8.5,
    meteorMax: 12,
    starSpeed: 0.5,
  },
  {
    name: 'Meteor Gecidi',
    background: 0x10050b,
    drift: 0.52,
    formation: 'v',
    meteorMin: 1.4,
    meteorMax: 2.8,
    starSpeed: 0.86,
  },
  {
    name: 'Buz Halkasi',
    background: 0x03101a,
    drift: 0.46,
    formation: 'arc',
    meteorMin: 3.8,
    meteorMax: 6.2,
    starSpeed: 0.62,
  },
  {
    name: 'Kizil Kusatma',
    background: 0x12020f,
    drift: 0.62,
    formation: 'columns',
    meteorMin: 2.4,
    meteorMax: 4.4,
    starSpeed: 0.74,
  },
];

const materials = {
  ship: new THREE.MeshStandardMaterial({ color: 0x40d9ff, roughness: 0.42, metalness: 0.65 }),
  shipDark: new THREE.MeshStandardMaterial({ color: 0x182844, roughness: 0.52, metalness: 0.78 }),
  cockpit: new THREE.MeshStandardMaterial({ color: 0xffe66c, emissive: 0x7a5000, emissiveIntensity: 0.55 }),
  beam: new THREE.MeshStandardMaterial({ color: 0x64efff, emissive: 0x17c8ff, emissiveIntensity: 1.4 }),
  enemyBody: new THREE.MeshStandardMaterial({ color: 0xf7f3df, roughness: 0.84 }),
  enemyWing: new THREE.MeshStandardMaterial({ color: 0xdfe7e7, roughness: 0.86 }),
  beak: new THREE.MeshStandardMaterial({ color: 0xffb238, roughness: 0.55 }),
  comb: new THREE.MeshStandardMaterial({ color: 0xd72136, roughness: 0.58 }),
  eye: new THREE.MeshStandardMaterial({ color: 0x0d1020, roughness: 0.36 }),
  egg: new THREE.MeshStandardMaterial({ color: 0xffefd7, roughness: 0.72 }),
  gift: new THREE.MeshStandardMaterial({ color: 0xffd84d, emissive: 0x7d5200, emissiveIntensity: 0.35 }),
  giftRibbon: new THREE.MeshStandardMaterial({ color: 0x35e6ff, emissive: 0x006a94, emissiveIntensity: 0.6 }),
  flame: new THREE.MeshBasicMaterial({ color: 0xff7043, transparent: true, opacity: 0.8 }),
  feather: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.72 }),
};

const geometries = {
  sphere: new THREE.SphereGeometry(0.5, 24, 16),
  smallSphere: new THREE.SphereGeometry(0.12, 16, 10),
  cone: new THREE.ConeGeometry(0.32, 0.72, 24),
  cylinder: new THREE.CylinderGeometry(0.07, 0.07, 0.78, 12),
  box: new THREE.BoxGeometry(0.58, 0.58, 0.58),
  ribbonX: new THREE.BoxGeometry(0.68, 0.1, 0.68),
  ribbonY: new THREE.BoxGeometry(0.1, 0.68, 0.68),
  wing: new THREE.SphereGeometry(0.32, 18, 12),
  jet: new THREE.ConeGeometry(0.18, 0.7, 18),
};

const textures = {
  chicken: makeChickenTexture({ wing: 'down' }),
  chickenFlap: makeChickenTexture({ wing: 'up' }),
  bossChicken: makeChickenTexture({ boss: true }),
  bossChickenFlap: makeChickenTexture({ boss: true, wing: 'up' }),
  ship: makeShipTexture(),
  flame: makeFlameTexture(),
  gift: makeGiftTexture(),
  meteor: makeMeteorTexture(),
};

const spriteMaterials = {
  chicken: new THREE.SpriteMaterial({
    map: textures.chicken,
    transparent: true,
    depthWrite: false,
  }),
  bossChicken: new THREE.SpriteMaterial({
    map: textures.bossChicken,
    transparent: true,
    depthWrite: false,
  }),
  ship: new THREE.SpriteMaterial({
    map: textures.ship,
    transparent: true,
    depthWrite: false,
  }),
  flame: new THREE.SpriteMaterial({
    map: textures.flame,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  }),
  gift: new THREE.SpriteMaterial({
    map: textures.gift,
    transparent: true,
    depthWrite: false,
  }),
  meteor: new THREE.SpriteMaterial({
    map: textures.meteor,
    transparent: true,
    depthWrite: false,
  }),
};

const state = {
  phase: 'ready',
  paused: false,
  score: 0,
  lives: 3,
  wave: 1,
  section: 1,
  stageWave: 1,
  stageIndex: 0,
  stageMessageTimer: 0,
  power: 1,
  fireTimer: 0,
  meteorTimer: 8,
  waveTimer: 0,
  invulnerable: 0,
  shake: 0,
  time: 0,
};

const player = {
  group: createPlayerShip(),
  target: new THREE.Vector3(0, -8.2, 0),
  radius: 0.58,
  speed: 13,
};

const enemies = [];
const playerShots = [];
const enemyShots = [];
const powerups = [];
const meteors = [];
const particles = [];

scene.add(player.group);
player.group.position.set(0, -8.2, 0);

setupLights();
setupBackdrop();
spawnWave();
updateHud();
resize();

startButton.addEventListener('click', () => {
  if (state.phase === 'gameover') {
    resetGame();
  }
  state.phase = 'playing';
  state.paused = false;
  state.invulnerable = Math.max(state.invulnerable, 1.6);
  overlay.classList.remove('is-visible');
});

pauseButton.addEventListener('click', () => {
  if (state.phase !== 'playing') return;
  state.paused = !state.paused;
  pauseButton.textContent = state.paused ? '>' : 'II';
});

window.addEventListener('resize', resize);
window.addEventListener('keydown', (event) => {
  keys.add(event.code);
  if (event.code === 'Space') event.preventDefault();
  if (event.code === 'KeyP' && state.phase === 'playing') {
    state.paused = !state.paused;
    pauseButton.textContent = state.paused ? '>' : 'II';
  }
});
window.addEventListener('keyup', (event) => keys.delete(event.code));
window.addEventListener('pointermove', (event) => {
  if (isGamePointerEvent(event)) {
    movePointerTarget(event);
  }
});
window.addEventListener('pointerdown', (event) => {
  if (!isGamePointerEvent(event)) return;
  movePointerTarget(event);
  if (state.fireTimer <= 0) {
    firePlayerShot();
    state.fireTimer = getFireDelay();
  }
  keys.add('PointerFire');
});
window.addEventListener('pointerup', () => keys.delete('PointerFire'));
window.addEventListener('blur', () => keys.clear());

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.033);
  if (!state.paused && state.phase === 'playing') {
    update(dt);
  }
  animateIdle(dt);
  renderer.render(scene, camera);
});

function setupLights() {
  scene.add(new THREE.HemisphereLight(0xc6f4ff, 0x11172f, 1.65));

  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-5, 7, 12);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x63d7ff, 1.2);
  rim.position.set(6, -2, 10);
  scene.add(rim);
}

function makeCanvasTexture(draw, size = 256) {
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = size;
  textureCanvas.height = size;
  const ctx = textureCanvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  draw(ctx, size);

  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.LinearMipMapLinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function makeChickenTexture({ boss = false, wing = 'down' } = {}) {
  return makeCanvasTexture((ctx, size) => {
    const s = size / 256;
    const body = boss ? '#fff0a9' : '#fff8eb';
    const shade = boss ? '#f5cc74' : '#e8eef0';
    const comb = boss ? '#b91523' : '#d71931';
    const stroke = '#1a1420';
    const wingUp = wing === 'up';

    ctx.save();
    ctx.scale(s, s);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.48)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 8;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(128, 213, 52, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 7;

    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.ellipse(wingUp ? 70 : 63, wingUp ? 106 : 139, 38, 63, wingUp ? -0.94 : -0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(wingUp ? 186 : 193, wingUp ? 106 : 139, 38, 63, wingUp ? 0.94 : 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(128, 145, 61, 70, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.38;
    ctx.beginPath();
    ctx.ellipse(108, 126, 16, 28, -0.46, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#f3efe0';
    for (const x of [109, 128, 147]) {
      ctx.beginPath();
      ctx.ellipse(x, 177, 11, 23, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(128, 82, 43, 41, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = comb;
    for (const [x, y, r] of [[103, 42, 14], [126, 30, 18], [150, 42, 14]]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.fillStyle = '#ffb238';
    ctx.beginPath();
    ctx.moveTo(126, 84);
    ctx.lineTo(94, 103);
    ctx.lineTo(128, 114);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(130, 84);
    ctx.lineTo(162, 103);
    ctx.lineTo(128, 114);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#111426';
    for (const x of [111, 145]) {
      ctx.beginPath();
      ctx.arc(x, 75, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x - 3, 72, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111426';
    }

    ctx.fillStyle = '#ff9c2a';
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 7;
    for (const x of [105, 151]) {
      ctx.beginPath();
      ctx.moveTo(x, 197);
      ctx.lineTo(x - 24, 217);
      ctx.lineTo(x + 22, 217);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    if (boss) {
      ctx.strokeStyle = '#6a1a10';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(83, 35);
      ctx.lineTo(128, 18);
      ctx.lineTo(173, 35);
      ctx.stroke();
      ctx.fillStyle = '#ffd84d';
      for (const x of [83, 128, 173]) {
        ctx.beginPath();
        ctx.arc(x, x === 128 ? 18 : 35, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  });
}

function makeShipTexture() {
  return makeCanvasTexture((ctx, size) => {
    const s = size / 256;
    ctx.save();
    ctx.scale(s, s);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(128, 211, 48, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#08101e';
    ctx.lineWidth = 9;

    ctx.fillStyle = '#35ddff';
    ctx.beginPath();
    ctx.moveTo(128, 23);
    ctx.lineTo(96, 170);
    ctx.lineTo(128, 154);
    ctx.lineTo(160, 170);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#1c6bf0';
    ctx.beginPath();
    ctx.moveTo(96, 123);
    ctx.lineTo(36, 197);
    ctx.lineTo(105, 166);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(160, 123);
    ctx.lineTo(220, 197);
    ctx.lineTo(151, 166);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#151e39';
    ctx.beginPath();
    ctx.moveTo(128, 78);
    ctx.lineTo(108, 157);
    ctx.lineTo(128, 148);
    ctx.lineTo(148, 157);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffe86f';
    ctx.beginPath();
    ctx.ellipse(128, 91, 17, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ff6532';
    for (const x of [104, 152]) {
      ctx.beginPath();
      ctx.roundRect(x - 8, 165, 16, 36, 6);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  });
}

function makeFlameTexture() {
  return makeCanvasTexture((ctx, size) => {
    const s = size / 256;
    const gradient = ctx.createRadialGradient(128, 88, 6, 128, 128, 104);
    gradient.addColorStop(0, 'rgba(255, 255, 210, 1)');
    gradient.addColorStop(0.38, 'rgba(255, 161, 42, 0.92)');
    gradient.addColorStop(1, 'rgba(255, 46, 25, 0)');

    ctx.save();
    ctx.scale(s, s);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(128, 238);
    ctx.bezierCurveTo(76, 167, 111, 111, 128, 25);
    ctx.bezierCurveTo(160, 111, 183, 170, 128, 238);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });
}

function makeGiftTexture() {
  return makeCanvasTexture((ctx, size) => {
    const s = size / 256;
    ctx.save();
    ctx.scale(s, s);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#101018';
    ctx.lineWidth = 9;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
    ctx.beginPath();
    ctx.ellipse(128, 204, 54, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffda45';
    ctx.beginPath();
    ctx.roundRect(72, 86, 112, 106, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#27d8ff';
    ctx.fillRect(119, 84, 18, 111);
    ctx.strokeRect(119, 84, 18, 111);
    ctx.fillRect(67, 122, 122, 18);
    ctx.strokeRect(67, 122, 122, 18);

    ctx.fillStyle = '#27d8ff';
    ctx.beginPath();
    ctx.ellipse(105, 77, 27, 18, -0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(151, 77, 27, 18, 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  });
}

function makeMeteorTexture() {
  return makeCanvasTexture((ctx, size) => {
    const s = size / 256;
    ctx.save();
    ctx.scale(s, s);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const trail = ctx.createLinearGradient(128, 20, 128, 168);
    trail.addColorStop(0, 'rgba(255, 240, 120, 0)');
    trail.addColorStop(0.42, 'rgba(255, 118, 38, 0.86)');
    trail.addColorStop(1, 'rgba(255, 35, 20, 0.06)');
    ctx.fillStyle = trail;
    ctx.beginPath();
    ctx.moveTo(88, 22);
    ctx.bezierCurveTo(122, 68, 99, 104, 122, 153);
    ctx.bezierCurveTo(147, 104, 137, 68, 170, 23);
    ctx.bezierCurveTo(152, 62, 164, 102, 181, 144);
    ctx.bezierCurveTo(151, 116, 123, 122, 76, 150);
    ctx.bezierCurveTo(96, 104, 107, 63, 88, 22);
    ctx.fill();

    ctx.strokeStyle = '#130d0c';
    ctx.lineWidth = 8;
    ctx.fillStyle = '#8b4c38';
    ctx.beginPath();
    ctx.moveTo(87, 124);
    ctx.lineTo(123, 92);
    ctx.lineTo(171, 106);
    ctx.lineTo(194, 151);
    ctx.lineTo(169, 202);
    ctx.lineTo(112, 213);
    ctx.lineTo(70, 177);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#c27a4d';
    for (const [x, y, r] of [[118, 135, 13], [154, 158, 17], [108, 181, 10]]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.fillStyle = '#ffcf68';
    ctx.beginPath();
    ctx.arc(138, 126, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  });
}

function setupBackdrop() {
  const starGeometry = new THREE.BufferGeometry();
  const starCount = 620;
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);
  const colorA = new THREE.Color(0x7ddfff);
  const colorB = new THREE.Color(0xffe08a);
  const colorC = new THREE.Color(0xffffff);

  for (let i = 0; i < starCount; i += 1) {
    const i3 = i * 3;
    positions[i3] = THREE.MathUtils.randFloatSpread(28);
    positions[i3 + 1] = THREE.MathUtils.randFloatSpread(36);
    positions[i3 + 2] = THREE.MathUtils.randFloat(-18, -6);

    const color = Math.random() > 0.84 ? colorB : Math.random() > 0.5 ? colorA : colorC;
    colors[i3] = color.r;
    colors[i3 + 1] = color.g;
    colors[i3 + 2] = color.b;
  }

  starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({
      size: 0.065,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    }),
  );
  stars.name = 'starfield';
  scene.add(stars);
}

function createPlayerShip() {
  const group = new THREE.Group();

  const ship = new THREE.Sprite(spriteMaterials.ship.clone());
  ship.scale.set(1.9, 2.02, 1);
  group.add(ship);

  const flameLeft = new THREE.Sprite(spriteMaterials.flame.clone());
  flameLeft.position.set(-0.27, -0.88, -0.02);
  flameLeft.scale.set(0.28, 0.62, 1);
  flameLeft.userData.baseW = 0.28;
  flameLeft.userData.baseH = 0.62;
  group.add(flameLeft);

  const flameRight = flameLeft.clone();
  flameRight.position.x = 0.2;
  flameRight.material = spriteMaterials.flame.clone();
  group.add(flameRight);

  group.userData.flames = [flameLeft, flameRight];
  return group;
}

function createChicken(scale = 1, palette = 'classic') {
  const group = new THREE.Group();
  const material = palette === 'boss' ? spriteMaterials.bossChicken : spriteMaterials.chicken;
  const sprite = new THREE.Sprite(material.clone());
  sprite.scale.set(1.42 * scale, 1.5 * scale, 1);
  group.add(sprite);
  group.userData.sprite = sprite;
  group.userData.flapMaps = palette === 'boss'
    ? [textures.bossChicken, textures.bossChickenFlap]
    : [textures.chicken, textures.chickenFlap];

  return group;
}

function spawnWave() {
  applyStageForWave();
  clearEnemies();
  enemyShots.forEach((shot) => scene.remove(shot.mesh));
  enemyShots.length = 0;

  const isBoss = state.wave % 5 === 0;
  if (isBoss) {
    spawnBoss();
  } else {
    const stage = currentStage();
    const cols = Math.min(8 + Math.floor((state.stageWave + state.section - 2) / 2), 10);
    const rows = Math.min(3 + Math.floor((state.stageWave + 1) / 2), 5);
    const spacingX = stage.formation === 'columns' ? 1.34 : 1.24;
    const spacingY = stage.formation === 'arc' ? 0.98 : 1.08;
    const startX = -((cols - 1) * spacingX) / 2;
    const startY = stage.formation === 'v' ? 6.35 : 6.1;

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const point = formationPoint({
          col,
          cols,
          row,
          spacingX,
          spacingY,
          stage,
          startX,
          startY,
        });
        const enemy = createEnemy({
          x: point.x,
          y: point.y,
          row,
          col,
          hp: 1 + Math.floor(state.wave / 4),
          score: 120 + row * 15,
          entryDelay: row * 0.08 + col * 0.035,
        });
        enemies.push(enemy);
        scene.add(enemy.group);
      }
    }
  }

  state.waveTimer = 1.2;
  updateHud();
}

function currentStage() {
  return STAGES[state.stageIndex % STAGES.length];
}

function applyStageForWave() {
  const previousSection = state.section;
  state.section = Math.floor((state.wave - 1) / 3) + 1;
  state.stageWave = ((state.wave - 1) % 3) + 1;
  state.stageIndex = (state.section - 1) % STAGES.length;

  const stage = currentStage();
  scene.background.setHex(stage.background);

  if (previousSection !== state.section || state.wave === 1) {
    state.stageMessageTimer = 2.5;
    if (stageBanner) {
      stageBanner.textContent = `Bolum ${state.section}: ${stage.name}`;
      stageBanner.classList.add('is-visible');
    }
    state.meteorTimer = Math.min(state.meteorTimer, stage.meteorMin);
  }
}

function formationPoint({ col, cols, row, spacingX, spacingY, stage, startX, startY }) {
  const x = startX + col * spacingX;
  const center = (cols - 1) / 2;
  const distance = Math.abs(col - center);

  if (stage.formation === 'v') {
    return {
      x,
      y: startY - row * spacingY - distance * 0.24,
    };
  }

  if (stage.formation === 'arc') {
    const normalized = center === 0 ? 0 : (col - center) / center;
    return {
      x,
      y: startY - row * spacingY - Math.cos(normalized * Math.PI) * 0.34,
    };
  }

  if (stage.formation === 'columns') {
    return {
      x: x + (row % 2 === 0 ? 0.12 : -0.12),
      y: startY - row * spacingY - (col % 2) * 0.34,
    };
  }

  return { x, y: startY - row * spacingY };
}

function spawnBoss() {
  const group = createChicken(2.25, 'boss');
  const enemy = {
    group,
    base: new THREE.Vector3(0, 5.2, 0),
    hp: 26 + state.wave * 4,
    maxHp: 26 + state.wave * 4,
    radius: 1.46,
    row: 0,
    col: 0,
    score: 2500 + state.wave * 100,
    phase: Math.random() * Math.PI * 2,
    shootTimer: 1.1,
    diveTimer: 4,
    entryDelay: 0,
    age: 0,
    isBoss: true,
  };
  group.position.set(0, 12.5, 0);
  group.scale.setScalar(1);
  enemies.push(enemy);
  scene.add(group);
}

function createEnemy({ x, y, row, col, hp, score, entryDelay }) {
  const group = createChicken(0.9 + Math.random() * 0.04);
  group.position.set(x + THREE.MathUtils.randFloatSpread(5), 11 + row * 0.6, 0);
  group.rotation.z = THREE.MathUtils.randFloatSpread(0.2);

  return {
    group,
    base: new THREE.Vector3(x, y, 0),
    hp,
    maxHp: hp,
    radius: 0.56,
    row,
    col,
    score,
    phase: Math.random() * Math.PI * 2,
    shootTimer: THREE.MathUtils.randFloat(2.8, 7.2),
    diveTimer: THREE.MathUtils.randFloat(5, 11),
    entryDelay,
    age: 0,
    isBoss: false,
  };
}

function update(dt) {
  state.time += dt;
  state.fireTimer -= dt;
  state.waveTimer -= dt;
  state.stageMessageTimer = Math.max(0, state.stageMessageTimer - dt);
  state.invulnerable = Math.max(0, state.invulnerable - dt);
  state.shake = Math.max(0, state.shake - dt * 4);

  updatePlayer(dt);
  updateEnemies(dt);
  updateShots(dt);
  updatePowerups(dt);
  updateMeteors(dt);
  updateParticles(dt);
  updateCollisions();
  updateStageBanner();
  updateCameraShake();

  if (enemies.length === 0 && state.waveTimer <= 0) {
    state.wave += 1;
    state.waveTimer = 1.4;
    setTimeout(() => {
      if (state.phase === 'playing') spawnWave();
    }, 500);
  }

  updateHud();
}

function updatePlayer(dt) {
  const move = new THREE.Vector2();
  if (keys.has('ArrowLeft') || keys.has('KeyA')) move.x -= 1;
  if (keys.has('ArrowRight') || keys.has('KeyD')) move.x += 1;
  if (keys.has('ArrowUp') || keys.has('KeyW')) move.y += 1;
  if (keys.has('ArrowDown') || keys.has('KeyS')) move.y -= 1;

  if (move.lengthSq() > 0) {
    move.normalize();
    player.target.x = player.group.position.x + move.x * player.speed * dt;
    player.target.y = player.group.position.y + move.y * player.speed * dt;
  }

  player.target.x = THREE.MathUtils.clamp(player.target.x, -HALF_W + 0.75, HALF_W - 0.75);
  player.target.y = THREE.MathUtils.clamp(player.target.y, -HALF_H + 1.1, -1.2);
  player.group.position.lerp(player.target, 1 - Math.pow(0.0008, dt));
  player.group.rotation.z = THREE.MathUtils.lerp(
    player.group.rotation.z,
    THREE.MathUtils.clamp((player.target.x - player.group.position.x) * -0.28, -0.28, 0.28),
    0.16,
  );

  const firing = keys.has('Space') || keys.has('PointerFire');
  if (firing && state.fireTimer <= 0) {
    firePlayerShot();
    state.fireTimer = getFireDelay();
  }

  player.group.visible = state.invulnerable <= 0 || Math.sin(state.time * 42) > 0;
  for (const flame of player.group.userData.flames) {
    const scale = 0.82 + Math.sin(state.time * 28) * 0.22;
    flame.scale.set(flame.userData.baseW, flame.userData.baseH * scale, 1);
    flame.material.opacity = 0.58 + Math.sin(state.time * 34) * 0.2;
  }
}

function updateEnemies(dt) {
  const stage = currentStage();
  for (const enemy of enemies) {
    enemy.age += dt;
    const entry = THREE.MathUtils.smoothstep(Math.max(0, enemy.age - enemy.entryDelay), 0, 1.1);
    const waveDrift = Math.sin(state.time * (enemy.isBoss ? 0.85 : 1.05) + enemy.phase) * (enemy.isBoss ? 2.1 : stage.drift);
    const bob = Math.sin(state.time * 2.4 + enemy.phase) * (enemy.isBoss ? 0.22 : 0.16);
    const target = new THREE.Vector3(enemy.base.x + waveDrift, enemy.base.y + bob, 0);

    enemy.group.position.lerp(target, enemy.isBoss ? 0.035 : entry * 0.08 + 0.025);
    enemy.group.rotation.z = Math.sin(state.time * 2.6 + enemy.phase) * (enemy.isBoss ? 0.08 : 0.18);
    enemy.group.rotation.x = Math.sin(state.time * 3.2 + enemy.phase) * 0.05;
    if (enemy.group.userData.sprite) {
      const flapIndex = Math.sin(state.time * (enemy.isBoss ? 5.2 : 8.4) + enemy.phase) > 0 ? 1 : 0;
      enemy.group.userData.sprite.material.map = enemy.group.userData.flapMaps[flapIndex];
      enemy.group.userData.sprite.material.needsUpdate = true;
    }

    enemy.shootTimer -= dt;
    if (enemy.shootTimer <= 0 && enemy.group.position.y < HALF_H - 1.5 && canEnemyFire(enemy)) {
      if (enemy.isBoss) {
        fireBossPattern(enemy);
        enemy.shootTimer = Math.max(0.95, 1.65 - state.wave * 0.025);
      } else {
        fireEnemyEgg(enemy);
        enemy.shootTimer = THREE.MathUtils.randFloat(
          Math.max(2.2, 5.4 - state.wave * 0.14),
          Math.max(3.6, 8.4 - state.wave * 0.12),
        );
      }
    }

    if (!enemy.isBoss) {
      enemy.diveTimer -= dt;
      if (enemy.diveTimer <= 0) {
        enemy.base.y -= 0.38;
        enemy.diveTimer = THREE.MathUtils.randFloat(4.6, 10.5);
      }

      if (enemy.group.position.y < -HALF_H - 1.3) {
        enemy.group.position.y = HALF_H + 2;
        enemy.base.y = THREE.MathUtils.randFloat(4.2, 7.2);
      }
    }
  }
}

function updateShots(dt) {
  for (let i = playerShots.length - 1; i >= 0; i -= 1) {
    const shot = playerShots[i];
    shot.mesh.position.addScaledVector(shot.velocity, dt);
    shot.mesh.rotation.y += dt * 8;
    if (shot.mesh.position.y > HALF_H + 1) {
      scene.remove(shot.mesh);
      playerShots.splice(i, 1);
    }
  }

  for (let i = enemyShots.length - 1; i >= 0; i -= 1) {
    const shot = enemyShots[i];
    shot.mesh.position.addScaledVector(shot.velocity, dt);
    shot.mesh.rotation.z += dt * 4.5;
    shot.mesh.rotation.x += dt * 2.2;
    if (shot.mesh.position.y < -HALF_H - 1.5 || Math.abs(shot.mesh.position.x) > HALF_W + 2) {
      scene.remove(shot.mesh);
      enemyShots.splice(i, 1);
    }
  }
}

function updatePowerups(dt) {
  for (let i = powerups.length - 1; i >= 0; i -= 1) {
    const powerup = powerups[i];
    powerup.mesh.position.y -= dt * 2.1;
    powerup.mesh.rotation.y += dt * 3;
    powerup.mesh.rotation.z += dt * 1.5;
    if (powerup.mesh.position.y < -HALF_H - 1) {
      scene.remove(powerup.mesh);
      powerups.splice(i, 1);
    }
  }
}

function updateMeteors(dt) {
  const stage = currentStage();
  state.meteorTimer -= dt;

  if (state.meteorTimer <= 0) {
    spawnMeteor(stage);
    const pressure = Math.min(1.4, state.section * 0.08 + state.stageWave * 0.08);
    state.meteorTimer = THREE.MathUtils.randFloat(
      Math.max(0.9, stage.meteorMin - pressure),
      Math.max(1.3, stage.meteorMax - pressure),
    );
  }

  for (let i = meteors.length - 1; i >= 0; i -= 1) {
    const meteor = meteors[i];
    meteor.mesh.position.addScaledVector(meteor.velocity, dt);
    meteor.mesh.rotation.z += meteor.spin * dt;
    meteor.mesh.scale.setScalar(meteor.scale * (1 + Math.sin(state.time * 8 + meteor.phase) * 0.035));

    if (meteor.mesh.position.y < -HALF_H - 2 || Math.abs(meteor.mesh.position.x) > HALF_W + 3) {
      scene.remove(meteor.mesh);
      meteors.splice(i, 1);
    }
  }
}

function spawnMeteor(stage = currentStage()) {
  if (meteors.length > 9) return;

  const mesh = new THREE.Sprite(spriteMaterials.meteor.clone());
  const scale = THREE.MathUtils.randFloat(0.76, stage.formation === 'v' ? 1.32 : 1.14);
  mesh.scale.setScalar(scale);
  mesh.position.set(
    THREE.MathUtils.randFloat(-HALF_W + 0.8, HALF_W - 0.8),
    HALF_H + THREE.MathUtils.randFloat(1.1, 3.2),
    0.18,
  );
  mesh.rotation.z = THREE.MathUtils.randFloatSpread(Math.PI);
  scene.add(mesh);

  meteors.push({
    mesh,
    scale,
    radius: scale * 0.46,
    hp: scale > 1.08 ? 3 : 2,
    velocity: new THREE.Vector3(
      THREE.MathUtils.randFloat(-0.45, 0.45),
      -THREE.MathUtils.randFloat(3.4, 5.6 + state.section * 0.18),
      0,
    ),
    spin: THREE.MathUtils.randFloat(-3.8, 3.8),
    phase: Math.random() * Math.PI * 2,
  });
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const particle = particles[i];
    particle.life -= dt;
    particle.mesh.position.addScaledVector(particle.velocity, dt);
    particle.mesh.rotation.z += particle.spin * dt;
    particle.mesh.material.opacity = Math.max(0, particle.life / particle.maxLife);
    if (particle.life <= 0) {
      scene.remove(particle.mesh);
      particles.splice(i, 1);
    }
  }
}

function updateCollisions() {
  for (let s = playerShots.length - 1; s >= 0; s -= 1) {
    const shot = playerShots[s];
    let consumed = false;

    for (let e = enemies.length - 1; e >= 0; e -= 1) {
      const enemy = enemies[e];
      if (shot.mesh.position.distanceTo(enemy.group.position) < shot.radius + enemy.radius) {
        enemy.hp -= shot.damage;
        consumed = true;
        burstFeathers(shot.mesh.position, 5, 0.8);
        state.shake = Math.max(state.shake, 0.2);

        if (enemy.hp <= 0) {
          destroyEnemy(e);
        } else {
          enemy.group.scale.setScalar(1 + (1 - enemy.hp / enemy.maxHp) * 0.12);
        }
        break;
      }
    }

    if (!consumed) {
      for (let m = meteors.length - 1; m >= 0; m -= 1) {
        const meteor = meteors[m];
        if (shot.mesh.position.distanceTo(meteor.mesh.position) < shot.radius + meteor.radius) {
          meteor.hp -= shot.damage;
          consumed = true;
          state.shake = Math.max(state.shake, 0.16);
          burstFeathers(shot.mesh.position, 5, 1.1, materials.flame);
          if (meteor.hp <= 0) {
            destroyMeteor(m, true);
          }
          break;
        }
      }
    }

    if (consumed) {
      scene.remove(shot.mesh);
      playerShots.splice(s, 1);
    }
  }

  if (state.invulnerable <= 0) {
    for (let i = enemyShots.length - 1; i >= 0; i -= 1) {
      const shot = enemyShots[i];
      if (shot.mesh.position.distanceTo(player.group.position) < shot.radius + player.radius) {
        scene.remove(shot.mesh);
        enemyShots.splice(i, 1);
        damagePlayer();
        break;
      }
    }

    for (const enemy of enemies) {
      if (enemy.group.position.distanceTo(player.group.position) < enemy.radius + player.radius) {
        damagePlayer();
        break;
      }
    }

    for (let i = meteors.length - 1; i >= 0; i -= 1) {
      const meteor = meteors[i];
      if (meteor.mesh.position.distanceTo(player.group.position) < meteor.radius + player.radius) {
        destroyMeteor(i, false);
        damagePlayer();
        break;
      }
    }
  }

  for (let i = powerups.length - 1; i >= 0; i -= 1) {
    const powerup = powerups[i];
    if (powerup.mesh.position.distanceTo(player.group.position) < 0.82) {
      state.power = Math.min(5, state.power + 1);
      state.score += 350;
      scene.remove(powerup.mesh);
      powerups.splice(i, 1);
      burstFeathers(player.group.position, 8, 1.4, materials.giftRibbon);
    }
  }
}

function firePlayerShot() {
  const offsets = getShotOffsets();
  for (const offset of offsets) {
    const mesh = new THREE.Mesh(geometries.cylinder, materials.beam);
    mesh.position.set(player.group.position.x + offset.x, player.group.position.y + 0.75, 0.05);
    mesh.scale.set(offset.wide ? 1.35 : 1, offset.tall ? 1.35 : 1, 1);
    scene.add(mesh);
    playerShots.push({
      mesh,
      velocity: new THREE.Vector3(offset.vx, 11.8, 0),
      radius: offset.wide ? 0.2 : 0.13,
      damage: 1,
    });
  }
}

function getShotOffsets() {
  if (state.power <= 1) return [{ x: 0, vx: 0 }];
  if (state.power === 2) return [{ x: -0.22, vx: -0.15 }, { x: 0.22, vx: 0.15 }];
  if (state.power === 3) return [{ x: -0.32, vx: -0.22 }, { x: 0, vx: 0 }, { x: 0.32, vx: 0.22 }];
  if (state.power === 4) {
    return [
      { x: -0.42, vx: -0.4 },
      { x: -0.14, vx: -0.1, tall: true },
      { x: 0.14, vx: 0.1, tall: true },
      { x: 0.42, vx: 0.4 },
    ];
  }
  return [
    { x: -0.48, vx: -0.5 },
    { x: -0.22, vx: -0.18, tall: true },
    { x: 0, vx: 0, wide: true },
    { x: 0.22, vx: 0.18, tall: true },
    { x: 0.48, vx: 0.5 },
  ];
}

function getFireDelay() {
  return Math.max(0.08, 0.23 - state.power * 0.028);
}

function canEnemyFire(enemy) {
  if (enemy.isBoss) return enemyShots.length < 18;

  const maxActiveEggs = Math.min(4 + Math.floor(state.wave * 1.2), 13);
  if (enemyShots.length >= maxActiveEggs) {
    enemy.shootTimer = THREE.MathUtils.randFloat(0.55, 1.4);
    return false;
  }

  const hasChickenBelow = enemies.some((other) => (
    other !== enemy
    && !other.isBoss
    && other.col === enemy.col
    && other.row > enemy.row
  ));

  if (hasChickenBelow && Math.random() < 0.82) {
    enemy.shootTimer = THREE.MathUtils.randFloat(1.1, 2.4);
    return false;
  }

  return true;
}

function fireEnemyEgg(enemy) {
  const mesh = createEggMesh(enemy.isBoss ? 0.42 : 0.24);
  mesh.position.copy(enemy.group.position);
  mesh.position.y -= enemy.isBoss ? 1.2 : 0.45;
  scene.add(mesh);
  enemyShots.push({
    mesh,
    velocity: new THREE.Vector3(
      Math.sin(state.time + enemy.phase) * (enemy.isBoss ? 1.4 : 0.45),
      enemy.isBoss ? -3.6 : -2.35 - state.wave * 0.05,
      0,
    ),
    radius: enemy.isBoss ? 0.42 : 0.24,
  });
}

function fireBossPattern(enemy) {
  const origin = enemy.group.position.clone();
  for (let i = -2; i <= 2; i += 1) {
    const mesh = createEggMesh(0.32);
    mesh.position.set(origin.x + i * 0.42, origin.y - 1.25, 0.05);
    scene.add(mesh);
    enemyShots.push({
      mesh,
      velocity: new THREE.Vector3(i * 0.48, -3.55 - Math.abs(i) * 0.18, 0),
      radius: 0.32,
    });
  }
}

function createEggMesh(size) {
  const mesh = new THREE.Mesh(geometries.sphere, materials.egg);
  mesh.scale.set(size * 0.78, size * 1.16, size * 0.78);
  return mesh;
}

function createGiftMesh() {
  const sprite = new THREE.Sprite(spriteMaterials.gift.clone());
  sprite.scale.set(0.78, 0.78, 1);
  return sprite;
}

function destroyEnemy(index) {
  const enemy = enemies[index];
  state.score += enemy.score;
  state.shake = enemy.isBoss ? 0.9 : Math.max(state.shake, 0.34);
  burstFeathers(enemy.group.position, enemy.isBoss ? 34 : 14, enemy.isBoss ? 2.6 : 1.2);

  if (!enemy.isBoss && Math.random() < 0.16) {
    spawnPowerup(enemy.group.position);
  }
  if (enemy.isBoss) {
    state.power = Math.min(5, state.power + 1);
    spawnPowerup(enemy.group.position.clone().add(new THREE.Vector3(-0.8, 0, 0)));
    spawnPowerup(enemy.group.position.clone().add(new THREE.Vector3(0.8, 0, 0)));
  }

  scene.remove(enemy.group);
  enemies.splice(index, 1);
}

function destroyMeteor(index, byShot) {
  const meteor = meteors[index];
  if (!meteor) return;

  if (byShot) {
    state.score += Math.round(80 * meteor.scale);
  }

  state.shake = Math.max(state.shake, byShot ? 0.24 : 0.7);
  burstFeathers(meteor.mesh.position, byShot ? 10 : 18, byShot ? 1.5 : 2.6, materials.flame);
  scene.remove(meteor.mesh);
  meteors.splice(index, 1);
}

function spawnPowerup(position) {
  const mesh = createGiftMesh();
  mesh.position.copy(position);
  mesh.position.z = 0.16;
  scene.add(mesh);
  powerups.push({ mesh });
}

function burstFeathers(position, count, speed, material = materials.feather) {
  for (let i = 0; i < count; i += 1) {
    const particleMaterial = material.clone();
    particleMaterial.transparent = true;
    particleMaterial.opacity = 0.82;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.28), particleMaterial);
    mesh.position.copy(position);
    mesh.position.z += THREE.MathUtils.randFloat(0.04, 0.28);
    mesh.rotation.z = Math.random() * Math.PI * 2;
    scene.add(mesh);

    particles.push({
      mesh,
      velocity: new THREE.Vector3(
        THREE.MathUtils.randFloatSpread(speed * 2.4),
        THREE.MathUtils.randFloat(-0.2, speed * 1.9),
        THREE.MathUtils.randFloatSpread(0.2),
      ),
      spin: THREE.MathUtils.randFloatSpread(8),
      life: THREE.MathUtils.randFloat(0.35, 0.95),
      maxLife: 0.95,
    });
  }
}

function isGamePointerEvent(event) {
  return state.phase === 'playing' && event.target === canvas;
}

function damagePlayer() {
  state.lives -= 1;
  state.power = Math.max(1, state.power - 1);
  state.invulnerable = 2.7;
  state.shake = 1;
  burstFeathers(player.group.position, 18, 2.2, materials.beam);

  if (state.lives <= 0) {
    state.phase = 'gameover';
    overlay.querySelector('h1').textContent = 'Oyun Bitti';
    startButton.textContent = 'Yeniden';
    stageBanner?.classList.remove('is-visible');
    overlay.classList.add('is-visible');
  }
}

function resetGame() {
  state.score = 0;
  state.lives = 3;
  state.wave = 1;
  state.section = 1;
  state.stageWave = 1;
  state.stageIndex = 0;
  state.stageMessageTimer = 0;
  state.power = 1;
  state.fireTimer = 0;
  state.meteorTimer = 8;
  state.waveTimer = 0;
  state.invulnerable = 1.4;
  state.shake = 0;
  clearEnemies();
  clearObjects(playerShots);
  clearObjects(enemyShots);
  clearObjects(powerups);
  clearObjects(meteors);
  clearObjects(particles);
  player.group.position.set(0, -8.2, 0);
  player.target.set(0, -8.2, 0);
  overlay.querySelector('h1').textContent = 'Kumes Istilasi';
  startButton.textContent = 'Oyna';
  spawnWave();
  updateHud();
}

function clearEnemies() {
  for (const enemy of enemies) {
    scene.remove(enemy.group);
  }
  enemies.length = 0;
}

function clearObjects(list) {
  for (const item of list) {
    scene.remove(item.mesh);
  }
  list.length = 0;
}

function updateHud() {
  scoreEl.textContent = state.score.toLocaleString('tr-TR');
  waveEl.textContent = `${state.section}-${state.stageWave}`;
  livesEl.textContent = state.lives.toString();
  powerEl.textContent = state.power.toString();
}

function animateIdle(dt) {
  const stars = scene.getObjectByName('starfield');
  if (stars) {
    const stageSpeed = currentStage().starSpeed;
    stars.position.y -= dt * (state.phase === 'playing' && !state.paused ? stageSpeed : 0.18);
    if (stars.position.y < -12) stars.position.y = 0;
  }

  if (state.phase !== 'playing') {
    player.group.rotation.y = Math.sin(clock.elapsedTime * 1.8) * 0.08;
    player.group.position.x += Math.sin(clock.elapsedTime * 1.6) * dt * 0.32;
  }
}

function updateStageBanner() {
  if (!stageBanner) return;
  stageBanner.classList.toggle('is-visible', state.stageMessageTimer > 0);
}

function updateCameraShake() {
  const shake = state.shake;
  camera.position.x = (Math.random() - 0.5) * shake * 0.14;
  camera.position.y = (Math.random() - 0.5) * shake * 0.14;
}

function movePointerTarget(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  raycaster.setFromCamera(pointer, camera);
  raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), pointerWorld);
  player.target.x = pointerWorld.x;
  player.target.y = pointerWorld.y;
}

function resize() {
  const aspect = window.innerWidth / window.innerHeight;
  const viewH = GAME_HEIGHT;
  const viewW = viewH * aspect;
  camera.left = -viewW / 2;
  camera.right = viewW / 2;
  camera.top = viewH / 2;
  camera.bottom = -viewH / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
