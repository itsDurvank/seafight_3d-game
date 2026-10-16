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
    { id: 0, name: 'Sunfire', hex: '#ff7a59', icon: '🔥', style: { hull: 0xfff4e0, chine: 0xdce5e8, accent: 0xff7a59, roof: 0xff8a3d, flag: 0xffe066, cabin: 0xff7a59, dark: 0x2b3440, neon: 0x1fd1c9 } },
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
