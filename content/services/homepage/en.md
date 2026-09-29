---
description: "Home page for your home lab: all services displayed as tiles, with status and real-time data."
notes:
  - The configuration is stored in YAML files under data/config. Changes take effect after the page is reloaded.
  - HOMEPAGE_ALLOWED_HOSTS must contain the exact address where you open your homepage; otherwise, the widgets will remain empty.
  - "The website accesses Docker only through a socket proxy without write permissions. Never embed the Docker socket directly: Anyone who has access to it has root privileges on the server."
  - Widgets display data from your services. Don't make your homepage publicly accessible on the Internet; instead, place it behind a login or within a VPN.
---
