---
name: Belly strike system architecture
description: How the 腹击 (belly strike) feature is wired across ToolBar, GameContext, physics, and SimulationCanvas.
---

## Architecture overview

**Files involved:**
- `constants/gameConfig.ts` — `BELLY_STRIKE_TOOLS`, `BellyStrikeToolId`, `BellyStrikeToolDef`, `BELLY_STRIKE_TOOL_LIST`
- `constants/dialogues.ts` + `dialogues-data.json` — 9 new triggers: `strike_{fist|bat|hammer}_{low|mid|high}`
- `components/BellyStrikePanel.tsx` — panel UI (tool selector + force/range sliders)
- `components/ToolBar.tsx` — 4th tab "腹击" added, TAB_SPACING=72, WRAPPER_HEIGHT=440
- `contexts/GameContext.tsx` — 3 state fields + `bellyStrikeRef` for stale-closure safety + `applyBellyStrike` callback
- `engine/physics.ts` — `applyBellyStrikePhysics()` exported function
- `components/SimulationCanvas.tsx` — PanResponder belly strike interception, SVG range overlay, Animated flash

## Icon vs Animation asset separation

**Panel icons** (`BellyStrikePanel.tsx`) — all SVG components, no PNG:
- `icons/StrikeFistIcon.tsx` — front-view fist (36×36)
- `icons/StrikeBatIcon.tsx` — angled bat (36×36)
- `icons/StrikeHammerIcon.tsx` — suspended log hammer (36×36, existing)

**Animation overlays** (`SimulationCanvas.tsx`, `STRIKE_ANIM_COMPONENTS`) — SVG components rendered via `<AnimComp width height />`:
- `icons/StrikeFistAnim.tsx` — rear view of fist (knuckles toward viewer)
- `icons/StrikeBatAnim.tsx` — flat side view bat (barrel left, handle right)
- `icons/StrikeHammerAnim.tsx` — thick log face-on (tree-ring cross-section)

**Why separated:** Icons need compact 36×36 designs readable at small size; animations need expressive full-detail art scaled to match the hit-range silhouette. Sharing one asset forced a bad compromise on both.

## Delays (as of last update)
- Fist: 200ms, Bat: 500ms, Hammer: 1000ms (halved from original 400/1000/2000)

## Key design decisions

**Why bellyStrikeRef in GameContext:**
`applyBellyStrike` is called from PanResponder (stale closure context). It reads `bellyStrikeRef.current.{tool, force, range}` which is always up-to-date because the setters update both the ref and setState.

**PanResponder interception pattern:**
In `onPanResponderGrant/Move/Release`, the belly strike path is checked FIRST (before all other tool handling), returning early so normal tool drag logic is skipped when in strike mode.

**Drag → Release flow:**
1. Grant: `bellyStrikeDragRef.current.active = true`, set strikeOverlay (dashed outline)
2. Move: update physX/physY in ref, update strikeOverlay for live preview
3. Release: set charging=true, start `Animated.timing` for visual charge effect, `setTimeout(delayMs)` → call `applyBellyStrike(physX, physY)` → flash animation → clear overlay

**Bat range shape:**
Extends rightward from touch point: width = rangePx×2, height = rangePx×0.35. Power increases toward the right tip (tipFactor = bx/batW). Handle side has a small ±15% overlap for visual continuity.

**useNativeDriver:**
Must be `false` on web (Expo web doesn't support native animated module). Using `true` triggers a warning and falls back to JS anyway.

**Why:**
The existing hrRef pattern (refs updated each render, PanResponder reads from ref) is the correct approach for async callbacks in this architecture.
