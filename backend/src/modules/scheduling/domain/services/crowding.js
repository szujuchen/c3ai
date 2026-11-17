// Would a mock event be too crowded? Judged from the campus heat that day, how many events are already on it, and
// how many of them overlap its time slot. A relax event wants a stressed campus, so heat never counts against it.
export const CROWDING = { busyHeat: 50, tooCrowdedHeat: 70, busyEvents: 2, tooCrowdedEvents: 3, busyOverlap: 1, tooCrowdedOverlap: 2 };

export function crowdingVerdict({ type, intensity, sameDayEvents, clashes, overlapping = 0 }) {
  const heat = type === 'relax' ? 0 : intensity;
  const tooCrowded = heat >= CROWDING.tooCrowdedHeat || sameDayEvents >= CROWDING.tooCrowdedEvents || overlapping >= CROWDING.tooCrowdedOverlap;
  const busy = heat >= CROWDING.busyHeat || sameDayEvents >= CROWDING.busyEvents || overlapping >= CROWDING.busyOverlap;
  const verdict = tooCrowded ? 'too-crowded' : busy ? 'busy' : 'good';

  const why = [];
  if (overlapping) why.push(`${overlapping} other event${overlapping > 1 ? 's' : ''} at the same time`);
  if (type !== 'relax' && intensity >= CROWDING.busyHeat) why.push(`campus is at ${intensity}/100 that day`);
  if (type === 'relax' && intensity >= CROWDING.busyHeat) why.push(`campus is at ${intensity}/100, students need a break`);
  if (sameDayEvents) why.push(`${sameDayEvents} other event${sameDayEvents > 1 ? 's' : ''} that day`);
  if (clashes) why.push(`${clashes} of the same type`);
  const reason = why.length ? why.join(', ') : `quiet day (${intensity}/100) with nothing else on`;
  return { verdict, reason };
}
