// public/js/multiplayer.js
// Online multiplayer management for Boom Boats:
// Room lifecycle, remote player entity sync with snapshot interpolation,
// combat broadcast/hits, server-driven health orbs, and match state.

import * as THREE from 'three';
import { MP, BOAT, PLAYER, WEAPONS, POTION, KILL_REWARD, WORLD } from './config.js';
import { buildMultiplayerBoat } from './multiplayerBoats.js';
import { Wake } from './wake.js';
import { makePotion, glowTexture } from './potions.js';
import { waveHeight } from './waves.js';
import { audio } from './audio.js';

const TAU = Math.PI * 2;
const angleDiff = (a, b) => ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;

function lerpAngle(a, b, t) {
  return a + angleDiff(a, b) * t;
}

function drawNametag(canvas, name, colorHex, hp = 100, maxHp = 100) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Pill background
  ctx.fillStyle = 'rgba(20, 24, 34, 0.85)';
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(8, 6, 240, 72, 16);
    ctx.fill();
    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 3;
    ctx.stroke();
  } else {
    ctx.fillRect(8, 6, 240, 72);
  }

  // Name text
  ctx.font = 'bold 22px "Fredoka", "Trebuchet MS", sans-serif';
  ctx.fillStyle = colorHex;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, 128, 28);

  // Health bar track
  const barX = 24, barY = 48, barW = 208, barH = 16;
  ctx.fillStyle = 'rgba(10, 14, 20, 0.9)';
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 8);
    ctx.fill();
  } else {
    ctx.fillRect(barX, barY, barW, barH);
  }

  // Health bar fill
  const pct = Math.max(0, Math.min(1, hp / maxHp));
  if (pct > 0) {
    const fillW = Math.max(10, barW * pct);
    const fillColor = pct > 0.5 ? '#34d399' : (pct > 0.25 ? '#fbbf24' : '#f87171');
    ctx.fillStyle = fillColor;
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(barX, barY, fillW, barH, 8);
      ctx.fill();
    } else {
      ctx.fillRect(barX, barY, fillW, barH);
    }
  }

  // Small text inside health bar: e.g. "75 HP"
  ctx.font = 'bold 12px "Fredoka", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.round(hp)} HP`, 128, barY + 8);
}

function createNametagSprite(name, colorHex, hp = 100, maxHp = 100) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 84;
  drawNametag(canvas, name, colorHex, hp, maxHp);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(7.5, 2.46, 1);
  sprite.position.y = 5.8; // elevated above cabin & pilot cap
  return { sprite, texture, canvas };
}

export class RemotePlayer {
  constructor(info, scene, manager = null) {
    this.id = info.id;
    this.name = info.name || 'Captain';
    this.colorIndex = info.colorIndex || 0;
    this.color = MP.colors[this.colorIndex] || MP.colors[0];
    this.boatSkin = info.boatSkin || 'reefbreaker';
    this.scene = scene;
    this.manager = manager;

    this.team = this.id;
    this.radius = BOAT.radius + 0.4;
    this.alive = true;
    this.ready = !!info.ready;
    this.hp = PLAYER.maxHp;
    this.maxHp = PLAYER.maxHp;
    this.lifeId = 1;

    // Movement state
    this.state = {
      x: info.spawn ? info.spawn.x : 0,
      z: info.spawn ? info.spawn.z : -2,
      yaw: info.spawn ? info.spawn.yaw : 0,
      speed: 0,
      boosting: false,
    };

    // Snapshot buffer for ~100ms interpolation
    this.snapshots = [];

    // 3D boat model using multiplayer boat assets
    this.boatGroup = buildMultiplayerBoat(this.boatSkin, this.color.style, false);
    this.scene.add(this.boatGroup);

    // Wake
    this.wake = new Wake(scene, 30);

    // Floating nametag with dynamic health bar
    const { sprite, texture, canvas } = createNametagSprite(this.name, this.color.hex, this.hp, this.maxHp);
    this.nametagSprite = sprite;
    this.nametagTexture = texture;
    this.nametagCanvas = canvas;
    this.boatGroup.add(this.nametagSprite);

    this.updateTransform();
  }

