import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ecbff);
scene.fog = new THREE.Fog(0x8ecbff, 45, 180);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 300);
camera.position.set(0, 1.7, 8);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const ambient = new THREE.AmbientLight(0xffffff, 0.72);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xfff6d1, 1.2);
sun.position.set(30, 45, 15);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 180;
sun.shadow.camera.left = -80;
sun.shadow.camera.right = 80;
sun.shadow.camera.top = 80;
sun.shadow.camera.bottom = -80;
scene.add(sun);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshStandardMaterial({ color: 0x7ebf6a, roughness: 0.95, metalness: 0.02 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const road = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 16),
  new THREE.MeshStandardMaterial({ color: 0x3f4858, roughness: 0.9, metalness: 0.05 })
);
road.rotation.x = -Math.PI / 2;
road.position.y = 0.02;
road.receiveShadow = true;
scene.add(road);

const structures = [];
function addBoxStructure({ x, y, z, w, h, d, color }) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.08 })
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  structures.push(mesh);
}

[
  { x: 0, z: -62, w: 128, h: 14, d: 2 },
  { x: 0, z: 62, w: 128, h: 14, d: 2 },
  { x: -62, z: 0, w: 2, h: 14, d: 128 },
  { x: 62, z: 0, w: 2, h: 14, d: 128 }
].forEach((wall) => addBoxStructure({ ...wall, y: wall.h / 2, color: 0xb6d1ff }));

const buildingColors = [0xdbeafe, 0xbfdbfe, 0xc4b5fd, 0xddd6fe, 0xfef3c7];
[
  [-40, -40, 12, 20, 16], [-22, -34, 11, 13, 13], [32, -42, 14, 24, 16], [45, -25, 10, 14, 14],
  [-45, 35, 11, 22, 14], [-25, 45, 13, 15, 18], [24, 30, 12, 20, 13], [40, 40, 11, 16, 16],
  [0, -18, 10, 12, 12], [0, 24, 10, 12, 12], [-15, 0, 8, 10, 10], [15, 0, 8, 10, 10]
].forEach(([x, z, h, w, d]) => {
  const color = buildingColors[Math.floor(Math.random() * buildingColors.length)];
  addBoxStructure({ x, y: h / 2, z, w, h, d, color });
});

const jumpPlatformColor = 0xf4a261;
[
  { x: -10, z: 14, w: 3.2, h: 1.2, d: 3.2 },
  { x: -5.5, z: 14, w: 3.2, h: 2.1, d: 3.2 },
  { x: -1, z: 14, w: 3.2, h: 3.1, d: 3.2 },
  { x: 3.5, z: 14, w: 3.2, h: 4.1, d: 3.2 },
  { x: 8, z: 14, w: 3.2, h: 5, d: 3.2 },
  { x: 12.5, z: 14, w: 3.2, h: 6.1, d: 3.2 },
  { x: -22, z: -8, w: 4.2, h: 2.2, d: 4.2 },
  { x: -16.5, z: -8, w: 4.2, h: 3.2, d: 4.2 },
  { x: -11, z: -8, w: 4.2, h: 4.2, d: 4.2 },
  { x: 22, z: 6, w: 4.4, h: 2.8, d: 4.4 },
  { x: 27, z: 6, w: 4.4, h: 3.9, d: 4.4 },
  { x: 32, z: 6, w: 4.4, h: 5, d: 4.4 }
].forEach((platform) => {
  addBoxStructure({ ...platform, y: platform.h / 2, color: jumpPlatformColor });
});

const scoreEl = document.getElementById('score');
const healthEl = document.getElementById('health');
const enemyCountEl = document.getElementById('enemy-count');
const weaponNameEl = document.getElementById('weapon-name');
const statusEl = document.getElementById('status');
const gameOverEl = document.getElementById('game-over');
const restartButtonEl = document.getElementById('restart-button');

const keys = new Set();
const bullets = [];
const enemyBullets = [];
const enemies = [];
const enemyPool = new THREE.Group();
scene.add(enemyPool);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(0, 0);
const direction = new THREE.Vector3();
const velocity = new THREE.Vector3();

let yaw = Math.PI;
let pitch = 0;
let score = 0;
const START_HEALTH = 100;
let health = START_HEALTH;
let lastShot = 0;
let gameOver = false;
const BASE_FOV = 75;
const AIM_FOV = 28;
const BASE_LOOK_SPEED = 0.0022;
const AIM_LOOK_SPEED = 0.0011;
let isAiming = false;
let mouseAimHeld = false;
let isPaused = true;
let damageCooldown = 0;
let verticalVelocity = 0;
let onGround = true;
let jumpQueued = false;
let weaponSwitchLatched = false;

