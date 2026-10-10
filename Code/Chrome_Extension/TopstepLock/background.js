// TopstepLock background: minimal message router.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'topstep-lock:execute') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0] || !tabs[0].id) { sendResponse({ ok: false, error: 'no active tab' }); return; }
      chrome.tabs.sendMessage(tabs[0].id, msg, (resp) => {
        sendResponse(resp || { ok: false, error: 'no response from content' });
      });
    });
    return true; // async
  }
});
