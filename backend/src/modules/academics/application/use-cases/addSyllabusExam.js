import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../../../shared/errors.js';
import { isDayKey } from '../../../../shared/dateKeys.js';
import { courseHasExam, createSyllabusExam, EXAM_TYPES } from '../../domain/exams.js';
import { allAssignments } from '../sources.js';

const studentsIn = (academics, courseId) => academics.students().filter((s) => s.course_ids.includes(courseId)).length;

// An enrolled student adds an exam date Canvas is missing. It is shared with the whole course.
export function addSyllabusExam(deps, courseId, { studentId, type = 'final', date, time = '09:00' } = {}) {
  const { academics, syllabusExams } = deps;
  const course = academics.course(courseId);
  if (!course) throw new NotFoundError(`Course ${courseId} not found`);
  const student = academics.student(studentId);
  if (!student) throw new NotFoundError(`Student "${studentId}" not found`);
  if (!EXAM_TYPES.includes(type)) throw new ValidationError(`type must be one of: ${EXAM_TYPES.join(', ')}`);
  if (!date) throw new ValidationError('Pick a date first');
  if (!isDayKey(date)) throw new ValidationError('date must be a valid YYYY-MM-DD day');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new ValidationError('time must be HH:MM');
  if (!student.course_ids.includes(courseId)) throw new ForbiddenError('Only enrolled students can add exam dates');
  if (courseHasExam(courseId, allAssignments(deps))) throw new ConflictError(`${course.course_code} already has an exam date`);

  const exam = syllabusExams.add(createSyllabusExam({ id: 9000 + syllabusExams.list().length, courseId, type, date, time, addedBy: student.name }));
  return { exam, sharedWith: studentsIn(academics, courseId) };
}
