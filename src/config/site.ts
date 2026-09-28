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
export const categories = ['proxy', 'management', 'data', 'code', 'auth', 'monitoring'] as const;
export type Category = (typeof categories)[number];

/** Reverse proxies a visitor can pick in "Mein Setup". */
export const proxies = ['traefik', 'caddy', 'npm', 'none'] as const;
export type Proxy = (typeof proxies)[number];

/** Default values for "Mein Setup". Keys are also the placeholder names (upper-cased) used in templates. */
export const defaultSetup = {
  domain: 'example.com',
  email: 'admin@example.com',
  urlMode: 'sub' as 'sub' | 'path',
  proxy: 'traefik' as Proxy,
  network: 'proxy',
  root: '/opt/stacks',
  dataMode: 'stack' as 'stack' | 'central',
  dataRoot: '/srv/appdata',
  tz: 'Europe/Berlin',
  puid: '1000',
  pgid: '1000',
};
export type Setup = typeof defaultSetup;

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
  TZ: 'tz',
  PUID: 'puid',
  PGID: 'pgid',
} as const satisfies Record<string, keyof Setup>;
