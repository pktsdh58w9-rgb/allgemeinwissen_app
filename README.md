# GoKnowledge

Wissens-Reels für Safari auf dem iPhone: senkrecht wischen, Thema antippen oder nach links wischen, in ~1 Minute lesen.

Live: https://pktsdh58w9-rgb.github.io/allgemeinwissen_app/

## Aufbau
- `index.html`, `styles.css`, `app.js`, `sw.js` – die App (reines HTML/CSS/JS, PWA)
- `data/cards.json` – **generiert**, alle Karten (500: je 100 Geschichte, Geografie, Naturwissenschaften, Kunst, Politik)
- `data/base-cards.json` – die 20 ursprünglichen Testkarten
- `data/src/*.txt` – Quelltexte aller weiteren Karten (einfaches Textformat, siehe `tools/build.py`)
- `tools/build.py` – baut `data/cards.json`; ermittelt Bilder (Hauptbild des jeweiligen de-Wikipedia-Artikels, nur Wikimedia Commons)
- `tools/image-cache.json` – Cache der Bildzuordnungen
- `SPEC.md` – abgestimmte Spezifikation, `design/` – Design-Entwürfe

## Neue Karten hinzufügen
1. Karten im Format von `data/src/*.txt` ergänzen (eigene Datei oder bestehende).
2. `python3 tools/build.py --fetch` ausführen (sucht nur neue Bilder).
3. Committen und pushen – GitHub Pages aktualisiert sich automatisch.

Lokal testen: `python3 -m http.server` und `http://localhost:8000` öffnen.
