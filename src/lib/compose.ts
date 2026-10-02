/**
 * Turns a contributor-written compose.yaml into all variants a visitor can pick in "Mein Setup"
 * (reverse proxy × URL scheme × data location). Runs at build time only.
 *
 * Contributors write compose.yaml for the "no proxy knowledge" case:
 *   - persistent data under `./data/<name>`
 *   - no Traefik labels, no proxy network, no published web port
 * Everything proxy-specific is added here.
 */
import fs from 'node:fs';
import path from 'node:path';
import YAML, { isMap, isSeq, isScalar, Scalar, YAMLMap, YAMLSeq } from 'yaml';
import { LAN_RANGES, proxies, type Proxy } from '../config/site';

export interface ServiceMeta {
  id: string;
  name: string;
  main?: string;
  port: number;
  hostPort?: number;
  subdomain: string;
  subdomainOnly: boolean;
  reverseProxy: boolean;
  lanOnly: boolean;
  files: string[];
  traefikLabels: string[];
}

export interface Variant {
  compose: string;
  env: string;
  /** Snippet for Caddy / Nginx Proxy Manager when that proxy is chosen */
  proxy: string | null;
  proxyKind: 'caddy' | 'npm' | null;
  tree: string;
  /** Shell commands for the three deploy steps */
  mkdir: string;
  up: string;
  /** Final URL of the service */
  url: string;
  /** Service needs a subdomain although the visitor picked path URLs */
  forcedSub: boolean;
  /** The proxy network has to exist (shown as a separate one-time command) */
  net: boolean;
}

export type VariantKey = `${Proxy}.${'sub' | 'path'}.${'stack' | 'central'}`;

export const serviceDir = (id: string) => path.join(process.cwd(), 'content', 'services', id);

export function readServiceFile(id: string, file: string): string | null {
  try {
    return fs.readFileSync(path.join(serviceDir(id), file), 'utf8');
  } catch {
    return null;
  }
}

export function buildVariants(meta: ServiceMeta): Record<VariantKey, Variant> {
  const composeSrc = readServiceFile(meta.id, 'compose.yaml');
  if (!composeSrc) throw new Error(`[services/${meta.id}] compose.yaml is missing`);
  const envSrc = readServiceFile(meta.id, '.env.example') ?? '';
  const out = {} as Record<VariantKey, Variant>;
  for (const proxy of proxies)
    for (const urlMode of ['sub', 'path'] as const)
      for (const dataMode of ['stack', 'central'] as const)
        out[`${proxy}.${urlMode}.${dataMode}`] = buildVariant(meta, composeSrc, envSrc, proxy, urlMode, dataMode);
  return out;
}

