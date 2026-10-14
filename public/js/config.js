// Shared tuning values. Stage (d) will move the world layout to the server.
export const COLORS = {
  horizon: 0xaee8ff, // pale aqua where sea meets sky
};

export const WORLD = {
  radius: 520, // soft edge of the sailable sea
  dock: { x: 0, z: -9, w: 22, d: 5 },
  boatSpawn: { x: 0, z: -2, yaw: 0 },
  // The middle of the sea is the battleground: enemy boats sail out here to fight
  // each other and you. The harbor is a safe zone, so nobody can spawn-camp you.
  arena: { x: 0, z: 0, inner: 55, outer: 150 },
  safeHarbor: { x: 0, z: -2, r: 34 },
  islands: [
    {
      id: 'home', name: 'Your Island', x: 75, z: -55, r: 26, home: true, seed: 1,
      theme: { sand: 0xffe2a8, grass: 0x7ed957, leaf: 0x3fcf6e, trunk: 0xc98a55, rock: 0xcfc8b8, accent: 0xff8a80, map: '#ffd166' },
    },
    {
      id: 'mango', name: 'Mango Isle', x: -130, z: 62, r: 24, seed: 2, enemy: 'skiff',
      theme: { sand: 0xffd27a, grass: 0xa5e04a, leaf: 0x7bd63a, trunk: 0xb9743a, rock: 0xd9b27a, accent: 0xff9f1c, feature: 'mango', map: '#ffa733' },
    },
    {
      id: 'coral', name: 'Coral Bay', x: 115, z: 155, r: 28, seed: 3, enemy: 'cruiser',
      theme: { sand: 0xffc7d6, grass: 0x9be3a6, leaf: 0xff7aa8, trunk: 0xa8643f, rock: 0xff8fa3, accent: 0xff5c8a, feature: 'coral', map: '#ff7aa8' },
    },
    {
      id: 'lagoon', name: 'Violet Lagoon', x: -82, z: -178, r: 26, seed: 4, enemy: 'raider',
      theme: { sand: 0xe0d2ff, grass: 0x6fd3c4, leaf: 0x9a86ff, trunk: 0x7a5aa6, rock: 0xb39bff, accent: 0xb48cff, feature: 'crystal', map: '#a78bfa' },
    },
    {
      id: 'jade', name: 'Jade Cove', x: 225, z: -28, r: 24, seed: 5, enemy: 'gunboat',
      theme: { sand: 0xc4f5da, grass: 0x1fb36b, leaf: 0x0f9d58, trunk: 0x7a5c3a, rock: 0x6fbf9a, accent: 0x2ee59d, feature: 'pillar', map: '#34d399' },
    },
    {
      id: 'sunset', name: 'Sunset Atoll', x: -232, z: -62, r: 30, seed: 6, enemy: 'dread',
      theme: { sand: 0xffb48a, grass: 0xf2c14e, leaf: 0xff6b4a, trunk: 0x8a4b2a, rock: 0xc2552d, accent: 0xff7a1a, feature: 'volcano', map: '#ff7a59' },
    },
    {
      // the terraced sandstone mountain asset (each mountain island is also home to one enemy boat)
      id: 'peak', name: 'Sandstone Peak', x: -40, z: 232, r: 30, seed: 7, enemy: 'skiff', enemyName: 'Sand Skiff',
      theme: { sand: 0xf5deb3, grass: 0x48b63e, leaf: 0x2e9f42, trunk: 0xb58e65, rock: 0xdeb478, accent: 0xdeb478, feature: 'mountain', map: '#d9a05b' },
    },
    {
      id: 'mesa', name: 'Amber Mesa', x: -205, z: -190, r: 28, seed: 8,
      theme: { sand: 0xf5deb3, grass: 0x48b63e, leaf: 0x2e9f42, trunk: 0xb58e65, rock: 0xdeb478, accent: 0xdeb478, feature: 'mountain', map: '#d9a05b' },
    },
    {
      id: 'crown', name: 'Dune Crown', x: 250, z: -190, r: 26, seed: 9, enemy: 'skiff', enemyName: 'Dune Skiff',
      theme: { sand: 0xf5deb3, grass: 0x48b63e, leaf: 0x2e9f42, trunk: 0xb58e65, rock: 0xdeb478, accent: 0xdeb478, feature: 'mountain', map: '#d9a05b' },
    },
    {
      id: 'bluff', name: 'Golden Bluff', x: 250, z: 170, r: 27, seed: 10,
      theme: { sand: 0xf5deb3, grass: 0x48b63e, leaf: 0x2e9f42, trunk: 0xb58e65, rock: 0xdeb478, accent: 0xdeb478, feature: 'mountain', map: '#d9a05b' },
    },
    {
      id: 'ridge', name: 'Sunstone Ridge', x: -250, z: 200, r: 28, seed: 11, enemy: 'raider', enemyName: 'Sunstone Raider',
      theme: { sand: 0xf5deb3, grass: 0x48b63e, leaf: 0x2e9f42, trunk: 0xb58e65, rock: 0xdeb478, accent: 0xdeb478, feature: 'mountain', map: '#d9a05b' },
    },
  ],
};

