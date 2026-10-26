'use strict';

/* =====================================================================
   Constants
   ===================================================================== */

const BALL_COLORS = ['', '#f5c518', '#1e4fd8', '#d92b2b', '#6b2fb8', '#f47a14', '#16834a', '#8a1c22', '#15171a'];
const SOLIDS = [1, 2, 3, 4, 5, 6, 7];
const STRIPES = [9, 10, 11, 12, 13, 14, 15];
const GROUPS = {
  solids: { label: 'Solids', icon: 1, balls: SOLIDS },
  stripes: { label: 'Stripes', icon: 9, balls: STRIPES },
};
const GROUP_NAMES = ['Group 1', 'Group 2'];
const STAGE = { group: 'Group stage', qf: 'Quarterfinals', sf: 'Semifinals', final: 'Final', third: '3rd place' };
const SSE_TIMEOUT_MS = 5000; // no live update by then -> switch to polling
const POLL_MS = 2000;
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const ICON_PATHS = {
  arrowLeft: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  arrowRight: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  arrowUp: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  arrowDown: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  play: '<path d="M7 4v16l13-8z" fill="currentColor"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  rotate: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  grid: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  shuffle: '<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  flag: '<path d="M4 22V4M4 4h13l-2 4 2 4H4"/>',
  zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  hand: '<path d="M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.4l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15"/>',
  alert: '<path d="M12 3 2 21h20z"/><path d="M12 10v5M12 18h.01"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
};

const icon = (name) =>
  `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name]}</svg>`;

const CROWN = `<svg class="crown" viewBox="0 0 24 24" role="img" aria-label="Champion"><path d="M2.5 7.5l5 4.2L12 4l4.5 7.7 5-4.2-2.1 11.3H4.6z" fill="currentColor"/><rect x="4.6" y="19.8" width="14.8" height="2" rx="1" fill="currentColor"/></svg>`;

/* =====================================================================
   State
   ===================================================================== */

const $nav = document.getElementById('topbar');
const $app = document.getElementById('app');
const $modal = document.getElementById('modal-root');
const $toasts = document.getElementById('toast-root');

const S = {
  state: null, // server snapshot (pushed over SSE)
  me: { role: null },
  token: readStored('pm_token'),
  offset: 0, // serverTime - local time, so every device shows the same clock
  online: false,
  events: null,
  polling: false, // true when live updates are blocked and we refresh every POLL_MS instead
  teams: new Map(),
  modal: null,
  acked: new Set(), // time-up alerts the admin already handled
  renderedKey: null,
  adminTab: readStored('pm_tab'),
  adminRound: null, // null = follow the current round
  focusAfter: null, // element id to focus once it shows up (e.g. a team just added)
  fx: emptyFx(), // what changed in the last update, so only that animates
  counts: new Map(), // last shown value of each animated counter
};

function emptyFx() {
  return { potted: new Set(), unpotted: new Set(), finished: new Set(), started: new Set(), champion: false };
}

function readStored(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key, value) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* storage unavailable — lasts for this tab only */
  }
}

/* =====================================================================
   Helpers
   ===================================================================== */

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const now = () => Date.now() + S.offset;
const isAdmin = () => S.me.role === 'admin';
const E = () => S.state.event;
const team = (id) => S.teams.get(id);
const teamName = (id) => team(id)?.name ?? 'TBD';
const activeMembers = (id) => team(id)?.members.filter((m) => m.active) ?? [];
const memberLine = (id) => activeMembers(id).map((m) => m.name).join(' & ') || 'No active players';
const findMatch = (id) => E().matches.find((m) => m.id === id);
const matchAt = (round, table) => E().matches.find((m) => m.round === round && m.table === table);
const ordinal = (n) => n + ({ 1: 'st', 2: 'nd', 3: 'rd' }[n] ?? 'th');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const groupOf = (m, slot) => {
  if (!m.groupA) return null;
  if (slot === 'a') return m.groupA;
  return m.groupA === 'solids' ? 'stripes' : 'solids';
};

/** Balls of their own set still on the table, or null while the table is open. */
function ballsLeft(m, slot) {
  const g = groupOf(m, slot);
  return g ? GROUPS[g].balls.filter((n) => !m.potted.includes(n)).length : null;
}

/** Same rule as the server: own balls pocketed, plus the 8 for a team that won with it down. */
function cleared(m, slot) {
  const left = ballsLeft(m, slot);
  return (left === null ? 0 : 7 - left) + (m.winner === slot && m.potted.includes(8) ? 1 : 0);
}

const other = (slot) => (slot === 'a' ? 'b' : 'a');
const timeLeft = (m) => (m.timer.running ? Math.max(0, m.timer.endsAt - now()) : m.timer.remainingMs);
const isExpired = (m) => m.status === 'live' && m.timer.durationMs > 0 && m.timer.running && timeLeft(m) === 0;

function fmt(ms) {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

const clockTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** The round being played: the first with an undecided match. */
function currentRound(e) {
  const open = e.matches.filter((m) => !m.winner).map((m) => m.round);
  return open.length ? Math.min(...open) : e.rounds;
}

function roundStage(e, r) {
  if (r <= e.groupRounds) return STAGE.group;
  const stage = matchAt(r, 1)?.stage;
  return stage === 'final' ? 'Finals' : STAGE[stage] ?? '';
}

const roundTitle = (e, r) => `Round ${r}`;

function shortLabel(m) {
  if (m.stage === 'qf') return `QF${m.table}`;
  if (m.stage === 'sf') return `SF${m.table}`;
  if (m.stage === 'group') return `${GROUP_NAMES[m.group]} · T${m.table}`;
  return STAGE[m.stage];
}

function srcLabel(src) {
  if (!src) return 'TBD';
  if (src.rank) return `${ordinal(src.rank.place)} G${src.rank.group + 1}`;
  const from = findMatch(src.winner ?? src.loser);
  return `${src.winner ? 'Winner' : 'Loser'} ${from ? shortLabel(from) : ''}`;
}

const slotName = (m, s) => (m[s] ? teamName(m[s]) : srcLabel(m[s === 'a' ? 'srcA' : 'srcB']));

/** Who is sitting out a group round: every group team without a match that round. */
function restingIn(e, r) {
  if (r > e.groupRounds) return [];
  const playing = new Set(e.matches.filter((m) => m.round === r).flatMap((m) => [m.a, m.b]));
  return e.groups.map((ids, g) => ({ g, ids: ids.filter((id) => !playing.has(id)) })).filter((x) => x.ids.length);
}

async function api(method, url, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (S.token) headers.Authorization = `Bearer ${S.token}`;
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  if (method !== 'GET' && S.polling) refresh(); // show your own change right away, not on the next poll
  return data;
}

const act = (mid, body) => api('POST', `/api/matches/${mid}/action`, body);

async function run(fn) {
  try {
    return await fn();
  } catch (err) {
    toast(err.message, 'error');
  }
}

function toast(message, kind = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = message;
  $toasts.append(el);
  setTimeout(() => el.classList.add('out'), 3200);
  setTimeout(() => el.remove(), 3600);
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach((at) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.18, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + at + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.2);
    });
  } catch {
    /* audio unavailable */
  }
}

/* =====================================================================
   Building blocks
   ===================================================================== */

function ball(n, size = 32, potted = false, extra = '') {
  const kind = n === 8 ? 'eight' : n > 8 ? 'stripe' : 'solid';
  const color = BALL_COLORS[n > 8 ? n - 8 : n];
  const cls = `ball ${kind}${potted ? ' potted' : ''}${size < 20 ? ' tiny' : ''} ${extra}`;
  return `<span class="${cls}" style="--c:${color};--size:${size}px" role="img" aria-label="Ball ${n}${potted ? ', pocketed' : ''}"><span class="ball-num">${n}</span></span>`;
}

/** A ball in a match, animated when it just dropped (or came back). */
function matchBall(m, n, size) {
  const key = `${m.id}:${n}`;
  const fx = S.fx.potted.has(key) ? 'drop' : S.fx.unpotted.has(key) ? 'unpot' : '';
  return ball(n, size, m.potted.includes(n), fx);
}

