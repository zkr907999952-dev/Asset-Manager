---
name: Vibrating egg architecture
description: Direction of travel, physics placement, and rendering pattern for the 吞入跳蛋 tool.
---

## Direction of travel (opposite to silicone/beads)
- Silicone/beads enter from the anus (largeNodes[N_LARGE-1]), travel toward cecum (largeNodes[0]), then cross to smallNodes[N_SMALL-1] (terminal ileum) and up toward smaller indices.
- Egg enters at smallNodes[0] (duodenum, pinned top-center ~170,130), travels toward **higher** small indices, then crosses ileocecal junction to largeNodes[0] (cecum).

## Physics block placement
The egg physics `if (state.toolType === '吞入跳蛋') { ... }` sits OUTSIDE the `if (state.toolPos) { ... }` block in stepPhysics, at 4-space indent, between the end of the toolPos block and the SECONDARY TOOL PHYSICS section. This is intentional — the egg doesn't need toolPos since it uses index-based positioning.

**Why:** The egg operates via eggSmallHeadIdx/eggLargeHeadIdx, not cursor position. Running it outside toolPos ensures physics apply every frame regardless of whether the user is dragging.

**How to apply:** When adding egg physics code, be careful not to add an extra `  }` brace — the common mistake is adding one extra closing brace that prematurely closes stepPhysics.

## State fields (PhysicsState + GameUIState)
- `eggSmallHeadIdx: number` — 0 = duodenum, N_SMALL-1 = terminal ileum
- `eggInLarge: boolean` — true when egg has crossed ileocecal junction
- `eggLargeHeadIdx: number` — 0 = cecum, N_LARGE-1 = anus

## Animation loop (eggAnimRef)
- `targetSmallIdx`, `targetInLarge`, `targetLargeIdx`, `lastStepTime`
- Speed: `speedMs = max(100, 450 - param2 * 3.5)` ms per step
- Crosses junction: small[N_SMALL-1] → large[0] when targetInLarge=true

## Control line rendering
- Pink dashed path following intestine from duodenum (node 0) to egg position
- Short upward extension from node 0 (thread going out toward mouth)
- When in large intestine: full small path + large path from 0 to largeIdx

## Touch handling
- Touch near small intestine node → setEggTarget({ smallIdx })
- Touch near terminal ileum/cecum → setEggTarget({ inLarge: true, largeIdx: 0 })
- Touch near large intestine node (when in large) → setEggTarget({ largeIdx, inLarge: true })
- Drag applies gentle force (f=0.18) to nearby intestine nodes like silicone/beads
