/**
 * Reverse proxy snippets for a self-hosted service that is not in the catalog.
 * Mirrors the wiring in src/lib/compose.ts (router name = id, entrypoint websecure, certresolver le,
 * PathPrefix(`/<sub>`) in path mode, handle_path for Caddy). Output keeps `__DOMAIN__` / `__NETWORK__`
 * placeholders; the page fills them with the visitor's "Mein Setup" values.
 */

export type ProxyKind = 'traefik' | 'caddy' | 'npm';

export interface ProxyInput {
  id: string;
  container: string;
  port: number;
  /** Subdomain in sub mode, path segment (without slash) in path mode */
  sub: string;
  urlMode: 'sub' | 'path';
  https: boolean;
  tinyauth: boolean;
  websockets: boolean;
}

/** Name of the Tinyauth middleware / container as used in the Tinyauth guide */
export const TINYAUTH = { middleware: 'tinyauth', target: 'tinyauth:3000' };

export const validId = (s: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) && s.length <= 63;
/** Docker container names: [a-zA-Z0-9][a-zA-Z0-9_.-]* */
export const validContainer = (s: string) => /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(s);
/** One DNS label / path segment */
export const validSub = (s: string) => /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(s);
export const validPort = (n: number) => Number.isInteger(n) && n >= 1 && n <= 65535;

export const host = (i: Pick<ProxyInput, 'sub' | 'urlMode'>) => (i.urlMode === 'sub' ? `${i.sub}.__DOMAIN__` : '__DOMAIN__');
export const path = (i: Pick<ProxyInput, 'sub' | 'urlMode'>) => (i.urlMode === 'path' ? `/${i.sub}` : '');
export const publicUrl = (i: ProxyInput) => `https://${host(i)}${path(i)}`;

export function traefik(i: ProxyInput): string {
  const r = `traefik.http.routers.${i.id}`;
  const s = `traefik.http.services.${i.id}`;
  const p = path(i);
  const labels = [
    'traefik.enable=true',
    `${r}.rule=Host(\`${host(i)}\`)${p ? ` && PathPrefix(\`${p}\`)` : ''}`,
    `${r}.entrypoints=websecure`,
    `${r}.tls.certresolver=le`,
    `${s}.loadbalancer.server.port=${i.port}`,
    ...(i.https ? [`${s}.loadbalancer.server.scheme=https`] : []),
    ...(i.tinyauth ? [`${r}.middlewares=${TINYAUTH.middleware}`] : []),
  ];
  return [
    'services:',
    `  ${i.id}:`,
    '    # image, volumes, environment … stay as they are',
    ...(i.container !== i.id ? [`    container_name: ${i.container}`] : []),
    '    # no "ports:" needed, Traefik reaches the container over the network',
    '    networks:',
    '      - __NETWORK__',
    '    labels:',
    ...labels.map((l) => `      - ${l}`),
    '',
    'networks:',
    '  __NETWORK__:',
    '    external: true',
  ].join('\n');
}

/** networks part for Caddy / NPM (the proxy container has to reach the service) */
export function networkSnippet(i: ProxyInput): string {
  return [
    'services:',
    `  ${i.id}:`,
    '    # image, volumes, environment … stay as they are',
    ...(i.container !== i.id ? [`    container_name: ${i.container}`] : []),
    '    networks:',
    '      - __NETWORK__',
    '',
    'networks:',
    '  __NETWORK__:',
    '    external: true',
  ].join('\n');
}

export function caddy(i: ProxyInput): string {
  const target = `${i.https ? 'https://' : ''}${i.container}:${i.port}`;
  const body: string[] = [];
  if (i.tinyauth) body.push(`forward_auth ${TINYAUTH.target} {`, '  uri /api/auth/caddy', '}');
  if (i.https) body.push(`reverse_proxy ${target} {`, '  transport http {', '    # backend uses a self-signed certificate', '    tls_insecure_skip_verify', '  }', '}');
  else body.push(`reverse_proxy ${target}`);
  const p = path(i);
  const indent = (lines: string[], n: number) => lines.map((l) => ' '.repeat(n) + l);
  return p
    ? [`${host(i)} {`, `  handle_path ${p}* {`, ...indent(body, 4), '  }', '}'].join('\n')
    : [`${host(i)} {`, ...indent(body, 2), '}'].join('\n');
}

export interface NpmRow {
  /** i18n key suffix of the label */
  key: string;
  value: string;
  /** i18n key suffix of the value when it is a word, e.g. on/off */
  valueKey?: string;
}

export function npm(i: ProxyInput): { details: NpmRow[]; location: NpmRow[] | null; ssl: NpmRow[] } {
  const scheme = i.https ? 'https' : 'http';
  const onOff = (b: boolean) => (b ? 'on' : 'off');
  const pathMode = i.urlMode === 'path';
  const details: NpmRow[] = [
    { key: 'npmDomain', value: host(i) },
    { key: 'npmScheme', value: scheme },
    { key: 'npmHost', value: i.container },
    { key: 'npmPort', value: String(i.port) },
    { key: 'npmCache', value: '', valueKey: 'off' },
    { key: 'npmExploits', value: '', valueKey: 'on' },
    { key: 'npmWs', value: '', valueKey: onOff(i.websockets) },
  ];
  const location = pathMode
    ? [
        { key: 'npmLocation', value: path(i) },
        { key: 'npmScheme', value: scheme },
        { key: 'npmHost', value: i.container },
        { key: 'npmPort', value: String(i.port) },
      ]
    : null;
  const ssl: NpmRow[] = [
    { key: 'npmCert', value: '', valueKey: 'npmCertNew' },
    { key: 'npmForce', value: '', valueKey: 'on' },
    { key: 'npmHttp2', value: '', valueKey: 'on' },
    { key: 'npmHsts', value: '', valueKey: 'optional' },
  ];
  return { details, location, ssl };
}