export const BOAT = {
  baseTop: 100, // normal cruising speed
  topCap: 128, // normal top speed: climbs from baseTop to this flat out
  topGain: 10, // top speed gained per second while sailing flat out
  topDecay: 3, // top speed lost per second when you let go of W
  pull: 2.2, // how quickly speed catches up to the top speed
  maxReverse: 5,
  accel: 9,
  drag: 0.5,
  turnRate: 1.5, // radians per second at full grip
  radius: 2.4, // collision radius
  // Shift boost
  boostTime: 8, // seconds of boost energy (toggle with Shift)
  boostRefillDelay: 2, // seconds without boosting before the energy starts refilling
  boostRefillTime: 4, // seconds to refill a completely empty boost meter
  boostMin: 0.6, // minimum energy (seconds) needed to switch the boost on
  boostMul: 1.3, // top speed multiplier while boosting
  boostAdd: 14, // flat extra speed on top of that
  boostPull: 1.6, // how fast speed ramps up into the boost
  boostMax: 170, // absolute speed limit while boosting
  boostRamp: 0.5, // seconds of ease-in at boost start
  boostMinAccel: 25, // units/s^2 floor so the surge never crawls
  brakeMin: 12, // Space slows you down to about this speed
  brakeDecel: 90, // how fast Space slows you (speed units per second)
  brakeTurnMul: 1.6, // steering is much easier while braking
  boostTurnMul: 1.5, // extra steering authority while boosting
  // ramming while boosting (percent of each boat's MAX health)
  boostRamSelfPct: 0.10,
  boostRamEnemyPct: 0.30,
};

export const PLAYER = {
  maxHp: 100,
  regenDelay: 6, // seconds without damage before health slowly returns
  regenRate: 6,
  respawnTime: 3,
  invuln: 3, // seconds of protection after respawning
};

export const WEAPONS = {
  gun: { rate: 14, speed: 280, life: 1.2, dmg: 4, spread: 0.002, turnLead: 0.10, assistCone: 0.16, assist: 0.45, hitPad: 0.8 }, // High velocity (280) + turn-rate compensation (turnLead: 0.10) keeps bullet stream firm and centered while circling/turning, tight parallel spread (0.002), and subtle micro-assist (0.16 rad / 45%) for clean hits without aimbot snapping
  // 56 dps if every shot lands (about half do), so ~2-10 s to sink a boat
  // Our missile works like a fighter-jet missile: it locks onto the boat nearest your crosshair when you
  // fire (inside `lockCone` radians either side of your heading, within `lockRange`), steers at it for
  // `track` seconds, then goes ballistic. It also loses the lock if the target slips outside `loseCone`
  // (it can't turn that hard). A dodged missile just flies on and blows up on whatever island is in the way.
  missile: { cooldown: 5, speed: 60, maxSpeed: 210, accel: 65, turn: 1.35, homing: true, track: 2.2, loseCone: 1.0, lockCone: 0.38, lockRange: 280, dmg: 70, blast: 11, life: 5 }, // burst weapon
  enemyBullet: { speed: 120, life: 1.4 }, // shots inherit boat speed
  // Enemy missile: small boats 50 DMG (50% player HP), big boats 58 DMG (heavy hit)
  enemyMissile: { speed: 58, maxSpeed: 195, accel: 60, turn: 1.30, homing: true, track: 2.0, loseCone: 0.95, dmg: 50, dmgSmall: 50, dmgBig: 58, blast: 10, life: 5 },
};

