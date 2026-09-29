/** External links (other hosts) open in a new tab. Templates set this where they can; this covers Markdown content. */
export function initExternalLinks(root: ParentNode = document) {
  for (const a of root.querySelectorAll<HTMLAnchorElement>('a[href^="http"]')) {
    if (a.host === location.host || a.hasAttribute('target')) continue;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  }
}
