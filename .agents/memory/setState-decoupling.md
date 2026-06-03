---
name: React setState decoupling for SimulationCanvas
description: Architecture for decoupling SimulationCanvas renders from GameContext setState, eliminating 15fps context re-renders as the physics bottleneck.
---

## The Rule
SimulationCanvas must NOT rely on GameContext setState to drive its render cadence. It uses its own RAF loop driven by `renderVersionRef`.

**Why:** syncFromPhysics was calling setState 15x/sec, triggering ALL 7+ useGame() subscribers (including SimulationCanvas with 400+ SVG elements). Combined with the 80ms animation timer (12.5x/sec), this saturated the JS thread and caused ~8fps on real devices.

## How to Apply

### renderVersionRef pattern
- `renderVersionRef = useRef(0)` declared in GameProvider
- `renderVersionRef: React.MutableRefObject<number>` added to GameContextType
- `renderVersionRef` exposed in context value
- In `syncFromPhysics`: `renderVersionRef.current++` every call (fast path) — NO setState in fast path
- `setState` in syncFromPhysics only fires in slow path: `if (isSlowSync) setState(...)` (every 15 frames = ~2fps)

### SimulationCanvas RAF loop
```tsx
const [, forceRender] = useState(0);        // requires useState import
const lastSeenRenderVersion = useRef(-1);
const canvasRafRef = useRef<number | null>(null);
useEffect(() => {                             // requires useEffect import!
  const tick = () => {
    if (renderVersionRef.current !== lastSeenRenderVersion.current) {
      lastSeenRenderVersion.current = renderVersionRef.current;
      forceRender(v => v + 1);
    }
    canvasRafRef.current = requestAnimationFrame(tick);
  };
  canvasRafRef.current = requestAnimationFrame(tick);
  return () => { if (canvasRafRef.current !== null) cancelAnimationFrame(canvasRafRef.current); };
}, []);
```

**CRITICAL:** `useEffect` must be in the React import. Forgetting it causes "Invalid hook call" crash (not a compile error in Metro).

### physicsRef direct reads in SimulationCanvas
All fast-changing tool state is defined at the top of the render body:
```tsx
const p = physicsRef.current;
const activeTool = p.toolType;
const toolPos = p.toolPos;
const toolActive = p.toolActive;
// ... all head indices, toolParam1/2, navelPierced, etc.
```

These shadow any stale `state.xxx` values. The JSX uses the local consts.

### Animation timer setState removal
The 80ms merged animation timer (silicone/beads/egg) and 300ms enema timer both used `setState` to trigger SimulationCanvas re-renders. These are now removed — only physicsRef writes remain. The `upd` object is suppressed with `void upd` to avoid unused-variable warnings.

## Result
- syncFromPhysics: 0 setState/sec in fast path (was 15/sec)
- Animation timers: 0 setState/sec (was 12.5/sec)  
- All useGame() subscribers: ~2 re-renders/sec from slow sync + user interactions (was 27+/sec)
- SimulationCanvas: 15fps from own RAF (clean, driven by physics)
