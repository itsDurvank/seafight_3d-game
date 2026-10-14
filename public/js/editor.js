import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './mapLoader.js'; // loads maps/default.json into WORLD before editor initializes
import { WORLD } from './config.js';
import { makeIsland, makeDock } from './world.js';
import { ASSET_CATALOG, makeAsset, createBillboardTexture } from './assets.js';

const $ = (id) => document.getElementById(id);
const hex = (n) => '#' + Number(n).toString(16).padStart(6, '0');
const FEATURES = ['', 'mango', 'coral', 'crystal', 'pillar', 'volcano', 'mountain', 'billboard'];
const ENEMIES = ['', 'skiff', 'cruiser', 'raider', 'gunboat', 'dread'];
const COLOR_KEYS = ['sand', 'grass', 'leaf', 'trunk', 'rock', 'accent'];

const PALETTES = {
  'Tropical': { sand: 0xffd27a, grass: 0x7ed957, leaf: 0x3fcf6e, trunk: 0xc98a55, rock: 0xd9b27a, accent: 0xff9f1c },
  'Volcanic': { sand: 0x3b3a39, grass: 0x732924, leaf: 0xbf360c, trunk: 0x4a2c2a, rock: 0x2e2321, accent: 0xff5722 },
  'Coral Bay': { sand: 0xffc7d6, grass: 0x9be3a6, leaf: 0xff7aa8, trunk: 0xa8643f, rock: 0xff8fa3, accent: 0xff5c8a },
  'Crystal': { sand: 0xe0d2ff, grass: 0x6fd3c4, leaf: 0x9a86ff, trunk: 0x7a5aa6, rock: 0xb39bff, accent: 0xb48cff },
  'Golden Dunes': { sand: 0xf5deb3, grass: 0xa3b18a, leaf: 0x588157, trunk: 0x8a6240, rock: 0xd4a373, accent: 0xe09f3e },
};

// ---- Map State & History (Undo / Redo) ----
let islands = JSON.parse(JSON.stringify(WORLD.islands));
let assets = Array.isArray(WORLD.assets) ? JSON.parse(JSON.stringify(WORLD.assets)) : [];
const history = [];
const redoStack = [];
const MAX_HISTORY = 45;

function cloneState() {
  return {
    islands: JSON.parse(JSON.stringify(islands)),
    assets: JSON.parse(JSON.stringify(assets))
  };
}

function recordState() {
  history.push(cloneState());
  if (history.length > MAX_HISTORY) history.shift();
  redoStack.length = 0;
  updateHistoryButtons();
}

function updateHistoryButtons() {
  $('btn-undo').disabled = history.length === 0;
  $('btn-redo').disabled = redoStack.length === 0;
}

function undo() {
  if (history.length === 0) return;
  redoStack.push(cloneState());
  const snap = history.pop();
  islands = snap.islands;
  assets = snap.assets || [];
  rebuildAll();
  updateHistoryButtons();
  flashStatus('Undo applied', '#38bdf8');
}

function redo() {
  if (redoStack.length === 0) return;
  history.push(cloneState());
  const snap = redoStack.pop();
  islands = snap.islands;
  assets = snap.assets || [];
  rebuildAll();
  updateHistoryButtons();
  flashStatus('Redo applied', '#38bdf8');
}

// ---- Try load initial map ----
try {
  const r = await fetch('/maps/default.json', { cache: 'no-store' });
  if (r.ok) {
    const m = await r.json();
    if (m.islands?.length) islands = m.islands;
    if (m.assets?.length) assets = m.assets;
  }
} catch {}

// ---- Three.js Scene Setup ----
const view = $('view');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
view.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xaee8ff);

const camera = new THREE.PerspectiveCamera(50, 1, 1, 4000);
camera.position.set(0, 650, 440);

const controls = new OrbitControls(camera, renderer.domElement);
controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
controls.maxPolarAngle = 1.48;
controls.enableDamping = true;
controls.dampingFactor = 0.08;

scene.add(new THREE.AmbientLight(0xffffff, 0.95));
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(200, 450, 150);
scene.add(sun);

// Sea plane
const sea = new THREE.Mesh(
  new THREE.CircleGeometry(WORLD.radius, 64),
  new THREE.MeshStandardMaterial({ color: 0x3fb7e8, roughness: 0.3 })
);
sea.rotation.x = -Math.PI / 2;
sea.position.y = -0.2;
scene.add(sea);

// Player Dock
scene.add(makeDock());

// Measurement Grid Plane
const grid = new THREE.GridHelper(WORLD.radius * 2, 80, 0x0284c7, 0x38bdf8);
grid.position.y = 0.05;
grid.material.opacity = 0.22;
grid.material.transparent = true;
grid.visible = false;
scene.add(grid);

function createBoundaryRing(radius, stroke = 1.8, color = 0x38bdf8, opacity = 0.85) {
  const g = new THREE.Group();
  const ringGeo = new THREE.RingGeometry(radius, radius + stroke, 64);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color,
    side: THREE.DoubleSide,
    transparent: true,
    opacity,
    depthWrite: false
  });
  g.add(new THREE.Mesh(ringGeo, ringMat));

  const outerPts = [], innerPts = [];
  for (let i = 0; i <= 64; i++) {
    const th = (i / 64) * Math.PI * 2;
    outerPts.push(Math.cos(th) * (radius + stroke), 0.02, Math.sin(th) * (radius + stroke));
    innerPts.push(Math.cos(th) * radius, 0.02, Math.sin(th) * radius);
  }
  const outerGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(outerPts, 3));
  const innerGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(innerPts, 3));
  const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 });
  g.add(new THREE.LineLoop(outerGeo, lineMat));
  g.add(new THREE.LineLoop(innerGeo, lineMat));
  return g;
}

// Selection & Collision Visualizers
const marker = new THREE.Group();
marker.visible = false;
scene.add(marker);

