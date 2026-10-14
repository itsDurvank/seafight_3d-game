import * as THREE from 'three';

// "Sunfire" first-person (cockpit) rig. Companion to heroBoat.js.
//
//   const hero = buildHeroBoat(style);
//   const fpv  = buildHeroBoatFPV(hero, style);   // adds itself to `hero`
//   fpv.userData.mount(camera);                   // camera becomes a child of the pilot's eyes
//   fpv.userData.setActive(true);                 // show cockpit, hide pilot + dome
//   // every frame, after hero.userData.update(dt, t, boat):
//   fpv.userData.update(dt, t, boat);
//   // when guns fire:  fpv.userData.fire();   when hit:  fpv.userData.hit();
//
// Needs ONE line added to heroBoat.js, just before `g.scale.setScalar(...)`:
//   g.userData.fpvHide = [pilot, dome];
//
// Reads boat.state.speed, boat.state.turnVel, boat.boosting (same as the hero),
// and optionally boat.hp / boat.maxHp for the hull bar on the HUD.
// Recommended camera: fov 70-80. The rig sets camera.near = 0.05.

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.7, ...extra });
const glow = (color, opacity = 1, additive = false, map = null) => new THREE.MeshBasicMaterial({
  color, map, transparent: opacity < 1 || additive, opacity, depthWrite: !additive, side: THREE.DoubleSide,
  blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
});
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function radialTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,230,150,0.7)'); gr.addColorStop(1, 'rgba(255,160,40,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function buildHeroBoatFPV(hero, style = {}) {
  const C = {
    accent: style.accent ?? 0xff7a59, dark: 0x3b4452, neon: 0x39e6ff, glove: 0xffd9a0,
    metal: 0x2a303a, cabin: style.cabin ?? 0xffd9a0,
  };
  const g = new THREE.Group();           // everything cockpit-related (hero-local space)
  g.visible = false; hero.add(g);

  // Eye point = the pilot's head. Rotated PI so a camera child (which looks down -Z) looks along the boat's +Z.
  const eye = new THREE.Object3D(); eye.position.set(0, 1.52, -0.45); eye.rotation.y = Math.PI; hero.add(eye);

  const add = (m, x = 0, y = 0, z = 0, parent = g) => { m.position.set(x, y, z); parent.add(m); return m; };
  const box = (w, h, d, color, x, y, z, parent) => add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), std(color)), x, y, z, parent);

  // ---- glass orb: clear bubble around the cockpit, no frame, no lines ----
  const orbTex = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = 'rgba(200,240,255,0.05)'; x.fillRect(0, 0, 256, 128);          // whisper of tint
    const gloss = (px, py, rx, ry, rot, a) => {                                  // soft sun-gloss streaks
      x.save(); x.translate(px, py); x.rotate(rot); x.scale(1, ry / rx);
      const gr = x.createRadialGradient(0, 0, 0, 0, 0, rx);
      gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = gr; x.beginPath(); x.arc(0, 0, rx, 0, Math.PI * 2); x.fill(); x.restore();
    };
    gloss(56, 44, 24, 24, -0.5, 0.28); gloss(84, 36, 14, 14, -0.4, 0.2); gloss(198, 50, 22, 22, 0.5, 0.12);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const orb = new THREE.Mesh(new THREE.SphereGeometry(2.0, 48, 32), new THREE.MeshBasicMaterial({
    map: orbTex, transparent: true, side: THREE.BackSide, depthWrite: false, fog: false }));
  orb.renderOrder = 5; add(orb, 0, 1.0, 0.3);

  // ---- dashboard: sloped cowl, speed gauge, boost bar ----
  const dash = new THREE.Group(); add(dash, 0, 1.24, 0.45); dash.rotation.x = 0.2; g.add(dash);
  box(1.35, 0.1, 0.5, C.metal, 0, 0, 0, dash);
  box(1.37, 0.03, 0.05, C.accent, 0, 0.03, 0.26, dash);                   // accent lip on the far edge
  add(new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.012, 0.012), glow(C.neon)), 0, 0.056, 0.2, dash);

  // Shifted speed gauge to -0.18 to ensure clearance with left console lever at -0.42
  const gauge = new THREE.Group(); add(gauge, -0.18, 0.052, -0.02, dash); gauge.rotation.x = -Math.PI / 2;
  add(new THREE.Mesh(new THREE.CircleGeometry(0.13, 24), glow(0x0b1018)), 0, 0, 0, gauge);
  add(new THREE.Mesh(new THREE.RingGeometry(0.115, 0.13, 28), glow(C.neon)), 0, 0, 0.002, gauge);
  const needle = new THREE.Group(); add(needle, 0, 0, 0.004, gauge);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.1, 0.004), glow(0xff5a3c)), 0, 0.05, 0, needle);
  add(new THREE.Mesh(new THREE.CircleGeometry(0.014, 10), glow(0xffffff)), 0, 0, 0.006, gauge);

  const boostGroup = new THREE.Group(); add(boostGroup, 0.19, 0.054, 0.02, dash);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.008, 0.06), glow(0x0b1018)), 0.23, 0, 0, boostGroup);
  const boostGeo = new THREE.BoxGeometry(0.44, 0.01, 0.04); boostGeo.translate(0.22, 0, 0);
  const boostBar = add(new THREE.Mesh(boostGeo, glow(0xffb02e)), 0.01, 0.004, 0, boostGroup);

  // ---- little extras: radar scope, toggles, cogs, throttle lever, button pad, seat ----
  const radar = new THREE.Group(); add(radar, 0.055, 0.052, 0.0, dash); radar.rotation.x = -Math.PI / 2;
  add(new THREE.Mesh(new THREE.CircleGeometry(0.075, 24), glow(0x07161d)), 0, 0, 0, radar);
  for (const r of [0.025, 0.05, 0.072]) add(new THREE.Mesh(new THREE.RingGeometry(r - 0.0015, r, 28), glow(C.neon, 0.6)), 0, 0, 0.002, radar);
  const sweep = new THREE.Group(); add(sweep, 0, 0, 0.004, radar);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.07, 0.001), glow(0x9dffb0)), 0, 0.035, 0, sweep);
  for (const [bx, by] of [[0.03, 0.02], [-0.025, 0.04], [0.04, -0.035]]) add(new THREE.Mesh(new THREE.CircleGeometry(0.006, 8), glow(0xff5a3c)), bx, by, 0.003, radar);

  [[0.2, C.accent, 0.35], [0.3, 0x39e6ff, -0.3], [0.4, 0xffe066, 0.3], [0.5, C.accent, -0.35]].forEach(([x, col, tilt]) => { // toggle row
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.012, 10), std(C.dark)), x, 0.056, -0.16, dash);
    const lv = new THREE.Group(); add(lv, x, 0.062, -0.16, dash); lv.rotation.z = tilt;
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.045, 6), std(0xcfd8e3)), 0, 0.022, 0, lv);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.01, 8, 6), col === 0x39e6ff || col === 0xffe066 ? glow(col) : std(col)), 0, 0.047, 0, lv);
  });

  const cog = (r, n, color, x, z) => {                                         // a pair of little meshing cogs
    const c = new THREE.Group(); add(c, x, 0.06, z, dash);
    add(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r * 0.8, 0.014, 16), std(color)), 0, 0, 0, c);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, tooth = new THREE.Mesh(new THREE.BoxGeometry(r * 0.38, 0.014, r * 0.32), std(color));
      tooth.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); tooth.rotation.y = -a; c.add(tooth);
    }
    add(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.28, r * 0.28, 0.018, 10), glow(C.neon)), 0, 0.002, 0, c);
    return c;
  };
  const cogA = cog(0.05, 10, C.accent, -0.58, 0.02), cogB = cog(0.032, 7, 0xcfd8e3, -0.515, -0.025);

  box(0.1, 0.05, 0.2, C.metal, -0.42, 1.225, 0.0);                              // throttle lever on the left console
  box(0.02, 0.01, 0.14, 0x1b2028, -0.42, 1.252, 0.0);
  const throttle = new THREE.Group(); add(throttle, -0.42, 1.255, -0.06);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.2, 8), std(0xcfd8e3)), 0, 0.1, 0, throttle);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), std(C.accent)), 0, 0.21, 0, throttle);
  add(new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 5, 12), glow(C.neon, 0.8)), 0, 0.21, 0, throttle).rotation.x = Math.PI / 2;

  const pad = new THREE.Group(); add(pad, 0.42, 1.225, 0.02); pad.rotation.x = 0.25;   // button pad on the right
  box(0.12, 0.03, 0.16, C.metal, 0, 0, 0, pad);
  [[-0.035, 0x7dff9c], [0, 0xffb02e], [0.035, 0xff5a3c]].forEach(([x, col]) =>
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 10), glow(col)), x, 0.02, 0.03, pad));

  // seat: low cushion + side bolsters + lap belt only (no backrest, so the view behind stays clear)
  const seatC = 0x364152, belt = 0xfff4e0;
  box(0.56, 0.09, 0.5, seatC, 0, 1.245, -0.6, g);
  box(0.58, 0.02, 0.52, C.accent, 0, 1.2, -0.6, g);
  for (const sx of [-1, 1]) {
    box(0.08, 0.06, 0.38, seatC, sx * 0.32, 1.28, -0.6, g);
  }
  const strap = (a, b, w = 0.05) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.012, d.length()), std(belt)); m.rotation.order = 'YXZ';
    m.rotation.y = Math.atan2(d.x, d.z); m.rotation.x = -Math.atan2(d.y, Math.hypot(d.x, d.z));
    return add(m, (A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
  };
  for (const sx of [-1, 1]) {
    strap([sx * 0.3, 1.3, -0.72], [sx * 0.03, 1.31, -0.5]);                      // lap
  }
  box(0.07, 0.02, 0.07, 0xcfd8e3, 0, 1.32, -0.5, g);                              // buckle

  // console block: if the boat reports its deck height (userData.fpvFloor), fill from the deck up to the
  // cockpit floor so the seat, dash and hands sit on something solid instead of floating or sinking into a cabin
  const floorY = hero.userData.fpvFloor;
  if (floorY != null && floorY < 1.17) {
    const th = 1.18 - floorY;
    box(1.4, th, 2.0, C.metal, 0, floorY + th / 2, -0.3, g);
  }

  // ---- aircraft-style yoke: control column, crossbar, vertical grips ----
  const yoke = new THREE.Group(); add(yoke, 0, 1.3, -0.1); yoke.rotation.x = 0.05;   // pulled back so the grips sit clear of the dash
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.32, 10).rotateX(Math.PI / 2), std(0xcfd8e3)), 0, 0, 0.16, yoke); // chrome column
  // where the column comes out of the dash: neon-framed recess + rubber bellows
  add(new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.105, 0.01), glow(C.neon, 0.9)), 0, 0, -0.252, dash);
  box(0.25, 0.085, 0.016, 0x1b2028, 0, 0, -0.258, dash);
  const boot = add(new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.058, 0.07, 14).rotateX(Math.PI / 2), std(0x2a303a)), 0, 0, -0.29, dash); boot.rotation.x = -0.2;
  add(new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.008, 6, 16), std(C.accent)), 0, 0, -0.324, dash).rotation.x = -0.2;
  const wheel = new THREE.Group(); yoke.add(wheel);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 14).rotateX(Math.PI / 2), std(C.dark)), 0, 0, 0, wheel); // hub
  box(0.38, 0.035, 0.035, C.dark, 0, -0.01, 0, wheel);                                                                     // crossbar
  add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.008, 0.008), glow(C.neon)), 0, -0.01, -0.02, wheel);
  const hands = [], sleeves = [];
  for (const s of [-1, 1]) {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.17, 10), std(C.accent)), s * 0.19, 0.07, 0, wheel);       // grip
    add(new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), std(C.dark)), s * 0.19, 0.16, 0, wheel);                       // grip cap
    const hand = add(new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), std(C.glove)), s * 0.19, 0.07, -0.008, wheel);
    hand.scale.set(1, 1.3, 1); hands.push(hand);
    const sl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1), std(C.accent)); sl.rotation.order = 'YXZ'; g.add(sl);
    sleeves.push({ m: sl, elbow: new THREE.Vector3(s * 0.28, 1.15, -0.36) });
  }
  add(new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), glow(0xff4d4d)), 0.19, 0.17, -0.03, wheel);                       // trigger button
  const _h = new THREE.Vector3(), _d = new THREE.Vector3();
  const placeSleeves = () => {              // stretch each sleeve from the fixed elbow to the (rotating) hand
    wheel.updateWorldMatrix(true, true);
    hands.forEach((hd, i) => {
      const { m, elbow } = sleeves[i];
      hero.worldToLocal(hd.getWorldPosition(_h));
      _d.copy(_h).sub(elbow); const len = _d.length();
      m.scale.z = len; m.position.copy(elbow).addScaledVector(_d, 0.5);
      m.rotation.y = Math.atan2(_d.x, _d.z); m.rotation.x = -Math.atan2(_d.y, Math.hypot(_d.x, _d.z));
    });
  };
  placeSleeves();

  // ---- HUD: a screen-locked layer (speed / hull / boost, glued to the camera) + a gun-line crosshair on the boat ----
  const HH = 540;                                                   // HUD canvas height; width follows the screen aspect
  const cv = document.createElement('canvas'); cv.width = 960; cv.height = HH;
  const cx = cv.getContext('2d');
  let hudTex = new THREE.CanvasTexture(cv); hudTex.colorSpace = THREE.SRGBColorSpace;
  const hudMat = new THREE.MeshBasicMaterial({ map: hudTex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
  const hud = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), hudMat);
  hud.renderOrder = 999; hud.position.set(0, 0, -1.6); hud.frustumCulled = false; // parented to the camera in mount()

  const xc = document.createElement('canvas'); xc.width = xc.height = 128; const xx = xc.getContext('2d');
  const xTex = new THREE.CanvasTexture(xc); xTex.colorSpace = THREE.SRGBColorSpace;
  const aim = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({
    map: xTex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
  aim.renderOrder = 999; aim.position.set(0, 0, -1.6); aim.frustumCulled = false; eye.add(aim);  // stays on the gun line when you look around

  let hudAspect = 0;
  const fitHUD = (camera) => {                                       // make the HUD plane exactly fill the view
    const a = camera.aspect;
    if (Math.abs(a - hudAspect) > 0.01) {
      hudAspect = a; cv.width = Math.round(clamp(HH * a, 360, 2400)); cv.height = HH;
      hudTex.dispose(); hudTex = new THREE.CanvasTexture(cv); hudTex.colorSpace = THREE.SRGBColorSpace;
      hudMat.map = hudTex; hudMat.needsUpdate = true;
    }
    const h = 2 * 1.6 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    hud.scale.set(h * a, h, 1);
  };

  const drawAim = (boostK) => {
    xx.clearRect(0, 0, 128, 128);
    xx.strokeStyle = xx.fillStyle = '#39e6ff'; xx.lineWidth = 3; xx.shadowColor = '#39e6ff'; xx.shadowBlur = 6;
    xx.beginPath(); xx.arc(64, 64, 24 + boostK * 6, 0, Math.PI * 2); xx.stroke();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      xx.beginPath(); xx.moveTo(64 + dx * 33, 64 + dy * 33); xx.lineTo(64 + dx * 52, 64 + dy * 52); xx.stroke();
    }
    xx.fillRect(62, 62, 4, 4);
    xTex.needsUpdate = true;
  };

  const drawHUD = (speed, speedK, boostK, flashK, boat) => {
    const W = cv.width, H = cv.height, k = H / 981, Lo = u.hudLayout;   // k keeps the HUD at its original on-screen size
    cx.clearRect(0, 0, W, H);
    if (flashK > 0.01) { // damage flash: red glow in all four screen corners, middle of the view stays clear
      for (const [gx, gy] of [[0, 0], [W, 0], [0, H], [W, H]]) {
        const v = cx.createRadialGradient(gx, gy, 0, gx, gy, H * 0.42);
        v.addColorStop(0, `rgba(255,40,30,${flashK * 0.35})`); v.addColorStop(1, 'rgba(255,40,30,0)');
        cx.fillStyle = v; cx.fillRect(0, 0, W, H);
      }
    }
    cx.strokeStyle = cx.fillStyle = '#39e6ff'; cx.lineWidth = Math.max(1.5, 2 * k); cx.shadowColor = '#39e6ff'; cx.shadowBlur = 8 * k;
    cx.textBaseline = 'middle';
    // speed: ring gauge with the number inside
    const sx = W * Lo.speed[0], sy = H * Lo.speed[1];
    cx.globalAlpha = 0.25; cx.beginPath(); cx.arc(sx, sy, 30 * k, 0, Math.PI * 2); cx.stroke(); cx.globalAlpha = 1;
    cx.beginPath(); cx.arc(sx, sy, 30 * k, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * speedK)); cx.stroke();
    cx.textAlign = 'center'; cx.font = `bold ${28 * k}px monospace`; cx.fillText(String(Math.round(speed)), sx, sy - 2 * k);
    cx.font = `${12 * k}px monospace`; cx.fillText('SPD', sx, sy + 42 * k);
    // boost bar
    const bx = W * Lo.boost[0], by = H * Lo.boost[1], col = boostK > 0.1 ? '#ffb02e' : '#39e6ff';
    cx.strokeRect(bx - 80 * k, by - 6 * k, 160 * k, 12 * k);
    cx.fillStyle = col; cx.shadowColor = col; cx.fillRect(bx - 78 * k, by - 4 * k, 156 * k * Math.max(0.03, boostK), 8 * k);
    cx.font = `${12 * k}px monospace`; cx.fillText('BOOST', bx, by + 24 * k);
    // hull bar (if the game provides hp)
    if (boat && boat.maxHp > 0 && boat.hp != null) {
      const f = clamp(boat.hp / boat.maxHp, 0, 1), hc = f > 0.35 ? '#7dff9c' : '#ff5a3c';
      const hx = W * Lo.hull[0] - 98 * k, hy = H * Lo.hull[1];
      cx.strokeStyle = cx.fillStyle = hc; cx.shadowColor = hc; cx.textAlign = 'left';
      cx.font = `${12 * k}px monospace`; cx.fillText('HULL', hx, hy);
      cx.strokeRect(hx + 46 * k, hy - 6 * k, 150 * k, 12 * k); cx.fillRect(hx + 48 * k, hy - 4 * k, 146 * k * f, 8 * k);
    }
    cx.shadowBlur = 0;
    hudTex.needsUpdate = true;
  };

  // ---- muzzle flashes at the chin-gun muzzles (z = 3.6) ----
  const flashTex = radialTexture(), flashes = [];
  for (const s of [-1, 1]) {
    const f = new THREE.Group(); add(f, s * 0.5, 0.95, 3.75);
    const m1 = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glow(0xffffff, 1, true, flashTex));
    const m2 = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glow(0xffffff, 0.8, true, flashTex)); m2.rotation.y = Math.PI / 2; m2.scale.set(2.2, 1, 1);
    f.add(m1, m2); f.visible = false; flashes.push(f);
  }

  // ---- state + hooks ----
  let boostK = 0, flashK = 0, fireT = 0, hudT = 0, steer = 0, cam = null, baseFov = 75;
  const u = g.userData;
  u.eye = eye;
  u.hudLayout = { speed: [0.24, 0.68], boost: [0.75, 0.63], hull: [0.25, 0.41] };  // HUD element centres as fractions of the screen (x, y from top-left)

  u.mount = (camera) => {
    cam = camera; eye.add(camera);
    camera.position.set(0, 0, 0); camera.rotation.set(0, 0, 0); camera.rotation.order = 'YXZ';
    camera.near = 0.15; baseFov = camera.fov; camera.updateProjectionMatrix();
    camera.add(hud); fitHUD(camera);
    return camera;
  };
  u.unmount = () => { if (cam) { cam.remove(hud); eye.remove(cam); cam.fov = baseFov; cam.updateProjectionMatrix(); cam = null; } };
  u.setActive = (on) => {
    g.visible = on; hud.visible = on; aim.visible = on;
    (hero.userData.fpvHide || []).forEach((o) => { o.visible = !on; });
  };
  u.hit = () => { flashK = 1; };
  u.fire = () => { fireT = 0.07; };

  // Free look: head turns, boat and guns keep pointing forward (crosshair stays on the gun line).
  //   fpv.userData.look.active = true while the player drags; call addLook(dx, dy) with mouse deltas in px.
  //   When active is false and recenter is true the view eases back to straight ahead.
  u.look = { yaw: 0, pitch: 0, active: false, recenter: true };
  u.addLook = (dx, dy, sens = 0.004) => {
    const L = u.look;
    L.yaw = THREE.MathUtils.euclideanModulo(L.yaw - dx * sens + Math.PI, Math.PI * 2) - Math.PI;
    L.pitch = clamp(L.pitch - dy * sens, -1.2, 1.2);
  };
  u.resetLook = () => { u.look.yaw = 0; u.look.pitch = 0; };

  u.update = (dt, t, boat) => {
    if (!g.visible) return;
    const st = boat.state || {}, speed = Math.max(0, st.speed || 0), turn = st.turnVel || 0;
    const speedK = clamp(speed / 114, 0, 1);
    boostK += ((boat.boosting ? 1 : 0) - boostK) * (1 - Math.exp(-8 * dt));
    flashK = Math.max(0, flashK - dt * 3);
    fireT = Math.max(0, fireT - dt);

    // wheel follows steering (flip the sign here if it feels backwards)
    steer += (clamp(-turn * 0.7, -0.5, 0.5) - steer) * (1 - Math.exp(-14 * dt));
    wheel.rotation.z = steer; placeSleeves();
    needle.rotation.z = 2.2 - speedK * 4.4;
    boostBar.scale.x = Math.max(0.03, boostK);
    boostBar.material.color.setHex(boostK > 0.1 ? 0xffb02e : 0x39e6ff);
    throttle.rotation.x = 0.15 + speedK * 0.75 + boostK * 0.25;
    const spin = dt * (0.4 + speedK * 3 + boostK * 3);
    cogA.rotation.y += spin; cogB.rotation.y -= spin * (10 / 7);
    sweep.rotation.z = -t * 2.2;

    // muzzle flashes
    for (const f of flashes) {
      f.visible = fireT > 0;
      if (f.visible) { const s = 0.6 + Math.random() * 0.5; f.scale.set(s, s, s); f.rotation.z = Math.random() * 6.28; }
    }

    // HUD at ~30 fps
    hudT += dt;
    if (hudT > 1 / 30) { hudT = 0; if (cam) drawHUD(speed, speedK, boostK, flashK, boat); drawAim(boostK); }

    // camera feel: lean + FOV kick (no shake), aspect-safe HUD
    if (cam) {
      const L = u.look;
      if (L.recenter && !L.active) { const k = 1 - Math.exp(-5 * dt); L.yaw -= L.yaw * k; L.pitch -= L.pitch * k; }
      cam.rotation.y = L.yaw; cam.rotation.x = L.pitch;
      cam.rotation.z += (clamp(turn * 0.05, -0.07, 0.07) - cam.rotation.z) * (1 - Math.exp(-10 * dt));
      const fov = baseFov + speedK * 4 + boostK * 9;
      if (Math.abs(cam.fov - fov) > 0.05) { cam.fov += (fov - cam.fov) * (1 - Math.exp(-8 * dt)); cam.updateProjectionMatrix(); }
      fitHUD(cam); hud.rotation.z = -cam.rotation.z;                  // HUD stays level while the camera leans
    }
  };

  return g;
}
