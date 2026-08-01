# Design direction: soft paper, hard glass

The operator's brief, binding: Awwwards-class, glassmorphism fused with neumorphism, every
surface responsive to the cursor, rich motion, and none of the AI-slop ornament vocabulary (no
glowing dots, no particle fields, no gradient soup, no floating orbs). This document is the
single source the implementers copy from. Implement, do not reinterpret.

## Scope boundary, stated first

The phone's INNER screens are contract-frozen to the design zip (AC-GRAM-9 screenshot
baselines) and are not restyled, ever. The surfaces this direction governs:

1. the landing at `/`
2. the research desk at `/research`
3. the desktop stage AROUND the iPhone frame at `/app` (768px and up)

## The idea

One metaphor carries the whole system: **the product's warm paper is a physical material, and
evidence floats above it as glass.** Neumorphism is the paper: soft, matte, extruded, lit from
the upper left, nothing fully flat. Glassmorphism is everything that hovers: navigation,
overlays, the research rail, console panes, floating cards. Ink (#1A1A18) does the talking;
the three semantic accents (supported blue #2563EB, missing red #DC2626, hidden violet
#7C3AED) appear ONLY when they mean something. Decoration never borrows a semantic color.

Depth grammar, strict: paper carries content that IS the page; glass carries content that
FLOATS OVER the page (transient, supervisory, or navigational). If it scrolls with the
document, it is paper. If it would cast a shadow on the document, it is glass.

## Tokens (authoritative values live in `app/src/surface.css`)

Surface elevations, light theme on `--m-paper: #F2F1EC`:

- `--m-relief-raised`: `6px 6px 14px rgba(26,26,24,.08), -6px -6px 14px rgba(255,255,255,.85)`
- `--m-relief-pressed` (inset wells, inputs, toggles):
  `inset 3px 3px 8px rgba(26,26,24,.09), inset -3px -3px 8px rgba(255,255,255,.75)`
- `--m-relief-rest` (cards at rest, quieter than raised):
  `3px 3px 8px rgba(26,26,24,.06), -3px -3px 8px rgba(255,255,255,.7)`

Glass recipe, light:

- fill `rgba(252, 251, 247, 0.62)`, `backdrop-filter: blur(18px) saturate(1.15)`
- edge: `1px solid rgba(255,255,255,.55)` top/left biased via
  `border-color: rgba(255,255,255,.55) rgba(255,255,255,.25) rgba(26,26,24,.06) rgba(255,255,255,.4)`
- drop: `0 12px 32px rgba(26,26,24,.10)`

Dark theme (`[data-theme="dark"]`), paper `#141412`, ink `#EDEBE4`:

- relief-raised: `6px 6px 14px rgba(0,0,0,.45), -6px -6px 14px rgba(255,255,255,.035)`
- glass fill `rgba(28,28,26,.58)`, same blur, edge `1px solid rgba(255,255,255,.09)`,
  drop `0 12px 32px rgba(0,0,0,.5)`

Radii: paper surfaces 16px, glass panels 20px, pills 999px. Never mix radii inside one
component. Type: the system stack already in `tokens.css`; `font-variant-numeric: tabular-nums`
on every statistic (already law).

## Cursor interaction rules

One shared listener, written once in `surface.css`'s companion note and copied by each
implementer into their route module (no shared runtime module across lazy chunks; three copies
of 20 lines beat one eager chunk): a single `pointermove` handler, rAF-throttled, that writes
`--mx`/`--my` (viewport-relative) and per-panel `--px`/`--py` (panel-relative 0..1) custom
properties. CSS consumes the variables; JS never styles.

- **Sheen on glass**: every `.g-glass` panel gets a radial highlight at
  `radial-gradient(600px circle at calc(var(--px)*100%) calc(var(--py)*100%),
  rgba(255,255,255,.10), transparent 40%)` on a `::before` layer. Light only touches glass;
  paper NEVER sheens.
- **Magnetic CTAs** (primary buttons only, max two per viewport): translate toward the cursor
  within a 120px activation radius, displacement capped at 10px, spring back with
  `transition: transform .45s cubic-bezier(.22,1,.36,1)` on leave. Text inside counter-moves
  at 40 percent for parallax depth.
- **Tilt cards** (case cards, grammar cards, research table rows are EXEMPT): max 4deg on
  either axis, `perspective(900px)`, shadow deepens one step while tilted. Tilt follows the
  panel-relative cursor, not the viewport.
- **Stage parallax** (`/app` desktop stage only): the phone frame translates up to 6px against
  the cursor, its shadow moves opposite at 30 percent. Nothing inside the frame moves.
- **Keyboard parity**: every cursor affordance has a `:focus-visible` twin: magnetic buttons
  show the deepened shadow state, tilt cards lift 2px flat, glass panels show a 2px ink
  outline offset 2px. No interaction is pointer-only.
- **Inertness**: ALL of the above is wrapped in `@media (prefers-reduced-motion:
  no-preference) and (hover: hover) and (pointer: fine)`. Touch devices and reduced-motion
  readers get the rest state, which must look finished, not disabled.

## Motion vocabulary

- Durations: micro 120ms, standard 240ms, entrance 420ms. Easing: `cubic-bezier(.22,1,.36,1)`
  everywhere; nothing bounces.
- Animate `transform` and `opacity` only (the AC-PERF-5 rule, already law).
- Entrances rise 12px and fade; exits fade only. Glass panels scale from .98, never from 0.
- The replay console types at 24ms per character with 180ms line pauses; under reduced motion
  the completed timeline renders instantly.

## Research desk background

`public/assets/land/fog-fernando.jpg` (already licensed, LICENSES.md row verified; an unprovenanced research-bg-fog.jpg from an interrupted agent was deleted rather than adopted), treated:
duotone-graded into the paper system (CSS `filter: grayscale(1) contrast(.9) brightness(1.06)`
under a `--m-paper` multiply overlay), `background-attachment: fixed` on pointer-fine devices
only, and a content-protection scrim: the working column sits on `.g-glass` panels, and the
background never appears behind unpanelled text. Contrast on every text node stays AA at
minimum, AAA for body copy; if the image fights the text, the image loses.

## What is banned, verbatim from the operator

Glowing dots. Particle fields. Orbiting blobs. Neon gradients. Emoji. Em dashes. Decorative
uses of the semantic accents. Any animation that runs forever without meaning (the hero's 14s
loop and the console loop are the two sanctioned loops; both stop under reduced motion).
