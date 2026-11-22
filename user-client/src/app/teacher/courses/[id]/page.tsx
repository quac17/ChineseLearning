import { redirect } from 'next/navigation';

/** /teacher/courses/:id opens the first tab. */
export default function CourseEditorIndex({ params }: { params: { id: string } }) {
  redirect(`/teacher/courses/${params.id}/info`);
}
