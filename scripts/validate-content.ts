/**
 * Content validator CLI. Blueprint 6.11 check 1 (schema validity).
 *
 *   pnpm validate:content [--dir <path>]
 *
 * Validates every *.json under the content root against the JSON Schemas in
 * contracts/schemas/. Exits 1 naming the file and the failure if any artifact is
 * unparseable or violates its schema, 0 otherwise. --dir overrides the content root
 * (used by tests to point at a deliberately broken fixture); the default stays content/.
 *
 * ponytail: checks 2 to 10 of 6.11 (source resolution, derived counts, lexicon, orphan
 * numbers, ...) land at Gate 1 with the artifacts they police. The extension points are
 * FILE_SCHEMAS for new artifact shapes and one more push into `rows` for each new check.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import type { AnySchema, ValidateFunction } from 'ajv';
import Ajv2020 from 'ajv/dist/2020.js'; // the schemas declare draft 2020-12

const REPO_ROOT = resolve(import.meta.dirname, '..');
const SCHEMA_DIR = join(REPO_ROOT, 'contracts', 'schemas');
const SCHEMA_FILES = ['source.schema.json', 'value.schema.json'];

/** Filename to the schema its whole file must satisfy. Unmapped files are reported as skipped. */
const FILE_SCHEMAS: Record<string, AnySchema> = {
  'sources.json': { type: 'array', items: { $ref: 'source.schema.json' } },
};

type Status = 'pass' | 'fail' | 'skip';
interface Row {
  check: string;
  status: Status;
  detail: string;
  /** Absolute path of the artifact a failure must name. Absent for whole-run checks. */
  file?: string;
}

function parseArgs(argv: string[]): { dir: string } {
  const i = argv.indexOf('--dir');
  if (i === -1) return { dir: join(REPO_ROOT, 'content') };
  const value = argv[i + 1];
  if (value === undefined || value.startsWith('--')) {
    console.error('validate:content: --dir needs a path');
    process.exit(2);
  }
  return { dir: resolve(value) };
}

function jsonFilesIn(dir: string): string[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  return readdirSync(dir, { recursive: true })
    .map(String)
    .filter((p) => p.endsWith('.json'))
    .map((p) => join(dir, p))
    .filter((p) => statSync(p).isFile())
    .sort();
}

function formatErrors(validate: ValidateFunction): string {
  const errors = validate.errors ?? [];
  const shown = errors
    .slice(0, 5)
    .map((e) => `${e.instancePath === '' ? '(root)' : e.instancePath} ${e.message ?? 'invalid'}`);
  if (errors.length > shown.length) shown.push(`plus ${errors.length - shown.length} more`);
  return shown.join('; ');
}

/** One row, one line: JSON.parse messages arrive with newlines in them. */
const oneLine = (s: string): string => s.replace(/\s+/g, ' ').trim();

function printTable(rows: Row[]): void {
  const header: Row = { check: 'CHECK', status: 'STATUS' as Status, detail: 'DETAIL' };
  const all = [header, ...rows];
  const w = (pick: (r: Row) => string) => Math.max(...all.map((r) => pick(r).length));
  const wCheck = w((r) => r.check);
  const wStatus = w((r) => r.status);
  for (const r of all) {
    console.log(`${r.check.padEnd(wCheck)}  ${r.status.padEnd(wStatus)}  ${oneLine(r.detail)}`);
  }
}

function main(): void {
  const { dir } = parseArgs(process.argv.slice(2));
  const inRepo = relative(REPO_ROOT, dir);
  const label = `${inRepo && !inRepo.startsWith('..') ? inRepo : dir}/`;
  const files = jsonFilesIn(dir);

  // ponytail: an absent root passes by design while content/ does not exist yet. Gate 1
  // ships content, and this branch becomes a failure the moment there is something to lose.
  if (files.length === 0) {
    console.log(`${label} is absent or holds no .json files, nothing to validate.`);
    return;
  }

  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const rows: Row[] = [];

  for (const name of SCHEMA_FILES) {
    ajv.addSchema(JSON.parse(readFileSync(join(SCHEMA_DIR, name), 'utf8')) as AnySchema, name);
  }
  rows.push({
    check: 'schemas loaded',
    status: 'pass',
    detail: SCHEMA_FILES.join(', '),
  });

  for (const file of files) {
    const rel = relative(dir, file);
    let data: unknown;
    try {
      data = JSON.parse(readFileSync(file, 'utf8'));
    } catch (err) {
      rows.push({
        check: `parse ${rel}`,
        status: 'fail',
        detail: err instanceof Error ? err.message : String(err),
        file,
      });
      continue;
    }
    rows.push({ check: `parse ${rel}`, status: 'pass', detail: 'valid JSON', file });

    const schema = FILE_SCHEMAS[basename(file)];
    if (schema === undefined) {
      rows.push({
        check: `schema ${rel}`,
        status: 'skip',
        detail: 'no schema mapped to this filename yet',
        file,
      });
      continue;
    }
    const validate = ajv.compile(schema);
    const ok = validate(data);
    rows.push({
      check: `schema ${rel}`,
      status: ok ? 'pass' : 'fail',
      detail: ok ? 'conforms' : formatErrors(validate),
      file,
    });
  }

  printTable(rows);

  const failures = rows.filter((r) => r.status === 'fail');
  if (failures.length > 0) {
    console.error('');
    console.error(`FAIL: content validation failed, ${failures.length} check(s) in ${label}`);
    for (const f of failures) {
      console.error(`  ${f.file ?? label}: ${f.check}: ${oneLine(f.detail)}`);
    }
    process.exit(1);
  }
  console.log('');
  console.log(`OK: ${files.length} file(s) in ${label} pass schema validity.`);
}

main();
