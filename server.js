'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const store = require('./src/store');
const auth = require('./src/auth');
const bracket = require('./src/bracket');
const { HttpError, fail } = require('./src/errors');

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'poolmasters';
const PUBLIC_DIR = path.join(__dirname, 'public');
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 16 * 1024;

const db = store.load();
// Bumped on every change so pollers can skip re-downloading unchanged state.
// Seeded with the boot time so a restart never matches a version a client already holds.
let stateVersion = Date.now();

// ---------------------------------------------------------------- sessions

function pruneSessions() {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [token, s] of Object.entries(db.sessions)) {
    if (s.createdAt < cutoff) delete db.sessions[token];
  }
}

function sessionFor(token) {
  const s = token ? db.sessions[token] : null;
  if (!s || s.createdAt < Date.now() - SESSION_TTL_MS) return null;
  if (s.role === 'player' && !db.players[s.playerId]) return null;
  return s;
}

function meFor(session) {
  if (session?.role === 'admin') return { role: 'admin' };
  const p = session?.role === 'player' ? db.players[session.playerId] : null;
  return p ? { role: 'player', player: { id: p.id, name: p.name } } : { role: null };
}

function startSession(role, playerId = null) {
  const token = auth.newToken();
  db.sessions[token] = { role, playerId, createdAt: Date.now() };
  return { token, me: meFor(db.sessions[token]) };
}

function requireAdmin(session) {
  if (session?.role !== 'admin') fail(403, 'Admin only.');
}

function requirePlayer(session) {
  if (session?.role !== 'player') fail(401, 'Sign in as a player first.');
  return db.players[session.playerId];
}

// ---------------------------------------------------------------- helpers

const getTournament = (id) => db.tournaments[id] || fail(404, 'Tournament not found.');

function cleanTitle(raw) {
  const title = String(raw ?? '').trim().replace(/\s+/g, ' ');
  if (title.length < 1 || title.length > 60) fail(400, 'Tournament name must be 1–60 characters.');
  return title;
}

function cleanMinutes(raw, fallback) {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 180) fail(400, 'Match clock must be 0–180 minutes.');
  return Math.round(n * 2) / 2;
}

/** The state every client sees. Pocketed balls are hidden from non-admins when live tracking is off. */
function publicState(isAdmin) {
  return {
    serverTime: Date.now(),
    version: stateVersion,
    settings:{ requirePin: db.settings.requirePin },
    players: Object.values(db.players).map((p) => ({ id: p.id, name: p.name })),
    tournaments: Object.values(db.tournaments)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((t) => ({
        ...t,
        matches: t.matches.map((m) => ({
          ...m,
          status: bracket.status(m),
          potted: t.liveBalls || isAdmin ? m.potted : null,
        })),
      })),
  };
}

// ---------------------------------------------------------------- routing

const routes = [];

function route(method, pattern, handler) {
  const keys = [];
  const re = new RegExp(`^${pattern.replace(/:(\w+)/g, (_, key) => (keys.push(key), '([^/]+)'))}$`);
  routes.push({ method, re, keys, handler });
}

// Auth --------------------------------------------------------------------

route('GET', '/api/me', ({ session }) => meFor(session));

// Polling fallback for networks that block the live stream (e.g. Cloudflare Quick Tunnels).
route('GET', '/api/state', ({ session, query }) => {
  if (Number(query.get('v')) === stateVersion) return { unchanged: true };
  return publicState(session?.role === 'admin');
});

const NAME_RULES = "Names must be 2–24 characters: letters, numbers, spaces and . _ - '";

const findPlayerByName = (raw) => {
  const key = auth.nameKey(raw);
  return Object.values(db.players).find((p) => p.nameKey === key);
};

function registerPlayer(body) {
  const name = auth.cleanName(body.name);
  if (!name) fail(400, NAME_RULES);
  if (findPlayerByName(name)) fail(409, 'That name is taken — pick another.');
  if (db.settings.requirePin && !auth.validPin(body.pin)) fail(400, 'PIN must be 4–6 digits.');

  const player = { id: auth.newId(), name, nameKey: auth.nameKey(name), createdAt: Date.now() };
  if (db.settings.requirePin) Object.assign(player, auth.hashPin(body.pin));
  db.players[player.id] = player;
  return player;
}

function loginPlayer(body) {
  const lockKey = `player:${auth.nameKey(body.name)}`;
  auth.assertNotLocked(lockKey);

  const player = findPlayerByName(body.name);
  if (!player) fail(404, 'No player with that name yet — create one first.');

  if (db.settings.requirePin) {
    if (!player.pinHash) {
      // Registered while PINs were off: the first PIN they sign in with becomes theirs.
      if (!auth.validPin(body.pin)) fail(400, 'PIN must be 4–6 digits.');
      Object.assign(player, auth.hashPin(body.pin));
    } else if (!auth.checkPin(body.pin, player)) {
      auth.recordFailure(lockKey);
      fail(401, 'Wrong PIN.');
    }
  }
  auth.clearFailures(lockKey);
  return player;
}