  setSkinAndColor(boatSkin, colorIndex, color) {
    this.boatSkin = boatSkin;
    this.colorIndex = colorIndex;
    this.color = color || MP.colors[colorIndex] || MP.colors[0];

    // Rebuild 3D mesh
    if (this.boatGroup) {
      this.scene.remove(this.boatGroup);
    }
    this.boatGroup = buildMultiplayerBoat(this.boatSkin, this.color.style, false);
    this.scene.add(this.boatGroup);

    if (this.nametagSprite) {
      this.boatGroup.add(this.nametagSprite);
    }
    this.updateNametag();
    this.updateTransform();
  }

  updateNametag() {
    if (this.nametagCanvas && this.nametagTexture) {
      drawNametag(this.nametagCanvas, this.name, this.color.hex, this.hp, this.maxHp);
      this.nametagTexture.needsUpdate = true;
    }
  }

  addSnapshot(s) {
    const now = performance.now();
    const hpVal = s.hp !== undefined ? s.hp : this.hp;
    this.snapshots.push({
      t: now,
      x: s.x,
      z: s.z,
      yaw: s.yaw,
      speed: s.speed || 0,
      boosting: !!s.boosting,
      hp: hpVal,
      alive: s.alive !== undefined ? s.alive : this.alive,
    });

    if (hpVal !== this.hp) {
      // Do not allow stale snapshots to jump HP upwards during combat
      if (hpVal <= this.hp || hpVal === 100 || hpVal - this.hp >= 30) {
        this.hp = hpVal;
        this.updateNametag();
      }
    }

    // Prune snapshots older than 1 second
    const cutoff = now - 1000;
    while (this.snapshots.length > 2 && this.snapshots[0].t < cutoff) {
      this.snapshots.shift();
    }
  }

  updateInterpolation(dt, t) {
    if (!this.alive) {
      this.boatGroup.visible = false;
      return;
    }
    this.boatGroup.visible = true;

    const renderTime = performance.now() - 100; // 100ms interpolation buffer

    if (this.snapshots.length === 0) {
      this.syncVisuals(dt, t);
      return;
    }

    if (this.snapshots.length === 1 || renderTime <= this.snapshots[0].t) {
      const snap = this.snapshots[0];
      this.state.x = snap.x;
      this.state.z = snap.z;
      this.state.yaw = snap.yaw;
      this.state.speed = snap.speed;
      this.state.boosting = snap.boosting;
    } else {
      // Find two snapshots surrounding renderTime
      let idx0 = -1;
      for (let i = 0; i < this.snapshots.length - 1; i++) {
        if (this.snapshots[i].t <= renderTime && this.snapshots[i + 1].t >= renderTime) {
          idx0 = i;
          break;
        }
      }

      if (idx0 !== -1) {
        const p0 = this.snapshots[idx0];
        const p1 = this.snapshots[idx0 + 1];
        const span = p1.t - p0.t;
        const frac = span > 0 ? (renderTime - p0.t) / span : 0;

        this.state.x = p0.x + (p1.x - p0.x) * frac;
        this.state.z = p0.z + (p1.z - p0.z) * frac;
        this.state.yaw = lerpAngle(p0.yaw, p1.yaw, frac);
        this.state.speed = p0.speed + (p1.speed - p0.speed) * frac;
        this.state.boosting = p1.boosting;
      } else {
        // Gap / extrapolation: extrapolate from newest snapshot for up to 250ms
        const latest = this.snapshots[this.snapshots.length - 1];
        const deltaSec = Math.min(0.25, (renderTime - latest.t) / 1000);
        if (deltaSec > 0 && Math.abs(latest.speed) > 0.5) {
          this.state.x = latest.x + Math.sin(latest.yaw) * latest.speed * deltaSec;
          this.state.z = latest.z + Math.cos(latest.yaw) * latest.speed * deltaSec;
          this.state.yaw = latest.yaw;
          this.state.speed = latest.speed;
          this.state.boosting = latest.boosting;
        } else {
          this.state.x = latest.x;
          this.state.z = latest.z;
          this.state.yaw = latest.yaw;
          this.state.speed = latest.speed;
          this.state.boosting = latest.boosting;
        }
      }
    }

    this.syncVisuals(dt, t);
  }

