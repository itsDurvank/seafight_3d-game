import * as THREE from 'three';

// Low-poly flat shading helper
const flat = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, ...extra });

// Helper to create a procedural canvas texture for billboards / signs
export function createBillboardTexture(text = 'BOOM BOATS', textColor = '#ffffff', bgColor = '#8b5a2b', subText = '') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Background wooden plank look or painted metal
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, 512, 256);

  // Border & frame
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#3b220e';
  ctx.strokeRect(7, 7, 498, 242);

  // Subtle inner shadow / border
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.strokeRect(16, 16, 480, 224);

  // Planks horizontal lines
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(14, 85); ctx.lineTo(498, 85);
  ctx.moveTo(14, 170); ctx.lineTo(498, 170);
  ctx.stroke();

  // Corner bolts
  ctx.fillStyle = '#1f1610';
  for (const [x, y] of [[28, 28], [484, 28], [28, 228], [484, 228]]) {
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  // Primary Text
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Dynamic font sizing based on length
  const fontSize = text.length > 14 ? 38 : (text.length > 8 ? 48 : 58);
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 4;
  
  const posY = subText ? 110 : 128;
  ctx.fillText(text.toUpperCase(), 256, posY);

  if (subText) {
    ctx.font = 'bold 22px sans-serif';
    ctx.shadowBlur = 4;
    ctx.fillStyle = '#ffd27a';
    ctx.fillText(subText.toUpperCase(), 256, 175);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// Procedural Asset Builders
export function makeBillboard(def) {
  const g = new THREE.Group();
  const text = def.text || 'BOOM BOATS';
  const textColor = def.textColor || '#ffffff';
  const bgColor = def.bgColor || '#965a2a';
  const subText = def.subText || '';

  // 2 Vertical Wooden Stilt Posts
  const postMat = flat(0x6e4726);
  const leftPost = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 9, 6), postMat);
  leftPost.position.set(-3.6, 4.5, 0);
  const rightPost = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 9, 6), postMat);
  rightPost.position.set(3.6, 4.5, 0);
  g.add(leftPost, rightPost);

  // Cross Support Beams on the back
  const beamMat = flat(0x54361c);
  const cross1 = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.25, 0.25), beamMat);
  cross1.position.set(0, 5.5, -0.35);
  const cross2 = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.25, 0.25), beamMat);
  cross2.position.set(0, 8.2, -0.35);
  g.add(cross1, cross2);

  // Diagonal support struts
  const strut1 = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 5, 5), beamMat);
  strut1.position.set(-3.6, 2.5, -1.5);
  strut1.rotation.x = 0.55;
  const strut2 = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 5, 5), beamMat);
  strut2.position.set(3.6, 2.5, -1.5);
  strut2.rotation.x = 0.55;
  g.add(strut1, strut2);

  // Billboard Sign Board (Front & Back)
  const boardGeo = new THREE.BoxGeometry(8.6, 4.6, 0.4);
  const woodBoardMat = flat(0x7a4c28);
  const signMesh = new THREE.Mesh(boardGeo, woodBoardMat);
  signMesh.position.set(0, 7.0, 0);
  g.add(signMesh);

  // Front Facing Canvas Plane
  const tex = createBillboardTexture(text, textColor, bgColor, subText);
  const faceMat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.7,
    side: THREE.FrontSide
  });
  const faceMesh = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 4.4), faceMat);
  faceMesh.position.set(0, 7.0, 0.22);
  g.add(faceMesh);
  g.userData.faceMesh = faceMesh;

  // Small Top Lantern
  const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.6), flat(0xffd27a, { emissive: 0xffa020, emissiveIntensity: 0.9 }));
  lantern.position.set(0, 9.6, 0.5);
  g.add(lantern);

  return g;
}

