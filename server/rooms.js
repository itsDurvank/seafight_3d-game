// server/rooms.js
// Server-authoritative room, match, combat, and health-orb management for Boom Boats multiplayer.

const { WebSocketServer } = require('ws');

// Single source of truth for multiplayer server constants (mirrors MP in config.js)
const MP_CONFIG = {
  winKills: 20,
  maxPlayers: 5,
  minPlayersToStart: 2,
  countdownSeconds: 3,
  batchSize: 4,
  intraBatchDelay: [1, 10], // 1-10s random delay between orbs in a batch
  batchPause: [10, 15],     // 10-15s pause after all 4 orbs are claimed/expired before next batch
  orbLifetime: 95,          // seconds before an unclaimed orb expires
  maxNameLength: 16,
  rateLimitMsgsPerSec: 60,
  colors: [
    { id: 0, name: 'Sunfire', hex: '#ff7a59', icon: '🔥', style: { hull: 0xff7a59, chine: 0xdce5e8, accent: 0xffe066, roof: 0xd9532f, flag: 0xffe066, cabin: 0xfff4e0, dark: 0x2b3440, neon: 0xff7a59 } },
    { id: 1, name: 'Azure', hex: '#1fd1c9', icon: '💧', style: { hull: 0x1fd1c9, chine: 0xb5dff5, accent: 0x69c0ff, roof: 0x0fa8a0, flag: 0xbae7ff, cabin: 0xe6f7ff, dark: 0x1b2838, neon: 0x40a9ff } },
    { id: 2, name: 'Jade', hex: '#1fb36b', icon: '🌿', style: { hull: 0x1fb36b, chine: 0xc6f6d5, accent: 0xa7f3d0, roof: 0x137948, flag: 0xd9f99d, cabin: 0xf0fff4, dark: 0x1c3326, neon: 0x48bb78 } },
    { id: 3, name: 'Violet', hex: '#9a86ff', icon: '⚡', style: { hull: 0x9a86ff, chine: 0xdcd0ff, accent: 0xf472b6, roof: 0x6941c6, flag: 0xe9d5ff, cabin: 0xf8f5ff, dark: 0x2e1b4d, neon: 0xc084fc } },
    { id: 4, name: 'Rose', hex: '#ff7aa8', icon: '🌸', style: { hull: 0xff7aa8, chine: 0xfcc7d8, accent: 0xffd1dc, roof: 0xd6336c, flag: 0xffe4e6, cabin: 0xfff0f5, dark: 0x3d1d2b, neon: 0xf06595 } },
  ],
  spawns: [
    { x: 0, z: -2, yaw: 0 },         // Harbor
    { x: -95, z: 85, yaw: 2.2 },     // Mango Isle bay
    { x: 90, z: 130, yaw: 0.8 },     // Coral Bay
    { x: -60, z: -150, yaw: -1.2 },  // Violet Lagoon
    { x: 190, z: -20, yaw: -2.5 },   // Jade Cove
  ],
};

const MP_SKIN_KEYS = ['reefbreaker', 'tidecutter', 'twinhull', 'manta', 'blazerunner'];

const WORLD_LAYOUT = {
  radius: 520,
  safeHarbor: { x: 0, z: -2, r: 34 },
  islands: [
    { x: 75, z: -55, r: 26 },
    { x: -130, z: 62, r: 24 },
    { x: 115, z: 155, r: 28 },
    { x: -82, z: -178, r: 26 },
    { x: 225, z: -28, r: 24 },
    { x: -232, z: -62, r: 30 },
    { x: -40, z: 232, r: 30 },
    { x: -205, z: -190, r: 28 },
    { x: 250, z: -190, r: 26 },
    { x: 250, z: 170, r: 27 },
    { x: -250, z: 200, r: 28 },
  ]
};

const CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // 31 unambiguous uppercase chars

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

