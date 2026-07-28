#!/usr/bin/env node
/**
 * Fixture builder and gate-token stamper for the Gate 1 validator suite.
 *
 *   node staging/fixtures/validator/generate-tokens.mjs
 *
 * Builds one shared GOOD content root plus every per-check BAD variant, then stamps real
 * gate tokens into every narrative manifest. Deterministic and idempotent: rerun it after
 * editing any fixture datum and the whole tree plus every token is rebuilt.
 *
 * Gate token (blueprint 6.11 check 6, plan note): sha256 hex over the canonical artifact
 * bytes with `manifest.gates` set to null, object keys sorted recursively,
 * JSON.stringify with no added whitespace. Both gate tokens carry that same hash.
 *
 * Variant ordering matters: a BAD variant mutates the tree BEFORE stamping, so the only
 * check it trips is its own. The two manifest variants mutate AFTER stamping, which is
 * exactly what makes them manifest failures.
 *
 * ponytail: one script builds and stamps rather than two. It also self-audits the good
 * roots (style, counts, references, narration coverage, tokens) before writing, because a
 * fixture nobody can prove is good is not a fixture. Ceiling: the audit only knows MY
 * invariants, it is not the validator and must never grow into one.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ROOT = import.meta.dirname;

// --- helpers -------------------------------------------------------------------------

/** Localized string pair. */
const L = (en, id) => ({ en, id });

/** Value object (6.2). Every number in a good fixture rides in one of these. */
const V = (amount, unit, en, id, source_id, extra = {}) => ({
  amount,
  unit,
  display: L(en, id),
  source_id,
  ...extra,
});

const clone = (v) => structuredClone(v);

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

/** One sentence pair per panel, same sentence ids in both bundles. */
const narration = (items) => ({
  en: { sentences: items.map((it, i) => ({ id: `n-${i + 1}`, text: it.en, els: it.els })) },
  id: { sentences: items.map((it, i) => ({ id: `n-${i + 1}`, text: it.id, els: it.els })) },
});

const manifest = (runId, day) => ({
  run_id: runId,
  generated_at: `2026-07-${day}T09:00:00Z`,
  steps: [
    {
      role: 'A7',
      model: 'model-narrator',
      started_at: `2026-07-${day}T08:40:00Z`,
      finished_at: `2026-07-${day}T08:52:00Z`,
      input_hash: `hash-${runId}-a7`,
    },
    {
      role: 'A11',
      model: 'model-guard',
      started_at: `2026-07-${day}T08:53:00Z`,
      finished_at: `2026-07-${day}T08:58:00Z`,
      input_hash: `hash-${runId}-a11`,
    },
  ],
  gates: {
    symmetry: { verdict: 'pass', token: 'STAMPED_AT_BUILD' },
    fidelity: { verdict: 'pass', token: 'STAMPED_AT_BUILD' },
  },
});

const familyBlock = (skeleton, members) => ({ skeleton, members });

const sparring = (a, b, c) => ({ questions: [a, b, c] });

const question = (move, qEn, qId, options, correct, noteEn, noteId) => ({
  move,
  q: L(qEn, qId),
  options,
  correct,
  note: L(noteEn, noteId),
});

// --- 6.1 source registry --------------------------------------------------------------

const SOURCES = [
  {
    id: 'id-agency-budget-2026',
    title: 'Annual budget table for the 2026 cycle',
    publisher: 'Agency A',
    url: 'https://example.org/agency-a/budget-2026',
    retrieved_at: '2026-07-20',
    period: 'Budget 2026, enacted',
    kind: 'official',
    self_reported: false,
    liveness: 'live',
  },
  {
    id: 'id-agency-program-2026',
    title: 'Programme progress report for the 2026 cycle',
    publisher: 'Agency A',
    url: 'https://example.org/agency-a/programme-2026',
    retrieved_at: '2026-07-20',
    period: 'Jan to May 2026',
    kind: 'official',
    self_reported: true,
    liveness: 'live',
    notes: 'Institution reporting on its own programme. Figures carry the self reported flag.',
  },
  {
    id: 'id-agency-health-2026',
    title: 'District intake register for the 2025 season',
    publisher: 'Agency B',
    url: 'https://example.org/agency-b/intake-2025',
    retrieved_at: '2026-07-20',
    period: 'Jan to Oct 2025',
    kind: 'official',
    self_reported: false,
    liveness: 'live',
  },
  {
    id: 'id-monitor-network-2026',
    title: 'Independent monitoring tally for the 2025 season',
    publisher: 'Monitor Network',
    url: 'https://example.org/monitor-network/tally-2025',
    retrieved_at: '2026-07-20',
    period: 'Jan to Oct 2025',
    kind: 'ngo',
    self_reported: false,
    liveness: 'live',
  },
  {
    id: 'id-rights-commission-2019',
    title: 'Review record for the 2019 episode',
    publisher: 'Rights Commission',
    url: 'https://example.org/rights-commission/review-2019',
    retrieved_at: '2026-07-20',
    period: 'May 2019',
    kind: 'ngo',
    self_reported: false,
    liveness: 'live',
  },
  {
    id: 'id-archive-mirror-2025',
    title: 'Archived copy of the withdrawn 2025 notice',
    publisher: 'Archive Mirror',
    url: 'https://example.org/archive-mirror/notice-2025',
    retrieved_at: '2026-07-20',
    period: 'Dec 2025',
    kind: 'outlet',
    self_reported: false,
    liveness: 'dead_replaced',
    notes:
      'Original page returned status 410 at snapshot. Replaced by the archived copy recorded here, same text, same date.',
  },
  {
    id: 'en-budget-office-2026',
    title: 'Ten year revenue projection tables',
    publisher: 'Budget Office',
    url: 'https://example.org/budget-office/projection-2026',
    retrieved_at: '2026-07-20',
    period: 'Fiscal 2026 to 2035',
    kind: 'official',
    self_reported: false,
    liveness: 'live',
  },
  {
    id: 'en-revenue-service-2026',
    title: 'Monthly receipts summary',
    publisher: 'Revenue Service',
    url: 'https://example.org/revenue-service/receipts-2026',
    retrieved_at: '2026-07-20',
    period: 'Fiscal 2026, through June',
    kind: 'official',
    self_reported: false,
    liveness: 'live',
  },
  {
    id: 'en-policy-institute-2026',
    title: 'Distributional note on the schedule change',
    publisher: 'Policy Institute',
    url: 'https://example.org/policy-institute/note-2026',
    retrieved_at: '2026-07-20',
    period: 'Fiscal 2026',
    kind: 'ngo',
    self_reported: false,
    liveness: 'live',
    notes:
      'Snapshot returned status 403 to automated clients. The anti bot challenge was corroborated by a manual browser check on the retrieval date, which loaded the same document.',
  },
  {
    id: 'en-journal-review-2026',
    title: 'Peer reviewed estimate with a stated interval',
    publisher: 'Journal Review',
    url: 'https://example.org/journal-review/estimate-2026',
    retrieved_at: '2026-07-20',
    period: '2001 to 2021',
    kind: 'academic',
    self_reported: false,
    liveness: 'live',
  },
];

