// Stadt Land Fluss Helfer – Content Script für stadtlandfluss.cool
// Die Seitenstruktur ist nicht fest verdrahtet: Felder werden über ihre Beschriftung
// (label, placeholder, aria-label, name, umgebender Text) einer Kategorie zugeordnet.
(() => {
  'use strict';

  // Reihenfolge wichtig: spezifische Themen zuerst, allgemeine (Stadt, Land, Name …) zuletzt.
  // Der Themenname muss ein Schlüssel in SLF_WORDS (words.js) sein, um Vorschläge zu liefern.
  const CATEGORY_PATTERNS = [
    ['Sollte man nicht essen', /nicht\s+essen/i],
    ['Sollte man nicht auf der Toilette tun', /toilette/i],
    ['Namen den man keinem Kind geben sollte', /keinem\s+kind|kind\s+geben/i],
    ['Darf im Kühlschrank nie fehlen', /kühlschrank/i],
    ['Gegenstand auf dem Schreibtisch', /schreibtisch/i],
    ['Größer als ein Elefant', /(größer|grösser)\s+als/i],
    ['Kleiner als eine Ameise', /kleiner\s+als/i],
    ['Grund für Verspätung', /versp[äa]tung/i],
    ['Grund zum Heulen', /heulen/i],
    ['Grund für Schulverweis', /schulverweis/i],
    ['Erfundener Beruf', /erfunden/i],
    ['Erhöht die Coolness', /erhöht.*cool/i],
    ['Senkt die Coolness', /senkt.*cool/i],
    ['No-Go beim ersten Date', /no.?go|\bdate\b/i],
    ['Letzte Worte', /letzte\s+worte/i],
    ['Wort aus einer Fremdsprache', /fremdsprache/i],
    ['Englisches Wort', /englisch/i],
    ['Auf dem Bauernhof', /bauernhof/i],
    ['Elektrisches Gerät', /elektr/i],
    ['Etwas ekeliges', /ekel/i],
    ['Tut weh', /tut\s+weh/i],
    ['Chemisches Element', /chemisch|\belement/i],
    ['Computerspiel', /computerspiel|videospiel/i],
    ['Fortbewegungsmittel', /fortbewegung/i],
    ['Fabelwesen', /fabelwesen/i],
    ['Dinoart', /dino/i],
    ['Grabsteininschrift', /grabstein/i],
    ['Anmachspruch', /anmach/i],
    ['Werbeslogan', /slogan/i],
    ['Rappername', /rapper|rappername/i],
    ['Todesursache', /todesursache|\btod\b/i],
    ['Scheidungsgrund', /scheidung/i],
    ['Naturkatastrophe', /katastrophe/i],
    ['Sehenswürdigkeit', /sehenswürdigkeit/i],
    ['Superkraft', /superkraft|superkräfte/i],
    ['Tanzart', /tanz/i],
    ['Pizzabelag', /pizza/i],
    ['Eissorte', /eissorte|\beis\b/i],
    ['Cocktail', /cocktail/i],
    ['Krankheit', /krankheit/i],
    ['Instrument', /instrument/i],
    ['Hobby', /hobby/i],
    ['Gefühl', /gefühl/i],
    ['Körperteil', /körperteil/i],
    ['Schimpfwort', /schimpf/i],
    ['Film/Serie', /film|serie/i],
    ['Fußballer', /fu(ß|ss)ball/i],
    ['Politiker', /politik/i],
    ['Promi', /promi/i],
    ['Sportart', /sport/i],
    ['Marke', /marke|brand|firma/i],
    ['Getränk', /getränk|drink|beverage/i],
    ['Lebensmittel', /essen|speise|food|gericht|lebensmittel/i],
    ['Gegenstand', /gegenstand|\bding\b|objekt|object/i],
    ['Beruf', /beruf|\bjob\b|profession/i],
    ['Pflanze', /pflanze|plant|blume|baum/i],
    ['Farbe', /farbe|color|colour/i],
    ['Tier', /tier|animal/i],
    ['Beere', /beere/i],
    ['Berg', /\bberg|gebirge|mountain/i],
    ['Stadt', /stadt|städte|city|\bort\b/i],
    ['Land', /\bland\b|länder|country/i],
    ['Fluss', /fluss|flüsse|river|gewässer/i],
    ['Name', /\bname|vorname/i],
  ];

  const DEFAULTS = { enabled: true, manualLetter: '', overwrite: false, showPanel: true };
  let settings = { ...DEFAULTS };
  const usedWords = new Set();

  // ---------- Einstellungen ----------
  const loadSettings = () =>
    new Promise((resolve) => {
      try {
        chrome.storage.sync.get(DEFAULTS, (s) => {
          settings = { ...DEFAULTS, ...s };
          resolve();
        });
      } catch (e) {
        resolve();
      }
    });

  chrome.storage.onChanged.addListener((changes) => {
    for (const [k, v] of Object.entries(changes)) settings[k] = v.newValue;
    renderPanel();
  });

  // ---------- Buchstabe erkennen ----------
  function normalizeLetter(s) {
    const l = (s || '').trim().toUpperCase();
    return /^[A-ZÄÖÜ]$/.test(l) ? l : '';
  }

  function detectLetter() {
    const manual = normalizeLetter(settings.manualLetter);
    if (manual) return manual;

    const text = document.body ? document.body.innerText : '';
    const m = text.match(/(?:Anfangs)?(?:buchstabe|letter)\s*(?:ist|is)?\s*[:\-–]?\s*["„]?([A-ZÄÖÜ])\b/i);
    if (m) return normalizeLetter(m[1]);

    // Fallback: ein sichtbares, großes Einzelzeichen (typische Buchstaben-Anzeige)
    const candidates = document.querySelectorAll('h1,h2,h3,div,span,p,strong,b');
    for (const el of candidates) {
      if (el.children.length) continue;
      const t = el.textContent.trim();
      if (!/^[A-ZÄÖÜ]$/.test(t)) continue;
      const style = getComputedStyle(el);
      if (parseFloat(style.fontSize) >= 32 && style.visibility !== 'hidden' && el.offsetParent !== null) {
        return t;
      }
    }
    return '';
  }

  // ---------- Felder erkennen ----------
  function isFillable(el) {
    if (el.disabled || el.readOnly || el.offsetParent === null) return false;
    if (el.tagName === 'TEXTAREA') return true;
    const type = (el.getAttribute('type') || 'text').toLowerCase();
    return type === 'text' || type === 'search';
  }

  function labelTextFor(el) {
    const parts = [el.getAttribute('aria-label'), el.placeholder, el.name, el.id, el.title];
    if (el.labels) for (const l of el.labels) parts.push(l.textContent);
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      for (const id of labelledBy.split(/\s+/)) {
        const n = document.getElementById(id);
        if (n) parts.push(n.textContent);
      }
    }
    let text = parts.filter(Boolean).join(' ');
    if (matchCategory(text)) return text;

    // Hat das Feld eine eigene, aussagekräftige Beschriftung, die kein bekanntes Thema ist,
    // nicht den Text der Nachbarfelder übernehmen (sonst landet es beim falschen Thema).
    const own = cleanLabel(el);
    if (own && !/antwort|eingabe|answer|tippen|schreib|hier|\.\.\.|…/i.test(own)) return own;

    // Umgebenden Text einsammeln (kurze Ancestor-Texte, vorherige Geschwister)
    let node = el;
    for (let i = 0; i < 3 && node && node.parentElement; i++) {
      let sib = node.previousElementSibling;
      while (sib) {
        const t = sib.textContent.trim();
        if (t && t.length < 60) text += ' ' + t;
        sib = sib.previousElementSibling;
      }
      node = node.parentElement;
      const own = node.textContent.trim();
      if (own.length < 60) text += ' ' + own;
      if (matchCategory(text)) break;
    }
    return text;
  }

  function matchCategory(text) {
    for (const [cat, re] of CATEGORY_PATTERNS) if (re.test(text)) return cat;
    return null;
  }

  // Kurze, saubere Beschriftung für Themen, die wir nicht kennen
  function cleanLabel(el) {
    const cand = [el.getAttribute('aria-label'), el.placeholder];
    if (el.labels) for (const l of el.labels) cand.push(l.textContent);
    for (const c of cand) {
      const t = (c || '').replace(/\s+/g, ' ').trim();
      if (t.length >= 2 && t.length <= 45) return t;
    }
    return '';
  }

  function findFields() {
    const known = [];
    const unknown = [];
    for (const el of document.querySelectorAll('input, textarea')) {
      if (!isFillable(el) || el.closest('#slf-helper-host')) continue;
      const category = matchCategory(labelTextFor(el));
      if (category) known.push({ el, category });
      else unknown.push(el);
    }
    // Unbekannte Felder nur übernehmen, wenn sie nahe an erkannten Themenfeldern liegen
    // (sonst würden z. B. Chat- oder Suchfelder als „Thema“ auftauchen).
    const out = known.slice();
    for (const el of unknown) {
      const label = cleanLabel(el);
      if (!label) continue;
      let a = el;
      for (let i = 0; i < 5 && a.parentElement; i++) {
        a = a.parentElement;
        if (known.some((k) => a.contains(k.el))) {
          out.push({ el, category: label, unknown: true });
          break;
        }
      }
    }
    return out;
  }

  // Ausgewählte Themen: erst über Eingabefelder, sonst über sichtbare Überschriften/Labels
  function detectTopics() {
    const topics = [];
    const seen = new Set();
    const add = (category, el, unknown) => {
      if (seen.has(category)) return;
      seen.add(category);
      topics.push({ category, el: el || null, unknown: !!unknown });
    };
    for (const { el, category, unknown } of findFields()) add(category, el, unknown);
    if (!topics.length && document.body) {
      let n = 0;
      for (const el of document.body.querySelectorAll('*')) {
        if (++n > 3000) break;
        if (el.children.length || el.closest('#slf-helper-host') || el.offsetParent === null) continue;
        if (/^(script|style|noscript|button|a)$/i.test(el.tagName)) continue;
        const t = el.textContent.trim();
        if (t.length < 2 || t.length > 30) continue;
        const category = matchCategory(t);
        if (category) add(category, null);
      }
    }
    return topics;
  }

  // ---------- Wörter ----------
  function wordsFor(category, letter) {
    const raw = SLF_WORDS[category] || [];
    const list = Array.isArray(raw) ? raw : raw.split(/\s+/).filter(Boolean);
    return list.filter((w) => w[0].toUpperCase() === letter);
  }

  function pickWord(category, letter) {
    const pool = wordsFor(category, letter);
    const fresh = pool.filter((w) => !usedWords.has(w));
    const src = fresh.length ? fresh : pool;
    if (!src.length) return '';
    return src[Math.floor(Math.random() * src.length)];
  }

  function setValue(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function fillAll() {
    const letter = detectLetter();
    if (!letter) return { letter: '', filled: 0, fields: 0 };
    const fields = findFields();
    let filled = 0;
    for (const { el, category } of fields) {
      if (el.value && !settings.overwrite) continue;
      const word = pickWord(category, letter);
      if (!word) continue;
      usedWords.add(word);
      setValue(el, word);
      filled++;
    }
    return { letter, filled, fields: fields.length };
  }

  // ---------- Panel (Shadow DOM) ----------
  const CHIPS_PER_TOPIC = 6;
  let host, root, lastSignature = '';
  let collapsed = false;
  let shuffleSeed = 0;
  let lastGood = null;
  const GRACE_MS = 30000;

  function ensurePanel() {
    if (host) return;
    host = document.createElement('div');
    host.id = 'slf-helper-host';
    root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host { all: initial; }
        .panel { position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; width: 300px;
          max-height: 70vh; overflow: auto; font: 14px/1.3 system-ui, sans-serif;
          background: #1f2937; color: #f9fafb; border-radius: 12px; padding: 10px 12px;
          box-shadow: 0 6px 24px rgba(0,0,0,.35); }
        .head { display: flex; align-items: center; gap: 8px; }
        .letter { font-weight: 700; font-size: 20px; min-width: 26px; text-align: center;
          background: #374151; border-radius: 8px; padding: 2px 6px; }
        .title { flex: 1; font-weight: 600; }
        button { font: inherit; cursor: pointer; border: 0; border-radius: 8px; padding: 4px 8px;
          background: #374151; color: #f9fafb; }
        button:hover { background: #4b5563; }
        button.primary { background: #10b981; color: #052e1f; font-weight: 600; }
        button.primary:hover { background: #34d399; }
        .body { margin-top: 8px; }
        .topic { margin: 8px 0; }
        .topic h4 { margin: 0 0 4px; font-size: 12px; text-transform: uppercase;
          letter-spacing: .04em; color: #9ca3af; }
        .chip { display: inline-block; margin: 2px 4px 2px 0; padding: 3px 9px; border-radius: 999px;
          background: #064e3b; color: #d1fae5; cursor: pointer; font-size: 13px; }
        .chip:hover { background: #047857; }
        .none, .msg { font-size: 12px; opacity: .75; }
        .actions { display: flex; gap: 6px; margin-top: 8px; align-items: center; }
        .sugg { position: fixed; z-index: 2147483647; background: #fff; color: #111;
          border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,.3); padding: 4px;
          font: 13px system-ui, sans-serif; display: none; }
        .sugg span { display: inline-block; padding: 3px 8px; margin: 2px; border-radius: 6px;
          background: #ecfdf5; cursor: pointer; }
        .sugg span:hover { background: #a7f3d0; }
      </style>
      <div class="panel" id="panel">
        <div class="head">
          <span class="letter" id="letter">?</span>
          <span class="title">Lösungsvorschläge</span>
          <button id="shuffle" title="Neue Vorschläge">⟳</button>
          <button id="toggle" title="Ein-/Ausklappen">–</button>
        </div>
        <div class="body" id="body"></div>
      </div>
      <div class="sugg" id="sugg"></div>`;
    document.documentElement.appendChild(host);
    root.getElementById('shuffle').addEventListener('click', () => { shuffleSeed++; renderPanel(true); });
    root.getElementById('toggle').addEventListener('click', () => {
      collapsed = !collapsed;
      root.getElementById('body').style.display = collapsed ? 'none' : '';
      root.getElementById('toggle').textContent = collapsed ? '+' : '–';
    });
  }

  function setMsg(text) {
    const m = root && root.getElementById('msg');
    if (m) m.textContent = text;
  }

  // Deterministisch gemischt je (Seed, Kategorie, Buchstabe), damit Vorschläge beim Neuzeichnen stabil bleiben
  function seededShuffle(arr, seedStr) {
    let h = 2166136261;
    for (const c of seedStr) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    const rnd = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)), (h >>> 0) / 4294967296);
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function copyText(text) {
    try { navigator.clipboard.writeText(text).catch(() => {}); } catch (e) { /* ignorieren */ }
  }

  function doFill() {
    const r = fillAll();
    renderPanel(true);
    setMsg(!r.letter ? 'Kein Buchstabe erkannt – im Popup manuell setzen.'
      : !r.fields ? 'Keine Eingabefelder erkannt – Vorschläge anklicken zum Kopieren.'
      : `${r.filled} von ${r.fields} Feldern gefüllt.`);
    return r;
  }

  function renderPanel(force) {
    if (!settings.enabled || !settings.showPanel) {
      if (host) host.style.display = 'none';
      return;
    }
    ensurePanel();
    host.style.display = '';

    const letter = detectLetter();
    const topics = detectTopics();

    // Die Seite zeichnet sich z. B. beim Klick in ein Feld neu; dann liefert die Erkennung
    // kurzzeitig nichts oder weniger. Das Panel behält in dem Fall den letzten guten Stand.
    const cats = topics.map((t) => t.category);
    const complete = !!letter && cats.length > 0;
    const lost = lastGood && cats.length < lastGood.cats.length && cats.every((c) => lastGood.cats.includes(c));
    const flicker = lastGood && Date.now() - lastGood.time < GRACE_MS && (!complete || (letter === lastGood.letter && lost));
    if (!force && flicker) return;
    if (complete) lastGood = { time: Date.now(), letter, cats };

    const signature = letter + '|' + cats.join(',') + '|' + shuffleSeed;
    if (!force && signature === lastSignature) return;
    lastSignature = signature;

    root.getElementById('letter').textContent = letter || '?';
    const body = root.getElementById('body');
    body.innerHTML = '';

    if (!letter || !topics.length) {
      const p = document.createElement('div');
      p.className = 'none';
      p.textContent = !letter
        ? 'Buchstabe nicht erkannt – im Popup manuell eingeben.'
        : 'Keine Themen erkannt – sind Felder/Themen auf der Seite sichtbar?';
      body.appendChild(p);
    }

    if (letter) {
      for (const { category, el } of topics) {
        const words = seededShuffle(wordsFor(category, letter), `${shuffleSeed}|${category}|${letter}`)
          .slice(0, CHIPS_PER_TOPIC);
        const box = document.createElement('div');
        box.className = 'topic';
        const h = document.createElement('h4');
        h.textContent = category;
        box.appendChild(h);
        if (!words.length) {
          const n = document.createElement('span');
          n.className = 'none';
          n.textContent = SLF_WORDS[category] ? `keine Vorschläge mit ${letter}` : 'noch keine Wortliste für dieses Thema';
          box.appendChild(n);
        }
        for (const w of words) {
          const chip = document.createElement('span');
          chip.className = 'chip';
          chip.textContent = w;
          chip.title = el ? 'Klicken: ins Feld eintragen & kopieren' : 'Klicken: kopieren';
          chip.addEventListener('mousedown', (e) => e.preventDefault());
          chip.addEventListener('click', () => {
            copyText(w);
            usedWords.add(w);
            if (el && el.isConnected) setValue(el, w);
            setMsg(`„${w}“ ${el ? 'eingetragen & ' : ''}kopiert.`);
          });
          box.appendChild(chip);
        }
        body.appendChild(box);
      }
    }

    const actions = document.createElement('div');
    actions.className = 'actions';
    const fill = document.createElement('button');
    fill.className = 'primary';
    fill.textContent = 'Alle ausfüllen';
    fill.title = 'Alt+F';
    fill.addEventListener('click', doFill);
    const msg = document.createElement('span');
    msg.className = 'msg';
    msg.id = 'msg';
    actions.append(fill, msg);
    body.appendChild(actions);
  }

  // ---------- Vorschläge beim Fokussieren ----------
  function showSuggestions(el, category) {
    const letter = detectLetter();
    const sugg = root.getElementById('sugg');
    const words = letter ? wordsFor(category, letter).slice(0, 8) : [];
    if (!words.length) { sugg.style.display = 'none'; return; }
    sugg.innerHTML = '';
    for (const w of words) {
      const s = document.createElement('span');
      s.textContent = w;
      s.addEventListener('mousedown', (e) => {
        e.preventDefault();
        usedWords.add(w);
        setValue(el, w);
        sugg.style.display = 'none';
      });
      sugg.appendChild(s);
    }
    const r = el.getBoundingClientRect();
    sugg.style.left = Math.max(8, r.left) + 'px';
    sugg.style.top = r.bottom + 4 + 'px';
    sugg.style.maxWidth = Math.max(200, r.width) + 'px';
    sugg.style.display = 'block';
  }

  document.addEventListener('focusin', (e) => {
    if (!settings.enabled || !root) return;
    const el = e.target;
    if (!(el instanceof HTMLElement) || !isFillable(el) || el.closest('#slf-helper-host')) return;
    const category = matchCategory(labelTextFor(el));
    if (category) showSuggestions(el, category);
  });
  document.addEventListener('focusout', () => {
    const s = root && root.getElementById('sugg');
    if (s) setTimeout(() => (s.style.display = 'none'), 150);
  });

  // ---------- Tastenkürzel & Popup-Nachrichten ----------
  document.addEventListener('keydown', (e) => {
    if (settings.enabled && e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      ensurePanel();
      doFill();
    }
  });

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === 'fill') {
      ensurePanel();
      sendResponse(doFill());
    } else if (msg && msg.type === 'status') {
      sendResponse({ letter: detectLetter(), fields: findFields().length, topics: detectTopics().map((t) => t.category) });
    }
  });

  // ---------- Start ----------
  loadSettings().then(() => {
    renderPanel();
    // Buchstabe im Panel aktuell halten, wenn sich die Seite ändert (neue Runde)
    let t;
    new MutationObserver(() => {
      clearTimeout(t);
      t = setTimeout(() => {
        if (!settings.enabled || !settings.showPanel) return;
        const before = lastSignature.split('|')[0];
        if (detectLetter() !== before) usedWords.clear();
        renderPanel();
      }, 300);
    }).observe(document.body, { childList: true, subtree: true, characterData: true });

    // Falls die Seite das Panel entfernt (z. B. beim Neuaufbau), wieder einhängen
    new MutationObserver(() => {
      if (host && !host.isConnected) document.documentElement.appendChild(host);
    }).observe(document.documentElement, { childList: true });
  });
})();