function avatar(name, size = '') {
  const initials = String(name)
    .split(/\s+/)
    .map((w) => [...w][0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const hue = [...String(name)].reduce((h, c) => (h * 31 + c.codePointAt(0)) % 360, 7);
  return `<span class="avatar ${size}" style="--h:${hue}" aria-hidden="true">${esc(initials)}</span>`;
}

const pill = (label, tone, lead = '') => `<span class="pill ${tone}">${lead}${esc(label)}</span>`;
const livePill = (label = 'Live', size = '') => pill(label, `green ${size}`, '<span class="live-dot"></span>');
const groupChip = (g) => `<span class="chip group">${ball(GROUPS[g].icon, 16)}${GROUPS[g].label}</span>`;

function emptyState(title, body, art = 8, extra = '') {
  return `<div class="empty anim">${ball(art, 56, false, 'float')}<h3>${esc(title)}</h3><p class="muted">${esc(body)}</p>${extra}</div>`;
}

function statusTag(m, size = 'xs') {
  const e = E();
  if (m.status === 'live') {
    return m.timer.durationMs
      ? `<span class="pill green ${size}"><span class="live-dot"></span><span data-timer="${m.id}">${fmt(timeLeft(m))}</span></span>`
      : livePill('Live', size);
  }
  if (m.status === 'done') return m.result === 'timeout' ? pill('On time', `amber ${size}`) : pill('Final', `gold ${size}`);
  if (m.status === 'ready') {
    if (m.startedAt) return pill('Paused', `amber ${size}`);
    return m.round === currentRound(e) && !e.preview ? pill('Up next', `blue ${size}`) : '';
  }
  return pill('TBD', `muted ${size}`);
}

/* =====================================================================
   Top bar
   ===================================================================== */

function navView(r) {
  const link = (href, name, label) => `<a href="${href}" class="${r.name === name ? 'active' : ''}">${label}</a>`;
  const live = S.state?.event.status === 'live';
  return `<div class="topbar-inner">
    <a class="brand" href="#/">${ball(8, 30, false, 'spin-hover')}<span class="brand-text">Pool<b>Masters</b></span></a>
    <nav class="nav">
      ${link('#/', 'home', `${live ? '<span class="live-dot"></span>' : ''}Live`)}
      ${link('#/schedule', 'schedule', 'Schedule')}
      ${link('#/rules', 'rules', 'Rules')}
      ${link('#/admin', 'admin', isAdmin() ? `${icon('shield')}<span class="nav-label">Admin</span>` : 'Admin')}
    </nav>
    <div class="topbar-right">
      <span class="conn ${S.online ? 'on' : ''} ${S.polling ? 'poll' : ''}" title="${!S.online ? 'Reconnecting…' : S.polling ? `Updating every ${POLL_MS / 1000} s` : 'Live'}"></span>
      ${isAdmin() ? `<button class="icon-btn" data-action="logout" title="Sign out" aria-label="Sign out">${icon('logout')}</button>` : ''}
    </div>
  </div>`;
}

/* =====================================================================
   Home: the night at a glance
   ===================================================================== */

function homeView() {
  const e = E();
  if (e.status === 'setup') return setupHome(e);
  const r = currentRound(e);
  const done = e.matches.filter((m) => m.winner).length;
  return `
  ${e.status === 'done' ? championBanner(e) : ''}
  <section class="live-hero anim">
    <div class="lh-copy">
      <span class="eyebrow">${e.status === 'done' ? 'Final results' : `${roundTitle(e, r)} of ${e.rounds} · ${roundStage(e, r)}`}</span>
      <h1>${esc(e.name)}</h1>
      ${roundTrack(e, r)}
    </div>
    ${statTiles(e, done)}
  </section>
  ${e.status === 'live' ? `<section class="section anim">
    <div class="section-head"><h2>${e.matches.some((m) => m.status === 'live') ? livePill('Live') : ''} On the tables</h2>
      <a class="btn ghost sm" href="#/schedule">${icon('grid')} Full schedule</a></div>
    ${tablesStrip(e, r)}
  </section>` : ''}
  <section class="section anim">
    <div class="section-head"><h2>Group standings</h2><span class="muted small">Win = 1 point · top ${e.advance} of each group go through</span></div>
    <div class="standings-grid">${[0, 1].map((g) => standingsCard(e, g)).join('')}</div>
  </section>
  <section class="section anim">
    <div class="section-head"><h2>Road to the final</h2></div>
    ${knockoutView(e)}
  </section>
  <section class="section anim">
    <div class="section-head"><h2>Leaders</h2></div>
    ${leaders(e)}
  </section>
  ${historySection()}`;
}

/** One segment per round: done, current, upcoming. Knockout rounds in gold. */
function roundTrack(e, r) {
  const segs = [];
  for (let i = 1; i <= e.rounds; i++) {
    const ms = e.matches.filter((m) => m.round === i);
    const share = ms.length ? ms.filter((m) => m.winner).length / ms.length : 0;
    const state = share === 1 ? 'done' : i === r && e.status === 'live' ? 'now' : '';
    segs.push(`<span class="seg-r ${state} ${i > e.groupRounds ? 'ko' : ''}" title="${roundTitle(e, i)} · ${roundStage(e, i)}" style="--fill:${Math.round(share * 100)}%"><i></i><b>${i}</b></span>`);
  }
  return `<div class="round-track" aria-label="Rounds">${segs.join('')}</div>
    <div class="track-legend"><span>${STAGE.group}</span><span class="ko">Knockout</span></div>`;
}

function statTiles(e, done) {
  const finished = e.matches.filter((m) => m.winner && m.startedAt && m.finishedAt);
  const avg = finished.length ? finished.reduce((s, m) => s + (m.finishedAt - m.startedAt), 0) / finished.length : 0;
  const tile = (key, value, label, ic, suffix = '') =>
    `<div class="stat"><span class="stat-ic">${icon(ic)}</span><b><span data-count="${key}">${value}</span>${suffix}</b><span>${label}</span></div>`;
  return `<div class="stat-tiles">
    ${tile('matches', done, `of ${e.matches.length} matches played`, 'flag')}
    ${tile('balls', e.matches.reduce((n, m) => n + m.potted.length, 0), 'balls pocketed', 'target')}
    ${tile('eights', e.matches.filter((m) => m.potted.includes(8)).length, '8-balls sunk', 'zap')}
    <div class="stat"><span class="stat-ic">${icon('clock')}</span><b>${avg ? fmt(avg) : '—'}</b><span>average match</span></div>
  </div>`;
}

/** Read-only mini tables for the round in play. */
function tablesStrip(e, r) {
  const tiles = [];
  for (let t = 1; t <= e.tables; t++) {
    const m = matchAt(r, t);
    tiles.push(m ? miniTable(e, m) : `<div class="mini-table open"><span class="mt-num">Table ${t}</span><span class="muted">Open play</span></div>`);
  }
  const resting = restingIn(e, r);
  return `<div class="tables-strip">${tiles.join('')}</div>
    ${resting.length ? `<p class="resting-line">${icon('pause')} Resting: ${resting.map((x) => x.ids.map((id) => `<span class="chip muted">${esc(teamName(id))}</span>`).join('')).join('')}</p>` : ''}`;
}

function miniTable(e, m) {
  const row = (s) => {
    const left = ballsLeft(m, s);
    const g = groupOf(m, s);
    const cls = m.winner === s ? 'win' : m.winner ? 'lose' : '';
    return `<div class="mt-row ${cls}">
      ${m[s] ? avatar(teamName(m[s]), 'sm') : '<span class="avatar sm ghost">?</span>'}
      <div class="mt-who"><span class="mt-name truncate">${esc(slotName(m, s))}</span>
        ${g ? `<span class="mt-balls">${GROUPS[g].balls.map((n) => matchBall(m, n, 12)).join('')}</span>` : `<span class="mt-sub truncate">${m[s] ? esc(memberLine(m[s])) : ''}</span>`}</div>
      <span class="mt-left">${m.winner === s ? icon('trophy') : left === null ? '' : `<b>${left}</b><small>left</small>`}</span>
    </div>`;
  };
  return `<div class="mini-table felt st-${m.status} ${S.fx.finished.has(m.id) ? 'just-won' : ''} ${S.fx.started.has(m.id) ? 'kick' : ''}" data-mid="${m.id}">
    <div class="mt-head"><span class="mt-num">Table ${m.table}</span><span class="mt-tag">${m.stage === 'group' ? GROUP_NAMES[m.group] : STAGE[m.stage]}</span>${statusTag(m)}</div>
    ${row('a')}${row('b')}
    ${m.potted.includes(8) ? `<span class="mt-eight">${ball(8, 18)}</span>` : ''}
  </div>`;
}

function standingsCard(e, g) {
  const rows = e.standings[g] ?? [];
  const body = rows
    .map((row, i) => {
      const ko = i === e.advance - 1 ? 'cut' : '';
      const tb = row.tiebreak ? `<abbr class="tb" title="${row.tiebreak === 'h2h' ? 'Tie broken by head-to-head' : 'Tie broken by ball differential'}">${row.tiebreak === 'h2h' ? 'H2H' : '±'}</abbr>` : '';
      return `<tr class="${i < e.advance ? 'adv' : ''} ${ko}" data-flip="st-${row.id}">
        <td class="pos"><span>${row.place}</span></td>
        <td class="team-cell"><div class="tc-wrap">${avatar(teamName(row.id), 'sm')}<div class="min0"><div class="truncate b">${esc(teamName(row.id))} ${tb}</div><div class="truncate muted xs">${esc(memberLine(row.id))}</div></div></div></td>
        <td>${row.played}</td><td>${row.wins}</td><td>${row.losses}</td>
        <td class="${row.diff > 0 ? 'pos-diff' : row.diff < 0 ? 'neg-diff' : ''}">${row.diff > 0 ? '+' : ''}${row.diff}</td>
        <td class="pts"><b>${row.points}</b></td>
      </tr>`;
    })
    .join('');
  return `<div class="card standings">
    <div class="card-head"><h3>${GROUP_NAMES[g]}</h3><span class="muted small">${plural(rows.length, 'team')}</span></div>
    <div class="table-scroll"><table class="st-table">
      <thead><tr><th>#</th><th class="left">Team</th><th title="Played">P</th><th title="Won">W</th><th title="Lost">L</th><th title="Ball differential">+/−</th><th>Pts</th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>
  </div>`;
}

/** Quarterfinals → semifinals → final, filled in as results land. */
function knockoutView(e) {
  const cols = ['qf', 'sf', 'final']
    .map((stage) => {
      const ms = e.matches.filter((m) => m.stage === stage || (stage === 'final' && m.stage === 'third'));
      if (!ms.length) return '';
      return `<div class="ko-col"><div class="ko-title">${stage === 'final' ? 'Finals' : STAGE[stage]}</div>
        <div class="ko-matches">${ms.map((m) => koCard(m)).join('')}</div></div>`;
    })
    .join('');
  return `<div class="ko-scroll" data-scroll-id="ko"><div class="ko-board">${cols}</div></div>`;
}

function koCard(m) {
  const row = (s) => {
    const cls = m.winner === s ? 'win' : m.winner ? 'lose' : !m[s] ? 'tbd' : '';
    const champ = m.stage === 'final' && m.winner === s;
    return `<div class="ko-row ${cls}">${m[s] ? avatar(teamName(m[s]), 'sm') : ''}<span class="truncate">${esc(slotName(m, s))}</span>${champ ? CROWN : m.winner === s ? icon('check') : ''}</div>`;
  };
  return `<div class="ko-card st-${m.status} ${m.stage}" data-mid="${m.id}">
    <div class="ko-head"><span>${m.stage === 'third' ? '3rd place' : m.stage === 'final' ? 'Championship' : shortLabel(m)} · T${m.table}</span>${statusTag(m)}</div>
    ${row('a')}${row('b')}
  </div>`;
}

function leaders(e) {
  const stats = new Map();
  const get = (id) => stats.get(id) ?? stats.set(id, { id, wins: 0, cleared: 0, fastest: null }).get(id);
  let margin = null;
  for (const m of e.matches) {
    if (!m.winner) continue;
    for (const s of ['a', 'b']) get(m[s]).cleared += cleared(m, s);
    const w = get(m[m.winner]);
    w.wins += 1;
    const dur = m.startedAt && m.finishedAt ? m.finishedAt - m.startedAt : null;
    if (dur && (w.fastest === null || dur < w.fastest)) w.fastest = dur;
    const diff = cleared(m, m.winner) - cleared(m, other(m.winner));
    if (!margin || diff > margin.diff) margin = { m, diff };
  }
  const list = [...stats.values()];
  if (!list.length) return emptyState('No results yet', 'Leaders show up here once the first matches finish.', 9);
  const top = (key, fmtValue, asc = false) =>
    list
      .filter((x) => x[key] !== null && x[key] > 0)
      .sort((x, y) => (asc ? x[key] - y[key] : y[key] - x[key]))
      .slice(0, 3)
      .map((x, i) => `<li><span class="rank r${i + 1}">${i + 1}</span>${avatar(teamName(x.id), 'sm')}<span class="truncate">${esc(teamName(x.id))}</span><b>${fmtValue(x[key])}</b></li>`)
      .join('') || '<li class="muted">—</li>';
  return `<div class="leaders">
    <div class="card leader"><div class="leader-head">${icon('trophy')}<h3>Most wins</h3></div><ol>${top('wins', (v) => v)}</ol></div>
    <div class="card leader"><div class="leader-head">${icon('target')}<h3>Balls cleared</h3></div><ol>${top('cleared', (v) => v)}</ol></div>
    <div class="card leader"><div class="leader-head">${icon('zap')}<h3>Fastest win</h3></div><ol>${top('fastest', fmt, true)}</ol></div>
    <div class="card leader"><div class="leader-head">${icon('flag')}<h3>Biggest margin</h3></div>
      ${margin && margin.diff > 0
        ? `<div class="margin"><b>${esc(teamName(margin.m[margin.m.winner]))}</b><span class="muted small">beat ${esc(teamName(margin.m[other(margin.m.winner)]))} by ${plural(margin.diff, 'ball')}</span></div>`
        : '<p class="muted small">Track balls to see this.</p>'}</div>
  </div>`;
}

function championBanner(e) {
  const id = e.championId;
  if (!id) return '';
  const final = e.matches.find((m) => m.stage === 'final');
  const runnerUp = final?.winner ? final[other(final.winner)] : null;
  const third = e.matches.find((m) => m.stage === 'third' && m.winner);
  return `<section class="champion anim">
    <div class="champion-glow"></div>
    <div class="champion-avatar"><span class="crown-float">${CROWN}</span>${avatar(teamName(id), 'xl')}</div>
    <div class="champion-copy">
      <span class="eyebrow gold">Champions</span>
      <h2>${esc(teamName(id))}</h2>
      <p class="muted">${esc(memberLine(id))}</p>
      <div class="podium-line">
        ${runnerUp ? `<span>${pill('2nd', 'muted xs')} ${esc(teamName(runnerUp))}</span>` : ''}
        ${third ? `<span>${pill('3rd', 'muted xs')} ${esc(teamName(third[third.winner]))}</span>` : ''}
      </div>
    </div>
    <div class="champion-ball">${ball(8, 84, false, 'float')}</div>
  </section>`;
}

function historySection() {
  const h = S.state.history;
  if (!h.length) return '';
  return `<section class="section anim">
    <div class="section-head"><h2>Hall of fame</h2><span class="muted small">${plural(h.length, 'past tournament')}</span></div>
    <div class="hall">${h
      .map((x) => `<div class="hall-item">
        ${CROWN}
        <div class="min0"><div class="b truncate">${esc(x.podium[0]?.name ?? '—')}</div>
          <div class="muted xs truncate">${esc(x.podium[0]?.members.join(' & ') ?? '')}</div></div>
        <div class="hall-meta"><span class="truncate">${esc(x.name)}</span><span>${x.completedAt ? new Date(x.completedAt).toLocaleDateString() : ''}</span></div>
      </div>`)
      .join('')}</div>
  </section>`;
}

/** Before the start: the teams, the format and the last champions. */
function setupHome(e) {
  const teams = S.state.teams;
  const format = e.preview
    ? `${plural(teams.length, 'team')} · ${e.rounds} rounds on ${e.tables} tables · about ${Math.round((e.rounds * e.clockMinutes) / 6) / 10} hours`
    : `${plural(teams.length, 'team')} so far · at least 4 to play`;
  return `
  <section class="hero anim">
    <div class="hero-copy">
      <span class="eyebrow">Getting ready</span>
      <h1>${esc(e.name)}<br><span class="grad">Racking up soon.</span></h1>
      <p class="lead">${format}. Two groups play a round robin, then the top teams go through to the knockout.</p>
      <div class="hero-actions">
        <a class="btn primary" href="#/schedule">${icon('grid')} See the schedule</a>
        <a class="btn ghost" href="#/rules">${icon('book')} House rules</a>
      </div>
    </div>
    <div class="hero-rack" aria-hidden="true">${[[1], [9, 2], [10, 8, 3], [11, 4, 12, 5], [6, 13, 7, 14, 15]]
      .map((row, i) => `<div class="hr-row" style="--r:${i}">${row.map((n) => ball(n, 46)).join('')}</div>`)
      .join('')}</div>
  </section>
  <section class="section anim">
    <div class="section-head"><h2>Teams</h2>${isAdmin() ? `<a class="btn ghost sm" href="#/admin">${icon('gear')} Manage teams</a>` : ''}</div>
    ${teams.length
      ? `<div class="team-grid">${teams
          .map((t, i) => {
            const g = e.preview ? (e.groups[0].includes(t.id) ? 0 : 1) : null;
            return `<div class="team-card" style="--i:${i}">${avatar(t.name, 'lg')}<div class="min0"><div class="b truncate">${esc(t.name)}</div>
              <div class="muted small truncate">${esc(memberLine(t.id))}</div></div>${g !== null ? `<span class="pill ${g ? 'blue' : 'green'} xs">G${g + 1}</span>` : ''}</div>`;
          })
          .join('')}</div>`
      : emptyState('No teams yet', 'The admin adds the teams.', 9)}
  </section>
  ${historySection()}`;
}

/* =====================================================================
   Schedule grid: rounds × tables, plus who is resting
   ===================================================================== */

function scheduleView() {
  const e = E();
  if (!e.matches.length) {
    return `<div class="page-head anim"><div><span class="eyebrow">Schedule</span><h1>The night ahead</h1></div></div>
      ${emptyState('Not enough teams yet', 'The schedule appears once there are at least 4 teams.', 3)}`;
  }
  const cur = e.status === 'live' ? currentRound(e) : null;
  const tables = Array.from({ length: e.tables }, (_, i) => i + 1);
  const groupOfTable = (t) => matchAt(1, t)?.group;
  const head = `<div class="sh corner">Round</div>${tables
    .map((t) => {
      const g = groupOfTable(t);
      return `<div class="sh g${g ?? 'x'}"><b>Table ${t}</b><small>${g === undefined ? 'Knockout' : GROUP_NAMES[g]}</small></div>`;
    })
    .join('')}<div class="sh rest"><b>Resting</b><small>Bye</small></div>`;

  const rows = [];
  for (let r = 1; r <= e.rounds; r++) {
    if (r === e.groupRounds + 1) rows.push(`<div class="sched-divider"><span>${icon('trophy')} Knockout</span></div>`);
    const at = e.startedAt ? ` · ${clockTime(e.startedAt + (r - 1) * e.clockMinutes * 60000)}` : ` · +${(r - 1) * e.clockMinutes} min`;
    const isCur = r === cur;
    rows.push(`<div class="sr-label ${isCur ? 'now' : ''}" style="--row:${r}"><b>R${r}</b><small>${roundStage(e, r)}${at}</small>${isCur ? '<span class="now-tag">Now</span>' : ''}</div>`);
    for (const t of tables) {
      const m = matchAt(r, t);
      rows.push(m ? schedCell(e, m, isCur) : `<div class="cell open ${isCur ? 'now' : ''}" style="--row:${r}"><span>Open play</span></div>`);
    }
    const resting = restingIn(e, r);
    rows.push(`<div class="cell rest ${isCur ? 'now' : ''}" style="--row:${r}">${resting.length
      ? resting.map((x) => x.ids.map((id) => `<span class="rest-chip g${x.g}">${esc(teamName(id))}</span>`).join('')).join('')
      : `<span class="muted xs">${r > e.groupRounds ? '—' : 'Nobody'}</span>`}</div>`);
  }

  return `
  <div class="page-head anim">
    <div><span class="eyebrow">${e.preview ? 'Preview' : 'Schedule'}</span><h1>${esc(e.name)}</h1>
      <div class="meta-row"><span>${icon('clock')} ${e.rounds} rounds × ${e.clockMinutes} min</span><span>${icon('grid')} ${e.tables} tables</span><span>${icon('users')} ${plural(e.groups.flat().length, 'team')}</span></div></div>
    <div class="legend"><span class="lg g0">Group 1</span><span class="lg g1">Group 2</span><span class="lg ko">Knockout</span><span class="lg live">Live</span></div>
  </div>
  ${e.preview ? `<p class="notice anim">${icon('alert')} This is a preview from the current team list. Groups and order are locked when the admin starts the tournament.</p>` : ''}
  <div class="sched-scroll anim" data-scroll-id="sched">
    <div class="sched" style="--tables:${e.tables}">${head}${rows.join('')}</div>
  </div>`;
}

function schedCell(e, m, isCur) {
  const row = (s) => {
    const cls = m.winner === s ? 'win' : m.winner ? 'lose' : !m[s] ? 'tbd' : '';
    const left = ballsLeft(m, s);
    const score = m.winner === s ? icon('check') : m.status !== 'ready' && left !== null && m.status !== 'waiting' ? `<small>${left}</small>` : '';
    return `<div class="c-team ${cls}"><span class="truncate">${esc(slotName(m, s))}</span>${score}</div>`;
  };
  const tone = m.stage === 'group' ? `g${m.group}` : 'ko';
  const clickable = isAdmin() && !e.preview;
  return `<${clickable ? 'button type="button"' : 'div'} class="cell match ${tone} st-${m.status} ${isCur ? 'now' : ''} ${S.fx.finished.has(m.id) ? 'just-won' : ''}" style="--row:${m.round}" data-mid="${m.id}" ${clickable ? `data-action="goto-round" data-round="${m.round}" title="Open in the control room"` : ''}>
    ${m.stage === 'group' ? '' : `<span class="c-stage">${m.stage === 'final' ? `${CROWN} Championship` : m.stage === 'third' ? '3rd place' : shortLabel(m)}</span>`}
    ${row('a')}<span class="c-vs">vs</span>${row('b')}
    <div class="c-foot">${statusTag(m)}</div>
  </${clickable ? 'button' : 'div'}>`;
}

/* =====================================================================
   Rules
   ===================================================================== */

function rulesView() {
  const e = E();
  const clock = e.clockMinutes || 15;
  const rule = (ic, title, body) => `<div class="rule anim"><span class="rule-ic">${icon(ic)}</span><div><h3>${title}</h3><p>${body}</p></div></div>`;
  return `
  <div class="page-head anim"><div><span class="eyebrow">House rules</span><h1>8-Ball rules</h1>
    <p class="lead">Everything you need for the night: how to play, how the clock works and how the tournament is decided.</p></div></div>

  <section class="rules-section">
    <h2 class="anim">On the table</h2>
    <div class="rules">
      ${rule('target', 'Open table after the break', 'The table stays <b>open</b> after the break until a player legally pockets a <b>called</b> ball. That claims stripes or solids for the team.')}
      ${rule('hand', 'Call your shot', 'Call the ball and the pocket for any shot that is not blatantly obvious. That includes <b>all banks and combinations</b>.')}
      ${rule('check', 'A legal shot', 'The cue ball must hit <b>your own suit first</b>. After that, any ball must hit a cushion or drop into a pocket. Anything else is a foul.')}
      ${rule('alert', 'Fouls give ball-in-hand', 'Scratching, hitting the wrong ball first or failing to hit a rail are fouls. The opponent gets the cue ball <b>in hand anywhere</b> on the table.')}
      ${rule('zap', 'Losing on the 8', 'Any of these is an <b>instant loss</b>: sinking the 8-ball before your suit is cleared, scratching while shooting the 8, or sinking it into an uncalled pocket.')}
    </div>
  </section>

  <section class="rules-section">
    <h2 class="anim">The tournament</h2>
    <div class="format anim">
      <div class="fmt-step g0"><span class="fmt-k">Rounds 1–5</span><b>Group stage</b><p>10 teams in two groups of five. Each team plays 4 matches and rests once.</p>
        <div class="fmt-balls">${[1, 2, 3, 4, 5].map((n) => ball(n, 18)).join('')}</div></div>
      <span class="fmt-arrow">${icon('arrowRight')}</span>
      <div class="fmt-step ko"><span class="fmt-k">Round 6</span><b>Quarterfinals</b><p>The top 4 of each group cross over: 1st G1 vs 4th G2, and so on.</p></div>
      <span class="fmt-arrow">${icon('arrowRight')}</span>
      <div class="fmt-step ko"><span class="fmt-k">Round 7</span><b>Semifinals</b><p>Four teams left, on tables 1 and 2.</p></div>
      <span class="fmt-arrow">${icon('arrowRight')}</span>
      <div class="fmt-step gold"><span class="fmt-k">Round 8</span><b>Final</b><p>Championship on table 1 and a 3rd-place match on table 2.</p>${CROWN}</div>
    </div>
    <div class="rules">
      ${rule('clock', `${clock}-minute cap`, `Every match has a strict ${clock}-minute clock. When time runs out, the team with the <b>fewest balls remaining</b> wins. If balls are tied, the current shooter gets <b>one sudden-death shot</b> at the 8-ball to decide it.`)}
      ${rule('trophy', 'Standings', 'A win is worth <b>1 point</b>. A two-way tie is broken by the <b>head-to-head</b> result. A tie between three or more teams is broken by <b>ball differential</b> across all group matches.')}
      ${rule('flag', 'Ball differential', 'For each group match: the balls of your suit you cleared (plus the 8 when you win with it) minus your opponent’s. The admin taps every pocketed ball, so it is counted live.')}
      ${rule('grid', 'The schedule', `${e.rounds || 8} rounds of ${clock} minutes on ${e.tables || 4} tables, about two hours in all. <a href="#/schedule" class="link">See the full grid →</a>`)}
    </div>
  </section>`;
}

/* =====================================================================
   Admin
   ===================================================================== */

function adminView() {
  if (!isAdmin()) {
    return `<div class="center-wrap"><div class="card auth-card narrow anim">
      <div class="auth-icon">${icon('shield')}</div>
      <h2>Admin sign in</h2>
      <p class="muted">Manage teams and run the tables.</p>
      <form data-form="admin-login" class="stack">
        <label class="field"><span>Admin password</span><input id="admin-pass" name="password" type="password" required autocomplete="current-password"></label>
        <button class="btn primary block" type="submit">Sign in</button>
      </form>
    </div></div>`;
  }
  const e = E();
  const tab = S.adminTab || (e.status === 'setup' ? 'teams' : 'tables');
  const tabBtn = (id, label, ic, badge = '') =>
    `<button class="tab ${tab === id ? 'on' : ''}" data-action="tab" data-tab="${id}" role="tab" aria-selected="${tab === id}">${icon(ic)}<span>${label}</span>${badge}</button>`;
  const liveCount = e.status === 'live' ? e.matches.filter((m) => m.status === 'live').length : 0;
  const body = { tables: tablesPanel, teams: teamsPanel, event: eventPanel }[tab](e);
  return `
  <div class="admin-head anim">
    <div><span class="eyebrow">Control room</span><h1>${esc(e.name)}</h1></div>
    <div class="tabs" role="tablist">
      ${tabBtn('tables', 'Tables', 'grid', liveCount ? `<span class="tab-badge">${liveCount}</span>` : '')}
      ${tabBtn('teams', 'Teams', 'users', `<span class="tab-count">${S.state.teams.length}</span>`)}
      ${tabBtn('event', 'Tournament', 'gear')}
    </div>
  </div>
  ${body}`;
}

/* ---------------------------------------------------------------- Teams */

function teamsPanel(e) {
  const teams = S.state.teams;
  const setup = e.status === 'setup';
  const groups = e.groups.length ? e.groups : [teams.map((t) => t.id)];
  const block = (ids, g) => {
    const list = ids.map((id) => teams.find((t) => t.id === id)).filter(Boolean);
    return `<div class="team-block">
      ${e.groups.length ? `<div class="tb-head g${g}"><span>${GROUP_NAMES[g]}</span><span class="muted xs">${plural(list.length, 'team')}</span></div>` : ''}
      ${list.map((t) => teamRow(t, teams.indexOf(t), teams.length, setup)).join('')}
    </div>`;
  };
  return `
  <div class="panel-bar anim">
    <div class="pb-copy">${setup
      ? `<b>${plural(teams.length, 'team')}</b><span class="muted small">${e.preview ? `Group 1 gets the first ${e.groups[0].length}, Group 2 the rest. Reorder or shuffle to change the groups.` : 'Add at least 4 teams to build the schedule.'}</span>`
      : `<b>Teams are locked</b><span class="muted small">The tournament is on. You can still rename teams and players, or disable a player.</span>`}</div>
    ${setup ? `<div class="btn-row">
      <button class="btn ghost" data-action="team-shuffle" ${teams.length < 2 ? 'disabled' : ''}>${icon('shuffle')} Shuffle</button>
      <button class="btn primary" data-action="team-add">${icon('plus')} Add team</button>
    </div>` : ''}
  </div>
  ${teams.length ? `<div class="team-list anim">${groups.map(block).join('')}</div>` : emptyState('No teams yet', 'Add a team for each pair of players. Names can be changed any time.', 9, `<button class="btn primary" data-action="team-add">${icon('plus')} Add the first team</button>`)}
  ${setup && teams.length ? `<button class="add-row anim" data-action="team-add">${icon('plus')} Add another team</button>` : ''}`;
}

function teamRow(t, i, total, setup) {
  const members = t.members
    .map(
      (m, k) => `<div class="member ${m.active ? '' : 'off'}">
        <input class="inline-input" id="mn-${t.id}-${k}" data-edit="member-name" data-id="${t.id}" data-index="${k}" value="${esc(m.name)}" maxlength="24" aria-label="Player ${k + 1} name" autocomplete="off">
        <label class="mini-switch" title="${m.active ? 'Playing · tap to disable' : 'Disabled · tap to enable'}">
          <input type="checkbox" data-edit="member-active" data-id="${t.id}" data-index="${k}" ${m.active ? 'checked' : ''} aria-label="${esc(m.name)} is playing"><span class="track"></span>
        </label>
      </div>`,
    )
    .join('');
  return `<div class="team-row" data-flip="team-${t.id}">
    <span class="seed">${i + 1}</span>
    ${avatar(t.name)}
    <input class="inline-input team-name" id="tn-${t.id}" data-edit="team-name" data-id="${t.id}" value="${esc(t.name)}" maxlength="24" aria-label="Team name" autocomplete="off">
    <div class="members">${members}</div>
    ${setup ? `<div class="row-actions">
      <button class="icon-btn" data-action="team-move" data-id="${t.id}" data-by="-1" ${i === 0 ? 'disabled' : ''} title="Move up" aria-label="Move up">${icon('arrowUp')}</button>
      <button class="icon-btn" data-action="team-move" data-id="${t.id}" data-by="1" ${i === total - 1 ? 'disabled' : ''} title="Move down" aria-label="Move down">${icon('arrowDown')}</button>
      <button class="icon-btn danger" data-action="team-del" data-id="${t.id}" title="Remove team" aria-label="Remove team">${icon('trash')}</button>
    </div>` : ''}
  </div>`;
}

/* ---------------------------------------------------------------- Tournament settings */

function eventPanel(e) {
  const setup = e.status === 'setup';
  const teams = S.state.teams.length;
  const ko = e.preview || !setup ? (e.advance === 4 ? 'quarterfinals, semifinals, final' : 'semifinals, final') : '';
  const summary = e.preview || !setup
    ? `<ol class="fmt-list">
        <li><b>${plural(e.groups.flat().length, 'team')}</b> → Group 1 (${e.groups[0].length}) and Group 2 (${e.groups[1].length})</li>
        <li><b>${e.groupRounds} group rounds</b> → every team plays everyone in its group once</li>
        <li><b>Knockout</b> → top ${e.advance} of each group: ${ko}${e.thirdPlace ? ', plus a 3rd-place match' : ''}</li>
        <li><b>${e.rounds} rounds on ${e.tables} tables</b> → about ${e.rounds * e.clockMinutes} minutes</li>
      </ol>`
    : `<p class="muted">Add at least 4 teams to see the format.</p>`;
  return `
  <div class="admin-grid anim">
    <div class="card">
      <div class="card-head"><h3>Settings</h3></div>
      <form data-form="event" class="stack">
        <label class="field"><span>Tournament name</span><input id="ev-name" name="name" required maxlength="60" value="${esc(e.name)}"></label>
        <label class="field"><span>Match clock (minutes, 0 = none)</span><input id="ev-clock" name="clockMinutes" type="number" min="0" max="180" step="0.5" value="${e.clockMinutes}"></label>
        <label class="switch ${setup ? '' : 'disabled'}">
          <input id="ev-third" name="thirdPlace" type="checkbox" ${e.thirdPlace ? 'checked' : ''} ${setup ? '' : 'disabled'}>
          <span class="track"></span>
          <span><b>3rd-place match</b><br><span class="muted small">Played on table 2 next to the final.${setup ? '' : ' Locked once started.'}</span></span>
        </label>
        <button class="btn primary" type="submit">${icon('check')} Save</button>
      </form>
    </div>
    <div class="card">
      <div class="card-head"><h3>Format</h3>${e.status === 'live' ? livePill('Running') : e.status === 'done' ? pill('Finished', 'gold') : pill('Setup', 'blue')}</div>
      ${summary}
      <div class="btn-row mt">
        ${setup
          ? `<button class="btn primary big" data-action="event-start" ${teams < 4 ? 'disabled' : ''}>${icon('play')} Start tournament</button>`
          : `<button class="btn ghost danger-text" data-action="event-reset">${icon('rotate')} ${e.status === 'done' ? 'New tournament' : 'Reset tournament'}</button>`}
      </div>
    </div>
  </div>`;
}

/* ---------------------------------------------------------------- Tables (control room) */

function selectedRound(e) {
  return S.adminRound && S.adminRound <= e.rounds ? S.adminRound : currentRound(e);
}

function tablesPanel(e) {
  if (e.status === 'setup') {
    return emptyState('The tournament has not started', 'Add teams, then start it to get the tables going.', 3, `<button class="btn primary" data-action="tab" data-tab="event">${icon('play')} Go to start</button>`);
  }
  const r = selectedRound(e);
  const cur = currentRound(e);
  const cards = [];
  for (let t = 1; t <= e.tables; t++) {
    const m = matchAt(r, t);
    cards.push(m ? tableCard(e, m) : `<div class="tcard open"><span class="tc-num">${t}</span><span class="muted">Open play</span></div>`);
  }
  const resting = restingIn(e, r);
  return `
  ${e.status === 'done' ? championBanner(e) : ''}
  ${roundBar(e, r, cur)}
  <div class="tcards">${cards.join('')}</div>
  ${resting.length ? `<p class="resting-line">${icon('pause')} Resting this round: ${resting.map((x) => x.ids.map((id) => `<span class="rest-chip g${x.g}">${esc(teamName(id))}</span>`).join('')).join('')}</p>` : ''}`;
}

function roundBar(e, r, cur) {
  const chips = [];
  for (let i = 1; i <= e.rounds; i++) {
    const ms = e.matches.filter((m) => m.round === i);
    const st = ms.every((m) => m.winner) ? 'done' : ms.some((m) => m.status === 'live') ? 'live' : '';
    chips.push(`<button class="rchip ${st} ${i === r ? 'on' : ''} ${i > e.groupRounds ? 'ko' : ''}" data-action="pick-round" data-round="${i}" title="${roundStage(e, i)}">${i}</button>`);
  }
  const playable = e.matches.filter((m) => m.round === r && m.a && m.b && !m.winner);
  const live = playable.filter((m) => m.live);
  const idle = playable.filter((m) => !m.live);
  const anyStarted = idle.some((m) => m.startedAt);
  const longest = live.reduce((max, m) => (m.timer.durationMs && timeLeft(m) > (max ? timeLeft(max) : -1) ? m : max), null);
  return `<div class="roundbar anim">
    <div class="rb-top">
      <div class="rb-title"><span class="eyebrow">${roundStage(e, r)}</span><h2>${roundTitle(e, r)} <span class="muted">of ${e.rounds}</span></h2></div>
      <div class="rchips" aria-label="Rounds">${chips.join('')}</div>
    </div>
    <div class="rb-bottom">
      <div class="rb-status">
        ${longest ? `<span class="clock md" data-timer="${longest.id}">${fmt(timeLeft(longest))}</span>` : ''}
        <span class="muted small">${playable.length ? `${live.length} of ${plural(playable.length, 'table')} live` : e.matches.filter((m) => m.round === r).every((m) => m.winner) ? 'Round complete' : 'Waiting for earlier results'}</span>
        ${r !== cur ? `<button class="btn ghost sm" data-action="pick-round" data-round="">${icon('arrowRight')} Back to round ${cur}</button>` : ''}
      </div>
      <div class="btn-row">
        <button class="btn primary" data-action="round" data-type="start" data-round="${r}" ${idle.length ? '' : 'disabled'}>${icon('play')} ${!idle.length ? 'All running' : `${anyStarted ? 'Resume' : 'Start'} ${idle.length > 1 || !live.length ? 'all tables' : 'table'}`}</button>
        <button class="btn ghost" data-action="round" data-type="pause" data-round="${r}" ${live.length ? '' : 'disabled'}>${icon('pause')} Pause all</button>
        <button class="btn ghost" data-action="round" data-type="add" data-round="${r}" ${playable.length ? '' : 'disabled'}>${icon('plus')} 1 min all</button>
      </div>
    </div>
  </div>`;
}

function tableCard(e, m) {
  const head = `<header class="tc-head">
    <span class="tc-num">${m.table}</span>
    <div class="tc-title"><b>Table ${m.table}</b><small>${m.stage === 'group' ? GROUP_NAMES[m.group] : STAGE[m.stage]}</small></div>
    ${m.status === 'live' && m.timer.durationMs ? livePill() : statusTag(m, '')}
    ${m.timer.durationMs ? `<span class="clock sm tc-clock" data-timer="${m.id}">${fmt(timeLeft(m))}</span>` : ''}
  </header>`;
  const fx = `${S.fx.finished.has(m.id) ? 'just-won' : ''} ${S.fx.started.has(m.id) ? 'kick' : ''}`;

  if (m.status === 'waiting') {
    return `<article class="tcard st-waiting" data-mid="${m.id}">${head}
      <div class="tc-wait"><span>${esc(slotName(m, 'a'))}</span><span class="c-vs">vs</span><span>${esc(slotName(m, 'b'))}</span></div>
      <p class="muted small center-text">Unlocks when the earlier results are in.</p></article>`;
  }

  const teamRowHtml = (s) => {
    const left = ballsLeft(m, s);
    const g = groupOf(m, s);
    const cls = m.winner === s ? 'win' : m.winner ? 'lose' : '';
    return `<div class="tc-team ${cls}">
      ${avatar(teamName(m[s]))}
      <div class="min0"><div class="tc-name truncate">${esc(teamName(m[s]))}</div><div class="muted xs truncate">${esc(memberLine(m[s]))}</div></div>
      ${g ? groupChip(g) : ''}
      <div class="tc-left">${m.winner === s ? `<span class="tc-trophy">${icon('trophy')}</span>` : left === null ? '<b>–</b>' : `<b>${left}</b>`}<small>${m.winner === s ? 'winner' : 'left'}</small></div>
    </div>`;
  };

  if (m.status === 'done') {
    return `<article class="tcard st-done ${fx}" data-mid="${m.id}">${head}
      ${teamRowHtml('a')}${teamRowHtml('b')}
      <div class="tc-actions"><span class="muted small">${m.result === 'timeout' ? 'Decided on time' : 'Match over'} · ${m.potted.length} balls down</span>
        <button class="btn ghost sm" data-action="m" data-type="undo" data-id="${m.id}">${icon('undo')} Undo</button></div>
    </article>`;
  }

  const A = teamName(m.a);
  const rackGroup = (balls, g) => `<div class="tc-set">${balls.map((n) => `<button class="ball-btn ${m.potted.includes(n) ? 'in' : ''}" data-action="m" data-type="ball" data-id="${m.id}" data-ball="${n}" aria-pressed="${m.potted.includes(n)}" title="Ball ${n}">${matchBall(m, n, 30)}</button>`).join('')}${g ? `<span class="set-owner">${esc(teamName(m[g]))}</span>` : ''}</div>`;
  const ownerOf = (group) => (m.groupA ? (m.groupA === group ? 'a' : 'b') : null);
  const live = m.status === 'live';
  return `<article class="tcard st-${m.status} ${fx}" data-mid="${m.id}">${head}
    ${teamRowHtml('a')}${teamRowHtml('b')}
    <div class="tc-groups">
      <button class="seg-btn ${m.groupA === 'solids' ? 'on' : ''}" data-action="m" data-type="groups" data-id="${m.id}" data-group="solids">${ball(1, 16)}<span class="truncate">${esc(A)}: Solids</span></button>
      <button class="seg-btn ${m.groupA ? '' : 'on'}" data-action="m" data-type="groups" data-id="${m.id}" data-group="">Open</button>
      <button class="seg-btn ${m.groupA === 'stripes' ? 'on' : ''}" data-action="m" data-type="groups" data-id="${m.id}" data-group="stripes">${ball(9, 16)}<span class="truncate">${esc(A)}: Stripes</span></button>
    </div>
    <div class="tc-rack felt">
      ${rackGroup(SOLIDS, ownerOf('solids'))}
      <button class="ball-btn eight-btn ${m.potted.includes(8) ? 'in' : ''}" data-action="m" data-type="ball" data-id="${m.id}" data-ball="8" aria-pressed="${m.potted.includes(8)}" title="8-ball">${matchBall(m, 8, 40)}</button>
      ${rackGroup(STRIPES, ownerOf('stripes'))}
    </div>
    <div class="tc-actions">
      <div class="btn-row">
        ${live
          ? `<button class="btn ghost sm" data-action="m" data-type="pause" data-id="${m.id}">${icon('pause')} Pause</button>`
          : `<button class="btn primary sm" data-action="m" data-type="start" data-id="${m.id}">${icon('play')} ${m.startedAt ? 'Resume' : 'Start'}</button>`}
        <button class="btn ghost sm" data-action="m" data-type="add" data-id="${m.id}" title="Add a minute">${icon('plus')} 1</button>
        <button class="icon-btn" data-action="m-more" data-id="${m.id}" title="More" aria-label="More options">${icon('gear')}</button>
      </div>
      <div class="btn-row winners">
        <button class="btn win sm" data-action="m-winner" data-id="${m.id}" data-slot="a">${icon('trophy')}<span class="truncate">${esc(A)}</span></button>
        <button class="btn win sm" data-action="m-winner" data-id="${m.id}" data-slot="b">${icon('trophy')}<span class="truncate">${esc(teamName(m.b))}</span></button>
      </div>
    </div>
    <p class="tc-warn">${icon('clock')} Time's up. Fewest balls left wins.</p>
  </article>`;
}

/* =====================================================================
   Modals
   ===================================================================== */

function openModal(html, { onChoice, onDismiss, kind = 'dialog', ...rest }) {
  S.modal = { onChoice, onDismiss, kind, ...rest };
  $modal.innerHTML = `<div class="modal-backdrop" data-backdrop><div class="modal ${kind}" role="dialog" aria-modal="true">${html}</div></div>`;
  $modal.querySelector('[data-choice]')?.focus();
}

function closeModal() {
  S.modal = null;
  $modal.innerHTML = '';
}

$modal.addEventListener('click', (e) => {
  if (!S.modal) return;
  if (e.target.matches('[data-backdrop]')) return S.modal.onDismiss?.();
  const choice = e.target.closest('[data-choice]');
  if (choice) S.modal.onChoice(choice.dataset.choice);
});

$modal.addEventListener('submit', (e) => {
  e.preventDefault();
  S.modal?.onSubmit?.(new FormData(e.target));
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && S.modal) S.modal.onDismiss?.();
});

function confirmDialog({ title, body, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    const done = (ok) => {
      closeModal();
      resolve(ok);
    };
    openModal(
      `<h2>${esc(title)}</h2><p class="muted">${esc(body)}</p>
       <div class="modal-actions">
         <button class="btn ghost" data-choice="no">Cancel</button>
         <button class="btn ${danger ? 'danger' : 'primary'}" data-choice="yes">${esc(confirmLabel)}</button>
       </div>`,
      { onChoice: (c) => done(c === 'yes'), onDismiss: () => done(false) },
    );
  });
}