function buildVariant(
  meta: ServiceMeta,
  composeSrc: string,
  envSrc: string,
  proxy: Proxy,
  urlMode: 'sub' | 'path',
  dataMode: 'stack' | 'central',
): Variant {
  const doc = YAML.parseDocument(composeSrc);
  if (doc.errors.length) throw new Error(`[services/${meta.id}] compose.yaml: ${doc.errors[0].message}`);
  const services = doc.get('services');
  if (!isMap(services)) throw new Error(`[services/${meta.id}] compose.yaml has no "services:" mapping`);
  const mainName = meta.main ?? meta.id;
  const main = services.get(mainName);
  if (!isMap(main)) throw new Error(`[services/${meta.id}] service "${mainName}" not found in compose.yaml (set "main" in service.yaml)`);

  const dataPrefix = dataMode === 'stack' ? './data/' : `__DATA_ROOT__/${meta.id}/`;
  const dataDirs = new Set<string>();

  // 1. Persistent data location
  for (const item of services.items) {
    const svc = item.value;
    if (!isMap(svc)) continue;
    const vols = svc.get('volumes');
    if (!isSeq(vols)) continue;
    for (const v of vols.items) {
      const s = isScalar(v) ? String(v.value) : null;
      if (s?.startsWith('./data/')) {
        dataDirs.add(s.slice(7).split(/[/:]/)[0]);
        // mutate in place so comments attached to the item survive
        (v as Scalar).value = dataPrefix + s.slice(7);
      }
    }
  }

  // 2. Reverse proxy wiring
  const useSub = urlMode === 'sub' || meta.subdomainOnly || meta.reverseProxy;
  const host = useSub ? `${meta.subdomain}.__DOMAIN__` : '__DOMAIN__';
  const urlPath = useSub ? '' : `/${meta.subdomain}`;
  const hostPort = meta.hostPort ?? meta.port;
  const direct = proxy === 'none' && !meta.reverseProxy;
  const url = direct ? `http://__SERVER_IP__:${hostPort}` : `https://${host}${urlPath}`;

  if (!meta.reverseProxy) {
    const add: [string, unknown][] = [];
    if (proxy === 'none') {
      add.push(['ports', quoted([`${hostPort}:${meta.port}`])]);
    } else {
      const nets = ['__NETWORK__', ...(services.items.length > 1 ? ['default'] : [])];
      add.push(['networks', nets]);
      if (proxy === 'traefik') {
        const r = `traefik.http.routers.${meta.id}`;
        add.push([
          'labels',
          [
            'traefik.enable=true',
            `${r}.rule=Host(\`${host}\`)${urlPath ? ` && PathPrefix(\`${urlPath}\`)` : ''}`,
            `${r}.entrypoints=websecure`,
            `${r}.tls.certresolver=le`,
            `traefik.http.services.${meta.id}.loadbalancer.server.port=${meta.port}`,
            ...(meta.lanOnly
              ? [`traefik.http.middlewares.${meta.id}-lan.ipallowlist.sourcerange=${LAN_RANGES.join(',')}`, `${r}.middlewares=${meta.id}-lan`]
              : []),
            ...meta.traefikLabels,
          ],
        ]);
      }
    }
    for (const [key, val] of add) mergeInto(doc, main, key, val);
    if (proxy !== 'none') {
      let nets = doc.get('networks');
      if (!isMap(nets)) {
        const pair = doc.createPair('networks', {});
        (pair.key as Scalar).spaceBefore = true;
        (doc.contents as YAMLMap).items.push(pair);
        nets = pair.value;
      }
      (nets as YAMLMap).set('__NETWORK__', doc.createNode({ external: true }));
    }
  }

  const fill = (s: string) =>
    s
      .replaceAll('__HOST__', host)
      .replaceAll('__URL__', url)
      .replaceAll('__SCHEME__', direct ? 'http' : 'https')
      .replaceAll('__PATH__', urlPath);
  const compose = fill(doc.toString({ lineWidth: 0 }));
  const env = fill(envSrc.trim()) || '# –';

  // 3. Snippet for Caddy / NPM
  let proxySnippet: string | null = null;
  let proxyKind: Variant['proxyKind'] = null;
  const target = `${isScalar(main.get('container_name', true)) ? main.get('container_name') : mainName}:${meta.port}`;
  if (!meta.reverseProxy && proxy === 'caddy') {
    proxyKind = 'caddy';
    // Home network only: everyone else gets 403. Inside handle_path for path URLs, because Caddy runs
    // handle_path before respond and would skip the guard otherwise.
    const guard = meta.lanOnly ? [`  @outside not remote_ip ${LAN_RANGES.join(' ')}`, '  respond @outside 403'] : [];
    proxySnippet = urlPath
      ? [`${host} {`, `  handle_path ${urlPath}* {`, ...guard.map((l) => `  ${l}`), `    reverse_proxy ${target}`, '  }', '}'].join('\n')
      : [`${host} {`, ...guard, `  reverse_proxy ${target}`, '}'].join('\n');
  } else if (!meta.reverseProxy && proxy === 'npm') {
    proxyKind = 'npm';
    proxySnippet = [
      `Domain Names   ${host}`,
      'Scheme         http',
      `Forward Host   ${target.split(':')[0]}`,
      `Forward Port   ${meta.port}`,
      "SSL            Let's Encrypt, Force SSL",
      ...(meta.lanOnly ? [`Access List    home network only (allow ${LAN_RANGES.join(', ')})`] : []),
    ].join('\n');
  }

  // 4. Folder tree
  const dirs = [...dataDirs];
  const branch = (i: number, n: number) => (i === n - 1 ? '└── ' : '├── ');
  const stackFiles = ['compose.yaml', ...meta.files, '.env'];
  const tree = ['__ROOT__/', `└── ${meta.id}/`];
  if (dataMode === 'stack' && dirs.length) {
    stackFiles.forEach((f) => tree.push(`    ├── ${f}`));
    tree.push('    └── data/');
    dirs.forEach((d, i) => tree.push(`        ${branch(i, dirs.length)}${d}/`));
  } else {
    stackFiles.forEach((f, i) => tree.push(`    ${branch(i, stackFiles.length)}${f}`));
    if (dirs.length) {
      tree.push('', '__DATA_ROOT__/', `└── ${meta.id}/`);
      dirs.forEach((d, i) => tree.push(`    ${branch(i, dirs.length)}${d}/`));
    }
  }

  const net = proxy !== 'none' || meta.reverseProxy;
  const mkdir = `mkdir -p __ROOT__/${meta.id}${dataMode === 'central' && dirs.length ? ` __DATA_ROOT__/${meta.id}` : ''}`;
  const up = [`cd __ROOT__/${meta.id}`, 'docker compose up -d'].join('\n');

  return {
    compose,
    env,
    proxy: proxySnippet,
    proxyKind,
    tree: tree.join('\n'),
    mkdir,
    up,
    url,
    forcedSub: urlMode === 'path' && (meta.subdomainOnly || meta.reverseProxy),
    net,
  };
}

function quoted(items: string[]) {
  const seq = new YAMLSeq();
  for (const i of items) {
    const s = new Scalar(i);
    s.type = Scalar.QUOTE_DOUBLE;
    seq.items.push(s);
  }
  return seq;
}

/** Appends `val` to key `key` of `map` (list merge), inserted before depends_on/healthcheck when new. */
function mergeInto(doc: YAML.Document, map: YAMLMap, key: string, val: unknown) {
  const existing = map.get(key, true);
  const node = val instanceof YAMLSeq ? val : (doc.createNode(val) as YAMLSeq);
  if (isSeq(existing)) {
    existing.items.push(...node.items);
    return;
  }
  if (isMap(existing) && key === 'networks') {
    for (const n of node.items) existing.set(isScalar(n) ? n.value : n, null);
    return;
  }
  const pair = doc.createPair(key, node);
  const idx = map.items.findIndex((p) => isScalar(p.key) && ['depends_on', 'healthcheck'].includes(String(p.key.value)));
  if (idx === -1) map.items.push(pair);
  else map.items.splice(idx, 0, pair);
}
