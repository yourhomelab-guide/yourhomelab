/**
 * Copies service logos into public/icons/ so visitors never contact a third-party CDN.
 * - content/services/<id>/logo.svg wins if present
 * - otherwise the icon is downloaded once from selfh.st/icons (at build time, not by visitors)
 * Missing icons are fine: the site falls back to the service's initial.
 */
import fs from 'node:fs';
import path from 'node:path';

const SRC = 'content/services';
const OUT = 'public/icons';
fs.mkdirSync(OUT, { recursive: true });

const ids = fs.readdirSync(SRC).filter((d) => !d.startsWith('_') && fs.existsSync(path.join(SRC, d, 'service.yaml')));
let fetched = 0, local = 0, missing = [];

await Promise.all(
  ids.map(async (id) => {
    const yaml = fs.readFileSync(path.join(SRC, id, 'service.yaml'), 'utf8');
    const icon = /^icon:\s*["']?([\w.-]+)/m.exec(yaml)?.[1] ?? id;
    const target = path.join(OUT, `${icon}.svg`);
    const own = path.join(SRC, id, 'logo.svg');
    if (fs.existsSync(own)) {
      fs.copyFileSync(own, target);
      local++;
      return;
    }
    if (fs.existsSync(target)) return;
    try {
      const res = await fetch(`https://cdn.jsdelivr.net/gh/selfhst/icons/svg/${icon}.svg`, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(res.status);
      fs.writeFileSync(target, await res.text());
      fetched++;
    } catch {
      missing.push(id);
    }
  }),
);
console.log(`[icons] ${fetched} downloaded, ${local} from service folders${missing.length ? `, missing: ${missing.join(', ')}` : ''}`);
