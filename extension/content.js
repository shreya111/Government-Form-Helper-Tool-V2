// FormWise - Content Script
// Real-time DOM detection for Passport Seva and government forms

(function() {
  'use strict';

  const CONFIG = {
    debounceDelay: 400,
    formContext: 'Indian Passport Application Form (Passport Seva Portal)'
  };

  let state = {
    isPanelVisible: false,
    isLoading: false,
    activeField: null,
    activeElement: null,
    response: null,
    selectedOption: null,
    error: null,
    detectedOptions: null,
    detectedQuestion: null,
    // Chat state
    activeTab: 'field-help', // 'field-help' or 'chat'
    chatMessages: [],
    chatInput: '',
    isChatLoading: false,
    chatError: null
  };

  let helperPanel = null;
  let debounceTimer = null;

  function init() {
    console.log('FormWise: Initializing real-time DOM detection...');
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setup);
    } else {
      setup();
    }
  }

  function setup() {
    createHelperPanel();
    attachGlobalListeners();
    loadChatHistory();
    console.log('FormWise: Ready - click any form field or use chat');
  }

  // Load chat history from storage
  async function loadChatHistory() {
    try {
      const domain = window.location.hostname;
      const result = await chrome.storage.local.get([`chat_${domain}`]);
      if (result[`chat_${domain}`]) {
        state.chatMessages = result[`chat_${domain}`];
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  }

  // Save chat history to storage
  async function saveChatHistory() {
    try {
      const domain = window.location.hostname;
      await chrome.storage.local.set({ [`chat_${domain}`]: state.chatMessages });
    } catch (error) {
      console.error('Error saving chat history:', error);
    }
  }

  // Extract page context for AI
  function extractPageContext() {
    // Get all visible text content
    const bodyText = document.body.innerText || '';
    
    // Get form field data
    const formData = {};
    document.querySelectorAll('input, select, textarea').forEach(el => {
      if (el.closest('#gov-helper-panel')) return; // Skip our own panel
      const name = el.name || el.id;
      const value = el.value;
      if (name && value) {
        formData[name] = value;
      }
    });
    
    return {
      page_title: document.title,
      page_url: window.location.href,
      form_data: formData,
      page_text: bodyText.substring(0, 8000) // Limit to 8000 chars
    };
  }

  function attachGlobalListeners() {
    // Use capture phase to catch events early
    document.addEventListener('focusin', handleFieldInteraction, true);
    document.addEventListener('click', handleFieldInteraction, true);
    document.addEventListener('change', handleFieldInteraction, true);
  }

  function handleFieldInteraction(event) {
    const element = event.target;
    
    // Check if it's a form element
    if (isFormElement(element)) {
      triggerHelp(element);
      return;
    }
    
    // Check if clicked on a label
    if (element.tagName.toLowerCase() === 'label') {
      const forId = element.getAttribute('for');
      if (forId) {
        const input = document.getElementById(forId);
        if (input) triggerHelp(input);
      }
      return;
    }
    
    // Check if clicked inside a table cell containing form elements
    const cell = element.closest('td, th');
    if (cell) {
      const formEl = cell.querySelector('input, select, textarea');
      if (formEl && isFormElement(formEl)) {
        triggerHelp(formEl);
      }
    }
  }

  function isFormElement(element) {
    if (!element || element.closest('#gov-helper-panel')) return false;
    const tagName = element.tagName?.toLowerCase();
    const type = element.type?.toLowerCase();
    
    if (tagName === 'input') {
      const excluded = ['hidden', 'submit', 'button', 'reset', 'image'];
      return !excluded.includes(type);
    }
    return tagName === 'select' || tagName === 'textarea';
  }

  function triggerHelp(element) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      processField(element);
    }, CONFIG.debounceDelay);
  }

  // Main function - detect everything from DOM
  async function processField(element) {
    // Extract all information from DOM
    const fieldInfo = extractFieldInfoFromDOM(element);
    
    if (!fieldInfo.question || fieldInfo.question.length < 3) {
      console.log('FormWise: Could not detect question for field');
      return;
    }
    
    console.log('FormWise: Detected -', fieldInfo);
    
    state.activeField = fieldInfo.question;
    state.activeElement = element;
    state.detectedOptions = fieldInfo.options;
    state.detectedQuestion = fieldInfo.question;
    state.isLoading = true;
    state.response = null;
    state.error = null;
    state.selectedOption = null;
    
    showPanel();
    highlightField(element);
    updatePanelContent();
    
    // Call AI for guidance
    try {
      const optionsText = fieldInfo.options.map(o => o.label).join(', ');
      const response = await chrome.runtime.sendMessage({
        type: 'GET_FORM_HELP',
        payload: {
          fieldLabel: fieldInfo.question,
          fieldType: fieldInfo.type,
          fieldOptions: optionsText,
          formContext: CONFIG.formContext
        }
      });

      if (response.success) {
        state.response = response.data;
      } else {
        state.error = response.error || 'Failed to get guidance';
      }
    } catch (error) {
      console.error('FormWise: API Error', error);
      state.error = 'Unable to connect to AI service';
    }
    
    state.isLoading = false;
    updatePanelContent();
  }

  // ========== DOM DETECTION FUNCTIONS ==========
  
  function extractFieldInfoFromDOM(element) {
    const tagName = element.tagName.toLowerCase();
    const type = element.type?.toLowerCase();
    
    let info = {
      question: '',
      type: 'input',
      options: [],
      fieldName: element.name || element.id || ''
    };
    
    // Detect field type and options
    if (tagName === 'select') {
      info.type = 'select';
      info.options = extractSelectOptions(element);
      info.question = findQuestionForElement(element);
    }
    else if (type === 'radio') {
      info.type = 'radio';
      info.options = extractRadioGroupOptions(element);
      info.question = findRadioGroupQuestion(element);
    }
    else if (type === 'checkbox') {
      info.type = 'checkbox';
      info.options = [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }];
      info.question = findQuestionForElement(element);
    }
    else {
      info.type = 'text';
      info.question = findQuestionForElement(element);
    }
    
    return info;
  }

  // Extract options from SELECT element
  function extractSelectOptions(selectEl) {
    return Array.from(selectEl.options)
      .filter(opt => {
        const val = opt.value?.toLowerCase().trim();
        const text = opt.textContent?.toLowerCase().trim();
        // Filter out placeholder options
        return val && val !== '' && val !== 'select' && val !== '-1' && 
               text !== 'select' && text !== '--select--' && text !== 'please select';
      })
      .map(opt => ({
        label: opt.textContent.trim(),
        value: opt.value,
        selected: opt.selected
      }));
  }

  // Extract all radio options in a group
  function extractRadioGroupOptions(radioEl) {
    const name = radioEl.name;
    if (!name) return [];
    
    const radios = document.querySelectorAll(`input[type="radio"][name="${name}"]`);
    return Array.from(radios).map(radio => {
      let label = findLabelForRadio(radio);
      return {
        label: label || radio.value,
        value: radio.value,
        selected: radio.checked
      };
    }).filter(opt => opt.label);
  }

  // Find label text for a single radio button
  function findLabelForRadio(radio) {
    // Method 1: Label with 'for' attribute
    if (radio.id) {
      const label = document.querySelector(`label[for="${radio.id}"]`);
      if (label) return cleanText(label.textContent);
    }
    
    // Method 2: Parent label
    const parentLabel = radio.closest('label');
    if (parentLabel) {
      // Get text excluding the radio button itself
      const clone = parentLabel.cloneNode(true);
      clone.querySelectorAll('input').forEach(i => i.remove());
      const text = cleanText(clone.textContent);
      if (text) return text;
    }
    
    // Method 3: Next sibling text
    let sibling = radio.nextSibling;
    while (sibling) {
      if (sibling.nodeType === Node.TEXT_NODE) {
        const text = cleanText(sibling.textContent);
        if (text && text.length > 0) return text;
      }
      if (sibling.nodeType === Node.ELEMENT_NODE) {
        const text = cleanText(sibling.textContent);
        if (text && text.length > 0 && text.length < 50) return text;
        break;
      }
      sibling = sibling.nextSibling;
    }
    
    // Method 4: Adjacent span or label
    const adjacent = radio.parentElement?.querySelector('span, label, font, b');
    if (adjacent && !adjacent.contains(radio)) {
      return cleanText(adjacent.textContent);
    }
    
    return radio.value;
  }

  // Find the question/label for any form element
  function findQuestionForElement(element) {
    let question = '';
    
    // Method 1: Label with 'for' attribute
    if (element.id) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label) question = cleanText(label.textContent);
    }
    
    // Method 2: Parent label
    if (!question) {
      const parentLabel = element.closest('label');
      if (parentLabel) {
        const clone = parentLabel.cloneNode(true);
        clone.querySelectorAll('input, select, textarea').forEach(el => el.remove());
        question = cleanText(clone.textContent);
      }
    }
    
    // Method 3: Table row - look in previous cells (government sites use tables)
    if (!question) {
      question = findQuestionInTableRow(element);
    }
    
    // Method 4: Previous sibling elements
    if (!question) {
      question = findQuestionInSiblings(element);
    }
    
    // Method 5: Closest container with text
    if (!question) {
      question = findQuestionInContainer(element);
    }
    
    // Method 6: Aria label or title
    if (!question) {
      question = element.getAttribute('aria-label') || 
                 element.getAttribute('title') || 
                 element.getAttribute('placeholder') ||
                 formatFieldName(element.name);
    }
    
    return question;
  }

  // Find question in table row (very common in government sites)
  function findQuestionInTableRow(element) {
    const row = element.closest('tr');
    if (!row) return '';
    
    const cells = row.querySelectorAll('td, th');
    const elementCell = element.closest('td, th');
    
    // Find the cell containing the element
    let elementCellIndex = -1;
    cells.forEach((cell, idx) => {
      if (cell === elementCell || cell.contains(element)) {
        elementCellIndex = idx;
      }
    });
    
    // Look in previous cells for the question
    for (let i = elementCellIndex - 1; i >= 0; i--) {
      const cellText = cleanText(cells[i].textContent);
      // Skip cells that only have form elements
      if (cellText && cellText.length > 2 && !cells[i].querySelector('input, select, textarea')) {
        return cellText;
      }
      // Also check if cell has text alongside form elements
      if (cellText && cellText.length > 10) {
        // Get text without form element values
        const clone = cells[i].cloneNode(true);
        clone.querySelectorAll('input, select, textarea').forEach(el => el.remove());
        const pureText = cleanText(clone.textContent);
        if (pureText && pureText.length > 5) return pureText;
      }
    }
    
    // Sometimes question is in the same cell but before the element
    if (elementCell) {
      const clone = elementCell.cloneNode(true);
      clone.querySelectorAll('input, select, textarea').forEach(el => el.remove());
      const text = cleanText(clone.textContent);
      if (text && text.length > 5) return text;
    }
    
    return '';
  }

  // Find question for radio button groups (usually in a different location)
  function findRadioGroupQuestion(radioEl) {
    // Method 1: Check table row first cell
    const row = radioEl.closest('tr');
    if (row) {
      const cells = row.querySelectorAll('td, th');
      if (cells.length > 0) {
        // First cell often has the question
        const firstCellText = cleanText(cells[0].textContent);
        // Make sure it's not just "Yes" or "No"
        if (firstCellText && firstCellText.length > 5 && 
            !firstCellText.match(/^(yes|no)$/i)) {
          // Exclude the radio labels from the question
          const radios = row.querySelectorAll('input[type="radio"]');
          let questionText = firstCellText;
          radios.forEach(r => {
            const label = findLabelForRadio(r);
            if (label) {
              questionText = questionText.replace(label, '').trim();
            }
          });
          if (questionText.length > 5) return questionText;
          return firstCellText;
        }
      }
    }
    
    // Method 2: Look for fieldset legend
    const fieldset = radioEl.closest('fieldset');
    if (fieldset) {
      const legend = fieldset.querySelector('legend');
      if (legend) return cleanText(legend.textContent);
    }
    
    // Method 3: Previous row might have the question (spanning rows)
    if (row) {
      let prevRow = row.previousElementSibling;
      while (prevRow && prevRow.tagName.toLowerCase() === 'tr') {
        const text = cleanText(prevRow.textContent);
        if (text && text.length > 10 && text.includes('?')) {
          return text;
        }
        // Check if it's a header row
        if (prevRow.querySelector('th')) {
          return cleanText(prevRow.textContent);
        }
        prevRow = prevRow.previousElementSibling;
      }
    }
    
    // Method 4: Parent container text
    const container = radioEl.closest('div, td, fieldset, p');
    if (container) {
      const clone = container.cloneNode(true);
      clone.querySelectorAll('input').forEach(el => el.remove());
      const text = cleanText(clone.textContent);
      // Find question-like text
      const questionMatch = text.match(/([^.]*\?)/);
      if (questionMatch) return questionMatch[1].trim();
      if (text.length > 10 && text.length < 200) return text;
    }
    
    return formatFieldName(radioEl.name);
  }

  // Find question in sibling elements
  function findQuestionInSiblings(element) {
    const parent = element.parentElement;
    if (!parent) return '';
    
    // Check previous siblings
    let sibling = element.previousElementSibling;
    while (sibling) {
      if (!sibling.querySelector('input, select, textarea')) {
        const text = cleanText(sibling.textContent);
        if (text && text.length > 3 && text.length < 200) {
          return text;
        }
      }
      sibling = sibling.previousElementSibling;
    }
    
    // Check text nodes before element
    let node = element.previousSibling;
    while (node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = cleanText(node.textContent);
        if (text && text.length > 3) return text;
      }
      node = node.previousSibling;
    }
    
    return '';
  }

  // Find question in container
  function findQuestionInContainer(element) {
    // Look up the DOM for labeled containers
    const containers = ['div', 'p', 'span', 'td', 'fieldset'];
    
    for (let selector of containers) {
      const container = element.closest(selector);
      if (container) {
        // Look for label-like elements
        const labelEl = container.querySelector('label, .label, .field-label, b, strong, font');
        if (labelEl && !labelEl.contains(element)) {
          const text = cleanText(labelEl.textContent);
          if (text && text.length > 3) return text;
        }
      }
    }
    
    return '';
  }

  // ========== UTILITY FUNCTIONS ==========
  
  function cleanText(text) {
    if (!text) return '';
    return text
      .replace(/[\r\n\t]+/g, ' ')  // Replace newlines/tabs with space
      .replace(/\s+/g, ' ')         // Collapse multiple spaces
      .replace(/^[\s:*]+/, '')      // Remove leading whitespace, colons, asterisks
      .replace(/[\s:*]+$/, '')      // Remove trailing
      .replace(/\*$/, '')           // Remove trailing asterisk
      .trim()
      .substring(0, 200);           // Limit length
  }

  function formatFieldName(name) {
    if (!name) return '';
    return name
      .replace(/[_-]/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  // ========== UI FUNCTIONS ==========
  
  function createHelperPanel() {
    helperPanel = document.createElement('div');
    helperPanel.id = 'gov-helper-panel';
    helperPanel.className = 'gov-helper-panel';
    helperPanel.innerHTML = getPanelHTML();
    document.body.appendChild(helperPanel);
    
    // Attach event listeners
    helperPanel.querySelector('.gov-helper-close-btn').addEventListener('click', closePanel);
    
    // Tab switcher
    helperPanel.querySelectorAll('.gov-helper-tab').forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
    
    // Chat input and send button
    const chatInput = helperPanel.querySelector('#chat-input');
    const sendBtn = helperPanel.querySelector('#chat-send-btn');
    
    if (chatInput && sendBtn) {
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendChatMessage();
        }
      });
      
      chatInput.addEventListener('input', (e) => {
        // Auto-resize textarea
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
      });
      
      sendBtn.addEventListener('click', sendChatMessage);
    }
  }

  // Switch between tabs
  function switchTab(tabName) {
    state.activeTab = tabName;
    
    // Update tab buttons
    helperPanel.querySelectorAll('.gov-helper-tab').forEach(tab => {
      if (tab.dataset.tab === tabName) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
    
    // Update tab content
    const fieldHelpContent = helperPanel.querySelector('#field-help-content');
    const chatContent = helperPanel.querySelector('#chat-content');
    
    if (tabName === 'field-help') {
      fieldHelpContent.classList.add('active');
      chatContent.classList.remove('active');
    } else {
      fieldHelpContent.classList.remove('active');
      chatContent.classList.add('active');
      renderChatMessages();
    }
  }

  // Send chat message
  async function sendChatMessage() {
    const chatInput = helperPanel.querySelector('#chat-input');
    const message = chatInput.value.trim();
    
    if (!message) return;
    
    // Add user message to state
    state.chatMessages.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    });
    
    // Clear input
    chatInput.value = '';
    chatInput.style.height = 'auto';
    
    // Update UI
    state.isChatLoading = true;
    state.chatError = null;
    renderChatMessages();
    
    try {
      // Extract page context
      const pageContext = extractPageContext();
      
      // Send to backend
      const response = await chrome.runtime.sendMessage({
        type: 'SEND_CHAT_MESSAGE',
        payload: {
          message: message,
          pageContext: pageContext,
          chatHistory: state.chatMessages.slice(-10) // Last 10 messages
        }
      });
      
      if (response.success) {
        // Add AI response to state
        state.chatMessages.push({
          role: 'assistant',
          content: response.data.response,
          timestamp: response.data.timestamp
        });
        
        // Save to storage
        await saveChatHistory();
      } else {
        state.chatError = response.error || 'Failed to get response';
      }
    } catch (error) {
      console.error('Chat error:', error);
      state.chatError = 'Unable to connect to AI service';
    }
    
    state.isChatLoading = false;
    renderChatMessages();
  }

  // Render chat messages
  function renderChatMessages() {
    const chatMessagesContainer = helperPanel.querySelector('#chat-messages');
    if (!chatMessagesContainer) return;
    
    if (state.chatMessages.length === 0) {
      chatMessagesContainer.innerHTML = `
        <div class="gov-helper-chat-welcome">
          <div class="gov-helper-idle-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <h4>Ask Me Anything!</h4>
          <p>I can help you with questions about this form, required documents, eligibility, or any confusing terms.</p>
        </div>
      `;
      return;
    }
    
    let html = '';
    state.chatMessages.forEach(msg => {
      const isUser = msg.role === 'user';
      html += `
        <div class="gov-helper-chat-message ${isUser ? 'user' : 'assistant'}">
          <div class="gov-helper-chat-bubble">
            ${escapeHTML(msg.content)}
          </div>
        </div>
      `;
    });
    
    if (state.isChatLoading) {
      html += `
        <div class="gov-helper-chat-message assistant">
          <div class="gov-helper-chat-bubble loading">
            <div class="gov-helper-loading-spinner"></div>
            <span>Thinking...</span>
          </div>
        </div>
      `;
    }
    
    if (state.chatError) {
      html += `
        <div class="gov-helper-chat-error">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>
          </svg>
          <span>${escapeHTML(state.chatError)}</span>
        </div>
      `;
    }
    
    chatMessagesContainer.innerHTML = html;
    
    // Scroll to bottom
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
  }

  function getPanelHTML() {
    return `
      <div class="gov-helper-header">
        <div class="gov-helper-header-content">
          <div class="gov-helper-logo">
            <img src="${chrome.runtime.getURL('icons/logo.png')}" alt="FormWise Logo" width="32" height="32" style="object-fit: contain;">
          </div>
          <div>
            <h3 class="gov-helper-title">FormWise</h3>
            <p class="gov-helper-subtitle">AI-Powered Assistance</p>
          </div>
        </div>
        <button class="gov-helper-close-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      
      <!-- Tab Switcher -->
      <div class="gov-helper-tabs">
        <button class="gov-helper-tab active" data-tab="field-help">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>
          </svg>
          <span>Field Help</span>
        </button>
        <button class="gov-helper-tab" data-tab="chat">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span>Chat</span>
        </button>
      </div>
      
      <!-- Field Help Tab Content -->
      <div id="field-help-content" class="gov-helper-tab-content active">
        <div class="gov-helper-question" id="gov-helper-question" style="display:none;">
          <span class="gov-helper-question-label">Detected Question</span>
          <p class="gov-helper-question-text" id="gov-helper-question-text"></p>
        </div>
        <div class="gov-helper-content" id="gov-helper-content">
          <div class="gov-helper-idle">
            <div class="gov-helper-idle-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/>
                <path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>
              </svg>
            </div>
            <h4>Ready to Help!</h4>
            <p>Click on any form field to get guidance.</p>
          </div>
        </div>
      </div>
      
      <!-- Chat Tab Content -->
      <div id="chat-content" class="gov-helper-tab-content">
        <div class="gov-helper-chat-messages" id="chat-messages">
          <div class="gov-helper-chat-welcome">
            <div class="gov-helper-idle-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <h4>Ask Me Anything!</h4>
            <p>I can help you with questions about this form, required documents, eligibility, or any confusing terms.</p>
          </div>
        </div>
        <div class="gov-helper-chat-input-container">
          <textarea 
            id="chat-input" 
            class="gov-helper-chat-input" 
            placeholder="Ask about the form..."
            rows="1"
          ></textarea>
          <button id="chat-send-btn" class="gov-helper-chat-send">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
            </svg>
          </button>
        </div>
      </div>
      
      <div class="gov-helper-footer">
        <p id="footer-text">AI-powered guidance</p>
      </div>
    `;
  }

  function showPanel() {
    state.isPanelVisible = true;
    helperPanel.classList.add('visible');
  }

  function closePanel() {
    state.isPanelVisible = false;
    helperPanel.classList.remove('visible');
    removeHighlight();
  }

  function highlightField(element) {
    removeHighlight();
    element.classList.add('gov-helper-highlight');
  }

  function removeHighlight() {
    document.querySelectorAll('.gov-helper-highlight').forEach(el => {
      el.classList.remove('gov-helper-highlight');
    });
  }

  function updatePanelContent() {
    const content = document.getElementById('gov-helper-content');
    const questionBox = document.getElementById('gov-helper-question');
    const questionText = document.getElementById('gov-helper-question-text');

    // Show detected question
    if (state.detectedQuestion) {
      questionBox.style.display = 'block';
      questionText.textContent = state.detectedQuestion;
    } else {
      questionBox.style.display = 'none';
    }

    // Update content
    if (state.isLoading) {
      content.innerHTML = getLoadingHTML();
    } else if (state.error) {
      content.innerHTML = getErrorHTML();
    } else if (state.response) {
      content.innerHTML = getResponseHTML();
      attachListeners();
    } else {
      content.innerHTML = getIdleHTML();
    }
  }

  function getLoadingHTML() {
    return `
      <div class="gov-helper-loading">
        <div class="gov-helper-loading-spinner"></div>
        <span>Analyzing...</span>
      </div>
      <div class="gov-helper-shimmer"></div>
      <div class="gov-helper-shimmer"></div>
    `;
  }

  function getErrorHTML() {
    return `
      <div class="gov-helper-error">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>
        </svg>
        <h4>Connection Error</h4>
        <p>${state.error}</p>
      </div>
    `;
  }

  function getIdleHTML() {
    return `
      <div class="gov-helper-idle">
        <div class="gov-helper-idle-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/>
            <path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>
          </svg>
        </div>
        <h4>Ready to Help!</h4>
        <p>Click on any form field to get guidance.</p>
      </div>
    `;
  }

  function getResponseHTML() {
    let html = '';
    
    // Show AI guidance
    const r = state.response;
    if (r.needs_interaction && r.question_options?.length > 0) {
      html += `
        <div class="gov-helper-card gov-helper-card-ai">
          <div class="gov-helper-card-header">
            <span class="gov-helper-card-icon green">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>
              </svg>
            </span>
            <span class="gov-helper-card-title">Which applies to you?</span>
          </div>
          <p class="gov-helper-hint">${escapeHTML(r.clarification_question || '')}</p>
          <div class="gov-helper-ai-options">
            ${r.question_options.map((opt, i) => `
              <button class="gov-helper-ai-option" data-idx="${i}" data-rec="${escapeHTML(opt.recommendation || '')}">
                <span class="gov-helper-ai-marker"></span>
                <span>${escapeHTML(opt.label)}</span>
              </button>
            `).join('')}
          </div>
          <div class="gov-helper-recommendation" id="gov-rec" style="display:none;">
            <span class="gov-helper-rec-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </span>
            <div>
              <span class="gov-helper-rec-label">Select This</span>
              <p class="gov-helper-rec-text" id="gov-rec-text"></p>
            </div>
          </div>
        </div>
      `;
    } else if (r.advice) {
      html += `
        <div class="gov-helper-card gov-helper-card-advice">
          <div class="gov-helper-card-header">
            <span class="gov-helper-card-icon green">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/>
                <path d="M9 18h6"/><path d="M10 22h4"/>
              </svg>
            </span>
            <span class="gov-helper-card-title">Recommendation</span>
          </div>
          <p class="gov-helper-advice-text">${escapeHTML(r.advice)}</p>
        </div>
      `;
    }
    
    // Warning
    if (r.warning) {
      html += `
        <div class="gov-helper-card gov-helper-card-warning">
          <div class="gov-helper-card-header">
            <span class="gov-helper-card-icon orange">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                <path d="M12 9v4"/><path d="M12 17h.01"/>
              </svg>
            </span>
            <span class="gov-helper-card-title">Important</span>
          </div>
          <p class="gov-helper-warning-text">${escapeHTML(r.warning)}</p>
        </div>
      `;
    }
    
    return html || getIdleHTML();
  }

  function attachListeners() {
    helperPanel.querySelectorAll('.gov-helper-ai-option').forEach(btn => {
      btn.addEventListener('click', () => {
        // Remove previous selection
        helperPanel.querySelectorAll('.gov-helper-ai-option').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        
        // Show recommendation
        const rec = btn.dataset.rec;
        const recBox = document.getElementById('gov-rec');
        const recText = document.getElementById('gov-rec-text');
        if (rec && recBox && recText) {
          recText.textContent = rec;
          recBox.style.display = 'flex';
        }
      });
    });
  }

  function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Initialize
  init();
})();
