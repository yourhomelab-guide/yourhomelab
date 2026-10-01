/**
 * Docs export: builds a Markdown documentation of the visitor's homelab from "Mein Setup",
 * the picked services and a few optional fields. Pure function, used in the browser.
 */
import { appDataDir, type Setup } from '../../config/site';

export interface DocsService {
  id: string;
  name: string;
  port: number;
  /** URL with placeholders already filled */
  url: string;
  page: string;
  isProxy: boolean;
  db?: {
    type: 'postgres' | 'mariadb' | 'mysql' | 'sqlite';
    service?: string;
    user?: string;
    name?: string;
    /** sqlite: path below the stack folder, e.g. `data/data/db.sqlite3` */
    path?: string;
    /** mariadb/mysql: name of the password variable inside the DB container */
    pwVar?: string;
  };
}

export interface DocsInput {
  title: string;
  hardware: string;
  ip: string;
  backup: string;
  notes: string;
}

/** Labels (page language), `{var}` placeholders get filled */
export type DocsTexts = Record<string, string>;

const fmt = (s: string, v: Record<string, string | number> = {}) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''));
const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const dbLabel = { postgres: 'PostgreSQL', mariadb: 'MariaDB', mysql: 'MySQL', sqlite: 'SQLite' } as const;

export const stackDir = (s: Setup, id: string) => `${s.root}/${id}`;

/** Path of a file below the stack folder (`data/…`) after the data mode was applied */
function stackPath(s: Setup, id: string, p: string) {
  const rel = p.replace(/^\.?\/?/, '');
  return rel.startsWith('data/') ? `${appDataDir(s, id)}/${rel.slice(5)}` : `${stackDir(s, id)}/${rel}`;
}

/** Shell commands to dump and restore the database of a service */
export function dbCommands(s: Setup, svc: DocsService): { dump: string; restore: string } | null {
  const db = svc.db;
  if (!db) return null;
  const dir = stackDir(s, svc.id);
  const data = appDataDir(s, svc.id);
  const cd = `cd ${dir}`;
  if (db.type === 'sqlite') {
    const file = stackPath(s, svc.id, db.path ?? 'data/db.sqlite3');
    return {
      dump: [cd, 'docker compose stop', `cp -a ${file} ${file}.bak`, 'docker compose start'].join('\n'),
      restore: [cd, 'docker compose stop', `cp -a ${file}.bak ${file}`, 'docker compose start'].join('\n'),
    };
  }
  const svcName = db.service ?? 'db';
  const dump = `${data}/db-dump.sql`;
  if (db.type === 'postgres') {
    const u = db.user ?? 'postgres';
    const n = db.name ?? u;
    return {
      dump: [cd, `docker compose exec -T ${svcName} pg_dump -U ${u} ${n} > ${dump}`].join('\n'),
      restore: [cd, `docker compose up -d ${svcName}`, `docker compose exec -T ${svcName} psql -U ${u} ${n} < ${dump}`, 'docker compose up -d'].join('\n'),
    };
  }
  const bin = db.type === 'mariadb' ? 'mariadb' : 'mysql';
  const dumpBin = db.type === 'mariadb' ? 'mariadb-dump' : 'mysqldump';
  const u = db.user ?? 'root';
  const pw = db.pwVar ? `-p"$${db.pwVar}"` : '-p';
  const n = db.name ?? '';
  return {
    dump: [cd, `docker compose exec -T ${svcName} sh -c 'exec ${dumpBin} --single-transaction -u ${u} ${pw} ${n}' > ${dump}`].join('\n'),
    restore: [cd, `docker compose up -d ${svcName}`, `docker compose exec -T ${svcName} sh -c 'exec ${bin} -u ${u} ${pw} ${n}' < ${dump}`, 'docker compose up -d'].join('\n'),
  };
}

