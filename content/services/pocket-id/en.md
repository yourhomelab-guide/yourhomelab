---
description: "Lightweight OIDC provider, sign-in with passkeys only."
notes:
  - "Set up the first passkey at /setup right after starting."
  - "Pocket ID only works over HTTPS, because passkeys need a secure context. It won't work without a reverse proxy with a certificate."
  - "Keep the ENCRYPTION_KEY from the .env file in your password manager. Without it, the keys in the database can't be decrypted anymore."
---
