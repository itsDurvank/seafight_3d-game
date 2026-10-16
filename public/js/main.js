import * as THREE from 'three';
import './mapLoader.js'; // loads public/maps/default.json into WORLD before game initializes
import { WORLD, BOAT, PLAYER, WEAPONS, COLORS, SWARM, KILL_REWARD, POTION, MP } from './config.js';
import { createWater } from './waves.js';
import { createSky } from './sky.js';
import { createWorld, resolveCollisions } from './world.js';
import { Boat, PLAYER_STYLE } from './boat.js';
import { Wake } from './wake.js';
import { Minimap } from './minimap.js';
import { createInput, KEYBIND_DEFS, formatKeyName } from './input.js';
import { createHud } from './hud.js';
import { Combat } from './combat.js';
import { Potions } from './potions.js';
import { EnemyBoat, Director, HUNT } from './enemies.js';
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
window.__DEBUG = {
  input,
  get combat() { return combat; },
  get boat() { return boat; },
  get player() { return player; },
  get enemies() { return enemies; },
  get mp() { return mp; },
  startGame: () => startSingleplayerGame(),
  startMultiplayer: () => startMultiplayerFromMenu(),
  get isStartScreenActive() { return isStartScreenActive(); },
  get menuMusic() { return menuMusicAudio; },
};
const hud = createHud();
// browsers only start audio after a click or key press
for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => audio.init());
const toggleAudio = () => {
  if (isStartScreenActive()) {
    toggleMenuMusic();
    return;
  }
  const isMuted = audio.toggleMute();
  if (settingsAudioIcon) settingsAudioIcon.textContent = isMuted ? '🔇' : '🔊';
  if (settingsAudioText) settingsAudioText.textContent = isMuted ? 'Sound: Muted (M)' : 'Sound: On (M)';
  hud.toast(isMuted ? '🔇 Sound off (M)' : '🔊 Sound on (M)', 1200);
};
input.onAction('mute', toggleAudio);
input.onWeapon(() => audio.click());

// the controls tutorial lives behind a ? button (or the ? key)
const helpBtn = document.getElementById('help-btn');
const controls = document.getElementById('controls');
const toggleHelp = () => controls.classList.toggle('hidden');
helpBtn.addEventListener('click', toggleHelp);
input.onAction('help', toggleHelp);
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
const settingsKeybindsBtn = document.getElementById('settings-keybinds-btn');
const settingsKeybindsView = document.getElementById('settings-keybinds-view');
const keybindsBackBtn = document.getElementById('keybinds-back-btn');
const boostModeToggleBtn = document.getElementById('boost-mode-toggle-btn');
const boostModeHoldBtn = document.getElementById('boost-mode-hold-btn');
const boostModeDesc = document.getElementById('boost-mode-desc');
const keybindsResetBtn = document.getElementById('keybinds-reset-btn');
const keybindsList = document.getElementById('keybinds-list');
let recordingAction = null;
let mp = null;
let mpHud = null;