// --- 6.3 narratives -------------------------------------------------------------------

function narrativeMbgPoisoning() {
  const panels = [
    {
      type: 'claim_map',
      el_id: 'p-claim',
      spine: [
        {
          el_id: 's-1',
          label: L('Programme scale as reported', 'Skala program seperti dilaporkan'),
          value: V(
            63130000,
            'people',
            '63.13M recipients',
            '63,13 juta penerima',
            'id-agency-program-2026',
            { as_of: '2026-05-31', flags: ['self_reported'] },
          ),
        },
        { el_id: 's-2', label: L('Recorded intake reports', 'Laporan penerimaan tercatat') },
        { el_id: 's-3', label: L('Cause named in the article', 'Sebab yang disebut artikel') },
        { el_id: 's-4', label: L('Call to halt the programme', 'Seruan menghentikan program') },
      ],
      edges: [
        {
          el_id: 'e-1',
          from: 's-1',
          to: 's-2',
          status: 'supported',
          ev: {
            quote: 'The register lists intake by district for the period.',
            source_id: 'id-agency-health-2026',
            why: L(
              'The register covers the same districts and period as the claim.',
              'Register mencakup distrik dan periode yang sama dengan klaim.',
            ),
          },
        },
        {
          el_id: 'e-2',
          from: 's-2',
          to: 's-3',
          status: 'disputed',
          ev: {
            quote: 'Two tallies cover the same period under different intake rules.',
            source_id: 'id-monitor-network-2026',
            why: L(
              'Two tallies read the same period under different intake rules.',
              'Dua rekapitulasi membaca periode yang sama dengan aturan penerimaan berbeda.',
            ),
          },
        },
        {
          el_id: 'e-3',
          from: 's-3',
          to: 's-4',
          status: 'missing',
          ev: {
            quote: 'The article moves from cause to remedy in one sentence.',
            why: L(
              'No cited document connects the named cause to the proposed step.',
              'Tidak ada dokumen terkutip yang menghubungkan sebab dengan langkah yang diusulkan.',
            ),
          },
        },
        {
          el_id: 'e-4',
          from: 's-1',
          to: 's-3',
          status: 'unsourced',
          ev: {
            quote: 'The article asserts the link without attribution.',
            why: L(
              'The assertion carries no attribution of any kind.',
              'Pernyataan itu tidak disertai atribusi apa pun.',
            ),
          },
        },
      ],
      hidden: [
        {
          el_id: 'h-1',
          label: L('District kitchens under contract', 'Dapur distrik yang terikat kontrak'),
          value: V(1240, 'count', '1,240 kitchens', '1.240 dapur', 'id-agency-program-2026'),
          why_hidden: L(
            'The article omits the operators who hold the contracts.',
            'Artikel menghilangkan operator pemegang kontrak.',
          ),
          ev: {
            quote: 'The contract register lists the operating kitchens for the period.',
            source_id: 'id-agency-program-2026',
          },
        },
        {
          el_id: 'h-2',
          label: L('Regional inspection offices', 'Kantor inspeksi wilayah'),
          why_hidden: L(
            'The article names no office that inspects the sites.',
            'Artikel tidak menyebut kantor yang memeriksa lokasi.',
          ),
        },
      ],
    },
    {
      type: 'dueling',
      el_id: 'p-duel',
      counts: [
        {
          el_id: 'c-1',
          who: 'Agency B',
          method: L(
            'Reports confirmed through laboratory intake.',
            'Laporan yang dikonfirmasi lewat penerimaan laboratorium.',
          ),
          period: 'Jan to Oct 2025',
          value: V(6517, 'count', '6,517 reports', '6.517 laporan', 'id-agency-health-2026'),
        },
        {
          el_id: 'c-2',
          who: 'Agency A',
          method: L(
            'Reports logged by the programme desk.',
            'Laporan yang dicatat meja program.',
          ),
          period: 'Jan to Oct 2025',
          value: V(9089, 'count', '9,089 reports', '9.089 laporan', 'id-agency-program-2026'),
        },
        {
          el_id: 'c-3',
          who: 'Monitor Network',
          method: L(
            'Reports collected from district volunteers.',
            'Laporan yang dikumpulkan relawan distrik.',
          ),
          period: 'Jan to Oct 2025',
          value: V(8649, 'count', '8,649 reports', '8.649 laporan', 'id-monitor-network-2026'),
        },
      ],
      rule_line: L(
        'Different methods, different windows. Every tally stands on its own rules.',
        'Metode berbeda, jendela waktu berbeda. Setiap rekapitulasi berdiri di atas aturannya sendiri.',
      ),
    },
    {
      type: 'incidence',
      el_id: 'p-inc',
      horizons: [
        { key: 'weeks', label: L('Weeks', 'Pekan') },
        { key: 'months', label: L('Months', 'Bulan') },
        { key: 'beyond', label: L('Beyond', 'Setelahnya') },
      ],
      lanes: [
        {
          el_id: 'l-1',
          who: L('Households in the pilot districts', 'Rumah tangga di distrik percontohan'),
          cells: [
            {
              horizon: 'weeks',
              text: L(
                'Delivery pauses at the listed sites.',
                'Pengiriman berhenti sementara di lokasi terdaftar.',
              ),
              value: V(1240, 'count', '1,240 sites', '1.240 lokasi', 'id-agency-program-2026'),
              ev: {
                quote: 'The site register lists the operating locations for the period.',
                source_id: 'id-agency-program-2026',
              },
            },
            {
              horizon: 'months',
              text: L(
                'Districts reassign the supply contracts.',
                'Distrik mengalihkan kontrak pasokan.',
              ),
            },
            {
              horizon: 'beyond',
              text: L(
                'Budget lines return to the annual cycle.',
                'Pos anggaran kembali ke siklus tahunan.',
              ),
            },
          ],
        },
      ],
    },
  ];

  return withDerived({
    id: 'mbg-poisoning',
    pack: 'id',
    lean: 'opp',
    status: 'published',
    headline: L('Three tallies, one season, no shared rule', 'Tiga rekapitulasi, satu musim, tanpa aturan bersama'),
    original: { text: 'Tiga lembaga mencatat angka berbeda untuk musim yang sama', lang: 'id' },
    outlet: 'Example Daily',
    published_date: '2026-06-11',
    url: 'https://example.org/example-daily/three-tallies',
    og: {
      image_path: '/assets/og/mbg-poisoning.jpg',
      fetched_at: '2026-07-20',
      attribution: 'Image courtesy of Example Daily',
      fallback: false,
    },
    tags: ['competing-counts', 'missing-link', 'hidden-stakeholder'],
    provenance: {
      analyzed_by: 'model-analyst',
      narrated_by: 'model-narrator',
      source_count: 0,
      computed_at: '2026-07-20T09:00:00Z',
      run_id: 'run-fixture-001',
    },
    family: familyBlock('three institutions publish different tallies for one season', [
      {
        outlet: 'Example Daily',
        headline: 'Tiga lembaga mencatat angka berbeda untuk musim yang sama',
        url: 'https://example.org/example-daily/three-tallies',
        date: '2026-06-11',
      },
      {
        outlet: 'Example Wire',
        headline: 'Angka musim ini berbeda di tiga register',
        url: 'https://example.org/example-wire/three-registers',
        date: '2026-06-12',
      },
    ]),
    scaffold_default: 'S3',
    sparring: sparring(
      question(
        'mechanism',
        'What would connect the named cause to the proposed step?',
        'Apa yang menghubungkan sebab yang disebut dengan langkah yang diusulkan?',
        [
          L('A document that traces one to the other', 'Dokumen yang menelusuri satu ke lainnya'),
          L('A louder headline', 'Judul yang lebih keras'),
          L('More quotes from the same desk', 'Lebih banyak kutipan dari meja yang sama'),
        ],
        0,
        'The step is asserted without a linking document, which is why the edge reads as missing.',
        'Langkah itu dinyatakan tanpa dokumen penghubung, sebab itu tepi tersebut tercatat hilang.',
      ),
      question(
        'denominator',
        'Against what base should the tallies be read?',
        'Terhadap basis apa rekapitulasi itu dibaca?',
        [
          L('The number of headlines', 'Jumlah judul berita'),
          L('The population each register covers', 'Populasi yang dicakup tiap register'),
          L('The length of the article', 'Panjang artikel'),
        ],
        1,
        'Each register covers a different intake population, so the totals are not interchangeable.',
        'Tiap register mencakup populasi penerimaan berbeda, sehingga totalnya tidak dapat dipertukarkan.',
      ),
      question(
        'incidence',
        'Who meets the change first?',
        'Siapa yang menghadapi perubahan lebih dulu?',
        [
          L('Households in the pilot districts', 'Rumah tangga di distrik percontohan'),
          L('The national desk', 'Meja nasional'),
          L('Nobody in particular', 'Tidak ada pihak tertentu'),
        ],
        0,
        'The incidence lanes place the pilot districts in the weeks column.',
        'Jalur insidensi menempatkan distrik percontohan pada kolom pekan.',
      ),
    ),
    prediction_tap: {
      prompt: L(
        'Which tally do you expect the article to quote?',
        'Rekapitulasi mana yang Anda perkirakan dikutip artikel?',
      ),
      options: [
        L('The highest one', 'Yang tertinggi'),
        L('The lowest one', 'Yang terendah'),
        L('All three together', 'Ketiganya sekaligus'),
      ],
    },
    panels,
    echo: null,
    narration: narration([
      {
        els: ['p-claim', 'e-3'],
        en: 'The claim map records one step that no cited document connects.',
        id: 'Peta klaim mencatat satu langkah yang tidak dihubungkan dokumen terkutip.',
      },
      {
        els: ['p-duel', 'c-1'],
        en: 'Three registers report the same season under different intake rules.',
        id: 'Tiga register melaporkan musim yang sama dengan aturan penerimaan berbeda.',
      },
      {
        els: ['p-inc', 'l-1'],
        en: 'Households in the pilot districts meet the change first.',
        id: 'Rumah tangga di distrik percontohan menghadapi perubahan lebih dulu.',
      },
    ]),
    manifest: manifest('run-fixture-001', '20'),
  });
}

