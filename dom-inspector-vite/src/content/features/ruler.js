import { S } from '../core/state.js';
import { remove, isInspectorElement, hexToRgb } from '../core/utils.js';

/*  RULER / DISTANCE MEASUREMENT  */
export function startRulerMode() {
  if (S.rulerMode) return;

  console.log('[DOM Inspector] Starting ruler mode...');

  S.rulerMode = true;
  S.firstSelectedElement = null;
  document.body.style.cursor = "crosshair";

  // Disable other FAB buttons during ruler mode
  const fabButtons = ["dom-inspector-btn", "dom-responsive-btn"];
  fabButtons.forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.style.opacity = "0.5";
      btn.style.pointerEvents = "none";
    }
  });

  // Attach ruler-specific event listeners
  attachRulerListeners();
}

export function stopRulerMode() {
  if (!S.rulerMode) return;

  console.log('[DOM Inspector] Stopping ruler mode...');

  S.rulerMode = false;
  S.firstSelectedElement = null;
  document.body.style.cursor = "default";

  // Re-enable other FAB buttons
  const fabButtons = ["dom-inspector-btn", "dom-responsive-btn"];
  fabButtons.forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.style.opacity = "1";
      btn.style.pointerEvents = "auto";
    }
  });
  // Also update ruler button
  const rulerBtn = document.getElementById("dom-ruler-btn");
  if (rulerBtn) {
    rulerBtn.textContent = "📏 Distance";
    rulerBtn.style.background = "#e67e22";
  }

  // Clear all ruler visuals
  clearRulerVisuals();

  // Detach ruler listeners
  detachRulerListeners();
}

export function attachRulerListeners() {
  const handleRulerMouseMove = (e) => {
    if (!S.rulerMode) return;
    if (isInspectorElement(e.target)) return;

    const hoveredElement = e.target;

    if (S.firstSelectedElement) {
      // If reference is set, show distance to hovered element
      if (hoveredElement !== S.firstSelectedElement) {
        showDistanceMeasurements(S.firstSelectedElement, hoveredElement);
      }
    } else {
      // No reference set - just highlight hovered element
      highlightElementForRuler(hoveredElement);
    }
  };

  const handleRulerClick = (e) => {
    if (!S.rulerMode) return;
    if (isInspectorElement(e.target)) return;

    e.preventDefault();
    e.stopPropagation();

    const clickedElement = e.target;

    if (!S.firstSelectedElement) {
      // First click - set as reference element
      S.firstSelectedElement = clickedElement;
      highlightSelectedElement(clickedElement);
      console.log('[DOM Inspector] Reference element selected');
    } else if (clickedElement === S.firstSelectedElement) {
      // Clicked same element - deselect reference
      S.firstSelectedElement = null;
      clearRulerVisuals();
      console.log('[DOM Inspector] Reference element cleared');
    } else {
      // Clicked different element - replace reference
      S.firstSelectedElement = clickedElement;
      clearRulerVisuals();
      highlightSelectedElement(clickedElement);
      console.log('[DOM Inspector] Reference element changed');
    }
  };

  const handleRulerKeyDown = (e) => {
    if (!S.rulerMode) return;

    if (e.key === "Escape") {
      e.preventDefault();
      stopRulerMode();
      // Also update button
      const rulerBtn = document.getElementById("dom-ruler-btn");
      if (rulerBtn) {
        rulerBtn.textContent = "📏 Distance";
        rulerBtn.style.background = "#e67e22";
      }
    }
  };

  document.addEventListener("mousemove", handleRulerMouseMove);
  document.addEventListener("click", handleRulerClick, true);
  document.addEventListener("keydown", handleRulerKeyDown);

  S.handlers.rulerMouseMove = handleRulerMouseMove;
  S.handlers.rulerClick = handleRulerClick;
  S.handlers.rulerKeyDown = handleRulerKeyDown;
}