  syncVisuals(dt, t) {
    this.updateTransform();

    // Wave bobbing & model animation
    const wh = waveHeight(this.state.x, this.state.z, t);
    this.boatGroup.position.y = wh;

    if (this.boatGroup.userData && this.boatGroup.userData.update) {
      this.boatGroup.userData.update(dt, t, this);
    }

    // Wake update
    this.wake.update(dt, t, {
      state: this.state,
      top: BOAT.baseTop,
      scale: 1,
    }, this.alive);
  }

  updateTransform() {
    this.boatGroup.position.x = this.state.x;
    this.boatGroup.position.z = this.state.z;
    this.boatGroup.rotation.y = this.state.yaw;
  }

  takeDamage(dmg, by) {
    if (by === 'player') {
      this.hp = Math.max(0, this.hp - dmg);
      this.updateNametag();
      if (this.manager) {
        this.manager.reportDealDamage(this.id, dmg);
      }
    }
    if (this.boatGroup.userData && this.boatGroup.userData.hit) {
      this.boatGroup.userData.hit();
    }
  }

  destroy() {
    this.scene.remove(this.boatGroup);
    this.wake.destroy();
    if (this.nametagTexture) this.nametagTexture.dispose();
  }
}

export class MultiplayerManager {
  constructor(scene, combat, netClient, mainGame) {
    this.scene = scene;
    this.combat = combat;
    this.net = netClient;
    this.game = mainGame; // reference to main.js player, boat, hud, audio, etc.

    this.mode = 'offline'; // 'offline' | 'online'
    this.matchState = 'lobby'; // 'lobby' | 'countdown' | 'playing' | 'finished'
    this.roomCode = null;
    this.localPlayerId = null;
    this.localColorIndex = 0;
    this.localColor = MP.colors[0];
    this.isHost = false;
    this.localReady = false;
    this.playerName = 'Captain';

    this.remotePlayers = new Map(); // id -> RemotePlayer
    this.orbs = new Map(); // orbId -> { id, x, z, mesh, flask, glow, buoy }
    this.standings = [];
    this.glowTex = glowTexture();

    this.lastStateSendTime = 0;
    this.stateSendInterval = 1000 / 20; // 20 Hz
    this.claimedOrbIds = new Set();

    this.setupNetworkEvents();
  }

