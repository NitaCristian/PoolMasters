'use strict';

/* =====================================================================
   Constants
   ===================================================================== */

const BALL_COLORS = ['', '#f5c518', '#1e4fd8', '#d92b2b', '#6b2fb8', '#f47a14', '#16834a', '#8a1c22', '#15171a'];
const SOLIDS = [1, 2, 3, 4, 5, 6, 7];
const STRIPES = [9, 10, 11, 12, 13, 14, 15];
const RACK_ROWS = [[1], [9, 2], [10, 8, 3], [11, 4, 12, 5], [6, 13, 7, 14, 15]];
const GROUPS = {
  solids: { label: 'Solids', icon: 1, balls: SOLIDS },
  stripes: { label: 'Stripes', icon: 9, balls: STRIPES },
};
const SSE_TIMEOUT_MS = 5000; // no live update by then -> switch to polling
const POLL_MS = 2000;
const ENTRY_RANK ={ verified: 0, pending: 1, disabled: 2, left: 2 };
const T_STATUS = {
  registration: ['Registration open', 'blue'],
  in_progress: ['Live', 'green'],
  completed: ['Finished', 'gold'],
};

const ICON_PATHS = {
  arrowLeft: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  arrowRight: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
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
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/>',
  board: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
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
  token: readToken(),
  offset: 0, // serverTime - local time, so every device shows the same clock
  online: false,
  events: null,
  polling: false, // true when live updates are blocked and we refresh every POLL_MS instead
  names: new Map(),
  auth: { ctx: null, step: 'name' }, // two-step sign-in progress; ctx = tournament id or null
  modal: null,
  acked: new Set(), // time-up alerts the admin already handled
  renderedKey: null,
};

function readToken() {
  try {
    return localStorage.getItem('pm_token');
  } catch {
    return null;
  }
}

function writeToken(token) {
  try {
    if (token) localStorage.setItem('pm_token', token);
    else localStorage.removeItem('pm_token');
  } catch {
    /* storage unavailable — session lasts for this tab only */
  }
}

/* =====================================================================
   Helpers
   ===================================================================== */

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const now = () => Date.now() + S.offset;
const isAdmin = () => S.me.role === 'admin';
const nameOf = (id) => S.names.get(id) ?? 'Unknown player';
const findT = (id) => S.state?.tournaments.find((t) => t.id === id);
const findMatch = (tid, mid) => findT(tid)?.matches.find((m) => m.id === mid);
const myEntry = (t) => (S.me.role === 'player' ? t.entries.find((e) => e.playerId === S.me.player.id) : null);
const entryOf = (t, pid) => t.entries.find((e) => e.playerId === pid);
const groupOf = (m, slot) => {
  if (!m.groupA) return null;
  if (slot === 'a') return m.groupA;
  return m.groupA === 'solids' ? 'stripes' : 'solids';
};

const timeLeft = (m) => (m.timer.running ? Math.max(0, m.timer.endsAt - now()) : m.timer.remainingMs);
const isExpired = (m) => m.status === 'live' && m.timer.durationMs > 0 && m.timer.running && timeLeft(m) === 0;

