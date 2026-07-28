# Understanding Matterhorn

Written by the Orchestrator after reading all four inputs completely: `blueprint-matterhorn.md` (1001 lines), `Matterhorn-PRD-v1.0.pdf` (36 pages), the design zip (`Matterhorn.dc.html` 1521 lines, `matterhorn-data.js` 735 lines, `ios-frame.jsx` 352 lines; `support.js` discarded as template runtime), and `research-matterhorn.md` (199 lines). Inputs referenced by relative path from `~/Documents/Matterhorn`; none are committed to this repo.

## 1. The core idea, in my own words

The misinformation that does the most damage today is not built from false facts. It is built from true facts joined by arrows nobody ever justified: a real budget number, a real program, and an invented causal step between them ("stop the meals program, the economy is saved"). Fact-checkers cannot touch this because every atom survives verification; the lie lives in the structure, and no institution is built to stamp a structure.

Matterhorn attacks exactly that layer. For each viral narrative it renders the causal skeleton the story implies: the asserted spine down the middle, every edge labeled by evidence status (supported, disputed, missing, unsourced), and beside it the branches the story priced at zero: hidden stakeholders, absent denominators, missing counterfactuals, invisible incidence. Every number on screen carries a source identifier that resolves to an official statistic, or the renderer refuses to draw it. The product never says true or false, never scores an outlet, never predicts what a story will cause. It shows the reader the shape of what they are being told and steps back. The reader stays the judge.

The mechanism of trust is architectural, not rhetorical: analysis is computed once by a pipeline that never knows who is asking (stance-blind by data flow), gated by two agents with the power to block publication (symmetry and fidelity), and served as static cached artifacts so the read path never touches a model or a key. The training layer (Sparring) makes the reader answer three questions before the reveal: what is the mechanism, compared to what, who pays first, and then shows the analysis as a diff against their own guesses. Scaffolding fades as accuracy rises: the success state is needing the product less.

This build ships the complete product at demo scale: ten dissected narratives across two Country Packs (Indonesia deep, EN-Global), the eight-component visualization grammar, the thirteen-agent pipeline executed for real at build time with Claude Code subagents in the LLM slots, three surfaces (mobile app at `/app`, research desk at `/research`, scroll-driven landing at `/`), public permalinks, a methodology page, and an installable PWA that registers as an Android share target.

## 2. The four blindnesses (PRD T1, the product's core taxonomy)

1. **Mechanism**: the middle of the causal chain is simply absent. No stated pathway from cause to effect. Killed by the Claim Map: the missing edge renders as a red dotted gap you see in one second.
2. **Magnitude**: a large-sounding number is never placed against the denominator that gives it meaning. Killed by Scale Check: one proportional bar, official denominators only, percentages always derived.
3. **Counterfactual**: "compared to what?" is never asked; the world where the action is taken is assumed, not examined. Killed by Money Flow with the stop-toggle striking documented existing flows (and, in its history variant, by Echo).
4. **Incidence and timescale**: who bears the cost, and when, is invisible; aggregate framing hides that losses land on specific groups within weeks while benefits are diffuse and delayed. Killed by the Incidence Timeline swimlanes.

Two meta-components teach the unit of analysis itself: Narrative Family (one skeleton, many outlets: the narrative, not the article, is the unit) and Constellation (how narratives connect through shared institutions). Dueling Numbers kills the trust variant of magnitude blindness: when official counts conflict, render the conflict with methodologies; picking a winner is itself an editorial act.

## 3. The verdict-free rules (C1, PRD 6.1)