function renderKeybindsUI() {
  if (!settingsKeybindsView || !keybindsList) return;
  const currentBinds = input.getKeybinds();
  const currentBoostMode = input.getBoostMode();

  // 1. Boost Mode at the TOP
  if (boostModeToggleBtn && boostModeHoldBtn) {
    const isToggle = currentBoostMode === 'toggle';
    boostModeToggleBtn.classList.toggle('active', isToggle);
    boostModeHoldBtn.classList.toggle('active', !isToggle);
    if (boostModeDesc) {
      boostModeDesc.textContent = isToggle
        ? 'Toggle: Press Shift once to start or stop boost.'
        : 'Hold: Hold Shift down to surge; release to coast.';
    }
  }

  // 2. Custom Keybutton Mapping Options below Boost Mode
  keybindsList.innerHTML = '';
  for (const def of KEYBIND_DEFS) {
    const row = document.createElement('div');
    row.className = 'keybind-row';

    const info = document.createElement('div');
    info.className = 'keybind-info';

    const icon = document.createElement('span');
    icon.className = 'keybind-icon';
    icon.textContent = def.icon;

    const labels = document.createElement('div');
    labels.className = 'keybind-labels';

    const name = document.createElement('div');
    name.className = 'keybind-name';
    name.textContent = def.name;

    const desc = document.createElement('div');
    desc.className = 'keybind-desc';
    desc.textContent = def.desc;

    labels.appendChild(name);
    labels.appendChild(desc);
    info.appendChild(icon);
    info.appendChild(labels);

    const badgeBtn = document.createElement('button');
    badgeBtn.className = 'keybind-badge-btn';
    badgeBtn.type = 'button';

    const isRec = recordingAction === def.id;
    if (isRec) {
      badgeBtn.classList.add('recording');
      badgeBtn.textContent = 'Press key...';
    } else {
      const boundKeys = currentBinds[def.id] || [];
      const primaryKey = boundKeys[0];
      badgeBtn.textContent = primaryKey ? formatKeyName(primaryKey) : 'None';
    }

    badgeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      audio.click();
      if (recordingAction === def.id) {
        recordingAction = null;
        renderKeybindsUI();
        return;
      }
      recordingAction = def.id;
      renderKeybindsUI();

      const onKeyCapture = (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
        window.removeEventListener('keydown', onKeyCapture, true);
        if (evt.code === 'Escape') {
          recordingAction = null;
          renderKeybindsUI();
          return;
        }
        input.setKeybind(def.id, evt.code);
        recordingAction = null;
        audio.click();
        hud.toast(`Bound ${def.name} to [${formatKeyName(evt.code)}]`, 1200);
        renderKeybindsUI();
      };

      window.addEventListener('keydown', onKeyCapture, true);
    });

    row.appendChild(info);
    row.appendChild(badgeBtn);
    keybindsList.appendChild(row);
  }
}

function openKeybindsView(fromStart = false) {
  if (!settingsKeybindsView) return;
  const offlineView = document.getElementById('settings-offline-view');
  const onlineView = document.getElementById('settings-online-view');
  const titleEl = document.getElementById('settings-modal-title');
  const tipEl = document.getElementById('settings-tip-text');
  const footerEl = document.querySelector('.settings-footer');

  if (offlineView) offlineView.classList.add('hidden');
  if (onlineView) onlineView.classList.add('hidden');
  settingsKeybindsView.classList.remove('hidden');

  if (settingsModal) {
    settingsModal.classList.add('keybinds-active');
    settingsModal.classList.toggle('from-start-screen', fromStart);
  }
  if (footerEl) footerEl.classList.add('hidden');

  if (titleEl) titleEl.textContent = '⌨️ Keybinds & Controls';
  if (tipEl) tipEl.innerHTML = 'Click any key badge to customize your mapping!';

  renderKeybindsUI();
  audio.click();
}

function closeKeybindsView() {
  if (settingsKeybindsView) settingsKeybindsView.classList.add('hidden');
  if (settingsModal) {
    settingsModal.classList.remove('keybinds-active');
    settingsModal.classList.remove('from-start-screen');
  }
  const footerEl = document.querySelector('.settings-footer');
  if (footerEl) footerEl.classList.remove('hidden');
  updateSettingsUI();
  audio.click();
}

