import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Leadership section (two company leaders, not testimonials): a short pinned moment where
 * prominence hands off from leader 01 to leader 02 via a subtle scale/y swap. Runs after the
 * section's own generic entrance reveal (scroll-animations.js) has already finished — this
 * only starts once the section is pinned near the top of the viewport, well past the entrance
 * trigger point. Desktop/tablet only; on mobile the tiles just keep their plain entrance
 * reveal, no pin.
 */
export function initLeadershipSection() {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  const section = document.querySelector(".who-we-are");
  const primary = section?.querySelector('[data-leader="primary"]');
  const secondary = section?.querySelector('[data-leader="secondary"]');
  if (!section || !primary || !secondary) return;

  ScrollTrigger.matchMedia({
    "(min-width: 900px)": function () {
      const pinDistance = () => window.innerHeight * 0.7;

      ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: () => "+=" + pinDistance(),
        pin: true,
        pinSpacing: true,
      });

      const scrollTrigger = {
        trigger: section,
        start: "top top",
        end: () => "+=" + pinDistance(),
        scrub: true,
      };

      gsap.fromTo(
        primary,
        { scale: 1, y: 0 },
        { scale: 0.94, y: 10, ease: "none", scrollTrigger },
      );
      gsap.fromTo(
        secondary,
        { scale: 0.94, y: 10 },
        { scale: 1, y: 0, ease: "none", scrollTrigger },
      );
    },
  });
}
