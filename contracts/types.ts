// Matterhorn interface contracts. Blueprint Section 6.
//
// FROZEN. Field renames, type loosening, or optionality changes require a Deviations entry
// and Report disclosure; additive optional fields are allowed only with validator coverage.
// The comments are the blueprint's own annotations, kept verbatim.
//
// contracts/schemas/*.schema.json mirror these shapes for runtime validation. The two are
// edited together or not at all.

// --- 6.1 Source registry: content/sources.json ---

export type SourceId = string; // pattern: ^[a-z]{2}-[a-z0-9-]+$  e.g. "id-kemenkeu-apbn2026-enacted"

export interface Source {
  id: SourceId;
  title: string; // human title of the source document or page
  publisher: string; // institution or outlet, e.g. "Kemenkeu", "PPATK", "KFF"
  url: string; // canonical URL, verified live at build or flagged
  retrieved_at: string; // ISO date of snapshot verification
  period: string; // what period the figure covers, e.g. "APBN 2026, enacted", "Jan to Oct 2025"
  kind: 'official' | 'outlet' | 'ngo' | 'academic';
  self_reported: boolean; // true for BGN-style institution-about-itself figures
  liveness: 'live' | 'dead_replaced' | 'unverified';
  notes?: string; // discrepancy notes, replacement history
}

// --- 6.2 The Value object (the unit of the no-orphan-numbers invariant) ---

export interface Value {
  amount: number; // machine value in `unit`
  unit: 'IDR_T' | 'IDR_B' | 'USD_B' | 'USD' | 'count' | 'percent' | 'meals_per_day' | 'people';
  display: { en: string; id: string }; // exact rendered string, e.g. "Rp88.15T" / "Rp88,15 T"
  source_id: SourceId; // MUST resolve in sources.json
  as_of?: string; // ISO date when the figure was current
  flags?: Array<'self_reported' | 'draft_figure' | 'estimate' | 'modeled' | 'design_target'>;
}

// Rendering rule: renderers accept numbers ONLY inside `Value` (or the dueling `CountEntry`).
// A bare numeric prop on any grammar component is a type error, and a `Value` whose
// `source_id` fails resolution throws `OrphanNumberError` at render.

// --- 6.3 Narrative artifact: content/narratives/{id}.json ---

export type Lang = 'en' | 'id';

export type PanelType =
  | 'claim_map'
  | 'scale_check'
  | 'money_flow'
  | 'incidence'
  | 'dueling'
  | 'echo'
  | 'options'
  | 'family';

export interface Narrative {
  id: string; // slug, e.g. "mbg-stop"
  pack: 'id' | 'en';
  lean: 'gov' | 'opp' | 'neutral'; // feeds the symmetry receipt
  status: 'published' | 'under_review';
  headline: { en: string; id?: string }; // display headline per language
  original: { text: string; lang: Lang }; // verbatim original headline
  outlet: string;
  published_date: string; // ISO date of the original article
  url: string; // live canonical article URL
  og: { image_path: string | null; fetched_at: string | null; attribution: string; fallback: boolean };
  tags: string[]; // technique tags, lowercase, from contracts/technique-tags.json
  counts: DerivedCounts; // Section 6.5; validator recomputes and must match
  provenance: {
    analyzed_by: string;
    narrated_by: string;
    source_count: number;
    computed_at: string;
    run_id: string;
  };
  family: { skeleton: string; members: Array<{ outlet: string; headline: string; url: string; date: string }> };
  scaffold_default: 'S3' | 'S2' | 'S1' | 'S0';
  sparring: { questions: SparringQuestion[] }; // exactly 3; S2 rotates among them
  prediction_tap: { prompt: { en: string; id: string }; options: Array<{ en: string; id: string }> };
  panels: Panel[]; // ordered; claim_map always first
  echo: EchoPanel | null; // null = the Echo section renders its silence state
  narration: Record<Lang, { sentences: Array<{ id: string; text: string; els: string[] }> }>;
  manifest: GenerationManifest;
}

export interface SparringQuestion {
  move: 'mechanism' | 'denominator' | 'incidence';
  q: { en: string; id: string };
  options: Array<{ en: string; id: string }>; // exactly 3
  correct: 0 | 1 | 2;
  note: { en: string; id: string }; // post-answer explanation, cited via [source_id] markers allowed
}

// Every graph element referenced anywhere (in `els`, in evidence, in counts) carries a stable
// `el_id` unique within the narrative; the validator asserts referential integrity of every
// `els` array.

// --- 6.4 Panel schemas (all eight, exact) ---

