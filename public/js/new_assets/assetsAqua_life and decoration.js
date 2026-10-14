import * as THREE from 'three';

// 20 aquatic-life assets for the Island Resort map editor, in the same bright, chunky, cartoon low-poly style as
// windmill / fountain / market stall / crystals. Same contract as assets.js: makeXxx(def) -> THREE.Group on y = 0
// (makeAsset scales, rotates, positions it). Animated ones set group.userData.tick(t). Self-contained: only needs 'three'.
// Hook-up: AQUA_MAKERS (type -> builder) and AQUA_CATALOG (palette entries) at the bottom.
// Sea-surface pieces are marked water:true in the catalog: place them at sea level (y = 0).

// ------------------------------------------------------------------ helpers
const flat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.75, ...extra });
const add = (p, m, x = 0, y = 0, z = 0) => { m.position.set(x, y, z); p.add(m); return m; };
const box = (p, w, h, d, c, x, y, z) => add(p, new THREE.Mesh(new THREE.BoxGeometry(w, h, d), flat(c)), x, y, z);
const cyl = (p, rt, rb, h, c, x, y, z, seg = 9) => add(p, new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), flat(c)), x, y, z);
const ball = (p, r, c, x, y, z, extra = {}) => add(p, new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), flat(c, extra)), x, y, z);
const egg = (p, sx, sy, sz, c, x, y, z, extra = {}) => { const m = ball(p, 1, c, x, y, z, extra); m.scale.set(sx, sy, sz); return m; };
const cone = (p, r, h, c, x, y, z, seg = 6) => add(p, new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), flat(c)), x, y, z);
const glass = (c, em, op = 0.7) => new THREE.MeshStandardMaterial({ color: c, emissive: em, emissiveIntensity: 0.6, transparent: true, opacity: op, flatShading: true, roughness: 0.3, side: THREE.DoubleSide });
const rng = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
function rod(p, a, b, r, c, seg = 5) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), d = vb.clone().sub(va), len = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), flat(c));
  m.position.copy(va).add(vb).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); p.add(m); return m;
}
const ripple = (p, r, x = 0, z = 0, op = 0.5) => { const m = add(p, new THREE.Mesh(new THREE.TorusGeometry(r, 0.07, 4, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: op, depthWrite: false })), x, 0.06, z); m.rotation.x = Math.PI / 2; return m; };
const eyes = (p, x, y, z, s = 0.2, gap = 0.5) => { for (const k of [-1, 1]) { ball(p, s, 0xffffff, x + k * gap, y, z); ball(p, s * 0.55, 0x15202b, x + k * gap, y, z + s * 0.62); } };
function starGeo(ro, ri, depth) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = (i * Math.PI) / 5 - Math.PI / 2, r = i % 2 ? ri : ro; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }); g.rotateX(-Math.PI / 2); return g;
}
// a small cartoon fish facing +z (tail at -z); returns { g, tail }
function fish(p, c, c2, size = 1) {
  const g = new THREE.Group(); p.add(g); g.scale.setScalar(size);
  egg(g, 0.34, 0.4, 0.8, c, 0, 0, 0); const tail = new THREE.Group(); add(g, tail, 0, 0, -0.7);
  const t = cone(tail, 0.34, 0.7, c2, 0, 0, -0.3, 3); t.rotation.x = -Math.PI / 2; t.scale.x = 0.25;
  cone(g, 0.12, 0.4, c2, 0, 0.42, 0.0, 3).scale.x = 0.3; ball(g, 0.08, 0xffffff, 0.27, 0.1, 0.45); ball(g, 0.08, 0xffffff, -0.27, 0.1, 0.45); ball(g, 0.045, 0x15202b, 0.31, 0.1, 0.48); ball(g, 0.045, 0x15202b, -0.31, 0.1, 0.48);
  return { g, tail };
}
const CORALS = [0xff7a3d, 0xb47cf2, 0xffd23f, 0xff5a6a, 0x3fd1c4], SAND = 0xf2e0a8, ROCK = 0x8fa3b8, ROCK2 = 0x7a8ea4;

// ================================================================== 1. coral reef
export function makeCoralReef(def = {}) {
  const g = new THREE.Group(), r = rng(def.seed || 21), sway = [];
  cyl(g, 4.4, 4.8, 0.3, SAND, 0, 0.1, 0, 14);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28, rk = add(g, new THREE.Mesh(new THREE.DodecahedronGeometry(0.9 + r() * 0.4, 0), flat(i % 2 ? ROCK : ROCK2)), Math.cos(a) * 3.4, 0.5, Math.sin(a) * 3.4); rk.scale.y = 0.7; }
  const branch = (x, z, h, c) => { const b = new THREE.Group(); add(g, b, x, 0.2, z); cyl(b, 0.2, 0.32, h, c, 0, h / 2, 0, 6); for (const [dx, dh, rz] of [[-0.5, 0.55, 0.7], [0.5, 0.7, -0.6], [0, 0.85, 0.05]]) { const arm = new THREE.Group(); add(b, arm, 0, h * dh, 0); arm.rotation.z = rz; cyl(arm, 0.13, 0.2, h * 0.6, c, 0, h * 0.3, 0, 6); ball(arm, 0.2, c, 0, h * 0.62, 0); } ball(b, 0.24, c, 0, h + 0.05, 0); sway.push(b); };
  branch(-1.6, 0.6, 2.8, CORALS[0]); branch(0.6, -1.3, 3.4, CORALS[2]); branch(1.9, 0.9, 2.4, CORALS[1]); branch(-0.4, 1.8, 2.0, CORALS[3]);
  const brain = egg(g, 1.1, 0.8, 1.1, CORALS[3], 2.4, 0.7, -1.2); for (let k = 0; k < 3; k++) add(g, new THREE.Mesh(new THREE.TorusGeometry(0.55 + k * 0.2, 0.05, 4, 12, 4), flat(0xc73a49)), 2.4, 1.0 + k * 0.0, -1.2).rotation.x = Math.PI / 2;
  const fan = add(g, new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.12, 14, 1, false, 0, Math.PI), flat(CORALS[1], { side: THREE.DoubleSide })), -2.4, 1.8, -1.0); fan.rotation.x = Math.PI / 2; fan.rotation.z = 0.4;
  for (let k = 0; k < 4; k++) cyl(g, 0.17, 0.2, 1.0 + k * 0.25, CORALS[4], -0.5 + k * 0.4, 0.7 + k * 0.12, -2.4 + (k % 2) * 0.3, 7), cyl(g, 0.12, 0.12, 0.05, 0x1d6b66, -0.5 + k * 0.4, 1.2 + k * 0.25, -2.4 + (k % 2) * 0.3, 7);
  // tick disabled: (t) => sway.forEach((b, i) => { b.rotation.z = Math.sin(t * 1.2 + i) * 0.05; b.rotation.x = Math.cos(t + i * 2) * 0.04; });
  return g;
}

