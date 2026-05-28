// Responsive viewport presets
export const viewportPresets = [
  { name: 'iPhone SE', width: 375, height: 667, type: 'mobile' },
  { name: 'iPhone 12/13', width: 390, height: 844, type: 'mobile' },
  { name: 'iPhone 14 Pro Max', width: 430, height: 932, type: 'mobile' },
  { name: 'Samsung Galaxy S21', width: 360, height: 800, type: 'mobile' },
  { name: 'iPad Mini', width: 768, height: 1024, type: 'tablet' },
  { name: 'iPad Air', width: 820, height: 1180, type: 'tablet' },
  { name: 'iPad Pro 12.9"', width: 1024, height: 1366, type: 'tablet' },
  { name: 'Desktop Small', width: 1366, height: 768, type: 'desktop' },
  { name: 'Desktop Medium', width: 1920, height: 1080, type: 'desktop' },
  { name: 'Desktop Large', width: 2560, height: 1440, type: 'desktop' },
  { name: 'Custom', width: 0, height: 0, type: 'custom' }
];

// Real browser default values for semantic filtering (DevTools-style)
export const CSS_DEFAULTS = {
  // Display & Positioning
  display: 'block',
  position: 'static',
  top: 'auto',
  left: 'auto',
  right: 'auto',
  bottom: 'auto',
  zIndex: 'auto',

  // Box Model
  margin: '0px',
  marginTop: '0px',
  marginRight: '0px',
  marginBottom: '0px',
  marginLeft: '0px',
  padding: '0px',
  paddingTop: '0px',
  paddingRight: '0px',
  paddingBottom: '0px',
  paddingLeft: '0px',
  width: 'auto',
  height: 'auto',

  // Borders
  border: '0px none rgb(0, 0, 0)',
  borderWidth: '0px',
  borderStyle: 'none',
  borderColor: 'rgb(0, 0, 0)',
  borderRadius: '0px',
  outline: 'rgb(0, 0, 0) none 0px',
  boxShadow: 'none',

  // Typography
  color: 'rgb(0, 0, 0)',
  fontSize: '16px',
  fontFamily: 'serif',
  fontWeight: '400',
  fontStyle: 'normal',
  lineHeight: 'normal',
  textAlign: 'start',
  textDecoration: 'none',
  textTransform: 'none',
  letterSpacing: 'normal',
  wordSpacing: 'normal',
  whiteSpace: 'normal',

  // Visual
  background: 'rgba(0, 0, 0, 0)',
  backgroundColor: 'rgba(0, 0, 0, 0)',
  backgroundImage: 'none',
  opacity: '1',
  visibility: 'visible',

  // Flexbox (only relevant when display: flex)
  flexDirection: 'row',
  flexWrap: 'nowrap',
  justifyContent: 'normal',
  alignItems: 'normal',
  alignContent: 'normal',
  gap: 'normal',

  // Grid (only relevant when display: grid)
  gridTemplateColumns: 'none',
  gridTemplateRows: 'none',
  gridGap: 'normal',
  gridAutoFlow: 'row',

  // Other
  overflow: 'visible',
  overflowX: 'visible',
  overflowY: 'visible',
  cursor: 'auto',
  pointerEvents: 'auto',
  transform: 'none',
  transition: 'all 0s ease 0s',
  animation: 'none'
};

// Properties that should never show (always noise)
export const NEVER_SHOW = [
  'webkitAppearance',
  'webkitTapHighlightColor',
  'webkitTextFillColor',
  'webkitTextStroke',
  'webkitFontSmoothing',
  'mozAppearance',
  'msOverflowStyle',
  'scrollbarWidth'
];