function updateSettingsUI() {
  if (settingsKeybindsView) settingsKeybindsView.classList.add('hidden');
  if (settingsModal) {
    settingsModal.classList.remove('keybinds-active');
    settingsModal.classList.remove('from-start-screen');
  }
  const footerEl = document.querySelector('.settings-footer');
  if (footerEl) footerEl.classList.remove('hidden');
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
    settingsModal.classList.remove('centered-modal');
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
      checkBackdropVisibility();
      audio.click();
    });
  }
  addEventListener('click', (e) => {
    if (!settingsModal.classList.contains('hidden') && !settingsModal.contains(e.target) && e.target !== settingsBtn && e.target !== startBtnKeybinds && !startBtnKeybinds?.contains(e.target)) {
      settingsModal.classList.add('hidden');
      checkBackdropVisibility();
    }
  });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !settingsModal.classList.contains('hidden')) {
      settingsModal.classList.add('hidden');
      checkBackdropVisibility();
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
const toggleSkinAction = () => {
  if (typeof mp !== 'undefined' && mp && mp.mode === 'online' && mp.roomCode) return;
  const next = boat.toggleSkin();
  applySkin(next);
};
input.onAction('skin', toggleSkinAction);

if (settingsAudioBtn) {
  settingsAudioBtn.addEventListener('click', () => {
    const isMuted = audio.toggleMute();
    if (settingsAudioIcon) settingsAudioIcon.textContent = isMuted ? '🔇' : '🔊';
    if (settingsAudioText) settingsAudioText.textContent = isMuted ? 'Sound: Muted (M)' : 'Sound: On (M)';
    hud.toast(isMuted ? '🔇 Sound off (M)' : '🔊 Sound on (M)', 1200);
  });
}

if (settingsKeybindsBtn) settingsKeybindsBtn.addEventListener('click', openKeybindsView);
if (keybindsBackBtn) keybindsBackBtn.addEventListener('click', closeKeybindsView);

if (boostModeToggleBtn) {
  boostModeToggleBtn.addEventListener('click', () => {
    input.setBoostMode('toggle');
    audio.click();
    hud.toast('🚀 Boost set to TOGGLE mode! (Tap Shift)', 1200);
    renderKeybindsUI();
  });
}
if (boostModeHoldBtn) {
  boostModeHoldBtn.addEventListener('click', () => {
    input.setBoostMode('hold');
    audio.click();
    hud.toast('⚡ Boost set to HOLD mode! (Hold Shift to boost)', 1200);
    renderKeybindsUI();
  });
}

if (keybindsResetBtn) {
  keybindsResetBtn.addEventListener('click', () => {
    input.resetKeybinds();
    audio.click();
    hud.toast('🔄 Keybinds reset to defaults!', 1400);
    renderKeybindsUI();
  });
}

updateSettingsUI();

// ---------- 🌴 Start Screen & Menu Music ----------
const startScreen = document.getElementById('start-screen');
const startBtnSingleplayer = document.getElementById('start-btn-singleplayer');
const startBtnMultiplayer = document.getElementById('start-btn-multiplayer');
const startBtnKeybinds = document.getElementById('start-btn-keybinds');
const startBtnHowToPlay = document.getElementById('start-btn-howtoplay');
const startBtnQuit = document.getElementById('start-btn-quit');
const startMusicBtn = document.getElementById('start-music-btn');
const startMusicIcon = document.getElementById('start-music-icon');

const howToPlayModal = document.getElementById('how-to-play-modal');
const howToPlayClose = document.getElementById('how-to-play-close');
const howToPlayConfirmBtn = document.getElementById('how-to-play-confirm-btn');

const quitModal = document.getElementById('quit-modal');
const quitModalClose = document.getElementById('quit-modal-close');
const quitModalConfirm = document.getElementById('quit-modal-confirm');
const quitModalCancel = document.getElementById('quit-modal-cancel');
const modalBackdrop = document.getElementById('modal-backdrop');

function checkBackdropVisibility() {
  const mpHubModal = document.getElementById('mp-hub-modal');
  const mpLobbyModal = document.getElementById('mp-lobby-modal');
  const isAnyOpen = (howToPlayModal && !howToPlayModal.classList.contains('hidden')) ||
                    (quitModal && !quitModal.classList.contains('hidden')) ||
                    (mpHubModal && !mpHubModal.classList.contains('hidden')) ||
                    (mpLobbyModal && !mpLobbyModal.classList.contains('hidden')) ||
                    (settingsModal && !settingsModal.classList.contains('hidden') && settingsModal.classList.contains('centered-modal'));
  if (modalBackdrop) modalBackdrop.classList.toggle('hidden', !isAnyOpen);
}

const START_MENU_TRACKS = [
  '/music/start_menu_1.mp3',
  '/music/start_menu_2.mp3',
  '/music/start_menu_3.mp3'
];

let menuMusicAudio = null;
let menuMusicMuted = false;
try {
  menuMusicMuted = localStorage.getItem('boom_boats_menu_music_muted') === 'true';
} catch {}

function isStartScreenActive() {
  return !!(startScreen && !startScreen.classList.contains('hidden'));
}

function updateMenuMusicIcon() {
  if (startMusicIcon) {
    startMusicIcon.textContent = menuMusicMuted ? '🔇' : '🎵';
  }
  if (startMusicBtn) {
    startMusicBtn.title = menuMusicMuted ? 'Unmute Menu Music (M)' : 'Mute Menu Music (M)';
  }
}

function playRandomMenuMusic() {
  if (menuMusicAudio) {
    try {
      menuMusicAudio.pause();
      menuMusicAudio.currentTime = 0;
    } catch {}
  }
  const track = START_MENU_TRACKS[Math.floor(Math.random() * START_MENU_TRACKS.length)];
  menuMusicAudio = new Audio(track);
  menuMusicAudio.loop = true;
  menuMusicAudio.volume = 0.5;
  menuMusicAudio.muted = menuMusicMuted;
  updateMenuMusicIcon();

  const playPromise = menuMusicAudio.play();
  if (playPromise !== undefined && typeof playPromise.catch === 'function') {
    playPromise.catch(() => {
      // Autoplay blocked until gesture
      const onFirstGesture = () => {
        if (menuMusicAudio && !menuMusicMuted && isStartScreenActive()) {
          menuMusicAudio.play().catch(() => {});
        }
        window.removeEventListener('pointerdown', onFirstGesture);
        window.removeEventListener('keydown', onFirstGesture);
      };
      window.addEventListener('pointerdown', onFirstGesture, { once: true });
      window.addEventListener('keydown', onFirstGesture, { once: true });
    });
  }
}

function pauseMenuMusic() {
  if (menuMusicAudio) {
    try { menuMusicAudio.pause(); } catch {}
  }
}

function toggleMenuMusic() {
  menuMusicMuted = !menuMusicMuted;
  try { localStorage.setItem('boom_boats_menu_music_muted', String(menuMusicMuted)); } catch {}
  if (menuMusicAudio) {
    menuMusicAudio.muted = menuMusicMuted;
    if (!menuMusicMuted && menuMusicAudio.paused && isStartScreenActive()) {
      menuMusicAudio.play().catch(() => {});
    }
  } else if (!menuMusicMuted && isStartScreenActive()) {
    playRandomMenuMusic();
  }
  updateMenuMusicIcon();
}

function startSingleplayerGame() {
  if (startScreen) startScreen.classList.add('hidden');
  pauseMenuMusic();
  audio.init();
  hud.toast('Welcome, Captain! Hold W to sail.', 2000);
}

function startMultiplayerFromMenu(e) {
  if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
  if (mp && mp.net) mp.net.connect();
  const mpHubModal = document.getElementById('mp-hub-modal');
  if (mpHubModal) {
    mpHubModal.classList.remove('hidden');
    if (mpHud && mpHud.loadSavedName) mpHud.loadSavedName();
    if (mpHud && mpHud.updateButtonsState) mpHud.updateButtonsState();
  }
  checkBackdropVisibility();
  audio.click();
}

function openKeybindsFromMenu(e) {
  if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
  if (settingsModal) {
    settingsModal.classList.add('centered-modal');
    settingsModal.classList.remove('hidden');
  }
  openKeybindsView(true);
  checkBackdropVisibility();
}

if (startBtnSingleplayer) startBtnSingleplayer.addEventListener('click', startSingleplayerGame);
if (startBtnMultiplayer) startBtnMultiplayer.addEventListener('click', startMultiplayerFromMenu);
if (startBtnKeybinds) startBtnKeybinds.addEventListener('click', openKeybindsFromMenu);

if (startBtnHowToPlay) {
  startBtnHowToPlay.addEventListener('click', () => {
    if (howToPlayModal) howToPlayModal.classList.remove('hidden');
    checkBackdropVisibility();
    audio.click();
  });
}
if (howToPlayClose) {
  howToPlayClose.addEventListener('click', () => {
    if (howToPlayModal) howToPlayModal.classList.add('hidden');
    checkBackdropVisibility();
    audio.click();
  });
}
if (howToPlayConfirmBtn) {
  howToPlayConfirmBtn.addEventListener('click', () => {
    if (howToPlayModal) howToPlayModal.classList.add('hidden');
    checkBackdropVisibility();
    audio.click();
    startSingleplayerGame();
  });
}

if (startBtnQuit) {
  startBtnQuit.addEventListener('click', () => {
    if (quitModal) quitModal.classList.remove('hidden');
    checkBackdropVisibility();
    audio.click();
  });
}
if (quitModalClose) {
  quitModalClose.addEventListener('click', () => {
    if (quitModal) quitModal.classList.add('hidden');
    checkBackdropVisibility();
    audio.click();
  });
}
if (quitModalCancel) {
  quitModalCancel.addEventListener('click', () => {
    if (quitModal) quitModal.classList.add('hidden');
    checkBackdropVisibility();
    audio.click();
  });
}
if (quitModalConfirm) {
  quitModalConfirm.addEventListener('click', () => {
    try { window.close(); } catch {}
    alert('Thank you for playing Boom Boats! You can now close this browser tab.');
  });
}

if (modalBackdrop) {
  modalBackdrop.addEventListener('click', () => {
    if (howToPlayModal) howToPlayModal.classList.add('hidden');
    if (quitModal) quitModal.classList.add('hidden');
    const mpHubModal = document.getElementById('mp-hub-modal');
    if (mpHubModal) mpHubModal.classList.add('hidden');
    if (settingsModal && settingsModal.classList.contains('centered-modal')) {
      settingsModal.classList.add('hidden');
      settingsModal.classList.remove('keybinds-active');
      settingsModal.classList.remove('from-start-screen');
    }
    checkBackdropVisibility();
    audio.click();
  });
}

if (startMusicBtn) {
  startMusicBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMenuMusic();
  });
}

