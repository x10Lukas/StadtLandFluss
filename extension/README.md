# Stadt Land Fluss Helfer

Chrome/Edge-Extension (Manifest V3) für https://stadtlandfluss.cool/

- Erkennt den aktuellen Buchstaben (Text „Buchstabe: X“ oder großes Einzelzeichen auf der Seite; sonst manuell im Popup).
- Ordnet Eingabefelder anhand ihrer Beschriftung einer Kategorie zu (Stadt, Land, Fluss, Name, Tier, Beruf, …).
- Erkennt die ausgewählten Themen (über Eingabefelder, sonst über sichtbare Themen-Texte) und zeigt im Panel unten rechts Lösungsvorschläge je Thema zum gewählten Buchstaben.
- Klick auf einen Vorschlag kopiert ihn und trägt ihn – falls ein Feld existiert – dort ein. ⟳ mischt neue Vorschläge.
- „Alle ausfüllen“ (Panel, Popup oder **Alt+F**) füllt leere Felder automatisch.
- Beim Fokussieren eines Feldes erscheinen zusätzlich Wortvorschläge zum Anklicken.

## Installation
1. `chrome://extensions` öffnen, **Entwicklermodus** aktivieren.
2. **Entpackte Erweiterung laden** → Ordner `extension/` wählen.

## Anpassen
- Wörter: `words.js` (eine Liste pro Kategorie).
- Kategorie-Erkennung: `CATEGORY_PATTERNS` in `content.js`.
- Die Seitenstruktur war beim Erstellen nicht einsehbar, daher arbeitet die Erkennung heuristisch. Falls Felder oder der Buchstabe nicht erkannt werden, `detectLetter()` / `labelTextFor()` in `content.js` an das echte DOM anpassen.
