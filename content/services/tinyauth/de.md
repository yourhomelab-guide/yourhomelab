---
description: "Login-Middleware vor beliebigen Diensten, für Traefik, Caddy und NPM."
notes:
  - "Benutzer legst du mit docker run -it --rm ghcr.io/tinyauthapp/tinyauth:v5 user create --interactive an. Wähle dabei „format for docker“ nicht aus, wenn du den Wert in die .env schreibst, und lass die einfachen Anführungszeichen stehen."
  - "Tinyauth setzt das Login-Cookie für die ganze Domain. Es muss deshalb auf einer Subdomain derselben Domain laufen wie die geschützten Dienste."
  - "Kann Pocket ID oder einen anderen OIDC-Anbieter als Login nutzen."
  - "Das Projekt ist von steveiliop56/tinyauth nach tinyauthapp/tinyauth umgezogen, das Image heißt jetzt ghcr.io/tinyauthapp/tinyauth. Ab v4 gibt es keine SECRET-Variable mehr, und alle Variablen beginnen mit TINYAUTH_."
---
