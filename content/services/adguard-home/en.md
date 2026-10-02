---
description: "A DNS server that blocks ads and trackers for every device on your home network."
notes:
  - "Finish the setup wizard right after the first start. Until then, anyone who can reach the page can set up AdGuard Home."
  - "Port 53 must be free on the server. On Ubuntu, systemd-resolved uses it, so turn that off first."
  - "In the setup wizard, set the web interface to port 3000 (all interfaces). That way it stays where the reverse proxy expects it."
  - "Never forward port 53 on your router. An open DNS server on the internet gets abused for attacks quickly."
  - "If the server is off, DNS stops working on your home network. Plan a second DNS server or a fallback."
---
