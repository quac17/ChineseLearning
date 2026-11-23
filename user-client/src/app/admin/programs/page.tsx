'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Alert,
  Badge,
  Button,
  Dialog,
  EmptyState,
  Field,
  Input,
  Skeleton,
  Textarea,
  useToast,
} from '@/components/ui';
import { usePrograms } from '@/context/ModuleContext';
import { apiRequest } from '@/lib/api';
import type { ProgramItem } from '@/lib/types';
import { AdminOnly } from '../AdminOnly';
import s from '../admin.module.css';

interface ProgramFormState {
  code: string;
  name: string;
  han: string;
  cardDesc: string;
  description: string;
  color1: string;
  color2: string;
  sortOrder: string;
}

const EMPTY_FORM: ProgramFormState = {
  code: '',
  name: '',
  han: '',
  cardDesc: '',
  description: '',
  color1: '#0f7c90',
  color2: '#b58a2e',
  sortOrder: '0',
};

export default function AdminProgramsPage() {
  return (
    <AdminOnly>
      <ProgramsManager />
    </AdminOnly>
  );
}

function ProgramsManager() {
  const toast = useToast();
  const { refreshPrograms } = usePrograms();
  const [programs, setPrograms] = useState<ProgramItem[] | null>(null);
  const [error, setError] = useState('');
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [deletingProgram, setDeletingProgram] = useState<ProgramItem | null>(null);
  const [form, setForm] = useState<ProgramFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    try {
      const list = await apiRequest<ProgramItem[]>('/programs');
      setPrograms(list);
      setError('');
    } catch (err) {
      setError((err as Error).message || 'Không tải được danh sách chương trình.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    const nextOrder = (programs?.reduce((max, p) => Math.max(max, p.sortOrder), 0) ?? 0) + 1;
    setForm({ ...EMPTY_FORM, sortOrder: String(nextOrder) });
    setEditingCode(null);
    setFormError('');
    setModalMode('create');
  };

  const openEdit = (p: ProgramItem) => {
    setForm({
      code: p.code,
      name: p.name,
      han: p.han,
      cardDesc: p.cardDesc ?? '',
      description: p.description ?? '',
      color1: p.color1,
      color2: p.color2,
      sortOrder: String(p.sortOrder ?? 0),
    });
    setEditingCode(p.code);
    setFormError('');
    setModalMode('edit');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');

    const sortOrder = Number(form.sortOrder);
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      setFormError('Thứ tự hiển thị phải là số nguyên từ 0 trở lên.');
      return;
    }

    setSubmitting(true);
    try {
      if (modalMode === 'create') {
        await apiRequest<ProgramItem>('/programs', {
          method: 'POST',
          body: JSON.stringify({
            code: form.code.trim().toLowerCase(),
            name: form.name.trim(),
            han: form.han.trim(),
            cardDesc: form.cardDesc.trim() || null,
            description: form.description.trim() || null,
            color1: form.color1.trim(),
            color2: form.color2.trim() || form.color1.trim(),
            sortOrder,
          }),
        });
        toast.show(`Đã thêm chương trình "${form.name.trim()}".`);
      } else if (modalMode === 'edit' && editingCode) {
        await apiRequest<ProgramItem>(`/programs/${encodeURIComponent(editingCode)}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: form.name.trim(),
            han: form.han.trim(),
            cardDesc: form.cardDesc.trim() || null,
            description: form.description.trim() || null,
            color1: form.color1.trim(),
            color2: form.color2.trim() || form.color1.trim(),
            sortOrder,
          }),
        });
        toast.show(`Đã cập nhật chương trình "${form.name.trim()}".`);
      }

      setModalMode(null);
      await Promise.all([load(), refreshPrograms()]);
    } catch (err) {
      setFormError((err as Error).message || 'Không thể lưu chương trình.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingProgram) return;
    setSubmitting(true);
    try {
      await apiRequest(`/programs/${encodeURIComponent(deletingProgram.code)}`, { method: 'DELETE' });
      toast.show(`Đã xoá chương trình "${deletingProgram.name}".`);
      setDeletingProgram(null);
      await Promise.all([load(), refreshPrograms()]);
    } catch (err) {
      toast.show((err as Error).message || 'Không thể xoá chương trình.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div>
          <h1 className={s.title}>Chương trình học</h1>
          <p className={s.sub}>
            Thêm, sửa, xoá các chương trình hiển thị trong bộ lọc, trang chủ và form tạo khoá học.
          </p>
        </div>
        <Button onClick={openCreate}>+ Thêm chương trình</Button>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {!programs && !error ? (
        <div className={s.card}>
          <Skeleton height={220} />
        </div>
      ) : programs && programs.length === 0 ? (
        <EmptyState title="Chưa có chương trình học">
          Nhấn Thêm chương trình để tạo chương trình đầu tiên.
        </EmptyState>
      ) : (
        <div className={`${s.card} ${s.tableWrap}`}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Thứ tự</th>
                <th>Mã</th>
                <th>Tên chương trình</th>
                <th>Chữ Hán &amp; Màu</th>
                <th>Mô tả ngắn</th>
                <th>Số khoá học</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {(programs ?? []).map((p) => {
                const count = p.courseCount ?? 0;
                return (
                  <tr key={p.code}>
                    <td className={s.num}>{p.sortOrder}</td>
                    <td className={s.nowrap}>
                      <code>{p.code}</code>
                    </td>
                    <td>
                      <strong>{p.name}</strong>
                    </td>
                    <td className={s.nowrap}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <span
                          className="han"
                          style={{
                            display: 'inline-grid',
                            placeItems: 'center',
                            width: 28,
                            height: 28,
                            borderRadius: 6,
                            background: p.color1,
                            color: '#fff',
                            fontWeight: 600,
                          }}
                        >
                          {p.han}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{p.color1}</span>
                      </span>
                    </td>
                    <td>{p.cardDesc || <span style={{ color: 'var(--muted)' }}>–</span>}</td>
                    <td className={s.num}>
                      <Badge tone={count > 0 ? 'info' : 'neutral'}>{count} khoá</Badge>
                    </td>
                    <td className={s.nowrap}>
                      <div style={{ display: 'inline-flex', gap: 8 }}>
                        <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                          Sửa
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={count > 0}
                          title={count > 0 ? 'Không thể xoá chương trình đang có khoá học' : 'Xoá chương trình'}
                          onClick={() => setDeletingProgram(p)}
                        >
                          Xoá
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={modalMode !== null}
        onClose={() => !submitting && setModalMode(null)}
        title={modalMode === 'create' ? 'Thêm chương trình học' : `Sửa chương trình: ${editingCode}`}
      >
        <form className="form-grid" onSubmit={handleSubmit}>
          {formError && <Alert tone="error">{formError}</Alert>}

          {modalMode === 'create' && (
            <Field
              label="Mã chương trình"
              hint="2–20 ký tự chữ thường, số, gạch ngang hoặc gạch dưới (ví dụ: tocfl, business)"
            >
              <Input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="tocfl"
                required
              />
            </Field>
          )}

          <Field label="Tên chương trình">
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ví dụ: TOCFL"
              required
            />
          </Field>

          <Field label="Chữ Hán đại diện" hint="1–2 chữ Hán hiển thị trên ảnh bìa khoá học">
            <Input
              value={form.han}
              onChange={(e) => setForm((f) => ({ ...f, han: e.target.value }))}
              placeholder="Ví dụ: 華"
              required
            />
          </Field>

          <Field label="Mô tả ngắn (thẻ)">
            <Input
              value={form.cardDesc}
              onChange={(e) => setForm((f) => ({ ...f, cardDesc: e.target.value }))}
              placeholder="Chứng chỉ năng lực Hoa ngữ Đài Loan"
            />
          </Field>

          <Field label="Mô tả chi tiết">
            <Textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Giới thiệu ngắn về lộ trình của chương trình này"
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Màu chính (Hex)">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="color"
                  aria-label="Chọn màu chính"
                  value={/^#[0-9a-fA-F]{6}$/.test(form.color1) ? form.color1 : '#0f7c90'}
                  onChange={(e) => setForm((f) => ({ ...f, color1: e.target.value }))}
                  style={{ width: 40, height: 36, padding: 2, borderRadius: 6, border: '1px solid var(--border)' }}
                />
                <Input
                  value={form.color1}
                  onChange={(e) => setForm((f) => ({ ...f, color1: e.target.value }))}
                  required
                />
              </div>
            </Field>

            <Field label="Màu phụ (Hex)">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="color"
                  aria-label="Chọn màu phụ"
                  value={/^#[0-9a-fA-F]{6}$/.test(form.color2) ? form.color2 : '#b58a2e'}
                  onChange={(e) => setForm((f) => ({ ...f, color2: e.target.value }))}
                  style={{ width: 40, height: 36, padding: 2, borderRadius: 6, border: '1px solid var(--border)' }}
                />
                <Input
                  value={form.color2}
                  onChange={(e) => setForm((f) => ({ ...f, color2: e.target.value }))}
                />
              </div>
            </Field>
          </div>

          <Field label="Thứ tự hiển thị">
            <Input
              type="number"
              min={0}
              value={form.sortOrder}
              onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
              required
            />
          </Field>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <Button type="button" variant="outline" disabled={submitting} onClick={() => setModalMode(null)}>
              Huỷ
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Đang lưu...' : modalMode === 'create' ? 'Tạo chương trình' : 'Lưu thay đổi'}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={deletingProgram !== null}
        onClose={() => !submitting && setDeletingProgram(null)}
        title="Xác nhận xoá chương trình"
      >
        <p>
          Bạn có chắc muốn xoá chương trình <strong>{deletingProgram?.name}</strong> (<code>{deletingProgram?.code}</code>)?
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <Button type="button" variant="outline" disabled={submitting} onClick={() => setDeletingProgram(null)}>
            Huỷ
          </Button>
          <Button type="button" variant="danger" disabled={submitting} onClick={handleDelete}>
            {submitting ? 'Đang xoá...' : 'Xoá chương trình'}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
