import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * "Chapter change" transition between a section and the one right after it, spanning exactly
 * one viewport-height of scroll: `pinned` pins in place right as it's about to scroll out
 * (start: "bottom bottom") while `covering` — kept in completely normal document flow the
 * whole time, just given a higher z-index — rises up and covers it. Works in either color
 * direction (light pinned/dark covering, or dark pinned/light covering) — nothing here is
 * color-specific, it's pure layout.
 *
 * `covering` needs no repositioning of its own: with `pinned`'s own pin engaged
 * (`pinSpacing:false`), `covering`'s document position stops changing, so as the user keeps
 * scrolling, its position relative to the (now frozen) viewport moves at the normal 1:1 rate
 * — from "peeking at the bottom edge" to "fully covering" over exactly one viewport-height,
 * regardless of either section's actual content height. `pinSpacing:false` already reserves
 * `pinned`'s own natural height internally (GSAP's pin always wraps the pinned element in its
 * own spacer) — an earlier version of this file added a *second*, manual spacer on top of
 * that, which double-counted its height and pushed `covering` far below the viewport instead
 * of just past its bottom edge.
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
      // visible (held there by the pin well past its own natural "top 85%" point), so it
      // either stayed invisible or only revealed after extra back-and-forth scrolling. Firing
      // it directly off the pin engaging instead ties it to the moment it's actually on screen.
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

      // With pinSpacing:false, GSAP leaves a compensating inline transform on `pinned` after
      // it unpins instead of cleanly resetting it — a permanently-stuck translateY of one
      // viewport-height, which renders pinned's bottom edge a full viewport-height below its
      // true position, overlapping into whatever comes after `covering`. Clearing it on every
      // unpin is what actually fixes that, not a workaround around it.
      const clearPinnedTransform = () => gsap.set(pinned, { clearProps: "transform" });

      ScrollTrigger.create({
        trigger: pinned,
        start: "bottom bottom",
        end: () => "+=" + window.innerHeight,
        pin: true,
        pinSpacing: false,
        onEnter: revealCoveringContent,
        onEnterBack: revealCoveringContent,
        // Pinning/unpinning changes layout for everything after `pinned` — without a refresh,
        // every other ScrollTrigger on the page keeps checking scroll position against stale,
        // pre-toggle thresholds. Deferred a frame: calling refresh() synchronously from inside
        // a callback ScrollTrigger's own update cycle is still running is re-entrant and
        // intermittently corrupts layout instead of cleanly settling.
        onLeave: () => {
          clearPinnedTransform();
          requestAnimationFrame(() => ScrollTrigger.refresh());
        },
        onLeaveBack: () => {
          clearPinnedTransform();
          requestAnimationFrame(() => ScrollTrigger.refresh());
        },
      });
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
