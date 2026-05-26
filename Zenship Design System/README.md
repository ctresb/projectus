# Zenship Design System

> Built by one person at 3am who actually gives a shit.

Zenship is an AI-native deploy platform for solo devs and small teams. One command ships your frontend, backend, and serverless functions to production. A bundled MCP server lets coding agents deploy directly from any editor.

This design system is the visual + verbal contract for everything Zenship: the marketing site, the CLI, the dashboard, docs, decks, READMEs, error pages, the lot.

---

## What we're going for

**Edgy minimalism with solo-dev soul.** Feels like it was built by one person at 3am, not a Series A company performing authenticity. No marketing fluff. No "trusted by 10,000+ developers." No gradient hero blobs.

**Sumi ink on washi paper, but never literally.** Mostly black/off-white. One accent color per surface, used surgically.

**Monospace pulls the weight.** Code blocks are first-class design elements. The terminal is the metaphor.

**Sharp 90° corners. Generous whitespace. Asymmetric layouts.** The negative space does as much work as the content.

**Borrowed spirit, used as texture.** Wabi-sabi (intentional imperfection), ma (breathing room), kanso (radical simplicity), shibui (no shouting). The Japanese references aren't decoration and they aren't a costume. Kanji (`禅`, `送`, `禅送`) do appear, but only as atmospheric texture: oversized, very low opacity, behind or alongside the content, never as a logo, never as ornament, never larger or louder than the actual UI. They set a mood. They don't perform one. No torii gates, no cherry blossoms, no kanji-as-headline. The restraint is the reference; the texture is the air around it.

### What it should feel like

- Like opening a sticker-covered ThinkPad in a quiet coffee shop
- Like a Bandcamp page for a math rock band that releases music as `.tar.gz`
- Like the README of a tool you found at 2am that solved your exact problem

### What it must NOT look like

- Vercel (too clean, too SF)
- Railway (too playful, too gradient-happy)
- Linear (too polished, too "Series A")
- Any AI startup with a 3D blob in the hero
- Anything that feels like it came out of a Figma design system template

---

## Sources

The user provided six SVG wordmark variants (ZENSHIP logotype, 55×8 viewBox):

- `uploads/zenship_logo_ink.svg` → `assets/logo-ink.svg` (ink-colored letters, for use on paper / light)
- `uploads/zenship_logo_paper.svg` → `assets/logo-paper.svg` (paper-colored letters, for use on ink / dark)
- `uploads/zenship_logo_pink.svg` → `assets/logo-pink.svg`
- `uploads/zenship_logo_yellow.svg` → `assets/logo-yellow.svg`
- `uploads/zenship_logo_blue.svg` → `assets/logo-blue.svg`
- `uploads/zenship_logo_green.svg` → `assets/logo-green.svg`

No codebase, no Figma, no decks, no production screenshots. Everything else in this system is derived from the brief and the visual DNA of the wordmark itself.

---

## Content fundamentals

**Voice: direct, slightly irreverent. Confident without being arrogant.** Talks to developers like they're smart adults. Zero corporate speak. If a sentence sounds like it could be on a Series B landing page, delete it.

**Casing.** Sentence case for everything except eyebrow labels and CLI keywords. No Title Case Marketing Headers. Don't capitalize random nouns for emphasis. Use weight or color.

**Sentences.** Short. Often one-word or fragment. Periods are encouraged. No em-dashes anywhere. If you reach for one, use a period and start a new sentence.

**Pronouns.** "You" when addressing the dev. "We" only when it's genuinely us (the team behind it) doing something, and used sparingly. Never "your team" if a solo dev is reading. Never "enterprises."

**Numbers, not adjectives.** "Ships in 4 seconds" beats "blazing fast." If we don't have a number, we say less.

**Emoji: no.** None. Unicode arrows (`→`, `❯`, `↘`), prompt symbols (`$`, `>`), and box-drawing characters (`┌`, `└`, `─`) carry the visual language instead. ASCII art is fine when it earns its place.

**Forbidden words.** _seamless, robust, leverage, blazing, world-class, cutting-edge, journey, empower, ecosystem, supercharge, unleash, magical, delightful, beautiful (when describing UI), revolutionary, game-changing, next-gen, enterprise-grade._ If you catch yourself reaching for one of these, the sentence is wrong, not the word.

**Allowed words.** Specific verbs. `ship`, `deploy`, `roll back`, `cache`, `bust`, `pin`, `tail`, `diff`, `chmod`, `kill`. Specific nouns. `commit`, `region`, `function`, `cold start`, `bundle`, `edge`, `prod`, `staging`.

### Examples. keep / kill

