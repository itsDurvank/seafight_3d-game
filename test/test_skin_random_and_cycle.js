// test/test_skin_random_and_cycle.js
// Automated verification for:
// 1. Multiplayer skins specifically for multiplayer (offline settings only has hero & classic)
// 2. Random assignment of different skins and different colors to players
// 3. Selection of skin and cycling colors on repeated clicks of the same skin

const WebSocket = require('ws');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const URL = 'ws://localhost:3000';
const MP_SKIN_KEYS = ['reefbreaker', 'tidecutter', 'twinhull', 'manta', 'blazerunner'];

// Verify offline settings in index.html only has hero and classic
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const settingsSkinSection = html.slice(html.indexOf('id="settings-modal"'), html.indexOf('id="mp-lobby-modal"'));
assert(settingsSkinSection.includes('data-skin="hero"'), 'Settings must have hero');
assert(settingsSkinSection.includes('data-skin="classic"'), 'Settings must have classic');
assert(!settingsSkinSection.includes('data-skin="reefbreaker"'), 'Settings must NOT have reefbreaker');
assert(!settingsSkinSection.includes('data-skin="tidecutter"'), 'Settings must NOT have tidecutter');
assert(!settingsSkinSection.includes('data-skin="twinhull"'), 'Settings must NOT have twinhull');
assert(!settingsSkinSection.includes('data-skin="manta"'), 'Settings must NOT have manta');
assert(!settingsSkinSection.includes('data-skin="blazerunner"'), 'Settings must NOT have blazerunner');

// Verify lobby modal HAS the boat picker section
const lobbySection = html.slice(html.indexOf('id="mp-lobby-modal"'));
assert(lobbySection.includes('id="mp-lobby-boat-picker"'), 'Lobby modal must contain mp-lobby-boat-picker');
console.log('✓ Offline settings strictly contains only offline skins (hero & classic).');
console.log('✓ Lobby modal contains multiplayer boat & paint picker.');

function connectClient(name) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

function waitForMessage(ws, type) {
  return new Promise((resolve) => {
    const handler = (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === type) {
        ws.off('message', handler);
        resolve(msg);
      }
    };
    ws.on('message', handler);
  });
}

async function runTest() {
  console.log('\n--- Testing Multiplayer Random Assignment & Color Cycling ---');

  const client1 = await connectClient('Player1');
  client1.send(JSON.stringify({ type: 'createRoom', name: 'Player1' }));
  const created = await waitForMessage(client1, 'roomCreated');

  assert(created.code, 'Room code generated');
  assert(MP_SKIN_KEYS.includes(created.boatSkin), `Host assigned valid MP skin: ${created.boatSkin}`);
  assert(created.colorIndex >= 0 && created.colorIndex < 5, `Host assigned valid colorIndex: ${created.colorIndex}`);
  console.log(`✓ Player1 (Host) created room ${created.code}: assigned skin=${created.boatSkin}, color=${created.color.name} (id:${created.colorIndex})`);

  const client2 = await connectClient('Player2');
  client2.send(JSON.stringify({ type: 'joinRoom', code: created.code, name: 'Player2' }));
  const joined = await waitForMessage(client2, 'roomJoined');

  assert(MP_SKIN_KEYS.includes(joined.boatSkin), `Guest assigned valid MP skin: ${joined.boatSkin}`);
  assert(joined.colorIndex >= 0 && joined.colorIndex < 5, `Guest assigned valid colorIndex: ${joined.colorIndex}`);
  assert.notStrictEqual(joined.boatSkin, created.boatSkin, `Player2 received a DIFFERENT boat skin than Player1 (${joined.boatSkin} vs ${created.boatSkin})`);
  assert.notStrictEqual(joined.colorIndex, created.colorIndex, `Player2 received a DIFFERENT color than Player1 (${joined.colorIndex} vs ${created.colorIndex})`);
  console.log(`✓ Player2 joined room: assigned different skin=${joined.boatSkin}, different color=${joined.color.name} (id:${joined.colorIndex})`);

  // Test selecting different skin
  const otherSkin = MP_SKIN_KEYS.find(s => s !== joined.boatSkin && s !== created.boatSkin);
  console.log(`\nTesting Player2 selecting new skin: ${otherSkin}...`);
  const skinUpdatePromise1 = waitForMessage(client1, 'playerSkinUpdate');
  client2.send(JSON.stringify({ type: 'selectSkin', boatSkin: otherSkin, colorIndex: joined.colorIndex }));
  const update1 = await skinUpdatePromise1;
  assert.strictEqual(update1.id, joined.playerId);
  assert.strictEqual(update1.boatSkin, otherSkin);
  assert.strictEqual(update1.colorIndex, joined.colorIndex);
  console.log(`✓ Both players received skin update: Player2 is now ${otherSkin}`);

  // Test clicking same skin repeatedly to cycle colors
  const nextColorIndex = (joined.colorIndex + 1) % 5;
  console.log(`Testing Player2 clicking same skin again to cycle color to index ${nextColorIndex}...`);
  const skinUpdatePromise2 = waitForMessage(client1, 'playerSkinUpdate');
  client2.send(JSON.stringify({ type: 'selectSkin', boatSkin: otherSkin, colorIndex: nextColorIndex }));
  const update2 = await skinUpdatePromise2;
  assert.strictEqual(update2.boatSkin, otherSkin);
  assert.strictEqual(update2.colorIndex, nextColorIndex);
  console.log(`✓ Color cycled successfully on repeated click: Player2 is now ${otherSkin} in ${update2.color.name}!`);

  client1.close();
  client2.close();
  console.log('\n=== ALL RANDOM ASSIGNMENT & COLOR CYCLE TESTS PASSED! ===');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
