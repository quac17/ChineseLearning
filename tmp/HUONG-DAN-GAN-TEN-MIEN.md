# Hướng dẫn gắn Tên miền Việt Nam & Phương án Tên miền miễn phí (GCP Cloud Run)

Tài liệu này hướng dẫn chi tiết cách gắn tên miền cho hệ thống **Chinese Learner** (`user-client` + `server` đang chạy trên **GCP Cloud Run**), bao gồm cả trường hợp **mua tên miền tại Việt Nam** lẫn **dùng tên miền miễn phí từ GitHub / bên thứ ba**.

---

## Phần 1: Mua tên miền tại Việt Nam và trỏ về GCP Cloud Run (Khuyến nghị cho Production)

Bạn có thể mua tên miền `.vn`, `.com.vn`, `.edu.vn` hoặc `.com` tại các nhà đăng ký uy tín ở Việt Nam như **Mắt Bão, Tenten, Nhân Hòa, iNET, P.A Vietnam** (giá tham khảo: `.com` ~250k–350k/năm, `.vn` ~550k–750k/năm).

### Kiến trúc tên miền chuẩn cho dự án Chinese Learner
Giả sử tên miền bạn mua là `chineselearner.vn`:
- **Frontend (`user-client`)**: `https://chineselearner.vn` (và `https://www.chineselearner.vn`)
- **Backend API (`server`)**: `https://api.chineselearner.vn`

> **Tại sao nên dùng chung 1 tên miền cha (`chineselearner.vn` và `api.chineselearner.vn`)?**
> Vì hệ thống dùng **HTTP-only Cookie** để duy trì đăng nhập. Khi FE và BE dùng chung tên miền cha (`*.chineselearner.vn`), trình duyệt (kể cả Safari trên iPhone/Mac) xem đây là **Same-Site**, nên cookie hoạt động ổn định 100%, không bị chặn third-party cookie.

---

### Bước 1: (Khuyến nghị) Quản lý DNS qua Cloudflare miễn phí
Giao diện DNS của một số nhà đăng ký VN cập nhật chậm hoặc không hỗ trợ CNAME ở root domain (`@`). Bạn nên dùng **Cloudflare Free**:
1. Tạo tài khoản miễn phí tại `https://dash.cloudflare.com` → **Add a site** → nhập `chineselearner.vn` → chọn gói **Free**.
2. Cloudflare sẽ cấp 2 **Nameserver** (ví dụ `aria.ns.cloudflare.com`, `bob.ns.cloudflare.com`).
3. Đăng nhập trang quản trị tên miền tại Mắt Bão / Tenten / Nhân Hòa / iNET → mục **Đổi Nameserver (DNS)** → thay bằng 2 Nameserver của Cloudflare.
4. Chờ 15–60 phút để Cloudflare báo **Active**.

*(Nếu không dùng Cloudflare, bạn vẫn có thể tạo trực tiếp các bản ghi DNS ở Bước 2 & 3 ngay trên trang quản trị của nhà đăng ký tên miền VN.)*

---

### Bước 2: Xác minh quyền sở hữu tên miền với Google Cloud
GCP yêu cầu xác minh bạn là chủ tên miền `chineselearner.vn` trước khi map vào Cloud Run:
1. Vào **Google Cloud Console** → **Cloud Run** → **Manage Custom Domains** → bấm **Add Mapping**.
2. Chọn mục **Verify a new domain** → nhập `chineselearner.vn` → Google sẽ mở trang **Webmaster Central / Search Console** và cấp cho bạn 1 mã bản ghi `TXT` (dạng `google-site-verification=xxxxxxxx`).
3. Vào trang quản trị DNS (Cloudflare hoặc nhà đăng ký VN) → thêm bản ghi:
   - **Type:** `TXT`
   - **Name / Host:** `@` (hoặc để trống tùy giao diện)
   - **Value / Content:** `google-site-verification=xxxxxxxx`
4. Quay lại Google bấm **Verify** (mất khoảng 1–5 phút).

---

### Bước 3: Map tên miền vào 2 service Cloud Run
Vẫn tại **Cloud Run → Manage Custom Domains → Add Mapping**:

#### 3.1. Map Frontend (`chineselearner.vn`)
- **Service:** `chinese-learner-client`
- **Domain:** `chineselearner.vn` (root domain)
- Google sẽ trả về danh sách các bản ghi **`A`** (4 địa chỉ IPv4) và **`AAAA`** (4 địa chỉ IPv6).
- Thêm đầy đủ các bản ghi `A` và `AAAA` này vào DNS với **Host = `@`**.
  - *Lưu ý nếu dùng Cloudflare:* Lúc mới xác minh SSL, hãy tắt đám mây cam (**Proxy status = DNS only / đám mây xám**) để Google Cloud cấp chứng chỉ SSL tự động thành công.

#### 3.2. Map Backend (`api.chineselearner.vn`)
- **Service:** `chinese-learner-server`
- **Domain:** `api.chineselearner.vn`
- Google sẽ trả về 1 bản ghi **`CNAME`** trỏ tới `ghs.googlehosted.com.`
- Thêm bản ghi vào DNS:
  - **Type:** `CNAME`
  - **Name / Host:** `api`
  - **Target / Value:** `ghs.googlehosted.com`
  - *(Nếu dùng Cloudflare: để **DNS only / đám mây xám** cho tới khi SSL xong).*

Đợi khoảng **15–30 phút**, trạng thái trên Cloud Run sẽ chuyển sang dấu tích xanh **Active** cùng chứng chỉ **SSL HTTPS miễn phí tự động gia hạn**.

---

### Bước 4: Cập nhật biến môi trường cho Backend & Frontend

#### 4.1. Cập nhật Backend (`chinese-learner-server`) trên Cloud Run
```bash
gcloud run services update chinese-learner-server \
  --region asia-southeast1 \
  --update-env-vars "CORS_ORIGIN=https://chineselearner.vn,https://www.chineselearner.vn,APP_URL=https://chineselearner.vn,API_PUBLIC_URL=https://api.chineselearner.vn/api,COOKIE_SECURE=true,COOKIE_SAME_SITE=lax"
```
> **Lưu ý về Cookie giữa `chineselearner.vn` và `api.chineselearner.vn`:**
> Cookie được set từ `api.chineselearner.vn` sẽ tự động gửi lại cho mọi request tới `api.chineselearner.vn` (kể cả khi trình duyệt đang mở `https://chineselearner.vn`) miễn là:
> - Backend trả về `Access-Control-Allow-Credentials: true` và đúng `CORS_ORIGIN=https://chineselearner.vn,https://www.chineselearner.vn` (đã cấu hình sẵn trong `server/src/main.ts`).
> - Frontend gọi API với `credentials: 'include'` (đã cấu hình sẵn trong `user-client/src/lib/api.ts`).
> - `COOKIE_SECURE=true` và `COOKIE_SAME_SITE=lax`.
> - `APP_URL=https://chineselearner.vn` để link trả về từ PayOS (`/checkout/...`) và link trong email (quên mật khẩu, nhắc ôn tập) trỏ đúng về web mới.

#### 4.2. Rebuild & Deploy lại Frontend (`chinese-learner-client`) với API domain mới
Vì `NEXT_PUBLIC_API_URL` được nhúng lúc build Next.js, bạn cần build lại image Frontend với `NEXT_PUBLIC_API_URL=https://api.chineselearner.vn/api`.

#### 4.3. Cập nhật CORS Bucket GCS, Webhook PayOS & Cloud Scheduler (nếu đang dùng)
- Sửa `origin` trong `cors.json` của bucket Cloud Storage thành `https://chineselearner.vn` và chạy lại `gcloud storage buckets update`.
- Cập nhật URL Webhook trên `my.payos.vn` thành `https://api.chineselearner.vn/api/payments/webhook/payos`.
- Cập nhật `--uri` của job Cloud Scheduler nhắc ôn tập thành `https://api.chineselearner.vn/api/reminders/run`.

---

## Phần 2: Tích hợp tên miền miễn phí từ GitHub (và các giải pháp miễn phí khác)

Cần phân biệt rõ 3 trường hợp khi nhắc đến "tên miền miễn phí trên GitHub":

