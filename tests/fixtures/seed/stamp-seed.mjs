#!/usr/bin/env node
/**
 * Seed content root: derive, stamp, audit. Gate 2, blueprint 6.11 check 6.
 *
 *   pnpm exec tsx staging/seed/stamp-seed.mjs
 *
 * Run with tsx, not bare node: the gate-token recipe is imported from the TypeScript module
 * `pipeline/lib/canonical.ts`, which is the single definition the content validator also uses.
 * Stamper and checker cannot drift, because there is only one implementation.
 *
 * The JSON artifacts in this directory are the authored source of truth. This script owns only
 * the mechanical fields, exactly the ones 6.3 and 6.5 say are never authored:
 *
 *   - `counts` per 6.5 plus the CF-1 additive `conflicts`, recomputed from the panels;
 *   - `provenance.source_count`, the number of distinct registry ids the artifact references;
 *   - both `manifest.gates` tokens.
 *
 * Idempotent: rerun after editing any datum and every derived field plus every token is rebuilt.
 * Self-auditing: it refuses to leave a root behind that the validator would reject, checking the
 * invariants a seed root must hold. It exits 1 on any problem. It is NOT the validator, and must
 * never grow into one: `pnpm exec tsx scripts/validate-content.ts --dir staging/seed` is the real
 * verdict, and on this root exactly one check fails, `seed`, which is the quarantine working.
 *
 * ponytail: overwrite in place, no wipe first. This repo lives under a synced Documents folder,
 * and a delete-then-recreate cycle makes the sync daemon leave "name 2.json" duplicates behind,
 * which then land in the root as extra artifacts. Ceiling: a removed artifact would linger, so
 * delete it by hand if the seed set ever shrinks.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = import.meta.dirname;

// ponytail: walk up for package.json instead of hardcoding ../../, so the script keeps working
// after the orchestrator installs this directory as tests/fixtures/seed/. Ceiling: assumes the
// repo has exactly one package.json at its root.
function repoRoot(from) {
  let dir = from;
  while (!existsSync(join(dir, 'package.json'))) {
    const up = dirname(dir);
    if (up === dir) throw new Error(`no package.json above ${from}`);
    dir = up;
  }
  return dir;
}

const REPO = repoRoot(ROOT);
const { gateToken } = await import(
  pathToFileURL(join(REPO, 'pipeline', 'lib', 'canonical.ts')).href
);
/** Appendix B is locked: the pipeline may assign only these keys, and so may a seed. */
const TAG_KEYS = new Set(
  JSON.parse(readFileSync(join(REPO, 'contracts', 'technique-tags.json'), 'utf8')).tags.map(
    (t) => t.key,
  ),
);

// --- reading ---------------------------------------------------------------------------

const rels = readdirSync(ROOT, { recursive: true })
  .map(String)
  .filter((rel) => rel.endsWith('.json'))
  .sort((a, b) => a.localeCompare(b));

const tree = new Map(rels.map((rel) => [rel, JSON.parse(readFileSync(join(ROOT, rel), 'utf8'))]));

const posix = (rel) => rel.split('\\').join('/');
const narratives = [...tree].filter(([rel]) => posix(rel).startsWith('narratives/'));
const feeds = [...tree].filter(([rel]) => posix(rel).endsWith('/feed.json'));
const sources = tree.get('sources.json') ?? [];
const problems = [];
const fail = (rel, message) => problems.push(`${rel}: ${message}`);

// --- the mechanical fields --------------------------------------------------------------

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

/** Every el_id declared anywhere in a narrative. */
function declaredEls(node, into = new Set()) {
  if (Array.isArray(node)) {
    for (const item of node) declaredEls(item, into);
    return into;
  }
  if (node === null || typeof node !== 'object') return into;
  for (const [k, v] of Object.entries(node)) {
    if (k === 'el_id' && typeof v === 'string') into.add(v);
    else declaredEls(v, into);
  }
  return into;
}

for (const [, artifact] of narratives) {
  artifact.counts = deriveCounts(artifact.panels);
  artifact.provenance.source_count = referencedSources(artifact).size;
  const token = gateToken(artifact);
  artifact.manifest.gates.symmetry.token = token;
  artifact.manifest.gates.fidelity.token = token;
}

// --- the audit ---------------------------------------------------------------------------

const EM_DASH = '\u2014';
const EMOJI = /\p{Extended_Pictographic}/u;

