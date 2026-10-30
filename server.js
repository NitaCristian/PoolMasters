'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const store = require('./src/store');
const auth = require('./src/auth');
const tournament = require('./src/tournament');
const ai = require('./src/ai');
const { HttpError, fail } = require('./src/errors');

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'poolmasters';
const PUBLIC_DIR = path.join(__dirname, 'public');
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 16 * 1024;
const MAX_TEAMS = 32;
const WEAK_PASSWORD = ADMIN_PASSWORD === 'poolmasters';
const MAX_CHATS = 200;
const MAX_CHAT_MESSAGES = 400;
const MAX_MESSAGE_CHARS = 4000;
const MAX_CONTEXT_MESSAGES = 41; // odd, so the part we send always starts with a question
const AI_PER_MINUTE = 20;

const db = store.load();
ai.loadKey(ADMIN_PASSWORD);
// Bumped on every change so pollers can skip re-downloading unchanged state.
// Seeded with the boot time so a restart never matches a version a client already holds.
let stateVersion = Date.now();

// ---------------------------------------------------------------- sessions (admin only)

function pruneSessions() {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [token, s] of Object.entries(db.sessions)) {
    if (s.createdAt < cutoff) delete db.sessions[token];
  }
}

function sessionFor(token) {
  const s = token ? db.sessions[token] : null;
  return s && s.createdAt >= Date.now() - SESSION_TTL_MS ? s : null;
}

const meFor = (session) => ({ role: session ? 'admin' : null });

function requireAdmin(session) {
  if (!session) fail(403, 'Admin only.');
}

// ---------------------------------------------------------------- helpers

const findTeam = (id) => db.teams.find((t) => t.id === id) || fail(404, 'Team not found.');

/** Team and player names: 1–24 characters, whitespace collapsed. */
function cleanName(raw, what) {
  const name = String(raw ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (name.length < 1 || name.length > 24) fail(400, `${what} must be 1–24 characters.`);
  return name;
}

function cleanMinutes(raw, fallback) {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 180) fail(400, 'Match clock must be 0–180 minutes.');
  return Math.round(n * 2) / 2;
}

function requireSetup(action) {
  if (db.event.status !== 'setup') fail(409, `Teams are locked while a tournament is on. Reset it to ${action}.`);
}

/** Next free "Team N" name, so quick-adding teams never collides. */
function nextTeamName() {
  const taken = new Set(db.teams.map((t) => t.name.toLowerCase()));
  let n = db.teams.length + 1;
  while (taken.has(`team ${n}`)) n += 1;
  return `Team ${n}`;
}

/** Snapshot of a finished night, kept for the all-time stats after the next reset. */
function archive(e) {
  const team = (id) => {
    const t = db.teams.find((x) => x.id === id);
    return t ? { name: t.name, members: t.members.filter((m) => m.active).map((m) => m.name) } : null;
  };
  const placeOf = (stage, won) => {
    const m = e.matches.find((x) => x.stage === stage && x.winner);
    if (!m) return null;
    return m[won ? m.winner : m.winner === 'a' ? 'b' : 'a'];
  };
  const done = e.matches.filter((m) => m.winner);
  db.history.unshift({
    name: e.name,
    startedAt: e.startedAt,
    completedAt: e.completedAt,
    teams: e.groups.flat().length,
    matches: done.length,
    balls: done.reduce((n, m) => n + m.potted.length, 0),
    podium: [placeOf('final', true), placeOf('final', false), placeOf('third', true)].map((id) => (id ? team(id) : null)),
  });
}

/** During setup: the schedule the current team list would produce, so everyone can see the night ahead. */
function previewEvent() {
  const e = db.event;
  if (db.teams.length < tournament.MIN_TEAMS) return e;
  const draft = { ...e, matches: [] };
  tournament.build(draft, db.teams.map((t) => t.id));
  return { ...draft, preview: true };
}

