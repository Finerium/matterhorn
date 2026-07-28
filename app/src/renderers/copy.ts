/**
 * Every string the renderer layer says in its own voice, in one file, in both languages.
 *
 * Content copy lives in the artifact and is never written here. What is here is chrome: panel
 * titles, section labels, the legend, the fixed retrospective disclaimer named by
 * `EchoPanel.disclaimer_key`, the money panel's honesty note, and the sheet footer. Wording is the zip's wherever the zip has a
 * generic equivalent (the zip authored a per-panel title; the contract has no title field, so
 * the type-level title is what ships).
 *
 * Blueprint 6.9 applies to this file as much as to content: no verdict words, no em dash, no
 * emoji, no future-tense harm.
 */
import type { Copy } from './ctx';

export const UI = {
  source: { en: 'Source: ', id: 'Sumber: ' },
  selfReported: { en: ' · self-reported', id: ' · dilaporkan sendiri' },
  storyAsTold: { en: 'The story as told', id: 'Cerita sebagaimana diceritakan' },
  leftOut: { en: 'What it leaves out', id: 'Yang ditinggalkan' },
  tapHint: {
    en: 'Tap any node or edge for its evidence sheet',
    id: 'Ketuk simpul atau tepi mana pun untuk lembar buktinya',
  },
  denominator: { en: 'Denominator: ', id: 'Denominator: ' },
  takeaway: { en: 'Takeaway', id: 'Inti' },
  ifStopped: { en: 'If stopped abruptly', id: 'Jika dihentikan mendadak' },
  struckBreak: { en: 'Struck rows break', id: 'Baris yang dicoret putus' },
  breaks: { en: 'Breaks', id: 'Putus' },
  stopToggle: { en: 'Stop the flow', id: 'Hentikan aliran' },
  // The zip's per-panel money note, EN verbatim. It is the honesty statement the panel is built
  // on, so it is fixed chrome here rather than a per-artifact field an author could drop.
  moneyNote: {
    en: 'Struck = documented existing flows that break under an abrupt stop. Qualitative and cited; no projected macro curves are drawn anywhere.',
    id: 'Dicoret = aliran yang sudah berjalan dan terdokumentasi, yang putus jika dihentikan mendadak. Kualitatif dan terkutip; tidak ada kurva makro proyeksi yang digambar di mana pun.',
  },
  now: { en: 'Now', id: 'Sekarang' },
  onFile: { en: 'On file · case ', id: 'Terarsip · kasus ' },
  documentedOutcome: { en: 'Documented outcome', id: 'Hasil terdokumentasi' },
  echoDisclaimer: {
    en: 'Retrospective and cited, never predictive. Matched at motif level: case ',
    id: 'Retrospektif dan terkutip, tidak pernah meramal. Dicocokkan pada tingkat motif: kasus ',
  },
  echoSilence: {
    en: 'No case on file carries this motif. The section stays quiet rather than reaching for one.',
    id: 'Tidak ada kasus terarsip yang membawa motif ini. Bagian ini memilih diam daripada memaksakan satu.',
  },
  optionsIntro: {
    en: 'The space of options named actors actually occupy. Matterhorn reports the spectrum; it never selects from it.',
    id: 'Ruang opsi yang benar-benar ditempati para aktor yang disebut. Matterhorn melaporkan spektrumnya; Matterhorn tidak pernah memilih di dalamnya.',
  },
  trades: { en: 'trades: ', id: 'menukar: ' },
  playbook: { en: 'Citizen playbook', id: 'Panduan warga' },
  optionsFooter: {
    en: 'Process, never positions. Matterhorn maps the spectrum; it does not select.',
    id: 'Proses, bukan posisi. Matterhorn memetakan spektrumnya; Matterhorn tidak memilih.',
  },
  familyMembers: {
    en: ' outlets carry the same skeleton',
    id: ' media membawa kerangka yang sama',
  },
  analyzedBy: { en: 'Analyzed by ', id: 'Dianalisis oleh ' },
  narratedBy: { en: ', narrated by ', id: ', dinarasikan oleh ' },
  ogPlaceholder: { en: 'og:image', id: 'og:image' },
  dissect: { en: 'Dissect', id: 'Bedah' },
  // The zip's affordance glyph on this button is U+2197, which carries the Unicode emoji
  // property; 6.9 bans emoji in copy. U+2192, which the zip uses on every other affordance, does
  // not, and reads the same.
  original: { en: 'Original →', id: 'Asli →' },
  underReview: { en: 'Under review', id: 'Sedang ditinjau' },
  evidence: { en: 'Evidence', id: 'Bukti' },
  panelSources: { en: 'Panel sources', id: 'Sumber panel' },
  playbookStep: { en: 'Playbook step', id: 'Langkah panduan' },
  whyThisStatus: { en: 'Why this status', id: 'Mengapa status ini' },
  whyHidden: { en: 'Why this is hidden', id: 'Mengapa ini tersembunyi' },
  sourceHeading: { en: 'Source', id: 'Sumber' },
  sheetFooterA: {
    en: 'Every edge is inspectable down to the quotation.',
    id: 'Setiap tepi dapat diperiksa sampai ke kutipannya.',
  },
  sheetFooterB: {
    en: 'Every number carries a source id, or it does not render.',
    id: 'Setiap angka membawa id sumber, atau angka itu tidak digambar.',
  },
  close: { en: 'Close', id: 'Tutup' },
} satisfies Record<string, Copy>;

