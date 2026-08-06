// Keep in sync with the 1280px breakpoint in src/styles/header.css.
const NAV_BREAKPOINT = 1280;

/**
 * The desktop nav must never wrap. A static breakpoint covers the common case, but this
 * is a safety net for the widths/zoom levels/font metrics it doesn't: if the nav still
 * doesn't fit on one line above the breakpoint, fall back to the mobile hamburger menu.
 */
export function initHeaderNav() {
  const inner = document.querySelector(".site-header__inner");
  if (!inner) return;

  function check() {
    if (window.innerWidth < NAV_BREAKPOINT) {
      document.body.classList.remove("nav-overflow");
      return;
    }

    document.body.classList.remove("nav-overflow");
    const overflowing = inner.scrollWidth > inner.clientWidth + 1;
    document.body.classList.toggle("nav-overflow", overflowing);
  }

  check();
  window.addEventListener("resize", check);
  document.fonts?.ready.then(check);
}
