// Gemeinsamer Datenspeicher für Content Script und Optionsseite.
// Persönliche Daten (eigene Wörter, Favoriten, Statistik …) liegen in chrome.storage.local.
const SLF_STORE = (() => {
  const KEY = 'slf_data';
  const fresh = () => ({
    custom: {},  // { Thema: [Wörter] }       eigene Wörter (Thema darf auch ein eigenes sein)
    learned: {}, // { Thema: [Wörter] }       automatisch gelernt aus eigenen Eingaben
    fav: {},     // { 'Thema|Wort': 1 }       Favoriten
    hidden: {},  // { 'Thema|Wort': 1 }       ausgeblendete Vorschläge
    rate: {},    // { 'Thema|Wort': 1|2|3 }   eigene Bewertung (1 niedrig, 2 mittel, 3 hoch)
    stats: { rounds: 0, topics: {}, used: {} },
    pos: null,   // { x, y }                  Position des Panels
  });

  let data = fresh();
  const listeners = new Set();
  const sent = [];
  let timer;

  function merge(obj) {
    data = Object.assign(fresh(), obj || {});
    data.stats = Object.assign({ rounds: 0, topics: {}, used: {} }, data.stats);
  }

  function load() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(KEY, (r) => {
          merge(r && r[KEY]);
          resolve(data);
        });
      } catch (e) {
        resolve(data);
      }
    });
  }

  function save() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        const json = JSON.stringify(data);
        sent.push(json);
        if (sent.length > 6) sent.shift();
        chrome.storage.local.set({ [KEY]: data });
      } catch (e) { /* Kontext ungültig (Extension neu geladen) */ }
    }, 150);
  }

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes[KEY]) return;
      const json = JSON.stringify(changes[KEY].newValue);
      if (sent.includes(json)) return; // eigene Änderung
      merge(changes[KEY].newValue);
      listeners.forEach((fn) => fn());
    });
  } catch (e) { /* ignorieren */ }

  return {
    get data() { return data; },
    load,
    save,
    onChange: (fn) => listeners.add(fn),
    key: (category, word) => `${category}|${word}`,
    replace: (obj) => { merge(obj); save(); },
    fresh,
  };
})();
