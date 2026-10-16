import { spawn } from 'child_process';
import WebSocket from 'ws';
import { writeFileSync } from 'fs';
import assert from 'assert';

async function main() {
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--window-size=1280,720',
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

    console.log('--- 1. Testing Start Screen Presence & Button Layout ---');
    const startInfo = await send('Runtime.evaluate', {
      expression: `(() => {
        const screen = document.getElementById('start-screen');
        const b1 = document.getElementById('start-btn-singleplayer');
        const b2 = document.getElementById('start-btn-multiplayer');
        const b3 = document.getElementById('start-btn-keybinds');
        const b4 = document.getElementById('start-btn-howtoplay');
        const b5 = document.getElementById('start-btn-quit');
        const musicBtn = document.getElementById('start-music-btn');
        const musicIcon = document.getElementById('start-music-icon');
        
        const mRect = musicBtn.getBoundingClientRect();
        const b1Rect = b1.getBoundingClientRect();
        const b5Rect = b5.getBoundingClientRect();
        
        return {
          screenVisible: !screen.classList.contains('hidden'),
          hasAllButtons: !!(b1 && b2 && b3 && b4 && b5 && musicBtn),
          b1Text: b1.innerText.trim(),
          b2Text: b2.innerText.trim(),
          b3Text: b3.innerText.trim(),
          b4Text: b4.innerText.trim(),
          b5Text: b5.innerText.trim(),
          b1IsPrimary: b1.classList.contains('start-menu-btn-primary'),
          musicBottomLeft: mRect.left <= 35 && (window.innerHeight - mRect.bottom) <= 35,
          mRect: { left: mRect.left, bottom: mRect.bottom, windowH: window.innerHeight },
          musicIcon: musicIcon.textContent,
          verticalStack: b1Rect.top < b5Rect.top && Math.abs(b1Rect.left - b5Rect.left) < 10,
          currentMusicSrc: window.__DEBUG.menuMusic ? window.__DEBUG.menuMusic.src : null
        };
      })()`,
      returnByValue: true
    });

    console.log('Start screen info:', startInfo.result.value);
    assert(startInfo.result.value.screenVisible, 'Start screen is visible on load');
    assert(startInfo.result.value.hasAllButtons, 'All 5 buttons + music button exist');
    assert(startInfo.result.value.b1IsPrimary, 'Button 1 is styled as primary button');
    assert(startInfo.result.value.musicBottomLeft, 'Music button is in bottom-left corner');
    assert(startInfo.result.value.verticalStack, 'Buttons are arranged in vertical stack');
    assert(startInfo.result.value.currentMusicSrc && startInfo.result.value.currentMusicSrc.includes('start_menu_'), 'Random start menu track chosen');
    console.log('✓ Start screen and 5 buttons verified');

    // Capture screenshot of Start Screen
    const shot1 = await send('Page.captureScreenshot');
    writeFileSync('C:\\Users\\prati\\.gemini\\antigravity-ide\\brain\\a399fa21-4c39-407a-a39f-8e2c406dfd81\\start_screen_intro.png', Buffer.from(shot1.data, 'base64'));
    console.log('✓ Saved screenshot: start_screen_intro.png');

    console.log('\n--- 2. Testing Music Mute Button ---');
    await send('Runtime.evaluate', { expression: "document.getElementById('start-music-btn').click();" });
    const muteCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        return {
          icon: document.getElementById('start-music-icon').textContent,
          muted: window.__DEBUG.menuMusic ? window.__DEBUG.menuMusic.muted : null,
          stored: localStorage.getItem('boom_boats_menu_music_muted')
        };
      })()`,
      returnByValue: true
    });
    console.log('Music mute check:', muteCheck.result.value);
    assert.strictEqual(muteCheck.result.value.icon, '🔇', 'Music icon updated to muted');
    assert.strictEqual(muteCheck.result.value.muted, true, 'Audio object muted');
    console.log('✓ Bottom-left music mute button works and toggles audio');

    // Toggle back to unmuted
    await send('Runtime.evaluate', { expression: "document.getElementById('start-music-btn').click();" });

    console.log('\n--- 3. Testing How to Play Modal ---');
    await send('Runtime.evaluate', { expression: "document.getElementById('start-btn-howtoplay').click();" });
    await new Promise(r => setTimeout(r, 250));
    const howToPlayCheck = await send('Runtime.evaluate', {
      expression: "!document.getElementById('how-to-play-modal').classList.contains('hidden')",
      returnByValue: true
    });
    assert(howToPlayCheck.result.value, 'How to play modal is visible');
    const shotHow = await send('Page.captureScreenshot');
    writeFileSync('C:\\Users\\prati\\.gemini\\antigravity-ide\\brain\\a399fa21-4c39-407a-a39f-8e2c406dfd81\\start_screen_how_to_play.png', Buffer.from(shotHow.data, 'base64'));
    console.log('✓ Saved screenshot: start_screen_how_to_play.png');
    // Close how to play modal
    await send('Runtime.evaluate', { expression: "document.getElementById('how-to-play-close').click();" });
    await new Promise(r => setTimeout(r, 200));

    console.log('\n--- 4. Testing Quit Modal ---');
    await send('Runtime.evaluate', { expression: "document.getElementById('start-btn-quit').click();" });
    await new Promise(r => setTimeout(r, 250));
    const quitCheck = await send('Runtime.evaluate', {
      expression: "!document.getElementById('quit-modal').classList.contains('hidden')",
      returnByValue: true
    });
    assert(quitCheck.result.value, 'Quit modal is visible');
    const shotQuit = await send('Page.captureScreenshot');
    writeFileSync('C:\\Users\\prati\\.gemini\\antigravity-ide\\brain\\a399fa21-4c39-407a-a39f-8e2c406dfd81\\start_screen_quit.png', Buffer.from(shotQuit.data, 'base64'));
    console.log('✓ Saved screenshot: start_screen_quit.png');
    // Close quit modal
    await send('Runtime.evaluate', { expression: "document.getElementById('quit-modal-cancel').click();" });
    await new Promise(r => setTimeout(r, 200));

    console.log('\n--- 5. Testing Keybinds & Settings Button ---');
    await send('Runtime.evaluate', { expression: "document.getElementById('start-btn-keybinds').click();" });
    await new Promise(r => setTimeout(r, 300));
    const keybindsCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const modal = document.getElementById('settings-modal');
        const view = document.getElementById('settings-keybinds-view');
        return {
          modalVisible: !modal.classList.contains('hidden'),
          viewVisible: !view.classList.contains('hidden')
        };
      })()`,
      returnByValue: true
    });
    console.log('Keybinds view from menu check:', keybindsCheck.result.value);
    assert(keybindsCheck.result.value.modalVisible && keybindsCheck.result.value.viewVisible, 'Keybinds view opened directly from start menu');
    const shotKey = await send('Page.captureScreenshot');
    writeFileSync('C:\\Users\\prati\\.gemini\\antigravity-ide\\brain\\a399fa21-4c39-407a-a39f-8e2c406dfd81\\start_screen_keybinds.png', Buffer.from(shotKey.data, 'base64'));
    console.log('✓ Saved screenshot: start_screen_keybinds.png');
    // Close settings modal
    await send('Runtime.evaluate', { expression: "document.getElementById('settings-close').click();" });
    await new Promise(r => setTimeout(r, 200));

    console.log('\n--- 6. Testing Start Game Button & Music Pausing ---');
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

    console.log('\n=== ALL START SCREEN AND MUSIC TESTS PASSED! ===');
    ws.close();
    proc.kill();
  } catch (err) {
    console.error('Test error:', err);
    proc.kill();
    process.exit(1);
  }
}

main();
