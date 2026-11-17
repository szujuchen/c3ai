# Crunch Calendar

See the crunch before it hits. One app, three ways in:

- **Students** connect Canvas and see their week as a timetable: classes, deadlines, study blocks and "start studying" markers. They get a stress level, a warning before a burnout stretch, and a list of campus events they can preview and join.
- **Hosts and recruiters** see when campus is free in two modes: a **2D** availability heatmap by day and 2-hour slot, and a **3D month** of columns scored for how well each day suits an event type. They also get the best dates and mock events to check whether a date would be too crowded. Nothing a host does touches the real calendar.
- **Admins** can open both, see any student, and see each day's heat split into coursework and events.

## Run it

Needs Node 20 or newer.

```
npm install
npm run dev
# open http://localhost:5173
```

`npm run dev` starts both apps: the API on `:3001` and the web app on `:5173`. The web app proxies `/api` to the API, so there is no CORS setup in development. `npm run backend` starts the API alone.

| Command | What it does |
| --- | --- |
| `npm run dev` | API (with file watching) and web app together |
| `npm run backend` | The API alone, with file watching |
| `npm test` | Backend tests: scoring rules, roles, syllabus parsing, the Canvas client (against a fake Canvas) and the HTTP API |
| `npm run test:ui` | Drives the built web app in a simulated browser through login, every role's view and the event modal |
| `npm run test:live -w backend` | Checks the Canvas APIs against your real Canvas with your token. Opt-in; prints counts only |
| `npm run build` | Production build of the web app into `frontend/dist` |

### Environment variables

All optional. Put server settings in `backend/.env` (git-ignored; see `backend/.env.example`). Variables already set in the environment win over the file.

| Variable | Used by | Default | Purpose |
| --- | --- | --- | --- |
| `CANVA_TOKEN` (or `CANVAS_TOKEN`) | backend | unset | Your Canvas personal access token. Enables one-click **Connect Canvas** to your real Canvas. Never sent to the browser |
| `CANVAS_BASE_URL` | backend | `https://canvas.cmu.edu` | Which Canvas to talk to. Fixed by the server, never taken from a request |
| `LOGIN_PASSWORD_ADMIN`, `LOGIN_PASSWORD_HOST`, `LOGIN_PASSWORD_STUDENT` | backend | unset | Require a password to log in as that role. Set at least the admin one before anyone else can reach the server |
| `SESSION_HOURS` | backend | `12` | How long a login lasts |
| `PORT` | backend | `3001` | Port the API listens on |
| `CORS_ORIGIN` | backend | unset | Browser origin allowed to call the API directly. Leave unset when the web app and API share an origin or you use the dev proxy |
| `VITE_PROXY_TARGET` | frontend (dev) | `http://localhost:3001` | Where the dev server forwards `/api` |
| `VITE_API_BASE_URL` | frontend (build) | `/api` | API base URL baked into the build. Set it when the API lives on another origin |

## Roles and login

The login screen has three buttons. It is a **demo login**: you choose who you are, there are no accounts. The server issues a session token and **checks the role on every request**, so hiding a button is not what protects the data.

| Role | Can see | Cannot |
| --- | --- | --- |
| Student | Their own calendar, workload, stress, exams and registrations, and the campus events | Anyone else's data; campus-wide aggregates |
| Host | Campus-wide availability, stress and best dates; mock events | Any individual student, course or deadline |
| Admin | Everything, including any student's view and the coursework / events split | Nothing is off limits |

Set `LOGIN_PASSWORD_*` to make a role ask for a password. Without it, anyone who can reach the server can log in as anyone, so keep it local while it holds real Canvas data.

## Using your real Canvas

1. Create a token in Canvas: **Account → Settings → New Access Token**.
2. Put it in `backend/.env` as `CANVA_TOKEN=...` (copy `backend/.env.example`).
3. `npm run dev`, log in as a student, and click **Connect Canvas**. That student's demo courses are replaced with your real ones. (Without a token in `.env`, the button asks you to paste one: it is sent once and not stored. **Use demo data instead** loads the sample data.)

The import uses these Canvas endpoints, with your token as a `Bearer` header and following the `Link` header through every page:

| Canvas endpoint | Used for |
| --- | --- |
| `GET /api/v1/courses?include[]=term&include[]=syllabus_body&enrollment_state=active&per_page=100` | Your courses. Courses from other terms are left out. Syllabi are read for exam dates |
| `GET /api/v1/courses/{id}/assignments?include[]=submission&per_page=100` | Deadlines. Undated, unpublished and already-submitted work is left out |
| `GET /api/v1/calendar_events?context_codes[]=course_{id}&type=event&start_date=…&end_date=…&per_page=100` | Your classes and events |

Notes:

