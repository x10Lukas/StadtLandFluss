const S = SLF_STORE;
const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const RATING = { 1: 'niedrig', 2: 'mittel', 3: 'hoch' };

// ---------- Tabs ----------
for (const btn of document.querySelectorAll('nav button')) {
  btn.addEventListener('click', () => {
    for (const b of document.querySelectorAll('nav button')) b.classList.toggle('active', b === btn);
    for (const s of document.querySelectorAll('section')) s.hidden = s.id !== `tab-${btn.dataset.tab}`;
    render();
  });
}

function allTopics() {
  const names = new Set([...Object.keys(SLF_WORDS), ...Object.keys(S.data.custom)]);
  return [...names].sort((a, b) => a.localeCompare(b, 'de'));
}

function tag(text, small, onclick, title) {
  const t = el('button', 'tag', text);
  if (small) t.append(el('small', null, small));
  if (title) t.title = title;
  t.addEventListener('click', onclick);
  return t;
}

const splitKey = (k) => { const i = k.indexOf('|'); return [k.slice(0, i), k.slice(i + 1)]; };

// ---------- Eigene Wörter ----------
function renderWords() {
  const sel = $('topic');
  const current = sel.value;
  sel.innerHTML = '';
  for (const t of allTopics()) {
    const o = el('option', null, SLF_WORDS[t] ? t : `${t} (eigenes Thema)`);
    o.value = t;
    sel.append(o);
  }
  if (current && [...sel.options].some((o) => o.value === current)) sel.value = current;
  const topic = sel.value;
  $('customWords').value = (S.data.custom[topic] || []).join('\n');
  $('deleteTopic').hidden = !!SLF_WORDS[topic];

  const box = $('learned');
  box.innerHTML = '';
  const learned = S.data.learned[topic] || [];
  if (!learned.length) box.append(el('span', 'empty', 'Noch nichts gelernt.'));
  for (const w of learned) {
    box.append(tag(w, '→ eigene Wörter', () => {
      (S.data.custom[topic] ||= []).push(w);
      S.data.learned[topic] = learned.filter((x) => x !== w);
      S.save();
      renderWords();
    }, 'Klicken: zu den eigenen Wörtern übernehmen'));
  }
  $('clearLearned').hidden = !learned.length;
}

$('topic').addEventListener('change', renderWords);
$('saveWords').addEventListener('click', () => {
  const topic = $('topic').value;
  const words = [...new Set($('customWords').value.split('\n').map((w) => w.trim()).filter(Boolean))];
  if (words.length || !SLF_WORDS[topic]) S.data.custom[topic] = words;
  else delete S.data.custom[topic];
  S.save();
  $('wordsMsg').textContent = `${words.length} Wörter gespeichert.`;
  setTimeout(() => ($('wordsMsg').textContent = ''), 2500);
});
$('addTopic').addEventListener('click', () => {
  const name = $('newTopic').value.trim();
  if (name.length < 3) { $('wordsMsg').textContent = 'Bitte mindestens 3 Zeichen.'; return; }
  if (!S.data.custom[name] && !SLF_WORDS[name]) S.data.custom[name] = [];
  S.save();
  $('newTopic').value = '';
  renderWords();
  $('topic').value = name;
  renderWords();
});
$('deleteTopic').addEventListener('click', () => {
  const topic = $('topic').value;
  if (SLF_WORDS[topic] || !confirm(`Eigenes Thema „${topic}“ mit allen Wörtern löschen?`)) return;
  delete S.data.custom[topic];
  delete S.data.learned[topic];
  S.save();
  renderWords();
});
$('clearLearned').addEventListener('click', () => {
  delete S.data.learned[$('topic').value];
  S.save();
  renderWords();
});

// ---------- Favoriten, Ausgeblendet, Bewertungen ----------
function renderMarks() {
  const fill = (id, obj, label, restore) => {
    const box = $(id);
    box.innerHTML = '';
    const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b, 'de'));
    if (!keys.length) box.append(el('span', 'empty', 'Keine.'));
    for (const k of keys) {
      const [c, w] = splitKey(k);
      box.append(tag(w, `${c}${label ? ' · ' + label(obj[k]) : ''}`, () => { delete obj[k]; S.save(); renderMarks(); }, restore));
    }
  };
  fill('favs', S.data.fav, null, 'Klicken: aus den Favoriten entfernen');
  fill('hidden', S.data.hidden, null, 'Klicken: wieder einblenden');
  fill('rates', S.data.rate, (r) => `Chance ${RATING[r]}`, 'Klicken: ursprüngliche Bewertung wiederherstellen');
}

// ---------- Statistik ----------
function table(rows, head) {
  const t = el('table');
  const tr = el('tr');
  for (const h of head) tr.append(el('th', null, h));
  t.append(tr);
  for (const r of rows) {
    const row = el('tr');
    r.forEach((c, i) => row.append(el('td', i === r.length - 1 ? 'n' : null, String(c))));
    t.append(row);
  }
  return t;
}

function renderStats() {
  const box = $('statsBox');
  box.innerHTML = '';
  const st = S.data.stats;
  const totalUses = Object.values(st.used).reduce((a, b) => a + b, 0);
  const rounds = el('p');
  rounds.append(el('span', 'big', String(st.rounds)), document.createTextNode(` Runden erkannt · ${totalUses} Wörter benutzt`));
  box.append(rounds);
  const topics = Object.entries(st.topics).sort((a, b) => b[1] - a[1]).slice(0, 12);
  if (topics.length) {
    box.append(el('h3', null, 'Häufigste Themen'), table(topics, ['Thema', 'Runden']));
  }
  const words = Object.entries(st.used).sort((a, b) => b[1] - a[1]).slice(0, 20)
    .map(([k, n]) => { const [c, w] = splitKey(k); return [w, c, n]; });
  if (words.length) {
    box.append(el('h3', null, 'Meistbenutzte Wörter'), table(words, ['Wort', 'Thema', 'Mal']));
  }
  if (!topics.length && !words.length) box.append(el('p', 'empty', 'Noch keine Daten – spiel eine Runde mit dem Helfer.'));
}
$('resetStats').addEventListener('click', () => {
  if (!confirm('Statistik wirklich zurücksetzen?')) return;
  S.data.stats = { rounds: 0, topics: {}, used: {} };
  S.save();
  renderStats();
});

// ---------- Daten ----------
$('export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(S.data, null, 2)], { type: 'application/json' });
  const a = el('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'stadt-land-fluss-helfer.json';
  a.click();
  URL.revokeObjectURL(a.href);
});
$('import').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const obj = JSON.parse(await file.text());
    if (typeof obj !== 'object' || !obj) throw new Error('kein Objekt');
    S.replace(obj);
    $('dataMsg').textContent = 'Import erfolgreich.';
    render();
  } catch (err) {
    $('dataMsg').textContent = 'Import fehlgeschlagen: ' + err.message;
  }
  e.target.value = '';
});
$('resetAll').addEventListener('click', () => {
  if (!confirm('Alle eigenen Wörter, Favoriten, Bewertungen und die Statistik löschen?')) return;
  S.replace(S.fresh());
  $('dataMsg').textContent = 'Alles gelöscht.';
  render();
});

function render() {
  renderWords();
  renderMarks();
  renderStats();
}

S.load().then(() => {
  S.onChange(render);
  render();
});
