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
