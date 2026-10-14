// public/js/mpHud.js
// Multiplayer UI management:
// Settings integration, Room lobby, Countdown overlay,
// Compact left scoreboard with live ping, and Winner screen with 3D trophy.

import * as THREE from 'three';
import { buildTrophy } from './new_assets/trophy.js';
import { MP } from './config.js';
import { MULTIPLAYER_BOATS } from './multiplayerBoats.js';

export class MultiplayerHUD {
  constructor(mpManager) {
    this.mp = mpManager;
    this.trophyViewer = null;

    this.cacheElements();
    this.setupListeners();
    this.loadSavedName();
    this.setMode('offline');
  }

  cacheElements() {
    // Settings modal elements
    this.elModeOffline = document.getElementById('mp-mode-offline');
    this.elModeOnline = document.getElementById('mp-mode-online');
    this.elOnlinePanel = document.getElementById('mp-online-panel');
    this.elNameInput = document.getElementById('mp-name-input');
    this.elCodeInput = document.getElementById('mp-code-input');
    this.elCreateBtn = document.getElementById('mp-create-btn');
    this.elJoinBtn = document.getElementById('mp-join-btn');
    this.elErrorMsg = document.getElementById('mp-error');
    this.elSettingsOfflineView = document.getElementById('settings-offline-view');
    this.elSettingsOnlineView = document.getElementById('settings-online-view');
    this.elSettingsOnlinePlayerName = document.getElementById('settings-online-player-name');
    this.elSettingsOnlineRoomCode = document.getElementById('settings-online-room-code');
    this.elSettingsOnlineLeaveBtn = document.getElementById('settings-online-leave-btn');
    this.elOfflineBoatSkinSection = document.getElementById('offline-boat-skin-section');

    // Lobby modal elements
    this.elLobbyModal = document.getElementById('mp-lobby-modal');
    this.elLobbyLeave = document.getElementById('mp-lobby-leave');
    this.elRoomCodeText = document.getElementById('mp-room-code-text');
    this.elCopyCodeBtn = document.getElementById('mp-copy-code-btn');
    this.elPlayerCountNum = document.getElementById('mp-player-count-num');
    this.elPlayerList = document.getElementById('mp-player-list');
    this.elLobbyStatus = document.getElementById('mp-lobby-status');
    this.elStartMatchBtn = document.getElementById('mp-start-match-btn');
    this.elReadyBtn = document.getElementById('mp-ready-btn');
    this.elLobbyLeaveBtn = document.getElementById('mp-leave-btn');
    this.isReady = false;

    // Skin dropdown elements
    this.elLobbySkinBtn = document.getElementById('mp-lobby-skin-btn');
    this.elLobbySkinPanel = document.getElementById('mp-lobby-skin-panel');
    this.elSettingsOnlineSkinBtn = document.getElementById('settings-online-skin-btn');
    this.elSettingsOnlineSkinPanel = document.getElementById('settings-online-skin-panel');

    // Countdown overlay
    this.elCountdownOverlay = document.getElementById('mp-countdown-overlay');
    this.elCountdownNumber = document.getElementById('mp-countdown-number');

    // In-game scoreboard
    this.elScoreboard = document.getElementById('mp-scoreboard');
    this.elScoreboardList = document.getElementById('mp-scoreboard-list');
    this.elPingIndicator = document.getElementById('mp-ping-indicator');

    // Game over screen
    this.elGameOverModal = document.getElementById('mp-gameover-modal');
    this.elWinnerName = document.getElementById('mp-winner-name');
    this.elWinnerBanner = document.getElementById('mp-winner-banner');
    this.elTrophyCanvas = document.getElementById('mp-trophy-canvas');
    this.elFinalStandings = document.getElementById('mp-final-standings');
    this.elRestartBtn = document.getElementById('mp-restart-btn');
    this.elRestartStatus = document.getElementById('mp-restart-status');
    this.elGameOverLeaveBtn = document.getElementById('mp-gameover-leave-btn');
  }

