/**
 * Canonical artifact bytes and gate tokens. Blueprint 6.11 check 6.
 *
 * The single definition of the token recipe. The content validator (`scripts/validate-content.ts`),
 * the seed stamper (`staging/seed/stamp-seed.mjs`), and A12 at Gate C all consume this module, so
 * the stamper and the checker cannot drift apart.
 *
 * Recipe, exactly: take the artifact, replace `manifest.gates` with null, sort object keys
 * recursively (arrays keep their order), `JSON.stringify` with no added whitespace, sha256, hex.
 * Both gate tokens on an artifact carry that same hash, which is what makes a post-stamp edit to
 * any byte of the artifact detectable.
 *
 * ponytail: no test of its own. Check 6 over the Gate 1 fixture roots is the check: those tokens
 * were stamped by a separate implementation of this recipe, so a drift here turns the suite red.
 */
import { createHash } from 'node:crypto';

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Recursively key-sorted copy. Arrays keep their order. */
function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (isObj(v)) {
    return Object.fromEntries(
      Object.keys(v)
        .sort()
        .map((k) => [k, sortKeys(v[k])]),
    );
  }
  return v;
}

/**
 * The exact string the token hashes: the artifact with `manifest.gates` nulled, keys sorted,
 * no whitespace. A non-object artifact, or one with no manifest, is handled rather than thrown
 * on, because the validator hashes whatever the content root actually holds.
 */
export function canonicalBytes(artifact: unknown): string {
  if (!isObj(artifact)) return JSON.stringify(sortKeys(artifact));
  const manifest = artifact.manifest;
  const gatesNulled = { ...artifact, manifest: { ...(isObj(manifest) ? manifest : {}), gates: null } };
  return JSON.stringify(sortKeys(gatesNulled));
}

/** sha256 hex over `canonicalBytes(artifact)`. The value both gate tokens must carry. */
export function gateToken(artifact: unknown): string {
  return createHash('sha256').update(canonicalBytes(artifact)).digest('hex');
}
