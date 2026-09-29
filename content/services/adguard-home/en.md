---
description: A DNS server that blocks ads and trackers for all devices on the home network.
notes:
  - Port 53 must be open on the server. On Ubuntu, it is occupied by systemd-resolved, so you'll need to stop it first.
  - In the setup wizard, set the web interface to port 3000 (all interfaces). That way, it will remain where the reverse proxy expects it to be.
  - Never open Port 53 on your router. An open DNS server on the Internet can quickly be exploited for attacks.
  - If the server is down, DNS will no longer work on your home network. Plan to set up a second DNS server or a fallback.
---
