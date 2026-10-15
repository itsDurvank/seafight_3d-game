// Registry for the 10 new boats (boat6 - boat15). Same contract as your existing boats:
//   const g = entry.build(style);  g.userData.update(dt, t, boat);  g.userData.hit();
//   g.userData.fpvHide  -> parts to hide in first person      g.userData.fpvFloor -> deck height for the FPV console
// muzzleZ = where the guns / mouth / lance end (the bullet spawn z for each boat). deckY = deck height.
import { buildThunderpikeBoat } from './boat6_thunderpike.js';
import { buildEmeraldDrakeBoat } from './boat7_emeralddrake.js';
import { buildBrassLeviathanBoat } from './boat8_brassleviathan.js';
import { buildNightshadeBoat } from './boat9_nightshade.js';
import { buildBuzzsawBarracudaBoat } from './boat10_buzzsawbarracuda.js';
import { buildSkyfoilFalconBoat } from './boat11_skyfoilfalcon.js';
import { buildKrakenhulkBoat } from './boat12_krakenhulk.js';
import { buildJollyRogerRocketeerBoat } from './boat13_jollyrogerrocketeer.js';
import { buildAuroraGyroBoat } from './boat14_auroragyro.js';
import { buildCrabCrusherBoat } from './boat15_crabcrusher.js';

export const NEW_BOATS = [
  { id: 'thunderpike',   name: 'Thunderpike',           build: buildThunderpikeBoat,        muzzleZ: 3.2, deckY: 0.66 },
  { id: 'emeralddrake',  name: 'Emerald Drake',         build: buildEmeraldDrakeBoat,       muzzleZ: 4.7, deckY: 0.68 },
  { id: 'brassleviathan',name: 'Brass Leviathan',       build: buildBrassLeviathanBoat,     muzzleZ: 4.2, deckY: 0.8 },
  { id: 'nightshade',    name: 'Nightshade',            build: buildNightshadeBoat,         muzzleZ: 3.1, deckY: 0.6 },
  { id: 'buzzsaw',       name: 'Buzzsaw Barracuda',     build: buildBuzzsawBarracudaBoat,   muzzleZ: 3.2, deckY: 0.66 },
  { id: 'skyfoil',       name: 'Skyfoil Falcon',        build: buildSkyfoilFalconBoat,      muzzleZ: 3.4, deckY: 0.7 },
  { id: 'krakenhulk',    name: 'Krakenhulk',            build: buildKrakenhulkBoat,         muzzleZ: 3.8, deckY: 0.7 },
  { id: 'jollyroger',    name: 'Jolly Roger Rocketeer', build: buildJollyRogerRocketeerBoat,muzzleZ: 4.0, deckY: 0.75 },
  { id: 'auroragyro',    name: 'Aurora Gyro',           build: buildAuroraGyroBoat,         muzzleZ: 3.2, deckY: 0.66 },
  { id: 'crabcrusher',   name: 'Crab Crusher',          build: buildCrabCrusherBoat,        muzzleZ: 3.4, deckY: 0.7 },
];
