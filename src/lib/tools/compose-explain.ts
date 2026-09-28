/**
 * Compose explainer: parses a compose.yaml (with line numbers) and returns a structured explanation plus findings.
 * Pure logic, no DOM. All human-readable text lives in i18n keys (`tools.compose-explainer.*`):
 *   n.<key>          explanation notes (vars in `{name}` form)
 *   f.<rule>.t/why/fix  findings
 *   err.<CODE>       YAML syntax errors (codes from the `yaml` package), `err.generic` as fallback
 *   s.<key>          structural problems
 */
import { LineCounter, parseDocument, isAlias, isMap, isPair, isScalar, isSeq, type Document, type Node, type Pair, type YAMLMap } from 'yaml';

export type Severity = 'warn' | 'info' | 'good';
export type Vars = Record<string, string | number>;

export interface Note {
  k: string;
  v?: Vars;
}
/** One value of a service key, e.g. one port mapping */
export interface Entry {
  text?: string;
  line: number;
  notes: Note[];
}
export interface Item {
  key: string;
  line: number;
  entries: Entry[];
}
export interface ServiceInfo {
  name: string;
  line: number;
  items: Item[];
}
export interface Finding {
  sev: Severity;
  rule: Rule;
  line?: number;
  service?: string;
  v: Vars;
}
export interface Problem {
  /** i18n key suffix: `err.<CODE>` or `s.<key>` */
  k: string;
  line?: number;
  col?: number;
  v: Vars;
}
export interface Result {
  empty: boolean;
  problems: Problem[];
  name?: string;
  services: ServiceInfo[];
  networks: { name: string; external: boolean }[];
  volumes: string[];
  envRefs: string[];
  findings: Finding[];
  /** Worst severity per 1-based line (for the gutter) */
  lines: Record<number, Severity>;
}

/** Wiki article ids linked from each rule (resolved to localized URLs by the component) */
export const RULE_LINKS = {
  latest: ['images-tags', 'updates'],
  floatingTag: ['images-tags'],
  pinned: ['images-tags'],
  dbMajor: ['database-version', 'images-tags'],
  publicPort: ['docker-networks', 'attack-surface'],
  portsWithProxy: ['reverse-proxy-explained', 'attack-surface'],
  localPort: ['docker-networks'],
  unquotedPort: ['docker-compose'],
  dockerSock: ['attack-surface'],
  plainSecret: ['managing-secrets', 'env-files'],
  secretRef: ['env-files'],
  noRestart: ['docker-compose'],
  restartSet: [],
  namedVolume: ['volumes-bind-mounts', 'directory-structure'],
  anonVolume: ['volumes-bind-mounts'],
  undeclaredVolume: ['volumes-bind-mounts'],
  undeclaredNetwork: ['docker-networks'],
  unknownDep: ['docker-compose'],
  homePath: ['directory-structure'],
  dataOutside: ['directory-structure'],
  privileged: ['attack-surface'],
  hostNetwork: ['docker-networks', 'attack-surface'],
  pidHost: ['attack-surface'],
  capAdd: ['attack-surface'],
  capAddStrong: ['attack-surface'],
  noNewPrivileges: [],
  version: ['docker-compose'],
  noImage: ['images-tags'],
  healthcheck: ['monitoring'],
} satisfies Record<string, string[]>;
export type Rule = keyof typeof RULE_LINKS;

const DB_IMAGES = /^(postgres|postgresql|postgis|mariadb|mysql|mongo|mongodb|pgvecto-rs)$/;
const FLOATING = /^(stable|main|master|release|nightly|edge|dev|develop|beta|rolling|current)$/i;
const SECRET_NAME = /(pass(word|wd)?|pwd|secret|token|api_?key|apikey|private_?key|access_?key|auth_?key|salt|credential)/i;
const REF = /\$\{([A-Za-z_][A-Za-z0-9_]*)[^}]*\}|\$([A-Za-z_][A-Za-z0-9_]*)/g;
const SOCK = /^\/(var\/)?run\/docker\.sock$/;
const sevRank: Record<Severity, number> = { good: 0, info: 1, warn: 2 };