function sanitizeName(raw) {
  if (typeof raw !== 'string') return 'Captain';
  // Strip HTML tags and non-printable characters
  const clean = raw.replace(/<[^>]*>/g, '').replace(/[^\x20-\x7E\u00A0-\u024F]/g, '').trim();
  return clean.slice(0, MP_CONFIG.maxNameLength) || 'Captain';
}

function generateRoomCode(existingRooms) {
  for (let attempt = 0; attempt < 5000; attempt++) {
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    if (!existingRooms.has(code)) return code;
  }
  return String(Date.now()).slice(-5);
}

function isFreeWater(x, z, existingOrbs = []) {
  if (Math.hypot(x, z) > WORLD_LAYOUT.radius - 85) return false;
  const h = WORLD_LAYOUT.safeHarbor;
  if (Math.hypot(x - h.x, z - h.z) < h.r + 20) return false;
  for (const isl of WORLD_LAYOUT.islands) {
    if (Math.hypot(x - isl.x, z - isl.z) < isl.r + 32) return false;
  }
  for (const o of existingOrbs) {
    if (Math.hypot(x - o.x, z - o.z) < 80) return false;
  }
  return true;
}

function findOrbPosition(existingOrbs) {
  for (let i = 0; i < 150; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = rand(60, WORLD_LAYOUT.radius - 95);
    const x = Math.round(Math.cos(a) * r);
    const z = Math.round(Math.sin(a) * r);
    if (isFreeWater(x, z, existingOrbs)) return { x, z };
  }
  return { x: Math.round(rand(-120, 120)), z: Math.round(rand(-120, 120)) };
}

class Room {
  constructor(code, hostWs, hostId, hostName, roomManager) {
    this.code = code;
    this.roomManager = roomManager;
    this.hostId = hostId;
    this.state = 'lobby'; // 'lobby' | 'countdown' | 'playing' | 'finished'
    this.players = new Map(); // id -> Player
    this.orbs = new Map(); // orbId -> { id, x, z, spawnTime }
    this.orbSeq = 1;
    this.batchIndex = 0;
    this.batchTimeouts = [];
    this.batchOrbsRemaining = 0;
    this.countdownTimer = null;
    this.winner = null;

    // Add host
    this.addPlayer(hostWs, hostId, hostName);
  }

  getFreeColorIndex() {
    const used = new Set([...this.players.values()].map(p => p.colorIndex));
    const available = [];
    for (let i = 0; i < MP_CONFIG.colors.length; i++) {
      if (!used.has(i)) available.push(i);
    }
    if (available.length > 0) {
      return available[Math.floor(Math.random() * available.length)];
    }
    return Math.floor(Math.random() * MP_CONFIG.colors.length);
  }

  getFreeSkin() {
    const used = new Set([...this.players.values()].map(p => p.boatSkin).filter(Boolean));
    const available = MP_SKIN_KEYS.filter(s => !used.has(s));
    if (available.length > 0) {
      return available[Math.floor(Math.random() * available.length)];
    }
    return MP_SKIN_KEYS[Math.floor(Math.random() * MP_SKIN_KEYS.length)];
  }

  addPlayer(ws, id, name) {
    const colorIndex = this.getFreeColorIndex();
    const boatSkin = this.getFreeSkin();
    const spawnIdx = this.players.size % MP_CONFIG.spawns.length;
    const spawn = MP_CONFIG.spawns[spawnIdx];

    const isHost = (id === this.hostId);
    const player = {
      ws,
      id,
      name: sanitizeName(name),
      colorIndex,
      color: MP_CONFIG.colors[colorIndex],
      boatSkin,
      spawn,
      kills: 0,
      deaths: 0,
      lifeId: 1,
      alive: true,
      ready: isHost,
      state: { x: spawn.x, z: spawn.z, yaw: spawn.yaw, speed: 0, boosting: false, hp: 100 },
      lastMsgTime: Date.now(),
      msgRateCount: 0,
    };

    this.players.set(id, player);
    return player;
  }

