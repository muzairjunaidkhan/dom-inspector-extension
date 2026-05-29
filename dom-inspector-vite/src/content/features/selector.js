import { EventBus } from '../core/state.js';
import { getData } from '../css/engine.js';

const MAX_HIGHLIGHTS = 50;
const HISTORY_LIMIT = 10;
const DEBOUNCE_MS = 120;
const STYLE_ID = 'di-selector-style';

let searchBar = null;
let inputEl = null;
let counterEl = null;
let messageEl = null;
let historyListEl = null;
let styleEl = null;
let docKeydownAttached = false;
let stopInspectorUnsub = null;

let currentMatches = [];
let focusedIndex = -1;
const searchHistory = [];

let debounceTimer = null;

function injectCss() {
  if (styleEl || document.getElementById(STYLE_ID)) return;
  styleEl = document.createElement('style');
  styleEl.id = STYLE_ID;
  styleEl.textContent = `
    @keyframes di-selector-pulse {
      0%, 100% {
        box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.85), 0 0 0 5px rgba(245, 158, 11, 0.4);
      }
      50% {
        box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.5), 0 0 0 10px rgba(245, 158, 11, 0);
      }
    }
    .di-selector-highlight {
      outline: 2px solid #f59e0b !important;
      outline-offset: 0 !important;
      animation: di-selector-pulse 1.4s ease-in-out infinite !important;
    }
    .di-selector-focused {
      outline: 3px solid #f59e0b !important;
      outline-offset: 0 !important;
      animation: di-selector-pulse 0.8s ease-in-out infinite !important;
    }
  `;
  document.head.appendChild(styleEl);
}

function removeCss() {
  if (styleEl) {
    styleEl.remove();
    styleEl = null;
  }
  const orphan = document.getElementById(STYLE_ID);
  if (orphan) orphan.remove();
}

function parseQuery(q) {
  if (!q || !q.trim()) return null;
  const t = q.trim();
  if (t.startsWith('text:')) return { mode: 'text', query: t.slice(5).trim() };
  if (t.startsWith('attr:')) return { mode: 'attr', query: t.slice(5).trim() };
  if (t.startsWith('xpath:')) return { mode: 'xpath', query: t.slice(6).trim() };
  return { mode: 'css', query: t };
}

function isInOwnUI(el) {
  if (!el || !searchBar) return false;
  return el === searchBar || searchBar.contains(el);
}

function runSearch(parsed) {
  const { mode, query } = parsed;
  if (!query) return { error: null, elements: [] };
  try {
    if (mode === 'css') {
      const nodes = document.querySelectorAll(query);
      return { error: null, elements: Array.from(nodes).filter(el => !isInOwnUI(el)) };
    }
    if (mode === 'attr') {
      const nodes = document.querySelectorAll(`[${query}]`);
      return { error: null, elements: Array.from(nodes).filter(el => !isInOwnUI(el)) };
    }
    if (mode === 'text') {
      const lower = query.toLowerCase();
      const results = new Set();
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walker.nextNode())) {
        const v = n.nodeValue;
        if (v && v.toLowerCase().includes(lower)) {
          const parent = n.parentElement;
          if (parent && !isInOwnUI(parent)) results.add(parent);
        }
      }
      return { error: null, elements: Array.from(results) };
    }
    if (mode === 'xpath') {
      const result = document.evaluate(query, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      const elements = [];
      for (let i = 0; i < result.snapshotLength; i++) {
        const node = result.snapshotItem(i);
        if (node && node.nodeType === Node.ELEMENT_NODE && !isInOwnUI(node)) {
          elements.push(node);
        }
      }
      return { error: null, elements };
    }
  } catch (e) {
    return { error: e.message || String(e), elements: [] };
  }
  return { error: null, elements: [] };
}

function clearHighlights() {
  document.querySelectorAll('.di-selector-highlight, .di-selector-focused').forEach(el => {
    el.classList.remove('di-selector-highlight', 'di-selector-focused');
  });
  EventBus.emit('selector:clear');
}

function setFocus(idx) {
  if (currentMatches.length === 0) return;
  currentMatches.forEach(el => {
    el.classList.add('di-selector-highlight');
    el.classList.remove('di-selector-focused');
  });
  focusedIndex = (idx + currentMatches.length) % currentMatches.length;
  const target = currentMatches[focusedIndex];
  target.classList.remove('di-selector-highlight');
  target.classList.add('di-selector-focused');
  try {
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  } catch (e) {
    try { target.scrollIntoView(); } catch (_) {}
  }
}

