import { NotFoundError } from '../../../../shared/errors.js';
import { campusFeed } from '../sources.js';

// Register a student for a campus event, or take the registration back. Safe to repeat.
export function setRegistration(deps, studentId, eventId, registered) {
  const { academics, registrations } = deps;
  if (!academics.student(studentId)) throw new NotFoundError(`Student "${studentId}" not found`);
  const event = campusFeed(deps).find((e) => e.id === eventId);
  if (!event) throw new NotFoundError(`Event "${eventId}" not found`);
  if (registered) registrations.add(studentId, eventId); else registrations.remove(studentId, eventId);
  return { eventId, registered, date: event.start.dateTime.slice(0, 10) };
}
