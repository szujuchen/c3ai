import { ForbiddenError, UnauthorizedError } from '../../../../shared/errors.js';

// Every route after login needs a session.
export const authenticate = ({ sessions }) => (req, _res, next) => {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? '');
  const session = m && sessions.get(m[1]);
  if (!session) return next(new UnauthorizedError('Log in first'));
  req.session = session;
  req.sessionToken = m[1];
  next();
};

export const requireRole = (...roles) => (req, _res, next) => (
  roles.includes(req.session.role) ? next() : next(new ForbiddenError(`The ${req.session.role} role can't do that`))
);

// /students/:id/... : a student only reaches their own; an admin reaches anyone's.
export function studentAccess(req, _res, next) {
  const { role, studentId } = req.session;
  if (role === 'admin' || (role === 'student' && studentId === req.params.id)) return next();
  next(new ForbiddenError("You can only see your own data"));
}
