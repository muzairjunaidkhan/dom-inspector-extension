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

To produce a loadable Chrome extension (per README), build then merge popup output with the static extension files:

```bash
npm run build
mkdir chrome-dist
cp -r dist/* chrome-dist/
cp extension/* chrome-dist/
```

Load `dom-inspector-vite/chrome-dist/` as an unpacked extension. There is no test suite.

## Architecture

This is a Chrome MV3 extension with **two distinct codebases living side-by-side**:

1. **`extension/`** — vanilla JS, the actual extension runtime. Hand-edited, copied verbatim into `chrome-dist/` at packaging time. Contains `manifest.json`, `background.js` (service worker), and `content.js` (the inspector).
2. **`src/`** — React 19 + Vite, builds *only* the toolbar popup (`index.html` → `dist/`). The popup is a 200px-wide panel with two buttons that send messages to the content script.

These two halves communicate exclusively via `chrome.tabs.sendMessage` / `chrome.runtime.onMessage`. There is no shared module graph — do not try to import from `src/` into `extension/` or vice versa.

### content.js is the product

`extension/content.js` is ~4700 lines of vanilla JS in a single IIFE and contains essentially all behavior the user sees. Key conventions:

- **Idempotency guard**: `window.__DOM_INSPECTOR__` prevents double-init when injected twice (the popup re-injects via `chrome.scripting.executeScript` every time).
- **Centralized state**: one `S` object holds every mutable piece of state (mode flags, DOM refs, RAF id, drag offsets, selected items, handlers, etc.). Don't introduce parallel module-level state — extend `S` and clear it in `cleanup()`.
- **Lifecycle**: `STATES = { IDLE, INSPECTING, SELECTED, CLEANING }`, transitioned via `setState()`.
- **Message dispatch**: the listener at the bottom of `content.js` handles `START_INSPECT`, `CLEAR_OVERLAY`, `TOGGLE_OUTLINE`, `TOGGLE_RULER`, `TOGGLE_RESPONSIVE`. New features that need an entrypoint from the popup or context menu wire in here.
- **Modes are mutually-coordinated, not exclusive**: outline / ruler / responsive each have their own `start*` / `stop*` pair and their own listener attach/detach helpers. They share the FAB menu UI built by `ensureInspectButton()`.
- **Don't inspect the inspector**: any DOM the extension injects must be filtered by `isInspectorElement()` before being treated as a hover/click target.
- **Performance**: mouse moves are queued into `S.pendingMouseEvent` and processed via `requestAnimationFrame` in `processMouseMove()`. `getData()` results are memoized in `elementDataCache` and the cache is cleared every animation frame. Preserve this pattern when adding hover-driven features.
- **CSS diffing**: `cssText()` / `isNonDefaultCSS()` filter against the `CSS_DEFAULTS` table so the panel only shows non-default properties. Extend `CSS_DEFAULTS` if you add new properties that should be considered "default".

### background.js

Two responsibilities only: (a) caches the last `ELEMENT_DATA` payload from `content.js` and serves it back on `GET_LAST_ELEMENT`, and (b) registers the `chrome.contextMenus` entries that map right-click items to the `TOGGLE_*` / `START_INSPECT` messages. Keep it thin — actual logic belongs in `content.js`.

### Responsive mode

`enterResponsiveMode()` builds an `<iframe>` chrome around the current page and **re-injects the inspector into the iframe** (`injectInspectorIntoIframe`), with a parallel set of `getDataFromIframeElement` / `update*BoxModelLayers` helpers. When changing inspector internals, check whether the iframe path needs the same change — the two code paths can drift.

## Editing notes

- `content.js` is the source of truth; `chrome-dist/content.js` is a build artifact (overwritten by the `cp extension/* chrome-dist/` step). Edit the one in `extension/`.
- Manifest permissions are minimal (`activeTab`, `scripting`, `contextMenus`). Adding host permissions or new APIs requires updating `extension/manifest.json`.
- The popup React app is tiny and largely a launcher — most features should be added in `content.js`, not the React side.