function narrativePpnPanic() {
  const panels = [
    {
      type: 'claim_map',
      el_id: 'p-claim',
      spine: [
        {
          el_id: 's-1',
          label: L('Line named in the article', 'Pos yang disebut artikel'),
          value: V(88.15, 'IDR_T', 'Rp88.15T', 'Rp88,15 T', 'id-agency-program-2026'),
        },
        { el_id: 's-2', label: L('Scope the article implies', 'Cakupan yang disiratkan artikel') },
        { el_id: 's-3', label: L('Reaction the article reports', 'Reaksi yang dilaporkan artikel') },
      ],
      edges: [
        {
          el_id: 'e-1',
          from: 's-1',
          to: 's-2',
          status: 'supported',
          ev: {
            quote: 'The budget table lists the line and the total it sits inside.',
            source_id: 'id-agency-budget-2026',
            why: L(
              'The table names both the line and the total.',
              'Tabel menyebut pos sekaligus totalnya.',
            ),
          },
        },
        {
          el_id: 'e-2',
          from: 's-2',
          to: 's-3',
          status: 'missing',
          ev: {
            quote: 'The article reports the reaction without a scope document.',
            why: L(
              'No document sets the scope the reaction responds to.',
              'Tidak ada dokumen yang menetapkan cakupan yang direspons reaksi itu.',
            ),
          },
        },
        {
          el_id: 'e-3',
          from: 's-1',
          to: 's-3',
          status: 'unsourced',
          ev: {
            quote: 'The article ties the line to the reaction without attribution.',
            why: L(
              'The link is asserted with no attribution.',
              'Kaitan itu dinyatakan tanpa atribusi.',
            ),
          },
        },
      ],
      hidden: [
        {
          el_id: 'h-1',
          label: L('Offices that administer the line', 'Kantor yang mengelola pos itu'),
          value: V(599.44, 'IDR_T', 'Rp599.44T', 'Rp599,44 T', 'id-agency-budget-2026'),
          why_hidden: L(
            'The article names no office that administers the line.',
            'Artikel tidak menyebut kantor yang mengelola pos itu.',
          ),
          ev: {
            quote: 'The budget table assigns the line to a named office.',
            source_id: 'id-agency-budget-2026',
          },
        },
      ],
    },
    {
      type: 'scale_check',
      el_id: 'p-scale',
      denominator: {
        label: L('Total spending for the year', 'Total belanja tahun berjalan'),
        value: V(3842.7, 'IDR_T', 'Rp3,842.7T', 'Rp3.842,7 T', 'id-agency-budget-2026'),
      },
      segments: [
        {
          el_id: 'seg-1',
          label: L('The line under discussion', 'Pos yang sedang dibahas'),
          value: V(88.15, 'IDR_T', 'Rp88.15T', 'Rp88,15 T', 'id-agency-program-2026'),
        },
        {
          el_id: 'seg-2',
          label: L('Every other spending line', 'Seluruh pos belanja lainnya'),
          value: V(3754.55, 'IDR_T', 'Rp3,754.55T', 'Rp3.754,55 T', 'id-agency-budget-2026'),
        },
      ],
      takeaway: L(
        'The article names the smaller line without naming the total it sits inside.',
        'Artikel menyebut pos yang lebih kecil tanpa menyebut total yang memuatnya.',
      ),
      context_chips: [
        {
          el_id: 'chip-1',
          label: L('Annual interest line, for comparison', 'Pos bunga tahunan, sebagai pembanding'),
          value: V(599.44, 'IDR_T', 'Rp599.44T', 'Rp599,44 T', 'id-agency-budget-2026'),
        },
      ],
    },
    {
      type: 'money_flow',
      el_id: 'p-flow',
      root: {
        label: L('Programme allocation', 'Alokasi program'),
        value: V(88.15, 'IDR_T', 'Rp88.15T', 'Rp88,15 T', 'id-agency-program-2026'),
      },
      rows: [
        {
          el_id: 'row-1',
          label: L('District kitchen operations', 'Operasi dapur distrik'),
          value: V(52.9, 'IDR_T', 'Rp52.9T', 'Rp52,9 T', 'id-agency-program-2026'),
          severed_if_stopped: true,
          note: L('The contracts end with the allocation.', 'Kontrak berakhir bersama alokasi.'),
        },
        {
          el_id: 'row-2',
          label: L('Regional logistics', 'Logistik wilayah'),
          value: V(35.25, 'IDR_T', 'Rp35.25T', 'Rp35,25 T', 'id-agency-budget-2026'),
          severed_if_stopped: false,
        },
      ],
    },
    { type: 'family', el_id: 'p-family' },
  ];

  return withDerived({
    id: 'ppn-panic',
    pack: 'id',
    lean: 'gov',
    status: 'published',
    headline: L('One line, read as the whole table', 'Satu pos, dibaca sebagai seluruh tabel'),
    original: { text: 'Satu pos anggaran dibaca sebagai keseluruhan tabel', lang: 'id' },
    outlet: 'Example Wire',
    published_date: '2026-06-18',
    url: 'https://example.org/example-wire/one-line',
    og: {
      image_path: '/assets/og/ppn-panic.jpg',
      fetched_at: '2026-07-20',
      attribution: 'Image courtesy of Example Wire',
      fallback: false,
    },
    tags: ['scope-inflation', 'no-denominator', 'emotional-trigger'],
    provenance: {
      analyzed_by: 'model-analyst',
      narrated_by: 'model-narrator',
      source_count: 0,
      computed_at: '2026-07-21T09:00:00Z',
      run_id: 'run-fixture-002',
    },
    family: familyBlock('one budget line stands in for the whole table', [
      {
        outlet: 'Example Wire',
        headline: 'Satu pos anggaran dibaca sebagai keseluruhan tabel',
        url: 'https://example.org/example-wire/one-line',
        date: '2026-06-18',
      },
    ]),
    scaffold_default: 'S2',
    sparring: sparring(
      question(
        'denominator',
        'What total does the named line sit inside?',
        'Pos yang disebut itu berada di dalam total berapa?',
        [
          L('The total for the year', 'Total untuk tahun berjalan'),
          L('The article word count', 'Jumlah kata artikel'),
          L('Nothing, it stands alone', 'Tidak ada, pos itu berdiri sendiri'),
        ],
        0,
        'The scale panel places the line inside the yearly total taken from the budget table.',
        'Panel skala menempatkan pos itu di dalam total tahunan yang diambil dari tabel anggaran.',
      ),
      question(
        'mechanism',
        'What sets the scope the reaction responds to?',
        'Apa yang menetapkan cakupan yang direspons reaksi itu?',
        [
          L('A published scope document', 'Dokumen cakupan yang diterbitkan'),
          L('The tone of the headline', 'Nada judul'),
          L('The order of paragraphs', 'Urutan paragraf'),
        ],
        0,
        'No scope document is cited, which is why that edge reads as missing.',
        'Tidak ada dokumen cakupan yang dikutip, sebab itu tepi tersebut tercatat hilang.',
      ),
      question(
        'incidence',
        'Which rows end if the allocation ends?',
        'Baris mana yang berakhir jika alokasi berakhir?',
        [
          L('The contracted operations row', 'Baris operasi yang dikontrakkan'),
          L('Every row at once', 'Semua baris sekaligus'),
          L('No row at all', 'Tidak ada baris sama sekali'),
        ],
        0,
        'The money flow panel marks the contracted row as severed and leaves the other standing.',
        'Panel aliran dana menandai baris yang dikontrakkan sebagai terputus dan membiarkan yang lain berdiri.',
      ),
    ),
    prediction_tap: {
      prompt: L(
        'Which figure do you expect the article to lead with?',
        'Angka mana yang Anda perkirakan dipakai artikel sebagai pembuka?',
      ),
      options: [
        L('The single line', 'Pos tunggal'),
        L('The yearly total', 'Total tahunan'),
        L('Both side by side', 'Keduanya berdampingan'),
      ],
    },
    panels,
    echo: {
      type: 'echo',
      el_id: 'p-echo',
      current_motif: L(
        'A single line is read as the whole table.',
        'Satu pos dibaca sebagai keseluruhan tabel.',
      ),
      historical: {
        case_id: 'B-01',
        motif: L(
          'A single line stood in for the whole table.',
          'Satu pos berdiri mewakili keseluruhan tabel.',
        ),
        outcome: L(
          'The commission recorded the disputed items and the office published a revised table.',
          'Komisi mencatat butir yang diperselisihkan dan kantor menerbitkan tabel revisi.',
        ),
        citations: ['id-rights-commission-2019', 'id-archive-mirror-2025'],
      },
      disclaimer_key: 'echo_disclaimer',
    },
    narration: narration([
      {
        els: ['p-claim', 'e-2'],
        en: 'The claim map records one step with no scope document behind it.',
        id: 'Peta klaim mencatat satu langkah tanpa dokumen cakupan di belakangnya.',
      },
      {
        els: ['p-scale', 'seg-1'],
        en: 'The scale panel places the named line inside the yearly total.',
        id: 'Panel skala menempatkan pos yang disebut di dalam total tahunan.',
      },
      {
        els: ['p-flow', 'row-1'],
        en: 'The money flow panel marks which row ends with the allocation.',
        id: 'Panel aliran dana menandai baris mana yang berakhir bersama alokasi.',
      },
      {
        els: ['p-family'],
        en: 'The family panel lists the outlets that carried the same skeleton.',
        id: 'Panel keluarga mendaftar media yang membawa kerangka yang sama.',
      },
      {
        els: ['p-echo'],
        en: 'The echo panel shows what a structurally similar framing produced in the past.',
        id: 'Panel gema menampilkan apa yang dihasilkan kerangka serupa pada masa lalu.',
      },
    ]),
    manifest: manifest('run-fixture-002', '21'),
  });
}

