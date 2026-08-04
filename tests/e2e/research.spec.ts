/**
 * PROVES: blueprint 3.2 item 18 (the research surface: archive table with filters, the full
 *         interactive constellation, the narrative detail rail, CSV and JSON export of graph
 *         data), blueprint 4.3 (the /research breakpoints at 1024 and 768), and the four
 *         Appendix A desktop rows `research.default`, `research.filtered`,
 *         `research.detail-rail` and `research.export` behaviourally.
 *         AC-APP-22 rides along through guardConsole().
 *
 * Post-install home: tests/e2e/research.spec.ts. Config: tests/e2e/research.config.ts, which
 * builds, stages the REAL published root into the dist, and previews it. That is deliberate and
 * it is what makes this file different from every other e2e in the repo: the expectations below
 * are not transcribed strings, they are computed from content/ read off disk at collection time.
 * A narrative added, retitled, re-leaned or re-dated changes both sides of every assertion at
 * once, so this suite cannot go stale, and it cannot pass against fixtures pretending to be
 * published work (the reviewer's standing gap: no e2e exercises generated content).
 *
 * Hooks this spec pins. The state matrix already fixed three of them (`research-table`,
 * `research-rail`, `research-export`); the rest are this file's contract to the surface, and
 * they fail RED until the surface exists, which is the Gate 3 house rule for writing the spec
 * before the screen.
 *
 *   table        [data-testid=research-table], [data-testid=research-row] carrying
 *                [data-narrative="{id}"]
 *   filters      [data-testid=research-filter-pack] and [data-testid=research-filter-lean] as
 *                <select> (native control, keyboard-reachable for free, values `all` plus the
 *                contract's own `id`/`en` and `gov`/`neutral`/`opp`),
 *                [data-testid=research-search], [data-testid=research-date-from] as
 *                <input type="date">. `?tag=` is a URL filter, per the matrix row.
 *   graph        [data-testid=research-constellation]
 *   rail         [data-testid=research-rail] containing a link to /n/{id},
 *                [data-testid=rail-velocity], [data-testid=rail-lean]. The echo half reuses the
 *                renderer's own [data-echo="cited"|"silence"] rather than inventing a third
 *                name for a state that already has one.
 *   export       [data-testid=research-export] containing [data-testid=export-csv] and
 *                [data-testid=export-json]
 *   below 768    [data-testid=research-redirect] containing a link to /app, and
 *                [data-testid=research-continue]
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test, type Locator, type Page } from '@playwright/test';

import type { CaseLibrary, Constellation, Feed, Narrative } from '../../contracts/types';
import { guardConsole } from './console-collector';
import { guardNetwork } from './net-collector';

guardConsole();
guardNetwork();

// --- what is published, read from disk -----------------------------------------------------

const CONTENT = fileURLToPath(new URL('../../content', import.meta.url));
const read = <T,>(relative: string): T => JSON.parse(readFileSync(join(CONTENT, relative), 'utf8')) as T;

const GRAPH = read<Constellation>('constellation.json');
const CASES = read<CaseLibrary>('case_library.json');
/** The archive is both pack feeds, which is what the in-app Archive tab already means by it. */
const PUBLISHED: Narrative[] = (['id', 'en'] as const)
  .flatMap((pack) => read<Feed>(`packs/${pack}/feed.json`).items)
  .map((item) => read<Narrative>(`narratives/${item.narrative_id}.json`));

const byId = new Map(PUBLISHED.map((narrative) => [narrative.id, narrative]));
const sorted = (ids: string[]): string[] => [...ids].sort();
const idsOf = (narratives: Narrative[]): string[] => sorted(narratives.map((narrative) => narrative.id));

/** The surface speaks EN by default (routes read `mth:lang`, and nothing has written it). */
const shown = (narrative: Narrative): string => narrative.headline.en;

