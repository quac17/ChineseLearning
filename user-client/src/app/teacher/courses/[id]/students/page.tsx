'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Dialog, EmptyState, Input, ProgressBar, Select, Skeleton, useToast } from '@/components/ui';
import { apiRequest } from '@/lib/api';
import type { CourseStudentAccess } from '@/lib/types';
import { shortDate } from '../../../shared';
import s from '../../../teacher.module.css';
import { useEditorCourse } from '../editor';

type SourceFilter = '' | 'paid' | 'manual';

export default function CourseStudentsTab() {
  const toast = useToast();
  const { course, reload: reloadCourse } = useEditorCourse();
  const [students, setStudents] = useState<CourseStudentAccess[] | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<SourceFilter>('');
  const [revoking, setRevoking] = useState<CourseStudentAccess | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setStudents(await apiRequest<CourseStudentAccess[]>(`/enrollments/course/${course.id}`));
      setError('');
    } catch (err) {
      setError((err as Error).message || 'Không tải được danh sách học viên.');
    }
  }, [course.id]);

  useEffect(() => {
    load();
  }, [load]);

  const setAccess = async (student: CourseStudentAccess, canView: boolean) => {
    setBusyId(student.studentId);
    try {
      await apiRequest('/enrollments/access', {
        method: 'POST',
        body: JSON.stringify({ courseId: course.id, studentId: student.studentId, canView }),
      });
      toast.show(canView ? `Đã cấp quyền cho ${student.fullName}` : `Đã thu hồi quyền của ${student.fullName}`);
      setRevoking(null);
      await Promise.all([load(), reloadCourse()]);
      return true;
    } catch (err) {
      toast.show((err as Error).message);
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const shown = (students ?? []).filter((st) => !filter || (filter === 'paid') === Boolean(st.paidOrderCode));
  const total = course.lessons.length;

  return (
    <div className={s.stack}>
      <GrantSearch courseId={course.id} busyId={busyId} onGrant={(st) => setAccess(st, true)} />

      <section className={s.card} aria-labelledby="granted-title">
        <div className={s.cardHead}>
          <h2 id="granted-title" className={s.cardTitle}>
            Học viên có quyền ({students?.length ?? 0})
          </h2>
          <label htmlFor="source-filter" className="sr-only">
            Lọc nguồn
          </label>
          <Select id="source-filter" className={s.compactSelect} value={filter} onChange={(e) => setFilter(e.target.value as SourceFilter)}>
            <option value="">Mọi nguồn</option>
            <option value="paid">Đã mua</option>
            <option value="manual">Cấp thủ công</option>
          </Select>
        </div>
        {error && (
          <div className={s.pad}>
            <Alert tone="error">{error}</Alert>
          </div>
        )}
        {!students ? (
          !error && (
            <div className={s.pad}>
              <Skeleton height={160} />
            </div>
          )
        ) : shown.length === 0 ? (
          <EmptyState title={students.length ? 'Không có học viên nào khớp' : 'Chưa có học viên'}>
            {students.length
              ? 'Thử chọn nguồn khác.'
              : course.isFree
                ? 'Khoá miễn phí: ai cũng xem được, không cần cấp quyền.'
                : 'Học viên mua qua PayOS sẽ hiện ở đây. Bạn cũng có thể cấp quyền thủ công ở trên.'}
          </EmptyState>
        ) : (
          <div className={s.scroll}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th scope="col">Học viên</th>
                  <th scope="col">Nguồn</th>
                  <th scope="col">Từ ngày</th>
                  <th scope="col">Tiến độ</th>
                  <th scope="col">
                    <span className="sr-only">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((st) => {
                  const done = Math.min(st.completedLessons ?? 0, total);
                  const pct = total ? (done / total) * 100 : 0;
                  return (
                    <tr key={st.studentId}>
                      <td>
                        <b>{st.fullName}</b>
                        <span className={s.rowMeta}>{st.email}</span>
                      </td>
                      <td>
                        {st.paidOrderCode ? (
                          <>
                            <Badge tone="success">Đã mua</Badge> <span className={s.rowMetaInline}>{st.paidOrderCode}</span>
                          </>
                        ) : (
                          <>
                            <Badge tone="neutral">Cấp thủ công</Badge>
                            {st.grantedBy && <span className={s.rowMetaInline}> bởi {st.grantedBy}</span>}
                          </>
                        )}
                      </td>
                      <td className={s.nowrap}>{shortDate(st.updatedAt)}</td>
                      <td className={s.progressCell}>
                        <ProgressBar value={pct} label={`Tiến độ của ${st.fullName}`} />
                        <span className={s.rowMeta}>
                          {done}/{total} bài
                        </span>
                      </td>
                      <td className={s.right}>
                        <Button variant="danger" size="sm" aria-label={`Thu hồi quyền của ${st.fullName}`} onClick={() => setRevoking(st)}>
                          Thu hồi
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog
        open={revoking !== null}
        onClose={() => setRevoking(null)}
        title={`Thu hồi quyền của ${revoking?.fullName ?? ''}?`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setRevoking(null)}>
              Huỷ
            </Button>
            <Button variant="danger" size="sm" loading={busyId === revoking?.studentId} onClick={() => revoking && setAccess(revoking, false)}>
              Thu hồi quyền
            </Button>
          </>
        }
      >
        <p style={{ margin: 0 }}>
          {revoking?.paidOrderCode ? (
            <>
              Học viên này đã <b>mua</b> khoá (đơn {revoking.paidOrderCode}). Thu hồi sẽ khoá các bài trả phí ngay lập tức; việc hoàn
              tiền do admin xử lý.
            </>
          ) : (
            'Học viên sẽ không xem được các bài trả phí của khoá này nữa. Bạn có thể cấp lại bất cứ lúc nào.'
          )}
        </p>
      </Dialog>
    </div>
  );
}

/** Search students without access (name, email or phone, 2+ characters) and grant them. */
function GrantSearch({
  courseId,
  busyId,
  onGrant,
}: {
  courseId: string;
  busyId: string | null;
  onGrant: (student: CourseStudentAccess) => Promise<boolean>;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<CourseStudentAccess[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const data = await apiRequest<CourseStudentAccess[]>(
          `/enrollments/course/${courseId}/search-students?q=${encodeURIComponent(term)}`,
        );
        if (!cancelled) {
          setResults(data);
          setError('');
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, courseId]);

  return (
    <section className={`${s.card} ${s.panel}`} aria-labelledby="grant-title">
      <h2 id="grant-title" className={s.cardTitle}>
        Cấp quyền xem khoá
      </h2>
      <label htmlFor="student-q" className={s.legend}>
        Tìm học viên theo tên, email hoặc số điện thoại
      </label>
      <Input
        id="student-q"
        type="search"
        className={s.searchBox}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Gõ ít nhất 2 ký tự"
        aria-controls="student-results"
        autoComplete="off"
      />
      {error && <Alert tone="error">{error}</Alert>}
      {results && (
        <ul id="student-results" className={s.results} aria-label="Kết quả tìm học viên">
          {results.length === 0 ? (
            <li className={s.note}>Không tìm thấy học viên chưa có quyền khớp với “{q.trim()}”.</li>
          ) : (
            results.map((st) => (
              <li key={st.studentId}>
                <span>
                  <b>{st.fullName}</b>
                  <span className={s.rowMeta}>{[st.email, st.phone].filter(Boolean).join(' · ')}</span>
                </span>
                <Button
                  variant="ink"
                  size="sm"
                  loading={busyId === st.studentId}
                  aria-label={`Cấp quyền cho ${st.fullName}`}
                  onClick={async () => {
                    if (await onGrant(st)) setResults((all) => all?.filter((x) => x.studentId !== st.studentId) ?? null);
                  }}
                >
                  Cấp quyền
                </Button>
              </li>
            ))
          )}
        </ul>
      )}
      <p className={s.note}>Học viên mua khoá qua PayOS được cấp quyền tự động. Ở đây chỉ hiện học viên chưa có quyền.</p>
    </section>
  );
}
