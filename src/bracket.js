'use strict';

const crypto = require('node:crypto');
const { fail } = require('./errors');

const WITHDRAWN = new Set(['disabled', 'left']);

/**
 * Standard bracket seed order, e.g. size 8 -> [1,8,4,5,2,7,3,6].
 * Pairing consecutive entries keeps top seeds apart and spreads byes evenly.
 */
function seedOrder(size) {
  let order = [1];
  while (order.length < size) {
    const sum = order.length * 2 + 1;
    order = order.flatMap((seed) => [seed, sum - seed]);
  }
  return order;
}

function shuffle(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function newTimer(minutes) {
  const ms = Math.round(Number(minutes || 0) * 60000);
  return { durationMs: ms, remainingMs: ms, endsAt: null, running: false };
}

/** Draws a single-elimination bracket from the given player ids (random seeding). */
function build(t, playerIds) {
  const seeded = shuffle(playerIds);
  let size = 2;
  while (size < seeded.length) size *= 2;
  const order = seedOrder(size);

  t.rounds = Math.log2(size);
  t.matches = [];
  t.championId = null;

  for (let round = 1; round <= t.rounds; round++) {
    for (let index = 0; index < size >> round; index++) {
      const m = {
        id: `r${round}m${index}`,
        round,
        index,
        a: null,
        b: null,
        bye: null,
        winner: null, // 'a' | 'b'
        result: null, // 'win' | 'timeout' | 'forfeit' | 'bye'
        groupA: null, // 'solids' | 'stripes' — player B gets the other group
        potted: [],
        timer: newTimer(t.timerMinutes),
        live: false,
        startedAt: null,
        finishedAt: null,
      };
      if (round === 1) {
        m.a = seeded[order[index * 2] - 1] ?? null;
        m.b = seeded[order[index * 2 + 1] - 1] ?? null;
        if (!m.b) m.bye = 'b';
      }
      t.matches.push(m);
    }
  }
}

const nextOf = (t, m) =>
  m.round < t.rounds ? t.matches.find((x) => x.round === m.round + 1 && x.index === m.index >> 1) : null;

const feedSlot = (m) => (m.index % 2 === 0 ? 'a' : 'b');

function status(m) {
  if (m.winner) return 'done';
  if (!m.a || !m.b) return 'waiting';
  return m.live ? 'live' : 'ready';
}

const timeLeft = (timer, now) => (timer.running ? Math.max(0, timer.endsAt - now) : timer.remainingMs);

function stopTimer(timer, now) {
  if (!timer.running) return;
  timer.remainingMs = timeLeft(timer, now);
  timer.running = false;
  timer.endsAt = null;
}

function finish(t, m, slot, result, now) {
  stopTimer(m.timer, now);
  Object.assign(m, { winner: slot, result, live: false, finishedAt: now });
  const next = nextOf(t, m);
  if (next) {
    next[feedSlot(m)] = m[slot];
  } else {
    t.championId = m[slot];
    t.status = 'completed';
    t.completedAt = now;
  }
}

/**
 * Applies automatic results: byes, and forfeits for players who were disabled or left.
 * Matches are stored round by round, so one pass cascades all the way to the final.
 */
function settle(t, now = Date.now()) {
  if (t.status !== 'in_progress') return;
  const out = new Set(t.entries.filter((e) => WITHDRAWN.has(e.status)).map((e) => e.playerId));
  for (const m of t.matches) {
    if (m.winner) continue;
    if (m.bye) {
      finish(t, m, m.bye === 'a' ? 'b' : 'a', 'bye', now);
      continue;
    }
    if (!m.a || !m.b) continue;
    const outA = out.has(m.a);
    const outB = out.has(m.b);
    if (outA || outB) finish(t, m, outA && !outB ? 'b' : 'a', 'forfeit', now);
  }
}

function undo(t, m, now) {
  if (!m.winner) fail(409, 'This match has no result to undo.');
  if (m.result === 'bye' || m.result === 'forfeit') {
    fail(409, 'Byes and forfeits are applied automatically and cannot be undone.');
  }
  const next = nextOf(t, m);
  if (next && (next.winner || next.live)) fail(409, 'The next match has already started — undo that one first.');

  if (next) {
    next[feedSlot(m)] = null;
  } else {
    t.championId = null;
    t.status = 'in_progress';
    t.completedAt = null;
  }
  Object.assign(m, { winner: null, result: null, finishedAt: null, live: true });
  settle(t, now);
}

function timerAction(timer, body, now) {
  const minutes = Number(body.minutes);
  switch (body.op) {
    case 'set':
      if (!Number.isFinite(minutes) || minutes < 0 || minutes > 180) fail(400, 'Clock must be 0–180 minutes.');
      Object.assign(timer, newTimer(minutes));
      break;
    case 'start':
      if (timer.running) return;
      if (!(timer.remainingMs > 0)) fail(409, 'Set the clock first.');
      timer.endsAt = now + timer.remainingMs;
      timer.running = true;
      break;
    case 'pause':
      stopTimer(timer, now);
      break;
    case 'add': {
      if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 60) fail(400, 'Add between 0 and 60 minutes.');
      const ms = Math.round(minutes * 60000);
      timer.durationMs += ms;
      if (timer.running) timer.endsAt = Math.max(timer.endsAt, now) + ms;
      else timer.remainingMs += ms;
      break;
    }
    case 'reset':
      Object.assign(timer, { remainingMs: timer.durationMs, endsAt: null, running: false });
      break;
    default:
      fail(400, 'Unknown clock action.');
  }
}

