---
name: zenship-design
description: Use this skill to generate well-branded interfaces and assets for Zenship — the AI-native deploy platform for solo devs. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping or production work.
user-invocable: true
---

# Zenship design skill

Read the `README.md` file within this skill folder, and explore the other available files.

The system is small and opinionated: sumi-ink-on-paper (or paper-on-ink — dark mode is default), one accent at a time, monospace pulls the weight. Type families: **Zenship Ultra** (custom display, uppercase-only, used on the hero only), **Space Grotesk** (general display), and **JetBrains Mono** (body / UI / code). The latter two are free from Google Fonts. Sharp 90° corners, no rounded anything, no gradients, no emoji. Terminal is the brand's metaphor — `$`, `❯`, `→` and the blinking cursor do the job an icon set would do elsewhere.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out of `assets/` and create static HTML files for the user to view. Import `colors_and_type.css` for tokens. For interactive layouts, the `ui_kits/marketing/` and `ui_kits/cli/` directories show how the system composes.

If working on production code, copy the tokens from `colors_and_type.css`, the voice notes from the README, and read the rules here to become an expert in designing with this brand.

## Quick-reference

- Default accent: pink `#FE3867`. Alternatives: yellow `#FAD344` (warn / highlight), lime `#61E141` (ok), cyan `#55B9F7` (info / dashboards). One per surface, never mix. Set on `<html data-accent="...">`.
- Body font is mono, on purpose. Display is Space Grotesk.
- `--radius: 0` is non-negotiable.
- The one shadow we allow is `--shadow-hard`: a 6px hard offset, no blur, used on primary CTAs and nowhere else.
- Voice: short sentences, lowercase in CLI surfaces, no marketing words ("seamless", "blazing", "world-class"), no emoji. See the keep/kill table in README.
- Motion: the only animation library is [motion.dev](https://motion.dev/). Stay inside the system's motion budget (120–200ms, no springs, fades and 1–2px translations).

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask a couple of pointed questions, and act as an expert designer who outputs HTML artifacts or production code depending on the need.
