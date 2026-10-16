import { spawn } from 'child_process';
import WebSocket from 'ws';

async function main() {
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9232',
    '--user-data-dir=' + process.env.TEMP + '\\chrome_test_' + Date.now(),
    '--disable-gpu',
    '--window-size=1280,720',
    'http://localhost:3000'
  ], { stdio: 'ignore' });

  await new Promise(r => setTimeout(r, 2000));

  try {
    const res = await fetch('http://127.0.0.1:9232/json');
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

    console.log('--- 1. Starting game from Start Screen ---');
    await evalPromise(`window.__DEBUG.startGame()`);
    await new Promise(r => setTimeout(r, 600));

    console.log('--- 2. Checking Idle Speedometer ---');
    const idleState = await evalPromise(`(() => {
      const spd = document.getElementById('speed-text')?.textContent;
      const fill = document.getElementById('boost-fill')?.style.width;
      const gear = document.getElementById('speed-gear');
      const icon = document.getElementById('speed-icon')?.textContent;
      const panelClass = document.getElementById('speed')?.className;
      return {
        spd, fill, icon, panelClass,
        gearVisible: !gear?.classList.contains('hidden'),
        gearText: gear?.textContent
      };
    })()`);
    console.log('Idle State:', idleState);
    if (idleState.spd !== '0' || (idleState.fill !== '0.0%' && idleState.fill !== '0%' && idleState.fill !== '') || idleState.gearVisible) {
      throw new Error(`Idle state unexpected: ${JSON.stringify(idleState)}`);
    }

    console.log('--- 3. Testing Forward Acceleration ---');
    // Set forward input
    await evalPromise(`window.__DEBUG.input.state.forward = true`);
    await new Promise(r => setTimeout(r, 1500));

    const forwardState = await evalPromise(`(() => {
      const spd = parseFloat(document.getElementById('speed-text')?.textContent || '0');
      const fillStr = document.getElementById('boost-fill')?.style.width || '0%';
      const fill = parseFloat(fillStr);
      const gear = document.getElementById('speed-gear');
      const icon = document.getElementById('speed-icon')?.textContent;
      return {
        spd, fill, fillStr, icon,
        gearVisible: !gear?.classList.contains('hidden'),
        gearText: gear?.textContent
      };
    })()`);
    console.log('Forward State after 1.5s forward:', forwardState);
    if (forwardState.spd <= 10 || forwardState.fill <= 5) {
      throw new Error(`Forward speed/fill bar did not advance: ${JSON.stringify(forwardState)}`);
    }

    // Release forward
    await evalPromise(`window.__DEBUG.input.state.forward = false`);

    console.log('--- 4. Testing Reverse Acceleration & REV Gear Tag ---');
    // Set back input (reverse)
    await evalPromise(`window.__DEBUG.input.state.back = true`);
    
    // Wait for boat to decelerate and enter reverse (< -0.5 speed)
    let revState = null;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 200));
      revState = await evalPromise(`(() => {
        const boatSpeed = window.__DEBUG.boat?.state?.speed;
        const spd = parseFloat(document.getElementById('speed-text')?.textContent || '0');
        const fillStr = document.getElementById('boost-fill')?.style.width || '0%';
        const fill = parseFloat(fillStr);
        const gear = document.getElementById('speed-gear');
        const icon = document.getElementById('speed-icon')?.textContent;
        const panel = document.getElementById('speed');
        return {
          boatSpeed,
          spd, fill, fillStr, icon,
          gearVisible: !gear?.classList.contains('hidden'),
          gearText: gear?.textContent,
          isReversingClass: panel?.classList.contains('reversing')
        };
      })()`);
      if (revState.isReversingClass && revState.gearText === 'REV') break;
    }
    console.log('Reverse State:', revState);
    if (!revState.isReversingClass || revState.gearText !== 'REV' || !revState.gearVisible) {
      throw new Error(`Reverse gear indication failed: ${JSON.stringify(revState)}`);
    }
    if (revState.spd <= 0 || revState.fill <= 0) {
      throw new Error(`Reverse speed and fill should be positive: ${JSON.stringify(revState)}`);
    }

    // Release reverse
    await evalPromise(`window.__DEBUG.input.state.back = false`);

    console.log('--- 5. Testing Boost Mode & BOOST Gear Tag ---');
    // Set forward and boosting
    await evalPromise(`(() => {
      window.__DEBUG.input.state.forward = true;
      window.__DEBUG.boat.setBoost(true);
    })()`);
    await new Promise(r => setTimeout(r, 1000));

    const boostState = await evalPromise(`(() => {
      const spd = parseFloat(document.getElementById('speed-text')?.textContent || '0');
      const fillStr = document.getElementById('boost-fill')?.style.width || '0%';
      const fill = parseFloat(fillStr);
      const gear = document.getElementById('speed-gear');
      const icon = document.getElementById('speed-icon')?.textContent;
      const panel = document.getElementById('speed');
      return {
        spd, fill, fillStr, icon,
        gearVisible: !gear?.classList.contains('hidden'),
        gearText: gear?.textContent,
        isBoostingClass: panel?.classList.contains('boosting')
      };
    })()`);
    console.log('Boost State:', boostState);
    if (!boostState.isBoostingClass || boostState.gearText !== 'BOOST' || boostState.icon !== '🔥') {
      throw new Error(`Boost indicator failed: ${JSON.stringify(boostState)}`);
    }

    // Reset inputs
    await evalPromise(`(() => {
      window.__DEBUG.input.state.forward = false;
      window.__DEBUG.boat.setBoost(false);
    })()`);

    console.log('\n>>> ALL SPEEDOMETER TESTS PASSED PERFECTLY! <<<');
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
