'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { getModuleName } from '@/lib/modules';
import { ProgramModule } from '@/lib/types';

interface MyEnrollment {
  id: string;
  courseId: string;
  canView: boolean;
  course: {
    id: string;
    title: string;
    module: ProgramModule;
    description?: string | null;
    isFree: boolean;
  };
}

const ROLE_NAMES: Record<string, string> = {
  ADMIN: 'Quản trị viên (Admin)',
  TEACHER: 'Giáo viên (Teacher)',
  STUDENT: 'Học sinh (Student)',
};

export default function ProfilePage() {
  const { user, loading, updateProfile, changePassword } = useAuth();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passMsg, setPassMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [savingPass, setSavingPass] = useState(false);

  const [enrollments, setEnrollments] = useState<MyEnrollment[]>([]);

  useEffect(() => {
    if (!user) return;
    setFullName(user.fullName || '');
    setPhone(user.phone || '');
    setBio(user.bio || '');

    if (user.role === 'STUDENT') {
      apiRequest<MyEnrollment[]>('/enrollments/my')
        .then(setEnrollments)
        .catch(() => setEnrollments([]));
    }
  }, [user]);

  if (loading) {
    return <p className="hint">Đang tải thông tin tài khoản...</p>;
  }

  if (!user) {
    return (
      <div className="card" style={{ maxWidth: 480, margin: '12px auto' }}>
        <h3>Bạn chưa đăng nhập</h3>
        <p className="hint">
          Vui lòng đăng nhập để xem và chỉnh sửa thông tin cá nhân của tài khoản.
        </p>
        <Link href="/login" className="btn">
          Đăng nhập
        </Link>
      </div>
    );
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    setSavingProfile(true);
    try {
      await updateProfile({ fullName, phone, bio });
      setProfileMsg({ type: 'success', text: 'Đã lưu thông tin cá nhân thành công!' });
    } catch (err: any) {
      setProfileMsg({ type: 'error', text: err.message || 'Cập nhật thất bại.' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassMsg(null);
    if (newPassword !== confirmPassword) {
      setPassMsg({ type: 'error', text: 'Xác nhận mật khẩu mới không khớp.' });
      return;
    }
    setSavingPass(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPassMsg({ type: 'success', text: 'Đã đổi mật khẩu thành công!' });
    } catch (err: any) {
      setPassMsg({ type: 'error', text: err.message || 'Đổi mật khẩu thất bại.' });
    } finally {
      setSavingPass(false);
    }
  };

  return (
    <>
      <h2 style={{ marginTop: 0 }}>Thông tin cá nhân</h2>
      <p className="hint">
        Phiên đăng nhập của bạn được duy trì an toàn qua HTTP-only Cookie.
      </p>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="row" style={{ marginTop: 0, justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: 0 }}>{user.fullName}</h3>
            <small style={{ color: 'var(--mute)' }}>{user.email}</small>
          </div>
          <span className={`tag role-${user.role.toLowerCase()}`}>
            {ROLE_NAMES[user.role]}
          </span>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        {/* Form cập nhật thông tin cá nhân */}
        <div className="card">
          <h3>Chỉnh sửa hồ sơ</h3>
          {profileMsg && <div className={`alert ${profileMsg.type}`}>{profileMsg.text}</div>}

          <form className="form-grid" onSubmit={handleSaveProfile}>
            <div className="field">
              <label htmlFor="prof-email">Email (không thể thay đổi)</label>
              <input id="prof-email" className="input" value={user.email} disabled />
            </div>

            <div className="field">
              <label htmlFor="prof-name">Họ và tên</label>
              <input
                id="prof-name"
                className="input"
                required
                minLength={2}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="prof-phone">Số điện thoại</label>
              <input
                id="prof-phone"
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="09xxxxxxxx"
              />
            </div>

            <div className="field">
              <label htmlFor="prof-bio">Giới thiệu bản thân / Mục tiêu học tập</label>
              <textarea
                id="prof-bio"
                className="textarea"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Ví dụ: Mục tiêu thi HSK 3 trong năm nay..."
              />
            </div>

            <button type="submit" className="btn" disabled={savingProfile}>
              {savingProfile ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </form>
        </div>

        {/* Form đổi mật khẩu */}
        <div className="card">
          <h3>Đổi mật khẩu</h3>
          {passMsg && <div className={`alert ${passMsg.type}`}>{passMsg.text}</div>}

          <form className="form-grid" onSubmit={handleChangePassword}>
            <div className="field">
              <label htmlFor="curr-pass">Mật khẩu hiện tại</label>
              <input
                id="curr-pass"
                type="password"
                className="input"
                required
                minLength={6}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <div className="field">
              <label htmlFor="new-pass">Mật khẩu mới (tối thiểu 6 ký tự)</label>
              <input
                id="new-pass"
                type="password"
                className="input"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <div className="field">
              <label htmlFor="confirm-pass">Xác nhận mật khẩu mới</label>
              <input
                id="confirm-pass"
                type="password"
                className="input"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <button type="submit" className="btn alt" disabled={savingPass}>
              {savingPass ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
            </button>
          </form>
        </div>
      </div>

      {/* Khóa học đã được cấp quyền (dành cho Học sinh) */}
      {user.role === 'STUDENT' && (
        <div style={{ marginTop: 24 }}>
          <h3>Khóa học bạn đã được cấp quyền ({enrollments.length})</h3>
          {enrollments.length === 0 ? (
            <p className="hint">
              Bạn chưa được giáo viên cấp quyền cho khóa học trả phí nào. Bạn vẫn có thể học các bài giảng miễn phí.
            </p>
          ) : (
            <div className="lessons">
              {enrollments.map((item) => (
                <div className="les" key={item.id}>
                  <div className="t">
                    <b>{item.course.title}</b>
                    <br />
                    <small>{getModuleName(item.course.module)}</small>
                  </div>
                  <span className="tag free">Đã cấp quyền</span>
                  <Link href={`/courses?courseId=${item.courseId}`} className="btn alt sm">
                    Vào học
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
