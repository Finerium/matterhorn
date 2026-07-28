# Gate C pipeline tests and eval fixtures

Written by the Gate C test author, before `pipeline/run.ts` exists, against
`docs/plans/2026-07-29-gateC-pipeline.md` and blueprint 5.4 / 8.4. Blueprint 9.4 requires the
gate fixtures to come from a different author than the gate implementation, which is why this
tree is staged rather than installed: W2 builds the pipeline to these tests, and the
orchestrator installs the tree under `tests/` when it goes green.

Nothing here touches `tests/`, `app/`, `contracts/`, `scripts/`, `pipeline/`, `content/`.

Everything under `evals/` and `fixtures/` is fiction. Every institution, outlet, operator,
figure and date is invented, and every URL sits on `example.invalid`, which is reserved and
cannot resolve. No artifact in this tree asserts anything about the world.

## Running

```
pnpm exec vitest run --config tests/pipeline/vitest.config.ts     # the whole tree
pnpm exec tsc --noEmit -p tests/pipeline/tsconfig.json            # typecheck
pnpm exec eslint tests/pipeline --no-ignore                       # lint
pnpm exec tsx tests/pipeline/fixtures/stamp.mjs                   # restamp after a fixture edit
```

The root vitest config permanently excludes `staging/**` and the root eslint config ignores it,
so both commands above carry their own config or flag. The staging tsconfig extends the repo
tsconfig and adds this directory to `include`; the compiler options are the repo's.

## The runner surface these tests pin

W2 is free everywhere else. These are the shapes the specs read and write:

```
tsx pipeline/run.ts stage <A1..A13> --run <run dir> [--narrative <id>] [--out <content root>]
```

`--run` takes a path to a run directory. Per-narrative stages take `--narrative`; A12 and A13
take `--out`, the content root they write into, because a test must never publish into
`content/`. Exit 0 on success, nonzero on refusal.

Inside a run directory:

| Path | Written by | Shape |
| --- | --- | --- |
| `run.json` | the run | `{ run_id, generated_at, narratives[], fresh_demo: { narrative_id, url } }` |
| `stages/A1.json` | A1 | `{ records: [{ id, lang, headline, outlet, date, url }] }` |
| `stages/A2.json` | A2 | `{ records: [...] }`, same ids, normalized |
| `stages/A3.json` | A3 | `{ assignments: [{ id, cluster }] }` |
| `stages/A4.json` | A4 | `{ ranked: [{ cluster, score, rank }] }`, rank 1-based, score descending |
| `slots/<id>/cluster.json` | A4 | the per-narrative cluster A5 and A6 are both given |
| `slots/<id>/A5.input.json` … `A11.input.json` | the runner | the input handed to each LLM slot |
| `slots/<id>/A5.json` … `A11.json` | the orchestrator, validated and ingested by the runner | slot outputs |
| `slots/<id>/candidate.json` | the runner | the assembled artifact the gates judge and A12 publishes |
| `slots/<id>/A10.json`, `A11.json` | the gate stages | `{ verdict: 'pass' \| 'block', reasons: [], token }` |

Three consequences the specs enforce:

1. **The candidate is derivation-stable.** `counts` and `provenance.source_count` already equal
   what A12 recomputes, and `manifest.gates` is absent. So `gateToken(candidate)` is the token
   A12 verifies against the bytes it writes, and A12 stamping the gates in changes nothing else.
2. **The runner mints the tokens, not the model.** A gate slot returns a judgment; a sha256 over
   the artifact is not something a language model can compute. `stage A10` and `stage A11` write
   `token` into their verdict file, and `gates.spec.ts` recomputes it with
   `pipeline/lib/canonical.ts` and compares.
3. **A blocked narrative leaves a durable mark.** After a block verdict, the run directory must
   gain a file naming the narrative and the block. Which file is W2's choice; the spec searches
   the files the stage created rather than pinning a path.

A12 stamping `generated_at` from the clock would fail the determinism spec. Every field of a
published artifact has to come from the run inputs.

## AC map

| AC | What it says | Spec | Fixture |
| --- | --- | --- | --- |
| AC-PIPE-1 | full run, all 10 narratives, run log committed | not a unit test: run log plus `pnpm validate:content` | the run |
| AC-PIPE-2 | deterministic stages are deterministic | `unit/pipeline/publisher.spec.ts` (A12, two runs by hash), `unit/pipeline/stages.spec.ts` (A2) | `fixtures/runs/gc-fixture-0` |
| AC-PIPE-3 | cluster purity at least 0.9 | `evals/cluster.spec.ts` | `evals/cluster-golden.json` |
| AC-PIPE-4 | A5 and A6 disjoint, A6 recalls 2 of 3 planted | `unit/pipeline/gates.spec.ts` (construction proof), `evals/planted-omission/planted-omission.spec.ts` (recall) | `fixtures/runs/gc-fixture-0/slots/rambai-levy/A5.json`, `evals/planted-omission/clusters/*.json` + `expected.json` |
| AC-PIPE-5 | symmetry gate blocks, A12 consequently refuses | `unit/pipeline/gates.spec.ts` (scripted block), `evals/stance-leak/stance-leak.spec.ts` (real A10) | `evals/stance-leak/leak/`, `evals/stance-leak/control/` |
| AC-PIPE-6 | fidelity gate blocks a mutated narration | `unit/pipeline/gates.spec.ts` (scripted block), `evals/fidelity-mutation/fidelity.spec.ts` (real A11) | `evals/fidelity-mutation/clean.json`, `mutant-el.json`, `mutant-trace.json` |
| AC-PIPE-7 | model floor honored | not a unit test: run log review against 9.6 | manifest `steps[].model` in every fixture artifact shows the intended shape |
| AC-PIPE-8 | per-narrative wall time recorded | not a unit test: run log plus `methodology.json` | `stages.spec.ts` asserts the A13 metrics root stays validator-green |
| AC-INV-8 | no code path publishes without valid gate tokens | `unit/pipeline/publisher.spec.ts` (missing token, missing file, tamper, half-verified), `unit/pipeline/gates.spec.ts` (minting) | `fixtures/runs/gc-fixture-0` |

