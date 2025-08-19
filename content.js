// content.js
// PURPOSE (POC): always inject the Trust Feed widget on every page.
// In production, you’d gate by allowed domains; for now we skip that.

/**
 * Notes:
 * - A content script runs in an "isolated world" (separate scope from the page).
 * - We ask the background service worker to run `inject.js` in the page context
 *   (best for Shadow DOM, CSS isolation, and future CSP constraints).
 * - We make everything idempotent so multiple calls don’t double-inject.
 */

(async function main() {
  // 1) Dev defaults (you can replace these later with storage or /widget/config) - we set these defaults as a way to load custom widgets for different sites
  const DEFAULTS = {
    tf_site_id: 'tf_demo_site',
    tf_color: '#5b7cfa'
  };

  // 2) Idempotency guard so this file doesn't run twice on the same page load. Since the widget is being rendered by the manifest file and the popup. This will help the widget from constantly being re-rendered
  // if we are dealing with SPA websites
  const FLAG = '__TF_WIDGET_INJECTION_REQUESTED__';
  if (window[FLAG]) return;
  window[FLAG] = true;

  // 3) Ask the background service worker to execute inject.js in page context
  requestInjection(DEFAULTS);

  // 4) Handle SPA navigations (URL changes without full page reloads)
  hookSpaReinject(() => requestInjection(DEFAULTS));

  // 5) Allow the popup to force-inject on demand (handy while developing)
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'TF_INJECT_NOW') requestInjection(DEFAULTS);
  });

  // ------- helpers -------

  function requestInjection(settings) {
    // Send a message to the background SW; it will run inject.js
    chrome.runtime.sendMessage({ type: 'TF_RUN_INJECT', settings }, (resp) => {
      if (chrome.runtime.lastError) {
        // Happens if the tab navigated mid-injection or SW is asleep — safe to ignore in POC.
        return;
      }
      // console.log('Injected?', resp);
    });
  }

  function hookSpaReinject(onNavigate) {
    let lastUrl = location.href;

    // Patch pushState
    const _pushState = history.pushState;
    history.pushState = function () {
      const ret = _pushState.apply(this, arguments);
      queueIfUrlChanged();
      return ret;
    };

    // Patch replaceState
    const _replaceState = history.replaceState;
    history.replaceState = function () {
      const ret = _replaceState.apply(this, arguments);
      queueIfUrlChanged();
      return ret;
    };

    // Back/forward buttons
    window.addEventListener('popstate', queueIfUrlChanged);

    // Debounce URL-change handling so we don't spam injections
    let pending = null;
    function queueIfUrlChanged() {
      if (lastUrl === location.href) return;
      lastUrl = location.href;
      if (pending) cancelAnimationFrame(pending);
      pending = requestAnimationFrame(() => {
        // We do NOT touch FLAG here; inject.js itself is idempotent.
        onNavigate();
      });
    }
  }
})();