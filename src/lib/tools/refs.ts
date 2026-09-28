/**
 * Build-time link map for tools: resolves references like `g:ssh-keys` (guide id), `w:vpn` (wiki id),
 * `s:caddy` (service id), `t:docs-export` (tool id) and `g@notfallplan` (guide by German slug)
 * to `{ href, title }` in the page language. Unknown references are left out.
 */
import { tools } from '../../config/site';
import { getServices, getSetupPath, getWiki } from '../content';
import { t, type Lang } from '../i18n';
import { url } from '../routes';

export interface Ref {
  href: string;
  title: string;
}

export async function linkMap(lang: Lang): Promise<Record<string, Ref>> {
  const [{ guides }, { items: wiki }, services] = await Promise.all([getSetupPath(lang), getWiki(lang), getServices(lang)]);
  const map: Record<string, Ref> = {};
  for (const g of guides) {
    const r = { href: url.guide(lang, g.slug), title: g.entry.data.title };
    map[`g:${g.id}`] = r;
    map[`g@${g.slugs.de}`] = r;
  }
  for (const w of wiki) map[`w:${w.id}`] = { href: url.wiki(lang, w.slug), title: w.entry.data.title };
  for (const s of services) map[`s:${s.id}`] = { href: url.service(lang, s.id), title: s.name };
  for (const x of tools) map[`t:${x.id}`] = { href: url.tool(lang, x.id), title: t(lang, `tools.${x.id}.title`) };
  return map;
}
