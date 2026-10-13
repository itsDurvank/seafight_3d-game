import { AI } from './config.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const angleDiff = (a, b) => ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;

function pickWeighted(entries) {
  let sum = 0;
  for (const e of entries) sum += Math.max(0, e[1]);
  if (sum <= 0) return entries[0][0];
  let r = Math.random() * sum;
  for (const [k, w] of entries) { r -= Math.max(0, w); if (r <= 0) return k; }
  return entries[entries.length - 1][0];
}

// The helmsman sits between "where the brain wants to point" and "where the boat actually points".
// Before, the boat copied the wanted heading at full turn rate every frame, so any change of mind became
// an instant hard turn and every boat only ever flew steep turns. Now each boat helms in one of three styles,
// picked at random and held for a while:
//
//   cruise   mostly straight: ignores small heading errors and lazily meanders (a long, shallow drift)
//   sweep    a long, wide curve (about the player's own turning circle)
//   snap     the steep, sharp turn. Short, and followed by a cooldown, so a boat can't spin in circles forever
//
// Turn speed also ramps up and down (angular acceleration), so even a snap turn eases in instead of jerking.
// Real danger (island ahead, incoming missile, a boosting player) overrides all of it: `urgent` = full authority.
export class Helmsman {
  constructor(sharp = 1) {
    this.sharp = sharp; // personality: how fond this boat is of steep turns (~0.7..1.3)
    this.vel = 0; // current turn speed, rad/s
    this.style = 'sweep';
    this.t = rand(0.5, 2);
    this.snapT = 0;
    this.snapCd = rand(0, 2);
    this.ph = rand(0, TAU);
    this.rate = rand(0.35, 0.7);
    this.clock = rand(0, 50);
  }

  pick(o) {
    const S = AI.steer;
    const r = clamp(o.range, 0.3, 4); // distance to the target / preferred distance (3 when there is no target)
    const w = [
      ['cruise', (0.25 + 0.75 * clamp(r / 2, 0.2, 1.3)) * (o.behind ? 0.5 : 1) * (1 - 0.4 * o.pressure)],
      ['sweep', 0.9],
      ['snap', this.snapCd > 0 ? 0 : (0.25 + 0.5 * this.sharp) * (r < 1.5 ? 1.6 : 0.5) * (1 + 0.35 * o.pressure) * (o.reactive ? 2.2 : 1)],
    ];
    this.style = pickWeighted(w);
    const cfg = S[this.style];
    this.t = rand(cfg.t[0], cfg.t[1]);
    this.snapT = this.style === 'snap' ? this.t : 0;
  }

  // o: { maxTurn, urgent, range, pressure, reactive, behind }
  step(dt, yaw, desired, o) {
    const S = AI.steer;
    this.clock += dt;
    this.t -= dt;
    this.snapCd -= dt;
    if (this.t <= 0) {
      if (this.style === 'snap') this.snapCd = rand(S.snap.cooldown[0], S.snap.cooldown[1]);
      this.pick(o);
    }
    const style = o.urgent ? 'snap' : this.style;
    const cfg = S[style];
    let want = desired;
    if (style === 'cruise') want += Math.sin(this.clock * this.rate + this.ph) * S.meander; // gentle drift instead of a ruler-straight line
    let diff = angleDiff(yaw, want);
    // dead zone: small errors are ignored, which is what gives long straight runs
    const dz = cfg.dz;
    diff = Math.abs(diff) <= dz ? 0 : diff - Math.sign(diff) * dz;
    const cap = o.maxTurn * cfg.factor;
    const target = clamp(diff * S.gain, -cap, cap);
    const acc = (style === 'snap' ? S.snapAccel : S.accel) * dt;
    this.vel += clamp(target - this.vel, -acc, acc);
    this.vel = clamp(this.vel, -o.maxTurn, o.maxTurn);
    return { yaw: yaw + this.vel * dt, vel: this.vel, style };
  }
}