  setupNetworkEvents() {
    this.net.on('roomCreated', (msg) => {
      this.mode = 'online';
      this.roomCode = msg.roomCode || msg.code;
      this.localPlayerId = msg.playerId;
      this.localColorIndex = msg.colorIndex;
      this.localColor = msg.color;
      this.localBoatSkin = msg.boatSkin || 'reefbreaker';
      this.isHost = true;
      this.localReady = true;
      this.matchState = 'lobby';

      // Apply boat color style to local boat
      this.game.applySkinStyle(this.localColor.style, this.localColorIndex, this.localBoatSkin);
      if (msg.spawn) {
        this.game.teleportLocalPlayer(msg.spawn.x, msg.spawn.z, msg.spawn.yaw);
      }

      if (this.onRoomJoined) {
        this.onRoomJoined({
          code: this.roomCode,
          isHost: true,
          players: msg.players,
          color: this.localColor,
          boatSkin: this.localBoatSkin,
        });
      }
    });

    this.net.on('roomJoined', (msg) => {
      this.mode = 'online';
      this.roomCode = msg.roomCode || msg.code;
      this.localPlayerId = msg.playerId;
      this.localColorIndex = msg.colorIndex;
      this.localColor = msg.color;
      this.localBoatSkin = msg.boatSkin || 'reefbreaker';
      this.isHost = !!msg.isHost;
      this.localReady = this.isHost;
      this.matchState = msg.matchState || 'lobby';
      this.standings = msg.standings || [];

      this.game.applySkinStyle(this.localColor.style, this.localColorIndex, this.localBoatSkin);
      if (msg.spawn) {
        this.game.teleportLocalPlayer(msg.spawn.x, msg.spawn.z, msg.spawn.yaw);
      }

      // Populate remote players
      for (const p of msg.players) {
        if (p.id !== this.localPlayerId) {
          this.addRemotePlayer(p);
        }
      }

      // Populate any alive orbs if match is already active
      if (msg.orbs && Array.isArray(msg.orbs)) {
        for (const orb of msg.orbs) {
          this.spawnOrbMesh(orb);
        }
      }

      if (this.onRoomJoined) {
        this.onRoomJoined({
          code: this.roomCode,
          isHost: this.isHost,
          players: msg.players,
          color: this.localColor,
        });
      }
    });

    this.net.on('playerJoined', (msg) => {
      if (msg.player && msg.player.id !== this.localPlayerId) {
        this.addRemotePlayer(msg.player);
        this.game.hud.toast(`👋 ${msg.player.name} joined!`, 1800);
      }
      if (this.onPlayerListUpdate) this.onPlayerListUpdate(msg.players);
    });

    this.net.on('playerLeft', (msg) => {
      this.removeRemotePlayer(msg.id);
      this.game.hud.toast(`⛵ ${msg.name || 'A player'} left the match.`, 1800);
      if (this.onPlayerListUpdate) this.onPlayerListUpdate(this.getPlayerList());
    });

    this.net.on('hostPromoted', (msg) => {
      if (msg.hostId === this.localPlayerId) {
        this.isHost = true;
        this.localReady = true;
        this.game.hud.toast('👑 You are now the room host!', 2500);
      }
      if (this.onHostChanged) this.onHostChanged(msg.hostId);
      if (this.onPlayerListUpdate && msg.players) this.onPlayerListUpdate(msg.players);
    });

    this.net.on('playerReadyUpdate', (msg) => {
      if (msg.id === this.localPlayerId) {
        this.localReady = !!msg.ready;
      } else {
        const rp = this.remotePlayers.get(msg.id);
        if (rp) rp.ready = !!msg.ready;
      }
      if (this.onPlayerReadyUpdate) {
        this.onPlayerReadyUpdate(msg);
      } else if (this.onPlayerListUpdate && msg.players) {
        this.onPlayerListUpdate(msg.players);
      }
    });

    this.net.on('playerSkinUpdate', (msg) => {
      if (msg.id === this.localPlayerId) {
        this.localBoatSkin = msg.boatSkin;
        this.localColorIndex = msg.colorIndex;
        this.localColor = msg.color;
        this.game.applySkinStyle(this.localColor.style, this.localColorIndex, this.localBoatSkin);
      } else {
        const rp = this.remotePlayers.get(msg.id);
        if (rp) {
          rp.setSkinAndColor(msg.boatSkin, msg.colorIndex, msg.color);
        }
      }
      if (this.onPlayerSkinUpdate) this.onPlayerSkinUpdate(msg);
      if (this.onPlayerListUpdate && msg.players) this.onPlayerListUpdate(msg.players);
    });

    this.net.on('countdownStart', (msg) => {
      this.matchState = 'countdown';
      if (this.onCountdown) this.onCountdown(msg.seconds);
    });

    this.net.on('matchStarted', (msg) => {
      this.matchState = 'playing';
      this.standings = msg.standings || [];

      // Reposition remote players to their match spawns
      if (msg.spawns) {
        for (const sp of msg.spawns) {
          if (sp.id === this.localPlayerId) {
            this.game.teleportLocalPlayer(sp.spawn.x, sp.spawn.z, sp.spawn.yaw);
          } else {
            const rp = this.remotePlayers.get(sp.id);
            if (rp) {
              rp.state.x = sp.spawn.x;
              rp.state.z = sp.spawn.z;
              rp.state.yaw = sp.spawn.yaw;
              rp.state.speed = 0;
              rp.state.boosting = false;
              rp.alive = true;
              rp.snapshots = [];
              rp.updateTransform();
            }
          }
        }
      }

      this.clearAllOrbs();
      if (this.onMatchStart) this.onMatchStart();
    });

    this.net.on('remoteState', (msg) => {
      const rp = this.remotePlayers.get(msg.id);
      if (rp) {
        rp.addSnapshot(msg.state || msg.data || msg);
      }
    });

    this.net.on('remoteFire', (msg) => {
      const id = msg.id || msg.shooterId;
      if (id === this.localPlayerId) return;
      const yaw = Number(msg.yaw ?? msg.heading) || 0;

      if (msg.weapon === 'gun') {
        this.combat.fireBullet(
          id,
          msg.x,
          msg.z,
          yaw,
          msg.speed || WEAPONS.gun.speed,
          WEAPONS.gun.dmg,
          WEAPONS.gun.life
        );
      } else if (msg.weapon === 'missile') {
        // Resolve target if targeted
        let lockTarget = null;
        if (msg.targetId === this.localPlayerId) {
          lockTarget = this.game.player;
        } else if (this.remotePlayers.has(msg.targetId)) {
          lockTarget = this.remotePlayers.get(msg.targetId);
        }

        this.combat.fireMissile(
          id,
          msg.x,
          msg.z,
          yaw,
          msg.speed || WEAPONS.missile.speed,
          WEAPONS.missile,
          lockTarget
        );
      }
    });

    this.net.on('remoteHit', (msg) => {
      if (msg.victimId === this.localPlayerId) {
        // Local player took damage
        const player = this.game.player;
        if (player.alive && player.invuln <= 0) {
          const incomingHp = Math.max(0, Number(msg.hp));
          // Monotonic damage check: damage events must never bounce HP upward!
          // Only health orbs (orbTaken) or respawn can increase HP.
          if (incomingHp <= player.hp || msg.isHeal) {
            player.hp = incomingHp;
          }
          player.sinceHit = 0;
          this.game.audio.hurt();
          this.game.hud.flash(Math.min(0.9, 0.25 + msg.dmg / 60));
          if (this.game.boat.group?.userData?.hit) this.game.boat.group.userData.hit();
          if (this.game.boat.fpv?.userData?.hit) this.game.boat.fpv.userData.hit();
          const attacker = msg.attackerName || 'An opponent';
          this.game.hud.toast(`💥 Hit by ${attacker}! (-${Math.round(msg.dmg)} HP)`, 1200);

          if (player.hp <= 0 && this.game.sink) {
            this.game.sink(msg.attackerId, attacker, true);
          }
        }
      } else {
        const rp = this.remotePlayers.get(msg.victimId);
        if (rp) {
          rp.hp = Math.max(0, Number(msg.hp));
          rp.updateNametag();
          if (rp.boatGroup.userData && rp.boatGroup.userData.hit) {
            rp.boatGroup.userData.hit();
          }
        }
      }
    });

    this.net.on('playerDied', (msg) => {
      this.standings = msg.standings || [];
      const killerName = msg.killerName || 'The Sea';
      const victimName = msg.victimName || 'Captain';

      this.game.hud.toast(`💥 ${killerName} sank ${victimName}!`, 3000);
      audio.kill();

      if (msg.killerId === this.localPlayerId) {
        this.game.applyKillReward();
        this.game.hud.toast(`🏆 You sank ${victimName}! (+1 Kill, HP healed)`, 3000);
      }

      if (msg.victimId === this.localPlayerId) {
        // Trigger sink for local player (plays full TPP blast animation and preserves FPP for respawn)
        if (this.game.sink) {
          this.game.sink(msg.killerId, killerName, true);
        } else if (this.game.player.alive) {
          this.game.player.alive = false;
          this.game.player.hp = 0;
          this.game.player.respawn = PLAYER.respawnTime;
        }
      } else {
        const rp = this.remotePlayers.get(msg.victimId);
        if (rp) {
          rp.alive = false;
          rp.hp = 0;
          rp.updateNametag();
          rp.boatGroup.visible = false;
          this.combat.bigExplosion(rp.state.x, rp.state.z, 1.3, [rp.color.hex, 0xffe2a8, 0x2b3440]);
        }
      }

      if (this.onStandingsUpdate) this.onStandingsUpdate(this.standings);
    });

    this.net.on('playerRespawned', (msg) => {
      if (msg.id === this.localPlayerId) {
        // Confirmed local respawn
        this.game.player.alive = true;
        this.game.player.hp = PLAYER.maxHp;
        this.game.player.invuln = PLAYER.invuln;
      } else {
        const rp = this.remotePlayers.get(msg.id);
        if (rp) {
          rp.alive = true;
          rp.hp = PLAYER.maxHp;
          rp.state.x = msg.x;
          rp.state.z = msg.z;
          rp.state.yaw = msg.yaw;
          rp.state.speed = 0;
          rp.snapshots = [];
          rp.boatGroup.visible = true;
          rp.updateTransform();
        }
      }
    });

    this.net.on('orbSpawned', (msg) => {
      if (msg.orb) {
        this.spawnOrbMesh(msg.orb);
      }
    });

    this.net.on('orbTaken', (msg) => {
      const orb = this.orbs.get(msg.orbId);
      if (orb) {
        this.combat.ring(orb.x, orb.z, 14, 0.7, 0x55ff77, 0.95);
        this.scene.remove(orb.g);
        this.orbs.delete(msg.orbId);
      }

      if (msg.by === this.localPlayerId) {
        // Apply healing instantly upon server confirmation
        const targetHp = msg.hp !== undefined ? Number(msg.hp) : undefined;
        const healed = this.game.healLocalPlayer(PLAYER.maxHp * POTION.heal, targetHp);
        audio.potion();
        this.game.hud.toast(`🧪 +${Math.round(healed)} HP!`, 1500);
      } else {
        const rp = this.remotePlayers.get(msg.by);
        if (rp) {
          if (msg.hp !== undefined) rp.hp = Number(msg.hp);
          else rp.hp = Math.min(PLAYER.maxHp, rp.hp + PLAYER.maxHp * POTION.heal);
          rp.updateNametag();
        }
        this.game.hud.toast(`🧪 ${msg.byName || 'A player'} grabbed a health orb!`, 1500);
      }
    });

    this.net.on('orbExpired', (msg) => {
      const orb = this.orbs.get(msg.orbId);
      if (orb) {
        this.scene.remove(orb.g);
        this.orbs.delete(msg.orbId);
      }
    });

    this.net.on('matchOver', (msg) => {
      this.matchState = 'finished';
      this.standings = msg.standings || [];
      if (this.onMatchOver) {
        this.onMatchOver({
          winnerId: msg.winnerId,
          winnerName: msg.winnerName,
          winnerColor: msg.winnerColor,
          winnerKills: msg.winnerKills,
          standings: this.standings,
          isHost: this.isHost,
        });
      }
    });

    this.net.on('matchReset', (msg) => {
      this.matchState = 'countdown';
      this.standings = msg.standings || [];
      this.localReady = this.isHost;
      this.clearAllOrbs();
      if (this.onMatchReset) this.onMatchReset(this.standings);
      if (this.onPlayerListUpdate && msg.players) this.onPlayerListUpdate(msg.players);
    });

    this.net.on('error', (msg) => {
      if (this.onError) this.onError(msg.message || 'Multiplayer error');
    });
  }