function narrativeTariffsPay() {
  const panels = [
    {
      type: 'claim_map',
      el_id: 'p-claim',
      spine: [
        {
          el_id: 's-1',
          label: L('Projected revenue over ten years', 'Proyeksi penerimaan selama sepuluh tahun'),
          value: V(2500, 'USD_B', 'USD 2,500B', 'USD 2.500 M', 'en-budget-office-2026'),
        },
        {
          el_id: 's-2',
          label: L('Receipts recorded so far', 'Penerimaan yang tercatat sejauh ini'),
          value: V(
            118,
            'USD_B',
            'USD 118B',
            'USD 118 M',
            'en-revenue-service-2026',
            { as_of: '2026-06-30' },
          ),
        },
        { el_id: 's-3', label: L('Who carries the cost', 'Siapa yang menanggung biaya') },
      ],
      edges: [
        {
          el_id: 'e-1',
          from: 's-1',
          to: 's-2',
          status: 'supported',
          ev: {
            quote: 'The receipts summary reports the same schedule as the projection tables.',
            source_id: 'en-revenue-service-2026',
            why: L(
              'Both documents describe the same schedule.',
              'Kedua dokumen menggambarkan jadwal yang sama.',
            ),
          },
        },
        {
          el_id: 'e-2',
          from: 's-2',
          to: 's-3',
          status: 'disputed',
          ev: {
            quote: 'The distributional note reaches a different split than the article states.',
            source_id: 'en-policy-institute-2026',
            why: L(
              'Two documents split the cost differently.',
              'Dua dokumen membagi biaya secara berbeda.',
            ),
          },
        },
        {
          el_id: 'e-3',
          from: 's-1',
          to: 's-3',
          status: 'missing',
          ev: {
            quote: 'The article moves from projection to burden without a step in between.',
            why: L(
              'No cited document carries the projection to the burden claim.',
              'Tidak ada dokumen terkutip yang membawa proyeksi ke klaim beban.',
            ),
          },
        },
      ],
      hidden: [
        {
          el_id: 'h-1',
          label: L('Importers of record', 'Importir tercatat'),
          why_hidden: L(
            'The article names no party that files the entries.',
            'Artikel tidak menyebut pihak yang mengajukan dokumen masuk.',
          ),
        },
      ],
    },
    {
      type: 'options',
      el_id: 'p-options',
      options: [
        {
          el_id: 'o-1',
          label: L('Keep the current schedule', 'Pertahankan jadwal saat ini'),
          proponent: { name: 'Budget Office', source_id: 'en-budget-office-2026' },
          tradeoff: L(
            'Receipts hold and the price path stays where it is.',
            'Penerimaan bertahan dan jalur harga tetap seperti sekarang.',
          ),
        },
        {
          el_id: 'o-2',
          label: L('Phase the schedule over a longer window', 'Sebarkan jadwal ke jendela lebih panjang'),
          proponent: { name: 'Revenue Service', source_id: 'en-revenue-service-2026' },
          tradeoff: L(
            'Receipts arrive later and the price path moves more slowly.',
            'Penerimaan datang lebih lambat dan jalur harga bergerak lebih pelan.',
          ),
        },
        {
          el_id: 'o-3',
          label: L('Offset the schedule with a rebate', 'Imbangi jadwal dengan potongan'),
          proponent: { name: 'Policy Institute', source_id: 'en-policy-institute-2026' },
          tradeoff: L(
            'The split changes and the administration cost rises.',
            'Pembagian berubah dan biaya administrasi naik.',
          ),
        },
      ],
      playbook: [
        {
          el_id: 'pb-1',
          action: L(
            'Ask which base the share is taken from.',
            'Tanyakan basis mana yang dipakai menghitung porsi.',
          ),
          channel: L('Written question to the committee', 'Pertanyaan tertulis ke komite'),
        },
        {
          el_id: 'pb-2',
          action: L(
            'Ask for the period the table covers.',
            'Tanyakan periode yang dicakup tabel.',
          ),
          channel: L('Public records request', 'Permintaan arsip publik'),
        },
      ],
    },
    { type: 'family', el_id: 'p-family' },
  ];

  return withDerived({
    id: 'tariffs-pay',
    pack: 'en',
    lean: 'neutral',
    status: 'published',
    headline: L('A projection and a receipt are not the same figure', 'Proyeksi dan penerimaan bukan angka yang sama'),
    original: { text: 'A projection and a receipt are not the same figure', lang: 'en' },
    outlet: 'Example Review',
    published_date: '2026-06-24',
    url: 'https://example.org/example-review/projection-and-receipt',
    og: {
      image_path: null,
      fetched_at: null,
      attribution: 'Placeholder render, Example Review',
      fallback: true,
    },
    tags: ['no-counterfactual', 'incidence-blind', 'single-source'],
    provenance: {
      analyzed_by: 'model-analyst',
      narrated_by: 'model-narrator',
      source_count: 0,
      computed_at: '2026-07-22T09:00:00Z',
      run_id: 'run-fixture-003',
    },
    family: familyBlock('a ten year projection is quoted as a present receipt', [
      {
        outlet: 'Example Review',
        headline: 'A projection and a receipt are not the same figure',
        url: 'https://example.org/example-review/projection-and-receipt',
        date: '2026-06-24',
      },
    ]),
    scaffold_default: 'S1',
    sparring: sparring(
      question(
        'denominator',
        'Over what window is the projection stated?',
        'Dalam jendela waktu apa proyeksi itu dinyatakan?',
        [
          L('One quarter', 'Satu kuartal'),
          L('Ten years', 'Sepuluh tahun'),
          L('The article does not say', 'Artikel tidak menyebutkan'),
        ],
        1,
        'The projection tables state a ten year window that the article does not repeat.',
        'Tabel proyeksi menyatakan jendela sepuluh tahun yang tidak diulang artikel.',
      ),
      question(
        'mechanism',
        'What carries a projection to a burden claim?',
        'Apa yang membawa proyeksi menjadi klaim beban?',
        [
          L('A cited pass through study', 'Kajian pelimpahan biaya yang dikutip'),
          L('A stronger adjective', 'Kata sifat yang lebih kuat'),
          L('A second headline', 'Judul kedua'),
        ],
        0,
        'That step is asserted with no cited document, which is why the edge reads as missing.',
        'Langkah itu dinyatakan tanpa dokumen terkutip, sebab itu tepi tersebut tercatat hilang.',
      ),
      question(
        'incidence',
        'Which party is absent from the article?',
        'Pihak mana yang absen dari artikel?',
        [
          L('The importers of record', 'Importir tercatat'),
          L('The revenue service', 'Dinas penerimaan'),
          L('The budget office', 'Kantor anggaran'),
        ],
        0,
        'The hidden list names the party that files the entries and never appears in the copy.',
        'Daftar tersembunyi menyebut pihak yang mengajukan dokumen masuk dan tidak pernah muncul di teks.',
      ),
    ),
    prediction_tap: {
      prompt: L(
        'Which figure do you expect the headline to use?',
        'Angka mana yang Anda perkirakan dipakai judul?',
      ),
      options: [
        L('The ten year projection', 'Proyeksi sepuluh tahun'),
        L('The receipts to date', 'Penerimaan sampai saat ini'),
        L('Neither figure', 'Tidak keduanya'),
      ],
    },
    panels,
    echo: null,
    narration: narration([
      {
        els: ['p-claim', 'h-1'],
        en: 'The claim map lists a party that files the entries and never appears in the copy.',
        id: 'Peta klaim mendaftar pihak yang mengajukan dokumen masuk dan tidak pernah muncul di teks.',
      },
      {
        els: ['p-options', 'o-1'],
        en: 'The options panel sets out three published positions without ranking them.',
        id: 'Panel opsi memaparkan tiga posisi yang diterbitkan tanpa memeringkatnya.',
      },
      {
        els: ['p-family'],
        en: 'The family panel lists the outlets that carried the same skeleton.',
        id: 'Panel keluarga mendaftar media yang membawa kerangka yang sama.',
      },
    ]),
    manifest: manifest('run-fixture-003', '22'),
  });
}

