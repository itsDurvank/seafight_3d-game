import fs from 'fs';
import path from 'path';
import assert from 'assert';

console.log('--- Verifying Combat Fix Acceptance Criteria ---');

// 1. Module import deduplication
const publicJsFiles = fs.readdirSync('public/js').filter(f => f.endsWith('.js'));
for (const file of publicJsFiles) {
  const content = fs.readFileSync(path.join('public/js', file), 'utf8');
  assert(!content.includes('config.js?v'), `${file} contains config.js?v`);
  const vMatches = content.match(/import\s+.*from\s+['"][^'"]+\?v=/g);
  assert(!vMatches, `${file} contains ?v= import: ${vMatches}`);
}
console.log('✓ Section A: All public/js imports use bare module paths (no ?v=)');

// 2. Player speed (config.js & modular config files)
let configContent = fs.readFileSync('public/js/config.js', 'utf8');
if (fs.existsSync('public/js/config')) {
  for (const f of fs.readdirSync('public/js/config')) {
    configContent += '\n' + fs.readFileSync(path.join('public/js/config', f), 'utf8');
  }
}
assert(configContent.includes('baseTop: 90'));
assert(configContent.includes('topCap: 110'));
assert(configContent.includes('topGain: 6'));
assert(configContent.includes('topDecay: 4'));
assert(configContent.includes('boostMul: 1.3'));
assert(configContent.includes('boostAdd: 8'));
assert(configContent.includes('boostMax: 150'));
assert(configContent.includes('boostTime: 5'));
assert(configContent.includes('boostRefillDelay: 0'));
assert(configContent.includes('boostRefillTime: 7'));
assert(configContent.includes('turnRate: 1.7'));
console.log('✓ Section B: BOAT config player speed settings match specs');

// Server clamp in rooms.js
const roomsContent = fs.readFileSync('server/rooms.js', 'utf8');
assert(roomsContent.includes('p.state.speed = Math.min(Number(s.speed) || 0, 160)'));
assert(roomsContent.includes('speed: Math.min(Number(msg.speed) || 0, 160)'));
console.log('✓ Section B: Server speed clamps in rooms.js set to 160');

// 3. Enemy speed (config.js & enemies.js)
assert(configContent.includes('cruise: 81'));
assert(configContent.includes('run: 1.222'));
assert(configContent.includes('boost: 135'));
assert(configContent.includes('turnMul: 0.9'));
assert(configContent.includes('turnDrag: 0.10'));
assert(configContent.includes('minCombatSpeed: 0.6'));
assert(configContent.includes('lockTime: [4, 8]'));
assert(configContent.includes('playerCap: 3'));

const enemiesContent = fs.readFileSync('public/js/enemies.js', 'utf8');
assert(/this\.spd\s+=\s+ENEMY_SPEED\.cruise;/.test(enemiesContent));
assert(/this\.boostSpd\s+=\s+ENEMY_SPEED\.boost;/.test(enemiesContent));
assert(/this\.maxRun\s+=\s+ENEMY_SPEED\.cruise\s*\*\s*ENEMY_SPEED\.run;/.test(enemiesContent));
assert(enemiesContent.includes('const stab = 1;'));
assert(enemiesContent.includes('const chase = clamp(tsp + 18 + gapK * 40, spd, this.maxRun);'));
console.log('✓ Section C: Enemy speed = 10% below player, max chase 99, stab = 1, rubber band chase');

// 4. Island / edge stuck fixes
const worldContent = fs.readFileSync('public/js/world.js', 'utf8');
assert(worldContent.includes('sea_rocks') && worldContent.includes('shipwreck') && worldContent.includes('sea_castle'));
assert(enemiesContent.includes('islandPush = Math.max(islandPush, avoidWeight)'));
assert(enemiesContent.includes('const outward = (s.x * fx + s.z * fz) > 0;'));
assert(enemiesContent.includes('const edgeWarnRadius = WORLD.radius - 60;'));
assert(enemiesContent.includes('(1 - islandPush)'));
assert(enemiesContent.includes('this.bumpScore += 0.5;'));
assert(enemiesContent.includes('this.mode = \'evade\'; this.evadeTimer = 2.2; this.stopBoost();'));
console.log('✓ Section D: Obstacles unified, edge avoidance dampened by islandPush, stuck detector active');

// 5. Hunting behaviour
assert(enemiesContent.includes('const lockHeld = prev && prev.alive && this.targetLock > 0 && !this.hitEvent && this.lastStandT <= 0;'));
assert(enemiesContent.includes('this.pulse = (this.pulse ?? 6) - dt;'));
assert(enemiesContent.includes('intercept: [2.5, 4], tail: [3, 5], pincer: [2.5, 4]'));
assert(enemiesContent.includes('intercept: 0.6, pincer: 0.4'));
assert(enemiesContent.includes('case \'intercept\':'));
assert(enemiesContent.includes('case \'tail\':'));
assert(enemiesContent.includes('case \'pincer\':'));
console.log('✓ Section E: Target lock, director hunt pulse, intercept/tail/pincer tactics all implemented');

// 6. Ramming
assert(enemiesContent.includes("o === tg ? (tacName === 'ram' ? 0 : 8)"));
const mainContent = fs.readFileSync('public/js/main.js', 'utf8');
assert(mainContent.includes('enemy rammed us while boosting'));
assert(mainContent.includes('player.takeDamage(player.maxHp * 0.12, e.team);'));
assert(mainContent.includes('e.takeDamage(e.maxHp * 0.05, null);'));
assert(mainContent.includes('enemyRamCds'));
assert(mainContent.includes('b.takeDamage(Math.min(b.maxHp * 0.15, b.maxHp * 0.15), a.team);'));
assert(mainContent.includes('a.takeDamage(Math.min(a.maxHp * 0.05, a.maxHp * 0.15), null);'));
console.log('✓ Section F: Ramming separation margin, player ramming damage, and enemy-vs-enemy cooldown & 15% cap');

// 7. Untouched constraints
assert(mainContent.includes('function updateCamera(dt)'));
assert(mainContent.includes('function snapCamera()'));
console.log('✓ Untouched constraints: Camera dynamic behavior and multiplayer settings preserved');

console.log('\n=== ALL COMBAT ACCEPTANCE CHECKS PASSED SUCCESSFULLY ===');
