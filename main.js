import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ecbff);
scene.fog = new THREE.Fog(0x8ecbff, 45, 180);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 300);
camera.position.set(0, 1.7, 8);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

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

const boundaryMaterial = 0xb6d1ff;
[
  { x: 0, z: -62, w: 128, h: 14, d: 2 },
  { x: 0, z: 62, w: 128, h: 14, d: 2 },
  { x: -62, z: 0, w: 2, h: 14, d: 128 },
  { x: 62, z: 0, w: 2, h: 14, d: 128 }
].forEach((wall) => {
  addBoxStructure({
    x: wall.x,
    y: wall.h / 2,
    z: wall.z,
    w: wall.w,
    h: wall.h,
    d: wall.d,
    color: boundaryMaterial
  });
});

const buildingColors = [0xdbeafe, 0xbfdbfe, 0xc4b5fd, 0xddd6fe, 0xfef3c7];
const buildingLayout = [
  [-40, -40, 12, 20, 16],
  [-22, -34, 11, 13, 13],
  [32, -42, 14, 24, 16],
  [45, -25, 10, 14, 14],
  [-45, 35, 11, 22, 14],
  [-25, 45, 13, 15, 18],
  [24, 30, 12, 20, 13],
  [40, 40, 11, 16, 16],
  [0, -18, 10, 12, 12],
  [0, 24, 10, 12, 12],
  [-15, 0, 8, 10, 10],
  [15, 0, 8, 10, 10]
];

for (const [x, z, h, w, d] of buildingLayout) {
  const color = buildingColors[Math.floor(Math.random() * buildingColors.length)];
  addBoxStructure({ x, y: h / 2, z, w, h, d, color });
}

const scoreEl = document.getElementById('score');
const healthEl = document.getElementById('health');
const enemyCountEl = document.getElementById('enemy-count');
const statusEl = document.getElementById('status');

const keys = new Set();
const bullets = [];
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
let health = 100;
let lastShot = 0;
let gameOver = false;

const worldLimit = 58;
const player = {
  moveSpeed: 13,
  lookSpeed: 0.0022,
  gamepadLookSpeed: 2.8,
  shootCooldown: 0.14,
  radius: 0.8,
  position: new THREE.Vector3(0, 1.7, 8)
};

function setStatus(text) {
  statusEl.textContent = text;
}

function randomSpawnPosition() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const candidate = new THREE.Vector3((Math.random() - 0.5) * 96, 1.2, (Math.random() - 0.5) * 96);
    const blocked = structures.some((structure) => {
      const halfW = structure.geometry.parameters.width / 2 + 1.2;
      const halfD = structure.geometry.parameters.depth / 2 + 1.2;
      return (
        Math.abs(candidate.x - structure.position.x) < halfW
        && Math.abs(candidate.z - structure.position.z) < halfD
      );
    });
    if (!blocked && candidate.distanceTo(player.position) > 14) return candidate;
  }
  return new THREE.Vector3((Math.random() - 0.5) * 40, 1.2, (Math.random() - 0.5) * 40);
}

function createEnemy() {
  const enemy = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.65, 1.2, 4, 10),
    new THREE.MeshStandardMaterial({ color: 0xdc2626, emissive: 0x2d0707, roughness: 0.35 })
  );
  enemy.castShadow = true;
  enemy.receiveShadow = true;
  enemy.position.copy(randomSpawnPosition());
  enemy.userData = {
    speed: 2 + Math.random() * 1.5,
    hp: 2,
    wobble: Math.random() * Math.PI * 2,
    attackCooldown: Math.random()
  };
  enemyPool.add(enemy);
  enemies.push(enemy);
}

for (let i = 0; i < 14; i += 1) createEnemy();

function updateHud() {
  scoreEl.textContent = String(score);
  healthEl.textContent = String(Math.max(0, Math.floor(health)));
  enemyCountEl.textContent = String(enemies.length);
}

function spawnBullet(now) {
  if (now - lastShot < player.shootCooldown || gameOver) return;
  lastShot = now;

  direction.set(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
  const bullet = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff0a6 })
  );
  bullet.position.copy(camera.position).addScaledVector(direction, 0.75);
  bullet.userData = {
    velocity: direction.clone().multiplyScalar(72),
    life: 1.3
  };
  bullets.push(bullet);
  scene.add(bullet);
}

function handleShoot() {
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(enemies);
  if (!hits.length) return;
  const enemy = hits[0].object;
  enemy.userData.hp -= 1;
  enemy.material.emissive.setHex(0x8b0000);
  if (enemy.userData.hp <= 0) {
    score += 10;
    enemyPool.remove(enemy);
    enemies.splice(enemies.indexOf(enemy), 1);
    createEnemy();
  }
}

document.addEventListener('keydown', (event) => {
  keys.add(event.code);
  if (event.code === 'Space' && gameOver) window.location.reload();
});
document.addEventListener('keyup', (event) => keys.delete(event.code));

document.body.addEventListener('click', () => {
  renderer.domElement.requestPointerLock();
  if (document.pointerLockElement === renderer.domElement) {
    spawnBullet(performance.now() / 1000);
    handleShoot();
  }
});

document.addEventListener('mousedown', (event) => {
  if (event.button !== 0 || document.pointerLockElement !== renderer.domElement) return;
  const now = performance.now() / 1000;
  spawnBullet(now);
  handleShoot();
});

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === renderer.domElement) {
    setStatus('戦闘中: 敵を狙って撃破しよう');
  } else {
    setStatus('画面をクリックしてポインターロックを有効化してください。');
  }
});

