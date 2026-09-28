/**
 * Data access for all content collections.
 * Every entry is a folder with one file per language (`de.mdx`, `en.mdx`). The source language
 * (`sourceLang` in src/config/site.ts) is the source of truth: an entry exists when its source file exists,
 * and other languages fall back to it until they are translated.
 */
import fs from 'node:fs';
import { getCollection, type CollectionEntry } from 'astro:content';
import { categories, sourceLang } from '../config/site';
import { buildVariants, readServiceFile, type Variant, type VariantKey } from './compose';
import { langs, type Lang } from './i18n';

type Coll = 'wiki' | 'guides' | 'stages' | 'faq' | 'pages';

export interface Localized<C extends Coll> {
  /** Folder path without language, e.g. `01-basics/03-cloud-hybrid-local` */
  key: string;
  /** Folder name without number, e.g. `cloud-hybrid-local`. Used for cross references. */
  id: string;
  /** Entry to render: the translation if present, otherwise the source language */
  entry: CollectionEntry<C>;
  source: CollectionEntry<C>;
  /** False when the requested language falls back to the source language */
  translated: boolean;
  /** URL slug per language (`slug:` in frontmatter, otherwise `id`) */
  slugs: Record<Lang, string>;
  /** URL slug in the requested language */
  slug: string;
}

const orderOf = (s: string) => (/^(\d+)-/.exec(s) ? parseInt(s, 10) : 999);
const stripOrder = (s: string) => s.replace(/^\d+-/, '');
const memo = new Map<string, Promise<unknown>>();
const once = <T>(key: string, fn: () => Promise<T>) => {
  if (!memo.has(key)) memo.set(key, fn());
  return memo.get(key) as Promise<T>;
};

async function localize<C extends Coll>(coll: C, lang: Lang): Promise<Localized<C>[]> {
  const all = (await getCollection(coll)) as CollectionEntry<C>[];
  const byId = new Map(all.map((e) => [e.id, e]));
  return all
    .filter((e) => e.id.endsWith(`/${sourceLang}`))
    .map((source) => {
      const key = source.id.slice(0, -(sourceLang.length + 1));
      const id = stripOrder(key.split('/').at(-1)!);
      const get = (l: Lang) => (l === sourceLang ? source : byId.get(`${key}/${l}`));
      const slugs = Object.fromEntries(langs.map((l) => [l, (get(l)?.data as { slug?: string } | undefined)?.slug ?? id])) as Record<Lang, string>;
      const tr = get(lang);
      return { key, id, entry: tr ?? source, source, translated: !!tr, slugs, slug: slugs[lang] };
    });
}

function assertUnique(kind: string, values: string[]) {
  const seen = new Set<string>();
  for (const s of values) {
    if (seen.has(s)) throw new Error(`[${kind}] "${s}" is used twice. Folder names and slugs must be unique.`);
    seen.add(s);
  }
}

/** Reading time in minutes for markdown text */
export const readingTime = (body = '') => Math.max(1, Math.round(body.replace(/<[^>]+>|```[\s\S]*?```/g, ' ').split(/\s+/).length / 180));

/* ---------------------------------------------------------------- wiki */

export interface WikiArticle extends Localized<'wiki'> {
  group: string;
  order: number;
  groupOrder: number;
}

export const getWiki = (lang: Lang) =>
  once(`wiki:${lang}`, async () => {
    const items: WikiArticle[] = (await localize('wiki', lang)).map((l) => {
      const [groupDir, dir] = l.key.split('/');
      return { ...l, group: stripOrder(groupDir), order: orderOf(dir), groupOrder: orderOf(groupDir) };
    });
    assertUnique('wiki', items.map((i) => i.id));
    for (const l of langs) assertUnique(`wiki slugs (${l})`, items.map((i) => i.slugs[l]));
    items.sort((a, b) => a.groupOrder - b.groupOrder || a.order - b.order);
    const groups: { id: string; items: WikiArticle[] }[] = [];
    for (const it of items) {
      const g = groups.at(-1)?.id === it.group ? groups.at(-1)! : (groups.push({ id: it.group, items: [] }), groups.at(-1)!);
      g.items.push(it);
    }
    return { items, groups };
  });

/* ---------------------------------------------------------- setup path */

export interface Guide extends Localized<'guides'> {
  order: number;
  /** Index within the stage (0-based) */
  index: number;
  stage: Stage;
  /** Number of <Step> blocks, used for progress tracking */
  steps: number;
}

export interface Stage {
  /** Anchor on the setup page in the requested language */
  slug: string;
  slugs: Record<Lang, string>;
  /** 1-based number */
  n: number;
  title: string;
  description: string;
  guides: Guide[];
  minutes: number;
}