/** Two big team buttons plus extra options. Resolves with 'a', 'b', an extra's key, or null. */
function pickTeamDialog(m, { title, body, extras = [], kind = 'dialog', iconName = 'trophy' }) {
  return new Promise((resolve) => {
    const done = (c) => {
      closeModal();
      resolve(c);
    };
    const choice = (s) => {
      const left = ballsLeft(m, s);
      return `<button class="choice" data-choice="${s}">${avatar(teamName(m[s]), 'lg')}<span>${esc(teamName(m[s]))}</span>${left !== null ? `<small class="muted">${plural(left, 'ball')} left</small>` : ''}</button>`;
    };
    openModal(
      `<div class="modal-icon ${kind}">${icon(iconName)}</div>
       <h2>${esc(title)}</h2><p class="muted">${body}</p>
       <div class="timeup-choices">${choice('a')}${choice('b')}</div>
       <div class="modal-actions">${extras.map(([key, label]) => `<button class="btn ghost" data-choice="${key}">${label}</button>`).join('')}</div>`,
      { kind: `pick ${kind}`, mid: m.id, onChoice: done, onDismiss: () => done(null) },
    );
  });
}

/** Who is ahead on balls, for the time-up call. */
function ballVerdict(m) {
  const a = ballsLeft(m, 'a');
  const b = ballsLeft(m, 'b');
  if (a === null) return 'The table is still open, so balls are level: the current shooter gets one sudden-death shot at the 8.';
  if (a === b) return `Balls are tied at ${a} each: the current shooter gets one sudden-death shot at the 8.`;
  const lead = a < b ? 'a' : 'b';
  return `<b>${esc(teamName(m[lead]))}</b> has fewer balls left (${Math.min(a, b)} vs ${Math.max(a, b)}).`;
}

