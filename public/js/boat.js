import * as THREE from 'three';
import { BOAT, WORLD } from './config.js';
import { waveHeight } from './waves.js';
import { buildHeroBoat } from './new_assets/heroBoat.js';
import { buildClassicBoat } from './classicBoat.js';
import { buildHeroBoatFPV } from './heroBoatFPV.js';
import { buildMultiplayerBoat, MULTIPLAYER_BOATS } from './multiplayerBoats.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function mat(color) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8 });
}

export const PLAYER_STYLE = {
  hull: 0xfff4e0,
  chine: 0xdce5e8,
  accent: 0xff7a59,
  cabin: 0xff7a59,
  roof: 0xd9803f,
  flag: 0xffe066,
  dark: 0x2b3440,
  neon: 0x1fd1c9,
  look: 'player',
  scale: 1,
  isPlayer: true,
};

// One model builder for every boat. `style.look` changes the silhouette so
// each island's boat is easy to tell apart.
function buildModel(style) {
  const isPlayer = !!(style.isPlayer || style.look === 'player');
  if (isPlayer) {
    if (style.mpBoatSkin) {
      return buildMultiplayerBoat(style.mpBoatSkin, style, true);
    }
    if (style.mpColorIndex !== undefined && style.mpColorIndex !== null) {
      return buildMultiplayerBoat(style.mpColorIndex, style, true);
    }
    if (style.skin === 'classic') {
      return buildClassicBoat(style);
    }
    const hero = buildHeroBoat(style);
    const fpv = buildHeroBoatFPV(hero, style);
    hero.userData.fpv = fpv;
    return hero;
  }
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  const add = (mesh, x, y, z) => { mesh.position.set(x, y, z); g.add(mesh); return mesh; };
  const dark = 0x3b4452;
  const barrel = (len, r, x, y, z, color = dark) => {
    const geo = new THREE.CylinderGeometry(r, r, len, 8);
    geo.rotateX(Math.PI / 2);
    return add(new THREE.Mesh(geo, mat(color)), x, y, z);
  };

  add(new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 5), mat(style.hull)), 0, 0.2, 0);

  // pointed bow
  const bowGeo = new THREE.ConeGeometry(1.1 * Math.SQRT2, 2, 4);
  bowGeo.rotateY(Math.PI / 4);
  bowGeo.rotateX(Math.PI / 2); // tip points +Z
  const bow = add(new THREE.Mesh(bowGeo, mat(style.hull)), 0, 0.2, 3.5);
  bow.scale.set(1, 0.36, 1);

  add(new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.22, 5.05), mat(style.accent)), 0, 0.3, 0);

  const tall = style.look === 'pod' || style.look === 'dread';
  const cabinH = tall ? 1.5 : 1;
  add(new THREE.Mesh(new THREE.BoxGeometry(1.6, cabinH, 1.6), mat(style.cabin)), 0, 0.6 + cabinH / 2, -0.6);
  add(new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.2, 1.95), mat(style.roof)), 0, 0.7 + cabinH, -0.6);

  const flagMat = new THREE.MeshStandardMaterial({ color: style.flag, side: THREE.DoubleSide });

  switch (style.look) {
    case 'sail': {
      // small fast boat with a white triangular sail
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 4.6, 5), mat(0xffffff)), 0, 3.1, 0.9);
      const sh = new THREE.Shape();
      sh.moveTo(0, 0); sh.lineTo(2.8, 0); sh.lineTo(0, 4.2);
      const sg = new THREE.ShapeGeometry(sh);
      sg.rotateY(Math.PI / 2); // shape x now runs toward the stern
      add(new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, flatShading: true })), 0, 1.0, 0.9);
      const f = add(new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), flagMat), 0, 5.5, 0.4);
      f.rotation.y = Math.PI / 2;
      barrel(1.4, 0.1, 0, 0.9, 2.5);
      break;
    }
    case 'pod': {
      // big slow cruiser carrying a missile pod
      add(new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 1.9), mat(dark)), 0, 0.95, 1.5);
      for (const mx of [-0.45, 0.45]) {
        for (const my of [0.95, 1.35]) barrel(2.1, 0.17, mx, my, 1.6, 0xff4d4d);
      }
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 5), mat(0xffffff)), 0, 3.3, -0.6);
      const f = add(new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), flagMat), 0, 3.8, -1.05);
      f.rotation.y = Math.PI / 2;
      break;
    }
    case 'raider': {
      // sleek and fast, with swept fins
      for (const side of [-1, 1]) {
        const fin = add(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.9, 1.4), mat(style.accent)), side * 1.1, 0.9, -2.0);
        fin.rotation.z = -side * 0.25;
      }
      barrel(1.8, 0.12, 0, 0.95, 2.2);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 5), mat(0xffffff)), 0, 2.6, -0.6);
      const f = add(new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), flagMat), 0, 3.2, -1.05);
      f.rotation.y = Math.PI / 2;
      break;
    }
    case 'twin': {
      // twin heavy cannons on a turret
      add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 1.4), mat(dark)), 0, 0.85, 1.5);
      barrel(2.2, 0.2, -0.45, 1.1, 2.4);
      barrel(2.2, 0.2, 0.45, 1.1, 2.4);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 5), mat(0xffffff)), 0, 2.6, -0.6);
      const f = add(new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), flagMat), 0, 3.2, -1.05);
      f.rotation.y = Math.PI / 2;
      break;
    }
    case 'dread': {
      // flagship: smokestacks, bow cannons and a missile rack
      for (const sz of [-1.6, -2.5]) {
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 1.8, 8), mat(dark)), 0, 2.1, sz);
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.25, 8), mat(style.accent)), 0, 2.7, sz);
      }
      barrel(2.2, 0.2, -0.5, 1.0, 2.4);
      barrel(2.2, 0.2, 0.5, 1.0, 2.4);
      add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, 1.2), mat(dark)), 0, 0.85, 1.2);
      barrel(1.4, 0.15, -0.4, 1.15, 1.2, 0xff4d4d);
      barrel(1.4, 0.15, 0.4, 1.15, 1.2, 0xff4d4d);
      const f = add(new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.6), flagMat), 0, 4.3, -0.6);
      f.rotation.y = Math.PI / 2;
      break;
    }
    default: {
      // the player's boat: twin machine guns up front, missile pod on the roof
      barrel(1.5, 0.11, -0.55, 0.95, 2.4);
      barrel(1.5, 0.11, 0.55, 0.95, 2.4);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 1.2), mat(dark)), 0, 1.95, -0.6);
      barrel(1.4, 0.13, -0.22, 2.2, -0.6, 0xff4d4d);
      barrel(1.4, 0.13, 0.22, 2.2, -0.6, 0xff4d4d);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 5), mat(0xffffff)), 0, 2.9, -1.2);
      const f = add(new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), flagMat), 0, 3.3, -1.65);
      f.rotation.y = Math.PI / 2;
    }
  }

  g.scale.setScalar(style.scale || 1);
  return g;
}

