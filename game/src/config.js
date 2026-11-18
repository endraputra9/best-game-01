// Sparkhollow tuning: the field, the Spark, its light, and the palette.
// Every number the rest of the game balances against lives here, so the feel of
// the game can be retuned in one place without hunting through the logic.

/** The logical play field, in pixels. The view scales it to the window. */
export const FIELD = { width: 960, height: 600 };

/** Fixed simulation step, in seconds: the world always advances in these. */
export const STEP = 1 / 60;

/** The wave at whose end dawn breaks and the game is won. */
export const DAWN_WAVE = 10;

export const SPARK = {
  radius: 12,
  speed: 268,
  /** Seconds of glide after a key is released; lower is tighter. */
  glide: 0.09,
  fireInterval: 0.135,
  boltSpeed: 580,
  boltRadius: 4,
  hearts: 3,
  /** Seconds of invulnerability after taking a hit. */
  mercySeconds: 1.6,
  /** Light lost per second just by burning. */
  lightDecay: 1.05,
  /** Extra decay per wave number, so late waves burn faster. */
  lightDecayPerWave: 0.13,
  /** Light gained per foe felled. */
  lightPerKill: 1.6,
  /** Below this much light the Spark starts to gutter and take damage. */
  gutterLight: 1,
  /** Seconds of guttering per heart lost. */
  gutterSeconds: 1.8,
};

export const DEW = {
  /** Light restored by gathering one dew drop. */
  light: 16,
  /** Nova charge gained from one dew drop. */
  charge: 22,
  /** Seconds a drop lingers before it evaporates. */
  lifetime: 9,
  /** Distance at which drops drift toward the Spark on their own. */
  magnetRadius: 96,
  magnetSpeed: 190,
};

export const NOVA = {
  /** Charge needed to loose a nova. */
  cost: 100,
  /** Charge gained per foe felled. */
  chargePerKill: 3,
  /** Radius of the burst, in pixels. */
  radius: 196,
  /** Damage the burst deals (a husk survives one, weakened). */
  damage: 3,
};

export const COMBO = {
  /** Seconds a kill chain stays alive without another kill. */
  windowSeconds: 2.5,
  /** Each chained kill adds this much to the score multiplier. */
  step: 0.1,
  /** The multiplier never grows past this. */
  maxBonus: 2,
};

/**
 * The sky's slow turn toward morning, by wave. The renderer warms the
 * horizon with these hues as dawnProgress goes 0 → 1 across the ten waves,
 * so a wave-nine frame visibly differs from a wave-one frame: the night
 * itself is the progress bar. `tint` is the horizon glow colour, `sun` the
 * disc that rises on the win screen.
 */
export const DAWN = {
  tint: '#ff9d5c',
  tintFar: '#b34a6e',
  sun: '#ffd98c',
  fog: '190,180,255',
};

/** Colours of the hollow: deep night blues, ember oranges, foe hues. */
export const PALETTE = {
  nightTop: '#060818',
  nightBottom: '#1b1142',
  groundGlow: '#2e1f6e',
  ember: '#ffb347',
  emberCore: '#fff3c4',
  bolt: '#ffd97a',
  dew: '#7ae7ff',
  heart: '#ff6b81',
  gloom: '#9a6bff',
  mite: '#ffb02e',
  husk: '#57c7a3',
  pod: '#8ee06a',
  wraith: '#a8e6ff',
  shade: '#ff7ad9',
  text: '#f4ead2',
  textDim: '#9d94b8',
  danger: '#ff5d5d',
};
