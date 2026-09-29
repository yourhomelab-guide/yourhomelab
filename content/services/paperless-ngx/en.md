---
description: Scan paperwork, make it searchable using optical character recognition, and automatically file it with tags and correspondents.
notes:
  - Paperless automatically imports everything you place in the "consume" folder. You can share this folder via Samba with scanners and PCs.
  - You create the first user with `docker compose exec paperless-ngx createsuperuser`.
  - "For backups, run the document_exporter regularly in addition to the database backup: It writes all documents, including metadata, to the export folder."
---
