# Design notes

Rationale for decisions that deliberately deviate from a literal 1:1 Figma reproduction.
Read this before implementing a section that touches one of these areas.

## Gotcha: `.mobile-menu`'s `hidden` attribute did nothing — it ate every hover/click

The actual cause of "`:hover` doesn't work anywhere except the header button," after the
GSAP fix below turned out not to be it. [mobile-menu.css](../src/styles/mobile-menu.css)'s
`.mobile-menu` is `position: fixed` covering the full viewport below the header, and
`display: flex` unconditionally. The closed state was only `opacity: 0` — nothing set
`pointer-events: none`, so the fully invisible panel sat on top of every section on the
page (everything except the header, which it doesn't cover) and silently absorbed every
mouse event meant for the actual content underneath. It also explains a reported
`backdrop-filter` flicker over content scrolled under the header: the "closed" panel was
still compositing at all times, since nothing actually removed it from the render tree.

The `hidden` HTML attribute [mobile-menu.js](../src/scripts/mobile-menu.js) toggles doesn't
save you here by default: `[hidden] { display: none }` is a browser default with selector
specificity (0,1,0) — identical to `.mobile-menu`'s own `display: flex` rule — and author
CSS wins that tie regardless of the attribute being present. Fixed by adding
`pointer-events: none` to the closed state (`auto` on `.is-open`) and separately
reasserting `.mobile-menu[hidden] { display: none }` explicitly rather than trusting the
UA default to win. Same trap applies to any other element toggled via the `hidden`
attribute alongside its own unconditional `display` rule — check for this combination
before assuming `hidden` is doing anything.

## Gotcha: GSAP tweens can leave elements permanently offset, killing :hover

`gsap.from(el, {y: N, ...})` — even a single, un-staggered, non-timeline call — can finish
with `progress() === 1` while the element's inline `transform` is still stuck at (or near)
the "from" pose instead of resolving back to the resting value. Reproduced with a plain
`gsap.from()` on a real page element (no ScrollTrigger, no timeline, no stagger needed);
GSAP caches per-element transform state on the DOM node itself, and once that cache is off,
it can re-poison the *next* tween on the same element too — clearing the inline `style`
attribute by hand doesn't fix it, since the stale value lives in GSAP's cache, not the DOM.

Symptom on this site: [hero-animations.js](../src/scripts/hero-animations.js)'s entrance
timeline and [scroll-animations.js](../src/scripts/scroll-animations.js)'s ScrollTrigger
reveals left every button and link they animated sitting ~16–32px off from its intended
position — invisible at a glance since the offset is small. Worth fixing on its own merits,
but it turned out to be a red herring for the "hover is dead everywhere except the header"
report specifically — see the `.mobile-menu` gotcha below for what that actually was. Don't
assume a stray-transform fix like this one has resolved an interactivity report just
because it's a plausible-sounding mechanism; verify against the actual reported symptom.

**Fix — always clean up after a tween/timeline that touches anything interactive:**
`onComplete: () => gsap.set(targets, { clearProps: "all" })`. Both files above do this now.
Do the same for any new entrance/reveal animation added later, especially anything that
wraps a button, link, or other element a user will actually interact with.

## Two-column content rows share one grid — and one gap

Every two-column row on the page (`.section-heading`, `.career__content`,
`.contact__layout`, and the 2-col tile grids directly beneath a heading —
`.approach-tiles`, `.leader-tiles`) uses `grid-template-columns: 1fr 1fr` with
`gap`/`column-gap: var(--grid-col-gap)` ([tokens.css](../src/styles/tokens.css)), so the
right column's width and x-position match everywhere at any viewport width.

Two traps that both look "correct" individually but break this:

- **A fixed-px first column instead of `1fr 1fr`.** It only lines up with a true 50/50
  split by coincidence, at whatever one viewport width you measured it at — tried once,
  looked right at 1728px, drifted at every other width. Always use equal `1fr` tracks.
- **A grid that's genuinely 50/50 but uses a different `gap`.** The tile grids sit right
  below a `.section-heading` in the same section and are *also* an honest 50/50 split, but
  with the smaller `--space-4` gap for their row-gap — using that same value for
  column-gap shifts their column boundary away from the heading's above it (gap size
  changes where the 50% line effectively falls once you account for it). Row-gap and
  column-gap can differ; column-gap must always be `--grid-col-gap` wherever a row needs
  to align with the rest of the page.

If a future row needs to join this shared grid, use the same two rules — don't invent a
new width or gap value that merely "looks aligned" at the width you happen to be testing.

## Gotcha: forced dark mode repainting the page

