import gsap from "gsap";

/**
 * Subtle mouse-follow tilt on the flat hero ring ("oseknuté O") and its cross accent —
 * both rotate a few degrees toward wherever the pointer is in the hero, pivoting around the
 * "Slavíme 20 let" badge's own center, so they read as swinging around that fixed point
 * rather than spinning in place. The "Slavíme" / "20 let" text itself stays put — only the
 * ring and the cross graphic rotate. Desktop, fine-pointer only; skipped entirely under
 * prefers-reduced-motion, same gate line-pattern.js's ripple uses.
 */

const MAX_ROTATION_DEG = 7; // full range: -7deg (pointer bottom-left) to +7deg (top-right)

const canInteract =
  typeof matchMedia === "function" &&
  matchMedia("(hover: hover) and (pointer: fine)").matches &&
  matchMedia("(min-width: 1024px)").matches &&
  !matchMedia("(prefers-reduced-motion: reduce)").matches;

export function initHeroRingTilt() {
  if (!canInteract) return;

  const hero = document.querySelector(".hero");
  const ring = document.querySelector(".hero__ring");
  const badge = document.querySelector(".hero__badge");
  const cross = document.querySelector(".hero__badge-cross");
  if (!hero || !ring || !badge) return;

  const setRingRotation = gsap.quickTo(ring, "rotation", { duration: 0.6, ease: "power3.out" });
  // .hero__badge-cross fills .hero__badge exactly (inset:0), so its own default center
  // (50% 50%) already sits at the badge's center — no origin sync needed, unlike the ring.
  const setCrossRotation = cross
    ? gsap.quickTo(cross, "rotation", { duration: 0.6, ease: "power3.out" })
    : null;

  function syncPivot() {
    const ringRect = ring.getBoundingClientRect();
    const badgeRect = badge.getBoundingClientRect();
    if (!ringRect.width || !ringRect.height) return;

    // Pivot the ring's rotation around the badge's own center point instead of the ring's —
    // expressed as a % position within the ring's own box, so it tracks correctly through
    // the cqw-based responsive resizing both elements already do (hero.css).
    const originX = ((badgeRect.left + badgeRect.width / 2 - ringRect.left) / ringRect.width) * 100;
    const originY = ((badgeRect.top + badgeRect.height / 2 - ringRect.top) / ringRect.height) * 100;
    gsap.set(ring, { transformOrigin: `${originX}% ${originY}%` });
  }

  function onPointerMove(event) {
    const rect = hero.getBoundingClientRect();
    // -1..1 across the hero box, both axes.
    const normX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const normY = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    // Diagonal projection: pointer top-right (normX high, normY low) -> positive (tilt
    // right); pointer bottom-left (normX low, normY high) -> negative (tilt left) — same
    // "/" diagonal the badge's own cross accent draws.
    const diagonal = Math.max(-1, Math.min(1, (normX - normY) / 2));
    const deg = diagonal * MAX_ROTATION_DEG;
    setRingRotation(deg);
    setCrossRotation?.(deg);
  }

  function onPointerLeave() {
    setRingRotation(0);
    setCrossRotation?.(0);
  }

  const resizeObserver = new ResizeObserver(syncPivot);
  resizeObserver.observe(hero);
  syncPivot();

  hero.addEventListener("pointermove", onPointerMove);
  hero.addEventListener("pointerleave", onPointerLeave);
}