export function detachRulerListeners() {
  if (S.handlers.rulerMouseMove) {
    document.removeEventListener("mousemove", S.handlers.rulerMouseMove);
    S.handlers.rulerMouseMove = null;
  }
  if (S.handlers.rulerClick) {
    document.removeEventListener("click", S.handlers.rulerClick, true);
    S.handlers.rulerClick = null;
  }
  if (S.handlers.rulerKeyDown) {
    document.removeEventListener("keydown", S.handlers.rulerKeyDown);
    S.handlers.rulerKeyDown = null;
  }
}

export function highlightElementForRuler(element) {
  clearRulerVisuals();

  const rect = element.getBoundingClientRect();

  const highlight = document.createElement("div");
  highlight.className = "di-ruler-highlight";
  Object.assign(highlight.style, {
    position: "absolute",
    top: (rect.top + window.scrollY) + "px",
    left: (rect.left + window.scrollX) + "px",
    width: rect.width + "px",
    height: rect.height + "px",
    border: "2px solid #e67e22",
    background: "rgba(230, 126, 34, 0.1)",
    pointerEvents: "none",
    zIndex: 99995,
    boxSizing: "border-box"
  });

  document.body.appendChild(highlight);
  S.rulerLines.push(highlight);
}

export function highlightSelectedElement(element) {
  clearRulerVisuals();

  const rect = element.getBoundingClientRect();

  const highlight = document.createElement("div");
  highlight.className = "di-ruler-selected";
  Object.assign(highlight.style, {
    position: "absolute",
    top: (rect.top + window.scrollY) + "px",
    left: (rect.left + window.scrollX) + "px",
    width: rect.width + "px",
    height: rect.height + "px",
    border: "3px solid #3498db",
    background: "rgba(52, 152, 219, 0.15)",
    pointerEvents: "none",
    zIndex: 99996,
    boxSizing: "border-box",
    boxShadow: "0 0 0 2px rgba(52, 152, 219, 0.3)"
  });

  document.body.appendChild(highlight);
  S.rulerLines.push(highlight);

  // Add label
  const label = document.createElement("div");
  label.className = "di-ruler-label";
  label.textContent = "Reference Element (Click to change or deselect)";
  Object.assign(label.style, {
    position: "absolute",
    top: (rect.top + window.scrollY - 30) + "px",
    left: (rect.left + window.scrollX) + "px",
    background: "rgba(52, 152, 219, 0.95)",
    color: "#fff",
    padding: "4px 8px",
    borderRadius: "4px",
    fontSize: "11px",
    fontFamily: "system-ui, sans-serif",
    fontWeight: "500",
    pointerEvents: "none",
    zIndex: 99997,
    whiteSpace: "nowrap",
    boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
  });

  document.body.appendChild(label);
  S.measurementLabels.push(label);
}

export function showDistanceMeasurements(element1, element2) {
  clearRulerVisuals();

  // Keep reference element highlighted
  highlightSelectedElement(element1);

  const rect1 = element1.getBoundingClientRect();
  const rect2 = element2.getBoundingClientRect();

  // Highlight target element
  const highlight2 = document.createElement("div");
  highlight2.className = "di-ruler-target";
  Object.assign(highlight2.style, {
    position: "absolute",
    top: (rect2.top + window.scrollY) + "px",
    left: (rect2.left + window.scrollX) + "px",
    width: rect2.width + "px",
    height: rect2.height + "px",
    border: "2px solid #e67e22",
    background: "rgba(230, 126, 34, 0.1)",
    pointerEvents: "none",
    zIndex: 99995,
    boxSizing: "border-box"
  });
  document.body.appendChild(highlight2);
  S.rulerLines.push(highlight2);

  // Calculate distances
  const distances = calculateDistances(rect1, rect2);

  // Draw horizontal distance (X-axis)
  if (distances.horizontal > 0) {
    drawHorizontalDistance(rect1, rect2, distances.horizontal);
  }

  // Draw vertical distance (Y-axis)
  if (distances.vertical > 0) {
    drawVerticalDistance(rect1, rect2, distances.vertical);
  }

  // If overlapping, show that information
  if (distances.overlapX && distances.overlapY) {
    showOverlapIndicator(rect1, rect2);
  }
}

