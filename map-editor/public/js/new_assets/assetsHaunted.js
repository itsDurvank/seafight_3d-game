import * as THREE from 'three';

// 10 scary "sea of thieves" pirate buildings & elements for the Island Resort map editor.
// Same contract as assets.js: makeXxx(def) -> THREE.Group on y = 0 (makeAsset scales, rotates, positions it).
// Animated ones set group.userData.tick(t). Self-contained: only needs 'three'.
// Hook-up: HAUNTED_MAKERS (type -> builder) and HAUNTED_CATALOG (palette entries) at the bottom.
// water:true entries are sea hazards: place them at sea level (y = 0).

// ------------------------------------------------------------------ helpers
const flat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, ...extra });
const add = (p, m, x = 0, y = 0, z = 0) => { m.position.set(x, y, z); p.add(m); return m; };
const box = (p, w, h, d, c, x, y, z) => add(p, new THREE.Mesh(new THREE.BoxGeometry(w, h, d), flat(c)), x, y, z);
const cyl = (p, rt, rb, h, c, x, y, z, seg = 9) => add(p, new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), flat(c)), x, y, z);
const ball = (p, r, c, x, y, z, extra = {}) => add(p, new THREE.Mesh(new THREE.SphereGeometry(r, 9, 7), flat(c, extra)), x, y, z);
const egg = (p, sx, sy, sz, c, x, y, z, extra = {}) => { const m = ball(p, 1, c, x, y, z, extra); m.scale.set(sx, sy, sz); return m; };
const cone = (p, r, h, c, x, y, z, seg = 6) => add(p, new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), flat(c)), x, y, z);
const lit = (c, i = 1.6, extra = {}) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, ...extra });
const ghostMat = (c, em, op = 0.88) => new THREE.MeshStandardMaterial({ color: c, emissive: em, emissiveIntensity: 0.55, transparent: true, opacity: op, flatShading: true, roughness: 0.6, side: THREE.DoubleSide });
const rng = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
function rod(p, a, b, r, c, seg = 5) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), d = vb.clone().sub(va), len = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), flat(c));
  m.position.copy(va).add(vb).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); p.add(m); return m;
}
const canvasTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return new THREE.CanvasTexture(c); };
const skullArt = (x, cx, cy, s, col = '#f3efe2') => {
  x.fillStyle = col; x.beginPath(); x.arc(cx, cy - s * 0.1, s * 0.55, 0, 7); x.fill(); x.fillRect(cx - s * 0.32, cy + s * 0.2, s * 0.64, s * 0.4);
  x.fillStyle = '#111'; x.beginPath(); x.arc(cx - s * 0.2, cy - s * 0.1, s * 0.15, 0, 7); x.arc(cx + s * 0.2, cy - s * 0.1, s * 0.15, 0, 7); x.fill();
  x.beginPath(); x.moveTo(cx, cx * 0 + cy + s * 0.05); x.lineTo(cx - s * 0.07, cy + s * 0.2); x.lineTo(cx + s * 0.07, cy + s * 0.2); x.fill();
  for (let i = -2; i <= 2; i++) x.fillRect(cx + i * s * 0.12 - 2, cy + s * 0.38, 3, s * 0.2);
};
const flagTex = () => canvasTex(128, 96, (x, w, h) => { x.fillStyle = '#17131f'; x.fillRect(0, 0, w, h); x.strokeStyle = '#d9d2bd'; x.lineWidth = 6; x.beginPath(); x.moveTo(30, 70); x.lineTo(98, 24); x.moveTo(98, 70); x.lineTo(30, 24); x.stroke(); skullArt(x, w / 2, h / 2, 50); });
const BONE = 0xe9e2cc, BONE_D = 0xc9c1a8, DARK = 0x2a2018, STONE = 0x4a4558, STONE_D = 0x3b3547, GREEN = 0x6dffb0, RED = 0x8a1c1c;
// skull: sockets + optional glowing eyes (pushed to reg for pulsing)
function skull(p, x, y, z, s = 1, eye = null, reg = null, ry = 0) {
  const k = new THREE.Group(); add(p, k, x, y, z); k.scale.setScalar(s); k.rotation.y = ry;
  egg(k, 0.55, 0.5, 0.52, BONE, 0, 0.1, 0); box(k, 0.5, 0.26, 0.4, BONE_D, 0, -0.32, 0.12);
  for (const sx of [-1, 1]) { ball(k, 0.15, 0x111111, sx * 0.21, 0.12, 0.38); if (eye !== null) { const e = add(k, new THREE.Mesh(new THREE.SphereGeometry(0.09, 7, 5), lit(eye, 1.8)), sx * 0.21, 0.12, 0.46); if (reg) reg.push(e); } }
  cone(k, 0.07, 0.18, 0x111111, 0, -0.08, 0.5, 3).rotation.x = Math.PI;
  for (let i = -2; i <= 2; i++) box(k, 0.06, 0.12, 0.05, BONE, i * 0.09, -0.4, 0.34);
  return k;
}
const flame = (p, x, y, z, s, c, reg) => { const f = add(p, new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.1, 6), lit(c, 1.7, { transparent: true, opacity: 0.9 })), x, y + 0.55 * s, z); f.scale.setScalar(s); reg.push({ f, s, ph: reg.length * 1.7 }); return f; };
const flick = (reg, t) => reg.forEach(({ f, s, ph }) => { const k = 1 + Math.sin(t * 9 + ph) * 0.18 + Math.sin(t * 15 + ph * 2) * 0.1; f.scale.set(s * (2 - k), s * k, s * (2 - k)); f.rotation.y = t * 2 + ph; });
const puffs = (p, n, x, y, z, col, op = 0.35, sz = 0.6) => Array.from({ length: n }, (_, i) => ({ m: add(p, new THREE.Mesh(new THREE.SphereGeometry(sz, 7, 5), new THREE.MeshStandardMaterial({ color: col, transparent: true, opacity: op, depthWrite: false })), x, y, z), ph: i / n, x, y, z, op }));
const stepPuffs = (arr, t, rise, spd = 0.25, grow = 1.8, drift = 0.5) => arr.forEach((s, i) => { const k = (t * spd + s.ph) % 1; s.m.position.set(s.x + Math.sin(t * 0.8 + i * 2) * drift * k, s.y + k * rise, s.z + Math.cos(t * 0.7 + i) * drift * k); s.m.scale.setScalar(0.6 + k * grow); s.m.material.opacity = s.op * (1 - k); });
const glowCol = (c, h, r0, r1, op = 0.12) => new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, 14, 1, true), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));

