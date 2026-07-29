# ARCHITECTURE

Matterhorn takes a viral news narrative and renders the causal structure the story implies:
the asserted spine, every edge labelled by evidence status, and the branches the story priced
at zero. It never says true or false. Every number on screen carries a source identifier that
resolves in a committed registry, or the renderer throws instead of drawing it.

Three facts about the system explain most of the code:

1. All analysis is computed at build time by a thirteen-stage agent pipeline, committed as
   JSON, and served as static files. The read path never calls a model and holds no key.
2. Numbers travel only inside a `Value` object with a `source_id`. That single rule is what
   makes "no orphan numbers" mechanically checkable rather than a policy.
3. Two agents can block publication, and the publisher does not trust their word for it. A
   verdict carries a sha256 over the exact artifact bytes; publication is refused unless both
   hashes recompute against the bytes about to be written.

This document describes what the code in this repository actually does. Where the
implementation departs from `blueprint-matterhorn.md` Section 5.4, Section 3.5 below names the
departure rather than paraphrasing the blueprint.

---

## 1. The three planes

Blueprint 5.1 divides the repo into a contracts plane, a pipeline plane and a delivery plane.
Operationally the same division reads as build-time analysis, published content, and the static
read path, with contracts spanning all three because both ends validate against the same files.

| Plane | Lives in | Runs when | Produces |
|---|---|---|---|
| Build-time analysis | `pipeline/`, `contracts/` | Operator invokes the CLI | A run directory under `pipeline/runs/<run_id>/` and, on success, artifacts in a content root |
| Published content | `content/` | Never; it is data | The JSON the app and the validator both read |
| Static read path | `app/`, `scripts/`, `public/` | On every page view, and at build for the shells | A Vite bundle plus per-narrative HTML shells |

### 1.1 Build-time analysis

Everything here is offline and deterministic apart from one first-run download.

- `pipeline/run.ts` is the whole runner. One CLI, thirteen stages, no daemon, no queue.
- `pipeline/config.ts` declares who executes the LLM slots and the per-slot model floor.
  `executor` is `{ kind: 'claude-code' }`. The `api` shape is typed and `assertWired` throws on
  it. Nothing in this repo reads an API key.
- `pipeline/snapshot/registry.json` is the authored work order: ten narratives, each with its
  pack, lean, panel plan, headline pair, canonical URL, og block, and the member articles of its
  family. Stage A1 reads this file and nothing else.
- `pipeline/lib/cluster.ts` embeds headlines locally with `Xenova/multilingual-e5-small` through
  `@huggingface/transformers`. Weights (roughly 120 MB) download on first run into
  `$HF_HOME/transformers` or `~/.cache/huggingface/transformers`, outside the repo, so nothing
  model-shaped can be committed.
- `pipeline/lib/canonical.ts` holds the single definition of the gate token recipe.
- `pipeline/agents/<role>.schema.json` is the output contract for each LLM slot;
  `pipeline/agents/prompts/<role>.md` is the brief that slot is given.
- `pipeline/runs/<run_id>/` is the committed run log: stage outputs, per-narrative slot inputs
  and outputs, step timings, block records.

### 1.2 Published content

`content/` is the only interface between the two other planes. It holds:

| File | Contents |
|---|---|
| `sources.json` | The source registry. Every `source_id` anywhere in the system resolves here or nowhere. |
| `narratives/<id>.json` | One published dissection: panels, narration, sparring, counts, provenance, generation manifest, gate tokens. |
| `packs/<pack>/feed.json` | The per-pack feed ordering, exactly one hero. |
| `url_index.json` | URL to narrative resolution for `/share` and the paste box, including one `fresh_demo` entry. |
| `constellation.json` | Nodes per narrative, links where two narratives cite the same source. |
| `methodology.json` | Symmetry receipt, run metrics, PRD 6.5 policy text, AI disclosure. |
| `case_library.json` | The documented historical episodes the Echo panel draws from. |
| `corrections.json` | The public corrections log. |
| `og_attribution.json` | Per-narrative link-preview provenance and the render policy. |

Only stages A12 and A13 write into a content root, and both require an explicit `--out`, so a
test or a dry run cannot publish into `content/` by omission.

`scripts/validate-content.ts` is the CI guard over this plane and the one command that reads all
of it at once. Its rows are `schema`, `orphans`, `counts`, `narration`, `lexicon`, `manifest`,
`seed`, `url-index`, `liveness`, `feed` (the ten checks of blueprint 6.11) and `size` (the
AC-PERF-2 per-narrative and total JSON budgets, asked here because they are a property of the
published root). Every check runs on every invocation; a short-circuited run cannot tell you what
else is broken. Checks quantify over the artifacts that exist, so an empty root passes the
narrative-shaped checks with a note, with one exception: a content root without `sources.json` is
a hard failure. The validator never touches the network.

### 1.3 Static read path

- One Vite + React SPA rooted at `app/`, routed by `react-router` in `app/src/routes.tsx`:
  `/` landing, `/app` shell, `/n/:id` permalink, `/methodology`, `/share`, `/offline`, 404.
  `/app`, the landing and `/research` are lazy imports so each route's initial JS is budgeted
  on its own.
- `app/src/content.ts` is the only loader. Artifacts are fetched over the network and never
  imported as modules, which is why no fixture can enter the app import graph; validator check 7
  asserts that by static scan. A build-time define, `__CONTENT_BASE__`, is `/content` in a
  production build and `/@fs<repo>/content` when serving, so dev and production read the same
  published root and differ only in how the bytes are reached. The frozen Gate 2 grammar
  fixtures under `tests/fixtures/seed` are reachable only through `__SEED_ROOT__`, which exists
  only in harness mode (`vite app --mode harness`), so only `app/harness.html` and
  `tests/e2e/grammar.spec.ts` can see them.
