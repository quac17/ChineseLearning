# Hướng dẫn Public Web chạy trên Local lên Internet – Chinese Learner

Tài liệu này hướng dẫn cách đưa hệ thống **Chinese Learner** đang chạy ở máy cá nhân (`user-client` cổng `3000` + `server` cổng `4000`) ra Internet có **HTTPS** để gửi link cho người khác xem demo, test trên điện thoại, hoặc nhận **Webhook PayOS** trực tiếp về máy local.

---

## Nguyên tắc quan trọng trước khi Public

Trong dự án này, trình duyệt người dùng gọi API trực tiếp tới `NEXT_PUBLIC_API_URL` (mặc định ở local là `http://localhost:4000/api`).

- Nếu bạn **chỉ public cổng `3000`** (`user-client`), người khác mở link trên máy họ thì trình duyệt của họ sẽ gọi `http://localhost:4000/api` trên chính máy họ → **lỗi không kết nối được Backend**.
- Vì vậy, cần public **cả Frontend (`3000`) lẫn Backend (`4000`)** ra HTTPS, và cập nhật đúng biến môi trường (`NEXT_PUBLIC_API_URL`, `CORS_ORIGIN`, `APP_URL`, `COOKIE_SECURE`, `COOKIE_SAME_SITE`).

---

## Cách 1: Dùng Cloudflare Tunnel (`cloudflared`) — Khuyến nghị (Miễn phí, HTTPS sẵn, không màn hình chặn)

`cloudflared` miễn phí, không giới hạn băng thông video và không hiện trang cảnh báo trung gian như ngrok free (tránh làm hỏng request API/video).

### Bước 1: Cài đặt `cloudflared`
- **Windows (PowerShell / Winget):**
  ```powershell
  winget install --id Cloudflare.cloudflared
  ```
- **macOS:**
  ```bash
  brew install cloudflared
  ```

---

### Phương án A: Chạy nhanh 2 Quick Tunnel (không cần tài khoản, xong trong 1 phút)

Phù hợp khi cần demo nhanh trong ngày (URL thay đổi mỗi lần tắt mở lại).

#### 1. Khởi động Database & giữ terminal sẵn sàng
```bash
yarn db:up
```

#### 2. Mở 2 tunnel ở 2 terminal riêng để lấy URL HTTPS
- **Terminal 1 (Public Backend `:4000`):**
  ```bash
  cloudflared tunnel --url http://localhost:4000
  ```
  Copy URL được cấp, ví dụ: `https://api-demo-abc.trycloudflare.com`

- **Terminal 2 (Public Frontend `:3000`):**
  ```bash
  cloudflared tunnel --url http://localhost:3000
  ```
  Copy URL được cấp, ví dụ: `https://web-demo-xyz.trycloudflare.com`

#### 3. Cập nhật biến môi trường Local
Mở **`server/.env`** và sửa các dòng sau:
```env
CORS_ORIGIN=https://web-demo-xyz.trycloudflare.com
APP_URL=https://web-demo-xyz.trycloudflare.com
COOKIE_SECURE=true
COOKIE_SAME_SITE=none
TRUST_PROXY=1
```

Mở **`user-client/.env.local`** và sửa:
```env
NEXT_PUBLIC_API_URL=https://api-demo-abc.trycloudflare.com/api
```

> **Giải thích:**
> - `COOKIE_SECURE=true` + `COOKIE_SAME_SITE=none`: bắt buộc khi Frontend và Backend nằm trên 2 subdomain `*.trycloudflare.com` khác nhau để cookie đăng nhập (`chinese_learner_token`) được gửi qua HTTPS.
> - `TRUST_PROXY=1`: giúp NestJS đọc đúng IP thật qua `X-Forwarded-For` từ Cloudflare Tunnel.
> - `APP_URL`: để link thanh toán trả về từ PayOS hoặc link trong email trỏ đúng về URL public.

#### 4. Khởi động (hoặc khởi động lại) Server & Client
- **Terminal 3 (Backend):**
  ```bash
  yarn server:dev
  ```
- **Terminal 4 (Frontend):**
  ```bash
  yarn client:dev
  ```

*(Nếu đang bật sẵn `server:dev` hoặc `client:dev` từ trước khi sửa `.env`, bắt buộc **tắt đi bật lại** để nhận `NEXT_PUBLIC_API_URL` và cấu hình CORS mới.)*

