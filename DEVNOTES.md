# Dev Notes

Running log of progress, decisions, and open questions. Newest entries go at the top of each section.
Source of truth for product intent: the Campus Pulse hackathon design doc (see section 5 for how the code differs from it).

**Last updated:** 2026-11-17

---

## 1. Current status

| Track | State |
| --- | --- |
| MVP prototype, upstream features (syllabus upload, campus events) | Done and merged into the new structure. |
| Frontend/backend split with DDD-style modules | Done. |
| Real Canvas (courses, assignments, calendar events, syllabus exam suggestions) | Done. Verified offline and live. |
| Login with student / host / admin roles, enforced by the API | Done (demo login; optional passwords). |
| Student view: day / week / month, timetable, stress level, campus events list with filters, event details with preview and register | Done. |
| Host view: availability heatmap, audience by major / year / course, top slots, best dates, mock-only events with crowding verdicts | Done. |
| Admin: any student, heat split into coursework and events | Done. |
| Host 3D month heatmap (ported from the owner's `add/` prototype) alongside the 2D slots, with a mode switch | Done. `add/` was deleted at the owner's request. |
| Google Calendar | Hidden in the UI (API still supports it behind a `gcal` flag). |
| Everything above | **Not committed yet** (staged in the working tree). |

**Open questions for the owner** are in section 3.

Run: `npm install && npm run dev` (web `:5173`, API `:3001`). Tests: `npm test`, `npm run test:ui`, `npm run test:live -w backend`.

---

## 2. Decisions log

| Date | Decision | Why |
| --- | --- | --- |
| 2026-11-17 | Refactor must preserve behavior, scoring output, and UI exactly. | Original brief. Verified by golden-master tests and a rendered-HTML diff (section 6). |
| 2026-11-17 | Frontend/backend separation first; DDD kept lightweight. | Original brief. Empty `repositories/` and `entities/` folders and a `hooks/` folder were not created; JS has no interfaces, so repositories are injected objects. |
| 2026-11-17 | Plan approved with the recommended options: hosted events in **backend memory**, **Vite** (dev proxy and build, vanilla JS), **Express** on **Node**, keep the name **Crunch Calendar**, API names aligned with the design doc. | Existing scoring is JS, so a Node port keeps behavior identical. FastAPI/React from the design doc are left as future options. |
| 2026-11-17 | Backend returns structured advice (`startAssignment`, `optionalEvents`, `relaxEvents`, `tip`), never display text. | Business rules (what to recommend) live in the domain; wording stays in the UI so the markup is unchanged. |
| 2026-11-17 | Merging upstream: old files were deleted/moved by the refactor, so the two upstream commits could not be rebased line by line. Rebased onto `origin/main` (fast-forward), restored the refactor from a stash, then **ported** the upstream behavior into the new modules. The stash entry `stash@{0}` was dropped once its contents were verified present. | Cleaner than resolving conflicts in files that no longer exist. |
| 2026-11-17 | Syllabus parsing, the "missing exam" rule, event notes and the 2-break cap are backend rules; file reading and the upload form stay in the frontend. | Business rules in the domain; browser APIs in the UI. |
| 2026-11-17 | Added two guards upstream did not have: a second exam for a course that already has one returns 409, and exam time/date/type are validated (400). | Unreachable from the UI, but the shared-write endpoint would otherwise accept duplicates from two tabs. |
| 2026-11-17 | Canvas integration uses the owner's endpoint list (`/courses` with term + syllabus_body, `/courses/{id}/assignments`, `/calendar_events`) rather than the Planner API. Token comes from `backend/.env` (`CANVA_TOKEN`) or a pasted token; used per request and never stored, returned or logged. Base URL is server config only, and paging links are only followed on that host. One addition to the list: `include[]=submission` so already-submitted work adds no workload. | Safety (no SSRF, no token leaks) and correct workload. |
| 2026-11-17 | **Roles are enforced by the API**, not just the UI. Demo login: pick a role (and, for a student, who); the server issues an in-memory session token and checks the role on every route. A student reaches only their own `/students/:id/*`; a host reaches only campus-wide aggregates; an admin reaches everything. Optional per-role passwords via `LOGIN_PASSWORD_*`. | Real data is now in the app, so hiding buttons is not protection. No accounts: this is a demo login, and anyone who can reach the server can log in unless passwords are set. |
| 2026-11-17 | **Hosts are mock-only.** The persisted "Schedule at #1" and `GET`/`POST /events` were removed. Mock events live in the host's browser, are sent with each request, count only as clashes in the ranking, and are never stored or shown to students. | Owner: organizers "can only mock insert event, never add it to the actual thing". |
| 2026-11-17 | Hosts no longer see Google Calendar (personal) events on the heatmap; they see availability aggregates only. | Hosts must not see individuals. |
| 2026-11-17 | Students get only their own rows from `/students`, `/canvas/*`, `/calendar/events`, so the demo "Synced N events" toast now counts their own. | Same reason. |
| 2026-11-17 | **Stress level** uses the design doc formula and weights unchanged (watch 60 / high 75 / critical 90), with a neutral mood of 3 since there is no check-in yet. It is additive: the existing burnout alert is unchanged. | Doc says "tune on demo data"; with a 6 h cap about 4 h a day lands near 30. |
| 2026-11-17 | Campus events now count toward a student's load whenever they registered, **without needing Google Calendar connected**. Upstream only counted them with Google Calendar on. | Google Calendar is hidden, so otherwise registering would do nothing. Golden tests skip the `canvas`-only combo for the registered scenario. |
| 2026-11-17 | Student calendar follows the owner's "My week" reference: time grid 7 AM to midnight, classes, study blocks, deadline chips, start-studying chips, now line. Study blocks are placed by the server (greedy, blocks of at most 2 h, 1 to 10 PM, around classes and events; the rest is reported). Classes come from course meeting times (demo courses only). | Owner's reference UI. Needed per-hour data the model did not have. |
| 2026-11-17 | Host heatmap follows the owner's reference: days x seven 2-hour slots, availability % and expected turnout per tile, ranked top slots. The availability model is a simplified version of the reference's description (see README "How the scores work"). | Owner's reference UI. |
| 2026-11-17 | Syllabus exam dates found in Canvas are *suggestions* the student confirms, never auto-added. | A confirmed exam date is shared with the whole course. |
| 2026-11-17 | `GET /calendar/events` returns Google Calendar events only; hosted events are at `GET /events`. | The "Synced N events" toast counts only calendar events. The host view merges both, as the original did. |
| 2026-11-17 | `GET /students/:id/workload` returns a per-day summary; item lists come from `GET /students/:id/days/:date`. | Keeps the month response small; the day panel needs one extra call. |

---

## 3. Open questions and next steps

00. **Adding events as a host:** a modal (name, date, type) creates a **mock** event, since hosts are mock-only. It is held in the browser and sent with each request as `{ type, date, name? }`. If hosts should be able to publish real events, that reverses the mock-only decision and needs the owner's say-so.

0. **3D month, notes.** Ported as-is except: "Schedule at #1" became "Try ... (mock)" (hosts are mock-only), campus events and mock events (not personal calendars) are the dots, and the scoring now lives on the server (`POST /event-fit`, from `scheduling/domain/services/eventFit.js`; `bestDates` and `eventFit` share one formula). The owner's prototype predated campus events, so its data was not used. **Not verified:** the last UI test run was stopped at the owner's request after 20 of 21 passed; the one remaining failure was a wrong assumption in the test (the mock event's date is outside the 2D default range), which was fixed but not re-run. Backend: 231 tests passed before the stop.

1. **Best-date ranking formulas.** The owner pasted the design doc's ranking rules (top 5 slots; relax = peak over the next 1 to 3 days minus `|I - 70|`, with a penalty on exam days; clash penalty only for events with the same audience and type). The app still uses the upstream formulas (top 3; relax = peak over the next 2 days minus `|I - 60|`; no exam-day penalty; clashes counted campus-wide). It was unclear whether this was meant for the host's "Best dates" list or the student event filters, so nothing was changed. **Decide:** switch the host ranking to the doc's formulas? It changes results the golden tests currently pin, which would be re-baselined.
2. **Student event filters.** The owner's message about filters was cut off by that paste. Built: All, Recruiting, Relax, Social, Registered. Tell me if others are wanted (for example "heavy day for me", or by date).
3. **Real accounts.** The login is a role picker. Per-student Canvas tokens, and anything public, need real authentication.
4. **Configurable term.** The calendar is fixed to December 2026, so a real Canvas import fills only that window (2 of 44 sampled assignments). Making the term configurable also means changing the "December 2026" text in the views.
5. **Privacy floor for hosts.** The design doc hides audiences under 10 to 15 students. The demo has 5 students, so enforcing it would hide everything. Turnout figures are tiny for the same reason (about 0 to 1).
6. **Mood check-in** (feeds the stress level), **`.ics` feed**, **syllabus file download**, **CMU events feed**: not built.
7. **Hosting and the name** (Campus Pulse vs Crunch Calendar): still open.

---

## 4. API (as built)

Differences from the design doc's endpoints are intentional (see section 2). Full table is in the README.

| Doc endpoint | Built |
| --- | --- |
| `GET /students/{id}/workload` | Yes, includes the burnout alert and advice (no separate `/burnout`) |
| `GET /intensity?audience=` | Yes (`audience=all` or a major) |
| `POST /recommend-date` | Yes, returns the top 3 (doc says 5) |
| `POST /events` | Yes, plus `GET /events` |
| `POST /students/{id}/plan`, `PATCH /blocks/{id}`, `/checkin` | Not built (cut from the MVP) |

Also added for the "Connect" buttons: `GET /term`, `/students`, `/canvas/courses`, `/canvas/assignments`, `/calendar/events`, and `GET /health`.

---

## 5. Design doc vs current code (known gaps)

These are **not** to be fixed during the refactor, because behavior must stay unchanged. Each is a candidate follow-up.

| Area | Design doc | Current code |
| --- | --- | --- |
| Lead windows | 7 days for exams/projects, 3 for homework | `homework/quiz/lab: 3`, `project: 5`, `midterm/final: 4` |
| Burnout model | Risk score 0-100 (sigmoid of load, streak, deadlines, mood). Watch 60+, High 75+, Critical 90+ or 3+ days above 75 | No score. Alert = 3+ consecutive days at or over cap. Critical if 4+ days or peak over 1.5x cap, otherwise High |
| Campus intensity | Mean risk plus an events penalty | Mean of `min(load/cap, 1.5)` scaled to 0-100 |
| Relax ranking | Peak over next 1-3 days minus `abs(I-70)`, penalty on exam days | Max over next 2 days minus `abs(I-60)`, no exam-day penalty |
| Recruiting / General ranking | `100 - I - 0.5*max(next 2)`, `100 - abs(I-40)` | Same formulas |
| Clash penalty | 15 per same-audience, same-type event | 15 per same-type event on that day (no audience check) |
| Top results | Top 5 slots | Top 3 dates |
| Privacy | k-anonymity floor: hide aggregates under 10 students | None. The mock seed has only 5 students, so a floor would hide everything |
| Seed data | 300 students, 40 courses, 25 events | 5 students, 4 courses, 8 events |
| Study plan, mood check-in, `.ics` export, layers toggle | Specified | Not built (cut for MVP in the doc's own build plan) |
| Host inputs | Event type, audience, duration, date window | Event type and major filter only; fixed 6-7:30 PM slot |

---

## 6. Refactor and merge checklist

- [x] Refactor into `frontend/` + `backend/` (see README), legacy root files removed
- [x] Golden-master fixture generated from the original code before anything moved
- [x] Rebased onto `origin/main` (fast-forward over 2 upstream commits), refactor restored from stash
- [x] Golden fixture **regenerated from the upstream code** (now covers registrations, syllabus exams, 2-break cap, relax = no load, event notes, exam parser; two scenarios: fresh and "full")
- [x] Upstream features ported: syllabus upload, missing-exam rule, shared exams, campus events + registration, event notes, host heatmap pins for campus events
- [x] README conflict resolved (refactor README + upstream demo script and missing-exam docs)
- [x] Canvas integration: client, mapping, import use case, endpoints, UI, offline tests, live test
- [ ] Manual click-through in a real browser (no browser tooling here)
- [ ] Commit

### Verification log (latest)

- `npm test`: **214 backend tests, all pass.** Golden-master comparisons against the original code (every student, day, audience, event type, campus event note and syllabus-parse case), plus rule tests for roles and login, stress, the event/coursework split, event preview, crowding, study-block placement, the week layout, availability, the Canvas client (against a fake Canvas: parameters, paging, 401/403/502, Eastern-time conversion, the token never in a response, no paging link followed to another host), and the HTTP API.
- `npm run test:ui`: **11 browser-style tests pass** (jsdom against the real API): login for each role, student views (day/week/month, filters, the event modal opening, previewing and closing four ways, registering), host heatmap (pin a slot, mock events, audiences), admin (both tabs, split heat), logout. It fails if the modal-close bug is put back.
- `npm run test:live -w backend` against the real Canvas (token from `backend/.env`): 6/6 pass. 9 active courses; `term`, `syllabus_body`, `submission` and `due_at` present as expected. Counts only are printed.
- Bugs caught along the way: impossible dates returned 500 (now 400); `getAvailability` ignored a `to` date because of operator precedence; the event modal could not be closed (it was drawn from cached data instead of the state).
- Not done: a manual click-through in a real browser, and looking at the finished visual design (no browser here).

---

## 7. Risks and caveats

- **Deploy:** the README no longer works as "open `index.html`" and GitHub Pages alone cannot host the API. Needs a hosting decision before the demo.
- **State is shared and in memory:** hosted events, syllabus exams and event registrations are held in server memory and shared by every visitor, until the server restarts. Registrations are not tied to a logged-in user (there is no login yet). Fine for a demo, wrong for production.
- **Student view now makes 4 requests per change** (workload, then day detail, exams and campus events in parallel). Instant locally.
- **Latency:** every view change is now a network call (two sequential ones for the student view). Instant locally; if it feels slow once deployed, fetch the day detail in parallel or cache the month response.
- **`npm audit`** reports a high-severity ReDoS in `picomatch`, pulled in by Vite's file-globbing dependencies. Dev tooling only, not shipped to users, and the suggested "fix" is a Vite downgrade. Revisit when Vite updates.
- **Real Canvas data is sparse in the app:** the calendar is fixed to December 2026 (`term` in `backend/src/shared/config.js`, and "December 2026" / "Dec 1 – 18" text in the views). A live import found only 2 assignments in that window out of 44. Making the term configurable is the next step if the demo should show real data.
- **The login is a demo.** Set `LOGIN_PASSWORD_ADMIN` at least before anyone else can reach the server, especially with a real Canvas token configured.
- **Hackathon timeline:** the design doc's build plan is a 90-minute, browser-only build. Confirm the refactor is intended for after the demo.

---

## 8. Changelog

| Date | Change |
| --- | --- |
| 2026-11-17 | Added roles and login, the timetable student calendar, stress level, the events list with filters, the event modal with preview, the host availability heatmap with mock-only events, and the admin split heat. Google Calendar hidden. 214 backend tests, 11 UI tests. |
| 2026-11-17 | Connected real Canvas (courses, assignments, calendar events, syllabus suggestions); live and offline tests; import button in the student view. |
| 2026-11-17 | Merged upstream `f9ca598` and `b80f53e` into the refactored structure (syllabus upload, campus events, registration). 103 backend tests; 48-step UI parity check against upstream. New feature requests recorded in section 3. |
| 2026-11-17 | Refactor implemented: `frontend/` + `backend/` (Node, Express, DDD-style modules `academics`, `workload`, `scheduling`), tests, README. Legacy root files removed. |
| 2026-11-17 | Created this note. Architecture proposal delivered; design doc reviewed and gaps recorded. |
