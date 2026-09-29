# Contributing to yourhomelab

Great that you want to help! You don't need any web development skills: all content consists of individual
Markdown and YAML files. Small fixes can be made right in the browser via the "Edit this page on GitHub" link at
the bottom of every page.

> **Which language?** German is the source language of the site, so articles, guides and service descriptions are
> written in German (`de.mdx`, `de.md`). The English version is generated automatically (see [Translations](#translations)).
> Don't speak German? Improvements to the English files are just as welcome, and you can always open an issue or
> pull request in English – a maintainer will take care of the German side.

## Contents

1. [Running it locally](#running-it-locally)
2. [Where things live](#where-things-live)
3. [Adding a service](#adding-a-service)
4. [Writing articles and guides](#writing-articles-and-guides)
5. [Adding a homelab to the showcase](#adding-a-homelab-to-the-showcase)
6. [Placeholders](#placeholders)
7. [MDX building blocks](#mdx-building-blocks)
8. [Translations](#translations)
9. [Style](#style)

## Running it locally

Requirement: Node.js 22 or newer.

```bash
npm install
npm run dev        # http://localhost:4321, changes show up instantly
npm run build      # validates all content and builds the site
```

Mistakes in frontmatter, `service.yaml` or `compose.yaml` stop the build with a message naming the file and field.

## Where things live

```
content/
├── wiki/<NN-group>/<NN-name>/             "Learn": one folder per article
│   ├── de.mdx                             German text (original)
│   └── en.mdx                             English translation
├── guides/<NN-stage>/                     one stage of the setup path
│   ├── de.md / en.md                      title + description of the stage
│   └── <NN-name>/de.mdx, en.mdx           one folder per guide
├── services/<id>/                         one folder per service
│   ├── service.yaml                       metadata (category, port, links …)
│   ├── compose.yaml                       the template
│   ├── .env.example                       variables
│   ├── de.md / en.md                      description + "good to know" notes
│   └── logo.svg                           optional, otherwise taken from selfh.st/icons
├── faq/<NN-question>/de.md, en.md         FAQ on the start page
└── pages/{imprint,privacy}/de.md, en.md   legal pages
src/i18n/de.json, en.json                  interface texts (buttons, headings …)
```

- **Folder names are English** and language-neutral (`03-cloud-hybrid-local`). They are the ID that content uses
  to reference other content (`related`, `practice`, `services`).
- The **number prefix** only sets the order. It never appears in URLs, so you can reorder without breaking links.
- The **URL** is the folder name without the number, e.g. `/en/wiki/cloud-hybrid-local/`. For a German URL, add
  `slug:` to `de.mdx` (`slug: cloud-hybrid-lokal` → `/de/nachschlagen/cloud-hybrid-lokal/`). Lowercase letters,
  digits and `-` only; write umlauts as `ae`, `oe`, `ue`, `ss`.
- New wiki group? Create the folder and add its title to `src/i18n/de.json` as `wiki.group.<name without number>`.

## Adding a service

```bash
npm run new service jellyfin
```

creates `content/services/jellyfin/` from the template. Then:

### `service.yaml`

| Field | Required | Meaning |
| --- | --- | --- |
| `name` | yes | Display name |
| `category` | yes | `proxy`, `management`, `network`, `data`, `media`, `code`, `auth` or `monitoring` |
| `level` | | `1` beginner, `2` advanced, `3` pro |
| `tag` | | Badge: `recommended`, `popular` or `new` |
| `popular` | | `true` shows the service on the start page |
| `port` | yes | Port of the web UI **inside** the container |
| `hostPort` | | Port on the server when no reverse proxy is used (default: `port`) |
| `subdomain` | yes | e.g. `media` → `media.example.com` or `example.com/media` |
| `subdomainOnly` | | `true` if the service can't run under a path |
| `main` | | Name of the web container in `compose.yaml` if it differs from the folder name |
| `reverseProxy` | | `true` only for reverse proxies themselves (Traefik, Caddy …): the template is shown unchanged |
| `files` | | Additional files in the folder shown as tabs, e.g. `[Caddyfile]` |
| `traefikLabels` | | Extra Traefik labels, e.g. middlewares |
| `icon` | | Different name on [selfh.st/icons](https://selfh.st/icons) |
| `links.repo` | yes | `owner/repo` on GitHub or a full URL (Codeberg …) |
| `links.website`, `links.docs` | yes | URLs |
| `upstream.label`, `upstream.url` | | Where the official Compose file lives |
| `reviewed` | | Date you last tested the template |
| `gpu` | | Does a GPU help (transcoding, machine learning)? `no` (default), `optional` or `recommended`. Shown on the service page |
| `db` | | Database for backup dumps: `type` (`postgres`, `mariadb`, `mysql`, `sqlite`), `service` (DB container in `compose.yaml`), `user`, `name` (literal or `${VAR}` from `.env`); for SQLite only `path` below the stack folder, e.g. `data/data/db.sqlite3` |
| `pairsWith` | | Ids of services that go well with this one, shown as "Passt gut zu" |

### `compose.yaml` – the most important rule

Write the **plain version without a reverse proxy**. Depending on the visitor's "My setup", the website adds:

- **Traefik**: `labels` (router, certificate, port) + proxy network
- **Caddy / Nginx Proxy Manager**: proxy network + a matching snippet
- **No proxy**: `ports: "<hostPort>:<port>"`
- **Central data folder**: `./data/…` becomes `<data folder>/<id>/…`

So:

- ✅ Always mount persistent data under `./data/<name>`
- ✅ `container_name` = folder name, helper containers `<id>-<role>` (e.g. `nextcloud-db`)
- ✅ A specific image version if the project has meaningful tags (Renovate keeps it up to date)
- ✅ Reference secrets as `${VARIABLE}` and define them in `.env.example`
- ❌ No Traefik labels, no `networks: proxy`, no ports for the web UI
- ✅ Other ports (e.g. SSH `"2222:22"`) do belong in there
- Comments in templates in English, since both language versions show the same file

### `.env.example`

Use [placeholders](#placeholders). `__SECRET__` is replaced with a random value in the visitor's browser.

### `de.md`

```md
---
description: "Ein bis zwei Sätze für die Karte."
notes:
  - "Hinweise für die Box »Gut zu wissen«."
---
Optional: more Markdown text, shown below the steps.
```

Test the template yourself (`docker compose up -d`) before opening the pull request.

## Writing articles and guides

```bash
npm run new wiki 03-containers podman
npm run new guide 06-operations log-rotation logs-rotieren   # third value: German URL (optional)
```

Many topics already exist as **stubs** (`status: stub`). The site then shows "This text is still missing".
To write one: add the text to `de.mdx` and delete the `status: stub` line.

### Wiki frontmatter

```yaml
---
title: Was ist Docker?
description: Introduction shown large below the title.
level: 1                        # 1 beginner, 2 advanced, 3 pro
related: [images-tags, docker-compose]   # folder names of other articles (without number)
practice: installing-docker      # folder name of a guide ("Put it into practice")
---
```

### Guide frontmatter

```yaml
---
title: Reverse Proxy mit Traefik
description: What runs at the end.
level: 2
minutes: 25
requires: [Docker Compose, Domain]
services: [traefik]             # listed on these service pages under "Related guides"
---
```

Headings in the text start with `##` (the title is the `#` heading). `##` headings appear in "On this page".

## Adding a homelab to the showcase

People submit their setup with the "Homelab vorstellen" issue form. A maintainer turns it into
`content/homelabs/<id>/homelab.md` (folder name = URL, e.g. `alex-keller-rack`):

```md
---
name: Keller-Rack
author: Alex
github: alex            # optional, links the profile (only with consent in the issue)
lang: de                # language the texts are written in (entries are not translated)
added: 2026-10-01
summary: One or two sentences for the card.
location: local         # local | hybrid | cloud
platform: [proxmox]     # values: see homelabFacets in src/config/site.ts
management: [compose, portainer]
proxy: [traefik]
access: [vpn]
servers: 2
hardware: 2× Lenovo M720q, 1× Synology DS920+
watts: 25               # optional
domain: …               # optional free text: domain, auth, backup, monitoring
services: [vaultwarden, immich, Home Assistant]   # ids from content/services get linked
---
Optional Markdown: setup and details.
```

Filter values are fixed lists (`homelabFacets` in `src/config/site.ts`). A new value also needs a label
(`homelabs.<field>.<value>` in `src/i18n/*.json`) and an option in `.github/ISSUE_TEMPLATE/homelab.yml`.
Remove real domains, IPs and anything secret before merging.

## Placeholders

In code blocks, inline code, `compose.yaml` and `.env.example`, these values are replaced with the visitor's "My setup":

| Placeholder | Example |
| --- | --- |
| `__DOMAIN__` | `example.com` |
| `__EMAIL__` | `admin@example.com` |
| `__NETWORK__` | `proxy` |
| `__ROOT__` | `/srv/homelab` |
| `__DATA_ROOT__` | `/srv/homelab/data` |
| `__DATA(<id>)__` | Data folder of one service: `/srv/homelab/<id>/data`, or `<data folder>/<id>` in central mode |
| `__TZ__`, `__PUID__`, `__PGID__` | `Europe/Berlin`, `1000`, `1000` |
| `__SECRET__` | Random value (`.env.example` only); `__SECRET(32)__` for exactly 32 characters |
| `__HOST__`, `__URL__` | Host or full URL of the service (service templates only) |

In running text, always put placeholders in backticks: `` `__ROOT__/traefik` ``. Without backticks, Markdown
turns them into bold text.

## MDX building blocks

These components work in every `.mdx` file without importing them:

~~~mdx
<Steps>
<Step title="Netzwerk anlegen">
Text in Markdown. Don't forget the blank lines around code blocks.

```bash
docker network create __NETWORK__
```
</Step>
</Steps>
~~~

| Block | Purpose |
| --- | --- |
| `<Steps>` + `<Step title="…">` | Numbered steps that can be ticked off, with a progress bar (guides) |
| `<ServiceFiles id="traefik" />` | compose.yaml / .env / directory tree of a service, adapted to the setup |
| `<Callout title="…">…</Callout>` | Info box, with `type="warning"` as a warning |
| `<OneWay />` | The "One way among many" box |
| `<Cards>` + `<Card title="…">…</Card>` | Cards side by side |
| `<Quiz questions={…} results={…} />` | Decision helper, see `wiki/01-basics/03-cloud-hybrid-local/de.mdx` |

Tables, lists, links and images are plain Markdown.

## Translations

- Only write and change the **German** file (`de.mdx`, `de.md`, `src/i18n/de.json`).
- After merging, a GitHub Action translates all new and changed texts with **DeepL** and opens a pull request.
  Code, placeholders, links and MDX components are left untouched; internal links point to the English URLs.
- As long as a translation is missing, the English page shows the German text with a notice.
- Maintainers polish DeepL translations locally with Claude Code from time to time (see `CLAUDE.md`).
- You're welcome to improve English texts by hand. Afterwards run `npm run translate stamp <file> --by human`,
  otherwise the file still counts as machine-translated. It is only overwritten again when the German original changes.
  To never overwrite an English file automatically, add `translation: manual` to its frontmatter.
- `npm run translate status` shows what is missing, outdated or machine-translated.
- `.translations.lock.json` records which version was translated by whom. Don't edit it by hand.

## Style

- German texts address the reader informally ("du"); English texts use "you". Short sentences, active voice.
- Explain **why** first, then **how**.
- Commands should be copy-pasteable. No `sudo` unless it's needed.
- No real domains, IPs or passwords. Use the placeholders.
- Link to the official documentation instead of copying it.

By contributing, you agree that texts are published under [CC BY-SA 4.0](LICENSE-CONTENT.md) and code/templates
under [MIT](LICENSE).