// ================================================================== 2. kelp forest
export function makeKelpForest(def = {}) {
  const g = new THREE.Group(), r = rng(def.seed || 22), strands = [];
  for (let i = 0; i < 4; i++) { const a = i * 1.7; add(g, new THREE.Mesh(new THREE.DodecahedronGeometry(0.8 + r() * 0.3, 0), flat(i % 2 ? ROCK : ROCK2)), Math.cos(a) * 2.2, 0.3, Math.sin(a) * 2.2).scale.y = 0.6; }
  for (let i = 0; i < 9; i++) {
    const a = r() * 6.28, d = r() * 2.6, base = new THREE.Group(); add(g, base, Math.cos(a) * d, 0.15, Math.sin(a) * d); const segs = [], len = 6 + Math.floor(r() * 3); let parent = base;
    for (let k = 0; k < len; k++) { const s = new THREE.Group(); parent.add(s); s.position.y = k ? 0.9 : 0; const w = 0.55 - k * 0.03; box(s, w, 0.95, 0.07, i % 3 ? 0x2fb76a : 0x4fd37a, 0, 0.45, 0); if (k % 3 === 2) ball(s, 0.14, 0xffd23f, w * 0.6, 0.5, 0.0); segs.push(s); parent = s; }
    strands.push({ segs, ph: r() * 6 });
  }
  // tick disabled: (t) => strands.forEach(({ segs, ph }) => segs.forEach((s, k) => { s.rotation.z = Math.sin(t * 1.4 + ph + k * 0.5) * 0.14; s.rotation.x = Math.cos(t * 1.1 + ph + k * 0.4) * 0.08; }));
  return g;
}

// ================================================================== 3. jellyfish swarm
export function makeJellyfishSwarm() {
  const g = new THREE.Group(), meds = [];
  [[-2.2, 2.6, 0.6, 0xb59cff, 0x6a4cff, 1.0], [1.8, 3.4, -0.8, 0x7fe8f5, 0x1fb8d6, 0.8], [0.4, 2.0, 2.0, 0xff9ad0, 0xd0388a, 0.9], [2.6, 2.4, 1.6, 0xa0ffd0, 0x20c070, 0.65]].forEach(([x, y, z, c, em, s], i) => {
    const m = new THREE.Group(); add(g, m, x, y, z); m.scale.setScalar(s);
    const bell = add(m, new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), glass(c, em)), 0, 0, 0); bell.scale.y = 0.85;
    add(m, new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: em, emissiveIntensity: 1.2, transparent: true, opacity: 0.8 })), 0, 0.25, 0);
    const tents = [];
    for (let k = 0; k < 7; k++) { const a = (k / 7) * 6.28, pv = new THREE.Group(); add(m, pv, Math.cos(a) * 0.85, 0, Math.sin(a) * 0.85); cyl(pv, 0.07, 0.03, 2.0 + (k % 3) * 0.4, c, 0, -1.1, 0, 5); tents.push(pv); }
    meds.push({ m, bell, tents, y, ph: i * 1.7 });
  });
  // tick disabled: (t) => meds.forEach(({ m, bell, tents, y, ph }) => { m.position.y = y + Math.sin(t * 0.9 + ph) * 0.4; const p = Math.sin(t * 2.2 + ph); bell.scale.set(1 + p * 0.06, 0.85 - p * 0.08, 1 + p * 0.06); tents.forEach((tn, k) => { tn.rotation.x = Math.sin(t * 2 + ph + k) * 0.18 + p * 0.06; tn.rotation.z = Math.cos(t * 1.7 + ph + k * 1.3) * 0.15; }); });
  return g;
}

// ================================================================== 4. fish school
export function makeFishSchool(def = {}) {
  const g = new THREE.Group(), r = rng(def.seed || 24), list = [], cols = [[0xff8a3d, 0xffd23f], [0xffd23f, 0xff8a3d], [0x4fb8ff, 0xffffff], [0x3fd1c4, 0xffd23f]];
  for (let i = 0; i < 14; i++) { const [c, c2] = cols[i % 4], f = fish(g, c, c2, 0.8 + r() * 0.35); list.push({ ...f, a: (i / 14) * 6.28, rad: 2.2 + r() * 1.8, y: 0.7 + r() * 1.6, sp: 0.5 + r() * 0.2, ph: r() * 6 }); }
  const rp = [ripple(g, 2.6), ripple(g, 4.0, 0, 0, 0.3)];
  // tick disabled: (t) => { list.forEach((f) => { const a = f.a + t * f.sp; f.g.position.set(Math.cos(a) * f.rad, f.y + Math.sin(t * 2 + f.ph) * 0.2, Math.sin(a) * f.rad); f.g.rotation.y = -a; f.tail.rotation.y = Math.sin(t * 9 + f.ph) * 0.5; }); rp[0].scale.setScalar(1 + Math.sin(t * 1.5) * 0.06); rp[1].scale.setScalar(1 + Math.cos(t * 1.2) * 0.06); };
  return g;
}

// ================================================================== 5. sea turtle
export function makeSeaTurtle() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body); const GREEN = 0x4fc25a, DARK = 0x2e8b43, SKIN = 0xa8d86e;
  const shell = add(body, new THREE.Mesh(new THREE.SphereGeometry(1.7, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), flat(GREEN)), 0, 0.2, 0); shell.scale.set(1, 0.75, 1.25);
  for (const [x, z] of [[0, 0], [0.9, 0.6], [-0.9, 0.6], [0.9, -0.7], [-0.9, -0.7], [0, 1.4], [0, -1.5]]) { const p = add(body, new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 0), flat(DARK)), x, 1.05 - Math.hypot(x * 0.4, z * 0.3) * 0.35, z); p.scale.y = 0.4; }
  cyl(body, 1.75, 1.8, 0.2, 0xf4e6b8, 0, 0.1, 0, 12).scale.z = 1.25;
  egg(body, 0.55, 0.5, 0.6, SKIN, 0, 0.6, 2.5); eyes(body, 0, 0.85, 2.85, 0.14, 0.32); cone(body, 0.12, 0.3, SKIN, 0, 0.35, 3.0, 4).rotation.x = Math.PI / 2;
  cyl(body, 0.25, 0.4, 0.5, SKIN, 0, 0.3, 2.1, 6).rotation.x = Math.PI / 2;
  const fl = [];
  for (const s of [-1, 1]) { const f = new THREE.Group(); add(body, f, s * 1.6, 0.35, 1.0); egg(f, 1.15, 0.12, 0.5, SKIN, s * 0.9, 0, 0.1); fl.push([f, s]); const b = new THREE.Group(); add(body, b, s * 1.2, 0.3, -1.5); egg(b, 0.55, 0.1, 0.35, SKIN, s * 0.45, 0, -0.1); fl.push([b, s * 0.5]); }
  cone(body, 0.2, 0.7, SKIN, 0, 0.3, -2.3, 4).rotation.x = -Math.PI / 2;
  const rp = ripple(g, 2.7, 0, 0.3);
  // tick disabled: (t) => { body.position.y = Math.sin(t * 1.6) * 0.1; body.rotation.z = Math.sin(t * 0.9) * 0.05; fl.forEach(([f, s], i) => { f.rotation.z = Math.sin(t * 2.2 + (i > 1 ? 1 : 0)) * 0.4 * s; }); rp.scale.setScalar(1 + Math.sin(t * 1.5) * 0.05); };
  return g;
}

