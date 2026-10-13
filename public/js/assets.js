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

// --- NEW PROCEDURAL ASSET BUILDERS ---

export function makeSeaCastle(def) {
  const g = new THREE.Group();
  const stoneBase = flat(0x484f59);
  const stoneWall = flat(0x646f7c);
  const stoneLight = flat(0x768290);
  const roofMat = flat(0xb83232); // Royal crimson tile roofs
  const darkIron = flat(0x1a202c);
  const goldFinial = flat(0xffd166, { metalness: 0.8, roughness: 0.3 });
  const flagMat = flat(0xffd166);

  // 1. Raised Octagonal Bastion Foundation
  const base = new THREE.Mesh(new THREE.CylinderGeometry(14, 15.5, 3.5, 8), stoneBase);
  base.position.y = 1.75;
  g.add(base);

  // 2. Main Outer Fortress Walls
  const keep = new THREE.Mesh(new THREE.BoxGeometry(16, 8.5, 16), stoneWall);
  keep.position.y = 3.5 + 4.25;
  g.add(keep);

  // Battlements / Crenellations along the main wall roofline
  const wallTopY = 3.5 + 8.5;
  for (let i = -7; i <= 7; i += 2.8) {
    for (const side of [-1, 1]) {
      const merlonZ = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 0.6), stoneLight);
      merlonZ.position.set(i, wallTopY + 0.6, side * 8.0);
      const merlonX = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.2, 1.6), stoneLight);
      merlonX.position.set(side * 8.0, wallTopY + 0.6, i);
      g.add(merlonZ, merlonX);
    }
  }

  // 3. Four Corner Bastion Towers
  const towerCoords = [[-8.2, -8.2], [8.2, -8.2], [-8.2, 8.2], [8.2, 8.2]];
  for (const [tx, tz] of towerCoords) {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 14.5, 8), stoneLight);
    tower.position.set(tx, 3.5 + 7.25, tz);
    g.add(tower);

    const collar = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 2.7, 1.2, 8), stoneBase);
    collar.position.set(tx, 3.5 + 14.5 + 0.6, tz);
    g.add(collar);

    const coneRoof = new THREE.Mesh(new THREE.ConeGeometry(3.3, 5.0, 8), roofMat);
    coneRoof.position.set(tx, 3.5 + 14.5 + 1.2 + 2.5, tz);
    g.add(coneRoof);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.2, 5), flat(0xffffff));
    pole.position.set(tx, 3.5 + 14.5 + 1.2 + 5.0 + 1.6, tz);
    g.add(pole);
    const pennant = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9), flagMat);
    pennant.position.set(tx + 0.8, 3.5 + 14.5 + 1.2 + 5.0 + 2.4, tz);
    pennant.rotation.y = Math.PI / 2;
    g.add(pennant);
  }

  // 4. Grand Central Citadel Keep (Grand High Spire)
  const citTower = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.8, 13, 8), stoneWall);
  citTower.position.set(0, wallTopY + 6.5, 0);
  g.add(citTower);

  const citCollar = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 4.6, 1.4, 8), stoneBase);
  citCollar.position.set(0, wallTopY + 13 + 0.7, 0);
  g.add(citCollar);

  const citRoof = new THREE.Mesh(new THREE.ConeGeometry(5.4, 6.8, 8), roofMat);
  citRoof.position.set(0, wallTopY + 13 + 1.4 + 3.4, 0);
  g.add(citRoof);

  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 8), goldFinial);
  orb.position.set(0, wallTopY + 13 + 1.4 + 6.8 + 0.8, 0);
  g.add(orb);

  // 5. Arched Sea Gate & Iron Portcullis (Front facade)
  const gateFrame = new THREE.Mesh(new THREE.BoxGeometry(5.2, 6.0, 1.4), stoneBase);
  gateFrame.position.set(0, 3.5 + 3.0, 8.2);
  g.add(gateFrame);

  const gateArch = new THREE.Mesh(new THREE.BoxGeometry(3.6, 4.6, 1.5), darkIron);
  gateArch.position.set(0, 3.5 + 2.3, 8.3);
  g.add(gateArch);

  for (let bx = -1.3; bx <= 1.3; bx += 0.65) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4.4, 4), flat(0x2d3748));
    bar.position.set(bx, 3.5 + 2.2, 8.9);
    g.add(bar);
  }

  // 6. Glowing Gatehouse Torch Braziers
  for (const side of [-1, 1]) {
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.7), darkIron);
    bracket.position.set(side * 2.8, 3.5 + 4.0, 8.6);
    g.add(bracket);
    const torch = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 6, 6),
      new THREE.MeshStandardMaterial({ color: 0xffa020, emissive: 0xff7700, emissiveIntensity: 2.0 })
    );
    torch.position.set(side * 2.8, 3.5 + 4.3, 8.9);
    g.add(torch);
  }

  return g;
}

