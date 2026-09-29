/**
 * Links glossary terms (content/glossary/<lang>.yaml) in wiki articles and guides.
 *
 * Astro 7 renders Markdown/MDX with Sätteri by default, which runs "mdast plugins" instead of remark plugins.
 * `glossaryMdastPlugin` is registered in astro.config.mjs (`markdown.processor: satteri({ mdastPlugins })`,
 * which mdx() inherits). The default export is the same logic as a classic remark plugin, in case the site
 * ever switches to the unified processor (`@astrojs/markdown-remark`).
 *
 * - Only files under content/wiki/ and content/guides/, never the glossary page itself.
 * - Language from the file name (de.mdx / en.mdx), target /de/nachschlagen/glossar/#id or /en/wiki/glossary/#id.
 * - Only the first occurrence of each entry per page, at most MAX_LINKS links per page.
 * - Only plain text inside paragraphs (also in lists, callouts and steps). Never in headings, links, code,
 *   inline code, tables, inline JSX or component props.
 * - Whole words only. All-caps terms (NAT) and single lowercase words (root) match case-sensitively,
 *   everything else case-insensitively. Common endings (-s, -e, -n, -en, -es) are included in the link.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const MAX_LINKS = 8;
const DIR = fileURLToPath(new URL('../../content/glossary/', import.meta.url));
const TARGET = { de: '/de/nachschlagen/glossar/', en: '/en/wiki/glossary/' };

/** Node types whose text is never linked (the walk does not descend into them). */
const SKIP = new Set([
  'heading', 'link', 'linkReference', 'definition', 'image', 'imageReference', 'code', 'inlineCode', 'html',
  'table', 'yaml', 'toml', 'mdxjsEsm', 'mdxFlowExpression', 'mdxTextExpression', 'mdxJsxTextElement',
]);

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Glossary text as plain text for the hover popup: `code`, **bold** and [links](…) lose their markup */
const plain = (s = '') =>
  String(s)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
const isCaseSensitive = (p) => (/[A-Z]/.test(p) && !/[a-z]/.test(p)) || /^[a-z]+$/.test(p);

const cache = new Map();
function load(lang) {
  const file = `${DIR}${lang}.yaml`;
  let mtime = 0;
  try {
    mtime = fs.statSync(file).mtimeMs;
  } catch {
    return null;
  }
  const hit = cache.get(lang);
  if (hit && hit.mtime === mtime) return hit;

  const entries = parse(fs.readFileSync(file, 'utf8')) ?? [];
  /** lower-case pattern -> { id, pattern, caseSensitive, term, tip } */
  const byPattern = new Map();
  for (const e of entries) {
    for (const p of [e.term, ...(e.aliases ?? [])]) {
      if (!p) continue;
      const key = p.toLowerCase();
      if (!byPattern.has(key)) byPattern.set(key, { id: e.id, pattern: p, caseSensitive: isCaseSensitive(p), term: e.term, tip: plain(e.text) });
    }
  }
  // Longest first, so "Reverse Proxy" wins over "Proxy" and "Carrier-Grade NAT" over "NAT"
  const alts = [...byPattern.values()].map((v) => v.pattern).sort((a, b) => b.length - a.length).map(escapeRe);
  const re = new RegExp(
    `(?<![\\p{L}\\p{N}_\\-.])(${alts.join('|')})(s|e|n|en|es)?(?![\\p{L}\\p{N}_\\-]|\\.[\\p{L}\\p{N}])`,
    'giu',
  );
  const out = { mtime, re, byPattern };
  cache.set(lang, out);
  return out;
}

function langOf(path) {
  const p = path.replace(/\\/g, '/');
  if (!/\/content\/(wiki|guides)\//.test(p) || /\/\d+-glossary\//.test(p)) return null;
  const m = /\/(de|en)\.mdx?$/.exec(p);
  return m ? m[1] : null;
}

/**
 * Walks the tree and calls `replace(textNode, newNodes)` for every text node that gets links.
 * Does not mutate the tree itself.
 */
function linkTree(tree, lang, replace) {
  const g = load(lang);
  if (!g) return;
  const used = new Set();
  let count = 0;

  const linkText = (value) => {
    const nodes = [];
    let last = 0;
    for (const m of value.matchAll(g.re)) {
      if (count >= MAX_LINKS) break;
      const hit = g.byPattern.get(m[1].toLowerCase());
      if (!hit || used.has(hit.id)) continue;
      if (hit.caseSensitive && m[1] !== hit.pattern) continue;
      used.add(hit.id);
      count++;
      if (m.index > last) nodes.push({ type: 'text', value: value.slice(last, m.index) });
      nodes.push({
        type: 'link',
        url: `${TARGET[lang]}#${hit.id}`,
        // data-term / data-tip feed the hover popup (src/client/glossary.ts)
        data: { hProperties: { className: ['glossary-link'], dataTerm: hit.term, dataTip: hit.tip } },
        children: [{ type: 'text', value: m[0] }],
      });
      last = m.index + m[0].length;
    }
    if (!nodes.length) return null;
    if (last < value.length) nodes.push({ type: 'text', value: value.slice(last) });
    return nodes;
  };

  const walk = (node, inParagraph) => {
    const inP = inParagraph || node.type === 'paragraph';
    for (const child of node.children ?? []) {
      if (count >= MAX_LINKS) return;
      if (SKIP.has(child.type)) continue;
      if (child.type === 'text') {
        if (!inP) continue;
        const nodes = linkText(child.value);
        if (nodes) replace(child, nodes, node);
      } else if (child.children) {
        walk(child, inP);
      }
    }
  };
  walk(tree, false);
}

/** Sätteri mdast plugin (factory: only active for wiki and guide files). */
export const glossaryMdastPlugin = (ctx) => {
  const lang = ctx.fileURL ? langOf(fileURLToPath(ctx.fileURL)) : null;
  if (!lang) return null;
  return {
    name: 'glossary-links',
    before(root, c) {
      linkTree(root, lang, (node, nodes) => c.replaceNode(node, nodes));
    },
  };
};

/** Classic remark plugin (unified), same behavior. */
export default function remarkGlossary() {
  return (tree, file) => {
    const lang = langOf(file?.path ?? file?.history?.[0] ?? '');
    if (!lang) return;
    const replacements = [];
    linkTree(tree, lang, (node, nodes, parent) => replacements.push({ node, nodes, parent }));
    for (const { node, nodes, parent } of replacements) {
      parent.children.splice(parent.children.indexOf(node), 1, ...nodes);
    }
  };
}
