import { MEGA_52_BOARD_TILES } from './boardData52.js';

// Bảng mã màu chuẩn hóa cho cả bản 40 ô (8 nhóm) và bản mở rộng 52 ô (10 nhóm)
export const GROUP_COLORS = {
  BROWN:      { primary: '#78350F', border: '#451A03', text: '#FFFFFF', label: 'Tây Bắc (Nâu)' },
  LIGHT_BLUE: { primary: '#0284C7', border: '#0369A1', text: '#FFFFFF', label: 'Đông Bắc / Kỳ Quan (Xanh Lam)' },
  TEAL:       { primary: '#0D9488', border: '#115E59', text: '#FFFFFF', label: 'Kỳ Quan Bắc Bộ (Xanh Ngọc)' },
  PINK:       { primary: '#DB2777', border: '#9D174D', text: '#FFFFFF', label: 'Di Sản Miền Trung (Hồng)' },
  ORANGE:     { primary: '#EA580C', border: '#9A3412', text: '#FFFFFF', label: 'Duyên Hải Trung Bộ (Cam)' },
  RED:        { primary: '#DC2626', border: '#991B1B', text: '#FFFFFF', label: 'Tây Nguyên & Cao Nguyên (Đỏ)' },
  YELLOW:     { primary: '#CA8A04', border: '#854D0E', text: '#FFFFFF', label: 'Thiên Đường Biển (Vàng)' },
  PURPLE:     { primary: '#7C3AED', border: '#5B21B6', text: '#FFFFFF', label: 'Đông Nam Bộ & Biển (Tím)' },
  GREEN:      { primary: '#15803D', border: '#14532D', text: '#FFFFFF', label: 'Miền Tây & Đảo Ngọc (Xanh Lá)' },
  DARK_BLUE:  { primary: '#1E3A8A', border: '#172554', text: '#FFFFFF', label: 'Siêu Đô Thị (Xanh Đậm)' },
  STATION:    { primary: '#334155', border: '#0F172A', text: '#F8FAFC', label: 'Hạ Tầng Giao Thông' },
  UTILITY:    { primary: '#4D7C0F', border: '#365314', text: '#FFFFFF', label: 'Tập Đoàn Tiện Ích' },
  NONE:       { primary: '#475569', border: '#1E293B', text: '#FFFFFF', label: 'Ô Sự Kiện Đặc Biệt' }
};

// Định danh 6 Quân cờ 3D nổi bật (P1 -> P6)
export const PLAYER_PRESETS = [
  { id: 'P1', short: 'P1', defaultName: 'Người chơi 1', color: '#E11D48', icon: '🐉', avatar: 'Rồng Vàng' },
  { id: 'P2', short: 'P2', defaultName: 'Người chơi 2', color: '#2563EB', icon: '👑', avatar: 'Vương Miện' },
  { id: 'P3', short: 'P3', defaultName: 'Người chơi 3', color: '#059669', icon: '🚀', avatar: 'Tên Lửa' },
  { id: 'P4', short: 'P4', defaultName: 'Người chơi 4', color: '#9333EA', icon: '💎', avatar: 'Kim Cương' },
  { id: 'P5', short: 'P5', defaultName: 'Người chơi 5', color: '#EA580C', icon: '🦁', avatar: 'Kỳ Lân' },
  { id: 'P6', short: 'P6', defaultName: 'Người chơi 6', color: '#0D9488', icon: '🛥️', avatar: 'Du Thuyền' }
];

// Hằng số kinh tế cốt lõi mặc định cho bản 40 ô (Đơn vị: K = Nghìn VNĐ)
export const GAME_CONSTANTS = {
  INITIAL_BALANCE: 2000,
  SALARY: 200,
  JAIL_FINE: 50,
  MAX_JAIL_TURNS: 3,
  MIN_AUCTION_START: 10,
  MIN_BID_STEP: 10,
  AUCTION_TIMER_SECONDS: 10
};

