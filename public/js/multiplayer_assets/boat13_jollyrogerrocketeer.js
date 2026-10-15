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

// "Jolly Roger Rocketeer" - rocket-powered pirate galleon. Wooden hull with raised bow + quarterdeck, glowing
// stern windows, billowing sails and a skull-and-crossbones flag, cannons in the hull, bow chasers, and two
// rocket barrels hanging off the stern.
// Faces +Z. Bow-chaser muzzles at z = 4.0. Deck height 0.75. Rigging, mast, sails, helm all hidden in first person.
export function buildJollyRogerRocketeerBoat(style = {}) {
  const C = {
    hull: style.hull ?? 0xc08a52, chine: style.chine ?? 0x6e4426, accent: style.accent ?? 0xe9c46a,
    dark: style.dark ?? 0x2a1c14, neon: style.neon ?? 0xff7a1f, sail: style.sail ?? 0xf5ecd6,
  };
  const g = new THREE.Group(); g.rotation.order = 'YXZ';
  const st = [[-2.6, 1.0, 0.9, -0.3], [-1.6, 1.25, 0.85, -0.35], [0, 1.2, 0.75, -0.35], [1.8, 0.9, 0.75, -0.2], [3.2, 0.5, 0.85, 0], [4.0, 0.15, 1.0, 0.3]];
  const h = hull(st, C.hull, C.chine), rl = rail(st, C.accent, 0.18, 1.03); g.add(h.group, rl);

  // quarterdeck, windows, lanterns
  box(g, 2.2, 0.55, 1.3, C.chine, 0, 1.0, -2.1); box(g, 2.3, 0.08, 1.4, C.accent, 0, 1.31, -2.1);
  for (const x of [-0.6, 0, 0.6]) box(g, 0.3, 0.22, 0.05, 0, x, 1.05, -2.77).material = glow(0xffd36a);
  const lanterns = [-1, 1].map((s) => ball(g, 0.1, 0, s * 0.95, 1.5, -2.7, glow(0xffd36a)));

  // hull cannons + bow chasers + stern rockets
  for (const s of [-1, 1]) for (const z of [-0.6, 0.6, 1.8]) {
    const x = s * (sampleSt(st, z).hw + 0.08);
    const bg = new THREE.CylinderGeometry(0.1, 0.1, 0.6, 8); bg.rotateZ(Math.PI / 2);
    put(g, new THREE.Mesh(bg, std(C.dark)), x, 0.5, z);
    const rg = new THREE.CylinderGeometry(0.14, 0.14, 0.1, 8); rg.rotateZ(Math.PI / 2);
    put(g, new THREE.Mesh(rg, std(C.accent)), x + s * 0.3, 0.5, z);
  }
  for (const s of [-1, 1]) {
    box(g, 0.28, 0.26, 0.7, C.dark, s * 0.4, 0.95, 2.6);
    cylZ(g, 0.1, 1.6, C.dark, s * 0.4, 0.97, 3.2);
    cylZ(g, 0.14, 0.12, C.accent, s * 0.4, 0.97, 4.0).material = glow(C.neon);
    cylZ(g, 0.4, 1.2, 0x7a4a2a, s * 0.55, 0.55, -3.0);
    for (const z of [-2.6, -3.0, -3.4]) ring(g, 0.41, 0.04, std(0x2a2a2a), s * 0.55, 0.55, z);
    const nz = cone(g, 0.35, 0.5, 0x2a2a2a, s * 0.55, 0.55, -3.75, 8); nz.rotation.y = Math.PI;
  }

  // ---- rigging (hidden in first person) ----
  const rig = new THREE.Group(); put(g, rig, 0, 0, 0);
  put(rig, new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 3.4, 8), std(C.chine)), 0, 2.5, 0.9);
  box(rig, 2.0, 0.07, 0.07, C.chine, 0, 3.6, 0.9); box(rig, 2.5, 0.07, 0.07, C.chine, 0, 2.55, 0.9);
  put(rig, new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.25, 8), std(C.chine)), 0, 3.95, 0.9);
  const mkSail = (w, hh, y) => {
    const geo = new THREE.PlaneGeometry(w, hh, 8, 4);
    const m = put(rig, new THREE.Mesh(geo, std(C.sail, { side: THREE.DoubleSide })), 0, y, 0.95);
    return { m, base: geo.attributes.position.array.slice(), w, hh };
  };
  const sails = [mkSail(1.5, 0.9, 3.1), mkSail(1.9, 1.2, 1.95)];
  const skull = (() => {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas'); c.width = 128; c.height = 64; const x = c.getContext('2d');
    x.fillStyle = '#15110f'; x.fillRect(0, 0, 128, 64); x.fillStyle = '#f4efe6'; x.strokeStyle = '#f4efe6'; x.lineWidth = 5;
    x.beginPath(); x.arc(64, 26, 15, 0, Math.PI * 2); x.fill(); x.fillRect(54, 34, 20, 12);
    x.fillStyle = '#15110f'; x.beginPath(); x.arc(58, 25, 4, 0, 7); x.arc(70, 25, 4, 0, 7); x.fill();
    x.beginPath(); x.moveTo(30, 52); x.lineTo(98, 14); x.moveTo(98, 52); x.lineTo(30, 14); x.stroke();
    const t = new THREE.CanvasTexture(c); return t;
  })();
  const flagGeo = new THREE.PlaneGeometry(1.0, 0.6, 6, 1); flagGeo.translate(0.5, 0, 0); flagGeo.rotateY(Math.PI / 2);
  const flag = put(rig, new THREE.Mesh(flagGeo, new THREE.MeshBasicMaterial({ color: skull ? 0xffffff : 0x15110f, map: skull, side: THREE.DoubleSide })), 0, 4.3, 0.9);
  const flagBase = flagGeo.attributes.position.array.slice();
  bar(rig, [0, 0.95, 3.3], [0, 1.5, 5.0], 0.1, 0.1, std(C.chine));
  ball(rig, 0.2, C.accent, 0, 1.1, 3.95);
  // helm
  ring(rig, 0.28, 0.04, std(C.accent), 0, 1.0, 0.15);
  for (let i = 0; i < 4; i++) { const sp = box(rig, 0.03, 0.56, 0.03, C.accent, 0, 1.0, 0.15); sp.rotation.z = (i * Math.PI) / 4; }
  const pil = pilot(g, 0, 0.6, -0.5, 0x3a2418, 0x15110f, 0xffd36a);
  put(pil, new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.07, 3), std(0x15110f)), 0, 0.98, 0);

  const fl = flames(g, [[-0.55, 0.55, -4.0, 0.36], [0.55, 0.55, -4.0, 0.36]], C.neon, 0xfff2b0);
  const under = underGlow(g, C.neon, 2.0, 5.0, 0.2);

  return finish(g, {
    flames: fl, under, mats: [...h.mats, rl.material], fpvHide: [rig, pil], fpvFloor: 0.75,
    scale: style.scale || 1,
    extra: (dt, t, speedK, boostK, turn) => {
      sails.forEach(({ m, base, w, hh }) => {
        const p = m.geometry.attributes.position, amp = 0.12 + speedK * 0.3 + Math.sin(t * 3) * 0.03;
        for (let i = 0; i < p.count; i++) {
          const x = base[i * 3], y = base[i * 3 + 1];
          p.setZ(i, (1 - (2 * x / w) ** 2) * (1 - (2 * y / hh) ** 2 * 0.4) * amp);
        }
        p.needsUpdate = true;
      });
      const fp = flag.geometry.attributes.position, fa = 0.05 + speedK * 0.2 + boostK * 0.15;
      for (let i = 0; i < fp.count; i++) { const d = Math.abs(flagBase[i * 3 + 2]); fp.setX(i, flagBase[i * 3] + Math.sin(t * 14 - d * 6) * fa * d); }
      fp.needsUpdate = true;
      rig.rotation.z += ((-turn * 0.05 + Math.sin(t * 1.4) * 0.012) - rig.rotation.z) * (1 - Math.exp(-4 * dt));
      lanterns.forEach((l, i) => l.scale.setScalar(1 + Math.sin(t * 9 + i * 2) * 0.15));
    },
  });
}