// ================================================================== 1. skeleton fort
export function makeSkeletonFort() {
  const g = new THREE.Group(), eyes = [], fl = [], flags = [], tex = flagTex();
  cyl(g, 9, 10, 0.7, STONE_D, 0, 0.35, 0, 16);
  const W = 5.0; const wall = (x, z, w, d) => box(g, w, 2.8, d, STONE, x, 2.1, z);
  wall(0, -W, 10.6, 0.9); wall(-W, 0, 0.9, 10.6); wall(W, 0, 0.9, 10.6); wall(-3.5, W, 3.8, 0.9); wall(3.5, W, 3.8, 0.9);
  for (let i = 0; i < 11; i++) { const x = -5 + i * 1.0; for (const z of [-W, W]) if (z < 0 || Math.abs(x) > 1.7) cone(g, 0.2, 1.0, BONE, x, 4.0, z, 4); }
  for (let i = 0; i < 11; i++) for (const x of [-W, W]) cone(g, 0.2, 1.0, BONE, x, 4.0, -5 + i * 1.0, 4);
  for (let i = 0; i < 5; i++) { const x = -3.6 + i * 1.8, rb = add(g, new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.13, 5, 8, Math.PI), flat(BONE)), x, 0.7, -W + 0.55); }
  for (const s of [-1, 1]) for (let i = 0; i < 2; i++) skull(g, s * (2.6 + i * 1.7), 2.4, W + 0.55, 0.75, GREEN, eyes);
  box(g, 3.8, 1.1, 1.0, STONE_D, 0, 3.75, W); for (let i = 0; i < 8; i++) cone(g, 0.14, 0.9, BONE, -1.5 + i * 0.43, 2.75, W + 0.45, 4).rotation.x = Math.PI;
  const big = egg(g, 1.9, 1.5, 1.3, BONE, 0, 5.6, W); for (const s of [-1, 1]) { ball(big, 0.4, 0x111111, s * 0.42, 0.1, 0.78); const e = add(g, new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), lit(GREEN, 1.9)), s * 0.8, 5.7, W + 1.0); eyes.push(e); }
  cone(g, 0.3, 0.6, 0x111111, 0, 5.2, W + 1.25, 3).rotation.x = Math.PI; for (let i = -3; i <= 3; i++) box(g, 0.22, 0.4, 0.3, BONE_D, i * 0.4, 4.55, W + 1.0);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = sx * 5.4, z = sz * 5.4; cyl(g, 1.3, 1.55, 5.4, STONE, x, 3.4, z, 8); cyl(g, 1.7, 1.45, 0.5, STONE_D, x, 6.3, z, 8);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28; cone(g, 0.18, 1.0, BONE, x + Math.cos(a) * 1.55, 6.9, z + Math.sin(a) * 1.55, 4); }
    cyl(g, 0.5, 0.35, 0.5, 0x222222, x, 6.7, z, 6); flame(g, x, 6.9, z, 1.0, GREEN, fl);
    if (sz < 0) { rod(g, [x, 6.5, z], [x, 9.5, z], 0.07, DARK); const f = add(g, new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.3), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide })), x + 0.9, 8.8, z); flags.push(f); }
  }
  cone(g, 2.1, 2.6, STONE, 0, 1.9, 0, 9); for (let i = 0; i < 9; i++) { const a = i * 2.4, d = 0.4 + (i % 4) * 0.4; skull(g, Math.cos(a) * d, 1.2 + (4 - Math.min(d, 1.6)) * 0.3, Math.sin(a) * d, 0.55, null, null, a); }
  cyl(g, 0.6, 0.8, 0.4, 0x222222, 0, 3.2, 0, 7); flame(g, 0, 3.4, 0, 2.0, GREEN, fl); const aura = add(g, glowCol(GREEN, 12, 0.8, 2.0, 0.1), 0, 8.6, 0);
  g.userData.tick = (t) => { flick(fl, t); eyes.forEach((e, i) => { e.material.emissiveIntensity = 1.5 + Math.sin(t * 3 + i) * 0.5; }); flags.forEach((f, i) => { f.rotation.y = Math.sin(t * 3 + i) * 0.25; }); aura.material.opacity = 0.09 + Math.sin(t * 2.4) * 0.03; };
  return g;
}

