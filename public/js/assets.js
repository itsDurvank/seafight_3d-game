import * as THREE from 'three';
import { AQUA_MAKERS } from './new_assets/assetsAqua_life and decoration.js';
import { EXTRA_MAKERS } from './new_assets/assetsExtra.js';
import { HAUNTED_MAKERS } from './new_assets/assetsHaunted.js';
import { PIRATE_MAKERS } from './new_assets/assetsPirate.js';
import { buildCozyChest } from './new_assets/pinkchest.js';
import { buildSapphireChest } from './new_assets/sapphireChest.js';
import { buildFloatingTreasure as buildSapphireTreasure } from './new_assets/treasure.js';
import { buildFloatingTreasure as buildEmeraldTreasure } from './new_assets/treasure_emerald.js';
import { buildTrophy } from './new_assets/trophy.js';
import { buildBigBoat, buildSmallBoat } from './new_assets/boatsExtra.js';
import { buildHeroBoat } from './heroBoat.js';

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

  // Battlements / Crenellations along the main wall roofline (Optimized via InstancedMesh: 24 meshes -> 1 draw call)
  const wallTopY = 3.5 + 8.5;
  const merlonGeo = new THREE.BoxGeometry(1.6, 1.2, 0.6);
  const merlons = new THREE.InstancedMesh(merlonGeo, stoneLight, 24);
  const dummy = new THREE.Object3D();
  let mIdx = 0;
  for (let i = -7; i <= 7; i += 2.8) {
    for (const side of [-1, 1]) {
      dummy.position.set(i, wallTopY + 0.6, side * 8.0);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      merlons.setMatrixAt(mIdx++, dummy.matrix);

      dummy.position.set(side * 8.0, wallTopY + 0.6, i);
      dummy.rotation.set(0, Math.PI / 2, 0);
      dummy.updateMatrix();
      merlons.setMatrixAt(mIdx++, dummy.matrix);
    }
  }
  merlons.instanceMatrix.needsUpdate = true;
  g.add(merlons);

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
  const wood = flat(0x381e0f); // Dark Caribbean mahogany
  const gold = flat(0xd4af37, { metalness: 0.85, roughness: 0.25 });
  const darkIron = flat(0x1e2024);
  const sand = flat(0xe9d8a6);
  const velvet = flat(0x6a040f); // Crimson velvet lining

  // 1. Soft Sand Dune Base with ripples
  const dune = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 4.6, 0.6, 12), sand);
  dune.position.y = 0.3;
  g.add(dune);

  // Decorative Starfish on sand
  const starfish = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.15, 5), flat(0xff6b6b));
  starfish.position.set(2.4, 0.62, 1.8);
  starfish.rotation.x = Math.PI / 2;
  g.add(starfish);

  // 2. Main Chest Tub Body
  const bodyGroup = new THREE.Group();
  bodyGroup.position.set(0, 1.45, 0);

  // Wooden core tub
  const outerTub = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.7, 2.4), wood);
  bodyGroup.add(outerTub);

  // Crimson velvet interior
  const innerVelvet = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.4, 2.0), velvet);
  innerVelvet.position.y = 0.2;
  bodyGroup.add(innerVelvet);

  // Gilded Gold Corner Brackets & Riveted Straps
  for (const bx of [-1.75, -0.6, 0.6, 1.75]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.75, 2.46), gold);
    bodyGroup.add(strap);
  }
  for (const bz of [-1.15, 1.15]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(3.66, 0.2, 0.2), gold);
    strap.position.set(0, 0.75, bz);
    const strapBot = new THREE.Mesh(new THREE.BoxGeometry(3.66, 0.2, 0.2), gold);
    strapBot.position.set(0, -0.75, bz);
    bodyGroup.add(strap, strapBot);
  }

  // Side Carrying Handles (Iron drop-rings)
  for (const side of [-1, 1]) {
    const mount = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 0.35), darkIron);
    mount.position.set(side * 1.85, 0, 0);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.08, 5, 8), darkIron);
    ring.position.set(side * 1.9, -0.2, 0);
    ring.rotation.y = Math.PI / 2;
    bodyGroup.add(mount, ring);
  }

  // Front Ornate Skull Medallion Lockplate
  const lockPlate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.12), gold);
  lockPlate.position.set(0, 0.1, 1.25);
  const skullLock = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 6), flat(0xf8f9fa));
  skullLock.position.set(0, 0.15, 1.34);
  bodyGroup.add(lockPlate, skullLock);

  g.add(bodyGroup);

  // 3. Arched Heavy Pirate Lid (tilted open 68 degrees)
  const lidGroup = new THREE.Group();
  lidGroup.position.set(0, 2.3, -1.2);
  lidGroup.rotation.x = -1.2;

  // Wooden half-cylinder vault
  const lidWood = new THREE.Mesh(
    new THREE.CylinderGeometry(1.22, 1.22, 3.6, 10, 1, false, 0, Math.PI),
    wood
  );
  lidWood.rotation.z = Math.PI / 2;
  lidWood.position.set(0, 0, 1.2);
  lidGroup.add(lidWood);

  // Velvet interior lining under lid
  const lidVelvet = new THREE.Mesh(
    new THREE.CylinderGeometry(1.08, 1.08, 3.4, 10, 1, false, 0, Math.PI),
    velvet
  );
  lidVelvet.rotation.z = Math.PI / 2;
  lidVelvet.position.set(0, 0, 1.2);
  lidGroup.add(lidVelvet);

  // Gilded lid bands
  for (const bx of [-1.75, -0.6, 0.6, 1.75]) {
    const archBand = new THREE.Mesh(
      new THREE.CylinderGeometry(1.26, 1.26, 0.18, 10, 1, false, 0, Math.PI),
      gold
    );
    archBand.rotation.z = Math.PI / 2;
    archBand.position.set(bx, 0, 1.2);
    lidGroup.add(archBand);
  }

  // Lid support chains
  for (const side of [-1.5, 1.5]) {
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.5, 4), gold);
    chain.position.set(side, -0.5, 0.6);
    chain.rotation.x = 0.5;
    lidGroup.add(chain);
  }

  g.add(lidGroup);

  // 4. Sparkling Glowing Hoard of Gold & Royal Treasures
  const goldMound = new THREE.Mesh(
    new THREE.SphereGeometry(1.3, 8, 8),
    new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffa500,
      emissiveIntensity: 1.6,
      metalness: 0.95,
      roughness: 0.2
    })
  );
  goldMound.scale.set(1.25, 0.6, 0.85);
  goldMound.position.set(0, 2.05, 0.1);
  g.add(goldMound);

  // Cascading coins spilling over the front lip onto sand
  for (let i = 0; i < 9; i++) {
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 6), gold);
    coin.rotation.x = 0.3 + Math.random() * 0.4;
    coin.rotation.z = (Math.random() - 0.5) * 0.5;
    coin.position.set(
      (Math.random() - 0.5) * 2.2,
      1.8 - i * 0.14,
      1.25 + i * 0.12
    );
    g.add(coin);
  }

  // Golden Royal Chalice / Goblet
  const chaliceStem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.18, 0.8, 6), gold);
  chaliceStem.position.set(0.65, 2.5, 0);
  const chaliceCup = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.5, 6), gold);
  chaliceCup.rotation.x = Math.PI;
  chaliceCup.position.set(0.65, 2.9, 0);
  const chaliceGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), flat(0xef233c, { emissive: 0xef233c, emissiveIntensity: 2.0 }));
  chaliceGem.position.set(0.65, 2.9, 0.32);
  g.add(chaliceStem, chaliceCup, chaliceGem);

  // Pearl Necklace draped over side
  for (let i = 0; i < 7; i++) {
    const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.09, 5, 5), flat(0xfffdf0, { roughness: 0.2 }));
    pearl.position.set(-1.4 - i * 0.08, 2.05 - i * 0.18, 0.5 + i * 0.1);
    g.add(pearl);
  }

  // Large Cut Gemstones with Radiant Emissive Glow
  const gems = [
    { x: -0.8, y: 2.3, z: 0.4, color: 0x00b4d8, geo: new THREE.OctahedronGeometry(0.28) },
    { x: 0.1, y: 2.4, z: 0.5, color: 0xef233c, geo: new THREE.OctahedronGeometry(0.32) },
    { x: -0.3, y: 2.35, z: -0.2, color: 0x10b981, geo: new THREE.DodecahedronGeometry(0.24) },
    { x: 1.1, y: 2.15, z: 0.3, color: 0xa855f7, geo: new THREE.OctahedronGeometry(0.25) },
    { x: 1.8, y: 0.65, z: 1.5, color: 0xef233c, geo: new THREE.OctahedronGeometry(0.22) },
    { x: -1.7, y: 0.65, z: 1.4, color: 0x00b4d8, geo: new THREE.OctahedronGeometry(0.24) }
  ];
  for (const gm of gems) {
    const mesh = new THREE.Mesh(
      gm.geo,
      new THREE.MeshStandardMaterial({
        color: gm.color,
        emissive: gm.color,
        emissiveIntensity: 1.8,
        roughness: 0.1
      })
    );
    mesh.position.set(gm.x, gm.y, gm.z);
    g.add(mesh);
  }

  // Weathered Pirate Skull on Sand beside chest
  const skull = new THREE.Group();
  skull.position.set(-2.0, 0.75, 1.0);
  skull.rotation.set(-0.2, 0.6, -0.3);
  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.38, 7, 7), flat(0xe2d9cc));
  cranium.scale.set(1.0, 1.1, 1.15);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.32), flat(0xded4c5));
  jaw.position.set(0, -0.28, 0.15);
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 4, 4), flat(0x1a1a1a));
  eyeL.position.set(-0.13, -0.05, 0.36);
  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.09, 4, 4), flat(0x1a1a1a));
  eyeR.position.set(0.13, -0.05, 0.36);
  const goldTooth = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.06), gold);
  goldTooth.position.set(0.08, -0.28, 0.32);
  skull.add(cranium, jaw, eyeL, eyeR, goldTooth);
  g.add(skull);

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
  const deckWood = flat(0x8a5a36);
  const canvasCream = flat(0xf4ece1); // Warm ivory wall canvas
  const canvasRoof = flat(0x406a48);  // Rich forest safari green canopy
  const canopyFly = flat(0x527958);
  const darkWood = flat(0x4a2e16);
  const ropeMat = flat(0xd4a373);
  const carpetMat = flat(0x9d0208); // Persian crimson rug

  // 1. Raised Timber Deck Foundation with Front Entry Steps
  const deck = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.45, 9.8), deckWood);
  deck.position.y = 0.3;
  g.add(deck);

  // Deck corner foundation footings
  for (const [fx, fz] of [[-4.0, -4.5], [4.0, -4.5], [-4.0, 4.5], [4.0, 4.5]]) {
    const footing = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.6), flat(0x3e2723));
    footing.position.set(fx, 0.1, fz);
    g.add(footing);
  }

  // Front Step
  const step = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.22, 1.2), deckWood);
  step.position.set(0, 0.12, 5.2);
  g.add(step);

  // 2. Main Tent Body (Cabin Wall Tent Architecture)
  const tentGroup = new THREE.Group();
  tentGroup.position.set(0, 0.52, -0.8);

  // Vertical Wall Box (Canvas)
  const sideWalls = new THREE.Mesh(new THREE.BoxGeometry(7.0, 2.6, 6.4), canvasCream);
  sideWalls.position.y = 1.3;
  tentGroup.add(sideWalls);

  // High Sloping A-Frame Canvas Roof
  const roofGeo = new THREE.ConeGeometry(5.4, 3.4, 4);
  const roof = new THREE.Mesh(roofGeo, canvasRoof);
  roof.position.y = 2.6 + 1.7;
  roof.rotation.y = Math.PI / 4;
  tentGroup.add(roof);

  // Extended Front Porch Rain-Fly Awning
  const flyAwning = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.18, 3.2), canopyFly);
  flyAwning.position.set(0, 3.0, 3.8);
  flyAwning.rotation.x = -0.25;
  tentGroup.add(flyAwning);

  // Timber Front Porch Support Columns
  for (const px of [-3.4, 3.4]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 3.2, 6), darkWood);
    col.position.set(px, 1.45, 4.8);
    tentGroup.add(col);
  }

  // Timber Center Ridge Beam
  const ridgeBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 8.2, 6), darkWood);
  ridgeBeam.rotation.x = Math.PI / 2;
  ridgeBeam.position.set(0, 4.35, 0.6);
  tentGroup.add(ridgeBeam);

  // Front Open Doorway with Rolled-up Canvas Curtains
  const doorCut = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 0.3), flat(0x2b2d42));
  doorCut.position.set(0, 1.2, 3.22);
  tentGroup.add(doorCut);

  // Rolled Canvas Curtains with leather tie straps
  for (const cx of [-1.5, 1.5]) {
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2.3, 6), canvasCream);
    roll.position.set(cx, 1.2, 3.3);
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.12, 0.44), flat(0x5c3a21));
    strap.position.set(cx, 1.2, 3.3);
    tentGroup.add(roll, strap);
  }

  // Guy Ropes with ground pegs
  for (const side of [-1, 1]) {
    for (const rz of [-2.5, 1.5]) {
      const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.6, 4), darkWood);
      peg.position.set(side * 4.4, 0.15, rz);
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.6, 3), ropeMat);
      rope.position.set(side * 3.9, 1.3, rz);
      rope.rotation.z = -side * 0.45;
      tentGroup.add(peg, rope);
    }
  }

  // 3. Luxurious Interior (Visible through open door)
  // Persian Rug
  const rug = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.04, 3.6), carpetMat);
  rug.position.set(0, 0.05, 1.2);
  tentGroup.add(rug);

  // Expedition Camp Bed (Cot)
  const bedFrame = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.45, 2.8), darkWood);
  bedFrame.position.set(-1.0, 0.3, -0.6);
  const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.25, 2.7), flat(0xffffff));
  mattress.position.set(-1.0, 0.6, -0.6);
  const blanket = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.18, 1.8), flat(0xba181b));
  blanket.position.set(-1.0, 0.72, -0.3);
  const pillow = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 0.6), flat(0xfdf0d5));
  pillow.position.set(-1.0, 0.75, -1.6);
  tentGroup.add(bedFrame, mattress, blanket, pillow);

  // 4. Fancy Porch Equipment & Atmosphere
  // Glowing Brass Hurricane Lantern
  const lanternHook = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 4), flat(0x1a1a1a));
  lanternHook.position.set(0, 3.4, 4.6);
  const lanternCap = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.2, 6), flat(0xd4af37));
  lanternCap.position.set(0, 3.2, 4.6);
  const lanternGlass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 0.45, 8),
    new THREE.MeshStandardMaterial({
      color: 0xffa200,
      emissive: 0xff8c00,
      emissiveIntensity: 2.4,
      transparent: true,
      opacity: 0.95
    })
  );
  lanternGlass.position.set(0, 2.9, 4.6);
  tentGroup.add(lanternHook, lanternCap, lanternGlass);

  // Folding Field Table on Porch
  const tableTop = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.14, 1.2), darkWood);
  tableTop.position.set(2.2, 1.2, 3.6);
  for (const [tx, tz] of [[-0.6, -0.4], [0.6, -0.4], [-0.6, 0.4], [0.6, 0.4]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 4), darkWood);
    leg.position.set(2.2 + tx, 0.6, 3.6 + tz);
    tentGroup.add(leg);
  }
  tentGroup.add(tableTop);

  // Unrolled Treasure Map on table
  const map = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.6), flat(0xfefae0));
  map.position.set(2.2, 1.28, 3.6);
  map.rotation.x = -Math.PI / 2;
  map.rotation.z = 0.2;
  const compass = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 8), flat(0xd4af37));
  compass.position.set(2.4, 1.32, 3.5);
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.22, 6), flat(0x023e8a));
  mug.position.set(1.7, 1.38, 3.4);
  tentGroup.add(map, compass, mug);

  // Safari Director's Chair on Porch
  const chair = new THREE.Group();
  chair.position.set(2.2, 0.55, 2.2);
  chair.rotation.y = -0.4;
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.8), flat(0xd4a373));
  seat.position.y = 0.6;
  const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.08), flat(0xd4a373));
  backrest.position.set(0, 1.0, -0.38);
  for (const [cx, cz] of [[-0.4, -0.35], [0.4, -0.35], [-0.4, 0.35], [0.4, 0.35]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.65, 4), darkWood);
    leg.position.set(cx, 0.3, cz);
    chair.add(leg);
  }
  chair.add(seat, backrest);
  tentGroup.add(chair);

  // Stack of Split Firewood outside deck
  for (let i = 0; i < 5; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.5, 5), flat(0x5e3023));
    log.rotation.z = Math.PI / 2;
    log.position.set(-3.2, 0.2 + (i > 2 ? 0.22 : 0), 3.2 + (i % 3) * 0.3);
    tentGroup.add(log);
  }

  g.add(tentGroup);
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
  const teak = flat(0x6e4425);       // Rich weathered teak hull
  const creamPaint = flat(0xf4f1ea); // Classic white painted waterline
  const darkWalnut = flat(0x3e2716); // Walnut gunwales & seats
  const brass = flat(0xd4af37, { metalness: 0.8, roughness: 0.3 });
  const sand = flat(0xe9d8a6);
  const ropeColor = flat(0xd4a373);
  const oarWood = flat(0xc49a45);

  // 1. Soft Beach Sand Ground Mound with Ripple Contours
  const sandBase = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 6.2, 0.5, 12), sand);
  sandBase.position.y = 0.25;
  g.add(sandBase);

  // 2. Primary Beached Rowboat (Tilted resting naturally on the sand)
  const boat = new THREE.Group();
  boat.position.set(0.6, 0.85, 0.3);
  boat.rotation.set(0.12, 0.45, 0.22); // Elegant rest tilt

  // Midship Keel & Flat Bottom
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.3, 6.4), teak);
  bottom.position.y = 0.15;
  boat.add(bottom);

  // White Painted Lower Waterline Band
  const stripeL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.35, 6.4), creamPaint);
  stripeL.position.set(-1.18, 0.3, 0);
  const stripeR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.35, 6.4), creamPaint);
  stripeR.position.set(1.18, 0.3, 0);
  boat.add(stripeL, stripeR);

  // Flared Upper Gunwale Planks (Port & Starboard)
  const portSide = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.85, 6.4), teak);
  portSide.position.set(-1.22, 0.75, 0);
  portSide.rotation.z = -0.15; // Flared outward
  const starSide = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.85, 6.4), teak);
  starSide.position.set(1.22, 0.75, 0);
  starSide.rotation.z = 0.15; // Flared outward
  boat.add(portSide, starSide);

  // Walnut Cap Rails (Gunwales)
  const railL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 6.5), darkWalnut);
  railL.position.set(-1.3, 1.18, 0);
  const railR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 6.5), darkWalnut);
  railR.position.set(1.3, 1.18, 0);
  boat.add(railL, railR);

  // Sharp Pointed Curved Bow Prow (+Z)
  const stemPost = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.6, 5), darkWalnut);
  stemPost.rotation.x = -0.45; // raked stem
  stemPost.position.set(0, 0.85, 3.4);
  const bowFillL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.9, 1.8), teak);
  bowFillL.rotation.y = 0.45;
  bowFillL.position.set(-0.6, 0.75, 3.1);
  const bowFillR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.9, 1.8), teak);
  bowFillR.rotation.y = -0.45;
  bowFillR.position.set(0.6, 0.75, 3.1);
  boat.add(stemPost, bowFillL, bowFillR);

  // Flat Transom Stern (-Z)
  const transom = new THREE.Mesh(new THREE.BoxGeometry(2.35, 1.15, 0.22), darkWalnut);
  transom.rotation.x = 0.22; // raked stern
  transom.position.set(0, 0.8, -3.2);
  boat.add(transom);

  // Brass Oarlocks (Rowlocks) on Gunwales
  for (const rx of [-1.3, 1.3]) {
    for (const rz of [-0.6, 0.8]) {
      const oarlock = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.04, 4, 8, Math.PI), brass);
      oarlock.rotation.x = -Math.PI / 2;
      oarlock.position.set(rx, 1.3, rz);
      boat.add(oarlock);
    }
  }

  // --- Interior Detail ---
  // Slatted Floorboard bottom
  const floorGrid = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 4.8), darkWalnut);
  floorGrid.position.set(0, 0.35, -0.2);
  boat.add(floorGrid);

  // Curved Hull Ribs (Frames)
  for (let ribZ = -2.2; ribZ <= 1.8; ribZ += 1.0) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.08, 0.12), darkWalnut);
    rib.position.set(0, 0.4, ribZ);
    boat.add(rib);
  }

  // Walnut Thwarts (Rowing Benches)
  const bowSeat = new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.16, 3), darkWalnut);
  bowSeat.rotation.y = Math.PI;
  bowSeat.position.set(0, 1.0, 2.6);
  const midThwart = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.16, 0.7), darkWalnut);
  midThwart.position.set(0, 0.95, 0.2);
  const sternSeat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.16, 0.85), darkWalnut);
  sternSeat.position.set(0, 0.95, -2.6);
  boat.add(bowSeat, midThwart, sternSeat);

  // --- Detailed Wooden Oars with Carved Spoon Blades ---
  for (const [side, angle] of [[-1, -0.3], [1, 0.3]]) {
    const oarGroup = new THREE.Group();
    oarGroup.position.set(side * 0.4, 1.15, -0.2);
    oarGroup.rotation.set(0.15, angle, side * 0.35);

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 5.8, 6), oarWood);
    shaft.position.y = 0.5;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.5, 0.06), oarWood);
    blade.position.y = 3.2;
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.35, 6), flat(0x5c3a21));
    collar.position.y = 0.8;
    oarGroup.add(shaft, blade, collar);
    boat.add(oarGroup);
  }

  // --- Cargo & Nautical Props inside boat ---
  const cargoBox = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.65, 0.85), flat(0x8a5a32));
  cargoBox.position.set(0.3, 0.75, -1.5);
  cargoBox.rotation.y = 0.3;
  boat.add(cargoBox);

  const dittyBag = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4, 0), flat(0x3d5a80));
  dittyBag.position.set(-0.4, 0.65, -1.6);
  boat.add(dittyBag);

  // Vintage Red & White Lifebuoy Ring on Stern
  const lifebuoy = new THREE.Group();
  lifebuoy.position.set(0, 1.05, -3.35);
  lifebuoy.rotation.x = -0.22;
  const redRing = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.16, 6, 12), flat(0xef233c));
  lifebuoy.add(redRing);
  for (let s = 0; s < 4; s++) {
    const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 6), flat(0xffffff));
    strap.rotation.z = Math.PI / 2;
    strap.rotation.y = (s * Math.PI) / 2;
    strap.position.set(Math.cos((s * Math.PI) / 2) * 0.55, Math.sin((s * Math.PI) / 2) * 0.55, 0);
    lifebuoy.add(strap);
  }
  boat.add(lifebuoy);

  // Bow Brass Lantern
  const bowLantern = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.45, 0.32),
    new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xffaa00, emissiveIntensity: 1.5 })
  );
  bowLantern.position.set(0, 1.35, 3.1);
  boat.add(bowLantern);

  g.add(boat);

  // 3. Wooden Mooring Bollard & Coiled Hemp Rope on Sand
  const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 1.8, 6), darkWalnut);
  bollard.position.set(-2.8, 0.9, 1.8);
  const bollardCap = new THREE.Mesh(new THREE.SphereGeometry(0.32, 6, 6), darkWalnut);
  bollardCap.position.set(-2.8, 1.8, 1.8);
  g.add(bollard, bollardCap);

  for (let r = 1; r <= 3; r++) {
    const ropeCoil = new THREE.Mesh(new THREE.TorusGeometry(r * 0.32, 0.08, 4, 12), ropeColor);
    ropeCoil.rotation.x = Math.PI / 2;
    ropeCoil.position.set(-2.8, 0.55 + (r === 2 ? 0.06 : 0), 1.8);
    g.add(ropeCoil);
  }

  const hawser = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.8, 4), ropeColor);
  hawser.position.set(-1.4, 1.0, 2.4);
  hawser.rotation.set(0.3, -0.6, -1.2);
  g.add(hawser);

  // 4. Companion Small Beached Canoe beside it
  const canoe = new THREE.Group();
  canoe.position.set(-3.2, 0.6, -1.4);
  canoe.rotation.set(0.1, -0.7, -0.2);
  const canoeHull = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.7, 4.2, 7), teak);
  canoeHull.rotation.x = Math.PI / 2;
  canoeHull.scale.set(1.2, 0.55, 1.0);
  canoe.add(canoeHull);
  const canoeHollow = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.6, 3.8, 7), flat(0x3e2716));
  canoeHollow.rotation.x = Math.PI / 2;
  canoeHollow.scale.set(1.1, 0.5, 1.0);
  canoeHollow.position.y = 0.12;
  canoe.add(canoeHollow);
  g.add(canoe);

  return g;
}

