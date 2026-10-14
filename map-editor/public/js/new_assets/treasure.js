import * as THREE from 'three';
import { std, glow, add, box } from './kit.js';

// Floating treasure chest (blue-violet wood, mauve straps, gold corner caps, teal studs, central latch with a loop handle).
// Faces +Z (latch side). About 3.6 units wide / 3.2 tall at scale 1.
//   buildFloatingTreasure()               floats on the sea: life ring, teal beam, bobbing, glints, gold light leaking from the seam
//   buildFloatingTreasure({ float:false}) chest only (for land decoration)
// userData.tick(t, dt)  every frame.   userData.open()  lid flips up, light burst, coins fly out (use on pickup).   userData.close()  resets.

const WOOD = 0x3a4a9e, WOOD_D = 0x2e3b88, LID = 0x4a78c8, LID_HI = 0x6fb6ff, STRAP = 0x9a6f84, STRAP_D = 0x7d5a70, GOLD = 0xd9a52b, TEAL = 0x3fc2c9;
const R = 1.05; // lid radius (half the chest depth)

// half-cylinder shell lying along X: used for the lid, its colour bands and the straps
function arch(radius, length, color, { thetaStart = 0, thetaLen = Math.PI, open = true, extra = {} } = {}) {
  const geo = new THREE.CylinderGeometry(radius, radius, length, 24, 1, open, thetaStart, thetaLen); geo.rotateZ(Math.PI / 2);
  return new THREE.Mesh(geo, std(color, { side: THREE.DoubleSide, ...extra }));
}

