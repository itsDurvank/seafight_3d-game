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

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false }));
  glow.scale.set(15, 15, 1);
  glow.position.y = 3;
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.45, 46, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xff4d66, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide })
  );
  beam.position.y = 23;
  g.add(glow, beam);
  g.visible = false;
  return { g, flask, glow };
}

// Health potions appear at random on the sea every 15-30 seconds (one or two at a time).
// You or ANY enemy boat can grab one, but only when hurt, so they pull the fight toward them.
export class Potions {
  constructor(scene, combat) {
    this.combat = combat;
    this.onSpawn = null; // (potion) => void
    this.onClaim = null; // (who, potion, healed) => void
    const tex = glowTexture();
    this.items = [];
    for (let i = 0; i < POTION.maxAlive; i++) {
      const m = makePotion(tex);
      scene.add(m.g);
      this.items.push({ ...m, on: false, x: 0, z: 0, age: 0, ph: 0 });
    }
    this.timer = rand(POTION.firstSpawn[0], POTION.firstSpawn[1]);
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

  spawnOne(player) {
    const free = this.items.find((p) => !p.on);
    if (!free) return;
    for (let tries = 0; tries < 30; tries++) {
      let x, z;
      if (player && Math.random() < POTION.nearPlayerChance) { // half of them show up in the neighbourhood of the fight
        const a = Math.random() * TAU, r = rand(POTION.nearRing[0], POTION.nearRing[1]);
        x = player.state.x + Math.cos(a) * r; z = player.state.z + Math.sin(a) * r;
      } else { // the rest are anywhere on the map
        const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * (WORLD.radius - 90);
        x = Math.cos(a) * r; z = Math.sin(a) * r;
      }
      if (!this.freeSpot(x, z)) continue;
      // keep potions apart from each other
      if (this.items.some((p) => p.on && Math.hypot(p.x - x, p.z - z) < 60)) continue;
      free.on = true; free.x = x; free.z = z; free.age = 0; free.ph = Math.random() * TAU;
      free.g.position.set(x, 0, z);
      free.g.visible = true;
      this.combat.ring(x, z, 16, 0.9, 0xff6b81, 0.9);
      if (this.onSpawn) this.onSpawn(free);
      return;
    }
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
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = rand(POTION.every[0], POTION.every[1]);
      const n = Math.random() < 0.5 ? 1 : 2; // one or two potions at a time
      for (let i = 0; i < n; i++) this.spawnOne(player.alive ? player : null);
    }

    for (const p of this.items) {
      if (!p.on) continue;
      p.age += dt;
      if (p.age > POTION.lifetime) { p.on = false; p.g.visible = false; continue; } // nobody wanted it

      // float on the waves, spin, pulse the glow
      const bob = Math.sin(t * 2 + p.ph) * 0.35;
      p.g.position.y = waveHeight(p.x, p.z, t) + 2.4 + bob;
      p.flask.rotation.y += dt * 1.2;
      p.glow.material.opacity = 0.75 + 0.25 * Math.sin(t * 4 + p.ph);
      if (p.age > POTION.lifetime - 6) p.g.visible = Math.floor(t * 6) % 2 === 0; // blinks just before it vanishes

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