// One enemy boat type per island.
// Stats tuned to be exactly 10% less than the player:
// - HP: average ~90 HP (player: 100 HP)
// - Machine gun: 3.6 DMG per bullet (player: 4.0 DMG)
export const ENEMY_TYPES = {
  skiff: {
    name: 'Mango Skiff', boost: 1.75, hp: 76, speed: 28, turn: 2.3, scale: 0.85, radius: 2.4,
    pref: 28, range: 75, detect: 300,
    gun: { rate: 0.12, burst: 6, pause: 0.65, dmg: 3.6, spread: 0.05 },
    missile: { cd: 7 },
    style: { hull: 0xffa62b, accent: 0xffffff, cabin: 0xffe0a3, roof: 0xff7a1a, flag: 0xffffff, look: 'sail' },
  },
  cruiser: {
    name: 'Coral Cruiser', boost: 1.3, hp: 110, speed: 18, turn: 1.2, scale: 1.5, radius: 3.6,
    pref: 44, range: 85, detect: 300,
    gun: { rate: 0.14, burst: 6, pause: 0.6, dmg: 4.0, spread: 0.05 },
    missile: { cd: 5.5 },
    style: { hull: 0xff7aa8, accent: 0xfff0f5, cabin: 0xffc2d6, roof: 0xe84a82, flag: 0xffffff, look: 'pod' },
  },
  raider: {
    name: 'Violet Raider', boost: 1.7, hp: 84, speed: 32, turn: 2.1, scale: 1.0, radius: 2.6,
    pref: 32, range: 78, detect: 300,
    gun: { rate: 0.12, burst: 6, pause: 0.6, dmg: 3.6, spread: 0.05 },
    missile: { cd: 6 },
    style: { hull: 0x8e6bff, accent: 0x39e6ff, cabin: 0xd9ccff, roof: 0x5b3fd1, flag: 0x39e6ff, look: 'raider' },
  },
  gunboat: {
    name: 'Jade Gunboat', boost: 1.45, hp: 110, speed: 22, turn: 1.5, scale: 1.25, radius: 3.1,
    pref: 38, range: 82, detect: 300,
    gun: { rate: 0.14, burst: 6, pause: 0.6, dmg: 4.0, spread: 0.05, twin: true },
    missile: { cd: 5.5 },
    style: { hull: 0x1fb36b, accent: 0xfff3b0, cabin: 0xc8f5dc, roof: 0x0b7d49, flag: 0xfff3b0, look: 'twin' },
  },
  dread: {
    name: 'Sunset Dreadnought', boost: 1.25, hp: 110, speed: 18, turn: 1.0, scale: 1.8, radius: 4.2,
    pref: 48, range: 90, detect: 300,
    gun: { rate: 0.12, burst: 8, pause: 0.6, dmg: 4.0, spread: 0.05 },
    missile: { cd: 5.5 },
    style: { hull: 0xff6b4a, accent: 0xffd166, cabin: 0xffc9a8, roof: 0xb23a24, flag: 0xffd166, look: 'dread' },
  },
};

// Enemy speed: still below the player, with a 5% speed bump across cruise/boost
export const ENEMY_SPEED = {
  cruise: 71.82,
  run: 1.50,
  boost: 151.2,
  bigMul: 0.85,
  circle: 0.72,
  roam: 0.85, // active cruising towards action
  backoff: 0.80,
  wobble: 0.05,
};

// Rewards for sinking a boat
export const KILL_REWARD = { healSmall: 0, healBig: 0, boostSeconds: 2, resetMissile: true };

// Health potions float on the sea in a batch of up to 3
export const POTION = {
  batchSize: 3,
  respawnDelay: [15, 20],
  firstSpawn: [5, 8],
  maxAlive: 3,
  heal: 0.45,
  pickup: 4.6,
  lifetime: 95,
  spacing: 140, // widely scattered across separate islands
  seekHp: 0.65,
  seekRange: 340,
  enemyClaimBelow: 0.88,
};

