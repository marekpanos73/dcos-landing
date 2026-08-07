import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * "Chapter change" transition between the white Technology section and the dark Technology
 * Domains section that follows it: the white section pins right as it's about to scroll out
 * (start: "bottom bottom", i.e. one viewport-height before it would naturally leave), and the
 * dark section — given a higher z-index — rises up through normal document flow underneath
 * the pin (pinSpacing:false means nothing reserves extra space for it) until it fully covers
 * the pinned section, which takes exactly one viewport height regardless of either section's
 * actual content height. Desktop/tablet only — see initTechnologySectionTransition.
 */
export function initTechnologySectionTransition() {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  const white = document.querySelector(".what-we-do");
  const dark = document.querySelector(".tech-domains");
  if (!white || !dark) return;

  gsap.set(dark, { position: "relative", zIndex: 2 });

  ScrollTrigger.matchMedia({
    "(min-width: 900px)": function () {
      ScrollTrigger.create({
        trigger: white,
        start: "bottom bottom",
        end: () => "+=" + window.innerHeight,
        pin: true,
        pinSpacing: false,
      });
    },
  });
}
