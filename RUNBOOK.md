# RUNBOOK

Five operator procedures. Read `ARCHITECTURE.md` first if you have not: this document assumes
you know what a run directory is, what a gate token is, and which stages write into `content/`.

Everything here is run from the repository root.

---

## 0. Setup, once

```sh
node --version          # 22 or newer, per package.json engines
corepack enable         # package manager is pinned to pnpm@10.33.2
pnpm install --frozen-lockfile
```

The only network dependency past install is stage A3, which downloads roughly 120 MB of
embedding weights on its first run into `$HF_HOME/transformers`, or
`~/.cache/huggingface/transformers` if `HF_HOME` is unset. Nothing model-shaped is ever written
inside the repo. Every run after the first is offline.

There are no secrets and no `.env`. Nothing in this repository reads an API key; the `api`
executor in `pipeline/config.ts` is typed and `assertWired` throws on it.

The checks you will use throughout:

```sh
pnpm lint                 # eslint, flat config
pnpm typecheck            # tsc --noEmit over app, pipeline, scripts, contracts, tests
pnpm test:unit            # vitest, unit and component
pnpm test:pipeline        # vitest, pipeline specs and evals
pnpm validate:content     # blueprint 6.11 checks over content/, the size budgets, the app import scan
pnpm build                # vite build app, then the permalink shells, then the build budgets
pnpm i18n:scan            # key drift between en.json and id.json, missing keys, dead keys
pnpm check:landing-copy   # frozen landing strings against the blueprint text
pnpm check:licenses       # every shipped asset file has a row in LICENSES.md
pnpm check:build          # font, per-asset and precache budgets, on app/dist
pnpm audit                # pnpm audit --audit-level high
```

The e2e suites are split across five Playwright configs and each has its own alias.
`pnpm test:e2e` runs only the first of them:

```sh
pnpm test:e2e            # Gate 2 grammar screenshots, the only suite that reads the seed root
pnpm test:e2e:app        # state matrix, flows, wide viewport
pnpm test:e2e:offline    # the offline trio, on a real build with the real service worker
pnpm test:e2e:landing
pnpm test:e2e:research
```

`.github/workflows/ci.yml` has two jobs and no `continue-on-error` anywhere. `verify` runs
`lint`, `typecheck`, `test:unit`, `test:pipeline`, `validate:content`, `check:licenses`, `build`
(which ends in `check:build`), the dependency audit, and a gitleaks secret scan over the full
history, which is why its checkout uses `fetch-depth: 0`. `e2e` runs all five Playwright configs
with `--ignore-snapshots`, because the committed screenshot baselines are `-darwin` and a Linux
runner has none to compare against; the pixel comparison stays a local gate on macOS, and
everything else in those specs is asserted in CI.

`check:landing-copy` and `i18n:scan` are not in CI. Run them by hand when you touch landing copy
or the i18n bundles.

---

## 1. Add a narrative

A narrative enters through the snapshot registry and leaves through the publisher. You author
facts; the fleet authors analysis. Never hand-edit a file under `content/narratives/`: it
carries two gate tokens over its own bytes and a hand edit makes both fail, which validator
check 6 will tell you about in CI.

### 1.1 Register the sources first

Every number the fleet may mint has to already exist in `content/sources.json`. Stage A7 is
given that file as its input and is constrained to it. If a figure is not in the registry, A7
has three honest moves and no fourth: use a different registered number that says something true
about the same question, render the element as a label naming what is missing, or drop it into
`dropped` with a reason.

Add one entry per source document:

```json
{
  "id": "id-kemenkeu-apbn2026-enacted",
  "title": "<the document's own title>",
  "publisher": "Kemenkeu",
  "url": "<canonical URL, full slug>",
  "retrieved_at": "2026-07-28",
  "period": "APBN 2026, enacted",
  "kind": "official",
  "self_reported": false,
  "liveness": "live"
}
```

Rules the validator enforces or the reviewers will:

- `id` must match `^[a-z]{2}-[a-z0-9-]+$`, prefixed by the country or region the source belongs
  to.