/** Admin only: pops up wherever they are when a running match clock hits zero. */
function checkTimeouts() {
  if (!isAdmin() || S.modal || !S.state || S.state.event.status !== 'live') return;
  for (const m of E().matches) {
    if (!isExpired(m)) continue;
    const key = `${m.id}/${m.timer.endsAt}`;
    if (S.acked.has(key)) continue;
    S.acked.add(key);
    return showTimeUp(m);
  }
}

async function showTimeUp(m) {
  beep();
  const c = await pickTeamDialog(m, {
    title: `Time's up on table ${m.table}`,
    body: ballVerdict(m),
    kind: 'timeup',
    iconName: 'clock',
    extras: [['later', 'Decide later'], ['extend', `${icon('plus')} 2 more minutes`]],
  });
  if (c === 'a' || c === 'b') await run(() => act(m.id, { type: 'winner', slot: c, reason: 'timeout' }));
  if (c === 'extend') await run(() => act(m.id, { type: 'timer', op: 'add', minutes: 2 }));
}

/** Closes a pick-a-team popup that was resolved somewhere else (other tab, other admin). */
function syncModal() {
  if (!S.modal?.mid) return;
  const m = findMatch(S.modal.mid);
  if (!m || m.winner) closeModal();
}

function moreDialog(m) {
  openModal(
    `<h2>Table ${m.table}</h2><p class="muted">${esc(teamName(m.a))} vs ${esc(teamName(m.b))}</p>
     <form class="inline-form" data-modal-form>
       <label class="field grow"><span>Match clock (minutes)</span><input name="minutes" type="number" min="0" max="180" step="0.5" value="${m.timer.durationMs / 60000}"></label>
       <button class="btn ghost" type="submit">Set clock</button>
     </form>
     <div class="modal-list">
       <button class="btn ghost block" data-choice="reset">${icon('rotate')} Reset clock to full time</button>
       <button class="btn ghost block danger-text" data-choice="restart">${icon('undo')} Restart match (clears balls and groups)</button>
     </div>
     <div class="modal-actions"><button class="btn ghost" data-choice="close">Close</button></div>`,
    {
      mid: m.id,
      onDismiss: closeModal,
      onSubmit: (data) => {
        closeModal();
        run(() => act(m.id, { type: 'timer', op: 'set', minutes: Number(data.get('minutes')) }));
      },
      onChoice: async (c) => {
        closeModal();
        if (c === 'reset') return run(() => act(m.id, { type: 'timer', op: 'reset' }));
        if (c === 'restart') {
          const ok = await confirmDialog({ title: 'Restart this match?', body: 'Pocketed balls and groups are cleared and the clock goes back to full time.', confirmLabel: 'Restart', danger: true });
          if (ok) run(() => act(m.id, { type: 'restart' }));
        }
      },
    },
  );
}

