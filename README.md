# Boom Boats ⛵💥

A cozy-but-action-packed 3D battle-sailing game built with Three.js. Sail around vibrant tropical islands, engage enemy ships in machine gun & missile dogfights, ram foes with rocket boost, collect health orbs, and race to 20 kills in online multiplayer!

---

## Quick Start (Local Run)

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Start the server** (HTTP + WebSocket server on port 3000):
   ```bash
   npm start
   ```
   *(Or with custom port: `PORT=8080 node server/index.js`)*
3. **Open the game**:
   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

---

## Online Multiplayer (Race to 20 Kills)

Boom Boats features real-time, low-latency room-based multiplayer:
- **Server-authoritative** room state, kill verification, health orb spawning, and victory condition.
- **Client-authoritative movement** with snapshot interpolation (~100 ms buffer) and extrapolation on packet gaps for silky-smooth local controls.
- **5 distinct player color palettes**: Sunfire (🔥), Azure (💧), Jade (🌿), Violet (⚡), and Rose (🌸).
- **First to 20 kills wins** the match, triggering the victory screen with a 3D rotating trophy!

### Testing Multiplayer Locally (Two Browser Tabs)

1. Open **Tab 1** at `http://localhost:3000`.
2. Click **⚙️ Settings** in the top-left corner.
3. In the **🌐 Multiplayer** section, click **Online**.
4. Enter your Captain name (e.g. `RedBeard`) and click **🎲 Generate Room Code**.
5. Copy the 5-character code (e.g. `K7QM2`).
6. Open **Tab 2** (or an Incognito window) at `http://localhost:3000`.
7. Go to **⚙️ Settings → 🌐 Multiplayer → Online**, enter a Captain name (e.g. `BlueLagoon`), type the room code, and click **Join**.
8. In Tab 1 (Host), click **🚀 Start Match** (enabled when 2–5 players are in the room).
9. Both tabs will see a 3-2-1 countdown, then spawn across the open water ready for battle!

---

## Testing Features & URL Parameters

- **Simulate Network Latency / Lag**:
  Append `?lag=<milliseconds>` to the URL to simulate high latency:
  ```
  http://localhost:3000/?lag=150
  ```
  This proves smooth snapshot interpolation and extrapolation under 150ms+ RTT conditions.
- **Connect to an External WebSocket Server**:
  Append `?server=<ws-or-wss-url>` to override the game server:
  ```
  https://my-game.vercel.app/?server=wss://boom-boats-backend.up.railway.app
  ```

---

## Automated Smoke Tests

To run the headless 2–3 client smoke test suite verifying room creation, room joining, countdown, staggered health orb timers, combat serialization, 20-kill win condition, and match restart:

```bash
node test/multiplayer_smoke.js
```

---

## Deployment Note (Important)

> [!IMPORTANT]
> **Vercel Serverless Cannot Host WebSocket Servers.**
> Vercel's standard serverless functions terminate quickly and do not support long-lived, stateful WebSockets needed for multiplayer game rooms.

### Deployment Options:
1. **Unified Deployment (Recommended)**:
   Deploy this entire Node repository to a long-lived Node.js hosting platform such as:
   - **Render** (Web Service: `node server/index.js`)
   - **Railway**
   - **Fly.io**
   - **DigitalOcean App Platform / VPS**
   
   The server reads `process.env.PORT` automatically.

2. **Split Deployment (Vercel Frontend + Dedicated Backend)**:
   - Host the static `/public` directory on Vercel.
   - Host `server/index.js` on Railway / Render.
   - Point clients to the backend WebSocket server using `?server=wss://your-backend-domain.com`.
