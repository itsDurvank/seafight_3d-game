import * as THREE from 'three';

// Original Classic Player Boat ("OG Skin")
// Features twin machine guns up front, missile pod on roof, pointed cone bow, and simple block cabin.

function mat(color) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8 });
}

export function buildClassicBoat(style = {}) {
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  const add = (mesh, x, y, z) => { mesh.position.set(x, y, z); g.add(mesh); return mesh; };
  const dark = 0x3b4452;
  const barrel = (len, r, x, y, z, color = dark) => {
    const geo = new THREE.CylinderGeometry(r, r, len, 8);
    geo.rotateX(Math.PI / 2);
    return add(new THREE.Mesh(geo, mat(color)), x, y, z);
  };

  const C = {
    hull: style.hull ?? 0xfff4e0,
    accent: style.accent ?? 0xff7a59,
    cabin: style.cabin ?? 0xffd9a0,
    roof: style.roof ?? 0xff8a3d,
    flag: style.flag ?? 0xffe066,
  };

  // Main Hull Box
  add(new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 5), mat(C.hull)), 0, 0.2, 0);

  // Pointed Bow Cone
  const bowGeo = new THREE.ConeGeometry(1.1 * Math.SQRT2, 2, 4);
  bowGeo.rotateY(Math.PI / 4);
  bowGeo.rotateX(Math.PI / 2); // tip points +Z
  const bow = add(new THREE.Mesh(bowGeo, mat(C.hull)), 0, 0.2, 3.5);
  bow.scale.set(1, 0.36, 1);

  // Waterline / Deck Accent
  add(new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.22, 5.05), mat(C.accent)), 0, 0.3, 0);

  // Cabin & Roof
  add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 1.6), mat(C.cabin)), 0, 1.1, -0.6);
  add(new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.2, 1.95), mat(C.roof)), 0, 1.7, -0.6);

  // Flag
  const flagMat = new THREE.MeshStandardMaterial({ color: C.flag, side: THREE.DoubleSide });
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 5), mat(0xffffff)), 0, 2.9, -1.2);
  const f = add(new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), flagMat), 0, 3.3, -1.65);
  f.rotation.y = Math.PI / 2;

  // Twin machine guns up front
  barrel(1.5, 0.11, -0.55, 0.95, 2.4);
  barrel(1.5, 0.11, 0.55, 0.95, 2.4);

  // Roof missile pod with red rocket tips
  add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 1.2), mat(dark)), 0, 1.95, -0.6);
  barrel(1.4, 0.13, -0.22, 2.2, -0.6, 0xff4d4d);
  barrel(1.4, 0.13, 0.22, 2.2, -0.6, 0xff4d4d);

  g.scale.setScalar(style.scale || 1);
  return g;
}