// Dữ liệu gốc 40 ô địa danh Việt Nam (Index 0 -> 39)
export const INITIAL_BOARD_TILES = [
  { index: 0,  name: 'KHỞI HÀNH', shortName: 'KHỞI HÀNH', type: 'START', group: 'NONE', icon: '🚩', sub: '+200K' },
  { index: 1,  name: 'Mộc Châu', shortName: 'Mộc Châu', type: 'PROPERTY', group: 'BROWN', price: 60, buildCost: 50, rent: [2, 10, 30, 90, 160, 250], mortgageValue: 30 },
  { index: 2,  name: 'Khí Vận', shortName: 'Khí Vận', type: 'COMMUNITY_CHEST', group: 'NONE', icon: '🧧', sub: 'Rút Thẻ' },
  { index: 3,  name: 'Sa Pa', shortName: 'Sa Pa', type: 'PROPERTY', group: 'BROWN', price: 60, buildCost: 50, rent: [4, 20, 60, 180, 320, 450], mortgageValue: 30 },
  { index: 4,  name: 'Thuế Thu Nhập', shortName: 'Thuế Thu Nhập', type: 'TAX', group: 'NONE', icon: '💸', sub: '-200K', taxAmount: 200 },
  { index: 5,  name: 'Bến Xe Mỹ Đình', shortName: 'BX Mỹ Đình', type: 'STATION', group: 'STATION', icon: '🚌', price: 200, rent: [25, 50, 100, 200], mortgageValue: 100 },
  { index: 6,  name: 'Tam Đảo', shortName: 'Tam Đảo', type: 'PROPERTY', group: 'LIGHT_BLUE', price: 100, buildCost: 50, rent: [6, 30, 90, 270, 400, 550], mortgageValue: 50 },
  { index: 7,  name: 'Cơ Hội', shortName: 'Cơ Hội', type: 'CHANCE', group: 'NONE', icon: '❓', sub: 'Rút Thẻ' },
  { index: 8,  name: 'Tràng An', shortName: 'Tràng An', type: 'PROPERTY', group: 'LIGHT_BLUE', price: 100, buildCost: 50, rent: [6, 30, 90, 270, 400, 550], mortgageValue: 50 },
  { index: 9,  name: 'Vịnh Hạ Long', shortName: 'Vịnh Hạ Long', type: 'PROPERTY', group: 'LIGHT_BLUE', price: 120, buildCost: 50, rent: [8, 40, 100, 300, 450, 600], mortgageValue: 60 },
  { index: 10, name: 'NHÀ TÙ CÔN ĐẢO', shortName: 'CÔN ĐẢO', type: 'JAIL', group: 'NONE', icon: '⛓️', sub: 'Nhà Tù' },
  { index: 11, name: 'Phong Nha - Kẻ Bàng', shortName: 'Phong Nha', type: 'PROPERTY', group: 'PINK', price: 140, buildCost: 100, rent: [10, 50, 150, 450, 625, 750], mortgageValue: 70 },
  { index: 12, name: 'Tập Đoàn Điện Lực (EVN)', shortName: 'Điện Lực EVN', type: 'UTILITY', group: 'UTILITY', icon: '⚡', price: 150, mortgageValue: 75 },
  { index: 13, name: 'Cố Đô Huế', shortName: 'Cố Đô Huế', type: 'PROPERTY', group: 'PINK', price: 140, buildCost: 100, rent: [10, 50, 150, 450, 625, 750], mortgageValue: 70 },
  { index: 14, name: 'Phố Cổ Hội An', shortName: 'Hội An', type: 'PROPERTY', group: 'PINK', price: 160, buildCost: 100, rent: [12, 60, 180, 500, 700, 900], mortgageValue: 80 },
  { index: 15, name: 'Ga Đà Nẵng', shortName: 'Ga Đà Nẵng', type: 'STATION', group: 'STATION', icon: '🚆', price: 200, rent: [25, 50, 100, 200], mortgageValue: 100 },
  { index: 16, name: 'Bà Nà Hills', shortName: 'Bà Nà Hills', type: 'PROPERTY', group: 'ORANGE', price: 180, buildCost: 100, rent: [14, 70, 200, 550, 750, 950], mortgageValue: 90 },
  { index: 17, name: 'Khí Vận', shortName: 'Khí Vận', type: 'COMMUNITY_CHEST', group: 'NONE', icon: '🧧', sub: 'Rút Thẻ' },
  { index: 18, name: 'Quy Nhơn', shortName: 'Quy Nhơn', type: 'PROPERTY', group: 'ORANGE', price: 180, buildCost: 100, rent: [14, 70, 200, 550, 750, 950], mortgageValue: 90 },
  { index: 19, name: 'Tuy Hòa (Phú Yên)', shortName: 'Tuy Hòa', type: 'PROPERTY', group: 'ORANGE', price: 200, buildCost: 100, rent: [16, 80, 220, 600, 800, 1000], mortgageValue: 100 },
  { index: 20, name: 'PHỐ ĐI BỘ (ĐỖ XE)', shortName: 'PHỐ ĐI BỘ', type: 'FREE_PARKING', group: 'NONE', icon: '⛲', sub: 'An Toàn' },
  { index: 21, name: 'Buôn Ma Thuột', shortName: 'Buôn Ma Thuột', type: 'PROPERTY', group: 'RED', price: 220, buildCost: 150, rent: [18, 90, 250, 700, 875, 1050], mortgageValue: 110 },
  { index: 22, name: 'Cơ Hội', shortName: 'Cơ Hội', type: 'CHANCE', group: 'NONE', icon: '❓', sub: 'Rút Thẻ' },
  { index: 23, name: 'Mũi Né (Phan Thiết)', shortName: 'Mũi Né', type: 'PROPERTY', group: 'RED', price: 220, buildCost: 150, rent: [18, 90, 250, 700, 875, 1050], mortgageValue: 110 },
  { index: 24, name: 'Đà Lạt', shortName: 'Đà Lạt', type: 'PROPERTY', group: 'RED', price: 240, buildCost: 150, rent: [20, 100, 300, 750, 900, 1100], mortgageValue: 120 },
  { index: 25, name: 'Cảng Cam Ranh', shortName: 'Cảng Cam Ranh', type: 'STATION', group: 'STATION', icon: '⚓', price: 200, rent: [25, 50, 100, 200], mortgageValue: 100 },
  { index: 26, name: 'Nha Trang', shortName: 'Nha Trang', type: 'PROPERTY', group: 'YELLOW', price: 260, buildCost: 150, rent: [22, 110, 330, 800, 975, 1150], mortgageValue: 130 },
  { index: 27, name: 'Vũng Tàu', shortName: 'Vũng Tàu', type: 'PROPERTY', group: 'YELLOW', price: 260, buildCost: 150, rent: [22, 110, 330, 800, 975, 1150], mortgageValue: 130 },
  { index: 28, name: 'Công Ty Cấp Nước (SAWACO)', shortName: 'Cấp Nước', type: 'UTILITY', group: 'UTILITY', icon: '💧', price: 150, mortgageValue: 75 },
  { index: 29, name: 'Đảo Phú Quốc', shortName: 'Đảo Phú Quốc', type: 'PROPERTY', group: 'YELLOW', price: 280, buildCost: 150, rent: [24, 120, 360, 850, 1025, 1200], mortgageValue: 140 },
  { index: 30, name: 'VÀO TÙ', shortName: 'VÀO TÙ', type: 'GO_TO_JAIL', group: 'NONE', icon: '🚓', sub: 'Đến #10' },
  { index: 31, name: 'Chợ Nổi Cái Răng', shortName: 'Chợ Cái Răng', type: 'PROPERTY', group: 'GREEN', price: 300, buildCost: 200, rent: [26, 130, 390, 900, 1100, 1275], mortgageValue: 150 },
  { index: 32, name: 'Mũi Cà Mau', shortName: 'Mũi Cà Mau', type: 'PROPERTY', group: 'GREEN', price: 300, buildCost: 200, rent: [26, 130, 390, 900, 1100, 1275], mortgageValue: 150 },
  { index: 33, name: 'Khí Vận', shortName: 'Khí Vận', type: 'COMMUNITY_CHEST', group: 'NONE', icon: '🧧', sub: 'Rút Thẻ' },
  { index: 34, name: 'Đảo Côn Đảo', shortName: 'Đảo Côn Đảo', type: 'PROPERTY', group: 'GREEN', price: 320, buildCost: 200, rent: [28, 150, 450, 1000, 1200, 1400], mortgageValue: 160 },
  { index: 35, name: 'Sân Bay Tân Sơn Nhất', shortName: 'SB Tân Sơn Nhất', type: 'STATION', group: 'STATION', icon: '✈️', price: 200, rent: [25, 50, 100, 200], mortgageValue: 100 },
  { index: 36, name: 'Cơ Hội', shortName: 'Cơ Hội', type: 'CHANCE', group: 'NONE', icon: '❓', sub: 'Rút Thẻ' },
  { index: 37, name: 'Hồ Hoàn Kiếm', shortName: 'Hồ Hoàn Kiếm', type: 'PROPERTY', group: 'DARK_BLUE', price: 350, buildCost: 200, rent: [35, 175, 500, 1100, 1300, 1500], mortgageValue: 175 },
  { index: 38, name: 'Thuế Tiêu Thụ Đặc Biệt', shortName: 'Thuế Xa Xỉ', type: 'TAX', group: 'NONE', icon: '💎', sub: '-100K', taxAmount: 100 },
  { index: 39, name: 'Phố Đi Bộ Nguyễn Huệ', shortName: 'Phố Nguyễn Huệ', type: 'PROPERTY', group: 'DARK_BLUE', price: 400, buildCost: 200, rent: [50, 200, 600, 1400, 1700, 2000], mortgageValue: 200 }
];

export function createFreshBoard(boardPreset = 'STANDARD_40') {
  const source = boardPreset === 'MEGA_52' ? MEGA_52_BOARD_TILES : INITIAL_BOARD_TILES;
  return source.map(tile => ({
    ...tile,
    rent: tile.rent ? [...tile.rent] : undefined,
    ownerId: null,
    level: 0,
    isMortgaged: false
  }));
}
