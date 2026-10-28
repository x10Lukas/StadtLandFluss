# Stadt Land Fluss Helfer

Chrome/Edge-Extension (Manifest V3) für https://stadtlandfluss.cool/

- Erkennt den aktuellen Buchstaben (Text „Buchstabe: X“ oder großes Einzelzeichen auf der Seite; sonst manuell im Popup).
- Ordnet Eingabefelder anhand ihrer Beschriftung einer Kategorie zu (Stadt, Land, Fluss, Name, Tier, Beruf, …).
- „Ausfüllen“-Button im Panel, Popup oder Tastenkürzel **Alt+F** füllt leere Felder mit Wörtern zum Buchstaben.
- Beim Fokussieren eines Feldes erscheinen Wortvorschläge zum Anklicken.

## Installation
1. `chrome://extensions` öffnen, **Entwicklermodus** aktivieren.
2. **Entpackte Erweiterung laden** → Ordner `extension/` wählen.

## Anpassen
- Wörter: `words.js` (eine Liste pro Kategorie).
- Kategorie-Erkennung: `CATEGORY_PATTERNS` in `content.js`.
- Die Seitenstruktur war beim Erstellen nicht einsehbar, daher arbeitet die Erkennung heuristisch. Falls Felder oder der Buchstabe nicht erkannt werden, `detectLetter()` / `labelTextFor()` in `content.js` an das echte DOM anpassen.