/** Mechanical fields the pipeline derives and the validator recomputes. */
function withDerived(n) {
  n.counts = deriveCounts(n.panels);
  n.provenance.source_count = referencedSources(n).size;
  return n;
}

// --- other content files --------------------------------------------------------------

const FEED_ID = {
  pack: 'id',
  updated_at: '2026-07-22T10:00:00Z',
  items: [
    { narrative_id: 'mbg-poisoning', slot: 'hero' },
    { narrative_id: 'ppn-panic', slot: 'compact', via_dissect: true },
  ],
};

const FEED_EN = {
  pack: 'en',
  updated_at: '2026-07-22T10:00:00Z',
  items: [{ narrative_id: 'tariffs-pay', slot: 'hero' }],
};

const URL_INDEX = {
  entries: [
    {
      match: 'exact',
      pattern: 'https://example.org/example-daily/three-tallies',
      narrative_id: 'mbg-poisoning',
      role: 'canonical',
    },
    {
      match: 'prefix',
      pattern: 'https://example.org/example-wire/',
      narrative_id: 'ppn-panic',
      role: 'canonical',
    },
    {
      match: 'regex',
      pattern: '^https://example\\.org/example-review/.*$',
      narrative_id: 'tariffs-pay',
      role: 'canonical',
    },
    {
      match: 'exact',
      pattern: 'https://example.org/example-daily/old-slug',
      narrative_id: 'mbg-poisoning',
      role: 'legacy',
    },
    {
      match: 'exact',
      pattern: 'https://example.org/example-wire/three-registers',
      narrative_id: 'mbg-poisoning',
      role: 'family_member',
    },
    {
      match: 'exact',
      pattern: 'https://example.org/example-wire/one-line',
      narrative_id: 'ppn-panic',
      role: 'fresh_demo',
    },
  ],
};

