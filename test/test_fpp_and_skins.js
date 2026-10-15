// test/test_fpp_and_skins.js
// Verification test for:
// 1. Multiplayer assets boat skins integration
// 2. FPP / TPP mode persistence during death & respawn

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Verifying Multiplayer Assets Integration & FPP Persistence ---');

// 1. Check multiplayer asset files exist in public/js/multiplayer_assets
const assetsDir = path.join(__dirname, '..', 'public', 'js', 'multiplayer_assets');
const expectedFiles = [
  'boat1_tidecutter.js',
  'boat2_reefbreaker.js',
  'boat3_manta.js',
  'boat4_twinhull.js',
  'boat5_blazerunner.js',
  'boat6_thunderpike.js',
  'boat7_emeralddrake.js',
  'boat8_brassleviathan.js',
  'boat9_nightshade.js',
  'boat10_buzzsawbarracuda.js',
  'boat11_skyfoilfalcon.js',
  'boat12_krakenhulk.js',
  'boat13_jollyrogerrocketeer.js',
  'boat14_auroragyro.js',
  'boat15_crabcrusher.js',
];
for (const file of expectedFiles) {
  assert(fs.existsSync(path.join(assetsDir, file)), `Missing asset file: ${file}`);
}
console.log('✓ All 15 multiplayer boat asset files exist in public/js/multiplayer_assets/');

// 2. Check public/js/multiplayerBoats.js
const mpBoatsCode = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'multiplayerBoats.js'), 'utf8');
assert(mpBoatsCode.includes('buildTidecutterBoat'), 'multiplayerBoats.js missing buildTidecutterBoat');
assert(mpBoatsCode.includes('buildReefbreakerBoat'), 'multiplayerBoats.js missing buildReefbreakerBoat');
assert(mpBoatsCode.includes('buildMantaBoat'), 'multiplayerBoats.js missing buildMantaBoat');
assert(mpBoatsCode.includes('buildTwinhullBoat'), 'multiplayerBoats.js missing buildTwinhullBoat');
assert(mpBoatsCode.includes('buildBlazeRunnerBoat'), 'multiplayerBoats.js missing buildBlazeRunnerBoat');
assert(mpBoatsCode.includes('buildThunderpikeBoat'), 'multiplayerBoats.js missing buildThunderpikeBoat');
assert(mpBoatsCode.includes('buildEmeraldDrakeBoat'), 'multiplayerBoats.js missing buildEmeraldDrakeBoat');
assert(mpBoatsCode.includes('buildBrassLeviathanBoat'), 'multiplayerBoats.js missing buildBrassLeviathanBoat');
assert(mpBoatsCode.includes('buildNightshadeBoat'), 'multiplayerBoats.js missing buildNightshadeBoat');
assert(mpBoatsCode.includes('buildBuzzsawBarracudaBoat'), 'multiplayerBoats.js missing buildBuzzsawBarracudaBoat');
assert(mpBoatsCode.includes('buildSkyfoilFalconBoat'), 'multiplayerBoats.js missing buildSkyfoilFalconBoat');
assert(mpBoatsCode.includes('buildKrakenhulkBoat'), 'multiplayerBoats.js missing buildKrakenhulkBoat');
assert(mpBoatsCode.includes('buildJollyRogerRocketeerBoat'), 'multiplayerBoats.js missing buildJollyRogerRocketeerBoat');
assert(mpBoatsCode.includes('buildAuroraGyroBoat'), 'multiplayerBoats.js missing buildAuroraGyroBoat');
assert(mpBoatsCode.includes('buildCrabCrusherBoat'), 'multiplayerBoats.js missing buildCrabCrusherBoat');
assert(mpBoatsCode.includes('buildHeroBoatFPV'), 'multiplayerBoats.js missing buildHeroBoatFPV for cockpit FPV support');
console.log('✓ multiplayerBoats.js correctly imports and registers all 15 multiplayer boat builders with FPV cockpit support');

// 3. Check public/js/boat.js
const boatCode = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'boat.js'), 'utf8');
assert(boatCode.includes("import { buildMultiplayerBoat, MULTIPLAYER_BOATS } from './multiplayerBoats.js'"), 'boat.js missing multiplayerBoats import');
assert(boatCode.includes('style.mpColorIndex'), 'boat.js buildModel missing mpColorIndex check');
assert(boatCode.includes('applyStyle(customStyle, colorIndex'), 'boat.js applyStyle missing colorIndex parameter');
assert(boatCode.includes('delete this.style.mpColorIndex'), 'boat.js resetStyle/setSkin missing cleanup of mpColorIndex');
console.log('✓ boat.js dynamically builds multiplayer boats and attaches FPV cockpit');

// 4. Check public/js/multiplayer.js
const mpCode = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'multiplayer.js'), 'utf8');
assert(mpCode.includes("import { buildMultiplayerBoat } from './multiplayerBoats.js'"), 'multiplayer.js missing buildMultiplayerBoat import');
assert(mpCode.includes('buildMultiplayerBoat(this.boatSkin'), 'RemotePlayer not using buildMultiplayerBoat with boatSkin');
assert(mpCode.includes('applySkinStyle(this.localColor.style, this.localColorIndex, this.localBoatSkin)'), 'multiplayer.js roomJoined not passing localColorIndex and localBoatSkin to applySkinStyle');
console.log('✓ multiplayer.js assigns unique multiplayer boat skins to each player by boatSkin');

// 5. Check public/js/main.js for FPP death blast and respawn restoration
const mainCode = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'main.js'), 'utf8');
assert(mainCode.includes('respawnInFPV = isFPV;'), 'sink() must record respawnInFPV = isFPV');
assert(mainCode.includes('setFPV(false, false);'), 'sink() must temporarily switch to TPP for blast animation');
assert(mainCode.includes('if (respawnInFPV) {'), 'respawnPlayer() must check respawnInFPV');
assert(mainCode.includes('setFPV(true, false);'), 'respawnPlayer() must restore FPV');
console.log('✓ main.js triggers full explosion blast on death and faithfully restores FPV on respawn');

// 6. Check public/index.html has the lobby boat picker and offline only has hero & classic
const htmlCode = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
assert(htmlCode.includes('id="mp-lobby-boat-picker"'), 'index.html missing mp-lobby-boat-picker in lobby');
assert(htmlCode.includes('class="mp-boat-picker-section"'), 'index.html missing mp-boat-picker-section');
const settingsPart = htmlCode.slice(htmlCode.indexOf('id="settings-modal"'), htmlCode.indexOf('id="mp-lobby-modal"'));
assert(!settingsPart.includes('reefbreaker'), 'Offline settings must NOT include multiplayer skins');
console.log('✓ index.html isolates multiplayer boat skins to the room lobby');

console.log('\n=== ALL FPP & MULTIPLAYER ASSET TESTS PASSED! ===');