/** Admin actions on a single match. Validates before mutating anything. */
function applyAction(t, m, body, now = Date.now()) {
  if (body.type === 'undo') return undo(t, m, now);
  if (m.winner) fail(409, 'This match is already decided.');
  if (!m.a || !m.b) fail(409, 'Waiting for both players.');

  switch (body.type) {
    case 'start':
      if (m.timer.remainingMs > 0) timerAction(m.timer, { op: 'start' }, now);
      break;
    case 'ball': {
      const n = Number(body.ball);
      if (!Number.isInteger(n) || n < 1 || n > 15) fail(400, 'Ball must be 1–15.');
      const i = m.potted.indexOf(n);
      if (i >= 0) m.potted.splice(i, 1);
      else m.potted.push(n);
      break;
    }
    case 'groups': {
      const group = body.groupA ?? null;
      if (![null, 'solids', 'stripes'].includes(group)) fail(400, 'Group must be solids or stripes.');
      m.groupA = group;
      break;
    }
    case 'timer':
      timerAction(m.timer, body, now);
      if (body.op !== 'start') return; // adjusting the clock does not start the match
      break;
    case 'pause':
      // Off the table for now: stop the clock, keep balls and groups. 'start' resumes it.
      stopTimer(m.timer, now);
      m.live = false;
      return;
    case 'restart':
      // Back to a clean, not-started match with a full clock.
      Object.assign(m, { live: false, startedAt: null, potted: [], groupA: null });
      Object.assign(m.timer, { remainingMs: m.timer.durationMs, endsAt: null, running: false });
      return;
    case 'winner':
      if (body.slot !== 'a' && body.slot !== 'b') fail(400, 'Pick player a or b.');
      finish(t, m, body.slot, body.reason === 'timeout' ? 'timeout' : 'win', now);
      settle(t, now);
      return;
    default:
      fail(400, 'Unknown match action.');
  }

  if (!m.live) {
    m.live = true;
    m.startedAt ??= now; // keep the original start when resuming a paused match
  }
}

/** Re-applies the tournament's default clock to matches nobody has touched yet. */
function resetIdleTimers(t) {
  for (const m of t.matches) {
    if (!m.live && !m.winner && !m.timer.running) m.timer = newTimer(t.timerMinutes);
  }
}

const inBracket = (t, playerId) => t.matches.some((m) => m.a === playerId || m.b === playerId);

module.exports = { build, settle, applyAction, status, resetIdleTimers, inBracket, seedOrder };
