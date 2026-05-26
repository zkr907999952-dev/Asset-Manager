---
name: Intestine node cavity bounds
description: Large intestine nodes must be inside the cavity ellipse or segments render visibly outside the ellipse boundary.
---

# Rule
Before finalising any `buildLargeIntestineNodes()` positions, verify every node satisfies:
`(x - CAVITY_CX)² / CAVITY_RX² + (y - CAVITY_CY)² / CAVITY_RY² < 1`

**Why:** SVG Line strokes extend strokeWidth/2 on each side. A node sitting outside or on the edge of the cavity ellipse causes the stroke to visibly overflow the ellipse boundary, producing a thick skin-tone bar above the cavity. This was the root cause of the pink vertical bar bug during initial development.

**How to apply:** When changing CAVITY dimensions or intestine layout, audit every node coordinate against the ellipse formula. Keep a margin of at least LARGE_RADIUS (currently 14px) from the boundary to account for stroke overflow. Currently safe positions use roughly 82% of the cavity radius.
