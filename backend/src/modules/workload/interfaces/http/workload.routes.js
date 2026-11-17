import { Router } from 'express';
import { studentAccess } from '../../../access/interfaces/http/guards.js';
import { getCampusEvents } from '../../application/use-cases/getCampusEvents.js';
import { getDayDetail } from '../../application/use-cases/getDayDetail.js';
import { getStudentWeek } from '../../application/use-cases/getStudentWeek.js';
import { getStudentWorkload } from '../../application/use-cases/getStudentWorkload.js';
import { previewCampusEvent } from '../../application/use-cases/previewCampusEvent.js';

const flag = (v) => v === '1' || v === 'true';
const sourcesFrom = (query) => ({ canvas: flag(query.canvas), gcal: flag(query.gcal) });

// A student reaches only their own data; an admin reaches anyone's.
export function createWorkloadRouter(deps) {
  const router = Router();
  router.use('/students/:id', studentAccess);

  router.get('/students/:id/workload', (req, res) => {
    res.json(getStudentWorkload(deps, req.params.id, sourcesFrom(req.query)));
  });

  router.get('/students/:id/week', (req, res) => {
    res.json(getStudentWeek(deps, req.params.id, { start: req.query.start, days: Number(req.query.days ?? 7) }, sourcesFrom(req.query)));
  });

  router.get('/students/:id/days/:date', (req, res) => {
    res.json(getDayDetail(deps, req.params.id, req.params.date, sourcesFrom(req.query)));
  });

  router.get('/students/:id/campus-events', (req, res) => {
    res.json(getCampusEvents(deps, req.params.id, sourcesFrom(req.query)));
  });

  router.get('/students/:id/campus-events/:eventId/preview', (req, res) => {
    res.json(previewCampusEvent(deps, req.params.id, req.params.eventId, sourcesFrom(req.query)));
  });

  return router;
}
