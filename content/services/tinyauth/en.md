---
description: "Login middleware in front of any service, for Traefik, Caddy and NPM."
notes:
  - "Create users with docker run -it --rm ghcr.io/tinyauthapp/tinyauth:v5 user create --interactive. Don't pick “format for docker” when you put the value into the .env file, and keep the single quotes."
  - "Tinyauth sets the login cookie for the whole domain. So it must run on a subdomain of the same domain as the services it protects."
  - "Can use Pocket ID or another OIDC provider for login."
  - "The project moved from steveiliop56/tinyauth to tinyauthapp/tinyauth; the image is now ghcr.io/tinyauthapp/tinyauth. Since v4 there is no SECRET variable anymore, and all variables start with TINYAUTH_."
---
