# Design notes

Rationale for decisions that deliberately deviate from a literal 1:1 Figma reproduction.
Read the relevant section before touching one of these areas.

## Breakpoints

- **Content breakpoint: `900px`.** Mobile-first; below it matches the `Home mobile` Figma
  frame, above it matches `Home desktop`. Not tied to any device class — it's the width
  where the desktop grids (3-col `.value-tiles`, 4-col `.site-footer__columns`) stop feeling
  cramped.
- **Header nav breakpoint: `1280px`**, separate from the content breakpoint
  ([header.css](../src/styles/header.css)). Logo + 6 links + Kontakt button don't reliably
  fit in one line below that width, even though page content is still comfortably desktop at
  900–1280px. [header-nav.js](../src/scripts/header-nav.js) also measures actual overflow at
  runtime and adds `.nav-overflow` to `<body>` as a fallback for unusual zoom/font metrics —
  `mobile-menu.js` checks the toggle button's computed `display` rather than duplicating a
  breakpoint number, so it stays in sync with either trigger.
- No shared CSS variable drives these — `@media (min-width: var(--x))` isn't valid CSS and
  this project has no preprocessor (see CLAUDE.md). A future breakpoint change means a
  sitewide find-and-replace across `src/styles/*.css`, not editing one token.

## Shared two-column grid

`.section-heading`, `.career__content`, `.contact__layout`, `.approach-tiles`,
`.leader-tiles`, and the reference/value/area tile grids all share one alignment system so
columns line up across sections:

- `grid-template-columns: 1fr 1fr` (never a fixed-px first column) with `column-gap:
  var(--grid-col-gap)` ([tokens.css](../src/styles/tokens.css)) — row-gap can differ per
  component, column-gap must not.
- `min-width: 0` on every grid item — grid items default to their content's min-content
  width, which can force a track wider than its fair share (long titles, unbreakable words).
- `overflow-wrap: break-word` as a safety net only, not the primary fix — a grid that
  regularly needs it at a common width should get an intermediate column-count tier instead
  (2 columns from 900px, full count from ~1100–1200px) or a stepped-down font size, not rely
  on mid-word breaks as the normal case.

`.value-tiles` additionally keeps its photo tile from dictating row height: the image is
`position: absolute; inset: 0` with `object-fit: cover` from 900px up (removed from its own
tile's intrinsic sizing) instead of `aspect-ratio`, which would otherwise force the whole row
to the image's height. Mobile keeps `aspect-ratio` since the tile has no row sibling there.

**Desktop side padding** is stepped tiers in tokens.css (64/96/140/240px at
900/1280/1440/1728px), not a fluid `clamp()` — a continuous curve gave too little control
over how padding felt through the 900–1440px range specifically.

## Header

- **Nav ghost indicator** (`.site-nav__ghost`) is positioned against `.site-header__inner`'s
  bounding rect, not the `<nav>`'s, so it stays flush with the header's bottom edge
  regardless of the nav's own vertical centering. At rest it tracks scroll position via a
  scrollspy (`watchActiveSection()` in header-nav.js); hover/focus overrides it. Any nav link
  needs an `href="#id"` matching a real section id, or the scrollspy silently skips it.
- **Language toggle flags** (`.lang-toggle`, `src/assets/icons/flag-*.svg`): border and
  rounding are baked into the SVG artwork itself (a `clipPath` plus a flat "donut" border
  shape), not drawn in CSS. CSS-side clipping (border-radius + overflow, outline, box-shadow,
  nested luminance masks) proved unreliable specifically on iOS Safari at this icon's small
  size — see git history on `header.css`/`flag-*.svg` if this needs revisiting. `.lang-toggle`
  itself is just the click target (40px mobile / 38px desktop) with the flag centered inside;
  hover swaps to a second, pre-bordered SVG rather than a CSS color change.

## Section-cover pin/reveal transition

Two adjacent full-bleed sections ("ŘEŠENÍ"→"Naše technologické domény",
"Kdo jsme"→"Reference") use a pinned-cover effect: the first section freezes in place while
the second rises over it. Implemented in
[section-cover.js](../src/scripts/section-cover.js) as a hand-rolled freeze
(`getBoundingClientRect()`-measured `position: fixed`) rather than GSAP's `pin: true` — the
GSAP version had a Safari-only regression (stuck compensating transform on unpin) that a
structural rewrite resolved more reliably than patching around it.

Rules worth keeping in mind before editing this file again:

- Freeze position/size (`top`, `left`, `width`) must be computed from the trigger's own
  definition or a fresh `getBoundingClientRect()` read, never assumed — `body`'s
  `overflow-x: hidden` (see below) makes `body.clientWidth` narrower than the viewport in
  some scrollbar-render modes, so `width: "100%"` on a fixed element doesn't reliably match
  the section's own in-flow width.
- The frozen element needs an explicit `z-index` on both sides of the toggle (`-1` while
  frozen) — implicit stacking order for a toggled `position: fixed` element isn't reliable in
  Safari.
- `ScrollTrigger.refresh()` must only run once the affected element is back in normal,
  measurable flow — calling it while something is mid-`position:fixed` measures the wrong
  (viewport-relative) rect and can cascade into a large, incorrect scroll-position jump.
- [anchor-scroll.js](../src/scripts/anchor-scroll.js)'s `documentTop()` helper handles
  jumping directly to a nav target that's transiently `position: fixed` mid-transition —
  it briefly clears/restores the inline position to read a true document-relative position.
  Generic by design; covers any future pin target without special-casing per pair.

## Hero decorative layer (ring + "Slavíme 20 let" badge)

**Desktop (≥900px):** `.hero__ring` / `.hero__badge` are sized and positioned in `cqw`
(`.hero` is a query container) rather than fixed px, so the graphic scales with the hero's
own width instead of only matching Figma at exactly 1728px. All six offsets (width/right/bottom
on both elements) share one basis — the same fraction of the 1728px reference — so the ring
and badge stay locked together at any width. `.hero` carries no inline padding of its own
(`.hero__content` uses margin instead) since `cqw` resolves against the container's content
box, after its own padding.

**Mobile (<900px):** shown in-flow under the CTA buttons, not the desktop's offset-overlay
technique. Two things to know if this block needs editing:

- `badge-ring.svg`'s visual center isn't its bounding-box center (true center sits at
  41.19%/41.93% of the box) — the badge and rotation pivot must use that fraction, not a
  50/50 center, or the ring visibly wobbles off-axis when rotated.
- `.hero__ring`'s `left` offset is solved algebraically so the *badge* (not the ring's
  bounding box) lands on viewport-center — the ring's bleed past the viewport edges is
  intentionally asymmetric as a result, not a bug.

