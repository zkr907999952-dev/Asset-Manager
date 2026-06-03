---
name: Mobile SVG render bottleneck
description: Why react-native-svg causes 8fps on mobile and how to fix it
---

# Mobile SVG Render Bottleneck

## The Problem
react-native-svg renders each SVG element as a separate native view. With N_SMALL=66 and N_LARGE=32 nodes, the old code produced ~257 SVG elements per frame:
- Small intestine outline pass: 65 `<Path>` (fixed color, but one per segment)
- Small intestine fill pass: 65 `<G>` × 2 `<Path>` each = 130 elements
- Large intestine fill pass: 31 `<G>` × 2 `<Path>` each = 62 elements
- Also: `buildSmoothSegPath` called 2× per segment (130 redundant string builds)
- Also: large intestine rupture markers rendered twice (duplicate map block)

At 30fps physics this meant ~7,700+ native view reconciliations/second → 8fps on mobile.
Browser is unaffected because web SVG is handled natively in the render pipeline.

## The Fix (SimulationCanvas.tsx)
1. **Pre-compute all path strings once** before the JSX return using `smallSegPaths[]` and `largeSegPaths[]` arrays — eliminates duplicate `buildSmoothSegPath` calls.
2. **Merge fixed-color passes** into single combined path strings (`smallCombinedOutline`, `smallCombinedHighlight`, `largeCombinedHighlight`) using array `.join(' ')`.
3. **Single Path elements** for outline and highlight passes (was 65+31=96 elements, now 2).
4. **Remove `<G>` wrappers** from per-segment fill renders — flat `<Path>` per segment.
5. **Remove duplicate large intestine rupture map** (was rendered twice, once in the large intestine section and once after small intestine markers).
6. **Reduce PHYSICS_ITERATIONS** from 5 → 3 (40% physics CPU reduction, imperceptible quality loss).

**Why:**
`react-native-svg` on iOS/Android creates a native layer for every SVG element. The browser has no such overhead. The fix reduces ~257 elements → ~100 per frame.

**How to apply:**
When adding new intestine rendering passes in SimulationCanvas, ALWAYS check:
- Does this pass use a fixed color? → Merge into a single combined path.
- Am I calling buildSmoothSegPath in multiple map passes? → Pre-compute into arrays.
- Am I adding a G wrapper? → Only use G when truly necessary (e.g., multiple children with shared transform).