export function drawHorizontalDistance(rect1, rect2, distance) {
  let x1, x2, y;

  // Determine which element is on the left
  if (rect1.right <= rect2.left) {
    // rect2 is to the right of rect1
    x1 = rect1.right + window.scrollX;
    x2 = rect2.left + window.scrollX;

    // Calculate Y position - use the overlapping vertical range or midpoint
    const overlapTop = Math.max(rect1.top, rect2.top);
    const overlapBottom = Math.min(rect1.bottom, rect2.bottom);

    if (overlapTop < overlapBottom) {
      // There is vertical overlap - use middle of overlap
      y = ((overlapTop + overlapBottom) / 2) + window.scrollY;
    } else {
      // No vertical overlap - use midpoint between elements
      y = ((rect1.top + rect1.bottom + rect2.top + rect2.bottom) / 4) + window.scrollY;
    }
  } else if (rect2.right <= rect1.left) {
    // rect2 is to the left of rect1
    x1 = rect2.right + window.scrollX;
    x2 = rect1.left + window.scrollX;

    const overlapTop = Math.max(rect1.top, rect2.top);
    const overlapBottom = Math.min(rect1.bottom, rect2.bottom);

    if (overlapTop < overlapBottom) {
      y = ((overlapTop + overlapBottom) / 2) + window.scrollY;
    } else {
      y = ((rect1.top + rect1.bottom + rect2.top + rect2.bottom) / 4) + window.scrollY;
    }
  } else {
    // Horizontally overlapping - don't draw
    return;
  }

  // Draw horizontal line
  const line = document.createElement("div");
  line.className = "di-ruler-line";
  Object.assign(line.style, {
    position: "absolute",
    top: y + "px",
    left: x1 + "px",
    width: (x2 - x1) + "px",
    height: "2px",
    background: "#e74c3c",
    pointerEvents: "none",
    zIndex: 99994
  });
  document.body.appendChild(line);
  S.rulerLines.push(line);

  // Draw arrows at ends
  const arrow1 = createArrow(x1, y, 'left');
  const arrow2 = createArrow(x2, y, 'right');
  document.body.appendChild(arrow1);
  document.body.appendChild(arrow2);
  S.rulerLines.push(arrow1, arrow2);

  // Draw label
  const label = createDistanceLabel(
    `${distance}px`,
    (x1 + x2) / 2,
    y,
    '#e74c3c'
  );
  document.body.appendChild(label);
  S.measurementLabels.push(label);
}
export function drawVerticalDistance(rect1, rect2, distance) {
  let y1, y2, x;

  // Determine which element is above
  if (rect1.bottom <= rect2.top) {
    // rect2 is below rect1
    y1 = rect1.bottom + window.scrollY;
    y2 = rect2.top + window.scrollY;

    // Calculate X position - use the overlapping horizontal range or midpoint
    const overlapLeft = Math.max(rect1.left, rect2.left);
    const overlapRight = Math.min(rect1.right, rect2.right);

    if (overlapLeft < overlapRight) {
      // There is horizontal overlap - use middle of overlap
      x = ((overlapLeft + overlapRight) / 2) + window.scrollX;
    } else {
      // No horizontal overlap - use midpoint between elements
      x = ((rect1.left + rect1.right + rect2.left + rect2.right) / 4) + window.scrollX;
    }
  } else if (rect2.bottom <= rect1.top) {
    // rect2 is above rect1
    y1 = rect2.bottom + window.scrollY;
    y2 = rect1.top + window.scrollY;

    const overlapLeft = Math.max(rect1.left, rect2.left);
    const overlapRight = Math.min(rect1.right, rect2.right);

    if (overlapLeft < overlapRight) {
      x = ((overlapLeft + overlapRight) / 2) + window.scrollX;
    } else {
      x = ((rect1.left + rect1.right + rect2.left + rect2.right) / 4) + window.scrollX;
    }
  } else {
    // Vertically overlapping - don't draw
    return;
  }

  // Draw vertical line
  const line = document.createElement("div");
  line.className = "di-ruler-line";
  Object.assign(line.style, {
    position: "absolute",
    top: y1 + "px",
    left: x + "px",
    width: "2px",
    height: (y2 - y1) + "px",
    background: "#9b59b6",
    pointerEvents: "none",
    zIndex: 99994
  });
  document.body.appendChild(line);
  S.rulerLines.push(line);

  // Draw arrows at ends
  const arrow1 = createArrow(x, y1, 'up');
  const arrow2 = createArrow(x, y2, 'down');
  document.body.appendChild(arrow1);
  document.body.appendChild(arrow2);
  S.rulerLines.push(arrow1, arrow2);

  // Draw label
  const label = createDistanceLabel(
    `${distance}px`,
    x,
    (y1 + y2) / 2,
    '#9b59b6'
  );
  document.body.appendChild(label);
  S.measurementLabels.push(label);
}

