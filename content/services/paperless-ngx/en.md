---
description: "Scan paperwork, make it searchable with text recognition and file it automatically with tags and correspondents."
notes:
  - "Paperless automatically imports everything you put into the consume folder. You can share the folder with scanners and PCs via Samba."
  - "Create the first user with docker compose exec paperless-ngx createsuperuser."
  - "For backups, also run the document_exporter regularly in addition to the database: it writes all documents including metadata into the export folder."
---
