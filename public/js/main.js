import * as THREE from 'three';
import { WORLD, BOAT, PLAYER, WEAPONS, COLORS, SWARM, KILL_REWARD } from './config.js';
import { createWater } from './waves.js';
import { createSky } from './sky.js';
import { createWorld, resolveCollisions } from './world.js';
import { Boat, PLAYER_STYLE } from './boat.js';
import { Wake } from './wake.js';
import { Minimap } from './minimap.js';
import { createInput } from './input.js';
import { createHud } from './hud.js';
import { Combat } from './combat.js';
import { EnemyBoat, Director, HUNT } from './enemies.js';
import { audio } from './audio.js';

// ---------- renderer, scene, camera ----------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(COLORS.horizon, 110, 380);

const camera = new THREE.PerspectiveCamera(60, 1, 0.5, 1200);
const BASE_FOV = 60;

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ---------- light: warm sun, bright cyan sky bounce ----------
scene.add(new THREE.HemisphereLight(0xbdf3ff, 0x3fbfff, 1.0));
const sun = new THREE.DirectionalLight(0xfff0c8, 2.0);
sun.position.set(-80, 120, 60);
scene.add(sun);

// ---------- game objects ----------
const sky = createSky(scene);
const water = createWater(scene);
const world = createWorld(scene);
const input = createInput();
const hud = createHud();
// browsers only start audio after a click or key press
for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => audio.init());
input.onPress('KeyM', () => hud.toast(audio.toggleMute() ? '🔇 Sound off (M)' : '🔊 Sound on (M)', 1200));
input.onWeapon(() => audio.click());

// the controls tutorial lives behind a ? button (or the ? key)
const helpBtn = document.getElementById('help-btn');
const controls = document.getElementById('controls');
const toggleHelp = () => controls.classList.toggle('hidden');
helpBtn.addEventListener('click', toggleHelp);
input.onPress('Slash', toggleHelp);
const combat = new Combat(scene);

const boat = new Boat(scene);
const wake = new Wake(scene, 60);
const minimap = new Minimap(document.getElementById('minimap'));

let kills = 0;
let warned = false;
let shake = 0;
let missileCd = 0;
let gunTimer = 0;
let gunSide = 1;
let ramCd = 0;
let boostPuff = 0;
let camYaw = boat.state.yaw;
let wasBoosting = false;
let wasBraking = false;
let huntWarned = false;
let camFar = 1; // 0.2 while boosting: the speed pull-back of the camera shrinks to 20%
let camZoom = 1; // 0.97 while boosting: camera sits 3% closer

// The player is a "target" just like the enemies, so bullets treat everyone the same way.
const player = {
  team: 'player',
  state: boat.state,
  radius: BOAT.radius + 0.4,
  alive: true,
  hp: PLAYER.maxHp,
  maxHp: PLAYER.maxHp,
  invuln: 0,
  sinceHit: 99,
  respawn: 0,
  idle: 0, // seconds spent (nearly) standing still: drives how hard the swarm hunts you
  get boosting() { return boat.boosting; },
  takeDamage(n, by = null) {
    if (!this.alive || this.invuln > 0) return;
    this.hp = Math.max(0, this.hp - n);
    this.sinceHit = 0;
    audio.hurt();
    hud.flash(Math.min(0.9, 0.25 + n / 60));
    if (this.hp <= 0) sink(by);
  },
};

// One enemy boat per themed island, each a different type
const wakes = [];
const enemies = WORLD.islands
  .filter((i) => i.enemy)
  .map((i) => {
    wakes.push(new Wake(scene, 30));
    return new EnemyBoat(scene, combat, i, i.enemy, {
      onKilled(e, by) {
        // only count the boats YOU sink; enemies finishing each other off doesn't score
        if (by === 'player') {
          kills++;
          audio.kill();
          // sinking a boat pays you back: some health, a fresh missile and a bit of boost
          const heal = e.big ? KILL_REWARD.healBig : KILL_REWARD.healSmall;
          const before = player.hp;
          if (player.alive) player.hp = Math.min(player.maxHp, player.hp + heal);
          if (KILL_REWARD.resetMissile) missileCd = 0;
          boat.boostEnergy = Math.min(BOAT.boostTime, boat.boostEnergy + KILL_REWARD.boostSeconds);
          const got = Math.round(player.hp - before);
          hud.toast(`💥 ${e.island.enemyName || e.type.name} sunk!${got > 0 ? ` +${got} HP` : ''}`, 2200);
        }
      },
      onAggro() {
        if (warned) return;
        warned = true;
        hud.toast('⚠️ Enemy boat spotted! <kbd>1</kbd> <kbd>2</kbd> pick a weapon &nbsp; <kbd>Left click</kbd> fire &nbsp; <kbd>Shift</kbd> boost', 5500);
      },
    });
  });