function applyHighlights(elements) {
  clearHighlights();
  const limited = elements.slice(0, MAX_HIGHLIGHTS);
  limited.forEach(el => el.classList.add('di-selector-highlight'));
  currentMatches = limited;
  if (limited.length > 0) {
    setFocus(0);
  } else {
    focusedIndex = -1;
  }
  EventBus.emit('selector:found', { count: elements.length, elements: limited });
}

function setCounterText(text) {
  if (counterEl) counterEl.textContent = text;
}

function setErrorState(isError, customMessage) {
  if (!inputEl) return;
  if (isError) {
    inputEl.style.borderColor = '#f44336';
    if (messageEl) {
      messageEl.textContent = customMessage || 'No elements found';
      messageEl.style.display = 'block';
    }
  } else {
    inputEl.style.borderColor = 'rgba(255,255,255,0.2)';
    if (messageEl) messageEl.style.display = 'none';
  }
}

function performSearch(value) {
  const parsed = parseQuery(value);
  if (!parsed) {
    clearHighlights();
    setCounterText('');
    setErrorState(false);
    return;
  }
  const { error, elements } = runSearch(parsed);
  if (error) {
    clearHighlights();
    setCounterText('');
    setErrorState(true, error);
    return;
  }
  if (elements.length === 0) {
    clearHighlights();
    setCounterText('');
    setErrorState(true);
    return;
  }
  setErrorState(false);
  applyHighlights(elements);
  if (elements.length > MAX_HIGHLIGHTS) {
    setCounterText(`(showing ${MAX_HIGHLIGHTS} of ${elements.length})`);
  } else {
    setCounterText(`${elements.length} ${elements.length === 1 ? 'result' : 'results'}`);
  }
}

function recordHistory(q) {
  if (!q) return;
  const trimmed = q.trim();
  if (!trimmed) return;
  const existing = searchHistory.indexOf(trimmed);
  if (existing !== -1) searchHistory.splice(existing, 1);
  searchHistory.unshift(trimmed);
  while (searchHistory.length > HISTORY_LIMIT) searchHistory.pop();
}

function showHistoryDropdown() {
  if (!historyListEl) return;
  historyListEl.innerHTML = '';
  if (searchHistory.length === 0) {
    historyListEl.style.display = 'none';
    return;
  }
  searchHistory.forEach(q => {
    const item = document.createElement('div');
    item.className = 'di-selector-history-item';
    item.textContent = q;
    item.style.cssText = `
      padding: 6px 10px;
      cursor: pointer;
      font-size: 12px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      color: #d4d4d4;
    `;
    item.onmouseenter = () => item.style.background = 'rgba(79, 195, 247, 0.15)';
    item.onmouseleave = () => item.style.background = 'transparent';
    item.onmousedown = (e) => {
      e.preventDefault();
      inputEl.value = q;
      hideHistoryDropdown();
      performSearch(q);
      inputEl.focus();
    };
    historyListEl.appendChild(item);
  });
  historyListEl.style.display = 'block';
}

function hideHistoryDropdown() {
  if (historyListEl) historyListEl.style.display = 'none';
}