/** The state every client sees. Everything is public; only changes need the admin. */
function publicState() {
  const e = db.event.status === 'setup' ? previewEvent() : db.event;
  return {
    serverTime: Date.now(),
    version: stateVersion,
    teams: db.teams.map(({ id, name, members }) => ({ id, name, members })),
    event: {
      ...e,
      matches: e.matches.map((m) => ({ ...m, status: tournament.status(m) })),
      standings: e.status === 'setup' ? [] : [0, 1].map((g) => tournament.standings(e, g)),
    },
    history: db.history,
  };
}

// ---------------------------------------------------------------- routing

const routes = [];

/** `quiet` routes change nothing public, so they save without a broadcast to every viewer. */
function route(method, pattern, handler, { quiet = false } = {}) {
  const keys = [];
  const re = new RegExp(`^${pattern.replace(/:(\w+)/g, (_, key) => (keys.push(key), '([^/]+)'))}$`);
  routes.push({ method, re, keys, handler, quiet });
}

// Auth --------------------------------------------------------------------

route('GET', '/api/me', ({ session }) => meFor(session));

// Polling fallback for networks that block the live stream (e.g. Cloudflare Quick Tunnels).
route('GET', '/api/state', ({ query }) => {
  if (Number(query.get('v')) === stateVersion) return { unchanged: true };
  return publicState();
});

route('POST', '/api/admin/login', ({ body, ip }) => {
  const lockKey = `admin:${ip}`;
  auth.assertNotLocked(lockKey);
  if (!auth.safeEqual(body.password ?? '', ADMIN_PASSWORD)) {
    auth.recordFailure(lockKey);
    fail(401, 'Wrong admin password.');
  }
  auth.clearFailures(lockKey);
  const token = auth.newToken();
  db.sessions[token] = { createdAt: Date.now() };
  return { token, me: meFor(db.sessions[token]) };
});

route('POST', '/api/logout', ({ token }) => {
  if (token) delete db.sessions[token];
});

// Teams -------------------------------------------------------------------

route('POST', '/api/teams', ({ session, body }) => {
  requireAdmin(session);
  requireSetup('add teams');
  if (db.teams.length >= MAX_TEAMS) fail(409, `That's the maximum of ${MAX_TEAMS} teams.`);
  const given = Array.isArray(body.members) ? body.members : [];
  const team = {
    id: auth.newId(),
    name: body.name ? cleanName(body.name, 'Team name') : nextTeamName(),
    members: [0, 1].map((i) => ({ name: given[i] ? cleanName(given[i], 'Player name') : `Player ${i + 1}`, active: true })),
    createdAt: Date.now(),
  };
  db.teams.push(team);
  return { id: team.id };
});

route('PATCH', '/api/teams/:id', ({ session, params, body }) => {
  requireAdmin(session);
  const team = findTeam(params.id);
  if (body.name !== undefined) team.name = cleanName(body.name, 'Team name');
});

route('PATCH', '/api/teams/:id/members/:index', ({ session, params, body }) => {
  requireAdmin(session);
  const member = findTeam(params.id).members[Number(params.index)] || fail(404, 'Player not found.');
  if (body.name !== undefined) member.name = cleanName(body.name, 'Player name');
  if (typeof body.active === 'boolean') member.active = body.active;
});

route('DELETE', '/api/teams/:id', ({ session, params }) => {
  requireAdmin(session);
  requireSetup('remove teams');
  findTeam(params.id);
  db.teams = db.teams.filter((t) => t.id !== params.id);
});

