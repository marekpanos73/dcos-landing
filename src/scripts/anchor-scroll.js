import gsap from "gsap";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";

gsap.registerPlugin(ScrollToPlugin);

// Clamped so short hops (next section) and long ones (nav link straight to the footer) both
// feel proportional instead of either crawling or snapping — duration scales with distance
// between these two bounds.
const MIN_DURATION = 0.4;
const MAX_DURATION = 1.4;
// Distance (px) at which duration reaches MAX_DURATION; scales linearly below that.
const DURATION_DISTANCE = 2200;
const EASE = "power2.inOut";

/**
 * Every in-page `href="#id"` link (nav, mobile menu, footer, hero/section CTAs) currently
 * jumps instantly, per the browser's native anchor behavior. This intercepts those clicks and
 * animates the scroll instead, offset by the sticky header's live height so the target
 * section lands clear of it rather than partly hidden underneath.
 *
 * `.skip-link` is deliberately excluded — it's a keyboard-accessibility shortcut, and an
 * animated delay works against its whole purpose (jump past repeated content immediately).
 */
export function initAnchorScroll() {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const header = document.querySelector(".site-header");

  document.querySelectorAll('a[href^="#"]:not(.skip-link)').forEach((link) => {
    const id = link.getAttribute("href")?.slice(1);
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;

    link.addEventListener("click", (event) => {
      event.preventDefault();

      const headerHeight = header?.offsetHeight ?? 0;
      const y = target.getBoundingClientRect().top + window.scrollY - headerHeight;

      // Keeps the URL/back-button in sync without `location.hash`, which triggers the
      // browser's own instant jump-to-anchor and would fight the animation below.
      history.pushState(null, "", `#${id}`);

      if (reduceMotion) {
        window.scrollTo(0, y);
        return;
      }

      const distance = Math.abs(y - window.scrollY);
      const duration = gsap.utils.clamp(MIN_DURATION, MAX_DURATION, distance / DURATION_DISTANCE);
      gsap.to(window, { duration, scrollTo: { y }, ease: EASE });
    });
  });
}
