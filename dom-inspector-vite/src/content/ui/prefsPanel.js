import { EventBus } from '../core/state.js';
import {
  getPrefs,
  savePrefs,
  resetPrefs,
  exportPrefs,
  importPrefs,
} from '../features/prefs.js';

let _panel = null;
let _unsubscribe = null;

const COLOR_FIELDS = [
  ['highlightSelectedColor', 'Selected element'],
  ['highlightHoveredColor',  'Hovered element'],
  ['rulerColor',             'Ruler line'],
  ['paddingFillColor',       'Padding fill'],
  ['marginFillColor',        'Margin fill'],
];

const OVERLAY_BOOL_FIELDS = [
  ['showPaddingFill',      'Show padding fill'],
  ['showMarginRing',       'Show margin ring'],
  ['showDimensionBadge',   'Show dimension badge'],
  ['showFlexGapIndicator', 'Show flex gap indicator'],
  ['showGridLines',        'Show grid lines'],
];

const OVERLAY_BORDER_STYLE_OPTIONS = ['solid', 'dashed', 'dotted'];
const OVERLAY_DENSITY_OPTIONS = ['minimal', 'standard', 'detailed'];
const OVERLAY_ANIMATION_OPTIONS = ['off', 'fast', 'default', 'slow'];

const CSS_VIEW_OPTIONS = ['filtered', 'full'];
const CSS_COPY_OPTIONS = ['camelCase', 'kebab-case', 'both'];
const CSS_BOOL_FIELDS = [
  ['cssShowInherited',        'Show inherited properties'],
  ['cssShowComputedOnly',     'Show computed values only'],
  ['cssShowCustomProperties', 'Show custom properties (--vars)'],
  ['cssGroupByCategory',      'Group properties by category'],
];

const RULER_UNIT_OPTIONS = ['px', 'rem', '%'];
const RULER_BOOL_FIELDS = [
  ['rulerShowLabels',          'Show distance labels'],
  ['rulerShowMarginBreakdown', 'Show margin breakdown'],
  ['altHintOnFirstUse',        'Show Alt-key hint on first use'],
];

const NAV_MODE_OPTIONS = ['structure', 'visual'];
const NAV_BOOL_FIELDS = [
  ['arrowNavDisableInIframes',    'Disable arrow nav inside iframes'],
  ['showReactComponentBoundaries','Show React component boundaries'],
  ['autoPinOnSelect',             'Auto-pin selection'],
];

const PANEL_POSITION_OPTIONS = ['right', 'bottom', 'floating'];
const PANEL_DEFAULT_TAB_OPTIONS = ['inspect', 'css', 'box', 'prefs'];
const PANEL_BOOL_FIELDS = [
  ['showBreadcrumb',       'Show breadcrumb'],
  ['showSelectionHistory', 'Show selection history'],
  ['compactMode',          'Compact mode'],
];

const sectionTitleStyle = `
  font-size: 10px;
  color: #4caf50;
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  margin: 14px 0 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(76, 175, 80, 0.25);
`;

const rowStyle = `
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: 6px 0;
  font-size: 11px;
`;

const labelStyle = `
  color: #d4d4d4;
  flex: 1;
`;

const selectStyle = `
  background: #1f1f1f;
  color: #d4d4d4;
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 3px;
  padding: 3px 6px;
  font-size: 11px;
  min-width: 130px;
`;

const numberInputStyle = `
  background: #1f1f1f;
  color: #d4d4d4;
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 3px;
  padding: 3px 6px;
  font-size: 11px;
  width: 80px;
  font-family: monospace;
`;

const hexInputStyle = `
  background: #1f1f1f;
  color: #d4d4d4;
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 3px;
  padding: 3px 6px;
  font-size: 11px;
  width: 90px;
  font-family: monospace;
`;

const colorPickerStyle = `
  width: 26px;
  height: 22px;
  padding: 0;
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 3px;
  background: transparent;
  cursor: pointer;
`;

function section(title) {
  const el = document.createElement('div');
  el.className = 'di-prefs-section';
  const heading = document.createElement('div');
  heading.className = 'di-prefs-section-title';
  heading.textContent = title;
  heading.style.cssText = sectionTitleStyle;
  el.appendChild(heading);
  return el;
}

function row(labelText) {
  const r = document.createElement('div');
  r.className = 'di-prefs-row';
  r.style.cssText = rowStyle;
  const label = document.createElement('span');
  label.className = 'di-prefs-label';
  label.textContent = labelText;
  label.style.cssText = labelStyle;
  r.appendChild(label);
  return r;
}

function buildColorRow(key, labelText, prefs) {
  const r = row(labelText);
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex; align-items:center; gap:6px;';

  const picker = document.createElement('input');
  picker.type = 'color';
  picker.className = 'di-prefs-color-picker';
  picker.value = prefs[key];
  picker.style.cssText = colorPickerStyle;

  const hex = document.createElement('input');
  hex.type = 'text';
  hex.className = 'di-prefs-hex-input';
  hex.value = prefs[key];
  hex.style.cssText = hexInputStyle;

  const sync = (val) => {
    picker.value = val;
    hex.value = val;
  };

  picker.addEventListener('input', () => {
    hex.value = picker.value;
    savePrefs({ [key]: picker.value });
  });
  hex.addEventListener('change', () => {
    const v = hex.value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
      picker.value = v;
      savePrefs({ [key]: v });
    } else {
      // reject invalid, snap back
      sync(getPrefs()[key]);
    }
  });

  wrap.append(picker, hex);
  r.appendChild(wrap);
  return r;
}

