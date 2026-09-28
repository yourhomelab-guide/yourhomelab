/**
 * "Was ist neu": recently added or changed guides, wiki articles, services and homelabs.
 * Dates come from git (first commit touching the entry's folder = added, last = updated), so CI must build
 * with the full history (`fetch-depth: 0`).
 */
import { site } from '../config/site';
import { getHomelabs, getServices, getSetupPath, getWiki } from './content';
import { firstAdded, lastModified } from './git';
import { t, type Lang } from './i18n';
import { url } from './routes';

export type NewsKind = 'setup' | 'wiki' | 'services' | 'homelabs';

export interface NewsItem {
  kind: NewsKind;
  /** `new` when the entry was added on the same day as its last change */
  change: 'new' | 'updated';
  date: Date;
  title: string;
  description?: string;
  href: string;
}

/** Number of entries on the page and in the feed */
export const NEWS_LIMIT = 40;

const sameDay = (a: Date, b: Date) => a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);

function item(kind: NewsKind, folder: string, title: string, href: string, description?: string): NewsItem | null {
  const last = lastModified(folder);
  if (!last) return null;
  const first = firstAdded(folder) ?? last;
  return { kind, change: sameDay(first, last) ? 'new' : 'updated', date: last, title, description: description || undefined, href };
}

export async function getNews(lang: Lang, limit = NEWS_LIMIT): Promise<NewsItem[]> {
  const [{ guides }, { items: wiki }, services, labs] = await Promise.all([getSetupPath(lang), getWiki(lang), getServices(lang), getHomelabs()]);
  const all = [
    ...guides
      .filter((g) => g.source.data.status !== 'stub')
      .map((g) => item('setup', `content/guides/${g.key}`, g.entry.data.title, url.guide(lang, g.slug), g.entry.data.description)),
    ...wiki
      .filter((w) => w.source.data.status !== 'stub')
      .map((w) => item('wiki', `content/wiki/${w.key}`, w.entry.data.title, url.wiki(lang, w.slug), w.entry.data.description)),
    ...services.map((s) => item('services', s.filePath, s.name, url.service(lang, s.id), s.description)),
    ...labs.filter((l) => !l.data.example).map((l) => item('homelabs', `content/homelabs/${l.id}`, l.data.name, url.homelab(lang, l.id), l.data.summary)),
  ].filter((i): i is NewsItem => !!i);
  all.sort((a, b) => b.date.getTime() - a.date.getTime() || a.title.localeCompare(b.title));
  return all.slice(0, limit);
}

const esc = (s: string) =>
  s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/** RSS 2.0 feed for the "Was ist neu" page */
export async function newsFeed(lang: Lang): Promise<Response> {
  const items = await getNews(lang);
  const abs = (p: string) => new URL(p, site.url).href;
  const page = abs(url.section(lang, 'news'));
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '<channel>',
    `<title>${esc(`${site.name} · ${t(lang, 'news.title')}`)}</title>`,
    `<link>${esc(page)}</link>`,
    `<description>${esc(t(lang, 'news.lead'))}</description>`,
    `<language>${lang}</language>`,
    `<atom:link href="${esc(abs(url.newsFeed(lang)))}" rel="self" type="application/rss+xml" />`,
    items[0] ? `<lastBuildDate>${items[0].date.toUTCString()}</lastBuildDate>` : '',
    ...items.map((i) => {
      const link = abs(i.href);
      const label = `${t(lang, `news.${i.change}`)} · ${t(lang, `nav.${i.kind}`)}`;
      return [
        '<item>',
        `<title>${esc(i.title)}</title>`,
        `<link>${esc(link)}</link>`,
        // Changes with a new guid so feed readers show an update as a new item
        `<guid isPermaLink="false">${esc(`${link}#${i.date.toISOString()}`)}</guid>`,
        `<pubDate>${i.date.toUTCString()}</pubDate>`,
        `<category>${esc(label)}</category>`,
        i.description ? `<description>${esc(`${label}: ${i.description}`)}</description>` : `<description>${esc(label)}</description>`,
        '</item>',
      ].join('');
    }),
    '</channel>',
    '</rss>',
    '',
  ]
    .filter(Boolean)
    .join('\n');
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