// ================================================================== 2. ghost ship wreck (sea)
export function makeGhostShip() {
  const g = new THREE.Group(), ship = new THREE.Group(); add(g, ship, 0, -0.5, 0);
  const sh = new THREE.Shape(); sh.moveTo(-5, 0.6); sh.lineTo(-5.3, 2.7); sh.lineTo(-3.5, 2.4); sh.lineTo(3.6, 2.2); sh.lineTo(5.9, 3.5); sh.lineTo(6.3, 3.1); sh.lineTo(5.0, 1.0); sh.lineTo(2.5, 0.0); sh.lineTo(-3, 0.0); sh.closePath();
  const hg = new THREE.ExtrudeGeometry(sh, { depth: 2.8, bevelEnabled: false }); hg.translate(0, 0, -1.4); add(ship, new THREE.Mesh(hg, ghostMat(0x3a5a55, 0x1a6a5a, 0.93)));
  box(ship, 9.6, 0.12, 2.7, 0x4b6f68, 0.3, 2.45, 0);
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++) box(ship, 0.55, 0.45, 0.1, 0x061513, -3 + i * 1.5, 1.6, s * 1.42);
  for (let i = 0; i < 4; i++) rod(ship, [-2 + i * 2, 2.4, 1.2 * (i % 2 ? 1 : -1)], [-1.6 + i * 2, 3.4 + (i % 2) * 0.4, 1.3 * (i % 2 ? 1 : -1)], 0.07, 0x2a3a38);
  const tex = canvasTex(128, 128, (x, w, h) => { x.clearRect(0, 0, w, h); x.fillStyle = '#d6efe6'; x.beginPath(); x.moveTo(0, 0); x.lineTo(w, 0); for (let i = 0; i <= 8; i++) x.lineTo(w - i * (w / 8), h * (0.78 + ((i * 7) % 5) * 0.045)); x.closePath(); x.fill(); x.fillStyle = 'rgba(40,70,60,0.5)'; x.fillRect(w * 0.15, h * 0.3, 3, h * 0.4); });
  const sails = [];
  rod(ship, [0.5, 2.4, 0], [0.9, 9.6, 0], 0.22, 0x23312f); rod(ship, [3.6, 2.3, 0], [3.8, 7.6, 0], 0.17, 0x23312f); rod(ship, [-3.5, 2.4, 0], [-3.7, 4.8, 0], 0.17, 0x23312f);
  for (const [x, y, w, hh] of [[0.8, 8.4, 4.2, 3.4], [0.75, 5.6, 4.6, 2.9], [3.75, 6.4, 3.0, 2.4]]) { box(ship, 0.12, 0.12, w, 0x23312f, x, y + hh * 0.5, 0); const geo = new THREE.PlaneGeometry(w, hh, 8, 5); const sl = add(ship, new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, emissive: 0x3fbf9a, emissiveIntensity: 0.25 })), x + 0.12, y - hh * 0.5 + hh * 0.5, 0); sl.rotation.y = Math.PI / 2; sails.push({ geo, ox: Array.from(geo.attributes.position.array), h: hh }); }
  const lamps = [], eyes = [];
  for (const [x, y, z] of [[0.8, 5.0, 1.9], [0.8, 8.0, -1.8], [3.7, 6.0, 1.5], [-4.2, 3.4, 1.2], [5.3, 3.4, 0.0]]) { rod(ship, [x, y + 0.45, z], [x, y + 0.2, z], 0.02, 0x2a3a38); lamps.push(add(ship, new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), lit(GREEN, 1.7)), x, y, z)); }
  add(ship, new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.07, 5, 12), flat(0x23312f)), -4.2, 3.4, 0); for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28; box(ship, 0.05, 0.05, 1.25, 0x23312f, -4.2, 3.4, 0).rotation.x = a; }
  box(ship, 0.4, 0.9, 0.25, 0x2a3a38, -4.5, 2.95, 0.0); skull(ship, -4.5, 3.8, 0.0, 0.7, 0xff3030, eyes, Math.PI / 2);
  for (let i = 0; i < 6; i++) box(ship, 0.18, 0.9 + (i % 3) * 0.5, 0.04, 0x2f7a52, 4.6 - i * 1.7, 1.5, 1.45 * (i % 2 ? -1 : 1));
  const mist = puffs(g, 9, 0, 0.8, 0, 0x9fffd8, 0.3, 0.9);
  const aura = add(g, glowCol(GREEN, 9, 2.0, 3.2, 0.06), 0, 4.5, 0);
  g.userData.tick = (t) => { ship.rotation.z = -0.13 + Math.sin(t * 0.8) * 0.04; ship.rotation.x = Math.sin(t * 0.6) * 0.03; ship.position.y = -0.5 + Math.sin(t * 1.1) * 0.12; lamps.forEach((l, i) => { l.material.emissiveIntensity = 1.5 + Math.sin(t * 6 + i * 2) * 0.4 + Math.sin(t * 13 + i) * 0.2; }); eyes.forEach((e) => { e.material.emissiveIntensity = 1.6 + Math.sin(t * 3) * 0.5; });
    sails.forEach(({ geo, ox, h }) => { const pos = geo.attributes.position; for (let i = 0; i < pos.count; i++) { const y = ox[i * 3 + 1]; pos.setZ(i, Math.sin(ox[i * 3] * 1.6 + t * 2.5) * 0.18 * (0.5 - y / h)); } pos.needsUpdate = true; });
    stepPuffs(mist, t, 4.5, 0.2, 2.0, 1.2); aura.material.opacity = 0.05 + Math.sin(t * 2) * 0.02; };
  return g;
}

// ================================================================== 3. gibbet cages
export function makeGibbetCages() {
  const g = new THREE.Group(), pivots = [], eyes = [], crows = [];
  box(g, 9.2, 0.5, 4.0, STONE_D, 0, 0.25, 0);
  for (const s of [-1, 1]) { box(g, 0.55, 8.0, 0.55, DARK, s * 3.7, 4.2, 0); rod(g, [s * 3.7, 1.5, 0], [s * 2.5, 7.7, 0], 0.12, DARK); }
  box(g, 8.4, 0.5, 0.5, DARK, 0, 8.0, 0);
  for (const [x, ph] of [[-2.2, 0], [0, 1.7], [2.2, 3.1]]) {
    const pv = new THREE.Group(); add(g, pv, x, 7.7, 0);
    for (let k = 0; k < 4; k++) { const l = add(pv, new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 4, 8), flat(0x777777)), 0, -0.2 - k * 0.3, 0); l.rotation.y = k * 1.5; }
    const cage = new THREE.Group(); add(pv, cage, 0, -3.8, 0);
    for (let i = 0; i < 9; i++) { const a = (i / 9) * 6.28; cyl(cage, 0.04, 0.04, 2.6, 0x555a63, Math.cos(a) * 0.8, 0, Math.sin(a) * 0.8, 4); }
    for (const y of [-1.3, -0.4, 0.5, 1.3]) { const r = add(cage, new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.045, 4, 14), flat(0x555a63)), 0, y, 0); r.rotation.x = Math.PI / 2; }
    cone(cage, 0.85, 0.7, 0x555a63, 0, 1.9, 0, 9); ball(cage, 0.1, 0x555a63, 0, 2.3, 0); cyl(cage, 0.8, 0.8, 0.08, 0x3f434a, 0, -1.35, 0, 9);
    skull(cage, 0, 0.85, 0, 0.8, ph === 1.7 ? GREEN : null, eyes); rod(cage, [0, 0.4, -0.05], [0, -0.7, -0.05], 0.06, BONE);
    for (let r = 0; r < 4; r++) egg(cage, 0.4 - r * 0.03, 0.04, 0.22, BONE, 0, 0.3 - r * 0.22, 0);
    for (const s of [-1, 1]) { rod(cage, [s * 0.35, 0.25, 0], [s * 0.55, -0.7, 0.1], 0.05, BONE); rod(cage, [s * 0.15, -0.8, 0], [s * 0.3, -1.3, 0.05], 0.06, BONE); }
    pivots.push({ pv, ph });
  }
  for (const [x, ry] of [[-3.0, 0.4], [3.2, -0.5]]) { const c = new THREE.Group(); add(g, c, x, 8.25, 0); c.rotation.y = ry; egg(c, 0.5, 0.4, 0.28, 0x15151b, 0, 0.3, 0); const head = new THREE.Group(); add(c, head, 0.45, 0.65, 0); ball(head, 0.22, 0x15151b, 0, 0, 0); cone(head, 0.09, 0.35, 0xe08a1f, 0.28, -0.02, 0, 4).rotation.z = -Math.PI / 2; ball(head, 0.05, 0xff3030, 0.1, 0.07, 0.17); cone(c, 0.2, 0.8, 0x15151b, -0.65, 0.2, 0, 3).rotation.z = Math.PI / 2; crows.push({ head, ph: x }); }
  const fog = puffs(g, 5, 0, 0.5, 0, 0xcfe8ff, 0.18, 1.0);
  g.userData.tick = (t) => { pivots.forEach(({ pv, ph }) => { pv.rotation.z = Math.sin(t * 0.9 + ph) * 0.12; pv.rotation.x = Math.sin(t * 0.7 + ph) * 0.05; }); eyes.forEach((e) => { e.material.emissiveIntensity = 1.5 + Math.sin(t * 3) * 0.5; }); crows.forEach(({ head, ph }) => { head.rotation.z = Math.max(0, Math.sin(t * 2 + ph)) * -0.7; head.rotation.y = Math.sin(t * 0.8 + ph) * 0.6; }); stepPuffs(fog, t, 1.2, 0.12, 1.5, 3); };
  return g;
}

