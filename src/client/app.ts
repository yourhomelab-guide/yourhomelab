/** Global behaviour loaded on every page. Kept small on purpose. */
import { applyPlaceholders, codeText, copyText, getSetup } from './store';
import { renderVariants } from './variants';
import { renderSummaries } from './summary';

function refresh() {
  const s = getSetup();
  renderVariants(s);
  applyPlaceholders(document, s);
  renderSummaries(s);
}

refresh();
document.addEventListener('yhl:setup', refresh);

// Copy buttons: `.code` blocks and file tab groups
document.addEventListener('click', (e) => {
  const btn = (e.target as Element).closest<HTMLElement>('[data-copy]');
  if (!btn) return;
  const scope = btn.closest('.code, .files');
  const pre = scope?.querySelector('pre:not([hidden])');
  if (pre) copyText(btn, codeText(pre));
});

