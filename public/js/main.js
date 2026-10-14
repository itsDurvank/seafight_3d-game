import * as THREE from 'three';
import './mapLoader.js'; // loads public/maps/default.json into WORLD before game initializes
import { WORLD, BOAT, PLAYER, WEAPONS, COLORS, SWARM, KILL_REWARD, POTION, MP } from './config.js?v=orig_boost_formula';
import { createWater } from './waves.js';
import { createSky } from './sky.js';
import { createWorld, resolveCollisions } from './world.js';
import { Boat, PLAYER_STYLE } from './boat.js?v=orig_boost_formula';
import { Wake } from './wake.js';
import { Minimap } from './minimap.js';
import { createInput } from './input.js';
import { createHud } from './hud.js';
import { Combat } from './combat.js';
import { Potions } from './potions.js';
import { EnemyBoat, Director, HUNT } from './enemies.js?v=orig_boost_formula';
import { audio } from './audio.js';
import { NetworkClient } from './net.js';
import { MultiplayerManager } from './multiplayer.js';
import { MultiplayerHUD } from './mpHud.js';

// ---------- renderer, scene, camera ----------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

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

// ---------- settings & skin selection ----------
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const settingsClose = document.getElementById('settings-close');
const skinHeroCard = document.getElementById('skin-card-hero');
const skinClassicCard = document.getElementById('skin-card-classic');
const statusHero = document.getElementById('status-hero');
const statusClassic = document.getElementById('status-classic');
const settingsAudioBtn = document.getElementById('settings-audio-btn');
const settingsAudioIcon = document.getElementById('settings-audio-icon');
const settingsAudioText = document.getElementById('settings-audio-text');
let mp = null;
let mpHud = null;

function updateSettingsUI() {
  const isOnlineInRoom = !!(mp && mp.mode === 'online' && mp.roomCode);
  const offlineView = document.getElementById('settings-offline-view');
  const onlineView = document.getElementById('settings-online-view');
  const titleEl = document.getElementById('settings-modal-title');
  const tipEl = document.getElementById('settings-tip-text');

  if (isOnlineInRoom) {
    if (offlineView) offlineView.classList.add('hidden');
    if (onlineView) onlineView.classList.remove('hidden');
    if (titleEl) titleEl.textContent = '⚓ Match Settings';
    if (tipEl) tipEl.innerHTML = 'Tip: Press <kbd>V</kbd> for cockpit view!';

    const nameEl = document.getElementById('settings-online-player-name');
    if (nameEl) nameEl.textContent = mp.playerName || 'Captain';
    const codeEl = document.getElementById('settings-online-room-code');
    if (codeEl) codeEl.textContent = mp.roomCode || '-----';

    if (mpHud && mpHud.renderSettingsBoatPicker) {
      mpHud.renderSettingsBoatPicker();
    }
  } else {
    if (offlineView) offlineView.classList.remove('hidden');
    if (onlineView) onlineView.classList.add('hidden');
    if (titleEl) titleEl.textContent = '⚙️ Settings';

    const isOnlineTab = mpHud?.elModeOnline?.classList.contains('active');
    const offlineSkinsSection = document.getElementById('offline-boat-skin-section');
    if (isOnlineTab) {
      if (offlineSkinsSection) offlineSkinsSection.classList.add('hidden');
      if (tipEl) tipEl.innerHTML = 'Tip: Press <kbd>V</kbd> for cockpit view!';
    } else {
      if (offlineSkinsSection) offlineSkinsSection.classList.remove('hidden');
      if (tipEl) tipEl.innerHTML = 'Tip: Press <kbd>O</kbd> to switch skins &bull; <kbd>V</kbd> for cockpit view!';
    }

    const current = boat.currentSkin;
    document.querySelectorAll('.skin-card').forEach((card) => {
      const skin = card.getAttribute('data-skin');
      const isActive = current === skin;
      card.classList.toggle('active', isActive);
      const status = card.querySelector('.skin-status');
      if (status) status.textContent = isActive ? 'Equipped' : 'Select';
    });
  }
}

