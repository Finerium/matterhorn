/**
 * The i18n layer: two flat bundles and one lookup.
 *
 * Every chrome string the shell says lives in `en.json` / `id.json`, keyed. Content copy never
 * comes through here: it arrives inside the artifact, already localized, and the renderers read
 * it with their own `t(ctx, copy)`. The two are deliberately separate, because a chrome string
 * is Matterhorn talking and an artifact string is the pipeline talking.
 *
 * Keys are flat and dotted, so the bundles diff cleanly and `scripts/i18n-scan.ts` can compare
 * declared keys against used keys with a string match rather than a tree walk. `{name}`
 * placeholders interpolate; nothing else is templated.
 *
 * Blueprint 6.9 binds this file's bundles exactly as it binds content: no verdict words in
 * either locale, no em dash, no emoji.
 */
import { createContext, useContext } from 'react';
import type { Lang } from '../../../contracts/types';
import en from './en.json';
import id from './id.json';

export type Key = keyof typeof en;

const BUNDLES: Record<Lang, Record<string, string>> = { en, id };

/**
 * The string for `key` in `lang`. An absent key falls back to English and then to the key
 * itself, which is visible in the UI and impossible to mistake for copy. The scan script is
 * what keeps that path unreachable; this is only what happens if it ever is reached.
 */
export function translate(lang: Lang, key: Key, vars?: Record<string, string | number>): string {
  const text = BUNDLES[lang][key] ?? BUNDLES.en[key] ?? key;
  if (vars === undefined) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = vars[name];
    return value === undefined ? whole : String(value);
  });
}

export const LangContext = createContext<Lang>('en');

export const useLang = (): Lang => useContext(LangContext);

/**
 * The bound lookup every component uses: `t('radar.footer')`.
 * ponytail: a plain function rather than a memoized one. It closes over a string, and every
 * consumer re-renders on a language change anyway, which is the only time it changes.
 */
export function useT(): (key: Key, vars?: Record<string, string | number>) => string {
  const lang = useContext(LangContext);
  return (key, vars) => translate(lang, key, vars);
}