// ================================================================== 4. siren shrine
export function makeSirenShrine() {
  const g = new THREE.Group(), runes = [], STONE_G = 0x8fa9ae, TEAL = 0x2ee6e0, hair = [];
  cyl(g, 6.2, 6.6, 0.4, STONE_D, 0, 0.2, 0, 14); add(g, new THREE.Mesh(new THREE.CylinderGeometry(4.7, 4.7, 0.2, 20), ghostMat(0x2fb8c8, 0x0f7d8c, 0.85)), 0, 0.45, 0);
  cyl(g, 1.9, 2.2, 0.6, STONE, 0, 0.7, 0, 8); cyl(g, 1.4, 1.7, 0.6, STONE_D, 0, 1.3, 0, 8);
  const st = new THREE.Group(); add(g, st, 0, 1.6, 0);
  [[0, 0.5, 0, 0.8], [0, 1.4, -0.2, 0.7], [0, 2.2, -0.5, 0.6], [0, 2.9, -0.9, 0.45]].forEach(([x, y, z, r], i) => egg(st, r, r * 0.9, r * 1.2, STONE_G, x, y, z));
  cone(st, 0.6, 1.4, STONE_G, 0, 3.5, -1.4, 4).rotation.x = -Math.PI / 2; cone(st, 0.45, 1.0, STONE_G, 0.3, 3.4, -1.9, 4).rotation.set(-Math.PI / 2, 0, 0.5);
  cyl(st, 0.6, 0.75, 1.4, STONE_G, 0, 3.0, 0.0, 7).position.y = 3.3; egg(st, 0.55, 0.6, 0.55, STONE_G, 0, 4.4, 0.0);
  for (const s of [-1, 1]) rod(st, [s * 0.5, 3.8, 0], [s * 1.5, 5.6, 0.2], 0.17, STONE_G);
  for (let k = 0; k < 5; k++) { const a = (k / 4 - 0.5) * 1.8; cone(st, 0.14, 0.7, TEAL, Math.sin(a) * 0.5, 5.05 + Math.cos(a) * 0.1, 0.0, 4); }
  for (const s of [-1, 1]) { ball(st, 0.15, 0x0a1a1c, s * 0.2, 4.45, 0.5); const e = add(st, new THREE.Mesh(new THREE.SphereGeometry(0.08, 7, 5), lit(TEAL, 2)), s * 0.2, 4.45, 0.58); runes.push(e); }
  for (let i = 0; i < 7; i++) { const a = (i / 6 - 0.5) * 2.4, pv = new THREE.Group(); add(st, pv, Math.sin(a) * 0.5, 4.5, -0.35); cone(pv, 0.18, 1.7 + (i % 3) * 0.3, 0x3a5a62, 0, -0.9, 0, 4).rotation.x = Math.PI; hair.push({ pv, ph: i }); }
  const orb = add(g, new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 9), lit(TEAL, 1.2, { transparent: true, opacity: 0.9 })), 0, 8.0, 0.2); const halo = add(g, new THREE.Mesh(new THREE.SphereGeometry(1.0, 12, 9), new THREE.MeshBasicMaterial({ color: TEAL, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false })), 0, 8.0, 0.2);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * 6.28 + 0.8, x = Math.cos(a) * 4.2, z = Math.sin(a) * 4.2; cyl(g, 0.4, 0.5, 4.6, STONE_G, x, 2.7, z, 6); cyl(g, 0.6, 0.45, 0.4, STONE, x, 5.2, z, 6); const r = add(g, new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.9), lit(TEAL, 1.4, { side: THREE.DoubleSide })), x * 0.88, 2.9, z * 0.88); r.lookAt(0, 2.9, 0); runes.push(r); for (let k = 0; k < 3; k++) box(g, 0.08, 0.5, 0.08, 0x2f7a52, x + 0.3 * Math.cos(a + 1) + k * 0.1, 3.8 - k * 0.5, z + 0.3 * Math.sin(a + 1)); }
  const pearls = Array.from({ length: 6 }, (_, i) => ({ m: add(g, new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xbfe6ff, emissiveIntensity: 0.8 })), 0, 3, 0), a: (i / 6) * 6.28 }));
  g.userData.tick = (t) => { orb.material.emissiveIntensity = 1.1 + Math.sin(t * 2.4) * 0.4; halo.scale.setScalar(1 + Math.sin(t * 2.4) * 0.12); orb.position.y = halo.position.y = 8.0 + Math.sin(t * 1.4) * 0.2; runes.forEach((r, i) => { r.material.emissiveIntensity = 1.2 + Math.sin(t * 2 + i * 1.3) * 0.7; }); hair.forEach(({ pv, ph }) => { pv.rotation.z = Math.sin(t * 1.2 + ph) * 0.08; pv.rotation.x = Math.cos(t + ph) * 0.06; }); pearls.forEach(({ m, a }, i) => { const aa = a + t * 0.6; m.position.set(Math.cos(aa) * 2.6, 3.2 + Math.sin(t * 1.5 + i) * 0.5, Math.sin(aa) * 2.6); }); };
  return g;
}

