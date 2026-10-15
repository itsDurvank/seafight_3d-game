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

// "Krakenhulk" - sea-monster gunboat. Coral-red mantle hull with glowing spots, a big tracking eye, a chomping
// beak at the bow with the guns inside it, and six tentacles that writhe, suckers glowing teal.
// Faces +Z. Beak muzzle at z = 3.8. Deck height 0.7. The eye is hidden in first person (tentacles + beak stay).
export function buildKrakenhulkBoat(style = {}) {
  const C = {
    hull: style.hull ?? 0xe0455c, chine: style.chine ?? 0x8c1d3a, accent: style.accent ?? 0xffb3c1,
    dark: style.dark ?? 0x3a1226, neon: style.neon ?? 0x3ff0c8,
  };
  const g = new THREE.Group(); g.rotation.order = 'YXZ';
  const st = [[-2.4, 0.95, 0.62, -0.3], [-1.4, 1.25, 0.7, -0.35], [0.2, 1.2, 0.72, -0.3], [1.6, 0.9, 0.72, -0.2], [2.8, 0.5, 0.7, -0.05], [3.5, 0.2, 0.72, 0.15]];
  const h = hull(st, C.hull, C.chine), rl = rail(st, C.accent, 0.14); g.add(h.group, rl);

  // mantle + glowing spots
  const mantle = put(g, new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), std(C.hull)), 0, 0.85, -2.45);
  mantle.scale.set(1.05, 0.8, 1.15);
  const spots = [];
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4, r = 0.25 + (i % 3) * 0.15, x = Math.cos(a) * r, zz = Math.sin(a) * r * 1.0;
    const y = 0.85 + 0.8 * Math.sqrt(Math.max(0, 1 - (x / 1.05) ** 2 - (zz / 1.15) ** 2));
    spots.push(ball(g, 0.07 + 0.03 * (i % 2), 0, x, y + 0.02, -2.45 + zz, glow(C.neon)));
  }

  // eye (tracks turns)
  const eye = new THREE.Group(); put(g, eye, 0, 1.05, 1.8);
  put(eye, new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), std(0xfff4f4)), 0, 0, 0);
  put(eye, new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(C.hull)), 0, 0.02, 0);
  const iris = new THREE.Group(); put(eye, iris, 0, -0.04, 0);
  const ir = put(iris, new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), glow(C.neon)), 0, 0, 0.3); ir.scale.z = 0.35;
  box(iris, 0.07, 0.34, 0.05, C.dark, 0, 0, 0.44);

  // beak (lower jaw chomps) with the guns inside
  const upper = cone(g, 0.3, 1.0, C.dark, 0, 0.7, 3.5, 7); upper.rotation.x = 0.25;
  const lowerJ = new THREE.Group(); put(lowerJ, new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.85, 6).rotateX(Math.PI / 2), std(C.chine)), 0, 0, 0.42);
  put(g, lowerJ, 0, 0.5, 3.1);
  for (const s of [-1, 1]) {
    cylZ(g, 0.07, 1.5, C.dark, s * 0.25, 0.8, 3.05);
    cylZ(g, 0.11, 0.12, C.neon, s * 0.25, 0.8, 3.8).material = glow(C.neon);
  }

  // tentacles
  const tentacles = [];
  const makeTent = (x, y, z, yaw, droop, phase) => {
    const root = new THREE.Group(); put(g, root, x, y, z); root.rotation.order = 'YXZ'; root.rotation.set(droop, yaw, 0);
    let parent = root; const links = [];
    for (let i = 0; i < 6; i++) {
      const link = new THREE.Group(); link.position.z = i ? 0.5 : 0; parent.add(link); links.push(link);
      const r = 0.2 * (1 - i / 7);
      put(link, new THREE.Mesh(new THREE.CylinderGeometry(r * 0.85, r, 0.53, 7).rotateX(Math.PI / 2), std(i % 2 ? C.hull : C.chine)), 0, 0, 0.25);
      if (i > 1) ball(link, r * 0.35, 0, 0, -r * 0.9, 0.25, glow(C.neon));
      parent = link;
    }
    tentacles.push({ links, phase });
  };
  for (const s of [-1, 1]) {
    makeTent(s * 1.0, 0.55, 1.6, s * 0.55, 0.25, s * 0.4);
    makeTent(s * 1.1, 0.55, 0.4, s * 1.2, 0.3, s * 1.3 + 2);
    makeTent(s * 1.1, 0.55, -0.9, s * 2.1, 0.3, s * 2.1 + 4);
  }
  for (const s of [-1, 1]) { cylZ(g, 0.3, 1.0, C.dark, s * 0.55, 0.4, -3.3); cylZ(g, 0.34, 0.1, C.accent, s * 0.55, 0.4, -3.82); }
  const fl = flames(g, [[-0.55, 0.4, -3.88, 0.3], [0.55, 0.4, -3.88, 0.3]], C.neon);
  const under = underGlow(g, C.neon, 2.4, 5.0, 0.2);
  const pil = pilot(g, 0, 0.55, -0.5, C.dark, C.accent, C.neon);

  return finish(g, {
    flames: fl, under, mats: [...h.mats, rl.material, mantle.material], fpvHide: [eye, pil], fpvFloor: 0.7,
    scale: style.scale || 1,
    extra: (dt, t, speedK, boostK, turn) => {
      tentacles.forEach(({ links, phase }) => links.forEach((L, i) => {
        L.rotation.x = 0.1 + Math.sin(t * 2.2 + phase - i * 0.8) * 0.2 * (1 + speedK);
        L.rotation.y = Math.cos(t * 1.7 + phase - i * 0.6) * 0.2 + turn * 0.05;
      }));
      lowerJ.rotation.x = 0.1 + Math.max(0, Math.sin(t * 3)) * 0.06 + boostK * 0.4;
      iris.rotation.y += (turn * 0.5 - iris.rotation.y) * (1 - Math.exp(-6 * dt));
      spots.forEach((s, i) => s.scale.setScalar(1 + Math.sin(t * 3 + i) * 0.25 + boostK * 0.3));
    },
  });
}
