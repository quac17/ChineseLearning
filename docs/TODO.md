# TODO

Việc còn lại, chia theo người làm. Làm xong mục nào thì xoá mục đó trong cùng PR.
Thiết kế đã chốt nằm ở `docs/design/` (đọc `README.md` và `DECISIONS.md` trước),
skill giao diện là `vankinh-ui`. Mỗi việc làm trên một nhánh riêng, mở PR vào `main`,
nhờ agent của người kia review và CI phải xanh.

Cập nhật: 2026-11-22.

## Người còn lại (Codex / Gemini)

### Khu giáo viên (`/teacher`)

Làm lại theo các board `Teacher*.dc.html`, trong khung `DashboardShell`
(`src/components/layout/`), dùng bộ component `@/components/ui`. Trang
`app/teacher/page.tsx` hiện vẫn là giao diện cũ.

- [ ] Tổng quan giáo viên (`TeacherOverview`).
- [ ] Danh sách khoá học của giáo viên (`TeacherCourses`).
- [ ] Trình sửa khoá học, 6 tab:
  - [ ] Thông tin (`TeacherCourseInfo`).
  - [ ] Bài giảng: thêm YouTube, tải video, sắp xếp (`TeacherLessons`).
  - [ ] Từ vựng (`TeacherVocab`). **Chờ API từ vựng** của giai đoạn 2 (Claude làm);
        dựng giao diện trước được, nối API sau.
  - [ ] Tài liệu (`TeacherDocs`).
  - [ ] Học viên: cấp và thu hồi quyền (`TeacherStudents`).
  - [ ] Giá & bán: **chỉ xem**, đọc `priceVnd` của khoá. Giáo viên không đặt giá
        và không thấy doanh thu.
- [ ] Thêm mục menu khu giáo viên (mảng `nav` của nhánh `/teacher`) trong
      `src/components/layout/AppChrome.tsx`.

### Khu admin (`/admin`)

Làm lại theo các board `Admin*.dc.html`. **Không làm lại** hai trang đã có
(PR #7): `/admin/prices` (Giá khoá học) và `/admin/orders` (Đơn hàng).

- [ ] Thống kê (`AdminStats`), thay cho `app/admin/page.tsx` cũ.
- [ ] Người dùng: tạo, đổi vai trò, khoá/mở tài khoản (`AdminUsers`).
- [ ] Khoá học (`AdminCourses`). Có thể gộp trang Giá khoá học vào đây sau;
      giữ nguyên API `PATCH /courses/:id/price`.
- [ ] Thêm mục menu vào `ADMIN_NAV` trong `AppChrome.tsx` (có sau khi PR #7 merge).

### Kiểm tra

- [ ] Viết e2e cho các trang mới (skill `e2e-playwright`): giáo viên cấp quyền,
      admin khoá tài khoản qua giao diện.

## Chủ dự án

- [ ] Đăng ký PayOS, lấy `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`
      (my.payos.vn). **Không commit key**; chỉ điền vào `server/.env`.
- [ ] Thử thanh toán thật một lần: `PAYMENT_GATEWAY=payos`, `yarn db:demo`, mua khoá
      "Giao tiếp du lịch Trung Quốc" giá 2.000 ₫. PayOS không có sandbox nên đây là
      tiền thật. Đây là bước xác nhận chữ ký với PayOS trước khi mở bán.
- [ ] Gửi nội dung thật cho `NEXT_PUBLIC_SUPPORT_CONTACT` (Zalo hoặc email hỗ trợ) và
      `NEXT_PUBLIC_REFUND_POLICY` (một câu chính sách hoàn tiền). Để trống thì hai dòng
      này bị ẩn trên trang mua và trang thanh toán.
- [ ] Khi deploy: chạy `server/db/migrations/20261122_1200_payments.sql` trên DB có dữ liệu,
      đặt `PAYMENT_GATEWAY=payos` và 3 key, rồi đăng ký webhook
      `https://<api>/api/payments/webhook/payos` trong my.payos.vn.
- [ ] Đặt giá thật cho các khoá ở `/admin/prices` (giá trong seed và demo chỉ là giá thử).

## Claude

- [ ] Giai đoạn 2: tiến độ học (ô đã học, "Học tiếp", thanh tiến độ) và từ vựng theo
      bài (API cho tab Từ vựng của giáo viên; tab Từ vựng trong trình phát; flashcard,
      quiz, luyện viết sinh từ từ vựng của bài).
- [ ] Giai đoạn 4: quên mật khẩu qua email, lưu video trên Google Cloud Storage.

## Chưa giao

- [ ] Làm lại trang chủ (`WebHome`), đăng nhập và đăng ký (`WebAuth`) theo thiết kế.
      Hiện vẫn là giao diện cũ, còn chữ "Đang tải…" thay cho skeleton.
- [ ] Footer vẫn hiện "Đăng nhập / Tạo tài khoản" khi đã đăng nhập
      (`src/components/layout/SiteFooter.tsx`).
- [ ] Hệ thống đánh giá thật (học viên đã mua chấm 1–5 sao kèm nhận xét), khi học viên
      online đã đông. Xem `docs/design/DECISIONS.md`.
