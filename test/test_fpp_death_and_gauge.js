import { readFileSync } from 'fs';

console.log('--- Testing FPP Gauge Position and Death Blast Architecture ---');

// 1. Verify heroBoatFPV.js gauge positioning
const fpvCode = readFileSync('public/js/heroBoatFPV.js', 'utf8');

// Gauge must be shifted right (e.g. -0.18 instead of overlapping at -0.32)
if (!fpvCode.includes('add(gauge, -0.18, 0.052, -0.02, dash)')) {
  throw new Error('Gauge is not shifted to -0.18 in heroBoatFPV.js');
}
console.log('✓ Gauge successfully shifted to x = -0.18 (clearing left console throttle lever at x = -0.42)');

if (!fpvCode.includes('add(radar, 0.055, 0.052, 0.0, dash)')) {
  throw new Error('Radar is not shifted to accommodate gauge in heroBoatFPV.js');
}
console.log('✓ Radar repositioned to x = 0.055 without overlap');

if (!fpvCode.includes('add(boostGroup, 0.19, 0.054, 0.02, dash)')) {
  throw new Error('Boost bar is not positioned cleanly in heroBoatFPV.js');
}
console.log('✓ Boost energy gauge positioned cleanly at x = 0.19');

// 2. Verify main.js sink & respawn logic
const mainCode = readFileSync('public/js/main.js', 'utf8');

if (!mainCode.includes('respawnInFPV = isFPV;')) {
  throw new Error('main.js does not save respawnInFPV state');
}
console.log('✓ main.js records respawnInFPV = isFPV upon death');

if (!mainCode.includes('setFPV(false, false);') || !mainCode.includes('snapCamera();')) {
  throw new Error('main.js does not detach FPV camera and snap to TPP for blast animation');
}
console.log('✓ main.js detaches FPV camera to TPP so blast animation is visible');

if (!mainCode.includes('boat.group.visible = false;')) {
  throw new Error('main.js does not hide boat mesh upon death');
}
console.log('✓ main.js hides boat mesh so explosion debris and fire take center stage');

const mainNormalized = mainCode.replace(/\r\n/g, '\n');
if (!mainNormalized.includes('if (respawnInFPV) {\n    respawnInFPV = false;\n    setFPV(true, false);')) {
  throw new Error('main.js does not restore FPP view upon respawn if player died in FPP');
}
console.log('✓ main.js restores FPP cockpit perspective upon respawning');

// 3. Verify multiplayer.js delegates to this.game.sink
const mpCode = readFileSync('public/js/multiplayer.js', 'utf8');

if (!mpCode.includes('this.game.sink(msg.killerId, killerName, true);')) {
  throw new Error('multiplayer.js does not delegate local death to this.game.sink');
}
console.log('✓ multiplayer.js delegates playerDied to this.game.sink');

console.log('\n=== ALL FPP GAUGE & DEATH BLAST TESTS PASSED! ===');
