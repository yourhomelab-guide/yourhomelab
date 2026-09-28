/**
 * Logic of the getting-started assistant (src/components/tools/Assistant.astro).
 * Pure functions: answers in, recommendation out. Texts live in i18n as `tools.assistant.*`;
 * links are references like `g:ssh-keys` (guide), `w:vpn` (wiki), `s:caddy` (service), `t:docs-export` (tool).
 */

export const questions = [
  { id: 'hardware', options: ['none', 'oldpc', 'minipc', 'nas', 'server'] },
  { id: 'location', options: ['home', 'vps', 'both'] },
  { id: 'ipv4', options: ['yes', 'no', 'unknown'], link: 'w:cgnat-ds-lite' },
  { id: 'remote', options: ['lan', 'me', 'family', 'public'] },
  { id: 'style', options: ['web', 'files'] },
  { id: 'learn', options: ['quick', 'understand'] },
  { id: 'vms', options: ['yes', 'no'] },
  { id: 'domain', options: ['yes', 'no'] },
] as const;

export type QuestionId = (typeof questions)[number]['id'];
export type Answers = Partial<Record<QuestionId, string>>;

/** Questions that apply to these answers (the IPv4 question is irrelevant for a rented server only) */
export const activeQuestions = (a: Answers) => questions.filter((q) => !(q.id === 'ipv4' && a.location === 'vps'));

export type Platform = 'bare' | 'proxmox' | 'nas' | 'vps';
export type ProxyChoice = 'traefik' | 'npm' | 'caddy' | 'none';
export type Access = 'lan' | 'vpn' | 'tailscale' | 'portforward' | 'tunnel' | 'vps';

export interface Block {
  /** Chosen option, text key `tools.assistant.r.<area>.<choice>` */
  choice: string;
  /** Reason text keys (suffixes below `tools.assistant.why.`) */
  why: string[];
  links: string[];
}

export interface OrderItem {
  ref: string;
  optional?: boolean;
  /** Note key suffix below `tools.assistant.note.` */
  note?: string;
}

export interface Recommendation {
  platform: Block & { choice: Platform };
  proxy: Block & { choice: ProxyChoice };
  access: Block & { choice: Access };
  url: Block & { choice: 'sub' | 'path' };
  data: Block & { choice: 'stack' | 'central' };
  order: OrderItem[];
}