export function createArrow(x, y, direction) {
  const arrow = document.createElement("div");
  arrow.className = "di-ruler-arrow";

  const size = 6;
  let borderStyle = '';

  switch (direction) {
    case 'left':
      borderStyle = `${size}px solid transparent; border-right: ${size}px solid #e74c3c`;
      x = x - size;
      y = y - size;
      break;
    case 'right':
      borderStyle = `${size}px solid transparent; border-left: ${size}px solid #e74c3c`;
      x = x;
      y = y - size;
      break;
    case 'up':
      borderStyle = `${size}px solid transparent; border-bottom: ${size}px solid #9b59b6`;
      x = x - size;
      y = y - size;
      break;
    case 'down':
      borderStyle = `${size}px solid transparent; border-top: ${size}px solid #9b59b6`;
      x = x - size;
      y = y;
      break;
  }

  Object.assign(arrow.style, {
    position: "absolute",
    top: y + "px",
    left: x + "px",
    width: "0",
    height: "0",
    border: borderStyle,
    pointerEvents: "none",
    zIndex: 99995
  });

  return arrow;
}

export function showOverlapIndicator(rect1, rect2) {
  // Calculate overlap region
  const overlapLeft = Math.max(rect1.left, rect2.left);
  const overlapRight = Math.min(rect1.right, rect2.right);
  const overlapTop = Math.max(rect1.top, rect2.top);
  const overlapBottom = Math.min(rect1.bottom, rect2.bottom);

  const centerX = ((overlapLeft + overlapRight) / 2) + window.scrollX;
  const centerY = ((overlapTop + overlapBottom) / 2) + window.scrollY;

  const label = createDistanceLabel(
    "OVERLAPPING",
    centerX,
    centerY,
    '#f39c12',
    true
  );
  label.style.fontSize = "12px";
  label.style.fontWeight = "700";

  document.body.appendChild(label);
  S.measurementLabels.push(label);
}

