import { spawn } from 'child_process';
import WebSocket from 'ws';

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
      console.log('No tab found', tabs);
      proc.kill();
      return;
    }

    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
    await new Promise((resolve) => ws.on('open', resolve));
    ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));

    const evalPromise = (expression) => new Promise((resolve) => {
      const id = Math.floor(Math.random() * 100000);
      const handler = (data) => {
        const m = JSON.parse(data.toString());
        if (m.id === id) {
          ws.off('message', handler);
          resolve(m.result?.result?.value);
        }
      };
      ws.on('message', handler);
      ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
    });

    await new Promise(r => setTimeout(r, 1000));

    // Start singleplayer
    await evalPromise(`window.__DEBUG.startGame()`);
    await new Promise(r => setTimeout(r, 500));

    console.log('=== TEST 1: Boost in Toggle Mode ===');
    // Ensure toggle mode
    await evalPromise(`window.__DEBUG.input.setBoostMode('toggle')`);

    // Press Shift down & up (toggle ON)
    ws.send(JSON.stringify({ id: 10, method: 'Input.dispatchKeyEvent', params: { type: 'keyDown', code: 'ShiftLeft', key: 'Shift', windowsVirtualKeyCode: 16 } }));
    await new Promise(r => setTimeout(r, 100));
    ws.send(JSON.stringify({ id: 11, method: 'Input.dispatchKeyEvent', params: { type: 'keyUp', code: 'ShiftLeft', key: 'Shift', windowsVirtualKeyCode: 16 } }));
    await new Promise(r => setTimeout(r, 500));

    const stateOn = await evalPromise(`(() => {
      const b = window.__DEBUG.boat;
      return { boostOn: b.boostOn, boosting: b.boosting, speed: b.state.speed, energy: b.boostEnergy };
    })()`);
    console.log('Toggle ON state:', stateOn);
    if (!stateOn.boosting || stateOn.speed < 20) {
      throw new Error(`FAIL: Boost did not turn ON in toggle mode: ${JSON.stringify(stateOn)}`);
    }

    // Press Shift down & up again (toggle OFF)
    ws.send(JSON.stringify({ id: 12, method: 'Input.dispatchKeyEvent', params: { type: 'keyDown', code: 'ShiftLeft', key: 'Shift', windowsVirtualKeyCode: 16 } }));
    await new Promise(r => setTimeout(r, 100));
    ws.send(JSON.stringify({ id: 13, method: 'Input.dispatchKeyEvent', params: { type: 'keyUp', code: 'ShiftLeft', key: 'Shift', windowsVirtualKeyCode: 16 } }));
    await new Promise(r => setTimeout(r, 300));

    const stateOff = await evalPromise(`(() => {
      const b = window.__DEBUG.boat;
      return { boostOn: b.boostOn, boosting: b.boosting, speed: b.state.speed, energy: b.boostEnergy };
    })()`);
    console.log('Toggle OFF state:', stateOff);
    if (stateOff.boosting) {
      throw new Error(`FAIL: Boost did not turn OFF in toggle mode: ${JSON.stringify(stateOff)}`);
    }

    console.log('=== TEST 2: Boost in Hold Mode ===');
    await evalPromise(`window.__DEBUG.input.setBoostMode('hold')`);

    // Key down: should be boosting
    ws.send(JSON.stringify({ id: 20, method: 'Input.dispatchKeyEvent', params: { type: 'keyDown', code: 'ShiftLeft', key: 'Shift', windowsVirtualKeyCode: 16 } }));
    await new Promise(r => setTimeout(r, 300));
    const holdDownState = await evalPromise(`(() => {
      const b = window.__DEBUG.boat;
      return { boostOn: b.boostOn, boosting: b.boosting, speed: b.state.speed };
    })()`);
    console.log('Hold down state:', holdDownState);
    if (!holdDownState.boosting) {
      throw new Error(`FAIL: Boost did not turn ON while holding Shift in hold mode`);
    }

    // Key up: should turn off
    ws.send(JSON.stringify({ id: 21, method: 'Input.dispatchKeyEvent', params: { type: 'keyUp', code: 'ShiftLeft', key: 'Shift', windowsVirtualKeyCode: 16 } }));
    await new Promise(r => setTimeout(r, 300));
    const holdUpState = await evalPromise(`(() => {
      const b = window.__DEBUG.boat;
      return { boostOn: b.boostOn, boosting: b.boosting, speed: b.state.speed };
    })()`);
    console.log('Hold up state:', holdUpState);
    if (holdUpState.boosting) {
      throw new Error(`FAIL: Boost did not turn OFF when releasing Shift in hold mode`);
    }

    console.log('=== TEST 3: Click HUD Boost Slot ===');
    await evalPromise(`window.__DEBUG.input.setBoostMode('toggle')`);
    await evalPromise(`(() => {
      const slot = document.getElementById('boost-slot');
      slot.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
    })()`);
    await new Promise(r => setTimeout(r, 300));
    const hudSlotState = await evalPromise(`(() => {
      const b = window.__DEBUG.boat;
      return { boostOn: b.boostOn, boosting: b.boosting };
    })()`);
    console.log('HUD Slot click state:', hudSlotState);
    if (!hudSlotState.boosting) {
      throw new Error(`FAIL: Boost slot click did not activate boost in toggle mode`);
    }

    // Turn off
    await evalPromise(`(() => {
      const slot = document.getElementById('boost-slot');
      slot.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
    })()`);
    await new Promise(r => setTimeout(r, 300));
    const hudSlotOffState = await evalPromise(`(() => {
      const b = window.__DEBUG.boat;
      return { boostOn: b.boostOn, boosting: b.boosting };
    })()`);
    console.log('HUD Slot click off state:', hudSlotOffState);
    if (hudSlotOffState.boosting) {
      throw new Error(`FAIL: Boost slot click did not turn OFF boost in toggle mode`);
    }

    console.log('=== TEST 4: Verify Single Execution for Keybinds (No Double Firing) ===');
    const keybindTest = await evalPromise(`(() => {
      const inp = window.__DEBUG.input;
      let actionCount = 0;
      inp.onAction('skin', () => { actionCount++; });
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyO', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyO', bubbles: true }));
      return { actionCount };
    })()`);
    console.log('Keybind action trigger count for 1 keypress:', keybindTest);
    if (keybindTest.actionCount !== 1) {
      throw new Error(`FAIL: Keybind action fired ${keybindTest.actionCount} times instead of 1`);
    }

    console.log('\n>>> ALL BOOST AND INPUT TESTS PASSED PERFECTLY! <<<');
    ws.close();
  } catch (err) {
    console.error('Error in test:', err);
    process.exit(1);
  } finally {
    proc.kill();
  }
}

main();
