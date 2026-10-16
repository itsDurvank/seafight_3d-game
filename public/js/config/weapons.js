export const WEAPONS = {
  gun: { rate: 12, speed: 280, life: 1.2, dmg: 2.4, spread: 0.002 }, // Pure manual twin cannons: shoots straight from boat heading, firm velocity (280), tight parallel spread (0.002), 2.4 dmg per barrel (~57 DPS total)
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