const weapons = {
  rifle: {
    label: 'Rifle',
    cooldown: 0.14,
    damage: 1,
    bulletSpeed: 72,
    bulletLife: 1.3,
    bulletSize: 0.08,
    bulletColor: 0xfff0a6,
    maxHits: 1
  },
  beam: {
    label: 'Beam',
    cooldown: 0.36,
    damage: 2,
    bulletSpeed: 110,
    bulletLife: 0.7,
    bulletSize: 0.12,
    bulletColor: 0x67e8f9,
    maxHits: 3
  },
  bomb: {
    label: 'Bomb',
    cooldown: 0.9,
    damage: 0,
    bulletSpeed: 42,
    bulletLife: 1.8,
    bulletSize: 0.2,
    bulletColor: 0xf59e0b,
    maxHits: 0,
    explosionRadius: 7.8,
    explosionDamage: 5
  }
};
const weaponOrder = ['rifle', 'beam', 'bomb'];
let currentWeapon = 'rifle';
const lastShotByWeapon = { rifle: 0, beam: 0, bomb: 0 };

const worldLimit = 58;
const player = {
  moveSpeed: 34,
  lookSpeed: BASE_LOOK_SPEED,
  gamepadLookSpeed: 2.8,
  shootCooldown: 0.14,
  radius: 0.8,
  eyeHeight: 1.7,
  jumpSpeed: 23.6,
  position: new THREE.Vector3(0, 1.7, 8)
};

function setStatus(text) {
  statusEl.textContent = text;
}

function setAiming(active) {
  if (gameOver) {
    isAiming = false;
  } else {
    isAiming = active;
  }
  document.body.classList.toggle('aiming', isAiming);
}

function endGame() {
  gameOver = true;
  setStatus('ゲームオーバー: 画面のリスタートボタンを押してください');
  gameOverEl.classList.add('visible');
  gameOverEl.setAttribute('aria-hidden', 'false');
  document.body.classList.add('game-over');
  setAiming(false);
  if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
}

function isPositionBlocked(position, margin = 1.2) {
  return structures.some((structure) => {
    const halfW = structure.geometry.parameters.width / 2 + margin;
    const halfD = structure.geometry.parameters.depth / 2 + margin;
    return Math.abs(position.x - structure.position.x) < halfW && Math.abs(position.z - structure.position.z) < halfD;
  });
}

function randomSpawnPosition(minPlayerDistance = 14) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const candidate = new THREE.Vector3((Math.random() - 0.5) * 96, 1.2, (Math.random() - 0.5) * 96);
    if (!isPositionBlocked(candidate) && candidate.distanceTo(player.position) > minPlayerDistance) return candidate;
  }
  return new THREE.Vector3((Math.random() - 0.5) * 40, 1.2, (Math.random() - 0.5) * 40);
}

function pickRangedSpawnPosition() {
  const preferredSpawns = [
    new THREE.Vector3(-48, 1.2, -20),
    new THREE.Vector3(48, 1.2, 20),
    new THREE.Vector3(-44, 1.2, 34),
    new THREE.Vector3(44, 1.2, -34)
  ];

  for (const candidate of preferredSpawns) {
    if (!isPositionBlocked(candidate, 1.1) && candidate.distanceTo(player.position) > 16) return candidate.clone();
  }

  return randomSpawnPosition(16);
}