export const getSetupPath = (lang: Lang) =>
  once(`setup:${lang}`, async () => {
    const byDir = new Map<string, Stage>();
    for (const s of await localize('stages', lang)) {
      byDir.set(s.key, { slug: s.slug, slugs: s.slugs, n: orderOf(s.key), title: s.entry.data.title, description: s.entry.data.description, guides: [], minutes: 0 });
    }
    const stages = [...byDir.values()].sort((a, b) => a.n - b.n);
    const guides: Guide[] = [];
    for (const l of await localize('guides', lang)) {
      const [dir, sub] = l.key.split('/');
      const stage = byDir.get(dir);
      if (!stage) throw new Error(`[guides] Folder "${dir}" has no stage file content/guides/${dir}/${sourceLang}.md`);
      const g: Guide = { ...l, order: orderOf(sub), index: 0, stage, steps: (l.source.body?.match(/<Step\b/g) ?? []).length };
      stage.guides.push(g);
      guides.push(g);
    }
    assertUnique('guides', guides.map((g) => g.id));
    for (const l of langs) assertUnique(`guide slugs (${l})`, guides.map((g) => g.slugs[l]));
    for (const s of stages) {
      s.guides.sort((a, b) => a.order - b.order);
      s.guides.forEach((g, i) => (g.index = i));
      s.minutes = s.guides.reduce((a, g) => a + g.entry.data.minutes, 0);
    }
    return { stages, guides: stages.flatMap((s) => s.guides) };
  });

/* ------------------------------------------------------------ services */

export type ServiceData = CollectionEntry<'services'>['data'];

export interface Service extends ServiceData {
  id: string;
  description: string;
  notes: string[];
  /** Rendered body of de.md / en.md (optional extra content) */
  text: CollectionEntry<'serviceTexts'>;
  translated: boolean;
  repoUrl: string;
  repoLabel: string;
  image: string;
  logo: string | null;
  filePath: string;
}

export const getServices = (lang: Lang) =>
  once(`services:${lang}`, async () => {
    const metas = await getCollection('services');
    const texts = new Map((await getCollection('serviceTexts')).map((e) => [e.id, e]));
    const list: Service[] = metas.map((m) => {
      const src = texts.get(`${m.id}/${sourceLang}`);
      if (!src) throw new Error(`[services/${m.id}] ${sourceLang}.md is missing`);
      const tr = texts.get(`${m.id}/${lang}`);
      const text = tr ?? src;
      const repo = m.data.links.repo;
      const repoUrl = /^https?:/.test(repo) ? repo : `https://github.com/${repo}`;
      const host = new URL(repoUrl).hostname.replace(/^www\./, '');
      const compose = readServiceFile(m.id, 'compose.yaml') ?? '';
      const image = /^\s+image:\s*(\S+)/m.exec(compose)?.[1] ?? '';
      return {
        ...m.data,
        id: m.id,
        description: text.data.description,
        notes: text.data.notes,
        text,
        translated: !!tr,
        repoUrl,
        repoLabel: host === 'github.com' ? 'GitHub' : host === 'codeberg.org' ? 'Codeberg' : host,
        image,
        logo: iconUrl(m.id, m.data.icon),
        filePath: `content/services/${m.id}`,
      };
    });
    list.sort((a, b) => categories.indexOf(a.category) - categories.indexOf(b.category) || a.name.localeCompare(b.name));
    return list;
  });

/** Icons are downloaded at build time by scripts/fetch-icons.mjs into public/icons/. */
function iconUrl(id: string, icon?: string) {
  const file = `${icon ?? id}.svg`;
  return fs.existsSync(`public/icons/${file}`) ? `/icons/${file}` : null;
}

const variantCache = new Map<string, Record<VariantKey, Variant>>();
export function getVariants(s: Pick<Service, 'id' | 'name' | 'main' | 'port' | 'hostPort' | 'subdomain' | 'subdomainOnly' | 'reverseProxy' | 'files' | 'traefikLabels'>) {
  if (!variantCache.has(s.id)) variantCache.set(s.id, buildVariants(s));
  return variantCache.get(s.id)!;
}

/* ----------------------------------------------------------------- misc */

export const getFaq = (lang: Lang) => once(`faq:${lang}`, async () => (await localize('faq', lang)).sort((a, b) => orderOf(a.key) - orderOf(b.key)));

export async function getPage(lang: Lang, name: 'imprint' | 'privacy') {
  return (await localize('pages', lang)).find((p) => p.key === name);
}

/** Path of the file a visitor should edit on GitHub */
export const sourcePath = (e: { filePath?: string }) => e.filePath?.replace(/^\.\//, '') ?? '';
