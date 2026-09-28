// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://yourhomelab.guide',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  compressHTML: true,
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  markdown: { syntaxHighlight: false },
  integrations: [
    mdx(),
    sitemap({ filter: (page) => !page.includes('/404') && page !== 'https://yourhomelab.guide/' }),
  ],
  devToolbar: { enabled: false },
  // Never inline scripts, so the CSP can use script-src 'self' without 'unsafe-inline'
  vite: { build: { assetsInlineLimit: 0 } },
});
