import * as THREE from 'three';

// "Sunfire" - the hero boat. Drop-in replacement for the player's model:
// same footprint as the old boat, chin guns muzzle at z = 3.6 (where bullets spawn), faces +Z.
// Animated through g.userData.update(dt, t, boat) and g.userData.hit().

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.7, ...extra });
const glow = (color, opacity = 1, additive = false) => new THREE.MeshBasicMaterial({
  color, transparent: opacity < 1 || additive, opacity, depthWrite: !additive, side: THREE.DoubleSide,
  blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
});
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Loft a hull from cross-sections: [z, halfWidth, deckY, keelY]. Real boat silhouette, flat-shaded facets.
function loft(stations, color, { bottomTaper = 0.7, widen = 1, band = 0 } = {}) {
  const sec = ([z, hw, top, bot]) => {
    const a = hw * widen, b = hw * bottomTaper * widen;
    const t = top + (band ? 0.02 : 0), bt = band ? top - band : bot;
    return [[-a, t, z], [a, t, z], [band ? a : b, bt, z], [band ? -a : -b, bt, z]];
  };
  const S = stations.map(sec), pos = [];
  const tri = (p, q, r) => pos.push(...p, ...q, ...r);
  for (let i = 0; i < S.length - 1; i++) {
    for (let k = 0; k < 4; k++) {
      const a = S[i][k], b = S[i][(k + 1) % 4], c = S[i + 1][(k + 1) % 4], d = S[i + 1][k];
      tri(a, b, c); tri(a, c, d);
    }
  }
  const s0 = S[0]; tri(s0[0], s0[1], s0[2]); tri(s0[0], s0[2], s0[3]); // stern cap
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, std(color, { side: THREE.DoubleSide }));
}

