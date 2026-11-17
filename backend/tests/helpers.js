import { readFileSync } from 'node:fs';
import { createApp } from '../src/app.js';
import { createInMemorySessionRepository } from '../src/modules/access/infrastructure/persistence/inMemorySessionRepository.js';
import { createInMemoryAcademicsRepository } from '../src/modules/academics/infrastructure/persistence/inMemoryAcademicsRepository.js';
import { createInMemoryRegistrationRepository } from '../src/modules/academics/infrastructure/persistence/inMemoryRegistrationRepository.js';
import { createInMemorySyllabusExamRepository } from '../src/modules/academics/infrastructure/persistence/inMemorySyllabusExamRepository.js';
import { loadConfig } from '../src/shared/config.js';

// Snapshot of the original (pre-refactor) implementation's output, taken from the upstream legacy code.
// `base` = a fresh app. `full` = a syllabus exam and campus event registrations already added.
// `fullMock` = the same, ranked with two mock host events in the way (only its campus picks are kept).
export const golden = JSON.parse(readFileSync(new URL('./fixtures/golden.json', import.meta.url), 'utf8'));
export const term = loadConfig({}).term;
export const academics = createInMemoryAcademicsRepository();

export const VARIANTS = ['base', 'full'];

// The two mock events the golden `fullMock` ranking was taken with.
export const MOCK_EVENTS = [{ type: 'relax', date: '2026-12-11' }, { type: 'recruiting', date: '2026-12-07' }];

export function makeDeps(variant = 'base', overrides = {}) {
  const full = variant === 'full';
  return {
    academics,
    sessions: createInMemorySessionRepository(),
    rolePasswords: {},
    syllabusExams: createInMemorySyllabusExamRepository(full ? golden.syllabusExamSample : []),
    registrations: createInMemoryRegistrationRepository(full ? golden.registeredSample : {}),
    term,
    ...overrides,
  };
}

// Boots the real app on an ephemeral port. `call` acts as an admin (who may do everything); `as(role, studentId)`
// logs in as someone else and returns a `call` for them; `anon` sends no session.
export async function startServer(variant = 'base', overrides = {}) {
  const app = createApp(makeDeps(variant, overrides));
  const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  const base = `http://localhost:${server.address().port}`;
  const request = (token) => async (path, init) => {
    const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    const res = await fetch(base + path, { ...init, headers, body: init?.body && JSON.stringify(init.body) });
    return { status: res.status, body: await res.json() };
  };
  const anon = request(null);
  const as = async (role, studentId) => request((await anon('/api/auth/login', { method: 'POST', body: { role, studentId } })).body.token);
  return { base, call: await as('admin'), anon, as, close: () => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }) };
}
