import { createServer } from 'node:http';

// A stand-in for Canvas: Bearer auth, paged results with a Link header, and a log of every request it received.
// Mirrors the shapes of GET /courses, GET /courses/:id/assignments and GET /calendar_events.
export async function startFakeCanvas({ token = 'good-token', evilNext = null, forbidAssignmentsFor = [] } = {}) {
  const requests = [];
  const syllabus = '<p>Grading</p><ul><li>Final Exam: Tuesday, December 15, 2026, 10:00 AM &amp; Wean Hall</li></ul>';
  const courses = [
    [
      { id: 7001, name: 'Principles of Imperative Computation', course_code: '15-122', term: { name: 'Fall 2026', start_at: '2026-08-24T04:00:00Z', end_at: '2027-01-02T04:59:00Z' }, syllabus_body: '<p>Homework and quizzes only.</p>' },
      { id: 7002, name: 'Matrices and Linear Transformations', course_code: '21-241', term: { name: 'Fall 2026', start_at: null, end_at: null }, syllabus_body: null },
    ],
    [
      { id: 7003, access_restricted_by_date: true },
      { id: 7004, name: 'Physics I', course_code: '33-141', term: { name: 'Fall 2026' }, syllabus_body: syllabus },
      { id: 7005, name: 'Last Spring Seminar', course_code: '99-100', term: { name: 'Spring 2026', start_at: '2026-01-12T05:00:00Z', end_at: '2026-05-10T04:00:00Z' }, syllabus_body: null },
    ],
  ];
  const a = (id, name, due_at, over = {}) => ({ id, name, due_at, points_possible: 10, published: true, submission_types: ['online_upload'], is_quiz_assignment: false, submission: { workflow_state: 'unsubmitted', submitted_at: null }, ...over });
  const assignments = {
    7001: [
      [a(501, 'HW 9: Hash tables', '2026-12-11T04:59:00Z', { points_possible: 50 }), a(506, 'Essay 3 draft', '2026-12-04T04:59:00Z')],
      [
        a(505, 'Reading check 4', '2026-12-04T15:00:00Z', { is_quiz_assignment: true, submission_types: ['online_quiz'] }),
        a(507, 'Undated thing', null),
        a(508, 'Old homework', '2026-11-02T04:59:00Z'),
        a(509, 'Already turned in', '2026-12-08T04:59:00Z', { submission: { workflow_state: 'submitted', submitted_at: '2026-12-01T10:00:00Z' } }),
        a(510, 'Unpublished draft', '2026-12-09T04:59:00Z', { published: false }),
        a(501, 'HW 9: Hash tables (duplicate)', '2026-12-11T04:59:00Z'),
      ],
    ],
    7002: [[a(502, 'Final Exam', '2026-12-14T13:30:00Z', { points_possible: 200 })]],
    7004: [[a(511, 'Lab Report 9', '2026-12-16T04:59:00Z', { points_possible: 30 })]],
  };
  const events = [
    [{ id: 901, title: 'Recitation', start_at: '2026-12-08T15:30:00Z', end_at: '2026-12-08T16:20:00Z', context_code: 'course_7001', all_day: false }],
    [{ id: 902, title: 'Review session', start_at: '2026-12-13T20:00:00Z', end_at: '2026-12-13T22:00:00Z', context_code: 'course_7002', all_day: false }, { id: 903, title: 'Next year', start_at: '2027-02-01T20:00:00Z', end_at: '2027-02-01T21:00:00Z' }],
  ];

  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const query = {};
    for (const [k, v] of url.searchParams) query[k] = k.endsWith('[]') ? [...(query[k] ?? []), v] : v;
    requests.push({ path: url.pathname, query, auth: req.headers.authorization });
    const json = (status, body, headers = {}) => { res.writeHead(status, { 'Content-Type': 'application/json', ...headers }); res.end(JSON.stringify(body)); };
    if (req.headers.authorization !== `Bearer ${token}`) return json(401, { errors: [{ message: 'Invalid access token.' }] });

    const page = Number(url.searchParams.get('page') || 1);
    const send = (pages) => {
      const next = new URL(url);
      next.searchParams.set('page', String(page + 1));
      const link = page < pages.length ? `<${next.href.replace(/^http:\/\/x/, `http://localhost:${server.address().port}`)}>; rel="next"` : evilNext ? `<${evilNext}>; rel="next"` : undefined;
      json(200, pages[page - 1] ?? [], link ? { Link: link } : {});
    };

    if (url.pathname === '/api/v1/courses') return send(courses);
    if (url.pathname === '/api/v1/calendar_events') return send(events);
    const m = /^\/api\/v1\/courses\/(\d+)\/assignments$/.exec(url.pathname);
    if (m) {
      if (forbidAssignmentsFor.includes(Number(m[1]))) return json(403, { errors: [{ message: 'forbidden' }] });
      return send(assignments[m[1]] ?? [[]]);
    }
    json(404, {});
  });
  await new Promise((resolve) => server.listen(0, resolve));
  return { url: `http://localhost:${server.address().port}`, requests, close: () => new Promise((resolve) => server.close(resolve)) };
}
