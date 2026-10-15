import * as THREE from 'three';
import { ENEMY_TYPES, WEAPONS, WORLD, DIFFICULTY as D, SWARM, ENEMY_SPEED, POTION, AI } from './config.js';
import { Boat } from './boat.js';
import { audio } from './audio.js';
import { resolveCollisions, getObstacles } from './world.js';
import { Helmsman } from './steering.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const angleDiff = (a, b) => ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;

const BAR_W = 5;
const BAR_H = 0.55;

// A clear spot of open water (inside the sea, away from islands and the harbor).
function freeSpot(x, z, margin = 28) {
  if (Math.hypot(x, z) > WORLD.radius - 70) return false;
  return getObstacles().every((o) => Math.hypot(x - o.x, z - o.z) > o.r + margin);
}

// How hard the swarm is hunting you right now (0..1): rises while you sit still.
// HUNT.n = how many boats are currently going after you (used to keep the whole sea from piling on you).
export const HUNT = { k: 0, n: 0 };

let UID = 0;

const TACTICS = ['circle', 'rush', 'pass', 'flank', 'kite', 'disengage', 'ram', 'intercept', 'tail', 'pincer'];
const TAC_TIME = {
  circle: [2, 3.5], rush: [1.8, 3.0], pass: [2, 3.5], flank: [2, 3.2], kite: [1.5, 2.5],
  disengage: [1.0, 1.8], ram: [1.8, 2.5], turnabout: [1.0, 1.8], counter: [1.4, 2.2],
  intercept: [2.5, 4], tail: [3, 5], pincer: [2.5, 4],
};
// chance (x boostLove) that a tactic starts with a boost burst
const TAC_BOOST = { rush: 0.45, flank: 0.35, pass: 0.3, ram: 10, counter: 0.35, kite: 0.2, intercept: 0.6, pincer: 0.4 };

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
    HUNT.k = 0.6 + clamp(((player.idle || 0) - 1.0) / 4, 0, 0.4);

    let n = 0;
    for (const e of enemies) if (e.alive && e.target && e.target.team === 'player') n++;
    HUNT.n = n;

    this.pulse = (this.pulse ?? 6) - dt;
    if (this.pulse <= 0) {
      this.pulse = rand(7, 12);
      const cap = Math.min(AI.playerCap || 3, 2);
      if (player.alive && HUNT.n < cap) {
        const c = enemies.filter(e => e.alive && e.mode !== 'flee' && e.hp / e.maxHp > 0.5 && e.target !== player);
        c.sort((a, b) => Math.hypot(a.state.x - player.state.x, a.state.z - player.state.z)
                       - Math.hypot(b.state.x - player.state.x, b.state.z - player.state.z));
        if (c[0]) {
          c[0].target = player; c[0].targetLock = rand(7, 10); c[0].mode = 'attack';
          c[0].nextTac = Math.random() < 0.5 ? 'intercept' : 'tail'; c[0].tac = null;
          HUNT.n++;
        }
      }
    }
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.35;
  }
}

