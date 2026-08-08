import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * "Chapter change" transition between a light section and the dark section right after it:
 * the light section pins right as it's about to scroll out (start: "bottom bottom", i.e. one
 * viewport-height before it would naturally leave) while the dark section becomes a
 * `position:fixed`, full-viewport overlay (min-height:100vh, so it always fully covers
 * regardless of its own content height) that rises in via a scrubbed `yPercent` tween.
 *
 * This is deliberately decoupled from both sections' actual content heights — an earlier
 * version relied on normal document flow + z-index for the cover (no fixed overlay), which
 * only produces a clean, gapless cover when the light and dark sections happen to be tall
 * enough relative to the viewport and to each other; with a shorter dark section it visibly
 * peeked/glitched once the pin released.
 *
 * Three things share the same trigger/start but different `end`s, on purpose:
 * - The RISE (dark's yPercent tween) finishes within `HOLD` — the light section must stay
 *   visibly frozen for this whole stretch, otherwise it starts scrolling normally again
 *   while dark is still only partway covering it, which reads as the light section
 *   "escaping" out from under an unfinished cover.
 * - The PIN's own (end - start) is also `HOLD`, for the same reason — this is what GSAP's
 *   default pinSpacing:true reserves as extra space after the light section, which is also
 *   exactly how much further down the document the dark section's natural (unpinned)
 *   position gets pushed.
 * - The OVERLAY (the fixed/static toggle) needs to stay active for `HOLD + one viewport
 *   height`, not just `HOLD` — because a section immediately following a pinned+spaced
 *   element always needs one extra viewport-height of scroll before its own natural flow
 *   position lines up with the top of the viewport. Toggling back to normal flow exactly at
 *   that point (not at the rise's or the pin's own, shorter end) is what makes the
 *   fixed→static handoff land with no jump — dark just sits fully covering, motionless, for
 *   that trailing viewport-height once the rise itself has already finished.
 */
function initSectionCover(lightSelector, darkSelector) {
  const light = document.querySelector(lightSelector);
  const dark = document.querySelector(darkSelector);
  if (!light || !dark) return;

  ScrollTrigger.matchMedia({
    "(min-width: 900px)": function () {
      const darkNaturalHeight = dark.offsetHeight;
      const hold = () => window.innerHeight;
      const overlaySpan = () => hold() + window.innerHeight;

      // Taking dark out of flow (position:fixed) needs the same flow compensation GSAP's
      // own pin already gives `light` — otherwise whatever comes after dark collapses
      // upward by dark's own height for as long as the overlay is active, then jumps back
      // the instant it releases. GSAP's pin machinery only reserves space for the element
      // it's pinning (light), not for dark, so this spacer is manual.
      const spacer = document.createElement("div");
      spacer.setAttribute("aria-hidden", "true");
      spacer.style.height = "0px";
      dark.insertAdjacentElement("afterend", spacer);

      const setOverlay = (active) => {
        if (active) {
          spacer.style.height = darkNaturalHeight + "px";
          gsap.set(dark, {
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            minHeight: "100vh",
            zIndex: 2,
          });
        } else {
          spacer.style.height = "0px";
          gsap.set(dark, { clearProps: "position,top,left,width,minHeight,zIndex,transform" });
        }
      };

      ScrollTrigger.create({
        trigger: light,
        start: "bottom bottom",
        end: () => "+=" + hold(),
        pin: true,
      });

      ScrollTrigger.create({
        trigger: light,
        start: "bottom bottom",
        end: () => "+=" + overlaySpan(),
        onEnter: () => setOverlay(true),
        onEnterBack: () => setOverlay(true),
        onLeave: () => setOverlay(false),
        onLeaveBack: () => setOverlay(false),
      });

      gsap.fromTo(
        dark,
        { yPercent: () => (window.innerHeight / darkNaturalHeight) * 100 },
        {
          yPercent: 0,
          ease: "none",
          scrollTrigger: {
            trigger: light,
            start: "bottom bottom",
            end: () => "+=" + hold(),
            scrub: true,
          },
        },
      );

      return () => {
        setOverlay(false);
        spacer.remove();
      };
    },
  });
}

export function initTechnologySectionTransition() {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  initSectionCover(".what-we-do", ".tech-domains");
  // A second occurrence (.clients -> .career) was tried and pulled: verified numerically to
  // release with a large, unexplained position jump specific to that pair (not present on
  // the pair above, even after applying the same fixes) — root cause not yet found, see
  // project memory. Re-add once diagnosed rather than ship it broken.
}
