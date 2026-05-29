# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working directory

All work happens inside `dom-inspector-vite/`. The repo root only contains that one subdirectory — `cd dom-inspector-vite` before running any npm or build commands.

## Commands

```bash
npm run dev      # Vite dev server for the popup React app only (not the extension)
npm run build    # vite build -> dist/
npm run lint     # eslint .
npm run preview  # preview built popup
```

To produce a loadable Chrome extension:

```bash
npm run build
mkdir -p chrome-dist
cp -r dist/* chrome-dist/
cp extension/manifest.json chrome-dist/
cp extension/background.js chrome-dist/
# content.js is built by Vite from src/content/index.js → dist/content.js
# the cp dist/* step above already covers it
```

Load `dom-inspector-vite/chrome-dist/` as an unpacked extension. There is no test suite.

## Architecture — two codebases side by side

This is a Chrome MV3 extension with two distinct codebases:

1. **`extension/`** — vanilla JS, the actual extension runtime. Contains `manifest.json`, `background.js` (service worker). `content.js` no longer lives here — it is now built by Vite from `src/content/`.
2. **`src/`** — React 19 + Vite. Builds the toolbar popup (`index.html` → `dist/`) AND the content script (`src/content/index.js` → `dist/content.js`).

These two halves communicate exclusively via `chrome.tabs.sendMessage` / `chrome.runtime.onMessage`. There is no shared module graph — do not import from `src/` into `extension/` or vice versa.

## Architecture rules — NEVER violate these

1. All state lives in `S{}` from `src/content/core/state.js` — no new top-level variables anywhere. Extend `S{}` for new state and clear new fields in `cleanup()`.
2. Modules communicate via `EventBus.emit()` / `EventBus.on()` — never import and call another feature's functions directly across module boundaries.
3. No React in content script — plain DOM manipulation only.
4. All inspector UI elements must have class names starting with `di-` so `isInspectorElement()` correctly excludes them from hover/click inspection.
5. `chrome.*` APIs are available at runtime — never import them as modules.
6. No circular imports. Dependency direction must flow strictly as:
   `constants → state → utils → engine → formatter → features → ui → index`

## Content script conventions

**Idempotency guard**
`window.__DOM_INSPECTOR__` prevents double-init when the popup re-injects the script via `chrome.scripting.executeScript` on every open.

**Centralized state**
One `S{}` object holds every mutable piece of state — mode flags, DOM refs, RAF ids, drag offsets, selected items, timer ids, handlers. Never introduce parallel module-level state.

**Lifecycle**
`STATES = { IDLE, INSPECTING, SELECTED, CLEANING }` — transition only via `setState()`, never write `S.state` directly.

**Performance**
Mouse moves are queued into `S.pendingMouseEvent` and processed in `processMouseMove()` via `requestAnimationFrame`. `getData()` results are memoized in `elementDataCache` and cleared every animation frame. Preserve this pattern for any hover-driven feature — never call `getBoundingClientRect` or `getComputedStyle` directly inside a mousemove handler.

**CSS diffing**
`cssText()` and `isNonDefaultCSS()` filter computed styles against `CSS_DEFAULTS` in `constants.js` so the panel only shows non-default properties. If a new feature introduces properties that should be treated as browser defaults, add them to `CSS_DEFAULTS` in `constants.js`.

**Message dispatch**
`chrome.runtime.onMessage` in `src/content/index.js` handles:
`START_INSPECT`, `CLEAR_OVERLAY`, `TOGGLE_OUTLINE`, `TOGGLE_RULER`, `TOGGLE_RESPONSIVE`
New features that need a popup or context-menu entrypoint wire in here, and add a matching `contextMenus` entry in `extension/background.js`.

**Modes are mutually coordinated, not exclusive**
`outline` / `ruler` / `responsive` each have their own `start*` / `stop*` pair and their own listener attach/detach helpers. They share the FAB menu UI built by `ensureInspectButton()` in `ui/fab.js`.

**Responsive mode**
`enterResponsiveMode()` builds an `<iframe>` around the current page and re-injects the inspector into it via `injectInspectorIntoIframe()`, with a parallel set of `getDataFromIframeElement` / `updateIframeBoxModelLayers` helpers. When changing any inspector internal, check whether the iframe code path in `responsive.js` needs the same change — these two paths can drift silently.

**Don't inspect the inspector**
Any DOM the extension injects must pass through `isInspectorElement()` before being treated as a hover or click target. Always assign `di-` class names to injected elements.

**background.js stays thin**
Two responsibilities only: (a) cache the last `ELEMENT_DATA` payload and serve it on `GET_LAST_ELEMENT`, (b) register `contextMenus` entries. All logic belongs in the content script.

## File map (post-migration)