function updateMarker(x, z, y, radius, stroke = 1.8, color = 0x38bdf8) {
  while (marker.children.length > 0) {
    const c = marker.children[0];
    if (c.geometry) c.geometry.dispose();
    marker.remove(c);
  }
  const ringObj = createBoundaryRing(radius, stroke, color);
  marker.add(ringObj);
  marker.position.set(x, y, z);
  marker.visible = true;
}

const collisionGroup = new THREE.Group();
scene.add(collisionGroup);

// ---- Island & Asset Mesh Management ----
const groups = new Map();
const assetGroups = new Map();
let selected = null;       // island def
let selectedAsset = null;  // asset def
let currentInspectedId = '__none__';

function build(def) {
  if (groups.has(def.id)) scene.remove(groups.get(def.id));
  const g = makeIsland(def);
  g.userData.id = def.id;
  g.userData.isIsland = true;
  scene.add(g);
  groups.set(def.id, g);
}

function buildAssetMesh(def) {
  if (assetGroups.has(def.id)) scene.remove(assetGroups.get(def.id));
  const g = makeAsset(def);
  g.userData.id = def.id;
  g.userData.isAsset = true;

  // Add an invisible pick proxy cylinder so thin/decal/animated assets can be clicked and dragged effortlessly
  const r = Math.max(3.5, 4.2 * (def.scale || 1.0));
  const pickProxy = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, 8.0, 14),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  pickProxy.position.y = 4.0;
  pickProxy.userData.id = def.id;
  pickProxy.userData.isAsset = true;
  g.add(pickProxy);

  scene.add(g);
  assetGroups.set(def.id, g);
}

function updateBillboardTexture(a) {
  const grp = assetGroups.get(a.id);
  const faceMesh = grp?.userData?.faceMesh;
  if (faceMesh) {
    if (faceMesh.material.map) faceMesh.material.map.dispose();
    faceMesh.material.map = createBillboardTexture(a.text, a.textColor, a.bgColor, a.subText);
    faceMesh.material.needsUpdate = true;
  } else {
    buildAssetMesh(a);
  }
}

function rebuildAll() {
  for (const g of groups.values()) scene.remove(g);
  groups.clear();
  islands.forEach(build);

  for (const g of assetGroups.values()) scene.remove(g);
  assetGroups.clear();
  assets.forEach(buildAssetMesh);

  if (selected) {
    selected = islands.find((i) => i.id === selected.id) || null;
  }
  if (selectedAsset) {
    selectedAsset = assets.find((a) => a.id === selectedAsset.id) || null;
  }
  currentInspectedId = '__none__';
  refresh();
}

islands.forEach(build);
assets.forEach(buildAssetMesh);

// ---- Collision / Overlap Check ----
function checkOverlaps() {
  while (collisionGroup.children.length > 0) {
    collisionGroup.remove(collisionGroup.children[0]);
  }
  const collidingIds = new Set();
  for (let i = 0; i < islands.length; i++) {
    for (let j = i + 1; j < islands.length; j++) {
      const a = islands[i], b = islands[j];
      const dist = Math.hypot(a.x - b.x, a.z - b.z);
      if (dist < a.r + b.r + 6) {
        collidingIds.add(a.id);
        collidingIds.add(b.id);
      }
    }
  }
  for (const id of collidingIds) {
    const def = islands.find((i) => i.id === id);
    if (def) {
      const colRing = createBoundaryRing(def.r * 1.06, 2.0, 0xef4444, 0.85);
      colRing.position.set(def.x, 0.38, def.z);
      collisionGroup.add(colRing);
    }
  }
  return collidingIds;
}

// ---- Selection & Refresh ----
function select(def) {
  selected = def;
  selectedAsset = null;
  currentInspectedId = '__none__';
  refresh();
}

function selectAsset(def) {
  selectedAsset = def;
  selected = null;
  currentInspectedId = '__none__';
  refresh();
}

function refresh() {
  if (selected) {
    updateMarker(selected.x, selected.z, 0.35, selected.r * 1.03, 1.8, 0x38bdf8);
    $('btn-focus').disabled = false;
    $('btn-duplicate').disabled = false;
    $('btn-delete').disabled = !!selected.home;
  } else if (selectedAsset) {
    const r = 4.0 * (selectedAsset.scale || 1.0);
    updateMarker(selectedAsset.x, selectedAsset.z, 0.25 + (selectedAsset.y || 0), r, 0.9, 0x38bdf8);
    $('btn-focus').disabled = false;
    $('btn-duplicate').disabled = false;
    $('btn-delete').disabled = false;
  } else {
    marker.visible = false;
    $('btn-focus').disabled = true;
    $('btn-duplicate').disabled = true;
    $('btn-delete').disabled = true;
  }

  checkOverlaps();
  renderInspector();
  renderHierarchy();
  updateStats();
}

function updateStats() {
  $('lbl-count').textContent = islands.length;
  $('lbl-tab-count').textContent = islands.length + assets.length;
  if ($('lbl-asset-count')) $('lbl-asset-count').textContent = assets.length;
}

// ---- WASD Camera Navigation & Input Detection ----
const keys = { w: false, a: false, s: false, d: false, shift: false };

