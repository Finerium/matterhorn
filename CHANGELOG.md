# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-08-02

First release. Grouped by the gates of the build spine, because that is the order the work was
done in and the order the evidence was produced in. Gate reviews are adversarial by design: a
fresh-context reviewer that did not build the work re-runs the checks rather than trusting the
logs. The defects they caught are in the Fixed section below, not omitted from it.

### Added

**Gate 0, foundations**

- Repository scaffolding, the contracts core, a CI skeleton, and a `validate:content` CLI proven
  to fail loudly on an intentionally broken fixture before anything depended on it.
- `docs/understanding.md`: the comprehension document, with eight uncatalogued input conflicts
  (CF-1 to CF-8) recorded and resolved.
- Frozen content snapshot: `content/sources.json` with 44 sources and a recorded liveness field
  per source, `content/og_attribution.json`, eight fetched og images, eleven licensed landing
  assets, and `LICENSES.md` with a row per file.
- Snapshot findings that changed the work order: the flagship `mbg-stop` article is alive at its
  full-slug canonical (open question OQ-2 cleared without an editorial replacement); every
  supposedly dead Indonesian URL turned out to be a truncated bare-ID form; the enacted 2026
  energy-subsidy line was found, so the draft figure never shipped (OQ-7).

**Gate 1, contracts and validator**

- `contracts/types.ts` and ten JSON Schemas covering every published artifact kind, plus the
  banned-verdict lexicon and the technique-tag registry.
- `validate:content` implementing all ten checks of blueprint 6.11, with negative fixtures for
  each: schema, orphan numbers, recomputed counts, narration binding, lexicon and future-tense
  lints in English and Indonesian, manifests and gate tokens, seed quarantine, url index, source
  liveness, pack feeds. Every check runs on every invocation.

**Gate 2, visualization grammar**

- The eight grammar components (Claim Map, Scale Check, Money Flow, Incidence, Dueling Numbers,
  Echo, Options and Playbook, Narrative Family), the card, the evidence and provenance sheets,
  and sentence-bound narration, all rendering from typed JSON.
- The invariants as code rather than policy: `CardContractError` when a headline renders without
  its technique tags and descriptive counts, `OrphanNumberError` when a number renders without a
  `source_id` that resolves.
- A screenshot harness and render-against-render parity evidence versus the design runtime.

**Gate 3, app shell and surfaces**

- Router, screen machine, English and Indonesian bundles, content loader, and the full mobile
  surface set: onboarding, Radar, Dissect, Archive, Settings, the Autopsy assembly with the S3 to
  S0 sparring ladder, and every sheet.
- PWA: manifest, service worker with offline content caching, an offline route, and an Android
  Web Share Target at `/share` that resolves the incoming link against the url index.
- Public permalinks at `/n/{id}`, emitted as real HTML shells at build time so a crawler that
  never runs the bundle still reads the og tags.
- An 80-entry state matrix and 54 flow tests driving the surfaces.

**Gate C, content generation**

- The thirteen-stage pipeline as executable code (`pipeline/run.ts`), one CLI-drivable stage at a
  time, resumable from wherever it stopped. Six stages are deterministic; the seven LLM slots are
  executed by Claude Code subagents whose output is schema-validated before the runner ingests it.
- Two blocking gates: A10 Symmetry Auditor and A11 Fidelity Guard. The model returns a judgment,
  the runner mints the token as a sha256 over the artifact bytes, and A12 publishes nothing
  unless both verdicts pass and both tokens verify against the exact bytes it is about to write.
- Ten published narratives, six in the Indonesia pack and four in EN-Global, each in English and
  Indonesian with sentence-to-element bindings, plus four case-library entries, the constellation
  graph, pack feeds, corrections, url index, and the methodology aggregates.
- `content-review.md`, the operator's editorial sheet: every sparring question with its correct
  answer, every lean assignment, every status.

**Gates 4 and 5, landing and research desk**

- The scroll-driven landing at `/`, with the blueprint's frozen copy transcribed into a single
  module that the rendered page is string-matched against, and set pieces built from the real
  published archive rather than from mockup data.
- The desktop research desk at `/research`: archive table with filters, the full constellation,
  a detail rail, permalinks, and CSV plus JSON export of the graph data.

**Gates 6 to 8, hardening, documentation and deploy**