  removePlayer(id) {
    const p = this.players.get(id);
    if (!p) return;
    this.players.delete(id);

    // If host left, promote next player
    if (this.hostId === id && this.players.size > 0) {
      const nextHost = this.players.values().next().value;
      this.hostId = nextHost.id;
      nextHost.ready = true;
      this.broadcast({ type: 'hostPromoted', hostId: this.hostId, players: this.getPlayerList() });
    }

    this.broadcast({ type: 'playerLeft', id, name: p.name });

    // If room is empty, clear all timers and destroy
    if (this.players.size === 0) {
      this.destroy();
    }
  }

  broadcast(msg, excludeId = null) {
    const str = JSON.stringify(msg);
    for (const [id, p] of this.players) {
      if (id !== excludeId && p.ws.readyState === 1) { // 1 = OPEN
        p.ws.send(str);
      }
    }
  }

  getStandings() {
    return [...this.players.values()]
      .map(p => ({
        id: p.id,
        name: p.name,
        colorIndex: p.colorIndex,
        color: p.color,
        kills: p.kills,
        deaths: p.deaths,
        isHost: p.id === this.hostId,
      }))
      .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
  }

  getPlayerList() {
    return [...this.players.values()].map(p => ({
      id: p.id,
      name: p.name,
      colorIndex: p.colorIndex,
      color: p.color,
      boatSkin: p.boatSkin,
      spawn: p.spawn,
      isHost: p.id === this.hostId,
      ready: p.id === this.hostId ? true : !!p.ready,
    }));
  }

  startCountdown(callingPlayerId = null) {
    if (callingPlayerId && callingPlayerId !== this.hostId) {
      return { ok: false, error: 'Only the host can start the match.' };
    }
    if (this.players.size < MP_CONFIG.minPlayersToStart) {
      return { ok: false, error: `Need at least ${MP_CONFIG.minPlayersToStart} players to start.` };
    }
    if (this.state === 'countdown' || this.state === 'playing') {
      return { ok: false, error: 'Match already in progress.' };
    }

    const notReady = [...this.players.values()].filter(p => p.id !== this.hostId && !p.ready);
    if (notReady.length > 0) {
      return { ok: false, error: 'Waiting for all players to be ready.' };
    }

    this.state = 'countdown';
    this.broadcast({ type: 'countdownStart', seconds: MP_CONFIG.countdownSeconds });

    if (this.countdownTimer) clearTimeout(this.countdownTimer);
    this.countdownTimer = setTimeout(() => {
      this.startMatch();
    }, MP_CONFIG.countdownSeconds * 1000);

    return { ok: true };
  }

  startMatch() {
    this.state = 'playing';
    this.winner = null;

    // Assign spread-out spawn points to all players
    const playerArray = [...this.players.values()];
    const spawnOffsets = [...MP_CONFIG.spawns];
    // Shuffle spawn offsets slightly for variety
    for (let i = spawnOffsets.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [spawnOffsets[i], spawnOffsets[j]] = [spawnOffsets[j], spawnOffsets[i]];
    }

    playerArray.forEach((p, idx) => {
      const sp = spawnOffsets[idx % spawnOffsets.length];
      p.spawn = sp;
      p.state.x = sp.x;
      p.state.z = sp.z;
      p.state.yaw = sp.yaw;
      p.state.speed = 0;
      p.state.boosting = false;
      p.state.hp = 100;
      p.alive = true;
      p.lifeId = 1;
    });

    // Reset health orbs and schedule first batch
    this.clearOrbTimers();
    this.orbs.clear();

    this.broadcast({
      type: 'matchStarted',
      players: this.getPlayerList(),
      standings: this.getStandings(),
      spawns: playerArray.map(p => ({ id: p.id, spawn: p.spawn })),
    });

    // Start first batch of health orbs after short initial grace period (2s)
    const t = setTimeout(() => this.spawnOrbBatch(), 2000);
    this.batchTimeouts.push(t);
  }

