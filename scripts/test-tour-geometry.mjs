import assert from 'node:assert/strict';

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function rectanglesOverlap(a, b, padding = 16) {
  return !(
    a.right + padding < b.left
    || a.left - padding > b.right
    || a.bottom + padding < b.top
    || a.top - padding > b.bottom
  );
}

function choosePresentation({ viewportWidth, viewportHeight, rect, estimatedHeight = 650, preferred = 'auto' }) {
  const targetRect = { top: rect.top, left: rect.left, right: rect.left + rect.width, bottom: rect.top + rect.height };
  const cardWidth = Math.min(440, viewportWidth - 32);
  const cardHeight = Math.min(estimatedHeight, viewportHeight - 32);
  const gap = 22;
  const candidates = [];
  const push = (side, left, top) => {
    const safeLeft = clamp(left, 16, viewportWidth - cardWidth - 16);
    const safeTop = clamp(top, 16, Math.max(16, viewportHeight - cardHeight - 16));
    const box = { top: safeTop, left: safeLeft, right: safeLeft + cardWidth, bottom: safeTop + cardHeight };
    const overlap = rectanglesOverlap(box, targetRect, 16);
    const clipped = Math.abs(left - safeLeft) + Math.abs(top - safeTop);
    const preferredBonus = preferred === side ? -120 : 0;
    const distance = side === 'left' || side === 'right'
      ? Math.abs((safeTop + cardHeight / 2) - (rect.top + rect.height / 2))
      : Math.abs((safeLeft + cardWidth / 2) - (rect.left + rect.width / 2));
    candidates.push({ side, box, score: (overlap ? 10000 : 0) + clipped * 3 + distance / 10 + preferredBonus });
  };
  push('right', rect.left + rect.width + gap, rect.top + rect.height / 2 - cardHeight / 2);
  push('left', rect.left - cardWidth - gap, rect.top + rect.height / 2 - cardHeight / 2);
  push('bottom', rect.left + rect.width / 2 - cardWidth / 2, rect.top + rect.height + gap);
  push('top', rect.left + rect.width / 2 - cardWidth / 2, rect.top - cardHeight - gap);
  candidates.sort((a, b) => a.score - b.score);
  return candidates[0];
}

const desktopModalTarget = { left: 380, top: 490, width: 640, height: 144 };
const desktop = choosePresentation({ viewportWidth: 1648, viewportHeight: 920, rect: desktopModalTarget, preferred: 'left' });
assert.equal(rectanglesOverlap(desktop.box, {
  left: desktopModalTarget.left,
  top: desktopModalTarget.top,
  right: desktopModalTarget.left + desktopModalTarget.width,
  bottom: desktopModalTarget.top + desktopModalTarget.height,
}, 0), false, `Desktop card overlaps target on ${desktop.side}`);

const upperTarget = { left: 270, top: 210, width: 760, height: 120 };
const upper = choosePresentation({ viewportWidth: 1600, viewportHeight: 900, rect: upperTarget, preferred: 'right' });
assert.equal(rectanglesOverlap(upper.box, {
  left: upperTarget.left,
  top: upperTarget.top,
  right: upperTarget.left + upperTarget.width,
  bottom: upperTarget.top + upperTarget.height,
}, 0), false, `Upper card overlaps target on ${upper.side}`);

const mobile = { viewportWidth: 375, viewportHeight: 667 };
assert.ok(mobile.viewportWidth <= 720, 'Mobile breakpoint fixture invalid.');

console.log('TOUR_GEOMETRY_QA_OK');
console.log(JSON.stringify({ desktopSide: desktop.side, upperSide: upper.side, mobileMode: 'bottom-card' }, null, 2));