const targets = [player, ...enemies];
EnemyBoat.ctx = { enemies, player }; // lets sunk boats respawn near the action
const director = new Director();

combat.onPlayerHit = () => hud.hit(); // hit marker on every shot that lands
combat.onWarn = () => { audio.warn(); hud.flash(0.3); }; // missile-incoming alert

combat.onExplode = (x, z, r) => {
  const d = Math.hypot(x - boat.state.x, z - boat.state.z);
  shake = Math.max(shake, Math.max(0, 1 - d / 140) * r * 0.08);
};

// ---------- player actions ----------
function sink() {
  player.alive = false;
  player.respawn = PLAYER.respawnTime;
  boat.group.visible = false;
  boat.cancelBoost();
  wasBoosting = false;
  audio.sink();
  const st = PLAYER_STYLE;
  combat.bigExplosion(boat.state.x, boat.state.z, 1.3, [st.hull, st.accent, st.cabin, st.roof]);
  shake = Math.max(shake, 1.4);
  hud.flash(0.9);
  hud.toast('Your boat was blown up! Respawning at the harbor… 🌊');
}

function respawnPlayer() {
  boat.teleport(WORLD.boatSpawn.x, WORLD.boatSpawn.z, WORLD.boatSpawn.yaw);
  boat.top = BOAT.baseTop;
  boat.cancelBoost();
  player.hp = player.maxHp;
  player.alive = true;
  audio.respawn();
  player.invuln = PLAYER.invuln;
  camYaw = boat.state.yaw;
  hud.toast('Back at the harbor. Sail out and try again! ⚓', 3000);
}

// Fighter-jet style: the missile locks onto the boat closest to your nose (inside a cone, within range) at launch,
// tracks it for a short time, then flies on. No boat in the cone = no lock, it flies straight.
function acquireLock() {
  const s = boat.state, W = WEAPONS.missile;
  let best = null, bestScore = 1e9;
  for (const e of enemies) {
    if (!e.alive) continue;
    const dx = e.state.x - s.x, dz = e.state.z - s.z;
    const d = Math.hypot(dx, dz);
    if (d > W.lockRange || d < 6) continue;
    let off = Math.atan2(dx, dz) - s.yaw;
    off = Math.atan2(Math.sin(off), Math.cos(off));
    if (Math.abs(off) > W.lockCone) continue;
    const score = Math.abs(off) * 200 + d * 0.3; // prefer what you are aiming at, then what is closer
    if (score < bestScore) { bestScore = score; best = e; }
  }
  return best;
}

function fireMissile() {
  const s = boat.state;
  const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw);
  const lock = acquireLock();
  combat.fireMissile('player', s.x + fx * 2.5, s.z + fz * 2.5, s.yaw, Math.max(WEAPONS.missile.speed, s.speed + 25), WEAPONS.missile, lock);
  audio.lock(!!lock);
  hud.toast(lock ? `🎯 Locked on ${lock.island.enemyName || lock.type.name}!` : '🚀 No lock: aim at a boat', 900);
  missileCd = WEAPONS.missile.cooldown;
}

// Shift: toggle the speed boost (8 s of energy; refills after 2 s of not boosting)
const tryBoost = () => {
  if (!player.alive) return;
  const was = boat.boosting;
  const on = boat.toggleBoost();
  if (on) hud.toast('🔥 BOOST ON! Ram them!', 1200);
  else if (was) hud.toast('Boost off', 800);
};
input.onPress('ShiftLeft', tryBoost);
input.onPress('ShiftRight', tryBoost);

// Free fast travel home so nobody ever gets stuck
input.onPress('KeyH', () => {
  if (!player.alive) return;
  const home = WORLD.islands.find((i) => i.home);
  const len = Math.hypot(home.x, home.z) || 1;
  const dx = -home.x / len, dz = -home.z / len; // direction toward the harbor
  boat.teleport(home.x + dx * (home.r + 8), home.z + dz * (home.r + 8), Math.atan2(dx, dz));
  camYaw = boat.state.yaw;
  hud.toast('Welcome home! Your resort will grow here.', 3000);
});

