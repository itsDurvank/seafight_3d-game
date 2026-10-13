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
  baseTop: 76, // normal top speed
  topCap: 114, // normal top speed: it climbs from baseTop to this while you sail flat out
  topGain: 3.2, // top speed gained per second while sailing flat out (about 12 s from 76 to 114)
  topDecay: 1.5, // top speed lost per second when you let go of W
  pull: 0.8, // how quickly speed catches up to the top speed
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
  boostAdd: 12, // flat extra speed on top of that (70 x 1.3 + 12 = 103 at the start, 105 x 1.3 + 12 = 148 flat out)
  boostPull: 1.5, // how fast speed ramps up into the boost: lower = a longer, smoother surge (no sudden jump)
  brakeMin: 12, // Space slows you down to about this speed
  brakeDecel: 90, // how fast Space slows you (speed units per second)
  brakeTurnMul: 1.6, // steering is much easier while braking
  boostTurnMul: 1.5, // extra steering authority while boosting
  boostMax: 160, // absolute speed limit while boosting
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
  gun: { rate: 14, speed: 120, life: 1.1, dmg: 4, spread: 0.012, assistCone: 0.22, assist: 0.85, hitPad: 0.8 }, // spread = random cone (rad). assistCone/assist = gentle aim assist: shots bend toward a boat within this many rad of your nose (0 = off). hitPad = extra hit radius for your bullets.
  // 56 dps if every shot lands (about half do), so ~2-10 s to sink a boat
  // Our missile works like a fighter-jet missile: it locks onto the boat nearest your crosshair when you
  // fire (inside `lockCone` radians either side of your heading, within `lockRange`), steers at it for
  // `track` seconds, then goes ballistic. It also loses the lock if the target slips outside `loseCone`
  // (it can't turn that hard). A dodged missile just flies on and blows up on whatever island is in the way.
  missile: { cooldown: 5, speed: 60, maxSpeed: 220, accel: 70, turn: 1.9, homing: true, track: 2.4, loseCone: 1.9, lockCone: 0.75, lockRange: 340, dmg: 70, blast: 11, life: 5 }, // burst weapon: 1/2/3/3/4 direct hits sink skiff/raider/gunboat/cruiser/dreadnought
  enemyBullet: { speed: 110, life: 1.3 }, // shots also inherit the firing boat's speed
  // Enemy missiles: same idea, a little slower to turn and shorter-lived tracking, so you can juke them or lose them behind an island.
  enemyMissile: { speed: 55, maxSpeed: 190, accel: 65, turn: 1.55, homing: true, track: 1.9, loseCone: 1.8, dmg: 30, blast: 9, life: 5 }, // 4 direct hits sink you; you can break the lock with a hard turn, a boost, or an island
};

