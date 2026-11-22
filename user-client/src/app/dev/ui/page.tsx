'use client';

import { notFound } from 'next/navigation';
import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  CourseCard,
  Dialog,
  EmptyState,
  Field,
  Input,
  LinkButton,
  ProgramBadge,
  ProgressBar,
  Radio,
  Rating,
  SearchInput,
  Select,
  Skeleton,
  Switch,
  Tabs,
  Textarea,
  useToast,
} from '@/components/ui';

/**
 * Dev-only gallery of src/components/ui, to compare with
 * docs/design/canvas/Main.dc.html. Not available in production builds.
 */
export default function UiGallery() {
  const [tab, setTab] = useState<'overview' | 'qa' | 'notes'>('overview');
  const [seg, setSeg] = useState<'all' | 'doing' | 'done'>('all');
  const [on, setOn] = useState(true);
  const [open, setOpen] = useState(false);
  const toast = useToast();

  if (process.env.NODE_ENV === 'production') notFound();

  const section = { display: 'flex', flexDirection: 'column' as const, gap: 16, padding: '28px 0', borderTop: '1px solid var(--line)' };
  const row = { display: 'flex', flexWrap: 'wrap' as const, gap: 12, alignItems: 'center' };

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '8px 0 40px' }}>
      <h1>UI kit</h1>
      <p style={{ color: 'var(--muted)', marginTop: 8 }}>So sánh với bảng “Hệ thống thiết kế” trong docs/design/canvas/Main.dc.html. Bật chế độ tối bằng nút trên header.</p>

      <section style={section} aria-labelledby="b">
        <h2 id="b">Nút</h2>
        <div style={row}>
          <Button variant="accent">Mua ngay bằng QR</Button>
          <Button variant="ink">Đăng ký</Button>
          <Button variant="outline">Xem bài học thử</Button>
          <Button variant="subtle">Phụ</Button>
          <Button variant="text">Xem tất cả</Button>
          <Button variant="danger">Thu hồi</Button>
          <Button disabled>Hết hạn</Button>
          <Button variant="accent" loading>
            Đang xử lý
          </Button>
          <Button size="sm">Nhỏ 40</Button>
          <Button variant="accent" size="lg">
            Lớn 56
          </Button>
          <LinkButton href="/courses" variant="outline">
            Link dạng nút
          </LinkButton>
        </div>
      </section>

      <section style={section} aria-labelledby="f">
        <h2 id="f">Ô nhập</h2>
        <SearchInput label="Tìm khoá học" placeholder="Tìm khoá học: HSK 1, YCT, giao tiếp…" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          <Field label="Email" hint="Dùng để đăng nhập">
            <Input type="email" placeholder="ban@email.com" />
          </Field>
          <Field label="Mật khẩu" error="Tối thiểu 8 ký tự, có chữ và số.">
            <Input type="password" defaultValue="abc" />
          </Field>
          <Field label="Sắp xếp">
            <Select defaultValue="pop">
              <option value="pop">Phổ biến nhất</option>
              <option value="new">Mới nhất</option>
            </Select>
          </Field>
          <Field label="Mã giới thiệu">
            <Input disabled defaultValue="Không áp dụng" />
          </Field>
        </div>
        <Field label="Ghi chú bài học">
          <Textarea defaultValue="Thanh 3 xuống rồi lên." />
        </Field>
      </section>

      <section style={section} aria-labelledby="c">
        <h2 id="c">Lựa chọn</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
            <legend style={{ fontWeight: 700, fontSize: 14 }}>Cấp độ</legend>
            <Radio name="lv" label="Mọi cấp độ" defaultChecked />
            <Radio name="lv" label="Mới bắt đầu" />
          </fieldset>
          <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
            <legend style={{ fontWeight: 700, fontSize: 14 }}>Chương trình</legend>
            <Checkbox label="HSK" defaultChecked />
            <Checkbox label="YCT" />
          </fieldset>
          <div>
            <Switch label="Nhắc ôn tập mỗi ngày" checked={on} onChange={setOn} />
          </div>
        </div>
      </section>

      <section style={section} aria-labelledby="t">
        <h2 id="t">Tab, nhãn, đánh giá, tiến độ</h2>
        <Tabs
          label="Nội dung"
          value={tab}
          onChange={setTab}
          items={[
            { id: 'overview', label: 'Tổng quan' },
            { id: 'qa', label: 'Hỏi đáp' },
            { id: 'notes', label: 'Ghi chú' },
          ]}
        />
        <div>
          <Tabs
            label="Lọc"
            variant="segmented"
            idPrefix="seg"
            value={seg}
            onChange={setSeg}
            items={[
              { id: 'all', label: 'Tất cả' },
              { id: 'doing', label: 'Đang học' },
              { id: 'done', label: 'Đã xong' },
            ]}
          />
        </div>
        <div style={row}>
          <Badge tone="featured">Nổi bật</Badge>
          <Badge tone="new">Mới</Badge>
          <Badge tone="preview">Học thử</Badge>
          <Badge tone="owned">Đã mua</Badge>
          <Badge tone="neutral">Bản nháp</Badge>
          <Badge tone="backend">Cần backend</Badge>
          <ProgramBadge program="easy" />
          <ProgramBadge program="yct" />
          <ProgramBadge program="hsk" />
          <ProgramBadge program="talk" />
        </div>
        <Rating value={4.5} source="khảo sát 120 học viên lớp offline 2025" />
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Rating không có nguồn sẽ không hiển thị gì: [<Rating value={4.8} source="" />]</p>
        <div style={{ maxWidth: 420 }}>
          <ProgressBar value={40} label="Tiến độ khoá HSK 1" />
        </div>
      </section>

      <section style={section} aria-labelledby="a">
        <h2 id="a">Thông báo, hộp thoại, toast</h2>
        <Alert tone="success" title="Thanh toán thành công.">
          Khoá HSK 1 đã có trong khoá học của bạn.
        </Alert>
        <Alert tone="error" title="Chưa thanh toán được.">
          Mã QR đã hết hạn, hãy tạo mã mới.
        </Alert>
        <Alert tone="warning" title="Sắp hết hạn.">
          Quyền xem còn 3 ngày.
        </Alert>
        <div style={row}>
          <Button variant="outline" onClick={() => setOpen(true)}>
            Mở hộp thoại
          </Button>
          <Button variant="outline" onClick={() => toast.show('Đã lưu ghi chú', { actionLabel: 'Hoàn tác' })}>
            Hiện toast
          </Button>
        </div>
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          title="Thu hồi quyền của Nguyễn Lan?"
          actions={
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Huỷ
              </Button>
              <Button variant="danger" onClick={() => setOpen(false)}>
                Thu hồi quyền
              </Button>
            </>
          }
        >
          <p>Học viên này đã mua khoá. Thu hồi sẽ khoá các bài trả phí ngay lập tức.</p>
        </Dialog>
      </section>

      <section style={section} aria-labelledby="k">
        <h2 id="k">Thẻ khoá học, khung xương, trống</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          <CourseCard href="/courses" title="HSK 1: nền tảng và 150 từ vựng" program="hsk" coverHan="一" teacherName="Cô Ngân" priceVnd={499000} ratingValue={4.5} ratingSource="khảo sát offline 2025" featured />
          <CourseCard href="/courses" title="Easy Steps: tiếng Trung bước đầu" program="easy" teacherName="Cô Ngân" isFree />
          <CourseCard href="/courses" title="YCT 1: tiếng Trung thiếu nhi" program="yct" teacherName="Cô Ngân" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton height={124} />
            <Skeleton width="90%" />
            <Skeleton width="60%" height={12} />
          </div>
        </div>
        <EmptyState title="Không có khoá học nào khớp" action={<Button variant="outline">Xoá bộ lọc</Button>}>
          Thử bỏ bớt bộ lọc, hoặc tìm bằng từ khác như “HSK 1”.
        </EmptyState>
      </section>
    </div>
  );
}