// ================================================================== 6. whale with spout
export function makeWhale() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body); const BLUE = 0x4a86e0, CREAM = 0xeaf4ff;
  egg(body, 1.9, 1.7, 4.4, BLUE, 0, 0.1, 0); egg(body, 1.75, 1.0, 4.1, CREAM, 0, -0.65, 0.2);
  for (const s of [-1, 1]) { ball(body, 0.26, 0xffffff, s * 1.45, 0.5, 3.0); ball(body, 0.14, 0x15202b, s * 1.5, 0.5, 3.2); ball(body, 0.2, 0xff9ab0, s * 1.2, -0.15, 3.3, { transparent: true, opacity: 0.5 }); const fn = egg(body, 0.2, 0.15, 1.1, BLUE, s * 1.8, -0.6, 1.2); fn.rotation.z = s * -0.5; fn.rotation.y = s * 0.4; }
  box(body, 0.1, 0.1, 1.5, 0x15202b, 0, -0.12, 4.0);
  const tail = new THREE.Group(); add(body, tail, 0, 0.3, -4.0); egg(tail, 0.9, 0.8, 1.9, BLUE, 0, 0.2, -1.2);
  const fluke = new THREE.Group(); add(tail, fluke, 0, 0.7, -2.6); for (const s of [-1, 1]) { const f = egg(fluke, 1.5, 0.12, 0.75, BLUE, s * 1.3, 0.4, -0.1); f.rotation.z = s * 0.25; }
  const blow = add(body, new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.2, 7), flat(0x2f5fae)), 0, 1.85, 2.0);
  const drops = Array.from({ length: 9 }, (_, i) => ({ m: add(g, new THREE.Mesh(new THREE.SphereGeometry(0.28, 7, 5), new THREE.MeshStandardMaterial({ color: 0xcfeeff, emissive: 0x6fb8ff, emissiveIntensity: 0.4, transparent: true, opacity: 0.8 })), 0, 2, 2), ph: i / 9 }));
  const rp = ripple(g, 5.2, 0, 0, 0.35);
  // tick disabled: (t) => { body.position.y = Math.sin(t * 0.9) * 0.18; body.rotation.x = Math.sin(t * 0.9 + 1) * 0.03; tail.rotation.x = Math.sin(t * 1.4) * 0.12; fluke.rotation.x = Math.sin(t * 1.4 - 0.8) * 0.25; drops.forEach((d, i) => { const k = (t * 0.45 + d.ph) % 1, hh = k * (1.5 - k); d.m.position.set(Math.sin(i * 2.4) * 0.9 * k, 2.1 + body.position.y + hh * 4.2, 2.0 + Math.cos(i * 1.7) * 0.9 * k); d.m.scale.setScalar(Math.max(0.1, 1 - k * 0.7)); d.m.material.opacity = 0.85 * (1 - k * k); }); rp.scale.setScalar(1 + Math.sin(t * 1.2) * 0.04); };
  return g;
}

// ================================================================== 7. leaping dolphins
export function makeDolphinPair() {
  const g = new THREE.Group(), GREY = 0x6fa8dc, dols = [], rings = [];
  const dolphin = () => { const d = new THREE.Group(); egg(d, 1.25, 0.45, 0.45, GREY, 0, 0, 0); egg(d, 1.1, 0.3, 0.38, 0xeaf4ff, 0.05, -0.2, 0); egg(d, 0.5, 0.42, 0.42, GREY, 1.0, 0.05, 0); rod(d, [1.2, -0.02, 0], [1.95, -0.05, 0], 0.15, GREY, 6); cone(d, 0.22, 0.6, GREY, 0.1, 0.55, 0, 4).rotation.z = -0.5; for (const s of [-1, 1]) { egg(d, 0.35, 0.06, 0.2, GREY, 0.7, -0.25, s * 0.45).rotation.y = s * 0.5; egg(d, 0.35, 0.06, 0.28, GREY, -1.5, 0.0, s * 0.3); ball(d, 0.07, 0x15202b, 1.15, 0.2, s * 0.33); } return d; };
  [[1.6, 0], [-1.6, 0.5]].forEach(([z, ph]) => { const d = dolphin(); add(g, d, 0, -2, z); dols.push({ d, z, ph }); });
  [[-3.6, 1.6], [3.6, 1.6], [-3.6, -1.6], [3.6, -1.6]].forEach(([x, z]) => rings.push({ m: ripple(g, 0.8, x, z, 0.5), x, z }));
  // tick disabled: (t) => {
    dols.forEach(({ d, z, ph }) => { const u = (t * 0.4 + ph) % 1; if (u < 0.7) { const s = u / 0.7; d.visible = true; d.position.set(-3.6 + s * 7.2, -0.3 + 3.9 * Math.sin(Math.PI * s), z); d.rotation.z = Math.atan2(3.9 * Math.PI * Math.cos(Math.PI * s), 7.2); } else d.visible = false; });
    rings.forEach((r, i) => { const dd = dols[i % 2], u = (t * 0.4 + dd.ph) % 1, near = i < 2 ? Math.min(u, 1 - u) : Math.abs(u - 0.7); const k = Math.max(0, 1 - near * 5); r.m.scale.setScalar(0.4 + (1 - k) * 1.2); r.m.material.opacity = 0.55 * k; });
  };
  return g;
}

// ================================================================== 8. patrolling shark
export function makeShark() {
  const g = new THREE.Group(), s = new THREE.Group(); g.add(s); const GREY = 0x7d93ad;
  egg(s, 0.8, 0.75, 2.4, GREY, 0, 0.1, 0); egg(s, 0.7, 0.45, 2.2, 0xf1f6fb, 0, -0.35, 0.1);
  cone(s, 0.45, 1.5, GREY, 0, 1.05, -0.1, 3).scale.x = 0.25; const tail = new THREE.Group(); add(s, tail, 0, 0.1, -2.3);
  const up = cone(tail, 0.35, 1.5, GREY, 0, 0.6, -0.3, 3); up.rotation.x = -0.5; up.scale.x = 0.25; const lo = cone(tail, 0.25, 0.9, GREY, 0, -0.4, -0.2, 3); lo.rotation.x = Math.PI + 0.5; lo.scale.x = 0.25;
  for (const k of [-1, 1]) { const f = cone(s, 0.3, 1.1, GREY, k * 0.9, -0.2, 0.6, 3); f.rotation.z = k * 1.2; f.scale.z = 0.3; ball(s, 0.13, 0xffffff, k * 0.55, 0.3, 1.9); ball(s, 0.07, 0x15202b, k * 0.58, 0.3, 2.02); }
  box(s, 0.9, 0.08, 0.1, 0x8a1f2a, 0, -0.12, 2.15); for (let i = -2; i <= 2; i++) cone(s, 0.05, 0.14, 0xffffff, i * 0.15, -0.06, 2.2, 3).rotation.x = Math.PI;
  const wake = ripple(g, 1.4, 0, 0, 0.35);
  // tick disabled: (t) => { const a = t * 0.55, R = 4.0; s.position.set(Math.cos(a) * R, Math.sin(t * 1.5) * 0.08, Math.sin(a) * R); s.rotation.y = -a; tail.rotation.y = Math.sin(t * 4) * 0.35; wake.position.set(Math.cos(a - 0.35) * R, 0.06, Math.sin(a - 0.35) * R); wake.scale.setScalar(1 + Math.sin(t * 3) * 0.1); };
  return g;
}

