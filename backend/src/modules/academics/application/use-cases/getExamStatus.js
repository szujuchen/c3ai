import { NotFoundError } from '../../../../shared/errors.js';
import { missingExamCourseIds } from '../../domain/exams.js';
import { allAssignments } from '../sources.js';

// Which of a student's courses still have no exam date, and the exams already added from syllabi.
// "Missing" is only judged once Canvas is connected: before that we don't know what Canvas has.
export function getExamStatus(deps, studentId, { canvas }) {
  const { academics, syllabusExams } = deps;
  const student = academics.student(studentId);
  if (!student) throw new NotFoundError(`Student "${studentId}" not found`);
  const added = syllabusExams.list()
    .filter((e) => student.course_ids.includes(e.course_id))
    .map((e) => ({ ...e, sharedWith: academics.students().filter((s) => s.course_ids.includes(e.course_id)).length }));
  return { missingCourseIds: canvas ? missingExamCourseIds(student, allAssignments(deps)) : [], added };
}