  setReady(ready) {
    if (this.isHost) {
      this.localReady = true;
      return;
    }
    this.localReady = !!ready;
    if (this.net.isConnected) {
      this.net.send({ type: 'setReady', ready: this.localReady });
    }
  }

  selectSkin(boatSkin, colorIndex) {
    if (this.mode !== 'online' || !this.net.isConnected) return;
    this.localBoatSkin = boatSkin;
    this.localColorIndex = colorIndex;
    this.localColor = MP.colors[colorIndex];
    this.game.applySkinStyle(this.localColor.style, this.localColorIndex, this.localBoatSkin);
    this.net.send({
      type: 'selectSkin',
      boatSkin,
      colorIndex,
    });
  }

  addRemotePlayer(info) {
    if (this.remotePlayers.has(info.id)) return;
    const rp = new RemotePlayer(info, this.scene, this);
    this.remotePlayers.set(info.id, rp);
  }

  removeRemotePlayer(id) {
    const rp = this.remotePlayers.get(id);
    if (rp) {
      rp.destroy();
      this.remotePlayers.delete(id);
    }
  }

  getPlayerList() {
    const list = [{
      id: this.localPlayerId,
      name: this.playerName,
      colorIndex: this.localColorIndex,
      color: this.localColor,
      isHost: this.isHost,
      ready: this.isHost ? true : !!this.localReady,
    }];
    for (const rp of this.remotePlayers.values()) {
      list.push({
        id: rp.id,
        name: rp.name,
        colorIndex: rp.colorIndex,
        color: rp.color,
        isHost: false,
        ready: !!rp.ready,
      });
    }
    return list;
  }

