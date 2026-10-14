// server/ai_bot.js
// Autonomous AI opponent that joins any multiplayer room and battles human players.
// Usage: node server/ai_bot.js <ROOM_CODE> [BOT_NAME]

const WebSocket = require('ws');

const roomCode = (process.argv[2] || '').trim().toUpperCase();
const botName = (process.argv[3] || 'DeepSea_AI').slice(0, 16);

if (!roomCode) {
  console.error('Usage: node server/ai_bot.js <ROOM_CODE> [BOT_NAME]');
  process.exit(1);
}

const WS_URL = process.env.BOT_WS_URL || 'ws://localhost:3000';
console.log(`[Bot] Connecting to ${WS_URL}...`);

const ws = new WebSocket(WS_URL);

let myId = null;
let myColor = null;
let matchState = 'lobby';
let alive = true;
let hp = 100;
let lifeId = 1;

// Position & dynamics
let x = 0, z = -2, yaw = 0, speed = 0, boosting = false;
let boostEnergy = 8.0;
let gunTimer = 0;
let missileTimer = 4.0;
let respawnTimer = 0;

// Target player (first remote human)
let target = null;
const remotePlayers = new Map(); // id -> { id, name, x, z, yaw, hp, alive }

const TAU = Math.PI * 2;
const angleDiff = (a, b) => ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

ws.on('open', () => {
  console.log(`[Bot] Connected! Joining room ${roomCode} as "${botName}"...`);
  ws.send(JSON.stringify({ type: 'joinRoom', roomCode, name: botName }));
});

ws.on('message', (raw) => {
  try {
    const msg = JSON.parse(raw.toString());
    handleMessage(msg);
  } catch (e) {
    console.error('[Bot] Message error:', e);
  }
});

function handleMessage(msg) {
  switch (msg.type) {
    case 'roomJoined': {
      myId = msg.playerId;
      myColor = msg.color;
      matchState = msg.matchState || 'lobby';
      console.log(`[Bot] Successfully joined room ${roomCode}! Assigned Color: ${myColor?.name || 'Cyan'} (id: ${myId})`);
      if (msg.spawn) {
        x = msg.spawn.x;
        z = msg.spawn.z;
        yaw = msg.spawn.yaw;
      }
      for (const p of msg.players || []) {
        if (p.id !== myId) {
          remotePlayers.set(p.id, { id: p.id, name: p.name, x: p.spawn?.x || 0, z: p.spawn?.z || 0, hp: 100, alive: true });
        }
      }
      break;
    }

    case 'playerJoined': {
      if (msg.player && msg.player.id !== myId) {
        console.log(`[Bot] Human player joined: ${msg.player.name}`);
        remotePlayers.set(msg.player.id, {
          id: msg.player.id,
          name: msg.player.name,
          x: msg.player.spawn?.x || 0,
          z: msg.player.spawn?.z || 0,
          hp: 100,
          alive: true
        });
      }
      break;
    }

    case 'playerLeft': {
      remotePlayers.delete(msg.id);
      break;
    }

    case 'countdownStart': {
      console.log(`[Bot] Match countdown started: ${msg.seconds}s... Ready battle stations!`);
      matchState = 'countdown';
      break;
    }

    case 'matchStarted': {
      console.log('[Bot] MATCH STARTED! Engaging players in combat!');
      matchState = 'playing';
      alive = true;
      hp = 100;
      if (msg.spawns) {
        for (const sp of msg.spawns) {
          if (sp.id === myId) {
            x = sp.spawn.x;
            z = sp.spawn.z;
            yaw = sp.spawn.yaw;
            speed = 0;
          } else if (remotePlayers.has(sp.id)) {
            const rp = remotePlayers.get(sp.id);
            rp.x = sp.spawn.x;
            rp.z = sp.spawn.z;
          }
        }
      }
      break;
    }

    case 'remoteState': {
      const rp = remotePlayers.get(msg.id);
      if (rp) {
        const s = msg.state || msg.data || msg;
        rp.x = s.x;
        rp.z = s.z;
        rp.yaw = s.yaw;
        rp.speed = s.speed;
        rp.hp = s.hp !== undefined ? s.hp : rp.hp;
        rp.alive = s.alive !== undefined ? s.alive : rp.alive;
      }
      break;
    }

    case 'remoteHit': {
      if (msg.victimId === myId) {
        hp = Math.max(0, msg.hp);
        console.log(`[Bot] Ouch! Hit by ${msg.attackerName || 'human'} for ${Math.round(msg.dmg)} dmg! Current HP: ${Math.round(hp)}`);
        if (hp <= 0 && alive) {
          die(msg.attackerId);
        }
      } else if (remotePlayers.has(msg.victimId)) {
        remotePlayers.get(msg.victimId).hp = msg.hp;
      }
      break;
    }

    case 'playerDied': {
      if (msg.victimId === myId) {
        console.log(`[Bot] Sunk by ${msg.killerName}! Respawning soon...`);
        die(msg.killerId);
      } else if (remotePlayers.has(msg.victimId)) {
        remotePlayers.get(msg.victimId).alive = false;
        console.log(`[Bot] Saw ${msg.victimName} get sunk by ${msg.killerName}!`);
      }
      break;
    }

    case 'playerRespawned': {
      if (msg.id === myId) {
        alive = true;
        hp = 100;
        x = msg.x;
        z = msg.z;
        yaw = msg.yaw;
        speed = 0;
        console.log('[Bot] Back in the water! Ready to fight!');
      } else if (remotePlayers.has(msg.id)) {
        const rp = remotePlayers.get(msg.id);
        rp.alive = true;
        rp.hp = 100;
        rp.x = msg.x;
        rp.z = msg.z;
      }
      break;
    }

    case 'matchOver': {
      matchState = 'finished';
      console.log(`[Bot] Match Over! Winner is ${msg.winnerName} with ${msg.winnerKills} kills! GG!`);
      break;
    }

    case 'matchReset': {
      matchState = 'countdown';
      alive = true;
      hp = 100;
      speed = 0;
      console.log('[Bot] Match reset for a new game! Resetting stats.');
      break;
    }

    case 'error': {
      console.error(`[Bot Error]: ${msg.message}`);
      break;
    }
  }
}