#### 5. Truy cập kiểm thử
Mở `https://web-demo-xyz.trycloudflare.com` trên điện thoại (4G) hoặc gửi cho người khác kiểm thử.

---

### Phương án B: Dùng 1 Tunnel duy nhất qua Reverse Proxy (Caddy/Nginx) — Ổn định nhất cho Safari/iPhone

Nếu test trên **Safari (iPhone/Mac)** với 2 domain `*.trycloudflare.com` khác nhau, Safari có thể chặn cookie cross-site (`SameSite=None`). Giải pháp chuẩn nhất là gộp Frontend + Backend chung **1 domain/tunnel**:
- Đường dẫn `/api/*` → chuyển về `http://localhost:4000`
- Tất cả đường dẫn còn lại `/*` → chuyển về `http://localhost:3000`

Ví dụ dùng **Caddy** (`Caddyfile` tạm ngoài repo):
```caddyfile
:8080 {
  handle /api/* {
    reverse_proxy localhost:4000
  }
  handle {
    reverse_proxy localhost:3000
  }
}
```

1. Chạy `caddy run` (nghe cổng `8080`).
2. Chạy **1 tunnel duy nhất**:
   ```bash
   cloudflared tunnel --url http://localhost:8080
   ```
   Nhận 1 URL duy nhất: `https://chinese-demo.trycloudflare.com`.
3. Cập nhật `.env`:
   - `user-client/.env.local`: `NEXT_PUBLIC_API_URL=https://chinese-demo.trycloudflare.com/api`
   - `server/.env`:
     ```env
     CORS_ORIGIN=https://chinese-demo.trycloudflare.com
     APP_URL=https://chinese-demo.trycloudflare.com
     COOKIE_SECURE=true
     COOKIE_SAME_SITE=lax
     TRUST_PROXY=1
     ```
4. Khởi động lại `yarn server:dev` và `yarn client:dev`. Lúc này FE và API cùng 1 origin nên `SameSite=Lax` hoạt động ổn định 100% trên mọi trình duyệt kể cả Safari iOS.

---

## Cách 2: Nhận Webhook PayOS thật về máy Local (tuỳ chọn)

Ở local mặc định dùng `PAYMENT_GATEWAY=fake`. Nếu bạn muốn thử **thanh toán QR PayOS thật** (ví dụ đơn 2.000 ₫) và nhận webhook trực tiếp về máy:
1. Public Backend theo Cách 1 để có URL HTTPS (ví dụ `https://api-demo-abc.trycloudflare.com`).
2. Trong `server/.env`, đổi `PAYMENT_GATEWAY=payos` và điền `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`.
3. Vào `my.payos.vn` → **Kênh thanh toán** → **Webhook**, dán URL:
   ```text
   https://api-demo-abc.trycloudflare.com/api/payments/webhook/payos
   ```
4. Khởi động lại `yarn server:dev` và thực hiện thanh toán thử.

---

## Cách 3: Dùng Ngrok (thay thế nếu không dùng Cloudflare)

> **Lưu ý:** Gói miễn phí của Ngrok chỉ cho phép chạy 1 tunnel hoặc hiển thị trang cảnh báo *Visit Site* khi gọi API từ trình duyệt, nên có thể làm lỗi `fetch` từ Frontend tới Backend. Nếu dùng Ngrok nên dùng gói có cấu hình chung 1 domain với reverse proxy (như Phương án B) hoặc dùng **Cloudflare Tunnel** ở Cách 1.

---

## Bước cuối: Dọn dẹp & khôi phục cấu hình Local sau khi test xong

1. Bấm `Ctrl + C` ở các terminal đang chạy `cloudflared` để đóng cổng ra Internet ngay khi xong việc.
2. Khôi phục `server/.env` và `user-client/.env.local` về mặc định local (`http://localhost:3000` và `http://localhost:4000/api`) để không ảnh hưởng lần chạy local/E2E tiếp theo:
   ```bash
   yarn env:force
   ```
   *(Lưu ý: `yarn env:force` sẽ đặt lại toàn bộ `.env`, `server/.env`, `user-client/.env.local` theo `.env.example`; nếu bạn có key riêng trong `server/.env`, hãy sửa tay lại 5 biến ở Bước 3 thay vì chạy `env:force`.)*
3. Nếu đã test Webhook PayOS với URL tunnel, nhớ xóa hoặc đổi lại URL Webhook trên `my.payos.vn`.