export function makeTikiBar(def) {
  const g = new THREE.Group();
  const deckWood = flat(0x8c5b36);
  const bamboo = flat(0xd4a373);
  const barTop = flat(0x4a2e1b);
  const thatch = flat(0xc49a45);

  // Raised Deck
  const deck = new THREE.Mesh(new THREE.BoxGeometry(8.0, 0.45, 6.0), deckWood);
  deck.position.y = 0.6;
  g.add(deck);

  // Bamboo Stilt Legs
  for (const [x, z] of [[-3.7, -2.7], [3.7, -2.7], [-3.7, 2.7], [3.7, 2.7]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 1.2, 6), bamboo);
    leg.position.set(x, 0.3, z);
    g.add(leg);
  }

  // 4 Bamboo Roof Posts
  for (const [x, z] of [[-3.5, -2.5], [3.5, -2.5], [-3.5, 2.5], [3.5, 2.5]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 4.2, 6), bamboo);
    post.position.set(x, 2.9, z);
    g.add(post);
  }

  // L-Shaped Bar Counter
  const mainBar = new THREE.Mesh(new THREE.BoxGeometry(5.4, 1.8, 1.2), barTop);
  mainBar.position.set(-0.6, 1.7, 1.4);
  const returnBar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.8, 2.8), barTop);
  returnBar.position.set(2.4, 1.7, 0.2);
  g.add(mainBar, returnBar);

  // 3 Bar Stools
  for (let i = -2.2; i <= 1.4; i += 1.8) {
    const stoolLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.1, 5), bamboo);
    stoolLeg.position.set(i, 1.35, 2.6);
    const stoolSeat = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.18, 8), barTop);
    stoolSeat.position.set(i, 1.95, 2.6);
    g.add(stoolLeg, stoolSeat);
  }

  // Coconut Drinks on Bar
  const coconutMat = flat(0x5c381c);
  for (const [cx, cz] of [[-1.2, 1.3], [0.8, 1.3]]) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.32, 6), coconutMat);
    cup.position.set(cx, 2.75, cz);
    const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 4), flat(0x06d6a0));
    straw.position.set(cx + 0.05, 2.95, cz);
    straw.rotation.z = 0.3;
    g.add(cup, straw);
  }

  // Thatched Pyramid Roof with Overhang
  const roof = new THREE.Mesh(new THREE.ConeGeometry(6.4, 2.8, 4), thatch);
  roof.position.y = 6.2;
  roof.rotation.y = Math.PI / 4;
  g.add(roof);

  return g;
}

export function makeBeachLounger(def) {
  const g = new THREE.Group();
  const wood = flat(0xd4a373);
  const tealCanvas = flat(0x06d6a0);
  const pinkCanvas = flat(0xef476f);

  // 1. Tilted Beach Umbrella
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 4.6, 6), flat(0xedf2f7));
  pole.position.set(0, 2.1, -1.2);
  pole.rotation.x = -0.15;
  g.add(pole);

  const canopy = new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.2, 8), tealCanvas);
  canopy.position.set(0, 4.1, -1.5);
  canopy.rotation.x = -0.15;
  g.add(canopy);

  // 2. Pair of Sun Loungers (Left & Right)
  const loungerOffsets = [[-1.8, tealCanvas], [1.8, pinkCanvas]];
  for (const [lx, mat] of loungerOffsets) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.25, 3.8), wood);
    frame.position.set(lx, 0.3, 0.6);
    for (const [kx, kz] of [[-0.7, -1.1], [0.7, -1.1], [-0.7, 2.3], [0.7, 2.3]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 4), wood);
      leg.position.set(lx + kx, 0.15, kz);
      g.add(leg);
    }
    const pad = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.18, 3.6), mat);
    pad.position.set(lx, 0.5, 0.6);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.16, 1.5), mat);
    back.position.set(lx, 0.95, -0.6);
    back.rotation.x = -0.48;
    g.add(frame, pad, back);
  }

  // Small Drinks Table
  const table = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.5, 8), wood);
  table.position.set(0, 0.45, 0.8);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.4, 6), flat(0xffd166));
  glass.position.set(0, 0.9, 0.8);
  g.add(table, glass);

  return g;
}

