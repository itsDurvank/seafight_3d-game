import * as THREE from 'three';

// Harbor Comet: premium main-player boat asset.
// Standalone drop-in builder. It faces +Z and keeps the forward gun muzzles
// near z = 3.6, matching the current player firing positions.

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function standard(color, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: 0.62,
    metalness: 0.02,
    ...extra,
  });
}

function glow(color, opacity = 1) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}

function makeHull(stations, material, bottomScale = 0.66) {
  const sections = stations.map(([z, halfWidth, deckY, keelY]) => {
    const chine = halfWidth * bottomScale;
    return [
      [-halfWidth, deckY, z],
      [halfWidth, deckY, z],
      [chine, keelY, z],
      [-chine, keelY, z],
    ];
  });
  const pos = [];
  const tri = (a, b, c) => pos.push(...a, ...b, ...c);

  for (let i = 0; i < sections.length - 1; i++) {
    const a = sections[i];
    const b = sections[i + 1];
    for (let k = 0; k < 4; k++) {
      const p0 = a[k];
      const p1 = a[(k + 1) % 4];
      const p2 = b[(k + 1) % 4];
      const p3 = b[k];
      tri(p0, p1, p2);
      tri(p0, p2, p3);
    }
  }

  const first = sections[0];
  tri(first[0], first[1], first[2]);
  tri(first[0], first[2], first[3]);
  const last = sections[sections.length - 1];
  tri(last[0], last[2], last[1]);
  tri(last[0], last[3], last[2]);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

function addBox(parent, size, color, position, rotation = [0, 0, 0], extra = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), standard(color, extra));
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  parent.add(mesh);
  return mesh;
}

function addCylinder(parent, radius, length, color, position, axis = 'z', extra = {}) {
  const geo = new THREE.CylinderGeometry(radius, radius, length, 12);
  if (axis === 'z') geo.rotateX(Math.PI / 2);
  if (axis === 'x') geo.rotateZ(Math.PI / 2);
  const mesh = new THREE.Mesh(geo, standard(color, extra));
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}

function addWindow(parent, x, y, z, sx, sy, sz) {
  return addBox(parent, [sx, sy, sz], 0x82f3ff, [x, y, z], [0, 0, 0], {
    emissive: 0x1fb7d0,
    emissiveIntensity: 0.65,
    transparent: true,
    opacity: 0.72,
    roughness: 0.18,
  });
}

function makeFinShape() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(1.35, 0.18);
  shape.lineTo(1.1, 1.35);
  shape.lineTo(0.22, 1.0);
  shape.lineTo(0, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: false });
  geo.center();
  return geo;
}

function makePennantGeometry() {
  const geo = new THREE.PlaneGeometry(1.15, 0.52, 8, 1);
  geo.translate(0.57, 0, 0);
  geo.rotateY(Math.PI / 2);
  return geo;
}

