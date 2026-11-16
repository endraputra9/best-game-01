// The Sparkhollow world: one deterministic simulation of a run. It owns the
// Spark, the foes, the bolts, the pickups, the score and the wave clock, and
// advances them all in fixed steps under a control record — from the player's
// keys, or from the screenshot autopilot. Sounds are not played here; each
// step leaves events that main.js turns into audio.

import { COMBO, DAWN_WAVE, DEW, FIELD, NOVA, SPARK } from './config.js';
import { Effects } from './particles.js';
import { FOE_TYPES, directSpawns, makeFoe, steerFoe, waveBudget } from './foes.js';
import { gatherPickup, hurtSpark, makeSpark, stepSpark } from './player.js';

/** A small seeded random generator (mulberry32), so shots are repeatable. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEW_DROP_CHANCE = 0.26;
const HEART_DROP_CHANCE = 0.3;
const MAX_FOES = 90;

export class World {
  constructor() {
    this.reset(1);
  }

  /** Start a fresh run. The same seed always grows the same run. */
  reset(seed) {
    this.rng = mulberry32(seed);
    this.fx = new Effects(this.rng);
    this.spark = makeSpark();
    this.foes = [];
    this.bolts = [];
    this.pickups = [];
    this.events = [];
    this.score = 0;
    this.combo = 0;
    this.comboClock = 0;
    this.time = 0;
    this.over = false;
    this.won = false;
    this.endless = false;
    this.phase = 'fighting';
    this.phaseClock = 0;
    this.startWave(1);
    this.events.length = 0;
  }

  /** Begin wave `wave`: refill the director's budget and announce it. */
  startWave(wave) {
    this.wave = wave;
    this.director = { budget: waveBudget(wave), clock: 0.7 };
    this.phase = 'fighting';
    this.banner = 1.8;
    this.events.push({ type: 'wave', wave });
  }

  /** Add score for a base value, scaled by the live combo multiplier. */
  addScore(base, x, y) {
    const bonus = Math.min(this.combo * COMBO.step, COMBO.maxBonus);
    const points = Math.round(base * (1 + bonus));
    this.score += points;
    const big = points >= 150;
    this.fx.popup(x, y - 10, `+${points}`, big ? '#ffe9a8' : '#ffd97a', big);
    return points;
  }

  /** Add nova charge, announcing the moment it first reaches full. */
  addCharge(amount) {
    const spark = this.spark;
    spark.charge = Math.min(NOVA.cost, spark.charge + amount);
    if (spark.charge >= NOVA.cost && !spark.chargeWasFull) {
      spark.chargeWasFull = true;
      this.events.push({ type: 'chargeReady' });
    }
  }

  /** Wound a foe; death itself is settled by clearDeadFoes. */
  damageFoe(foe, damage) {
    if (foe.hp <= 0) return;
    foe.hp -= damage;
    foe.flash = 1;
    this.fx.burst(foe.x, foe.y, FOE_TYPES[foe.kind].color, 3, 120, 2.2, 0.3);
    this.events.push({ type: 'hit' });
  }

  /** Settle every foe at zero health: score, drops, splits and bursts. */
  clearDeadFoes() {
    const survivors = [];
    for (const foe of this.foes) {
      if (foe.hp > 0) {
        survivors.push(foe);
        continue;
      }
      const stats = FOE_TYPES[foe.kind];
      if (foe.noReward) continue;
      this.combo += 1;
      this.comboClock = COMBO.windowSeconds;
      this.spark.light = Math.min(100, this.spark.light + SPARK.lightPerKill);
      this.addCharge(NOVA.chargePerKill);
      this.addScore(foe.score, foe.x, foe.y);
      const big = foe.radius >= 18;
      this.fx.burst(foe.x, foe.y, stats.color, big ? 26 : 14, big ? 260 : 200, 3.4, 0.6);
      this.fx.kick(big ? 0.16 : 0.06);
      this.events.push({ type: 'die', big });
      if (stats.splitsInto !== undefined) {
        for (let index = 0; index < stats.splits; index += 1) {
          const child = makeFoe(stats.splitsInto, foe.x, foe.y, this.wave, this.rng);
          const angle = this.rng() * Math.PI * 2;
          child.x += Math.cos(angle) * foe.radius * 0.7;
          child.y += Math.sin(angle) * foe.radius * 0.7;
          survivors.push(child);
        }
      }
      this.dropPickup(foe);
    }
    this.foes = survivors;
  }

  /** A felled foe may leave dew, and a husk may leave a heart. */
  dropPickup(foe) {
    const roll = this.rng();
    if (foe.kind === 'husk') {
      this.spawnPickup('dew', foe.x, foe.y);
      if (roll < HEART_DROP_CHANCE) this.spawnPickup('heart', foe.x + 14, foe.y - 10);
    } else if (roll < DEW_DROP_CHANCE) {
      this.spawnPickup('dew', foe.x, foe.y);
    }
  }

  spawnPickup(kind, x, y) {
    this.pickups.push({
      kind,
      x: Math.min(FIELD.width - 14, Math.max(14, x)),
      y: Math.min(FIELD.height - 14, Math.max(14, y)),
      vx: (this.rng() * 2 - 1) * 30,
      vy: (this.rng() * 2 - 1) * 30,
      radius: 9,
      age: 0,
    });
  }

  /** End the run: dawn (won) or darkness (lost). */
  endRun(won) {
    if (this.over) return;
    this.over = true;
    this.won = won;
    this.events.push({ type: won ? 'win' : 'lose' });
    if (won) {
      this.fx.ring(this.spark.x, this.spark.y, '#ffe9a8', 420, 1.1, 6);
      this.fx.burst(this.spark.x, this.spark.y, '#ffd97a', 60, 340, 3.6, 1);
    }
  }

  /** After dawn, keep playing: waves continue past the winning one. */
  continueEndless() {
    this.over = false;
    this.won = false;
    this.endless = true;
    this.startWave(this.wave + 1);
  }

  /** Advance the whole run one fixed step under `control`. */
  step(dt, control) {
    this.events.length = 0;
    this.time += dt;
    this.banner = Math.max(0, (this.banner ?? 0) - dt);
    this.fx.step(dt);
    if (this.over) return;

    if (this.phase === 'intermission') {
      this.phaseClock -= dt;
      stepSpark(this, control, dt);
      this.stepBolts(dt);
      this.stepPickups(dt);
      if (this.phaseClock <= 0) this.startWave(this.wave + 1);
      return;
    }

    if (this.foes.length < MAX_FOES) directSpawns(this, dt);
    stepSpark(this, control, dt);
    this.stepFoes(dt);
    this.stepBolts(dt);
    this.stepPickups(dt);
    this.clearDeadFoes();

    this.comboClock -= dt;
    if (this.comboClock <= 0) this.combo = 0;

    const cleared = this.director.budget <= 0 && this.foes.length === 0;
    if (cleared && !this.over) {
      if (this.wave >= DAWN_WAVE && !this.endless) {
        this.endRun(true);
      } else {
        this.phase = 'intermission';
        this.phaseClock = 2.4;
        this.spark.light = Math.min(100, this.spark.light + 12);
        this.events.push({ type: 'clear', wave: this.wave });
      }
    }
  }

  /** Move foes, keep them from stacking, and test contact with the Spark. */
  stepFoes(dt) {
    const spark = this.spark;
    for (const foe of this.foes) steerFoe(this, foe, dt);
    for (let a = 0; a < this.foes.length; a += 1) {
      for (let b = a + 1; b < this.foes.length; b += 1) {
        const first = this.foes[a];
        const second = this.foes[b];
        const dx = second.x - first.x;
        const dy = second.y - first.y;
        const min = (first.radius + second.radius) * 0.82;
        const distSq = dx * dx + dy * dy;
        if (distSq > 0.01 && distSq < min * min) {
          const distance = Math.sqrt(distSq);
          const push = ((min - distance) / distance) * 0.5;
          first.x -= dx * push * 0.4;
          first.y -= dy * push * 0.4;
          second.x += dx * push * 0.4;
          second.y += dy * push * 0.4;
        }
      }
    }
    for (const foe of this.foes) {
      if (foe.hp <= 0) continue;
      const distance = Math.hypot(foe.x - spark.x, foe.y - spark.y);
      if (distance < foe.radius + spark.radius - 2) {
        if (hurtSpark(this)) {
          foe.hp = 0;
          foe.noReward = true;
          this.fx.burst(foe.x, foe.y, FOE_TYPES[foe.kind].color, 12, 180, 3, 0.5);
        }
      }
    }
  }

  /** Move bolts, age them out, and strike the first foe each one meets. */
  stepBolts(dt) {
    const bolts = [];
    for (const bolt of this.bolts) {
      bolt.x += bolt.vx * dt;
      bolt.y += bolt.vy * dt;
      bolt.life -= dt;
      if (bolt.life <= 0 || bolt.x < -20 || bolt.x > FIELD.width + 20 || bolt.y < -20 || bolt.y > FIELD.height + 20) continue;
      let spent = false;
      for (const foe of this.foes) {
        if (foe.hp <= 0) continue;
        const distance = Math.hypot(foe.x - bolt.x, foe.y - bolt.y);
        if (distance < foe.radius + bolt.radius) {
          this.damageFoe(foe, 1);
          spent = true;
          break;
        }
      }
      if (!spent) bolts.push(bolt);
    }
    this.bolts = bolts;
  }

  /** Age pickups, magnetise the near ones, and gather what the Spark touches. */
  stepPickups(dt) {
    const spark = this.spark;
    const kept = [];
    for (const pickup of this.pickups) {
      pickup.age += dt;
      if (pickup.age > DEW.lifetime) continue;
      const dx = spark.x - pickup.x;
      const dy = spark.y - pickup.y;
      const distance = Math.hypot(dx, dy) || 1;
      if (pickup.kind === 'dew' && distance < DEW.magnetRadius) {
        pickup.vx = (dx / distance) * DEW.magnetSpeed;
        pickup.vy = (dy / distance) * DEW.magnetSpeed;
      } else {
        pickup.vx *= 0.94;
        pickup.vy *= 0.94;
      }
      pickup.x += pickup.vx * dt;
      pickup.y += pickup.vy * dt;
      if (distance < spark.radius + pickup.radius + 5) {
        gatherPickup(this, pickup);
        continue;
      }
      kept.push(pickup);
    }
    this.pickups = kept;
  }
}