/** Status labels: the legend, and the evidence sheet pill. */
export const STATUS_LABEL = {
  supported: { en: 'Supported', id: 'Berpijak pada dokumen' },
  disputed: { en: 'Disputed', id: 'Disengketakan' },
  missing: { en: 'Missing link', id: 'Tautan hilang' },
  unsourced: { en: 'Unsourced', id: 'Tanpa sumber' },
  hidden: { en: 'Hidden', id: 'Tersembunyi' },
} satisfies Record<string, Copy>;

/**
 * Panel titles. The zip authored one per panel ("How big is Rp88.15T?"); Section 6.4 carries no
 * title field, so the title is a property of the panel type and these are the zip's generic
 * forms. Six of the eight are the zip's wording verbatim.
 */
export const PANEL_TITLE = {
  claim_map: { en: 'What is actually being claimed?', id: 'Apa yang sebenarnya diklaim?' },
  scale_check: { en: 'How big is it, really?', id: 'Seberapa besar sebenarnya?' },
  money_flow: { en: 'Where does the money flow?', id: 'Ke mana uangnya mengalir?' },
  incidence: { en: 'Who pays first?', id: 'Siapa yang membayar lebih dulu?' },
  dueling: { en: 'Why do the numbers differ?', id: 'Mengapa angkanya berbeda?' },
  echo: { en: 'Has this happened before?', id: 'Pernahkah ini terjadi sebelumnya?' },
  options: { en: 'What could be done?', id: 'Apa yang bisa dilakukan?' },
  family: { en: 'Who else says this?', id: 'Siapa lagi yang mengatakan ini?' },
} satisfies Record<string, Copy>;

/** Chip vocabulary, blueprint 6.5. `supported` never gets a chip. */
export const COUNT_CHIPS: Array<{
  key: 'missing' | 'unsourced' | 'disputed' | 'conflicts' | 'hidden';
  st: 'missing' | 'unsourced' | 'disputed' | 'hidden';
  label: (n: number) => Copy;
}> = [
  {
    key: 'missing',
    st: 'missing',
    label: (n) => ({ en: `${n} missing link${n === 1 ? '' : 's'}`, id: `${n} tautan hilang` }),
  },
  { key: 'unsourced', st: 'unsourced', label: (n) => ({ en: `${n} unsourced`, id: `${n} tanpa sumber` }) },
  { key: 'disputed', st: 'disputed', label: (n) => ({ en: `${n} disputed`, id: `${n} disengketakan` }) },
  {
    key: 'conflicts',
    st: 'disputed',
    label: (n) => ({ en: `${n} official counts conflict`, id: `${n} hitungan resmi berbeda` }),
  },
  { key: 'hidden', st: 'hidden', label: (n) => ({ en: `${n} hidden`, id: `${n} tersembunyi` }) },
];
