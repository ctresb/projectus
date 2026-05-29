# PROJECTUS — Frontend conventions

Strict, non-negotiable rules for the web UI (`apps/web`). Read this before touching any
`.tsx` or `.css`. The goal is one coherent surface: flat, dark, monospace. When in doubt,
copy an existing feature exactly rather than inventing a new pattern.

---

## 1. Philosophy

PROJECTUS is **flat, dark, monospace, zero-radius, and token-driven**.

- No rounded corners. The only radius token is `--r-none: 0px`; every `border-radius` is
  `var(--r-none)` or `0`.
- No shadows except the two popover tokens (see §11). No gradients, no glows.
- One body font: `--font-mono` (JetBrains Mono). Display font `--font-display`
  (Space Grotesk) is for titles only.
- **No magic numbers.** Every spacing, size, duration, color, weight, z-index, and
  letter-spacing comes from a token. Literals are allowed only for the small set of
  intrinsic dimensions documented in §3 — and nowhere else.

If you find yourself typing a raw `px`, `#hex`, `ms`, or `cubic-bezier(...)` in a
component file, stop: there is almost certainly a token for it.

## 2. Tokens & the Single Source of Truth

`apps/web/src/styles/tokens.json` is the **single source of truth**. It is consumed by Rust
(`include_str!` + serde, for the default palette) and by TS/CSS (Vite JSON import, for
motion/system tokens). `apps/web/src/styles/tokens.css` is a hand-maintained **mirror** of
it for CSS custom properties.

**Workflow when adding/changing a token:**

1. Edit `tokens.json` first.
2. Mirror the value into `tokens.css` under the right block.
3. Never duplicate a value — change it in one place and sync.

The header comments in both files say the same thing; keep them honest.

**`--accent` is special.** It is runtime-overridden in `App.tsx` from the user's config:

```ts
const color = workspace?.config.cor_principal
if (color) document.documentElement.style.setProperty('--accent', color)
```

The `--accent: #55b9f7` value in `tokens.css` is only a default. **Never hardcode the
accent color** in component CSS — always reference `var(--accent)` so the user's chosen
color flows through (hover states, focus rings, selection, indicators, links, etc.).

## 3. Spacing scale vs. intrinsic dimensions

Use the spacing scale for all layout — padding, margin, gap:

```
--s-1: 4px   --s-2: 8px   --s-3: 12px   --s-4: 16px
--s-5: 24px  --s-6: 32px  --s-7: 48px   --s-8: 64px
```

Stylelint enforces this: `padding`/`margin`/`gap` may not contain a two-or-more-digit `px`
literal (so `gap: 16px` fails; `gap: var(--s-4)` passes). One-digit nudges like
`gap: 4px` are tolerated for fine alignment but prefer `var(--s-1)`.

**Intrinsic dimensions stay literal** — they are physical properties of a specific widget,
not layout rhythm, so they do not belong on the spacing scale:

- Status/column dots: `7px`–`8px` (`.column__dot` 7px, `.local__dot` 8px).
- `kbd` insets: `padding: 1px 5px`.
- Optical insets / control internals: e.g. the `14px` insets, hairline offsets like
  `-1px`/`-3px` on drop indicators, scrollbar/rail widths (`8px`).
- Typographic units: the blinking cursor's `0.55em` width, `1em` height.

Rule of thumb: if scaling the value with the rest of the layout would look wrong, it is an
intrinsic dimension and stays a literal. Everything else is a token.

## 4. Typography & titles

Two families only:

- `--font-mono: 'JetBrains Mono', ui-monospace, monospace` — body, controls, labels.
- `--font-display: 'Space Grotesk', system-ui, sans-serif` — titles (`h1`, big numbers).

Body text scale: `--text-xs: 10px`, `--text-sm: 11px`, `--text-base: 12px`,
`--text-md: 13px`, `--text-lg: 14px`, `--text-xl: 22px`.

Title tiers (display font, distinct from the body scale):

- `--text-title-sm: 16px`, `--text-title: 17px`, `--text-title-lg: 18px`
- `--text-2xl: 32px`
- `--text-display: 44px`

Line heights: `--lh-tight: 1.2`, `--lh-snug: 1.4`, `--lh-normal: 1.5`,
`--lh-relaxed: 1.55` (body default in `base.css`).

Letter-spacing (tracking): `--track-tight: -0.02em`, `--track-display: -0.045em`,
`--track-label: 0.08em`, `--track-eyebrow: 0.22em`, and `--track-wide: 0.02em`
(used e.g. on `.save-button`).

Font weights: `--fw-regular: 400`, `--fw-medium: 600`, `--fw-bold: 700`. Use these — never a
raw `font-weight: 600`.

## 5. Colors

Never put a raw hex in component CSS. Stylelint enforces `color-no-hex: true`, so any
`#rrggbb` fails the build. All color comes from tokens:

