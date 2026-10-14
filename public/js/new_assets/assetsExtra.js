import * as THREE from 'three';
import { std, glow, add, box } from './kit.js';

// Extra land decorations for the map editor. Same contract as assets.js: makeXxx(def) -> THREE.Group,
// sitting on y = 0, scaled/rotated/positioned by makeAsset. Animated ones set group.userData.tick(t).
// Hooked up through EXTRA_MAKERS (type -> builder) and EXTRA_CATALOG (palette entries).

const rng = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const cyl = (p, rt, rb, h, color, x, y, z, seg = 10) => add(p, new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), std(color)), x, y, z);

// ---------------------------------------------------------------- windmill
export function makeWindmill() {
  const g = new THREE.Group();
  cyl(g, 1.3, 1.9, 4.2, 0xe8dcc0, 0, 2.1, 0, 10);                         // stone tower
  cyl(g, 1.95, 1.95, 0.25, 0x9a8f78, 0, 0.12, 0, 10);                     // plinth
  cyl(g, 1.4, 1.4, 0.14, 0xb56a3f, 0, 2.6, 0, 10);                        // timber band
  cyl(g, 0, 1.75, 1.7, 0xc2552d, 0, 5.05, 0, 10);                         // roof
  box(g, 0.7, 1.2, 0.2, 0x6b4426, 0, 0.7, 1.72);                          // door
  for (const [y, a] of [[3.1, 0.6], [3.1, -0.6], [1.9, Math.PI]]) {       // windows
    const w = box(g, 0.4, 0.5, 0.12, 0x8eeaff, Math.sin(a) * 1.5, y, Math.cos(a) * 1.5); w.rotation.y = a;
  }
  const blades = new THREE.Group(); add(g, blades, 0, 4.0, 1.75);
  add(blades, new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), std(0x4a3320)), 0, 0, 0.1);
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group(); arm.rotation.z = (i * Math.PI) / 2; blades.add(arm);
    box(arm, 0.14, 3.6, 0.1, 0x6b4426, 0, 1.9, 0);
    box(arm, 0.8, 2.3, 0.05, 0xf6efe0, 0.46, 2.3, 0.02);
    box(arm, 0.8, 0.08, 0.07, 0xc2552d, 0.46, 1.2, 0.02);
  }
  g.userData.tick = (t) => { blades.rotation.z = t * 0.9; };
  return g;
}

// ---------------------------------------------------------------- fountain
export function makeFountain() {
  const g = new THREE.Group(), stone = 0xd7d2c4, water = 0x5ad2f0;
  cyl(g, 2.7, 2.8, 0.55, stone, 0, 0.27, 0, 14);
  add(g, new THREE.Mesh(new THREE.TorusGeometry(2.65, 0.14, 6, 24), std(0xbfb9a8)), 0, 0.58, 0).rotation.x = Math.PI / 2;
  add(g, new THREE.Mesh(new THREE.CircleGeometry(2.5, 20), glow(water, 0.8)), 0, 0.5, 0).rotation.x = -Math.PI / 2;
  cyl(g, 0.5, 0.7, 1.4, stone, 0, 1.2, 0, 10);
  cyl(g, 1.35, 0.7, 0.45, stone, 0, 1.75, 0, 12);                         // upper bowl
  add(g, new THREE.Mesh(new THREE.CircleGeometry(1.2, 16), glow(water, 0.85)), 0, 1.98, 0).rotation.x = -Math.PI / 2;
  cyl(g, 0.22, 0.3, 1.0, stone, 0, 2.45, 0, 8);
  add(g, new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), std(0xffd45a)), 0, 3.05, 0);
  const drops = [];
  for (let i = 0; i < 14; i++) {
    const d = add(g, new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), glow(0xbff2ff, 0.9)), 0, 3, 0);
    drops.push({ d, a: (i / 14) * Math.PI * 2, ph: (i % 7) / 7 });
  }
  g.userData.tick = (t) => drops.forEach((o) => {
    const k = (t * 0.9 + o.ph) % 1, r = Math.sin(k * Math.PI) * 1.1 + k * 0.4;
    o.d.position.set(Math.cos(o.a) * r, 3.1 + Math.sin(k * Math.PI) * 0.9 - k * k * 1.1, Math.sin(o.a) * r);
  });
  return g;
}

