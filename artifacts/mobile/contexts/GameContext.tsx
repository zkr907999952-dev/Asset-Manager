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
  MAX_RESECTION_SEGMENTS_DEFAULT,
} from '../constants/gameConfig';
import { getRandomDialogue, type DialogueTrigger } from '../constants/dialogues';
import type { ComaState } from '../components/HeartRateMonitor';

export interface ParasiteEntity {
  id: number;
  phase: 'egg_traveling' | 'egg_hatching' | 'worm';
  intestine: 'small' | 'large';
  segIdx: number;
  targetIntestine: 'small' | 'large';
  targetSegIdx: number;
  hatchStartTime: number;
  hatchDurationMs: number;
  wormLength: number;
  lastGrowTime: number;
  lastDamageTime: number;
  isFreeMoving: boolean;
  freeMoveIntestine: 'small' | 'large';
  freeMoveTarget: number;
  freeMoveWaitUntil: number;
  lastMoveStepTime: number;
  wormColor: { r: number; g: number; b: number };
  lateralOffset: number;
  bornAt: number;
  movingDir: 1 | -1;
  crossDirection: 'smallToLarge' | 'largeToSmall' | null;
}

function getParasiteOccupiedSegs(par: ParasiteEntity): { intestine: 'small' | 'large'; seg: number }[] {
  if (par.phase !== 'worm') {
    const maxSeg = par.intestine === 'small' ? N_SMALL - 2 : N_LARGE - 2;
    return [{ intestine: par.intestine, seg: Math.max(0, Math.min(maxSeg, par.segIdx)) }];
  }
  const segs: { intestine: 'small' | 'large'; seg: number }[] = [];
  for (let i = 0; i < par.wormLength; i++) {
    if (par.crossDirection === 'smallToLarge') {
      const largeIdx = par.segIdx - i;
      if (largeIdx >= 0) {
        segs.push({ intestine: 'large', seg: Math.min(N_LARGE - 2, largeIdx) });
      } else {
        const smallIdx = N_SMALL - 1 + largeIdx;
        if (smallIdx >= 0) segs.push({ intestine: 'small', seg: Math.min(N_SMALL - 2, smallIdx) });
      }
    } else if (par.crossDirection === 'largeToSmall') {
      const smallIdx = par.segIdx + i;
      if (smallIdx <= N_SMALL - 2) {
        segs.push({ intestine: 'small', seg: smallIdx });
      } else {
        const largeIdx = smallIdx - (N_SMALL - 1);
        if (largeIdx >= 0 && largeIdx <= N_LARGE - 2) segs.push({ intestine: 'large', seg: largeIdx });
      }
    } else {
      const maxSeg = par.intestine === 'small' ? N_SMALL - 2 : N_LARGE - 2;
      const s = par.segIdx - i;
      if (s >= 0 && s <= maxSeg) segs.push({ intestine: par.intestine, seg: s });
    }
  }
  return segs;
}

function getReachableRange(segIdx: number, intestine: 'small' | 'large', p: { smallSegs: { broken?: boolean }[]; largeSegs: { broken?: boolean }[] }): {
  leftLimit: number; rightLimit: number; canCrossToLarge: boolean; canCrossToSmall: boolean;
} {
  const segs = intestine === 'small' ? p.smallSegs : p.largeSegs;
  const maxSeg = intestine === 'small' ? N_SMALL - 2 : N_LARGE - 2;
  let rightLimit = segIdx;
  while (rightLimit < maxSeg && !segs[rightLimit + 1]?.broken) rightLimit++;
  let leftLimit = segIdx;
  while (leftLimit > 0 && !segs[leftLimit - 1]?.broken) leftLimit--;
  const canCrossToLarge = intestine === 'small' && rightLimit >= N_SMALL - 2
    && !p.smallSegs[N_SMALL - 2]?.broken && !p.largeSegs[0]?.broken;
  const canCrossToSmall = intestine === 'large' && leftLimit === 0
    && !p.largeSegs[0]?.broken && !p.smallSegs[N_SMALL - 2]?.broken;
  return { leftLimit, rightLimit, canCrossToLarge, canCrossToSmall };
}

export type ScreenName = 'character' | 'simulation' | 'console' | 'settings' | 'help';

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
  // === Silicone rod — independent state ===
  siliconeHeadIdx: number;
  siliconeInSmall: boolean;
  siliconeSmallHeadIdx: number;
  // === Anal beads — independent state ===
  beadsHeadIdx: number;
  beadsInSmall: boolean;
  beadsSmallHeadIdx: number;
  beadsChain: { x: number; y: number; vx: number; vy: number }[];
  // === Vibrating egg — enters from duodenum (small node 0) ===
  eggSmallHeadIdx: number;
  eggInLarge: boolean;
  eggLargeHeadIdx: number;
  hpBonus: number;
  repairMarks: number[];
  sutureMarks: number[];
  largeRepairMarks: number[];
  largeSutureMarks: number[];
  mesenteryDisabled: number[];
  smallMesenteryDisabled: number[];
  smallTransplantColor: { r: number; g: number; b: number } | null;
  largeTransplantColor: { r: number; g: number; b: number } | null;
  mesenterySelectionMode: boolean;
  mesenterySelectedNodes: number[];
  smallMesenterySelectedNodes: number[];
  smallTransplantCount: number;
  largeTransplantCount: number;
  // Drug / coma system
  comaState: ComaState;
  heartRateModifier: number;
  peristalsisModifier: number;
  drugDurationSec: number;
  stimulantTimeLeft: number;
  sedativeTimeLeft: number;
  // Parasite system
  parasites: ParasiteEntity[];
  hatchDurationSec: number;
  parasiteSurgeryPhase: 0 | 1 | 2 | 3;
  parasiteDamageIntervalSec: number;
  parasitePerforationChance: number;
  // Resection surgery
  resectionSelectionMode: boolean;
  resectionIntestine: 'small' | 'large' | null;
  resectionStartSeg: number;
  resectionEndSeg: number;
  resectionSurgeryPhase: 0 | 1 | 2 | 3;
  maxResectionSegments: number;
  resectedSmallRanges: { start: number; end: number }[];
  resectedLargeRanges: { start: number; end: number }[];
  resectedCount: number;
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
  setSiliconeTarget: (params: { largeIdx?: number; inSmall?: boolean; smallIdx?: number }) => void;
  setBeadsTarget: (params: { largeIdx?: number; inSmall?: boolean; smallIdx?: number; fastPull?: boolean }) => void;
  setEggTarget: (params: { smallIdx?: number; inLarge?: boolean; largeIdx?: number }) => void;
  resetPhysics: () => void;
  resetPositions: () => void;
  relaxAbdomen: () => void;
  takeLaxative: () => void;
  takeStimulant: () => void;
  takeSedative: () => void;
  clearComaByShock: () => void;
  setDrugDuration: (v: number) => void;
  performFirstAid: () => void;
  startTransfusion: () => void;
  repairIntestine: () => void;
  sutureIntestine: () => void;
  performNavelSurgery: () => void;
  transplantSmallIntestine: () => void;
  transplantLargeIntestine: () => void;
  transplantAllIntestines: () => void;
  enterMesenterySelection: () => void;
  executeMesenterySelection: () => void;
  cancelMesenterySelection: () => void;
  toggleMesenteryNode: (idx: number, isSmall?: boolean) => void;
  takeParasiteEgg: () => void;
  setHatchDuration: (v: number) => void;
  setParasiteDamageInterval: (v: number) => void;
  setParasitePerforationChance: (v: number) => void;
  performParasiteSurgery: () => void;
  enterResectionSelection: () => void;
  cancelResectionSelection: () => void;
  performResectionSurgery: () => void;
  setResectionSelection: (intestine: 'small' | 'large', startSeg: number, endSeg: number) => void;
  setMaxResectionSegments: (v: number) => void;
}

