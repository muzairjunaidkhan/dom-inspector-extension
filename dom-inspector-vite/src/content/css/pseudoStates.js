// NEW FUNCTION - Detects if element has pseudo-state styles
export const getPseudoStateStyles = (el) => {
  const pseudoStates = {
    hover: null,
    focus: null,
    active: null,
    'focus-visible': null
  };

  try {
    // Get all stylesheets
    const sheets = Array.from(document.styleSheets);

    // Helper to check if selector matches element
    const selectorMatchesElement = (selector, element) => {
      try {
        // Remove pseudo-class from selector to test base match
        const baseSelector = selector.replace(/:(hover|focus|active|focus-visible).*/, '').trim();
        if (!baseSelector) return false;
        return element.matches(baseSelector);
      } catch (e) {
        return false;
      }
    };

    sheets.forEach(sheet => {
      try {
        const rules = sheet.cssRules || sheet.rules;
        if (!rules) return;

        Array.from(rules).forEach(rule => {
          if (rule.type !== CSSRule.STYLE_RULE) return;

          const selector = rule.selectorText;
          if (!selector) return;

          // Check each pseudo-state
          ['hover', 'focus', 'active', 'focus-visible'].forEach(state => {
            const pseudoRegex = new RegExp(`:${state}\\b`);

            if (pseudoRegex.test(selector) && selectorMatchesElement(selector, el)) {
              // Found matching pseudo-state rule
              const cssText = rule.style.cssText;

              if (cssText && cssText.trim()) {
                if (!pseudoStates[state]) {
                  pseudoStates[state] = [];
                }

                // Parse individual properties
                const properties = {};
                Array.from(rule.style).forEach(prop => {
                  properties[prop] = rule.style.getPropertyValue(prop);
                });

                pseudoStates[state].push({
                  selector: selector,
                  properties: properties,
                  cssText: cssText
                });
              }
            }
          });
        });
      } catch (e) {
        // CORS or other sheet access error - skip
      }
    });
  } catch (error) {
    console.warn('[DOM Inspector] Error detecting pseudo-states:', error);
  }

  return pseudoStates;
};