/**
 * The search rule the Archive tab already ships: the rendered headline plus the outlet, folded
 * to lower case. Stated once here so the expectation and the surface cannot drift apart in
 * different directions.
 */
const matches = (narrative: Narrative, query: string): boolean =>
  `${shown(narrative)} ${narrative.outlet}`.toLowerCase().includes(query.toLowerCase());

// --- helpers -------------------------------------------------------------------------------

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function boxOf(locator: Locator, what: string): Promise<Box> {
  const at = await locator.boundingBox();
  if (at === null) throw new Error(`${what} has no box: it is not rendered`);
  return at;
}

/** Two boxes are beside each other: their columns do not overlap and their rows do. */
const beside = (a: Box, b: Box): boolean =>
  (a.x + a.width <= b.x + 1 || b.x + b.width <= a.x + 1) && a.y < b.y + b.height && b.y < a.y + a.height;

/** `a` is stacked above `b`: `a` ends before `b` starts, and they share the same column. */
const above = (a: Box, b: Box): boolean =>
  a.y + a.height <= b.y + 1 && a.x < b.x + b.width && b.x < a.x + a.width;

/** The narrative ids the table is showing, in no particular order. */
async function tableIds(page: Page): Promise<string[]> {
  const ids = await page
    .getByTestId('research-row')
    .evaluateAll((rows) => rows.map((row) => row.getAttribute('data-narrative') ?? ''));
  return sorted(ids);
}

/** Opens /research and waits for the table, so every test starts from a drawn surface. */
async function openResearch(page: Page, query = ''): Promise<void> {
  await page.goto(`/research${query}`);
  await expect(page.getByTestId('research-table')).toBeVisible();
}

interface Downloaded {
  name: string;
  body: string;
}

async function download(page: Page, trigger: Locator): Promise<Downloaded> {
  const [file] = await Promise.all([page.waitForEvent('download'), trigger.click()]);
  const path = await file.path();
  expect(path, 'the export produced a file on disk').toBeTruthy();
  return { name: file.suggestedFilename(), body: readFileSync(String(path), 'utf8') };
}

/**
 * RFC 4180, the half a real export needs: quoted fields, doubled quotes inside them, CRLF or LF.
 * A split on commas would be wrong on the first row it read, because published headlines carry
 * commas ("BGN Chief: MBG Poisoning Victims Reach 6,517").
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === undefined) break;
    if (quoted) {
      if (char !== '"') field += char;
      else if (text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') field += char;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** A CSV as records keyed by header name, so a column order is not part of the contract. */
function records(text: string): Array<Record<string, string>> {
  const rows = parseCsv(text.trim());
  const [header, ...body] = rows;
  if (header === undefined) throw new Error('the CSV export is empty');
  return body.map((row) => Object.fromEntries(header.map((name, at) => [name, row[at] ?? ''])));
}