export function makeTreasureChest(def) {
  const g = new THREE.Group();
  const wood = flat(0x4a2e16);
  const iron = flat(0x22262a);
  const sand = flat(0xe9d8a6);

  // Sand Mound Base
  const mound = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.8, 0.5, 8), sand);
  mound.position.y = 0.25;
  g.add(mound);

  // Main Chest Body
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.5, 2.0), wood);
  body.position.set(0, 1.25, 0);
  g.add(body);

  // Iron Edge Bands
  for (const bx of [-1.55, -0.5, 0.5, 1.55]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.55, 2.05), iron);
    band.position.set(bx, 1.25, 0);
    g.add(band);
  }

  // Front Keyhole Plate
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.1), flat(0xffd700));
  lock.position.set(0, 1.3, 1.05);
  g.add(lock);

  // Open Curved Lid tilted back
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

  // Sparkling Glowing Gold Treasure Heap Inside
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

  // Loose Ruby & Emerald Gemstones on sand
  const gem1 = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), flat(0xef233c, { emissive: 0xef233c, emissiveIntensity: 1.2 }));
  gem1.position.set(1.4, 0.55, 1.2);
  const gem2 = new THREE.Mesh(new THREE.OctahedronGeometry(0.25), flat(0x06d6a0, { emissive: 0x06d6a0, emissiveIntensity: 1.2 }));
  gem2.position.set(-1.3, 0.55, 1.3);
  g.add(gem1, gem2);

  return g;
}

export function makeSeaBuoy(def) {
  const g = new THREE.Group();
  const buoyMat = flat(0xffd166);
  const redBand = flat(0xef233c);
  const steel = flat(0x272e39);

  // Lower float cone (in water)
  const lower = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 0.8, 2.0, 10), redBand);
  lower.position.y = 0.9;
  g.add(lower);

  // Upper float body
  const upper = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.8, 2.4, 10), buoyMat);
  upper.position.y = 2.9;
  g.add(upper);

  // Black Rubber Bumper Collar
  const collar = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.22, 6, 12), steel);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 1.9;
  g.add(collar);

  // Steel Tower Lattice Frame
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.1, 3.2, 4), steel);
  tower.position.y = 5.2;
  g.add(tower);

  // High-Intensity Flashing Beacon Lamp
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 8, 8),
    new THREE.MeshStandardMaterial({
      color: 0x00f5d4,
      emissive: 0x00f5d4,
      emissiveIntensity: 2.5
    })
  );
  beacon.position.y = 6.8;
  g.add(beacon);

  const cageRing = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.08, 5, 8), steel);
  cageRing.rotation.x = Math.PI / 2;
  cageRing.position.y = 6.8;
  g.add(cageRing);

  return g;
}

export function makeTent(def) {
  const g = new THREE.Group();
  const canvas = flat(0x606c38);
  const darkWood = flat(0x3e2723);

  // Triangular Canvas Tent Body
  const tent = new THREE.Mesh(new THREE.ConeGeometry(3.4, 3.2, 4), canvas);
  tent.position.y = 1.6;
  tent.rotation.y = Math.PI / 4;
  g.add(tent);

  // Ridge Pole
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 3.8), darkWood);
  ridge.position.y = 3.15;
  g.add(ridge);

  // Bedroll inside opening
  const bedroll = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.8, 6), flat(0x3d5a80));
  bedroll.rotation.z = Math.PI / 2;
  bedroll.position.set(0, 0.35, 1.1);
  g.add(bedroll);

  // Small Camp Crate
  const crate = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.8, 1.0), flat(0x8a5a32));
  crate.position.set(2.4, 0.4, 0.5);
  g.add(crate);

  return g;
}

