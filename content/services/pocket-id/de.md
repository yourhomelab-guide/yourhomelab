---
description: "Schlanker OIDC-Provider, Anmeldung nur mit Passkeys."
notes:
  - "Richte den ersten Passkey direkt nach dem Start unter /setup ein."
  - "Pocket ID funktioniert nur über HTTPS, weil Passkeys einen sicheren Kontext brauchen. Ohne Reverse Proxy mit Zertifikat geht es nicht."
  - "Bewahre den ENCRYPTION_KEY aus der .env in deinem Passwortmanager auf. Ohne ihn lassen sich die Schlüssel in der Datenbank nicht mehr entschlüsseln."
---
