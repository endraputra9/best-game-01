// Sparkhollow's renderer: everything the player sees, drawn on one canvas in
// logical field coordinates. Night gradient and starfield first, then the
// layered rim of the Hollow — ruined towers on the far skyline, two hill
// ridges, a treeline, drifting fog — then dew, foes, bolts and the Spark,
// then particles, then the darkness that the Spark's light pushes back,
// then the HUD and whichever screen is up.
//
// What the renderer is for, in one breath: the game is a duel between one
// small light and a whole dark field, so every layer serves that read. The
// sky warms almost imperceptibly as the waves pass (the night is the
// progress bar; by wave nine the horizon is ember-rose), each foe kind is a
// silhouette you can name at a glance in its own hue, and the Spark's flame
// is the warmest, brightest thing on the field at all times. Nothing here
// touches the simulation: it only reads the world and draws it.

import { DAWN, DAWN_WAVE, FIELD, PALETTE } from './config.js';
import { FOE_TYPES } from './foes.js';
import { mulberry32 } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

// A fixed starfield and a drift of far fireflies, seeded once at load.
const starRng = mulberry32(20261116);
const STARS = Array.from({ length: 120 }, () => ({
  x: starRng() * FIELD.width,
  y: starRng() * FIELD.height,
  size: 0.7 + starRng() * 1.5,
  pace: 0.6 + starRng() * 2.2,
  phase: starRng() * Math.PI * 2,
}));
const MOTES = Array.from({ length: 22 }, () => ({
  x: starRng() * FIELD.width,
  y: starRng() * FIELD.height,
  drift: 4 + starRng() * 9,
  phase: starRng() * Math.PI * 2,
}));
// Ground dust: faint seeded specks so the field floor reads as ground, not
// void, wherever the Spark's light falls on it.
const SPECKLES = Array.from({ length: 110 }, () => ({
  x: starRng() * FIELD.width,
  y: starRng() * FIELD.height,
  size: 0.8 + starRng() * 1.3,
  alpha: 0.04 + starRng() * 0.07,
}));
// A few bright stars get a cross flare, so the sky has heroes too.
const SPARKLES = Array.from({ length: 6 }, () => ({
  x: starRng() * FIELD.width,
  y: starRng() * FIELD.height * 0.7,
  arm: 5 + starRng() * 4,
  pace: 0.5 + starRng() * 1.1,
  phase: starRng() * Math.PI * 2,
}));
// Pine silhouettes along the near ridge: the Hollow has a treeline.
const PINES = Array.from({ length: 9 }, (_, index) => ({
  x: 30 + index * 112 + starRng() * 52,
  height: 17 + starRng() * 15,
  width: 9 + starRng() * 5,
}));
// Ruined towers on the far skyline, between the stars and the far ridge:
// broken walls and one leaning spire, the middle distance of the Hollow.
// They stand still (the world does not scroll) but the fog and the dawn
// tint move across them, which is what sells the depth.
const TOWERS = [
  { x: 96, width: 34, height: 74, broken: 0.35 },
  { x: 268, width: 24, height: 52, broken: 0.6 },
  { x: 512, width: 40, height: 92, broken: 0.22 },
  { x: 706, width: 26, height: 60, broken: 0.5 },
  { x: 872, width: 30, height: 68, broken: 0.4 },
];
// Fog bands: wide, low, translucent drifts that slide slowly across the
// field on two different clocks, so no two seconds of the night quite
// match. Drawn inside the background, under everything that fights.
const FOG_BANDS = [
  { y: 356, height: 54, pace: 0.021, alpha: 0.05, phase: 0.8 },
  { y: 452, height: 70, pace: -0.013, alpha: 0.065, phase: 3.4 },
  { y: 250, height: 40, pace: 0.008, alpha: 0.035, phase: 5.1 },
];
// Ember motes for the end screens: they rise on the win, drift down as ash
// on the loss, always from the same seeded scatter.
const END_MOTES = Array.from({ length: 26 }, () => ({
  x: starRng() * FIELD.width,
  y: starRng() * FIELD.height,
  speed: 9 + starRng() * 17,
  size: 1 + starRng() * 1.9,
  phase: starRng() * Math.PI * 2,
}));

/** The y of the far hill ridge at field x: two slow sines, no rng. */
function farRidgeY(x) {
  return 552 - 17 * Math.sin(x * 0.011 + 1.3) - 9 * Math.sin(x * 0.023 + 0.4);
}

/** The y of the near ridge at field x, the one the pines stand on. */
function nearRidgeY(x) {
  return 580 - 11 * Math.sin(x * 0.017 + 4.1) - 6 * Math.sin(x * 0.031 + 2.0);
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function text(ctx, value, x, y, font, color, align = 'left', alpha = 1, glow = 0) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (glow > 0) {
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
  }
  ctx.fillText(value, x, y);
  ctx.restore();
}

/** A flame silhouette: a teardrop with its tip at the top, swaying a little. */
function flamePath(ctx, x, y, width, height, sway) {
  ctx.beginPath();
  ctx.moveTo(x + sway, y - height);
  ctx.bezierCurveTo(
    x + width * 0.58, y - height * 0.6,
    x + width * 0.52, y - height * 0.08,
    x + width * 0.36, y + height * 0.2,
  );
  ctx.bezierCurveTo(
    x + width * 0.2, y + height * 0.4,
    x - width * 0.2, y + height * 0.4,
    x - width * 0.36, y + height * 0.2,
  );
  ctx.bezierCurveTo(
    x - width * 0.52, y - height * 0.08,
    x - width * 0.58, y - height * 0.6,
    x + sway, y - height,
  );
  ctx.closePath();
}

