/**
 * Tiny, dependency-free highlighter for shell, YAML, .env and Caddyfile snippets.
 * Shared between build time (Astro) and the browser (re-rendering after "Mein Setup" changes).
 */
import { appDataDir, defaultSetup } from '../config/site';

export type TokenKind = 'plain' | 'key' | 'com' | 'var' | 'ref' | 'tree' | 'secret';
export interface Token {
  t: string;
  k: TokenKind;
  /** Placeholder name for `var` tokens, e.g. `DOMAIN` */
  ph?: string;
  /** Argument of a parameterised placeholder, e.g. `traefik` in `__DATA(traefik)__` */
  arg?: string;
}

/** Matches `__DOMAIN__`, `__DATA_ROOT__`, `__SECRET__` … and `__DATA(<app>)__` (group 2 = app) */
export const PH_RE = /__([A-Z][A-Z_]*[A-Z])(?:\(([a-z0-9][a-z0-9-]*)\))?__/g;

/** Build-time text of a placeholder token; the browser replaces it with the visitor's value. */
const phText = (tk: Token, values: Record<string, string>) =>
  tk.arg !== undefined ? appDataDir(defaultSetup, tk.arg) : (values[tk.ph!] ?? tk.t);

/** Attributes the browser uses to fill a placeholder, see applyPlaceholders() */
export const phAttrs = (ph: string, arg?: string) => `data-ph="${ph}"${arg !== undefined ? ` data-arg="${arg}"` : ''}`;

export function tokenizeLine(line: string): Token[] {
  const out: Token[] = [];
  const push = (t: string, k: TokenKind, ph?: string, arg?: string) => {
    if (t) out.push(ph ? { t, k, ph, ...(arg !== undefined && { arg }) } : { t, k });
  };
  if (/^\s*#/.test(line)) {
    splitPlaceholders(line, 'com', push);
    return out;
  }
  let rest = line;
  const m = rest.match(/^(\s*(?:- )?)([A-Za-z_][\w.\-]*)([:=])(?=\s|$|[^/])/);
  if (m && !/^\s*(?:- )?https?:/.test(line)) {
    push(m[1], 'plain');
    push(m[2], 'key');
    push(m[3], 'plain');
    rest = rest.slice(m[0].length);
  }
  for (const part of rest.split(/(\$\{\w+\}|[├└│─]+)/)) {
    if (!part) continue;
    if (part.startsWith('${')) push(part, 'ref');
    else if (/^[├└│─]/.test(part)) push(part, 'tree');
    else splitPlaceholders(part, 'plain', push);
  }
  if (!out.length) push(' ', 'plain');
  return out;
}

function splitPlaceholders(text: string, kind: TokenKind, push: (t: string, k: TokenKind, ph?: string, arg?: string) => void) {
  let last = 0;
  for (const m of text.matchAll(PH_RE)) {
    push(text.slice(last, m.index), kind);
    push(m[0], m[1] === 'SECRET' ? 'secret' : 'var', m[1], m[2]);
    last = m.index! + m[0].length;
  }
  push(text.slice(last), kind);
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Renders code as HTML. Placeholder tokens get `data-ph` so the browser can fill them.
 * `values` provides the text shown for placeholders (defaults at build time).
 */
export function renderCode(code: string, opts: { numbers?: boolean; values: Record<string, string> }): string {
  const lines = code.replace(/\n$/, '').split('\n');
  return lines
    .map((line, i) => {
      const toks = tokenizeLine(line)
        .map((tk) => {
          if (tk.ph) return `<span class="tk-${tk.k}" ${phAttrs(tk.ph, tk.arg)}>${esc(phText(tk, opts.values))}</span>`;
          return tk.k === 'plain' ? esc(tk.t) : `<span class="tk-${tk.k}">${esc(tk.t)}</span>`;
        })
        .join('');
      const num = opts.numbers ? `<span class="ln" aria-hidden="true">${i + 1}</span>` : '';
      return `<span class="line">${num}<span class="lc">${toks}</span></span>`;
    })
    .join('');
}
