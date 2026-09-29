/** Global behaviour loaded on every page. Kept small on purpose. */
import { applyPlaceholders, codeText, copyText, getSetup } from './store';
import { renderVariants } from './variants';
import { renderSummaries } from './summary';
import { initTables } from './tables';
import { initGlossary } from './glossary';
import { loadAnalytics } from './analytics';

initTables();
initGlossary();
loadAnalytics();

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

// Language hint for visitors whose browser prefers the other language
const hint = document.getElementById('lang-hint');
if (hint) {
  const target = hint.dataset.lang!;
  let dismissed = false;
  try {
    dismissed = localStorage.getItem('yhl-lang-hint') === '1';
  } catch {}
  const prefers = (navigator.languages ?? [navigator.language]).map((l) => l.slice(0, 2).toLowerCase());
  const current = document.documentElement.lang;
  if (!dismissed && prefers.indexOf(target) !== -1 && (prefers.indexOf(current) === -1 || prefers.indexOf(target) < prefers.indexOf(current))) hint.hidden = false;
  hint.querySelector('button')?.addEventListener('click', () => {
    hint.hidden = true;
    try {
      localStorage.setItem('yhl-lang-hint', '1');
    } catch {}
  });
}

