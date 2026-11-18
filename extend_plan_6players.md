# KỊCH BẢN & THIẾT KẾ BÀN CỜ MỞ RỘNG 6 NGƯỜI (MEGA EXPANSION - 52 Ô)

Khi nâng số lượng người chơi từ 4 lên **6 người**, bàn cờ 40 ô truyền thống sẽ lập tức gặp 2 vấn đề lớn: **Khan hiếm đất trầm trọng** (trung bình mỗi người chỉ mua được 3–4 mảnh đất là hết sạch bàn cờ, không ai gom đủ bộ màu) và **Thời gian chờ lượt quá lâu** (phải đợi 5 người đi xong mới tới lượt mình).

Bản thiết kế chế độ mở rộng **Đại Chiến Lục Hùng (6-Player Mode)** giải quyết triệt để hai vấn đề trên bằng cách mở rộng bàn cờ lên **52 ô (Lưới $14 \times 14$)**, bổ sung **Xúc xắc Tốc độ**, cơ chế **Khu Đô Thị Liên Kết (Xây nhà khi gom đủ 2/3 bộ màu)** và hệ thống **Tuyến Metro Xuyên Việt**.

---

## 1. NGUYÊN LÝ CỐT LÕI & CƠ CHẾ MỚI DÀNH RIÊNG CHO 6 NGƯỜI

### 1.1. Thông số khởi điểm cân bằng cho 6 người
* **Số lượng người chơi:** $5 - 6$ người (`P1` $\rightarrow$ `P6`).
* **Vốn khởi điểm (`INITIAL_BALANCE`):** **$2.500\text{K}$ / người** (Tăng thêm $500\text{K}$ so với bản 4 người để đủ thanh khoản trên bàn cờ 52 ô).
* **Lương qua ô Khởi Hành (`SALARY`):** **$+250\text{K}$** khi đi qua, hoặc **$+350\text{K}$** nếu dừng chân chính xác ngay trên ô Khởi Hành (`#0`).
* **Định danh 6 Quân cờ 3D nổi bật:**
  * `P1` (`#E11D48` - Đỏ Ruby): Rồng Vàng `🐉`
  * `P2` (`#2563EB` - Xanh Dương): Vương Miện `👑`
  * `P3` (`#059669` - Xanh Ngọc): Tên Lửa `🚀`
  * `P4` (`#9333EA` - Tím Hoàng Gia): Kim Cương `💎`
  * `P5` (`#EA580C` - Cam Hổ Phách): Kỳ Lân `🦁`
  * `P6` (`#0D9488` - Xanh Lam Ngọc): Du Thuyền `🛥️`

### 1.2. Cơ chế "Quy Hoạch Linh Hoạt" (Chống bế tắc khi 6 người tranh đất)
Trong ván 6 người, việc sở hữu trọn vẹn $3/3$ ô cùng màu cực kỳ khó khăn. Do đó, luật xây dựng được nới lỏng thành 2 cấp độ:
1. **Liên doanh Đô thị (Sở hữu $2/3$ ô trong nhóm màu 3 ô):**
   * Người chơi đã được phép **Xây Nhà phố 3D (`🏠`) tối đa lên Cấp 2 (2 Nhà)** trên hai ô đó mà không cần đợi mua ô thứ 3.
2. **Độc quyền Toàn diện (Sở hữu đủ trọn bộ màu $2/2$ hoặc $3/3$ ô):**
   * Tiền thuê đất trống nhân đôi ($\times 2$).
   * Mở khóa xây dựng lên **3 Nhà, 4 Nhà, Khách sạn 5 Sao (`🏨` Cấp 5)** và cấp độ mới **Siêu Quần Thể / Landmark (`🏙️` Cấp 6)**.

