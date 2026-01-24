# DOM Inspector 🔍

A powerful, lightweight browser extension for inspecting and analyzing DOM elements with real-time CSS visualization, box model overlays, and advanced debugging features.

## ✨ Features

### Core Functionality
- **Interactive Element Inspection** - Click-to-select any element on the page
- **Real-time Box Model Visualization** - See margin (orange), border (yellow), and content (blue) layers
- **Grid/Flex Visual Helpers** - Visual overlays for CSS Grid and Flexbox layouts
- **CSS Diff View** - Shows only non-default CSS properties for cleaner analysis
- **Breadcrumb Navigation** - Click through the element hierarchy
- **Pseudo-State Inspector** - Toggle `:hover`, `:focus`, and `:active` states
- **Multi-Element Selection** - Select and compare multiple elements
- **One-Click CSS Copy** - Copy computed styles to clipboard

### User Experience
- **Draggable Panels** - Reposition the inspector panel anywhere on screen
- **Collapsible Interface** - Minimize panels when not in use
- **Keyboard Shortcuts** - Press `C` to copy CSS, `ESC` to exit inspection
- **Performance Optimized** - Uses RequestAnimationFrame for smooth interactions
- **Smart Filtering** - Ignores inspector UI elements during selection

## 🚀 Installation

### As a Browser Extension
1. Clone this repository
2. Open your browser's extension management page:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Firefox: `about:addons`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension directory

## 📖 Commands
npm run build
mkdir chrome-dist
cp -r dist/* chrome-dist/  
cp extension/* chrome-dist/

### Basic Inspection
1. Click the **"Inspect"** button (bottom-right corner)
2. Hover over any element to see its properties
3. Click to select and add to the inspection panel
4. Press `ESC` to exit inspection mode

### Keyboard Shortcuts
- `C` - Copy CSS of currently hovered element
- `ESC` - Exit inspection mode

### Panel Features
- **Breadcrumb Navigation** - Click any parent in the path to inspect it
- **Pseudo-State Toggles** - Force hover/focus/active states
- **Copy CSS** - Export complete CSS for any selected element
- **Remove** - Clear individual selections

## 🎨 Visual Indicators

| Color | Meaning |
|-------|---------|
| 🟧 Orange | Margin area |
| 🟨 Yellow | Border area |
| 🔵 Blue | Content area |
| 🟩 Green | Selected element |
| 🟪 Purple (dashed) | CSS Grid layout |
| 🔷 Blue (dashed) | Flexbox layout |

## 🛠️ Technical Stack

- **Pure JavaScript** - No dependencies
- **Modern CSS** - Backdrop filters, animations
- **Chrome Extension API** - Message passing for extension integration
- **RequestAnimationFrame** - Performance-optimized rendering

## 📁 Project Structure

```
dom-inspector/
├── manifest.json          # Extension manifest
├── content.js            # Main inspector logic
├── background.js         # Extension background script
├── popup.html           # Extension popup UI
├── README.md            # This file
└── docs/
    └── TECHNICAL.md     # Detailed technical documentation
```

## 🔧 Configuration

### Default CSS Values
The inspector uses a predefined set of default CSS values to highlight only meaningful changes. These can be customized in the `DEFAULT_CSS` object:

```javascript
const DEFAULT_CSS = {
  display: 'inline',
  position: 'static',
  margin: '0px',
  // ... more defaults
};
```

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🐛 Known Issues

- Pseudo-state forcing may not work with all CSS frameworks
- Fixed/sticky positioned elements may show incorrect overlays during scroll
- Very deeply nested elements (>10 levels) truncate breadcrumb paths

## 📝 License

MIT License - feel free to use this in your projects!

## 🙏 Acknowledgments

Inspired by browser DevTools and existing inspection tools like:
- Chrome DevTools Element Inspector
- Firefox Inspector
- Pesticide for Chrome
- VisBug

## 📞 Support

- Report bugs via [GitHub Issues](https://github.com/yourusername/dom-inspector/issues)
- Questions? Check the [Technical Documentation](docs/TECHNICAL.md)
- Feature requests welcome!

---

**Made with ❤️ for web developers**