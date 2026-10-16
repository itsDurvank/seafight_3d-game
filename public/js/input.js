// public/js/input.js
// Keyboard + mouse input with customizable keybindings, persistence,
// and Boost activation mode (Toggle vs Hold).

export function mouseButtonToCode(button) {
  if (button === 0) return 'MouseLeft';
  if (button === 1) return 'MouseMiddle';
  if (button === 2) return 'MouseRight';
  if (button === 3) return 'MouseBack';
  if (button === 4) return 'MouseForward';
  return 'MouseButton' + button;
}

export const DEFAULT_KEYBINDS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  brake: ['Space'],
  boost: ['ShiftLeft', 'ShiftRight'],
  fire: ['MouseLeft', 'KeyF', 'Enter'],
  gun: ['Digit1', 'Numpad1'],
  missile: ['Digit2', 'Numpad2'],
  fpv: ['KeyV'],
  skin: ['KeyO'],
  home: ['KeyH'],
  mute: ['KeyM'],
  help: ['Slash'],
};

export const KEYBIND_DEFS = [
  { id: 'forward', name: 'Sail Forward', icon: '⛵', desc: 'Accelerate forward' },
  { id: 'back',    name: 'Reverse / Back', icon: '⚓', desc: 'Slow down & reverse up to 30 km/h (S)' },
  { id: 'left',    name: 'Steer Left', icon: '◀️', desc: 'Turn port (left)' },
  { id: 'right',   name: 'Steer Right', icon: '▶️', desc: 'Turn starboard (right)' },
  { id: 'brake',   name: 'Brake', icon: '🛑', desc: 'Scrub speed for tight turns' },
  { id: 'boost',   name: 'Speed Boost', icon: '🔥', desc: 'High-speed ramming surge' },
  { id: 'fire',    name: 'Fire Weapon / Primary', icon: '💥', desc: 'Twin cannons / primary fire trigger' },
  { id: 'gun',     name: 'Machine Gun', icon: '🔫', desc: 'Fire / equip machine gun (1 / Wheel Up)' },
  { id: 'missile', name: 'Missiles', icon: '🚀', desc: 'Fire / launch missiles (2 / Wheel Down)' },
  { id: 'fpv',     name: 'Cockpit View', icon: '🎛️', desc: 'Toggle first-person view' },
  { id: 'skin',    name: 'Switch Skin', icon: '🎨', desc: 'Cycle boat skins' },
  { id: 'home',    name: 'Sail Home', icon: '🏠', desc: 'Fast travel to harbor' },
  { id: 'mute',    name: 'Mute / Unmute', icon: '🔊', desc: 'Toggle game audio' },
  { id: 'help',    name: 'Controls Help', icon: '❓', desc: 'Toggle controls guide' },
];

export function formatKeyName(code) {
  if (!code) return 'None';
  if (code === 'MouseLeft' || code === 'Mouse0') return 'L-Click';
  if (code === 'MouseRight' || code === 'Mouse2') return 'R-Click';
  if (code === 'MouseMiddle' || code === 'Mouse1') return 'M-Click';
  if (code === 'MouseBack' || code === 'Mouse3') return 'Mouse 4';
  if (code === 'MouseForward' || code === 'Mouse4') return 'Mouse 5';
  if (code.startsWith('MouseButton')) return 'Mouse ' + code.slice(11);
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'Shift';
  if (code === 'ControlLeft' || code === 'ControlRight') return 'Ctrl';
  if (code === 'AltLeft' || code === 'AltRight') return 'Alt';
  if (code === 'ArrowUp') return '↑';
  if (code === 'ArrowDown') return '↓';
  if (code === 'ArrowLeft') return '←';
  if (code === 'ArrowRight') return '→';
  if (code === 'Space') return 'Space';
  if (code === 'Slash') return '? /';
  if (code === 'Enter') return 'Enter';
  if (code === 'Tab') return 'Tab';
  if (code === 'Backspace') return '⌫';
  if (code === 'Escape') return 'Esc';
  return code;
}

function loadSavedKeybinds() {
  try {
    const raw = localStorage.getItem('boom_boats_keybinds');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const merged = { ...DEFAULT_KEYBINDS };
        for (const [k, v] of Object.entries(parsed)) {
          if (merged[k] && Array.isArray(v) && v.length > 0) {
            merged[k] = v;
          }
        }
        return merged;
      }
    }
  } catch {}
  return { ...DEFAULT_KEYBINDS };
}

function saveKeybindsToStorage(binds) {
  try {
    localStorage.setItem('boom_boats_keybinds', JSON.stringify(binds));
  } catch {}
}