export interface ClaimMapPanel {
  type: 'claim_map';
  el_id: string;
  spine: Array<{ el_id: string; label: { en: string; id: string }; value?: Value }>;
  edges: Array<{
    el_id: string;
    from: string;
    to: string;
    status: 'supported' | 'disputed' | 'missing' | 'unsourced';
    ev: { quote: string; source_id?: SourceId; why: { en: string; id: string } };
  }>;
  hidden: Array<{
    el_id: string;
    label: { en: string; id: string };
    value?: Value;
    why_hidden: { en: string; id: string };
    ev?: { quote: string; source_id: SourceId };
  }>;
}

export interface ScaleCheckPanel {
  type: 'scale_check';
  el_id: string;
  denominator: { label: { en: string; id: string }; value: Value };
  // pct DERIVED at render: value.amount / denominator.amount
  segments: Array<{ el_id: string; label: { en: string; id: string }; value: Value }>;
  takeaway: { en: string; id: string };
  context_chips: Array<{ el_id: string; label: { en: string; id: string }; value: Value }>;
}

export interface MoneyFlowPanel {
  type: 'money_flow';
  el_id: string;
  root: { label: { en: string; id: string }; value: Value };
  // the stop-toggle dims severed rows
  rows: Array<{
    el_id: string;
    label: { en: string; id: string };
    value: Value;
    severed_if_stopped: boolean;
    note?: { en: string; id: string };
  }>;
}

export interface IncidencePanel {
  type: 'incidence';
  el_id: string;
  horizons: Array<{ key: 'weeks' | 'months' | 'beyond'; label: { en: string; id: string } }>;
  lanes: Array<{
    el_id: string;
    who: { en: string; id: string };
    cells: Array<{
      horizon: 'weeks' | 'months' | 'beyond';
      text: { en: string; id: string };
      value?: Value;
      ev?: { quote: string; source_id: SourceId };
    }>;
  }>;
}

export interface CountEntry {
  el_id: string;
  who: string;
  method: { en: string; id: string };
  period: string;
  value: Value; // dueling entries are Values too; unit "count"
}

export interface DuelingPanel {
  type: 'dueling';
  el_id: string;
  counts: CountEntry[]; // 2..4 institutions, side by side
  rule_line: { en: string; id: string }; // e.g. "Different methods, different windows. Both real."
}

export interface EchoPanel {
  type: 'echo';
  el_id: string;
  current_motif: { en: string; id: string };
  historical: {
    case_id: string; // resolves in case_library.json
    motif: { en: string; id: string };
    outcome: { en: string; id: string }; // past tense only; lint-enforced
    citations: SourceId[];
  };
  disclaimer_key: 'echo_disclaimer'; // renders the fixed retrospective disclaimer
}

export interface OptionsPanel {
  type: 'options';
  el_id: string;
  // 3..5 options, no ranking, no recommendation
  options: Array<{
    el_id: string;
    label: { en: string; id: string };
    proponent: { name: string; source_id: SourceId };
    tradeoff: { en: string; id: string };
  }>;
  playbook: Array<{ el_id: string; action: { en: string; id: string }; channel: { en: string; id: string } }>;
}

export interface FamilyPanel {
  type: 'family';
  el_id: string;
} // renders from Narrative.family; no extra data

export type Panel =
  | ClaimMapPanel
  | ScaleCheckPanel
  | MoneyFlowPanel
  | IncidencePanel
  | DuelingPanel
  | EchoPanel
  | OptionsPanel
  | FamilyPanel;

// `constellation` is not a per-narrative panel; it is the global file in Section 6.6.

// --- 6.5 Derived counts (mechanical; never authored) ---

export interface DerivedCounts {
  missing: number;
  unsourced: number;
  disputed: number;
  supported: number;
  hidden: number;
  /**
   * CF-1 additive optional field, permitted by Section 6 with validator coverage and
   * disclosed in the Report. Derived mechanically as the number of `CountEntry` items in the
   * narrative's dueling panel; absent when the narrative has no dueling panel. Never
   * authored: the validator recomputes it like every other count.
   */
  conflicts?: number;
}

// Derivation: `missing` = claim_map edges with status "missing"; `unsourced` = edges
// "unsourced" plus hidden entries without `ev`; `disputed` = edges "disputed"; `supported` =
// edges "supported"; `hidden` = hidden entries. The validator recomputes from panels and
// fails on any mismatch with the stored `counts`. Card chips, autopsy chips, notification
// copy, and Nuance Cards all render exclusively from `counts`.

// --- 6.6 Other content files ---

