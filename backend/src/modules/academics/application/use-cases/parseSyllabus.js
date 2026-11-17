import { ValidationError } from '../../../../shared/errors.js';
import { parseExam } from '../../domain/syllabusParser.js';

export function parseSyllabus({ text } = {}) {
  if (typeof text !== 'string') throw new ValidationError('text must be a string');
  return { exam: parseExam(text) };
}
