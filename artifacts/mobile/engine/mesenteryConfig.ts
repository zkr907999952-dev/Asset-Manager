import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PhysicsState } from './physics';
import { buildSmallIntestineNodes, buildLargeIntestineNodes } from './intestineInit';

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
    const rx = config.largeNodes[i].rx;
    const ry = config.largeNodes[i].ry;
    state.largeNodes[i].rx = rx;
    state.largeNodes[i].ry = ry;
    // Snap current position so effect is immediate in the simulation
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