### 1.3. Cơ chế "Xúc Xắc Tốc Độ" (Speed Die - Tăng nhịp độ 6 người)
Ngoài 2 viên xúc xắc 6 mặt tiêu chuẩn (hiển thị bằng chấm tròn `1..6`), từ vòng thứ 2 trở đi sẽ kích hoạt thêm **Viên Xúc Xắc Thứ 3 (Xúc xắc Tốc độ màu Vàng)**:
* **Các mặt `1`, `2`, `3` chấm:** Cộng thẳng vào tổng số bước di chuyển của 2 viên chính (giúp quân cờ đi nhanh hơn trên bàn cờ lớn 52 ô).
* **Mặt `🚌 Xe Buýt Nhanh`:** Sau khi đi hết số điểm của 2 viên xúc xắc chính, người chơi được quyền chọn đứng yên hoặc **nhảy thẳng tới ô Cơ Hội / Khí Vận hoặc Bến/Ga gần nhất phía trước**.
* **Mặt `🎩 Tỷ Phú`:** Sau khi xử lý xong ô dừng chân, người chơi tự động bay thẳng tới **ô đất trống chưa có chủ tiếp theo** trên bàn cờ để có cơ hội mua (Nếu toàn bộ 52 ô đã có chủ, người chơi phải bay tới ô đất có chủ gần nhất và trả tiền thuê).

---

## 2. THIẾT KẾ LẠI BÀN CỜ 52 Ô (LƯỚI $14 \times 14$ - 10 NHÓM ĐỊA DANH)

Bàn cờ tiêu chuẩn $11 \times 11$ (40 ô, mỗi cạnh 9 ô giữa 2 góc) được nâng cấp thành **Lưới $14 \times 14$ (52 ô, mỗi cạnh gồm 12 ô nằm giữa 2 ô góc)**.
* **Tăng từ 8 nhóm màu lên 10 nhóm màu** (Tổng cộng **28 địa danh du lịch & kinh tế nổi tiếng Việt Nam**, thay vì 22 địa danh như bản 4 người).
* **Tăng từ 4 Bến/Ga lên 6 Tuyến Giao Thông Huyết Mạch** và **3 Tập Đoàn Tiện Ích Quốc Gia**.

### Sơ đồ cấu trúc 4 cạnh bàn cờ 52 ô (`Index 0 -> 51`)

```
[26: PHỐ ĐI BỘ] -> [27..38: 12 Ô CẠNH TRÊN (Tây Nguyên & Nam Trung Bộ)] -> [39: VÀO TÙ]
       ^                                                                          |
       |                                                                          v
[14..25: 12 Ô CẠNH TRÁI]         SÂN TRUNG TÂM 3D DIORAMA                [40..51: 12 Ô CẠNH PHẢI]
(Bắc Trung Bộ & Di Sản)          (Lưới 12x12 ở giữa bàn cờ)              (Nam Bộ & Siêu Đô Thị)
       ^                                                                          |
       |                                                                          v
[13: CÔN ĐẢO]  <-- [12..1: 12 Ô CẠNH DƯỚI (Tây Bắc, Đông Bắc & Bắc Bộ)] <-- [0: KHỞI HÀNH]
```

