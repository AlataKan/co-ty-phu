# TÀI LIỆU THIẾT KẾ GIAO DIỆN 3D DIORAMA & TRẢI NGHIỆM THỊ GIÁC (UI/UX DESIGN SPEC)

Tài liệu này quy định kiến trúc hiển thị **Bàn cờ 3D Góc Nghiêng (3D Isometric / Tilt Diorama)**, bố cục **HUD Thu gọn (Compact HUD)**, hệ thống **Quân cờ & Xúc xắc Chấm tròn 3D**, cùng luồng **Event Popup Tương tác Tự động** cho dự án Web Game **Cờ Tỷ Phú Việt Nam**.

---

## 1. BỐ CỤC TỔNG THỂ & GÓC NGHIÊNG 3D (3D SCENE & COMPACT HUD LAYOUT)

Để tránh cảm giác rối mắt khi có quá nhiều thông tin trên màn hình, giao diện áp dụng nguyên tắc **Ưu tiên không gian cho Sa bàn 3D trung tâm** và thu gọn tối đa các bảng điều khiển 2 bên:

* **Khung phối cảnh 3D (`Scene Viewport`):** Đặt `perspective: 1550px` kết hợp bàn cờ kích thước chuẩn `860x860px` (`scale: 0.88`), có đế dày 3D `22px` đổ bóng sâu xuống mặt bàn tối màu.
* **3 Chế độ Góc nhìn Camera (`Camera Presets`):** Người chơi chuyển đổi tức thì trên thanh Header:
  1. **📐 3D Nghiêng (`Isometric` - Mặc định):** `rotateX(48deg) rotateZ(-28deg)` – Góc nhìn chéo tạo chiều sâu không gian rõ nhất cho các khối nhà và quân cờ.
  2. **🎥 Chính Diện (`Tilt`):** `rotateX(42deg) rotateZ(0deg)` – Góc nhìn nghiêng chính diện từ cạnh dưới lên.
  3. **🗺️ Phẳng 2D (`Top-down`):** `rotateX(0deg) rotateZ(0deg)` – Góc nhìn thẳng 2D truyền thống.
* **Thu gọn 2 cột HUD Trái & Phải (Giảm tải thị giác):**
  * **Cột Trái (`w-52` / `208px`):** Chứa danh sách 4 thẻ người chơi siêu gọn (chỉ hiển thị Icon, Tên, Vị trí ô `#00`, Tiền mặt `K` và số lượng Sổ đỏ) + Hộp điều khiển lượt đi ở góc dưới trái với nút chính **`🎲 ĐỔ XÚC XẮC`**.
  * **Cột Phải (`w-56` / `224px`):** Chứa **Thẻ Sổ Đỏ Chi Tiết** (chỉ hiển thị thông tin của 1 ô đang chọn) và khung **Nhật Ký Ván Đấu** cao `128px` (`h-32`) tự động cuộn.

---

## 2. PHÂN CẤP THÔNG TIN & ĐỘ DỄ ĐỌC (INFORMATION HIERARCHY & LEGIBILITY)

### 2.1. 3 Cấp độ ưu tiên thông tin trên Ô Bàn Cờ
1. **Cấp 1 – Thông tin Quyết định Tức thì (Nhìn thấy ngay từ xa):**
   * **Màu nhóm đất + Hộp Giá Mua / Tiền Thuê Hiện Tại (`tile-price-pill`)** sử dụng phông chữ `JetBrains Mono ExtraBold` cỡ `8.5px` trên nền tối tương phản cao.
   * **Cơ chế chuyển đổi nhãn thông minh:**
     * Khi ô đất **chưa có chủ**: Hiển thị **Giá Mua** (VD: `400K` trên nền đen mờ `#0F172A`).
     * Khi ô đất **đã có chủ**: Tự động chuyển sang hiển thị **Tiền Thuê Hiện Tại** (VD: `⚡200K` trên nền đỏ `#DC2626`, chữ vàng `#FEF08A` kèm hiệu ứng nhịp thở `pulseRent`) giúp người chơi nhận biết ngay mức độ nguy hiểm mà không cần bấm vào từng ô.
2. **Cấp 2 – Nhận diện Địa danh & Trạng thái sở hữu:**
   * Tên địa danh viết hoa ngắn gọn (`8.5px`, `font-weight: 800`), luôn xoay hướng thuận chiều mắt người đọc ở cả 4 cạnh bàn cờ.
   * Chấm tròn màu chủ sở hữu (`owner-marker` kích thước `11x11px`) gắn nổi ở góc phải dải màu kèm các mô hình Nhà phố/Khách sạn 3D.
