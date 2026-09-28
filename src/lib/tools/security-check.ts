/**
 * Logic of the security check (src/components/tools/SecurityCheck.astro).
 * Texts live in i18n as `tools.security-check.i.<id>` (statement) and `.h.<id>` (short explanation).
 * `link` is a reference like `g:ssh-keys` (guide), `w:attack-surface` (wiki), `t:docs-export` (tool),
 * `g@notfallplan` (guide by German slug, may not exist yet; `fallback` is used then).
 */

export const groups = ['access', 'network', 'docker', 'login', 'updates', 'backups', 'monitoring'] as const;
export type Group = (typeof groups)[number];

export interface Item {
  id: string;
  group: Group;
  /** 1 = nice to have, 2 = important, 3 = critical */
  weight: 1 | 2 | 3;
  link: string;
  fallback?: string;
}

export const items: Item[] = [
  { id: 'ssh-keys', group: 'access', weight: 3, link: 'g:ssh-keys' },
  { id: 'root-login', group: 'access', weight: 2, link: 'g:hardening-ssh' },
  { id: 'sudo-user', group: 'access', weight: 1, link: 'g:users-sudo' },

  { id: 'ufw', group: 'network', weight: 2, link: 'g:firewall-ufw' },
  { id: 'open-ports', group: 'network', weight: 3, link: 'w:port-forwarding' },
  { id: 'admin-uis', group: 'network', weight: 3, link: 'w:attack-surface' },

  { id: 'docker-ports', group: 'docker', weight: 2, link: 'w:docker-networks' },
  { id: 'docker-sock', group: 'docker', weight: 3, link: 'w:attack-surface' },
  { id: 'secrets', group: 'docker', weight: 2, link: 'g:env-secrets' },

  { id: 'login-protection', group: 'login', weight: 2, link: 'g:tinyauth' },
  { id: 'crowdsec', group: 'login', weight: 1, link: 'g:crowdsec' },

  { id: 'auto-updates', group: 'updates', weight: 2, link: 'g:automatic-updates' },
  { id: 'image-tags', group: 'updates', weight: 1, link: 'g:updates-renovate' },

  { id: 'backup-auto', group: 'backups', weight: 3, link: 'g:backups-borgmatic' },
  { id: 'backup-offsite', group: 'backups', weight: 3, link: 'w:backup-strategies' },
  { id: 'restore-tested', group: 'backups', weight: 3, link: 'g:testing-restores' },

  { id: 'monitoring', group: 'monitoring', weight: 1, link: 'g:uptime-kuma' },
  { id: 'emergency-plan', group: 'monitoring', weight: 2, link: 'g@notfallplan', fallback: 't:docs-export' },
];

export const answers = ['yes', 'partial', 'no', 'unknown'] as const;
export type Answer = (typeof answers)[number];
const value: Record<Answer, number> = { yes: 1, partial: 0.5, no: 0, unknown: 0 };

export type Light = 'green' | 'yellow' | 'red';

export interface Result {
  /** 0–100 */
  score: number;
  answered: number;
  light: Light;
  /** Most important open items, at most `max` */
  next: Item[];
}

export function evaluate(state: Record<string, Answer | undefined>, max = 5): Result {
  let got = 0;
  let total = 0;
  let answered = 0;
  let criticalOpen = false;
  for (const it of items) {
    const a = state[it.id];
    total += it.weight;
    if (a) {
      answered++;
      got += it.weight * value[a];
    }
    if (it.weight === 3 && a !== 'yes' && a !== 'partial') criticalOpen = true;
  }
  const score = Math.round((got / total) * 100);
  let light: Light = score >= 80 ? 'green' : score >= 50 ? 'yellow' : 'red';
  // One critical gap (no / don't know) is enough to not be "green"
  if (light === 'green' && criticalOpen) light = 'yellow';
  const rank = (a?: Answer) => (a === 'no' ? 0 : a === 'unknown' || !a ? 1 : 2);
  const next = items
    .filter((it) => state[it.id] !== 'yes')
    .map((it, i) => ({ it, i }))
    .sort((x, y) => y.it.weight - x.it.weight || rank(state[x.it.id]) - rank(state[y.it.id]) || x.i - y.i)
    .slice(0, max)
    .map((x) => x.it);
  return { score, answered, light, next };
}