`body` must have an explicit `background`, and `:root` must declare `color-scheme: light`
(both set in [tokens.css](../src/styles/tokens.css) / [base.css](../src/styles/base.css)).
Without them, a browser with OS-level dark mode on will auto-darken any element that has
no explicit background, repainting the white sections a murky near-black and mangling the
navy/orange palette everywhere else — this design is light-mode only for now, nothing in
Figma defines a dark variant, so the browser must be told not to guess.

## Desktop side padding: stepped tiers, not one fluid clamp

An earlier version used `clamp(48px, 14vw, 240px)` for `--container-pad-desktop`. It
technically scaled down below 1728px, but still read as too much padding through most of
the 1024-1440px range (140-180px there) — one continuous curve doesn't give enough control
over how it feels at each width. Replaced with explicit stepped tiers in
[tokens.css](../src/styles/tokens.css): 64px at 1024px, 96px at 1280px, 140px at 1440px,
240px at 1728px (the Figma reference, unchanged). Add more tiers here rather than reaching
for a fluid function again if a step still looks off at some width.

## Hero ring/badge: proportional to hero width via container queries, not fixed px

The ring and "Slavíme 20 let" badge were originally fixed Figma-px size and position
(right/bottom offsets) regardless of viewport. That's only correct at exactly the 1728px
reference width — narrower than that, the fixed-size graphic increasingly overlapped the
hero text column and the "Jak pracujeme" button, since the text reflows narrower while the
decor stayed full size.

Fix: `.hero` is a query container (`container-type: inline-size`), and `.hero__ring` /
`.hero__badge` size and position themselves in `cqw` (percent of the hero's own current
width) instead of fixed px.

Two things that went wrong on the way to the current version, worth knowing before
touching this again:

- **All six numbers must share one basis, including the vertical ones.** First pass left
  `bottom` as fixed px on both elements (reasoning: hero's height doesn't scale with its
  width, so why should a vertical offset use a width-based unit?) while width/`right` used
  cqw. That logic misses that `bottom` here isn't really "a distance related to hero's
  height" — it's part of the ring/badge's own geometry, and needs to shrink at the *same
  rate* as their width for the two to stay visually locked together as one rigid
  composition. Mixing scaled and fixed values made the badge visibly drift off the ring's
  axis at anything other than the 1728px reference. Every offset (ring width/right/bottom,
  badge width/right/bottom) is now the same fraction of 1728px — e.g. ring width
  943.092/1728 = 54.58cqw, badge bottom 266.203/1728 = 15.41cqw.
