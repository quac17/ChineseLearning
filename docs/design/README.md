# Thiết kế giao diện Vân Kính (đã chốt 21/11/2026)

Bản gốc là canvas thiết kế (kiểu Figma) trên claude.ai: **[Vân Kính – Redesign UI](https://claude.ai/artifact/1c3F1nP6576TYKgy3F6kbZ)**. Canvas đang để riêng tư; muốn người khác xem, chủ canvas mở menu **Share** trên trang để chia sẻ. Từ menu Share › Export có thể xuất PDF hoặc gửi sang công cụ khác.

Thư mục [`canvas/`](canvas/) là bản sao mã nguồn các bảng, để đọc và để AI dựng lại giao diện thật:

| File | Nội dung |
|---|---|
| `Main.dc.html` | Hệ thống thiết kế: màu, chữ, nút, ô nhập, dropdown, radio, checkbox, công tắc, tab, nhãn, đánh giá, tiến độ, thông báo, thẻ khoá học |
| `LogoRoad.dc.html` | Logo đã chốt và các biến thể |
| `WebHome.dc.html` | Web: trang chủ |
| `WebCourse.dc.html` | Web: chi tiết khoá học |
| `WebPlayer.dc.html` | Web: trình phát bài giảng |
| `AppHome.dc.html`, `AppCourse.dc.html`, `AppPlayer.dc.html` | App: Nổi bật, chi tiết khoá học, xem bài giảng |
| `canvas.json` | Vị trí các bảng trên canvas |

Các file `.dc.html` cần trình chỉnh sửa canvas mới hiển thị đúng; mở trực tiếp bằng trình duyệt sẽ thiếu `support.js`. Ảnh trong bản sao trỏ về [`user-client/public/images/stock/`](../../user-client/public/images/stock/).

## Những gì đã chốt

- **Hướng:** chợ khoá học (học theo cấu trúc Udemy, không dùng nhận diện của Udemy). Nền trắng, chữ `#1C1D1F`, viền `#D1D7DC`, khối phụ `#F7F9FA`.
- **Màu nhấn:** son `#C2321C` (hover `#9E2715`) chỉ cho nút mua / thêm giỏ. Nút đen cho đăng ký, đăng nhập. Nút viền cho hành động phụ.
- **Màu chương trình** (ảnh bìa, nhãn): Easy Steps `#4E8A2E`, YCT `#C46A12`, HSK `#1F4FA0`, Giao tiếp `#1E6E5C`.
- **Chữ:** Be Vietnam Pro (tiêu đề 700–800), Noto Serif SC cho chữ Hán.
- **Bo góc** 4px. App có 5 tab: Nổi bật, Tìm kiếm, Khoá của tôi, Ôn tập, Tài khoản.
- **Logo:** ấn tròn, lối uốn qua núi lên mây. Xem [`docs/brand/BRAND.md`](../brand/BRAND.md).

Quy tắc chi tiết để code theo: skill [`vankinh-ui`](../../.agents/skills/vankinh-ui/SKILL.md).

## Còn thiếu trước khi ra mắt

- Giá, số bài, thời lượng, tên và ảnh giáo viên, điểm đánh giá (đang là `[GIÁ]`, `[n]`…). Không bịa số đánh giá hay học viên.
- Ảnh bìa từng khoá và khung xem trước video: lấy từ chính video bài giảng.
- Chính sách hoàn tiền, thời hạn xem, kênh hỗ trợ.