// ================================================================== 5. erupting volcano
export function makeVolcano() {
  const g = new THREE.Group(), r = rng(5), fl = [];
  cyl(g, 7.4, 8.0, 0.5, 0x2b2226, 0, 0.25, 0, 14); cyl(g, 1.6, 5.8, 6.6, 0x3a2b2b, 0, 3.8, 0, 10);
  cyl(g, 2.0, 1.7, 0.7, 0x241b1d, 0, 7.15, 0, 10);
  const lava = add(g, new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.2, 12), lit(0xff6a1a, 1.5)), 0, 7.45, 0);
  const streams = [];
  for (let i = 0; i < 4; i++) { const a = i * 1.6 + 0.4, x0 = Math.cos(a) * 1.6, z0 = Math.sin(a) * 1.6, x1 = Math.cos(a + 0.2) * 5.4, z1 = Math.sin(a + 0.2) * 5.4; const m = rod(g, [x0, 7.2, z0], [x1, 0.5, z1], 0.32, 0xff6a1a, 5); m.material = lit(0xff6a1a, 1.2); streams.push(m); add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.12, 8), lit(0xff8a2a, 1.2)), x1, 0.32, z1); }
  for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.28; cone(g, 0.35, 1.4 + r(), 0x15111a, Math.cos(a) * 6.3, 0.9, Math.sin(a) * 6.3, 4).rotation.z = Math.cos(a) * 0.2; }
  for (let i = 0; i < 5; i++) { const a = i * 1.3; add(g, new THREE.Mesh(new THREE.DodecahedronGeometry(0.6 + r() * 0.4, 0), flat(0x34272a)), Math.cos(a) * 3.8, 1.8 + (i % 2) * 0.9, Math.sin(a) * 3.8).rotation.y = a;  }
  const balls = Array.from({ length: 5 }, (_, i) => ({ m: add(g, new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), lit(0xff7a2a, 1.8)), 0, 8, 0), ph: i / 5, a: i * 1.3, d: 3 + i * 0.7 }));
  const smoke = puffs(g, 9, 0, 7.6, 0, 0x2c2c33, 0.5, 1.0);
  const glow = add(g, glowCol(0xff7a2a, 16, 1.2, 2.6, 0.1), 0, 14, 0);
  g.userData.tick = (t) => { lava.material.emissiveIntensity = 1.4 + Math.sin(t * 3) * 0.4; streams.forEach((m, i) => { m.material.emissiveIntensity = 1.1 + Math.sin(t * 2 + i * 1.6) * 0.4; }); balls.forEach((b) => { const k = (t * 0.28 + b.ph) % 1; b.m.position.set(Math.cos(b.a) * b.d * k, 7.6 + 8.5 * Math.sin(Math.PI * k) - (k > 0.5 ? 0 : 0), Math.sin(b.a) * b.d * k); b.m.scale.setScalar(1 - k * 0.4); }); stepPuffs(smoke, t, 9, 0.12, 3.0, 1.2); glow.material.opacity = 0.08 + Math.sin(t * 2.6) * 0.03; };
  return g;
}

// ================================================================== 6. bone throne
export function makeBoneThrone() {
  const g = new THREE.Group(), eyes = [], fl = [];
  cyl(g, 4.6, 4.9, 0.5, STONE_D, 0, 0.25, 0, 10); cyl(g, 3.6, 4.0, 0.5, STONE, 0, 0.75, 0, 10); cyl(g, 2.6, 3.0, 0.5, STONE_D, 0, 1.25, 0, 10);
  box(g, 2.8, 1.2, 2.4, 0x2a1d1a, 0, 2.1, 0); box(g, 2.4, 0.4, 2.0, RED, 0, 2.9, 0.1); box(g, 2.5, 3.0, 0.5, 0x2a1d1a, 0, 4.0, -1.0);
  for (let i = 0; i < 7; i++) { const x = (i - 3) * 0.75, tip = [x * 1.25, 6.4 - Math.abs(i - 3) * 0.35, -1.3]; rod(g, [x * 0.5, 2.8, -1.0], tip, 0.15, BONE, 5); ball(g, 0.2, BONE, tip[0], tip[1], tip[2]); }
  for (let i = 0; i < 6; i++) ball(g, 0.2, BONE_D, 0, 3.0 + i * 0.5, -1.35);
  skull(g, 0, 6.9, -1.3, 1.6, 0xff3030, eyes);
  const hat = add(g, new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.3, 3), flat(0x15131a)), 0.2, 8.15, -1.3); hat.rotation.z = 0.12; hat.rotation.y = 0.5; box(g, 0.35, 0.1, 0.1, 0xe0a824, 0.35, 8.15, -0.4);
  for (const s of [-1, 1]) { rod(g, [s * 1.3, 3.4, 0.9], [s * 1.3, 3.5, -0.8], 0.17, BONE); ball(g, 0.28, BONE, s * 1.3, 3.5, 0.95); ball(g, 0.25, BONE, s * 1.3, 3.5, -0.85); skull(g, s * 1.3, 3.95, 0.5, 0.55, 0xff3030, eyes); }
  for (const [x, z, h] of [[-3.0, 1.5, 0.6], [3.1, 1.2, 0.9], [-2.4, 2.4, 0.5], [2.6, 2.6, 0.7], [-3.4, -0.6, 0.8], [3.4, -0.8, 0.5]]) { cyl(g, 0.14, 0.16, h, 0xf1e6c8, x, 1.5 + h / 2, z, 6); flame(g, x, 1.5 + h, z, 0.3, 0xffa84a, fl); }
  rod(g, [-2.0, 1.5, 2.9], [-2.9, 4.3, 3.3], 0.07, 0xb0b4bc); box(g, 0.9, 0.12, 0.14, 0xe0a824, -2.7, 3.9, 3.2).rotation.z = 0.3;
  for (let i = 0; i < 5; i++) skull(g, -3.6 + i * 1.8, 0.95, 4.0 - (i % 2) * 0.3, 0.6, null, null, 0.3 * i);
  const aura = add(g, glowCol(0xff3a3a, 8, 1.2, 2.6, 0.07), 0, 5, -1);
  g.userData.tick = (t) => { flick(fl, t); eyes.forEach((e, i) => { e.material.emissiveIntensity = 1.5 + Math.sin(t * 2.6 + i) * 0.6; }); aura.material.opacity = 0.06 + Math.sin(t * 2.2) * 0.02; };
  return g;
}

