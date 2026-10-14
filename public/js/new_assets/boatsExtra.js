import * as THREE from 'three';
import { clamp, angleDiff, std, glow, add, box, cylZ, loft } from './kit.js';

// Enemy boat models. Both face +Z like the player's boat and keep a similar footprint
// (the game scales them with ENEMY_TYPES[...].scale).
//   BIG   looks: 'pod' (cruiser), 'twin' (gunboat), 'dread' (dreadnought)
//   SMALL looks: 'sail' (skiff catamaran), 'raider' (angular dart)
// Every model has userData.update(dt, t, boat) and userData.hit().
// Big boats also have userData.aimTurret(worldYaw, hullYaw, dt) and userData.fire().

const BIG = { pod: { stacks: 1, bow: 1, rear: 'missile' }, twin: { stacks: 1, bow: 2, rear: 'twin' }, dread: { stacks: 2, bow: 2, rear: 'triple' } };
const colors = (s) => ({
  hull: s.hull ?? 0xff7aa8, accent: s.accent ?? 0xfff0f5, cabin: s.cabin ?? 0xffc2d6, roof: s.roof ?? 0xe84a82,
  flag: s.flag ?? 0xffffff, dark: 0x3b4452, neon: 0xffe066,
});

function hitFlasher(mats) {
  let k = 0;
  return { hit: () => { k = 1; }, step: (dt) => { k = Math.max(0, k - dt * 4); mats.forEach((m) => m.emissive.setRGB(k * 0.9, k * 0.1, k * 0.05)); } };
}

// ---------------------------------------------------------------- BIG BOATS
export function buildBigBoat(style = {}) {
  const look = BIG[style.look] ? style.look : 'pod', P = BIG[look], C = colors(style);
  const g = new THREE.Group(); g.rotation.order = 'YXZ';
  const mats = [];

  // armoured hull: wide, tall, heavy
  const st = [[-3, 1.35, 0.8, -0.3], [-2, 1.5, 0.85, -0.35], [0, 1.5, 0.9, -0.35], [1.6, 1.35, 0.9, -0.25], [3, 0.9, 0.88, -0.05], [4, 0.4, 0.9, 0.2], [4.7, 0.05, 0.95, 0.45]];
  const hull = loft(st, C.hull, { bottomTaper: 0.78 }), rail = loft(st, C.accent, { band: 0.22, widen: 1.03 });
  g.add(hull, rail, loft(st.map(([z, hw, t, b]) => [z, hw * 0.4, b + 0.1, b - 0.2]), C.dark, { bottomTaper: 0.6 }));
  mats.push(hull.material, rail.material);
  for (const s of [-1, 1]) add(g, new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 4.2), glow(C.neon)), s * 1.42, 0.5, -0.4); // lit waterline stripe

  // bridge, mast with spinning radar, smokestacks
  box(g, 1.7, 1.05, 1.5, C.cabin, 0, 1.4, 0.7);
  box(g, 1.95, 0.2, 1.75, C.roof, 0, 2.02, 0.7);
  add(g, new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.16, 0.05), glow(0x8eeaff)), 0, 1.65, 1.46); // bridge windows
  const radar = new THREE.Group(); add(g, radar, 0, 3.1, 0.7);
  add(radar, new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 5), std(0xffffff)), 0, -0.55, 0);
  box(radar, 1.2, 0.12, 0.25, C.dark, 0, 0, 0);
  for (let i = 0; i < P.stacks; i++) {
    const z = -0.6 - i * 0.95;
    add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 1.5, 8), std(C.dark)), 0, 1.6, z);
    add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.22, 8), std(C.accent)), 0, 2.3, z);
  }
  const flag = add(g, new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), std(C.flag, { side: THREE.DoubleSide })), 0, 3.5, 0.7 - 0.45);
  flag.rotation.y = Math.PI / 2;

  // FRONT: normal fixed guns on the bow
  const bowBarrels = [];
  for (const s of [-1, 1]) {
    box(g, 0.55, 0.4, 1.0, C.dark, s * 0.62, 1.1, 2.55);
    for (let i = 0; i < P.bow; i++) {
      const x = s * (0.62 + (i - (P.bow - 1) / 2) * 0.26);
      bowBarrels.push(cylZ(g, 0.1, 1.9, C.dark, x, 1.2, 3.3));
      cylZ(g, 0.13, 0.16, C.accent, x, 1.2, 4.2); // muzzle ring
    }
  }

  // REAR: the movable turret. Pivot sits on the deck behind the bridge.
  const turret = new THREE.Group(); add(g, turret, 0, 0.9, -1.75);
  add(turret, new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.92, 0.22, 14), std(C.dark)), 0, 0.11, 0);   // ring mount
  add(turret, new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.5, 6), std(C.accent)), 0, 0.47, 0);      // armoured body
  add(turret, new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), std(C.roof)), 0, 0.72, 0);
  add(turret, new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.14), glow(C.neon)), 0, 0.62, 0.62); // front sight light
  const guns = new THREE.Group(); add(turret, guns, 0, 0.55, 0.35);
  const barrels = [];
  if (P.rear === 'missile') {
    box(guns, 0.95, 0.42, 1.3, C.dark, 0, 0, 0.45);
    for (const x of [-0.25, 0.25]) for (const y of [-0.08, 0.14]) {
      barrels.push(cylZ(guns, 0.11, 1.5, 0xf2f2f2, x, y, 0.55));
      const tip = add(guns, new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.3, 8), std(0xff4d4d)), x, y, 1.42); tip.rotation.x = Math.PI / 2;
    }
  } else {
    const n = P.rear === 'triple' ? 3 : 2, r = P.rear === 'triple' ? 0.12 : 0.15;
    box(guns, 0.3 + n * 0.28, 0.4, 0.7, C.dark, 0, 0, 0.25);
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * 0.3;
      barrels.push(cylZ(guns, r, 2.0, C.dark, x, 0, 1.2));
      cylZ(guns, r + 0.04, 0.18, C.accent, x, 0, 2.15);
    }
  }
  const barrelZ = barrels.map((b) => b.position.z);

  // engines
  for (const s of [-1, 1]) { cylZ(g, 0.38, 1.1, C.dark, s * 0.7, 0.3, -3.2); cylZ(g, 0.42, 0.1, C.accent, s * 0.7, 0.3, -3.78); }

  const f = hitFlasher(mats);
  let rel = 0, recoil = 0;
  g.userData.turret = turret;
  // Turns the turret toward a WORLD yaw at a limited rate (it lags behind fast targets).
  // Returns the turret's current WORLD yaw so the AI can shoot along it.
  g.userData.aimTurret = (worldYaw, hullYaw, dt, rate = 2.4) => {
    const d = angleDiff(rel, angleDiff(0, worldYaw - hullYaw));
    rel = angleDiff(0, rel + clamp(d, -rate * dt, rate * dt));
    turret.rotation.y = rel;
    return hullYaw + rel;
  };
  g.userData.turretRel = () => rel;
  g.userData.fire = () => { recoil = 1; };
  g.userData.hit = f.hit;
  g.userData.update = (dt, t, boat) => {
    radar.rotation.y += dt * 2.2;
    recoil = Math.max(0, recoil - dt * 7);
    barrels.forEach((b, i) => { b.position.z = barrelZ[i] - recoil * 0.35; });
    flag.rotation.x = Math.sin(t * 9) * 0.12 * (1 + clamp((boat?.state?.speed || 0) / 100, 0, 1));
    f.step(dt);
  };
  g.scale.setScalar(style.scale || 1);
  return g;
}