export function calculateDistances(rect1, rect2) {
  // Calculate edge-to-edge distances (can be negative if overlapping)
  const topDistance = rect2.top - rect1.bottom;     // Distance from rect1 bottom to rect2 top
  const bottomDistance = rect1.top - rect2.bottom;   // Distance from rect2 bottom to rect1 top
  const leftDistance = rect2.left - rect1.right;     // Distance from rect1 right to rect2 left
  const rightDistance = rect1.left - rect2.right;    // Distance from rect2 right to rect1 left

  // Horizontal distance (X-axis) - minimum absolute distance
  let horizontalDistance = 0;
  if (rect1.right <= rect2.left) {
    // rect2 is to the right
    horizontalDistance = rect2.left - rect1.right;
  } else if (rect2.right <= rect1.left) {
    // rect2 is to the left
    horizontalDistance = rect1.left - rect2.right;
  } else {
    // Overlapping horizontally - distance is 0 or negative (inside)
    const leftOverlap = rect1.left - rect2.left;
    const rightOverlap = rect2.right - rect1.right;
    // If rect2 is inside rect1
    if (rect2.left >= rect1.left && rect2.right <= rect1.right) {
      horizontalDistance = Math.min(
        Math.abs(rect2.left - rect1.left),
        Math.abs(rect1.right - rect2.right)
      );
    }
    // If rect1 is inside rect2
    else if (rect1.left >= rect2.left && rect1.right <= rect2.right) {
      horizontalDistance = Math.min(
        Math.abs(rect1.left - rect2.left),
        Math.abs(rect2.right - rect1.right)
      );
    }
    // Partial overlap
    else {
      horizontalDistance = 0;
    }
  }

  // Vertical distance (Y-axis) - minimum absolute distance
  let verticalDistance = 0;
  if (rect1.bottom <= rect2.top) {
    // rect2 is below
    verticalDistance = rect2.top - rect1.bottom;
  } else if (rect2.bottom <= rect1.top) {
    // rect2 is above
    verticalDistance = rect1.top - rect2.bottom;
  } else {
    // Overlapping vertically
    const topOverlap = rect1.top - rect2.top;
    const bottomOverlap = rect2.bottom - rect1.bottom;
    // If rect2 is inside rect1
    if (rect2.top >= rect1.top && rect2.bottom <= rect1.bottom) {
      verticalDistance = Math.min(
        Math.abs(rect2.top - rect1.top),
        Math.abs(rect1.bottom - rect2.bottom)
      );
    }
    // If rect1 is inside rect2
    else if (rect1.top >= rect2.top && rect1.bottom <= rect2.bottom) {
      verticalDistance = Math.min(
        Math.abs(rect1.top - rect2.top),
        Math.abs(rect2.bottom - rect1.bottom)
      );
    }
    // Partial overlap
    else {
      verticalDistance = 0;
    }
  }

  // Overlapping detection
  const overlapX = !(rect1.right <= rect2.left || rect1.left >= rect2.right);
  const overlapY = !(rect1.bottom <= rect2.top || rect1.top >= rect2.bottom);

  return {
    horizontal: Math.round(Math.abs(horizontalDistance)),
    vertical: Math.round(Math.abs(verticalDistance)),
    overlapX,
    overlapY,
    // Keep individual edge distances for detailed measurement if needed
    topDistance: Math.round(topDistance),
    bottomDistance: Math.round(bottomDistance),
    leftDistance: Math.round(leftDistance),
    rightDistance: Math.round(rightDistance)
  };
}

export function createDistanceLabel(text, x, y, color = '#e67e22', center = false) {
  const label = document.createElement("div");
  label.className = "di-distance-label";
  label.textContent = text;

  Object.assign(label.style, {
    position: "absolute",
    top: y + "px",
    left: x + "px",
    transform: center ? "translate(-50%, -50%)" : "translate(-50%, -50%)",
    background: `rgba(${hexToRgb(color)}, 0.95)`,
    color: "#fff",
    padding: "4px 8px",
    borderRadius: "4px",
    fontSize: "11px",
    fontFamily: "system-ui, monospace",
    fontWeight: "600",
    pointerEvents: "none",
    zIndex: 99998,
    whiteSpace: "nowrap",
    boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
    border: "1px solid rgba(255,255,255,0.2)"
  });

  return label;
}

export function clearRulerVisuals() {
  S.rulerLines.forEach(line => remove(line));
  S.rulerLines = [];

  S.measurementLabels.forEach(label => remove(label));
  S.measurementLabels = [];
}
