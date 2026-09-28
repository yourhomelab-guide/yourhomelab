# yourhomelab – notes for Claude Code

Static Astro site (no Node on the server). All content lives in `content/`, one folder per entry with one file per
language (`de.mdx`, `en.mdx`). Source language is `sourceLang` in `src/config/site.ts` (currently German).
Contributor docs: CONTRIBUTING.md. Build check: `npm run build` (also validates all frontmatter).

## Translating

When asked to translate (e.g. "übersetze", "translate what's missing"):

1. Run `npm run translate status`. It lists **missing**, **outdated** and **machine-translated (DeepL)** targets.
   Translate what the user asked for; by default missing + outdated. DeepL files only when asked to polish them.
2. For each target, read the source file next to it (`de.mdx` → write `en.mdx` in the same folder).
   For outdated files, read the existing target too and only change what the source change requires.
3. Run `npm run translate stamp <target files…> --by claude` for every file you wrote.
4. UI strings: `src/i18n/de.json` → `src/i18n/en.json`. Only the keys listed as outdated; keep key order.
   Then `npm run translate stamp src/i18n/en.json --by claude`.
5. Run `npm run build` to make sure nothing broke.

Rules for the translation:

- Natural, friendly, precise English as a native technical writer would write it; address the reader as "you";
  American spelling. Not word for word – keep meaning, tone and level of detail. Short sentences.
- Frontmatter: translate `title`, `description`, `question`, `summary`, `notes`, `requires`, `updated`.
  Keep `level`, `minutes`, `status`, `related`, `practice`, `services` unchanged.
  **Never copy `slug:`** from the German file – the English URL comes from the folder name.
- Keep MDX structure exactly: component names, props that are not prose, blank lines, heading levels, lists, tables.
  Translate prose props: `title="…"`, and `question` / `label` / `title` / `text` values inside `<Quiz>`.
- Never change code blocks or inline code, except comments inside code blocks. Placeholders like `__DOMAIN__`,
  `__ROOT__`, `__SECRET__`, `__DATA(traefik)__` stay exactly as they are.
- Internal links: `/de/nachschlagen/<de-slug>/` → `/en/wiki/<en-slug>/`, `/de/einrichten/…` → `/en/setup/…`,
  `/de/dienste/…` → `/en/services/…`, `/de/impressum/` → `/en/legal-notice/`, `/de/datenschutz/` → `/en/privacy/`.
  The English slug is the folder name without its number (or the `slug:` in the English file, if set).
- Keep product names and established terms. German legal terms (DSGVO → GDPR, Impressum, TDDDG, MStV) may stay,
  with a short explanation where helpful. Placeholder `<mark>` values in legal pages are translated too.
- Files with `translation: manual` in their frontmatter are maintained by hand: don't touch them unless asked.

## Conventions

- Compose templates (`content/services/<id>/compose.yaml`) are written without proxy config; the site adds
  Traefik labels, networks and ports (see `src/lib/compose.ts` and CONTRIBUTING.md).
- Comments inside compose.yaml / .env.example are English (both languages show the same file).
- Don't add inline scripts: the CSP in `public/.htaccess` only allows scripts from 'self' and the Umami host.
