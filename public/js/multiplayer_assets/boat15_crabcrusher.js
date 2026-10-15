import * as THREE from 'three';

// ---- shared helpers (identical in every boat file so each file stands alone) ----
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.7, ...extra });
const glow = (color, opacity = 1, additive = false) => new THREE.MeshBasicMaterial({
  color, transparent: opacity < 1 || additive, opacity, depthWrite: !additive, side: THREE.DoubleSide,
  blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
});
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const put = (parent, m, x = 0, y = 0, z = 0) => { m.position.set(x, y, z); parent.add(m); return m; };
const box = (p, w, h, d, color, x, y, z) => put(p, new THREE.Mesh(new THREE.BoxGeometry(w, h, d), std(color)), x, y, z);
const cylZ = (p, r, len, color, x, y, z, seg = 10) => {
  const geo = new THREE.CylinderGeometry(r, r, len, seg); geo.rotateX(Math.PI / 2);
  return put(p, new THREE.Mesh(geo, std(color)), x, y, z);
};
const ball = (p, r, color, x, y, z, mat) => put(p, new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat || std(color)), x, y, z);

// Two-tone hull from stations [z, halfWidth, topY, bottomY] (stern -> bow)
function hull(st, deckColor, sideColor, taper = 0.7) {
  const S = st.map(([z, hw, top, bot]) => [[-hw, top, z], [hw, top, z], [hw * taper, bot, z], [-hw * taper, bot, z]]);
  const deck = [], sides = [], tri = (arr, a, b, c) => arr.push(...a, ...b, ...c);
  for (let i = 0; i < S.length - 1; i++) {
    const a = S[i], b = S[i + 1];
    tri(deck, a[0], a[1], b[1]); tri(deck, a[0], b[1], b[0]);
    tri(sides, a[1], a[2], b[2]); tri(sides, a[1], b[2], b[1]);
    tri(sides, a[2], a[3], b[3]); tri(sides, a[2], b[3], b[2]);
    tri(sides, a[3], a[0], b[0]); tri(sides, a[3], b[0], b[3]);
  }
  const s0 = S[0]; tri(sides, s0[0], s0[1], s0[2]); tri(sides, s0[0], s0[2], s0[3]);
  const mk = (pos, color) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
    return new THREE.Mesh(geo, std(color, { side: THREE.DoubleSide }));
  };
  const d = mk(deck, deckColor), s = mk(sides, sideColor), group = new THREE.Group();
  group.add(d, s);
  return { group, mats: [d.material, s.material] };
}

// Coloured rub-rail band running along the hull's top edge
function rail(st, color, band = 0.2, widen = 1.03) {
  const S = st.map(([z, hw, top]) => { const a = hw * widen, t = top + 0.02, b = top - band; return [[-a, t, z], [a, t, z], [a, b, z], [-a, b, z]]; });
  const pos = [], tri = (p, q, r) => pos.push(...p, ...q, ...r);
  for (let i = 0; i < S.length - 1; i++) for (let k = 0; k < 4; k++) {
    const a = S[i][k], b = S[i][(k + 1) % 4], c = S[i + 1][(k + 1) % 4], d = S[i + 1][k];
    tri(a, b, c); tri(a, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
  return new THREE.Mesh(geo, std(color, { side: THREE.DoubleSide }));
}

// Glass canopy dome (emissive so it can pulse on boost / hit)
function dome(p, color, sx, sy, sz, x, y, z, emissive = 0x19a0bf) {
  const d = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), std(color, { transparent: true, opacity: 0.5, emissive, emissiveIntensity: 0.65 }));
  d.scale.set(sx, sy, sz); return put(p, d, x, y, z);
}

// Boost flames: list of [x, y, z, nozzleRadius]. Returns the cone meshes (core, outer, core, outer...)
function flames(g, list, color, core = 0xd8fbff) {
  const cone = (r, mat) => { const geo = new THREE.ConeGeometry(r, 1, 10); geo.rotateX(-Math.PI / 2); geo.translate(0, 0, -0.5); return new THREE.Mesh(geo, mat); };
  const out = [];
  for (const [x, y, z, r] of list) out.push(put(g, cone(r * 0.65, glow(core, 0.95, true)), x, y, z), put(g, cone(r * 1.05, glow(color, 0.5, true)), x, y, z));
  return out;
}

// Soft glow on the water under the boat
function underGlow(g, color, sx, sz, z = 0) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(1, 28), glow(color, 0.22, true));
  m.rotation.x = -Math.PI / 2; m.scale.set(sx, sz, 1); return put(g, m, 0, -0.02, z);
}

