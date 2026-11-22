'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, Checkbox, Dialog, Field, Input, Select, Switch, Textarea, useToast } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { PROGRAMS, PROGRAM_ORDER } from '@/lib/programs';
import type { ProgramModule } from '@/lib/types';
import { CourseThumb, studentCount } from '../../../shared';
import s from '../../../teacher.module.css';
import { useEditorCourse } from '../editor';

export default function CourseInfoTab() {
  const toast = useToast();
  const router = useRouter();
  const { user } = useAuth();
  const { course, reload, setCourse } = useEditorCourse();
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description ?? '');
  const [module, setModule] = useState<ProgramModule>(course.module);
  const [isFree, setIsFree] = useState(course.isFree);
  const [busy, setBusy] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // A reload elsewhere (or another course) resets the form.
  useEffect(() => {
    setTitle(course.title);
    setDescription(course.description ?? '');
    setModule(course.module);
    setIsFree(course.isFree);
  }, [course.id, course.title, course.description, course.module, course.isFree]);

  const dirty =
    title !== course.title || description !== (course.description ?? '') || module !== course.module || isFree !== course.isFree;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 2) {
      setError('Tên khoá học tối thiểu 2 ký tự');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/courses/${course.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: title.trim(), description, module, isFree }),
      });
      await reload();
      toast.show('Đã lưu thông tin khoá học');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const setPublished = async (next: boolean) => {
    setPublishing(true);
    try {
      await apiRequest(`/courses/${course.id}`, { method: 'PATCH', body: JSON.stringify({ isPublished: next }) });
      setCourse((c) => ({ ...c, isPublished: next }));
      toast.show(next ? 'Đã xuất bản: học viên thấy khoá trong danh mục' : 'Đã chuyển về bản nháp');
    } catch (err) {
      toast.show((err as Error).message);
    } finally {
      setPublishing(false);
    }
  };

  const students = studentCount(course);
  // Teachers cannot delete a course that has learners (the API refuses too); admins can.
  const canDelete = user?.role === 'ADMIN' || students === 0;

  const remove = async () => {
    setDeleteBusy(true);
    try {
      await apiRequest(`/courses/${course.id}`, { method: 'DELETE' });
      toast.show(`Đã xoá khoá "${course.title}"`);
      router.push('/teacher/courses');
    } catch (err) {
      toast.show((err as Error).message);
      setDeleteBusy(false);
      setDeleting(false);
    }
  };

  return (
    <div className={s.body}>
      <form className={`${s.card} ${s.panel} ${s.mainCol}`} onSubmit={save} aria-labelledby="info-title">
        <h2 id="info-title" className={s.cardTitle}>
          Thông tin khoá học
        </h2>
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Tên khoá học">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} required />
        </Field>
        {/* TODO(course fields issue): "Mô tả ngắn" (subtitle) and "Cấp độ" go here once the API has them. */}
        <Field label="Chương trình">
          <Select value={module} onChange={(e) => setModule(e.target.value as ProgramModule)}>
            {PROGRAM_ORDER.map((m) => (
              <option key={m} value={m}>
                {PROGRAMS[m].name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Mô tả chi tiết">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} />
        </Field>
        {/* TODO(course fields issue): "Bạn sẽ học được" (outcomes) list goes here. */}
        <Checkbox
          label="Khoá miễn phí: ai cũng xem được mọi bài, không cần mua"
          checked={isFree}
          onChange={(e) => setIsFree(e.target.checked)}
        />
        <div className={s.formActions}>
          <Button type="submit" variant="ink" loading={busy} disabled={!dirty}>
            Lưu
          </Button>
        </div>
      </form>

      <div className={s.sideCol}>
        <section className={`${s.card} ${s.panel}`} aria-labelledby="publish-title">
          <h2 id="publish-title" className={s.cardTitle}>
            Xuất bản
          </h2>
          <Switch label="Hiện trong danh mục" checked={course.isPublished} disabled={publishing} onChange={setPublished} />
          <p className={s.note}>
            {course.isPublished
              ? 'Học viên thấy khoá này trong danh mục và trang tìm kiếm.'
              : 'Bản nháp: chỉ bạn và admin thấy. Xuất bản khi đã có bài giảng.'}
          </p>
        </section>

        <section className={`${s.card} ${s.panel}`} aria-labelledby="cover-title">
          <h2 id="cover-title" className={s.cardTitle}>
            Ảnh bìa
          </h2>
          <div className={s.coverPreview}>
            <CourseThumb module={module} />
          </div>
          {/* TODO(course fields issue): cover upload once courses have cover_url. */}
          <p className={s.note}>Chưa có ảnh bìa riêng: khoá dùng mẫu màu của chương trình.</p>
        </section>

        <section className={`${s.card} ${s.panel}`} aria-labelledby="danger-title">
          <h2 id="danger-title" className={s.cardTitle}>
            Xoá khoá học
          </h2>
          <p className={s.note}>
            {canDelete
              ? 'Xoá khoá cùng mọi bài giảng, từ vựng và tài liệu. Không hoàn tác được.'
              : `Khoá đang có ${students} học viên nên không xoá được. Hãy chuyển về bản nháp, hoặc nhờ admin.`}
          </p>
          <Button variant="danger" size="sm" disabled={!canDelete} onClick={() => setDeleting(true)}>
            Xoá khoá học
          </Button>
        </section>
      </div>

      <Dialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title={`Xoá khoá "${course.title}"?`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setDeleting(false)}>
              Huỷ
            </Button>
            <Button variant="danger" size="sm" loading={deleteBusy} onClick={remove}>
              Xoá vĩnh viễn
            </Button>
          </>
        }
      >
        <p style={{ margin: 0 }}>
          {course.lessons.length} bài giảng và {course.documents.length} tài liệu sẽ bị xoá cùng khoá. Việc này không hoàn tác được.
        </p>
      </Dialog>
    </div>
  );
}
