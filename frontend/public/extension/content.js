// FormWise - Content Script
/* global chrome */
// Detects form fields on legacy government portals (Passport Seva) and drives the panel iframe.

(function () {
  'use strict';

  if (document.getElementById('formwise-frame')) return;

  const FORM_CONTEXT = 'Indian Passport Application Form (Passport Seva Portal)';
  const CONTROL_SELECTOR =
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), select, textarea';
  const HEADING_SELECTOR =
    'h1, h2, h3, h4, h5, h6, legend, caption, th[colspan], td[colspan], [class*="head"], [class*="title"], [class*="section"]';
  const NOISE_RE = /^(select|--select--|please select|select one|choose|yes|no|n\/a|na|none|-+|\*+|:+|\(\s*\))$/i;
  const PLACEHOLDER_VALUES = new Set(['', '-1', '0', 'select', '--select--', 'please select', 'null']);

  let frame = null;
  let frameReady = false;
  let outbox = [];
  let helpTimer = null;
  let progressTimer = null;
  let fieldCounter = 0;
  let lastFieldEl = null;
  const labelCache = new WeakMap();

  // ========== BOOT ==========

  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setup);
    } else {
      setup();
    }
  }

  function setup() {
    ensureFrame();
    attachListeners();
    observeDom();
    scheduleProgress(200);
    console.log('FormWise: ready');
  }

  // ========== PANEL IFRAME + MESSAGING ==========

  function ensureFrame() {
    if (frame && document.contains(frame)) return;
    frameReady = false;
    frame = document.createElement('iframe');
    frame.id = 'formwise-frame';
    frame.className = 'formwise-frame';
    frame.title = 'FormWise assistant';
    frame.setAttribute('allowtransparency', 'true');
    frame.src = chrome.runtime.getURL('panel/index.html');
    (document.body || document.documentElement).appendChild(frame);
  }

  function post(msg) {
    if (!frameReady) {
      outbox.push(msg);
      return;
    }
    frame.contentWindow.postMessage({ source: 'formwise-content', ...msg }, '*');
  }

  window.addEventListener('message', (event) => {
    if (!frame || event.source !== frame.contentWindow) return;
    const msg = event.data;
    if (!msg || msg.source !== 'formwise-panel') return;

    switch (msg.type) {
      case 'FW_READY':
        frameReady = true;
        frame.contentWindow.postMessage(
          { source: 'formwise-content', type: 'FW_INIT', hostname: window.location.hostname },
          '*'
        );
        outbox.forEach(post);
        outbox = [];
        scheduleProgress(0);
        break;
      case 'FW_CLOSE':
        hidePanel();
        break;
      case 'FW_JUMP':
        jumpToField(msg.id);
        break;
      case 'FW_APPLY':
        applyValue(msg.value);
        break;
      case 'FW_GET_PAGE_CONTEXT':
        post({ type: 'FW_PAGE_CONTEXT', requestId: msg.requestId, context: extractPageContext() });
        break;
      default:
    }
  });

  function showPanel() {
    ensureFrame();
    frame.classList.add('visible');
  }

  function hidePanel() {
    frame.classList.remove('visible');
    removeHighlight();
  }

  // ========== EVENTS ==========

  function attachListeners() {
    document.addEventListener('focusin', handleInteraction, true);
    document.addEventListener('click', handleInteraction, true);
    document.addEventListener('change', onValueChange, true);
    document.addEventListener('input', onValueChange, true);
    window.addEventListener('hashchange', () => scheduleProgress(300));
    window.addEventListener('popstate', () => scheduleProgress(300));
    ['pushState', 'replaceState'].forEach((fn) => {
      const original = history[fn];
      history[fn] = function () {
        const result = original.apply(this, arguments);
        scheduleProgress(400);
        return result;
      };
    });
  }

  function handleInteraction(event) {
    const target = event.target;
    if (!(target instanceof Element) || target.closest('#formwise-frame')) return;

    if (isControl(target)) {
      queueHelp(target);
      return;
    }

    if (target.tagName === 'LABEL') {
      const forId = target.getAttribute('for');
      const control = forId ? document.getElementById(forId) : target.querySelector(CONTROL_SELECTOR);
      if (control && isControl(control)) queueHelp(control);
      return;
    }

    const cell = target.closest('td, th, li, .form-group');
    if (cell) {
      const controls = cell.querySelectorAll(CONTROL_SELECTOR);
      if (controls.length === 1 || (controls.length > 1 && controls[0].type === 'radio')) {
        if (isControl(controls[0])) queueHelp(controls[0]);
      }
    }
  }

  function onValueChange(event) {
    if (event.target instanceof Element && isControl(event.target)) scheduleProgress(400);
  }

  function isControl(el) {
    return !!el && el.matches && el.matches(CONTROL_SELECTOR) && !el.closest('#formwise-frame');
  }

  function queueHelp(el) {
    clearTimeout(helpTimer);
    helpTimer = setTimeout(() => processField(el), 350);
  }

  function processField(el) {
    const info = extractFieldInfo(el);
    if (!info.question) {
      console.log('FormWise: no label found for', el);
      return;
    }
    console.log('FormWise: detected', info);
    lastFieldEl = el;
    showPanel();
    highlight(el);
    post({ type: 'FW_FIELD', fieldInfo: info, formContext: FORM_CONTEXT });
  }

  // Apply the AI-recommended option to the real form control.
  function applyValue(value) {
    const el = lastFieldEl;
    if (!el || !document.contains(el)) return;
    const type = controlType(el);
    const wanted = String(value);
    if (type === 'radio') {
      const group = radioGroup(el);
      const target =
        group.find((r) => r.value === wanted) ||
        group.find((r) => (radioLabel(r) || '').toLowerCase() === wanted.toLowerCase());
      if (target) {
        target.checked = true;
        fireEvents(target);
      }
    } else if (type === 'checkbox') {
      el.checked = /^(yes|true|1|on)$/i.test(wanted);
      fireEvents(el);
    } else if (type === 'select') {
      const opt =
        Array.from(el.options).find((o) => o.value === wanted) ||
        Array.from(el.options).find((o) => o.textContent.trim() === wanted);
      if (opt) {
        el.value = opt.value;
        fireEvents(el);
      }
    } else {
      el.value = wanted;
      fireEvents(el);
    }
    highlight(el);
    scheduleProgress(200);
  }

  function fireEvents(el) {
    ['input', 'change'].forEach((t) => el.dispatchEvent(new Event(t, { bubbles: true })));
  }

  // ========== DOM OBSERVER (AJAX page transitions) ==========

  function observeDom() {
    const observer = new MutationObserver((mutations) => {
      let relevant = false;
      for (const m of mutations) {
        if (m.type !== 'childList') continue;
        for (const node of m.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE || node.id === 'formwise-frame') continue;
          if (node.matches(CONTROL_SELECTOR) || node.querySelector(CONTROL_SELECTOR)) {
            relevant = true;
            break;
          }
        }
        for (const node of m.removedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE && (node.id === 'formwise-frame' || node.querySelector?.(CONTROL_SELECTOR))) {
            relevant = true;
          }
        }
        if (relevant) break;
      }
      if (!relevant) return;
      labelCacheReset();
      ensureFrame();
      scheduleProgress(500);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  let cacheVersion = 0;
  function labelCacheReset() {
    cacheVersion++;
  }

  // ========== FIELD INFO EXTRACTION ==========

  function extractFieldInfo(el) {
    const cached = labelCache.get(el);
    if (cached && cached.version === cacheVersion) return cached.info;

    const type = controlType(el);
    let options = [];
    if (type === 'select') options = selectOptions(el);
    else if (type === 'radio') options = radioOptions(el);
    else if (type === 'checkbox') options = [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }];

    const optionLabels = options.map((o) => o.label);
    const best = type === 'radio' ? bestRadioLabel(el, optionLabels) : bestLabel(el, optionLabels);
    const question = best ? best.text : formatFieldName(el.name || el.id);

    const info = {
      question,
      type,
      options,
      fieldName: el.name || el.id || '',
      section: findSection(el, question),
      helpText: findHelpText(el, question),
      required: isRequired(el, best),
      source: best ? best.source : 'fallback',
    };
    labelCache.set(el, { version: cacheVersion, info });
    return info;
  }

  function controlType(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'select') return 'select';
    if (tag === 'textarea') return 'textarea';
    const t = (el.type || 'text').toLowerCase();
    if (t === 'radio' || t === 'checkbox') return t;
    return 'text';
  }

  function selectOptions(select) {
    return Array.from(select.options)
      .filter((opt) => {
        const val = (opt.value || '').trim().toLowerCase();
        const text = (opt.textContent || '').trim().toLowerCase();
        return !PLACEHOLDER_VALUES.has(val) && !NOISE_RE.test(text) && !/^-+\s*select/i.test(text);
      })
      .map((opt) => ({ label: opt.textContent.trim(), value: opt.value, selected: opt.selected }));
  }

  function radioGroup(radio) {
    if (!radio.name) return [radio];
    const scope = radio.form || document;
    return Array.from(scope.querySelectorAll(`input[type="radio"][name="${cssEscape(radio.name)}"]`));
  }

  function radioOptions(radio) {
    return radioGroup(radio)
      .map((r) => ({ label: radioLabel(r) || r.value, value: r.value, selected: r.checked }))
      .filter((o) => o.label);
  }

  function radioLabel(radio) {
    if (radio.id) {
      const label = document.querySelector(`label[for="${cssEscape(radio.id)}"]`);
      if (label) return cleanText(label.textContent);
    }
    const parentLabel = radio.closest('label');
    if (parentLabel) {
      const t = textWithoutControls(parentLabel);
      if (t) return t;
    }
    let node = radio.nextSibling;
    while (node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const t = cleanText(node.textContent);
        if (t) return t;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.matches(CONTROL_SELECTOR)) break;
        const t = cleanText(node.textContent);
        if (t && t.length < 60) return t;
        break;
      }
      node = node.nextSibling;
    }
    node = radio.previousSibling;
    while (node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const t = cleanText(node.textContent);
        if (t && t.length < 40) return t;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        break;
      }
      node = node.previousSibling;
    }
    return radio.value;
  }

  // ---- candidate scoring ----

  function bestLabel(el, optionLabels) {
    const candidates = collectCandidates(el, el, optionLabels, 0);
    return pickBest(candidates);
  }

  function bestRadioLabel(radio, optionLabels) {
    const group = radioGroup(radio);
    const container = commonAncestor(group) || radio.parentElement;
    const candidates = collectCandidates(radio, radio, optionLabels, 0).filter(
      (c) => !['same-cell', 'parent-label', 'prev-text', 'prev-sibling'].includes(c.source) || c.text.length > 12
    );
    if (container && container !== radio) {
      candidates.push(...collectCandidates(container, radio, optionLabels, 0, true));
    }
    return pickBest(candidates);
  }

  function pickBest(candidates) {
    if (!candidates.length) return null;
    candidates.sort((a, b) => b.score - a.score || a.text.length - b.text.length);
    return candidates[0];
  }

  // anchor: node we search around (control or radio-group container); control: the actual input
  function collectCandidates(anchor, control, optionLabels, penalty, isContainer) {
    const out = [];
    const add = (raw, score, source) => {
      const text = stripOptionLabels(cleanText(raw), optionLabels);
      if (isGoodLabel(text)) out.push({ text, raw: String(raw || ''), score: score - penalty, source });
    };

    if (!isContainer) {
      (control.getAttribute('aria-labelledby') || '')
        .split(/\s+/)
        .filter(Boolean)
        .forEach((id) => {
          const n = document.getElementById(id);
          if (n) add(n.textContent, 100, 'aria-labelledby');
        });
      if (control.id) {
        document
          .querySelectorAll(`label[for="${cssEscape(control.id)}"]`)
          .forEach((l) => add(rawText(l), 95, 'label-for'));
      }
      const parentLabel = control.closest('label');
      if (parentLabel) add(rawText(parentLabel), 90, 'parent-label');
      add(control.getAttribute('aria-label'), 85, 'aria-label');
    } else {
      const legend = anchor.matches('fieldset') ? anchor.querySelector(':scope > legend') : anchor.closest('fieldset')?.querySelector(':scope > legend');
      if (legend) add(legend.textContent, 54, 'legend');
      const own = rawText(anchor);
      if (own && own.length < 220) add(own, 72, 'container-text');
    }

    tableCandidates(anchor, add, isContainer);
    siblingCandidates(anchor, control, add);
    containerCandidates(anchor, control, add);

    if (!isContainer) {
      add(control.getAttribute('title'), 40, 'title');
      add(control.getAttribute('placeholder'), 35, 'placeholder');
      add(formatFieldName(control.name || control.id), 10, 'name');
    }
    return out;
  }

  function tableCandidates(anchor, add, isContainer) {
    if (anchor.tagName === 'TR') {
      Array.from(anchor.children).forEach((c) => {
        if (!c.querySelector(CONTROL_SELECTOR)) {
          const t = rawText(c);
          if (t) add(t, 80, 'row-cell');
        }
      });
      previousRowCandidates(anchor, add, 0);
      return;
    }

    let cell = anchor.closest('td, th');
    let depth = 0;
    while (cell && depth < 3) {
      const penalty = depth * 12;
      const row = cell.parentElement;
      const cells = Array.from(row.children);
      const idx = cells.indexOf(cell);

      for (let i = idx - 1, dist = 1; i >= 0; i--, dist++) {
        const t = rawText(cells[i]);
        if (cleanText(t)) {
          add(t, 82 - dist * 3 - penalty, 'row-cell');
          break;
        }
      }

      const own = isContainer && depth === 0 ? '' : rawText(cell);
      if (cleanText(own)) add(own, 75 - penalty, 'same-cell');

      const table = cell.closest('table');
      if (table) {
        const headerRow = Array.from(table.rows).find((r) => r.querySelector('th') && !r.querySelector(CONTROL_SELECTOR));
        if (headerRow && headerRow !== row && headerRow.cells[idx] && headerRow.cells.length === cells.length) {
          add(headerRow.cells[idx].textContent, 70 - penalty, 'column-header');
        }
      }

      if (cleanText(own).length < 4) previousRowCandidates(row, add, penalty);

      cell = table ? table.closest('td, th') : null;
      depth++;
    }
  }

  function previousRowCandidates(row, add, penalty) {
    let prev = row.previousElementSibling;
    let hops = 0;
    while (prev && hops < 3) {
      if (!prev.querySelector(CONTROL_SELECTOR)) {
        const t = rawText(prev);
        if (t && t.length < 250) {
          add(t, 66 - hops * 5 - penalty, 'previous-row');
          break;
        }
      }
      prev = prev.previousElementSibling;
      hops++;
    }
  }

  function siblingCandidates(anchor, control, add) {
    let node = anchor.previousSibling;
    let hops = 0;
    while (node && hops < 5) {
      if (node.nodeType === Node.TEXT_NODE) {
        const t = node.textContent.replace(/\s+/g, ' ').trim();
        if (cleanText(t)) {
          add(t, 60, 'prev-text');
          break;
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.matches(CONTROL_SELECTOR) || node.querySelector(CONTROL_SELECTOR)) break;
        const t = rawText(node);
        if (cleanText(t) && t.length < 250) {
          add(t, 60, 'prev-sibling');
          break;
        }
      }
      node = node.previousSibling;
      hops++;
    }

    let wrapper = anchor.parentElement;
    let depth = 0;
    while (wrapper && depth < 3 && !/^(TD|TH|TR|TABLE|FORM|BODY|HTML)$/.test(wrapper.tagName)) {
      const controlsInside = wrapper.querySelectorAll(CONTROL_SELECTOR).length;
      const soleField = controlsInside <= 1 || /radio|checkbox/.test(control.type || '');
      if (soleField) {
        let prev = wrapper.previousElementSibling;
        let h = 0;
        while (prev && h < 3) {
          if (!prev.querySelector(CONTROL_SELECTOR)) {
            const t = rawText(prev);
            if (cleanText(t) && t.length < 200) {
              add(t, 56 - depth * 4, 'wrapper-prev');
              break;
            }
          }
          prev = prev.previousElementSibling;
          h++;
        }
      }
      wrapper = wrapper.parentElement;
      depth++;
    }
  }

  function containerCandidates(anchor, control, add) {
    const container = anchor.closest('td, th, li, fieldset, p, div');
    if (!container) return;
    const legend = container.tagName === 'FIELDSET' ? container.querySelector(':scope > legend') : null;
    if (legend) add(legend.textContent, 52, 'legend');
    const labelish = Array.from(
      container.querySelectorAll('label, [class*="label"], [class*="question"], b, strong, font, span')
    ).find((n) => !n.contains(control) && !n.querySelector(CONTROL_SELECTOR) && cleanText(n.textContent).length > 2);
    if (labelish) add(labelish.textContent, 50, 'container-label');
  }

  // ---- section + help text ----

  function findSection(el, ownLabel) {
    let node = el;
    let depth = 0;
    while (node && node !== document.body && depth < 10) {
      if (node.tagName === 'FIELDSET') {
        const legend = node.querySelector(':scope > legend');
        const t = legend && cleanText(legend.textContent);
        if (t && t !== ownLabel) return t.slice(0, 120);
      }
      if (node.tagName === 'TABLE') {
        const caption = node.querySelector(':scope > caption');
        const t = caption && cleanText(caption.textContent);
        if (t && t !== ownLabel) return t.slice(0, 120);
      }
      let prev = node.previousElementSibling;
      let hops = 0;
      while (prev && hops < 8) {
        if (!prev.querySelector(CONTROL_SELECTOR)) {
          const heading = prev.matches(HEADING_SELECTOR) ? prev : prev.querySelector(HEADING_SELECTOR);
          if (heading) {
            const t = cleanText(heading.textContent);
            if (isGoodLabel(t) && t.length < 80 && !/\?/.test(t) && !/[|—]/.test(t) && t !== ownLabel) return t;
          }
        }
        prev = prev.previousElementSibling;
        hops++;
      }
      node = node.parentElement;
      depth++;
    }
    return '';
  }

  function findHelpText(el, ownLabel) {
    const scope = el.closest('td, li, .form-group, div');
    const selector = 'small, [class*="help"], [class*="hint"], [class*="note"], [class*="info"], [class*="tip"], i, em';
    let text = '';
    if (scope) {
      const node = Array.from(scope.querySelectorAll(selector)).find((n) => {
        if (n.contains(el) || n.querySelector(CONTROL_SELECTOR)) return false;
        const len = cleanText(n.textContent).length;
        return len > 3 && len < 300;
      });
      if (node) text = cleanText(node.textContent);
    }
    if (!text) {
      const cell = el.closest('td, th');
      const next = cell && cell.nextElementSibling;
      if (next && !next.querySelector(CONTROL_SELECTOR)) {
        const t = textWithoutControls(next);
        if (t && /^\(|e\.g\.|as per|format|example|should|must/i.test(t) && t.length < 200) text = t;
      }
    }
    if (!text) text = cleanText(el.getAttribute('title') || '');
    return text === ownLabel ? '' : text.slice(0, 300);
  }

  // ---- required + filled ----

  function isRequired(el, best) {
    if (el.required || el.getAttribute('aria-required') === 'true') return true;
    if (/(^|\s)(required|mandatory)(\s|$)/i.test(el.className)) return true;
    if (best && /\*/.test(best.raw)) return true;
    const cell = el.closest('td, th, li, .form-group, div');
    if (!cell) return false;
    const zone = [cell, cell.previousElementSibling].filter(Boolean);
    return zone.some(
      (z) =>
        z.querySelector('.mandatory, .required, [class*="mandat"], [class*="requir"], font[color="red"], font[color="#ff0000"], [style*="color: red"], [style*="color:red"]') ||
        /\*/.test(rawText(z))
    );
  }

  function isFilled(el) {
    const type = controlType(el);
    if (type === 'select') return !PLACEHOLDER_VALUES.has((el.value || '').trim().toLowerCase()) && el.selectedIndex > -1 && !NOISE_RE.test(el.options[el.selectedIndex]?.textContent.trim() || '');
    if (type === 'radio') return radioGroup(el).some((r) => r.checked);
    if (type === 'checkbox') return el.checked;
    return (el.value || '').trim() !== '';
  }

  function isVisible(el) {
    return el.getClientRects().length > 0;
  }

  // ========== PROGRESS TRACKER ==========

  function scheduleProgress(delay) {
    clearTimeout(progressTimer);
    progressTimer = setTimeout(scanRequiredFields, delay);
  }

  function scanRequiredFields() {
    const seenGroups = new Set();
    const items = [];
    document.querySelectorAll(CONTROL_SELECTOR).forEach((el) => {
      if (el.closest('#formwise-frame') || !isVisible(el)) return;
      if (el.type === 'radio' && el.name) {
        if (seenGroups.has(el.name)) return;
        seenGroups.add(el.name);
      }
      const info = extractFieldInfo(el);
      if (!info.required) return;
      items.push({ id: ensureId(el), label: info.question || 'Untitled field', section: info.section, done: isFilled(el) });
    });
    const completed = items.filter((i) => i.done).length;
    post({
      type: 'FW_PROGRESS',
      progress: {
        total: items.length,
        completed,
        missing: items.filter((i) => !i.done).slice(0, 60).map(({ id, label, section }) => ({ id, label, section })),
      },
    });
  }

  function ensureId(el) {
    if (!el.dataset.fwId) el.dataset.fwId = String(++fieldCounter);
    return el.dataset.fwId;
  }

  function jumpToField(id) {
    const el = document.querySelector(`[data-fw-id="${cssEscape(id)}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    highlight(el);
    setTimeout(() => {
      try {
        el.focus({ preventScroll: true });
      } catch (_) {}
      queueHelp(el);
    }, 250);
  }

  // ========== PAGE CONTEXT (for chat) ==========

  function extractPageContext() {
    const formData = {};
    document.querySelectorAll(CONTROL_SELECTOR).forEach((el) => {
      if (el.closest('#formwise-frame')) return;
      if ((el.type === 'radio' || el.type === 'checkbox') && !el.checked) return;
      const key = el.name || el.id;
      if (key && el.value) formData[key] = el.value;
    });
    return {
      page_title: document.title,
      page_url: window.location.href,
      form_data: formData,
      page_text: (document.body.innerText || '').substring(0, 8000),
    };
  }

  // ========== UTILITIES ==========

  function cleanText(text) {
    if (!text) return '';
    return String(text)
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\(?\s*(mandatory|required)\s*(field)?\s*\)?/gi, '')
      .replace(/^[\s:*\-–•]+/, '')
      .replace(/[\s:*\-–]+$/, '')
      .trim()
      .substring(0, 200);
  }

  function rawText(node) {
    const clone = node.cloneNode(true);
    clone
      .querySelectorAll(`${CONTROL_SELECTOR}, script, style, option, legend, caption, #formwise-frame, small, [class*="hint"], [class*="help"], [class*="note"], [class*="tooltip"]`)
      .forEach((n) => n.remove());
    return (clone.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function textWithoutControls(node) {
    return cleanText(rawText(node));
  }

  function stripOptionLabels(text, optionLabels) {
    if (!text || !optionLabels || !optionLabels.length) return text;
    let out = text;
    optionLabels.forEach((label) => {
      if (label && label.length > 0 && label.length < 60) {
        out = out.replace(new RegExp(`(^|\\s)${escapeRegExp(label)}(?=\\s|$)`, 'gi'), ' ');
      }
    });
    return cleanText(out);
  }

  function isGoodLabel(text) {
    if (!text || text.length < 2 || text.length > 200) return false;
    if (NOISE_RE.test(text) || /^\d+$/.test(text)) return false;
    return /[a-z\u0900-\u097F]/i.test(text);
  }

  function formatFieldName(name) {
    if (!name) return '';
    return cleanText(
      name
        .replace(/^(txt|ddl|rdo|rb|chk|cb|sel|inp|f_|fld)_?/i, '')
        .replace(/[_\-.\[\]]+/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\b\w/g, (l) => l.toUpperCase())
    );
  }

  function commonAncestor(nodes) {
    if (!nodes.length) return null;
    let ancestor = nodes[0].parentElement;
    while (ancestor && !nodes.every((n) => ancestor.contains(n))) ancestor = ancestor.parentElement;
    return ancestor;
  }

  function highlight(el) {
    removeHighlight();
    el.classList.add('formwise-highlight');
  }

  function removeHighlight() {
    document.querySelectorAll('.formwise-highlight').forEach((n) => n.classList.remove('formwise-highlight'));
  }

  function cssEscape(value) {
    return window.CSS && CSS.escape ? CSS.escape(value) : String(value).replace(/["\\]/g, '\\$&');
  }

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  init();
})();
