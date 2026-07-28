#!/usr/bin/env node
/**
 * Fix-loop fixture builder and gate-token stamper.
 *
 *   node staging/fixtures-fix/generate-fix-tokens.mjs
 *
 * Builds the fixture roots that pin the five holes a reviewer found in the Gate 1 validator,
 * plus one positive control, under staging/fixtures-fix/validator-fix/. Deterministic and
 * idempotent: rerun it after editing any mutation and the whole tree plus every token is
 * rebuilt in place.
 *
 * This is the machinery of tests/fixtures/validator/generate-tokens.mjs, copied verbatim
 * (canonical, gateToken, deriveCounts, referencedSources, declaredEls, the style audit, the
 * good-root audit, stampTokens, writeTree, build, the VARIANTS table). The one thing it does
 * NOT copy is the thousand lines of literal fixture data: the shared GOOD root already exists
 * on disk, so this script READS it instead of re-deriving it.
 *
 * ponytail: read the good root, do not duplicate the builder that writes it. A second copy of
 * that data is a second source of truth and it drifts the first time somebody edits one of
 * them. Ceiling: this script is now coupled to the good root's bytes, so if the good root is
 * ever regenerated these fixtures must be regenerated too. The base audit below catches that
 * loudly rather than silently, because it re-verifies the good root's own gate tokens with
 * the same recipe before any mutation runs.
 *
 * Gate token (blueprint 6.11 check 6): sha256 hex over the canonical artifact bytes with
 * `manifest.gates` set to null, object keys sorted recursively, JSON.stringify with no added
 * whitespace. Both gate tokens carry that same hash.
 *
 * Variant ordering matters: every variant here mutates the tree BEFORE stamping, so the only
 * check it trips is its own. None of these five is a manifest failure.
 *
 * This script only ever WRITES under staging/fixtures-fix/. It reads tests/ and never touches it.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';

const ROOT = import.meta.dirname; // staging/fixtures-fix
const REPO = join(ROOT, '..', '..');
const GOOD = join(REPO, 'tests', 'fixtures', 'validator', 'good');
/** Everything this script writes lands under ROOT/OUT. Nothing else is written anywhere. */
const OUT = 'validator-fix';

// --- helpers (copied from tests/fixtures/validator/generate-tokens.mjs) ------------------

/** Recursively key-sorted copy. Arrays keep their order. */
function canonical(v) {
  if (Array.isArray(v)) return v.map(canonical);
  if (v !== null && typeof v === 'object') {
    return Object.fromEntries(
      Object.keys(v)
        .sort()
        .map((k) => [k, canonical(v[k])]),
    );
  }
  return v;
}

function gateToken(narrative) {
  const bytes = JSON.stringify(
    canonical({ ...narrative, manifest: { ...narrative.manifest, gates: null } }),
  );
  return createHash('sha256').update(bytes).digest('hex');
}

/** DerivedCounts per 6.5, plus the CF-1 additive optional `conflicts`. Never authored. */
function deriveCounts(panels) {
  const cm = panels.find((p) => p.type === 'claim_map');
  const status = (s) => cm.edges.filter((e) => e.status === s).length;
  const counts = {
    missing: status('missing'),
    unsourced: status('unsourced') + cm.hidden.filter((h) => h.ev === undefined).length,
    disputed: status('disputed'),
    supported: status('supported'),
    hidden: cm.hidden.length,
  };
  const duel = panels.find((p) => p.type === 'dueling');
  if (duel !== undefined) counts.conflicts = duel.counts.length;
  return counts;
}

/** Every source id a subtree references, through `source_id` keys and `citations` arrays. */
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

// --- the shared GOOD root, read rather than rebuilt --------------------------------------

/** The good content root as a path to artifact map, keys POSIX-style like the original. */
function goodTree() {
  const tree = {};
  for (const entry of readdirSync(GOOD, { recursive: true })) {
    const rel = String(entry);
    if (!rel.endsWith('.json')) continue;
    tree[rel.split(sep).join('/')] = JSON.parse(readFileSync(join(GOOD, rel), 'utf8'));
  }
  return tree;
}

// --- style audit of the good roots (copied) ----------------------------------------------

const EN_VERDICT = [
  'hoax',
  'false',
  'fake',
  'true',
  'debunked',
  'misleading',
  'disinformation',
  'lie',
  'liar',
  'busted',
];
const ID_VERDICT = [
  'hoaks',
  'bohong',
  'palsu',
  'benar',
  'salah',
  'sesat',
  'menyesatkan',
  'terbukti',
  'dusta',
];
const FUTURE_HARM = ['will cause', 'will lead to', 'akan menyebabkan', 'akan memicu', 'bakal'];
const EM_DASH = '—';
const EMOJI = /\p{Extended_Pictographic}/u;

