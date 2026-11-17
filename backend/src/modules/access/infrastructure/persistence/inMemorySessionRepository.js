import { randomBytes } from 'node:crypto';

// Logged-in sessions, held in memory: a server restart logs everyone out.
export function createInMemorySessionRepository({ ttlMs = 12 * 3600 * 1000, now = () => Date.now() } = {}) {
  const sessions = new Map();
  return {
    create(data) {
      const token = randomBytes(32).toString('base64url');
      const expiresAt = now() + ttlMs;
      sessions.set(token, { ...data, expiresAt });
      return { token, expiresAt };
    },
    get(token) {
      const s = sessions.get(token);
      if (!s) return null;
      if (s.expiresAt <= now()) { sessions.delete(token); return null; }
      return s;
    },
    delete: (token) => { sessions.delete(token); },
  };
}
