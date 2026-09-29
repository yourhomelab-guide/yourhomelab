---
description: Your own media library for movies, TV shows, and music, with apps for your phone, TV, and browser.
notes:
  - In the .env file, enter the folder containing your media under MEDIA_DIR. Jellyfin only reads from it; it does not write anything to it.
  - An iGPU from Intel (Quick Sync) or AMD noticeably reduces the load on the CPU when converting videos. The block for this is commented out in the compose.yaml file.
  - According to Cloudflare's Terms of Service, video streaming via a Cloudflare Tunnel is not permitted. To access the service from outside, use a reverse proxy with port forwarding or a VPN.
---
