import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * "Chapter change" transition between a light section and the dark section right after it,
 * spanning exactly one viewport-height of scroll: the light section pins right as it's about
 * to scroll out (start: "bottom bottom") while the dark section — kept in completely normal
 * document flow the whole time, just given a higher z-index — rises up and covers it.
 *
 * dark needs no repositioning of its own: with the light section's own pin engaged
 * (`pinSpacing:false`), dark's document position stops changing, so as the user keeps
 * scrolling, dark's position relative to the (now frozen) viewport moves at the normal 1:1
 * rate — from "peeking at the bottom edge" to "fully covering" over exactly one
 * viewport-height, regardless of either section's actual content height. `pinSpacing:false`
 * already reserves light's own natural height internally (GSAP's pin always wraps the
 * pinned element in its own spacer) — an earlier version of this file added a *second*,
 * manual spacer on top of that, which double-counted light's height and pushed dark far
 * below the viewport instead of just past its bottom edge.
 *
 * An earlier, different version of this file tried to guarantee a mathematically zero-jump
 * release by making dark a `position:fixed` overlay with its own multi-phase timing — that
 * technique needed *two* viewport-heights of scroll to work out (a real requirement, not a
 * one-off measurement issue), which on a mouse wheel is 15-20 notches of the screen visually
 * not changing — reads as broken, not as a transition. This version is the simpler tradeoff:
 * one viewport-height total, dark just flows naturally into place with no positioning logic
 * of its own at all.
 */
function initSectionCover(lightSelector, darkSelector, darkRevealSelector) {
  const light = document.querySelector(lightSelector);
  const dark = document.querySelector(darkSelector);
  if (!light || !dark) return;

  gsap.set(dark, { position: "relative", zIndex: 2 });

  ScrollTrigger.matchMedia({
    "(min-width: 900px)": function () {
      // dark's own content can't use the generic scroll-position reveal (scroll-animations.js)
      // — by the time it would fire, dark may already be fully visible (covered by the pin
      // holding light in place well past dark's own natural "top 85%" point), so it either
      // stayed invisible or only revealed after extra back-and-forth scrolling. Firing it
      // directly off the pin engaging instead ties it to the moment it's actually on screen.
      const revealTargets = darkRevealSelector ? dark.querySelectorAll(darkRevealSelector) : null;
      let revealed = false;
      const revealDarkContent = () => {
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

      // With pinSpacing:false, GSAP leaves a compensating inline transform on `light` after
      // it unpins instead of cleanly resetting it — here specifically a permanently-stuck
      // translateY of one viewport-height, which rendered light's bottom edge a full
      // viewport-height below its true position, overlapping into whatever comes after dark.
      // Clearing it on every unpin is what actually fixes that, not a workaround around it.
      const clearLightTransform = () => gsap.set(light, { clearProps: "transform" });

      ScrollTrigger.create({
        trigger: light,
        start: "bottom bottom",
        end: () => "+=" + window.innerHeight,
        pin: true,
        pinSpacing: false,
        onEnter: revealDarkContent,
        onEnterBack: revealDarkContent,
        // Pinning/unpinning changes layout for everything after `light` — without a refresh,
        // every other ScrollTrigger on the page keeps checking scroll position against
        // stale, pre-toggle thresholds. Deferred a frame: calling refresh() synchronously
        // from inside a callback ScrollTrigger's own update cycle is still running is
        // re-entrant and intermittently corrupts layout instead of cleanly settling.
        onLeave: () => {
          clearLightTransform();
          requestAnimationFrame(() => ScrollTrigger.refresh());
        },
        onLeaveBack: () => {
          clearLightTransform();
          requestAnimationFrame(() => ScrollTrigger.refresh());
        },
      });
    },
  });
}

export function initTechnologySectionTransition() {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  initSectionCover(".what-we-do", ".tech-domains", ".area-tile");
  // A second occurrence (.clients -> .career) was tried and pulled: verified numerically to
  // release with a large, unexplained position jump specific to that pair (not present on
  // the pair above, even after applying the same fixes) — root cause not yet found, see
  // project memory. Re-add once diagnosed rather than ship it broken.
}