export class Boat {
  constructor(scene, style = PLAYER_STYLE, spawn = WORLD.boatSpawn) {
    this.scene = scene;
    this.style = { ...style };
    this.isPlayer = !!(style.isPlayer || style.look === 'player');

    if (this.isPlayer) {
      let savedSkin = 'hero';
      try { savedSkin = localStorage.getItem('boom_boats_skin') || style.skin || 'hero'; } catch {}
      this.currentSkin = savedSkin;
      this.group = buildModel({ ...this.style, skin: this.currentSkin, isPlayer: true });
      this.fpv = this.group.userData?.fpv || null;
    } else {
      // Enemy boats & other small boats always keep their original models & skins
      this.currentSkin = 'original';
      this.group = buildModel({ ...this.style, isPlayer: false });
      this.fpv = null;
    }

    this.scale = style.scale || 1;
    this.top = BOAT.baseTop; // current top speed (grows while you sail flat out)
    this.boostEnergy = BOAT.boostTime; // seconds of boost left in the meter
    this.boostOn = false; // Shift toggles this
    this.boostIdle = 0; // seconds since boost was last on
    this.boostT = 0; // seconds since boost turned on
    this.state = { x: spawn.x, z: spawn.z, yaw: spawn.yaw, speed: 0, turnVel: 0 };
    scene.add(this.group);
  }

  get hp() { return this.playerRef?.hp ?? null; }
  get maxHp() { return this.playerRef?.maxHp ?? null; }

  setSkin(skinName) {
    if (!this.isPlayer) return this.currentSkin;
    const validSkins = ['hero', 'classic'];
    if (!validSkins.includes(skinName)) return this.currentSkin;
    this.currentSkin = skinName;
    delete this.style.mpColorIndex;
    delete this.style.mpBoatSkin;
    try { localStorage.setItem('boom_boats_skin', skinName); } catch {}
    if (this.group && this.scene) {
      if (this.fpv?.userData?.dispose) {
        this.fpv.userData.dispose();
      } else if (this.fpv?.userData?.unmount) {
        this.fpv.userData.unmount();
      }
      this.scene.remove(this.group);
    }
    this.group = buildModel({ ...this.style, skin: this.currentSkin, isPlayer: true });
    this.fpv = this.group.userData?.fpv || null;
    this.scene.add(this.group);
    this.group.position.set(this.state.x, 0, this.state.z);
    this.group.rotation.y = this.state.yaw;
    this.group.visible = true;
    return this.currentSkin;
  }

