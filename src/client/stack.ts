/**
 * "Mein Stack": the services a visitor picked in the tools (stack builder, docs export, borgmatic
 * generator). Shared via localStorage so a selection made in one tool shows up in the others.
 */
const KEY = 'yhl-stack';

export function getStack(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function setStack(ids: string[]) {
  const uniq = [...new Set(ids)];
  try {
    localStorage.setItem(KEY, JSON.stringify(uniq));
  } catch {}
  document.dispatchEvent(new CustomEvent('yhl:stack', { detail: uniq }));
}

/** Triggers a download of `data` (string or bytes) as a file */
export function download(name: string, data: string | Uint8Array, type = 'text/plain') {
  const blob = new Blob([data as BlobPart], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
