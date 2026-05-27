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
// Makes the intestines fill the cavity more naturally.
const INIT_SCALE = 1.1;
function scalePos(x: number, y: number): [number, number] {
  return [
    CAVITY_CX + (x - CAVITY_CX) * INIT_SCALE,
    CAVITY_CY + (y - CAVITY_CY) * INIT_SCALE,
  ];
}

// Small intestine: starts at stomach/duodenum junction (top-center, pinned),
// coils in 7 serpentine rows through the center of the cavity,
// ends at terminal ileum near the cecum (lower-left).
// Cavity: cx=170, cy=248, rx=148, ry=175
// Row x-range: 116–220 (well inside large intestine frame)
// Row y-range: 158–314, spacing 26px
function buildSmallIntestineNodes(): PhysicsNode[] {
  const nodes: PhysicsNode[] = [];

  // [0] Stomach / duodenum junction — top-center, pinned
  {
    const [x, y] = scalePos(170, 130);
    nodes.push(makeNode(x, y, true));
  }

  // [1] Transition: bridge from stomach to first row start (upper-right)
  {
    const [x, y] = scalePos(194, 148);
    nodes.push(makeNode(x, y));
  }

  // 7 serpentine rows, x: 116↔220, y: 158→314, step 26px
  // Even rows (0,2,4,6) go Right→Left; odd rows (1,3,5) go Left→Right
  const xL = 116, xM1 = 142, xC = 168, xM2 = 194, xR = 220;
  const rowXRight = [xR, xM2, xC, xM1, xL];
  const rowXLeft  = [xL, xM1, xC, xM2, xR];

  for (let row = 0; row < 7; row++) {
    const y = 158 + row * 26;
    const xs = (row % 2 === 0) ? rowXRight : rowXLeft;
    for (const x of xs) {
      const [sx, sy] = scalePos(x, y);
      nodes.push(makeNode(sx, sy));
    }
  }
  // Indices [2..36]: 35 nodes across 7 rows

  // [37] Terminal ileum — approaches cecum from slightly above-right
  {
    const [x, y] = scalePos(108, 332);
    nodes.push(makeNode(x, y));
  }

  return nodes; // 38 nodes total (N_SMALL = 38)
}

// Large intestine: starts at cecum (lower-left, pinned),
// goes CLOCKWISE around the small intestine:
//   cecum (lower-left) → ascending (left side going UP) →
//   left flexure (top-left) → transverse (top, L→R) →
//   right flexure (top-right) → descending (right side going DOWN) →
//   sigmoid S-curve → anus (bottom-center, pinned)
// All nodes verified inside cavity ellipse: (x-170)²/118² + (y-240)²/148² ≤ 1
function buildLargeIntestineNodes(): PhysicsNode[] {
  const nodes: PhysicsNode[] = [];

  // [0] Cecum — lower left, pinned. Ileocecal spring connects here to smallNodes[N_SMALL-1].
  {
    const [x, y] = scalePos(100, 340);
    nodes.push(makeNode(x, y, true));
  }

  // Ascending colon: left side going up (indices 1–8)
  const ascDesc: [number, number][] = [
    [ 96, 316], [ 90, 292], [ 86, 268], [ 84, 244],
    [ 83, 220], [ 83, 196], [ 84, 172], [ 88, 148],
  ];
  for (const [x, y] of ascDesc) {
    const [sx, sy] = scalePos(x, y);
    nodes.push(makeNode(sx, sy));
  }

  // [9] Left (hepatic) flexure — top-left corner
  {
    const [x, y] = scalePos(92, 132);
    nodes.push(makeNode(x, y));
  }

  // Transverse colon: top, slight downward sag at center (indices 10–14)
  const transverse: [number, number][] = [
    [116, 128], [140, 124], [170, 122], [200, 124], [226, 128],
  ];
  for (const [x, y] of transverse) {
    const [sx, sy] = scalePos(x, y);
    nodes.push(makeNode(sx, sy));
  }

  // [15] Right (splenic) flexure — top-right corner
  {
    const [x, y] = scalePos(246, 134);
    nodes.push(makeNode(x, y));
  }

  // Descending colon: right side going down (indices 16–22)
  const descending: [number, number][] = [
    [254, 158], [258, 184], [260, 210], [260, 236],
    [258, 262], [254, 288], [248, 312],
  ];
  for (const [x, y] of descending) {
    const [sx, sy] = scalePos(x, y);
    nodes.push(makeNode(sx, sy));
  }

  // Sigmoid colon: S-curve from lower-right toward bottom-center (indices 23–28)
  const sigmoid: [number, number][] = [
    [250, 334], [242, 352], [224, 362], [204, 368], [185, 372], [172, 376],
  ];
  for (const [x, y] of sigmoid) {
    const [sx, sy] = scalePos(x, y);
    nodes.push(makeNode(sx, sy));
  }

  // [29] Anus — bottom-center, pinned
  {
    const [x, y] = scalePos(170, 382);
    nodes.push(makeNode(x, y, true));
  }

  return nodes; // 30 nodes total (N_LARGE = 30)
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
  };
}
