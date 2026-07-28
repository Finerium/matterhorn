# Matterhorn run notes

## Environment (verified 2026-07-28)
- gh: Finerium (repo scope). vercel: finerium. Node v25.6.0. pnpm 10.33.2.
- Repo: https://github.com/Finerium/matterhorn (private), root ~/Documents/Matterhorn/matterhorn.

## .claude foundation
- Guard hook `.claude/hooks/guard.sh` denies Write/Edit/NotebookEdit/Bash mutations of
  tests/, evidence/, .crown/, pipeline/runs/, content/ and direct .git manipulation.
  Unlock sentinel: repo-root `.unlock` (gitignored), Bash-managed by orchestrator only.
- Pipe-tested 7 payloads: all pass (deny/allow/unlock as designed).
- HONEST GAP: live probe shows hooks written mid-session do NOT bind the current session
  (harness settings watcher only watches dirs that had settings at session start).
  No permission prompt blocked any write, so the Phase 0 stop valve does not apply.
  Mitigations in force this session:
  1. worker dispatch prompts carry explicit protected-path prohibitions,
  2. orchestrator checks `git status --porcelain` after every worker task; protected-path
     writes are reverted and the worker respawned,
  3. reviewers verify diffs against task scope,
  4. parallel file-mutating workers get worktree isolation.
  Hooks bind automatically in any fresh/resumed session (the durability path).
- Session-root registration at ../.claude/settings.json points at the same guard for
  sessions launched from ~/Documents/Matterhorn.

## Conventions
- Protected-path writes by orchestrator: `touch .unlock` before, `rm .unlock` after.
- Workers deliver files via staging/ (gitignored) or report text; orchestrator moves them in.

## Phase 0 comprehension (2026-07-28)
- All four inputs read completely: blueprint 1001 lines, PRD 36pp, zip (dc.html 1521 / data.js 735 / ios-frame.jsx 352; support.js discarded), research 199 lines.
- docs/understanding.md written. Uncatalogued conflicts CF-1..CF-8 recorded there in full; summary:
  CF-1 counts.conflicts chip + dueling teaser -> additive optional DerivedCounts.conflicts with validator coverage; teaser = rule_line.
  CF-2 emoji in chat-sim fixture -> C8 wins, emoji removed.
  CF-3 zip's 5 selectable languages vs 2 locales -> es/fr/ja become "rolls out gradually" rows (regions pattern).
  CF-4 notification primer + lock mocks lack tags -> render Appendix C template shape (top_tag added).
  CF-5 ppn-panic scale_check illustrative denominator -> A7 must ground it or panel falls back to claim_map+echo; Gate C work order carries it.
  CF-6 fixture figures superseded by 7.2 corrections at generation (4,711/9,083/987k/$1,700/$43.8B/draft APBN/authored pcts).
  CF-7 pack 'intl' -> contract 'en', adapter maps.
  CF-8 hardcoded provenance models + matterhorn.app links -> manifest models, SITE_URL.
- Gate 0 reviewer dispatch: requested Claude Fable 5, effort max, fresh context, dispatched $(date '+%Y-%m-%dT%H:%M:%S%z').

