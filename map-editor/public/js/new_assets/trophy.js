import * as THREE from 'three';
import { std, glow, add, box } from './kit.js';

// The trophy: gold hexagon badge with a raised star, stacked wings, gold neck, navy pedestal with a white plate,
// and a bit of confetti. Faces +Z. About 6 units tall at scale 1.
//   buildTrophy()                  floating on the sea like a potion: life ring, golden beam, bobbing, slow spin
//   buildTrophy({ carried: true }) small version to ride above the boat that holds it (no ring / beam)
// userData.tick(t, dt)  call every frame.   userData.setHeld(bool)  dims the beam/ring and makes it sparkle faster.

const GOLD = 0xffb92e, GOLD_L = 0xffd45a, ORANGE = 0xf08a1c, NAVY = 0x1b2142, NAVY_L = 0x2a3466;
const CONFETTI = [0x4cd964, 0x39d0e6, 0xff7a6b, 0xffd54a, 0xff7ab8];

function hexPrism(r, depth, color, extra) {
  const geo = new THREE.CylinderGeometry(r, r, depth, 6); geo.rotateX(Math.PI / 2); // points up/down, faces +Z
  const m = new THREE.Mesh(geo, std(color, extra)); m.scale.y = 1.06; return m;
}

function starGeo(outer, inner, depth) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? inner : outer;
    i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 1 });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

function wingGeo(len, h) {
  const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(len, h * 0.7); s.lineTo(len, h * 1.6); s.lineTo(0, h);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.36, bevelEnabled: false }); geo.translate(0, 0, -0.18);
  return geo;
}

export function buildTrophy({ carried = false } = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);

  // navy pedestal with a white name plate
  box(body, 3.4, 0.45, 2.2, NAVY, 0, 0.225, 0);
  box(body, 3.1, 0.1, 1.9, NAVY_L, 0, 0.5, 0);
  box(body, 2.3, 0.75, 1.5, NAVY, 0, 0.92, 0);
  box(body, 2.5, 0.12, 1.7, NAVY_L, 0, 1.34, 0);
  box(body, 1.3, 0.32, 0.06, 0xf6f4ee, 0, 0.9, 0.77);

  // gold neck
  const neck = new THREE.LatheGeometry([[0.95, 0], [0.6, 0.16], [0.3, 0.5], [0.28, 0.85], [0.5, 1.05], [0.01, 1.05]].map(([x, y]) => new THREE.Vector2(x, y)), 14);
  add(body, new THREE.Mesh(neck, std(GOLD, { emissive: 0x6a3a00, emissiveIntensity: 0.25 })), 0, 1.4, 0);

  // badge: outer hex, bevel ring, darker recess, raised star
  const badge = new THREE.Group(); add(body, badge, 0, 3.95, 0);
  badge.add(hexPrism(1.6, 0.5, GOLD, { emissive: 0x6a3a00, emissiveIntensity: 0.2 }));
  add(badge, hexPrism(1.42, 0.1, GOLD_L), 0, 0, 0.27);
  add(badge, hexPrism(1.1, 0.08, ORANGE), 0, 0, 0.32);
  const star = add(badge, new THREE.Mesh(starGeo(0.66, 0.29, 0.14), std(GOLD_L, { emissive: 0xffa800, emissiveIntensity: 0.45 })), 0, 0.02, 0.42);
  // wings: two stacked slabs on each side
  for (const s of [-1, 1]) {
    const up = add(badge, new THREE.Mesh(wingGeo(1.6, 0.34), std(GOLD_L)), s * 1.35, 0.1, 0);
    const lo = add(badge, new THREE.Mesh(wingGeo(1.3, 0.3), std(GOLD)), s * 1.35, -0.62, 0);
    if (s < 0) { up.scale.x = lo.scale.x = -1; }
  }

  // confetti
  const bits = [];
  for (let i = 0; i < 12; i++) {
    const isDot = i % 4 === 3;
    const m = new THREE.Mesh(isDot ? new THREE.SphereGeometry(0.09, 6, 5) : new THREE.PlaneGeometry(0.34, 0.17),
      isDot ? std(i % 8 === 3 ? NAVY : GOLD_L) : glow(CONFETTI[i % CONFETTI.length]));
    const a = (i / 12) * Math.PI * 2, r = 2.3 + (i % 3) * 0.5;
    add(body, m, Math.cos(a) * r, 1.6 + (i % 5) * 0.85, Math.sin(a) * r * 0.7);
    bits.push({ m, a, r, y: m.position.y, ph: i * 1.7 });
  }

  // sea gear: life ring + golden beam
  let ring = null, beam = null;
  if (!carried) {
    ring = new THREE.Group(); add(root, ring, 0, 0.05, 0);
    const base = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.4, 8, 28), std(0xf6f4ee)); base.rotation.x = Math.PI / 2; ring.add(base);
    for (let i = 0; i < 4; i++) {
      const arc = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.42, 8, 8, Math.PI / 4), std(0xff7a59)); arc.rotation.x = Math.PI / 2; arc.rotation.z = (i * Math.PI) / 2; ring.add(arc);
    }
    beam = add(root, new THREE.Mesh(new THREE.CylinderGeometry(1.1, 2.0, 46, 18, 1, true), glow(0xffd45a, 0.1, true)), 0, 23, 0);
  }
  root.scale.setScalar(carried ? 0.42 : 1);

  let held = false;
  root.userData.setHeld = (v) => { held = !!v; };
  root.userData.tick = (t, dt = 0.016) => {
    body.position.y = Math.sin(t * 1.8) * (carried ? 0.1 : 0.18);
    body.rotation.y += dt * (held ? 1.4 : 0.6);                          // slow showy spin
    if (ring) { ring.rotation.z = Math.sin(t * 1.3) * 0.05; ring.rotation.x = Math.cos(t * 1.1) * 0.04; } // rocks with the waves
    star.rotation.z = Math.sin(t * 2.2) * 0.06;
    star.material.emissiveIntensity = 0.45 + Math.sin(t * 4) * 0.25;
    if (beam) beam.material.opacity = (held ? 0.05 : 0.1) + Math.sin(t * 3) * 0.02;
    for (const b of bits) {
      const sp = held ? 1.8 : 1;
      b.m.position.set(Math.cos(b.a + t * 0.35 * sp) * b.r, b.y + Math.sin(t * 1.6 * sp + b.ph) * 0.35, Math.sin(b.a + t * 0.35 * sp) * b.r * 0.7);
      b.m.rotation.set(t * 2 + b.ph, t * 1.5, t * 2.5);
    }
  };
  return root;
}
