import * as THREE from 'three';
import { WORLD, POTION } from './config.js';
import { waveHeight } from './waves.js';
import { audio } from './audio.js';

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);

// soft red glow texture (drawn once, shared by every potion)
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,90,110,0.95)');
  grd.addColorStop(0.45, 'rgba(255,40,70,0.35)');
  grd.addColorStop(1, 'rgba(255,40,70,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// The potion: a round glass flask half full of red liquid, a cork, and a tag with a cross.
function makePotion(glowTex) {
  const g = new THREE.Group();
  const flask = new THREE.Group(); // spins and bobs; the glow and beam stay upright
  g.add(flask);

  const glassMat = new THREE.MeshStandardMaterial({ color: 0xffe3e8, transparent: true, opacity: 0.32, roughness: 0.1, metalness: 0, depthWrite: false });
  const glass = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 16), glassMat);

  // liquid: a spherical cap (the lower part of a sphere) plus a flat red surface on top
  const t0 = Math.PI * 0.38, R = 0.9;
  const liqMat = new THREE.MeshStandardMaterial({ color: 0xe3213d, emissive: 0x9a0f24, emissiveIntensity: 0.9, roughness: 0.35, side: THREE.DoubleSide });
  const liquid = new THREE.Mesh(new THREE.SphereGeometry(R, 20, 14, 0, TAU, t0, Math.PI - t0), liqMat);
  const surface = new THREE.Mesh(new THREE.CircleGeometry(R * Math.sin(t0), 20), liqMat);
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = R * Math.cos(t0);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.7, 12), glassMat);
  neck.position.y = 1.2;
  const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.27, 0.34, 12), new THREE.MeshStandardMaterial({ color: 0xe39a3b, flatShading: true }));
  cork.position.y = 1.66;
  const string = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.06, 6, 14), new THREE.MeshStandardMaterial({ color: 0x7a2a3a }));
  string.rotation.x = Math.PI / 2;
  string.position.y = 1.42;

  // hanging tag with a cross on both sides
  const tag = new THREE.Group();
  const tagMat = new THREE.MeshStandardMaterial({ color: 0xf0b45a, side: THREE.DoubleSide, flatShading: true });
  tag.add(new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.86), tagMat));
  const crossMat = new THREE.MeshBasicMaterial({ color: 0xe8664f });
  for (const z of [0.012, -0.012]) {
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.01), crossMat);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.36, 0.01), crossMat);
    a.position.z = b.position.z = z;
    tag.add(a, b);
  }
  tag.position.set(0.62, 0.62, 0.35);
  tag.rotation.z = -0.22;

  flask.add(glass, liquid, surface, neck, cork, string, tag);
  flask.scale.setScalar(2.2);
  flask.position.y = 1.5; // the round bottom sits below the waterline, so it looks like it floats

  // a little life-ring keeps it afloat; the whole "buoy" rocks with the waves
  const buoy = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.5, 8, 24), new THREE.MeshStandardMaterial({ color: 0xff5a6e, roughness: 0.6, flatShading: true }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.1;
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.52, 8, 24, Math.PI / 3), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, flatShading: true }));
  const stripes = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const s = stripe.clone();
    s.rotation.x = Math.PI / 2;
    s.rotation.z = i * (Math.PI * 2 / 3);
    s.position.y = 0.1;
    stripes.add(s);
  }
  buoy.add(flask, ring, stripes);
  g.add(buoy);

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false }));
  glow.scale.set(13, 13, 1);
  glow.position.y = 3.2;
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.4, 28, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xff4d66, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide })
  );
  beam.position.y = 14;
  g.add(glow, beam);
  g.visible = false;
  return { g, flask, glow, buoy };
}

// Health potions float on the sea in small sets of 1-3. A new set appears 40-60 seconds after the last
// potion on the sea is gone, a little way from you. You or ANY hurt enemy boat can grab one,
// so they pull the fight towards them.
const easeOutBack = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };

export class Potions {
  constructor(scene, combat) {
    this.combat = combat;
    this.onSpawn = null; // (count, firstPotion) => void
    this.onClaim = null; // (who, potion, healed) => void
    const tex = glowTexture();
    this.items = [];
    for (let i = 0; i < POTION.maxAlive; i++) {
      const m = makePotion(tex);
      scene.add(m.g);
      this.items.push({ ...m, on: false, x: 0, z: 0, age: 0, ph: 0, ripple: 0 });
    }
    this.first = true;
    this.armed = false; // true while we are counting down to the next set
    this.timer = 0;
  }

  // live potions (for the minimap and the enemy AI)
  list() { return this.items.filter((p) => p.on); }

