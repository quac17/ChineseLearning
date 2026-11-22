# Logo Chinese Learner · Hướng dẫn sử dụng

Logo gồm **ấn tròn màu son** và chữ **Chinese Learner** (Be Vietnam Pro ExtraBold, đã chuyển thành đường nét nên không phụ thuộc font của máy).

Trong ấn là **một lối mòn uốn qua dãy núi, dẫn tới đám mây**, nhìn chính diện: đó là 云径, “lối mây”. Nhìn xa, lối mòn thành thân cây và đám mây thành tán lá: một **cây tri thức** lớn dần theo từng bước học. Lối mòn cố ý chạm mép dưới của ấn, như con đường đang đi về phía người xem.

File nằm ở [`user-client/public/brand/`](../../user-client/public/brand/), trên web gọi bằng đường dẫn `/brand/<tên file>`.

## Các file

| Bố cục | Dùng khi | File (`<màu>` = `full`, `reversed`, `mono-dark`, `mono-light`) |
|---|---|---|
| Ngang | Header web, email, hoá đơn | `chinese-learner-logo-horizontal-<màu>.svg` |
| Ngang kèm dòng phụ | Trang đăng nhập, footer, slide | `chinese-learner-logo-horizontal-tagline-<màu>.svg` |
| Dọc | Màn hình khởi động app, ảnh đại diện mạng xã hội | `chinese-learner-logo-vertical-<màu>.svg` |
| Chỉ ấn | Chỗ hẹp, watermark trên video | `chinese-learner-icon-<màu>.svg` |
| Chỉ chữ | Khi ấn đã xuất hiện gần đó | `chinese-learner-wordmark-full.svg`, `chinese-learner-wordmark-reversed.svg` |
| Favicon | Tab trình duyệt (nét rút gọn cho cỡ 16–32px) | `favicon.svg`, `favicon-32.png` |
| Icon app | iOS / Android / PWA | `app-icon.svg`, `app-icon-1024.png`, `icon-512.png`, `icon-192.png`, `apple-touch-icon.png` (180) |
| Icon maskable | Android adaptive icon, PWA `purpose: "maskable"` | `app-icon-maskable.svg`, `icon-maskable-512.png` |

## Màu

| Biến thể | Ấn | Núi | Lối mòn và mây | Chữ “Chinese Learner” | Dùng trên |
|---|---|---|---|---|---|
| `full` | `#C2321C` | `#9E2715` | trắng | `#1C1D1F` | nền trắng, nền sáng |
| `reversed` | `#E0553E` | `#B8402C` | trắng | trắng | nền tối (`#1C1D1F`, ảnh tối) |
| `mono-dark` | `#1C1D1F` | không có | đục rỗng | `#1C1D1F` | in một màu, đóng dấu, khắc |
| `mono-light` | trắng | không có | đục rỗng | trắng | in trắng lên nền màu, ảnh |

Chỉ dùng màu phẳng: không gradient, không bóng đổ, không viền phát sáng.

## Khoảng trống và cỡ tối thiểu

- Khoảng trống quanh logo tối thiểu bằng **1/4 đường kính ấn**. Không đặt chữ, ảnh hay mép màn hình trong vùng này.
- Logo ngang: cao tối thiểu **24px** trên màn hình, **8mm** khi in.
- Ấn đứng riêng: tối thiểu **20px**. Dưới 32px dùng `favicon.svg` (bỏ dãy núi, lối mòn và mây to hơn).

## Không được

- Kéo giãn, xoay, nghiêng logo.
- Đổi màu ấn ngoài bảng trên, lật ngược hướng lối mòn, hoặc thêm chi tiết vào cảnh trong ấn.
- Gõ lại chữ “Chinese Learner” bằng font khác, hoặc đổi khoảng cách giữa ấn và chữ.
- Đặt logo màu `full` lên ảnh rối. Hãy dùng `mono-light` trên một mảng tối.
- Thêm hiệu ứng: bóng, viền, gradient, 3D.

## Dùng trong code (Next.js)

```tsx
// Header
<img src="/brand/chinese-learner-logo-horizontal-full.svg" alt="Chinese Learner" height={36} />

// Trên nền tối
<img src="/brand/chinese-learner-logo-horizontal-reversed.svg" alt="Chinese Learner" height={36} />
```

Favicon cho App Router: sao chép `favicon.svg` thành `user-client/src/app/icon.svg` và `apple-touch-icon.png` thành `user-client/src/app/apple-icon.png`. Next.js sẽ tự gắn thẻ `<link>`.

## Sinh lại file

Toàn bộ file trong `user-client/public/brand/` được sinh bằng [`scripts/brand/build_brand.py`](../../scripts/brand/build_brand.py). Không sửa tay các file SVG; muốn đổi nét hoặc màu thì sửa script rồi chạy lại.

```bash
# 1. Tải font (giấy phép SIL OFL 1.1) vào một thư mục riêng
mkdir -p /tmp/chinese-learner-fonts && cd /tmp/chinese-learner-fonts
curl -sSLO https://github.com/google/fonts/raw/main/ofl/bevietnampro/BeVietnamPro-ExtraBold.ttf
curl -sSLO https://github.com/google/fonts/raw/main/ofl/bevietnampro/BeVietnamPro-Medium.ttf
```

```bash
# 2. Sinh SVG (chạy ở thư mục gốc repo)
uv run --with fonttools python scripts/brand/build_brand.py /tmp/chinese-learner-fonts user-client/public/brand
```

Các file PNG được xuất từ SVG bằng Chrome headless. Mọi trình chuyển SVG sang PNG khác (Inkscape, `rsvg-convert`) cũng dùng được.

Font Be Vietnam Pro: © 2021 The Be Vietnam Pro Project Authors, giấy phép SIL Open Font License 1.1. OFL cho phép chuyển chữ thành đường nét để dùng trong logo.
