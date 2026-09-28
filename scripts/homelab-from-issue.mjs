#!/usr/bin/env node
/**
 * Turns a "Homelab vorstellen" issue (.github/ISSUE_TEMPLATE/homelab.yml) into content/homelabs/<id>/homelab.md.
 * Used by .github/workflows/homelab-issue.yml; also runs locally:
 *
 *   node scripts/homelab-from-issue.mjs <body.md> [--author <github-login>] [--out <dir>]
 *
 * Input: the issue body as GitHub renders issue forms ("### Label\n\nValue"), from the file argument or $ISSUE_BODY.
 * $ISSUE_AUTHOR is the issue author's login (linked only if the "Verlinkt mein GitHub-Profil" box is checked).
 * On success it prints the file path; in GitHub Actions it also writes `slug`, `name` and `path` to $GITHUB_OUTPUT.
 * On invalid input it exits with code 1 and writes a readable `error` (German, for the issue comment).
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

/* Labels of the form fields (German, exactly as in homelab.yml) */
const F = {
  name: 'Name deines Homelabs',
  author: 'Wie sollen wir dich nennen?',
  summary: 'Kurzbeschreibung',
  location: 'Betriebsmodell',
  platform: 'Plattform',
  management: 'Verwaltung',
  proxy: 'Reverse Proxy',
  access: 'Zugriff von außen',
  servers: 'Anzahl Server',
  hardware: 'Hardware',
  watts: 'Stromverbrauch im Leerlauf (optional)',
  domain: 'Domain & DNS (optional)',
  auth: 'Login / Single Sign-On (optional)',
  backup: 'Backup (optional)',
  monitoring: 'Monitoring (optional)',
  services: 'Welche Dienste betreibst du?',
  story: 'Aufbau & Besonderheiten (optional)',
  link: 'Link zu mehr Infos (optional)',
  consent: 'Einverständnis',
};
const CONSENT_PUBLISH = 'Ich bin einverstanden, dass diese Angaben öffentlich';
const CONSENT_GITHUB = 'Verlinkt mein GitHub-Profil';

/* Dropdown option text → value in homelabFacets (src/config/site.ts). Keep in sync with homelab.yml. */
const MAP = {
  location: {
    'Lokal (alles zuhause)': 'local',
    'Hybrid (zuhause + Cloud/VPS)': 'hybrid',
    'Cloud / VPS': 'cloud',
  },
  platform: {
    'Linux direkt auf der Hardware': 'bare-metal',
    Proxmox: 'proxmox',
    TrueNAS: 'truenas',
    Unraid: 'unraid',
    'NAS (Synology, QNAP …)': 'nas',
    'Kubernetes / k3s': 'kubernetes',
    'Docker Swarm': 'swarm',
    Andere: 'other',
  },
  management: {
    'docker run': 'cli',
    'Docker Compose': 'compose',
    Portainer: 'portainer',
    Dockhand: 'dockhand',
    Dockge: 'dockge',
    Komodo: 'komodo',
    'GitOps (z. B. Flux, Argo CD, Git-Deployments)': 'gitops',
    Ansible: 'ansible',
    Andere: 'other',
  },
  proxy: {
    Traefik: 'traefik',
    Caddy: 'caddy',
    'Nginx Proxy Manager': 'npm',
    nginx: 'nginx',
    HAProxy: 'haproxy',
    Keiner: 'none',
    Anderer: 'other',
  },
  access: {
    Portfreigabe: 'port-forwarding',
    'VPN (WireGuard, Tailscale …)': 'vpn',
    'Tunnel (z. B. Cloudflare Tunnel)': 'tunnel',
    'VPS als Eingang': 'vps',
    'Nur im Heimnetz': 'lan-only',
  },
};

/* ------------------------------------------------------------------ parsing */

/** Splits the issue body into { label: value }. Empty answers ("_No response_", "None") become "". */
export function parseIssueForm(body) {
  const out = {};
  const parts = body.replace(/\r\n/g, '\n').split(/^###[ \t]+(.+?)[ \t]*$/m);
  for (let i = 1; i < parts.length; i += 2) {
    const v = parts[i + 1].trim();
    out[parts[i].trim()] = v === '_No response_' || v === 'None' ? '' : v;
  }
  return out;
}

/** Splits "A, B (x, y), C" at commas outside of parentheses (multi-select dropdowns). */
function splitOptions(s) {
  const res = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      res.push(cur);
      cur = '';
    } else cur += ch;
  }
  res.push(cur);
  return res.map((x) => x.trim()).filter(Boolean);
}

