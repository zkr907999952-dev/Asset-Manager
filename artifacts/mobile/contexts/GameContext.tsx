import React, {
  createContext, useContext, useRef, useState, useCallback, useEffect,
} from 'react';
import { createInitialPhysicsState } from '../engine/intestineInit';
import type { PhysicsState } from '../engine/physics';
import type { ToolType } from '../constants/gameConfig';
import {
  TOOLS, N_LARGE, N_SMALL, CAVITY_CX, CAVITY_CY,
  BREATH_AMPLITUDE_DEFAULT, EXPANSION_SCALE_DEFAULT,
  PRESSURE_DIFFUSION_RATE_DEFAULT,
  PERISTALSIS_WAVE_AMPLITUDE_DEFAULT, PERISTALSIS_WAVE_SPEED_DEFAULT,
} from '../constants/gameConfig';
import { getRandomDialogue, type DialogueTrigger } from '../constants/dialogues';

export type ScreenName = 'character' | 'simulation' | 'console' | 'settings';

export interface RenderSegment {
  health: number; sensitivity: number; pain: number; pressure: number;
  ruptured: boolean; broken: boolean; perforated: boolean;
}

export interface ToolInstanceState {
  active: boolean;
  param1: number;
  param2: number;
  pos?: { x: number; y: number } | null;
}

export interface GameUIState {
  hp: number;
  pleasure: number;
  heartRate: number;
  navelPierced: boolean;
  intestinalRuptures: number;
  intestinalBreaks: number;
  activeTool: ToolType | null;
  toolActive: boolean;
  toolParam1: number;
  toolParam2: number;
  toolStates: Record<string, ToolInstanceState>;
  pressureDiffusionRate: number;
  viewMode: 'external' | 'internal';
  currentScreen: ScreenName;
  currentDialogue: string | null;
  peristalsisSpeed: number;
  peristalsisWaveAmplitude: number;
  peristalsisWaveSpeed: number;
  breathAmplitude: number;
  expansionScale: number;
  debugMode: boolean;
  showCollisionBoxes: boolean;
  renderSmallNodes: { x: number; y: number }[];
  renderLargeNodes: { x: number; y: number }[];
  renderSmallSegs: RenderSegment[];
  renderLargeSegs: RenderSegment[];
  periScaleSmall: number[];
  periScaleLarge: number[];
  electrodes: { x: number; y: number }[];
  toolPos: { x: number; y: number } | null;
  toolAnchor: { x: number; y: number } | null;
  toolInserted: boolean;
  enemaHeadIdx: number;
  enemaInSmall: boolean;
  enemaSmallHeadIdx: number;
}

interface GameContextType {
  state: GameUIState;
  physicsRef: React.MutableRefObject<PhysicsState>;
  setScreen: (screen: ScreenName) => void;
  setViewMode: (mode: 'external' | 'internal') => void;
  setActiveTool: (tool: ToolType | null) => void;
  setToolActive: (active: boolean) => void;
  setToolParam1: (v: number) => void;
  setToolParam2: (v: number) => void;
  setToolState: (toolId: string, patch: Partial<ToolInstanceState>) => void;
  setPeriSpeed: (v: number) => void;
  setPeriWaveAmplitude: (v: number) => void;
  setPeriWaveSpeed: (v: number) => void;
  setBreathAmplitude: (v: number) => void;
  setExpansionScale: (v: number) => void;
  setPressureDiffusionRate: (v: number) => void;
  setDebugMode: (v: boolean) => void;
  setShowCollisionBoxes: (v: boolean) => void;
  syncFromPhysics: () => void;
  triggerDialogue: (trigger: DialogueTrigger) => void;
  addElectrode: (x: number, y: number) => void;
  clearElectrodes: () => void;
  insertViaNavel: () => void;
  retractTool: () => void;
  setNavelPierced: (v: boolean) => void;
  setEnemaHeadIdx: (idx: number) => void;
  setEnemaInSmall: (v: boolean) => void;
  setEnemaSmallHeadIdx: (idx: number) => void;
  setEnemaTarget: (params: { largeIdx?: number; smallIdx?: number; inSmall?: boolean }) => void;
  resetPhysics: () => void;
  resetPositions: () => void;
}