/*  PSEUDO-STATE INSPECTOR  */
export function createPseudoStateToggle(data) {
  // Detect pseudo-state styles for this element
  const pseudoStates = getPseudoStateStyles(data.el);

  // Check if element has any pseudo-state styles
  const hasAnyPseudoStates = Object.values(pseudoStates).some(state => state && state.length > 0);

  // Don't show panel if no pseudo-states exist
  if (!hasAnyPseudoStates) {
    return null;
  }

  const container = document.createElement("div");
  container.className = "di-pseudo-state-panel";
  container.style.cssText = `
  background: linear-gradient(135deg, rgba(45, 45, 45, 0.95) 0%, rgba(35, 35, 35, 0.95) 100%);
  padding: 10px;
  margin: 10px 0;
  border-radius: 6px;
  border: 1px solid rgba(76, 175, 80, 0.3);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3);
`;

  const header = document.createElement("div");
  header.style.cssText = `
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
`;

  const icon = document.createElement("span");
  icon.textContent = "🎨";
  icon.style.fontSize = "14px";

  const title = document.createElement("div");
  title.textContent = "Pseudo States";
  title.style.cssText = `
  font-size: 11px;
  color: #4caf50;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

  header.appendChild(icon);
  header.appendChild(title);
  container.appendChild(header);

  const states = ['hover', 'focus', 'active', 'focus-visible'];

  states.forEach(state => {
    const stateData = pseudoStates[state];
    if (!stateData || stateData.length === 0) return; // Skip if no styles for this state

    const stateContainer = document.createElement("div");
    stateContainer.className = `di-pseudo-${state}-container`;
    stateContainer.style.cssText = `
    margin-bottom: 8px;
    border-left: 3px solid ${getStateColor(state)};
    padding-left: 8px;
  `;

    const stateHeader = document.createElement("div");
    stateHeader.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  `;

    const stateLabel = document.createElement("span");
    stateLabel.textContent = `:${state}`;
    stateLabel.style.cssText = `
    font-size: 11px;
    color: ${getStateColor(state)};
    font-weight: 600;
    font-family: monospace;
  `;

    const toggleBtn = document.createElement("button");
    toggleBtn.textContent = "Force";
    toggleBtn.className = `di-pseudo-btn di-pseudo-${state}`;
    Object.assign(toggleBtn.style, {
      padding: "3px 8px",
      border: `1px solid ${getStateColor(state)}`,
      background: "rgba(255, 255, 255, 0.05)",
      color: getStateColor(state),
      borderRadius: "3px",
      cursor: "pointer",
      fontSize: "10px",
      fontWeight: "500",
      transition: "all 0.2s",
      fontFamily: "system-ui, sans-serif"
    });

    let isActive = false;
    const styleId = `di-pseudo-force-${state}-${Date.now()}`;

    toggleBtn.onclick = (e) => {
      e.stopPropagation();
      isActive = !isActive;

      if (isActive) {
        toggleBtn.textContent = "✓ Active";
        toggleBtn.style.background = getStateColor(state);
        toggleBtn.style.color = "#fff";
        toggleBtn.style.fontWeight = "600";

        // Apply actual pseudo-state styles
        const uniqueClass = `di-force-${state}-${Date.now()}`;
        data.el.classList.add(uniqueClass);

        let style = document.getElementById(styleId);
        if (!style) {
          style = document.createElement("style");
          style.id = styleId;
          document.head.appendChild(style);
        }

        // Build CSS from detected pseudo-state rules
        let cssRules = '';
        stateData.forEach(rule => {
          const properties = Object.entries(rule.properties)
            .map(([prop, value]) => `  ${prop}: ${value} !important;`)
            .join('\n');

          cssRules += `.${uniqueClass} {\n${properties}\n}\n`;
        });

        style.textContent = cssRules;

      } else {
        toggleBtn.textContent = "Force";
        toggleBtn.style.background = "rgba(255, 255, 255, 0.05)";
        toggleBtn.style.color = getStateColor(state);
        toggleBtn.style.fontWeight = "500";

        // Remove forced styles
        const style = document.getElementById(styleId);
        if (style) {
          document.head.removeChild(style);
        }

        // Remove all classes that start with di-force-{state}
        const classesToRemove = Array.from(data.el.classList)
          .filter(c => c.startsWith(`di-force-${state}`));
        classesToRemove.forEach(c => data.el.classList.remove(c));
      }
    };

    stateHeader.appendChild(stateLabel);
    stateHeader.appendChild(toggleBtn);
    stateContainer.appendChild(stateHeader);

    // Show CSS properties for this pseudo-state
    const cssDisplay = document.createElement("div");
    cssDisplay.style.cssText = `
    background: rgba(0, 0, 0, 0.3);
    padding: 6px 8px;
    border-radius: 3px;
    font-size: 10px;
    line-height: 1.4;
    color: #b5cea8;
    max-height: 120px;
    overflow-y: auto;
  `;

    // Combine all properties from all matching rules
    const allProperties = {};
    stateData.forEach(rule => {
      Object.entries(rule.properties).forEach(([prop, value]) => {
        allProperties[prop] = value; // Later rules override
      });
    });

    const propertiesText = Object.entries(allProperties)
      .map(([prop, value]) => `<span style="color: #9cdcfe;">${prop}</span>: <span style="color: #ce9178;">${value}</span>;`)
      .join('<br>');

    cssDisplay.innerHTML = `:${state} {<br>${propertiesText}<br>}`;
    stateContainer.appendChild(cssDisplay);

    container.appendChild(stateContainer);
  });

  return container;
}

// Helper function for state colors
export function getStateColor(state) {
  const colors = {
    'hover': '#ff9800',
    'focus': '#2196f3',
    'active': '#f44336',
    'focus-visible': '#9c27b0'
  };
  return colors[state] || '#4caf50';
}
