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

// "Aurora Gyro" - sci-fi hover skiff. Pearl-white hull, a glowing energy core behind the pilot circled by three
// gold/teal gyroscope rings spinning on different axes, floating plasma-cannon pods with charge coils,
// ring-shaped ion thrusters, light strips down the flanks.
// Faces +Z. Plasma muzzles at z = 3.2. Deck height 0.66. Canopy hidden in first person.
export function buildAuroraGyroBoat(style = {}) {
  const C = {
    hull: style.hull ?? 0xf4fbff, chine: style.chine ?? 0x7fd6e0, accent: style.accent ?? 0x2fd0c0,
    dark: style.dark ?? 0x20384a, neon: style.neon ?? 0x7affd9, gold: style.gold ?? 0xffe27a,
  };
  const g = new THREE.Group(); g.rotation.order = 'YXZ';
  const st = [[-2.6, 0.8, 0.6, -0.2], [-1.6, 0.95, 0.64, -0.25], [0, 0.9, 0.66, -0.25], [1.6, 0.6, 0.66, -0.1], [3, 0.28, 0.68, 0.05], [4.2, 0.05, 0.7, 0.3]];
  const h = hull(st, C.hull, C.chine), rl = rail(st, C.accent, 0.14); g.add(h.group, rl);
  for (const s of [-1, 1]) {
    for (const z of [-2, -0.6]) { const { hw } = sampleSt(st, z); box(g, 0.04, 0.05, 1.2, 0, s * (hw + 0.03), 0.5, z).material = glow(C.neon); }
    bar(g, [s * 0.9, 0.65, -1.2], [s * 1.7, 0.95, -2.0], 0.5, 0.05, std(C.accent));          // hover fins
    bar(g, [s * 0.9, 0.67, -1.2], [s * 1.7, 0.97, -2.0], 0.04, 0.05, glow(C.neon));
    bar(g, [s * 0.6, 0.65, -2.2], [s * 0.3, 1.0, -2.35], 0.1, 0.1, std(C.dark));              // core pylons
  }

  // energy core + gyroscope rings
  const core = new THREE.Group(); put(g, core, 0, 1.2, -2.35);
  const orb = ball(core, 0.5, 0, 0, 0, 0, glow(C.neon, 0.85)); ball(core, 0.28, 0xffffff, 0, 0, 0, glow(0xffffff));
  const rA = ring(core, 0.85, 0.045, std(C.gold, { emissive: 0x6a5a10, emissiveIntensity: 0.5 }), 0, 0, 0);
  const rB = ring(core, 0.72, 0.045, std(C.accent, { emissive: 0x10605a, emissiveIntensity: 0.5 }), 0, 0, 0);
  const rC = ring(core, 0.6, 0.04, glow(C.neon), 0, 0, 0);

  // floating plasma pods
  const pods = [-1, 1].map((s) => {
    const p = new THREE.Group(); put(g, p, s * 0.95, 0.8, 1.4);
    box(p, 0.28, 0.28, 1.0, C.dark, 0, 0, 0);
    cylZ(p, 0.08, 1.7, C.dark, 0, 0, 0.9);
    for (const z of [0.5, 0.9, 1.3]) ring(p, 0.14, 0.025, glow(C.neon), 0, 0, z);
    ball(p, 0.13, 0, 0, 0, 1.8, glow(C.neon));
    return p;
  });
  for (const s of [-1, 1]) {
    ring(g, 0.34, 0.07, std(C.gold), s * 0.6, 0.4, -3.0);
    put(g, new THREE.Mesh(new THREE.CircleGeometry(0.28, 14), glow(C.dark)), s * 0.6, 0.4, -2.98);
  }
  const fl = flames(g, [[-0.6, 0.4, -3.05, 0.3], [0.6, 0.4, -3.05, 0.3]], C.neon);
  const under = underGlow(g, C.neon, 2.0, 4.6, 0.2);

  const dm = dome(g, 0xb8f4ff, 0.62, 0.42, 1.0, 0, 0.92, 0.0, 0x2fc0d0);
  const pil = pilot(g, 0, 0.5, -0.45, 0xf4fbff, C.chine, C.neon);

  return finish(g, {
    flames: fl, under, mats: [...h.mats, rl.material], dome: dm, fpvHide: [dm, pil], fpvFloor: 0.66,
    scale: style.scale || 1,
    extra: (dt, t, speedK, boostK) => {
      const sp = 1 + speedK * 2 + boostK * 3;
      rA.rotation.x += dt * 1.4 * sp; rB.rotation.y += dt * 1.9 * sp; rC.rotation.z += dt * 2.4 * sp; rC.rotation.x += dt * 0.9 * sp;
      orb.scale.setScalar(1 + Math.sin(t * 6) * 0.06 + boostK * 0.25);
      pods.forEach((p, i) => { p.position.y = 0.8 + Math.sin(t * 2 + i * 2) * 0.05; });
    },
  });
}
