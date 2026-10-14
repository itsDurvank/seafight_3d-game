import * as THREE from 'three';
import { WORLD, WEAPONS } from './config.js';
import { audio } from './audio.js';

const Y = 1.7; // projectile flight height
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angleDiff = (a, b) => ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
const rand = (a, b) => a + Math.random() * (b - a);

const BULLET_GEO = new THREE.BoxGeometry(0.16, 0.16, 2.4);
const BULLET_MAT = {
  player: new THREE.MeshBasicMaterial({ color: 0xfff07a }),
  enemy: new THREE.MeshBasicMaterial({ color: 0xff6b8a }),
};
const PUFF_GEO = new THREE.SphereGeometry(0.5, 6, 5);
const BLAST_GEO = new THREE.SphereGeometry(1, 10, 8);
const FLAME_GEO = new THREE.SphereGeometry(1, 8, 6);
const SPARK_GEO = new THREE.BoxGeometry(0.22, 0.22, 0.22);
const DEBRIS_GEO = new THREE.BoxGeometry(1, 1, 1);
const RING_GEO = new THREE.RingGeometry(0.82, 1, 40);
RING_GEO.rotateX(-Math.PI / 2);

// fire colour over a puff's life: white-hot -> yellow -> orange -> red -> smoke
const FIRE = [0xfff6c8, 0xffc23d, 0xff7a1f, 0xd23a16, 0x4a3b36].map((c) => new THREE.Color(c));
const _c = new THREE.Color();
function fireColor(f, out) {
  const x = clamp(f, 0, 0.999) * (FIRE.length - 1);
  const i = Math.floor(x);
  return out.copy(FIRE[i]).lerp(FIRE[i + 1], x - i);
}

// Bullets, missiles, smoke trails and explosions. Everything is pooled so no
// objects are created while playing.
//
// `owner` is the firing boat's team id ('player' or e.g. 'enemy:mango'). Every
// enemy boat has its own team, so enemy shots hurt other enemy boats too.
export class Combat {
  constructor(scene) {
    this.scene = scene;
    this.targets = [];
    this.onExplode = null;

    this.bullets = [];
    for (let i = 0; i < 260; i++) {
      const mesh = new THREE.Mesh(BULLET_GEO, BULLET_MAT.player);
      mesh.visible = false;
      scene.add(mesh);
      this.bullets.push({ mesh, on: false, owner: 'player', x: 0, z: 0, vx: 0, vz: 0, life: 0, dmg: 0 });
    }
    this.bi = 0;

    this.missiles = [];
    for (let i = 0; i < 20; i++) this.missiles.push(this.makeMissile());
    this.mi = 0;

    this.puffs = [];
    for (let i = 0; i < 110; i++) {
      const mesh = new THREE.Mesh(PUFF_GEO, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
      mesh.visible = false;
      scene.add(mesh);
      this.puffs.push({ mesh, age: 1, life: 1 });
    }
    this.pi = 0;

    this.blasts = [];
    for (let i = 0; i < 32; i++) {
      const g = new THREE.Group();
      const outer = new THREE.Mesh(BLAST_GEO, new THREE.MeshBasicMaterial({ color: 0xff9a3c, transparent: true, depthWrite: false }));
      const inner = new THREE.Mesh(BLAST_GEO, new THREE.MeshBasicMaterial({ color: 0xfff3a0, transparent: true, depthWrite: false }));
      g.add(outer, inner);
      g.visible = false;
      scene.add(g);
      this.blasts.push({ g, outer, inner, age: 1, life: 1, R: 1 });
    }
    this.bli = 0;

    // ---- big boat-destroyed explosion pieces ----
    this.flames = [];
    for (let i = 0; i < 110; i++) {
      const mesh = new THREE.Mesh(FLAME_GEO, new THREE.MeshBasicMaterial({ color: 0xffc23d, transparent: true, depthWrite: false }));
      mesh.visible = false;
      scene.add(mesh);
      this.flames.push({ mesh, on: false, age: 0, life: 1, size: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, smoky: false });
    }
    this.fi = 0;

    this.sparks = [];
    for (let i = 0; i < 120; i++) {
      const mesh = new THREE.Mesh(SPARK_GEO, new THREE.MeshBasicMaterial({ color: 0xffe27a }));
      mesh.visible = false;
      scene.add(mesh);
      this.sparks.push({ mesh, on: false, age: 0, life: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 });
    }
    this.si = 0;

    this.debris = [];
    for (let i = 0; i < 60; i++) {
      const mesh = new THREE.Mesh(DEBRIS_GEO, new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true }));
      mesh.visible = false;
      scene.add(mesh);
      this.debris.push({ mesh, on: false, age: 0, life: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, sx: 0, sy: 0, sz: 0 });
    }
    this.di = 0;

