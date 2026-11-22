'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  EmptyState,
  Field,
  Input,
  Select,
  Skeleton,
  useToast,
} from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { PROGRAMS, PROGRAM_ORDER } from '@/lib/programs';
import type { CourseItem, ProgramModule } from '@/lib/types';
import {
  CourseThumb,
  StatusBadge,
  editorHref,
  move,
  shortDate,
  studentCount,
  useManagedCourses,
  wordCount,
} from '../shared';
import s from '../teacher.module.css';

export default function TeacherCoursesPage() {
  return (
    <Suspense fallback={<Skeleton height={320} />}>
      <Courses />
    </Suspense>
  );
}

function Courses() {
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const { courses, setCourses, error, reload } = useManagedCourses();
  const [q, setQ] = useState('');
  const [program, setProgram] = useState<'' | ProgramModule>('');
  const [status, setStatus] = useState<'' | 'published' | 'draft'>('');
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // /teacher/courses?new=1 (the "+ Tạo khoá học" button on the overview) opens the form.
  useEffect(() => {
    if (params.get('new') === '1') setCreating(true);
  }, [params]);

  const filtered = useMemo(() => {
    if (!courses) return null;
    const needle = q.trim().toLowerCase();
    return courses.filter(
      (c) =>
        (!needle || c.title.toLowerCase().includes(needle)) &&
        (!program || c.module === program) &&
        (!status || (status === 'published') === c.isPublished),
    );
  }, [courses, q, program, status]);
  // Reordering a filtered view would hide where a course lands.
  const canReorder = !q.trim() && !program && !status;

  const closeCreate = () => {
    setCreating(false);
    if (params.get('new')) router.replace('/teacher/courses');
  };

  const reorder = async (from: number, to: number) => {
    if (!courses) return;
    const next = move(courses, from, to);
    if (next === courses) return;
    setCourses(next);
    try {
      await apiRequest('/courses/reorder', { method: 'PATCH', body: JSON.stringify({ orderedIds: next.map((c) => c.id) }) });
      toast.show('Đã lưu thứ tự khoá học');
    } catch (err) {
      toast.show((err as Error).message || 'Không lưu được thứ tự.');
      reload();
    }
  };

  const togglePublish = async (c: CourseItem) => {
    setBusyId(c.id);
    try {
      await apiRequest(`/courses/${c.id}`, { method: 'PATCH', body: JSON.stringify({ isPublished: !c.isPublished }) });
      toast.show(c.isPublished ? `Đã chuyển "${c.title}" về bản nháp` : `Đã xuất bản "${c.title}"`);
      await reload();
    } catch (err) {
      toast.show((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className={s.page}>
      <div className={s.head}>
        <h1 className={s.title}>Khoá học</h1>
        <Button variant="ink" size="sm" onClick={() => setCreating(true)}>
          + Tạo khoá học
        </Button>
      </div>

      <div className={s.filters} role="search">
        <label htmlFor="course-q" className="sr-only">
          Tìm khoá học
        </label>
        <Input id="course-q" type="search" placeholder="Tìm theo tên khoá" value={q} onChange={(e) => setQ(e.target.value)} />
        <label htmlFor="course-program" className="sr-only">
          Chương trình
        </label>
        <Select id="course-program" value={program} onChange={(e) => setProgram(e.target.value as '' | ProgramModule)}>
          <option value="">Mọi chương trình</option>
          {PROGRAM_ORDER.map((m) => (
            <option key={m} value={m}>
              {PROGRAMS[m].name}
            </option>
          ))}
        </Select>
        <label htmlFor="course-status" className="sr-only">
          Trạng thái
        </label>
        <Select id="course-status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="">Mọi trạng thái</option>
          <option value="published">Đã xuất bản</option>
          <option value="draft">Bản nháp</option>
        </Select>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <section className={s.card} aria-label="Danh sách khoá học">
        {!filtered ? (
          <div className={s.pad}>{!error && <Skeleton height={240} />}</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={courses?.length ? 'Không có khoá nào khớp' : 'Bạn chưa có khoá học nào'}
            action={
              courses?.length ? undefined : (
                <Button variant="ink" onClick={() => setCreating(true)}>
                  Tạo khoá học đầu tiên
                </Button>
              )
            }
          >
            {courses?.length ? 'Thử bỏ bớt bộ lọc.' : 'Khoá mới được tạo ở dạng bản nháp, học viên chưa thấy cho tới khi bạn xuất bản.'}
          </EmptyState>
        ) : (
          <div className={s.scroll}>
          <table className={s.table}>
            <thead>
              <tr>
                <th scope="col">Khoá học</th>
                <th scope="col">Chương trình</th>
                <th scope="col">Trạng thái</th>
                <th scope="col">Bài · Từ vựng</th>
                <th scope="col">Học viên</th>
                <th scope="col">Cập nhật</th>
                <th scope="col">
                  <span className="sr-only">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const index = courses!.indexOf(c);
                return (
                  <tr key={c.id}>
                    <td>
                      <div className={s.courseCell}>
                        <CourseThumb module={c.module} />
                        <span>
                          <Link href={editorHref(c.id)} className={s.rowTitle}>
                            {c.title}
                          </Link>
                          {isAdmin && c.teacher && <span className={s.rowMeta}>{c.teacher.fullName}</span>}
                        </span>
                      </div>
                    </td>
                    <td className={s.nowrap}>{PROGRAMS[c.module].name}</td>
                    <td className={s.nowrap}>
                      <StatusBadge published={c.isPublished} />
                    </td>
                    <td className={s.nowrap}>
                      {c.lessons.length} · {wordCount(c)}
                    </td>
                    <td>{studentCount(c)}</td>
                    <td className={s.nowrap}>{shortDate(c.updatedAt ?? c.createdAt)}</td>
                    <td>
                      <div className={s.rowActions}>
                        {canReorder && (
                          <>
                            <Button
                              variant="subtle"
                              size="sm"
                              iconOnly
                              aria-label={`Đưa "${c.title}" lên`}
                              disabled={index === 0}
                              onClick={() => reorder(index, index - 1)}
                            >
                              ↑
                            </Button>
                            <Button
                              variant="subtle"
                              size="sm"
                              iconOnly
                              aria-label={`Đưa "${c.title}" xuống`}
                              disabled={index === courses!.length - 1}
                              onClick={() => reorder(index, index + 1)}
                            >
                              ↓
                            </Button>
                          </>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          loading={busyId === c.id}
                          aria-label={c.isPublished ? `Chuyển "${c.title}" về bản nháp` : `Xuất bản "${c.title}"`}
                          onClick={() => togglePublish(c)}
                        >
                          {c.isPublished ? 'Ẩn' : 'Xuất bản'}
                        </Button>
                        <Link href={editorHref(c.id)} className={s.textLink} aria-label={`Sửa ${c.title}`}>
                          Sửa
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </section>
      <p className={s.note}>
        Dùng nút ↑ ↓ để đổi thứ tự khoá trong danh mục (khi không lọc). Khoá ở dạng bản nháp không hiện với học viên.
      </p>

      <CreateCourseDialog
        open={creating}
        onClose={closeCreate}
        onCreated={async (course) => {
          closeCreate();
          toast.show(`Đã tạo bản nháp "${course.title}"`);
          await reload();
        }}
      />
    </div>
  );
}

function CreateCourseDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (course: CourseItem) => void;
}) {
  const [title, setTitle] = useState('');
  const [module, setModule] = useState<ProgramModule>('hsk');
  const [isFree, setIsFree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setTitle('');
      setModule('hsk');
      setIsFree(false);
      setError('');
    }
  }, [open]);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (title.trim().length < 2) {
      setError('Tên khoá học tối thiểu 2 ký tự');
      return;
    }
    setBusy(true);
    try {
      // New courses start as drafts: learners see them only after "Xuất bản".
      const course = await apiRequest<CourseItem>('/courses', {
        method: 'POST',
        body: JSON.stringify({ title: title.trim(), module, isFree, isPublished: false }),
      });
      onCreated(course);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Tạo khoá học"
      actions={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Huỷ
          </Button>
          <Button variant="ink" size="sm" loading={busy} onClick={() => submit()}>
            Tạo bản nháp
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className={s.form}>
        <Field label="Tên khoá học" error={error || undefined}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} placeholder="HSK 1: nền tảng" autoFocus />
        </Field>
        <Field label="Chương trình">
          <Select value={module} onChange={(e) => setModule(e.target.value as ProgramModule)}>
            {PROGRAM_ORDER.map((m) => (
              <option key={m} value={m}>
                {PROGRAMS[m].name}
              </option>
            ))}
          </Select>
        </Field>
        <Checkbox label="Khoá miễn phí (ai cũng xem được mọi bài)" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} />
        <p className={s.note}>Giá bán do admin đặt. Bạn thêm bài giảng, tài liệu rồi xuất bản sau.</p>
        {/* Enter in the title submits the form. */}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
