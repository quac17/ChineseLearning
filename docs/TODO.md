# TODO

Danh sách việc nằm trên GitHub, không chép lại ở đây:
**[#42 Hoàn thiện app Vân Kính](https://github.com/quac17/ChineseLearning/issues/42)**
là issue tổng, liệt kê mọi issue con và thứ tự làm. Cách dùng `gh` với issue:
`docs/agents/issue-tracker.md`.

Mỗi việc làm trên một nhánh riêng, mở PR vào `main` có dòng `Closes #<số>`, nhờ agent
của người kia review và CI phải xanh. Thiết kế đã chốt nằm ở `docs/design/` (đọc
`README.md` và `DECISIONS.md` trước), skill giao diện là `vankinh-ui`.

Cập nhật: 2026-11-22.

## Đang mở

| Ai làm | Issue | Chờ |
|---|---|---|
| Chủ dự án | [#14](https://github.com/quac17/ChineseLearning/issues/14) Mở bán thật với PayOS: key, giao dịch thử 2.000 ₫, webhook, giá thật | |
| Chủ dự án | [#15](https://github.com/quac17/ChineseLearning/issues/15) Duyệt và điền bản nháp Điều khoản sử dụng, Chính sách bảo mật (`user-client/src/content/legal/`) rồi đặt `draft: false` | |
| Chủ dự án | [#16](https://github.com/quac17/ChineseLearning/issues/16) Chọn dịch vụ gửi email và chuẩn bị Google Cloud Storage | |
| Chủ dự án + Claude | [#17](https://github.com/quac17/ChineseLearning/issues/17) Triển khai production lên GCP | #14 |

Bảng này chỉ để nhìn nhanh; khi lệch với GitHub thì GitHub đúng. Đóng hoặc mở issue
mới thì sửa bảng trong cùng PR.

## Lưu ý khi lên production

- Tài khoản `admin@vankinh.vn` được seed với mật khẩu ghi công khai trong README:
  **đổi mật khẩu ngay sau lần nạp dữ liệu đầu tiên**.
- DB đã có dữ liệu thì không reset: chạy lần lượt các file trong `server/db/migrations/`.
- Không bao giờ commit key PayOS hay key GCP; chỉ điền vào `server/.env`.
