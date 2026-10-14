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
  const geo = new THREE.PlaneGeometry(3.2, 2.1, 14, 6); geo.translate(1.6, 0, 0);
  add(g, new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.9 })), 0.14, 7.2, 0);
  const pos = geo.attributes.position, ox = Array.from(pos.array);
  g.userData.tick = (t) => { for (let i = 0; i < pos.count; i++) { const x = ox[i * 3]; pos.setZ(i, Math.sin(x * 2.2 - t * 4.2) * 0.2 * (x / 3.2)); } pos.needsUpdate = true; };
  return g;
}

// ================================================================== 2. skull cave
export function makeSkullCave() {
  const g = new THREE.Group(), rock = 0xbdb5a0, rock2 = 0xa59d88;
  for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28 + 0.4; add(g, new THREE.Mesh(new THREE.DodecahedronGeometry(1.1 + (i % 3) * 0.3, 0), flat(rock2)), Math.cos(a) * 3.8, 0.7, Math.sin(a) * 3.1 - 0.5); }
  const cr = add(g, new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), flat(rock)), 0, 3.3, -0.2); cr.scale.set(3.5, 2.7, 3.0);
  box(g, 4.2, 1.1, 2.6, rock, 0, 0.55, 0.2);
  const jaw = box(g, 3.4, 0.9, 2.2, rock2, 0, 0.5, 0.6);
  for (let i = -3; i <= 3; i++) box(g, 0.34, 0.65, 0.3, BONE, i * 0.52, 1.25, 1.62 - Math.abs(i) * 0.04);
  box(g, 2.0, 1.0, 0.3, 0x1a1512, 0, 0.55, 1.75);
  for (const s of [-1, 1]) { const so = add(g, new THREE.Mesh(new THREE.SphereGeometry(0.85, 9, 7), flat(0x15110e)), s * 1.25, 3.5, 1.9); so.scale.set(1, 1.1, 0.6); }
  const eyes = [-1, 1].map((s) => add(g, new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6), lit(0x7dff6a, 1.8)), s * 1.25, 3.5, 2.2));
  add(g, new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.85, 3), flat(0x15110e)), 0, 2.6, 2.2).rotation.x = Math.PI;
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) box(g, 0.2, 0.5 + k * 0.1, 0.2, rock2, s * (0.5 + k * 0.5), 5.8 - k * 0.15, 0.2);
  g.userData.tick = (t) => eyes.forEach((e, i) => { e.material.emissiveIntensity = 1.6 + Math.sin(t * 3 + i * 2) * 0.5 + Math.sin(t * 11) * 0.15; });
  return g;
}

// ================================================================== 3. X marks the spot dig site
export function makeDigSpot() {
  const g = new THREE.Group();
  cyl(g, 3.6, 3.8, 0.2, SAND, 0, 0.1, 0, 12);
  for (const a of [Math.PI / 4, -Math.PI / 4]) { const b = box(g, 3.6, 0.06, 0.45, RED, -0.8, 0.23, 0.6); b.rotation.y = a; }
  cyl(g, 1.0, 1.2, 0.22, 0x2b1d12, 1.9, 0.2, -0.4, 10);
  const loot = [0, 1, 2, 3].map((i) => add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 10), lit(GOLD, 0.6, { metalness: 0.6 })), 1.75 + i * 0.15 - 0.2, 0.34 + i * 0.01, -0.4 + (i % 2) * 0.2));
  add(g, new THREE.Mesh(new THREE.ConeGeometry(1.4, 1.1, 8), flat(0x6b4a2b)), 3.2, 0.6, -1.4);
  rod(g, [-2.3, 0.1, -1.4], [-2.0, 2.6, -1.1], 0.07, WOOD); box(g, 0.45, 0.65, 0.07, 0x9aa0a8, -2.4, 0.4, -1.55).rotation.z = 0.2;
  box(g, 0.4, 0.08, 0.1, WOOD, -1.95, 2.6, -1.1);
  const map = canvasTex(128, 96, (x, w, h) => {
    x.fillStyle = '#e6d3a3'; x.fillRect(0, 0, w, h); x.strokeStyle = '#8a5a33'; x.lineWidth = 3; x.strokeRect(2, 2, w - 4, h - 4);
    x.setLineDash([6, 5]); x.beginPath(); x.moveTo(15, 75); x.quadraticCurveTo(50, 20, 85, 60); x.lineTo(105, 30); x.stroke();
    x.setLineDash([]); x.strokeStyle = '#b3202a'; x.lineWidth = 6; x.beginPath(); x.moveTo(98, 24); x.lineTo(112, 38); x.moveTo(112, 24); x.lineTo(98, 38); x.stroke();
  });
  const mp = add(g, new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.1), new THREE.MeshStandardMaterial({ map: map, roughness: 1 })), 1.2, 0.24, 1.8); mp.rotation.x = -Math.PI / 2; mp.rotation.z = 0.4;
  g.userData.tick = (t) => loot.forEach((c, i) => { c.material.emissiveIntensity = 0.5 + Math.sin(t * 4 + i) * 0.4; });
  return g;
}