- `app/src/renderers/` holds the grammar components (claim map, scale check, money flow,
  incidence, dueling, echo, family, options and playbook), the feed card, the evidence sheet, and
  `ctx.ts`, which defines the three render-time refusals (Section 5).
- `scripts/build-permalinks.ts` writes a real `app/dist/n/<id>/index.html` per narrative,
  carrying the frozen blueprint 6.7 og head, because a crawler reads the first response and
  never runs the bundle. The same function is mounted as a dev middleware in `app/vite.config.ts`
  so the dev server and the built site answer `/n/<id>` with the same document.
- `scripts/build-seo.ts` derives `robots.txt` and `sitemap.xml` from the same content root.
- `app/src/sw.ts` is an `injectManifest` service worker registered through `vite-plugin-pwa`.
  The plugin is absent while serving, so the e2e suite has no worker between it and the server.
  Three rules: the precached shell is cache-first, `/content/*.json` is stale-while-revalidate
  in its own cache, and a navigation the network cannot serve falls back to the cached shell and
  then to `/offline`. The fallback asks the content cache first, because serving the shell for
  `/n/<id>` boots the router at that URL and an unvisited id would otherwise paint a load failure
  instead of the offline page. One consequence to know: a correction is one view late for a
  returning reader with a warm cache.
- `vercel.json` fixes the deployed shape: `outputDirectory` is `app/dist`, SPA rewrites exclude
  `/n/`, `/content/`, `/assets/`, `/icons/`, `sw.js` and the manifest, and the CSP is
  `default-src 'self'` with no external origins.
- `scripts/check-build.ts` runs as the last step of `pnpm build` and asserts the budgets on the
  artifact that actually ships: the self-hosted font payload, a 300 KB per-asset ceiling, a
  content hash on every file served under an `immutable` path, and a service worker precache
  under 5 MB.

One honest note on this plane. `pnpm build` runs `vite build app`, the permalink emitter and
`check:build`, and `vite build` emits no content root of its own. No committed build script copies
`content/` or `public/assets/` into `app/dist`. Three e2e configs work around it with the same
line, `rm -rf app/dist/content && cp -R content app/dist/content`
(`tests/e2e/preview.config.ts`, `landing.config.ts`, `research.config.ts`), each carrying a
comment saying the line can go once the deploy gate adds the copy to the build. Wiring the
content root and the asset directories into the served output is still a deployment step
outstanding.

---

## 2. The run directory

Every stage reads state from and writes state to one run directory. Nothing else is state.

```
pipeline/runs/<run_id>/
  run.json                      run_id, generated_at, narrative ids, fresh_demo (written by A1)
  stages/A1.json .. A4.json     the deterministic stage outputs
  slots/<narrative>/
    cluster.json                the family A4 hands this narrative
    <role>.input.json           exactly the input that slot is given
    <role>.json                 the staged slot output, schema-validated on ingest
    steps.json                  role, model, started_at, finished_at, input_hash
    candidate.json              the assembled artifact, before gates
  blocked/<narrative>-<role>-<n>.json   one file per block, never overwritten
```

`run.json` is written by A1 if absent and read by every later stage that needs the run id or
the generation timestamp. `generated_at` is stamped once, at A1, which is what makes two runs
over the same run directory produce byte-identical artifacts.

---

## 3. The A1 to A13 DAG as implemented

```
                once per run                                  once per run
  ------------------------------------           ------------------------------------
  A1 Scout    registry -> records
  A2 Ingestor normalize dates and URLs
  A3 Cluster  local embeddings (evidence only, does not route)
  A4 Rank     score clusters, hand each narrative its AUTHORED family
                              |
                              v            per narrative, A5 to A12
        A5 Causal Extractor ------> A6 Hidden-Node Hunter (disjoint context)
                 |                          |
                 +-----------+--------------+
                             v
                      A7 Evidence Grounder (only minter of numbers)
                             |
                             +--> A8 Cascade Historian (echo or null)
                             |
                             v
                      A9 Narrator  --->  assembleCandidate  ->  candidate.json
                             |
                 +-----------+-----------+
                 v                       v
        A10 Symmetry Auditor      A11 Fidelity Guard
        verdict + reasons         verdict + reasons
                 |                       |
              runner mints            runner mints
              gateToken()             gateToken()
                 +-----------+-----------+
                             v
                      A12 Publisher   verify both tokens against the bytes
                             |        it is about to write, or refuse
                             v
                       content/narratives/<id>.json
                             |
                             v
                      A13 Librarian   once per run
                      url_index, constellation, pack feeds, methodology
```

The CLI is uniform:

```
pnpm pipeline stage <A1..A13> --run <dir> [--narrative <id>] [--out <content root>]
```

Exit 0 on success, exit 1 on a refusal with a `REFUSED` line naming the narrative and the
reason, exit 2 on a usage error. An unknown flag is a usage error rather than being ignored,
because a silently dropped flag is how an unimplemented option ships green.

A5 through A12 are per narrative and require `--narrative`. A12 and A13 require `--out`.

### 3.1 The deterministic stages

**A1 Scout** reads `pipeline/snapshot/registry.json`, flattens every narrative's member
articles into a flat record list sorted by id, and writes `stages/A1.json`. If `run.json` does
not exist it writes it. It refuses if the registry is missing. There is no fetcher: the snapshot
was gathered and verified by hand at Phase 0 and committed.

