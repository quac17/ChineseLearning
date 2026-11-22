'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Alert, EmptyState, Select, Skeleton } from '@/components/ui';
import { apiRequest } from '@/lib/api';
import { formatVnd } from '@/lib/programs';
import type { AdminDashboardStats, StatsPeriod } from '@/lib/types';
import { AdminOnly } from './AdminOnly';
import s from './admin.module.css';

const PERIODS: Record<StatsPeriod, string> = {
  '30d': '30 ngày qua',
  month: 'Tháng này',
  year: 'Năm nay',
};

const count = (n: number) => new Intl.NumberFormat('vi-VN').format(n);

/** "2026-11-05" → "05/11" (day bars) or "11/2026" (month bars). */
function bucketLabel(start: string, bucket: 'day' | 'month') {
  const [y, m, d] = start.split('-');
  return bucket === 'day' ? `${d}/${m}` : `${m}/${y}`;
}

export default function AdminStatsPage() {
  return (
    <AdminOnly>
      <Stats />
    </AdminOnly>
  );
}

function Stats() {
  const [period, setPeriod] = useState<StatsPeriod>('30d');
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError('');
    apiRequest<AdminDashboardStats>(`/admin/stats?period=${period}`)
      .then((d) => !cancelled && setStats(d))
      .catch((err: Error) => !cancelled && setError(err.message || 'Không tải được thống kê.'));
    return () => {
      cancelled = true;
    };
  }, [period]);

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div>
          <h1 className={s.title}>Thống kê</h1>
          <p className={s.sub}>Mọi số liệu đếm trực tiếp từ cơ sở dữ liệu, không ước tính.</p>
        </div>
        <div className={s.filters}>
          <label htmlFor="stats-period" className="sr-only">
            Khoảng thời gian
          </label>
          <Select id="stats-period" value={period} onChange={(e) => setPeriod(e.target.value as StatsPeriod)}>
            {(Object.keys(PERIODS) as StatsPeriod[]).map((p) => (
              <option key={p} value={p}>
                {PERIODS[p]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {!stats ? (
        !error && (
          <div className={s.kpis} aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={`${s.card} ${s.kpi}`}>
                <Skeleton height={86} />
              </div>
            ))}
          </div>
        )
      ) : (
        <StatsBody stats={stats} periodLabel={PERIODS[stats.period].toLowerCase()} />
      )}
    </div>
  );
}

function Kpi({ label, value, note, testId }: { label: string; value: string; note: string; testId: string }) {
  return (
    <div className={`${s.card} ${s.kpi}`} data-testid={testId}>
      <span className={s.kpiLabel}>{label}</span>
      <p className={s.kpiValue}>{value}</p>
      <span className={s.kpiNote}>{note}</span>
    </div>
  );
}

