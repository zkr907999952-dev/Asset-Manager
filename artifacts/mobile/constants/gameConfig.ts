export const CANVAS_W = 340;
export const CANVAS_H = 460;
export const CAVITY_CX = 170;
export const CAVITY_CY = 248;
export const CAVITY_RX = 148;
export const CAVITY_RY = 175;

// ── Belly hit detection zone (external view, physics coordinate space) ──────
// Weapons only count as a hit when the aim point is inside EITHER zone.
// Flash and screen shake still fire for any shot regardless.

// Lower zone: ellipse covering navel + mid/lower abdomen
export const BELLY_HIT_CX  = 170;  // horizontal center (= CAVITY_CX)
export const BELLY_HIT_CY  = 248;  // vertical center   (= navel)
export const BELLY_HIT_RX  = 138;  // horizontal radius (matches cavity)
export const BELLY_HIT_RY  = 168;  // vertical radius — expanded to cover full cavity depth

// Upper zone: rectangle covering epigastric / upper abdomen
export const BELLY_UPPER_LEFT = 75;   // left x
export const BELLY_UPPER_RIGHT = 265; // right x
export const BELLY_UPPER_TOP  = 88;   // top y  (just below sternum)
export const BELLY_UPPER_BOT  = 158;  // bottom y (connects to ellipse top)

export const N_SMALL = 66;
export const N_LARGE = 32;
export const SMALL_SEG_LENGTH = 20;
export const LARGE_SEG_LENGTH = 22;
export const SMALL_RADIUS = 8;
export const LARGE_RADIUS = 15;

export const PHYSICS_FPS = 30;
export const PHYSICS_ITERATIONS = 2;
export const DAMPING = 0.975;
export const MESENTERY_STIFFNESS = 0.022;
export const SEGMENT_STIFFNESS = 0.85;

export const PERISTALSIS_BASE_SPEED = 0.4;
export const PERISTALSIS_AMPLITUDE = 1.8;
export const PERISTALSIS_WAVE_AMPLITUDE_DEFAULT = 0.65;
export const PERISTALSIS_WAVE_SPEED_DEFAULT = 1.5;

export const PRESSURE_DIFFUSION_RATE_DEFAULT = 0.004;
export const PRESSURE_DECAY_RATE = 0.002;

export const LARGE_RUPTURE_PRESSURE = 180;

export const BREATH_AMPLITUDE_DEFAULT = 1.2;
export const EXPANSION_SCALE_DEFAULT = 1.3;

export const MAX_RESECTION_SEGMENTS_DEFAULT = 6;

export const TOOLS = {
  METAL_ROD: '金属棒',
  GRAB: '抓握',
  VIBRATOR: '振动器',
  NEEDLE: '长柄针',
  ELECTRIC: '电击器',
  SYRINGE: '注射器',
  ENEMA: '灌肠器',
  BAYONET: '刺刀',
  SILICONE_ROD: '长硅胶棒',
  ANAL_BEADS: '拉珠',
  VIBRATING_EGG: '吞入跳蛋',
} as const;

export type ToolType = typeof TOOLS[keyof typeof TOOLS];

export const BELLY_STRIKE_TOOLS = {
  FIST: '拳头',
  BAT: '棒球棒',
  HAMMER: '撞钟锤',
} as const;

export type BellyStrikeToolId = typeof BELLY_STRIKE_TOOLS[keyof typeof BELLY_STRIKE_TOOLS];

export interface BellyStrikeToolDef {
  id: BellyStrikeToolId;
  desc: string;
  rangeType: 'circle' | 'bat';
  baseRangePx: number;
  powerMult: number;
  delayMs: number;
}

export const BELLY_STRIKE_TOOL_LIST: BellyStrikeToolDef[] = [
  {
    id: BELLY_STRIKE_TOOLS.FIST,
    desc: '圆形范围，威力中等，0.35秒延迟',
    rangeType: 'circle',
    baseRangePx: 50,
    powerMult: 1.0,
    delayMs: 350,
  },
  {
    id: BELLY_STRIKE_TOOLS.BAT,
    desc: '棒状范围，端部威力递增，0.5秒延迟',
    rangeType: 'bat',
    baseRangePx: 80,
    powerMult: 1.5,
    delayMs: 500,
  },
  {
    id: BELLY_STRIKE_TOOLS.HAMMER,
    desc: '大圆范围，威力巨大，1秒延迟',
    rangeType: 'circle',
    baseRangePx: 80,
    powerMult: 2.5,
    delayMs: 1000,
  },
];

export const TOOL_LIST: { id: ToolType; icon: string; desc: string }[] = [
  { id: TOOLS.METAL_ROD, icon: 'minus', desc: '搅动肠道' },
  { id: TOOLS.GRAB, icon: 'anchor', desc: '抓握肠段' },
  { id: TOOLS.VIBRATOR, icon: 'zap', desc: '范围振动' },
  { id: TOOLS.NEEDLE, icon: 'edit-2', desc: '穿刺刺入' },
  { id: TOOLS.ELECTRIC, icon: 'activity', desc: '电击刺激' },
  { id: TOOLS.SYRINGE, icon: 'droplet', desc: '药剂注射' },
  { id: TOOLS.ENEMA, icon: 'git-branch', desc: '灌肠注液' },
  { id: TOOLS.BAYONET, icon: 'navigation', desc: '刺入破坏' },
  { id: TOOLS.SILICONE_ROD, icon: 'bar-chart-2', desc: '扩张插入' },
  { id: TOOLS.ANAL_BEADS, icon: 'more-horizontal', desc: '串珠刺激' },
  { id: TOOLS.VIBRATING_EGG, icon: 'circle', desc: '吞入刺激' },
];

