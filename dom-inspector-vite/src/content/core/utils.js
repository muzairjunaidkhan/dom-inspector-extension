import { S } from './state.js';

/*  UTILS  */
export const remove = (el) => {
  if (el && el.parentNode) {
    el.parentNode.removeChild(el);
  }
};

export function isInspectorElement(el) {
  if (!el) return false;
  return el === S.inspectBtn ||
    el === S.hoverPanel ||
    el === S.panelContainer ||
    (S.inspectBtn && S.inspectBtn.contains(el)) ||
    (S.panelContainer && S.panelContainer.contains(el)) ||
    el.classList.contains('di-fab-container') ||
    el.classList.contains('di-fab-menu') ||
    el.classList.contains('di-fab-menu-item') ||
    el.classList.contains('di-inspect-btn') ||
    el.classList.contains('di-hover-panel') ||
    el.classList.contains('di-selected-panel') ||
    el.classList.contains('di-selected-overlay') ||
    el.classList.contains('di-panel-item') ||
    el.classList.contains('di-button') ||
    el.classList.contains('di-box-layer') ||
    el.classList.contains('di-panel-header') ||
    el.classList.contains('di-collapse-btn') ||
    el.classList.contains('di-grid-overlay') ||
    el.classList.contains('di-flex-overlay') ||
    el.classList.contains('di-breadcrumb');
}

export function hexToRgb(hex) {
  // Simple hex to rgb converter for label backgrounds
  const colors = {
    '#e67e22': '230, 126, 34',
    '#e74c3c': '231, 76, 60',
    '#9b59b6': '155, 89, 182',
    '#2ecc71': '46, 204, 113'
  };
  return colors[hex] || '230, 126, 34';
}
// Convert RGB/RGBA to Hex
export function rgbToHex(rgb) {
  // Handle already hex values
  if (rgb.startsWith('#')) return rgb;

  // Handle named colors
  const namedColors = {
    'black': '#000000',
    'white': '#ffffff',
    'red': '#ff0000',
    'green': '#008000',
    'blue': '#0000ff',
    'yellow': '#ffff00',
    'cyan': '#00ffff',
    'magenta': '#ff00ff',
    'transparent': 'transparent'
  };

  const lowerRgb = rgb.toLowerCase();
  if (namedColors[lowerRgb]) return namedColors[lowerRgb];

  // Handle rgba and rgb
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!match) return rgb; // Return original if no match

  const r = parseInt(match[1]);
  const g = parseInt(match[2]);
  const b = parseInt(match[3]);
  const a = match[4] ? parseFloat(match[4]) : 1;

  // If alpha is not 1, keep rgba format but add hex equivalent
  if (a < 1) {
    const hex = '#' + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
    return `${hex} (${Math.round(a * 100)}% opacity)`;
  }

  // Convert to hex
  const hex = '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');

  return hex;
}
