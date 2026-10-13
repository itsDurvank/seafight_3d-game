import * as THREE from 'three';
import { ENEMY_TYPES, WEAPONS, WORLD, DIFFICULTY as D, SWARM, ENEMY_SPEED, POTION, AI } from './config.js';
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
// HUNT.n = how many boats are currently going after you (used to keep the whole sea from piling on you).
export const HUNT = { k: 0, n: 0 };

let UID = 0;

const TACTICS = ['circle', 'rush', 'pass', 'flank', 'kite', 'disengage', 'ram'];
const TAC_TIME = {
  circle: [3, 6], rush: [2, 3.5], pass: [3, 5], flank: [3, 4.5], kite: [3.5, 6],
  disengage: [1.3, 2.8], ram: [2, 2.8], turnabout: [1.2, 2.4], counter: [1.8, 3],
};
// chance (x boostLove) that a tactic starts with a boost burst
const TAC_BOOST = { rush: 0.45, flank: 0.35, pass: 0.3, ram: 10, counter: 0.35, kite: 0.2 };

function pickWeighted(entries) { // [[key, weight], ...]
  let sum = 0;
  for (const e of entries) sum += Math.max(0, e[1]);
  if (sum <= 0) return entries[0][0];
  let r = Math.random() * sum;
  for (const [k, w] of entries) { r -= Math.max(0, w); if (r <= 0) return k; }
  return entries[entries.length - 1][0];
}

function boatByTeam(team) {
  const c = EnemyBoat.ctx;
  if (!c) return null;
  return team === 'player' ? c.player : c.enemies.find((e) => e.team === team) || null;
}

// The director no longer parks boats on a ring around you (that pulled them away from each other).
// Each boat picks its own fights; the director only tracks how hard you are being hunted
// and how many boats are currently on you, so the AI can spread out instead of dog-piling.
export class Director {
  constructor() { this.timer = 0; }

