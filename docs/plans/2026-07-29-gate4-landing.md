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

## What is NOT in this gate

`/research` is Gate 5. Lighthouse and axe thresholds (AC-LAND-8/9/10) and the scroll-smoothness
trace (AC-PERF-5) run in Gate 6 hardening against the built site; Gate 4 is done when the page
is correct and its behavioral ACs are green, not when it is tuned.

## Worker separation

The copy module and the blueprint-diff check are authored by different subagents than the
section components, and no worker that writes a section writes the test for that section.
