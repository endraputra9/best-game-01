// Sparkhollow's renderer: everything the player sees, drawn on one canvas in
// logical field coordinates. Night gradient and starfield first, then dew,
// foes, bolts and the Spark, then particles, then the darkness that the
// Spark's light pushes back, then the HUD and whichever screen is up.

import { DAWN_WAVE, FIELD, PALETTE } from './config.js';
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

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function text(ctx, value, x, y, font, color, align = 'left', alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(value, x, y);
  ctx.restore();
}

/** The night itself: gradient, a soft ground glow, stars and far motes. */
function drawBackground(ctx, time) {
  const gradient = ctx.createLinearGradient(0, 0, 0, FIELD.height);
  gradient.addColorStop(0, PALETTE.nightTop);
  gradient.addColorStop(1, PALETTE.nightBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
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
    ctx.globalAlpha = twinkle * 0.8;
    ctx.fillStyle = '#cfd6ff';
    ctx.fillRect(star.x, star.y, star.size, star.size);
  }
  ctx.globalAlpha = 1;
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
  // A faint self-glow, so a foe reads as a shape in the dark before the
  // Spark's light reaches it: the player can see trouble coming.
  const halo = ctx.createRadialGradient(foe.x, foe.y, 2, foe.x, foe.y, foe.radius * 2.15);
  halo.addColorStop(0, color + '3d');
  halo.addColorStop(1, color + '00');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(foe.x, foe.y, foe.radius * 2.15, 0, Math.PI * 2);
  ctx.fill();
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
    ctx.fill();
    ctx.fillStyle = '#2a1650';
    ctx.beginPath();
    ctx.arc(0, 0, foe.radius * 0.52, 0, Math.PI * 2);
    ctx.fill();
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
  const angle = Math.atan2(spark.aimY - spark.y, spark.aimX - spark.x);
  ctx.strokeStyle = PALETTE.ember;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(spark.x + Math.cos(angle) * (spark.radius + 3), spark.y + Math.sin(angle) * (spark.radius + 3));
  ctx.lineTo(spark.x + Math.cos(angle) * (spark.radius + 10), spark.y + Math.sin(angle) * (spark.radius + 10));
  ctx.stroke();
  const body = ctx.createRadialGradient(spark.x - 3, spark.y - 4, 1, spark.x, spark.y, spark.radius + 3);
  body.addColorStop(0, PALETTE.emberCore);
  body.addColorStop(0.55, PALETTE.ember);
  body.addColorStop(1, '#ff7a3c');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(spark.x, spark.y, spark.radius * flicker, 0, Math.PI * 2);
  ctx.fill();
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

/** Darkness presses in everywhere the Spark's light does not reach. */
function drawDarkness(ctx, spark, time) {
  const reach = 112 + spark.light * 2.2;
  const gradient = ctx.createRadialGradient(spark.x, spark.y, reach * 0.42, spark.x, spark.y, reach);
  gradient.addColorStop(0, 'rgba(3,2,14,0)');
  gradient.addColorStop(1, 'rgba(3,2,14,0.84)');
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
  if (fraction > 0.005) {
    ctx.fillStyle = fill;
    roundedRect(ctx, x + 1.5, y + 1.5, (width - 3) * Math.min(1, fraction), height - 3, (height - 3) / 2);
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
  text(ctx, `${world.score}`, 26, 33, '800 25px system-ui, sans-serif', PALETTE.text, 'left');
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
  veil(ctx, 0.45);
  const cx = FIELD.width / 2;
  text(ctx, 'SPARKHOLLOW', cx, 168, '800 64px system-ui, sans-serif', PALETTE.emberCore, 'center');
  text(ctx, 'the last light in the Hollow', cx, 208, 'italic 600 19px system-ui, sans-serif', PALETTE.ember, 'center');
  text(ctx, 'The dark sends its brood to snuff you out. Burn through ten waves and hold until dawn.', cx, 262, '500 15.5px system-ui, sans-serif', PALETTE.text, 'center');
  text(ctx, 'WASD or arrows — move        Mouse — aim        Hold click or Space — fire sparks', cx, 302, '600 14.5px system-ui, sans-serif', PALETTE.text, 'center');
  text(ctx, 'Shift or right-click — Nova burst, once charged        Gather dew: it feeds your light', cx, 328, '600 14.5px system-ui, sans-serif', PALETTE.text, 'center');
  text(ctx, 'Your light is your life: it fades as you burn, and a dead light gutters your hearts away.', cx, 354, '500 14.5px system-ui, sans-serif', PALETTE.textDim, 'center');
  const pulse = 0.65 + 0.35 * Math.sin(ui.time * 3.2);
  text(ctx, 'CLICK OR PRESS ENTER TO BEGIN', cx, 428, '800 21px system-ui, sans-serif', '#ffe9a8', 'center', pulse);
  if (ui.best > 0) text(ctx, `Best score so far: ${ui.best}`, cx, 472, '600 14px system-ui, sans-serif', PALETTE.textDim, 'center');
  text(ctx, 'P — pause · M — sound on/off', cx, FIELD.height - 26, '600 12px system-ui, sans-serif', PALETTE.textDim, 'center');
}

function drawEndScreen(ctx, world, ui, won) {
  veil(ctx, won ? 0.35 : 0.55);
  const cx = FIELD.width / 2;
  if (won) {
    text(ctx, 'DAWN BREAKS', cx, 190, '800 56px system-ui, sans-serif', '#ffe9a8', 'center');
    text(ctx, 'You held the Hollow until first light. The brood scatters.', cx, 232, 'italic 600 17px system-ui, sans-serif', PALETTE.ember, 'center');
  } else {
    text(ctx, 'THE LIGHT GOES OUT', cx, 190, '800 50px system-ui, sans-serif', '#ff8d7a', 'center');
    text(ctx, `The dark takes the Hollow on wave ${world.wave}.`, cx, 232, 'italic 600 17px system-ui, sans-serif', PALETTE.textDim, 'center');
  }
  text(ctx, `SCORE ${world.score}`, cx, 300, '800 34px system-ui, sans-serif', PALETTE.text, 'center');
  text(ctx, `Best ${Math.max(ui.best, world.score)} · Wave reached ${world.wave}`, cx, 338, '600 15px system-ui, sans-serif', PALETTE.textDim, 'center');
  const pulse = 0.65 + 0.35 * Math.sin(ui.time * 3.2);
  text(ctx, 'ENTER OR CLICK — NEW RUN', cx, 408, '800 19px system-ui, sans-serif', '#ffe9a8', 'center', pulse);
  if (won) text(ctx, 'C — keep burning into the endless night', cx, 440, '600 14.5px system-ui, sans-serif', PALETTE.text, 'center', pulse);
}

/** Draw the whole frame: world, darkness, HUD, then the active screen. */
export function render(ctx, world, screen, ui) {
  const time = ui.time;
  drawBackground(ctx, time);
  for (const pickup of world.pickups) drawDew(ctx, pickup, time);
  for (const foe of world.foes) drawFoe(ctx, foe, time);
  ctx.fillStyle = PALETTE.bolt;
  for (const bolt of world.bolts) {
    ctx.beginPath();
    ctx.arc(bolt.x, bolt.y, bolt.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  drawSpark(ctx, world.spark, time);
  drawEffects(ctx, world.fx);
  drawDarkness(ctx, world.spark, time);
  if (screen !== SCREEN_TITLE) drawHud(ctx, world, ui);
  if (world.phase === 'intermission' && screen === SCREEN_PLAY) {
    text(ctx, `WAVE ${world.wave} HELD`, FIELD.width / 2, 218, '800 34px system-ui, sans-serif', '#ffe9a8', 'center');
    text(ctx, 'the Hollow breathes… gather yourself', FIELD.width / 2, 252, '600 15px system-ui, sans-serif', PALETTE.textDim, 'center');
  } else if (world.banner > 0 && screen === SCREEN_PLAY) {
    const alpha = Math.min(1, world.banner / 0.6);
    text(ctx, world.wave === 1 ? 'WAVE 1 — THEY COME' : `WAVE ${world.wave}`, FIELD.width / 2, 218, '800 34px system-ui, sans-serif', '#ffe9a8', 'center', alpha);
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
