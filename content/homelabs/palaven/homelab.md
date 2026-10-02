---
name: Palaven
author: Elias
lang: de
added: 2026-10-02
summary: Ein Hetzner-Root-Server mit über 60 Docker-Diensten für Familie und Freunde, ein Netcup-VPS als Headscale-Koordinator. Jeder Login läuft über einen eigenen „Palaven Account“ in Authentik, und fast alles ist nur noch im Tailnet erreichbar.
location: cloud
platform: [bare-metal]
management: [compose, dockhand]
proxy: [traefik]
access: [vpn]
servers: 2
hardware: "Hetzner-Root-Server: Intel Core i7-8700, 64 GB DDR4 (4× 16 GB), 2× 1 TB NVMe im RAID, 2× 8 TB Enterprise-HDD im RAID, 1 Gbit/s. Dazu ein Netcup VPS pico (1 vCore, 1 GB RAM, 30 GB SSD)."
domain: Eine eigene Domain für alles. Jeder Dienst bekommt eine thematisch passende Subdomain, etwa unter einem eigenen Zweig für den Medien-Stack oder für Admin-Werkzeuge.
auth: Authentik als zentraler Identity Provider. Dienste mit OIDC melden sich direkt an, alle anderen sitzen hinter einer Authentik-Middleware in Traefik.
backup: borgmatic für alle Daten unter einem einzigen Datenordner. Was nicht gesichert werden muss (Logs, Caches), liegt bewusst in einem getrennten Arbeitsordner.
monitoring: Uptime Kuma für die Erreichbarkeit, Dozzle für Logs. Beszel ist geplant.
services: [Traefik, Authentik, Vaultwarden, Immich, Jellyfin, Nextcloud, Paperless-ngx, Uptime Kuma, Dockhand, AdGuard Home, Unbound, WG-Easy, Headscale, Headplane, Tailscale, Gluetun, Audiobookshelf, Navidrome, Feishin, Seerr, Wizarr, MediaManager, BookOrbit, Shelfmark, ReadmeABook, Sonarr, Radarr, Bazarr, Prowlarr, Maintainerr, Tautulli, Tdarr, SABnzbd, Recyclarr, Seafile, Paperless-GPT, Outline, Overleaf, Anchor, n8n, Tududi, Norish, Open WebUI, Ollama, SearXNG, Synapse, Synapse Admin, Mautrix WhatsApp, Dozzle, Filebrowser, Gocron, borgmatic, BentoPDF, Vert, IT-Tools, Omni-Tools, Web-Check]
---

### Zwei Server, keiner davon zuhause

Palaven läuft komplett im Rechenzentrum. Das Arbeitstier ist ein gemieteter Root-Server bei Hetzner: ein Core i7-8700
mit 64 GB RAM, zwei gespiegelten NVMe-SSDs für System und Datenbanken und zwei gespiegelten 8-TB-Platten für Medien,
Fotos und Dokumente. Darauf läuft ein normales Linux mit Docker Compose, ohne Hypervisor dazwischen.

Der zweite Server ist ein winziger VPS bei Netcup mit einem vCore und 1 GB RAM. Er hat genau eine Aufgabe: Er
betreibt **Headscale** mit **Headplane** als Oberfläche, also den eigenen Koordinationsserver für das Tailnet. So
hängt das private Netz nicht an einem fremden Anbieter, und der große Server bleibt frei für die Dienste.

### Vom offenen Server zum Tailnet

Am Anfang war jeder Dienst über den Reverse Proxy aus dem Internet erreichbar. Inzwischen ist das umgedreht: Nur noch
eine Handvoll Dienste, die wirklich öffentlich sein müssen, hängen direkt am Netz. Alles andere ist nur im Tailnet
erreichbar. Wer von außen auf einen internen Dienst zugreift, soll statt eines Timeouts eine verständliche
Fehlerseite sehen. Dafür hängt an jedem Router die Middleware `custom-errors`.

Eine Besonderheit sind die **Exit Nodes**: Auf dem Hetzner-Server laufen fünf Pärchen aus einem Tailscale-Container
und einem Gluetun-Container. Gluetun baut die Verbindung zu AirVPN auf, Tailscale bietet sie im Tailnet als Exit Node
an. Jedes Gerät im Tailnet kann so per Klick über einen von fünf VPN-Standorten ins Internet gehen, ohne dass auf dem
Handy eine eigene VPN-App laufen muss. Vorher lief Gluetun mit CyberGhost.

### Ein Login für alles: der Palaven Account

Jeder, der Palaven nutzt, hat genau ein Konto in **Authentik**, den „Palaven Account“. Es gilt eine feste Regel:

- Dienste, die selbst OIDC können (Immich, Nextcloud, Outline, Open WebUI und viele andere), melden sich direkt bei
  Authentik an.
- Nur Dienste **ohne** eigenes SSO bekommen die Forward-Auth-Middleware `authentik@file` in Traefik. So gibt es keine
  doppelten Logins.

Ein offenes Problem sind Gäste: Eine Kommilitonin nutzt Overleaf mit, vielleicht kommen weitere dazu. Für solche
befristeten Zugänge soll eigentlich kein vollwertiger Palaven Account entstehen. Eine gute Lösung dafür steht noch aus.

### Wer Palaven nutzt

