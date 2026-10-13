import * as THREE from 'three';

// Terraced sandstone mountain with palms and bushes, ported from the low-poly island asset.
// Built in the asset's original units; makeIsland() scales it to fit the island radius.

const flat = (color) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85 });

// Jitter vertices for the faceted, hand-chiseled look (seeded, so it looks the same every load).
function deform(geo, rand, amount) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    p.setXYZ(
      i,
      p.getX(i) + (rand() - 0.5) * amount,
      p.getY(i) + (rand() - 0.5) * amount,
      p.getZ(i) + (rand() - 0.5) * amount
    );
  }
  geo.computeVertexNormals();
  return geo;
}

// Peaks first, then terraces, then shoreside boulders.
const ROCKS = [
  { x: 0, y: 7.0, z: -1, w: 9, h: 7, d: 8, ry: 0.1 },
  { x: -3.5, y: 5.5, z: 2, w: 8, h: 6, d: 7, ry: -0.2 },
  { x: 4.5, y: 6.0, z: -2, w: 7, h: 6.5, d: 6.5, ry: 0.4 },
  { x: 1, y: 10.0, z: -3, w: 5, h: 4, d: 4.5, ry: 0.0 },
  { x: -7, y: 3.5, z: -1, w: 7, h: 4.5, d: 6, ry: 0.3 },
  { x: 6.5, y: 4.0, z: 3, w: 6.5, h: 5, d: 6, ry: -0.3 },
  { x: 3, y: 3.0, z: 6, w: 6, h: 4, d: 5, ry: 0.15 },
  { x: -4, y: 2.5, z: 7, w: 5.5, h: 3.5, d: 5, ry: -0.1 },
  { x: -2, y: 4.0, z: -6.5, w: 6.5, h: 5, d: 5, ry: 0.2 },
  { x: -10.5, y: 1.5, z: -2, w: 4, h: 2.5, d: 4, ry: 0.4 },
  { x: 9.5, y: 2.0, z: 1.5, w: 4.5, h: 3, d: 4, ry: -0.25 },
  { x: 7, y: 1.5, z: 8, w: 3.5, h: 2.5, d: 3.5, ry: 0.5 },
  { x: -6, y: 1.2, z: 11, w: 3, h: 2, d: 3, ry: 0.1 },
  { x: 1, y: 1.5, z: 10.5, w: 4, h: 2.5, d: 3.5, ry: -0.15 },
];

const PALMS = [
  { x: 1, y: 12.0, z: -3, scale: 0.9, lean: 0.1 },
  { x: -1.5, y: 8.5, z: 2, scale: 1.1, lean: -0.15 },
  { x: 3.5, y: 9.0, z: -1, scale: 1.0, lean: 0.2 },
  { x: -5, y: 6.0, z: -1, scale: 1.15, lean: 0.25 },
  { x: 5.5, y: 6.5, z: 4.5, scale: 0.95, lean: -0.2 },
  { x: -2, y: 4.5, z: 8.5, scale: 1.0, lean: 0.1 },
  { x: -11.5, y: 0.5, z: 3, scale: 1.25, lean: -0.3 },
  { x: -12, y: 0.5, z: -3.5, scale: 1.1, lean: 0.2 },
  { x: 11, y: 0.5, z: -2, scale: 1.2, lean: 0.25 },
  { x: 9.5, y: 0.5, z: 7, scale: 1.1, lean: -0.25 },
  { x: 4, y: 0.5, z: 12, scale: 1.05, lean: -0.15 },
];

const BUSHES = [
  [-1, 10.5, -1.5], [2, 9.5, -2], [-3.5, 8.5, 0.5], [2.5, 6.5, 3.5], [-5.5, 4.5, 2], [4.5, 5.0, 1],
  [0, 4.5, 6], [-3, 3.0, 6.5], [5, 3.5, 6], [-7.5, 1.5, 4], [8, 1.2, 4],
];

