import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// .value-tiles has its own richer assembly/cascade entrance — see tech-grid.js. .area-tiles
// reveals off the tech-domains cover transition itself (tech-transition.js) instead of a
// scroll-position trigger — its ancestor's positioning mode toggles between static and fixed
// mid-transition, which made a "top 85% of viewport" threshold meaningless. Both excluded
// here to avoid two reveal systems fighting over the same elements.
const REVEAL_GROUPS = [
  { group: ".section-top", items: null },
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
        // See hero-animations.js: without this, GSAP can leave these elements (and every
        // button/link inside them) permanently sitting at the "from" transform after the
        // reveal finishes, which was the reason hover looked dead on almost every button
        // on the page — only the header button, never touched by any tween, worked.
        onComplete: () => gsap.set(targets, { clearProps: "all" }),
        scrollTrigger: {
          trigger: groupEl,
          start: "top 85%",
          once: true,
        },
      });
    });
  });
}
