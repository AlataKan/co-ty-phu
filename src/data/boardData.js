// Bảng mã màu chuẩn theo UI/UX Spec
export const GROUP_COLORS = {
  BROWN:      { primary: '#8B5A2B', border: '#5C3A1B', text: '#FFFFFF', label: 'Nâu Tây Bắc' },
  LIGHT_BLUE: { primary: '#38BDF8', border: '#0284C7', text: '#0F172A', label: 'Xanh Kỳ Quan' },
  PINK:       { primary: '#F472B6', border: '#DB2777', text: '#FFFFFF', label: 'Hồng Di Sản' },
  ORANGE:     { primary: '#FB923C', border: '#EA580C', text: '#0F172A', label: 'Cam Duyên Hải' },
  RED:        { primary: '#EF4444', border: '#B91C1C', text: '#FFFFFF', label: 'Đỏ Cao Nguyên' },
  YELLOW:     { primary: '#FACC15', border: '#CA8A04', text: '#0F172A', label: 'Vàng Biển Đảo' },
  GREEN:      { primary: '#22C55E', border: '#15803D', text: '#FFFFFF', label: 'Xanh Miền Tây' },
  DARK_BLUE:  { primary: '#1E40AF', border: '#1E3A8A', text: '#FFFFFF', label: 'Xanh Đô Thị' },
  STATION:    { primary: '#334155', border: '#0F172A', text: '#F8FAFC', label: 'Bến Bãi' },
  UTILITY:    { primary: '#64748B', border: '#334155', text: '#FFFFFF', label: 'Tiện Ích' },
  NONE:       { primary: '#E2E8F0', border: '#94A3B8', text: '#0F172A', label: 'Đặc Biệt' }
};

// Cấu hình 4 người chơi chuẩn
export const PLAYER_PRESETS = [
  { id: 'P1', defaultName: 'Người chơi 1', color: '#E11D48', avatar: 'Nón Lá' },
  { id: 'P2', defaultName: 'Người chơi 2', color: '#2563EB', avatar: 'Xe Xích Lô' },
  { id: 'P3', defaultName: 'Người chơi 3', color: '#D97706', avatar: 'Trống Đồng' },
  { id: 'P4', defaultName: 'Người chơi 4', color: '#9333EA', avatar: 'Hoa Sen' }
];

