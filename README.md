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
- **Enemy boats fight each other, too.** It works like a battle royale: every boat is its own team and scores every target around it
(close, wounded, busy fighting someone else, or someone who just hurt it), then picks a fight. Distance matters most, so two boats that
end up next to each other fight each other even if you are right there. At most about two boats pile onto you at once (a soft cap), and
passing boats trade machine-gun fire even when neither has "chosen" the other.
- **Every boat has a personality** (aggression, nerve, stubbornness, how much it likes boosting, how long it holds a grudge) that is
re-rolled each time it spawns, and a repertoire of **tactics** it picks at random: *circle* (nose-in turn-fight), *rush*, *pass* (joust: drive
past firing, then swing round), *flank* (arc to your tail), *kite* (fall back zig-zagging, snap round and shoot), *disengage* (break off and
reposition), *ram* (boosted charge) and *counter* (see below). While attacking they weave when you line them up or shoot at them.
- **Hit one and it hits back.** A boat that gets shot usually does a quick jink out of your line of fire, then swings round and attacks you
(sometimes it trades blows, or breaks off and comes back from another angle). It does not simply run.
- **Running away is rare and varied.** Each boat has its own "start thinking about running" health (about 12-38%). When it gets there it rolls one of:
sail home and heal, dash for a far corner, run for a health potion, hide behind an island and peek out again, a *fighting retreat* (kiting while
shooting), or a **last stand** where it refuses to run and fights on. Runners sometimes turn round to take a shot at their chaser.
- **Boost is a decision, not a panic button.** Boats boost to charge, to flank, to ram, to dodge a missile, occasionally just for style, and only
sometimes when fleeing. Always a short burst from a small meter.
Sunk boats come back after 9 seconds near the action.
Tune it in `AI` (personality ranges, target scoring, firing arc), `SWARM`, `ENEMY_SPEED` and `DIFFICULTY` in `config.js`.

**Rewards.** Every shot that lands shows a hit marker. Sinking a boat heals you (+15 HP for a small boat, +25 for a big one),
instantly reloads your missile and adds 2 seconds of boost. Health still never regenerates on its own, so aggression is how you
stay alive (`KILL_REWARD` in `config.js`). Only boats **you** sink count toward your score.
- **The harbor is a safe zone.** Enemies won't enter it or target you while you're inside.

## The 8 enemy boats (5 small, 3 big)

Small: 3 skiffs and 2 raiders. Big: cruiser, gunboat and dreadnought (the cruiser now also has a light machine gun).
Boats are no longer parked on a ring around you. They roam towards the fighting, notice you from far away (`DIFFICULTY.detectMul`),
and spread out naturally because each one picks its own target. See the AI notes above.

**Damage.** Machine gun 4 per bullet, 14 per second (about 2-10 s to sink a boat). Missile 70: 1 / 2 / 3 / 3 / 4 direct hits sink a skiff / raider / gunboat / cruiser / dreadnought. Enemy guns do 4-5 per bullet and an enemy missile does 30, so four direct hits sink you.

**Standing still gets you hunted.** The longer you idle, the more boats go for you (the soft cap rises), they close in, aim better, hit a little harder (up to +15%) and stop taking breaks. Keep moving and it fades. Tune it with the `hunt*` values in `SWARM`.

## Health potions

Potions float on the sea (half submerged in a life ring, rocking with the waves, with a faint red beam so you can spot them). They come in
**sets of 1 to 3**, a little way from you (60-150 units). A new set only appears **40-60 seconds after the last potion on the sea is gone**
(taken, or drifted away unclaimed after 2 minutes). You, or any enemy that is hurt, can grab one, so they pull fights towards them.
Tune it in `POTION` in `config.js`.

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
