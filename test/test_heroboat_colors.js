// test/test_heroboat_colors.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Verifying Hero Boat Colors ---');

const heroBoatCode = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'new_assets', 'heroBoat.js'), 'utf8');
const boatCode = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'boat.js'), 'utf8');
const configCode = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'config.js'), 'utf8');
const roomsCode = fs.readFileSync(path.join(__dirname, '..', 'server', 'rooms.js'), 'utf8');

// 1. Check loftHull handles two-tone separation: deckMesh (cream/beige) and sidesMesh (chine)
assert(heroBoatCode.includes('function loftHull(stations, deckColor, chineColor)'), 'heroBoat.js missing loftHull function');
assert(heroBoatCode.includes('tri(posDeck, a[0], a[1], b[1])'), 'loftHull missing posDeck');
assert(heroBoatCode.includes('const deckMesh = new THREE.Mesh(geoDeck, std(deckColor'), 'loftHull missing deckMesh');
assert(heroBoatCode.includes('const sidesMesh = new THREE.Mesh(geoSides, std(chineColor'), 'loftHull missing sidesMesh');

// 2. Check loft guard prevents rub rail from covering the deck
assert(heroBoatCode.includes('if (band && (k === 0 || k === 2)) continue;'), 'heroBoat.js missing band guard in loft');

// 3. Check wings are colored C.hull (cream/beige) to match deck
assert(heroBoatCode.includes('const wing = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.07, 1.5), std(C.hull));'), 'heroBoat wings must be std(C.hull)');

// 4. Check cabin is std(C.cabin) with coral orange fallback
assert(heroBoatCode.includes('add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 2.1), std(C.cabin)), 0, 0.95, -0.7);'), 'heroBoat cabin must be std(C.cabin)');
assert(heroBoatCode.includes('cabin: style.cabin ?? (style.accent ?? 0xff7a59)'), 'heroBoat C.cabin must default to coral orange');

// 5. Check PLAYER_STYLE in boat.js has deck as cream 0xfff4e0 and cabin as orange 0xff7a59
assert(/hull:\s*0xfff4e0/.test(boatCode), 'PLAYER_STYLE hull must be 0xfff4e0 (warm cream/beige)');
assert(/cabin:\s*0xff7a59/.test(boatCode), 'PLAYER_STYLE cabin must be 0xff7a59 (coral orange)');

// 6. Check Sunfire style in config.js and rooms.js has cabin as 0xff7a59 and hull as 0xfff4e0
assert(configCode.includes("name: 'Sunfire', hex: '#ff7a59', icon: '🔥', style: { hull: 0xfff4e0, chine: 0xdce5e8, accent: 0xff7a59, roof: 0xff8a3d, flag: 0xffe066, cabin: 0xff7a59"), 'config.js Sunfire style mismatch');
assert(roomsCode.includes("name: 'Sunfire', hex: '#ff7a59', icon: '🔥', style: { hull: 0xfff4e0, chine: 0xdce5e8, accent: 0xff7a59, roof: 0xff8a3d, flag: 0xffe066, cabin: 0xff7a59"), 'rooms.js Sunfire style mismatch');

console.log('✓ All hero boat color specifications are verified and correct!');