- `period` is what the figure covers, not when you fetched it. This is what stops a 2025 count
  being read against a 2026 population.
- `self_reported` is `true` for an institution reporting about itself.
- `liveness` has three states and check 9 reads recorded fields only, never the network.
  `unverified` and `dead_replaced` both require a `notes` string, one recording what could not
  be confirmed and the other the replacement. Separately, if `notes` records an HTTP status of
  400 or above, the note must also carry corroboration language (`corroborat...`,
  `verified live`, `manual check`) or the check fails. That is the path for anti-bot sources: a
  403, or a 200 that is really a challenge page, ships as `live` with the note documenting how
  the figure was corroborated by hand.
- Store full-slug canonical URLs. Every "dead" Indonesian URL found at Phase 0 turned out to be
  a truncated bare-id form that 404s while the full slug is alive.

### 1.2 Add the work order entry

Append to `narratives` in `pipeline/snapshot/registry.json`:

```json
{
  "id": "<slug>",
  "pack": "id",
  "lean": "gov",
  "skeleton": "<one sentence naming the structural motif this family shares>",
  "original": { "text": "<the claim as published, verbatim>", "lang": "id" },
  "headline": { "en": "<display headline>", "id": "<display headline>" },
  "outlet": "<outlet>",
  "published_date": "2026-06-20",
  "url": "<canonical article URL>",
  "tags": ["missing-link", "hidden-stakeholder"],
  "scaffold_default": "S3",
  "panels": ["claim_map", "scale_check", "family"],
  "og": { "image_path": null, "fetched_at": null, "attribution": "<why>", "fallback": true },
  "members": [
    {
      "id": "<slug>-m1",
      "lang": "id",
      "headline": "<verbatim article title>",
      "outlet": "<outlet>",
      "date": "2026-06-20",
      "url": "<full-slug canonical>"
    }
  ]
}
```

Field notes that matter:

- `tags` must be keys from `contracts/technique-tags.json`. The list is locked; adding a key
  needs a Deviations entry and renaming one is forbidden, because keys appear in permalinks.
- `panels` is the panel plan A5 and A7 are handed. `claim_map` comes first. Listing `family`
  makes the runner synthesise a `<slug>-p-family` marker panel if A7 does not emit one.
- `status` is optional and defaults to `published`. Set it to `under_review` only if the
  artifact itself should carry that state; see Section 5 for the ordinary correction path, which
  does not touch the registry.
- A member headline that nobody recorded verbatim must carry `"reconstructed": true` and a
  `note`. The runner passes both flags through to the slots. Printing a description of a claim
  as though it were a quoted title is precisely the fault this product exists to catch.
- The display `headline` may not add, drop or soften anything `original.text` asserts. A10
  blocked `judol-turnover` twice for exactly this: a display headline in the artifact's own
  voice that added a direction and dropped an attribution.

### 1.3 Run the fleet for it

Follow Section 3. The per-narrative stages are A5 to A12; A1 to A4 are run once for the whole
run and A13 once at the end.

### 1.4 Verify

```sh
pnpm validate:content
pnpm build:content-review --dir content --run pipeline/runs/<run_id>
```

The first must print an `OK:` line naming the checks it passed. The second regenerates
`content-review.md`, the operator's editorial approval sheet: every sparring question with its
correct answer and note, every lean assignment, every status, plus the A9 slots'
`editorial_notes` and the gate reasons. It is read from the published artifacts and the run log,
never hand-maintained, because the reviewer must be approving what shipped rather than a copy
of it.

---

## 2. Add a pack

A pack is a contract-level identifier, not a directory you can create. `contracts/types.ts` and
`contracts/schemas/feed.schema.json` both fix `pack` to the enum `"id" | "en"`, and
`constellation.schema.json` repeats it on every node. Widening that enum is a contract change,
so blueprint Section 6 requires a Deviations entry and Report disclosure. Do not widen it
casually.

The work, in order:

1. **Contracts.** Add the identifier to the `pack` enum in `contracts/types.ts` (three places:
   `Narrative`, `Feed`, `Constellation.nodes`), `contracts/schemas/feed.schema.json`, and any
   other schema that enumerates it. Record the Deviations entry.
2. **App plumbing.** `PACKS` in `app/src/content.ts` is the list the Archive reads at once. The
   region rows are in `REGIONS` in `app/src/app/Radar.tsx`, where each row maps a region id to a
   pack or to `null` (a `null` pack row renders the "rolls out gradually" pattern the design
   established, which is the honest way to show a region with no pack behind it).
3. **Copy.** Add `pack.<id>` and the `regions.<id>` / `regions.<id>.sub` keys to both
   `app/src/i18n/en.json` and `app/src/i18n/id.json`. `pnpm i18n:scan` fails on a key present in
   one bundle and not the other, on a `t()` call naming a key no bundle declares, and on a
   declared key no module names.
4. **Content.** Register the pack's sources (Section 1.1), then add registry entries with the
   new `pack` value (Section 1.2), then run the fleet (Section 3). Stage A13 derives the pack
   list from the narratives that actually published, so it creates `content/packs/<pack>/feed.json`
   on its own. Do not hand-write a feed.
5. **Verify.** `pnpm validate:content` check 10 requires exactly one hero item per pack feed and
   requires every feed item to resolve to a published narrative. `pnpm typecheck` will find any
   `Record<Pack, ...>` table you missed, because the enum widening makes those exhaustive
   mappings incomplete.

If the goal is only a new locale rather than a new pack, that is a different job: ADR-11 makes
locales a key system (`i18n/en.json`, `i18n/id.json`) with narration and sparring carried
per-language inside each artifact, so adding a locale is authorship plus a bundle, not a
contract change.

---

## 3. Re-run the pipeline

This is the procedure with the non-obvious mechanics. Read all of it before starting one.

### 3.1 What the runner does and does not do

Under the shipping executor (`{ kind: 'claude-code' }`) the runner never calls a model. For an
LLM slot it does two separable things:

- **Stage the input.** Writes `slots/<narrative>/<role>.input.json`, exactly the input that slot
  is given, and records a `steps.json` row with the requested model and the sha256 of that file.
- **Ingest the output.** If `slots/<narrative>/<role>.json` exists, validates it against
  `pipeline/agents/<role>.schema.json` and ingests it.

**That schema validation is the gate on slot output.** It is not a formality: `A7.schema.json`
declares `panels` as `$ref: "narrative.schema.json#/properties/panels"` and `A9.schema.json`
refs `narration`, `sparring` and `prediction_tap` the same way, so a slot is validated against
the shipping contract itself. A panel that could not ship cannot be ingested. When ingest
refuses, you have a bad slot output, not a bad runner: re-dispatch that slot with the refusal
text, do not edit the JSON to make it pass.

The seven slots are filled by subagents. The operator's job is to hand each subagent
`<role>.input.json` and its prompt from `pipeline/agents/prompts/<role>.md`, then write the
structured result to `<role>.json` and run the stage again to ingest it.

### 3.2 The deterministic prologue

```sh
RUN=pipeline/runs/run-$(date +%Y-%m-%d)
pnpm pipeline stage A1 --run "$RUN"
pnpm pipeline stage A2 --run "$RUN"
pnpm pipeline stage A3 --run "$RUN"     # first invocation downloads the embedding weights
pnpm pipeline stage A4 --run "$RUN"
```

A1 writes `run.json` if it is absent, and `generated_at` is stamped there once. Everything
downstream reads that timestamp rather than a clock, which is what makes two runs over the same
run directory byte-identical. If you want a fresh timestamp, use a fresh run directory.

A4 prints how many work-order families it handed to narrative slots. That number, not A3's
cluster count, is what the run will publish.

### 3.3 The authoring slots, per narrative

For each narrative, in order, A5 then A6 then A7 then A8 then A9:

```sh
N=mbg-stop
pnpm pipeline stage A5 --run "$RUN" --narrative "$N" --out content
#   -> writes slots/mbg-stop/A5.input.json, prints "awaiting the slot output"
#   -> dispatch the A5 subagent, write its result to slots/mbg-stop/A5.json
pnpm pipeline stage A5 --run "$RUN" --narrative "$N" --out content
#   -> "slot output validated against A5.schema.json and ingested"
```

Two flags worth understanding:

- `--out content` on the authoring stages is not about writing content. It selects which source
  registry and case library the grounding slots are constrained to: `<out>/sources.json` and
  `<out>/case_library.json`, falling back to the repo's `content/` when `--out` is absent. Point
  it at a scratch root and A7 will be grounded against that root's registry.
- `--narrative` is required for A5 to A12.

Ingesting A9 assembles `slots/<narrative>/candidate.json`. The runner prints the panel count.
Check it against your registry panel plan before you go near a gate.

Two normalisations happen automatically at that point, and they are the two faults a Gate C
pre-flight caught: the echo never rides inside `panels[]` (A8 owns it, and the contract carries
it at the artifact root), and a `family` marker panel is synthesised when the registry lists
`family` and A7 did not emit one. Both the A9 input and the candidate go through the same
helper, so the narrator's binding universe equals the shipping panel set.

### 3.4 The gates, and the rule that governs the whole run

```sh
pnpm pipeline stage A10 --run "$RUN" --narrative "$N" --out content
#   -> writes slots/mbg-stop/A10.input.json, which EMBEDS THE CANDIDATE
#   -> dispatch the Symmetry Auditor, write its verdict to slots/mbg-stop/A10.json
pnpm pipeline stage A10 --run "$RUN" --narrative "$N" --out content
#   -> on pass: "pass on the symmetry gate, token <first 12 hex> minted over the candidate"
#   -> on block: writes blocked/mbg-stop-A10-1.json and prints the reasons
```

Same shape for A11. The slot returns only `verdict` and `reasons`. The runner mints the token,
because a sha256 over the candidate is not something a language model can compute.

One wrinkle when hunting the file: the block log line names
`blocked/<narrative>-<role>.json` while the file on disk carries a counter suffix,
`blocked/<narrative>-<role>-1.json`, because a second block on the same narrative and role must
not overwrite the first.

**THE RULE.** Per narrative: ingest A5 to A9 exactly once, stage the gate inputs, dispatch both
judges, ingest both verdicts, publish. **Any re-ingest of A5 to A9 between staging a gate input
and minting the token voids that input.**

Why: `candidate.json` embeds `manifest.steps`, which carries per-slot timestamps, and ingesting
a slot output rewrites that slot's `finished_at`. So re-running `pipeline stage A9` on an
already-staged output changes the candidate bytes even when not one word of narration changed.
The judges then read one set of bytes and the token is minted over another. This was found the
hard way during the flagship shakedown: a candidate hash drifted from `df7b...` to `ff9b...`
solely because A9 was re-ingested, and the judged bytes had to be restored from the staged gate
input and hash-verified.

The related rule: **do not re-run any of A5 to A9 after the gates have run at all.** The
candidate's `manifest.steps` is filtered to steps with a `finished_at`, so a re-assembly after
judging would pull the A10 and A11 rows into the signed region, which is not where they belong.

Pin the hash. `slots/<narrative>/steps.json` records each staged input's sha256 as `input_hash`.
Quote the gate input's hash in the dispatch brief so the judge's report names the bytes it read,
and so a later audit can prove which bytes were judged.

### 3.5 When a gate blocks

A block is not appealable by publishing. The only exit is to fix the artifact and re-judge.

1. Read `blocked/<narrative>-<role>-<n>.json`. The reasons are verbatim and name the sentence,
   the element or the asymmetry.
2. Re-dispatch the narrow slot that owns the fault. A fidelity block on one sentence is an A9
   re-dispatch scoped to that sentence, not a full re-run. A symmetry block on a display headline
   is a registry correction.
3. Re-ingest that slot. The candidate is re-assembled and its bytes change, which is correct:
   these are new bytes and the old block no longer applies to them.