function makePalm(mats, rand, height, curve) {
  const palm = new THREE.Group();
  const segments = 6;
  const segH = height / segments;
  let y = 0, z = 0;
  for (let i = 0; i < segments; i++) {
    const rTop = 0.25 * (1 - (i / segments) * 0.3);
    const rBot = 0.32 * (1 - (i / segments) * 0.3);
    const seg = new THREE.Mesh(deform(new THREE.CylinderGeometry(rTop, rBot, segH, 6), rand, 0.05), mats.trunk);
    seg.position.set(0, y + segH / 2, z);
    seg.rotation.x = curve;
    seg.castShadow = true;
    palm.add(seg);
    y += segH * Math.cos(curve);
    z += segH * Math.sin(curve);
  }
  const frondGeo = new THREE.ConeGeometry(0.75, 3.2, 4);
  frondGeo.translate(0, 1.6, 0);
  frondGeo.rotateX(Math.PI / 2.3);
  deform(frondGeo, rand, 0.1);
  const leaves = 7;
  for (let j = 0; j < leaves; j++) {
    const leaf = new THREE.Mesh(frondGeo, mats.leaf);
    leaf.position.set(0, y, z);
    leaf.rotation.y = (j / leaves) * Math.PI * 2;
    leaf.rotation.z = 0.45;
    leaf.castShadow = true;
    palm.add(leaf);
  }
  return palm;
}

function makeBush(mats, rand, scale) {
  const bush = new THREE.Group();
  const n = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const r = (0.5 + rand() * 0.4) * scale;
    const m = new THREE.Mesh(deform(new THREE.DodecahedronGeometry(r, 0), rand, 0.15), mats.bush);
    m.position.set((rand() - 0.5) * scale, rand() * 0.4 * scale, (rand() - 0.5) * scale);
    m.castShadow = true;
    bush.add(m);
  }
  return bush;
}

// Returns a group in asset units (ground level at y = 0). `scale` fits it to the island.
export function makeMountain(T, rand, scale = 1) {
  const mats = {
    rock: flat(T.rock),
    sand: flat(T.sand),
    trunk: flat(T.trunk),
    leaf: flat(T.leaf),
    bush: flat(T.grass),
  };
  const g = new THREE.Group();

  // sandy mound under the cliffs so the terraces never float
  const mound = new THREE.Mesh(deform(new THREE.CylinderGeometry(9, 14, 5, 14), rand, 0.6), mats.sand);
  mound.position.y = 1.2;
  g.add(mound);

  for (const c of ROCKS) {
    const rock = new THREE.Mesh(deform(new THREE.BoxGeometry(c.w, c.h, c.d, 2, 2, 2), rand, 0.45), mats.rock);
    rock.position.set(c.x, c.y, c.z);
    rock.rotation.y = c.ry;
    rock.castShadow = true;
    rock.receiveShadow = true;
    g.add(rock);
  }

  for (const p of PALMS) {
    const palm = makePalm(mats, rand, 5.5 * p.scale, p.lean);
    palm.position.set(p.x, p.y, p.z);
    palm.rotation.y = rand() * Math.PI * 2;
    g.add(palm);
  }

  for (const [x, y, z] of BUSHES) {
    const b = makeBush(mats, rand, 0.8 + rand() * 0.5);
    b.position.set(x, y, z);
    g.add(b);
  }

  g.scale.setScalar(scale);
  return g;
}

// Loose pebbles around the shoreline (placed in island units, outside the scaled mountain).
export function makePebbles(T, rand, radius, count = 22) {
  const mat = flat(T.rock);
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2;
    const d = radius * (0.88 + rand() * 0.14);
    const peb = new THREE.Mesh(deform(new THREE.DodecahedronGeometry(0.5 + rand() * 0.9, 0), rand, 0.2), mat);
    peb.position.set(Math.cos(a) * d, 0.5 + rand() * 0.2, Math.sin(a) * d);
    peb.rotation.set(rand(), rand(), rand());
    peb.castShadow = true;
    g.add(peb);
  }
  return g;
}
