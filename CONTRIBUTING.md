# Mitmachen bei yourhomelab

Schön, dass du helfen willst! Du brauchst keine Web-Kenntnisse: Alle Inhalte sind einzelne Markdown- und YAML-Dateien.
Kleine Korrekturen gehen direkt im Browser über den Link »Diese Seite auf GitHub bearbeiten« unter jeder Seite.

> **Englisch?** Schreib auf Deutsch. Die englische Fassung entsteht automatisch (siehe [Übersetzungen](#übersetzungen)).
> English speakers are welcome to improve the `en.mdx` / `en.md` files or open an issue.

## Inhaltsverzeichnis

1. [Lokal starten](#lokal-starten)
2. [Wo liegt was?](#wo-liegt-was)
3. [Einen Dienst hinzufügen](#einen-dienst-hinzufügen)
4. [Artikel und Guides schreiben](#artikel-und-guides-schreiben)
5. [Platzhalter](#platzhalter)
6. [Bausteine für MDX](#bausteine-für-mdx)
7. [Übersetzungen](#übersetzungen)
8. [Stil](#stil)

## Lokal starten

Voraussetzung: Node.js 22 oder neuer.

```bash
npm install
npm run dev        # http://localhost:4321, Änderungen erscheinen sofort
npm run build      # prüft alle Inhalte und baut die Seite
```

Fehler in Frontmatter, `service.yaml` oder `compose.yaml` bricht den Build mit einer Meldung ab, die Datei und Feld nennt.

## Wo liegt was?

```
content/
├── wiki/<NN-gruppe>/<NN-name>/            Nachschlagen: ein Ordner pro Artikel
│   ├── de.mdx                             deutscher Text (Original)
│   └── en.mdx                             englische Übersetzung
├── guides/<NN-etappe>/                    eine Etappe des Einrichtungswegs
│   ├── de.md / en.md                      Titel + Beschreibung der Etappe
│   └── <NN-name>/de.mdx, en.mdx           ein Ordner pro Guide
├── services/<id>/                         ein Ordner pro Dienst
│   ├── service.yaml                       Metadaten (Kategorie, Port, Links …)
│   ├── compose.yaml                       die Vorlage
│   ├── .env.example                       Variablen
│   ├── de.md / en.md                      Beschreibung + »Gut zu wissen«
│   └── logo.svg                           optional, sonst von selfh.st/icons
├── faq/<NN-frage>/de.md, en.md            Häufige Fragen auf der Startseite
└── pages/{imprint,privacy}/de.md, en.md   Rechtliches
src/i18n/de.json, en.json                  Texte der Oberfläche (Buttons, Überschriften …)
```

- **Ordnernamen sind englisch** und sprachneutral (`03-cloud-hybrid-local`). Sie sind die ID, über die sich Inhalte gegenseitig verlinken (`related`, `practice`, `services`).
- Die **Zahl vorne** bestimmt nur die Reihenfolge. Sie taucht nicht in der URL auf, du kannst also umsortieren, ohne Links zu brechen.
- Die **URL** ist der Ordnername ohne Zahl, z. B. `/en/wiki/cloud-hybrid-local/`. Für eine deutsche URL trägst du in `de.mdx` ein `slug:` ein (`slug: cloud-hybrid-lokal` → `/de/nachschlagen/cloud-hybrid-lokal/`). Nur Kleinbuchstaben, Ziffern und `-`, Umlaute ausschreiben.
- Neue Wiki-Gruppe? Ordner anlegen und den Titel in `src/i18n/de.json` als `wiki.group.<name ohne Zahl>` eintragen.

## Einen Dienst hinzufügen

```bash
npm run new service jellyfin
```

legt `content/services/jellyfin/` aus der Vorlage an. Dann:

### `service.yaml`

| Feld | Pflicht | Bedeutung |
| --- | --- | --- |
| `name` | ja | Anzeigename |
| `category` | ja | `proxy`, `management`, `data`, `code`, `auth` oder `monitoring` |
| `level` | | `1` Einsteiger, `2` Fortgeschritten, `3` Profi |
| `tag` | | Plakette: `recommended`, `popular` oder `new` |
| `popular` | | `true` zeigt den Dienst auf der Startseite |
| `port` | ja | Port der Weboberfläche **im** Container |
| `hostPort` | | Port auf dem Server, wenn kein Reverse Proxy genutzt wird (Standard: `port`) |
| `subdomain` | ja | z. B. `media` → `media.example.com` bzw. `example.com/media` |
| `subdomainOnly` | | `true`, wenn der Dienst nicht unter einem Pfad läuft |
| `main` | | Name des Web-Containers in `compose.yaml`, falls er nicht wie der Ordner heißt |
| `reverseProxy` | | `true` nur für Reverse Proxies selbst (Traefik, Caddy …): Vorlage wird unverändert gezeigt |
| `files` | | weitere Dateien im Ordner, die als Tab erscheinen, z. B. `[Caddyfile]` |
| `traefikLabels` | | zusätzliche Traefik-Labels, z. B. Middlewares |
| `icon` | | abweichender Name auf [selfh.st/icons](https://selfh.st/icons) |
| `links.repo` | ja | `owner/repo` auf GitHub oder volle URL (Codeberg …) |
| `links.website`, `links.docs` | ja | URLs |
| `upstream.label`, `upstream.url` | | wo die offizielle Compose-Datei liegt |
| `reviewed` | | Datum, an dem du die Vorlage getestet hast |

### `compose.yaml` – die wichtigste Regel

Schreib die **schlichte Variante ohne Reverse Proxy**. Die Website ergänzt je nach »Mein Setup« des Besuchers automatisch:

- **Traefik**: `labels` (Router, Zertifikat, Port) + Proxy-Netzwerk
- **Caddy / Nginx Proxy Manager**: Proxy-Netzwerk + passendes Snippet
- **Kein Proxy**: `ports: "<hostPort>:<port>"`
- **Zentraler Datenordner**: `./data/…` wird zu `<Datenordner>/<id>/…`

Also:

- ✅ Persistente Daten immer unter `./data/<name>` mounten
- ✅ `container_name` = Ordnername, Nebencontainer `<id>-<rolle>` (z. B. `nextcloud-db`)
- ✅ Konkrete Image-Version, wenn das Projekt sinnvolle Tags hat (Renovate hält sie aktuell)
- ✅ Geheimnisse als `${VARIABLE}` referenzieren und in `.env.example` definieren
- ❌ Keine Traefik-Labels, kein `networks: proxy`, keine Ports für die Weboberfläche
- ✅ Andere Ports (z. B. SSH `"2222:22"`) gehören hinein
- Kommentare in Vorlagen bitte auf Englisch, weil beide Sprachfassungen dieselbe Datei zeigen

### `.env.example`

Nutze [Platzhalter](#platzhalter). `__SECRET__` wird im Browser des Besuchers durch einen Zufallswert ersetzt.

### `de.md`

```md
---
description: "Ein bis zwei Sätze für die Karte."
notes:
  - "Hinweise für die Box »Gut zu wissen«."
---
Optional: weiterer Text in Markdown, erscheint unter den Schritten.
```

Teste die Vorlage selbst (`docker compose up -d`), bevor du den Pull Request öffnest.

## Artikel und Guides schreiben

```bash
npm run new wiki 03-containers podman
npm run new guide 06-operations log-rotation logs-rotieren   # dritter Wert: deutsche URL (optional)
```

Viele Themen sind schon als **Platzhalter** angelegt (`status: stub`). Die Seite zeigt dann »Dieser Text fehlt noch«.
Zum Schreiben: Text in `de.mdx` ergänzen und die Zeile `status: stub` löschen.

### Frontmatter Wiki

```yaml
---
title: Was ist Docker?
description: Einleitung, die groß unter dem Titel steht.
level: 1                        # 1 Einsteiger, 2 Fortgeschritten, 3 Profi
related: [images-tags, docker-compose]   # Ordnernamen anderer Artikel (ohne Zahl)
practice: installing-docker      # Ordnername eines Guides (»Praktisch umsetzen«)
---
```

### Frontmatter Guide

```yaml
---
title: Reverse Proxy mit Traefik
description: Was am Ende läuft.
level: 2
minutes: 25
requires: [Docker Compose, Domain]
services: [traefik]             # erscheint auf diesen Dienstseiten unter »Passende Guides«
---
```

Überschriften im Text beginnen mit `##` (der Titel ist die `#`-Überschrift). `##`-Überschriften erscheinen in »Auf dieser Seite«.

## Platzhalter

In Codeblöcken, Inline-Code, `compose.yaml` und `.env.example` werden diese Werte durch das »Mein Setup« des Besuchers ersetzt:

| Platzhalter | Beispiel |
| --- | --- |
| `__DOMAIN__` | `example.com` |
| `__EMAIL__` | `admin@example.com` |
| `__NETWORK__` | `proxy` |
| `__ROOT__` | `/opt/stacks` |
| `__DATA_ROOT__` | `/srv/appdata` |
| `__TZ__`, `__PUID__`, `__PGID__` | `Europe/Berlin`, `1000`, `1000` |
| `__SECRET__` | Zufallswert (nur `.env.example`) |
| `__HOST__`, `__URL__` | Host bzw. volle URL des Dienstes (nur in Dienst-Vorlagen) |

Im Fließtext Platzhalter immer in Backticks setzen: `` `__ROOT__/traefik` ``. Ohne Backticks macht Markdown daraus Fettdruck.

## Bausteine für MDX

Diese Komponenten funktionieren in jeder `.mdx`-Datei ohne Import:

~~~mdx
<Steps>
<Step title="Netzwerk anlegen">
Text in Markdown. Leerzeilen um Codeblöcke nicht vergessen.

```bash
docker network create __NETWORK__
```
</Step>
</Steps>
~~~

| Baustein | Wofür |
| --- | --- |
| `<Steps>` + `<Step title="…">` | nummerierte, abhakbare Schritte mit Fortschrittsbalken (Guides) |
| `<ServiceFiles id="traefik" />` | compose.yaml / .env / Verzeichnis eines Dienstes, an das Setup angepasst |
| `<Callout title="…">…</Callout>` | Infobox, mit `type="warning"` als Warnung |
| `<OneWay />` | Box »Ein Weg von vielen« |
| `<Cards>` + `<Card title="…">…</Card>` | Karten nebeneinander |
| `<Quiz questions={…} results={…} />` | Entscheidungshilfe, Beispiel in `wiki/01-basics/03-cloud-hybrid-local/de.mdx` |

Tabellen, Listen, Links und Bilder schreibst du ganz normal in Markdown.

## Übersetzungen

- Du schreibst und änderst nur die **deutsche** Datei (`de.mdx`, `de.md`, `src/i18n/de.json`).
- Nach dem Merge übersetzt eine GitHub Action alle neuen und geänderten Texte mit **DeepL** und öffnet einen Pull Request.
  Code, Platzhalter, Links und MDX-Komponenten werden dabei nicht angefasst, interne Links zeigen auf die englischen URLs.
- Solange eine Übersetzung fehlt, zeigt die englische Seite den deutschen Text mit Hinweis.
- Maintainer polieren DeepL-Übersetzungen bei Gelegenheit lokal mit Claude Code nach (siehe `CLAUDE.md`).
- Englische Texte darfst du gern von Hand verbessern. Danach `npm run translate stamp <datei> --by human`,
  sonst gilt die Datei weiter als maschinell übersetzt. Überschrieben wird sie erst, wenn sich das deutsche Original ändert.
  Soll eine englische Datei nie automatisch überschrieben werden, trag `translation: manual` in ihr Frontmatter ein.
- `npm run translate status` zeigt, was fehlt, veraltet oder maschinell übersetzt ist.
- `.translations.lock.json` merkt sich, welcher Stand von wem übersetzt wurde. Nicht von Hand bearbeiten.

## Stil

- Duzen, kurze Sätze, aktive Formulierungen.
- Erst erklären **warum**, dann **wie**.
- Befehle so, dass man sie kopieren kann. Kein `sudo`, wenn es nicht nötig ist.
- Keine echten Domains, IPs oder Passwörter. Nutze die Platzhalter.
- Verlinke die offizielle Doku, statt sie abzuschreiben.

Mit deinem Beitrag stimmst du zu, dass Texte unter [CC BY-SA 4.0](LICENSE-CONTENT.md) und Code/Vorlagen unter [MIT](LICENSE) veröffentlicht werden.
