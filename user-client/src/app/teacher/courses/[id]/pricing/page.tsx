'use client';

import Link from 'next/link';
import { Rating } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { learnerText } from '@/lib/courses';
import { formatVnd } from '@/lib/programs';
import s from '../../../teacher.module.css';
import { useEditorCourse } from '../editor';

/** Read-only for teachers: admins set prices (/admin/prices). No revenue here, ever. */
export default function CoursePricingTab() {
  const { user } = useAuth();
  const { course } = useEditorCourse();
  const previews = course.lessons.map((l, i) => ({ ...l, n: i + 1 })).filter((l) => l.isFree);
  const freeDocs = course.documents.filter((d) => d.isFree).length;

  const price = course.isFree
    ? 'Miễn phí'
    : course.priceVnd != null
      ? formatVnd(course.priceVnd)
      : 'Chưa mở bán';

  return (
    <div className={s.body}>
      <section className={`${s.card} ${s.panel} ${s.mainCol}`} aria-labelledby="price-title">
        <h2 id="price-title" className={s.cardTitle}>
          Giá &amp; bán
        </h2>
        <dl className={s.kvList}>
          <div>
            <dt>Giá bán</dt>
            <dd>{price}</dd>
          </div>
          <div>
            <dt>Bài học thử</dt>
            <dd>
              {course.isFree
                ? 'Mọi bài (khoá miễn phí)'
                : previews.length
                  ? previews.map((l) => `Bài ${l.n}`).join(', ')
                  : 'Chưa có'}
            </dd>
          </div>
          <div>
            <dt>Tài liệu học thử</dt>
            <dd>{course.isFree ? 'Mọi tài liệu' : freeDocs}</dd>
          </div>
          <div>
            <dt>Thanh toán</dt>
            <dd>Mã QR PayOS, cấp quyền tự động khi tiền về</dd>
          </div>
        </dl>
        {!course.isFree && course.priceVnd == null && (
          <p className={s.note}>Khoá trả phí chưa có giá nên học viên chưa mua được (chỉ xem bài học thử).</p>
        )}
        <dl className={s.kvList}>
          <div>
            <dt>Đánh giá hiển thị</dt>
            <dd>
              {course.rating ? (
                <Rating value={course.rating.value} source={course.rating.source} />
              ) : (
                'Không có (chỉ hiện khi admin nhập kèm nguồn thật)'
              )}
            </dd>
          </div>
          <div>
            <dt>Học viên</dt>
            <dd>{learnerText(course.learnerCount ?? 0, course.offlineLearnerCount) ?? 'Chưa có'}</dd>
          </div>
        </dl>
        {user?.role === 'ADMIN' ? (
          <p className={s.note}>
            Bạn là admin: đặt giá ở trang{' '}
            <Link href="/admin/prices" className={s.textLink}>
              Giá khoá học
            </Link>
            , đánh giá có nguồn ở trang{' '}
            <Link href="/admin/ratings" className={s.textLink}>
              Đánh giá & học viên
            </Link>
            .
          </p>
        ) : (
          <p className={s.note}>Giá và đánh giá do admin quản lý. Cần đổi? Liên hệ admin. Khu giáo viên không hiển thị doanh thu.</p>
        )}
      </section>
      <section className={`${s.card} ${s.panel} ${s.sideCol}`} aria-labelledby="preview-title">
        <h2 id="preview-title" className={s.cardTitle}>
          Bài học thử
        </h2>
        <p className={s.note}>
          Bật hoặc tắt học thử cho từng bài ở tab{' '}
          <Link href={`/teacher/courses/${course.id}/lessons`} className={s.textLink}>
            Bài giảng
          </Link>
          . Bài trả phí nên dùng video tải lên: video YouTube thì ai có link cũng xem được.
        </p>
      </section>
    </div>
  );
}
