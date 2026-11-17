import express from 'express';
import { createAuthRouter } from './modules/access/interfaces/http/auth.routes.js';
import { authenticate } from './modules/access/interfaces/http/guards.js';
import { createAcademicsRouter } from './modules/academics/interfaces/http/academics.routes.js';
import { createSchedulingRouter } from './modules/scheduling/interfaces/http/scheduling.routes.js';
import { createWorkloadRouter } from './modules/workload/interfaces/http/workload.routes.js';

// Builds the HTTP app from its dependencies. main.js wires the real ones; tests wire their own.
export function createApp({ academics, sessions, rolePasswords = {}, syllabusExams, registrations, canvas = null, canvasToken = null, term, corsOrigin = null }) {
  const deps = { academics, sessions, rolePasswords, syllabusExams, registrations, canvas, canvasToken, term };
  const app = express();

  app.use(express.json());
  if (corsOrigin) {
    app.use((req, res, next) => {
      res.set({
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      });
      if (req.method === 'OPTIONS') return res.sendStatus(204);
      next();
    });
  }

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api', createAuthRouter(deps));
  // Everything below needs a logged-in session; each route then checks the role.
  app.use('/api', authenticate(deps));
  app.use('/api', createAcademicsRouter(deps));
  app.use('/api', createWorkloadRouter(deps));
  app.use('/api', createSchedulingRouter(deps));

  app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'not_found', message: 'Unknown endpoint' } }));
  // Domain errors carry their own status; anything else is a 500.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = err.status ?? (err.type === 'entity.parse.failed' ? 400 : 500);
    if (status === 500) console.error(err);
    const message = status === 500 ? 'Internal server error' : err.type === 'entity.parse.failed' ? 'Request body is not valid JSON' : err.message;
    res.status(status).json({ error: { code: err.code ?? (status === 400 ? 'invalid_request' : 'internal_error'), message } });
  });

  return app;
}
