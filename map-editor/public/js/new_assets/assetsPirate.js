import * as THREE from 'three';

// 20 pirate / battle-royale / treasure-hunt / destruction assets for the Island Resort map editor.
// Same contract as assets.js: makeXxx(def) -> THREE.Group sitting on y = 0 (makeAsset scales, rotates and positions it).
// Animated ones set group.userData.tick(t). Self-contained: only needs 'three'.
// Hook-up: PIRATE_MAKERS (type -> builder) and PIRATE_CATALOG (palette entries) at the bottom.
// Sea creatures / floating items (water:true in the catalog) are meant to sit at sea level (y = 0).

// ------------------------------------------------------------------ helpers (same low-poly flat look as assets.js)
const flat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, ...extra });
const add = (p, m, x = 0, y = 0, z = 0) => { m.position.set(x, y, z); p.add(m); return m; };
const box = (p, w, h, d, c, x, y, z) => add(p, new THREE.Mesh(new THREE.BoxGeometry(w, h, d), flat(c)), x, y, z);
const cyl = (p, rt, rb, h, c, x, y, z, seg = 10) => add(p, new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), flat(c)), x, y, z);
const ball = (p, r, c, x, y, z, extra = {}) => add(p, new THREE.Mesh(new THREE.SphereGeometry(r, 9, 7), flat(c, extra)), x, y, z);
const lit = (c, i = 1.5, extra = {}) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, ...extra });
const rng = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
function rod(p, a, b, r, c, seg = 5) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), d = vb.clone().sub(va), len = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), flat(c));
  m.position.copy(va).add(vb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  p.add(m); return m;
}
const canvasTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return new THREE.CanvasTexture(c); };
const textTex = (text, bg, fg, font = 'bold 40px Arial, sans-serif') => canvasTex(256, 96, (x, w, h) => {
  x.fillStyle = bg; x.fillRect(0, 0, w, h); x.strokeStyle = fg; x.lineWidth = 6; x.strokeRect(6, 6, w - 12, h - 12);
  x.fillStyle = fg; x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, w / 2, h / 2 + 2);
});
const skullArt = (x, cx, cy, s, col = '#f3efe2') => {
  x.fillStyle = col; x.beginPath(); x.arc(cx, cy - s * 0.1, s * 0.55, 0, 7); x.fill(); x.fillRect(cx - s * 0.32, cy + s * 0.2, s * 0.64, s * 0.4);
  x.fillStyle = '#111'; x.beginPath(); x.arc(cx - s * 0.2, cy - s * 0.1, s * 0.15, 0, 7); x.arc(cx + s * 0.2, cy - s * 0.1, s * 0.15, 0, 7); x.fill();
  x.beginPath(); x.moveTo(cx, cy + s * 0.05); x.lineTo(cx - s * 0.07, cy + s * 0.2); x.lineTo(cx + s * 0.07, cy + s * 0.2); x.fill();
  for (let i = -2; i <= 2; i++) x.fillRect(cx + i * s * 0.12 - 2, cy + s * 0.38, 3, s * 0.2);
};
const flames = (p, list) => list.map(([x, z, s, c], i) => { const f = add(p, new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.4, 6), lit(c, 1.6, { transparent: true, opacity: 0.9 })), x, 0.7 * s, z); f.scale.setScalar(s); return { f, s, ph: i * 1.7 }; });
const flick = (arr, t) => arr.forEach(({ f, s, ph }) => { const k = 1 + Math.sin(t * 9 + ph) * 0.18 + Math.sin(t * 15 + ph * 2) * 0.1; f.scale.set(s * (2 - k), s * k, s * (2 - k)); f.rotation.y = t * 2 + ph; });
const smokePuffs = (p, n, x, z, col = 0x444444) => Array.from({ length: n }, (_, i) => ({ m: add(p, new THREE.Mesh(new THREE.SphereGeometry(0.5, 7, 5), new THREE.MeshStandardMaterial({ color: col, transparent: true, opacity: 0.4, depthWrite: false })), x, 1, z), ph: i / n, x, z }));
const stepSmoke = (arr, t, y0, rise, spd = 0.3) => arr.forEach((s) => { const k = (t * spd + s.ph) % 1; s.m.position.set(s.x + Math.sin(t + s.ph * 6) * 0.4 * k, y0 + k * rise, s.z + 0.3 * k); s.m.scale.setScalar(0.6 + k * 1.8); s.m.material.opacity = 0.4 * (1 - k); });

