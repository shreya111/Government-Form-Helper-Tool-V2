// FormWise - Auth relay content script.
// Runs on the FormWise web sign-in callback page (/auth/extension). The page's session cookie is
// httpOnly and, for the panel iframe (chrome-extension:// origin), a blocked third-party cookie.
// So the callback page posts the session token to this content script, which stores it in
// chrome.storage.local. The panel then sends it as an Authorization: Bearer token.
/* global chrome */
(function () {
  'use strict';
  window.addEventListener('message', function (event) {
    if (event.source !== window) return;
    var data = event.data;
    if (!data || data.source !== 'formwise-ext-auth' || !data.token) return;
    try {
      chrome.storage.local.set({ fw_session_token: data.token });
    } catch (_) {}
  });
})();
