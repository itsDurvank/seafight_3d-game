// Keyboard + mouse input. Touch controls come in a later stage.
//
//   W A S D / arrows  sail
//   1 / 2             select machine gun / missile
//   left mouse button fire the selected weapon (hold for the machine gun)
//   Space             brake (slows you down and makes steering easier)
//   Shift             speed boost (handled through onPress)
export function createInput() {
  const state = {
    forward: false, back: false, left: false, right: false, brake: false,
    weapon: 'gun', // 'gun' | 'missile'
    fire: false, // left mouse button is held
  };
  const map = {
    KeyW: 'forward', ArrowUp: 'forward',
    KeyS: 'back', ArrowDown: 'back',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    Space: 'brake',
  };
  const weaponKeys = { Digit1: 'gun', Numpad1: 'gun', Digit2: 'missile', Numpad2: 'missile' };
  const pressHandlers = {};
  const weaponListeners = [];

  const selectWeapon = (w) => {
    if (state.weapon === w) return;
    state.weapon = w;
    for (const fn of weaponListeners) fn(w);
  };

  addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT') return;
    if (map[e.code]) {
      state[map[e.code]] = true;
      e.preventDefault();
    } else if (weaponKeys[e.code]) {
      selectWeapon(weaponKeys[e.code]);
      e.preventDefault();
    } else if (!e.repeat && pressHandlers[e.code]) {
      pressHandlers[e.code]();
      e.preventDefault();
    }
  });
  addEventListener('keyup', (e) => {
    if (map[e.code]) state[map[e.code]] = false;
  });

  // left mouse button = fire
  addEventListener('pointerdown', (e) => {
    if (e.target && e.target.closest && e.target.closest('.ui-btn, #controls, #settings-modal, #settings-btn')) return; // UI clicks are not shots
    if (e.button === 0) state.fire = true;
  });
  const release = (e) => { if (e.button === 0) state.fire = false; };
  addEventListener('pointerup', release);
  addEventListener('pointercancel', () => { state.fire = false; });
  addEventListener('contextmenu', (e) => e.preventDefault());

  addEventListener('blur', () => {
    for (const k of ['forward', 'back', 'left', 'right', 'brake', 'fire']) state[k] = false;
  });

  return {
    state,
    onPress: (code, fn) => { pressHandlers[code] = fn; },
    onWeapon: (fn) => weaponListeners.push(fn),
  };
}