// Where a sunk boat comes back: distributed in open water around its home island
function pickRespawn(self, enemies, player) {
  const isl = self.island;
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * TAU, R = isl.r + rand(38, 75);
    const x = isl.x + Math.cos(a) * R, z = isl.z + Math.sin(a) * R;
    if (!freeSpot(x, z, 30)) continue;
    let md = 1e9;
    for (const o of enemies) if (o !== self && o.alive) md = Math.min(md, Math.hypot(x - o.state.x, z - o.state.z));
    if (md > 25) {
      return { x, z, yaw: a + Math.PI / 2 + rand(-0.4, 0.4) };
    }
  }
  return self.spawnPoint();
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
    this.playerBias = rand(0.5, 1.1); // strong pull toward engaging the player
    this.hitScale = D.hitbox; // bullets and missiles use a slightly bigger hitbox
    this.maxHp = Math.round(ty.hp * D.hp * (ty.scale >= 1.2 ? D.bigHp : 1)); // big boats carry extra armour
    this.hp = this.maxHp;
    // small boats 100%, big boats 70% of both cruise and boost speed (these are TOP speeds:
    // the actual throttle changes with what the boat is doing, see the speed section in update())
    this.spd      = ENEMY_SPEED.cruise;
    this.boostSpd = ENEMY_SPEED.boost;
    this.maxRun   = ENEMY_SPEED.cruise * ENEMY_SPEED.run;      // 99
    this.wobPh = rand(0, TAU); // each boat drifts its throttle on its own slow rhythm
    this.wobRate = rand(0.25, 0.5);
    this.alive = true;

    // each boat has its own temperament
    // chance to dodge an incoming missile: nimble boats dodge about half the time, heavy ones a bit more
    this.skill = this.big ? rand(0.4, 0.6) * D.dodge : rand(0.35, 0.55) * D.dodge;

    const missileDmg = this.big ? (WEAPONS.enemyMissile.dmgBig || 58) : (WEAPONS.enemyMissile.dmgSmall || 50);
    this.missileVsPlayer = { ...WEAPONS.enemyMissile, dmg: missileDmg * D.dmg };
    this.missileVsEnemy = { ...WEAPONS.enemyMissile, dmg: missileDmg * D.dmgVsEnemy };

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
    this.islandGlideTimer = 0;
    this.lastStandT = 0; // while > 0 the boat refuses to run: it fights on
    this.retreatPt = null;
    this.wp = null;
    this.wpTimer = 0;
    this.noEnemyTimer = 0; // after wandering too far out, ignore other boats for a while and come back
    this.bumpCd = 0;
    this.bumpScore = 0;
    this.rival = null;
    this.rivalTimer = 0;
    this.dodging = null; // the missile we are currently side-stepping
    this.dodgeOk = false;
    this.dodgeCd = 0; // can't dodge again until this runs out
    this.dodgeSeen = 0; // how long we have been looking at the current missile
    this.afterDodge = false;
    this.fireDodgeCd = rand(1, 3); // cooldown between bullet dodging jinks
    this.fireDodgeTimer = 0; // remaining time of current quick jink
    this.fireDodgeDir = 1; // 1 = right, -1 = left
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
    this.potionTarget = null;
    this.healPulse = 0;
  }

  // Every boat (and every respawn of it) gets its own temperament, so no two fights look the same.
  rollPersonality() {
    this.aggr = rand(0.70, 1.0); // aggressive, willing fighters
    this.fleeHp = rand(AI.fleeHp[0], AI.fleeHp[1]); // only retreats at critically low health (0.10 - 0.22)
    this.grit = rand(0.55, 0.92); // persistent, rarely gives up
    this.boostLove = rand(0.65, 1.30) * (this.big ? 0.8 : 1);
    this.grudge = rand(0.60, 1.0); // fierce retaliation
    this.opp = rand(0.60, 1.0); // aggressive targeting of vulnerable foes
    this.greed = rand(AI.seekHp[0], AI.seekHp[1]); // goes for a potion below this health
    this.recover = rand(AI.recoverHp[0], AI.recoverHp[1]); // comes back from a retreat above this health
    this.wf = rand(1.6, 3.2); // defensive weave rhythm
    this.wph = rand(0, TAU);
    this.wamp = rand(0.30, 0.60);
    this.pauseMul = rand(AI.gunPause[0], AI.gunPause[1]);
    this.sharp = rand(0.8, 1.3); // fondness for steep turns (see steering.js)
    this.mood = Math.random() < 0.80 ? 'aggressive' : 'defensive'; // swings every few seconds, see pickMood()
    this.moodT = rand(AI.mood.time[0], AI.mood.time[1]);
    this.helm = new Helmsman(this.sharp);
    this.taste = {};
    for (const k of TACTICS) this.taste[k] = rand(0.7, 1.3);
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

  onHealed() {
    this.healPulse = 1.2;
    this.bar.visible = true;
    this.fill.material.color.setRGB(0.25, 1.0, 0.45);
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
    return false; // No safe harbor immunity: combat is always live on the water!
  }

  pickRival(all) {
    const foes = all.filter((o) => o !== this && o.alive && o.team !== 'player' && o.team !== this.team);
    if (!foes.length) { this.rival = null; return; }
    foes.sort((a, b) => Math.hypot(a.state.x - this.state.x, a.state.z - this.state.z) - Math.hypot(b.state.x - this.state.x, b.state.z - this.state.z));
    this.rival = foes[Math.floor(Math.random() * Math.min(2, foes.length))];
  }

  // Roam: patrol around home island, duel a rival, or cruise the arena.
  pickWaypoint(player, all) {
    const s = this.state;
    this.wp = null;
    this.wpHunt = false;
    const roll = Math.random();
    if (roll < 0.45) {
      // 45% patrol own island territory
      const isl = this.island;
      const a = Math.random() * TAU, r = isl.r + rand(38, 85);
      const x = isl.x + Math.cos(a) * r, z = isl.z + Math.sin(a) * r;
      if (freeSpot(x, z)) this.wp = { x, z };
    } else if (roll < 0.75) {
      // 30% roam toward rival or another enemy boat
      const pool = all.filter((o) => o !== this && o.alive && o.team !== this.team && o.team !== 'player');
      if (pool.length) {
        const o = (this.rival && this.rival.alive) ? this.rival : pool[Math.floor(Math.random() * pool.length)];
        for (let k = 0; k < 8; k++) {
          const a = Math.random() * TAU, r = rand(30, 75);
          const x = o.state.x + Math.cos(a) * r, z = o.state.z + Math.sin(a) * r;
          if (freeSpot(x, z)) { this.wp = { x, z }; this.wpHunt = true; break; }
        }
      }
    }
    if (!this.wp) {
      // 25% wander open arena
      const ar = WORLD.arena;
      for (let tries = 0; tries < 10; tries++) {
        const ang = Math.random() * TAU, r = rand(ar.inner, ar.outer);
        const x = ar.x + Math.cos(ang) * r, z = ar.z + Math.sin(ang) * r;
        if (freeSpot(x, z)) { this.wp = { x, z }; break; }
      }
    }
    this.wpTimer = rand(3.5, 7);
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

  // Utility scoring: treats player and other ships naturally, engaging player on proximity or retaliation
  chooseTarget(player, all, hpR) {
    const s = this.state, ty = this.type;
    if (this.jitT <= 0) { this.jit = {}; this.jitT = rand(4, 8); }
    let best = null, bs = -Infinity, near = 0;
    for (const t of all) {
      if (t === this || !t.alive || t.team === this.team) continue;
      const isP = t.team === 'player';
      const d = Math.hypot(t.state.x - s.x, t.state.z - s.z);
      if (d < 65) near++;

      // Active combat detection reach:
      // Player: engages actively when player enters local territory (< 135m), or if already targeting (< 220m)
      // Enemies: fight each other across local sectors (< 220m)
      const baseReach = isP ? (t === this.target ? 220 : 135) : Math.min(220, ty.detect * D.detectMul);
      if (d > baseReach) continue;

      let sc = AI.wProx * (1 - clamp(d / 220, 0, 1));

      // Limit player hunters to playerCap (prevents all boats swarming and congesting on player)
      if (isP) {
        sc += this.playerBias;
        const others = HUNT.n - (this.target === t ? 1 : 0);
        if (others >= (AI.playerCap || 3)) {
          sc -= 8.0; // hard penalty: dogfight other enemy boats instead so boats do not dogpile player
        }
        // When player gets close into their territory, attack!
        if (d < 110) sc += 3.0;
      } else {
        sc += 2.6; // strong base motivation to dogfight other enemy boats
        if (t === this.rival) sc += 3.0; // rival dogfight motivation
        const toIsl = Math.hypot(s.x - this.island.x, s.z - this.island.z);
        if (toIsl < this.island.r + 90) sc += 1.8; // defend island
      }

      // Wounded targets
      sc += AI.wWeak * (1 - t.hp / t.maxHp) * (0.6 + this.opp);
      if (t.hp / t.maxHp < 0.35 && d < 90) sc += 2.2 * this.opp;

      // Aggressive focus on whoever is attacking or looking at us
      if (t.target === this) sc += AI.wThreat * 1.4;
      if (t === this.target) sc += AI.wSticky + (this.targetLock > 0 ? 0.8 : 0);

      // Retaliation if hit
      if (t.team === this.aggressor && this.aggressorAge < 10) {
        sc += AI.wGrudge * this.grudge * (1 - this.aggressorAge / 10) * 2.2;
      }

      if (t.maxHp > this.maxHp * 1.5 && hpR < 0.5) sc -= 0.5 * (1 - this.aggr);

      // Small jitter so boats don't all behave identically
      const key = t.uid == null ? 'p' : t.uid;
      if (this.jit[key] == null) this.jit[key] = rand(-0.2, 0.2);
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
      ['lastStand', 0.3 + this.grit * 1.4],
      ['home', 0.6 * (1.2 - this.grit)],
      ['far', 0.25 * (1.2 - this.grit)],
      ['cover', 0.7],
      ['kite', 0.5 + this.aggr * 0.4],
      ['potion', pot ? 3.6 : 0], // eager to grab nearby potions when low on health!
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
    // boost sprint towards potion or safe vector
    if (style === 'potion') {
      if (Math.random() < 0.55 + 0.4 * this.boostLove) this.planBoost('potion', 0, 1.8);
    } else if (Math.random() < 0.3 + 0.35 * this.boostLove) {
      this.planBoost('flee', rand(0.2, 1.8), rand(1, 2.4));
    }
  }

  endFlee() {
    this.mode = 'roam';
    this.fleeStyle = null;
    this.fleeCd = rand(8, 14);
    this.tac = null;
    this.nextTac = Math.random() < 0.5 ? 'flank' : 'rush'; // come back swinging
  }

  // ------------------------------------------------------------------- tactics

  // Aggressive / defensive swings. Aggressive boats charge, joust and ram; defensive ones hang back at range,
  // weave harder, kite and flank. Hurt or battered boats lean defensive, a wounded target makes them pounce.
  pickMood(hpR, tg) {
    const tr = tg ? tg.hp / tg.maxHp : 1;
    let a = 0.5 + this.aggr * 0.4, d = 0.5 + (1 - this.aggr) * 0.4;
    if (hpR < 0.5) d += 0.5;
    if (this.recentDmg > 0.25) d += 0.4;
    if (tr < 0.4 && hpR > 0.4) a += 0.6;
    if (this.lastStandT > 0 || (tg && tg.team === 'player' && HUNT.k > 0.4)) { a += 2; } // never hang back from a sitting duck
    const m = pickWeighted([['aggressive', a], ['defensive', d]]);
    if (m !== this.mood && this.tac) this.tac.t = Math.min(this.tac.t, 0.6); // change of heart: re-pick the tactic soon
    this.mood = m;
    this.moodT = rand(AI.mood.time[0], AI.mood.time[1]);
  }

  pickTactic(tg, tdist, prefD) {
    const s = this.state;
    const hpR = this.hp / this.maxHp, tr = tg.hp / tg.maxHp;
    const r = tdist / Math.max(1, prefD);
    const fx = Math.sin(tg.state.yaw), fz = Math.cos(tg.state.yaw);
    const facing = tdist > 1 ? ((s.x - tg.state.x) * fx + (s.z - tg.state.z) * fz) / tdist : 0; // 1 = its nose points at us
    const calm = tg.team === 'player' ? 1 - HUNT.k : 1; // no lulls for a sitting duck
    const canBoost = this.bEnergy >= D.boost.min * 1.2 && this.bCool <= 0;
    const cautious = this.stance === 'cautious', finisher = this.stance === 'finisher';
    const mates = EnemyBoat.ctx?.enemies ? EnemyBoat.ctx.enemies.some(e => e !== this && e.alive && e.target === tg) : false;
    const w = [
      ['circle', 1.0 * (r < 1.8 ? 1 : 0.35)],
      ['rush', (0.35 + this.aggr) * (r > 1.15 ? 1.3 : 0.25) * (finisher ? 1.8 : 1)],
      ['pass', (0.25 + this.aggr * 0.8) * (r > 0.9 && r < 3.2 ? 1 : 0.3)],
      ['flank', (0.5 + this.opp * 0.5) * (facing > 0.35 ? 1.7 : 0.5) * (r > 0.9 ? 1 : 0.4) * (cautious ? 1.3 : 1)],
      ['kite', (0.15 + (1 - this.aggr) * 0.9 + (cautious ? 0.8 : 0) + (this.crowd >= 3 ? 0.5 : 0)) * (r < 1.6 ? 1 : 0.35) * calm],
      ['disengage', (0.18 + (this.engagedT > 10 ? 0.7 : 0) + (this.crowd >= 4 ? 0.4 : 0) + (1 - this.aggr) * 0.2) * calm],
      ['ram', canBoost && hpR > 0.35 ? 0.3 * this.boostLove * (tg.big || tr < 0.35 ? 1.6 : 0.6) * (r > 1.2 && r < 4 ? 1 : 0.2) : 0],
      ['intercept', r > 2.0 ? 1.8 * (0.5 + this.aggr) : 0],
      ['tail', (facing < -0.2 ? 1.5 : 0.3) * (r < 2.2 ? 1 : 0.4)],
      ['pincer', mates ? 1.6 : 0.3],
    ];
    const mm = this.mood === 'aggressive'
      ? { rush: 1.3, pass: 1.3, ram: 1.3, flank: 1.1, circle: 0.9, kite: 0.6, disengage: 0.6, intercept: 1.3, tail: 1.0, pincer: 1.2 }
      : { rush: 0.5, pass: 0.7, ram: 0.4, flank: 1.1, circle: 1.3, kite: 1.6, disengage: 1.3, intercept: 0.6, tail: 1.1, pincer: 0.8 };
    for (const e of w) {
      e[1] *= this.taste[e[0]] * mm[e[0]];
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
    const gapK  = clamp((tdist - pref) / 120, 0, 1);
    const chase = clamp(tsp + 18 + gapK * 40, spd, this.maxRun);
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
      case 'intercept': {   // cut it off at its predicted position; boost if far
        const T = clamp(tdist / Math.max(60, s.speed + tsp), 0, 3);
        out.yaw = Math.atan2(tg.state.x + fx * tsp * T - s.x, tg.state.z + fz * tsp * T - s.z);
        out.speed = this.bOn ? this.boostSpd : this.maxRun;
        if (tdist < pref * 1.1) end(pickWeighted([['rush', 1], ['circle', 0.6], ['pass', 0.6]]));
        break;
      }
      case 'tail': {        // sit behind its stern, match speed, guns on target
        const bx = tg.state.x - fx * pref * 0.8, bz = tg.state.z - fz * pref * 0.8;
        out.yaw = Math.atan2(bx - s.x, bz - s.z);
        out.speed = clamp(tsp + (tdist - pref * 0.8) * 0.8, spd * 0.6, this.maxRun);
        if (aimErr > 1.6 && tdist < pref * 1.5) end('turnabout');
        break;
      }
      case 'pincer': {      // two boats take opposite sides of the same target
        if (tac.age <= dt * 1.5) {
          const mate = EnemyBoat.ctx?.enemies ? EnemyBoat.ctx.enemies.find(e => e !== this && e.alive && e.target === tg && e.tac) : null;
          if (mate) tac.side = -(mate.tac.side || 1);
        }
        const ax = tg.state.x + fx * tsp * 0.8 + px * pref * 1.2;
        const az = tg.state.z + fz * tsp * 0.8 + pz * pref * 1.2;
        out.yaw = Math.atan2(ax - s.x, az - s.z);
        out.speed = chase;
        if (Math.hypot(ax - s.x, az - s.z) < 18 || tdist < pref * 0.7) end('rush');
        break;
      }
      case 'disengage': // break off, reposition
        out.yaw = Math.atan2(-tdx, -tdz) + tac.side * 0.9;
        out.speed = spd * 0.9;
        out.hold = false;
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
        out.speed = spd * 1.05;
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

  // The nearest hostile boat sitting in front of our guns (snap shots at ANY passing enemy or player)
  scanFront(all) {
    const s = this.state, ty = this.type;
    let best = null, bd = 1e9;
    for (const o of all) {
      if (o === this || !o.alive || o.team === this.team) continue;
      const dx = o.state.x - s.x, dz = o.state.z - s.z;
      const d = Math.hypot(dx, dz);
      if (d > ty.range * 1.1 || d < 3) continue;
      if (Math.abs(angleDiff(s.yaw, Math.atan2(dx, dz))) < AI.aimConeOpp && d < bd) {
        bd = d;
        best = o;
      }
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
    const lockHeld = prev && prev.alive && this.targetLock > 0 && !this.hitEvent && this.lastStandT <= 0;
    let effectiveLock = lockHeld;
    if (effectiveLock && prev.team === 'player') {
      const pdist = Math.hypot(prev.state.x - s.x, prev.state.z - s.z);
      if (pdist > 220 && res.target && res.target.team !== 'player') effectiveLock = false;
    }
    this.target = effectiveLock ? prev : res.target;
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
    this.bumpScore = Math.max(0, this.bumpScore - dt);
    this.noEnemyTimer -= dt;
    this.dodgeCd -= dt;
    this.fireDodgeCd -= dt;
    if (this.fireDodgeTimer > 0) this.fireDodgeTimer -= dt;
    this.bCool -= dt;
    this.targetLock -= dt;
    this.rivalTimer -= dt;
    if (this.rivalTimer <= 0) {
      this.pickRival(all);
      this.rivalTimer = rand(SWARM.rivalTime[0], SWARM.rivalTime[1]);
    }
    this.jitT -= dt;
    this.reactCd -= dt;
    this.fleeCd -= dt;
    this.fleeT -= dt;
    this.fleeSnapT -= dt;
    this.fleeSnapCd -= dt;
    this.lastStandT -= dt;
    this.moodT -= dt;
    if (this.islandGlideTimer > 0) this.islandGlideTimer -= dt;
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
    if (this.moodT <= 0) this.pickMood(this.hp / this.maxHp, this.target && this.target.alive ? this.target : null);
    if (this.thinkTimer <= 0) { this.think(player, all); this.thinkTimer = rand(0.12, 0.22); }

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

    // reactive gunfire dodging & evasive weave: when taking incoming bullet fire
    if (pressure >= 1 && this.mode !== 'evade') {
      if (this.fireDodgeCd <= 0 && this.fireDodgeTimer <= 0) {
        const dodgeRoll = (this.big ? 0.42 : 0.72) * D.dodge;
        if (Math.random() < dodgeRoll) {
          // Check if being pursued from behind
          const chaser = tg || (player.alive ? player : null);
          const isBehind = chaser && Math.abs(angleDiff(s.yaw, Math.atan2(chaser.state.x - s.x, chaser.state.z - s.z))) > 1.9;
          const rollAggro = Math.random();

          if (isBehind && rollAggro < (0.30 + 0.35 * this.aggr) && this.mode === 'attack') {
            // Aggressive Combat Reversal! Snap turn and fight back with guns blazing
            this.setTactic(Math.random() < 0.55 ? 'counter' : 'pass');
            this.fireDodgeCd = rand(2.5, 4.2);
          } else {
            // Evasive Weave: snap jink left/right to throw off bullet streams
            this.fireDodgeTimer = rand(0.42, 0.72);
            this.fireDodgeDir = Math.random() < 0.5 ? 1 : -1;
            this.fireDodgeCd = rand(1.5, 2.6); // rapid, rhythmic evasive jinking
            if (this.bEnergy >= D.boost.min * 1.4 && Math.random() < 0.35 * this.boostLove) {
              this.startBoost('jink');
              this.bPlan = { why: 'jink', delay: 0, dur: 0.8 };
            }
          }
        } else {
          this.fireDodgeCd = rand(1.0, 1.8);
        }
      }
    }

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
    const prefD = Math.min(prefBase * this.prefJit * (this.mood === 'defensive' && this.mode === 'attack' ? AI.mood.defRange : 1), ty.range * 0.9);
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
    const pot = EnemyBoat.potions ? EnemyBoat.potions.nearest(s.x, s.z, POTION.seekRange) : null;
    if (seeking && pot && (this.hp / this.maxHp) < this.greed) {
      this.potionTarget = pot;
      desiredYaw = Math.atan2(pot.x - s.x, pot.z - s.z);
      desiredSpeed = Math.max(desiredSpeed, spd * 1.08); // throttle up to claim potion!
      if (!this.bOn && this.bEnergy >= D.boost.min && this.bCool <= 0 && Math.random() < 0.45 * this.boostLove) {
        this.startBoost('potion');
        this.bPlan = { why: 'potion', delay: 0, dur: 1.6 };
      }
    } else {
      this.potionTarget = null;
    }

    // dodges override everything else
    if (mt && this.dodgeOk && this.dodgeSeen > react && mt.dist < D.dodgeRange) {
      const m = mt.m;
      desiredYaw = this.sidestep(Math.sin(m.h), Math.cos(m.h), s.x - m.x, s.z - m.z);
      desiredSpeed = Math.max(desiredSpeed, spd * 0.95);
    } else if (this.fireDodgeTimer > 0) {
      // dynamic scissors / S-curve jink dodging incoming gunfire
      const jinkWave = Math.sin(t * 7.5) * 0.35;
      desiredYaw = s.yaw + this.fireDodgeDir * (0.85 + jinkWave);
      desiredSpeed = Math.max(desiredSpeed, spd * 0.95);
      turnBoost = 1.25;
    } else if (rammer) {
      desiredYaw = this.sidestep(rammer.fx, rammer.fz, rammer.rx, rammer.rz);
      desiredSpeed = Math.max(desiredSpeed, spd * 0.95);
    } else if (this.mode === 'attack' || this.mode === 'flee') {
      // Defence while attacking: when someone is lining us up or shooting at us, weave.
      let aimedAtMe = false;
      if (tg && tdist < ty.range * 1.3 && tdist > 1) {
        aimedAtMe = ((s.x - tg.state.x) * Math.sin(tg.state.yaw) + (s.z - tg.state.z) * Math.cos(tg.state.yaw)) / tdist > 0.82;
      }
      const defence = clamp(pressure / 2.5 + (aimedAtMe ? 0.65 : 0) + this.recentDmg * 0.9, 0, 1);
      let amp = (this.wamp * defence + 0.08) * (this.mood === 'defensive' ? AI.mood.defWeave : AI.mood.atkWeave);
      if (tacName === 'turnabout' || (tacName === 'counter' && this.tac.phase === 'b')) amp *= 0.3; // swinging round: keep it accurate
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
    let urgent = !!(rammer || (mt && this.dodgeOk && this.dodgeSeen > react && mt.dist < D.dodgeRange) || this.fireDodgeTimer > 0 || this.islandGlideTimer > 0);

    const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw);
    const curSpd = Math.max(0, s.speed);
    const obstacles = getObstacles();

    // 1. Natural Island & Harbor Shore Avoidance
    // Repels outward into open water without forcing an artificial circular orbit trap
    const islandLookAhead = Math.max(45, curSpd * 1.6);
    let islandPush = 0;
    for (const o of obstacles) {
      const toX = o.x - s.x, toZ = o.z - s.z;
      const d = Math.hypot(toX, toZ) || 0.001;
      const safeRadius = o.r + this.radius + 12;

      // Proximity check: active only when nearing shoreline
      const proxZone = safeRadius + 14;
      let proxW = 0;
      if (d < proxZone) {
        proxW = clamp((proxZone - d) / 14, 0, 1);
      }

      // Predictive forward look-ahead along current heading
      let rayW = 0;
      const forwardProj = toX * fx + toZ * fz;
      if (forwardProj > 0 && forwardProj < islandLookAhead + o.r) {
        const perpDist = Math.abs(toX * fz - toZ * fx);
        const corridor = safeRadius + 10;
        if (perpDist < corridor) {
          const fwdFactor = 1 - forwardProj / (islandLookAhead + o.r);
          const latFactor = 1 - perpDist / corridor;
          rayW = clamp(fwdFactor * latFactor, 0, 1);
        }
      }

      const avoidWeight = Math.max(proxW, rayW);
      islandPush = Math.max(islandPush, avoidWeight);
      if (avoidWeight > 0) {
        if (avoidWeight > 0.2) urgent = true;

        // Outward normal pushing away from island into open sea
        const nx = -toX / d, nz = -toZ / d;

        // Gentle tangential deflection to prevent head-on stalls
        const t1x = -nz, t1z = nx;
        const t2x = nz, t2z = -nx;
        let tx = t1x, tz = t1z;
        if (tg) {
          const toTgX = tg.state.x - s.x, toTgZ = tg.state.z - s.z;
          if (t2x * toTgX + t2z * toTgZ > t1x * toTgX + t1z * toTgZ) { tx = t2x; tz = t2z; }
        } else {
          if (t2x * fx + t2z * fz > t1x * fx + t1z * fz) { tx = t2x; tz = t2z; }
        }

        // Throttle control: ease speed when heading into shore so turns are smooth
        if (forwardProj > 0 && avoidWeight > 0.25) {
          const safeTurnSpd = Math.max(36, spd * (0.60 + 0.30 * (1 - avoidWeight)));
          desiredSpeed = Math.min(desiredSpeed, safeTurnSpd);
          if (this.bOn && avoidWeight > 0.35) this.stopBoost();
        }

        // Dominant outward repulsion + subtle deflection (NO centrifuge spin trap)
        const normFactor = 2.6 + proxW * 1.4;
        const tangFactor = 0.7;
        const push = avoidWeight * 2.2;
        vx += (nx * normFactor + tx * tangFactor) * push;
        vz += (nz * normFactor + tz * tangFactor) * push;
      }
    }

    // Separation between boats (avoid crowding / congestions)
    for (const o of all) {
      if (o === this || !o.alive) continue;
      const dx = s.x - o.state.x, dz = s.z - o.state.z;
      const d = Math.hypot(dx, dz) || 0.001;
      const margin = this.radius + o.radius + (o === tg ? (tacName === 'ram' ? 0 : 8) : Math.max(20, SWARM.personalSpace + 6));
      if (d < margin) {
        const w = (margin - d) / margin;
        if (w > 0.35) urgent = true;
        const pushW = w * 2.2;
        vx += (dx / d) * pushW; vz += (dz / d) * pushW;
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

    // 2. Predictive Map Edge Avoidance with Circular Perimeter Banking
    const fromMid = Math.hypot(s.x, s.z) || 1;
    const edgeLookAhead = Math.max(50, curSpd * 1.8);
    const aheadX = s.x + fx * edgeLookAhead;
    const aheadZ = s.z + fz * edgeLookAhead;
    const aheadFromMid = Math.hypot(aheadX, aheadZ);
    const outward = (s.x * fx + s.z * fz) > 0; // heading toward the edge
    const edgeWarnRadius = WORLD.radius - 60;
    const effEdgeDist = Math.max(fromMid, aheadFromMid);

    if (outward && effEdgeDist > edgeWarnRadius) {
      const edgeW = clamp((effEdgeDist - edgeWarnRadius) / 85, 0, 1) * (1 - islandPush);
      if (edgeW > 0.15) urgent = true;

      // Inward radial normal toward center of sea
      const inX = -s.x / fromMid;
      const inZ = -s.z / fromMid;

      // Circular perimeter tangent aligned with forward travel
      let ptx = -inZ, ptz = inX;
      if (ptx * fx + ptz * fz < 0) {
        ptx = -ptx;
        ptz = -ptz;
      }

      const edgePush = edgeW * 4.2;
      vx += (inX * 1.5 + ptx * 2.8) * edgePush;
      vz += (inZ * 1.5 + ptz * 2.8) * edgePush;

      // Maintain high cruising speed while banking along perimeter
      if (edgeW > 0.3) desiredSpeed = Math.max(desiredSpeed, spd * 0.85);
    }

    desiredYaw = Math.atan2(vx, vz);

    const diff = angleDiff(s.yaw, desiredYaw);
    const stab = 1; // remove the speed-based turn penalty
    const maxTurn = ty.turn * D.turnMul * turnBoost * stab;
    const reactive = tacName === 'counter' || tacName === 'turnabout' || this.afterDodge;
    const hs = this.helm.step(dt, s.yaw, desiredYaw, {
      maxTurn, urgent, reactive,
      range: tg ? tdist / Math.max(1, prefD) : 3,
      pressure: clamp(pressure / 3, 0, 1),
      behind: Math.abs(diff) > 1.8,
    });
    s.yaw = hs.yaw;
    s.turnVel = hs.vel;

    // Maintain consistent forward motion & speed: glide smoothly
    const minHeadway = spd * (urgent ? 0.70 : (D.minCombatSpeed || 0.50));
    const dragMul = 1 - (D.turnDrag || 0.16) * Math.min(1, Math.abs(hs.vel) / 1.8);
    desiredSpeed = Math.max(minHeadway, desiredSpeed * dragMul);
    s.speed += (desiredSpeed - s.speed) * (1 - Math.exp(-(this.bOn ? 2.2 : 1.5) * dt));
    s.x += Math.sin(s.yaw) * s.speed * dt;
    s.z += Math.cos(s.yaw) * s.speed * dt;

    // Momentum-preserving surface sliding on contact - NO backward evades or dead stops
    if (resolveCollisions(s, this.radius, dt)) {
      this.islandGlideTimer = 1.0;
      s.speed = Math.max(34, spd * 0.55);
      let nearestObs = null, minD = 1e9;
      for (const o of obstacles) {
        const d = Math.hypot(s.x - o.x, s.z - o.z) - o.r;
        if (d < minD) { minD = d; nearestObs = o; }
      }
      this.bumpScore += 0.5;
      if (this.bumpScore > 2) {
        this.bumpScore = 0;
        const o = nearestObs || { x: 0, z: 0 };
        this.fleePt = { x: o.x, z: o.z }; // 'evade' runs AWAY from fleePt
        this.mode = 'evade'; this.evadeTimer = 2.2; this.stopBoost();
      }
      if (this.bumpCd <= 0) {
        this.bumpCd = 0.35;
        const edgeD = WORLD.radius - Math.hypot(s.x, s.z);
        if (edgeD < minD) {
          const midD = Math.hypot(s.x, s.z) || 1;
          const inX = -s.x / midD, inZ = -s.z / midD;
          let ptx = -inZ, ptz = inX;
          if (ptx * fx + ptz * fz < 0) { ptx = -ptx; ptz = -ptz; }
          s.yaw = Math.atan2(ptx, ptz);
          this.helm.vel = 0;
        } else if (nearestObs) {
          const toX = nearestObs.x - s.x, toZ = nearestObs.z - s.z;
          const d = Math.hypot(toX, toZ) || 1;
          const nx = -toX / d, nz = -toZ / d;
          let tx = -nz, tz = nx;
          if (tx * fx + tz * fz < 0) { tx = -tx; tz = -tz; }
          // Steer diagonally outward and along tangent into open water
          s.yaw = Math.atan2(tx * 1.5 + nx * 1.0, tz * 1.5 + nz * 1.0);
          this.helm.vel = angleDiff(s.yaw, Math.atan2(tx, tz)) * 1.5;
        }
      }
    }

    // ----- shooting -----
    // Main target when we are fighting it (or turning round on a chaser); otherwise anything
    // that wanders into the front of our guns. Boats passing each other trade shots.
    this.gunTimer -= dt;
    this.missTimer -= dt;
    const canMain = tg && tdist < ty.range * 1.15 && (this.mode === 'attack' || (this.mode === 'flee' && snap));
    let ft = canMain ? tg : null;
    if (!ft && ty.gun) ft = this.scanFront(all);
    if (ft) {
      const vsPlayer = ft.team === 'player';
      const fdx = ft.state.x - s.x, fdz = ft.state.z - s.z;
      const fdist = Math.hypot(fdx, fdz);
      const bspd = WEAPONS.enemyBullet.speed + Math.max(0, s.speed); // shots inherit our speed
      const aimQ = vsPlayer ? 0.85 + 0.15 * HUNT.k : 0.80; // sharp, aggressive lead
      const lead = (fdist / bspd) * aimQ; // aims ahead of a moving target
      const ax = ft.state.x + Math.sin(ft.state.yaw) * ft.state.speed * lead;
      const az = ft.state.z + Math.cos(ft.state.yaw) * ft.state.speed * lead;
      const aim = Math.atan2(ax - s.x, az - s.z);
      const aligned = Math.abs(angleDiff(s.yaw, aim)) < (ft === tg ? AI.aimCone : AI.aimConeOpp);
      const bow = 3.2 * ty.scale;
      const bx = s.x + Math.sin(s.yaw) * bow;
      const bz = s.z + Math.cos(s.yaw) * bow;

      if (ty.gun && fdist < ty.range * 1.15 && aligned && this.gunTimer <= 0) {
        const g = ty.gun;
        const spread = (Math.random() - 0.5) * 2 * g.spread * 0.7;
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
      // missiles: fire at main target or any target in front when aligned and off cooldown
      if (ty.missile && ft && aligned && fdist > 14 && fdist < ty.range * 1.15 && this.missTimer <= 0 && this.mode !== 'evade') {
        const base = vsPlayer ? this.missileVsPlayer : this.missileVsEnemy;
        const cfg = vsPlayer ? { ...base, dmg: base.dmg * (1 + SWARM.huntDmg * HUNT.k) } : base;
        this.combat.fireMissile(this.team, bx, bz, aim, Math.max(cfg.speed, s.speed + 10), cfg, ft);
        this.missTimer = ty.missile.cd * (vsPlayer ? 0.85 : 1);
      }
    }

    this.boat.syncModel(dt, t);

    // health bar floats above the boat and always faces the camera
    this.bar.visible = this.hp < this.maxHp || this.mode !== 'roam' || this.healPulse > 0;
    if (this.healPulse > 0) this.healPulse = Math.max(0, this.healPulse - dt * 1.5);
    if (this.bar.visible) {
      const f = clamp(this.hp / this.maxHp, 0, 1);
      this.bar.position.set(s.x, this.boat.group.position.y + 4.5 * ty.scale + 1.5, s.z);
      this.bar.quaternion.copy(camera.quaternion);
      this.fill.scale.x = Math.max(f, 0.001);
      if (this.healPulse > 0) {
        this.fill.material.color.setRGB(0.25, 1.0, 0.45);
      } else {
        this.fill.material.color.setHSL(0.33 * f, 0.85, 0.55);
      }
    }
  }
}