Palaven ist kein Ein-Personen-Labor. Im Alltag nutzen es zwei Personen intensiv, von Laptops, Handys und zuhause aus.
Dazu kommt die Familie: Eltern und Geschwister nutzen vor allem Immich und Jellyfin, der Großvater Nextcloud. Für
Medienanfragen gibt es Seerr, neue Leute lädt Wizarr in Jellyfin ein. Ein öffentlicher DNS-Filter für alle
Interessierten ist angedacht.

Das prägt die Auswahl: Dienste müssen ohne Erklärung funktionieren, Apps für Handy und Fernseher haben, und ein Ausfall
fällt sofort auf.

### Eine Compose-Datei, ein Muster

Alle Stacks folgen demselben Aufbau. So sieht ein typischer Dienst aus, hier die Notiz-App Anchor:

```yaml
services:
  anchor:
    image: ghcr.io/zhfahim/anchor:latest
    container_name: anchor
    restart: unless-stopped
    networks:
      - proxy-net
      - backup-net
    volumes:
      - /srv/palaven/data/anchor:/data
    labels:
      - traefik.enable=true
      - traefik.docker.network=proxy-net
      - traefik.http.routers.anchor.rule=Host(`notes.example.net`)
      - traefik.http.routers.anchor.entrypoints=websecure
      - traefik.http.routers.anchor.tls=true
      - traefik.http.routers.anchor.tls.certresolver=le
      - traefik.http.services.anchor-svc.loadbalancer.server.port=3000
      - traefik.http.routers.anchor.service=anchor-svc
      - traefik.http.routers.anchor.middlewares=authentik@file,custom-errors@docker
    env_file: .env

networks:
  proxy-net:
    external: true
  backup-net:
    external: true
```

Die Regeln dahinter:

- **Eine thematische Subdomain pro Dienst.** Medien-Automatisierung liegt unter einem eigenen Zweig, Admin-Werkzeuge
  unter einem anderen, Werkzeuge für alle unter einem dritten. Schon die Adresse verrät, wofür ein Dienst da ist.
- **Daten nach `/srv/palaven/data/<dienst>`.** Alles, was dort liegt, sichert borgmatic. Logs, Caches und anderes,
  das kein Backup braucht, kommen in einen getrennten Arbeitsordner.
- **`traefik.docker.network=proxy-net`**, sobald ein Container in mehr als einem Netzwerk hängt. Sonst rät Traefik
  womöglich das falsche Netz und antwortet mit einem Timeout.
- **`authentik@file` nur ohne natives SSO**, siehe oben.

Verwaltet werden die Stacks mit Dockhand, die Logs liest Dozzle mit, und wiederkehrende Aufgaben laufen über Gocron.

### Was alles läuft

Rund 60 Container, grob sortiert:

- **Medien und Streaming:** Jellyfin für Filme und Serien, Navidrome mit dem Web-Client Feishin für Musik,
  Audiobookshelf für Hörbücher und Podcasts. Dazu Seerr für Anfragen, Wizarr für Einladungen und MediaManager.
- **Bücher:** BookOrbit als E-Book-Bibliothek mit Shelfmark für den Import, ReadmeABook als Hörbuch-Portal mit
  getrennten Bereichen für Erwachsene, Teens und Kinder.
- **Medien-Automatisierung:** Sonarr, Radarr, Bazarr und Prowlarr, Recyclarr für die Profile, Maintainerr zum
  Aufräumen, Tautulli für Statistiken, Tdarr für die Transkodierung. SABnzbd läuft hinter Gluetun.
- **Dokumente und Wissen:** Nextcloud (AIO) und Seafile für Dateien, Paperless-ngx mit Paperless-GPT, Outline als
  Wiki, Overleaf für LaTeX, Anchor für Notizen, dazu eine eigene Dokumentation.
- **Produktivität:** n8n für Automatisierungen, Tududi für Aufgaben, Norish für Rezepte und Essensplanung.
- **KI und Suche:** Open WebUI mit Ollama als lokalem Backend, SearXNG als Suchmaschine ohne Tracking.
- **Kommunikation und Fotos:** Immich, ein Matrix-Server mit Synapse und Synapse Admin, Mautrix als Brücke zu
  WhatsApp.
- **Sicherheit und Netz:** Vaultwarden, Authentik, AdGuard Home mit Unbound, WG-Easy, Traefik, Headscale.
- **Werkzeuge:** BentoPDF, Vert, IT-Tools, Omni-Tools, Web-Check, Filebrowser und zwei kleine selbst gebaute
  Einzweck-Apps.

### Was als Nächstes kommt

Die Liste wird nicht kürzer. Ganz oben stehen:

- **Absichern:** CrowdSec, eine Traefik-Middleware für Sicherheits-Header, Beszel fürs Monitoring und irgendwann ein
  KI-gestützter Angriffstest gegen das eigene Setup.
- **Ordnung:** Ansible für die Server-Konfiguration, Forgejo für die Compose-Dateien und ein zentrales Dashboard mit
  Homarr, das neue Nutzer fast wie ein Captive Portal durch die Dienste führt. Dazu eine eigene Seite für alle
  Medienanfragen mit Erklärung.
- **Experimente:** Dokploy oder Coolify als Spielwiese für Web-Apps, bei denen die Docker-Isolation auch für fremde
  Projekte reicht.
- **Neue Dienste:** Declutarr und Unpackerr für den Medien-Stack, Jellystat oder Tracearr, ein lokales GPT-OSS-20B
  für Paperless, Homebox für das Inventar, ConvertX, Papra und eine selbst gehostete Browser-Synchronisierung.