/** Every number an element paints, in the order it paints them. */
const numbers = (text: string): number[] =>
  (text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((raw) => Number(raw.replace(',', '.')));

/** True when `run` appears in `painted` as consecutive values, wherever a preamble ends. */
const containsRun = (painted: number[], run: number[]): boolean =>
  painted.some((_, at) => run.every((value, offset) => painted[at + offset] === value));

/**
 * Blueprint 4.1.5, house rule: every rendered statistic uses tabular numerals. Checked on the
 * elements that actually paint a digit rather than on their container, because inheriting the
 * property is what the rule is about and a wrapper with no digits proves nothing.
 */
const tabular = (root: Locator): Promise<boolean> =>
  root.evaluate((element) => {
    const painters = [...element.querySelectorAll<HTMLElement>('*')].filter((node) =>
      [...node.childNodes].some((child) => child.nodeType === 3 && /\d/.test(child.textContent ?? '')),
    );
    const scope = painters.length > 0 ? painters : [element as HTMLElement];
    return scope.every((node) => getComputedStyle(node).fontVariantNumeric.includes('tabular-nums'));
  });

// --- the surface at 1024 and above ----------------------------------------------------------

test.describe('blueprint 3.2 item 18, the research surface', () => {
  test('research.default: the table lists every published narrative', async ({ page }) => {
    await openResearch(page);
    expect(PUBLISHED.length, 'the published archive is not empty').toBeGreaterThan(0);
    expect(await tableIds(page), 'the table is the two pack feeds').toEqual(idsOf(PUBLISHED));

    // The row is the researcher's index entry: the headline it renders and the outlet it came
    // from, both read from the artifact rather than transcribed here.
    const first = PUBLISHED[0];
    if (first === undefined) throw new Error('no published narratives to assert against');
    const row = page.locator(`[data-testid="research-row"][data-narrative="${first.id}"]`);
    await expect(row).toContainText(shown(first));
    await expect(row).toContainText(first.outlet);
  });

  test('the constellation draws the published graph', async ({ page }) => {
    await openResearch(page);
    const graph = page.getByTestId('research-constellation');
    await expect(graph).toBeVisible();

    // Every published node reaches the screen, by its own label. Ten labels is a cheap exact
    // check; the 500-node case is AC-PERF-4's, not this one's.
    for (const node of GRAPH.nodes) {
      await expect(graph, `the constellation is missing ${node.id}`).toContainText(node.label.en);
    }
    const edges = await graph.locator('line, path').count();
    expect(edges, `the graph draws its ${String(GRAPH.links.length)} links`).toBeGreaterThanOrEqual(
      GRAPH.links.length,
    );
  });

  test('the pack filter narrows the table to one pack', async ({ page }) => {
    await openResearch(page);
    for (const pack of ['id', 'en'] as const) {
      await page.getByTestId('research-filter-pack').selectOption(pack);
      const expected = idsOf(PUBLISHED.filter((narrative) => narrative.pack === pack));
      expect(expected.length, `pack ${pack} is not empty in published content`).toBeGreaterThan(0);
      await expect
        .poll(() => tableIds(page), { message: `pack ${pack}` })
        .toEqual(expected);
    }
    await page.getByTestId('research-filter-pack').selectOption('all');
    await expect.poll(() => tableIds(page), { message: 'the filter clears' }).toEqual(idsOf(PUBLISHED));
  });

  test('the lean filter narrows the table to one lean', async ({ page }) => {
    await openResearch(page);
    for (const lean of ['gov', 'neutral', 'opp'] as const) {
      await page.getByTestId('research-filter-lean').selectOption(lean);
      const expected = idsOf(PUBLISHED.filter((narrative) => narrative.lean === lean));
      expect(expected.length, `lean ${lean} is not empty in published content`).toBeGreaterThan(0);
      await expect.poll(() => tableIds(page), { message: `lean ${lean}` }).toEqual(expected);
    }
  });

  test('topic search narrows the table to what it matches', async ({ page }) => {
    await openResearch(page);
    const query = 'MBG';
    const expected = idsOf(PUBLISHED.filter((narrative) => matches(narrative, query)));
    expect(expected.length, 'the query matches some published narratives').toBeGreaterThan(0);
    expect(expected.length, 'and not all of them, or the filter proves nothing').toBeLessThan(PUBLISHED.length);

    await page.getByTestId('research-search').fill(query);
    await expect.poll(() => tableIds(page), { message: `search ${query}` }).toEqual(expected);

    await page.getByTestId('research-search').fill('zzzz-no-such-topic');
    await expect.poll(() => tableIds(page), { message: 'a query that matches nothing' }).toEqual([]);
  });

  test('the date filter narrows the table by published_date', async ({ page }) => {
    await openResearch(page);
    // 2026-01-01 rather than a computed median on purpose: one published narrative carries the
    // month-precision date "2025-08", and a threshold inside that month would be asserting a
    // resolution the content does not have. This one splits the archive cleanly.
    const from = '2026-01-01';
    const expected = idsOf(PUBLISHED.filter((narrative) => narrative.published_date >= from));
    expect(expected.length, 'the threshold splits the archive').toBeGreaterThan(0);
    expect(expected.length, 'the threshold splits the archive').toBeLessThan(PUBLISHED.length);

    await page.getByTestId('research-date-from').fill(from);
    await expect.poll(() => tableIds(page), { message: `published on or after ${from}` }).toEqual(expected);
  });

  test('research.filtered: ?tag= filters by technique tag', async ({ page }) => {
    const tag = 'missing-link';
    const expected = idsOf(PUBLISHED.filter((narrative) => narrative.tags.includes(tag)));
    expect(expected.length, `${tag} is carried by some published narratives`).toBeGreaterThan(0);
    expect(expected.length, 'and not by all of them').toBeLessThan(PUBLISHED.length);

    await openResearch(page, `?tag=${tag}`);
    expect(await tableIds(page), `?tag=${tag}`).toEqual(expected);
  });

  test('research.detail-rail: a row opens the rail, and ?id= opens it directly', async ({ page }) => {
    await openResearch(page);
    const target = byId.get('mbg-stop');
    if (target === undefined) throw new Error('mbg-stop is not published');

    await page.locator('[data-testid="research-row"][data-narrative="mbg-stop"]').click();
    const rail = page.getByTestId('research-rail');
    await expect(rail).toBeVisible();
    await expect(rail).toContainText(shown(target));
    // The selection is addressable, which is what makes the matrix row a URL.
    await expect.poll(() => new URL(page.url()).searchParams.get('id')).toBe('mbg-stop');

    await openResearch(page, '?id=mbg-stop');
    await expect(page.getByTestId('research-rail')).toContainText(shown(target));
  });

  test('the rail states velocity, lean spread, echoes and the permalink', async ({ page }) => {
    await openResearch(page, '?id=mbg-stop');
    const rail = page.getByTestId('research-rail');
    const target = byId.get('mbg-stop');
    if (target === undefined) throw new Error('mbg-stop is not published');

    // Velocity is how far the claim travelled: the narrative family, which is published data.
    const velocity = rail.getByTestId('rail-velocity');
    await expect(velocity).toBeVisible();
    await expect(velocity, 'velocity counts the published family members').toContainText(
      new RegExp(`\\b${String(target.family.members.length)}\\b`),
    );

    // Lean spread is the receipt for the set on screen: gov, neutral, opp, in that order, as
    // counts or as whole percentages of the same distribution. Nothing else is a spread.
    const lean = rail.getByTestId('rail-lean');
    await expect(lean).toBeVisible();
    const counts = (['gov', 'neutral', 'opp'] as const).map(
      (value) => PUBLISHED.filter((narrative) => narrative.lean === value).length,
    );
    const shares = counts.map((count) => Math.round((count / PUBLISHED.length) * 100));
    const painted = numbers((await lean.innerText()).trim());
    expect(
      containsRun(painted, counts) || containsRun(painted, shares),
      `the lean spread painted ${painted.join('/')}; published is ${counts.join('/')} as counts, ` +
        `${shares.join('/')} as percentages`,
    ).toBe(true);

    // The permalink is the artifact's address, not a copy of it.
    await expect(rail.locator('a[href="/n/mbg-stop"]')).toBeVisible();

    expect(await tabular(velocity), 'velocity uses tabular numerals').toBe(true);
    expect(await tabular(lean), 'the lean spread uses tabular numerals').toBe(true);
  });

  test('the rail carries the echo, and its silence where there is none', async ({ page }) => {
    const echoing = PUBLISHED.find((narrative) => narrative.echo !== null);
    const silent = PUBLISHED.find((narrative) => narrative.echo === null);
    if (echoing?.echo === undefined || echoing.echo === null || silent === undefined) {
      throw new Error('published content has no echo pair to assert against');
    }

    await openResearch(page, `?id=${echoing.id}`);
    const rail = page.getByTestId('research-rail');
    await expect(rail.locator('[data-echo="cited"]')).toBeVisible();
    await expect(rail).toContainText(echoing.echo.historical.motif.en);

    // The silence is a render, not an absence, and it never borrows another narrative's case.
    await openResearch(page, `?id=${silent.id}`);
    await expect(page.getByTestId('research-rail').locator('[data-echo="silence"]')).toBeVisible();
    for (const entry of CASES.cases) {
      await expect(page.getByTestId('research-rail'), `${silent.id} has no echo to borrow`).not.toContainText(
        entry.title.en,
      );
    }
  });

  test('the table is operable from the keyboard', async ({ page }) => {
    // Blueprint 4.2.6: every interactive element on a desktop surface is keyboard-reachable.
    await openResearch(page);
    const row = page.locator('[data-testid="research-row"][data-narrative="mbg-stop"]');
    await row.focus();
    await expect(row).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('research-rail')).toBeVisible();
  });
});