function createEnemy(kind = 'melee') {
  const isRanged = kind === 'ranged';
  const isBoss = kind === 'boss';
  const isFlying = kind === 'flying';
  const isSuicide = kind === 'suicide';
  const enemy = new THREE.Group();

  const palette = isBoss
    ? { body: 0x7c3aed, detail: 0xc4b5fd, emissive: 0x1a103f }
    : isSuicide
      ? { body: 0xf97316, detail: 0xfdba74, emissive: 0x3a1200 }
      : isFlying
        ? { body: 0x0f766e, detail: 0xa7f3d0, emissive: 0x042f2e }
        : isRanged
          ? { body: 0x3b82f6, detail: 0x93c5fd, emissive: 0x061634 }
          : { body: 0xb91c1c, detail: 0xf87171, emissive: 0x2d0707 };

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: palette.body,
    emissive: palette.emissive,
    roughness: 0.52,
    metalness: 0.18
  });
  const detailMaterial = new THREE.MeshStandardMaterial({
    color: palette.detail,
    roughness: 0.58,
    metalness: 0.12
  });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.1, 0.5), bodyMaterial);
  torso.position.y = 1.35;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 20), detailMaterial);
  head.position.y = 2.18;
  const leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.55, 4, 10), detailMaterial);
  leftArm.position.set(-0.62, 1.38, 0);
  leftArm.rotation.z = Math.PI / 18;
  const rightArm = leftArm.clone();
  rightArm.position.x = 0.62;
  rightArm.rotation.z = -Math.PI / 18;
  const leftLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.65, 4, 10), detailMaterial);
  leftLeg.position.set(-0.24, 0.56, 0);
  const rightLeg = leftLeg.clone();
  rightLeg.position.x = 0.24;
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.16, 0.36),
    new THREE.MeshStandardMaterial({
      color: isBoss ? 0xe9d5ff : isSuicide ? 0xffedd5 : isFlying ? 0xccfbf1 : isRanged ? 0xbfdbfe : 0xfee2e2,
      emissive: 0x111111,
      roughness: 0.3,
      metalness: 0.45
    })
  );
  visor.position.set(0, 2.16, 0.18);

  enemy.add(torso, head, leftArm, rightArm, leftLeg, rightLeg, visor);

  if (isBoss) {
    const shoulder = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.36, 0.65), detailMaterial);
    shoulder.position.set(0, 1.78, 0);
    enemy.add(shoulder);
    enemy.scale.setScalar(1.9);
  }

  if (isFlying) {
    const rotorRing = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.08, 8, 24), detailMaterial);
    rotorRing.rotation.x = Math.PI / 2;
    rotorRing.position.y = 2.46;
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), bodyMaterial);
    core.position.y = 2.46;
    enemy.add(rotorRing, core);
  }

  if (isSuicide) {
    const dangerCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xffedd5, emissive: 0x6b2100, roughness: 0.25, metalness: 0.2 })
    );
    dangerCore.position.y = 2.46;
    const spikeGeom = new THREE.ConeGeometry(0.11, 0.42, 8);
    const spike1 = new THREE.Mesh(spikeGeom, detailMaterial);
    const spike2 = new THREE.Mesh(spikeGeom, detailMaterial);
    const spike3 = new THREE.Mesh(spikeGeom, detailMaterial);
    spike1.position.set(0.36, 2.42, 0);
    spike1.rotation.z = Math.PI / 2;
    spike2.position.set(-0.2, 2.42, 0.3);
    spike2.rotation.z = -Math.PI / 2.6;
    spike2.rotation.x = Math.PI / 3;
    spike3.position.set(-0.2, 2.42, -0.3);
    spike3.rotation.z = -Math.PI / 2.6;
    spike3.rotation.x = -Math.PI / 3;
    enemy.add(dangerCore, spike1, spike2, spike3);
  }

  enemy.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      child.userData.enemyRoot = enemy;
    }
  });

  const spawn = isBoss
    ? randomSpawnPosition(24)
    : isSuicide
      ? randomSpawnPosition(18)
      : isFlying
        ? randomSpawnPosition(20)
        : isRanged
          ? pickRangedSpawnPosition()
          : randomSpawnPosition();
  enemy.position.copy(spawn);
  enemy.userData = {
    speed: isBoss ? 1.9 + Math.random() * 0.7 : isSuicide ? 9.5 + Math.random() * 2.8 : isFlying ? 2.8 + Math.random() * 1.4 : isRanged ? 2.2 + Math.random() * 1.2 : 2.6 + Math.random() * 1.7,
    hp: isBoss ? 26 : isSuicide ? 5 : isFlying ? 6 : isRanged ? 4 : 3,
    wobble: Math.random() * Math.PI * 2,
    attackCooldown: Math.random() * 0.7,
    kind,
    isRanged,
    isBoss,
    isFlying,
    isSuicide,
    baseY: isBoss ? 0.15 : isSuicide ? 7.1 : isFlying ? 6.4 : 0.04,
    bobAmp: isBoss ? 0.05 : isSuicide ? 0.58 : isFlying ? 0.45 : 0.08,
    collisionRadius: isBoss ? 1.35 : isSuicide ? 1.05 : isFlying ? 0.9 : 0.72,
    coreMaterial: bodyMaterial
  };
  enemyPool.add(enemy);
  enemies.push(enemy);
}


const MELEE_ENEMY_COUNT = 14;
const RANGED_ENEMY_COUNT = 2;
const BOSS_ENEMY_COUNT = 1;
const FLYING_ENEMY_COUNT = 2;
const SUICIDE_ENEMY_COUNT = 2;
for (let i = 0; i < MELEE_ENEMY_COUNT; i += 1) createEnemy('melee');
for (let i = 0; i < RANGED_ENEMY_COUNT; i += 1) createEnemy('ranged');
for (let i = 0; i < BOSS_ENEMY_COUNT; i += 1) createEnemy('boss');
for (let i = 0; i < FLYING_ENEMY_COUNT; i += 1) createEnemy('flying');
for (let i = 0; i < SUICIDE_ENEMY_COUNT; i += 1) createEnemy('suicide');

