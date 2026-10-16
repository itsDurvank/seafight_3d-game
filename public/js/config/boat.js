export const BOAT = {
  baseTop: 90, // normal cruising speed
  topCap: 110, // normal top speed: climbs from baseTop to this flat out
  topGain: 6, // top speed gained per second while sailing flat out
  topDecay: 4, // top speed lost per second when you let go of W
  pull: 2.2, // how quickly speed catches up to the top speed
  maxReverse: 30, // reverse speed cap (30 km/h)
  reverseAccel: 14, // gradual acceleration into reverse, like a car
  accel: 9,
  drag: 0.5,
  turnRate: 1.7, // radians per second at full grip
  radius: 2.4, // collision radius
  // Shift boost
  boostTime: 5, // seconds of boost energy (toggle with Shift)
  boostRefillDelay: 2.5, // seconds without boosting before the energy starts refilling
  boostRefillTime: 7, // seconds to refill a completely empty boost meter
  boostMin: 0.6, // minimum energy (seconds) needed to switch the boost on
  boostMul: 1.3, // top speed multiplier while boosting
  boostAdd: 8, // flat extra speed on top of that
  boostPull: 1.6, // how fast speed ramps up into the boost
  boostMax: 150, // absolute speed limit while boosting
  boostRamp: 0.5, // seconds of ease-in at boost start
  boostMinAccel: 25, // units/s^2 floor so the surge never crawls
  brakeMin: 12, // Space slows you down to about this speed
  brakeDecel: 90, // how fast Space slows you (speed units per second)
  brakeTurnMul: 1.35, // steering is much easier while braking
  boostTurnMul: 1.25, // extra steering authority while boosting
  // ramming while boosting (percent of each boat's MAX health)
  boostRamSelfPct: 0.10,
  boostRamEnemyPct: 0.30,
};