`.hero`'s overflow is split per axis: `overflow-y: visible` (the ring bleeds into the Stats
section below by design) and `overflow-x: clip` (not `hidden` — `clip` doesn't force the
other axis to `auto` the way `hidden` would, and applying it here rather than to
`html`/`body` avoids the sticky-header breakage a document-root-level fix caused earlier).

**Motion** ([hero-shape.js](../src/scripts/hero-shape.js),
[parallax.js](../src/scripts/parallax.js), gated behind `prefers-reduced-motion`): a
pointer-follow tilt (desktop + fine-pointer only) and a scroll-scrubbed rotation both drive
the same `rotation` transform, summed into one shared state object and a single `gsap.set()`
call rather than two competing tweens. Scroll-parallax on the hero decor and the career photo
collage is deliberately modest — enough to avoid the ring drifting into the Stats content
below, and the career collage is never scaled/clipped for parallax "overscan," since it's a
single pre-composed image where scaling crops directly into the composition.

## Line pattern (diagonal lines on dark-blue blocks)

One reusable canvas-based `LinePattern` component (not CSS/SVG) renders the diagonal-line
pattern with an edge-to-middle alpha falloff, used via `[data-line-pattern]` on `.hero`,
`.tech-domains`, `.who-we-are`, `.career`, `.site-footer`, and `.mobile-menu`, each with its
own opacity value. Canvas was chosen specifically for the mouse-follow ripple (lines displace
slightly toward the cursor, relax back over ~0.6–1s) — smoother, per-segment control than CSS
transforms or SVG filters can drive at that granularity. Falls back to the static pattern
(no rAF loop) under `prefers-reduced-motion` or on coarse/touch pointers.

## Background glow

`.bg-navy--glow::before` is a `radial-gradient()` reproducing Figma's blurred-circle
lightening effect without an extra blurred DOM layer. Position varies per section via a
`--glow-position` custom property set on each block (`.hero`, `.tech-domains`,
`.who-we-are`, `.career`) — `.site-footer` intentionally has no glow, per Figma.

## Type scale — `--text-scale`

`tokens.css` defines `--text-scale` (`0.9` mobile, `0.85` from 900px); affected `font-size`
declarations use `calc(Npx * var(--text-scale))` instead of a bare value, so it can be
retuned from one place. Deliberately **not** applied to: the hero claim (cqw-based already),
the "Slavíme 20 let" badge, header/mobile-menu nav links, button labels, the footer tagline,
reference-card copy, or the contact form's own fields — match a neighboring element's
exemption when adding new text to one of these components rather than assuming everything
scales by default.

## Other CSS notes

- **Dark mode:** `body` needs an explicit `background` and `:root` needs `color-scheme:
  light` — otherwise OS-level dark mode repaints elements with no explicit background, and
  this design has no dark variant.
- **`.mobile-menu`'s closed state needs `pointer-events: none`**, not just `opacity: 0` — the
  `hidden` attribute alone doesn't disable interaction here, since `.mobile-menu`'s own
  unconditional `display: flex` rule ties with the browser's default `[hidden]` rule at equal
  specificity, and author CSS wins.
- **GSAP tweens on interactive elements should always `clearProps` on complete** —
  `gsap.from()` can leave a stray inline `transform` after `progress() === 1`, subtly
  offsetting (but not disabling) hover/click targets.

## Image pipeline

Assets come from the Figma file via the Figma MCP (`download_assets`), never hand-prepared.
Photos convert to `.webp` via `sharp`; icons/vectors export as optimized `.svg` via `svgo`
(both dev dependencies, run via one-off scripts, not a persisted build pipeline). Figma's SVG
export sets `preserveAspectRatio="none"` on some assets (found on all 10 client-logo SVGs),
which stretches the graphic to fill its box instead of preserving proportions — strip that
attribute on any future export that only sets `height` (not `width`) on its `<img>` tag.

## Animation roadmap

- GSAP is the default for scroll-triggered/entrance animation (ScrollTrigger as needed).
- The line-pattern ripple is plain `requestAnimationFrame`, not GSAP — a continuous
  pointer-driven simulation, not a discrete tween.
- The "Slavíme 20 let" badge's entrance animation is a placeholder fade/scale, open to
  revision.
- A 3D element via Three.js is planned but not scoped — don't add the dependency until that
  work is actually requested.
