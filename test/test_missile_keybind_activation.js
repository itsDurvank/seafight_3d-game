import { spawn } from 'child_process';
import WebSocket from 'ws';

async function runTest() {
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
    ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));

    const consoleLogs = [];
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map(a => a.value || a.description).join(' ');
        consoleLogs.push(`[Console ${msg.params.type}] ${text}`);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        consoleLogs.push(`[Exception] ${JSON.stringify(msg.params.exceptionDetails)}`);
      }
    });

    await new Promise(r => setTimeout(r, 2000));

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

    console.log('--- 1. Checking Initial Weapon Slot Badges ---');
    await evalPromise(`window.__DEBUG.input.resetKeybinds()`);
    const initialBadges = await evalPromise(`
      (() => {
        return {
          gun: document.getElementById('gun-kbd')?.textContent,
          missile: document.getElementById('missile-kbd')?.textContent,
          boost: document.getElementById('boost-kbd')?.textContent,
        };
      })()
    `);
    console.log('Initial Slot Badges:', initialBadges);
    if (initialBadges.missile !== '2' || initialBadges.gun !== '1') {
      throw new Error(`Expected initial badges gun: '1', missile: '2', got: ${JSON.stringify(initialBadges)}`);
    }

    console.log('--- 2. Rebinding Missile to MouseRight ---');
    const reboundBadges = await evalPromise(`
      (() => {
        window.__DEBUG.input.setKeybind('missile', 'MouseRight');
        return {
          gun: document.getElementById('gun-kbd')?.textContent,
          missile: document.getElementById('missile-kbd')?.textContent,
          controlsHtml: document.getElementById('controls')?.innerHTML
        };
      })()
    `);
    console.log('Rebound Slot Badges:', reboundBadges);
    if (reboundBadges.missile !== 'R-Click') {
      throw new Error(`Expected missile badge to be 'R-Click', got: '${reboundBadges.missile}'`);
    }
    if (!reboundBadges.controlsHtml.includes('R-Click')) {
      throw new Error(`Expected controls panel to include R-Click!`);
    }

    console.log('--- 3. Starting Game and Verifying Right Click Equips Missile Without Firing ---');
    await evalPromise(`window.__DEBUG.startGame()`);
    await new Promise(r => setTimeout(r, 300));

    const preFire = await evalPromise(`
      (() => {
        return {
          activeMissiles: window.__DEBUG.combat.missiles.filter(m => m.on).length,
          missileCd: window.__DEBUG.missileCd,
          weapon: window.__DEBUG.input.state.weapon
        };
      })()
    `);
    console.log('Pre-fire state:', preFire);

    // Equip missile with Right Click (pointerdown button 2)
    const rightClickResult = await evalPromise(`
      (() => {
        const canvas = document.querySelector('canvas#game');
        canvas.dispatchEvent(new PointerEvent('pointerdown', { button: 2, bubbles: true }));
        canvas.dispatchEvent(new PointerEvent('pointerup', { button: 2, bubbles: true }));
        return {
          weapon: window.__DEBUG.input.state.weapon,
          activeMissiles: window.__DEBUG.combat.missiles.filter(m => m.on).length,
          missileCd: window.__DEBUG.missileCd
        };
      })()
    `);
    console.log('Right Click Equip Result:', rightClickResult);
    if (rightClickResult.weapon !== 'missile') {
      throw new Error(`Right click failed to equip missile! weapon: ${rightClickResult.weapon}`);
    }
    if (rightClickResult.activeMissiles > 0 || rightClickResult.missileCd > 0) {
      throw new Error(`Right click prematurely fired missile! activeMissiles: ${rightClickResult.activeMissiles}, cd: ${rightClickResult.missileCd}`);
    }

    console.log('--- 4. Verifying Left Click Fires the Equipped Missile ---');
    // Now fire the equipped missile with Left Click (button 0)
    await evalPromise(`
      (() => {
        const canvas = document.querySelector('canvas#game');
        canvas.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
      })()
    `);
    await new Promise(r => setTimeout(r, 100));
    const leftClickFireResult = await evalPromise(`
      (() => {
        const canvas = document.querySelector('canvas#game');
        canvas.dispatchEvent(new PointerEvent('pointerup', { button: 0, bubbles: true }));
        return {
          weapon: window.__DEBUG.input.state.weapon,
          activeMissiles: window.__DEBUG.combat.missiles.filter(m => m.on).length,
          missileCd: window.__DEBUG.missileCd
        };
      })()
    `);
    console.log('Left Click Fire Result:', leftClickFireResult);
    if (leftClickFireResult.activeMissiles < 1) {
      throw new Error(`Left click failed to launch equipped missile! activeMissiles: ${leftClickFireResult.activeMissiles}`);
    }
    if (leftClickFireResult.missileCd <= 0) {
      throw new Error(`Missile cooldown did not start! missileCd: ${leftClickFireResult.missileCd}`);
    }

    console.log('--- 5. Verifying Left Click Does NOT Fire Machine Gun While Missile Reloading ---');
    // While missile is on cooldown, Left Click should NOT fire machine gun and missile remains equipped
    await evalPromise(`
      (() => {
        const canvas = document.querySelector('canvas#game');
        canvas.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
      })()
    `);
    await new Promise(r => setTimeout(r, 200));

    const leftClickCooldownCheck = await evalPromise(`
      (() => {
        const canvas = document.querySelector('canvas#game');
        canvas.dispatchEvent(new PointerEvent('pointerup', { button: 0, bubbles: true }));
        return {
          weapon: window.__DEBUG.input.state.weapon,
          activeBullets: window.__DEBUG.combat.bullets.filter(b => b.on).length
        };
      })()
    `);
    console.log('Left Click On Cooldown Result:', leftClickCooldownCheck);
    if (leftClickCooldownCheck.weapon !== 'missile') {
      throw new Error(`Expected weapon to remain 'missile' without disarming, got: ${leftClickCooldownCheck.weapon}`);
    }
    if (leftClickCooldownCheck.activeBullets > 0) {
      throw new Error(`Machine gun fired while unequipped! activeBullets: ${leftClickCooldownCheck.activeBullets}`);
    }

    console.log('--- 6. Reset Keybinds and Verify Badge Reverts to 2 ---');
    const resetBadges = await evalPromise(`
      (() => {
        window.__DEBUG.input.resetKeybinds();
        return {
          missile: document.getElementById('missile-kbd')?.textContent
        };
      })()
    `);
    console.log('Reset Badges:', resetBadges);
    if (resetBadges.missile !== '2') {
      throw new Error(`Expected missile badge to reset to '2', got: ${resetBadges.missile}`);
    }

    // Verify pressing key '1' equips gun and key '2' equips missile
    const keySwitchResult = await evalPromise(`
      (() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Digit1', bubbles: true }));
        const after1 = window.__DEBUG.input.state.weapon;
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2', bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Digit2', bubbles: true }));
        const after2 = window.__DEBUG.input.state.weapon;
        return { after1, after2 };
      })()
    `);
    console.log('Key switch verification:', keySwitchResult);
    if (keySwitchResult.after1 !== 'gun' || keySwitchResult.after2 !== 'missile') {
      throw new Error(`Expected Digit1 -> gun, Digit2 -> missile, got: ${JSON.stringify(keySwitchResult)}`);
    }

    console.log('✅ ALL KEYBIND ACTIVATION & BADGE TESTS PASSED SUCCESSFULLY!');
    ws.close();
    proc.kill();
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err);
    try { proc.kill(); } catch {}
    process.exit(1);
  }
}

runTest();
