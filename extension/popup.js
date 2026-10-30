const DEFAULTS = {
  enabled: true, manualLetter: '', overwrite: false, showPanel: true, count: 4,
  autoFill: false, theme: 'dark', size: 'm', learn: true, hotkeys: true,
};
const CHECKS = ['enabled', 'showPanel', 'overwrite', 'autoFill', 'learn', 'hotkeys'];
const SELECTS = { count: Number, theme: String, size: String };
const $ = (id) => document.getElementById(id);

function withTab(cb) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => cb(tabs[0]));
}

function sendToTab(message, cb) {
  withTab((tab) => {
    if (!tab || !tab.id) return cb && cb(null);
    chrome.tabs.sendMessage(tab.id, message, (res) => {
      void chrome.runtime.lastError; // Seite ohne Content Script
      cb && cb(res || null);
    });
  });
}

function refreshStatus() {
  sendToTab({ type: 'status' }, (res) => {
    $('status').textContent = res
      ? `Buchstabe: ${res.letter || 'nicht erkannt'} · Themen: ${(res.topics || []).join(', ') || 'keine erkannt'}`
      : 'Öffne stadtlandfluss.cool, um den Helfer zu nutzen.';
  });
}

chrome.storage.sync.get(DEFAULTS, (s) => {
  for (const k of CHECKS) $(k).checked = s[k];
  for (const k of Object.keys(SELECTS)) $(k).value = String(s[k]);
  $('manualLetter').value = s.manualLetter;
  refreshStatus();
});

for (const key of CHECKS) {
  $(key).addEventListener('change', () => {
    chrome.storage.sync.set({ [key]: $(key).checked }, refreshStatus);
  });
}
for (const [key, conv] of Object.entries(SELECTS)) {
  $(key).addEventListener('change', () => chrome.storage.sync.set({ [key]: conv($(key).value) }));
}
$('manualLetter').addEventListener('input', () => {
  const v = $('manualLetter').value.trim().toUpperCase();
  $('manualLetter').value = v;
  chrome.storage.sync.set({ manualLetter: v }, () => setTimeout(refreshStatus, 100));
});
$('fill').addEventListener('click', () => {
  sendToTab({ type: 'fill' }, (res) => {
    $('status').textContent = res
      ? res.letter
        ? `${res.filled} von ${res.fields} Feldern gefüllt (Buchstabe ${res.letter}).`
        : 'Kein Buchstabe erkannt – bitte manuell setzen.'
      : 'Öffne stadtlandfluss.cool, um den Helfer zu nutzen.';
  });
});
$('options').addEventListener('click', () => chrome.runtime.openOptionsPage());