// Boat asset helper builders for the world editor
const EXTRA_BOAT_STYLES = {
  pod: { hull: 0xff7aa8, accent: 0xfff0f5, cabin: 0xffc2d6, roof: 0xe84a82, flag: 0xffffff, look: 'pod' },
  twin: { hull: 0x1fb36b, accent: 0xfff3b0, cabin: 0xc8f5dc, roof: 0x0b7d49, flag: 0xfff3b0, look: 'twin' },
  dread: { hull: 0xff6b4a, accent: 0xffd166, cabin: 0xffc9a8, roof: 0xb23a24, flag: 0xffd166, look: 'dread' },
  sail: { hull: 0xffa62b, accent: 0xffffff, cabin: 0xffe0a3, roof: 0xff7a1a, flag: 0xffffff, look: 'sail' },
  raider: { hull: 0x8e6bff, accent: 0x39e6ff, cabin: 0xd9ccff, roof: 0x5b3fd1, flag: 0x39e6ff, look: 'raider' }
};

function makeExtraBoatAsset(look, def = {}) {
  const style = EXTRA_BOAT_STYLES[look] || EXTRA_BOAT_STYLES.pod;
  const isBig = look === 'pod' || look === 'twin' || look === 'dread';
  const g = isBig ? buildBigBoat(style) : buildSmallBoat(style);
  const mockBoat = { state: { speed: 8, turnVel: 0 } };
  g.userData.tick = (t, dt = 0.016) => {
    g.position.y = Math.sin(t * 1.6) * 0.08;
    g.rotation.z = Math.sin(t * 1.2) * 0.025;
    if (g.userData.update) g.userData.update(dt, t, mockBoat);
  };
  return g;
}