// ================================================================== 7. pirate graveyard
export function makeGraveyard(def = {}) {
  const g = new THREE.Group(), r = rng(def.seed || 7), fl = [], lamps = [];
  cyl(g, 6.4, 6.8, 0.4, 0x27322b, 0, 0.2, 0, 16);
  for (let i = 0; i < 14; i++) { const a = (i / 14) * 6.28; if (Math.abs(a - Math.PI / 2) < 0.5) continue; const x = Math.cos(a) * 6.0, z = Math.sin(a) * 6.0; box(g, 0.25, 2.0, 0.25, DARK, x, 1.3, z); cone(g, 0.2, 0.5, DARK, x, 2.55, z, 4); const a2 = a + 0.449, x2 = Math.cos(a2) * 6.0, z2 = Math.sin(a2) * 6.0; if (Math.abs(a2 - Math.PI / 2) > 0.5) for (const y of [1.0, 1.7]) rod(g, [x, y, z], [x2, y, z2], 0.05, 0x3a3a42); }
  const tomb = (x, z, ry, tilt, txt) => { const t = new THREE.Group(); add(g, t, x, 0.4, z); t.rotation.y = ry; t.rotation.z = tilt; box(t, 1.0, 1.3, 0.3, 0x6f7a80, 0, 0.65, 0); const top = cyl(t, 0.5, 0.5, 0.3, 0x6f7a80, 0, 1.3, 0, 10); top.rotation.x = Math.PI / 2; if (txt) add(t, new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.9), new THREE.MeshStandardMaterial({ map: canvasTex(64, 72, (c, w, h) => { c.fillStyle = '#6f7a80'; c.fillRect(0, 0, w, h); if (txt === 'S') skullArt(c, w / 2, 26, 36, '#2a2f33'); else { c.fillStyle = '#2a2f33'; c.font = 'bold 18px Georgia'; c.textAlign = 'center'; c.fillText('R.I.P.', w / 2, 30); c.fillRect(w / 2 - 2, 38, 4, 26); c.fillRect(w / 2 - 12, 46, 24, 4); } }) })), 0, 0.85, 0.16); };
  [[-3.2, -2.2, 0.3, 0.12, 'S'], [-0.8, -3.2, -0.2, -0.1, 'R'], [2.4, -2.6, 0.1, 0.15, 'S'], [3.8, -0.4, 0.5, -0.12, 'R'], [-4.0, 0.6, 0.7, 0.08, null], [1.0, -1.0, -0.4, 0.2, null]].forEach((a) => tomb(...a));
  for (const [x, z, ry] of [[-2.2, 1.6, 0.5], [3.0, 2.0, -0.4], [-4.1, 2.8, 0.9]]) { const c = new THREE.Group(); add(g, c, x, 0.4, z); c.rotation.y = ry; c.rotation.z = (x > 0 ? 1 : -1) * 0.12; box(c, 0.2, 1.8, 0.2, DARK, 0, 0.9, 0); box(c, 1.0, 0.2, 0.2, DARK, 0, 1.4, 0); add(c, new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 3), flat(0x15131a)), 0.0, 1.85, 0).rotation.y = 0.5; }
  const cf = new THREE.Group(); add(g, cf, 0.2, 0.4, 0.8); cf.rotation.y = 0.5; box(cf, 1.3, 0.6, 2.6, 0x3a2a1f, 0, 0.3, 0); box(cf, 1.0, 0.04, 2.2, 0x0a1a12, 0, 0.58, 0); const inner = add(cf, new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.2), lit(GREEN, 0.9, { transparent: true, opacity: 0.85 })), 0, 0.6, 0); inner.rotation.x = -Math.PI / 2; const lid = box(cf, 1.3, 0.12, 2.6, 0x4a3828, 1.2, 0.9, 0.2); lid.rotation.z = -1.0; lid.rotation.y = 0.1;
  const glowC = add(g, glowCol(GREEN, 6, 0.6, 1.0, 0.1), 0.2, 3.4, 0.8);
  add(g, new THREE.Mesh(new THREE.ConeGeometry(1.1, 0.7, 7), flat(0x4a3a2a)), -2.0, 0.65, -0.6); rod(g, [-1.6, 0.5, -0.6], [-1.2, 2.0, -0.4], 0.05, 0x6b4a2b); box(g, 0.4, 0.5, 0.06, 0x9aa0a8, -1.6, 0.4, -0.5);
  const hand = new THREE.Group(); add(g, hand, 3.2, 0.3, 3.0); egg(hand, 0.3, 0.12, 0.3, BONE, 0, 0.5, 0); const fingers = [];
  for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.45, fg = new THREE.Group(); add(hand, fg, Math.sin(a) * 0.25, 0.55, Math.cos(a) * 0.1); rod(fg, [0, 0, 0], [Math.sin(a) * 0.1, 0.6, 0], 0.045, BONE); rod(fg, [Math.sin(a) * 0.1, 0.6, 0], [Math.sin(a) * 0.2, 1.05, -0.1], 0.04, BONE); fingers.push({ fg, i }); } rod(hand, [0, 0.4, 0], [0, -0.4, 0], 0.09, BONE);
  for (const [x, z] of [[-4.6, 4.0], [4.7, 3.8]]) { rod(g, [x, 0.4, z], [x, 3.4, z], 0.08, 0x2a2a30); rod(g, [x, 3.4, z], [x + 0.5, 3.4, z], 0.05, 0x2a2a30); lamps.push(add(g, new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), lit(GREEN, 1.7)), x + 0.5, 3.1, z)); }
  const fog = puffs(g, 9, 0, 0.6, 0, 0xcfe8e0, 0.2, 1.1); fog.forEach((f, i) => { const a = i * 0.7, d = 1.5 + (i % 3) * 1.6; f.x = Math.cos(a) * d; f.z = Math.sin(a) * d; });
  g.userData.tick = (t) => { inner.material.emissiveIntensity = 0.8 + Math.sin(t * 3) * 0.3; glowC.material.opacity = 0.08 + Math.sin(t * 2.5) * 0.03; lamps.forEach((l, i) => { l.material.emissiveIntensity = 1.5 + Math.sin(t * 6 + i * 2) * 0.4; }); hand.position.y = 0.3 + (Math.sin(t * 0.8) + 1) * 0.12; fingers.forEach(({ fg, i }) => { fg.rotation.x = Math.sin(t * 2.4 + i * 0.8) * 0.3; }); stepPuffs(fog, t, 0.5, 0.1, 1.2, 1.2); };
  return g;
}