/** Split an image reference into registry, repository, tag and digest */
export function parseImage(ref: string) {
  let rest = ref.trim();
  let digest: string | undefined;
  const at = rest.indexOf('@');
  if (at >= 0) [rest, digest] = [rest.slice(0, at), rest.slice(at + 1)];
  let tag: string | undefined;
  const slash = rest.lastIndexOf('/');
  const colon = rest.lastIndexOf(':');
  if (colon > slash) [rest, tag] = [rest.slice(0, colon), rest.slice(colon + 1)];
  const parts = rest.split('/');
  let registry = 'docker.io';
  let explicitRegistry = false;
  if (parts.length > 1 && (/[.:]/.test(parts[0]) || parts[0] === 'localhost')) {
    registry = parts.shift()!;
    explicitRegistry = true;
  }
  const official = registry === 'docker.io' && parts.length === 1;
  const repo = parts.join('/');
  const base = parts[parts.length - 1] ?? '';
  return { registry, explicitRegistry, repo, base, tag, digest, official };
}

/** Parse the short port syntax `[ip:][host:]container[/proto]` */
export function parsePort(spec: string) {
  let s = spec.trim();
  let proto = 'tcp';
  const p = s.match(/\/(tcp|udp|sctp)$/i);
  if (p) [s, proto] = [s.slice(0, p.index), p[1].toLowerCase()];
  let ip: string | undefined;
  const v6 = s.match(/^\[([^\]]+)\]:(.*)$/);
  if (v6) [ip, s] = [v6[1], v6[2]];
  const parts = s.split(':');
  let host: string | undefined;
  let container: string;
  if (parts.length === 1) container = parts[0];
  else if (parts.length === 2) [host, container] = parts;
  else {
    container = parts.pop()!;
    host = parts.pop()!;
    ip = parts.join(':');
  }
  return { ip, host: host || undefined, container, proto };
}

const isLocalIp = (ip?: string) => !!ip && /^(127\.|::1$|localhost$)/.test(ip);