### Trường hợp A: Tên miền `*.github.io` (GitHub Pages)
**Thực tế kỹ thuật:**
- Tên miền `ten-cua-ban.github.io` thuộc quyền quản lý DNS của GitHub, bạn **KHÔNG thể trỏ DNS** của `github.io` về GCP Cloud Run.
- GitHub Pages chỉ chạy được **web tĩnh (HTML/CSS/JS)** — không chạy được Next.js Server (`standalone`) hay NestJS Backend.
- **Nếu bạn vẫn muốn thử đưa Frontend lên `username.github.io`** và gọi Backend trên GCP Cloud Run (`https://chinese-learner-server-xxx.a.run.app`):
  1. Phải đổi `user-client/next.config.mjs` từ `output: 'standalone'` sang `output: 'export'` (xuất file tĩnh).
  2. Vì `github.io` và `a.run.app` là **khác tên miền (cross-site)**, phải đặt ở Backend:
     - `CORS_ORIGIN=https://ten-cua-ban.github.io`
     - `COOKIE_SECURE=true`
     - `COOKIE_SAME_SITE=none`
  3. **Nhược điểm lớn:** Trình duyệt Safari (iPhone/iPad/Mac) và Chrome chế độ chặn cookie bên thứ ba sẽ **chặn cookie cross-site** giữa `github.io` và `a.run.app`, khiến học sinh bị đăng xuất khi F5.
  → **Kết luận:** Không nên dùng `*.github.io` cho dự án dùng Cookie Auth; chỉ nên dùng cho web tĩnh thuần không có Backend đăng nhập.

### Trường hợp B: Tên miền thật miễn phí qua GitHub Student Developer Pack (Rất tốt nếu bạn có thẻ sinh viên / email `.edu`)
Nếu bạn là sinh viên/giảng viên có email trường học (`.edu.vn` / `.edu`):
1. Đăng ký **GitHub Education / Student Developer Pack** tại `https://education.github.com/pack`.
2. Trong gói này có sẵn ưu đãi **miễn phí 1 năm tên miền thật**:
   - **Namecheap:** miễn phí 1 năm tên miền `.me`
   - **Name.com:** miễn phí 1 năm tên miền `.live`, `.studio`, `.software`, ...
   - **`.TECH`:** miễn phí 1 năm tên miền `.tech`
3. Sau khi nhận tên miền, bạn có **toàn quyền quản trị DNS** → làm y hệt **Phần 1** ở trên (trỏ về Cloud Run, có HTTPS tự động, Cookie hoạt động chuẩn 100%).

### Trường hợp C: Dùng miễn phí hoàn toàn trong giai đoạn chưa mua tên miền
1. **Dùng trực tiếp URL miễn phí của GCP Cloud Run (`*.run.app`):**
   - Sau khi deploy lên Cloud Run, bạn có ngay 2 link HTTPS miễn phí:
     - FE: `https://chinese-learner-client-xxxxxx-as.a.run.app`
     - BE: `https://chinese-learner-server-xxxxxx-as.a.run.app`
   - Cấu hình trên BE: `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=none`, `CORS_ORIGIN=https://chinese-learner-client-xxxxxx-as.a.run.app`, `APP_URL=https://chinese-learner-client-xxxxxx-as.a.run.app`.
   - Đủ dùng hoàn hảo cho giai đoạn test nội bộ / demo trước khi mua domain `.vn` hoặc `.com`.
2. **Hoặc dùng tên miền phụ miễn phí có quản trị DNS (`eu.org` / `pp.ua` / `is-a.dev`):**
   - `eu.org` hoặc `nic.ua` (`.pp.ua`) cho phép trỏ Nameserver sang Cloudflare Free miễn phí → sau đó cấu hình giống hệt Phần 1.

---

## Tóm tắt khuyến nghị

| Giai đoạn | Phương án tên miền | Độ ổn định Cookie Auth | Chi phí |
|---|---|---|---|
| **Đang phát triển / Demo** | Dùng link `*.run.app` có sẵn của Cloud Run | Tốt (trên Chrome/Edge) | 0đ |
| **Có email sinh viên `.edu`** | GitHub Student Pack (`.me` / `.tech`) + Cloudflare Free | Tuyệt đối (100%) | 0đ năm đầu |
| **Chạy thật cho học viên VN** | Mua `.com` hoặc `.vn` (Mắt Bão / Tenten / iNET) + Cloudflare Free | Tuyệt đối (100%, hỗ trợ Safari/iPhone) | ~250k–700k/năm |
