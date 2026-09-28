# yourhomelab

**Dein eigener Server. Schritt für Schritt.** – Das Selfhosting-Handbuch unter [yourhomelab.guide](https://yourhomelab.guide).

- **Nachschlagen**: Grundlagen wie ein Wiki
- **Einrichten**: sieben Etappen vom leeren Rechner zum laufenden Homelab, jeder Schritt abhakbar
- **Dienste**: geprüfte `compose.yaml` und `.env`, die sich an Domain, Pfade und Reverse Proxy des Besuchers anpassen

Deutsch ist die Ausgangssprache. Englisch wird bei jeder Änderung automatisch mit DeepL übersetzt und von Maintainern lokal mit Claude Code nachpoliert.

## Mitmachen

Alles Inhaltliche liegt als einzelne Datei in [`content/`](content). Wie du Artikel schreibst, Guides ergänzt
oder einen Dienst hinzufügst, steht in [CONTRIBUTING.md](CONTRIBUTING.md). Kurzfassung:

```bash
npm install
npm run dev                       # http://localhost:4321
npm run new service jellyfin      # neuen Dienst anlegen
```

## Technik

- [Astro](https://astro.build) erzeugt eine rein statische Seite (kein Node auf dem Server nötig).
- Kein Tracking, keine Cookies, keine externen Requests: Schriften und Logos werden mit ausgeliefert.
- Alle Dateien werden beim Build mit Brotli und Gzip vorkomprimiert; `public/.htaccess` liefert sie aus.
- GitHub Actions: `ci.yml` baut jeden PR, `deploy.yml` lädt `main` per SFTP auf das Hetzner-Webhosting,
  `translate.yml` übersetzt geänderte Inhalte mit DeepL und öffnet einen PR.

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Entwicklungsserver |
| `npm run build` | Seite nach `dist/` bauen und vorkomprimieren |
| `npm run new …` | Dienst, Artikel oder Guide anlegen |
| `npm run translate status` | Zeigt fehlende, veraltete und maschinell übersetzte Dateien |
| `npm run translate deepl` | Übersetzt fehlende/veraltete Dateien mit DeepL (braucht `DEEPL_API_KEY`) |
| `npm run translate stamp <dateien> --by claude` | Markiert selbst übersetzte Dateien als aktuell |

### Einrichtung für Maintainer

Repository-Secrets (Settings → Secrets and variables → Actions):

| Name | Art | Inhalt |
| --- | --- | --- |
| `DEPLOY_HOST` | Secret | z. B. `wwwXXX.your-server.de` (konsoleH → Zugangsdaten) |
| `DEPLOY_USER` | Secret | FTP/SSH-Benutzer |
| `DEPLOY_PASSWORD` | Secret | Passwort des Benutzers |
| `DEEPL_API_KEY` | Secret | DeepL API Free (endet auf `:fx`), für die automatische Übersetzung |
| `DEPLOY_PATH` | Variable | Zielordner, Standard `public_html` |
| `DEPLOY_PROTOCOL` | Variable | `sftp` (Standard) oder `ftp` (FTPS) |

Außerdem: Environment `production` anlegen (optional mit Schutzregeln), die [Renovate-App](https://github.com/apps/renovate)
installieren (hält Image-Versionen in den Vorlagen aktuell) und Discussions aktivieren.

## Lizenz

Texte: [CC BY-SA 4.0](LICENSE-CONTENT.md) · Code und Vorlagen: [MIT](LICENSE)
