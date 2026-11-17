import { request } from '../../../shared/api/client.js';

// When is the audience free? Aggregates only. `audience` is "all", "major:CS", "year:3" or "course:101".
export const getAvailability = ({ audience, from, to }) => request('/availability', { query: { audience, from, to } });
export const recommendDate = (type, audience, mockEvents) => request('/recommend-date', { method: 'POST', body: { type, audience, mockEvents } }).then((r) => r.picks);
// Would these mock events be too crowded? Nothing is saved, and students never see them.
export const previewCrowding = (audience, mockEvents) => request('/preview/crowding', { method: 'POST', body: { audience, mockEvents } });

// How well each day suits an event type, plus campus workload, for the 3D month. Aggregates only.
export const getEventFit = ({ type, audience, mockEvents }) => request('/event-fit', { method: 'POST', body: { type, audience, mockEvents } });
