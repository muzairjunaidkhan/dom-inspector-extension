import { isNonDefaultCSS } from './engine.js';

// Generate colorized CSS text showing ALL properties (no filtering)
export const cssTextAll = (d) => {
  const properties = [
    // Box Model
    { key: 'display', color: '#f9d71c', important: true },
    { key: 'position', color: '#f9d71c', important: true },
    { key: 'width', color: '#b5cea8' },
    { key: 'height', color: '#b5cea8' },
    { key: 'margin', color: '#f6b26b' },
    { key: 'padding', color: '#8bc3f5' },

    // Positioning
    { key: 'top', color: '#b5cea8' },
    { key: 'left', color: '#b5cea8' },
    { key: 'right', color: '#b5cea8' },
    { key: 'bottom', color: '#b5cea8' },
    { key: 'zIndex', label: 'z-index', color: '#b5cea8' },

    // Typography
    { key: 'fontSize', label: 'font-size', color: '#b5cea8', important: true },
    { key: 'fontFamily', label: 'font-family', color: '#ce9178' },
    { key: 'fontWeight', label: 'font-weight', color: '#b5cea8' },
    { key: 'lineHeight', label: 'line-height', color: '#b5cea8' },
    { key: 'color', color: '#ce9178', important: true },
    { key: 'textAlign', label: 'text-align', color: '#9cdcfe' },
    { key: 'letterSpacing', label: 'letter-spacing', color: '#b5cea8' },
    { key: 'textTransform', label: 'text-transform', color: '#9cdcfe' },
    { key: 'textDecoration', label: 'text-decoration', color: '#9cdcfe' },

    // Visual
    { key: 'background', color: '#ce9178' },
    { key: 'border', color: '#dcdcaa' },
    { key: 'borderRadius', label: 'border-radius', color: '#dcdcaa' },
    { key: 'boxShadow', label: 'box-shadow', color: '#dcdcaa' },
    { key: 'opacity', color: '#b5cea8' },

    // Flexbox
    { key: 'flexDirection', label: 'flex-direction', color: '#569cd6' },
    { key: 'justifyContent', label: 'justify-content', color: '#569cd6' },
    { key: 'alignItems', label: 'align-items', color: '#569cd6' },
    { key: 'flexWrap', label: 'flex-wrap', color: '#569cd6' },
    { key: 'gap', color: '#569cd6' },

    // Grid
    { key: 'gridTemplateColumns', label: 'grid-template-columns', color: '#9333ea' },
    { key: 'gridTemplateRows', label: 'grid-template-rows', color: '#9333ea' },
    { key: 'gridGap', label: 'grid-gap', color: '#9333ea' },

    // Other
    { key: 'overflow', color: '#9cdcfe' },
    { key: 'transform', color: '#dcdcaa' },
    { key: 'transition', color: '#dcdcaa' }
  ];

  let cssLines = [];

  properties.forEach(prop => {
    const value = d[prop.key];
    const label = prop.label || prop.key;

    // Show everything - no filtering
    if (value) {
      cssLines.push(`
  <div style="margin-bottom: 2px;">
    <span style="color: #9cdcfe;">${label}</span><span style="color: #666;">:</span> <span style="color: ${prop.color};">${value}</span><span style="color: #666;">;</span>
  </div>
`);
    }
  });

  return cssLines.join('');
};

