'use strict';

const { fail } = require('./errors');

const MIN_TEAMS = 4;
const DEFAULT_TABLES = 4;
const MAX_TABLES = 16;
const GROUP_LABELS = ['Group 1', 'Group 2'];
const SOLIDS = [1, 2, 3, 4, 5, 6, 7];
const STRIPES = [9, 10, 11, 12, 13, 14, 15];

/**
 * Round-robin rounds for n teams (indices 0..n-1). Odd n: n rounds, one team rests each round.
 * Even n: n-1 rounds, nobody rests. In round r the resting team is index n-1-r, so with five
 * teams the 5th rests first (matching the printed schedule: Team 5 and Team 10 sit out round 1).
 */
function roundRobin(n) {
  if (n < 2) return [];
  const odd = n % 2 === 1;
  const m = odd ? n : n - 1; // odd modulus: i and j meet in the round where i + j ≡ 2·rest
  const rounds = [];
  for (let r = 0; r < m; r++) {
    const rest = m - 1 - r;
    const pairs = [];
    for (let i = 0; i < m; i++) {
      const j = (((2 * rest - i) % m) + m) % m;
      if (i < j) pairs.push([i, j]);
    }
    if (odd) {
      rounds.push({ pairs, rest: [rest] });
    } else {
      pairs.push([rest, n - 1]);
      pairs.sort((x, y) => Math.min(...x) - Math.min(...y));
      rounds.push({ pairs, rest: [] });
    }
  }
  return rounds;
}

function newTimer(minutes) {
  const ms = Math.round(Number(minutes || 0) * 60000);
  return { durationMs: ms, remainingMs: ms, endsAt: null, running: false };
}

function newMatch(e, { round, table, stage, group = null, a = null, b = null, srcA = null, srcB = null, slot = 1 }) {
  return {
    id: `r${round}t${table}`,
    round,
    table,
    stage, // 'group' | 'qf' | 'sf' | 'final' | 'third'
    slot, // number within its knockout stage: QF1–QF4, SF1–SF2 (stages can span rounds)
    group, // 0 | 1 for group matches
    a,
    b,
    srcA, // knockout feeders: {rank: {group, place}} | {winner: matchId} | {loser: matchId}
    srcB,
    winner: null, // 'a' | 'b'
    result: null, // 'win' | 'timeout'
    groupA: null, // 'solids' | 'stripes' — team B gets the other set
    potted: [],
    timer: newTimer(e.clockMinutes),
    live: false,
    startedAt: null,
    finishedAt: null,
  };
}

/**
 * Fits both groups' round-robin matches onto the venue's tables. Each round takes matches in
 * round-robin order, alternating between the groups, as long as a table is free and neither
 * team already plays that round. With enough tables this is exactly the round-robin schedule
 * (10 teams on 4 tables: Group 1 on tables 1–2, Group 2 on 3–4, 5 rounds). With fewer tables
 * the group stage simply takes more rounds and more teams rest each round.
 */
function packGroupRounds(groups, tables) {
  const queues = groups.map((ids, g) => roundRobin(ids.length).flatMap(({ pairs }) => pairs.map(([i, j]) => ({ g, a: ids[i], b: ids[j] }))));
  const rounds = [];
  while (queues.some((q) => q.length)) {
    const busy = new Set();
    const picked = [];
    // The group with more matches left goes first, so neither group falls behind.
    let g = queues[0].length >= queues[1].length ? 0 : 1;
    let stuck = 0;
    while (picked.length < tables && stuck < 2) {
      const k = queues[g].findIndex((m) => !busy.has(m.a) && !busy.has(m.b));
      if (k === -1) {
        stuck += 1;
      } else {
        stuck = 0;
        const [m] = queues[g].splice(k, 1);
        busy.add(m.a).add(m.b);
        picked.push(m);
      }
      g = 1 - g;
    }
    rounds.push(picked.sort((x, y) => x.g - y.g)); // Group 1 on the first tables
  }
  return rounds;
}

