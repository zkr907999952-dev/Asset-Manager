import {
  N_SMALL, N_LARGE, CAVITY_CX, CAVITY_CY, EXPANSION_SCALE_DEFAULT,
  PRESSURE_DIFFUSION_RATE_DEFAULT, createDefaultToolStates,
  PERISTALSIS_WAVE_AMPLITUDE_DEFAULT, PERISTALSIS_WAVE_SPEED_DEFAULT,
} from '../constants/gameConfig';
import type { PhysicsNode, PhysicsState, SegmentProps } from './physics';

function makeNode(x: number, y: number, pinned = false): PhysicsNode {
  return { x, y, px: x, py: y, rx: x, ry: y, pinned };
}

function makeSeg(): SegmentProps {
  return { health: 100, sensitivity: 0, pain: 0, pressure: 0, ruptured: false, broken: false, perforated: false, resected: false };
}

// Scale factor applied to all initial node positions from cavity center.
const INIT_SCALE = 1.1;
function scalePos(x: number, y: number): [number, number] {
  return [
    CAVITY_CX + (x - CAVITY_CX) * INIT_SCALE,
    CAVITY_CY + (y - CAVITY_CY) * INIT_SCALE,
  ];
}

// Small intestine: 66 nodes
// [0]         — Stomach/duodenum junction (pinned, top-center)
// [1]         — Duodenal bridge (R transition)
// [2–61]      — 10 serpentine rows × 6 nodes, filling the central abdominal area
//               Even rows (0,2,4,6,8) R→L; Odd rows (1,3,5,7,9) L→R
//               y spacing 18px, x range 116–231 (6 equidistant columns, step=23)
// [62–65]     — Terminal ileum curving left-down toward cecum
//
// Column x positions (pre-scale): 116, 139, 162, 185, 208, 231
// Post-scale x positions (approx): 111, 137, 162, 188, 214, 239
// This fills the space between ascending (~x=82) and descending (~x=264) colon.
export function buildSmallIntestineNodes(): PhysicsNode[] {
  const nodes: PhysicsNode[] = [];

  // [0] Stomach/duodenum junction — top-center, pinned
  {
    const [x, y] = scalePos(170, 130);
    nodes.push(makeNode(x, y, true));
  }

  // [1] Duodenal bridge — curves right toward row 0 start
  {
    const [x, y] = scalePos(220, 148);
    nodes.push(makeNode(x, y));
  }

  // [2–61] 10 serpentine rows × 6 columns through the abdominal center
  // Column x positions (pre-scale, step=23): 116, 139, 162, 185, 208, 231
  const cols = [116, 139, 162, 185, 208, 231];
  const colsR2L = [...cols].reverse(); // even rows: right → left

  for (let row = 0; row < 10; row++) {
    const y = 155 + row * 18;
    const xs = (row % 2 === 0) ? colsR2L : cols;
    for (const x of xs) {
      const [sx, sy] = scalePos(x, y);
      nodes.push(makeNode(sx, sy));
    }
  }
  // Indices [2..61]: 60 nodes across 10 rows × 6 cols

  // [62–65] Terminal ileum — from row 9 end (col xL=116, y=317) curving right-down to cecum
  // Row 9 is odd (L→R), ends at xR=231, y=317 → need to curve left toward cecum at (100,340)
  const terminalIleum: [number, number][] = [
    [199, 323],
    [167, 329],
    [135, 335],
    [103, 341],
  ];
  for (const [x, y] of terminalIleum) {
    const [sx, sy] = scalePos(x, y);
    nodes.push(makeNode(sx, sy));
  }

  return nodes; // 66 nodes total (N_SMALL = 66)
}