const SAND = 0xe9d8a6, WOOD = 0x8a5a33, WOOD_D = 0x4a2f1a, WOOD_L = 0xb98355, STONE = 0x8d8a82, IRON = 0x2a2d34, GOLD = 0xe0a824, BONE = 0xf0ead6, RED = 0xb3202a, ROPE = 0xd9c7a0;

// ================================================================== 1. Jolly Roger flag pole
export function makeJollyRoger() {
  const g = new THREE.Group();
  cyl(g, 1.3, 1.6, 0.6, STONE, 0, 0.3, 0, 7); cyl(g, 0.9, 1.1, 0.4, 0x6f6c65, 0, 0.8, 0, 7);
  cyl(g, 0.14, 0.2, 8.6, WOOD_D, 0, 4.9, 0, 6); box(g, 3.2, 0.16, 0.16, WOOD_D, 0, 8.3, 0); ball(g, 0.24, GOLD, 0, 9.4, 0);
  for (let i = 0; i < 3; i++) { const sk = add(g, new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), flat(BONE)), Math.cos(i * 2.1) * 1.05, 1.15, Math.sin(i * 2.1) * 1.05); sk.scale.y = 0.85; ball(sk, 0.08, 0x111111, -0.1, 0.03, 0.24); ball(sk, 0.08, 0x111111, 0.1, 0.03, 0.24); }
  const tex = canvasTex(256, 170, (x, w, h) => {
    x.fillStyle = '#16161c'; x.fillRect(0, 0, w, h); x.strokeStyle = '#f3efe2'; x.lineWidth = 9; x.lineCap = 'round';
    x.beginPath(); x.moveTo(60, 125); x.lineTo(196, 45); x.moveTo(196, 125); x.lineTo(60, 45); x.stroke(); skullArt(x, w / 2, h / 2 - 2, 100);
  });
  const geo = new THREE.PlaneGeometry(3.2, 2.1, 2, 2); geo.translate(1.6, 0, 0);
  const flagMesh = add(g, new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.9 })), 0.14, 7.2, 0);
  const setPose = (t) => { segs.forEach((s, i) => { const k = Math.sin(s.x * 0.85 - t * 2.0), y = -0.8 + 2.0 * Math.max(0, k), z = Math.sin(s.x * 0.3 + t * 0.6) * 0.5; s.m.position.set(s.x, y, z); s.fin.position.set(s.x, y + s.rad + 0.25, z); s.fin.visible = y > -0.1 && i % 2 === 0; }); const h = segs[N - 1]; head.position.set(h.x + 0.9, h.m.position.y + 0.4, h.m.position.z); head.rotation.z = 0.2 + Math.cos((h.x) * 0.85 - t * 2.0) * 0.25; }; setPose(0);
  return g;
}

// ------------------------------------------------------------------ registry
export const PIRATE_MAKERS = {
  jolly_roger: makeJollyRoger, skull_cave: makeSkullCave, dig_spot: makeDigSpot, gold_hoard: makeGoldHoard, golden_idol: makeGoldenIdol,
  cannonball_stack: makeCannonballStack, powder_magazine: makePowderMagazine, crows_nest_mast: makeCrowsNestMast, harbor_crane: makeHarborCrane,
  tnt_crates: makeTntCrates, spike_barricade: makeSpikeBarricade, palisade_gate: makePalisadeGate, pirate_shack: makePirateShack,
  burning_wreck: makeBurningWreck, floating_wreckage: makeFloatingWreckage, supply_drop: makeSupplyDrop, loot_beacon: makeLootBeacon,
  zone_marker: makeZoneMarker, kraken_tentacles: makeKrakenTentacles, sea_serpent: makeSeaSerpent,
};