// ================================================================== 9. manta ray
export function makeMantaRay() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const wing = (s) => { const sh = new THREE.Shape(); sh.moveTo(0, -1.2); sh.lineTo(s * 3.4, 0.3); sh.lineTo(0, 1.0); sh.closePath(); const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.3, bevelEnabled: false }); geo.rotateX(-Math.PI / 2); const w = new THREE.Group(); body.add(w); add(w, new THREE.Mesh(geo, flat(0x2f4b8f)), 0, 0, 0); add(w, new THREE.Mesh(geo.clone(), flat(0xeaf1ff)), 0, -0.14, 0).scale.y = 0.5; return w; };
  const wl = wing(-1), wr = wing(1);
  egg(body, 0.8, 0.3, 1.1, 0x2f4b8f, 0, 0.15, 0.1); for (const s of [-1, 1]) { cone(body, 0.2, 0.8, 0x2f4b8f, s * 0.45, 0.1, 1.5, 4).rotation.x = Math.PI / 2; ball(body, 0.14, 0xffffff, s * 0.5, 0.35, 0.7); ball(body, 0.07, 0x15202b, s * 0.52, 0.35, 0.8); }
  rod(body, [0, 0.1, -0.9], [0, 0.0, -4.2], 0.08, 0x2f4b8f, 5);
  for (const [x, z] of [[-0.9, 0.1], [0.9, -0.2], [0.0, -0.5], [-1.6, -0.1], [1.7, 0.0]]) ball(body, 0.12, 0xffffff, x, 0.32, z);
  const rp = ripple(g, 3.3, 0, 0, 0.3);
  // tick disabled: (t) => { body.position.y = 0.35 + Math.sin(t * 1.4) * 0.18; body.rotation.z = Math.sin(t * 0.7) * 0.05; wl.rotation.z = -Math.sin(t * 2.2) * 0.22; wr.rotation.z = Math.sin(t * 2.2) * 0.22; rp.scale.setScalar(1 + Math.sin(t * 1.4) * 0.05); };
  return g;
}

// ================================================================== 10. starfish cluster
export function makeStarfishCluster(def = {}) {
  const g = new THREE.Group(), r = rng(def.seed || 30);
  cyl(g, 3.6, 3.9, 0.25, SAND, 0, 0.12, 0, 12);
  [[-1.4, -0.8, 1.1, 0xff7a3d], [1.3, -0.4, 0.9, 0xff5a6a], [0.1, 1.5, 1.0, 0xffd23f], [-2.0, 1.1, 0.6, 0xb47cf2], [2.2, 1.4, 0.55, 0xff7a3d], [0.3, -0.5, 0.5, 0x3fd1c4]].forEach(([x, z, s, c]) => {
    const st = add(g, new THREE.Mesh(starGeo(1.0 * s, 0.45 * s, 0.28), flat(c)), x, 0.25, z); st.rotation.y = r() * 6;
    for (let k = 0; k < 5; k++) { const a = (k / 5) * 6.28 + st.rotation.y; ball(g, 0.07 * s + 0.03, 0xfff0d0, x + Math.cos(a) * 0.55 * s, 0.56, z + Math.sin(a) * 0.55 * s); }
    ball(g, 0.14 * s + 0.05, 0xfff0d0, x, 0.58, z);
  });
  for (const [x, z, c] of [[2.6, -1.4, 0xf4d6c0], [-2.6, -1.6, 0xe8f0ff], [1.0, 2.6, 0xfff0d0]]) { const sh = add(g, new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6, 0, 6.28, 0, 1.6), flat(c)), x, 0.3, z); sh.scale.set(1, 0.7, 0.9); }
  for (let i = 0; i < 7; i++) add(g, new THREE.Mesh(new THREE.DodecahedronGeometry(0.2 + r() * 0.15, 0), flat(ROCK)), -3 + r() * 6, 0.3, -2.5 + r() * 5).scale.y = 0.6;
  return g;
}

// ================================================================== 11. giant clam with pearl
export function makeGiantClam() {
  const g = new THREE.Group(), CREAM = 0xfff0d6, PEACH = 0xffc79a;
  const half = (parent, lid) => { for (let i = 0; i < 10; i++) { const m = add(parent, new THREE.Mesh(new THREE.SphereGeometry(2.3, 4, 8, (i / 10) * 6.283, 0.6283, lid ? 0 : Math.PI / 2, Math.PI / 2), flat(i % 2 ? CREAM : PEACH, { side: THREE.DoubleSide })), 0, 0, 0); m.scale.y = 0.55; } };
  const bowl = new THREE.Group(); add(g, bowl, 0, 1.0, 0); half(bowl, false);
  cyl(g, 1.9, 1.7, 0.2, 0xb36bff, 0, 1.0, 0, 14).material = flat(0xb36bff, { emissive: 0x6a2fb8, emissiveIntensity: 0.4 });
  const mantle = add(g, new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.28, 6, 18), flat(0x2fd1c4, { emissive: 0x0b7a73, emissiveIntensity: 0.4 })), 0, 1.15, 0); mantle.rotation.x = Math.PI / 2;
  const pearl = add(g, new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xbfe6ff, emissiveIntensity: 0.7, roughness: 0.15 })), 0, 1.7, 0);
  const hinge = new THREE.Group(); add(g, hinge, 0, 1.0, -2.0); const lidMesh = new THREE.Group(); add(hinge, lidMesh, 0, 0, 2.0); half(lidMesh, true);
  for (let i = 0; i < 5; i++) add(g, new THREE.Mesh(new THREE.DodecahedronGeometry(0.5 + (i % 2) * 0.2, 0), flat(i % 2 ? ROCK : ROCK2)), Math.cos(i * 1.3 + 0.5) * 3.3, 0.4, Math.sin(i * 1.3 + 0.5) * 3.0).scale.y = 0.65;
  const bubbles = [0, 1, 2, 3].map((i) => ({ m: add(g, new THREE.Mesh(new THREE.SphereGeometry(0.14, 7, 5), new THREE.MeshStandardMaterial({ color: 0xdff6ff, transparent: true, opacity: 0.7 })), 0, 2, 0), ph: i / 4 }));
  // tick disabled: (t) => { const c = Math.max(0, Math.sin(t * 0.7)); hinge.rotation.x = -(1.15 - c * 0.9); pearl.material.emissiveIntensity = 0.6 + Math.sin(t * 2.5) * 0.3; pearl.position.y = 1.7 + Math.sin(t * 1.6) * 0.06; bubbles.forEach((b, i) => { const k = (t * 0.35 + b.ph) % 1; b.m.position.set(Math.sin(i * 2 + t) * 0.5, 2.2 + k * 3, Math.cos(i * 2) * 0.4); b.m.scale.setScalar(1 - k * 0.5); b.m.material.opacity = 0.7 * (1 - k); }); };
  return g;
}