// ================================================================== 4. gold hoard
export function makeGoldHoard(def = {}) {
  const g = new THREE.Group(), r = rng(def.seed || 4), gold = () => flat(GOLD, { metalness: 0.85, roughness: 0.3, emissive: 0x3a2800, emissiveIntensity: 0.35 });
  cyl(g, 3.0, 3.3, 0.2, 0x6f6c65, 0, 0.1, 0, 10);
  add(g, new THREE.Mesh(new THREE.ConeGeometry(2.7, 1.9, 9), gold()), 0, 1.1, 0);
  for (let i = 0; i < 46; i++) { const a = r() * 6.28, d = r() * 2.5, h = Math.max(0.15, 1.8 * (1 - d / 2.7)); const c = add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.07, 10), gold()), Math.cos(a) * d, h + 0.1 + r() * 0.1, Math.sin(a) * d); c.rotation.set(r() * 1.2, r() * 3, r() * 1.2); }
  const gems = [[-0.6, 1.55, 0.6, 0xe0243a], [0.9, 1.1, 1.2, 0x2e86ff], [0.3, 1.9, -0.5, 0x2ee06f], [-1.5, 0.8, -0.7, 0xb15cff], [1.6, 0.8, -0.6, 0xe0243a]].map(([x, y, z, c]) => add(g, new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), lit(c, 0.9, { flatShading: true })), x, y, z));
  for (const [x, z] of [[-2.0, 1.4], [2.1, 1.2]]) { cyl(g, 0.22, 0.14, 0.45, GOLD, x, 0.45, z, 8); cyl(g, 0.08, 0.08, 0.3, GOLD, x, 0.18, z, 6); }
  for (let i = 0; i < 6; i++) box(g, 0.9, 0.28, 0.45, GOLD, -2.3 + (i % 3) * 0.95 + (i > 2 ? 0.45 : 0), 0.3 + Math.floor(i / 3) * 0.28, -1.8);
  add(g, new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 6, 14), flat(BONE, { roughness: 0.3 })), 1.2, 0.2, 1.9).rotation.x = Math.PI / 2;
  g.userData.tick = (t) => gems.forEach((m, i) => { m.rotation.y = t * 1.5 + i; m.material.emissiveIntensity = 0.7 + Math.sin(t * 3 + i * 1.3) * 0.4; });
  return g;
}

// ================================================================== 5. golden idol shrine
export function makeGoldenIdol() {
  const g = new THREE.Group(), gold = () => flat(GOLD, { metalness: 0.85, roughness: 0.3, emissive: 0x4a3200, emissiveIntensity: 0.45 });
  box(g, 4.2, 0.4, 4.2, STONE, 0, 0.2, 0); box(g, 3.2, 0.4, 3.2, 0x7b7870, 0, 0.6, 0); box(g, 2.2, 0.9, 2.2, 0x6f6c65, 0, 1.25, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { cyl(g, 0.16, 0.2, 2.3, 0x6f6c65, sx * 1.9, 1.15, sz * 1.9, 6); const fl = add(g, new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 6), lit(0xff8a1f, 1.7)), sx * 1.9, 2.55, sz * 1.9); fl.userData.fl = true; }
  const idol = new THREE.Group(); add(g, idol, 0, 1.7, 0);
  cyl(idol, 0.6, 0.8, 1.2, 0, 0, 0.6, 0, 8).material = gold();
  add(idol, new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 0), gold()), 0, 1.6, 0);
  add(idol, new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.2), flat(0x15110e)), 0, 1.65, 0.5);
  for (const s of [-1, 1]) { ball(idol, 0.1, 0xff2a2a, s * 0.2, 1.7, 0.58, { emissive: 0xff0000, emissiveIntensity: 1 }); box(idol, 0.22, 0.9, 0.22, 0, s * 0.85, 0.7, 0).material = gold(); add(idol, new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.6, 4), gold()), s * 0.3, 2.35, 0); }
  const aura = add(g, new THREE.Mesh(new THREE.SphereGeometry(1.7, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffd45a, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending })), 0, 3.0, 0);
  const torches = g.children.filter((c) => c.userData.fl);
  g.userData.tick = (t) => { idol.rotation.y = t * 0.7; idol.position.y = 1.7 + Math.sin(t * 1.5) * 0.1; aura.scale.setScalar(1 + Math.sin(t * 2.2) * 0.1); aura.material.opacity = 0.15 + Math.sin(t * 2.2) * 0.05; torches.forEach((f, i) => { f.scale.set(1, 1 + Math.sin(t * 10 + i * 2) * 0.2, 1); }); };
  return g;
}

// ================================================================== 6. cannonball pyramid
export function makeCannonballStack() {
  const g = new THREE.Group(), R = 0.32;
  box(g, 3.2, 0.2, 3.2, WOOD, 0, 0.1, 0);
  for (const s of [-1, 1]) { box(g, 0.2, 0.5, 3.2, WOOD_D, s * 1.5, 0.35, 0); box(g, 3.2, 0.5, 0.2, WOOD_D, 0, 0.35, s * 1.5); }
  for (let layer = 0; layer < 4; layer++) { const n = 4 - layer, off = ((n - 1) * 0.66) / 2; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) ball(g, R, layer % 2 ? 0x2a2d34 : 0x34383f, -off + i * 0.66, 0.2 + R + layer * 0.5, -off + j * 0.66, { metalness: 0.5, roughness: 0.4 }); }
  ball(g, R, 0x2a2d34, 2.5, 0.32, 1.0); ball(g, R, 0x2a2d34, 2.9, 0.32, 0.4); ball(g, R, 0x2a2d34, 2.3, 0.32, 0.3);
  rod(g, [-2.8, 0.15, 1.8], [2.2, 0.15, 2.2], 0.07, WOOD); ball(g, 0.16, 0xd9c7a0, 2.25, 0.15, 2.2);
  return g;
}

