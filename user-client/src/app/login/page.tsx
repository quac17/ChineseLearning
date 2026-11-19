'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@vankinh.vn', pass: 'Admin@123' },
  { label: 'Giáo viên', email: 'teacher@vankinh.vn', pass: 'Teacher@123' },
  { label: 'Học sinh A (Có quyền HSK 1)', email: 'studentA@vankinh.vn', pass: 'Student@123' },
  { label: 'Học sinh B (Chưa cấp quyền)', email: 'studentB@vankinh.vn', pass: 'Student@123' },
];

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const u = await login(email, password);
      if (u.role === 'ADMIN') router.push('/admin');
      else if (u.role === 'TEACHER') router.push('/teacher');
      else router.push('/courses');
    } catch (err: any) {
      setError(err.message || 'Đăng nhập thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: '12px auto' }}>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Đăng nhập Vân Kính</h2>
        <p className="hint">
          Đăng nhập để xem khóa học được cấp quyền, tải tài liệu hoặc quản trị hệ thống.
        </p>

        {error && <div className="alert error">{error}</div>}

        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="input"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@vankinh.vn"
            />
          </div>

          <div className="field">
            <label htmlFor="password">Mật khẩu</label>
            <input
              id="password"
              type="password"
              className="input"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button type="submit" className="btn" disabled={submitting}>
            {submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        <p style={{ fontSize: 14, marginTop: 14 }}>
          Chưa có tài khoản học sinh?{' '}
          <Link href="/register" style={{ color: 'var(--red)', fontWeight: 600 }}>
            Đăng ký ngay
          </Link>
        </p>

        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
          <small style={{ color: 'var(--mute)', display: 'block', marginBottom: 8 }}>
            Tài khoản mẫu (nhấn để điền nhanh):
          </small>
          <div className="row" style={{ marginTop: 0 }}>
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                className="btn alt sm"
                onClick={() => {
                  setEmail(acc.email);
                  setPassword(acc.pass);
                }}
              >
                {acc.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