/** Step 1 of sign-in: is this name free, or does it belong to someone (and do they have a PIN)? */
route('GET', '/api/players/check', ({ query }) => {
  const name = auth.cleanName(query.get('name'));
  if (!name) fail(400, NAME_RULES);
  const player = findPlayerByName(name);
  return {
    name: player?.name ?? name,
    exists: Boolean(player),
    hasPin: Boolean(player?.pinHash),
    requirePin: db.settings.requirePin,
  };
});

route('POST', '/api/register', ({ body }) => startSession('player', registerPlayer(body).id));

route('POST', '/api/login', ({ body }) => startSession('player', loginPlayer(body).id));

route('POST', '/api/admin/login', ({ body, ip }) => {
  const lockKey = `admin:${ip}`;
  auth.assertNotLocked(lockKey);
  if (!auth.safeEqual(body.password ?? '', ADMIN_PASSWORD)) {
    auth.recordFailure(lockKey);
    fail(401, 'Wrong admin password.');
  }
  auth.clearFailures(lockKey);
  return startSession('admin');
});

route('POST', '/api/logout', ({ token }) => {
  if (token) delete db.sessions[token];
});

route('PATCH', '/api/settings', ({ session, body }) => {
  requireAdmin(session);
  if (typeof body.requirePin === 'boolean') db.settings.requirePin = body.requirePin;
  return db.settings;
});

// Tournaments -------------------------------------------------------------

route('POST', '/api/tournaments', ({ session, body }) => {
  requireAdmin(session);
  const t = {
    id: auth.newId(),
    name: cleanTitle(body.name),
    status: 'registration', // -> 'in_progress' -> 'completed'
    timerMinutes: cleanMinutes(body.timerMinutes, 10),
    liveBalls: body.liveBalls !== false,
    entries: [],
    rounds: 0,
    matches: [],
    championId: null,
    createdAt: Date.now(),
    startedAt: null,
    completedAt: null,
  };
  db.tournaments[t.id] = t;
  return { id: t.id };
});

route('PATCH', '/api/tournaments/:id', ({ session, params, body }) => {
  requireAdmin(session);
  const t = getTournament(params.id);
  const name = body.name === undefined ? t.name : cleanTitle(body.name);
  const timerMinutes = cleanMinutes(body.timerMinutes, t.timerMinutes);
  const clockChanged = timerMinutes !== t.timerMinutes;
  Object.assign(t, { name, timerMinutes });
  if (typeof body.liveBalls === 'boolean') t.liveBalls = body.liveBalls;
  if (clockChanged) bracket.resetIdleTimers(t);
});

route('DELETE', '/api/tournaments/:id', ({ session, params }) => {
  requireAdmin(session);
  getTournament(params.id);
  delete db.tournaments[params.id];
});

/** Adds the player as pending (or re-adds them after leaving). Returns their entry. */
function joinTournament(t, player) {
  const now = Date.now();
  let entry = t.entries.find((e) => e.playerId === player.id);
  if (!entry) {
    entry = { playerId: player.id, status: 'pending', joinedAt: now, updatedAt: now };
    t.entries.push(entry);
  } else if (entry.status === 'left') {
    Object.assign(entry, { status: 'pending', joinedAt: now, updatedAt: now });
  }
  return entry;
}

route('POST', '/api/tournaments/:id/join', ({ session, params }) => {
  const player = requirePlayer(session);
  const t = getTournament(params.id);
  if (t.status !== 'registration') fail(409, 'Registration is closed for this tournament.');
  const existing = t.entries.find((e) => e.playerId === player.id)?.status;
  if (existing === 'disabled') fail(403, 'The admin has disabled you in this tournament.');
  if (existing === 'pending' || existing === 'verified') fail(409, "You're already in this tournament.");
  joinTournament(t, player);
});

/**
 * Step 2 of sign-in, in the context of a tournament: signs in an existing player (PIN check)
 * or creates a new one, then joins them while registration is open.
 */
route('POST', '/api/tournaments/:id/enter', ({ params, body }) => {
  const t = getTournament(params.id);
  const exists = Boolean(findPlayerByName(body.name));
  if (!exists && t.status !== 'registration') fail(409, 'Registration is closed — only existing players can sign in here.');

  const player = exists ? loginPlayer(body) : registerPlayer(body);
  const entry = t.status === 'registration' ? joinTournament(t, player) : t.entries.find((e) => e.playerId === player.id);
  return { ...startSession('player', player.id), created: !exists, entryStatus: entry?.status ?? null };
});

route('POST', '/api/tournaments/:id/leave', ({ session, params }) => {
  const player = requirePlayer(session);
  const t = getTournament(params.id);
  if (t.status === 'completed') fail(409, 'This tournament is already finished.');
  const entry = t.entries.find((e) => e.playerId === player.id);
  if (!entry || entry.status === 'left' || entry.status === 'disabled') fail(409, "You're not active in this tournament.");

  Object.assign(entry, { status: 'left', updatedAt: Date.now() });
  bracket.settle(t);
});

