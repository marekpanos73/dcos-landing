# dCOS landing page

One-page marketing website for dCOS, built from the Figma file **dCOS-UI-design-2026**:
https://www.figma.com/design/hb0gaH7IgJpEgI0e7g4YwG/dCOS-UI-design-2026

Three source frames: `Home desktop`, `Home mobile`, `Mobile menu`. Output is meant to be
clean and self-explanatory enough to hand off directly to the client's dev team.

See [docs/DESIGN-NOTES.md](docs/DESIGN-NOTES.md) for design-decision rationale (line
pattern, background glow, animation roadmap, image pipeline).

## Stack

- **Vite** + **vanilla JS** (no framework, no TypeScript) — static HTML/CSS/JS output,
  easiest to hand off to any dev team or drop into a CMS.
- **GSAP** for animation (installed). **Three.js** may be added later for a 3D element —
  not installed yet, add only when that work actually starts.
- Plain CSS (no preprocessor) using CSS custom properties for design tokens.

## Structure

```
index.html              entry HTML
src/
  scripts/
    main.js              entry point, imports styles
  styles/
    main.css              imports tokens.css + base.css, then section stylesheets
    tokens.css             design tokens (colors, spacing, type) as CSS custom properties
    base.css                reset + global element defaults
  assets/
    images/                photos, converted to .webp
    icons/                 icons/vectors, exported as optimized .svg
docs/
  DESIGN-NOTES.md          design decision log (read before implementing sections)
```

## Commands

```bash
npm run dev       # local dev server
npm run build     # production build to dist/
npm run preview   # preview the production build
```

## Conventions

- One section = one block in `index.html`, styled via a dedicated CSS file imported from
  `main.css` (e.g. `hero.css`, `footer.css`) — keep `main.css` itself just the import list.
- Mobile-first CSS; the Figma `Home mobile` frame is the base breakpoint, `Home desktop`
  is the min-width breakpoint on top.
- No inline styles, no `!important`.
- Assets always come from Figma exports via the Figma MCP (`download_assets`), converted
  to `.webp` (photos) or optimized `.svg` (icons/vectors) — never hand-redrawn.
- Only install a dependency when the work that needs it actually starts (see Three.js
  note above).