export function buildDocs(
  list: DocsService[],
  s: Setup,
  input: DocsInput,
  tx: DocsTexts,
  meta: { date: string; toolUrl: string; proxyName: string; links: { emergency: string; backups: string; restore: string } },
): string {
  const L: string[] = [];
  const code = (c: string, lang = 'bash') => ['```' + lang, ...c.split('\n'), '```'];
  const ip = input.ip.trim();
  const url = (u: string) => u.replaceAll('__SERVER_IP__', ip || s.serverIp);
  const title = input.title.trim() || tx.defaultTitle;

  L.push(`# ${fmt(tx.title, { name: title })}`, '', `_${fmt(tx.generated, { date: meta.date, url: meta.toolUrl })}_`, '');

  // Overview
  L.push(`## ${tx.overview}`, '', `| ${tx.field} | ${tx.value} |`, '| --- | --- |');
  const rows: [string, string][] = [
    [tx.ip, ip],
    [tx.hardware, input.hardware.trim()],
    [tx.domain, s.domain],
    [tx.proxy, meta.proxyName],
    [tx.urls, s.urlMode === 'sub' ? fmt(tx.urlsSub, { domain: s.domain }) : fmt(tx.urlsPath, { domain: s.domain })],
    [tx.stacks, `\`${s.root}/<${tx.service}>\``],
    [tx.dataMode, s.dataMode === 'stack' ? fmt(tx.dataStack, { path: `${s.root}/<${tx.service}>/data` }) : fmt(tx.dataCentral, { path: `${s.dataRoot}/<${tx.service}>` })],
    ...(s.proxy !== 'none' ? ([[tx.network, `\`${s.network}\``]] as [string, string][]) : []),
    [tx.tz, s.tz],
    [tx.backupTarget, input.backup.trim()],
  ];
  for (const [k, v] of rows) if (v) L.push(`| ${cell(k)} | ${cell(v)} |`);
  L.push('');

  // Services table
  L.push(`## ${tx.services}`, '');
  if (!list.length) L.push(tx.noServices, '');
  else {
    L.push(`| ${tx.service} | URL | ${tx.port} | ${tx.stackDir} | ${tx.dataDir} | ${tx.database} |`, '| --- | --- | --- | --- | --- | --- |');
    for (const x of list)
      L.push(
        `| ${cell(x.name)} | ${cell(url(x.url))} | ${x.port} | \`${stackDir(s, x.id)}\` | \`${appDataDir(s, x.id)}\` | ${x.db ? dbLabel[x.db.type] : '–'} |`,
      );
    L.push('');
  }

  // One section per service
  for (const x of list) {
    const dir = stackDir(s, x.id);
    const cmds = dbCommands(s, x);
    L.push(`### ${x.name}`, '');
    L.push(`- ${tx.url}: ${url(x.url)}`);
    L.push(`- ${tx.stackDir}: \`${dir}\` (compose.yaml, .env)`);
    L.push(`- ${tx.dataDir}: \`${appDataDir(s, x.id)}\``);
    if (x.db) L.push(`- ${tx.database}: ${dbLabel[x.db.type]}${x.db.service ? ` (${fmt(tx.dbContainer, { name: x.db.service })})` : ''}`);
    L.push(`- ${tx.guide}: ${x.page}`, '');
    L.push(`**${tx.update}**`, '', ...code([`cd ${dir}`, 'docker compose pull', 'docker compose up -d'].join('\n')), '');
    L.push(`**${tx.backup}**`, '', fmt(tx.backupText, { stack: dir, data: appDataDir(s, x.id) }), '');
    if (cmds) {
      L.push(x.db!.type === 'sqlite' ? tx.backupSqlite : tx.backupDump, '', ...code(cmds.dump), '');
    }
    L.push(`**${tx.restore}**`, '');
    L.push(`1. ${fmt(tx.restore1, { stack: dir })}`);
    L.push(`2. ${fmt(tx.restore2, { stack: dir, data: appDataDir(s, x.id) })}`);
    if (cmds) {
      L.push(`3. ${x.db!.type === 'sqlite' ? tx.restore3Sqlite : tx.restore3Db}`, '', ...code(cmds.restore).map((l) => `   ${l}`), '');
      L.push(`4. ${fmt(tx.restore4, { url: url(x.url) })}`);
    } else L.push(`3. ${fmt(tx.restore3, { stack: dir })}`, `4. ${fmt(tx.restore4, { url: url(x.url) })}`);
    L.push('');
  }

  // Emergency
  L.push(`## ${tx.emergency}`, '', tx.emergencyText, '');
  L.push(`- ${tx.emergencyPlan}: ${meta.links.emergency}`, `- ${tx.backupsGuide}: ${meta.links.backups}`, `- ${tx.restoreGuide}: ${meta.links.restore}`);
  const proxies = list.filter((x) => x.isProxy);
  if (proxies.length) L.push(`- ${fmt(tx.emergencyProxy, { names: proxies.map((x) => x.name).join(', ') })}`);
  L.push('');

  if (input.notes.trim()) L.push(`## ${tx.notes}`, '', input.notes.trim(), '');
  return L.join('\n');
}
