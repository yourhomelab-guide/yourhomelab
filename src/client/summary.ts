/** Fills the "Dein Setup" chips. */
import type { Setup } from '../config/site';
import { ui } from './store';

export function renderSummaries(s: Setup) {
  const els = document.querySelectorAll<HTMLElement>('[data-sum]');
  if (!els.length) return;
  const t = ui();
  const values: Record<string, string> = {
    proxy: t[`proxy.${s.proxy}`] ?? s.proxy,
    network: s.network,
    stacks: s.root,
    data: s.dataMode === 'stack' ? t['summary.dataStack'] : s.dataRoot,
    urls: s.urlMode === 'sub' ? `${t['summary.service']}.${s.domain}` : `${s.domain}/${t['summary.service']}`,
    server: `${s.user}@${s.serverIp}`,
    os: t[`os.${s.os}`] ?? s.os,
  };
  els.forEach((el) => {
    const k = el.dataset.sum!;
    const b = el.querySelector('b');
    if (b) b.textContent = values[k];
    if (k === 'network') el.hidden = s.proxy === 'none';
  });
}
