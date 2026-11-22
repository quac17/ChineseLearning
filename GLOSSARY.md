# Glossary · Thuật ngữ

Code uses the **English term**; the UI uses the **Vietnamese term**. Avoid the
listed synonyms in code, issues and test names.

| Code term | Tiếng Việt (UI) | Meaning | Avoid |
|---|---|---|---|
| **Program** (`program_modules`, `module`) | Chương trình học | A learning track with its own colour theme: `easy` (Easy Steps), `yct` (YCT), `hsk` (HSK), `talk` (Giao tiếp). | track, category |
| **Course** (`courses`) | Khoá học | A sellable unit owned by one Teacher, belonging to one Program, made of Lessons and Documents. | class, product |
| **Lesson** (`lessons`) | Bài học / Bài giảng | One video inside a Course, either an Upload or a YouTube video. | video, episode |
| **Free preview** (`is_free` on a lesson) | Học thử / Miễn phí | A lesson anyone can watch, used to sell the Course. | demo, trial |
| **Free course** (`is_free` on a course) | Khoá học miễn phí | A Course whose every lesson is free. | |
| **Document** (`course_documents`) | Tài liệu | A Word/PowerPoint file attached to a Course, downloadable with access. | attachment |
| **Enrollment** (`course_enrollments`) | Quyền học khoá học | The row that grants a Student access to a Course (`can_view`). Created by a Teacher/Admin or by a paid Order. | subscription, purchase |
| **Review** (`course_reviews`) | Đánh giá | 1–5 stars and an optional comment from a Student with access to a paid Course; one per Student and Course. The Teacher's answer is the **reply** (Trả lời); an Admin may **hide** (Ẩn) it with a reason. | rating (that is the admin-entered, sourced survey score), feedback, comment |
| **Sourced rating** (`rating_value` + `rating_source`) | Điểm khảo sát (kèm nguồn) | A score an Admin enters only together with its real source (e.g. an offline survey). Never merged with Reviews. | |
| **Access** | Quyền xem | Whether a user may watch a Lesson or download a Document; computed by `checkUserCourseAccess`. | permission (when meaning roles) |
| **Role** | Vai trò | `ADMIN` (Quản trị), `TEACHER` (Giáo viên), `STUDENT` (Học sinh). | |
| **Order** (`orders`, planned) | Đơn hàng | One purchase attempt of one Course by one Student, with a status. | payment, transaction |
| **Payment event** (`payment_events`, planned) | Sự kiện thanh toán | A received gateway webhook, stored for idempotency and audit. | |
| **Gateway** | Cổng thanh toán | A payment provider behind the `PaymentGateway` adapter (PayOS first). | |
| **Signed URL** | Link xem có thời hạn | Short-lived GCS URL for a paid video or document, issued after the access check. | public link |
| **Flashcard / Quiz / Writing practice** | Flashcard / Quiz / Luyện viết chữ Hán | Practice tools outside the video Courses. | |
| **Review reminder** (`review_reminders`) | Nhắc ôn tập mỗi ngày | Opt-in email, at most one per Vietnam day, sent when a learner has words due in their Leitner boxes. | notification, newsletter |
| **Mailer** (`MailModule`) | Email | The email backend behind the `Mailer` adapter: `console` (local/e2e) or `smtp`. | |