// ================================================================== 8. reaper totem
export function makeReaperTotem() {
  const g = new THREE.Group(), eyes = [], fl = [], cloths = [], tex = flagTex();
  cyl(g, 2.4, 2.8, 0.6, STONE_D, 0, 0.3, 0, 8); cyl(g, 1.8, 2.1, 0.6, STONE, 0, 0.9, 0, 8); cyl(g, 0.55, 0.75, 10.4, DARK, 0, 6.4, 0, 7);
  for (let i = 0; i < 4; i++) { const y = 2.2 + i * 1.5, a = i * 0.6; const sk = skull(g, 0, y, 0.55, 0.9, i % 2 ? 0xff3030 : GREEN, eyes, 0); sk.rotation.y = a * 0; for (const s of [-1, 1]) rod(g, [s * 0.9, y - 0.45, 0.7], [-s * 0.9, y - 0.75, 0.7], 0.08, BONE); }
  const big = new THREE.Group(); add(g, big, 0, 9.1, 0.3); egg(big, 1.4, 1.25, 1.2, BONE, 0, 0.1, 0); box(big, 1.1, 0.6, 0.9, BONE_D, 0, -1.05, 0.2);
  for (const s of [-1, 1]) { ball(big, 0.38, 0x111111, s * 0.5, 0.2, 0.92); eyes.push(add(big, new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), lit(0xff3030, 2)), s * 0.5, 0.2, 1.1)); const h = cone(big, 0.35, 2.2, 0x15131a, s * 1.2, 1.3, 0, 5); h.rotation.z = -s * 0.7; const h2 = cone(big, 0.22, 1.2, BONE_D, s * 2.0, 2.4, 0, 5); h2.rotation.z = -s * 0.2; }
  cone(big, 0.28, 0.6, 0x111111, 0, -0.15, 1.15, 3).rotation.x = Math.PI; for (let i = -3; i <= 3; i++) cone(big, 0.1, 0.4, BONE, i * 0.28, -0.92, 0.75, 4).rotation.x = Math.PI;
  for (const s of [-1, 1]) { const arm = rod(g, [0, 8.0, 0], [s * 3.0, 8.2, 0], 0.14, DARK); const geo = new THREE.PlaneGeometry(2.2, 3.4, 6, 8); geo.translate(0, -1.7, 0); const cl = add(g, new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 1 })), s * 2.2, 8.15, 0); cloths.push({ geo, ox: Array.from(geo.attributes.position.array), s }); for (let k = 0; k < 4; k++) cone(g, 0.12, 0.4, BONE, s * (0.6 + k * 0.7), 8.0, 0, 4).rotation.z = Math.PI / 2 * s; }
  for (const s of [-1, 1]) { rod(g, [s * 0.5, 7.0, 0.55], [s * 1.5, 4.8, 0.7], 0.04, 0x888c94); add(g, new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 5, 8, 4.5), flat(0x888c94)), s * 1.5, 4.55, 0.7); }
  for (const a of [0.8, 2.4, 3.9, 5.4]) { const x = Math.cos(a) * 1.8, z = Math.sin(a) * 1.8; cyl(g, 0.18, 0.22, 0.6, 0xf1e6c8, x, 1.5, z, 6); flame(g, x, 1.8, z, 0.35, GREEN, fl); }
  const aura = add(g, glowCol(0xff3030, 11, 0.6, 1.8, 0.06), 0, 6, 0);
  g.userData.tick = (t) => { flick(fl, t); eyes.forEach((e, i) => { e.material.emissiveIntensity = 1.6 + Math.sin(t * 3 + i) * 0.6; }); cloths.forEach(({ geo, ox, s }) => { const pos = geo.attributes.position; for (let i = 0; i < pos.count; i++) { const y = ox[i * 3 + 1]; pos.setZ(i, Math.sin(ox[i * 3] * 2 + t * 3 - y) * 0.2 * (-y / 3.4)); } pos.needsUpdate = true; }); aura.material.opacity = 0.05 + Math.sin(t * 2.1) * 0.02; };
  return g;
}

// ================================================================== 9. haunted tree
export function makeHauntedTree(def = {}) {
  const g = new THREE.Group(), r = rng(def.seed || 9), BARK = 0x2a2220, BARK_L = 0x3a2e2a, tips = [], swing = [], eyes = [], lamps = [], crows = [];
  cyl(g, 4.6, 5.0, 0.4, 0x1f2a24, 0, 0.2, 0, 12);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28; rod(g, [Math.cos(a) * 0.6, 1.2, Math.sin(a) * 0.6], [Math.cos(a) * 2.8, 0.3, Math.sin(a) * 2.8], 0.28, BARK_L, 5); }
  let px = 0, pz = 0, y = 0.2; for (let k = 0; k < 6; k++) { const nx = Math.sin(k * 1.3) * 0.3, nz = Math.cos(k * 1.1) * 0.25, h = 1.4; rod(g, [px, y, pz], [nx, y + h, nz], 1.0 - k * 0.1, k % 2 ? BARK : BARK_L, 7); px = nx; pz = nz; y += h; }
  const branch = (sx, sy, sz, dx, dy, dz, len, rad, depth) => { const ex = sx + dx * len, ey = sy + dy * len, ez = sz + dz * len; rod(g, [sx, sy, sz], [ex, ey, ez], rad, BARK, 5); if (depth > 0) for (let k = 0; k < 2 + (depth > 1 ? 1 : 0); k++) { const a = r() * 6.28, bx = dx * 0.6 + Math.cos(a) * 0.7, bz = dz * 0.6 + Math.sin(a) * 0.7, by = dy * 0.5 + 0.35 + r() * 0.3, m = Math.hypot(bx, by, bz); branch(ex, ey, ez, bx / m, by / m, bz / m, len * 0.72, rad * 0.62, depth - 1); } else tips.push([ex, ey, ez]); };
  for (let k = 0; k < 5; k++) { const a = k * 1.26 + 0.3; branch(Math.sin(a * 0.2) * 0.2, 6.2 + (k % 2) * 0.8, 0, Math.cos(a) * 0.8, 0.5, Math.sin(a) * 0.8, 2.6, 0.4, 2); }
  const face = egg(g, 0.55, 0.9, 0.3, 0x0a0706, 0, 2.6, 0.95); for (const s of [-1, 1]) eyes.push(add(g, new THREE.Mesh(new THREE.SphereGeometry(0.14, 7, 5), lit(GREEN, 2)), s * 0.28, 3.2, 1.1)); egg(g, 0.3, 0.2, 0.2, 0x0a0706, 0, 2.0, 1.05);
  tips.slice(0, 9).forEach(([x, yy, z], i) => { const pv = new THREE.Group(); add(g, pv, x, yy, z); rod(pv, [0, 0, 0], [0, -1.2, 0], 0.02, 0x6b5a3a, 3); if (i % 3 === 0) skull(pv, 0, -1.5, 0, 0.5, i === 0 ? GREEN : null, eyes); else { lamps.push(add(pv, new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), lit(GREEN, 1.7)), 0, -1.4, 0)); } swing.push({ pv, ph: i * 1.3 }); });
  tips.slice(9, 12).forEach(([x, yy, z], i) => { const c = new THREE.Group(); add(g, c, x, yy + 0.1, z); egg(c, 0.3, 0.25, 0.2, 0x15151b, 0, 0.25, 0); const h = new THREE.Group(); add(c, h, 0.28, 0.5, 0); ball(h, 0.14, 0x15151b, 0, 0, 0); cone(h, 0.06, 0.22, 0xe08a1f, 0.18, 0, 0, 4).rotation.z = -Math.PI / 2; ball(h, 0.04, 0xff3030, 0.06, 0.05, 0.1); crows.push({ h, ph: i * 2 }); });
  const fog = puffs(g, 8, 0, 0.6, 0, 0xcfe8e0, 0.18, 1.0); fog.forEach((f, i) => { f.x = Math.cos(i * 0.8) * (1.5 + (i % 3) * 1.1); f.z = Math.sin(i * 0.8) * (1.5 + (i % 3) * 1.1); });
  g.userData.tick = (t) => { swing.forEach(({ pv, ph }) => { pv.rotation.z = Math.sin(t * 1.1 + ph) * 0.14; pv.rotation.x = Math.cos(t * 0.9 + ph) * 0.1; }); eyes.forEach((e, i) => { e.material.emissiveIntensity = 1.6 + Math.sin(t * 3 + i) * 0.6; }); lamps.forEach((l, i) => { l.material.emissiveIntensity = 1.5 + Math.sin(t * 6 + i * 2) * 0.4; }); crows.forEach(({ h, ph }) => { h.rotation.z = Math.max(0, Math.sin(t * 2 + ph)) * -0.7; h.rotation.y = Math.sin(t * 0.7 + ph) * 0.6; }); stepPuffs(fog, t, 0.5, 0.1, 1.2, 1.2); };
  return g;
}

