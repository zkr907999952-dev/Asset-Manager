import {
  N_SMALL, N_LARGE, CAVITY_CX, CAVITY_CY,
} from '../constants/gameConfig';
import type { PhysicsNode, PhysicsState, SegmentProps } from './physics';

function makeNode(x: number, y: number, pinned = false): PhysicsNode {
  return { x, y, px: x, py: y, rx: x, ry: y, pinned };
}

function makeSeg(): SegmentProps {
  return { health: 100, sensitivity: 0, pain: 0, pressure: 0, ruptured: false, broken: false };
}

// Small intestine: snake/zigzag in center of cavity
function buildSmallIntestineNodes(): PhysicsNode[] {
  const cx = CAVITY_CX;
  const nodes: PhysicsNode[] = [];
  const rowYs = [152, 180, 208, 236, 264];
  const rowXStart = cx - 68;
  const colSpacing = 34;
  const cols = 5;

  for (let row = 0; row < rowYs.length; row++) {
    const y = rowYs[row];
    for (let col = 0; col < cols; col++) {
      const c = row % 2 === 0 ? col : (cols - 1 - col);
      const x = rowXStart + c * colSpacing;
      nodes.push(makeNode(x, y));
    }
  }
  return nodes;
}

// Large intestine: perimeter path, all nodes verified inside cavity ellipse
// Cavity: cx=170, cy=240, rx=118, ry=148
// Safety check: (x-170)^2/118^2 + (y-240)^2/148^2 < 1
function buildLargeIntestineNodes(): PhysicsNode[] {
  const cx = CAVITY_CX;  // 170
  const cy = CAVITY_CY;  // 240
  const nodes: PhysicsNode[] = [];

  // Anus / cecum (pinned start)
  nodes.push(makeNode(cx + 40, cy + 90, true));   // (210,330) → 0.485 ✓

  // Ascending colon (right side, bottom to top)
  nodes.push(makeNode(cx + 80, cy + 60));          // (250,300) → 0.623 ✓
  nodes.push(makeNode(cx + 94, cy + 20));          // (264,260) → 0.655 ✓
  nodes.push(makeNode(cx + 94, cy - 20));          // (264,220) → 0.655 ✓
  nodes.push(makeNode(cx + 80, cy - 60));          // (250,180) → 0.623 ✓

  // Hepatic flexure (top-right)
  nodes.push(makeNode(cx + 58, cy - 102));         // (228,138) → 0.720 ✓

  // Transverse colon (top)
  nodes.push(makeNode(cx + 28, cy - 118));         // (198,122) → 0.697 ✓
  nodes.push(makeNode(cx, cy - 120));              // (170,120) → 0.657 ✓
  nodes.push(makeNode(cx - 28, cy - 118));         // (142,122) → 0.697 ✓

  // Splenic flexure (top-left)
  nodes.push(makeNode(cx - 58, cy - 102));         // (112,138) → 0.720 ✓

  // Descending colon (left side, top to bottom)
  nodes.push(makeNode(cx - 80, cy - 60));          // (90,180) → 0.623 ✓
  nodes.push(makeNode(cx - 94, cy - 20));          // (76,220) → 0.655 ✓
  nodes.push(makeNode(cx - 94, cy + 20));          // (76,260) → 0.655 ✓
  nodes.push(makeNode(cx - 80, cy + 60));          // (90,300) → 0.623 ✓

  // Sigmoid colon (bottom, turning right toward anus)
  nodes.push(makeNode(cx - 58, cy + 90));          // (112,330) → 0.629 ✓
  nodes.push(makeNode(cx - 28, cy + 110));         // (142,350) → 0.617 ✓
  nodes.push(makeNode(cx, cy + 116));              // (170,356) → 0.615 ✓
  nodes.push(makeNode(cx + 28, cy + 110));         // (198,350) → 0.617 ✓
  nodes.push(makeNode(cx + 38, cy + 94));          // (208,334) → 0.507 ✓

  // Anus (pinned end — closes the loop)
  nodes.push(makeNode(cx + 40, cy + 90, true));    // (210,330) → 0.485 ✓

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
    toolPos: null,
    toolType: null,
    toolActive: false,
    toolParam1: 50,
    toolParam2: 50,
    anchorPos: null,
    grabbedNode: null,
    electrodes: [],
  };
}
