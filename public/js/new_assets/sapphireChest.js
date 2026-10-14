import * as THREE from 'three';
import { std, glow, add } from './kit.js';

// Floating "royal" chest modelled on the reference picture: chunky blue-violet body with recessed panels, thick red straps,
// big gold corner brackets with teal studs, diamond emblems, a barrel lid with glowing blue plank bands, two arched lid straps
// with gold clamps, a gold front latch and a standing loop handle. Faces +Z (latch side). ~3.4 wide / 3.6 tall at scale 1.
//   buildSapphireChest()               floats on the sea (life ring, teal beam, bobbing, glints)
//   buildSapphireChest({ float:false}) chest only (land decoration)
// userData.tick(t, dt), open() (lid flips, light burst, coins fly out), close(), isOpen().

const BODY = 0x9e1b24, PANEL = 0x6e1019, STRAP = 0x4a1218, STRAP_D = 0x2a0a0e, LID = 0xb3242d, LID_HI = 0xff6a58,
      GOLD = 0xe2a92a, TEAL = 0xff4455; // ruby
const W = 3.0, D = 2.4, H = 1.5, R = D / 2;

const m = (c, extra = {}) => std(c, { flatShading: false, roughness: 0.5, metalness: 0.15, ...extra });
const gold = () => m(GOLD, { roughness: 0.35, metalness: 0.55, emissive: 0x3a2800, emissiveIntensity: 0.4 });
const teal = () => m(TEAL, { roughness: 0.3, emissive: 0x8a0a1a, emissiveIntensity: 0.6 });
const bx = (p, w, h, d, mat, x, y, z) => add(p, new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat), x, y, z);

function arch(radius, length, mat, { thetaStart = 0, thetaLen = Math.PI, open = true } = {}) {
  const geo = new THREE.CylinderGeometry(radius, radius, length, 32, 1, open, thetaStart, thetaLen); geo.rotateZ(Math.PI / 2);
  mat.side = THREE.DoubleSide; return new THREE.Mesh(geo, mat);
}