// Wires up userData.update(dt, t, boat) / hit() / fpvHide, same contract as buildHeroBoat.
// extra(dt, t, speedK, boostK, turn) is the per-boat animation hook.
function finish(g, { flames: fl = [], under, mats = [], dome: dm, extra, fpvHide = [], fpvFloor, scale = 1 }) {
  let boostK = 0, flashK = 0;
  g.userData.hit = () => { flashK = 1; };
  g.userData.update = (dt, t, boat) => {
    const speed = Math.max(0, boat.state.speed), turn = boat.state.turnVel || 0;
    const speedK = clamp(speed / 114, 0, 1);
    boostK += ((boat.boosting ? 1 : 0) - boostK) * (1 - Math.exp(-8 * dt));
    const len = (0.5 + speedK + boostK * 2.6) * (0.9 + Math.sin(t * 60) * 0.1);
    fl.forEach((f, i) => { f.scale.set(1 + boostK * 0.4, 1 + boostK * 0.4, len * (i % 2 ? 0.8 : 1)); f.visible = len > 0.55; });
    if (under) under.material.opacity = 0.18 + speedK * 0.12 + boostK * 0.35;
    flashK = Math.max(0, flashK - dt * 4);
    mats.forEach((m) => m.emissive?.setRGB(flashK * 0.9, flashK * 0.1, flashK * 0.05));
    if (dm) dm.material.emissiveIntensity = 0.65 + boostK * 0.9 + flashK;
    extra?.(dt, t, speedK, boostK, turn);
  };
  g.userData.fpvHide = fpvHide;
  if (fpvFloor != null) g.userData.fpvFloor = fpvFloor;   // deck height for the first-person cockpit console
  g.scale.setScalar(scale);
  return g;
}


// ---- extra helpers used by the newer boats ----
const lerp = (a, b, k) => a + (b - a) * k;
// cone whose tip points +Z
const cone = (p, r, len, color, x, y, z, seg = 8) => {
  const geo = new THREE.ConeGeometry(r, len, seg); geo.rotateX(Math.PI / 2);
  return put(p, new THREE.Mesh(geo, std(color)), x, y, z);
};
// box strut between two points a, b = [x, y, z]; w = width, h = height (cross-section)
const bar = (p, a, b, w, h, mat) => {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, Math.max(0.001, d.length())), mat); m.rotation.order = 'YXZ';
  m.rotation.y = Math.atan2(d.x, d.z); m.rotation.x = -Math.atan2(d.y, Math.hypot(d.x, d.z));
  return put(p, m, (A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
};
const ring = (p, R, tube, mat, x, y, z) => put(p, new THREE.Mesh(new THREE.TorusGeometry(R, tube, 6, 28), mat), x, y, z);
// sample a station list [z, hw, top, bottom] at z
const sampleSt = (st, z) => {
  let i = 0; while (i < st.length - 2 && z > st[i + 1][0]) i++;
  const [z0, h0, t0, b0] = st[i], [z1, h1, t1, b1] = st[i + 1], k = clamp((z - z0) / (z1 - z0), 0, 1);
  return { hw: lerp(h0, h1, k), top: lerp(t0, t1, k), bot: lerp(b0, b1, k) };
};
// swept fin in the YZ plane: base runs from z backwards by len, rises by height, tip swept back
const fin = (p, color, len, height, sweep, thick, x, y, z) => {
  const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(len, 0); s.lineTo(len * 0.4 + sweep, height); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false }); geo.translate(0, 0, -thick / 2); geo.rotateY(Math.PI / 2);
  return put(p, new THREE.Mesh(geo, std(color, { side: THREE.DoubleSide })), x, y, z);
};
// little seated pilot (suit, helmet, visor) - always list it in fpvHide
const pilot = (p, x, y, z, suit, helmet, visor = 0x39e6ff) => {
  const q = new THREE.Group(); put(p, q, x, y, z);
  box(q, 0.5, 0.4, 0.3, suit, 0, 0.3, 0); ball(q, 0.22, helmet, 0, 0.72, 0);
  box(q, 0.34, 0.09, 0.1, 0, 0, 0.74, 0.18).material = glow(visor);
  return q;
};