/** One knockout stage over as many rounds as it needs: matches fill tables 1, 2, … in order. */
function placeStage(e, specs, stage, tables, round) {
  return specs.map(([srcA, srcB], k) =>
    newMatch(e, { round: round + Math.floor(k / tables), table: (k % tables) + 1, stage, srcA, srcB, slot: k + 1 }),
  );
}

const roundsOf = (stage, tables) => Math.ceil(stage.length / tables);

/**
 * Builds the whole night up front: round-robin in two groups on the venue's tables, then a
 * cross-group knockout (quarterfinals when both groups have 4+ teams), semifinals and the final.
 */
function build(e, teamIds) {
  if (teamIds.length < MIN_TEAMS) fail(409, `Add at least ${MIN_TEAMS} teams first.`);
  const tables = Math.max(1, Math.min(MAX_TABLES, Math.round(e.tableCount) || DEFAULT_TABLES));
  const half = Math.ceil(teamIds.length / 2);
  const groups = [teamIds.slice(0, half), teamIds.slice(half)];
  const matches = [];

  const groupStage = packGroupRounds(groups, tables);
  groupStage.forEach((picked, r) => {
    picked.forEach(({ g, a, b }, k) => matches.push(newMatch(e, { round: r + 1, table: k + 1, stage: 'group', group: g, a, b })));
  });
  const groupRounds = groupStage.length;

  const advance = Math.min(groups[0].length, groups[1].length) >= 4 ? 4 : 2;
  const rank = (group, place) => ({ rank: { group, place } });
  let round = groupRounds + 1;
  let semis;
  if (advance === 4) {
    const qfSpecs = [
      [rank(0, 1), rank(1, 4)],
      [rank(1, 2), rank(0, 3)],
      [rank(1, 1), rank(0, 4)],
      [rank(0, 2), rank(1, 3)],
    ];
    const qf = placeStage(e, qfSpecs, 'qf', tables, round);
    matches.push(...qf);
    round += roundsOf(qfSpecs, tables);
    semis = [
      [{ winner: qf[0].id }, { winner: qf[1].id }],
      [{ winner: qf[2].id }, { winner: qf[3].id }],
    ];
  } else {
    semis = [
      [rank(0, 1), rank(1, 2)],
      [rank(1, 1), rank(0, 2)],
    ];
  }
  const sf = placeStage(e, semis, 'sf', tables, round);
  matches.push(...sf);
  round += roundsOf(semis, tables);

  const final = [{ winner: sf[0].id }, { winner: sf[1].id }];
  const third = [{ loser: sf[0].id }, { loser: sf[1].id }];
  if (!e.thirdPlace) {
    matches.push(newMatch(e, { round, table: 1, stage: 'final', srcA: final[0], srcB: final[1] }));
  } else if (tables >= 2) {
    matches.push(newMatch(e, { round, table: 1, stage: 'final', srcA: final[0], srcB: final[1] }));
    matches.push(newMatch(e, { round, table: 2, stage: 'third', srcA: third[0], srcB: third[1] }));
  } else {
    // One table: the 3rd-place match first, so the night ends with the final.
    matches.push(newMatch(e, { round, table: 1, stage: 'third', srcA: third[0], srcB: third[1] }));
    round += 1;
    matches.push(newMatch(e, { round, table: 1, stage: 'final', srcA: final[0], srcB: final[1] }));
  }

  Object.assign(e, {
    groups,
    groupRounds,
    rounds: round,
    tables: Math.max(...matches.map((m) => m.table)), // tables actually used; never more than tableCount
    advance,
    matches,
    championId: null,
  });
}

function status(m) {
  if (m.winner) return 'done';
  if (!m.a || !m.b) return 'waiting';
  return m.live ? 'live' : 'ready';
}

const touched = (m) => Boolean(m.winner || m.live || m.startedAt || m.potted.length || m.groupA);

const groupOf = (m, slot) => {
  if (!m.groupA) return null;
  if (slot === 'a') return m.groupA;
  return m.groupA === 'solids' ? 'stripes' : 'solids';
};