// Enemy brain tuning: high aggression, tight coordination
export const AI = {
  fleeHp: [0.10, 0.22], // fight hard until very low
  seekHp: [0.55, 0.80],
  recoverHp: [0.50, 0.75],
  lastStand: [6, 12],
  lockTime: [2.5, 5.0],
  roamHunt: 0.95, // almost always sails towards active fights
  aimCone: 1.35, // generous firing cone so guns stay active
  aimConeOpp: 1.15, // wide firing cone for passing shots
  gunPause: [0.35, 0.65], // rapid burst recovery
  wProx: 3.0, wWeak: 1.4, wBusy: 0.85, wThreat: 1.3, wSticky: 0.5, wGrudge: 2.0,
  wCrowd: 0.5, playerCap: 2, // cap player hunters to 2 so remaining 6 boats duel each other (prevents congesting the player!)
  steer: {
    gain: 2.1,
    accel: 2.4,
    snapAccel: 3.4,
    meander: 0.16,
    cruise: { factor: 0.40, dz: 0.18, t: [1.6, 3.2] },
    sweep: { factor: 0.70, dz: 0.06, t: [1.8, 3.8] },
    snap: { factor: 0.92, dz: 0.02, t: [0.5, 0.9], cooldown: [2.0, 4.0] },
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
  speed: 1.0, // uses 71.82 cruise / 107.73 chase / 151.2 boost directly
  dmg: 1.0, // uses 3.6 bullet DMG / 63 missile DMG directly
  dmgVsEnemy: 1.0,
  aim: 0.80, // sharp, accurate tracking
  hitbox: 1.15,
  dodge: 0.82,
  detectMul: 1.5, // wide detection reach
  dodgeReact: 0.28,
  dodgeCooldown: 4.5,
  rammerReact: 0.65,
  // Enemy boost: 7.2s meter (exactly 10% less than player's 8.0s)
  boost: { time: 7.2, min: 1.0, minOn: 0.6, offenseMax: 2.5, burstGap: [3.5, 6.5], refillDelay: 2.0, refillTime: 6.0 },
  turnMul: 0.92,
  turnDrag: 0.15,
  minCombatSpeed: 0.52,
  dodgeRange: 110,
  respawn: 5.0, // fast respawn to keep combat intense
  retreatHp: 0.18,
  recoverHp: 0.45,
  healRate: 0.05,
};

// Multiplayer (MP) configuration - single source of truth
export const MP = {
  aiBoats: false,
  winKills: 20,
  maxPlayers: 5,
  minPlayersToStart: 2,
  countdownSeconds: 3,
  batchSize: 4,
  intraBatchDelay: [1, 10], // 1-10s random delay between orbs in a batch
  batchPause: [10, 15],     // 10-15s pause after all 4 orbs are claimed/expired before next batch
  orbLifetime: 95,          // seconds before an unclaimed orb expires
  maxNameLength: 16,
  colors: [
    { id: 0, name: 'Sunfire', hex: '#ff7a59', icon: '🔥', style: { hull: 0xff7a59, chine: 0xdce5e8, accent: 0xffe066, roof: 0xd9532f, flag: 0xffe066, cabin: 0xfff4e0, dark: 0x2b3440, neon: 0xff7a59 } },
    { id: 1, name: 'Azure', hex: '#1fd1c9', icon: '💧', style: { hull: 0x1fd1c9, chine: 0xb5dff5, accent: 0x69c0ff, roof: 0x0fa8a0, flag: 0xbae7ff, cabin: 0xe6f7ff, dark: 0x1b2838, neon: 0x40a9ff } },
    { id: 2, name: 'Jade', hex: '#1fb36b', icon: '🌿', style: { hull: 0x1fb36b, chine: 0xc6f6d5, accent: 0xa7f3d0, roof: 0x137948, flag: 0xd9f99d, cabin: 0xf0fff4, dark: 0x1c3326, neon: 0x48bb78 } },
    { id: 3, name: 'Violet', hex: '#9a86ff', icon: '⚡', style: { hull: 0x9a86ff, chine: 0xdcd0ff, accent: 0xf472b6, roof: 0x6941c6, flag: 0xe9d5ff, cabin: 0xf8f5ff, dark: 0x2e1b4d, neon: 0xc084fc } },
    { id: 4, name: 'Rose', hex: '#ff7aa8', icon: '🌸', style: { hull: 0xff7aa8, chine: 0xfcc7d8, accent: 0xffd1dc, roof: 0xd6336c, flag: 0xffe4e6, cabin: 0xfff0f5, dark: 0x3d1d2b, neon: 0xf06595 } },
  ],
  spawns: [
    { x: 0, z: -2, yaw: 0 },         // Harbor
    { x: -95, z: 85, yaw: 2.2 },     // Mango Isle bay
    { x: 90, z: 130, yaw: 0.8 },     // Coral Bay
    { x: -60, z: -150, yaw: -1.2 },  // Violet Lagoon
    { x: 190, z: -20, yaw: -2.5 },   // Jade Cove
  ],
};
