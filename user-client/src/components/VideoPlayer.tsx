'use client';

import Link from 'next/link';
import { buildMediaUrl } from '@/lib/api';
import { LessonItem } from '@/lib/types';

interface VideoPlayerProps {
  lesson: LessonItem | null;
  isLoggedIn: boolean;
}

export function VideoPlayer({ lesson, isLoggedIn }: VideoPlayerProps) {
  if (!lesson) {
    return (
      <div className="player">
        <div>
          <div className="han" style={{ fontSize: 40 }}>
            云
          </div>
          <p style={{ margin: '8px 0 0' }}>Chọn một bài giảng video bên dưới để bắt đầu học.</p>
        </div>
      </div>
    );
  }

  if (!lesson.canWatch) {
    return (
      <div className="player">
        <div style={{ maxWidth: 420 }}>
          <div className="han" style={{ fontSize: 48 }}>
            锁
          </div>
          <b style={{ display: 'block', fontSize: 18, marginTop: 6 }}>{lesson.title}</b>
          <p style={{ margin: '8px 0 14px', color: '#d9d2bf', fontSize: 14 }}>
            {isLoggedIn
              ? 'Bài giảng này thuộc khóa học có phân quyền. Giáo viên chưa cấp quyền xem khóa học này cho tài khoản của bạn.'
              : 'Bài giảng này thuộc khóa học có phân quyền. Vui lòng đăng nhập bằng tài khoản học sinh đã được cấp quyền để xem.'}
          </p>
          {!isLoggedIn && (
            <Link href="/login" className="btn">
              Đăng nhập ngay
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (lesson.sourceType === 'YOUTUBE' && lesson.youtubeId) {
    return (
      <div className="player">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(lesson.youtubeId)}?rel=0`}
          title={lesson.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  }

  if (lesson.sourceType === 'UPLOAD' && lesson.streamPath) {
    const src = buildMediaUrl(lesson.streamPath);
    return (
      <div className="player">
        <video key={src} controls controlsList="nodownload" preload="metadata" src={src}>
          Trình duyệt của bạn không hỗ trợ phát video HTML5.
        </video>
      </div>
    );
  }

  return (
    <div className="player">
      <p>Nguồn video chưa sẵn sàng.</p>
    </div>
  );
}
