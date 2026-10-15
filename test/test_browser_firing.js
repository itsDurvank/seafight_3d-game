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
    ws.on('open', () => {
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
    });

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

    await new Promise(r => setTimeout(r, 2500));

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

    const preState = await evalPromise(`
      (() => {
        const d = window.__DEBUG;
        return {
          hasDebug: !!d,
          weapon: d?.input?.state?.weapon,
          fire: d?.input?.state?.fire,
          alive: d?.player?.alive,
          mpMode: d?.mp?.mode
        };
      })()
    `);
    console.log('Pre-fire state:', preState);

    // Simulate clicking in the canvas to fire machine gun
    const gunFireResult = await evalPromise(`
      (() => {
        const canvas = document.querySelector('canvas#game');
        canvas.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
        return {
          fire: window.__DEBUG.input.state.fire,
          weapon: window.__DEBUG.input.state.weapon
        };
      })()
    `);
    console.log('Gun fire pointerdown:', gunFireResult);

    await new Promise(r => setTimeout(r, 200));

    const gunBullets = await evalPromise(`
      (() => {
        return {
          bulletCount: window.__DEBUG.combat.bullets.filter(b => b.on).length
        };
      })()
    `);
    console.log('Gun bullets active:', gunBullets);

    // Switch to missile (Key '2') and fire
    const missileResult = await evalPromise(`
      (() => {
        // Press key '2'
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2', bubbles: true }));
        // Click to fire
        const canvas = document.querySelector('canvas#game');
        canvas.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
        return {
          weapon: window.__DEBUG.input.state.weapon,
          fire: window.__DEBUG.input.state.fire
        };
      })()
    `);
    console.log('Switched to missile:', missileResult);

    await new Promise(r => setTimeout(r, 200));

    const missileActive = await evalPromise(`
      (() => {
        return {
          missileCount: window.__DEBUG.combat.missiles.filter(m => m.on).length
        };
      })()
    `);
    console.log('Missiles active:', missileActive);

    console.log('Console Logs:\n' + (consoleLogs.join('\n') || '(no errors)'));
    proc.kill();
  } catch (err) {
    console.error('Error:', err);
    proc.kill();
  }
}

main();
