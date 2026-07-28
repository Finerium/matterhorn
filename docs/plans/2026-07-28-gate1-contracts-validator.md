# Gate 1 plan: contracts and validator

Blueprint 9.2 Gate 1: Section 6 types plus JSON Schemas emitted; `validate:content`
implements all ten checks of 6.11 with unit tests including negative cases; lexicon and
future-tense lints working in both languages. AC targets wired now: AC-INV-3, 4, 5 (and
the validator halves of 1, 6, 7, 8, 9).

## Worker sequence (TDD at gate level, worker separation per mission 9.4)

1. **Test author** (does not implement the validator): writes the full unit-test suite and
   every positive/negative fixture from the blueprint 6.11 spec text plus this plan,
   delivering to `staging/tests/` and `staging/fixtures/` (workers cannot write `tests/`).
   Orchestrator installs to `tests/unit/validator/` and `tests/fixtures/validator/`,
   runs the suite, confirms RED (checks 2..10 unimplemented).
2. **Implementer** (does not touch tests): extends contracts and the validator until the
   installed suite is GREEN, never editing a test or fixture. Disagreements with a test
   are reported, not paved over.
3. Fresh reviewer re-runs everything and verdicts the gate.

## File map

- `contracts/types.ts`: full Section 6 set, frozen shapes verbatim: `Lang`, `PanelType`,
  `Narrative`, `SparringQuestion`, `ClaimMapPanel`, `ScaleCheckPanel`, `MoneyFlowPanel`,
  `IncidencePanel`, `CountEntry`, `DuelingPanel`, `EchoPanel`, `OptionsPanel`,
  `FamilyPanel`, `DerivedCounts` (plus optional `conflicts` per CF-1, validator-covered),
  `Feed`, `UrlIndex`, `CaseLibrary`, `Constellation`, `Methodology`, `Corrections`,
  `GenerationManifest`.
- `contracts/schemas/`: one JSON Schema per artifact file kind: `narrative.schema.json`,
  `feed.schema.json`, `url_index.schema.json`, `case_library.schema.json`,
  `constellation.schema.json`, `methodology.schema.json`, `corrections.schema.json`
  (sources and value exist). Filename-to-schema map: `narratives/*.json` to narrative,
  `packs/*/feed.json` to feed, else by basename.
- `contracts/lexicon.json`: EN and ID banned verdict lexicon exactly per 6.9;
  future-tense-harm patterns; style rules (em dash char, emoji ranges); scoped exemption
  list entries carry file glob plus JSON-path key.
- `contracts/technique-tags.json`: Appendix B vocabulary, keys locked, EN and ID labels.
- `scripts/validate-content.ts`: the ten checks of 6.11, per-check table output, exit 1
  on any failure. Check notes:
  - Check 3 recomputes `DerivedCounts` from panels per 6.5 (missing/unsourced/disputed/
    supported/hidden; unsourced counts edges "unsourced" plus hidden entries without
    `ev`) and `conflicts` = dueling `counts.length` when a dueling panel exists.
  - Check 5 lints `content/**`, `app/src/i18n/**`, and the landing copy constants module
    when present; whole-word, case-insensitive; exemptions honored and printed.
    Future-tense-harm applies to Echo outcomes and case-library `documented_outcome`.
  - Check 6 gate tokens: sha256 over the canonical artifact bytes with
    `manifest.gates` nulled (stable key order, no whitespace); both tokens must match.
  - Check 7: no `"seed": true` under `content/`; the app import-graph half lives in a
    unit test (`no-fixtures-in-app`), stubbed now to scan `app/src` imports.
  - Check 9 liveness policy (documented interpretation): `url` returned HTTP < 400 at
    snapshot, OR `liveness: "dead_replaced"` with note, OR `liveness: "live"` with a
    note documenting anti-bot corroboration. The validator reads recorded fields only;
    it never fetches.
  - Check 10: feed items resolve, exactly one hero per pack, `ppn-panic` flagged
    `via_dissect`.
- Empty-content behavior flips: `content/` now must contain `sources.json` at minimum;
  absence is a failure (the Gate 0 ponytail note pays off here).

## Acceptance for this slice

- Installed suite covers every check with at least one passing and one failing fixture;
  RED before implementation, GREEN after, verified by fresh runs.
- `pnpm validate:content` green on the real `content/` (sources.json, og_attribution.json).
- og_attribution.json gets a schema too (it is a shipped content artifact).
- Full command set green: lint, typecheck, test:unit, validate:content, build.