export function buildFloatingTreasure({ float = true } = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);               // bobs and rocks
  const chest = new THREE.Group(); add(body, chest, 0, 0.3, 0);

  // ---- body: planks, trim, corner straps, gold caps with teal studs ----
  box(chest, 2.9, 1.4, 2.1, WOOD, 0, 0.7, 0);
  box(chest, 3.05, 0.22, 2.25, STRAP_D, 0, 1.33, 0);
  box(chest, 3.05, 0.28, 2.25, STRAP_D, 0, 0.16, 0);
  const stud = (x, y, z, ry) => { const s = add(chest, new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), std(TEAL, { emissive: 0x0e6a72, emissiveIntensity: 0.5 })), x, y, z); s.scale.z = 0.5; s.rotation.y = ry; };
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * 1.43, z = sz * 1.03;
    box(chest, 0.36, 1.4, 0.36, STRAP, x, 0.7, z);
    for (const y of [1.28, 0.2]) {
      box(chest, 0.56, y > 1 ? 0.46 : 0.4, 0.56, GOLD, x, y, z);
      stud(x, y, z + sz * 0.29, sz > 0 ? 0 : Math.PI);
      stud(x + sx * 0.29, y, z, sx * Math.PI / 2);
    }
    stud(x, 0.72, z + sz * 0.19, sz > 0 ? 0 : Math.PI);
  }
  // inset panels with gold diamond emblems (front, back, both sides)
  const emblem = (x, z, ry) => {
    const g = new THREE.Group(); add(chest, g, x, 0.75, z); g.rotation.y = ry;
    box(g, 0.85, 0.8, 0.04, WOOD_D, 0, 0, 0);
    add(g, new THREE.Mesh(new THREE.RingGeometry(0.2, 0.3, 4), std(GOLD, { side: THREE.DoubleSide })), 0, 0, 0.04);
  };
  emblem(-0.85, 1.07, 0); emblem(0.85, 1.07, 0); emblem(-0.7, -1.07, Math.PI); emblem(0.7, -1.07, Math.PI);
  emblem(1.47, -0.1, Math.PI / 2); emblem(-1.47, -0.1, -Math.PI / 2);

  // ---- front latch: gold bar with a pointed tip ----
  box(chest, 0.55, 0.7, 0.1, GOLD, 0, 0.98, 1.12);
  const tip = box(chest, 0.39, 0.39, 0.1, GOLD, 0, 0.6, 1.12); tip.rotation.z = Math.PI / 4;
  const seam = add(chest, new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.05, 0.05), glow(0xffd45a, 0.9, true)), 0, 1.4, 1.08); // gold light leaking from the lid

  // ---- lid: hinged at the back, blue glow bands, mauve arch straps, studs, gems, loop handle ----
  const lid = new THREE.Group(); add(chest, lid, 0, 1.4, -1.05);
  const arc = new THREE.Group(); add(lid, arc, 0, 0, 1.05); // arc centre
  arc.add(arch(R, 2.95, LID, { open: false, extra: { emissive: 0x14336b, emissiveIntensity: 0.5 } }));
  for (const [a, l] of [[0.35, 0.3], [0.85, 0.3]]) arc.add(arch(R + 0.015, 2.9, LID_HI, { thetaStart: a, thetaLen: l, extra: { emissive: 0x3a86ff, emissiveIntensity: 0.9 } }));
  const at = (th, rr = R) => [Math.sin(th) * rr, Math.cos(th) * rr]; // [y, z] on the arc
  for (const sx of [-1, 1]) {
    const strap = arch(R + 0.07, 0.42, STRAP); strap.position.x = sx * 1.1; arc.add(strap);
    const [py] = at(Math.PI / 2, R + 0.1);
    const dome = add(arc, new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), std(TEAL, { emissive: 0x0e6a72, emissiveIntensity: 0.5 })), sx * 1.1, py, 0); dome.scale.y = 0.6;
    for (const th of [0.5, 1.05]) {
      const [gy, gz] = at(th, R + 0.12);
      add(arc, new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), std(0xbff6ff, { emissive: 0x6fe8ff, emissiveIntensity: 0.8 })), sx * 1.1, gy, gz);
    }
  }
  const th = 0.75, [hy, hz] = at(th, R + 0.06);                 // loop handle standing on the lid front
  const loop = new THREE.Group(); add(arc, loop, 0, hy, hz); loop.rotation.x = -th;
  for (const x of [-0.22, 0.22]) box(loop, 0.1, 0.5, 0.09, GOLD, x, 0.25, 0.04);
  box(loop, 0.54, 0.1, 0.09, GOLD, 0, 0.52, 0.04);
  const [cy, cz] = at(0.35, R + 0.06);                          // clasp where the latch meets the lid
  const clasp = box(arc, 0.6, 0.5, 0.14, GOLD, 0, cy + 0.05, cz); clasp.rotation.x = -0.35;

  // ---- float gear ----
  let ring = null, beam = null;
  if (float) {
    ring = new THREE.Group(); add(root, ring, 0, 0.05, 0);
    const base = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.38, 8, 30), std(0xf6f4ee)); base.rotation.x = Math.PI / 2; ring.add(base);
    for (let i = 0; i < 4; i++) { const a = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.4, 8, 8, Math.PI / 4), std(TEAL)); a.rotation.x = Math.PI / 2; a.rotation.z = (i * Math.PI) / 2; ring.add(a); }
    beam = add(root, new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.9, 46, 18, 1, true), glow(0x7fe0ff, 0.1, true)), 0, 23, 0);
  }

  // glints, burst light and coins
  const starShape = new THREE.Shape();
  for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, r = i % 2 ? 0.07 : 0.26; i ? starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : starShape.moveTo(r, 0); }
  const glints = [];
  for (let i = 0; i < 6; i++) {
    const m = add(body, new THREE.Mesh(new THREE.ShapeGeometry(starShape), glow(i % 2 ? 0xffe08a : 0xbff6ff, 0.9, true)), Math.cos(i * 1.05) * 2.3, 1.2 + (i % 3) * 0.9, Math.sin(i * 1.05) * 1.7);
    glints.push({ m, ph: i * 1.3 });
  }
  const burst = add(chest, new THREE.Mesh(new THREE.CircleGeometry(1.6, 24), glow(0xffe08a, 0, true)), 0, 1.5, 0); burst.rotation.x = -Math.PI / 2;
  const coins = [];
  for (let i = 0; i < 16; i++) {
    const m = add(chest, new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 10), std(0xffc83d, { emissive: 0x8a5a00, emissiveIntensity: 0.4 })), 0, 1.4, 0);
    m.visible = false; coins.push({ m, v: new THREE.Vector3(), age: 9 });
  }

  let openK = 0, isOpen = false, burstT = 9;
  const api = root.userData;
  api.open = () => {
    if (isOpen) return; isOpen = true; burstT = 0;
    for (const c of coins) { c.age = 0; c.m.visible = true; c.m.position.set(0, 1.4, 0); c.v.set((Math.random() - 0.5) * 5, 6 + Math.random() * 4, (Math.random() - 0.3) * 4); }
  };
  api.close = () => { isOpen = false; for (const c of coins) c.m.visible = false; };
  api.isOpen = () => isOpen;
  // tick disabled: (t, dt = 0.016) => {
    body.position.y = Math.sin(t * 1.7) * 0.16;
    body.rotation.z = Math.sin(t * 1.2) * 0.05; body.rotation.x = Math.cos(t * 1.0) * 0.04;
    if (ring) { ring.rotation.z = Math.sin(t * 1.3) * 0.05; ring.rotation.x = Math.cos(t * 1.1) * 0.04; }
    openK += ((isOpen ? 1 : 0) - openK) * (1 - Math.exp(-9 * dt));
    lid.rotation.x = -(0.02 + 0.015 * Math.sin(t * 3)) * (1 - openK) - openK * 1.25;   // idle: breathes ajar; open: flips up
    seam.material.opacity = (0.5 + Math.sin(t * 3) * 0.3) * (1 - openK);
    if (beam) beam.material.opacity = 0.09 + Math.sin(t * 3) * 0.02 + (burstT < 0.8 ? (0.8 - burstT) * 0.25 : 0);
    for (const g of glints) { const k = Math.max(0, Math.sin(t * 2.4 + g.ph)); g.m.scale.setScalar(0.2 + k * 1.1); g.m.rotation.z = t + g.ph; g.m.rotation.y = t * 1.3 + g.ph; }
    burstT += dt; const bk = burstT < 0.9 ? burstT / 0.9 : 1;
    burst.scale.setScalar(0.4 + bk * 2.2); burst.material.opacity = burstT < 0.9 ? 0.8 * (1 - bk) : 0;
    for (const c of coins) {
      if (!c.m.visible) continue;
      c.age += dt; c.v.y -= 16 * dt; c.m.position.addScaledVector(c.v, dt); c.m.rotation.set(c.age * 9, c.age * 6, 0);
      if (c.age > 1.6) c.m.visible = false;
    }
  };
  return root;
}