4. Re-run **both** gates over the new candidate. Not just the one that blocked. The two gates
   have provably distinct lenses: during Gate C, A11 explicitly weighed a clause and cleared it
   under a traceability lens while A10 blocked the same clause under a symmetry lens, and both
   were right about their own question.
5. Publish.

The block ledger is permanent. A narrative sent back twice carries two records forever, and A13
counts them into the `gate_blocks` metric. A12 treats a record as live only when its
`candidate_sha256` equals the sha256 of the candidate now on the table; records on earlier bytes
are superseded and named in the log. So a fixed narrative publishes, and the same bytes a gate
refused never do.

### 3.6 Publish and aggregate

```sh
pnpm pipeline stage A12 --run "$RUN" --narrative "$N" --out content
# ... once per narrative ...
pnpm pipeline stage A13 --run "$RUN" --out content
```

A12 refuses, with a `REFUSED` line and exit 1, on any of: no candidate; a live block record; a
missing verdict file; a verdict that is not `pass`; a verdict with no token; a schema failure
against `narrative.schema.json`; a stored `counts` key or `provenance.source_count` disagreeing
with its own recomputation; either token failing to verify against the bytes about to be
written. Read the message: it names which one.

If A12 tells you a token does not verify, the artifact changed after the gates judged it. Do
not re-mint. Work out what changed, then re-judge.

A13 rewrites `url_index.json`, `constellation.json`, every `packs/<pack>/feed.json` and
`methodology.json` from the narratives actually present in the content root. It refuses if the
content root holds no published narrative, or if `run.json` names a fresh demo that did not
publish.

### 3.7 Close the run

```sh
pnpm validate:content
pnpm test:pipeline
pnpm test:unit
pnpm build:content-review --dir content --run "$RUN"
```

Commit the whole run directory. `pipeline/runs/<run_id>/` is evidence, and A13's metrics, the
provenance sheet and the model-tier audit all read from it.

### 3.8 Dry runs

Every stage takes `--out`, so a rehearsal never touches `content/`:

```sh
pnpm pipeline stage A12 --run "$RUN" --narrative "$N" --out /tmp/dry-root
pnpm pipeline stage A13 --run "$RUN" --out /tmp/dry-root
pnpm validate:content --dir /tmp/dry-root
```

Copy `sources.json` and `case_library.json` into the scratch root first if you want the
grounding slots pointed there too.

---

## 4. Re-fetch assets

**There is no fetcher script.** Blueprint 5.5 names `scripts/fetch-og.ts` and
`scripts/fetch-assets.ts` and neither exists; `pipeline/fetchers/` does not exist either. The og
images and the landing photography were gathered, converted and verified by hand during the
Phase 0 snapshot and committed. `contracts/types.ts` and `og_attribution.schema.json` still
mention `scripts/fetch-og` as the recorder of that file, which is a forward reference rather
than a description of anything that runs.

So this procedure is manual, and the discipline is in the recording.

### 4.1 Link preview images

Live under `public/assets/og/<narrative-id>.jpg`. Policy, stated at the top of
`content/og_attribution.json`: og images render only as attributed link previews carrying the
outlet name and an outbound link. They were fetched with a desktop browser user agent, converted
to JPEG, and capped at 1200px wide.

To refresh one:

1. Fetch the article's `og:image`, convert to JPEG, cap the width at 1200px, and write it to
   `public/assets/og/<id>.jpg`.
2. Update the matching entry in `content/og_attribution.json`: `image_url_original`, `outlet`,
   `fetched_at`, `status` (`fetched` or `fallback`).
3. Update the `og` block in `pipeline/snapshot/registry.json` for that narrative:
   `image_path`, `fetched_at`, `attribution`, `fallback`.
4. Re-run A5 through A12 for that narrative. The `og` block is copied from the registry into the
   candidate at assembly, so it sits inside the signed region: changing it changes the artifact
   bytes and therefore requires new gate tokens. There is no path that edits a published
   artifact's og block in place.