  spawnOrbMesh(orbData) {
    if (this.orbs.has(orbData.id)) return;
    const p = makePotion(this.glowTex);
    p.g.position.set(orbData.x, 0, orbData.z);
    p.g.visible = true;
    this.scene.add(p.g);

    this.orbs.set(orbData.id, {
      id: orbData.id,
      x: orbData.x,
      z: orbData.z,
      g: p.g,
      flask: p.flask,
      buoy: p.buoy,
      spawnTime: performance.now(),
    });
  }

  clearAllOrbs() {
    for (const orb of this.orbs.values()) {
      this.scene.remove(orb.g);
    }
    this.orbs.clear();
    this.claimedOrbIds.clear();
  }

  startMatch() {
    if (this.isHost && this.net.isConnected) {
      this.net.send({ type: 'startMatch' });
    }
  }

  restartMatch() {
    if (this.isHost && this.net.isConnected) {
      this.net.send({ type: 'restartMatch' });
    }
  }

  leaveRoom() {
    if (this.net.isConnected) {
      this.net.send({ type: 'leaveRoom' });
    }
    this.cleanupMatch();
    this.mode = 'offline';
  }

  cleanupMatch() {
    for (const rp of this.remotePlayers.values()) {
      rp.destroy();
    }
    this.remotePlayers.clear();
    this.clearAllOrbs();
    this.roomCode = null;
    this.localPlayerId = null;
    this.matchState = 'lobby';
    this.standings = [];
    if (this.game.boat && this.game.boat.resetStyle) {
      this.game.boat.resetStyle();
    }
  }