function isInputFocused(e = null) {
  if (e && e.target) {
    const t = e.target;
    if (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return true;
    if (t.closest && t.closest('#side')) return true;
  }
  const active = document.activeElement;
  if (!active) return false;
  if (active.tagName === 'INPUT' || active.tagName === 'SELECT' || active.tagName === 'TEXTAREA' || active.isContentEditable) return true;
  if (active.closest && active.closest('#side')) return true;
  return false;
}

window.addEventListener('keydown', (e) => {
  // If typing anywhere in menus, forms, or sidebars, immediately PAUSE all editor controls!
  if (isInputFocused(e)) {
    keys.w = keys.a = keys.s = keys.d = keys.shift = false;
    return;
  }

  const ctrl = e.ctrlKey || e.metaKey;

  if (ctrl && e.key.toLowerCase() === 'z' && !e.shiftKey) {
    e.preventDefault();
    undo();
    return;
  }
  if (ctrl && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
    e.preventDefault();
    redo();
    return;
  }
  if (ctrl && e.key.toLowerCase() === 'd') {
    e.preventDefault();
    duplicateSelected();
    return;
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if ((selected && !selected.home) || selectedAsset) {
      e.preventDefault();
      deleteSelected();
      return;
    }
  }
  if (e.key.toLowerCase() === 'f') {
    focusSelected();
    return;
  }
  if (e.key.toLowerCase() === 't') {
    toggleViewMode();
    return;
  }

  // Arrow keys to nudge selected asset or island!
  if (selected || selectedAsset) {
    const target = selectedAsset || selected;
    const isAsset = !!selectedAsset;
    const step = e.shiftKey ? (snapSize > 0 ? snapSize * 5 : 10) : (snapSize > 0 ? snapSize : 2);
    let moved = false;

    if (e.key === 'ArrowLeft') {
      target.x -= step;
      moved = true;
    } else if (e.key === 'ArrowRight') {
      target.x += step;
      moved = true;
    } else if (e.key === 'ArrowUp') {
      target.z -= step;
      moved = true;
    } else if (e.key === 'ArrowDown') {
      target.z += step;
      moved = true;
    }

    if (moved) {
      e.preventDefault();
      recordState();
      if (isAsset) {
        const grp = assetGroups.get(target.id);
        if (grp) grp.position.set(target.x, target.y || 0, target.z);
        marker.position.set(target.x, 0.25 + (target.y || 0), target.z);
        renderAssetInspectorPos();
      } else {
        const grp = groups.get(target.id);
        if (grp) grp.position.set(target.x, 0, target.z);
        marker.position.set(target.x, 0.35, target.z);
        renderInspectorPos();
        checkOverlaps();
      }
      return;
    }
  }

  // WASD Flight (only active when not typing)
  const k = e.key.toLowerCase();
  if (k === 'w') keys.w = true;
  if (k === 'a') keys.a = true;
  if (k === 's') keys.s = true;
  if (k === 'd') keys.d = true;
  if (e.shiftKey) keys.shift = true;
});

window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'w') keys.w = false;
  if (k === 'a') keys.a = false;
  if (k === 's') keys.s = false;
  if (k === 'd') keys.d = false;
  if (!e.shiftKey) keys.shift = false;
});

// Safeguards: Reset all movement keys when any input gets focus or window blurs
window.addEventListener('focusin', (e) => {
  if (isInputFocused(e)) {
    keys.w = keys.a = keys.s = keys.d = keys.shift = false;
  }
});
window.addEventListener('blur', () => {
  keys.w = keys.a = keys.s = keys.d = keys.shift = false;
});

// Trap and stop keyboard navigation from leaking out of the sidebar
const sideEl = $('side');
if (sideEl) {
  sideEl.addEventListener('keydown', (e) => {
    keys.w = keys.a = keys.s = keys.d = keys.shift = false;
    e.stopPropagation();
  });
  sideEl.addEventListener('keyup', (e) => {
    keys.w = keys.a = keys.s = keys.d = keys.shift = false;
    e.stopPropagation();
  });
}

function updateCameraFlight(dt) {
  if (isInputFocused()) {
    keys.w = keys.a = keys.s = keys.d = keys.shift = false;
    return;
  }
  const move = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  camera.getWorldDirection(camDir);
  camDir.y = 0;
  camDir.normalize();

  const camRight = new THREE.Vector3(-camDir.z, 0, camDir.x);

  if (keys.w) move.add(camDir);
  if (keys.s) move.sub(camDir);
  if (keys.d) move.add(camRight);
  if (keys.a) move.sub(camRight);

  if (move.lengthSq() > 0) {
    const flightSpeed = (keys.shift ? 600 : 260) * dt;
    move.normalize().multiplyScalar(flightSpeed);
    camera.position.add(move);
    controls.target.add(move);
  }
}

// ---- Dragging & Raycasting ----
const ray = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let drag = null;
let snapSize = 0; // 0 = off, 10, 25, 50

function aim(e) {
  const b = renderer.domElement.getBoundingClientRect();
  mouse.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
  ray.setFromCamera(mouse, camera);

  const pt = new THREE.Vector3();
  if (ray.ray.intersectPlane(groundPlane, pt)) {
    $('lbl-cursor').textContent = `${Math.round(pt.x)}, ${Math.round(pt.z)}`;
  }
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  aim(e);

  const p = new THREE.Vector3();
  if (!ray.ray.intersectPlane(groundPlane, p)) return;

  recordState();

  // 1. If an asset is already selected and user clicks on or near its selection radius, drag it immediately!
  if (selectedAsset) {
    const selDist = Math.hypot(p.x - selectedAsset.x, p.z - selectedAsset.z);
    const selRadius = Math.max(5.5, 5.5 * (selectedAsset.scale || 1.0));
    if (selDist <= selRadius) {
      drag = { isAsset: true, def: selectedAsset, dx: selectedAsset.x - p.x, dz: selectedAsset.z - p.z };
      renderer.domElement.setPointerCapture(e.pointerId);
      return;
    }
  }

  // 2. Test assets first with top priority (so props on islands or in water are never blocked by island terrain)
  const assetMeshes = [...assetGroups.values()];
  const assetHits = ray.intersectObjects(assetMeshes, true);
  if (assetHits.length > 0) {
    let o = assetHits[0].object;
    while (o && o.userData.id === undefined) o = o.parent;
    if (o && o.userData.id) {
      const aDef = assets.find((a) => a.id === o.userData.id);
      if (aDef) {
        drag = { isAsset: true, def: aDef, dx: aDef.x - p.x, dz: aDef.z - p.z };
        selectAsset(aDef);
        renderer.domElement.setPointerCapture(e.pointerId);
        return;
      }
    }
  }

  // 3. Test islands second (only if no asset was clicked)
  const islandMeshes = [...groups.values()];
  const islandHits = ray.intersectObjects(islandMeshes, true);
  if (islandHits.length > 0) {
    let o = islandHits[0].object;
    while (o && o.userData.id === undefined) o = o.parent;
    if (o && o.userData.id) {
      const def = islands.find((i) => i.id === o.userData.id);
      if (def) {
        drag = { isAsset: false, def, dx: def.x - p.x, dz: def.z - p.z };
        select(def);
        renderer.domElement.setPointerCapture(e.pointerId);
        return;
      }
    }
  }
});