// One enemy boat type per island. Each looks and fights differently.
// `boost` = speed multiplier of its escape burst: small boats surge hard, big heavy ones barely.
export const ENEMY_TYPES = {
  skiff: {
    name: 'Mango Skiff', boost: 1.75, hp: 45, speed: 28, turn: 2.4, scale: 0.85, radius: 2.4,
    pref: 36, range: 85, detect: 140,
    gun: { rate: 0.16, burst: 5, pause: 1.2, dmg: 4, spread: 0.06 },
    missile: { cd: 11 },
    style: { hull: 0xffa62b, accent: 0xffffff, cabin: 0xffe0a3, roof: 0xff7a1a, flag: 0xffffff, look: 'sail' },
  },
  cruiser: {
    name: 'Coral Cruiser', boost: 1.3, hp: 130, speed: 14, turn: 1.0, scale: 1.5, radius: 3.6,
    pref: 70, range: 120, detect: 150,
    missile: { cd: 5 },
    style: { hull: 0xff7aa8, accent: 0xfff0f5, cabin: 0xffc2d6, roof: 0xe84a82, flag: 0xffffff, look: 'pod' },
  },
  raider: {
    name: 'Violet Raider', boost: 1.7, hp: 70, speed: 36, turn: 2.0, scale: 1.0, radius: 2.6,
    pref: 45, range: 90, detect: 150,
    gun: { rate: 0.22, burst: 4, pause: 1.0, dmg: 5, spread: 0.07 },
    missile: { cd: 8.5 },
    style: { hull: 0x8e6bff, accent: 0x39e6ff, cabin: 0xd9ccff, roof: 0x5b3fd1, flag: 0x39e6ff, look: 'raider' },
  },
  gunboat: {
    name: 'Jade Gunboat', boost: 1.45, hp: 95, speed: 22, turn: 1.4, scale: 1.25, radius: 3.1,
    pref: 55, range: 100, detect: 150,
    gun: { rate: 0.3, burst: 4, pause: 1.2, dmg: 5, spread: 0.05, twin: true },
    missile: { cd: 7.5 },
    style: { hull: 0x1fb36b, accent: 0xfff3b0, cabin: 0xc8f5dc, roof: 0x0b7d49, flag: 0xfff3b0, look: 'twin' },
  },
  dread: {
    name: 'Sunset Dreadnought', boost: 1.25, hp: 170, speed: 16, turn: 0.85, scale: 1.8, radius: 4.2,
    pref: 75, range: 125, detect: 160,
    gun: { rate: 0.25, burst: 6, pause: 1.4, dmg: 5, spread: 0.06 },
    missile: { cd: 6 },
    style: { hull: 0xff6b4a, accent: 0xffd166, cabin: 0xffc9a8, roof: 0xb23a24, flag: 0xffd166, look: 'dread' },
  },
};

// Enemy speed: fighter-jet pacing. The player is the fastest boat on the water (70 -> 105 km/h, boost up to 150), but enemies
// are quick enough to run you down. Each boat's throttle is DYNAMIC (see the attack code in enemies.js):
//   - hunting from far away: it matches your speed and a bit more (up to `run` x cruise), and boosts if you pull away
//   - closing in: it matches your speed so it does not overshoot
//   - circling you: it slows right down into a turn fight (that is your window to land a missile)
//   - backing off between attack pulses: a bit slower, then it comes back
// Big boats are `bigMul` of the small ones' speed, so they act as slower, harder-hitting anchors.
export const ENEMY_SPEED = {
  cruise: 78, // a small boat's normal speed (+/- `wobble`)
  run: 1.38, // top speed when hunting a fast target = cruise x this (about 108). Hard cap without boost.
  boost: 128, // burst top speed of a small boat (the player boosts to ~160)
  bigMul: 0.72, // big boats: cruise 50, run 68, boost 85
  circle: 0.7, // fraction of cruise while circling a target at its preferred range
  roam: 0.7, // fraction of cruise while just wandering
  backoff: 0.75, // fraction of cruise while repositioning between attack pulses
  wobble: 0.1, // +/- this much slow random throttle drift (per boat)
};

// Rewards for sinking a boat: they feed the no-regeneration rule, so aggression is how you stay alive.
// Sinking a boat no longer heals you (healSmall/healBig = 0): health comes from the potions on the sea (see POTION).
export const KILL_REWARD = { healSmall: 0, healBig: 0, boostSeconds: 2, resetMissile: true };

// Health potions: they appear at random on the sea, and you or any HURT enemy boat can claim them.
export const POTION = {
  every: [15, 30], // seconds between spawns
  firstSpawn: [6, 10], // the first one comes early
  maxAlive: 4,
  heal: 0.4, // fraction of max health restored
  pickup: 3.4, // pick-up distance (added to the boat's radius)
  lifetime: 50, // seconds before an unclaimed potion vanishes
  nearPlayerChance: 0.5, // chance a potion spawns near you (the rest are anywhere on the map)
  nearRing: [90, 260], // how far from you the nearby ones appear
  seekHp: 0.55, // enemy boats below this fraction of health go for a potion
  seekRange: 260, // ...if one is within this distance
  enemyClaimBelow: 0.75, // an enemy only claims a potion when below this fraction of health
};

