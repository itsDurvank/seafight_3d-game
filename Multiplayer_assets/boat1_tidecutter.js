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
function finish(g, { flames: fl = [], under, mats = [], dome: dm, extra, fpvHide = [], scale = 1 }) {
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
  g.scale.setScalar(scale);
  return g;
}

// "Tidecutter" - fast interceptor. Cyan teardrop hull, dark canopy with glowing eyes,
// side gun pods and twin antennas with orb tips. Faces +Z, muzzles at z = 3.0.
export function buildTidecutterBoat(style = {}) {
  const C = {
    hull: style.hull ?? 0x7cf3ff, chine: style.chine ?? 0x2fb4d6, accent: style.accent ?? 0x19e6ff,
    dark: style.dark ?? 0x3a4656, neon: style.neon ?? 0x19e6ff,
  };
  const g = new THREE.Group(); g.rotation.order = 'YXZ';

  const st = [[-2.4, 0.9, 0.6, -0.2], [-1.4, 1.1, 0.65, -0.25], [0, 1.0, 0.7, -0.2], [1.4, 0.7, 0.68, -0.05], [2.8, 0.35, 0.7, 0.2], [3.8, 0.04, 0.75, 0.45]];
  const h = hull(st, C.hull, C.chine), rl = rail(st, C.accent, 0.14);
  g.add(h.group, rl);

  // dark canopy pod with glowing eyes + rear engine hump
  const canopy = put(g, new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), std(C.dark)), 0, 0.95, 0.3);
  canopy.scale.set(0.72, 0.5, 0.95);
  const eyes = [-1, 1].map((s) => put(g, new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.06), glow(C.neon)), s * 0.26, 1.0, 1.2));
  const hump = put(g, new THREE.Mesh(new THREE.DodecahedronGeometry(0.7), std(C.dark)), 0, 0.95, -1.5);
  hump.scale.set(1.1, 0.6, 0.9);

  // antennas with orb tips
  const ants = [-1, 1].map((s) => {
    const p = new THREE.Group(); put(g, p, s * 0.6, 0.8, -2.0); p.rotation.set(-0.15, 0, -s * 0.28);
    put(p, new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.8, 6), std(C.accent)), 0, 0.9, 0);
    ball(p, 0.11, 0, 0, 1.82, 0, glow(C.neon));
    return p;
  });

  // side gun pods
  for (const s of [-1, 1]) {
    box(g, 0.5, 0.45, 1.3, C.dark, s * 1.3, 0.62, 0.7);
    box(g, 0.5, 0.14, 0.5, C.chine, s * 1.05, 0.62, 0.7);
    cylZ(g, 0.1, 1.9, C.dark, s * 1.3, 0.62, 2.0);
    cylZ(g, 0.15, 0.2, C.neon, s * 1.3, 0.62, 3.0).material = glow(C.neon);
    // engines
    cylZ(g, 0.32, 1.0, C.dark, s * 0.5, 0.3, -2.5);
    cylZ(g, 0.36, 0.1, C.accent, s * 0.5, 0.3, -3.05);
  }
  const fl = flames(g, [[-0.5, 0.3, -3.1, 0.32], [0.5, 0.3, -3.1, 0.32]], C.neon);
  const under = underGlow(g, C.neon, 1.9, 4.0, 0.2);

  return finish(g, {
    flames: fl, under, mats: [...h.mats, rl.material, canopy.material], fpvHide: [canopy],
    scale: style.scale || 1,
    extra: (dt, t, speedK) => {
      ants.forEach((a, i) => { a.rotation.x = -0.15 + Math.sin(t * 6 + i * 1.7) * 0.04 * (1 + speedK * 2); });
      eyes.forEach((e) => { e.scale.y = 1 + Math.sin(t * 4) * 0.3; });
    },
  });
}
