import { ValidationError } from '../../../../shared/errors.js';
import { allEvents } from '../../../academics/application/sources.js';
import { HOST_TYPES } from '../../domain/entities/mockEvent.js';
import { eventFit, fitPicks } from '../../domain/services/eventFit.js';
import { getIntensity } from './getIntensity.js';
import { parseMockEvents } from './mockEvents.js';

// How well each day suits an event type, and campus workload, for the 3D heatmap. Aggregates only. Mock events
// count as clashes, as in the ranking, and add no student workload.
export function getEventFit(deps, { type, audience, mockEvents } = {}) {
  if (!HOST_TYPES.includes(type)) throw new ValidationError(`type must be one of: ${HOST_TYPES.join(', ')}`);
  const mocks = parseMockEvents(mockEvents, deps.term);
  const { intensity, studentCount } = getIntensity(deps, { audience });
  const days = eventFit(intensity, type, { from: deps.term.start, to: deps.term.end, events: allEvents(deps).concat(mocks) });
  return { type, studentCount, intensity, days, picks: fitPicks(days) };
}