// Default tool position: slightly above cavity center, so tools activate in a meaningful spot
const DEFAULT_TOOL_POS = { x: CAVITY_CX, y: CAVITY_CY - 40 };

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const physicsRef = useRef<PhysicsState>(createInitialPhysicsState());
  const dialogueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Enema animation: tracks target independently from the animated current position
  const enemaAnimRef = useRef({
    targetLargeIdx: N_LARGE - 1,   // start retracted (at anus)
    targetSmallIdx: N_SMALL - 1,
    targetInSmall: false,
    lastDialogueLargeDepth: -99,   // triggers dialogue every 2 segments
    lastDialogueSmallDepth: -99,
    dialogueFnRef: null as null | ((t: DialogueTrigger) => void),
  });

  const [state, setState] = useState<GameUIState>({
    hp: 100, pleasure: 0, heartRate: 72,
    navelPierced: false, intestinalRuptures: 0, intestinalBreaks: 0,
    activeTool: null, toolActive: false, toolParam1: 50, toolParam2: 50,
    toolStates: physicsRef.current.toolStates,
    pressureDiffusionRate: physicsRef.current.pressureDiffusionRate,
    viewMode: 'internal', currentScreen: 'simulation',
    currentDialogue: null, peristalsisSpeed: 1.0,
    peristalsisWaveAmplitude: PERISTALSIS_WAVE_AMPLITUDE_DEFAULT,
    peristalsisWaveSpeed: PERISTALSIS_WAVE_SPEED_DEFAULT,
    breathAmplitude: BREATH_AMPLITUDE_DEFAULT,
    expansionScale: EXPANSION_SCALE_DEFAULT,
    debugMode: false, showCollisionBoxes: false,
    renderSmallNodes: physicsRef.current.smallNodes.map(n => ({ x: n.x, y: n.y })),
    renderLargeNodes: physicsRef.current.largeNodes.map(n => ({ x: n.x, y: n.y })),
    renderSmallSegs: physicsRef.current.smallSegs.map(s => ({ ...s })),
    renderLargeSegs: physicsRef.current.largeSegs.map(s => ({ ...s })),
    periScaleSmall: [...physicsRef.current.periScaleSmall],
    periScaleLarge: [...physicsRef.current.periScaleLarge],
    electrodes: [],
    toolPos: null,
    toolAnchor: null,
    toolInserted: false,
    enemaHeadIdx: physicsRef.current.enemaHeadIdx,
    enemaInSmall: false,
    enemaSmallHeadIdx: physicsRef.current.enemaSmallHeadIdx,
  });

  const syncFromPhysics = useCallback(() => {
    const p = physicsRef.current;
    const smallSegs = p.smallSegs;
    const largeSegs = p.largeSegs;

    const totalPain = smallSegs.reduce((a, s) => a + s.pain, 0) / smallSegs.length;
    const totalSens = smallSegs.reduce((a, s) => a + s.sensitivity, 0) / smallSegs.length;
    const totalPressure = smallSegs.reduce((a, s) => a + s.pressure, 0) / smallSegs.length;
    const ruptures = [...smallSegs, ...largeSegs].filter(s => s.ruptured).length;
    const breaks = [...smallSegs, ...largeSegs].filter(s => s.broken).length;

    const hp = Math.max(0, 100 - totalPain * 0.7 - breaks * 5);
    const pleasure = Math.min(100, totalSens * 0.6 + (totalPressure > 40 ? (totalPressure - 40) * 0.5 : 0));
    const heartRate = Math.round(72 + totalPain * 0.8 + pleasure * 0.4);

    setState(prev => ({
      ...prev,
      hp, pleasure, heartRate,
      intestinalRuptures: ruptures,
      intestinalBreaks: breaks,
      renderSmallNodes: p.smallNodes.map(n => ({ x: n.x, y: n.y })),
      renderLargeNodes: p.largeNodes.map(n => ({ x: n.x, y: n.y })),
      renderSmallSegs: smallSegs.map(s => ({ ...s })),
      renderLargeSegs: largeSegs.map(s => ({ ...s })),
      periScaleSmall: [...p.periScaleSmall],
      periScaleLarge: [...p.periScaleLarge],
      toolPos: p.toolPos ? { ...p.toolPos } : null,
      toolAnchor: p.toolAnchor ? { ...p.toolAnchor } : null,
      toolInserted: p.toolInserted,
      navelPierced: p.navelPierced,
      enemaHeadIdx: p.enemaHeadIdx,
      enemaInSmall: p.enemaInSmall,
      enemaSmallHeadIdx: p.enemaSmallHeadIdx,
      electrodes: [...p.electrodes],
    }));
  }, []);

  const triggerDialogue = useCallback((trigger: DialogueTrigger) => {
    const text = getRandomDialogue(trigger);
    if (dialogueTimerRef.current) clearTimeout(dialogueTimerRef.current);
    setState(prev => ({ ...prev, currentDialogue: text }));
    dialogueTimerRef.current = setTimeout(() => {
      setState(prev => ({ ...prev, currentDialogue: null }));
    }, 3500);
  }, []);

  // Keep a ref to triggerDialogue so the animation interval has stable access
  const triggerDialogueRef = useRef(triggerDialogue);
  triggerDialogueRef.current = triggerDialogue;
  enemaAnimRef.current.dialogueFnRef = triggerDialogue;

  // Enema insertion/retraction animation — 1 segment per 300ms, dialogue every 2 segments
  useEffect(() => {
    const STEP_MS = 300;
    const timer = setInterval(() => {
      const anim = enemaAnimRef.current;
      const p = physicsRef.current;

      // Only animate if enema tool is active (current or secondary)
      const enemaToolState = p.toolStates['灌肠器'];
      const enemaActive = p.toolType === '灌肠器' || enemaToolState?.active === true;
      if (!enemaActive) return;

      const td = triggerDialogueRef.current;
      const curLarge = p.enemaHeadIdx;
      const curSmall = p.enemaSmallHeadIdx;
      const curInSmall = p.enemaInSmall;

      if (!curInSmall && !anim.targetInSmall) {
        // Both in large — animate toward target
        if (curLarge === anim.targetLargeIdx) return;
        const dir = anim.targetLargeIdx < curLarge ? -1 : 1; // -1=insert deeper, +1=retract
        const newIdx = Math.max(0, Math.min(N_LARGE - 1, curLarge + dir));

        // Depth: 0=entry (anus), N_LARGE-1=deepest (cecum)
        // Large idx 29=anus(entry), 0=cecum(deepest) → depth = N_LARGE-1 - newIdx
        const depth = N_LARGE - 1 - newIdx;
        if (Math.abs(depth - anim.lastDialogueLargeDepth) >= 2) {
          anim.lastDialogueLargeDepth = depth;
          if (dir === -1) { // inserting
            if (depth <= 8) td('enema_large_shallow');
            else if (depth <= 20) td('enema_large_medium');
            else td('enema_large_deep');
          } else { // retracting
            td('enema_retract');
          }
        }
        p.enemaHeadIdx = newIdx;
        setState(prev => ({ ...prev, enemaHeadIdx: newIdx }));

      } else if (!curInSmall && anim.targetInSmall) {
        // Transition: must reach cecum (idx 0) first, then enter small
        if (curLarge > 0) {
          const newIdx = curLarge - 1;
          const depth = N_LARGE - 1 - newIdx;
          if (Math.abs(depth - anim.lastDialogueLargeDepth) >= 2) {
            anim.lastDialogueLargeDepth = depth;
            td('enema_large_deep');
          }
          p.enemaHeadIdx = newIdx;
          setState(prev => ({ ...prev, enemaHeadIdx: newIdx }));
        } else {
          // Now cross into small intestine
          p.enemaInSmall = true;
          p.enemaSmallHeadIdx = N_SMALL - 1;
          anim.lastDialogueSmallDepth = -99;
          td('enema_enter_small');
          setState(prev => ({ ...prev, enemaInSmall: true, enemaSmallHeadIdx: N_SMALL - 1 }));
        }

      } else if (curInSmall && !anim.targetInSmall) {
        // Retract from small back to large
        if (curSmall < N_SMALL - 1) {
          const newIdx = curSmall + 1;
          const depth = N_SMALL - 1 - newIdx;
          if (Math.abs(depth - anim.lastDialogueSmallDepth) >= 2) {
            anim.lastDialogueSmallDepth = depth;
            td('enema_retract');
          }
          p.enemaSmallHeadIdx = newIdx;
          setState(prev => ({ ...prev, enemaSmallHeadIdx: newIdx }));
        } else {
          // Exit small intestine
          p.enemaInSmall = false;
          p.enemaSmallHeadIdx = N_SMALL - 1;
          p.enemaHeadIdx = 0; // at cecum junction
          anim.lastDialogueSmallDepth = -99;
          setState(prev => ({ ...prev, enemaInSmall: false, enemaSmallHeadIdx: N_SMALL - 1, enemaHeadIdx: 0 }));
        }

      } else if (curInSmall && anim.targetInSmall) {
        // Animate inside small intestine
        if (curSmall === anim.targetSmallIdx) return;
        const dir = anim.targetSmallIdx < curSmall ? -1 : 1; // -1=deeper, +1=retract
        const newIdx = Math.max(0, Math.min(N_SMALL - 1, curSmall + dir));

        const depth = N_SMALL - 1 - newIdx; // 0=entry(terminal ileum), N_SMALL-1=deepest
        if (Math.abs(depth - anim.lastDialogueSmallDepth) >= 2) {
          anim.lastDialogueSmallDepth = depth;
          if (dir === -1) {
            if (depth <= 10) td('enema_small_shallow');
            else if (depth <= 24) td('enema_small_medium');
            else td('enema_small_deep');
          } else {
            td('enema_retract');
          }
        }
        p.enemaSmallHeadIdx = newIdx;
        setState(prev => ({ ...prev, enemaSmallHeadIdx: newIdx }));
      }
    }, STEP_MS);
    return () => clearInterval(timer);
  }, []);

  const setScreen = useCallback((screen: ScreenName) => {
    setState(prev => ({ ...prev, currentScreen: screen }));
  }, []);

  const setViewMode = useCallback((mode: 'external' | 'internal') => {
    setState(prev => ({ ...prev, viewMode: mode }));
  }, []);

  const setActiveTool = useCallback((tool: ToolType | null) => {
    const p = physicsRef.current;

    // Save current tool's last position before switching
    const prevTool = p.toolType;
    if (prevTool && p.toolStates[prevTool]) {
      p.toolStates[prevTool].pos = p.toolPos ? { ...p.toolPos } : null;
    }

    p.toolType = tool;
    p.grabbedNode = null;
    p.toolAnchor = null;
    p.toolInserted = false;

    if (tool) {
      const ts = p.toolStates[tool] ?? { active: false, param1: 50, param2: 50 };
      p.toolActive = ts.active;
      p.toolParam1 = ts.param1;
      p.toolParam2 = ts.param2;
      // Restore last position for this tool if it had one
      if (ts.pos) {
        p.toolPos = { ...ts.pos };
      } else if (ts.active && !p.toolPos) {
        // Tool was active but has no stored pos — give it a default
        p.toolPos = { ...DEFAULT_TOOL_POS };
      }
      setState(prev => ({
        ...prev,
        activeTool: tool,
        toolActive: ts.active,
        toolParam1: ts.param1,
        toolParam2: ts.param2,
        toolAnchor: null,
        toolInserted: false,
        toolPos: p.toolPos ? { ...p.toolPos } : null,
        enemaHeadIdx: p.enemaHeadIdx,
      }));
    } else {
      p.toolActive = false;
      setState(prev => ({
        ...prev,
        activeTool: null,
        toolActive: false,
        toolAnchor: null,
        toolInserted: false,
      }));
    }
  }, []);

  const setToolActive = useCallback((active: boolean) => {
    const p = physicsRef.current;
    p.toolActive = active;

    // If activating with no position set, give a default position
    if (active && !p.toolPos) {
      p.toolPos = { ...DEFAULT_TOOL_POS };
    }

    const toolId = p.toolType;
    if (toolId && p.toolStates[toolId]) {
      p.toolStates[toolId].active = active;
      if (active && p.toolPos) {
        p.toolStates[toolId].pos = { ...p.toolPos };
      }
    }
    setState(prev => {
      const newToolStates = { ...prev.toolStates };
      if (prev.activeTool && newToolStates[prev.activeTool]) {
        newToolStates[prev.activeTool] = {
          ...newToolStates[prev.activeTool],
          active,
          pos: active && p.toolPos ? { ...p.toolPos } : newToolStates[prev.activeTool].pos,
        };
      }
      return {
        ...prev,
        toolActive: active,
        toolStates: newToolStates,
        toolPos: p.toolPos ? { ...p.toolPos } : prev.toolPos,
      };
    });
  }, []);

  const setToolParam1 = useCallback((v: number) => {
    physicsRef.current.toolParam1 = v;
    const toolId = physicsRef.current.toolType;
    if (toolId && physicsRef.current.toolStates[toolId]) {
      physicsRef.current.toolStates[toolId].param1 = v;
    }
    setState(prev => {
      const newToolStates = { ...prev.toolStates };
      if (prev.activeTool && newToolStates[prev.activeTool]) {
        newToolStates[prev.activeTool] = { ...newToolStates[prev.activeTool], param1: v };
      }
      return { ...prev, toolParam1: v, toolStates: newToolStates };
    });
  }, []);

  const setToolParam2 = useCallback((v: number) => {
    physicsRef.current.toolParam2 = v;
    const toolId = physicsRef.current.toolType;
    if (toolId && physicsRef.current.toolStates[toolId]) {
      physicsRef.current.toolStates[toolId].param2 = v;
    }
    setState(prev => {
      const newToolStates = { ...prev.toolStates };
      if (prev.activeTool && newToolStates[prev.activeTool]) {
        newToolStates[prev.activeTool] = { ...newToolStates[prev.activeTool], param2: v };
      }
      return { ...prev, toolParam2: v, toolStates: newToolStates };
    });
  }, []);

  const setToolState = useCallback((toolId: string, patch: Partial<ToolInstanceState>) => {
    const p = physicsRef.current;
    if (p.toolStates[toolId]) {
      p.toolStates[toolId] = { ...p.toolStates[toolId], ...patch };
    }
    // If activating via setToolState and no pos yet, set default
    if (patch.active === true && !p.toolStates[toolId]?.pos && !p.toolPos) {
      if (p.toolStates[toolId]) p.toolStates[toolId].pos = { ...DEFAULT_TOOL_POS };
      if (p.toolType === toolId) p.toolPos = { ...DEFAULT_TOOL_POS };
    }
    setState(prev => {
      const newToolStates = { ...prev.toolStates };
      if (newToolStates[toolId]) {
        newToolStates[toolId] = { ...newToolStates[toolId], ...patch };
      }
      const updates: Partial<GameUIState> = { toolStates: newToolStates };
      if (prev.activeTool === toolId) {
        if (patch.active !== undefined) {
          updates.toolActive = patch.active;
          p.toolActive = patch.active;
          if (patch.active && !p.toolPos) {
            p.toolPos = { ...DEFAULT_TOOL_POS };
            updates.toolPos = { ...DEFAULT_TOOL_POS };
          }
        }
        if (patch.param1 !== undefined) {
          updates.toolParam1 = patch.param1;
          p.toolParam1 = patch.param1;
        }
        if (patch.param2 !== undefined) {
          updates.toolParam2 = patch.param2;
          p.toolParam2 = patch.param2;
        }
      }
      return { ...prev, ...updates };
    });
  }, []);

  const setPeriSpeed = useCallback((v: number) => {
    physicsRef.current.peristalsisSpeed = v;
    setState(prev => ({ ...prev, peristalsisSpeed: v }));
  }, []);

  const setPeriWaveAmplitude = useCallback((v: number) => {
    physicsRef.current.peristalsisWaveAmplitude = v;
    setState(prev => ({ ...prev, peristalsisWaveAmplitude: v }));
  }, []);

  const setPeriWaveSpeed = useCallback((v: number) => {
    physicsRef.current.peristalsisWaveSpeed = v;
    setState(prev => ({ ...prev, peristalsisWaveSpeed: v }));
  }, []);

  const setBreathAmplitude = useCallback((v: number) => {
    setState(prev => ({ ...prev, breathAmplitude: v }));
  }, []);

  const setExpansionScale = useCallback((v: number) => {
    physicsRef.current.expansionScale = v;
    setState(prev => ({ ...prev, expansionScale: v }));
  }, []);

  const setPressureDiffusionRate = useCallback((v: number) => {
    physicsRef.current.pressureDiffusionRate = v;
    setState(prev => ({ ...prev, pressureDiffusionRate: v }));
  }, []);

  const setDebugMode = useCallback((v: boolean) => {
    setState(prev => ({ ...prev, debugMode: v }));
  }, []);

  const setShowCollisionBoxes = useCallback((v: boolean) => {
    setState(prev => ({ ...prev, showCollisionBoxes: v }));
  }, []);

  const addElectrode = useCallback((x: number, y: number) => {
    if (physicsRef.current.electrodes.length >= 8) {
      physicsRef.current.electrodes.shift();
    }
    physicsRef.current.electrodes.push({ x, y });
    setState(prev => ({ ...prev, electrodes: [...physicsRef.current.electrodes] }));
  }, []);

  const clearElectrodes = useCallback(() => {
    physicsRef.current.electrodes = [];
    setState(prev => ({ ...prev, electrodes: [] }));
  }, []);

  const insertViaNavel = useCallback(() => {
    physicsRef.current.toolAnchor = { x: CAVITY_CX, y: CAVITY_CY };
    physicsRef.current.toolInserted = true;
    setState(prev => ({
      ...prev,
      toolAnchor: { x: CAVITY_CX, y: CAVITY_CY },
      toolInserted: true,
      viewMode: 'internal',
    }));
  }, []);

  const retractTool = useCallback(() => {
    physicsRef.current.toolAnchor = null;
    physicsRef.current.toolInserted = false;
    setState(prev => ({ ...prev, toolAnchor: null, toolInserted: false }));
  }, []);

  const setNavelPierced = useCallback((v: boolean) => {
    physicsRef.current.navelPierced = v;
    setState(prev => ({ ...prev, navelPierced: v }));
  }, []);

  const setEnemaHeadIdx = useCallback((idx: number) => {
    const clamped = Math.max(0, Math.min(N_LARGE - 1, Math.floor(idx)));
    physicsRef.current.enemaHeadIdx = clamped;
    setState(prev => ({ ...prev, enemaHeadIdx: clamped }));
  }, []);

  const setEnemaInSmall = useCallback((v: boolean) => {
    physicsRef.current.enemaInSmall = v;
    if (!v) {
      physicsRef.current.enemaSmallHeadIdx = N_SMALL - 1;
    }
    setState(prev => ({
      ...prev,
      enemaInSmall: v,
      enemaSmallHeadIdx: v ? prev.enemaSmallHeadIdx : N_SMALL - 1,
    }));
  }, []);

  const setEnemaSmallHeadIdx = useCallback((idx: number) => {
    const clamped = Math.max(0, Math.min(N_SMALL - 1, Math.floor(idx)));
    physicsRef.current.enemaSmallHeadIdx = clamped;
    setState(prev => ({ ...prev, enemaSmallHeadIdx: clamped }));
  }, []);

  // Set the target for enema animation — the head will smoothly animate toward this
  const setEnemaTarget = useCallback((params: { largeIdx?: number; smallIdx?: number; inSmall?: boolean }) => {
    const anim = enemaAnimRef.current;
    if (params.largeIdx !== undefined) {
      anim.targetLargeIdx = Math.max(0, Math.min(N_LARGE - 1, params.largeIdx));
    }
    if (params.smallIdx !== undefined) {
      anim.targetSmallIdx = Math.max(0, Math.min(N_SMALL - 1, params.smallIdx));
    }
    if (params.inSmall !== undefined) {
      anim.targetInSmall = params.inSmall;
    }
  }, []);

  const resetPhysics = useCallback(() => {
    const fresh = createInitialPhysicsState();
    physicsRef.current = fresh;
    setState(prev => ({
      ...prev,
      hp: 100, pleasure: 0, heartRate: 72,
      navelPierced: false, intestinalRuptures: 0, intestinalBreaks: 0,
      activeTool: null, toolActive: false, toolParam1: 50, toolParam2: 50,
      toolStates: fresh.toolStates,
      pressureDiffusionRate: fresh.pressureDiffusionRate,
      currentDialogue: null, peristalsisSpeed: 1.0,
      peristalsisWaveAmplitude: PERISTALSIS_WAVE_AMPLITUDE_DEFAULT,
      peristalsisWaveSpeed: PERISTALSIS_WAVE_SPEED_DEFAULT,
      breathAmplitude: BREATH_AMPLITUDE_DEFAULT,
      expansionScale: EXPANSION_SCALE_DEFAULT,
      renderSmallNodes: fresh.smallNodes.map(n => ({ x: n.x, y: n.y })),
      renderLargeNodes: fresh.largeNodes.map(n => ({ x: n.x, y: n.y })),
      renderSmallSegs: fresh.smallSegs.map(s => ({ ...s })),
      renderLargeSegs: fresh.largeSegs.map(s => ({ ...s })),
      periScaleSmall: [...fresh.periScaleSmall],
      periScaleLarge: [...fresh.periScaleLarge],
      electrodes: [],
      toolPos: null, toolAnchor: null, toolInserted: false,
      enemaHeadIdx: fresh.enemaHeadIdx,
      enemaInSmall: false,
      enemaSmallHeadIdx: fresh.enemaSmallHeadIdx,
    }));
  }, []);

  const resetPositions = useCallback(() => {
    const fresh = createInitialPhysicsState();
    const p = physicsRef.current;
    p.smallNodes = fresh.smallNodes;
    p.largeNodes = fresh.largeNodes;
    p.smallSegs = fresh.smallSegs;
    p.largeSegs = fresh.largeSegs;
    p.time = 0;
    setState(prev => ({
      ...prev,
      renderSmallNodes: fresh.smallNodes.map(n => ({ x: n.x, y: n.y })),
      renderLargeNodes: fresh.largeNodes.map(n => ({ x: n.x, y: n.y })),
      renderSmallSegs: fresh.smallSegs.map(s => ({ ...s })),
      renderLargeSegs: fresh.largeSegs.map(s => ({ ...s })),
      intestinalRuptures: 0,
      intestinalBreaks: 0,
    }));
  }, []);

  return (
    <GameContext.Provider value={{
      state, physicsRef,
      setScreen, setViewMode, setActiveTool, setToolActive,
      setToolParam1, setToolParam2, setToolState, setPeriSpeed,
      setPeriWaveAmplitude, setPeriWaveSpeed,
      setBreathAmplitude, setExpansionScale, setPressureDiffusionRate,
      setDebugMode, setShowCollisionBoxes,
      syncFromPhysics, triggerDialogue, addElectrode, clearElectrodes,
      insertViaNavel, retractTool, setNavelPierced, setEnemaHeadIdx,
      setEnemaInSmall, setEnemaSmallHeadIdx, setEnemaTarget,
      resetPhysics, resetPositions,
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
