import { EventBus } from '../core/state.js';

export const DEFAULT_PREFS = {
  // Highlight colours
  highlightSelectedColor: '#378ADD',
  highlightHoveredColor:  '#EF9F27',
  rulerColor:             '#E2484A',
  paddingFillColor:       '#1D9E75',
  marginFillColor:        '#EF9F27',

  // Overlay style
  overlayDensity:           'standard',
  showPaddingFill:          true,
  showMarginRing:           true,
  showDimensionBadge:       true,
  showFlexGapIndicator:     true,
  showGridLines:            false,
  overlayBorderWidth:       1.5,
  overlayBorderStyle:       'solid',
  overlayAnimationSpeed:    'default',

  // CSS panel
  cssDefaultView:           'filtered',
  cssCopyFormat:            'camelCase',
  cssShowInherited:         false,
  cssShowComputedOnly:      false,
  cssShowCustomProperties:  true,
  cssGroupByCategory:       false,

  // Ruler
  rulerUnit:                'px',
  rulerShowLabels:          true,
  rulerLineThickness:       1,
  rulerShowMarginBreakdown: true,
  altHintOnFirstUse:        true,

  // Navigation
  defaultNavMode:           'structure',
  arrowNavDisableInIframes: true,
  showReactComponentBoundaries: false,
  selectionHistorySize:     20,
  autoPinOnSelect:          false,
  passThroughAutoToggleDelay: 3,

  // Panel layout
  panelPosition:            'right',
  panelWidth:               320,
  panelDefaultTab:          'inspect',
  showBreadcrumb:           true,
  showSelectionHistory:     true,
  compactMode:              false,
};

const STORAGE_KEY = 'dom-inspector-prefs';
let currentPrefs = { ...DEFAULT_PREFS };

const isStorageAvailable = () => {
  try {
    return typeof chrome !== 'undefined'
      && chrome.storage
      && chrome.storage.sync
      && typeof chrome.storage.sync.get === 'function';
  } catch (e) {
    return false;
  }
};

const writeStorage = async (prefs) => {
  if (!isStorageAvailable()) return;
  try {
    await chrome.storage.sync.set({ [STORAGE_KEY]: prefs });
  } catch (e) {
    // silent fallback — invalid extension context, quota, etc.
  }
};

export async function loadPrefs() {
  if (!isStorageAvailable()) {
    currentPrefs = { ...DEFAULT_PREFS };
    EventBus.emit('prefs:loaded', currentPrefs);
    return currentPrefs;
  }
  try {
    const stored = await chrome.storage.sync.get(STORAGE_KEY);
    const found = stored && stored[STORAGE_KEY];
    currentPrefs = { ...DEFAULT_PREFS, ...(found && typeof found === 'object' ? found : {}) };
  } catch (e) {
    currentPrefs = { ...DEFAULT_PREFS };
  }
  EventBus.emit('prefs:loaded', currentPrefs);
  return currentPrefs;
}

export async function savePrefs(updates) {
  currentPrefs = { ...currentPrefs, ...(updates || {}) };
  await writeStorage(currentPrefs);
  EventBus.emit('prefs:changed', currentPrefs);
  return currentPrefs;
}

export function getPrefs() {
  return currentPrefs;
}

export async function resetPrefs() {
  currentPrefs = { ...DEFAULT_PREFS };
  await writeStorage(currentPrefs);
  EventBus.emit('prefs:changed', currentPrefs);
  return currentPrefs;
}

export function exportPrefs() {
  return JSON.stringify(currentPrefs, null, 2);
}

export async function importPrefs(jsonString) {
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (e) {
    throw new Error('Invalid preferences JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid preferences JSON');
  }
  currentPrefs = { ...DEFAULT_PREFS, ...parsed };
  await writeStorage(currentPrefs);
  EventBus.emit('prefs:changed', currentPrefs);
  return currentPrefs;
}