// ================================================================== 7. powder magazine bunker
export function makePowderMagazine() {
  const g = new THREE.Group();
  box(g, 5.0, 2.2, 4.4, STONE, 0, 1.1, 0);
  const geo = new THREE.CylinderGeometry(2.5, 2.5, 4.4, 18, 1, false, 0, Math.PI); geo.rotateZ(Math.PI / 2);
  const dome = add(g, new THREE.Mesh(geo, flat(0x7b7870, { side: THREE.DoubleSide })), 0, 2.2, 0); dome.rotation.y = Math.PI / 2; dome.scale.set(1, 0.5, 1);
  box(g, 1.6, 1.7, 0.2, 0x3a2a1a, 0, 0.95, 2.25); for (const y of [0.5, 1.4]) box(g, 1.7, 0.14, 0.24, IRON, 0, y, 2.27); ball(g, 0.1, GOLD, 0.5, 0.95, 2.4);
  add(g, new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.6), new THREE.MeshStandardMaterial({ map: textTex('DANGER', '#b3202a', '#ffffff', 'bold 44px Arial'), roughness: 0.8 })), 0, 2.3, 2.27);
  cyl(g, 0.25, 0.3, 0.9, IRON, -1.7, 3.1, -0.8, 8);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * 3.14 - 1.57; add(g, new THREE.Mesh(new THREE.SphereGeometry(0.42, 7, 5), flat(0xc9b57f)), Math.sin(a) * 2.4, 0.3, 3.0 + Math.cos(a) * 0.5).scale.set(1.3, 0.7, 0.9); }
  for (const [x, z] of [[3.3, 1.0], [3.6, 2.0], [3.2, 2.7]]) { cyl(g, 0.5, 0.5, 0.95, RED, x, 0.5, z, 10); for (const y of [0.25, 0.75]) cyl(g, 0.52, 0.52, 0.08, IRON, x, y, z, 10); }
  return g;
}

// ================================================================== 8. crow's nest mast
export function makeCrowsNestMast() {
  const g = new THREE.Group();
  box(g, 3.6, 0.35, 3.6, WOOD, 0, 0.18, 0); cyl(g, 0.3, 0.42, 9.6, WOOD_D, 0, 5.0, 0, 8);
  for (const a of [0.4, 2.5, 4.6]) { const x = Math.cos(a), z = Math.sin(a); rod(g, [x * 1.5, 0.3, z * 1.5], [x * 0.5, 7.2, z * 0.5], 0.04, ROPE); for (let k = 1; k < 8; k++) { const f = k / 8.5; rod(g, [x * (1.5 - f), 0.3 + f * 6.9, z * (1.5 - f) - 0.25], [x * (1.5 - f), 0.3 + f * 6.9, z * (1.5 - f) + 0.25], 0.025, ROPE, 4); } }
  const nest = add(g, new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.0, 1.2, 12, 1, true), flat(WOOD, { side: THREE.DoubleSide })), 0, 7.8, 0);
  cyl(g, 1.0, 1.0, 0.14, WOOD_D, 0, 7.2, 0, 12); add(g, new THREE.Mesh(new THREE.TorusGeometry(1.32, 0.09, 5, 14), flat(WOOD_D)), 0, 8.4, 0).rotation.x = Math.PI / 2;
  for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28; box(g, 0.07, 1.2, 0.05, IRON, Math.cos(a) * 1.18, 7.8, Math.sin(a) * 1.18).rotation.y = -a; }
  rod(g, [0, 9.6, 0], [0, 11.0, 0], 0.05, WOOD_D); const fl = add(g, new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.9), new THREE.MeshStandardMaterial({ map: canvasTex(64, 40, (x, w, h) => { x.fillStyle = '#16161c'; x.fillRect(0, 0, w, h); skullArt(x, w / 2, h / 2, 34); }), side: THREE.DoubleSide })), 0.78, 10.5, 0);
  const lamp = add(g, new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), lit(0xffc860, 1.6)), 1.1, 6.6, 0); rod(g, [1.1, 7.2, 0], [1.1, 6.8, 0], 0.02, IRON);
  g.userData.tick = (t) => { fl.rotation.y = Math.sin(t * 3) * 0.3; lamp.material.emissiveIntensity = 1.5 + Math.sin(t * 8) * 0.3; };
  return g;
}