- **`cqw` is a percentage of the container's content box — after its own padding.**
  `.hero` used to carry `padding-inline` directly, which shrank the box cqw resolves
  against and made the ring/badge render smaller than their percentages implied (the
  "custom grafika je zase moc malá" report was this, not a scaling-factor problem).
  `.hero` now carries no inline padding at all; `.hero__content` carries
  `margin-inline` instead (not `padding-inline` — padding would recreate the same problem
  one level down, and would also eat into its own `max-width: 612px`, which needs to stay
  the actual text column width to match Figma's `w-[612px]`). `.hero__decor` stays
  unpadded too, since the ring/badge are meant to size against and bleed past the *true*
  hero edges.

There's also deliberately no `min()`/`max()` ceiling on the cqw values anymore — the
graphic keeps scaling up past 1728px instead of freezing there, which is what made it
read as undersized on wide screens even before the bug above.

The whole `.hero__decor` block renders from `1024px` up, same as the rest of the page's
sections — earlier this needed a separate, higher 1280px threshold to avoid colliding with
the text column, but that was compensating for the undersized-cqw bug above; once the
scaling is correct, testing at 1024px (`.hero__ring`'s bounding box does overlap
`.hero__content`'s by ~80px there, but the ring is a crescent, not a filled rectangle — the
actual visible pixels don't touch) showed clean spacing down to that width. If a future
redesign changes the text column's `max-width` or the decor's proportions, re-verify this
empirically (screenshot at a few widths) rather than trusting bounding-box math alone —
that's what produced the wrong "still colliding" call the first time around.

## Header nav: separate breakpoint from the rest of the page, plus a JS fallback

The desktop nav (logo + 6 links + Kontakt button) doesn't reliably fit in one line until
~1280px — noticeably wider than the 1024px breakpoint the rest of the page's sections use.
Rather than force everything to 1280px, the header alone switches at `1280px`
([header.css](../src/styles/header.css)), while sections keep the general `1024px`.

That static breakpoint is the common case, not a guarantee — unusual zoom levels or a font
metric slightly wider than expected can still overflow it. `header-nav.js` is a safety
net: it measures whether the nav row actually overflows and, if so, adds `.nav-overflow`
to `<body>`, which forces the mobile hamburger menu even above 1280px. Because of this,
nothing about "mobile menu mode" can be a fixed media query elsewhere — see
`mobile-menu.js`, which checks the toggle button's actual computed `display` instead of
duplicating a breakpoint number.

## Hero decorative layer: anchor everything the same way

`.hero__ring` and `.hero__badge` (the "Slavíme 20 let" text + dotted cross) must stay
visually locked together, and both are positioned against `.hero__decor` — **not**
`.hero` directly, even though `.hero__decor` has no explicit `position` of its own in the
markup. The generic `[data-line-pattern] > *` rule in
[line-pattern.css](../src/styles/line-pattern.css) sets `position: relative` on every
direct child of `.hero` so content stacks above the canvas — `.hero__decor` is one of
those children, so it quietly becomes their containing block. `hero.css` overrides it back
to `position: absolute; inset: 0`, which makes `.hero__decor` span `.hero`'s box exactly,
so coordinates on `.hero__ring` / `.hero__badge` behave as if set directly on `.hero`.

Given that, both decorative elements are positioned with fixed `right`/`bottom` pixel
offsets (matching Figma's numbers, translated into offsets from the right/bottom edge) —
**not** `top`/`left` percentages. `.hero`'s height is content-driven, not the fixed 1116px
of the Figma reference, so a `top: 44%`-style anchor drifts away from the ring (which is
itself bottom-anchored) any time the rendered hero height differs from that reference.
Fixed right/bottom offsets on both elements keep them locked together regardless.

The hero's `overflow` must stay `visible` (not `hidden`, which I'd originally added) —
`.hero__ring` is designed to bleed down past the hero's own bottom edge into the Stats
section below it (see next section). Horizontal bleed is still caught by `body`'s
`overflow-x: hidden`, so this doesn't risk a horizontal scrollbar.

## Stats section: frosted, not solid — lets the hero ring bleed through

Figma's Stats section uses `backdrop-blur` + a semi-transparent white "Lighten" layer,
which only does anything visible if something sits behind it to blur — that something is
the hero's orange ring, which overlaps into this section's geometry (see above). `.stats`
in [stats.css](../src/styles/stats.css) is a semi-transparent light grey with
`backdrop-filter: blur(...)`, not an opaque background, so the ring shows through here,
softened. If `.hero`'s `overflow` ever goes back to `hidden`, this effect silently
disappears — the two are a matched pair, change them together.

## Line pattern (/////) on dark-blue blocks

In Figma the pattern only exists in the hero and footer, with lines that are thin at the
block edges and slightly thicker toward the middle. Those blocks are fixed height in the
design, but on the real site dark-blue block height varies with content — so the pattern
can't be a fixed-size raster or a rigid line grid without breaking on other heights.

Per client request, the pattern now also runs on every other dark-blue block, not just the
two Figma originally specified — `[data-line-pattern]` is set on `.mobile-menu` (0.6),
`.hero` (1), `.tech-domains` (0.7), `.who-we-are` (0.7), `.career` (0.6), and `.site-footer`
(0.5). The opacity values are a judgment call (lighter on blocks with a lot of card/photo
content already competing for attention), not pulled from Figma — adjust freely if a
section reads too busy or too flat.

**Static look:** a repeating diagonal-line pattern that tiles at any block height, with a
soft alpha falloff from the edges toward the middle — faking the "thicker in the middle"
look without literal variable stroke width.

**Approach — canvas, not CSS/SVG:** the mouse-follow ripple below (added 2026-08-06) needs
per-frame control over individual line-segment positions, which plain CSS transforms or
SVG filters can't drive smoothly at that granularity or cost. So the pattern is one
reusable `<canvas>`-based component (e.g. `LinePattern`), not a CSS class — it renders the
diagonal lines as short segments on a grid, with the edge/middle thickness falloff applied
as a per-segment alpha/width multiplier, at any container size.

### Mouse-follow ripple interaction

On pointer movement over a pattern block, the lines near the cursor displace slightly
perpendicular to their direction — a small ripple that follows the cursor — and relax back
to flat over roughly 0.6–1s after the cursor moves away or stops. Subtle effect, not a
discrete triggered animation.

- Each frame, segment points within a falloff radius of the last-known cursor position are
  offset by a damped sine wave: displacement magnitude decays with distance from the
  cursor (spatial falloff) and with time since the cursor was last near that point
  (temporal decay back to flat).
- The `requestAnimationFrame` loop only runs while ripple energy remains anywhere in the
  block; it goes idle with no cursor movement, so pattern blocks with a stale cursor cost
  nothing.

**Fallback / accessibility:**
- `prefers-reduced-motion: reduce` → render the static pattern only (edge/middle falloff,
  no ripple), no rAF loop at all.
- Coarse pointer / touch → same static fallback; there's no persistent cursor to follow.
- If canvas ever needs dropping for a given block (perf, browser support), it degrades to
  a plain uniform-thickness static line — acceptable fallback per the client.

**Reuse:** one `LinePattern` component, parameterized by container size, serves every
dark-blue block that uses the pattern — hero, footer, and the "Slavíme 20 let" badge (see
below). Don't fork separate static/interactive implementations per section.

## "Slavíme 20 let" badge (implemented, hero section)

Corrected 2026-08-06 after pulling the real Figma node (`14:44`, hero desktop only — the
mobile hero frame drops this element entirely, no room): it is **not** a separate square
card. It's just centered text ("Slavíme" / "20 let") plus a dotted-cross accent SVG
(`src/assets/icons/badge-cross.svg`), absolutely positioned on top of the Hero's own
background — the same `LinePattern` canvas and the same giant orange ring graphic
(`src/assets/icons/badge-ring.svg`, Figma layer "O", 943×947, bleeds off the hero's
bottom-right corner) that are already behind the rest of the hero. The "square badge"
look in an isolated export is just that crop's bounding box; there's no real card
container, border, or separate background fill to build.

Implemented: `.hero__decor` / `.hero__ring` / `.hero__badge` in
[hero.css](../src/styles/hero.css), markup in [index.html](../index.html). Desktop-only
(hidden below 1024px to match the Figma mobile frame). Entrance animation (v1, open to
revision): fades/scales in after the CTA buttons in the hero timeline, cross accent gets
its own slight rotate-in — see `animateHero()` in
[hero-animations.js](../src/scripts/hero-animations.js).

## Background glow on dark-blue blocks

Figma achieves the lightening effect with blurred white circle layers. On the web this is
reproduced as a `radial-gradient()` on a `.bg-navy--glow::before` pseudo-element
([line-pattern.css](../src/styles/line-pattern.css)) — same visual effect, no extra DOM
layers, no blur filter cost, and it scales with block size automatically.

The glow's center isn't the same spot in every block — Figma places it differently per
section. `.bg-navy--glow::before` reads its position from a `--glow-position` custom
property (`circle at var(--glow-position, 82% 100%)`), which each block sets on itself:
`.hero` 82% 100% (bottom-right, under the "Slavíme 20 let" badge), `.tech-domains` 18% 100%
(bottom-left), `.who-we-are` 82% 50% (right edge, vertically centered), `.career` 18% 0%
(top-left). `.site-footer` deliberately has no glow at all per Figma — it doesn't carry the
`bg-navy--glow` class, just the plain `--gradient-navy` background.

## Animation roadmap

- **Now:** GSAP is installed and is the default for scroll-triggered / entrance
  animations (ScrollTrigger plugin as needed).
- **Now:** the `LinePattern` canvas component's mouse-follow ripple (see above) — plain
  `requestAnimationFrame`, not GSAP, since it's a continuous pointer-driven simulation
  rather than a discrete tween.
- **Open:** the "Slavíme 20 let" badge graphic (see above) needs an entrance/scroll
  animation — motion not yet specified, spec it when that section is implemented.
- **Later:** a 3D element via Three.js is planned but not scoped yet. Do not add the
  dependency or scaffolding until that work is actually requested — avoids an unused
  dependency sitting in the repo in the meantime.

## Image pipeline

Assets are pulled directly from the Figma file via the Figma MCP (`download_assets`) —
not hand-prepared. Photos are converted to `.webp` (via `sharp`, installed as a dev
dependency); icons/vectors are exported and optimized as `.svg` (via `svgo`, also a dev
dependency). Both tools run through small one-off scripts, not a persisted build-time
pipeline, since assets are pulled once per section, not on every build.

## Breakpoints

Two Figma frames define the breakpoints: `Home mobile` (base, mobile-first) and
`Home desktop` (min-width breakpoint). `Mobile menu` is the open state of the mobile nav,
not a separate breakpoint. Figma doesn't specify the exact px switch-over — `1024px` was
picked as the desktop `min-width` (standard tablet/desktop boundary); between 390px and
1024px the mobile layout stretches rather than matching a real Figma frame, since none
exists for that range.

Hero text blocks are implemented as normal document flow with token-based gaps, not as
literal absolute-positioned copies of Figma's per-node coordinates — the Figma export
positions every text node with `top`/`left` px values tuned to one fixed frame size, which
doesn't reflow and isn't something a real dev would ship. Same principle applies to every
other section as they're built.
