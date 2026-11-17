import { ValidationError } from '../../../../shared/errors.js';
import { assertDayInTerm } from '../../../../shared/term.js';
import { createMockEvent, HOST_TYPES } from '../../domain/entities/mockEvent.js';

const MAX_MOCK_EVENTS = 20;

// Validates the host's mock events from the request and shapes them as calendar events.
export function parseMockEvents(raw, term) {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > MAX_MOCK_EVENTS) throw new ValidationError(`mockEvents must be a list of at most ${MAX_MOCK_EVENTS}`);
  return raw.map((m, i) => {
    if (!m || !HOST_TYPES.includes(m.type)) throw new ValidationError(`type must be one of: ${HOST_TYPES.join(', ')}`);
    assertDayInTerm(m.date, term);
    return createMockEvent({ id: `mock-${i + 1}`, type: m.type, date: m.date });
  });
}