export function makeTotem(def) {
  const g = new THREE.Group();
  const stoneMat = flat(0x5c6370);
  const mossMat = flat(0x386641);
  const runeMat = flat(0x38bdf8, { emissive: 0x0284c7, emissiveIntensity: 1.8 });

  // Stepped Altar Base
  const base1 = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.8, 4.8), stoneMat);
  base1.position.y = 0.4;
  const base2 = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.8, 3.6), stoneMat);
  base2.position.y = 1.2;
  g.add(base1, base2);

  // Carved Monolithic Moai Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(2.4, 7.2, 2.8), stoneMat);
  head.position.y = 5.2;
  g.add(head);

  const brow = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.9, 1.0), stoneMat);
  brow.position.set(0, 6.8, 1.4);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.6, 0.9), stoneMat);
  nose.position.set(0, 5.2, 1.5);
  const chin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 0.8), stoneMat);
  chin.position.set(0, 2.6, 1.3);
  g.add(brow, nose, chin);

  for (const eyeX of [-0.65, 0.65]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.35, 0.3), runeMat);
    eye.position.set(eyeX, 6.2, 1.4);
    g.add(eye);
  }

  const moss = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.5, 2.9), mossMat);
  moss.position.set(0, 3.5, 0);
  g.add(moss);

  return g;
}

export function makeStoneRuins(def) {
  const g = new THREE.Group();
  const marble = flat(0xd5cec5);
  const darkStone = flat(0x8c8275);
  const ivy = flat(0x2d6a4f);

  // Cracked Stone Foundation Slabs
  const slab = new THREE.Mesh(new THREE.BoxGeometry(10.0, 0.6, 10.0), darkStone);
  slab.position.y = 0.3;
  g.add(slab);

  // 1. Intact Pillar
  const col1 = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 7.0, 8), marble);
  col1.position.set(-3.2, 3.8, -3.2);
  const cap1 = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.6, 1.9), marble);
  cap1.position.set(-3.2, 7.4, -3.2);
  g.add(col1, cap1);

  // 2. Broken Half Pillar
  const col2 = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 3.4, 8), marble);
  col2.position.set(3.2, 2.0, -3.2);
  const fallenChunk = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 2.8, 8), marble);
  fallenChunk.rotation.z = 1.3;
  fallenChunk.position.set(3.2, 0.9, -1.2);
  g.add(col2, fallenChunk);

  // 3. Tilted Pillar with Supported Cracked Architrave Beam
  const col3 = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 6.8, 8), marble);
  col3.position.set(-3.2, 3.7, 3.2);
  col3.rotation.z = -0.12;
  const architrave = new THREE.Mesh(new THREE.BoxGeometry(7.2, 1.1, 1.4), marble);
  architrave.position.set(-3.2, 7.3, 0);
  architrave.rotation.x = 0.08;
  g.add(col3, architrave);

  const vine = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2, 0), ivy);
  vine.position.set(-3.2, 4.2, 3.2);
  g.add(vine);

  return g;
}

export function makeAnchor(def) {
  const g = new THREE.Group();
  const iron = flat(0x2b2d42, { roughness: 0.6, metalness: 0.7 });
  const wood = flat(0x4a2e16);
  const sand = flat(0xe9d8a6);

  // Sand Base Mound
  const sandBase = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.2, 0.5, 8), sand);
  sandBase.position.y = 0.25;
  g.add(sandBase);

  // Tilted Anchor Assembly
  const anchorGroup = new THREE.Group();
  anchorGroup.position.set(0, 0.4, 0);
  anchorGroup.rotation.z = 0.52;
  anchorGroup.rotation.y = 0.3;

  const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 7.6, 6), iron);
  shank.position.y = 3.8;
  anchorGroup.add(shank);

  const stock = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.5, 0.5), wood);
  stock.position.set(0, 6.4, 0);
  anchorGroup.add(stock);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.18, 6, 12), iron);
  ring.position.set(0, 7.6, 0);
  anchorGroup.add(ring);

  const crown = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.32, 6, 10, Math.PI), iron);
  crown.rotation.z = Math.PI;
  crown.position.set(0, 1.8, 0);
  anchorGroup.add(crown);

  for (const side of [-1, 1]) {
    const fluke = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.4, 3), iron);
    fluke.position.set(side * 2.2, 2.4, 0);
    fluke.rotation.z = side * 0.4;
    anchorGroup.add(fluke);
  }
  g.add(anchorGroup);

  // Heavy Chain Links on Ground
  for (let i = 0; i < 4; i++) {
    const link = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.12, 5, 8), iron);
    link.rotation.x = Math.PI / 2 + i * 0.3;
    link.position.set(1.4 + i * 0.45, 0.4, -0.4 + i * 0.3);
    g.add(link);
  }

  return g;
}

