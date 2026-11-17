import { allAssignments, allEvents } from '../../../academics/application/sources.js';
import { campusIntensity } from '../../domain/services/campusIntensity.js';
import { resolveAudience } from './audience.js';

// Aggregate-only view of campus load for an audience. Hosts never see individual students.
export function getIntensity(deps, { audience } = {}) {
  const students = resolveAudience(deps, audience);
  const intensity = campusIntensity(students, allAssignments(deps), allEvents(deps), deps.term.start, deps.term.days);
  return { intensity, studentCount: students.length };
}
