---
name: Daten zuhause, Eingang in der Cloud
author: yourhomelab
lang: de
example: true
added: 2026-09-28
summary: Der Anschluss hat nur DS-Lite. Deshalb nimmt ein kleiner VPS die Anfragen aus dem Internet an und reicht sie per WireGuard an den Server zuhause weiter, auf dem Unraid mit viel Speicher läuft.
location: hybrid
platform: [unraid]
management: [compose, dockhand]
proxy: [caddy]
access: [vps, vpn]
servers: 2
hardware: Selbstbau-NAS mit 4 Festplatten und 32 GB RAM, dazu ein kleiner VPS mit 2 GB RAM
domain: Domain beim Registrar, alle Einträge zeigen auf die IPv4 des VPS
auth: Login der jeweiligen Dienste, Admin-Oberflächen nur über das VPN
backup: borgmatic auf eine externe Platte und in ein Borg-Repository bei einem Anbieter
monitoring: Uptime Kuma auf dem VPS, damit es auch einen Ausfall zuhause bemerkt
services: [caddy, immich, nextcloud, vaultwarden, uptime-kuma, dockhand, Jellyfin]
---

Caddy läuft auf dem VPS und spricht über einen WireGuard-Tunnel mit dem NAS. Zuhause ist kein Port offen, die
Heim-IP bleibt unsichtbar. Der VPS speichert keine Daten, er ist nur der Eingang.

Die Compose-Stacks auf Unraid liegen trotzdem als Dateien in einem eigenen Share. Dockhand dient nur zum Ansehen
und Neustarten.
