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

    console.log('--- 3. Starting Game and Verifying Right Click Activates Missile Directly ---');
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

    // Fire missile directly with Right Click (pointerdown button 2)
    const rightClickResult = await evalPromise(`
      (() => {
        const canvas = document.querySelector('canvas#game');
        canvas.dispatchEvent(new PointerEvent('pointerdown', { button: 2, bubbles: true }));
        return {
          weapon: window.__DEBUG.input.state.weapon,
          missileFire: window.__DEBUG.input.state.missileFire,
          activeMissiles: window.__DEBUG.combat.missiles.filter(m => m.on).length,
          missileCd: window.__DEBUG.missileCd
        };
      })()
    `);
    console.log('Direct Right Click Missile Fire Result:', rightClickResult);
    if (rightClickResult.activeMissiles < 1) {
      throw new Error(`Right click failed to directly launch missile! activeMissiles: ${rightClickResult.activeMissiles}`);
    }
    if (rightClickResult.missileCd <= 0) {
      throw new Error(`Missile cooldown did not start! missileCd: ${rightClickResult.missileCd}`);
    }

    // Release right click
    await evalPromise(`
      (() => {
        const canvas = document.querySelector('canvas#game');
        canvas.dispatchEvent(new PointerEvent('pointerup', { button: 2, bubbles: true }));
        return window.__DEBUG.input.state.missileFire;
      })()
    `);

    console.log('--- 4. Verifying Left Click Falls Back to Machine Gun While Missile Reloading ---');
    // While missile is on 5s cooldown, Left Click should auto-switch to gun and shoot bullets!
    await evalPromise(`
      (() => {
        const canvas = document.querySelector('canvas#game');
        canvas.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
      })()
    `);
    await new Promise(r => setTimeout(r, 200));

    const leftClickFallback = await evalPromise(`
      (() => {
        const canvas = document.querySelector('canvas#game');
        canvas.dispatchEvent(new PointerEvent('pointerup', { button: 0, bubbles: true }));
        return {
          weapon: window.__DEBUG.input.state.weapon,
          activeBullets: window.__DEBUG.combat.bullets.filter(b => b.on).length
        };
      })()
    `);
    console.log('Left Click Fallback Result:', leftClickFallback);
    if (leftClickFallback.weapon !== 'gun') {
      throw new Error(`Expected fallback to weapon 'gun', got: ${leftClickFallback.weapon}`);
    }
    if (leftClickFallback.activeBullets < 1) {
      throw new Error(`Expected machine gun to fire bullets on left click fallback!`);
    }

    console.log('--- 5. Reset Keybinds and Verify Badge Reverts ---');
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
