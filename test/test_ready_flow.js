// test/test_ready_flow.js
// Tests the exact lobby ready / start match toggle flow between host and non-host.
const WebSocket = require('ws');
const assert = require('assert');

const WS_URL = 'ws://localhost:3000';

function connect(name) {
  const ws = new WebSocket(WS_URL);
  const events = [];
  const listeners = [];

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      for (let i = 0; i < listeners.length; i++) {
        if (listeners[i].filter(msg)) {
          const fn = listeners.splice(i, 1)[0].resolve;
          fn(msg);
          return;
        }
      }
      events.push(msg);
    } catch (e) {
      console.error(e);
    }
  });

  function waitFor(filter, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      const idx = events.findIndex(filter);
      if (idx !== -1) return resolve(events.splice(idx, 1)[0]);
      const timer = setTimeout(() => reject(new Error(`[${name}] Timeout`)), timeoutMs);
      listeners.push({ filter, resolve: (m) => { clearTimeout(timer); resolve(m); } });
    });
  }

  function send(msg) {
    ws.send(JSON.stringify(msg));
  }

  const readyPromise = new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });

  return { name, ws, send, waitFor, ready: () => readyPromise };
}

async function run() {
  console.log('Testing Ready Flow between Host and Non-Host...');
  const host = connect('Host');
  await host.ready();

  host.send({ type: 'createRoom', name: 'Host' });
  const created = await host.waitFor(m => m.type === 'roomCreated');
  assert.strictEqual(created.isHost, true);
  assert.strictEqual(created.players[0].isHost, true);
  assert.strictEqual(created.players[0].ready, true);
  console.log('✓ Host created room with isHost: true and ready: true');

  const guest = connect('Guest');
  await guest.ready();
  guest.send({ type: 'joinRoom', roomCode: created.code, name: 'Guest' });
  const joined = await guest.waitFor(m => m.type === 'roomJoined');
  assert.strictEqual(joined.isHost, false);
  const guestInJoined = joined.players.find(p => p.id === joined.playerId);
  assert.strictEqual(guestInJoined.isHost, false);
  assert.strictEqual(guestInJoined.ready, false);
  console.log('✓ Guest joined room with isHost: false and ready: false');

  // Host sees guest joined as unready
  const hostPlayerJoined = await host.waitFor(m => m.type === 'playerJoined');
  const guestInHostList = hostPlayerJoined.players.find(p => p.id === joined.playerId);
  assert.strictEqual(guestInHostList.ready, false);
  console.log('✓ Host sees Guest in player list with ready: false (red dot)');

  // Guest clicks Ready
  guest.send({ type: 'setReady', ready: true });

  // Host receives ready update
  const hostSeesReady = await host.waitFor(m => m.type === 'playerReadyUpdate' && m.id === joined.playerId);
  assert.strictEqual(hostSeesReady.ready, true);
  const guestInUpdatedList = hostSeesReady.players.find(p => p.id === joined.playerId);
  assert.strictEqual(guestInUpdatedList.ready, true);
  console.log('✓ Host received playerReadyUpdate with Guest ready: true (green dot)');

  // Guest clicks Cancel Ready
  guest.send({ type: 'setReady', ready: false });
  const hostSeesUnready = await host.waitFor(m => m.type === 'playerReadyUpdate' && m.id === joined.playerId && m.ready === false);
  assert.strictEqual(hostSeesUnready.ready, false);
  console.log('✓ Guest canceled ready: Host received ready: false (red dot)');

  // Guest clicks Ready again
  guest.send({ type: 'setReady', ready: true });
  await host.waitFor(m => m.type === 'playerReadyUpdate' && m.id === joined.playerId && m.ready === true);
  console.log('✓ Guest readied up again: Host received ready: true');

  // Host starts match successfully
  host.send({ type: 'startMatch' });
  const countdown = await guest.waitFor(m => m.type === 'countdownStart');
  assert.strictEqual(countdown.seconds, 3);
  console.log('✓ Host successfully started match after Guest readied up!');

  host.ws.close();
  guest.ws.close();
  console.log('=== ALL READY FLOW TESTS PASSED! ===');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
