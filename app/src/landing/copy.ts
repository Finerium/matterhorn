/**
 * Blueprint 4.4, the landing page, transcribed verbatim.
 *
 * 4.4 freezes its copy: wording, punctuation and typographic case are the blueprint's, not this
 * file's. Nothing was edited, normalized or respelled on the way in, so what reads like a slip is
 * transcribed as written and flagged in a comment beside it. AC-LAND-1 string-matches this module
 * against the rendered page, which makes the file the only surface a copy change can come through.
 *
 * Two kinds of string live here and the difference is mechanical: every value is frozen copy
 * except the fields named `anchor`, which are the section ids 4.4 writes in parentheses beside
 * each heading and the nav points at. Route targets are the router's business and are not here.
 *
 * Data-bound holes are slots, never braces inside a string. A slot is `{ slot: 'missing' }`, its
 * name is checked against `Slot` when this file compiles, and `fill` is the only thing that turns
 * a line into text, so a mistyped slot is a build failure rather than a brace on screen
 * (AC-LAND-3).
 *
 * English only: 4.4 sets the register as English, so there are no `Copy` pairs in this file.
 */

/** Every name 4.4 writes in curly braces, from the hero count chips to the stats caption. */
export type Slot =
  | 'missing'
  | 'unsourced'
  | 'hidden'
  | 'gov'
  | 'neutral'
  | 'opp'
  | 'packs'
  | 'components'
  | 'agents'
  | 'narratives';

/** One frozen line: literal text and slots, in the order they render. */
export type Line = readonly (string | { readonly slot: Slot })[];

/** What the build resolves each slot to. Counts arrive from published JSON as numbers. */
export type SlotValues = Record<Slot, string | number>;

/** A line, annotated so a slot name that does not exist is a compile error. */
const line = (...parts: (string | { slot: Slot })[]): Line => parts;

/** The one way a line becomes text. */
export const fill = (parts: Line, values: SlotValues): string =>
  parts.map((part) => (typeof part === 'string' ? part : values[part.slot])).join('');

/** 4.4.1. Mobile keeps the wordmark and the button, and drops the links. */
export const NAV = {
  wordmark: 'MATTERHORN',
  links: [
    { label: 'The problem', anchor: 'the-problem' },
    { label: 'The fleet', anchor: 'the-fleet' },
    { label: 'The grammar', anchor: 'the-grammar' },
    { label: 'Integrity', anchor: 'integrity' },
    { label: 'Try it', anchor: 'try-it' },
  ],
  cta: 'Open Matterhorn',
} as const;

/** 4.4.2. */
export const HERO = {
  anchor: 'top',
  eyebrow: 'A VERDICT-FREE CAUSAL LITERACY ENGINE',
  // AC-LAND-2: this string is byte-identical to FOOTER.line2 and to the app's `hello.sub`.
  h1: 'Most people see the peak. The Matterhorn shows the journey and its impact.',
  subhead:
    'Matterhorn dissects the news you actually see. Not whether each fact is true, but whether the story connecting them holds. No verdicts, no scores, no sides. You stay the judge.',
  ctaPrimary: 'Open Matterhorn',
  ctaSecondary: 'Explore the research desk',
  microline: 'Free · No account needed · Runs in your browser',
  /**
   * The five labels drawn inside the claim-map animation. 4.4 quotes each one; those quotation
   * marks are its delimiters and are not part of the copy. The side panel's "+4" is frozen as a
   * literal while the count chips right below it are data-bound, which is 4.4's own asymmetry and
   * is left standing.
   */
  setPiece: {
    headlineChip: 'Stop MBG Permanently to Save the State Budget · Tribunnews',
    edgeSupported: 'supported · the budget math checks out',
    edgeMissing: 'missing link · the mechanism is never stated',
    sidePanel: '+4 hidden branches the headline priced at zero',
    countChips: line(
      { slot: 'missing' },
      ' missing link · ',
      { slot: 'unsourced' },
      ' unsourced · ',
      { slot: 'hidden' },
      ' hidden',
    ),
  },
  dividerPullQuote: 'Fact-checkers examine the facts. Matterhorn examines the reasoning.',
} as const;