/** Balls a team has cleared in a match: its own set, plus the 8 if it won with the 8 down. */
function cleared(m, slot) {
  const g = groupOf(m, slot);
  const own = g ? (g === 'solids' ? SOLIDS : STRIPES).filter((n) => m.potted.includes(n)).length : 0;
  return own + (m.winner === slot && m.potted.includes(8) ? 1 : 0);
}

/**
 * Group table. Wins are worth 1 point. A two-way tie is broken by the head-to-head result,
 * three or more by ball differential across all group matches (then balls cleared, then seed).
 */
function standings(e, g) {
  const ids = e.groups[g] ?? [];
  const rows = new Map(ids.map((id, seed) => [id, { id, seed, played: 0, wins: 0, losses: 0, points: 0, ballsFor: 0, ballsAgainst: 0, diff: 0, tiebreak: null }]));
  const done = e.matches.filter((m) => m.stage === 'group' && m.group === g && m.winner);
  for (const m of done) {
    for (const [slot, other] of [['a', 'b'], ['b', 'a']]) {
      const row = rows.get(m[slot]);
      row.played += 1;
      if (m.winner === slot) row.wins += 1;
      else row.losses += 1;
      row.ballsFor += cleared(m, slot);
      row.ballsAgainst += cleared(m, other);
    }
  }
  for (const row of rows.values()) {
    row.points = row.wins;
    row.diff = row.ballsFor - row.ballsAgainst;
  }

  const byBalls = (x, y) => y.diff - x.diff || y.ballsFor - x.ballsFor || x.seed - y.seed;
  const sorted = [...rows.values()].sort((x, y) => y.points - x.points || x.seed - y.seed);
  const out = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j < sorted.length && sorted[j].points === sorted[i].points) j++;
    const block = sorted.slice(i, j);
    if (block.length === 2) {
      const [x, y] = block;
      const h2h = done.find((m) => (m.a === x.id && m.b === y.id) || (m.a === y.id && m.b === x.id));
      if (h2h) {
        if (h2h[h2h.winner] === y.id) block.reverse();
        block.forEach((r) => (r.tiebreak = 'h2h'));
      } else {
        block.sort(byBalls);
      }
    } else if (block.length > 2) {
      block.sort(byBalls);
      if (block[0].played) block.forEach((r) => (r.tiebreak = 'balls'));
    }
    out.push(...block);
    i = j;
  }
  out.forEach((r, k) => (r.place = k + 1));
  return out;
}

const groupStageDone = (e) => e.matches.every((m) => m.stage !== 'group' || m.winner);

function resolveSource(e, src) {
  if (!src) return null;
  if (src.rank) return groupStageDone(e) ? (standings(e, src.rank.group)[src.rank.place - 1]?.id ?? null) : null;
  const from = e.matches.find((m) => m.id === (src.winner ?? src.loser));
  if (!from?.winner) return null;
  const slot = src.winner ? from.winner : from.winner === 'a' ? 'b' : 'a';
  return from[slot];
}

/** Fills knockout slots from standings and earlier results. Matches already in play keep their teams. */
function resolve(e, now = Date.now()) {
  if (e.status === 'setup') return;
  for (const m of e.matches) {
    if (m.stage === 'group' || touched(m)) continue;
    m.a = resolveSource(e, m.srcA);
    m.b = resolveSource(e, m.srcB);
  }
  const final = e.matches.find((m) => m.stage === 'final');
  e.championId = final?.winner ? final[final.winner] : null;
  const allDone = e.matches.every((m) => m.winner);
  e.status = allDone ? 'done' : 'live';
  e.completedAt = allDone ? (e.completedAt ?? now) : null;
}

/** Matches whose teams come from this one (knockout feeders, or every knockout match for a group match). */
function dependents(e, m) {
  if (m.stage === 'group') return e.matches.filter((x) => x.stage !== 'group');
  return e.matches.filter((x) => x.srcA?.winner === m.id || x.srcA?.loser === m.id || x.srcB?.winner === m.id || x.srcB?.loser === m.id);
}

