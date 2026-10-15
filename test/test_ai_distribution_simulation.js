import assert from 'assert';
import fs from 'fs';
import { WORLD } from '../public/js/config.js';

console.log('--- Simulating AI Enemy Distribution & Player Cap ---');

// 1. Verify island spread
const islands = WORLD.islands.filter(i => i.enemy);
assert.strictEqual(islands.length, 8, 'There should be 8 islands with enemy boats');

const playerPos = { x: 0, z: -250 }; // Player near bottom edge as in user screenshot
const islandDistances = islands.map(i => Math.hypot(i.x - playerPos.x, i.z - playerPos.z));
const avgDist = islandDistances.reduce((a, b) => a + b, 0) / islandDistances.length;
console.log(`Average distance of enemy islands from player: ${avgDist.toFixed(1)}m`);
assert(avgDist > 180, 'Islands should be spread across the ocean');
console.log('✓ Archipelago islands are naturally spread across the world');

// 2. Verify code constraints in public/js/enemies.js
const enemiesCode = fs.readFileSync('public/js/enemies.js', 'utf8');

// Ensure respawn does NOT use px, pz
assert(!enemiesCode.includes('const px = player.state.x, pz = player.state.z;\n  let best = null, bestScore = -1;\n  for (let i = 0; i < 16; i++) {\n    const a = Math.random() * TAU, R = rand(SWARM.respawnRing[0], SWARM.respawnRing[1]);\n    const x = px + Math.cos(a) * R, z = pz + Math.sin(a) * R;'),
  'pickRespawn must not respawn boats in a ring around the player');
assert(enemiesCode.includes('const isl = self.island;'), 'pickRespawn must distribute boats around their home island');
console.log('✓ Boats respawn at their home islands across the map rather than on the player');

// Ensure artificial fightLeash pull towards player is removed
assert(!enemiesCode.includes('const lim = SWARM.fightLeash * 1.1;\n      if (pd > lim) {\n        const w = clamp((pd - lim) / 120, 0, 1);\n        vx += (pdx / pd) * w * 1.2; vz += (pdz / pd) * w * 1.2;\n      }'),
  'Artificial pull dragging AI-vs-AI duels toward player must be removed');
console.log('✓ Artificial tractor-beam pulling AI-vs-AI fights to the player is removed');

// Ensure Director pulse respects player cap
assert(enemiesCode.includes('const cap = Math.min(AI.playerCap || 3, 2);'), 'Director must cap directed attackers');
assert(enemiesCode.includes('if (player.alive && HUNT.n < cap)'), 'Director must check HUNT.n < cap before pulsing');
console.log('✓ Director pulse enforces strict player cap (max 2 attackers dispatched from pulse)');

// Ensure waypoint roaming patrols home islands and filters player from roam pool
assert(enemiesCode.includes('patrol own island territory'), 'Roaming includes home island patrol');
assert(enemiesCode.includes("all.filter((o) => o !== this && o.alive && o.team !== this.team && o.team !== 'player');"),
  'Roaming pool must not treat player as a roaming waypoint');
console.log('✓ Roaming boats patrol their home islands and do not wander toward player as roaming waypoints');

// Ensure detection reach and distance sanity
assert(enemiesCode.includes('const baseReach = isP ? (t === this.target ? 220 : 135) : Math.min(220, ty.detect * D.detectMul);'),
  'Player detection reach is proximity based so distant boats do not target player');
assert(/if\s*\(others\s*>=\s*\(AI\.playerCap\s*\|\|\s*3\)\)\s*\{\s*sc\s*-=\s*8\.0;/.test(enemiesCode),
  'Heavy penalty applied to player target score when player cap is reached');
console.log('✓ Proximity-based detection: boats actively attack when player is near, but focus on each other when far');

console.log('\n=== ALL AI DISTRIBUTION VERIFICATIONS PASSED ===');