// content/packs/{pack}/feed.json
export interface Feed {
  pack: 'id' | 'en';
  updated_at: string;
  items: Array<{
    narrative_id: string;
    slot: 'hero' | 'compact';
    via_dissect?: boolean;
    crisis_hold?: boolean;
  }>;
}
// ppn-panic ships with via_dissect true and is filtered from initial render until the demo
// flow flips a local flag.

// content/url_index.json
export interface UrlIndex {
  entries: Array<{
    match: 'exact' | 'prefix' | 'regex';
    pattern: string;
    narrative_id: string;
    role: 'canonical' | 'legacy' | 'family_member' | 'fresh_demo';
  }>;
}

// content/case_library.json
export interface CaseLibrary {
  cases: Array<{
    id: string; // "B-01".."B-04"
    title: { en: string; id: string };
    period: string;
    motif: { en: string; id: string };
    documented_outcome: { en: string; id: string }; // past tense; lint-enforced
    citations: SourceId[];
  }>;
}

// content/constellation.json
export interface Constellation {
  nodes: Array<{ id: string; narrative_id: string; label: { en: string; id: string }; pack: 'id' | 'en' }>;
  links: Array<{ a: string; b: string; via: { en: string; id: string } }>;
}

// content/methodology.json
export interface Methodology {
  symmetry: { gov: number; neutral: number; opp: number; computed_at: string }; // DERIVED from narratives
  metrics: Array<{
    key: string;
    label: { en: string; id: string };
    kind: 'measured' | 'design_target';
    value: string;
    run_id?: string;
  }>;
  policy_65: { en: string; id: string }; // PRD 6.5 verbatim
  disclosure: { en: string; id: string }; // Article-50-shaped AI disclosure
}

// content/corrections.json
export interface Corrections {
  entries: Array<{
    date: string;
    narrative_id: string;
    summary: { en: string; id: string };
    status: 'under_review' | 'corrected' | 'dismissed';
  }>;
}

// embedded in every generated artifact
export interface GenerationManifest {
  run_id: string;
  generated_at: string;
  steps: Array<{
    role: 'A5' | 'A6' | 'A7' | 'A8' | 'A9' | 'A10' | 'A11';
    model: string;
    started_at: string;
    finished_at: string;
    input_hash: string;
  }>;
  gates: { symmetry: { verdict: 'pass'; token: string }; fidelity: { verdict: 'pass'; token: string } };
}

// --- 6.10 og attribution: content/og_attribution.json ---
// Shipped artifact recorded by scripts/fetch-og. `policy` states the render policy that keeps
// cached og images inside attributed link previews; `entries` is the per-narrative record.

export interface OgAttribution {
  policy: string;
  entries: Array<{
    narrative_id: string;
    image_url_original: string | null;
    outlet: string;
    fetched_at: string | null;
    status: 'fetched' | 'fallback';
    note?: string;
    /** Additive optional (member link previews): the staged asset path, null on a fallback. */
    image_path?: string | null;
    /** Additive optional: the family-member article this preview belongs to. */
    member_url?: string;
  }>;
}

// --- fleet replay: content/replay.json ---
// Distilled from the committed run log by scripts/build-replay.ts; the schema mirror is
// contracts/schemas/replay.schema.json. Additive to the Section 6 set, read only by the
// research desk's replay console. No durations are carried, and the disclosure strings are
// the label the console must keep visible for the whole replay.
// The record spans every recorded run the archive was published from: `run_ids` names them all,
// each narrative carries the `run_id` it was recorded in, `generated_at` is the newest run's,
// and the counts are the union. A narrative may only be attributed to the run that has its
// recorded steps, so no id appears twice.

export type ReplayEvent =
  | { kind: 'slot'; role: string; label: { en: string; id: string }; model: string; at: string; note?: { en: string; id: string } }
  | { kind: 'block'; role: string; gate: 'symmetry' | 'fidelity'; judged_by: string; reason: string }
  | { kind: 'verdict'; role: string; gate: 'symmetry' | 'fidelity'; verdict: 'pass' | 'block'; model: string; summary: string; note?: { en: string; id: string } }
  | { kind: 'published'; token: string };

export interface ReplayRun {
  narrative_id: string;
  run_id: string;
  blocked_rounds: number;
  events: ReplayEvent[];
}

export interface Replay {
  run_ids: string[];
  generated_at: string;
  disclosure: { en: string; id: string };
  models: string[];
  narratives_total: number;
  narratives_blocked: number;
  blocks_total: number;
  narratives: ReplayRun[];
}