- Never: true, false, hoax, misleading, debunked, dangerous, lie, busted, "fact-check: false", or any scalar quality score for a narrative or an outlet, anywhere, in any language, including notifications, toasts, share assets, and the landing. Indonesian list: hoaks, bohong, palsu, benar/salah as verdicts, sesat, menyesatkan, terbukti as a verdict, dusta.
- Permitted output classes only: edge statuses on causal links, descriptive counts of those statuses, technique tags naming rhetorical form (never truth), and sourced facts with identifiers.
- Enforced by the banned-lexicon lint (contracts/lexicon.json) over content, i18n bundles, and landing copy constants, in EN and ID, with scoped exemptions only for the methodology page describing what Matterhorn does not do and for case-library text quoting an institution inside quotation marks with a citation.
- The future-tense-harm lint is the sibling rule (C5, policy 6.5): Echo and case text are retrospective and cited; "will cause"/"akan menyebabkan" class phrasing fails the build; collective action itself is never framed as the harm. PRD 6.5 publishes verbatim on the methodology page.
- Copy style rides along (C8): no em dashes, no emoji, in any user-facing string, any language. Register is PRD 10.1: calm, precise, lightly wry, a sharp friend, self-interest over civic duty.

## 4. The card contract (C2, PRD D11)

An original headline never renders without its technique tags and descriptive counts attached. In the feed, the autopsy header, notifications, and Nuance Cards. This is the "defused bomb" rule: the bait ships with the needle already in it, so the feed cannot degrade into a rage aggregator with extra steps. Enforcement is code, not policy: the card component throws `CardContractError` when `counts` or `tags` are absent or empty (AC-INV-2), a grep proves no alternative headline-rendering path exists, and the notification template carries counts plus the top technique tag by construction (Appendix C). Its sibling invariant C3: no numeric value renders without a `source_id` resolving in `content/sources.json`; the renderer throws `OrphanNumberError`, and the validator fails CI. Numbers travel only inside the `Value` object; a bare numeric prop on a grammar component is a type error.

## 5. Input precedence order

1. **`blueprint-matterhorn.md`** wins on behavior, contracts, data shapes, scope, and its Section 5.6 deviations. Its Section 7.2 data corrections (drawn from research Section 8) override the PRD's raw figures.
2. **Design zip** wins on look, layout, motion, and interaction feel: port, do not redesign. It never wins on data shapes or behavior contracts. Where it implies a field or behavior the blueprint does not define: surface and reconcile against Section 6, never invent a contract to match a mockup, never silently drop a designed element.
3. **PRD v1.0** is authoritative for intent, rationale, policy wording (6.1 to 6.7 especially), agent missions, and voice, wherever the blueprint does not override it (the D-1..D-15 registry is the complete override list).
4. **`research-matterhorn.md`** is binding for every number, URL, license, and its Section 8 corrections.

Uncatalogued conflicts get recorded in `.crown/notes.md` and the Report, resolved on the most defensible reading, and the build continues (blueprint 0.1).

## 6. Surface inventory, reconciled against the zip

Mobile app `/app` (zip = present in `Matterhorn.dc.html`; NEW = blueprint-owned, copy from blueprint Appendix C, layout derived per 4.1.8):

