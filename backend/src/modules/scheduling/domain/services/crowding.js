// Would a mock event be too crowded? Judged from the campus heat that day and how many events are already on it.
// A relax event wants a stressed campus, so heat never counts against it.
export const CROWDING = { busyHeat: 50, tooCrowdedHeat: 70, busyEvents: 2, tooCrowdedEvents: 3 };

export function crowdingVerdict({ type, intensity, sameDayEvents, clashes }) {
  const heat = type === 'relax' ? 0 : intensity;
  const tooCrowded = heat >= CROWDING.tooCrowdedHeat || sameDayEvents >= CROWDING.tooCrowdedEvents;
  const busy = heat >= CROWDING.busyHeat || sameDayEvents >= CROWDING.busyEvents;
  const verdict = tooCrowded ? 'too-crowded' : busy ? 'busy' : 'good';

  const why = [];
  if (type !== 'relax' && intensity >= CROWDING.busyHeat) why.push(`campus is at ${intensity}/100 that day`);
  if (type === 'relax' && intensity >= CROWDING.busyHeat) why.push(`campus is at ${intensity}/100, students need a break`);
  if (sameDayEvents) why.push(`${sameDayEvents} other event${sameDayEvents > 1 ? 's' : ''} that day`);
  if (clashes) why.push(`${clashes} of the same type`);
  const reason = why.length ? why.join(', ') : `quiet day (${intensity}/100) with nothing else on`;
  return { verdict, reason };
}