renderer.domElement.addEventListener('pointermove', (e) => {
  aim(e);
  if (!drag) return;
  const p = new THREE.Vector3();
  if (!ray.ray.intersectPlane(groundPlane, p)) return;

  let nx = p.x + drag.dx;
  let nz = p.z + drag.dz;
  if (snapSize > 0) {
    nx = Math.round(nx / snapSize) * snapSize;
    nz = Math.round(nz / snapSize) * snapSize;
  }
  drag.def.x = Math.round(nx);
  drag.def.z = Math.round(nz);

  if (drag.isAsset) {
    const grp = assetGroups.get(drag.def.id);
    if (grp) grp.position.set(drag.def.x, drag.def.y || 0, drag.def.z);
    marker.position.set(drag.def.x, 0.25 + (drag.def.y || 0), drag.def.z);
    renderAssetInspectorPos();
  } else {
    const grp = groups.get(drag.def.id);
    if (grp) grp.position.set(drag.def.x, 0, drag.def.z);
    marker.position.set(drag.def.x, 0.35, drag.def.z);
    renderInspectorPos();
    checkOverlaps();
  }
});

renderer.domElement.addEventListener('pointerup', (e) => {
  if (drag) {
    try { renderer.domElement.releasePointerCapture(e.pointerId); } catch {}
    drag = null;
    refresh();
  }
});

// ---- Top-Down View Toggle ----
let isTopDown = false;
function toggleViewMode() {
  isTopDown = !isTopDown;
  if (isTopDown) {
    camera.position.set(controls.target.x, 820, controls.target.z + 0.1);
    controls.maxPolarAngle = 0.05;
    $('btn-view-mode').classList.add('active');
    $('btn-view-mode').textContent = '🌐 Perspective 3D';
  } else {
    camera.position.set(controls.target.x, 500, controls.target.z + 400);
    controls.maxPolarAngle = 1.48;
    $('btn-view-mode').classList.remove('active');
    $('btn-view-mode').textContent = '📐 Top-Down';
  }
}
$('btn-view-mode').onclick = toggleViewMode;

// ---- Grid & Snap Toggles ----
$('btn-grid-toggle').onclick = () => {
  grid.visible = !grid.visible;
  $('lbl-grid').textContent = grid.visible ? 'On' : 'Off';
  $('btn-grid-toggle').classList.toggle('active', grid.visible);
};

const SNAP_MODES = [0, 10, 25, 50];
let snapIndex = 0;
$('btn-snap').onclick = () => {
  snapIndex = (snapIndex + 1) % SNAP_MODES.length;
  snapSize = SNAP_MODES[snapIndex];
  $('lbl-snap').textContent = snapSize === 0 ? 'Off' : `${snapSize}m`;
  $('btn-snap').classList.toggle('active', snapSize > 0);
};

// ---- Focus Selection ----
function focusSelected() {
  const target = selected || selectedAsset;
  if (!target) return;
  controls.target.set(target.x, 0, target.z);
  if (!isTopDown) {
    camera.position.set(target.x, 260, target.z + 220);
  }
}
$('btn-focus').onclick = focusSelected;

// ---- Duplicate & Delete ----
function duplicateSelected() {
  if (selectedAsset) {
    recordState();
    const copy = JSON.parse(JSON.stringify(selectedAsset));
    copy.id = 'asset_' + Date.now();
    copy.name = (copy.name || copy.type) + ' (Copy)';
    copy.x += 12;
    copy.z += 12;
    assets.push(copy);
    buildAssetMesh(copy);
    selectAsset(copy);
    flashStatus(`Asset duplicated!`, '#38bdf8');
    return;
  }

  if (selected) {
    recordState();
    const copy = JSON.parse(JSON.stringify(selected));
    copy.id = 'isle' + Date.now();
    copy.name = (copy.name || 'Island') + ' (Copy)';
    copy.home = false;
    copy.x += 25;
    copy.z += 25;
    copy.seed = 1 + Math.floor(Math.random() * 9999);
    islands.push(copy);
    build(copy);
    select(copy);
    flashStatus('Island cloned!', '#38bdf8');
  }
}
$('btn-duplicate').onclick = duplicateSelected;

function deleteSelected() {
  if (selectedAsset) {
    recordState();
    const id = selectedAsset.id;
    scene.remove(assetGroups.get(id));
    assetGroups.delete(id);
    assets = assets.filter((a) => a.id !== id);
    selectAsset(null);
    flashStatus('Asset removed', '#ef4444');
    return;
  }

  if (selected && !selected.home) {
    recordState();
    const id = selected.id;
    scene.remove(groups.get(id));
    groups.delete(id);
    islands = islands.filter((i) => i.id !== id);
    select(null);
    flashStatus('Island deleted', '#ef4444');
  }
}
$('btn-delete').onclick = deleteSelected;

// ---- Add Island ----
function addIsland() {
  recordState();
  const base = islands.find((i) => i.id === 'mango') || islands[0];
  const theme = JSON.parse(JSON.stringify(base.theme));
  delete theme.feature;
  const def = {
    id: 'isle' + Date.now(),
    name: 'New Island',
    x: Math.round(controls.target.x + 30),
    z: Math.round(controls.target.z + 30),
    r: 25,
    seed: 1 + Math.floor(Math.random() * 9999),
    theme
  };
  islands.push(def);
  build(def);
  select(def);
  switchTab('inspector');
  flashStatus('New island added!', '#22c55e');
}
$('btn-add-quick').onclick = addIsland;

