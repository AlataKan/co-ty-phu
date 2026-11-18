export const CHANCE_CARDS = [
  {
    id: 'CH_01',
    deck: 'CHANCE',
    title: 'Nghỉ Dưỡng Đảo Phú Quốc',
    impact: 'ĐẾN #29',
    tone: 'info',
    text: 'Bay thẳng ra Phú Quốc nghỉ dưỡng. Nếu qua ô Khởi Hành, nhận 200K.',
    action: 'MOVE_TO',
    payload: { targetIndex: 29, collectSalary: true }
  },
  {
    id: 'CH_02',
    deck: 'CHANCE',
    title: 'Trúng Giải Độc Đắc Vietlott!',
    impact: '+200K',
    tone: 'positive',
    text: 'Ngân hàng lập tức cộng 200K tiền thưởng vào tài khoản của bạn.',
    action: 'ADD_CASH',
    payload: { amount: 200 }
  },
  {
    id: 'CH_03',
    deck: 'CHANCE',
    title: 'Chuyến Tàu Thống Nhất',
    impact: 'ĐẾN #15',
    tone: 'info',
    text: 'Bắt chuyến tàu Thống Nhất đến Ga Đà Nẵng. Nếu qua Khởi Hành, nhận 200K.',
    action: 'MOVE_TO',
    payload: { targetIndex: 15, collectSalary: true }
  },
  {
    id: 'CH_04',
    deck: 'CHANCE',
    title: 'Chỉnh Trang Đô Thị & Vỉa Hè',
    impact: '-25K/🏠',
    tone: 'negative',
    text: 'Cải tạo đô thị và chỉnh trang vỉa hè: Nộp 25K/nhà và 100K/khách sạn.',
    action: 'STREET_REPAIRS',
    payload: { houseCost: 25, hotelCost: 100 }
  },
  {
    id: 'CH_05',
    deck: 'CHANCE',
    title: 'Tắc Đường Giờ Cao Điểm',
    impact: 'LÙI 3 Ô',
    tone: 'negative',
    text: 'Tắc đường giờ cao điểm tại Ngã Tư Sở: Lùi lại 3 bước.',
    action: 'MOVE_STEPS',
    payload: { steps: -3 }
  },
  {
    id: 'CH_06',
    deck: 'CHANCE',
    title: 'Kiểm Tra Hạ Tầng Tiện Ích',
    impact: '⚡ 10x🎲',
    tone: 'info',
    text: 'Tiến đến Công ty tiện ích gần nhất. Nếu đã có chủ, đổ xúc xắc và trả gấp 10 lần điểm đổ.',
    action: 'NEAREST_UTILITY',
    payload: { multiplier: 10 }
  },
  {
    id: 'CH_07',
    deck: 'CHANCE',
    title: 'Vi Phạm Nồng Độ Cồn Kịch Khung',
    impact: 'VÀO TÙ!',
    tone: 'negative',
    text: 'Di chuyển ngay lập tức vào Nhà Tù Côn Đảo (Ô #10). Không nhận 200K.',
    action: 'GO_TO_JAIL',
    payload: null
  },
  {
    id: 'CH_08',
    deck: 'CHANCE',
    title: 'Công Tác Khẩn TP. Hồ Chí Minh',
    impact: 'ĐẾN #39',
    tone: 'info',
    text: 'Chuyến công tác khẩn cấp vào TP.HCM: Tiến thẳng đến Phố Đi Bộ Nguyễn Huệ.',
    action: 'MOVE_TO',
    payload: { targetIndex: 39, collectSalary: true }
  },
  {
    id: 'CH_09',
    deck: 'CHANCE',
    title: 'Đắc Cử Chủ Tịch Hiệp Hội BĐS',
    impact: '-50K/người',
    tone: 'negative',
    text: 'Liên hoan nhậm chức Chủ tịch Hiệp hội Bất động sản: Thết đãi mỗi người chơi khác 50K.',
    action: 'PAY_EACH_PLAYER',
    payload: { amount: 50 }
  },
  {
    id: 'CH_10',
    deck: 'CHANCE',
    title: 'Thẻ Ân Xá Đặc Biệt',
    impact: '🎫 RA TÙ',
    tone: 'positive',
    text: 'Được miễn phí ra khỏi Nhà Tù Côn Đảo (Có thể giữ lại dùng sau hoặc giao dịch).',
    action: 'JAIL_FREE_CARD',
    payload: { keepable: true }
  }
];