function makeHeroBoatAsset(def = {}) {
  const g = buildHeroBoat();
  const mockBoat = { state: { speed: 6, turnVel: 0 }, boosting: false };
  g.userData.tick = (t, dt = 0.016) => {
    g.position.y = Math.sin(t * 1.8) * 0.08;
    g.rotation.z = Math.sin(t * 1.3) * 0.025;
    if (g.userData.update) g.userData.update(dt, t, mockBoat);
  };
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
  if (AQUA_MAKERS[def.type]) {
    visual = AQUA_MAKERS[def.type](def);
  } else if (EXTRA_MAKERS[def.type]) {
    visual = EXTRA_MAKERS[def.type](def);
  } else if (HAUNTED_MAKERS[def.type]) {
    visual = HAUNTED_MAKERS[def.type](def);
  } else if (PIRATE_MAKERS[def.type]) {
    visual = PIRATE_MAKERS[def.type](def);
  } else {
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

      // Chests & Trophies from new assets
      case 'pink_chest_sea':
        visual = buildCozyChest({ float: true });
        break;
      case 'pink_chest_land':
        visual = buildCozyChest({ float: false });
        break;
      case 'sapphire_chest_sea':
        visual = buildSapphireChest({ float: true });
        break;
      case 'sapphire_chest_land':
        visual = buildSapphireChest({ float: false });
        break;
      case 'treasure_sea':
        visual = buildSapphireTreasure({ float: true });
        break;
      case 'treasure_land':
        visual = buildSapphireTreasure({ float: false });
        break;
      case 'emerald_treasure_sea':
        visual = buildEmeraldTreasure({ float: true });
        break;
      case 'emerald_treasure_land':
        visual = buildEmeraldTreasure({ float: false });
        break;
      case 'trophy_sea':
        visual = buildTrophy({ carried: false });
        break;
      case 'trophy_pedestal':
        visual = buildTrophy({ carried: true });
        break;

      // Boats from new assets
      case 'boat_cruiser':
        visual = makeExtraBoatAsset('pod', def);
        break;
      case 'boat_gunboat':
        visual = makeExtraBoatAsset('twin', def);
        break;
      case 'boat_dreadnought':
        visual = makeExtraBoatAsset('dread', def);
        break;
      case 'boat_skiff':
        visual = makeExtraBoatAsset('sail', def);
        break;
      case 'boat_raider':
        visual = makeExtraBoatAsset('raider', def);
        break;
      case 'hero_boat_prop':
        visual = makeHeroBoatAsset(def);
        break;

      default:
        visual = makeBillboard(def);
    }
  }

  root.add(visual);
  root.userData.isAsset = true;
  root.userData.assetDef = def;
  return root;
}

