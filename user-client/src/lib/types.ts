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
