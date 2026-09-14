// FormWise - Background Service Worker
/* global chrome, importScripts, FORMWISE_API_BASE_URL */

importScripts('config.js');
const API_BASE_URL = FORMWISE_API_BASE_URL;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_FORM_HELP') {
    fetchFormHelp(request.payload)
      .then(response => sendResponse({ success: true, data: response }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.type === 'SEND_CHAT_MESSAGE') {
    sendChatMessage(request.payload)
      .then(response => sendResponse({ success: true, data: response }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // Sign-in happens on the FormWise web origin; the session cookie is then sent by the panel's fetches.
  if (request.type === 'OPEN_TAB' && typeof request.url === 'string' && /^https:\/\//.test(request.url)) {
    chrome.tabs.create({ url: request.url })
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

async function fetchFormHelp(payload) {
  const response = await fetch(`${API_BASE_URL}/form-help`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      field_label: payload.fieldLabel,
      field_type: payload.fieldType,
      field_options: payload.fieldOptions || '',
      section_context: payload.sectionContext || '',
      help_text: payload.helpText || '',
      form_context: payload.formContext || 'Indian Passport Application Form',
      language: payload.language || 'en'
    })
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json();
}

async function sendChatMessage(payload) {
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: payload.message,
      page_context: payload.pageContext,
      chat_history: payload.chatHistory || [],
      language: payload.language || 'en'
    })
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json();
}

chrome.runtime.onInstalled.addListener((details) => {
  console.log('FormWise installed:', details.reason);
});
