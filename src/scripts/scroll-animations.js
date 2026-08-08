import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// .value-tiles has its own richer assembly/cascade entrance — see tech-grid.js. .area-tiles
// and .reference-tiles reveal off their own section-cover transition (section-cover.js)
// instead of a scroll-position trigger — the section covering them is held in place by a pin
// well past its own natural "top 85% of viewport" point, which made that threshold
// meaningless (fires before the content is actually visible, or not at all). All three
// excluded here to avoid two reveal systems fighting over the same elements.
const REVEAL_GROUPS = [
  { group: ".section-top", items: null },
  { group: ".approach-tiles", items: ".approach-tile" },
  { group: ".leader-tiles", items: ".leader-tile" },
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