export function buildHarborCometBoat(style = {}) {
  const C = {
    hull: style.hull ?? 0xfff4e0,
    trim: style.accent ?? style.trim ?? 0xff6a4a,
    trim2: style.trim2 ?? 0x14c7c2,
    cabin: style.cabin ?? 0xffd49c,
    roof: style.roof ?? 0xff8a3d,
    dark: style.dark ?? 0x243140,
    graphite: style.graphite ?? 0x3b4452,
    glass: style.glass ?? 0x8aeaff,
    flag: style.flag ?? 0xffe066,
    foam: style.foam ?? 0xf9fff7,
    flame: style.flame ?? 0xff8a2a,
  };

  const group = new THREE.Group();
  group.rotation.order = 'YXZ';

  const animated = {
    fins: [],
    flames: [],
    exhaustGlow: [],
    pennants: [],
    railLights: [],
    hitMaterials: [],
  };

  const hullStations = [
    [-3.05, 0.82, 0.58, -0.16],
    [-2.25, 1.18, 0.66, -0.28],
    [-0.9, 1.31, 0.72, -0.34],
    [0.65, 1.18, 0.74, -0.22],
    [2.1, 0.78, 0.75, 0.02],
    [3.35, 0.34, 0.76, 0.27],
    [4.18, 0.04, 0.78, 0.52],
  ];

  const hullMat = standard(C.hull);
  const hull = makeHull(hullStations, hullMat);
  group.add(hull);
  animated.hitMaterials.push(hullMat);

  const beltStations = hullStations.map(([z, w, y, k]) => [z, w * 1.035, y + 0.045, Math.max(k, y - 0.18)]);
  const beltMat = standard(C.trim);
  group.add(makeHull(beltStations, beltMat, 0.96));
  animated.hitMaterials.push(beltMat);

  const keelMat = standard(C.dark);
  group.add(makeHull(hullStations.map(([z, w, y, k]) => [z, w * 0.35, k + 0.1, k - 0.12]), keelMat, 0.55));

  addBox(group, [1.65, 0.12, 3.75], C.trim2, [0, 0.83, -0.34]);
  addBox(group, [0.48, 0.12, 1.2], C.trim2, [-0.94, 0.82, 1.3], [0, 0.18, 0]);
  addBox(group, [0.48, 0.12, 1.2], C.trim2, [0.94, 0.82, 1.3], [0, -0.18, 0]);

  for (const side of [-1, 1]) {
    addBox(group, [0.08, 0.08, 3.1], C.trim2, [side * 1.32, 0.5, -0.3]);
    const light = addBox(group, [0.06, 0.06, 2.8], C.trim2, [side * 1.37, 0.56, -0.25], [0, 0, 0], {
      emissive: C.trim2,
      emissiveIntensity: 1.2,
    });
    animated.railLights.push(light);
  }

  // Hydrofoil outriggers give the silhouette a fast, premium profile while
  // staying inside the gameplay collision radius visually.
  for (const side of [-1, 1]) {
    const outrigger = new THREE.Group();
    outrigger.position.set(side * 1.58, 0.2, -0.72);
    outrigger.rotation.y = side * 0.09;
    group.add(outrigger);

    addBox(outrigger, [0.28, 0.22, 3.2], C.foam, [0, 0, 0]);
    addBox(outrigger, [0.32, 0.08, 3.25], C.trim, [0, 0.17, 0]);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.7, 4), standard(C.foam));
    nose.rotation.x = Math.PI / 2;
    nose.rotation.y = Math.PI / 4;
    nose.position.set(0, 0.01, 1.9);
    outrigger.add(nose);

    const fin = new THREE.Mesh(makeFinShape(), standard(C.trim));
    fin.position.set(side * 0.02, 0.34, -0.95);
    fin.rotation.set(0, side * 0.25, side * -0.28);
    outrigger.add(fin);
    animated.fins.push(fin);

    addCylinder(group, 0.06, 1.38, C.graphite, [side * 0.92, 0.42, -0.65], 'x');
    addCylinder(group, 0.05, 1.12, C.graphite, [side * 0.8, 0.5, 0.75], 'x');
  }

  // Armored cabin and glass canopy.
  addBox(group, [1.42, 0.5, 1.85], C.cabin, [0, 1.05, -0.62]);
  addBox(group, [1.58, 0.18, 1.95], C.roof, [0, 1.38, -0.62]);
  addBox(group, [1.18, 0.24, 1.2], C.dark, [0, 1.52, -0.23], [0, 0, 0], { roughness: 0.5 });
  addWindow(group, 0, 1.62, 0.33, 0.82, 0.22, 0.08);
  addWindow(group, -0.62, 1.55, -0.23, 0.08, 0.18, 0.78);
  addWindow(group, 0.62, 1.55, -0.23, 0.08, 0.18, 0.78);

  const domeMat = standard(C.glass, {
    transparent: true,
    opacity: 0.44,
    emissive: 0x1aa6c8,
    emissiveIntensity: 0.7,
    roughness: 0.1,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), domeMat);
  dome.scale.set(0.74, 0.38, 0.98);
  dome.position.set(0, 1.8, -0.22);
  group.add(dome);

  // Deck hardware.
  for (const side of [-1, 1]) {
    addCylinder(group, 0.08, 1.72, C.dark, [side * 0.48, 0.92, 2.68], 'z');
    addCylinder(group, 0.125, 0.2, C.trim, [side * 0.48, 0.92, 3.55], 'z');
    addBox(group, [0.42, 0.28, 0.58], C.graphite, [side * 0.48, 0.89, 2.03]);

    const rack = new THREE.Group();
    rack.position.set(side * 0.92, 1.32, -0.43);
    rack.rotation.x = -0.06;
    group.add(rack);
    addBox(rack, [0.38, 0.3, 1.16], C.dark, [0, 0, 0]);
    for (const offset of [-0.09, 0.09]) {
      addCylinder(rack, 0.075, 1.08, 0xf7f4e8, [offset, 0.04, 0.08], 'z');
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.26, 10), standard(0xff4d4d));
      tip.rotation.x = Math.PI / 2;
      tip.position.set(offset, 0.04, 0.72);
      rack.add(tip);
    }
  }

  const turret = new THREE.Group();
  turret.position.set(0, 1.5, -1.33);
  group.add(turret);
  addCylinder(turret, 0.34, 0.22, C.graphite, [0, 0, 0], 'y');
  addBox(turret, [0.74, 0.18, 0.5], C.dark, [0, 0.14, 0.08]);
  addCylinder(turret, 0.06, 1.0, C.dark, [-0.18, 0.18, 0.47], 'z');
  addCylinder(turret, 0.06, 1.0, C.dark, [0.18, 0.18, 0.47], 'z');

  // Tail fin, mast, flag and animated pennants.
  const tail = new THREE.Mesh(makeFinShape(), standard(C.trim));
  tail.position.set(0, 1.15, -2.34);
  tail.rotation.y = Math.PI / 2;
  group.add(tail);
  animated.fins.push(tail);

  addCylinder(group, 0.04, 1.55, 0xffffff, [0, 2.6, -2.58], 'y');
  const flagGeo = makePennantGeometry();
  const flagBase = flagGeo.attributes.position.array.slice();
  const flag = new THREE.Mesh(flagGeo, standard(C.flag, { side: THREE.DoubleSide }));
  flag.position.set(0, 3.12, -2.58);
  group.add(flag);
  animated.pennants.push({ mesh: flag, base: flagBase });

  for (const side of [-1, 1]) {
    const pennantGeo = makePennantGeometry();
    const base = pennantGeo.attributes.position.array.slice();
    const pennant = new THREE.Mesh(pennantGeo, standard(C.trim2, { side: THREE.DoubleSide }));
    pennant.scale.set(0.54, 0.54, 0.54);
    pennant.position.set(side * 1.18, 0.86, -2.28);
    group.add(pennant);
    animated.pennants.push({ mesh: pennant, base });
  }

  // Engine pods and boost flames.
  const flameMat = glow(C.flame, 0.62);
  const flameCoreMat = glow(0xfff0a5, 0.92);
  for (const side of [-1, 1]) {
    addCylinder(group, 0.31, 1.0, C.dark, [side * 0.48, 0.35, -3.22], 'z');
    addCylinder(group, 0.36, 0.12, C.trim, [side * 0.48, 0.35, -3.76], 'z');

    const flameOuter = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.0, 14), flameMat);
    flameOuter.rotation.x = -Math.PI / 2;
    flameOuter.position.set(side * 0.48, 0.35, -4.16);
    group.add(flameOuter);
    animated.flames.push(flameOuter);

    const flameCore = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.82, 12), flameCoreMat);
    flameCore.rotation.x = -Math.PI / 2;
    flameCore.position.set(side * 0.48, 0.35, -4.08);
    group.add(flameCore);
    animated.flames.push(flameCore);

    const glowDisc = new THREE.Mesh(new THREE.CircleGeometry(0.46, 18), glow(C.trim2, 0.28));
    glowDisc.position.set(side * 0.48, 0.35, -3.82);
    glowDisc.rotation.y = Math.PI;
    group.add(glowDisc);
    animated.exhaustGlow.push(glowDisc);
  }

  const underglow = new THREE.Mesh(new THREE.CircleGeometry(1, 32), glow(C.trim2, 0.18));
  underglow.rotation.x = -Math.PI / 2;
  underglow.scale.set(1.7, 4.3, 1);
  underglow.position.set(0, -0.03, -0.12);
  group.add(underglow);

  let boostAmount = 0;
  let hitFlash = 0;
  group.userData.hit = () => { hitFlash = 1; };
  group.userData.update = (dt, t, boat = {}) => {
    const state = boat.state || {};
    const speed = Math.max(0, state.speed || 0);
    const turn = state.turnVel || 0;
    const speedAmount = clamp(speed / 115, 0, 1);
    const targetBoost = boat.boosting ? 1 : 0;
    boostAmount += (targetBoost - boostAmount) * (1 - Math.exp(-dt * 8));

    const flameLength = 0.4 + speedAmount * 0.85 + boostAmount * 2.1;
    animated.flames.forEach((flame, index) => {
      const flicker = 0.88 + Math.sin(t * 62 + index * 1.7) * 0.12;
      const scale = index % 2 === 0 ? 1 : 0.72;
      flame.scale.setScalar(1);
      flame.scale.z = flameLength * flicker * scale;
      flame.visible = flame.scale.z > 0.45;
    });

    animated.exhaustGlow.forEach((mesh, index) => {
      mesh.material.opacity = 0.18 + speedAmount * 0.18 + boostAmount * 0.32 + Math.sin(t * 34 + index) * 0.035;
      mesh.scale.setScalar(0.9 + speedAmount * 0.35 + boostAmount * 0.65);
    });

    animated.fins.forEach((fin, index) => {
      fin.rotation.z += ((index % 2 ? -1 : 1) * turn * 0.12 - fin.rotation.z) * (1 - Math.exp(-dt * 7));
    });

    animated.railLights.forEach((light, index) => {
      light.material.emissiveIntensity = 1.0 + speedAmount * 0.7 + boostAmount * 1.4 + Math.sin(t * 8 + index) * 0.2;
    });

    animated.pennants.forEach(({ mesh, base }, pIndex) => {
      const pos = mesh.geometry.attributes.position;
      const amp = 0.04 + speedAmount * 0.18 + boostAmount * 0.12;
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3];
        const z = base[i * 3 + 2];
        pos.setX(i, x + Math.sin(t * 13 + pIndex - z * 8) * amp * Math.abs(z));
      }
      pos.needsUpdate = true;
    });

    hitFlash = Math.max(0, hitFlash - dt * 4);
    animated.hitMaterials.forEach((mat) => {
      mat.emissive.setRGB(hitFlash * 0.8, hitFlash * 0.12, hitFlash * 0.05);
      mat.emissiveIntensity = 1;
    });
    dome.material.emissiveIntensity = 0.65 + boostAmount * 0.85 + hitFlash * 0.8;
    underglow.material.opacity = 0.15 + speedAmount * 0.12 + boostAmount * 0.32;
  };

  group.scale.setScalar(style.scale || 1);
  return group;
}

export const buildHeroBoat = buildHarborCometBoat;