// --- the breakpoints -------------------------------------------------------------------------

test.describe('blueprint 4.3, the /research breakpoints', () => {
  test('at 1280 the constellation sits beside the table', async ({ page }) => {
    await openResearch(page);
    const table = await boxOf(page.getByTestId('research-table'), 'the table');
    const graph = await boxOf(page.getByTestId('research-constellation'), 'the constellation');
    expect(
      beside(graph, table),
      `at 1024 and above the surface is multi-column: table ${JSON.stringify(table)} graph ${JSON.stringify(graph)}`,
    ).toBe(true);
  });

  test.describe('between 768 and 1024', () => {
    test.use({ viewport: { width: 900, height: 900 } });

    test('it is one column with the constellation above the table', async ({ page }) => {
      await openResearch(page);
      const table = await boxOf(page.getByTestId('research-table'), 'the table');
      const graph = await boxOf(page.getByTestId('research-constellation'), 'the constellation');
      expect(
        above(graph, table),
        `single column, constellation first: table ${JSON.stringify(table)} graph ${JSON.stringify(graph)}`,
      ).toBe(true);
      await expect(page.getByTestId('research-redirect')).toHaveCount(0);
    });
  });

  test.describe('below 768', () => {
    test.use({ viewport: { width: 500, height: 900 } });

    test('it shows the redirect card, and continue anyway works', async ({ page }) => {
      await page.goto('/research');
      const card = page.getByTestId('research-redirect');
      await expect(card).toBeVisible();
      await expect(card.locator('a[href="/app"]'), 'the card points at the app').toBeVisible();
      await expect(page.getByTestId('research-table')).toBeHidden();

      await page.getByTestId('research-continue').click();
      await expect(page.getByTestId('research-table'), 'continue anyway continues').toBeVisible();
      expect(new URL(page.url()).pathname, 'and it continues here, rather than leaving').toBe('/research');
      expect(await tableIds(page), 'with the whole archive').toEqual(idsOf(PUBLISHED));
    });
  });
});

