# Gate 2 plan: renderers on tagged seed

Blueprint 9.2 Gate 2: all eight grammar components plus card, sheets, and narration
binding built against `"seed": true` fixtures transcribed from the zip data; AC-GRAM
screenshots; AC-INV-1, 2, 7, 10 green; seed quarantined by the import-graph test from
day one. Porting rules bind (blueprint 4.1): port, do not redesign.

## Decisions

- **Component shape (6.8).** Each grammar component is a React component whose props are
  exactly the Section 6.4 panel type plus `ctx: RenderCtx` (`lang`, `resolveSource(id)`,
  `theme`). `resolveSource` throwing surfaces as `OrphanNumberError` before any numeral
  draws; the card component throws `CardContractError` when `counts` or `tags` are absent
  or empty. Percentages exist only as render-time derivations with tabular numerals.
- **Adapter, not redesign.** Internally each component maps contract objects to the zip's
  DOM structure and class vocabulary; the zip's inline styles become CSS classes on the
  token layer (`app/src/renderers/renderers.css`), byte-faithful on radii, spacing,
  hairlines, dash patterns, and the status color semantics. Dash patterns always ship
  alongside color (colorblind safety).
- **Shared canonical hash.** `pipeline/lib/canonical.ts` exports the canonical-bytes and
  token-hash helpers (sorted keys, `manifest.gates` nulled). The validator and the seed
  generator both consume it; A12 will too. Single definition, drift impossible.
- **Seed fixtures.** `tests/fixtures/seed/` is a full content root transcribed from
  `matterhorn-data.js` into contract shapes against a seed source registry
  (`"seed": true` on every artifact, real tokens via the shared helper). Minimum:
  `mbg-stop` (claim_map, scale_check, money_flow, incidence, options, family, 3 sparring
  questions, prediction_tap), `mbg-poisoning` (dueling), `ppn-panic` (echo), so all eight
  panel types and the card render. Zip display shapes convert: authored `pct` dropped
  (renderer derives), `pack: 'intl'` becomes `en`, fixture figures stay as the zip wrote
  them (they are quarantined seeds, deleted at Gate C; the sources they cite live in the
  seed root's own sources.json, never in `content/`).
- **Screenshot harness.** A dev-only Vite entry (`app/harness.html` + `app/src/harness/`)
  renders one component per URL query (`?panel=claim_map&narrative=mbg-stop&lang=en&theme=light`),
  loading fixture JSON via fetch (no static import). Excluded from production builds by
  mode flag; the import-graph test (`tests/unit/no-fixtures-in-app.spec.ts`) asserts no
  `app/src` file statically imports from `tests/`.
- **Playwright enters here** (`@playwright/test` pinned, chromium installed; webkit and
  firefox projects configured but exercised at Gate 3/6). AC-GRAM screenshots are
  committed under `tests/e2e/__screenshots__/`.
- **AC-GRAM-9 parity evidence.** Reference renders come from opening the extracted
  `Matterhorn.dc.html` (with its own `support.js`, file://, scratch dir only, never
  shipped or committed) in Playwright and screenshotting the autopsy panels; side-by-side
  images committed under `tests/e2e/__screenshots__/parity/`. If the DC runtime does not
  run outside its host, the fallback is markup-level parity review, noted honestly.
  Radar/Settings parity completes at Gate 3 with the full surfaces.

## Worker sequence

1. **W1 seed transcriber** (staging delivery): seed content root + seed sources registry
   + token stamping via the shared helper it also authors (`pipeline/lib/canonical.ts`
   is source code, not tests; W1 owns it and the validator implementer's inline copy gets
   refactored to consume it).
2. **W2 test author** (staging delivery, runs after W1 delivers so fixtures exist):
   AC-INV-1 orphan refusal per component; AC-INV-2 card contract (throw paths + the grep
   that no alternative headline path exists); AC-INV-7 derived percentages within 0.1pp;
   AC-INV-10 provenance chips render manifest models verbatim + grep for hardcoded model
   names; import-graph quarantine; AC-GRAM-1..8 screenshot specs against the harness.
3. **W3 renderer implementer**, sequential in two slices: (a) shared base (RenderCtx,
   errors, Value primitives, status legend, card, evidence sheet) + claim_map +
   scale_check; (b) money_flow, incidence, dueling, echo (with silence state), options,
   family, narration binding. Never touches tests.
4. Orchestrator verifies fresh; fresh reviewer re-runs, compares screenshots against the
   zip reference, verdicts the gate.

## Acceptance for this slice

- AC-INV-1, 2, 7, 10 unit tests green; import-graph test green; validator still green on
  real content/ and on the seed root (seed root passes every check EXCEPT seed, whose
  failure on the seed root is asserted as proof the quarantine detector works).
- AC-GRAM-1..8 screenshots exist for light theme, EN, at 402px logical width; dark and ID
  variants land with the Gate 3 state matrix.
- Full command set green; bundle budget check unaffected (harness excluded from prod).
