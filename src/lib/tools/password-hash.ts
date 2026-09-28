/**
 * bcrypt hashes for Tinyauth, Traefik basicauth and htpasswd files. Runs in the browser (bcryptjs, pure JS).
 *
 * Format: `$2y$` – what `htpasswd -B` writes. Tinyauth and Traefik both verify with Go's bcrypt package,
 * which accepts `$2a$`, `$2b$` and `$2y$` alike (the algorithm is identical).
 */
import bcrypt from 'bcryptjs';

export const COST_MIN = 4;
export const COST_MAX = 15;
export const COST_DEFAULT = 10;

/** Usernames end up in `user:hash` lists: no colon, comma or whitespace */
export const validUser = (u: string) => /^[^\s:,]+$/.test(u);
/** kebab-case, used for the Traefik middleware/router name */
export const validName = (n: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(n);
/** bcrypt ignores everything after 72 bytes */
export const tooLong = (pw: string) => new TextEncoder().encode(pw).length > 72;

export function clampCost(n: number) {
  return Number.isFinite(n) ? Math.min(COST_MAX, Math.max(COST_MIN, Math.round(n))) : COST_DEFAULT;
}

/** Salt with the `$2y$` prefix (bcryptjs itself writes `$2b$`) */
export const salt = (cost: number) => bcrypt.genSaltSync(clampCost(cost)).replace(/^\$2[ab]\$/, '$2y$');

export function hash(password: string, cost: number): Promise<string> {
  return bcrypt.hash(password, salt(cost));
}

/** Random password from an unambiguous alphabet, via crypto.getRandomValues (rejection sampling, no bias) */
export function randomPassword(len = 20) {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const out: string[] = [];
  const buf = new Uint8Array(64);
  while (out.length < len) {
    crypto.getRandomValues(buf);
    for (const b of buf) {
      if (b < 256 - (256 % abc.length)) out.push(abc[b % abc.length]);
      if (out.length === len) break;
    }
  }
  return out.join('');
}

export interface HashOutputs {
  /** .env line for Tinyauth (single quotes stop Compose from expanding `$`) */
  tinyauth: string;
  /** compose.yaml labels, every `$` doubled */
  traefik: string;
  htpasswd: string;
}

export function outputs(user: string, h: string, name: string): HashOutputs {
  const line = `${user}:${h}`;
  return {
    tinyauth: `TINYAUTH_USERS='${line}'`,
    traefik: [
      `      - traefik.http.middlewares.${name}-auth.basicauth.users=${line.replaceAll('$', '$$$$')}`,
      `      - traefik.http.routers.${name}.middlewares=${name}-auth`,
    ].join('\n'),
    htpasswd: line,
  };
}