function updateHud() {
  scoreEl.textContent = String(score);
  healthEl.textContent = String(Math.max(0, Math.floor(health)));
  enemyCountEl.textContent = String(enemies.length);
  if (weaponNameEl) weaponNameEl.textContent = weapons[currentWeapon].label;
}

function setWeapon(weaponKey) {
  if (!weapons[weaponKey] || currentWeapon === weaponKey) return;
  currentWeapon = weaponKey;
  setStatus(`武器切替: ${weapons[weaponKey].label}`);
  updateHud();
}

function cycleWeapon(step) {
  const idx = weaponOrder.indexOf(currentWeapon);
  const next = (idx + step + weaponOrder.length) % weaponOrder.length;
  setWeapon(weaponOrder[next]);
}

function getForwardVector() {
  return new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
}

function getRightVector(forward) {
  return new THREE.Vector3(-forward.z, 0, forward.x);
}

function damageEnemy(enemy, damage) {
  enemy.userData.hp -= damage;
  enemy.userData.coreMaterial?.emissive.setHex(0x8b0000);
  if (enemy.userData.hp <= 0) {
    score += 10;
    enemyPool.remove(enemy);
    enemies.splice(enemies.indexOf(enemy), 1);
    createEnemy(enemy.userData.kind || (enemy.userData.isRanged ? "ranged" : "melee"));
  }
}

function spawnBullet(now, weapon) {
  if (gameOver) return false;
  if (now - lastShotByWeapon[currentWeapon] < weapon.cooldown) return false;
  lastShotByWeapon[currentWeapon] = now;
  lastShot = now;

  direction.set(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
  const bullet = new THREE.Mesh(
    new THREE.SphereGeometry(weapon.bulletSize, 10, 10),
    new THREE.MeshBasicMaterial({ color: weapon.bulletColor })
  );
  bullet.position.copy(camera.position).addScaledVector(direction, 0.75);
  bullet.userData = { velocity: direction.clone().multiplyScalar(weapon.bulletSpeed), life: weapon.bulletLife, weaponKey: currentWeapon };
  bullets.push(bullet);
  scene.add(bullet);
  return true;
}

function handleShoot(weapon) {
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(enemies, true);
  if (!hits.length) return;

  if (weapon.maxHits === 0) return;

  const maxHits = Math.max(1, weapon.maxHits || 1);
  const affected = new Set();
  for (let i = 0; i < hits.length && affected.size < maxHits; i += 1) {
    const hitObject = hits[i].object;
    const enemyRoot = hitObject.userData.enemyRoot || hitObject.parent;
    if (!enemyRoot || affected.has(enemyRoot) || !enemies.includes(enemyRoot)) continue;
    affected.add(enemyRoot);
    damageEnemy(enemyRoot, weapon.damage);
  }
}

function fireCurrentWeapon(now) {
  const weapon = weapons[currentWeapon];
  const didSpawn = spawnBullet(now, weapon);
  if (didSpawn) handleShoot(weapon);
}

document.addEventListener('keydown', (event) => {
  keys.add(event.code);
  if (event.code === 'Space') {
    event.preventDefault();
    jumpQueued = true;
  }
  if (event.code === 'Digit1') setWeapon('rifle');
  if (event.code === 'Digit2') setWeapon('beam');
  if (event.code === 'Digit3') setWeapon('bomb');
});
document.addEventListener('keyup', (event) => keys.delete(event.code));

restartButtonEl?.addEventListener('click', () => {
  window.location.reload();
});

renderer.domElement.addEventListener('click', () => {
  if (gameOver) return;
  if (document.pointerLockElement !== renderer.domElement) {
    renderer.domElement.requestPointerLock();
  }
});

document.addEventListener('mousedown', (event) => {
  if (event.button !== 0 || document.pointerLockElement !== renderer.domElement || gameOver) return;
  const now = performance.now() / 1000;
  fireCurrentWeapon(now);
});

document.addEventListener('contextmenu', (event) => {
  if (document.pointerLockElement === renderer.domElement) event.preventDefault();
});

document.addEventListener('mousedown', (event) => {
  if (event.button === 2 && document.pointerLockElement === renderer.domElement && !gameOver) {
    event.preventDefault();
    mouseAimHeld = true;
    setAiming(true);
  }
});

document.addEventListener('mouseup', (event) => {
  if (event.button === 2) {
    mouseAimHeld = false;
    setAiming(false);
  }
});

document.addEventListener('pointerlockchange', () => {
  if (gameOver) return;

  if (document.pointerLockElement === renderer.domElement) {
    isPaused = false;
    setStatus('戦闘中: 敵を狙って撃破しよう');
  } else {
    isPaused = true;
    setAiming(false);
    setStatus('一時停止中: 画面をクリックして再開');
  }
});

document.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement !== renderer.domElement || gameOver) return;
  const lookSpeed = isAiming ? AIM_LOOK_SPEED : player.lookSpeed;
  yaw -= event.movementX * lookSpeed;
  pitch -= event.movementY * lookSpeed;
  pitch = Math.max(-1.3, Math.min(1.3, pitch));
});