/* =====================================================================
   Animation helpers
   ===================================================================== */

/** Works out what changed between two snapshots, so only that animates. */
function diffState(prev, next) {
  const fx = emptyFx();
  if (!prev) return fx;
  const before = new Map(prev.event.matches.map((m) => [m.id, m]));
  for (const m of next.event.matches) {
    const p = before.get(m.id);
    if (!p) continue;
    m.potted.filter((n) => !p.potted.includes(n)).forEach((n) => fx.potted.add(`${m.id}:${n}`));
    p.potted.filter((n) => !m.potted.includes(n)).forEach((n) => fx.unpotted.add(`${m.id}:${n}`));
    if (m.winner && !p.winner) fx.finished.add(m.id);
    if (m.status === 'live' && p.status !== 'live') fx.started.add(m.id);
  }
  fx.champion = Boolean(next.event.championId && !prev.event.championId);
  return fx;
}

function captureFlip() {
  if (REDUCED_MOTION) return null;
  return new Map([...$app.querySelectorAll('[data-flip]')].map((el) => [el.dataset.flip, el.getBoundingClientRect().top]));
}

/** FLIP: rows that moved slide from where they were to where they are now. */
function playFlip(before) {
  if (!before) return;
  for (const el of $app.querySelectorAll('[data-flip]')) {
    const top = before.get(el.dataset.flip);
    if (top === undefined) continue;
    const dy = top - el.getBoundingClientRect().top;
    if (Math.abs(dy) < 2) continue;
    el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 500, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
}

/** Counters roll from their last value to the new one. */
function playCounters(entering) {
  for (const el of $app.querySelectorAll('[data-count]')) {
    const key = el.dataset.count;
    const to = Number(el.textContent);
    const from = entering ? 0 : (S.counts.get(key) ?? to);
    S.counts.set(key, to);
    if (from === to || REDUCED_MOTION) continue;
    const start = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - start) / 700);
      el.textContent = Math.round(from + (to - from) * (1 - (1 - k) ** 3));
      if (k < 1 && el.isConnected) requestAnimationFrame(step);
    };
    el.textContent = from;
    requestAnimationFrame(step);
  }
}

