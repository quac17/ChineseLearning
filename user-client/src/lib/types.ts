export type Role = 'ADMIN' | 'TEACHER' | 'STUDENT';
export type ProgramModule = string;
export type ModuleSelection = 'all' | ProgramModule;
export type VideoSourceType = 'UPLOAD' | 'YOUTUBE';
/** Course level (Cấp độ). */
export type CourseLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export type QuizMode = 'AUTO' | 'MANUAL';
export type QuizQuestionKind = 'choice' | 'listen' | 'order' | 'fill' | 'match';

export interface ProgramItem {
  code: string;
  name: string;
  han: string;
  cardDesc: string | null;
  description: string | null;
  color1: string;
  color2: string;
  sortOrder: number;
  courseCount?: number;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  bio?: string | null;
  role: Role;
  isActive?: boolean;
  /** Set when the user ticked the consent box on register; null for older or admin-created accounts. */
  termsAcceptedAt?: string | null;
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
  /** Length in whole minutes; preferred over the free-text `duration` when set. */
  durationMinutes?: number | null;
  sortOrder: number;
  /** Section ("Phần") the lesson belongs to; null = none. */
  sectionId?: string | null;
  isFree: boolean;
  sourceType: VideoSourceType;
  canWatch: boolean;
  youtubeId?: string | null;
  youtubeUrl?: string | null;
  streamPath?: string | null;
  /** WebVTT pinyin subtitles of an uploaded video, only when the viewer may watch it. */
  subtitlePath?: string | null;
  originalFileName?: string | null;
  fileSize?: number | null;
  /** Number of words in the lesson's vocabulary (shown even when locked). */
  vocabularyCount?: number;
  quizMode?: QuizMode;
  quizQuestionCount?: number;
  createdAt: string;
}

