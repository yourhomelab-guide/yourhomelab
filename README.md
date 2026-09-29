# yourhomelab

**Your own server. Step by step.** – The self-hosting handbook at [yourhomelab.guide](https://yourhomelab.guide).

- **Learn**: the fundamentals, organized like a wiki
- **Set up**: seven stages from an empty machine to a running homelab, every step can be ticked off
- **Services**: tested `compose.yaml` and `.env` files that adapt to the visitor's domain, paths and reverse proxy

German is the source language. English is machine-translated with DeepL on every change and polished by maintainers
with Claude Code.

## Contributing

All content lives as individual files in [`content/`](content). How to write articles, add guides or contribute a
service is described in [CONTRIBUTING.md](CONTRIBUTING.md).
In short:

```bash
npm install
npm run dev                       # http://localhost:4321
npm run new service jellyfin      # scaffold a new service
```

## How it works

- [Astro](https://astro.build) builds a fully static site – no Node.js needed on the server.
- No cookies and no third-party requests: fonts and logos are served from the site itself. Cookieless, self-hosted
  [Umami](https://umami.is) counts page views.
- Every file is precompressed with Brotli and gzip at build time; [`public/.htaccess`](public/.htaccess) serves them
  and sets caching and security headers.
- Branches: development happens on `dev`, `main` is what's live.
- GitHub Actions: `ci.yml` builds every pull request, `deploy.yml` uploads `main` to Hetzner web hosting via SFTP,
  `preview.yml` uploads `dev` to preview.yourhomelab.guide (no stats, not indexed, with a "preview" bar),
  `translate.yml` translates changed content with DeepL and opens a pull request.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Build the site into `dist/` and precompress it |
| `npm run new …` | Scaffold a service, wiki article or guide |
| `npm run translate status` | List missing, outdated and machine-translated files |
| `npm run translate deepl` | Translate missing/outdated files with DeepL (needs `DEEPL_API_KEY`) |
| `npm run translate stamp <files> --by claude` | Mark files you translated yourself as up to date |

### Maintainer setup

Secrets (Settings → Secrets and variables → Actions):

| Name | Where | Content |
| --- | --- | --- |
| `DEPLOY_HOST` | Environment `production` | Address of the host/webspace|
| `DEPLOY_USER` | Environment `production` | SFTP/FTP user |
| `DEPLOY_PASSWORD` | Environment `production` | Password of that user |
| `DEPLOY_PATH` | Environment `production` (variable or secret, required) | Target folder: `/` when the account's root is the site folder, otherwise e.g. `public_html`. Everything else in it is deleted on upload |
| `DEPLOY_PROTOCOL` | Environment `production` (optional) | `sftp` (default) or `ftp` (FTPS) |
| `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PASSWORD` | Environment `preview` | Same host, but the account of the preview subdomain |
| `DEPLOY_PATH` | Environment `preview` (required) | Target folder, like production (`/` for an account that only sees the preview folder) |
| `DEPLOY_PROTOCOL` | Environment `preview` (optional) | Like production |
| `DEEPL_API_KEY` | Repository | DeepL API key for automatic translations |

Also: restrict the `production` environment to the `main` branch and the `preview` environment to `dev`, allow GitHub Actions to create pull requests
(organization and repository settings), install the [Renovate app](https://github.com/apps/renovate) to keep image
versions in the templates up to date, and enable Discussions.

## License

Texts: [CC BY-SA 4.0](LICENSE-CONTENT.md) · Code and templates: [MIT](LICENSE)
