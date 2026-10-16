// One enemy boat type per island.
// Stats tuned to be exactly 10% less than the player:
// - HP: average ~90 HP (player: 100 HP)
// - Machine gun: 3.6 DMG per bullet (player: 4.0 DMG)
export const ENEMY_TYPES = {
  skiff: {
    name: 'Mango Skiff', boost: 1.75, hp: 76, speed: 28, turn: 1.7, scale: 0.85, radius: 2.4,
    pref: 28, range: 75, detect: 300,
    gun: { rate: 0.12, burst: 6, pause: 0.65, dmg: 3.6, spread: 0.05 },
    missile: { cd: 7 },
    style: { hull: 0xffa62b, accent: 0xffffff, cabin: 0xffe0a3, roof: 0xff7a1a, flag: 0xffffff, look: 'sail' },
  },
  cruiser: {
    name: 'Coral Cruiser', boost: 1.3, hp: 110, speed: 18, turn: 1.7, scale: 1.5, radius: 3.6,
    pref: 44, range: 85, detect: 300,
    gun: { rate: 0.14, burst: 6, pause: 0.6, dmg: 4.0, spread: 0.05 },
    missile: { cd: 5.5 },
    style: { hull: 0xff7aa8, accent: 0xfff0f5, cabin: 0xffc2d6, roof: 0xe84a82, flag: 0xffffff, look: 'pod' },
  },
  raider: {
    name: 'Violet Raider', boost: 1.7, hp: 84, speed: 32, turn: 1.7, scale: 1.0, radius: 2.6,
    pref: 32, range: 78, detect: 300,
    gun: { rate: 0.12, burst: 6, pause: 0.6, dmg: 3.6, spread: 0.05 },
    missile: { cd: 6 },
    style: { hull: 0x8e6bff, accent: 0x39e6ff, cabin: 0xd9ccff, roof: 0x5b3fd1, flag: 0x39e6ff, look: 'raider' },
  },
  gunboat: {
    name: 'Jade Gunboat', boost: 1.45, hp: 110, speed: 22, turn: 1.7, scale: 1.25, radius: 3.1,
    pref: 38, range: 82, detect: 300,
    gun: { rate: 0.14, burst: 6, pause: 0.6, dmg: 2.4, spread: 0.05, twin: true },
    missile: { cd: 5.5 },
    style: { hull: 0x1fb36b, accent: 0xfff3b0, cabin: 0xc8f5dc, roof: 0x0b7d49, flag: 0xfff3b0, look: 'twin' },
  },
  dread: {
    name: 'Sunset Dreadnought', boost: 1.25, hp: 110, speed: 18, turn: 1.7, scale: 1.8, radius: 4.2,
    pref: 48, range: 90, detect: 300,
    gun: { rate: 0.12, burst: 8, pause: 0.6, dmg: 4.0, spread: 0.05 },
    missile: { cd: 5.5 },
    style: { hull: 0xff6b4a, accent: 0xffd166, cabin: 0xffc9a8, roof: 0xb23a24, flag: 0xffd166, look: 'dread' },
  },
};

// Enemy speed: exactly 10% below the player across all boats
export const ENEMY_SPEED = {
  cruise: 81,
  run: 1.222,
  boost: 135,
  bigMul: 1.0,
  roam: 0.95,
  circle: 0.8,
  backoff: 0.85,
  wobble: 0.03,
};

// Enemy brain tuning: high aggression, tight coordination
export const AI = {
  fleeHp: [0.10, 0.22], // fight hard until very low
  seekHp: [0.55, 0.80],
  recoverHp: [0.50, 0.75],
  lastStand: [6, 12],
  lockTime: [4, 8],
  roamHunt: 0.95, // almost always sails towards active fights
  aimCone: 1.35, // generous firing cone so guns stay active
  aimConeOpp: 1.15, // wide firing cone for passing shots
  gunPause: [0.35, 0.65], // rapid burst recovery
  wProx: 3.0, wWeak: 1.4, wBusy: 0.85, wThreat: 1.3, wSticky: 0.5, wGrudge: 2.0,
  wCrowd: 0.5, playerCap: 3,
  steer: {
    gain: 2.1,
    accel: 2.4,
    snapAccel: 3.4,
    meander: 0.16,
    cruise: { factor: 0.7, dz: 0.18, t: [1.6, 3.2] },
    sweep: { factor: 0.95, dz: 0.06, t: [1.8, 3.8] },
    snap: { factor: 1.0, dz: 0.02, t: [0.5, 0.9], cooldown: [2.0, 4.0] },
  },
  mood: { time: [3.0, 6.0], defRange: 1.10, defWeave: 1.35, atkWeave: 0.75 },
};

// Swarm coordination: natural distribution across islands
export const SWARM = {
  nearMax: 8,
  nearRing: { small: [35, 70], big: [45, 85] },
  farRing: [70, 150], // relaxed outer ring so boats distribute naturally
  farKeepOut: 40,
  maxAttackers: 2,
  fightLeash: 180, // duels have room to breathe across islands
  rivalBonus: 65,
  rivalTime: [5, 10],
  huntAttackers: 1,
  huntExtra: 1,
  huntClose: 0.35,
  huntDmg: 0.15,
  idleSpeed: 21,
  personalSpace: 16, // healthy personal space between boats
  orbitSpeed: 0.08,
  respawnRing: [60, 110], // respawn at natural distance
  runawayChance: 0.06,
  runawayDist: [70, 140], // retreats have room to run towards edges/islands
};

// Enemy tuning: 10% less than player
export const DIFFICULTY = {
  hp: 1.0, // uses scaled HP directly
  bigHp: 1.0,
  speed: 1.0,
  dmg: 1.0,
  dmgVsEnemy: 1.0,
  aim: 0.80, // sharp, accurate tracking
  hitbox: 1.15,
  dodge: 0.82,
  detectMul: 1.5, // wide detection reach
  dodgeReact: 0.28,
  dodgeCooldown: 4.5,
  rammerReact: 0.65,
  // Enemy boost: 7.2s meter
  boost: { time: 7.2, min: 1.0, minOn: 0.6, offenseMax: 2.5, burstGap: [3.5, 6.5], refillDelay: 2.0, refillTime: 6.0 },
  turnMul: 0.9,
  turnDrag: 0.10,
  minCombatSpeed: 0.6,
  dodgeRange: 110,
  respawn: 5.0, // fast respawn to keep combat intense
  retreatHp: 0.18,
  recoverHp: 0.45,
  healRate: 0.05,
};
