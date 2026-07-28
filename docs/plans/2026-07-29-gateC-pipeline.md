# Gate C plan: the thirteen-agent pipeline and the content run

Blueprint 9.2 Gate C: the pipeline (5.4) built and unit-tested with gate blocking proven
on fixtures (AC-PIPE-5, 6); the full fleet run over the 7.1 work order under the 9.6
model policy; `validate:content` green on the generated set; seed deleted; AC-PIPE-1..8
green; `content-review.md` generated. A validator failure on generated content is a
pipeline or sources bug: fix and re-run, never hand-edit.

## Architecture decisions

- **Executor shape.** `pipeline/config.ts` declares `executor: 'claude-code' | 'api'`.
  The `api` branch is present, typed, and never wired to a key (ADR-2). The
  `claude-code` executor is documented as: LLM slots are executed by the Orchestrator's
  subagents; the runner consumes slot outputs from `pipeline/runs/{run_id}/slots/` and
  validates them against the slot schemas before any downstream stage runs. The runner
  is therefore fully CLI-drivable per stage: `tsx pipeline/run.ts stage A7 --narrative
  mbg-stop --run <id>` executes deterministic stages directly and, for LLM slots,
  validates + ingests the staged output file. No code path publishes without both gate
  tokens (A12 verifies token vs artifact bytes via pipeline/lib/canonical.ts).
- **Slot roster per narrative** (manifest roles frozen to A5..A11): A5 Causal Extractor
  drafts the asserted spine, edges with quotes, and the structural skeleton of every 7.1
  panel including options (structure only, no numbers minted). A6 Hidden-Node Hunter:
  fresh disjoint context (never sees A5's conversation; input = cluster + asserted
  graph per PRD D5), proposes hidden branches. A7 Evidence Grounder: the ONLY minter of
  numbers; constrained to content/sources.json; grounds every node, edge, hidden entry,
  segment, option proponent; rejects ungrounded candidates (A6 proposals that cannot be
  cited render as unsourced or drop, PRD T4). A8 Cascade Historian: echo vs
  case_library, null means silence; ppn-panic is the only expected match (B-04). A9
  Narrator: one call per language, in-language generation, sentence els bindings,
  sparring 3q + prediction_tap + notes (editorial answers listed in content-review.md).
  A10 Symmetry Auditor: mirror-framing dissection, pass|block with reasons. A11
  Fidelity Guard: deterministic lint pre-pass (lexicon, future-tense, bindings) then
  LLM traceability judgment, pass|block sentence-level.
- **Deterministic stages.** A1 Scout reads `pipeline/snapshot/registry.json` (authored
  at this gate from the verified Phase 0 snapshot data: per narrative, the cluster's
  member articles with headline/outlet/date/live URL). A2 normalizes records. A3
  Clusterer: transformers.js Xenova/multilingual-e5-small (query: prefix, mean pooling,
  normalized; weights cached outside the repo, never committed), cosine threshold tuned
  on the golden mini-set. A4 Prioritizer ranks the fixed set with the velocity +
  causal-density heuristic and records scores. A12 Publisher: schema-validate, derive
  counts, stamp manifest, verify gate tokens, write content/, byte-deterministic. A13
  Librarian: url_index, constellation, feeds, methodology aggregates (symmetry derived
  from published leans; latency measured-or-design-target per 3.4.6).
- **Model policy (9.6, binding).** A5, A6, A10: Fable 5 effort max. A7, A8, A9, A11:
  minimum Opus 5 effort max. Every slot logs requested model+effort, REPORTED identity
  (the agent quotes its system context), start/finish timestamps, input hash. A reported
  mismatch on a mandatory-Fable slot = respawn until correct (mission rule).
- **Run mechanics.** One workflow per narrative (resumable, cache-friendly): stages
  A1-A4 via Bash runner calls, slots via agents with StructuredOutput schemas, gates
  then A12 via runner. Run logs land in `pipeline/runs/{run_id}/` (orchestrator-written,
  committed). Fix-and-rerun loops happen per narrative; a blocked gate rules.
- **Post-run consequences.** Seed root deleted; app dev mode flips to content/; the
  matrix/flow specs pin seed strings, so Gate 6's full-matrix re-run REQUIRES a spec
  re-pin pass against generated content (test-author task, scheduled at Gate 6 entry;
  AC-GRAM baselines refresh then too). Landing (Gate 4) binds to generated content.

## Worker sequence

1. **W1 pipeline test author** (staging): unit tests + eval fixtures, separate from
   implementation per 9.4: publisher determinism (AC-PIPE-2), gate-token mechanics +
   tamper (reinforcing AC-INV-8 at the publisher), A12-refuses-without-tokens
   (AC-PIPE-5/6 unit halves with scripted verdicts), cluster golden mini-set (12
   labeled ID+EN headlines), 3 planted-omission synthetic articles with known hidden
   stakeholders (AC-PIPE-4), stance-leak fixtures (AC-PIPE-5 LLM half), fidelity
   mutation fixtures (AC-PIPE-6), disjoint-context log assertion (AC-PIPE-4
   construction proof).
2. **W2 pipeline implementer**: runner, stages, slot schemas, gates, publisher,
   librarian, snapshot registry, config.ts, clusterer; all W1 tests green; cluster
   purity >= 0.9 with the real model.
3. **Pre-flight LLM proof**: real A10 on the stance-leak fixture (Fable max) must
   block; real A11 on the mutated narration (Opus max) must block; logged.
4. **THE RUN**: ten narratives, both languages, per the work order and figure
   corrections in docs/understanding.md section 8 and .crown notes (enacted APBN,
   poisoning trio, Yale pairing, Treasury ratio, dated Lancet, 60-figure allowed with
   the Tempo link, 987k as flagged estimate, ID copy phrased around the lexicon).
5. **Publish + A13 + validate**: content/ green on all ten checks; seed deleted;
   AC-PIPE-1..8 evidenced; content-review.md (sparring answers, leans, statuses).
6. **Gate C review**: Fable 5 max (mandatory tier), fresh context.