function applyGamepad(delta, now) {
  const pad = navigator.getGamepads?.()[0];
  if (!pad) return;

  const lx = Math.abs(pad.axes[0]) > 0.15 ? pad.axes[0] : 0;
  const ly = Math.abs(pad.axes[1]) > 0.15 ? pad.axes[1] : 0;
  const rx = Math.abs(pad.axes[2]) > 0.15 ? pad.axes[2] : 0;
  const ry = Math.abs(pad.axes[3]) > 0.15 ? pad.axes[3] : 0;

  const aimingWithPad = pad.buttons[6]?.value > 0.4;
  const shouldAim = aimingWithPad || mouseAimHeld;
  setAiming(shouldAim && document.pointerLockElement === renderer.domElement);

  const lookScale = isAiming ? 0.45 : 1;
  yaw -= rx * player.gamepadLookSpeed * delta * lookScale;
  pitch -= ry * player.gamepadLookSpeed * delta * lookScale;
  pitch = Math.max(-1.3, Math.min(1.3, pitch));

  const forward = getForwardVector();
  const right = getRightVector(forward);
  velocity.addScaledVector(forward, -ly * player.moveSpeed * delta);
  velocity.addScaledVector(right, lx * player.moveSpeed * delta);

  const shootPressed = pad.buttons[7]?.value > 0.5 || pad.buttons[5]?.pressed;
  if (shootPressed) fireCurrentWeapon(now);

  const switchLeft = pad.buttons[14]?.pressed;
  const switchRight = pad.buttons[15]?.pressed;
  if ((switchLeft || switchRight) && !weaponSwitchLatched) {
    cycleWeapon(switchRight ? 1 : -1);
    weaponSwitchLatched = true;
  }
  if (!switchLeft && !switchRight) weaponSwitchLatched = false;

  if (pad.buttons[0]?.pressed) jumpQueued = true;
}

function getSupportHeight(x, z, cameraY) {
  let supportY = player.eyeHeight;

  for (const structure of structures) {
    const halfW = structure.geometry.parameters.width / 2 + 0.1;
    const halfD = structure.geometry.parameters.depth / 2 + 0.1;
    const top = structure.position.y + structure.geometry.parameters.height / 2;
    const candidateY = top + player.eyeHeight;

    if (
      Math.abs(x - structure.position.x) <= halfW
      && Math.abs(z - structure.position.z) <= halfD
      && cameraY >= candidateY - 2.6
      && candidateY > supportY
    ) {
      supportY = candidateY;
    }
  }

  return supportY;
}

function updateVertical(delta) {
  if (keys.has('Space')) jumpQueued = true;

  if (jumpQueued && onGround) {
    verticalVelocity = player.jumpSpeed;
    onGround = false;
  }

  jumpQueued = false;
  verticalVelocity -= 18 * delta;
  player.position.y += verticalVelocity * delta;

  const supportY = getSupportHeight(player.position.x, player.position.z, player.position.y);
  if (player.position.y <= supportY) {
    player.position.y = supportY;
    verticalVelocity = 0;
    onGround = true;
  }
}

function resolvePlayerVsStructures() {
  for (const structure of structures) {
    const halfW = structure.geometry.parameters.width / 2 + player.radius;
    const halfD = structure.geometry.parameters.depth / 2 + player.radius;
    const top = structure.position.y + structure.geometry.parameters.height / 2;
    const feetY = player.position.y - player.eyeHeight;

    if (feetY > top - 0.05) continue;

    const dx = player.position.x - structure.position.x;
    const dz = player.position.z - structure.position.z;

    if (Math.abs(dx) < halfW && Math.abs(dz) < halfD) {
      const penX = halfW - Math.abs(dx);
      const penZ = halfD - Math.abs(dz);
      if (penX < penZ) player.position.x += Math.sign(dx || 1) * penX;
      else player.position.z += Math.sign(dz || 1) * penZ;
      velocity.multiplyScalar(0.6);
    }
  }
}