**A2 Ingestor** normalizes those records. Dates in either language (`5 Mar 2031`,
`20 Februari 2031`) become ISO; anything already ISO is left alone. URLs are parsed, tracking
parameters (`utm_*`, `fbclid`, `gclid`, `ref`, `src` and siblings) are stripped, the fragment is
dropped, and everything else in the query string is kept because a query string can be load
bearing. Whitespace in headlines and outlets is collapsed. Output is sorted by id.

**A3 Clusterer** embeds the normalized headlines and groups them greedily by centroid cosine
similarity at `THRESHOLD = 0.925`, writing `stages/A3.json`. What is embedded is not the raw
headline: function words are removed first, because at this model size a shared sentence frame
outscores a shared referent and no threshold on raw headlines both merges true families and
keeps adversarial near-variants apart.

**A4 Prioritizer** scores each cluster by `velocity + 2 * causal_density + 0.25 * outlets`,
where velocity is articles per day across the span the family occupied and causal density is the
share of member headlines containing one of a bilingual list of causal markers. It sorts by
score descending with cluster name ascending on ties, so the ranking is total and stable, and
writes `stages/A4.json`.

A4 then does the thing that actually routes the run: for every narrative in the registry it
writes `slots/<id>/cluster.json` carrying that narrative's authored family skeleton and its
member articles, each member keeping its registry honesty flags (`reconstructed`, `note`). A
slot has to know which headlines are verbatim titles and which are descriptions of a claim,
because quoting a reconstructed headline as a title is the exact fault this product exists to
catch.

### 3.2 The seven LLM slots, A5 to A11

Under the `claude-code` executor the runner never calls a model. Each slot stage does two
things:

1. Writes `slots/<narrative>/<role>.input.json`, which is exactly the input that slot is given,
   and records a `steps.json` row with the requested model and the sha256 of that input file.
2. If `slots/<narrative>/<role>.json` already exists, validates it against
   `pipeline/agents/<role>.schema.json` and ingests it, stamping `finished_at` and the model
   identity the agent reported about itself.

That validation is not a formality. `A7.schema.json` declares
`panels: { $ref: "narrative.schema.json#/properties/panels" }`, and `A9.schema.json` refs
`narration`, `sparring` and `prediction_tap` the same way, so a slot output is validated against
the shipping contract itself rather than a copy of it. A panel that could not ship cannot be
ingested.

Because inputs are staged and outputs are ingested separately, every stage is independently
CLI drivable and a run resumes from wherever it stopped.

`slotInput` is one function and it is the whole disjoint-context guarantee:

| Slot | Role | Gets | Emits |
|---|---|---|---|
| A5 | Causal Extractor | cluster, panel plan, original claim | `asserted_graph`, `panel_skeleton` |
| A6 | Hidden-Node Hunter | cluster and A5's asserted graph only, never A5's skeleton or notes | `hidden` |
| A7 | Evidence Grounder | cluster, asserted graph, panel skeleton, A6's hidden candidates, panel plan, the source registry | `panels`, `dropped` |
| A8 | Cascade Historian | cluster, asserted graph, `case_library.json` | `echo` or null, `why_null` |
| A9 | Narrator | headline, original, the shipping panel set, the echo, the lexicon | `narration`, `sparring`, `prediction_tap`, `editorial_notes` |
| A10 | Symmetry Auditor | the assembled candidate and any mirror brief | `verdict`, `reasons` |
| A11 | Fidelity Guard | the assembled candidate and the lexicon | `verdict`, `reasons` |

A7 is the only minter of numbers in the fleet, and it is constrained to the source registry it
was handed, which is `<out>/sources.json` when `--out` is given and `content/sources.json`
otherwise. Candidates it could not cite go into `dropped` with a reason rather than being
rendered.

A8 returning null is the ordinary answer. Null means the Echo panel is silent, and `why_null`
records which cases were considered. Silence with a reason is an answer; silence alone is not.

### 3.3 Candidate assembly, at the end of A9

Ingesting A9 triggers `assembleCandidate`, which is where the artifact stops being a pile of
slot outputs and becomes one candidate. The split of authority is strict:

- Everything factual about the article itself (id, pack, lean, status, headline, original text,
  outlet, published date, URL, og block, tags, scaffold default) comes from the registry, field
  by field rather than by spread, because the registry carries operator annotations beside the
  copy and the artifact root is closed.
- Everything editorial comes from a slot: panels from A7, echo from A8, narration, sparring and
  the prediction tap from A9.
- Everything mechanical is derived here: `counts` by the 6.5 rule, `provenance.source_count` by
  walking the artifact for every `source_id` and `citations` entry, `family` from the cluster,
  and `manifest.steps` from the step log.
- `provenance.analyzed_by` and `narrated_by` name the model that actually executed, as the step
  log reports it, not the one config requested (deviation D-2).

One normalisation happens here and at A9 input staging, through the same `shippingPanels`
helper: the echo never rides inside `panels[]` (A8 owns it and the contract carries it at the
artifact root), and the family strip is a marker panel joined last, taken from A7's own family
element when it emitted one and synthesised as `<narrative>-p-family` when the registry work
order lists `family` and A7 did not. Both the A9 input and the candidate must show the same
shipping panel set, or narration binds against a universe the fidelity gate will not recognise.

### 3.4 The gates and the publisher

**A10 and A11** run the same code path. The slot returns a judgment and nothing else. On
`pass`, the runner computes `gateToken(candidate)` and writes it into the verdict file. The
token is a sha256, which no language model can compute over its own input, so the slot never
mints it; `token` in the slot schemas is documented as written by the runner, never by the slot.

