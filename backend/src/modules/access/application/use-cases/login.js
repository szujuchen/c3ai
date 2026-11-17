import { createHash, timingSafeEqual } from 'node:crypto';
import { UnauthorizedError, ValidationError } from '../../../../shared/errors.js';
import { ROLES, VIEWS } from '../../domain/roles.js';

const digest = (s) => createHash('sha256').update(String(s ?? '')).digest();

// Demo login: choose a role (and, for a student, who). A role with a configured password needs it.
export function login({ academics, sessions, rolePasswords = {} }, { role, studentId, password } = {}) {
  if (!ROLES.includes(role)) throw new ValidationError(`role must be one of: ${ROLES.join(', ')}`);
  const required = rolePasswords[role];
  if (required && !timingSafeEqual(digest(password), digest(required))) throw new UnauthorizedError('Wrong password');
  let student = null;
  if (role === 'student') {
    student = academics.student(studentId);
    if (!student) throw new ValidationError('Pick which student you are');
  }
  const { token, expiresAt } = sessions.create({ role, studentId: student?.id ?? null });
  return { token, expiresAt, ...whoami({ role, studentId: student?.id ?? null }) };
}

export const whoami = ({ role, studentId }) => ({ role, studentId, views: VIEWS[role] });
