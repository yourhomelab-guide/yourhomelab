/** Shows guide progress (start page, setup path, guide pages). Data comes from #yhl-guides. */
import { fmt, getProgress, isGuideDone, ui } from './store';

interface G { slug: string; steps: number; stage: string; title: string; url: string; stub: boolean }

function render() {
  const el = document.getElementById('yhl-guides');
  if (!el) return;
  const guides: G[] = JSON.parse(el.textContent!);
  const p = getProgress();
  const done = new Set(guides.filter((g) => isGuideDone(p, g.slug, g.steps)).map((g) => g.slug));
  const s = ui();

  document.querySelectorAll<HTMLElement>('[data-guide-item]').forEach((it) => it.classList.toggle('is-done', done.has(it.dataset.guideItem!)));

  const stages = new Map<string, G[]>();
  guides.forEach((g) => stages.set(g.stage, [...(stages.get(g.stage) ?? []), g]));
  document.querySelectorAll<HTMLElement>('[data-stage-item]').forEach((it) => {
    const list = stages.get(it.dataset.stageItem!) ?? [];
    const n = list.filter((g) => done.has(g.slug)).length;
    it.classList.toggle('is-done', list.length > 0 && n === list.length);
    it.querySelectorAll('[data-stage-done]').forEach((x) => (x.textContent = String(n)));
    it.querySelectorAll<HTMLElement>('[data-stage-bar]').forEach((x) => (x.style.width = `${list.length ? (n / list.length) * 100 : 0}%`));
  });

  document.querySelectorAll('[data-total-done]').forEach((x) => (x.textContent = fmt(s['home.pathProgress'], { done: done.size, total: guides.length })));
  document.querySelectorAll('[data-total-count]').forEach((x) => (x.textContent = `${done.size} / ${guides.length}`));
  document.querySelectorAll<HTMLElement>('[data-total-bar]').forEach((x) => (x.style.width = `${(done.size / guides.length) * 100}%`));

  // "Weiter bei": first guide that is not done yet
  const next = guides.find((g) => !done.has(g.slug));
  const started = done.size > 0 || Object.keys(p.steps).length > 0;
  document.querySelectorAll<HTMLAnchorElement>('[data-continue]').forEach((a) => {
    if (!next) return void (a.hidden = true);
    a.href = next.url;
    a.querySelector('[data-continue-label]')!.textContent = started ? s['home.continueAt'] : s['home.startAt'];
    a.querySelector('[data-continue-title]')!.textContent = next.title;
  });
  document.querySelectorAll<HTMLElement>('[data-current-hint]').forEach((x) => (x.hidden = x.dataset.currentHint !== next?.slug || !started));
}

render();
document.addEventListener('yhl:progress', render);
window.addEventListener('pageshow', render);
