// Stadt Land Fluss Helfer – Content Script für stadtlandfluss.cool
// Die Seitenstruktur ist nicht fest verdrahtet: Felder werden über ihre Beschriftung
// (label, placeholder, aria-label, name, umgebender Text) einer Kategorie zugeordnet.
(() => {
  'use strict';

  // Reihenfolge wichtig: spezifische Themen zuerst, allgemeine (Stadt, Land, Name …) zuletzt.
  // Der Themenname muss ein Schlüssel in SLF_WORDS (words.js) sein, um Vorschläge zu liefern.
  const CATEGORY_PATTERNS = [
    ['Red Flags', /red\s*flag/i],
    ['Green Flags', /green\s*flag/i],
    ['Ungewöhnlicher Ort für Sex', /ungewöhnlich|\bsex\b/i],
    ['Fußballverein', /fu(ß|ss)ball\s*-?\s*(verein|club|klub)|\bverein/i],
    ['Kindheitshelden', /kindheit/i],
    ['Songs', /\bsongs?\b|\blieder?\b/i],
    ['Alkohol', /alkohol/i],
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
    ['Spiele', /\bspiele?\b|brettspiel|kartenspiel|gesellschaftsspiel|partyspiel/i],
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

  const DEFAULTS = {
    enabled: true, manualLetter: '', overwrite: false, showPanel: true, count: 4,
    autoFill: false, theme: 'dark', size: 'm', learn: true, hotkeys: true,
  };
  const S = SLF_STORE;
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

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    for (const [k, v] of Object.entries(changes)) settings[k] = v.newValue;
    renderPanel(true);
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
    if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return false;
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
    // Eigene Themen (in den Optionen angelegt) zuerst: Name steckt in der Beschriftung
    const lower = text.toLowerCase();
    for (const name of Object.keys(S.data.custom)) {
      if (!SLF_WORDS[name] && name.length >= 3 && lower.includes(name.toLowerCase())) return name;
    }
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
  const RATING_TEXT = {
    1: 'Chance niedrig – wahrscheinlich schreibt das kaum jemand sonst',
    2: 'Chance mittel – manche schreiben das auch',
    3: 'Chance hoch – viele schreiben das auch',
  };
  const normLetter = (c) => c.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

  // Bewertung nach Platz in der Liste des Buchstabens: vorn = naheliegend = andere schreiben es auch.
  // 3 = hoch, 2 = mittel, 1 = niedrig, 0 = keine Bewertung (Liste ungeordnet).
  function rateAt(i, n) {
    if (n === 1) return 3;
    const f = (i + 0.5) / n;
    return f < 1 / 3 ? 3 : f < 2 / 3 ? 2 : 1;
  }

  // Alle Wörter eines Themas zum Buchstaben: eingebaute Liste + eigene + gelernte,
  // ohne ausgeblendete; mit persönlicher Bewertung und Favoriten-Markierung.
  function wordsFor(category, letter) {
    const d = S.data;
    const entry = SLF_WORDS[category];
    const L = normLetter(letter);
    const base = (entry && entry.w && entry.w[L]) || [];
    const out = [];
    const seen = new Set();
    const push = (w, r, own) => {
      const lower = w.toLowerCase();
      if (seen.has(lower)) return;
      seen.add(lower);
      const key = S.key(category, w);
      if (d.hidden[key]) return;
      out.push({ w, r: d.rate[key] || r, own, fav: !!d.fav[key] });
    };
    base.forEach((w, i) => push(w, entry.rated ? rateAt(i, base.length) : 0, false));
    const ownR = entry && entry.rated ? 2 : 0;
    for (const list of [d.custom[category], d.learned[category]]) {
      for (const w of list || []) if (w && normLetter(w[0]) === L) push(w, ownR, true);
    }
    return out;
  }

  // Wählt n Vorschläge: erst Favoriten, dann gemischt aus allen Bewertungsstufen
  // (mittel, niedrig, hoch, …); innerhalb der Auswahl mit den „eigenständigsten“ zuerst.
  function pickSuggestions(items, n, seedStr) {
    const favs = seededShuffle(items.filter((i) => i.fav), `${seedStr}|fav`).slice(0, n);
    const tiers = { 0: [], 1: [], 2: [], 3: [] };
    for (const it of items) if (!it.fav) tiers[it.r].push(it);
    for (const k of Object.keys(tiers)) tiers[k] = seededShuffle(tiers[k], `${seedStr}|${k}`);
    const order = [2, 1, 3, 0];
    const picked = [];
    while (favs.length + picked.length < n && order.some((t) => tiers[t].length)) {
      for (const t of order) {
        if (favs.length + picked.length >= n) break;
        const x = tiers[t].shift();
        if (x) picked.push(x);
      }
    }
    return [...favs, ...picked.sort((a, b) => a.r - b.r)];
  }

  function pickWord(category, letter) {
    const pool = wordsFor(category, letter);
    const fresh = pool.filter((x) => !usedWords.has(x.w));
    const src = fresh.length ? fresh : pool;
    const favs = src.filter((x) => x.fav);
    if (favs.length) return favs[Math.floor(Math.random() * favs.length)].w;
    for (const tier of [2, 1, 0, 3]) {
      const c = src.filter((x) => x.r === tier);
      if (c.length) return c[Math.floor(Math.random() * c.length)].w;
    }
    return '';
  }

  // ---------- Statistik & Lernen ----------
  function recordUse(category, word) {
    const u = S.data.stats.used;
    const k = S.key(category, word);
    u[k] = (u[k] || 0) + 1;
    S.save();
  }

  function recordRound(topics) {
    const st = S.data.stats;
    st.rounds++;
    for (const t of topics) st.topics[t.category] = (st.topics[t.category] || 0) + 1;
    S.save();
  }

  // Eigene Eingaben, die noch nicht in den Listen stehen, werden für den Buchstaben gemerkt.
  function learnWord(category, word) {
    const letter = detectLetter();
    if (!letter || normLetter(word[0]) !== normLetter(letter)) return;
    const lower = word.toLowerCase();
    const known = [
      ...(((SLF_WORDS[category] || {}).w || {})[normLetter(letter)] || []),
      ...(S.data.custom[category] || []),
      ...(S.data.learned[category] || []),
    ];
    if (known.some((w) => w.toLowerCase() === lower)) return;
    const list = (S.data.learned[category] ||= []);
    list.push(word);
    if (list.length > 500) list.shift();
    S.save();
  }

  let internalSet = false;
  function setValue(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    internalSet = true;
    try {
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } finally {
      internalSet = false;
    }
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
      recordUse(category, word);
      setValue(el, word);
      filled++;
    }
    return { letter, filled, fields: fields.length };
  }

  // ---------- Panel (Shadow DOM) ----------
  let host, root, lastSignature = '';
  let collapsed = false;
  let shuffleSeed = 0;
  let lastGood = null;
  let searchTerm = '';
  const expandedCats = new Set();
  const cycle = {};
  const GRACE_MS = 30000;
  const SIZES = ['s', 'm', 'l'];
  const THEMES = ['dark', 'light', 'auto'];

  const PANEL_CSS = `
    :host { all: initial; }
    .panel { --bg:#1f2937; --fg:#f9fafb; --muted:#9ca3af; --btn:#374151; --btnh:#4b5563;
      --chip:#064e3b; --chipfg:#d1fae5; --chiph:#047857; --input:#111827; --acc:#10b981; --acch:#34d399; --accfg:#052e1f;
      position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; width: 300px;
      max-height: 75vh; overflow: auto; font: 14px/1.3 system-ui, sans-serif;
      background: var(--bg); color: var(--fg); border-radius: 12px; padding: 10px 12px;
      box-shadow: 0 6px 24px rgba(0,0,0,.35); box-sizing: border-box; }
    .panel.light { --bg:#ffffff; --fg:#111827; --muted:#6b7280; --btn:#e5e7eb; --btnh:#d1d5db;
      --chip:#ecfdf5; --chipfg:#065f46; --chiph:#a7f3d0; --input:#f3f4f6; box-shadow: 0 6px 24px rgba(0,0,0,.25); }
    .panel.s { width: 250px; font-size: 12px; }
    .panel.l { width: 400px; font-size: 16px; }
    .head { display: flex; align-items: center; gap: 8px; cursor: move; user-select: none; }
    .letter { font-weight: 700; font-size: 1.4em; min-width: 26px; text-align: center;
      background: var(--btn); border-radius: 8px; padding: 2px 6px; }
    .title { flex: 1; font-weight: 600; }
    button { font: inherit; cursor: pointer; border: 0; border-radius: 8px; padding: 4px 8px;
      background: var(--btn); color: var(--fg); }
    button:hover { background: var(--btnh); }
    button.primary { background: var(--acc); color: var(--accfg); font-weight: 600; }
    button.primary:hover { background: var(--acch); }
    button.on { background: var(--acc); color: var(--accfg); }
    button.mini { padding: 0 6px; font-size: .85em; margin-left: 4px; line-height: 1.5; }
    input[type=search] { width: 100%; box-sizing: border-box; margin-top: 8px; padding: 5px 8px; border: 0;
      border-radius: 8px; background: var(--input); color: var(--fg); font: inherit; outline: none; }
    .body { margin-top: 6px; }
    .topic { margin: 8px 0; }
    .topic h4 { margin: 0 0 4px; font-size: .85em; text-transform: uppercase; letter-spacing: .04em; color: var(--muted);
      display: flex; align-items: center; }
    .topic h4 .num { background: var(--btn); border-radius: 4px; padding: 0 5px; margin-right: 6px; color: var(--fg); }
    .topic h4 .grow { flex: 1; }
    .all { max-height: 200px; overflow: auto; }
    .chip { display: inline-block; margin: 2px 4px 2px 0; padding: 3px 9px; border-radius: 8px;
      background: var(--chip); color: var(--chipfg); cursor: pointer; font-size: .95em; }
    .chip:hover { background: var(--chiph); }
    .chip.r1 { box-shadow: inset 4px 0 0 #34d399; padding-left: 12px; }
    .chip.r2 { box-shadow: inset 4px 0 0 #fbbf24; padding-left: 12px; }
    .chip.r3 { box-shadow: inset 4px 0 0 #f87171; padding-left: 12px; }
    .chip .acts { display: none; margin-left: 6px; }
    .chip:hover .acts { display: inline; }
    .chip .acts b { font-weight: 400; opacity: .7; padding: 0 2px; }
    .chip .acts b:hover { opacity: 1; }
    .legend { font-size: .8em; color: var(--muted); margin-top: 8px; }
    .lg { display: inline-block; margin-left: 6px; padding: 0 6px 0 9px; border-radius: 4px; background: var(--btn); color: var(--fg); }
    .lg.r1 { box-shadow: inset 3px 0 0 #34d399; }
    .lg.r2 { box-shadow: inset 3px 0 0 #fbbf24; }
    .lg.r3 { box-shadow: inset 3px 0 0 #f87171; }
    .none, .msg { font-size: .85em; opacity: .75; }
    .actions { display: flex; gap: 6px; margin-top: 8px; align-items: center; flex-wrap: wrap; }
    .toolbar { display: flex; gap: 6px; margin-top: 8px; }
    .toolbar button { flex: 1; padding: 3px 4px; font-size: .85em; }
    .sugg { position: fixed; z-index: 2147483647; background: #fff; color: #111;
      border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,.3); padding: 4px;
      font: 13px system-ui, sans-serif; display: none; pointer-events: none; }
    .sugg span { display: inline-block; padding: 3px 8px; margin: 2px; border-radius: 6px;
      background: #ecfdf5; cursor: pointer; pointer-events: auto; }
    .sugg span.r1 { box-shadow: inset 4px 0 0 #10b981; padding-left: 12px; }
    .sugg span.r2 { box-shadow: inset 4px 0 0 #f59e0b; padding-left: 12px; }
    .sugg span.r3 { box-shadow: inset 4px 0 0 #ef4444; padding-left: 12px; }
    .sugg span:hover { background: #a7f3d0; }`;

  function ensurePanel() {
    if (host) return;
    host = document.createElement('div');
    host.id = 'slf-helper-host';
    root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>${PANEL_CSS}</style>
      <div class="panel" id="panel">
        <div class="head" id="head" title="Ziehen zum Verschieben, Doppelklick = zurücksetzen">
          <span class="letter" id="letter">?</span>
          <span class="title">Lösungsvorschläge</span>
          <button id="shuffle" title="Neue Vorschläge (Alt+R)">⟳</button>
          <button id="toggle" title="Ein-/Ausklappen (Alt+H)">–</button>
        </div>
        <div id="main">
          <input type="search" id="search" placeholder="Wörter suchen …" autocomplete="off">
          <div class="body" id="body"></div>
          <div class="toolbar" id="toolbar"></div>
        </div>
      </div>
      <div class="sugg" id="sugg"></div>`;
    document.documentElement.appendChild(host);

    root.getElementById('shuffle').addEventListener('click', () => { shuffleSeed++; renderPanel(true); });
    root.getElementById('toggle').addEventListener('click', () => setCollapsed(!collapsed));

    const search = root.getElementById('search');
    search.addEventListener('input', () => { searchTerm = search.value.trim().toLowerCase(); renderPanel(true); });
    // Tastatureingaben im Suchfeld dürfen nicht bei der Seite ankommen (Spiel-Tastenkürzel)
    for (const type of ['keydown', 'keyup', 'keypress']) {
      search.addEventListener(type, (e) => e.stopPropagation());
    }
    setupDrag();
    applyPos();
  }

  function setCollapsed(value) {
    collapsed = value;
    if (!root) return;
    root.getElementById('main').style.display = collapsed ? 'none' : '';
    root.getElementById('toggle').textContent = collapsed ? '+' : '–';
  }

  function applyLook() {
    const panel = root.getElementById('panel');
    const dark = settings.theme === 'auto' ? matchMedia('(prefers-color-scheme: dark)').matches : settings.theme !== 'light';
    panel.classList.toggle('light', !dark);
    for (const s of SIZES) panel.classList.toggle(s, settings.size === s);
  }

  // ---------- Panel verschieben ----------
  function applyPos() {
    const panel = root && root.getElementById('panel');
    const pos = S.data.pos;
    if (!panel) return;
    if (!pos) {
      panel.style.left = panel.style.top = '';
      panel.style.right = panel.style.bottom = '';
      return;
    }
    const x = Math.min(Math.max(0, pos.x), Math.max(0, innerWidth - 80));
    const y = Math.min(Math.max(0, pos.y), Math.max(0, innerHeight - 40));
    panel.style.left = x + 'px';
    panel.style.top = y + 'px';
    panel.style.right = panel.style.bottom = 'auto';
  }

  function setupDrag() {
    const head = root.getElementById('head');
    const panel = root.getElementById('panel');
    head.addEventListener('dblclick', (e) => {
      if (e.target.closest('button')) return;
      S.data.pos = null;
      S.save();
      applyPos();
    });
    head.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || e.target.closest('button')) return;
      const r = panel.getBoundingClientRect();
      const dx = e.clientX - r.left;
      const dy = e.clientY - r.top;
      const move = (ev) => {
        S.data.pos = { x: ev.clientX - dx, y: ev.clientY - dy };
        applyPos();
      };
      const up = () => {
        removeEventListener('mousemove', move, true);
        removeEventListener('mouseup', up, true);
        S.save();
      };
      addEventListener('mousemove', move, true);
      addEventListener('mouseup', up, true);
      e.preventDefault();
    });
    addEventListener('resize', applyPos);
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

  const mk = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  function saveSetting(patch) {
    Object.assign(settings, patch);
    try { chrome.storage.sync.set(patch); } catch (e) { /* ignorieren */ }
    renderPanel(true);
  }

  function makeChip(item, category, el) {
    const { w, r, own, fav } = item;
    const chip = mk('span', 'chip' + (r ? ` r${r}` : ''));
    chip.append(mk('span', 't', (fav ? '★ ' : '') + w + (own ? ' ✎' : '')));
    chip.title = (r ? RATING_TEXT[r] + '\n' : '') + (own ? 'Eigenes Wort\n' : '') +
      (el ? 'Klicken: ins Feld eintragen & kopieren' : 'Klicken: kopieren');

    const acts = mk('span', 'acts');
    const star = mk('b', null, fav ? '☆' : '★');
    star.title = fav ? 'Favorit entfernen' : 'Als Favorit merken (wird immer vorgeschlagen)';
    const rate = mk('b', null, '◐');
    rate.title = 'Bewertung ändern: niedrig → mittel → hoch';
    const hide = mk('b', null, '✕');
    hide.title = 'Ausblenden (in den Optionen wiederherstellbar)';
    acts.append(star, rate, hide);
    chip.append(acts);

    const key = S.key(category, w);
    const act = (fn) => (e) => { e.stopPropagation(); fn(); S.save(); renderPanel(true); };
    star.addEventListener('click', act(() => { if (fav) delete S.data.fav[key]; else S.data.fav[key] = 1; }));
    rate.addEventListener('click', act(() => { S.data.rate[key] = (r % 3) + 1; }));
    hide.addEventListener('click', act(() => { S.data.hidden[key] = 1; }));

    chip.addEventListener('mousedown', (e) => e.preventDefault());
    chip.addEventListener('click', () => {
      copyText(w);
      usedWords.add(w);
      recordUse(category, w);
      if (el && el.isConnected) setValue(el, w);
      setMsg(`„${w}“ ${el ? 'eingetragen & ' : ''}kopiert.`);
    });
    return chip;
  }

  function addOwnWord(category, letter) {
    let w;
    try { w = prompt(`Eigenes Wort für „${category}“ hinzufügen:`, ''); } catch (e) { return; }
    w = (w || '').trim();
    if (!w) return;
    const list = (S.data.custom[category] ||= []);
    if (!list.some((x) => x.toLowerCase() === w.toLowerCase())) list.push(w);
    S.save();
    renderPanel(true);
    setMsg(normLetter(w[0]) === normLetter(letter) ? `„${w}“ gespeichert.` : `„${w}“ gespeichert (für Buchstabe ${normLetter(w[0])}).`);
  }

  function renderPanel(force) {
    if (!settings.enabled || !settings.showPanel) {
      if (host) host.style.display = 'none';
      return;
    }
    ensurePanel();
    host.style.display = '';
    applyLook();

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

    const signature = [letter, cats.join(','), shuffleSeed, settings.count, settings.autoFill, settings.size,
      settings.theme, searchTerm, [...expandedCats].join(',')].join('|');
    if (!force && signature === lastSignature) return;
    lastSignature = signature;

    root.getElementById('letter').textContent = letter || '?';
    const body = root.getElementById('body');
    body.innerHTML = '';

    if (!letter || !topics.length) {
      body.appendChild(mk('div', 'none', !letter
        ? 'Buchstabe nicht erkannt – im Popup manuell eingeben.'
        : 'Keine Themen erkannt – sind Felder/Themen auf der Seite sichtbar?'));
    }

    let anyRated = false;
    let anyShown = false;
    const topicsBox = document.createElement('div');
    if (letter) {
      topics.forEach(({ category, el }, idx) => {
        const items = wordsFor(category, letter);
        let shown;
        let showAll = false;
        if (searchTerm) { shown = items.filter((i) => i.w.toLowerCase().includes(searchTerm)); showAll = true; }
        else if (expandedCats.has(category)) { shown = items; showAll = true; }
        else shown = pickSuggestions(items, settings.count, `${shuffleSeed}|${category}|${letter}`);
        if (searchTerm && !shown.length) return;
        anyShown = true;
        if (shown.some((x) => x.r)) anyRated = true;

        const box = mk('div', 'topic');
        const h = mk('h4');
        if (idx < 9) h.append(mk('span', 'num', String(idx + 1)));
        h.append(mk('span', 'grow', category));
        const add = mk('button', 'mini', '+');
        add.title = 'Eigenes Wort zu diesem Thema hinzufügen';
        add.addEventListener('click', () => addOwnWord(category, letter));
        const more = mk('button', 'mini', expandedCats.has(category) ? '▴' : '▾');
        more.title = `Alle ${items.length} Wörter mit ${letter} anzeigen/ausblenden`;
        more.addEventListener('click', () => {
          if (expandedCats.has(category)) expandedCats.delete(category); else expandedCats.add(category);
          renderPanel(true);
        });
        h.append(add, more);
        box.appendChild(h);

        if (!shown.length) {
          box.appendChild(mk('span', 'none', SLF_WORDS[category] || S.data.custom[category]
            ? `keine Vorschläge mit ${letter}` : 'noch keine Wortliste für dieses Thema – mit + eigene Wörter hinzufügen'));
        }
        const list = showAll ? mk('div', 'all') : box;
        for (const item of shown) list.appendChild(makeChip(item, category, el));
        if (showAll) box.appendChild(list);
        topicsBox.appendChild(box);
      });
    }
    if (searchTerm && letter && !anyShown) body.appendChild(mk('div', 'none', 'Keine Treffer für diesen Buchstaben.'));

    if (anyRated) {
      const legend = mk('div', 'legend', 'Chance, dass andere es auch schreiben: ');
      for (const [c, t] of [['r1', 'niedrig'], ['r2', 'mittel'], ['r3', 'hoch']]) legend.append(mk('span', `lg ${c}`, t));
      body.appendChild(legend);
    }
    body.appendChild(topicsBox);

    const actions = mk('div', 'actions');
    const fill = mk('button', 'primary', 'Alle ausfüllen');
    fill.title = 'Alt+F';
    fill.addEventListener('click', doFill);
    const msg = mk('span', 'msg');
    msg.id = 'msg';
    actions.append(fill, msg);
    body.appendChild(actions);

    renderToolbar();
  }

  function renderToolbar() {
    const bar = root.getElementById('toolbar');
    bar.innerHTML = '';
    const auto = mk('button', settings.autoFill ? 'on' : '', `Auto: ${settings.autoFill ? 'an' : 'aus'}`);
    auto.title = 'Bei jeder neuen Runde automatisch ausfüllen';
    auto.addEventListener('click', () => saveSetting({ autoFill: !settings.autoFill }));
    const size = mk('button', '', 'Aa');
    size.title = `Größe: ${{ s: 'klein', m: 'mittel', l: 'groß' }[settings.size]} (klicken zum Wechseln)`;
    size.addEventListener('click', () => saveSetting({ size: SIZES[(SIZES.indexOf(settings.size) + 1) % SIZES.length] }));
    const theme = mk('button', '', '◐');
    theme.title = `Design: ${{ dark: 'dunkel', light: 'hell', auto: 'automatisch' }[settings.theme]} (klicken zum Wechseln)`;
    theme.addEventListener('click', () => saveSetting({ theme: THEMES[(THEMES.indexOf(settings.theme) + 1) % THEMES.length] }));
    const opts = mk('button', '', '⚙');
    opts.title = 'Optionen: eigene Wörter, Favoriten, Statistik';
    opts.addEventListener('click', () => {
      try { chrome.runtime.sendMessage({ type: 'openOptions' }); } catch (e) { /* Extension neu geladen */ }
    });
    bar.append(auto, size, theme, opts);
  }

  // ---------- Vorschläge beim Fokussieren ----------
  function showSuggestions(el, category) {
    const letter = detectLetter();
    const sugg = root.getElementById('sugg');
    const words = letter
      ? pickSuggestions(wordsFor(category, letter), Math.max(settings.count, 6), `${shuffleSeed}|${category}|${letter}`)
      : [];
    if (!words.length) { sugg.style.display = 'none'; return; }
    sugg.innerHTML = '';
    for (const { w, r, fav } of words) {
      const s = document.createElement('span');
      if (r) { s.className = `r${r}`; s.title = RATING_TEXT[r]; }
      s.textContent = (fav ? '★ ' : '') + w;
      s.addEventListener('mousedown', (e) => {
        e.preventDefault();
        usedWords.add(w);
        recordUse(category, w);
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

  let hideTimer;
  document.addEventListener('focusin', (e) => {
    // Ein noch ausstehendes Ausblenden vom vorherigen Feld darf das neue Fenster nicht schließen
    clearTimeout(hideTimer);
    if (!settings.enabled || !root) return;
    const el = e.target;
    if (!(el instanceof HTMLElement) || !isFillable(el) || el.closest('#slf-helper-host')) return;
    const category = matchCategory(labelTextFor(el));
    if (category) showSuggestions(el, category);
    else hideSuggestions();
  });
  document.addEventListener('focusout', () => {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideSuggestions, 150);
  });
  document.addEventListener('scroll', () => hideSuggestions(), true);

  function hideSuggestions() {
    const s = root && root.getElementById('sugg');
    if (s) s.style.display = 'none';
  }

  // Eigene Eingaben mitzählen und neue Wörter lernen (nur echte Eingaben, nicht unsere eigenen)
  document.addEventListener('change', (e) => {
    if (internalSet || !settings.enabled) return;
    const el = e.target;
    if (!(el instanceof HTMLElement) || !isFillable(el) || el.closest('#slf-helper-host')) return;
    const value = (el.value || '').trim();
    if (value.length < 2) return;
    const category = matchCategory(labelTextFor(el)) || cleanLabel(el);
    if (!category) return;
    recordUse(category, value);
    if (settings.learn) learnWord(category, value);
  }, true);

  // ---------- Tastenkürzel & Popup-Nachrichten ----------
  function fillTopic(n) {
    const letter = detectLetter();
    const t = detectTopics()[n - 1];
    if (!letter || !t) return;
    ensurePanel();
    const items = wordsFor(t.category, letter);
    if (!items.length) { setMsg(`Keine Vorschläge für „${t.category}“ mit ${letter}.`); return; }
    const ordered = pickSuggestions(items, items.length, `${shuffleSeed}|${t.category}|${letter}`);
    cycle[t.category] = ((cycle[t.category] ?? -1) + 1) % ordered.length;
    const w = ordered[cycle[t.category]].w;
    usedWords.add(w);
    recordUse(t.category, w);
    if (t.el && t.el.isConnected) setValue(t.el, w);
    else copyText(w);
    setMsg(`${t.category}: „${w}“`);
  }

  document.addEventListener('keydown', (e) => {
    if (!settings.enabled || !settings.hotkeys || !e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.code === 'KeyF') {
      e.preventDefault();
      ensurePanel();
      doFill();
    } else if (e.code === 'KeyR') {
      e.preventDefault();
      shuffleSeed++;
      renderPanel(true);
    } else if (e.code === 'KeyH') {
      e.preventDefault();
      ensurePanel();
      setCollapsed(!collapsed);
    } else if (/^Digit[1-9]$/.test(e.code)) {
      e.preventDefault();
      fillTopic(Number(e.code.slice(5)));
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

  // ---------- Neue Runde erkennen (Automatik, Statistik) ----------
  const seenFields = new WeakSet();
  let roundLetter = '';
  let lastRoundAt = 0;

  function checkNewRound() {
    if (!settings.enabled) return;
    const letter = detectLetter();
    const topics = detectTopics();
    if (!letter || !topics.length) return;
    const withEl = topics.filter((t) => t.el);
    const allFresh = withEl.length > 0 && withEl.every((t) => !seenFields.has(t.el));
    const allEmpty = withEl.every((t) => !t.el.value);
    for (const t of withEl) seenFields.add(t.el);
    const letterChanged = letter !== roundLetter;
    roundLetter = letter;
    // Neue Felder allein (Seite zeichnet neu) zählen nur als neue Runde, wenn alle leer sind
    // und die letzte Runde schon länger her ist.
    const newRound = letterChanged || (allFresh && allEmpty && Date.now() - lastRoundAt > 20000);
    if (!newRound) return;
    lastRoundAt = Date.now();
    usedWords.clear();
    for (const k of Object.keys(cycle)) delete cycle[k];
    recordRound(topics);
    if (settings.autoFill) setTimeout(() => { fillAll(); renderPanel(true); }, 400);
  }

  // ---------- Start ----------
  Promise.all([loadSettings(), S.load()]).then(() => {
    S.onChange(() => renderPanel(true));
    renderPanel();
    checkNewRound();
    // Panel aktuell halten, wenn sich die Seite ändert (neue Runde)
    let t;
    new MutationObserver(() => {
      clearTimeout(t);
      t = setTimeout(() => {
        if (!settings.enabled) return;
        if (settings.showPanel) renderPanel();
        checkNewRound();
      }, 300);
    }).observe(document.body, { childList: true, subtree: true, characterData: true });

    // Falls die Seite das Panel entfernt (z. B. beim Neuaufbau), wieder einhängen
    new MutationObserver(() => {
      if (host && !host.isConnected) document.documentElement.appendChild(host);
    }).observe(document.documentElement, { childList: true });
  });
})();