- Security posture carried by configuration rather than code: `vercel.json` ships a content
  security policy with `script-src 'self'` and `object-src 'none'`, nosniff, a deny frame
  ancestry, and a referrer policy. The deployment is static files only, with no backend and no
  API key anywhere in the repository.
- Documentation: `README.md` and this changelog, joining `LICENSES.md`, `content-review.md`,
  `docs/understanding.md`, and `.crown/notes.md`, the running build log that records the
  decisions, the defects and the deviations as they happened rather than after the fact.
- The visual overhaul, "soft paper, hard glass" (`docs/design-direction.md`): a neumorphic
  paper base fused with glass layers across all surfaces, cursor-interactive throughout
  (magnetic pulls, tilt, sheen), every effect gated behind `prefers-reduced-motion:
  no-preference` with hover and fine-pointer media guards.
- The replay console on the research desk (`docs/replay-protocol.md`): replays the recorded
  pipeline run from `content/replay.json` under a pinned compression disclosure, real block
  records included, and publishes to a phone by QR (`/n/{id}?published=1`) and to a
  same-machine app tab over BroadcastChannel `mth-updates`; opening the autopsy consumes the
  update. Proven by four protocol tests in the research suite.
- The feed card renders each narrative's cached og:image as an attributed link preview, with
  the styled placeholder remaining as the recorded-fallback state. Responsive: a build-time
  480px variant per image (scripts/resize-og.mjs) feeds the card's srcset; the radar and
  autopsy heroes load eagerly at high priority, everything below the fold lazily (AC-LAND-11).
- The shell paints a static copy of the landing hero before the bundle executes; the hydrated
  landing paints over it and then removes it in a mount effect, which runs after the real
  hero's first paint, so the early paint keeps the LCP (Chromium only emits a new entry on a
  larger paint). Landing LCP moved from 2.3 s to under 2 s on the mobile emulation. A hashed
  inline script (allowed by exact sha256 in the CSP) stamps the remembered dark theme
  pre-paint and strips the static hero on every non-landing route.
- Production deployment at https://matterhorn-app.vercel.app with a ten-test smoke suite run
  against the live origin (CSP live, absolute og images, sitemap and robots, PWA icons,
  service worker registration, and the immutable-versus-revalidating cache split), plus
  Lighthouse CI assertions green on mobile and desktop. `Report.md` tells the honest story,
  including the gaps.

### Fixed

Defects found by the gate reviews, each reproduced before it was ranked and each fixed at the
root rather than at the reported symptom.

- **Scale Check divided any two Values without checking their units.** `usaid-deficit` shipped
  "26 percent" rendered as 0.5% and "about 1 percent" rendered as 0.0%, because percent-unit poll
  shares were divided by a dollar denominator. That is on the one narrative whose entire subject
  is the 26-versus-1 misperception. Caught by rendering the published panel through the real
  renderer, not by reading code. Fixed with a `UnitMismatchError` enforced over every segment
  before any numeral draws, with the guard mutation-proved in both directions.
- **A rebuilt panel left a stale number in the prose around it.** After the Scale Check fix the
  narration still named the discarded denominator in both locales, and the sparring answer still
  marked it correct, so a reader who read the corrected panel would have been told they were
  wrong. Both gates caught it on re-judging. The number sat in prose as a bare numeral, where
  neither the orphan-number refusal nor the new unit guard could see it.
- **The future-tense-harm lint never saw Echo panels carried inside `panels[]`**, because the
  string walker dropped array indices from the path it matched against. Contract-legal placement,
  silently unlinted.
- **The url index certified regex patterns it never compiled**, so an invalid pattern would have
  passed the validator and crashed at `/share`.
- **The narrative schema root was open**, so stray root keys could ship.
- **Service worker cache matching was Vary-sensitive**, which blanked all offline behaviour on a
  built preview. Fixed at all four match sites and proven by a control experiment: reverting the
  fix reproduced the identical failure.
- **The counts guard was asymmetric**: an empty object and an empty array did not throw where a
  missing value did.
- **The publisher refused to publish a corrected artifact** because of that narrative's own
  superseded block record. A block binds the bytes it judged, so records are now matched by
  candidate hash: equal refuses, different is named in the log as superseded. Control-proven in
  both directions, after the first control was found to be malformed and re-run.
- **The runner threw "schema already exists"** when a later stage re-ingested an earlier slot,
  because ajv compiled the same `$id` twice.
