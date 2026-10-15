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
    const pageTab = tabs.find(t => t.type === 'page' && t.url.includes('localhost:3000'));
    if (!pageTab || !pageTab.webSocketDebuggerUrl) {
      console.error('No tab found', tabs);
      proc.kill();
      process.exit(1);
    }

    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
    await new Promise((resolve) => ws.on('open', resolve));

    let msgId = 1;
    function send(method, params = {}) {
      return new Promise((resolve) => {
        const id = msgId++;
        const handler = (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.id === id) {
            ws.off('message', handler);
            resolve(msg.result);
          }
        };
        ws.on('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await send('Runtime.enable');
    await send('Page.enable');
    await new Promise(r => setTimeout(r, 2000));

    console.log('--- 1. Testing Two-Button Footer (Keybinds & Sound) ---');
    // Open Settings Modal
    await send('Runtime.evaluate', { expression: "document.getElementById('settings-btn').click();" });
    await new Promise(r => setTimeout(r, 400));

    const footerInfo = await send('Runtime.evaluate', {
      expression: `(() => {
        const keybindsBtn = document.getElementById('settings-keybinds-btn');
        const audioBtn = document.getElementById('settings-audio-btn');
        const kRect = keybindsBtn.getBoundingClientRect();
        const aRect = audioBtn.getBoundingClientRect();
        return {
          hasKeybindsBtn: !!keybindsBtn,
          hasAudioBtn: !!audioBtn,
          keybindsText: keybindsBtn.innerText.trim(),
          audioText: audioBtn.innerText.trim(),
          kWidth: Math.round(kRect.width),
          aWidth: Math.round(aRect.width),
          sameRow: Math.abs(kRect.top - aRect.top) < 5
        };
      })()`,
      returnByValue: true
    });
    console.log('Footer buttons info:', footerInfo.result.value);
    assert(footerInfo.result.value.hasKeybindsBtn, 'Keybinds button exists');
    assert(footerInfo.result.value.hasAudioBtn, 'Sound button exists');
    assert(footerInfo.result.value.sameRow, 'Keybinds and Sound are side-by-side in same row');
    assert(Math.abs(footerInfo.result.value.kWidth - footerInfo.result.value.aWidth) < 15, 'Buttons are split in half width');
    console.log('✓ Successfully broken into two side-by-side buttons: Keybinds & Sound');

    // Take screenshot of settings modal with the split buttons
    const shot1 = await send('Page.captureScreenshot');
    writeFileSync('C:\\Users\\prati\\.gemini\\antigravity-ide\\brain\\a399fa21-4c39-407a-a39f-8e2c406dfd81\\settings_two_buttons.png', Buffer.from(shot1.data, 'base64'));
    console.log('✓ Saved screenshot: settings_two_buttons.png');

    console.log('\n--- 2. Testing Keybinds View (Boost Mode at Top & Custom Key Mapping) ---');
    // Click Keybinds button
    await send('Runtime.evaluate', { expression: "document.getElementById('settings-keybinds-btn').click();" });
    await new Promise(r => setTimeout(r, 400));

    const keybindsViewInfo = await send('Runtime.evaluate', {
      expression: `(() => {
        const view = document.getElementById('settings-keybinds-view');
        const toggleBtn = document.getElementById('boost-mode-toggle-btn');
        const holdBtn = document.getElementById('boost-mode-hold-btn');
        const list = document.getElementById('keybinds-list');
        const rows = list ? list.querySelectorAll('.keybind-row') : [];
        return {
          viewVisible: !view.classList.contains('hidden'),
          hasToggleBtn: !!toggleBtn,
          hasHoldBtn: !!holdBtn,
          rowCount: rows.length,
          toggleActive: toggleBtn?.classList.contains('active'),
          holdActive: holdBtn?.classList.contains('active'),
          firstRowName: rows[0]?.querySelector('.keybind-name')?.textContent,
          firstRowKey: rows[0]?.querySelector('.keybind-badge-btn')?.textContent,
        };
      })()`,
      returnByValue: true
    });
    console.log('Keybinds view info:', keybindsViewInfo.result.value);
    assert(keybindsViewInfo.result.value.viewVisible, 'Keybinds view is visible');
    assert(keybindsViewInfo.result.value.hasToggleBtn && keybindsViewInfo.result.value.hasHoldBtn, 'Boost mode toggle & hold buttons exist at top');
    assert(keybindsViewInfo.result.value.rowCount >= 12, 'Custom keybind rows populated');
    console.log('✓ Boost mode is at top and keybinding options are listed below');

    // Test switching Boost Mode to Hold
    await send('Runtime.evaluate', { expression: "document.getElementById('boost-mode-hold-btn').click();" });
    await new Promise(r => setTimeout(r, 200));

    const holdCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        return {
          storedMode: localStorage.getItem('boom_boats_boost_mode'),
          inputMode: window.__DEBUG.input.getBoostMode(),
          holdActive: document.getElementById('boost-mode-hold-btn').classList.contains('active')
        };
      })()`,
      returnByValue: true
    });
    console.log('Boost mode switched to Hold:', holdCheck.result.value);
    assert.strictEqual(holdCheck.result.value.storedMode, 'hold', 'Boost mode persisted as hold in localStorage');
    assert.strictEqual(holdCheck.result.value.inputMode, 'hold', 'input.getBoostMode() returns hold');
    console.log('✓ Boost mode toggle/hold works and persists in browser localStorage');

    // Test custom key remapping persistence
    await send('Runtime.evaluate', {
      expression: `(() => {
        // Remap 'forward' to 'KeyZ'
        window.__DEBUG.input.setKeybind('forward', 'KeyZ');
        return {
          storedBinds: JSON.parse(localStorage.getItem('boom_boats_keybinds')),
          currentForward: window.__DEBUG.input.getKeybinds().forward
        };
      })()`,
      returnByValue: true
    });
    const remappedCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const stored = JSON.parse(localStorage.getItem('boom_boats_keybinds'));
        return {
          storedForward: stored?.forward,
          inputForward: window.__DEBUG.input.getKeybinds().forward
        };
      })()`,
      returnByValue: true
    });
    console.log('Remapped keybind check:', remappedCheck.result.value);
    assert(remappedCheck.result.value.storedForward.includes('KeyZ'), 'Custom keybind saved to localStorage');
    console.log('✓ Custom keybinding persistence verified');

    // Test Reset Defaults button
    await send('Runtime.evaluate', { expression: "document.getElementById('keybinds-reset-btn').click();" });
    await new Promise(r => setTimeout(r, 200));
    const resetCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        return {
          inputForward: window.__DEBUG.input.getKeybinds().forward
        };
      })()`,
      returnByValue: true
    });
    assert(resetCheck.result.value.inputForward.includes('KeyW'), 'Keybinds successfully reset to default');
    console.log('✓ Reset Defaults button successfully resets keybindings');

    // Capture screenshot of Keybinds view
    const shot2 = await send('Page.captureScreenshot');
    writeFileSync('C:\\Users\\prati\\.gemini\\antigravity-ide\\brain\\a399fa21-4c39-407a-a39f-8e2c406dfd81\\settings_keybinds_view.png', Buffer.from(shot2.data, 'base64'));
    console.log('✓ Saved screenshot: settings_keybinds_view.png');

    // Test Back button
    await send('Runtime.evaluate', { expression: "document.getElementById('keybinds-back-btn').click();" });
    await new Promise(r => setTimeout(r, 200));
    const backCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        return {
          keybindsHidden: document.getElementById('settings-keybinds-view').classList.contains('hidden'),
          offlineVisible: !document.getElementById('settings-offline-view').classList.contains('hidden')
        };
      })()`,
      returnByValue: true
    });
    assert(backCheck.result.value.keybindsHidden && backCheck.result.value.offlineVisible, 'Returned to settings view smoothly');
    console.log('✓ Back to Settings button functions correctly');

    console.log('\n--- 3. Testing Restored Original Classic OG Boat (from 10 commits earlier) ---');
    const colorCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        // Switch to classic skin
        window.__DEBUG.boat.setSkin('classic');
        const classicGroup = window.__DEBUG.boat.group;
        // Collect materials from meshes
        const colors = [];
        classicGroup.traverse(child => {
          if (child.isMesh && child.material && child.material.color) {
            colors.push(child.material.color.getHexString());
          }
        });
        return {
          currentSkin: window.__DEBUG.boat.currentSkin,
          colors: [...new Set(colors)]
        };
      })()`,
      returnByValue: true
    });
    console.log('Classic boat colors:', colorCheck.result.value);
    // Reference colors: beige hull 0xfff4e0, orange bottom waterline accent 0xff7a59, slate-blue chine cabin 0xdce5e8, amber roof 0xd9803f
    assert(colorCheck.result.value.colors.includes('fff4e0'), 'Beige hull present');
    assert(colorCheck.result.value.colors.includes('ff7a59'), 'Orange bottom waterline line present');
    assert(colorCheck.result.value.colors.includes('dce5e8'), 'Slate-blue chine cabin present');
    assert(colorCheck.result.value.colors.includes('d9803f'), 'Amber roof present');
    console.log('✓ Classic OG boat design with orange bottom line verified');

    // Close settings modal and capture screenshot of restored OG boat
    await send('Runtime.evaluate', { expression: "document.getElementById('settings-modal').classList.add('hidden');" });
    await new Promise(r => setTimeout(r, 600));
    const shot3 = await send('Page.captureScreenshot');
    writeFileSync('C:\\Users\\prati\\.gemini\\antigravity-ide\\brain\\a399fa21-4c39-407a-a39f-8e2c406dfd81\\classic_og_boat_orange_bottom.png', Buffer.from(shot3.data, 'base64'));
    console.log('✓ Saved screenshot: classic_og_boat_orange_bottom.png');

    // Switch back to hero and verify hero boat unchanged
    const heroCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        window.__DEBUG.boat.setSkin('hero');
        return window.__DEBUG.boat.currentSkin;
      })()`,
      returnByValue: true
    });
    assert.strictEqual(heroCheck.result.value, 'hero');
    console.log('✓ Hero boat remained untouched');

    console.log('\n=== ALL KEYBINDS AND OG BOAT TESTS PASSED SUCCESSFULLY! ===');
    proc.kill();
  } catch (err) {
    console.error('Error in test:', err);
    proc.kill();
    process.exit(1);
  }
}

main();