- Canvas times are UTC; they are converted to Eastern time so a deadline of Dec 15, 11:59 PM stays on Dec 15.
- Canvas has no assignment type or effort estimate, so the type is guessed from the title (final, midterm, quiz, project, lab, otherwise homework) and given a default effort. Students can't adjust it yet.
- An exam date found in a syllabus is **offered for you to confirm**. It is not shared with the class until you click **Add for the class**.
- Imported courses have no meeting times, so classes appear in the timetable only for the demo courses. Canvas calendar events do appear.
- The calendar is fixed to **December 2026**, so only deadlines and events inside that window appear.
- Imported data lives in server memory and disappears when the server restarts. `DELETE /api/students/:id/canvas` goes back to the demo data for a student.
- Google Calendar is hidden for now. The API still supports it behind a `gcal` flag, but nothing in the web app turns it on.

## Demo script

1. **Log in as a student** (Maya), then **Connect Canvas** (or **Use demo data instead**). She looks "On track": her Physics final isn't in Canvas.
2. In **Exam dates missing from Canvas**, click **Upload syllabus** next to 33-141 and pick `samples/33-141_syllabus.txt`. The app finds "Final Exam: Tuesday, December 15, 10:00 AM". Click **Add for the class**: the exam is shared with every student in the course, and Maya's banner turns red.
3. The banner shows a **Critical** burnout stretch (Dec 11–15) with fixes. The **Stress level** card shows her peak.
4. Switch the calendar between **Day**, **Week** and **Month**. In the week view, deadlines sit at their due time and study blocks are placed around her classes.
5. In **Campus events**, filter by type, then click the Jane Street info session. The details show what it would do to her Dec 12 (over her cap, stress up). **Register** adds it to her calendar.
6. **Log out and log in as a host.** The heatmap shows when campus is free, in 2D time slots or a 3D month. Click **Add a mock event** (or pin a slot first), then set the event's name, date and type: it says whether that day would be too crowded. Nothing is saved, and the student never sees it.
7. **Log in as an admin.** The month calendar shows each day's heat in two colors: coursework and events.

## Missing exam dates

Syllabi often have exam dates that never make it into Canvas. A student can upload the syllabus (or type the date). The app reads the exam date from the text, the student confirms it, and it's added for everyone in that course and to campus intensity. Students not enrolled in a course can't add dates for it, and a course that already has an exam date can't get a second one. The demo reads text files; PDF parsing is a next step (replace `parseExam` in `backend/src/modules/academics/domain/syllabusParser.js`). A sample is in `samples/33-141_syllabus.txt`.

## Architecture

Two apps with one job each. All scoring and business rules live in the backend; the frontend draws what the API returns and keeps only UI state.

```
frontend/                         Vanilla JS + Vite. No framework.
  src/
    app/                          Login screen, tabs by role, loading and error state
    features/
      student/                    Timetable, stress, events list, event modal, exam upload
      host/                       2D availability heatmap, 3D month (SVG, no libraries), best dates, mock events
    shared/                       API client and session, calendar grid, toast, date/html helpers, styles
  tests/                          UI test (jsdom): login, every role, the event modal
backend/                          Node + Express, organized by business capability
  src/
    app.js                        Builds the HTTP app from its dependencies
    main.js                       Wires real dependencies and starts the server
    shared/                       Config, date keys, term check, errors, Eastern time
    modules/
      access/                     Roles, login, sessions
      academics/                  Canvas and calendar source data, syllabus exams, registrations
      workload/                   A student's load, week layout, stress, burnout, advice
      scheduling/                 Availability, campus intensity, best dates, mock events
  tests/                          Unit tests per module, API tests, a golden-master fixture of the original code
samples/                          Sample syllabus for the upload demo
```

Each backend module is layered, and dependencies point inward:

- `domain/` is pure logic. It has no Express and no storage, and it is what the unit tests exercise.
- `application/use-cases/` orchestrates a request using the domain and injected repositories.
- `infrastructure/` implements repositories and the Canvas client. Today the repositories are in memory.
- `interfaces/http/` is thin routes: check the role, call a use case, send JSON.

`scheduling` uses `workload`'s calculations, and nothing depends the other way.

The backend returns **data, not display text**. For example a burnout alert comes back as "start assignment X, skip optional event Y", and the frontend words it.

### API

All JSON, under `/api`. Everything except `/health` and `/auth/*` needs `Authorization: Bearer <session token>`. Errors look like `{ "error": { "code", "message" } }` with status 400, 401 (not logged in), 403 (wrong role), 404, 409 or 502.

