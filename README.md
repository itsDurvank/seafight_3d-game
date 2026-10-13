# Boom Boats

A cozy-but-action-packed island game, built in 3D for the browser with Three.js.

**Current status: Stage (a)+ – battle sailing.** Sail a boat across a bright, painted-looking sea,
fight the boats from 5 themed islands, and watch your speed build the longer you sail.

## Requirements

- Node.js 18 or newer (https://nodejs.org)
- A modern browser with WebGL (Chrome, Edge, Firefox, Safari)
- Internet connection (Three.js and the font load from a CDN)

## Run it

```bash
cd island-resort
npm start
```

Then open http://localhost:3000

## Controls

| Key | Action |
| --- | --- |
| W / Up | Sail forward (hold it: top speed climbs from 70 to 105 km/h in about 12 seconds) |
| S / Down | Reverse |
| A, D / Left, Right | Steer |
| **1** / **2** | Select machine gun / missile |
| **Left mouse button** | Fire the selected weapon (hold it for the machine gun) |
| **Shift** | Toggle speed boost on/off (8 seconds of energy; it refills after 2 seconds of not boosting) |
| H | Sail home (free fast travel) |
| Space | Brake: slows you down and makes steering much easier while held |
| ? | Show or hide the controls panel (click the ? button, bottom left) |
| M | Sound on/off |

## How it plays

- **Speed builds up.** Holding W while at full speed raises your top speed every second.
  Letting go of W makes it fade, and crashing into things knocks it down. Ramming enemy boats at speed hurts them (and a bit of you too).
- **Health.** You have 100 HP and it does **not** regenerate: once it is gone you sink.
  You respawn at the harbor after 3 seconds with full health and brief protection.
- **Missiles** work like fighter-jet missiles. When you fire, they lock onto the boat nearest your nose (within about 43 degrees, up to 340 units; no boat in the cone = no lock and a straight shot).
  They chase it for about 2.4 seconds, then fly on in a straight line. Break the lock with a hard turn, a boost, or by ducking behind an island (missiles explode on islands). **Every enemy boat fires missiles too** (small boats rarely, big boats often): a double beep and a screen flash mean one has locked on to you. Splash damage on impact, 5 second cooldown.
- **Boost.** Press Shift to surge ahead (about 103 km/h at the start, up to about 148 flat out). The speed ramps up smoothly over a second or two instead of jumping. Boost lasts a few seconds, then needs time to cool down.
  Ramming an enemy while boosting costs you 10% of your max health and costs them 30% of theirs.
- **Explosions.** Every boat that is destroyed (yours or theirs) blows up in a fireball with a shockwave, sparks, flying wreckage and smoke.
- **Enemy boats fight each other, too.** Each one is on its own team. They sail out of their harbors to the middle of the sea,
  pick a target (you or another enemy), and decide how to fight:
  - *attack*: close in and circle the target, shooting when lined up. Against a stronger boat they turn cautious and keep their distance;
    against a weak one they go in for the finish.
  - *dodge*: they side-step incoming missiles, get out of the way of a boosting player, and weave when bullets are flying at them.
  - *escape*: when surrounded, cornered, or stuck on an island they break away; when badly hurt they run home, heal up and come back.
  Sunk boats come back after 25 seconds.
  You are the fastest boat on the water (70 -> 105 km/h, boost up to about 148), but the enemies are built to run you down. Their speed is **dynamic**, like a dogfight:
they intercept (aim where you will be, not where you are), match your speed and then beat it by up to about 35% when hunting from far away (small boats about 95, big boats 68),
ease off as they arrive so they don't overshoot, and slow into a turn fight while circling you. Fast boats turn wider, just like yours. They boost to catch up if you pull away,
but only for a few seconds, and a boost dodge needs boost in the tank. Big boats are slower, tougher anchors with 35% extra health.
Tune it in `ENEMY_SPEED`, `DIFFICULTY.boost` and `DIFFICULTY.turnMul` in `config.js`.

**The rhythm of a fight.** Boats attack in *pulses*: each presses you for 6-10 seconds, then backs off for 2-3 seconds to
reposition and stops shooting at you, so there are always breathing moments (they are desynchronised, so it never all goes quiet).
Idling removes the lulls. An enemy missile locking on to you sounds a double beep and flashes the screen so you can react.

**Rewards.** Every shot that lands shows a hit marker. Sinking a boat heals you (+15 HP for a small boat, +25 for a big one),
instantly reloads your missile and adds 2 seconds of boost. Health still never regenerates on its own, so aggression is how you
stay alive (`KILL_REWARD` in `config.js`). Only boats **you** sink count toward your score.
- **The harbor is a safe zone.** Enemies won't enter it or target you while you're inside.

## The 8 enemy boats (5 small, 3 big)

Small: 3 skiffs and 2 raiders. Big: cruiser, gunboat and dreadnought.
A small *director* keeps the sea lively without crowding you: at most 5 boats hold a spread-out ring around you
(you are the focus: up to 3 may target you at once, and they also hit each other), the other 3 cruise further out and rotate in
when someone is sunk or runs. Sunk boats respawn near the action, away from other boats. Badly hurt boats either sail home
or bolt for a far corner of the sea, so you get a chase. Tune it in `SWARM` in `config.js`.

**Everyone is in the fight.** All 8 boats hold a spread-out ring around you (50-125 units out, never clumped), notice you from far away (`DIFFICULTY.detectMul`), and a boat that falls behind its spot speeds up to catch up. Up to 4 go after you at once while the rest fight each other.

**Damage.** Machine gun 4 per bullet, 14 per second (about 2-10 s to sink a boat). Missile 70: 1 / 2 / 3 / 3 / 4 direct hits sink a skiff / raider / gunboat / cruiser / dreadnought. Enemy guns do 4-5 per bullet and an enemy missile does 30, so four direct hits sink you.

**Standing still gets you hunted.** The longer you idle, the more the swarm closes in: the ring tightens, more boats join, they aim better and hit a little harder (up to +15%). Keep moving and it fades. Tune it with the `hunt*` values in `SWARM`.

## The islands

| Island | Colours | Signature | Enemy boat |
| --- | --- | --- | --- |
| Mango Isle | gold sand, lime grass | mango trees | Mango Skiff: small, fast, machine gun bursts |
| Coral Bay | pink sand, pink trees | coral reefs | Coral Cruiser: big, slow, fires missiles |
| Violet Lagoon | lavender sand, purple trees | glowing crystals | Violet Raider: very fast, strafes you |
| Jade Cove | mint sand, emerald trees | jade pillars | Jade Gunboat: twin cannons |
| Sunset Atoll | orange sand, red trees | smoking volcano | Sunset Dreadnought: boss, guns and missiles |
| Sandstone Peak, Dune Crown, Sunstone Ridge | tan sand, sandstone cliffs | terraced mountains with palms | Sand Skiff, Dune Skiff, Sunstone Raider |
| Amber Mesa, Golden Bluff | tan sand, sandstone cliffs | terraced mountains with palms | none (scenery) |

Your own island (gold on the minimap, with a coral flag) is safe.

## Tuning

Everything you might want to change lives in `public/js/config.js`:
boat speeds, weapon damage, enemy stats, island positions and colour themes.
Look for `BOAT.boost*` (boost length, cool-down, ram damage %), `DIFFICULTY` (enemy health, speed, damage, respawn time,
when they retreat) and `WORLD.arena` / `WORLD.safeHarbor` (where the fighting happens, the safe zone).

## Project structure

```
island-resort/
  package.json
  server/index.js      static server (WebSocket game server arrives in stage d)
  public/
    index.html         page, HUD, import map
    js/
      main.js          scene setup, player actions and the game loop
      config.js        world layout, boat/weapon/enemy tuning, island themes
      sky.js           gradient sky and clouds
      waves.js         wave function and painted water
      world.js         islands, dock, butterflies, collisions
      mountain.js      terraced sandstone mountain asset + shoreline pebbles
      boat.js          boat models and player physics
      combat.js        bullets, missiles, smoke, explosions (incl. the big boat-blast)
      enemies.js       enemy boat AI (target choice, dodging, retreating)
      wake.js          wake trail effect
      minimap.js       minimap
      hud.js           health, speed, weapon slots, toasts
      audio.js         synthesized sound effects (Web Audio, no files)
      input.js         keyboard + mouse input
```

## Roadmap

- (a) Boat movement on water, now with combat
- (b) Private island and build mode  <- next
- (c) Saving and loading (SQLite)
- (d) Multiplayer, travel, island visiting (WebSocket). The five enemy boat types become other players' boats
- (e) Guests and economy
- (f) Social features, audio, day/night, polish