  clearOrbTimers() {
    for (const t of this.batchTimeouts) clearTimeout(t);
    this.batchTimeouts = [];
  }

  spawnOrbBatch() {
    if (this.state !== 'playing') return;

    this.batchIndex++;
    this.batchOrbsRemaining = MP_CONFIG.batchSize;
    let accumulatedDelay = 0;

    for (let i = 0; i < MP_CONFIG.batchSize; i++) {
      // Intra-batch delay: 1-10s between orbs
      const delay = (i === 0) ? rand(0.5, 2.0) : rand(MP_CONFIG.intraBatchDelay[0], MP_CONFIG.intraBatchDelay[1]);
      accumulatedDelay += delay;

      const t = setTimeout(() => {
        if (this.state !== 'playing') return;
        const pos = findOrbPosition([...this.orbs.values()]);
        const orb = {
          id: `orb_${this.batchIndex}_${this.orbSeq++}`,
          x: pos.x,
          z: pos.y ?? pos.z,
          batchIndex: this.batchIndex,
          spawnTime: Date.now()
        };
        this.orbs.set(orb.id, orb);
        this.broadcast({ type: 'orbSpawned', orb });

        // Auto-expire orb if unclaimed after orbLifetime
        const expT = setTimeout(() => {
          if (this.orbs.has(orb.id)) {
            this.orbs.delete(orb.id);
            this.broadcast({ type: 'orbExpired', orbId: orb.id });
            this.onOrbConsumedOrExpired();
          }
        }, MP_CONFIG.orbLifetime * 1000);
        this.batchTimeouts.push(expT);
      }, accumulatedDelay * 1000);

      this.batchTimeouts.push(t);
    }
  }

  claimOrb(orbId, playerId) {
    if (this.state !== 'playing') return false;
    const orb = this.orbs.get(orbId);
    if (!orb) return false; // Already claimed or expired

    const player = this.players.get(playerId);
    if (!player || !player.alive) return false;

    // Do not let someone consume orb if they already have full hp (100)
    if (player.state && player.state.hp >= 100) return false;

    // First claim wins
    this.orbs.delete(orbId);
    const healAmount = 35;
    player.state.hp = Math.min(100, (player.state.hp || 0) + healAmount);

    this.broadcast({
      type: 'orbTaken',
      orbId,
      by: playerId,
      byName: player.name,
      hp: player.state.hp,
    });

    this.onOrbConsumedOrExpired();
    return true;
  }

  onOrbConsumedOrExpired() {
    this.batchOrbsRemaining = Math.max(0, this.batchOrbsRemaining - 1);
    // When all 4 orbs of this batch have been consumed or expired, pause 10-15s then start next batch
    if (this.batchOrbsRemaining === 0) {
      const pauseSec = rand(MP_CONFIG.batchPause[0], MP_CONFIG.batchPause[1]);
      const t = setTimeout(() => {
        if (this.state === 'playing') {
          this.spawnOrbBatch();
        }
      }, pauseSec * 1000);
      this.batchTimeouts.push(t);
    }
  }

  recordDeath(victimId, killerId, lifeId) {
    if (this.state !== 'playing') return;

    const victim = this.players.get(victimId);
    if (!victim || !victim.alive) return;
    if (lifeId && victim.lifeId !== lifeId) return; // Prevent duplicate died messages for same life

    victim.alive = false;
    victim.deaths++;
    victim.lifeId++;

    const killer = this.players.get(killerId);
    if (killer && killer.id !== victimId) {
      killer.kills++;
    }

    const standings = this.getStandings();

    this.broadcast({
      type: 'playerDied',
      victimId,
      victimName: victim.name,
      killerId: killer ? killer.id : null,
      killerName: killer ? killer.name : 'The Sea',
      killerKills: killer ? killer.kills : 0,
      standings,
    });

    // Check Win Condition: First to 20 kills
    if (killer && killer.kills >= MP_CONFIG.winKills) {
      this.state = 'finished';
      this.winner = killer;
      this.clearOrbTimers();
      this.broadcast({
        type: 'matchOver',
        winnerId: killer.id,
        winnerName: killer.name,
        winnerColor: killer.color,
        winnerKills: killer.kills,
        standings,
      });
    }
  }

