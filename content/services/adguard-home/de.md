---
description: "DNS-Server, der Werbung und Tracker für alle Geräte im Heimnetz blockiert."
notes:
  - "Port 53 muss auf dem Server frei sein. Unter Ubuntu belegt ihn systemd-resolved, das schaltest du vorher ab."
  - "Stell im Einrichtungsassistenten die Weboberfläche auf Port 3000 (alle Schnittstellen). Dann bleibt sie dort, wo der Reverse Proxy sie erwartet."
  - "Gib Port 53 nie im Router frei. Ein offener DNS-Server im Internet wird schnell für Angriffe missbraucht."
  - "Ist der Server aus, funktioniert im Heimnetz kein DNS mehr. Plane einen zweiten DNS-Server oder einen Fallback ein."
---