const timeLeft = (timer, now) => (timer.running ? Math.max(0, timer.endsAt - now) : timer.remainingMs);

function stopTimer(timer, now) {
  if (!timer.running) return;
  timer.remainingMs = timeLeft(timer, now);
  timer.running = false;
  timer.endsAt = null;
}

function startTimer(timer, now) {
  if (timer.running || !(timer.remainingMs > 0)) return;
  timer.endsAt = now + timer.remainingMs;
  timer.running = true;
}

function goLive(m, now) {
  startTimer(m.timer, now);
  m.live = true;
  m.startedAt ??= now; // keep the original start when resuming
}

function timerAction(timer, body, now) {
  const minutes = Number(body.minutes);
  switch (body.op) {
    case 'set':
      if (!Number.isFinite(minutes) || minutes < 0 || minutes > 180) fail(400, 'Clock must be 0–180 minutes.');
      Object.assign(timer, newTimer(minutes));
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

function undo(e, m, now) {
  if (!m.winner) fail(409, 'This match has no result to undo.');
  if (dependents(e, m).some((x) => x.winner || x.live || x.startedAt)) {
    fail(409, m.stage === 'group' ? 'The knockout has started — undo those matches first.' : 'The next match has already started — undo that one first.');
  }
  Object.assign(m, { winner: null, result: null, finishedAt: null, live: true });
  resolve(e, now);
}

/** Admin actions on a single table. Validates before mutating anything. */
function applyAction(e, m, body, now = Date.now()) {
  if (e.status === 'setup') fail(409, 'Start the tournament first.');
  if (body.type === 'undo') return undo(e, m, now);
  if (m.winner) fail(409, 'This match is already decided.');
  if (!m.a || !m.b) fail(409, 'Waiting for both teams.');

  switch (body.type) {
    case 'start':
      return goLive(m, now);
    case 'pause':
      stopTimer(m.timer, now);
      m.live = false;
      return;
    case 'restart':
      Object.assign(m, { live: false, startedAt: null, potted: [], groupA: null });
      Object.assign(m.timer, { remainingMs: m.timer.durationMs, endsAt: null, running: false });
      return;
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
      return; // adjusting the clock does not start the match
    case 'winner':
      if (body.slot !== 'a' && body.slot !== 'b') fail(400, 'Pick team a or b.');
      stopTimer(m.timer, now);
      Object.assign(m, { winner: body.slot, result: body.reason === 'timeout' ? 'timeout' : 'win', live: false, finishedAt: now });
      return resolve(e, now);
    default:
      fail(400, 'Unknown match action.');
  }
  if (!m.live) goLive(m, now); // a ball or group call means the match is on
}

/** Start, pause or extend every playable table in a round at once — one shared clock start. */
function roundAction(e, round, body, now = Date.now()) {
  if (e.status === 'setup') fail(409, 'Start the tournament first.');
  const ms = e.matches.filter((m) => m.round === round && m.a && m.b && !m.winner);
  if (!ms.length) fail(409, 'Nothing to run in that round.');
  switch (body.type) {
    case 'start':
      ms.forEach((m) => goLive(m, now));
      break;
    case 'pause':
      ms.filter((m) => m.live).forEach((m) => {
        stopTimer(m.timer, now);
        m.live = false;
      });
      break;
    case 'add':
      ms.forEach((m) => timerAction(m.timer, { op: 'add', minutes: body.minutes ?? 1 }, now));
      break;
    default:
      fail(400, 'Unknown round action.');
  }
}

/** Re-applies the default clock to tables nobody has touched yet. */
function resetIdleTimers(e) {
  for (const m of e.matches) if (!touched(m) && !m.timer.running) m.timer = newTimer(e.clockMinutes);
}

module.exports = { MIN_TEAMS, DEFAULT_TABLES, MAX_TABLES, GROUP_LABELS, roundRobin, build, status, standings, resolve, applyAction, roundAction, resetIdleTimers, cleared };
