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

// "Manta" - delta-wing ray boat. Purple body, glowing eyes, wing-tip guns, tail spine.
// Faces +Z, muzzles at z = 2.2.
export function buildMantaBoat(style = {}) {
  const C = {
    hull: style.hull ?? 0xb36bff, chine: style.chine ?? 0x5a2fa0, accent: style.accent ?? 0xe6c8ff,
    dark: style.dark ?? 0x2a1f45, neon: style.neon ?? 0xff5ce1,
  };
  const g = new THREE.Group(); g.rotation.order = 'YXZ';

  // delta body: shape x = lateral, shape y = forward (+Z) after rotateX(+PI/2)
  const sh = new THREE.Shape();
  sh.moveTo(0, 3.4); sh.lineTo(3.4, -1.0); sh.lineTo(1.4, -1.4); sh.lineTo(0, -2.2);
  sh.lineTo(-1.4, -1.4); sh.lineTo(-3.4, -1.0); sh.closePath();
  const bg = new THREE.ExtrudeGeometry(sh, { depth: 0.35, bevelEnabled: false });
  bg.rotateX(Math.PI / 2); bg.translate(0, 0.3, 0);
  const body = put(g, new THREE.Mesh(bg, std(C.hull, { side: THREE.DoubleSide })));
  // darker belly plate + centre keel
  const sh2 = new THREE.Shape();
  sh2.moveTo(0, 2.6); sh2.lineTo(1.2, -0.8); sh2.lineTo(0, -1.8); sh2.lineTo(-1.2, -0.8); sh2.closePath();
  const pg = new THREE.ExtrudeGeometry(sh2, { depth: 0.1, bevelEnabled: false });
  pg.rotateX(Math.PI / 2); pg.translate(0, 0.36, 0);
  const plate = put(g, new THREE.Mesh(pg, std(C.chine, { side: THREE.DoubleSide })));
  box(g, 0.12, 0.45, 3.4, C.dark, 0, -0.1, 0.2);

  // glass dome + eyes
  const dm = dome(g, 0xe4b8ff, 0.7, 0.5, 1.1, 0, 0.45, 0.3, 0x9a40d0);
  const eyes = [-1, 1].map((s) => put(g, new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), glow(C.neon)), s * 0.5, 0.42, 2.15));

  // wing-tip pods with guns (they flap a little)
  const tips = [-1, 1].map((s) => {
    const p = new THREE.Group(); put(g, p, s * 2.7, 0.35, -0.4);
    box(p, 0.4, 0.3, 1.1, C.dark, 0, 0, 0);
    cylZ(p, 0.08, 1.3, C.dark, 0, 0, 1.0);
    cylZ(p, 0.13, 0.16, C.neon, 0, 0, 1.7).material = glow(C.neon);
    ball(p, 0.1, 0, 0, 0.05, -0.65, glow(C.neon));
    return p;
  });

  // tail spine with glowing tip
  const tail = new THREE.Group(); put(g, tail, 0, 0.35, -2.1);
  cylZ(tail, 0.07, 2.2, C.dark, 0, 0, -1.1, 6);
  ball(tail, 0.14, 0, 0, 0, -2.3, glow(C.neon));
  // engines
  for (const s of [-1, 1]) { cylZ(g, 0.3, 0.9, C.dark, s * 0.7, 0.3, -1.9); cylZ(g, 0.34, 0.1, C.accent, s * 0.7, 0.3, -2.4); }
  const fl = flames(g, [[-0.7, 0.3, -2.45, 0.3], [0.7, 0.3, -2.45, 0.3]], C.neon);
  const under = underGlow(g, C.neon, 3.4, 3.4, 0.2);

  return finish(g, {
    flames: fl, under, mats: [body.material, plate.material], dome: dm, fpvHide: [dm],
    scale: style.scale || 1,
    extra: (dt, t, speedK, boostK, turn) => {
      tips.forEach((p, i) => { const s = i ? 1 : -1; p.position.y = 0.35 + Math.sin(t * 3 + i * Math.PI) * 0.07; p.rotation.z = -s * (0.05 + Math.sin(t * 3 + i * Math.PI) * 0.1) + turn * 0.1 * s; });
      tail.rotation.y = Math.sin(t * 4) * (0.1 + speedK * 0.2) - turn * 0.2;
      tail.rotation.x = Math.sin(t * 3) * 0.05;
      eyes.forEach((e, i) => { e.scale.setScalar(1 + Math.sin(t * 5 + i) * 0.2); });
    },
  });
}