// Catalog of available assets for the UI Palette
export const ASSET_CATALOG = [
  // --- New Assets Categorized by Source File Name ---
  {
    category: 'assetsAqua_life and decoration.js',
    items: [
      { type: 'coral_reef', name: 'Coral Reef', icon: '🪸', desc: 'Branching, brain, fan and tube corals on a sandy reef with rocks', defaultProps: { scale: 1.0, seed: 21 }, water: true },
      { type: 'kelp_forest', name: 'Kelp Forest', icon: '🌿', desc: 'Swaying green kelp ribbons with floats around mossy rocks', defaultProps: { scale: 1.0, seed: 22 }, water: true },
      { type: 'anemone_clownfish', name: 'Anemone & Clownfish', icon: '🐠', desc: 'Wavy anemone on a rock with two clownfish swimming around it', defaultProps: { scale: 1.0, seed: 33 }, water: true },
      { type: 'giant_clam', name: 'Giant Clam & Pearl', icon: '🦪', desc: 'Ribbed clam that slowly opens and shuts around a glowing pearl', defaultProps: { scale: 1.0 }, water: true },
      { type: 'bubble_vent', name: 'Bubble Vent', icon: '🫧', desc: 'Rocky vent with a glowing rim, tube worms and rising bubbles', defaultProps: { scale: 1.0 }, water: true },
      { type: 'fish_school', name: 'Fish School', icon: '🐟', desc: 'Fourteen colourful fish circling in a school with ripples', defaultProps: { scale: 1.0, seed: 24 }, water: true },
      { type: 'jellyfish_swarm', name: 'Jellyfish Swarm', icon: '🪼', desc: 'Four glowing, pulsing jellyfish drifting with trailing tentacles', defaultProps: { scale: 1.0 }, water: true },
      { type: 'sea_turtle', name: 'Sea Turtle', icon: '🐢', desc: 'Friendly green turtle paddling along the surface', defaultProps: { scale: 1.0 }, water: true },
      { type: 'manta_ray', name: 'Manta Ray', icon: '🦈', desc: 'Gliding manta with flapping wings, white spots and a long tail', defaultProps: { scale: 1.0 }, water: true },
      { type: 'seahorse_pair', name: 'Seahorse Pair', icon: '🐴', desc: 'Two bobbing seahorses among seagrass on a sandy patch', defaultProps: { scale: 1.0 }, water: true },
      { type: 'pufferfish', name: 'Pufferfish', icon: '🐡', desc: 'Round spiky pufferfish that puffs up and down', defaultProps: { scale: 1.0 }, water: true },
      { type: 'whale', name: 'Blue Whale', icon: '🐋', desc: 'Giant smiling whale with a water spout and waving tail flukes', defaultProps: { scale: 1.0 }, water: true },
      { type: 'dolphin_pair', name: 'Leaping Dolphins', icon: '🐬', desc: 'Two dolphins arcing out of the water with splash rings', defaultProps: { scale: 1.0 }, water: true },
      { type: 'shark', name: 'Patrol Shark', icon: '🦈', desc: 'Grey shark with a fin circling its patch of sea, leaving a wake', defaultProps: { scale: 1.0 }, water: true },
      { type: 'octopus', name: 'Cheerful Octopus', icon: '🐙', desc: 'Orange octopus with big eyes and curling tentacles on a rock', defaultProps: { scale: 1.0 }, water: true },
      { type: 'seal_rock', name: 'Seal on a Rock', icon: '🦭', desc: 'Sleepy seal on a rock balancing a bouncing beach ball', defaultProps: { scale: 1.0 }, water: true },
      { type: 'starfish_cluster', name: 'Starfish Beach', icon: '⭐', desc: 'Six colourful starfish, shells and pebbles on the sand', defaultProps: { scale: 1.0, seed: 30 } },
      { type: 'giant_crab', name: 'Giant Crab', icon: '🦀', desc: 'Big red crab with snapping claws and wobbling eyestalks', defaultProps: { scale: 1.0 } },
      { type: 'tide_pool', name: 'Tide Pool', icon: '🏝️', desc: 'Rock-ringed pool with a starfish, tiny crab, shells and seaweed', defaultProps: { scale: 1.0, seed: 35 } },
      { type: 'lily_pond', name: 'Lily Pond', icon: '🪷', desc: 'Round pond with lily pads, lotus flowers, a frog and cattails', defaultProps: { scale: 1.0, seed: 34 } }
    ]
  },
  {
    category: 'assetsExtra.js',
    items: [
      { type: 'windmill', name: 'Island Windmill', icon: '🌬️', desc: 'Stone tower windmill with thatched roof and slowly turning sails', defaultProps: { scale: 1.0 } },
      { type: 'fountain', name: 'Plaza Fountain', icon: '⛲', desc: 'Two-tier stone fountain with animated water jets', defaultProps: { scale: 1.0 } },
      { type: 'market_stall', name: 'Market Stall', icon: '🍎', desc: 'Striped-awning stall with crates of fruit and a swaying lantern', defaultProps: { scale: 1.0 } },
      { type: 'tiki_torches', name: 'Tiki Torch Row', icon: '🔥', desc: 'Three bamboo torches with flickering flames', defaultProps: { scale: 1.0 } },
      { type: 'flower_garden', name: 'Flower Garden', icon: '🌸', desc: 'Round stone-bordered bed of colourful flowers and bushes', defaultProps: { scale: 1.0, seed: 7 } },
      { type: 'crystal_cluster', name: 'Glowing Crystals', icon: '💎', desc: 'Pulsing violet and cyan crystal spires on a rocky base', defaultProps: { scale: 1.0, seed: 3 } }
    ]
  },
  {
    category: 'assetsHaunted.js',
    items: [
      { type: 'skeleton_fort', name: 'Skeleton Fort', icon: '💀', desc: 'Bone-spiked stone fortress with a giant skull gate, green-flame towers and a skull-pile bonfire', defaultProps: { scale: 1.0 } },
      { type: 'bone_throne', name: 'Bone Throne', icon: '👑', desc: "Rib-fan throne topped by a red-eyed skull in a captain's hat, with candles and skulls", defaultProps: { scale: 1.0 } },
      { type: 'reaper_totem', name: 'Reaper Totem', icon: '☠️', desc: 'Tall pole of glowing skulls with a horned reaper head, tattered banners and hooks', defaultProps: { scale: 1.0 } },
      { type: 'graveyard', name: 'Pirate Graveyard', icon: '🪦', desc: 'Fenced cemetery with tombstones, a glowing open coffin, a rising skeleton hand and creeping fog', defaultProps: { scale: 1.0, seed: 7 } },
      { type: 'haunted_tree', name: 'Haunted Tree', icon: '🌳', desc: 'Dead tree with a glowing face, swinging ghost lanterns, hanging skulls and crows', defaultProps: { scale: 1.0, seed: 9 } },
      { type: 'gibbet_cages', name: 'Gibbet Cages', icon: '⛓️', desc: 'Gallows frame with three swinging cages of skeletons, chains and watching crows', defaultProps: { scale: 1.0 } },
      { type: 'siren_shrine', name: 'Siren Shrine', icon: '🧜', desc: 'Eerie stone siren on a flooded altar with glowing teal runes, orbiting pearls and a floating orb', defaultProps: { scale: 1.0 } },
      { type: 'volcano', name: 'Erupting Volcano', icon: '🌋', desc: 'Smoking volcano with glowing lava streams, flying fireballs and obsidian spikes', defaultProps: { scale: 1.0 } },
      { type: 'ghost_ship', name: 'Ghost Ship Wreck', icon: '👻', desc: 'Half-sunk spectral ship with torn sails, green lanterns, a skeleton helmsman and drifting mist', defaultProps: { scale: 1.0 }, water: true },
      { type: 'maelstrom', name: 'Maelstrom', icon: '🌀', desc: 'Swirling whirlpool with foaming spiral arms, a glowing abyss and debris spiralling in', defaultProps: { scale: 1.0 }, water: true }
    ]
  },
  {
    category: 'assetsPirate.js',
    items: [
      { type: 'jolly_roger', name: 'Jolly Roger Pole', icon: '🏴‍☠️', desc: 'Stone-based mast flying a waving skull-and-crossbones flag, guarded by skulls', defaultProps: { scale: 1.0 } },
      { type: 'skull_cave', name: 'Skull Cave', icon: '💀', desc: 'Giant skull-shaped rock with a cave mouth and flickering green eyes', defaultProps: { scale: 1.0 } },
      { type: 'dig_spot', name: 'X Marks the Spot', icon: '❌', desc: 'Red X in the sand, shovel, dirt mound, treasure map and a hole glinting with gold', defaultProps: { scale: 1.0 } },
      { type: 'gold_hoard', name: 'Gold Hoard', icon: '🪙', desc: 'Heap of gold coins, gems, goblets and bars on a stone slab', defaultProps: { scale: 1.0, seed: 4 } },
      { type: 'golden_idol', name: 'Golden Idol Shrine', icon: '🗿', desc: 'Stepped stone shrine with four torches and a glowing, spinning golden idol', defaultProps: { scale: 1.0 } },
      { type: 'cannonball_stack', name: 'Cannonball Pyramid', icon: '⚫', desc: 'Neat pyramid of iron cannonballs in a wooden frame with a ramrod', defaultProps: { scale: 1.0 } },
      { type: 'powder_magazine', name: 'Powder Magazine', icon: '🧨', desc: 'Domed stone bunker with iron door, DANGER sign, sandbags and powder kegs', defaultProps: { scale: 1.0 } },
      { type: 'tnt_crates', name: 'TNT Crates', icon: '💥', desc: 'Stacked TNT crates, dynamite bundle, sparking fuse and a plunger detonator', defaultProps: { scale: 1.0 } },
      { type: 'spike_barricade', name: 'Spike Barricade', icon: '🛡️', desc: 'Wooden hedgehogs, sharpened stakes, barbed rope and sandbags', defaultProps: { scale: 1.0 } },
      { type: 'palisade_gate', name: 'Palisade Gate', icon: '🚪', desc: 'Log wall with a double iron-banded gate, skull-topped towers and torches', defaultProps: { scale: 1.0 } },
      { type: 'burning_wreck', name: 'Burning Wreck', icon: '🔥', desc: 'Smashed ship hull with torn sail, roaring flames, smoke and flying embers', defaultProps: { scale: 1.0 } },
      { type: 'pirate_shack', name: 'Pirate Shack', icon: '🏚️', desc: 'Ramshackle stilt tavern with a Grog & Gold sign, lantern and rum barrels', defaultProps: { scale: 1.0 } },
      { type: 'crows_nest_mast', name: "Crow's Nest Mast", icon: '🔭', desc: 'Tall mast with rope ratlines, a barrel lookout and a skull pennant', defaultProps: { scale: 1.0 } },
      { type: 'harbor_crane', name: 'Harbor Crane', icon: '🏗️', desc: 'Wooden cargo crane swinging a crate on a rope', defaultProps: { scale: 1.0 } },
      { type: 'supply_drop', name: 'Supply Air Drop', icon: '🪂', desc: 'Parachuted loot crate with a red signal flare and golden light column', defaultProps: { scale: 1.0 } },
      { type: 'loot_beacon', name: 'Loot Beacon', icon: '✨', desc: 'Pedestal with a spinning golden gem, rings, sparks and a tall light beam', defaultProps: { scale: 1.0 } },
      { type: 'zone_marker', name: 'Storm Zone Marker', icon: '⚠️', desc: 'Ring of hazard pylons with spinning red rings and a pulsing danger wall', defaultProps: { scale: 1.0 } },
      { type: 'floating_wreckage', name: 'Floating Wreckage', icon: '🪵', desc: 'Bobbing planks, barrel, mast piece, ring buoy and crate with foam rings', defaultProps: { scale: 1.0, seed: 15 }, water: true },
      { type: 'kraken_tentacles', name: 'Kraken', icon: '🐙', desc: 'Giant purple kraken head with six writhing suckered tentacles', defaultProps: { scale: 1.0 }, water: true },
      { type: 'sea_serpent', name: 'Sea Serpent', icon: '🐉', desc: 'Long finned serpent weaving in and out of the waves', defaultProps: { scale: 1.0 }, water: true }
    ]
  },
  {
    category: 'pinkchest.js',
    items: [
      { type: 'pink_chest_sea', name: 'Cozy Gift Chest (Floating)', icon: '🎀', desc: 'Pastel peach & rose chest with butter-yellow bow, heart latch, pillow life-ring and fairy lights', defaultProps: { scale: 1.0, float: true }, water: true },
      { type: 'pink_chest_land', name: 'Cozy Gift Chest (Land)', icon: '🎁', desc: 'Pastel peach & rose chest with quilted lid, heart stamps, fairy lights and cocoa base', defaultProps: { scale: 1.0, float: false } }
    ]
  },
  {
    category: 'sapphireChest.js',
    items: [
      { type: 'sapphire_chest_sea', name: 'Royal Ruby Chest (Floating)', icon: '💎', desc: 'Royal ruby-red chest with gold brackets, red straps, life ring and radiant glints', defaultProps: { scale: 1.0, float: true }, water: true },
      { type: 'sapphire_chest_land', name: 'Royal Ruby Chest (Land)', icon: '👑', desc: 'Royal ruby-red chest with gold corner caps, teal studs and recessed diamond emblems', defaultProps: { scale: 1.0, float: false } }
    ]
  },
  {
    category: 'treasure.js',
    items: [
      { type: 'treasure_sea', name: 'Sapphire Treasure Chest (Floating)', icon: '📦', desc: 'Blue-violet wood chest with gold corner caps, teal studs, life ring and radiant gold seam', defaultProps: { scale: 1.0, float: true }, water: true },
      { type: 'treasure_land', name: 'Sapphire Treasure Chest (Land)', icon: '🧰', desc: 'Blue-violet chest with gold emblems, corner brackets and arched lid', defaultProps: { scale: 1.0, float: false } }
    ]
  },
  {
    category: 'treasure_emerald.js',
    items: [
      { type: 'emerald_treasure_sea', name: 'Emerald Treasure Chest (Floating)', icon: '💚', desc: 'Deep emerald chest with gold corner caps, keyhole, life ring and green glints', defaultProps: { scale: 1.0, float: true }, water: true },
      { type: 'emerald_treasure_land', name: 'Emerald Treasure Chest (Land)', icon: '❇️', desc: 'Deep emerald chest with gold caps, keyhole and emerald studs', defaultProps: { scale: 1.0, float: false } }
    ]
  },
  {
    category: 'trophy.js',
    items: [
      { type: 'trophy_sea', name: 'Championship Trophy (Floating Sea)', icon: '🏆', desc: 'Gold hexagon trophy with raised star, stacked wings, navy pedestal and golden light beam', defaultProps: { scale: 1.0, carried: false }, water: true },
      { type: 'trophy_pedestal', name: 'Championship Trophy (Pedestal)', icon: '🥇', desc: 'Gold championship trophy on navy pedestal with white name plate', defaultProps: { scale: 1.0, carried: true } }
    ]
  },
  {
    category: 'boatsExtra.js',
    items: [
      { type: 'boat_cruiser', name: 'Cruiser Gunboat', icon: '🚢', desc: 'Heavy pink-and-white cruiser with missile launcher, revolving radar and bow cannons', defaultProps: { scale: 1.0, boatLook: 'pod' }, water: true },
      { type: 'boat_gunboat', name: 'Twin Gunboat', icon: '🛥️', desc: 'Green naval gunboat with twin turret cannons and smokestack', defaultProps: { scale: 1.0, boatLook: 'twin' }, water: true },
      { type: 'boat_dreadnought', name: 'Dreadnought Warship', icon: '⚓', desc: 'Armored crimson flagship with triple turret, dual smokestacks and heavy bow guns', defaultProps: { scale: 1.0, boatLook: 'dread' }, water: true },
      { type: 'boat_skiff', name: 'Catamaran Patrol Skiff', icon: '⛵', desc: 'Twin-pontoon orange skiff with striped sail, swivel gun and tyre fenders', defaultProps: { scale: 1.0, boatLook: 'sail' }, water: true },
      { type: 'boat_raider', name: 'Raider Dart Boat', icon: '⚡', desc: 'Purple angular dart with glowing cyan visor, swept tail fins and twin gun pods', defaultProps: { scale: 1.0, boatLook: 'raider' }, water: true }
    ]
  },
  {
    category: 'heroBoat.js',
    items: [
      { type: 'hero_boat_prop', name: 'Sunfire Hero Boat', icon: '🚤', desc: 'Two-tone hydrofoil hero boat with cream deck, orange rub rail, cyan canopy and turbo engines', defaultProps: { scale: 1.0 }, water: true }
    ]
  },

  // --- Classic Core Assets ---
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

