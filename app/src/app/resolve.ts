/**
 * The one URL resolver, and the two things every caller needs around it.
 *
 * Two doors take a link: the `/share` GET target and the Dissect paste box. They have to answer
 * the same question about the same link in the same order, or a URL would mean one thing when a
 * chat app hands it over and another when a reader pastes it. So the order lives here once.
 *
 * Order is blueprint 6.11 check 8: exact, then prefix, then regex. A pattern that does not
 * compile is skipped rather than thrown: the validator refuses to publish one, and a share
 * arriving at a broken index still has to answer.
 */
import type { UrlIndex } from '../../../contracts/types';

type Entry = UrlIndex['entries'][number];

/** A resolved entry, plus which of the three rules matched it. */
export type Hit = Entry & { matched: Entry['match'] };

/** The first http(s) URL inside free text. Share sheets send prose with a link inside it. */
const URL_IN_TEXT = /https?:\/\/[^\s<>"']+/;

/**
 * The link a share carries. `url` wins when it is present; otherwise the first URL inside
 * `text`, and failing that the text itself, so an unresolvable share still reaches the queue
 * state rather than silently resolving to nothing.
 */
export function shareCandidate(url: string, text: string): string {
  const direct = url.trim();
  if (direct !== '') return direct;
  const trimmed = text.trim();
  return URL_IN_TEXT.exec(trimmed)?.[0] ?? trimmed;
}

export function resolveUrl(index: UrlIndex, url: string): Hit | null {
  for (const kind of ['exact', 'prefix', 'regex'] as const) {
    for (const entry of index.entries) {
      if (entry.match !== kind) continue;
      let hit = false;
      if (kind === 'exact') hit = entry.pattern === url;
      else if (kind === 'prefix') hit = url.startsWith(entry.pattern);
      else {
        try {
          hit = new RegExp(entry.pattern).test(url);
        } catch {
          hit = false;
        }
      }
      if (hit) return { ...entry, matched: kind };
    }
  }
  return null;
}

/**
 * The URL the demo chips paste. Read off the index by role rather than written into the app, so
 * the Gate C content swap moves the demo links without touching a component.
 */
export const roleUrl = (index: UrlIndex, role: Entry['role']): string =>
  index.entries.find((entry) => entry.role === role && entry.match === 'exact')?.pattern ?? '';
