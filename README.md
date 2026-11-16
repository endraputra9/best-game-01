# Sparkhollow

[![best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01)
[![rank](https://make.fun/badge/best-game-01/endraputra9/best-game-01/rank.svg)](https://make.fun/bounty/best-game-01)
[![reward](https://make.fun/badge/best-game-01/endraputra9/best-game-01/reward.svg)](https://make.fun/bounty/best-game-01)

**The last light in the Hollow.** Sparkhollow is an original arena survival
game for desktop browsers, written in dependency-free JavaScript on a single
canvas. You are the Spark — a small flame wisp alone in a dark hollow. The
dark sends its brood to snuff you out; burn through ten waves and hold until
dawn.

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

Five kinds of foe hunt you, in the order the waves unlock them: **glooms**
(wobbling drifters), **mites** (fast darts that swarm), **pods** (creeping
sacs that split into mites), **husks** (armoured rings that take six bolts
and split as they fall) and **wraiths** (strafers that flash before they
lunge). Kills chain into a combo that multiplies your score; taking a hit
breaks it. Clear wave 10 and dawn breaks — you win. Lose all three hearts
and the light goes out.

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
- `game/src/foes.js` — the five foe kinds and the wave director
- `game/src/render.js` — all drawing: field, foes, light, HUD, screens
- `game/src/particles.js` — sparks, rings and score popups
- `game/src/audio.js` — WebAudio sound effects
- `game/src/input.js` — keyboard and mouse state
- `game/src/config.js` — tuning and palette
- `game/src/shots.js` — the deterministic `?shot=` scenes behind the screenshots
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to the
  output directory and writes `dossier.json` with the vendored library
- `screenshots/` — real renders of the game (title, play, game over)

Licensed under the MIT License (see `LICENSE`).
