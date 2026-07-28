#!/usr/bin/env node
/**
 * Derives the mechanical fields of every Gate C test fixture and stamps the gate tokens.
 *
 *   pnpm exec tsx tests/pipeline/fixtures/stamp.mjs
 *
 * Run with tsx, not bare node: the token recipe is imported from pipeline/lib/canonical.ts,
 * the same module A12 and the content validator use, so a fixture token can never be a second
 * implementation of the recipe.
 *
 * What it owns, and nothing else (same split as tests/fixtures/seed/stamp-seed.mjs):
 *   - `counts` per 6.5 plus the CF-1 `conflicts`, recomputed from the panels of every fixture
 *     artifact under tests/pipeline/ that carries panels;
 *   - `provenance.source_count`, the distinct registry ids the artifact references;
 *   - the `token` field of every gc-fixture-0 gate verdict file, computed over the candidate
 *     artifact those verdicts judged.
 *
 * Idempotent. Rerun after editing any fixture datum. The specs recompute the token themselves
 * and compare, so a stale fixture fails loudly rather than passing quietly.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const HERE = import.meta.dirname;
const GC = dirname(HERE);
const REPO = dirname(dirname(GC));
const { gateToken } = await import(
  pathToFileURL(join(REPO, 'pipeline', 'lib', 'canonical.ts')).href
);

const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const write = (p, v) => writeFileSync(p, `${JSON.stringify(v, null, 2)}\n`);

/** 6.5 derivation plus the CF-1 additive optional `conflicts`. Never authored. */
function deriveCounts(panels) {
  const claimMap = panels.find((p) => p.type === 'claim_map');
  const edges = claimMap?.edges ?? [];
  const hidden = claimMap?.hidden ?? [];
  const withStatus = (s) => edges.filter((e) => e.status === s).length;
  const counts = {
    missing: withStatus('missing'),
    unsourced: withStatus('unsourced') + hidden.filter((h) => h.ev === undefined).length,
    disputed: withStatus('disputed'),
    supported: withStatus('supported'),
    hidden: hidden.length,
  };
  const dueling = panels.find((p) => p.type === 'dueling');
  if (dueling !== undefined) counts.conflicts = dueling.counts.length;
  return counts;
}

/** Every registry id a subtree references: `source_id` keys and `citations` arrays. */
function referencedSources(node, into = new Set()) {
  if (Array.isArray(node)) {
    for (const item of node) referencedSources(item, into);
    return into;
  }
  if (node === null || typeof node !== 'object') return into;
  for (const [k, v] of Object.entries(node)) {
    if (k === 'source_id' && typeof v === 'string') into.add(v);
    else if (k === 'citations' && Array.isArray(v)) for (const c of v) into.add(c);
    else referencedSources(v, into);
  }
  return into;
}

const jsonPaths = readdirSync(GC, { recursive: true })
  .map(String)
  .filter((rel) => rel.endsWith('.json'))
  .map((rel) => join(GC, rel))
  .sort();

let derived = 0;
for (const abs of jsonPaths) {
  const artifact = read(abs);
  if (artifact === null || typeof artifact !== 'object' || !Array.isArray(artifact.panels)) continue;
  artifact.counts = deriveCounts(artifact.panels);
  artifact.provenance.source_count = referencedSources(artifact).size;
  write(abs, artifact);
  derived += 1;
}

const slots = join(GC, 'fixtures', 'runs', 'gc-fixture-0', 'slots');
let stamped = 0;
for (const narrative of readdirSync(slots)) {
  const dir = join(slots, narrative);
  const token = gateToken(read(join(dir, 'candidate.json')));
  for (const verdictFile of ['A10.json', 'A11.json']) {
    const verdict = read(join(dir, verdictFile));
    verdict.token = token;
    write(join(dir, verdictFile), verdict);
    stamped += 1;
  }
  console.log(`  ${narrative}: ${token}`);
}

console.log(
  `derived counts on ${derived} artifact(s), stamped ${stamped} gate verdict(s) under ${basename(GC)}.`,
);