`stages.spec.ts` also covers the A13 half of the plan: `methodology.symmetry` derived from the
leans actually published, and a content root the real `scripts/validate-content.ts` accepts,
which is where the "exactly one `fresh_demo`" semantics comes from. The validator is run, never
reimplemented.

## Red status

Every spec here is red today. Two different reds, and they clear at different times.

| Spec | Red now, because | Clears when |
| --- | --- | --- |
| `unit/pipeline/publisher.spec.ts` | `pipeline/run.ts` does not exist; `runStage` throws naming it | W2 ships the runner |
| `unit/pipeline/gates.spec.ts` | same, for every case except the fixture-token guard | W2 ships the runner |
| `unit/pipeline/stages.spec.ts` | same | W2 ships the runner |
| `evals/cluster.spec.ts` | same, AND A3 needs the real embedding model | W2 ships A3 and the model cache is warm |
| `evals/planted-omission/planted-omission.spec.ts` | `pipeline/runs/preflight-a6/slots/<cluster>/A6.json` is absent | the pre-flight A6 pass runs and its output is committed |
| `evals/stance-leak/stance-leak.spec.ts` | `pipeline/runs/preflight-a10/slots/<id>/A10.json` is absent | the pre-flight A10 pass runs (Fable 5 effort max) |
| `evals/fidelity-mutation/fidelity.spec.ts` | `pipeline/runs/preflight-a11/slots/<id>/A11.json` is absent | the pre-flight A11 pass runs (Opus 5 effort max) |

Four assertions in this tree are green today, on purpose. They are fixture guards, not
acceptance criteria: the committed gate tokens match `canonical.ts` (`gates.spec.ts`), the
planted-omission clusters carry three stakeholders and both locales, the stance-leak pair
differs only in the evenness of its treatment, and the two fidelity mutants differ from the
clean artifact by exactly one narration sentence. If a later edit breaks a fixture, these fail
before the eval that depends on it does.

The three eval harnesses fail loudly rather than skipping. A skipped eval is an eval nobody
notices is not running.

## Fixtures

```
fixtures/
  stamp.mjs                     derives counts, source_count and the gate tokens; idempotent
  out-base/sources.json         the fixture source registry, invented institutions only
  runs/gc-fixture-0/            one run dir: A1 records, one narrative's slots, run.json
evals/
  cluster-golden.json           12 labeled headlines, ID and EN, 4 clusters, one split pair
  planted-omission/clusters/    3 clusters, one EN and one ID article each
  planted-omission/expected.json  3 planted stakeholders per cluster, with match cues
  stance-leak/{leak,control}/   narrative.json plus mirror-brief.json each
  stance-leak/expected.json     expected verdicts and the planted leak markers
  fidelity-mutation/            clean.json plus two single-sentence mutants
  fidelity-mutation/expected.json  expected verdicts, the mutated sentence, the fault cues
```

Run `stamp.mjs` after editing any fixture datum. It rewrites `counts`, `provenance.source_count`
and both gate tokens from `pipeline/lib/canonical.ts`, the same module A12 and the validator
use, so a fixture token can never be a second implementation of the recipe.

The eval fixtures carry a candidate manifest, with `manifest.gates` absent: that is what A10
and A11 actually see, since the gates run before the tokens exist.

### What the two fidelity mutants break

`mutant-el.json` points narration sentence `v-3` at `h7`, an element the artifact does not
declare. A11's deterministic pre-pass can catch that alone.

`mutant-trace.json` breaks nothing mechanical. The binding resolves, the cited body resolves in
the registry and is already cited elsewhere in the artifact, and the sentence introduces no
`Value` object, so the no-orphan-numbers check has nothing to see. The invented Rp18 billion
rebate figure traces to no graph element, and only the traceability judgment can say so. A guard
that blocks the first mutant and passes the second is a lint wearing a gate's name.

### Why the stance-leak control exists

Blocking everything is not symmetry auditing. The control carries the same invented event, the
same invented evidence and the same panel shapes as the leak fixture; only the evenness of the
treatment differs. A pre-flight run that blocks both has proven nothing about A10.
