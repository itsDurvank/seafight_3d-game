const WebSocket = require('ws');
const assert = require('assert');

const WS_URL = 'ws://localhost:3000';

function createClient(name) {
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
      console.error(`[${name}] Failed to parse message:`, data.toString());
    }
  });

  function waitFor(filter, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      const existingIdx = events.findIndex(filter);
      if (existingIdx !== -1) {
        return resolve(events.splice(existingIdx, 1)[0]);
      }
      const timer = setTimeout(() => {
        reject(new Error(`[${name}] Timeout waiting for message matching condition`));
      }, timeoutMs);

      listeners.push({
        filter,
        resolve: (msg) => {
          clearTimeout(timer);
          resolve(msg);
        }
      });
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

async function runTest() {
  console.log('--- Testing HP Stability & Desync Prevention ---');
  const alice = createClient('Alice');
  await alice.ready();

  alice.send({ type: 'createRoom', name: 'Alice' });
  const roomCreated = await alice.waitFor(m => m.type === 'roomCreated');
  const roomCode = roomCreated.roomCode;
  const aliceId = roomCreated.playerId;

  const bob = createClient('Bob');
  await bob.ready();
  bob.send({ type: 'joinRoom', roomCode, name: 'Bob' });
  const bobJoined = await bob.waitFor(m => m.type === 'roomJoined');
  const bobId = bobJoined.playerId;

  // Ready and start
  bob.send({ type: 'setReady', ready: true });
  await alice.waitFor(m => m.type === 'playerReadyUpdate' && m.id === bobId);
  alice.send({ type: 'startMatch' });
  await alice.waitFor(m => m.type === 'matchStarted', 10000);
  console.log('✓ Match started');

  // Step 1: Alice hits Bob with missile for 32 damage
  alice.send({ type: 'dealDamage', targetId: bobId, dmg: 32 });
  const hit1 = await bob.waitFor(m => m.type === 'remoteHit' && m.victimId === bobId);
  assert.strictEqual(hit1.hp, 68, 'Bob HP should cleanly be 68');
  console.log(`✓ Step 1: Hit 1 cleanly reduced HP to 68`);

  // Step 2: Bob sends stale state with hp: 72 (simulating out-of-order client packet)
  bob.send({
    type: 'state',
    x: 0,
    z: 0,
    yaw: 0,
    speed: 10,
    hp: 72,
  });

  // Wait a moment for server to process state
  await new Promise(r => setTimeout(r, 100));

  // Step 3: Bob sends non-fatal 'hit' message with hp: 72
  bob.send({
    type: 'hit',
    dmg: 28,
    hp: 72,
    by: aliceId,
  });

  // Wait a moment
  await new Promise(r => setTimeout(r, 100));

  // Step 4: Alice deals 4 more damage (bullet hit)
  alice.send({ type: 'dealDamage', targetId: bobId, dmg: 4 });
  const hit2 = await bob.waitFor(m => m.type === 'remoteHit' && m.victimId === bobId);
  assert.strictEqual(hit2.hp, 64, 'Bob HP should cleanly be 64 (not bounced to 72 or 69)');
  console.log(`✓ Step 4: Second hit reduced HP to 64; stale state/hit packets were correctly ignored!`);

  console.log('=== HP DESYNC & FLUCTUATION TEST PASSED! ===');
  alice.ws.close();
  bob.ws.close();
  process.exit(0);
}

runTest().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