// ---------- tutorial ----------
let tutStep = 0;
function tutorial() {
  if (tutStep === 0 && boat.state.speed > 3) {
    tutStep = 1;
    hud.toast('The longer you sail flat out, the faster you go! 🚤 Beware the boats on the other islands.', 5000);
  }
}

// ---------- camera follow ----------
const angleDiff = (a, b) => ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
const camTarget = new THREE.Vector3();
const look = new THREE.Vector3();
camera.position.set(boat.state.x, 7.5, boat.state.z - 15);

function updateCamera(dt) {
  const s = boat.state;
  camFar += ((boat.boosting ? 0.2 : 1) - camFar) * Math.min(1, dt * 4);
  const speedFrac = Math.min(1.4, Math.max(0, s.speed) / BOAT.topCap) * camFar;
  camYaw += angleDiff(camYaw, s.yaw) * Math.min(1, dt * (boat.boosting ? 4 : 2.5)); // keeps up with fast turns
  camZoom += ((boat.boosting ? 0.97 : 1) - camZoom) * Math.min(1, dt * 4);
  const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
  const back = (15 + speedFrac * 6) * camZoom; // pull back a little at high speed
  camTarget.set(s.x - fx * back, (7.5 + speedFrac * 2) * camZoom, s.z - fz * back);
  camera.position.lerp(camTarget, 1 - Math.exp(-dt * 4));

  shake = Math.max(0, shake - dt * 2.5);
  look.set(
    s.x + fx * 4 + (Math.random() - 0.5) * shake,
    1.5 + (Math.random() - 0.5) * shake,
    s.z + fz * 4 + (Math.random() - 0.5) * shake
  );
  camera.lookAt(look);

  const fov = BASE_FOV + Math.min(1.4, Math.max(0, s.speed) / BOAT.topCap) * 16 + (boat.boosting ? 8 : 0); // wider view feels faster
  if (Math.abs(camera.fov - fov) > 0.05) {
    camera.fov += (fov - camera.fov) * Math.min(1, dt * 4);
    camera.updateProjectionMatrix();
  }
}

