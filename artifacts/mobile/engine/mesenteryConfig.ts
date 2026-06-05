import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PhysicsState } from './physics';
import { buildSmallIntestineNodes, buildLargeIntestineNodes } from './intestineInit';

// ── Storage keys ──────────────────────────────────────────────────────────────
export const PRESET_COUNT = 3;

const PRESET_KEYS = [
  '@mesentery_preset_1_v1',
  '@mesentery_preset_2_v1',
  '@mesentery_preset_3_v1',
] as const;

const ACTIVE_PRESET_KEY = '@mesentery_active_preset_v1';
const LEGACY_KEY        = '@mesentery_config_v1'; // migrated → preset 0

// ── Types ─────────────────────────────────────────────────────────────────────
export interface MesenteryNodePos {
  rx: number;
  ry: number;
}

export interface MesenteryConfig {
  largeNodes: MesenteryNodePos[];
  smallNodes: MesenteryNodePos[];
}

// ── Active preset index (0-based) ─────────────────────────────────────────────
export async function loadActivePresetIdx(): Promise<number> {
  try {
    const val = await AsyncStorage.getItem(ACTIVE_PRESET_KEY);
    const n   = val !== null ? parseInt(val, 10) : 0;
    return isNaN(n) || n < 0 || n >= PRESET_COUNT ? 0 : n;
  } catch { return 0; }
}

export async function saveActivePresetIdx(idx: number): Promise<void> {
  try {
    await AsyncStorage.setItem(ACTIVE_PRESET_KEY, String(idx));
  } catch { /* ignore */ }
}

// ── Per-preset load / save ────────────────────────────────────────────────────
export async function loadPreset(idx: number): Promise<MesenteryConfig | null> {
  try {
    // Migrate legacy key → preset 0 on first access
    if (idx === 0) {
      const existing = await AsyncStorage.getItem(PRESET_KEYS[0]);
      if (!existing) {
        const legacy = await AsyncStorage.getItem(LEGACY_KEY);
        if (legacy) {
          await AsyncStorage.setItem(PRESET_KEYS[0], legacy);
          return JSON.parse(legacy) as MesenteryConfig;
        }
      }
    }
    const json = await AsyncStorage.getItem(PRESET_KEYS[idx]);
    if (!json) return null;
    return JSON.parse(json) as MesenteryConfig;
  } catch { return null; }
}

export async function savePreset(idx: number, config: MesenteryConfig): Promise<void> {
  await AsyncStorage.setItem(PRESET_KEYS[idx], JSON.stringify(config));
}

// ── Active-preset helpers (used by GameContext + SettingsScreen) ──────────────
export async function loadActiveMesenteryConfig(): Promise<MesenteryConfig | null> {
  const idx = await loadActivePresetIdx();
  return loadPreset(idx);
}

export async function saveActiveMesenteryConfig(config: MesenteryConfig): Promise<void> {
  const idx = await loadActivePresetIdx();
  await savePreset(idx, config);
}

// Keep old names as aliases so existing callers still compile
export const loadMesenteryConfig = loadActiveMesenteryConfig;
export const saveMesenteryConfig  = saveActiveMesenteryConfig;

// ── Apply config to physics state ─────────────────────────────────────────────
export function applyMesenteryConfig(state: PhysicsState, config: MesenteryConfig): void {
  for (let i = 0; i < state.largeNodes.length && i < config.largeNodes.length; i++) {
    const rx = config.largeNodes[i].rx;
    const ry = config.largeNodes[i].ry;
    state.largeNodes[i].rx = rx;
    state.largeNodes[i].ry = ry;
    state.largeNodes[i].x  = rx;
    state.largeNodes[i].y  = ry;
    state.largeNodes[i].vx = 0;
    state.largeNodes[i].vy = 0;
  }
  for (let i = 0; i < state.smallNodes.length && i < config.smallNodes.length; i++) {
    const rx = config.smallNodes[i].rx;
    const ry = config.smallNodes[i].ry;
    state.smallNodes[i].rx = rx;
    state.smallNodes[i].ry = ry;
    state.smallNodes[i].x  = rx;
    state.smallNodes[i].y  = ry;
    state.smallNodes[i].vx = 0;
    state.smallNodes[i].vy = 0;
  }
}

export function extractMesenteryConfig(state: PhysicsState): MesenteryConfig {
  return {
    largeNodes: state.largeNodes.map(n => ({ rx: n.rx, ry: n.ry })),
    smallNodes: state.smallNodes.map(n => ({ rx: n.rx, ry: n.ry })),
  };
}

export function getDefaultMesenteryConfig(): MesenteryConfig {
  const small = buildSmallIntestineNodes();
  const large = buildLargeIntestineNodes();
  return {
    smallNodes: small.map(n => ({ rx: n.rx, ry: n.ry })),
    largeNodes: large.map(n => ({ rx: n.rx, ry: n.ry })),
  };
}