export function explain(src: string): Result {
  const res: Result = { empty: !src.trim(), problems: [], services: [], networks: [], volumes: [], envRefs: [], findings: [], lines: {} };
  if (res.empty) return res;

  const lc = new LineCounter();
  const doc = parseDocument(src, { lineCounter: lc, merge: true, uniqueKeys: true, prettyErrors: true }) as Document.Parsed;
  const lineOf = (n?: Node | null | Pair | unknown): number => {
    const node = isPair(n) ? (n.key as Node) : (n as Node | undefined);
    const off = node && 'range' in node && node.range ? node.range[0] : undefined;
    return off == null ? 0 : lc.linePos(off).line;
  };

  for (const e of doc.errors) {
    const lp = e.linePos?.[0];
    res.problems.push({ k: `err.${e.code}`, line: lp?.line, col: lp?.col, v: { msg: e.message.split('\n')[0].replace(/ at line \d+, column \d+:?$/, ''), code: e.code } });
  }
  // Tabs are a classic: YAML allows no tabs for indentation
  src.split('\n').forEach((l, i) => {
    if (/^ *\t/.test(l) && !res.problems.some((p) => p.line === i + 1)) res.problems.push({ k: 'err.TAB_AS_INDENT', line: i + 1, v: {} });
  });

  const add = (sev: Severity, rule: Rule, line?: number, service?: string, v: Vars = {}) => {
    res.findings.push({ sev, rule, line: line || undefined, service, v });
    if (line) {
      const cur = res.lines[line];
      if (!cur || sevRank[sev] > sevRank[cur]) res.lines[line] = sev;
    }
  };
  const mark = (line: number, sev: Severity) => {
    const cur = res.lines[line];
    if (line && (!cur || sevRank[sev] > sevRank[cur])) res.lines[line] = sev;
  };

  const resolve = (n: unknown): unknown => (isAlias(n) ? n.resolve(doc) : n);
  /** Map entries with `<<` merge keys expanded (own keys win) */
  const entries = (m: YAMLMap): Pair[] => {
    const own: Pair[] = [];
    const merged: Pair[] = [];
    for (const p of m.items) {
      const k = isScalar(p.key) ? p.key.value : p.key;
      if (k === '<<' || (typeof k === 'symbol' && k.description === '<<')) {
        const v = resolve(p.value);
        const srcs = isSeq(v) ? v.items.map(resolve) : [v];
        for (const s of srcs) if (isMap(s)) merged.push(...entries(s));
      } else own.push(p);
    }
    const keys = new Set(own.map(keyOf));
    return [...own, ...merged.filter((p) => !keys.has(keyOf(p)))];
  };
  const keyOf = (p: Pair) => String(isScalar(p.key) ? p.key.value : p.key);
  const str = (n: unknown): string => {
    const r = resolve(n);
    if (isScalar(r)) return r.value == null ? '' : String(r.value);
    return r == null ? '' : String(r);
  };
  const mapOf = (n: unknown) => {
    const r = resolve(n);
    return isMap(r) ? r : undefined;
  };
  const seqOf = (n: unknown) => {
    const r = resolve(n);
    return isSeq(r) ? r : undefined;
  };
  const get = (m: YAMLMap | undefined, key: string) => (m ? entries(m).find((p) => keyOf(p) === key) : undefined);
  /** Items of a list or a map (`- a` or `a:`), as { text, node, line, value } */
  const listish = (n: unknown) => {
    const seq = seqOf(n);
    if (seq) return seq.items.map((it) => ({ name: str(it), node: resolve(it), line: lineOf(it), value: undefined as unknown }));
    const map = mapOf(n);
    if (map) return entries(map).map((p) => ({ name: keyOf(p), node: resolve(p.value), line: lineOf(p), value: p.value }));
    const s = str(n);
    return s ? [{ name: s, node: resolve(n), line: lineOf(n), value: undefined as unknown }] : [];
  };

  const refs = new Set<string>();
  for (const m of src.matchAll(REF)) {
    const lineStart = src.lastIndexOf('\n', m.index) + 1;
    if (/^\s*#/.test(src.slice(lineStart, m.index))) continue;
    if (src[m.index - 1] === '$') continue; // $$ is an escaped dollar
    refs.add(m[1] ?? m[2]);
  }
  res.envRefs = [...refs];

  const root = mapOf(doc.contents);
  if (!root) {
    if (!res.problems.length) res.problems.push({ k: 's.notMap', line: 1, v: {} });
    return res;
  }

  const ver = get(root, 'version');
  if (ver) add('info', 'version', lineOf(ver), undefined, { value: str(ver.value) });
  const nm = get(root, 'name');
  if (nm) res.name = str(nm.value);

  const topNets = mapOf(get(root, 'networks')?.value);
  if (topNets)
    for (const p of entries(topNets)) {
      const cfg = mapOf(p.value);
      const ext = cfg ? get(cfg, 'external') : undefined;
      res.networks.push({ name: keyOf(p), external: !!ext && str(ext.value) !== 'false' });
    }
  const topVols = mapOf(get(root, 'volumes')?.value);
  if (topVols) for (const p of entries(topVols)) res.volumes.push(keyOf(p));

  const svcPair = get(root, 'services');
  const svcMap = mapOf(svcPair?.value);
  if (!svcMap) {
    res.problems.push({ k: svcPair ? 's.servicesNotMap' : 's.noServices', line: svcPair ? lineOf(svcPair) : 1, v: {} });
    return res;
  }
  const svcNames = entries(svcMap).map(keyOf);
  const pinned: string[] = [];
  const secretRefs: string[] = [];
  const restartSet: string[] = [];

  for (const sp of entries(svcMap)) {
    const name = keyOf(sp);
    const svc: ServiceInfo = { name, line: lineOf(sp), items: [] };
    res.services.push(svc);
    const m = mapOf(sp.value);
    if (!m) {
      res.problems.push({ k: 's.serviceNotMap', line: lineOf(sp), v: { name } });
      continue;
    }
    const hasTraefik = (() => {
      const l = get(m, 'labels');
      return !!l && listish(l.value).some((x) => x.name.startsWith('traefik.'));
    })();
    const item = (p: Pair, list: Entry[]) => svc.items.push({ key: keyOf(p), line: lineOf(p), entries: list });
    const one = (p: Pair, notes: Note[], text = str(p.value)) => item(p, [{ text, line: lineOf(p), notes }]);

    const image = get(m, 'image');
    if (!image && !get(m, 'build')) add('warn', 'noImage', svc.line, name, { service: name });

    for (const p of entries(m)) {
      const key = keyOf(p);
      const line = lineOf(p);
      const val = resolve(p.value);
      switch (key) {
        case 'image': {
          const ref = str(val);
          const notes: Note[] = [];
          if (/\$/.test(ref)) {
            notes.push({ k: 'n.image.var' });
            one(p, notes);
            break;
          }
          const im = parseImage(ref);
          notes.push({ k: im.explicitRegistry ? 'n.image.registry' : 'n.image.hub', v: { registry: im.registry } });
          notes.push({ k: im.official ? 'n.image.official' : 'n.image.repo', v: { repo: im.repo } });
          const isDb = DB_IMAGES.test(im.base);
          if (im.digest) notes.push({ k: 'n.image.digest', v: { digest: im.digest.slice(0, 19) + '…' } });
          if (!im.tag) notes.push({ k: 'n.image.noTag' });
          else if (im.tag === 'latest') notes.push({ k: 'n.image.latest' });
          else if (FLOATING.test(im.tag) || !/\d/.test(im.tag)) notes.push({ k: 'n.image.floating', v: { tag: im.tag } });
          else notes.push({ k: /^v?\d+$/.test(im.tag) ? 'n.image.major' : /^v?\d+\.\d+$/.test(im.tag) ? 'n.image.minor' : 'n.image.tag', v: { tag: im.tag } });
          if (isDb) notes.push({ k: 'n.image.db' });
          one(p, notes);
          const floating = !im.tag || im.tag === 'latest';
          if (im.digest) pinned.push(name);
          else if (isDb && (floating || !/^v?\d/.test(im.tag!))) add('warn', 'dbMajor', line, name, { service: name, image: ref });
          else if (floating) add('warn', 'latest', line, name, { service: name, image: ref });
          else if (FLOATING.test(im.tag!) || !/\d/.test(im.tag!)) add('info', 'floatingTag', line, name, { service: name, tag: im.tag! });
          else pinned.push(name);
          break;
        }
        case 'container_name':
          one(p, [{ k: 'n.container_name', v: { value: str(val) } }]);
          break;
        case 'restart': {
          const v = str(val);
          const known = ['no', 'always', 'unless-stopped', 'on-failure'];
          const base = v.split(':')[0];
          one(p, [{ k: known.includes(base) ? `n.restart.${base}` : 'n.restart.other' }]);
          if (base === 'no' || v === 'false') add('info', 'noRestart', line, name, { service: name });
          else restartSet.push(name);
          break;
        }
        case 'ports': {
          const list: Entry[] = [];
          let publicLines: number[] = [];
          let anyLocal = false;
          for (const it of listish(p.value)) {
            const n = it.node;
            let spec: ReturnType<typeof parsePort>;
            let text = it.name;
            if (isMap(n)) {
              const g = (k: string) => {
                const x = get(n, k);
                return x ? str(x.value) : undefined;
              };
              spec = { ip: g('host_ip'), host: g('published'), container: g('target') ?? '', proto: g('protocol') ?? 'tcp' };
              text = `${spec.ip ? spec.ip + ':' : ''}${spec.host ? spec.host + ':' : ''}${spec.container}${spec.proto !== 'tcp' ? '/' + spec.proto : ''}`;
            } else {
              spec = parsePort(it.name);
              if (isScalar(n) && n.type === 'PLAIN' && /^\d+:\d+$/.test(it.name)) add('info', 'unquotedPort', it.line, name, { value: it.name });
            }
            const notes: Note[] = [];
            const vars = { host: spec.host ?? '', container: spec.container, proto: spec.proto.toUpperCase(), ip: spec.ip ?? '' };
            if (!spec.host) notes.push({ k: 'n.port.containerOnly', v: vars });
            else notes.push({ k: 'n.port.map', v: vars });
            if (isLocalIp(spec.ip)) {
              notes.push({ k: 'n.port.local', v: vars });
              anyLocal = true;
              mark(it.line, 'good');
            } else {
              notes.push({ k: spec.ip && spec.ip !== '0.0.0.0' ? 'n.port.ip' : 'n.port.all', v: vars });
              publicLines.push(it.line);
            }
            list.push({ text, line: it.line, notes });
          }
          item(p, list);
          if (publicLines.length) {
            add('info', hasTraefik ? 'portsWithProxy' : 'publicPort', publicLines[0], name, { service: name });
            publicLines.slice(1).forEach((l) => mark(l, 'info'));
          } else if (anyLocal) add('good', 'localPort', line, name, { service: name });
          break;
        }
        case 'expose':
          item(p, listish(p.value).map((it) => ({ text: it.name, line: it.line, notes: [{ k: 'n.expose' }] })));
          break;
        case 'volumes': {
          const list: Entry[] = [];
          for (const it of listish(p.value)) {
            const n = it.node;
            let source = '';
            let target = '';
            let ro = false;
            let type = '';
            if (isMap(n)) {
              const g = (k: string) => {
                const x = get(n, k);
                return x ? str(x.value) : '';
              };
              source = g('source');
              target = g('target');
              type = g('type');
              ro = g('read_only') === 'true';
            } else {
              const parts = it.name.split(':');
              if (parts.length === 1) target = parts[0];
              else {
                source = parts[0];
                target = parts[1];
                ro = (parts[2] ?? '').split(',').includes('ro');
              }
            }
            const notes: Note[] = [];
            const vars = { source, target };
            const bind = type === 'bind' || /^[./~$]/.test(source);
            const text = isMap(n) ? `${source ? source + ':' : ''}${target}${ro ? ':ro' : ''}` : it.name;
            if (type === 'tmpfs') notes.push({ k: 'n.vol.tmpfs', v: vars });
            else if (!source) {
              notes.push({ k: 'n.vol.anon', v: vars });
              add('info', 'anonVolume', it.line, name, { service: name, target });
            } else if (bind) {
              notes.push({ k: source.startsWith('.') ? 'n.vol.relative' : 'n.vol.bind', v: vars });
              if (source.startsWith('$')) notes.push({ k: 'n.vol.var' });
              if (SOCK.test(source)) {
                add('warn', 'dockerSock', it.line, name, { service: name });
              } else if (/^(~|\$\{?HOME\}?|\/home\/|\/root(\/|$))/.test(source)) {
                add('info', 'homePath', it.line, name, { service: name, source });
              } else if (source.startsWith('./') || source === '.') {
                const rel = source.replace(/^\.\/?/, '');
                const looksLikeFile = /\.[a-z0-9]{2,5}$/i.test(rel);
                if (!/^data(\/|$)/.test(rel) && !looksLikeFile && !ro) add('info', 'dataOutside', it.line, name, { service: name, source });
              }
            } else {
              notes.push({ k: 'n.vol.named', v: vars });
              if (!res.volumes.includes(source)) add('warn', 'undeclaredVolume', it.line, name, { service: name, volume: source });
              else add('info', 'namedVolume', it.line, name, { service: name, volume: source, target });
            }
            if (ro) notes.push({ k: 'n.vol.ro' });
            list.push({ text, line: it.line, notes });
          }
          item(p, list);
          break;
        }
        case 'environment': {
          const list: Entry[] = [];
          for (const it of listish(p.value)) {
            let k = it.name;
            let v: string | undefined;
            if (isSeq(val)) {
              const eq = it.name.indexOf('=');
              if (eq >= 0) [k, v] = [it.name.slice(0, eq), it.name.slice(eq + 1)];
            } else {
              const sv = resolve(it.value);
              v = sv == null || (isScalar(sv) && sv.value == null) ? undefined : str(sv);
            }
            const notes: Note[] = [];
            const hasRef = v != null && /\$\{?[A-Za-z_]/.test(v);
            if (v == null) notes.push({ k: 'n.env.pass', v: { name: k } });
            else if (hasRef) notes.push({ k: 'n.env.ref', v: { name: k, refs: [...v.matchAll(REF)].map((m) => m[1] ?? m[2]).join(', ') } });
            else notes.push({ k: 'n.env.value', v: { name: k } });
            if (SECRET_NAME.test(k) && !/_FILE$/i.test(k) && v != null && v !== '') {
              if (hasRef) secretRefs.push(k);
              else add('warn', 'plainSecret', it.line, name, { service: name, name: k, ref: '${' + k + '}' });
            }
            list.push({ text: isSeq(val) ? it.name : `${k}: ${v ?? ''}`, line: it.line, notes });
          }
          item(p, list);
          break;
        }
        case 'env_file':
          item(p, listish(p.value).map((it) => ({ text: isMap(it.node) ? str(get(it.node, 'path')?.value) : it.name, line: it.line, notes: [{ k: 'n.env_file' }] })));
          break;
        case 'networks': {
          const list: Entry[] = [];
          for (const it of listish(p.value)) {
            const notes: Note[] = [{ k: 'n.net', v: { name: it.name } }];
            const known = res.networks.find((x) => x.name === it.name);
            if (known?.external) notes.push({ k: 'n.net.external' });
            if (!known && it.name !== 'default') add('warn', 'undeclaredNetwork', it.line, name, { service: name, network: it.name });
            list.push({ text: it.name, line: it.line, notes });
          }
          item(p, list);
          break;
        }
        case 'network_mode': {
          const v = str(val);
          one(p, [{ k: v === 'host' ? 'n.network_mode.host' : /^(service|container):/.test(v) ? 'n.network_mode.shared' : v === 'none' ? 'n.network_mode.none' : 'n.network_mode.other', v: { value: v } }]);
          if (v === 'host') add('warn', 'hostNetwork', line, name, { service: name });
          break;
        }
        case 'depends_on': {
          const list: Entry[] = [];
          for (const it of listish(p.value)) {
            const cond = isMap(it.node) ? str(get(it.node, 'condition')?.value) : '';
            const notes: Note[] = [{ k: cond === 'service_healthy' ? 'n.dep.healthy' : cond === 'service_completed_successfully' ? 'n.dep.completed' : 'n.dep', v: { name: it.name } }];
            if (!svcNames.includes(it.name)) add('warn', 'unknownDep', it.line, name, { service: name, dep: it.name });
            list.push({ text: it.name, line: it.line, notes });
          }
          item(p, list);
          break;
        }
        case 'labels': {
          const list: Entry[] = [];
          for (const it of listish(p.value)) {
            let k = it.name;
            let v = '';
            if (isSeq(val)) {
              const eq = it.name.indexOf('=');
              if (eq >= 0) [k, v] = [it.name.slice(0, eq), it.name.slice(eq + 1)];
            } else v = str(it.value);
            list.push({ text: isSeq(val) ? it.name : `${k}: ${v}`, line: it.line, notes: [labelNote(k, v)] });
          }
          item(p, list);
          break;
        }
        case 'healthcheck': {
          const hm = mapOf(val);
          const dis = hm && get(hm, 'disable');
          if (dis && str(dis.value) === 'true') one(p, [{ k: 'n.healthcheck.disabled' }], 'disable: true');
          else {
            const test = hm ? get(hm, 'test') : undefined;
            const tv = test ? (seqOf(test.value) ? seqOf(test.value)!.items.map(str).filter((x) => !/^CMD(-SHELL)?$/.test(x)).join(' ') : str(test.value)) : '';
            const iv = hm ? get(hm, 'interval') : undefined;
            one(p, [{ k: 'n.healthcheck', v: { interval: iv ? str(iv.value) : '30s' } }], tv);
            add('good', 'healthcheck', line, name, { service: name });
          }
          break;
        }
        case 'user': {
          const v = str(val);
          one(p, [{ k: /^(0|root)(:|$)/.test(v) ? 'n.user.root' : 'n.user', v: { value: v } }]);
          break;
        }
        case 'cap_add': {
          const caps = listish(p.value);
          item(p, caps.map((it) => ({ text: it.name, line: it.line, notes: [{ k: capNote(it.name) }] })));
          const strong = caps.filter((c) => /^(CAP_)?(ALL|SYS_ADMIN|SYS_MODULE|SYS_PTRACE|SYS_RAWIO|DAC_READ_SEARCH)$/i.test(c.name));
          if (strong.length) add('warn', 'capAddStrong', strong[0].line, name, { service: name, caps: strong.map((c) => c.name).join(', ') });
          else if (caps.length) add('info', 'capAdd', line, name, { service: name, caps: caps.map((c) => c.name).join(', ') });
          break;
        }
        case 'cap_drop':
          item(p, listish(p.value).map((it) => ({ text: it.name, line: it.line, notes: [{ k: 'n.cap_drop' }] })));
          break;
        case 'privileged': {
          const on = str(val) === 'true';
          one(p, [{ k: on ? 'n.privileged' : 'n.privileged.off' }]);
          if (on) add('warn', 'privileged', line, name, { service: name });
          break;
        }
        case 'pid':
          one(p, [{ k: str(val) === 'host' ? 'n.pid.host' : 'n.generic', v: { key } }]);
          if (str(val) === 'host') add('warn', 'pidHost', line, name, { service: name });
          break;
        case 'devices':
          item(p, listish(p.value).map((it) => ({ text: it.name, line: it.line, notes: [{ k: /\/dev\/dri/.test(it.name) ? 'n.devices.dri' : /\/dev\/(tty|serial)/.test(it.name) ? 'n.devices.serial' : 'n.devices', v: { dev: it.name.split(':')[0] } }] })));
          break;
        case 'security_opt': {
          const list = listish(p.value);
          item(p, list.map((it) => ({ text: it.name, line: it.line, notes: [{ k: /^no-new-privileges(:true)?$/.test(it.name) ? 'n.security_opt.nnp' : 'n.security_opt' }] })));
          const nnp = list.find((it) => /^no-new-privileges(:true)?$/.test(it.name));
          if (nnp) add('good', 'noNewPrivileges', nnp.line, name, { service: name });
          break;
        }
        default: {
          const simple = ['build', 'command', 'entrypoint', 'hostname', 'extra_hosts', 'logging', 'deploy', 'tmpfs', 'working_dir', 'init', 'stop_grace_period', 'mem_limit', 'shm_size', 'secrets', 'configs', 'profiles', 'sysctls', 'ulimits', 'dns', 'read_only', 'stdin_open', 'tty', 'platform', 'pull_policy', 'cpus', 'group_add', 'stop_signal', 'domainname', 'ipc'];
          const text = isScalar(val) ? str(val) : seqOf(val) ? seqOf(val)!.items.map(str).join(' ') : isMap(val) ? '…' : '';
          one(p, [{ k: simple.includes(key) ? `n.key.${key}` : key.startsWith('x-') ? 'n.key.x' : 'n.key.unknown', v: { key } }], text);
        }
      }
    }
    if (!get(m, 'restart')) add('info', 'noRestart', svc.line, name, { service: name });
  }

  if (pinned.length) add('good', 'pinned', undefined, undefined, { services: pinned.join(', ') });
  if (secretRefs.length) add('good', 'secretRef', undefined, undefined, { names: [...new Set(secretRefs)].join(', ') });
  if (restartSet.length && restartSet.length === res.services.length) add('good', 'restartSet', undefined, undefined, { services: restartSet.join(', ') });

  res.problems.sort((a, b) => (a.line ?? 1e9) - (b.line ?? 1e9));
  res.findings.sort((a, b) => sevRank[b.sev] - sevRank[a.sev] || (a.line ?? 1e9) - (b.line ?? 1e9));
  return res;
}

function labelNote(k: string, v: string): Note {
  if (!k.startsWith('traefik.')) return { k: 'n.label', v: { key: k } };
  const m = k.match(/^traefik\.(http|tcp|udp)\.(routers|services|middlewares)\.([^.]+)\.(.+)$/);
  if (k === 'traefik.enable') return { k: v === 'true' ? 'n.traefik.enable' : 'n.traefik.disable' };
  if (k === 'traefik.docker.network') return { k: 'n.traefik.network', v: { value: v } };
  if (!m) return { k: 'n.traefik.other' };
  const [, , kind, obj, rest] = m;
  if (kind === 'routers') {
    if (rest === 'rule') {
      const hosts = [...v.matchAll(/Host\(\s*`([^`]+)`/g)].map((x) => x[1]);
      const paths = [...v.matchAll(/PathPrefix\(\s*`([^`]+)`/g)].map((x) => x[1]);
      return { k: paths.length ? 'n.traefik.rulePath' : hosts.length ? 'n.traefik.rule' : 'n.traefik.ruleOther', v: { router: obj, host: hosts.join(', '), path: paths.join(', ') } };
    }
    if (rest === 'entrypoints') return { k: 'n.traefik.entrypoints', v: { router: obj, value: v } };
    if (rest === 'tls.certresolver') return { k: 'n.traefik.certresolver', v: { router: obj, value: v } };
    if (rest === 'tls') return { k: 'n.traefik.tls', v: { router: obj } };
    if (rest === 'middlewares') return { k: 'n.traefik.middlewares', v: { router: obj, value: v } };
    if (rest === 'service') return { k: 'n.traefik.service', v: { router: obj, value: v } };
    return { k: 'n.traefik.router', v: { router: obj } };
  }
  if (kind === 'services' && /loadbalancer\.server\.port$/i.test(rest)) return { k: 'n.traefik.port', v: { value: v } };
  if (kind === 'services' && /loadbalancer\.server\.scheme$/i.test(rest)) return { k: 'n.traefik.scheme', v: { value: v } };
  if (kind === 'middlewares') return { k: 'n.traefik.middleware', v: { name: obj } };
  return { k: 'n.traefik.other' };
}

function capNote(cap: string): string {
  const c = cap.toUpperCase().replace(/^CAP_/, '');
  const known = ['NET_ADMIN', 'NET_RAW', 'NET_BIND_SERVICE', 'SYS_ADMIN', 'SYS_TIME', 'SYS_NICE', 'SYS_MODULE', 'SYS_PTRACE', 'ALL', 'CHOWN', 'SETUID', 'SETGID', 'DAC_OVERRIDE'];
  return known.includes(c) ? `n.cap.${c}` : 'n.cap';
}

/** Deliberately flawed example (English comments: the file looks the same in both languages) */
export const EXAMPLE = `version: "3.8"

services:
  app:
    image: nextcloud
    container_name: nextcloud
    ports:
      - "8080:80"
    volumes:
      - nextcloud_data:/var/www/html
    environment:
      - MYSQL_HOST=db
      - MYSQL_USER=nextcloud
      - MYSQL_PASSWORD=supersecret123
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: mariadb:latest
    environment:
      MYSQL_ROOT_PASSWORD: hunter2
      MYSQL_PASSWORD: \${DB_PASSWORD}
      MYSQL_DATABASE: nextcloud
    volumes:
      - ./db:/var/lib/mysql

  dashboard:
    image: ghcr.io/example/dashboard:1.4.2
    ports:
      - 3000:3000
    volumes:
      # lets the dashboard see all containers
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ~/dashboard:/config
    labels:
      - traefik.enable=true
      - traefik.http.routers.dash.rule=Host(\`dash.example.com\`)
      - traefik.http.routers.dash.entrypoints=websecure
      - traefik.http.routers.dash.tls.certresolver=le
      - traefik.http.services.dash.loadbalancer.server.port=3000
    restart: unless-stopped

volumes:
  nextcloud_data:
`;