document.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement !== renderer.domElement || gameOver) return;
  yaw -= event.movementX * player.lookSpeed;
  pitch -= event.movementY * player.lookSpeed;
  pitch = Math.max(-1.3, Math.min(1.3, pitch));
});

function applyGamepad(delta, now) {
  const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
  const pad = gamepads && gamepads[0];
  if (!pad) return;

  const lx = Math.abs(pad.axes[0]) > 0.15 ? pad.axes[0] : 0;
  const ly = Math.abs(pad.axes[1]) > 0.15 ? pad.axes[1] : 0;
  const rx = Math.abs(pad.axes[2]) > 0.15 ? pad.axes[2] : 0;
  const ry = Math.abs(pad.axes[3]) > 0.15 ? pad.axes[3] : 0;

  yaw -= rx * player.gamepadLookSpeed * delta;
  pitch -= ry * player.gamepadLookSpeed * delta;
  pitch = Math.max(-1.3, Math.min(1.3, pitch));

  const moveForward = -ly;
  const moveSide = lx;
  if (Math.abs(moveForward) > 0 || Math.abs(moveSide) > 0) {
    const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new THREE.Vector3(forward.z, 0, -forward.x);
    velocity.addScaledVector(forward, moveForward * player.moveSpeed * delta);
    velocity.addScaledVector(right, moveSide * player.moveSpeed * delta);
  }

  const shootPressed = pad.buttons[7]?.value > 0.5 || pad.buttons[5]?.pressed;
  if (shootPressed) {
    spawnBullet(now);
    handleShoot();
  }
}

function resolvePlayerVsStructures() {
  for (const structure of structures) {
    const halfW = structure.geometry.parameters.width / 2 + player.radius;
    const halfD = structure.geometry.parameters.depth / 2 + player.radius;
    const dx = player.position.x - structure.position.x;
    const dz = player.position.z - structure.position.z;

    if (Math.abs(dx) < halfW && Math.abs(dz) < halfD) {
      const penX = halfW - Math.abs(dx);
      const penZ = halfD - Math.abs(dz);
      if (penX < penZ) {
        player.position.x += Math.sign(dx || 1) * penX;
      } else {
        player.position.z += Math.sign(dz || 1) * penZ;
      }
      velocity.multiplyScalar(0.6);
    }
  }
}

function updateMovement(delta) {
  const forward = Number(keys.has('KeyW')) - Number(keys.has('KeyS'));
  const strafe = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));

  if (forward || strafe) {
    const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new THREE.Vector3(fwd.z, 0, -fwd.x);
    velocity.addScaledVector(fwd, forward * player.moveSpeed * delta);
    velocity.addScaledVector(right, strafe * player.moveSpeed * delta);
  }

  velocity.multiplyScalar(0.82);
  player.position.add(velocity.clone().multiplyScalar(delta * 6.8));
  player.position.x = THREE.MathUtils.clamp(player.position.x, -worldLimit, worldLimit);
  player.position.z = THREE.MathUtils.clamp(player.position.z, -worldLimit, worldLimit);

  resolvePlayerVsStructures();

  camera.position.copy(player.position);
  camera.rotation.set(pitch, yaw, 0, 'YXZ');
}

function updateBullets(delta) {
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const bullet = bullets[i];
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

    if (
      bullet.userData.life <= 0
      || hitStructure
      || Math.abs(bullet.position.x) > 80
      || Math.abs(bullet.position.z) > 80
    ) {
      scene.remove(bullet);
      bullets.splice(i, 1);
    }
  }
}

function updateEnemies(delta) {
  for (const enemy of enemies) {
    const toPlayer = player.position.clone().sub(enemy.position);
    const dist = toPlayer.length();

    enemy.userData.wobble += delta * 6;
    enemy.position.y = 1.2 + Math.sin(enemy.userData.wobble) * 0.14;

    if (dist > 1.9) {
      toPlayer.normalize();
      const nextPos = enemy.position.clone().addScaledVector(toPlayer, enemy.userData.speed * delta);

      const blocked = structures.some((structure) => {
        const halfW = structure.geometry.parameters.width / 2 + 0.75;
        const halfD = structure.geometry.parameters.depth / 2 + 0.75;
        return (
          Math.abs(nextPos.x - structure.position.x) < halfW
          && Math.abs(nextPos.z - structure.position.z) < halfD
        );
      });

      if (!blocked) {
        enemy.position.copy(nextPos);
      } else {
        const sidestep = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x).multiplyScalar(enemy.userData.speed * delta);
        enemy.position.add(sidestep);
      }
    } else {
      enemy.userData.attackCooldown -= delta;
      if (enemy.userData.attackCooldown <= 0) {
        health -= 7;
        enemy.userData.attackCooldown = 0.9;
        if (health <= 0 && !gameOver) {
          gameOver = true;
          setStatus('ゲームオーバー: Spaceでリスタート');
        }
      }
    }

    enemy.lookAt(player.position.x, enemy.position.y, player.position.z);
    enemy.material.emissive.lerp(new THREE.Color(0x2d0707), 0.08);
  }
}

let prev = performance.now();
function animate(nowMs) {
  const now = nowMs / 1000;
  const delta = Math.min(0.033, (nowMs - prev) / 1000);
  prev = nowMs;

  if (!gameOver) {
    applyGamepad(delta, now);
    updateMovement(delta);
    updateBullets(delta);
    updateEnemies(delta);
  }

  updateHud();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

setStatus('明るい市街地ステージ: クリックで開始');
updateHud();
requestAnimationFrame(animate);