function buildSelectRow(key, labelText, options, prefs) {
  const r = row(labelText);
  const select = document.createElement('select');
  select.className = 'di-prefs-select';
  select.style.cssText = selectStyle;
  options.forEach(opt => {
    const o = document.createElement('option');
    o.value = opt;
    o.textContent = opt;
    if (prefs[key] === opt) o.selected = true;
    select.appendChild(o);
  });
  select.addEventListener('change', () => {
    savePrefs({ [key]: select.value });
  });
  r.appendChild(select);
  return r;
}

function buildBoolRow(key, labelText, prefs) {
  const r = row(labelText);
  const toggle = document.createElement('input');
  toggle.type = 'checkbox';
  toggle.className = 'di-prefs-checkbox';
  toggle.checked = !!prefs[key];
  toggle.style.cssText = 'width:14px; height:14px; cursor:pointer;';
  toggle.addEventListener('change', () => {
    savePrefs({ [key]: toggle.checked });
  });
  r.appendChild(toggle);
  return r;
}

function buildNumberRow(key, labelText, min, max, step, prefs) {
  const r = row(labelText);
  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'di-prefs-number-input';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = prefs[key];
  input.style.cssText = numberInputStyle;
  input.addEventListener('change', () => {
    const v = parseFloat(input.value);
    if (Number.isFinite(v)) {
      savePrefs({ [key]: v });
    } else {
      input.value = getPrefs()[key];
    }
  });
  r.appendChild(input);
  return r;
}

function buildColoursSection(prefs) {
  const s = section('Highlight Colours');
  COLOR_FIELDS.forEach(([key, label]) => s.appendChild(buildColorRow(key, label, prefs)));
  return s;
}

function buildOverlaySection(prefs) {
  const s = section('Overlay Style');
  s.appendChild(buildSelectRow('overlayDensity', 'Overlay density', OVERLAY_DENSITY_OPTIONS, prefs));
  OVERLAY_BOOL_FIELDS.forEach(([key, label]) => s.appendChild(buildBoolRow(key, label, prefs)));
  s.appendChild(buildNumberRow('overlayBorderWidth', 'Overlay border width (px)', 0, 10, 0.5, prefs));
  s.appendChild(buildSelectRow('overlayBorderStyle', 'Overlay border style', OVERLAY_BORDER_STYLE_OPTIONS, prefs));
  s.appendChild(buildSelectRow('overlayAnimationSpeed', 'Overlay animation speed', OVERLAY_ANIMATION_OPTIONS, prefs));
  return s;
}

function buildCssSection(prefs) {
  const s = section('CSS Panel');
  s.appendChild(buildSelectRow('cssDefaultView', 'Default view', CSS_VIEW_OPTIONS, prefs));
  s.appendChild(buildSelectRow('cssCopyFormat', 'Copy format', CSS_COPY_OPTIONS, prefs));
  CSS_BOOL_FIELDS.forEach(([key, label]) => s.appendChild(buildBoolRow(key, label, prefs)));
  return s;
}

function buildRulerSection(prefs) {
  const s = section('Ruler');
  s.appendChild(buildSelectRow('rulerUnit', 'Ruler unit', RULER_UNIT_OPTIONS, prefs));
  RULER_BOOL_FIELDS.forEach(([key, label]) => s.appendChild(buildBoolRow(key, label, prefs)));
  s.appendChild(buildNumberRow('rulerLineThickness', 'Ruler line thickness (px)', 1, 6, 1, prefs));
  return s;
}

function buildNavSection(prefs) {
  const s = section('Navigation');
  s.appendChild(buildSelectRow('defaultNavMode', 'Default nav mode', NAV_MODE_OPTIONS, prefs));
  NAV_BOOL_FIELDS.forEach(([key, label]) => s.appendChild(buildBoolRow(key, label, prefs)));
  s.appendChild(buildNumberRow('selectionHistorySize', 'Selection history size', 1, 100, 1, prefs));
  s.appendChild(buildNumberRow('passThroughAutoToggleDelay', 'Pass-through auto-toggle delay (s)', 0, 30, 1, prefs));
  return s;
}

function buildLayoutSection(prefs) {
  const s = section('Panel Layout');
  s.appendChild(buildSelectRow('panelPosition', 'Panel position', PANEL_POSITION_OPTIONS, prefs));
  s.appendChild(buildNumberRow('panelWidth', 'Panel width (px)', 240, 800, 10, prefs));
  s.appendChild(buildSelectRow('panelDefaultTab', 'Default tab', PANEL_DEFAULT_TAB_OPTIONS, prefs));
  PANEL_BOOL_FIELDS.forEach(([key, label]) => s.appendChild(buildBoolRow(key, label, prefs)));
  return s;
}