3. **Cấp 3 – Chi tiết bảng kê (Chỉ hiện ở Cột Phải khi Click chọn ô):**
   * Toàn bộ bảng giá thuê từ Đất trống, Độc quyền nhóm màu ($\times 2$), 1–4 Nhà phố đến Khách sạn 5 sao, giá xây dựng và giá cầm cố được tách riêng sang **Thẻ Sổ Đỏ (`Property Inspector`)** ở cột phải.

### 2.2. Hệ thống Biểu tượng Chuẩn hóa (Standardized Iconography)
Sử dụng bộ ký hiệu đồng nhất trên thanh Header, mặt bàn cờ, Sổ đỏ và Event Popup để thay thế câu chữ dài dòng:

| Biểu Tượng | Ý Nghĩa Duy Nhất Xuyên Suốt Game | Màu Sắc Định Danh | Ví Dụ Hiển Thị |
| :---: | :--- | :--- | :--- |
| **`K`** | Đơn vị tiền tệ (Nghìn VNĐ) | Vàng Kim (`#FACC15`) | `2000K`, `-400K` |
| **`⚡`** | Tiền thuê bắt buộc phải trả khi dừng chân | Đỏ Cam (`#F43F5E`) | `⚡150K` |
| **`🏠`** | Tài sản Nhà phố 3D (Tối đa 4 căn/ô) | Xanh Ngọc (`#10B981`) | `🏠 2 Nhà phố` |
| **`🏨`** | Tài sản Khách sạn 5 sao 3D (Cấp 5 tối đa) | Đỏ Ruby (`#E11D48`) | `🏨 Khách sạn` |
| **`👑`** | Độc quyền trọn bộ màu (Nhân đôi tiền thuê đất trống) | Tím (`#C084FC`) | `👑 Độc quyền (x2)` |
| **`🔒`** | Trạng thái Cầm cố / Thế chấp ngân hàng | Xám (`#94A3B8`) | `🔒 Cầm: 200K` |

---

## 3. PHÂN VÙNG Ô ĐẤT 3 KHE & HỆ THỐNG TÀI SẢN 3D

Mỗi ô đất trên lưới $11 \times 11$ được chia làm 3 vùng không gian tách biệt để **Quân cờ và Nhà 3D không bao giờ che mất tên địa danh**:

1. **Khe 1 – Dải màu & Khe cắm Tài sản 3D (`color-roof` - Cao `17px`):**
   * Hiển thị màu đặc trưng của 8 nhóm địa danh Việt Nam.
   * **Nhà phố 3D (`asset-3d-house`):** Khối vuông `9x9px` màu xanh ngọc (`#34D399` $\rightarrow$ `#059669`), nhô cao `translateZ(9px) rotateX(-25deg)` với hiệu ứng mọc nảy lò xo (`popAsset`).
   * **Khách sạn 3D (`asset-3d-hotel`):** Khối chữ nhật `20x12px` màu đỏ ruby viền vàng (`#E11D48`), nhô cao `translateZ(14px)` kèm biểu tượng `🏨` ở trung tâm.
2. **Khe 2 – Vùng Tên Địa Danh An Toàn (`tile-title`):**
   * Nằm chính giữa ô, nền sáng `#F8FAFC`, chữ đậm `#0F172A`, đảm bảo độ tương phản cao nhất dưới mọi góc nghiêng.
3. **Khe 3 – Hộp Giá Tiền / Tiền Thuê (`tile-price-pill`):**
   * Đặt sát cạnh đáy ô và nổi nhẹ ở `translateZ(3px)`.

---

## 4. THIẾT KẾ QUÂN CỜ 3D NỔI BẬT & XÚC XẮC DẤU CHẤM TRÒN (PIPS)

### 4.1. Quân cờ 3D (`player-token-3d`)
Để người chơi luôn xác định được vị trí của mình và đối thủ ngay lập tức trên bàn cờ nhiều màu sắc:
* **Kích thước & Độ nổi:** Quân cờ có đường kính `34px` (khi tới lượt phóng lớn lên `38px`), luôn dựng thẳng hướng về phía Camera (`Billboard Transform`: `translateZ(30px) rotateZ(calc(-1 * var(--rotate-z))) rotateX(calc(-1 * var(--tilt-angle)))`).
* **Nhận diện 4 Người chơi:**
  * **P1 (`#E11D48` - Đỏ Ruby):** Biểu tượng Rồng `🐉` + Nhãn chân đế `P1`.
  * **P2 (`#2563EB` - Xanh Dương):** Biểu tượng Vương miện `👑` + Nhãn chân đế `P2`.
  * **P3 (`#059669` - Xanh Ngọc):** Biểu tượng Tên lửa `🚀` + Nhãn chân đế `P3`.
  * **P4 (`#9333EA` - Tím Hoàng Gia):** Biểu tượng Kim cương `💎` + Nhãn chân đế `P4`.
