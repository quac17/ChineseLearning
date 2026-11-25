import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '../common/types/domain.types';
import { LessonQuizService } from './lesson-quiz.service';

describe('LessonQuizService access control', () => {
  const makeService = (overrides?: {
    lesson?: any;
    question?: any;
    hasCourseAccess?: boolean;
    fileExists?: boolean;
  }) => {
    const db = {
      queryOne: jest.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM lessons l')) return Promise.resolve(overrides?.lesson ?? null);
        if (sql.includes('FROM lesson_quiz_questions')) return Promise.resolve(overrides?.question ?? null);
        return Promise.resolve(null);
      }),
      queryAll: jest.fn().mockResolvedValue([]),
      withTransaction: jest.fn(),
    } as any;
    const courses = {
      assertCanManageCourse: jest.fn().mockResolvedValue(undefined),
      checkUserCourseAccess: jest.fn().mockResolvedValue(overrides?.hasCourseAccess ?? false),
    } as any;
    const storage = {
      fileExists: jest.fn().mockResolvedValue(overrides?.fileExists ?? true),
      usesSignedUrls: false,
      getFileSize: jest.fn().mockResolvedValue(128),
      pipeTo: jest.fn(),
    } as any;
    return { service: new LessonQuizService(db, courses, storage), db, courses, storage };
  };

  const paidLesson = {
    id: 'lesson-1',
    course_id: 'course-1',
    is_free: false,
    quiz_mode: 'MANUAL',
    is_published: true,
    teacher_id: 'teacher-1',
  };

  const freeLesson = { ...paidLesson, is_free: true };
  const draftLesson = { ...freeLesson, is_published: false };
  const questionWithAudio = {
    audio_storage_key: 'audio/test-123.mp3',
    audio_mime_type: 'audio/mpeg',
  };

  const mockReq = { headers: {} } as any;
  const mockRes = { writeHead: jest.fn(), setHeader: jest.fn(), redirect: jest.fn() } as any;

  it('blocks logged-out and unauthorized students from paid lesson quiz audio', async () => {
    const { service } = makeService({
      lesson: paidLesson,
      question: questionWithAudio,
      hasCourseAccess: false,
    });

    await expect(service.serveAudio('lesson-1', 'q-1', null, mockReq, mockRes)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(
      service.serveAudio(
        'lesson-1',
        'q-1',
        { id: 'student-b', email: 'b@test.vn', fullName: 'Student B', phone: null, bio: null, role: Role.STUDENT },
        mockReq,
        mockRes,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows enrolled student to stream paid lesson quiz audio', async () => {
    const { service, storage } = makeService({
      lesson: paidLesson,
      question: questionWithAudio,
      hasCourseAccess: true,
    });

    await service.serveAudio(
      'lesson-1',
      'q-1',
      { id: 'student-a', email: 'a@test.vn', fullName: 'Student A', phone: null, bio: null, role: Role.STUDENT },
      mockReq,
      mockRes,
    );
    expect(storage.pipeTo).toHaveBeenCalledWith(mockRes, 'audio/test-123.mp3');
  });

  it('allows logged-out viewer on free published lesson, but blocks on unpublished draft', async () => {
    const { service: freeSvc, storage: freeStorage } = makeService({
      lesson: freeLesson,
      question: questionWithAudio,
    });
    await freeSvc.serveAudio('lesson-1', 'q-1', null, mockReq, mockRes);
    expect(freeStorage.pipeTo).toHaveBeenCalled();

    const { service: draftSvc } = makeService({
      lesson: draftLesson,
      question: questionWithAudio,
    });
    await expect(draftSvc.serveAudio('lesson-1', 'q-1', null, mockReq, mockRes)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('returns 404 when question has no uploaded audio', async () => {
    const { service } = makeService({
      lesson: freeLesson,
      question: { audio_storage_key: null, audio_mime_type: null },
    });
    await expect(service.serveAudio('lesson-1', 'q-1', null, mockReq, mockRes)).rejects.toThrow(
      NotFoundException,
    );
  });
});