function auditStrings(tree, label, problems) {
  const walk = (node, path) => {
    if (Array.isArray(node)) {
      node.forEach((v, i) => walk(v, `${path}[${i}]`));
      return;
    }
    if (node !== null && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) walk(v, `${path}.${k}`);
      return;
    }
    if (typeof node !== 'string') return;
    const lower = node.toLowerCase();
    for (const w of [...EN_VERDICT, ...ID_VERDICT]) {
      if (new RegExp(`\\b${w}\\b`, 'i').test(lower)) problems.push(`${label} ${path}: verdict word "${w}"`);
    }
    for (const p of FUTURE_HARM) {
      if (lower.includes(p)) problems.push(`${label} ${path}: future tense harm "${p}"`);
    }
    if (node.includes(EM_DASH)) problems.push(`${label} ${path}: em dash`);
    if (EMOJI.test(node)) problems.push(`${label} ${path}: emoji`);
  };
  walk(tree, '');
}

/**
 * Cross checks a good root against the invariants the validator asserts.
 *
 * Note the panel-element rule: `echo` at the artifact root and an echo panel inside `panels[]`
 * are both legal per 6.3, and both must be narrated. This walks whichever placement it finds,
 * which is what lets the positive control root be audited at all.
 */
function auditGood(tree, label) {
  const problems = [];
  auditStrings(tree, label, problems);

  const sourceIds = new Set(tree['sources.json'].map((s) => s.id));
  const narrativeIds = new Set();
  for (const [path, artifact] of Object.entries(tree)) {
    if (!path.startsWith('narratives/')) continue;
    narrativeIds.add(artifact.id);

    for (const sid of referencedSources(artifact)) {
      if (!sourceIds.has(sid)) problems.push(`${label} ${path}: unresolved source ${sid}`);
    }
    const recomputed = deriveCounts(artifact.panels);
    if (JSON.stringify(recomputed) !== JSON.stringify(artifact.counts)) {
      problems.push(`${label} ${path}: counts drift ${JSON.stringify(artifact.counts)}`);
    }
    if (artifact.panels[0].type !== 'claim_map') problems.push(`${label} ${path}: claim_map not first`);
    if (artifact.provenance.source_count !== referencedSources(artifact).size) {
      problems.push(`${label} ${path}: source_count drift`);
    }

    const els = declaredEls(artifact);
    const covered = { en: new Set(), id: new Set() };
    for (const lang of ['en', 'id']) {
      for (const s of artifact.narration[lang].sentences) {
        for (const el of s.els) {
          if (!els.has(el)) problems.push(`${label} ${path}: sentence ${s.id} points at ${el}`);
          covered[lang].add(el);
        }
      }
    }
    const panelEls = artifact.panels.map((p) => p.el_id);
    if (artifact.echo !== null) panelEls.push(artifact.echo.el_id);
    for (const lang of ['en', 'id']) {
      for (const el of panelEls) {
        if (!covered[lang].has(el)) problems.push(`${label} ${path}: panel ${el} has no ${lang} sentence`);
      }
    }
    const expected = gateToken(artifact);
    for (const gate of ['symmetry', 'fidelity']) {
      if (artifact.manifest.gates[gate].token !== expected) {
        problems.push(`${label} ${path}: gate ${gate} token does not verify`);
      }
    }
  }

  for (const c of tree['case_library.json'].cases) {
    for (const cid of c.citations) {
      if (!sourceIds.has(cid)) problems.push(`${label} case_library.json: unresolved citation ${cid}`);
    }
  }
  for (const path of ['packs/id/feed.json', 'packs/en/feed.json']) {
    const feed = tree[path];
    const heroes = feed.items.filter((i) => i.slot === 'hero').length;
    if (heroes !== 1) problems.push(`${label} ${path}: ${heroes} heroes`);
    for (const item of feed.items) {
      if (!narrativeIds.has(item.narrative_id)) {
        problems.push(`${label} ${path}: unresolved item ${item.narrative_id}`);
      }
      if (item.narrative_id === 'ppn-panic' && item.via_dissect !== true) {
        problems.push(`${label} ${path}: ppn-panic without via_dissect`);
      }
    }
  }
  const fresh = tree['url_index.json'].entries.filter((e) => e.role === 'fresh_demo').length;
  if (fresh !== 1) problems.push(`${label} url_index.json: ${fresh} fresh_demo entries`);
  for (const e of tree['url_index.json'].entries) {
    if (!narrativeIds.has(e.narrative_id)) {
      problems.push(`${label} url_index.json: unresolved narrative ${e.narrative_id}`);
    }
    if (e.match === 'regex') {
      try {
        new RegExp(e.pattern);
      } catch {
        problems.push(`${label} url_index.json: pattern "${e.pattern}" does not compile`);
      }
    }
  }
  for (const s of tree['sources.json']) {
    if (s.liveness !== 'live' && (s.notes ?? '').trim() === '') {
      problems.push(`${label} sources.json: source ${s.id} is ${s.liveness} with no note`);
    }
  }
  return problems;
}

// --- writing (copied) ---------------------------------------------------------------------

function stampTokens(tree) {
  for (const [path, artifact] of Object.entries(tree)) {
    if (!path.startsWith('narratives/')) continue;
    const token = gateToken(artifact);
    artifact.manifest.gates.symmetry.token = token;
    artifact.manifest.gates.fidelity.token = token;
  }
}