| Endpoint | Roles | Purpose |
| --- | --- | --- |
| `GET /auth/students` | public | Names to choose from on the login screen |
| `POST /auth/login` `{ role, studentId?, password? }` | public | Start a session. Returns `{ token, role, studentId, views }` |
| `GET /auth/me`, `POST /auth/logout` | any | Who am I; end the session |
| `GET /term` | any | Term window: `start`, `days`, `end` |
| `GET /campus/events` | any | The campus events feed |
| `GET /students` | student, admin | Roster. A student gets only themselves |
| `GET /canvas/courses`, `/canvas/assignments`, `/calendar/events` | student, admin | Source data. A student gets only their own |
| `GET /canvas/status` | student, admin | `{ configured }`: whether the server has its own Canvas token. Never returns the token |
| `POST /students/:id/canvas/connect` `{ token? }` | own, admin | Import real Canvas data. Uses the token in the body or else the server's. Returns counts and exam-date suggestions. 401 if Canvas rejects the token, 502 if it can't be reached |
| `DELETE /students/:id/canvas` | own, admin | Back to the demo data |
| `GET /students/:id/workload?canvas=1` | own, admin | Daily load, per-day summary (hours split into coursework and events, items, stress), burnout alert and advice, peak stress |
| `GET /students/:id/week?start=YYYY-MM-DD&days=7\|1` | own, admin | A week or one day laid out on the hours: classes, events, study blocks, deadlines, start-studying markers |
| `GET /students/:id/days/:date` | own, admin | One day: due items, study plan, events, tip, stress |
| `GET /students/:id/campus-events` | own, admin | Campus events with how each fits this student, and whether they registered |
| `GET /students/:id/campus-events/:eventId/preview` | own, admin | The day with and without the event, without registering |
| `PUT` / `DELETE /students/:id/registrations/:eventId` | own, admin | Register for, or leave, a campus event |
| `POST /syllabus/parse` `{ text }` | student, admin | Finds a final or midterm date in syllabus text |
| `GET /students/:id/exams` | own, admin | Courses missing an exam date, and exams added from syllabi |
| `POST /courses/:id/exams` `{ type, date, time }` | student, admin | Add an exam date for a whole course. 403 if not enrolled, 409 if it already has one |
| `GET /audiences` | host, admin | Counts of students by major, class year and course |
| `GET /availability?audience=&from=&to=` | host, admin | Availability and expected turnout per day and 2-hour slot, average, best slot, top 10. `audience` is `all`, `major:CS`, `year:3` or `course:101` |
| `GET /intensity?audience=` | host, admin | Campus stress per day (0–100) and student count |
| `POST /event-fit` `{ type, audience, mockEvents }` | host, admin | Powers the 3D month: for every day, an event fit 0 to 100 (or why the day can't be used), the campus workload, and the top three dates by fit |
| `POST /recommend-date` `{ type, audience, mockEvents }` | host, admin | Best dates for `recruiting`, `relax` or `general`. Mock events (`{ type, date, name? }`, up to 20) count as clashes |
| `POST /preview/crowding` `{ audience, mockEvents }` | host, admin | For each mock event: heat that day, what else is on, and `good` / `busy` / `too-crowded` |

Registrations, syllabus exams and sessions are kept in memory: a server restart clears them.

## How the scores work

- **Daily load (h):** each assignment's effort is spread over the days before it's due (4 days for exams, 5 for projects, 3 for homework, quizzes and labs), plus event hours. Relax events are breaks and add no hours.
- **Burnout alert:** 3 or more days in a row at or over the student's daily cap. Critical if 4+ days or the peak is over 1.5× the cap.
- **Stress level (0–100):** from the design doc: `100 × sigmoid(2.0 × load/cap (3-day average) + 0.5 × streak of days over the cap + 0.3 × deadlines in the next 3 days + 0.4 × (5 − mood) − 3.0)`, with a neutral mood of 3 until there is a mood check-in. Watch at 60, high at 75, critical at 90. It is a workload estimate, not a diagnosis.
- **Study blocks:** each day's study hours are split into blocks of at most 2 hours and placed in the earliest free time between 1 and 10 PM, around classes and events. What doesn't fit is reported, not squeezed in.
- **Availability (per slot):** the chance a student is free. Zero if a class, event or exam covers the slot; otherwise a baseline chance of being busy, higher on weekend mornings, cut by up to half as the day's workload approaches 10 hours; 15% after finals end. The audience figure is the average; expected turnout is the number of free students times the share who attend a typical optional event (5% at 8–10 AM up to 30% at 6–8 PM, 85% of that on weekends).
- **Event fit (0–100, 3D month):** the same formulas as best dates, per day, with weekends and days after finals marked unavailable. Taller, darker columns suit the chosen event type better.
- **Reading a 2D tile:** the big percentage is the share of the audience free in that slot; the small `~N` is the expected number of people who turn up (free students times the share who attend, so it can be below 1 for a small audience).
- **Campus stress (0–100):** average of load / cap across the selected students. Hosts only see this aggregate.
- **Best dates:** recruiting = low intensity today and the next 2 days; relax = right before the peak; general = moderate days. Each similar event already on that day (including mock events) costs 15 points.
- **Would it be too crowded?** For a non-relax event: busy at heat 50, too crowded at 70, or when 2 / 3 other events are already that day. Heat never counts against a relax event.

## Deploying

The app needs somewhere to run the API as well as somewhere to host `frontend/dist`. GitHub Pages alone is no longer enough. Host the API on any Node host, build the frontend with `VITE_API_BASE_URL` pointing at it, and set `CORS_ORIGIN` on the API to the frontend's origin. Set `LOGIN_PASSWORD_ADMIN` (and ideally the other two) before exposing it.

## Going live (after the hackathon)

- Real login (accounts, not a role picker) so students can use their own Canvas token.
- The `.ics` calendar feed, syllabus file download, and the CMU events feed.
- A configurable term, so real Canvas data fills the calendar.

See `DEVNOTES.md` for progress, decisions, and how the code differs from the design doc.
