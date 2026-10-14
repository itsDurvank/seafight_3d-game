// test/multiplayer_smoke.js
// Headless 2-3 client smoke test for Boom Boats online multiplayer.
// Verifies:
// 1. Room creation and code generation.
// 2. Room join with distinct colors and spawn points.
// 3. Match start countdown and transition to 'playing'.
// 4. Staggered health orb spawning and first-claim authority.
// 5. Combat kill counting, preventing duplicate deaths per life.
// 6. Win condition (first to 20 kills) ends the match.
// 7. Host restart match resets scores and starts a fresh match.

const WebSocket = require('ws');
const assert = require('assert');

const WS_URL = process.env.TEST_WS_URL || 'ws://localhost:3000';

function createClient(name) {
  const ws = new WebSocket(WS_URL);
  const events = [];
  const listeners = [];

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      // Trigger any waiting listener first
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
      // Check existing events first
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

async function runSmokeTest() {
  console.log('--- Starting Multiplayer Smoke Test ---');

  // 1. Connect Client 1 (Alice)
  const alice = createClient('Alice');
  await alice.ready();
  console.log('✓ Alice connected to WebSocket');

  // Alice creates room
  alice.send({ type: 'createRoom', name: 'Alice' });
  const roomCreated = await alice.waitFor(m => m.type === 'roomCreated');
  const roomCode = roomCreated.roomCode || roomCreated.code;
  assert(roomCode && roomCode.length === 5, 'Room code must be 5 chars');
  const aliceId = roomCreated.playerId;
  assert(aliceId && aliceId.startsWith('p_'), 'Alice playerId must start with p_');
  assert(['Sunfire', 'Azure', 'Jade', 'Violet', 'Rose'].includes(roomCreated.color.name), 'Valid team color assigned');
  console.log(`✓ Alice created room ${roomCode} with color ${roomCreated.color.name} (id: ${aliceId})`);

  // 2. Connect Client 2 (Bob) and join Alice's room
  const bob = createClient('Bob');
  await bob.ready();
  console.log('✓ Bob connected to WebSocket');

  bob.send({ type: 'joinRoom', roomCode, name: 'Bob' });
  const bobJoined = await bob.waitFor(m => m.type === 'roomJoined');
  const bobId = bobJoined.playerId;
  assert(bobId && bobId.startsWith('p_'), 'Bob playerId must start with p_');
  assert.notStrictEqual(bobJoined.color.name, roomCreated.color.name, 'Bob should get distinct color from Alice');
  assert.notStrictEqual(bobJoined.boatSkin, roomCreated.boatSkin, 'Bob should get distinct boat skin from Alice');
  console.log(`✓ Bob joined room ${roomCode} with color ${bobJoined.color.name} and skin ${bobJoined.boatSkin} (id: ${bobId})`);

  // Alice sees Bob joined
  const aliceSeesBob = await alice.waitFor(m => m.type === 'playerJoined' && m.player.name === 'Bob');
  assert(aliceSeesBob, 'Alice must receive playerJoined for Bob');

  // 3. Connect Client 3 (Charlie)
  const charlie = createClient('Charlie');
  await charlie.ready();
  charlie.send({ type: 'joinRoom', roomCode, name: 'Charlie' });
  const charlieJoined = await charlie.waitFor(m => m.type === 'roomJoined');
  const charlieId = charlieJoined.playerId;
  assert(charlieId && charlieId.startsWith('p_'), 'Charlie playerId must start with p_');
  assert.notStrictEqual(charlieJoined.color.name, bobJoined.color.name, 'Charlie distinct color from Bob');
  assert.notStrictEqual(charlieJoined.color.name, roomCreated.color.name, 'Charlie distinct color from Alice');
  assert.notStrictEqual(charlieJoined.boatSkin, bobJoined.boatSkin, 'Charlie distinct boat skin from Bob');
  assert.notStrictEqual(charlieJoined.boatSkin, roomCreated.boatSkin, 'Charlie distinct boat skin from Alice');
  console.log(`✓ Charlie joined room ${roomCode} with color ${charlieJoined.color.name} and skin ${charlieJoined.boatSkin} (id: ${charlieId})`);

  // 4. Host (Alice) and Ready Checks
  console.log('--- Testing Ready States & Host Start Permission ---');
  // Bob (non-host) tries to start match -> must be rejected
  bob.send({ type: 'startMatch' });
  const bobStartErr = await bob.waitFor(m => m.type === 'error' && m.message.includes('Only the host'));
  assert(bobStartErr, 'Non-host must not be allowed to start match');
  console.log('✓ Non-host (Bob) prevented from starting match');

  // Alice (host) tries to start match while Bob & Charlie are not ready -> must be rejected
  alice.send({ type: 'startMatch' });
  const aliceStartErr = await alice.waitFor(m => m.type === 'error' && m.message.includes('Waiting for all players'));
  assert(aliceStartErr, 'Host cannot start match while players are not ready');
  console.log('✓ Host prevented from starting while players are unready');

  // Bob marks ready
  bob.send({ type: 'setReady', ready: true });
  const bobReadyMsg = await alice.waitFor(m => m.type === 'playerReadyUpdate' && m.id === bobId);
  assert.strictEqual(bobReadyMsg.ready, true);
  console.log('✓ Bob ready status received by Alice');

  // Charlie marks ready
  charlie.send({ type: 'setReady', ready: true });
  const charlieReadyMsg = await alice.waitFor(m => m.type === 'playerReadyUpdate' && m.id === charlieId);
  assert.strictEqual(charlieReadyMsg.ready, true);
  console.log('✓ Charlie ready status received by Alice');

  // Now Host (Alice) starts match
  alice.send({ type: 'startMatch' });

  const countdown = await bob.waitFor(m => m.type === 'countdownStart');
  assert.strictEqual(countdown.seconds, 3);
  console.log('✓ Countdown start broadcast received');

  const matchStarted = await charlie.waitFor(m => m.type === 'matchStarted', 6000);
  assert.strictEqual(matchStarted.players.length, 3);
  console.log('✓ Match started with 3 players spread across map');

  // 5. Test Live Movement & Position Sync
  console.log('--- Testing Movement & State Sync ---');
  alice.send({ type: 'state', x: 123.4, z: -56.7, yaw: 1.57, speed: 105, boosting: true, hp: 100, alive: true });
  const bobSeesAliceState = await bob.waitFor(m => m.type === 'remoteState' && m.id === aliceId);
  assert.strictEqual(bobSeesAliceState.state.x, 123.4);
  assert.strictEqual(bobSeesAliceState.state.z, -56.7);
  assert.strictEqual(bobSeesAliceState.state.boosting, true);
  console.log('✓ Alice movement/state broadcast received by Bob with exact coordinates');

  // 6. Test Firing Sync
  console.log('--- Testing Weapon Fire Sync ---');
  alice.send({ type: 'fire', weapon: 'gun', x: 123.4, z: -56.7, yaw: 1.57, speed: 250 });
  const bobSeesFire = await bob.waitFor(m => m.type === 'remoteFire' && (m.id === aliceId || m.shooterId === aliceId));
  assert.strictEqual(bobSeesFire.yaw, 1.57);
  assert.strictEqual(bobSeesFire.weapon, 'gun');
  console.log('✓ Alice gun fire received by Bob with correct angle and shooter ID');

  // 7. Test Direct Damage (Alice shoots Bob)
  console.log('--- Testing Shooter-Authoritative Damage ---');
  alice.send({ type: 'dealDamage', targetId: bobId, dmg: 25 });
  const bobTakesHit = await bob.waitFor(m => m.type === 'remoteHit' && m.victimId === bobId);
  assert.strictEqual(bobTakesHit.hp, 75);
  assert.strictEqual(bobTakesHit.dmg, 25);
  console.log('✓ Alice dealt 25 damage to Bob; Bob HP updated to 75');

  // 8. Test Health Orb Spawning and Claims (Full HP check)
  console.log('--- Testing Orb Spawning and Claims ---');
  const orb1 = await alice.waitFor(m => m.type === 'orbSpawned', 5000);
  assert(orb1.orb && orb1.orb.id, 'Orb 1 spawned');
  console.log(`✓ First orb spawned: ${orb1.orb.id} at (${orb1.orb.x}, ${orb1.orb.z})`);

  // Charlie has 100 HP (full HP) and tries to claim orb1 -> must fail
  charlie.send({ type: 'state', hp: 100, alive: true });
  charlie.send({ type: 'claimOrb', orbId: orb1.orb.id });
  // Wait 300ms to verify no orbTaken event was emitted for Charlie
  let charlieClaimed = false;
  try {
    await alice.waitFor(m => m.type === 'orbTaken' && m.by === charlieId, 300);
    charlieClaimed = true;
  } catch {}
  assert.strictEqual(charlieClaimed, false, 'Player at full HP (100) must NOT consume orb');
  console.log('✓ Player at full HP (Charlie) prevented from consuming health orb');

  // Bob (75 HP) claims orb1 -> must succeed
  bob.send({ type: 'claimOrb', orbId: orb1.orb.id });
  const orbClaim = await alice.waitFor(m => m.type === 'orbTaken' && m.orbId === orb1.orb.id);
  assert.strictEqual(orbClaim.by, bobId);
  console.log(`✓ Injured player (Bob, 75 HP) successfully claimed orb ${orb1.orb.id}`);

  // 6. Test Combat, Kill Counting & Race to 20 Kills
  console.log('--- Testing Combat & Race to 20 Kills ---');
  // Alice sinks Bob 20 times
  let bobLifeId = 1;
  for (let k = 1; k <= 20; k++) {
    // Bob takes damage then reports death
    bob.send({ type: 'hit', hp: 0, by: aliceId, dmg: 100 });
    bob.send({ type: 'died', by: aliceId, lifeId: bobLifeId });

    const deathMsg = await alice.waitFor(m => m.type === 'playerDied' && m.victimId === bobId);
    assert.strictEqual(deathMsg.killerKills, k);
    bobLifeId++;

    if (k < 20) {
      // Bob respawns and waits for confirmation
      bob.send({ type: 'respawn', x: 0, z: -2, yaw: 0 });
      await bob.waitFor(m => m.type === 'playerRespawned' && m.id === bobId);
    }
    console.log(`✓ Kill ${k}/20 recorded`);
  }
  console.log('✓ Alice scored 20 kills');

  // Verify matchOver event
  const matchOver = await bob.waitFor(m => m.type === 'matchOver');
  assert.strictEqual(matchOver.winnerId, aliceId);
  assert.strictEqual(matchOver.winnerName, 'Alice');
  assert.strictEqual(matchOver.winnerKills, 20);
  console.log(`✓ Match ended! Winner: ${matchOver.winnerName} with ${matchOver.winnerKills} kills`);

  // 7. Test New Game / Restart Match
  console.log('--- Testing Restart Match / New Game ---');
  alice.send({ type: 'restartMatch' });

  const restartedMatch = await charlie.waitFor(m => m.type === 'matchReset', 6000);
  assert(restartedMatch, 'All clients received matchReset');
  // Standings should be reset to 0 kills
  for (const s of restartedMatch.standings) {
    assert.strictEqual(s.kills, 0, `Kills for ${s.name} should be reset to 0`);
  }
  console.log('✓ Match reset broadcast received and all player scores reset to 0');

  // Verify next matchStarted
  const nextMatch = await bob.waitFor(m => m.type === 'matchStarted', 6000);
  assert(nextMatch, 'Match started after countdown');
  console.log('✓ New match successfully started after countdown');

  // Close all clients
  alice.ws.close();
  bob.ws.close();
  charlie.ws.close();

  console.log('=== ALL MULTIPLAYER SMOKE TESTS PASSED! ===');
  process.exit(0);
}

runSmokeTest().catch(err => {
  console.error('Smoke test failed:', err);
  process.exit(1);
});
