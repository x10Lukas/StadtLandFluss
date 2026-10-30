# Stadt Land Fluss Helfer

Chrome/Edge-Extension (Manifest V3) für https://stadtlandfluss.cool/

Erkennt Buchstabe und Themen der Runde und zeigt zu jedem Thema bewertete Lösungsvorschläge.

## Installation
1. `chrome://extensions` öffnen, **Entwicklermodus** aktivieren.
2. **Entpackte Erweiterung laden** → Ordner `extension/` wählen.
3. Nach Updates die Extension neu laden und die Seite aktualisieren.

## Funktionen
- **Vorschläge je Thema** (Panel unten rechts, Standard 4 pro Thema, ⟳ mischt neu). Klick auf ein Wort trägt es ins Feld ein und kopiert es.
- **Bewertung** – Farbbalken am Wort: 🟢 niedrig, 🟡 mittel, 🔴 hoch = Chance, dass andere dasselbe schreiben (Schätzung: naheliegende Wörter stehen in `words.js` vorn).
- **Mehr Wörter & Suche** – ▾ am Thema zeigt alle Wörter zum Buchstaben, das Suchfeld filtert über alle Themen.
- **Eigene Wörter & Favoriten** – `+` am Thema fügt ein eigenes Wort hinzu (✎). Beim Überfahren eines Wortes: ★ Favorit (wird immer zuerst vorgeschlagen), ◐ Bewertung ändern, ✕ ausblenden. Alles verwaltbar in den **Optionen** (auch eigene Themen).
- **Lernen & Statistik** – eigene Eingaben werden als „gelernte Wörter“ gemerkt (abschaltbar); Optionen → Statistik zeigt Runden, Themen und meistbenutzte Wörter.
- **Automatik & Komfort** (als Button im Panel *und* im Popup einstellbar):
  - *Auto* – bei jeder neuen Runde automatisch ausfüllen
  - Panel **verschiebbar** (an der Kopfzeile ziehen, Doppelklick = zurücksetzen), Größe klein/mittel/groß, Design dunkel/hell/automatisch
  - Tastenkürzel: **Alt+F** alle ausfüllen · **Alt+1…9** Thema n ausfüllen (nochmal = nächster Vorschlag) · **Alt+R** neu mischen · **Alt+H** Panel ein-/ausklappen
- Beim Klick in ein Eingabefeld erscheinen die Vorschläge auch direkt am Feld.

## Daten
Eigene Wörter, Favoriten, Bewertungen und Statistik liegen lokal im Browser (`chrome.storage.local`). Optionen → Daten: Export/Import als JSON.

## Aufbau
| Datei | Aufgabe |
| --- | --- |
| `content.js` | Erkennung von Buchstabe/Themen, Panel, Automatik |
| `words.js` | eingebaute Wortlisten (`{ rated, w: { Buchstabe: [Wörter] } }`) |
| `store.js` | gemeinsamer Datenspeicher (eigene Wörter, Favoriten, Statistik) |
| `popup.*` | Schnelleinstellungen |
| `options.*` | eigene Wörter, Favoriten, Statistik, Export/Import |
| `background.js` | öffnet die Optionsseite aus dem Panel |

## Anpassen
- Eingebaute Wörter: `words.js`. Je Buchstabe das naheliegendste Wort zuerst; so entsteht die Bewertung. Themen mit `rated: false` haben keine Bewertung.
- Neues Thema: Wortliste in `words.js` (Schlüssel = Themenname) und Muster in `CATEGORY_PATTERNS` (`content.js`). Für persönliche Themen reicht ein eigenes Thema in den Optionen.
- Die Seitenstruktur wird heuristisch erkannt (Beschriftung von Feldern, Text „Buchstabe: X“). Falls etwas nicht erkannt wird, `detectLetter()` / `labelTextFor()` in `content.js` anpassen.