## Gate 0 comprehension review: PASSED (2026-07-28, ~19:20 WIB)
- Reviewer: requested Claude Fable 5 effort max; reported identity "claude-fable-5 (Fable 5)". Duration 397s, 257k tokens, read-only.
- sign_off=true, zero discrepancies. Five probe answers all correct.
- Four observations, resolved deliberately:
  1. Stage-count tension (blueprint 3.4.2 names 3 stages; AC-APP-6 says "4-stage progress"):
     RESOLVED: staged progress ships 4 stages: extracting, grounding, auditing, publishing to
     the shared cache. The 4th stage is truthful (the fleet's real publish step), satisfies
     AC-APP-6 literally, keeps 3.4.2's three named stages and the honest line verbatim.
  2. Contract 6.3 requires sparring (exactly 3) AND prediction_tap on EVERY narrative;
     zip only has them on mbg-stop/mbg-poisoning. RESOLVED: Gate C work order authors
     3 sparring questions + 1 prediction tap for all ten narratives in both languages;
     all correct answers land in content-review.md.
  3. Zip's USD context chip (Rp88.15T = about $5.4B) is sourceless. RESOLVED: keep only if
     sources.json gains a dated exchange-rate source at Gate C; otherwise drop the chip.
  4. CF-2 emoji strict reading confirmed defensible; no action.
- Phase 0 step 6 (snapshot & assets) begins now. Snapshot research fleet dispatched
  (8 read-only agents, requested Opus 5 effort max).

## Phase 0 snapshot complete (2026-07-28, fleet: 8x claude-opus-5, 407k tokens, 12 min)
Decisions and findings (full agent output: session task wcv2o11q6):
- FLAGSHIP ALIVE: tribunnews 7844542 lives at its full-slug canonical (published 20 Jun 2026,
  og:image live). OQ-2 STOP-AND-ASK CLEARED, no replacement needed. Real headline is the longer
  "Menantang Pemerintah Setop MBG Permanen: demi Selamatkan APBN dan Permudah Ungkap Korupsi";
  Gate C uses the verbatim original text and the real date (fixture said 14 Jun; real is 20 Jun).
- THE SLUG LESSON: every "dead" Indonesian URL was a truncated bare-ID form. Store full-slug
  canonicals everywhere; the liveness checker must resolve canonicals before declaring death,
  and must catch soft failures: cato.org returns 200 with an anti-bot challenge body; the old
  cekfakta.tempo.co/fakta/295 returns 200 by redirecting to the homepage.
- FRESH-DEMO URL: antaranews.com/berita/4559522 (national wire, stable, clean 1200x800 og).
  Bisnis full-slug article restored as a legacy alias of ppn-panic in url_index. The chat-sim
  forwarded-link preview will show the real ANTARA title and host; Uncle Har's panic caption
  stays (people forward clarifying articles under panic captions; honest and realistic).
- OQ-7 RESOLVED: enacted energy subsidy Rp210.06T (Perpres 118/2025; Kompas 14 Apr 2026 with
  components summing exactly; CNBC corroboration). Ships instead of draft Rp210.1T.
- D-6 REVERSED WITH EVIDENCE: 987k Feb worker baseline is live (Kompas 15 Feb 2026) but is a
  DERIVED estimate (47 x 21,000); ships only flagged self_reported + estimate with the
  derivation exposed. Series 987k->1.28M is methodologically consistent (~43-47/kitchen).
- KFF page does NOT carry $43.8B; the dollar figure is omitted (blueprint default).
- TARIFF RATIO: Treasury MTS FY2025 net figures: customs $194.866B / receipts $5,234.6B
  = 3.7 percent. The PRD "under 2 percent" phrasing is contradicted by the primary document
  and never ships; Scale Check derives the honest ratio from two sourced Values.
- YALE: 2025 dollars; scenario-consistent pairs only ($780/$648 expiration, $1,338/$1,130
  extension); $1,700 banned as before.
- LANCET: canonical journals/lancet PII URL stored; Feb 2026 follow-up reportedly revises the
  projection to 9.4M. GATE C TODO: verify a citable revision source; the 14.05M figure always
  carries its June 2025 date.
- CASE LIBRARY: Tempo Cek Fakta debunk LIVE (7.2.10 gate satisfied: the "60" figure may be
  named with that exact URL). Kominfo 12-hoax count citable via suara.com full-slug; the
  kompas.com article is 8 hoaxes not 12 (PRD Appendix F mislabel; cite accurately).
  kominfo.go.id domain no longer resolves; never cite it. BPOM 9,089 via Bloomberg Technoz
  (direct Taruna Ikrar quote) + bangka.tribunnews infographic; minority-outlet 9,083 noted.
- og IMAGES: 8 fetched (converted jpg, <=1200w). 2 fallbacks: migrant-crime (Cato soft-block),
  usaid-deaths (Lancet 403) -> styled placeholders, Report-listed.
- LAND ASSETS: 11 files, every one <=300KB (AC-PERF-7 pre-satisfied). BY-SA files standalone
  use only (share-alike scoped); CC BY hero safe for composites. sharp added as devDep
  (blueprint 7.5 allows; sips quality flag proved unreliable).
- VALIDATOR CHECK 9 INTERPRETATION (implement at Gate 1): anti-bot sources (cbo/fbi/pnas/
  lancet 403; cato soft-200) carry liveness "live" with corroboration notes; check accepts
  <400 at snapshot OR dead_replaced+note OR live+note documenting corroboration method.
- GUARD HOOK WENT LIVE MID-SESSION: settings watcher picked the hooks up after a delay; writes
  to tests/ are now denied without the unlock sentinel. One false positive observed and
  handled (commit message containing "tests/" + "touch" in a chain), per the guard's
  documented ceiling. Unlock discipline in effect for orchestrator protected-path writes.
- CBO 61697 (Aug 2025) deliberately NOT in sources.json: superseded by 61877 and its exact
  title is duplicated by another CBO publication.

## GATE 0: GREEN (2026-07-28, ~19:50 WIB)
- Evaluator: requested Fable 5 effort max; reported "claude-fable-5". 428s, 95k tokens.
- 9/9 checks pass, zero blocking findings. Six live spot-checks all 200 with figures
  verified verbatim in five bodies (Antara Rp88,15T; PPATK series; KFF 26/11/1; Treasury
  PDF 194,866 + 5,234,616 via pdftotext; Bloomberg Technoz 9.089).
- Two minor findings, both folded into Gate 1 scope: drop --passWithNoTests once tests are
  load-bearing; empty/absent content root becomes a hard failure.
- Gate 1 begins: test author first (RED from blueprint 6.11 spec), then implementer, then
  fresh reviewer. Check slugs shared by both workers: schema, orphans, counts, narration,
  lexicon, manifest, seed, url-index, liveness, feed.

## Gate 1 review round 1: RED (2026-07-28, reviewer claude-opus-5[1m], 26 adversarial probes)
- BLOCKING: future-harm lint scope misses Echo panels carried in panels[] (walkStrings drops
  array indices; path becomes panels.historical.outcome). Contract-legal placement (6.3 union,
  7.1 lists echo among ppn-panic panels). Fix: add panels.historical.outcome to
  future_harm.scope (+ prefer suffix matching); new fixture mirroring bad-future-harm.
- IMPORTANT: (1) narrative schema root open -> stray root keys ship; close with
  additionalProperties:false. (2) url-index regex patterns never compiled -> invalid regex
  certified clean, crashes at Gate 3 /share; compile in try/catch. (3) check 7 second
  conjunct (tests/fixtures never imported by app/) unimplemented; static import scan +
  test, must close before Gate 2 renderers.
- MINOR: fact-check-colon verdict phrase rule (add narrow /fact[- ]check(ed)?\s*[:]/ rule);
  og_attribution shape (policy field, nullable pair, note) needs a Deviations line ->
  RECORDED HERE: og_attribution.json adds top-level policy string + optional per-entry
  note + nullable image_url_original/fetched_at for fallback rows; additive, validator-
  covered, disclosed. Source.notes exemption carries a Gate 2/3 condition: if any surface
  renders Source.notes, drop the exemption or lint rendered notes (re-check at Gate 6).
  liveness 'unverified' must require a note.
- All 4 lexicon exemptions ruled DEFENSIBLE with two-sided probe proof; worker separation
  proven from history; contract fidelity field-for-field faithful.
- Fix loop round 1: test-author-2 authors new red cases -> orchestrator installs, verifies
  RED -> fix-implementer -> scoped re-review.

## GATE 1: GREEN (2026-07-28, ~20:35 WIB)
- Fix loop round 1 closed: scoped re-review (claude-opus-5[1m]) verdicts ALL six findings
  ADDRESSED with its own probes (12 probe roots, restamped tokens, 19-path predicate sweep).
- Suite 47/47; ten checks green on real content/; worker separation provable from history
  (75574e4 tests -> a62864b impl -> a4cb3e4 red cases -> 8c66541 fix).
- Deferred minors (fail-closed, documented ceilings): scanAppImports dies loudly on dangling
  symlinks (exit 1 either way); SPECIFIER text scan can false-positive on prose mentioning
  fixture paths in comments/strings. Revisit only if they bite.
- GATE 2 PREREQS carried forward: wire --scan-app app/src into CI validate:content step the
  moment app/src grows real modules (this gate's re-review flagged it; Gate 2 plan has it).
  Lexicon phrase regexes compile bare (config, not content): acceptable, noted.
- Gate 2 begins per docs/plans/2026-07-28-gate2-renderers.md. Seed-flag mechanics decision:
  object-rooted artifact schemas declare optional "seed": const true (additive field whose
  validator coverage IS check 7); array-rooted files are quarantined by directory + import
  scan alone. Zip gaps W1 must fill for schema-valid seeds: sparring/prediction_tap filler
  where the zip lacks them, ID-locale renditions of EN-only zip copy, CF-5 synthetic
  percent-Values for ppn scale (all quarantined, deleted at Gate C).

## GATE 2: GREEN (2026-07-28, ~22:55 WIB)
- Reviewer claude-opus-5[1m]: cold re-runs all green; 42/42 sheet coverage independently
  re-derived and probed (click + Enter); AC-INV specs audited + adversarially extended;
  TRUE render-vs-render parity (zip DC runtime served over localhost, nine side-by-side
  pairs + stopped state, committed under tests/e2e/__screenshots__/parity/): "fidelity
  with defensible deviations, no unexplained visual drift". All 8 disclosed deviations
  ruled defensible.
- Fix round closed same-day: counts guard symmetric ({}/[] throw, proven), CF-1 teaser
  implemented (register and code agree), aria-modal removed until the trap lands, money
  honesty footer shipped as chrome, minors (padding, og attribution, family line, grep
  width, echo fixture trim + assertion). Verified by orchestrator fresh runs: 100/100
  unit, 30/30 e2e cold-spawn. PROCESS NOTE (disclosed deviation from the strict fix-loop):
  no dedicated scoped re-review dispatch for this round; reviewer verdict was GREEN with
  findings as follow-ups, all changes are one-liners re-verified fresh, and the Gate 3
  entry review MUST re-probe: counts {} throw, compact teaser render, aria-modal absent,
  money footer presence.
- GATE 3 OBLIGATIONS (from rulings): provenance-chain sheet renders the full
  manifest.steps chain; focus trap + aria-modal land together; restore the @supports
  animation-timeline view() branch when a scroll container exists; date locale formatting;
  compact og placeholder becomes bare "og:image" per zip parity (one-liner + baseline);
  optional scale title derivation "How big is {display}?". GATE C OBLIGATION: A7 authors
  the subject segment first (ScaleCheck emphasizes index 0).
- REPORT LEDGER ITEMS: STATUS_LABEL unification (deliberate); spine-node subtitles and
  family member framing quotes dropped for want of contract fields (deliberate, C2-safe);
  panel titles fixed-generic except scale_check.

## Gate 3 matrix installed (2026-07-29 ~00:15 WIB)
- 80-entry state matrix (74 live, 6 gate5-flagged), 54 flow tests, boundary spec, console
  guard on all app-config e2e. Observed red maps 1:1 to unbuilt surfaces; shell already
  green on 19 matrix rows + 11 flow tests, console-clean.
- RULINGS: crisis-hold notice = chrome toggled by the demo mechanism the zip itself uses
  (contract crisis_hold feed flag stays available for Gate C editorial use); under-review
  binding via an authored seed corrections entry for mbg-poisoning; money-severance
  exactness is fixture-limited (all zip mbg-stop rows break; unit-level selectivity was
  proven at Gate 2); AC-APP-22 guard covers the app-config specs, grammar spec wires it
  when next unfrozen.
- GATE C PROMPT NOTE (observed live): the whole-word ID verdict lint catches "salah satu"
  constructions; Narrator (A9) and Guard (A11) prompts must carry the lexicon and the
  writers must phrase around it (sebuah/dari antara), never weaken the lint.
- vitest now permanently excludes staging/**.

## GATE 3: GREEN (2026-07-29, after one fix round)
- Reviewer claude-opus-5[1m]: 24/25 checks passed first pass; RED on one real defect:
  Vary-sensitive SW cache matching blanked ALL offline behavior on a built preview.
  Fix round: ignoreVary on all four match sites, PROVEN by a control experiment (fix
  reverted -> identical failure); offline trio now 3/3 automated under
  tests/e2e/preview.config.ts (real build + real SW); close controls added to the three
  text-only sheets; U+2019 alignment. Review also completed AC-GRAM-9's app half
  (six side-by-side pairs vs the living zip runtime: fidelity with defensible
  deviations), verified D-10 tagline verbatim + old tagline absent repo-wide, all
  Gate 2 residuals re-probed clean, and all 13 wave deviations adjudicated (11
  defensible, 2 -> disclosure lines below).
- DEVIATIONS DISCLOSED (review minors, now formal):
  1. Settings rolling-accuracy readout ("9 of 12 - promotes at 75%") dropped: the demo
     tracks no cross-session accuracy and rendering an underivable number violates C3's
     spirit. Revisit if on-device accuracy history lands.
  2. Hero velocity sparkline deferred to the /research detail rail (F11): no contract
     field carries velocity on Narrative. Re-evaluate at Gate 5.
  3. Appendix C placeholder tokens localized to bundle naming ({date}->{at},
     {pack_label}->{pack}, {headline_short}->{headline}, {top_tag}->{tag}); rendered
     strings byte-verbatim (verified live).
  4. AC-APP-22 carries ONE named scoped exception (offline suite only): the SW's honest
     504 for never-cached content JSON, which Chromium logs as a console error. The
     zero-error rule stands everywhere else. Ruling: the app fetching content it cannot
     know is missing is correct; the worker never lies about content it does not have.
- AC-APP-2..14, 16-20, 22-23 green; 15/21 land at Gate 6 with dark parity +
  cross-browser + the generated-content matrix re-pin.

## Gate C pre-flight: PASSED with real models (2026-07-29 ~04:30 WIB)
- 11 slots, 617s, 362k tokens. A10 (fable): leak -> block with named asymmetries, control
  -> pass. A11 (opus): clean -> pass, both mutants -> block naming sentences. A6 (fable):
  recall threshold met on all three planted-omission clusters (fresh contexts, expected
  answers unreadable to judged agents). test:pipeline 27/27. Identities logged in
  pipeline/runs/preflight-a6/run-log.json: every mandatory-Fable slot reported
  claude-fable-5; A11 claude-opus-5[1m]. AC-PIPE-4/5/6 proven on real judgment.
- RUN MECHANICS LOCKED: per-batch: orchestrator stages inputs (runner), workflow chains
  slot agents (A6 input constructed in-script to the proven-identical shape), orchestrator
  ingests via runner (schema validation = the gate; invalid slot -> scoped re-dispatch),
  candidates assembled, gate workflow (A10/A11 on assembled candidates), runner mints
  tokens, A12 publishes. Flagship mbg-stop runs first as the full-path shakedown.
