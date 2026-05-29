// Lifecycle states
export const STATES = {
  IDLE: 'IDLE',
  INSPECTING: 'INSPECTING',
  SELECTED: 'SELECTED',
  CLEANING: 'CLEANING'
};

export const S = {
  state: STATES.IDLE,
  inspecting: false,
  hoverPanel: null,
  panelContainer: null,
  inspectBtn: null,
  buttonsVisible: false,
  fabMenuOpen: false,
  selectedItems: [],
  boxModelLayers: {},
  panelCollapsed: false,
  panelX: null,
  panelY: null,
  isDragging: false,
  dragOffsetX: 0,
  dragOffsetY: 0,
  lastHoveredElement: null,
  rafId: null,
  pendingMouseEvent: null,
  gridFlexOverlays: [],
  scrollTimeout: null,
  resizeObserver: null,
  currentViewport: { width: window.innerWidth, height: window.innerHeight, name: 'Current' },
  responsiveMode: false,
  responsivePanel: null,
  viewportFrame: null,
  iframeHandlers: null,
  originalViewportMeta: undefined,
  originalBodyOverflow: undefined,
  rulerMode: false,
  rulerLines: [],
  measurementLabels: [],
  firstSelectedElement: null,
  outlineMode: false,
  outlineStyleElement: null,
  handlers: {
    mousemove: null,
    click: null,
    keydown: null,
    scroll: null,
    drag: null,
    stopDrag: null
  }
};
// Cache for element data to reduce recalculations
export const elementDataCache = new Map();
export let cacheInvalidationFrame = null;
export const setCacheInvalidationFrame = (v) => { cacheInvalidationFrame = v; };

export const isValidState = () => {
  return window.__DOM_INSPECTOR__ && S.state !== STATES.CLEANING;
};

export const setState = (newState) => {
  console.log(`[DOM Inspector] ${S.state} → ${newState}`);
  S.state = newState;
};

const _busListeners = new Map();
export const EventBus = {
  on(event, fn) {
    if (!_busListeners.has(event)) _busListeners.set(event, new Set());
    _busListeners.get(event).add(fn);
    return () => EventBus.off(event, fn);
  },
  off(event, fn) {
    _busListeners.get(event)?.delete(fn);
  },
  emit(event, payload) {
    const fns = _busListeners.get(event);
    if (!fns) return;
    fns.forEach(fn => {
      try { fn(payload); } catch (e) { console.error(`[EventBus] error in '${event}' listener:`, e); }
    });
  }
};