// ================================================================== 10. maelstrom whirlpool (sea)
export function makeMaelstrom() {
  const g = new THREE.Group(), arms = new THREE.Group(), debris = []; g.add(arms);
  const funnel = add(g, new THREE.Mesh(new THREE.ConeGeometry(5.4, 4.0, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x0f4a63, emissive: 0x08334a, emissiveIntensity: 0.6, transparent: true, opacity: 0.85, side: THREE.DoubleSide, flatShading: true })), 0, -1.9, 0); funnel.rotation.x = Math.PI;
  add(g, new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.1, 14), lit(0x1fffa0, 0.9, { transparent: true, opacity: 0.9 })), 0, -3.6, 0);
  for (let j = 0; j < 3; j++) for (let k = 0; k < 18; k++) { const a = (j / 3) * 6.28 + k * 0.3, rad = 1.0 + k * 0.28, y = -3.3 + (k / 18) * 3.3; const m = box(arms, 1.0 - k * 0.02, 0.14, 0.36, k % 3 === 0 ? 0xffffff : (k % 2 ? 0x2fa8c8 : 0x1c7fa0), Math.cos(a) * rad, y + 0.05, Math.sin(a) * rad); m.rotation.y = -a - Math.PI / 2 - 0.2; }
  for (let i = 0; i < 8; i++) { const m = new THREE.Group(); add(g, m, 0, 0, 0); const kind = i % 4; if (kind === 0) box(m, 1.8, 0.16, 0.4, 0x6b4a2b, 0, 0, 0); else if (kind === 1) { cyl(m, 0.4, 0.4, 0.8, 0x8a5a33, 0, 0, 0, 8); cyl(m, 0.42, 0.42, 0.07, 0x2a2d34, 0, 0.2, 0, 8); } else if (kind === 2) skull(m, 0, 0, 0, 0.6); else { box(m, 0.9, 0.9, 0.9, 0x8a5a33, 0, 0, 0); } debris.push({ m, ph: i / 8, a0: i * 0.9 }); }
  const ring = add(g, new THREE.Mesh(new THREE.TorusGeometry(5.6, 0.18, 5, 36), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 })), 0, 0.05, 0); ring.rotation.x = Math.PI / 2;
  const beamG = add(g, glowCol(0x1fffa0, 7, 0.5, 1.2, 0.08), 0, 0.5, 0);
  g.userData.tick = (t) => { arms.rotation.y = t * 0.9; ring.scale.setScalar(1 + Math.sin(t * 1.5) * 0.03); beamG.material.opacity = 0.07 + Math.sin(t * 2.4) * 0.03; debris.forEach(({ m, ph, a0 }, i) => { const k = (t * 0.1 + ph) % 1, rad = 5.0 * (1 - k) + 0.6, a = a0 + t * 0.9 + k * 7; m.position.set(Math.cos(a) * rad, -k * 3.0 + 0.1, Math.sin(a) * rad); m.rotation.y = a * 2; m.rotation.z = Math.sin(t * 2 + i) * 0.3; m.scale.setScalar(1 - k * 0.6); }); };
  return g;
}

// ------------------------------------------------------------------ registry
export const HAUNTED_MAKERS = {
  skeleton_fort: makeSkeletonFort, ghost_ship: makeGhostShip, gibbet_cages: makeGibbetCages, siren_shrine: makeSirenShrine, volcano: makeVolcano,
  bone_throne: makeBoneThrone, graveyard: makeGraveyard, reaper_totem: makeReaperTotem, haunted_tree: makeHauntedTree, maelstrom: makeMaelstrom,
};

export const HAUNTED_CATALOG = [
  {
    category: 'Cursed Pirate Strongholds',
    items: [
      { type: 'skeleton_fort', name: 'Skeleton Fort', icon: '💀', desc: 'Bone-spiked stone fortress with a giant skull gate, green-flame towers and a skull-pile bonfire', defaultProps: { scale: 1.0 } },
      { type: 'bone_throne', name: 'Bone Throne', icon: '👑', desc: 'Rib-fan throne topped by a red-eyed skull in a captain\'s hat, with candles and skulls', defaultProps: { scale: 1.0 } },
      { type: 'reaper_totem', name: 'Reaper Totem', icon: '☠️', desc: 'Tall pole of glowing skulls with a horned reaper head, tattered banners and hooks', defaultProps: { scale: 1.0 } },
    ],
  },
  {
    category: 'Haunted Grounds',
    items: [
      { type: 'graveyard', name: 'Pirate Graveyard', icon: '🪦', desc: 'Fenced cemetery with tombstones, a glowing open coffin, a rising skeleton hand and creeping fog', defaultProps: { scale: 1.0, seed: 7 } },
      { type: 'haunted_tree', name: 'Haunted Tree', icon: '🌳', desc: 'Dead tree with a glowing face, swinging ghost lanterns, hanging skulls and crows', defaultProps: { scale: 1.0, seed: 9 } },
      { type: 'gibbet_cages', name: 'Gibbet Cages', icon: '⛓️', desc: 'Gallows frame with three swinging cages of skeletons, chains and watching crows', defaultProps: { scale: 1.0 } },
      { type: 'siren_shrine', name: 'Siren Shrine', icon: '🧜', desc: 'Eerie stone siren on a flooded altar with glowing teal runes, orbiting pearls and a floating orb', defaultProps: { scale: 1.0 } },
      { type: 'volcano', name: 'Erupting Volcano', icon: '🌋', desc: 'Smoking volcano with glowing lava streams, flying fireballs and obsidian spikes', defaultProps: { scale: 1.0 } },
    ],
  },
  {
    category: 'Sea Curses',
    items: [
      { type: 'ghost_ship', name: 'Ghost Ship Wreck', icon: '👻', desc: 'Half-sunk spectral ship with torn sails, green lanterns, a skeleton helmsman and drifting mist', defaultProps: { scale: 1.0 }, water: true },
      { type: 'maelstrom', name: 'Maelstrom', icon: '🌀', desc: 'Swirling whirlpool with foaming spiral arms, a glowing abyss and debris spiralling in', defaultProps: { scale: 1.0 }, water: true },
    ],
  },
];