export function buildSapphireChest({ float = true } = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const chest = new THREE.Group(); add(body, chest, 0, 0.3, 0);

  // ---- body: recessed blue core, double top band, bottom band ----
  bx(chest, W - 0.2, H, D - 0.2, m(BODY), 0, H / 2, 0);
  bx(chest, W + 0.04, 0.26, D + 0.04, m(STRAP_D), 0, H - 0.13, 0);
  bx(chest, W + 0.06, 0.12, D + 0.06, m(STRAP), 0, H - 0.42, 0);
  bx(chest, W + 0.04, 0.32, D + 0.04, m(STRAP_D), 0, 0.17, 0);
  bx(chest, W + 0.06, 0.1, D + 0.06, m(STRAP), 0, 0.42, 0);

  // ---- corner posts, gold brackets, teal studs ----
  const stud = (p, x, y, z, ry, r = 0.13) => { const s = add(p, new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), teal()), x, y, z); s.scale.z = 0.5; s.rotation.y = ry; };
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (W / 2 - 0.18), z = sz * (D / 2 - 0.18), fz = sz > 0 ? 0 : Math.PI;
    bx(chest, 0.4, H, 0.4, m(STRAP), x, H / 2, z);
    for (const y of [0.55, 0.9]) { // little gold rivets down the post
      const r1 = add(chest, new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), gold()), x, y, z + sz * 0.2);
      const r2 = add(chest, new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), gold()), x + sx * 0.2, y, z);
    }
    for (const [y, h] of [[H - 0.1, 0.52], [0.2, 0.46]]) {
      bx(chest, 0.66, h, 0.66, gold(), x, y, z);
      stud(chest, x, y, z + sz * 0.33, fz); stud(chest, x + sx * 0.33, y, z, sx * Math.PI / 2);
    }
    stud(chest, x, 0.72, z + sz * 0.2, fz, 0.1); stud(chest, x + sx * 0.2, 0.72, z, sx * Math.PI / 2, 0.1);
  }

  // ---- recessed panels with gold diamond frames ----
  const diamond = (x, y, z, ry, s = 1) => {
    const g = new THREE.Group(); add(chest, g, x, y, z); g.rotation.y = ry;
    bx(g, 1.1 * s, 0.9 * s, 0.05, m(PANEL), 0, 0, 0);
    add(g, new THREE.Mesh(new THREE.RingGeometry(0.3 * s, 0.44 * s, 4), gold()), 0, 0, 0.04);
  };
  diamond(0, 0.82, D / 2 - 0.08, 0, 1.15); diamond(0, 0.82, -D / 2 + 0.08, Math.PI, 1.15);
  diamond(W / 2 - 0.08, 0.82, 0, Math.PI / 2); diamond(-W / 2 + 0.08, 0.82, 0, -Math.PI / 2);

  // ---- front gold latch (strap with a pointed tip) ----
  bx(chest, 0.6, 0.8, 0.13, gold(), 0, H - 0.5, D / 2 + 0.07);
  const tip = bx(chest, 0.42, 0.42, 0.13, gold(), 0, H - 1.0, D / 2 + 0.07); tip.rotation.z = Math.PI / 4;
  const seam = add(chest, new THREE.Mesh(new THREE.BoxGeometry(W - 0.2, 0.05, 0.05), glow(0xffd45a, 0.9, true)), 0, H, D / 2 - 0.05);

  // ---- lid: barrel with glowing plank bands, rails, arched straps, clamps, handle ----
  const lid = new THREE.Group(); add(chest, lid, 0, H, -R);
  const arc = new THREE.Group(); add(lid, arc, 0, 0, R);
  arc.add(arch(R, W - 0.1, m(LID, { emissive: 0x3a0508, emissiveIntensity: 0.45 }), { open: false }));
  for (const a of [0.25, 0.7, 1.15]) arc.add(arch(R + 0.015, W - 0.2, m(LID_HI, { emissive: 0xd02a20, emissiveIntensity: 0.9 }), { thetaStart: a, thetaLen: 0.3 }));
  for (const sz of [-1, 1]) bx(arc, W + 0.04, 0.14, 0.16, m(STRAP_D), 0, 0.06, sz * R);
  const at = (th, rr = R) => [Math.sin(th) * rr, Math.cos(th) * rr];
  const tang = (th, w, h, d, mat, rr, x) => { const [y, z] = at(th, rr); const b = bx(arc, w, h, d, mat, x, y, z); b.rotation.x = Math.PI / 2 - th; return b; };
  for (const sx of [-1, 1]) {
    const x = sx * (W / 2 - 0.4);
    const strap = arch(R + 0.1, 0.55, m(STRAP)); strap.position.x = x; arc.add(strap);
    const [cy] = at(Math.PI / 2, R + 0.14);
    const dome = add(arc, new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), teal()), x, cy, 0); dome.scale.y = 0.55;
    tang(2.45, 0.72, 0.1, 0.36, gold(), R + 0.12, x);                       // gold clamp on the back slope
    tang(0.55, 0.14, 0.16, 0.16, m(0xff8a96, { emissive: 0xff2a40, emissiveIntensity: 0.9 }), R + 0.14, x); // gem
    const [gy, gz] = at(1.15, R + 0.15); add(arc, new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), m(0xff8a96, { emissive: 0xff2a40, emissiveIntensity: 0.9 })), x, gy, gz);
  }
  { // standing loop handle on the lid front + gold clasp
    const th = 0.82, [hy, hz] = at(th, R + 0.06);
    const loop = new THREE.Group(); add(arc, loop, 0, hy, hz); loop.rotation.x = Math.PI / 2 - th;
    for (const x of [-0.42, 0.42]) bx(loop, 0.13, 0.55, 0.12, m(STRAP), x, 0.27, 0);
    bx(loop, 1.0, 0.13, 0.12, m(STRAP), 0, 0.56, 0);
    tang(0.38, 0.7, 0.14, 0.62, gold(), R + 0.07, 0);
  }

  { // gold crown with ruby tips on the lid crest
    const [cy] = at(Math.PI / 2, R + 0.12);
    const crown = new THREE.Group(); add(arc, crown, 0, cy, 0); crown.scale.setScalar(1.35);
    const gm = gold(); gm.side = THREE.DoubleSide;
    add(crown, new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.34, 0.26, 18, 1, true), gm), 0, 0.13, 0);
    add(crown, new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.03, 8, 18), gold()), 0, 0.27, 0).rotation.x = Math.PI / 2;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2, x = Math.sin(a) * 0.37, z = Math.cos(a) * 0.37;
      add(crown, new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.34, 8), gold()), x, 0.42, z);
      add(crown, new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), teal()), x, 0.62, z);
    }
    for (const a of [0.6, 2.2, 3.8, 5.4]) add(crown, new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), teal()), Math.sin(a) * 0.39, 0.13, Math.cos(a) * 0.39);
  }

  // ---- float gear ----
  let ring = null, beam = null;
  if (float) {
    ring = new THREE.Group(); add(root, ring, 0, 0.05, 0);
    const base = new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.4, 10, 36), m(0xe8b030, { metalness: 0.5, roughness: 0.35 })); base.rotation.x = Math.PI / 2; ring.add(base);
    for (let i = 0; i < 4; i++) { const a = new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.42, 10, 10, Math.PI / 4), m(0xb3242d)); a.rotation.x = Math.PI / 2; a.rotation.z = (i * Math.PI) / 2; ring.add(a); }
    beam = add(root, new THREE.Mesh(new THREE.CylinderGeometry(1.0, 2.0, 46, 18, 1, true), glow(0xffc04a, 0.1, true)), 0, 23, 0);
  }

  // glints, burst, coins
  const star = new THREE.Shape();
  for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, r = i % 2 ? 0.07 : 0.26; i ? star.lineTo(Math.cos(a) * r, Math.sin(a) * r) : star.moveTo(r, 0); }
  const glints = [];
  for (let i = 0; i < 6; i++) {
    const g = add(body, new THREE.Mesh(new THREE.ShapeGeometry(star), glow(i % 2 ? 0xffe08a : 0xfff4c0, 0.9, true)), Math.cos(i * 1.05) * 2.5, 1.2 + (i % 3) * 0.9, Math.sin(i * 1.05) * 1.9);
    glints.push({ m: g, ph: i * 1.3 });
  }
  const burst = add(chest, new THREE.Mesh(new THREE.CircleGeometry(1.7, 24), glow(0xffe08a, 0, true)), 0, H + 0.1, 0); burst.rotation.x = -Math.PI / 2;
  const coins = [];
  for (let i = 0; i < 16; i++) {
    const c = add(chest, new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 12), m(0xffc83d, { emissive: 0x8a5a00, emissiveIntensity: 0.4 })), 0, H, 0);
    c.visible = false; coins.push({ m: c, v: new THREE.Vector3(), age: 9 });
  }

  let openK = 0, isOpen = false, burstT = 9;
  const api = root.userData;
  api.open = () => {
    if (isOpen) return; isOpen = true; burstT = 0;
    for (const c of coins) { c.age = 0; c.m.visible = true; c.m.position.set(0, H, 0); c.v.set((Math.random() - 0.5) * 5, 6 + Math.random() * 4, (Math.random() - 0.3) * 4); }
  };
  api.close = () => { isOpen = false; for (const c of coins) c.m.visible = false; };
  api.isOpen = () => isOpen;
  api.tick = (t, dt = 0.016) => {
    body.position.y = Math.sin(t * 1.7) * 0.16;
    body.rotation.z = Math.sin(t * 1.2) * 0.05; body.rotation.x = Math.cos(t * 1.0) * 0.04;
    if (ring) { ring.rotation.z = Math.sin(t * 1.3) * 0.05; ring.rotation.x = Math.cos(t * 1.1) * 0.04; }
    openK += ((isOpen ? 1 : 0) - openK) * (1 - Math.exp(-9 * dt));
    lid.rotation.x = -(0.02 + 0.015 * Math.sin(t * 3)) * (1 - openK) - openK * 1.25;
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