// ================================================================== 12. cheerful octopus
export function makeOctopus() {
  const g = new THREE.Group(), ORANGE = 0xff6a4d, tents = [];
  for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28; add(g, new THREE.Mesh(new THREE.DodecahedronGeometry(1.0 + (i % 3) * 0.3, 0), flat(i % 2 ? ROCK : ROCK2)), Math.cos(a) * 2.6, 0.45, Math.sin(a) * 2.6).scale.y = 0.7; }
  cyl(g, 2.2, 2.6, 0.9, ROCK2, 0, 0.45, 0, 8);
  const body = new THREE.Group(); add(g, body, 0, 1.8, 0);
  egg(body, 1.45, 1.55, 1.45, ORANGE, 0, 0.9, 0);
  for (const s of [-1, 1]) { ball(body, 0.42, 0xffffff, s * 0.55, 0.95, 1.2); ball(body, 0.22, 0x15202b, s * 0.55, 0.95, 1.55); ball(body, 0.08, 0xffffff, s * 0.6, 1.02, 1.7); ball(body, 0.2, 0xff9a8a, s * 1.0, 0.5, 1.15, { transparent: true, opacity: 0.6 }); }
  for (let k = 0; k < 5; k++) ball(body, 0.1, 0xffc0a8, -0.8 + k * 0.4, 1.9 - Math.abs(k - 2) * 0.15, 0.3);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28, base = new THREE.Group(); add(body, base, Math.cos(a) * 1.05, 0.1, Math.sin(a) * 1.05); base.rotation.y = -a; let parent = base; const segs = []; for (let k = 0; k < 5; k++) { const rad = 0.42 - k * 0.06, s = new THREE.Group(); parent.add(s); s.position.y = k ? 0.0 : 0; s.position.x = k ? 0.8 : 0; cyl(s, rad * 0.85, rad, 0.9, ORANGE, 0.4, 0, 0, 7).rotation.z = Math.PI / 2; ball(s, rad * 0.35, 0xffd0b8, 0.4, rad * 0.55, 0); segs.push(s); parent = s; } tents.push({ segs, ph: i * 0.8 }); }
  // tick disabled: (t) => { body.position.y = 1.8 + Math.sin(t * 1.2) * 0.1; tents.forEach(({ segs, ph }) => segs.forEach((s, k) => { s.rotation.y = Math.sin(t * 1.5 + ph + k * 0.7) * 0.28; s.rotation.z = (k === 0 ? -0.5 : -0.2) + Math.cos(t * 1.3 + ph + k * 0.6) * 0.2; })); };
  return g;
}

// ================================================================== 13. giant crab
export function makeGiantCrab() {
  const g = new THREE.Group(), RED = 0xf0533a, RED2 = 0xff7a5a;
  cyl(g, 3.4, 3.7, 0.25, SAND, 0, 0.12, 0, 12);
  const crab = new THREE.Group(); add(g, crab, 0, 1.0, 0);
  egg(crab, 1.8, 0.85, 1.3, RED, 0, 0.5, 0); egg(crab, 1.5, 0.45, 1.0, RED2, 0, 0.9, 0.1);
  for (const s of [-1, 1]) { rod(crab, [s * 0.5, 1.1, 0.9], [s * 0.6, 1.8, 1.0], 0.07, RED); ball(crab, 0.26, 0xffffff, s * 0.6, 1.9, 1.0); ball(crab, 0.13, 0x15202b, s * 0.6, 1.9, 1.22); }
  box(crab, 0.8, 0.07, 0.07, 0x7a1f12, 0, 0.5, 1.3);
  const claws = [];
  for (const s of [-1, 1]) { const arm = new THREE.Group(); add(crab, arm, s * 1.7, 0.5, 0.4); rod(arm, [0, 0, 0], [s * 0.7, 0.6, 0.7], 0.2, RED); const claw = new THREE.Group(); add(arm, claw, s * 0.7, 0.6, 0.7); egg(claw, 0.75, 0.55, 0.55, RED2, s * 0.2, 0.2, 0.5); const up = new THREE.Group(); add(claw, up, s * 0.1, 0.5, 0.9); cone(up, 0.2, 0.9, RED2, 0, 0.0, 0.3, 4).rotation.x = Math.PI / 2; const lo = new THREE.Group(); add(claw, lo, s * 0.1, 0.0, 0.9); cone(lo, 0.2, 0.9, RED2, 0, 0.0, 0.3, 4).rotation.x = Math.PI / 2; claws.push({ arm, up, lo, s }); }
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { const z = -0.5 + k * 0.45; rod(crab, [s * 1.4, 0.4, z], [s * 2.5, 0.9, z + 0.2], 0.09, RED); rod(crab, [s * 2.5, 0.9, z + 0.2], [s * 3.0, -0.8, z + 0.3], 0.08, RED); }
  // tick disabled: (t) => { crab.position.y = 1.0 + Math.abs(Math.sin(t * 2)) * 0.06; crab.rotation.y = Math.sin(t * 0.8) * 0.12; claws.forEach(({ arm, up, lo, s }, i) => { arm.rotation.z = s * Math.sin(t * 1.6 + i) * 0.2; const p = (Math.sin(t * 5 + i) + 1) * 0.15; up.rotation.x = -p; lo.rotation.x = p; }); };
  return g;
}

// ================================================================== 14. seahorse pair
export function makeSeahorsePair() {
  const g = new THREE.Group(), horses = [];
  cyl(g, 3.0, 3.3, 0.3, SAND, 0, 0.12, 0, 12);
  [[-1.5, 0xffb02e, 0xff7a3d, 1.0], [1.5, 0x3fd1c4, 0x2a9d8f, 0.8]].forEach(([x, c, c2, s], i) => {
    const h = new THREE.Group(); add(g, h, x, 0.4, 0); h.scale.setScalar(s); h.rotation.y = i ? -0.6 : 0.6; const body = new THREE.Group(); h.add(body);
    [[0, 3.3, 0.4, 0.55], [0, 2.8, 0.1, 0.5], [0, 2.2, -0.05, 0.75], [0, 1.5, -0.05, 0.62], [0, 0.95, -0.2, 0.42], [0, 0.55, -0.55, 0.32]].forEach(([bx, by, bz, br], k) => ball(body, br, k % 2 ? c : c2, bx, by, bz));
    rod(body, [0, 3.3, 0.5], [0, 3.1, 1.4], 0.2, c, 6); ball(body, 0.2, c, 0, 3.1, 1.45);
    for (const k of [-1, 1]) { ball(body, 0.2, 0xffffff, k * 0.4, 3.5, 0.65); ball(body, 0.1, 0x15202b, k * 0.43, 3.5, 0.8); }
    for (let k = 0; k < 3; k++) cone(body, 0.14, 0.45, 0xff5a6a, 0, 3.75 + k * 0.0, 0.2 - k * 0.2, 4).rotation.x = -0.3 - k * 0.2;
    for (let k = 0; k < 5; k++) cone(body, 0.1, 0.35, c2, 0, 2.6 - k * 0.5, -0.55 - (k > 2 ? 0.1 : 0), 4).rotation.x = -Math.PI / 2 * 0.6;
    const tail = add(body, new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.14, 6, 12, Math.PI * 1.5), flat(c2)), 0, 0.2, -0.5); tail.rotation.y = Math.PI / 2; tail.rotation.z = 0.6;
    horses.push({ h, body, ph: i * 2, y: 0.4 });
  });
  for (let i = 0; i < 5; i++) { const b = new THREE.Group(); add(g, b, -3 + i * 1.5, 0.2, -2.2 + (i % 2) * 0.8); for (let k = 0; k < 3; k++) { const bl = box(b, 0.3, 1.6 + k * 0.4, 0.05, 0x3dcb74, (k - 1) * 0.15, 0.9 + k * 0.1, 0); bl.rotation.z = (k - 1) * 0.25; } }
  // tick disabled: (t) => horses.forEach(({ h, body, ph, y }) => { h.position.y = y + Math.sin(t * 1.4 + ph) * 0.25; body.rotation.z = Math.sin(t * 1.1 + ph) * 0.08; body.rotation.x = Math.cos(t * 0.9 + ph) * 0.05; });
  return g;
}