function confetti(x, y, { count = 36, spread = 1, colors = ['#2fd59a', '#f7c548', '#6aa8ff', '#f26b6b', '#ffffff'] } = {}) {
  if (REDUCED_MOTION) return;
  const layer = document.createElement('div');
  layer.className = 'confetti';
  for (let i = 0; i < count; i++) {
    const p = document.createElement('i');
    const angle = Math.random() * Math.PI * 2;
    const dist = (60 + Math.random() * 140) * spread;
    p.style.cssText = `left:${x}px;top:${y}px;--dx:${Math.cos(angle) * dist}px;--dy:${Math.sin(angle) * dist - 60 * spread}px;--rot:${Math.random() * 720 - 360}deg;background:${colors[i % colors.length]};animation-delay:${Math.random() * 80}ms`;
    layer.append(p);
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), 1800);
}

function playCelebrations(fx) {
  for (const id of fx.finished) {
    const el = $app.querySelector(`[data-mid="${id}"]`);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) continue;
    confetti(r.left + r.width / 2, r.top + r.height / 2, { count: 28 });
  }
  if (fx.champion) {
    for (let i = 0; i < 5; i++) setTimeout(() => confetti(innerWidth * (0.15 + i * 0.175), innerHeight * 0.3, { count: 50, spread: 1.6 }), i * 180);
  }
}