// ---- Add / Spawn Asset ----
export function spawnAsset(itemType) {
  let itemInfo;
  for (const cat of ASSET_CATALOG) {
    const found = cat.items.find((i) => i.type === itemType);
    if (found) { itemInfo = found; break; }
  }
  if (!itemInfo) return;

  recordState();
  let spawnX = Math.round(controls.target.x + 10);
  let spawnZ = Math.round(controls.target.z + 10);
  if (snapSize > 0) {
    spawnX = Math.round(spawnX / snapSize) * snapSize;
    spawnZ = Math.round(spawnZ / snapSize) * snapSize;
  }

  const def = {
    id: 'asset_' + Date.now(),
    type: itemType,
    name: itemInfo.name,
    x: spawnX,
    z: spawnZ,
    y: 0,
    rotY: 0,
    scale: itemInfo.defaultProps?.scale || 1.0,
    ...JSON.parse(JSON.stringify(itemInfo.defaultProps || {}))
  };

  assets.push(def);
  buildAssetMesh(def);
  selectAsset(def);
  switchTab('inspector');
  flashStatus(`Spawned ${itemInfo.name}! Drag to place.`, '#22c55e');
}

// Attach Add Asset buttons
$('btn-add-asset').onclick = () => switchTab('assets');
if ($('btn-toolbar-add-asset')) $('btn-toolbar-add-asset').onclick = () => switchTab('assets');

// ---- Asset Library Palette UI ----
function renderAssetCatalog() {
  const container = $('asset-catalog-container');
  if (!container) return;
  const query = ($('asset-search')?.value || '').toLowerCase();
  container.innerHTML = '';

  for (const cat of ASSET_CATALOG) {
    const filteredItems = cat.items.filter(
      (item) => !query || item.name.toLowerCase().includes(query) || item.desc.toLowerCase().includes(query) || item.type.toLowerCase().includes(query)
    );
    if (filteredItems.length === 0) continue;

    const catEl = document.createElement('div');
    catEl.className = 'asset-category';
    catEl.innerHTML = `<div class="category-title">${cat.category}</div>`;

    const gridEl = document.createElement('div');
    gridEl.className = 'asset-grid';

    for (const item of filteredItems) {
      const card = document.createElement('div');
      card.className = 'asset-card';
      card.innerHTML = `
        <div class="asset-icon">${item.icon}</div>
        <div class="asset-title">${item.name}</div>
        <div class="asset-desc">${item.desc}</div>
        <button class="asset-spawn-btn">+ Add</button>
      `;
      card.onclick = () => spawnAsset(item.type);
      gridEl.appendChild(card);
    }
    catEl.appendChild(gridEl);
    container.appendChild(catEl);
  }
}

window.filterAssets = () => {
  renderAssetCatalog();
};

// ---- Inspector Panel ----
function renderInspectorPos() {
  const xInput = $('input-pos-x');
  const zInput = $('input-pos-z');
  if (xInput && zInput && selected) {
    xInput.value = selected.x;
    zInput.value = selected.z;
  }
}

function renderAssetInspectorPos() {
  const xInput = $('asset-pos-x');
  const zInput = $('asset-pos-z');
  if (xInput && zInput && selectedAsset) {
    xInput.value = selectedAsset.x;
    zInput.value = selectedAsset.z;
  }
}

