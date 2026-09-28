/**
 * Keeps translations in sync with the source language (`sourceLang` in src/config/site.ts).
 *
 *   npm run translate                      same as `status`
 *   npm run translate status               list missing, outdated and machine-translated files
 *   npm run translate deepl [files…]       translate missing/outdated files with DeepL (needs DEEPL_API_KEY)
 *   npm run translate stamp <files…|--all> [--by claude|human]
 *                                          mark target files as up to date after translating them yourself
 *
 * Every content entry is a folder with one file per language (de.mdx, en.mdx …). The UI strings live in
 * src/i18n/<lang>.json. `.translations.lock.json` remembers the hash of the source a translation was made
 * from and who made it (deepl, claude, human), so machine translations can be polished later.
 *
 * Add `translation: manual` to a target file's frontmatter to never overwrite it automatically.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

const LOCK = '.translations.lock.json';
const SRC = /sourceLang:\s*'de'\s*\|\s*'en'\s*=\s*'(\w+)'/.exec(fs.readFileSync('src/config/site.ts', 'utf8'))?.[1] ?? 'de';
const DST = SRC === 'de' ? 'en' : 'de';
const ROUTES = {
  de: { home: '/de/', wiki: '/de/nachschlagen/', setup: '/de/einrichten/', services: '/de/dienste/', impressum: '/de/impressum/', datenschutz: '/de/datenschutz/' },
  en: { home: '/en/', wiki: '/en/wiki/', setup: '/en/setup/', services: '/en/services/', impressum: '/en/legal-notice/', datenschutz: '/en/privacy/' },
};

const [cmd = 'status', ...rest] = process.argv.slice(2);
const by = rest.includes('--by') ? rest[rest.indexOf('--by') + 1] : 'human';
const files = rest.filter((a, i) => !a.startsWith('--') && rest[i - 1] !== '--by');

const hash = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
const read = (f) => fs.readFileSync(f, 'utf8');
const lock = fs.existsSync(LOCK) ? JSON.parse(read(LOCK)) : {};
const saveLock = () =>
  fs.writeFileSync(LOCK, JSON.stringify(Object.fromEntries(Object.keys(lock).sort().map((k) => [k, lock[k]])), null, 2) + '\n');

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = `${dir}/${e.name}`;
    return e.name.startsWith('_') ? [] : e.isDirectory() ? walk(p) : [p];
  });
}

/* ------------------------------------------------------------ inventory */

const splitFm = (text) => {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  return m ? { fm: YAML.parse(m[1]) ?? {}, body: m[2] } : { fm: {}, body: text };
};

/** All [source, target] pairs */
function pairs() {
  const out = walk('content')
    .filter((f) => new RegExp(`/${SRC}\\.mdx?$`).test(f))
    .map((f) => [f, f.replace(new RegExp(`/${SRC}(\\.mdx?)$`), `/${DST}$1`)]);
  out.push([`src/i18n/${SRC}.json`, `src/i18n/${DST}.json`]);
  return out;
}

function state([src, dst]) {
  const h = hash(read(src));
  if (dst.endsWith('.json')) {
    const s = JSON.parse(read(src));
    const d = fs.existsSync(dst) ? JSON.parse(read(dst)) : {};
    const keys = Object.keys(s).filter((k) => !(k in d) || lock[`${src}#${k}`]?.hash !== hash(s[k]));
    return { src, dst, h, status: keys.length ? 'outdated' : 'ok', keys };
  }
  if (!fs.existsSync(dst)) return { src, dst, h, status: 'missing' };
  if (splitFm(read(dst)).fm.translation === 'manual') return { src, dst, h, status: 'manual' };
  const l = lock[src];
  if (!l || l.hash !== h) return { src, dst, h, status: 'outdated' };
  return { src, dst, h, status: l.by === 'deepl' ? 'machine' : 'ok' };
}

/* --------------------------------------------------------------- status */