  applyStyle(customStyle, colorIndex = null, boatSkin = null) {
    this.style = { ...this.style, ...customStyle };
    if (colorIndex !== null && colorIndex !== undefined) {
      this.style.mpColorIndex = colorIndex;
    }
    if (boatSkin) {
      this.style.mpBoatSkin = boatSkin;
      this.style.skin = boatSkin;
    }
    if (this.group && this.scene) {
      if (this.fpv?.userData?.dispose) {
        this.fpv.userData.dispose();
      } else if (this.fpv?.userData?.unmount) {
        this.fpv.userData.unmount();
      }
      this.scene.remove(this.group);
    }
    this.group = buildModel({ ...this.style, isPlayer: true });
    this.fpv = this.group.userData?.fpv || null;
    this.scene.add(this.group);
    this.group.position.set(this.state.x, 0, this.state.z);
    this.group.rotation.y = this.state.yaw;
    this.group.visible = true;
  }

  resetStyle() {
    if (this.fpv?.userData?.dispose) {
      this.fpv.userData.dispose();
    } else if (this.fpv?.userData?.unmount) {
      this.fpv.userData.unmount();
    }
    this.style = { ...PLAYER_STYLE };
    delete this.style.mpColorIndex;
    delete this.style.mpBoatSkin;
    this.setSkin(this.currentSkin === 'classic' ? 'classic' : 'hero');
    if (this.group) this.group.visible = true;
  }

  toggleSkin() {
    if (!this.isPlayer) return this.currentSkin;
    const next = this.currentSkin === 'hero' ? 'classic' : 'hero';
    return this.setSkin(next);
  }

  get boosting() { return this.boostOn; }

  // Direct set for hold mode or program control
  setBoost(on) {
    if (on) {
      if (this.boostOn) return true;
      if (this.boostEnergy < BOAT.boostMin) return false;
      this.boostOn = true;
      this.boostT = 0;
      return true;
    } else {
      if (this.boostOn) {
        this.boostOn = false;
        this.boostIdle = 0;
        this.boostT = 0;
      }
      return false;
    }
  }

  // Shift toggles the boost on and off. It drains the meter while on; once it has been
  // off for a couple of seconds the meter refills.
  toggleBoost() {
    if (this.boostOn) { this.boostOn = false; this.boostIdle = 0; this.boostT = 0; return false; }
    if (this.boostEnergy < BOAT.boostMin) return false;
    this.boostOn = true;
    this.boostT = 0;
    return true;
  }

  cancelBoost() { this.boostOn = false; this.boostIdle = 0; this.boostT = 0; this.boostEnergy = BOAT.boostTime; }

  tickBoost(dt) {
    if (this.boostOn) {
      this.boostEnergy -= dt;
      this.boostIdle = 0;
      if (this.boostEnergy <= 0) { this.boostEnergy = 0; this.boostOn = false; this.boostT = 0; }
    } else {
      this.boostIdle += dt;
      if (this.boostIdle >= BOAT.boostRefillDelay) {
        this.boostEnergy = Math.min(BOAT.boostTime, this.boostEnergy + (BOAT.boostTime / BOAT.boostRefillTime) * dt);
      }
    }
  }

