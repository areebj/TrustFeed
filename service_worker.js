// service_worker.js (MV3)

// 1) Listen for messages from popup.js or content.js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // We only handle one message type in this POC:
  // { type: 'TF_RUN_INJECT', settings: {...} }
  if (msg?.type !== 'TF_RUN_INJECT') return;

  // Safety: make sure we know which tab to inject into
  const tabId = sender?.tab?.id;
  if (!tabId) {
    sendResponse({ ok: false, error: 'No tabId on sender' });
    return;
  }

  // 2) Execute inject.js in the page *context*
  chrome.scripting.executeScript({
    target: { tabId, allFrames: false },
    files: ['inject.js']            // this file will create the widget UI
  }).then(() => {
    // 3) Pass settings (site id / theme color) into the page
    // We do that by running a tiny function in the page that writes data onto <html>
    return chrome.scripting.executeScript({
      target: { tabId },
      func: (settings) => {
        // Make settings available to inject.js via HTML dataset
        // Example: <html data-tf-site-id="..." data-tf-color="#5b7cfa">
        const root = document.documentElement;
        if (settings?.tf_site_id) root.dataset.tfSiteId = settings.tf_site_id;
        if (settings?.tf_color)   root.dataset.tfColor  = settings.tf_color;
      },
      args: [msg.settings || {}]
    });
  }).then(() => {
    // 4) Reply to the sender (optional but nice for debugging)
    sendResponse({ ok: true });
  }).catch((err) => {
    console.error('[TF] injection failed:', err);
    sendResponse({ ok: false, error: String(err) });
  });

  // VERY IMPORTANT in MV3:
  // returning true keeps the message channel open for the async sendResponse above.
  return true;
});

// Optional: keep-alive logs (handy while you’re learning)
// You’ll see these when the SW wakes to handle a message.
self.addEventListener('activate', () => console.log('[TF] SW activate'));
self.addEventListener('install',  () => console.log('[TF] SW install'));