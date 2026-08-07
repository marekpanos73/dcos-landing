import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Entrance for the Technology value-tiles grid (01–05 + one image tile): the five text tiles
 * cascade in document order (works regardless of column count at any breakpoint — 1/2/3
 * columns — instead of grouping by row, which would only line up at one breakpoint), then the
 * image tile enters last with a slight scale-down, reading as the grid "assembling" rather
 * than a flat fade. Hover zoom on the image itself is plain CSS (what-we-do.css).
 */
export function initTechnologyGrid() {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  const grid = document.querySelector(".value-tiles");
  if (!grid) return;

  const cards = grid.querySelectorAll(".value-tile:not(.value-tile--image)");
  // Scale the image itself, not its tile/frame — the frame already clips it
  // (overflow:hidden, what-we-do.css) and must stay fixed so the grid geometry never moves.
  const image = grid.querySelector(".value-tile--image img");
  const animatedTargets = image ? [...cards, image] : [...cards];
  if (!animatedTargets.length) return;

  const tl = gsap.timeline({
    defaults: { ease: "power3.out" },
    onComplete: () => gsap.set(animatedTargets, { clearProps: "all" }),
    scrollTrigger: {
      trigger: grid,
      start: "top 85%",
      once: true,
    },
  });

  tl.from(cards, { opacity: 0, y: 28, duration: 0.7, stagger: 0.09 });

  if (image) {
    tl.from(image, { opacity: 0, scale: 1.06, duration: 0.8 }, "-=0.35");
  }
}