// ================================================================== 9. harbor crane
export function makeHarborCrane() {
  const g = new THREE.Group();
  box(g, 4.4, 0.5, 4.4, STONE, 0, 0.25, 0);
  for (const s of [-1, 1]) { rod(g, [s * 1.4, 0.4, 1.1], [s * 0.4, 5.6, 0], 0.17, WOOD_D, 6); rod(g, [s * 1.4, 0.4, -1.1], [s * 0.4, 5.6, 0], 0.17, WOOD_D, 6); }
  rod(g, [-1.3, 1.6, 0.8], [1.3, 1.6, 0.8], 0.09, WOOD); rod(g, [-1.1, 3.0, 0.5], [1.1, 3.0, 0.5], 0.09, WOOD);
  const arm = new THREE.Group(); add(g, arm, 0, 5.6, 0); arm.rotation.y = 0.5;
  rod(arm, [-1.5, -0.3, 0], [6.5, 0.9, 0], 0.2, WOOD, 6); rod(arm, [0, 0, 0], [3.2, 2.3, 0], 0.09, WOOD_D); rod(arm, [3.2, 2.3, 0], [6.5, 0.9, 0], 0.09, WOOD_D);
  cyl(arm, 0.4, 0.4, 0.3, IRON, 6.5, 0.7, 0, 10).rotation.x = Math.PI / 2; ball(arm, 0.4, GOLD, -1.7, -0.3, 0);
  const load = new THREE.Group(); add(arm, load, 6.5, 0.4, 0);
  rod(load, [0, 0, 0], [0, -2.6, 0], 0.04, ROPE); const hook = add(load, new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 5, 10, 4.7), flat(IRON)), 0, -2.7, 0);
  box(load, 1.3, 1.0, 1.3, WOOD_L, 0, -3.35, 0); for (const y of [-3.05, -3.65]) box(load, 1.34, 0.1, 1.34, IRON, 0, y, 0);
  rod(load, [-0.5, -2.8, 0], [-0.5, -2.85, 0], 0.02, IRON);
  g.userData.tick = (t) => { load.rotation.z = Math.sin(t * 1.2) * 0.1; load.rotation.x = Math.sin(t * 0.9) * 0.06; arm.rotation.y = 0.5 + Math.sin(t * 0.25) * 0.3; };
  return g;
}

// ================================================================== 10. TNT crates
export function makeTntCrates() {
  const g = new THREE.Group();
  const lab = new THREE.MeshStandardMaterial({ map: textTex('TNT', '#c0392b', '#fff6e6', 'bold 56px Arial'), roughness: 0.8 });
  const crate = (x, y, z, ry) => { const c = new THREE.Group(); add(g, c, x, y, z); c.rotation.y = ry; box(c, 1.6, 1.3, 1.6, WOOD_L, 0, 0.65, 0); for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(c, 0.14, 1.34, 0.14, WOOD_D, sx * 0.75, 0.65, sz * 0.75); for (const s of [-1, 1]) add(c, new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.5), lab), 0, 0.65, s * 0.81).rotation.y = s > 0 ? 0 : Math.PI; return c; };
  crate(0, 0, 0, 0.1); crate(1.9, 0, 0.3, -0.25); crate(0.8, 1.3, 0.1, 0.4);
  const bundle = new THREE.Group(); add(g, bundle, -2.2, 0.3, 1.2);
  for (let i = 0; i < 7; i++) { const a = (i / 7) * 6.28, d = i ? 0.17 : 0; const s = cyl(bundle, 0.1, 0.1, 1.1, RED, Math.cos(a) * d, 0.2, Math.sin(a) * d, 8); s.rotation.z = Math.PI / 2; s.rotation.y = 0.3; }
  rod(bundle, [0.55, 0.2, 0], [1.4, 0.15, 0.6], 0.015, 0x6b5a3a);
  const spark = add(g, new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), lit(0xffb02e, 2.2)), -0.8, 0.5, 1.8);
  rod(g, [-1.6, 0.5, 1.8], [-0.8, 0.5, 1.8], 0.015, 0x6b5a3a);
  box(g, 0.9, 0.6, 0.9, WOOD_D, 3.4, 0.3, 1.8); cyl(g, 0.06, 0.06, 0.8, IRON, 3.4, 0.95, 1.8, 6); box(g, 0.7, 0.1, 0.1, IRON, 3.4, 1.35, 1.8);
  rod(g, [3.4, 0.4, 1.4], [2.4, 0.15, 0.8], 0.02, 0x2a2d34); rod(g, [2.4, 0.15, 0.8], [1.6, 0.8, 0.4], 0.02, 0x2a2d34);
  g.userData.tick = (t) => { spark.material.emissiveIntensity = 1.8 + Math.sin(t * 30) * 0.8; spark.scale.setScalar(0.8 + Math.sin(t * 22) * 0.35); };
  return g;
}

// ================================================================== 11. spiked barricade
export function makeSpikeBarricade() {
  const g = new THREE.Group();
  const hedgehog = (x, z, ry, s = 1) => {
    const h = new THREE.Group(); add(g, h, x, 1.0 * s, z); h.rotation.y = ry; h.scale.setScalar(s);
    for (const [ax, ay, az] of [[1.2, 0.9, 0.45], [-0.5, 0.9, 1.0], [0.6, 0.9, -1.0]]) {
      rod(h, [-ax, -ay, -az], [ax, ay, az], 0.13, WOOD, 6);
      for (const k of [-1, 1]) { const tip = add(h, new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.55, 6), flat(WOOD_L)), ax * k * 1.12, ay * k * 1.12, az * k * 1.12); tip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(ax * k, ay * k, az * k).normalize()); }
    }
    return h;
  };
  hedgehog(-2.4, 0, 0.3); hedgehog(0, 0.3, 1.1); hedgehog(2.4, -0.1, 2.1);
  for (let i = 0; i < 7; i++) { const x = -3.2 + i * 1.05; const st = rod(g, [x, 0, -2.2], [x + 0.2, 1.9 + (i % 2) * 0.3, -2.0], 0.1, WOOD_D, 5); add(g, new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.45, 5), flat(WOOD_L)), x + 0.2, 2.15 + (i % 2) * 0.3, -2.0); }
  rod(g, [-3.2, 1.0, -2.1], [3.2, 1.2, -2.1], 0.04, ROPE); for (let i = 0; i < 8; i++) box(g, 0.05, 0.3, 0.05, IRON, -3.0 + i * 0.85, 1.1, -2.1).rotation.z = 0.7;
  for (let i = 0; i < 4; i++) add(g, new THREE.Mesh(new THREE.SphereGeometry(0.45, 7, 5), flat(0xc9b57f)), -1.5 + i * 0.95, 0.3, 1.8).scale.set(1.3, 0.7, 0.9);
  return g;
}