* **Hiệu ứng Quân cờ Đang tới lượt (`active-turn-token`):**
  * Viền vàng rực (`#FDE047`), tỏa hào quang `box-shadow: 0 0 18px #FACC15`, bay nhấp nhô liên tục (`activeTokenFloat`) và có **mũi tên vàng `▼` nhấp nháy trên đỉnh đầu**.
* **Định vị 4 Góc chống đè nhau:** Nếu nhiều người chơi đứng cùng 1 ô, 4 quân cờ tự động tách ra 4 góc (`left/right`, `top/bottom`) của ô đó.

### 4.2. Xúc xắc Khối 3D & Xúc xắc Mini bằng Dấu Chấm Tròn (`3x3 Pip Grid`)
Toàn bộ xúc xắc trong game không dùng chữ số khô khan mà được dựng bằng **Lưới $3 \times 3$ chấm tròn (`Pips`) truyền thống của Á Đông**:
* **Quy ước màu chấm:**
  * **Mặt 1 chấm và Mặt 4 chấm:** Sơn **Màu Đỏ (`#E11D48`)** nổi bật; riêng chấm của mặt Số 1 có kích thước lớn hơn (`13px` trên xúc xắc 3D và `7px` trên xúc xắc mini).
  * **Mặt 2, 3, 5, 6 chấm:** Sơn **Màu Đen Đậm (`#0F172A`)** trên nền trắng ngà.
* **Đồng bộ 3 vị trí hiển thị:**
  1. Hai viên xúc xắc khối 3D (`52x52px`) lăn xoay ở chính giữa sân bàn cờ.
  2. Cặp xúc xắc chấm tròn mini (`26x26px`) ở hộp điều khiển góc dưới bên trái kèm tổng điểm (`=7`).
  3. Cặp xúc xắc chấm tròn mini đính kèm trên thanh tiêu đề của **Event Popup** để người chơi đối chiếu kết quả vừa tung.

---

## 5. HỆ THỐNG EVENT POPUP TƯƠNG TÁC TỰ ĐỘNG SAU KHI ĐỔ XÚC XẮC

Ngay sau khi người chơi bấm nút **`🎲 ĐỔ XÚC XẮC`** và quân cờ hoàn tất hiệu ứng nhảy từng bước (`hopping`) đến ô đích, hệ thống tự động bật **Modal Sự Kiện (`#event-popup-modal`)** ở chính giữa màn hình để xử lý quyết định trong lượt:

1. **Khi dừng tại Ô Đất Trống chưa có chủ (`ĐẤT TRỐNG CHƯA CÓ CHỦ`):**
   * Thanh tiêu đề đổi theo màu nhóm đất; hiển thị rõ **Giá mua**, **Tiền thuê cơ bản**, và **Số dư còn lại sau khi mua**.
   * Cung cấp 2 nút quyết định rõ ràng: **`🏠 Mua Ngay (-GiáK)`** (khóa tự động nếu không đủ tiền) hoặc **`Bỏ Qua Lượt`**.
2. **Khi dừng tại Ô Đất của người chơi khác (`ĐẤT ĐÃ CÓ CHỦ SỞ HỮU`):**
   * Thanh tiêu đề cảnh báo màu đỏ (`#DC2626`); hiển thị tên & màu của Chủ đất, cấp độ công trình hiện tại (`🏠` hoặc `🏨`), và số tiền thuê bị trừ (`-RentK`).
   * Người chơi bấm **`⚡ Xác Nhận Trả Thuê`** để hoàn tất chuyển tiền và tạo hiệu ứng tiền bay lên (`floating-money`).
3. **Khi dừng tại Ô Đất của chính mình (`BẤT ĐỘNG SẢN CỦA BẠN`):**
   * Thanh tiêu đề màu xanh lam (`#0284C7`); cho phép chủ đất bấm **`🏗️ Nâng Cấp (-BuildCostK)`** để dựng thêm Nhà phố/Khách sạn 3D ngay trong lượt hoặc chọn **`Hoàn Tất Lượt`**.
4. **Khi dừng tại Ô Cơ Hội (`❓`) hoặc Khí Vận (`🧧`):**
   * Tự động rút ngẫu nhiên 1 thẻ bài trong bộ thẻ Việt Nam, hiển thị con số thưởng/phạt cực lớn ở trung tâm (`+200K`, `-50K`, hoặc `VÀO TÙ!`) và nút **`✨ Nhận Hiệu Ứng Thẻ`**.
5. **Khi dừng tại Ô Thuế, Vào Tù hoặc Ô An Toàn (Khởi Hành, Phố Đi Bộ, Thăm Tù):**
   * Hiển thị thông báo tương ứng (`💸 Nộp Thuế`, `🚓 Chấp Hành Vào Ô #10`, hoặc `✅ Tiếp Tục Lượt Kế`) để khép kín vòng lặp lượt chơi mượt mà.