// Large intestine: 32 nodes
// Runs CLOCKWISE around the small intestine perimeter.
// Cecum [0] is UNPINNED — uses strong mesentery spring to spring back after drag.
// Transverse colon sags slightly downward at center for anatomical realism.
// Rectum section (nodes 27–30) has two anatomical bends:
//   sacral flexure (curving backward/left) and perineal flexure (curving forward/right)
// Anus [31] is pinned.
// All positions verified inside cavity ellipse: (x-170)²/148² + (y-248)²/175² ≤ 1
export function buildLargeIntestineNodes(): PhysicsNode[] {
  const nodes: PhysicsNode[] = [];

  // [0] Cecum — lower-left, UNPINNED. Strong mesentery spring handles rebound.
  {
    const [x, y] = scalePos(100, 340);
    nodes.push(makeNode(x, y, false));
  }

  // [1–8] Ascending colon: left side going up
  const ascending: [number, number][] = [
    [ 96, 316], [ 90, 292], [ 86, 268], [ 84, 244],
    [ 83, 220], [ 83, 196], [ 84, 172], [ 88, 148],
  ];
  for (const [x, y] of ascending) {
    const [sx, sy] = scalePos(x, y);
    nodes.push(makeNode(sx, sy));
  }

  // [9] Hepatic (left) flexure — top-left corner
  {
    const [x, y] = scalePos(92, 130);
    nodes.push(makeNode(x, y));
  }

  // [10–14] Transverse colon: top, with realistic downward sag at center
  // The middle of the transverse colon naturally hangs slightly lower due to gravity.
  const transverse: [number, number][] = [
    [116, 126], [140, 130], [170, 136], [200, 130], [228, 126],
  ];
  for (const [x, y] of transverse) {
    const [sx, sy] = scalePos(x, y);
    nodes.push(makeNode(sx, sy));
  }

  // [15] Splenic (right) flexure — top-right corner
  {
    const [x, y] = scalePos(250, 132);
    nodes.push(makeNode(x, y));
  }

  // [16–22] Descending colon: right side going down
  const descending: [number, number][] = [
    [258, 156], [262, 182], [264, 208], [264, 234],
    [262, 260], [258, 286], [252, 312],
  ];
  for (const [x, y] of descending) {
    const [sx, sy] = scalePos(x, y);
    nodes.push(makeNode(sx, sy));
  }

  // [23–26] Sigmoid colon: S-curve from lower-right toward bottom-center
  const sigmoid: [number, number][] = [
    [244, 330], [226, 346], [206, 356], [184, 358],
  ];
  for (const [x, y] of sigmoid) {
    const [sx, sy] = scalePos(x, y);
    nodes.push(makeNode(sx, sy));
  }

  // [27–30] Rectum: two anatomical bends (sacral + perineal flexure)
  const rectum: [number, number][] = [
    [168, 356],
    [158, 350],
    [154, 364],
    [162, 377],
  ];
  for (const [x, y] of rectum) {
    const [sx, sy] = scalePos(x, y);
    nodes.push(makeNode(sx, sy));
  }

  // [31] Anus — bottom-center, pinned
  {
    const [x, y] = scalePos(170, 386);
    nodes.push(makeNode(x, y, true));
  }

  return nodes; // 32 nodes total (N_LARGE = 32)
}

export function createInitialPhysicsState(): PhysicsState {
  return {
    smallNodes: buildSmallIntestineNodes(),
    largeNodes: buildLargeIntestineNodes(),
    smallSegs: Array.from({ length: N_SMALL - 1 }, makeSeg),
    largeSegs: Array.from({ length: N_LARGE - 1 }, makeSeg),
    time: 0,
    peristalsisSpeed: 1.0,
    peristalsisBase: 1.0,
    periScaleSmall: new Array(N_SMALL).fill(1),
    periScaleLarge: new Array(N_LARGE).fill(1),
    peristalsisWaveAmplitude: PERISTALSIS_WAVE_AMPLITUDE_DEFAULT,
    peristalsisWaveSpeed: PERISTALSIS_WAVE_SPEED_DEFAULT,
    toolPos: null,
    toolType: null,
    toolActive: false,
    toolParam1: 50,
    toolParam2: 50,
    toolAnchor: null,
    toolInserted: false,
    navelPierced: false,
    grabbedNode: null,
    clampPoints: [],
    activeClampIdx: -1,
    pendingClampCount: 0,
    electrodes: [],
    electricMode: 'external',
    enemaHeadIdx: N_LARGE - 1,
    enemaInSmall: false,
    enemaSmallHeadIdx: N_SMALL - 1,
    expansionScale: EXPANSION_SCALE_DEFAULT,
    pressureDiffusionRate: PRESSURE_DIFFUSION_RATE_DEFAULT,
    toolStates: createDefaultToolStates(),
    relaxFrames: 0,
    laxativeFrames: 0,
    hpBonus: 0,
    hpPenalty: 0,
    transfusionFrames: 0,
    repairMarks: [],
    sutureMarks: [],
    largeRepairMarks: [],
    largeSutureMarks: [],
    mesenteryDisabled: [],
    smallMesenteryDisabled: [],
    smallTransplantColor: null,
    largeTransplantColor: null,
    siliconeHeadIdx: N_LARGE - 4,
    siliconeInSmall: false,
    siliconeSmallHeadIdx: N_SMALL - 1,
    beadsHeadIdx: N_LARGE - 4,
    beadsInSmall: false,
    beadsSmallHeadIdx: N_SMALL - 1,
    beadsChain: [],
    eggSmallHeadIdx: 0,
    eggInLarge: false,
    eggLargeHeadIdx: 0,
    resectedSmallRanges: [],
    resectedLargeRanges: [],
    strikeWave: null,
    mesenteryDisabledSet: new Set<number>(),
    smallMesenteryDisabledSet: new Set<number>(),
    bulletHitSmall: new Array(N_SMALL - 1).fill(0),
    bulletHitLarge: new Array(N_LARGE - 1).fill(0),
    // Hook tool (小肠露出)
    hookToolType: null,
    hookRodLength: 90,
    hookPos: null,
    hookAnchor: null,
    hookInserted: false,
    hookGrabActive: false,
    hookedSmallSegIdx: -1,
    hookedPendingIndices: [],
    exposedSmallIndices: [],
    exposurePendingTrigger: false,
    // Capsule bomb system
    capsuleBombs: [],
  };
}
