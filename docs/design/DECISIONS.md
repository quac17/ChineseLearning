# Quyết định thiết kế

Ghi theo ngày. Mỗi mục: đã chốt gì, vì sao, còn để lại việc gì.

## 2026-11-21 · Thiết kế toàn bộ màn hình còn lại trước khi code

- **Phạm vi:** thiết kế mọi màn hình trước khi triển khai code.
  - Học viên: web và app.
  - Giáo viên, admin: chỉ web.
  - Thêm một trang canvas cho các trạng thái chung.
- **Khu giáo viên và admin:** bố cục bảng điều khiển (menu trái, bảng dữ liệu), dùng chung token với phần học viên.
- **Trạng thái mục tiêu:** vẽ như khi đã có giá và PayOS. Ô cần thêm dữ liệu ở backend gắn nhãn **Cần backend**.
- **Không có giỏ hàng:** mỗi lần mua một khoá bằng mã QR PayOS.
- **Từ vựng gắn với bài học:** giáo viên nhập chữ Hán, pinyin, nghĩa và câu ví dụ cho từng bài. Flashcard, quiz và luyện viết sinh từ đó. Phát âm dùng giọng đọc tiếng Trung của trình duyệt.
- **Khu giáo viên:**
  - Menu trái gồm Tổng quan và Khoá học.
  - Trình sửa khoá có 7 tab: Thông tin, Bài giảng, Từ vựng, Tài liệu, Học viên, Đánh giá, Giá & bán.
- **Giá:** admin đặt giá. Giáo viên chỉ xem, không thấy doanh thu.
- **Admin:** thống kê, người dùng, khoá học (đặt giá), đơn hàng PayOS (tra cứu, cấp quyền thủ công).
- **Tiến độ học:** có trong thiết kế, cần thêm bảng ghi tiến độ ở backend.
- **Quên mật khẩu:** có trong thiết kế, cần backend gửi email.
- **Đánh giá và số học viên:**
  - Không hiển thị điểm sao nhập tay tuỳ ý như thể học viên đã chấm, vì đó là thông tin gây nhầm lẫn mà Luật Bảo vệ quyền lợi người tiêu dùng 2023 cấm.
  - Admin chỉ được nhập điểm khi **có nguồn thật** (ví dụ "khảo sát 120 học viên lớp offline 2025"), và nguồn đó hiện ngay cạnh số sao. Bỏ trống thì phần đánh giá bị ẩn.
  - Số học viên lấy từ số người được cấp quyền, cộng thêm số học viên offline nếu có ghi chú.
- **Đánh giá thật của học viên (#41):**
  - Ai được đánh giá: tài khoản **Học sinh** đang có quyền xem (`can_view`) một khoá **trả phí**. Không tính khoá miễn phí; giáo viên và admin không tự chấm. Không bắt buộc đã xem bài nào, vì bài YouTube chỉ ghi tiến độ khi học viên tự tích, nếu bắt buộc thì người đã mua thật có thể bị chặn.
  - Mỗi học viên một đánh giá cho mỗi khoá: 1–5 sao, nhận xét không bắt buộc (tối đa 1.000 ký tự), sửa được khi còn quyền xem. Mất quyền (thu hồi, hoàn tiền) thì đánh giá vẫn giữ và vẫn tính, vì nó nói về một lần mua thật; người viết chỉ còn xoá được.
  - Giáo viên phụ trách khoá (hoặc admin) trả lời một lần dưới mỗi đánh giá, sửa hoặc xoá được câu trả lời.
  - Chỉ admin ẩn đánh giá, bắt buộc ghi lý do (5–300 ký tự). Chỉ ẩn nội dung vi phạm (xúc phạm, quảng cáo, thông tin cá nhân), **không ẩn vì điểm thấp**. Đánh giá bị ẩn không hiện công khai và không tính vào điểm trung bình; người viết vẫn thấy đánh giá của mình kèm lý do.
  - Điểm trung bình chỉ hiện khi có **từ 3 đánh giá đang hiện** (`REVIEWS_MIN_TO_SHOW`); dưới mức đó API trả `average: null`, trang khoá chỉ ghi số đánh giá. Danh sách đánh giá vẫn hiện từ đánh giá đầu tiên.
  - Điểm khảo sát có nguồn và điểm của học viên online là **hai số riêng**, không cộng gộp: điểm khảo sát luôn kèm nguồn, điểm thật ghi "N đánh giá của học viên".
  - Tên người viết hiện rút gọn công khai ("Nguyễn Văn An" → "N. V. An"); giáo viên và admin thấy tên đầy đủ.