```
src/content/
├── index.js                     entry point, chrome message bridge, boot()
├── core/
│   ├── state.js                 S{}, EventBus, setState(), isValidState(), STATES
│   ├── constants.js             CSS_DEFAULTS, NEVER_SHOW, viewportPresets
│   └── utils.js                 remove(), rgbToHex(), hexToRgb(), isInspectorElement()
├── css/
│   ├── engine.js                isNonDefaultCSS(), getData(), getElementPath()
│   ├── formatter.js             cssText(), cssTextAll(), cssTextPlain()
│   └── pseudoStates.js          getPseudoStateStyles(), createPseudoStateToggle(), getStateColor()
├── features/
│   ├── inspector.js             startInspect(), stopInspect(), hover/click/key handlers,
│   │                            processMouseMove(), initializeResizeObserver()
│   ├── boxModel.js              updateBoxModelLayers(), hideBoxModelLayers(),
│   │                            clearGridFlexOverlays(), addGridOverlay(), addFlexOverlay()
│   ├── ruler.js                 startRulerMode(), stopRulerMode(), all measurement helpers
│   ├── outline.js               startOutlineMode(), stopOutlineMode()
│   └── responsive.js            enterResponsiveMode(), exitResponsiveMode(),
│                                createViewportFrame(), applyViewport(), all iframe helpers
└── ui/
    ├── fab.js                   ensureInspectButton(), showInspectorButtons(), hideInspectorButtons()
    ├── hoverPanel.js            ensureHoverUI(), updateHoverPanel(), positionHoverPanel()
    ├── selectedPanel.js         addSelected(), ensurePanelContainer(), togglePanelCollapse(),
    │                            createBreadcrumb(), updatePanelItemContent(),
    │                            startDrag(), drag(), stopDrag()
    └── cleanup.js               cleanup()
```

## S{} — current full shape

```js
{
  // Lifecycle
  state: 'IDLE',               // STATES enum value, write only via setState()
  inspecting: false,

  // DOM refs — inspector UI elements
  hoverPanel: null,
  panelContainer: null,
  inspectBtn: null,

  // FAB state
  buttonsVisible: false,
  fabMenuOpen: false,

  // Selection
  selectedItems: [],           // array of { overlay, item, data }

  // Box model overlays
  boxModelLayers: {},          // { margin, border, padding, content }
  gridFlexOverlays: [],

  // Panel UI state
  panelCollapsed: false,
  panelX: null,
  panelY: null,
  isDragging: false,
  dragOffsetX: 0,
  dragOffsetY: 0,

  // Hover tracking
  lastHoveredElement: null,
  rafId: null,
  pendingMouseEvent: null,

  // Scroll debounce
  scrollTimeout: null,

  // Resize observer
  resizeObserver: null,

  // Responsive mode
  currentViewport: { width: window.innerWidth, height: window.innerHeight, name: 'Current' },
  responsiveMode: false,
  responsivePanel: null,
  viewportFrame: null,
  iframeHandlers: null,
  originalViewportMeta: undefined,
  originalBodyOverflow: undefined,

  // Ruler mode
  rulerMode: false,
  rulerLines: [],
  measurementLabels: [],
  firstSelectedElement: null,

  // Outline mode
  outlineMode: false,
  outlineStyleElement: null,

  // Event handler refs (stored for clean removeEventListener calls)
  handlers: {
    mousemove: null,
    click: null,
    keydown: null,
    scroll: null,
    drag: null,
    stopDrag: null,
    rulerMouseMove: null,
    rulerClick: null,
    rulerKeyDown: null,
  }
}
```

## EventBus — current full registry

| Event | Emitter | Listeners | Payload |
|---|---|---|---|
| `state:change` | `state.js` | `fab.js` | newState string |
| `inspector:start` | `inspector.js` | `hoverPanel.js`, `fab.js` | — |
| `inspector:stop` | `inspector.js` | `hoverPanel.js`, `fab.js` | — |
| `inspector:hover` | `inspector.js` | `hoverPanel.js`, `boxModel.js` | data object |
| `inspector:select` | `inspector.js` | `selectedPanel.js`, `boxModel.js` | data object |
| `boxmodel:clear` | `boxModel.js` | (self) | — |
| `ruler:start` | `ruler.js` | `fab.js` | — |
| `ruler:stop` | `ruler.js` | `fab.js`, `cleanup.js` | — |
| `outline:toggle` | `outline.js` | `fab.js` | boolean |
| `responsive:enter` | `responsive.js` | `fab.js`, `cleanup.js` | — |
| `responsive:exit` | `responsive.js` | `fab.js` | — |
| `prefs:loaded` | `prefs.js` | all modules | prefs object |
| `prefs:changed` | `prefs.js` | all modules | prefs object |

## S{} additions log — append here after each feature ships

<!-- Format: fieldName: defaultValue  — FeatureName (YYYY-MM-DD) -->
<!-- Example: passThroughMode: false  — Pass-Through Mode (2026-06-01) -->

## EventBus additions log — append here after each feature ships

<!-- Format: event:name — FeatureName (YYYY-MM-DD) -->
<!-- Example: passthrough:on, passthrough:off  — Pass-Through Mode (2026-06-01) -->