// Hằng số kinh tế cốt lõi (Đơn vị: K = Nghìn VNĐ)
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
  { index: 0,  name: 'KHỞI HÀNH', type: 'START', group: 'NONE' },
  { index: 1,  name: 'Mộc Châu', type: 'PROPERTY', group: 'BROWN', price: 60, buildCost: 50, rent: [2, 10, 30, 90, 160, 250], mortgageValue: 30 },
  { index: 2,  name: 'Khí Vận', type: 'COMMUNITY_CHEST', group: 'NONE' },
  { index: 3,  name: 'Sa Pa', type: 'PROPERTY', group: 'BROWN', price: 60, buildCost: 50, rent: [4, 20, 60, 180, 320, 450], mortgageValue: 30 },
  { index: 4,  name: 'Thuế Thu Nhập', type: 'TAX', group: 'NONE', taxAmount: 200 },
  { index: 5,  name: 'Bến Xe Mỹ Đình', type: 'STATION', group: 'STATION', price: 200, mortgageValue: 100 },
  { index: 6,  name: 'Tam Đảo', type: 'PROPERTY', group: 'LIGHT_BLUE', price: 100, buildCost: 50, rent: [6, 30, 90, 270, 400, 550], mortgageValue: 50 },
  { index: 7,  name: 'Cơ Hội', type: 'CHANCE', group: 'NONE' },
  { index: 8,  name: 'Tràng An', type: 'PROPERTY', group: 'LIGHT_BLUE', price: 100, buildCost: 50, rent: [6, 30, 90, 270, 400, 550], mortgageValue: 50 },
  { index: 9,  name: 'Vịnh Hạ Long', type: 'PROPERTY', group: 'LIGHT_BLUE', price: 120, buildCost: 50, rent: [8, 40, 100, 300, 450, 600], mortgageValue: 60 },
  { index: 10, name: 'NHÀ TÙ CÔN ĐẢO', type: 'JAIL', group: 'NONE' },
  { index: 11, name: 'Phong Nha - Kẻ Bàng', type: 'PROPERTY', group: 'PINK', price: 140, buildCost: 100, rent: [10, 50, 150, 450, 625, 750], mortgageValue: 70 },
  { index: 12, name: 'Tập Đoàn Điện Lực (EVN)', type: 'UTILITY', group: 'UTILITY', price: 150, mortgageValue: 75 },
  { index: 13, name: 'Cố Đô Huế', type: 'PROPERTY', group: 'PINK', price: 140, buildCost: 100, rent: [10, 50, 150, 450, 625, 750], mortgageValue: 70 },
  { index: 14, name: 'Phố Cổ Hội An', type: 'PROPERTY', group: 'PINK', price: 160, buildCost: 100, rent: [12, 60, 180, 500, 700, 900], mortgageValue: 80 },
  { index: 15, name: 'Ga Đà Nẵng', type: 'STATION', group: 'STATION', price: 200, mortgageValue: 100 },
  { index: 16, name: 'Bà Nà Hills', type: 'PROPERTY', group: 'ORANGE', price: 180, buildCost: 100, rent: [14, 70, 200, 550, 750, 950], mortgageValue: 90 },
  { index: 17, name: 'Khí Vận', type: 'COMMUNITY_CHEST', group: 'NONE' },
  { index: 18, name: 'Quy Nhơn', type: 'PROPERTY', group: 'ORANGE', price: 180, buildCost: 100, rent: [14, 70, 200, 550, 750, 950], mortgageValue: 90 },
  { index: 19, name: 'Tuy Hòa (Phú Yên)', type: 'PROPERTY', group: 'ORANGE', price: 200, buildCost: 100, rent: [16, 80, 220, 600, 800, 1000], mortgageValue: 100 },
  { index: 20, name: 'PHỐ ĐI BỘ (ĐỖ XE)', type: 'FREE_PARKING', group: 'NONE' },
  { index: 21, name: 'Buôn Ma Thuột', type: 'PROPERTY', group: 'RED', price: 220, buildCost: 150, rent: [18, 90, 250, 700, 875, 1050], mortgageValue: 110 },
  { index: 22, name: 'Cơ Hội', type: 'CHANCE', group: 'NONE' },
  { index: 23, name: 'Mũi Né (Phan Thiết)', type: 'PROPERTY', group: 'RED', price: 220, buildCost: 150, rent: [18, 90, 250, 700, 875, 1050], mortgageValue: 110 },
  { index: 24, name: 'Đà Lạt', type: 'PROPERTY', group: 'RED', price: 240, buildCost: 150, rent: [20, 100, 300, 750, 900, 1100], mortgageValue: 120 },
  { index: 25, name: 'Cảng Cam Ranh', type: 'STATION', group: 'STATION', price: 200, mortgageValue: 100 },
  { index: 26, name: 'Nha Trang', type: 'PROPERTY', group: 'YELLOW', price: 260, buildCost: 150, rent: [22, 110, 330, 800, 975, 1150], mortgageValue: 130 },
  { index: 27, name: 'Vũng Tàu', type: 'PROPERTY', group: 'YELLOW', price: 260, buildCost: 150, rent: [22, 110, 330, 800, 975, 1150], mortgageValue: 130 },
  { index: 28, name: 'Công Ty Cấp Nước (SAWACO)', type: 'UTILITY', group: 'UTILITY', price: 150, mortgageValue: 75 },
  { index: 29, name: 'Đảo Phú Quốc', type: 'PROPERTY', group: 'YELLOW', price: 280, buildCost: 150, rent: [24, 120, 360, 850, 1025, 1200], mortgageValue: 140 },
  { index: 30, name: 'VÀO TÙ', type: 'GO_TO_JAIL', group: 'NONE' },
  { index: 31, name: 'Chợ Nổi Cái Răng', type: 'PROPERTY', group: 'GREEN', price: 300, buildCost: 200, rent: [26, 130, 390, 900, 1100, 1275], mortgageValue: 150 },
  { index: 32, name: 'Mũi Cà Mau', type: 'PROPERTY', group: 'GREEN', price: 300, buildCost: 200, rent: [26, 130, 390, 900, 1100, 1275], mortgageValue: 150 },
  { index: 33, name: 'Khí Vận', type: 'COMMUNITY_CHEST', group: 'NONE' },
  { index: 34, name: 'Đảo Côn Đảo', type: 'PROPERTY', group: 'GREEN', price: 320, buildCost: 200, rent: [28, 150, 450, 1000, 1200, 1400], mortgageValue: 160 },
  { index: 35, name: 'Sân Bay Tân Sơn Nhất', type: 'STATION', group: 'STATION', price: 200, mortgageValue: 100 },
  { index: 36, name: 'Cơ Hội', type: 'CHANCE', group: 'NONE' },
  { index: 37, name: 'Hồ Hoàn Kiếm', type: 'PROPERTY', group: 'DARK_BLUE', price: 350, buildCost: 200, rent: [35, 175, 500, 1100, 1300, 1500], mortgageValue: 175 },
  { index: 38, name: 'Thuế Tiêu Thụ Đặc Biệt', type: 'TAX', group: 'NONE', taxAmount: 100 },
  { index: 39, name: 'Phố Đi Bộ Nguyễn Huệ', type: 'PROPERTY', group: 'DARK_BLUE', price: 400, buildCost: 200, rent: [50, 200, 600, 1400, 1700, 2000], mortgageValue: 200 }
];

// Khởi tạo bàn cờ mới với trạng thái động
export function createFreshBoard() {
  return INITIAL_BOARD_TILES.map(tile => ({
    ...tile,
    rent: tile.rent ? [...tile.rent] : undefined,
    ownerId: null,
    level: 0,
    isMortgaged: false
  }));
}