export const PIRATE_CATALOG = [
  {
    category: 'Pirate Treasure Hunt',
    items: [
      { type: 'jolly_roger', name: 'Jolly Roger Pole', icon: '🏴‍☠️', desc: 'Stone-based mast flying a waving skull-and-crossbones flag, guarded by skulls', defaultProps: { scale: 1.0 } },
      { type: 'skull_cave', name: 'Skull Cave', icon: '💀', desc: 'Giant skull-shaped rock with a cave mouth and flickering green eyes', defaultProps: { scale: 1.0 } },
      { type: 'dig_spot', name: 'X Marks the Spot', icon: '❌', desc: 'Red X in the sand, shovel, dirt mound, treasure map and a hole glinting with gold', defaultProps: { scale: 1.0 } },
      { type: 'gold_hoard', name: 'Gold Hoard', icon: '🪙', desc: 'Heap of gold coins, gems, goblets and bars on a stone slab', defaultProps: { scale: 1.0, seed: 4 } },
      { type: 'golden_idol', name: 'Golden Idol Shrine', icon: '🗿', desc: 'Stepped stone shrine with four torches and a glowing, spinning golden idol', defaultProps: { scale: 1.0 } },
    ],
  },
  {
    category: 'Pirate Warfare & Destruction',
    items: [
      { type: 'cannonball_stack', name: 'Cannonball Pyramid', icon: '⚫', desc: 'Neat pyramid of iron cannonballs in a wooden frame with a ramrod', defaultProps: { scale: 1.0 } },
      { type: 'powder_magazine', name: 'Powder Magazine', icon: '🧨', desc: 'Domed stone bunker with iron door, DANGER sign, sandbags and powder kegs', defaultProps: { scale: 1.0 } },
      { type: 'tnt_crates', name: 'TNT Crates', icon: '💥', desc: 'Stacked TNT crates, dynamite bundle, sparking fuse and a plunger detonator', defaultProps: { scale: 1.0 } },
      { type: 'spike_barricade', name: 'Spike Barricade', icon: '🛡️', desc: 'Wooden hedgehogs, sharpened stakes, barbed rope and sandbags', defaultProps: { scale: 1.0 } },
      { type: 'palisade_gate', name: 'Palisade Gate', icon: '🚪', desc: 'Log wall with a double iron-banded gate, skull-topped towers and torches', defaultProps: { scale: 1.0 } },
      { type: 'burning_wreck', name: 'Burning Wreck', icon: '🔥', desc: 'Smashed ship hull with torn sail, roaring flames, smoke and flying embers', defaultProps: { scale: 1.0 } },
    ],
  },
  {
    category: 'Pirate Settlement',
    items: [
      { type: 'pirate_shack', name: 'Pirate Shack', icon: '🏚️', desc: 'Ramshackle stilt tavern with a Grog & Gold sign, lantern and rum barrels', defaultProps: { scale: 1.0 } },
      { type: 'crows_nest_mast', name: "Crow's Nest Mast", icon: '🔭', desc: 'Tall mast with rope ratlines, a barrel lookout and a skull pennant', defaultProps: { scale: 1.0 } },
      { type: 'harbor_crane', name: 'Harbor Crane', icon: '🏗️', desc: 'Wooden cargo crane swinging a crate on a rope', defaultProps: { scale: 1.0 } },
    ],
  },
  {
    category: 'Battle Royale Events',
    items: [
      { type: 'supply_drop', name: 'Supply Air Drop', icon: '🪂', desc: 'Parachuted loot crate with a red signal flare and golden light column', defaultProps: { scale: 1.0 } },
      { type: 'loot_beacon', name: 'Loot Beacon', icon: '✨', desc: 'Pedestal with a spinning golden gem, rings, sparks and a tall light beam', defaultProps: { scale: 1.0 } },
      { type: 'zone_marker', name: 'Storm Zone Marker', icon: '⚠️', desc: 'Ring of hazard pylons with spinning red rings and a pulsing danger wall', defaultProps: { scale: 1.0 } },
    ],
  },
  {
    category: 'Sea Hazards',
    items: [
      { type: 'floating_wreckage', name: 'Floating Wreckage', icon: '🪵', desc: 'Bobbing planks, barrel, mast piece, ring buoy and crate with foam rings', defaultProps: { scale: 1.0, seed: 15 }, water: true },
      { type: 'kraken_tentacles', name: 'Kraken', icon: '🐙', desc: 'Giant purple kraken head with six writhing suckered tentacles', defaultProps: { scale: 1.0 }, water: true },
      { type: 'sea_serpent', name: 'Sea Serpent', icon: '🐉', desc: 'Long finned serpent weaving in and out of the waves', defaultProps: { scale: 1.0 }, water: true },
    ],
  },
];