window.__pauseMenuMusic = pauseMenuMusic;
window.__playRandomMenuMusic = playRandomMenuMusic;

// Start random menu music on load
playRandomMenuMusic();

let kills = 0;
let warned = false;
let shake = 0;
let missileCd = 0;
let missileWarnTimer = 0;
let gunTimer = 0;
let gunSide = 1;
let ramCd = 0;
const enemyRamCds = new Map();
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
    if (mp && mp.mode === 'online') {
      // In online multiplayer, player damage is strictly authoritative from the server via 'remoteHit'.
      // The attacker's client reports 'dealDamage' to the server.
      // Local client prediction of remote projectiles must not double-deduct damage or send 'reportLocalHit',
      // which causes desync and health bouncing/fluctuations.
      return;
    }
    this.hp = Math.max(0, this.hp - n);
    this.sinceHit = 0;
    audio.hurt();
    hud.flash(Math.min(0.9, 0.25 + n / 60));
    if (boat.group?.userData?.hit) boat.group.userData.hit();
    if (boat.fpv?.userData?.hit) boat.fpv.userData.hit();

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
    const wasInFPV = isFPV;
    boat.applyStyle(style, colorIndex, boatSkin);
    if (wasInFPV && boat.fpv) {
      for (let i = camera.children.length - 1; i >= 0; i--) {
        if (camera.children[i].userData?.isFPVHUD) {
          camera.remove(camera.children[i]);
        }
      }
      boat.fpv.userData.mount(camera);
      boat.fpv.userData.setActive(true);
    }
  },
  teleportLocalPlayer: (x, z, yaw) => {
    boat.teleport(x, z, yaw);
    snapCamera();
  },
  healLocalPlayer: (amount, explicitTargetHp) => {
    if (player.alive) {
      const before = player.hp;
      if (explicitTargetHp !== undefined) {
        player.hp = Math.min(player.maxHp, explicitTargetHp);
      } else {
        player.hp = Math.min(player.maxHp, player.hp + amount);
      }
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

const angleDiff = (a, b) => ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;

// Fighter-jet style: the missile locks onto the boat closest to your nose (inside a cone, within range) at launch,
// tracks it for a short time (2.5s), then flies on. No boat in the cone = no lock, it flies straight.
function acquireLock() {
  const s = boat.state, W = WEAPONS.missile;
  let best = null, bestScore = 1e9;
  const pool = (mp && mp.mode === 'online') ? mp.getTargets() : enemies;
  for (const e of pool) {
    if (!e.alive) continue;
    const dx = e.state.x - s.x, dz = e.state.z - s.z;
    const d = Math.hypot(dx, dz);
    if (d > (W.lockRange || 360) || d < 4) continue;
    let off = Math.atan2(dx, dz) - s.yaw;
    off = Math.atan2(Math.sin(off), Math.cos(off));
    if (Math.abs(off) > (W.lockCone || 1.25)) continue;
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
  hud.toast(lock ? `🎯 Locked on ${targetLabel}! Tracking for 2.5s` : '🚀 No lock: aim at a boat', 1100);
  missileCd = WEAPONS.missile.cooldown;

  if (mp && mp.mode === 'online') {
    mp.broadcastLocalFire('missile', s, lock ? lock.id : null);
  }
}

// Shift: toggle or hold the speed boost (configured via Keybinds)
const tryBoost = () => {
  if (!player.alive) return;
  const was = boat.boosting;
  const on = boat.toggleBoost();
  if (on) hud.toast('🔥 BOOST ON! Ram them!', 1200);
  else if (was) hud.toast('Boost off', 800);
};

const handleBoostAction = (isDown) => {
  if (!player.alive) return;
  const mode = input.getBoostMode();
  if (mode === 'hold') {
    if (isDown) {
      const ok = boat.setBoost(true);
      if (ok) hud.toast('🔥 BOOSTING! (Hold)', 900);
    } else {
      boat.setBoost(false);
      hud.toast('Boost off', 600);
    }
  } else {
    // Toggle Mode
    if (isDown) tryBoost();
  }
};
input.onBoostPress(handleBoostAction);

// Free fast travel home so nobody ever gets stuck
const travelHome = () => {
  if (!player.alive) return;
  const home = WORLD.islands.find((i) => i.home);
  const len = Math.hypot(home.x, home.z) || 1;
  const dx = -home.x / len, dz = -home.z / len; // direction toward the harbor
  boat.teleport(home.x + dx * (home.r + 8), home.z + dz * (home.r + 8), Math.atan2(dx, dz));
  camYaw = boat.state.yaw;
  hud.toast('Welcome home! Your resort will grow here.', 3000);
};
input.onAction('home', travelHome);

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
    for (let i = camera.children.length - 1; i >= 0; i--) {
      if (camera.children[i].userData?.isFPVHUD) {
        camera.remove(camera.children[i]);
      }
    }
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
    for (let i = camera.children.length - 1; i >= 0; i--) {
      if (camera.children[i].userData?.isFPVHUD) {
        camera.remove(camera.children[i]);
      }
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

input.onAction('fpv', toggleFPV);

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

  const startScreenOpen = isStartScreenActive();
  if (startScreenOpen) {
    // Keep gentle water waves and sky moving visually in the background,
    // but completely freeze gameplay entities, enemy AI, combat, and in-game audio.
    water.update(s.x, s.z, t);
    sky.update(camera, t);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
    return;
  }

  const controlsActive = !startScreenOpen && (!isOnline || (mp.matchState === 'playing'));

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
        const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw);
        const lx = Math.cos(s.yaw), lz = -Math.sin(s.yaw);
        const ang = s.yaw + (Math.random() - 0.5) * 2 * (WEAPONS.gun.spread || 0);
        const bspd = WEAPONS.gun.speed + Math.max(0, s.speed);
        // Fire both left & right barrels simultaneously so twin parallel streams are always visible
        for (const side of [-1, 1]) {
          const bx = s.x + fx * 3.6 + lx * side * 0.55;
          const bz = s.z + fz * 3.6 + lz * side * 0.55;
          combat.fireBullet('player', bx, bz, ang, bspd, WEAPONS.gun.dmg, WEAPONS.gun.life);
        }
        if (boat.fpv?.userData?.fire) boat.fpv.userData.fire();

        if (isOnline) {
          mp.broadcastLocalFire('gun', { x: s.x + fx * 3.6, z: s.z + fz * 3.6, yaw: ang, speed: bspd });
        }
      }
    }
    // The missile fires whenever it is ready and fire button/key is triggered.
    missileWarnTimer -= dt;
    if (controlsActive && input.state.fire && input.state.weapon === 'missile') {
      if (missileCd <= 0) {
        fireMissile();
      } else if (missileWarnTimer <= 0) {
        missileWarnTimer = 1.0;
        hud.toast(`⏳ Missile reloading (${missileCd.toFixed(1)}s)! Press 1 for Machine Gun`, 1100);
      }
    }

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
          e.takeDamage(Math.min(e.maxHp * BOAT.boostRamEnemyPct, e.maxHp * 0.15), 'player');
          player.takeDamage(Math.min(player.maxHp * BOAT.boostRamSelfPct, player.maxHp * 0.15), e.team);
          combat.explode(s.x - nx * 2, s.z - nz * 2, 5, 0.4);
          combat.ring(s.x - nx * 2, s.z - nz * 2, 9, 0.45, 0xffffff, 0.8);
          shake = Math.max(shake, 1.0);
          s.speed *= 0.8;
        } else if (ramCd <= 0 && s.speed > 22) {
          ramCd = 0.9;
          const hit = s.speed;
          e.takeDamage(Math.min(hit * 0.8, e.maxHp * 0.15), 'player'); // capped at 15% of max HP
          player.takeDamage(Math.min(hit * 0.12, player.maxHp * 0.15), e.team);
          combat.explode(s.x + nx * -2, s.z + nz * -2, 4, 0.35);
          shake = Math.max(shake, 0.8);
          s.speed *= 0.6;
          boat.top = Math.max(BOAT.baseTop, boat.top - 8);
        } else if (ramCd <= 0 && e.bOn) {            // enemy rammed us while boosting
          ramCd = 0.9;
          player.takeDamage(player.maxHp * 0.12, e.team);   // player.takeDamage already respects invuln
          e.takeDamage(e.maxHp * 0.05, null);
          combat.explode(s.x, s.z, 4, 0.35); shake = Math.max(shake, 0.9);
          s.speed *= 0.85;
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

        const pairKey = `${i}_${j}`;
        const cd = enemyRamCds.get(pairKey) || 0;
        if (cd <= t && (a.bOn || b.bOn)) {
          enemyRamCds.set(pairKey, t + 0.9);
          if (a.bOn && !b.bOn) {
            b.takeDamage(Math.min(b.maxHp * 0.15, b.maxHp * 0.15), a.team);
            a.takeDamage(Math.min(a.maxHp * 0.05, a.maxHp * 0.15), null);
            combat.explode(b.state.x, b.state.z, 3.5, 0.3);
          } else if (b.bOn && !a.bOn) {
            a.takeDamage(Math.min(a.maxHp * 0.15, a.maxHp * 0.15), b.team);
            b.takeDamage(Math.min(b.maxHp * 0.05, b.maxHp * 0.15), null);
            combat.explode(a.state.x, a.state.z, 3.5, 0.3);
          } else if (a.bOn && b.bOn) {
            a.takeDamage(Math.min(a.maxHp * 0.10, a.maxHp * 0.15), b.team);
            b.takeDamage(Math.min(b.maxHp * 0.10, b.maxHp * 0.15), a.team);
            combat.explode((a.state.x + b.state.x) * 0.5, (a.state.z + b.state.z) * 0.5, 4, 0.35);
          }
        }
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
