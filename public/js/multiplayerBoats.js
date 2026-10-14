// public/js/multiplayerBoats.js
// Aggregator and registry for the 5 multiplayer boat assets:
// 1. Tidecutter (Azure / Fast Interceptor)
// 2. Reefbreaker (Sunfire / Heavy Gunboat)
// 3. Manta (Violet / Delta-wing Ray)
// 4. Twinhull Raider (Jade / Catamaran)
// 5. Blaze Runner (Rose / Hot-rod Speedster)

import * as THREE from 'three';
import { buildTidecutterBoat } from './multiplayer_assets/boat1_tidecutter.js';
import { buildReefbreakerBoat } from './multiplayer_assets/boat2_reefbreaker.js';
import { buildMantaBoat } from './multiplayer_assets/boat3_manta.js';
import { buildTwinhullBoat } from './multiplayer_assets/boat4_twinhull.js';
import { buildBlazeRunnerBoat } from './multiplayer_assets/boat5_blazerunner.js';
import { buildHeroBoatFPV } from './heroBoatFPV.js?v=smooth_fpp_20261015';

export const MULTIPLAYER_BOATS = [
  {
    id: 'reefbreaker',
    index: 0,
    teamName: 'Sunfire',
    name: 'Reefbreaker',
    icon: '🔥',
    badge: 'HEAVY',
    desc: 'Heavy armored gunboat • Twin side cannons • Ram prow & bridge',
    builder: buildReefbreakerBoat,
  },
  {
    id: 'tidecutter',
    index: 1,
    teamName: 'Azure',
    name: 'Tidecutter',
    icon: '💧',
    badge: 'INTERCEPT',
    desc: 'Fast interceptor • Side gun pods • Dual orb antennas',
    builder: buildTidecutterBoat,
  },
  {
    id: 'twinhull',
    index: 2,
    teamName: 'Jade',
    name: 'Twinhull Raider',
    icon: '🌿',
    badge: 'CATAMARAN',
    desc: 'Catamaran hull • Swivel deck turret • Rear spoiler wing',
    builder: buildTwinhullBoat,
  },
  {
    id: 'manta',
    index: 3,
    teamName: 'Violet',
    name: 'Manta Ray',
    icon: '⚡',
    badge: 'DELTA',
    desc: 'Delta-wing stealth ray • Wing-tip blasters • Glowing tail spine',
    builder: buildMantaBoat,
  },
  {
    id: 'blazerunner',
    index: 4,
    teamName: 'Rose',
    name: 'Blaze Runner',
    icon: '🌸',
    badge: 'HOT-ROD',
    desc: 'Hot-rod speedboat • Quad exhaust pipes • Front rocket pods',
    builder: buildBlazeRunnerBoat,
  },
];

export function getBoatDef(keyOrIndex) {
  if (typeof keyOrIndex === 'number') {
    const idx = Math.abs(Math.floor(keyOrIndex)) % MULTIPLAYER_BOATS.length;
    return MULTIPLAYER_BOATS[idx];
  }
  if (typeof keyOrIndex === 'string') {
    const q = keyOrIndex.toLowerCase();
    const found = MULTIPLAYER_BOATS.find(
      (b) => b.id === q || b.name.toLowerCase() === q || b.teamName.toLowerCase() === q
    );
    if (found) return found;
  }
  return MULTIPLAYER_BOATS[0];
}

export function buildMultiplayerBoat(colorIndexOrKey, style = {}, withFPV = false) {
  const def = getBoatDef(colorIndexOrKey);
  const boat = def.builder(style);
  if (withFPV) {
    const fpv = buildHeroBoatFPV(boat, style);
    boat.userData.fpv = fpv;
  }
  boat.userData.boatDef = def;
  return boat;
}
