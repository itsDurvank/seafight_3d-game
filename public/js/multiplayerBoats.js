// public/js/multiplayerBoats.js
// Aggregator and registry for the 15 multiplayer boat assets:
// 1. Reefbreaker (Sunfire / Heavy Gunboat)
// 2. Tidecutter (Azure / Fast Interceptor)
// 3. Twinhull Raider (Jade / Catamaran)
// 4. Manta (Violet / Delta-wing Ray)
// 5. Blaze Runner (Rose / Hot-rod Speedster)
// 6. Thunderpike (Volt / Tesla Drill Ram)
// 7. Emerald Drake (Dragon / War Drake)
// 8. Brass Leviathan (Ironclad / Steampunk Ironclad)
// 9. Nightshade (Shadow / Stealth Wedge)
// 10. Buzzsaw Barracuda (Predator / Ramming Predator)
// 11. Skyfoil Falcon (Falcon / Raptor Hydrofoil)
// 12. Krakenhulk (Abyss / Sea-Monster Gunboat)
// 13. Jolly Roger Rocketeer (Corsair / Rocket Galleon)
// 14. Aurora Gyro (Cosmos / Gyro Hover Skiff)
// 15. Crab Crusher (Crustacean / Armored Crab Gunboat)

import * as THREE from 'three';
import { buildHeroBoat } from './new_assets/heroBoat.js';
import { buildTidecutterBoat } from './multiplayer_assets/boat1_tidecutter.js';
import { buildReefbreakerBoat } from './multiplayer_assets/boat2_reefbreaker.js';
import { buildMantaBoat } from './multiplayer_assets/boat3_manta.js';
import { buildTwinhullBoat } from './multiplayer_assets/boat4_twinhull.js';
import { buildBlazeRunnerBoat } from './multiplayer_assets/boat5_blazerunner.js';
import { buildThunderpikeBoat } from './multiplayer_assets/boat6_thunderpike.js';
import { buildEmeraldDrakeBoat } from './multiplayer_assets/boat7_emeralddrake.js';
import { buildBrassLeviathanBoat } from './multiplayer_assets/boat8_brassleviathan.js';
import { buildNightshadeBoat } from './multiplayer_assets/boat9_nightshade.js';
import { buildBuzzsawBarracudaBoat } from './multiplayer_assets/boat10_buzzsawbarracuda.js';
import { buildSkyfoilFalconBoat } from './multiplayer_assets/boat11_skyfoilfalcon.js';
import { buildKrakenhulkBoat } from './multiplayer_assets/boat12_krakenhulk.js';
import { buildJollyRogerRocketeerBoat } from './multiplayer_assets/boat13_jollyrogerrocketeer.js';
import { buildAuroraGyroBoat } from './multiplayer_assets/boat14_auroragyro.js';
import { buildCrabCrusherBoat } from './multiplayer_assets/boat15_crabcrusher.js';
import { buildHeroBoatFPV } from './heroBoatFPV.js';

