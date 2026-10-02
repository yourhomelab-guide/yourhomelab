---
description: "Identity provider for single sign-on with OIDC, SAML, LDAP and proxy auth."
notes:
  - "Start the initial setup right after the first start at /if/flow/initial-setup/. That's where you set the password for the admin user akadmin."
  - "Needs at least 2 CPU cores and 2 GB of RAM. For a few users, Pocket ID is often enough."
  - "Since version 2025.10, authentik no longer needs Redis, and files live under /data instead of /media. If you're moving from an older version, move the old media folder to data/data/media."
  - "Always update to the next version only (e.g. 2026.5 → 2026.8), and read the release notes first."
---