export function makeLighthouse(def) {
  const g = new THREE.Group();
  
  // Stone plinth base
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 5.0, 2.2, 12), flat(0x60666d));
  plinth.position.y = 1.1;
  g.add(plinth);

  // Tower striped segments (alternating white & red)
  const segments = 5;
  const segHeight = 4.0;
  const colors = [0xe2e8f0, 0xd9383a, 0xe2e8f0, 0xd9383a, 0xe2e8f0];
  
  for (let i = 0; i < segments; i++) {
    const bottomR = 4.2 - (i * 0.38);
    const topR = 4.2 - ((i + 1) * 0.38);
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(topR, bottomR, segHeight, 14),
      flat(colors[i])
    );
    seg.position.y = 2.2 + (i * segHeight) + (segHeight / 2);
    g.add(seg);
  }

  const towerTopY = 2.2 + (segments * segHeight);

  // Balcony walkway deck & railing
  const balcony = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.6, 14), flat(0x272e39));
  balcony.position.y = towerTopY + 0.3;
  g.add(balcony);

  const railing = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.12, 6, 16), flat(0x181e28));
  railing.rotation.x = Math.PI / 2;
  railing.position.y = towerTopY + 1.2;
  g.add(railing);

  // Glass lantern room
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(2.1, 2.1, 2.6, 10),
    new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, roughness: 0.1 })
  );
  glass.position.y = towerTopY + 1.9;
  g.add(glass);

  // Glowing beacon core
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xffeb60, emissive: 0xffd230, emissiveIntensity: 1.8 })
  );
  beacon.position.y = towerTopY + 1.9;
  g.add(beacon);

  // Roof dome
  const dome = new THREE.Mesh(new THREE.ConeGeometry(2.4, 2.0, 12), flat(0x1c2b3a));
  dome.position.y = towerTopY + 4.1;
  g.add(dome);

  // Finial ball & weather spike
  const spike = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.8, 5), flat(0xe2b53e));
  spike.position.y = towerTopY + 5.6;
  g.add(spike);

  return g;
}

export function makeWatchtower(def) {
  const g = new THREE.Group();
  const wood = flat(0x734825);
  const darkWood = flat(0x4a2e16);

  // 4 Angled Stilt Legs
  const legGeo = new THREE.CylinderGeometry(0.32, 0.42, 13, 6);
  const coords = [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]];
  for (const [x, z] of coords) {
    const leg = new THREE.Mesh(legGeo, wood);
    leg.position.set(x, 6.5, z);
    g.add(leg);
  }

  // Cross braces
  for (let y = 3.5; y <= 9.5; y += 3.5) {
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.25, 0.25), darkWood);
    b1.position.set(0, y, -2.5);
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.25, 0.25), darkWood);
    b2.position.set(0, y, 2.5);
    const b3 = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 5.2), darkWood);
    b3.position.set(-2.5, y, 0);
    const b4 = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 5.2), darkWood);
    b4.position.set(2.5, y, 0);
    g.add(b1, b2, b3, b4);
  }

  // Platform floor
  const deck = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.45, 6.6), wood);
  deck.position.y = 13;
  g.add(deck);

  // Parapet / Railing
  const parapetMat = flat(0x5c381c);
  for (const side of [-1, 1]) {
    const r1 = new THREE.Mesh(new THREE.BoxGeometry(6.6, 1.2, 0.25), parapetMat);
    r1.position.set(0, 13.8, side * 3.2);
    const r2 = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.2, 6.6), parapetMat);
    r2.position.set(side * 3.2, 13.8, 0);
    g.add(r1, r2);
  }

  // 4 Roof posts & Thatched Pyramid Roof
  for (const [x, z] of coords) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 4.5, 5), darkWood);
    post.position.set(x * 0.9, 15.2, z * 0.9);
    g.add(post);
  }

  const roof = new THREE.Mesh(new THREE.ConeGeometry(5.2, 3.2, 4), flat(0x946b3f));
  roof.position.y = 18.2;
  roof.rotation.y = Math.PI / 4;
  g.add(roof);

  // Flag on top
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.0, 5), flat(0xcccccc));
  pole.position.set(0, 20.4, 0);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.0), flat(0xd9383a, { side: THREE.DoubleSide }));
  flag.position.set(0.9, 21.0, 0);
  g.add(pole, flag);

  return g;
}

