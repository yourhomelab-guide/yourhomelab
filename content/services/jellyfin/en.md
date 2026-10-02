---
description: "Your own media library for movies, shows and music, with apps for your phone, TV and browser."
notes:
  - "Finish the setup wizard right after the first start. Until then, anyone who can reach the page can create the admin account."
  - "Put the folder with your media into MEDIA_DIR in the .env file. Jellyfin only reads it and never writes to it."
  - "An Intel (Quick Sync) or AMD iGPU noticeably takes load off the CPU when converting videos. The block for it is commented out in compose.yaml."
  - "Cloudflare's terms of service don't cover video streaming through a Cloudflare Tunnel. For access from outside, use a reverse proxy with port forwarding or a VPN."
---
