---
description: "Push-Benachrichtigungen aufs Handy per einfachem HTTP-Aufruf, zum Beispiel von Backups und Monitoring."
notes:
  - "Der Server ist privat eingestellt: Ohne Konto kann niemand lesen oder senden. Lege nach dem Start einen Benutzer an: docker compose exec ntfy ntfy user add --role=admin DEINNAME"
  - "Für sofortige Nachrichten auf dem iPhone leitet ntfy eine Nachrichten-ID (nicht den Inhalt) an ntfy.sh weiter. Wer das nicht will, entfernt NTFY_UPSTREAM_BASE_URL."
  - "In der Android-App schaltest du beim eigenen Server die „sofortige Zustellung“ ein."
---
