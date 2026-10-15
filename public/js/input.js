// public/js/input.js
// Keyboard + mouse input with customizable keybindings, persistence,
// and Boost activation mode (Toggle vs Hold).

export const DEFAULT_KEYBINDS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  brake: ['Space'],
  boost: ['ShiftLeft', 'ShiftRight'],
  fire: ['KeyF', 'Enter'],
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
  { id: 'back',    name: 'Reverse / Back', icon: '⚓', desc: 'Slow down / reverse' },
  { id: 'left',    name: 'Steer Left', icon: '◀️', desc: 'Turn port (left)' },
  { id: 'right',   name: 'Steer Right', icon: '▶️', desc: 'Turn starboard (right)' },
  { id: 'brake',   name: 'Brake', icon: '🛑', desc: 'Scrub speed for tight turns' },
  { id: 'boost',   name: 'Speed Boost', icon: '🔥', desc: 'High-speed ramming surge' },
  { id: 'fire',    name: 'Fire Weapon', icon: '💥', desc: 'Twin cannons / missiles' },
  { id: 'gun',     name: 'Machine Gun', icon: '🔫', desc: 'Equip machine gun (1)' },
  { id: 'missile', name: 'Missiles', icon: '🚀', desc: 'Equip missiles (2)' },
  { id: 'fpv',     name: 'Cockpit View', icon: '🎛️', desc: 'Toggle first-person view' },
  { id: 'skin',    name: 'Switch Skin', icon: '🎨', desc: 'Cycle boat skins' },
  { id: 'home',    name: 'Sail Home', icon: '🏠', desc: 'Fast travel to harbor' },
  { id: 'mute',    name: 'Mute / Unmute', icon: '🔊', desc: 'Toggle game audio' },
  { id: 'help',    name: 'Controls Help', icon: '❓', desc: 'Toggle controls guide' },
];

export function formatKeyName(code) {
  if (!code) return 'None';
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
    fire: false,   // left mouse button or keybind is held
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
    if (gunSlot) gunSlot.addEventListener('pointerdown', (e) => { e.stopPropagation(); selectWeapon('gun'); });
    const missileSlot = document.getElementById('missile-slot');
    if (missileSlot) missileSlot.addEventListener('pointerdown', (e) => { e.stopPropagation(); selectWeapon('missile'); });
    const boostSlot = document.getElementById('boost-slot');
    if (boostSlot) boostSlot.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      for (const fn of boostListeners) fn(true);
    });
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
        e.preventDefault();
      } else if (action === 'missile') {
        selectWeapon('missile');
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
    }

    // Support direct legacy code listeners
    if (!e.repeat && pressHandlers[e.code]) {
      pressHandlers[e.code]();
      e.preventDefault();
    }
  });

  addEventListener('keyup', (e) => {
    const action = codeToAction[e.code];
    if (action) {
      if (action === 'forward' || action === 'back' || action === 'left' || action === 'right' || action === 'brake') {
        state[action] = false;
      } else if (action === 'fire') {
        state.fire = false;
      } else if (action === 'boost') {
        state.boost = false;
        for (const fn of boostListeners) fn(false);
      }
    }
  });

  // Left mouse button = fire
  addEventListener('pointerdown', (e) => {
    if (e.target && e.target.closest && e.target.closest('.ui-btn, #controls, #settings-modal, #settings-btn, #weapons, .slot, .keybind-badge-btn')) return;
    if (e.button === 0) state.fire = true;
  });
  const release = (e) => { if (e.button === 0) state.fire = false; };
  addEventListener('pointerup', release);
  addEventListener('pointercancel', () => { state.fire = false; });
  addEventListener('contextmenu', (e) => e.preventDefault());

  addEventListener('blur', () => {
    for (const k of ['forward', 'back', 'left', 'right', 'brake', 'fire', 'boost']) state[k] = false;
    for (const fn of boostListeners) fn(false);
  });

  return {
    state,
    selectWeapon,
    onPress: (code, fn) => { pressHandlers[code] = fn; },
    onAction: (action, fn) => { actionHandlers[action] = fn; },
    onWeapon: (fn) => weaponListeners.push(fn),
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
