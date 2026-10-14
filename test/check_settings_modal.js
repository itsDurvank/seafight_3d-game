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

  await new Promise(r => setTimeout(r, 1500));

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
      ws.send(JSON.stringify({ id: 2, method: 'Page.enable' }));
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === 6) {
        console.log('SETTINGS MODAL HTML:');
        console.log(msg.result.result.value);
      } else if (msg.id === 10) {
        const buf = Buffer.from(msg.result.data, 'base64');
        const artifactPath = 'C:\\Users\\prati\\.gemini\\antigravity-ide\\brain\\a399fa21-4c39-407a-a39f-8e2c406dfd81\\settings_modal_current.png';
        writeFileSync(artifactPath, buf);
        console.log('Screenshot saved to', artifactPath);
      }
    });

    await new Promise(r => setTimeout(r, 2000));

    // Click settings button
    ws.send(JSON.stringify({
      id: 5,
      method: 'Runtime.evaluate',
      params: { expression: "document.getElementById('settings-btn').click();" }
    }));

    await new Promise(r => setTimeout(r, 500));

    // Get settings modal outerHTML
    ws.send(JSON.stringify({
      id: 6,
      method: 'Runtime.evaluate',
      params: { expression: "document.getElementById('settings-modal').outerHTML;" }
    }));

    // Capture screenshot
    ws.send(JSON.stringify({ id: 10, method: 'Page.captureScreenshot', params: { format: 'png' } }));

    await new Promise(r => setTimeout(r, 1000));
    ws.close();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    proc.kill();
  }
}

main();
