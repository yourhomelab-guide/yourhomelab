## Was ändert sich?

<!-- Kurz beschreiben. Bei neuen Diensten: Name + Link zum Projekt. -->

## Art der Änderung

- [ ] Neuer Dienst
- [ ] Vorlage aktualisiert (Image-Version, Konfiguration)
- [ ] Neuer oder überarbeiteter Artikel / Guide
- [ ] Fehlerkorrektur
- [ ] Website / Code

## Checkliste

- [ ] Texte auf Deutsch geschrieben (`de.mdx`). Englisch (`en.mdx`) wird automatisch übersetzt, von Hand nur zum Verbessern anfassen
- [ ] Bei Diensten: `compose.yaml` selbst getestet (`docker compose up -d` läuft, Weboberfläche erreichbar)
- [ ] Bei Diensten: keine Traefik-Labels, keine Proxy-Netzwerke, Daten unter `./data/…` (macht die Website automatisch)
- [ ] Bei Diensten: `reviewed` in `service.yaml` auf das Testdatum gesetzt
- [ ] Keine echten Passwörter, Domains oder IP-Adressen
- [ ] `npm run build` läuft lokal durch (oder CI ist grün)

Mit dem Einreichen stimme ich zu, dass Texte unter CC BY-SA 4.0 und Code/Vorlagen unter MIT veröffentlicht werden.
