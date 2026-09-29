/** Random secrets of any length from a chosen alphabet, using crypto.getRandomValues without modulo bias. */

export const charsets = {
  /** 0-9 a-f: safe everywhere (.env, YAML, shell), like `openssl rand -hex` */
  hex: '0123456789abcdef',
  /** A-Z a-z 0-9: safe everywhere, more entropy per character */
  alnum: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  /** URL-safe Base64 alphabet (A-Z a-z 0-9 - _) */
  base64url: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_',
  /** With symbols for passwords. Leaves out $ ` " ' \ and spaces, which need quoting in .env, YAML or the shell. */
  symbols: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#%&*+,-./:;<=>?@^_~',
} as const;
export type Charset = keyof typeof charsets;

export const LENGTH_MIN = 8;
export const LENGTH_MAX = 256;
export const LENGTH_DEFAULT = 32;

export const clampLength = (n: number) => Math.min(LENGTH_MAX, Math.max(LENGTH_MIN, Math.round(Number.isFinite(n) ? n : LENGTH_DEFAULT)));

/** `length` characters from `alphabet`; bytes above the largest multiple of the alphabet size are thrown away */
export function randomString(length: number, alphabet: string): string {
  const n = alphabet.length;
  const limit = 256 - (256 % n);
  let out = '';
  const buf = new Uint8Array(Math.max(16, length * 2));
  while (out.length < length) {
    crypto.getRandomValues(buf);
    for (const b of buf) {
      if (b >= limit) continue;
      out += alphabet[b % n];
      if (out.length === length) break;
    }
  }
  return out;
}

/** Entropy in bits, rounded down */
export const entropyBits = (length: number, charset: Charset) => Math.floor(length * Math.log2(charsets[charset].length));

/** The same kind of value on the command line, for people who'd rather create it on the server */
export function shellCommand(length: number, charset: Charset): string {
  if (charset === 'hex') return length % 2 === 0 ? `openssl rand -hex ${length / 2}` : `openssl rand -hex ${Math.ceil(length / 2)} | cut -c1-${length}`;
  if (charset === 'alnum') return `tr -dc 'A-Za-z0-9' < /dev/urandom | head -c ${length}; echo`;
  if (charset === 'base64url') return `tr -dc 'A-Za-z0-9_-' < /dev/urandom | head -c ${length}; echo`;
  return `tr -dc 'A-Za-z0-9!#%&*+,./:;<=>?@^_~-' < /dev/urandom | head -c ${length}; echo`;
}
