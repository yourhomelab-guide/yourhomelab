/** Re-renders service files (compose, .env, commands, URL) for the visitor's proxy/URL/data choice. */
import type { Setup } from '../config/site';
import { renderCode } from '../lib/highlight';
import { ui } from './store';

export function renderVariants(s: Setup) {
  const key = `${s.proxy}.${s.urlMode}.${s.dataMode}`;
  document.querySelectorAll<HTMLElement>('[data-variant-root]').forEach((root) => {
    if (root.dataset.key === key) return;
    const json = root.querySelector('script[data-variants]');
    if (!json) return;
    const all = JSON.parse(json.textContent!);
    const v = all[key];
    if (!v) return;
    root.dataset.key = key;
    const labels = ui();
    root.querySelectorAll<HTMLElement>('[data-v]').forEach((el) => {
      const val = v[el.dataset.v!] ?? '';
      if (el.tagName === 'PRE' || el.hasAttribute('data-v-code')) el.innerHTML = renderCode(val, { numbers: el.hasAttribute('data-numbers'), values: {} });
      else el.textContent = val;
    });
    root.querySelectorAll<HTMLElement>('[data-v-show]').forEach((el) => {
      el.hidden = !v[el.dataset.vShow!];
    });
    root.querySelectorAll<HTMLElement>('[data-v-proxylabel]').forEach((el) => {
      if (v.proxyKind) el.textContent = v.proxyKind === 'caddy' ? 'Caddyfile' : labels['service.npm'];
    });
    // If the active tab disappeared (e.g. proxy snippet), fall back to the first tab
    root.querySelectorAll<HTMLElement>('.files').forEach((f) => {
      const active = f.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
      if (active?.hidden) f.querySelector<HTMLElement>('[role="tab"]')?.click();
    });
  });
}
