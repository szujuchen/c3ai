import { createApp } from './app.js';
import { createCanvasClient } from './modules/academics/infrastructure/canvas/canvasClient.js';
import { createInMemoryAcademicsRepository } from './modules/academics/infrastructure/persistence/inMemoryAcademicsRepository.js';
import { createInMemoryRegistrationRepository } from './modules/academics/infrastructure/persistence/inMemoryRegistrationRepository.js';
import { createInMemorySyllabusExamRepository } from './modules/academics/infrastructure/persistence/inMemorySyllabusExamRepository.js';
import { createInMemorySessionRepository } from './modules/access/infrastructure/persistence/inMemorySessionRepository.js';
import { loadConfig } from './shared/config.js';

// Secrets live in backend/.env (git-ignored). Variables already set in the environment win over the file.
try {
  process.loadEnvFile(new URL('../.env', import.meta.url));
} catch (err) {
  if (err.code !== 'ENOENT') throw err;
}

const config = loadConfig();
const app = createApp({
  academics: createInMemoryAcademicsRepository(),
  sessions: createInMemorySessionRepository({ ttlMs: config.sessionHours * 3600 * 1000 }),
  rolePasswords: config.rolePasswords,
  syllabusExams: createInMemorySyllabusExamRepository(),
  registrations: createInMemoryRegistrationRepository(),
  canvas: createCanvasClient({ baseUrl: config.canvasBaseUrl }),
  canvasToken: config.canvasToken,
  term: config.term,
  corsOrigin: config.corsOrigin,
});

app.listen(config.port, () => console.log(`Crunch Calendar API listening on http://localhost:${config.port}`));
