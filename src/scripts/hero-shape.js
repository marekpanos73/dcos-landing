import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * The hero ring ("oseknuté O") and its cross accent behave as one coordinated graphic with
 * two independent, additive influences on the same `rotation` value — a mouse-follow tilt
 * (desktop fine-pointer only) and a scroll-scrubbed rotation as the hero leaves the viewport.
 * Both pivot around the "Slavíme 20 let" badge's own center. They're summed into a single
 * rotation.state.scroll + rotation.state.tilt total on every update rather than each writing
 * `rotation` directly — two GSAP tweens targeting the same CSS property on the same element
 * would otherwise fight (last-write-wins jitter) instead of composing.
 */

const MAX_TILT_DEG = 7; // mouse tilt full range: -7deg (pointer bottom-left) to +7deg (top-right)
const SCROLL_ROTATION_DEG = 28; // total rotation as the hero scrolls out of view

const canTilt =
  typeof matchMedia === "function" &&
  matchMedia("(hover: hover) and (pointer: fine)").matches &&
  matchMedia("(min-width: 900px)").matches &&
  !matchMedia("(prefers-reduced-motion: reduce)").matches;

const reduceMotion =
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function initHeroShapeRotation() {
  if (reduceMotion) return;

  const hero = document.querySelector(".hero");
  const ring = document.querySelector(".hero__ring");
  const badge = document.querySelector(".hero__badge");
  const cross = document.querySelector(".hero__badge-cross");
  if (!hero || !ring || !badge) return;

  const rotationTargets = cross ? [ring, cross] : [ring];
  const rotationState = { scroll: 0, tilt: 0 };

  function applyRotation() {
    gsap.set(rotationTargets, { rotation: rotationState.scroll + rotationState.tilt });
  }

  function syncPivot() {
    // Pivot around the badge's own center point, expressed as a % within the ring's own
    // box, so it tracks correctly through the cqw-based responsive resizing (hero.css).
    // .hero__badge-cross fills .hero__badge exactly (inset:0), so its default center
    // (50% 50%) already sits at the badge's center — no origin sync needed for it.
    const ringRect = ring.getBoundingClientRect();
    const badgeRect = badge.getBoundingClientRect();
    if (!ringRect.width || !ringRect.height) return;

    const originX = ((badgeRect.left + badgeRect.width / 2 - ringRect.left) / ringRect.width) * 100;
    const originY = ((badgeRect.top + badgeRect.height / 2 - ringRect.top) / ringRect.height) * 100;
    gsap.set(ring, { transformOrigin: `${originX}% ${originY}%` });
  }

  const resizeObserver = new ResizeObserver(syncPivot);
  resizeObserver.observe(hero);
  syncPivot();

  // Scroll-driven component: rotates as the hero leaves the viewport, same trigger range
  // parallax.js already uses for .hero__decor so both stay in sync.
  gsap.to(rotationState, {
    scroll: SCROLL_ROTATION_DEG,
    ease: "none",
    onUpdate: applyRotation,
    scrollTrigger: {
      trigger: hero,
      start: "top top",
      end: "bottom top",
      scrub: true,
    },
  });

  // Mouse-tilt component: independent, desktop fine-pointer only.
  if (canTilt) {
    const setTilt = gsap.quickTo(rotationState, "tilt", {
      duration: 0.6,
      ease: "power3.out",
      onUpdate: applyRotation,
    });

    function onPointerMove(event) {
      const rect = hero.getBoundingClientRect();
      const normX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const normY = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      // Diagonal projection: pointer top-right -> positive (tilt right); pointer
      // bottom-left -> negative (tilt left) — same "/" diagonal the cross accent draws.
      const diagonal = Math.max(-1, Math.min(1, (normX - normY) / 2));
      setTilt(diagonal * MAX_TILT_DEG);
    }

    function onPointerLeave() {
      setTilt(0);
    }

    hero.addEventListener("pointermove", onPointerMove);
    hero.addEventListener("pointerleave", onPointerLeave);
  }
}