function fmt(ms) {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function roundName(round, total) {
  const left = total - round;
  if (left === 0) return 'Final';
  if (left === 1) return 'Semifinals';
  if (left === 2) return 'Quarterfinals';
  return `Round of ${2 ** (left + 1)}`;
}

const matchNumber = (t, m) => t.matches.indexOf(m) + 1;

async function api(method, url, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (S.token) headers.Authorization = `Bearer ${S.token}`;
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  if (method !== 'GET' && S.polling) refresh(); // show your own change right away, not on the next poll
  return data;
}

const act = (tid, mid, body) => api('POST', `/api/tournaments/${tid}/matches/${mid}/action`, body);

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

function ball(n, size = 32, potted = false) {
  const kind = n === 8 ? 'eight' : n > 8 ? 'stripe' : 'solid';
  const color = BALL_COLORS[n > 8 ? n - 8 : n];
  const cls = `ball ${kind}${potted ? ' potted' : ''}${size < 20 ? ' tiny' : ''}`;
  return `<span class="${cls}" style="--c:${color};--size:${size}px" role="img" aria-label="Ball ${n}${potted ? ', pocketed' : ''}"><span class="ball-num">${n}</span></span>`;
}

function avatar(name, size = '') {
  const initials = name
    .split(/\s+/)
    .map((w) => [...w][0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const hue = [...name].reduce((h, c) => (h * 31 + c.codePointAt(0)) % 360, 7);
  return `<span class="avatar ${size}" style="--h:${hue}" aria-hidden="true">${esc(initials)}</span>`;
}

const pill = (label, tone, lead = '') => `<span class="pill ${tone}">${lead}${esc(label)}</span>`;

function tStatusPill(t) {
  const [label, tone] = T_STATUS[t.status];
  return pill(label, tone, t.status === 'in_progress' ? '<span class="live-dot"></span>' : '');
}

function entryBadge(e) {
  return {
    pending: pill('Awaiting verification', 'amber'),
    verified: pill("You're in", 'green', icon('check')),
    disabled: pill('Disabled by admin', 'red'),
    left: pill('You left', 'muted'),
  }[e.status];
}

const groupChip = (g) => `<span class="chip group">${ball(GROUPS[g].icon, 16)}${GROUPS[g].label}</span>`;

function emptyState(title, body, art = 8) {
  return `<div class="empty">${ball(art, 56)}<h3>${esc(title)}</h3><p class="muted">${esc(body)}</p></div>`;
}

function notFound() {
  return `<a class="back" href="#/">${icon('arrowLeft')} All tournaments</a>${emptyState('Nothing on this table', 'That tournament or match does not exist anymore.')}`;
}

/** Where a player stands in a drawn bracket. */
function playerFate(t, pid) {
  if (t.status === 'registration' || !t.matches.some((m) => m.a === pid || m.b === pid)) return null;
  if (t.championId === pid) return 'champion';
  const lost = t.matches.some((m) => m.winner && m[m.winner === 'a' ? 'b' : 'a'] === pid);
  return lost ? 'out' : 'alive';
}

/* =====================================================================
   Top bar
   ===================================================================== */

function navView(r) {
  let who;
  if (S.me.role === 'player') {
    who = `<div class="who">${avatar(S.me.player.name, 'sm')}<span class="who-name">${esc(S.me.player.name)}</span>
      <button class="icon-btn" data-action="logout" title="Sign out" aria-label="Sign out">${icon('logout')}</button></div>`;
  } else if (S.me.role === 'admin') {
    who = `<div class="who">${pill('Admin', 'gold', icon('shield'))}
      <button class="icon-btn" data-action="logout" title="Sign out" aria-label="Sign out">${icon('logout')}</button></div>`;
  } else {
    who = `<a class="btn ghost sm" href="#/">Sign in</a>`;
  }
  return `<div class="topbar-inner">
    <a class="brand" href="#/">${ball(8, 30)}<span class="brand-text">Pool<b>Masters</b></span></a>
    <nav class="nav">
      <a href="#/" class="${r.name !== 'admin' ? 'active' : ''}">Tournaments</a>
      <a href="#/admin" class="${r.name === 'admin' ? 'active' : ''}">Admin</a>
    </nav>
    <div class="topbar-right">
      <span class="conn ${S.online ? 'on' : ''} ${S.polling ? 'poll' : ''}" title="${!S.online ? 'Reconnecting…' : S.polling ? `Updating every ${POLL_MS / 1000} s` : 'Live'}"></span>
      ${who}
    </div>
  </div>`;
}

/* =====================================================================
   Home
   ===================================================================== */

function homeView() {
  const ts = S.state.tournaments;
  const liveCount = ts.filter((t) => t.status === 'in_progress').length;
  return `
  <section class="hero">
    <div class="hero-copy">
      <span class="eyebrow">Tournament night, sorted</span>
      <h1>Rack 'em up.<br><span class="grad">Run the bracket.</span></h1>
      <p class="lead">Join with your name, follow the bracket live and watch every ball drop — from any phone at the table.</p>
      <div class="hero-stats">
        <div><b>${liveCount}</b><span>live now</span></div>
        <div><b>${ts.length}</b><span>tournaments</span></div>
        <div><b>${S.state.players.length}</b><span>players</span></div>
      </div>
      <div class="hero-balls" aria-hidden="true">${[1, 9, 3, 8, 12, 6, 14].map((n) => ball(n, 40)).join('')}</div>
    </div>
    ${heroAside()}
  </section>
  <section class="section">
    <div class="section-head"><h2>Tournaments</h2>${isAdmin() ? `<a class="btn primary sm" href="#/admin">${icon('plus')} New tournament</a>` : ''}</div>
    ${ts.length ? `<div class="t-grid">${ts.map(tournamentCard).join('')}</div>` : emptyState('No tournaments yet', 'The admin will open one soon.')}
  </section>`;
}

function heroAside() {
  if (!S.me.role) {
    // Players sign in inside a tournament; the stand-alone form is only for when nothing is open.
    const open = S.state.tournaments.filter((t) => t.status === 'registration');
    if (open.length) return openTournamentsCard(open);
    return `<div class="card auth-card">
      <span class="eyebrow">Players</span>
      <h3 class="auth-title">Sign in or create your player</h3>
      ${authFlow(null)}
    </div>`;
  }
  if (isAdmin()) {
    const pending = S.state.tournaments.reduce((n, t) => n + (t.status === 'registration' ? t.entries.filter((e) => e.status === 'pending').length : 0), 0);
    const live = S.state.tournaments.reduce((n, t) => n + t.matches.filter((m) => m.status === 'live').length, 0);
    return `<div class="card aside-card">
      <span class="eyebrow">Signed in as admin</span>
      <div class="kpis"><div><b>${pending}</b><span>to verify</span></div><div><b>${live}</b><span>tables live</span></div></div>
      <a class="btn primary block" href="#/admin">${icon('gear')} Open control room</a>
    </div>`;
  }
  const mine = S.state.tournaments.map((t) => [t, myEntry(t)]).filter(([, e]) => e);
  return `<div class="card aside-card">
    <div class="welcome">${avatar(S.me.player.name, 'lg')}<div><span class="eyebrow">Welcome back</span><h3>${esc(S.me.player.name)}</h3></div></div>
    ${mine.length
      ? `<div class="mini-list">${mine.map(([t, e]) => `<a class="mini-item" href="#/t/${t.id}"><div class="r-body"><div class="r-name">${esc(t.name)}</div></div>${entryBadge(e)}</a>`).join('')}</div>`
      : '<p class="muted">Pick a tournament below and hit <b>Join</b>.</p>'}
  </div>`;
}

function openTournamentsCard(open) {
  return `<div class="card aside-card">
    <div><span class="eyebrow">Open for registration</span><h3 class="auth-title">Join a tournament</h3>
      <p class="muted small">Pick one and enter your name. New players can sign up right there.</p></div>
    <div class="mini-list">${open
      .map((t) => {
        const players = t.entries.filter((e) => e.status === 'pending' || e.status === 'verified').length;
        return `<a class="mini-item" href="#/t/${t.id}">
          <div class="r-body"><div class="r-name">${esc(t.name)}</div>
            <div class="r-sub">${players} joined · ${t.timerMinutes ? `${t.timerMinutes} min clock` : 'no clock'}</div></div>
          <span class="btn sm primary">Join ${icon('arrowRight')}</span>
        </a>`;
      })
      .join('')}</div>
  </div>`;
}

/**
 * Two-step player sign-in. Step 1: name (checked against the server). Step 2: PIN — set a new one
 * when the name is free, or enter yours when it is taken. With a tournament `t`, finishing also joins it.
 */
function authFlow(t) {
  const ctx = t?.id ?? null;
  const a = S.auth.ctx === ctx ? S.auth : { step: 'name' };
  const needPin = S.state.settings.requirePin;
  const steps = `<ol class="steps" aria-label="Sign-in steps">
    <li class="${a.step === 'name' ? 'on' : 'done'}"><span>${a.step === 'name' ? '1' : icon('check')}</span>Name</li>
    <li class="${a.step === 'pin' ? 'on' : ''}"><span>2</span>${needPin ? 'PIN' : 'Confirm'}</li>
  </ol>`;
  const error = a.error ? `<p class="form-error" role="alert">${esc(a.error)}</p>` : '';

  if (a.step !== 'pin') {
    return `${steps}<form data-form="auth-name" data-ctx="${ctx ?? ''}" class="stack" autocomplete="off">
      <label class="field"><span>Your player name</span>
        <input id="auth-name" name="name" required minlength="2" maxlength="24" placeholder="e.g. Fast Eddie" autocomplete="username" value="${esc(a.name ?? '')}"></label>
      ${error}
      <button class="btn primary block" type="submit">Continue ${icon('arrowRight')}</button>
      <p class="hint">New here? Pick a name nobody has. Back again? Use the same name as before.</p>
    </form>`;
  }

  const joining = t?.status === 'registration';
  let prompt;
  if (!a.exists) prompt = needPin ? 'Choose a 4–6 digit PIN to claim it.' : 'Create a player with this name?';
  else if (!needPin) prompt = 'Is this you?';
  else prompt = a.hasPin ? 'Enter your PIN to continue.' : 'Set a 4–6 digit PIN — you will use it from now on.';
  const submit = (a.exists ? 'Sign in' : 'Create player') + (joining ? ' & join' : '');
  return `${steps}<form data-form="auth-pin" class="stack" autocomplete="off">
    <div class="auth-who">${avatar(a.name, 'lg')}
      <div><h3>${a.exists ? `Welcome back, ${esc(a.name)}` : `“${esc(a.name)}” is free`}</h3><p class="muted small">${prompt}</p></div>
    </div>
    <input type="text" name="username" value="${esc(a.name)}" autocomplete="username" hidden>
    ${needPin ? `<input id="auth-pin" class="pin-input" name="pin" type="password" inputmode="numeric" pattern="\\d{4,6}" minlength="4" maxlength="6" required placeholder="••••" aria-label="PIN" autocomplete="${a.exists && a.hasPin ? 'current-password' : 'new-password'}">` : ''}
    ${error}
    <button class="btn primary block" type="submit">${submit}</button>
    <button class="btn ghost block" type="button" data-action="auth-back">${icon('arrowLeft')} ${a.exists ? 'Not you? Change name' : 'Use a different name'}</button>
  </form>`;
}

/** Shown on a tournament page to signed-out visitors: the sign-in flow that also joins. */
function joinPanel(t) {
  if (S.me.role || t.status === 'completed') return '';
  const open = t.status === 'registration';
  return `<div class="card join-panel">
    <div class="join-copy">
      <span class="eyebrow">${open ? 'Registration open' : 'Players'}</span>
      <h2>${open ? 'Join this tournament' : 'Playing in this one?'}</h2>
      <p class="muted">${open
        ? 'Enter your name. New players choose a PIN, returning players enter theirs. The admin verifies you before the bracket is drawn.'
        : 'Registration is closed, but players can sign in to follow their matches.'}</p>
    </div>
    <div class="join-form">${authFlow(t)}</div>
  </div>`;
}

function tournamentCard(t) {
  const verified = t.entries.filter((e) => e.status === 'verified').length;
  const pending = t.entries.filter((e) => e.status === 'pending').length;
  const live = t.matches.filter((m) => m.status === 'live').length;
  const mine = myEntry(t);
  let foot;
  if (t.status === 'completed') {
    foot = `<div class="t-foot champ">${CROWN}<span>${esc(nameOf(t.championId))}</span></div>`;
  } else if (t.status === 'in_progress') {
    const done = t.matches.filter((m) => m.status === 'done').length;
    foot = `<div class="t-foot">${live ? `<span class="live-dot"></span>${live} table${live === 1 ? '' : 's'} live` : 'Between matches'}</div>
      <div class="progress"><span style="width:${Math.round((done / t.matches.length) * 100)}%"></span></div>`;
  } else {
    foot = `<div class="t-foot">${verified} verified${pending ? ` · <span class="amber-text">${pending} awaiting</span>` : ''}</div>`;
  }
  const art = (t.id.charCodeAt(0) % 15) + 1;
  return `<a class="t-card st-${t.status}" href="#/t/${t.id}">
    <div class="t-card-art" aria-hidden="true">${ball(art, 92)}</div>
    <div class="t-card-top">${tStatusPill(t)}${mine ? entryBadge(mine) : ''}</div>
    <h3>${esc(t.name)}</h3>
    <div class="t-meta"><span>${icon('users')} ${verified} player${verified === 1 ? '' : 's'}</span><span>${icon('clock')} ${t.timerMinutes ? `${t.timerMinutes} min clock` : 'No clock'}</span></div>
    ${foot}
  </a>`;
}

/* =====================================================================
   Tournament
   ===================================================================== */

function tournamentView(id) {
  const t = findT(id);
  if (!t) return notFound();
  const verified = t.entries.filter((e) => e.status === 'verified').length;
  const started = t.status !== 'registration';
  const bracketSection = started
    ? `<section class="section">
        <div class="section-head"><h2>Bracket</h2><span class="muted">${t.rounds} round${t.rounds === 1 ? '' : 's'} · single elimination</span></div>
        ${bracketView(t)}
      </section>`
    : '';
  return `
  <a class="back" href="#/">${icon('arrowLeft')} All tournaments</a>
  <div class="page-head">
    <div>
      <div class="title-row"><h1>${esc(t.name)}</h1>${tStatusPill(t)}</div>
      <div class="meta-row">
        <span>${icon('users')} ${verified} verified</span>
        <span>${icon('clock')} ${t.timerMinutes ? `${t.timerMinutes} min match clock` : 'No match clock'}</span>
        <span>${icon(t.liveBalls ? 'eye' : 'eyeOff')} Live balls ${t.liveBalls ? 'on' : 'off'}</span>
      </div>
    </div>
    <div class="head-actions">${playerActions(t)}${isAdmin() ? adminTournamentActions(t, verified) : ''}</div>
  </div>
  ${joinPanel(t)}
  ${isAdmin() ? tournamentSettings(t) : ''}
  ${t.status === 'completed' ? championBanner(t) : ''}
  ${started && !isAdmin() ? nowPlaying(t) : ''}
  ${t.status === 'in_progress' && isAdmin() ? `<section class="section"><div class="section-head"><h2>Matches</h2><span class="muted">Tap one to run it</span></div>${matchQueue(t)}</section>` : ''}
  ${bracketSection}
  <section class="section">
    <div class="section-head"><h2>Players</h2>
      <div class="legend"><span class="lg verified">Verified</span><span class="lg pending">Awaiting</span><span class="lg out">Disabled / left</span></div>
    </div>
    ${rosterView(t)}
  </section>`;
}

function playerActions(t) {
  if (S.me.role !== 'player') return '';
  const e = myEntry(t);
  const leave = `<button class="btn ghost" data-action="leave" data-tid="${t.id}">Leave</button>`;
  if (t.status === 'registration') {
    if (!e || e.status === 'left') return `<button class="btn primary" data-action="join" data-tid="${t.id}">${icon('plus')} Join tournament</button>`;
    if (e.status === 'disabled') return entryBadge(e);
    return entryBadge(e) + leave;
  }
  if (t.status === 'in_progress' && e && (e.status === 'verified' || e.status === 'pending')) return entryBadge(e) + leave;
  return e ? entryBadge(e) : '';
}

function adminTournamentActions(t, verified) {
  const start =
    t.status === 'registration'
      ? `<button class="btn primary" data-action="start-t" data-tid="${t.id}" ${verified < 2 ? 'disabled title="Verify at least two players first"' : ''}>${icon('play')} Draw bracket</button>`
      : `<button class="btn ghost" data-action="reset-t" data-tid="${t.id}">${icon('rotate')} Redraw</button>`;
  return `${start}<button class="icon-btn danger" data-action="delete-t" data-tid="${t.id}" title="Delete tournament" aria-label="Delete tournament">${icon('trash')}</button>`;
}

function tournamentSettings(t) {
  return `<details class="card settings" id="settings-${t.id}">
    <summary>${icon('gear')} Tournament settings</summary>
    <form data-form="edit-t" data-tid="${t.id}" class="settings-form">
      <label class="field"><span>Name</span><input id="edit-name" name="name" required maxlength="60" value="${esc(t.name)}"></label>
      <label class="field"><span>Default match clock (min, 0 = none)</span><input id="edit-timer" name="timerMinutes" type="number" min="0" max="180" step="0.5" value="${t.timerMinutes}"></label>
      <label class="check"><input id="edit-live" name="liveBalls" type="checkbox" ${t.liveBalls ? 'checked' : ''}><span>Show pocketed balls to players live</span></label>
      <button class="btn primary" type="submit">Save</button>
    </form>
  </details>`;
}

function championBanner(t) {
  const name = nameOf(t.championId);
  return `<div class="champion">
    <div class="champion-avatar"><span class="crown-float">${CROWN}</span>${avatar(name, 'xl')}</div>
    <div class="champion-copy"><span class="eyebrow gold">Champion</span><h2>${esc(name)}</h2><p class="muted">Took down ${esc(t.name)}</p></div>
    <div class="champion-ball" aria-hidden="true">${ball(8, 84)}</div>
  </div>`;
}

function nowPlaying(t) {
  const live = t.matches.filter((m) => m.status === 'live');
  if (!live.length) return '';
  const row = (m, s) => {
    const g = groupOf(m, s);
    const count = g && m.potted ? GROUPS[g].balls.filter((n) => m.potted.includes(n)).length : null;
    return `<div class="lt-row">${avatar(nameOf(m[s]), 'sm')}<span class="lt-name">${esc(nameOf(m[s]))}</span>
      ${g ? `${ball(GROUPS[g].icon, 16)}${count !== null ? `<span class="lt-count">${count}/7</span>` : ''}` : '<span class="muted small">open</span>'}</div>`;
  };
  return `<section class="section">
    <div class="section-head"><h2><span class="live-dot"></span> Now playing</h2></div>
    <div class="live-grid">${live
      .map(
        (m) => `<a class="live-tile" href="#/t/${t.id}/m/${m.id}">
          <div class="lt-head"><span>${roundName(m.round, t.rounds)} · Match ${matchNumber(t, m)}</span>
            ${m.timer.durationMs ? `<span class="clock xs" data-timer="${t.id}|${m.id}">${fmt(timeLeft(m))}</span>` : ''}</div>
          ${row(m, 'a')}${row(m, 'b')}
        </a>`,
      )
      .join('')}</div>
  </section>`;
}

function rosterView(t) {
  if (!t.entries.length) return emptyState('No one has joined yet', 'Players sign in and tap “Join tournament”.', 9);
  const entries = [...t.entries].sort((a, b) => {
    const rank = ENTRY_RANK[a.status] - ENTRY_RANK[b.status];
    if (rank) return rank;
    return ENTRY_RANK[a.status] === 2 ? a.updatedAt - b.updatedAt : a.joinedAt - b.joinedAt;
  });
  return `<div class="roster">${entries.map((e) => rosterItem(t, e)).join('')}</div>`;
}

function rosterItem(t, e) {
  const name = nameOf(e.playerId);
  const me = S.me.player?.id === e.playerId;
  const fate = playerFate(t, e.playerId);
  const sub = {
    pending: 'Awaiting verification',
    verified: { champion: 'Champion', out: 'Eliminated', alive: 'Still in' }[fate] ?? 'Verified',
    disabled: 'Disabled by admin',
    left: 'Left the tournament',
  }[e.status];
  return `<div class="roster-item st-${e.status} ${fate === 'out' ? 'is-out' : ''} ${fate === 'champion' ? 'is-champ' : ''}">
    ${avatar(name)}
    <div class="r-body">
      <div class="r-name">${esc(name)}${fate === 'champion' ? CROWN : ''}${me ? '<span class="you">You</span>' : ''}</div>
      <div class="r-sub"><span class="sdot"></span>${sub}</div>
    </div>
    ${isAdmin() ? rosterActions(t, e) : ''}
  </div>`;
}

function rosterActions(t, e) {
  if (t.status === 'completed' || e.status === 'left') return '';
  const btn = (status, label, cls, ic) =>
    `<button class="btn sm ${cls}" data-action="entry" data-tid="${t.id}" data-pid="${e.playerId}" data-status="${status}">${icon(ic)} ${label}</button>`;
  const canVerify = t.status === 'registration' || t.matches.some((m) => m.a === e.playerId || m.b === e.playerId);
  let html = '';
  if (e.status === 'pending' && canVerify) html += btn('verified', 'Verify', 'primary', 'check');
  if (e.status === 'disabled' && canVerify) html += btn('verified', 'Enable', 'ghost', 'check');
  if (e.status !== 'disabled') html += btn('disabled', 'Disable', 'ghost danger-text', 'ban');
  return `<div class="r-actions">${html}</div>`;
}

/* =====================================================================
   Bracket
   ===================================================================== */

function bracketView(t) {
  const rounds = Array.from({ length: t.rounds }, (_, i) => t.matches.filter((m) => m.round === i + 1));
  return `<div class="bracket-scroll" data-scroll-id="bracket-${t.id}">
    <div class="bracket">
      <svg class="bracket-lines" aria-hidden="true"></svg>
      ${rounds
        .map(
          (ms, i) => `<div class="round">
            <div class="round-title">${roundName(i + 1, t.rounds)}</div>
            <div class="round-matches">${ms.map((m) => `<div class="match-slot">${matchCard(t, m)}</div>`).join('')}</div>
          </div>`,
        )
        .join('')}
    </div>
  </div>`;
}

function matchCard(t, m) {
  const isFinal = m.round === t.rounds;
  const tag = {
    live: m.timer.durationMs
      ? `<span class="pill green xs"><span class="live-dot"></span><span data-timer="${t.id}|${m.id}">${fmt(timeLeft(m))}</span></span>`
      : pill('Live', 'green xs', '<span class="live-dot"></span>'),
    ready: m.startedAt ? pill('Paused', 'amber xs') : pill('Up next', 'blue xs'),
    waiting: '',
    done: { bye: pill('Bye', 'muted xs'), forfeit: pill('Forfeit', 'red xs'), timeout: pill('On time', 'amber xs') }[m.result] ?? '',
  }[m.status];

  const row = (s) => {
    const pid = m[s];
    if (!pid) return `<div class="mc-row tbd"><span class="avatar sm ghost">–</span><span>${m.bye === s ? 'Bye' : 'TBD'}</span></div>`;
    const name = nameOf(pid);
    const won = m.winner === s;
    const lost = Boolean(m.winner) && !won;
    const champ = won && isFinal;
    const st = entryOf(t, pid)?.status;
    const g = groupOf(m, s);
    let sub = '';
    if (g && m.status !== 'done') {
      const pottedCount = m.potted ? GROUPS[g].balls.filter((n) => m.potted.includes(n)).length : null;
      const mini = m.potted && m.status === 'live'
        ? `<span class="mini-balls">${GROUPS[g].balls.map((n) => ball(n, 12, m.potted.includes(n))).join('')}</span>`
        : '';
      sub = `<div class="mc-sub">${groupChip(g)}${mini}${pottedCount !== null && !mini ? `<span class="muted">${pottedCount}/7</span>` : ''}</div>`;
    } else if (m.status === 'live') {
      sub = '<div class="mc-sub"><span class="chip muted">Open table</span></div>';
    }
    return `<div class="mc-row ${won ? 'win' : ''} ${lost ? 'lose' : ''} ${champ ? 'champ' : ''}">
      ${avatar(name, 'sm')}
      <div class="mc-info">
        <div class="mc-name"><span class="truncate">${esc(name)}</span>${champ ? CROWN : ''}${st === 'disabled' || st === 'left' ? `<span class="tag">${st}</span>` : ''}</div>
        ${sub}
      </div>
      <span class="mc-mark">${won ? 'W' : lost ? 'L' : ''}</span>
    </div>`;
  };

  return `<a class="match-card st-${m.status} ${m.bye ? 'bye' : ''} ${isFinal ? 'is-final' : ''}" data-mid="${m.id}" href="#/t/${t.id}/m/${m.id}">
    <div class="mc-head"><span>${isFinal ? 'Final' : `Match ${matchNumber(t, m)}`}</span>${tag}</div>
    ${row('a')}${row('b')}
  </a>`;
}

/** Draws elbow connectors between each match and the match its winner feeds into. */
function drawConnectors() {
  for (const br of document.querySelectorAll('.bracket')) {
    const svg = br.querySelector('.bracket-lines');
    const box = br.getBoundingClientRect();
    const cards = new Map([...br.querySelectorAll('.match-card')].map((c) => [c.dataset.mid, c]));
    let paths = '';
    for (const [mid, card] of cards) {
      const [, r, i] = mid.match(/^r(\d+)m(\d+)$/).map(Number);
      const next = cards.get(`r${r + 1}m${i >> 1}`);
      if (!next) continue;
      const a = card.getBoundingClientRect();
      const b = next.getBoundingClientRect();
      const x1 = a.right - box.left;
      const y1 = a.top + a.height / 2 - box.top;
      const x2 = b.left - box.left;
      const y2 = b.top + b.height / 2 - box.top;
      const mx = (x1 + x2) / 2;
      paths += `<path class="${card.classList.contains('st-done') ? 'done' : ''}" d="M${x1} ${y1}H${mx}V${y2}H${x2}"/>`;
    }
    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    svg.innerHTML = paths;
  }
}

/* =====================================================================
   Match / table view
   ===================================================================== */

function matchView(tid, mid) {
  const t = findT(tid);
  const m = t?.matches.find((x) => x.id === mid);
  if (!t || !m) return notFound();
  const statusPill = {
    live: pill('Live', 'green', '<span class="live-dot"></span>'),
    ready: m.startedAt ? pill('Paused', 'amber') : pill('Up next', 'blue'),
    waiting: pill('Waiting for players', 'muted'),
    done: pill('Final', 'gold'),
  }[m.status];
  const next = isAdmin() ? nextMatch(t, m.id) : null;
  return `
  <div class="match-nav">
    <a class="btn ghost" href="#/t/${t.id}">${icon('board')} Board</a>
    <span class="match-nav-title truncate">${esc(t.name)}</span>
    ${next ? `<a class="btn primary" href="#/t/${t.id}/m/${next.id}" title="Match ${matchNumber(t, next)}">Next match ${icon('arrowRight')}</a>` : ''}
  </div>
  <div class="page-head">
    <div><div class="title-row"><h1>${roundName(m.round, t.rounds)}<span class="muted"> · Match ${matchNumber(t, m)}</span></h1>${statusPill}</div></div>
  </div>
  <div class="table-rail">
    <i class="pocket p1"></i><i class="pocket p2"></i><i class="pocket p3"></i><i class="pocket p4"></i><i class="pocket p5"></i><i class="pocket p6"></i>
    <div class="scoreboard felt">
      ${side(t, m, 'a')}
      ${center(t, m)}
      ${side(t, m, 'b')}
    </div>
  </div>
  ${m.potted ? pottedTray(m) : '<p class="hint centered">Live ball tracking is hidden for this tournament.</p>'}
  ${isAdmin() && m.a && m.b ? controlPanel(t, m) : ''}
  ${!m.a || !m.b ? '<p class="hint centered">This match unlocks once both players have won their previous match.</p>' : ''}
  ${isAdmin() ? `<section class="section"><div class="section-head"><h2>All matches</h2></div>${matchQueue(t, m.id)}</section>` : ''}`;
}

/** Admin control room: live and ready matches across every running tournament. */
function tablesNow(ts) {
  const rows = (status) =>
    ts.filter((t) => t.status === 'in_progress')
      .flatMap((t) => t.matches.filter((m) => m.status === status).map((m) => queueRow(t, m, { showTournament: true })));
  const live = rows('live');
  const ready = rows('ready');
  if (!live.length && !ready.length) return '';
  return `<section class="section">
    <div class="section-head"><h2>Tables right now</h2></div>
    <div class="queue two">
      <div class="q-col"><div class="q-head"><span>Live now</span><span class="q-count">${live.length}</span></div>${live.join('') || '<p class="q-empty">No tables running.</p>'}</div>
      <div class="q-col"><div class="q-head"><span>Up next</span><span class="q-count">${ready.length}</span></div>${ready.join('') || '<p class="q-empty">Nothing ready to start.</p>'}</div>
    </div>
  </section>`;
}

/** The match the admin should run next: one that's ready to start, else another live table. */
function nextMatch(t, currentId) {
  const rank = { ready: 0, live: 1 };
  return t.matches.filter((m) => m.id !== currentId && m.status in rank).sort((x, y) => rank[x.status] - rank[y.status])[0] ?? null;
}

function queueRow(t, m, { currentId, showTournament = false } = {}) {
  const who = (s) => {
    if (!m[s]) return `<span class="q-tbd">${m.bye === s ? 'Bye' : 'TBD'}</span>`;
    const cls = m.winner === s ? 'q-win' : m.winner ? 'q-lose' : '';
    return `<span class="${cls} truncate">${esc(nameOf(m[s]))}</span>`;
  };
  const tag = {
    live: m.timer.durationMs
      ? `<span class="pill green xs"><span class="live-dot"></span><span data-timer="${t.id}|${m.id}">${fmt(timeLeft(m))}</span></span>`
      : pill('Live', 'green xs', '<span class="live-dot"></span>'),
    ready: m.startedAt ? pill('Paused', 'amber xs') : pill('Ready', 'blue xs'),
    waiting: '',
    done: { bye: pill('Bye', 'muted xs'), forfeit: pill('Forfeit', 'red xs'), timeout: pill('On time', 'amber xs') }[m.result] ?? pill('Done', 'muted xs'),
  }[m.status];
  return `<a class="q-row st-${m.status} ${m.id === currentId ? 'current' : ''}" href="#/t/${t.id}/m/${m.id}">
    <span class="q-num">${matchNumber(t, m)}</span>
    <div class="q-body">
      <div class="q-players">${who('a')}<span class="q-vs">vs</span>${who('b')}</div>
      <div class="q-sub">${showTournament ? `${esc(t.name)} · ` : ''}${roundName(m.round, t.rounds)}${m.id === currentId ? ' · <b>you are here</b>' : ''}</div>
    </div>
    ${tag}
  </a>`;
}

/** Admin overview of every match in a tournament, grouped by what needs attention. */
function matchQueue(t, currentId) {
  const by = (status) => t.matches.filter((m) => m.status === status && !(status === 'done' && m.result === 'bye'));
  const col = (status, title, empty) => {
    const list = by(status);
    return `<div class="q-col">
      <div class="q-head"><span>${title}</span><span class="q-count">${list.length}</span></div>
      ${list.length ? list.map((m) => queueRow(t, m, { currentId })).join('') : `<p class="q-empty">${empty}</p>`}
    </div>`;
  };
  const done = by('done');
  return `<div class="queue">
    ${col('live', 'Live now', 'No tables running.')}
    ${col('ready', 'Up next', 'Nothing ready to start.')}
    ${col('waiting', 'Later', 'Every match has its players.')}
  </div>
  ${done.length ? `<details class="q-done" id="q-done-${t.id}"><summary>Finished <span class="q-count">${done.length}</span></summary>
    <div class="q-done-list">${done.map((m) => queueRow(t, m, { currentId })).join('')}</div></details>` : ''}`;
}

function side(t, m, s) {
  const pid = m[s];
  if (!pid) {
    return `<div class="side vacant"><span class="avatar xl ghost">?</span><div class="side-name">${m.bye === s ? 'Bye' : 'To be decided'}</div></div>`;
  }
  const name = nameOf(pid);
  const won = m.winner === s;
  const lost = Boolean(m.winner) && !won;
  const champ = won && m.round === t.rounds;
  const g = groupOf(m, s);
  const balls = g ? GROUPS[g].balls : null;
  const count = balls && m.potted ? balls.filter((n) => m.potted.includes(n)).length : null;
  const result = won
    ? pill({ timeout: 'Won on time', forfeit: 'Won by forfeit', bye: 'Advanced' }[m.result] ?? 'Winner', 'green', icon('check'))
    : lost
      ? pill(m.result === 'forfeit' ? 'Forfeited' : 'Eliminated', 'red')
      : '';
  return `<div class="side side-${s} ${won ? 'won' : ''} ${lost ? 'lost' : ''}">
    <div class="side-avatar">${champ ? `<span class="crown-float">${CROWN}</span>` : ''}${avatar(name, 'xl')}</div>
    <div class="side-name">${esc(name)}</div>
    ${result}
    <div class="side-group">${g ? groupChip(g) : '<span class="chip">Open table</span>'}</div>
    ${balls ? `<div class="side-balls">${balls.map((n) => ball(n, 30, m.potted?.includes(n))).join('')}</div>` : ''}
    ${count !== null ? `<div class="side-count"><b>${count}</b> / 7 pocketed</div>` : ''}
  </div>`;
}

function center(t, m) {
  const hasClock = m.timer.durationMs > 0;
  const left = timeLeft(m);
  let label = 'ready';
  if (m.status === 'done') label = 'final';
  else if (m.timer.running) label = 'running';
  else if (left < m.timer.durationMs) label = 'paused';
  return `<div class="center">
    ${hasClock ? `<div class="clock" data-timer="${t.id}|${m.id}">${fmt(left)}</div><div class="clock-label">${label}</div>` : '<div class="clock-label">No clock</div>'}
    <div class="eight">${ball(8, 64, m.potted?.includes(8))}</div>
    <div class="vs">VS</div>
  </div>`;
}

function pottedTray(m) {
  return `<div class="tray">
    <span class="tray-label">Pocketed</span>
    <div class="tray-balls">${m.potted.length ? m.potted.map((n) => ball(n, 26)).join('') : '<span class="muted">Nothing down yet</span>'}</div>
  </div>`;
}

/** Start / pause / resume / restart — the match's on-the-table state. */
function matchStateButtons(m) {
  const touched = m.startedAt || m.potted.length || m.groupA || m.timer.remainingMs < m.timer.durationMs;
  const restart = touched ? `<button class="btn ghost danger-text" data-action="m-restart">${icon('rotate')} Restart match</button>` : '';
  if (m.status === 'live') return `<button class="btn ghost" data-action="m-pause">${icon('pause')} Pause match</button>${restart}`;
  const clock = m.timer.durationMs ? ' & clock' : '';
  const start = m.startedAt
    ? `<button class="btn primary" data-action="m-start">${icon('play')} Resume match${clock}</button>`
    : `<button class="btn primary" data-action="m-start">${icon('play')} Start match${clock}</button>`;
  return start + restart;
}

function controlPanel(t, m) {
  if (m.status === 'done') {
    const undoable = m.result === 'win' || m.result === 'timeout';
    const next = nextMatch(t, m.id);
    let cta;
    if (next) {
      cta = `<div class="next-up">
        <div><span class="eyebrow">Next up · ${next.status === 'ready' ? 'ready to start' : 'in progress'}</span>
          <h3>Match ${matchNumber(t, next)} · ${esc(nameOf(next.a))} vs ${esc(nameOf(next.b))}</h3>
          <p class="muted small">${roundName(next.round, t.rounds)}</p></div>
        <a class="btn primary" href="#/t/${t.id}/m/${next.id}">Go to next match ${icon('arrowRight')}</a>
      </div>`;
    } else {
      cta = `<div class="next-up">
        <div><span class="eyebrow">${t.status === 'completed' ? 'Tournament finished' : 'Nothing ready yet'}</span>
          <h3>${t.status === 'completed' ? `${esc(nameOf(t.championId))} is the champion` : 'Waiting on matches still in play'}</h3></div>
        <a class="btn primary" href="#/t/${t.id}">${icon('board')} Back to the board</a>
      </div>`;
    }
    return `<section class="panel"><div class="card panel-done">
      ${cta}
      <div class="undo-row"><p class="muted small">${undoable ? 'Made a mistake? You can undo until the next match starts.' : 'Byes and forfeits are applied automatically.'}</p>
        ${undoable ? `<button class="btn ghost sm" data-action="m-undo">${icon('undo')} Undo result</button>` : ''}</div>
    </div></section>`;
  }
  const A = nameOf(m.a);
  const B = nameOf(m.b);
  const left = timeLeft(m);
  const timerBtn = m.timer.running
    ? `<button class="btn ghost" data-action="m-timer" data-op="pause">${icon('pause')} Pause</button>`
    : `<button class="btn primary" data-action="m-timer" data-op="start" ${left > 0 ? '' : 'disabled'}>${icon('play')} ${left < m.timer.durationMs ? 'Resume' : 'Start'}</button>`;
  return `<section class="panel">
    <div class="panel-title">
      <div><span class="eyebrow">Admin</span><h2>Table control</h2></div>
      <div class="btn-row">${matchStateButtons(m)}</div>
    </div>
    <div class="panel-grid">
      <div class="card rack-card">
        <div class="card-head"><h3>Rack</h3><span class="muted small">Tap a ball when it drops · tap again to undo</span></div>
        <div class="rack felt">${RACK_ROWS.map(
          (row) => `<div class="rack-row">${row
            .map((n) => {
              const inPocket = m.potted.includes(n);
              return `<button class="ball-btn ${inPocket ? 'in' : ''}" data-action="m-ball" data-ball="${n}" aria-pressed="${inPocket}" title="Ball ${n}">${ball(n, 46)}</button>`;
            })
            .join('')}</div>`,
        ).join('')}</div>
      </div>
      <div class="stack">
        <div class="card">
          <div class="card-head"><h3>Groups</h3><span class="muted small">${esc(B)} gets the other set</span></div>
          <div class="seg">
            <button class="seg-btn ${m.groupA === 'solids' ? 'on' : ''}" data-action="m-groups" data-group="solids">${ball(1, 18)}<span>${esc(A)} · Solids</span></button>
            <button class="seg-btn ${m.groupA === 'stripes' ? 'on' : ''}" data-action="m-groups" data-group="stripes">${ball(9, 18)}<span>${esc(A)} · Stripes</span></button>
            <button class="seg-btn ${m.groupA ? '' : 'on'}" data-action="m-groups" data-group="">Open table</button>
          </div>
        </div>
        <div class="card clock-card">
          <div class="card-head"><h3>Match clock</h3><span class="clock sm" data-timer="${t.id}|${m.id}">${fmt(left)}</span></div>
          <div class="btn-row">
            ${timerBtn}
            <button class="btn ghost" data-action="m-timer" data-op="add" data-minutes="1">${icon('plus')} 1 min</button>
            <button class="btn ghost" data-action="m-timer" data-op="reset">${icon('rotate')} Reset</button>
          </div>
          <form data-form="timer-set" class="inline-form">
            <input id="timer-min" name="minutes" type="number" min="0" max="180" step="0.5" value="${m.timer.durationMs / 60000}" aria-label="Clock minutes">
            <span class="muted">min</span>
            <button class="btn ghost sm" type="submit">Set clock</button>
          </form>
          <p class="warn">Time is up — pick the winner below.</p>
        </div>
        <div class="card">
          <div class="card-head"><h3>Declare winner</h3></div>
          <div class="btn-row winners">
            <button class="btn win" data-action="m-winner" data-slot="a">${icon('trophy')} <span class="truncate">${esc(A)}</span></button>
            <button class="btn win" data-action="m-winner" data-slot="b">${icon('trophy')} <span class="truncate">${esc(B)}</span></button>
          </div>
        </div>
      </div>
    </div>
  </section>`;
}

/* =====================================================================
   Admin
   ===================================================================== */

function adminView() {
  if (!isAdmin()) {
    return `<div class="center-wrap"><div class="card auth-card narrow">
      <div class="auth-icon">${icon('shield')}</div>
      <h2>Admin sign in</h2>
      <p class="muted">Create tournaments, verify players and run the tables.</p>
      <form data-form="admin-login" class="stack">
        <label class="field"><span>Admin password</span><input id="admin-pass" name="password" type="password" required autocomplete="current-password"></label>
        <button class="btn primary block" type="submit">Sign in</button>
      </form>
    </div></div>`;
  }
  const ts = S.state.tournaments;
  const pending = ts.flatMap((t) => (t.status === 'registration' ? t.entries.filter((e) => e.status === 'pending').map((e) => ({ t, e })) : []));
  return `
  <div class="page-head"><div><span class="eyebrow">Control room</span><h1>Admin</h1></div></div>
  <div class="admin-grid">
    <div class="card">
      <div class="card-head"><h3>New tournament</h3></div>
      <form data-form="create" class="stack">
        <label class="field"><span>Name</span><input id="new-name" name="name" required maxlength="60" placeholder="Friday Night 8-Ball"></label>
        <label class="field"><span>Match clock (minutes, 0 = none)</span><input id="new-timer" name="timerMinutes" type="number" min="0" max="180" step="0.5" value="10"></label>
        <label class="check"><input id="new-live" name="liveBalls" type="checkbox" checked><span>Show pocketed balls to players live</span></label>
        <button class="btn primary" type="submit">${icon('plus')} Create tournament</button>
      </form>
    </div>
    <div class="card">
      <div class="card-head"><h3>Waiting for verification</h3><span class="count">${pending.length}</span></div>
      ${pending.length
        ? `<div class="mini-list">${pending
            .map(
              ({ t, e }) => `<div class="mini-item">${avatar(nameOf(e.playerId), 'sm')}
                <div class="r-body"><div class="r-name">${esc(nameOf(e.playerId))}</div><div class="r-sub">${esc(t.name)}</div></div>
                <button class="btn sm primary" data-action="entry" data-tid="${t.id}" data-pid="${e.playerId}" data-status="verified">${icon('check')} Verify</button>
              </div>`,
            )
            .join('')}</div>`
        : '<p class="muted">All caught up.</p>'}
    </div>
    <div class="card">
      <div class="card-head"><h3>Sign-in settings</h3></div>
      <label class="switch">
        <input type="checkbox" data-change="require-pin" ${S.state.settings.requirePin ? 'checked' : ''}>
        <span class="track"></span>
        <span><b>Require a PIN</b><br><span class="muted small">When off, players sign in with just their name — faster, but anyone could sign in as anyone.</span></span>
      </label>
    </div>
  </div>
  ${tablesNow(ts)}
  <section class="section">
    <div class="section-head"><h2>All tournaments</h2></div>
    ${ts.length ? `<div class="t-grid">${ts.map(tournamentCard).join('')}</div>` : emptyState('No tournaments yet', 'Create your first one above.')}
  </section>`;
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

/** Admin-only: pops up wherever they are when a running match clock hits zero. */
function checkTimeouts() {
  if (!isAdmin() || S.modal || !S.state) return;
  for (const t of S.state.tournaments) {
    for (const m of t.matches) {
      if (!isExpired(m)) continue;
      const key = `${t.id}/${m.id}/${m.timer.endsAt}`;
      if (S.acked.has(key)) continue;
      return showTimeUp(t, m, key);
    }
  }
}

function showTimeUp(t, m, key) {
  const A = nameOf(m.a);
  const B = nameOf(m.b);
  const ack = () => {
    S.acked.add(key);
    closeModal();
  };
  beep();
  openModal(
    `<div class="timeup-icon">${icon('clock')}</div>
     <h2>Time's up!</h2>
     <p class="muted">${esc(t.name)} · ${roundName(m.round, t.rounds)}, match ${matchNumber(t, m)}. Who takes it?</p>
     <div class="timeup-choices">
       <button class="choice" data-choice="a">${avatar(A, 'lg')}<span>${esc(A)}</span></button>
       <button class="choice" data-choice="b">${avatar(B, 'lg')}<span>${esc(B)}</span></button>
     </div>
     <div class="modal-actions">
       <button class="btn ghost" data-choice="later">Decide later</button>
       <button class="btn ghost" data-choice="extend">${icon('plus')} 2 more minutes</button>
     </div>`,
    {
      kind: 'timeup',
      tid: t.id,
      mid: m.id,
      onDismiss: ack,
      onChoice: (c) => {
        ack();
        if (c === 'a' || c === 'b') run(() => act(t.id, m.id, { type: 'winner', slot: c, reason: 'timeout' }));
        if (c === 'extend') run(() => act(t.id, m.id, { type: 'timer', op: 'add', minutes: 2 }));
      },
    },
  );
}

/** Closes a time-up alert that someone else already resolved (other tab, other admin). */
function syncModal() {
  if (S.modal?.kind !== 'timeup') return;
  const m = findMatch(S.modal.tid, S.modal.mid);
  if (!m || !isExpired(m)) closeModal();
}

/* =====================================================================
   Rendering
   ===================================================================== */

function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'admin') return { name: 'admin' };
  if (parts[0] === 't' && parts[1]) {
    return parts[2] === 'm' && parts[3] ? { name: 'match', tid: parts[1], mid: parts[3] } : { name: 'tournament', tid: parts[1] };
  }
  return { name: 'home' };
}

function view(r) {
  if (!S.state) return '<div class="loading">' + ball(8, 48) + '<span>Racking up…</span></div>';
  if (r.name === 'admin') return adminView();
  if (r.name === 'tournament') return tournamentView(r.tid);
  if (r.name === 'match') return matchView(r.tid, r.mid);
  return homeView();
}

/** Live updates re-render the page; keep what the user is typing, focus, open panels and scroll. */
function captureUi() {
  const fields = [...$app.querySelectorAll('form[data-form] [id]')].map((el) => ({ id: el.id, value: el.value, checked: el.checked }));
  const active = document.activeElement;
  let focus = null;
  if (active?.id && $app.contains(active)) {
    focus = { id: active.id };
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
  const snapshot = S.renderedKey === location.hash ? captureUi() : null;
  $nav.innerHTML = navView(r);
  $app.innerHTML = view(r);
  if (snapshot) restoreUi(snapshot);
  S.renderedKey = location.hash;
  drawConnectors();
  syncModal();
  tick();
}

function tick() {
  if (!S.state) return;
  for (const el of document.querySelectorAll('[data-timer]')) {
    const [tid, mid] = el.dataset.timer.split('|');
    const m = findMatch(tid, mid);
    if (!m) continue;
    const left = timeLeft(m);
    el.textContent = fmt(left);
    el.classList.toggle('low', m.status === 'live' && m.timer.running && left > 0 && left <= 60000);
    el.classList.toggle('expired', isExpired(m));
  }
  checkTimeouts();
}

/* =====================================================================
   Events
   ===================================================================== */

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  e.preventDefault();
  run(() => onAction(el.dataset.action, el.dataset));
});

async function onAction(action, d) {
  const r = route();
  switch (action) {
    case 'auth-back':
      S.auth = { ctx: S.auth.ctx, step: 'name', name: S.auth.name };
      render();
      return document.getElementById('auth-name')?.select();
    case 'logout':
      await api('POST', '/api/logout').catch(() => {});
      setSession(null, { role: null });
      location.hash = '#/';
      return toast('Signed out');
    case 'join':
      await api('POST', `/api/tournaments/${d.tid}/join`);
      return toast("You're in! The admin will verify you shortly.", 'success');
    case 'leave': {
      const live = findT(d.tid)?.status === 'in_progress';
      const ok = await confirmDialog({
        title: 'Leave this tournament?',
        body: live ? 'You will forfeit any match you have not finished.' : 'You can rejoin while registration is open.',
        confirmLabel: 'Leave',
        danger: true,
      });
      if (!ok) return;
      await api('POST', `/api/tournaments/${d.tid}/leave`);
      return toast('You left the tournament');
    }
    case 'entry': {
      if (d.status === 'disabled' && findT(d.tid)?.status === 'in_progress') {
        const ok = await confirmDialog({
          title: `Disable ${nameOf(d.pid)}?`,
          body: 'They forfeit their current or next match and drop to the bottom of the board.',
          confirmLabel: 'Disable',
          danger: true,
        });
        if (!ok) return;
      }
      return api('POST', `/api/tournaments/${d.tid}/entries/${d.pid}`, { status: d.status });
    }
    case 'start-t': {
      const n = findT(d.tid).entries.filter((e) => e.status === 'verified').length;
      const ok = await confirmDialog({
        title: 'Draw the bracket?',
        body: `${n} verified players will be seeded at random. Registration closes and unverified players stay out.`,
        confirmLabel: 'Draw bracket',
      });
      if (!ok) return;
      await api('POST', `/api/tournaments/${d.tid}/start`);
      return toast('Bracket drawn — game on!', 'success');
    }
    case 'reset-t': {
      const ok = await confirmDialog({
        title: 'Redraw the bracket?',
        body: 'Every match result is wiped and registration reopens. Players keep their verification.',
        confirmLabel: 'Wipe & reopen',
        danger: true,
      });
      if (ok) await api('POST', `/api/tournaments/${d.tid}/reset`);
      return;
    }
    case 'delete-t': {
      const ok = await confirmDialog({
        title: 'Delete this tournament?',
        body: 'The bracket, results and player list are gone for good.',
        confirmLabel: 'Delete',
        danger: true,
      });
      if (!ok) return;
      await api('DELETE', `/api/tournaments/${d.tid}`);
      location.hash = '#/admin';
      return toast('Tournament deleted');
    }
    case 'm-pause':
      await act(r.tid, r.mid, { type: 'pause' });
      return toast('Match paused — clock stopped, balls kept');
    case 'm-restart': {
      const ok = await confirmDialog({
        title: 'Restart this match?',
        body: 'Pocketed balls and groups are cleared and the clock goes back to full time. The match is no longer live until you start it again.',
        confirmLabel: 'Restart match',
        danger: true,
      });
      if (!ok) return;
      await act(r.tid, r.mid, { type: 'restart' });
      return toast('Match restarted');
    }
    case 'm-start':
      return act(r.tid, r.mid, { type: 'start' });
    case 'm-ball':
      return act(r.tid, r.mid, { type: 'ball', ball: Number(d.ball) });
    case 'm-groups':
      return act(r.tid, r.mid, { type: 'groups', groupA: d.group || null });
    case 'm-timer':
      return act(r.tid, r.mid, { type: 'timer', op: d.op, minutes: Number(d.minutes || 0) });
    case 'm-winner': {
      const m = findMatch(r.tid, r.mid);
      const ok = await confirmDialog({
        title: `${nameOf(m[d.slot])} wins?`,
        body: 'They advance to the next round. You can undo this until their next match starts.',
        confirmLabel: 'Confirm winner',
      });
      if (!ok) return;
      return act(r.tid, r.mid, { type: 'winner', slot: d.slot, reason: isExpired(m) ? 'timeout' : 'win' });
    }
    case 'm-undo':
      return act(r.tid, r.mid, { type: 'undo' });
  }
}

document.addEventListener('submit', (e) => {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  run(() => onForm(form.dataset.form, new FormData(form), form));
});

/** Sign-in step 1: look the name up, then move to the PIN step (or show why we can't). */
async function checkName(ctx, name) {
  const t = ctx ? findT(ctx) : null;
  try {
    const res = await api('GET', `/api/players/check?name=${encodeURIComponent(name)}`);
    if (!res.exists && t && t.status !== 'registration') {
      S.auth = { ctx, step: 'name', name, error: `There's no player called “${res.name}”, and registration for this tournament is closed.` };
    } else {
      S.auth = { ctx, step: 'pin', ...res };
    }
  } catch (err) {
    S.auth = { ctx, step: 'name', name, error: err.message };
  }
  render();
  const next = document.getElementById(S.auth.step === 'pin' ? 'auth-pin' : 'auth-name');
  (next ?? $app.querySelector('form[data-form="auth-pin"] [type="submit"]'))?.focus();
}

/** Sign-in step 2: create or sign in — and inside a tournament, join it too. */
async function submitPin(pin) {
  const a = S.auth;
  const t = a.ctx ? findT(a.ctx) : null;
  let res;
  try {
    if (t) res = await api('POST', `/api/tournaments/${t.id}/enter`, { name: a.name, pin });
    else res = await api('POST', a.exists ? '/api/login' : '/api/register', { name: a.name, pin });
  } catch (err) {
    // Someone grabbed the name in the meantime: start over at step 1.
    S.auth = /taken/i.test(err.message) ? { ctx: a.ctx, step: 'name', name: a.name, error: err.message } : { ...a, error: err.message };
    render();
    const pinInput = document.getElementById('auth-pin');
    if (pinInput) pinInput.value = '';
    return (pinInput ?? document.getElementById('auth-name'))?.focus();
  }

  S.auth = { ctx: null, step: 'name' };
  setSession(res.token, res.me);
  const name = res.me.player.name;
  if (t?.status === 'registration') {
    const msg = {
      disabled: `Signed in, ${name} — but the admin has disabled you in this tournament.`,
      verified: `Welcome back, ${name} — you're verified and in.`,
    }[res.entryStatus];
    return toast(msg ?? `You're in, ${name}! The admin will verify you shortly.`, msg && res.entryStatus === 'disabled' ? 'error' : 'success');
  }
  return toast(a.exists ? `Welcome back, ${name}!` : `Welcome, ${name}!`, 'success');
}

const resetForm = (name) => $app.querySelector(`form[data-form="${name}"]`)?.reset();

async function onForm(name, data, form) {
  const r = route();
  switch (name) {
    case 'auth-name':
      return checkName(form.dataset.ctx || null, String(data.get('name') ?? ''));
    case 'auth-pin':
      return submitPin(data.get('pin'));
    case 'admin-login': {
      const res = await api('POST', '/api/admin/login', { password: data.get('password') });
      setSession(res.token, res.me);
      return toast('Admin mode on', 'success');
    }
    case 'create': {
      const res = await api('POST', '/api/tournaments', {
        name: data.get('name'),
        timerMinutes: data.get('timerMinutes'),
        liveBalls: data.get('liveBalls') === 'on',
      });
      resetForm('create');
      location.hash = `#/t/${res.id}`;
      return toast('Tournament created — share the link so players can join', 'success');
    }
    case 'edit-t':
      await api('PATCH', `/api/tournaments/${form.dataset.tid}`, {
        name: data.get('name'),
        timerMinutes: data.get('timerMinutes'),
        liveBalls: data.get('liveBalls') === 'on',
      });
      return toast('Settings saved', 'success');
    case 'timer-set':
      return act(r.tid, r.mid, { type: 'timer', op: 'set', minutes: Number(data.get('minutes')) });
  }
}

document.addEventListener('change', (e) => {
  if (e.target.dataset.change === 'require-pin') {
    run(() => api('PATCH', '/api/settings', { requirePin: e.target.checked }));
  }
});

window.addEventListener('hashchange', () => {
  render();
  window.scrollTo(0, 0);
});
window.addEventListener('resize', drawConnectors);
document.fonts?.ready.then(drawConnectors);

/* =====================================================================
   Session & live connection
   ===================================================================== */

function setSession(token, me) {
  S.token = token;
  S.me = me;
  writeToken(token);
  connect(); // admins get a slightly different feed (always-visible balls)
  render();
}

function applyState(state) {
  S.state = state;
  S.offset = state.serverTime - Date.now();
  S.names = new Map(state.players.map((p) => [p.id, p.name]));
  S.online = true;
  render();
}

function markOffline() {
  S.online = false;
  $nav.querySelector('.conn')?.classList.remove('on');
}

/** Live updates over SSE; falls back to polling when nothing arrives (some tunnels/proxies block streams). */
function connect() {
  if (S.polling) return refresh(true); // the session changed — fetch the right view now
  S.events?.close();
  const es = new EventSource(`/api/events${S.token ? `?token=${encodeURIComponent(S.token)}` : ''}`);
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
      writeToken(null);
    }
  }
  connect();
  render();
  setInterval(tick, 250);
})();