// ================================================================== 15. puffer fish
export function makePufferfish() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body); const Y = 0xffc83d, BELLY = 0xfff2c4, spikes = [];
  const core = egg(body, 1.5, 1.4, 1.5, Y, 0, 1.4, 0); egg(body, 1.3, 0.9, 1.3, BELLY, 0, 0.9, 0.2);
  const N = 30; for (let i = 0; i < N; i++) { const y = 1 - (i / (N - 1)) * 2, rr = Math.sqrt(1 - y * y), a = i * 2.4; const d = new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr); if (d.z > 0.75 && Math.abs(d.x) < 0.7) continue; const sp = cone(body, 0.12, 0.5, 0xff9f1c, d.x * 1.55, 1.4 + d.y * 1.45, d.z * 1.55, 4); sp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()); spikes.push(sp); }
  for (const s of [-1, 1]) { ball(body, 0.42, 0xffffff, s * 0.7, 1.7, 1.2); ball(body, 0.22, 0x15202b, s * 0.72, 1.7, 1.55); ball(body, 0.09, 0xffffff, s * 0.78, 1.78, 1.68); const f = egg(body, 0.5, 0.1, 0.35, 0xff9f1c, s * 1.5, 1.2, 0.2); f.rotation.z = s * 0.3; }
  egg(body, 0.28, 0.14, 0.12, 0xff6a3d, 0, 1.0, 1.45);
  const tail = new THREE.Group(); add(body, tail, 0, 1.4, -1.5); const tf = cone(tail, 0.6, 1.0, 0xff9f1c, 0, 0, -0.4, 3); tf.rotation.x = -Math.PI / 2; tf.scale.x = 0.25;
  const rp = ripple(g, 2.1, 0, 0, 0.4);
  // tick disabled: (t) => { const k = 1 + Math.max(0, Math.sin(t * 1.3)) * 0.14; body.scale.setScalar(k); body.position.y = Math.sin(t * 1.8) * 0.12; tail.rotation.y = Math.sin(t * 6) * 0.35; rp.scale.setScalar(1 + Math.sin(t * 1.8) * 0.06); };
  return g;
}

// ================================================================== 16. anemone & clownfish
export function makeAnemoneClownfish(def = {}) {
  const g = new THREE.Group(), r = rng(def.seed || 33), tents = [], fishes = [];
  for (let i = 0; i < 5; i++) { const a = (i / 5) * 6.28; add(g, new THREE.Mesh(new THREE.DodecahedronGeometry(0.9 + (i % 2) * 0.3, 0), flat(i % 2 ? ROCK : ROCK2)), Math.cos(a) * 1.9, 0.4, Math.sin(a) * 1.9).scale.y = 0.65; }
  cyl(g, 1.5, 1.9, 1.0, 0xb36bff, 0, 0.6, 0, 10);
  for (let i = 0; i < 44; i++) { const a = r() * 6.28, d = Math.sqrt(r()) * 1.5, t = new THREE.Group(); add(g, t, Math.cos(a) * d, 1.1, Math.sin(a) * d); const c = [0xff5aa8, 0xd447c4, 0xff8ac4][i % 3]; cyl(t, 0.07, 0.17, 1.4, c, 0, 0.7, 0, 5); ball(t, 0.14, 0xfff0a0, 0, 1.45, 0); tents.push({ t, ph: r() * 6 }); }
  for (let i = 0; i < 2; i++) { const g2 = new THREE.Group(); g.add(g2); egg(g2, 0.42, 0.5, 0.95, 0xff7a1f, 0, 0, 0); for (const z of [0.35, -0.2]) add(g2, new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.14, 10), flat(0xffffff)), 0, 0, z).rotation.x = Math.PI / 2;
    egg(g2, 0.1, 0.5, 0.3, 0xffffff, 0, 0, -0.7); const tail = new THREE.Group(); add(g2, tail, 0, 0, -0.85); const tf = cone(tail, 0.4, 0.7, 0xff7a1f, 0, 0, -0.3, 3); tf.rotation.x = -Math.PI / 2; tf.scale.x = 0.25; cone(g2, 0.14, 0.5, 0xff7a1f, 0, 0.55, 0.1, 3).scale.x = 0.3; for (const s of [-1, 1]) { ball(g2, 0.1, 0xffffff, s * 0.32, 0.12, 0.62); ball(g2, 0.055, 0x15202b, s * 0.36, 0.12, 0.68); } fishes.push({ g2, tail, ph: i * 3.1 }); }
  // tick disabled: (t) => { tents.forEach(({ t: tn, ph }) => { tn.rotation.z = Math.sin(t * 1.6 + ph) * 0.2; tn.rotation.x = Math.cos(t * 1.3 + ph) * 0.2; }); fishes.forEach(({ g2, tail, ph }) => { const a = t * 0.9 + ph, R = 2.1; g2.position.set(Math.cos(a) * R, 2.2 + Math.sin(t * 2 + ph) * 0.3, Math.sin(a) * R); g2.rotation.y = -a; tail.rotation.y = Math.sin(t * 9 + ph) * 0.5; }); };
  return g;
}

// ================================================================== 17. lily pond
export function makeLilyPond(def = {}) {
  const g = new THREE.Group(), r = rng(def.seed || 34), pads = [], flowers = [];
  const water = add(g, new THREE.Mesh(new THREE.CylinderGeometry(4.3, 4.3, 0.15, 24), glass(0x4fd0e0, 0x1590a8, 0.85)), 0, 0.1, 0);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.28; add(g, new THREE.Mesh(new THREE.DodecahedronGeometry(0.6 + r() * 0.2, 0), flat(i % 2 ? ROCK : ROCK2)), Math.cos(a) * 4.4, 0.25, Math.sin(a) * 4.4).scale.y = 0.6; }
  [[-1.8, -1.2, 1.1], [1.7, -1.5, 1.0], [0.2, 1.9, 1.2], [-2.4, 1.6, 0.8], [2.4, 1.0, 0.9], [-0.2, -0.2, 0.7]].forEach(([x, z, s], i) => { const p = add(g, new THREE.Mesh(new THREE.CylinderGeometry(s, s, 0.1, 14, 1, false, 0.5, 5.4), flat(i % 2 ? 0x3fbf5a : 0x55d46a)), x, 0.24, z); p.rotation.y = r() * 6; pads.push({ p, ph: r() * 6, y: 0.24 }); });
  [[1.7, -1.5, 0xff7ab8], [-2.4, 1.6, 0xffffff], [0.2, 1.9, 0xffe36a]].forEach(([x, z, c], i) => { const f = new THREE.Group(); add(g, f, x, 0.35, z); for (let k = 0; k < 8; k++) { const a = (k / 8) * 6.28, pt = cone(f, 0.22, 0.8, c, Math.cos(a) * 0.35, 0.35, Math.sin(a) * 0.35, 4); pt.rotation.z = -Math.cos(a) * 0.7; pt.rotation.x = Math.sin(a) * 0.7; } ball(f, 0.18, 0xffd23f, 0, 0.3, 0); flowers.push({ f, ph: i }); });
  const frog = new THREE.Group(); add(g, frog, -1.8, 0.35, -1.2); egg(frog, 0.45, 0.32, 0.5, 0x6ccf3c, 0, 0.2, 0); egg(frog, 0.3, 0.25, 0.3, 0xa8f060, 0, 0.0, 0.2); for (const s of [-1, 1]) { ball(frog, 0.17, 0xffffff, s * 0.2, 0.55, 0.3); ball(frog, 0.09, 0x15202b, s * 0.2, 0.57, 0.42); egg(frog, 0.14, 0.08, 0.3, 0x55b82e, s * 0.4, 0.06, -0.1); }
  for (let i = 0; i < 6; i++) { const a = 0.2 + i * 0.5, x = Math.cos(a) * 4.0, z = Math.sin(a) * 4.0; rod(g, [x, 0.2, z], [x * 1.02, 2.4 + (i % 3) * 0.4, z * 1.02], 0.05, 0x3fa85a); cyl(g, 0.12, 0.12, 0.6, 0x8a5a33, x * 1.02, 2.6 + (i % 3) * 0.4, z * 1.02, 6); }
  // tick disabled: (t) => { pads.forEach(({ p, ph, y }) => { p.position.y = y + Math.sin(t * 1.2 + ph) * 0.03; p.rotation.z = Math.sin(t + ph) * 0.03; }); flowers.forEach(({ f, ph }) => { f.scale.setScalar(1 + Math.sin(t * 1.5 + ph) * 0.06); }); frog.position.y = 0.35 + Math.max(0, Math.sin(t * 2.2)) * 0.18; };
  return g;
}

