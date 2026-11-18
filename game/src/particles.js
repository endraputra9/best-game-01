// Particles and floating texts: the juice layer. Sparks, bursts, ember trails,
// nova rings and score popups all live in one pooled list the world steps and
// the renderer draws. Nothing here knows the rules; it only knows motion,
// gravity-free drift, fade and growth.

const MAX_PARTICLES = 900;

export class Effects {
  constructor(rng) {
    this.rng = rng;
    this.particles = [];
    this.texts = [];
    this.shake = 0;
  }

  reset() {
    this.particles.length = 0;
    this.texts.length = 0;
    this.shake = 0;
  }

  /** Add one particle; fields not given take the defaults of a fading spark. */
  spawn(options) {
    if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
    this.particles.push({
      x: options.x,
      y: options.y,
      vx: options.vx ?? 0,
      vy: options.vy ?? 0,
      life: options.life ?? 0.5,
      age: 0,
      size: options.size ?? 3,
      grow: options.grow ?? 0,
      drag: options.drag ?? 2.2,
      color: options.color ?? '#ffd97a',
      ring: options.ring ?? false,
      streak: options.streak ?? false,
      width: options.width ?? 3,
    });
  }

  /**
   * A fan of streaking shrapnel: fewer, faster, longer-lived than a burst,
   * drawn as lines along their motion. For the deaths that should feel
   * violent — husks cracking open, the nova's edge.
   */
  shrapnel(x, y, color, count, speed) {
    for (let index = 0; index < count; index += 1) {
      const angle = this.rng() * Math.PI * 2;
      const pace = speed * (0.5 + this.rng() * 0.9);
      this.spawn({
        x,
        y,
        vx: Math.cos(angle) * pace,
        vy: Math.sin(angle) * pace,
        life: 0.4 + this.rng() * 0.35,
        size: 3,
        drag: 1.4,
        color,
        streak: true,
      });
    }
  }

  /** A radial burst of `count` sparks in `color` around a point. */
  burst(x, y, color, count, speed, size = 3.4, life = 0.55) {
    for (let index = 0; index < count; index += 1) {
      const angle = this.rng() * Math.PI * 2;
      const pace = speed * (0.25 + this.rng() * 0.95);
      this.spawn({
        x,
        y,
        vx: Math.cos(angle) * pace,
        vy: Math.sin(angle) * pace,
        life: life * (0.6 + this.rng() * 0.8),
        size: size * (0.6 + this.rng() * 0.9),
        color,
      });
    }
  }

  /** An expanding hollow ring, for the nova and for wave banners. */
  ring(x, y, color, maxRadius, seconds = 0.45, width = 4) {
    this.spawn({
      x,
      y,
      life: seconds,
      size: 6,
      grow: maxRadius / seconds,
      drag: 0,
      color,
      ring: true,
      width,
    });
  }

  /** A rising score popup; `big` renders it larger, for milestones. */
  popup(x, y, text, color = '#ffd97a', big = false) {
    this.texts.push({ x, y, text, color, big, age: 0, life: 0.9 });
  }

  /** Add screen shake; the renderer turns the total into an offset. */
  kick(amount) {
    this.shake = Math.min(1, this.shake + amount);
  }

  step(dt) {
    const particles = this.particles;
    for (let index = particles.length - 1; index >= 0; index -= 1) {
      const p = particles[index];
      p.age += dt;
      if (p.age >= p.life) {
        particles.splice(index, 1);
        continue;
      }
      const damp = Math.max(0, 1 - p.drag * dt);
      p.vx *= damp;
      p.vy *= damp;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.ring) p.size += p.grow * dt;
    }
    const texts = this.texts;
    for (let index = texts.length - 1; index >= 0; index -= 1) {
      const t = texts[index];
      t.age += dt;
      t.y -= 34 * dt;
      if (t.age >= t.life) texts.splice(index, 1);
    }
    this.shake = Math.max(0, this.shake - dt * 2.4);
  }

  /** The current shake offset in pixels, from two rng draws. */
  shakeOffset() {
    const power = this.shake * this.shake * 15;
    if (power < 0.05) return { x: 0, y: 0 };
    return {
      x: (this.rng() * 2 - 1) * power,
      y: (this.rng() * 2 - 1) * power,
    };
  }
}