  update(dt, enemies, player) {
    HUNT.k += (clamp(((player.idle || 0) - 1.5) / 6, 0, 1) - HUNT.k) * Math.min(1, dt * 1.5);
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.5;
    let n = 0;
    for (const e of enemies) if (e.alive && e.target && e.target.team === 'player') n++;
    HUNT.n = n;
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

// One AI boat. Every enemy boat is on its own team, so they fight each other as well as you, a bit like
// a battle royale: nobody is "assigned" to you, every boat scores all the targets around it and picks a fight.
//
//   roam     sail towards somebody's fight (or wander the arena) looking for a target
//   attack   fight the chosen target using one of several randomly chosen TACTICS (see steerAttack):
//            circle, rush, pass (joust), turnabout, flank, kite (fighting retreat), disengage, ram, counter
//   flee     badly hurt: ONE of home / far / potion / cover (hide behind an island), a "kite" fighting
//            retreat, or a stubborn last stand. Which one is rolled per boat, so retreats differ.
//   evade    short escape when jammed against an island or the edge of the sea
//
// Each boat rolls its own personality on spawn (aggression, nerve, grit, boost habit, grudge...).
// Boosts are planned bursts with a reason (charge, flank, ram, flee, flourish, dodge), never a health threshold.
// Being hit usually means "turn round and hit back" (a jink, then a swing-round), not "run".
export class EnemyBoat {
  constructor(scene, combat, island, typeKey, hooks = {}) {
    this.uid = UID++;
    this.team = `enemy:${island.id}`;
    this.type = ENEMY_TYPES[typeKey];
    this.island = island;
    this.combat = combat;
    this.hooks = hooks;

    const ty = this.type;
    this.boat = new Boat(scene, { ...ty.style, scale: ty.scale }, this.spawnPoint());
    this.state = this.boat.state;
    this.radius = ty.radius;
    this.big = ty.scale >= 1.2; // cruiser, gunboat and dreadnought are the heavy boats
    this.playerBias = rand(0.1, 0.5); // small pull toward the player; distance and opportunity matter more
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
    this.rollPersonality();
    this.mode = 'roam'; // roam | attack | flee | evade
    this.stance = 'aggressive'; // aggressive | cautious | finisher
    this.target = null;
    this.targetLock = 0; // seconds we stick with the current target (unless it dies / we get hit)
    this.aggressor = null; // team id of whoever hurt us last
    this.aggressorAge = 99;
    this.hitEvent = null; // team id of the last attacker, processed by think()
    this.reactCd = 0; // cooldown between "I was hit, what now?" decisions
    this.recentDmg = 0; // recent damage as a fraction of max hp (makes the boat jink harder)
    this.dir = Math.random() < 0.5 ? 1 : -1; // which way it circles / dodges
    this.dirTimer = rand(2, 4);
    this.thinkTimer = Math.random() * 0.4;
    this.jit = {}; // per-target random preference noise, re-rolled every few seconds
    this.jitT = 0;
    this.tac = null; // current combat tactic {name, t, phase, side, ...}
    this.lastTac = null;
    this.nextTac = null; // forced first tactic of the next engagement (e.g. after a flee)
    this.prefJit = rand(0.85, 1.2);
    this.engagedT = 0; // how long we have been in the thick of it
    this.hold = false;
    this.evadeTimer = 0;
    this.fleePt = null;
    this.fleeStyle = null; // home | far | potion | cover
    this.fleeT = 0;
    this.fleeCd = rand(0, 4); // can't start another flee before this runs out
    this.fleeSnapT = 0; // while > 0 a fleeing boat turns round and shoots at its chaser
    this.fleeSnapCd = rand(1, 3);
    this.coverPt = null;
    this.coverT = 0;
    this.coverStay = 0;
    this.lastStandT = 0; // while > 0 the boat refuses to run: it fights on
    this.retreatPt = null;
    this.wp = null;
    this.wpTimer = 0;
    this.noEnemyTimer = 0; // after wandering too far out, ignore other boats for a while and come back
    this.bumpCd = 0;
    this.dodging = null; // the missile we are currently side-stepping
    this.dodgeOk = false;
    this.dodgeCd = 0; // can't dodge again until this runs out
    this.dodgeSeen = 0; // how long we have been looking at the current missile
    this.afterDodge = false;
    this.rammerSeen = false;
    this.rammerOk = false;
    this.bEnergy = D.boost.time; // seconds of boost left in the meter
    this.bOn = false;
    this.bIdle = 0; // seconds since the boost was last on (refill starts after a short delay)
    this.bHold = 0; // how long this burst has been going
    this.bCool = rand(2, 6); // pause between bursts so they don't spam it
    this.bPlan = null; // a planned boost burst {why, delay, dur}: boosts are decided, not triggered by thresholds
    this.bWhy = null;
    this.puffT = 0;
    this.crowd = 0;
    this.gunTimer = 0.6 + Math.random();
    this.burstLeft = ty.gun ? ty.gun.burst : 0;
    this.missTimer = 2 + Math.random() * 3;
  }

  // Every boat (and every respawn of it) gets its own temperament, so no two fights look the same.
  rollPersonality() {
    this.aggr = rand(0.2, 1); // how willingly it presses a fight
    this.fleeHp = rand(AI.fleeHp[0], AI.fleeHp[1]); // health fraction where it starts thinking about running
    this.grit = rand(0.15, 0.7); // chance to fight on to the end instead of running
    this.boostLove = rand(0.3, 1.2) * (this.big ? 0.6 : 1);
    this.grudge = rand(0.3, 1); // how hard it hits back at whoever hurt it
    this.opp = rand(0.3, 1); // how much it likes weak or distracted targets
    this.greed = rand(AI.seekHp[0], AI.seekHp[1]); // goes for a potion below this health
    this.recover = rand(AI.recoverHp[0], AI.recoverHp[1]); // comes back from a retreat above this health
    this.wf = rand(1.6, 3.2); // defensive weave rhythm
    this.wph = rand(0, TAU);
    this.wamp = rand(0.35, 0.7);
    this.pauseMul = rand(AI.gunPause[0], AI.gunPause[1]);
    this.taste = {};
    for (const k of TACTICS) this.taste[k] = rand(0.6, 1.4);
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
    this.bPlan = null;
    this.bIdle = 0;
    this.bCool = rand(D.boost.burstGap[0], D.boost.burstGap[1]);
  }

  planBoost(why, delay, dur) {
    if (this.bPlan || this.bOn || this.bCool > 0 || this.bEnergy < D.boost.min * 1.2) return;
    this.bPlan = { why, delay, dur };
  }

  takeDamage(n, by = null) {
    if (!this.alive) return;
    this.hp -= n;
    this.recentDmg += n / this.maxHp;
    if (by && by !== this.team) { this.aggressor = by; this.aggressorAge = 0; this.hitEvent = by; }
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

  // Roam: half the time head for somebody else's fight (battle-royale convergence), otherwise wander the arena.
  pickWaypoint(player, all) {
    const s = this.state;
    this.wp = null;
    this.wpHunt = false;
    if (Math.random() < AI.roamHunt) {
      const pool = all.filter((o) => o !== this && o.alive && o.team !== this.team && !(o.team === 'player' && this.inSafeHarbor(o.state)));
      if (pool.length) {
        const o = pool[Math.floor(Math.random() * pool.length)];
        for (let k = 0; k < 8; k++) {
          const a = Math.random() * TAU, r = rand(35, 95);
          const x = o.state.x + Math.cos(a) * r, z = o.state.z + Math.sin(a) * r;
          if (freeSpot(x, z)) { this.wp = { x, z }; this.wpHunt = true; break; }
        }
      }
    }
    if (!this.wp) {
      const ar = WORLD.arena;
      for (let tries = 0; tries < 10; tries++) {
        const ang = Math.random() * TAU, r = rand(ar.inner, ar.outer);
        const x = ar.x + Math.cos(ang) * r, z = ar.z + Math.sin(ang) * r;
        if (freeSpot(x, z)) { this.wp = { x, z }; break; }
      }
    }
    this.wpTimer = rand(3, 6);
    void s;
  }

  // Sidestep a straight-moving threat: head off at 90 degrees to its path,
  // toward the side we are already on.
  sidestep(fx, fz, rx, rz) {
    const lateral = rx * fz - rz * fx;
    const side = Math.abs(lateral) < 0.5 ? this.dir : lateral >= 0 ? 1 : -1;
    return Math.atan2(side * fz, -side * fx);
  }

  // ------------------------------------------------------------ target choice

  // Utility scoring instead of "the player is special". Distance dominates, so boats that end up next to
  // each other fight each other; weak or distracted boats are juicy; whoever hurt us is remembered;
  // and only a few boats at a time pile onto you.
  chooseTarget(player, all, hpR) {
    const s = this.state, ty = this.type;
    if (this.jitT <= 0) { this.jit = {}; this.jitT = rand(5, 10); }
    let best = null, bs = -Infinity, near = 0;
    for (const t of all) {
      if (t === this || !t.alive || t.team === this.team) continue;
      const isP = t.team === 'player';
      if (isP && this.inSafeHarbor(t.state)) continue; // the harbor is off limits
      if (!isP && this.noEnemyTimer > 0) continue;
      if (!isP && Math.hypot(t.state.x - player.state.x, t.state.z - player.state.z) > SWARM.fightLeash) continue; // keep the chaos in view
      const d = Math.hypot(t.state.x - s.x, t.state.z - s.z);
      if (d < 65) near++;
      const reach = (isP ? 1.5 : 1) * D.detectMul * (t === this.target ? ty.detect * 1.6 : ty.detect);
      if (d > reach) continue;
      let sc = AI.wProx * (1 - clamp(d / 260, 0, 1)); // close = interesting
      sc += AI.wWeak * (1 - t.hp / t.maxHp) * (0.5 + this.opp); // wounded = tempting
      if (t.target && t.target !== this && t.target.alive) sc += AI.wBusy * this.opp; // busy with someone else = a free hit
      if (t.target === this) sc += AI.wThreat; // it is coming for me
      if (t === this.target) sc += AI.wSticky + (this.targetLock > 0 ? 1.4 : 0);
      if (t.team === this.aggressor && this.aggressorAge < 12) sc += AI.wGrudge * this.grudge * (1 - this.aggressorAge / 12);
      if (isP) {
        sc += this.playerBias + HUNT.k * 1.2;
        const others = HUNT.n - (this.target === t ? 1 : 0);
        sc -= AI.wCrowd * Math.max(0, others - (AI.playerCap + Math.round(HUNT.k * 2))); // don't all pile on one boat
      }
      if (t.maxHp > this.maxHp * 1.5 && hpR < 0.5) sc -= 0.5 * (1 - this.aggr); // timid boats avoid giants when hurt
      const key = t.uid == null ? 'p' : t.uid;
      if (this.jit[key] == null) this.jit[key] = rand(-0.35, 0.35); // so two boats don't always choose alike
      sc += this.jit[key];
      if (sc > bs) { bs = sc; best = t; }
    }
    return { target: best, near };
  }

  // ----------------------------------------------------------- reactions

  // "I was just hit": usually turn around and hit back (with a jink first), sometimes trade blows,
  // sometimes break off and come back from another angle. Running away is a last resort handled elsewhere.
  processHit(foe, hpR) {
    if (!foe || !foe.alive) return;
    if (this.reactCd > 0 || this.mode === 'flee' || this.mode === 'evade') return;
    if (foe.team === 'player' && this.inSafeHarbor(foe.state)) return;
    this.reactCd = rand(2.2, 4);
    if (foe !== this.target && Math.random() < 0.35 + this.grudge * 0.55) {
      this.target = foe;
      this.targetLock = rand(3, 6);
    }
    if (this.target !== foe) return;
    const choice = pickWeighted([
      ['counter', (0.5 + this.aggr * 0.6) * (hpR > 0.45 ? 1.2 : 0.7)],
      ['trade', 0.35],
      ['break', 0.25 + (1 - this.aggr) * 0.3 + (hpR < 0.5 ? 0.2 : 0)],
      ['flank', 0.2 * this.opp],
    ]);
    this.mode = 'attack';
    if (this.lastStandT > 0 || choice === 'trade') { this.stance = 'aggressive'; return; }
    if (choice === 'counter') this.setTactic('counter');
    else if (choice === 'flank') this.setTactic('flank');
    else { this.setTactic('disengage'); this.tac.next = Math.random() < 0.6 ? 'counter' : 'flank'; }
  }

  // Badly hurt: pick ONE of several behaviours at random, weighted by this boat's nerve.
  decideLowHp(player, all, hpR) {
    const s = this.state;
    let hostile = null, hd = 1e9;
    for (const o of all) {
      if (o === this || !o.alive || o.team === this.team) continue;
      const d = Math.hypot(o.state.x - s.x, o.state.z - s.z);
      if (d < hd) { hd = d; hostile = o; }
    }
    const pot = EnemyBoat.potions ? EnemyBoat.potions.nearest(s.x, s.z, POTION.seekRange * 1.3) : null;
    if (hd > 260) { // nobody around: just go and mend
      this.startFlee(pot ? 'potion' : 'home', player, all);
      return;
    }
    const choice = pickWeighted([
      ['lastStand', 0.4 + this.grit * 1.6],
      ['home', 0.7 * (1.2 - this.grit)],
      ['far', 0.3 * (1.2 - this.grit)],
      ['cover', 0.8],
      ['kite', 0.6 + this.aggr * 0.4],
      ['potion', pot ? 1.6 : 0],
    ]);
    if (choice === 'lastStand') {
      this.lastStandT = rand(AI.lastStand[0], AI.lastStand[1]);
      this.fleeHp *= 0.6; // after the stand it may reconsider, but later
      this.fleeCd = this.lastStandT + 3;
      this.stance = 'aggressive';
      if (this.target) this.setTactic(Math.random() < 0.45 ? 'ram' : 'rush');
    } else if (choice === 'kite') { // a fighting retreat: back off and shoot
      this.fleeCd = rand(9, 14);
      if (this.target) { this.mode = 'attack'; this.setTactic('kite'); this.tac.t = rand(5, 9); }
      else this.startFlee('home', player, all);
    } else this.startFlee(choice, player, all);
  }

  startFlee(style, player, all) {
    const s = this.state;
    this.mode = 'flee';
    this.fleeStyle = style;
    this.fleeT = style === 'home' ? 40 : rand(7, 16);
    this.fleeSnapCd = rand(1, 3);
    this.coverPt = null;
    this.coverStay = 0;
    this.retreatPt = null;
    this.tac = null;
    if (style === 'far') {
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
      if (!this.retreatPt) this.fleeStyle = 'home';
    }
    // not every runner panic-boosts, and not at the same moment
    if (Math.random() < 0.3 + 0.35 * this.boostLove) this.planBoost('flee', rand(0.2, 1.8), rand(1, 2.4));
  }

  endFlee() {
    this.mode = 'roam';
    this.fleeStyle = null;
    this.fleeCd = rand(8, 14);
    this.tac = null;
    this.nextTac = Math.random() < 0.5 ? 'flank' : 'rush'; // come back swinging
  }

  // ------------------------------------------------------------------- tactics

  pickTactic(tg, tdist, prefD) {
    const s = this.state;
    const hpR = this.hp / this.maxHp, tr = tg.hp / tg.maxHp;
    const r = tdist / Math.max(1, prefD);
    const fx = Math.sin(tg.state.yaw), fz = Math.cos(tg.state.yaw);
    const facing = tdist > 1 ? ((s.x - tg.state.x) * fx + (s.z - tg.state.z) * fz) / tdist : 0; // 1 = its nose points at us
    const calm = tg.team === 'player' ? 1 - HUNT.k : 1; // no lulls for a sitting duck
    const canBoost = this.bEnergy >= D.boost.min * 1.2 && this.bCool <= 0;
    const cautious = this.stance === 'cautious', finisher = this.stance === 'finisher';
    const w = [
      ['circle', 1.0 * (r < 1.8 ? 1 : 0.35)],
      ['rush', (0.35 + this.aggr) * (r > 1.15 ? 1.3 : 0.25) * (finisher ? 1.8 : 1)],
      ['pass', (0.25 + this.aggr * 0.8) * (r > 0.9 && r < 3.2 ? 1 : 0.3)],
      ['flank', (0.5 + this.opp * 0.5) * (facing > 0.35 ? 1.7 : 0.5) * (r > 0.9 ? 1 : 0.4) * (cautious ? 1.3 : 1)],
      ['kite', (0.15 + (1 - this.aggr) * 0.9 + (cautious ? 0.8 : 0) + (this.crowd >= 3 ? 0.5 : 0)) * (r < 1.6 ? 1 : 0.35) * calm],
      ['disengage', (0.18 + (this.engagedT > 10 ? 0.7 : 0) + (this.crowd >= 4 ? 0.4 : 0) + (1 - this.aggr) * 0.2) * calm],
      ['ram', canBoost && hpR > 0.35 ? 0.3 * this.boostLove * (tg.big || tr < 0.35 ? 1.6 : 0.6) * (r > 1.2 && r < 4 ? 1 : 0.2) : 0],
    ];
    for (const e of w) {
      e[1] *= this.taste[e[0]];
      if (e[0] === this.lastTac) e[1] *= 0.3; // avoid doing the same thing twice in a row
      if (this.lastStandT > 0 && (e[0] === 'kite' || e[0] === 'disengage')) e[1] = 0;
    }
    return pickWeighted(w);
  }

  setTactic(name) {
    this.lastTac = this.tac ? this.tac.name : null;
    const tt = TAC_TIME[name];
    this.tac = { name, t: rand(tt[0], tt[1]), side: Math.random() < 0.5 ? 1 : -1, phase: 'a', pt: rand(0.9, 1.5), age: 0, next: null };
    this.prefJit = rand(0.85, 1.2);
    if (name === 'disengage') this.engagedT = 0;
    if (name === 'counter') this.tac.pt = rand(0.45, 0.95); // length of the evasive jink before swinging round
    const p = TAC_BOOST[name];
    if (p && Math.random() < p * this.boostLove) this.planBoost(name, rand(0.05, 0.8), rand(0.9, 2.2));
  }

  // Steering for the current combat tactic. Returns the heading/speed we want and how hard we may turn.
  steerAttack(dt, tg, tdx, tdz, tdist, pref, spd) {
    const s = this.state, tac = this.tac;
    tac.age += dt;
    const tsp = Math.max(0, tg.state.speed);
    const direct = Math.atan2(tdx, tdz);
    let icpt = direct; // intercept: aim where it WILL be when we are far away
    if (tdist > pref * 1.2) {
      const lead = clamp(tdist / Math.max(40, s.speed + tsp * 0.5), 0, 2.2) * 0.75;
      icpt = Math.atan2(tg.state.x + Math.sin(tg.state.yaw) * tsp * lead - s.x, tg.state.z + Math.cos(tg.state.yaw) * tsp * lead - s.z);
    }
    const far = clamp((tdist - pref) / 140, 0, 1);
    const chase = clamp(tsp + 14, spd, this.maxRun);
    const arrive = clamp(tsp * 0.9, spd * ENEMY_SPEED.circle, this.maxRun);
    const turnFight = spd * ENEMY_SPEED.circle;
    const aimErr = Math.abs(angleDiff(s.yaw, direct));
    const fx = Math.sin(tg.state.yaw), fz = Math.cos(tg.state.yaw); // target heading
    const px = fz * tac.side, pz = -fx * tac.side; // sideways from the target
    const out = { yaw: direct, speed: spd, turn: 1, hold: false };
    const end = (next) => { tac.t = 0; tac.next = next; };
    const afterSwing = () => pickWeighted([['rush', 0.5 + this.aggr], ['circle', 0.8], ['pass', 0.6], ['flank', 0.4 * this.opp]]);

    switch (tac.name) {
      case 'circle': { // classic orbit at our preferred range
        // The guns point out of the BOW, so a boat that circles side-on can never shoot. Instead it flies a
        // nose-in spiral (a turn-fight): a modest offset keeps it orbiting while the guns stay on target.
        let off = this.dir * 0.5 * clamp(1 - (tdist - pref) / 60, 0, 1.2);
        if (tdist < pref * 0.75) off += this.dir * 0.7;
        out.yaw = icpt + off;
        out.speed = tdist > pref * 1.5 ? arrive + (chase - arrive) * far : turnFight + (arrive - turnFight) * clamp((tdist - pref * 0.7) / (pref * 0.8), 0, 1);
        break;
      }
      case 'rush': // straight at it, fast: guns up close
        out.yaw = icpt;
        out.speed = chase;
        if (tdist < pref * 0.5) end(pickWeighted([['circle', 1], ['turnabout', 0.5], ['kite', 0.3 * (1 - this.aggr)], ['disengage', 0.2]]));
        break;
      case 'pass': { // joust: drive past on one side, guns blazing, then swing round
        if (tdist > pref * 0.9) out.yaw = Math.atan2(tg.state.x + px * pref * 0.5 - s.x, tg.state.z + pz * pref * 0.5 - s.z);
        else out.yaw = s.yaw; // carry on through the pass
        out.speed = chase;
        const ahead = Math.sin(s.yaw) * tdx + Math.cos(s.yaw) * tdz;
        if (ahead < 0 && tdist < pref * 1.6) end('turnabout');
        break;
      }
      case 'turnabout': // swing back round to face it
        out.yaw = icpt;
        out.turn = 1.35;
        out.speed = spd * 0.7;
        if (aimErr < 0.3) end(afterSwing());
        break;
      case 'flank': { // arc round to its tail, out of its guns
        const ax = tg.state.x - fx * pref + px * pref * 0.8, az = tg.state.z - fz * pref + pz * pref * 0.8;
        out.yaw = Math.atan2(ax - s.x, az - s.z);
        out.speed = chase;
        const rel = tdist > 1 ? ((s.x - tg.state.x) * fx + (s.z - tg.state.z) * fz) / tdist : 0; // < 0 = behind it
        if (rel < -0.35 || Math.hypot(ax - s.x, az - s.z) < 14) end('rush');
        else if (tdist < pref * 0.5) end('circle');
        break;
      }
      case 'kite': // fighting retreat: fall back zig-zagging, then snap round and shoot
        tac.pt -= dt;
        if (tac.pt <= 0) { tac.phase = tac.phase === 'a' ? 'b' : 'a'; tac.pt = tac.phase === 'a' ? rand(1.0, 2.0) : rand(0.8, 1.3); }
        if (tac.phase === 'a') {
          out.yaw = Math.atan2(-tdx, -tdz) + this.dir * 0.5 * Math.sin(tac.age * 3);
          out.speed = spd * 0.95;
        } else {
          out.yaw = icpt; out.turn = 1.4; out.speed = spd * 0.6;
        }
        if (tdist > pref * 2.3) end(pickWeighted([['rush', 1], ['flank', 0.8], ['circle', 0.5]]));
        break;
      case 'disengage': // break off, reposition (no shooting at the main target for a moment)
        out.yaw = Math.atan2(-tdx, -tdz) + tac.side * 0.9;
        out.speed = spd * 0.9;
        out.hold = true;
        break;
      case 'ram': // boosted charge
        out.yaw = icpt;
        out.speed = this.bOn ? this.boostSpd : chase;
        if (tdist < 9 || (tdist < pref * 0.6 && aimErr > 1.2)) end(pickWeighted([['disengage', 1], ['turnabout', 1]]));
        else if (!this.bOn && !this.bPlan && tac.age > 0.8) end('rush'); // no boost available: just charge
        break;
      case 'counter': // hit back: a quick jink out of the line of fire, then swing round and attack
        if (tac.phase === 'a') {
          out.yaw = direct + tac.side * 1.2;
          out.speed = Math.max(spd, chase * 0.95);
          tac.pt -= dt;
          if (tac.pt <= 0) tac.phase = 'b';
        } else {
          out.yaw = icpt; out.turn = 1.4; out.speed = spd * 0.75;
          if (aimErr < 0.35) end(afterSwing());
        }
        break;
      default:
        out.yaw = icpt;
    }
    return out;
  }

  // Steering while running. Several flavours so retreats do not all look the same, and a runner
  // sometimes turns round to take a shot at whoever is chasing it.
  steerFlee(dt, t, spd, all) {
    const s = this.state, ty = this.type;
    let chaser = null, cd = 1e9;
    for (const o of all) {
      if (o === this || !o.alive || o.team === this.team) continue;
      const d = Math.hypot(o.state.x - s.x, o.state.z - s.z);
      if (d < cd) { cd = d; chaser = o; }
    }
    const out = { yaw: s.yaw, speed: spd * 0.85, turn: 1, snap: false };
    switch (this.fleeStyle) {
      case 'potion': {
        const pot = EnemyBoat.potions ? EnemyBoat.potions.nearest(s.x, s.z, POTION.seekRange * 1.5) : null;
        if (!pot) { this.fleeStyle = 'home'; break; }
        out.yaw = Math.atan2(pot.x - s.x, pot.z - s.z);
        out.speed = spd * 0.95;
        break;
      }
      case 'cover': { // put an island between us and the chaser, wait a moment, then come back
        this.coverT -= dt;
        if (!this.coverPt || this.coverT <= 0) {
          this.coverT = 1.5;
          let bestI = null, bd = 420;
          for (const o of WORLD.islands) { const d = Math.hypot(o.x - s.x, o.z - s.z); if (d < bd) { bd = d; bestI = o; } }
          if (bestI) {
            const dir = chaser ? Math.atan2(bestI.x - chaser.state.x, bestI.z - chaser.state.z) : Math.atan2(bestI.x - s.x, bestI.z - s.z);
            const R = bestI.r + 32;
            this.coverPt = { x: bestI.x + Math.sin(dir) * R, z: bestI.z + Math.cos(dir) * R };
          } else this.fleeStyle = 'home';
        }
        if (this.coverPt) {
          const dc = Math.hypot(this.coverPt.x - s.x, this.coverPt.z - s.z);
          out.yaw = Math.atan2(this.coverPt.x - s.x, this.coverPt.z - s.z);
          if (dc < 30) {
            out.speed = spd * 0.35;
            this.coverStay += dt;
            if (this.coverStay > 2.5) this.fleeT = 0; // peek out and come back
          } else out.speed = spd * 0.95;
        }
        break;
      }
      case 'far': {
        const hv = this.retreatPt;
        out.yaw = Math.atan2(hv.x - s.x, hv.z - s.z);
        out.speed = spd * 0.85;
        if (Math.hypot(hv.x - s.x, hv.z - s.z) < 30) this.fleeT = 0;
        break;
      }
      default: { // home: run for the island, loiter there while the hull mends
        const hv = this.island;
        const ang = Math.atan2(s.z - hv.z, s.x - hv.x);
        const R = hv.r + 40;
        const ta = ang + this.dir * 0.45;
        out.yaw = Math.atan2(hv.x + Math.cos(ta) * R - s.x, hv.z + Math.sin(ta) * R - s.z);
        const home = Math.hypot(s.x - hv.x, s.z - hv.z) < hv.r + 62;
        out.speed = home ? spd * 0.3 : spd * 0.85; // a runner is always slower than you, so you can chase it down
        if (home) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * D.healRate * dt);
      }
    }
    // turn and fire at the chaser now and then
    if (this.fleeSnapT > 0 && chaser) {
      out.yaw = Math.atan2(chaser.state.x - s.x, chaser.state.z - s.z);
      out.turn = 1.4;
      out.speed = Math.min(out.speed, spd * 0.7);
      out.snap = true;
    } else if (chaser && cd < ty.range * 0.9 && this.fleeSnapCd <= 0 && Math.random() < dt * 0.4 * (0.3 + this.aggr)) {
      this.fleeSnapT = rand(0.7, 1.2);
      this.fleeSnapCd = rand(2.5, 5);
      this.target = chaser;
      this.targetLock = 1.5;
    }
    return out;
  }

  // The nearest hostile boat sitting in front of our guns (so passing boats trade shots even when
  // neither has chosen the other as a "target").
  scanFront(all) {
    const s = this.state, ty = this.type;
    let best = null, bd = 1e9;
    for (const o of all) {
      if (o === this || !o.alive || o.team === this.team) continue;
      if (o.team === 'player') {
        if (this.inSafeHarbor(o.state)) continue;
        // snap shots at you obey the same soft cap as targeting: the whole sea does not open up on you at once
        if (this.target !== o && HUNT.n >= AI.playerCap + Math.round(HUNT.k * 2)) continue;
      }
      const dx = o.state.x - s.x, dz = o.state.z - s.z;
      const d = Math.hypot(dx, dz);
      if (d > ty.range * 0.95 || d < 4) continue;
      if (Math.abs(angleDiff(s.yaw, Math.atan2(dx, dz))) < AI.aimConeOpp && d < bd) { bd = d; best = o; }
    }
    return best;
  }

  // ------------------------------------------------------------------- brain

  // Called a few times a second: look around and decide what to do.
  think(player, all) {
    const s = this.state;
    const hpR = this.hp / this.maxHp;

    // Fights belong in the middle of the sea: if a chase has dragged us far out, give up on
    // other enemy boats for a few seconds and sail back (we'll still chase the player).
    if (Math.hypot(s.x, s.z) > WORLD.radius - 80) this.noEnemyTimer = 7;

    const prev = this.target;
    const res = this.chooseTarget(player, all, hpR);
    this.target = res.target;
    this.crowd = res.near;
    if (this.target !== prev) { this.targetLock = rand(AI.lockTime[0], AI.lockTime[1]); this.tac = null; this.engagedT = 0; }

    if (this.hitEvent) {
      const foe = boatByTeam(this.hitEvent);
      this.hitEvent = null;
      this.processHit(foe, hpR);
    }
    if (this.mode === 'evade' && this.evadeTimer > 0) return; // committed to the escape

    if (this.mode === 'flee') {
      const done = hpR >= this.recover + 0.1 || (this.fleeStyle === 'home' ? hpR >= this.recover : this.fleeT <= 0) || this.fleeT <= -20;
      if (!done) return;
      this.endFlee();
    }

    if (this.mode !== 'flee' && this.fleeCd <= 0 && this.lastStandT <= 0 && hpR < this.fleeHp) {
      this.decideLowHp(player, all, hpR);
      if (this.mode === 'flee') return;
    }

    const tg = this.target;
    if (tg) {
      // decide how to fight: pick on the weak, be careful against someone stronger
      const tr = tg.hp / tg.maxHp;
      if (this.lastStandT > 0) this.stance = 'aggressive';
      else if (tr < 0.3 && hpR > 0.5) this.stance = 'finisher';
      else if (hpR < tr - 0.3 && tr > 0.35 && this.aggr < 0.8) this.stance = 'cautious';
      else this.stance = 'aggressive';
      if (tg.team === 'player' && HUNT.k > 0.3) this.stance = 'aggressive'; // no hanging back from a sitting duck
      if (this.mode !== 'attack') { this.mode = 'attack'; this.tac = null; }
      if (tg.team === 'player' && !this.aggroed) {
        this.aggroed = true;
        if (this.hooks.onAggro) this.hooks.onAggro(this);
      }
      // sometimes decide on a boost for no tactical reason except style: a charge from afar, or a flourish
      const s0 = this.state;
      const td = Math.hypot(tg.state.x - s0.x, tg.state.z - s0.z);
      const pref = this.type.pref;
      if (td > pref * 2.6 && td < 380 && Math.random() < 0.3 * this.boostLove) this.planBoost('charge', rand(0, 0.5), rand(1, 2.2));
      else if (Math.random() < 0.03 * this.boostLove) this.planBoost('flair', 0, rand(0.8, 1.6));
    } else if (this.mode !== 'roam') {
      this.mode = 'roam';
      this.tac = null;
    }
  }

  update(dt, t, player, camera, all = []) {
    if (!this.alive) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) this.respawn();
      return;
    }
    const s = this.state, ty = this.type;
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
    this.targetLock -= dt;
    this.jitT -= dt;
    this.reactCd -= dt;
    this.fleeCd -= dt;
    this.fleeT -= dt;
    this.fleeSnapT -= dt;
    this.fleeSnapCd -= dt;
    this.lastStandT -= dt;
    this.recentDmg = Math.max(0, this.recentDmg - dt * 0.12);
    if (this.mode === 'attack') this.engagedT += dt;
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
    if (mt) this.dodgeSeen += dt;
    else if (this.dodging) { this.dodging = null; if (this.dodgeOk) this.afterDodge = true; } // dodged it: now turn on whoever fired

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

    // ----- boost: always a decision (planned burst), never a hp threshold -----
    const react = this.big ? D.dodgeReact * 0.6 : D.dodgeReact;
    const dodgeNow = (mt && this.dodgeOk && this.dodgeSeen > react) || rammer;
    if (dodgeNow && !this.bOn && this.bEnergy >= D.boost.min) {
      this.startBoost('dodge');
      this.bPlan = { why: 'dodge', delay: 0, dur: 1.2 };
    } else if (this.bPlan && !this.bOn) {
      this.bPlan.delay -= dt;
      if (this.bPlan.delay <= 0) {
        if (this.bEnergy >= D.boost.min && this.bCool <= 0) this.startBoost(this.bPlan.why);
        else this.bPlan = null;
      }
    }
    if (this.bOn && this.bHold > (this.bPlan ? this.bPlan.dur : D.boost.minOn)) this.stopBoost();

    // flip the way we circle now and then, and more often under fire
    if (this.dirTimer <= 0) {
      this.dir *= -1;
      this.dirTimer = pressure >= 3 ? rand(1.4, 2.4) : rand(2.5, 5);
    }

    // ----- where do I want to go? -----
    const prefBase = this.stance === 'cautious' ? ty.range * 0.9 : this.stance === 'finisher' ? ty.pref * 0.65 : ty.pref;
    const prefD = prefBase * this.prefJit;
    let desiredYaw, desiredSpeed, turnBoost = 1, hold = false, snap = false;
    let tacName = null;
    if (this.mode === 'attack' && tg) {
      const pref = prefD * (tg.team === 'player' ? 1 - 0.3 * HUNT.k : 1); // the longer you idle, the closer they come
      if (this.afterDodge) { this.afterDodge = false; this.setTactic('turnabout'); }
      if (!this.tac) { const n = this.nextTac || this.pickTactic(tg, tdist, pref); this.nextTac = null; this.setTactic(n); }
      this.tac.t -= dt;
      const o = this.steerAttack(dt, tg, tdx, tdz, tdist, pref, spd);
      desiredYaw = o.yaw; desiredSpeed = o.speed; turnBoost = o.turn; hold = o.hold;
      tacName = this.tac.name;
      if (this.tac.t <= 0) { const nxt = this.tac.next || this.pickTactic(tg, tdist, pref); this.setTactic(nxt); }
    } else if (this.mode === 'evade' && this.fleePt) {
      const away = Math.atan2(s.x - this.fleePt.x, s.z - this.fleePt.z);
      desiredYaw = away + Math.sin(t * 3 + this.dir) * 0.4; // zig-zag while running
      desiredSpeed = spd * 0.95;
    } else if (this.mode === 'flee') {
      const o = this.steerFlee(dt, t, spd, all);
      desiredYaw = o.yaw; desiredSpeed = o.speed; turnBoost = o.turn; snap = o.snap;
      if (!snap && pressure >= 2) desiredYaw += Math.sin(t * 4) * 0.35;
    } else {
      // roam: sail towards the next waypoint (often somebody else's fight)
      if (!this.wp || this.wpTimer <= 0 || Math.hypot(this.wp.x - s.x, this.wp.z - s.z) < 22) this.pickWaypoint(player, all);
      desiredYaw = this.wp ? Math.atan2(this.wp.x - s.x, this.wp.z - s.z) : s.yaw;
      const wd = this.wp ? Math.hypot(this.wp.x - s.x, this.wp.z - s.z) : 0;
      const base = spd * ENEMY_SPEED.roam;
      desiredSpeed = this.wpHunt ? Math.max(base, Math.min(this.maxRun, base + (this.maxRun - base) * clamp((wd - 40) / 160, 0, 1))) : base;
    }

    // hurt boats head for a health potion (it is loot: it pulls fights towards it), unless they are busy breaking away
    const seeking = this.mode !== 'evade' && !(this.mode === 'flee' && this.fleeStyle === 'cover') && this.lastStandT <= 0
      && !(tacName === 'ram' || tacName === 'counter');
    if (seeking && this.hp / this.maxHp < this.greed && EnemyBoat.potions) {
      const pot = EnemyBoat.potions.nearest(s.x, s.z, POTION.seekRange);
      if (pot) {
        desiredYaw = Math.atan2(pot.x - s.x, pot.z - s.z);
        desiredSpeed = Math.max(desiredSpeed, spd * 0.95);
      }
    }

    // dodges override everything else
    if (mt && this.dodgeOk && this.dodgeSeen > react && mt.dist < D.dodgeRange) {
      const m = mt.m;
      desiredYaw = this.sidestep(Math.sin(m.h), Math.cos(m.h), s.x - m.x, s.z - m.z);
      desiredSpeed = Math.max(desiredSpeed, spd * 0.95);
    } else if (rammer) {
      desiredYaw = this.sidestep(rammer.fx, rammer.fz, rammer.rx, rammer.rz);
      desiredSpeed = Math.max(desiredSpeed, spd * 0.95);
    } else if (this.mode === 'attack' || this.mode === 'flee') {
      // Defence while attacking: when someone is lining us up or shooting at us, weave. This is what
      // makes a boat dangerous AND hard to hit instead of just running away.
      let aimedAtMe = false;
      if (tg && tdist < ty.range * 1.3 && tdist > 1) {
        aimedAtMe = ((s.x - tg.state.x) * Math.sin(tg.state.yaw) + (s.z - tg.state.z) * Math.cos(tg.state.yaw)) / tdist > 0.85;
      }
      const defence = clamp(pressure / 3 + (aimedAtMe ? 0.55 : 0) + this.recentDmg * 0.8, 0, 1);
      let amp = this.wamp * defence + 0.06;
      if (tacName === 'turnabout' || (tacName === 'counter' && this.tac.phase === 'b')) amp *= 0.4; // swinging round: keep it accurate
      desiredYaw += Math.sin(t * this.wf + this.wph) * amp;
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
      const margin = this.radius + o.radius + (o === tg ? 6 : SWARM.personalSpace);
      if (d < margin) {
        const w = (margin - d) / margin;
        vx += (dx / d) * w * 1.6; vz += (dz / d) * w * 1.6;
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
    if (this.mode === 'attack' && tg && tg.team !== 'player' && player.alive) {
      const pdx = player.state.x - s.x, pdz = player.state.z - s.z;
      const pd = Math.hypot(pdx, pdz) || 1;
      const lim = SWARM.fightLeash * 1.1;
      if (pd > lim) {
        const w = clamp((pd - lim) / 120, 0, 1);
        vx += (pdx / pd) * w * 1.2; vz += (pdz / pd) * w * 1.2;
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
      if (this.mode !== 'flee') {
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

    // ----- shooting -----
    // Main target when we are fighting it (or turning round on a chaser); otherwise anything
    // that wanders into the front of our guns. Boats passing each other trade shots.
    this.gunTimer -= dt;
    this.missTimer -= dt;
    const canMain = tg && tdist < ty.range && ((this.mode === 'attack' && !hold) || (this.mode === 'flee' && snap));
    let ft = canMain ? tg : null;
    if (!ft && ty.gun) ft = this.scanFront(all);
    if (ft) {
      const vsPlayer = ft.team === 'player';
      const fdx = ft.state.x - s.x, fdz = ft.state.z - s.z;
      const fdist = Math.hypot(fdx, fdz);
      const bspd = WEAPONS.enemyBullet.speed + Math.max(0, s.speed); // shots inherit our speed
      const aimQ = vsPlayer ? D.aim + (1 - D.aim) * 0.8 * HUNT.k : D.aim; // idle targets get led perfectly
      const lead = (fdist / bspd) * aimQ; // aims ahead of a moving target
      const ax = ft.state.x + Math.sin(ft.state.yaw) * ft.state.speed * lead;
      const az = ft.state.z + Math.cos(ft.state.yaw) * ft.state.speed * lead;
      const aim = Math.atan2(ax - s.x, az - s.z);
      const aligned = Math.abs(angleDiff(s.yaw, aim)) < (ft === tg ? AI.aimCone : AI.aimConeOpp);
      const bow = 3.2 * ty.scale;
      const bx = s.x + Math.sin(s.yaw) * bow;
      const bz = s.z + Math.cos(s.yaw) * bow;

      if (ty.gun && fdist < ty.range && aligned && this.gunTimer <= 0) {
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
        if (this.burstLeft <= 0) { this.burstLeft = g.burst; this.gunTimer = g.pause * this.pauseMul; }
        else this.gunTimer = g.rate;
      }
      // missiles only at the main target, on a clean shot, and not while running for our life
      if (ty.missile && ft === tg && canMain && aligned && fdist > 25 && this.missTimer <= 0 && this.mode !== 'evade') {
        const base = vsPlayer ? this.missileVsPlayer : this.missileVsEnemy;
        const cfg = vsPlayer ? { ...base, dmg: base.dmg * (1 + SWARM.huntDmg * HUNT.k) } : base;
        this.combat.fireMissile(this.team, bx, bz, aim, Math.max(cfg.speed, s.speed + 10), cfg, tg);
        this.missTimer = ty.missile.cd * (vsPlayer ? 1 - 0.15 * HUNT.k : 1);
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