If the fetch fails, record the failure rather than working around it. Two narratives ship on
styled placeholders today and both say why in their own `attribution` string:
`migrant-crime` (cato.org serves an anti-bot challenge page with no og metadata to automated
clients) and `usaid-deaths` (thelancet.com returns 403 to automated clients). Set
`image_path: null`, `fetched_at: null`, `fallback: true`, write the reason into `attribution`,
and list the gap in the Report.

### 4.2 Landing photography and textures

Live under `public/assets/land/`. Every file needs a row in `LICENSES.md`, and
`pnpm check:licenses` fails when a shipped file has none or when an asset directory itself is
undocumented. It answers "is every shipped file accounted for", not "is this the right license":
the second question is an editorial judgement a script cannot make. When adding or replacing a
file:

1. Record the source page URL, the author string copied verbatim from the file page, the license
   with its URL, whether attribution is required, and a change note if the license requires one
   (all of these files were resized and recompressed, so most rows carry one).
2. Respect scope. The CC BY-SA files in the set are distributed under share-alike and are used
   standalone only, never composited into a branded lockup. The one plain CC BY photo is the
   only one safe for composites.
3. Keep each file at or under 300 KB. `pnpm check:build` asserts that on the emitted build, and
   every current file meets it (the largest is 290 KB).
4. Do not put an unhashed file under an `assets/` path in the build. `vercel.json` serves
   `/assets/*` with `max-age=31536000, immutable`, which is a promise that the bytes behind a URL
   never change, and `check:build` refuses a file there whose name carries no content hash.

### 4.3 PWA icons

Generated rather than fetched:

```sh
pnpm icons
```

`scripts/gen-icons.mjs` rasterizes four PNGs from an inline SVG wordmark with `sharp`, into
`app/public/icons`. The output is committed, so a build never depends on this having run. The
four files are exactly what the frozen manifest in `app/vite.config.ts` declares: 192 and 512,
each in an `any` and a `maskable` cut.

### 4.4 After any asset change

```sh
pnpm validate:content
pnpm build
```

Then confirm by eye that the shipped `og:image` in `app/dist/n/<id>/index.html` points where you
expect. `scripts/build-permalinks.ts` falls back to `/icons/icon-512.png` when a narrative's
`og.image_path` is null, so a broken fetch degrades to the site icon rather than to a dead link.

---

## 5. Publish a correction

A correction is a content change plus a log entry. Both halves are required: the log without the
fix is theatre, and the fix without the log is a silent edit.

### 5.1 How a flag reaches you

There is no backend (ADR-12). The in-app flag form (`app/src/app/Autopsy.tsx`) collects a reason
from four options and, on submit, appends the narrative id to `state.flags`, which persists in
`localStorage` under `mth:flags`. That drives an "Under review" chip on that device and nothing
else. The received sheet states the real policy: an under-review chip within 24 hours, and
corrections published with the same prominence as the original on a public changelog. Nothing
is transmitted anywhere, and the copy does not claim otherwise. Real reports arrive by whatever
channel the deployment advertises, and land on an operator.

### 5.2 Open the entry

Append to `entries` in `content/corrections.json`:

```json
{
  "date": "2026-07-29",
  "narrative_id": "mbg-jobs",
  "summary": {
    "en": "<what is under review, in the product's register: calm, specific, no verdict>",
    "id": "<the same, written in Indonesian>"
  },
  "status": "under_review"
}
```

The schema is closed: `date`, `narrative_id`, `summary` with both locales, and `status` from
`under_review`, `corrected` or `dismissed`. No other keys.

Write the summary under the same lexicon the content obeys. Validator check 5 lints this file
like every other artifact, so a summary saying an entry is false will fail the build. Say what
rests on what: the live example on `mbg-jobs` reads "the workforce series in this dissection
rests on figures the program's own agency reports about itself, and the presentation is under
review pending independent corroboration. The dissection stays published while the review runs."

### 5.3 What a reader sees

Three surfaces read `corrections.json` directly. No pipeline stage is involved, so an
`under_review` entry reaches readers on the next deploy without regenerating anything.

