import { spawn } from 'child_process';
import WebSocket from 'ws';
import { writeFileSync } from 'fs';

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

    await send('Runtime.evaluate', {
      expression: `(() => {
        window.__DEBUG.boat.setSkin('classic');
        const modal = document.getElementById('settings-modal');
        if (modal) modal.classList.add('hidden');
        
        // Find meshes in classic boat
        const g = window.__DEBUG.boat.group;
        g.traverse(m => {
          if (m.isMesh && m.geometry && m.geometry.type === 'BoxGeometry') {
            const p = m.geometry.parameters;
            // Cabin is 1.6 x 1.0 x 1.6
            // Test 0xdce5e8 (chine color from PLAYER_STYLE)
            if (p.width === 1.6 && p.height === 1.0) {
              m.material.color.setHex(0xdce5e8);
            }
            // Accent stripe is 2.25 x 0.22 x 5.05
            if (p.width === 2.25 && p.height === 0.22) {
              m.material.color.setHex(0xdce5e8);
            }
            // Roof is 1.95 x 0.2 x 1.95 (warm amber/orange wood)
            if (p.width === 1.95 && p.height === 0.2) {
              m.material.color.setHex(0xd9803f);
            }
          }
        });
      })()`
    });

    await new Promise(r => setTimeout(r, 800));

    const shot = await send('Page.captureScreenshot');
    writeFileSync('C:\\Users\\prati\\.gemini\\antigravity-ide\\brain\\a399fa21-4c39-407a-a39f-8e2c406dfd81\\classic_slate_view2.png', Buffer.from(shot.data, 'base64'));
    console.log('Saved classic_slate_view2.png');

    ws.close();
    proc.kill();
  } catch (err) {
    console.error('Error:', err);
    proc.kill();
  }
}

main();