  loadSavedName() {
    try {
      const saved = localStorage.getItem('boom_boats_player_name');
      if (saved && this.elNameInput) {
        this.elNameInput.value = saved.trim().slice(0, 16);
        this.updateButtonsState();
      }
    } catch {}
  }

  saveName(name) {
    try {
      localStorage.setItem('boom_boats_player_name', name.trim().slice(0, 16));
    } catch {}
  }

  setupListeners() {
    // Mode toggle in settings
    if (this.elModeOffline && this.elModeOnline) {
      this.elModeOffline.addEventListener('click', () => this.setMode('offline'));
      this.elModeOnline.addEventListener('click', () => this.setMode('online'));
    }

    // Name input validation
    if (this.elNameInput) {
      this.elNameInput.addEventListener('input', () => {
        this.updateButtonsState();
        this.clearError();
      });
    }

    if (this.elCodeInput) {
      this.elCodeInput.addEventListener('input', () => {
        this.elCodeInput.value = this.elCodeInput.value.toUpperCase().replace(/[^23456789ABCDEFGHJKMNPQRSTUVWXYZ]/g, '').slice(0, 5);
        this.updateButtonsState();
        this.clearError();
      });
    }

    // Create Room button
    if (this.elCreateBtn) {
      this.elCreateBtn.addEventListener('click', () => {
        const name = this.getName();
        if (!name) return;
        this.saveName(name);
        this.clearError();
        this.elCreateBtn.disabled = true;
        this.mp.playerName = name;
        this.mp.net.connect();
        this.mp.net.send({ type: 'createRoom', name });
      });
    }

    // Join Room button
    if (this.elJoinBtn) {
      this.elJoinBtn.addEventListener('click', () => {
        const name = this.getName();
        const code = (this.elCodeInput ? this.elCodeInput.value : '').trim().toUpperCase();
        if (!name || code.length !== 5) return;
        this.saveName(name);
        this.clearError();
        this.elJoinBtn.disabled = true;
        this.mp.playerName = name;
        this.mp.net.connect();
        this.mp.net.send({ type: 'joinRoom', code, name });
      });
    }

    // Copy room code
    if (this.elCopyCodeBtn) {
      this.elCopyCodeBtn.addEventListener('click', () => {
        if (!this.mp.roomCode) return;
        navigator.clipboard.writeText(this.mp.roomCode).then(() => {
          this.elCopyCodeBtn.textContent = '✓ Copied!';
          setTimeout(() => {
            if (this.elCopyCodeBtn) this.elCopyCodeBtn.textContent = '📋 Copy';
          }, 1500);
        }).catch(() => {});
      });
    }

    // Lobby action buttons
    const leaveHandler = () => {
      this.mp.leaveRoom();
      this.hideLobby();
      this.hideGameOver();
      this.setMode('offline');
      const settingsModal = document.getElementById('settings-modal');
      if (settingsModal) settingsModal.classList.add('hidden');
      if (this.mp.game && this.mp.game.teleportLocalPlayer) {
        this.mp.game.teleportLocalPlayer(0, 0, 0);
      }
      if (this.mp.game && this.mp.game.hud) {
        this.mp.game.hud.toast('Left room. Returned to resort. ⚓', 2500);
      }
    };

    if (this.elLobbyLeave) this.elLobbyLeave.addEventListener('click', leaveHandler);
    if (this.elLobbyLeaveBtn) this.elLobbyLeaveBtn.addEventListener('click', leaveHandler);
    if (this.elGameOverLeaveBtn) this.elGameOverLeaveBtn.addEventListener('click', leaveHandler);
    if (this.elSettingsOnlineLeaveBtn) this.elSettingsOnlineLeaveBtn.addEventListener('click', leaveHandler);

    if (this.elStartMatchBtn) {
      this.elStartMatchBtn.addEventListener('click', () => {
        if (!this.mp.isHost) return;
        this.elStartMatchBtn.disabled = true;
        this.mp.startMatch();
      });
    }

    if (this.elReadyBtn) {
      this.elReadyBtn.addEventListener('click', () => {
        this.toggleReady();
      });
    }

    if (this.elRestartBtn) {
      this.elRestartBtn.addEventListener('click', () => {
        this.elRestartBtn.disabled = true;
        this.mp.restartMatch();
      });
    }

    // Skin toggle button listeners
    if (this.elLobbySkinBtn && this.elLobbySkinPanel) {
      this.elLobbySkinBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const willOpen = this.elLobbySkinPanel.classList.contains('hidden');
        this.elLobbySkinPanel.classList.toggle('hidden', !willOpen);
        this.elLobbySkinBtn.classList.toggle('open', willOpen);
      });
    }

    if (this.elSettingsOnlineSkinBtn && this.elSettingsOnlineSkinPanel) {
      this.elSettingsOnlineSkinBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const willOpen = this.elSettingsOnlineSkinPanel.classList.contains('hidden');
        this.elSettingsOnlineSkinPanel.classList.toggle('hidden', !willOpen);
        this.elSettingsOnlineSkinBtn.classList.toggle('open', willOpen);
      });
    }

    // Ping & Network Status update
    this.mp.net.onPing = (rtt) => {
      if (this.elPingIndicator) {
        this.elPingIndicator.textContent = `📶 ${rtt}ms`;
        this.elPingIndicator.style.color = '';
      }
    };

    this.mp.net.onStatusChange = (status) => {
      if (status === 'disconnected') {
        if (this.elPingIndicator) {
          this.elPingIndicator.textContent = '⚠️ Reconnecting...';
          this.elPingIndicator.style.color = '#ff6b6b';
        }
        if (this.mp.game?.hud?.toast) {
          this.mp.game.hud.toast('⚠️ Connection lost to server. Reconnecting…', 2500);
        }
      } else if (status === 'connected') {
        if (this.elPingIndicator) {
          this.elPingIndicator.style.color = '';
        }
      }
    };

    // Manager event hooks
    this.mp.onRoomJoined = (info) => this.showLobby(info);
    this.mp.onPlayerListUpdate = (players) => this.updateLobbyPlayerList(players);
    this.mp.onPlayerReadyUpdate = (msg) => this.updateLobbyPlayerList(msg.players);
    this.mp.onPlayerSkinUpdate = () => this.renderLobbyBoatPicker();
    this.mp.onCountdown = (sec) => this.runCountdown(sec);
    this.mp.onMatchStart = () => this.handleMatchStarted();
    this.mp.onStandingsUpdate = (standings) => this.updateScoreboard(standings);
    this.mp.onMatchOver = (data) => this.showGameOver(data);
    this.mp.onMatchReset = (standings) => this.handleMatchReset(standings);
    this.mp.onError = (msg) => {
      if (this.elStartMatchBtn && this.mp.isHost) this.elStartMatchBtn.disabled = false;
      this.showError(msg);
    };
  }

  getBoatDisplayName(skinKey) {
    const found = MULTIPLAYER_BOATS.find(b => b.id === skinKey);
    return found ? `${found.icon} ${found.name}` : '🛥️ Boat';
  }

  renderBoatPickerInto(prefix) {
    const btnTitle = document.getElementById(`${prefix}-skin-title`);
    const btnIcon = document.getElementById(`${prefix}-skin-icon`);
    const btnDot = document.getElementById(`${prefix}-skin-dot`);
    const btnColorName = document.getElementById(`${prefix}-skin-color-name`);

    const activeIcon = document.getElementById(`${prefix}-active-icon`);
    const activeName = document.getElementById(`${prefix}-active-name`);
    const activeBadge = document.getElementById(`${prefix}-active-badge`);
    const activeDesc = document.getElementById(`${prefix}-active-desc`);

    const swatchesContainer = document.getElementById(`${prefix}-paint-swatches`);
    const optionsContainer = document.getElementById(prefix === 'mp-lobby' ? 'mp-lobby-boat-picker' : 'settings-online-boat-picker');

    const currentSkin = this.mp.localBoatSkin || 'reefbreaker';
    const currentColorIndex = this.mp.localColorIndex !== undefined ? this.mp.localColorIndex : 0;
    const currentColor = MP.colors[currentColorIndex] || MP.colors[0];

    const currentBoatDef = MULTIPLAYER_BOATS.find(b => b.id === currentSkin) || MULTIPLAYER_BOATS[0];

    // 1. Update Skin Toggle Button
    if (btnTitle) btnTitle.textContent = `Skin: ${currentBoatDef.name}`;
    if (btnIcon) btnIcon.textContent = currentBoatDef.icon;
    if (btnDot) btnDot.style.backgroundColor = currentColor.hex || '#ff7a59';
    if (btnColorName) btnColorName.textContent = currentColor.name || 'Color';

    // 2. Update Active Boat Preview Card
    if (activeIcon) activeIcon.textContent = currentBoatDef.icon;
    if (activeName) activeName.textContent = currentBoatDef.name;
    if (activeBadge) {
      activeBadge.textContent = currentBoatDef.badge || 'PRO';
      activeBadge.style.backgroundColor = currentColor.hex || '#ff8a3d';
    }
    if (activeDesc) activeDesc.textContent = currentBoatDef.desc || 'Multiplayer combat vessel';

    // 3. Render Paint Color Swatches
    if (swatchesContainer) {
      swatchesContainer.innerHTML = '';
      MP.colors.forEach((c, idx) => {
        const swatch = document.createElement('button');
        swatch.type = 'button';
        swatch.className = 'mp-paint-swatch-btn';
        swatch.style.backgroundColor = c.hex;
        swatch.title = `${c.name} (${c.icon || '🎨'})`;
        if (idx === currentColorIndex) {
          swatch.classList.add('active');
          swatch.textContent = '✓';
          swatch.style.color = '#fff';
        }
        swatch.addEventListener('click', (e) => {
          e.stopPropagation();
          this.mp.selectSkin(currentSkin, idx);
          this.renderLobbyBoatPicker();
          this.renderSettingsBoatPicker();
        });
        swatchesContainer.appendChild(swatch);
      });
    }

    // 4. Render All Skin Option Cards
    if (optionsContainer) {
      optionsContainer.innerHTML = '';
      MULTIPLAYER_BOATS.forEach((b) => {
        const card = document.createElement('div');
        card.className = 'mp-skin-option-card';
        const isActive = (currentSkin === b.id);
        if (isActive) {
          card.classList.add('active');
          card.style.borderColor = currentColor.hex || '#ff8a3d';
        }

        const iconEl = document.createElement('div');
        iconEl.className = 'mp-skin-option-icon';
        iconEl.textContent = b.icon;

        const infoEl = document.createElement('div');
        infoEl.className = 'mp-skin-option-info';

        const headerEl = document.createElement('div');
        headerEl.className = 'mp-skin-option-header';

        const nameEl = document.createElement('span');
        nameEl.className = 'mp-skin-option-name';
        nameEl.textContent = b.name;

        const badgeEl = document.createElement('span');
        badgeEl.className = 'mp-skin-option-badge';
        badgeEl.textContent = b.badge || 'PRO';
        if (isActive) {
          badgeEl.style.backgroundColor = currentColor.hex || '#ff8a3d';
          badgeEl.style.color = '#fff';
        }

        headerEl.appendChild(nameEl);
        headerEl.appendChild(badgeEl);

        const descEl = document.createElement('div');
        descEl.className = 'mp-skin-option-desc';
        descEl.textContent = b.desc;

        infoEl.appendChild(headerEl);
        infoEl.appendChild(descEl);

        const actionEl = document.createElement('div');
        actionEl.className = 'mp-skin-option-action';
        actionEl.textContent = isActive ? 'Equipped ✓' : 'Select';
        if (isActive) {
          actionEl.style.backgroundColor = currentColor.hex || '#22c55e';
        }

        card.appendChild(iconEl);
        card.appendChild(infoEl);
        card.appendChild(actionEl);

        card.addEventListener('click', (e) => {
          e.stopPropagation();
          if (currentSkin === b.id) {
            // Clicked already equipped skin -> cycle to next paint color!
            const nextColorIdx = (currentColorIndex + 1) % MP.colors.length;
            this.mp.selectSkin(b.id, nextColorIdx);
          } else {
            // Clicked different skin -> equip it with current paint color!
            this.mp.selectSkin(b.id, currentColorIndex);
          }
          this.renderLobbyBoatPicker();
          this.renderSettingsBoatPicker();
        });

        optionsContainer.appendChild(card);
      });
    }
  }

  renderLobbyBoatPicker() {
    this.renderBoatPickerInto('mp-lobby');
  }

  renderSettingsBoatPicker() {
    this.renderBoatPickerInto('settings-online');
  }

  toggleReady() {
    if (this.mp.isHost) return;
    this.isReady = !this.isReady;
    this.updateReadyButtonUI();
    this.mp.setReady(this.isReady);
  }

  updateReadyButtonUI() {
    if (!this.elReadyBtn) return;
    if (this.isReady) {
      this.elReadyBtn.textContent = '❌ Cancel Ready';
      this.elReadyBtn.classList.add('is-ready');
    } else {
      this.elReadyBtn.textContent = '✅ Ready';
      this.elReadyBtn.classList.remove('is-ready');
    }
  }

  getName() {
    return this.elNameInput ? this.elNameInput.value.trim().slice(0, 16) : '';
  }

  updateButtonsState() {
    const nameValid = this.getName().length > 0;
    const codeValid = this.elCodeInput ? this.elCodeInput.value.trim().length === 5 : false;

    if (this.elCreateBtn) this.elCreateBtn.disabled = !nameValid;
    if (this.elJoinBtn) this.elJoinBtn.disabled = !(nameValid && codeValid);
  }

  setMode(mode) {
    const tipEl = document.getElementById('settings-tip-text');
    if (mode === 'online') {
      this.elModeOnline?.classList.add('active');
      this.elModeOffline?.classList.remove('active');
      this.elOnlinePanel?.classList.remove('hidden');
      this.elOfflineBoatSkinSection?.classList.add('hidden');
      if (tipEl) tipEl.innerHTML = 'Tip: Press <kbd>V</kbd> for cockpit view!';
      this.mp.mode = 'online';
      this.mp.net.connect();
    } else {
      this.elModeOffline?.classList.add('active');
      this.elModeOnline?.classList.remove('active');
      this.elOnlinePanel?.classList.add('hidden');
      this.elOfflineBoatSkinSection?.classList.remove('hidden');
      this.elSettingsOfflineView?.classList.remove('hidden');
      this.elSettingsOnlineView?.classList.add('hidden');
      const titleEl = document.getElementById('settings-modal-title');
      if (titleEl) titleEl.textContent = '⚙️ Settings';
      if (tipEl) tipEl.innerHTML = 'Tip: Press <kbd>O</kbd> to switch skins &bull; <kbd>V</kbd> for cockpit view!';
      if (this.mp.mode === 'online') {
        this.mp.leaveRoom();
      }
      this.mp.mode = 'offline';
      this.hideLobby();
      this.hideScoreboard();
      this.hideGameOver();
    }
  }

  showError(msg) {
    if (this.elErrorMsg) {
      this.elErrorMsg.textContent = msg;
      this.elErrorMsg.classList.remove('hidden');
    }
    this.updateButtonsState();
  }

  clearError() {
    if (this.elErrorMsg) {
      this.elErrorMsg.textContent = '';
      this.elErrorMsg.classList.add('hidden');
    }
  }

  showLobby(info) {
    // Hide settings modal while in lobby
    const settingsModal = document.getElementById('settings-modal');
    if (settingsModal) settingsModal.classList.add('hidden');

    if (this.elLobbyModal) {
      this.elLobbyModal.classList.remove('hidden');
      if (this.elRoomCodeText) this.elRoomCodeText.textContent = info.code;
      
      const selfP = info.players?.find(p => p.id === this.mp.localPlayerId);
      const isHost = selfP ? !!selfP.isHost : (info.isHost ?? this.mp.isHost);
      this.mp.isHost = isHost;
      this.isReady = isHost;
      this.updateReadyButtonUI();
      this.renderLobbyBoatPicker();
      this.updateLobbyPlayerList(info.players);
    }
  }

  hideLobby() {
    if (this.elLobbyModal) this.elLobbyModal.classList.add('hidden');
  }

  updateLobbyPlayerList(players) {
    if (!players || !Array.isArray(players)) return;
    if (this.elPlayerCountNum) this.elPlayerCountNum.textContent = players.length;

    // Authoritative host determination from player list
    const selfP = players.find(p => p.id === this.mp.localPlayerId);
    const isHost = selfP ? !!selfP.isHost : !!this.mp.isHost;
    this.mp.isHost = isHost;

    if (this.elPlayerList) {
      this.elPlayerList.innerHTML = '';
      for (const p of players) {
        const item = document.createElement('div');
        item.className = 'mp-lobby-player';
        if (p.id === this.mp.localPlayerId) item.classList.add('self');

        // Small green/red dot in front of name
        const isPlayerReady = p.isHost ? true : !!p.ready;
        const dot = document.createElement('span');
        dot.className = `mp-ready-dot ${isPlayerReady ? 'ready' : 'not-ready'}`;
        dot.title = isPlayerReady ? 'Ready' : 'Not Ready';

        const swatch = document.createElement('span');
        swatch.className = 'mp-player-swatch';
        swatch.style.color = p.color ? p.color.hex : '#ff7a59';
        swatch.textContent = (p.color ? p.color.icon : '⛵') + ' ';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'mp-player-name';
        nameSpan.textContent = p.name; // Always safe textContent

        item.appendChild(dot);
        item.appendChild(swatch);
        item.appendChild(nameSpan);

        const boatTag = document.createElement('span');
        boatTag.className = 'mp-player-boat-tag';
        boatTag.textContent = this.getBoatDisplayName(p.boatSkin);
        item.appendChild(boatTag);

        if (p.isHost) {
          const hostBadge = document.createElement('span');
          hostBadge.className = 'mp-host-badge';
          hostBadge.textContent = 'HOST 👑';
          item.appendChild(hostBadge);
        } else {
          const statusBadge = document.createElement('span');
          statusBadge.className = `mp-ready-badge ${isPlayerReady ? 'ready' : 'not-ready'}`;
          statusBadge.textContent = isPlayerReady ? 'READY' : 'NOT READY';
          item.appendChild(statusBadge);
        }

        this.elPlayerList.appendChild(item);
      }
    }

    this.renderLobbyBoatPicker();

    // Sync non-host local player ready button state
    if (!isHost) {
      if (selfP) {
        this.isReady = !!selfP.ready;
        this.updateReadyButtonUI();
      }
    }

    // STRICT Host controls vs non-host controls:
    // Non-host ONLY gets the Ready option, NEVER Start Game!
    if (this.elStartMatchBtn) {
      this.elStartMatchBtn.classList.toggle('hidden', !isHost);
      this.elStartMatchBtn.style.display = isHost ? 'flex' : 'none';
    }
    if (this.elReadyBtn) {
      this.elReadyBtn.classList.toggle('hidden', isHost);
      this.elReadyBtn.style.display = isHost ? 'none' : 'flex';
    }

    const otherPlayers = players.filter(p => !p.isHost);
    const allOthersReady = otherPlayers.length > 0 && otherPlayers.every(p => p.ready);
    const canStart = isHost && players.length >= 2 && allOthersReady;

    if (this.elStartMatchBtn && isHost) {
      this.elStartMatchBtn.disabled = !canStart;
      if (canStart) {
        this.elStartMatchBtn.textContent = '🚀 Start Match (All Ready!)';
        this.elStartMatchBtn.classList.add('ready-to-start');
      } else if (players.length < 2) {
        this.elStartMatchBtn.textContent = '🚀 Start Match (Waiting for players)';
        this.elStartMatchBtn.classList.remove('ready-to-start');
      } else {
        const notReadyCount = otherPlayers.filter(p => !p.ready).length;
        this.elStartMatchBtn.textContent = `🚀 Start Match (Waiting for ${notReadyCount} Ready)`;
        this.elStartMatchBtn.classList.remove('ready-to-start');
      }
    }

    if (this.elLobbyStatus) {
      if (players.length < 2) {
        this.elLobbyStatus.textContent = 'Waiting for players (min 2)...';
      } else if (!allOthersReady) {
        const notReadyCount = otherPlayers.filter(p => !p.ready).length;
        if (isHost) {
          this.elLobbyStatus.textContent = `Waiting for ${notReadyCount} player${notReadyCount > 1 ? 's' : ''} to ready up...`;
        } else if (!this.isReady) {
          this.elLobbyStatus.textContent = 'Click "Ready" when prepared!';
        } else {
          this.elLobbyStatus.textContent = 'You are ready! Waiting for others...';
        }
      } else {
        if (isHost) {
          this.elLobbyStatus.textContent = 'All players ready! Click Start Match.';
        } else {
          this.elLobbyStatus.textContent = 'All players ready! Waiting for host to start...';
        }
      }
    }
  }

  runCountdown(seconds) {
    this.hideLobby();
    this.hideGameOver();
    if (this.elCountdownOverlay && this.elCountdownNumber) {
      this.elCountdownOverlay.classList.remove('hidden');
      let count = seconds;
      this.elCountdownNumber.textContent = count;

      const timer = setInterval(() => {
        count--;
        if (count > 0) {
          this.elCountdownNumber.textContent = count;
        } else {
          clearInterval(timer);
          this.elCountdownNumber.textContent = 'GO!';
          setTimeout(() => {
            this.elCountdownOverlay.classList.add('hidden');
          }, 800);
        }
      }, 1000);
    }
  }

  handleMatchStarted() {
    this.hideLobby();
    this.hideGameOver();
    this.showScoreboard();
    this.updateScoreboard(this.mp.standings);
  }

  showScoreboard() {
    if (this.elScoreboard) this.elScoreboard.classList.remove('hidden');
  }

  hideScoreboard() {
    if (this.elScoreboard) this.elScoreboard.classList.add('hidden');
  }

  updateScoreboard(standings) {
    if (!this.elScoreboardList || !standings || !Array.isArray(standings)) return;
    this.elScoreboardList.innerHTML = '';

    const sorted = [...standings].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);

    sorted.forEach((p, idx) => {
      const row = document.createElement('div');
      row.className = 'mp-score-row';
      if (p.id === this.mp.localPlayerId) row.classList.add('self');

      const colSwatch = document.createElement('span');
      colSwatch.className = 'mp-score-swatch';
      colSwatch.style.color = p.color ? p.color.hex : '#fff';
      colSwatch.textContent = p.color ? p.color.icon : '⛵';

      const colName = document.createElement('span');
      colName.className = 'mp-score-name';
      colName.textContent = p.name;

      if (idx === 0 && p.kills > 0) {
        const crown = document.createElement('span');
        crown.className = 'mp-crown';
        crown.textContent = ' 👑';
        colName.appendChild(crown);
      }

      const colKills = document.createElement('span');
      colKills.className = 'mp-score-kills';
      colKills.textContent = `${p.kills} / 20`;

      row.appendChild(colSwatch);
      row.appendChild(colName);
      row.appendChild(colKills);

      this.elScoreboardList.appendChild(row);
    });
  }

  showGameOver(data) {
    this.hideLobby();
    if (this.elGameOverModal) {
      this.elGameOverModal.classList.remove('hidden');

      if (this.elWinnerName) {
        this.elWinnerName.textContent = data.winnerName;
        this.elWinnerName.style.color = data.winnerColor ? data.winnerColor.hex : '#ff7a59';
      }

      // Populate final standings
      if (this.elFinalStandings && data.standings) {
        this.elFinalStandings.innerHTML = '';
        data.standings.forEach((p, rank) => {
          const row = document.createElement('div');
          row.className = 'mp-final-row';
          if (p.id === this.mp.localPlayerId) row.classList.add('self');

          const rankSpan = document.createElement('span');
          rankSpan.className = 'mp-final-rank';
          rankSpan.textContent = `#${rank + 1}`;

          const nameSpan = document.createElement('span');
          nameSpan.className = 'mp-final-name';
          nameSpan.style.color = p.color ? p.color.hex : '#5b3a22';
          nameSpan.textContent = `${p.color ? p.color.icon : ''} ${p.name}`;

          const killsSpan = document.createElement('span');
          killsSpan.className = 'mp-final-kills';
          killsSpan.textContent = `${p.kills} kills (${p.deaths} deaths)`;

          row.appendChild(rankSpan);
          row.appendChild(nameSpan);
          row.appendChild(killsSpan);

          this.elFinalStandings.appendChild(row);
        });
      }

      // New Game controls
      const isHost = this.mp.isHost;
      if (this.elRestartBtn) {
        this.elRestartBtn.classList.toggle('hidden', !isHost);
        this.elRestartBtn.disabled = false;
      }
      if (this.elRestartStatus) {
        this.elRestartStatus.classList.toggle('hidden', isHost);
        this.elRestartStatus.textContent = 'Waiting for host to start new game...';
      }

      // Render 3D trophy on canvas
      this.startTrophyAnimation();
    }
  }

  startTrophyAnimation() {
    this.stopTrophyAnimation();
    if (!this.elTrophyCanvas) return;

    const canvas = this.elTrophyCanvas;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(canvas.width, canvas.height);

    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xfff5e6, 1.6));
    const dirLight = new THREE.DirectionalLight(0xfff0c8, 2.2);
    dirLight.position.set(6, 12, 8);
    scene.add(dirLight);

    const camera = new THREE.PerspectiveCamera(40, canvas.width / canvas.height, 0.1, 100);
    camera.position.set(0, 3.2, 9.5);
    camera.lookAt(0, 2.8, 0);

    const trophy = buildTrophy({ carried: false });
    scene.add(trophy);

    let reqId = null;
    const render = (time) => {
      trophy.rotation.y = time * 0.0016;
      if (trophy.userData && trophy.userData.tick) {
        trophy.userData.tick(time * 0.001, 0.016);
      }
      renderer.render(scene, camera);
      reqId = requestAnimationFrame(render);
    };
    reqId = requestAnimationFrame(render);

    this.trophyViewer = {
      stop: () => {
        if (reqId) cancelAnimationFrame(reqId);
        renderer.dispose();
      }
    };
  }

  stopTrophyAnimation() {
    if (this.trophyViewer) {
      this.trophyViewer.stop();
      this.trophyViewer = null;
    }
  }

  hideGameOver() {
    this.stopTrophyAnimation();
    if (this.elGameOverModal) this.elGameOverModal.classList.add('hidden');
  }

  handleMatchReset(standings) {
    this.hideGameOver();
    this.updateScoreboard(standings);
    this.runCountdown(3);
  }
}
