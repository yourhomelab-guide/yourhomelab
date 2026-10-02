---
name: Palaven
author: xNycrofox
lang: de
added: 2026-10-02
summary: Ein Powerhouse (Hetzner Dedicated, 64GB RAM) für über 60 Docker Container für Freunde und Familie mit viieel Platz zum experimentieren. Anmeldung mit SSO und Netzsegmentierung durch ein (selfhosted) Tailscale :)
location: cloud
platform: [bare-metal]
management: [compose, dockhand]
proxy: [traefik]
access: [vpn]
servers: 2
hardware: "Hetzner-Root-Server: Intel Core i7-8700, 64 GB DDR4 (4× 16 GB), 2× 1 TB NVMe im RAID, 2× 8 TB Enterprise-HDD im RAID, 1 Gbit/s. Dazu ein Netcup VPS pico (1 vCore, 1 GB RAM, 30 GB SSD)."
domain: "Eine eigene Subdomain für alles. Jeder Dienst bekommt eine thematisch passende Subdomain, etwa unter einem eigenen Zweig für den Medien-Stack oder für Admin-Werkzeuge. Beispiel: dockhand.infra.domain.example. So gut wie alles ist aber nur im Tailnet auflösbar."
auth: Authentik als zentraler Identity Provider. Dienste mit OIDC melden sich direkt an, alle anderen sitzen hinter einer Authentik-Middleware in Traefik. Früher hatte ich mal Pocket-ID + Tinyauth.
backup: borgmatic sichert einen einzigen Datenordner, in welchem alle Compose Files und alle Daten liegen. Was nicht gesichert werden muss (Logs, Caches), liegt bewusst in einem getrennten Arbeitsordner.
monitoring: Gatus für die Erreichbarkeit, Dozzle für Logs. Beszel ist geplant.
services: [Traefik, Authentik, Vaultwarden, Immich, Jellyfin, Nextcloud, Paperless-ngx, Gatus, Dockhand, AdGuard Home, Unbound, Headscale, Headplane, Tailscale, Gluetun, Audiobookshelf, Navidrome, Feishin, Seerr, Wizarr, BookOrbit, Shelfmark, ReadmeABook, Sonarr, Radarr, Bazarr, Prowlarr, Maintainerr, Tdarr, SABnzbd, Recyclarr, Paperless-GPT, Outline, Overleaf, Anchor, n8n, Tududi, Norish, Open WebUI, Ollama, SearXNG, Dozzle, Filebrowser, Gocron, borgmatic, BentoPDF, Vert, IT-Tools, Omni-Tools, Web-Check, Kaneo, rxresu, skysend, nuvio, Linkwarden, homelable, Crowdsec, AdventureLog]
---

### Zwei Server, keiner davon zuhause

Palaven läuft komplett im Rechenzentrum. Das Arbeitstier ist ein gemieteter Root-Server bei Hetzner: ein Core i7-8700
mit 64 GB RAM, zwei gespiegelten NVMe-SSDs für System, Docker und Datenbanken und zwei gespiegelten 8-TB-Platten für Medien,
Fotos und Dokumente. Darauf läuft ein normales Linux mit Docker Compose, ohne Hypervisor dazwischen.

Der zweite Server ist ein winziger VPS bei Netcup mit einem vCore und 1 GB RAM. Er
betreibt Headscale mit Headplane als Oberfläche, also den eigenen Koordinationsserver für mein Tailnet. So
hängt das private Netz nicht an einem fremden Anbieter, und der große Server bleibt frei für die Dienste.

### Vom offenen Server zum Tailnet

Am Anfang war jeder Dienst über den Reverse Proxy aus dem Internet erreichbar. Inzwischen ist das umgedreht: Nur noch
eine Handvoll Dienste, die wirklich öffentlich sein müssen, hängen direkt am Netz. Alles andere ist nur im Tailnet
erreichbar. Dafür betreibe ich auf dem Hetzner Server innerhalb des Tailnets mit Adguard Home meinen eigenen DNS Server. Dieser filtert nicht nur Werbung und Tracking heraus, sondern übernimmt auch noch die Namensauflösung der internen DNS Namen. So kann ich beispielsweise Dockhand unter der Adresse dockhand.infra.domain.example innerhalb des Tailnets aufrufen, während von außen keiner darauf zugreifen kann.

