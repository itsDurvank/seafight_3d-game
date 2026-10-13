import * as THREE from 'three';
import { ENEMY_TYPES, WEAPONS, WORLD, DIFFICULTY as D, SWARM, ENEMY_SPEED } from './config.js';
import { Boat } from './boat.js';
import { audio } from './audio.js';
import { resolveCollisions } from './world.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const angleDiff = (a, b) => ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;

const BAR_W = 5;
const BAR_H = 0.55;

// Everything a boat must steer around: the islands and the player's safe harbor.
const OBSTACLES = [
  ...WORLD.islands.map((i) => ({ x: i.x, z: i.z, r: i.r })),
  { x: WORLD.safeHarbor.x, z: WORLD.safeHarbor.z, r: WORLD.safeHarbor.r },
];

// A clear spot of open water (inside the sea, away from islands and the harbor).
function freeSpot(x, z, margin = 28) {
  if (Math.hypot(x, z) > WORLD.radius - 70) return false;
  return OBSTACLES.every((o) => Math.hypot(x - o.x, z - o.z) > o.r + margin);
}

// How hard the swarm is hunting you right now (0..1): rises while you sit still.
export const HUNT = { k: 0 };

let UID = 0;

// The director keeps the sea feeling alive without crowding you: up to SWARM.nearMax boats
// hold a spread-out ring around you (fighting you and each other), the others cruise
// further out, ready to rotate in when someone is sunk or runs away.
export class Director {
  constructor() { this.timer = 0; this.rot = Math.random() * TAU; }

  update(dt, enemies, player) {
    this.rot += dt * SWARM.orbitSpeed;
    HUNT.k += (clamp(((player.idle || 0) - 1.5) / 6, 0, 1) - HUNT.k) * Math.min(1, dt * 1.5);
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 1;
    const px = player.state.x, pz = player.state.z;
    const live = enemies.filter((e) => e.alive && e.mode !== 'retreat');
    for (const e of enemies) if (!live.includes(e)) { e.zone = 'far'; e.station = null; }

    // Only the few boats closest to you may target YOU; every other boat is reserved for fighting other boats.
    const nHunt = SWARM.maxAttackers + Math.round(HUNT.k * SWARM.huntAttackers);
    const pd = (e) => Math.hypot(e.state.x - px, e.state.z - pz) - (e.mayHitPlayer ? 25 : 0); // bonus = no flip-flopping
    const byDist = live.slice().sort((a, b) => pd(a) - pd(b));
    for (const e of enemies) e.mayHitPlayer = false;
    byDist.slice(0, nHunt).forEach((e) => { e.mayHitPlayer = true; });

    // closest boats hold the near zone (boats already there get a bonus so roles do not flicker)
    const score = (e) => Math.hypot(e.state.x - px, e.state.z - pz) - (e.zone === 'near' ? 35 : 0);
    live.sort((a, b) => score(a) - score(b));
    const nNear = Math.min(SWARM.nearMax + Math.round(HUNT.k * SWARM.huntExtra), live.length);
    const groups = [live.slice(0, nNear), live.slice(nNear)];

    groups.forEach((grp, gi) => {
      const near = gi === 0;
      const members = grp.slice().sort((a, b) => a.uid - b.uid);
      members.forEach((e, k) => {
        if (e.zone !== (near ? 'near' : 'far') || e.stationR == null) {
          e.zone = near ? 'near' : 'far';
          const r = near ? SWARM.nearRing[e.big ? 'big' : 'small'] : SWARM.farRing;
          e.stationR = rand(r[0], r[1]);
        }
        // spread evenly around you; the far boats sit halfway between the near ones
        const want = (k / members.length) * TAU + (near ? 0 : Math.PI / Math.max(1, members.length));
        e.slotAng = e.slotAng == null ? want : e.slotAng + angleDiff(e.slotAng, want) * 0.4;
        const ang = this.rot + e.slotAng;
        for (let tries = 0; tries < 8; tries++) {
          const a = ang + (tries % 2 ? 1 : -1) * Math.ceil(tries / 2) * 0.28;
          const R = e.stationR * (1 - tries * 0.04) * (1 - HUNT.k * SWARM.huntClose);
          const x = px + Math.cos(a) * R, z = pz + Math.sin(a) * R;
          if (freeSpot(x, z)) { e.station = { x, z }; break; }
        }
      });
    });
  }
}

