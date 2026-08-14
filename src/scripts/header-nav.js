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

/**
 * Which nav link's section is currently under the sticky header. Walks link order
 * (matches section order) and keeps the last one whose section has scrolled up past
 * the header — the standard scrollspy trick, cheap enough for ~5 sections on scroll.
 * Links with no matching `#id` section (e.g. the placeholder "Blog" link) are skipped.
 */
function watchActiveSection(links, onChange) {
  const tracked = links
    .map((link) => {
      const id = link.getAttribute("href")?.slice(1);
      const section = id ? document.getElementById(id) : null;
      return section ? { link, section } : null;
    })
    .filter(Boolean);

  if (!tracked.length) return;

  const header = document.querySelector(".site-header");
  let ticking = false;

  function update() {
    ticking = false;
    const line = (header?.offsetHeight ?? 0) + 1;

    // No default to tracked[0] here — before the first tracked section (Řešení) has
    // actually scrolled up past the header, nothing should be "active" yet. Reported bug:
    // the ghost showed under "Řešení" immediately on page load, before the user had
    // scrolled anywhere near it.
    let active = null;
    for (const entry of tracked) {
      if (entry.section.getBoundingClientRect().top <= line) {
        active = entry;
      }
    }
    onChange(active ? active.link : null);
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  update();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
}

/**
 * Ghost indicator: a 4px bar that slides + fades between nav links as the user hovers
 * (or tab-focuses) across them. When not hovered, it rests under whichever link's
 * section is currently under the sticky header (see `watchActiveSection`).
 * Position is computed from bounding rects against `.site-header__inner` rather than
 * offsetLeft, so it stays correct regardless of the inner row's own centering/padding.
 */
export function initNavGhost() {
  const container = document.querySelector(".site-header__inner");
  const list = document.querySelector(".site-nav__list");
  const ghost = document.querySelector(".site-nav__ghost");
  if (!container || !list || !ghost) return;

  const links = Array.from(list.querySelectorAll("a"));
  if (!links.length) return;

  const desktopQuery = window.matchMedia(`(min-width: ${NAV_BREAKPOINT}px)`);
  // Starts with nothing active — see the matching change in watchActiveSection's update():
  // the ghost must stay hidden until the user has actually scrolled down to the first
  // tracked section, not appear under it from page load.
  let current = null;
  let activeLink = null;
  let hovering = false;

  function place(link) {
    current = link;

    if (!link || !desktopQuery.matches) {
      ghost.classList.remove("is-visible");
      return;
    }

    const linkRect = link.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    ghost.style.transform = `translateX(${linkRect.left - containerRect.left}px)`;
    ghost.style.width = `${linkRect.width}px`;
    ghost.classList.add("is-visible");
  }

  links.forEach((link) => {
    link.addEventListener("mouseenter", () => {
      hovering = true;
      place(link);
    });
    link.addEventListener("focus", () => {
      hovering = true;
      place(link);
    });
  });

  list.addEventListener("mouseleave", () => {
    hovering = false;
    place(activeLink);
  });
  list.addEventListener("focusout", (event) => {
    if (!list.contains(event.relatedTarget)) {
      hovering = false;
      place(activeLink);
    }
  });

  window.addEventListener("resize", () => place(current));

  watchActiveSection(links, (link) => {
    activeLink = link;
    if (!hovering) place(link);
  });
}
