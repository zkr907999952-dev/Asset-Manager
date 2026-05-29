export const CANVAS_W = 340;
export const CANVAS_H = 460;
export const CAVITY_CX = 170;
export const CAVITY_CY = 248;
export const CAVITY_RX = 148;
export const CAVITY_RY = 175;

export const N_SMALL = 56;
export const N_LARGE = 32;
export const SMALL_SEG_LENGTH = 20;
export const LARGE_SEG_LENGTH = 22;
export const SMALL_RADIUS = 8;
export const LARGE_RADIUS = 15;

export const PHYSICS_FPS = 30;
export const PHYSICS_ITERATIONS = 8;
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