/** 4.4.3, section 1. */
export const PROBLEM = {
  anchor: 'the-problem',
  kicker: 'THE PROBLEM',
  h2: 'The most dangerous stories contain no false facts.',
  lead: 'A headline is engineered to make you feel before you think. Outrage arrives in the first second, the share happens in the next, and certainty settles in before a single question gets asked. Fact-checking cannot save you here, because the strongest of these stories are built from true facts: a real number, a real event, and an invented arrow between them. Every atom survives a fact-check. The structure does not. And no fact-checker is built to see structure.',
  // Beat 1 is the one body 4.4 writes inside quotation marks, because it quotes the headline's
  // promise. The marks are transcribed with it; the other three bodies carry none.
  beats: [
    { kicker: 'A headline makes a promise.', body: '"Stop one program, and the economy is saved."' },
    { kicker: 'The facts inside it are real.', body: 'The spending figure is official. The budget math checks out.' },
    {
      kicker: 'The arrow between them was never stated.',
      body: 'How does an unspent budget line become a rescued economy? No article in the family ever says.',
    },
    {
      kicker: 'And the hidden branches were priced at zero.',
      body: '142,387 supplier contracts. 1.28 million program workers. 63 million daily meals. None of them appear in the headline.',
    },
  ],
  closing:
    'Four blindnesses recur across every domain: no mechanism, no denominator, no counterfactual, no incidence. Matterhorn makes all four visible in seconds.',
  sourceMicroline: 'Figures: Kemenkeu realisasi May 2026 · BGN registry, self-reported and flagged as such.',
} as const;

/** 4.4.4, section 2. */
export const STAKES = {
  anchor: 'the-stakes',
  kicker: 'WHY IT MATTERS',
  h2: 'Beliefs cascade. The costs are on record.',
  lead: 'When enough people run on the same broken causal model, belief becomes action: streets fill, markets panic, energy pours into the wrong target, and the actual problem never even gets named. Matterhorn never predicts what a story will cause. That would be unsupported, and it would be a way of taking sides. Instead, it remembers. Every dissection is matched against a curated library of documented episodes with the same causal shape, and shows what that shape produced last time, with sources.',
  // One string per card: 4.4 writes each as a single paragraph, date and sources included, and
  // AC-LAND-1 matches card text whole.
  cases: [
    'MAY 2019 · Casualty-inflation cascade. A fabricated casualty count spread faster than any correction and amplified post-election riots in Jakarta. The final human-rights investigation documented 10 people unlawfully killed. Sources: Komnas HAM · Amnesty International.',
    'OCT 2020 · Fabricated-provision cascade. Invented provisions of a law whose final text was not yet public, minimum wage abolished, severance eliminated, fueled nationwide demonstrations. Sources: Kominfo catalogue · Kompas fact list.',
    'AUG 2025 · Moral-shock acceleration. A viral death video mobilized nationwide protests within hours. In the escalations that followed, a regional parliament building fire killed three people. Sources: The Jakarta Post · Jakarta Globe.',
  ],
  ethicsMicroline:
    'Matterhorn takes no position on whether any protest, boycott, or campaign should happen. The cost it surfaces is the cost of acting on a broken causal model. Never collective action itself.',
  bridgeLine:
    'Matterhorn exists so the next reaction can be an informed one: see the structure in thirty seconds, then decide what it deserves.',
} as const;