function updateMovement(delta) {
  const forwardInput = Number(keys.has('KeyW')) - Number(keys.has('KeyS'));
  const strafeInput = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));

  if (forwardInput || strafeInput) {
    const forward = getForwardVector();
    const right = getRightVector(forward);
    velocity.addScaledVector(forward, forwardInput * player.moveSpeed * delta);
    velocity.addScaledVector(right, strafeInput * player.moveSpeed * delta);
  }

  velocity.multiplyScalar(0.82);
  player.position.add(velocity.clone().multiplyScalar(delta * 6.8));
  player.position.x = THREE.MathUtils.clamp(player.position.x, -worldLimit, worldLimit);
  player.position.z = THREE.MathUtils.clamp(player.position.z, -worldLimit, worldLimit);

  resolvePlayerVsStructures();
  updateVertical(delta);

  camera.position.copy(player.position);
  camera.rotation.set(pitch, yaw, 0, 'YXZ');
}

function explodeBomb(position, weapon) {
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(weapon.explosionRadius * 0.32, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.5 })
  );
  flash.position.copy(position);
  scene.add(flash);
  setTimeout(() => scene.remove(flash), 90);

  for (const enemy of [...enemies]) {
    const dist = enemy.position.distanceTo(position);
    if (dist <= weapon.explosionRadius) {
      const falloff = 1 - dist / weapon.explosionRadius;
      const damage = Math.max(1, Math.round(weapon.explosionDamage * falloff));
      damageEnemy(enemy, damage);
    }
  }
}

function updateBullets(delta) {
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const bullet = bullets[i];
    const isBomb = bullet.userData.weaponKey === 'bomb';
    bullet.position.addScaledVector(bullet.userData.velocity, delta);
    bullet.userData.life -= delta;

    const hitStructure = structures.some((structure) => {
      const halfW = structure.geometry.parameters.width / 2;
      const halfD = structure.geometry.parameters.depth / 2;
      const halfH = structure.geometry.parameters.height / 2;
      return (
        Math.abs(bullet.position.x - structure.position.x) <= halfW
        && Math.abs(bullet.position.z - structure.position.z) <= halfD
        && Math.abs(bullet.position.y - structure.position.y) <= halfH
      );
    });

    const hitGround = bullet.position.y <= 0;
    const outOfBounds = Math.abs(bullet.position.x) > 80 || Math.abs(bullet.position.z) > 80;
    if (bullet.userData.life <= 0 || hitStructure || hitGround || outOfBounds) {
      if (isBomb) {
        if (hitGround) bullet.position.y = 0;
        explodeBomb(bullet.position, weapons.bomb);
      }
      scene.remove(bullet);
      bullets.splice(i, 1);
    }
  }
}

function updateEnemyBullets(delta) {
  for (let i = enemyBullets.length - 1; i >= 0; i -= 1) {
    const bullet = enemyBullets[i];
    bullet.position.addScaledVector(bullet.userData.velocity, delta);
    bullet.userData.life -= delta;

    const hitStructure = structures.some((structure) => {
      const halfW = structure.geometry.parameters.width / 2;
      const halfD = structure.geometry.parameters.depth / 2;
      const halfH = structure.geometry.parameters.height / 2;
      return (
        Math.abs(bullet.position.x - structure.position.x) <= halfW
        && Math.abs(bullet.position.z - structure.position.z) <= halfD
        && Math.abs(bullet.position.y - structure.position.y) <= halfH
      );
    });

    const distToPlayer = bullet.position.distanceTo(player.position);
    const hitPlayer = distToPlayer < player.radius + 0.45;

    if (hitPlayer && damageCooldown <= 0) {
      health -= 7;
      damageCooldown = 0.28;
      if (health <= 0 && !gameOver) endGame();
    }

    if (
      bullet.userData.life <= 0
      || hitStructure
      || hitPlayer
      || Math.abs(bullet.position.x) > 80
      || Math.abs(bullet.position.z) > 80
    ) {
      scene.remove(bullet);
      enemyBullets.splice(i, 1);
    }
  }
}

function separateEnemies() {
  for (let i = 0; i < enemies.length; i += 1) {
    for (let j = i + 1; j < enemies.length; j += 1) {
      const a = enemies[i];
      const b = enemies[j];
      const diff = a.position.clone().sub(b.position);
      const dist = diff.length();
      const minDist = 1.2;
      if (dist > 0.001 && dist < minDist) {
        diff.normalize().multiplyScalar((minDist - dist) * 0.5);
        a.position.add(diff);
        b.position.sub(diff);
      }
    }
  }
}

