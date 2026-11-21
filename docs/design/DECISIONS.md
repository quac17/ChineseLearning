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
  - Trình sửa khoá có 6 tab: Thông tin, Bài giảng, Từ vựng, Tài liệu, Học viên, Giá & bán.
- **Giá:** admin đặt giá. Giáo viên chỉ xem, không thấy doanh thu.
- **Admin:** thống kê, người dùng, khoá học (đặt giá), đơn hàng PayOS (tra cứu, cấp quyền thủ công).
- **Tiến độ học:** có trong thiết kế, cần thêm bảng ghi tiến độ ở backend.
- **Quên mật khẩu:** có trong thiết kế, cần backend gửi email.
- **Đánh giá và số học viên:**
  - Không hiển thị điểm sao nhập tay tuỳ ý như thể học viên đã chấm, vì đó là thông tin gây nhầm lẫn mà Luật Bảo vệ quyền lợi người tiêu dùng 2023 cấm.
  - Admin chỉ được nhập điểm khi **có nguồn thật** (ví dụ "khảo sát 120 học viên lớp offline 2025"), và nguồn đó hiện ngay cạnh số sao. Bỏ trống thì phần đánh giá bị ẩn.
  - Số học viên lấy từ số người được cấp quyền, cộng thêm số học viên offline nếu có ghi chú.
  - **Việc để lại:** khi học viên online đông lên, làm hệ thống đánh giá thật: học viên đã mua chấm 1–5 sao kèm nhận xét.