- **Inks (structure):** `--ink: #1a1a1a` (page bg), `--ink-2: #2a2a2a`,
  `--ink-3: #3a3a3a`, `--hair: #3a3a3a` (borders/hairlines), `--paper: #f5f2ea` (text),
  `--fg2: #b8b3a4` (secondary text), `--fg3: #6e6a60` (tertiary text). These are app
  structure and are **not** user-customizable.
- **Semantic states:** `--ok: #61e141`, `--erro: #ff4848`, `--alerta: #fad344`.
- **Accent:** `--accent`, runtime-driven (see §2).

For tints, use `color-mix` against a token rather than a new hex — e.g. the eligible
drop column:

```css
background: color-mix(in srgb, var(--accent) 4%, transparent);
```

The only places raw `rgba(...)` is permitted are translucent overlays/shadows where no
solid token applies — backdrops (`rgba(0, 0, 0, 0.64)`) and the shadow/drop-shadow
literals in §11. `color-no-hex` does not forbid `rgba`, but prefer tokens or `color-mix`
whenever a solid token exists.

## 6. Buttons

Defined in `primitives.css`. Compose, don't reinvent:

- `.btn` — base: 40px min-height, hairline border, transparent bg, transitions on all
  state properties.
- `.btn--primary` — accent fill, inverts to outline on hover.
- `.btn--quiet` — accent border on hover only.
- `.btn--danger` — `--erro` text, `--erro` border on hover.
- `.btn--mini` / `.btn--mini--inline` — 30px, `--fg2`, `--text-sm`.
- `.icon-btn` / `.icon-btn--danger` — 34px square icon button.

In TSX, prefer the wrappers in `components/ui` (`Button`, `IconButton`).

## 7. Checkboxes

Use `.checkbox` (visually-hidden native input + `.checkbox__box`). Box is a 16px square;
checked state fills with `--accent`; focus ring is the standard accent outline;
`.checkbox--disabled` dims to 0.4. Wrapper: `components/ui` `Checkbox`.

## 8. Inputs & selects

`input` is styled globally in `primitives.css`: full width, 40px min-height, `--ink-2`
background, hairline border, zero radius. Placeholders are `--fg3`.

`.select` is a custom button-based dropdown (`.select__trigger`, `.select__chevron`,
`.select__popover`, `.select__list`, `.select__option`, `--active`, `--selected`). The
popover sits at `z-index: var(--z-dropdown)` with `box-shadow: var(--shadow-popover)`.
Labels: `.field-label` / `label` inside forms use `--track-label`, uppercase, `--fg2`.
Helper/error text: `.hint` (`--fg3`) and `.field-error` (`--erro`). Use the `components/ui`
`Field`, `Input`, and `Select` wrappers in TSX.

## 9. Scrollbars

The **global default** scrollbar lives in `base.css` and mirrors the column style: thin,
`--ink-2` track, square `--fg3` thumb, accent on hover/active. You get this for free on any
scroll container — do nothing.

**Opt-out:** when you need a custom overlay scrollbar (draggable square thumb that doesn't
take layout width), use the `SquareScrollArea` component
(`components/SquareScrollArea.tsx` + `components/square-scroll.css`). It hides the native
scrollbar (`scrollbar-width: none`) and renders `.square-scroll__rail` /
`.square-scroll__thumb` instead. This is the only sanctioned deviation from the global
scrollbar.

## 10. Bars & indicators

Thin accent/semantic strips, never filled blocks:

- Card accent bar: `.board-card__bar` — 3px wide, `var(--card-color)` (a per-card CSS var).
- Tags: `.board-card__tags span` / `.tag-choice` — 1px border in `var(--tag-color)`,
  transparent fill, `--text-xs`.
- Status dot: `.local__dot` (`--ok`), `.column__dot` (per-column color).
- Drop indicator: `.column__drop-indicator` — 2px `--accent` line with square endcaps.
- Save spinner uses the `save-spin` keyframes in `base.css`.

## 11. Modals & popovers

Modals live in `primitives.css` (`.modal-backdrop`, `.modal`, `.modal--amplo`,
`.modal--center`, `.modal__head`, `.form-actions`). Backdrop is fixed at
`z-index: var(--z-backdrop)`; the modal head is sticky at `var(--z-base)`. Use the
`components/ui` `Modal` family in TSX.

Two shadow tokens, picked by surface type:

- `--shadow-popover: 0 12px 30px rgba(0,0,0,0.42)` — dropdowns/selects (the larger lift).
- `--shadow-pop: 0 8px 24px rgba(0,0,0,0.4)` — small attached popovers.

**Exception:** `.host-pop` (`components/host-button.css`) deliberately uses a heavier
`filter: drop-shadow(0 8px 24px rgba(0, 0, 0, 0.6))` literal rather than a token, because a
box-shadow can't follow its pointer-tail shape. This is the one intentional shadow literal —
do not "fix" it by swapping in a token, and do not copy it elsewhere.