  broadcastLocalFire(weapon, s, targetId = null) {
    if (this.mode !== 'online' || !this.net.isConnected) return;
    this.net.send({
      type: 'fire',
      weapon,
      x: s.x,
      z: s.z,
      yaw: s.yaw,
      speed: s.speed,
      targetId,
    });
  }

  reportDealDamage(targetId, dmg) {
    if (this.mode !== 'online' || !this.net.isConnected) return;
    this.net.send({
      type: 'dealDamage',
      targetId,
      dmg,
    });
  }

  reportLocalHit(dmg, by, remainingHp) {
    if (this.mode !== 'online' || !this.net.isConnected) return;
    this.net.send({
      type: 'hit',
      dmg,
      by,
      hp: remainingHp,
    });
  }

  reportLocalDeath(by, lifeId) {
    if (this.mode !== 'online' || !this.net.isConnected) return;
    this.net.send({
      type: 'died',
      by,
      lifeId,
    });
  }

  reportLocalRespawn(x, z, yaw) {
    if (this.mode !== 'online' || !this.net.isConnected) return;
    this.net.send({
      type: 'respawn',
      x,
      z,
      yaw,
    });
  }

  update(dt, t) {
    if (this.mode !== 'online') return;

    // 1. Broadcast local player state at 20 Hz
    const now = performance.now();
    if (now - this.lastStateSendTime >= this.stateSendInterval) {
      this.lastStateSendTime = now;
      const s = this.game.boat.state;
      this.net.send({
        type: 'state',
        x: s.x,
        z: s.z,
        yaw: s.yaw,
        speed: s.speed,
        boosting: this.game.boat.boosting,
        hp: this.game.player.hp,
        alive: this.game.player.alive,
      });
    }

    // 2. Interpolate remote player boats
    for (const rp of this.remotePlayers.values()) {
      rp.updateInterpolation(dt, t);
    }

    // 3. Update health orbs and check local claim
    if (this.matchState === 'playing') {
      const s = this.game.boat.state;
      for (const orb of this.orbs.values()) {
        const wh = waveHeight(orb.x, orb.z, t);
        orb.g.position.y = wh;
        orb.flask.rotation.y = t * 1.5;

        // Proximity check for local pickup (pickup radius = 8.5)
        // Do not let someone consume orb if they already have full hp
        if (this.game.player.alive && this.game.player.hp < this.game.player.maxHp && !this.claimedOrbIds.has(orb.id)) {
          const dist = Math.hypot(orb.x - s.x, orb.z - s.z);
          if (dist < 8.5) {
            this.claimedOrbIds.add(orb.id);
            this.net.send({ type: 'claimOrb', orbId: orb.id });
          }
        }
      }
    }
  }

  getTargets() {
    // Return remote players as targets for local combat collision checks
    return [...this.remotePlayers.values()];
  }
}