function StatsBody({ stats, periodLabel }: { stats: AdminDashboardStats; periodLabel: string }) {
  const { users, courses, enrollments, orders, revenueSeries, topCourses } = stats;
  const attention = [
    orders.needsReview > 0 && {
      text: `${count(orders.needsReview)} đơn có khoản tiền chưa khớp, cần kiểm tra`,
      href: '/admin/orders',
      action: 'Xem đơn',
    },
    ...courses.unpriced.map((c) => ({
      text: `Khoá “${c.title}” chưa có giá`,
      href: '/admin/courses',
      action: 'Đặt giá',
    })),
  ].filter(Boolean) as Array<{ text: string; href: string; action: string }>;

  return (
    <>
      <div className={s.kpis}>
        <Kpi
          testId="kpi-revenue"
          label="Doanh thu"
          value={formatVnd(orders.revenueVnd)}
          note={`đơn đã thanh toán, ${periodLabel}`}
        />
        <Kpi
          testId="kpi-paid"
          label="Đơn đã thanh toán"
          value={count(orders.paid)}
          note={`${count(orders.expired)} đơn hết hạn${orders.refunded ? ` · ${count(orders.refunded)} hoàn tiền` : ''}`}
        />
        <Kpi
          testId="kpi-new-users"
          label="Tài khoản mới"
          value={count(users.newInPeriod)}
          note={`tổng ${count(users.total)} tài khoản`}
        />
        <Kpi
          testId="kpi-enrollments"
          label="Quyền xem đang mở"
          value={count(enrollments.open)}
          note={`${count(enrollments.purchased)} mua · ${count(enrollments.manual)} cấp tay`}
        />
      </div>

      <div className={s.kpis}>
        <Kpi
          testId="kpi-users"
          label="Người dùng"
          value={count(users.total)}
          note={`${count(users.admins)} admin · ${count(users.teachers)} giáo viên · ${count(users.students)} học viên${
            users.locked ? ` · ${count(users.locked)} đã khoá` : ''
          }`}
        />
        <Kpi
          testId="kpi-courses"
          label="Khoá học"
          value={count(courses.total)}
          note={`${count(courses.published)} đang hiển thị`}
        />
        <Kpi testId="kpi-lessons" label="Bài giảng" value={count(courses.lessons)} note="video YouTube và tải lên" />
        <Kpi testId="kpi-documents" label="Tài liệu" value={count(courses.documents)} note="tệp tải về của các khoá" />
      </div>

      <RevenueChart series={revenueSeries} periodLabel={periodLabel} />

      <div className={s.twoCol}>
        <section className={`${s.card} ${s.panel}`} aria-labelledby="top-courses">
          <h2 id="top-courses" className={s.panelTitle}>
            Khoá bán chạy
          </h2>
          {topCourses.length === 0 ? (
            <p className={s.note}>Chưa có đơn nào được thanh toán trong {periodLabel}.</p>
          ) : (
            <table className={s.table}>
              <thead>
                <tr>
                  <th scope="col">Khoá học</th>
                  <th scope="col">Đơn</th>
                  <th scope="col">Doanh thu</th>
                </tr>
              </thead>
              <tbody>
                {topCourses.map((c) => (
                  <tr key={c.courseId ?? c.title}>
                    <td>{c.title}</td>
                    <td>{count(c.orders)}</td>
                    <td className={s.nowrap}>{formatVnd(c.revenueVnd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className={`${s.card} ${s.panel}`} aria-labelledby="attention">
          <h2 id="attention" className={s.panelTitle}>
            Cần xử lý
          </h2>
          {attention.length === 0 ? (
            <p className={s.note}>Không có việc gì cần xử lý.</p>
          ) : (
            <ul className={s.todo}>
              {attention.map((a) => (
                <li key={a.text}>
                  <span>{a.text}</span>
                  <Link href={a.href}>{a.action}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function RevenueChart({
  series,
  periodLabel,
}: {
  series: AdminDashboardStats['revenueSeries'];
  periodLabel: string;
}) {
  const max = Math.max(0, ...series.points.map((p) => p.revenueVnd));
  const unit = series.bucket === 'day' ? 'ngày' : 'tháng';
  return (
    <section className={`${s.card} ${s.panel}`} aria-labelledby="revenue-chart">
      <h2 id="revenue-chart" className={s.panelTitle}>
        Doanh thu theo {unit}
      </h2>
      {max === 0 ? (
        <EmptyState title="Chưa có doanh thu">Chưa có đơn nào được thanh toán trong {periodLabel}.</EmptyState>
      ) : (
        <>
          <p className={s.note}>Di chuột vào cột để xem số. Cột cao nhất: {formatVnd(max)}.</p>
          <div className={s.chart} aria-hidden="true">
            {series.points.map((p) => {
              const label = `${bucketLabel(p.start, series.bucket)}: ${formatVnd(p.revenueVnd)} · ${count(p.orders)} đơn`;
              return (
                <div key={p.start} className={s.barSlot} title={label}>
                  <span className={s.bar} style={{ height: `${(p.revenueVnd / max) * 100}%` }} />
                </div>
              );
            })}
          </div>
          <div className={s.chartAxis} aria-hidden="true">
            <span>{bucketLabel(series.points[0].start, series.bucket)}</span>
            <span>{bucketLabel(series.points[series.points.length - 1].start, series.bucket)}</span>
          </div>
          <table className="sr-only">
            <caption>Doanh thu theo {unit}</caption>
            <thead>
              <tr>
                <th scope="col">{unit === 'ngày' ? 'Ngày' : 'Tháng'}</th>
                <th scope="col">Doanh thu</th>
                <th scope="col">Đơn</th>
              </tr>
            </thead>
            <tbody>
              {series.points
                .filter((p) => p.orders > 0)
                .map((p) => (
                  <tr key={p.start}>
                    <td>{bucketLabel(p.start, series.bucket)}</td>
                    <td>{formatVnd(p.revenueVnd)}</td>
                    <td>{count(p.orders)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