const CASE_LIBRARY = {
  cases: [
    {
      id: 'B-01',
      title: L('One line stood in for a whole table', 'Satu pos berdiri mewakili seluruh tabel'),
      period: 'May 2019',
      motif: L(
        'A single budget line was quoted as the total.',
        'Satu pos anggaran dikutip sebagai total.',
      ),
      documented_outcome: L(
        'The commission recorded the disputed items and the office published a revised table.',
        'Komisi mencatat butir yang diperselisihkan dan kantor menerbitkan tabel revisi.',
      ),
      citations: ['id-rights-commission-2019'],
    },
    {
      id: 'B-02',
      title: L('Two registers, one season', 'Dua register, satu musim'),
      period: 'Dec 2025',
      motif: L(
        'Two registers reported the same season under different rules.',
        'Dua register melaporkan musim yang sama dengan aturan berbeda.',
      ),
      documented_outcome: L(
        'The notice was withdrawn and the archived copy remained the only public record.',
        'Pengumuman itu ditarik dan salinan arsip menjadi satu satunya catatan publik.',
      ),
      citations: ['id-archive-mirror-2025'],
    },
  ],
};

const CONSTELLATION = {
  nodes: [
    {
      id: 'node-mbg-poisoning',
      narrative_id: 'mbg-poisoning',
      label: L('Three tallies, one season', 'Tiga rekapitulasi, satu musim'),
      pack: 'id',
    },
    {
      id: 'node-ppn-panic',
      narrative_id: 'ppn-panic',
      label: L('One line, whole table', 'Satu pos, seluruh tabel'),
      pack: 'id',
    },
    {
      id: 'node-tariffs-pay',
      narrative_id: 'tariffs-pay',
      label: L('Projection against receipt', 'Proyeksi berhadapan dengan penerimaan'),
      pack: 'en',
    },
  ],
  links: [
    {
      a: 'node-mbg-poisoning',
      b: 'node-ppn-panic',
      via: L('competing counts', 'angka bersaing'),
    },
    {
      a: 'node-ppn-panic',
      b: 'node-tariffs-pay',
      via: L('no denominator', 'tanpa denominator'),
    },
  ],
};

