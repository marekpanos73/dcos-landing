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

## Gotcha: `body`'s own `overflow-x: hidden` reserves a phantom scrollbar gutter, breaking `position:fixed; width:"100%"` (2026-08-09)

[section-cover.js](../src/scripts/section-cover.js) (the pinned/covering transition — see
its own file-header comment for the full mechanism) used to freeze `pinned` with
`left: 0, width: "100%"`. Reported symptom: a small **horizontal** jump exactly when the
freeze engages/releases — on a MacBook Air's external monitor in Safari, but not on a Mac
Mini even at the same viewport width, which pointed away from a pure breakpoint/width bug
and toward something environment-dependent.

Root cause, confirmed by direct measurement (not just theorized): `body` has always had
`overflow-x: hidden` (base.css) — CSS spec forces `overflow-y` from its default `visible` to
`auto` whenever `overflow-x` is anything else, so `body` silently became its own (redundant)
vertical-scroll container, even though `html`/`documentElement` is the actual page scroller.
`body.clientWidth` measurably subtracts a scrollbar gutter for this phantom, self-referential
scrollbar in browsers/scrollbar-render-modes that reserve layout space for `overflow:auto`
regardless of whether a scrollbar is visibly drawn — confirmed in this repo's own dev
environment: `body.clientWidth` (1698px) was 15px narrower than `documentElement.clientWidth`
(1713px) at the same viewport width. Normal-flow content (`.what-we-do`, any full-bleed
section) renders at `body.clientWidth`, but `position:fixed`'s `width: "100%"` resolves
against the *initial containing block* (viewport-relative), which ignores `body`'s phantom
gutter entirely — a guaranteed pixel mismatch between the section's in-flow width and its
frozen width, in either direction depending on freeze/release. Whether this actually reserves
visible space is scrollbar-style-dependent (classic reserved-space scrollbars vs. overlay
scrollbars that take no layout width), which is exactly why it reproduced on one machine and
not the other at any width — it depends on OS/Safari scrollbar rendering mode, not viewport
size.

**Fix:** capture `left`/`width` from `pinned.getBoundingClientRect()` at the moment the
freeze engages (same call already measuring `height`) and set those as explicit pixel values
instead of `left: 0, width: "100%"` — guarantees the frozen state matches the in-flow state
exactly, regardless of *why* they might otherwise differ. Verified in this repo's dev
environment: freezing now measurably applies `width: 1698px` (matching `body.clientWidth`),
not `100%`/`1728px` (`window.innerWidth`). This is the same principle already applied to
`top` in that file (compute from a real measurement, never assume viewport
percentages/constants match normal flow) — now applied to the horizontal axis too.