export const COMMUNITY_CARDS = [
  {
    id: 'CC_01',
    deck: 'COMMUNITY_CHEST',
    title: 'Lì Xì Tết Nguyên Đán',
    impact: '+20K/người',
    tone: 'positive',
    text: 'Lộc đầu xuân may mắn! Mỗi người chơi khác mừng tuổi bạn 20K.',
    action: 'COLLECT_FROM_ALL',
    payload: { amount: 20 }
  },
  {
    id: 'CC_02',
    deck: 'COMMUNITY_CHEST',
    title: 'Hoàn Thuế Thu Nhập Cá Nhân',
    impact: '+100K',
    tone: 'positive',
    text: 'Cơ quan Thuế quyết toán và hoàn trả 100K vào tài khoản của bạn.',
    action: 'ADD_CASH',
    payload: { amount: 100 }
  },
  {
    id: 'CC_03',
    deck: 'COMMUNITY_CHEST',
    title: 'Đi Đám Cưới Mùa Cuối Năm',
    impact: '-50K',
    tone: 'negative',
    text: 'Mùa cưới rộn ràng (3 thiệp liền): Chi 50K tiền mừng đám cưới.',
    action: 'DEDUCT_CASH',
    payload: { amount: 50 }
  },
  {
    id: 'CC_04',
    deck: 'COMMUNITY_CHEST',
    title: 'Khám Sức Khỏe Quốc Tế',
    impact: '-100K',
    tone: 'negative',
    text: 'Khám sức khỏe tổng quát định kỳ tại bệnh viện quốc tế: Trả phí 100K.',
    action: 'DEDUCT_CASH',
    payload: { amount: 100 }
  },
  {
    id: 'CC_05',
    deck: 'COMMUNITY_CHEST',
    title: 'Bão Đổ Bộ Gây Sạt Lở',
    impact: '-40K/🏠',
    tone: 'negative',
    text: 'Bão đổ bộ miền Trung: Gia cố tài sản 40K/nhà phố và 115K/khách sạn.',
    action: 'STREET_REPAIRS',
    payload: { houseCost: 40, hotelCost: 115 }
  },
  {
    id: 'CC_06',
    deck: 'COMMUNITY_CHEST',
    title: 'Quán Quân Khởi Nghiệp Quốc Gia',
    impact: '+150K',
    tone: 'positive',
    text: 'Đoạt giải Nhất cuộc thi Khởi nghiệp Quốc gia: Nhận thưởng 150K.',
    action: 'ADD_CASH',
    payload: { amount: 150 }
  },
  {
    id: 'CC_07',
    deck: 'COMMUNITY_CHEST',
    title: 'Về Thẳng Vạch Xuất Phát',
    impact: '+200K',
    tone: 'positive',
    text: 'Tiến thẳng tới ô Khởi Hành (#00) và nhận ngay 200K tiền lương.',
    action: 'MOVE_TO',
    payload: { targetIndex: 0, collectSalary: true }
  },
  {
    id: 'CC_08',
    deck: 'COMMUNITY_CHEST',
    title: 'Phạt Nguội Vượt Đèn Đỏ',
    impact: '-50K',
    tone: 'negative',
    text: 'Hệ thống camera giao thông ghi nhận lỗi vượt đèn đỏ: Nộp phạt 50K.',
    action: 'DEDUCT_CASH',
    payload: { amount: 50 }
  },
  {
    id: 'CC_09',
    deck: 'COMMUNITY_CHEST',
    title: 'Đặc Sản Vùng Miền Đại Thắng',
    impact: '+100K',
    tone: 'positive',
    text: 'Chuỗi cửa hàng đặc sản vùng miền trúng lớn: Nhận lợi nhuận 100K.',
    action: 'ADD_CASH',
    payload: { amount: 100 }
  },
  {
    id: 'CC_10',
    deck: 'COMMUNITY_CHEST',
    title: 'Kế Thừa Gia Sản Kiều Hối',
    impact: '+200K',
    tone: 'positive',
    text: 'Nhận khoản thừa kế gia sản từ người thân ở nước ngoài: +200K.',
    action: 'ADD_CASH',
    payload: { amount: 200 }
  }
];

export function shuffleDeck(cards) {
  const arr = [...cards];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
