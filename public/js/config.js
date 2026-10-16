// public/js/config.js
// Central facade re-exporting modular configuration domains.
// Splitting configs into dedicated sub-modules in ./config/ ensures that future changes
// (e.g. UI, keybinds, weapons, boat physics) are strictly isolated and cannot accidentally
// modify unrelated game balances or parameters.

export * from './config/world.js';
export * from './config/boat.js';
export * from './config/weapons.js';
export * from './config/player.js';
export * from './config/potions.js';
export * from './config/ai.js';
export * from './config/multiplayer.js';
