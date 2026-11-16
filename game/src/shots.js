// Screenshot scenes behind ?shot=start|play|end. Each scene steps the real
// simulation forward from a fresh run at a fixed step, steered by a pilot: a
// careful one for the play scene (it aims, kites and gathers dew, as a decent
// player does), a doomed one for the end scene (it flies at the brood and
// never fires), and a drifting one behind the title. Same seed, same frame.

import { FIELD, NOVA, STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 4;
/** The play scene searches from here to the cap for a rich, busy frame. */
const PLAY_SEARCH_FROM = 18;
const PLAY_SEARCH_TO = 80;
/** The end scene's pilot plays properly this long, then flies at the brood. */
const END_FIGHT_SECONDS = 15;
const END_LIMIT_SECONDS = 300;

/** The nearest living foe to a point, and its distance; null when none. */
function nearestFoe(state, x, y) {
  let best = null;
  let bestDistance = Infinity;
  for (const foe of state.foes) {
    const distance = Math.hypot(foe.x - x, foe.y - y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = foe;
    }
  }
  return best === null ? null : { foe: best, distance: bestDistance };
}

/** A control record that orbits the field centre slowly and never fires. */
function ambientControl(state) {
  const angle = state.time * 0.35;
  const targetX = FIELD.width / 2 + Math.cos(angle) * 150;
  const targetY = FIELD.height / 2 + Math.sin(angle) * 95;
  return {
    moveX: targetX - state.spark.x,
    moveY: targetY - state.spark.y,
    aimX: state.spark.x + Math.cos(angle + 1.2) * 120,
    aimY: state.spark.y + Math.sin(angle + 1.2) * 120,
    firing: false,
    nova: false,
  };
}

/** A control record that plays to live: kite the brood, hunt dew, fire. */
function combatControl(state) {
  const spark = state.spark;
  let moveX = (FIELD.width / 2 - spark.x) * 0.004;
  let moveY = (FIELD.height / 2 - spark.y) * 0.004;
  for (const foe of state.foes) {
    const dx = spark.x - foe.x;
    const dy = spark.y - foe.y;
    const distance = Math.hypot(dx, dy) || 1;
    if (distance < 150) {
      const weight = (150 - distance) / 150;
      moveX += (dx / distance) * weight * 2.4;
      moveY += (dy / distance) * weight * 2.4;
    }
  }
  if (spark.light < 62) {
    let dew = null;
    let dewDistance = Infinity;
    for (const pickup of state.pickups) {
      if (pickup.kind !== 'dew') continue;
      const distance = Math.hypot(pickup.x - spark.x, pickup.y - spark.y);
      if (distance < dewDistance) {
        dewDistance = distance;
        dew = pickup;
      }
    }
    if (dew !== null && dewDistance < 320) {
      moveX += (dew.x - spark.x) / (dewDistance || 1);
      moveY += (dew.y - spark.y) / (dewDistance || 1);
    }
  }
  const target = nearestFoe(state, spark.x, spark.y);
  let aimX = spark.x + 60;
  let aimY = spark.y;
  let firing = false;
  if (target !== null) {
    const lead = target.distance / 580;
    aimX = target.foe.x + target.foe.vx * lead;
    aimY = target.foe.y + target.foe.vy * lead;
    firing = target.distance < 560;
  }
  let crowded = 0;
  for (const foe of state.foes) {
    if (Math.hypot(foe.x - spark.x, foe.y - spark.y) < NOVA.radius) crowded += 1;
  }
  return {
    moveX,
    moveY,
    aimX,
    aimY,
    firing,
    nova: spark.charge >= NOVA.cost && crowded >= 3,
  };
}

/** A control record that seeks the brood out and never fires a bolt. */
function doomedControl(state) {
  const spark = state.spark;
  const target = nearestFoe(state, spark.x, spark.y);
  if (target === null) return ambientControl(state);
  return {
    moveX: target.foe.x - spark.x,
    moveY: target.foe.y - spark.y,
    aimX: target.foe.x,
    aimY: target.foe.y,
    firing: false,
    nova: false,
  };
}

/**
 * Set `world` to the named scene (start, play or end; any other name is
 * start) and return the screen to draw over it and the score to show as best.
 */
export function stageShot(name, world) {
  if (name === 'play') {
    // Play properly, then hold on the first frame where the fight is up
    // close: a crowd on the field, a stream of bolts in the air, and at
    // least one foe well inside the Spark's light, plainly visible.
    const from = Math.round(PLAY_SEARCH_FROM / STEP);
    const to = Math.round(PLAY_SEARCH_TO / STEP);
    for (let index = 0; index < to && !world.over; index += 1) {
      world.step(STEP, combatControl(world));
      if (index < from) continue;
      let upClose = 0;
      for (const foe of world.foes) {
        if (Math.hypot(foe.x - world.spark.x, foe.y - world.spark.y) < 205) upClose += 1;
      }
      if (world.foes.length >= 6 && world.bolts.length >= 3 && upClose >= 1) break;
    }
    return { screen: world.over ? SCREEN_OVER : SCREEN_PLAY, best: world.score };
  }
  if (name === 'end') {
    // A real run first, so the end screen carries a real score; then the
    // pilot stops firing and flies at the brood until the dark takes it.
    const fight = Math.round(END_FIGHT_SECONDS / STEP);
    for (let index = 0; index < fight && !world.over; index += 1) {
      world.step(STEP, combatControl(world));
    }
    const limit = Math.round(END_LIMIT_SECONDS / STEP);
    for (let index = 0; index < limit && !world.over; index += 1) {
      world.step(STEP, doomedControl(world));
    }
    return { screen: SCREEN_OVER, best: world.score };
  }
  const steps = Math.round(START_SECONDS / STEP);
  for (let index = 0; index < steps; index += 1) {
    world.step(STEP, ambientControl(world));
  }
  return { screen: SCREEN_TITLE, best: 0 };
}
