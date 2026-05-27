import {
  N_SMALL, N_LARGE, CAVITY_CX, EXPANSION_SCALE_DEFAULT,
  PRESSURE_DIFFUSION_RATE_DEFAULT, createDefaultToolStates,
} from '../constants/gameConfig';
import type { PhysicsNode, PhysicsState, SegmentProps } from './physics';

function makeNode(x: number, y: number, pinned = false): PhysicsNode {
  return { x, y, px: x, py: y, rx: x, ry: y, pinned };
}

function makeSeg(): SegmentProps {
  return { health: 100, sensitivity: 0, pain: 0, pressure: 0, ruptured: false, broken: false, perforated: false };
}

// Small intestine: starts at stomach/duodenum junction (top-center, pinned),
// coils in 7 serpentine rows through the center of the cavity,
// ends at terminal ileum near the cecum (lower-left).
// Cavity: cx=170, cy=240, rx=118, ry=148
// Row x-range: 116–220 (well inside large intestine frame)
// Row y-range: 158–314, spacing 26px
function buildSmallIntestineNodes(): PhysicsNode[] {
  const nodes: PhysicsNode[] = [];

  // [0] Stomach / duodenum junction — top-center, pinned
  nodes.push(makeNode(170, 130, true));

  // [1] Transition: bridge from stomach to first row start (upper-right)
  nodes.push(makeNode(194, 148));

  // 7 serpentine rows, x: 116↔220, y: 158→314, step 26px
  // Even rows (0,2,4,6) go Right→Left; odd rows (1,3,5) go Left→Right
  const xL = 116, xM1 = 142, xC = 168, xM2 = 194, xR = 220;
  const rowXRight = [xR, xM2, xC, xM1, xL];
  const rowXLeft  = [xL, xM1, xC, xM2, xR];

  for (let row = 0; row < 7; row++) {
    const y = 158 + row * 26;
    const xs = (row % 2 === 0) ? rowXRight : rowXLeft;
    for (const x of xs) nodes.push(makeNode(x, y));
  }
  // Indices [2..36]: 35 nodes across 7 rows

  // [37] Terminal ileum — approaches cecum (100, 340) from slightly above-right
  nodes.push(makeNode(108, 332));

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
  nodes.push(makeNode(100, 340, true));

  // Ascending colon: left side going up (indices 1–8)
  nodes.push(makeNode( 96, 316));
  nodes.push(makeNode( 90, 292));
  nodes.push(makeNode( 86, 268));
  nodes.push(makeNode( 84, 244));
  nodes.push(makeNode( 83, 220));
  nodes.push(makeNode( 83, 196));
  nodes.push(makeNode( 84, 172));
  nodes.push(makeNode( 88, 148));

  // [9] Left (hepatic) flexure — top-left corner
  nodes.push(makeNode( 92, 132));

  // Transverse colon: top, slight downward sag at center (indices 10–14)
  nodes.push(makeNode(116, 128));
  nodes.push(makeNode(140, 124));
  nodes.push(makeNode(170, 122));
  nodes.push(makeNode(200, 124));
  nodes.push(makeNode(226, 128));

  // [15] Right (splenic) flexure — top-right corner
  nodes.push(makeNode(246, 134));

  // Descending colon: right side going down (indices 16–22)
  nodes.push(makeNode(254, 158));
  nodes.push(makeNode(258, 184));
  nodes.push(makeNode(260, 210));
  nodes.push(makeNode(260, 236));
  nodes.push(makeNode(258, 262));
  nodes.push(makeNode(254, 288));
  nodes.push(makeNode(248, 312));

  // Sigmoid colon: S-curve from lower-right toward bottom-center (indices 23–28)
  // Simulates the rectosigmoid junction the user described as "乙状弯折"
  nodes.push(makeNode(250, 334));
  nodes.push(makeNode(242, 352));
  nodes.push(makeNode(224, 362));
  nodes.push(makeNode(204, 368));
  nodes.push(makeNode(185, 372));
  nodes.push(makeNode(172, 376));

  // [29] Anus — bottom-center, pinned
  nodes.push(makeNode(170, 382, true));

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
