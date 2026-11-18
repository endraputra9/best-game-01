// Sparkhollow's entry point: owns the canvas and its letterboxed view, the
// screen state machine (title, play, pause, dawn, darkness), the fixed-step
// loop, and the translation of world events into sound. With ?shot=start,
// ?shot=play, ?shot=end, ?shot=win or ?shot=nova it instead stages one
// deterministic scene from shots.js and holds it, which is how the entry's
// screenshots are taken.

import { FIELD, STEP } from './config.js';
import { Input } from './input.js';
import { World } from './world.js';
import { isMuted, setMuted, sfx, unlockAudio } from './audio.js';
import {
  SCREEN_OVER,
  SCREEN_PAUSE,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_WIN,
  render,
} from './render.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');

const view = { scale: 1, offsetX: 0, offsetY: 0, dpr: 1 };

function resize() {
  view.dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(window.innerWidth * view.dpr);
  canvas.height = Math.round(window.innerHeight * view.dpr);
  view.scale = Math.min(window.innerWidth / FIELD.width, window.innerHeight / FIELD.height);
  view.offsetX = (window.innerWidth - FIELD.width * view.scale) / 2;
  view.offsetY = (window.innerHeight - FIELD.height * view.scale) / 2;
}
window.addEventListener('resize', resize);
resize();

function toField(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left - view.offsetX) / view.scale,
    y: (clientY - rect.top - view.offsetY) / view.scale,
  };
}

const input = new Input(canvas, toField);
const world = new World();

let best = 0;
try {
  best = Number(window.localStorage.getItem('sparkhollow-best') ?? 0) || 0;
} catch {
  best = 0;
}

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const ui = { best, muted: isMuted(), time: 0 };
let screen = SCREEN_TITLE;

function saveBest() {
  if (world.score > best) {
    best = world.score;
    ui.best = best;
    try {
      window.localStorage.setItem('sparkhollow-best', String(best));
    } catch {
      // A private window may refuse storage; the best score is a nicety.
    }
  }
}

function startRun() {
  unlockAudio();
  world.reset((Date.now() % 2147483647) + 1);
  screen = SCREEN_PLAY;
  sfx.click();
}

/** The control record for a title backdrop: a slow orbit of the centre. */
function ambientControl() {
  const angle = ui.time * 0.35;
  const targetX = FIELD.width / 2 + Math.cos(angle) * 150;
  const targetY = FIELD.height / 2 + Math.sin(angle) * 95;
  return {
    moveX: targetX - world.spark.x,
    moveY: targetY - world.spark.y,
    aimX: world.spark.x + Math.cos(angle + 1.2) * 120,
    aimY: world.spark.y + Math.sin(angle + 1.2) * 120,
    firing: false,
    nova: false,
  };
}

/** The control record from the player's hands this frame. */
function playerControl() {
  const axis = input.axis();
  return {
    moveX: axis.x,
    moveY: axis.y,
    aimX: input.mouse.x,
    aimY: input.mouse.y,
    firing: input.mouse.down || input.down('Space'),
    nova: input.rightPressed || input.pressed('ShiftLeft', 'ShiftRight', 'KeyJ'),
  };
}

const EVENT_SOUNDS = {
  shoot: () => sfx.shoot(),
  hit: () => sfx.hit(),
  die: (event) => sfx.die(event.big),
  pickup: () => sfx.pickup(),
  heart: () => sfx.heart(),
  hurt: () => sfx.hurt(),
  nova: () => sfx.nova(),
  chargeReady: () => sfx.chargeReady(),
  wave: () => sfx.wave(),
  clear: () => sfx.clear(),
  win: () => sfx.win(),
  lose: () => sfx.lose(),
};

let hitPlayedThisFrame = false;
function drainEvents() {
  for (const event of world.events) {
    if (event.type === 'hit' && hitPlayedThisFrame) continue;
    const sound = EVENT_SOUNDS[event.type];
    if (sound !== undefined) {
      sound(event);
      if (event.type === 'hit') hitPlayedThisFrame = true;
    }
  }
}

function announce() {
  if (status === null) return;
  status.textContent = `Sparkhollow: score ${world.score}, wave ${world.wave}, `
    + `${world.spark.hearts} hearts, light ${Math.round(world.spark.light)} percent.`;
}

function handleScreenKeys() {
  if (input.pressed('KeyM')) {
    setMuted(!isMuted());
    ui.muted = isMuted();
  }
  if (screen === SCREEN_TITLE) {
    if (input.pressed('Enter') || input.mousePressed) startRun();
  } else if (screen === SCREEN_PLAY) {
    if (input.pressed('KeyP', 'Escape')) screen = SCREEN_PAUSE;
  } else if (screen === SCREEN_PAUSE) {
    if (input.pressed('KeyP', 'Escape', 'Enter')) screen = SCREEN_PLAY;
  } else if (screen === SCREEN_OVER) {
    if (input.pressed('Enter') || input.mousePressed) startRun();
  } else if (screen === SCREEN_WIN) {
    if (input.pressed('KeyC')) {
      world.continueEndless();
      screen = SCREEN_PLAY;
      sfx.click();
    } else if (input.pressed('Enter') || input.mousePressed) {
      startRun();
    }
  }
}

let lastTimestamp = 0;
let accumulator = 0;
let announcedScore = -1;

function frame(timestamp) {
  requestAnimationFrame(frame);
  ui.time = timestamp / 1000;
  const dt = Math.min(0.1, lastTimestamp === 0 ? 0 : (timestamp - lastTimestamp) / 1000);
  lastTimestamp = timestamp;
  hitPlayedThisFrame = false;

  handleScreenKeys();
  if (screen === SCREEN_PLAY) {
    accumulator += dt;
    while (accumulator >= STEP) {
      world.step(STEP, playerControl());
      drainEvents();
      accumulator -= STEP;
      if (world.over) {
        saveBest();
        screen = world.won ? SCREEN_WIN : SCREEN_OVER;
        break;
      }
    }
  } else if (screen === SCREEN_TITLE) {
    accumulator += dt;
    while (accumulator >= STEP) {
      world.step(STEP, ambientControl());
      accumulator -= STEP;
    }
    world.events.length = 0;
  }
  if (world.score !== announcedScore) {
    announcedScore = world.score;
    announce();
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#05040f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const shake = world.fx.shakeOffset();
  ctx.setTransform(
    view.dpr * view.scale, 0, 0, view.dpr * view.scale,
    view.dpr * (view.offsetX + shake.x * view.scale),
    view.dpr * (view.offsetY + shake.y * view.scale),
  );
  render(ctx, world, screen, ui);
  input.endFrame();
}

if (shotName !== null) {
  const seed = Number(params.get('seed') ?? 1) || 1;
  world.reset(seed);
  const staged = stageShot(shotName, world);
  screen = staged.screen;
  ui.best = staged.best;
  ui.time = 8;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#05040f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(
    view.dpr * view.scale, 0, 0, view.dpr * view.scale,
    view.dpr * view.offsetX, view.dpr * view.offsetY,
  );
  render(ctx, world, screen, ui);
  announce();
  window.__shotReady = true;
} else {
  world.reset(7);
  requestAnimationFrame(frame);
}