**This same phantom-gutter effect applies to any other `position:fixed; width:"100%"` (or
`left/right: 0`) element on this page** — worth checking if a new one is ever added, not
just this file.

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
- **A grid column whose content can't shrink.** Grid items default to `min-width: auto`
  (their content's min-content size), not `0` — a title in the large display font, or any
  tile with a long unbreakable word, can hit that min-content width before its column
  reaches its "fair" 50%/33%/25% `1fr` share. When that happens the track just takes what
  it needs and the *other* tracks get squeezed to make room, breaking the equal split (and
  in bad cases overflowing the grid's own container) even though every track is nominally
  `1fr`. Every grid item on this shared alignment system (`.section-heading__title`/`__body`,
  `.approach-tile`, `.leader-tile`, `.value-tile`, `.area-tile`, `.reference-tile`,
  `.career__text`, `.contact__info`, `.site-footer__col`) sets `min-width: 0` for this
  reason — found via a real bug report: at ~900px the reference-tiles' 4 columns rendered
  visibly unequal widths (one tile ~35% wider than the narrowest), and separately the
  who-we-are heading's title/body split drifted off the leader-tiles' column boundary below
  it.

  `min-width: 0` alone isn't the whole fix, though — it lets the *track* shrink to true
  equal width, but doesn't stop a word that's now wider than that (now-narrower) track from
  visibly spilling out of its own box, since overflow is visible by default. That surfaced
  as a second round of bugs once the first fix shipped: title text overlapping the column
  next to it, tile text running past its card. Two more rules, both applied alongside
  `min-width: 0` everywhere above:
  - **`overflow-wrap: break-word`** as the safety net — if a word truly doesn't fit even
    after everything else, break it rather than let it overflow into the neighboring column.
  - **Don't rely on `overflow-wrap` as the *primary* fix for a genuinely-too-narrow grid.**
    Letting it hyphenate mid-word on every render at a common width (not just a rare
    untranslated brand name) reads as broken, not resilient. Where that was happening —
    `.reference-tiles` (4 columns), `.value-tiles` (3 columns), `.site-footer__columns`
    (4 columns) — the real fix is an intermediate column-count tier: 2 columns from 900px,
    stepping up to the full count at 1200px (1100px for the footer, which has shorter
    content) where there's actually enough room. Same idea, separately, for the two big
    display-font titles that share this grid (`.section-heading__title`, `.career__title`,
    `.contact__title`): step the font down to 40px from 900px, back to the full 56px at
    1100px, rather than let `overflow-wrap` hyphenate words like "odpovědnost." or
    "transformačních" as the normal case at that width.

If a future row needs to join this shared grid, use the same rules — don't invent a new
width, gap, or min-width value that merely "looks aligned" at the width you happen to be
testing, and if a tier needs more than min-width:0 + overflow-wrap to look right, an extra
column-count or font-size step (like the ones above) is the answer, not fighting the text.

- **A grid row whose height is dictated by an unrelated image tile.** `.value-tiles`
  ("Řešení") mixes 5 text tiles with 1 photo tile in the same grid; from 900px up the photo
  always shares a row with at least one text tile (2-col: paired with tile 05; 3-col: paired
  with 04 and 05). The photo (`.value-tile--image img`) originally kept its own
  `aspect-ratio`, which scales its height with the column's width — on a wide viewport that
  forced the whole row much taller than the text tiles actually needed, leaving a large,
  reported-as-a-bug empty gap in 04/05 regardless of how their own content was vertically
  distributed (see the `.value-tile` centering below — centering only fixed the gap being
  *lopsided*, not its *size*, since the size was never a text-tile problem to begin with).
  Fixed by removing the image's `aspect-ratio` from 900px up and switching it to
  `position: absolute; inset: 0` instead — this takes it out of its own tile's intrinsic
  sizing entirely, so the tile (and therefore the row) is sized by its text siblings' actual
  content, and the image just fills whatever height that turns out to be via
  `object-fit: cover`. Mobile keeps the original `aspect-ratio` approach — `.value-tiles` is
  a single column there, so the image tile has no row sibling to take a height from and
  would collapse to 0 without its own intrinsic size. **General rule: before giving an image
  its own `aspect-ratio` inside a grid row it shares with text content, check whether that
  row has text siblings at every tier the image tile does — if so, the image will dictate
  the row's height instead of adapting to it, which usually isn't the intent.**

`.value-tile` itself is `display: flex; flex-direction: column; justify-content: center`
(was top-anchored) so each tile's own leftover vertical space — after the row-height fix
above, no longer huge, but still real, since tiles' copy lengths differ — splits evenly
above/below its content instead of collecting entirely below the last line before the
divider.

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
the 900-1440px range (140-180px there) — one continuous curve doesn't give enough control
over how it feels at each width. Replaced with explicit stepped tiers in
[tokens.css](../src/styles/tokens.css): 64px at 900px, 96px at 1280px, 140px at 1440px,
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

The whole `.hero__decor` block renders from `900px` up (originally 1024px, see "Content
breakpoint lowered" below), same as the rest of the page's sections — earlier this needed a
separate, higher 1280px threshold to avoid colliding with the text column, but that was
compensating for the undersized-cqw bug above; once the scaling is correct, testing at the
content breakpoint (`.hero__ring`'s bounding box does overlap `.hero__content`'s there, but
the ring is a crescent, not a filled rectangle — the actual visible pixels don't touch)
showed clean spacing down to that width. If a future redesign changes the text column's
`max-width` or the decor's proportions, re-verify this empirically (screenshot at a few
widths) rather than trusting bounding-box math alone — that's what produced the wrong "still
colliding" call the first time around.

## Header nav: separate breakpoint from the rest of the page, plus a JS fallback

The desktop nav (logo + 6 links + Kontakt button) doesn't reliably fit in one line until
~1280px — noticeably wider than the 900px breakpoint the rest of the page's sections use.
Rather than force everything to 1280px, the header alone switches at `1280px`
([header.css](../src/styles/header.css)), while sections keep the general `900px`. This gap
is intentional and not a bug to close: between 900 and 1280px the header already needs the
mobile hamburger (the nav genuinely doesn't fit), but page content is still comfortably wide
enough to stay in its multi-column desktop layout — see "Content breakpoint lowered" below.

That static breakpoint is the common case, not a guarantee — unusual zoom levels or a font
metric slightly wider than expected can still overflow it. `header-nav.js` is a safety
net: it measures whether the nav row actually overflows and, if so, adds `.nav-overflow`
to `<body>`, which forces the mobile hamburger menu even above 1280px. Because of this,
nothing about "mobile menu mode" can be a fixed media query elsewhere — see
`mobile-menu.js`, which checks the toggle button's actual computed `display` instead of
duplicating a breakpoint number.

## Header nav "ghost" indicator: anchored to the header, not the nav, and scrollspy-driven

The 4px sliding underline (`.site-nav__ghost` in [header.css](../src/styles/header.css),
driven by `initNavGhost()`/`watchActiveSection()` in
[header-nav.js](../src/scripts/header-nav.js)) is positioned against
`.site-header__inner`'s bounding rect, not the `<nav>`'s. The nav is vertically centered
inside a taller header row, so anchoring to the nav's own box would leave equal space above
and below it; anchoring to the header keeps the bar flush with the header's bottom edge
(matching the box-shadow divider) regardless of that centering.

At rest (not hovered), the bar tracks scroll position via `watchActiveSection()`: a
scrollspy that walks the nav links in DOM order and keeps the last one whose section has
scrolled up past the sticky header's bottom edge — the standard technique, cheap enough for
this page's handful of sections on every scroll event (rAF-throttled). Hovering/focusing a
link overrides this immediately; leaving the nav returns the bar to the current scroll-based
link, not always the first one.

This only works for links whose `href="#id"` matches a real section id — the header/mobile
"Blog" links used to be bare `href="#"` placeholders (unlike the footer's `href="#blog"`,
which already pointed at `.blog-teaser`'s `id="blog"`), so the scrollspy silently skipped
Blog and the bar stalled at Kariéra past that point. Fixed by pointing both nav copies at
`#blog` to match. Any future nav link needs a matching section id for the same reason.

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
section below it (see next section). Horizontal bleed is caught by `overflow-x: hidden` on
`body`.

**Do not also add `overflow-x: hidden` (or `clip`) to `html`/`documentElement`, even though
that was tried once (2026-08-09) for a reported iPadOS Safari overflow bug where body-only
apparently wasn't clipping the ring's right-edge bleed reliably.** It was reverted the same
day: `html` is the real root scroller (`document.scrollingElement`), and giving it its own
non-`visible` `overflow-x` value — confirmed for both `hidden` and `clip` — turns it into a
distinct scroll container and breaks `position: sticky` on `.site-header` (and would break
it for any other sticky element on the page). Verified directly: with the rule in place, the
header's `getBoundingClientRect().top` tracked scroll position 1:1 (scrolled away) instead
of staying pinned at `0`. A universally broken sticky header is a far worse trade than one
unresolved device-specific layout-width edge case. If the iPadOS Safari bug needs
revisiting, it needs an approach that doesn't touch `html`'s own `overflow` property —
e.g. scoping the clip to a wrapper element other than `html`/`body`, or constraining the
ring's own bleed distance instead of relying on ancestor clipping.

## Stats section: solid, not frosted — backdrop-filter turned out unreliable (2026-08-09)

Figma's Stats section originally called for `backdrop-blur` + a semi-transparent white
"Lighten" layer, which only does anything visible if something sits behind it to blur —
that something is the hero's orange ring, which overlaps into this section's geometry (see
above). `.stats` in [stats.css](../src/styles/stats.css) shipped that way (semi-transparent
`rgba(246,246,246,0.75)` + `backdrop-filter: blur(80px)`, both prefixed) for a while, and it
genuinely worked in Safari (confirmed on iPadOS). But real cross-device QA found it silently
not rendering at all in Chrome, on two unrelated machines (a Windows PC and a MacBook Air
M2) — the backdrop just stayed unblurred, showing the ring's bottom edge as a sharp,
distracting hard edge instead of a soft one. Likely cause, not independently confirmed since
neither failing machine/browser was available to debug directly: `.hero` carries
`isolation: isolate` (from `[data-line-pattern]`, see below), which creates its own stacking
context; the ring bleeds out past `.hero`'s own box into `.stats`'s visual area, and content
that overflows an isolated ancestor like that is a known rough edge for Chromium's
backdrop-filter backdrop-sampling — plausible, but genuinely unverified here.

Given that, and given `backdrop-filter` has no fallback at all for browsers that don't
support it either (older browsers would show the same unblurred-ring problem, just for a
different reason), the fix was to stop depending on it working: `.stats` is now a flat
`#f6f6f6` (same grey already used for `.reference-tile`/`.approach-tile`/`.contact-form`
backgrounds elsewhere), which hides the ring's bleed completely and correctly on every
browser, unconditionally. This trades away the frosted "ring peeks through, softened" look
from Figma — if backdrop-filter reliability across Chrome versions ever gets independently
confirmed fixed, revisiting the frosted look would need to re-verify this isolation theory
first, not just re-add the two `backdrop-filter` lines.

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
(hidden below 900px to match the Figma mobile frame). Entrance animation (v1, open to
revision): fades/scales in after the CTA buttons in the hero timeline, cross accent gets
its own slight rotate-in — see `animateHero()` in
[hero-animations.js](../src/scripts/hero-animations.js).

## Hero ring/cross mouse tilt, and scroll parallax (implemented 2026-08-07)

Per client request. Two separate scripts, both gated behind
`prefers-reduced-motion: reduce` (skip entirely, no listener attached):

**`hero-ring-tilt.js`** — `.hero__ring` and `.hero__badge-cross` rotate a few degrees
(±7°, `MAX_ROTATION_DEG`) toward the pointer's position in the hero, via `gsap.quickTo` for
smooth eased following. Both pivot around the "Slavíme 20 let" badge's own center — the
ring needs its `transform-origin` computed and kept in sync (via `ResizeObserver`) since its
own box center isn't the badge's center; the cross doesn't, since it already fills
`.hero__badge` exactly (`inset: 0`) so its default 50% 50% origin already lands on the
badge's center. The rotation amount is a diagonal projection of the pointer's normalized
position (`(normX - normY) / 2`) — same "/" axis `badge-cross.svg` draws — so pointer
top-right tilts right, bottom-left tilts left. The "Slavíme" / "20 let" text itself is
untouched, only the ring and cross graphic move. Desktop + fine-pointer only
(`hover: hover, pointer: fine, min-width: 900px`).

**`parallax.js`** — scroll-scrubbed (`ScrollTrigger`, `scrub: true`, `ease: "none"`) drift
on two things: `.hero__decor` (the whole ring/cross/badge group lags behind as hero scrolls
away) and `.career__gallery` (the career collage block). Both are kept deliberately modest —
tuned down twice already after the first two passes overshot: `.hero__decor`'s range pushed
the ring down into the Stats section's client-logos content (it already bleeds past hero's
own bottom edge by design, so parallax on top of that adds up fast), and an earlier version
also scaled+clipped photos for parallax "overscan room", which is fine for an ordinary photo
but wrecked `career-photos.webp` specifically — that file is a single pre-composed collage
(four photos arranged edge-to-edge), so scaling it up to avoid revealing a frame edge crops
directly into the composition instead. `.career__gallery` deliberately has no
`overflow: hidden` and its image gets no `scale`/`clip` treatment for this reason — if a
future parallax pass touches it again, drift the block, don't scale the image.
`.value-tile--image` (the "Řešení" photo) had the same scale-based treatment tried and
dropped entirely — no parallax on it at all now, plain photo, per client feedback.

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

## Global type scale: `--text-scale`, applied per-declaration via `calc()` (2026-08-09)

Real cross-device QA found the hero's CTAs and decorative ring sitting below the fold on
common laptop viewports, and separately that buttons read as too small relative to body
text at the sizes Figma specified. Rather than hand-picking new px values across every
file, [tokens.css](../src/styles/tokens.css) defines `--text-scale` (`0.9` base/mobile,
`0.85` from the existing `900px` content breakpoint), and every affected `font-size`
declaration is written as `calc(Npx * var(--text-scale))` instead of a bare px value — one
variable to retune instead of re-editing every file by hand, which matters here because
both numbers are an explicit first pass the user expects to iterate on after another round
of visual QA, not a final spec.

**Deliberately exempted — do not wrap these in `calc(... * var(--text-scale))`:** the hero
claim (`.hero__brand-line`/`--big`, hero.css), the "Slavíme 20 let" badge
(`.hero__badge-label`/`-years`, cqw-based), the desktop nav and mobile menu
(`.site-nav__list a` in header.css, all of mobile-menu.css), every button label (all of
buttons.css, `.lang-switch__btn`), the footer tagline paragraph (`.site-footer__col p`, not
`.site-footer__heading`), the Reference-card copy (`.reference-tile p`, clients.css), and
everything inside the contact form itself (`.contact-form__field label`/`input`/`textarea`,
`.contact-form__consent` — but *not* `.contact__title`/`.contact__lede`/`.contact__details`,
which are the section's left info column, not the form, and do scale). The reasoning behind
each exemption lives with the request, not here — if adding a new text element to one of
these components, match its neighbors' exemption rather than assuming everything scales by
default.

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

**Gotcha: Figma's SVG export sets `preserveAspectRatio="none"`.** All 10 client-logo SVGs
(`src/assets/icons/logos/*.svg`) shipped with this attribute, which tells the SVG to stretch
and fill whatever box it's placed in instead of preserving its own proportions — invisible
as long as the `<img>` happens to render at close to the logo's natural aspect ratio, but
once a narrower grid column (only `height="NN"` is set on these `<img>` tags, no `width`)
forces the element's rendered width down via `max-width: 100%` while the HTML `height`
attribute keeps the height pinned, the logo visibly squishes/stretches. Fixed by stripping
`preserveAspectRatio="none"` from all ten files (falls back to the SVG default
`xMidYMid meet`, which letterboxes instead of distorting). Re-check for this attribute on
any future logo/icon pulled through the same export pipeline.

## Breakpoints

Two Figma frames define the breakpoints: `Home mobile` (base, mobile-first) and
`Home desktop` (min-width breakpoint). `Mobile menu` is the open state of the mobile nav,
not a separate breakpoint. Figma doesn't specify the exact px switch-over — the content
breakpoint is `900px`; between 390px and 900px the mobile layout stretches rather than
matching a real Figma frame, since none exists for that range.

### Content breakpoint lowered from 1024px to 900px (2026-08-07)

Per client feedback: at a viewport comfortably wide enough for the desktop content
layout (multi-column grids, side-by-side sections) to look fine, the page was still
switching to the single-column mobile layout, because the content breakpoint (1024px) had
no real justification beyond "standard tablet/desktop boundary" — it wasn't derived from
when the desktop layout actually needs the room. Lowered to 900px after testing the
tightest grids at that width (the 3-column `.value-tiles` and 4-column
`.site-footer__columns` — the footer's longer labels wrap to two lines at 900px but stay
fully readable, nothing overlaps or truncates).

This is a sitewide, mechanical change — every `@media (min-width: 1024px)` in
`src/styles/*.css` became `900px` (`header.css`'s separate `1280px` nav breakpoint is
untouched, see above), plus the matching check in
[hero-ring-tilt.js](../src/scripts/hero-ring-tilt.js) that gates the mouse-tilt effect to
the same width the ring/badge actually render at. There's no shared CSS variable for this
— `@media (min-width: var(--x))` isn't valid CSS, and this project deliberately has no
preprocessor (CLAUDE.md) — so a future adjustment means repeating the same sitewide
find-and-replace, not editing one token.

Hero text blocks are implemented as normal document flow with token-based gaps, not as
literal absolute-positioned copies of Figma's per-node coordinates — the Figma export
positions every text node with `top`/`left` px values tuned to one fixed frame size, which
doesn't reflow and isn't something a real dev would ship. Same principle applies to every
other section as they're built.