// "Crab Crusher" - armoured crab gunboat. Wide orange carapace with rim spikes, two big snapping claws on jointed
// arms, eye stalks, six paddling legs, twin chin cannons.
// Faces +Z. Cannon muzzles at z = 3.4. Deck height 0.7. Eye stalks hidden in first person (claws + cannons stay).
export function buildCrabCrusherBoat(style = {}) {
  const C = {
    hull: style.hull ?? 0xff6a3d, chine: style.chine ?? 0xb02f1c, accent: style.accent ?? 0xffd9a0,
    dark: style.dark ?? 0x3d1d17, neon: style.neon ?? 0xffec6a,
  };
  const g = new THREE.Group(); g.rotation.order = 'YXZ';
  const st = [[-2, 1.2, 0.62, -0.3], [-1, 1.7, 0.7, -0.35], [0.5, 1.7, 0.72, -0.35], [1.8, 1.3, 0.72, -0.25], [2.8, 0.7, 0.7, -0.1], [3.3, 0.3, 0.7, 0]];
  const h = hull(st, C.hull, C.chine), rl = rail(st, C.accent, 0.16); g.add(h.group, rl);

  // rim spikes + shell bumps
  for (let z = -1.6; z <= 2.6; z += 0.6) for (const s of [-1, 1]) {
    const hw = sampleSt(st, z).hw;
    put(g, new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 5), std(C.accent)), s * hw * 0.95, 0.88, z);
  }
  for (const [x, z, r] of [[0, -1.7, 0.5], [-1.15, -0.7, 0.35], [1.15, -0.7, 0.35]]) { const b = ball(g, r, C.chine, x, 0.7, z); b.scale.y = 0.6; }

  // eye stalks
  const eyes = new THREE.Group(); put(g, eyes, 0, 0, 0);
  const eyeBalls = [-1, 1].map((s) => {
    put(eyes, new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.5, 6), std(C.chine)), s * 0.4, 0.95, 2.5);
    const e = ball(eyes, 0.13, 0xffffff, s * 0.4, 1.25, 2.5); ball(e, 0.07, 0, 0, 0, 0.09, glow(C.neon));
    return e;
  });

  // claws
  const claws = [-1, 1].map((s) => {
    const arm = new THREE.Group(); put(g, arm, s * 1.4, 0.75, 1.3); arm.rotation.y = s * 0.35;
    box(arm, 0.38, 0.34, 1.2, C.hull, 0, 0, 0.6);
    const fore = new THREE.Group(); put(arm, fore, 0, 0, 1.2); fore.rotation.y = -s * 0.5;
    box(fore, 0.34, 0.3, 0.8, C.chine, 0, 0, 0.4);
    const hand = new THREE.Group(); put(hand, new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.7), std(C.hull)), 0, 0, 0.3); put(fore, hand, 0, 0, 0.8);
    cone(hand, 0.17, 0.9, C.accent, s * 0.2, 0, 1.1, 5);
    const pivot = new THREE.Group(); put(hand, pivot, -s * 0.2, 0, 0.65);
    cone(pivot, 0.17, 0.9, C.accent, 0, 0, 0.45, 5);
    return { pivot, s };
  });

  // paddling legs
  const legs = [];
  for (const s of [-1, 1]) for (const z of [-1.4, -0.6, 0.2]) {
    const up = new THREE.Group(); put(g, up, s * 1.6, 0.6, z); up.rotation.order = 'YXZ'; up.rotation.y = s * (1.45 + z * 0.12);
    box(up, 0.2, 0.2, 0.9, C.chine, 0, 0, 0.45);
    const low = new THREE.Group(); put(up, low, 0, 0, 0.9); low.rotation.x = 1.1;
    box(low, 0.16, 0.16, 0.8, C.hull, 0, 0, 0.4);
    legs.push({ up, ph: z * 2 + s });
  }

  // cannons
  for (const s of [-1, 1]) {
    box(g, 0.3, 0.3, 0.8, C.dark, s * 0.28, 0.88, 2.0);
    cylZ(g, 0.08, 1.6, C.dark, s * 0.28, 0.9, 2.6);
    cylZ(g, 0.12, 0.14, C.neon, s * 0.28, 0.9, 3.4).material = glow(C.neon);
    cylZ(g, 0.36, 1.0, C.dark, s * 0.7, 0.35, -2.3); cylZ(g, 0.4, 0.1, C.accent, s * 0.7, 0.35, -2.85);
  }
  const fl = flames(g, [[-0.7, 0.35, -2.9, 0.36], [0.7, 0.35, -2.9, 0.36]], C.neon, 0xfff2b0);
  const under = underGlow(g, C.neon, 2.6, 4.4, 0.2);
  const pil = pilot(g, 0, 0.5, -0.45, C.dark, C.accent, C.neon);

  return finish(g, {
    flames: fl, under, mats: [...h.mats, rl.material], fpvHide: [eyes, pil], fpvFloor: 0.7,
    scale: style.scale || 1,
    extra: (dt, t, speedK, boostK, turn) => {
      claws.forEach(({ pivot, s }, i) => { const open = Math.max(0, 0.45 + Math.sin(t * (2 + boostK * 5) + i * 1.5) * 0.35); pivot.rotation.y = -s * open; });
      legs.forEach(({ up, ph }) => { up.rotation.x = -0.3 + Math.sin(t * 5 + ph) * 0.25 * (0.3 + speedK + boostK); });
      eyeBalls.forEach((e, i) => { e.position.y = 1.25 + Math.sin(t * 3 + i * 2) * 0.03; e.rotation.y = turn * 0.4; });
    },
  });
}