| # | Surface | Zip | Notes |
|---|---|---|---|
| 1 | Hello / rotating greeting | yes (`sHello`, mgreet blur-in, 2.1s rotation, 6 greetings) | tagline replaced per D-10 |
| 2 | Onboarding language | yes (`sLang`, 5 rows) | EN + ID selectable; es/fr/ja become "rolls out gradually" rows (conflict CF-3 below) |
| 3 | Onboarding regions | yes (`sRegion`; US and More marked soon) | as-is |
| 4 | Notification primer + simulated iOS dialog | yes (`sNotifPerm`, `shNotif` with Allow / Don't Allow paths) | preview card gains top technique tag (conflict CF-4) |
| 5 | Auth screen | yes (`sAuth`) | Apple/Google open honest-auth sheet, never a fake session (D-7); skip continues |
| 6 | Radar tab | yes (hero card, compact cards, crisis-hold card, under-review chip, symmetry line, region switcher, via-Dissect chip) | feed renders from `feed.json` + `corrections.json` |
| 7 | Dissect tab | yes (paste box, cached/fresh chips, rate-limit line, from-another-app card, recents) | fresh chip points at the live PPN demo URL chosen at snapshot (D-9, 7.2.9) |
| 8 | Archive tab | yes (search, filter chips, constellation teaser, dissection list, case library) | pack filter value 'intl' maps to contract 'en' in the adapter |
| 9 | Settings tab | yes (account, language, regions, notifications, appearance, scaffolding card, transparency rows, replay) | scaffold override list gains S2 (D-8): Auto, S3, S2, S1, S0 |
| 10 | Autopsy View | yes (OG card, provenance line, S3 gate, S1 prediction tap, S0 spar-chip, diff card, panel stack, options+playbook, family, explore CTA, action bar) | S2 gate is NEW: S3 card UI with one rotating question and a single dot |
| 11 | Methodology screen | yes (`sMeth`: receipts, symmetry bar, selection criteria, policy 6.5, changelog) | symmetry computed from published content |
| 12 | Notification settings + lock preview | yes (`sNotifSet`, `sLock`) | preview row fires a real local SW notification (AC-APP-20) |
| 13 | Chat simulation | yes (`sChat` + `shShare` share-sheet sim) | emoji removed from fixture message (conflict CF-2) |
| 14 | Staged progress | yes (`sProg`, 3 stages + honest line verbatim) | only the designated fresh-demo URL triggers it (D-9) |
| 15 | Queue state (unknown URL) | NEW | Appendix C copy; progress-screen layout minus spinner stages, one static row |
| 16 | Offline fallback | NEW | SW-served |
| 17 | Install-education hint | NEW | Android only, dismissible, toast/card pattern, Appendix C copy |

Sheets and overlays (all in zip): region switcher, evidence sheet, Explore drawer, flag form + received, original-headline, provenance chain, rate-limit, simulated iOS dialog, share-sheet simulation, Nuance Card (Story 4:5 + Chat), toast. NEW: honest-auth sheet (Appendix C copy).

Desktop: 18 `/research` (archive table with filters, full constellation, detail rail with velocity, lean spread, echoes, permalink, CSV/JSON export: not in zip beyond the mobile teaser; desktop-first build). 19 wide-viewport autopsy layout (narration rail beside panels). 20 `/app` at >=768px inside the ported iPhone frame (402x874, radius 48, dynamic island, status bar, home indicator) centered on paper, caption row beneath.

Landing `/` (21): all of blueprint 4.4, frozen copy, not in zip. Global: 22 `/n/{id}` permalinks, 23 `/share` resolver, 24 `/methodology` public route, 25 404. Offline route via SW.

## 7. Conflicts found and resolutions (per blueprint 0.1)

Catalogued deviations D-1..D-15 are accepted as binding and not re-argued (auth honesty, S2, fresh-demo gating, tagline, enacted APBN, poisoning counts, dropped 987k baseline, og images, dead-URL re-resolution, etc.). Beyond those, my read of the zip against the contracts surfaced these, resolved as follows and mirrored in `.crown/notes.md`:

- **CF-1 · `counts.conflicts` and the dueling teaser.** The zip card renders a "3 official counts conflict" chip from a `counts.conflicts` key and a dueling teaser paragraph on the compact card (`mbg-poisoning`). Frozen `DerivedCounts` (6.5) has no such field and chips must render exclusively from `counts`. Resolution: add `conflicts` as an additive optional field on `DerivedCounts`, which Section 6 explicitly permits with validator coverage; it is derived mechanically as the number of `CountEntry` items in the narrative's dueling panel (absent otherwise), recomputed by the validator like every other count, never authored. The compact-card teaser renders the dueling panel's `rule_line`. Disclosed in the Report as a covered additive field, not a contract change.
- **CF-2 · Emoji in the chat-sim fixture.** `matterhorn-data.js` puts an emoji in Uncle Har's message. C8 is absolute across user-facing copy in any language, and the mission repeats it for generated content. Resolution: C8 (hard constraint) beats zip microcopy (4.1.6 already gives blueprint copy precedence where supplied; C1/C8 bind every phase). The chat-sim message ships without the emoji; the lint proves it.
- **CF-3 · Onboarding language list.** Zip offers five selectable languages; ADR-11 ships exactly two locales (en, id). Resolution: keep the five rows for visual fidelity; Espanol, Francais, and Japanese rows adopt the regions screen's existing "rolls out gradually" pattern (dimmed, toast on tap), which the zip itself established for region rows. No designed element dropped, no fake capability implied.
- **CF-4 · Notification primer and lock-screen mocks lack technique tags.** The zip's primer preview card and lock-preview notification show headline + counts sentence but no tag, while C2 requires tags wherever a headline renders, notifications included, and the Appendix C template carries `{top_tag}`. Resolution: both mocks render the Appendix C template shape (headline short form, top tag, counts). Zip layout kept; copy shape corrected to the contract.
- **CF-5 · ppn-panic Scale Check has an illustrative, sourceless denominator.** The zip fixture uses "full basket" / "narrow base" with an authored pct and an "illustrative denominator" source. Under the Value contract this cannot ship. Resolution: this is a Gate C authorship problem, not a schema problem: A7 must ground ppn-panic's scale panel in real sourced Values (candidates from the registry: the Rp38.6T stimulus package against the affected luxury-goods base, or the 11 percent effective vs 12 percent luxury rate structure per PMK 131/2024). If no honest denominator exists, the panel set for ppn-panic falls back to claim_map + echo (D15 allows silence) with a Report note. Flagged now so the pipeline work order carries it.
- **CF-6 · Fixture figures that corrections override.** The zip data embeds BGN 4,711 and BPOM 9,083 (dueling), "rose from 987k in Feb" (mbg-jobs voice and hidden node), Yale "$1,700 initial" (tariffs-pay hidden node and dueling), "$43.8B" (usaid-deficit), draft APBN denominators (Rp3,786.5T, deficit Rp638.8T), and authored percentages. All are superseded at generation time by blueprint 7.2: BGN 6,517 (1 Oct 2025 running count) / BPOM 9,089 / JPPI 8,649 never reconciled; 987k dropped unless re-sourced; $648 post-substitution with the $780 to $1,338 pre-substitution bracket, $1,700 banned; $43.8B only if live on the KFF page; enacted Rp3,842.7T spending and 2.68 percent (Rp689.1T) deficit labeled "APBN 2026, enacted"; every percentage derived at render (AC-INV-7). Seed fixtures for Gate 2 transcribe zip data into contract shapes against a quarantined seed source registry, are marked `"seed": true`, live outside `content/`, and are deleted at Gate C.
- **CF-7 · Pack identifier.** Zip uses `pack: 'intl'`; the contract fixes `"id" | "en"`. Contract wins; the adapter and archive filter map labels.
- **CF-8 · Hardcoded provenance and links.** Zip hardcodes "Opus 4.8" / "Sonnet 4.6" and `matterhorn.app/n/...`. D-2 and ADR-10 override: chips read the generation manifest's actual executing models; links derive from `SITE_URL`.

## 8. The ten-narrative work order (blueprint 7.1, both languages each)

Indonesia pack (6):
1. **mbg-stop** · opp lean · hero · panels: claim_map, scale_check, money_flow, incidence, options+playbook, family · sparring 3q authored, scaffold_default S3 · flagship URL is dead, re-search live "Setop MBG Permanen" equivalent; STOP-AND-ASK if none (OQ-2).
2. **mbg-cut** · neutral · claim_map, scale_check, family · the family sibling proving narrative-not-article.
3. **mbg-poisoning** · opp · claim_map, dueling (BGN 6,517 / BPOM 9,089 / JPPI 8,649, three methods, never reconciled), incidence.
4. **mbg-jobs** · gov · claim_map, scale_check · self-reported chain flagged; carries the under-review demonstration via corrections.json.
5. **judol-turnover** · gov · claim_map, scale_check, dueling on turnover (Rp359.81T 2024, Rp286.84T 2025, Rp40.3T Q1 2026) vs net deposits (Rp51.3T / Rp36.01T): the denominator lesson.
6. **ppn-panic** · gov-clarification · claim_map, scale_check (see CF-5), echo (case B-04, the only Echo in the demo set; silence everywhere else) · excluded from the initial feed, joins via the fresh-dissect demo flow (`via_dissect`).

EN-Global pack (4):
7. **tariffs-pay** · hero · claim_map, scale_check, money_flow, incidence · CBO $2.5T primary / CRFB $3.0T with interest; tariff revenue and total federal revenue rendered as two sourced Values, ratio derived.
8. **usaid-deficit** · claim_map, scale_check · KFF 26 percent guess vs about 1 percent actual, 11 percent correct, 58 to 34 flip.
9. **migrant-crime** · claim_map, dueling of Cato 44 percent / PNAS Light 2020 / FBI 2024 (violent crime minus 4.5, murder minus 14.9) framings.
10. **usaid-deaths** · claim_map, scale_check, incidence · the symmetry pair: a left-coded certainty-inflation narrative (Lancet 14.05M projection with UI 8.48 to 19.66M, about 91.8M prevented 2001 to 2021) dissected with identical rigor.

Case library B-01..B-04 (May 2019 with 10 per Komnas HAM; Omnibus 2020; Aug 2025 with Makassar DPRD fire 3 deaths; PPN scope-inflation panic), constellation, methodology aggregates, and `url_index.json` (legacy dead URLs kept as `legacy`, exactly one `fresh_demo` entry) complete the content set. Every artifact is regenerated by the fleet against `sources.json`; the zip's data is fixture reference only and ships nowhere.

## 9. Answers the build must never get wrong (self-check)

- **Unknown shared URL**: never fabricated analysis. `/share` and paste resolve against `url_index.json` (exact, prefix, regex); a miss renders the queue state with Appendix C copy, no progress animation. Only the one designated live PPN URL runs the compressed staged demo, whose honest line ships verbatim.
- **What makes a number renderable**: being an `amount` inside a `Value` (or dueling `CountEntry`) whose `source_id` resolves in `content/sources.json`; otherwise `OrphanNumberError` at render and validator failure in CI. Percentages exist only as render-time derivations.
- **What blocks publication**: A10 Symmetry Auditor (stance leakage or asymmetric rigor on the mirror framing) and A11 Fidelity Guard (any narration sentence not traceable to graph elements, lexicon or future-tense-harm violations). A12 refuses to publish without both gate tokens, tokens are hashes over artifact bytes, and no code path bypasses them (AC-INV-8 proves it by tamper test). Neither the Orchestrator nor A1 can override a block; the only exit is fixing the pipeline or sources and re-running. Human judgment enters only as the appeal path for false blocks, by re-running, never by bypass.
- **Where S2 comes from**: the PRD D8 fading-scaffolding ladder (S3 full, S2 light with 1 rotating question, S1 prediction tap, S0 direct). The zip implements S3/S1/S0 and silently maps S2 to S1; blueprint D-8 restores S2 as first-class, reusing the S3 card with one question and a single dot. Settings override lists five options.
- **APBN figures that ship**: enacted APBN 2026: spending Rp3,842.7T, deficit 2.68 percent (Rp689.1T), labeled "APBN 2026, enacted"; debt interest Rp599.44T (Perpres 118/2025); debt position Rp9,920.42T "as of March 2026"; energy subsidy Rp210.1T labeled "RAPBN 2026 draft" unless the enacted line is found at snapshot (OQ-7); MBG realized Rp88.15T "by May 2026" with 63.13M beneficiaries, 142,387 suppliers, 1.28M workers (BGN figures flagged self_reported); SPPG kitchens pinned to one figure with date and source, default 29,679 per Kemenkeu as reported May 2026, variance noted in `Source.notes`.
