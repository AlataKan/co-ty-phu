export const BOARD_SIZE = 1040;
export const CORNER_SIZE = 140;
export const EDGE_LENGTH = BOARD_SIZE - CORNER_SIZE * 2; // 760px
export const TILE_WIDTH = EDGE_LENGTH / 9;               // ~84.4444px
export const TILE_HEIGHT = 140;

// Ma trận 2x2 quanh tâm ô đất (Xi ± 16px, Yi ± 16px)
const TOKEN_OFFSETS = [
  { dx: -16, dy: -16 },
  { dx:  16, dy: -16 },
  { dx: -16, dy:  16 },
  { dx:  16, dy:  16 }
];

/**
 * Tính tọa độ tâm (x, y), kích thước và góc xoay hướng vào sân trung tâm của ô thứ i (0..39)
 */
export function getTileTransform(index) {
  const B = BOARD_SIZE;
  const C = CORNER_SIZE;
  const W = TILE_WIDTH;

  // 4 Ô Góc
  if (index === 0)  return { x: B - C / 2, y: B - C / 2, width: C, height: C, angle: 0, isCorner: true, side: 'CORNER_BR' };
  if (index === 10) return { x: C / 2,     y: B - C / 2, width: C, height: C, angle: 0, isCorner: true, side: 'CORNER_BL' };
  if (index === 20) return { x: C / 2,     y: C / 2,     width: C, height: C, angle: 0, isCorner: true, side: 'CORNER_TL' };
  if (index === 30) return { x: B - C / 2, y: C / 2,     width: C, height: C, angle: 0, isCorner: true, side: 'CORNER_TR' };

  // Cạnh Dưới (1..9): Dải màu nằm ở mép trên của ô (hướng lên tâm bàn cờ)
  if (index >= 1 && index <= 9) {
    return {
      x: (B - C) - (index - 0.5) * W,
      y: B - C / 2,
      width: W,
      height: C,
      angle: 0,
      isCorner: false,
      side: 'BOTTOM'
    };
  }

  // Cạnh Trái (11..19): Xoay 90 độ theo chiều kim đồng hồ để dải màu hướng sang phải (vào tâm)
  if (index >= 11 && index <= 19) {
    const k = index - 10;
    return {
      x: C / 2,
      y: (B - C) - (k - 0.5) * W,
      width: W,
      height: C,
      angle: 90,
      isCorner: false,
      side: 'LEFT'
    };
  }

  // Cạnh Trên (21..29): Xoay 180 độ để dải màu nằm ở mép dưới (hướng xuống tâm)
  if (index >= 21 && index <= 29) {
    const k = index - 20;
    return {
      x: C + (k - 0.5) * W,
      y: C / 2,
      width: W,
      height: C,
      angle: 180,
      isCorner: false,
      side: 'TOP'
    };
  }

  // Cạnh Phải (31..39): Xoay -90 độ để dải màu nằm ở mép trái (hướng sang trái vào tâm)
  const k = index - 30;
  return {
    x: B - C / 2,
    y: C + (k - 0.5) * W,
    width: W,
    height: C,
    angle: -90,
    isCorner: false,
    side: 'RIGHT'
  };
}

/**
 * Tính tọa độ đứng thực tế của quân cờ trên ô (tự động tách 2x2 nếu có từ 2 quân cờ trở lên)
 */
export function getTokenTargetPoint(tileIndex, slotIndex = 0, occupantCount = 1) {
  const { x, y } = getTileTransform(tileIndex);
  if (occupantCount <= 1) return { x, y };
  const offset = TOKEN_OFFSETS[slotIndex % 4];
  return { x: x + offset.dx, y: y + offset.dy };
}
