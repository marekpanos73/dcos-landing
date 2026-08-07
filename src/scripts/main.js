import "../styles/main.css";
import "@fontsource/poppins/300.css";
import "@fontsource/poppins/600.css";
import "@fontsource/russo-one/400.css";

import { initLinePatterns } from "./line-pattern.js";
import { initHeaderNav } from "./header-nav.js";
import { initMobileMenu } from "./mobile-menu.js";
import { animateHero } from "./hero-animations.js";
import { initContactForm } from "./contact-form.js";
import { initScrollAnimations } from "./scroll-animations.js";
import { initButtonLabels } from "./button-labels.js";
import { initHeroRingTilt } from "./hero-ring-tilt.js";
import { initParallax } from "./parallax.js";

initHeaderNav();
initLinePatterns();
initMobileMenu();
animateHero();
initContactForm();
initScrollAnimations();
initButtonLabels();
initHeroRingTilt();
initParallax();
