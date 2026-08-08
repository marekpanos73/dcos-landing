import "../styles/main.css";
import "@fontsource/poppins/300.css";
import "@fontsource/poppins/600.css";
import "@fontsource/russo-one/400.css";

import { initLinePatterns } from "./line-pattern.js";
import { initHeaderNav, initNavGhost } from "./header-nav.js";
import { initMobileMenu } from "./mobile-menu.js";
import { animateHero } from "./hero-animations.js";
import { initContactForm } from "./contact-form.js";
import { initScrollAnimations } from "./scroll-animations.js";
import { initButtonLabels } from "./button-labels.js";
import { initHeroShapeRotation } from "./hero-shape.js";
import { initParallax } from "./parallax.js";
import { initSectionCoverTransitions } from "./section-cover.js";
import { initTechnologyGrid } from "./tech-grid.js";

initHeaderNav();
initNavGhost();
initLinePatterns();
initMobileMenu();
animateHero();
initContactForm();
initScrollAnimations();
initButtonLabels();
initHeroShapeRotation();
initParallax();
initSectionCoverTransitions();
initTechnologyGrid();
