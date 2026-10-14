import * as THREE from 'three';
import { std, glow, add } from './kit.js';

// Floating COZY treasure chest: soft rounded peach "gift box" chest with a quilted rose lid, butter-yellow ribbon + bow,
// heart latch, fairy lights, a little sprout, and a puffy pillow life-ring. Faces +Z (latch side). ~3.6 wide / 3.2 tall at scale 1.
//   buildCozyChest()               floats on the sea (pillow ring, soft peach beam, bobbing, twinkles)
//   buildCozyChest({ float:false}) chest only (land decoration)
// Same API as the other chest: userData.tick(t, dt), open() (lid flips up, hearts + coins pop out), close(), isOpen().

const PEACH = 0xf4b393, PEACH_D = 0xe39a7a, CREAM = 0xfff1dc, ROSE = 0xe98aa0, ROSE_L = 0xf5aabb, BUTTER = 0xffd98a,
      SAGE = 0x9cc9a1, COCOA = 0x9a6b50, WARM = 0xffc98a;
const R = 1.05;

const soft = (color, extra = {}) => std(color, { flatShading: false, roughness: 0.95, ...extra });
const sbox = (p, w, h, d, c, x, y, z) => add(p, new THREE.Mesh(new THREE.BoxGeometry(w, h, d), soft(c)), x, y, z);
const ball = (p, r, c, x, y, z, extra) => add(p, new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), soft(c, extra)), x, y, z);
const post = (p, r, h, c, x, y, z) => add(p, new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 14), soft(c)), x, y, z);

// half-cylinder shell lying along X (lid, stitches, ribbon)
function arch(radius, length, color, { thetaStart = 0, thetaLen = Math.PI, open = true, extra = {} } = {}) {
  const geo = new THREE.CylinderGeometry(radius, radius, length, 32, 1, open, thetaStart, thetaLen); geo.rotateZ(Math.PI / 2);
  return new THREE.Mesh(geo, soft(color, { side: THREE.DoubleSide, ...extra }));
}

function heartGeo(depth = 0.1, size = 1) {
  const h = new THREE.Shape();
  h.moveTo(0, -0.5); h.bezierCurveTo(-0.1, -0.35, -0.5, -0.1, -0.5, 0.15); h.bezierCurveTo(-0.5, 0.4, -0.2, 0.5, 0, 0.3);
  h.bezierCurveTo(0.2, 0.5, 0.5, 0.4, 0.5, 0.15); h.bezierCurveTo(0.5, -0.1, 0.1, -0.35, 0, -0.5);
  const g = new THREE.ExtrudeGeometry(h, { depth, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 });
  g.translate(0, 0, -depth / 2); g.scale(size, size, size); return g;
}