function triggerDownload(jsonString) {
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'dom-inspector-prefs.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function buildBottomActions(panel) {
  const wrap = document.createElement('div');
  wrap.className = 'di-prefs-actions';
  wrap.style.cssText = `
    margin-top: 18px;
    padding-top: 12px;
    border-top: 1px solid rgba(255,255,255,0.1);
    display: flex;
    flex-direction: column;
    gap: 8px;
  `;

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex; gap:8px;';

  const exportBtn = document.createElement('button');
  exportBtn.className = 'di-prefs-export-btn';
  exportBtn.textContent = 'Export config';
  Object.assign(exportBtn.style, {
    flex: '1',
    padding: '6px 10px',
    border: '1px solid rgba(79, 195, 247, 0.4)',
    background: 'rgba(79, 195, 247, 0.15)',
    color: '#4fc3f7',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: '600',
  });
  exportBtn.addEventListener('click', () => {
    triggerDownload(exportPrefs());
  });

  const importBtn = document.createElement('button');
  importBtn.className = 'di-prefs-import-btn';
  importBtn.textContent = 'Import config';
  Object.assign(importBtn.style, {
    flex: '1',
    padding: '6px 10px',
    border: '1px solid rgba(106, 90, 205, 0.4)',
    background: 'rgba(106, 90, 205, 0.15)',
    color: '#9370db',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: '600',
  });

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'application/json,.json';
  fileInput.className = 'di-prefs-import-file';
  fileInput.style.display = 'none';

  importBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      await importPrefs(text);
      renderInto(panel.parentElement);
    } catch (e) {
      const err = document.createElement('div');
      err.style.cssText = 'color:#f44336; font-size:11px; margin-top:6px;';
      err.textContent = e.message || 'Import failed';
      btnRow.parentElement.appendChild(err);
      setTimeout(() => err.remove(), 3000);
    } finally {
      fileInput.value = '';
    }
  });

  btnRow.append(exportBtn, importBtn, fileInput);
  wrap.appendChild(btnRow);

  const resetWrap = document.createElement('div');
  resetWrap.className = 'di-prefs-reset-wrap';
  resetWrap.style.cssText = 'display:flex; align-items:center; justify-content:flex-end; gap:8px;';

  const resetLink = document.createElement('a');
  resetLink.className = 'di-prefs-reset-link';
  resetLink.href = '#';
  resetLink.textContent = 'Reset to defaults';
  resetLink.style.cssText = 'color:#999; font-size:11px; text-decoration:underline; cursor:pointer;';

  resetLink.addEventListener('click', (e) => {
    e.preventDefault();
    if (resetWrap.querySelector('.di-prefs-reset-confirm')) return;
    const confirm = document.createElement('span');
    confirm.className = 'di-prefs-reset-confirm';
    confirm.style.cssText = 'display:flex; gap:6px; align-items:center; font-size:11px;';
    confirm.innerHTML = '<span style="color:#f44336;">Are you sure?</span>';
    const yes = document.createElement('button');
    yes.textContent = 'Yes, reset';
    yes.style.cssText = 'padding:3px 8px; background:#f44336; color:#fff; border:none; border-radius:3px; cursor:pointer; font-size:11px;';
    const no = document.createElement('button');
    no.textContent = 'Cancel';
    no.style.cssText = 'padding:3px 8px; background:transparent; color:#999; border:1px solid rgba(255,255,255,0.2); border-radius:3px; cursor:pointer; font-size:11px;';
    yes.addEventListener('click', async () => {
      await resetPrefs();
      renderInto(panel.parentElement);
    });
    no.addEventListener('click', () => confirm.remove());
    confirm.append(yes, no);
    resetWrap.insertBefore(confirm, resetLink);
  });

  resetWrap.appendChild(resetLink);
  wrap.appendChild(resetWrap);
  return wrap;
}

function renderInto(container) {
  if (!container) return;
  destroyPrefsPanel();

  const prefs = getPrefs();

  _panel = document.createElement('div');
  _panel.className = 'di-prefs-panel';
  Object.assign(_panel.style, {
    padding: '4px 2px',
    color: '#e0e0e0',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  });

  _panel.appendChild(buildColoursSection(prefs));
  _panel.appendChild(buildOverlaySection(prefs));
  _panel.appendChild(buildCssSection(prefs));
  _panel.appendChild(buildRulerSection(prefs));
  _panel.appendChild(buildNavSection(prefs));
  _panel.appendChild(buildLayoutSection(prefs));
  _panel.appendChild(buildBottomActions(_panel));

  container.appendChild(_panel);

  _unsubscribe = EventBus.on('prefs:changed', (newPrefs) => {
    EventBus.emit('prefs:applied', newPrefs);
  });
}

export function renderPrefsPanel(container) {
  renderInto(container);
}

export function destroyPrefsPanel() {
  if (_unsubscribe) {
    _unsubscribe();
    _unsubscribe = null;
  }
  if (_panel) {
    _panel.remove();
    _panel = null;
  }
  document.querySelectorAll('.di-prefs-panel').forEach(el => el.remove());
}