/**
 * One ruined tower: a wall with a bitten-off top and a single dark window.
 * `base` is the far ridge line it stands on.
 */
function drawTower(ctx, tower, base) {
  const top = base - tower.height;
  const bite = tower.height * tower.broken;
  ctx.beginPath();
  ctx.moveTo(tower.x, base);
  ctx.lineTo(tower.x, top + bite * 0.4);
  ctx.lineTo(tower.x + tower.width * 0.3, top + bite);
  ctx.lineTo(tower.x + tower.width * 0.55, top);
  ctx.lineTo(tower.x + tower.width * 0.8, top + bite * 0.7);
  ctx.lineTo(tower.x + tower.width, top + bite * 0.25);
  ctx.lineTo(tower.x + tower.width, base);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(150,160,230,0.16)';
  ctx.fillRect(tower.x + tower.width * 0.38, top + tower.height * 0.34, 4.5, 7);
  ctx.fillStyle = '#0d0a26';
}

/**
 * The night itself: gradient, moon, ground glow, stars, the tower skyline,
 * hills, fog and motes. `dawn` runs 0 → 1 across the ten waves and warms
 * the horizon: at dawn 0 the field is all blue night; by dawn 1 an
 * ember-rose band sits on the ridge line and the ground glow warms with
 * it, so the player's progress is written on the sky itself.
 */