## 12. Motion

Durations and easing are tokens; TS reads them from `tokens.json`.

- CSS: `--ease: cubic-bezier(0.2, 0.7, 0.2, 1)`, `--dur-fast: 120ms`, `--dur: 200ms`,
  `--dur-slow: 320ms`. Always `transition: <prop> var(--dur-fast) var(--ease)` — never a
  raw `ms` or inline `cubic-bezier`.
- TS/Motion: import timings from `lib/motion.ts` — `EASE`, `EASE_CSS`, `DUR_FAST`, `DUR`,
  `DUR_SLOW`, and the ready-made `TRANSITION_FAST` / `TRANSITION_DEFAULT` /
  `TRANSITION_SLOW` objects. Do not hand-roll duration/easing literals in animations.

The legacy `--fast` alias has been removed; use `--dur-fast`.

## 13. Z-index layering

Use the **named scale only** — never a raw `z-index` integer. Layers, low to high:

```
--z-base: 1      --z-card: 2     --z-raised: 3    --z-sticky: 5
--z-rail: 10     --z-backdrop: 20  --z-overlay: 40
--z-popover: 60  --z-dropdown: 80
```

Pick the layer by role (e.g. sticky topbar = `--z-sticky`, mobile rail = `--z-rail`,
modal backdrop = `--z-backdrop`, select popover = `--z-dropdown`).

## 14. File / CSS organization

Three **global** stylesheets, imported once in `main.tsx` in this order — order matters:

```ts
import './styles/tokens.css'      // 1. tokens (custom properties)
import './styles/base.css'        // 2. reset, element defaults, global scrollbar
import './styles/primitives.css'  // 3. shared component classes (.btn, .modal, input, .select)
```

Per-feature CSS is **co-located** with the feature under `features/<name>/<name>.css` and
imported at the top of that feature's entry component (e.g. `Shell.tsx` does
`import './shell.css'`, `KanbanBoard.tsx` / `ProjectDetail.tsx` do `import './boards.css'`).
Do not import feature CSS globally.

Each feature stylesheet ends with its **responsive `@media` block appended at the bottom**
(see the `@media (max-width: 900px)` blocks at the end of `shell.css` and `boards.css`).
Keep the desktop rules above, the media query last.

**CSS Modules are used only for the editor** (`features/editor/styles/editor.module.css`).
Everywhere else uses plain global class selectors with BEM (§15). Modules are excluded from
Stylelint via `ignoreFiles`.

## 15. BEM naming

Flat, single-class, **feature-prefixed** BEM:

- Block: `.board-card`, `.column`, `.rail`, `.host-pop`.
- Element: `.board-card__bar`, `.column__head`, `.rail__link`.
- Modifier: `.board-card--source`, `.column--eligible`, `.btn--primary`.

One class does one job — no compound `.a.b` selectors for styling, no deep descendant
chains. Stylelint's `selector-class-pattern` is disabled precisely because this convention
(not kebab-strict) is what we follow; that's not a license to nest.

## 16. Adding a new feature — checklist

1. Create `features/<name>/` and a co-located `<name>.css`.
2. Import the CSS at the top of the feature's entry component.
3. Reuse `components/ui` (`Button`, `Field`, `Input`, `Select`, `Modal`, `Checkbox`,
   `Card`, `Text`, `State`, `Layout`) and the shared classes in `primitives.css` before
   writing anything new.
4. Tokens only — no magic numbers (§3, §5).
5. Append the responsive `@media` block at the bottom of `<name>.css`.
6. Wire the feature into `App.tsx`.
7. Reuse the shared behavior hooks instead of re-implementing them:
   - `useNavigationRequest` (`hooks/useNavigationRequest.ts`) — guarded navigation.
   - `useDocumentAutosave` (`hooks/useDocumentAutosave.ts`) — debounced autosave.
   - `useQuickCreate` (`hooks/useQuickCreate.ts`) — keyboard quick-create.

## 17. Linting

Before any commit, both must pass:

```bash
pnpm lint     # eslint . (lint:js) + stylelint apps/web/src/**/*.css (lint:css)
pnpm format   # prettier --write on .ts/.tsx
```

What the linters enforce here:

- **Stylelint** (`stylelint.config.js`, extends `stylelint-config-standard`):
  `color-no-hex` (no raw hex in CSS) and a disallowed-list blocking `\d{2,}px` literals in
  `padding`/`margin`/`gap` (use the spacing scale). `*.module.css` is ignored.
- **ESLint** (`eslint.config.js`): TypeScript + React Hooks + React Refresh on
  `apps/web/src/**/*.{ts,tsx}`; CSS is ignored by ESLint.
- **Prettier** (`.prettierrc`): no semicolons, single quotes, trailing commas,
  `printWidth: 120`, 2-space tabs, always-parenthesized arrow params.

CI/your-own-discipline: green `pnpm lint` is the bar. Fix, don't suppress.
