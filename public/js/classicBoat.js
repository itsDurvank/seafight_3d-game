import * as THREE from 'three';

// Original Classic Player Boat ("OG Skin")
// Features twin machine guns up front, missile pod on roof, pointed cone bow, and warm hull.
// Fully animated through g.userData.update(dt, t, boat) and g.userData.hit().

function mat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, ...extra });
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

  // Authentic Classic OG Boat styling matching reference design:
  // - Beige hull & deck (0xfff4e0)
  // - Orange waterline bottom stripe (0xff7a59)
  // - Clean slate-blue / chine cabin walls (0xdce5e8)
  // - Warm amber-orange roof (0xd9803f)
  // - Yellow flag (0xffe066) & red rocket barrels (0xff4d4d) on dark pod (0x3b4452)
  const C = {
    hull: style.classicHull ?? 0xfff4e0,
    accent: style.classicAccent ?? 0xff7a59,
    cabin: style.classicCabin ?? 0xdce5e8,
    roof: style.classicRoof ?? 0xd9803f,
    flag: style.classicFlag ?? 0xffe066,
  };

  const flashMats = [];
  const hullMat = mat(C.hull);
  const accentMat = mat(C.accent);
  const cabinMat = mat(C.cabin);
  const roofMat = mat(C.roof);
  flashMats.push(hullMat, accentMat, cabinMat, roofMat);

  // Main Hull Box
  add(new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 5), hullMat), 0, 0.2, 0);

  // Pointed Bow Cone
  const bowGeo = new THREE.ConeGeometry(1.1 * Math.SQRT2, 2, 4);
  bowGeo.rotateY(Math.PI / 4);
  bowGeo.rotateX(Math.PI / 2); // tip points +Z
  const bow = add(new THREE.Mesh(bowGeo, hullMat), 0, 0.2, 3.5);
  bow.scale.set(1, 0.36, 1);

  // Waterline / Deck Accent
  add(new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.22, 5.05), accentMat), 0, 0.3, 0);

  // Cabin & Roof
  add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 1.6), cabinMat), 0, 1.1, -0.6);
  add(new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.2, 1.95), roofMat), 0, 1.7, -0.6);

  // Flag & Pole
  const flagMat = new THREE.MeshStandardMaterial({ color: C.flag, side: THREE.DoubleSide });
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 5), mat(0xffffff)), 0, 2.9, -1.2);
  const flagGeo = new THREE.PlaneGeometry(0.9, 0.5, 4, 1);
  flagGeo.translate(0.45, 0, 0);
  flagGeo.rotateY(Math.PI / 2);
  const flag = add(new THREE.Mesh(flagGeo, flagMat), 0, 3.3, -1.2);
  const flagBase = flagGeo.attributes.position.array.slice();

  // Twin machine guns up front
  barrel(1.5, 0.11, -0.55, 0.95, 2.4);
  barrel(1.5, 0.11, 0.55, 0.95, 2.4);

  // Roof missile pod with red rocket tips
  add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 1.2), mat(dark)), 0, 1.95, -0.6);
  barrel(1.4, 0.13, -0.22, 2.2, -0.6, 0xff4d4d);
  barrel(1.4, 0.13, 0.22, 2.2, -0.6, 0xff4d4d);

  // Animation & damage flash hooks
  let flashK = 0;
  g.userData.hit = () => { flashK = 1; };
  g.userData.update = (dt, t, boat) => {
    const s = boat?.state || boat || {};
    const speed = Math.max(0, s.speed || 0);
    const speedK = Math.min(1, speed / 100);
    
    // Wave the flag
    const p = flag.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const d = Math.abs(flagBase[i * 3 + 2]);
      p.setX(i, flagBase[i * 3] + Math.sin(t * 12 - d * 5) * (0.05 + speedK * 0.2) * d);
    }
    p.needsUpdate = true;

    // Damage flash fadeout
    flashK = Math.max(0, flashK - dt * 4);
    flashMats.forEach((m) => m.emissive?.setRGB(flashK * 0.9, flashK * 0.1, flashK * 0.05));
  };

  g.scale.setScalar(style.scale || 1);
  return g;
}
