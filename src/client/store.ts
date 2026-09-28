/** Browser-side state: "Mein Setup" values and guide progress, both in localStorage only. */
import { defaultSetup, placeholders, type Setup } from '../config/site';

const SETUP_KEY = 'yhl-setup';
const PROGRESS_KEY = 'yhl-progress';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, val: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

export const getSetup = (): Setup => read(SETUP_KEY, { ...defaultSetup });
export function setSetup(s: Setup) {
  write(SETUP_KEY, s);
  document.dispatchEvent(new CustomEvent('yhl:setup', { detail: s }));
}
export const isDefaultSetup = (s: Setup) => (Object.keys(defaultSetup) as (keyof Setup)[]).every((k) => s[k] === defaultSetup[k]);

export interface Progress {
  /** checked step indices per guide slug */
  steps: Record<string, number[]>;
  /** guides marked as done manually */
  done: string[];
}
export const getProgress = (): Progress => read(PROGRESS_KEY, { steps: {}, done: [] });
export function setProgress(p: Progress) {
  write(PROGRESS_KEY, p);
  document.dispatchEvent(new CustomEvent('yhl:progress', { detail: p }));
}
export function isGuideDone(p: Progress, slug: string, steps: number) {
  if (p.done.includes(slug)) return true;
  return steps > 0 && (p.steps[slug]?.length ?? 0) >= steps;
}

/** Strings injected by the layout (see Base.astro) */
export const ui = (): Record<string, string> => {
  try {
    return JSON.parse(document.getElementById('yhl-ui')!.textContent!);
  } catch {
    return {};
  }
};
export const fmt = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));

function randomSecret() {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

/** Fills every `[data-ph]` element with the visitor's values. */
export function applyPlaceholders(root: ParentNode = document, s = getSetup()) {
  const map = placeholders as Record<string, keyof Setup>;
  root.querySelectorAll<HTMLElement>('[data-ph]').forEach((el) => {
    const ph = el.dataset.ph!;
    if (ph === 'SECRET') {
      if (!el.dataset.generated) {
        el.textContent = randomSecret();
        el.dataset.generated = '1';
      }
    } else if (map[ph]) el.textContent = String(s[map[ph]]);
  });
}

/** Text of a rendered code block, one entry per `.lc` line */
export const codeText = (pre: Element) => Array.from(pre.querySelectorAll('.lc'), (l) => l.textContent ?? '').join('\n');

export async function copyText(btn: HTMLElement, text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    return;
  }
  const s = ui();
  btn.textContent = s['code.copied'] ?? '✓';
  btn.classList.add('is-copied');
  clearTimeout(Number(btn.dataset.t));
  btn.dataset.t = String(
    setTimeout(() => {
      btn.textContent = s['code.copy'] ?? 'Copy';
      btn.classList.remove('is-copied');
    }, 1400),
  );
}
