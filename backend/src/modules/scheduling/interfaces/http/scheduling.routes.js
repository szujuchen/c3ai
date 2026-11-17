import { Router } from 'express';
import { requireRole } from '../../../access/interfaces/http/guards.js';
import { getAvailability } from '../../application/use-cases/getAvailability.js';
import { getAudiences } from '../../application/use-cases/getAudiences.js';
import { getEventFit } from '../../application/use-cases/getEventFit.js';
import { getIntensity } from '../../application/use-cases/getIntensity.js';
import { previewCrowding } from '../../application/use-cases/previewCrowding.js';
import { recommendDate } from '../../application/use-cases/recommendDate.js';

// For hosts (and admins): campus-wide aggregates and mock events. Nothing here can change the real calendar.
export function createSchedulingRouter(deps) {
  const router = Router();
  const hosts = requireRole('host', 'admin');

  router.get('/audiences', hosts, (_req, res) => res.json(getAudiences(deps)));
  router.get('/availability', hosts, (req, res) => res.json(getAvailability(deps, { audience: req.query.audience, from: req.query.from, to: req.query.to })));
  router.get('/intensity', hosts, (req, res) => res.json(getIntensity(deps, { audience: req.query.audience })));
  router.post('/event-fit', hosts, (req, res) => res.json(getEventFit(deps, req.body ?? {})));
  router.post('/recommend-date', hosts, (req, res) => res.json(recommendDate(deps, req.body ?? {})));
  router.post('/preview/crowding', hosts, (req, res) => res.json(previewCrowding(deps, req.body ?? {})));

  return router;
}