function buildSearchBar() {
  searchBar = document.createElement('div');
  searchBar.className = 'di-selector-bar';
  Object.assign(searchBar.style, {
    position: 'fixed',
    top: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 'min(480px, 90vw)',
    zIndex: '999999',
    background: 'rgba(30, 30, 30, 0.97)',
    border: '1px solid rgba(79, 195, 247, 0.3)',
    borderRadius: '6px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
    padding: '8px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    backdropFilter: 'blur(10px)',
  });

  const wrap = document.createElement('div');
  wrap.className = 'di-selector-input-wrap';
  wrap.style.cssText = 'position:relative; display:flex; align-items:center;';

  inputEl = document.createElement('input');
  inputEl.type = 'text';
  inputEl.className = 'di-selector-input';
  inputEl.placeholder = 'CSS selector, text:..., attr:..., xpath:...';
  inputEl.autocomplete = 'off';
  inputEl.spellcheck = false;
  Object.assign(inputEl.style, {
    flex: '1',
    background: 'rgba(0,0,0,0.4)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '4px',
    color: '#fff',
    padding: '8px 130px 8px 10px',
    fontSize: '13px',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    outline: 'none',
    width: '100%',
  });

  counterEl = document.createElement('span');
  counterEl.className = 'di-selector-counter';
  counterEl.style.cssText = `
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    color: #4fc3f7;
    font-size: 11px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    pointer-events: none;
    white-space: nowrap;
  `;

  wrap.append(inputEl, counterEl);

  messageEl = document.createElement('div');
  messageEl.className = 'di-selector-message';
  messageEl.style.cssText = `
    margin-top: 6px;
    color: #f44336;
    font-size: 11px;
    display: none;
  `;

  historyListEl = document.createElement('div');
  historyListEl.className = 'di-selector-history';
  historyListEl.style.cssText = `
    margin-top: 6px;
    background: rgba(20, 20, 20, 0.97);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 4px;
    max-height: 180px;
    overflow-y: auto;
    display: none;
  `;

  searchBar.append(wrap, messageEl, historyListEl);
  document.body.appendChild(searchBar);

  inputEl.addEventListener('input', () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    const value = inputEl.value;
    if (value.trim() === '') {
      clearHighlights();
      setCounterText('');
      setErrorState(false);
      currentMatches = [];
      focusedIndex = -1;
      return;
    }
    hideHistoryDropdown();
    debounceTimer = setTimeout(() => performSearch(value), DEBOUNCE_MS);
  });

  inputEl.addEventListener('focus', () => {
    if (!inputEl.value.trim()) showHistoryDropdown();
  });

  inputEl.addEventListener('blur', () => {
    setTimeout(hideHistoryDropdown, 150);
  });

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeSearch();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (currentMatches.length > 0 && focusedIndex >= 0) {
        const target = currentMatches[focusedIndex];
        recordHistory(inputEl.value);
        try {
          const data = getData(target);
          EventBus.emit('inspector:select', data);
        } catch (err) {
          console.warn('[DOM Inspector] selector: getData failed', err);
        }
        closeSearch();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      hideHistoryDropdown();
      if (currentMatches.length > 0) setFocus(focusedIndex + 1);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      if (currentMatches.length > 0) setFocus(focusedIndex - 1);
      return;
    }
  });
}

function teardownSearchBar() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  clearHighlights();
  if (searchBar) {
    searchBar.remove();
    searchBar = null;
    inputEl = null;
    counterEl = null;
    messageEl = null;
    historyListEl = null;
  }
  currentMatches = [];
  focusedIndex = -1;
}

const isTextInputFocused = () => {
  const el = document.activeElement;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

const handleDocKeyDown = (e) => {
  if (searchBar && searchBar.contains(e.target)) return;
  if (e.key === 'Escape' && searchBar) {
    e.preventDefault();
    e.stopPropagation();
    closeSearch();
    return;
  }
  if (isTextInputFocused()) return;
  const k = e.key.toLowerCase();
  if (k !== 'f') return;
  if (e.altKey || e.shiftKey) return;
  e.preventDefault();
  e.stopPropagation();
  openSearch();
};

export function openSearch(initialQuery) {
  if (searchBar) {
    if (inputEl) inputEl.focus();
    return;
  }
  injectCss();
  buildSearchBar();
  if (initialQuery) {
    inputEl.value = initialQuery;
    performSearch(initialQuery);
  }
  setTimeout(() => { if (inputEl) inputEl.focus(); }, 0);
}

export function closeSearch() {
  if (!searchBar) return;
  if (inputEl && inputEl.value.trim()) recordHistory(inputEl.value);
  teardownSearchBar();
}

export function initSelectorSearch() {
  if (docKeydownAttached) return;
  injectCss();
  document.addEventListener('keydown', handleDocKeyDown, true);
  docKeydownAttached = true;
  if (!stopInspectorUnsub) {
    stopInspectorUnsub = EventBus.on('inspector:stop', () => {
      if (searchBar) closeSearch();
    });
  }
}

export function destroySelectorSearch() {
  closeSearch();
  removeCss();
  if (docKeydownAttached) {
    document.removeEventListener('keydown', handleDocKeyDown, true);
    docKeydownAttached = false;
  }
  if (stopInspectorUnsub) {
    stopInspectorUnsub();
    stopInspectorUnsub = null;
  }
}