// ================================================================== 18. tide pool
export function makeTidePool(def = {}) {
  const g = new THREE.Group(), r = rng(def.seed || 35);
  cyl(g, 4.2, 4.5, 0.3, SAND, 0, 0.15, 0, 14);
  for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.28, rk = add(g, new THREE.Mesh(new THREE.DodecahedronGeometry(0.8 + r() * 0.35, 0), flat(i % 2 ? ROCK : ROCK2)), Math.cos(a) * 3.0, 0.55, Math.sin(a) * 3.0); rk.scale.y = 0.75; rk.rotation.y = r() * 6; }
  const water = add(g, new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.12, 20), glass(0x58d6e8, 0x1a96ad, 0.9)), 0, 0.42, 0);
  const star = add(g, new THREE.Mesh(starGeo(0.7, 0.3, 0.2), flat(0xff7a3d)), 0.8, 0.52, -0.4); star.rotation.y = 0.5;
  const crab = new THREE.Group(); add(g, crab, -0.8, 0.6, 0.6); egg(crab, 0.4, 0.22, 0.3, 0xf0533a, 0, 0.1, 0); for (const s of [-1, 1]) { ball(crab, 0.1, 0xffffff, s * 0.15, 0.3, 0.2); ball(crab, 0.14, 0xff7a5a, s * 0.45, 0.15, 0.2); rod(crab, [s * 0.3, 0.05, 0], [s * 0.6, -0.1, 0.1], 0.03, 0xf0533a); }
  for (const [x, z, c] of [[1.2, 0.9, 0xf4d6c0], [-1.5, -0.8, 0xe8f0ff]]) { const sh = add(g, new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6, 0, 6.28, 0, 1.6), flat(c)), x, 0.5, z); sh.scale.y = 0.7; }
  for (let i = 0; i < 4; i++) { const a = i * 1.6; cone(g, 0.18, 1.0, 0x3dcb74, Math.cos(a) * 1.9, 0.9, Math.sin(a) * 1.9, 5).rotation.z = 0.15; }
  const sea = [ripple(g, 1.2, 0.5, 0.2, 0.5), ripple(g, 1.9, 0.5, 0.2, 0.3)];
  // tick disabled: (t) => { crab.position.x = -0.8 + Math.sin(t * 0.9) * 0.7; crab.position.z = 0.6 + Math.cos(t * 0.6) * 0.3; crab.rotation.y = Math.sin(t * 0.9) * 0.3; sea[0].scale.setScalar(0.7 + ((t * 0.5) % 1) * 0.8); sea[0].material.opacity = 0.5 * (1 - ((t * 0.5) % 1)); sea[1].scale.setScalar(0.7 + ((t * 0.5 + 0.5) % 1) * 0.8); sea[1].material.opacity = 0.5 * (1 - ((t * 0.5 + 0.5) % 1)); star.rotation.y = 0.5 + Math.sin(t * 0.5) * 0.05; };
  return g;
}

// ================================================================== 19. seal on a rock
export function makeSealRock() {
  const g = new THREE.Group(), GREY = 0x9aa3b2;
  for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28; add(g, new THREE.Mesh(new THREE.DodecahedronGeometry(1.3 + (i % 3) * 0.3, 0), flat(i % 2 ? ROCK : ROCK2)), Math.cos(a) * 2.4, 0.7, Math.sin(a) * 2.2).scale.y = 0.8; }
  cyl(g, 2.6, 3.0, 1.6, ROCK2, 0, 0.8, 0, 8); cyl(g, 2.2, 2.5, 0.3, ROCK, 0, 1.7, 0, 8);
  const seal = new THREE.Group(); add(g, seal, 0, 1.85, 0); seal.rotation.y = 0.4;
  egg(seal, 1.0, 0.85, 2.0, GREY, 0, 0.7, 0); egg(seal, 0.85, 0.5, 1.8, 0xe9edf3, 0, 0.35, 0.1);
  const head = new THREE.Group(); add(seal, head, 0, 1.5, 1.9); egg(head, 0.7, 0.65, 0.75, GREY, 0, 0, 0); egg(head, 0.38, 0.3, 0.35, 0xe9edf3, 0, -0.15, 0.55); ball(head, 0.14, 0x15202b, 0, 0.0, 0.88);
  for (const s of [-1, 1]) { ball(head, 0.17, 0x15202b, s * 0.3, 0.2, 0.55); ball(head, 0.06, 0xffffff, s * 0.33, 0.26, 0.64); for (let k = 0; k < 3; k++) rod(head, [s * 0.15, -0.12 + k * 0.05, 0.8], [s * 0.7, -0.2 + k * 0.12, 0.9], 0.012, 0xffffff, 3); }
  for (const s of [-1, 1]) { const f = egg(seal, 0.7, 0.12, 0.3, GREY, s * 1.0, 0.3, 1.1); f.rotation.z = -s * 0.5; f.rotation.y = s * 0.5; const b = egg(seal, 0.45, 0.1, 0.5, GREY, s * 0.35, 0.3, -2.1); b.rotation.y = s * 0.4; }
  const bl = new THREE.Group(); add(g, bl, 0, 4.4, 0);
  for (let i = 0; i < 6; i++) add(bl, new THREE.Mesh(new THREE.SphereGeometry(0.62, 4, 8, (i / 6) * 6.283, 1.0472), flat([0xff5a3d, 0xffffff, 0x2fb8ff][i % 3], { side: THREE.DoubleSide })), 0, 0, 0);
  const rp = ripple(g, 4.2, 0, 0, 0.4);
  // tick disabled: (t) => { head.rotation.x = Math.sin(t * 1.3) * 0.08 - 0.05; seal.position.y = 1.85 + Math.sin(t * 1.1) * 0.03; bl.position.set(Math.sin(seal.rotation.y) * 3.1, 3.8 + Math.abs(Math.sin(t * 2.0)) * 0.9, Math.cos(seal.rotation.y) * 3.1); bl.rotation.x = t * 1.5; bl.rotation.z = t * 0.9; rp.scale.setScalar(1 + Math.sin(t * 1.2) * 0.04); };
  return g;
}

