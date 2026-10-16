import { spawn } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs';

async function main() {
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9229',
    '--user-data-dir=' + process.env.TEMP + '\\chrome_test_' + Date.now(),
    '--disable-gpu',
    '--window-size=1280,720',
    'http://localhost:3000'
  ], { stdio: 'ignore' });

  await new Promise(r => setTimeout(r, 2000));

  try {
    const res = await fetch('http://127.0.0.1:9229/json');
    const tabs = await res.json();
    const pageTab = tabs.find(t => t.type === 'page' && t.url.includes('localhost:3000'));
    if (!pageTab) {
      console.error('No tab found', tabs);
      proc.kill();
      return;
    }

    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
    await new Promise(r => ws.on('open', r));
    ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));

    const evalPromise = (expression) => new Promise(resolve => {
      const id = Math.floor(Math.random() * 100000);
      const h = data => {
        const m = JSON.parse(data.toString());
        if (m.id === id) {
          ws.off('message', h);
          resolve(m.result?.result?.value);
        }
      };
      ws.on('message', h);
      ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
    });

    console.log('--- 1. Testing Start Screen WebP & Preload ---');
    const webpStat = fs.statSync('public/images/startscreen.webp');
    console.log(`WebP file exists! Size: ${webpStat.size} bytes (< 250KB)`);
    if (webpStat.size > 250000) throw new Error('WebP is unexpectedly large');

    const domPreloadCheck = await evalPromise(`(() => {
      const preload = document.querySelector('link[rel="preload"][href*="startscreen.webp"]');
      const picture = document.querySelector('picture.start-screen-art');
      const source = picture?.querySelector('source[srcset*="startscreen.webp"]');
      const img = picture?.querySelector('img');
      return {
        hasPreload: !!preload,
        hasPicture: !!picture,
        hasSource: !!source,
        imgComplete: img ? img.complete : false
      };
    })()`);
    console.log('DOM WebP Preload Check:', domPreloadCheck);
    if (!domPreloadCheck.hasPreload || !domPreloadCheck.hasPicture || !domPreloadCheck.hasSource) {
      throw new Error('WebP preload or picture tag missing in DOM');
    }

    console.log('\n--- 2. Testing Keybinds UI Expansion & Mouse Button Recording ---');
    // Open keybinds modal
    await evalPromise(`(() => {
      const btn = document.getElementById('start-btn-keybinds');
      btn.click();
    })()`);
    await new Promise(r => setTimeout(r, 400));

    const keybindsLayout = await evalPromise(`(() => {
      const modal = document.getElementById('settings-modal');
      const list = document.getElementById('keybinds-list');
      const modalRect = modal.getBoundingClientRect();
      const listRect = list.getBoundingClientRect();
      return {
        modalWidth: modalRect.width,
        listHeight: listRect.height,
        rowsCount: list.querySelectorAll('.keybind-row').length
      };
    })()`);
    console.log('Keybinds layout dimensions:', keybindsLayout);
    if (keybindsLayout.modalWidth < 490 || keybindsLayout.listHeight < 300) {
      throw new Error(`Keybinds UI not sufficiently expanded: ${JSON.stringify(keybindsLayout)}`);
    }

    // Test mouse button recording: Click fire keybind badge, then simulate Right Click (button 2)
    const recordMouseTest = await evalPromise(`(() => {
      const rows = document.querySelectorAll('#keybinds-list .keybind-row');
      // Find row for 'Fire Weapon'
      let targetRow = null;
      for (const r of rows) {
        if (r.querySelector('.keybind-name')?.textContent?.includes('Fire Weapon')) {
          targetRow = r;
          break;
        }
      }
      if (!targetRow) targetRow = rows[0];
      const badge = targetRow.querySelector('.keybind-badge-btn');
      badge.click(); // enter recording mode
      const activeBadge = document.querySelector('.keybind-badge-btn.recording');
      return { hasActiveRecording: !!activeBadge, badgeText: activeBadge?.textContent };
    })()`);
    console.log('Keybind recording mode entered:', recordMouseTest);

    await new Promise(r => setTimeout(r, 200));
    // Dispatch right click (button 2)
    await evalPromise(`(() => {
      window.dispatchEvent(new PointerEvent('pointerdown', { button: 2, bubbles: true }));
    })()`);
    await new Promise(r => setTimeout(r, 400));

    const afterBindMouse = await evalPromise(`(() => {
      const inp = window.__DEBUG.input;
      const binds = inp.getKeybinds();
      const rows = document.querySelectorAll('#keybinds-list .keybind-row');
      let targetRow = null;
      for (const r of rows) {
        if (r.querySelector('.keybind-name')?.textContent?.includes('Fire Weapon')) {
          targetRow = r;
          break;
        }
      }
      const badge = targetRow ? targetRow.querySelector('.keybind-badge-btn') : null;
      return {
        fireBind: binds.fire,
        badgeText: badge?.textContent
      };
    })()`);
    console.log('After Mouse Button Bind:', afterBindMouse);
    if (!afterBindMouse.fireBind.includes('MouseRight') || afterBindMouse.badgeText !== 'R-Click') {
      throw new Error('Failed to record MouseRight as keybind');
    }

    // Reset keybinds to defaults
    await evalPromise(`window.__DEBUG.input.resetKeybinds()`);
    // Close modal
    await evalPromise(`document.getElementById('settings-close-btn').click()`);
    await new Promise(r => setTimeout(r, 300));

    console.log('\n--- 3. Starting Game: Testing Mouse Wheel Weapon Switching ---');
    await evalPromise(`window.__DEBUG.startGame()`);
    await new Promise(r => setTimeout(r, 500));

    const initialWeapon = await evalPromise(`window.__DEBUG.input.state.weapon`);
    console.log('Initial weapon:', initialWeapon);
    if (initialWeapon !== 'gun') throw new Error('Expected initial weapon to be gun');

    // Scroll wheel down: deltaY > 0 -> should switch to missile
    await evalPromise(`(() => {
      window.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true }));
    })()`);
    await new Promise(r => setTimeout(r, 200));

    const afterWheelDown = await evalPromise(`window.__DEBUG.input.state.weapon`);
    console.log('After wheel down:', afterWheelDown);
    if (afterWheelDown !== 'missile') throw new Error('Wheel down did not switch to missile');

    // Scroll wheel up: deltaY < 0 -> should switch to gun
    await evalPromise(`(() => {
      window.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true }));
    })()`);
    await new Promise(r => setTimeout(r, 200));

    const afterWheelUp = await evalPromise(`window.__DEBUG.input.state.weapon`);
    console.log('After wheel up:', afterWheelUp);
    if (afterWheelUp !== 'gun') throw new Error('Wheel up did not switch back to gun');

    console.log('\n--- 4. Testing Single Player Pause (Escape key & UI) ---');
    // Press Escape to pause
    ws.send(JSON.stringify({ id: 50, method: 'Input.dispatchKeyEvent', params: { type: 'keyDown', code: 'Escape', key: 'Escape', windowsVirtualKeyCode: 27 } }));
    await new Promise(r => setTimeout(r, 300));

    const pauseState = await evalPromise(`(() => {
      const overlay = document.getElementById('sp-pause-overlay');
      return {
        isPaused: window.__DEBUG.isPaused,
        overlayVisible: !overlay.classList.contains('hidden'),
        titleText: overlay.querySelector('.sp-pause-title')?.textContent
      };
    })()`);
    console.log('Pause state after ESC:', pauseState);
    if (!pauseState.isPaused || !pauseState.overlayVisible || pauseState.titleText !== 'PAUSED') {
      throw new Error(`Singleplayer pause failed: ${JSON.stringify(pauseState)}`);
    }

    // Press Escape again to unpause
    ws.send(JSON.stringify({ id: 51, method: 'Input.dispatchKeyEvent', params: { type: 'keyDown', code: 'Escape', key: 'Escape', windowsVirtualKeyCode: 27 } }));
    await new Promise(r => setTimeout(r, 300));

    const unpauseState = await evalPromise(`(() => {
      const overlay = document.getElementById('sp-pause-overlay');
      return {
        isPaused: window.__DEBUG.isPaused,
        overlayVisible: !overlay.classList.contains('hidden')
      };
    })()`);
    console.log('Unpause state after second ESC:', unpauseState);
    if (unpauseState.isPaused || unpauseState.overlayVisible) {
      throw new Error('Second ESC did not unpause');
    }

    console.log('\n--- 5. Testing Ship Reverse Acceleration (S / Down up to 30 km/h) ---');
    // Send KeyS down and simulate for 2 seconds
    ws.send(JSON.stringify({ id: 60, method: 'Input.dispatchKeyEvent', params: { type: 'keyDown', code: 'KeyS', key: 's' } }));
    await new Promise(r => setTimeout(r, 2000));

    const reverseState = await evalPromise(`(() => {
      const b = window.__DEBUG.boat;
      return {
        speed: b.state.speed,
        absSpeed: Math.abs(b.state.speed)
      };
    })()`);
    console.log('Reverse speed after 2s holding S:', reverseState);
    if (reverseState.speed >= -5 || reverseState.absSpeed < 10) {
      throw new Error(`Boat failed to reverse properly: ${JSON.stringify(reverseState)}`);
    }

    // Release KeyS
    ws.send(JSON.stringify({ id: 61, method: 'Input.dispatchKeyEvent', params: { type: 'keyUp', code: 'KeyS', key: 's' } }));
    await new Promise(r => setTimeout(r, 500));

    console.log('\n>>> ALL 5 NEW FEATURES VERIFIED AND PASSED PERFECTLY! <<<');
    ws.close();
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  } finally {
    proc.kill();
  }
}

main();