route('POST', '/api/tournaments/:id/entries/:playerId', ({ session, params, body }) => {
  requireAdmin(session);
  const t = getTournament(params.id);
  const entry = t.entries.find((e) => e.playerId === params.playerId) || fail(404, 'That player has not joined.');
  if (!['verified', 'disabled'].includes(body.status)) fail(400, 'Status must be verified or disabled.');
  if (t.status === 'completed') fail(409, 'This tournament is finished.');
  if (entry.status === 'left') fail(409, 'This player left the tournament.');
  if (t.status !== 'registration' && body.status === 'verified' && !bracket.inBracket(t, entry.playerId)) {
    fail(409, 'The bracket is already drawn — redraw it to add new players.');
  }

  Object.assign(entry, { status: body.status, updatedAt: Date.now() });
  bracket.settle(t);
});

route('POST', '/api/tournaments/:id/start', ({ session, params }) => {
  requireAdmin(session);
  const t = getTournament(params.id);
  if (t.status !== 'registration') fail(409, 'This tournament has already started.');
  const ids = t.entries.filter((e) => e.status === 'verified').map((e) => e.playerId);
  if (ids.length < 2) fail(409, 'Verify at least two players before starting.');

  bracket.build(t, ids);
  t.status = 'in_progress';
  t.startedAt = Date.now();
  bracket.settle(t);
});

route('POST', '/api/tournaments/:id/reset', ({ session, params }) => {
  requireAdmin(session);
  const t = getTournament(params.id);
  Object.assign(t, { status: 'registration', rounds: 0, matches: [], championId: null, startedAt: null, completedAt: null });
});

route('POST', '/api/tournaments/:id/matches/:matchId/action', ({ session, params, body }) => {
  requireAdmin(session);
  const t = getTournament(params.id);
  const m = t.matches.find((x) => x.id === params.matchId) || fail(404, 'Match not found.');
  bracket.applyAction(t, m, body);
});

// ---------------------------------------------------------------- live updates (SSE)

const clients = new Map(); // response -> isAdmin

function statePayload(isAdmin) {
  return `event: state\ndata: ${JSON.stringify(publicState(isAdmin))}\n\n`;
}

function broadcast() {
  const cache = {};
  for (const [res, isAdmin] of clients) res.write((cache[isAdmin] ??= statePayload(isAdmin)));
}

function handleEvents(req, res, url) {
  const isAdmin = sessionFor(url.searchParams.get('token'))?.role === 'admin';
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 2000\n\n');
  res.write(statePayload(isAdmin));
  clients.set(res, isAdmin);
  req.on('close', () => clients.delete(res));
}

setInterval(() => {
  for (const res of clients.keys()) res.write(': ping\n\n');
}, 25000).unref();

// ---------------------------------------------------------------- http plumbing

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new HttpError(413, 'Request too large.'));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        resolve(value && typeof value === 'object' ? value : {});
      } catch {
        reject(new HttpError(400, 'Invalid JSON.'));
      }
    });
    req.on('error', reject);
  });
}

async function handleApi(req, res, url) {
  for (const r of routes) {
    if (r.method !== req.method) continue;
    const match = r.re.exec(url.pathname);
    if (!match) continue;

    const params = Object.fromEntries(r.keys.map((key, i) => [key, decodeURIComponent(match[i + 1])]));
    const body = req.method === 'GET' ? {} : await readJson(req);
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || null;
    const result = r.handler({
      params,
      body,
      query: url.searchParams,
      token,
      session: sessionFor(token),
      ip: req.socket.remoteAddress,
    });

    if (req.method !== 'GET') {
      stateVersion += 1;
      store.save(db);
      broadcast();
    }
    return sendJson(res, 200, result ?? { ok: true });
  }
  fail(404, 'Not found.');
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

function serveStatic(res, pathname) {
  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch {
    rel = '/';
  }
  const requested = path.join(PUBLIC_DIR, rel);
  const safe = requested.startsWith(PUBLIC_DIR + path.sep) ? requested : path.join(PUBLIC_DIR, 'index.html');

  fs.stat(safe, (err, stat) => {
    let file = safe;
    if (err || !stat.isFile()) {
      // Unknown asset -> 404; anything else is the single-page app.
      if (path.extname(rel)) return sendJson(res, 404, { error: 'Not found.' });
      file = path.join(PUBLIC_DIR, 'index.html');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/api/events' && req.method === 'GET') return handleEvents(req, res, url);
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') fail(405, 'Method not allowed.');
    serveStatic(res, url.pathname);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    if (!res.headersSent) sendJson(res, status, { error: status >= 500 ? 'Something went wrong.' : err.message });
  }
});

pruneSessions();
server.listen(PORT, () => {
  console.log(`PoolMasters running at http://localhost:${PORT}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.warn('Using the default admin password "poolmasters". Set ADMIN_PASSWORD to change it.');
  }
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    store.flush(db);
    process.exit(0);
  });
}
