---
description: "Papierkram scannen, per Texterkennung durchsuchbar machen und automatisch mit Tags und Korrespondenten ablegen."
notes:
  - "Alles, was du in den Ordner consume legst, importiert Paperless automatisch. Den Ordner kannst du per Samba für Scanner und PCs freigeben."
  - "Den ersten Benutzer legst du mit docker compose exec paperless-ngx createsuperuser an."
  - "Für Backups zusätzlich zur Datenbank regelmäßig den document_exporter laufen lassen: Er schreibt alle Dokumente samt Metadaten in den Ordner export."
---
