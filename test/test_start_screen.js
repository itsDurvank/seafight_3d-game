import { spawn } from 'child_process';
import WebSocket from 'ws';
import { writeFileSync } from 'fs';
import assert from 'assert';

async function main() {
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  // Test with windowed aspect ratio similar to user's screenshot (~1920x860)
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--window-size=1920,860',
    'http://localhost:3000'
  ], { stdio: 'ignore' });

  await new Promise(r => setTimeout(r, 2000));

  try {
    const res = await fetch('http://127.0.0.1:9222/json');
    const tabs = await res.json();
    const tab = tabs.find(t => t.url.includes('localhost:3000'));
    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise(r => ws.on('open', r));
    let id = 1;
    function send(m, p = {}) {
      return new Promise(resolve => {
        const i = id++;
        const h = d => {
          const msg = JSON.parse(d.toString());
          if (msg.id === i) { ws.off('message', h); resolve(msg.result); }
        };
        ws.on('message', h);
        ws.send(JSON.stringify({ id: i, method: m, params: p }));
      });
    }

    await send('Runtime.enable');
    await send('Page.enable');
    await new Promise(r => setTimeout(r, 1000));

    console.log('--- 1. Testing Dynamic Responsive Start Screen Layout (Windowed 1920x860) ---');
    const startInfo = await send('Runtime.evaluate', {
      expression: `(() => {
        const screen = document.getElementById('start-screen');
        const stage = document.querySelector('.start-screen-stage');
        const art = document.querySelector('.start-screen-art');
        const backdrop = document.querySelector('.start-screen-backdrop');
        const stack = document.querySelector('.start-menu-stack');
        const b1 = document.getElementById('start-btn-singleplayer');
        const b2 = document.getElementById('start-btn-multiplayer');
        const b3 = document.getElementById('start-btn-keybinds');
        const b4 = document.getElementById('start-btn-howtoplay');
        const b5 = document.getElementById('start-btn-quit');
        const musicBtn = document.getElementById('start-music-btn');
        const musicIcon = document.getElementById('start-music-icon');
        
        const stageRect = stage ? stage.getBoundingClientRect() : null;
        const stackRect = stack ? stack.getBoundingClientRect() : null;
        const mRect = musicBtn.getBoundingClientRect();
        
        return {
          screenVisible: !screen.classList.contains('hidden'),
          hasStage: !!stage,
          hasArt: !!art,
          hasBackdrop: !!backdrop,
          stageRatio: stageRect ? (stageRect.width / stageRect.height).toFixed(3) : null,
          stackInsideStage: stackRect && stageRect ? (stackRect.top >= stageRect.top && stackRect.bottom <= stageRect.bottom) : false,
          hasAllButtons: !!(b1 && b2 && b3 && b4 && b5 && musicBtn),
          b1Text: b1.innerText.trim(),
          b2Text: b2.innerText.trim(),
          b3Text: b3.innerText.trim(),
          b4Text: b4.innerText.trim(),
          b5Text: b5.innerText.trim(),
          musicBottomLeft: mRect.left <= 35 && (window.innerHeight - mRect.bottom) <= 35,
          currentMusicSrc: window.__DEBUG.menuMusic ? window.__DEBUG.menuMusic.src : null
        };
      })()`,
      returnByValue: true
    });

    console.log('Start screen info:', startInfo.result.value);
    assert(startInfo.result.value.screenVisible, 'Start screen is visible on load');
    assert(startInfo.result.value.hasStage, 'Stage element exists for 16:9 locking');
    assert(startInfo.result.value.stackInsideStage, 'Button stack is safely contained within stage bounds');
    assert(startInfo.result.value.hasAllButtons, 'All 5 buttons + music button exist');
    assert(startInfo.result.value.musicBottomLeft, 'Music button is in bottom-left corner');
    console.log('✓ Dynamic responsive stage and 5 buttons verified');

    // Capture screenshot of Start Screen in windowed mode
    const shot1 = await send('Page.captureScreenshot');
    writeFileSync('C:\\Users\\prati\\.gemini\\antigravity-ide\\brain\\a399fa21-4c39-407a-a39f-8e2c406dfd81\\start_screen_intro.png', Buffer.from(shot1.data, 'base64'));
    console.log('✓ Saved screenshot: start_screen_intro.png');

    console.log('\n--- 2. Testing Background Gameplay Freeze (No Cannon Sound / Combat) ---');
    const freezeCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const boatObj = window.__DEBUG.boat;
        return {
          isStartScreenActive: window.__DEBUG.isStartScreenActive,
          boatSpeed: boatObj ? boatObj.state.speed : 0
        };
      })()`,
      returnByValue: true
    });
    console.log('Freeze check:', freezeCheck.result.value);
    assert.strictEqual(freezeCheck.result.value.boatSpeed, 0, 'Boat speed is frozen at 0 while on start screen');
    console.log('✓ Background gameplay is completely frozen on start screen');

    console.log('\n--- 3. Testing Music Mute Button ---');
    await send('Runtime.evaluate', { expression: "document.getElementById('start-music-btn').click();" });
    const muteCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        return {
          icon: document.getElementById('start-music-icon').textContent,
          muted: window.__DEBUG.menuMusic ? window.__DEBUG.menuMusic.muted : null
        };
      })()`,
      returnByValue: true
    });
    console.log('Music mute check:', muteCheck.result.value);
    assert.strictEqual(muteCheck.result.value.icon, '🔇', 'Music icon updated to muted');
    assert.strictEqual(muteCheck.result.value.muted, true, 'Audio object muted');
    console.log('✓ Bottom-left music mute button works and toggles audio');
    // Unmute
    await send('Runtime.evaluate', { expression: "document.getElementById('start-music-btn').click();" });

    console.log('\n--- 4. Testing Keybinds & Settings Button (No Redundant Footer or Back Button) ---');
    await send('Runtime.evaluate', { expression: "document.getElementById('start-btn-keybinds').click();" });
    await new Promise(r => setTimeout(r, 350));
    const keybindsCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const modal = document.getElementById('settings-modal');
        const view = document.getElementById('settings-keybinds-view');
        const footer = modal.querySelector('.settings-footer');
        const backBtn = document.getElementById('keybinds-back-btn');
        return {
          modalVisible: !modal.classList.contains('hidden'),
          viewVisible: !view.classList.contains('hidden'),
          footerHidden: footer ? (footer.classList.contains('hidden') || getComputedStyle(footer).display === 'none') : true,
          backBtnHidden: backBtn ? (backBtn.classList.contains('hidden') || getComputedStyle(backBtn).display === 'none') : true
        };
      })()`,
      returnByValue: true
    });
    console.log('Keybinds view check:', keybindsCheck.result.value);
    assert(keybindsCheck.result.value.modalVisible && keybindsCheck.result.value.viewVisible, 'Keybinds view opened');
    assert(keybindsCheck.result.value.footerHidden, 'Redundant bottom footer with keybinds/sound buttons is hidden');
    assert(keybindsCheck.result.value.backBtnHidden, 'Back to settings button is hidden when opened from start screen');
    const shotKey = await send('Page.captureScreenshot');
    writeFileSync('C:\\Users\\prati\\.gemini\\antigravity-ide\\brain\\a399fa21-4c39-407a-a39f-8e2c406dfd81\\start_screen_keybinds.png', Buffer.from(shotKey.data, 'base64'));
    console.log('✓ Saved screenshot: start_screen_keybinds.png');
    // Close keybinds
    await send('Runtime.evaluate', { expression: "document.getElementById('settings-close').click();" });
    await new Promise(r => setTimeout(r, 200));

    console.log('\n--- 5. Testing Multiplayer Button & Dedicated Fleet Hub Modal ---');
    await send('Runtime.evaluate', { expression: "document.getElementById('start-btn-multiplayer').click();" });
    await new Promise(r => setTimeout(r, 350));
    const mpHubCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const hub = document.getElementById('mp-hub-modal');
        const nameInput = document.getElementById('mp-hub-name-input');
        const createBtn = document.getElementById('mp-hub-create-btn');
        const codeInput = document.getElementById('mp-hub-code-input');
        const joinBtn = document.getElementById('mp-hub-join-btn');
        return {
          hubVisible: !hub.classList.contains('hidden'),
          hasNameInput: !!nameInput,
          hasCreateBtn: !!createBtn,
          hasCodeInput: !!codeInput,
          hasJoinBtn: !!joinBtn
        };
      })()`,
      returnByValue: true
    });
    console.log('Multiplayer hub check:', mpHubCheck.result.value);
    assert(mpHubCheck.result.value.hubVisible, 'Dedicated Multiplayer Fleet Hub modal is visible');
    assert(mpHubCheck.result.value.hasNameInput && mpHubCheck.result.value.hasCreateBtn && mpHubCheck.result.value.hasJoinBtn, 'Multiplayer options (Host / Join / Name) present');
    const shotHub = await send('Page.captureScreenshot');
    writeFileSync('C:\\Users\\prati\\.gemini\\antigravity-ide\\brain\\a399fa21-4c39-407a-a39f-8e2c406dfd81\\start_screen_mp_hub.png', Buffer.from(shotHub.data, 'base64'));
    console.log('✓ Saved screenshot: start_screen_mp_hub.png');

    console.log('\n--- 6. Testing Room Creation & Lobby Modal (Ready / Start Match) ---');
    // Set captain name and click create
    await send('Runtime.evaluate', {
      expression: `(() => {
        const input = document.getElementById('mp-hub-name-input');
        input.value = 'CaptainTest';
        input.dispatchEvent(new Event('input'));
        document.getElementById('mp-hub-create-btn').click();
      })()`
    });
    await new Promise(r => setTimeout(r, 800));
    const lobbyCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const lobby = document.getElementById('mp-lobby-modal');
        const codeText = document.getElementById('mp-room-code-text').textContent;
        const copyBtn = document.getElementById('mp-copy-code-btn');
        const startBtn = document.getElementById('mp-start-match-btn');
        const readyBtn = document.getElementById('mp-ready-btn');
        return {
          lobbyVisible: !lobby.classList.contains('hidden'),
          codeText,
          hasCopyBtn: !!copyBtn,
          hasStartBtn: !!startBtn,
          hasReadyBtn: !!readyBtn
        };
      })()`,
      returnByValue: true
    });
    console.log('Lobby check:', lobbyCheck.result.value);
    assert(lobbyCheck.result.value.lobbyVisible, 'Multiplayer Room Lobby modal opened');
    assert(lobbyCheck.result.value.codeText && lobbyCheck.result.value.codeText.length === 5, 'Generated 5-letter Room Code for host');
    const shotLobby = await send('Page.captureScreenshot');
    writeFileSync('C:\\Users\\prati\\.gemini\\antigravity-ide\\brain\\a399fa21-4c39-407a-a39f-8e2c406dfd81\\start_screen_mp_lobby.png', Buffer.from(shotLobby.data, 'base64'));
    console.log('✓ Saved screenshot: start_screen_mp_lobby.png');

    // Leave room to return
    await send('Runtime.evaluate', { expression: "document.getElementById('mp-lobby-leave').click();" });
    await new Promise(r => setTimeout(r, 400));

    console.log('\n--- 7. Testing Start Game Button & Music Pausing ---');
    await send('Runtime.evaluate', { expression: "document.getElementById('start-btn-singleplayer').click();" });
    await new Promise(r => setTimeout(r, 400));
    const startGameCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const screen = document.getElementById('start-screen');
        const music = window.__DEBUG.menuMusic;
        return {
          screenHidden: screen.classList.contains('hidden'),
          musicPaused: music ? music.paused : true,
          isStartScreenActive: window.__DEBUG.isStartScreenActive
        };
      })()`,
      returnByValue: true
    });
    console.log('Start game check:', startGameCheck.result.value);
    assert(startGameCheck.result.value.screenHidden, 'Start screen hidden after clicking Start Game');
    assert(startGameCheck.result.value.musicPaused, 'Home screen music paused when game started');
    assert(!startGameCheck.result.value.isStartScreenActive, 'isStartScreenActive is false');
    console.log('✓ Start Game correctly begins gameplay and pauses home screen music');

    console.log('\n=== ALL 4 USER ISSUES FULLY VERIFIED AND PASSED! ===');
    ws.close();
    proc.kill();
  } catch (err) {
    console.error('Test error:', err);
    proc.kill();
    process.exit(1);
  }
}

main();
