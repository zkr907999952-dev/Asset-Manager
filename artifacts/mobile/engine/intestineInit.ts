import {
  N_SMALL, N_LARGE, CAVITY_CX, CAVITY_CY,
} from '../constants/gameConfig';
import type { PhysicsNode, PhysicsState, SegmentProps } from './physics';

function makeNode(x: number, y: number, pinned = false): PhysicsNode {
  return { x, y, px: x, py: y, rx: x, ry: y, pinned };
}

function makeSeg(): SegmentProps {
  return { health: 100, sensitivity: 0, pain: 0, pressure: 0, ruptured: false, broken: false, perforated: false };
}

// Small intestine: organic curved coils filling the center of the cavity,
// modeled on anatomical reference (dense loops with rounded turns).
// Cavity: cx=170, cy=240, rx=118, ry=148
function buildSmallIntestineNodes(): PhysicsNode[] {
  const cx = CAVITY_CX;
  const nodes: PhysicsNode[] = [];

  // 5 horizontal serpentine loops, each ~5 nodes wide, with slight vertical jitter
  // for an organic look. Y-range: 158 → 300 keeps it well clear of cavity edges.
  const loops: { y: number; x0: number; x1: number; jitter: number }[] = [
    { y: 158, x0: cx - 56, x1: cx + 60, jitter: 4 },
    { y: 190, x0: cx + 62, x1: cx - 62, jitter: -3 },
    { y: 222, x0: cx - 60, x1: cx + 64, jitter: 5 },
    { y: 254, x0: cx + 62, x1: cx - 58, jitter: -4 },
    { y: 286, x0: cx - 54, x1: cx + 56, jitter: 3 },
  ];

  loops.forEach((loop, li) => {
    const cols = 5;
    for (let i = 0; i < cols; i++) {
      const t = i / (cols - 1);
      const x = loop.x0 + (loop.x1 - loop.x0) * t;
      // Add curvature: sine wave bulge toward midline alternation
      const curve = Math.sin(t * Math.PI) * loop.jitter;
      const y = loop.y + curve + (li % 2 === 0 ? -1 : 1);
      nodes.push(makeNode(x, y));
    }
  });

  return nodes;
}

// Large intestine: anatomical U-frame around small intestine.
// Order: cecum (bottom-right) → ascending → hepatic flexure → transverse →
//        splenic flexure → descending → sigmoid → rectum (bottom-center).
// All nodes verified inside cavity ellipse: (x-170)²/118² + (y-240)²/148² < 1
function buildLargeIntestineNodes(): PhysicsNode[] {
  const cx = CAVITY_CX;  // 170
  const cy = CAVITY_CY;  // 240
  const nodes: PhysicsNode[] = [];

  // Cecum + appendix bulge (bottom-right, pinned start)
  nodes.push(makeNode(cx + 78, cy + 92, true));    // (248,332) — cecum anchor

  // Ascending colon (right side, bottom→top)
  nodes.push(makeNode(cx + 92, cy + 60));          // (262,300)
  nodes.push(makeNode(cx + 98, cy + 20));          // (268,260)
  nodes.push(makeNode(cx + 98, cy - 20));          // (268,220)
  nodes.push(makeNode(cx + 92, cy - 60));          // (262,180)

  // Hepatic flexure (top-right corner)
  nodes.push(makeNode(cx + 68, cy - 100));         // (238,140)

  // Transverse colon (top, slight downward sag in middle like reference)
  nodes.push(makeNode(cx + 34, cy - 112));         // (204,128)
  nodes.push(makeNode(cx, cy - 108));              // (170,132) — sag
  nodes.push(makeNode(cx - 34, cy - 112));         // (136,128)

  // Splenic flexure (top-left corner, slightly higher than hepatic — anatomical)
  nodes.push(makeNode(cx - 68, cy - 100));         // (102,140)

  // Descending colon (left side, top→bottom)
  nodes.push(makeNode(cx - 92, cy - 60));          // (78,180)
  nodes.push(makeNode(cx - 98, cy - 20));          // (72,220)
  nodes.push(makeNode(cx - 98, cy + 20));          // (72,260)
  nodes.push(makeNode(cx - 92, cy + 60));          // (78,300)

  // Sigmoid colon (S-curve from descending toward midline rectum)
  nodes.push(makeNode(cx - 72, cy + 96));          // (98,336) — sigmoid loop 1
  nodes.push(makeNode(cx - 40, cy + 116));         // (130,356) — sigmoid loop 2 (down)
  nodes.push(makeNode(cx - 14, cy + 108));         // (156,348) — sigmoid loop 3 (up)
  nodes.push(makeNode(cx + 6, cy + 116));          // (176,356) — toward midline
  nodes.push(makeNode(cx + 14, cy + 102));         // (184,342) — rectum approach

  // Rectum/anus (pinned end at midline-bottom)
  nodes.push(makeNode(cx + 4, cy + 124, true));    // (174,364)

  return nodes;
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
    enemaHeadIdx: Math.floor(N_LARGE / 2),
    enemaInSmall: false,
    enemaSmallHeadIdx: N_SMALL - 1,
  };
}
