# Gate 3 plan: app shell and surfaces

Blueprint 9.2 Gate 3: onboarding, tabs, autopsy assembly, settings, sheets, share
resolver, permalinks, offline, i18n bundles; the AC-APP matrix passing on seed content.
Surfaces inventory: blueprint 3.2 items 1-17 plus sheets, 22-25 global routes; Appendix A
state-matrix minimum (60+ named states). Every Gate 2 obligation in `.crown/notes.md`
"GATE 3 OBLIGATIONS" is in scope here.

## Waves (9.3: parallel only where files do not contend; integration serialized)

- **Wave 0a (fixtures, staging):** EN seed narrative `tariffs-pay` transcribed like the
  ID three (claim_map, scale_check, money_flow, incidence per 7.1; dueling per zip),
  `packs/en/feed.json` with it as hero, url_index + constellation + og_attribution
  extended, tokens restamped. Unblocks region switching and AC-APP-14.
- **Wave 0b (app shell, one implementer):** router (react-router pinned exact), route
  skeleton per 6.7 (`/app`, `/n/:id`, `/share`, `/methodology`, `/offline`, 404; landing
  and research placeholders), the four-tab chrome + frosted bars from the zip, screen
  state machine (hello through main), i18n layer (`app/src/i18n/en.json`, `id.json`, all
  UI chrome strings keyed; zip copy extracted verbatim; missing-key scan util), content
  loader (fetch `content/` at runtime with the pack switcher; SEED MODE: dev flag serving
  `tests/fixtures/seed` the harness way, so the app runs on seed until Gate C swaps real
  content in with zero code change), theme switch (`data-mth`), reduced-motion media
  rules. PWA enters: vite-plugin-pwa injectManifest, manifest.webmanifest with the FROZEN
  6.7 fields incl. relative share_target, SW skeleton (precache shell; content JSON
  runtime cache; offline fallback route), icons (generate from the wordmark M motif,
  192/512 + maskable).
- **Wave 1 (surfaces, sequential implementers on the shell contract):**
  1. Onboarding + auth honesty (hello rotation, lang CF-3 rows, regions, notif primer +
     simulated iOS dialog, honest-auth sheet, D-7).
  2. Radar + Autopsy assembly (feed from feed.json + corrections chip wiring, region
     sheet, symmetry line; autopsy: OG card, provenance line + full-chain sheet
     (manifest.steps, Gate 2 obligation), sparring S3/S2/S1/S0 + diff card + skip, panel
     stack from Gate 2 renderers, narration binding, explore drawer, action bar, flag
     flow, nuance card overlay with html-to-image export).
  3. Dissect + Archive + Settings + system screens (paste box + resolver logic
     (url_index exact/prefix/regex, queue state, 4-stage progress with honest line,
     rate-limit), archive search/filters/constellation teaser/case library, settings
     (scaffold 5-option override, appearance, transparency rows, replay), methodology
     screen, notif settings + lock preview, chat sim (ANTARA preview per snapshot
     decision), install hint.
- **Wave 2 (glue):** permalink shell emitter (`scripts/build-permalinks.ts`, per-narrative
  HTML with og tags from 6.7 frozen template), share GET resolver hardening (XSS escape),
  offline e2e behavior, focus trap + aria-modal restoration, deep-link `/n/:id` hydrate.
- **Tests:** matrix author (separate worker) writes `tests/state-matrix.json` (Appendix A
  set) + the AC-APP spec harness FIRST (red); surface implementers make slices green.
  AC-APP specs in scope this gate: 2-14, 16-20, 22-23 (15 dark-parity and 21
  cross-browser land at Gate 6 with the full matrix re-run; 1 completes when the matrix
  driver runs end to end here).

## Acceptance for this slice
- State matrix driver green over the Appendix A minimum set on seed content, screenshots
  committed; AC-APP-2..14, 16-20, 22-23 green; validator + full unit + Gate 2 e2e still
  green; build budgets: app route initial JS <= 350 KB gzip (AC-PERF-1 floor checked
  early); `--scan-app app/src` green throughout.
- Gate 2 residuals re-probed by the entry review (counts {} throw, teaser, aria-modal
  absent until trap, money footer).