const METHODOLOGY = {
  symmetry: { gov: 1, neutral: 1, opp: 1, computed_at: '2026-07-22T10:00:00Z' },
  metrics: [
    {
      key: 'narratives_published',
      label: L('Narratives published', 'Narasi yang diterbitkan'),
      kind: 'measured',
      value: '3',
      run_id: 'run-fixture-003',
    },
    {
      key: 'source_resolution',
      label: L('Source resolution', 'Resolusi sumber'),
      kind: 'design_target',
      value: 'every figure resolves to a registered source',
    },
  ],
  policy_65: L(
    'Matterhorn shows structure and citations. It issues no verdict on any narrative or on anyone who published one.',
    'Matterhorn menampilkan struktur dan sitasi. Ia tidak menjatuhkan vonis atas narasi mana pun maupun atas siapa pun yang menerbitkannya.',
  ),
  disclosure: L(
    'Every dissection on this page was produced by an automated agent fleet and is labelled as such.',
    'Setiap diseksi di halaman ini diproduksi oleh armada agen otomatis dan diberi label demikian.',
  ),
};

const CORRECTIONS = {
  entries: [
    {
      date: '2026-07-21',
      narrative_id: 'mbg-poisoning',
      summary: L(
        'A reader flagged the intake window on one register. The entry is open while the register is re read.',
        'Pembaca menandai jendela penerimaan pada satu register. Entri ini terbuka selama register itu dibaca ulang.',
      ),
      status: 'under_review',
    },
  ],
};

const OG_ATTRIBUTION = {
  policy:
    'Cached og images render only as attributed link previews with the outlet name and an outbound link. Status fallback means the styled placeholder ships.',
  entries: [
    {
      narrative_id: 'mbg-poisoning',
      image_url_original: 'https://example.org/example-daily/three-tallies.jpg',
      outlet: 'Example Daily',
      fetched_at: '2026-07-20',
      status: 'fetched',
    },
    {
      narrative_id: 'ppn-panic',
      image_url_original: 'https://example.org/example-wire/one-line.jpg',
      outlet: 'Example Wire',
      fetched_at: '2026-07-20',
      status: 'fetched',
    },
    {
      narrative_id: 'tariffs-pay',
      image_url_original: null,
      outlet: 'Example Review',
      fetched_at: null,
      status: 'fallback',
    },
  ],
};

/** The shared GOOD content root, as a path to artifact map. */
function goodTree() {
  return {
    'sources.json': clone(SOURCES),
    'og_attribution.json': clone(OG_ATTRIBUTION),
    'narratives/mbg-poisoning.json': narrativeMbgPoisoning(),
    'narratives/ppn-panic.json': narrativePpnPanic(),
    'narratives/tariffs-pay.json': narrativeTariffsPay(),
    'packs/id/feed.json': clone(FEED_ID),
    'packs/en/feed.json': clone(FEED_EN),
    'url_index.json': clone(URL_INDEX),
    'case_library.json': clone(CASE_LIBRARY),
    'constellation.json': clone(CONSTELLATION),
    'methodology.json': clone(METHODOLOGY),
    'corrections.json': clone(CORRECTIONS),
  };
}

// --- style audit of the good roots ----------------------------------------------------

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
const EM_DASH = '\u2014';
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

/** Cross checks the good roots against the invariants the validator will assert. */
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
  }
  return problems;
}

// --- writing --------------------------------------------------------------------------

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

/** `mutate` runs before stamping (isolates the check); `postStamp` runs after (manifest). */
function build({ dir, mutate, postStamp, audit = false }) {
  const tree = goodTree();
  if (mutate) mutate(tree);
  stampTokens(tree);
  if (postStamp) postStamp(tree);
  if (audit) {
    const problems = auditGood(tree, dir);
    if (problems.length > 0) {
      console.error(`good fixture ${dir} is not clean:`);
      for (const p of problems) console.error(`  ${p}`);
      process.exitCode = 1;
    }
  }
  writeTree(dir, tree);
  return tree;
}

const nar = (tree, id) => tree[`narratives/${id}.json`];