export function makeCannon(def) {
  const g = new THREE.Group();

  // Stone base plinth
  const base = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.3, 0.8, 12), flat(0x5b626b));
  base.position.y = 0.4;
  g.add(base);

  // Carriage mount
  const mount = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 3.2), flat(0x4a321f));
  mount.position.y = 1.3;
  g.add(mount);

  // 4 Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.35, 10);
  const wheelMat = flat(0x2a1c12);
  for (const [x, z] of [[-1.3, -1.0], [1.3, -1.0], [-1.3, 1.0], [1.3, 1.0]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 1.0, z);
    g.add(w);
  }

  // Heavy Iron Barrel
  const barrelGroup = new THREE.Group();
  barrelGroup.position.set(0, 2.0, 0);
  barrelGroup.rotation.x = -0.15; // aimed slightly upward

  const ironMat = flat(0x22262d, { roughness: 0.5 });
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.65, 4.8, 12), ironMat);
  tube.rotation.x = Math.PI / 2;
  tube.position.z = 1.2;
  barrelGroup.add(tube);

  // Flared muzzle ring
  const muzzle = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.12, 8, 14), ironMat);
  muzzle.position.z = 3.6;
  barrelGroup.add(muzzle);

  // Breech ball
  const breech = new THREE.Mesh(new THREE.SphereGeometry(0.62, 8, 8), ironMat);
  breech.position.z = -1.1;
  barrelGroup.add(breech);

  g.add(barrelGroup);

  // Stack of 3 cannonballs nearby
  const ballMat = flat(0x181a1d, { roughness: 0.3 });
  for (const [bx, bz] of [[-1.8, -1.6], [-1.2, -1.6], [-1.5, -2.1]]) {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), ballMat);
    ball.position.set(bx, 0.7, bz);
    g.add(ball);
  }

  return g;
}

export function makeBarrels(def) {
  const g = new THREE.Group();
  const redBarrelMat = flat(0xc92a2a);
  const darkHoopMat = flat(0x1f242b);

  function singleBarrel(x, y, z, rotX = 0, rotZ = 0) {
    const bg = new THREE.Group();
    bg.position.set(x, y, z);
    bg.rotation.set(rotX, 0, rotZ);

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 1.8, 10), redBarrelMat);
    bg.add(body);

    for (const hy of [-0.65, -0.2, 0.2, 0.65]) {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.74, 0.05, 5, 12), darkHoopMat);
      hoop.rotation.x = Math.PI / 2;
      hoop.position.y = hy;
      bg.add(hoop);
    }
    return bg;
  }

  // Pyramid stack of 3 barrels
  g.add(singleBarrel(-0.8, 0.9, 0));
  g.add(singleBarrel(0.8, 0.9, 0));
  g.add(singleBarrel(0.0, 2.65, 0));
  // 1 fallen barrel in front
  g.add(singleBarrel(0.0, 0.72, 1.3, Math.PI / 2, 0.2));

  return g;
}

export function makeCrates(def) {
  const g = new THREE.Group();
  const crateMat = flat(0x946b3f);
  const trimMat = flat(0x614120);

  function singleCrate(x, y, z, s = 1.6, rotY = 0) {
    const cg = new THREE.Group();
    cg.position.set(x, y, z);
    cg.rotation.y = rotY;

    const box = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), crateMat);
    cg.add(box);

    // Corner bands
    const trim = new THREE.Mesh(new THREE.BoxGeometry(s * 1.02, s * 0.15, s * 1.02), trimMat);
    cg.add(trim);
    return cg;
  }

  g.add(singleCrate(-0.9, 0.9, -0.4, 1.8, 0.1));
  g.add(singleCrate(1.0, 0.8, 0.3, 1.6, -0.25));
  g.add(singleCrate(-0.2, 2.3, -0.2, 1.4, 0.45));

  return g;
}

export function makeSeaMine(def) {
  const g = new THREE.Group();
  const mineMat = flat(0x272c33, { roughness: 0.6 });

  // Floating sphere body
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 10), mineMat);
  sphere.position.y = 0.5;
  g.add(sphere);

  // 8 Spikes radiating outwards
  const spikeGeo = new THREE.ConeGeometry(0.25, 0.9, 6);
  const spikeMat = flat(0xd97706);
  const angles = [
    [0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0],
    [0, 0, 1], [0, 0, -1], [0.7, 0.7, 0], [-0.7, 0.7, 0]
  ];
  for (const [x, y, z] of angles) {
    const s = new THREE.Mesh(spikeGeo, spikeMat);
    s.position.set(x * 1.6, 0.5 + y * 1.6, z * 1.6);
    s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x, y, z).normalize());
    g.add(s);
  }

  // Top flashing red beacon
  const redBlink = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xff3b3b, emissive: 0xff0000, emissiveIntensity: 1.5 })
  );
  redBlink.position.set(0, 2.3, 0);
  g.add(redBlink);

  // Mooring chain down into water
  const chainMat = flat(0x181a1d);
  for (let y = -0.5; y >= -4.5; y -= 0.8) {
    const link = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.08, 4, 8), chainMat);
    link.position.y = y;
    g.add(link);
  }

  return g;
}

