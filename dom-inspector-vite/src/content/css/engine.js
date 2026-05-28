import { elementDataCache, cacheInvalidationFrame, setCacheInvalidationFrame } from '../core/state.js';
import { CSS_DEFAULTS, NEVER_SHOW } from '../core/constants.js';
import { rgbToHex } from '../core/utils.js';

export const isNonDefaultCSS = (key, value, d) => {
  // Null/undefined check
  if (value == null) return false;

  // Never show webkit/moz prefixed noise
  if (NEVER_SHOW.includes(key)) return false;
  if (key.startsWith('webkit') || key.startsWith('moz') || key.startsWith('ms')) return false;

  // Normalize value
  const v = String(value).trim();

  // Skip empty values
  if (v === '') return false;

  // ===================================
  // CONTEXT-AWARE FILTERING (Critical!)
  // ===================================

  // 1. Position-dependent properties
  if (['top', 'left', 'right', 'bottom', 'zIndex'].includes(key)) {
    if (!d || d.position === 'static') return false;
  }

  // 2. Flexbox properties (only for flex containers)
  if (key.startsWith('flex') || key === 'justifyContent' || key === 'alignItems' || key === 'alignContent') {
    if (!d || !d.display.includes('flex')) return false;
  }

  // 3. Grid properties (only for grid containers)
  if (key.startsWith('grid')) {
    if (!d || !d.display.includes('grid')) return false;
  }

  // 4. Gap (only for flex/grid)
  if (key === 'gap') {
    if (!d || (!d.display.includes('flex') && !d.display.includes('grid'))) return false;
    // Also filter out "normal" gap values
    if (v === 'normal' || v === '0px' || v === '0') return false;
  }

  // ===================================
  // UNIVERSAL NOISE FILTERS
  // ===================================

  // Zero values (always default)
  if (v === '0px' || v === '0' || v === '0px 0px 0px 0px' || v === '0px 0px') return false;

  // Auto/none/normal (usually default) - with exceptions
  if (v === 'auto' || v === 'none' || v === 'normal') {
    // Exception: display, position, overflow can have meaningful none/auto values
    if (key === 'display' && v === 'none') return true;
    if (key === 'position' && v !== 'static') return true;
    if (key === 'overflow' || key === 'overflowX' || key === 'overflowY') {
      if (v === 'auto' || v === 'hidden' || v === 'scroll') return true;
    }
    return false;
  }

  // Transparent backgrounds
  if (v === 'rgba(0, 0, 0, 0)' || v === 'transparent') return false;

  // ===================================
  // CHECK AGAINST KNOWN DEFAULTS
  // ===================================

  const defaultValue = CSS_DEFAULTS[key];
  if (defaultValue) {
    // Exact match
    if (defaultValue === v) return false;

    // Normalized comparisons
    if (key === 'margin' || key === 'padding') {
      const normalized = v.replace(/\s+/g, ' ');
      if (normalized === '0px 0px 0px 0px' || normalized === '0px') return false;
    }

    if (key === 'border' || key.startsWith('border')) {
      if (v.startsWith('0px')) return false;
      // Also check for "medium none" style defaults
      if (v.includes('none') && v.includes('0px')) return false;
    }

    if (key === 'fontWeight') {
      if ((v === '400' || v === 'normal') && (defaultValue === '400' || defaultValue === 'normal')) return false;
    }

    if (key === 'textAlign') {
      if ((v === 'start' || v === 'left') && (defaultValue === 'start' || defaultValue === 'left')) return false;
    }
  }

  // ===================================
  // EDGE CASES & IMPROVEMENTS
  // ===================================

  // Don't show inherited color if it's black (default)
  if (key === 'color' && (v === 'rgb(0, 0, 0)' || v === '#000000' || v === 'black' || v === '#000')) {
    return false;
  }

  // Don't show font-family if it's generic serif/sans-serif only
  if (key === 'fontFamily') {
    const normalized = v.toLowerCase().replace(/['"]/g, '');
    if (normalized === 'serif' || normalized === 'sans-serif' || normalized === 'times new roman') {
      return false;
    }
  }

  // Line-height: normal is always default
  if (key === 'lineHeight' && v === 'normal') return false;

  // Cursor: auto is default
  if (key === 'cursor' && v === 'auto') return false;

  // Transition: Filter out meaningless transitions
  if (key === 'transition') {
    // "all 0s ease 0s" or similar - meaningless
    if (v.includes('0s') || v === 'all 0s ease 0s' || v === 'none') return false;
    // If it contains a real duration, show it
    const hasDuration = /(\d+\.?\d*)(ms|s)/.test(v);
    if (!hasDuration || v.match(/^all 0+s/)) return false;
  }

  // Background: filter out transparent and rgba(0,0,0,0)
  if (key === 'background' || key === 'backgroundColor') {
    if (v === 'rgba(0, 0, 0, 0)' || v === 'transparent' || v === 'none') return false;
  }

  // Box-shadow: none is default
  if (key === 'boxShadow' && v === 'none') return false;

  // Border-radius: 0px is default
  if (key === 'borderRadius' && (v === '0px' || v === '0')) return false;

  // Opacity: 1 is default
  if (key === 'opacity' && (v === '1' || v === '1.0')) return false;

  // Transform: none is default
  if (key === 'transform' && v === 'none') return false;

  // ===================================
  // PASS: This property is meaningful!
  // ===================================

  return true;
};

export const getElementPath = (el) => {
  const path = [];
  let current = el;

  while (current && current !== document.body && path.length < 10) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      selector += `#${current.id}`;
      path.unshift(selector);
      break;
    }

    if (current.className && typeof current.className === 'string') {
      const classes = current.className.trim().split(/\s+/).filter(c => c && !c.startsWith('di-'));
      if (classes.length > 0) {
        selector += `.${classes[0]}`;
      }
    }

    // Add nth-child for specificity
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(c => c.tagName === current.tagName);
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-child(${index})`;
      }
    }

    path.unshift(selector);
    current = current.parentElement;
  }

  if (current === document.body) {
    path.unshift('body');
  }

  return path;
};

export const getData = (el) => {
  // Check cache first
  const cached = elementDataCache.get(el);
  if (cached && cached.data) return cached.data;

  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();

  let selector = el.tagName.toLowerCase();
  if (el.id) selector += "#" + el.id;
  if (el.className && typeof el.className === 'string') {
    const classes = el.className.trim().split(/\s+/).filter(c => c && !c.startsWith('di-'));
    if (classes.length > 0) selector += "." + classes.join(".");
  }

  const parseBox = (str) => {
    const parts = str.split(' ').map(p => parseFloat(p) || 0);
    if (parts.length === 1) return [parts[0], parts[0], parts[0], parts[0]];
    if (parts.length === 2) return [parts[0], parts[1], parts[0], parts[1]];
    if (parts.length === 3) return [parts[0], parts[1], parts[2], parts[1]];
    return parts;
  };

  const marginValues = parseBox(cs.margin);
  const paddingValues = parseBox(cs.padding);
  const borderValues = parseBox(cs.borderWidth);

  const data = {
    el,
    rect: r,
    selector: selector,
    path: getElementPath(el),
    fontSize: cs.fontSize,
    color: rgbToHex(cs.color),
    background: rgbToHex(cs.backgroundColor),
    margin: cs.margin,
    marginValues: marginValues,
    padding: cs.padding,
    paddingValues: paddingValues,
    borderValues: borderValues,
    width: Math.round(r.width) + "px",
    height: Math.round(r.height) + "px",
    display: cs.display,
    position: cs.position,
    top: cs.top,
    left: cs.left,
    right: cs.right,
    bottom: cs.bottom,
    zIndex: cs.zIndex,
    fontFamily: cs.fontFamily,
    fontWeight: cs.fontWeight,
    lineHeight: cs.lineHeight,
    textAlign: cs.textAlign,
    letterSpacing: cs.letterSpacing,
    textTransform: cs.textTransform,
    textDecoration: cs.textDecoration,
    border: cs.border,
    borderRadius: cs.borderRadius,
    boxShadow: cs.boxShadow,
    outline: cs.outline,
    flexDirection: cs.flexDirection,
    justifyContent: cs.justifyContent,
    alignItems: cs.alignItems,
    flexWrap: cs.flexWrap,
    gap: cs.gap,
    gridTemplateColumns: cs.gridTemplateColumns,
    gridTemplateRows: cs.gridTemplateRows,
    gridGap: cs.gridGap,
    opacity: cs.opacity,
    overflow: cs.overflow,
    cursor: cs.cursor,
    transition: cs.transition,
    transform: cs.transform
  };

  // Cache the data with timestamp for cleanup
  elementDataCache.set(el, { data, timestamp: Date.now() });

  // Schedule cache invalidation on next frame
  if (!cacheInvalidationFrame) {
    setCacheInvalidationFrame(requestAnimationFrame(() => {
      // Clear cache to prevent memory leaks
      elementDataCache.clear();
      setCacheInvalidationFrame(null);
    }));
  }

  return data;
};