  restartMatch(hostId) {
    if (this.hostId !== hostId) {
      return { ok: false, error: 'Only the host can start a new game.' };
    }

    // Reset scores & ready state
    for (const p of this.players.values()) {
      p.kills = 0;
      p.deaths = 0;
      p.alive = true;
      p.lifeId = 1;
      p.state.hp = 100;
      p.ready = (p.id === this.hostId);
    }

    this.broadcast({ type: 'matchReset', standings: this.getStandings(), players: this.getPlayerList() });
    return this.startCountdown(hostId);
  }

  destroy() {
    if (this.countdownTimer) clearTimeout(this.countdownTimer);
    this.clearOrbTimers();
    this.roomManager.deleteRoom(this.code);
  }
}

class RoomManager {
  constructor() {
    this.rooms = new Map(); // code -> Room
    this.playerToRoom = new Map(); // ws -> { roomCode, playerId }
  }

  createRoom(ws, name) {
    this.leaveRoom(ws); // clean up any existing room
    const code = generateRoomCode(this.rooms);
    const id = `p_${Math.random().toString(36).substring(2, 9)}`;
    const room = new Room(code, ws, id, name, this);
    this.rooms.set(code, room);
    this.playerToRoom.set(ws, { roomCode: code, playerId: id });

    const player = room.players.get(id);
    return {
      type: 'roomCreated',
      code,
      roomCode: code,
      playerId: id,
      colorIndex: player.colorIndex,
      color: player.color,
      boatSkin: player.boatSkin,
      spawn: player.spawn,
      isHost: true,
      players: room.getPlayerList(),
      maxPlayers: MP_CONFIG.maxPlayers,
    };
  }

  joinRoom(ws, rawCode, name) {
    this.leaveRoom(ws);
    const code = (rawCode || '').trim().toUpperCase();
    const room = this.rooms.get(code);

    if (!room) {
      return { type: 'error', message: 'Room code not found.' };
    }
    if (room.players.size >= MP_CONFIG.maxPlayers) {
      return { type: 'error', message: 'Room is full (max 5 players).' };
    }
    if (room.state === 'playing' || room.state === 'countdown') {
      return { type: 'error', message: 'Match already in progress in this room.' };
    }

    const id = `p_${Math.random().toString(36).substring(2, 9)}`;
    const player = room.addPlayer(ws, id, name);
    this.playerToRoom.set(ws, { roomCode: code, playerId: id });

    // Notify existing players
    room.broadcast({
      type: 'playerJoined',
      player: {
        id: player.id,
        name: player.name,
        colorIndex: player.colorIndex,
        color: player.color,
        boatSkin: player.boatSkin,
        spawn: player.spawn,
        isHost: false,
        ready: false,
      },
      players: room.getPlayerList(),
    }, id);

    return {
      type: 'roomJoined',
      code,
      roomCode: code,
      playerId: id,
      colorIndex: player.colorIndex,
      color: player.color,
      boatSkin: player.boatSkin,
      spawn: player.spawn,
      isHost: false,
      players: room.getPlayerList(),
      maxPlayers: MP_CONFIG.maxPlayers,
      standings: room.getStandings(),
      orbs: [...room.orbs.values()],
      matchState: room.state,
    };
  }

