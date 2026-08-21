import assert from 'node:assert/strict';

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function overlap(a, b, padding = 0) {
  return !(
    a.right + padding <= b.left
    || a.left - padding >= b.right
    || a.bottom + padding <= b.top
    || a.top - padding >= b.bottom
  );
}

function modalDock(viewportWidth, viewportHeight, rect) {
  const side = (rect.left + rect.width / 2) < viewportWidth / 2 ? 'right' : 'left';
  const width = Math.min(390, Math.max(340, Math.round(viewportWidth * 0.235)));
  return side === 'right'
    ? { side, left: viewportWidth - 14 - width, top: 14, right: viewportWidth - 14, bottom: viewportHeight - 14, width }
    : { side, left: 14, top: 14, right: 14 + width, bottom: viewportHeight - 14, width };
}

function clampManual(position, viewportWidth, viewportHeight) {
  const margin = 10;
  const width = Math.min(position.width || 420, viewportWidth - margin * 2);
  return {
    left: clamp(position.left, margin, Math.max(margin, viewportWidth - width - margin)),
    top: clamp(position.top, margin, Math.max(margin, viewportHeight - 220)),
    width,
  };
}

const footer = { left: 420, top: 820, width: 790, height: 85 };
const footerBox = { left: footer.left, top: footer.top, right: footer.left + footer.width, bottom: footer.top + footer.height };
const dock = modalDock(1600, 1000, footer);
assert.equal(dock.side, 'left');
assert.equal(overlap(dock, footerBox), false, 'Docked help panel overlaps the save/cancel target.');

const insurance = { left: 460, top: 500, width: 600, height: 130 };
const insuranceBox = { left: insurance.left, top: insurance.top, right: insurance.left + insurance.width, bottom: insurance.top + insurance.height };
const insuranceDock = modalDock(1648, 920, insurance);
assert.equal(overlap(insuranceDock, insuranceBox), false, 'Docked help panel overlaps the insurance target.');

const moved = clampManual({ left: 1500, top: 900, width: 390 }, 1600, 1000);
assert.equal(moved.left, 1200);
assert.equal(moved.top, 780);
assert.equal(moved.width, 390);

const mobile = clampManual({ left: -100, top: -40, width: 440 }, 375, 667);
assert.equal(mobile.left, 10);
assert.equal(mobile.top, 10);
assert.equal(mobile.width, 355);

console.log('TOUR_GEOMETRY_V6_QA_OK');
console.log(JSON.stringify({ saveTargetSide: dock.side, insuranceTargetSide: insuranceDock.side, dragClamp: moved, mobileClamp: mobile }, null, 2));
