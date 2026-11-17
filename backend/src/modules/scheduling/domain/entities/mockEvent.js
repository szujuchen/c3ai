export const HOST_TYPES = ['recruiting', 'relax', 'general'];

// The 2-hour slots hosts can pick, the same ones the availability heatmap shows (8-10 AM up to 8-10 PM).
export const SLOT_START_HOURS = [8, 10, 12, 14, 16, 18, 20];
export const SLOT_HOURS = 2;
const pad = (n) => String(n).padStart(2, '0');

const TITLES = { recruiting: 'Recruiting', relax: 'Relax / wellness', general: 'General' };

// A host's "what if": an event placed on a date to see the heat and crowding. It is never stored, never shown to
// students and never added to the real calendar. Shaped like a calendar event so the ranking can treat it as one.
// With a `startHour` it fills that 2-hour slot; without one it is 6:00-7:30 PM.
export function createMockEvent({ id, type, date, name, startHour }) {
  const start = startHour === undefined ? '18:00' : `${pad(startHour)}:00`;
  const end = startHour === undefined ? '19:30' : `${pad(startHour + SLOT_HOURS)}:00`;
  return {
    id,
    summary: `${name || `${TITLES[type]} event`} (mock)`,
    start: { dateTime: `${date}T${start}:00-05:00` },
    end: { dateTime: `${date}T${end}:00-05:00` },
    host_type: type,
    mock: true,
  };
}