if (cmd === 'status') {
  const all = pairs().map(state);
  const show = (s, label) => {
    const list = all.filter((x) => x.status === s);
    if (list.length) console.log(`\n${label} (${list.length})\n${list.map((x) => `  ${x.dst}${x.keys ? `: ${x.keys.join(', ')}` : ''}`).join('\n')}`);
  };
  console.log(`Source language: ${SRC} → ${DST}`);
  show('missing', 'Missing');
  show('outdated', 'Outdated (source changed)');
  show('machine', 'Machine-translated by DeepL (could be polished)');
  console.log(`\nUp to date: ${all.filter((x) => x.status === 'ok').length}, manual: ${all.filter((x) => x.status === 'manual').length}`);
  process.exit(0);
}

/* ---------------------------------------------------------------- stamp */

if (cmd === 'stamp') {
  if (rest.includes('--all')) files.push(...pairs().filter(([, d]) => fs.existsSync(d)).map(([, d]) => d));
  if (!files.length) {
    console.error('Usage: npm run translate stamp <target or source files…|--all> [--by claude|human]');
    process.exit(1);
  }
  for (const f of files) {
    const p = pairs().find(([s, d]) => s === f || d === f);
    if (!p) {
      console.error(`✗ ${f}: not a translatable file`);
      continue;
    }
    const [src, dst] = p;
    if (src.endsWith('.json')) {
      const s = JSON.parse(read(src));
      for (const k of Object.keys(s)) lock[`${src}#${k}`] = { hash: hash(s[k]), by };
    } else lock[src] = { hash: hash(read(src)), by };
    console.log(`✓ ${dst} (${by})`);
  }
  saveLock();
  process.exit(0);
}

/* ---------------------------------------------------------------- deepl */

if (cmd !== 'deepl') {
  console.error(`Unknown command "${cmd}". Use status, deepl or stamp.`);
  process.exit(1);
}
const KEY = process.env.DEEPL_API_KEY;
if (!KEY) {
  console.error('DEEPL_API_KEY is not set.');
  process.exit(1);
}
// Free keys end in ':fx' and use api-free.deepl.com. DEEPL_API_URL overrides the detection.
let API = process.env.DEEPL_API_URL || (KEY.endsWith(':fx') ? 'https://api-free.deepl.com/v2' : 'https://api.deepl.com/v2');
let charsSent = 0;