export function recommend(a: Answers): Recommendation {
  const atHome = a.location !== 'vps';
  const hw = a.hardware ?? 'none';

  /* ---------- platform */
  let platform: Recommendation['platform'];
  if (!atHome) platform = { choice: 'vps', why: ['platform.vps'], links: ['w:cloud-hybrid-local', 'w:bare-metal-linux'] };
  else if (hw === 'nas') platform = { choice: 'nas', why: ['platform.nas', ...(a.vms === 'yes' ? ['platform.nasVms'] : [])], links: ['w:truenas-unraid', 'w:operating-models'] };
  else if (a.vms === 'yes') platform = { choice: 'proxmox', why: ['platform.proxmox', ...(hw === 'oldpc' ? ['platform.oldpcRam'] : [])], links: ['w:proxmox-ve', 'w:vms-or-containers'] };
  else platform = { choice: 'bare', why: ['platform.bare'], links: ['w:bare-metal-linux', 'w:operating-models'] };
  if (hw === 'none' && atHome) platform.why.push('platform.buy');
  if (a.location === 'both') platform.why.push('platform.both');

  /* ---------- reverse proxy */
  let proxy: Recommendation['proxy'];
  if (a.domain === 'no' && (a.remote === 'lan' || a.remote === 'me')) proxy = { choice: 'none', why: ['proxy.none'], links: ['w:reverse-proxy-explained'] };
  else if (a.learn === 'understand') proxy = { choice: 'traefik', why: ['proxy.traefik'], links: ['g:reverse-proxy-traefik', 'w:reverse-proxy-explained'] };
  else if (a.style === 'files') proxy = { choice: 'caddy', why: ['proxy.caddy'], links: ['s:caddy', 'w:reverse-proxy-explained'] };
  else proxy = { choice: 'npm', why: ['proxy.npm'], links: ['g:reverse-proxy-npm', 'w:reverse-proxy-explained'] };

  /* ---------- access from outside */
  const noIpv4 = atHome && a.ipv4 !== 'yes';
  let access: Recommendation['access'];
  if (a.remote === 'lan') access = { choice: 'lan', why: ['access.lan'], links: ['w:access-methods-compared'] };
  else if (a.remote === 'public') {
    if (a.location === 'vps' || a.location === 'both') access = { choice: 'vps', why: [a.location === 'both' ? 'access.vpsBoth' : 'access.vps'], links: ['w:access-methods-compared', 'g:vpn-wireguard'] };
    else if (a.ipv4 === 'yes') access = { choice: 'portforward', why: ['access.portforward'], links: ['w:port-forwarding', 'w:attack-surface'] };
    else access = { choice: 'tunnel', why: ['access.tunnel'], links: ['w:tunnels', 'g:cloudflare-tunnel', 'w:cgnat-ds-lite'] };
  } else if (noIpv4 || a.remote === 'family') access = { choice: 'tailscale', why: [noIpv4 ? 'access.tailscaleCgnat' : 'access.tailscaleFamily'], links: ['w:vpn', 'w:cgnat-ds-lite'] };
  else access = { choice: 'vpn', why: ['access.vpn'], links: ['g:vpn-wireguard', 'w:vpn'] };
  if (atHome && a.ipv4 === 'unknown' && a.remote !== 'lan') access.why.push('access.checkIpv4');
  if (a.remote === 'public') access.why.push('access.publicProtect');

  /* ---------- URL scheme */
  let url: Recommendation['url'];
  if (proxy.choice === 'none') url = { choice: 'sub', why: ['url.noProxy'], links: ['w:ip-ports-nat'] };
  else if (a.domain === 'yes') url = { choice: 'sub', why: ['url.sub'], links: ['g:domain-dns', 'w:dns-domains'] };
  else url = { choice: 'path', why: ['url.path'], links: ['w:dns-domains'] };

  /* ---------- data mode */
  const data: Recommendation['data'] =
    platform.choice === 'nas'
      ? { choice: 'central', why: ['data.central'], links: ['w:directory-structure'] }
      : { choice: 'stack', why: ['data.stack'], links: ['w:directory-structure', 'g:creating-the-directory-structure'] };

  /* ---------- your order: all guides stay visible on the site, this is only a suggested path */
  const o: OrderItem[] = [];
  const add = (ref: string, optional = false, note?: string) => o.push({ ref, optional, note });
  if (hw === 'none' && atHome) add('g:choosing-hardware');
  if (platform.choice === 'proxmox') add('w:proxmox-ve', false, 'proxmoxFirst');
  add('g:installing-the-os', platform.choice === 'nas', platform.choice === 'nas' ? 'nasOs' : platform.choice === 'vps' ? 'vpsOs' : undefined);
  add('g:static-ip-hostname', !atHome || platform.choice === 'nas', !atHome ? 'vpsIp' : undefined);
  add('g:ssh-keys');
  add('g:users-sudo', platform.choice === 'nas');
  add('g:hardening-ssh');
  add('g:firewall-ufw', platform.choice === 'nas', platform.choice === 'nas' ? 'nasFirewall' : undefined);
  add('g:automatic-updates', platform.choice === 'nas');
  add('g:installing-docker', platform.choice === 'nas', platform.choice === 'nas' ? 'nasDocker' : undefined);
  add('g:creating-the-directory-structure');
  add('g:first-stack');
  add('g:env-secrets');
  if (a.domain === 'yes' || a.remote === 'public') add('g:domain-dns', false, a.domain === 'yes' ? undefined : 'needDomain');
  else if (proxy.choice !== 'none') add('g:domain-dns', true);
  if (proxy.choice === 'traefik') add('g:reverse-proxy-traefik');
  if (proxy.choice === 'npm') add('g:reverse-proxy-npm');
  if (proxy.choice === 'caddy') add('s:caddy', false, 'caddy');
  if (access.choice === 'vpn') add('g:vpn-wireguard');
  if (access.choice === 'tailscale') add('w:vpn', false, 'tailscale');
  if (access.choice === 'tunnel') add('g:cloudflare-tunnel');
  if (access.choice === 'vps') add('g:vpn-wireguard', a.location === 'vps', a.location === 'both' ? 'vpsLink' : undefined);
  if (access.choice === 'portforward') add('w:port-forwarding', false, 'portforward');
  if (access.choice === 'lan') add('g:vpn-wireguard', true, 'later');
  const shared = a.remote === 'family' || a.remote === 'public';
  add('g:tinyauth', !shared);
  add('g:pocket-id', true);
  if (proxy.choice === 'traefik') add('g:crowdsec', a.remote !== 'public');
  add('g:backups-borgmatic');
  add('g:testing-restores');
  add('g:monitoring-beszel', true);
  add('g:uptime-kuma', a.remote !== 'public' && a.remote !== 'family');
  add('g:portainer-dockhand', a.style !== 'web');
  add('g:updates-renovate', true);
  add('g:git-deployments-forgejo', true);

  return { platform, proxy, access, url, data, order: o };
}

/** Values written to "Mein Setup" (everything else stays unchanged) */
export const setupPatch = (r: Recommendation) => ({ proxy: r.proxy.choice, urlMode: r.url.choice, dataMode: r.data.choice });

/** All text keys the component must embed (for the script) */
export function textKeys(): string[] {
  const keys = new Set<string>();
  const r = (a: Answers) => recommend(a);
  // Enumerate every answer combination once (small: 5*3*3*4*2*2*2*2 = 5760) to collect keys
  const combos = (i: number, a: Answers) => {
    if (i === questions.length) {
      const x = r(a);
      for (const area of ['platform', 'proxy', 'access', 'url', 'data'] as const) {
        keys.add(`r.${area}.${x[area].choice}`);
        x[area].why.forEach((w) => keys.add(`why.${w}`));
      }
      x.order.forEach((it) => it.note && keys.add(`note.${it.note}`));
      return;
    }
    const q = questions[i];
    for (const opt of q.options) combos(i + 1, { ...a, [q.id]: opt });
  };
  combos(0, {});
  for (const q of questions) {
    keys.add(`q.${q.id}`);
    keys.add(`q.${q.id}.hint`);
    q.options.forEach((o) => keys.add(`q.${q.id}.${o}`));
  }
  return [...keys];
}