// How the 8 enemy boats spread out around you (see Director in enemies.js).
export const SWARM = {
  nearMax: 8, // this many boats hold the fight zone around you (8 = every boat is in the fight; lower it to park some further out)
  nearRing: { small: [50, 105], big: [75, 125] }, // how far from you the near boats hang out
  farRing: [230, 330], // where the waiting boats cruise
  farKeepOut: 150, // waiting boats won't drift closer to you than this
  maxAttackers: 3, // at most this many boats may go after YOU at once; the rest are reserved for fighting each other
  fightLeash: 190, // boat-vs-boat fights stay within this distance of you, so the chaos happens where you can see it
  rivalBonus: 45, // every boat picks a rival for a while and prefers it, so fights keep changing partners
  rivalTime: [10, 20], // seconds before a boat picks a new rival
  // Standing still gets you hunted: the longer you idle, the closer, more numerous and sharper they get.
  huntAttackers: 1, // extra boats that join the hunt at full heat
  huntExtra: 2, // extra boats pulled out of the waiting group at full heat
  huntClose: 0.35, // the ring tightens by this much at full heat
  huntDmg: 0.15, // their damage against you rises by this much at full heat
  idleSpeed: 21, // below this speed you count as standing still
  personalSpace: 30, // boats keep this much room from each other so nobody clumps
  orbitSpeed: 0.05, // radians/second the whole ring slowly turns around you
  respawnRing: [110, 170], // sunk boats come back this far from you, away from other boats
  runawayChance: 0.15, // when badly hurt: chance to flee far away (a chase) instead of going home
  runawayDist: [220, 320],
};

// Enemy tuning. Raise these to make the sea more dangerous.
export const DIFFICULTY = {
  hp: 1.15, // enemy health multiplier
  bigHp: 1.35, // extra health multiplier for the big boats (cruiser, gunboat, dreadnought) on top of `hp`
  speed: 0.9, // enemy speed multiplier
  dmg: 1.0, // damage enemy weapons deal to you
  dmgVsEnemy: 1.0, // damage enemy weapons deal to other enemy boats
  aim: 0.7, // 0..1: how well they lead their shots
  hitbox: 1.05, // enemy boats are 5% easier to hit
  dodge: 0.95, // overall multiplier on how often enemies dodge missiles
  detectMul: 1.6, // how far enemies notice targets, relative to the stat sheet: higher = they come and find you
  dodgeReact: 0.35, // seconds an enemy needs to notice a missile before it starts to side-step
  dodgeCooldown: 6, // after trying a dodge it can't dodge again for this long (your missile reloads in 5s)
  rammerReact: 0.55, // chance an enemy bothers to get out of the way of a boosting player
  // Enemy boost: a 4 second meter per boat, spent in short bursts for a few clear reasons
  // (dodging a missile, one panic escape when badly hurt, a brief charge from far away).
  // After a burst a boat must wait `burstGap` before the next offensive one, and the meter refills slowly.
  boost: { time: 4, min: 1.0, minOn: 0.6, offenseMax: 2.2, burstGap: [6, 10], refillDelay: 4, refillTime: 22 },
  turnMul: 0.85, // turning vs the stat sheet: wide arcs, no instant 90-degree jinks (the player turns at about 1.5 rad/s)
  turnDrag: 0.25, // a hard turn bleeds up to this fraction of speed, so dodges are arcs you can follow
  dodgeRange: 105, // an enemy starts its dodge when a missile aimed at it is this close
  respawn: 9, // seconds until a sunk enemy boat comes back (it returns near the action)
  retreatHp: 0.3, // an enemy turns tail below this fraction of health
  recoverHp: 0.6, // ...and comes back once healed above this
  healRate: 0.04, // fraction of max health regained per second near its own island
};