function moveEnemyWithCollision(enemy, movement) {
  const proposed = enemy.position.clone().add(movement);

  proposed.x = THREE.MathUtils.clamp(proposed.x, -worldLimit, worldLimit);
  proposed.z = THREE.MathUtils.clamp(proposed.z, -worldLimit, worldLimit);

  const enemyRadius = enemy.userData.collisionRadius || 0.72;

  for (const structure of structures) {
    const halfW = structure.geometry.parameters.width / 2 + enemyRadius;
    const halfD = structure.geometry.parameters.depth / 2 + enemyRadius;

    const dx = proposed.x - structure.position.x;
    const dz = proposed.z - structure.position.z;
    if (Math.abs(dx) < halfW && Math.abs(dz) < halfD) {
      const penX = halfW - Math.abs(dx);
      const penZ = halfD - Math.abs(dz);
      if (penX < penZ) proposed.x += Math.sign(dx || 1) * penX;
      else proposed.z += Math.sign(dz || 1) * penZ;
    }
  }

  enemy.position.x = THREE.MathUtils.clamp(proposed.x, -worldLimit, worldLimit);
  enemy.position.z = THREE.MathUtils.clamp(proposed.z, -worldLimit, worldLimit);
}

function ensureEnemyComposition() {
  let rangedCount = 0;
  let meleeCount = 0;
  let bossCount = 0;
  let flyingCount = 0;
  let suicideCount = 0;
  for (const enemy of enemies) {
    if (enemy.userData.isBoss) bossCount += 1;
    else if (enemy.userData.isSuicide) suicideCount += 1;
    else if (enemy.userData.isFlying) flyingCount += 1;
    else if (enemy.userData.isRanged) rangedCount += 1;
    else meleeCount += 1;
  }

  while (rangedCount < RANGED_ENEMY_COUNT) {
    createEnemy('ranged');
    rangedCount += 1;
  }

  while (meleeCount < MELEE_ENEMY_COUNT) {
    createEnemy('melee');
    meleeCount += 1;
  }

  while (bossCount < BOSS_ENEMY_COUNT) {
    createEnemy('boss');
    bossCount += 1;
  }

  while (flyingCount < FLYING_ENEMY_COUNT) {
    createEnemy('flying');
    flyingCount += 1;
  }

  while (suicideCount < SUICIDE_ENEMY_COUNT) {
    createEnemy('suicide');
    suicideCount += 1;
  }
}