export function buildCozyChest({ float = true } = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const chest = new THREE.Group(); add(body, chest, 0, 0.3, 0);

  // ---- body: peach box, cocoa base, cream top trim, soft corner pillars, round feet ----
  sbox(chest, 2.8, 1.3, 2.0, PEACH, 0, 0.7, 0);
  sbox(chest, 3.0, 0.3, 2.2, COCOA, 0, 0.2, 0);
  sbox(chest, 3.0, 0.2, 2.2, CREAM, 0, 1.32, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * 1.4, z = sz * 1.0;
    post(chest, 0.2, 1.3, CREAM, x, 0.75, z);
    ball(chest, 0.23, BUTTER, x, 1.4, z);
    ball(chest, 0.24, COCOA, x, 0.02, z);
  }
  // little cream heart stamps on sides and back
  const stamp = (x, z, ry) => { const m = add(chest, new THREE.Mesh(heartGeo(0.05, 0.5), soft(CREAM)), x, 0.78, z); m.rotation.y = ry; };
  stamp(0, -1.02, Math.PI); stamp(1.42, 0, Math.PI / 2); stamp(-1.42, 0, -Math.PI / 2);
  stamp(-0.85, 1.02, 0); stamp(0.85, 1.02, 0);

  // ---- front heart latch ----
  const hb = add(chest, new THREE.Mesh(heartGeo(0.08, 0.95), soft(CREAM)), 0, 0.85, 1.05);
  const hf = add(chest, new THREE.Mesh(heartGeo(0.08, 0.7), soft(ROSE)), 0, 0.85, 1.11);
  ball(chest, 0.07, BUTTER, 0, 0.9, 1.17);
  const seam = add(chest, new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.05, 0.05), glow(WARM, 0.9, true)), 0, 1.4, 1.02);

  // ---- fairy lights swagged across the front ----
  const bulbs = [], cols = [0xfff0a0, 0xffb3c6, 0xbfffd8];
  for (let i = 0; i < 7; i++) {
    const x = -1.2 + i * 0.4, y = 0.22 + 0.16 * Math.pow(x / 1.4, 2);
    const b = add(chest, new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), glow(cols[i % 3], 1)), x, y, 1.13);
    bulbs.push({ b, ph: i * 0.9 });
  }

  // ---- lid: quilted rose arch, cream stitches + buttons, butter ribbon with bow, sprout ----
  const lid = new THREE.Group(); add(chest, lid, 0, 1.4, -1.0);
  const arc = new THREE.Group(); add(lid, arc, 0, 0, 1.0);
  arc.add(arch(R, 3.0, ROSE, { open: false }));
  const at = (th, rr = R) => [Math.sin(th) * rr, Math.cos(th) * rr];
  for (const a of [0.45, 1.0]) arc.add(arch(R + 0.012, 2.95, CREAM, { thetaStart: a, thetaLen: 0.07 }));
  for (const x of [-1.25, -0.62, 0.62, 1.25]) {
    add(arc, arch(R + 0.012, 0.07, CREAM), x, 0, 0);
    for (const th of [0.48, 1.03]) { const [y, z] = at(th, R + 0.03); ball(arc, 0.08, CREAM, x, y, z); }
  }
  arc.add(arch(R + 0.04, 0.5, BUTTER));                      // ribbon over the middle
  const [by] = at(Math.PI / 2, R + 0.1);
  const bow = new THREE.Group(); add(arc, bow, 0, by, 0.0);
  for (const s of [-1, 1]) { const loop = ball(bow, 0.3, BUTTER, s * 0.3, 0.12, 0); loop.scale.set(1, 0.6, 0.7); loop.rotation.z = s * 0.35; }
  ball(bow, 0.14, ROSE_L, 0, 0.1, 0);
  for (const s of [-1, 1]) { const t = sbox(bow, 0.16, 0.05, 0.5, BUTTER, s * 0.12, 0.02, 0.32); t.rotation.y = s * 0.3; }
  const [sy, sz] = at(1.15, R);                              // sprout on the lid
  const sprout = new THREE.Group(); add(arc, sprout, -0.95, sy, sz); sprout.rotation.x = -1.15;
  post(sprout, 0.025, 0.35, SAGE, 0, 0.17, 0);
  for (const s of [-1, 1]) { const l = ball(sprout, 0.16, SAGE, s * 0.14, 0.38, 0); l.scale.set(1, 0.4, 0.6); l.rotation.z = -s * 0.5; }

  // ---- float gear: puffy pillow ring + soft beam ----
  let ring = null, beam = null;
  if (float) {
    ring = new THREE.Group(); add(root, ring, 0, 0.05, 0);
    const base = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.5, 14, 36), soft(BUTTER)); base.rotation.x = Math.PI / 2; ring.add(base);
    for (let i = 0; i < 4; i++) { const a = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.52, 14, 10, Math.PI / 4), soft(ROSE_L)); a.rotation.x = Math.PI / 2; a.rotation.z = (i * Math.PI) / 2; ring.add(a); }
    beam = add(root, new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.9, 46, 18, 1, true), glow(0xffd9b0, 0.1, true)), 0, 23, 0);
  }

  // twinkles, burst, hearts + coins
  const starShape = new THREE.Shape();
  for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, r = i % 2 ? 0.08 : 0.26; i ? starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : starShape.moveTo(r, 0); }
  const glints = [], gcol = [0xfff0a0, 0xffc2d4, 0xd4ffe6];
  for (let i = 0; i < 6; i++) {
    const m = add(body, new THREE.Mesh(new THREE.ShapeGeometry(starShape), glow(gcol[i % 3], 0.9, true)), Math.cos(i * 1.05) * 2.3, 1.2 + (i % 3) * 0.9, Math.sin(i * 1.05) * 1.7);
    glints.push({ m, ph: i * 1.3 });
  }
  const burst = add(chest, new THREE.Mesh(new THREE.CircleGeometry(1.6, 24), glow(0xffd9a0, 0, true)), 0, 1.5, 0); burst.rotation.x = -Math.PI / 2;
  const hg = heartGeo(0.08, 0.3), coins = [];
  for (let i = 0; i < 16; i++) {
    const m = i % 2
      ? new THREE.Mesh(hg, soft(i % 4 === 1 ? ROSE : ROSE_L, { emissive: 0x7a2a40, emissiveIntensity: 0.3 }))
      : new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 12), soft(0xffd24d, { emissive: 0x8a5a00, emissiveIntensity: 0.4 }));
    add(chest, m, 0, 1.4, 0); m.visible = false; coins.push({ m, v: new THREE.Vector3(), age: 9 });
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
    body.position.y = Math.sin(t * 1.4) * 0.14;
    body.rotation.z = Math.sin(t * 1.0) * 0.045; body.rotation.x = Math.cos(t * 0.9) * 0.035;
    if (ring) { ring.rotation.z = Math.sin(t * 1.1) * 0.045; ring.rotation.x = Math.cos(t * 0.95) * 0.035; }
    openK += ((isOpen ? 1 : 0) - openK) * (1 - Math.exp(-9 * dt));
    lid.rotation.x = -(0.02 + 0.015 * Math.sin(t * 3)) * (1 - openK) - openK * 1.25;
    seam.material.opacity = (0.5 + Math.sin(t * 3) * 0.3) * (1 - openK);
    bow.rotation.z = Math.sin(t * 1.6) * 0.04;
    for (const b of bulbs) b.b.scale.setScalar(0.85 + 0.3 * Math.max(0, Math.sin(t * 2.6 + b.ph)));
    if (beam) beam.material.opacity = 0.09 + Math.sin(t * 2.5) * 0.02 + (burstT < 0.8 ? (0.8 - burstT) * 0.25 : 0);
    for (const g of glints) { const k = Math.max(0, Math.sin(t * 2.2 + g.ph)); g.m.scale.setScalar(0.2 + k * 1.0); g.m.rotation.z = t * 0.8 + g.ph; g.m.rotation.y = t * 1.2 + g.ph; }
    burstT += dt; const bk = burstT < 0.9 ? burstT / 0.9 : 1;
    burst.scale.setScalar(0.4 + bk * 2.2); burst.material.opacity = burstT < 0.9 ? 0.8 * (1 - bk) : 0;
    for (const c of coins) {
      if (!c.m.visible) continue;
      c.age += dt; c.v.y -= 16 * dt; c.m.position.addScaledVector(c.v, dt); c.m.rotation.set(c.age * 6, c.age * 5, 0);
      if (c.age > 1.6) c.m.visible = false;
    }
  };
  return root;
}