/* =====================================================================
   Rendering
   ===================================================================== */

function route() {
  const name = location.hash.replace(/^#\/?/, '').split(/[/?]/)[0];
  return { name: ['schedule', 'rules', 'admin'].includes(name) ? name : 'home' };
}

function view(r) {
  if (!S.state) return '<div class="loading">' + ball(8, 48) + '<span>Racking up…</span></div>';
  if (r.name === 'admin') return adminView();
  if (r.name === 'schedule') return scheduleView();
  if (r.name === 'rules') return rulesView();
  return homeView();
}

/** Live updates re-render the page; keep what the admin is typing, focus, open panels and scroll. */
function captureUi() {
  const fields = [...$app.querySelectorAll('form[data-form] [id]')].map((el) => ({ id: el.id, value: el.value, checked: el.checked }));
  const active = document.activeElement;
  let focus = null;
  if (active?.id && $app.contains(active)) {
    focus = { id: active.id, value: active.value };
    try {
      focus.start = active.selectionStart;
      focus.end = active.selectionEnd;
    } catch {
      /* input type without selection */
    }
  }
  const open = [...$app.querySelectorAll('details[id][open]')].map((d) => d.id);
  const scroll = [...$app.querySelectorAll('[data-scroll-id]')].map((el) => [el.dataset.scrollId, el.scrollLeft]);
  return { fields, focus, open, scroll };
}

function restoreUi({ fields, focus, open, scroll }) {
  for (const f of fields) {
    const el = document.getElementById(f.id);
    if (!el) continue;
    if (el.type === 'checkbox') el.checked = f.checked;
    else el.value = f.value;
  }
  open.forEach((id) => document.getElementById(id)?.setAttribute('open', ''));
  for (const [id, left] of scroll) {
    const el = $app.querySelector(`[data-scroll-id="${id}"]`);
    if (el) el.scrollLeft = left;
  }
  const el = focus && document.getElementById(focus.id);
  if (el) {
    if (el.matches('input:not([type=checkbox])') && focus.value !== undefined) el.value = focus.value;
    el.focus({ preventScroll: true });
    try {
      if (focus.start != null) el.setSelectionRange(focus.start, focus.end);
    } catch {
      /* input type without selection */
    }
  }
}

function render() {
  const r = route();
  const entering = S.renderedKey !== location.hash;
  const snapshot = entering ? null : captureUi();
  const flip = entering ? null : captureFlip();
  $nav.innerHTML = navView(r);
  $app.innerHTML = view(r);
  if (snapshot) restoreUi(snapshot);
  S.renderedKey = S.state ? location.hash : null; // the loading screen doesn't count as having entered

  if (entering && !REDUCED_MOTION) {
    $app.querySelectorAll('.anim').forEach((el, i) => {
      el.style.setProperty('--i', Math.min(i, 10));
      el.classList.add('in');
    });
  }
  playFlip(flip);
  playCounters(entering);
  const fx = S.fx;
  S.fx = emptyFx(); // play each change once
  playCelebrations(fx);

  if (S.focusAfter) {
    const el = document.getElementById(S.focusAfter);
    if (el) {
      S.focusAfter = null;
      el.focus();
      el.select?.();
      el.scrollIntoView({ block: 'center', behavior: REDUCED_MOTION ? 'auto' : 'smooth' });
    }
  }
  syncModal();
  tick();
}

function tick() {
  if (!S.state) return;
  for (const el of document.querySelectorAll('[data-timer]')) {
    const m = findMatch(el.dataset.timer);
    if (!m) continue;
    const left = timeLeft(m);
    el.textContent = fmt(left);
    el.classList.toggle('low', m.status === 'live' && m.timer.running && left > 0 && left <= 60000);
    el.classList.toggle('expired', isExpired(m));
    el.closest('.tcard')?.classList.toggle('expired', isExpired(m));
  }
  checkTimeouts();
}

/* =====================================================================
   Events
   ===================================================================== */

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled || !document.body.contains(el) || $modal.contains(el)) return;
  e.preventDefault();
  run(() => onAction(el.dataset.action, el.dataset));
});