| Kill (Series-A) | Keep (Zenship) |
|---|---|
| Deploy with confidence | `zenship send`, that's it |
| Trusted by thousands of developers | Used by people who hate yaml |
| Powerful, intuitive interface | One command. Four flags. Read the source. |
| Lightning-fast global edge network | Cold start: 38ms. Cheaper than your domain. |
| Empower your team to ship faster | You don't have a team. Ship anyway. |
| Get started in minutes | `npm i -g zenship && zenship init` |
| Beautifully crafted developer experience | The CLI is 47kb. Type `zenship` to see what it does. |

### Error & empty-state copy

Errors are short, lowercase, and tell you what to do next. No apology. No "oops!". No "something went wrong."

```
deploy failed
> region eu-west-1 is at capacity
> try: zenship send --region us-east-1
```

Empty states are a one-liner and a command, never an illustration.

```
no projects yet
> run `zenship init` in any folder
```

---

## Visual foundations

### Palette: sumi & paper, plus one accent

The system is **ink** (`#1A1A1A`, near-black) on **paper** (`#F5F2EA`, warm off-white). That's 95% of every surface. Pure white and pure black are reserved for the wordmark file and never used in product.

**Accents. Pick one per surface, never mix.** Four allowed:

- `#FE3867`: pink (default, used in error/destructive too)
- `#FAD344`: yellow (used for warn / highlight)
- `#61E141`: lime (used for ok / success)
- `#55B9F7`: cyan (used for info / links in dense data)

A page that uses cyan does not also use pink. Switching accents is a deliberate signal. different product surface, different mode, different season. Toggle via `<html data-accent="cyan|lime|pink|yellow">`.

The accent is structural, not decorative. It marks the cursor, the active state, the destructive button, the one number that matters on the page. If you find yourself painting a card background with the accent, you're wrong.

### Type

- **Brand display face (`--font-mega`):** Zenship Ultra. Custom, single weight, **uppercase-only** (charset: A–Z, 0–9, and the punctuation `! + , - . : ; = ? _`). Loaded from `fonts/ZenshipUltra-Regular.ttf` via `@font-face` with a `unicode-range` declaration so any unsupported glyph automatically falls back to Space Grotesk. **Used surgically: currently only on the hero h1.** Pair every use with `text-transform: uppercase`.
- **General display (`--font-display`):** Space Grotesk 600–700, tight tracking. Section h2s, h3s, tier prices, philosophy headlines, everywhere display weight is needed and the charset is unrestricted.
- **Body, UI, labels, code, basically everything else:** JetBrains Mono. Free, on Google Fonts.
- **No third sans.** No serif. No script. No "personality" font.
- **Weight contrast carries hierarchy** more than size does: 400 vs 700 in mono is enormous and we lean on it.

Caps are reserved for eyebrow labels and CLI keywords. `0.18em` letter-spacing, mono, `--fs-micro`. Never on display copy.

### Spacing. 4px base, graph-paper feel

`4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192`. That's it. Anything in between is wrong.

A faint 32px square grid (`.graph` utility) sits under marketing surfaces at 5% opacity. It's there. You shouldn't notice it unless you look. The grid is doing the work of bringing the layout together. it's the closest thing to ornament we ship.

### Backgrounds

- Solid `--paper` or solid `--ink`. That's the menu.
- **No gradients.** Anywhere. The one exception is fade-to-edge protection on top of a code block, and only when the code overflows.
- **No stock photography. No 3D renders. No abstract blobs. No mesh.**
- Imagery, if any, is documentary: a real screenshot, a real terminal recording, a real flowchart. Always black-and-white or single-accent duotone. Never warm-and-fuzzy lifestyle stock.

### Layout

- **Asymmetric over centered.** Marketing layouts hug the left rail. The headline ends mid-line. The remaining negative space is the design.
- Generous gutters on desktop (`--s-9` / `--s-10`). Don't fill the viewport just because it's there.
- Hairline rules (`1px solid var(--hair)`) separate sections. No card chrome around content unless the card is a button or a code block.

### Borders & cards

- Borders are `1px solid var(--ink)` on paper, `1px solid var(--hair-dark)` on ink. That's it.
- **No border radius.** `--radius: 0`. The whole system is `0`. There is exactly one place rounded corners are acceptable: the rounded outer corners of the ZENSHIP wordmark itself.
- Cards are flat. A card is paper-on-paper with a 1px ink border, or ink-on-paper inverted. No drop shadow on cards.
- **The one shadow we allow** is `--shadow-hard`: a hard 6px offset, no blur, no opacity. Used on the primary CTA and nowhere else. It's the brand's one moment of bravado.

### Motion

Restrained. No bounces. No springs. No "delightful" micro-interactions.

