import * as THREE from 'three';
import { WORLD } from './config.js';
import { makeMountain, makePebbles } from './mountain.js';
import { makeAsset } from './assets.js';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const flat = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, ...extra });

function makePalm(T, rand) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.38, 4, 6), flat(T.trunk));
  trunk.position.y = 2;
  trunk.rotation.z = (rand() - 0.5) * 0.25;
  g.add(trunk);
  const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(1.7, 0), flat(T.leaf));
  leaves.scale.set(1.5, 0.55, 1.5);
  leaves.position.y = 4.3;
  g.add(leaves);
  if (T.feature === 'mango') {
    for (let i = 0; i < 3; i++) {
      const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), flat(0xff9f1c));
      const a = i * 2.1;
      fruit.position.set(Math.cos(a) * 0.9, 3.7, Math.sin(a) * 0.9);
      g.add(fruit);
    }
  }
  return g;
}

export function makeIsland(def) {
  const T = def.theme;
  const rand = rng(def.seed);
  const g = new THREE.Group();
  g.position.set(def.x, 0, def.z);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(def.r * 0.85, def.r, 4.5, 18), flat(T.sand));
  base.position.y = -1.25; // top surface sits at y = 1.0
  g.add(base);

  // pale underwater shelf: shows through the water as a bright lagoon glow
  const shallow = new THREE.Color(T.sand).lerp(new THREE.Color(0x7fe3ff), 0.55);
  const shelf = new THREE.Mesh(new THREE.CylinderGeometry(def.r * 1.22, def.r * 1.32, 0.4, 24), flat(shallow));
  shelf.position.y = -1.4;
  g.add(shelf);

  // Sandstone Peak: the terraced mountain asset replaces the grass top, palms and feature
  if (T.feature === 'mountain') {
    const peak = makeMountain(T, rand, def.r / 19);
    peak.position.y = -0.8; // asset ground level -> island sand surface
    peak.rotation.y = rand() * Math.PI * 2; // every mountain island faces a different way
    g.add(peak);
    g.add(makePebbles(T, rand, def.r));
    return g;
  }

  const grass = new THREE.Mesh(new THREE.CylinderGeometry(def.r * 0.55, def.r * 0.68, 0.6, 18), flat(T.grass));
  grass.position.y = 1.2;
  g.add(grass);

  const volcano = T.feature === 'volcano';
  const palms = Math.round(def.r / 3.6);
  for (let i = 0; i < palms; i++) {
    const a = rand() * Math.PI * 2;
    const d = volcano ? def.r * (0.4 + rand() * 0.18) : def.r * (0.12 + rand() * 0.42);
    const palm = makePalm(T, rand);
    palm.scale.setScalar(0.8 + rand() * 0.4);
    palm.position.set(Math.cos(a) * d, 1.5, Math.sin(a) * d);
    g.add(palm);
  }

  for (let i = 0; i < 5; i++) {
    const a = rand() * Math.PI * 2;
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8 + rand() * 0.7, 0), flat(T.rock));
    rock.position.set(Math.cos(a) * def.r * 0.93, 0.3, Math.sin(a) * def.r * 0.93);
    g.add(rock);
  }

  // one signature feature per island so each place feels different
  if (T.feature === 'coral') {
    for (let i = 0; i < 7; i++) {
      const a = rand() * Math.PI * 2;
      const d = def.r * (0.78 + rand() * 0.15);
      for (let k = 0; k < 3; k++) {
        const h = 1.6 + rand() * 1.6;
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.45, h, 5), flat(i % 2 ? T.accent : T.rock));
        c.position.set(Math.cos(a) * d + (k - 1) * 0.7, 0.6 + h / 2, Math.sin(a) * d + (rand() - 0.5));
        g.add(c);
      }
    }
  } else if (T.feature === 'crystal') {
    for (let i = 0; i < 6; i++) {
      const a = rand() * Math.PI * 2;
      const d = def.r * (0.2 + rand() * 0.4);
      const cr = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.9 + rand() * 0.7),
        flat(T.accent, { emissive: T.accent, emissiveIntensity: 0.55 })
      );
      cr.scale.y = 2.2;
      cr.position.set(Math.cos(a) * d, 2.8, Math.sin(a) * d);
      g.add(cr);
    }
  } else if (T.feature === 'pillar') {
    for (let i = 0; i < 5; i++) {
      const a = rand() * Math.PI * 2;
      const d = def.r * (0.25 + rand() * 0.35);
      const h = 3 + rand() * 4;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.6 + rand() * 0.3, 0.9, h, 7), flat(T.accent));
      p.position.set(Math.cos(a) * d, 1.4 + h / 2, Math.sin(a) * d);
      g.add(p);
    }
  } else if (volcano) {
    const h = def.r * 0.55;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(def.r * 0.32, h, 9), flat(T.rock));
    cone.position.y = 1.4 + h / 2;
    g.add(cone);
    const lava = new THREE.Mesh(
      new THREE.CylinderGeometry(def.r * 0.1, def.r * 0.12, 0.4, 9),
      flat(0xff6a1a, { emissive: 0xff6a1a, emissiveIntensity: 0.9 })
    );
    lava.position.y = 1.4 + h - 0.1;
    g.add(lava);
  }

  if (def.home) {
    // coral flag marks the player's island
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 9, 6), flat(0xffffff));
    pole.position.set(def.r * 0.15, 5.5, 0);
    g.add(pole);
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(3, 1.8),
      new THREE.MeshStandardMaterial({ color: T.accent, side: THREE.DoubleSide, flatShading: true })
    );
    flag.position.set(def.r * 0.15 + 1.6, 8.6, 0);
    g.add(flag);
  }
  return g;
}