export const MULTIPLAYER_BOATS = [
  {
    id: 'sunfire',
    index: 0,
    teamName: 'Sunfire',
    name: 'Sunfire (Hero Boat)',
    icon: '🔥',
    badge: 'ORIGINAL',
    themeColor: '#ff7a59',
    desc: 'The iconic Sunfire hero boat • Chin cannons • Shoulder missile pods • Cream & coral hull',
    builder: buildHeroBoat,
    muzzleZ: 3.6,
    deckY: 0.65,
  },
  {
    id: 'reefbreaker',
    index: 1,
    teamName: 'Sunfire',
    name: 'Reefbreaker',
    icon: '🛡️',
    badge: 'HEAVY',
    themeColor: '#ff7a59',
    desc: 'Heavy armored gunboat • Twin side cannons • Ram prow & bridge',
    builder: buildReefbreakerBoat,
    muzzleZ: 3.6,
    deckY: 0.65,
  },
  {
    id: 'tidecutter',
    index: 1,
    teamName: 'Azure',
    name: 'Tidecutter',
    icon: '💧',
    badge: 'INTERCEPT',
    themeColor: '#19e6ff',
    desc: 'Fast interceptor • Side gun pods • Dual orb antennas',
    builder: buildTidecutterBoat,
    muzzleZ: 3.4,
    deckY: 0.65,
  },
  {
    id: 'twinhull',
    index: 2,
    teamName: 'Jade',
    name: 'Twinhull Raider',
    icon: '🌿',
    badge: 'CATAMARAN',
    themeColor: '#8bff5a',
    desc: 'Catamaran hull • Swivel deck turret • Rear spoiler wing',
    builder: buildTwinhullBoat,
    muzzleZ: 3.5,
    deckY: 0.65,
  },
  {
    id: 'manta',
    index: 3,
    teamName: 'Violet',
    name: 'Manta Ray',
    icon: '⚡',
    badge: 'DELTA',
    themeColor: '#b36bff',
    desc: 'Delta-wing stealth ray • Wing-tip blasters • Glowing tail spine',
    builder: buildMantaBoat,
    muzzleZ: 3.3,
    deckY: 0.65,
  },
  {
    id: 'blazerunner',
    index: 4,
    teamName: 'Rose',
    name: 'Blaze Runner',
    icon: '🌸',
    badge: 'HOT-ROD',
    themeColor: '#ffd23a',
    desc: 'Hot-rod speedboat • Quad exhaust pipes • Front rocket pods',
    builder: buildBlazeRunnerBoat,
    muzzleZ: 3.5,
    deckY: 0.65,
  },
  {
    id: 'thunderpike',
    index: 5,
    teamName: 'Volt',
    name: 'Thunderpike',
    icon: '⚡',
    badge: 'TESLA DRILL',
    themeColor: '#2f6bff',
    desc: 'Spiraling drill prow • Twin tesla coils with electric arcs • Swept wings',
    builder: buildThunderpikeBoat,
    muzzleZ: 3.2,
    deckY: 0.66,
  },
  {
    id: 'emeralddrake',
    index: 6,
    teamName: 'Dragon',
    name: 'Emerald Drake',
    icon: '🐲',
    badge: 'WAR DRAGON',
    themeColor: '#2fd08a',
    desc: 'Dragon war-boat • Horned head & opening jaw • Flapping bat wings',
    builder: buildEmeraldDrakeBoat,
    muzzleZ: 4.7,
    deckY: 0.68,
  },
  {
    id: 'brassleviathan',
    index: 7,
    teamName: 'Ironclad',
    name: 'Brass Leviathan',
    icon: '⚙️',
    badge: 'STEAMPUNK',
    themeColor: '#d9a441',
    desc: 'Steampunk ironclad • Spinning paddle wheels • Smokestacks & gun turret',
    builder: buildBrassLeviathanBoat,
    muzzleZ: 4.2,
    deckY: 0.8,
  },
  {
    id: 'nightshade',
    index: 8,
    teamName: 'Shadow',
    name: 'Nightshade',
    icon: '🌑',
    badge: 'STEALTH',
    themeColor: '#ff2d95',
    desc: 'Stealth wedge • Faceted black hull • Deploying weapon bay hatches',
    builder: buildNightshadeBoat,
    muzzleZ: 3.1,
    deckY: 0.6,
  },
  {
    id: 'buzzsaw',
    index: 9,
    teamName: 'Predator',
    name: 'Buzzsaw Barracuda',
    icon: '🦈',
    badge: 'PREDATOR',
    themeColor: '#ff3b3b',
    desc: 'Ramming predator • Twin spinning buzzsaw blades • Glowing predator eyes',
    builder: buildBuzzsawBarracudaBoat,
    muzzleZ: 3.2,
    deckY: 0.66,
  },
  {
    id: 'skyfoil',
    index: 10,
    teamName: 'Falcon',
    name: 'Skyfoil Falcon',
    icon: '🦅',
    badge: 'HYDROFOIL',
    themeColor: '#f2b632',
    desc: 'Raptor hydrofoil • Gold hooked beak • Folding wings & spinning props',
    builder: buildSkyfoilFalconBoat,
    muzzleZ: 3.4,
    deckY: 0.7,
  },
  {
    id: 'krakenhulk',
    index: 11,
    teamName: 'Abyss',
    name: 'Krakenhulk',
    icon: '🐙',
    badge: 'SEA MONSTER',
    themeColor: '#e0455c',
    desc: 'Sea-monster gunboat • Writhing tentacles with glowing suckers • Chomping beak',
    builder: buildKrakenhulkBoat,
    muzzleZ: 3.8,
    deckY: 0.7,
  },
  {
    id: 'jollyroger',
    index: 12,
    teamName: 'Corsair',
    name: 'Jolly Roger Rocketeer',
    icon: '🏴‍☠️',
    badge: 'PIRATE ROCKET',
    themeColor: '#c08a52',
    desc: 'Rocket pirate galleon • Billowing sails & skull flag • Twin rocket boosters',
    builder: buildJollyRogerRocketeerBoat,
    muzzleZ: 4.0,
    deckY: 0.75,
  },
  {
    id: 'auroragyro',
    index: 13,
    teamName: 'Cosmos',
    name: 'Aurora Gyro',
    icon: '🔮',
    badge: 'GYRO HOVER',
    themeColor: '#2fd0c0',
    desc: 'Sci-fi hover skiff • Tri-axial spinning gyro rings • Floating plasma cannons',
    builder: buildAuroraGyroBoat,
    muzzleZ: 3.2,
    deckY: 0.66,
  },
  {
    id: 'crabcrusher',
    index: 14,
    teamName: 'Crustacean',
    name: 'Crab Crusher',
    icon: '🦀',
    badge: 'ARMORED CRAB',
    themeColor: '#ff6a3d',
    desc: 'Armored crab gunboat • Snapping jointed claws • Paddling crab legs',
    builder: buildCrabCrusherBoat,
    muzzleZ: 3.4,
    deckY: 0.7,
  },
];