// --- export ----------------------------------------------------------------------------------

test.describe('blueprint 3.2 item 18, export CSV and JSON of graph data', () => {
  test('research.export: the affordance states what it emits', async ({ page }) => {
    await openResearch(page, '?export=1');
    const exporter = page.getByTestId('research-export');
    await expect(exporter).toBeVisible();
    await expect(exporter.getByTestId('export-csv')).toBeVisible();
    await expect(exporter.getByTestId('export-json')).toBeVisible();
  });

  test('the CSV download carries one row per published node', async ({ page }) => {
    await openResearch(page, '?export=1');
    const file = await download(page, page.getByTestId('export-csv'));
    expect(file.name, 'the download is a CSV').toMatch(/\.csv$/);

    const rows = records(file.body);
    expect(rows.length, 'a row per node of the published graph').toBe(GRAPH.nodes.length);
    for (const column of ['node_id', 'narrative_id', 'label', 'pack']) {
      expect(Object.keys(rows[0] ?? {}), `the header carries ${column}`).toContain(column);
    }

    // Every exported row is the published node it names, field by field. This is the assertion
    // the whole export test exists for: a fired download event proves nothing about content.
    const published = new Map(GRAPH.nodes.map((node) => [node.id, node]));
    for (const row of rows) {
      const node = published.get(row.node_id ?? '');
      expect(node, `the CSV exported a node that is not published: ${String(row.node_id)}`).toBeDefined();
      if (node === undefined) continue;
      expect(row.narrative_id, `${node.id} narrative_id`).toBe(node.narrative_id);
      expect(row.label, `${node.id} label`).toBe(node.label.en);
      expect(row.pack, `${node.id} pack`).toBe(node.pack);
      expect(byId.has(node.narrative_id), `${node.narrative_id} is a published narrative`).toBe(true);
    }
  });

  test('the JSON download carries the published graph', async ({ page }) => {
    await openResearch(page, '?export=1');
    const file = await download(page, page.getByTestId('export-json'));
    expect(file.name, 'the download is JSON').toMatch(/\.json$/);

    const graph = JSON.parse(file.body) as Constellation;
    expect(sorted(graph.nodes.map((node) => node.id)), 'every published node').toEqual(
      sorted(GRAPH.nodes.map((node) => node.id)),
    );
    const edge = (link: { a: string; b: string }): string => [link.a, link.b].sort().join('|');
    expect(sorted(graph.links.map(edge)), 'every published link').toEqual(sorted(GRAPH.links.map(edge)));
    for (const node of graph.nodes) {
      expect(byId.has(node.narrative_id), `${node.id} names a published narrative`).toBe(true);
      expect(node.label.en, `${node.id} carries its published label`).toBe(
        GRAPH.nodes.find((published) => published.id === node.id)?.label.en,
      );
    }
  });

  test('an export is of the view, so a filter narrows it', async ({ page }) => {
    await openResearch(page, '?export=1');
    await page.getByTestId('research-filter-pack').selectOption('en');
    const expected = idsOf(PUBLISHED.filter((narrative) => narrative.pack === 'en'));
    await expect.poll(() => tableIds(page), { message: 'the filter applied' }).toEqual(expected);

    const rows = records((await download(page, page.getByTestId('export-csv'))).body);
    const exported = sorted([...new Set(rows.map((row) => row.narrative_id ?? ''))]);
    expect(exported, 'the CSV is the filtered view, not the whole graph').toEqual(expected);
  });
});

test.describe('the desk states its rhythm honestly', () => {
  test('recorded run, device queue, the plan said as a plan, and the build version', async ({ page }) => {
    await page.goto('/research');
    const cadence = page.getByTestId('research-cadence');
    await expect(cadence).toBeVisible();
    await expect(cadence).toContainText('run-2026-07-29');
    await expect(cadence, 'the operating model is labelled a plan, never live state').toContainText('plan');
    await expect(page.getByTestId('research-queue')).toContainText(/\d/);
    await expect(page.getByTestId('research-ticker'), 'the idle murmur names the run it replays').toContainText(
      'run-2026-07-29',
    );
    await expect(page.getByTestId('research-version')).toContainText(/Build \d+\.\d+\.\d+/);
  });

  test('a queued link on this device raises the count the desk shows', async ({ page }) => {
    // The write path (an unknown URL entering mth:queue) is proven in flows.spec, which runs
    // where the paste box lives; here the desk's read of the same record is what is on trial.
    await page.addInitScript(() => {
      localStorage.setItem('mth:queue', JSON.stringify(['https://example.com/a-story-the-archive-does-not-carry']));
    });
    await page.goto('/research');
    await expect(page.getByTestId('research-queue')).toContainText('1');
  });
});
