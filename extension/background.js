// Öffnet die Optionsseite, wenn das Panel auf der Seite ⚙ anklickt.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'openOptions') chrome.runtime.openOptionsPage();
});
