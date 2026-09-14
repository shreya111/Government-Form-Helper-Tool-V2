// FormWise dev shim: emulates the chrome.* APIs used by content.js/panel so the extension
// can be exercised on the mock Passport page without installing it. No-op if the real extension is present.
(function () {
  if (window.chrome && window.chrome.runtime && window.chrome.runtime.id) return;

  var API = window.location.origin + '/api';

  async function call(path, body) {
    var res = await fetch(API + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error('API request failed: ' + res.status);
    return res.json();
  }

  window.chrome = {
    runtime: {
      id: 'formwise-dev-shim',
      getURL: function (p) { return '/extension/' + p; },
      sendMessage: async function (msg) {
        try {
          var p = msg.payload || {};
          if (msg.type === 'GET_FORM_HELP') {
            return { success: true, data: await call('/form-help', {
              field_label: p.fieldLabel,
              field_type: p.fieldType,
              field_options: p.fieldOptions || '',
              section_context: p.sectionContext || '',
              help_text: p.helpText || '',
              form_context: p.formContext || 'Indian Passport Application Form'
            }) };
          }
          if (msg.type === 'SEND_CHAT_MESSAGE') {
            return { success: true, data: await call('/chat', {
              message: p.message,
              page_context: p.pageContext,
              chat_history: p.chatHistory || []
            }) };
          }
          return { success: false, error: 'Unknown message type' };
        } catch (e) {
          return { success: false, error: e.message };
        }
      }
    },
    storage: {
      local: {
        get: async function (keys) {
          var out = {};
          (Array.isArray(keys) ? keys : [keys]).forEach(function (k) {
            var v = localStorage.getItem('fw_' + k);
            if (v) out[k] = JSON.parse(v);
          });
          return out;
        },
        set: async function (obj) {
          Object.keys(obj).forEach(function (k) { localStorage.setItem('fw_' + k, JSON.stringify(obj[k])); });
        }
      }
    }
  };
})();
