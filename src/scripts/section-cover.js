import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * "Chapter change" transition between a section and the one right after it, spanning exactly
 * one viewport-height of scroll: `pinned` freezes in place right as it's about to scroll out
 * (start: "bottom bottom") while `covering` — kept in completely normal document flow the
 * whole time, just given a higher z-index — rises up and covers it. Works in either color
 * direction (light pinned/dark covering, or dark pinned/light covering) — nothing here is
 * color-specific, it's pure layout.
 *
 * The "freeze" is implemented by hand — `position:fixed` toggled directly, at the exact
 * on-screen `top` the element already had the instant it engages, plus a manual spacer that
 * reserves its natural height while it's fixed — rather than using GSAP's `pin:true`.
 * `pin:true` (with `pinSpacing:false`, which this needs) demonstrably leaves a stuck
 * compensating inline transform behind on unpin that doesn't reliably clear on its own; an
 * explicit `clearProps` fix for that (in a prior version of this file) worked in Chrome but
 * the exact same peek-through symptom persisted in Safari — a WebKit difference in how that
 * internal compensation is applied, most likely. Hand-rolling the toggle with nothing but
 * `getBoundingClientRect()` and `position:fixed`/`static` sidesteps that entire mechanism —
 * there's no compensating transform for either browser to get wrong because none is ever set.
 *
 * `covering` needs no repositioning of its own: with `pinned` frozen, `covering`'s document
 * position stops changing (the manual spacer holds pinned's natural footprint), so as the
 * user keeps scrolling, `covering`'s position relative to the (now frozen) viewport moves at
 * the normal 1:1 rate — from "peeking at the bottom edge" to "fully covering" over exactly
 * one viewport-height, regardless of either section's actual content height.
 *
 * An earlier, different version of this file tried to guarantee a mathematically zero-jump
 * release by making `covering` a `position:fixed` overlay with its own multi-phase timing —
 * that technique needed *two* viewport-heights of scroll to work out (a real requirement, not
 * a one-off measurement issue), which on a mouse wheel is 15-20 notches of the screen visually
 * not changing — reads as broken, not as a transition. This version is the simpler tradeoff:
 * one viewport-height total, `covering` just flows naturally into place with no positioning
 * logic of its own at all.
 */
function initSectionCover(pinnedSelector, coveringSelector, coveringRevealSelector) {
  const pinned = document.querySelector(pinnedSelector);
  const covering = document.querySelector(coveringSelector);
  if (!pinned || !covering) return;

  gsap.set(covering, { position: "relative", zIndex: 2 });

  ScrollTrigger.matchMedia({
    "(min-width: 900px)": function () {
      // covering's own content can't use the generic scroll-position reveal
      // (scroll-animations.js) — by the time it would fire, covering may already be fully
      // visible (held there by the freeze well past its own natural "top 85%" point), so it
      // either stayed invisible or only revealed after extra back-and-forth scrolling. Firing
      // it directly off the freeze engaging instead ties it to the moment it's actually on
      // screen.
      const revealTargets = coveringRevealSelector ? covering.querySelectorAll(coveringRevealSelector) : null;
      let revealed = false;
      const revealCoveringContent = () => {
        if (!revealTargets || !revealTargets.length || revealed) return;
        revealed = true;
        gsap.from(revealTargets, {
          opacity: 0,
          y: 32,
          duration: 0.7,
          ease: "power3.out",
          stagger: 0.08,
          onComplete: () => gsap.set(revealTargets, { clearProps: "all" }),
        });
      };

      // Taking `pinned` out of flow (position:fixed) needs something to hold its place —
      // otherwise `covering` (and everything after it) collapses upward for as long as
      // `pinned` is fixed, then jumps back the instant it releases.
      const spacer = document.createElement("div");
      spacer.setAttribute("aria-hidden", "true");
      spacer.style.height = "0px";
      pinned.insertAdjacentElement("afterend", spacer);

      let isFrozen = false;
      const setFrozen = (active) => {
        if (active === isFrozen) return;
        isFrozen = active;

        if (active) {
          // Height measured fresh every freeze, not cached once at page-load — caching once
          // measured a shorter height before web fonts had finished swapping in, reserving
          // too little space in the spacer for the rest of the page's life.
          //
          // top is computed directly (viewport height minus pinned's height) rather than
          // read from pinned's current getBoundingClientRect() — that reads right for a
          // forward entry (onEnter), where pinned is still sitting in its natural pre-freeze
          // position, but is wrong by a full viewport-height for a backward entry
          // (onEnterBack): scrolling up into the trigger from below, pinned's *current*
          // natural position is already fully scrolled past (off-screen above the viewport,
          // matching the state "covering" was fully covering it in), not the "bottom bottom"
          // position the freeze needs. Freezing at that captured value put pinned off-screen
          // for the entire backward freeze, which is what left covering's content rendering
          // into a tall blank box instead of over a visible frozen section.
          const height = pinned.offsetHeight;
          const top = window.innerHeight - height;
          // z-index:-1 while frozen, not just "no z-index" — negative z-index is guaranteed
          // by spec to paint behind *all* normal (non-negative) content, so pinned can never
          // visually sit above anything else on the page even if it ends up stuck fixed for
          // longer than intended (a real, repeated WebKit-only failure mode for this file:
          // the same peek-through symptom, fixed for its actual cause twice already, kept
          // coming back specifically in Safari). Relying on implicit DOM-order stacking for a
          // position:fixed element was the gap — this makes correct stacking structural
          // instead of incidental, regardless of what's actually causing Safari's timing to
          // differ.
          gsap.set(pinned, { position: "fixed", top, left: 0, width: "100%", zIndex: -1 });
          spacer.style.height = height + "px";
          revealCoveringContent();
          // No refresh here on purpose: pinned is still position:fixed at this point, so
          // ScrollTrigger.refresh() would re-measure *this same trigger's* own "bottom bottom"
          // start against pinned's fixed (viewport-relative) rect instead of its true document
          // position — computing a wildly wrong value and sending scroll into a runaway jump
          // as it cascades through this trigger's own onEnter/onLeave. Refreshing only below,
          // once pinned is back in normal flow, avoids that entirely.
        } else {
          gsap.set(pinned, { clearProps: "position,top,left,width,zIndex" });
          spacer.style.height = "0px";
          // The spacer's height change shifts every section below it — without a refresh,
          // every other ScrollTrigger on the page keeps checking scroll position against
          // stale, pre-toggle thresholds. Deferred a frame: calling refresh() synchronously
          // from inside a callback ScrollTrigger's own update cycle is still running is
          // re-entrant and intermittently corrupts layout instead of cleanly settling.
          requestAnimationFrame(() => ScrollTrigger.refresh());
        }
      };

      ScrollTrigger.create({
        trigger: pinned,
        start: "bottom bottom",
        end: () => "+=" + window.innerHeight,
        onEnter: () => setFrozen(true),
        onEnterBack: () => setFrozen(true),
        onLeave: () => setFrozen(false),
        onLeaveBack: () => setFrozen(false),
      });

      return () => {
        setFrozen(false);
        spacer.remove();
      };
    },
  });
}

export function initSectionCoverTransitions() {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  initSectionCover(".what-we-do", ".tech-domains", ".area-tile");
  initSectionCover(".who-we-are", ".clients", ".reference-tile");
  // A third occurrence (.clients -> .career) was tried and pulled: verified numerically to
  // release with a large, unexplained position jump specific to that pair (not present on
  // the pairs above, even after applying the same fixes) — root cause not yet found, see
  // project memory. Re-add once diagnosed rather than ship it broken.
}
