---
name: SVG gradient leak in react-native-svg web
description: Gradients defined in SVG Defs can visually leak on web builds; a solid background Rect prevents this.
---

# Rule
Always add a solid-fill background `<Rect>` as the **first child** of the `<Svg>` element:
```tsx
<Rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#0a0202" />
```

**Why:** In react-native-svg on web (Expo web), `RadialGradient` or `LinearGradient` definitions in `<Defs>` can sometimes be applied as a default fill on the SVG viewport element itself, producing a large gradient fill behind all content. The background Rect covers this artifact.

**How to apply:** Any time the SimulationCanvas SVG is modified, ensure this Rect remains the first SVG child before any `<Defs>` blocks or content elements.
