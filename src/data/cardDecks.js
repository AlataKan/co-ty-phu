export const CHANCE_CARDS = [
  { id: 'CH_01', deck: 'CHANCE', text: 'Bay thẳng ra Phú Quốc nghỉ dưỡng. Nếu qua ô Khởi Hành, nhận 200K.', action: 'MOVE_TO', payload: { targetIndex: 29, collectSalary: true } },
  { id: 'CH_02', deck: 'CHANCE', text: 'Trúng giải Độc đắc Vietlott! Ngân hàng trả cho bạn 200K.', action: 'ADD_CASH', payload: { amount: 200 } },
  { id: 'CH_03', deck: 'CHANCE', text: 'Bắt chuyến tàu Thống Nhất đến Ga Đà Nẵng. Nếu qua Khởi Hành, nhận 200K.', action: 'MOVE_TO', payload: { targetIndex: 15, collectSalary: true } },
  { id: 'CH_04', deck: 'CHANCE', text: 'Cải tạo đô thị và chỉnh trang vỉa hè: Nộp 25K/nhà và 100K/khách sạn.', action: 'STREET_REPAIRS', payload: { houseCost: 25, hotelCost: 100 } },
  { id: 'CH_05', deck: 'CHANCE', text: 'Tắc đường giờ cao điểm tại Ngã Tư Sở: Lùi lại 3 bước.', action: 'MOVE_STEPS', payload: { steps: -3 } },
  { id: 'CH_06', deck: 'CHANCE', text: 'Tiến đến Công ty tiện ích gần nhất. Nếu đã có chủ, đổ xúc xắc và trả gấp 10 lần điểm đổ.', action: 'NEAREST_UTILITY', payload: { multiplier: 10 } },
  { id: 'CH_07', deck: 'CHANCE', text: 'Vi phạm nồng độ cồn kịch khung: Vào Tù ngay lập tức! Không nhận 200K.', action: 'GO_TO_JAIL', payload: null },
  { id: 'CH_08', deck: 'CHANCE', text: 'Chuyến công tác khẩn cấp vào TP.HCM: Tiến thẳng đến Phố Đi Bộ Nguyễn Huệ.', action: 'MOVE_TO', payload: { targetIndex: 39, collectSalary: true } },
  { id: 'CH_09', deck: 'CHANCE', text: 'Đắc cử Chủ tịch Hiệp hội Bất động sản: Thết đãi mỗi người chơi khác 50K.', action: 'PAY_EACH_PLAYER', payload: { amount: 50 } },
  { id: 'CH_10', deck: 'CHANCE', text: 'Thẻ Ân Xá Đặc Biệt: Được ra tù miễn phí (Có thể giữ lại hoặc đem bán).', action: 'JAIL_FREE_CARD', payload: { keepable: true } }
];

export const COMMUNITY_CARDS = [
  { id: 'CC_01', deck: 'COMMUNITY_CHEST', text: 'Nhận tiền Lì xì Tết Nguyên Đán: Mỗi người chơi khác mừng tuổi bạn 20K.', action: 'COLLECT_FROM_ALL', payload: { amount: 20 } },
  { id: 'CC_02', deck: 'COMMUNITY_CHEST', text: 'Hoàn thuế Thu nhập cá nhân: Nhận 100K từ Ngân hàng.', action: 'ADD_CASH', payload: { amount: 100 } },
  { id: 'CC_03', deck: 'COMMUNITY_CHEST', text: 'Đi đám cưới mùa cuối năm (3 thiệp liền): Nộp 50K vào Ngân hàng.', action: 'DEDUCT_CASH', payload: { amount: 50 } },
  { id: 'CC_04', deck: 'COMMUNITY_CHEST', text: 'Khám sức khỏe tổng quát tại bệnh viện quốc tế: Trả viện phí 100K.', action: 'DEDUCT_CASH', payload: { amount: 100 } },
  { id: 'CC_05', deck: 'COMMUNITY_CHEST', text: 'Bão đổ bộ miền Trung gây sạt lở: Sửa chữa tài sản 40K/nhà và 115K/khách sạn.', action: 'STREET_REPAIRS', payload: { houseCost: 40, hotelCost: 115 } },
  { id: 'CC_06', deck: 'COMMUNITY_CHEST', text: 'Đoạt giải Nhất cuộc thi Khởi nghiệp Quốc gia: Nhận thưởng 150K.', action: 'ADD_CASH', payload: { amount: 150 } },
  { id: 'CC_07', deck: 'COMMUNITY_CHEST', text: 'Đi thẳng về vạch Xuất Phát: Tiến tới ô Khởi Hành và nhận ngay 200K.', action: 'MOVE_TO', payload: { targetIndex: 0, collectSalary: true } },
  { id: 'CC_08', deck: 'COMMUNITY_CHEST', text: 'Bị phạt nguội do vượt đèn đỏ: Nộp phạt 50K cho Ngân hàng.', action: 'DEDUCT_CASH', payload: { amount: 50 } },
  { id: 'CC_09', deck: 'COMMUNITY_CHEST', text: 'Kinh doanh đặc sản vùng miền đại thắng: Nhận 100K từ Ngân hàng.', action: 'ADD_CASH', payload: { amount: 100 } },
  { id: 'CC_10', deck: 'COMMUNITY_CHEST', text: 'Kế thừa gia sản từ người thân ở nước ngoài: Nhận 200K từ Ngân hàng.', action: 'ADD_CASH', payload: { amount: 200 } }
];

export function shuffleDeck(cards) {
  const arr = [...cards];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