function die(killerId) {
  if (!alive) return;
  alive = false;
  hp = 0;
  speed = 0;
  respawnTimer = 3.0;
  ws.send(JSON.stringify({ type: 'died', by: killerId || null, lifeId }));
  lifeId++;
}

// Bot physics and AI steering loop (20 Hz)
const TICK_RATE = 20;
const dt = 1 / TICK_RATE;

setInterval(() => {
  if (ws.readyState !== 1) return;

  // Handle respawn timer
  if (!alive) {
    respawnTimer -= dt;
    if (respawnTimer <= 0) {
      alive = true;
      hp = 100;
      // Respawn near world spawn or starting spot
      const spawnX = (Math.random() - 0.5) * 160;
      const spawnZ = (Math.random() - 0.5) * 160;
      const spawnYaw = Math.random() * TAU;
      x = spawnX;
      z = spawnZ;
      yaw = spawnYaw;
      speed = 0;
      ws.send(JSON.stringify({ type: 'respawn', x, z, yaw }));
    }
    return;
  }

  // Find nearest human target
  let bestTarget = null;
  let bestDist = 1e9;
  for (const p of remotePlayers.values()) {
    if (!p.alive) continue;
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bestDist) {
      bestDist = d;
      bestTarget = p;
    }
  }
  target = bestTarget;

  // Steering AI
  if (target && matchState === 'playing') {
    const wantAngle = Math.atan2(target.x - x, target.z - z);
    const diff = angleDiff(yaw, wantAngle);

    // Steer towards target
    yaw += clamp(diff, -2.4 * dt, 2.4 * dt);

    // Throttle & speed dynamics
    if (bestDist > 45) {
      // Cruise full speed towards human
      speed = Math.min(105, speed + 35 * dt);
      boosting = bestDist > 110;
    } else if (bestDist < 20) {
      // Too close: brake / turn to circle around
      speed = Math.max(30, speed - 50 * dt);
      yaw += 0.8 * dt;
      boosting = false;
    } else {
      // Good dogfighting range (20-45 units)
      speed = Math.min(85, speed + 20 * dt);
      boosting = false;
    }

    // Weapons AI: Fire gun when nose is pointing within 22 degrees of player
    gunTimer -= dt;
    if (Math.abs(diff) < 0.38 && bestDist < 110) {
      if (gunTimer <= 0) {
        gunTimer = 0.12; // ~8 shots per second
        const fireSpeed = 240 + speed;
        ws.send(JSON.stringify({
          type: 'fire',
          weapon: 'gun',
          x,
          z,
          yaw,
          speed: fireSpeed,
        }));

        // AI also predicts hits when in close range (< 55 units) and nose on target
        if (bestDist < 55 && Math.random() < 0.65) {
          ws.send(JSON.stringify({
            type: 'dealDamage',
            targetId: target.id,
            dmg: 3.6,
          }));
        }
      }
    }

    // Missile AI: Fire homing missile every 6.5s when within lock range
    missileTimer -= dt;
    if (missileTimer <= 0 && bestDist < 130 && Math.abs(diff) < 0.55) {
      missileTimer = 6.5;
      ws.send(JSON.stringify({
        type: 'fire',
        weapon: 'missile',
        x,
        z,
        yaw,
        speed: 120,
        targetId: target.id,
      }));

      // Simulate missile impact damage after flight travel time
      const flightTimeSec = Math.max(0.6, bestDist / 90);
      setTimeout(() => {
        if (target && target.alive && matchState === 'playing') {
          ws.send(JSON.stringify({
            type: 'dealDamage',
            targetId: target.id,
            dmg: 45,
          }));
        }
      }, flightTimeSec * 1000);
    }
  } else {
    // Roam / patrol around in circles waiting for match or player
    yaw += 0.5 * dt;
    speed = Math.min(50, speed + 15 * dt);
    boosting = false;
  }

  // Move forward
  x += Math.sin(yaw) * speed * dt;
  z += Math.cos(yaw) * speed * dt;

  // Broadcast state at 20 Hz
  ws.send(JSON.stringify({
    type: 'state',
    x: Math.round(x * 10) / 10,
    z: Math.round(z * 10) / 10,
    yaw: Math.round(yaw * 100) / 100,
    speed: Math.round(speed),
    boosting,
    hp: Math.round(hp),
    alive,
  }));
}, 1000 / TICK_RATE);

ws.on('close', () => {
  console.log('[Bot] Disconnected from server.');
  process.exit(0);
});

ws.on('error', (err) => {
  console.error('[Bot] Connection error:', err.message);
});
