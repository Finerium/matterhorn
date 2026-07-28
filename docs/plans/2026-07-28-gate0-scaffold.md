# Gate 0 scaffold plan

Blueprint 9.2 Gate 0 remainder (Phase 0 comprehension passed; snapshot fleet running in parallel):
CI skeleton green (lint, typecheck, empty test run), contracts package compiling, validator CLI
scaffolded and failing loudly on an intentionally broken fixture.

## Decisions (locked here)

- Single root package, no workspace. `contracts/`, `pipeline/`, `scripts/` are TS source dirs
  reached via path aliases; the Vite app lives in `app/` with its own `vite.config.ts`
  (`root: app/`). ponytail: one lockfile, one node_modules, zero workspace plumbing.
- TypeScript strict + `noUncheckedIndexedAccess`, one root `tsconfig.json` with project-wide
  includes; `tsc --noEmit` is the typecheck.
- Styling: plain CSS with custom properties from the zip token block (blueprint 5.2 offers
  CSS modules or vanilla-extract; plain CSS modules chosen: the zip is inline-style + token
  driven, modules port it with zero dependencies).
- Lint = eslint flat config (typescript-eslint, minimal rule set) + the custom content lints
  when they exist (Gate 1). eslint justification line goes in ARCHITECTURE.md at Gate 7.
- Validator: `scripts/validate-content.ts` run via `tsx`; `pnpm validate:content` in CI.
  ajv for JSON Schema validation (justification: the ten checks of 6.11 are schema-first;
  hand-rolling JSON Schema is a bug farm). Gate 0 scaffolds check 1 (schema validity) only,
  over `content/**/*.json` if present; empty content dir passes with an explicit note.
- Exact-version pins (`pnpm add -E`), lockfile committed.

## File map

- `package.json` scripts: dev, build, preview, typecheck, lint, test, test:unit,
  validate:content
- `tsconfig.json` (strict, noUncheckedIndexedAccess, paths: `@contracts/*`, `@pipeline/*`)
- `eslint.config.js`
- `contracts/types.ts` Gate 0 core: `SourceId`, `Source`, `Value`, `Lang` (frozen 6.1/6.2
  shapes; the full Section 6 set lands at Gate 1)
- `contracts/schemas/source.schema.json`, `contracts/schemas/value.schema.json`
- `scripts/validate-content.ts` CLI: loads schemas, validates `content/**/*.json` by
  filename-to-schema map, prints per-check table, exit 1 on any failure, exit 0 with
  "content/ empty, nothing to validate" when empty
- `app/index.html`, `app/vite.config.ts` (react plugin only for now), `app/src/main.tsx`,
  `app/src/tokens.css` (verbatim `.mth` custom-property block, light + dark, from the zip)
- `.github/workflows/ci.yml`: pnpm setup, install --frozen-lockfile, lint, typecheck,
  test:unit, validate:content, build; all blocking
- `tests/unit/validator-can-fail.spec.ts` (ORCHESTRATOR-authored, not implementer):
  runs the validator against `tests/fixtures/broken/` (a sources.json violating the schema)
  and asserts non-zero exit + a loud message naming the file and check

## Acceptance for this slice

- `pnpm install && pnpm lint && pnpm typecheck && pnpm test:unit && pnpm validate:content && pnpm build` all green locally
- validator run against the broken fixture exits non-zero (proof it can fail)
- No `.env`, no secrets, no new deps beyond: react, react-dom, gsap (deferred), typescript,
  vite, @vitejs/plugin-react, vitest, tsx, ajv, eslint+typescript-eslint. Router, PWA,
  html-to-image, d3-force, transformers, playwright, lhci enter at the gate that needs them
  (ponytail: no dependency before its first consumer).
