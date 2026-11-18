// Dữ liệu Bàn Cờ Mở Rộng 6 Người - Đại Chiến Lục Hùng (52 Ô - Lưới 14x14)

export const MEGA_52_CONSTANTS = {
  INITIAL_BALANCE: 2500,
  SALARY_PASS: 250,
  SALARY_EXACT: 350,
  JAIL_INDEX: 13,
  FESTIVAL_INDEX: 26,
  NATIONAL_AUCTION_INDEX: 32,
  GO_TO_JAIL_INDEX: 39,
  TRANSIT_TICKET_FEE: 50
};

export const STATION_RENTS_6P = [25, 50, 100, 200, 350, 600];

// Cấu hình 3 Liên Minh Tập Đoàn cho chế độ 2v2v2
export const ALLIANCE_TEAMS = {
  SOUTH: { id: 'SOUTH', name: 'Tập Đoàn Phương Nam', members: ['P1', 'P5'], color: '#EA580C', badge: '🔥 Phương Nam' },
  OCEAN: { id: 'OCEAN', name: 'Tập Đoàn Đại Dương', members: ['P2', 'P6'], color: '#0284C7', badge: '🌊 Đại Dương' },
  ROYAL: { id: 'ROYAL', name: 'Tập Đoàn Hoàng Gia', members: ['P3', 'P4'], color: '#9333EA', badge: '👑 Hoàng Gia' }
};

export function getAllianceForPlayer(playerId) {
  return Object.values(ALLIANCE_TEAMS).find(team => team.members.includes(playerId)) || null;
}