On `block`, the runner writes a durable record under `blocked/`, one file per block, never
overwritten, carrying the narrative, the run id, the role, the gate, the verbatim reasons, and
`candidate_sha256`, the hash of the exact candidate file the gate judged. A narrative a gate
sent back twice is two records, and the methodology metric counts them; collapsing them would
let a re-run quietly erase the first objection.

**A12 Publisher** is deterministic and refuses on any of the following, in order:

1. No candidate on disk.
2. A live block: a record under `blocked/<narrative>-*` whose `candidate_sha256` equals the
   sha256 of the candidate now on the table. Records whose hash differs are superseded and are
   named in the log rather than skipped silently.
3. A missing gate verdict file, a verdict that is not `pass`, or a verdict carrying no token.
4. The assembled artifact failing `narrative.schema.json`.
5. A stored `counts` key disagreeing with the 6.5 recomputation, or a stored
   `provenance.source_count` disagreeing with the count of registry ids the artifact actually
   references. A12 derives and compares; it never rewrites bytes the gates already judged.
6. Either token failing to recompute against the artifact bytes about to be written.

The only thing A12 adds to the candidate is `manifest.gates`, and the token recipe nulls that
field out, so `gateToken(published) === gateToken(candidate)` by construction. A12 reads no
clock, no random source and no unsorted directory, so two runs over the same run directory
produce byte-identical output.

**A13 Librarian** reads the published narratives out of the content root, orders them by
registry order rather than directory order (the work order names each pack's hero by listing it
first), and writes four things:

- `url_index.json`: the fresh demo entry first, then one canonical entry per narrative, then
  every family member URL, deduped. It refuses if `run.json` names a fresh demo that did not
  publish.
- `constellation.json`: one node per narrative, and a link between any two narratives that
  reference the same source id, labelled with that source's publisher in both locales.
- `packs/<pack>/feed.json`: one hero per pack, chosen from the pack members that do not enter
  through the dissect flow.
- `methodology.json`: the symmetry receipt counted from the leans actually published, the run
  metrics, PRD 6.5 verbatim, and the AI disclosure.

The metrics are worth reading in the source. `audit_pass` carries the parenthetical "none
publishes otherwise" in its own label because A12 refuses to publish without both tokens, so
that ratio can only ever read n of n; stated as a pass rate it would tell a reader the auditor
approves everything. Its falsifiable companion `gate_blocks` can read zero and did not.
`latency_median` ships as `measured` only if the median wall time is at or under the
three-minute target, and otherwise ships as `design_target` beside a measured figure whose label
says what it actually spans. The wall time is computed from the run log, not from
`manifest.steps`, because the manifest is stamped at A9 and signed by the gate tokens and
therefore structurally cannot contain A10 and A11.

### 3.5 Where this differs from blueprint 5.4

Read alongside the blueprint, these are the real gaps between the described DAG and the code.

1. **A3 groups; it does not route.** Blueprint 5.4 says A3 "assigns `family`". In this
   implementation the families that ship are authored in `pipeline/snapshot/registry.json`, A4
   hands each narrative that authored family, and A12 publishes it. A3's own grouping lands in
   `stages/A3.json` and is corroborating evidence, nothing more. The Gate C eval measured how
   good that corroboration is and the answer is that it is poor: on the golden set, purity 1.000
   with pairwise recall 0.083; on the real work order, 27 records into 22 clusters against 10
   true families. A3 splits rather than merges, and a threshold sweep found no cut that clears
   both floors. The upgrade path is to embed the article lede, and the registry carries no
   article text, so it is a capability gap rather than a tuning error. The comment in
   `pipeline/run.ts` that once claimed A3 proved embeddings recover the same grouping was
   removed rather than left standing.

2. **The gate slots do not emit tokens; the runner mints them.** Blueprint 5.4 says "A10 and
   A11 emit signed gate tokens". A model cannot compute a sha256 over its own input, so the
   slots return `verdict` and `reasons` and the runner stamps the hash on a pass. The guarantee
   the blueprint wanted is unchanged and arguably stronger, because the value being verified was
   never in the model's hands.

3. **A11 is an LLM slot, not a hybrid.** Blueprint 5.4 calls A11 a "deterministic + LLM check".
   In the runner it is an LLM slot like the others. The deterministic half exists but lives
   elsewhere: ingest-time schema validation against the shipping contract, and check 4 of
   `scripts/validate-content.ts`, which walks every narration sentence in both locales against
   the declared `el_id` set in CI.

4. **A7 is not where an unsourced number is first rejected mechanically.** Blueprint 5.4 says
   "any number without a source id is rejected here first". A7's prompt makes the constraint
   binding on the author and `A7.schema.json` enforces the `Value` shape, but a JSON Schema
   cannot check that a `source_id` resolves in a registry. Resolution is enforced at three later
   points: `OrphanNumberError` at render, validator check 2, and A12's `source_count` derivation.

5. **A9 is one slot in the runner and three calls in practice.** Blueprint 5.4 says "LLM slot
   per language". The runner defines a single A9 input and a single A9 output covering both
   locales. The Gate C run executed it as two per-locale calls plus one bilingual reconciler, and
   the per-locale inputs are staged beside the runner's own file as
   `slots/<narrative>/A9.bilingual-inputs.json`. Per-language execution is an orchestrator
   convention above the runner, not a runner stage.

6. **A13 writes no separate archive index.** Blueprint 5.4 lists "constellation, archive index,
   methodology aggregates". The Archive surface reads the two pack feeds, so A13 writes
   `url_index.json`, `constellation.json`, the pack feeds and `methodology.json`, and there is no
   fifth file.

