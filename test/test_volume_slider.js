import { spawn } from 'child_process';
import WebSocket from 'ws';

async function main() {
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9235',
    '--user-data-dir=' + process.env.TEMP + '\\chrome_test_' + Date.now(),
    '--disable-gpu',
    '--window-size=1280,720',
    'http://localhost:3000'
  ], { stdio: 'ignore' });

  await new Promise(r => setTimeout(r, 2000));

  try {
    const res = await fetch('http://127.0.0.1:9235/json');
    const tabs = await res.json();
    const pageTab = tabs.find(t => t.type === 'page' && t.url.includes('localhost:3000'));
    if (!pageTab) {
      console.error('No tab found', tabs);
      proc.kill();
      process.exit(1);
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

    console.log('--- 1. Verifying Settings Modal DOM Structure ---');
    // Start game and open settings modal
    await evalPromise(`window.__DEBUG.startGame()`);
    await new Promise(r => setTimeout(r, 600));

    await evalPromise(`(() => {
      const modal = document.getElementById('settings-modal');
      if (modal) {
        modal.classList.remove('hidden');
        document.querySelector('.settings-footer')?.classList.remove('hidden');
      }
    })()`);
    await new Promise(r => setTimeout(r, 200));

    const domCheck = await evalPromise(`(() => {
      const modal = document.getElementById('settings-modal');
      const footer = modal?.querySelector('.settings-footer');
      const footerRow = modal?.querySelector('.settings-footer-row');
      const keybindsBtn = document.getElementById('settings-keybinds-btn');
      const audioBtn = document.getElementById('settings-audio-btn');
      const volumeRow = document.getElementById('settings-volume-row');
      const slider = document.getElementById('settings-volume-slider');
      const valEl = document.getElementById('settings-volume-val');
      const iconEl = document.getElementById('settings-volume-icon');

      const isBelowButtons = footerRow && volumeRow && (footerRow.compareDocumentPosition(volumeRow) & Node.DOCUMENT_POSITION_FOLLOWING);

      return {
        modalVisible: !modal?.classList.contains('hidden'),
        hasFooter: !!footer,
        hasKeybindsBtn: !!keybindsBtn,
        hasAudioBtn: !!audioBtn,
        hasVolumeRow: !!volumeRow,
        hasSlider: !!slider,
        isBelowButtons: !!isBelowButtons,
        sliderMin: slider?.min,
        sliderMax: slider?.max,
        currentVal: slider?.value,
        valText: valEl?.textContent,
        iconText: iconEl?.textContent
      };
    })()`);
    console.log('DOM Check:', domCheck);

    if (!domCheck.modalVisible || !domCheck.hasVolumeRow || !domCheck.isBelowButtons || !domCheck.hasSlider) {
      throw new Error(`DOM layout failed: ${JSON.stringify(domCheck)}`);
    }

    console.log('--- 2. Testing Volume Slider Input (50%) ---');
    const state50 = await evalPromise(`(() => {
      let errInfo = null;
      window.addEventListener('error', e => { errInfo = e.message; });
      const slider = document.getElementById('settings-volume-slider');
      const valBefore = document.getElementById('settings-volume-val')?.textContent;
      slider.value = '50';
      try {
        slider.dispatchEvent(new Event('input', { bubbles: true }));
      } catch (e) {
        errInfo = e.message;
      }
      const valAfter = document.getElementById('settings-volume-val')?.textContent;
      return {
        sliderVal: slider.value,
        valBefore,
        valAfter,
        errInfo,
        valText: valAfter,
        iconText: document.getElementById('settings-volume-icon')?.textContent,
        audioVol: window.__DEBUG.getVolume(),
        isMuted: window.__DEBUG.isMuted()
      };
    })()`);
    console.log('State at 50%:', state50);
    if (state50.valText !== '50%' || state50.iconText !== '🔉' || Math.abs(state50.audioVol - 0.5) > 0.01) {
      throw new Error(`50% volume test failed: ${JSON.stringify(state50)}`);
    }

    console.log('--- 3. Testing Volume Slider Input (100%) ---');
    const state100 = await evalPromise(`(() => {
      const slider = document.getElementById('settings-volume-slider');
      slider.value = '100';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      return {
        sliderVal: slider.value,
        valText: document.getElementById('settings-volume-val')?.textContent,
        iconText: document.getElementById('settings-volume-icon')?.textContent,
        audioVol: window.__DEBUG.getVolume(),
        isMuted: window.__DEBUG.isMuted()
      };
    })()`);
    console.log('State at 100%:', state100);
    if (state100.valText !== '100%' || state100.iconText !== '🔊' || Math.abs(state100.audioVol - 1.0) > 0.01) {
      throw new Error(`100% volume test failed: ${JSON.stringify(state100)}`);
    }

    console.log('--- 4. Testing Volume Slider Input (0% Muted) ---');
    const state0 = await evalPromise(`(() => {
      const slider = document.getElementById('settings-volume-slider');
      slider.value = '0';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      return {
        sliderVal: slider.value,
        valText: document.getElementById('settings-volume-val')?.textContent,
        iconText: document.getElementById('settings-volume-icon')?.textContent,
        audioVol: window.__DEBUG.getVolume(),
        isMuted: window.__DEBUG.isMuted()
      };
    })()`);
    console.log('State at 0%:', state0);
    if (state0.iconText !== '🔇' || !state0.isMuted) {
      throw new Error(`0% volume test failed: ${JSON.stringify(state0)}`);
    }

    console.log('--- 5. Testing Dragging Slider Back to 80% Unmutes ---');
    const state80 = await evalPromise(`(() => {
      const slider = document.getElementById('settings-volume-slider');
      slider.value = '80';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      return {
        sliderVal: slider.value,
        valText: document.getElementById('settings-volume-val')?.textContent,
        iconText: document.getElementById('settings-volume-icon')?.textContent,
        audioVol: window.__DEBUG.getVolume(),
        isMuted: window.__DEBUG.isMuted()
      };
    })()`);
    console.log('State at 80%:', state80);
    if (state80.valText !== '80%' || state80.iconText !== '🔊' || state80.isMuted) {
      throw new Error(`80% unmuting test failed: ${JSON.stringify(state80)}`);
    }

    console.log('--- 6. Testing Mute Button Toggle Sync with Slider ---');
    const mutedState = await evalPromise(`(() => {
      try {
        const isStart = window.__DEBUG.isStartScreenActive;
        const audioBtn = document.getElementById('settings-audio-btn');
        audioBtn.click();
        return {
          isStart,
          isMuted: window.__DEBUG.isMuted(),
          valText: document.getElementById('settings-volume-val')?.textContent,
          iconText: document.getElementById('settings-volume-icon')?.textContent
        };
      } catch (err) {
        return { error: err.message, stack: err.stack };
      }
    })()`);
    console.log('State after Mute Button Click:', mutedState);
    if (!mutedState.isMuted || mutedState.iconText !== '🔇' || mutedState.valText !== 'Muted') {
      throw new Error(`Mute button toggle sync failed: ${JSON.stringify(mutedState)}`);
    }

    console.log('\n>>> ALL VOLUME SLIDER TESTS PASSED PERFECTLY! <<<');
    ws.close();
    proc.kill();
    process.exit(0);
  } catch (err) {
    console.error('Test error:', err);
    proc.kill();
    process.exit(1);
  }
}

main();
