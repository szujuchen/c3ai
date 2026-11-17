export const HOST_TYPES = ['recruiting', 'relax', 'general'];

const TITLES = { recruiting: 'Recruiting', relax: 'Relax / wellness', general: 'General' };

// A host's "what if": an event placed on a date to see the heat and crowding. It is never stored, never shown to
// students and never added to the real calendar. Shaped like a calendar event so the ranking can treat it as one.
export function createMockEvent({ id, type, date }) {
  return {
    id,
    summary: `${TITLES[type]} event (mock)`,
    start: { dateTime: `${date}T18:00:00-05:00` },
    end: { dateTime: `${date}T19:30:00-05:00` },
    host_type: type,
    mock: true,
  };
}
