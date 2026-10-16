export const WEAPONS = {
  gun: { rate: 15, speed: 300, life: 1.5, dmg: 2.8, spread: 0.002 }, // Rate 15/s, velocity 300, life 1.5s (~450m reach), dmg 2.8 per barrel (5.6 volley, 84 DPS)
  // 56 dps if every shot lands (about half do), so ~2-10 s to sink a boat
  // Our missile works like a fighter-jet missile: it locks onto the boat nearest your crosshair when you
  // fire (inside `lockCone` radians either side of your heading, within `lockRange`), steers at it for
  // `track` seconds, then goes ballistic. It also loses the lock if the target slips outside `loseCone`
  // (it can't turn that hard). A dodged missile just flies on and blows up on whatever island is in the way.
  missile: { cooldown: 5, speed: 60, maxSpeed: 215, accel: 68, turn: 3.2, homing: true, track: 2.5, loseCone: 2.8, lockCone: 1.25, lockRange: 360, dmg: 70, blast: 11, life: 5 }, // burst weapon: locks within 1.25 rad, tracks target for 2.5s, then goes dumb/ballistic
  enemyBullet: { speed: 120, life: 1.4 }, // shots inherit boat speed
  // Enemy missile: small boats 50 DMG (50% player HP), big boats 58 DMG (heavy hit)
  enemyMissile: { speed: 58, maxSpeed: 195, accel: 60, turn: 1.80, homing: true, track: 2.2, loseCone: 2.2, dmg: 50, dmgSmall: 50, dmgBig: 58, blast: 10, life: 5 },
};
