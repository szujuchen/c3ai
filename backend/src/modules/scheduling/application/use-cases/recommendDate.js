import { ValidationError } from '../../../../shared/errors.js';
import { HOST_TYPES } from '../../domain/entities/mockEvent.js';
import { bestDates } from '../../domain/services/bestDateRanker.js';
import { allEvents } from '../../../academics/application/sources.js';
import { getIntensity } from './getIntensity.js';
import { parseMockEvents } from './mockEvents.js';

// Mock events count as clashes (so a second mock the same day ranks lower) but add no student workload.
export function recommendDate(deps, { type, audience, mockEvents } = {}) {
  if (!HOST_TYPES.includes(type)) throw new ValidationError(`type must be one of: ${HOST_TYPES.join(', ')}`);
  const mocks = parseMockEvents(mockEvents, deps.term);
  const { intensity } = getIntensity(deps, { audience });
  const picks = bestDates(intensity, type, { from: deps.term.start, to: deps.term.end, hosted: allEvents(deps).concat(mocks) });
  return { picks };
}
