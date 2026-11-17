import { ValidationError } from '../../../../shared/errors.js';
import { withRegistrations } from '../../../academics/application/sources.js';

// The students a host is targeting. Forms: "all", "major:CS", "year:3", "course:101" (and a bare major like "CS").
// Registered campus events count toward their load.
export function resolveAudience(deps, audience = 'all') {
  const all = deps.academics.students();
  const [kind, value] = audience === 'all' ? ['all'] : audience.includes(':') ? audience.split(':') : ['major', audience];
  const matchers = {
    all: () => true,
    major: (s) => s.major === value,
    year: (s) => s.year === Number(value),
    course: (s) => s.course_ids.includes(Number(value)),
  };
  if (!matchers[kind]) throw new ValidationError(`Unknown audience "${audience}"`);
  const picked = all.filter(matchers[kind]);
  if (kind !== 'all' && !picked.length) throw new ValidationError(`Unknown audience "${audience}"`);
  return picked.map((s) => withRegistrations(deps, s));
}