async function deepl(texts) {
  // DEEPL_API_KEY=dry echoes the input: useful to check that code, links and components survive untouched
  if (KEY === 'dry') return texts;
  const out = [];
  for (let i = 0; i < texts.length; i += 50) {
    const chunk = texts.slice(i, i + 50);
    charsSent += chunk.reduce((a, t) => a + t.length, 0);
    const res = await fetch(`${API}/translate`, {
      method: 'POST',
      headers: { Authorization: `DeepL-Auth-Key ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: chunk,
        source_lang: SRC.toUpperCase(),
        target_lang: DST === 'en' ? 'EN-US' : 'DE',
        tag_handling: 'xml',
        preserve_formatting: true,
        split_sentences: 'nonewlines',
        ...(DST === 'de' ? { formality: 'less' } : {}),
      }),
    });
    // A key for the other plan gets 403 "Wrong endpoint": switch once and retry
    if (res.status === 403 && !process.env.DEEPL_API_URL && !deepl.switched) {
      deepl.switched = true;
      API = API.includes('api-free') ? 'https://api.deepl.com/v2' : 'https://api-free.deepl.com/v2';
      i -= 50;
      continue;
    }
    if (!res.ok) throw new Error(`DeepL ${res.status}: ${await res.text()}`);
    out.push(...(await res.json()).translations.map((t) => t.text));
  }
  return out;
}

/* ---- protecting everything that is not prose ---- */

const xmlEsc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const xmlUnesc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

/** Maps German URLs to their English counterparts (and vice versa) */
const linkMap = (() => {
  const map = new Map();
  for (const [coll, section] of [['wiki', 'wiki'], ['guides', 'setup']]) {
    for (const f of walk(`content/${coll}`).filter((f) => new RegExp(`/${SRC}\\.mdx$`).test(f))) {
      const dir = path.dirname(f);
      const id = path.basename(dir).replace(/^\d+-/, '');
      const slugOf = (lang) => {
        const file = `${dir}/${lang}.mdx`;
        return (fs.existsSync(file) && splitFm(read(file)).fm.slug) || id;
      };
      map.set(`${ROUTES[SRC][section]}${slugOf(SRC)}/`, `${ROUTES[DST][section]}${slugOf(DST)}/`);
    }
  }
  for (const k of Object.keys(ROUTES[SRC])) map.set(ROUTES[SRC][k], ROUTES[DST][k]);
  return (url) => {
    const [p, anchor = ''] = url.split('#');
    if (map.has(p)) return map.get(p) + (anchor ? `#${anchor}` : '');
    for (const [from, to] of [...map].sort((a, b) => b[0].length - a[0].length)) if (p.startsWith(from)) return to + p.slice(from.length) + (anchor ? `#${anchor}` : '');
    return url;
  };
})();

/** Turns one line of markdown prose into DeepL XML. Returns [xml, restore]. */
function toXml(text) {
  const keep = [];
  const links = [];
  const hold = (s) => `<x i="${keep.push(s) - 1}"/>`;
  let s = text;
  // Placeholders first, so nothing inside them is touched
  s = s.replace(/`[^`]+`/g, (m) => `\u0000${keep.push(m) - 1}\u0000`);
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) => `\u0001${links.push({ t, u }) - 1}\u0001`);
  s = s.replace(/<\/?[A-Za-z][^>]*>|\{[^}]*\}|__[A-Z_]+__/g, (m) => `\u0000${keep.push(m) - 1}\u0000`);
  s = xmlEsc(s);
  s = s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*\w])\*(?!\s)(.+?)\*(?!\w)/g, '$1<i>$2</i>');
  s = s.replace(/\u0000(\d+)\u0000/g, '<x i="$1"/>');
  s = s.replace(/\u0001(\d+)\u0001/g, (_, i) => `<a i="${i}">${xmlEsc(links[i].t)}</a>`);
  const restore = (x) =>
    xmlUnesc(
      x
        .replace(/<a i="(\d+)">([\s\S]*?)<\/a>/g, (_, i, t) => `[${t}](${linkMap(links[i].u)})`)
        .replace(/<\/?b>/g, '**')
        .replace(/<\/?i>/g, '*'),
    ).replace(/<x i="(\d+)"\s*\/>|<x i="(\d+)"><\/x>/g, (_, a, b) => keep[Number(a ?? b)]);
  return [s, restore];
}

/** Collects translatable pieces of a file, translates them in one go and rebuilds the file. */
async function translateFile(src, dst) {
  const { fm, body } = splitFm(read(src));
  const jobs = []; // { xml, set(translated) }
  const text = (value, set) => {
    if (typeof value !== 'string' || !value.trim()) return set(value);
    const [xml, restore] = toXml(value);
    jobs.push({ xml, set: (t) => set(restore(t)) });
  };

  // Frontmatter: only human-readable fields
  const outFm = { ...fm };
  delete outFm.slug;
  delete outFm.translation;
  for (const k of ['title', 'description', 'question', 'summary', 'updated']) if (k in fm) text(fm[k], (v) => (outFm[k] = v));
  for (const k of ['notes', 'requires']) if (Array.isArray(fm[k])) fm[k].forEach((v, i) => text(v, (t) => ((outFm[k] ??= [...fm[k]])[i] = t)));
  if (fs.existsSync(dst)) {
    const old = splitFm(read(dst)).fm;
    if (old.slug) outFm.slug = old.slug;
  }

  // Body, line by line
  const lines = body.split('\n');
  const out = [...lines];
  let fence = null;
  let jsx = false;
  lines.forEach((line, i) => {
    const set = (v) => (out[i] = v);
    if (fence) {
      if (line.trim().startsWith(fence)) fence = null;
      return;
    }
    const f = /^\s*(```|~~~)/.exec(line);
    if (f) return void (fence = f[1]);
    if (/^\s*<!--/.test(line) || !line.trim()) return;
    // Multi-line JSX (e.g. <Quiz … />): translate only string values of well-known props
    if (jsx || (/^\s*<[A-Z]/.test(line) && !/>\s*$/.test(line))) {
      jsx = !/^\s*\/?>\s*$|\/>\s*$/.test(line);
      const m = /^(.*?\b(?:question|label|title|text):\s*")((?:[^"\\]|\\.)*)(".*)$/.exec(line);
      if (m) text(m[2], (t) => set(m[1] + t.replace(/"/g, '\\"') + m[3]));
      return;
    }
    // Single-line component tags: translate title="…"
    if (/^\s*<\/?[A-Z]/.test(line)) {
      const m = /^(.*\btitle=")([^"]*)(".*)$/.exec(line);
      if (m) text(m[2], (t) => set(m[1] + t.replace(/"/g, '&quot;') + m[3]));
      return;
    }
    // Tables
    if (/^\s*\|/.test(line)) {
      if (/^\s*\|[\s:|-]+\|\s*$/.test(line)) return;
      const cells = line.split('|');
      const res = [...cells];
      let pending = 0;
      cells.forEach((c, ci) => {
        if (ci === 0 || ci === cells.length - 1 || !c.trim()) return;
        const [, lead, core, trail] = /^(\s*)(.*?)(\s*)$/.exec(c);
        pending++;
        text(core, (t) => {
          res[ci] = lead + t + trail;
          if (--pending === 0) set(res.join('|'));
        });
      });
      return;
    }
    // Prose, keeping list/heading/quote markers
    const [, prefix, rest] = /^(\s*(?:#{1,6}\s+|[-*+]\s+|\d+\.\s+|>\s*)*)(.*)$/.exec(line);
    if (rest.trim()) text(rest, (t) => set(prefix + t));
  });

  const translated = await deepl(jobs.map((j) => j.xml));
  translated.forEach((t, i) => jobs[i].set(t));

  const fmText = Object.keys(outFm).length ? `---\n${YAML.stringify(outFm, { lineWidth: 0 }).trimEnd()}\n---\n` : '';
  fs.writeFileSync(dst, fmText + out.join('\n'));
}

async function translateUi(src, dst, keys) {
  const s = JSON.parse(read(src));
  const d = fs.existsSync(dst) ? JSON.parse(read(dst)) : {};
  const jobs = keys.map((k) => toXml(s[k]));
  const t = await deepl(jobs.map((j) => j[0]));
  keys.forEach((k, i) => (d[k] = jobs[i][1](t[i])));
  const merged = Object.fromEntries(Object.keys(s).map((k) => [k, d[k] ?? s[k]]));
  fs.writeFileSync(dst, JSON.stringify(merged, null, 2) + '\n');
  keys.forEach((k) => (lock[`${src}#${k}`] = { hash: hash(s[k]), by: 'deepl' }));
}

const todo = pairs()
  .map(state)
  .filter((x) => (files.length ? files.includes(x.src) || files.includes(x.dst) : ['missing', 'outdated'].includes(x.status)));
if (!todo.length) {
  console.log('Nothing to translate.');
  process.exit(0);
}
let failed = 0;
for (const x of todo) {
  try {
    if (x.keys) await translateUi(x.src, x.dst, x.keys);
    else {
      await translateFile(x.src, x.dst);
      lock[x.src] = { hash: x.h, by: 'deepl' };
    }
    console.log(`✓ ${x.dst}`);
  } catch (e) {
    failed++;
    console.error(`✗ ${x.dst}: ${e.message}`);
  }
  saveLock();
}
if (KEY !== 'dry') try {
  const u = await (await fetch(`${API}/usage`, { headers: { Authorization: `DeepL-Auth-Key ${KEY}` } })).json();
  console.log(`\nSent ${charsSent} characters. DeepL usage this period: ${u.character_count} / ${u.character_limit}`);
} catch {}
process.exit(failed ? 1 : 0);
