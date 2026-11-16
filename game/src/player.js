// The Spark: movement with a short glide, spark-bolt fire toward the aim, the
// nova burst, and everything that can hurt it — foe contact and guttering when
// its light dies. Pure simulation: main.js turns keys and mouse into the
// control record, and the screenshot autopilot writes the same record.

import { DEW, FIELD, NOVA, SPARK } from './config.js';

/** A fresh Spark at the field centre with full hearts and light. */
export function makeSpark() {
  return {
    x: FIELD.width / 2,
    y: FIELD.height / 2,
    vx: 0,
    vy: 0,
    radius: SPARK.radius,
    aimX: FIELD.width / 2,
    aimY: 0,
    fireClock: 0,
    hearts: SPARK.hearts,
    light: 82,
    charge: 0,
    chargeWasFull: false,
    invulnerable: 0,
    gutterClock: 0,
    trailClock: 0,
  };
}

/** Loose the nova if it is charged: damage every foe in reach, hard. */
export function looseNova(state) {
  const spark = state.spark;
  if (spark.charge < NOVA.cost || state.over) return false;
  spark.charge = 0;
  spark.chargeWasFull = false;
  state.fx.ring(spark.x, spark.y, '#ffe9a8', NOVA.radius, 0.5, 6);
  state.fx.ring(spark.x, spark.y, '#ff9d5c', NOVA.radius * 0.7, 0.4, 4);
  state.fx.kick(0.55);
  state.events.push({ type: 'nova' });
  for (const foe of state.foes) {
    const distance = Math.hypot(foe.x - spark.x, foe.y - spark.y);
    if (distance <= NOVA.radius + foe.radius) state.damageFoe(foe, NOVA.damage, true);
  }
  state.clearDeadFoes();
  return true;
}

/**
 * Advance the Spark one step under `control`
 * ({ moveX, moveY, aimX, aimY, firing, nova }).
 */
export function stepSpark(state, control, dt) {
  const spark = state.spark;
  spark.aimX = control.aimX;
  spark.aimY = control.aimY;
  spark.invulnerable = Math.max(0, spark.invulnerable - dt);

  // Movement: accelerate toward the keyed direction, glide to a stop.
  const length = Math.hypot(control.moveX, control.moveY);
  const tx = length > 0 ? (control.moveX / length) * SPARK.speed : 0;
  const ty = length > 0 ? (control.moveY / length) * SPARK.speed : 0;
  const blend = Math.min(1, dt / SPARK.glide);
  spark.vx += (tx - spark.vx) * blend;
  spark.vy += (ty - spark.vy) * blend;
  spark.x += spark.vx * dt;
  spark.y += spark.vy * dt;
  spark.x = Math.min(FIELD.width - spark.radius, Math.max(spark.radius, spark.x));
  spark.y = Math.min(FIELD.height - spark.radius, Math.max(spark.radius, spark.y));

  // Ember trail while moving.
  spark.trailClock -= dt;
  if ((Math.abs(spark.vx) + Math.abs(spark.vy)) > 40 && spark.trailClock <= 0) {
    spark.trailClock = 0.045;
    state.fx.spawn({
      x: spark.x + (state.rng() * 2 - 1) * 6,
      y: spark.y + (state.rng() * 2 - 1) * 6,
      vx: -spark.vx * 0.16,
      vy: -spark.vy * 0.16 + 12,
      life: 0.4,
      size: 2.6,
      color: '#ff9d5c',
    });
  }

  // Fire: hold to stream bolts at the aim point.
  spark.fireClock -= dt;
  if (control.firing && spark.fireClock <= 0) {
    spark.fireClock = SPARK.fireInterval;
    const dx = spark.aimX - spark.x;
    const dy = spark.aimY - spark.y;
    const distance = Math.hypot(dx, dy) || 1;
    const spread = (state.rng() * 2 - 1) * 0.028;
    const cos = Math.cos(spread);
    const sin = Math.sin(spread);
    const ux = dx / distance;
    const uy = dy / distance;
    state.bolts.push({
      x: spark.x + ux * (spark.radius + 4),
      y: spark.y + uy * (spark.radius + 4),
      vx: (ux * cos - uy * sin) * SPARK.boltSpeed,
      vy: (ux * sin + uy * cos) * SPARK.boltSpeed,
      radius: SPARK.boltRadius,
      life: 0.85,
    });
    state.fx.spawn({
      x: spark.x + ux * (spark.radius + 7),
      y: spark.y + uy * (spark.radius + 7),
      life: 0.09,
      size: 6,
      color: '#ffe9a8',
    });
    state.events.push({ type: 'shoot' });
  }

  if (control.nova) looseNova(state);

  // Light: burning drains it; a dead light gutters and costs hearts.
  const decay = SPARK.lightDecay + state.wave * SPARK.lightDecayPerWave;
  spark.light = Math.max(0, spark.light - decay * dt);
  if (spark.light <= SPARK.gutterLight && !state.over) {
    spark.gutterClock += dt;
    if (state.rng() < dt * 9) {
      state.fx.spawn({
        x: spark.x + (state.rng() * 2 - 1) * 9,
        y: spark.y - 6,
        vy: -26,
        life: 0.5,
        size: 2.2,
        color: '#8d8577',
      });
    }
    if (spark.gutterClock >= SPARK.gutterSeconds) {
      spark.gutterClock = 0;
      hurtSpark(state, true);
    }
  } else {
    spark.gutterClock = Math.max(0, spark.gutterClock - dt * 2);
  }
}

/** Lose a heart to a hit, with mercy invulnerability; ends the run at zero. */
export function hurtSpark(state, byGutter = false) {
  const spark = state.spark;
  if (spark.invulnerable > 0 && !byGutter) return false;
  spark.hearts -= 1;
  spark.invulnerable = SPARK.mercySeconds;
  state.combo = 0;
  state.comboClock = 0;
  state.fx.kick(byGutter ? 0.3 : 0.5);
  state.fx.burst(spark.x, spark.y, '#ff5d5d', 22, 240, 3.6, 0.6);
  state.events.push({ type: 'hurt' });
  if (spark.hearts <= 0) state.endRun(false);
  return true;
}

/** Gather a dew drop or a heart the Spark has touched. */
export function gatherPickup(state, pickup) {
  const spark = state.spark;
  if (pickup.kind === 'heart') {
    spark.hearts = Math.min(SPARK.hearts, spark.hearts + 1);
    state.addScore(25, pickup.x, pickup.y);
    state.events.push({ type: 'heart' });
    state.fx.burst(pickup.x, pickup.y, '#ff6b81', 14, 150, 3, 0.5);
    return;
  }
  spark.light = Math.min(100, spark.light + DEW.light);
  state.addCharge(DEW.charge);
  state.addScore(10, pickup.x, pickup.y);
  state.events.push({ type: 'pickup' });
  state.fx.burst(pickup.x, pickup.y, '#7ae7ff', 10, 130, 2.6, 0.45);
}
