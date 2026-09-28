/**
 * borgmatic config generator: options → /etc/borgmatic/config.yaml (borgmatic 2.x).
 * Pure function, no DOM. The output keeps the site placeholders (`__ROOT__`, `__DATA(<app>)__` …);
 * the tool fills them with the visitor's "Mein Setup" values. Syntax follows the guides
 * content/guides/06-operations/01-backups-borgmatic and 02-testing-restores.
 */

export type DbType = 'postgres' | 'mariadb' | 'mysql' | 'sqlite';

export interface DbInfo {
  type: DbType;
  /** Service name of the DB container in compose.yaml (not for sqlite) */
  service?: string;
  /** Literal or `${VAR}` from the stack's .env */
  user?: string;
  name?: string;
  /** sqlite only: path below the stack folder, e.g. `data/data/db.sqlite3` */
  path?: string;
}

/**
 * How a stack's database is made consistent:
 * - `dump`: pg_dump / mariadb-dump / mysqldump via `docker compose exec` (postgres, mariadb, mysql)
 * - `sqlite`: `sqlite3 .backup` on the host (needs the sqlite3 package)
 * - `stop`: stop the stack before the backup, start it again afterwards
 * - `none`: files only
 */
export type DbMode = 'dump' | 'sqlite' | 'stop' | 'none';

export interface BorgService {
  id: string;
  name: string;
  db?: DbInfo;
  mode: DbMode;
}

export interface BorgRepo {
  kind: 'local' | 'ssh' | 'url';
  label: string;
  /** local: directory; ssh: path on the remote host (relative to the user's home unless it starts with /) */
  path?: string;
  user?: string;
  host?: string;
  port?: string;
  /** url: full Borg URL from a storage provider */
  url?: string;
}

export interface BorgOptions {
  /** Also back up `__DATA_ROOT__` (central data mode, when it isn't below `__ROOT__`) */
  dataRoot: boolean;
  extraSources: string[];
  excludeCaches: boolean;
  excludes: string[];
  repos: BorgRepo[];
  passphraseFile: string;
  compression: string;
  /** Empty = borgmatic's default `{hostname}-{now:%Y-%m-%dT%H:%M:%S.%f}` */
  archiveNameFormat: string;
  keep: { daily: number; weekly: number; monthly: number; yearly: number };
  /** Frequency of the repository + archives checks, e.g. `2 weeks`; empty = every run */
  checkFrequency: string;
  /** Frequency of the data check; empty = no data check */
  dataCheckFrequency: string;
  services: BorgService[];
  uptimeKuma: string;
  ntfy: { server: string; topic: string; token: string; onSuccess: boolean } | null;
  healthchecks: string;
}

export const defaultOptions = (): BorgOptions => ({
  dataRoot: false,
  extraSources: [],
  excludeCaches: true,
  excludes: ['*/.cache', '*.tmp'],
  repos: [{ kind: 'local', label: 'usb', path: '/mnt/backup/borg' }],
  passphraseFile: '/etc/borgmatic/passphrase',
  compression: 'zstd',
  archiveNameFormat: '',
  keep: { daily: 7, weekly: 4, monthly: 6, yearly: 0 },
  checkFrequency: '2 weeks',
  dataCheckFrequency: '3 months',
  services: [],
  uptimeKuma: '',
  ntfy: null,
  healthchecks: '',
});

/** Modes that make sense for a database type; the first one is the default. */
export const modesFor = (db?: DbInfo): DbMode[] =>
  !db ? ['stop', 'none'] : db.type === 'sqlite' ? ['stop', 'sqlite', 'none'] : ['dump', 'stop', 'none'];

/** Borg URL / path of a repository */
export function repoPath(r: BorgRepo): string {
  if (r.kind === 'local') return (r.path ?? '').trim();
  if (r.kind === 'url') return (r.url ?? '').trim();
  const user = (r.user ?? '').trim();
  const host = (r.host ?? '').trim();
  const port = (r.port ?? '').trim();
  let path = (r.path ?? '').trim() || './borg';
  // Relative paths live in the remote user's home: ssh://user@host/./borg
  if (!path.startsWith('/')) path = '/' + (path.startsWith('./') ? path : './' + path.replace(/^~\/?/, ''));
  return `ssh://${user ? user + '@' : ''}${host}${port && port !== '22' ? ':' + port : ''}${path}`;
}