export function buildHeroBoat(style = {}) {
  const C = {
    hull: style.hull ?? 0xfff4e0, accent: style.accent ?? 0xff7a59, roof: style.roof ?? 0xff8a3d,
    flag: style.flag ?? 0xffe066, cabin: style.cabin ?? 0xffd9a0, dark: 0x3b4452, neon: 0x39e6ff,
  };
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  const add = (m, x = 0, y = 0, z = 0, parent = g) => { m.position.set(x, y, z); parent.add(m); return m; };
  const cyl = (r, len, color, x, y, z, parent) => {
    const geo = new THREE.CylinderGeometry(r, r, len, 10); geo.rotateX(Math.PI / 2);
    return add(new THREE.Mesh(geo, std(color)), x, y, z, parent);
  };
  const flashMats = [];

  // ---- hull: lofted body + gunwale rail + keel ----
  const st = [[-2.6, 1.0, 0.65, -0.2], [-1.8, 1.15, 0.65, -0.25], [-0.4, 1.15, 0.7, -0.25],
              [1.0, 1.0, 0.7, -0.15], [2.4, 0.62, 0.68, 0.0], [3.5, 0.28, 0.7, 0.25], [4.4, 0.04, 0.75, 0.5]];
  const hull = loft(st, C.hull); g.add(hull);
  const rail = loft(st, C.accent, { band: 0.2, widen: 1.03 }); g.add(rail);
  const keel = loft(st.map(([z, hw, t, b]) => [z, hw * 0.35, b + 0.1, b - 0.15]), C.dark, { bottomTaper: 0.6 }); g.add(keel);
  flashMats.push(hull.material, rail.material);

  // neon strips along the flanks
  for (const s of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 3.1), glow(C.neon)), s * 1.2, 0.45, -0.3);

  // ---- cockpit: cabin, glass dome, and the pilot ----
  add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 2.1), std(C.cabin)), 0, 0.95, -0.7);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), std(0x8eeaff, { transparent: true, opacity: 0.5, emissive: 0x1a7a99, emissiveIntensity: 0.6 }));
  dome.scale.set(0.8, 0.55, 1.25); add(dome, 0, 1.3, -0.5);

  const pilot = new THREE.Group(); add(pilot, 0, 0, -0.45);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.32, 0.3), std(C.accent)), 0, 1.3, 0, pilot); // jacket
  const head = new THREE.Group(); add(head, 0, 1.52, 0, pilot);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 8), std(0xffd2a8)), 0, 0, 0, head);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), std(C.roof)), 0, 0.04, 0, head); // cap
  add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.1), std(C.dark)), 0, 0.04, 0.2, head); // goggles
  add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.04), glow(C.neon)), 0, 0.04, 0.26, head);
  const scarf = []; let sp = new THREE.Group(); add(sp, 0, 1.38, -0.17, pilot); // streaming scarf
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.Group(); add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.4), std(C.flag)), 0, 0, -0.2, seg);
    seg.position.z = i ? -0.4 : 0; sp.add(seg); scarf.push(seg); sp = seg;
  }

  // ---- weapons: chin guns (muzzles at z = 3.6) and shoulder missile racks ----
  for (const s of [-1, 1]) {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 1.0), std(C.dark)), s * 0.5, 0.88, 1.9);
    cyl(0.1, 1.9, C.dark, s * 0.5, 0.95, 2.65);
    cyl(0.14, 0.18, C.accent, s * 0.5, 0.95, 3.55); // muzzle ring
    const rack = new THREE.Group(); add(rack, s * 0.98, 0.95, 0.4); rack.rotation.x = -0.08;
    add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 1.5), std(C.dark)), 0, 0, 0, rack);
    for (const o of [-0.1, 0.1]) {
      cyl(0.09, 1.5, 0xf2f2f2, o, 0.04, 0.15, rack);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 8), std(0xff4d4d)); tip.rotation.x = Math.PI / 2; add(tip, o, 0.04, 1.05, rack);
    }
    // swept hydrofoil wings with tip lights
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.07, 1.5), std(C.accent));
    add(wing, s * 1.7, 0.3, -0.9); wing.rotation.set(0, s * 0.4, -s * 0.12);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), glow(C.neon)), s * 2.2, 0.28, -1.15);
  }

  // ---- tail fin + pennant ----
  const fs = new THREE.Shape(); fs.moveTo(0, 0); fs.lineTo(1.7, 0); fs.lineTo(1.3, 1.5); fs.lineTo(0.8, 1.5); fs.closePath();
  const fg = new THREE.ExtrudeGeometry(fs, { depth: 0.1, bevelEnabled: false }); fg.translate(0, 0, -0.05); fg.rotateY(Math.PI / 2);
  add(new THREE.Mesh(fg, std(C.accent, { side: THREE.DoubleSide })), 0, 0.65, -1.5);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 5), std(0xffffff)), 0, 2.75, -2.55);
  const flagGeo = new THREE.PlaneGeometry(1.1, 0.5, 6, 1); flagGeo.translate(0.55, 0, 0); flagGeo.rotateY(Math.PI / 2);
  const flag = add(new THREE.Mesh(flagGeo, std(C.flag, { side: THREE.DoubleSide })), 0, 3.15, -2.55);
  const flagBase = flagGeo.attributes.position.array.slice();

  // ---- engines: twin nozzles with boost flames ----
  const flames = [];
  const coneBack = (r, h, mat) => { const geo = new THREE.ConeGeometry(r, h, 10); geo.rotateX(-Math.PI / 2); geo.translate(0, 0, -h / 2); return new THREE.Mesh(geo, mat); };
  for (const s of [-1, 1]) {
    cyl(0.4, 1.2, C.dark, s * 0.55, 0.32, -3.0);
    cyl(0.44, 0.12, C.accent, s * 0.55, 0.32, -3.62);
    const core = add(coneBack(0.26, 1, glow(0xd8fbff, 0.95, true)), s * 0.55, 0.32, -3.66);
    const outer = add(coneBack(0.42, 1, glow(C.neon, 0.5, true)), s * 0.55, 0.32, -3.66);
    flames.push(core, outer);
  }
  const under = new THREE.Mesh(new THREE.CircleGeometry(1, 28), glow(C.neon, 0.22, true)); // underglow on the water
  under.rotation.x = -Math.PI / 2; under.scale.set(1.9, 4.2, 1); add(under, 0, -0.02, 0.2);

  // ---- animation hooks ----
  let boostK = 0, flashK = 0;
  g.userData.hit = () => { flashK = 1; };
  g.userData.update = (dt, t, boat) => {
    const speed = Math.max(0, boat.state.speed), turn = boat.state.turnVel || 0;
    const speedK = clamp(speed / 114, 0, 1);
    boostK += ((boat.boosting ? 1 : 0) - boostK) * (1 - Math.exp(-8 * dt));
    const flick = 0.9 + Math.sin(t * 60) * 0.1;
    const len = (0.5 + speedK * 1.0 + boostK * 2.6) * flick;
    flames.forEach((f, i) => { f.scale.set(1 + boostK * 0.4, 1 + boostK * 0.4, len * (i % 2 ? 0.8 : 1)); f.visible = len > 0.55; });
    under.material.opacity = 0.18 + speedK * 0.12 + boostK * 0.35;
    head.rotation.z += (-turn * 0.35 - head.rotation.z) * (1 - Math.exp(-8 * dt));  // pilot leans into turns
    pilot.rotation.x = -speedK * 0.12 - boostK * 0.1;
    scarf.forEach((s, i) => { s.rotation.y = Math.sin(t * 13 - i * 0.9) * (0.1 + speedK * 0.35); s.rotation.x = Math.sin(t * 9 - i) * 0.08 * (1 + speedK); });
    const p = flag.geometry.attributes.position, amp = 0.05 + speedK * 0.2 + boostK * 0.15;
    for (let i = 0; i < p.count; i++) {
      const d = Math.abs(flagBase[i * 3 + 2]);
      p.setX(i, flagBase[i * 3] + Math.sin(t * 14 - d * 6) * amp * d);
    }
    p.needsUpdate = true;
    flashK = Math.max(0, flashK - dt * 4);
    flashMats.forEach((m) => m.emissive.setRGB(flashK * 0.9, flashK * 0.1, flashK * 0.05));
    dome.material.emissiveIntensity = 0.6 + boostK * 0.9 + flashK;
  };

  g.scale.setScalar(style.scale || 1);
  return g;
}