7. **`pipeline/gates/` and `pipeline/fetchers/` do not exist.** Blueprint 5.5 names both. The
   gates are `stageGate` inside `pipeline/run.ts`, which is where the token minting has to be
   anyway. There is no fetcher at all: no `scripts/fetch-og.ts`, no `scripts/fetch-assets.ts`.
   The snapshot, the og images and the landing photography were gathered and verified by hand at
   Phase 0 and committed, with provenance in `content/og_attribution.json` and `LICENSES.md`.
   `contracts/types.ts` and `og_attribution.schema.json` still refer to `scripts/fetch-og` as the
   recorder of that file, which is now a forward reference rather than a description.

---

## 4. Contracts

`contracts/` is frozen. Field renames, type loosening and optionality changes require a
Deviations entry and Report disclosure. Additive optional fields are allowed only with validator
coverage, which is why `DerivedCounts.conflicts` exists and why the `seed` quarantine flag is
declared on every object-rooted artifact schema.

| Pointer | What it fixes | Read by |
|---|---|---|
| `contracts/types.ts` | Every shape in blueprint Section 6 as TypeScript. `Source`, `Value`, `Narrative` and the eight panel types, `Feed`, `UrlIndex`, `Constellation`, `Methodology`, `Corrections`, `CaseLibrary`, `OgAttribution`. | app, pipeline, scripts, tests |
| `contracts/schemas/source.schema.json` | Source registry entries, including the `^[a-z]{2}-[a-z0-9-]+$` id pattern, `liveness` and `self_reported`. | validator, runner |
| `contracts/schemas/value.schema.json` | The `Value` object: `amount`, `unit`, bilingual `display`, `source_id`, optional `as_of` and `flags`. Required list is closed and `additionalProperties` is false. | every other schema, by `$ref` |
| `contracts/schemas/narrative.schema.json` | The published artifact: panels union, narration, sparring, prediction tap, derived counts, provenance, manifest and its `Gate` block. Root is closed. | A12, validator, and the A7 and A9 slot schemas by `$ref` |
| `contracts/schemas/feed.schema.json` | `content/packs/<pack>/feed.json`. The one-hero rule and the `via_dissect` rule are validator check 10, not schema. | A13, validator, app |
| `contracts/schemas/url_index.schema.json` | Match kinds and entry roles, including exactly one `fresh_demo` (enforced in check 8, not by schema). | A13, validator, `/share` |
| `contracts/schemas/constellation.schema.json` | Nodes and links for the constellation graph. | A13, validator, research surface |
| `contracts/schemas/methodology.schema.json` | Symmetry receipt, metric entries with `kind` of `measured` or `design_target`, policy text, disclosure. | A13, validator, methodology page |
| `contracts/schemas/case_library.schema.json` | The historical episodes A8 draws from, with citations. | A8 input, validator |
| `contracts/schemas/corrections.schema.json` | The corrections log: `date`, `narrative_id`, bilingual `summary`, `status` of `under_review`, `corrected` or `dismissed`. Closed. | validator, app |
| `contracts/schemas/og_attribution.schema.json` | The link-preview render policy plus one entry per narrative; `fallback` status permits null original URL and fetch date. | validator |
| `contracts/lexicon.json` | Blueprint 6.9 as data: the EN and ID verdict word lists, the fact-check-colon phrase rule, the future-tense-harm rule with its path scope, and the scoped exemptions. | validator check 5 only; passed to A9 and A11 as slot input |
| `contracts/technique-tags.json` | Blueprint Appendix B, locked. The twelve tag keys the pipeline may assign, with bilingual labels. Keys appear in permalinks; additions need a Deviations entry, renames are forbidden. | validator check 1, renderers |
| `pipeline/agents/<role>.schema.json` | The output contract per LLM slot. A7 and A9 `$ref` into `narrative.schema.json`, so ingest validation is contract validation. | `ingestSlot` in the runner |

---

## 5. The invariants, and where each is enforced

This is the section a new engineer will otherwise break. Each invariant is enforced in more
than one place on purpose, and the places are not interchangeable.

### 5.1 No orphan numbers

**Rule.** A number renders only as the `amount` of a `Value` (or a dueling `CountEntry`) whose
`source_id` resolves in the source registry. Percentages are never authored; they are derived at
render. A bare numeric prop on a grammar component is a type error.

**Enforced at:**

- *Type level.* `contracts/types.ts` gives every renderer prop a `Value`, so a bare number does
  not compile.
- *Render.* `app/src/renderers/ctx.ts` defines `OrphanNumberError` and `resolveAll`. Every
  grammar component calls `resolveAll` at the top of its body, panel-scoped. `Card` and `Family`
  draw no `Value` of their own, so they resolve every reference in the whole narrative they are
  handed: a narrative carrying an orphan is not a renderable narrative.
- *Publication.* A12 recomputes `provenance.source_count` by walking the artifact and refuses if
  the stored value disagrees.
- *CI.* Check 2 (`orphans`) of `scripts/validate-content.ts` collects every `source_id` and
  `citations` entry in every artifact except `sources.json` itself and fails on the first that
  does not resolve.
- *Metric.* A13 counts artifacts carrying a `Value`-shaped object with an empty `source_id` into
  `orphan_numbers`. Note the ceiling honestly: `value.schema.json` rejects an empty `source_id`
  and A12 schema-validates, so an artifact that could trip this metric cannot publish, and the
  metric can only read zero.

**The failure mode this does not catch:** a figure written into prose as a bare numeral, with no
`Value` wrapper. Neither the refusal nor the validator can see it. That is how a stale
denominator survived a panel rebuild during Gate C, and it is why `A9.md` now carries the rule
that a binding which resolves is not a claim that traces.