/** A section ("Phần") of a course, with its lessons in display order. */
export interface CourseSection {
  id: string;
  title: string;
  sortOrder: number;
  lessonIds: string[];
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
  /** Short line under the title (≤ 120 characters). */
  subtitle?: string | null;
  description?: string | null;
  module: ProgramModule;
  level?: CourseLevel | null;
  /** "Bạn sẽ học được", one item per line. */
  outcomes?: string[];
  /** API path of the public cover image (use buildMediaUrl); null = program colour. */
  coverUrl?: string | null;
  /** Sum of the lessons' minutes (lessons without minutes count 0). */
  totalDurationMinutes?: number;
  /** Set by an admin, always with its real source; null = no rating block. */
  rating?: { value: number; source: string } | null;
  /**
   * Real reviews from learners who bought the course (visible ones only).
   * `average` is null until REVIEWS_MIN_TO_SHOW reviews; never merged with `rating`.
   */
  reviews?: ReviewSummary;
  /** Accounts that can open the course (open enrollments). */
  learnerCount?: number;
  /** Offline-class learners, shown apart ("+80 lớp offline"), never added to learnerCount. */
  offlineLearnerCount?: number | null;
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
  /** Last change to the course's own fields (not its lessons or documents). */
  updatedAt?: string;
  /** Sections in order; empty or missing = the lessons are a flat list. */
  sections?: CourseSection[];
  /** In display order: section by section, lessons without a section last. */
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
  /** "VK-1000001" when the learner bought the course via PayOS (granted list only; never the amount). */
  paidOrderCode?: string | null;
  /** Lessons of the course the learner has completed (granted list only). */
  completedLessons?: number;
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

export type StatsPeriod = '30d' | 'month' | 'year';

/** GET /admin/stats: every figure is counted from the database. */
export interface AdminDashboardStats {
  period: StatsPeriod;
  users: { total: number; admins: number; teachers: number; students: number; locked: number; newInPeriod: number };
  courses: {
    total: number;
    published: number;
    lessons: number;
    documents: number;
    /** Published paid courses without a price (no buy button yet). */
    unpriced: Array<{ id: string; title: string }>;
  };
  enrollments: { open: number; purchased: number; manual: number };
  orders: { paid: number; revenueVnd: number; expired: number; refunded: number; needsReview: number };
  revenueSeries: {
    bucket: 'day' | 'month';
    /** start is YYYY-MM-DD in Vietnam time. */
    points: Array<{ start: string; orders: number; revenueVnd: number }>;
  };
  topCourses: Array<{ courseId: string | null; title: string; orders: number; revenueVnd: number }>;
}

export type OrderStatus ='PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED' | 'REFUNDED';

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

/** A word of a lesson (GET /lessons/:id/vocabulary). Pinyin always has tone marks. */
export interface VocabularyItem {
  id: string;
  lessonId: string;
  hanzi: string;
  pinyin: string;
  meaningVi: string;
  exampleZh: string | null;
  exampleVi: string | null;
  audioOverride: boolean;
  hasAudio: boolean;
  audioOriginalName: string | null;
  /** Media API path when audioOverride is enabled and an audio file exists; null = built-in TTS. */
  audioPath: string | null;
  sortOrder: number;
}

export interface ChoiceQuizPayload {
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export interface ListenQuizPayload {
  ttsText: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export interface OrderQuizPayload {
  pieces: string[];
  meaningVi?: string;
}

export interface FillQuizPayload {
  before: string;
  after: string;
  answerHanzi: string;
  answerPinyin?: string;
  meaningVi?: string;
}

export interface MatchQuizPayload {
  pairs: Array<{ left: string; right: string }>;
}

export type QuizQuestionPayload =
  | ChoiceQuizPayload
  | ListenQuizPayload
  | OrderQuizPayload
  | FillQuizPayload
  | MatchQuizPayload;

/** One manual quiz question configured by a teacher (GET/PUT /lessons/:lessonId/quiz). */
export interface LessonQuizQuestionItem {
  id: string;
  lessonId: string;
  kind: QuizQuestionKind;
  vocabularyId: string | null;
  prompt: string | null;
  payload: QuizQuestionPayload;
  audioOverride: boolean;
  hasAudio: boolean;
  audioOriginalName: string | null;
  audioPath: string | null;
  sortOrder: number;
}

export interface LessonQuizConfig {
  lessonId: string;
  quizMode: QuizMode;
  questions: LessonQuizQuestionItem[];
}

/** A private note on a lesson (GET /notes/lessons/:lessonId). */
export interface LessonNote {
  id: string;
  lessonId: string;
  courseId: string;
  body: string;
  /** Second of the uploaded video the note refers to, or null. */
  videoSeconds: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface QaAuthor {
  fullName: string;
  role: Role;
}

export interface LessonAnswer {
  id: string;
  body: string;
  createdAt: string;
  author: QaAuthor;
  canDelete: boolean;
}

export interface LessonQuestion {
  id: string;
  lessonId: string;
  body: string;
  createdAt: string;
  author: QaAuthor;
  mine: boolean;
  canDelete: boolean;
  answers: LessonAnswer[];
}

/** GET /questions/lessons/:lessonId */
export interface LessonQuestionList {
  /** The caller is the course's teacher or an admin. */
  canAnswer: boolean;
  questions: LessonQuestion[];
}

// Course reviews (#41) -------------------------------------------------------

export interface ReviewSummary {
  /** One decimal; null below the display threshold (3 visible reviews). */
  average: number | null;
  count: number;
}

export interface ReviewReply {
  body: string;
  repliedAt: string;
}

/** A visible review as anyone sees it. */
export interface PublicReview {
  id: string;
  stars: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  /** Shortened, e.g. "N. V. An". */
  authorName: string;
  reply: ReviewReply | null;
}

/** The learner's own review, with its moderation state. */
export interface OwnReview extends PublicReview {
  isHidden: boolean;
  hiddenReason: string | null;
}

/** Teacher / admin view. */
export interface ManagedReview extends OwnReview {
  courseId: string;
  studentName: string;
  hiddenAt: string | null;
  course?: { id: string; title: string };
}

export interface ReviewPage<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

/** GET /courses/:id/reviews */
export interface PublicReviewPage extends ReviewPage<PublicReview> {
  summary: ReviewSummary;
}

/** GET /courses/:id/reviews/manage */
export interface ManagedReviewPage extends ReviewPage<ManagedReview> {
  unanswered: number;
  summary: ReviewSummary;
}

/** GET /courses/:id/reviews/mine */
export interface MyReviewState {
  canReview: boolean;
  /** Why not, in Vietnamese; null when canReview. */
  reason: string | null;
  review: OwnReview | null;
}

/**
 * POST /lessons/upload-url. `direct: true` (bucket storage): PUT the file to
 * `uploadUrl` with `headers`, then confirm with `storageKey` + `uploadToken`.
 * `direct: false` (local storage): send the usual multipart upload.
 */
export type VideoUploadTicket =
  | { direct: false }
  | {
      direct: true;
      uploadUrl: string;
      method: 'PUT';
      headers: Record<string, string>;
      expiresAt: string;
      storageKey: string;
      uploadToken: string;
    };

/** GET / PUT /reminders/settings: the daily review reminder by email. */
export interface ReviewReminderSettings {
  enabled: boolean;
}
