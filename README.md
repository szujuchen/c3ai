# Crunch Calendar

See the crunch before it hits. One app, two views:

- **Students** connect Canvas and Google Calendar, see their workload on a color-coded calendar, get a daily study plan, and get warned before a burnout stretch.
- **Recruiters and event hosts** see anonymized campus intensity and get the best dates for their next event. Relax events land just before the crunch; recruiting events avoid it.

## Run it

No install. Open `index.html` in a browser, or serve the folder:

```
python3 -m http.server 8000
# then open http://localhost:8000
```

Deploy: push to GitHub, then Settings → Pages → Deploy from branch → `main` / root.

## Demo script (2 min)

1. **Student tab.** Pick Maya, click **Connect Canvas**, then **Connect Google Calendar**. She looks "On track", because her Physics final isn't in Canvas.
2. In **Exam dates missing from Canvas**, click **Upload syllabus** next to 33-141 and pick `samples/33-141_syllabus.txt`. The app finds "Final Exam: Tuesday, December 15, 10:00 AM". Click **Add for the class**: the exam is shared with every enrolled student, and Maya's banner turns red.
3. The red banner shows a **Critical** burnout stretch (Dec 11–15) with fixes: start the biggest exam early, skip an optional recruiting mixer, go to therapy dogs.
4. Click a red day on the calendar to see what's due, the study plan, and a tip to move work to a lighter day.
5. **Recruiter / Host tab.** Recruiting picks dates after finals. Switch to **Relax / wellness**: the top pick is Fri Dec 11, right before the Dec 12–13 peak.
6. Click **Schedule at #1**. The event is added, and similar events on that day are penalized in the ranking.

## Files

| File | What it does |
| --- | --- |
| `index.html` | Page shell and tabs |
| `styles.css` | All styling |
| `js/data.js` | Mock data shaped like the Canvas REST API and Google Calendar API |
| `js/scoring.js` | Daily load, burnout alert, campus intensity, best-date ranking |
| `js/app.js` | Student and host views, syllabus upload |
| `samples/33-141_syllabus.txt` | Sample syllabus for the upload demo |

## Missing exam dates

Syllabi often have exam dates that never make it into Canvas. Any student whose enrollment Canvas confirms can upload the syllabus (or type the date). The app reads the exam date from the text, the student confirms it, and it's added for everyone in that course and to campus intensity. Students not enrolled in a course can't add dates for it. The demo reads text files; PDF parsing is a next step.

## How the scores work

- **Daily load (h):** each assignment's effort is spread over the days before it's due (4 days for exams, 5 for projects, 3 for homework, quizzes and labs), plus event hours.
- **Burnout alert:** 3 or more days in a row at or over the student's daily cap. Critical if 4+ days or the peak is over 1.5× the cap.
- **Campus intensity (0–100):** average of load / cap across the selected students. Hosts only see this aggregate.
- **Best dates:** recruiting = low intensity today and the next 2 days; relax = right before the peak; general = moderate days. Each similar event already on that day costs 15 points.

## Going live (after the hackathon)

- Canvas: `GET /api/v1/courses`, `GET /api/v1/courses/:id/assignments` with the student's access token.
- Google Calendar: `events.list` and `freebusy.query` with read-only OAuth.
- Replace `window.MOCK` in `js/data.js` with those responses. The field names already match.
