import { allEvents } from '../../../academics/application/sources.js';
import { wallMinutes } from '../../../workload/domain/services/calendarItems.js';
import { crowdingVerdict } from '../../domain/services/crowding.js';
import { getIntensity } from './getIntensity.js';
import { parseMockEvents } from './mockEvents.js';

const dayOf = (e) => e.start.dateTime.slice(0, 10);
const overlaps = (a, b) => Math.min(wallMinutes(a.end.dateTime), wallMinutes(b.end.dateTime)) > Math.max(wallMinutes(a.start.dateTime), wallMinutes(b.start.dateTime));

// For each mock event: the campus heat that day, what else is on, and whether it would be too crowded.
export function previewCrowding(deps, { audience, mockEvents } = {}) {
  const mocks = parseMockEvents(mockEvents, deps.term);
  const { intensity, studentCount } = getIntensity(deps, { audience });
  const real = allEvents(deps);
  const events = mocks.map((m) => {
    const date = dayOf(m);
    const others = real.concat(mocks.filter((x) => x !== m)).filter((e) => dayOf(e) === date);
    const clashes = others.filter((e) => e.host_type === m.host_type).length;
    const overlapping = others.filter((e) => overlaps(m, e)).length;
    return { id: m.id, type: m.host_type, date, intensity: intensity[date], sameDayEvents: others.length, clashes, overlapping, ...crowdingVerdict({ type: m.host_type, intensity: intensity[date], sameDayEvents: others.length, clashes, overlapping }) };
  });
  return { events, intensity, studentCount };
}
