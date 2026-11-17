import { Router } from 'express';
import { login, whoami } from '../../application/use-cases/login.js';
import { authenticate } from './guards.js';

export function createAuthRouter(deps) {
  const router = Router();
  // Who a student can log in as. Names only: this is a demo login, and it is how the login screen offers a choice.
  router.get('/auth/students', (_req, res) => res.json({ students: deps.academics.students().map(({ id, name, major, year }) => ({ id, name, major, year })) }));
  router.post('/auth/login', (req, res) => res.json(login(deps, req.body ?? {})));
  router.get('/auth/me', authenticate(deps), (req, res) => res.json(whoami(req.session)));
  router.post('/auth/logout', authenticate(deps), (req, res) => { deps.sessions.delete(req.sessionToken); res.json({ loggedOut: true }); });
  return router;
}
