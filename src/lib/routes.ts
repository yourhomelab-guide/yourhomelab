import { tools, type ToolId } from '../config/site';
import type { Lang } from './i18n';

/** Localized URL segments. Content slugs are shared between languages. */
const base = {
  de: { home: '/de/', wiki: '/de/nachschlagen/', setup: '/de/einrichten/', services: '/de/dienste/', homelabs: '/de/homelabs/', tools: '/de/werkzeuge/', impressum: '/de/impressum/', datenschutz: '/de/datenschutz/' },
  en: { home: '/en/', wiki: '/en/wiki/', setup: '/en/setup/', services: '/en/services/', homelabs: '/en/homelabs/', tools: '/en/tools/', impressum: '/en/legal-notice/', datenschutz: '/en/privacy/' },
} as const;

export type Section = keyof (typeof base)['de'];

export const url = {
  section: (lang: Lang, s: Section) => base[lang][s],
  wiki: (lang: Lang, slug: string) => `${base[lang].wiki}${slug}/`,
  guide: (lang: Lang, slug: string) => `${base[lang].setup}${slug}/`,
  stage: (lang: Lang, slug: string) => `${base[lang].setup}#${slug}`,
  service: (lang: Lang, id: string) => `${base[lang].services}${id}/`,
  homelab: (lang: Lang, id: string) => `${base[lang].homelabs}${id}/`,
  /** Tool page; `id` from `tools` in src/config/site.ts */
  tool: (lang: Lang, id: ToolId) => `${base[lang].tools}${tools.find((t) => t.id === id)!.slug[lang]}/`,
};
