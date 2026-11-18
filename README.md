# Sparkhollow

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/endraputra9/best-game-01/rank.svg)](https://make.fun/bounty/best-game-01)
[![reward](https://make.fun/badge/best-game-01/endraputra9/best-game-01/reward.svg)](https://make.fun/bounty/best-game-01)

**The last light in the Hollow.** Sparkhollow is an original arena survival
game for desktop browsers, written in dependency-free JavaScript on a single
canvas. You are the Spark — a small flame wisp alone in a dark hollow. The
dark sends its brood to snuff you out; burn through ten waves and hold until
dawn.

One idea drives everything: **your light is your life**. The flame fades as
it burns, and the field's darkness is drawn back only as far as your light
reaches — so every second you are spending the very thing that keeps you
alive, and every kill and every gathered dew drop buys it back. The night
itself keeps score of your progress: the sky warms, wave by wave, from blue
night to ember-rose, and dawn breaks only if you are still burning at the
end of wave ten.

## How to play

- **Move** — WASD or the arrow keys
- **Aim** — mouse
- **Fire spark-bolts** — hold the left mouse button or Space
- **Nova burst** — Shift or right-click, once the charge bar is full: a radial
  blast that burns everything near you
- **Pause** — P or Esc · **Sound on/off** — M
- Start and restart from the title and end screens with a click or Enter;
  after dawn breaks, C keeps you burning into an endless night

## The rules of the Hollow

Your **light is your life**. It fades as you burn, and the darkness closes in
as it dims — foes are only plainly visible inside your light, though their
own glow gives them away. Felling foes feeds the flame a little; the **dew**
they drop feeds it a lot and charges your Nova. If your light dies, you
gutter: a heart burns away every couple of seconds until you find dew.
Contact with the brood costs a heart too. You have three.

Six kinds of foe hunt you, in the order the waves unlock them: **glooms**
(wobbling drifters with a swirl turning inside them), **mites** (fast darts
that swarm), **pods** (creeping sacs, ringed by their own spores, that split
into mites), **husks** (armoured rings that take six bolts, crack visibly as
they weaken, and split as they fall), **wraiths** (strafers that flash
before they lunge, leaving afterimages as they blur) and **shades**
(crescents that slither in on a sine path, so a bolt led straight at one
lands behind it). Kills chain into a combo that multiplies your score;
taking a hit breaks it. Clear wave 10 and dawn breaks — you win. Lose all
three hearts and the light goes out.

The Hollow is drawn in layers, all of it procedural: a starfield with
cross-flared hero stars, a pale moon, ruined towers on the far skyline, two
hill ridges and a pine treeline, and three fog drifts sliding on their own
clocks — with the dawn tint warming across all of it as the waves pass.
Deaths burst and throw streaking shrapnel, the nova looses twin rings and a
fan of sparks, and the win screen ends on an actual sunrise.

## Running it

The game is static files under `game/` with no build step. Serve that folder
with any static HTTP server and open `index.html` — or, from this
repository's root:

```
node serve.ts          # then open http://localhost:8080
```

Everything is procedural: the art is drawn in code and every sound is
synthesised with WebAudio, so the game loads no assets and makes no network
requests.

## Layout

- `game/index.html` — the page and its one module script
- `game/src/main.js` — boot, the screen state machine, the fixed-step loop
- `game/src/world.js` — the deterministic simulation of a run
- `game/src/player.js` — the Spark: movement, fire, Nova, harm
- `game/src/foes.js` — the six foe kinds and the wave director
- `game/src/render.js` — all drawing: the layered field, foes, light, HUD,
  screens, and the sky that warms toward dawn
- `game/src/particles.js` — sparks, streaks, rings and score popups
- `game/src/audio.js` — WebAudio sound effects
- `game/src/input.js` — keyboard and mouse state
- `game/src/config.js` — tuning, palette and the dawn hues
- `game/src/shots.js` — the deterministic `?shot=` scenes behind the screenshots
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to the
  output directory and writes `dossier.json` with the vendored library
- `screenshots/` — real renders of the game (title, mid-fight, the nova
  burst at full charge, dawn)

Licensed under the MIT License (see `LICENSE`).