function updateEnemies(delta) {
  if (damageCooldown > 0) damageCooldown -= delta;

  for (const enemy of enemies) {
    const toPlayer = player.position.clone().sub(enemy.position);
    const dist = toPlayer.length();

    enemy.userData.wobble += delta * 6;
    enemy.position.y = enemy.userData.baseY + Math.sin(enemy.userData.wobble) * enemy.userData.bobAmp;

    toPlayer.normalize();

    if (enemy.userData.isBoss) {
      if (dist > 3.1) {
        const movement = toPlayer.clone().multiplyScalar(enemy.userData.speed * delta);
        moveEnemyWithCollision(enemy, movement);
      } else {
        enemy.userData.attackCooldown -= delta;
        if (enemy.userData.attackCooldown <= 0 && damageCooldown <= 0) {
          health -= 35;
          damageCooldown = 0.5;
          enemy.userData.attackCooldown = 1.15;
          if (health <= 0 && !gameOver) endGame();
        }
      }
    } else if (enemy.userData.isSuicide) {
      const rush = toPlayer.clone().multiplyScalar(enemy.userData.speed * delta);
      const orbit = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x).multiplyScalar(enemy.userData.speed * delta * 0.2);
      const next = enemy.position.clone().add(rush).add(orbit);
      next.x = THREE.MathUtils.clamp(next.x, -worldLimit, worldLimit);
      next.z = THREE.MathUtils.clamp(next.z, -worldLimit, worldLimit);
      enemy.position.x = next.x;
      enemy.position.z = next.z;

      if (dist < player.radius + enemy.userData.collisionRadius + 0.35) {
        const boom = new THREE.Mesh(
          new THREE.SphereGeometry(1.1, 14, 14),
          new THREE.MeshBasicMaterial({ color: 0xfb923c, transparent: true, opacity: 0.52 })
        );
        boom.position.copy(enemy.position);
        scene.add(boom);
        setTimeout(() => scene.remove(boom), 120);

        if (damageCooldown <= 0) {
          health -= 28;
          damageCooldown = 0.4;
          if (health <= 0 && !gameOver) endGame();
        }

        enemyPool.remove(enemy);
        enemies.splice(enemies.indexOf(enemy), 1);
        continue;
      }
    } else if (enemy.userData.isFlying) {
      const circling = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x).multiplyScalar(enemy.userData.speed * delta * 0.65);
      const closing = toPlayer.clone().multiplyScalar(enemy.userData.speed * delta * (dist > 13 ? 0.55 : -0.25));
      const next = enemy.position.clone().add(circling).add(closing);
      next.x = THREE.MathUtils.clamp(next.x, -worldLimit, worldLimit);
      next.z = THREE.MathUtils.clamp(next.z, -worldLimit, worldLimit);
      enemy.position.x = next.x;
      enemy.position.z = next.z;

      enemy.userData.attackCooldown -= delta;
      if (enemy.userData.attackCooldown <= 0 && dist < 30) {
        const shotDir = player.position.clone().sub(enemy.position).normalize();
        const enemyBullet = new THREE.Mesh(
          new THREE.SphereGeometry(0.13, 10, 10),
          new THREE.MeshBasicMaterial({ color: 0x5eead4 })
        );
        enemyBullet.position.copy(enemy.position).add(new THREE.Vector3(0, 0.15, 0)).addScaledVector(shotDir, 0.8);
        enemyBullet.userData = { velocity: shotDir.multiplyScalar(34), life: 2.4 };
        enemyBullets.push(enemyBullet);
        scene.add(enemyBullet);
        enemy.userData.attackCooldown = 0.7 + Math.random() * 0.45;
      }
    } else if (!enemy.userData.isRanged) {
      if (dist > 2.1) {
        const movement = toPlayer.clone().multiplyScalar(enemy.userData.speed * delta);
        moveEnemyWithCollision(enemy, movement);
      } else {
        enemy.userData.attackCooldown -= delta;
        if (enemy.userData.attackCooldown <= 0 && damageCooldown <= 0) {
          health -= 10;
          damageCooldown = 0.35;
          enemy.userData.attackCooldown = 0.7;
          if (health <= 0 && !gameOver) endGame();
        }
      }
    } else {
      const idealRange = 13;
      if (dist < idealRange - 1.5) {
        moveEnemyWithCollision(enemy, toPlayer.clone().multiplyScalar(-enemy.userData.speed * delta));
      } else if (dist > idealRange + 6) {
        moveEnemyWithCollision(enemy, toPlayer.clone().multiplyScalar(enemy.userData.speed * delta * 0.9));
      }

      enemy.userData.attackCooldown -= delta;
      if (enemy.userData.attackCooldown <= 0 && dist < 34 && dist > 5.5) {
        const shotDir = player.position.clone().sub(enemy.position).normalize();
        const enemyBullet = new THREE.Mesh(
          new THREE.SphereGeometry(0.11, 10, 10),
          new THREE.MeshBasicMaterial({ color: 0x60a5fa })
        );
        enemyBullet.position.copy(enemy.position).add(new THREE.Vector3(0, 1.45, 0)).addScaledVector(shotDir, 0.9);
        enemyBullet.userData = { velocity: shotDir.multiplyScalar(30), life: 2.2 };
        enemyBullets.push(enemyBullet);
        scene.add(enemyBullet);
        enemy.userData.attackCooldown = 0.85 + Math.random() * 0.5;
      }
    }

    enemy.lookAt(player.position.x, enemy.position.y, player.position.z);
    enemy.userData.coreMaterial?.emissive.lerp(new THREE.Color(enemy.userData.isBoss ? 0x1a103f : enemy.userData.isSuicide ? 0x3a1200 : enemy.userData.isFlying ? 0x042f2e : enemy.userData.isRanged ? 0x061634 : 0x2d0707), 0.08);
  }

  separateEnemies();
  ensureEnemyComposition();
}

let prev = performance.now();
function animate(nowMs) {
  const now = nowMs / 1000;
  const delta = Math.min(0.033, (nowMs - prev) / 1000);
  prev = nowMs;

  if (!gameOver && !isPaused) {
    applyGamepad(delta, now);
    updateMovement(delta);
    updateBullets(delta);
    updateEnemyBullets(delta);
    updateEnemies(delta);
  }

  const targetFov = isAiming ? AIM_FOV : BASE_FOV;
  camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 0.2);
  camera.updateProjectionMatrix();

  updateHud();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

gameOverEl.classList.remove('visible');
gameOverEl.setAttribute('aria-hidden', 'true');
health = START_HEALTH;
isPaused = true;
verticalVelocity = 0;
onGround = true;
jumpQueued = false;
setAiming(false);
camera.fov = BASE_FOV;
camera.updateProjectionMatrix();
player.position.y = player.eyeHeight;
setStatus('開始待機中: 画面をクリックして開始');
updateHud();
requestAnimationFrame(animate);
