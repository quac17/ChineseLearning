import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CoursesService } from '../courses/courses.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { generateId, Role } from '../common/types/domain.types';
import { SetCourseAccessDto } from './dto/enrollment.dto';
import { displayCode } from '../payments/payments.service';

@Injectable()
export class EnrollmentsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly coursesService: CoursesService,
  ) {}

  /**
   * Chỉ trả về danh sách học sinh ĐÃ được cấp quyền (can_view = TRUE) vào khóa học
   */
  async getCourseGrantedStudents(courseId: string, user: AuthUser) {
    await this.coursesService.assertCanManageCourse(courseId, user);

    // paid_order_code: the learner's latest PAID order for this course (no
    // amount: teachers never see revenue). completed_lessons: lesson ticks.
    const rows = await this.db.queryAll(
      `SELECT u.id AS student_id, u.full_name, u.email, u.phone,
              e.can_view, e.note, e.updated_at, g.full_name AS granted_by,
              (SELECT o.order_code FROM orders o
                 WHERE o.course_id = e.course_id AND o.user_id = e.student_id AND o.status = 'PAID'
                 ORDER BY o.paid_at DESC NULLS LAST LIMIT 1) AS paid_order_code,
              (SELECT count(*)::int FROM lesson_progress p
                 JOIN lessons l ON l.id = p.lesson_id
                 WHERE p.course_id = e.course_id AND p.user_id = e.student_id
                   AND p.completed_at IS NOT NULL) AS completed_lessons
       FROM course_enrollments e
       JOIN users u ON u.id = e.student_id
       LEFT JOIN users g ON g.id = e.granted_by_id
       WHERE e.course_id = $1 AND e.can_view = TRUE AND u.role = 'STUDENT' AND u.is_active = TRUE
       ORDER BY e.updated_at DESC`,
      [courseId],
    );

    return rows.map((r) => ({
      studentId: r.student_id,
      fullName: r.full_name,
      email: r.email,
      phone: r.phone ?? null,
      canView: Boolean(r.can_view),
      note: r.note ?? null,
      grantedBy: r.granted_by ?? null,
      updatedAt: r.updated_at ?? null,
      paidOrderCode: r.paid_order_code ? displayCode(r.paid_order_code) : null,
      completedLessons: r.completed_lessons ?? 0,
    }));
  }

  /**
   * Tìm kiếm học sinh CHƯA được cấp quyền vào khóa học theo tên / email / số điện thoại (yêu cầu >= 2 ký tự)
   */
  async searchStudentsForCourse(courseId: string, query: string, user: AuthUser) {
    await this.coursesService.assertCanManageCourse(courseId, user);

    const trimmed = (query || '').trim();
    if (trimmed.length < 2) {
      return [];
    }

    const pattern = `%${trimmed}%`;
    const rows = await this.db.queryAll(
      `SELECT u.id AS student_id, u.full_name, u.email, u.phone,
              FALSE AS can_view,
              e.note, e.updated_at, g.full_name AS granted_by
       FROM users u
       LEFT JOIN course_enrollments e
         ON e.student_id = u.id AND e.course_id = $1
       LEFT JOIN users g
         ON g.id = e.granted_by_id
       WHERE u.role = 'STUDENT'
         AND u.is_active = TRUE
         AND COALESCE(e.can_view, FALSE) = FALSE
         AND (
           u.full_name ILIKE $2
           OR u.email ILIKE $2
           OR COALESCE(u.phone, '') ILIKE $2
         )
       ORDER BY u.full_name ASC
       LIMIT 50`,
      [courseId, pattern],
    );

    return rows.map((r) => ({
      studentId: r.student_id,
      fullName: r.full_name,
      email: r.email,
      phone: r.phone ?? null,
      canView: Boolean(r.can_view),
      note: r.note ?? null,
      grantedBy: r.granted_by ?? null,
      updatedAt: r.updated_at ?? null,
    }));
  }

  async setCourseAccess(dto: SetCourseAccessDto, user: AuthUser) {
    await this.coursesService.assertCanManageCourse(dto.courseId, user);

    const student = await this.db.queryOne(
      'SELECT id, role, full_name, email FROM users WHERE id = $1',
      [dto.studentId],
    );

    if (!student) {
      throw new NotFoundException('Không tìm thấy học sinh.');
    }
    if (student.role !== Role.STUDENT) {
      throw new BadRequestException('Chỉ có thể cấp quyền khóa học cho tài khoản Học sinh.');
    }

    const id = generateId('enroll');
    const row = await this.db.queryOne(
      `INSERT INTO course_enrollments (id, course_id, student_id, granted_by_id, can_view, note)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (course_id, student_id)
       DO UPDATE SET
         can_view = EXCLUDED.can_view,
         granted_by_id = EXCLUDED.granted_by_id,
         note = COALESCE(EXCLUDED.note, course_enrollments.note),
         updated_at = NOW()
       RETURNING *`,
      [id, dto.courseId, dto.studentId, user.id, dto.canView, dto.note ?? null],
    );

    return {
      id: row.id,
      courseId: row.course_id,
      studentId: row.student_id,
      canView: row.can_view,
      student: { id: student.id, fullName: student.full_name, email: student.email },
    };
  }

  async getMyEnrollments(user: AuthUser) {
    const rows = await this.db.queryAll(
      `SELECT e.id, e.course_id, e.can_view, c.title, c.module, c.description, c.is_free
       FROM course_enrollments e
       JOIN courses c ON c.id = e.course_id
       WHERE e.student_id = $1 AND e.can_view = TRUE
       ORDER BY e.updated_at DESC`,
      [user.id],
    );

    return rows.map((r) => ({
      id: r.id,
      courseId: r.course_id,
      canView: r.can_view,
      course: {
        id: r.course_id,
        title: r.title,
        module: r.module,
        description: r.description,
        isFree: r.is_free,
      },
    }));
  }
}
