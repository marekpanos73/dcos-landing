import gsap from "gsap";

export function animateHero() {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hero = document.querySelector(".hero");
  if (!hero) return;

  if (reduceMotion) {
    gsap.set(
      [
        ".hero__brand-line",
        ".hero__tagline",
        ".hero__lede",
        ".hero__actions .btn",
        ".hero__badge",
        ".hero__badge-cross",
      ],
      { clearProps: "all" },
    );
    return;
  }

  const animatedTargets = [
    ".hero__brand-line",
    ".hero__tagline",
    ".hero__lede",
    ".hero__actions .btn",
    ".hero__badge",
    ".hero__badge-cross",
  ];

  const tl = gsap.timeline({
    defaults: { ease: "power3.out", duration: 0.8 },
    // GSAP's per-element transform cache can be left pointing at the tween's "from" pose
    // once a timeline finishes (reproducible even on a single, un-staggered .from() call)
    // — clearing inline styles afterwards isn't enough, since the stale value lives in
    // GSAP's own cache and re-poisons the next tween that touches these elements. Clearing
    // props on completion resets both, so nothing is left permanently offset (and nothing
    // blocks :hover, which was breaking on every button this animated).
    onComplete: () => gsap.set(animatedTargets, { clearProps: "all" }),
  });

  tl.from(".hero__brand-line", { opacity: 0, y: 24, stagger: 0.08 })
    .from(".hero__tagline", { opacity: 0, y: 16 }, "-=0.4")
    .from(".hero__lede", { opacity: 0, y: 16, stagger: 0.1 }, "-=0.3")
    .from(".hero__actions .btn", { opacity: 0, y: 16, stagger: 0.08 }, "-=0.2")
    .from(".hero__badge", { opacity: 0, scale: 0.85, duration: 1 }, "-=0.6")
    .from(".hero__badge-cross", { opacity: 0, rotate: -8, duration: 1.2, ease: "power2.out" }, "<");
}
