export type Role = 'ADMIN' | 'TEACHER' | 'STUDENT';
export type ProgramModule = 'easy' | 'yct' | 'hsk' | 'talk';
export type ModuleSelection = 'all' | ProgramModule;
export type VideoSourceType = 'UPLOAD' | 'YOUTUBE';

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  bio?: string | null;
  role: Role;
  isActive?: boolean;
  createdAt?: string;
  _count?: {
    taughtCourses: number;
    enrollments: number;
  };
}

export interface LessonItem {
  id: string;
  courseId: string;
  title: string;
  description?: string | null;
  duration?: string | null;
  sortOrder: number;
  isFree: boolean;
  sourceType: VideoSourceType;
  canWatch: boolean;
  youtubeId?: string | null;
  youtubeUrl?: string | null;
  streamPath?: string | null;
  originalFileName?: string | null;
  fileSize?: number | null;
  createdAt: string;
}

export interface CourseDocumentItem {
  id: string;
  courseId: string;
  title: string;
  description?: string | null;
  originalFileName: string;
  fileType: string;
  fileSize: number;
  sortOrder?: number;
  isFree: boolean;
  canDownload: boolean;
  downloadPath?: string | null;
  createdAt: string;
}

export interface CourseItem {
  id: string;
  title: string;
  description?: string | null;
  module: ProgramModule;
  sortOrder?: number;
  isFree: boolean;
  isPublished: boolean;
  /** Integer VND set by an admin; null = paid course not on sale yet. */
  priceVnd?: number | null;
  teacherId: string;
  teacher?: {
    id: string;
    fullName: string;
    email: string;
    bio?: string | null;
  };
  hasAccess: boolean;
  createdAt: string;
  lessons: LessonItem[];
  documents: CourseDocumentItem[];
  enrollments?: Array<{
    id: string;
    studentId: string;
    canView: boolean;
    student: { id: string; fullName: string; email: string };
  }>;
}

export interface CourseStudentAccess {
  studentId: string;
  fullName: string;
  email: string;
  phone?: string | null;
  canView: boolean;
  note?: string | null;
  grantedBy?: string | null;
  updatedAt?: string | null;
}

export interface AdminStats {
  admins: number;
  teachers: number;
  students: number;
  totalUsers: number;
  courses: number;
  lessons: number;
  documents: number;
  activeEnrollments: number;
}

export type OrderStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED' | 'REFUNDED';

/** An order as its owner sees it (GET /payments/orders/:id). */
export interface OrderItem {
  id: string;
  /** "VK-1000001": what learners quote to support. */
  code: string;
  courseId: string | null;
  courseTitle: string;
  amountVnd: number;
  status: OrderStatus;
  /** VietQR string, only while pending. */
  qrCode: string | null;
  checkoutUrl: string | null;
  expiresAt: string;
  paidAt: string | null;
  createdAt: string;
  /** Dev only: the fake gateway's "simulate payment" button. */
  canSimulate: boolean;
}

export interface AdminOrderItem {
  id: string;
  code: string;
  orderCode: number;
  userId: string | null;
  userEmail: string;
  userName: string | null;
  courseId: string | null;
  courseTitle: string;
  amountVnd: number;
  status: OrderStatus;
  needsReview: boolean;
  gateway: string;
  expiresAt: string;
  paidAt: string | null;
  refundedAt: string | null;
  createdAt: string;
}

export interface AdminOrderDetail extends AdminOrderItem {
  events: Array<{
    id: string;
    kind: string;
    outcome: string;
    message: string | null;
    actorName: string | null;
    createdAt: string;
  }>;
}

/** One lesson's progress for the current learner (PUT/GET /progress/…). */
export interface LessonProgress {
  lessonId: string;
  courseId: string;
  completed: boolean;
  completedAt: string | null;
  positionSeconds: number;
  durationSeconds: number | null;
  updatedAt: string;
}

export interface CourseProgress {
  courseId: string;
  totalLessons: number;
  completedCount: number;
  /** Most recently touched lesson. */
  lastLessonId: string | null;
  lessons: LessonProgress[];
}

/** GET /progress/me: courses the learner has started, most recent first. */
export interface MyCourseProgress {
  courseId: string;
  courseTitle: string;
  module: ProgramModule;
  isFree: boolean;
  totalLessons: number;
  completedCount: number;
  lastActivityAt: string;
  lastLesson: {
    lessonId: string;
    title: string;
    positionSeconds: number;
    durationSeconds: number | null;
    completed: boolean;
  };
}
