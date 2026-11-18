// Cấu hình vị trí dấu chấm tròn (pips) trên lưới 3x3 (chỉ số ô 1..9)
export const DICE_PIP_PATTERNS = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9]
};

export function createPipCellsHTML(val) {
  const activePositions = DICE_PIP_PATTERNS[val] || DICE_PIP_PATTERNS[1];
  let cells = '';
  for (let pos = 1; pos <= 9; pos++) {
    cells += activePositions.includes(pos) ? '<span class="pip"></span>' : '<span></span>';
  }
  return cells;
}

export function createCubeFacesHTML() {
  return [1, 2, 3, 4, 5, 6].map((faceVal) => {
    const isRed = faceVal === 1 || faceVal === 4 ? 'red-pip' : '';
    return `<div class="cube-face face-${faceVal} ${isRed}">${createPipCellsHTML(faceVal)}</div>`;
  }).join('');
}

// Khối Xúc xắc Tốc độ 3D màu vàng (1, 2, 3 chấm + Xe Buýt 🚌 + Tỷ Phú 🎩)
// Gán face-1: 1, face-2: 2, face-3: 3, face-4: BUS, face-5: BUS, face-6: MR_MONOPOLY
export function createSpeedCubeFacesHTML() {
  return `
    <div class="cube-face speed-face face-1 red-pip">${createPipCellsHTML(1)}</div>
    <div class="cube-face speed-face face-2">${createPipCellsHTML(2)}</div>
    <div class="cube-face speed-face face-3">${createPipCellsHTML(3)}</div>
    <div class="cube-face speed-face speed-icon-face face-4"><span>🚌</span></div>
    <div class="cube-face speed-face speed-icon-face face-5"><span>🚌</span></div>
    <div class="cube-face speed-face speed-icon-face face-6"><span>🎩</span></div>
  `;
}

export function createMiniPipDieHTML(val) {
  const safeVal = val >= 1 && val <= 6 ? val : 1;
  const isRed = safeVal === 1 || safeVal === 4 ? 'red-pip' : '';
  return `<div class="mini-pip-die face-${safeVal} ${isRed}">${createPipCellsHTML(safeVal)}</div>`;
}

export function createMiniSpeedDieHTML(speedVal) {
  if (speedVal === null || speedVal === undefined) return '';
  if (typeof speedVal === 'number') {
    const isRed = speedVal === 1 ? 'red-pip' : '';
    return `<div class="mini-pip-die mini-speed-die face-${speedVal} ${isRed}" title="Xúc xắc Tốc độ +${speedVal}">${createPipCellsHTML(speedVal)}</div>`;
  }
  const icon = speedVal === 'BUS' ? '🚌' : '🎩';
  const title = speedVal === 'BUS' ? 'Xe Buýt Nhanh' : 'Tỷ Phú (Bay tới đất trống)';
  return `<div class="mini-speed-badge" title="${title}">${icon}</div>`;
}

export function renderMiniDicePairHTML(d1 = 1, d2 = 1, showSum = true, speedDie = null) {
  const extraNum = typeof speedDie === 'number' ? speedDie : 0;
  const total = d1 + d2 + extraNum;
  const suffix = speedDie === 'BUS' ? '+🚌' : speedDie === 'MR_MONOPOLY' ? '+🎩' : '';
  return `
    ${createMiniPipDieHTML(d1)}
    ${createMiniPipDieHTML(d2)}
    ${createMiniSpeedDieHTML(speedDie)}
    ${showSum ? `<span class="ml-0.5 text-xs font-extrabold text-amber-400 mono-num">=${total}${suffix}</span>` : ''}
  `;
}