function drawBackground(ctx, time, dawn) {
  const gradient = ctx.createLinearGradient(0, 0, 0, FIELD.height);
  gradient.addColorStop(0, PALETTE.nightTop);
  gradient.addColorStop(0.55, '#100c2e');
  gradient.addColorStop(1, PALETTE.nightBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  if (dawn > 0.01) {
    // Dawn's promise on the horizon: a low warm band behind the ridges,
    // strongest at the centre of the field, where the sun will rise.
    const horizon = ctx.createRadialGradient(
      FIELD.width / 2, FIELD.height + 60, 60,
      FIELD.width / 2, FIELD.height + 60, 560,
    );
    horizon.addColorStop(0, DAWN.tintFar);
    horizon.addColorStop(0.45, DAWN.tint);
    horizon.addColorStop(1, 'rgba(255,157,92,0)');
    ctx.save();
    ctx.globalAlpha = dawn * 0.34;
    ctx.fillStyle = horizon;
    ctx.fillRect(0, 120, FIELD.width, FIELD.height - 120);
    ctx.restore();
  }
  // A pale moon high to the right, mostly halo: dawn's promise, far off.
  const moonGlow = ctx.createRadialGradient(828, 84, 6, 828, 84, 195);
  moonGlow.addColorStop(0, 'rgba(207,220,255,0.20)');
  moonGlow.addColorStop(0.3, 'rgba(160,175,255,0.07)');
  moonGlow.addColorStop(1, 'rgba(160,175,255,0)');
  ctx.fillStyle = moonGlow;
  ctx.fillRect(633, -111, 390, 390);
  ctx.fillStyle = 'rgba(228,235,255,0.78)';
  ctx.beginPath();
  ctx.arc(828, 84, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(140,155,205,0.35)';
  ctx.beginPath();
  ctx.arc(822, 78, 3.6, 0, Math.PI * 2);
  ctx.arc(834, 90, 2.6, 0, Math.PI * 2);
  ctx.arc(830, 74, 2, 0, Math.PI * 2);
  ctx.fill();
  const glow = ctx.createRadialGradient(
    FIELD.width / 2, FIELD.height * 0.62, 40,
    FIELD.width / 2, FIELD.height * 0.62, 430,
  );
  glow.addColorStop(0, PALETTE.groundGlow);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  for (const star of STARS) {
    const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(time * star.pace + star.phase));
    ctx.globalAlpha = twinkle * 0.9;
    ctx.fillStyle = '#cfd6ff';
    ctx.fillRect(star.x, star.y, star.size, star.size);
  }
  ctx.globalAlpha = 1;
  for (const sparkle of SPARKLES) {
    const twinkle = 0.3 + 0.7 * Math.abs(Math.sin(time * sparkle.pace + sparkle.phase));
    ctx.save();
    ctx.globalAlpha = twinkle * 0.55;
    ctx.strokeStyle = '#e6ebff';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(sparkle.x - sparkle.arm, sparkle.y);
    ctx.lineTo(sparkle.x + sparkle.arm, sparkle.y);
    ctx.moveTo(sparkle.x, sparkle.y - sparkle.arm);
    ctx.lineTo(sparkle.x, sparkle.y + sparkle.arm);
    ctx.stroke();
    ctx.restore();
  }
  for (const speck of SPECKLES) {
    ctx.globalAlpha = speck.alpha;
    ctx.fillStyle = '#9aa5e8';
    ctx.fillRect(speck.x, speck.y, speck.size, speck.size);
  }
  ctx.globalAlpha = 1;
  // The ruined towers stand on the far ridge: draw them first, then let
  // the ridge fill swallow their feet so they sit IN the land.
  ctx.fillStyle = '#0d0a26';
  for (const tower of TOWERS) drawTower(ctx, tower, farRidgeY(tower.x + tower.width / 2) + 6);
  // The Hollow's rim: a far ridge, then a near one with its pines.
  ctx.fillStyle = '#0e0b28';
  ctx.beginPath();
  ctx.moveTo(0, FIELD.height);
  for (let x = 0; x <= FIELD.width; x += 48) ctx.lineTo(x, farRidgeY(x));
  ctx.lineTo(FIELD.width, FIELD.height);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#070518';
  ctx.beginPath();
  ctx.moveTo(0, FIELD.height);
  for (let x = 0; x <= FIELD.width; x += 48) ctx.lineTo(x, nearRidgeY(x));
  ctx.lineTo(FIELD.width, FIELD.height);
  ctx.closePath();
  ctx.fill();
  for (const pine of PINES) {
    const base = nearRidgeY(pine.x) + 3;
    ctx.beginPath();
    ctx.moveTo(pine.x, base - pine.height);
    ctx.lineTo(pine.x + pine.width / 2, base);
    ctx.lineTo(pine.x - pine.width / 2, base);
    ctx.closePath();
    ctx.fill();
  }
  // Fog: three wide drifts sliding on their own clocks, softest at their
  // edges. They cross the towers and the ridges but never the fight —
  // everything that can hurt the Spark is drawn over them.
  for (const band of FOG_BANDS) {
    const shift = Math.sin(time * band.pace * 6 + band.phase) * 130;
    const fog = ctx.createLinearGradient(0, band.y - band.height / 2, 0, band.y + band.height / 2);
    fog.addColorStop(0, `rgba(${DAWN.fog},0)`);
    fog.addColorStop(0.5, `rgba(${DAWN.fog},${band.alpha})`);
    fog.addColorStop(1, `rgba(${DAWN.fog},0)`);
    ctx.fillStyle = fog;
    ctx.fillRect(-140 + shift * 0.4, band.y - band.height / 2, FIELD.width + 280, band.height);
  }
  for (const mote of MOTES) {
    const x = mote.x + Math.sin(time * 0.24 + mote.phase) * mote.drift;
    const y = mote.y + Math.cos(time * 0.19 + mote.phase * 1.7) * mote.drift * 0.6;
    ctx.globalAlpha = 0.16 + 0.12 * Math.sin(time * 0.9 + mote.phase);
    ctx.fillStyle = PALETTE.ember;
    ctx.beginPath();
    ctx.arc(x, y, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawDew(ctx, pickup, time) {
  const bob = Math.sin(time * 3.4 + pickup.x * 0.05) * 2;
  const blink = pickup.age > 7 ? (Math.sin(time * 14) > 0 ? 1 : 0.25) : 1;
  ctx.save();
  ctx.globalAlpha = blink;
  if (pickup.kind === 'heart') {
    ctx.fillStyle = PALETTE.heart;
    const s = 8 + Math.sin(time * 5) * 0.8;
    ctx.beginPath();
    ctx.moveTo(pickup.x, pickup.y + bob + s * 0.85);
    ctx.bezierCurveTo(pickup.x - s * 1.25, pickup.y + bob - s * 0.1, pickup.x - s * 0.55, pickup.y + bob - s, pickup.x, pickup.y + bob - s * 0.25);
    ctx.bezierCurveTo(pickup.x + s * 0.55, pickup.y + bob - s, pickup.x + s * 1.25, pickup.y + bob - s * 0.1, pickup.x, pickup.y + bob + s * 0.85);
    ctx.fill();
  } else {
    const glow = ctx.createRadialGradient(pickup.x, pickup.y + bob, 1, pickup.x, pickup.y + bob, 15);
    glow.addColorStop(0, 'rgba(160,240,255,0.95)');
    glow.addColorStop(0.4, 'rgba(122,231,255,0.5)');
    glow.addColorStop(1, 'rgba(122,231,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(pickup.x, pickup.y + bob, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#eafcff';
    ctx.beginPath();
    ctx.arc(pickup.x, pickup.y + bob, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawFoe(ctx, foe, time) {
  const stats = FOE_TYPES[foe.kind];
  const color = stats.color;
  ctx.save();
  // A soft contact shadow grounds the foe on the field.
  ctx.fillStyle = 'rgba(2,1,10,0.35)';
  ctx.beginPath();
  ctx.ellipse(foe.x, foe.y + foe.radius * 0.92, foe.radius * 0.92, foe.radius * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  // A self-glow, so a foe reads as a shape in the dark before the Spark's
  // light reaches it: the player can see trouble coming.
  const halo = ctx.createRadialGradient(foe.x, foe.y, 2, foe.x, foe.y, foe.radius * 2.3);
  halo.addColorStop(0, color + '59');
  halo.addColorStop(1, color + '00');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(foe.x, foe.y, foe.radius * 2.3, 0, Math.PI * 2);
  ctx.fill();
  if (foe.kind === 'mite') {
    // A short motion streak behind the dart, so its speed reads at a glance.
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(foe.x - foe.vx * 0.1, foe.y - foe.vy * 0.1);
    ctx.lineTo(foe.x, foe.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (foe.kind === 'wraith') {
    // Afterimages: two pale ghosts strung out behind the wraith along its
    // velocity, so its lunge reads as a blur of motion, not a teleport.
    for (let ghost = 2; ghost >= 1; ghost -= 1) {
      const gx = foe.x - foe.vx * 0.055 * ghost;
      const gy = foe.y - foe.vy * 0.055 * ghost;
      ctx.globalAlpha = 0.13 * (3 - ghost);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(gx, gy, foe.radius * (1 - ghost * 0.18), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  if (foe.kind === 'shade') {
    // A ribbon of the crescent's own hue trailing its weave, so the sine
    // path it flies is drawn on the field behind it.
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (let stepIndex = 0; stepIndex <= 6; stepIndex += 1) {
      const back = stepIndex * 0.045;
      const px = foe.x - foe.vx * back + Math.sin(time * 7 - stepIndex * 0.9 + foe.phase) * 3;
      const py = foe.y - foe.vy * back + Math.cos(time * 6.3 - stepIndex * 0.8 + foe.phase) * 3;
      if (stepIndex === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.translate(foe.x, foe.y);
  if (foe.kind === 'gloom') {
    ctx.fillStyle = color;
    ctx.beginPath();
    const points = 11;
    for (let index = 0; index <= points; index += 1) {
      const angle = (index / points) * Math.PI * 2;
      const wobble = 1 + Math.sin(time * 5 + foe.phase + index * 1.7) * 0.09;
      const r = foe.radius * wobble;
      if (index === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
      else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(18,6,44,0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#2a1650';
    ctx.beginPath();
    ctx.arc(0, 0, foe.radius * 0.52, 0, Math.PI * 2);
    ctx.fill();
    // A slow swirl turning inside the gloom, like something dreaming.
    ctx.strokeStyle = 'rgba(233,220,255,0.5)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    const swirl = time * 1.8 + foe.phase;
    ctx.arc(0, 0, foe.radius * 0.34, swirl, swirl + Math.PI * 1.25);
    ctx.stroke();
    ctx.fillStyle = '#e9dcff';
    ctx.beginPath();
    ctx.arc(-4.5, -2, 2.1, 0, Math.PI * 2);
    ctx.arc(4.5, -2, 2.1, 0, Math.PI * 2);
    ctx.fill();
  } else if (foe.kind === 'mite') {
    const angle = Math.atan2(foe.vy, foe.vx);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(foe.radius + 3, 0);
    ctx.lineTo(-foe.radius, foe.radius * 0.78);
    ctx.lineTo(-foe.radius * 0.45, 0);
    ctx.lineTo(-foe.radius, -foe.radius * 0.78);
    ctx.closePath();
    ctx.fill();
  } else if (foe.kind === 'pod') {
    const pulse = 1 + Math.sin(time * 4.2 + foe.phase) * 0.07;
    ctx.fillStyle = color;
    for (let index = 0; index < 5; index += 1) {
      const angle = (index / 5) * Math.PI * 2 + foe.phase;
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * foe.radius * 0.62, Math.sin(angle) * foe.radius * 0.62, foe.radius * 0.52 * pulse, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#d9ffb0';
    ctx.beginPath();
    ctx.arc(0, 0, foe.radius * 0.34 * pulse, 0, Math.PI * 2);
    ctx.fill();
    // Spores in slow orbit: the pod is pregnant, and the drawing says so.
    ctx.fillStyle = 'rgba(217,255,176,0.75)';
    for (let index = 0; index < 3; index += 1) {
      const orbit = time * 1.6 + foe.phase + index * (Math.PI * 2 / 3);
      ctx.beginPath();
      ctx.arc(Math.cos(orbit) * foe.radius * 1.06, Math.sin(orbit) * foe.radius * 1.06, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (foe.kind === 'husk') {
    ctx.strokeStyle = color;
    ctx.lineWidth = 7;
    ctx.beginPath();
    for (let index = 0; index < 6; index += 1) {
      const angle = (index / 6) * Math.PI * 2 + foe.age * 0.35;
      const px = Math.cos(angle) * foe.radius;
      const py = Math.sin(angle) * foe.radius;
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = '#0f3d31';
    ctx.beginPath();
    ctx.arc(0, 0, foe.radius * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, foe.radius * 0.3 * (1 + Math.sin(time * 3 + foe.phase) * 0.12), 0, Math.PI * 2);
    ctx.fill();
    if (foe.hp < foe.maxHp) {
      // Cracks in the armour, one more for every two hits it has taken:
      // the husk's remaining health is readable from across the field.
      const cracks = Math.min(3, Math.ceil((foe.maxHp - foe.hp) / 2));
      ctx.strokeStyle = 'rgba(4,20,14,0.85)';
      ctx.lineWidth = 1.8;
      for (let index = 0; index < cracks; index += 1) {
        const angle = foe.phase + index * 2.2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * foe.radius * 0.3, Math.sin(angle) * foe.radius * 0.3);
        ctx.lineTo(Math.cos(angle + 0.35) * foe.radius * 0.66, Math.sin(angle + 0.35) * foe.radius * 0.66);
        ctx.lineTo(Math.cos(angle + 0.1) * foe.radius * 0.97, Math.sin(angle + 0.1) * foe.radius * 0.97);
        ctx.stroke();
      }
    }
  } else if (foe.kind === 'shade') {
    // A crescent: a bright disc with the night bitten out of it, tilted
    // along its weave so it seems to swim. Two star-bright eyes sit in the
    // bite — the shade watches the Spark as it comes.
    const tilt = Math.sin(time * 3.4 + foe.phase) * 0.5;
    ctx.rotate(tilt);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, foe.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#160a24';
    ctx.beginPath();
    ctx.arc(foe.radius * 0.52, -foe.radius * 0.22, foe.radius * 0.82, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe9f8';
    ctx.beginPath();
    ctx.arc(-foe.radius * 0.34, -foe.radius * 0.1, 1.9, 0, Math.PI * 2);
    ctx.arc(-foe.radius * 0.05, foe.radius * 0.28, 1.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (foe.kind === 'wraith') {
    const angle = Math.atan2(foe.vy, foe.vx);
    ctx.rotate(angle);
    const flashing = foe.telegraph > 0 && Math.sin(time * 26) > 0;
    ctx.fillStyle = flashing ? '#ffffff' : color;
    ctx.beginPath();
    ctx.moveTo(foe.radius + 5, 0);
    ctx.lineTo(0, foe.radius * 0.72);
    ctx.lineTo(-foe.radius - 3, 0);
    ctx.lineTo(0, -foe.radius * 0.72);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#12303f';
    ctx.beginPath();
    ctx.arc(2, 0, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  if (foe.flash > 0) {
    ctx.globalAlpha = Math.min(0.85, foe.flash);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, foe.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  if (foe.maxHp > 1 && foe.hp < foe.maxHp) {
    const width = foe.radius * 1.7;
    ctx.fillStyle = 'rgba(6,4,18,0.7)';
    ctx.fillRect(foe.x - width / 2, foe.y - foe.radius - 13, width, 4.5);
    ctx.fillStyle = stats.color;
    ctx.fillRect(foe.x - width / 2, foe.y - foe.radius - 13, width * (foe.hp / foe.maxHp), 4.5);
  }
}

function drawSpark(ctx, spark, time) {
  const flicker = 1 + Math.sin(time * 11) * 0.05 + Math.sin(time * 23.7) * 0.03;
  const glowRadius = (44 + spark.light * 0.55) * flicker;
  const blink = spark.invulnerable > 0 && Math.sin(time * 24) > 0.2;
  ctx.save();
  if (blink) ctx.globalAlpha = 0.35;
  const glow = ctx.createRadialGradient(spark.x, spark.y, 2, spark.x, spark.y, glowRadius);
  glow.addColorStop(0, 'rgba(255,214,120,0.55)');
  glow.addColorStop(0.45, 'rgba(255,157,92,0.2)');
  glow.addColorStop(1, 'rgba(255,157,92,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(spark.x, spark.y, glowRadius, 0, Math.PI * 2);
  ctx.fill();
  // A hairline halo at the edge of the glow, breathing with the flicker:
  // it gives the light a rim, so the flame reads as a lantern in the dark
  // rather than a smudge of light.
  ctx.globalAlpha = blink ? 0.1 : 0.16;
  ctx.strokeStyle = '#ffd97a';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(spark.x, spark.y, glowRadius * 0.82, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = blink ? 0.35 : 1;
  const angle = Math.atan2(spark.aimY - spark.y, spark.aimX - spark.x);
  ctx.strokeStyle = PALETTE.ember;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(spark.x + Math.cos(angle) * (spark.radius + 3), spark.y + Math.sin(angle) * (spark.radius + 3));
  ctx.lineTo(spark.x + Math.cos(angle) * (spark.radius + 10), spark.y + Math.sin(angle) * (spark.radius + 10));
  ctx.stroke();
  // The Spark itself is a small living flame, not a ball: an outer tongue
  // of ember orange around a pale core, swaying as it burns.
  const flameHeight = (spark.radius * 2 + 9) * flicker;
  const flameWidth = spark.radius * 1.5;
  const sway = Math.sin(time * 13) * 1.6;
  const flameY = spark.y - flameHeight * 0.05;
  const outer = ctx.createLinearGradient(0, flameY - flameHeight, 0, flameY + flameHeight * 0.4);
  outer.addColorStop(0, '#ff8a3c');
  outer.addColorStop(1, PALETTE.ember);
  ctx.fillStyle = outer;
  flamePath(ctx, spark.x, flameY, flameWidth, flameHeight, sway);
  ctx.fill();
  const inner = ctx.createLinearGradient(0, flameY - flameHeight * 0.5, 0, flameY + flameHeight * 0.34);
  inner.addColorStop(0, PALETTE.emberCore);
  inner.addColorStop(1, '#ffd97a');
  ctx.fillStyle = inner;
  flamePath(ctx, spark.x, flameY + flameHeight * 0.14, flameWidth * 0.55, flameHeight * 0.58, sway * 0.5);
  ctx.fill();
  // Three embers ride the updraft around the flame.
  for (let index = 0; index < 3; index += 1) {
    const orbit = time * 2.4 + index * (Math.PI * 2 / 3);
    const ex = spark.x + Math.cos(orbit) * glowRadius * 0.42;
    const ey = spark.y + Math.sin(orbit) * glowRadius * 0.3 - 4;
    ctx.globalAlpha = blink ? 0.2 : 0.55;
    ctx.fillStyle = '#ffd97a';
    ctx.beginPath();
    ctx.arc(ex, ey, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  if (spark.invulnerable > 0) {
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.2 * Math.sin(time * 10);
    ctx.strokeStyle = '#ffe9a8';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(spark.x, spark.y, spark.radius + 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawEffects(ctx, fx) {
  for (const p of fx.particles) {
    const fade = 1 - p.age / p.life;
    ctx.save();
    ctx.globalAlpha = Math.max(0, fade);
    if (p.ring) {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.width * fade + 0.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.streak) {
      // A streak: a short bright line along the particle's own motion,
      // for nova shrapnel and the fastest burst sparks.
      ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.max(0.6, p.size * 0.5 * fade);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x - p.vx * 0.045, p.y - p.vy * 0.045);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.4, p.size * fade), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  for (const t of fx.texts) {
    const fade = 1 - t.age / t.life;
    text(ctx, t.text, t.x, t.y, t.big ? '700 21px system-ui, sans-serif' : '700 14px system-ui, sans-serif', t.color, 'center', Math.max(0, fade));
  }
}

/** Bolt streaks: a fading tail behind each spark-bolt and a hot head. */
function drawBoltsGlow(ctx, world) {
  ctx.save();
  ctx.lineCap = 'round';
  for (const bolt of world.bolts) {
    const tailX = bolt.x - bolt.vx * 0.03;
    const tailY = bolt.y - bolt.vy * 0.03;
    const streak = ctx.createLinearGradient(tailX, tailY, bolt.x, bolt.y);
    streak.addColorStop(0, 'rgba(255,217,122,0)');
    streak.addColorStop(1, 'rgba(255,217,122,0.8)');
    ctx.strokeStyle = streak;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(bolt.x, bolt.y);
    ctx.stroke();
    const head = ctx.createRadialGradient(bolt.x, bolt.y, 0.5, bolt.x, bolt.y, bolt.radius * 2.1);
    head.addColorStop(0, 'rgba(255,243,196,0.95)');
    head.addColorStop(0.4, 'rgba(255,217,122,0.5)');
    head.addColorStop(1, 'rgba(255,217,122,0)');
    ctx.fillStyle = head;
    ctx.beginPath();
    ctx.arc(bolt.x, bolt.y, bolt.radius * 2.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff6d8';
    ctx.beginPath();
    ctx.arc(bolt.x, bolt.y, bolt.radius * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Darkness presses in everywhere the Spark's light does not reach. */
function drawDarkness(ctx, spark, time) {
  const reach = 112 + spark.light * 2.2;
  const gradient = ctx.createRadialGradient(spark.x, spark.y, reach * 0.42, spark.x, spark.y, reach);
  gradient.addColorStop(0, 'rgba(3,2,14,0)');
  gradient.addColorStop(1, 'rgba(3,2,14,0.79)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  if (spark.light < 26) {
    const pulse = 0.1 + 0.08 * Math.sin(time * 5.2);
    ctx.fillStyle = `rgba(120,10,10,${Math.max(0, pulse * (1 - spark.light / 26))})`;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }
}

function bar(ctx, x, y, width, height, fraction, fill, label) {
  ctx.save();
  ctx.fillStyle = 'rgba(8,6,22,0.72)';
  roundedRect(ctx, x, y, width, height, height / 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(244,234,210,0.16)';
  ctx.lineWidth = 1;
  roundedRect(ctx, x + 0.5, y + 0.5, width - 1, height - 1, (height - 1) / 2);
  ctx.stroke();
  if (fraction > 0.005) {
    ctx.fillStyle = fill;
    roundedRect(ctx, x + 1.5, y + 1.5, (width - 3) * Math.min(1, fraction), height - 3, (height - 3) / 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    roundedRect(ctx, x + 1.5, y + 1.5, (width - 3) * Math.min(1, fraction), (height - 3) / 2, (height - 3) / 4);
    ctx.fill();
  }
  ctx.restore();
  text(ctx, label, x, y - 9, '600 10.5px system-ui, sans-serif', PALETTE.textDim, 'left');
}

/** Score, wave, hearts, light and charge: how the player is doing. */
function drawHud(ctx, world, ui) {
  const spark = world.spark;
  ctx.save();
  ctx.fillStyle = 'rgba(8,6,22,0.55)';
  roundedRect(ctx, 12, 10, 218, 56, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,216,150,0.16)';
  ctx.lineWidth = 1;
  roundedRect(ctx, 12.5, 10.5, 217, 55, 10);
  ctx.stroke();
  const accent = ctx.createLinearGradient(24, 0, 218, 0);
  accent.addColorStop(0, PALETTE.ember);
  accent.addColorStop(1, 'rgba(255,179,71,0)');
  ctx.fillStyle = accent;
  ctx.fillRect(24, 13, 194, 2);
  text(ctx, `${world.score}`, 26, 35, '800 25px system-ui, sans-serif', PALETTE.text, 'left');
  text(ctx, `BEST ${Math.max(ui.best, world.score)}`, 26, 56, '600 11px system-ui, sans-serif', PALETTE.textDim, 'left');
  if (world.combo > 1) {
    const heat = Math.min(1, world.comboClock / 2.5);
    text(ctx, `COMBO ×${(1 + Math.min(world.combo * 0.1, 2)).toFixed(1)}`, 122, 56, '700 12px system-ui, sans-serif', '#ffb02e', 'left', 0.4 + heat * 0.6);
  }
  text(ctx, world.endless && world.wave > DAWN_WAVE ? `WAVE ${world.wave} · ENDLESS` : `WAVE ${world.wave} OF ${DAWN_WAVE}`, FIELD.width / 2, 30, '800 19px system-ui, sans-serif', PALETTE.text, 'center');
  const foesLeft = world.director.budget + world.foes.length;
  if (world.phase === 'fighting') {
    text(ctx, foesLeft > 0 ? `${foesLeft} in the dark` : 'the Hollow stirs…', FIELD.width / 2, 53, '600 11.5px system-ui, sans-serif', PALETTE.textDim, 'center');
  }
  for (let index = 0; index < 3; index += 1) {
    const x = FIELD.width - 30 - index * 30;
    const lit = index < spark.hearts;
    ctx.save();
    ctx.globalAlpha = lit ? 1 : 0.22;
    if (lit) {
      ctx.shadowColor = PALETTE.heart;
      ctx.shadowBlur = 9;
    }
    ctx.fillStyle = PALETTE.heart;
    const s = 9;
    const y = 24;
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.85);
    ctx.bezierCurveTo(x - s * 1.25, y - s * 0.1, x - s * 0.55, y - s, x, y - s * 0.25);
    ctx.bezierCurveTo(x + s * 0.55, y - s, x + s * 1.25, y - s * 0.1, x, y + s * 0.85);
    ctx.fill();
    ctx.restore();
  }
  bar(ctx, 16, FIELD.height - 30, 218, 13, spark.light / 100, spark.light < 26 ? PALETTE.danger : '#ffb347', 'LIGHT — gather dew to keep it burning');
  const novaReady = spark.charge >= 100;
  bar(ctx, FIELD.width - 234, FIELD.height - 30, 218, 13, spark.charge / 100, novaReady ? '#ffe9a8' : '#7a6cff', novaReady ? 'NOVA READY — SHIFT OR RIGHT-CLICK' : 'NOVA CHARGE');
  if (ui.muted) text(ctx, 'MUTED (M)', FIELD.width - 16, 56, '600 11px system-ui, sans-serif', PALETTE.textDim, 'right');
  ctx.restore();
}

function veil(ctx, alpha) {
  ctx.fillStyle = `rgba(4,3,16,${alpha})`;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
}

function drawTitle(ctx, world, ui) {
  // A vignette instead of a flat veil, so the living scene glows through
  // the middle of the title while the edges fall away.
  const vignette = ctx.createRadialGradient(
    FIELD.width / 2, FIELD.height / 2, 150,
    FIELD.width / 2, FIELD.height / 2, 620,
  );
  vignette.addColorStop(0, 'rgba(4,3,16,0.18)');
  vignette.addColorStop(1, 'rgba(4,3,16,0.66)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  const cx = FIELD.width / 2;
  // The emblem: one great flame over the name, with embers riding its heat.
  const emblemGlow = ctx.createRadialGradient(cx, 106, 4, cx, 106, 105);
  emblemGlow.addColorStop(0, 'rgba(255,190,100,0.5)');
  emblemGlow.addColorStop(0.5, 'rgba(255,140,60,0.16)');
  emblemGlow.addColorStop(1, 'rgba(255,140,60,0)');
  ctx.fillStyle = emblemGlow;
  ctx.fillRect(cx - 105, 1, 210, 210);
  const sway = Math.sin(ui.time * 2.1) * 3;
  const emblemOuter = ctx.createLinearGradient(0, 14, 0, 142);
  emblemOuter.addColorStop(0, '#ff8a3c');
  emblemOuter.addColorStop(1, PALETTE.ember);
  ctx.fillStyle = emblemOuter;
  flamePath(ctx, cx, 106, 50, 92, sway);
  ctx.fill();
  const emblemInner = ctx.createLinearGradient(0, 66, 0, 136);
  emblemInner.addColorStop(0, PALETTE.emberCore);
  emblemInner.addColorStop(1, '#ffd97a');
  ctx.fillStyle = emblemInner;
  flamePath(ctx, cx, 118, 27, 52, sway * 0.5);
  ctx.fill();
  for (let index = 0; index < 5; index += 1) {
    const orbit = ui.time * 1.7 + index * (Math.PI * 2 / 5);
    const ex = cx + Math.cos(orbit) * 74;
    const ey = 106 + Math.sin(orbit) * 46;
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#ffd97a';
    ctx.beginPath();
    ctx.arc(ex, ey, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // The name in ember gradient, lit from within.
  ctx.save();
  ctx.font = '800 66px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(255,150,60,0.55)';
  ctx.shadowBlur = 26;
  const nameGradient = ctx.createLinearGradient(0, 158, 0, 222);
  nameGradient.addColorStop(0, '#fff6d8');
  nameGradient.addColorStop(0.55, PALETTE.ember);
  nameGradient.addColorStop(1, '#ff8a3c');
  ctx.fillStyle = nameGradient;
  ctx.fillText('SPARKHOLLOW', cx, 192);
  ctx.restore();
  text(ctx, 'the last light in the Hollow', cx, 234, 'italic 600 19px system-ui, sans-serif', PALETTE.ember, 'center');
  // An ornament divider: two ember rules and a diamond.
  ctx.save();
  ctx.strokeStyle = 'rgba(255,179,71,0.65)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(cx - 158, 258);
  ctx.lineTo(cx - 16, 258);
  ctx.moveTo(cx + 16, 258);
  ctx.lineTo(cx + 158, 258);
  ctx.stroke();
  ctx.fillStyle = PALETTE.ember;
  ctx.translate(cx, 258);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-4.5, -4.5, 9, 9);
  ctx.restore();
  text(ctx, 'The dark sends its brood to snuff you out. Burn through ten waves and hold until dawn.', cx, 284, '500 15.5px system-ui, sans-serif', PALETTE.text, 'center');
  // The controls, set in a card so they read as one designed block.
  ctx.save();
  ctx.fillStyle = 'rgba(10,8,28,0.55)';
  roundedRect(ctx, cx - 368, 302, 736, 98, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,216,150,0.15)';
  ctx.lineWidth = 1;
  roundedRect(ctx, cx - 367.5, 302.5, 735, 97, 14);
  ctx.stroke();
  ctx.restore();
  text(ctx, 'WASD or arrows — move        Mouse — aim        Hold click or Space — fire sparks', cx, 330, '600 14.5px system-ui, sans-serif', PALETTE.text, 'center');
  text(ctx, 'Shift or right-click — Nova burst, once charged        Gather dew: it feeds your light', cx, 356, '600 14.5px system-ui, sans-serif', PALETTE.text, 'center');
  text(ctx, 'Your light is your life: it fades as you burn, and a dead light gutters your hearts away.', cx, 382, '500 13.5px system-ui, sans-serif', PALETTE.textDim, 'center');
  const pulse = 0.65 + 0.35 * Math.sin(ui.time * 3.2);
  text(ctx, 'CLICK OR PRESS ENTER TO BEGIN', cx, 452, '800 21px system-ui, sans-serif', '#ffe9a8', 'center', pulse, 14);
  if (ui.best > 0) text(ctx, `Best score so far: ${ui.best}`, cx, 488, '600 14px system-ui, sans-serif', PALETTE.textDim, 'center');
  text(ctx, 'P — pause · M — sound on/off', cx, FIELD.height - 26, '600 12px system-ui, sans-serif', PALETTE.textDim, 'center');
}

function drawEndScreen(ctx, world, ui, won) {
  veil(ctx, won ? 0.35 : 0.55);
  const cx = FIELD.width / 2;
  if (won) {
    // The sunrise the whole game promised: a sun disc on the centre
    // horizon, breathing slowly, with the sky warming out from it. The
    // field behind is the wave-ten field at full dawn; this is the same
    // light, closer.
    const horizonY = FIELD.height * 0.94;
    const sunGlow = ctx.createRadialGradient(cx, horizonY, 8, cx, horizonY, 340);
    sunGlow.addColorStop(0, 'rgba(255,205,120,0.5)');
    sunGlow.addColorStop(0.4, 'rgba(255,140,80,0.18)');
    sunGlow.addColorStop(1, 'rgba(255,140,80,0)');
    ctx.fillStyle = sunGlow;
    ctx.fillRect(cx - 340, horizonY - 340, 680, 680);
    const breathe = 1 + Math.sin(ui.time * 1.4) * 0.03;
    ctx.fillStyle = DAWN.sun;
    ctx.beginPath();
    ctx.arc(cx, horizonY, 26 * breathe, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,157,92,0.35)';
    ctx.fillRect(cx - 190, horizonY - 1.5, 380, 3);
  }
  // The air after the end: embers rise into the dawn, or ash sifts down.
  for (const mote of END_MOTES) {
    const span = FIELD.height + 40;
    const drift = Math.sin(ui.time * 0.7 + mote.phase) * 14;
    const y = won
      ? span - ((mote.y + ui.time * mote.speed) % span) - 20
      : ((mote.y + ui.time * mote.speed * 0.6) % span) - 20;
    ctx.globalAlpha = won ? 0.5 : 0.32;
    ctx.fillStyle = won ? '#ffcf87' : '#8d86a8';
    ctx.beginPath();
    ctx.arc(mote.x + drift, y, mote.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (won) {
    text(ctx, 'DAWN BREAKS', cx, 198, '800 56px system-ui, sans-serif', '#ffe9a8', 'center', 1, 22);
    text(ctx, 'You held the Hollow until first light. The brood scatters.', cx, 240, 'italic 600 17px system-ui, sans-serif', PALETTE.ember, 'center');
  } else {
    text(ctx, 'THE LIGHT GOES OUT', cx, 198, '800 50px system-ui, sans-serif', '#ff9a86', 'center', 1, 16);
    text(ctx, `The dark takes the Hollow on wave ${world.wave}.`, cx, 240, 'italic 600 17px system-ui, sans-serif', PALETTE.textDim, 'center');
  }
  // The score, set in its own card.
  ctx.save();
  ctx.fillStyle = 'rgba(10,8,28,0.5)';
  roundedRect(ctx, cx - 172, 268, 344, 100, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,216,150,0.15)';
  ctx.lineWidth = 1;
  roundedRect(ctx, cx - 171.5, 268.5, 343, 99, 14);
  ctx.stroke();
  ctx.restore();
  text(ctx, `SCORE ${world.score}`, cx, 306, '800 34px system-ui, sans-serif', PALETTE.text, 'center');
  text(ctx, `Best ${Math.max(ui.best, world.score)} · Wave reached ${world.wave}`, cx, 342, '600 15px system-ui, sans-serif', PALETTE.textDim, 'center');
  const pulse = 0.65 + 0.35 * Math.sin(ui.time * 3.2);
  text(ctx, 'ENTER OR CLICK — NEW RUN', cx, 424, '800 19px system-ui, sans-serif', '#ffe9a8', 'center', pulse, 12);
  if (won) text(ctx, 'C — keep burning into the endless night', cx, 456, '600 14.5px system-ui, sans-serif', PALETTE.text, 'center', pulse);
}

/** Draw the whole frame: world, darkness, HUD, then the active screen. */
export function render(ctx, world, screen, ui) {
  const time = ui.time;
  // How far the night has turned toward morning: the wave's share of the
  // road to dawn, and full dawn once the run is won.
  const dawn = world.won ? 1 : Math.min(1, (world.wave - 1) / (DAWN_WAVE - 1));
  drawBackground(ctx, time, dawn);
  for (const pickup of world.pickups) drawDew(ctx, pickup, time);
  for (const foe of world.foes) drawFoe(ctx, foe, time);
  drawSpark(ctx, world.spark, time);
  drawEffects(ctx, world.fx);
  drawBoltsGlow(ctx, world);
  drawDarkness(ctx, world.spark, time);
  if (screen !== SCREEN_TITLE) drawHud(ctx, world, ui);
  if (world.phase === 'intermission' && screen === SCREEN_PLAY) {
    text(ctx, `WAVE ${world.wave} HELD`, FIELD.width / 2, 218, '800 34px system-ui, sans-serif', '#ffe9a8', 'center', 1, 18);
    text(ctx, 'the Hollow breathes… gather yourself', FIELD.width / 2, 252, '600 15px system-ui, sans-serif', PALETTE.textDim, 'center');
  } else if (world.banner > 0 && screen === SCREEN_PLAY) {
    const alpha = Math.min(1, world.banner / 0.6);
    text(ctx, world.wave === 1 ? 'WAVE 1 — THEY COME' : `WAVE ${world.wave}`, FIELD.width / 2, 218, '800 34px system-ui, sans-serif', '#ffe9a8', 'center', alpha, 18);
  }
  if (screen === SCREEN_TITLE) drawTitle(ctx, world, ui);
  else if (screen === SCREEN_OVER) drawEndScreen(ctx, world, ui, false);
  else if (screen === SCREEN_WIN) drawEndScreen(ctx, world, ui, true);
  else if (screen === SCREEN_PAUSE) {
    veil(ctx, 0.5);
    text(ctx, 'PAUSED', FIELD.width / 2, 268, '800 42px system-ui, sans-serif', PALETTE.text, 'center');
    text(ctx, 'P or Esc — back to the dark', FIELD.width / 2, 312, '600 15px system-ui, sans-serif', PALETTE.textDim, 'center');
  }
}