- **Radar**, `app/src/app/Radar.tsx`: entries with `status: "under_review"` populate the open
  corrections strip under the feed header (kicker, one row per entry with its date and summary,
  and a footer stating the policy). Any card whose narrative id appears in an open entry, or
  which this device flagged locally, gets an "Under review" chip in its meta row.
- **Methodology**, `app/src/app/Methodology.tsx`: every entry, whatever its status, renders in
  the changelog with a status dot and label. `under_review` shows the `disputed` dot, `corrected`
  the `supported` dot, `dismissed` a muted one. This body is rendered by both the public
  `/methodology` route and the in-app screen, deliberately from one component: a reader who taps
  the symmetry line and a reader handed the URL must be able to check the same claim against the
  same numbers.
- **Settings**, `app/src/app/Settings.tsx`: the open count.

A second mechanism exists and is separate. `Narrative.status` is a field on the artifact itself,
set from the registry at assembly (defaulting to `published`), and `Card.tsx` renders its own
review chip from it. Every narrative currently ships `published`, and the under-review
demonstration rides entirely on `corrections.json`. Use `Narrative.status` only when the
artifact's own state should change; it costs a full re-run because it is inside the signed
region.

### 5.4 Fix the content

Work out which layer is wrong and fix it there.

- **A wrong source figure, a wrong period label, a dead URL, a missing `self_reported` flag.**
  Fix `content/sources.json`. If the number itself is wrong, re-run A7 onward for every
  narrative that cites it: a panel is grounded against the registry as it stood.
- **A wrong panel, a wrong edge status, a bad denominator.** Re-run A5 to A12 for that narrative
  per Section 3. Both gates re-judge the new bytes.
- **A wrong sentence, a wrong sparring answer.** Scoped A9 re-dispatch, re-assemble, re-run both
  gates, republish.
- **A wrong display headline or lean.** Correct `pipeline/snapshot/registry.json`, then re-run
  from A5. Those fields are copied from the registry into the candidate.

Never hand-edit a file under `content/narratives/`. Its two gate tokens are computed over its
own bytes, so any edit makes both fail. That is the mechanism working, not an obstacle: the
tokens exist so a post-publication edit is detectable.

One trap that has already cost a round: a binding that resolves is not a claim that traces.
After a panel was rebuilt during Gate C the element ids were unchanged, so the narration's
bindings still resolved, and the narration went on naming the discarded denominator in both
locales while the sparring answer still marked the old figure correct. A reader who read the
rebuilt panel correctly would have been told they were wrong. If a panel's numbers changed, the
narration and the sparring that reference it are stale until a slot re-writes them, whatever the
bindings say.

### 5.5 Close the entry

Once the fix is published, change that entry's `status` to `corrected` and rewrite `summary` to
state what changed, in both locales. Do not delete the entry and do not edit its date: the
changelog is the receipt, and an entry that disappears once it is resolved is not a public
correction log. Use `dismissed`, with a summary saying why, when a flag is examined and the
content is right.

### 5.6 Verify and ship

```sh
pnpm validate:content       # schema, orphans, counts, narration, lexicon, gate tokens, and the rest
pnpm test:unit
pnpm build
```

If any narrative was regenerated, also regenerate the approval sheet:

```sh
pnpm build:content-review --dir content --run pipeline/runs/<run_id>
```

Then deploy. Nothing about the bundle has to change: the app fetches `corrections.json` and each
narrative over the network and imports neither, so an edited artifact is live as soon as it is
served. `vercel.json` serves `/content/*` with `Cache-Control: public, max-age=0,
must-revalidate`, so an ordinary browser revalidates on the next request.

One honest caveat about the last hop. `app/src/sw.ts` serves `/content/*.json` under
stale-while-revalidate: an installed reader who has been to the site before gets the cached
artifact immediately and the refreshed copy lands in the cache behind it. So the correction is
one view late for that reader, not instant. That is the right trade for a product that has to
work offline, but do not tell anyone a correction is visible the second it deploys, because for
a returning installed reader it is visible the second time they look.
