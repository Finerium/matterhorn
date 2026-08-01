# Gate 4 plan: the landing page

Blueprint 4.4 (frozen copy), AC-LAND-1..14, AC-PERF-1/5/6, AC-SEC-4.

## What is being built

The landing at `/`, replacing the `Home` placeholder in `app/src/routes.tsx`. One scroll: nav,
hero, eight sections, footer. English only. Every string in blueprint 4.4 is FROZEN and ships
verbatim, including typographic case; the only permitted numerals in copy are those inside the
frozen strings, and every curly-brace slot resolves from published content at build.

## Where the risk actually is

Not the layout. Three places:

1. **Copy drift.** Fourteen sections of frozen prose retyped by hand will drift, and a drifted
   string is a silent spec violation that AC-LAND-1 catches only if the test pins the same
   string the blueprint holds. Mitigation: one `landing/copy.ts` module transcribed once, and
   the e2e spec imports the SAME module rather than restating the strings. That makes the test
   prove "what renders equals what the module holds", so a transcription error is invisible to
   it. So a second, independent check is required: a script that greps the blueprint for each
   frozen line and diffs it against the module. That check is the real AC-LAND-1 evidence, and
   it must be authored against the blueprint, not against the module.

2. **Data-bound slots silently hardcoded.** AC-LAND-3 says no literal `{` or `}` renders and the
   numbers equal `methodology.json`. The failure mode is a developer resolving `{gov}` to `6`
   by typing `6`. Mitigation: the slots resolve through a single `useLandingData()` reading
   published JSON, and the unit test asserts the rendered numbers change when the fixture
   changes. A test that only asserts "renders 6" cannot tell a binding from a literal.

3. **Bundle budget.** AC-PERF-1 caps the landing route at 250 KB gzip initial JS, and the
   landing imports real renderer components (AC-LAND-12 requires it). GSAP is needed for pinned
   sequences and Firefox coverage (AC-LAND-14). Mitigation: the landing is a lazily imported
   route so `/app` never pays for it and vice versa; GSAP loads only on the pinned path behind
   `@supports not (animation-timeline: view())` plus a reduced-motion check, so the CSS
   scroll-driven baseline carries Chromium and GSAP is the fallback rather than the default.

## Order of work

1. **Copy module and the blueprint-diff check first**, before any layout. It is the artifact
   everything else is measured against, and writing it last guarantees drift.
2. **Static structure, no motion**: all fourteen sections rendering frozen copy with resolved
   slots, responsive at 390/768/1280/1680. Prove AC-LAND-1/2/3/4/5/13 green on the static page.
3. **Motion last, behind capability queries**: hero claim-map assembly, the four-beat pinned
   Problem sequence, the fleet console loop, grammar card micro-animations. Each set piece must
   have a defined final frame that is what reduced motion shows, so AC-LAND-7 is a property of
   the design rather than a stylesheet bolted on afterwards.

Motion is the last step deliberately: a set piece whose static frame is illegible cannot be
fixed by adding animation, and reduced motion is a hard criterion, not a degradation.

## Dependency justification: gsap 3.15.0 (blueprint 7.5)

Blueprint 7.5 lists `gsap` on the runtime bundle allowlist and ADR-7 names it, so this is not a
new class of dependency. It still gets a written justification, because "allowed" is not "needed"
and the honest answer to "why not CSS only" is not obvious.

**What the CSS baseline does cover, and does cover alone.** More than the ADR assumed. The pin is
`position: sticky`, which every engine has had for years, so no library is needed to pin anything.
The hero's 14 s assembly and the fleet console loop are ordinary keyframes on the document
timeline, so they run on every engine too, Firefox included, and GSAP is never asked for them. The
four-beat advance and the reveals run on `animation-timeline: view()` and a named `view-timeline`
declared on the block the pinned figure lives in. Chromium and Safari therefore run the entire
choreography with zero JavaScript driving it.

**What it cannot cover.** Firefox has not shipped scroll-driven animations: measured on the
Playwright 1.62 firefox build, `CSS.supports('animation-timeline', 'view()')` is false. There is no
CSS-only substitute, because the missing capability IS "link an animation to scroll position".
The alternatives were considered and rejected:

- *Do nothing on Firefox.* The four-beat sequence and every reveal would sit at their final frame.
  Legible, but AC-LAND-14 asks specifically that scroll reveals RUN there, and a set piece that
  moves for 70 percent of readers and not the rest is two designs.
- *Hand-roll it.* A scroll listener plus IntersectionObserver plus a rAF interpolator is perhaps
  120 lines to write and considerably more to get right: refresh on layout change, reverting
  cleanly when the motion preference flips, not fighting the sticky pin. Two of the three bugs
  found while building this (a `from` tween re-applying its start state on refresh, and overlapping
  setups clobbering each other) are bugs the hand-rolled version would also have had, without a
  library's `matchMedia().revert()` to lean on. This is rung 5 of the ladder, not rung 7.

**Cost, and why it is nearly zero.** The import is dynamic and gated on the same predicate the CSS
`@supports` block uses, so a browser runs one path or the other and only the GSAP path downloads
GSAP. Measured: the landing route's initial JS is 108.8 KB gzip without this work and 109.4 KB with
it, against a 250 KB budget; the 43.5 KB gzip of GSAP is in deferred chunks that Chromium never
requests (asserted in `tests/e2e/landing-motion.spec.ts`). The service worker's precache would have
undone that by fetching every emitted chunk on install, so `app/vite.config.ts` excludes the two by
glob and the test reads the emitted manifest back.

**License.** GreenSock Standard "no charge" License, free for this use, recorded with its terms and
its reasoning in `LICENSES.md`. ScrollTrigger has been in the free tier since GSAP 3.13, April 2025.
Version pinned exact, lockfile committed, per 7.5.

## What is NOT in this gate

`/research` is Gate 5. Lighthouse and axe thresholds (AC-LAND-8/9/10) run in Gate 6 hardening
against the built site; Gate 4 is done when the page is correct and its behavioral ACs are green,
not when it is tuned.

AC-PERF-5 moved forward into this gate rather than waiting for Gate 6: the scroll-smoothness trace
measures the choreography, so deferring it would have shipped the motion without ever asking what
it costs. It is in `tests/e2e/landing-motion.spec.ts` with the rest of the choreography evidence.

## Worker separation

The copy module and the blueprint-diff check are authored by different subagents than the
section components, and no worker that writes a section writes the test for that section.
