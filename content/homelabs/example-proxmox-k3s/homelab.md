---
name: Drei Knoten zum Lernen
author: yourhomelab
lang: de
example: true
added: 2026-09-28
summary: Ein kleiner Proxmox-Cluster aus gebrauchten Business-Mini-PCs. Die Alltagsdienste laufen mit Docker Compose in einer VM, daneben ein k3s-Cluster zum Lernen für den Beruf.
location: local
platform: [proxmox, kubernetes]
management: [compose, gitops, ansible]
proxy: [traefik]
access: [tunnel, vpn]
servers: 3
hardware: 3× gebrauchter Business-Mini-PC mit je 32 GB RAM, ein NAS für die Backups
watts: 45
domain: Domain bei einem Registrar, DNS bei Cloudflare, Zertifikate per DNS-Challenge
auth: Authentik für alles, was OIDC kann
backup: Proxmox Backup Server für die VMs, borgmatic für die Daten der Compose-Stacks
monitoring: Beszel für die Knoten, Prometheus und Grafana im k3s-Cluster
services: [traefik, authentik, forgejo, nextcloud, uptime-kuma, beszel, Home Assistant, Prometheus, Grafana]
---

Die wichtigen Dienste wie Nextcloud und Forgejo laufen bewusst **nicht** im Kubernetes-Cluster, sondern in einer
einfachen Debian-VM mit Docker Compose. So bleibt der Alltag stabil, auch wenn im Lern-Cluster etwas kaputtgeht.

Die VMs werden mit Ansible eingerichtet, die Compose-Dateien liegen in einem Git-Repository auf Forgejo. Der
k3s-Cluster zieht seine Manifeste per GitOps aus demselben Forgejo.
