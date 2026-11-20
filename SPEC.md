# GoKnowledge – Spezifikation (Entwurf zur Freigabe)

## Zweck & Zielgerät
- „Instagram Reels für Allgemeinwissen“, nur für eine Person.
- Ausschließlich Safari auf iPhone 15 Pro Max (430 × 932 pt), als Web-App über „Zum Home-Bildschirm“ (Vollbild).
- Gehostet auf GitHub Pages aus diesem Repository.

## Feed
- Senkrechter Vollbild-Feed, Wischen nach oben/unten = nächste/vorige Karte (Snap-Scrolling).
- Jede Karte: Titelbild (vollflächig), Kategorie-Plakette, Titel (Serifenschrift), Teaser-Satz, „⏱ 1 Min. Lesezeit“.
- Rechts: Like, Merken, Bald wieder. Kein Doppeltipp-Like.
- Aufklappen per Antippen **oder** Wischen nach links.
- Karten sehen immer „wie neu“ aus (keine Gelesen-Markierung).

## Reihenfolge / Loop
- Standard: alle Themen gemischt, zufällige Reihenfolge.
- Endlos-Loop: Sind alle Karten durch, wird neu gemischt und weitergemacht. Der Loop wächst automatisch mit jeder neuen Karte.
- „Bald wieder“: Karte erscheint einmalig erneut nach ca. 10 Karten.

## Artikel (aufgeklappt)
- Karte fährt nach oben auf; ✕ oder nach unten ziehen = zurück.
- Lesefortschrittsbalken oben in Kategoriefarbe.
- Kurze Abschnitte mit Zwischenüberschrift, mehrere Bilder mit Bildunterschrift + Quelle.
- Am Ende Box „Kurz gesagt“ (Zusammenfassung).
- Länge: ca. 1 Minute Lesezeit (~200–250 Wörter).
- Schwebende Leiste unten: Gefällt mir · Merken · Bald wieder.

## Themen & Filter
- Geschichte (Rost), Geografie (Moos), Naturwissenschaften (Pflaume), Kunst (Ocker), Politik (Petrol).
- Filter hinter Symbol oben rechts → Blatt von unten mit Häkchen pro Thema.
- Niveau: Naturwissenschaften anspruchsvoller (Chemie-Bachelor), Rest Zeitungsniveau.

## Navigation
- Untere Leiste: Feed · Gemerkt · Statistik.
- Gemerkt: einfache Liste, Antippen öffnet den Artikel.

## Statistik & Export
- Erfasst pro Karte: gesehen, aufgeklappt, übersprungen, Lesezeit, Like, gemerkt, „bald wieder“.
- Übersicht: Kacheln (gesehen/aufgeklappt/Likes), Aufklapp-Quote pro Thema, Merkliste.
- Knopf „Statistik exportieren“ kopiert alle Daten als Text (JSON) in die Zwischenablage → in den Chat einfügen.
- Speicherung lokal im Gerät (localStorage).

## Design
- Warme Herbstfarben, cremefarbener Grund (#FBF4E8), dunkelbraune Schrift. Siehe `design/design-vorschlag-2.png`.

## Inhalte – erste 20 Testkarten
| Geschichte | Geografie | Naturwissenschaften | Kunst | Politik |
|---|---|---|---|---|
| Mauerfall | Marianengraben | Haber-Bosch-Verfahren | Mona Lisa | Gewaltenteilung |
| Französische Revolution | Sahara | Chiralität & Contergan | Impressionismus | Entstehung der EU |
| Der Schwarze Tod | Island | CRISPR-Cas9 | Bauhaus | UN-Sicherheitsrat |
| Mondlandung 1969 | Amazonas | Schwarze Löcher | Guernica | Bundestagswahl: Erst- & Zweitstimme |

## Technik
- Reines HTML/CSS/JavaScript, keine Frameworks, kein Server.
- Inhalte als Datendatei (JSON) getrennt vom Code → leicht erweiterbar.
- Bilder: Fotos von Wikimedia Commons (freie Lizenzen, Quelle in Bildunterschrift).
