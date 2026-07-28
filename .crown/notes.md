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