async function onAction(action, d) {
  const e = S.state?.event;
  switch (action) {
    case 'logout':
      await api('POST', '/api/logout').catch(() => {});
      setSession(null, { role: null });
      return toast('Signed out');
    case 'tab':
      S.adminTab = d.tab;
      writeStored('pm_tab', d.tab);
      S.renderedKey = null; // animate the new panel in
      return render();
    case 'pick-round':
      S.adminRound = d.round ? Number(d.round) : null;
      return render();
    case 'goto-round':
      S.adminRound = Number(d.round);
      S.adminTab = 'tables';
      location.hash = '#/admin';
      return;

    // Teams
    case 'team-add': {
      const res = await api('POST', '/api/teams', {});
      S.focusAfter = `tn-${res.id}`;
      return;
    }
    case 'team-del': {
      const ok = await confirmDialog({ title: `Remove ${teamName(d.id)}?`, body: 'The team and both player names are deleted.', confirmLabel: 'Remove', danger: true });
      if (ok) await api('DELETE', `/api/teams/${d.id}`);
      return;
    }
    case 'team-move':
      return api('POST', `/api/teams/${d.id}/move`, { by: Number(d.by) });
    case 'team-shuffle': {
      const ok = await confirmDialog({ title: 'Shuffle the teams?', body: 'The order is randomised, which also redraws the groups.', confirmLabel: 'Shuffle' });
      if (ok) await api('POST', '/api/teams/shuffle');
      return;
    }

    // Tournament
    case 'event-start': {
      const ok = await confirmDialog({
        title: 'Start the tournament?',
        body: `${plural(S.state.teams.length, 'team')} are locked into their groups and the schedule is fixed. You can still rename teams and players.`,
        confirmLabel: 'Start tournament',
      });
      if (!ok) return;
      await api('POST', '/api/event/start');
      S.adminTab = 'tables';
      S.adminRound = null;
      writeStored('pm_tab', 'tables');
      return toast('Game on! Round 1 is ready.', 'success');
    }
    case 'event-reset': {
      const done = e.status === 'done';
      const ok = await confirmDialog({
        title: done ? 'Start a new tournament?' : 'Reset the tournament?',
        body: done ? 'The results go into the hall of fame and the teams stay, ready for another night.' : 'Every result is wiped and you go back to setup. Teams are kept.',
        confirmLabel: done ? 'New tournament' : 'Wipe results',
        danger: !done,
      });
      if (!ok) return;
      await api('POST', '/api/event/reset');
      S.adminTab = 'teams';
      writeStored('pm_tab', 'teams');
      return;
    }

    // Tables
    case 'round':
      return api('POST', `/api/rounds/${d.round}/action`, { type: d.type, minutes: 1 });
    case 'm': {
      const body = { type: d.type };
      if (d.type === 'ball') body.ball = Number(d.ball);
      if (d.type === 'groups') body.groupA = d.group || null;
      if (d.type === 'add') Object.assign(body, { type: 'timer', op: 'add', minutes: 1 });
      if (d.type === 'undo') {
        const ok = await confirmDialog({ title: 'Undo this result?', body: 'The match goes back to live with its balls kept.', confirmLabel: 'Undo result' });
        if (!ok) return;
      }
      const m = findMatch(d.id);
      const sinkingEight = d.type === 'ball' && body.ball === 8 && !m.potted.includes(8);
      await act(d.id, body);
      if (sinkingEight) return eightDown(d.id);
      return;
    }
    case 'm-more':
      return moreDialog(findMatch(d.id));
    case 'm-winner': {
      const m = findMatch(d.id);
      const ok = await confirmDialog({
        title: `${teamName(m[d.slot])} wins?`,
        body: m.stage === 'group' ? 'The result goes into the group standings. You can undo it until the knockout starts.' : 'They go through. You can undo this until their next match starts.',
        confirmLabel: 'Confirm winner',
      });
      if (!ok) return;
      return act(d.id, { type: 'winner', slot: d.slot, reason: isExpired(m) ? 'timeout' : 'win' });
    }
  }
}

/** The 8 just dropped: usually that decides it, so ask straight away. */
async function eightDown(mid) {
  const m = findMatch(mid);
  if (!m || m.winner) return;
  const c = await pickTeamDialog(m, {
    title: `8-ball down on table ${m.table}`,
    body: 'Legal 8 on a cleared suit wins. An early 8, a scratch on the 8 or a wrong pocket loses. Who takes it?',
    kind: 'eight',
    iconName: 'zap',
    extras: [['undo', `${icon('undo')} Oops, put it back`], ['later', 'Not yet']],
  });
  if (c === 'a' || c === 'b') await run(() => act(mid, { type: 'winner', slot: c, reason: isExpired(m) ? 'timeout' : 'win' }));
  if (c === 'undo') await run(() => act(mid, { type: 'ball', ball: 8 }));
}

document.addEventListener('submit', (e) => {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  run(() => onForm(form.dataset.form, new FormData(form)));
});

async function onForm(name, data) {
  switch (name) {
    case 'admin-login': {
      const res = await api('POST', '/api/admin/login', { password: data.get('password') });
      setSession(res.token, res.me);
      return toast('Admin mode on', 'success');
    }
    case 'event':
      await api('PATCH', '/api/event', {
        name: data.get('name'),
        clockMinutes: data.get('clockMinutes'),
        thirdPlace: data.get('thirdPlace') === 'on',
      });
      return toast('Saved', 'success');
  }
}

/** Inline edits save when the field loses focus (or on Enter). */
function saveInline(el) {
  if (!el.isConnected || el.value === el.defaultValue) return;
  const { id, index } = el.dataset;
  const value = el.value.trim();
  if (!value) {
    el.value = el.defaultValue;
    return toast('Names cannot be empty', 'error');
  }
  const url = el.dataset.edit === 'team-name' ? `/api/teams/${id}` : `/api/teams/${id}/members/${index}`;
  el.defaultValue = value; // don't save twice if focus moves around
  run(() => api('PATCH', url, { name: value }));
}

document.addEventListener('focusout', (e) => {
  if (e.target.matches?.('input[data-edit$="-name"]')) saveInline(e.target);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.matches?.('input[data-edit$="-name"]')) {
    e.preventDefault();
    e.target.blur();
  }
  if (e.key === 'Escape' && e.target.matches?.('input[data-edit$="-name"]')) {
    e.target.value = e.target.defaultValue;
    e.target.blur();
  }
});

document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.edit === 'member-active') {
    run(() => api('PATCH', `/api/teams/${el.dataset.id}/members/${el.dataset.index}`, { active: el.checked }));
  }
});

window.addEventListener('hashchange', () => {
  render();
  window.scrollTo(0, 0);
});

/* =====================================================================
   Session & live connection
   ===================================================================== */

function setSession(token, me) {
  S.token = token;
  S.me = me;
  writeStored('pm_token', token);
  render();
}

function applyState(state) {
  S.fx = diffState(S.state, state);
  S.state = state;
  S.offset = state.serverTime - Date.now();
  S.teams = new Map(state.teams.map((t) => [t.id, t]));
  S.online = true;
  render();
}

function markOffline() {
  S.online = false;
  $nav.querySelector('.conn')?.classList.remove('on');
}

/** Live updates over SSE; falls back to polling when nothing arrives (some tunnels/proxies block streams). */
function connect() {
  if (S.polling) return refresh(true);
  S.events?.close();
  const es = new EventSource('/api/events');
  const fallback = setTimeout(startPolling, SSE_TIMEOUT_MS);
  es.addEventListener('state', (e) => {
    clearTimeout(fallback);
    applyState(JSON.parse(e.data));
  });
  es.onerror = markOffline;
  S.events = es;
}

function startPolling() {
  if (S.polling) return;
  S.polling = true;
  S.events?.close();
  S.events = null;
  refresh(true);
  setInterval(() => {
    if (document.visibilityState === 'visible') refresh(); // no data use while the phone is locked / tab hidden
  }, POLL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh();
  });
}

/** Polls for state; the server answers `{unchanged: true}` (a few bytes) when nothing changed. */
async function refresh(force = false) {
  try {
    const v = !force && S.state?.version;
    const res = await api('GET', `/api/state${v ? `?v=${v}` : ''}`);
    if (res.unchanged) {
      if (!S.online) applyState(S.state);
      return;
    }
    applyState(res);
  } catch {
    markOffline();
  }
}

(async function init() {
  if (S.token) {
    try {
      S.me = await api('GET', '/api/me');
    } catch {
      S.me = { role: null };
    }
    if (!S.me.role) {
      S.token = null;
      writeStored('pm_token', null);
    }
  }
  connect();
  render();
  setInterval(tick, 250);
})();