/** 4.4.5, section 3. */
export const FLEET = {
  anchor: 'the-fleet',
  kicker: 'HOW IT WORKS',
  h2: 'Thirteen agents dissect a narrative before it reaches your feed.',
  lead: "Radar watches a country's media ecosystem for narratives that are rising fast, emotionally loaded, and dense with causal claims. Each eligible cluster is handed to a fleet of thirteen specialized agents. One maps what the story asserts. Another is prompted adversarially to find what it hides. A grounder attaches official sources and refuses to mint a number without one. A historian searches the case library for echoes. And two gates, a Symmetry Auditor and a Fidelity Guard, hold the power to block publication entirely.",
  // The console loops in this order. The agent numbering steps A8 to A10 with no A9 line, as 4.4
  // writes it.
  consoleLines: [
    'A5 Causal Extractor · mapping the asserted spine',
    'A6 Hidden-Node Hunter · 4 hidden stakeholders proposed',
    'A7 Evidence Grounder · 14 sources attached · 0 orphan numbers',
    'A8 Cascade Historian · no echo clears the threshold',
    'A10 Symmetry Auditor · mirror framing dissected · pass',
    'A11 Fidelity Guard · every sentence traced to the graph · pass',
    'Published to cache · the read path never touches a model',
  ],
  receipts: [
    'Assertion and omission are separate jobs. The agent that reads what a story says never doubles as the agent that hunts what it hides. Merging the two measurably degrades both.',
    'The gates are agents, and they can say no. Symmetry and fidelity are enforced by dedicated blockers with the power to stop publication. Not by good intentions inside a prompt.',
    'Computed once. Served to everyone. Analysis is stance-blind and user-independent, so one autopsy is cached and read by every user, and the cost per reader falls toward zero. This demo runs its fleet privately at editorial time; production swaps in live agents with a single configuration change.',
  ],
} as const;

/** 4.4.6, section 4. The numeral that opens each card is 4.4's, and is copy. */
export const GRAMMAR = {
  anchor: 'the-grammar',
  kicker: 'THE VISUALIZATION GRAMMAR',
  h2: 'Eight components. Learn to read them once, reuse the skill on every story.',
  lead: 'Language models never draw here. They fill typed JSON, and deterministic renderers do the drawing. A renderer refuses any number that arrives without a source identifier, so a hallucinated statistic is not a risk to be managed. It is a shape that cannot render.',
  cards: [
    "1 Claim Map. The story's asserted spine and everything it leaves out, side by side, as a causal diff you can read in one second.",
    '2 Scale Check. Every big number placed against the official denominator that gives it meaning.',
    '3 Money Flow. Documented flows on record, and a toggle that shows exactly which of them an abrupt stop would sever.',
    '4 Incidence Timeline. Who bears the cost, and when: the first weeks, the first months, and beyond.',
    '5 Dueling Numbers. When official counts disagree, Matterhorn renders the conflict, methodologies and all, instead of quietly picking a winner.',
    '6 Cascade Echo. What structurally similar narratives produced last time, with citations. And silence when nothing clears the bar.',
    '7 Narrative Family. One skeleton, many outlets. The narrative is the unit of analysis, not the article.',
    '8 Constellation. How narratives connect through shared institutions, across the whole archive.',
  ],
} as const;

/** 4.4.7, section 5. Each block opens with its own label, and 4.4 gives the section no lead. */
export const MODES = {
  anchor: 'two-modes',
  kicker: 'TWO DOORS, ONE ENGINE',
  h2: 'Radar gets there first. Dissect answers a share.',
  blocks: [
    'RADAR · THE FEED. A daily feed of rising narratives, each one already dissected. The card contract is absolute: a headline never renders without its counts and technique tags attached. The bait ships with the needle already in it, so the feed cannot degrade into a rage aggregator with extra steps.',
    "DISSECT · TWO TAPS. In WhatsApp, TikTok, or anywhere else: share a link to Matterhorn and the claim map opens. Under thirty seconds from share to structure. Cache-first, so one person's question becomes everyone's answer. On Android, install the app and it appears straight in your share sheet.",
    'SPARRING · BEFORE THE REVEAL. Three questions, rehearsed until reflexive: What is the mechanism? Compared to what? Who pays first? Answer first, then read the analysis as a diff against your own model. Scaffolding fades as your accuracy holds. Training wheels, not a wheelchair.',
  ],
} as const;

