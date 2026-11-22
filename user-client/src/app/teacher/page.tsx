'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { apiRequest, buildMediaUrl, formatFileSize } from '@/lib/api';
import { getModuleName, PROGRAM_MODULES } from '@/lib/modules';
import {
  CourseDocumentItem,
  CourseItem,
  CourseStudentAccess,
  LessonItem,
  ProgramModule,
} from '@/lib/types';

type TeacherTab = 'courses' | 'videos' | 'documents' | 'access';

function reorderArray<T extends { id: string }>(
  list: T[],
  fromId: string,
  toId: string,
): T[] {
  const fromIdx = list.findIndex((item) => item.id === fromId);
  const toIdx = list.findIndex((item) => item.id === toId);
  if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return list;
  const copy = [...list];
  const [moved] = copy.splice(fromIdx, 1);
  copy.splice(toIdx, 0, moved);
  return copy;
}

export default function TeacherPage() {
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<TeacherTab>('courses');
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');

  // Tab 4: Granted students & Search
  const [grantedStudents, setGrantedStudents] = useState<CourseStudentAccess[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CourseStudentAccess[]>([]);
  const [searching, setSearching] = useState(false);
  const searchQueryRef = useRef('');
  const lastRequestedQueryRef = useRef('');

  // Drag & drop state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  // Course form (create / edit)
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [courseTitle, setCourseTitle] = useState('');
  const [courseDesc, setCourseDesc] = useState('');
  const [courseModule, setCourseModule] = useState<ProgramModule>('hsk');
  const [courseFree, setCourseFree] = useState(false);

  // Video form (create / edit)
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [videoMode, setVideoMode] = useState<'KEEP' | 'YOUTUBE' | 'UPLOAD'>('YOUTUBE');
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDesc, setVideoDesc] = useState('');
  const [videoDuration, setVideoDuration] = useState('');
  const [videoFree, setVideoFree] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const videoFileInputRef = useRef<HTMLInputElement | null>(null);

  // Document form (create / edit)
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [docTitle, setDocTitle] = useState('');
  const [docDesc, setDocDesc] = useState('');
  const [docFree, setDocFree] = useState(false);
  const [docFile, setDocFile] = useState<File | null>(null);
  const docFileInputRef = useRef<HTMLInputElement | null>(null);

  const notify = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
  };

  const loadCourses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<CourseItem[]>('/courses/manage');
      setCourses(data);
      setSelectedCourseId((prev) =>
        data.some((c) => c.id === prev) ? prev : data[0]?.id || '',
      );
    } catch (err: any) {
      notify('error', err.message || 'Không thể tải danh sách khóa học.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadGrantedStudents = useCallback(async (courseId: string) => {
    if (!courseId) {
      setGrantedStudents([]);
      return;
    }
    try {
      const data = await apiRequest<CourseStudentAccess[]>(
        `/enrollments/course/${courseId}`,
      );
      setGrantedStudents(data);
    } catch (err: any) {
      notify('error', err.message || 'Không thể tải danh sách học sinh đã cấp quyền.');
    }
  }, []);

  const executeStudentSearch = useCallback(
    async (courseId: string, query: string) => {
      const trimmed = query.trim();
      if (!courseId || trimmed.length < 2) {
        setSearchResults([]);
        lastRequestedQueryRef.current = '';
        return;
      }
      setSearching(true);
      lastRequestedQueryRef.current = trimmed;
      try {
        const data = await apiRequest<CourseStudentAccess[]>(
          `/enrollments/course/${courseId}/search-students?q=${encodeURIComponent(trimmed)}`,
        );
        setSearchResults(data);
      } catch (err: any) {
        notify('error', err.message || 'Tìm kiếm học sinh thất bại.');
      } finally {
        setSearching(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!authLoading && user && (user.role === 'TEACHER' || user.role === 'ADMIN')) {
      loadCourses();
    }
  }, [authLoading, user, loadCourses]);

  useEffect(() => {
    if (selectedCourseId) {
      loadGrantedStudents(selectedCourseId);
      setSearchQuery('');
      searchQueryRef.current = '';
      lastRequestedQueryRef.current = '';
      setSearchResults([]);
    }
  }, [selectedCourseId, loadGrantedStudents]);

  // Search logic: bắt đầu tìm khi >= 2 ký tự, tự động re-request mỗi 5s nếu nội dung tìm kiếm thay đổi
  useEffect(() => {
    searchQueryRef.current = searchQuery;
    const trimmed = searchQuery.trim();

    if (trimmed.length < 2) {
      setSearchResults([]);
      lastRequestedQueryRef.current = '';
      return;
    }

    // Lần đầu đạt >= 2 ký tự -> search ngay
    if (lastRequestedQueryRef.current === '' && selectedCourseId) {
      executeStudentSearch(selectedCourseId, trimmed);
    }
  }, [searchQuery, selectedCourseId, executeStudentSearch]);

  useEffect(() => {
    if (tab !== 'access' || !selectedCourseId) return;
    const intervalId = setInterval(() => {
      const current = searchQueryRef.current.trim();
      if (current.length >= 2 && current !== lastRequestedQueryRef.current) {
        executeStudentSearch(selectedCourseId, current);
      }
    }, 5000);
    return () => clearInterval(intervalId);
  }, [tab, selectedCourseId, executeStudentSearch]);

  if (authLoading) {
    return <p className="hint">Đang kiểm tra quyền truy cập...</p>;
  }

  if (!user || (user.role !== 'TEACHER' && user.role !== 'ADMIN')) {
    return (
      <div className="card">
        <h3>Khu vực dành cho Giáo viên & Quản trị viên</h3>
        <p className="hint">
          Vui lòng đăng nhập bằng tài khoản Giáo viên hoặc Admin để quản lý khóa học, tải video/tài liệu và cấp quyền cho học sinh.
        </p>
        <Link href="/login" className="btn">
          Đăng nhập
        </Link>
      </div>
    );
  }

  const selectedCourse = courses.find((c) => c.id === selectedCourseId) || null;

  // ===== Course CRUD & Reorder =====
  const resetCourseForm = () => {
    setEditingCourseId(null);
    setCourseTitle('');
    setCourseDesc('');
    setCourseModule('hsk');
    setCourseFree(false);
  };

  const startEditCourse = (c: CourseItem) => {
    setEditingCourseId(c.id);
    setCourseTitle(c.title);
    setCourseDesc(c.description || '');
    setCourseModule(c.module);
    setCourseFree(c.isFree);
    setMessage(null);
  };

  const handleSubmitCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (editingCourseId) {
        await apiRequest(`/courses/${editingCourseId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            title: courseTitle,
            description: courseDesc,
            module: courseModule,
            isFree: courseFree,
          }),
        });
        await loadCourses();
        resetCourseForm();
        notify('success', 'Đã cập nhật thông tin khóa học.');
      } else {
        const created = await apiRequest<CourseItem>('/courses', {
          method: 'POST',
          body: JSON.stringify({
            title: courseTitle,
            description: courseDesc,
            module: courseModule,
            isFree: courseFree,
          }),
        });
        resetCourseForm();
        await loadCourses();
        setSelectedCourseId(created.id);
        notify('success', `Đã tạo khóa học "${created.title}" ở cuối danh sách.`);
      }
    } catch (err: any) {
      notify('error', err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteCourse = async (id: string, title: string) => {
    if (!confirm(`Xóa khóa học "${title}" cùng toàn bộ video và tài liệu liên quan?`)) return;
    setBusy(true);
    try {
      await apiRequest(`/courses/${id}`, { method: 'DELETE' });
      if (editingCourseId === id) resetCourseForm();
      await loadCourses();
      notify('success', 'Đã xóa khóa học.');
    } catch (err: any) {
      notify('error', err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDropCourse = async (targetId: string) => {
    if (!draggingId || draggingId === targetId) return;
    const reordered = reorderArray(courses, draggingId, targetId);
    setCourses(reordered);
    setDraggingId(null);
    setDragOverId(null);
    try {
      await apiRequest('/courses/reorder', {
        method: 'PATCH',
        body: JSON.stringify({ orderedIds: reordered.map((c) => c.id) }),
      });
      notify('success', 'Đã lưu thứ tự khóa học mới.');
    } catch (err: any) {
      notify('error', err.message || 'Không thể lưu thứ tự khóa học.');
      await loadCourses();
    }
  };

  // ===== Video Lesson CRUD & Reorder =====
  const resetVideoForm = () => {
    setEditingLessonId(null);
    setVideoMode('YOUTUBE');
    setVideoTitle('');
    setVideoDesc('');
    setVideoDuration('');
    setVideoFree(false);
    setYoutubeUrl('');
    setVideoFile(null);
    if (videoFileInputRef.current) videoFileInputRef.current.value = '';
  };

  const startEditLesson = (lesson: LessonItem) => {
    setEditingLessonId(lesson.id);
    setVideoTitle(lesson.title);
    setVideoDesc(lesson.description || '');
    setVideoDuration(lesson.duration || '');
    setVideoFree(lesson.isFree);
    setYoutubeUrl(lesson.youtubeUrl || lesson.youtubeId || '');
    setVideoMode(lesson.sourceType === 'YOUTUBE' ? 'YOUTUBE' : 'KEEP');
    setVideoFile(null);
    if (videoFileInputRef.current) videoFileInputRef.current.value = '';
    setMessage(null);
  };

  const handleSubmitVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId) return;
    setBusy(true);
    setMessage(null);
    try {
      if (videoMode === 'UPLOAD') {
        throw new Error(
          'Chức năng upload video lên kho lưu trữ hiện đang tạm khóa. Vui lòng sử dụng link video YouTube Unlisted.',
        );
      }
      if (editingLessonId) {
        const payload: Record<string, any> = {
          title: videoTitle,
          description: videoDesc,
          duration: videoDuration,
          isFree: videoFree,
        };
        if (videoMode === 'YOUTUBE' && youtubeUrl.trim()) {
          payload.youtubeUrl = youtubeUrl.trim();
        }
        await apiRequest(`/lessons/${editingLessonId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        resetVideoForm();
        await loadCourses();
        notify('success', 'Đã cập nhật bài giảng video thành công!');
      } else {
        await apiRequest('/lessons/youtube', {
          method: 'POST',
          body: JSON.stringify({
            courseId: selectedCourseId,
            title: videoTitle,
            description: videoDesc,
            duration: videoDuration,
            isFree: videoFree,
            youtubeUrl,
          }),
        });
        resetVideoForm();
        await loadCourses();
        notify('success', 'Đã thêm bài giảng video vào cuối danh sách!');
      }
    } catch (err: any) {
      notify('error', err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteLesson = async (id: string) => {
    if (!confirm('Xóa bài giảng video này?')) return;
    setBusy(true);
    try {
      await apiRequest(`/lessons/${id}`, { method: 'DELETE' });
      if (editingLessonId === id) resetVideoForm();
      await loadCourses();
      notify('success', 'Đã xóa video.');
    } catch (err: any) {
      notify('error', err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDropLesson = async (targetId: string) => {
    if (!selectedCourse || !draggingId || draggingId === targetId) return;
    const reordered = reorderArray(selectedCourse.lessons, draggingId, targetId);
    setCourses((prev) =>
      prev.map((c) => (c.id === selectedCourse.id ? { ...c, lessons: reordered } : c)),
    );
    setDraggingId(null);
    setDragOverId(null);
    try {
      await apiRequest('/lessons/reorder', {
        method: 'PATCH',
        body: JSON.stringify({
          courseId: selectedCourse.id,
          orderedIds: reordered.map((l) => l.id),
        }),
      });
      notify('success', 'Đã lưu thứ tự video bài giảng.');
    } catch (err: any) {
      notify('error', err.message || 'Không thể lưu thứ tự video.');
      await loadCourses();
    }
  };

  // ===== Document CRUD & Reorder =====
  const resetDocForm = () => {
    setEditingDocId(null);
    setDocTitle('');
    setDocDesc('');
    setDocFree(false);
    setDocFile(null);
    if (docFileInputRef.current) docFileInputRef.current.value = '';
  };

  const startEditDoc = (doc: CourseDocumentItem) => {
    setEditingDocId(doc.id);
    setDocTitle(doc.title);
    setDocDesc(doc.description || '');
    setDocFree(doc.isFree);
    setDocFile(null);
    setMessage(null);
  };

  const handleSubmitDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId) return;
    setBusy(true);
    setMessage(null);
    try {
      if (editingDocId) {
        await apiRequest(`/documents/${editingDocId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            title: docTitle,
            description: docDesc,
            isFree: docFree,
          }),
        });
        resetDocForm();
        await loadCourses();
        notify('success', 'Đã cập nhật thông tin tài liệu.');
      } else {
        if (!docFile) {
          throw new Error('Vui lòng chọn file .doc, .docx, .ppt hoặc .pptx');
        }
        const fd = new FormData();
        fd.append('courseId', selectedCourseId);
        fd.append('title', docTitle);
        if (docDesc) fd.append('description', docDesc);
        fd.append('isFree', String(docFree));
        fd.append('file', docFile);
        await apiRequest('/documents/upload', {
          method: 'POST',
          body: fd,
        });
        resetDocForm();
        await loadCourses();
        notify('success', 'Đã tải tài liệu vào cuối danh sách!');
      }
    } catch (err: any) {
      notify('error', err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteDoc = async (id: string) => {
    if (!confirm('Xóa tài liệu này?')) return;
    setBusy(true);
    try {
      await apiRequest(`/documents/${id}`, { method: 'DELETE' });
      if (editingDocId === id) resetDocForm();
      await loadCourses();
      notify('success', 'Đã xóa tài liệu.');
    } catch (err: any) {
      notify('error', err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDropDoc = async (targetId: string) => {
    if (!selectedCourse || !draggingId || draggingId === targetId) return;
    const reordered = reorderArray(selectedCourse.documents, draggingId, targetId);
    setCourses((prev) =>
      prev.map((c) => (c.id === selectedCourse.id ? { ...c, documents: reordered } : c)),
    );
    setDraggingId(null);
    setDragOverId(null);
    try {
      await apiRequest('/documents/reorder', {
        method: 'PATCH',
        body: JSON.stringify({
          courseId: selectedCourse.id,
          orderedIds: reordered.map((d) => d.id),
        }),
      });
      notify('success', 'Đã lưu thứ tự tài liệu.');
    } catch (err: any) {
      notify('error', err.message || 'Không thể lưu thứ tự tài liệu.');
      await loadCourses();
    }
  };

  // ===== Student Access Grant / Revoke =====
  const handleToggleStudentAccess = async (studentId: string, nextCanView: boolean) => {
    if (!selectedCourseId) return;
    setBusy(true);
    setMessage(null);
    try {
      await apiRequest('/enrollments/access', {
        method: 'POST',
        body: JSON.stringify({
          courseId: selectedCourseId,
          studentId,
          canView: nextCanView,
        }),
      });
      await loadGrantedStudents(selectedCourseId);
      if (nextCanView) {
        setSearchResults((prev) => prev.filter((s) => s.studentId !== studentId));
      } else if (searchQueryRef.current.trim().length >= 2) {
        await executeStudentSearch(selectedCourseId, searchQueryRef.current);
      }
      await loadCourses();
      notify(
        'success',
        nextCanView
          ? 'Đã cấp quyền xem khóa học cho học sinh.'
          : 'Đã thu hồi quyền xem khóa học của học sinh.',
      );
    } catch (err: any) {
      notify('error', err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h2 style={{ marginTop: 0 }}>Không gian Giáo viên</h2>
      <p className="hint">
        Quản lý, chỉnh sửa và kéo thả sắp xếp khóa học, video bài giảng, tài liệu Word/PowerPoint và cấp quyền cho học sinh.
      </p>

      {message && <div className={`alert ${message.type}`}>{message.text}</div>}

      <div className="tabs">
        <button
          type="button"
          className={`btn ${tab === 'courses' ? '' : 'alt'}`}
          onClick={() => setTab('courses')}
        >
          1. Quản lý Khóa học ({courses.length})
        </button>
        <button
          type="button"
          className={`btn ${tab === 'videos' ? '' : 'alt'}`}
          onClick={() => setTab('videos')}
        >
          2. Video bài giảng
        </button>
        <button
          type="button"
          className={`btn ${tab === 'documents' ? '' : 'alt'}`}
          onClick={() => setTab('documents')}
        >
          3. Tài liệu DOC / PPT
        </button>
        <button
          type="button"
          className={`btn ${tab === 'access' ? '' : 'alt'}`}
          onClick={() => setTab('access')}
        >
          4. Cấp quyền Học sinh
        </button>
      </div>

      {/* Course selector for tabs 2, 3, 4 */}
      {tab !== 'courses' && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="field">
            <label htmlFor="selectCourse">Chọn khóa học đang thao tác</label>
            <select
              id="selectCourse"
              className="select"
              value={selectedCourseId}
              onChange={(e) => {
                setSelectedCourseId(e.target.value);
                resetVideoForm();
                resetDocForm();
              }}
            >
              {courses.length === 0 ? (
                <option value="">Chưa có khóa học nào — hãy tạo ở tab 1</option>
              ) : (
                courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    [{getModuleName(c.module)}] {c.title} ({c.isFree ? 'Miễn phí' : 'Phân quyền'})
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      )}

      {/* TAB 1: COURSES */}
      {tab === 'courses' && (
        <div className="split-layout">
          <div className={`card ${editingCourseId ? 'editing' : ''}`}>
            <h3>{editingCourseId ? 'Chỉnh sửa khóa học' : 'Tạo khóa học mới'}</h3>
            <form className="form-grid" onSubmit={handleSubmitCourse}>
              <div className="field">
                <label>Tên khóa học</label>
                <input
                  className="input"
                  required
                  value={courseTitle}
                  onChange={(e) => setCourseTitle(e.target.value)}
                  placeholder="Ví dụ: HSK 2 – Ngữ pháp & Giao tiếp"
                />
              </div>
              <div className="field">
                <label>Chương trình học</label>
                <select
                  className="select"
                  value={courseModule}
                  onChange={(e) => setCourseModule(e.target.value as ProgramModule)}
                >
                  {PROGRAM_MODULES.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.han})
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Ghi chú / Mô tả</label>
                <textarea
                  className="textarea"
                  value={courseDesc}
                  onChange={(e) => setCourseDesc(e.target.value)}
                  placeholder="Mô tả nội dung khóa học..."
                />
              </div>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={courseFree}
                  onChange={(e) => setCourseFree(e.target.checked)}
                />
                Khóa học mở miễn phí cho mọi học sinh
              </label>
              <div className="row" style={{ marginTop: 4 }}>
                <button type="submit" className="btn" disabled={busy}>
                  {editingCourseId ? 'Lưu thay đổi' : 'Tạo khóa học'}
                </button>
                {editingCourseId && (
                  <button type="button" className="btn alt" onClick={resetCourseForm}>
                    Hủy sửa
                  </button>
                )}
              </div>
            </form>
          </div>

          <div>
            <h3 style={{ marginTop: 0 }}>Danh sách khóa học phụ trách</h3>
            <p className="hint" style={{ marginTop: -4 }}>
              Kéo thả biểu tượng ⋮⋮ để sắp xếp thứ tự hiển thị khóa học. Khóa học mới sẽ nằm ở cuối danh sách.
            </p>
            {loading ? (
              <p className="hint">Đang tải...</p>
            ) : courses.length === 0 ? (
              <div className="card">Chưa có khóa học nào.</div>
            ) : (
              <div className="lessons">
                {courses.map((c, idx) => (
                  <div
                    className={`les ${draggingId === c.id ? 'dragging' : ''} ${
                      dragOverId === c.id ? 'drag-over' : ''
                    } ${editingCourseId === c.id ? 'active' : ''}`}
                    key={c.id}
                    draggable
                    onDragStart={() => setDraggingId(c.id)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragOverId !== c.id) setDragOverId(c.id);
                    }}
                    onDragLeave={() => {
                      if (dragOverId === c.id) setDragOverId(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleDropCourse(c.id);
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDragOverId(null);
                    }}
                  >
                    <span className="drag-handle" title="Kéo thả để đổi thứ tự">
                      ⋮⋮
                    </span>
                    <div className="t">
                      <b>
                        {idx + 1}. {c.title}
                      </b>
                      <br />
                      <small>
                        {getModuleName(c.module)} · {c.lessons.length} video ·{' '}
                        {c.documents.length} tài liệu · {c.enrollments?.length || 0} học sinh được cấp quyền
                      </small>
                    </div>
                    <span className={`tag ${c.isFree ? 'free' : 'paid'}`}>
                      {c.isFree ? 'Miễn phí' : 'Cần cấp quyền'}
                    </span>
                    <button
                      type="button"
                      className="btn alt sm"
                      onClick={() => startEditCourse(c)}
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      className="btn alt sm"
                      onClick={() => {
                        setSelectedCourseId(c.id);
                        setTab('access');
                      }}
                    >
                      Cấp quyền
                    </button>
                    <button
                      type="button"
                      className="btn danger sm"
                      onClick={() => handleDeleteCourse(c.id, c.title)}
                      disabled={busy}
                    >
                      Xóa
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: VIDEOS */}
      {tab === 'videos' && selectedCourse && (
        <div className="split-layout">
          <div className={`card ${editingLessonId ? 'editing' : ''}`}>
            <h3>{editingLessonId ? 'Chỉnh sửa bài giảng video' : 'Thêm bài giảng video'}</h3>

            <div className="row" style={{ marginBottom: 12 }}>
              {editingLessonId && (
                <button
                  type="button"
                  className={`btn sm ${videoMode === 'KEEP' ? '' : 'alt'}`}
                  onClick={() => setVideoMode('KEEP')}
                >
                  Giữ video hiện tại
                </button>
              )}
              <button
                type="button"
                className={`btn sm ${videoMode === 'YOUTUBE' ? '' : 'alt'}`}
                onClick={() => setVideoMode('YOUTUBE')}
              >
                {editingLessonId ? 'Đổi link YouTube' : 'Link YouTube'}
              </button>
              <button
                type="button"
                className="btn sm alt"
                title="Chức năng đang tạm khóa"
                onClick={() =>
                  notify(
                    'error',
                    'Chức năng upload video lên kho lưu trữ hiện đang tạm khóa. Vui lòng sử dụng link video YouTube Unlisted.',
                  )
                }
              >
                🔒 {editingLessonId ? 'Upload lại Video' : 'Upload file Video'}
              </button>
            </div>

            <form className="form-grid" onSubmit={handleSubmitVideo}>
              <div className="field">
                <label>Tiêu đề bài giảng</label>
                <input
                  className="input"
                  required
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  placeholder="Ví dụ: Bài 3 – Hỏi đường và phương hướng"
                />
              </div>
              <div className="field">
                <label>Thời lượng (tùy chọn)</label>
                <input
                  className="input"
                  value={videoDuration}
                  onChange={(e) => setVideoDuration(e.target.value)}
                  placeholder="Ví dụ: 18 phút"
                />
              </div>

              {videoMode === 'YOUTUBE' && (
                <div className="field">
                  <label>Đường dẫn hoặc ID video YouTube</label>
                  <input
                    className="input"
                    required
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=... hoặc https://youtu.be/..."
                  />
                </div>
              )}

              {videoMode === 'UPLOAD' && (
                <div className="field">
                  <label>
                    {editingLessonId
                      ? 'Chọn file video mới thay thế (.mp4, .webm, .mov)'
                      : 'Chọn file video (.mp4, .webm, .mov)'}
                  </label>
                  <input
                    ref={videoFileInputRef}
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.mkv,.m4v"
                    required
                    onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                  />
                </div>
              )}

              <div className="field">
                <label>Ghi chú / Mô tả bài giảng</label>
                <textarea
                  className="textarea"
                  value={videoDesc}
                  onChange={(e) => setVideoDesc(e.target.value)}
                  placeholder="Nội dung tóm tắt bài học..."
                />
              </div>

              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={videoFree}
                  onChange={(e) => setVideoFree(e.target.checked)}
                />
                Cho phép học thử miễn phí (không cần cấp quyền khóa học)
              </label>

              <div className="row" style={{ marginTop: 4 }}>
                <button type="submit" className="btn" disabled={busy}>
                  {busy
                    ? 'Đang xử lý...'
                    : editingLessonId
                    ? 'Lưu thay đổi'
                    : videoMode === 'YOUTUBE'
                    ? 'Lưu link YouTube'
                    : 'Tải video lên kho lưu trữ'}
                </button>
                {editingLessonId && (
                  <button type="button" className="btn alt" onClick={resetVideoForm}>
                    Hủy sửa
                  </button>
                )}
              </div>
            </form>
          </div>

          <div>
            <h3 style={{ marginTop: 0 }}>
              Video trong "{selectedCourse.title}" ({selectedCourse.lessons.length})
            </h3>
            <p className="hint" style={{ marginTop: -4 }}>
              Kéo thả biểu tượng ⋮⋮ để sắp xếp thứ tự bài giảng. Video thêm mới sẽ xuống cuối danh sách.
            </p>
            {selectedCourse.lessons.length === 0 ? (
              <div className="card">Chưa có video nào trong khóa học này.</div>
            ) : (
              <div className="lessons">
                {selectedCourse.lessons.map((l, idx) => (
                  <div
                    className={`les ${draggingId === l.id ? 'dragging' : ''} ${
                      dragOverId === l.id ? 'drag-over' : ''
                    } ${editingLessonId === l.id ? 'active' : ''}`}
                    key={l.id}
                    draggable
                    onDragStart={() => setDraggingId(l.id)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragOverId !== l.id) setDragOverId(l.id);
                    }}
                    onDragLeave={() => {
                      if (dragOverId === l.id) setDragOverId(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleDropLesson(l.id);
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDragOverId(null);
                    }}
                  >
                    <span className="drag-handle" title="Kéo thả để đổi thứ tự">
                      ⋮⋮
                    </span>
                    <div className="t">
                      <b>
                        {idx + 1}. {l.title}
                      </b>
                      <br />
                      <small>
                        {l.sourceType === 'YOUTUBE'
                          ? `YouTube (${l.youtubeId})`
                          : `Kho lưu trữ (${l.originalFileName} · ${formatFileSize(l.fileSize)})`}
                        {l.duration ? ` · ${l.duration}` : ''}
                      </small>
                    </div>
                    <span className={`tag ${l.isFree ? 'free' : 'paid'}`}>
                      {l.isFree ? 'Học thử' : 'Theo khóa học'}
                    </span>
                    <button
                      type="button"
                      className="btn alt sm"
                      onClick={() => startEditLesson(l)}
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      className="btn danger sm"
                      onClick={() => handleDeleteLesson(l.id)}
                      disabled={busy}
                    >
                      Xóa
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: DOCUMENTS */}
      {tab === 'documents' && selectedCourse && (
        <div className="split-layout">
          <div className={`card ${editingDocId ? 'editing' : ''}`}>
            <h3>
              {editingDocId
                ? 'Chỉnh sửa thông tin tài liệu'
                : 'Đẩy tài liệu học tập (.doc / .docx / .ppt / .pptx)'}
            </h3>
            <form className="form-grid" onSubmit={handleSubmitDoc}>
              <div className="field">
                <label>Tên tài liệu</label>
                <input
                  className="input"
                  required
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="Ví dụ: Slide bài giảng HSK 1 – Tuần 2"
                />
              </div>
              {!editingDocId && (
                <div className="field">
                  <label>Chọn tệp Word hoặc PowerPoint</label>
                  <input
                    ref={docFileInputRef}
                    type="file"
                    accept=".doc,.docx,.ppt,.pptx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                    required
                    onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                  />
                </div>
              )}
              <div className="field">
                <label>Ghi chú / Mô tả tài liệu</label>
                <textarea
                  className="textarea"
                  value={docDesc}
                  onChange={(e) => setDocDesc(e.target.value)}
                  placeholder="Ghi chú nội dung file bài tập hoặc slide..."
                />
              </div>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={docFree}
                  onChange={(e) => setDocFree(e.target.checked)}
                />
                Cho phép tải miễn phí
              </label>
              <div className="row" style={{ marginTop: 4 }}>
                <button type="submit" className="btn" disabled={busy}>
                  {busy
                    ? 'Đang xử lý...'
                    : editingDocId
                    ? 'Lưu thay đổi'
                    : 'Tải tài liệu lên'}
                </button>
                {editingDocId && (
                  <button type="button" className="btn alt" onClick={resetDocForm}>
                    Hủy sửa
                  </button>
                )}
              </div>
            </form>
          </div>

          <div>
            <h3 style={{ marginTop: 0 }}>
              Tài liệu của "{selectedCourse.title}" ({selectedCourse.documents.length})
            </h3>
            <p className="hint" style={{ marginTop: -4 }}>
              Kéo thả biểu tượng ⋮⋮ để sắp xếp thứ tự tài liệu. Tài liệu thêm mới sẽ xuống cuối danh sách.
            </p>
            {selectedCourse.documents.length === 0 ? (
              <div className="card">Chưa có tài liệu nào trong khóa học này.</div>
            ) : (
              <div className="lessons">
                {selectedCourse.documents.map((doc, idx) => (
                  <div
                    className={`les ${draggingId === doc.id ? 'dragging' : ''} ${
                      dragOverId === doc.id ? 'drag-over' : ''
                    } ${editingDocId === doc.id ? 'active' : ''}`}
                    key={doc.id}
                    draggable
                    onDragStart={() => setDraggingId(doc.id)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragOverId !== doc.id) setDragOverId(doc.id);
                    }}
                    onDragLeave={() => {
                      if (dragOverId === doc.id) setDragOverId(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleDropDoc(doc.id);
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDragOverId(null);
                    }}
                  >
                    <span className="drag-handle" title="Kéo thả để đổi thứ tự">
                      ⋮⋮
                    </span>
                    <div className="t">
                      <b>
                        {idx + 1}. {doc.title}
                      </b>
                      <br />
                      <small>
                        {doc.originalFileName} (.{doc.fileType.toUpperCase()} ·{' '}
                        {formatFileSize(doc.fileSize)})
                      </small>
                    </div>
                    <button
                      type="button"
                      className="btn alt sm"
                      onClick={() => startEditDoc(doc)}
                    >
                      Sửa
                    </button>
                    <a
                      href={buildMediaUrl(`/documents/${doc.id}/download`)}
                      className="btn alt sm"
                      download
                    >
                      Tải thử
                    </a>
                    <button
                      type="button"
                      className="btn danger sm"
                      onClick={() => handleDeleteDoc(doc.id)}
                      disabled={busy}
                    >
                      Xóa
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: STUDENT COURSE ACCESS */}
      {tab === 'access' && selectedCourse && (
        <div className="card">
          <h3>Phân quyền Học sinh cho khóa học: {selectedCourse.title}</h3>
          <p className="hint">
            Tìm kiếm học sinh để cấp quyền mới, và quản lý danh sách học sinh hiện đang có quyền xem khóa học này.
            {selectedCourse.isFree &&
              ' (Lưu ý: Khóa học này đang bật chế độ Miễn phí nên tất cả học sinh đều xem được.)'}
          </p>

          {/* Thanh tìm kiếm học sinh */}
          <div style={{ marginBottom: 20 }}>
            <div className="field">
              <label htmlFor="student-search">Tìm học sinh để cấp quyền</label>
              <div className="row" style={{ marginTop: 0 }}>
                <input
                  id="student-search"
                  className="input"
                  style={{ flex: 1, minWidth: 240 }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchQuery.trim().length >= 2) {
                      e.preventDefault();
                      executeStudentSearch(selectedCourse.id, searchQuery);
                    }
                  }}
                  placeholder="Nhập tối thiểu 2 ký tự (họ tên, email hoặc số điện thoại)..."
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="btn alt sm"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                      lastRequestedQueryRef.current = '';
                    }}
                  >
                    Xóa
                  </button>
                )}
              </div>
              <small style={{ color: 'var(--mute)' }}>
                {searchQuery.trim().length > 0 && searchQuery.trim().length < 2
                  ? 'Nhập thêm ít nhất 1 ký tự để bắt đầu tìm kiếm.'
                  : searching
                  ? 'Đang tìm kiếm học sinh...'
                  : searchQuery.trim().length >= 2
                  ? `Tìm thấy ${searchResults.length} học sinh (tự động tìm lại mỗi 5 giây nếu từ khóa thay đổi).`
                  : 'Hệ thống bắt đầu tìm từ 2 ký tự trở lên và tự động cập nhật sau mỗi 5 giây khi từ khóa thay đổi.'}
              </small>
            </div>

            {searchQuery.trim().length >= 2 && (
              <div className="scroll-box-6" style={{ marginTop: 10 }}>
                {searchResults.length === 0 && !searching ? (
                  <p className="hint" style={{ padding: 12, margin: 0 }}>
                    Không tìm thấy học sinh nào phù hợp với "{searchQuery.trim()}".
                  </p>
                ) : (
                  <div className="search-results-list">
                    {searchResults.map((st) => (
                      <div className="search-result-item" key={st.studentId}>
                        <div>
                          <b>{st.fullName}</b>
                          <br />
                          <small style={{ color: 'var(--mute)' }}>
                            {st.email}
                            {st.phone ? ` · ${st.phone}` : ''}
                          </small>
                        </div>
                        <button
                          type="button"
                          className="btn jade sm"
                          disabled={busy}
                          onClick={() => handleToggleStudentAccess(st.studentId, true)}
                        >
                          + Cấp quyền xem
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Danh sách học sinh ĐÃ được cấp quyền */}
          <h3 style={{ marginTop: 18 }}>
            Học sinh đã được cấp quyền ({grantedStudents.length})
          </h3>
          <div className="scroll-box-6">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Học sinh</th>
                  <th>Email</th>
                  <th>Người cấp</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {grantedStudents.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      Chưa có học sinh nào được cấp quyền cho khóa học này. Hãy tìm kiếm học sinh ở ô phía trên để thêm.
                    </td>
                  </tr>
                ) : (
                  grantedStudents.map((st) => (
                    <tr key={st.studentId}>
                      <td>
                        <b>{st.fullName}</b>
                        {st.phone && (
                          <>
                            <br />
                            <small style={{ color: 'var(--mute)' }}>{st.phone}</small>
                          </>
                        )}
                      </td>
                      <td>{st.email}</td>
                      <td>{st.grantedBy || '—'}</td>
                      <td>
                        <button
                          type="button"
                          className="btn danger sm"
                          disabled={busy}
                          onClick={() => handleToggleStudentAccess(st.studentId, false)}
                        >
                          Thu hồi quyền
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