const VARIANTS = [
  // the shared complete GOOD root, reused by every check's positive case
  { dir: 'good', audit: true },

  // 1 schema: a field type violation in a narrative
  {
    dir: 'schema/bad-field-type',
    mutate: (t) => {
      nar(t, 'mbg-poisoning').provenance.source_count = '4';
    },
  },

  // 2 orphans: an unresolvable Value.source_id, and an unresolvable citations[] id
  {
    dir: 'orphans/bad-unresolved-source',
    mutate: (t) => {
      nar(t, 'ppn-panic').panels[1].segments[0].value.source_id = 'id-nonexistent-source';
    },
  },
  {
    dir: 'orphans/bad-unresolved-citation',
    mutate: (t) => {
      t['case_library.json'].cases[0].citations = ['id-nonexistent-citation'];
    },
  },

  // 3 counts: stored counts drift, and a wrong CF-1 conflicts field on a dueling narrative
  {
    dir: 'counts/bad-stored-counts',
    mutate: (t) => {
      nar(t, 'mbg-poisoning').counts.missing = 4;
    },
  },
  {
    dir: 'counts/bad-conflicts',
    mutate: (t) => {
      nar(t, 'mbg-poisoning').counts.conflicts = 2;
    },
  },

  // 4 narration: a dangling els reference, and a panel with no sentence in one language
  {
    dir: 'narration/bad-dangling-el',
    mutate: (t) => {
      nar(t, 'tariffs-pay').narration.en.sentences[1].els = ['p-options', 'o-nonexistent'];
    },
  },
  {
    dir: 'narration/bad-uncovered-panel',
    mutate: (t) => {
      const n = nar(t, 'mbg-poisoning');
      n.narration.id.sentences = n.narration.id.sentences.filter((s) => s.id !== 'n-3');
    },
  },

  // 5 lexicon: EN verdict, ID verdict, future tense harm, em dash, emoji, plus the
  // methodology exemption as a GOOD root
  {
    dir: 'lexicon/bad-en-verdict',
    mutate: (t) => {
      nar(t, 'mbg-poisoning').panels[0].edges[1].ev.why.en =
        'The second tally was debunked and the first one is the only real count.';
    },
  },
  {
    dir: 'lexicon/bad-id-verdict',
    mutate: (t) => {
      nar(t, 'ppn-panic').panels[1].takeaway.id = 'Angka dalam artikel ini hoaks.';
    },
  },
  {
    dir: 'lexicon/bad-future-harm',
    mutate: (t) => {
      nar(t, 'ppn-panic').echo.historical.outcome.en =
        'The same framing will cause shortages in the districts that depend on the line.';
    },
  },
  {
    dir: 'lexicon/bad-em-dash',
    mutate: (t) => {
      nar(t, 'tariffs-pay').headline.en =
        'A projection and a receipt \u2014 not the same figure';
    },
  },
  {
    dir: 'lexicon/bad-emoji',
    mutate: (t) => {
      nar(t, 'tariffs-pay').panels[1].options[0].tradeoff.en =
        'Receipts hold and the price path stays where it is \u{1F4C8}';
    },
  },
  {
    // 6.9 scoped exemption: the methodology page may name the verdict words while saying
    // what Matterhorn does not do. This root MUST pass.
    dir: 'lexicon/good-methodology-exemption',
    audit: false,
    mutate: (t) => {
      t['methodology.json'].policy_65 = L(
        'Matterhorn never calls a narrative false, fake, a hoax, or misleading, and it never declares one true. It shows structure and citations and stops there.',
        'Matterhorn tidak pernah menyebut sebuah narasi palsu, hoaks, salah, atau menyesatkan, dan tidak pernah menyatakannya benar. Ia menampilkan struktur dan sitasi, lalu berhenti di situ.',
      );
    },
  },

  // 6 manifest: bytes tampered after the token was computed, and a missing gate token
  {
    dir: 'manifest/bad-tampered',
    postStamp: (t) => {
      nar(t, 'tariffs-pay').headline.en = 'A projection and a receipt are different figures';
    },
  },
  {
    dir: 'manifest/bad-missing-token',
    postStamp: (t) => {
      delete nar(t, 'ppn-panic').manifest.gates.fidelity.token;
    },
  },

  // 7 seed: an artifact carrying "seed": true
  {
    dir: 'seed/bad-seed-flag',
    mutate: (t) => {
      nar(t, 'mbg-poisoning').seed = true;
    },
  },

  // 8 url-index: a dangling narrative reference, zero fresh_demo, two fresh_demo
  {
    dir: 'url-index/bad-dangling-narrative',
    mutate: (t) => {
      t['url_index.json'].entries[3].narrative_id = 'no-such-narrative';
    },
  },
  {
    dir: 'url-index/bad-zero-fresh-demo',
    mutate: (t) => {
      t['url_index.json'].entries[5].role = 'canonical';
    },
  },
  {
    dir: 'url-index/bad-two-fresh-demo',
    mutate: (t) => {
      t['url_index.json'].entries[0].role = 'fresh_demo';
    },
  },

  // 9 liveness: liveness live with a recorded status >= 400 and no corroboration language
  {
    dir: 'liveness/bad-live-error-no-corroboration',
    mutate: (t) => {
      const s = t['sources.json'].find((x) => x.id === 'en-policy-institute-2026');
      s.notes = 'Snapshot returned status 503 for this URL.';
    },
  },

  // 10 feed: a dangling item, two heroes in one pack, ppn-panic without via_dissect
  {
    dir: 'feed/bad-dangling-item',
    mutate: (t) => {
      t['packs/id/feed.json'].items.push({ narrative_id: 'no-such-narrative', slot: 'compact' });
    },
  },
  {
    dir: 'feed/bad-two-heroes',
    mutate: (t) => {
      t['packs/id/feed.json'].items[1].slot = 'hero';
    },
  },
  {
    dir: 'feed/bad-ppn-no-dissect',
    mutate: (t) => {
      delete t['packs/id/feed.json'].items[1].via_dissect;
    },
  },
];

for (const variant of VARIANTS) build(variant);

// CLI level root: a content root with no sources.json at all must fail (the Gate 0
// leniency is repealed).
writeTree('cli/bad-no-sources', { 'corrections.json': { entries: [] } });

console.log(`wrote ${VARIANTS.length + 1} fixture roots under ${ROOT}`);
if (process.exitCode === 1) console.error('one or more good fixtures failed the self audit');
