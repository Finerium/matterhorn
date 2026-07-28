/**
 * A3 Clusterer: multilingual sentence embeddings, cosine, greedy agglomeration.
 *
 * Model: Xenova/multilingual-e5-small through transformers.js, per blueprint 5.4. The e5 family
 * is trained with instruction prefixes, so every headline is embedded as `query: <headline>`;
 * pooling is mean over the token axis and vectors are L2 normalized, which makes cosine a plain
 * dot product.
 *
 * WEIGHTS ARE DOWNLOADED ON FIRST RUN, roughly 120 MB, and cached OUTSIDE the repo: at
 * `$HF_HOME/transformers` when HF_HOME is set, else `~/.cache/huggingface/transformers`, the
 * standard Hugging Face location. Nothing model-shaped is ever written inside the repo, so
 * nothing model-shaped can be committed. The first run needs network access; every run after
 * it is offline and deterministic.
 *
 * WHAT IS EMBEDDED IS NOT THE RAW HEADLINE. Measured on the AC-PIPE-3 golden set, raw-headline
 * cosine ranks the adversarial near-variant pair ("the canal levy pays for the whole flood
 * program" against "the market levy pays for the whole sanitation program", 0.944) ABOVE every
 * true cross-language pair in the set (the canal headline against its own Indonesian sibling,
 * 0.882). Shared sentence frame beats shared referent at this model size, so no threshold on
 * raw headlines both merges families and keeps the split pair apart. Dropping function words
 * first raises the referent's share of the signal enough to separate them. See the Gate C
 * report for the full sweep.
 *
 * Grouping: records are sorted by id, then each record joins the best open cluster whose
 * CENTROID similarity clears THRESHOLD, else opens its own. Centroid rather than single-link
 * because single-link chains, and chaining is exactly how the split pair merges.
 *
 * ponytail: greedy one pass, no k-means, no re-assignment sweep, no body text. Ceiling: A3 is
 * deliberately biased toward splitting rather than merging, because merging two narratives into
 * one family is an editorial claim the product has no evidence for, while splitting one family
 * in two is a visible missed link. Upgrade path if families need to be recovered from headlines
 * alone: embed the article lede, not the headline.
 */
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Tuned on tests/pipeline/evals/cluster-golden.json. The separating band there runs from 0.916
 * (the highest cross-family similarity, the split pair's Indonesian half) to 0.935 (the lowest
 * within-family similarity that still merges); 0.925 is its midpoint. Purity 1.000.
 */
export const THRESHOLD = 0.925;

/**
 * Function words, both locales: articles, prepositions, conjunctions, copulas, quantifiers,
 * particles. Deliberately NOT a list of words from the fixtures: no nouns, no lexical verbs, so
 * it removes sentence frame and leaves referent. Whole tokens, lowercased, accent folded.
 */
const FUNCTION_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'of', 'for', 'to', 'in', 'on', 'at', 'from', 'by',
  'with', 'into', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'that', 'this', 'these',
  'those', 'it', 'its', 'all', 'whole', 'every', 'more', 'than', 'up', 'out', 'over', 'after',
  'before', 'pending', 'no', 'not', 'per', 'about',
  'di', 'ke', 'dari', 'yang', 'dan', 'atau', 'untuk', 'pada', 'dengan', 'itu', 'ini', 'oleh',
  'para', 'sebuah', 'seluruh', 'semua', 'akan', 'telah', 'sudah', 'juga', 'saja', 'lebih',
  'masih', 'agar', 'karena', 'sebagai', 'dalam', 'tidak', 'bukan', 'adalah', 'ada', 'atas',
  'kepada', 'terhadap', 'antara', 'hingga', 'sampai', 'setiap',
]);

export interface ClusterRecord {
  id: string;
  headline: string;
}

export interface Assignment {
  id: string;
  cluster: string;
}

/** Lowercase, drop punctuation, drop function words. Falls back to the tidied headline if that empties it. */
export function referentText(headline: string): string {
  const tokens = headline
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number}\s]/gu, ' ')
    .split(/\s+/)
    .filter((word) => word !== '');
  const kept = tokens.filter((word) => !FUNCTION_WORDS.has(word));
  return (kept.length > 0 ? kept : tokens).join(' ');
}

/** `query: ` prefixed, mean pooled, L2 normalized. One batch, so one model load per stage. */
export async function embed(texts: string[]): Promise<Float32Array[]> {
  const { env, pipeline } = await import('@huggingface/transformers');
  env.cacheDir = join(process.env.HF_HOME ?? join(homedir(), '.cache', 'huggingface'), 'transformers');
  const extract = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small');
  const output = await extract(
    texts.map((text) => `query: ${text}`),
    { pooling: 'mean', normalize: true },
  );
  return (output.tolist() as number[][]).map((row) => Float32Array.from(row));
}

/** Cosine similarity of two L2-normalized vectors, which is their dot product. */
export function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) dot += (a[i] ?? 0) * (b[i] ?? 0);
  return dot;
}

/** Greedy agglomeration over cluster centroids. Exported so the threshold sweep can drive it. */
export function group(
  records: ClusterRecord[],
  vectors: Float32Array[],
  threshold = THRESHOLD,
): Assignment[] {
  const order = records
    .map((record, i) => ({ record, vector: vectors[i] as Float32Array }))
    .sort((a, b) => a.record.id.localeCompare(b.record.id));

  const clusters: Array<{ name: string; centroid: Float32Array; size: number }> = [];
  const assignments: Assignment[] = [];
  for (const { record, vector } of order) {
    let best: { cluster: (typeof clusters)[number]; score: number } | undefined;
    for (const cluster of clusters) {
      const score = cosine(vector, cluster.centroid);
      if (score >= threshold && (best === undefined || score > best.score)) best = { cluster, score };
    }
    if (best === undefined) {
      const name = `c-${record.id}`;
      clusters.push({ name, centroid: Float32Array.from(vector), size: 1 });
      assignments.push({ id: record.id, cluster: name });
      continue;
    }
    // Running mean, renormalized, so the centroid stays a unit vector and cosine stays a dot.
    const { centroid, size } = best.cluster;
    let norm = 0;
    for (let i = 0; i < centroid.length; i += 1) {
      const merged = ((centroid[i] ?? 0) * size + (vector[i] ?? 0)) / (size + 1);
      centroid[i] = merged;
      norm += merged * merged;
    }
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < centroid.length; i += 1) centroid[i] = (centroid[i] ?? 0) / norm;
    best.cluster.size += 1;
    assignments.push({ id: record.id, cluster: best.cluster.name });
  }
  return assignments;
}

/** Embed then group. The whole stage, minus file IO. */
export async function cluster(records: ClusterRecord[], threshold = THRESHOLD): Promise<Assignment[]> {
  if (records.length === 0) return [];
  return group(records, await embed(records.map((r) => referentText(r.headline))), threshold);
}