const norm = (s) => s.normalize('NFC').replace(/\.{3}/g, '…').replace(/\s+/g, ' ').trim().toLowerCase();

function mapOptions(facet, raw, errors) {
  const table = Object.fromEntries(Object.entries(MAP[facet]).map(([k, v]) => [norm(k), v]));
  const vals = [];
  for (const opt of splitOptions(raw)) {
    const v = table[norm(opt)];
    if (v) {
      if (!vals.includes(v)) vals.push(v);
    } else errors.push(`Unbekannte Auswahl bei „${F[facet]}“: „${opt}“`);
  }
  return vals;
}

/** Checked checkbox labels: "- [X] Label" */
const checked = (raw) => [...(raw ?? '').matchAll(/^\s*[-*]\s*\[[xX]\]\s*(.+)$/gm)].map((m) => m[1].trim());

const oneLine = (s) => s.replace(/\s*\n\s*/g, ' ').trim();

/** URL-safe folder name: lowercase, umlauts as ae/oe/ue/ss, digits and dashes only */
export function slugify(s) {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
}

/** Very small heuristic: counts common German vs. English words. Ties go to German (the form is German). */
export function guessLang(text) {
  const words = text.toLowerCase().match(/[a-zäöüß']+/g) ?? [];
  const de = new Set(['und', 'der', 'die', 'das', 'ist', 'mit', 'auf', 'ich', 'nicht', 'ein', 'eine', 'für', 'mein', 'meine', 'läuft', 'laufen', 'alle', 'auch', 'noch', 'über', 'zu', 'im', 'den', 'dem', 'wird', 'sind', 'habe', 'als', 'oder', 'dass', 'nur', 'bei', 'zum', 'zur']);
  const en = new Set(['and', 'the', 'is', 'with', 'on', 'my', 'not', 'a', 'an', 'for', 'all', 'also', 'runs', 'run', 'to', 'in', 'of', 'are', 'have', 'as', 'or', 'that', 'only', 'at', 'it', 'this', 'from', "i'm", 'i']);
  let d = 0;
  let e = 0;
  for (const w of words) {
    if (de.has(w)) d++;
    if (en.has(w)) e++;
  }
  d += (text.match(/[äöüß]/gi) ?? []).length * 0.5;
  return e > d ? 'en' : 'de';
}

/** Known services: id and display name from content/services/<id>/service.yaml */
function knownServices(root) {
  const dir = path.join(root, 'content/services');
  const map = new Map();
  if (!fs.existsSync(dir)) return map;
  for (const id of fs.readdirSync(dir)) {
    if (id.startsWith('_')) continue;
    const f = path.join(dir, id, 'service.yaml');
    if (!fs.existsSync(f)) continue;
    map.set(id.toLowerCase(), id);
    try {
      const name = parseYaml(fs.readFileSync(f, 'utf8'))?.name;
      if (name) map.set(String(name).toLowerCase(), id);
    } catch {}
  }
  return map;
}

/* ------------------------------------------------------------------- output */

/** Always double-quoted: JSON strings are valid YAML and handle colons, quotes, "#", leading dashes … */
const q = (s) => JSON.stringify(String(s));
const list = (a, quote = false) => `[${a.map((x) => (quote ? q(x) : x)).join(', ')}]`;

/**
 * Builds homelab.md from the parsed form. Returns { slug, name, content } or throws an Error whose
 * `problems` lists every issue found.
 */
export function buildHomelab(body, { author: login = '', today = new Date(), root = process.cwd() } = {}) {
  const f = parseIssueForm(body);
  const errors = [];
  const get = (k) => f[F[k]] ?? '';
  const required = ['name', 'author', 'summary', 'location', 'platform', 'management', 'servers', 'hardware', 'services'];
  for (const k of required) if (!get(k)) errors.push(`Pflichtfeld fehlt: „${F[k]}“`);

  const consent = checked(get('consent'));
  if (!consent.some((c) => c.startsWith(CONSENT_PUBLISH))) errors.push('Das Einverständnis zur Veröffentlichung ist nicht angehakt.');
  const linkGithub = consent.some((c) => c.startsWith(CONSENT_GITHUB));

  const location = get('location') ? mapOptions('location', get('location'), errors) : [];
  if (location.length > 1) errors.push(`Bei „${F.location}“ bitte nur eine Option wählen.`);
  const facets = {};
  for (const k of ['platform', 'management', 'proxy', 'access']) facets[k] = get(k) ? mapOptions(k, get(k), errors) : [];

  const serversN = /\d+/.exec(get('servers'))?.[0];
  const servers = serversN ? parseInt(serversN, 10) : NaN;
  if (get('servers') && !(servers > 0)) errors.push(`„${F.servers}“ muss eine Zahl größer als 0 sein (war: „${get('servers')}“).`);

  const wattsM = /\d+(?:[.,]\d+)?/.exec(get('watts'));
  const watts = wattsM ? parseFloat(wattsM[0].replace(',', '.')) : undefined;

  let link = get('link');
  if (link && !/^https?:\/\//i.test(link) && /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(link)) link = `https://${link}`;
  if (link) {
    try {
      const u = new URL(link);
      if (!/^https?:$/.test(u.protocol)) throw new Error();
    } catch {
      errors.push(`„${F.link}“ ist keine gültige URL: „${link}“`);
    }
  }

  const github = linkGithub && /^[A-Za-z0-9-]+$/.test(login) ? login : undefined;

  const known = knownServices(root);
  const services = [
    ...new Set(
      get('services')
        .split(/[,\n;]+/)
        .map((s) => s.replace(/^\s*[-*]\s+/, '').trim())
        .filter(Boolean)
        .map((s) => known.get(s.toLowerCase()) ?? s),
    ),
  ];
  if (get('services') && !services.length) errors.push(`„${F.services}“ ist leer.`);

  const name = oneLine(get('name'));
  const authorName = oneLine(get('author'));
  const slug = slugify(`${authorName}-${name}`);
  if (name && authorName && !slug) errors.push('Aus Name und Spitzname lässt sich kein Ordnername bilden (bitte lateinische Buchstaben oder Ziffern verwenden).');

  if (errors.length) {
    const err = new Error(errors.join('\n'));
    err.problems = errors;
    throw err;
  }

  const summary = oneLine(get('summary'));
  const story = get('story').trim();
  const lang = guessLang([summary, story, get('hardware')].join('\n'));

  const lines = ['---', `name: ${q(name)}`, `author: ${q(authorName)}`];
  if (github) lines.push(`github: ${github}`);
  if (link) lines.push(`link: ${q(link)}`);
  lines.push(`lang: ${lang}`, `added: ${today.toISOString().slice(0, 10)}`, `summary: ${q(summary)}`, `location: ${location[0]}`);
  for (const k of ['platform', 'management', 'proxy', 'access']) lines.push(`${k}: ${list(facets[k])}`);
  lines.push(`servers: ${servers}`, `hardware: ${q(oneLine(get('hardware')))}`);
  if (watts && watts > 0) lines.push(`watts: ${watts}`);
  for (const k of ['domain', 'auth', 'backup', 'monitoring']) if (get(k)) lines.push(`${k}: ${q(oneLine(get(k)))}`);
  lines.push(`services: ${list(services, true)}`, '---', '');
  if (story) lines.push(story, '');
  return { slug, name, content: lines.join('\n') };
}

/* ---------------------------------------------------------------------- CLI */

function setOutput(values) {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) return;
  for (const [k, v] of Object.entries(values)) {
    const delim = `EOF_${Math.random().toString(36).slice(2)}`;
    fs.appendFileSync(file, `${k}<<${delim}\n${v}\n${delim}\n`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const opt = (n) => {
    const i = args.indexOf(n);
    return i >= 0 ? args.splice(i, 2)[1] : undefined;
  };
  const author = opt('--author') ?? process.env.ISSUE_AUTHOR ?? '';
  const outDir = opt('--out') ?? 'content/homelabs';
  const body = args[0] ? fs.readFileSync(args[0], 'utf8') : (process.env.ISSUE_BODY ?? '');
  try {
    if (!body.trim()) throw Object.assign(new Error('Der Issue-Text ist leer.'), { problems: ['Der Issue-Text ist leer.'] });
    const { slug, name, content } = buildHomelab(body, { author });
    const file = path.join(outDir, slug, 'homelab.md');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
    console.log(file);
    setOutput({ slug, name, path: file });
  } catch (e) {
    const problems = e.problems ?? [String(e.message ?? e)];
    console.error(`Homelab could not be created:\n- ${problems.join('\n- ')}`);
    setOutput({ error: problems.map((p) => `- ${p}`).join('\n') });
    process.exit(1);
  }
}