/** Random order, which also decides the groups (first half is Group 1). */
route('POST', '/api/teams/shuffle', ({ session }) => {
  requireAdmin(session);
  requireSetup('reshuffle');
  const list = db.teams;
  for (let i = list.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
});

route('POST', '/api/teams/:id/move', ({ session, params, body }) => {
  requireAdmin(session);
  requireSetup('reorder teams');
  const from = db.teams.indexOf(findTeam(params.id));
  const to = from + (body.by === -1 ? -1 : 1);
  if (to < 0 || to >= db.teams.length) return;
  [db.teams[from], db.teams[to]] = [db.teams[to], db.teams[from]];
});

// Tournament --------------------------------------------------------------

route('PATCH', '/api/event', ({ session, body }) => {
  requireAdmin(session);
  const e = db.event;
  if (body.name !== undefined) {
    const name = String(body.name).trim().replace(/\s+/g, ' ');
    if (name.length < 1 || name.length > 60) fail(400, 'Tournament name must be 1–60 characters.');
    e.name = name;
  }
  if (body.clockMinutes !== undefined) {
    const minutes = cleanMinutes(body.clockMinutes, e.clockMinutes);
    if (minutes !== e.clockMinutes) {
      e.clockMinutes = minutes;
      tournament.resetIdleTimers(e);
    }
  }
  if (typeof body.thirdPlace === 'boolean' && body.thirdPlace !== e.thirdPlace) {
    if (e.status !== 'setup') fail(409, 'Choose the 3rd-place match before starting.');
    e.thirdPlace = body.thirdPlace;
  }
});

route('POST', '/api/event/start', ({ session }) => {
  requireAdmin(session);
  const e = db.event;
  if (e.status !== 'setup') fail(409, 'The tournament is already running.');
  tournament.build(e, db.teams.map((t) => t.id));
  e.status = 'live';
  e.startedAt = Date.now();
});

/** Back to setup. A finished night goes into the history first. */
route('POST', '/api/event/reset', ({ session }) => {
  requireAdmin(session);
  if (db.event.status === 'done') archive(db.event);
  db.event = store.newEvent(db.event);
});

route('POST', '/api/matches/:id/action', ({ session, params, body }) => {
  requireAdmin(session);
  const m = db.event.matches.find((x) => x.id === params.id) || fail(404, 'Match not found.');
  tournament.applyAction(db.event, m, body);
});

route('POST', '/api/rounds/:round/action', ({ session, params, body }) => {
  requireAdmin(session);
  tournament.roundAction(db.event, Number(params.round), body);
});

// Gemini (admin only; nothing here is part of the public state) ------------

const aiModel = () => db.ai.model || ai.DEFAULT_MODEL;

const aiSettings = () => ({
  hasKey: ai.hasKey(),
  keyHint: ai.keyHint(),
  model: aiModel(),
  weakPassword: WEAK_PASSWORD,
  ...ai.rulesInfo(),
});

const chatSummary = ({ id, title, updatedAt, messages }) => ({ id, title, updatedAt, count: messages.length });
const findChat = (id) => db.chats.find((c) => c.id === id) || fail(404, 'Chat not found.');

function cleanMessage(raw) {
  const text = String(raw ?? '').trim();
  if (!text) fail(400, 'Type a message first.');
  if (text.length > MAX_MESSAGE_CHARS) fail(400, `Messages can be at most ${MAX_MESSAGE_CHARS} characters.`);
  return text;
}

// A leaked admin session should not be able to run up the bill.
let aiCalls = [];

function checkAiRate() {
  const cutoff = Date.now() - 60 * 1000;
  aiCalls = aiCalls.filter((at) => at > cutoff);
  if (aiCalls.length >= AI_PER_MINUTE) fail(429, 'Too many questions. Wait a minute and try again.');
  aiCalls.push(Date.now());
}

function askGemini(lang, messages) {
  if (!ai.hasKey()) fail(409, 'Add a Gemini API key in the settings first.');
  checkAiRate();
  return ai.ask(aiModel(), ai.systemPrompt(lang, db.event.clockMinutes || 15), messages.slice(-MAX_CONTEXT_MESSAGES));
}

route('GET', '/api/ai/settings', ({ session }) => {
  requireAdmin(session);
  return aiSettings();
});

route('PUT', '/api/ai/settings', async ({ session, body }) => {
  requireAdmin(session);
  if (body.model !== undefined) {
    const model = String(body.model).trim();
    if (model && !/^[a-z0-9][a-z0-9.-]{0,63}$/.test(model)) fail(400, 'That is not a valid model name.');
    db.ai.model = model || null;
  }
  if (body.apiKey) {
    if (WEAK_PASSWORD) fail(409, 'Set your own ADMIN_PASSWORD before adding an API key.');
    const key = String(body.apiKey).trim();
    if (!/^[\w.-]{20,200}$/.test(key)) fail(400, 'That does not look like a Gemini API key.');
    await ai.verifyKey(key);
    ai.saveKey(key, ADMIN_PASSWORD);
  }
  return aiSettings();
}, { quiet: true });

route('DELETE', '/api/ai/key', ({ session }) => {
  requireAdmin(session);
  ai.clearKey();
  return aiSettings();
}, { quiet: true });

route('GET', '/api/ai/chats', ({ session }) => {
  requireAdmin(session);
  return { chats: [...db.chats].sort((a, b) => b.updatedAt - a.updatedAt).map(chatSummary) };
});

route('GET', '/api/ai/chats/:id', ({ session, params }) => {
  requireAdmin(session);
  return findChat(params.id);
});

/** A chat only comes into being with a first question that Gemini answered, so there are no empty chats. */
route('POST', '/api/ai/chats', async ({ session, body }) => {
  requireAdmin(session);
  if (db.chats.length >= MAX_CHATS) fail(409, 'You have too many chats. Delete some first.');
  const text = cleanMessage(body.message);
  const lang = body.lang === 'nl' ? 'nl' : 'en';
  const answer = await askGemini(lang, [{ role: 'user', text }]);
  const at = Date.now();
  const chat = {
    id: auth.newId(),
    title: text.replace(/\s+/g, ' ').slice(0, 60),
    lang,
    createdAt: at,
    updatedAt: at,
    messages: [{ role: 'user', text, at }, { role: 'model', text: answer, at }],
  };
  db.chats.push(chat);
  return chat;
}, { quiet: true });

route('POST', '/api/ai/chats/:id/messages', async ({ session, params, body }) => {
  requireAdmin(session);
  const chat = findChat(params.id);
  if (chat.messages.length >= MAX_CHAT_MESSAGES) fail(409, 'This chat is full. Start a new one.');
  const text = cleanMessage(body.message);
  const answer = await askGemini(chat.lang, [...chat.messages, { role: 'user', text }]);
  findChat(params.id); // it may have been deleted while we waited
  const at = Date.now();
  chat.messages.push({ role: 'user', text, at }, { role: 'model', text: answer, at });
  chat.updatedAt = at;
  return chat;
}, { quiet: true });

route('DELETE', '/api/ai/chats/:id', ({ session, params }) => {
  requireAdmin(session);
  findChat(params.id);
  db.chats = db.chats.filter((c) => c.id !== params.id);
}, { quiet: true });

// ---------------------------------------------------------------- live updates (SSE)

const clients = new Set();

const statePayload = () => `event: state\ndata: ${JSON.stringify(publicState())}\n\n`;

function broadcast() {
  if (!clients.size) return;
  const payload = statePayload();
  for (const res of clients) res.write(payload);
}

function handleEvents(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 2000\n\n');
  res.write(statePayload());
  clients.add(res);
  req.on('close', () => clients.delete(res));
}

setInterval(() => {
  for (const res of clients) res.write(': ping\n\n');
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
    const result = await r.handler({
      params,
      body,
      query: url.searchParams,
      token,
      session: sessionFor(token),
      ip: req.socket.remoteAddress,
    });

    if (req.method !== 'GET') {
      store.save(db);
      if (!r.quiet) {
        stateVersion += 1;
        broadcast();
      }
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

// The admin token sits in the browser, so injected scripts must not be able to run or phone home.
const SECURITY_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    'font-src https://fonts.gstatic.com',
    "img-src 'self' data:",
    "base-uri 'none'",
    "object-src 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; '),
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
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
    res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/api/events' && req.method === 'GET') return handleEvents(req, res);
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') fail(405, 'Method not allowed.');
    serveStatic(res, url.pathname);
  } catch (err) {
    const known = err instanceof HttpError;
    if (!known) console.error(err);
    if (!res.headersSent) sendJson(res, known ? err.status : 500, { error: known ? err.message : 'Something went wrong.' });
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