    this.rings = [];
    for (let i = 0; i < 14; i++) {
      const mesh = new THREE.Mesh(RING_GEO, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
      mesh.visible = false;
      scene.add(mesh);
      this.rings.push({ mesh, on: false, age: 0, life: 1, R: 1, a: 1 });
    }
    this.ri = 0;

    // One light that is always in the scene (intensity 0 when idle) so adding
    // it never forces the materials to recompile in the middle of a fight.
    this.light = new THREE.PointLight(0xffa04a, 0, 110, 2);
    this.light.position.set(0, 6, 0);
    scene.add(this.light);
    this.lightKick = 0;
  }

  makeMissile() {
    const g = new THREE.Group();
    const bodyGeo = new THREE.CylinderGeometry(0.24, 0.24, 2.2, 8);
    bodyGeo.rotateX(Math.PI / 2);
    const body = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true }));
    const noseGeo = new THREE.ConeGeometry(0.24, 0.8, 8);
    noseGeo.rotateX(Math.PI / 2);
    const nose = new THREE.Mesh(noseGeo, new THREE.MeshStandardMaterial({ color: 0xff4d4d, flatShading: true }));
    nose.position.z = 1.5;
    const finMat = new THREE.MeshStandardMaterial({ color: 0x3b4452, flatShading: true });
    const fin = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 0.6), finMat);
    fin.position.z = -0.8;
    const fin2 = fin.clone();
    fin2.rotation.z = Math.PI / 2;
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffb347 }));
    flame.scale.set(1, 1, 2.2);
    flame.position.z = -1.5;
    g.add(body, nose, fin, fin2, flame);
    g.visible = false;
    this.scene.add(g);
    return { g, body, nose, on: false, owner: 'player', target: null, x: 0, z: 0, h: 0, speed: 0, life: 0, age: 0, cfg: null, puff: 0 };
  }

  fireBullet(owner, x, z, angle, speed, dmg, life) {
    audio.gun(x, z, owner === 'player');
    const b = this.bullets[this.bi++ % this.bullets.length];
    b.on = true;
    b.owner = owner;
    b.x = x; b.z = z;
    b.vx = Math.sin(angle) * speed;
    b.vz = Math.cos(angle) * speed;
    b.life = life;
    b.dmg = dmg;
    b.mesh.material = owner === 'player' ? BULLET_MAT.player : BULLET_MAT.enemy;
    b.mesh.rotation.y = angle;
    b.mesh.position.set(x, Y, z);
    b.mesh.visible = true;
  }

  // `target` is the boat a homing missile is locked onto (null = no lock, it just flies straight).
  // The lock only lasts `cfg.track` seconds, like a fighter-jet missile: dodge it or lose it behind an island.
  fireMissile(owner, x, z, heading, startSpeed, cfg, target = null) {
    const m = this.missiles[this.mi++ % this.missiles.length];
    const mine = owner === 'player';
    audio.missile(x, z, mine);
    if (!mine && target && target.team === 'player' && this.onWarn) this.onWarn(); // a missile is coming for you
    m.on = true;
    m.owner = owner;
    m.target = target;
    m.x = x; m.z = z; m.h = heading;
    m.speed = startSpeed;
    m.life = cfg.life;
    m.age = 0;
    m.cfg = cfg;
    m.puff = 0;
    m.body.material.color.set(mine ? 0xffffff : 0x3b4452);
    m.nose.material.color.set(mine ? 0xff4d4d : 0xffa733);
    m.g.position.set(x, Y, z);
    m.g.rotation.y = heading;
    m.g.visible = true;
  }

  // ---------------------------------------------------------------- explosions

  // small burst: bullet impacts, missile hits
  explode(x, z, radius, life = 0.5) {
    if (!this.quiet) audio.blast(x, z, radius);
    const e = this.blasts[this.bli++ % this.blasts.length];
    e.R = radius;
    e.age = 0;
    e.life = life;
    e.g.position.set(x, Y, z);
    e.g.visible = true;
  }

  ring(x, z, R, life, color, a = 0.9) {
    const r = this.rings[this.ri++ % this.rings.length];
    r.on = true; r.age = 0; r.life = life; r.R = R; r.a = a;
    r.mesh.material.color.set(color);
    r.mesh.position.set(x, 0.55, z);
    r.mesh.scale.setScalar(0.1);
    r.mesh.visible = true;
  }

  // The big one: a boat has been destroyed. Fireball, shockwave, sparks,
  // flying wreckage and a column of smoke. `colors` are the boat's own colours
  // so the wreckage looks like the boat that just blew up.
  bigExplosion(x, z, size = 1, colors = [0xffffff]) {
    // white-hot core + glow
    audio.boom(x, z, size);
    this.quiet = true; // the boom above already covers these two bursts
    this.explode(x, z, 5.5 * size, 0.35);
    this.explode(x, z, 9 * size, 0.75);
    this.quiet = false;

    // billowing fireball and smoke
    const nFlames = Math.round(16 + 6 * size);
    for (let i = 0; i < nFlames; i++) {
      const f = this.flames[this.fi++ % this.flames.length];
      const a = Math.random() * TAU, r = Math.random() * 1.6 * size;
      const smoky = i % 3 === 0;
      f.on = true;
      f.smoky = smoky;
      f.age = -Math.random() * 0.22; // staggered start
      f.life = smoky ? rand(1.3, 1.9) : rand(0.7, 1.15);
      f.size = rand(1.3, 2.8) * size * (smoky ? 1.2 : 1);
      f.x = x + Math.cos(a) * r; f.y = 1.1 + Math.random() * 1.2; f.z = z + Math.sin(a) * r;
      const sp = rand(2, 9) * size;
      f.vx = Math.cos(a) * sp; f.vz = Math.sin(a) * sp;
      f.vy = smoky ? rand(3, 6) : rand(4, 11);
      f.mesh.visible = false; // shown once its delay has passed
    }

    // shockwave rings sliding over the water
    this.ring(x, z, 17 * size, 0.8, 0xffffff, 0.85);
    this.ring(x, z, 11 * size, 0.55, 0xffb347, 0.9);

    // sparks
    const nSparks = Math.round(30 + 12 * size);
    for (let i = 0; i < nSparks; i++) {
      const s = this.sparks[this.si++ % this.sparks.length];
      const a = Math.random() * TAU, sp = rand(8, 34) * (0.7 + 0.3 * size);
      s.on = true; s.age = 0; s.life = rand(0.6, 1.3);
      s.x = x; s.y = 1.6; s.z = z;
      s.vx = Math.cos(a) * sp; s.vz = Math.sin(a) * sp; s.vy = rand(6, 22);
      s.mesh.material.color.set(Math.random() < 0.5 ? 0xffe27a : 0xff9a3c);
      s.mesh.visible = true;
    }

    // wreckage tumbling through the air
    const nDebris = Math.round(9 + 4 * size);
    for (let i = 0; i < nDebris; i++) {
      const d = this.debris[this.di++ % this.debris.length];
      const a = Math.random() * TAU, sp = rand(5, 17) * (0.7 + 0.3 * size);
      d.on = true; d.age = 0; d.life = 3;
      d.x = x; d.y = 1.8; d.z = z;
      d.vx = Math.cos(a) * sp; d.vz = Math.sin(a) * sp; d.vy = rand(12, 27);
      d.sx = rand(-9, 9); d.sy = rand(-9, 9); d.sz = rand(-9, 9);
      d.mesh.scale.set(rand(0.4, 1.3) * size, rand(0.25, 0.7) * size, rand(0.4, 1.6) * size);
      d.mesh.material.color.set(colors[i % colors.length]);
      d.mesh.position.set(x, 1.8, z);
      d.mesh.visible = true;
    }

    // orange flash lighting up the water and nearby boats
    this.lightKick = Math.max(this.lightKick, 1);
    this.light.position.set(x, 7, z);

    if (this.onExplode) this.onExplode(x, z, 14 * size);
  }

  spawnPuff(x, z) {
    const p = this.puffs[this.pi++ % this.puffs.length];
    p.age = 0;
    p.life = 0.9;
    p.mesh.position.set(x, Y, z);
    p.mesh.visible = true;
  }

  detonate(m, direct) {
    const cfg = m.cfg;
    this.quiet = true; // the missile-hit sound below replaces the generic blast sound
    this.explode(m.x, m.z, cfg.blast, 0.7);
    this.quiet = false;
    audio.missileHit(m.x, m.z, !!direct);
    for (const t of this.targets) {
      if (t.team === m.owner || !t.alive) continue;
      if (t === direct) { t.takeDamage(cfg.dmg, m.owner); if (m.owner === 'player' && this.onPlayerHit) this.onPlayerHit(t); continue; }
      const d = Math.hypot(t.state.x - m.x, t.state.z - m.z);
      const reach = cfg.blast + t.radius * (t.hitScale || 1);
      if (d < reach) { t.takeDamage(cfg.dmg * 0.6 * (1 - d / reach), m.owner); if (m.owner === 'player' && this.onPlayerHit) this.onPlayerHit(t); }
    }
    if (this.onExplode) this.onExplode(m.x, m.z, cfg.blast);
    m.on = false;
    m.g.visible = false;
  }

  // ------------------------------------------------------- threats (for the AI)

  // A hostile missile that is about to hit `e` (locked missiles only count for their target; unlocked ones only if
  // their line passes through the boat). Returns { m, dist, side } or null.
  missileThreat(e, range = 120) {
    let best = null;
    for (const m of this.missiles) {
      if (!m.on || m.owner === e.team) continue;
      const rx = e.state.x - m.x, rz = e.state.z - m.z;
      const fx = Math.sin(m.h), fz = Math.cos(m.h);
      const along = rx * fx + rz * fz;
      if (along < 0 || along > range) continue;
      const lateral = rx * fz - rz * fx; // which side of the missile's line the boat is on
      if (m.target) { if (m.target !== e) continue; } // locked on: only a threat to its target
      else if (Math.abs(lateral) > e.radius + 5) continue; // lock lost or never had one: only if its line passes through us
      if (!best || along < best.dist) best = { m, dist: along, side: lateral >= 0 ? 1 : -1 };
    }
    return best;
  }

  // How many hostile bullets are currently flying at `e`.
  bulletPressure(e, range = 42) {
    let n = 0;
    for (const b of this.bullets) {
      if (!b.on || b.owner === e.team) continue;
      const rx = e.state.x - b.x, rz = e.state.z - b.z;
      if (Math.abs(rx) > range || Math.abs(rz) > range) continue;
      const sp = Math.hypot(b.vx, b.vz) || 1;
      const along = (rx * b.vx + rz * b.vz) / sp;
      if (along < 0 || along > range) continue;
      const lateral = Math.abs(rx * b.vz - rz * b.vx) / sp;
      if (lateral < e.radius + 3) n++;
    }
    return n;
  }

  // ------------------------------------------------------------------- update

  update(dt, targets, player) {
    this.targets = targets;
    const islands = WORLD.islands;

    // ---- bullets ----
    for (const b of this.bullets) {
      if (!b.on) continue;
      const sp = Math.hypot(b.vx, b.vz);
      const steps = Math.max(1, Math.ceil((sp * dt) / 1.5));
      const sdt = dt / steps;
      let dead = false;
      for (let k = 0; k < steps && !dead; k++) {
        b.x += b.vx * sdt;
        b.z += b.vz * sdt;
        for (const i of islands) {
          const dx = b.x - i.x, dz = b.z - i.z;
          if (dx * dx + dz * dz < i.r * i.r * 0.72) { dead = true; break; }
        }
        if (dead) { this.explode(b.x, b.z, 1.2, 0.2); break; }
        for (const t of targets) {
          if (t.team === b.owner || !t.alive) continue;
          const dx = t.state.x - b.x, dz = t.state.z - b.z;
          const isPlayerBullet = b.owner === 'player' || !String(b.owner).startsWith('enemy:');
          const hr = t.radius * (t.hitScale || 1) + (isPlayerBullet ? WEAPONS.gun.hitPad || 0 : 0);
          if (dx * dx + dz * dz < hr * hr) {
            t.takeDamage(b.dmg, b.owner);
            if (b.owner === 'player' && this.onPlayerHit) this.onPlayerHit(t);
            this.quiet = true;
            this.explode(b.x, b.z, 1.4, 0.22);
            this.quiet = false;
            audio.clank(b.x, b.z); // bullets ping off the hull
            dead = true;
            break;
          }
        }
      }
      b.life -= dt;
      if (b.life <= 0) dead = true;
      if (dead) { b.on = false; b.mesh.visible = false; }
      else b.mesh.position.set(b.x, Y, b.z);
    }

    // ---- missiles ----
    for (const m of this.missiles) {
      if (!m.on) continue;
      const cfg = m.cfg;

      // Locked missiles steer at their target, but only for a short while (cfg.track seconds), and they give up
      // if the target ends up too far off their nose (they can't turn that hard). After that they fly straight on
      // and detonate on whatever they hit: a boat, an island, or nothing when the time runs out.
      m.age += dt;
      if (m.target) {
        if (!m.target.alive || m.age > cfg.track) m.target = null;
        else if (m.age > 0.2) { // brief straight launch before it starts steering
          const want = Math.atan2(m.target.state.x - m.x, m.target.state.z - m.z);
          const diff = angleDiff(m.h, want);
          if (Math.abs(diff) > cfg.loseCone) m.target = null;
          else m.h += clamp(diff, -cfg.turn * dt, cfg.turn * dt);
        }
      }
      m.speed = Math.min(cfg.maxSpeed, m.speed + cfg.accel * dt);

      const steps = Math.max(1, Math.ceil((m.speed * dt) / 1.5));
      const sdt = dt / steps;
      let done = false;
      for (let k = 0; k < steps && !done; k++) {
        m.x += Math.sin(m.h) * m.speed * sdt;
        m.z += Math.cos(m.h) * m.speed * sdt;
        for (const i of islands) {
          const dx = m.x - i.x, dz = m.z - i.z;
          if (dx * dx + dz * dz < i.r * i.r * 0.72) { this.detonate(m, null); done = true; break; }
        }
        if (done) break;
        for (const t of targets) {
          if (t.team === m.owner || !t.alive) continue;
          const dx = t.state.x - m.x, dz = t.state.z - m.z;
          const r = t.radius * (t.hitScale || 1) + 0.6;
          if (dx * dx + dz * dz < r * r) { this.detonate(m, t); done = true; break; }
        }
      }
      if (done) continue;

      m.life -= dt;
      if (m.life <= 0) { this.detonate(m, null); continue; }

      m.g.position.set(m.x, Y, m.z);
      m.g.rotation.y = m.h;
      m.puff -= dt;
      if (m.puff <= 0) {
        m.puff = 0.04;
        this.spawnPuff(m.x - Math.sin(m.h) * 1.8, m.z - Math.cos(m.h) * 1.8);
      }
    }

    // ---- smoke ----
    for (const p of this.puffs) {
      if (p.age >= p.life) { p.mesh.visible = false; continue; }
      p.age += dt;
      const f = Math.min(p.age / p.life, 1);
      p.mesh.scale.setScalar(0.6 + f * 1.4);
      p.mesh.material.opacity = 0.6 * (1 - f);
    }

    // ---- small explosions ----
    for (const e of this.blasts) {
      if (e.age >= e.life) { e.g.visible = false; continue; }
      e.age += dt;
      const f = Math.min(e.age / e.life, 1);
      const grow = 0.25 + 0.75 * (1 - (1 - f) * (1 - f));
      e.outer.scale.setScalar(e.R * grow);
      e.inner.scale.setScalar(e.R * grow * 0.6);
      e.outer.material.opacity = 0.85 * (1 - f);
      e.inner.material.opacity = 1 - f;
    }

    // ---- big explosion: fireball + smoke ----
    for (const f of this.flames) {
      if (!f.on) continue;
      f.age += dt;
      if (f.age < 0) continue; // still waiting for its staggered start
      if (f.age >= f.life) { f.on = false; f.mesh.visible = false; continue; }
      const k = f.age / f.life;
      f.vy *= Math.exp(-(f.smoky ? 0.6 : 1.6) * dt);
      f.vx *= Math.exp(-1.8 * dt); f.vz *= Math.exp(-1.8 * dt);
      f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
      f.mesh.position.set(f.x, f.y, f.z);
      f.mesh.scale.setScalar(f.size * (0.45 + 0.9 * Math.sqrt(k)));
      // smoky puffs go dark sooner; fire puffs burn bright for most of their life
      fireColor(f.smoky ? 0.35 + k * 0.65 : k, _c);
      f.mesh.material.color.copy(_c);
      f.mesh.material.opacity = k < 0.55 ? 0.95 : 0.95 * (1 - (k - 0.55) / 0.45);
      f.mesh.visible = true;
    }

    // ---- sparks ----
    for (const s of this.sparks) {
      if (!s.on) continue;
      s.age += dt;
      if (s.age >= s.life || s.y < 0) { s.on = false; s.mesh.visible = false; continue; }
      s.vy -= 30 * dt;
      s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
      s.mesh.position.set(s.x, s.y, s.z);
      s.mesh.scale.setScalar(1 - s.age / s.life);
    }

    // ---- wreckage ----
    for (const d of this.debris) {
      if (!d.on) continue;
      d.age += dt;
      d.vy -= 26 * dt;
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
      d.mesh.position.set(d.x, d.y, d.z);
      d.mesh.rotation.x += d.sx * dt; d.mesh.rotation.y += d.sy * dt; d.mesh.rotation.z += d.sz * dt;
      if (d.y < 0.2 && d.vy < 0) {
        // splashes into the sea
        d.on = false; d.mesh.visible = false;
        this.spawnPuff(d.x, d.z);
        this.ring(d.x, d.z, 3.5, 0.5, 0xffffff, 0.7);
      } else if (d.age > d.life) {
        d.on = false; d.mesh.visible = false;
      }
    }

    // ---- shockwave rings ----
    for (const r of this.rings) {
      if (!r.on) continue;
      r.age += dt;
      if (r.age >= r.life) { r.on = false; r.mesh.visible = false; continue; }
      const k = r.age / r.life;
      r.mesh.scale.setScalar(Math.max(0.1, r.R * (1 - (1 - k) * (1 - k))));
      r.mesh.material.opacity = r.a * (1 - k);
    }

    // ---- flash light ----
    this.lightKick = Math.max(0, this.lightKick - dt * 2.2);
    this.light.intensity = this.lightKick * this.lightKick * 2600;
  }
}