// -------------------------------------------------------------- SMALL BOATS
export function buildSmallBoat(style = {}) {
  const look = style.look === 'raider' ? 'raider' : 'sail', C = colors({ hull: 0xffa62b, accent: 0xffffff, cabin: 0xffe0a3, roof: 0xff7a1a, flag: 0xffffff, ...style });
  const g = new THREE.Group(); g.rotation.order = 'YXZ';
  const mats = [], anim = {};

  if (look === 'sail') {
    // catamaran skiff: two pontoons, open deck, tyre fenders, a sail and a swivel gun
    const pst = [[-2.3, 0.4, 0.5, -0.15], [-1, 0.45, 0.5, -0.2], [1.2, 0.4, 0.5, -0.1], [2.6, 0.22, 0.5, 0.05], [3.5, 0.03, 0.55, 0.3]];
    for (const s of [-1, 1]) {
      const p = loft(pst, C.hull, { bottomTaper: 0.8 }); p.position.x = s * 0.95; g.add(p); mats.push(p.material);
      for (const z of [-1.2, 0.2, 1.4]) { const tyre = add(g, new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.08, 6, 12), std(0x2b2f3a)), s * 1.38, 0.3, z); tyre.rotation.y = Math.PI / 2; }
    }
    box(g, 1.9, 0.14, 3.6, C.accent, 0, 0.62, -0.1);                 // deck
    box(g, 1.1, 0.7, 1.0, C.cabin, 0, 1.0, -0.8); box(g, 1.3, 0.12, 1.2, C.roof, 0, 1.4, -0.8);
    add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.4, 5), std(0xffffff)), 0, 2.8, 0.7); // mast
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(2.6, 0); sh.lineTo(0, 3.9);
    const sg = new THREE.ShapeGeometry(sh); sg.rotateY(Math.PI / 2);
    add(g, new THREE.Mesh(sg, std(0xffffff, { side: THREE.DoubleSide })), 0, 0.8, 0.7);
    const stripe = new THREE.Shape(); stripe.moveTo(0.4, 0.4); stripe.lineTo(1.7, 0.4); stripe.lineTo(0.9, 1.9); stripe.lineTo(0.4, 1.9);
    const tg = new THREE.ShapeGeometry(stripe); tg.rotateY(Math.PI / 2);
    for (const dz of [0.012, -0.012]) add(g, new THREE.Mesh(tg, std(C.roof, { side: THREE.DoubleSide })), 0, 0.8, 0.7 + dz);
    add(g, new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), std(C.dark)), 0, 0.95, 2.2);       // swivel gun ball
    cylZ(g, 0.09, 1.3, C.dark, 0, 1.0, 3.0); cylZ(g, 0.12, 0.14, C.accent, 0, 1.0, 3.68);
    box(g, 0.5, 0.7, 0.4, C.dark, 0, 0.75, -2.5);                                                     // outboard motor
    anim.prop = add(g, new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.06), std(0xcfd6df)), 0, 0.45, -2.78);
    const pen = add(g, new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), std(C.roof, { side: THREE.DoubleSide })), 0, 5.0, 0.3);
    pen.rotation.y = Math.PI / 2; anim.pen = pen;
  } else {
    // raider: low angular dart with a glowing visor, twin gun pods and a swept tail
    const st = [[-2.4, 0.9, 0.5, -0.1], [-0.6, 1.0, 0.55, -0.15], [1.2, 0.8, 0.55, -0.05], [2.8, 0.35, 0.5, 0.15], [4.0, 0.03, 0.5, 0.3]];
    const hull = loft(st, C.hull, { bottomTaper: 0.45 }), rail = loft(st, C.accent, { band: 0.12, widen: 1.02 });
    g.add(hull, rail); mats.push(hull.material, rail.material);
    const cock = add(g, new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), std(0x14202e, { transparent: true, opacity: 0.85 })), 0, 0.72, 0.7);
    cock.scale.set(0.55, 0.3, 1.0);
    add(g, new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.06), glow(C.accent)), 0, 0.82, 1.5); // visor light
    for (const s of [-1, 1]) {
      box(g, 0.34, 0.3, 1.3, C.dark, s * 1.05, 0.5, 1.5);                                          // gun pods
      cylZ(g, 0.07, 1.5, C.dark, s * 1.05, 0.5, 2.7); cylZ(g, 0.1, 0.1, C.accent, s * 1.05, 0.5, 3.4);
      const fin = box(g, 0.12, 1.0, 1.4, C.accent, s * 0.85, 0.95, -2.0); fin.rotation.z = -s * 0.28; fin.rotation.x = -0.15; // swept tail fins
      add(g, new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), glow(C.accent)), s * 1.1, 1.45, -2.45);
    }
    cylZ(g, 0.5, 0.9, C.dark, 0, 0.4, -2.7); cylZ(g, 0.54, 0.1, C.accent, 0, 0.4, -3.2);
    const fl = new THREE.ConeGeometry(0.4, 1, 10); fl.rotateX(-Math.PI / 2); fl.translate(0, 0, -0.5);
    anim.flame = add(g, new THREE.Mesh(fl, glow(C.accent, 0.7, true)), 0, 0.4, -3.25);
  }

  const f = hitFlasher(mats);
  g.userData.hit = f.hit;
  g.userData.update = (dt, t, boat) => {
    const sp = clamp((boat?.state?.speed || 0) / 100, 0, 1.4);
    if (anim.prop) anim.prop.rotation.z += dt * (8 + sp * 40);
    if (anim.pen) anim.pen.rotation.x = Math.sin(t * 12) * (0.12 + sp * 0.2);
    if (anim.flame) { const k = (0.5 + sp * 1.6) * (0.9 + Math.sin(t * 55) * 0.1); anim.flame.scale.set(1, 1, k); }
    f.step(dt);
  };
  g.scale.setScalar(style.scale || 1);
  return g;
}

// One call for boat.js: returns a model for any enemy look, or null for the old default builder.
export function buildEnemyBoat(style) {
  if (BIG[style.look]) return buildBigBoat(style);
  if (style.look === 'sail' || style.look === 'raider') return buildSmallBoat(style);
  return null;
}
