import { Router } from 'express';
import { requireRole, studentAccess } from '../../../access/interfaces/http/guards.js';
import { addSyllabusExam } from '../../application/use-cases/addSyllabusExam.js';
import { canvasStatus, connectCanvas, disconnectCanvas } from '../../application/use-cases/connectCanvas.js';
import { getExamStatus } from '../../application/use-cases/getExamStatus.js';
import { parseSyllabus } from '../../application/use-cases/parseSyllabus.js';
import { setRegistration } from '../../application/use-cases/setRegistration.js';
import { visibleData } from '../../application/visibleData.js';

const flag = (v) => v === '1' || v === 'true';

// Source data shaped like the Canvas REST API and Google Calendar API, plus what students add on top:
// exam dates from syllabi and campus event registrations. Students see only their own; hosts see none of it.
export function createAcademicsRouter(deps) {
  const { academics, term } = deps;
  const router = Router();
  const students = requireRole('student', 'admin');

  router.get('/term', (_req, res) => res.json(term));
  router.get('/campus/events', (_req, res) => res.json({ events: academics.campusEvents() }));

  router.get('/students', students, (req, res) => res.json({ students: visibleData(deps, req.session).students }));
  router.get('/canvas/courses', students, (req, res) => res.json({ courses: visibleData(deps, req.session).courses }));
  router.get('/canvas/assignments', students, (req, res) => res.json({ assignments: visibleData(deps, req.session).assignments }));
  router.get('/calendar/events', students, (req, res) => res.json({ events: visibleData(deps, req.session).calendarEvents }));
  router.get('/canvas/status', students, (_req, res) => res.json(canvasStatus(deps)));

  router.post('/syllabus/parse', students, (req, res) => res.json(parseSyllabus(req.body ?? {})));
  // A student can only add exam dates as themselves.
  router.post('/courses/:courseId/exams', students, (req, res) => {
    const body = req.session.role === 'student' ? { ...req.body, studentId: req.session.studentId } : (req.body ?? {});
    res.status(201).json(addSyllabusExam(deps, Number(req.params.courseId), body));
  });

  router.use('/students/:id', studentAccess);
  router.get('/students/:id/exams', (req, res) => res.json(getExamStatus(deps, req.params.id, { canvas: flag(req.query.canvas) })));

  // Real Canvas data. The token comes in the body or from the server's config, is used once, and is not kept.
  router.post('/students/:id/canvas/connect', async (req, res) => res.json(await connectCanvas(deps, req.params.id, req.body ?? {})));
  router.delete('/students/:id/canvas', (req, res) => res.json(disconnectCanvas(deps, req.params.id)));

  router.put('/students/:id/registrations/:eventId', (req, res) => res.json(setRegistration(deps, req.params.id, req.params.eventId, true)));
  router.delete('/students/:id/registrations/:eventId', (req, res) => res.json(setRegistration(deps, req.params.id, req.params.eventId, false)));

  return router;
}
