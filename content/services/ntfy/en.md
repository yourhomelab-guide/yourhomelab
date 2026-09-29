---
description: Push notifications to cell phones via a simple HTTP request, such as for backups and monitoring.
notes:
  - "The server is set to private: No one can read or post without an account. Create a user after starting the server: docker compose exec ntfy ntfy user add --role=admin YOURNAME"
  - For instant messages on the iPhone, ntfy forwards a message ID (not the content) to ntfy.sh. If you don't want this to happen, remove NTFY_UPSTREAM_BASE_URL.
  - In the Android app, enable "instant delivery" for your own server.
---
