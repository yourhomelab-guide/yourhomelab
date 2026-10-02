/**
 * Global site settings. Change these values instead of editing components.
 */
export const site = {
  url: 'https://yourhomelab.guide',
  name: 'yourhomelab',
  /** GitHub repository. Also update .github/ISSUE_TEMPLATE/config.yml and content/faq/07-contributing/{de,en}.md when changing it. */
  repo: 'https://github.com/yourhomelab-guide/yourhomelab',
  branch: 'main',
  /** Shows the yellow "Im Aufbau" banner on top of every page */
  underConstruction: true,
  /**
   * Donation links. `null` hides a button; if all are `null` the "Unterstützen" box disappears.
   * GitHub Sponsors must be enabled for the org first (github.com/sponsors).
   */
  donate: {
    sponsors: null as string | null, // 'https://github.com/sponsors/yourhomelab-guide'
    kofi: null as string | null, // 'https://ko-fi.com/…'
    liberapay: null as string | null, // 'https://liberapay.com/…'
  },
  /**
   * Cookieless Umami analytics. The script is only included when websiteId is set.
   * Changing the host? Also update the CSP in public/.htaccess and the privacy policy.
   */
  umami: {
    src: 'https://stats.flystart-solutions.com/flystart-stats.js',
    websiteId: '02de2030-d44e-4744-8308-10fc6938324f',
    domains: 'yourhomelab.guide', // only count the live site, not localhost or previews
  },
} as const;

/**
 * Language authors write in. It is the source of truth; other languages are translations
 * (see CLAUDE.md and scripts/translate.mjs). Switching to 'en' later only changes this value
 * and which files count as originals.
 */
export const sourceLang: 'de' | 'en' = 'de';

/** Service categories in display order. Labels live in src/i18n/*.json as `category.<id>`. */
export const categories = ['proxy', 'management', 'network', 'data', 'media', 'code', 'auth', 'monitoring'] as const;
export type Category = (typeof categories)[number];

/**
 * Filterable fields of a homelab in the showcase (content/homelabs). Labels live in src/i18n/*.json as
 * `homelabs.<field>.<value>`. Adding a value here also needs a label and an option in .github/ISSUE_TEMPLATE/homelab.yml.
 */
export const homelabFacets = {
  location: ['local', 'hybrid', 'cloud'],
  platform: ['bare-metal', 'proxmox', 'truenas', 'unraid', 'nas', 'kubernetes', 'swarm', 'other'],
  management: ['cli', 'compose', 'portainer', 'dockhand', 'dockge', 'komodo', 'gitops', 'ansible', 'other'],
  proxy: ['traefik', 'caddy', 'npm', 'nginx', 'haproxy', 'none', 'other'],
  access: ['port-forwarding', 'vpn', 'tunnel', 'vps', 'lan-only'],
} as const;
export type HomelabFacet = keyof typeof homelabFacets;

/**
 * Tools under /de/werkzeuge/ and /en/tools/, in display order. Title and description live in src/i18n/*.json as
 * `tools.<id>.title` / `tools.<id>.desc`; the tool itself is src/components/tools/<Component>.astro.
 */
export const tools = [
  { id: 'assistant', slug: { de: 'einstiegs-assistent', en: 'getting-started' }, group: 'start' },
  { id: 'server-setup', slug: { de: 'server-setup-skript', en: 'server-setup-script' }, group: 'start' },
  { id: 'stack-builder', slug: { de: 'stack-builder', en: 'stack-builder' }, group: 'build' },
  { id: 'compose-explainer', slug: { de: 'compose-erklaerer', en: 'compose-explainer' }, group: 'build' },
  { id: 'proxy-config', slug: { de: 'proxy-konfiguration', en: 'proxy-config' }, group: 'build' },
  { id: 'password-hash', slug: { de: 'passwort-hash', en: 'password-hash' }, group: 'build' },
  { id: 'borgmatic', slug: { de: 'borgmatic-konfiguration', en: 'borgmatic-config' }, group: 'operate' },
  { id: 'docs-export', slug: { de: 'doku-export', en: 'docs-export' }, group: 'operate' },
  { id: 'security-check', slug: { de: 'sicherheits-check', en: 'security-check' }, group: 'operate' },
  { id: 'power-calculator', slug: { de: 'stromrechner', en: 'power-calculator' }, group: 'plan' },
] as const;
export type ToolId = (typeof tools)[number]['id'];
export const toolGroups = ['start', 'plan', 'build', 'operate'] as const;

/** Reverse proxies a visitor can pick in "Mein Setup". */
export const proxies = ['traefik', 'caddy', 'npm', 'none'] as const;

/** Networks that count as "home network" for LAN-only rules. 172.16.0.0/12 is left out on purpose: Docker's own
 * networks live there, and connections that Docker forwards (e.g. IPv6) can appear to come from them. */
export const LAN_RANGES = ['10.0.0.0/8', '192.168.0.0/16'];
export type Proxy = (typeof proxies)[number];

/** Default values for "Mein Setup". Keys are also the placeholder names (upper-cased) used in templates. */
export const defaultSetup = {
  domain: 'example.com',
  email: 'admin@example.com',
  urlMode: 'sub' as 'sub' | 'path',
  proxy: 'traefik' as Proxy,
  network: 'proxy',
  root: '/srv/homelab',
  dataMode: 'stack' as 'stack' | 'central',
  dataRoot: '/srv/homelab/data',
  serverIp: '192.168.1.10',
  user: 'alex',
  tz: 'Europe/Berlin',
  puid: '1000',
  pgid: '1000',
};
export type Setup = typeof defaultSetup;

/**
 * Data folder of one app, used by the `__DATA(<app>)__` placeholder:
 * `<root>/<app>/data` ("pro Stack") or `<dataRoot>/<app>` ("zentral").
 */
export const appDataDir = (s: Pick<Setup, 'root' | 'dataMode' | 'dataRoot'>, app: string) =>
  s.dataMode === 'central' ? `${s.dataRoot}/${app}` : `${s.root}/${app}/data`;

/**
 * Placeholders contributors can use in compose.yaml, .env.example and code blocks.
 * They are replaced with the visitor's values from "Mein Setup".
 */
export const placeholders = {
  DOMAIN: 'domain',
  EMAIL: 'email',
  NETWORK: 'network',
  ROOT: 'root',
  DATA_ROOT: 'dataRoot',
  SERVER_IP: 'serverIp',
  USER: 'user',
  TZ: 'tz',
  PUID: 'puid',
  PGID: 'pgid',
} as const satisfies Record<string, keyof Setup>;
