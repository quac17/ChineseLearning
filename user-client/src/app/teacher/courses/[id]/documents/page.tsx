'use client';

import { useState, type FormEvent } from 'react';
import { Alert, Badge, Button, Checkbox, Dialog, EmptyState, Field, Input, ProgressBar, Textarea, useToast } from '@/components/ui';
import { apiRequest, formatFileSize } from '@/lib/api';
import type { CourseDocumentItem } from '@/lib/types';
import { FileDrop } from '../../../FileDrop';
import { move } from '../../../shared';
import s from '../../../teacher.module.css';
import { uploadWithProgress } from '../../../upload';
import { useEditorCourse } from '../editor';

const DOC_ACCEPT = '.doc,.docx,.ppt,.pptx';

/** null = the add form, otherwise the document being edited. */
type Editing = null | CourseDocumentItem;

export default function CourseDocumentsTab() {
  const toast = useToast();
  const { course, reload, setCourse } = useEditorCourse();
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<CourseDocumentItem | null>(null);
  const [busy, setBusy] = useState(false);
  const docs = course.documents;

  const reorder = async (from: number, to: number) => {
    const next = move(docs, from, to);
    if (next === docs) return;
    setCourse((c) => ({ ...c, documents: next }));
    try {
      await apiRequest('/documents/reorder', {
        method: 'PATCH',
        body: JSON.stringify({ courseId: course.id, orderedIds: next.map((d) => d.id) }),
      });
    } catch (err) {
      toast.show((err as Error).message || 'Không lưu được thứ tự.');
      reload();
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await apiRequest(`/documents/${deleting.id}`, { method: 'DELETE' });
      toast.show(`Đã xoá tài liệu "${deleting.title}"`);
      if (editing?.id === deleting.id) setEditing(null);
      setDeleting(null);
      await reload();
    } catch (err) {
      toast.show((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={s.body}>
      <section className={`${s.card} ${s.mainCol} ${s.scroll}`} aria-labelledby="docs-title">
        <div className={s.cardHead}>
          <h2 id="docs-title" className={s.cardTitle}>
            Tài liệu ({docs.length})
          </h2>
        </div>
        {docs.length === 0 ? (
          <EmptyState title="Chưa có tài liệu">Tải lên giáo trình Word hoặc slide PowerPoint cho học viên tải về.</EmptyState>
        ) : (
          <table className={s.table}>
            <thead>
              <tr>
                <th scope="col">Thứ tự</th>
                <th scope="col">Tài liệu</th>
                <th scope="col">Dung lượng</th>
                <th scope="col">Ai tải được</th>
                <th scope="col">
                  <span className="sr-only">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d, i) => {
                const ppt = d.fileType.toLowerCase().startsWith('ppt');
                return (
                  <tr key={d.id}>
                    <td>
                      <span className={s.order}>
                        <Button variant="subtle" size="sm" iconOnly aria-label={`Đưa "${d.title}" lên`} disabled={i === 0} onClick={() => reorder(i, i - 1)}>
                          ↑
                        </Button>
                        <Button
                          variant="subtle"
                          size="sm"
                          iconOnly
                          aria-label={`Đưa "${d.title}" xuống`}
                          disabled={i === docs.length - 1}
                          onClick={() => reorder(i, i + 1)}
                        >
                          ↓
                        </Button>
                      </span>
                    </td>
                    <td>
                      <div className={s.courseCell}>
                        <span className={s.fileType} style={{ background: ppt ? 'var(--prog-yct)' : 'var(--prog-hsk)' }} aria-hidden="true">
                          {ppt ? 'PPT' : 'DOC'}
                        </span>
                        <span>
                          <b>{d.title}</b>
                          <span className={s.rowMeta}>{d.originalFileName}</span>
                        </span>
                      </div>
                    </td>
                    <td className={s.nowrap}>{formatFileSize(d.fileSize)}</td>
                    <td className={s.nowrap}>
                      {d.isFree || course.isFree ? <Badge tone="info">Học thử</Badge> : 'Học viên có quyền'}
                    </td>
                    <td>
                      <span className={s.rowActions}>
                        <Button variant="outline" size="sm" aria-label={`Sửa tài liệu ${d.title}`} onClick={() => setEditing(d)}>
                          Sửa
                        </Button>
                        <Button variant="text" size="sm" aria-label={`Xoá tài liệu ${d.title}`} onClick={() => setDeleting(d)}>
                          Xoá
                        </Button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <DocumentForm
        key={editing?.id ?? 'new'}
        courseId={course.id}
        doc={editing}
        onCancel={() => setEditing(null)}
        onSaved={async (msg) => {
          setEditing(null);
          toast.show(msg);
          await reload();
        }}
      />

      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={`Xoá tài liệu "${deleting?.title ?? ''}"?`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setDeleting(null)}>
              Huỷ
            </Button>
            <Button variant="danger" size="sm" loading={busy} onClick={remove}>
              Xoá tài liệu
            </Button>
          </>
        }
      >
        <p style={{ margin: 0 }}>Học viên sẽ không tải được tài liệu này nữa. Việc này không hoàn tác được.</p>
      </Dialog>
    </div>
  );
}

function DocumentForm({
  courseId,
  doc,
  onCancel,
  onSaved,
}: {
  courseId: string;
  doc: CourseDocumentItem | null;
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const [title, setTitle] = useState(doc?.title ?? '');
  const [description, setDescription] = useState(doc?.description ?? '');
  const [isFree, setIsFree] = useState(doc?.isFree ?? false);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (title.trim().length < 2) return setError('Tên tài liệu tối thiểu 2 ký tự');
    try {
      if (doc) {
        setProgress(100);
        await apiRequest(`/documents/${doc.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ title: title.trim(), description, isFree }),
        });
        onSaved('Đã lưu tài liệu');
      } else {
        if (!file) return setError('Chọn file .doc, .docx, .ppt hoặc .pptx');
        const fd = new FormData();
        fd.append('courseId', courseId);
        fd.append('title', title.trim());
        if (description) fd.append('description', description);
        fd.append('isFree', String(isFree));
        fd.append('file', file);
        setProgress(0);
        await uploadWithProgress('/documents/upload', 'POST', fd, setProgress);
        setTitle('');
        setDescription('');
        setIsFree(false);
        setFile(null);
        setProgress(null);
        onSaved('Đã tải tài liệu lên');
      }
    } catch (err) {
      setError((err as Error).message);
      setProgress(null);
    }
  };

  const busy = progress !== null;
  return (
    <aside className={`${s.card} ${s.panel} ${s.sideCol}`} aria-labelledby="doc-form-title">
      <h2 id="doc-form-title" className={s.cardTitle}>
        {doc ? 'Sửa tài liệu' : 'Thêm tài liệu'}
      </h2>
      <form className={s.form} onSubmit={submit}>
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Tên tài liệu">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Slide bài 4: Số đếm" maxLength={255} />
        </Field>
        {doc ? (
          <p className={s.note}>File: {doc.originalFileName}. Muốn thay file, xoá tài liệu rồi tải lại.</p>
        ) : (
          <FileDrop label="Tệp tài liệu" accept={DOC_ACCEPT} hint=".doc, .docx, .ppt, .pptx" file={file} onFile={setFile} />
        )}
        <Field label="Mô tả (không bắt buộc)">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </Field>
        <Checkbox label="Cho người chưa mua tải (tài liệu học thử)" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} />
        {progress !== null && !doc && (
          <div className={s.progressRow}>
            <ProgressBar value={progress} label="Tiến độ tải lên" />
            <span className={s.note}>Đang tải lên… {progress}%</span>
          </div>
        )}
        <div className={s.formActions}>
          {doc && (
            <Button variant="outline" size="sm" onClick={onCancel} disabled={busy}>
              Huỷ
            </Button>
          )}
          <Button type="submit" variant="ink" size="sm" loading={busy}>
            {doc ? 'Lưu tài liệu' : 'Tải lên'}
          </Button>
        </div>
      </form>
    </aside>
  );
}