// Warm wooden dock with rope railings, hanging lanterns and tire fenders.
export function makeDock() {
  const { x, z, w, d } = WORLD.dock;
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const rand = rng(99);
  const woods = [0xd9803f, 0xc9722f, 0xe3924f, 0xb9642a];

  const n = 15;
  const pitch = w / n;
  for (let i = 0; i < n; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(pitch * 0.86, 0.25, d), flat(woods[i % woods.length]));
    plank.position.set(-w / 2 + pitch * (i + 0.5), 0.85 + (rand() - 0.5) * 0.05, 0);
    plank.rotation.y = (rand() - 0.5) * 0.03;
    g.add(plank);
  }
  for (const side of [-1, 1]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, 0.3), flat(0x8a4f26));
    beam.position.set(0, 0.6, side * (d / 2 - 0.6));
    g.add(beam);
  }

  // rope railings
  const rope = flat(0xe8b24a);
  const postMat = flat(0xe9dcc6);
  const spacing = w / 5;
  for (const side of [-1, 1]) {
    const zz = side * (d / 2 - 0.2);
    for (let i = 0; i <= 5; i++) {
      const px = -w / 2 + spacing * i;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 1.6, 6), postMat);
      post.position.set(px, 1.65, zz);
      g.add(post);
      const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 3, 6), flat(0x9c744d));
      pile.position.set(px, 0.2, zz);
      g.add(pile);
      if (i < 5) {
        const r = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, spacing, 5), rope);
        r.rotation.z = Math.PI / 2;
        r.position.set(px + spacing / 2, 2.15, zz);
        g.add(r);
      }
    }
  }

  // lantern posts at both back corners
  for (const side of [-1, 1]) {
    const lx = side * (w / 2 - 1.0);
    const lz = -d / 2 + 0.3;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.32, 4.2, 0.32), flat(0x8a5a32));
    post.position.set(lx, 2.95, lz);
    g.add(post);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 1.2), flat(0x8a5a32));
    arm.position.set(lx, 4.9, lz + 0.5);
    g.add(arm);
    const lantern = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.8, 0.6),
      flat(0xffd27a, { emissive: 0xffc24d, emissiveIntensity: 1.2 })
    );
    lantern.position.set(lx, 4.3, lz + 0.9);
    g.add(lantern);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.4, 4), flat(0x3b4452));
    cap.position.set(lx, 4.9, lz + 0.9);
    cap.rotation.y = Math.PI / 4;
    g.add(cap);
    const light = new THREE.PointLight(0xffc766, 1.1, 18);
    light.position.set(lx, 4.3, lz + 0.9);
    g.add(light);
  }

  // tire fenders on the sea side
  for (const tx of [-6, 0, 6]) {
    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.22, 8, 12), flat(0x2b2f3a));
    tire.position.set(tx, 0.45, d / 2 + 0.1);
    g.add(tire);
  }
  return g;
}

