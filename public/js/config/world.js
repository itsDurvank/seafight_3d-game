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