// ---------- main loop ----------
const clock = new THREE.Clock();

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  const s = boat.state;
  let gunFiring = false;

  if (player.alive) {
    boat.update(dt, input.state);
    if (input.state.brake && !wasBraking) audio.brake();
    wasBraking = input.state.brake;
    // standing still gets you hunted
    if (Math.abs(s.speed) < SWARM.idleSpeed) player.idle += dt; else player.idle = Math.max(0, player.idle - dt * 3);
    if (boat.boosting !== wasBoosting) { wasBoosting = boat.boosting; audio.boost(wasBoosting); }
    if (resolveCollisions(s, BOAT.radius, dt)) boat.top = Math.max(BOAT.baseTop, boat.top - 30 * dt);

    // Weapons: pick with 1 / 2, fire with the left mouse button.
    // The machine gun fires while the button is held and alternates between its two barrels.
    gunTimer -= dt;
    if (input.state.fire && input.state.weapon === 'gun') {
      gunFiring = true;
      if (gunTimer <= 0) {
        gunTimer = 1 / WEAPONS.gun.rate;
        gunSide = -gunSide;
        const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw);
        const lx = Math.cos(s.yaw), lz = -Math.sin(s.yaw);
        const ang = s.yaw + (Math.random() - 0.5) * 2 * WEAPONS.gun.spread;
        combat.fireBullet('player', s.x + fx * 3.6 + lx * gunSide * 0.55, s.z + fz * 3.6 + lz * gunSide * 0.55,
          ang, WEAPONS.gun.speed + Math.max(0, s.speed), WEAPONS.gun.dmg, WEAPONS.gun.life);
      }
    }
    // The missile fires whenever it is ready and the button is down.
    if (input.state.fire && input.state.weapon === 'missile' && missileCd <= 0) fireMissile();

    // boost exhaust
    if (boat.boosting) {
      boostPuff -= dt;
      if (boostPuff <= 0) {
        boostPuff = 0.03;
        combat.spawnPuff(s.x - Math.sin(s.yaw) * 3.4 + (Math.random() - 0.5), s.z - Math.cos(s.yaw) * 3.4 + (Math.random() - 0.5));
      }
    }

    const mPrev = missileCd;
    missileCd = Math.max(0, missileCd - dt);
    if (mPrev > 0 && missileCd <= 0) audio.ready();
    player.invuln = Math.max(0, player.invuln - dt);
    player.sinceHit += dt;
    // no health regeneration: once it is gone, it is gone

    boat.syncModel(dt, t);
    // blink while protected after respawning
    boat.group.visible = player.invuln <= 0 || Math.floor(t * 10) % 2 === 0;
  } else {
    player.respawn -= dt;
    if (player.respawn <= 0) respawnPlayer();
  }

  if (!player.alive) player.idle = 0;
  director.update(dt, enemies, player);
  if (HUNT.k > 0.6 && !huntWarned) { huntWarned = true; hud.toast('⚠️ They smell blood! Keep moving!', 2500); }
  if (HUNT.k < 0.2) huntWarned = false;
  for (const e of enemies) e.update(dt, t, player, camera, targets);

  // Boats bump into each other.
  //  - ramming with the Shift boost: you lose 10% of your health, they lose 30% of theirs
  //  - ramming at normal speed still hurts both (the enemy more)
  ramCd = Math.max(0, ramCd - dt);
  if (player.alive) {
    for (const e of enemies) {
      if (!e.alive) continue;
      const dx = s.x - e.state.x, dz = s.z - e.state.z;
      const d = Math.hypot(dx, dz) || 0.001;
      const min = player.radius + e.radius;
      if (d >= min) continue;
      const nx = dx / d, nz = dz / d, push = min - d;
      s.x += nx * push * 0.6; s.z += nz * push * 0.6;
      e.state.x -= nx * push * 0.4; e.state.z -= nz * push * 0.4;
      if (ramCd <= 0 && boat.boosting) {
        ramCd = 0.9;
        e.takeDamage(e.maxHp * BOAT.boostRamEnemyPct, 'player');
        player.takeDamage(player.maxHp * BOAT.boostRamSelfPct, e.team);
        combat.explode(s.x - nx * 2, s.z - nz * 2, 5, 0.4);
        combat.ring(s.x - nx * 2, s.z - nz * 2, 9, 0.45, 0xffffff, 0.8);
        shake = Math.max(shake, 1.0);
        s.speed *= 0.8;
      } else if (ramCd <= 0 && s.speed > 22) {
        ramCd = 0.9;
        const hit = s.speed;
        e.takeDamage(Math.min(hit * 0.8, e.maxHp * 0.3), 'player'); // a ram never takes more than 30% of a boat's health
        player.takeDamage(hit * 0.12, e.team);
        combat.explode(s.x + nx * -2, s.z + nz * -2, 4, 0.35);
        shake = Math.max(shake, 0.8);
        s.speed *= 0.6;
        boat.top = Math.max(BOAT.baseTop, boat.top - 8);
      }
    }
  }
  // enemy boats can't sail through each other either
  for (let i = 0; i < enemies.length; i++) {
    for (let j = i + 1; j < enemies.length; j++) {
      const a = enemies[i], b = enemies[j];
      if (!a.alive || !b.alive) continue;
      const dx = a.state.x - b.state.x, dz = a.state.z - b.state.z;
      const d = Math.hypot(dx, dz) || 0.001;
      const min = a.radius + b.radius;
      if (d >= min) continue;
      const push = (min - d) / 2;
      a.state.x += (dx / d) * push; a.state.z += (dz / d) * push;
      b.state.x -= (dx / d) * push; b.state.z -= (dz / d) * push;
    }
  }

  combat.update(dt, targets, player);

  wake.update(dt, t, boat, player.alive);
  enemies.forEach((e, i) => wakes[i].update(dt, t, e.boat, e.alive));
  water.update(s.x, s.z, t);
  world.update(t);
  updateCamera(dt);
  sky.update(camera, t);
  minimap.draw(boat, enemies);
  audio.setListener(s.x, s.z, camYaw);
  audio.update(dt, { speed: s.speed, boosting: boat.boosting, alive: player.alive, hpFrac: player.hp / player.maxHp });
  tutorial();

  hud.update(dt, {
    hp: player.hp, maxHp: player.maxHp,
    speed: s.speed,
    boost: (boat.top - BOAT.baseTop) / (BOAT.topCap - BOAT.baseTop),
    kills,
    gunFiring,
    missileCd, missileMax: WEAPONS.missile.cooldown,
    weapon: input.state.weapon,
    boosting: boat.boosting,
    boostEnergy: boat.boostEnergy, boostMax: BOAT.boostTime, boostMin: BOAT.boostMin,
  });

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();