### 5.2 The card contract

**Rule.** An original headline never renders without its technique tags and its derived counts.
This is the defused-bomb rule: the bait ships with the needle already in it, so the feed cannot
degrade into a rage aggregator with extra steps.

**Enforced at:**

- *Render.* `app/src/renderers/Card.tsx` throws `CardContractError` when `counts` is not an
  object carrying all five of `missing`, `unsourced`, `disputed`, `supported`, `hidden` as
  numbers, or when `tags` is not a non-empty array. The check is on shape, not presence: `{}` and
  `[]` are objects that never went through derivation, and a card drawn from either would show
  zero chips and look complete. All-zero counts are five real numbers and render legally with no
  chips.
- *Single path.* `Card.tsx` is the only module in the app that reads a narrative headline, and
  that is asserted by a filesystem grep in the unit suite. A surface that must quote a headline
  (the Nuance Card) calls the exported `headlineOf`. Surfaces that list headlines in a shape that
  is not a card (Archive, Dissect recents) take `CountChips` from the same module rather than
  pairing `headlineOf` with markup of their own and calling that the contract.
- *Derivation.* `counts` is derived, never authored: A12's `deriveCounts` computes it and
  refuses on disagreement, and validator check 3 recomputes it independently. Two
  implementations of the same rule is deliberate; the checker must not be the stamper, or check 3
  would be asserting a function against itself.

### 5.3 Dimensional coherence in Scale Check

**Rule.** A Scale Check derives one percentage, `segment.amount / denominator.amount`. Two
values divide into a share only when they measure the same thing, so a segment whose unit
differs from the denominator's is not a share of it.

**Enforced at:** `app/src/renderers/ScaleCheck.tsx` loops every segment before any numeral
draws and throws `UnitMismatchError` (defined in `ctx.ts` beside the other two refusals) naming
the panel, the element, and both units.

**Why it exists.** It was added after a Gate C review rendered the real published
`usaid-deficit` panel through the real renderer and read the rows out of the DOM. The panel had
a `USD_B` denominator and `percent` segments, so a 26 percent poll share rendered as "0.5%" and
"about 1 percent" rendered as "0.0%", with SVG bar widths drawn at those same wrong values, on
the one narrative whose entire subject is the 26-versus-1 misperception. Nothing caught it: the
schema constrains no relation between a denominator's unit and its segments' units, the string
`unit` appears nowhere in the validator, and no test in the repo rendered published content. The
guard was placed in the renderer rather than in a caller because `ScaleCheck` is the only module
in `app/src` that does arithmetic on a `Value.amount`, so the whole defect class routes through
one place.

**Known limit, stated in the code.** Matching the unit token is necessary and not sufficient.
Percent-of-respondents and percent-of-budget are both `percent` and are not shares of the same
thing. `pipeline/agents/prompts/A7.md` carries that rule for the author; the renderer cannot
decide it. `ppn-panic` ships a dimensionally consistent percent-over-percent panel that renders
"91.7%" beside "11 percent", which is literally the PMK 131/2024 base mechanism and asserts
nothing false, but gives the reader no cue that the share is of the 12 percent headline rate.

### 5.4 The verdict-free lexicon

**Rule.** No verdict word and no scalar quality score for a narrative or an outlet, in any
language, anywhere: content, i18n bundles, notifications, toasts, share assets, landing. The
lists in `contracts/lexicon.json` are, verbatim, EN: hoax, false, fake, true, debunked,
misleading, disinformation, lie, liar, busted. ID: hoaks, bohong, palsu, benar, salah, sesat,
menyesatkan, terbukti, dusta. One phrase rule sits beside them, `fact[\s-]?check(?:ed)?\s*:`,
narrow by construction because only the colon form delivers a verdict; prose about fact-checking
as a genre carries no colon and stays legal. The permitted output classes are edge statuses,
descriptive counts of those statuses, technique tags naming rhetorical form, and sourced facts
with identifiers.

The sibling rule is the future-tense-harm lint: Echo and case text are retrospective and cited,
so "will cause" and "akan menyebabkan" class phrasing fails, and collective action itself is
never framed as the harm. PRD 6.5 ships verbatim on the methodology page, carried as a frozen
constant in `pipeline/run.ts` and written into `methodology.json` by A13.

**Enforced at:**

