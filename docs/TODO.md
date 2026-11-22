# TODO

Việc còn lại, chia theo người làm. Làm xong mục nào thì xoá mục đó trong cùng PR.
Thiết kế đã chốt nằm ở `docs/design/` (đọc `README.md` và `DECISIONS.md` trước),
skill giao diện là `vankinh-ui`. Mỗi việc làm trên một nhánh riêng, mở PR vào `main`,
nhờ agent của người kia review và CI phải xanh.

Cập nhật: 2026-11-22.

## Người còn lại (Codex / Gemini)

### Khu giáo viên (`/teacher`)

Làm lại theo các board `Teacher*.dc.html`, trong khung `DashboardShell`
(`src/components/layout/`), dùng bộ component `@/components/ui`. Đã xong: Tổng quan
(`/teacher`), danh sách khoá (`/teacher/courses`) và trình sửa khoá 6 tab
(`/teacher/courses/:id/info|lessons|vocabulary|documents|students|pricing`). Còn chờ
API của các issue khác (đánh dấu `TODO(...)` trong code): mô tả ngắn, cấp độ,
"Bạn sẽ học được", ảnh bìa, thời lượng dạng số, phụ đề.

API Phần (chương) (#27, đã nối vào tab Bài giảng): `GET /courses/:id` trả `sections: [{ id, title, sortOrder, lessonIds }]`
theo thứ tự, `lessons[]` đã xếp theo Phần (bài chưa có Phần ở cuối), mỗi bài có `sectionId`;
khoá chưa có Phần thì `sections: []`. Chỉ giáo viên của khoá hoặc admin:
`POST /courses/:courseId/sections` `{ title }`, `PATCH /courses/:courseId/sections/:sectionId`
`{ title }`, `PATCH /courses/:courseId/sections/reorder` `{ orderedIds }` (đủ mọi Phần, mỗi Phần
một lần), `DELETE /courses/:courseId/sections/:sectionId` (bài vẫn giữ). Gán bài:
`PATCH /lessons/:id` `{ sectionId }` (`null` = bỏ khỏi Phần); `POST /lessons/youtube|upload` cũng
nhận `sectionId`. Tên Phần lưu không kèm số; giao diện tự thêm "Phần 1: ".

## Chủ dự án

- [ ] Đăng ký PayOS, lấy `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`
      (my.payos.vn). **Không commit key**; chỉ điền vào `server/.env`.
- [ ] Thử thanh toán thật một lần: `PAYMENT_GATEWAY=payos`, `yarn db:demo`, mua khoá
      "Giao tiếp du lịch Trung Quốc" giá 2.000 ₫. PayOS không có sandbox nên đây là
      tiền thật. Đây là bước xác nhận chữ ký với PayOS trước khi mở bán.
- [ ] Gửi nội dung thật cho `NEXT_PUBLIC_SUPPORT_CONTACT` (Zalo hoặc email hỗ trợ) và
      `NEXT_PUBLIC_REFUND_POLICY` (một câu chính sách hoàn tiền). Để trống thì hai dòng
      này bị ẩn trên trang mua và trang thanh toán.
- [ ] Khi deploy: chạy lần lượt các file trong `server/db/migrations/` trên DB có dữ liệu,
      đặt `PAYMENT_GATEWAY=payos` và 3 key, rồi đăng ký webhook
      `https://<api>/api/payments/webhook/payos` trong my.payos.vn.
- [ ] Đặt giá thật cho các khoá ở `/admin/courses` hoặc `/admin/prices` (giá trong seed và demo chỉ là giá thử).

## Claude

- [ ] Giai đoạn 4: quên mật khẩu qua email (thêm link "Quên mật khẩu?" vào `/login` và hai
      màn "Quên mật khẩu" / "Kiểm tra hộp thư" của `WebAuth`), lưu video trên Google Cloud Storage.

## Chưa giao

- [ ] Trang điều khoản sử dụng và chính sách bảo mật (nội dung do chủ dự án cung cấp), rồi
      thêm ô đồng ý vào form đăng ký như board `WebAuth`.
- [ ] Hệ thống đánh giá thật (học viên đã mua chấm 1–5 sao kèm nhận xét), khi học viên
      online đã đông. Xem `docs/design/DECISIONS.md`.
