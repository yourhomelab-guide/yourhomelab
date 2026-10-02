---
description: "Start page for your homelab: all services as tiles, with status and live values."
notes:
  - "The configuration lives in YAML files under data/config. Changes show up after reloading the page."
  - "HOMEPAGE_ALLOWED_HOSTS must contain exactly the address you open Homepage at, otherwise the widgets stay empty."
  - "Homepage only reads Docker through a socket proxy without write access. Never mount the Docker socket directly: whoever has it has root rights on the server."
  - "Widgets show data from your services. That's why, with Traefik or Caddy, the template only lets the home network through. For access on the go, use a VPN or a login like Tinyauth."
---