  nearest(x, z, range) {
    let best = null, bd = range;
    for (const p of this.items) {
      if (!p.on) continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  // open water: away from islands, the harbor safe zone and the edge of the sea
  freeSpot(x, z) {
    if (Math.hypot(x, z) > WORLD.radius - 90) return false;
    const h = WORLD.safeHarbor;
    if (Math.hypot(x - h.x, z - h.z) < h.r + 14) return false;
    return WORLD.islands.every((i) => Math.hypot(x - i.x, z - i.z) > i.r + 24);
  }

  place(x, z) {
    const free = this.items.find((p) => !p.on);
    if (!free) return null;
    if (!this.freeSpot(x, z)) return null;
    if (this.items.some((p) => p.on && Math.hypot(p.x - x, p.z - z) < POTION.spacing)) return null;
    free.on = true; free.x = x; free.z = z; free.age = 0; free.ph = Math.random() * TAU; free.ripple = 0;
    free.g.position.set(x, 0, z);
    free.g.scale.setScalar(0.001); // pops up out of the water
    free.g.visible = true;
    this.combat.ring(x, z, 16, 0.9, 0xff6b81, 0.9);
    return free;
  }

  // A set of 1-3 potions, floating close together a little way from you.
  spawnSet(player) {
    const n = Math.floor(rand(POTION.setSize[0], POTION.setSize[1] + 1));
    let cx = 0, cz = 0, ok = false;
    for (let tries = 0; tries < 40 && !ok; tries++) {
      if (player) {
        const a = Math.random() * TAU, r = rand(POTION.spawnRing[0], POTION.spawnRing[1]);
        cx = player.state.x + Math.cos(a) * r; cz = player.state.z + Math.sin(a) * r;
      } else {
        const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * (WORLD.radius - 90);
        cx = Math.cos(a) * r; cz = Math.sin(a) * r;
      }
      ok = this.freeSpot(cx, cz);
    }
    if (!ok) return 0;
    let first = null, placed = 0;
    for (let i = 0; i < n; i++) {
      for (let tries = 0; tries < 30; tries++) {
        const a = Math.random() * TAU, r = i === 0 ? 0 : rand(POTION.setSpread[0], POTION.setSpread[1]);
        const p = this.place(cx + Math.cos(a) * r, cz + Math.sin(a) * r);
        if (p) { first = first || p; placed++; break; }
      }
    }
    if (placed && this.onSpawn) this.onSpawn(placed, first);
    return placed;
  }

  take(p, who, target) {
    const before = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + target.maxHp * POTION.heal);
    p.on = false;
    p.g.visible = false;
    this.combat.ring(p.x, p.z, 11, 0.6, 0x8dff9a, 0.9);
    if (this.onClaim) this.onClaim(who, p, target.hp - before, target);
  }

  update(dt, t, player, enemies) {
    // The next set is only scheduled once the sea is empty of potions.
    if (this.items.some((p) => p.on)) {
      this.armed = false;
    } else {
      if (!this.armed) {
        this.armed = true;
        this.timer = this.first ? rand(POTION.firstSpawn[0], POTION.firstSpawn[1]) : rand(POTION.respawnDelay[0], POTION.respawnDelay[1]);
        this.first = false;
      }
      this.timer -= dt;
      if (this.timer <= 0) {
        if (this.spawnSet(player.alive ? player : null) > 0) this.armed = false;
        else this.timer = 3; // couldn't find open water this time: try again shortly
      }
    }

    for (const p of this.items) {
      if (!p.on) continue;
      p.age += dt;
      if (p.age > POTION.lifetime) { p.on = false; p.g.visible = false; continue; } // nobody wanted it: it drifts away

      // float on the waves: ride the swell, tilt with the slope, sway gently, pop up when it appears
      const sx = p.x + Math.sin(t * 0.35 + p.ph) * 1.2, sz = p.z + Math.cos(t * 0.3 + p.ph) * 1.2;
      const bob = Math.sin(t * 1.7 + p.ph) * 0.12;
      p.g.position.set(sx, waveHeight(sx, sz, t) - 0.15 + bob, sz);
      const hx = waveHeight(sx + 2.5, sz, t) - waveHeight(sx - 2.5, sz, t);
      const hz = waveHeight(sx, sz + 2.5, t) - waveHeight(sx, sz - 2.5, t);
      p.buoy.rotation.set(Math.atan2(hz, 5) * 1.4 + Math.sin(t * 1.1 + p.ph) * 0.04, 0, -Math.atan2(hx, 5) * 1.4 + Math.cos(t * 0.9 + p.ph) * 0.04);
      p.g.scale.setScalar(Math.max(0.001, easeOutBack(Math.min(1, p.age / 0.9))));
      p.flask.rotation.y += dt * 0.8;
      p.glow.material.opacity = 0.7 + 0.25 * Math.sin(t * 3 + p.ph);
      p.ripple -= dt;
      if (p.ripple <= 0) { p.ripple = 2.4; this.combat.ring(sx, sz, 5.5, 1.5, 0xffffff, 0.3); } // slow ripples spreading on the water
      if (p.age > POTION.lifetime - 6) p.g.visible = Math.floor(t * 6) % 2 === 0; // blinks just before it drifts away

      // you first (only if you are hurt), then the enemy boats (only the hurt ones)
      if (player.alive && player.hp < player.maxHp && Math.hypot(player.state.x - p.x, player.state.z - p.z) < POTION.pickup + player.radius) {
        this.take(p, 'player', player);
        continue;
      }
      for (const e of enemies) {
        if (!e.alive || e.hp >= e.maxHp * POTION.enemyClaimBelow) continue;
        if (Math.hypot(e.state.x - p.x, e.state.z - p.z) < POTION.pickup + e.radius) { this.take(p, e.team, e); break; }
      }
    }
  }
}
