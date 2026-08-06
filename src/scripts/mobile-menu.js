export function initMobileMenu() {
  const toggle = document.querySelector("[data-menu-toggle]");
  const menu = document.querySelector("[data-mobile-menu]");
  if (!toggle || !menu) return;

  let isOpen = false;

  function onKeydown(event) {
    if (event.key === "Escape") close();
  }

  function open() {
    isOpen = true;
    menu.hidden = false;
    requestAnimationFrame(() => menu.classList.add("is-open"));
    toggle.setAttribute("aria-expanded", "true");
    document.addEventListener("keydown", onKeydown);
  }

  function close() {
    isOpen = false;
    menu.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    document.removeEventListener("keydown", onKeydown);
    menu.addEventListener(
      "transitionend",
      () => {
        if (!isOpen) menu.hidden = true;
      },
      { once: true },
    );
  }

  toggle.addEventListener("click", () => (isOpen ? close() : open()));
  menu.querySelectorAll("a").forEach((link) => link.addEventListener("click", close));

  // The toggle button's own visibility is the source of truth for "mobile menu mode" —
  // it can appear above the CSS breakpoint too, via the .nav-overflow fallback in
  // header-nav.js, so a fixed media query here would close the menu incorrectly.
  window.addEventListener("resize", () => {
    if (isOpen && getComputedStyle(toggle).display === "none") close();
  });
}