function renderInspector(force = false) {
  const content = $('inspector-content');
  const targetId = selectedAsset ? selectedAsset.id : (selected ? selected.id : null);

  // If already displaying this object and not forced, DO NOT replace innerHTML (preserves active input focus!)
  if (!force && targetId && targetId === currentInspectedId) {
    return;
  }
  currentInspectedId = targetId;

  // Case 1: Placed Asset Selected
  if (selectedAsset) {
    const a = selectedAsset;

    let typeIcon = '📦';
    for (const cat of ASSET_CATALOG) {
      const it = cat.items.find((i) => i.type === a.type);
      if (it) { typeIcon = it.icon; break; }
    }

    content.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
        <span class="badge" style="font-size: 11px;">${typeIcon} ${a.type.toUpperCase()}</span>
        <button class="tool-btn" id="btn-inspect-del-asset" style="color: #ef4444; border-color: rgba(239,68,68,0.4); padding: 3px 8px;">🗑️ Delete</button>
      </div>

      <div class="section-title">Identity</div>
      <div class="form-row">
        <label>Name</label>
        <input type="text" id="asset-name" value="${a.name || a.type}">
      </div>

      <div class="section-title">Transform</div>
      <div class="form-row">
        <label>Position X, Z</label>
        <div style="display: flex; gap: 4px; width: 150px;">
          <input type="number" id="asset-pos-x" value="${a.x}" style="width: 50%; padding: 4px 6px; background: var(--bg-card); border: 1px solid var(--border); color: #fff; border-radius: 4px;">
          <input type="number" id="asset-pos-z" value="${a.z}" style="width: 50%; padding: 4px 6px; background: var(--bg-card); border: 1px solid var(--border); color: #fff; border-radius: 4px;">
        </div>
      </div>
      <div class="form-row">
        <label>Nudge Move</label>
        <div style="display: flex; gap: 4px; width: 150px;">
          <button class="tool-btn" id="btn-nudge-left" style="flex: 1; text-align: center; padding: 4px 2px;" title="Move Left (← / ArrowLeft)">◀</button>
          <button class="tool-btn" id="btn-nudge-right" style="flex: 1; text-align: center; padding: 4px 2px;" title="Move Right (→ / ArrowRight)">▶</button>
          <button class="tool-btn" id="btn-nudge-up" style="flex: 1; text-align: center; padding: 4px 2px;" title="Move Forward (↑ / ArrowUp)">▲</button>
          <button class="tool-btn" id="btn-nudge-down" style="flex: 1; text-align: center; padding: 4px 2px;" title="Move Back (↓ / ArrowDown)">▼</button>
        </div>
      </div>
      <div class="form-row">
        <label>Height (Y)</label>
        <div class="range-wrap">
          <input type="range" id="asset-pos-y" min="-5" max="30" step="0.5" value="${a.y || 0}">
          <span class="range-val" id="val-asset-y">${a.y || 0}m</span>
        </div>
      </div>
      <div class="form-row">
        <label>Rotation Y</label>
        <div class="range-wrap">
          <input type="range" id="asset-rot-y" min="0" max="360" value="${Math.round(((a.rotY || 0) * 180) / Math.PI) % 360}">
          <span class="range-val" id="val-asset-rot">${Math.round(((a.rotY || 0) * 180) / Math.PI) % 360}°</span>
        </div>
      </div>
      <div class="form-row">
        <label>Scale</label>
        <div class="range-wrap">
          <input type="range" id="asset-scale" min="0.4" max="3.0" step="0.1" value="${a.scale || 1.0}">
          <span class="range-val" id="val-asset-scale">${a.scale || 1.0}x</span>
        </div>
      </div>

      ${a.type === 'billboard' ? `
        <div class="section-title">Billboard Sign Text</div>
        <div class="form-row">
          <label>Main Sign</label>
          <input type="text" id="prop-bb-text" value="${a.text || 'BOOM BOATS'}">
        </div>
        <div class="form-row">
          <label>Subtitle</label>
          <input type="text" id="prop-bb-sub" value="${a.subText || ''}">
        </div>
        <div class="form-row">
          <label>Text Color</label>
          <input type="color" id="prop-bb-textcol" value="${a.textColor || '#ffffff'}" style="width: 60px; height: 26px;">
        </div>
        <div class="form-row">
          <label>Plank Color</label>
          <input type="color" id="prop-bb-bgcol" value="${a.bgColor || '#8b5a2b'}" style="width: 60px; height: 26px;">
        </div>
      ` : ''}

      <div style="margin-top: 20px;">
        <button class="action-btn btn-secondary" id="btn-inspect-dup-asset" style="width: 100%;">📋 Duplicate Asset (Ctrl+D)</button>
      </div>
    `;

    // Event listeners for Asset Inspector (smooth, preserves focus!)
    $('asset-name').oninput = (e) => {
      a.name = e.target.value;
      renderHierarchy();
    };
    $('asset-name').onchange = (e) => {
      recordState();
      a.name = e.target.value;
      renderHierarchy();
    };

    $('asset-pos-x').oninput = (e) => {
      a.x = +e.target.value;
      const grp = assetGroups.get(a.id);
      if (grp) grp.position.x = a.x;
      marker.position.x = a.x;
    };
    $('asset-pos-x').onchange = () => { recordState(); };

    $('asset-pos-z').oninput = (e) => {
      a.z = +e.target.value;
      const grp = assetGroups.get(a.id);
      if (grp) grp.position.z = a.z;
      marker.position.z = a.z;
    };
    $('asset-pos-z').onchange = () => { recordState(); };

    const nudge = (dx, dz) => {
      recordState();
      a.x += dx;
      a.z += dz;
      const grp = assetGroups.get(a.id);
      if (grp) grp.position.set(a.x, a.y || 0, a.z);
      marker.position.set(a.x, 0.25 + (a.y || 0), a.z);
      renderAssetInspectorPos();
    };
    if ($('btn-nudge-left')) $('btn-nudge-left').onclick = () => nudge(-(snapSize > 0 ? snapSize : 2), 0);
    if ($('btn-nudge-right')) $('btn-nudge-right').onclick = () => nudge(snapSize > 0 ? snapSize : 2, 0);
    if ($('btn-nudge-up')) $('btn-nudge-up').onclick = () => nudge(0, -(snapSize > 0 ? snapSize : 2));
    if ($('btn-nudge-down')) $('btn-nudge-down').onclick = () => nudge(0, snapSize > 0 ? snapSize : 2);

    $('asset-pos-y').oninput = (e) => {
      $('val-asset-y').textContent = `${e.target.value}m`;
      a.y = +e.target.value;
      const grp = assetGroups.get(a.id);
      if (grp) grp.position.y = a.y;
      marker.position.y = 0.25 + a.y;
    };
    $('asset-pos-y').onchange = () => { recordState(); };

    $('asset-rot-y').oninput = (e) => {
      $('val-asset-rot').textContent = `${e.target.value}°`;
      a.rotY = (+e.target.value * Math.PI) / 180;
      const grp = assetGroups.get(a.id);
      if (grp) grp.rotation.y = a.rotY;
    };
    $('asset-rot-y').onchange = () => { recordState(); };

    $('asset-scale').oninput = (e) => {
      $('val-asset-scale').textContent = `${e.target.value}x`;
      a.scale = +e.target.value;
      const grp = assetGroups.get(a.id);
      if (grp) grp.scale.set(a.scale, a.scale, a.scale);
      updateMarker(a.x, a.z, 0.25 + (a.y || 0), 4.0 * a.scale, 0.9, 0x38bdf8);
    };
    $('asset-scale').onchange = () => { recordState(); };

    $('btn-inspect-del-asset').onclick = deleteSelected;
    $('btn-inspect-dup-asset').onclick = duplicateSelected;

    if (a.type === 'billboard') {
      $('prop-bb-text').oninput = (e) => {
        a.text = e.target.value;
        updateBillboardTexture(a);
      };
      $('prop-bb-text').onchange = (e) => {
        recordState();
        a.text = e.target.value;
        updateBillboardTexture(a);
      };

      $('prop-bb-sub').oninput = (e) => {
        a.subText = e.target.value;
        updateBillboardTexture(a);
      };
      $('prop-bb-sub').onchange = (e) => {
        recordState();
        a.subText = e.target.value;
        updateBillboardTexture(a);
      };

      $('prop-bb-textcol').oninput = (e) => {
        a.textColor = e.target.value;
        updateBillboardTexture(a);
      };
      $('prop-bb-textcol').onchange = (e) => {
        recordState();
        a.textColor = e.target.value;
        updateBillboardTexture(a);
      };

      $('prop-bb-bgcol').oninput = (e) => {
        a.bgColor = e.target.value;
        updateBillboardTexture(a);
      };
      $('prop-bb-bgcol').onchange = (e) => {
        recordState();
        a.bgColor = e.target.value;
        updateBillboardTexture(a);
      };
    }
    return;
  }

  // Case 2: No Selection
  if (!selected) {
    content.innerHTML = `
      <div style="color: var(--text-dim); text-align: center; margin-top: 50px;">
        <div style="font-size: 32px; margin-bottom: 8px;">🏝️</div>
        Select an island or asset to edit its transform, colors, and settings.
        <div style="margin-top: 14px;">
          <button class="tool-btn" onclick="switchTab('assets')" style="margin: 0 auto;">📦 Open Asset Library</button>
        </div>
      </div>
    `;
    return;
  }

  // Case 3: Island Selected
  const d = selected;
  const editIsland = (fn) => {
    recordState();
    fn();
    build(d);
    checkOverlaps();
  };

  const overlaps = [];
  for (const o of islands) {
    if (o !== d && Math.hypot(o.x - d.x, o.z - d.z) < d.r + o.r + 6) {
      overlaps.push(o.name || o.id);
    }
  }

  const distToHarbor = Math.round(Math.hypot(d.x - WORLD.safeHarbor.x, d.z - WORLD.safeHarbor.z));

  content.innerHTML = `
    ${overlaps.length ? `<div class="alert-box">⚠️ Overlaps with: ${overlaps.join(', ')}</div>` : ''}
    
    <div class="section-title">Identity & Role</div>
    <div class="form-row">
      <label>Name</label>
      <input type="text" id="prop-name" value="${d.name || d.id}">
    </div>
    <div class="form-row">
      <label>Enemy Boat</label>
      <select id="prop-enemy">
        ${ENEMIES.map((e) => `<option value="${e}" ${d.enemy === e ? 'selected' : ''}>${e || '(None)'}</option>`).join('')}
      </select>
    </div>
    <div class="form-row">
      <label>Signature Feature</label>
      <select id="prop-feature">
        ${FEATURES.map((f) => `<option value="${f}" ${(d.theme.feature || '') === f ? 'selected' : ''}>${f || '(None)'}</option>`).join('')}
      </select>
    </div>

    <div class="section-title">Transform</div>
    <div class="form-row">
      <label>Radius Size</label>
      <div class="range-wrap">
        <input type="range" id="prop-radius" min="10" max="65" value="${d.r}">
        <span class="range-val" id="val-radius">${d.r}m</span>
      </div>
    </div>
    <div class="form-row">
      <label>Position X, Z</label>
      <div style="display: flex; gap: 4px; width: 150px;">
        <input type="number" id="input-pos-x" value="${d.x}" style="width: 50%; padding: 4px 6px; background: var(--bg-card); border: 1px solid var(--border); color: #fff; border-radius: 4px;">
        <input type="number" id="input-pos-z" value="${d.z}" style="width: 50%; padding: 4px 6px; background: var(--bg-card); border: 1px solid var(--border); color: #fff; border-radius: 4px;">
      </div>
    </div>
    <div style="font-size: 11px; color: var(--text-dim); margin: 4px 0 12px; display: flex; justify-content: space-between;">
      <span>Dist to Harbor: <strong>${distToHarbor}m</strong></span>
      <span>Seed: ${d.seed}</span>
    </div>

    <div class="section-title">Color Palette</div>
    <div class="preset-btns">
      ${Object.keys(PALETTES).map((p) => `<button class="preset-btn" data-palette="${p}">${p}</button>`).join('')}
    </div>
    <div class="color-grid">
      ${COLOR_KEYS.map((k) => `
        <div class="color-picker-box">
          <input type="color" data-color-key="${k}" value="${hex(d.theme[k] ?? 0xffffff)}">
          <span>${k}</span>
        </div>
      `).join('')}
    </div>
  `;

  $('prop-name').oninput = (e) => {
    d.name = e.target.value;
    renderHierarchy();
  };
  $('prop-name').onchange = (e) => {
    recordState();
    d.name = e.target.value;
    renderHierarchy();
  };

  $('prop-enemy').onchange = (e) => editIsland(() => { e.target.value ? (d.enemy = e.target.value) : delete d.enemy; renderHierarchy(); });
  $('prop-feature').onchange = (e) => editIsland(() => { e.target.value ? (d.theme.feature = e.target.value) : delete d.theme.feature; });

  $('prop-radius').oninput = (e) => {
    $('val-radius').textContent = `${e.target.value}m`;
    d.r = +e.target.value;
    build(d);
    updateMarker(d.x, d.z, 0.35, d.r * 1.03, 1.8, 0x38bdf8);
    checkOverlaps();
  };
  $('prop-radius').onchange = () => { recordState(); };

  $('input-pos-x').oninput = (e) => {
    d.x = +e.target.value;
    const grp = groups.get(d.id);
    if (grp) grp.position.x = d.x;
    marker.position.x = d.x;
    checkOverlaps();
  };
  $('input-pos-x').onchange = () => { recordState(); };

  $('input-pos-z').oninput = (e) => {
    d.z = +e.target.value;
    const grp = groups.get(d.id);
    if (grp) grp.position.z = d.z;
    marker.position.z = d.z;
    checkOverlaps();
  };
  $('input-pos-z').onchange = () => { recordState(); };

  content.querySelectorAll('[data-palette]').forEach((btn) => {
    btn.onclick = () => {
      const pal = PALETTES[btn.getAttribute('data-palette')];
      if (pal) editIsland(() => { Object.assign(d.theme, pal); });
    };
  });

  content.querySelectorAll('[data-color-key]').forEach((input) => {
    input.onchange = (e) => {
      const k = e.target.getAttribute('data-color-key');
      editIsland(() => { d.theme[k] = parseInt(e.target.value.slice(1), 16); });
    };
  });
}

// ---- Hierarchy / Outliner List ----
window.switchTab = (tab) => {
  $('tab-inspector').classList.toggle('active', tab === 'inspector');
  $('tab-hierarchy').classList.toggle('active', tab === 'hierarchy');
  if ($('tab-assets')) $('tab-assets').classList.toggle('active', tab === 'assets');

  $('panel-inspector').style.display = tab === 'inspector' ? 'block' : 'none';
  $('panel-hierarchy').style.display = tab === 'hierarchy' ? 'block' : 'none';
  if ($('panel-assets')) $('panel-assets').style.display = tab === 'assets' ? 'block' : 'none';

  if (tab === 'assets') renderAssetCatalog();
};

window.filterHierarchy = () => {
  renderHierarchy();
};

function renderHierarchy() {
  const list = $('hierarchy-list');
  const query = ($('hierarchy-search')?.value || '').toLowerCase();
  list.innerHTML = '';

  // 1. Islands Section
  const islandHeading = document.createElement('div');
  islandHeading.className = 'section-title';
  islandHeading.textContent = `Islands (${islands.length})`;
  list.appendChild(islandHeading);

  for (const d of islands) {
    if (query && !d.name.toLowerCase().includes(query) && !d.id.toLowerCase().includes(query)) continue;
    const item = document.createElement('div');
    item.className = 'island-item' + (selected === d ? ' active' : '');
    item.innerHTML = `
      <div class="item-info">
        <div class="item-dot" style="background: ${hex(d.theme.sand)};"></div>
        <span class="item-name">${d.name || d.id}</span>
      </div>
      <div style="display: flex; gap: 4px; align-items: center;">
        ${d.enemy ? `<span class="item-badge">⚔️ ${d.enemy}</span>` : ''}
        ${d.home ? `<span class="item-badge" style="color: #22c55e;">Home</span>` : ''}
      </div>
    `;
    item.onclick = () => {
      select(d);
      focusSelected();
    };
    list.appendChild(item);
  }

  // 2. Assets Section
  if (assets.length > 0) {
    const assetHeading = document.createElement('div');
    assetHeading.className = 'section-title';
    assetHeading.style.marginTop = '14px';
    assetHeading.textContent = `Placed Props & Assets (${assets.length})`;
    list.appendChild(assetHeading);

    for (const a of assets) {
      if (query && !a.name.toLowerCase().includes(query) && !a.type.toLowerCase().includes(query)) continue;
      
      let icon = '📦';
      for (const cat of ASSET_CATALOG) {
        const it = cat.items.find((i) => i.type === a.type);
        if (it) { icon = it.icon; break; }
      }

      const item = document.createElement('div');
      item.className = 'island-item' + (selectedAsset === a ? ' active' : '');
      item.innerHTML = `
        <div class="item-info">
          <span style="font-size: 14px;">${icon}</span>
          <span class="item-name">${a.name || a.type}</span>
        </div>
        <div style="display: flex; gap: 4px; align-items: center;">
          <span class="item-badge">${a.type}</span>
        </div>
      `;
      item.onclick = () => {
        selectAsset(a);
        focusSelected();
        switchTab('inspector');
      };
      list.appendChild(item);
    }
  }
}

// ---- Import / Export / Save ----
function flashStatus(msg, color = '#22c55e') {
  const s = $('status');
  s.style.color = color;
  s.textContent = msg;
  setTimeout(() => { if (s.textContent === msg) s.textContent = ''; }, 3500);
}

$('btn-save').onclick = async () => {
  flashStatus('Saving to Mapchanges/…', '#38bdf8');
  try {
    const r = await fetch('/api/map', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ islands, assets })
    });
    if (!r.ok) throw new Error(await r.text());
    const res = await r.json();
    flashStatus('Saved to Mapchanges/ & public/maps/ (Fallback updated ✔)', '#22c55e');
  } catch (e) {
    flashStatus('Save failed: ' + e.message, '#ef4444');
  }
};

if ($('btn-fallback')) {
  $('btn-fallback').onclick = async () => {
    if (!confirm('Revert map to the previous fallback version in Mapchanges/last_version_fallback.json?')) return;
    flashStatus('Restoring fallback…', '#38bdf8');
    try {
      const r = await fetch('/api/map/fallback', { method: 'POST' });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || 'Failed to restore fallback');
      }
      const res = await r.json();
      if (res.map?.islands) {
        recordState();
        islands = res.map.islands;
        assets = Array.isArray(res.map.assets) ? res.map.assets : [];
        rebuildAll();
        flashStatus('Reverted to last fallback version ✔', '#22c55e');
      }
    } catch (e) {
      flashStatus(e.message, '#ef4444');
    }
  };
}

$('btn-export').onclick = () => {
  const data = JSON.stringify({ islands, assets }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `boomboats_map_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  flashStatus('Map exported to JSON file ✔', '#38bdf8');
};

$('btn-import').onclick = () => {
  $('file-import').click();
};

$('file-import').onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const parsed = JSON.parse(ev.target.result);
      if (!Array.isArray(parsed.islands) || !parsed.islands.some((i) => i.home)) {
        throw new Error('Invalid map JSON: must contain an islands array with a home island.');
      }
      recordState();
      islands = parsed.islands;
      assets = Array.isArray(parsed.assets) ? parsed.assets : [];
      rebuildAll();
      flashStatus('Map imported successfully ✔', '#22c55e');
    } catch (err) {
      alert('Error importing map: ' + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
};

$('btn-undo').onclick = undo;
$('btn-redo').onclick = redo;

// ---- Resize & Animation Loop ----
function resize() {
  const w = view.clientWidth, h = view.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  const t = clock.getElapsedTime();
  updateCameraFlight(dt);
  controls.update();

  if (marker.visible) {
    marker.rotation.y += dt * 0.8;
  }

  for (const g of assetGroups.values()) {
    if (g.userData && g.userData.tick) {
      g.userData.tick(t, dt);
    }
  }

  renderer.render(scene, camera);
});

// Initial UI Render
refresh();
renderAssetCatalog();
updateHistoryButtons();