const DEFAULT_TOOL_POS = { x: CAVITY_CX, y: CAVITY_CY - 40 };

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const physicsRef = useRef<PhysicsState>(createInitialPhysicsState());
  const dialogueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const comaStateRef = useRef<ComaState>('none');

  // Drug system state (ref for timestamp logs, modifier values mirrored to UI state)
  const drugRef = useRef({
    stimHRMod: 0,
    stimBreathMod: 0,
    stimPeriMod: 0,
    sedHRMod: 0,
    sedBreathMod: 0,
    sedPainMod: 0,
    heartRateModifier: 0,
    breathModifier: 0,
    peristalsisModifier: 0,
    painModifier: 0,
    stimulantLog: [] as number[],
    sedativeLog: [] as number[],
    stimulantExpiry: 0,
    sedativeExpiry: 0,
    durationSec: 120,
  });

  const enemaAnimRef = useRef({
    targetLargeIdx: N_LARGE - 1,
    targetSmallIdx: N_SMALL - 1,
    targetInSmall: false,
    lastDialogueLargeDepth: -99,
    lastDialogueSmallDepth: -99,
    dialogueFnRef: null as null | ((t: DialogueTrigger) => void),
  });

  const siliconeAnimRef = useRef({
    targetLargeIdx: N_LARGE - 1,
    targetSmallIdx: N_SMALL - 1,
    targetInSmall: false,
    lastDialogueLargeDepth: -99,
    lastDialogueSmallDepth: -99,
    lastStepTime: 0,
  });

  const beadsAnimRef = useRef({
    targetLargeIdx: N_LARGE - 1,
    targetSmallIdx: N_SMALL - 1,
    targetInSmall: false,
    lastDialogueLargeDepth: -99,
    lastDialogueSmallDepth: -99,
    lastStepTime: 0,
    fastPull: false,
  });

  const eggAnimRef = useRef({
    targetSmallIdx: 0,
    targetInLarge: false,
    targetLargeIdx: 0,
    lastStepTime: 0,
  });

  const parasiteRef = useRef<ParasiteEntity[]>([]);
  const parasiteIdRef = useRef(0);
  const hatchDurationRef = useRef(9);
  const parasiteDamageIntervalRef = useRef(12);
  const parasitePerforationChanceRef = useRef(0.25);
  const parasiteSurgeryPhaseRef = useRef<0 | 1 | 2 | 3>(0);
  const maxResectionSegmentsRef = useRef(MAX_RESECTION_SEGMENTS_DEFAULT);
  const resectionSurgeryPhaseRef = useRef<0 | 1 | 2 | 3>(0);
  const resectionIntestineRef = useRef<'small' | 'large' | null>(null);
  const resectionStartSegRef = useRef(-1);
  const resectionEndSegRef = useRef(-1);
  const lastAutoEggTimeRef = useRef<number>(0);

  const [state, setState] = useState<GameUIState>({
    hp: 100, pleasure: 0, heartRate: 72,
    navelPierced: false, intestinalRuptures: 0, intestinalBreaks: 0,
    activeTool: null, toolActive: false, toolParam1: 50, toolParam2: 50,
    toolStates: physicsRef.current.toolStates,
    pressureDiffusionRate: physicsRef.current.pressureDiffusionRate,
    viewMode: 'internal', currentScreen: 'simulation',
    currentDialogue: null, peristalsisSpeed: 1.5,
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
    siliconeHeadIdx: physicsRef.current.siliconeHeadIdx,
    siliconeInSmall: false,
    siliconeSmallHeadIdx: physicsRef.current.siliconeSmallHeadIdx,
    beadsHeadIdx: physicsRef.current.beadsHeadIdx,
    beadsInSmall: false,
    beadsSmallHeadIdx: physicsRef.current.beadsSmallHeadIdx,
    beadsChain: [],
    eggSmallHeadIdx: 0,
    eggInLarge: false,
    eggLargeHeadIdx: 0,
    hpBonus: 0,
    repairMarks: [],
    sutureMarks: [],
    largeRepairMarks: [],
    largeSutureMarks: [],
    mesenteryDisabled: [],
    smallMesenteryDisabled: [],
    smallTransplantColor: null,
    largeTransplantColor: null,
    mesenterySelectionMode: false,
    mesenterySelectedNodes: [],
    smallMesenterySelectedNodes: [],
    smallTransplantCount: 0,
    largeTransplantCount: 0,
    comaState: 'none',
    heartRateModifier: 0,
    peristalsisModifier: 0,
    drugDurationSec: 120,
    stimulantTimeLeft: 0,
    sedativeTimeLeft: 0,
    parasites: [],
    hatchDurationSec: 9,
    parasiteSurgeryPhase: 0,
    parasiteDamageIntervalSec: 12,
    parasitePerforationChance: 0.25,
    resectionSelectionMode: false,
    resectionIntestine: null,
    resectionStartSeg: -1,
    resectionEndSeg: -1,
    resectionSurgeryPhase: 0,
    maxResectionSegments: MAX_RESECTION_SEGMENTS_DEFAULT,
    resectedSmallRanges: [],
    resectedLargeRanges: [],
    resectedCount: 0,
  });

  const syncFromPhysics = useCallback(() => {
    const p = physicsRef.current;
    const smallSegs = p.smallSegs;
    const largeSegs = p.largeSegs;
    const drug = drugRef.current;
    const coma = comaStateRef.current;
    const now = Date.now();

    // Drug expiry checks — zero out individual drug modifiers when timer ends
    if (drug.stimulantExpiry > 0 && now > drug.stimulantExpiry) {
      drug.stimHRMod = 0;
      drug.stimBreathMod = 0;
      drug.stimPeriMod = 0;
      drug.stimulantExpiry = 0;
      drug.heartRateModifier = drug.stimHRMod + drug.sedHRMod;
      drug.breathModifier = drug.stimBreathMod + drug.sedBreathMod;
      drug.peristalsisModifier = drug.stimPeriMod;
    }
    if (drug.sedativeExpiry > 0 && now > drug.sedativeExpiry) {
      drug.sedHRMod = 0;
      drug.sedBreathMod = 0;
      drug.sedPainMod = 0;
      drug.sedativeExpiry = 0;
      drug.heartRateModifier = drug.stimHRMod + drug.sedHRMod;
      drug.breathModifier = drug.stimBreathMod + drug.sedBreathMod;
      drug.painModifier = drug.sedPainMod;
    }
    const stimTL = drug.stimulantExpiry > 0 ? Math.max(0, Math.ceil((drug.stimulantExpiry - now) / 1000)) : 0;
    const sedTL = drug.sedativeExpiry > 0 ? Math.max(0, Math.ceil((drug.sedativeExpiry - now) / 1000)) : 0;

    const rawPain = smallSegs.reduce((a, s) => a + s.pain, 0) / smallSegs.length;
    const totalPain = Math.max(0, rawPain + drug.painModifier);
    const totalSens = smallSegs.reduce((a, s) => a + s.sensitivity, 0) / smallSegs.length;
    const totalPressure = smallSegs.reduce((a, s) => a + s.pressure, 0) / smallSegs.length;
    const ruptures = [...smallSegs, ...largeSegs].filter(s => s.ruptured).length;
    const breaks = [...smallSegs, ...largeSegs].filter(s => s.broken).length;

    const hp = Math.min(100, Math.max(0, 100 - totalPain * 0.7 - breaks * 5 + (p.hpBonus ?? 0)));
    const pleasure = Math.min(100, totalSens * 0.6 + (totalPressure > 40 ? (totalPressure - 40) * 0.5 : 0));

    let heartRate: number;
    if (coma === 'tachycardia') {
      heartRate = 175 + Math.floor(Math.random() * 20);
    } else if (coma === 'bradycardia') {
      heartRate = 25 + Math.floor(Math.random() * 10);
    } else {
      heartRate = Math.round(72 + rawPain * 0.8 + pleasure * 0.4 + drug.heartRateModifier);
      heartRate = Math.max(20, Math.min(240, heartRate));
    }

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
      siliconeHeadIdx: p.siliconeHeadIdx,
      siliconeInSmall: p.siliconeInSmall,
      siliconeSmallHeadIdx: p.siliconeSmallHeadIdx,
      beadsHeadIdx: p.beadsHeadIdx,
      beadsInSmall: p.beadsInSmall,
      beadsSmallHeadIdx: p.beadsSmallHeadIdx,
      beadsChain: [...p.beadsChain],
      electrodes: [...p.electrodes],
      hpBonus: p.hpBonus ?? 0,
      heartRateModifier: drug.heartRateModifier,
      peristalsisModifier: drug.peristalsisModifier,
      stimulantTimeLeft: stimTL,
      sedativeTimeLeft: sedTL,
    }));
  }, []);

  const triggerDialogue = useCallback((trigger: DialogueTrigger) => {
    const isComa = comaStateRef.current !== 'none';
    const isComaDialogue =
      trigger === 'overdose_tachycardia' ||
      trigger === 'overdose_bradycardia' ||
      trigger === 'coma_disturbed';

    if (isComa && !isComaDialogue) {
      if (Math.random() < 0.12) {
        const text = getRandomDialogue('coma_disturbed');
        if (dialogueTimerRef.current) clearTimeout(dialogueTimerRef.current);
        setState(prev => ({ ...prev, currentDialogue: text }));
        dialogueTimerRef.current = setTimeout(() => {
          setState(prev => ({ ...prev, currentDialogue: null }));
        }, 2000);
      }
      return;
    }

    const text = getRandomDialogue(trigger);
    if (dialogueTimerRef.current) clearTimeout(dialogueTimerRef.current);
    setState(prev => ({ ...prev, currentDialogue: text }));
    dialogueTimerRef.current = setTimeout(() => {
      setState(prev => ({ ...prev, currentDialogue: null }));
    }, 3500);
  }, []);

  const triggerDialogueRef = useRef(triggerDialogue);
  triggerDialogueRef.current = triggerDialogue;
  enemaAnimRef.current.dialogueFnRef = triggerDialogue;

  useEffect(() => {
    const STEP_MS = 300;
    const timer = setInterval(() => {
      const anim = enemaAnimRef.current;
      const p = physicsRef.current;

      const enemaToolState = p.toolStates['灌肠器'];
      const enemaActive = p.toolType === '灌肠器' || enemaToolState?.active === true;
      if (!enemaActive) return;

      const td = triggerDialogueRef.current;
      const curLarge = p.enemaHeadIdx;
      const curSmall = p.enemaSmallHeadIdx;
      const curInSmall = p.enemaInSmall;

      if (!curInSmall && !anim.targetInSmall) {
        if (curLarge === anim.targetLargeIdx) return;
        const dir = anim.targetLargeIdx < curLarge ? -1 : 1;
        const newIdx = Math.max(0, Math.min(N_LARGE - 1, curLarge + dir));
        const depth = N_LARGE - 1 - newIdx;
        if (Math.abs(depth - anim.lastDialogueLargeDepth) >= 2) {
          anim.lastDialogueLargeDepth = depth;
          if (dir === -1) {
            if (depth <= 8) td('enema_large_shallow');
            else if (depth <= 20) td('enema_large_medium');
            else td('enema_large_deep');
          } else {
            td('enema_retract');
          }
        }
        p.enemaHeadIdx = newIdx;
        setState(prev => ({ ...prev, enemaHeadIdx: newIdx }));

      } else if (!curInSmall && anim.targetInSmall) {
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
          p.enemaInSmall = true;
          p.enemaSmallHeadIdx = N_SMALL - 1;
          anim.lastDialogueSmallDepth = -99;
          td('enema_enter_small');
          setState(prev => ({ ...prev, enemaInSmall: true, enemaSmallHeadIdx: N_SMALL - 1 }));
        }

      } else if (curInSmall && !anim.targetInSmall) {
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
          p.enemaInSmall = false;
          p.enemaSmallHeadIdx = N_SMALL - 1;
          p.enemaHeadIdx = 0;
          anim.lastDialogueSmallDepth = -99;
          setState(prev => ({ ...prev, enemaInSmall: false, enemaSmallHeadIdx: N_SMALL - 1, enemaHeadIdx: 0 }));
        }

      } else if (curInSmall && anim.targetInSmall) {
        if (curSmall === anim.targetSmallIdx) return;
        const dir = anim.targetSmallIdx < curSmall ? -1 : 1;
        const newIdx = Math.max(0, Math.min(N_SMALL - 1, curSmall + dir));
        const depth = N_SMALL - 1 - newIdx;
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

  // === Parasite egg / worm simulation loop ===
  useEffect(() => {
    const timer = setInterval(() => {
      const p = physicsRef.current;
      const now = Date.now();
      const td = triggerDialogueRef.current;

      if (parasiteRef.current.length === 0) return;

      // Electric shock kill detection (medium+ = toolParam2 >= 40)
      const electricMedium =
        p.toolType === '电击器' && p.toolActive && (p.toolParam2 ?? 0) >= 40;
      const killSmallSegs = new Set<number>();
      const killLargeSegs = new Set<number>();
      if (electricMedium && p.electrodes.length > 0) {
        p.electrodes.forEach(elec => {
          p.smallNodes.forEach((n, i) => {
            if (i < N_SMALL - 1 && Math.hypot(n.x - elec.x, n.y - elec.y) < 44) killSmallSegs.add(i);
          });
          p.largeNodes.forEach((n, i) => {
            if (i < N_LARGE - 1 && Math.hypot(n.x - elec.x, n.y - elec.y) < 44) killLargeSegs.add(i);
          });
        });
      }

      const PARASITE_LIFESPAN_MS = 5 * 60 * 1000;
      let changed = false;
      const kept: ParasiteEntity[] = [];

      for (const par of parasiteRef.current) {
        // Lifespan check — worms die after 5 minutes
        if (par.phase === 'worm' && now - par.bornAt > PARASITE_LIFESPAN_MS) {
          changed = true;
          continue;
        }

        // Electric kill check
        const occupiedSegs = getParasiteOccupiedSegs(par);
        const killed = electricMedium && occupiedSegs.some(({ intestine, seg }) =>
          intestine === 'small' ? killSmallSegs.has(seg) : killLargeSegs.has(seg)
        );
        if (killed) { changed = true; continue; }

        if (par.phase === 'egg_traveling') {
          const inSmall = par.intestine === 'small';
          const segs = inSmall ? p.smallSegs : p.largeSegs;
          const periScale = (inSmall ? p.periScaleSmall : p.periScaleLarge)[par.segIdx] ?? 1;
          const minInterval = Math.max(450, 1400 / Math.max(0.5, p.peristalsisSpeed ?? 1.5));
          if (periScale > 1.06 && now - par.lastMoveStepTime > minInterval) {
            par.lastMoveStepTime = now;
            const maxSeg = inSmall ? N_SMALL - 2 : N_LARGE - 2;
            if (par.segIdx < maxSeg) {
              // Block movement into broken segment
              if (!segs[par.segIdx + 1]?.broken) {
                par.segIdx++;
                par.movingDir = 1;
              }
            } else if (inSmall && par.targetIntestine === 'large') {
              // Cross junction only if not broken
              if (!p.smallSegs[par.segIdx]?.broken && !p.largeSegs[0]?.broken) {
                par.intestine = 'large';
                par.segIdx = 0;
                par.movingDir = 1;
              }
            }
            if (par.intestine === par.targetIntestine && par.segIdx >= par.targetSegIdx) {
              par.phase = 'egg_hatching';
              par.hatchStartTime = now;
            }
            changed = true;
          }
        } else if (par.phase === 'egg_hatching') {
          if (now - par.hatchStartTime >= par.hatchDurationMs) {
            par.phase = 'worm';
            par.wormLength = 1;
            par.lastGrowTime = now;
            par.lastDamageTime = now;
            par.bornAt = now;
            par.isFreeMoving = false;
            par.freeMoveIntestine = par.intestine;
            par.freeMoveTarget = par.segIdx;
            par.freeMoveWaitUntil = now + 3000;
            par.lastMoveStepTime = 0;
            td('parasite_hatch');
            changed = true;
          }
        } else {
          // Worm phase
          occupiedSegs.forEach(({ intestine, seg }) => {
            const segList = intestine === 'small' ? p.smallSegs : p.largeSegs;
            if (seg < segList.length) segList[seg].sensitivity = Math.min(100, segList[seg].sensitivity + 0.025);
          });
          changed = true;

          // Growth every 9s up to max 6 segments
          if (par.wormLength < 6 && now - par.lastGrowTime >= 9000) {
            par.wormLength = Math.min(6, par.wormLength + 1);
            par.lastGrowTime = now;
          }

          // Adult damage — interval and perforation chance are configurable
          const damageIntervalMs = parasiteDamageIntervalRef.current * 1000;
          if (par.wormLength >= 2 && now - par.lastDamageTime >= damageIntervalMs) {
            par.lastDamageTime = now;
            const si = par.segIdx;
            const segList = par.intestine === 'small' ? p.smallSegs : p.largeSegs;
            if (si < segList.length) {
              segList[si].health = Math.max(0, segList[si].health - 10);
              segList[si].pain = Math.min(100, segList[si].pain + 15);
              if (Math.random() < parasitePerforationChanceRef.current) {
                segList[si].perforated = true;
                td('parasite_perforation');
              } else {
                td('parasite_damage');
              }
            }
          }

          // Free movement starts at 2 segments (was 6)
          if (par.wormLength >= 2) {
            if (!par.isFreeMoving && now >= par.freeMoveWaitUntil) {
              par.isFreeMoving = true;
              // Pick reachable random target — respect broken segments
              const range = getReachableRange(par.segIdx, par.intestine, p);
              const tryLarge = range.canCrossToLarge && Math.random() < 0.4;
              const trySmall = range.canCrossToSmall && Math.random() < 0.4;
              if (tryLarge) {
                // Find reachable portion of large from idx 0
                let largeRight = 0;
                while (largeRight < N_LARGE - 2 && !p.largeSegs[largeRight + 1]?.broken) largeRight++;
                par.freeMoveIntestine = 'large';
                par.freeMoveTarget = Math.floor(Math.random() * (largeRight + 1));
              } else if (trySmall) {
                // Find reachable portion of small from N_SMALL-2 going left
                let smallLeft = N_SMALL - 2;
                while (smallLeft > 0 && !p.smallSegs[smallLeft - 1]?.broken) smallLeft--;
                par.freeMoveIntestine = 'small';
                par.freeMoveTarget = smallLeft + Math.floor(Math.random() * (N_SMALL - 2 - smallLeft + 1));
              } else {
                par.freeMoveIntestine = par.intestine;
                par.freeMoveTarget = range.leftLimit + Math.floor(Math.random() * (range.rightLimit - range.leftLimit + 1));
              }
              par.lastMoveStepTime = now;
            }

            if (par.isFreeMoving && now - par.lastMoveStepTime >= 800) {
              par.lastMoveStepTime = now;

              // --- Continue junction crossing ---
              if (par.crossDirection === 'smallToLarge') {
                par.segIdx++;
                par.movingDir = 1;
                if (par.segIdx >= par.wormLength - 1) par.crossDirection = null;
              } else if (par.crossDirection === 'largeToSmall') {
                par.segIdx--;
                par.movingDir = -1;
                if (par.segIdx + par.wormLength - 1 <= N_SMALL - 2) par.crossDirection = null;
              } else {
                // Normal movement
                const inSmall = par.intestine === 'small';
                const segList = inSmall ? p.smallSegs : p.largeSegs;
                const atTarget = par.intestine === par.freeMoveIntestine && par.segIdx === par.freeMoveTarget;
                if (!atTarget) {
                  const reachedIntestine = par.intestine === par.freeMoveIntestine;
                  if (!reachedIntestine) {
                    // Need to cross junction
                    if (inSmall) {
                      if (par.segIdx < N_SMALL - 2) {
                        if (!segList[par.segIdx + 1]?.broken) { par.segIdx++; par.movingDir = 1; }
                        else { par.isFreeMoving = false; }
                      } else {
                        // At junction — start gradual crossing
                        if (!p.smallSegs[par.segIdx]?.broken && !p.largeSegs[0]?.broken) {
                          par.crossDirection = 'smallToLarge';
                          par.intestine = 'large';
                          par.segIdx = 0;
                          par.movingDir = 1;
                        } else { par.isFreeMoving = false; }
                      }
                    } else {
                      if (par.segIdx > 0) {
                        if (!segList[par.segIdx - 1]?.broken) { par.segIdx--; par.movingDir = -1; }
                        else { par.isFreeMoving = false; }
                      } else {
                        // At junction — start gradual crossing back to small
                        if (!p.largeSegs[0]?.broken && !p.smallSegs[N_SMALL - 2]?.broken) {
                          par.crossDirection = 'largeToSmall';
                          par.intestine = 'small';
                          par.segIdx = N_SMALL - 2;
                          par.movingDir = -1;
                        } else { par.isFreeMoving = false; }
                      }
                    }
                  } else {
                    // Same intestine
                    if (par.segIdx < par.freeMoveTarget) {
                      if (!segList[par.segIdx + 1]?.broken) { par.segIdx++; par.movingDir = 1; }
                      else { par.isFreeMoving = false; par.freeMoveWaitUntil = now + 5000; }
                    } else if (par.segIdx > par.freeMoveTarget) {
                      if (!segList[par.segIdx - 1]?.broken) { par.segIdx--; par.movingDir = -1; }
                      else { par.isFreeMoving = false; par.freeMoveWaitUntil = now + 5000; }
                    }
                  }
                } else {
                  par.isFreeMoving = false;
                  par.freeMoveWaitUntil = now + 5000;
                }
              }
            }
          }
        }

        kept.push(par);
      }

      // Auto egg laying: when total parasites > 2 and 2 min have passed, a random worm lays an egg at its tail
      const worms = kept.filter(w => w.phase === 'worm' && w.wormLength >= 3);
      if (kept.length > 2 && worms.length > 0 && now - lastAutoEggTimeRef.current >= 120000) {
        lastAutoEggTimeRef.current = now;
        const layer = worms[Math.floor(Math.random() * worms.length)];
        // Tail is opposite end from head: when movingDir=1, tail is at segIdx-(wormLen-1); -1 means tail is at segIdx
        const tailSeg = layer.movingDir === 1
          ? Math.max(0, layer.segIdx - layer.wormLength + 1)
          : layer.segIdx;
        const eggId = parasiteIdRef.current++;
        const wormColor = {
          r: 225 + Math.floor((Math.random() - 0.5) * 24),
          g: 215 + Math.floor((Math.random() - 0.5) * 20),
          b: 200 + Math.floor((Math.random() - 0.5) * 20),
        };
        // Choose a reachable target for the new egg
        const range = getReachableRange(tailSeg, layer.intestine, p);
        const goLarge = range.canCrossToLarge && Math.random() < 0.5;
        const targetIntestine: 'small' | 'large' = goLarge ? 'large' : layer.intestine;
        const targetSegIdx = goLarge
          ? Math.floor(Math.random() * (N_LARGE - 1))
          : range.leftLimit + Math.floor(Math.random() * (range.rightLimit - range.leftLimit + 1));
        kept.push({
          id: eggId, phase: 'egg_traveling',
          intestine: layer.intestine, segIdx: tailSeg,
          targetIntestine, targetSegIdx,
          hatchStartTime: 0, hatchDurationMs: hatchDurationRef.current * 1000,
          wormLength: 0, lastGrowTime: 0, lastDamageTime: 0,
          isFreeMoving: false, freeMoveIntestine: targetIntestine,
          freeMoveTarget: targetSegIdx, freeMoveWaitUntil: 0,
          lastMoveStepTime: 0, wormColor,
          lateralOffset: (Math.random() * 1.4) - 0.7,
          bornAt: now, movingDir: 1, crossDirection: null,
        });
        changed = true;
      }

      if (changed || kept.length !== parasiteRef.current.length) {
        parasiteRef.current = kept;
        setState(prev => ({ ...prev, parasites: [...kept] }));
      }
    }, 120);
    return () => clearInterval(timer);
  }, []);

  // === 长硅胶棒 animation loop — completely independent from enema ===
  useEffect(() => {
    const timer = setInterval(() => {
      const p = physicsRef.current;
      if (p.toolType !== '长硅胶棒') return;

      const anim = siliconeAnimRef.current;
      const td = triggerDialogueRef.current;
      const now = Date.now();
      const curInSmall = p.siliconeInSmall;
      // Speed: param2=50→280ms/node in large, 520ms in small; faster at higher param2
      const speedMs = curInSmall
        ? Math.max(280, 520 - (p.toolParam2 ?? 50) * 2.4)
        : Math.max(180, 380 - (p.toolParam2 ?? 50) * 2);
      if (now - anim.lastStepTime < speedMs) return;
      anim.lastStepTime = now;

      const curLarge = p.siliconeHeadIdx;
      const curSmall = p.siliconeSmallHeadIdx;

      if (!curInSmall && !anim.targetInSmall) {
        if (curLarge === anim.targetLargeIdx) return;
        const dir = anim.targetLargeIdx < curLarge ? -1 : 1;
        const newIdx = Math.max(0, Math.min(N_LARGE - 1, curLarge + dir));
        const depth = N_LARGE - 1 - newIdx;
        if (Math.abs(depth - anim.lastDialogueLargeDepth) >= 3) {
          anim.lastDialogueLargeDepth = depth;
          if (dir === -1) {
            if (depth <= 10) td('silicone_large_shallow');
            else td('silicone_large_deep');
          }
          if (depth >= 4 && p.toolParam1 > 35) td('silicone_expand');
        }
        p.siliconeHeadIdx = newIdx;
        setState(prev => ({ ...prev, siliconeHeadIdx: newIdx }));

      } else if (!curInSmall && anim.targetInSmall) {
        if (curLarge > 0) {
          const newIdx = curLarge - 1;
          p.siliconeHeadIdx = newIdx;
          setState(prev => ({ ...prev, siliconeHeadIdx: newIdx }));
        } else {
          p.siliconeInSmall = true;
          p.siliconeSmallHeadIdx = N_SMALL - 1;
          anim.lastDialogueSmallDepth = -99;
          td('silicone_small_enter');
          setState(prev => ({ ...prev, siliconeInSmall: true, siliconeSmallHeadIdx: N_SMALL - 1 }));
        }

      } else if (curInSmall && !anim.targetInSmall) {
        if (curSmall < N_SMALL - 1) {
          const newIdx = curSmall + 1;
          p.siliconeSmallHeadIdx = newIdx;
          setState(prev => ({ ...prev, siliconeSmallHeadIdx: newIdx }));
        } else {
          p.siliconeInSmall = false;
          p.siliconeSmallHeadIdx = N_SMALL - 1;
          p.siliconeHeadIdx = 0;
          setState(prev => ({ ...prev, siliconeInSmall: false, siliconeSmallHeadIdx: N_SMALL - 1, siliconeHeadIdx: 0 }));
        }

      } else if (curInSmall && anim.targetInSmall) {
        if (curSmall === anim.targetSmallIdx) return;
        const dir = anim.targetSmallIdx < curSmall ? -1 : 1;
        const newIdx = Math.max(0, Math.min(N_SMALL - 1, curSmall + dir));
        const depth = N_SMALL - 1 - newIdx;
        if (Math.abs(depth - anim.lastDialogueSmallDepth) >= 4) {
          anim.lastDialogueSmallDepth = depth;
          if (dir === -1) td('silicone_small_enter');
        }
        p.siliconeSmallHeadIdx = newIdx;
        setState(prev => ({ ...prev, siliconeSmallHeadIdx: newIdx }));
      }
    }, 80);
    return () => clearInterval(timer);
  }, []);

  // === 拉珠 animation loop — completely independent from enema and silicone ===
  useEffect(() => {
    const timer = setInterval(() => {
      const p = physicsRef.current;
      if (p.toolType !== '拉珠') return;

      const anim = beadsAnimRef.current;
      const td = triggerDialogueRef.current;
      const now = Date.now();
      const curInSmall = p.beadsInSmall;
      // Fast pull = rapid retraction; normal = param2-controlled speed
      const speedMs = anim.fastPull
        ? 95
        : (curInSmall
            ? Math.max(300, 560 - (p.toolParam2 ?? 50) * 2.6)
            : Math.max(200, 420 - (p.toolParam2 ?? 50) * 2.2));
      if (now - anim.lastStepTime < speedMs) return;
      anim.lastStepTime = now;

      const curLarge = p.beadsHeadIdx;
      const curSmall = p.beadsSmallHeadIdx;

      if (!curInSmall && !anim.targetInSmall) {
        if (curLarge === anim.targetLargeIdx) {
          anim.fastPull = false;
          return;
        }
        const dir = anim.targetLargeIdx < curLarge ? -1 : 1;
        const newIdx = Math.max(0, Math.min(N_LARGE - 1, curLarge + dir));
        const depth = N_LARGE - 1 - newIdx;
        if (Math.abs(depth - anim.lastDialogueLargeDepth) >= 3) {
          anim.lastDialogueLargeDepth = depth;
          if (dir === -1) {
            if (depth <= 10) td('beads_large_shallow');
            else td('beads_large_deep');
          } else {
            td('beads_pullout');
          }
        }
        p.beadsHeadIdx = newIdx;
        setState(prev => ({ ...prev, beadsHeadIdx: newIdx }));

      } else if (!curInSmall && anim.targetInSmall) {
        if (curLarge > 0) {
          const newIdx = curLarge - 1;
          p.beadsHeadIdx = newIdx;
          setState(prev => ({ ...prev, beadsHeadIdx: newIdx }));
        } else {
          p.beadsInSmall = true;
          p.beadsSmallHeadIdx = N_SMALL - 1;
          anim.lastDialogueSmallDepth = -99;
          td('beads_small_enter');
          setState(prev => ({ ...prev, beadsInSmall: true, beadsSmallHeadIdx: N_SMALL - 1 }));
        }

      } else if (curInSmall && !anim.targetInSmall) {
        if (curSmall < N_SMALL - 1) {
          const newIdx = curSmall + 1;
          td('beads_pullout');
          p.beadsSmallHeadIdx = newIdx;
          setState(prev => ({ ...prev, beadsSmallHeadIdx: newIdx }));
        } else {
          p.beadsInSmall = false;
          p.beadsSmallHeadIdx = N_SMALL - 1;
          p.beadsHeadIdx = 0;
          anim.fastPull = false;
          setState(prev => ({ ...prev, beadsInSmall: false, beadsSmallHeadIdx: N_SMALL - 1, beadsHeadIdx: 0 }));
        }

      } else if (curInSmall && anim.targetInSmall) {
        if (curSmall === anim.targetSmallIdx) return;
        const dir = anim.targetSmallIdx < curSmall ? -1 : 1;
        const newIdx = Math.max(0, Math.min(N_SMALL - 1, curSmall + dir));
        if (dir === 1) td('beads_pullout');
        p.beadsSmallHeadIdx = newIdx;
        setState(prev => ({ ...prev, beadsSmallHeadIdx: newIdx }));
      }
    }, 80);
    return () => clearInterval(timer);
  }, []);

  // === 吞入跳蛋 animation loop — moves from duodenum (node 0) deeper into intestines ===
  useEffect(() => {
    const timer = setInterval(() => {
      const p = physicsRef.current;
      const anim = eggAnimRef.current;
      if (p.toolType !== '吞入跳蛋') return;

      const now = Date.now();
      const speedMs = Math.max(100, 450 - (p.toolParam2 ?? 50) * 3.5);
      if (now - anim.lastStepTime < speedMs) return;
      anim.lastStepTime = now;

      const curInLarge = p.eggInLarge;
      const curSmall = p.eggSmallHeadIdx;
      const curLarge = p.eggLargeHeadIdx;

      if (!curInLarge && !anim.targetInLarge) {
        // In small intestine, targeting small intestine position
        if (curSmall === anim.targetSmallIdx) return;
        const dir = anim.targetSmallIdx > curSmall ? 1 : -1;
        const newIdx = Math.max(0, Math.min(N_SMALL - 1, curSmall + dir));
        p.eggSmallHeadIdx = newIdx;
        setState(prev => ({ ...prev, eggSmallHeadIdx: newIdx }));

      } else if (!curInLarge && anim.targetInLarge) {
        // Push egg through ileocecal junction into large intestine
        if (curSmall < N_SMALL - 1) {
          const newIdx = Math.min(N_SMALL - 1, curSmall + 1);
          p.eggSmallHeadIdx = newIdx;
          setState(prev => ({ ...prev, eggSmallHeadIdx: newIdx }));
        } else {
          // Cross junction
          p.eggInLarge = true;
          p.eggSmallHeadIdx = N_SMALL - 1;
          p.eggLargeHeadIdx = 0;
          setState(prev => ({ ...prev, eggInLarge: true, eggSmallHeadIdx: N_SMALL - 1, eggLargeHeadIdx: 0 }));
        }

      } else if (curInLarge && !anim.targetInLarge) {
        // Retract egg back through ileocecal junction
        if (curLarge > 0) {
          const newIdx = Math.max(0, curLarge - 1);
          p.eggLargeHeadIdx = newIdx;
          setState(prev => ({ ...prev, eggLargeHeadIdx: newIdx }));
        } else {
          // Cross junction back to small intestine
          p.eggInLarge = false;
          p.eggLargeHeadIdx = 0;
          p.eggSmallHeadIdx = N_SMALL - 1;
          setState(prev => ({ ...prev, eggInLarge: false, eggLargeHeadIdx: 0, eggSmallHeadIdx: N_SMALL - 1 }));
        }

      } else if (curInLarge && anim.targetInLarge) {
        // In large intestine, targeting large intestine position
        if (curLarge === anim.targetLargeIdx) return;
        const dir = anim.targetLargeIdx > curLarge ? 1 : -1;
        const newIdx = Math.max(0, Math.min(N_LARGE - 1, curLarge + dir));
        p.eggLargeHeadIdx = newIdx;
        setState(prev => ({ ...prev, eggLargeHeadIdx: newIdx }));
      }
    }, 80);
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
      if (ts.pos) {
        p.toolPos = { ...ts.pos };
      } else if (ts.active && !p.toolPos) {
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

  const setSiliconeTarget = useCallback((params: { largeIdx?: number; inSmall?: boolean; smallIdx?: number }) => {
    const anim = siliconeAnimRef.current;
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

  const setBeadsTarget = useCallback((params: { largeIdx?: number; inSmall?: boolean; smallIdx?: number; fastPull?: boolean }) => {
    const anim = beadsAnimRef.current;
    if (params.fastPull) {
      anim.fastPull = true;
      anim.targetLargeIdx = N_LARGE - 1;
      anim.targetInSmall = false;
      return;
    }
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

  const setEggTarget = useCallback((params: { smallIdx?: number; inLarge?: boolean; largeIdx?: number }) => {
    const anim = eggAnimRef.current;
    if (params.smallIdx !== undefined) {
      anim.targetSmallIdx = Math.max(0, Math.min(N_SMALL - 1, params.smallIdx));
    }
    if (params.inLarge !== undefined) {
      anim.targetInLarge = params.inLarge;
    }
    if (params.largeIdx !== undefined) {
      anim.targetLargeIdx = Math.max(0, Math.min(N_LARGE - 1, params.largeIdx));
    }
  }, []);

  const takeStimulant = useCallback(() => {
    const now = Date.now();
    const drug = drugRef.current;
    const recent = drug.stimulantLog.filter(t => now - t < 20000);
    recent.push(now);
    drug.stimulantLog = recent;

    const curesBradycardia = comaStateRef.current === 'bradycardia';
    const overdose = recent.length > 10 && !curesBradycardia;

    drug.stimHRMod = Math.min(150, drug.stimHRMod + 15);
    drug.stimBreathMod = Math.min(2.5, drug.stimBreathMod + 0.2);
    drug.stimPeriMod = Math.min(3.0, drug.stimPeriMod + 0.1);
    drug.stimulantExpiry = now + drug.durationSec * 1000;
    drug.heartRateModifier = drug.stimHRMod + drug.sedHRMod;
    drug.breathModifier = drug.stimBreathMod + drug.sedBreathMod;
    drug.peristalsisModifier = drug.stimPeriMod;

    const newBreath = Math.min(3.0, BREATH_AMPLITUDE_DEFAULT + drug.breathModifier);
    const stimTL = Math.ceil(drug.durationSec);

    if (overdose) {
      comaStateRef.current = 'tachycardia';
      setState(prev => ({
        ...prev,
        comaState: 'tachycardia',
        heartRateModifier: drug.heartRateModifier,
        peristalsisModifier: drug.peristalsisModifier,
        stimulantTimeLeft: stimTL,
        breathAmplitude: newBreath,
      }));
      triggerDialogueRef.current('overdose_tachycardia');
    } else if (curesBradycardia) {
      comaStateRef.current = 'none';
      setState(prev => ({
        ...prev,
        comaState: 'none',
        heartRateModifier: drug.heartRateModifier,
        peristalsisModifier: drug.peristalsisModifier,
        stimulantTimeLeft: stimTL,
        breathAmplitude: newBreath,
      }));
      triggerDialogueRef.current('cmd_stimulant');
    } else {
      setState(prev => ({
        ...prev,
        heartRateModifier: drug.heartRateModifier,
        peristalsisModifier: drug.peristalsisModifier,
        stimulantTimeLeft: stimTL,
        breathAmplitude: newBreath,
      }));
      triggerDialogueRef.current('cmd_stimulant');
    }
  }, []);

  const takeSedative = useCallback(() => {
    const now = Date.now();
    const drug = drugRef.current;
    const recent = drug.sedativeLog.filter(t => now - t < 20000);
    recent.push(now);
    drug.sedativeLog = recent;

    const curesTachycardia = comaStateRef.current === 'tachycardia';
    const overdose = recent.length > 10 && !curesTachycardia;

    drug.sedHRMod = Math.max(-120, drug.sedHRMod - 12);
    drug.sedBreathMod = Math.max(-1.0, drug.sedBreathMod - 0.15);
    drug.sedPainMod = Math.max(-50, drug.sedPainMod - 5);
    drug.sedativeExpiry = now + drug.durationSec * 1000;
    drug.heartRateModifier = drug.stimHRMod + drug.sedHRMod;
    drug.breathModifier = drug.stimBreathMod + drug.sedBreathMod;
    drug.painModifier = drug.sedPainMod;

    const newBreath = Math.max(0.2, BREATH_AMPLITUDE_DEFAULT + drug.breathModifier);
    const sedTL = Math.ceil(drug.durationSec);

    if (overdose) {
      comaStateRef.current = 'bradycardia';
      setState(prev => ({
        ...prev,
        comaState: 'bradycardia',
        heartRateModifier: drug.heartRateModifier,
        sedativeTimeLeft: sedTL,
        breathAmplitude: newBreath,
      }));
      triggerDialogueRef.current('overdose_bradycardia');
    } else if (curesTachycardia) {
      comaStateRef.current = 'none';
      setState(prev => ({
        ...prev,
        comaState: 'none',
        heartRateModifier: drug.heartRateModifier,
        sedativeTimeLeft: sedTL,
        breathAmplitude: newBreath,
      }));
      triggerDialogueRef.current('cmd_sedative');
    } else {
      setState(prev => ({
        ...prev,
        heartRateModifier: drug.heartRateModifier,
        sedativeTimeLeft: sedTL,
        breathAmplitude: newBreath,
      }));
      triggerDialogueRef.current('cmd_sedative');
    }
  }, []);

  const clearComaByShock = useCallback(() => {
    if (comaStateRef.current === 'none') return;
    comaStateRef.current = 'none';
    setState(prev => ({ ...prev, comaState: 'none' }));
    triggerDialogueRef.current('surg_firstaid');
  }, []);

  const resetPhysics = useCallback(() => {
    const fresh = createInitialPhysicsState();
    physicsRef.current = fresh;
    comaStateRef.current = 'none';
    drugRef.current = {
      stimHRMod: 0, stimBreathMod: 0, stimPeriMod: 0,
      sedHRMod: 0, sedBreathMod: 0, sedPainMod: 0,
      heartRateModifier: 0, breathModifier: 0,
      peristalsisModifier: 0, painModifier: 0,
      stimulantLog: [], sedativeLog: [],
      stimulantExpiry: 0, sedativeExpiry: 0,
      durationSec: drugRef.current.durationSec,
    };
    parasiteRef.current = [];
    setState(prev => ({
      ...prev,
      hp: 100, pleasure: 0, heartRate: 72,
      navelPierced: false, intestinalRuptures: 0, intestinalBreaks: 0,
      activeTool: null, toolActive: false, toolParam1: 50, toolParam2: 50,
      toolStates: fresh.toolStates,
      pressureDiffusionRate: fresh.pressureDiffusionRate,
      currentDialogue: null, peristalsisSpeed: 1.5,
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
      comaState: 'none',
      heartRateModifier: 0,
      peristalsisModifier: 0,
      drugDurationSec: drugRef.current.durationSec,
      stimulantTimeLeft: 0,
      sedativeTimeLeft: 0,
      parasites: [],
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

  const relaxAbdomen = useCallback(() => {
    physicsRef.current.relaxFrames = 150;
    triggerDialogueRef.current('cmd_relax');
  }, []);

  const takeLaxative = useCallback(() => {
    physicsRef.current.laxativeFrames = 600;
    triggerDialogueRef.current('cmd_laxative');
  }, []);

  const performFirstAid = useCallback(() => {
    const p = physicsRef.current;
    const totalPain = p.smallSegs.reduce((a, s) => a + s.pain, 0) / p.smallSegs.length;
    const breaks = [...p.smallSegs, ...p.largeSegs].filter(s => s.broken).length;
    const curHp = Math.min(100, Math.max(0, 100 - totalPain * 0.7 - breaks * 5 + (p.hpBonus ?? 0)));
    if (curHp < 5) {
      p.hpBonus = Math.min(100, (p.hpBonus ?? 0) + 25);
      setState(prev => ({ ...prev, hpBonus: p.hpBonus }));
    }
    if (comaStateRef.current !== 'none') {
      comaStateRef.current = 'none';
      setState(prev => ({ ...prev, comaState: 'none' }));
    }
    triggerDialogueRef.current('surg_firstaid');
  }, []);

  const startTransfusion = useCallback(() => {
    physicsRef.current.transfusionFrames = 600;
    triggerDialogueRef.current('surg_transfusion');
  }, []);

  const repairIntestine = useCallback(() => {
    const p = physicsRef.current;
    const marks: number[] = [];
    const largeMarks: number[] = [];
    p.smallSegs.forEach((seg, i) => {
      if (seg.perforated) {
        marks.push(i);
        seg.perforated = false;
        seg.health = Math.max(seg.health, 30);
        seg.pain = Math.min(seg.pain, 40);
      }
    });
    p.largeSegs.forEach((seg, i) => {
      if (seg.perforated) {
        largeMarks.push(i);
        seg.perforated = false;
        seg.health = Math.max(seg.health, 30);
        seg.pain = Math.min(seg.pain, 40);
      }
    });
    p.repairMarks = [...new Set([...(p.repairMarks ?? []), ...marks])];
    p.largeRepairMarks = [...new Set([...(p.largeRepairMarks ?? []), ...largeMarks])];
    setState(prev => ({
      ...prev,
      repairMarks: [...p.repairMarks],
      largeRepairMarks: [...p.largeRepairMarks],
      intestinalRuptures: 0,
    }));
    triggerDialogueRef.current('surg_repair');
  }, []);

  const sutureIntestine = useCallback(() => {
    const p = physicsRef.current;
    const marks: number[] = [];
    const largeMarks: number[] = [];
    p.smallSegs.forEach((seg, i) => {
      if (seg.broken) {
        marks.push(i);
        seg.broken = false;
        seg.health = Math.max(seg.health, 35);
        seg.pain = Math.min(seg.pain, 20);
        seg.pressure = 0;
        const nA = p.smallNodes[i], nB = p.smallNodes[i + 1];
        if (nA && nB) {
          const dx = nB.x - nA.x, dy = nB.y - nA.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > 30) {
            const ratio = 28 / d;
            nB.x = nA.x + dx * ratio; nB.y = nA.y + dy * ratio;
            nB.px = nB.x; nB.py = nB.y;
          }
        }
      }
    });
    p.largeSegs.forEach((seg, i) => {
      if (seg.broken) {
        largeMarks.push(i);
        seg.broken = false;
        seg.health = Math.max(seg.health, 35);
        seg.pain = Math.min(seg.pain, 20);
        seg.pressure = 0;
        const nA = p.largeNodes[i], nB = p.largeNodes[i + 1];
        if (nA && nB) {
          const dx = nB.x - nA.x, dy = nB.y - nA.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > 35) {
            const ratio = 30 / d;
            nB.x = nA.x + dx * ratio; nB.y = nA.y + dy * ratio;
            nB.px = nB.x; nB.py = nB.y;
          }
        }
      }
    });
    p.sutureMarks = [...new Set([...(p.sutureMarks ?? []), ...marks])];
    p.largeSutureMarks = [...new Set([...(p.largeSutureMarks ?? []), ...largeMarks])];
    setState(prev => ({
      ...prev,
      sutureMarks: [...p.sutureMarks],
      largeSutureMarks: [...p.largeSutureMarks],
      intestinalBreaks: 0,
    }));
    triggerDialogueRef.current('surg_suture');
  }, []);

  const performNavelSurgery = useCallback(() => {
    physicsRef.current.navelPierced = true;
    setState(prev => ({ ...prev, navelPierced: true }));
    triggerDialogueRef.current('surg_navel');
  }, []);

  const transplantSmallIntestine = useCallback(() => {
    const p = physicsRef.current;
    const fresh = createInitialPhysicsState();
    p.smallNodes = fresh.smallNodes;
    p.smallSegs = fresh.smallSegs.map(s => ({ ...s, health: 85 }));
    p.repairMarks = [];
    p.sutureMarks = [];
    p.smallMesenteryDisabled = [];
    parasiteRef.current = [];
    const d = 22;
    const color = {
      r: Math.max(180, Math.min(255, 245 + Math.round((Math.random() - 0.5) * d * 2))),
      g: Math.max(80, Math.min(200, 168 + Math.round((Math.random() - 0.5) * d * 2))),
      b: Math.max(70, Math.min(180, 150 + Math.round((Math.random() - 0.5) * d * 2))),
    };
    p.smallTransplantColor = color;
    p.resectedSmallRanges = [];
    setState(prev => {
      const newLarge = (p.resectedLargeRanges ?? []).reduce((a, r) => a + (r.end - r.start + 1), 0);
      return {
        ...prev,
        smallTransplantColor: color,
        repairMarks: [],
        sutureMarks: [],
        smallMesenteryDisabled: [],
        smallTransplantCount: prev.smallTransplantCount + 1,
        renderSmallNodes: p.smallNodes.map(n => ({ x: n.x, y: n.y })),
        renderSmallSegs: p.smallSegs.map(s => ({ ...s })),
        parasites: [],
        resectedSmallRanges: [],
        resectedCount: newLarge,
      };
    });
    triggerDialogueRef.current('surg_small_transplant');
  }, []);

  const transplantLargeIntestine = useCallback(() => {
    const p = physicsRef.current;
    const fresh = createInitialPhysicsState();
    p.largeNodes = fresh.largeNodes;
    p.largeSegs = fresh.largeSegs.map(s => ({ ...s, health: 85 }));
    p.largeRepairMarks = [];
    p.largeSutureMarks = [];
    p.mesenteryDisabled = [];
    const d = 22;
    const color = {
      r: Math.max(155, Math.min(255, 210 + Math.round((Math.random() - 0.5) * d * 2))),
      g: Math.max(60, Math.min(170, 118 + Math.round((Math.random() - 0.5) * d * 2))),
      b: Math.max(50, Math.min(150, 92 + Math.round((Math.random() - 0.5) * d * 2))),
    };
    p.largeTransplantColor = color;
    p.resectedLargeRanges = [];
    setState(prev => {
      const newSmall = (p.resectedSmallRanges ?? []).reduce((a, r) => a + (r.end - r.start + 1), 0);
      return {
        ...prev,
        largeTransplantColor: color,
        largeRepairMarks: [],
        largeSutureMarks: [],
        mesenteryDisabled: [],
        largeTransplantCount: prev.largeTransplantCount + 1,
        renderLargeNodes: p.largeNodes.map(n => ({ x: n.x, y: n.y })),
        renderLargeSegs: p.largeSegs.map(s => ({ ...s })),
        resectedLargeRanges: [],
        resectedCount: newSmall,
      };
    });
    triggerDialogueRef.current('surg_large_transplant');
  }, []);

  const transplantAllIntestines = useCallback(() => {
    const p = physicsRef.current;
    const fresh = createInitialPhysicsState();
    p.smallNodes = fresh.smallNodes;
    p.largeNodes = fresh.largeNodes;
    p.smallSegs = fresh.smallSegs.map(s => ({ ...s, health: 85 }));
    p.largeSegs = fresh.largeSegs.map(s => ({ ...s, health: 85 }));
    p.repairMarks = []; p.sutureMarks = [];
    p.largeRepairMarks = []; p.largeSutureMarks = [];
    p.mesenteryDisabled = [];
    p.smallMesenteryDisabled = [];
    const d = 22;
    const sc = {
      r: Math.max(180, Math.min(255, 245 + Math.round((Math.random() - 0.5) * d * 2))),
      g: Math.max(80, Math.min(200, 168 + Math.round((Math.random() - 0.5) * d * 2))),
      b: Math.max(70, Math.min(180, 150 + Math.round((Math.random() - 0.5) * d * 2))),
    };
    const lc = {
      r: Math.max(155, Math.min(255, 210 + Math.round((Math.random() - 0.5) * d * 2))),
      g: Math.max(60, Math.min(170, 118 + Math.round((Math.random() - 0.5) * d * 2))),
      b: Math.max(50, Math.min(150, 92 + Math.round((Math.random() - 0.5) * d * 2))),
    };
    p.smallTransplantColor = sc;
    p.largeTransplantColor = lc;
    p.resectedSmallRanges = [];
    p.resectedLargeRanges = [];
    parasiteRef.current = [];
    setState(prev => ({
      ...prev,
      smallTransplantColor: sc,
      largeTransplantColor: lc,
      repairMarks: [], sutureMarks: [],
      largeRepairMarks: [], largeSutureMarks: [],
      mesenteryDisabled: [],
      smallMesenteryDisabled: [],
      smallTransplantCount: prev.smallTransplantCount + 1,
      largeTransplantCount: prev.largeTransplantCount + 1,
      renderSmallNodes: p.smallNodes.map(n => ({ x: n.x, y: n.y })),
      renderLargeNodes: p.largeNodes.map(n => ({ x: n.x, y: n.y })),
      renderSmallSegs: p.smallSegs.map(s => ({ ...s })),
      renderLargeSegs: p.largeSegs.map(s => ({ ...s })),
      parasites: [],
      resectedSmallRanges: [],
      resectedLargeRanges: [],
      resectedCount: 0,
    }));
    triggerDialogueRef.current('surg_full_transplant');
  }, []);

  const enterMesenterySelection = useCallback(() => {
    setState(prev => ({
      ...prev,
      mesenterySelectionMode: true,
      mesenterySelectedNodes: [],
      smallMesenterySelectedNodes: [],
    }));
  }, []);

  const cancelMesenterySelection = useCallback(() => {
    setState(prev => ({
      ...prev,
      mesenterySelectionMode: false,
      mesenterySelectedNodes: [],
      smallMesenterySelectedNodes: [],
    }));
  }, []);

  const executeMesenterySelection = useCallback(() => {
    setState(prev => {
      physicsRef.current.mesenteryDisabled = [...prev.mesenterySelectedNodes];
      physicsRef.current.smallMesenteryDisabled = [...prev.smallMesenterySelectedNodes];
      return {
        ...prev,
        mesenterySelectionMode: false,
        mesenteryDisabled: [...prev.mesenterySelectedNodes],
        smallMesenteryDisabled: [...prev.smallMesenterySelectedNodes],
        mesenterySelectedNodes: [],
        smallMesenterySelectedNodes: [],
      };
    });
    triggerDialogueRef.current('surg_mesentery');
  }, []);

  const toggleMesenteryNode = useCallback((idx: number, isSmall = false) => {
    setState(prev => {
      if (isSmall) {
        const cur = prev.smallMesenterySelectedNodes;
        const next = cur.includes(idx) ? cur.filter(i => i !== idx) : [...cur, idx];
        return { ...prev, smallMesenterySelectedNodes: next };
      }
      const cur = prev.mesenterySelectedNodes;
      const next = cur.includes(idx) ? cur.filter(i => i !== idx) : [...cur, idx];
      return { ...prev, mesenterySelectedNodes: next };
    });
  }, []);

  const setDrugDuration = useCallback((v: number) => {
    drugRef.current.durationSec = v;
    setState(prev => ({ ...prev, drugDurationSec: v }));
  }, []);

  const takeParasiteEgg = useCallback(() => {
    const id = parasiteIdRef.current++;
    const goLarge = Math.random() < 0.5;
    const targetIntestine: 'small' | 'large' = goLarge ? 'large' : 'small';
    const targetSegIdx = goLarge
      ? Math.floor(Math.random() * (N_LARGE - 1))
      : Math.floor(Math.random() * (N_SMALL - 1));
    // Milky white / cream base with subtle per-worm variation
    const wormColor = {
      r: 225 + Math.floor((Math.random() - 0.5) * 24),
      g: 215 + Math.floor((Math.random() - 0.5) * 20),
      b: 200 + Math.floor((Math.random() - 0.5) * 20),
    };
    const lateralOffset = (Math.random() * 1.4) - 0.7; // -0.7 to 0.7
    const newParasite: ParasiteEntity = {
      id,
      phase: 'egg_traveling',
      intestine: 'small',
      segIdx: 0,
      targetIntestine,
      targetSegIdx,
      hatchStartTime: 0,
      hatchDurationMs: hatchDurationRef.current * 1000,
      wormLength: 0,
      lastGrowTime: 0,
      lastDamageTime: 0,
      isFreeMoving: false,
      freeMoveIntestine: targetIntestine,
      freeMoveTarget: targetSegIdx,
      freeMoveWaitUntil: 0,
      lastMoveStepTime: 0,
      wormColor,
      lateralOffset,
      bornAt: Date.now(),
      movingDir: 1,
      crossDirection: null,
    };
    parasiteRef.current = [...parasiteRef.current, newParasite];
    setState(prev => ({ ...prev, parasites: [...parasiteRef.current] }));
    triggerDialogueRef.current('cmd_parasite_egg');
    setTimeout(() => triggerDialogueRef.current('cmd_parasite_egg'), 4000);
    setTimeout(() => triggerDialogueRef.current('cmd_parasite_egg'), 8000);
  }, []);

  const setHatchDuration = useCallback((v: number) => {
    hatchDurationRef.current = v;
    setState(prev => ({ ...prev, hatchDurationSec: v }));
  }, []);

  const setParasiteDamageInterval = useCallback((v: number) => {
    parasiteDamageIntervalRef.current = v;
    setState(prev => ({ ...prev, parasiteDamageIntervalSec: v }));
  }, []);

  const setParasitePerforationChance = useCallback((v: number) => {
    parasitePerforationChanceRef.current = v;
    setState(prev => ({ ...prev, parasitePerforationChance: v }));
  }, []);

  const performParasiteSurgery = useCallback(() => {
    if (parasiteSurgeryPhaseRef.current !== 0) return;
    if (parasiteRef.current.length === 0) return;

    const td = triggerDialogueRef.current;
    const p = physicsRef.current;

    // === STEP 1: Incise infected segments (perforate them) ===
    parasiteSurgeryPhaseRef.current = 1;
    setState(prev => ({ ...prev, parasiteSurgeryPhase: 1 }));
    td('surg_parasite_step1');

    const infectedSmallSegs = new Set<number>();
    const infectedLargeSegs = new Set<number>();
    parasiteRef.current.forEach(par => {
      getParasiteOccupiedSegs(par).forEach(({ intestine, seg }) => {
        if (intestine === 'small') infectedSmallSegs.add(seg);
        else infectedLargeSegs.add(seg);
      });
    });

    infectedSmallSegs.forEach(i => {
      if (i < p.smallSegs.length) {
        p.smallSegs[i].perforated = true;
        p.smallSegs[i].pain = Math.min(100, p.smallSegs[i].pain + 20);
      }
    });
    infectedLargeSegs.forEach(i => {
      if (i < p.largeSegs.length) {
        p.largeSegs[i].perforated = true;
        p.largeSegs[i].pain = Math.min(100, p.largeSegs[i].pain + 20);
      }
    });

    // === STEP 2 (after 2s): Remove parasites, deal pain + HP cost ===
    setTimeout(() => {
      if (parasiteSurgeryPhaseRef.current !== 1) return;
      parasiteSurgeryPhaseRef.current = 2;
      setState(prev => ({ ...prev, parasiteSurgeryPhase: 2 }));
      td('surg_parasite_step2');

      // Remove all parasites
      parasiteRef.current = [];

      // Apply pain and HP cost proportional to parasite count
      const parasiteCount = infectedSmallSegs.size + infectedLargeSegs.size;
      const hpLoss = Math.min(25, 4 + parasiteCount * 2);
      const painGain = Math.min(30, 5 + parasiteCount * 3);

      infectedSmallSegs.forEach(i => {
        if (i < p.smallSegs.length) {
          p.smallSegs[i].pain = Math.min(100, p.smallSegs[i].pain + painGain);
          p.smallSegs[i].health = Math.max(0, p.smallSegs[i].health - 5);
        }
      });
      infectedLargeSegs.forEach(i => {
        if (i < p.largeSegs.length) {
          p.largeSegs[i].pain = Math.min(100, p.largeSegs[i].pain + painGain);
          p.largeSegs[i].health = Math.max(0, p.largeSegs[i].health - 5);
        }
      });

      setState(prev => ({
        ...prev,
        parasites: [],
        hp: Math.max(1, prev.hp - hpLoss),
        parasiteSurgeryPhase: 2,
      }));

      // === STEP 3 (after 2 more s): Repair perforations ===
      setTimeout(() => {
        if (parasiteSurgeryPhaseRef.current !== 2) return;
        parasiteSurgeryPhaseRef.current = 3;
        setState(prev => ({ ...prev, parasiteSurgeryPhase: 3 }));
        td('surg_parasite_step3');

        // Repair all perforations (same logic as repairIntestine)
        const marks: number[] = [];
        const largeMarks: number[] = [];
        p.smallSegs.forEach((seg, i) => {
          if (seg.perforated) {
            marks.push(i);
            seg.perforated = false;
            seg.health = Math.max(seg.health, 30);
            seg.pain = Math.min(seg.pain, 40);
          }
        });
        p.largeSegs.forEach((seg, i) => {
          if (seg.perforated) {
            largeMarks.push(i);
            seg.perforated = false;
            seg.health = Math.max(seg.health, 30);
            seg.pain = Math.min(seg.pain, 40);
          }
        });
        p.repairMarks = [...new Set([...(p.repairMarks ?? []), ...marks])];
        p.largeRepairMarks = [...new Set([...(p.largeRepairMarks ?? []), ...largeMarks])];

        setState(prev => ({
          ...prev,
          repairMarks: [...p.repairMarks],
          largeRepairMarks: [...p.largeRepairMarks],
          intestinalRuptures: 0,
          parasiteSurgeryPhase: 3,
        }));

        // Done — reset phase after a brief moment
        setTimeout(() => {
          parasiteSurgeryPhaseRef.current = 0;
          setState(prev => ({ ...prev, parasiteSurgeryPhase: 0 }));
        }, 4000);
      }, 4000);
    }, 4000);
  }, []);

  const enterResectionSelection = useCallback(() => {
    setState(prev => ({
      ...prev,
      resectionSelectionMode: true,
      resectionStartSeg: -1,
      resectionEndSeg: -1,
      resectionIntestine: null,
    }));
    resectionIntestineRef.current = null;
    resectionStartSegRef.current = -1;
    resectionEndSegRef.current = -1;
  }, []);

  const cancelResectionSelection = useCallback(() => {
    setState(prev => ({
      ...prev,
      resectionSelectionMode: false,
      resectionStartSeg: -1,
      resectionEndSeg: -1,
      resectionIntestine: null,
    }));
    resectionIntestineRef.current = null;
    resectionStartSegRef.current = -1;
    resectionEndSegRef.current = -1;
  }, []);

  const setResectionSelection = useCallback((intestine: 'small' | 'large', startSeg: number, endSeg: number) => {
    resectionIntestineRef.current = intestine;
    resectionStartSegRef.current = startSeg;
    resectionEndSegRef.current = endSeg;
    setState(prev => ({
      ...prev,
      resectionIntestine: intestine,
      resectionStartSeg: startSeg,
      resectionEndSeg: endSeg,
    }));
  }, []);

  const setMaxResectionSegments = useCallback((v: number) => {
    maxResectionSegmentsRef.current = v;
    setState(prev => ({ ...prev, maxResectionSegments: v }));
  }, []);

  const performResectionSurgery = useCallback(() => {
    if (resectionSurgeryPhaseRef.current !== 0) return;
    const intestine = resectionIntestineRef.current;
    const startSeg = Math.min(resectionStartSegRef.current, resectionEndSegRef.current);
    const endSeg = Math.max(resectionStartSegRef.current, resectionEndSegRef.current);
    if (startSeg === -1 || endSeg === -1 || !intestine) return;

    const p = physicsRef.current;
    const td = triggerDialogueRef.current;
    const segs = intestine === 'small' ? p.smallSegs : p.largeSegs;
    const nodes = intestine === 'small' ? p.smallNodes : p.largeNodes;

    resectionSurgeryPhaseRef.current = 1;
    setState(prev => ({ ...prev, resectionSelectionMode: false, resectionSurgeryPhase: 1 }));
    td('surg_resection_start');
    td('surg_resection_step1');

    // Step 1: mark break points, apply pain
    if (startSeg > 0 && startSeg - 1 < segs.length) segs[startSeg - 1].broken = true;
    if (endSeg < segs.length) segs[endSeg].broken = true;
    for (let i = startSeg; i <= endSeg && i < segs.length; i++) {
      segs[i].pain = Math.min(100, segs[i].pain + 25);
      segs[i].health = Math.max(0, segs[i].health - 8);
    }

    setTimeout(() => {
      if (resectionSurgeryPhaseRef.current !== 1) return;
      resectionSurgeryPhaseRef.current = 2;
      setState(prev => ({ ...prev, resectionSurgeryPhase: 2 }));
      td('surg_resection_step2');

      // Step 2: redistribute mesentery rest positions around the gap
      const nBefore = 4;
      const nAfter = 4;
      const nodeA = nodes[Math.max(0, startSeg - 1)];
      const nodeB = nodes[Math.min(nodes.length - 1, endSeg + 1)];
      if (nodeA && nodeB) {
        const mx = (nodeA.x + nodeB.x) / 2;
        const my = (nodeA.y + nodeB.y) / 2;
        for (let i = Math.max(0, startSeg - nBefore); i < startSeg; i++) {
          nodes[i].rx = mx + (nodes[i].rx - mx) * 0.6;
          nodes[i].ry = my + (nodes[i].ry - my) * 0.6;
        }
        for (let i = endSeg + 1; i <= Math.min(nodes.length - 1, endSeg + nAfter); i++) {
          nodes[i].rx = mx + (nodes[i].rx - mx) * 0.6;
          nodes[i].ry = my + (nodes[i].ry - my) * 0.6;
        }
      }

      setTimeout(() => {
        if (resectionSurgeryPhaseRef.current !== 2) return;
        resectionSurgeryPhaseRef.current = 3;
        setState(prev => ({ ...prev, resectionSurgeryPhase: 3 }));
        td('surg_resection_step3');

        // Step 3: mark segments resected, clear breaks, register resection range
        for (let i = startSeg; i <= endSeg && i < segs.length; i++) {
          segs[i].resected = true;
          segs[i].broken = false;
        }
        if (startSeg > 0 && startSeg - 1 < segs.length) segs[startSeg - 1].broken = false;
        if (endSeg < segs.length) segs[endSeg].broken = false;

        const newRange = { start: startSeg, end: endSeg };
        if (intestine === 'small') {
          p.resectedSmallRanges = [...(p.resectedSmallRanges ?? []), newRange];
        } else {
          p.resectedLargeRanges = [...(p.resectedLargeRanges ?? []), newRange];
        }
        const allSmallResected = (p.resectedSmallRanges ?? []).reduce((a, r) => a + (r.end - r.start + 1), 0);
        const allLargeResected = (p.resectedLargeRanges ?? []).reduce((a, r) => a + (r.end - r.start + 1), 0);

        setState(prev => ({
          ...prev,
          resectionSurgeryPhase: 3,
          resectionStartSeg: -1,
          resectionEndSeg: -1,
          resectionIntestine: null,
          resectedSmallRanges: [...(p.resectedSmallRanges ?? [])],
          resectedLargeRanges: [...(p.resectedLargeRanges ?? [])],
          resectedCount: allSmallResected + allLargeResected,
        }));
        resectionStartSegRef.current = -1;
        resectionEndSegRef.current = -1;
        resectionIntestineRef.current = null;

        setTimeout(() => {
          resectionSurgeryPhaseRef.current = 0;
          setState(prev => ({ ...prev, resectionSurgeryPhase: 0 }));
        }, 4000);
      }, 4000);
    }, 4000);
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
      setSiliconeTarget, setBeadsTarget, setEggTarget,
      resetPhysics, resetPositions,
      relaxAbdomen, takeLaxative, takeStimulant, takeSedative, clearComaByShock,
      setDrugDuration,
      performFirstAid, startTransfusion,
      repairIntestine, sutureIntestine, performNavelSurgery,
      transplantSmallIntestine, transplantLargeIntestine, transplantAllIntestines,
      enterMesenterySelection, executeMesenterySelection, cancelMesenterySelection,
      toggleMesenteryNode,
      takeParasiteEgg, setHatchDuration, setParasiteDamageInterval, setParasitePerforationChance, performParasiteSurgery,
      enterResectionSelection, cancelResectionSelection, performResectionSurgery,
      setResectionSelection, setMaxResectionSegments,
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
