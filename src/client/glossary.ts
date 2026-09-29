/**
 * Short explanation above glossary links (set by src/lib/remark-glossary.mjs as data-term / data-tip).
 * - Mouse: shows on hover and keyboard focus, the link works as usual.
 * - Touch: the first tap shows the box with a "More in the glossary" link, a second tap on the word follows the link.
 */
import { ui } from './store';

let tip: HTMLDivElement | null = null;
let current: HTMLAnchorElement | null = null;
let hideTimer = 0;
/** Touch: the link whose explanation was opened by a tap (focus alone doesn't count) */
let armed: HTMLAnchorElement | null = null;

function box() {
  if (tip) return tip;
  tip = document.createElement('div');
  tip.className = 'gl-tip';
  tip.id = 'gl-tip';
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  tip.addEventListener('mouseenter', () => clearTimeout(hideTimer));
  tip.addEventListener('mouseleave', () => hide(150));
  document.body.append(tip);
  return tip;
}

function show(link: HTMLAnchorElement) {
  clearTimeout(hideTimer);
  const el = box();
  current?.removeAttribute('aria-describedby');
  current = link;
  const strong = document.createElement('strong');
  strong.textContent = link.dataset.term ?? link.textContent ?? '';
  const text = document.createElement('span');
  text.textContent = link.dataset.tip ?? '';
  const more = document.createElement('a');
  more.href = link.href;
  more.textContent = `${ui()['glossary.more'] ?? '→'} →`;
  el.replaceChildren(strong, text, more);
  el.hidden = false;
  link.setAttribute('aria-describedby', 'gl-tip');
  place(link, el);
}

/** Above the word if there is room, otherwise below; kept inside the viewport horizontally */
function place(link: HTMLElement, el: HTMLElement) {
  const r = link.getBoundingClientRect();
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const gap = 8;
  const left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), document.documentElement.clientWidth - w - 8);
  const above = r.top - h - gap > 8;
  el.dataset.side = above ? 'top' : 'bottom';
  el.style.left = `${left + scrollX}px`;
  el.style.top = `${(above ? r.top - h - gap : r.bottom + gap) + scrollY}px`;
  el.style.setProperty('--arrow', `${r.left + r.width / 2 - left}px`);
}

function hide(delay = 0) {
  clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => {
    if (tip) tip.hidden = true;
    current?.removeAttribute('aria-describedby');
    current = null;
    armed = null;
  }, delay);
}

export function initGlossary() {
  const links = document.querySelectorAll<HTMLAnchorElement>('a.glossary-link[data-tip]');
  if (!links.length) return;
  const hover = matchMedia('(hover: hover) and (pointer: fine)');
  links.forEach((a) => {
    a.addEventListener('mouseenter', () => hover.matches && show(a));
    a.addEventListener('mouseleave', () => hover.matches && hide(150));
    a.addEventListener('focus', () => show(a));
    // On touch the popup closes by tapping elsewhere, so tapping its link isn't cut short by the blur
    a.addEventListener('blur', () => hover.matches && hide(150));
    a.addEventListener('click', (e) => {
      // Touch: first tap explains, second tap on the same word follows the link
      if (!hover.matches && armed !== a) {
        e.preventDefault();
        show(a);
        armed = a;
      }
    });
  });
  document.addEventListener('keydown', (e) => e.key === 'Escape' && hide());
  document.addEventListener('pointerdown', (e) => {
    const t = e.target as Node;
    if (tip && !tip.hidden && !tip.contains(t) && !(t instanceof Element && t.closest('a.glossary-link'))) hide();
  });
  addEventListener('scroll', () => current && tip && !tip.hidden && place(current, tip), { passive: true });
}