// ================================================================== 12. log palisade with gate
export function makePalisadeGate() {
  const g = new THREE.Group(), r = rng(12);
  for (const s of [-1, 1]) for (let i = 0; i < 6; i++) { const x = s * (2.6 + i * 0.62), h = 3.3 + r() * 0.7; cyl(g, 0.3, 0.33, h, i % 2 ? WOOD : WOOD_L, x, h / 2, 0, 7); add(g, new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 7), flat(WOOD_L)), x, h + 0.3, 0); }
  for (const s of [-1, 1]) for (const y of [1.0, 2.3]) box(g, 3.5, 0.12, 0.1, ROPE, s * 4.15, y, 0.34);
  for (const s of [-1, 1]) { cyl(g, 0.5, 0.58, 6.0, WOOD_D, s * 1.9, 3.0, 0, 8); box(g, 1.1, 0.9, 1.1, WOOD, s * 1.9, 6.4, 0); add(g, new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), flat(BONE)), s * 1.9, 7.2, 0); const fl = add(g, new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.7, 6), lit(0xff8a1f, 1.7)), s * 1.9, 5.2, 0.7); fl.userData.fl = true; rod(g, [s * 1.9, 4.6, 0.5], [s * 1.9, 5.0, 0.7], 0.05, IRON); }
  box(g, 4.3, 0.7, 0.9, WOOD_D, 0, 5.7, 0);
  for (const s of [-1, 1]) { const d = new THREE.Group(); add(g, d, s * 1.6, 0, 0.1); for (let i = 0; i < 4; i++) box(d, 0.42, 4.2, 0.18, i % 2 ? WOOD : WOOD_L, -s * (0.2 + i * 0.4), 2.1, 0); for (const y of [0.8, 2.0, 3.3]) box(d, 1.7, 0.16, 0.22, IRON, -s * 0.8, y, 0); d.rotation.y = s * 0.12; }
  add(g, new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.9), new THREE.MeshStandardMaterial({ map: textTex('KEEP OUT', '#16161c', '#f3efe2', 'bold 40px Arial'), roughness: 0.9 })), 0, 5.7, 0.47);
  const torches = g.children.filter((c) => c.userData.fl);
  g.userData.tick = (t) => torches.forEach((f, i) => { f.scale.set(1, 1 + Math.sin(t * 10 + i * 3) * 0.22, 1); });
  return g;
}

