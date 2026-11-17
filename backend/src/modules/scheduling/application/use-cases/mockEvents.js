import { ValidationError } from '../../../../shared/errors.js';
import { assertDayInTerm } from '../../../../shared/term.js';
import { createMockEvent, HOST_TYPES, SLOT_START_HOURS } from '../../domain/entities/mockEvent.js';

const MAX_MOCK_EVENTS = 20;
export const MAX_NAME_LENGTH = 80;

// Validates the host's mock events from the request and shapes them as calendar events.
export function parseMockEvents(raw, term) {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > MAX_MOCK_EVENTS) throw new ValidationError(`mockEvents must be a list of at most ${MAX_MOCK_EVENTS}`);
  return raw.map((m, i) => {
    if (!m || !HOST_TYPES.includes(m.type)) throw new ValidationError(`type must be one of: ${HOST_TYPES.join(', ')}`);
    assertDayInTerm(m.date, term);
    if (m.name !== undefined && typeof m.name !== 'string') throw new ValidationError('name must be text');
    const name = m.name?.trim();
    if (name && name.length > MAX_NAME_LENGTH) throw new ValidationError(`name must be at most ${MAX_NAME_LENGTH} characters`);
    if (m.startHour !== undefined && !SLOT_START_HOURS.includes(m.startHour)) throw new ValidationError(`startHour must be one of: ${SLOT_START_HOURS.join(', ')}`);
    return createMockEvent({ id: `mock-${i + 1}`, type: m.type, date: m.date, name, startHour: m.startHour });
  });
}