// ================================================================== 20. bubble vent
export function makeBubbleVent() {
  const g = new THREE.Group(), r = rng(36);
  cyl(g, 3.8, 4.2, 0.3, 0x3d4a66, 0, 0.15, 0, 12);
  for (let i = 0; i < 7; i++) { const a = (i / 7) * 6.28; add(g, new THREE.Mesh(new THREE.DodecahedronGeometry(0.8 + r() * 0.35, 0), flat(i % 2 ? 0x56627f : 0x47536e)), Math.cos(a) * 2.7, 0.55, Math.sin(a) * 2.7).scale.y = 0.8; }
  cyl(g, 0.9, 1.9, 2.8, 0x56627f, 0, 1.6, 0, 8); cyl(g, 1.05, 0.9, 0.3, 0x47536e, 0, 3.1, 0, 8);
  const glowRing = add(g, new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.16, 6, 14), new THREE.MeshStandardMaterial({ color: 0xff8a3d, emissive: 0xff5a1a, emissiveIntensity: 1.5 })), 0, 3.28, 0); glowRing.rotation.x = Math.PI / 2;
  for (let k = 0; k < 6; k++) { const a = k * 1.1; const tw = cyl(g, 0.1, 0.1, 0.9 + (k % 3) * 0.3, 0xfff6e6, Math.cos(a) * 3.2, 0.8, Math.sin(a) * 3.2, 6); ball(g, 0.17, 0xff4d5a, Math.cos(a) * 3.2, 1.3 + (k % 3) * 0.3, Math.sin(a) * 3.2); }
  const bubbles = Array.from({ length: 16 }, (_, i) => ({ m: add(g, new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), new THREE.MeshStandardMaterial({ color: 0xdff6ff, emissive: 0x9fdcff, emissiveIntensity: 0.3, transparent: true, opacity: 0.7, roughness: 0.1 })), 0, 3.4, 0), ph: i / 16, sz: 0.5 + r() * 0.8, sp: 0.25 + r() * 0.15 }));
  // tick disabled: (t) => { glowRing.material.emissiveIntensity = 1.3 + Math.sin(t * 3) * 0.4; bubbles.forEach((b, i) => { const k = (t * b.sp + b.ph) % 1; b.m.position.set(Math.sin(i * 2.3 + t * 1.2) * 0.4 * k * 2, 3.4 + k * 7, Math.cos(i * 1.9 + t) * 0.4 * k * 2); b.m.scale.setScalar(b.sz * (0.5 + k * 0.7)); b.m.material.opacity = 0.75 * (1 - k * k); }); };
  return g;
}

// ------------------------------------------------------------------ registry
export const AQUA_MAKERS = {
  coral_reef: makeCoralReef, kelp_forest: makeKelpForest, jellyfish_swarm: makeJellyfishSwarm, fish_school: makeFishSchool,
  sea_turtle: makeSeaTurtle, whale: makeWhale, dolphin_pair: makeDolphinPair, shark: makeShark, manta_ray: makeMantaRay,
  starfish_cluster: makeStarfishCluster, giant_clam: makeGiantClam, octopus: makeOctopus, giant_crab: makeGiantCrab,
  seahorse_pair: makeSeahorsePair, pufferfish: makePufferfish, anemone_clownfish: makeAnemoneClownfish, lily_pond: makeLilyPond,
  tide_pool: makeTidePool, seal_rock: makeSealRock, bubble_vent: makeBubbleVent,
};

export const AQUA_CATALOG = [
  {
    category: 'Reef & Seabed',
    items: [
      { type: 'coral_reef', name: 'Coral Reef', icon: '🪸', desc: 'Branching, brain, fan and tube corals on a sandy reef with rocks', defaultProps: { scale: 1.0, seed: 21 }, water: true },
      { type: 'kelp_forest', name: 'Kelp Forest', icon: '🌿', desc: 'Swaying green kelp ribbons with floats around mossy rocks', defaultProps: { scale: 1.0, seed: 22 }, water: true },
      { type: 'anemone_clownfish', name: 'Anemone & Clownfish', icon: '🐠', desc: 'Wavy anemone on a rock with two clownfish swimming around it', defaultProps: { scale: 1.0, seed: 33 }, water: true },
      { type: 'giant_clam', name: 'Giant Clam & Pearl', icon: '🦪', desc: 'Ribbed clam that slowly opens and shuts around a glowing pearl', defaultProps: { scale: 1.0 }, water: true },
      { type: 'bubble_vent', name: 'Bubble Vent', icon: '🫧', desc: 'Rocky vent with a glowing rim, tube worms and rising bubbles', defaultProps: { scale: 1.0 }, water: true },
    ],
  },
  {
    category: 'Swimmers',
    items: [
      { type: 'fish_school', name: 'Fish School', icon: '🐟', desc: 'Fourteen colourful fish circling in a school with ripples', defaultProps: { scale: 1.0, seed: 24 }, water: true },
      { type: 'jellyfish_swarm', name: 'Jellyfish Swarm', icon: '🪼', desc: 'Four glowing, pulsing jellyfish drifting with trailing tentacles', defaultProps: { scale: 1.0 }, water: true },
      { type: 'sea_turtle', name: 'Sea Turtle', icon: '🐢', desc: 'Friendly green turtle paddling along the surface', defaultProps: { scale: 1.0 }, water: true },
      { type: 'manta_ray', name: 'Manta Ray', icon: '🦈', desc: 'Gliding manta with flapping wings, white spots and a long tail', defaultProps: { scale: 1.0 }, water: true },
      { type: 'seahorse_pair', name: 'Seahorse Pair', icon: '🐴', desc: 'Two bobbing seahorses among seagrass on a sandy patch', defaultProps: { scale: 1.0 }, water: true },
      { type: 'pufferfish', name: 'Pufferfish', icon: '🐡', desc: 'Round spiky pufferfish that puffs up and down', defaultProps: { scale: 1.0 }, water: true },
    ],
  },
  {
    category: 'Big Sea Animals',
    items: [
      { type: 'whale', name: 'Blue Whale', icon: '🐋', desc: 'Giant smiling whale with a water spout and waving tail flukes', defaultProps: { scale: 1.0 }, water: true },
      { type: 'dolphin_pair', name: 'Leaping Dolphins', icon: '🐬', desc: 'Two dolphins arcing out of the water with splash rings', defaultProps: { scale: 1.0 }, water: true },
      { type: 'shark', name: 'Patrol Shark', icon: '🦈', desc: 'Grey shark with a fin circling its patch of sea, leaving a wake', defaultProps: { scale: 1.0 }, water: true },
      { type: 'octopus', name: 'Cheerful Octopus', icon: '🐙', desc: 'Orange octopus with big eyes and curling tentacles on a rock', defaultProps: { scale: 1.0 }, water: true },
      { type: 'seal_rock', name: 'Seal on a Rock', icon: '🦭', desc: 'Sleepy seal on a rock balancing a bouncing beach ball', defaultProps: { scale: 1.0 }, water: true },
    ],
  },
  {
    category: 'Shore Life',
    items: [
      { type: 'starfish_cluster', name: 'Starfish Beach', icon: '⭐', desc: 'Six colourful starfish, shells and pebbles on the sand', defaultProps: { scale: 1.0, seed: 30 } },
      { type: 'giant_crab', name: 'Giant Crab', icon: '🦀', desc: 'Big red crab with snapping claws and wobbling eyestalks', defaultProps: { scale: 1.0 } },
      { type: 'tide_pool', name: 'Tide Pool', icon: '🏝️', desc: 'Rock-ringed pool with a starfish, tiny crab, shells and seaweed', defaultProps: { scale: 1.0, seed: 35 } },
      { type: 'lily_pond', name: 'Lily Pond', icon: '🪷', desc: 'Round pond with lily pads, lotus flowers, a frog and cattails', defaultProps: { scale: 1.0, seed: 34 } },
    ],
  },
];