function loadBoostMode() {
  try {
    const m = localStorage.getItem('boom_boats_boost_mode');
    if (m === 'hold' || m === 'toggle') return m;
  } catch {}
  return 'toggle'; // Default is toggle mode
}

function saveBoostModeToStorage(mode) {
  try {
    localStorage.setItem('boom_boats_boost_mode', mode);
  } catch {}
}

export function createInput() {
  const state = {
    forward: false,
    back: false,
    left: false,
    right: false,
    brake: false,
    boost: false,
    weapon: 'gun', // 'gun' | 'missile'
    fire: false,   // generic fire trigger (held)
    gunFire: false, // gun action held
    missileFire: false, // missile action held
  };

  let keybinds = loadSavedKeybinds();
  let boostMode = loadBoostMode();
  let codeToAction = {};

  const rebuildCodeMap = () => {
    codeToAction = {};
    for (const [action, codes] of Object.entries(keybinds)) {
      const list = Array.isArray(codes) ? codes : [codes];
      for (const c of list) {
        if (c) codeToAction[c] = action;
      }
    }
  };
  rebuildCodeMap();

  const pressHandlers = {};
  const actionHandlers = {};
  const weaponListeners = [];
  const boostListeners = [];
  const missileTriggerListeners = [];
  const keybindChangeListeners = [];
  const boostModeChangeListeners = [];

  const selectWeapon = (w) => {
    if (state.weapon === w) return;
    state.weapon = w;
    for (const fn of weaponListeners) fn(w);
  };

  // Clickable on-screen weapon slots
  const wireSlots = () => {
    const gunSlot = document.getElementById('gun-slot');
    if (gunSlot) gunSlot.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      selectWeapon('gun');
    });
    const missileSlot = document.getElementById('missile-slot');
    if (missileSlot) missileSlot.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      selectWeapon('missile');
      for (const fn of missileTriggerListeners) fn();
    });
    const boostSlot = document.getElementById('boost-slot');
    if (boostSlot) {
      boostSlot.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        for (const fn of boostListeners) fn(true);
      });
      const onBoostSlotRelease = (e) => {
        if (boostMode === 'hold') {
          for (const fn of boostListeners) fn(false);
        }
      };
      boostSlot.addEventListener('pointerup', onBoostSlotRelease);
      boostSlot.addEventListener('pointercancel', onBoostSlotRelease);
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireSlots);
  } else {
    wireSlots();
  }

  addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const action = codeToAction[e.code];

    if (action) {
      if (action === 'forward' || action === 'back' || action === 'left' || action === 'right' || action === 'brake') {
        state[action] = true;
        e.preventDefault();
      } else if (action === 'fire') {
        state.fire = true;
        e.preventDefault();
      } else if (action === 'gun') {
        selectWeapon('gun');
        state.gunFire = true;
        e.preventDefault();
      } else if (action === 'missile') {
        selectWeapon('missile');
        state.missileFire = true;
        if (!e.repeat) {
          for (const fn of missileTriggerListeners) fn();
        }
        e.preventDefault();
      } else if (action === 'boost') {
        state.boost = true;
        if (!e.repeat) {
          for (const fn of boostListeners) fn(true);
        }
        e.preventDefault();
      } else {
        if (!e.repeat && actionHandlers[action]) {
          actionHandlers[action]();
          e.preventDefault();
        }
      }
    } else {
      // Support direct legacy code listeners only when key is not mapped to an action
      if (!e.repeat && pressHandlers[e.code]) {
        pressHandlers[e.code]();
        e.preventDefault();
      }
    }
  });

  addEventListener('keyup', (e) => {
    const action = codeToAction[e.code];
    if (action) {
      if (action === 'forward' || action === 'back' || action === 'left' || action === 'right' || action === 'brake') {
        state[action] = false;
      } else if (action === 'fire') {
        state.fire = false;
      } else if (action === 'gun') {
        state.gunFire = false;
      } else if (action === 'missile') {
        state.missileFire = false;
      } else if (action === 'boost') {
        state.boost = false;
        for (const fn of boostListeners) fn(false);
      }
    }
  });

  // Mouse buttons as keybinds
  addEventListener('pointerdown', (e) => {
    if (e.target && e.target.closest && e.target.closest('.ui-btn, #controls, #settings-modal, #settings-btn, #weapons, .slot, .keybind-badge-btn, #start-screen, #sp-pause-overlay')) return;
    const code = mouseButtonToCode(e.button);
    const action = codeToAction[code];
    if (action) {
      if (action === 'forward' || action === 'back' || action === 'left' || action === 'right' || action === 'brake') {
        state[action] = true;
      } else if (action === 'fire') {
        state.fire = true;
      } else if (action === 'gun') {
        selectWeapon('gun');
        state.gunFire = true;
      } else if (action === 'missile') {
        selectWeapon('missile');
        state.missileFire = true;
        for (const fn of missileTriggerListeners) fn();
      } else if (action === 'boost') {
        state.boost = true;
        for (const fn of boostListeners) fn(true);
      } else {
        if (actionHandlers[action]) actionHandlers[action]();
      }
      e.preventDefault();
    } else if (e.button === 0 && !codeToAction['MouseLeft']) {
      // Default fallback fire if Left Click isn't explicitly remapped
      state.fire = true;
    }
  });

  const releasePointer = (e) => {
    const code = mouseButtonToCode(e.button);
    const action = codeToAction[code];
    if (action) {
      if (action === 'forward' || action === 'back' || action === 'left' || action === 'right' || action === 'brake') {
        state[action] = false;
      } else if (action === 'fire') {
        state.fire = false;
      } else if (action === 'gun') {
        state.gunFire = false;
      } else if (action === 'missile') {
        state.missileFire = false;
      } else if (action === 'boost') {
        state.boost = false;
        for (const fn of boostListeners) fn(false);
      }
    }
    if (e.button === 0 && (!action || action === 'fire')) {
      state.fire = false;
    }
  };
  addEventListener('pointerup', releasePointer);
  addEventListener('pointercancel', () => {
    for (const k of ['forward', 'back', 'left', 'right', 'brake', 'fire', 'gunFire', 'missileFire', 'boost']) state[k] = false;
    for (const fn of boostListeners) fn(false);
  });
  addEventListener('contextmenu', (e) => e.preventDefault());

  // Mouse wheel scroll to shift / cycle weapons (scroll down = next/missile, scroll up = prev/gun)
  let wheelTimer = null;
  const WEAPONS_ORDER = ['gun', 'missile'];
  addEventListener('wheel', (e) => {
    if (e.target && e.target.closest && e.target.closest('.keybinds-list, .skin-picker, .mp-lobby-boat-picker, textarea, input, select')) return;
    if (Math.abs(e.deltaY) < 15) return;
    if (wheelTimer) return;
    wheelTimer = setTimeout(() => { wheelTimer = null; }, 120);

    const currIdx = WEAPONS_ORDER.indexOf(state.weapon);
    let nextIdx;
    if (e.deltaY > 0) {
      nextIdx = (currIdx + 1) % WEAPONS_ORDER.length;
    } else {
      nextIdx = (currIdx - 1 + WEAPONS_ORDER.length) % WEAPONS_ORDER.length;
    }
    selectWeapon(WEAPONS_ORDER[nextIdx]);
  }, { passive: true });

  addEventListener('blur', () => {
    for (const k of ['forward', 'back', 'left', 'right', 'brake', 'fire', 'gunFire', 'missileFire', 'boost']) state[k] = false;
    for (const fn of boostListeners) fn(false);
  });

  return {
    state,
    selectWeapon,
    onPress: (code, fn) => { pressHandlers[code] = fn; },
    onAction: (action, fn) => { actionHandlers[action] = fn; },
    onWeapon: (fn) => weaponListeners.push(fn),
    onMissileTrigger: (fn) => missileTriggerListeners.push(fn),
    onBoostPress: (fn) => boostListeners.push(fn),
    getKeybinds: () => ({ ...keybinds }),
    setKeybind: (action, code) => {
      keybinds[action] = [code];
      rebuildCodeMap();
      saveKeybindsToStorage(keybinds);
      for (const fn of keybindChangeListeners) fn(keybinds);
      return keybinds;
    },
    resetKeybinds: () => {
      keybinds = { ...DEFAULT_KEYBINDS };
      rebuildCodeMap();
      saveKeybindsToStorage(keybinds);
      for (const fn of keybindChangeListeners) fn(keybinds);
      return keybinds;
    },
    onKeybindsChange: (fn) => keybindChangeListeners.push(fn),
    getBoostMode: () => boostMode,
    setBoostMode: (m) => {
      boostMode = m === 'hold' ? 'hold' : 'toggle';
      saveBoostModeToStorage(boostMode);
      for (const fn of boostModeChangeListeners) fn(boostMode);
      return boostMode;
    },
    onBoostModeChange: (fn) => boostModeChangeListeners.push(fn),
  };
}
