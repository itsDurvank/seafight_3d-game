// Replaces the islands in config.js with the ones saved by the map editor (public/maps/default.json).
// If the file is missing or invalid, the game just uses config.js as before.
import { WORLD } from './config.js';

try {
  const r = await fetch('/maps/default.json', { cache: 'no-store' });
  if (r.ok) {
    const m = await r.json();
    if (Array.isArray(m.islands) && m.islands.some((i) => i.home)) {
      WORLD.islands.splice(0, WORLD.islands.length, ...m.islands); // in place, so other modules keep their reference
    }
    if (Array.isArray(m.assets)) {
      if (!WORLD.assets) WORLD.assets = [];
      WORLD.assets.splice(0, WORLD.assets.length, ...m.assets);
    }
  }
} catch (e) {
  console.warn('Map file not loaded, using islands from config.js', e);
}
