import { UnauthorizedError, UpstreamError } from '../../../../shared/errors.js';

// Reads a student's data from the Canvas LMS REST API with their personal access token.
// The token is used for the calls in one request and is never stored, logged, or put in an error message.
//   GET /api/v1/courses                              the student's active courses (with term and syllabus)
//   GET /api/v1/courses/{id}/assignments             a course's assignments, with the student's submission
//   GET /api/v1/calendar_events                      classes and events for those courses
export function createCanvasClient({ baseUrl, fetchImpl = fetch, timeoutMs = 15000, maxPages = 20 }) {
  const base = new URL(baseUrl);
  const local = ['localhost', '127.0.0.1'].includes(base.hostname);
  if (base.protocol !== 'https:' && !local) throw new Error('The Canvas base URL must use https');

  // Canvas pages results; the next page is in the Link header. Only follow links that stay on the Canvas host,
  // so the token is never sent anywhere else.
  const nextUrl = (link) => {
    const m = /<([^>]+)>\s*;\s*rel="next"/.exec(link || '');
    if (!m) return null;
    try { const u = new URL(m[1], base); return u.origin === base.origin ? u : null; } catch { return null; }
  };

  async function getAll(path, params, token) {
    let url = new URL(path, base);
    for (const [k, v] of params) url.searchParams.append(k, v);
    const out = [];
    for (let page = 0; url && page < maxPages; page++) {
      let res;
      try {
        res = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) });
      } catch {
        throw new UpstreamError('Could not reach Canvas');
      }
      if (res.status === 401 || res.status === 403) throw new UnauthorizedError('Canvas rejected that token or denied access');
      if (!res.ok) throw new UpstreamError(`Canvas returned an error (${res.status})`);
      const body = await res.json().catch(() => null);
      if (!Array.isArray(body)) throw new UpstreamError('Canvas sent a response this app does not understand');
      out.push(...body);
      url = nextUrl(res.headers.get('link'));
    }
    return out;
  }

  return {
    courses: (token) => getAll('/api/v1/courses', [['include[]', 'term'], ['include[]', 'syllabus_body'], ['enrollment_state', 'active'], ['per_page', '100']], token),
    // `include[]=submission` lets us leave out work the student already turned in.
    assignments: (token, courseId) => getAll(`/api/v1/courses/${courseId}/assignments`, [['include[]', 'submission'], ['per_page', '100']], token),
    calendarEvents: (token, courseIds, { start, end }) => getAll('/api/v1/calendar_events', [
      ...courseIds.map((id) => ['context_codes[]', `course_${id}`]), ['type', 'event'], ['start_date', start], ['end_date', end], ['per_page', '100'],
    ], token),
  };
}
