---
name: Ein Mini-PC im Flur
author: yourhomelab
lang: de
example: true
added: 2026-09-28
summary: Der klassische Einstieg und genau der Weg dieser Seite. Ein sparsamer Mini-PC mit Debian, Docker Compose und Traefik, dazu ein nächtliches Backup auf eine USB-Platte.
location: local
platform: [bare-metal]
management: [compose]
proxy: [traefik]
access: [vpn]
servers: 1
hardware: Mini-PC mit Intel N100, 16 GB RAM, 1 TB NVMe, externe USB-Platte fürs Backup
watts: 8
domain: Eigene Domain, Wildcard-Eintrag auf die Heim-IP, DynDNS über den Router
auth: Pocket ID mit Passkeys, Tinyauth vor Diensten ohne eigenen Login
backup: borgmatic jede Nacht auf die USB-Platte, einmal im Monat zusätzlich auf eine Platte bei der Familie
monitoring: Uptime Kuma, Beszel
services: [traefik, vaultwarden, immich, uptime-kuma, beszel, pocket-id, tinyauth]
---

Alle Stacks liegen unter `/srv/homelab`, ein Ordner pro Dienst mit `compose.yaml`, `.env` und `data/`. Von außen
ist nur WireGuard offen, die Dienste sind über das VPN erreichbar. Das hält die Angriffsfläche klein.

Das Setup ist absichtlich langweilig: ein Rechner, eine Konfiguration pro Dienst, ein Backup-Ordner. Neue Dienste
kommen dazu, indem ein weiterer Ordner entsteht.