// A few white butterflies fluttering around the dock, like the reference art.
function makeButterflies(scene) {
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.lineTo(0.9, 0.5);
  wingShape.lineTo(0.7, -0.4);
  wingShape.closePath();
  const wingGeo = new THREE.ShapeGeometry(wingShape);
  wingGeo.rotateX(-Math.PI / 2); // lay the wing flat so it can flap about the body
  const wingMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });

  const list = [];
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Group();
    const left = new THREE.Mesh(wingGeo, wingMat);
    const right = new THREE.Mesh(wingGeo, wingMat);
    right.scale.x = -1;
    b.add(left, right);
    b.scale.setScalar(0.7);
    scene.add(b);
    list.push({ b, left, right, i });
  }
  return (t) => {
    for (const { b, left, right, i } of list) {
      b.position.set(
        Math.cos(t * 0.4 + i) * 9,
        3.5 + Math.sin(t * 1.3 + i * 2) * 0.9,
        WORLD.dock.z + Math.sin(t * 0.3 + i * 1.7) * 6
      );
      b.rotation.y = t * 0.5 + i;
      const flap = 0.2 + 0.9 * Math.abs(Math.sin(t * 14 + i));
      left.rotation.z = flap;
      right.rotation.z = -flap;
    }
  };
}

export function createWorld(scene) {
  scene.add(makeDock());
  for (const def of WORLD.islands) scene.add(makeIsland(def));
  const allAssetMeshes = [];
  if (Array.isArray(WORLD.assets)) {
    for (const a of WORLD.assets) {
      const m = makeAsset(a);
      scene.add(m);
      allAssetMeshes.push(m);
    }
  }
  const flutter = makeButterflies(scene);
  return {
    update: (t, px = 0, pz = 0) => {
      flutter(t);
      // Visibility culling: hide assets beyond 280m where horizon fog fully obscures them
      for (let i = 0; i < allAssetMeshes.length; i++) {
        const m = allAssetMeshes[i];
        const dx = m.position.x - px;
        const dz = m.position.z - pz;
        m.visible = (dx * dx + dz * dz) < 280 * 280;
      }
    }
  };
}

let cachedObstacles = null;
let lastIslandsRef = null;
let lastAssetsLen = -1;

// Cached obstacle circles combining islands, dock, and marine obstacles
export function getObstacles() {
  const islands = WORLD.islands || [];
  const assets = WORLD.assets || [];
  if (cachedObstacles && lastIslandsRef === islands && lastAssetsLen === assets.length) {
    return cachedObstacles;
  }
  lastIslandsRef = islands;
  lastAssetsLen = assets.length;
  const obs = [];
  for (let i = 0; i < islands.length; i++) {
    const isl = islands[i];
    obs.push({ x: isl.x, z: isl.z, r: isl.r });
  }
  if (WORLD.dock) {
    obs.push({ x: WORLD.dock.x, z: WORLD.dock.z, r: 8 });
  }
  const ASSET_RADII = {
    sea_rocks: 8,
    shipwreck: 9,
    sea_castle: 10,
    sea_mine: 6,
    pier: 8,
  };
  for (let i = 0; i < assets.length; i++) {
    const a = assets[i];
    const baseR = ASSET_RADII[a.type];
    if (baseR) {
      obs.push({ x: a.x, z: a.z, r: baseR * (a.scale || 1) });
    }
  }
  cachedObstacles = obs;
  return obs;
}

// Soft collisions: bumping into things nudges the boat away, never hurts it.
// Returns true if anything was touched.
export function resolveCollisions(b, radius, dt) {
  let hit = false;
  const obstacles = getObstacles();

  for (let i = 0; i < obstacles.length; i++) {
    const o = obstacles[i];
    const dx = b.x - o.x, dz = b.z - o.z;
    const d = Math.hypot(dx, dz) || 0.0001;
    const min = o.r * 0.95 + radius;
    if (d < min) {
      b.x = o.x + (dx / d) * min;
      b.z = o.z + (dz / d) * min;
      hit = true;
    }
  }

  const k = WORLD.dock;
  if (k) {
    const hx = k.w / 2 + radius, hz = k.d / 2 + radius;
    const dx = b.x - k.x, dz = b.z - k.z;
    if (Math.abs(dx) < hx && Math.abs(dz) < hz) {
      if (hx - Math.abs(dx) < hz - Math.abs(dz)) b.x = k.x + Math.sign(dx || 1) * hx;
      else b.z = k.z + Math.sign(dz || 1) * hz;
      hit = true;
    }
  }

  const dist = Math.hypot(b.x, b.z);
  if (dist > WORLD.radius) {
    b.x *= WORLD.radius / dist;
    b.z *= WORLD.radius / dist;
    hit = true;
  }

  if (hit) b.speed *= Math.exp(-0.8 * dt);
  return hit;
}
