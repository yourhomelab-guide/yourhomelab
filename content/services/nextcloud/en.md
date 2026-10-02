---
description: "Sync files, calendars and contacts, extensible with many apps."
notes:
  - "Finish the installation (admin account) right after the first start. Until then, anyone who can reach the page can take it over."
  - "Nextcloud needs its own subdomain; path URLs are not supported."
  - "The cron container runs the background jobs. After the installation, switch background jobs to “Cron” under Administration settings → Basic settings."
  - "Updates only go from one major version to the next (e.g. 35 → 36). Change the tag in both services and don't skip a version."
  - "The upload limit is set in PHP_UPLOAD_LIMIT. Behind Nginx Proxy Manager or a Cloudflare Tunnel, their own limits apply as well."
---