- **The provenance sheet was titled "The full chain" while showing only A5 to A9.** The gate
  models cannot enter the signed region of the manifest, so the sheet was retitled to "The
  authoring chain", the gate verdicts and tokens now render from `manifest.gates`, and a line
  says where the judging models are recorded.
- **Playwright configs collected each other's specs** until `testMatch` was pinned on both.

### Changed

Content corrections applied at generation time, superseding the figures the design fixtures
carried. Every one is traceable to the corrections registry of the blueprint.

- MBG poisoning counts ship as three unreconciled official counts with their methods (BGN 6,517
  as a running count to 1 October 2025, BPOM 9,089, JPPI 8,649), replacing the fixture's 4,711
  and 9,083. Reconciling them would have been an editorial act, so the conflict is rendered.
- Budget figures ship as enacted rather than draft: APBN 2026 spending Rp3,842.7T and a 2.68
  percent deficit, and the enacted energy subsidy Rp210.06T found during snapshot.
- Yale tariff cost figures ship only as scenario-consistent pairs; the widely quoted $1,700
  figure never ships. The $43.8B foreign-aid figure was dropped because the cited page does not
  carry it.
- The February worker baseline was restored after evidence was found, but flagged as
  self-reported and as an estimate, with its derivation exposed rather than presented as a count.
  This reverses a blueprint deviation on evidence.
- The tariff share is derived at render from two sourced Values against the Treasury monthly
  statement, giving 3.7 percent. The PRD's "under 2 percent" phrasing is contradicted by the
  primary document and never ships.
- Every percentage on screen is derived at render time. None is authored.
- Three published metrics were relabelled after they were found to be unfalsifiable or
  misleading: a "Symmetry Auditor pass rate" that structurally could not read anything but 10 of
  10 (because nothing publishes without both tokens) now states that structural fact and is
  paired with a `gate_blocks` metric that can read zero and reads 4 of 10 across 5 blocks; and
  the latency figure ships as a design target plus a measured wall-clock span whose label says
  what it actually spans.

### Known deviations and gaps

Recorded rather than smoothed over. The long form of each is in `.crown/notes.md`.

- **Model tier.** The binding policy puts A5, A6 and A10 on Claude Fable 5 at effort max. The
  Fable quota was exhausted mid-run. 69 of the 70 LLM slot executions ran on the mandated tier;
  `judol-turnover`'s second A10 round fell back to Claude Opus 5 at max, and that fallback is in
  the run log with the identity the agent reported about itself, not with the identity it was
  asked for. The Gate C reviewers also ran on Opus 5 rather than the mandatory Fable 5.
- **Effort is not evidenced.** The run log proves the model tier of every slot but not the effort
  level, because the runner overwrote the requested string with each agent's bare self-reported
  identity.
- **The clustering eval was a false green.** Purity is maximised by never merging, so a clusterer
  with merging disabled entirely left the spec passing. Pairwise recall was added, the suite went
  red as it should have, and the measured answer is that embeddings over headlines alone do not
  recover the authored families. The recall floor was lowered to an anti-degeneracy value rather
  than left as an invented bar, the real recall prints on every run, and the upgrade path is to
  give that stage article text to embed. What ships is the authored family, not the clustering.
- **Block records are reconstructions.** All five gate blocks were read from the judging
  workflow and fixed directly, so the runner never ingested them at the time. They were backfilled
  with verbatim reasons and marked `reconstructed: true`, and republishing from the run log
  reproduces all ten artifacts byte for byte.
- **The symmetry receipt is 6 government-leaning, 1 neutral, 3 opposition-leaning.** The fixed
  demo set dissects claims leaning toward the government twice as often as claims leaning against
  it. The methodology page reports the split as measured rather than balancing it. This is a
  property of the demo set, not of the method.
- **Two og images are styled fallbacks**, `migrant-crime` and `usaid-deaths`, because the source
  hosts blocked the fetch.
- **Two designed elements were dropped deliberately**: a rolling-accuracy readout in Settings,
  because the demo tracks no cross-session accuracy and rendering an underivable number would
  break the same rule the product enforces on everyone else; and the hero velocity sparkline,
  because no contract field carries velocity on a narrative.
- **Every CI step is blocking, but the end-to-end suite and the pipeline evals are not among
  them**, so those can rot without CI noticing.
- **The three-minute-per-dissection figure is a design target, not a measurement.** The fleet ran
  concurrently and the measured median span is far above it.
