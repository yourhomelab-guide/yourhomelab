---
description: "Deine eigene Mediathek für Filme, Serien und Musik, mit Apps für Handy, Fernseher und Browser."
notes:
  - "Schließ den Einrichtungsassistenten direkt nach dem ersten Start ab. Bis dahin kann jeder, der die Seite erreicht, das Admin-Konto anlegen."
  - "Trag in der .env unter MEDIA_DIR den Ordner mit deinen Medien ein. Jellyfin liest ihn nur, schreibt aber nichts hinein."
  - "Eine iGPU von Intel (Quick Sync) oder AMD entlastet die CPU beim Umwandeln von Videos spürbar. Der Block dafür steht auskommentiert in der compose.yaml."
  - "Video-Streaming über einen Cloudflare Tunnel ist laut den Nutzungsbedingungen von Cloudflare nicht vorgesehen. Nimm für den Zugriff von außen einen Reverse Proxy mit Portfreigabe oder ein VPN."
---