// ------------------------------------------------------------ market stall
export function makeMarketStall() {
  const g = new THREE.Group(), wood = 0x8a5a33;
  box(g, 3.2, 0.9, 1.3, wood, 0, 0.45, 0.4);                              // counter
  box(g, 3.3, 0.1, 1.4, 0xb98150, 0, 0.95, 0.4);
  for (const x of [-1.55, 1.55]) { box(g, 0.14, 2.7, 0.14, wood, x, 1.35, 1.0); box(g, 0.14, 2.3, 0.14, wood, x, 1.15, -0.55); }
  for (let i = 0; i < 8; i++) {                                           // striped awning
    const s = box(g, 0.4, 0.07, 2.3, i % 2 ? 0xffffff : 0xff7a59, -1.4 + i * 0.4, 2.55, 0.25); s.rotation.x = 0.3;
  }
  box(g, 3.2, 0.25, 0.06, 0xff7a59, 0, 2.3, 1.38);
  const fruit = [0xe3213d, 0xff9f1c, 0x7bd63a, 0xffd54a];                 // crates of fruit on the counter
  [-1.0, 0, 1.0].forEach((x, c) => {
    box(g, 0.8, 0.28, 0.8, 0xb98150, x, 1.14, 0.45);
    for (let i = 0; i < 5; i++) add(g, new THREE.Mesh(new THREE.SphereGeometry(0.15, 7, 6), std(fruit[(c + i) % 4])), x + ((i % 3) - 1) * 0.2, 1.38, 0.45 + (i > 2 ? 0.2 : -0.1));
  });
  const lamp = add(g, new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), glow(0xffe08a)), 0.8, 2.15, 1.1);
  g.userData.tick = (t) => { lamp.position.x = 0.8 + Math.sin(t * 1.4) * 0.05; };
  return g;
}

// ------------------------------------------------------------- tiki torches
export function makeTikiTorches() {
  const g = new THREE.Group(), flames = [];
  [-2.2, 0, 2.2].forEach((x, i) => {
    cyl(g, 0.09, 0.12, 2.6, 0xb98150, x, 1.3, 0, 6);
    for (const y of [0.7, 1.4]) cyl(g, 0.13, 0.13, 0.12, 0x6b4426, x, y, 0, 6);
    cyl(g, 0.28, 0.16, 0.35, 0x6b4426, x, 2.7, 0, 8);
    const f = add(g, new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.75, 6), glow(0xff8a1f, 0.95)), x, 3.15, 0);
    add(g, new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.45, 6), glow(0xffe08a)), x, 3.05, 0);
    flames.push({ f, ph: i * 2 });
  });
  g.userData.tick = (t) => flames.forEach(({ f, ph }) => { f.scale.set(1 + Math.sin(t * 17 + ph) * 0.12, 1 + Math.sin(t * 23 + ph) * 0.18, 1); });
  return g;
}

