// The foes of the Hollow and the wave director that sends them. Each kind is a
// small bundle of stats plus a movement habit: glooms drift straight in, mites
// dart, pods creep and split, husks lumber under armour, wraiths strafe and
// lunge, and shades — the late-night crescents — slither in on a sine path
// that makes leading them a small puzzle of its own. The director spends each
// wave's budget over time from the field edges.

import { FIELD, PALETTE } from './config.js';

export const FOE_TYPES = {
  gloom: {
    radius: 15, hp: 1, speed: 56, score: 50, cost: 1, color: PALETTE.gloom,
    unlockWave: 1,
  },
  mite: {
    radius: 8, hp: 1, speed: 122, score: 30, cost: 1, color: PALETTE.mite,
    unlockWave: 1,
  },
  pod: {
    radius: 18, hp: 3, speed: 23, score: 100, cost: 2, color: PALETTE.pod,
    unlockWave: 2, splitsInto: 'mite', splits: 3,
  },
  husk: {
    radius: 26, hp: 6, speed: 31, score: 150, cost: 4, color: PALETTE.husk,
    unlockWave: 3, splitsInto: 'mite', splits: 2,
  },
  wraith: {
    radius: 13, hp: 2, speed: 97, score: 120, cost: 3, color: PALETTE.wraith,
    unlockWave: 4,
  },
  shade: {
    radius: 14, hp: 2, speed: 74, score: 110, cost: 2, color: PALETTE.shade,
    unlockWave: 5,
  },
};

const KIND_NAMES = Object.keys(FOE_TYPES);

/** Points of foes a wave sends; grows every wave, without a cap. */
export function waveBudget(wave) {
  return 6 + wave * 4;
}

/** Seconds between spawns inside a wave; shrinks as waves grow. */
export function spawnInterval(wave) {
  return Math.max(0.34, 1.05 - wave * 0.07);
}

/** A fresh foe of `kind` at a point, with its per-foe clocks zeroed. */
export function makeFoe(kind, x, y, wave, rng) {
  const stats = FOE_TYPES[kind];
  return {
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    radius: stats.radius,
    hp: stats.hp,
    maxHp: stats.hp,
    speed: stats.speed * (1 + (wave - 1) * 0.045) * (0.9 + rng() * 0.2),
    score: stats.score,
    phase: rng() * Math.PI * 2,
    age: 0,
    flash: 0,
    dashClock: 1.4 + rng() * 1.6,
    dashing: 0,
    telegraph: 0,
  };
}

/** A spawn point just outside a random edge of the field. */
function edgePoint(rng) {
  const side = Math.floor(rng() * 4);
  const margin = 30;
  if (side === 0) return { x: rng() * FIELD.width, y: -margin };
  if (side === 1) return { x: FIELD.width + margin, y: rng() * FIELD.height };
  if (side === 2) return { x: rng() * FIELD.width, y: FIELD.height + margin };
  return { x: -margin, y: rng() * FIELD.height };
}

/** Pick a kind the wave has unlocked, weighted toward the cheap and common. */
function pickKind(wave, rng) {
  const open = KIND_NAMES.filter((name) => wave >= FOE_TYPES[name].unlockWave);
  const weights = open.map((name) => (name === 'gloom' || name === 'mite' ? 5 : name === 'pod' || name === 'shade' ? 3 : 2));
  let total = 0;
  for (const weight of weights) total += weight;
  let roll = rng() * total;
  for (let index = 0; index < open.length; index += 1) {
    roll -= weights[index];
    if (roll <= 0) return open[index];
  }
  return open[open.length - 1];
}

/**
 * Spend from the wave budget: when the spawn clock runs out and budget
 * remains, add one foe (mites sometimes arrive as a trio for one clock tick).
 * Mutates state.director and state.foes.
 */
export function directSpawns(state, dt) {
  const director = state.director;
  if (director.budget <= 0) return;
  director.clock -= dt;
  if (director.clock > 0) return;
  director.clock = spawnInterval(state.wave);
  const kind = pickKind(state.wave, state.rng);
  const cost = FOE_TYPES[kind].cost;
  if (cost > director.budget && director.budget < FOE_TYPES.gloom.cost) return;
  const point = edgePoint(state.rng);
  state.foes.push(makeFoe(kind, point.x, point.y, state.wave, state.rng));
  director.budget -= Math.min(cost, director.budget);
  if (kind === 'mite' && director.budget >= 2 && state.rng() < 0.55) {
    for (let extra = 0; extra < 2; extra += 1) {
      const near = edgePoint(state.rng);
      state.foes.push(makeFoe('mite', near.x, near.y, state.wave, state.rng));
    }
    director.budget -= 2;
  }
}

/** Steer one foe for a step: each kind hunts the Spark in its own way. */
export function steerFoe(state, foe, dt) {
  const spark = state.spark;
  const dx = spark.x - foe.x;
  const dy = spark.y - foe.y;
  const distance = Math.hypot(dx, dy) || 1;
  const ux = dx / distance;
  const uy = dy / distance;
  foe.age += dt;
  foe.flash = Math.max(0, foe.flash - dt * 6);

  if (foe.kind === 'gloom') {
    const wobble = Math.sin(foe.age * 3.1 + foe.phase) * 0.45;
    const wx = ux * Math.cos(wobble) - uy * Math.sin(wobble);
    const wy = ux * Math.sin(wobble) + uy * Math.cos(wobble);
    foe.vx = wx * foe.speed;
    foe.vy = wy * foe.speed;
  } else if (foe.kind === 'mite') {
    const jitter = Math.sin(foe.age * 11 + foe.phase) * 0.35;
    foe.vx = (ux + -uy * jitter) * foe.speed;
    foe.vy = (uy + ux * jitter) * foe.speed;
  } else if (foe.kind === 'pod' || foe.kind === 'husk') {
    foe.vx = ux * foe.speed;
    foe.vy = uy * foe.speed;
  } else if (foe.kind === 'shade') {
    // A slither: mostly toward the Spark, with a strong sideways sine laid
    // over it, so the crescent weaves as it closes and a bolt led straight
    // at it lands behind it.
    const weave = Math.sin(foe.age * 3.4 + foe.phase) * 0.85;
    foe.vx = (ux + -uy * weave) * foe.speed;
    foe.vy = (uy + ux * weave) * foe.speed;
  } else if (foe.kind === 'wraith') {
    foe.dashClock -= dt;
    if (foe.telegraph > 0) {
      foe.telegraph -= dt;
      foe.vx *= 0.86;
      foe.vy *= 0.86;
      if (foe.telegraph <= 0) foe.dashing = 0.34;
    } else if (foe.dashing > 0) {
      foe.dashing -= dt;
      foe.vx = ux * foe.speed * 3.6;
      foe.vy = uy * foe.speed * 3.6;
    } else {
      const strafe = Math.sin(foe.age * 2.2 + foe.phase) > 0 ? 1 : -1;
      foe.vx = (ux * 0.72 + -uy * strafe * 0.62) * foe.speed;
      foe.vy = (uy * 0.72 + ux * strafe * 0.62) * foe.speed;
      if (foe.dashClock <= 0 && distance < 330) {
        foe.telegraph = 0.42;
        foe.dashClock = 2.2 + state.rng() * 1.4;
      }
    }
  }
  foe.x += foe.vx * dt;
  foe.y += foe.vy * dt;
}
