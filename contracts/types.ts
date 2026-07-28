// Matterhorn interface contracts. Blueprint Section 6.
//
// FROZEN. Field renames, type loosening, or optionality changes require a Deviations entry
// and Report disclosure; additive optional fields are allowed only with validator coverage.
// Gate 0 carries 6.1 and 6.2 only (plus Lang, which 6.3 needs and 6.2 already implies);
// the rest of Section 6 lands at Gate 1.
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

export type Lang = 'en' | 'id';