// ================================================================== 13. pirate shack
export function makePirateShack() {
  const g = new THREE.Group();
  for (const [x, z] of [[-2.2, -1.8], [2.2, -1.8], [-2.2, 1.8], [2.2, 1.8]]) cyl(g, 0.16, 0.2, 1.0, WOOD_D, x, 0.5, z, 6);
  box(g, 5.2, 0.2, 4.4, WOOD, 0, 1.05, 0);
  for (let i = 0; i < 9; i++) box(g, 0.5, 2.4, 0.14, i % 3 ? WOOD_L : WOOD, -2.0 + i * 0.5, 2.3, 1.95 + (i % 2) * 0.04);
  for (let i = 0; i < 9; i++) box(g, 0.5, 2.4, 0.14, i % 2 ? WOOD : WOOD_L, -2.0 + i * 0.5, 2.3, -1.95);
  for (const s of [-1, 1]) for (let i = 0; i < 8; i++) box(g, 0.14, 2.4, 0.5, i % 2 ? WOOD_L : WOOD, s * 2.45, 2.3, -1.75 + i * 0.5);
  for (const s of [-1, 1]) { const r = box(g, 3.6, 0.14, 5.2, s > 0 ? 0x6b4a2b : 0x7a5632, s * 1.5, 4.0, 0); r.rotation.z = -s * 0.5; }
  box(g, 0.25, 0.25, 5.2, WOOD_D, 0, 4.6, 0); cyl(g, 0.3, 0.34, 1.6, STONE, 1.5, 4.9, -1.2, 6);
  box(g, 1.1, 1.8, 0.16, WOOD_D, -0.9, 2.0, 2.05); ball(g, 0.07, GOLD, -0.6, 2.0, 2.15);
  box(g, 1.0, 0.9, 0.12, 0x1a1512, 1.4, 2.5, 2.05); box(g, 0.5, 0.9, 0.1, WOOD, 1.95, 2.5, 2.2).rotation.y = 0.5;
  add(g, new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.8), new THREE.MeshStandardMaterial({ map: canvasTex(256, 90, (x, w, h) => { x.fillStyle = '#3a2a1a'; x.fillRect(0, 0, w, h); x.fillStyle = '#e0a824'; x.font = 'bold 34px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('GROG & GOLD', w / 2 + 14, h / 2); skullArt(x, 32, h / 2, 56); }), roughness: 0.9 })), 0.1, 3.6, 2.12);
  for (const [x, z] of [[3.5, 1.0], [3.9, 1.8]]) { cyl(g, 0.45, 0.45, 0.9, WOOD_L, x, 0.45, z, 10); for (const y of [0.2, 0.7]) cyl(g, 0.47, 0.47, 0.07, IRON, x, y, z, 10); }
  const lamp = add(g, new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), lit(0xffc860, 1.6)), -1.6, 2.9, 2.5); rod(g, [-1.6, 3.5, 2.5], [-1.6, 3.1, 2.5], 0.02, IRON); rod(g, [-2.4, 3.55, 2.2], [-1.6, 3.5, 2.5], 0.03, WOOD_D);
  g.userData.tick = (t) => { lamp.material.emissiveIntensity = 1.4 + Math.sin(t * 7) * 0.3; lamp.position.x = -1.6 + Math.sin(t * 1.5) * 0.06; };
  return g;
}

// ================================================================== 14. burning wreck
export function makeBurningWreck() {
  const g = new THREE.Group();
  box(g, 7.0, 0.4, 1.3, WOOD_D, 0, 0.4, 0);
  for (let i = 0; i < 6; i++) { const x = -2.8 + i * 1.1; for (const s of [-1, 1]) rod(g, [x, 0.4, s * 0.55], [x + 0.1 * s, 1.6 + (i % 3) * 0.5, s * 1.7], 0.11, WOOD, 5); }
  const r = rng(14);
  for (const s of [-1, 1]) for (let i = 0; i < 10; i++) if (r() > 0.35) box(g, 0.65, 0.16, 0.1, i % 2 ? WOOD_L : WOOD, -2.9 + i * 0.64, 0.7 + (i % 3) * 0.45, s * (1.2 + (i % 3) * 0.12)).rotation.z = (r() - 0.5) * 0.2;
  rod(g, [-1.0, 0.5, 0], [1.2, 5.0, 0.6], 0.24, WOOD_D, 6);
  const sail = add(g, new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.6), new THREE.MeshStandardMaterial({ color: 0x3a342c, side: THREE.DoubleSide, roughness: 1 })), 0.7, 3.4, 0.9); sail.rotation.set(0.1, 0.9, 0.25);
  for (let i = 0; i < 7; i++) box(g, 0.9, 0.12, 0.14, WOOD_L, -3.8 + r() * 7.6, 0.1, 2.0 - r() * 4.0).rotation.y = r() * 3;
  const fl = flames(g, [[-1.4, 0, 1.3, 0xff7a1a], [0.3, 0.2, 1.7, 0xff5a0a], [1.8, -0.2, 1.1, 0xffb02e], [-0.3, 0.7, 0.9, 0xffd45a], [2.6, 0.1, 0.8, 0xff7a1a]]);
  const sm = smokePuffs(g, 7, 0.2, 0, 0x3a3a3a), embers = [0, 1, 2, 3, 4, 5].map((i) => ({ m: add(g, new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), lit(0xff9a2e, 2)), 0, 2, 0), ph: i / 6 }));
  g.userData.tick = (t) => { flick(fl, t); stepSmoke(sm, t, 2.2, 7, 0.22); embers.forEach((e, i) => { const k = (t * 0.5 + e.ph) % 1; e.m.position.set(-1 + Math.sin(t * 2 + i * 2) * 1.5 * k, 1.5 + k * 4, Math.cos(t * 2 + i) * 0.8 * k); e.m.scale.setScalar(1 - k); }); };
  return g;
}

// ================================================================== 15. floating wreckage (sea)
export function makeFloatingWreckage(def = {}) {
  const g = new THREE.Group(), r = rng(def.seed || 15), parts = [];
  const part = (m, x, z, amp = 0.12) => { const p = new THREE.Group(); add(g, p, x, 0, z); p.add(m); parts.push({ p, ph: r() * 6, amp, base: 0 }); return p; };
  for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(2.0 + r() * 1.2, 0.18, 0.45), flat(i % 2 ? WOOD : WOOD_L)); m.rotation.y = r() * 3.14; part(m, (r() - 0.5) * 6, (r() - 0.5) * 5); }
  const bar = new THREE.Group(); cyl(bar, 0.5, 0.5, 0.95, WOOD_L, 0, 0.1, 0, 10); for (const y of [-0.15, 0.35]) cyl(bar, 0.52, 0.52, 0.07, IRON, 0, y + 0.1, 0, 10); bar.rotation.z = 0.5; part(bar, 1.5, 1.0, 0.18);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 4.0, 6), flat(WOOD_D)); mast.rotation.z = Math.PI / 2 - 0.15; part(mast, -1.2, -0.5, 0.1);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.15, 6, 12), flat(RED)); ring.rotation.x = Math.PI / 2; part(ring, -2.5, 1.7, 0.14);
  const crate = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 1.2), flat(WOOD_L)); part(crate, 2.5, -1.5, 0.15);
  const foam = [];
  for (const p of parts) foam.push(add(p.p, new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.05, 4, 14), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 })), 0, 0.02, 0)); foam.forEach((f) => { f.rotation.x = Math.PI / 2; });
  g.userData.tick = (t) => parts.forEach(({ p, ph, amp }, i) => { p.position.y = Math.sin(t * 1.3 + ph) * amp; p.rotation.z = Math.sin(t * 0.9 + ph) * 0.06; p.rotation.x = Math.cos(t * 1.1 + ph) * 0.05; foam[i].scale.setScalar(1 + Math.sin(t * 1.6 + ph) * 0.08); });
  return g;
}