// ------------------------------------------------------------ flower garden
export function makeFlowerGarden(def = {}) {
  const g = new THREE.Group(), r = rng(def.seed || 7), pal = [0xff5c8a, 0xffd54a, 0xffffff, 0xb48cff, 0xff8a3d];
  cyl(g, 2.5, 2.6, 0.3, 0x6b4a2e, 0, 0.15, 0, 16);
  for (let i = 0; i < 14; i++) {                                          // stone border
    const a = (i / 14) * Math.PI * 2, s = add(g, new THREE.Mesh(new THREE.DodecahedronGeometry(0.34, 0), std(0xb9b3a3)), Math.cos(a) * 2.6, 0.22, Math.sin(a) * 2.6);
    s.scale.y = 0.7;
  }
  for (let i = 0; i < 22; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 2.1, x = Math.cos(a) * d, z = Math.sin(a) * d, h = 0.5 + r() * 0.6, col = pal[Math.floor(r() * pal.length)];
    cyl(g, 0.03, 0.04, h, 0x3fcf6e, x, 0.3 + h / 2, z, 4);
    add(g, new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), std(0xffd54a)), x, 0.3 + h + 0.03, z);
    for (let p = 0; p < 5; p++) {
      const pa = (p / 5) * Math.PI * 2, pet = add(g, new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), std(col)), x + Math.cos(pa) * 0.14, 0.3 + h, z + Math.sin(pa) * 0.14);
      pet.scale.y = 0.6;
    }
  }
  for (let i = 0; i < 4; i++) { const a = r() * 6.28, b = add(g, new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 0), std(0x3fcf6e)), Math.cos(a) * 1.6, 0.5, Math.sin(a) * 1.6); b.scale.y = 0.8; }
  return g;
}

// ---------------------------------------------------------- crystal cluster
export function makeCrystalCluster(def = {}) {
  const g = new THREE.Group(), r = rng(def.seed || 3), cols = [0x9a86ff, 0x39e6ff, 0xc9a8ff], mats = [];
  for (let i = 0; i < 4; i++) { const a = (i / 4) * 6.28, rk = add(g, new THREE.Mesh(new THREE.DodecahedronGeometry(0.8, 0), std(0x6c6a86)), Math.cos(a) * 1.0, 0.3, Math.sin(a) * 1.0); rk.scale.y = 0.6; }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * 6.28 + r(), d = i ? 0.7 + r() * 0.9 : 0, h = i ? 1.4 + r() * 1.6 : 3.6, w = i ? 0.28 + r() * 0.2 : 0.5;
    const m = new THREE.MeshStandardMaterial({ color: cols[i % 3], emissive: cols[i % 3], emissiveIntensity: 0.55, flatShading: true, transparent: true, opacity: 0.92, roughness: 0.2 });
    const c = add(g, new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), m), Math.cos(a) * d, h * 0.5 + 0.2, Math.sin(a) * d);
    c.scale.set(w, h * 0.5, w); c.rotation.set((r() - 0.5) * 0.35, r() * 6, (r() - 0.5) * 0.35);
    mats.push(m);
  }
  g.userData.tick = (t) => mats.forEach((m, i) => { m.emissiveIntensity = 0.5 + Math.sin(t * 1.8 + i) * 0.25; });
  return g;
}

export const EXTRA_MAKERS = {
  windmill: makeWindmill, fountain: makeFountain, market_stall: makeMarketStall,
  tiki_torches: makeTikiTorches, flower_garden: makeFlowerGarden, crystal_cluster: makeCrystalCluster,
};

export const EXTRA_CATALOG = [
  {
    category: 'Land Decor',
    items: [
      { type: 'windmill', name: 'Island Windmill', icon: '🌬️', desc: 'Stone tower windmill with thatched roof and slowly turning sails', defaultProps: { scale: 1.0 } },
      { type: 'fountain', name: 'Plaza Fountain', icon: '⛲', desc: 'Two-tier stone fountain with animated water jets', defaultProps: { scale: 1.0 } },
      { type: 'market_stall', name: 'Market Stall', icon: '🍎', desc: 'Striped-awning stall with crates of fruit and a swaying lantern', defaultProps: { scale: 1.0 } },
      { type: 'tiki_torches', name: 'Tiki Torch Row', icon: '🔥', desc: 'Three bamboo torches with flickering flames', defaultProps: { scale: 1.0 } },
      { type: 'flower_garden', name: 'Flower Garden', icon: '🌸', desc: 'Round stone-bordered bed of colourful flowers and bushes', defaultProps: { scale: 1.0, seed: 7 } },
      { type: 'crystal_cluster', name: 'Glowing Crystals', icon: '💎', desc: 'Pulsing violet and cyan crystal spires on a rocky base', defaultProps: { scale: 1.0, seed: 3 } },
    ],
  },
];
