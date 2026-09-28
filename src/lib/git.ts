import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const cache = new Map<string, Date | null>();

/** Date of the last commit touching `file` (falls back to the file's mtime outside of git). */
export function lastModified(file: string | undefined): Date | null {
  if (!file) return null;
  if (cache.has(file)) return cache.get(file)!;
  let d: Date | null = null;
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (out) d = new Date(out);
  } catch {}
  if (!d) {
    try {
      d = fs.statSync(file).mtime;
    } catch {}
  }
  cache.set(file, d);
  return d;
}