// ================================================================== 16. supply air drop
export function makeSupplyDrop() {
  const g = new THREE.Group(), cols = [RED, 0xfff6e6];
  const lab = new THREE.MeshStandardMaterial({ map: textTex('SUPPLY', '#2b6b3a', '#fff6e6', 'bold 46px Arial'), roughness: 0.7 });
  box(g, 2.0, 1.6, 2.0, 0x3f7f4a, 0, 0.8, 0); for (const y of [0.2, 1.4]) box(g, 2.06, 0.18, 2.06, GOLD, y > 1 ? 0 : 0, y, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 0.2, 1.65, 0.2, IRON, sx * 0.95, 0.8, sz * 0.95);
  for (const s of [-1, 1]) add(g, new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.6), lab), 0, 0.8, s * 1.02).rotation.y = s > 0 ? 0 : Math.PI;
  const chute = new THREE.Group(); add(g, chute, -1.8, 4.0, -1.8); chute.rotation.x = -0.35; chute.rotation.z = 0.45;
  for (let i = 0; i < 10; i++) add(chute, new THREE.Mesh(new THREE.SphereGeometry(3.0, 4, 6, (i / 10) * 6.283, 0.6283, 0, Math.PI / 2), flat(cols[i % 2], { side: THREE.DoubleSide })), 0, 0, 0).scale.y = 0.75;
  for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283; const p = new THREE.Vector3(-1.8 + Math.sin(0) , 0, 0); rod(g, [Math.cos(a) * 0.9, 1.6, Math.sin(a) * 0.9], [-1.8 + Math.cos(a) * 2.6, 4.2 + Math.cos(a) * 0.3, -1.8 + Math.sin(a) * 2.6], 0.02, ROPE, 4); }
  cyl(g, 0.14, 0.14, 0.7, 0xe5483c, 2.1, 0.35, 1.6, 8); ball(g, 0.1, 0xffe08a, 2.1, 0.75, 1.6, { emissive: 0xffa000, emissiveIntensity: 1.5 });
  const sm = smokePuffs(g, 8, 2.1, 1.6, 0xe5483c), glow = add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 14, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd45a, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })), 0, 8, 0);
  g.userData.tick = (t) => { stepSmoke(sm, t, 0.9, 6, 0.3); glow.material.opacity = 0.1 + Math.sin(t * 3) * 0.04; chute.rotation.x = -0.35 + Math.sin(t * 1.1) * 0.03; };
  return g;
}

// ================================================================== 17. loot beacon
export function makeLootBeacon() {
  const g = new THREE.Group();
  cyl(g, 1.7, 2.0, 0.5, STONE, 0, 0.25, 0, 6); cyl(g, 1.1, 1.4, 0.8, 0x6f6c65, 0, 0.9, 0, 6); cyl(g, 1.3, 1.1, 0.25, GOLD, 0, 1.4, 0, 6).material = flat(GOLD, { metalness: 0.8, roughness: 0.3 });
  const gem = add(g, new THREE.Mesh(new THREE.OctahedronGeometry(0.75, 0), lit(0xffc93c, 1.2, { flatShading: true })), 0, 2.7, 0); gem.scale.y = 1.5;
  const rings = [1.2, 1.6].map((rad, i) => { const t = add(g, new THREE.Mesh(new THREE.TorusGeometry(rad, 0.05, 5, 24), lit(0xffe08a, 1.1)), 0, 2.7, 0); t.rotation.x = Math.PI / 2 + i * 0.5; return t; });
  const beam = add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.4, 30, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd45a, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })), 0, 16, 0);
  const sparks = [0, 1, 2, 3, 4, 5].map((i) => ({ m: add(g, new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), lit(0xfff0b0, 2)), 0, 3, 0), ph: i / 6 }));
  g.userData.tick = (t) => { gem.rotation.y = t * 1.6; gem.position.y = 2.7 + Math.sin(t * 2) * 0.15; rings[0].rotation.z = t; rings[1].rotation.z = -t * 0.8; beam.material.opacity = 0.12 + Math.sin(t * 2.4) * 0.04; sparks.forEach((s, i) => { const k = (t * 0.4 + s.ph) % 1; s.m.position.set(Math.cos(i * 1.4 + t) * (0.8 + k * 0.6), 2.5 + k * 5, Math.sin(i * 1.4 + t) * (0.8 + k * 0.6)); s.m.scale.setScalar(1 - k); }); };
  return g;
}