export function makeShipwreck(def) {
  const g = new THREE.Group();
  const wood = flat(0x422a18);

  // Tilted hull
  const hullGroup = new THREE.Group();
  hullGroup.position.set(0, -0.5, 0);
  hullGroup.rotation.set(0.3, 0.2, 0.45); // listing heavily

  // Main hull shape
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 1.2, 14, 8), wood);
  hull.rotation.x = Math.PI / 2;
  hull.scale.set(0.7, 1.0, 1.2);
  hullGroup.add(hull);

  // Broken main mast sticking out
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 9, 6), wood);
  mast.position.set(0, 4.0, -1.0);
  mast.rotation.z = -0.2;
  hullGroup.add(mast);

  // Splintered yardarm
  const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 5.5, 5), wood);
  yard.position.set(0, 6.5, -1.0);
  yard.rotation.x = Math.PI / 2;
  yard.rotation.z = 0.4;
  hullGroup.add(yard);

  // Tattered cloth sail scraps
  const sail = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 2.0), flat(0xc4b59d, { side: THREE.DoubleSide }));
  sail.position.set(1.2, 5.5, -1.0);
  sail.rotation.y = 0.5;
  hullGroup.add(sail);

  g.add(hullGroup);

  return g;
}

export function makePalmGrove(def) {
  const g = new THREE.Group();
  const trunkMat = flat(0xc98a55);
  const leafMat = flat(0x3fcf6e);

  function palm(x, z, s, tilt) {
    const pg = new THREE.Group();
    pg.position.set(x, 0, z);
    pg.scale.setScalar(s);

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 5.5, 6), trunkMat);
    trunk.position.y = 2.75;
    trunk.rotation.z = tilt;
    pg.add(trunk);

    const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 0), leafMat);
    leaves.scale.set(1.5, 0.6, 1.5);
    leaves.position.set(-tilt * 2.2, 5.8, 0);
    pg.add(leaves);
    return pg;
  }

  g.add(palm(0, 0, 1.1, 0.15));
  g.add(palm(2.2, 1.4, 0.85, -0.22));
  g.add(palm(-2.0, 1.8, 0.95, 0.18));
  g.add(palm(0.5, -2.2, 0.8, -0.12));

  return g;
}

export function makeSeaRocks(def) {
  const g = new THREE.Group();
  const rockMat = flat(0x6b7280);

  const mainRock = new THREE.Mesh(new THREE.DodecahedronGeometry(3.8, 0), rockMat);
  mainRock.scale.set(1.1, 1.8, 0.9);
  mainRock.position.y = 2.4;
  g.add(mainRock);

  const rock2 = new THREE.Mesh(new THREE.DodecahedronGeometry(2.2, 0), rockMat);
  rock2.position.set(3.2, 1.2, 1.5);
  g.add(rock2);

  const rock3 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.8, 0), rockMat);
  rock3.position.set(-2.8, 0.8, -1.8);
  g.add(rock3);

  return g;
}

export function makeCampfire(def) {
  const g = new THREE.Group();

  // Stone ring
  const stoneMat = flat(0x4b5563);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35, 0), stoneMat);
    stone.position.set(Math.cos(a) * 1.1, 0.2, Math.sin(a) * 1.1);
    g.add(stone);
  }

  // Logs teepee
  const logMat = flat(0x3e2723);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.4, 5), logMat);
    log.position.set(Math.cos(a) * 0.4, 0.5, Math.sin(a) * 0.4);
    log.rotation.x = Math.sin(a) * 0.5;
    log.rotation.z = -Math.cos(a) * 0.5;
    g.add(log);
  }

  // Glowing fire core
  const fire = new THREE.Mesh(
    new THREE.ConeGeometry(0.65, 1.2, 6),
    new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xff4500, emissiveIntensity: 1.8 })
  );
  fire.position.y = 0.65;
  g.add(fire);

  return g;
}

export function makePier(def) {
  const g = new THREE.Group();
  const wood = flat(0xc9722f);
  const darkWood = flat(0x8a4f26);

  // Planks
  const length = def.length || 14;
  const width = def.width || 4;
  const planks = Math.round(length / 0.8);
  const pitch = length / planks;

  for (let i = 0; i < planks; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(width, 0.25, pitch * 0.88), wood);
    p.position.set(0, 0.85, -length / 2 + pitch * (i + 0.5));
    g.add(p);
  }

  // Support posts into water
  for (let z = -length / 2 + 1; z <= length / 2 - 1; z += 3.5) {
    for (const x of [-width / 2 + 0.3, width / 2 - 0.3]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 3.2, 6), darkWood);
      post.position.set(x, 0.4, z);
      g.add(post);
    }
  }

  return g;
}