export function createDefaultToolStates(): Record<string, { active: boolean; param1: number; param2: number }> {
  const result: Record<string, { active: boolean; param1: number; param2: number }> = {};
  for (const key of Object.values(TOOLS)) {
    result[key] = { active: false, param1: 50, param2: 50 };
  }
  return result;
}

export const LETHAL_WEAPONS = {
  PISTOL_22:    '.22手枪',
  PISTOL_9MM:   '9MM手枪',
  RIFLE_762:    '7.62mm步枪',
  SNIPER_127:   '12.7mm反器材狙击枪',
  KATANA:       '武士刀',
  CAPSULE_BOMB: '胶囊炸弹',
} as const;

export type LethalWeaponId = typeof LETHAL_WEAPONS[keyof typeof LETHAL_WEAPONS];

export interface LethalWeaponDef {
  id: LethalWeaponId;
  desc: string;
  reserved?: boolean;
  hpDamageRatio: number;    // fraction of 100 HP; -1 = instant kill
  directHitRadius: number;  // px — segment must be within this to count as direct hit
  shockwaveRange: number;   // px — expanding shockwave radius
  shockwavePower: number;   // base impulse/damage of shockwave
  sightType: 'iron' | 'scope';
  flashIntensity: number;   // 0-1
  shakeStrength: number;    // 0 = no shake
  pleasureGain: number;
  perfThreshold: number;    // hit count → perforation (-1 = never perf)
  breakThreshold: number;   // hit count → break (1 = 1st hit breaks)
  breakAllInRange: boolean; // 12.7mm: breaks every seg in shockwave range
}

export const LETHAL_WEAPON_LIST: LethalWeaponDef[] = [
  {
    id: LETHAL_WEAPONS.PISTOL_22,
    desc: '小口径，低噪，低威力',
    hpDamageRatio: 1 / 8,
    directHitRadius: 18,
    shockwaveRange: 36,
    shockwavePower: 28,
    sightType: 'iron',
    flashIntensity: 0.22,
    shakeStrength: 0,
    pleasureGain: 3,
    perfThreshold: 1,
    breakThreshold: 3,
    breakAllInRange: false,
  },
  {
    id: LETHAL_WEAPONS.PISTOL_9MM,
    desc: '军用制式，均衡性能',
    hpDamageRatio: 1 / 5,
    directHitRadius: 20,
    shockwaveRange: 52,
    shockwavePower: 50,
    sightType: 'iron',
    flashIntensity: 0.40,
    shakeStrength: 0,
    pleasureGain: 6,
    perfThreshold: 1,
    breakThreshold: 2,
    breakAllInRange: false,
  },
  {
    id: LETHAL_WEAPONS.RIFLE_762,
    desc: '中间型步枪弹，高穿透高伤害',
    hpDamageRatio: 1 / 3,
    directHitRadius: 22,
    shockwaveRange: 78,
    shockwavePower: 90,
    sightType: 'scope',
    flashIntensity: 0.65,
    shakeStrength: 8,
    pleasureGain: 12,
    perfThreshold: -1,
    breakThreshold: 1,
    breakAllInRange: false,
  },
  {
    id: LETHAL_WEAPONS.SNIPER_127,
    desc: '反器材狙击，绝对动能，无法幸存',
    hpDamageRatio: -1,
    directHitRadius: 28,
    shockwaveRange: 115,
    shockwavePower: 160,
    sightType: 'scope',
    flashIntensity: 1.0,
    shakeStrength: 18,
    pleasureGain: 22,
    perfThreshold: -1,
    breakThreshold: 1,
    breakAllInRange: true,
  },
  {
    id: LETHAL_WEAPONS.KATANA,
    desc: '（预留）',
    reserved: true,
    hpDamageRatio: 0,
    directHitRadius: 0,
    shockwaveRange: 0,
    shockwavePower: 0,
    sightType: 'iron',
    flashIntensity: 0,
    shakeStrength: 0,
    pleasureGain: 0,
    perfThreshold: -1,
    breakThreshold: 1,
    breakAllInRange: false,
  },
  {
    id: LETHAL_WEAPONS.CAPSULE_BOMB,
    desc: '（预留）',
    reserved: true,
    hpDamageRatio: 0,
    directHitRadius: 0,
    shockwaveRange: 0,
    shockwavePower: 0,
    sightType: 'iron',
    flashIntensity: 0,
    shakeStrength: 0,
    pleasureGain: 0,
    perfThreshold: -1,
    breakThreshold: 1,
    breakAllInRange: false,
  },
];
