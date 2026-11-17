export const EXAM_TYPES = ['final', 'midterm'];
const EFFORT_H = { final: 12, midterm: 8 };

const isExam = (a) => a.type === 'final' || a.type === 'midterm';

export const courseHasExam = (courseId, assignments) => assignments.some((a) => a.course_id === courseId && isExam(a));

// Courses the student is in that have no final or midterm date yet.
export const missingExamCourseIds = (student, assignments) => student.course_ids.filter((cid) => !courseHasExam(cid, assignments));

// An exam added from a syllabus, shaped like a Canvas assignment so scoring treats it the same.
export function createSyllabusExam({ id, courseId, type, date, time, addedBy }) {
  return {
    id,
    course_id: courseId,
    name: type === 'final' ? 'Final Exam' : 'Midterm',
    due_at: `${date}T${time}:00-05:00`,
    points_possible: 200,
    type,
    effort_h: EFFORT_H[type],
    source: 'syllabus',
    added_by: addedBy,
  };
}
