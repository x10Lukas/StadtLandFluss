// Stadt Land Fluss Helfer – Content Script für stadtlandfluss.cool
// Die Seitenstruktur ist nicht fest verdrahtet: Felder werden über ihre Beschriftung
// (label, placeholder, aria-label, name, umgebender Text) einer Kategorie zugeordnet.
(() => {
  'use strict';

  const CATEGORY_PATTERNS = [
    ['Stadt', /stadt|städte|city|ort\b/i],
    ['Land', /\bland\b|länder|country/i],
    ['Fluss', /fluss|flüsse|river|gewässer/i],
    ['Name', /\bname|vorname|person/i],
    ['Tier', /tier|animal/i],
    ['Beruf', /beruf|job|profession/i],
    ['Pflanze', /pflanze|plant|blume|baum/i],
    ['Farbe', /farbe|color|colour/i],
    ['Essen', /essen|speise|food|gericht|lebensmittel/i],
    ['Marke', /marke|brand|firma/i],
    ['Getränk', /getränk|drink|beverage/i],
    ['Gegenstand', /gegenstand|ding\b|objekt|object/i],
    ['Beere', /beere/i],
    ['Berg', /berg|gebirge|mountain/i],
    ['Sportart', /sport/i],
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

  function findFields() {
    const out = [];
    for (const el of document.querySelectorAll('input, textarea')) {
      if (!isFillable(el) || el.closest('#slf-helper-host')) continue;
      const category = matchCategory(labelTextFor(el));
      if (category && SLF_WORDS[category]) out.push({ el, category });
    }
    return out;
  }

  // ---------- Wörter ----------
  function wordsFor(category, letter) {
    const list = (SLF_WORDS[category] || '').split(/\s+/).filter(Boolean);
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
  let host, root, lastLetter = '';

  function ensurePanel() {
    if (host) return;
    host = document.createElement('div');
    host.id = 'slf-helper-host';
    root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host { all: initial; }
        .panel { position: fixed; right: 16px; bottom: 16px; z-index: 2147483647;
          font: 14px/1.3 system-ui, sans-serif; background: #1f2937; color: #f9fafb;
          border-radius: 12px; padding: 10px 12px; box-shadow: 0 6px 24px rgba(0,0,0,.35);
          display: flex; align-items: center; gap: 10px; }
        .letter { font-weight: 700; font-size: 20px; min-width: 26px; text-align: center;
          background: #374151; border-radius: 8px; padding: 2px 6px; }
        button { font: inherit; cursor: pointer; border: 0; border-radius: 8px;
          padding: 6px 10px; background: #10b981; color: #052e1f; font-weight: 600; }
        button:hover { background: #34d399; }
        .msg { font-size: 12px; opacity: .8; max-width: 180px; }
        .sugg { position: fixed; z-index: 2147483647; background: #fff; color: #111;
          border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,.3); padding: 4px;
          font: 13px system-ui, sans-serif; display: none; }
        .sugg span { display: inline-block; padding: 3px 8px; margin: 2px; border-radius: 6px;
          background: #ecfdf5; cursor: pointer; }
        .sugg span:hover { background: #a7f3d0; }
      </style>
      <div class="panel" id="panel">
        <span class="letter" id="letter">?</span>
        <button id="fill" title="Alt+F">Ausfüllen</button>
        <span class="msg" id="msg"></span>
      </div>
      <div class="sugg" id="sugg"></div>`;
    document.documentElement.appendChild(host);
    root.getElementById('fill').addEventListener('click', doFill);
  }

  function setMsg(text) {
    const m = root && root.getElementById('msg');
    if (m) m.textContent = text;
  }

  function doFill() {
    const r = fillAll();
    if (!r.letter) setMsg('Kein Buchstabe erkannt – im Popup manuell setzen.');
    else if (!r.fields) setMsg('Keine Felder erkannt.');
    else setMsg(`${r.filled} von ${r.fields} Feldern gefüllt.`);
    renderPanel();
    return r;
  }

  function renderPanel() {
    if (!settings.enabled || !settings.showPanel) {
      if (host) host.style.display = 'none';
      return;
    }
    ensurePanel();
    host.style.display = '';
    lastLetter = detectLetter();
    root.getElementById('letter').textContent = lastLetter || '?';
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
      sendResponse({ letter: detectLetter(), fields: findFields().length });
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
        const l = detectLetter();
        if (l !== lastLetter) {
          usedWords.clear();
          renderPanel();
        }
      }, 300);
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  });
})();
