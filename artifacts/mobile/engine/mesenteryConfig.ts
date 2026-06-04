import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PhysicsState } from './physics';

const MESENTERY_CONFIG_KEY = '@mesentery_config_v1';

export interface MesenteryNodePos {
  rx: number;
  ry: number;
}

export interface MesenteryConfig {
  largeNodes: MesenteryNodePos[];
  smallNodes: MesenteryNodePos[];
}

export async function loadMesenteryConfig(): Promise<MesenteryConfig | null> {
  try {
    const json = await AsyncStorage.getItem(MESENTERY_CONFIG_KEY);
    if (!json) return null;
    return JSON.parse(json) as MesenteryConfig;
  } catch {
    return null;
  }
}

export async function saveMesenteryConfig(config: MesenteryConfig): Promise<void> {
  await AsyncStorage.setItem(MESENTERY_CONFIG_KEY, JSON.stringify(config));
}

export function applyMesenteryConfig(state: PhysicsState, config: MesenteryConfig): void {
  for (let i = 0; i < state.largeNodes.length && i < config.largeNodes.length; i++) {
    state.largeNodes[i].rx = config.largeNodes[i].rx;
    state.largeNodes[i].ry = config.largeNodes[i].ry;
  }
  for (let i = 0; i < state.smallNodes.length && i < config.smallNodes.length; i++) {
    state.smallNodes[i].rx = config.smallNodes[i].rx;
    state.smallNodes[i].ry = config.smallNodes[i].ry;
  }
}

export function extractMesenteryConfig(state: PhysicsState): MesenteryConfig {
  return {
    largeNodes: state.largeNodes.map(n => ({ rx: n.rx, ry: n.ry })),
    smallNodes: state.smallNodes.map(n => ({ rx: n.rx, ry: n.ry })),
  };
}