// 52 Ô Địa Danh Xuyên Việt (Index 0 -> 51)
// Mảng rent của PROPERTY gồm 7 cấp: [Đất trống, 1 Nhà, 2 Nhà, 3 Nhà, 4 Nhà, Khách sạn (5), Landmark (6)]
export const MEGA_52_BOARD_TILES = [
  // Cạnh Dưới (0 -> 13): Tây Bắc, Đông Bắc & Đồng Bằng Bắc Bộ
  { index: 0,  name: 'KHỞI HÀNH', shortName: 'KHỞI HÀNH', type: 'START', group: 'NONE', icon: '🚩', sub: '+250K/350K' },
  { index: 1,  name: 'Mộc Châu', shortName: 'Mộc Châu', type: 'PROPERTY', group: 'BROWN', price: 60, buildCost: 50, rent: [4, 20, 60, 180, 320, 450, 650], mortgageValue: 30 },
  { index: 2,  name: 'Khí Vận', shortName: 'Khí Vận', type: 'COMMUNITY_CHEST', group: 'NONE', icon: '🧧', sub: 'Rút Thẻ' },
  { index: 3,  name: 'Điện Biên Phủ', shortName: 'Điện Biên', type: 'PROPERTY', group: 'BROWN', price: 60, buildCost: 50, rent: [4, 20, 60, 180, 320, 450, 650], mortgageValue: 30 },
  { index: 4,  name: 'Sa Pa', shortName: 'Sa Pa', type: 'PROPERTY', group: 'BROWN', price: 80, buildCost: 50, rent: [6, 30, 80, 220, 360, 500, 650], mortgageValue: 40 },
  { index: 5,  name: 'Thuế Thu Nhập Cá Nhân', shortName: 'Thuế TNCN', type: 'TAX', group: 'NONE', icon: '💸', sub: '-200K', taxAmount: 200 },
  { index: 6,  name: 'Bến Xe Mỹ Đình', shortName: 'BX Mỹ Đình', type: 'STATION', group: 'STATION', icon: '🚌', price: 200, rent: STATION_RENTS_6P, mortgageValue: 100 },
  { index: 7,  name: 'Cao Nguyên Đá Đồng Văn', shortName: 'Đồng Văn', type: 'PROPERTY', group: 'LIGHT_BLUE', price: 100, buildCost: 50, rent: [8, 40, 100, 300, 450, 600, 850], mortgageValue: 50 },
  { index: 8,  name: 'Cơ Hội', shortName: 'Cơ Hội', type: 'CHANCE', group: 'NONE', icon: '❓', sub: 'Rút Thẻ' },
  { index: 9,  name: 'Thác Bản Giốc (Cao Bằng)', shortName: 'Bản Giốc', type: 'PROPERTY', group: 'LIGHT_BLUE', price: 100, buildCost: 50, rent: [8, 40, 100, 300, 450, 600, 850], mortgageValue: 50 },
  { index: 10, name: 'Hồ Ba Bể', shortName: 'Hồ Ba Bể', type: 'PROPERTY', group: 'LIGHT_BLUE', price: 120, buildCost: 50, rent: [10, 50, 120, 330, 480, 650, 850], mortgageValue: 60 },
  { index: 11, name: 'Tập Đoàn Viễn Thông (Viettel 5G)', shortName: 'Viettel 5G', type: 'UTILITY', group: 'UTILITY', icon: '📡', price: 150, mortgageValue: 75 },
  { index: 12, name: 'Tam Đảo', shortName: 'Tam Đảo', type: 'PROPERTY', group: 'TEAL', price: 140, buildCost: 100, rent: [12, 60, 180, 500, 700, 900, 1200], mortgageValue: 70 },
  { index: 13, name: 'NHÀ TÙ CÔN ĐẢO', shortName: 'CÔN ĐẢO', type: 'JAIL', group: 'NONE', icon: '⛓️', sub: 'Nhà Tù' },

  // Cạnh Trái (14 -> 26): Vịnh Bắc Bộ, Bắc Trung Bộ & Di Sản Miền Trung
  { index: 14, name: 'Quần Thể Tràng An (Ninh Bình)', shortName: 'Tràng An', type: 'PROPERTY', group: 'TEAL', price: 140, buildCost: 100, rent: [12, 60, 180, 500, 700, 900, 1200], mortgageValue: 70 },
  { index: 15, name: 'Vịnh Hạ Long (Quảng Ninh)', shortName: 'Vịnh Hạ Long', type: 'PROPERTY', group: 'TEAL', price: 160, buildCost: 100, rent: [14, 70, 200, 550, 750, 950, 1200], mortgageValue: 80 },
  { index: 16, name: 'Cảng Hải Phòng', shortName: 'Cảng H.Phòng', type: 'STATION', group: 'STATION', icon: '🚢', price: 200, rent: STATION_RENTS_6P, mortgageValue: 100 },
  { index: 17, name: 'Phong Nha - Kẻ Bàng', shortName: 'Phong Nha', type: 'PROPERTY', group: 'PINK', price: 180, buildCost: 100, rent: [16, 80, 220, 600, 800, 1000, 1350], mortgageValue: 90 },
  { index: 18, name: 'Khí Vận', shortName: 'Khí Vận', type: 'COMMUNITY_CHEST', group: 'NONE', icon: '🧧', sub: 'Rút Thẻ' },
  { index: 19, name: 'Cố Đô Huế', shortName: 'Cố Đô Huế', type: 'PROPERTY', group: 'PINK', price: 180, buildCost: 100, rent: [16, 80, 220, 600, 800, 1000, 1350], mortgageValue: 90 },
  { index: 20, name: 'Phố Cổ Hội An', shortName: 'Hội An', type: 'PROPERTY', group: 'PINK', price: 200, buildCost: 100, rent: [18, 90, 250, 650, 850, 1050, 1350], mortgageValue: 100 },
  { index: 21, name: 'Ga Đà Nẵng', shortName: 'Ga Đà Nẵng', type: 'STATION', group: 'STATION', icon: '🚆', price: 200, rent: STATION_RENTS_6P, mortgageValue: 100 },
  { index: 22, name: 'Bà Nà Hills (Đà Nẵng)', shortName: 'Bà Nà Hills', type: 'PROPERTY', group: 'ORANGE', price: 220, buildCost: 150, rent: [20, 100, 300, 750, 925, 1100, 1500], mortgageValue: 110 },
  { index: 23, name: 'Cơ Hội', shortName: 'Cơ Hội', type: 'CHANCE', group: 'NONE', icon: '❓', sub: 'Rút Thẻ' },
  { index: 24, name: 'Kỳ Co - Eo Gió (Quy Nhơn)', shortName: 'Kỳ Co', type: 'PROPERTY', group: 'ORANGE', price: 220, buildCost: 150, rent: [20, 100, 300, 750, 925, 1100, 1500], mortgageValue: 110 },
  { index: 25, name: 'Ghềnh Đá Đĩa (Phú Yên)', shortName: 'Ghềnh Đá Đĩa', type: 'PROPERTY', group: 'ORANGE', price: 240, buildCost: 150, rent: [22, 110, 330, 800, 975, 1150, 1500], mortgageValue: 120 },
  { index: 26, name: 'PHỐ ĐI BỘ & QUỸ LỄ HỘI', shortName: 'QUỸ LỄ HỘI', type: 'FREE_PARKING', group: 'NONE', icon: '⛲', sub: 'Quỹ Thưởng' },

  // Cạnh Trên (27 -> 39): Tây Nguyên Đại Ngàn & Thiên Đường Biển Nam Trung Bộ
  { index: 27, name: 'Măng Đen (Kon Tum)', shortName: 'Măng Đen', type: 'PROPERTY', group: 'RED', price: 260, buildCost: 150, rent: [24, 120, 360, 850, 1025, 1200, 1650], mortgageValue: 130 },
  { index: 28, name: 'Tập Đoàn Điện Lực (EVN)', shortName: 'Điện Lực EVN', type: 'UTILITY', group: 'UTILITY', icon: '⚡', price: 150, mortgageValue: 75 },
  { index: 29, name: 'Buôn Ma Thuột (Đắk Lắk)', shortName: 'Buôn Ma Thuột', type: 'PROPERTY', group: 'RED', price: 260, buildCost: 150, rent: [24, 120, 360, 850, 1025, 1200, 1650], mortgageValue: 130 },
  { index: 30, name: 'Thành Phố Ngàn Hoa Đà Lạt', shortName: 'Đà Lạt', type: 'PROPERTY', group: 'RED', price: 280, buildCost: 150, rent: [26, 130, 390, 900, 1075, 1250, 1650], mortgageValue: 140 },
  { index: 31, name: 'Quân Cảng Cam Ranh', shortName: 'Cảng Cam Ranh', type: 'STATION', group: 'STATION', icon: '⚓', price: 200, rent: STATION_RENTS_6P, mortgageValue: 100 },
  { index: 32, name: 'Sàn Đấu Giá Quốc Gia', shortName: 'Đấu Giá QG', type: 'NATIONAL_AUCTION', group: 'NONE', icon: '🔨', sub: 'Đấu Giá Đất' },
  { index: 33, name: 'Vịnh Nha Trang', shortName: 'Nha Trang', type: 'PROPERTY', group: 'YELLOW', price: 300, buildCost: 200, rent: [28, 150, 450, 1000, 1200, 1400, 1850], mortgageValue: 150 },
  { index: 34, name: 'Khí Vận', shortName: 'Khí Vận', type: 'COMMUNITY_CHEST', group: 'NONE', icon: '🧧', sub: 'Rút Thẻ' },
  { index: 35, name: 'Vịnh Vĩnh Hy (Ninh Thuận)', shortName: 'Vĩnh Hy', type: 'PROPERTY', group: 'YELLOW', price: 300, buildCost: 200, rent: [28, 150, 450, 1000, 1200, 1400, 1850], mortgageValue: 150 },
  { index: 36, name: 'Mũi Né (Phan Thiết)', shortName: 'Mũi Né', type: 'PROPERTY', group: 'YELLOW', price: 320, buildCost: 200, rent: [30, 160, 480, 1050, 1250, 1450, 1850], mortgageValue: 160 },
  { index: 37, name: 'Metro Bến Thành - Suối Tiên', shortName: 'Metro Số 1', type: 'STATION', group: 'STATION', icon: '🚇', price: 200, rent: STATION_RENTS_6P, mortgageValue: 100 },
  { index: 38, name: 'Núi Bà Đen (Tây Ninh)', shortName: 'Núi Bà Đen', type: 'PROPERTY', group: 'PURPLE', price: 340, buildCost: 200, rent: [32, 175, 500, 1100, 1300, 1500, 2050], mortgageValue: 170 },
  { index: 39, name: 'VÀO TÙ', shortName: 'VÀO TÙ', type: 'GO_TO_JAIL', group: 'NONE', icon: '🚓', sub: 'Đến #13' },

  // Cạnh Phải (40 -> 51): Đông Nam Bộ, Miền Tây Sông Nước & Siêu Đô Thị
  { index: 40, name: 'Thành Phố Biển Vũng Tàu', shortName: 'Vũng Tàu', type: 'PROPERTY', group: 'PURPLE', price: 340, buildCost: 200, rent: [32, 175, 500, 1100, 1300, 1500, 2050], mortgageValue: 170 },
  { index: 41, name: 'Cơ Hội', shortName: 'Cơ Hội', type: 'CHANCE', group: 'NONE', icon: '❓', sub: 'Rút Thẻ' },
  { index: 42, name: 'Đảo Côn Đảo', shortName: 'Đảo Côn Đảo', type: 'PROPERTY', group: 'PURPLE', price: 360, buildCost: 200, rent: [35, 185, 530, 1150, 1350, 1600, 2050], mortgageValue: 180 },
  { index: 43, name: 'Tập Đoàn Cấp Nước (SAWACO)', shortName: 'Cấp Nước', type: 'UTILITY', group: 'UTILITY', icon: '💧', price: 150, mortgageValue: 75 },
  { index: 44, name: 'Chợ Nổi Cái Răng (Cần Thơ)', shortName: 'Chợ Cái Răng', type: 'PROPERTY', group: 'GREEN', price: 380, buildCost: 250, rent: [40, 200, 600, 1350, 1600, 1900, 2500], mortgageValue: 190 },
  { index: 45, name: 'Đất Mũi Cà Mau', shortName: 'Mũi Cà Mau', type: 'PROPERTY', group: 'GREEN', price: 380, buildCost: 250, rent: [40, 200, 600, 1350, 1600, 1900, 2500], mortgageValue: 190 },
  { index: 46, name: 'Khí Vận', shortName: 'Khí Vận', type: 'COMMUNITY_CHEST', group: 'NONE', icon: '🧧', sub: 'Rút Thẻ' },
  { index: 47, name: 'Đảo Ngọc Phú Quốc', shortName: 'Đảo Phú Quốc', type: 'PROPERTY', group: 'GREEN', price: 400, buildCost: 250, rent: [45, 220, 650, 1400, 1700, 2000, 2500], mortgageValue: 200 },
  { index: 48, name: 'Sân Bay Quốc Tế Tân Sơn Nhất', shortName: 'SB Tân Sơn Nhất', type: 'STATION', group: 'STATION', icon: '✈️', price: 200, rent: STATION_RENTS_6P, mortgageValue: 100 },
  { index: 49, name: 'Hồ Hoàn Kiếm (Thủ Đô Hà Nội)', shortName: 'Hồ Hoàn Kiếm', type: 'PROPERTY', group: 'DARK_BLUE', price: 450, buildCost: 300, rent: [60, 250, 750, 1600, 2000, 2400, 3500], mortgageValue: 225 },
  { index: 50, name: 'Thuế Xa Xỉ (Biệt Thự & Du Thuyền)', shortName: 'Thuế Xa Xỉ', type: 'TAX', group: 'NONE', icon: '💎', sub: '-150K', taxAmount: 150 },
  { index: 51, name: 'Phố Đi Bộ Nguyễn Huệ (TP.HCM)', shortName: 'Phố Nguyễn Huệ', type: 'PROPERTY', group: 'DARK_BLUE', price: 500, buildCost: 300, rent: [75, 300, 850, 1800, 2200, 2700, 3500], mortgageValue: 250 }
];