- *Data.* `contracts/lexicon.json` holds the word lists, the phrase regexes, the future-harm
  path scope, the style rules (banned em dash, `\p{Extended_Pictographic}` for emoji) and the
  scoped exemptions. It is data, not code, so the rule is reviewable without reading a linter.
  There are four exemptions and each names a file, a key and a reason: `methodology.json`
  `policy_65` (the page may use these words to describe what Matterhorn does not do),
  `case_library.json` `cases.documented_outcome` (only when quoted with a citation), and
  `sources.json` `title` and `notes` (the source registry is the citation apparatus, not
  Matterhorn's voice). All four are scoped to the `verdict` rule only, and each was probed from
  both sides at Gate 1. Widening the list is not the way to fix a lint failure. One condition
  carried forward: if any surface ever renders `Source.notes`, that exemption has to be dropped
  or the rendered notes linted.
- *CI.* Check 5 (`lexicon`) of `scripts/validate-content.ts` is the only reader. Matching is
  case-insensitive and whole-word, including the Indonesian class-ID words, which is why a
  Gate 3 probe found that the whole-word rule catches "salah satu" constructions. The correct
  response is to phrase around it (`sebuah`, `dari antara`), never to weaken the lint.
- *Authoring.* The lexicon is passed as slot input to A9 and A11, so the narrator writes under
  it and the fidelity guard judges against the same file.
- *Scope, honestly.* The lint walks the content root. The app's own bilingual copy bundles are
  not linted by it; `pnpm check:landing-copy` covers the frozen landing strings against the
  blueprint, and `pnpm i18n:scan` covers key drift, but neither is a lexicon check.

The future-harm scope entry is worth one sentence of history: it originally matched only at the
head of a path, and blueprint 6.3 puts `EchoPanel` in the panel union, so the same Echo outcome
text is reachable at `echo.historical.outcome` under the root and at `panels.historical.outcome`
inside `panels[]`. Scope entries now match a run of consecutive keys wherever it sits in the
path.

### 5.5 The gate-token chain

**Rule.** No code path publishes an artifact without two verdicts reading `pass` and two tokens
that recompute against the exact bytes being written.

**The recipe**, in `pipeline/lib/canonical.ts` and nowhere else: take the artifact, replace
`manifest.gates` with null, sort object keys recursively while arrays keep their order,
`JSON.stringify` with no whitespace, sha256, hex. Three consumers share it, which is what keeps
the stamper and the checker from drifting: the runner at A10, A11 and A12, the content
validator, and the Gate 1 seed stamper. The seed tokens were stamped by a separate
implementation of the same recipe, so a drift in `canonical.ts` turns the suite red.

**The chain, step by step:**

1. A9 assembles `candidate.json`. Its `manifest.steps` is stamped now.
2. A10 stages `A10.input.json`, which embeds the candidate, and records its sha256 as that
   step's `input_hash`. The Symmetry Auditor judges. On pass the runner writes
   `gateToken(candidate)` into `A10.json`.
3. A11 does the same for the Fidelity Guard.
4. A12 recomputes `gateToken(published)` where `published` is the candidate plus
   `manifest.gates`, which the recipe nulls out. It refuses unless both stored tokens equal that
   value. Since the tokens were minted over the candidate and the only added field is nulled by
   the recipe, they are equal exactly when nothing else changed.
5. Validator check 6 (`manifest`) recomputes the same token over every artifact in `content/`
   and fails CI if either gate token disagrees. So a post-publication edit to any byte of a
   shipped artifact is detectable without re-running the pipeline.

**A block blocks the bytes it judged.** `blocked/` is the run's permanent ledger, so a narrative
that was sent back, fixed and re-judged carries its earlier block records forever. Treating
every record as live would mean no narrative could ever recover from a block, which is not what
"a block is not appealable" means. It means you may not publish the same bytes a gate refused.
A12 therefore compares each record's `candidate_sha256` against the sha256 of the candidate on
the table: equal is live and refuses with

```
REFUSED A12 <id>: a gate blocked these exact bytes (<files>) and a block is not appealable by publishing
```

and different is superseded, named in the log rather than skipped silently. A record carrying no
hash cannot be matched either way and is treated as superseded. Nothing is weakened by that,
because A12 independently requires both verdicts to read `pass` and both tokens to verify.

This behaviour was proven by control experiment during Gate C, not assumed: a block record was
written carrying the current candidate's sha256 (refusal), then removed (published). The first
attempt at that control was malformed, with a filename that did not match the narrative prefix
so the record was never read, and catching that is the reason the control was re-run rather than
trusted.

**One trap that follows from the chain.** The candidate bytes embed `manifest.steps`, which
carries per-slot timestamps, and re-ingesting any of A5 to A9 rewrites `finished_at`. So any
re-ingest between staging a gate input and minting the token drifts the candidate bytes and
voids the staged input the judges actually read. The operating rule is in RUNBOOK Section 3.

---

## 6. Dependencies, and why each one is here

`package.json` pins exact versions with no ranges, the lockfile is committed, and
`pnpm.onlyBuiltDependencies` is `["esbuild"]`, so no other package runs an install script.
Node 22 or newer, pnpm 10.33.2.

### Runtime dependencies

Five packages. Four ship in every bundle; `gsap` ships only in a chunk that one code path
fetches.

| Package | Why it is here | Alternative considered |
|---|---|---|
| `react` 19.2.8 | The UI framework the approved design source is written against (ADR-3). That source is an external input, not committed here; the renderers port its DOM structure and class vocabulary while consuming contract types. | None. This is a locked stack decision. |
| `react-dom` 19.2.8 | The DOM renderer for the above. | None. |
| `react-router` 8.3.0 | Seven real routes with distinct documents: `/`, `/app`, `/n/:id`, `/methodology`, `/share`, `/offline`, 404. Two of them (`/n/:id`, `/share`) are entry points into the product from outside, so they cannot be client state. It also carries the lazy route splitting the per-route JS budget depends on. | Hand-rolled `history` matching. Rejected: the code splitting and the nested-route mounting would be reimplemented, not avoided. |
| `html-to-image` 1.11.13 | The Nuance Card exports a PNG (Story 1080x1350 and Chat 1200x628) from a styled DOM template, with no server to rasterize it (ADR-9). Used only in `app/src/app/Nuance.tsx`. | Canvas re-implementation of the same template, which is the documented fallback path and duplicates the layout. |
| `gsap` 3.15.0 | The landing's scroll choreography on engines without native scroll-driven animations, which today means Firefox (ADR-7). Used only in `app/src/landing/motion.ts`, imported dynamically and only on its own path, so a browser that has `animation-timeline: view()` never fetches the chunk. The reduced-motion path imports nothing at all, so there is no animation to switch off rather than one that is overridden. | Only the CSS path, which would leave Firefox with no scrubbing at all. |

Deliberately absent: no chart library (the claim map and constellation are hand-rolled SVG so no
chart look leaks into the design), no CSS framework (the design source is a bespoke token
system that ports cleaner as plain CSS custom properties), no state library, no HTTP client
(`fetch` is fine), no i18n library (the bundles are two flat JSON files and one `t` function),
and no font package (both surfaces use the system stack, so the self-hosted font payload is
zero bytes and `check:build` says so in those words rather than printing a pass that reads like
a subsetted font was measured).

### Build and development dependencies

| Package | Why it is here |
|---|---|
| `vite` 8.1.5 | The bundler and dev server. Locked stack. |
| `@vitejs/plugin-react` 6.0.4 | React fast refresh and the JSX transform in `app/vite.config.ts`. Not used by the vitest config, which reads `jsx: react-jsx` from `tsconfig.json` through esbuild directly. |
| `vite-plugin-pwa` 1.3.0 | `injectManifest` strategy for `app/src/sw.ts` plus the frozen 6.7 web manifest, including the Android share target. Present only when building; absent while serving, so the e2e suite has no worker in the way. |
| `typescript` 6.0.3 | Strict everywhere, with `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters` and `noFallthroughCasesInSwitch` on. `pnpm typecheck` covers app, pipeline, scripts, contracts and tests from one config. |
| `tsx` 4.23.1 | Runs the TypeScript CLIs directly: the pipeline runner, the validator, the permalink and SEO emitters, the i18n scan, the landing copy check. Avoids a build step for tools that exist to check the build. |
| `eslint` 10.8.0, `typescript-eslint` 8.65.0 | Flat config, recommended set only. The project-specific rules (lexicon, future-harm, em dash, emoji) are not ESLint rules; they live in the content validator, because they police data as well as code. |
| `ajv` 8.20.0 | Draft 2020-12 JSON Schema validation, in both the runner and the validator, in strict mode with `allErrors`. This is what makes slot ingest a real gate and what A12 validates the published artifact against. |
| `vitest` 4.1.10 | Unit and component tests. Two configs: the root one excludes `tests/e2e`, `tests/pipeline` and `staging`, and `tests/pipeline/vitest.config.ts` runs the pipeline specs from the repo root so they can spawn the runner and the validator the way CI does. |
| `jsdom` 30.0.0 | The DOM for renderer specs, selected per file with a `@vitest-environment jsdom` docblock rather than globally. |
| `@testing-library/react` 16.3.2, `@testing-library/jest-dom` 7.0.0 | Rendering and asserting on the grammar components, including the three refusals, which are tested by rendering and catching. |
| `@playwright/test` 1.62.0 | The e2e suites: the state matrix, flows, grammar, landing, research, wide viewport, and the preview-backed offline trio that needs a real build and a real service worker. |
| `@axe-core/playwright` 4.12.1 | Installed for the accessibility gate (locked stack, blueprint 5.2). Nothing in the repo imports it yet; a grep for `axe` and `AxeBuilder` across all source, config and workflow files finds only the `package.json` line. |
| `@lhci/cli` 0.15.1 | Installed for the Lighthouse budget gate (AC-PERF-1). As with axe, nothing references it yet and there is no `lighthouserc` in the repo. |
| `@huggingface/transformers` 4.2.0 | Stage A3's local embeddings (`Xenova/multilingual-e5-small`, ADR-6). Build time only, never bundled to clients, weights cached outside the repo. It is a devDependency for exactly that reason. |
| `sharp` 0.35.3 | `scripts/gen-icons.mjs` rasterizes the four PWA icons from an inline SVG wordmark. Output is committed under `app/public/icons`, so a build never depends on this having run. Added at Phase 0 after the platform `sips` quality flag proved unreliable for the asset conversion pass. |
| `@types/node` 26.1.2, `@types/react` 19.2.17, `@types/react-dom` 19.2.3 | Type definitions for the above. |

---

## 7. Known structural gaps

Recorded here so nobody rediscovers them as surprises. `.crown/notes.md` is the running build
log and carries each in full, including the reasoning and the control experiments.

- A3's clustering quality is measured and poor (Section 3.5 item 1). The eval publishes the real
  recall on every run rather than burying it in a threshold.
- The published `manifest.steps` covers A5 to A9 only, because it is stamped at A9 and signed by
  the gate tokens. The gate models are in the committed run log. The provenance sheet is titled
  "The authoring chain" for that reason, and the two gate verdicts and tokens render from
  `manifest.gates`, which the artifact does carry.
- The five gate-block records in `pipeline/runs/run-2026-07-29/blocked/` are post-hoc
  reconstructions, each flagged `reconstructed: true` with the reason: the orchestrator read the
  verdicts from the judging workflow's output and dispatched fixes directly, so the runner never
  ingested them. Republishing all four affected narratives from a copy of the run directory with
  `blocked/` removed reproduces the shipped files byte for byte, so the rest of the log replays.
- One AC-PIPE-7 deviation: `judol-turnover`'s A10 ran on `claude-opus-5[1m]` rather than the
  mandatory Fable 5, after a mid-run quota exhaustion. Exactly one narrative, one role, recorded
  in the run log rather than claimed clean.
- The published symmetry receipt is 6 gov, 1 neutral, 3 opp. That is a property of the fixed
  demo set in blueprint 7.1, not of the method, and the methodology page reports it as measured
  rather than balancing it.
- Nothing in the build stages `content/` or `public/assets/` into `app/dist` (Section 1.3).
  Three e2e configs carry the copy line themselves and say so in a comment.
