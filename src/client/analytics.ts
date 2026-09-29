/**
 * Loads the Umami script only after the page has finished loading and the browser is idle. As a plain `defer`
 * script in <head> it held back every other script on the page (they run in order) whenever the stats server
 * was slow. Settings come from <script id="yhl-umami"> in Base.astro, which is left out on preview builds.
 */
export function loadAnalytics() {
  const el = document.getElementById('yhl-umami');
  if (!el) return;
  let cfg: { src: string; websiteId: string; domains?: string };
  try {
    cfg = JSON.parse(el.textContent ?? '');
  } catch {
    return;
  }
  const inject = () => {
    const s = document.createElement('script');
    s.async = true;
    s.src = cfg.src;
    s.dataset.websiteId = cfg.websiteId;
    if (cfg.domains) s.dataset.domains = cfg.domains;
    s.dataset.doNotTrack = 'true';
    document.head.append(s);
  };
  const idle = () => ('requestIdleCallback' in window ? requestIdleCallback(inject, { timeout: 4000 }) : setTimeout(inject, 1500));
  if (document.readyState === 'complete') idle();
  else addEventListener('load', idle, { once: true });
}