// ================================================================== 18. storm zone marker
export function makeZoneMarker() {
  const g = new THREE.Group(), N = 6, pylons = [];
  for (let i = 0; i < 24; i++) { const a = (i / 24) * 6.283, seg = box(g, 0.9, 0.05, 0.4, i % 2 ? 0xffd23f : IRON, Math.cos(a) * 4.2, 0.05, Math.sin(a) * 4.2); seg.rotation.y = -a + Math.PI / 2; }
  for (let i = 0; i < N; i++) { const a = (i / N) * 6.283, x = Math.cos(a) * 3.6, z = Math.sin(a) * 3.6; cyl(g, 0.22, 0.32, 3.2, IRON, x, 1.6, z, 6); for (const y of [0.6, 1.4, 2.2]) cyl(g, 0.34, 0.34, 0.14, y > 1 ? RED : 0xffd23f, x, y, z, 6); pylons.push(add(g, new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), lit(0xff3030, 1.8)), x, 3.4, z)); }
  const hub = cyl(g, 0.5, 0.7, 1.4, IRON, 0, 0.7, 0, 8); add(g, new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), lit(0xff3030, 1.6, { flatShading: true })), 0, 2.1, 0);
  const rings = [2.4, 3.2].map((rad) => add(g, new THREE.Mesh(new THREE.TorusGeometry(rad, 0.06, 5, 40), lit(0xff4040, 1.2)), 0, 3.0, 0));
  rings.forEach((r) => { r.rotation.x = Math.PI / 2; });
  const wall = add(g, new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 7, 36, 1, true), new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })), 0, 3.5, 0);
  g.userData.tick = (t) => { rings[0].rotation.z = t * 0.9; rings[1].rotation.z = -t * 0.6; rings[0].position.y = 3.0 + Math.sin(t * 2) * 0.3; rings[1].position.y = 3.0 - Math.sin(t * 2) * 0.3; wall.material.opacity = 0.1 + Math.sin(t * 3) * 0.05; wall.rotation.y = t * 0.2; pylons.forEach((p, i) => { p.material.emissiveIntensity = Math.sin(t * 4 - i * 1.0) > 0.2 ? 2.2 : 0.6; }); };
  return g;
}

// ================================================================== 19. kraken tentacles (sea)
export function makeKrakenTentacles() {
  const g = new THREE.Group(), purple = 0x7b4aa0, belly = 0xd9b8e8, chains = [];
  const head = add(g, new THREE.Mesh(new THREE.SphereGeometry(2.1, 12, 9), flat(purple)), 0, 0.3, 0); head.scale.set(1, 0.85, 1);
  for (const s of [-1, 1]) { ball(g, 0.5, 0xfff0c0, s * 1.2, 1.1, 1.6); ball(g, 0.22, 0x111111, s * 1.2, 1.1, 2.05); }
  for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.283 + 0.3, base = new THREE.Group(); add(g, base, Math.cos(a) * 2.6, 0, Math.sin(a) * 2.6); base.rotation.y = -a; let parent = base; const segs = []; const len = 8;
    for (let k = 0; k < len; k++) { const rad = 0.55 - k * 0.055, seg = new THREE.Group(); parent.add(seg); seg.position.y = k ? 0.95 : 0; cyl(seg, rad * 0.9, rad, 1.0, purple, 0, 0.5, 0, 7); if (k % 2 === 0) ball(seg, rad * 0.32, belly, rad * 0.8, 0.5, 0); segs.push(seg); parent = seg; }
    chains.push({ segs, ph: i * 1.1, lean: 0.35 + (i % 2) * 0.15 }); }
  add(g, new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.12, 4, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 })), 0, 0.05, 0).rotation.x = Math.PI / 2;
  g.userData.tick = (t) => { head.position.y = 0.3 + Math.sin(t * 1.1) * 0.15; chains.forEach(({ segs, ph, lean }) => segs.forEach((s, k) => { s.rotation.z = (k === 0 ? lean : 0) + Math.sin(t * 1.3 + ph + k * 0.6) * 0.22; s.rotation.x = Math.cos(t * 1.1 + ph + k * 0.5) * 0.18; })); };
  return g;
}

// ================================================================== 20. sea serpent (sea)
export function makeSeaSerpent() {
  const g = new THREE.Group(), N = 26, teal = 0x2a9d8f, belly = 0xe9d8a6, segs = [];
  for (let i = 0; i < N; i++) { const rad = 0.75 - Math.abs(i - N * 0.35) * 0.012 - (i > N * 0.7 ? (i - N * 0.7) * 0.03 : 0); const m = add(g, new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.3, rad), 9, 7), flat(i % 4 === 0 ? 0x1f7a6f : teal)), 0, 0, 0); const fin = add(g, new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.7, 4), flat(0xe5483c)), 0, 0, 0); segs.push({ m, fin, x: -7 + i * 0.55, rad }); }
  const head = new THREE.Group(); g.add(head);
  const skull = add(head, new THREE.Mesh(new THREE.SphereGeometry(0.85, 10, 8), flat(teal)), 0, 0, 0); skull.scale.set(1.4, 0.8, 0.9);
  box(head, 1.2, 0.25, 0.7, belly, 0.5, -0.4, 0); for (const s of [-1, 1]) { ball(head, 0.16, 0xffe000, 0.5, 0.25, s * 0.5, { emissive: 0xff9a00, emissiveIntensity: 1.2 }); add(head, new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6, 5), flat(BONE)), -0.3, 0.75, s * 0.4).rotation.z = 0.4; }
  for (let i = 0; i < 5; i++) box(head, 0.08, 0.2, 0.08, BONE, 0.5 + i * 0.16, -0.25, i % 2 ? 0.2 : -0.2);
  g.userData.tick = (t) => { segs.forEach((s, i) => { const k = Math.sin(s.x * 0.85 - t * 2.0), y = -0.8 + 2.0 * Math.max(0, k), z = Math.sin(s.x * 0.3 + t * 0.6) * 0.5; s.m.position.set(s.x, y, z); s.fin.position.set(s.x, y + s.rad + 0.25, z); s.fin.visible = y > -0.1 && i % 2 === 0; }); const h = segs[N - 1]; head.position.set(h.x + 0.9, h.m.position.y + 0.4, h.m.position.z); head.rotation.z = 0.2 + Math.cos((h.x) * 0.85 - t * 2.0) * 0.25; };
  g.userData.tick(0);
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
