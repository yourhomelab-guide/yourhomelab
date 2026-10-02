---
description: "Push notifications to your phone with a simple HTTP request, for example from backups and monitoring."
notes:
  - "The server is set to private: without an account, nobody can read or send. Create a user after starting: docker compose exec ntfy ntfy user add --role=admin DEINNAME (use your own name)"
  - "For instant notifications on the iPhone, ntfy forwards a message ID (not the content) to ntfy.sh. If you don't want that, remove NTFY_UPSTREAM_BASE_URL."
  - "In the Android app, turn on “instant delivery” for your own server."
---