function applySkin(skinName, toast = true) {
  if (skinName !== 'hero' && skinName !== 'classic') return;
  if (skinName === 'classic' && isFPV) {
    setFPV(false);
  }
  const applied = boat.setSkin(skinName);
  updateSettingsUI();
  if (toast) {
    audio.click();
    const label = applied === 'hero' ? '🔥 Sunfire Hero Boat' : '⛵ Classic OG Boat';
    hud.toast(`Equipped ${label}!`, 1800);
  }
}

if (settingsBtn && settingsModal) {
  const toggleSettings = () => {
    updateSettingsUI();
    settingsModal.classList.toggle('hidden');
    audio.click();
  };
  settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSettings();
  });
  if (settingsClose) {
    settingsClose.addEventListener('click', (e) => {
      e.stopPropagation();
      settingsModal.classList.add('hidden');
      audio.click();
    });
  }
  addEventListener('click', (e) => {
    if (!settingsModal.classList.contains('hidden') && !settingsModal.contains(e.target) && e.target !== settingsBtn) {
      settingsModal.classList.add('hidden');
    }
  });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !settingsModal.classList.contains('hidden')) {
      settingsModal.classList.add('hidden');
    }
  });
}

document.querySelectorAll('.skin-card').forEach((card) => {
  const skin = card.getAttribute('data-skin');
  if (skin) {
    card.addEventListener('click', () => applySkin(skin));
  }
});

// Quick toggle with 'O' key (offline only)
input.onPress('KeyO', () => {
  if (typeof mp !== 'undefined' && mp && mp.mode === 'online' && mp.roomCode) return;
  const next = boat.toggleSkin();
  applySkin(next);
});

if (settingsAudioBtn) {
  settingsAudioBtn.addEventListener('click', () => {
    const isMuted = audio.toggleMute();
    if (settingsAudioIcon) settingsAudioIcon.textContent = isMuted ? '🔇' : '🔊';
    if (settingsAudioText) settingsAudioText.textContent = isMuted ? 'Sound: Muted (M)' : 'Sound: On (M)';
    hud.toast(isMuted ? '🔇 Sound off (M)' : '🔊 Sound on (M)', 1200);
  });
}

updateSettingsUI();

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
  lifeId: 1,
  get boosting() { return boat.boosting; },
  takeDamage(n, by = null) {
    if (!this.alive || this.invuln > 0) return;
    this.hp = Math.max(0, this.hp - n);
    this.sinceHit = 0;
    audio.hurt();
    hud.flash(Math.min(0.9, 0.25 + n / 60));
    if (boat.group?.userData?.hit) boat.group.userData.hit();
    if (boat.fpv?.userData?.hit) boat.fpv.userData.hit();

    if (mp && mp.mode === 'online') {
      mp.reportLocalHit(n, by, this.hp);
    }

    if (this.hp <= 0) sink(by);
  },
};
boat.playerRef = player;

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

// Health potions: random pick-ups on the sea that you and any hurt enemy boat can claim
const potions = new Potions(scene, combat);
EnemyBoat.potions = potions; // lets hurt enemies head for the nearest one
potions.onSpawn = (n) => hud.toast(n > 1 ? `🧪 ${n} health potions are floating nearby! Check the minimap.` : '🧪 A health potion is floating nearby! Check the minimap.', 2400);
potions.onClaim = (who, p, healed, target) => {
  if (who === 'player') {
    audio.potion();
    hud.toast(`🧪 +${Math.round(healed)} HP`, 1500);
  } else if (Math.hypot(p.x - boat.state.x, p.z - boat.state.z) < 140) {
    hud.toast(`🧪 ${target.island.enemyName || target.type.name} grabbed a potion!`, 1500);
  }
};
const director = new Director();

// Toggle first-person cockpit perspective (V)
let isFPV = false;
let respawnInFPV = false;