export function getBoatDef(keyOrIndex) {
  if (typeof keyOrIndex === 'number') {
    const idx = Math.abs(Math.floor(keyOrIndex)) % MULTIPLAYER_BOATS.length;
    return MULTIPLAYER_BOATS[idx];
  }
  if (typeof keyOrIndex === 'string') {
    const q = keyOrIndex.toLowerCase();
    const cleanQ = q.replace(/[^a-z0-9]/g, '');
    const found = MULTIPLAYER_BOATS.find(
      (b) =>
        b.id === q ||
        b.name.toLowerCase() === q ||
        b.teamName.toLowerCase() === q ||
        b.id.replace(/[^a-z0-9]/g, '') === cleanQ ||
        b.name.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanQ
    );
    if (found) return found;
  }
  return MULTIPLAYER_BOATS[0];
}

export function buildMultiplayerBoat(colorIndexOrKey, style = {}, withFPV = false) {
  const def = getBoatDef(colorIndexOrKey);
  // Custom color palette is applied if provided and not in original theme mode (colorIndex === -1)
  const isOriginal = (style.colorIndex === -1 || style.mpColorIndex === -1 || style.paint === 'original' || !style.hull);
  const boatStyle = (!isOriginal && style.hull)
    ? { ...style, scale: style.scale || 1 }
    : { scale: style.scale || 1 };

  const boat = def.builder(boatStyle);
  if (withFPV) {
    const fpv = buildHeroBoatFPV(boat, boatStyle);
    boat.userData.fpv = fpv;
  }
  boat.userData.boatDef = def;
  return boat;
}