/** 4.4.8, section 6. */
export const INTEGRITY = {
  anchor: 'integrity',
  kicker: 'INTEGRITY IS ARCHITECTURAL',
  h2: 'No verdicts. No sides. No orphan numbers.',
  // All four cards are lines because the third carries the symmetry slots; a card with no slot is
  // a line of one part, so the section renders four cards through one `fill`.
  cards: [
    line(
      'Verdict-free by design. No true, false, or misleading labels. No quality scores. Descriptive counts only: 3 missing links, 2 unsourced assumptions. Judgment stays where it belongs, with the reader.',
    ),
    line(
      'Stance-blind by architecture. The pipeline receives the narrative and the country pack. Never your identity, your history, or what you would like to be true. Anti-sycophancy is a property of the data flow, not a promise in a prompt.',
    ),
    line(
      "Symmetry, enforced and published. Every narrative's mirror framing is dissected before publication, and asymmetry blocks. The dissection load across the political axis is published in the app as a standing receipt: currently ",
      { slot: 'gov' },
      ' government-lean, ',
      { slot: 'neutral' },
      ' neutral, ',
      { slot: 'opp' },
      ' opposition-lean.',
    ),
    line(
      "Provenance on every card. Analyzed-by and narrated-by chips on every dissection, expandable to the full chain, shaped to the EU AI Act's Article 50 from day one. Model branding is never used as a danger rating.",
    ),
  ],
  strips: [
    'Corrections with teeth. Any outlet or named actor can flag a dissection. A visible "under review" chip within 24 hours, and corrections publish with the same prominence as the original, on a public changelog.',
    'Outlets get traffic, not ratings. Headlines are quoted for identification and always link out. Matterhorn analyzes narrative structures and maintains no outlet scores, ever.',
  ],
} as const;

/** 4.4.9, section 7. This is the one section 4.4 heads with an H3 and gives no kicker. */
export const PACKS = {
  anchor: 'packs',
  h3: 'One engine. Many countries.',
  body: "Everything jurisdiction-specific lives in a versioned Country Pack: the source registry, the official statistics, the case library, the civic playbook, and the axes of that country's polarization. Adding a country is authorship, not engineering. Launch packs: Indonesia, in depth, and EN-Global.",
  // The band is one frozen line, separators included. A tiled layout splits it on ' · '; it is not
  // stored pre-split, because the line is what AC-LAND-1 and the verification walk compare.
  statsBand: line(
    { slot: 'packs' },
    ' country packs · ',
    { slot: 'components' },
    ' visual components · ',
    { slot: 'agents' },
    ' agents per autopsy · 0 verdicts, ever',
  ),
  caption: line(
    { slot: 'narratives' },
    ' narratives in the demo archive, dissected at editorial time · the read path is fully static · modeled cost under $25 a day at full frontier quality.',
  ),
} as const;

/** 4.4.10, section 8. */
export const TRY = {
  anchor: 'try-it',
  kicker: 'SEE IT YOURSELF',
  h2: 'See the whole journey.',
  body: 'The mobile app runs right in your browser, framed like the phone it was built for. The research desk is the desktop surface: the archive, the constellation, stable permalinks, and exports.',
  ctaPrimary: 'Open the mobile app',
  ctaSecondary: 'Open the research desk',
  microlines: [
    'Android: install to your home screen and Matterhorn registers as a share target.',
    'No account. No tracking. The pipeline never knows who is asking.',
  ],
} as const;

/** 4.4.11. */
export const FOOTER = {
  line1: 'Matterhorn · A verdict-free causal literacy engine.',
  // AC-LAND-2 wants the tagline byte-identical in four places. It is written out rather than
  // aliased to HERO.h1, so the transcription reads as a transcription at both ends.
  line2: 'Most people see the peak. The Matterhorn shows the journey and its impact.',
  columns: [
    {
      heading: 'Product',
      items: ['Mobile app', 'Research desk', 'Methodology and symmetry', 'Corrections changelog'],
    },
    {
      heading: 'Principles',
      items: ['Verdict-free rules', 'Stance-blindness', 'Policy on protest and Echo', 'AI disclosure'],
    },
  ],
  credit: 'Built for the UNESCO Youth Hackathon 2026 · AI and MIL track',
  team: 'Ghaisan Khoirul Badruzaman & Kesya Austin',
  disclosure:
    'Dissections in this demo were generated by a private fleet of Claude-class AI agents at editorial time and verified against renderer-enforced invariants. The read path serves cached artifacts only.',
  legal:
    'Headlines are quoted for identification and link to their original outlets. Matterhorn issues no verdicts on content and maintains no ratings of outlets.',
  copyright: '© 2026 Matterhorn.',
} as const;
