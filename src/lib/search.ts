/** Builds the search index served as /search-<lang>.json (loaded lazily when the search opens). */
import { getServices, getSetupPath, getWiki } from './content';
import { t, type Lang } from './i18n';
import { url } from './routes';

export async function searchIndex(lang: Lang) {
  const [wiki, { stages }, services] = await Promise.all([getWiki(lang), getSetupPath(lang), getServices(lang)]);
  const pad = (n: number) => String(n).padStart(2, '0');
  return [
    ...wiki.items.map((a) => ({ g: 'wiki', t: a.entry.data.title, s: t(lang, `wiki.group.${a.group}`), u: url.wiki(lang, a.slug), k: a.entry.data.description ?? '' })),
    ...stages.flatMap((s) =>
      s.guides.map((g) => ({ g: 'setup', t: g.entry.data.title, s: `${t(lang, 'setup.stage', { n: pad(s.n) })} · ${s.title}`, u: url.guide(lang, g.slug), k: g.entry.data.description ?? '' })),
    ),
    ...services.map((s) => ({ g: 'services', t: s.name, s: `${t(lang, `category.${s.category}`)} · ${s.description}`, u: url.service(lang, s.id) })),
  ];
}