function writeTree(dir, tree) {
  // ponytail: overwrite in place, no wipe first. This repo lives under a synced Documents
  // folder and a delete-then-recreate cycle makes the sync daemon leave "name 2.json"
  // duplicates behind, which then land in the fixture roots as extra artifacts. Overwriting
  // is idempotent because the tree shape is fixed. Ceiling: a removed artifact would linger,
  // so delete it by hand if the fixture set ever shrinks.
  for (const [path, artifact] of Object.entries(tree)) {
    const full = join(ROOT, dir, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, `${JSON.stringify(artifact, null, 2)}\n`);
  }
}

/** `mutate` runs before stamping, which is what isolates each root to a single check. */
function build({ dir, mutate, audit = false }) {
  const tree = goodTree();
  if (mutate) mutate(tree);
  stampTokens(tree);
  if (audit) {
    const problems = auditGood(tree, dir);
    if (problems.length > 0) {
      console.error(`good fixture ${dir} is not clean:`);
      for (const p of problems) console.error(`  ${p}`);
      process.exitCode = 1;
    }
  }
  writeTree(join(OUT, dir), tree);
  return tree;
}

const nar = (tree, id) => tree[`narratives/${id}.json`];

/**
 * Blueprint 6.3 lets an echo panel live in `panels[]` as one member of the Panel union, with
 * the artifact-root `echo` field null. Narration keeps pointing at the same el_id either way,
 * so this relocation changes nothing a reader sees and nothing the other nine checks measure.
 * It is the exact placement the lexicon's future_harm scope forgets about.
 */
function moveEchoIntoPanels(n) {
  const echo = n.echo;
  n.panels.push(echo);
  n.echo = null;
  // Derived fields, recomputed so the root is self consistent by construction. Both are
  // unchanged by the move: an echo panel feeds no count, and its citations were already
  // reachable from the artifact root.
  n.counts = deriveCounts(n.panels);
  n.provenance.source_count = referencedSources(n).size;
  return echo;
}

const VARIANTS = [
  // POSITIVE CONTROL. Legal 6.3 placement, clean past-tense outcome text. Passes today and
  // must still pass after the future_harm scope learns about panels[]. This root is the whole
  // guard against a fix that just greps every string in the tree for "will cause".
  {
    dir: 'lexicon/good-echo-in-panels',
    audit: true,
    mutate: (t) => {
      moveEchoIntoPanels(nar(t, 'ppn-panic'));
    },
  },

  // HOLE 1 lexicon: future-tense harm in an echo panel that sits in panels[]. The 6.9 scope
  // is ["echo.historical.outcome", "cases.documented_outcome"] and the walker's path for this
  // placement reads "panels.historical.outcome.en", which matches neither.
  {
    dir: 'lexicon/bad-future-harm-in-panels',
    mutate: (t) => {
      const echo = moveEchoIntoPanels(nar(t, 'ppn-panic'));
      echo.historical.outcome.en =
        'The same framing will cause shortages in the districts that depend on the line.';
    },
  },

  // HOLE 2 schema: an unknown property on a narrative root. narrative.schema.json leaves the
  // root open, so a typo, a leaked scratch field, or a stray operator note ships silently.
  {
    dir: 'schema/bad-extra-root-key',
    mutate: (t) => {
      nar(t, 'tariffs-pay').internal_scratch = { reviewer: 'x' };
    },
  },

  // HOLE 3 url-index: match "regex" with a pattern that does not compile. Check 8 resolves
  // narrative ids and counts fresh_demo entries but never asks whether the regex is a regex,
  // so the router blows up at request time instead of at Gate 1.
  {
    dir: 'url-index/bad-invalid-regex',
    mutate: (t) => {
      const entry = t['url_index.json'].entries.find((e) => e.role === 'fresh_demo');
      entry.match = 'regex';
      entry.pattern = '[unterminated';
    },
  },

  // HOLE 4 liveness: liveness "unverified" with no notes at all. Check 9 only reads notes for
  // a recorded status code, so a source nobody could verify passes with an empty record.
  {
    dir: 'liveness/bad-unverified-no-note',
    mutate: (t) => {
      const source = t['sources.json'].find((s) => s.id === 'id-agency-budget-2026');
      source.liveness = 'unverified';
      delete source.notes;
    },
  },
];

// The base audit runs the good root through the same invariants before any mutation. It
// proves this script's loader and token recipe still match the ones that wrote that root, so
// a failure here means the good root moved and these fixtures need regenerating, not that a
// mutation is wrong.
const baseProblems = auditGood(goodTree(), 'tests/fixtures/validator/good');
if (baseProblems.length > 0) {
  console.error('the shared good root failed the base audit, so every fix fixture is suspect:');
  for (const p of baseProblems) console.error(`  ${p}`);
  process.exitCode = 1;
}

for (const variant of VARIANTS) build(variant);

console.log(`wrote ${VARIANTS.length} fixture roots under ${join(ROOT, OUT)}`);
if (process.exitCode === 1) console.error('one or more good fixtures failed the self audit');