// Where a sunk boat comes back: out of sight-ish, near the action, away from the other boats.
function pickRespawn(self, enemies, player) {
  const px = player.state.x, pz = player.state.z;
  let best = null, bestScore = -1;
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * TAU, R = rand(SWARM.respawnRing[0], SWARM.respawnRing[1]);
    const x = px + Math.cos(a) * R, z = pz + Math.sin(a) * R;
    if (!freeSpot(x, z, 34)) continue;
    let md = 1e9;
    for (const o of enemies) if (o !== self && o.alive) md = Math.min(md, Math.hypot(x - o.state.x, z - o.state.z));
    const sc = Math.min(md, 150) + Math.random() * 15; // prefer open water
    if (sc > bestScore) { bestScore = sc; best = { x, z, yaw: Math.atan2(px - x, pz - z) + rand(-0.8, 0.8) }; }
  }
  return best;
}

// One AI boat. Every enemy boat is on its own team, so they fight each other as
// well as you. Rather than sitting on its island it sails out to the middle of the
// sea, where the fighting is, and keeps deciding what to do:
//
//   roam     head for the middle of the sea, looking for a fight
//   attack   fight its chosen target (aggressive, or cautious when it is losing)
//   evade    get out of a tricky spot: outnumbered, cornered, stuck on an island
//   retreat  badly hurt: run home, heal up, come back
//
// On top of that it sidesteps incoming missiles and a boosting player, and weaves
// when bullets are flying at it.
export class EnemyBoat {
  constructor(scene, combat, island, typeKey, hooks = {}) {
    this.uid = UID++;
    this.team = `enemy:${island.id}`;
    this.mayHitPlayer = true; // set by the Director every second
    this.zone = 'far'; // 'near' (holds the fight around you) or 'far' (waits further out)
    this.station = null; // the spot the director wants us to hang around
    this.slotAng = null;
    this.stationR = null;
    this.type = ENEMY_TYPES[typeKey];
    this.island = island;
    this.combat = combat;
    this.hooks = hooks;

    const ty = this.type;
    this.boat = new Boat(scene, { ...ty.style, scale: ty.scale }, this.spawnPoint());
    this.state = this.boat.state;
    this.radius = ty.radius;
    this.big = ty.scale >= 1.2; // cruiser, gunboat and dreadnought are the heavy boats
    this.playerBias = rand(60, 110); // how much this boat prefers going after you over other enemies
    this.hitScale = D.hitbox; // bullets and missiles use a slightly bigger hitbox
    this.maxHp = Math.round(ty.hp * D.hp * (ty.scale >= 1.2 ? D.bigHp : 1)); // big boats carry extra armour
    this.hp = this.maxHp;
    // small boats 100%, big boats 70% of both cruise and boost speed (these are TOP speeds:
    // the actual throttle changes with what the boat is doing, see the speed section in update())
    const sm = this.big ? ENEMY_SPEED.bigMul : 1;
    this.spd = ENEMY_SPEED.cruise * sm;
    this.boostSpd = ENEMY_SPEED.boost * sm;
    this.maxRun = ENEMY_SPEED.cruise * ENEMY_SPEED.run * sm; // fastest it goes without boost, when hunting something quick
    this.wobPh = rand(0, TAU); // each boat drifts its throttle on its own slow rhythm
    this.wobRate = rand(0.25, 0.5);
    this.alive = true;

    // each boat has its own temperament
    // chance to dodge an incoming missile: nimble boats dodge about half the time, heavy ones a bit more
    this.skill = this.big ? rand(0.4, 0.6) * D.dodge : rand(0.35, 0.55) * D.dodge;
    this.nerve = rand(0.85, 1.2); // lower = runs away sooner

    this.missileVsPlayer = { ...WEAPONS.enemyMissile, dmg: WEAPONS.enemyMissile.dmg * D.dmg };
    this.missileVsEnemy = { ...WEAPONS.enemyMissile, dmg: WEAPONS.enemyMissile.dmg * D.dmgVsEnemy };

    this.resetBrain();
    this.respawnTimer = 0;
    this.aggroed = false;

    // floating health bar
    this.bar = new THREE.Group();
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(BAR_W, BAR_H),
      new THREE.MeshBasicMaterial({ color: 0x2b3a4a, transparent: true, opacity: 0.65, depthTest: false, depthWrite: false })
    );
    const fillGeo = new THREE.PlaneGeometry(BAR_W - 0.3, BAR_H - 0.2);
    fillGeo.translate((BAR_W - 0.3) / 2, 0, 0); // grow from the left edge
    this.fill = new THREE.Mesh(fillGeo, new THREE.MeshBasicMaterial({ color: 0x7bf07b, transparent: true, opacity: 1, depthTest: false, depthWrite: false })); // transparent too, otherwise the grey backing is drawn on top of it
    this.fill.position.set(-(BAR_W - 0.3) / 2, 0, 0.01);
    bg.renderOrder = 998;
    this.fill.renderOrder = 999;
    this.bar.add(bg, this.fill);
    this.bar.visible = false;
    scene.add(this.bar);
  }

  resetBrain() {
    const ty = this.type;
    this.mode = 'roam';
    this.stance = 'aggressive'; // or 'cautious' when losing a fight
    this.target = null;
    this.aggressor = null; // team id of whoever hurt us last
    this.aggressorAge = 99;
    this.dir = Math.random() < 0.5 ? 1 : -1; // which way it circles / dodges
    this.dirTimer = rand(2, 4);
    this.thinkTimer = Math.random() * 0.4;
    this.evadeTimer = 0;
    this.fleePt = null;
    this.wp = null;
    this.wpTimer = 0;
    this.noEnemyTimer = 0; // after wandering too far out, ignore other boats for a while and come back
    this.bumpCd = 0;
    this.retreatPt = null; // far-away spot to flee to (null = sail home)
    this.dodging = null; // the missile we are currently side-stepping
    this.dodgeOk = false;
    this.dodgeCd = 0; // can't dodge again until this runs out
    this.dodgeSeen = 0; // how long we have been looking at the current missile
    this.rammerSeen = false;
    this.rammerOk = false;
    this.bEnergy = D.boost.time; // seconds of boost left in the meter
    this.bOn = false;
    this.bIdle = 0; // seconds since the boost was last on (refill starts after a short delay)
    this.bHold = 0; // how long this burst has been going
    this.bCool = rand(2, 6); // pause between offensive bursts so they don't spam it
    this.bWhy = null;
    this.engage = true; // attack pulses: a boat presses you for a while, then backs off to reposition
    this.pulseT = rand(3, 9);
    this.puffT = 0;
    this.crowd = 0;
    this.gunTimer = 0.6 + Math.random();
    this.burstLeft = ty.gun ? ty.gun.burst : 0;
    this.missTimer = 2 + Math.random() * 3;
  }

  spawnPoint() {
    const isl = this.island;
    const a = Math.random() * TAU;
    const R = isl.r + 42;
    return { x: isl.x + Math.cos(a) * R, z: isl.z + Math.sin(a) * R, yaw: a + Math.PI / 2 };
  }

  startBoost(why) {
    this.bOn = true;
    this.bWhy = why;
    this.bHold = 0;
    audio.boost(true, this.state.x, this.state.z);
  }

  stopBoost() {
    if (!this.bOn) return;
    this.bOn = false;
    this.bIdle = 0;
    this.bCool = rand(D.boost.burstGap[0], D.boost.burstGap[1]);
  }

  setMode(m) {
    if (this.mode === m) return;
    this.mode = m;
  }

  takeDamage(n, by = null) {
    if (!this.alive) return;
    this.hp -= n;
    if (by && by !== this.team) { this.aggressor = by; this.aggressorAge = 0; }
    this.thinkTimer = Math.min(this.thinkTimer, 0.08); // react right away
    if (this.hp <= 0) this.die(by);
  }

  die(by) {
    this.alive = false;
    this.boat.group.visible = false;
    this.bar.visible = false;
    const st = this.type.style;
    this.combat.bigExplosion(this.state.x, this.state.z, 0.7 + this.type.scale * 0.55, [st.hull, st.cabin, st.roof, st.accent]);
    this.respawnTimer = D.respawn;
    if (this.hooks.onKilled) this.hooks.onKilled(this, by);
  }

  respawn() {
    const ctx = EnemyBoat.ctx;
    const p = (ctx && pickRespawn(this, ctx.enemies, ctx.player)) || this.spawnPoint();
    this.boat.teleport(p.x, p.z, p.yaw);
    this.hp = this.maxHp;
    this.alive = true;
    this.resetBrain();
    this.boat.group.visible = true;
  }

  // ------------------------------------------------------------------ helpers

  inSafeHarbor(st) {
    const h = WORLD.safeHarbor;
    return Math.hypot(st.x - h.x, st.z - h.z) < h.r;
  }

  // Roam around the spot the director gave us (or anywhere in the arena before it has).
  pickWaypoint() {
    const st = this.station;
    for (let tries = 0; tries < 10; tries++) {
      let x, z;
      if (st) {
        const ang = Math.random() * TAU, r = rand(8, 38);
        x = st.x + Math.cos(ang) * r; z = st.z + Math.sin(ang) * r;
      } else {
        const ar = WORLD.arena, ang = Math.random() * TAU, r = rand(ar.inner, ar.outer);
        x = ar.x + Math.cos(ang) * r; z = ar.z + Math.sin(ang) * r;
      }
      if (freeSpot(x, z)) { this.wp = { x, z }; break; }
    }
    this.wpTimer = rand(3, 6);
  }

  // Badly hurt: sometimes sail home, sometimes bolt for a far corner so you get a chase.
  startRetreat(player, all) {
    this.retreatPt = null;
    if (Math.random() >= SWARM.runawayChance) return;
    const s = this.state;
    let hx = player.state.x, hz = player.state.z, bd = 1e9;
    for (const o of all) {
      if (o === this || !o.alive || o.team === this.team) continue;
      const d = Math.hypot(o.state.x - s.x, o.state.z - s.z);
      if (d < bd) { bd = d; hx = o.state.x; hz = o.state.z; }
    }
    const away = Math.atan2(s.x - hx, s.z - hz);
    for (let k = 0; k < 10; k++) {
      const ang = away + rand(-0.9, 0.9), R = rand(SWARM.runawayDist[0], SWARM.runawayDist[1]);
      const x = s.x + Math.sin(ang) * R, z = s.z + Math.cos(ang) * R;
      if (freeSpot(x, z, 36)) { this.retreatPt = { x, z }; break; }
    }
  }

  // Sidestep a straight-moving threat: head off at 90 degrees to its path,
  // toward the side we are already on.
  sidestep(fx, fz, rx, rz) {
    const lateral = rx * fz - rz * fx;
    const side = Math.abs(lateral) < 0.5 ? this.dir : lateral >= 0 ? 1 : -1;
    return Math.atan2(side * fz, -side * fx);
  }

  // ------------------------------------------------------------------- brain

  // Called a few times a second: look around and decide what to do.
  think(player, all) {
    const s = this.state, ty = this.type;
    const hpR = this.hp / this.maxHp;

    // Fights belong in the middle of the sea: if a chase has dragged us far out, give up on
    // other enemy boats for a few seconds and sail back (we'll still chase the player).
    const a = WORLD.arena;
    if (Math.hypot(s.x, s.z) > WORLD.radius - 80) this.noEnemyTimer = 7;

    let target = null, best = Infinity;
    let near = 0, cx = 0, cz = 0;
    for (const t of all) {
      if (t === this || !t.alive || t.team === this.team) continue;
      if (t.team === 'player' && this.inSafeHarbor(t.state)) continue; // the harbor is off limits
      if (t.team !== 'player' && this.noEnemyTimer > 0) continue;
      const d = Math.hypot(t.state.x - s.x, t.state.z - s.z);
      if (d < 65) { near++; cx += t.state.x; cz += t.state.z; }
      if (d > (t.team === 'player' ? 1.5 : 1) * D.detectMul * (t === this.target ? ty.detect * 1.6 : ty.detect)) continue;
      if (t.team === 'player') {
        // waiting boats leave you alone, and only a few boats may go after you at once
        if (this.zone === 'far' && HUNT.k < 0.5) continue; // waiting boats join in once you have idled a while
        // the director picks which boats may go after you; the rest hunt each other (unless you just shot them)
        if (!this.mayHitPlayer && !(this.aggressor === 'player' && this.aggressorAge < 3)) continue;
      }
      // prefer close, wounded targets; slight bias toward the player; stick with the current
      // target and hit back at whoever just hurt us
      let score = d + (t.hp / t.maxHp) * 45;
      if (t.team === 'player') score -= this.playerBias + (this.zone === 'near' ? 80 : 0); // you are the focus, but not the only thing worth shooting
      if (t === this.target) score -= 22;
      if (t.team === this.aggressor && this.aggressorAge < 6) score -= 30;
      if (score < best) { best = score; target = t; }
    }
    this.target = target;
    this.crowd = near;
    if (this.mode === 'evade' && this.evadeTimer > 0) return; // committed to the escape

    if (this.mode === 'retreat') {
      if (hpR >= D.recoverHp) { this.mode = 'roam'; this.retreatPt = null; } // fall through and decide again
      else return;
    }

    if (hpR < D.retreatHp * this.nerve) {
      if (this.mode !== 'retreat') this.startRetreat(player, all);
      this.mode = 'retreat';
    } else if (near >= 4 || (near >= 3 && hpR < 0.55)) {
      // surrounded: break away from the middle of the crowd
      this.mode = 'evade';
      this.evadeTimer = rand(1.8, 2.8);
      this.fleePt = { x: cx / near, z: cz / near };
    } else if (target) {
      // decide how to fight: pick on the weak, be careful against someone stronger
      const tr = target.hp / target.maxHp;
      if (tr < 0.3 && hpR > 0.5) this.stance = 'finisher';
      else if (hpR < tr - 0.3 && tr > 0.35) this.stance = 'cautious';
      else this.stance = 'aggressive';
      if (target.team === 'player' && HUNT.k > 0.3) this.stance = 'aggressive'; // no hanging back from a sitting duck
      else if (target.team === 'player' && !this.engage) this.stance = 'cautious'; // regrouping: back off for a moment
      this.setMode('attack');
      if (target.team === 'player' && !this.aggroed) {
        this.aggroed = true;
        if (this.hooks.onAggro) this.hooks.onAggro(this);
      }
    } else {
      this.setMode('roam');
    }
  }

  update(dt, t, player, camera, all = []) {
    if (!this.alive) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) this.respawn();
      return;
    }
    const s = this.state, ty = this.type, isl = this.island;
    // slow throttle drift so a boat never holds one constant speed
    const spd = this.spd * (1 + ENEMY_SPEED.wobble * Math.sin(t * this.wobRate + this.wobPh));

    this.aggressorAge += dt;
    this.thinkTimer -= dt;
    this.dirTimer -= dt;
    this.evadeTimer -= dt;
    this.wpTimer -= dt;
    this.bumpCd -= dt;
    this.noEnemyTimer -= dt;
    this.dodgeCd -= dt;
    this.bCool -= dt;
    this.pulseT -= dt;
    if (this.pulseT <= 0) { this.engage = !this.engage; this.pulseT = this.engage ? rand(8, 12) : rand(1.5, 2.5); }
    if (HUNT.k > 0.6) this.engage = true; // no lulls for a sitting duck
    if (this.bOn) {
      this.bEnergy -= dt; this.bHold += dt; this.bIdle = 0;
      if (this.bEnergy <= 0) { this.bEnergy = 0; this.stopBoost(); }
    } else {
      this.bIdle += dt;
      if (this.bIdle >= D.boost.refillDelay) this.bEnergy = Math.min(D.boost.time, this.bEnergy + (D.boost.time / D.boost.refillTime) * dt);
    }
    if (this.mode === 'evade' && this.evadeTimer <= 0) this.thinkTimer = 0;
    if (this.thinkTimer <= 0) { this.think(player, all); this.thinkTimer = rand(0.3, 0.5); }

    const tg = this.target && this.target.alive ? this.target : null;
    const tdx = tg ? tg.state.x - s.x : 0, tdz = tg ? tg.state.z - s.z : 0;
    const tdist = tg ? Math.hypot(tdx, tdz) : 1e9;

    // ----- dangers -----
    const pressure = this.combat.bulletPressure(this);
    const mt = this.combat.missileThreat(this);
    if (mt && mt.m !== this.dodging) {
      // a new missile: maybe we dodge it. After trying, we are out of breath for a while.
      this.dodging = mt.m;
      this.dodgeSeen = 0;
      this.dodgeOk = this.dodgeCd <= 0 && this.bEnergy >= D.boost.min && Math.random() < this.skill; // a dodge is a boosted break-away: no boost left, no dodge
      if (this.dodgeOk) this.dodgeCd = D.dodgeCooldown * (this.big ? 0.65 : 1);
    }
    if (mt) this.dodgeSeen += dt; else this.dodging = null;

    // a boosting player barreling straight at us? get out of the way
    let rammer = null;
    if (player.alive && player.boosting) {
      const rx = s.x - player.state.x, rz = s.z - player.state.z;
      const fx = Math.sin(player.state.yaw), fz = Math.cos(player.state.yaw);
      const along = rx * fx + rz * fz;
      if (along > 0 && along < 60 && Math.abs(rx * fz - rz * fx) < this.radius + 9) rammer = { fx, fz, rx, rz };
    }
    // not every boat panics when you boost at it
    if (rammer) {
      if (!this.rammerSeen) { this.rammerSeen = true; this.rammerOk = Math.random() < D.rammerReact; }
      if (!this.rammerOk) rammer = null;
    } else this.rammerSeen = false;

    // ----- boost: spend the meter in short, purposeful bursts -----
    const hpNow = this.hp / this.maxHp;
    const prefD = this.stance === 'cautious' ? ty.range * 0.9 : this.stance === 'finisher' ? ty.pref * 0.65 : ty.pref;
    const react = this.big ? D.dodgeReact * 0.6 : D.dodgeReact;
    let nearHostile = 1e9, nearPt = null;
    for (const o of all) {
      if (o === this || !o.alive || o.team === this.team) continue;
      const d = Math.hypot(o.state.x - s.x, o.state.z - s.z);
      if (d < nearHostile) { nearHostile = d; nearPt = o.state; }
    }
    let why = null;
    // defence: dash out of a missile's path or a boosting ram, and one panic escape when badly hurt and hunted
    if (mt && this.dodgeOk && this.dodgeSeen > react) why = 'dodge';
    else if (rammer) why = 'dodge';
    else if (hpNow < 0.4 && nearHostile < 150 && (this.mode === 'retreat' || this.mode === 'evade' || pressure >= 1 || this.aggressorAge < 3)) why = 'flee';
    // offence: a short charge when a target is far away, or to run down a wounded one (never spammed)
    else if (this.mode === 'attack' && tg && tdist < 380 && this.bCool <= 0) {
      if (this.stance === 'finisher' && tdist > prefD * 1.5) why = 'finish';
      else if (this.stance === 'aggressive' && tdist > prefD * 2.5 && hpNow > 0.6) why = 'charge';
    }
    if (why && !this.bOn && this.bEnergy >= D.boost.min) {
      this.startBoost(why);
      if (why === 'flee' && this.mode !== 'retreat' && this.mode !== 'evade' && nearPt) {
        // make the burst count: break away from whoever is hurting us
        this.mode = 'evade';
        this.evadeTimer = rand(2, 3);
        this.fleePt = { x: nearPt.x, z: nearPt.z };
      }
    } else if (this.bOn && this.bHold > D.boost.minOn && (!why || ((this.bWhy === 'charge' || this.bWhy === 'finish') && this.bHold > D.boost.offenseMax))) this.stopBoost();

    // flip the way we circle now and then, and more often under fire
    if (this.dirTimer <= 0) {
      this.dir *= -1;
      this.dirTimer = pressure >= 3 ? rand(1.4, 2.4) : rand(2.5, 5);
    }

    // ----- where do I want to go? -----
    let desiredYaw, desiredSpeed, turnBoost = 1;
    if (this.mode === 'attack' && tg) {
      const pref = prefD * (tg.team === 'player' ? 1 - 0.3 * HUNT.k : 1); // the longer you idle, the closer they come
      // Hunters cut corners: from far away aim where the target WILL be (intercept), up close aim straight at it
      let a = Math.atan2(tdx, tdz);
      if (tdist > pref * 1.5) {
        const tsp = Math.max(0, tg.state.speed);
        const lead = clamp(tdist / Math.max(40, s.speed + tsp * 0.5), 0, 2.2) * 0.75;
        a = Math.atan2(tg.state.x + Math.sin(tg.state.yaw) * tsp * lead - s.x, tg.state.z + Math.cos(tg.state.yaw) * tsp * lead - s.z);
      }
      // close in until the preferred range, then circle the target
      let off = this.dir * (Math.PI / 2) * clamp(1 - (tdist - pref) / 40, 0, 1.4);
      if (tdist < pref * 0.7) off += this.dir * 0.7; // too close: spiral outward
      desiredYaw = a + off;
      // Dynamic throttle (fighter pacing): hunt fast from far away (matching, then beating, the target's speed),
      // ease off as we arrive so we do not overshoot, and drop into a slow turn fight while circling.
      const tsp = Math.max(0, tg.state.speed);
      const far = clamp((tdist - pref) / 140, 0, 1);
      const chase = clamp(tsp + 12, spd, this.maxRun); // enough to run a fast target down, never more than maxRun
      const arrive = clamp(tsp * 0.9, spd * ENEMY_SPEED.circle, this.maxRun); // match speed on arrival
      const turnFight = spd * ENEMY_SPEED.circle; // slow circling
      let want = tdist > pref * 1.5 ? arrive + (chase - arrive) * far : turnFight + (arrive - turnFight) * clamp((tdist - pref * 0.7) / (pref * 0.8), 0, 1);
      if (tg.team === 'player' && !this.engage) want = Math.min(want, spd * ENEMY_SPEED.backoff);
      desiredSpeed = want;
    } else if (this.mode === 'evade' && this.fleePt) {
      const away = Math.atan2(s.x - this.fleePt.x, s.z - this.fleePt.z);
      desiredYaw = away + Math.sin(t * 3 + this.dir) * 0.4; // zig-zag while running
      desiredSpeed = spd * 0.95;
    } else if (this.mode === 'retreat') {
      // run for home (or a far-off spot), then loiter there while the hull mends
      const hv = this.retreatPt ? { x: this.retreatPt.x, z: this.retreatPt.z, r: -10 } : isl;
      const ang = Math.atan2(s.z - hv.z, s.x - hv.x);
      const R = hv.r + 40;
      const ta = ang + this.dir * 0.45;
      desiredYaw = Math.atan2(hv.x + Math.cos(ta) * R - s.x, hv.z + Math.sin(ta) * R - s.z);
      const home = Math.hypot(s.x - hv.x, s.z - hv.z) < hv.r + 62;
      desiredSpeed = home ? spd * 0.3 : spd * 0.85; // a runner is always slower than you, so you can chase it down
      if (!home && pressure >= 2) desiredYaw += Math.sin(t * 4) * 0.35;
      if (home) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * D.healRate * dt);
    } else {
      // roam: head for a spot in the middle of the sea
      if (!this.wp || this.wpTimer <= 0 || Math.hypot(this.wp.x - s.x, this.wp.z - s.z) < 22) this.pickWaypoint();
      desiredYaw = this.wp ? Math.atan2(this.wp.x - s.x, this.wp.z - s.z) : s.yaw;
      // a boat that has fallen behind its spot around you speeds up to catch up (a hunter, not a drifter)
      const sd = this.station ? Math.hypot(this.station.x - s.x, this.station.z - s.z) : 0;
      desiredSpeed = Math.max(spd * ENEMY_SPEED.roam, Math.min(this.maxRun, spd * ENEMY_SPEED.roam + (this.maxRun - spd * ENEMY_SPEED.roam) * clamp((sd - 30) / 120, 0, 1)));
    }

    // dodges override everything else
    if (mt && this.dodgeOk && this.dodgeSeen > (this.big ? D.dodgeReact * 0.6 : D.dodgeReact) && mt.dist < D.dodgeRange) {
      const m = mt.m;
      desiredYaw = this.sidestep(Math.sin(m.h), Math.cos(m.h), s.x - m.x, s.z - m.z);
      desiredSpeed = Math.max(desiredSpeed, spd * 0.95);
    } else if (rammer) {
      desiredYaw = this.sidestep(rammer.fx, rammer.fz, rammer.rx, rammer.rz);
      desiredSpeed = Math.max(desiredSpeed, spd * 0.95);
    }

    // boost: heavy boats surge less than light ones (see `boost` in ENEMY_TYPES)
    if (this.bOn) {
      desiredSpeed = Math.max(desiredSpeed, this.boostSpd);
      this.puffT -= dt;
      if (this.puffT <= 0) {
        this.puffT = 0.05;
        const back = 3.2 * ty.scale;
        this.combat.spawnPuff(s.x - Math.sin(s.yaw) * back + (Math.random() - 0.5), s.z - Math.cos(s.yaw) * back + (Math.random() - 0.5));
      }
    }

    // ----- steering: avoid islands, the harbor, other boats and the edge of the sea -----
    let vx = Math.sin(desiredYaw), vz = Math.cos(desiredYaw);
    for (const o of OBSTACLES) {
      const dx = s.x - o.x, dz = s.z - o.z;
      const d = Math.hypot(dx, dz) || 0.001;
      const margin = o.r + this.radius + 14 + Math.max(0, s.speed) * 0.7;
      if (d < margin) {
        const w = (margin - d) / margin;
        const nx = dx / d, nz = dz / d;
        // push out and slide sideways so we go around instead of bouncing back
        vx += (nx * 1.7 - nz * this.dir) * w * 2.6;
        vz += (nz * 1.7 + nx * this.dir) * w * 2.6;
      }
    }
    for (const o of all) {
      if (o === this || !o.alive) continue;
      const dx = s.x - o.state.x, dz = s.z - o.state.z;
      const d = Math.hypot(dx, dz) || 0.001;
      const margin = this.radius + o.radius + (o === tg ? 8 : SWARM.personalSpace);
      if (d < margin) {
        const w = (margin - d) / margin;
        vx += (dx / d) * w * 1.6; vz += (dz / d) * w * 1.6;
      }
    }
    if (this.zone === 'far' && HUNT.k < 0.5 && this.mode !== 'retreat' && player.alive) {
      const dx = s.x - player.state.x, dz = s.z - player.state.z;
      const d = Math.hypot(dx, dz) || 0.001;
      if (d < SWARM.farKeepOut) {
        const w = (SWARM.farKeepOut - d) / SWARM.farKeepOut;
        vx += (dx / d) * w * 1.5; vz += (dz / d) * w * 1.5;
      }
    }
    if (this.mode === 'attack' && tg && tg.team !== 'player') {
      const ar = WORLD.arena;
      const mdx = ar.x - s.x, mdz = ar.z - s.z;
      const md = Math.hypot(mdx, mdz) || 1;
      const lim = WORLD.radius * 0.72; // only drag boats back when a fight strays near the edge of the sea
      if (md > lim) {
        const w = clamp((md - lim) / 150, 0, 1);
        vx += (mdx / md) * w * 1.2; vz += (mdz / md) * w * 1.2;
      }
    }
    const fromMid = Math.hypot(s.x, s.z);
    if (fromMid > WORLD.radius - 55) {
      const w = (fromMid - (WORLD.radius - 55)) / 55;
      vx -= (s.x / fromMid) * w * 2.2; vz -= (s.z / fromMid) * w * 2.2;
    }
    desiredYaw = Math.atan2(vx, vz);

    const diff = angleDiff(s.yaw, desiredYaw);
    const stab = 1 / (1 + Math.max(0, s.speed - 60) / 100); // like the player: fast boats turn wider
    const turn = ty.turn * D.turnMul * turnBoost * stab;
    s.yaw += clamp(diff, -turn * dt, turn * dt);
    s.turnVel = clamp(diff, -turn, turn);
    if (!this.bOn) desiredSpeed *= 1 - D.turnDrag * Math.min(1, Math.abs(diff) / 1.2); // hard turns bleed speed
    s.speed += (desiredSpeed - s.speed) * (1 - Math.exp(-(this.bOn ? 2.2 : 1.5) * dt));
    s.x += Math.sin(s.yaw) * s.speed * dt;
    s.z += Math.cos(s.yaw) * s.speed * dt;

    if (resolveCollisions(s, this.radius, dt) && this.bumpCd <= 0) {
      // jammed against an island or the edge of the sea: back out of it
      this.bumpCd = 2;
      this.dir *= -1;
      if (this.mode !== 'retreat') {
        let pt = null, bd = 1e9;
        if (Math.hypot(s.x, s.z) > WORLD.radius - 4) pt = { x: s.x * 2, z: s.z * 2 };
        else for (const o of OBSTACLES) {
          const d = Math.hypot(s.x - o.x, s.z - o.z);
          if (d < bd) { bd = d; pt = o; }
        }
        this.mode = 'evade';
        this.evadeTimer = 1.5;
        this.fleePt = pt;
      }
    }

    // ----- shooting: decide whether now is a good moment -----
    if (tg && this.mode !== 'roam' && tdist < ty.range) {
      const vsPlayer = tg.team === 'player';
      const holdFire = vsPlayer && !this.engage; // a regrouping boat stops shooting at you for a couple of seconds
      const bspd = WEAPONS.enemyBullet.speed + Math.max(0, s.speed); // shots inherit our speed
      const aimQ = vsPlayer ? D.aim + (1 - D.aim) * 0.8 * HUNT.k : D.aim; // idle targets get led perfectly
      const lead = (tdist / bspd) * aimQ; // aims ahead of a moving target
      const ax = tg.state.x + Math.sin(tg.state.yaw) * tg.state.speed * lead;
      const az = tg.state.z + Math.cos(tg.state.yaw) * tg.state.speed * lead;
      const aim = Math.atan2(ax - s.x, az - s.z);
      const aligned = Math.abs(angleDiff(s.yaw, aim)) < 0.7;
      const bow = 3.2 * ty.scale;
      const bx = s.x + Math.sin(s.yaw) * bow;
      const bz = s.z + Math.cos(s.yaw) * bow;

      if (ty.gun && !holdFire) {
        this.gunTimer -= dt;
        if (aligned && this.gunTimer <= 0) {
          const g = ty.gun;
          const spread = (Math.random() - 0.5) * 2 * g.spread * (vsPlayer ? 1 - 0.5 * HUNT.k : 1);
          const eb = WEAPONS.enemyBullet;
          const dmg = g.dmg * (vsPlayer ? D.dmg * (1 + SWARM.huntDmg * HUNT.k) : D.dmgVsEnemy);
          if (g.twin) {
            for (const k of [-1, 1]) {
              const ox = Math.cos(s.yaw) * k * 0.7 * ty.scale;
              const oz = -Math.sin(s.yaw) * k * 0.7 * ty.scale;
              this.combat.fireBullet(this.team, bx + ox, bz + oz, aim + spread + k * 0.02, bspd, dmg, eb.life);
            }
          } else {
            this.combat.fireBullet(this.team, bx, bz, aim + spread, bspd, dmg, eb.life);
          }
          this.burstLeft--;
          if (this.burstLeft <= 0) { this.burstLeft = g.burst; this.gunTimer = g.pause; }
          else this.gunTimer = g.rate;
        }
      }
      if (ty.missile && !holdFire) {
        this.missTimer -= dt;
        // missiles only when it is a clean shot and we are not busy running for our life
        if (aligned && tdist > 25 && this.missTimer <= 0 && this.mode !== 'evade') {
          const base = vsPlayer ? this.missileVsPlayer : this.missileVsEnemy;
          const cfg = vsPlayer ? { ...base, dmg: base.dmg * (1 + SWARM.huntDmg * HUNT.k) } : base;
          this.combat.fireMissile(this.team, bx, bz, aim, Math.max(cfg.speed, s.speed + 10), cfg, tg);
          this.missTimer = ty.missile.cd * (vsPlayer ? 1 - 0.15 * HUNT.k : 1);
        }
      }
    }

    this.boat.syncModel(dt, t);

    // health bar floats above the boat and always faces the camera
    this.bar.visible = this.hp < this.maxHp || this.mode !== 'roam';
    if (this.bar.visible) {
      const f = clamp(this.hp / this.maxHp, 0, 1);
      this.bar.position.set(s.x, this.boat.group.position.y + 4.5 * ty.scale + 1.5, s.z);
      this.bar.quaternion.copy(camera.quaternion);
      this.fill.scale.x = Math.max(f, 0.001);
      this.fill.material.color.setHSL(0.33 * f, 0.85, 0.55);
    }
  }
}
