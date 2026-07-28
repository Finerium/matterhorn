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