- `120–200ms` is the whole range. `cubic-bezier(0.2, 0.7, 0.2, 1)`.
- Fades and 1–2px translations. That's the vocabulary.
- The blinking cursor is the only ambient animation in the system. Even the loaders are ASCII spinners (`|/-\`).

**When motion needs to be scripted, use [motion.dev](https://motion.dev/) (formerly Framer Motion / Popmotion).** It's the only animation library we ship with. Reach for it via the CDN build (`https://cdn.jsdelivr.net/npm/motion@latest/+esm` in modules, or `https://unpkg.com/motion@latest/dist/motion.min.js` as a script tag) and stay inside the brand's motion budget: short durations, hard easing, no spring overshoot. No GSAP, no anime.js, no hand-rolled `requestAnimationFrame` loops, no Lottie. The rule isn't "motion.dev is allowed". it's "if you reach for an animation library, it's this one."

### Hover & press

- **Hover on text links:** color shifts to `--accent`. No underline change.
- **Hover on buttons:** background and foreground invert. Sharp. No transition longer than 120ms.
- **Press:** 1px translateY shift, no scale. Optionally the hard shadow collapses.
- **Disabled:** 40% opacity, no other treatment.
- **Focus:** 2px solid `--accent` outline, 2px offset. Always visible. Never `outline: none`.

### Transparency & blur

Almost never. No frosted glass. No `backdrop-filter`. If a sticky header needs to sit over content, it sits on opaque paper with a hairline rule under it.

### Imagery vibe (when we must)

Black and white, high contrast, grainy. Think 35mm Tri-X push-processed, not Unsplash. If it must be color, duotone with the active accent. Faces are fine; smiling stock-photo teams in a glass conference room are not.

### Cursor and prompts

The shell prompt is the brand's stand-in for an icon system. `$`, `>`, `❯`, `→` carry visual weight equivalent to a logo lockup. The blinking cursor is the brand's hello.

---

## Iconography

**There is no icon set.** Zenship doesn't ship icons. It ships glyphs.

- **Primary glyphs:** the prompt characters `$`, `>`, `❯`, the arrows `→ ↘ ← ↑ ↓`, the box-drawing chars `┌ ─ ┐ │ └ ┘ ├ ┤`, and the cursor `█`. All rendered in `--font-mono`. These do every job a UI icon would do elsewhere.
- **Logos:** the ZENSHIP wordmark in four colorways (`assets/logo-{ink,paper,pink,yellow,blue,green}.svg`). The wordmark is the only branded mark. We do not use a separate "Z" lockup, favicon-shaped or otherwise: the wordmark crops fine.
- **Status:** color + glyph, never color alone. `OK` in green, `WARN` in yellow, `ERR` in pink, `INFO` in blue, each preceded by the matching word in caps mono.
- **Emoji:** never in product, never in marketing, never in docs. Allowed in casual social/changelog if the team feels like it. Never in error messages, never on the website.
- **When a UI absolutely needs a graphical icon** (e.g. a settings gear, a github mark, a file type), use [Lucide](https://lucide.dev/) at 1.5px stroke, sized to 16/20/24, color `currentColor`. Lucide is loaded from `https://unpkg.com/lucide@latest`. **This is a substitution**: the brand doesn't truly have an icon set, and Lucide is the cleanest line family that won't fight monospaced type. Flag if the user wants to commission a custom set.

---

## What's in this folder

| Path | What |
|---|---|
| `README.md` | you are here: voice, content, visual, iconography |
| `colors_and_type.css` | CSS variables (color, type, spacing, motion) + element defaults |
| `SKILL.md` | Agent Skill manifest, drop this folder into Claude Code as a skill |
| `assets/logo-{ink,paper,pink,yellow,blue,green}.svg` | the ZENSHIP wordmark, four colorways |
| `preview/` | the design-system cards rendered in the Design System tab |
| `ui_kits/marketing/` | landing page recreation (nav, hero, how, features, pricing, footer) |
| `ui_kits/cli/` | dashboard recreation (project list, deploy detail, live logs, ⌘K composer) |

### UI kits at a glance

- **Marketing**: `ui_kits/marketing/index.html`. Light or dark surface, pink accent (theme toggle in nav), asymmetric hero with animated terminal demo. Read `ui_kits/marketing/README.md` for component list.
- **Dashboard**: `ui_kits/cli/index.html`. Dark surface, blue accent. Click a project to drill into deploys + tailed logs. Press ⌘K (or Ctrl-K) to open the command composer. try `zenship send`, `zenship ls`, `zenship tail`, `zenship rollback`, or `help`.

---

## Fonts

Everything is free and from Google Fonts. **JetBrains Mono** (body, UI, code) and **Space Grotesk** (display). No paid licenses, no `fonts/` folder needed; imports happen at the top of `colors_and_type.css`.