### 2.1. Cạnh Dưới (`Index 0 -> 13`): Vùng Tây Bắc, Đông Bắc & Đồng Bằng Bắc Bộ
* **Ô 0 (Góc Dưới Phải): KHỞI HÀNH** – Đi qua nhận $+250\text{K}$, dừng chính xác nhận $+350\text{K}$.
* **Ô 1 (Nâu - Tây Bắc): Mộc Châu** – Giá mua: $60\text{K}$
* **Ô 2: Khí Vận** (`🧧`)
* **Ô 3 (Nâu - Tây Bắc): Điện Biên Phủ** – Giá mua: $60\text{K}$ *(Địa danh mới)*
* **Ô 4 (Nâu - Tây Bắc): Sa Pa** – Giá mua: $80\text{K}$
* **Ô 5: Thuế Thu Nhập Cá Nhân** – Nộp $200\text{K}$ vào Ngân hàng.
* **Ô 6 (Giao Thông #1): Bến Xe Mỹ Đình** (`🚌`) – Giá mua: $200\text{K}$
* **Ô 7 (Xanh Lam Nhạt - Đông Bắc): Cao nguyên đá Đồng Văn (Hà Giang)** – Giá mua: $100\text{K}$ *(Địa danh mới)*
* **Ô 8: Cơ Hội** (`❓`)
* **Ô 9 (Xanh Lam Nhạt - Đông Bắc): Thác Bản Giốc (Cao Bằng)** – Giá mua: $100\text{K}$ *(Địa danh mới)*
* **Ô 10 (Xanh Lam Nhạt - Đông Bắc): Hồ Ba Bể** – Giá mua: $120\text{K}$ *(Địa danh mới)*
* **Ô 11 (Tiện Ích #1): Tập Đoàn Viễn Thông (Viettel 5G)** (`📡`) – Giá mua: $150\text{K}$ *(Tiện ích mới)*
* **Ô 12 (Xanh Ngọc - Kỳ Quan Bắc Bộ): Tam Đảo** – Giá mua: $140\text{K}$
* **Ô 13 (Góc Dưới Trái): NHÀ TÙ CÔN ĐẢO** (`⛓️`) – Thăm tù hoặc tạm giam.

### 2.2. Cạnh Trái (`Index 14 -> 26`): Vùng Vịnh Bắc Bộ, Bắc Trung Bộ & Di Sản Miền Trung
* **Ô 14 (Xanh Ngọc - Kỳ Quan Bắc Bộ): Quần thể Tràng An (Ninh Bình)** – Giá mua: $140\text{K}$
* **Ô 15 (Xanh Ngọc - Kỳ Quan Bắc Bộ): Vịnh Hạ Long (Quảng Ninh)** – Giá mua: $160\text{K}$
* **Ô 16 (Giao Thông #2): Cảng Hải Phòng** (`🚢`) – Giá mua: $200\text{K}$ *(Giao thông mới)*
* **Ô 17 (Hồng - Di Sản Bắc Trung Bộ): Phong Nha - Kẻ Bàng** – Giá mua: $180\text{K}$
* **Ô 18: Khí Vận** (`🧧`)
* **Ô 19 (Hồng - Di Sản Bắc Trung Bộ): Cố Đô Huế** – Giá mua: $180\text{K}$
* **Ô 20 (Hồng - Di Sản Bắc Trung Bộ): Phố Cổ Hội An** – Giá mua: $200\text{K}$
* **Ô 21 (Giao Thông #3): Ga Đà Nẵng** (`🚆`) – Giá mua: $200\text{K}$
* **Ô 22 (Cam - Duyên Hải Trung Bộ): Bà Nà Hills (Đà Nẵng)** – Giá mua: $220\text{K}$
* **Ô 23: Cơ Hội** (`❓`)
* **Ô 24 (Cam - Duyên Hải Trung Bộ): Kỳ Co - Eo Gió (Quy Nhơn)** – Giá mua: $220\text{K}$
* **Ô 25 (Cam - Duyên Hải Trung Bộ): Ghềnh Đá Đĩa (Tuy Hòa - Phú Yên)** – Giá mua: $240\text{K}$
* **Ô 26 (Góc Trên Trái): PHỐ ĐI BỘ & QUỸ LỄ HỘI** (`⛲`) – Ô nghỉ chân hoặc nhận Quỹ Lễ Hội tích lũy.

### 2.3. Cạnh Trên (`Index 27 -> 39`): Vùng Tây Nguyên Đại Ngàn & Thiên Đường Biển Nam Trung Bộ
* **Ô 27 (Đỏ - Tây Nguyên Đại Ngàn): Măng Đen (Kon Tum)** – Giá mua: $260\text{K}$ *(Địa danh mới)*
* **Ô 28 (Tiện Ích #2): Tập Đoàn Điện Lực (EVN)** (`⚡`) – Giá mua: $150\text{K}$
* **Ô 29 (Đỏ - Tây Nguyên Đại Ngàn): Buôn Ma Thuột (Đắk Lắk)** – Giá mua: $260\text{K}$
* **Ô 30 (Đỏ - Tây Nguyên Đại Ngàn): Thành phố ngàn hoa Đà Lạt** – Giá mua: $280\text{K}$
* **Ô 31 (Giao Thông #4): Quân Cảng Cam Ranh** (`⚓`) – Giá mua: $200\text{K}$
* **Ô 32: Sàn Đấu Giá Quốc Gia** (`🔨`) – Rút 1 lô đất chưa có chủ bất kỳ trên bàn cờ ra đấu giá công khai cho cả 6 người! *(Ô sự kiện mới)*
* **Ô 33 (Vàng - Biển Nam Trung Bộ): Vịnh Nha Trang** – Giá mua: $300\text{K}$
* **Ô 34: Khí Vận** (`🧧`)
* **Ô 35 (Vàng - Biển Nam Trung Bộ): Vịnh Vĩnh Hy (Ninh Thuận)** – Giá mua: $300\text{K}$ *(Địa danh mới)*
* **Ô 36 (Vàng - Biển Nam Trung Bộ): Mũi Né (Phan Thiết)** – Giá mua: $320\text{K}$
* **Ô 37 (Giao Thông #5): Tuyến Metro Bến Thành - Suối Tiên** (`🚇`) – Giá mua: $200\text{K}$ *(Cho phép dịch chuyển sang trạm giao thông khác)*
* **Ô 38 (Tím - Đông Nam Bộ & Biển): Núi Bà Đen (Tây Ninh)** – Giá mua: $340\text{K}$ *(Địa danh mới)*
* **Ô 39 (Góc Trên Phải): VÀO TÙ** (`🚓`) – Lập tức di chuyển thẳng vào Ô `#13` (Nhà Tù Côn Đảo).

### 2.4. Cạnh Phải (`Index 40 -> 51`): Vùng Đông Nam Bộ, Miền Tây Sông Nước & Siêu Đô Thị
* **Ô 40 (Tím - Đông Nam Bộ & Biển): Thành phố biển Vũng Tàu** – Giá mua: $340\text{K}$
* **Ô 41: Cơ Hội** (`❓`)
* **Ô 42 (Tím - Đông Nam Bộ & Biển): Đảo Côn Đảo** – Giá mua: $360\text{K}$
* **Ô 43 (Tiện Ích #3): Tập Đoàn Cấp Nước (SAWACO)** (`💧`) – Giá mua: $150\text{K}$
* **Ô 44 (Xanh Lá - Miền Tây & Đảo Ngọc): Chợ Nổi Cái Răng (Cần Thơ)** – Giá mua: $380\text{K}$
* **Ô 45 (Xanh Lá - Miền Tây & Đảo Ngọc): Đất Mũi Cà Mau** – Giá mua: $380\text{K}$
* **Ô 46: Khí Vận** (`🧧`)
* **Ô 47 (Xanh Lá - Miền Tây & Đảo Ngọc): Đảo Ngọc Phú Quốc** – Giá mua: $400\text{K}$
* **Ô 48 (Giao Thông #6): Sân Bay Quốc Tế Tân Sơn Nhất** (`✈️`) – Giá mua: $200\text{K}$
* **Ô 49 (Xanh Đậm - Siêu Đô Thị): Hồ Hoàn Kiếm (Thủ đô Hà Nội)** – Giá mua: $450\text{K}$
* **Ô 50: Thuế Xa Xỉ (Thuế Biệt Thự & Du Thuyền)** (`💎`) – Nộp $150\text{K}$ vào Ngân hàng.
* **Ô 51 (Xanh Đậm - Siêu Đô Thị): Phố Đi Bộ Nguyễn Huệ (TP.HCM)** – Giá mua: $500\text{K}$

---

## 3. BẢNG THÔNG SỐ KINH TẾ 10 NHÓM MÀU (CHẾ ĐỘ 6 NGƯỜI)

| Nhóm Màu | Các Ô Địa Danh (ID) | Giá Mua | Giá Xây Nhà | Thuê Trống | 1 Nhà (`🏠`) | 2 Nhà (`🏠x2`) | 3 Nhà (`🏠x3`) | 4 Nhà (`🏠x4`) | K.Sạn (`🏨`) | Landmark (`🏙️`) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Nâu** | `#1, #3, #4` | $60-80$ | $50$ | $4-6$ | $20-30$ | $60-80$ | $180-220$ | $320-360$ | $450-500$ | $650$ |
| **2. Xanh Lam Nhạt** | `#7, #9, #10` | $100-120$ | $50$ | $8-10$ | $40-50$ | $100-120$ | $300-330$ | $450-480$ | $600-650$ | $850$ |
| **3. Xanh Ngọc** | `#12, #14, #15` | $140-160$ | $100$ | $12-14$ | $60-70$ | $180-200$ | $500-550$ | $700-750$ | $900-950$ | $1200$ |
| **4. Hồng** | `#17, #19, #20` | $180-200$ | $100$ | $16-18$ | $80-90$ | $220-250$ | $600-650$ | $800-850$ | $1000-1050$ | $1350$ |
| **5. Cam** | `#22, #24, #25` | $220-240$ | $150$ | $20-22$ | $100-110$ | $300-330$ | $750-800$ | $925-975$ | $1100-1150$ | $1500$ |
| **6. Đỏ** | `#27, #29, #30` | $260-280$ | $150$ | $24-26$ | $120-130$ | $360-390$ | $850-900$ | $1025-1075$ | $1200-1250$ | $1650$ |
| **7. Vàng** | `#33, #35, #36` | $300-320$ | $200$ | $28-30$ | $150-160$ | $450-480$ | $1000-1050$ | $1200-1250$ | $1400-1450$ | $1850$ |
| **8. Tím** *(Mới)* | `#38, #40, #42` | $340-360$ | $200$ | $32-35$ | $175-185$ | $500-530$ | $1100-1150$ | $1300-1350$ | $1500-1600$ | $2050$ |
| **9. Xanh Lá** | `#44, #45, #47` | $380-400$ | $250$ | $40-45$ | $200-220$ | $600-650$ | $1350-1400$ | $1600-1700$ | $1900-2000$ | $2500$ |
| **10. Xanh Đậm** | `#49, #51` | $450-500$ | $300$ | $60-75$ | $250-300$ | $750-850$ | $1600-1800$ | $2000-2200$ | $2400-2700$ | $3500$ |

### Tiền thuê 6 Tuyến Giao Thông (`#6, #16, #21, #31, #37, #48`) và 3 Tiện Ích (`#11, #28, #43`)
* **Hệ thống 6 Bến/Ga/Cảng/Metro/Sân bay (Giá mua $200\text{K}$):**
  * Sở hữu 1 trạm: $25\text{K}$ | 2 trạm: $50\text{K}$ | 3 trạm: $100\text{K}$ | 4 trạm: $200\text{K}$ | 5 trạm: $350\text{K}$ | **Độc quyền cả 6 trạm: $600\text{K}$**.
  * **Đặc quyền Dịch chuyển Nhanh (Transit Teleport):** Nếu người chơi dừng chân tại một Trạm Giao Thông thuộc sở hữu của chính mình (hoặc trả $50\text{K}$ phí vé cho chủ trạm), ở đầu lượt kế tiếp họ có thể chọn **Di chuyển bằng tàu/máy bay thẳng tới bất kỳ Trạm Giao Thông nào khác** thay vì đổ xúc xắc.
* **Hệ thống 3 Tập Đoàn Tiện Ích (`Viettel 5G #11`, `EVN #28`, `SAWACO #43` - Giá mua $150\text{K}$):**
  * Sở hữu 1 công ty: $\text{Tổng điểm xúc xắc} \times 4\text{K}$.
  * Sở hữu 2 công ty: $\text{Tổng điểm xúc xắc} \times 10\text{K}$.
  * Sở hữu trọn 3 công ty: $\text{Tổng điểm xúc xắc} \times 20\text{K}$.

---

## 4. THIẾT KẾ LẠI BỐ CỤC GIAO DIỆN 3D CHO 6 NGƯỜI CHƠI (`UI/UX REDESIGN`)

Để hiển thị **52 ô đất** và **6 bảng thông tin người chơi** mà không làm chật màn hình:

### 4.1. Cấu hình Lưới CSS Grid $14 \times 14$ cho Bàn cờ 52 ô
* Kích thước tổng thể bàn cờ giữ ở mức `920x920px` (`scale: 0.84` ở chế độ 3D Isometric).
* Khai báo CSS Grid mới:
  ```css
  .monopoly-grid-6p {
    display: grid;
    grid-template-columns: 108px repeat(12, 1fr) 108px;
    grid-template-rows: 108px repeat(12, 1fr) 108px;
    gap: 2.5px;
  }
  .center-court-6p {
    grid-column: 2 / 14;
    grid-row: 2 / 14;
  }
  ```
* **Hàm ánh xạ tọa độ `(row, col)` cho 52 ô (`i = 0..51`):**
  ```javascript
  function getGridPosition52(i) {
    if (i >= 0 && i <= 13)  return { row: 14, col: 14 - i };           // Cạnh dưới (Phải -> Trái)
    if (i >= 14 && i <= 26) return { row: 14 - (i - 13), col: 1 };     // Cạnh trái (Dưới -> Trên)
    if (i >= 27 && i <= 39) return { row: 1, col: 1 + (i - 26) };      // Cạnh trên (Trái -> Phải)
    return { row: 1 + (i - 39), col: 14 };                             // Cạnh phải (Trên -> Dưới)
  }
  ```

### 4.2. Bố trí 6 Quân cờ 3D trong cùng 1 ô (6-Slot Token Matrix)
Khi tối đa 6 người chơi cùng đứng trên 1 ô (ví dụ ô Khởi Hành `#0` hoặc Nhà Tù `#13`), các quân cờ được xếp theo lưới $3 \times 2$ xung quanh rìa ô để không che tên địa danh:
* `P1`: Góc dưới trái (`left: 2px, bottom: 18px`)
* `P2`: Chính giữa dưới (`left: 50%, bottom: 18px`)
* `P3`: Góc dưới phải (`right: 2px, bottom: 18px`)
* `P4`: Góc trên trái (`left: 2px, top: 16px`)
* `P5`: Chính giữa trên (`left: 50%, top: 16px`)
* `P6`: Góc trên phải (`right: 2px, top: 16px`)

### 4.3. Bố cục HUD 6 Người chơi Siêu Gọn (`Compact 6-Player Sidebar`)
* Cột HUD bên trái (`w-52`) chuyển sang chế độ **Thẻ Mini (`py-1.5 px-2`)** để xếp vừa khít 6 người chơi theo chiều dọc mà không cần thanh cuộn.
* Mỗi thẻ chỉ hiển thị đúng 4 thông tin cốt lõi: **Avatar màu + Icon (`🐉`)**, **Tên người chơi**, **Tiền mặt (`2500K`)** và **Số lượng sổ đỏ (`🏠 4`)**. Người chơi đang tới lượt sẽ sáng viền vàng và phóng nhẹ `scale-[1.02]`.

---

## 5. KỊCH BẢN MỚI: CHẾ ĐỘ "LIÊN MINH ĐẦU TƯ 2v2v2" (TÙY CHỌN CHO 6 NGƯỜI)

Khi có đủ 6 người chơi, ngoài chế độ **Đấu Đơn Tự Do (Free-For-All 6P)**, chủ phòng có thể bật kịch bản **Đấu Đội Tập Đoàn (3 Liên Minh: 2 vs 2 vs 2)**:
1. **Chia làm 3 Liên minh (Mỗi đội 2 người ngồi chéo cánh nhau trên bàn cờ):**
   * **Liên minh Đỏ - Cam (`P1 + P5`):** Tập đoàn Phương Nam
   * **Liên minh Xanh Dương - Lam Ngọc (`P2 + P6`):** Tập đoàn Đại Dương
   * **Liên minh Xanh Lá - Tím (`P3 + P4`):** Tập đoàn Hoàng Gia
2. **Quyền lợi giữa 2 đồng đội:**
   * **Miễn 100% tiền thuê đất** khi đi vào ô đất của đồng đội.
   * **Gộp chung Bộ Màu Độc Quyền:** Nếu `P1` giữ 2 ô màu Đỏ (Măng Đen, Buôn Ma Thuột) và đồng đội `P5` mua được ô thứ 3 (Đà Lạt), cả hai lập tức được tính là **Độc quyền trọn bộ Đỏ** và có thể xây nhà ngay trên phần đất của mình!
   * **Cứu trợ Phá sản (Bailout):** Nếu 1 người lâm vào cảnh nợ nần vượt quá tiền mặt, người đồng đội được quyền chuyển khoản cứu trợ trực tiếp (tối đa 1 lần/ván) trước khi buộc phải bán nhà.