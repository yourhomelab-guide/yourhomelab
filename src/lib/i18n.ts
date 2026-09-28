import { defaultSetup, placeholders } from '../config/site';
import de from '../i18n/de.json';
import en from '../i18n/en.json';

export const langs = ['de', 'en'] as const;
export type Lang = (typeof langs)[number];
export const defaultLang: Lang = 'de';
export type UiKey = keyof typeof de;

const dicts: Record<Lang, Record<string, string>> = { de, en };

/** Translate a UI string. Falls back to German, then to the key itself. */
export function t(lang: Lang, key: UiKey | (string & {}), vars?: Record<string, string | number>): string {
  const s = dicts[lang][key] ?? dicts.de[key] ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? '')) : s;
}

export const useT = (lang: Lang) => (key: UiKey | (string & {}), vars?: Record<string, string | number>) => t(lang, key, vars);

export function formatDate(lang: Lang, d: Date) {
  return new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

export const otherLang = (lang: Lang): Lang => (lang === 'de' ? 'en' : 'de');

/** Language of the current page, derived from the URL (used by MDX components). */
export const langFromUrl = (u: URL): Lang => (u.pathname === '/de' || u.pathname.startsWith('/de/') ? 'de' : 'en');

/** Default text for placeholders at build time (the browser replaces them with "Mein Setup" values). */
export function placeholderDefaults(lang: Lang): Record<string, string> {
  const v: Record<string, string> = { SECRET: t(lang, 'code.secret') };
  for (const [ph, key] of Object.entries(placeholders)) v[ph] = String(defaultSetup[key]);
  return v;
}