  leaveRoom(ws) {
    const info = this.playerToRoom.get(ws);
    if (!info) return;
    this.playerToRoom.delete(ws);

    const room = this.rooms.get(info.roomCode);
    if (room) {
      room.removePlayer(info.playerId);
    }
  }

  deleteRoom(code) {
    this.rooms.delete(code);
  }

  getRoomByWs(ws) {
    const info = this.playerToRoom.get(ws);
    if (!info) return null;
    const room = this.rooms.get(info.roomCode);
    return room ? { room, playerId: info.playerId } : null;
  }
}

function setupWebSocketServer(httpServer) {
  const wss = new WebSocketServer({ server: httpServer });
  const roomManager = new RoomManager();

  wss.on('connection', (ws) => {
    let msgCount = 0;
    let rateResetTime = Date.now();

    ws.on('message', (raw) => {
      // Throttle and max size check (max 8KB per message)
      if (raw.length > 8192) return;

      const now = Date.now();
      if (now - rateResetTime > 1000) {
        rateResetTime = now;
        msgCount = 0;
      }
      if (++msgCount > MP_CONFIG.rateLimitMsgsPerSec) return;

      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return; // ignore malformed JSON
      }

      if (!msg || typeof msg.type !== 'string') return;

      // Handle Ping
      if (msg.type === 'ping') {
        if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'pong', t: msg.t }));
        return;
      }

      // Handle Room Actions
      if (msg.type === 'createRoom') {
        const res = roomManager.createRoom(ws, msg.name);
        ws.send(JSON.stringify(res));
        return;
      }

      if (msg.type === 'joinRoom') {
        const code = msg.code || msg.roomCode;
        const res = roomManager.joinRoom(ws, code, msg.name);
        ws.send(JSON.stringify(res));
        return;
      }

      if (msg.type === 'leaveRoom') {
        roomManager.leaveRoom(ws);
        ws.send(JSON.stringify({ type: 'roomLeft' }));
        return;
      }

      // Room-specific actions require active room session
      const ctx = roomManager.getRoomByWs(ws);
      if (!ctx) return;
      const { room, playerId } = ctx;

      switch (msg.type) {
        case 'startMatch': {
          if (room.hostId === playerId) {
            const res = room.startCountdown(playerId);
            if (!res.ok) ws.send(JSON.stringify({ type: 'error', message: res.error }));
          } else {
            ws.send(JSON.stringify({ type: 'error', message: 'Only the host can start the match.' }));
          }
          break;
        }

        case 'setReady': {
          const p = room.players.get(playerId);
          if (p) {
            if (room.hostId === playerId) {
              p.ready = true;
            } else {
              p.ready = typeof msg.ready === 'boolean' ? msg.ready : !p.ready;
            }
            room.broadcast({
              type: 'playerReadyUpdate',
              id: playerId,
              ready: p.ready,
              players: room.getPlayerList(),
            });
          }
          break;
        }

        case 'selectSkin': {
          const p = room.players.get(playerId);
          if (p && room.state === 'lobby') {
            if (msg.boatSkin && MP_SKIN_KEYS.includes(msg.boatSkin)) {
              p.boatSkin = msg.boatSkin;
            }
            if (typeof msg.colorIndex === 'number' && msg.colorIndex >= 0 && msg.colorIndex < MP_CONFIG.colors.length) {
              p.colorIndex = msg.colorIndex;
              p.color = MP_CONFIG.colors[p.colorIndex];
            }
            room.broadcast({
              type: 'playerSkinUpdate',
              id: playerId,
              boatSkin: p.boatSkin,
              colorIndex: p.colorIndex,
              color: p.color,
              players: room.getPlayerList(),
            });
          }
          break;
        }

        case 'restartMatch': {
          const res = room.restartMatch(playerId);
          if (!res.ok) ws.send(JSON.stringify({ type: 'error', message: res.error }));
          break;
        }

        case 'state': {
          const p = room.players.get(playerId);
          if (p) {
            const s = msg.state || msg.data || msg;
            p.state.x = Number(s.x) || 0;
            p.state.z = Number(s.z) || 0;
            p.state.yaw = Number(s.yaw) || 0;
            p.state.speed = Number(s.speed) || 0;
            p.state.boosting = !!s.boosting;
            if (s.alive !== undefined) p.alive = !!s.alive;

            // Broadcast to other players in room (p.state.hp is authoritative from server)
            room.broadcast({
              type: 'remoteState',
              id: playerId,
              state: p.state,
              data: p.state,
              time: now,
            }, playerId);
          }
          break;
        }

        case 'fire': {
          if (room.state !== 'playing') return;
          const yaw = Number(msg.yaw ?? msg.heading) || 0;
          room.broadcast({
            type: 'remoteFire',
            id: playerId,
            shooterId: playerId,
            weapon: msg.weapon === 'missile' ? 'missile' : 'gun',
            x: Number(msg.x) || 0,
            z: Number(msg.z) || 0,
            yaw,
            heading: yaw,
            speed: Number(msg.speed) || 0,
            targetId: msg.targetId || null,
          }, playerId);
          break;
        }

        case 'dealDamage': {
          if (room.state !== 'playing') return;
          const victim = room.players.get(msg.targetId);
          const attacker = room.players.get(playerId);
          if (!victim || !victim.alive || !attacker || !attacker.alive) return;

          const dmg = Math.min(80, Math.max(1, Number(msg.dmg) || 3.6));
          victim.state.hp = Math.max(0, victim.state.hp - dmg);

          room.broadcast({
            type: 'remoteHit',
            victimId: victim.id,
            victimName: victim.name,
            attackerId: attacker.id,
            attackerName: attacker.name,
            dmg,
            hp: victim.state.hp,
          });

          if (victim.state.hp <= 0) {
            room.recordDeath(victim.id, attacker.id, victim.lifeId);
          }
          break;
        }

        case 'hit': {
          if (room.state !== 'playing') return;
          const victim = room.players.get(playerId);
          if (victim && victim.alive) {
            // Only fatal hits (hp === 0) are accepted from victim client (e.g. fatal test trigger)
            // Combat damage is authoritatively driven by dealDamage to prevent desync and fluctuations
            if (Number(msg.hp) === 0) {
              victim.state.hp = 0;
              const attacker = msg.by ? room.players.get(msg.by) : null;
              room.broadcast({
                type: 'remoteHit',
                victimId: playerId,
                victimName: victim.name,
                attackerId: msg.by || null,
                attackerName: attacker ? attacker.name : 'The Sea',
                dmg: Number(msg.dmg) || 0,
                hp: 0,
              }, playerId);

              room.recordDeath(victim.id, msg.by, victim.lifeId);
            }
          }
          break;
        }

        case 'died': {
          room.recordDeath(playerId, msg.by, Number(msg.lifeId) || undefined);
          break;
        }

        case 'respawn': {
          const p = room.players.get(playerId);
          if (p) {
            p.alive = true;
            p.state.hp = 100;
            p.state.x = Number(msg.x) || p.spawn.x;
            p.state.z = Number(msg.z) || p.spawn.z;
            p.state.yaw = Number(msg.yaw) || p.spawn.yaw;
            room.broadcast({
              type: 'playerRespawned',
              id: playerId,
              x: p.state.x,
              z: p.state.z,
              yaw: p.state.yaw,
            });
          }
          break;
        }

        case 'claimOrb': {
          room.claimOrb(msg.orbId, playerId);
          break;
        }
      }
    });

    ws.on('close', () => {
      roomManager.leaveRoom(ws);
    });

    ws.on('error', () => {
      roomManager.leaveRoom(ws);
    });
  });

  return { wss, roomManager };
}

module.exports = {
  MP_CONFIG,
  setupWebSocketServer,
  RoomManager,
  Room,
};
