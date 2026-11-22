'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, Checkbox, Dialog, Field, Input, Select, Switch, Textarea, useToast } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { apiRequest, buildMediaUrl } from '@/lib/api';
import { LEVELS, LEVEL_ORDER } from '@/lib/courses';
import { PROGRAMS, PROGRAM_ORDER } from '@/lib/programs';
import type { CourseLevel, ProgramModule } from '@/lib/types';
import { FileDrop } from '../../../FileDrop';
import { CourseThumb, studentCount } from '../../../shared';
import s from '../../../teacher.module.css';
import { uploadWithProgress } from '../../../upload';
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
  const [subtitle, setSubtitle] = useState(course.subtitle ?? '');
  const [level, setLevel] = useState<CourseLevel | ''>(course.level ?? '');
  const savedOutcomes = (course.outcomes ?? []).join('\n');
  const [outcomes, setOutcomes] = useState(savedOutcomes);
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
    setSubtitle(course.subtitle ?? '');
    setLevel(course.level ?? '');
    setOutcomes(savedOutcomes);
  }, [course.id, course.title, course.description, course.module, course.isFree, course.subtitle, course.level, savedOutcomes]);

  const outcomeList = outcomes.split('\n').map((l) => l.trim()).filter(Boolean);
  const dirty =
    title !== course.title ||
    description !== (course.description ?? '') ||
    module !== course.module ||
    isFree !== course.isFree ||
    subtitle !== (course.subtitle ?? '') ||
    level !== (course.level ?? '') ||
    outcomeList.join('\n') !== savedOutcomes;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 2) {
      setError('Tên khoá học tối thiểu 2 ký tự');
      return;
    }
    if (subtitle.trim().length > 120) {
      setError('Mô tả ngắn tối đa 120 ký tự');
      return;
    }
    if (outcomeList.length > 12) {
      setError('Tối đa 12 ý "Bạn sẽ học được"');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/courses/${course.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: title.trim(),
          description,
          module,
          isFree,
          subtitle: subtitle.trim() || null,
          level: level || null,
          outcomes: outcomeList,
        }),
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
        <Field label="Mô tả ngắn (hiện dưới tên khoá)" hint={`Tối đa 120 ký tự · còn ${120 - subtitle.length}`}>
          <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} maxLength={120} />
        </Field>
        <Field label="Cấp độ">
          <Select value={level} onChange={(e) => setLevel(e.target.value as CourseLevel | '')}>
            <option value="">Chưa chọn</option>
            {LEVEL_ORDER.map((id) => (
              <option key={id} value={id}>
                {LEVELS[id].hint} · {LEVELS[id].label}
              </option>
            ))}
          </Select>
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
        <Field label="Mô tả chi tiết">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} />
        </Field>
        <Field label="Bạn sẽ học được (mỗi dòng một ý)" hint="Tối đa 12 ý, mỗi ý tối đa 160 ký tự. Để trống thì trang khoá không hiện mục này.">
          <Textarea value={outcomes} onChange={(e) => setOutcomes(e.target.value)} rows={5} />
        </Field>
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
          <CoverEditor courseId={course.id} coverUrl={course.coverUrl ?? null} module={module} onChanged={reload} />
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

/** Cover upload (JPG, PNG, WebP; 1280 × 720 recommended). Covers are public, like the catalog. */
function CoverEditor({
  courseId,
  coverUrl,
  module,
  onChanged,
}: {
  courseId: string;
  coverUrl: string | null;
  module: ProgramModule;
  onChanged: () => Promise<void> | void;
}) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [removing, setRemoving] = useState(false);

  const upload = async () => {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    setProgress(0);
    try {
      await uploadWithProgress(`/courses/${courseId}/cover`, 'POST', fd, setProgress);
      setFile(null);
      await onChanged();
      toast.show('Đã cập nhật ảnh bìa');
    } catch (err) {
      toast.show((err as Error).message);
    } finally {
      setProgress(null);
    }
  };

  const remove = async () => {
    setRemoving(true);
    try {
      await apiRequest(`/courses/${courseId}/cover`, { method: 'DELETE' });
      await onChanged();
      toast.show('Đã bỏ ảnh bìa: khoá dùng mẫu màu chương trình');
    } catch (err) {
      toast.show((err as Error).message);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <>
      <div className={s.coverPreview}>
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={buildMediaUrl(coverUrl)} alt="Ảnh bìa hiện tại" className={s.coverImg} />
        ) : (
          <CourseThumb module={module} />
        )}
      </div>
      <p className={s.note}>
        {coverUrl
          ? 'Ảnh bìa hiện trên thẻ khoá và trang khoá học.'
          : 'Chưa có ảnh bìa riêng: khoá dùng mẫu màu của chương trình. Nên dùng một khung hình từ video bài giảng, 1280 × 720.'}
      </p>
      <FileDrop label="Tệp ảnh bìa" accept=".jpg,.jpeg,.png,.webp" hint=".jpg, .png, .webp · tối đa 2 MB" file={file} onFile={setFile} />
      <div className={s.formActions}>
        {coverUrl && (
          <Button variant="text" size="sm" loading={removing} onClick={remove}>
            Bỏ ảnh bìa
          </Button>
        )}
        <Button variant="ink" size="sm" disabled={!file} loading={progress !== null} onClick={upload}>
          Tải ảnh lên
        </Button>
      </div>
    </>
  );
}
