import * as THREE from 'three';

const flat = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, ...extra });

// Original Rowboat Asset
export function makeOriginalRowboats(def) {
  const g = new THREE.Group();
  const hullWood = flat(0x7f5539);
  const benchWood = flat(0xb08968);
  const oarWood = flat(0xd4a373);

  const b1 = new THREE.Group();
  b1.position.set(0, 0.7, 0);
  b1.rotation.y = 0.2;
  b1.rotation.z = 0.12;

  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 5.8), hullWood);
  b1.add(hull);
  const hollow = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 5.4), flat(0x5c3a21));
  hollow.position.y = 0.2;
  b1.add(hollow);

  for (const bz of [-1.5, 0, 1.5]) {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.15, 0.65), benchWood);
    bench.position.set(0, 0.35, bz);
    b1.add(bench);
  }

  const oar1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5.2, 5), oarWood);
  oar1.rotation.set(0.2, 0.3, 0.8);
  oar1.position.set(0.3, 0.7, 0);
  const oar2 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5.2, 5), oarWood);
  oar2.rotation.set(-0.2, -0.3, -0.8);
  oar2.position.set(-0.3, 0.7, 0);
  b1.add(oar1, oar2);

  g.add(b1);
  return g;
}

// Original Treasure Chest Asset
export function makeOriginalTreasureChest(def) {
  const g = new THREE.Group();
  const wood = flat(0x4a2e16);
  const iron = flat(0x22262a);
  const sand = flat(0xe9d8a6);

  const mound = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.8, 0.5, 8), sand);
  mound.position.y = 0.25;
  g.add(mound);

  const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.5, 2.0), wood);
  body.position.set(0, 1.25, 0);
  g.add(body);

  for (const bx of [-1.55, -0.5, 0.5, 1.55]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.55, 2.05), iron);
    band.position.set(bx, 1.25, 0);
    g.add(band);
  }

  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.1), flat(0xffd700));
  lock.position.set(0, 1.3, 1.05);
  g.add(lock);

  const lidGroup = new THREE.Group();
  lidGroup.position.set(0, 2.0, -1.0);
  lidGroup.rotation.x = -1.1;
  const lid = new THREE.Mesh(
    new THREE.CylinderGeometry(1.0, 1.0, 3.2, 8, 1, false, 0, Math.PI),
    wood
  );
  lid.rotation.z = Math.PI / 2;
  lid.position.set(0, 0, 1.0);
  lidGroup.add(lid);
  g.add(lidGroup);

  const goldPile = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 6, 6),
    new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffa000,
      emissiveIntensity: 1.4,
      metalness: 0.9,
      roughness: 0.2
    })
  );
  goldPile.scale.set(1.3, 0.65, 0.85);
  goldPile.position.set(0, 1.85, 0);
  g.add(goldPile);

  const gem1 = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), flat(0xef233c, { emissive: 0xef233c, emissiveIntensity: 1.2 }));
  gem1.position.set(1.4, 0.55, 1.2);
  const gem2 = new THREE.Mesh(new THREE.OctahedronGeometry(0.25), flat(0x06d6a0, { emissive: 0x06d6a0, emissiveIntensity: 1.2 }));
  gem2.position.set(-1.3, 0.55, 1.3);
  g.add(gem1, gem2);

  return g;
}

// Original Tent Asset
export function makeOriginalTent(def) {
  const g = new THREE.Group();
  const canvas = flat(0x606c38);
  const darkWood = flat(0x3e2723);

  const tent = new THREE.Mesh(new THREE.ConeGeometry(3.4, 3.2, 4), canvas);
  tent.position.y = 1.6;
  tent.rotation.y = Math.PI / 4;
  g.add(tent);

  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 3.8), darkWood);
  ridge.position.y = 3.15;
  g.add(ridge);

  const bedroll = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.8, 6), flat(0x3d5a80));
  bedroll.rotation.z = Math.PI / 2;
  bedroll.position.set(0, 0.35, 1.1);
  g.add(bedroll);

  const crate = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.8, 1.0), flat(0x8a5a32));
  crate.position.set(2.4, 0.4, 0.5);
  g.add(crate);

  return g;
}
