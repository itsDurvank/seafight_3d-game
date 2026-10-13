# Boom Boats – Standalone Map Editor

This folder contains the visual drag-and-drop map editor for Boom Boats.

## How to Run
From this directory:
```bash
npm start
```
Or from the root directory:
```bash
node map-editor/server/index.js
```

Then open your browser to:
**http://localhost:3001/editor.html**

## Controls
- **Left-click on an island**: Select it.
- **Left-drag an island**: Move it around in real-time.
- **Right-drag**: Rotate the camera.
- **Mouse wheel**: Zoom in / out.
- **Sidebar**:
  - Name, size slider (`10` to `60`).
  - Procedural landmark features (`mango`, `coral`, `crystal`, `pillar`, `volcano`, `mountain`).
  - Stationed enemy boat (`skiff`, `cruiser`, `raider`, `gunboat`, `dread`).
  - Color pickers for sand, grass, foliage, trunk, rock, accent.
  - `+ Add island`: Spawn a new island.
  - `Delete island`: Remove island (home island is protected).
- **Save map**: Writes the map to `public/maps/default.json`.

## Applying Maps to the Main Game
When you are happy with your map:
Copy `map-editor/public/maps/default.json` to `public/maps/default.json` in the main game repository!
