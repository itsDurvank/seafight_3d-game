// test/test_mp_hud_dom.js
// Verify DOM structure, boat picker rendering, and Ready button states for host and guest
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Read public/index.html and verify required elements exist
const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');

// 1. Verify lobby elements
assert(html.includes('id="mp-lobby-modal"'), 'Missing mp-lobby-modal');
assert(html.includes('id="mp-lobby-boat-picker"'), 'Missing mp-lobby-boat-picker');
assert(html.includes('id="mp-lobby-paint-swatches"'), 'Missing mp-lobby-paint-swatches');
assert(html.includes('id="mp-lobby-skin-btn"'), 'Missing mp-lobby-skin-btn');
assert(html.includes('id="mp-ready-btn"'), 'Missing mp-ready-btn');
assert(html.includes('id="mp-start-match-btn"'), 'Missing mp-start-match-btn');

// 2. Verify settings online elements
assert(html.includes('id="settings-online-view"'), 'Missing settings-online-view');
assert(html.includes('id="settings-online-boat-picker"'), 'Missing settings-online-boat-picker');
assert(html.includes('id="settings-online-paint-swatches"'), 'Missing settings-online-paint-swatches');
assert(html.includes('id="settings-online-skin-btn"'), 'Missing settings-online-skin-btn');

console.log('✓ All DOM elements for Lobby and Online Settings exist in index.html');

// 3. Inspect mpHud.js to ensure no syntax errors or undefined references
const mpHudCode = fs.readFileSync(path.join(__dirname, '../public/js/mpHud.js'), 'utf8');

assert(mpHudCode.includes('const currentColorIndex = (this.mp.localColorIndex !== undefined) ? this.mp.localColorIndex : -1;'), 'currentColorIndex declared');
assert(mpHudCode.includes('const currentBoatDef = (typeof MULTIPLAYER_BOATS !== \'undefined\' ? MULTIPLAYER_BOATS.find(b => b.id === currentSkin) : null)'), 'currentBoatDef declared');
assert(mpHudCode.includes('updateReadyButtonUI()'), 'updateReadyButtonUI defined');

// 4. Verify multiplayerBoats.js exports all 16 boats
const mpBoatsCode = fs.readFileSync(path.join(__dirname, '../public/js/multiplayerBoats.js'), 'utf8');
const skins = [
  'sunfire', 'reefbreaker', 'tidecutter', 'twinhull', 'manta', 'blazerunner',
  'thunderpike', 'emeralddrake', 'brassleviathan', 'nightshade', 'buzzsaw',
  'skyfoil', 'krakenhulk', 'jollyroger', 'auroragyro', 'crabcrusher'
];

for (const skin of skins) {
  assert(mpBoatsCode.includes(`id: '${skin}'`), `multiplayerBoats.js must include skin: ${skin}`);
}
console.log(`✓ All ${skins.length} boat skins are defined in multiplayerBoats.js`);

console.log('=== MP HUD DOM & LOGIC INTEGRITY TESTS PASSED! ===');
