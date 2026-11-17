// Runtime configuration. See README for the environment variables.
export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT) || 3001,
    // Login is a demo: pick a role, no account. Set a password for a role to require it (recommended for admin).
    rolePasswords: { student: env.LOGIN_PASSWORD_STUDENT || null, host: env.LOGIN_PASSWORD_HOST || null, admin: env.LOGIN_PASSWORD_ADMIN || null },
    sessionHours: Number(env.SESSION_HOURS) || 12,
    // Origin allowed to call the API directly from a browser. Unset = same-origin only (use the Vite proxy in dev).
    corsOrigin: env.CORS_ORIGIN || null,
    // The Canvas access token the server uses when a request does not bring its own. Kept in backend/.env (git-ignored).
    // Only the server ever sees it: it is never sent to the browser, put in a response, or logged.
    canvasToken: env.CANVAS_TOKEN || env.CANVA_TOKEN || null,
    // Where students' Canvas lives. Fixed by the server, never taken from a request, so the server can't be pointed at other hosts.
    canvasBaseUrl: env.CANVAS_BASE_URL || 'https://canvas.cmu.edu',
    // The academic term the calendar covers: 31 days from Dec 1, finals end Dec 18.
    term: { start: '2026-12-01', days: 31, end: '2026-12-18' },
  };
}
