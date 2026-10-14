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

// "Blaze Runner" - hot-rod speedboat. Long yellow hull, huge rear engine block, four
// exhaust pipes, open cockpit with windscreen, high spoiler, small rocket pods.
// Faces +Z, rocket tips at z ~ 2.9.
export function buildBlazeRunnerBoat(style = {}) {
  const C = {
    hull: style.hull ?? 0xffd23a, chine: style.chine ?? 0xd8431f, accent: style.accent ?? 0xff4a2a,
    dark: style.dark ?? 0x2a2326, neon: style.neon ?? 0xff9d2e,
  };
  const g = new THREE.Group(); g.rotation.order = 'YXZ';

  const st = [[-2.8, 0.85, 0.6, -0.2], [-1.6, 0.95, 0.62, -0.25], [0, 0.85, 0.66, -0.25], [1.8, 0.55, 0.66, -0.1], [3.4, 0.25, 0.68, 0.15], [4.6, 0.04, 0.72, 0.4]];
  const h = hull(st, C.hull, C.chine), rl = rail(st, C.accent, 0.16, 1.03);
  g.add(h.group, rl);
  // racing stripes down the deck
  for (const s of [-1, 1]) box(g, 0.14, 0.03, 4.2, C.accent, s * 0.28, 0.68, 0.9);

  // open cockpit: tub, seat, windscreen, helmet
  box(g, 1.0, 0.18, 1.5, C.dark, 0, 0.72, 0.2);
  box(g, 0.7, 0.45, 0.2, C.accent, 0, 1.0, -0.4);
  const screen = put(g, new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.45, 0.05), std(0x8eeaff, { transparent: true, opacity: 0.45, emissive: 0x19a0bf, emissiveIntensity: 0.6 })), 0, 1.0, 0.85);
  screen.rotation.x = -0.55;
  const helmet = ball(g, 0.26, C.accent, 0, 1.15, -0.1);
  box(g, 0.34, 0.1, 0.2, C.dark, 0, 1.17, 0.12);

  // rear engine block with exhaust pipes + intakes
  box(g, 1.7, 0.7, 1.2, C.dark, 0, 0.95, -1.9);
  box(g, 1.1, 0.18, 0.7, C.accent, 0, 1.4, -1.9);
  const pipes = [];
  for (const s of [-1, 1]) for (const k of [0, 1]) {
    const p = new THREE.Group(); put(g, p, s * (0.95 + k * 0.28), 0.85, -1.9 - k * 0.3);
    p.rotation.z = -s * 0.5;
    put(p, new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.9, 8), std(C.neon, { metalness: 0.4 })), 0, 0.4, 0);
    pipes.push(p);
  }

  // spoiler
  for (const s of [-1, 1]) box(g, 0.08, 0.7, 0.4, C.dark, s * 0.9, 1.0, -3.0);
  box(g, 2.2, 0.08, 0.7, C.accent, 0, 1.4, -3.05);

  // small rocket pods on the front flanks
  for (const s of [-1, 1]) {
    box(g, 0.34, 0.3, 1.2, C.dark, s * 0.82, 0.78, 1.3);
    for (const o of [-0.08, 0.08]) {
      cylZ(g, 0.07, 1.2, 0xf5f5f5, s * 0.82 + o, 0.8, 1.9);
      const tip = put(g, new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.26, 8), std(0xff4d4d)), s * 0.82 + o, 0.8, 2.6);
      tip.rotation.x = Math.PI / 2;
    }
    // engine nozzles (big)
    cylZ(g, 0.36, 1.1, C.dark, s * 0.5, 0.3, -3.2);
    cylZ(g, 0.4, 0.1, C.accent, s * 0.5, 0.3, -3.78);
  }
  const fl = flames(g, [[-0.5, 0.3, -3.85, 0.38], [0.5, 0.3, -3.85, 0.38]], C.neon, 0xfff2b0);
  const under = underGlow(g, C.neon, 1.8, 4.6, 0.3);

  return finish(g, {
    flames: fl, under, mats: [...h.mats, rl.material], fpvHide: [helmet, screen],
    scale: style.scale || 1,
    extra: (dt, t, speedK, boostK, turn) => {
      pipes.forEach((p, i) => { const s = i < 2 ? -1 : 1; p.rotation.z = -s * (0.5 + Math.sin(t * 40 + i) * 0.02 * (1 + boostK * 3)); });
      helmet.rotation.z += (-turn * 0.4 - helmet.rotation.z) * (1 - Math.exp(-8 * dt));
    },
  });
}