// Multiplayer client wiring
const mainGame = {
  get player() { return player; },
  get boat() { return boat; },
  get hud() { return hud; },
  get audio() { return audio; },
  isFPV: () => isFPV,
  sink: (by, killerName, fromServer) => sink(by, killerName, fromServer),
  applySkinStyle: (style, colorIndex, boatSkin) => {
    boat.applyStyle(style, colorIndex, boatSkin);
    if (isFPV && boat.fpv) {
      boat.fpv.userData.mount(camera);
      boat.fpv.userData.setActive(true);
    }
  },
  teleportLocalPlayer: (x, z, yaw) => {
    boat.teleport(x, z, yaw);
    snapCamera();
  },
  healLocalPlayer: (amount) => {
    if (player.alive) {
      const before = player.hp;
      player.hp = Math.min(player.maxHp, player.hp + amount);
      return player.hp - before;
    }
    return 0;
  },
  applyKillReward: () => {
    kills++;
    if (KILL_REWARD.resetMissile) missileCd = 0;
    boat.boostEnergy = Math.min(BOAT.boostTime, boat.boostEnergy + KILL_REWARD.boostSeconds);
  },
};

const netClient = new NetworkClient();
mp = new MultiplayerManager(scene, combat, netClient, mainGame);
mpHud = new MultiplayerHUD(mp);
let prevIsOnline = false;

combat.onPlayerHit = () => hud.hit(); // hit marker on every shot that lands
combat.onWarn = () => { audio.warn(); hud.flash(0.3); }; // missile-incoming alert

combat.onExplode = (x, z, r) => {
  const d = Math.hypot(x - boat.state.x, z - boat.state.z);
  shake = Math.max(shake, Math.max(0, 1 - d / 140) * r * 0.08);
};

// ---------- player actions ----------
function sink(by = null, killerName = null, fromServer = false) {
  if (!player.alive) {
    if (killerName) {
      hud.toast(`🌊 Sunk by ${killerName}! Respawning…`, 3000);
    }
    return;
  }
  respawnInFPV = isFPV;
  if (isFPV) {
    setFPV(false, false); // Detach camera to TPP so blast animation is fully visible
    snapCamera();
  }
  player.alive = false;
  player.hp = 0;
  player.respawn = PLAYER.respawnTime;
  boat.group.visible = false; // Hide boat so blast debris and explosion take center stage
  boat.cancelBoost();
  wasBoosting = false;
  audio.sink();
  const st = (mp && mp.mode === 'online' && mp.localColor?.style) ? mp.localColor.style : PLAYER_STYLE;
  combat.bigExplosion(boat.state.x, boat.state.z, 1.3, [st.hull, st.accent, st.cabin, st.roof]);
  shake = Math.max(shake, 1.4);
  hud.flash(0.9);
  if (killerName) {
    hud.toast(`🌊 Sunk by ${killerName}! Respawning…`, 3000);
  } else {
    hud.toast('Your boat was blown up! Respawning… 🌊');
  }

  if (mp && mp.mode === 'online' && !fromServer) {
    mp.reportLocalDeath(by, player.lifeId || 1);
    player.lifeId = (player.lifeId || 1) + 1;
  }
}

function respawnPlayer() {
  const spawn = (mp && mp.mode === 'online' && MP.spawns && mp.localColorIndex !== undefined)
    ? MP.spawns[mp.localColorIndex % MP.spawns.length]
    : WORLD.boatSpawn;

  boat.teleport(spawn.x, spawn.z, spawn.yaw);
  boat.top = BOAT.baseTop;
  boat.cancelBoost();
  boat.syncModel(0.016, performance.now() * 0.001);
  boat.group.visible = true;
  player.hp = player.maxHp;
  player.alive = true;
  audio.respawn();
  player.invuln = PLAYER.invuln;
  camYaw = boat.state.yaw;

  // Restore FPP if player died in FPP mode, otherwise stay in TPP
  if (respawnInFPV) {
    respawnInFPV = false;
    setFPV(true, false);
  } else {
    snapCamera();
  }
  hud.toast('Back at your boat. Sail out and fight! ⚓', 3000);

  if (mp && mp.mode === 'online') {
    mp.reportLocalRespawn(spawn.x, spawn.z, spawn.yaw);
  }
}

