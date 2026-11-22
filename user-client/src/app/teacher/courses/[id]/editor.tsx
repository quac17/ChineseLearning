'use client';

import { createContext, useContext } from 'react';
import type { CourseItem } from '@/lib/types';

export interface EditorContextValue {
  course: CourseItem;
  /** Fetches the course again (after a save elsewhere on the page). */
  reload: () => Promise<void>;
  /** Local update without a round trip (optimistic reorder, counts). */
  setCourse: (update: (c: CourseItem) => CourseItem) => void;
}

export const EditorContext = createContext<EditorContextValue | null>(null);

/** The course open in the editor (app/teacher/courses/[id]/layout.tsx). */
export function useEditorCourse(): EditorContextValue {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useEditorCourse must be used inside the course editor layout');
  return ctx;
}
