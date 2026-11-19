'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register(fullName, email, password);
      router.push('/courses');
    } catch (err: any) {
      setError(err.message || 'Đăng ký thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 460, margin: '12px auto' }}>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Đăng ký tài khoản Học sinh</h2>
        <p className="hint">
          Tài khoản mới sẽ có vai trò Học sinh. Giáo viên có thể cấp quyền xem khóa học cho bạn ngay sau khi đăng ký.
        </p>

        {error && <div className="alert error">{error}</div>}

        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="fullName">Họ và tên</label>
            <input
              id="fullName"
              type="text"
              className="input"
              required
              minLength={2}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nguyễn Minh Anh"
            />
          </div>

          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="input"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="hocsinh@example.com"
            />
          </div>

          <div className="field">
            <label htmlFor="password">Mật khẩu (tối thiểu 6 ký tự)</label>
            <input
              id="password"
              type="password"
              className="input"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button type="submit" className="btn" disabled={submitting}>
            {submitting ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
          </button>
        </form>

        <p style={{ fontSize: 14, marginTop: 14 }}>
          Đã có tài khoản?{' '}
          <Link href="/login" style={{ color: 'var(--red)', fontWeight: 600 }}>
            Đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
}