  // Player physics. Top speed creeps up the longer you sail flat out,
  // and slowly fades again if you let go of the throttle.
  // While boosting the boat surges ahead on its own, well past the normal top speed.
  update(dt, input) {
    const s = this.state;
    const braking = !!input.brake;
    if (braking && this.boostOn) { this.boostOn = false; this.boostIdle = 0; this.boostT = 0; } // braking cancels the boost
    this.tickBoost(dt);
    const boosting = this.boosting;
    if (boosting) {
      this.boostT += dt;
    }

    if (braking) {
      // Space: scrub speed off quickly (down to a crawl, never a stop or reverse)
      if (s.speed > BOAT.brakeMin) s.speed = Math.max(BOAT.brakeMin, s.speed - BOAT.brakeDecel * dt);
      this.top = Math.max(BOAT.baseTop, this.top - 25 * dt);
    } else if (boosting) {
      const k = Math.min(1, this.boostT / BOAT.boostRamp);
      const pull = BOAT.boostPull * (0.35 + 0.65 * k * k * (3 - 2 * k)); // smoothstep ease-in
      const goal = Math.min(BOAT.boostMax, Math.max(this.top, BOAT.baseTop) * BOAT.boostMul + BOAT.boostAdd);
      let next = s.speed + (goal - s.speed) * (1 - Math.exp(-pull * dt));
      next = Math.max(next, Math.min(goal, s.speed + BOAT.boostMinAccel * dt));
      s.speed = next;
    } else if (input.forward) {
      if (s.speed > this.top * 0.85) this.top = Math.min(BOAT.topCap, this.top + BOAT.topGain * dt);
      s.speed += (this.top - s.speed) * (1 - Math.exp(-BOAT.pull * dt));
    } else {
      this.top = Math.max(BOAT.baseTop, this.top - BOAT.topDecay * dt);
      s.speed *= Math.exp(-BOAT.drag * dt);
    }
    if (input.back && !boosting) {
      if (s.speed > 0) {
        // Scrub forward speed off smoothly when S is held, stopping cleanly at 0
        s.speed = Math.max(0, s.speed - (BOAT.brakeDecel * 0.65) * dt);
      }
    }
    // after a boost ends, bleed the extra speed off smoothly instead of snapping
    if (!boosting && !braking && s.speed > this.top) s.speed += (this.top - s.speed) * (1 - Math.exp(-2 * dt));
    s.speed = Math.max(0, s.speed);

    const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    const grip = clamp(Math.abs(s.speed) / 5, 0.6, 1);
    const turnMul = boosting ? BOAT.boostTurnMul : braking ? BOAT.brakeTurnMul : 1;
    const target = steer * BOAT.turnRate * turnMul * grip;

    // Responsive rudder: snappy input response without sluggish lag
    const isReversing = steer === 0 || (Math.sign(steer) !== Math.sign(s.turnVel) && Math.abs(s.turnVel) > 0.05);
    const turnRateK = isReversing ? 18 : 16;
    s.turnVel += (target - s.turnVel) * (1 - Math.exp(-turnRateK * dt));
    s.yaw += s.turnVel * dt;

    s.x += Math.sin(s.yaw) * s.speed * dt;
    s.z += Math.cos(s.yaw) * s.speed * dt;
  }

  // Sit the model on the waves and tilt it to match the surface.
  syncModel(dt, t) {
    const s = this.state;
    const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw); // forward
    const lx = Math.cos(s.yaw), lz = -Math.sin(s.yaw); // left
    const L = 3.2 * this.scale, W = 1.8 * this.scale;

    const hF = waveHeight(s.x + fx * L, s.z + fz * L, t);
    const hB = waveHeight(s.x - fx * L, s.z - fz * L, t);
    const hL = waveHeight(s.x + lx * W, s.z + lz * W, t);
    const hR = waveHeight(s.x - lx * W, s.z - lz * W, t);

    // Smooth vertical position so wave sample rotation doesn't cause vertical micro-jitter
    const rawY = (hF + hB + hL + hR) / 4 + 0.1;
    this.curY = (this.curY !== undefined) ? this.curY + (rawY - this.curY) * (1 - Math.exp(-12 * dt)) : rawY;

    const turnActivity = clamp(Math.abs(s.turnVel) / 1.2, 0, 1);
    // When turning, centrifugal banking smoothly dominates, preventing wave chop
    // from shaking the roll/pitch axes and vibrating nearby islands in FPP
    const waveRollWeight = Math.max(0, 1 - turnActivity * 1.2);
    const wavePitchWeight = Math.max(0.15, 1 - turnActivity * 0.85);

    const pitchT = -Math.atan2(hF - hB, 2 * L) * wavePitchWeight;
    const bankGrip = clamp(s.speed / 14, 0, 1.2);
    const rollT = Math.atan2(hL - hR, 2 * W) * waveRollWeight - s.turnVel * 0.08 * bankGrip;

    const k = 1 - Math.exp(-10 * dt);
    const g = this.group;
    g.position.set(s.x, this.curY, s.z);
    g.rotation.y = s.yaw;
    g.rotation.x += (pitchT - g.rotation.x) * k;
    g.rotation.z += (rollT - g.rotation.z) * k;

    if (g.userData && typeof g.userData.update === 'function') {
      g.userData.update(dt, t, this);
    }
    if (this.fpv?.userData && typeof this.fpv.userData.update === 'function') {
      this.fpv.userData.update(dt, t, this);
    }
  }

  teleport(x, z, yaw) {
    Object.assign(this.state, { x, z, yaw, speed: 0, turnVel: 0 });
  }
}