// Generate colorized CSS text with only non-default values
export const cssText = (d, showAll = false) => {
  const properties = [
    { key: 'display', color: '#f9d71c', important: true, group: 'layout' },
    { key: 'position', color: '#f9d71c', important: true, group: 'layout' },

    { key: 'top', color: '#b5cea8', group: 'position' },
    { key: 'left', color: '#b5cea8', group: 'position' },
    { key: 'right', color: '#b5cea8', group: 'position' },
    { key: 'bottom', color: '#b5cea8', group: 'position' },
    { key: 'zIndex', label: 'z-index', color: '#b5cea8', group: 'position' },

    { key: 'margin', color: '#f6b26b', group: 'box-model' },
    { key: 'padding', color: '#8bc3f5', group: 'box-model' },
    { key: 'border', color: '#dcdcaa', group: 'box-model' },
    { key: 'borderRadius', label: 'border-radius', color: '#dcdcaa', group: 'box-model' },

    { key: 'fontSize', label: 'font-size', color: '#b5cea8', important: true, group: 'typography' },
    { key: 'fontFamily', label: 'font-family', color: '#ce9178', group: 'typography' },
    { key: 'fontWeight', label: 'font-weight', color: '#b5cea8', group: 'typography' },
    { key: 'lineHeight', label: 'line-height', color: '#b5cea8', group: 'typography' },
    { key: 'color', color: '#ce9178', important: true, group: 'typography' },
    { key: 'textAlign', label: 'text-align', color: '#9cdcfe', group: 'typography' },
    { key: 'letterSpacing', label: 'letter-spacing', color: '#b5cea8', group: 'typography' },
    { key: 'textTransform', label: 'text-transform', color: '#9cdcfe', group: 'typography' },
    { key: 'textDecoration', label: 'text-decoration', color: '#9cdcfe', group: 'typography' },

    { key: 'flexDirection', label: 'flex-direction', color: '#569cd6', flexOnly: true, group: 'flexbox' },
    { key: 'justifyContent', label: 'justify-content', color: '#569cd6', flexOnly: true, group: 'flexbox' },
    { key: 'alignItems', label: 'align-items', color: '#569cd6', flexOnly: true, group: 'flexbox' },
    { key: 'flexWrap', label: 'flex-wrap', color: '#569cd6', flexOnly: true, group: 'flexbox' },
    { key: 'gap', color: '#569cd6', flexOnly: true, group: 'flexbox' },

    { key: 'gridTemplateColumns', label: 'grid-template-columns', color: '#9333ea', gridOnly: true, group: 'grid' },
    { key: 'gridTemplateRows', label: 'grid-template-rows', color: '#9333ea', gridOnly: true, group: 'grid' },
    { key: 'gridGap', label: 'grid-gap', color: '#9333ea', gridOnly: true, group: 'grid' },

    { key: 'background', color: '#ce9178', group: 'visual' },
    { key: 'boxShadow', label: 'box-shadow', color: '#dcdcaa', group: 'visual' },
    { key: 'opacity', color: '#b5cea8', group: 'visual' },

    { key: 'overflow', color: '#9cdcfe', group: 'other' },
    { key: 'transform', color: '#dcdcaa', group: 'other' },
    { key: 'transition', color: '#dcdcaa', group: 'other' }
  ];

  const isFlex = d.display === 'flex' || d.display === 'inline-flex';
  const isGrid = d.display === 'grid' || d.display === 'inline-grid';

  let cssLines = [];
  let currentGroup = null;

  properties.forEach(prop => {
    // Skip flex-only properties if not flex
    if (prop.flexOnly && !isFlex) return;

    // Skip grid-only properties if not grid
    if (prop.gridOnly && !isGrid) return;

    const value = d[prop.key];
    const label = prop.label || prop.key;

    // ⚠️ CRITICAL: Pass 'd' for context-aware filtering
    if (!isNonDefaultCSS(prop.key, value, d)) {
      // Keep if marked as important
      if (!prop.important) return;
    }

    // Add group separator comment
    if (prop.group && prop.group !== currentGroup) {
      currentGroup = prop.group;
      const groupNames = {
        'layout': 'LAYOUT & DISPLAY',
        'position': 'POSITIONING',
        'box-model': 'BOX MODEL',
        'typography': 'TYPOGRAPHY',
        'flexbox': 'FLEXBOX',
        'grid': 'GRID',
        'visual': 'VISUAL EFFECTS',
        'other': 'OTHER'
      };

      if (cssLines.length > 0) {
        cssLines.push(`
  <div style="margin-top: 8px; margin-bottom: 4px; color: #666; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
    /* ${groupNames[currentGroup]} */
  </div>
`);
      }
    }

    // Format as line-by-line DIV (not inline span)
    cssLines.push(`
  <div style="margin-bottom: 2px;">
    <span style="color: #9cdcfe;">${label}</span><span style="color: #666;">:</span> <span style="color: ${prop.color};">${value}</span><span style="color: #666;">;</span>
  </div>
`);
  });

  // Return formatted CSS
  if (cssLines.length === 0) {
    return '<div style="color: #666; font-style: italic;">/* All default values */</div>';
  }

  return cssLines.join('');
};

// Plain text version for copying (unchanged, but remove width/height)
export const cssTextPlain = (d) => {
  const properties = [
    { key: 'display', important: true },
    { key: 'position', important: true },
    // REMOVED: width and height
    { key: 'margin' },
    { key: 'padding' },
    { key: 'top' },
    { key: 'left' },
    { key: 'right' },
    { key: 'bottom' },
    { key: 'zIndex', label: 'z-index' },
    { key: 'fontSize', label: 'font-size', important: true },
    { key: 'fontFamily', label: 'font-family' },
    { key: 'fontWeight', label: 'font-weight' },
    { key: 'lineHeight', label: 'line-height' },
    { key: 'color', important: true },
    { key: 'textAlign', label: 'text-align' },
    { key: 'letterSpacing', label: 'letter-spacing' },
    { key: 'textTransform', label: 'text-transform' },
    { key: 'textDecoration', label: 'text-decoration' },
    { key: 'background' },
    { key: 'border' },
    { key: 'borderRadius', label: 'border-radius' },
    { key: 'boxShadow', label: 'box-shadow' },
    { key: 'opacity' },
    { key: 'flexDirection', label: 'flex-direction', flexOnly: true },
    { key: 'justifyContent', label: 'justify-content', flexOnly: true },
    { key: 'alignItems', label: 'align-items', flexOnly: true },
    { key: 'flexWrap', label: 'flex-wrap', flexOnly: true },
    { key: 'gap', flexOnly: true },
    { key: 'gridTemplateColumns', label: 'grid-template-columns', gridOnly: true },
    { key: 'gridTemplateRows', label: 'grid-template-rows', gridOnly: true },
    { key: 'gridGap', label: 'grid-gap', gridOnly: true },
    { key: 'overflow' },
    { key: 'transform' },
    { key: 'transition' }
  ];

  const isFlex = d.display === 'flex' || d.display === 'inline-flex';
  const isGrid = d.display === 'grid' || d.display === 'inline-grid';

  let cssLines = [`${d.selector} {`];

  properties.forEach(prop => {
    if (prop.flexOnly && !isFlex) return;
    if (prop.gridOnly && !isGrid) return;

    const value = d[prop.key];
    const label = prop.label || prop.key;

    // ⚠️ CRITICAL: Pass 'd' for context-aware filtering
    if (!isNonDefaultCSS(prop.key, value, d)) {
      if (!prop.important) return;
    }

    cssLines.push(`  ${label}: ${value};`);
  });

  cssLines.push('}');
  return cssLines.join('\n');
};
