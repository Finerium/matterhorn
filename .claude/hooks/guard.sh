#!/bin/bash
# Matterhorn write-guard (PreToolUse). Denies mutations of protected paths:
# tests/, evidence/, .crown/, pipeline/runs/, content/ and direct .git manipulation.
# Orchestrator unlock: presence of <repo>/.unlock (gitignored, Bash-managed).
# ponytail: same-session callers are indistinguishable, so this guards accidents,
# not malice; task design + per-task diff review carry the rest.
set -euo pipefail
INPUT=$(cat)
TOOL=$(jq -r '.tool_name // empty' <<<"$INPUT")
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
UNLOCK="$ROOT/.unlock"
PROT='(^|[ ;&|"'"'"'=(])(tests|evidence|\.crown|pipeline/runs|content)/'

deny() {
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"}}\n' "$1"
  exit 0
}

case "$TOOL" in
  Write|Edit|NotebookEdit)
    F=$(jq -r '.tool_input.file_path // .tool_input.notebook_path // empty' <<<"$INPUT")
    [[ -z "$F" ]] && exit 0
    case "$F" in
      "$ROOT"/*) REL="${F#"$ROOT"/}" ;;
      *) exit 0 ;;
    esac
    [[ "$REL" == .git/* ]] && deny "Direct .git writes are forbidden."
    [[ "$REL" == .unlock ]] && deny "The unlock sentinel is orchestrator-managed via Bash only."
    if [[ "$REL" =~ ^(tests|evidence|\.crown|pipeline/runs|content)/ && ! -f "$UNLOCK" ]]; then
      deny "Protected path $REL: tests/, evidence/, .crown/, pipeline/runs/, content/ are orchestrator-only. Deliver work product to staging/ or return it in your report instead."
    fi
    ;;
  Bash)
    CMD=$(jq -r '.tool_input.command // empty' <<<"$INPUT")
    [[ -z "$CMD" ]] && exit 0
    if grep -qE '(^|[;&| ])(rm|mv|shred)[^|;&]*\.git(/|[ "'"'"'])' <<<"$CMD"; then
      deny "Destructive .git manipulation is forbidden. Use git porcelain commands."
    fi
    # ponytail: token heuristic, not a shell parser; false positives read the reason and rephrase
    if [[ ! -f "$UNLOCK" ]] && grep -qE "$PROT" <<<"$CMD" \
       && grep -qE '(^|[;&| ])(rm|mv|cp|tee|touch|mkdir|truncate|ln|sed -i[^|]*|install)([ ;&|]|$)|>' <<<"$CMD"; then
      deny "Bash mutation touching a protected path (tests/ evidence/ .crown/ pipeline/runs/ content/) requires orchestrator unlock."
    fi
    ;;
esac
exit 0
