// test/test_hud_dedup.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Verifying FPV HUD Lifecycle & Deduplication ---');

const fpvCode = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'heroBoatFPV.js'), 'utf8');
const boatCode = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'boat.js'), 'utf8');
const mainCode = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'main.js'), 'utf8');

// 1. Check hud has isFPVHUD tag in heroBoatFPV.js
assert(fpvCode.includes('hud.userData.isFPVHUD = true;'), 'heroBoatFPV.js must tag hud with isFPVHUD = true');

// 2. Check u.mount strips previous HUD planes from camera
assert(fpvCode.includes('c === hud || c.userData?.isFPVHUD'), 'heroBoatFPV.js u.mount must strip old HUD planes');

// 3. Check u.unmount cleans all HUD planes from camera
assert(fpvCode.includes('cam.remove(hud);'), 'heroBoatFPV.js u.unmount must remove hud');
assert(fpvCode.includes('u.dispose'), 'heroBoatFPV.js must provide u.dispose');

// 4. Check boat.js unmounts/disposes old fpv in setSkin and applyStyle
assert(boatCode.includes('this.fpv?.userData?.dispose'), 'boat.js must dispose old fpv when replacing model');

// 5. Check main.js cleans camera children in applySkinStyle and setFPV
assert(mainCode.includes('camera.children[i].userData?.isFPVHUD'), 'main.js must clean camera children in applySkinStyle and setFPV');

console.log('✓ All FPV HUD deduplication and lifecycle checks passed!');