// Machine-gun aim assist. Bullets fly straight, so while you steer they trail behind your nose like a hose and miss.
// If a boat is near your nose, bend the shot toward where that boat will be when the bullet arrives.
function gunAim(s) {
  const G = WEAPONS.gun;
  if (!G.assistCone) return s.yaw;
  const bs = G.speed + Math.max(0, s.speed);
  const reach = bs * G.life * 0.9;
  let best = null, bestOff = G.assistCone, bestAng = s.yaw;
  const pool = (mp && mp.mode === 'online') ? mp.getTargets() : enemies;
  for (const e of pool) {
    if (!e.alive) continue;
    let px = e.state.x, pz = e.state.z;
    const evx = Math.sin(e.state.yaw) * e.state.speed, evz = Math.cos(e.state.yaw) * e.state.speed;
    let d = Math.hypot(px - s.x, pz - s.z);
    for (let k = 0; k < 3; k++) { // predict where it will be when the bullet gets there
      const tt = d / bs;
      px = e.state.x + evx * tt; pz = e.state.z + evz * tt;
      d = Math.hypot(px - s.x, pz - s.z);
    }
    if (d > reach || d < 4) continue;
    const ang = Math.atan2(px - s.x, pz - s.z);
    const off = angleDiff(s.yaw, ang);
    if (Math.abs(off) < bestOff) { bestOff = Math.abs(off); best = e; bestAng = s.yaw + off; }
  }
  return best ? s.yaw + (bestAng - s.yaw) * G.assist : s.yaw;
}