export function makeRowboats(def) {
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

// Master Dispatcher: builds 3D group for any asset definition
export function makeAsset(def) {
  const root = new THREE.Group();
  root.position.set(def.x || 0, def.y || 0, def.z || 0);
  root.rotation.y = def.rotY || 0;
  const s = def.scale || 1.0;
  root.scale.set(s, s, s);

  let visual;
  switch (def.type) {
    case 'sea_castle':
      visual = makeSeaCastle(def);
      break;
    case 'tiki_bar':
      visual = makeTikiBar(def);
      break;
    case 'beach_lounger':
      visual = makeBeachLounger(def);
      break;
    case 'treasure_chest':
      visual = makeTreasureChest(def);
      break;
    case 'sea_buoy':
      visual = makeSeaBuoy(def);
      break;
    case 'tent':
      visual = makeTent(def);
      break;
    case 'totem':
      visual = makeTotem(def);
      break;
    case 'stone_ruins':
      visual = makeStoneRuins(def);
      break;
    case 'anchor':
      visual = makeAnchor(def);
      break;
    case 'rowboats':
      visual = makeRowboats(def);
      break;
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
        type: 'sea_castle',
        name: 'Majestic Sea Castle',
        icon: '🏰',
        desc: 'Towering coastal stone fortress with bastion turrets, citadel keep, sea gate portcullis & battlements',
        defaultProps: { scale: 1.0 }
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
        icon: '🏯',
        desc: 'Elevated wooden lookout post with flag',
        defaultProps: { scale: 1.0 }
      },
      {
        type: 'stone_ruins',
        name: 'Ancient Stone Ruins',
        icon: '🏛️',
        desc: 'Sunken marble temple colonnade with broken pillars, architrave & creeping ivy',
        defaultProps: { scale: 1.0 }
      },
      {
        type: 'totem',
        name: 'Mystic Island Totem',
        icon: '🗿',
        desc: 'Carved monolithic stone Moai head with glowing crystal eyes & moss altar',
        defaultProps: { scale: 1.0 }
      },
      {
        type: 'pier',
        name: 'Wooden Pier',
        icon: '🪵',
        desc: 'Dock promenade extension with water pilings',
        defaultProps: { length: 14, width: 4, scale: 1.0 }
      },
      {
        type: 'billboard',
        name: 'Billboard Sign',
        icon: '🪧',
        desc: 'Custom sign with editable canvas text & colors',
        defaultProps: { text: 'BOOM BOATS', subText: 'PIRATE BAY', textColor: '#ffffff', bgColor: '#8b5a2b', scale: 1.0 }
      }
    ]
  },
  {
    category: 'Resort & Beach Life',
    items: [
      {
        type: 'tiki_bar',
        name: 'Tiki Bar Hut',
        icon: '🍹',
        desc: 'Tropical bamboo beach hut with thatched palm roof, bar counter, stools & coconut drinks',
        defaultProps: { scale: 1.0 }
      },
      {
        type: 'beach_lounger',
        name: 'Beach Umbrella & Loungers',
        icon: '🏖️',
        desc: 'Tilted striped sun parasol with pair of colorful wooden deck loungers & drinks table',
        defaultProps: { scale: 1.0 }
      },
      {
        type: 'tent',
        name: 'Campground Tent',
        icon: '⛺',
        desc: 'A-frame canvas expedition tent with bedroll and wooden camp crate',
        defaultProps: { scale: 1.0 }
      },
      {
        type: 'rowboats',
        name: 'Beached Rowboat',
        icon: '🚣',
        desc: 'Rustic wooden rowboat pulled onto sand with bench seats and crossed oars',
        defaultProps: { scale: 1.0 }
      }
    ]
  },
  {
    category: 'Pirate & Coastal Lore',
    items: [
      {
        type: 'treasure_chest',
        name: 'Glittering Treasure Chest',
        icon: '💎',
        desc: 'Open iron-banded chest overflowing with glittering gold coins and radiant gemstones',
        defaultProps: { scale: 1.0 }
      },
      {
        type: 'anchor',
        name: 'Colossal Sea Anchor',
        icon: '⚓',
        desc: 'Gigantic weathered cast iron ship anchor half-buried in the beach sand with heavy chain',
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
    category: 'Combat & Defenses',
    items: [
      {
        type: 'cannon',
        name: 'Naval Cannon',
        icon: '💥',
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
        type: 'sea_buoy',
        name: 'Marine Navigation Buoy',
        icon: '🚨',
        desc: 'High-visibility channel marker buoy with flashing turquoise solar beacon light',
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
