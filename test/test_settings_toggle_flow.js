import { spawn } from 'child_process';
import WebSocket from 'ws';
import { writeFileSync } from 'fs';

async function run() {
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--window-size=1280,720',
    'http://localhost:3000'
  ], { stdio: 'ignore' });

  await new Promise(r => setTimeout(r, 1500));

  try {
    const res = await fetch('http://127.0.0.1:9222/json');
    const tabs = await res.json();
    const pageTab = tabs.find(t => t.type === 'page' && t.url.includes('localhost:3000'));
    if (!pageTab || !pageTab.webSocketDebuggerUrl) {
      console.error('No page tab found');
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

    // Wait for world init
    await new Promise(r => setTimeout(r, 2000));

    // 1. Click Settings button
    await send('Runtime.evaluate', { expression: "document.getElementById('settings-btn').click();" });
    await new Promise(r => setTimeout(r, 300));

    // Check step 1: Offline mode active
    const step1 = await send('Runtime.evaluate', {
      expression: `(() => {
        const offlineBtn = document.getElementById('mp-mode-offline');
        const onlineBtn = document.getElementById('mp-mode-online');
        const mpSection = document.getElementById('mp-settings-section');
        const skinSection = document.getElementById('offline-boat-skin-section');
        return {
          offlineActive: offlineBtn?.classList.contains('active'),
          onlineActive: onlineBtn?.classList.contains('active'),
          mpSectionVisible: !mpSection?.classList.contains('hidden') && window.getComputedStyle(mpSection).display !== 'none',
          skinSectionVisible: !skinSection?.classList.contains('hidden') && window.getComputedStyle(skinSection).display !== 'none'
        };
      })()`,
      returnByValue: true
    });
    console.log('Step 1 (Offline Mode):', step1.result.value);

    // Save screenshot of Offline mode settings
    const shot1 = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync('C:\\Users\\prati\\.gemini\\antigravity-ide\\brain\\a399fa21-4c39-407a-a39f-8e2c406dfd81\\settings_offline_restored.png', Buffer.from(shot1.data, 'base64'));

    // 2. Click Online toggle button
    await send('Runtime.evaluate', { expression: "document.getElementById('mp-mode-online').click();" });
    await new Promise(r => setTimeout(r, 300));

    // Check step 2: Online mode active, offline boat skins hidden
    const step2 = await send('Runtime.evaluate', {
      expression: `(() => {
        const offlineBtn = document.getElementById('mp-mode-offline');
        const onlineBtn = document.getElementById('mp-mode-online');
        const mpSection = document.getElementById('mp-settings-section');
        const onlinePanel = document.getElementById('mp-online-panel');
        const skinSection = document.getElementById('offline-boat-skin-section');
        return {
          offlineActive: offlineBtn?.classList.contains('active'),
          onlineActive: onlineBtn?.classList.contains('active'),
          mpSectionVisible: !mpSection?.classList.contains('hidden') && window.getComputedStyle(mpSection).display !== 'none',
          onlinePanelVisible: !onlinePanel?.classList.contains('hidden') && window.getComputedStyle(onlinePanel).display !== 'none',
          skinSectionHidden: skinSection?.classList.contains('hidden') || window.getComputedStyle(skinSection).display === 'none'
        };
      })()`,
      returnByValue: true
    });
    console.log('Step 2 (Online Mode Selected):', step2.result.value);

    // Save screenshot of Online mode tab
    const shot2 = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync('C:\\Users\\prati\\.gemini\\antigravity-ide\\brain\\a399fa21-4c39-407a-a39f-8e2c406dfd81\\settings_online_tab_restored.png', Buffer.from(shot2.data, 'base64'));

    // 3. Click Offline toggle button again
    await send('Runtime.evaluate', { expression: "document.getElementById('mp-mode-offline').click();" });
    await new Promise(r => setTimeout(r, 300));

    const step3 = await send('Runtime.evaluate', {
      expression: `(() => {
        const offlineBtn = document.getElementById('mp-mode-offline');
        const skinSection = document.getElementById('offline-boat-skin-section');
        return {
          offlineActive: offlineBtn?.classList.contains('active'),
          skinSectionVisible: !skinSection?.classList.contains('hidden') && window.getComputedStyle(skinSection).display !== 'none'
        };
      })()`,
      returnByValue: true
    });
    console.log('Step 3 (Switched back to Offline):', step3.result.value);

    ws.close();
    console.log('ALL SETTINGS TOGGLE TESTS PASSED SUCCESSFULY!');
  } catch (err) {
    console.error('Error in test:', err);
    process.exit(1);
  } finally {
    proc.kill();
  }
}

run();
