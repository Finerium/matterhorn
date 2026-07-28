/**
 * Gate C pipeline configuration: who executes the LLM slots, and under which model floor.
 *
 * EXECUTOR (plan ADR-2). Two shapes exist in the type, one is wired.
 *
 * `claude-code` is the shipping executor: the LLM slots A5..A11 are executed by the
 * Orchestrator's subagents, which write their structured output to
 * `<run>/slots/<narrative>/<role>.json`. The runner never calls a model. It writes the input
 * each slot is given (`<role>.input.json`), and on the next invocation validates the staged
 * output against `pipeline/agents/<role>.schema.json` and ingests it. That is what makes every
 * stage independently CLI drivable and the whole run resumable.
 *
 * `api` is present, typed, and deliberately NOT wired to a key. Nothing in this repo reads an
 * API key, and `assertWired` refuses rather than silently running. It exists so the shape of a
 * hosted executor is on record, not so it can be switched on by editing one line.
 */

/** The seven LLM slots. A1..A4, A12 and A13 are deterministic code and take no model. */
export type SlotRole = 'A5' | 'A6' | 'A7' | 'A8' | 'A9' | 'A10' | 'A11';

export const SLOT_ROLES: readonly SlotRole[] = ['A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A11'];

export interface ClaudeCodeExecutor {
  kind: 'claude-code';
}

export interface ApiExecutor {
  kind: 'api';
  baseUrl: string;
  /** Name of the environment variable holding the key. Never a key, never read. */
  apiKeyEnv: string;
  models: Record<SlotRole, string>;
}

export type Executor = ClaudeCodeExecutor | ApiExecutor;

export const executor: Executor = { kind: 'claude-code' };

/** ADR-2. The api branch type checks and refuses; it has no client and no key. */
export function assertWired(candidate: Executor): asserts candidate is ClaudeCodeExecutor {
  if (candidate.kind === 'api') {
    throw new Error(
      'the api executor is typed and deliberately unwired (ADR-2). Slots run under the claude-code executor: the orchestrator stages each slot output and the runner validates and ingests it.',
    );
  }
}

export interface ModelFloor {
  /** The model the slot must run on, as requested and as reported back by the agent. */
  model: string;
  effort: 'max';
  /**
   * `mandatory` means exactly this model: a slot that reports another identity is respawned.
   * `minimum` means this model or stronger.
   */
  floor: 'mandatory' | 'minimum';
  why: string;
}

/**
 * Blueprint 9.6, binding. A5, A6, A10 run on Fable 5 at effort max; A7, A8, A9, A11 run on
 * Opus 5 at effort max or stronger. Every slot logs the requested model, the identity the agent
 * reports back, its start and finish timestamps and the hash of its input; those land in the
 * artifact's `manifest.steps`, which is what AC-PIPE-7 is read against.
 */
export const MODEL_POLICY: Record<SlotRole, ModelFloor> = {
  A5: {
    model: 'claude-fable-5',
    effort: 'max',
    floor: 'mandatory',
    why: 'Causal Extractor: the asserted spine is the substrate every later slot reasons over, so structural errors here are unrecoverable downstream.',
  },
  A6: {
    model: 'claude-fable-5',
    effort: 'max',
    floor: 'mandatory',
    why: 'Hidden-Node Hunter: recall of parties nobody named is the hardest inference in the fleet, and it runs on a fresh disjoint context with no help from A5.',
  },
  A7: {
    model: 'claude-opus-5',
    effort: 'max',
    floor: 'minimum',
    why: 'Evidence Grounder: the only minter of numbers, constrained to the source registry.',
  },
  A8: {
    model: 'claude-opus-5',
    effort: 'max',
    floor: 'minimum',
    why: 'Cascade Historian: an echo match is a claim about history, and null is the correct answer almost every time.',
  },
  A9: {
    model: 'claude-opus-5',
    effort: 'max',
    floor: 'minimum',
    why: 'Narrator: in-language generation in two locales, every sentence bound to graph elements, under the verdict-free lexicon.',
  },
  A10: {
    model: 'claude-fable-5',
    effort: 'max',
    floor: 'mandatory',
    why: 'Symmetry Auditor: it can block publication, and mirror-framing dissection is the judgment the product stakes its neutrality on.',
  },
  A11: {
    model: 'claude-opus-5',
    effort: 'max',
    floor: 'minimum',
    why: 'Fidelity Guard: sentence-level traceability, which a mechanical lint cannot decide.',
  },
};

/** The string recorded in `manifest.steps[].model` when a slot does not report its own identity. */
export const requestedModel = (role: SlotRole): string =>
  `${MODEL_POLICY[role].model} effort=${MODEL_POLICY[role].effort}`;
