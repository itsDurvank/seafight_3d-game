import { readFileSync } from 'fs';

console.log('--- Testing Online Match Settings View Architecture ---');

// 1. Verify index.html structure
const html = readFileSync('public/index.html', 'utf8');

if (!html.includes('id="settings-offline-view"')) {
  throw new Error('index.html is missing #settings-offline-view');
}
console.log('✓ index.html contains #settings-offline-view');

if (!html.includes('id="settings-online-view"')) {
  throw new Error('index.html is missing #settings-online-view');
}
console.log('✓ index.html contains #settings-online-view');

if (!html.includes('id="settings-online-player-name"')) {
  throw new Error('index.html is missing #settings-online-player-name');
}
console.log('✓ index.html contains #settings-online-player-name');

if (!html.includes('id="settings-online-boat-picker"')) {
  throw new Error('index.html is missing #settings-online-boat-picker');
}
console.log('✓ index.html contains #settings-online-boat-picker');

if (!html.includes('id="settings-online-leave-btn"')) {
  throw new Error('index.html is missing #settings-online-leave-btn');
}
console.log('✓ index.html contains #settings-online-leave-btn');

// 2. Verify mpHud.js boat picker and leave handler
const mpHud = readFileSync('public/js/mpHud.js', 'utf8');

if (!mpHud.includes('renderSettingsBoatPicker()') || !mpHud.includes('settings-online-boat-picker')) {
  throw new Error('mpHud.js is missing renderSettingsBoatPicker');
}
console.log('✓ mpHud.js implements renderSettingsBoatPicker for in-match skin selection');

if (!mpHud.includes('this.elSettingsOnlineLeaveBtn')) {
  throw new Error('mpHud.js does not wire elSettingsOnlineLeaveBtn');
}
console.log('✓ mpHud.js wires elSettingsOnlineLeaveBtn to leave room handler');

// 3. Verify main.js dynamic view switching
const main = readFileSync('public/js/main.js', 'utf8');

if (!main.includes("const isOnlineInRoom = !!(mp && mp.mode === 'online' && mp.roomCode);")) {
  throw new Error('main.js does not dynamically detect online room state in updateSettingsUI');
}
console.log('✓ main.js dynamically detects online room status in updateSettingsUI');

if (!main.includes("offlineView.classList.add('hidden')") || !main.includes("onlineView.classList.remove('hidden')")) {
  throw new Error('main.js does not toggle between offlineView and onlineView');
}
console.log('✓ main.js switches between offline settings and match settings views');

console.log('\n=== ALL ONLINE SETTINGS VIEW TESTS PASSED! ===');
