import React, {
  createContext, useContext, useRef, useState, useCallback,
} from 'react';
import { createInitialPhysicsState } from '../engine/intestineInit';
import type { PhysicsState, SegmentProps } from '../engine/physics';
import type { ToolType } from '../constants/gameConfig';
import { TOOLS, N_LARGE, N_SMALL, CAVITY_CX, CAVITY_CY } from '../constants/gameConfig';
import { getRandomDialogue, type DialogueTrigger } from '../constants/dialogues';

export type ScreenName = 'character' | 'simulation' | 'console' | 'settings';

export interface RenderSegment {
  health: number; sensitivity: number; pain: number; pressure: number;
  ruptured: boolean; broken: boolean; perforated: boolean;
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
  viewMode: 'external' | 'internal';
  currentScreen: ScreenName;
  currentDialogue: string | null;
  peristalsisSpeed: number;
  debugMode: boolean;
  showCollisionBoxes: boolean;
  renderSmallNodes: { x: number; y: number }[];
  renderLargeNodes: { x: number; y: number }[];
  renderSmallSegs: RenderSegment[];
  renderLargeSegs: RenderSegment[];
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
  setPeriSpeed: (v: number) => void;
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
  resetPhysics: () => void;
}

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const physicsRef = useRef<PhysicsState>(createInitialPhysicsState());
  const dialogueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [state, setState] = useState<GameUIState>({
    hp: 100, pleasure: 0, heartRate: 72,
    navelPierced: false, intestinalRuptures: 0, intestinalBreaks: 0,
    activeTool: null, toolActive: false, toolParam1: 50, toolParam2: 50,
    viewMode: 'internal', currentScreen: 'simulation',
    currentDialogue: null, peristalsisSpeed: 1.0,
    debugMode: false, showCollisionBoxes: false,
    renderSmallNodes: physicsRef.current.smallNodes.map(n => ({ x: n.x, y: n.y })),
    renderLargeNodes: physicsRef.current.largeNodes.map(n => ({ x: n.x, y: n.y })),
    renderSmallSegs: physicsRef.current.smallSegs.map(s => ({ ...s })),
    renderLargeSegs: physicsRef.current.largeSegs.map(s => ({ ...s })),
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

  const setScreen = useCallback((screen: ScreenName) => {
    setState(prev => ({ ...prev, currentScreen: screen }));
  }, []);

  const setViewMode = useCallback((mode: 'external' | 'internal') => {
    setState(prev => ({ ...prev, viewMode: mode }));
  }, []);

  const setActiveTool = useCallback((tool: ToolType | null) => {
    physicsRef.current.toolType = tool;
    physicsRef.current.toolActive = false;
    physicsRef.current.grabbedNode = null;
    // Clear lever insertion when switching off lever tools
    physicsRef.current.toolAnchor = null;
    physicsRef.current.toolInserted = false;
    // Initialize enema head when selecting enema
    if (tool === TOOLS.ENEMA) {
      physicsRef.current.enemaHeadIdx = Math.floor(N_LARGE / 2);
      physicsRef.current.enemaInSmall = false;
      physicsRef.current.enemaSmallHeadIdx = N_SMALL - 1;
    }
    setState(prev => ({
      ...prev,
      activeTool: tool,
      toolActive: false,
      toolAnchor: null,
      toolInserted: false,
      enemaHeadIdx: physicsRef.current.enemaHeadIdx,
      enemaInSmall: false,
      enemaSmallHeadIdx: N_SMALL - 1,
    }));
  }, []);

  const setToolActive = useCallback((active: boolean) => {
    physicsRef.current.toolActive = active;
    setState(prev => ({ ...prev, toolActive: active }));
  }, []);

  const setToolParam1 = useCallback((v: number) => {
    physicsRef.current.toolParam1 = v;
    setState(prev => ({ ...prev, toolParam1: v }));
  }, []);

  const setToolParam2 = useCallback((v: number) => {
    physicsRef.current.toolParam2 = v;
    setState(prev => ({ ...prev, toolParam2: v }));
  }, []);

  const setPeriSpeed = useCallback((v: number) => {
    physicsRef.current.peristalsisSpeed = v;
    setState(prev => ({ ...prev, peristalsisSpeed: v }));
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

  const resetPhysics = useCallback(() => {
    const fresh = createInitialPhysicsState();
    physicsRef.current = fresh;
    setState(prev => ({
      ...prev,
      hp: 100, pleasure: 0, heartRate: 72,
      navelPierced: false, intestinalRuptures: 0, intestinalBreaks: 0,
      activeTool: null, toolActive: false, toolParam1: 50, toolParam2: 50,
      currentDialogue: null, peristalsisSpeed: 1.0,
      renderSmallNodes: fresh.smallNodes.map(n => ({ x: n.x, y: n.y })),
      renderLargeNodes: fresh.largeNodes.map(n => ({ x: n.x, y: n.y })),
      renderSmallSegs: fresh.smallSegs.map(s => ({ ...s })),
      renderLargeSegs: fresh.largeSegs.map(s => ({ ...s })),
      electrodes: [],
      toolPos: null, toolAnchor: null, toolInserted: false,
      enemaHeadIdx: fresh.enemaHeadIdx,
      enemaInSmall: false,
      enemaSmallHeadIdx: fresh.enemaSmallHeadIdx,
    }));
  }, []);

  return (
    <GameContext.Provider value={{
      state, physicsRef,
      setScreen, setViewMode, setActiveTool, setToolActive,
      setToolParam1, setToolParam2, setPeriSpeed,
      setDebugMode, setShowCollisionBoxes,
      syncFromPhysics, triggerDialogue, addElectrode, clearElectrodes,
      insertViaNavel, retractTool, setNavelPierced, setEnemaHeadIdx,
      setEnemaInSmall, setEnemaSmallHeadIdx, resetPhysics,
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