function walkStrings(node, path, visit) {
  if (Array.isArray(node)) {
    node.forEach((v, i) => walkStrings(v, `${path}[${i}]`, visit));
    return;
  }
  if (node !== null && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) walkStrings(v, path === '' ? k : `${path}.${k}`, visit);
    return;
  }
  if (typeof node === 'string') visit(path, node);
}

for (const [rel, artifact] of tree) {
  walkStrings(artifact, '', (path, text) => {
    if (text.includes(EM_DASH)) fail(rel, `em dash at ${path}`);
    if (EMOJI.test(text)) fail(rel, `emoji at ${path}`);
  });
}

// Every object-rooted artifact is quarantined by the flag; the array-rooted registry cannot
// carry one and is quarantined by living in this directory (check 7 plus the import scan).
for (const [rel, artifact] of tree) {
  if (Array.isArray(artifact)) {
    if (posix(rel) !== 'sources.json') fail(rel, 'array-rooted artifact that is not the registry');
  } else if (artifact.seed !== true) {
    fail(rel, 'object-rooted seed artifact without "seed": true');
  }
}

const sourceIds = new Set(sources.map((s) => s.id));
for (const s of sources) {
  if (s.liveness === 'unverified' && (s.notes ?? '').trim() === '') {
    fail('sources.json', `source "${s.id}" is unverified with no note`);
  }
}

const narrativeIds = new Set(narratives.map(([, n]) => n.id));

for (const [rel, artifact] of tree) {
  for (const id of referencedSources(artifact)) {
    if (!sourceIds.has(id)) fail(rel, `source reference "${id}" does not resolve`);
  }
}

for (const [rel, n] of narratives) {
  if (n.panels[0]?.type !== 'claim_map') fail(rel, 'panels[0] is not claim_map');
  if (n.sparring.questions.length !== 3) fail(rel, 'sparring is not exactly 3 questions');
  for (const tag of n.tags) if (!TAG_KEYS.has(tag)) fail(rel, `tag "${tag}" is not a locked technique tag`);

  const els = declaredEls(n);
  const panelEls = n.panels.map((p) => p.el_id);
  if (n.echo !== null) panelEls.push(n.echo.el_id);
  for (const lang of ['en', 'id']) {
    const covered = new Set();
    for (const s of n.narration[lang].sentences) {
      for (const el of s.els) {
        if (!els.has(el)) fail(rel, `narration.${lang} sentence ${s.id} points at undeclared el_id "${el}"`);
        covered.add(el);
      }
    }
    for (const el of panelEls) {
      if (!covered.has(el)) fail(rel, `panel "${el}" has no ${lang} narration sentence`);
    }
  }
  for (const gate of ['symmetry', 'fidelity']) {
    if (n.manifest.gates[gate].token !== gateToken(n)) fail(rel, `gate ${gate} token does not verify`);
  }
}

for (const [rel, feed] of feeds) {
  const heroes = feed.items.filter((i) => i.slot === 'hero').length;
  if (heroes !== 1) fail(rel, `${heroes} hero items, and check 10 demands exactly 1 per pack feed`);
  for (const item of feed.items) {
    if (!narrativeIds.has(item.narrative_id)) fail(rel, `item "${item.narrative_id}" resolves to no narrative`);
    if (item.narrative_id === 'ppn-panic' && item.via_dissect !== true) {
      fail(rel, 'ppn-panic must carry via_dissect true');
    }
  }
}

const index = tree.get('url_index.json');
const fresh = index.entries.filter((e) => e.role === 'fresh_demo').length;
if (fresh !== 1) fail('url_index.json', `${fresh} fresh_demo entries, and exactly 1 is required`);
for (const e of index.entries) {
  if (!narrativeIds.has(e.narrative_id)) fail('url_index.json', `entry points at absent narrative "${e.narrative_id}"`);
}

const caseIds = new Set(tree.get('case_library.json').cases.map((c) => c.id));
for (const [rel, n] of narratives) {
  if (n.echo !== null && !caseIds.has(n.echo.historical.case_id)) {
    fail(rel, `echo cites case "${n.echo.historical.case_id}", which the case library does not carry`);
  }
}

// --- writing ------------------------------------------------------------------------------

if (problems.length > 0) {
  console.error(`seed root is not clean, ${problems.length} problem(s), nothing written:`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}

for (const [rel, artifact] of tree) {
  writeFileSync(join(ROOT, rel), `${JSON.stringify(artifact, null, 2)}\n`);
}

console.log(
  `stamped ${narratives.length} narrative(s), wrote ${tree.size} artifact(s) under ${ROOT},` +
    ` ${sourceIds.size} registry entries, audit clean.`,
);
