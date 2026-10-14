// Stage (a) server: a tiny static file server with zero dependencies.
// In stage (d) this file will also host the WebSocket game server (the "ws" package).
const http = require('http');
const fs = require('fs');
const path = require('path');
const { setupWebSocketServer } = require('./rooms');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
};

const server = http.createServer((req, res) => {
  // Map editor save endpoint (local machine only)
  if (req.method === 'POST' && req.url === '/api/map') {
    const ip = req.socket.remoteAddress || '';
    if (!/^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(ip)) { res.writeHead(403); return res.end('Local only'); }
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try {
        const m = JSON.parse(body);
        if (!Array.isArray(m.islands) || !m.islands.some((i) => i.home)) throw new Error('bad map');

        const ROOT_DIR = path.resolve(__dirname, '..');
        const MAPCHANGES_DIR = path.join(ROOT_DIR, 'Mapchanges');
        const PUBLIC_MAPS_DIR = path.join(ROOT_DIR, 'public', 'maps');
        const EDITOR_MAPS_DIR = path.join(ROOT_DIR, 'map-editor', 'public', 'maps');

        fs.mkdirSync(MAPCHANGES_DIR, { recursive: true });
        fs.mkdirSync(PUBLIC_MAPS_DIR, { recursive: true });
        if (fs.existsSync(path.join(ROOT_DIR, 'map-editor'))) {
          fs.mkdirSync(EDITOR_MAPS_DIR, { recursive: true });
        }

        const newMapData = JSON.stringify({ islands: m.islands, assets: m.assets || [] }, null, 2);
        const defaultPath = path.join(PUBLIC_MAPS_DIR, 'default.json');
        const currentPath = path.join(MAPCHANGES_DIR, 'current_map.json');
        const fallbackPath = path.join(MAPCHANGES_DIR, 'last_version_fallback.json');

        // Backup existing map to last_version_fallback.json before overwriting
        const existingPath = fs.existsSync(currentPath) ? currentPath : (fs.existsSync(defaultPath) ? defaultPath : null);
        if (existingPath) {
          const prevMap = fs.readFileSync(existingPath, 'utf8');
          if (prevMap.trim() !== newMapData.trim()) {
            fs.writeFileSync(fallbackPath, prevMap);
          }
        }

        // Save new copy as current_map.json and runtime default.json
        fs.writeFileSync(currentPath, newMapData);
        fs.writeFileSync(defaultPath, newMapData);

        if (fs.existsSync(path.join(ROOT_DIR, 'map-editor'))) {
          fs.writeFileSync(path.join(EDITOR_MAPS_DIR, 'default.json'), newMapData);
        }

        // Clean up any older/irrelevant files in Mapchanges, keeping only current_map.json and last_version_fallback.json
        for (const file of fs.readdirSync(MAPCHANGES_DIR)) {
          if (file !== 'current_map.json' && file !== 'last_version_fallback.json') {
            const p = path.join(MAPCHANGES_DIR, file);
            try {
              if (!fs.statSync(p).isDirectory()) fs.unlinkSync(p);
            } catch {}
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          current: 'Mapchanges/current_map.json',
          fallback: 'Mapchanges/last_version_fallback.json'
        }));
      } catch (e) { res.writeHead(400); res.end('Bad map: ' + e.message); }
    });
    return;
  }

  // Restore fallback endpoint
  if (req.method === 'POST' && req.url === '/api/map/fallback') {
    try {
      const ROOT_DIR = path.resolve(__dirname, '..');
      const fallbackPath = path.join(ROOT_DIR, 'Mapchanges', 'last_version_fallback.json');
      if (!fs.existsSync(fallbackPath)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'No fallback map found in Mapchanges/' }));
      }
      const fallbackData = fs.readFileSync(fallbackPath, 'utf8');
      const parsed = JSON.parse(fallbackData);
      fs.writeFileSync(path.join(ROOT_DIR, 'public', 'maps', 'default.json'), fallbackData);
      fs.writeFileSync(path.join(ROOT_DIR, 'Mapchanges', 'current_map.json'), fallbackData);
      if (fs.existsSync(path.join(ROOT_DIR, 'map-editor'))) {
        fs.writeFileSync(path.join(ROOT_DIR, 'map-editor', 'public', 'maps', 'default.json'), fallbackData);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', map: parsed }));
    } catch (e) {
      res.writeHead(500); res.end('Failed to restore fallback');
    }
    return;
  }
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.normalize(path.join(PUBLIC_DIR, urlPath));
  // Block path traversal outside /public
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not found');
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
    res.end(data);
  });
});

setupWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`Island Resort running at http://localhost:${PORT}`);
});
