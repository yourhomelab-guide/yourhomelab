---
description: "Startseite für dein Homelab: alle Dienste als Kacheln, mit Status und Live-Werten."
notes:
  - "Die Konfiguration steht in YAML-Dateien unter data/config. Änderungen erscheinen nach einem Neuladen der Seite."
  - "HOMEPAGE_ALLOWED_HOSTS muss genau die Adresse enthalten, unter der du Homepage öffnest, sonst bleiben die Widgets leer."
  - "Homepage liest Docker nur über einen Socket-Proxy ohne Schreibrechte. Binde den Docker-Socket nie direkt ein: Wer ihn hat, hat Root-Rechte auf dem Server."
  - "Widgets zeigen Daten aus deinen Diensten. Mit Traefik oder Caddy lässt die Vorlage deshalb nur das Heimnetz durch. Für den Zugriff von unterwegs nimm ein VPN oder einen Login wie Tinyauth."
---
