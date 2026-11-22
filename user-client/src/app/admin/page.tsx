'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { AdminStats, Role, User } from '@/lib/types';

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  // Create user form
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('TEACHER');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [uList, st] = await Promise.all([
        apiRequest<User[]>('/users'),
        apiRequest<AdminStats>('/users/stats'),
      ]);
      setUsers(uList);
      setStats(st);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Không thể tải dữ liệu quản trị.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user?.role === 'ADMIN') {
      loadData();
    }
  }, [authLoading, user, loadData]);

  if (authLoading) {
    return <p className="hint">Đang kiểm tra quyền quản trị...</p>;
  }

  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="card">
        <h3>Khu vực chỉ dành cho Quản trị viên (Admin)</h3>
        <p className="hint">Vui lòng đăng nhập bằng tài khoản Admin.</p>
        <Link href="/login" className="btn">
          Đăng nhập
        </Link>
      </div>
    );
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await apiRequest('/users', {
        method: 'POST',
        body: JSON.stringify({ fullName, email, password, role }),
      });
      setFullName('');
      setEmail('');
      setPassword('');
      await loadData();
      setMessage({ type: 'success', text: 'Đã tạo tài khoản người dùng mới.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const handleChangeRole = async (id: string, nextRole: Role) => {
    setBusy(true);
    setMessage(null);
    try {
      await apiRequest(`/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: nextRole }),
      });
      await loadData();
      setMessage({ type: 'success', text: 'Đã cập nhật vai trò người dùng.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const handleToggleActive = async (target: User) => {
    setBusy(true);
    setMessage(null);
    try {
      await apiRequest(`/users/${target.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !target.isActive }),
      });
      await loadData();
      setMessage({
        type: 'success',
        text: target.isActive ? 'Đã khóa tài khoản.' : 'Đã mở khóa tài khoản.',
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteUser = async (target: User) => {
    if (!confirm(`Xóa vĩnh viễn tài khoản ${target.email}?`)) return;
    setBusy(true);
    setMessage(null);
    try {
      await apiRequest(`/users/${target.id}`, { method: 'DELETE' });
      await loadData();
      setMessage({ type: 'success', text: 'Đã xóa tài khoản.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="row" style={{ marginTop: 0, justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>Bảng điều khiển Quản trị (Admin)</h2>
      </div>
      <p className="hint">
        Quản lý 3 vai trò Admin, Giáo viên, Học sinh và theo dõi tổng quan hệ thống.
      </p>

      {message && <div className={`alert ${message.type}`}>{message.text}</div>}

      {stats && (
        <div className="grid" style={{ marginBottom: 20 }}>
          <div className="stat-card">
            <small>Tổng tài khoản</small>
            <strong>{stats.totalUsers}</strong>
            <small>
              {stats.admins} Admin · {stats.teachers} GV · {stats.students} HS
            </small>
          </div>
          <div className="stat-card">
            <small>Khóa học</small>
            <strong>{stats.courses}</strong>
            <small>{stats.activeEnrollments} lượt cấp quyền học sinh</small>
          </div>
          <div className="stat-card">
            <small>Bài giảng Video</small>
            <strong>{stats.lessons}</strong>
            <small>YouTube & Kho lưu trữ</small>
          </div>
          <div className="stat-card">
            <small>Tài liệu DOC / PPT</small>
            <strong>{stats.documents}</strong>
            <small>Tài liệu học tập tải về</small>
          </div>
        </div>
      )}

      <div className="split-layout">
        <div className="card">
          <h3>Tạo tài khoản mới</h3>
          <form className="form-grid" onSubmit={handleCreateUser}>
            <div className="field">
              <label>Họ và tên</label>
              <input
                className="input"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nguyễn Thị Lan"
              />
            </div>
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                className="input"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="giaovien2@chineselearner.vn"
              />
            </div>
            <div className="field">
              <label>Mật khẩu</label>
              <input
                type="password"
                className="input"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tối thiểu 6 ký tự"
              />
            </div>
            <div className="field">
              <label>Vai trò (Role)</label>
              <select
                className="select"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                <option value="STUDENT">Học sinh (STUDENT)</option>
                <option value="TEACHER">Giáo viên (TEACHER)</option>
                <option value="ADMIN">Quản trị viên (ADMIN)</option>
              </select>
            </div>
            <button type="submit" className="btn" disabled={busy}>
              Tạo tài khoản
            </button>
          </form>
        </div>

        <div className="table-wrap">
          {loading ? (
            <p className="hint" style={{ padding: 14 }}>
              Đang tải danh sách người dùng...
            </p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Họ tên & Email</th>
                  <th>Vai trò</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = u.id === user.id;
                  return (
                    <tr key={u.id}>
                      <td>
                        <b>{u.fullName}</b>
                        <br />
                        <small style={{ color: 'var(--mute)' }}>{u.email}</small>
                      </td>
                      <td>
                        <select
                          className="select"
                          style={{ width: 'auto', padding: '5px 8px' }}
                          value={u.role}
                          disabled={busy || isSelf}
                          onChange={(e) => handleChangeRole(u.id, e.target.value as Role)}
                        >
                          <option value="STUDENT">Học sinh</option>
                          <option value="TEACHER">Giáo viên</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                      </td>
                      <td>
                        <span className={`tag ${u.isActive ? 'free' : 'paid'}`}>
                          {u.isActive ? 'Hoạt động' : 'Đã khóa'}
                        </span>
                      </td>
                      <td>
                        <div className="row" style={{ marginTop: 0 }}>
                          <button
                            type="button"
                            className="btn alt sm"
                            disabled={busy || isSelf}
                            onClick={() => handleToggleActive(u)}
                          >
                            {u.isActive ? 'Khóa' : 'Mở khóa'}
                          </button>
                          <button
                            type="button"
                            className="btn danger sm"
                            disabled={busy || isSelf}
                            onClick={() => handleDeleteUser(u)}
                          >
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
