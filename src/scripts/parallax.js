import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// The career collage (career-photos.webp) is a single pre-composed image where the outer
// edges are meaningful — four separate photos arranged edge-to-edge in one file. Scaling it
// up to get overscan room would crop directly into that composition, so instead the whole
// block drifts as-is, uncropped, rather than the image moving inside a clipped frame.
// 130 amplifies the previous 70 — brief asked for the existing effect to read as clearly
// stronger; re-check for edge overlap with career__text/adjacent sections if tuned further.
const COLLAGE_DRIFT_RANGE = 130; // px, total travel

// Kept modest on purpose: the ring already bleeds past .hero's own bottom edge into Stats by
// design (hero.css) — too much extra drift here pushes it down into the client-logos content
// instead of just the empty blurred area above it.
const HERO_DECOR_RANGE = 80; // px, total travel — a floating decorative element, no framing

function parallaxDrift(target, range) {
  if (!target) return;

  gsap.fromTo(
    target,
    { y: -range / 2 },
    {
      y: range / 2,
      ease: "none",
      scrollTrigger: {
        trigger: target,
        start: "top bottom",
        end: "bottom top",
        scrub: true,
      },
    },
  );
}

export function initParallax() {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  parallaxDrift(document.querySelector(".career__gallery"), COLLAGE_DRIFT_RANGE);

  // Hero's ring/cross/badge group lags slightly behind the rest of the page as hero scrolls
  // away — .hero deliberately keeps overflow:visible for the ring's bleed into Stats (see
  // hero.css), which this doesn't touch.
  const heroDecor = document.querySelector(".hero__decor");
  if (heroDecor) {
    gsap.to(heroDecor, {
      y: HERO_DECOR_RANGE,
      ease: "none",
      scrollTrigger: {
        trigger: ".hero",
        start: "top top",
        end: "bottom top",
        scrub: true,
      },
    });
  }
}
