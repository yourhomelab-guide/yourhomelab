/**
 * Tables that are wider than the page: marks them as scrollable (shows the hint and faded edges) and tracks
 * whether the visitor is at the start or end, so only the side with more content is faded.
 */
export function initTables(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('.table-wrap').forEach((wrap) => {
    const sc = wrap.querySelector<HTMLElement>('.table-scroll');
    if (!sc || wrap.dataset.ready) return;
    wrap.dataset.ready = '1';
    const update = () => {
      const max = sc.scrollWidth - sc.clientWidth;
      wrap.classList.toggle('is-scrollable', max > 2);
      wrap.classList.toggle('at-start', sc.scrollLeft <= 2);
      wrap.classList.toggle('at-end', sc.scrollLeft >= max - 2);
    };
    sc.addEventListener('scroll', update, { passive: true });
    new ResizeObserver(update).observe(sc);
    update();
  });
}
