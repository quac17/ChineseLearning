# Frontend – Vân Kính (`user-client/`)

Giao diện web xây dựng bằng **Next.js 14 (App Router + TypeScript)**, duy trì đăng nhập bằng **HTTP-only Cookie (`credentials: 'include'`)**, quản lý gói và chạy lệnh hoàn toàn qua **Yarn**.

## Các trang chức năng
- `/` – Trang chủ & chọn 4 chương trình (`Easy Steps`, `YCT`, `HSK`, `Giao tiếp`) đổi màu giao diện động.
- `/courses` – Danh sách khóa học, trình phát **Video upload (HTML5)** & **YouTube nhúng**, trạng thái khóa `锁` và tải tài liệu `.doc/.docx/.ppt/.pptx`.
- `/flashcards` – Flashcard từ vựng lật 3D.
- `/quiz` – Bài tập tương tác 4 dạng (chọn đáp án, sắp xếp câu, điền từ, nối cặp).
- `/writing` – Luyện viết chữ Hán trên Canvas.
- `/login`, `/register` – Đăng nhập & đăng ký (tự lưu phiên bằng cookie trình duyệt).
- `/profile` – Xem và **chỉnh sửa thông tin cá nhân** (họ tên, số điện thoại, giới thiệu), **đổi mật khẩu**, xem khóa học đã được cấp quyền.
- `/teacher` – Không gian Giáo viên (khóa học, upload video/YouTube, upload DOC/PPT, cấp quyền học sinh).
- `/admin` – Bảng điều khiển Admin (quản lý người dùng & vai trò, thống kê).

## Cấu hình & chạy bằng Yarn

### 1. Tạo file `.env.local`
```bash
cp .env.example .env.local
```
```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

### 2. Cài đặt, chạy dev & build
```bash
yarn install   # Cài đặt dependencies
yarn dev       # Chạy chế độ dev (http://localhost:3000)
yarn build     # Build bản production (standalone)
yarn start     # Chạy bản production
```