Eine Besonderheit sind die Tailscale Exit Nodes: Auf dem Hetzner-Server laufen fünf Pärchen aus einem Tailscale-Container
und einem Gluetun-Container. Gluetun baut die Verbindung zu AirVPN auf, Tailscale bietet sie im Tailnet als Exit Node
an. Jedes Gerät im Tailnet kann so per Klick über einen von fünf VPN-Standorten ins Internet gehen, ohne dass auf dem
Handy eine eigene VPN-App laufen muss. 

### Ein Login für alles: der Palaven Account

Jeder, der Palaven nutzt, hat genau ein Konto in Authentik, den „Palaven Account“. Es gilt eine feste Regel:

- Dienste, die selbst OIDC können (Immich, Nextcloud, Outline, Open WebUI und viele andere), melden sich direkt bei
  Authentik an.
- Nur Dienste **ohne** eigenes SSO bekommen eine Forward-Auth-Middleware in Traefik. So gibt es keine
  doppelten Logins.


### Wer Palaven nutzt

Im Alltag nutzen es zwei Personen intensiv, von Laptops, Handys und zuhause aus.
Dazu kommt die Familie: Eltern und Geschwister nutzen vor allem Immich und Jellyfin, ein paar andere Nextcloud. Für
Medienanfragen gibt es Seerr, neue Leute lädt Wizarr in Jellyfin ein. Ein familiärer DNS-Filter für alle
Interessierten ist angedacht.

### Eine Compose-Datei, ein Muster

Alle Stacks folgen bei mir demselben Aufbau. So sieht ein typischer Dienst aus, hier am Beispiel der Notizen-App Anchor:

```yaml
services:
  anchor:
    image: ghcr.io/zhfahim/anchor:latest
    container_name: anchor
    restart: unless-stopped
    networks:
      - proxy-net
    volumes:
      - /srv/palaven/data/anchor:/data
    labels:
      - traefik.enable=true
      - traefik.docker.network=proxy-net
      - traefik.http.routers.anchor.rule=Host(`notes.example.domain`)
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
```

Die Regeln dahinter:

- Eine thematische Subdomain pro Dienst. Medien-Automatisierung liegt unter einem eigenen Zweig, Admin-Werkzeuge
  unter einem anderen, Werkzeuge für alle unter einem dritten. Schon die Adresse verrät, wofür ein Dienst da ist.
- Daten nach `/srv/palaven/data/<dienst>`. Alles, was dort liegt, sichert borgmatic. Logs, Caches und anderes,
  das kein Backup braucht, kommen in einen getrennten Arbeitsordner.
- `traefik.docker.network=proxy-net`, sobald ein Container in mehr als einem Netzwerk hängt. Sonst rät Traefik
  womöglich das falsche Netz und antwortet mit einem Timeout.
- `authentik@file` nur ohne natives SSO, siehe oben.

Verwaltet werden die Stacks mit Dockhand, die Logs liest Dozzle mit, und wiederkehrende Aufgaben laufen über Gocron.

### Was alles läuft

Rund 60 Container, grob sortiert:

- **Medien und Streaming:** Jellyfin für Filme und Serien, Navidrome mit dem Web-Client Feishin für Musik,
  Audiobookshelf für Hörbücher und Podcasts. Dazu Seerr für Anfragen, Wizarr für Einladungen und MediaManager.
- **Bücher:** BookOrbit als E-Book-Bibliothek mit Shelfmark für den Import, ReadmeABook als Hörbuch-Portal mit
  getrennten Bereichen für Erwachsene, Teens und Kinder.
- **Medien-Automatisierung:** Sonarr, Radarr, Bazarr und Prowlarr, Recyclarr für die Profile, Maintainerr zum
  Aufräumen, Tdarr für die Transkodierung. SABnzbd läuft hinter Gluetun.
- **Dokumente und Wissen:** Nextcloud (AIO) für Dateien, Paperless-ngx mit Paperless-GPT, Outline als
  Wiki, Overleaf für LaTeX, Anchor für Notizen, dazu eine eigene Dokumentation.
- **Produktivität:** n8n für Automatisierungen, Tududi für Aufgaben, Norish für Rezepte und Essensplanung.
- **KI und Suche:** Open WebUI mit Ollama als lokalem Backend, SearXNG als Suchmaschine ohne Tracking.
- **Fotos:** Immich. Mehr gibt es dazu nicht zu sagen `:)`
- **Sicherheit und Netz:** Vaultwarden, Authentik, AdGuard Home mit Unbound, Traefik, Headscale.
- **Werkzeuge:** BentoPDF, Vert, IT-Tools, Omni-Tools, Web-Check, Filebrowser und zwei kleine selbst gebaute
  Einzweck-Apps.

Ich hoffe ich konnte jemandem helfen `:)`