// Master Dispatcher: builds 3D group for any asset definition
export function makeAsset(def) {
  const root = new THREE.Group();
  root.position.set(def.x || 0, def.y || 0, def.z || 0);
  root.rotation.y = def.rotY || 0;
  const s = def.scale || 1.0;
  root.scale.set(s, s, s);

  let visual;
  switch (def.type) {
    case 'billboard':
      visual = makeBillboard(def);
      break;
    case 'lighthouse':
      visual = makeLighthouse(def);
      break;
    case 'watchtower':
      visual = makeWatchtower(def);
      break;
    case 'cannon':
      visual = makeCannon(def);
      break;
    case 'barrels':
      visual = makeBarrels(def);
      break;
    case 'crates':
      visual = makeCrates(def);
      break;
    case 'sea_mine':
      visual = makeSeaMine(def);
      break;
    case 'shipwreck':
      visual = makeShipwreck(def);
      break;
    case 'palm_grove':
      visual = makePalmGrove(def);
      break;
    case 'sea_rocks':
      visual = makeSeaRocks(def);
      break;
    case 'campfire':
      visual = makeCampfire(def);
      break;
    case 'pier':
      visual = makePier(def);
      break;
    default:
      visual = makeBillboard(def);
  }

  root.add(visual);
  root.userData.isAsset = true;
  root.userData.assetDef = def;
  return root;
}

// Catalog of available assets for the UI Palette
export const ASSET_CATALOG = [
  {
    category: 'Structures & Landmarks',
    items: [
      {
        type: 'billboard',
        name: 'Billboard Sign',
        icon: '🪧',
        desc: 'Custom sign with editable canvas text & colors',
        defaultProps: { text: 'BOOM BOATS', subText: 'PIRATE BAY', textColor: '#ffffff', bgColor: '#8b5a2b', scale: 1.0 }
      },
      {
        type: 'lighthouse',
        name: 'Lighthouse Tower',
        icon: '🗼',
        desc: 'Classic nautical tower with beacon lamp & balcony',
        defaultProps: { scale: 1.0 }
      },
      {
        type: 'watchtower',
        name: 'Watchtower',
        icon: '🏰',
        desc: 'Elevated wooden lookout post with flag',
        defaultProps: { scale: 1.0 }
      },
      {
        type: 'pier',
        name: 'Wooden Pier',
        icon: '🪵',
        desc: 'Dock promenade extension with water pilings',
        defaultProps: { length: 14, width: 4, scale: 1.0 }
      }
    ]
  },
  {
    category: 'Combat & Defenses',
    items: [
      {
        type: 'cannon',
        name: 'Naval Cannon',
        icon: '⚓',
        desc: 'Coastal defense battery on stone mount with cannonballs',
        defaultProps: { scale: 1.0 }
      },
      {
        type: 'sea_mine',
        name: 'Floating Sea Mine',
        icon: '💣',
        desc: 'Spiked naval mine with blinking red beacon & anchor chain',
        defaultProps: { scale: 1.0 }
      },
      {
        type: 'shipwreck',
        name: 'Sunken Shipwreck',
        icon: '⛵',
        desc: 'Listing pirate galleon hull with broken mast & sails',
        defaultProps: { scale: 1.0 }
      }
    ]
  },
  {
    category: 'Props & Obstacles',
    items: [
      {
        type: 'barrels',
        name: 'Explosive Barrels',
        icon: '🛢️',
        desc: 'Stack of red powder kegs with iron hoops',
        defaultProps: { scale: 1.0 }
      },
      {
        type: 'crates',
        name: 'Supply Crates',
        icon: '📦',
        desc: 'Stack of maritime cargo crates with metal brackets',
        defaultProps: { scale: 1.0 }
      },
      {
        type: 'campfire',
        name: 'Campfire',
        icon: '🔥',
        desc: 'Stone ring with log teepee and glowing fire embers',
        defaultProps: { scale: 1.0 }
      }
    ]
  },
  {
    category: 'Nature & Environment',
    items: [
      {
        type: 'palm_grove',
        name: 'Palm Grove',
        icon: '🌴',
        desc: 'Dense cluster of 4 tropical leaning palm trees',
        defaultProps: { scale: 1.0 }
      },
      {
        type: 'sea_rocks',
        name: 'Sea Rocks Spire',
        icon: '🪨',
        desc: 'Jagged ocean rocks & boulder outcropping',
        defaultProps: { scale: 1.0 }
      }
    ]
  }
];
