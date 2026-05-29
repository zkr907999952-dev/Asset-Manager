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
  return { health: 100, sensitivity: 0, pain: 0, pressure: 0, ruptured: false, broken: false, perforated: false };
}

// Scale factor applied to all initial node positions from cavity center.
const INIT_SCALE = 1.1;
function scalePos(x: number, y: number): [number, number] {
  return [
    CAVITY_CX + (x - CAVITY_CX) * INIT_SCALE,
    CAVITY_CY + (y - CAVITY_CY) * INIT_SCALE,
  ];
}

// Small intestine: 56 nodes
// [0]         — Stomach/duodenum junction (pinned, top-center)
// [1]         — Duodenal bridge (R transition)
// [2–51]      — 10 serpentine rows × 5 nodes, denser jejunum/ileum coiling
//               Even rows (0,2,4,6,8) R→L; Odd rows (1,3,5,7,9) L→R
//               y spacing 18px, x range 110–228
// [52–55]     — Terminal ileum curving down-left toward cecum
//
// Jejunum (rows 0–4, upper zone): wider loops, larger radius, more motility
// Ileum (rows 5–9, lower zone): tighter loops, approaching cecum
// Cavity: cx=170, cy=248, rx=148, ry=175
export function buildSmallIntestineNodes(): PhysicsNode[] {
  const nodes: PhysicsNode[] = [];

  // [0] Stomach/duodenum junction — top-center, pinned
  {
    const [x, y] = scalePos(170, 130);
    nodes.push(makeNode(x, y, true));
  }

  // [1] Duodenal bridge — curves right to reach row 0 start
  {
    const [x, y] = scalePos(210, 148);
    nodes.push(makeNode(x, y));
  }

  // [2–51] 10 serpentine rows through the abdominal center
  // x-positions: xL=110, xM1=138, xC=166, xM2=194, xR=222
  // y-positions: row i → y = 155 + i * 18
  const xL = 110, xM1 = 138, xC = 166, xM2 = 194, xR = 222;
  const rowXRight = [xR, xM2, xC, xM1, xL]; // even rows R→L
  const rowXLeft  = [xL, xM1, xC, xM2, xR]; // odd rows L→R

  for (let row = 0; row < 10; row++) {
    const y = 155 + row * 18;
    const xs = (row % 2 === 0) ? rowXRight : rowXLeft;
    for (const x of xs) {
      const [sx, sy] = scalePos(x, y);
      nodes.push(makeNode(sx, sy));
    }
  }
  // Indices [2..51]: 50 nodes across 10 rows

  // [52–55] Terminal ileum — turns left-down from row 9 end (xR, y=317) to approach cecum
  // Row 9 is odd → L→R → ends at xR=222, y=317
  const terminalIleum: [number, number][] = [
    [196, 322], // curve starts going left
    [162, 328], // continues left
    [128, 336], // approaching cecum zone
    [106, 346], // near cecum at (100, 340)
  ];
  for (const [x, y] of terminalIleum) {
    const [sx, sy] = scalePos(x, y);
    nodes.push(makeNode(sx, sy));
  }

  return nodes; // 56 nodes total (N_SMALL = 56)
}

// Large intestine: 32 nodes
// Runs CLOCKWISE around the small intestine perimeter.
// Cecum [0] is UNPINNED — uses strong mesentery spring to spring back after drag.
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

  // [10–14] Transverse colon: top, slight downward sag at center
  const transverse: [number, number][] = [
    [116, 126], [140, 122], [170, 120], [200, 122], [228, 126],
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
  // [27] Rectum entry from sigmoid
  // [28] Sacral flexure — curves backward (left/up)
  // [29] Sacral apex — deepest backward point
  // [30] Perineal flexure — curves forward-down before anus
  const rectum: [number, number][] = [
    [168, 356], // entry
    [158, 350], // sacral flexure — moved right toward center
    [154, 364], // sacral apex — moved right toward center
    [162, 377], // perineal flexure — moved right toward center
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
    electrodes: [],
    enemaHeadIdx: N_LARGE - 1,
    enemaInSmall: false,
    enemaSmallHeadIdx: N_SMALL - 1,
    expansionScale: EXPANSION_SCALE_DEFAULT,
    pressureDiffusionRate: PRESSURE_DIFFUSION_RATE_DEFAULT,
    toolStates: createDefaultToolStates(),
    relaxFrames: 0,
    laxativeFrames: 0,
    hpBonus: 0,
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
  };
}
