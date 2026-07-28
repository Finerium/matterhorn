/**
 * Seed fixture loader shared by the Gate 2 renderer specs. Not a spec itself, so it proves
 * no AC on its own; it exists so four spec files do not each re-implement the same four
 * lines of disk reading.
 *
 * Reads tests/fixtures/seed at test time from disk, never by static import, which is the
 * same discipline the harness follows at run time and which keeps the seed root outside the
 * app import graph (validator check 7, exercised by quarantine.spec.ts).
 *
 * Post-install home of every file in this directory is tests/unit/renderers/, which is what
 * the ../../../ specifiers below are counted from. Fixture paths resolve from process.cwd(),
 * which vitest sets to the repo root.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Narrative, Panel, Source, Value } from '../../../contracts/types';

export const SEED_ROOT = join(process.cwd(), 'tests', 'fixtures', 'seed');

/** A source id no registry declares. Feeding it to resolveSource is the orphan case. */
export const UNKNOWN_SOURCE_ID = 'zz-no-such-source';

function read<T>(...rel: string[]): T {
  return JSON.parse(readFileSync(join(SEED_ROOT, ...rel), 'utf8')) as T;
}

export const seedSources = (): Source[] => read<Source[]>('sources.json');
export const seedNarrative = (id: string): Narrative => read<Narrative>('narratives', `${id}.json`);

/** The one panel of `type`. Throws loudly when the fixture stops carrying it. */
export function seedPanel<T extends Panel>(narrative: Narrative, type: T['type']): T {
  const found = narrative.panels.find((p) => p.type === type);
  if (found === undefined) throw new Error(`seed narrative ${narrative.id} carries no ${type} panel`);
  return found as T;
}

/** Narrows an optional fixture Value, failing here rather than at an opaque render error. */
export function requireValue(value: Value | undefined, where: string): Value {
  if (value === undefined) throw new Error(`seed fixture carries no Value at ${where}`);
  return value;
}

/**
 * Rewrites the FIRST source reference reachable in a deep clone of `node` (a `source_id`
 * string, or the first entry of a `citations` array), walking depth first in declaration
 * order, to an id no registry resolves.
 *
 * Exactly one reference, on purpose: a renderer that resolves every id it draws will fail on
 * any single orphan, and mutating one proves the renderer reaches that reference rather than
 * counting references. Throws when the subtree holds no source reference at all, so a fixture
 * reshape fails here instead of quietly turning an orphan test into a tautology.
 */
export function withOneOrphan<T>(node: T): T {
  const copy = structuredClone(node);
  if (!rewriteFirstRef(copy)) throw new Error('the fixture subtree carries no source reference to orphan');
  return copy;
}

function rewriteFirstRef(node: unknown): boolean {
  if (Array.isArray(node)) return node.some((item) => rewriteFirstRef(item));
  if (typeof node !== 'object' || node === null) return false;
  const obj = node as Record<string, unknown>;
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'source_id' && typeof value === 'string') {
      obj[key] = UNKNOWN_SOURCE_ID;
      return true;
    }
    if (key === 'citations' && Array.isArray(value) && typeof value[0] === 'string') {
      value[0] = UNKNOWN_SOURCE_ID;
      return true;
    }
    if (rewriteFirstRef(value)) return true;
  }
  return false;
}
