import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const REVEAL_GROUPS = [
  { group: ".section-top", items: null },
  { group: ".value-tiles", items: ".value-tile" },
  { group: ".area-tiles", items: ".area-tile" },
  { group: ".approach-tiles", items: ".approach-tile" },
  { group: ".leader-tiles", items: ".leader-tile" },
  { group: ".reference-tiles", items: ".reference-tile" },
  { group: ".career__content", items: null },
  { group: ".contact__layout", items: null },
];

export function initScrollAnimations() {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  REVEAL_GROUPS.forEach(({ group, items }) => {
    document.querySelectorAll(group).forEach((groupEl) => {
      const targets = items ? groupEl.querySelectorAll(items) : groupEl;

      gsap.from(targets, {
        opacity: 0,
        y: 32,
        duration: 0.7,
        ease: "power3.out",
        stagger: items ? 0.08 : 0,
        scrollTrigger: {
          trigger: groupEl,
          start: "top 85%",
          once: true,
        },
      });
    });
  });
}
