---
description: "Weboberfläche für Container, Stacks, Volumes und Netzwerke."
notes:
  - "Beim ersten Aufruf fragt Portainer nach einem Setup-Token. Du findest es mit docker logs portainer 2>&1 | grep setup_token. Lege das Admin-Konto innerhalb von 5 Minuten nach dem Start an, sonst sperrt sich Portainer und du startest den Container neu."
  - "Portainer hat vollen Zugriff auf den Docker-Socket. Stell ihn nie ungeschützt ins Internet."
  - "Der Tag lts bekommt nur stabile Versionen mit langem Support. Wer immer die neuesten Funktionen will, nimmt sts."
---