// Fighter-jet style: the missile locks onto the boat closest to your nose (inside a cone, within range) at launch,
// tracks it for a short time, then flies on. No boat in the cone = no lock, it flies straight.
function acquireLock() {
  const s = boat.state, W = WEAPONS.missile;
  let best = null, bestScore = 1e9;
  const pool = (mp && mp.mode === 'online') ? mp.getTargets() : enemies;
  for (const e of pool) {
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
  const targetLabel = lock ? (lock.name || lock.island?.enemyName || lock.type?.name) : null;
  hud.toast(lock ? `🎯 Locked on ${targetLabel}!` : '🚀 No lock: aim at a boat', 900);
  missileCd = WEAPONS.missile.cooldown;

  if (mp && mp.mode === 'online') {
    mp.broadcastLocalFire('missile', s, lock ? lock.id : null);
  }
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

// Toggle first-person cockpit perspective (V)
function setFPV(active, showToast = true) {
  if (active === isFPV) return;
  if (active) {
    if (!boat.fpv) {
      applySkin('hero', false);
    }
    const fpv = boat.fpv;
    if (!fpv) return;
    isFPV = true;
    camera.fov = 75;
    fpv.userData.mount(camera);
    fpv.userData.setActive(true);
    document.body.classList.add('fpv-mode');
    if (showToast) {
      hud.toast('🎛️ Cockpit View (Press V to exit • Hold Right Mouse to look)', 2200);
    }
  } else {
    isFPV = false;
    const fpv = boat.fpv;
    if (fpv) {
      fpv.userData.setActive(false);
      fpv.userData.unmount();
    }
    scene.add(camera);
    camera.near = 0.5;
    camera.fov = BASE_FOV;
    camera.updateProjectionMatrix();
    camYaw = boat.state.yaw;
    document.body.classList.remove('fpv-mode');
    if (showToast) {
      hud.toast('⛵ Third-Person View', 1200);
    }
  }
}

function toggleFPV() {
  if (!player.alive) return;
  if (!isFPV && !boat.fpv) {
    applySkin('hero', false);
    hud.toast('🔥 Switched to Hero Boat for Cockpit View!', 2000);
  }
  setFPV(!isFPV);
}

input.onPress('KeyV', toggleFPV);

let isFreeLooking = false;
addEventListener('pointerdown', (e) => {
  if ((e.button === 2 || e.button === 1) && isFPV && boat.fpv) {
    isFreeLooking = true;
    boat.fpv.userData.look.active = true;
  }
});
addEventListener('pointerup', (e) => {
  if ((e.button === 2 || e.button === 1) && isFreeLooking) {
    isFreeLooking = false;
    if (boat.fpv) boat.fpv.userData.look.active = false;
  }
});
addEventListener('pointermove', (e) => {
  if (isFreeLooking && isFPV && boat.fpv) {
    boat.fpv.userData.addLook(e.movementX || 0, e.movementY || 0);
  }
});
addEventListener('blur', () => {
  if (isFreeLooking) {
    isFreeLooking = false;
    if (boat.fpv) boat.fpv.userData.look.active = false;
  }
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

function snapCamera() {
  if (isFPV) return; // In FPV mode camera is attached to cockpit rig
  const s = boat.state;
  camYaw = s.yaw;
  const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
  const back = 14 * camZoom;
  camera.position.set(s.x - fx * back, 7 * camZoom, s.z - fz * back);
  look.set(s.x + fx * 4, 1.5, s.z + fz * 4);
  camera.lookAt(look);
}

function updateCamera(dt) {
  const s = boat.state;
  camFar += ((boat.boosting ? 0.35 : 1) - camFar) * Math.min(1, dt * 4);
  const speedFrac = Math.min(1.0, Math.max(0, s.speed) / BOAT.topCap) * camFar;
  camYaw += angleDiff(camYaw, s.yaw) * Math.min(1, dt * (boat.boosting ? 4.5 : 2.5)); // keeps up with fast turns
  camZoom += ((boat.boosting ? 0.94 : 1) - camZoom) * Math.min(1, dt * 4);
  const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
  const back = (14 + speedFrac * 2.5) * camZoom; // stays close: only a small pull-back at speed
  camTarget.set(s.x - fx * back, (7 + speedFrac * 1.2) * camZoom, s.z - fz * back);
  const followRate = boat.boosting ? 7 : 5.5; // higher = camera trails less
  camera.position.lerp(camTarget, 1 - Math.exp(-dt * followRate));

  shake = Math.max(0, shake - dt * 2.5);
  look.set(
    s.x + fx * 4 + (Math.random() - 0.5) * shake,
    1.5 + (Math.random() - 0.5) * shake,
    s.z + fz * 4 + (Math.random() - 0.5) * shake
  );
  camera.lookAt(look);

  const fov = BASE_FOV + Math.min(1.0, Math.max(0, s.speed) / BOAT.topCap) * 8 + (boat.boosting ? 5 : 0); // subtle zoom-out for speed feel without losing the action
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

  const isOnline = mp && mp.mode === 'online';

  if (isOnline !== prevIsOnline) {
    prevIsOnline = isOnline;
    if (isOnline) {
      for (const e of enemies) {
        e.boat.group.visible = false;
        if (e.bar) e.bar.visible = false;
      }
      for (const p of potions.items) p.g.visible = false;
      document.getElementById('title')?.classList.add('hidden');
    } else {
      for (const e of enemies) e.boat.group.visible = true;
      for (const p of potions.items) if (p.on) p.g.visible = true;
      document.getElementById('title')?.classList.remove('hidden');
      boat.resetStyle();
      boat.teleport(WORLD.boatSpawn.x, WORLD.boatSpawn.z, WORLD.boatSpawn.yaw);
      snapCamera();
    }
  }

  if (isOnline) {
    for (const e of enemies) {
      if (e.bar && e.bar.visible) e.bar.visible = false;
    }
  }

  const controlsActive = !isOnline || (mp.matchState === 'playing');

  if (player.alive) {
    if (controlsActive) {
      boat.update(dt, input.state);
      if (input.state.brake && !wasBraking) audio.brake();
      wasBraking = input.state.brake;
    } else {
      boat.update(dt, { sail: 0, steer: 0, brake: true });
    }
    // standing still gets you hunted
    if (Math.abs(s.speed) < SWARM.idleSpeed) player.idle += dt; else player.idle = Math.max(0, player.idle - dt * 3);
    if (boat.boosting !== wasBoosting) { wasBoosting = boat.boosting; audio.boost(wasBoosting); }
    if (resolveCollisions(s, BOAT.radius, dt)) boat.top = Math.max(BOAT.baseTop, boat.top - 30 * dt);

    // Weapons: pick with 1 / 2, fire with the left mouse button.
    // The machine gun fires while the button is held and alternates between its two barrels.
    gunTimer -= dt;
    if (controlsActive && input.state.fire && input.state.weapon === 'gun') {
      gunFiring = true;
      if (gunTimer <= 0) {
        gunTimer = 1 / WEAPONS.gun.rate;
        gunSide = -gunSide;
        const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw);
        const lx = Math.cos(s.yaw), lz = -Math.sin(s.yaw);
        const ang = gunAim(s) + (Math.random() - 0.5) * 2 * WEAPONS.gun.spread;
        const bx = s.x + fx * 3.6 + lx * gunSide * 0.55;
        const bz = s.z + fz * 3.6 + lz * gunSide * 0.55;
        combat.fireBullet('player', bx, bz,
          ang, WEAPONS.gun.speed + Math.max(0, s.speed), WEAPONS.gun.dmg, WEAPONS.gun.life);
        if (boat.fpv?.userData?.fire) boat.fpv.userData.fire();

        if (isOnline) {
          mp.broadcastLocalFire('gun', { x: bx, z: bz, yaw: ang, speed: WEAPONS.gun.speed + Math.max(0, s.speed) });
        }
      }
    }
    // The missile fires whenever it is ready and the button is down.
    if (controlsActive && input.state.fire && input.state.weapon === 'missile' && missileCd <= 0) fireMissile();

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
    // blink while protected after respawning (stay visible in FPV so camera doesn't vanish)
    boat.group.visible = isFPV || player.invuln <= 0 || Math.floor(t * 10) % 2 === 0;
  } else {
    // Keep syncing boat model on waves while waiting for respawn
    boat.syncModel(dt, t);
    boat.group.visible = false;
    player.respawn -= dt;
    if (player.respawn <= 0) respawnPlayer();
  }

  if (!player.alive) player.idle = 0;

  if (isOnline) {
    mp.update(dt, t);
    const activeTargets = [player, ...mp.getTargets()];

    // Boats bump into each other in multiplayer
    ramCd = Math.max(0, ramCd - dt);
    if (player.alive) {
      for (const e of mp.getTargets()) {
        if (!e.alive) continue;
        const dx = s.x - e.state.x, dz = s.z - e.state.z;
        const d = Math.hypot(dx, dz) || 0.001;
        const min = player.radius + e.radius;
        if (d >= min) continue;
        const nx = dx / d, nz = dz / d, push = min - d;
        s.x += nx * push * 0.6; s.z += nz * push * 0.6;
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
          e.takeDamage(Math.min(hit * 0.8, e.maxHp * 0.3), 'player');
          player.takeDamage(hit * 0.12, e.team);
          combat.explode(s.x + nx * -2, s.z + nz * -2, 4, 0.35);
          shake = Math.max(shake, 0.8);
          s.speed *= 0.6;
          boat.top = Math.max(BOAT.baseTop, boat.top - 8);
        }
      }
    }

    combat.update(dt, activeTargets, player);
    minimap.draw(boat, mp.getTargets(), [...mp.orbs.values()]);
  } else {
    director.update(dt, enemies, player);
    if (HUNT.k > 0.6 && !huntWarned) { huntWarned = true; hud.toast('⚠️ They smell blood! Keep moving!', 2500); }
    if (HUNT.k < 0.2) huntWarned = false;
    for (const e of enemies) e.update(dt, t, player, camera, targets);
    potions.update(dt, t, player, enemies);

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
    enemies.forEach((e, i) => wakes[i].update(dt, t, e.boat, e.alive));
    minimap.draw(boat, enemies, potions.list());
  }

  wake.update(dt, t, boat, player.alive);
  water.update(s.x, s.z, t);
  world.update(t, s.x, s.z);
  if (isFPV) {
    camYaw = boat.state.yaw;
  } else {
    updateCamera(dt);
  }
  sky.update(camera, t);
  audio.setListener(s.x, s.z, isFPV ? boat.state.yaw : camYaw);
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