/** Folder of a stack's data below the placeholder `__DATA(<id>)__` for a path relative to the stack folder */
export function stackPath(id: string, rel: string): string {
  const r = rel.replace(/^\.\//, '');
  if (r === 'data') return `__DATA(${id})__`;
  if (r.startsWith('data/')) return `__DATA(${id})__/${r.slice(5)}`;
  return `__ROOT__/${id}/${r}`;
}

const composeFile = (id: string) => `__ROOT__/${id}/compose.yaml`;
const dumpDir = (id: string) => `__DATA(${id})__/db-dump`;
const VAR_RE = /^\$\{(\w+)\}$/;
const shellSafe = (s: string) => /^[\w.@%+=:,/-]+$/.test(s);
const shq = (s: string) => (shellSafe(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`);

/**
 * Resolves a db.user / db.name value. `${VAR}` is read from the stack's .env on the host into a shell
 * variable (borgmatic itself would interpolate `${VAR}`, so the command only uses `$NAME`).
 */
function dbValue(id: string, raw: string | undefined, shellVar: string, fallback: string) {
  const v = (raw ?? '').trim() || fallback;
  const m = VAR_RE.exec(v);
  if (!m) return { pre: '', arg: shq(v), file: v };
  return { pre: `${shellVar}=$(sed -n 's/^${m[1]}=//p' __ROOT__/${id}/.env); `, arg: `"$${shellVar}"`, file: id };
}

/** Shell commands that dump one stack's database (run in `before: action`, `when: [create]`) */
export function dumpCommands(s: BorgService): string[] {
  const db = s.db;
  if (!db) return [];
  const exec = (svc: string) => `docker compose -f ${composeFile(s.id)} exec -T ${svc}`;
  if (s.mode === 'dump' && db.type === 'postgres' && db.service) {
    const u = dbValue(s.id, db.user, 'DB_USER', 'postgres');
    if (!db.name?.trim()) {
      return [`mkdir -p -m 700 ${dumpDir(s.id)}`, `${u.pre}${exec(db.service)} pg_dumpall -U ${u.arg} > ${dumpDir(s.id)}/${s.id}.sql`];
    }
    const n = dbValue(s.id, db.name, 'DB_NAME', s.id);
    return [`mkdir -p -m 700 ${dumpDir(s.id)}`, `${u.pre}${n.pre}${exec(db.service)} pg_dump -U ${u.arg} -d ${n.arg} > ${dumpDir(s.id)}/${n.file}.sql`];
  }
  if (s.mode === 'dump' && (db.type === 'mariadb' || db.type === 'mysql') && db.service) {
    const n = dbValue(s.id, db.name, 'DB_NAME', s.id);
    const tool = db.type === 'mariadb' ? 'mariadb-dump' : 'mysqldump';
    const pw = db.type === 'mariadb' ? 'MARIADB_ROOT_PASSWORD' : 'MYSQL_ROOT_PASSWORD';
    // Single quotes: the password variable is expanded inside the container
    const inner = n.pre
      ? `sh -c '${tool} --single-transaction -u root -p"$${pw}" "$1"' sh ${n.arg}`
      : `sh -c '${tool} --single-transaction -u root -p"$${pw}" ${n.arg}'`;
    return [`mkdir -p -m 700 ${dumpDir(s.id)}`, `${n.pre}${exec(db.service)} ${inner} > ${dumpDir(s.id)}/${n.file}.sql`];
  }
  if (s.mode === 'sqlite' && db.type === 'sqlite' && db.path) {
    const src = stackPath(s.id, db.path);
    const file = db.path.split('/').pop()!;
    return [`mkdir -p -m 700 ${dumpDir(s.id)}`, `sqlite3 ${src} ".backup '${dumpDir(s.id)}/${file}'"`];
  }
  return [];
}

// ---------- YAML output ----------

const YAML_WORDS = /^(?:true|false|yes|no|on|off|null|~|y|n)$/i;
/** Plain scalar when safe, otherwise a double-quoted YAML string */
export function yq(s: string): string {
  const plain =
    s !== '' &&
    !/^[\s\-?:,[\]{}#&*!|>'"%@`]/.test(s) &&
    !/\s$/.test(s) &&
    !/: |:$| #|\t/.test(s) &&
    !YAML_WORDS.test(s) &&
    !/^[+-]?(?:\d[\d_]*(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(s);
  return plain ? s : `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

const I = '    ';

export function generate(o: BorgOptions): string {
  const out: string[] = [];
  const line = (s = '') => out.push(s);

  // Sources
  line('# What to back up');
  line('source_directories:');
  line(`${I}- __ROOT__`);
  if (o.dataRoot) line(`${I}- __DATA_ROOT__`);
  for (const p of o.extraSources.map((x) => x.trim()).filter(Boolean)) line(`${I}- ${yq(p)}`);
  const excludes = o.excludes.map((x) => x.trim()).filter(Boolean);
  if (o.excludeCaches || excludes.length) {
    line();
    line('# What to skip');
  }
  if (excludes.length) {
    line('exclude_patterns:');
    for (const p of excludes) line(`${I}- ${yq(p)}`);
  }
  if (o.excludeCaches) {
    line('# Skip folders marked with a CACHEDIR.TAG file');
    line('exclude_caches: true');
  }

  // Repositories
  line();
  line('# Where the backups go');
  line('repositories:');
  const repos = o.repos.filter((r) => repoPath(r));
  if (!repos.length) line(`${I}- path: /mnt/backup/borg`);
  repos.forEach((r, i) => {
    if (r.kind === 'ssh') line(`${I}# Borg must be installed on the remote host`);
    if (r.kind === 'url') line(`${I}# Storage provider with Borg support`);
    line(`${I}- path: ${yq(repoPath(r))}`);
    line(`${I}  label: ${yq(r.label.trim() || `repo${i + 1}`)}`);
  });

  // Encryption
  line();
  line('# Read the passphrase from a file only root can read');
  line(`encryption_passphrase: ${yq(`{credential file ${o.passphraseFile.trim() || '/etc/borgmatic/passphrase'}}`)}`);
  line();
  line('compression: ' + yq(o.compression || 'zstd'));
  if (o.archiveNameFormat.trim()) line('archive_name_format: ' + yq(o.archiveNameFormat.trim()));

  // Retention
  const keep = (['daily', 'weekly', 'monthly', 'yearly'] as const).filter((k) => o.keep[k] > 0);
  if (keep.length) {
    line();
    line(`# Keep ${keep.map((k) => `${o.keep[k]} ${k}`).join(', ')} archives, delete the rest`);
    for (const k of keep) line(`keep_${k}: ${Math.floor(o.keep[k])}`);
  }

  // Checks
  line();
  line('# Consistency checks and how often they run');
  line('checks:');
  for (const name of ['repository', 'archives']) {
    line(`${I}- name: ${name}`);
    if (o.checkFrequency) line(`${I}  frequency: ${yq(o.checkFrequency)}`);
  }
  if (o.dataCheckFrequency) {
    line(`${I}# Reads and decrypts all data, takes long`);
    line(`${I}- name: data`);
    line(`${I}  frequency: ${yq(o.dataCheckFrequency)}`);
  }

  // Hooks
  const before: string[] = [];
  const after: string[] = [];
  for (const s of o.services) {
    const cmds = dumpCommands(s);
    if (cmds.length) {
      before.push(`# ${s.name} (${s.db!.type === 'sqlite' ? 'SQLite' : s.db!.type === 'postgres' ? 'PostgreSQL' : s.db!.type === 'mariadb' ? 'MariaDB' : 'MySQL'})`, ...cmds);
    }
  }
  const stopped = o.services.filter((s) => s.mode === 'stop');
  if (stopped.length) {
    before.push('# Stop these stacks during the backup');
    for (const s of stopped) before.push(`docker compose -f ${composeFile(s.id)} stop`);
    // After-hooks also run when the backup fails, so the stacks always come back
    after.push('# Start the stopped stacks again (also runs after errors)');
    for (const s of stopped) after.push(`docker compose -f ${composeFile(s.id)} start`);
  }
  if (before.length) {
    line();
    line('# Commands that run right before each backup (and after it)');
    line('commands:');
    const block = (kind: string, cmds: string[]) => {
      line(`${I}- ${kind}: action`);
      line(`${I}  when: [create]`);
      line(`${I}  run:`);
      for (const c of cmds) line(c.startsWith('# ') ? `${I}${I}  ${c}` : `${I}${I}  - ${yq(c)}`);
    };
    block('before', before);
    if (after.length) block('after', after);
  }

  // Monitoring
  const kuma = o.uptimeKuma.trim().replace(/\?.*$/, '');
  if (kuma) {
    line();
    line('# Report every run to an Uptime Kuma push monitor');
    line('uptime_kuma:');
    line(`${I}push_url: ${yq(kuma)}`);
    line(`${I}states:`);
    line(`${I}${I}- finish`);
    line(`${I}${I}- fail`);
  }
  if (o.ntfy && o.ntfy.topic.trim()) {
    const n = o.ntfy;
    line();
    line('# Push notification via ntfy');
    line('ntfy:');
    line(`${I}topic: ${yq(n.topic.trim())}`);
    if (n.server.trim()) line(`${I}server: ${yq(n.server.trim().replace(/\/+$/, ''))}`);
    if (n.token.trim()) line(`${I}access_token: ${yq(n.token.trim())}`);
    if (n.onSuccess) {
      line(`${I}finish:`);
      line(`${I}${I}title: Backup finished`);
      line(`${I}${I}message: ${yq('borgmatic finished the backup.')}`);
      line(`${I}${I}priority: low`);
      line(`${I}${I}tags: ${yq('borgmatic,+1')}`);
    }
    line(`${I}fail:`);
    line(`${I}${I}title: Backup failed`);
    line(`${I}${I}message: ${yq('borgmatic failed. Check: journalctl -u borgmatic.service')}`);
    line(`${I}${I}priority: high`);
    line(`${I}${I}tags: ${yq('borgmatic,-1,skull')}`);
    line(`${I}states:`);
    if (n.onSuccess) line(`${I}${I}- finish`);
    line(`${I}${I}- fail`);
  }
  const hc = o.healthchecks.trim();
  if (hc) {
    line();
    line('# Healthchecks: start, finish and fail pings');
    line('healthchecks:');
    line(`${I}ping_url: ${yq(hc)}`);
  }
  return out.join('\n') + '\n';
}

/** Whether a generated config needs sqlite3 installed on the host */
export const needsSqlite = (o: BorgOptions) => o.services.some((s) => s.mode === 'sqlite' && dumpCommands(s).length > 0);
