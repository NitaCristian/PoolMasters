'use strict';

/* =====================================================================
   Constants
   ===================================================================== */

const BALL_COLORS = ['', '#f5c518', '#1e4fd8', '#d92b2b', '#6b2fb8', '#f47a14', '#16834a', '#8a1c22', '#15171a'];
const SOLIDS = [1, 2, 3, 4, 5, 6, 7];
const STRIPES = [9, 10, 11, 12, 13, 14, 15];
const GROUPS = {
  solids: { icon: 1, balls: SOLIDS },
  stripes: { icon: 9, balls: STRIPES },
};
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
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  triangle: '<path d="M12 4 3 20h18z"/>',
  cue: '<path d="M3 21 17 7"/><circle cx="19" cy="5" r="2"/>',
  repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
  table: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="4" cy="8" r="1" fill="currentColor"/><circle cx="20" cy="8" r="1" fill="currentColor"/><circle cx="4" cy="16" r="1" fill="currentColor"/><circle cx="20" cy="16" r="1" fill="currentColor"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16v4M17 18h4"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>',
};

const icon = (name) =>
  `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name]}</svg>`;

const CROWN = `<svg class="crown" viewBox="0 0 24 24" role="img" aria-label="Champion"><path d="M2.5 7.5l5 4.2L12 4l4.5 7.7 5-4.2-2.1 11.3H4.6z" fill="currentColor"/><rect x="4.6" y="19.8" width="14.8" height="2" rx="1" fill="currentColor"/></svg>`;

const FLAGS = {
  en: '<svg class="flag" viewBox="0 0 60 30" aria-hidden="true"><clipPath id="flag-uk"><path d="M30,15h30v15zv15h-30zh-30v-15zv-15h30z"/></clipPath><path d="M0,0v30h60v-30z" fill="#012169"/><path d="M0,0 60,30M60,0 0,30" stroke="#fff" stroke-width="6"/><path d="M0,0 60,30M60,0 0,30" clip-path="url(#flag-uk)" stroke="#C8102E" stroke-width="4"/><path d="M30,0v30M0,15h60" stroke="#fff" stroke-width="10"/><path d="M30,0v30M0,15h60" stroke="#C8102E" stroke-width="6"/></svg>',
  nl: '<svg class="flag" viewBox="0 0 9 6" aria-hidden="true"><path fill="#AE1C28" d="M0 0h9v2H0z"/><path fill="#fff" d="M0 2h9v2H0z"/><path fill="#21468B" d="M0 4h9v2H0z"/></svg>',
};

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
  lang: initialLang(),
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
  rulesTab: readStored('pm_rules') === 'full' ? 'full' : 'basics',
  glossQuery: '',
  focusAfter: null, // element id to focus once it shows up (e.g. a team just added)
  fx: emptyFx(), // what changed in the last update, so only that animates
  counts: new Map(), // last shown value of each animated counter
  ai: emptyAi(),
};

function emptyAi() {
  return { tried: false, status: null, chats: [], open: { id: null, messages: [] }, sending: false, draft: '', stick: false };
}

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

/** The saved choice, else the browser's language. */
function initialLang() {
  const saved = readStored('pm_lang');
  if (saved === 'en' || saved === 'nl') return saved;
  return /^nl\b/i.test(navigator.language || '') ? 'nl' : 'en';
}

/* =====================================================================
   Translation (strings live in i18n.js)
   ===================================================================== */

/** Looks up a string; `{name}` placeholders are filled from vars (already escaped by the caller when HTML). */
function t(key, vars = {}) {
  const s = STRINGS[S.lang]?.[key] ?? STRINGS.en[key] ?? key;
  if (typeof s === 'function') return s(vars);
  return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

/** "3 teams" / "3 teams", "1 ball" / "1 bal". */
function plural(n, word) {
  const forms = WORDS[S.lang][word] ?? WORDS.en[word];
  return `${n} ${n === 1 ? forms[0] : forms[1]}`;
}

const ordinal = (n) => t('ordinal', { n });
const locale = () => (S.lang === 'nl' ? 'nl-NL' : 'en-GB');

/** Server errors are English; show them in the current language when we know them. */
function trError(msg) {
  if (S.lang === 'en' || !msg) return msg;
  if (ERRORS_NL[msg]) return ERRORS_NL[msg];
  for (const [re, fn] of ERROR_PATTERNS_NL) {
    const m = re.exec(msg);
    if (m) return fn(...m.slice(1));
  }
  return msg;
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
const teamName = (id) => team(id)?.name ?? t('tbd');
const activeMembers = (id) => team(id)?.members.filter((m) => m.active) ?? [];
const memberLine = (id) => activeMembers(id).map((m) => m.name).join(' & ') || t('team.noActive');
const findMatch = (id) => E().matches.find((m) => m.id === id);
const matchAt = (round, table) => E().matches.find((m) => m.round === round && m.table === table);
const groupName = (g) => t('group', { n: g + 1 });
const suitName = (g) => t(`suit.${g}`);
const stageName = (stage) => t(`stage.${stage}`);

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

const clockTime = (ts) => new Date(ts).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });

/** The round being played: the first with an undecided match. */
function currentRound(e) {
  const open = e.matches.filter((m) => !m.winner).map((m) => m.round);
  return open.length ? Math.min(...open) : e.rounds;
}

function roundStage(e, r) {
  if (r <= e.groupRounds) return stageName('group');
  const stage = matchAt(r, 1)?.stage;
  return stage === 'final' ? t('stage.finals') : stage ? stageName(stage) : '';
}

const roundTitle = (r) => t('round', { n: r });

function shortLabel(m) {
  if (m.stage === 'qf') return t('short.qf', { n: m.table });
  if (m.stage === 'sf') return t('short.sf', { n: m.table });
  if (m.stage === 'group') return `${groupName(m.group)} · T${m.table}`;
  return stageName(m.stage);
}

function srcLabel(src) {
  if (!src) return t('tbd');
  if (src.rank) return `${ordinal(src.rank.place)} G${src.rank.group + 1}`;
  const from = findMatch(src.winner ?? src.loser);
  return t(src.winner ? 'src.winner' : 'src.loser', { match: from ? shortLabel(from) : '' });
}

const slotName = (m, s) => (m[s] ? teamName(m[s]) : srcLabel(m[s === 'a' ? 'srcA' : 'srcB']));

/** Who is sitting out a group round: every group team without a match that round. */
function restingIn(e, r) {
  if (r > e.groupRounds) return [];
  const playing = new Set(e.matches.filter((m) => m.round === r).flatMap((m) => [m.a, m.b]));
  return e.groups.map((ids, g) => ({ g, ids: ids.filter((id) => !playing.has(id)) })).filter((x) => x.ids.length);
}

async function api(method, url, body) {
  // The header keeps ngrok's free-plan notice page away from these requests.
  const headers = { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' };
  if (S.token) headers.Authorization = `Bearer ${S.token}`;
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(trError(data.error) || t('err.request', { status: res.status }));
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
  const label = potted ? t('ball.potted', { n }) : t('ball.n', { n });
  return `<span class="${cls}" style="--c:${color};--size:${size}px" role="img" aria-label="${label}"><span class="ball-num">${n}</span></span>`;
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
const livePill = (label = t('status.live'), size = '') => pill(label, `green ${size}`, '<span class="live-dot"></span>');
const groupChip = (g) => `<span class="chip group">${ball(GROUPS[g].icon, 16)}${suitName(g)}</span>`;

function emptyState(title, body, art = 8, extra = '') {
  return `<div class="empty anim">${ball(art, 56, false, 'float')}<h3>${esc(title)}</h3><p class="muted">${esc(body)}</p>${extra}</div>`;
}

function statusTag(m, size = 'xs') {
  const e = E();
  if (m.status === 'live') {
    return m.timer.durationMs
      ? `<span class="pill green ${size}"><span class="live-dot"></span><span data-timer="${m.id}">${fmt(timeLeft(m))}</span></span>`
      : livePill(t('status.live'), size);
  }
  if (m.status === 'done') return m.result === 'timeout' ? pill(t('status.onTime'), `amber ${size}`) : pill(t('status.final'), `gold ${size}`);
  if (m.status === 'ready') {
    if (m.startedAt) return pill(t('status.paused'), `amber ${size}`);
    return m.round === currentRound(e) && !e.preview ? pill(t('status.upNext'), `blue ${size}`) : '';
  }
  return pill(t('tbd'), `muted ${size}`);
}

/* =====================================================================
   Top bar
   ===================================================================== */

function navView(r) {
  const link = (href, name, label) => `<a href="${href}" class="${r.name === name ? 'active' : ''}">${label}</a>`;
  const live = S.state?.event.status === 'live';
  const langBtn = (code) =>
    `<button class="${S.lang === code ? 'on' : ''}" data-action="lang" data-lang="${code}" aria-pressed="${S.lang === code}" title="${code === 'en' ? 'English' : 'Nederlands'}">${FLAGS[code]}<span>${code.toUpperCase()}</span></button>`;
  return `<div class="topbar-inner">
    <a class="brand" href="#/">${ball(8, 30, false, 'spin-hover')}<span class="brand-text">Pool<b>Masters</b></span></a>
    <nav class="nav">
      ${link('#/', 'home', `${live ? '<span class="live-dot"></span>' : ''}${t('nav.live')}`)}
      ${link('#/schedule', 'schedule', t('nav.schedule'))}
      ${link(S.rulesTab === 'full' ? '#/rules/full' : '#/rules', 'rules', t('nav.rules'))}
      ${link('#/admin', 'admin', isAdmin() ? `${icon('shield')}<span class="nav-label">${t('nav.admin')}</span>` : t('nav.admin'))}
    </nav>
    <div class="topbar-right">
      <div class="lang-switch" role="group" aria-label="${t('nav.language')}">${langBtn('en')}${langBtn('nl')}</div>
      <span class="conn ${S.online ? 'on' : ''} ${S.polling ? 'poll' : ''}" title="${!S.online ? t('conn.offline') : S.polling ? t('conn.polling', { s: POLL_MS / 1000 }) : t('conn.live')}"></span>
      ${isAdmin() ? `<button class="icon-btn" data-action="logout" title="${t('nav.signOut')}" aria-label="${t('nav.signOut')}">${icon('logout')}</button>` : ''}
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
      <span class="eyebrow">${e.status === 'done' ? t('home.finalResults') : t('home.roundOf', { round: roundTitle(r), total: e.rounds, stage: roundStage(e, r) })}</span>
      <h1>${esc(e.name)}</h1>
      ${roundTrack(e, r)}
    </div>
    ${statTiles(e, done)}
  </section>
  ${e.status === 'live' ? `<section class="section anim">
    <div class="section-head"><h2>${e.matches.some((m) => m.status === 'live') ? livePill() : ''} ${t('home.onTables')}</h2>
      <a class="btn ghost sm" href="#/schedule">${icon('grid')} ${t('home.fullSchedule')}</a></div>
    ${tablesStrip(e, r)}
  </section>` : ''}
  <section class="section anim">
    <div class="section-head"><h2>${t('home.standings')}</h2><span class="muted small">${t('home.standingsHint', { n: e.advance })}</span></div>
    <div class="standings-grid">${[0, 1].map((g) => standingsCard(e, g)).join('')}</div>
  </section>
  <section class="section anim">
    <div class="section-head"><h2>${t('home.road')}</h2></div>
    ${knockoutView(e)}
  </section>
  <section class="section anim">
    <div class="section-head"><h2>${t('home.leaders')}</h2></div>
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
    segs.push(`<span class="seg-r ${state} ${i > e.groupRounds ? 'ko' : ''}" title="${roundTitle(i)} · ${roundStage(e, i)}" style="--fill:${Math.round(share * 100)}%"><i></i><b>${i}</b></span>`);
  }
  return `<div class="round-track" aria-label="${t('rounds')}">${segs.join('')}</div>
    <div class="track-legend"><span>${stageName('group')}</span><span class="ko">${t('stage.knockout')}</span></div>`;
}

function statTiles(e, done) {
  const finished = e.matches.filter((m) => m.winner && m.startedAt && m.finishedAt);
  const avg = finished.length ? finished.reduce((s, m) => s + (m.finishedAt - m.startedAt), 0) / finished.length : 0;
  const tile = (key, value, label, ic) =>
    `<div class="stat"><span class="stat-ic">${icon(ic)}</span><b><span data-count="${key}">${value}</span></b><span>${label}</span></div>`;
  return `<div class="stat-tiles">
    ${tile('matches', done, t('stats.matches', { n: e.matches.length }), 'flag')}
    ${tile('balls', e.matches.reduce((n, m) => n + m.potted.length, 0), t('stats.balls'), 'target')}
    ${tile('eights', e.matches.filter((m) => m.potted.includes(8)).length, t('stats.eights'), 'zap')}
    <div class="stat"><span class="stat-ic">${icon('clock')}</span><b>${avg ? fmt(avg) : '—'}</b><span>${t('stats.avg')}</span></div>
  </div>`;
}

const restingChips = (resting) => resting.map((x) => x.ids.map((id) => `<span class="rest-chip g${x.g}">${esc(teamName(id))}</span>`).join('')).join('');

/** Read-only mini tables for the round in play. */
function tablesStrip(e, r) {
  const tiles = [];
  for (let tb = 1; tb <= e.tables; tb++) {
    const m = matchAt(r, tb);
    tiles.push(m ? miniTable(m) : `<div class="mini-table open"><span class="mt-num">${t('table', { n: tb })}</span><span class="muted">${t('openPlay')}</span></div>`);
  }
  const resting = restingIn(e, r);
  return `<div class="tables-strip">${tiles.join('')}</div>
    ${resting.length ? `<p class="resting-line">${icon('pause')} ${t('resting')}: ${restingChips(resting)}</p>` : ''}`;
}

function miniTable(m) {
  const row = (s) => {
    const left = ballsLeft(m, s);
    const g = groupOf(m, s);
    const cls = m.winner === s ? 'win' : m.winner ? 'lose' : '';
    return `<div class="mt-row ${cls}">
      ${m[s] ? avatar(teamName(m[s]), 'sm') : '<span class="avatar sm ghost">?</span>'}
      <div class="mt-who"><span class="mt-name truncate">${esc(slotName(m, s))}</span>
        ${g ? `<span class="mt-balls">${GROUPS[g].balls.map((n) => matchBall(m, n, 12)).join('')}</span>` : `<span class="mt-sub truncate">${m[s] ? esc(memberLine(m[s])) : ''}</span>`}</div>
      <span class="mt-left">${m.winner === s ? icon('trophy') : left === null ? '' : `<b>${left}</b><small>${t('left')}</small>`}</span>
    </div>`;
  };
  return `<div class="mini-table felt st-${m.status} ${S.fx.finished.has(m.id) ? 'just-won' : ''} ${S.fx.started.has(m.id) ? 'kick' : ''}" data-mid="${m.id}">
    <div class="mt-head"><span class="mt-num">${t('table', { n: m.table })}</span><span class="mt-tag">${m.stage === 'group' ? groupName(m.group) : stageName(m.stage)}</span>${statusTag(m)}</div>
    ${row('a')}${row('b')}
    ${m.potted.includes(8) ? `<span class="mt-eight">${ball(8, 18)}</span>` : ''}
  </div>`;
}

function standingsCard(e, g) {
  const rows = e.standings[g] ?? [];
  const body = rows
    .map((row, i) => {
      const tb = row.tiebreak ? `<abbr class="tb" title="${t(row.tiebreak === 'h2h' ? 'tb.h2hTitle' : 'tb.ballsTitle')}">${row.tiebreak === 'h2h' ? 'H2H' : '±'}</abbr>` : '';
      return `<tr class="${i < e.advance ? 'adv' : ''} ${i === e.advance - 1 ? 'cut' : ''}" data-flip="st-${row.id}">
        <td class="pos"><span>${row.place}</span></td>
        <td class="team-cell"><div class="tc-wrap">${avatar(teamName(row.id), 'sm')}<div class="min0"><div class="truncate b">${esc(teamName(row.id))} ${tb}</div><div class="truncate muted xs">${esc(memberLine(row.id))}</div></div></div></td>
        <td>${row.played}</td><td>${row.wins}</td><td>${row.losses}</td>
        <td class="${row.diff > 0 ? 'pos-diff' : row.diff < 0 ? 'neg-diff' : ''}">${row.diff > 0 ? '+' : ''}${row.diff}</td>
        <td class="pts"><b>${row.points}</b></td>
      </tr>`;
    })
    .join('');
  return `<div class="card standings">
    <div class="card-head"><h3>${groupName(g)}</h3><span class="muted small">${plural(rows.length, 'team')}</span></div>
    <div class="table-scroll"><table class="st-table">
      <thead><tr><th>#</th><th class="left">${t('st.team')}</th><th title="${t('st.playedT')}">${t('st.played')}</th><th title="${t('st.wonT')}">${t('st.won')}</th><th title="${t('st.lostT')}">${t('st.lost')}</th><th title="${t('st.diffT')}">+/−</th><th>${t('st.pts')}</th></tr></thead>
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
      return `<div class="ko-col"><div class="ko-title">${stage === 'final' ? t('stage.finals') : stageName(stage)}</div>
        <div class="ko-matches">${ms.map(koCard).join('')}</div></div>`;
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
  const label = m.stage === 'third' ? stageName('third') : m.stage === 'final' ? t('championship') : shortLabel(m);
  return `<div class="ko-card st-${m.status} ${m.stage}" data-mid="${m.id}">
    <div class="ko-head"><span>${label} · T${m.table}</span>${statusTag(m)}</div>
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
  if (!list.length) return emptyState(t('leaders.emptyTitle'), t('leaders.emptyBody'), 9);
  const top = (key, fmtValue, asc = false) =>
    list
      .filter((x) => x[key] !== null && x[key] > 0)
      .sort((x, y) => (asc ? x[key] - y[key] : y[key] - x[key]))
      .slice(0, 3)
      .map((x, i) => `<li><span class="rank r${i + 1}">${i + 1}</span>${avatar(teamName(x.id), 'sm')}<span class="truncate">${esc(teamName(x.id))}</span><b>${fmtValue(x[key])}</b></li>`)
      .join('') || '<li class="muted">—</li>';
  const card = (ic, title, body) => `<div class="card leader"><div class="leader-head">${icon(ic)}<h3>${title}</h3></div>${body}</div>`;
  return `<div class="leaders">
    ${card('trophy', t('leaders.wins'), `<ol>${top('wins', (v) => v)}</ol>`)}
    ${card('target', t('leaders.cleared'), `<ol>${top('cleared', (v) => v)}</ol>`)}
    ${card('zap', t('leaders.fastest'), `<ol>${top('fastest', fmt, true)}</ol>`)}
    ${card('flag', t('leaders.margin'), margin && margin.diff > 0
      ? `<div class="margin"><b>${esc(teamName(margin.m[margin.m.winner]))}</b><span class="muted small">${t('leaders.beat', { loser: esc(teamName(margin.m[other(margin.m.winner)])), balls: plural(margin.diff, 'ball') })}</span></div>`
      : `<p class="muted small">${t('leaders.trackBalls')}</p>`)}
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
      <span class="eyebrow gold">${t('champions')}</span>
      <h2>${esc(teamName(id))}</h2>
      <p class="muted">${esc(memberLine(id))}</p>
      <div class="podium-line">
        ${runnerUp ? `<span>${pill(t('place.2'), 'muted xs')} ${esc(teamName(runnerUp))}</span>` : ''}
        ${third ? `<span>${pill(t('place.3'), 'muted xs')} ${esc(teamName(third[third.winner]))}</span>` : ''}
      </div>
    </div>
    <div class="champion-ball">${ball(8, 84, false, 'float')}</div>
  </section>`;
}

function historySection() {
  const h = S.state.history;
  if (!h.length) return '';
  return `<section class="section anim">
    <div class="section-head"><h2>${t('hall.title')}</h2><span class="muted small">${plural(h.length, 'pastTournament')}</span></div>
    <div class="hall">${h
      .map((x) => `<div class="hall-item">
        ${CROWN}
        <div class="min0"><div class="b truncate">${esc(x.podium[0]?.name ?? '—')}</div>
          <div class="muted xs truncate">${esc(x.podium[0]?.members.join(' & ') ?? '')}</div></div>
        <div class="hall-meta"><span class="truncate">${esc(x.name)}</span><span>${x.completedAt ? new Date(x.completedAt).toLocaleDateString(locale()) : ''}</span></div>
      </div>`)
      .join('')}</div>
  </section>`;
}

/** Before the start: the teams, the format and the last champions. */
function setupHome(e) {
  const teams = S.state.teams;
  const format = e.preview
    ? t('setup.format', { teams: plural(teams.length, 'team'), rounds: e.rounds, tables: e.tables, hours: (Math.round((e.rounds * e.clockMinutes) / 6) / 10).toLocaleString(locale()) })
    : t('setup.formatFew', { teams: plural(teams.length, 'team') });
  return `
  <section class="hero anim">
    <div class="hero-copy">
      <span class="eyebrow">${t('setup.eyebrow')}</span>
      <h1>${esc(e.name)}<br><span class="grad">${t('setup.soon')}</span></h1>
      <p class="lead">${format}. ${t('setup.lead')}</p>
      <div class="hero-actions">
        <a class="btn primary" href="#/schedule">${icon('grid')} ${t('setup.seeSchedule')}</a>
        <a class="btn ghost" href="#/rules">${icon('book')} ${t('setup.houseRules')}</a>
      </div>
    </div>
    <div class="hero-rack" aria-hidden="true">${[[1], [9, 2], [10, 8, 3], [11, 4, 12, 5], [6, 13, 7, 14, 15]]
      .map((row, i) => `<div class="hr-row" style="--r:${i}">${row.map((n) => ball(n, 46)).join('')}</div>`)
      .join('')}</div>
  </section>
  <section class="section anim">
    <div class="section-head"><h2>${t('teams')}</h2>${isAdmin() ? `<a class="btn ghost sm" href="#/admin">${icon('gear')} ${t('setup.manageTeams')}</a>` : ''}</div>
    ${teams.length
      ? `<div class="team-grid">${teams
          .map((tm) => {
            const g = e.preview ? (e.groups[0].includes(tm.id) ? 0 : 1) : null;
            return `<div class="team-card">${avatar(tm.name, 'lg')}<div class="min0"><div class="b truncate">${esc(tm.name)}</div>
              <div class="muted small truncate">${esc(memberLine(tm.id))}</div></div>${g !== null ? `<span class="pill ${g ? 'blue' : 'green'} xs">G${g + 1}</span>` : ''}</div>`;
          })
          .join('')}</div>`
      : emptyState(t('teams.emptyTitle'), t('teams.emptyPublic'), 9)}
  </section>
  ${historySection()}`;
}

/* =====================================================================
   Schedule grid: rounds × tables, plus who is resting
   ===================================================================== */

function scheduleView() {
  const e = E();
  if (!e.matches.length) {
    return `<div class="page-head anim"><div><span class="eyebrow">${t('nav.schedule')}</span><h1>${t('sched.ahead')}</h1></div></div>
      ${emptyState(t('sched.emptyTitle'), t('sched.emptyBody'), 3)}`;
  }
  const cur = e.status === 'live' ? currentRound(e) : null;
  const tables = Array.from({ length: e.tables }, (_, i) => i + 1);
  const groupOfTable = (tb) => matchAt(1, tb)?.group;
  const head = `<div class="sh corner">${t('sched.round')}</div>${tables
    .map((tb) => {
      const g = groupOfTable(tb);
      return `<div class="sh g${g ?? 'x'}"><b>${t('table', { n: tb })}</b><small>${g === undefined ? t('stage.knockout') : groupName(g)}</small></div>`;
    })
    .join('')}<div class="sh rest"><b>${t('sched.resting')}</b><small>${t('sched.bye')}</small></div>`;

  const rows = [];
  for (let r = 1; r <= e.rounds; r++) {
    if (r === e.groupRounds + 1) rows.push(`<div class="sched-divider"><span>${icon('trophy')} ${t('stage.knockout')}</span></div>`);
    const at = e.startedAt ? ` · ${clockTime(e.startedAt + (r - 1) * e.clockMinutes * 60000)}` : ` · +${(r - 1) * e.clockMinutes} min`;
    const isCur = r === cur;
    rows.push(`<div class="sr-label ${isCur ? 'now' : ''}" style="--row:${r}"><b>${t('sched.r', { n: r })}</b><small>${roundStage(e, r)}${at}</small>${isCur ? `<span class="now-tag">${t('sched.now')}</span>` : ''}</div>`);
    for (const tb of tables) {
      const m = matchAt(r, tb);
      rows.push(m ? schedCell(e, m, isCur) : `<div class="cell open ${isCur ? 'now' : ''}" style="--row:${r}"><span>${t('openPlay')}</span></div>`);
    }
    const resting = restingIn(e, r);
    rows.push(`<div class="cell rest ${isCur ? 'now' : ''}" style="--row:${r}">${resting.length ? restingChips(resting) : `<span class="muted xs">${r > e.groupRounds ? '—' : t('sched.nobody')}</span>`}</div>`);
  }

  return `
  <div class="page-head anim">
    <div><span class="eyebrow">${e.preview ? t('sched.preview') : t('nav.schedule')}</span><h1>${esc(e.name)}</h1>
      <div class="meta-row"><span>${icon('clock')} ${t('sched.meta', { rounds: e.rounds, min: e.clockMinutes })}</span><span>${icon('grid')} ${plural(e.tables, 'table')}</span><span>${icon('users')} ${plural(e.groups.flat().length, 'team')}</span></div></div>
    <div class="legend"><span class="lg g0">${groupName(0)}</span><span class="lg g1">${groupName(1)}</span><span class="lg ko">${t('stage.knockout')}</span><span class="lg live">${t('status.live')}</span></div>
  </div>
  ${e.preview ? `<p class="notice anim">${icon('alert')} ${t('sched.previewNote')}</p>` : ''}
  <div class="sched-scroll anim" data-scroll-id="sched">
    <div class="sched" style="--tables:${e.tables}">${head}${rows.join('')}</div>
  </div>`;
}

function schedCell(e, m, isCur) {
  const row = (s) => {
    const cls = m.winner === s ? 'win' : m.winner ? 'lose' : !m[s] ? 'tbd' : '';
    const left = ballsLeft(m, s);
    const score = m.winner === s ? icon('check') : m.status !== 'ready' && m.status !== 'waiting' && left !== null ? `<small>${left}</small>` : '';
    return `<div class="c-team ${cls}"><span class="truncate">${esc(slotName(m, s))}</span>${score}</div>`;
  };
  const tone = m.stage === 'group' ? `g${m.group}` : 'ko';
  const clickable = isAdmin() && !e.preview;
  const stage = m.stage === 'group' ? '' : `<span class="c-stage">${m.stage === 'final' ? `${CROWN} ${t('championship')}` : m.stage === 'third' ? stageName('third') : shortLabel(m)}</span>`;
  return `<${clickable ? 'button type="button"' : 'div'} class="cell match ${tone} st-${m.status} ${isCur ? 'now' : ''} ${S.fx.finished.has(m.id) ? 'just-won' : ''}" style="--row:${m.round}" data-mid="${m.id}" ${clickable ? `data-action="goto-round" data-round="${m.round}" title="${t('sched.openInControl')}"` : ''}>
    ${stage}
    ${row('a')}<span class="c-vs">${t('vs')}</span>${row('b')}
    <div class="c-foot">${statusTag(m)}</div>
  </${clickable ? 'button' : 'div'}>`;
}

/* =====================================================================
   Rules: basics, and the full rulebook with a glossary
   ===================================================================== */

function rulesView(sub) {
  const tab = sub === 'full' ? 'full' : 'basics';
  const tabLink = (id, href, ic, label) => `<a class="tab ${tab === id ? 'on' : ''}" href="${href}" role="tab" aria-selected="${tab === id}">${icon(ic)}<span>${label}</span></a>`;
  return `
  <div class="admin-head anim">
    <div><span class="eyebrow">${t('rules.eyebrow')}</span><h1>${t('rules.title')}</h1>
      <p class="lead">${tab === 'full' ? t('rules.leadFull') : t('rules.lead')}</p></div>
    <div class="tabs" role="tablist">
      ${tabLink('basics', '#/rules', 'target', t('rules.tabBasics'))}
      ${tabLink('full', '#/rules/full', 'book', t('rules.tabFull'))}
    </div>
  </div>
  ${tab === 'full' ? rulebookView() : basicsView()}`;
}

function basicsView() {
  const e = E();
  const clock = e.clockMinutes || 15;
  const rule = (ic, key, vars = {}) => `<div class="rule anim"><span class="rule-ic">${icon(ic)}</span><div><h3>${t(`rules.${key}.t`, vars)}</h3><p>${t(`rules.${key}.b`, vars)}</p></div></div>`;
  return `
  <section class="rules-section">
    <h2 class="anim">${t('rules.onTable')}</h2>
    <div class="rules">
      ${rule('target', 'open')}
      ${rule('hand', 'call8')}
      ${rule('check', 'legal')}
      ${rule('alert', 'fouls')}
      ${rule('zap', 'lose8')}
    </div>
  </section>

  <section class="rules-section">
    <h2 class="anim">${t('rules.tournament')}</h2>
    <div class="format anim">
      <div class="fmt-step g0"><span class="fmt-k">${t('rules.fmt.r1')}</span><b>${stageName('group')}</b><p>${t('rules.fmt.group')}</p>
        <div class="fmt-balls">${[1, 2, 3, 4, 5].map((n) => ball(n, 18)).join('')}</div></div>
      <span class="fmt-arrow">${icon('arrowRight')}</span>
      <div class="fmt-step ko"><span class="fmt-k">${roundTitle(6)}</span><b>${stageName('qf')}</b><p>${t('rules.fmt.qf')}</p></div>
      <span class="fmt-arrow">${icon('arrowRight')}</span>
      <div class="fmt-step ko"><span class="fmt-k">${roundTitle(7)}</span><b>${stageName('sf')}</b><p>${t('rules.fmt.sf')}</p></div>
      <span class="fmt-arrow">${icon('arrowRight')}</span>
      <div class="fmt-step gold"><span class="fmt-k">${roundTitle(8)}</span><b>${stageName('final')}</b><p>${t('rules.fmt.final')}</p>${CROWN}</div>
    </div>
    <div class="rules">
      ${rule('clock', 'clock', { min: clock })}
      ${rule('trophy', 'standings')}
      ${rule('flag', 'diff')}
      ${rule('grid', 'schedule', { rounds: e.rounds || 8, min: clock, tables: e.tables || 4 })}
    </div>
    <a class="btn ghost mt anim" href="#/rules/full">${icon('book')} ${t('rules.toFull')}</a>
  </section>`;
}

function rulebookView() {
  const lang = S.lang;
  const sections = RULEBOOK.map((s) => ({ id: s.id, icon: s.icon, ...s[lang] }));
  const terms = GLOSSARY.map((g) => ({ term: g[lang][0], def: g[lang][1], alt: g[lang === 'nl' ? 'en' : 'nl'][0] })).sort((a, b) => a.term.localeCompare(b.term, locale()));
  const byLetter = new Map();
  for (const x of terms) {
    const letter = x.term[0].toUpperCase();
    if (!byLetter.has(letter)) byLetter.set(letter, []);
    byLetter.get(letter).push(x);
  }
  const item = (text) => {
    const house = text.startsWith('!');
    return `<li class="${house ? 'house' : ''}">${house ? `<span class="house-tag">${t('rules.houseTag')}</span>` : ''}${house ? text.slice(1) : text}</li>`;
  };
  const toc = `${sections.map((s, i) => `<button class="toc-link" data-action="jump" data-target="sec-${s.id}"><span class="toc-n">${i + 1}</span>${s.title}</button>`).join('')}
    <button class="toc-link gloss" data-action="jump" data-target="glossary">${icon('book')}${t('gloss.title')}</button>`;
  return `
  <div class="rulebook">
    <aside class="rb-toc anim"><div class="toc-head">${t('rules.contents')}</div>${toc}
      <p class="toc-legend"><span class="house-tag">${t('rules.houseTag')}</span> ${t('rules.houseLegend')}</p></aside>
    <div class="rb-body">
      ${sections
        .map((s, i) => `<section class="rb-sec anim" id="sec-${s.id}">
          <h2><span class="rb-ic">${icon(s.icon)}</span><span class="rb-n">${i + 1}.</span> ${s.title}</h2>
          <ul class="rb-list">${s.items.map(item).join('')}</ul>
        </section>`)
        .join('')}
      <section class="rb-sec glossary anim" id="glossary">
        <div class="gl-head">
          <h2><span class="rb-ic">${icon('book')}</span>${t('gloss.title')}</h2>
          <label class="gl-search">${icon('search')}<input id="gloss-q" type="search" data-filter="glossary" placeholder="${t('gloss.search', { n: terms.length })}" value="${esc(S.glossQuery)}" autocomplete="off"></label>
        </div>
        <p class="muted small gl-hint">${t('gloss.hint')}</p>
        <div class="gl-letters">${[...byLetter.keys()].map((l) => `<button class="gl-letter" data-action="jump" data-target="gl-${l}">${l}</button>`).join('')}</div>
        ${[...byLetter.entries()]
          .map(([l, list]) => `<div class="gl-group" id="gl-${l}"><div class="gl-l">${l}</div><dl>${list
            .map((x) => `<div class="gl-item" data-text="${esc(`${x.term} ${x.alt} ${x.def}`.toLowerCase().replace(/<[^>]+>/g, ''))}"><dt>${x.term}${x.alt && x.alt !== x.term ? ` <span class="gl-alt">${x.alt}</span>` : ''}</dt><dd>${x.def}</dd></div>`)
            .join('')}</dl></div>`)
          .join('')}
        <p class="gl-none muted" hidden>${t('gloss.none')}</p>
      </section>
    </div>
  </div>`;
}

/** Hides glossary entries that don't match the search, without re-rendering. */
function filterGlossary() {
  const q = S.glossQuery.trim().toLowerCase();
  const items = $app.querySelectorAll('.gl-item');
  if (!items.length) return;
  let shown = 0;
  items.forEach((el) => {
    const hit = !q || el.dataset.text.includes(q);
    el.hidden = !hit;
    if (hit) shown += 1;
  });
  $app.querySelectorAll('.gl-group').forEach((g) => (g.hidden = !g.querySelector('.gl-item:not([hidden])')));
  $app.querySelector('.gl-letters')?.toggleAttribute('hidden', Boolean(q));
  $app.querySelector('.gl-none')?.toggleAttribute('hidden', shown > 0);
}

/* =====================================================================
   Admin
   ===================================================================== */

function adminView() {
  if (!isAdmin()) {
    return `<div class="center-wrap"><div class="card auth-card narrow anim">
      <div class="auth-icon">${icon('shield')}</div>
      <h2>${t('admin.signInTitle')}</h2>
      <p class="muted">${t('admin.signInBody')}</p>
      <form data-form="admin-login" class="stack">
        <label class="field"><span>${t('admin.password')}</span><input id="admin-pass" name="password" type="password" required autocomplete="current-password"></label>
        <button class="btn primary block" type="submit">${t('admin.signIn')}</button>
      </form>
    </div></div>`;
  }
  const e = E();
  const tab = S.adminTab || (e.status === 'setup' ? 'teams' : 'tables');
  const tabBtn = (id, label, ic, badge = '') =>
    `<button class="tab ${tab === id ? 'on' : ''}" data-action="tab" data-tab="${id}" role="tab" aria-selected="${tab === id}">${icon(ic)}<span>${label}</span>${badge}</button>`;
  const liveCount = e.status === 'live' ? e.matches.filter((m) => m.status === 'live').length : 0;
  const body = { tables: tablesPanel, teams: teamsPanel, event: eventPanel, ai: aiPanel }[tab](e);
  return `
  <div class="admin-head anim">
    <div><span class="eyebrow">${t('admin.eyebrow')}</span><h1>${esc(e.name)}</h1></div>
    <div class="tabs" role="tablist">
      ${tabBtn('tables', t('admin.tabTables'), 'grid', liveCount ? `<span class="tab-badge">${liveCount}</span>` : '')}
      ${tabBtn('teams', t('teams'), 'users', `<span class="tab-count">${S.state.teams.length}</span>`)}
      ${tabBtn('event', t('admin.tabEvent'), 'gear')}
      ${tabBtn('ai', t('admin.tabAi'), 'spark')}
    </div>
  </div>
  ${body}`;
}

/* ---------------------------------------------------------------- Teams */

function teamsPanel(e) {
  const teams = S.state.teams;
  const setup = e.status === 'setup';
  const groups = e.groups.length ? e.groups : [teams.map((tm) => tm.id)];
  const block = (ids, g) => {
    const list = ids.map((id) => teams.find((tm) => tm.id === id)).filter(Boolean);
    return `<div class="team-block">
      ${e.groups.length ? `<div class="tb-head g${g}"><span>${groupName(g)}</span><span class="muted xs">${plural(list.length, 'team')}</span></div>` : ''}
      ${list.map((tm) => teamRow(tm, teams.indexOf(tm), teams.length, setup)).join('')}
    </div>`;
  };
  return `
  <div class="panel-bar anim">
    <div class="pb-copy">${setup
      ? `<b>${plural(teams.length, 'team')}</b><span class="muted small">${e.preview ? t('teams.groupsHint', { n: e.groups[0].length }) : t('teams.needFour')}</span>`
      : `<b>${t('teams.locked')}</b><span class="muted small">${t('teams.lockedHint')}</span>`}</div>
    ${setup ? `<div class="btn-row">
      <button class="btn ghost" data-action="team-shuffle" ${teams.length < 2 ? 'disabled' : ''}>${icon('shuffle')} ${t('teams.shuffle')}</button>
      <button class="btn primary" data-action="team-add">${icon('plus')} ${t('teams.add')}</button>
    </div>` : ''}
  </div>
  ${teams.length ? `<div class="team-list anim">${groups.map(block).join('')}</div>` : emptyState(t('teams.emptyTitle'), t('teams.emptyAdmin'), 9, `<button class="btn primary" data-action="team-add">${icon('plus')} ${t('teams.addFirst')}</button>`)}
  ${setup && teams.length ? `<button class="add-row anim" data-action="team-add">${icon('plus')} ${t('teams.addAnother')}</button>` : ''}`;
}

function teamRow(tm, i, total, setup) {
  const members = tm.members
    .map(
      (m, k) => `<div class="member ${m.active ? '' : 'off'}">
        <input class="inline-input" id="mn-${tm.id}-${k}" data-edit="member-name" data-id="${tm.id}" data-index="${k}" value="${esc(m.name)}" maxlength="24" aria-label="${t('teams.playerN', { n: k + 1 })}" autocomplete="off">
        <label class="mini-switch" title="${m.active ? t('teams.playing') : t('teams.disabled')}">
          <input type="checkbox" data-edit="member-active" data-id="${tm.id}" data-index="${k}" ${m.active ? 'checked' : ''} aria-label="${t('teams.isPlaying', { name: esc(m.name) })}"><span class="track"></span>
        </label>
      </div>`,
    )
    .join('');
  return `<div class="team-row" data-flip="team-${tm.id}">
    <span class="seed">${i + 1}</span>
    ${avatar(tm.name)}
    <input class="inline-input team-name" id="tn-${tm.id}" data-edit="team-name" data-id="${tm.id}" value="${esc(tm.name)}" maxlength="24" aria-label="${t('teams.teamName')}" autocomplete="off">
    <div class="members">${members}</div>
    ${setup ? `<div class="row-actions">
      <button class="icon-btn" data-action="team-move" data-id="${tm.id}" data-by="-1" ${i === 0 ? 'disabled' : ''} title="${t('teams.up')}" aria-label="${t('teams.up')}">${icon('arrowUp')}</button>
      <button class="icon-btn" data-action="team-move" data-id="${tm.id}" data-by="1" ${i === total - 1 ? 'disabled' : ''} title="${t('teams.down')}" aria-label="${t('teams.down')}">${icon('arrowDown')}</button>
      <button class="icon-btn danger" data-action="team-del" data-id="${tm.id}" title="${t('teams.remove')}" aria-label="${t('teams.remove')}">${icon('trash')}</button>
    </div>` : ''}
  </div>`;
}

/* ---------------------------------------------------------------- Tournament settings */

function eventPanel(e) {
  const setup = e.status === 'setup';
  const teams = S.state.teams.length;
  const known = e.preview || !setup;
  const summary = known
    ? `<ol class="fmt-list">
        <li>${t('ev.fmtGroups', { teams: plural(e.groups.flat().length, 'team'), a: e.groups[0].length, b: e.groups[1].length })}</li>
        <li>${t('ev.fmtRounds', { n: e.groupRounds })}</li>
        <li>${t('ev.fmtKo', { n: e.advance, stages: t(e.advance === 4 ? 'ev.koQf' : 'ev.koSf'), third: e.thirdPlace ? t('ev.plusThird') : '' })}</li>
        <li>${t('ev.fmtTotal', { rounds: e.rounds, tables: e.tables, min: e.rounds * e.clockMinutes })}</li>
      </ol>`
    : `<p class="muted">${t('ev.needFour')}</p>`;
  return `
  <div class="admin-grid anim">
    <div class="card">
      <div class="card-head"><h3>${t('ev.settings')}</h3></div>
      <form data-form="event" class="stack">
        <label class="field"><span>${t('ev.name')}</span><input id="ev-name" name="name" required maxlength="60" value="${esc(e.name)}"></label>
        <label class="field"><span>${t('ev.clock')}</span><input id="ev-clock" name="clockMinutes" type="number" min="0" max="180" step="0.5" value="${e.clockMinutes}"></label>
        <label class="switch ${setup ? '' : 'disabled'}">
          <input id="ev-third" name="thirdPlace" type="checkbox" ${e.thirdPlace ? 'checked' : ''} ${setup ? '' : 'disabled'}>
          <span class="track"></span>
          <span><b>${t('ev.third')}</b><br><span class="muted small">${t('ev.thirdHint')}${setup ? '' : ` ${t('ev.thirdLocked')}`}</span></span>
        </label>
        <button class="btn primary" type="submit">${icon('check')} ${t('save')}</button>
      </form>
    </div>
    <div class="card">
      <div class="card-head"><h3>${t('ev.format')}</h3>${e.status === 'live' ? livePill(t('ev.running')) : e.status === 'done' ? pill(t('ev.finished'), 'gold') : pill(t('ev.setup'), 'blue')}</div>
      ${summary}
      <div class="btn-row mt">
        ${setup
          ? `<button class="btn primary big" data-action="event-start" ${teams < 4 ? 'disabled' : ''}>${icon('play')} ${t('ev.start')}</button>`
          : `<button class="btn ghost danger-text" data-action="event-reset">${icon('rotate')} ${e.status === 'done' ? t('ev.new') : t('ev.reset')}</button>`}
      </div>
    </div>
    ${aiSettingsCard()}
  </div>`;
}

function aiSettingsCard() {
  const a = S.ai.status;
  if (!a) return '';
  return `<div class="card">
    <div class="card-head"><h3>${t('ai.settings')}</h3>${a.hasKey ? pill('•••• ' + esc(a.keyHint), 'green') : ''}</div>
    ${a.weakPassword ? `<p class="ai-warn">${icon('alert')}<span>${t('ai.weak')}</span></p>` : ''}
    <form data-form="ai-settings" class="stack" autocomplete="off">
      <label class="field"><span>${t('ai.key')}</span><input id="ai-key" name="apiKey" type="password" autocomplete="new-password" spellcheck="false" maxlength="200" placeholder="${t('ai.keyNew')}" ${a.weakPassword ? 'disabled' : ''}></label>
      <p class="muted small">${a.hasKey ? `${t('ai.keySaved', { hint: esc(a.keyHint) })} ` : ''}${t('ai.keyHelp')}</p>
      <p class="muted small">${t('ai.usage', { n: a.today, max: a.dailyLimit })}</p>
      <label class="field"><span>${t('ai.model')}</span><input id="ai-model" name="model" maxlength="64" spellcheck="false" value="${esc(a.model)}"></label>
      <div class="btn-row">
        <button class="btn primary" type="submit">${icon('check')} ${t('save')}</button>
        ${a.hasKey ? `<button class="btn ghost danger-text" type="button" data-action="ai-key-del">${icon('trash')} ${t('ai.keyRemove')}</button>` : ''}
      </div>
    </form>
  </div>`;
}

/* ---------------------------------------------------------------- Ask Gemini */

function aiPanel() {
  const a = S.ai;
  if (!a.status) return `<div class="loading">${t('loading')}</div>`;
  if (!a.status.hasKey && !a.chats.length) {
    return emptyState(t('ai.noKeyTitle'), t('ai.noKeyBody'), 3, `<button class="btn primary" data-action="tab" data-tab="event">${icon('gear')} ${t('ai.goSettings')}</button>`);
  }
  const { open } = a;
  const list = a.chats.length
    ? a.chats.map((c) => `<div class="ai-chat ${c.id === open.id ? 'on' : ''}">
        <button class="ai-chat-open" data-action="ai-open" data-id="${c.id}"><span class="truncate">${esc(c.title)}</span><small>${aiWhen(c.updatedAt)}</small></button>
        <button class="icon-btn danger" data-action="ai-del" data-id="${c.id}" title="${t('ai.delete')}" aria-label="${t('ai.delete')}">${icon('trash')}</button>
      </div>`).join('')
    : `<p class="muted small">${t('ai.noChats')}</p>`;
  const bubbles = open.messages.map((m) => `<div class="ai-msg ${m.role}">
      <span class="ai-who">${m.role === 'user' ? t('ai.you') : `${icon('spark')} Gemini`}</span>
      <div class="ai-text">${m.role === 'user' ? esc(m.text).replace(/\n/g, '<br>') : markdown(m.text)}</div>
    </div>`).join('');
  const intro = `<div class="ai-intro"><span class="auth-icon">${icon('spark')}</span><h2>${t('ai.introTitle')}</h2><p class="muted">${t('ai.introBody')}</p></div>`;
  return `<div class="ai anim">
    <aside class="ai-side">
      <button class="btn primary block" data-action="ai-new">${icon('plus')} ${t('ai.new')}</button>
      <div class="ai-list" data-scroll-id="ai-list">${list}</div>
    </aside>
    <section class="ai-main">
      <div class="ai-log" data-scroll-id="ai-log" aria-live="polite">
        ${open.messages.length ? '' : intro}
        <p class="ai-attached">${icon('book')} ${t('ai.attached', { sections: a.status.sections, terms: a.status.terms })}</p>
        ${bubbles}
        ${open.pending ? `<div class="ai-msg model"><span class="ai-who">${icon('spark')} Gemini</span><div class="ai-text ai-dots" role="status" aria-label="${t('ai.thinking')}"><i></i><i></i><i></i></div></div>` : ''}
      </div>
      ${a.status.hasKey
        ? `<form data-form="ai-send" class="ai-compose">
            <textarea id="ai-input" name="message" rows="2" maxlength="4000" placeholder="${t('ai.placeholder')}" aria-label="${t('ai.placeholder')}">${esc(a.draft)}</textarea>
            <button class="btn primary" type="submit" ${a.sending ? 'disabled' : ''}>${icon('arrowRight')} ${t('ai.send')}</button>
            <p class="muted xs">${t('ai.hint')}</p>
          </form>`
        : `<div class="ai-compose"><p class="muted small">${t('ai.noKeyInline')}</p><button class="btn ghost" data-action="tab" data-tab="event">${icon('gear')} ${t('ai.goSettings')}</button></div>`}
    </section>
  </div>`;
}

function aiWhen(ts) {
  const d = new Date(ts);
  const today = d.toDateString() === new Date().toDateString();
  return today ? clockTime(ts) : d.toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
}

/** Gemini answers in Markdown. Everything is escaped first, and links are left out on purpose. */
function markdown(src) {
  const inline = (s) =>
    s
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>');
  const out = [];
  let list = null;
  let code = null;
  const closeList = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  for (const raw of esc(src).split('\n')) {
    if (raw.trim().startsWith('```')) {
      closeList();
      if (code) out.push(`<pre>${code.join('\n')}</pre>`);
      code = code ? null : [];
      continue;
    }
    if (code) {
      code.push(raw);
      continue;
    }
    const item = /^\s*(?:([-*+])|\d+[.)])\s+(.*)$/.exec(raw);
    const heading = /^#{1,6}\s+(.*)$/.exec(raw);
    if (item) {
      const kind = item[1] ? 'ul' : 'ol';
      if (list !== kind) {
        closeList();
        out.push(`<${kind}>`);
        list = kind;
      }
      out.push(`<li>${inline(item[2])}</li>`);
      continue;
    }
    closeList();
    if (heading) out.push(`<h4>${inline(heading[1])}</h4>`);
    else if (raw.trim()) out.push(`<p>${inline(raw)}</p>`);
  }
  closeList();
  if (code) out.push(`<pre>${code.join('\n')}</pre>`);
  return out.join('');
}

async function loadAi() {
  const a = S.ai;
  if (a.tried) return;
  a.tried = true;
  await run(async () => {
    const [status, list] = await Promise.all([api('GET', '/api/ai/settings'), api('GET', '/api/ai/chats')]);
    a.status = status;
    a.chats = list.chats;
  });
  if (a === S.ai) render();
}

async function aiRefreshList(a) {
  a.chats = (await api('GET', '/api/ai/chats')).chats;
}

async function aiSend() {
  const a = S.ai;
  const input = document.getElementById('ai-input');
  const text = input.value.trim();
  if (!text || a.sending) return;
  const chat = a.open;
  a.sending = true;
  chat.pending = true;
  a.draft = '';
  input.value = '';
  chat.messages.push({ role: 'user', text, at: Date.now() });
  a.stick = true;
  render();
  try {
    const res = chat.id
      ? await api('POST', `/api/ai/chats/${chat.id}/messages`, { message: text })
      : await api('POST', '/api/ai/chats', { message: text, lang: S.lang });
    chat.id = res.id;
    chat.messages = res.messages;
    await aiRefreshList(a);
  } catch (err) {
    chat.messages.pop();
    toast(err.message, 'error');
    if (a.open === chat) {
      a.draft = text; // nothing was saved, so give the question back
      const el = document.getElementById('ai-input');
      if (el && !el.value) el.value = text;
    }
  }
  a.sending = false;
  chat.pending = false;
  a.stick = a.open === chat;
  if (a === S.ai) render();
}

/* ---------------------------------------------------------------- Tables (control room) */

function selectedRound(e) {
  return S.adminRound && S.adminRound <= e.rounds ? S.adminRound : currentRound(e);
}

function tablesPanel(e) {
  if (e.status === 'setup') {
    return emptyState(t('tables.notStartedTitle'), t('tables.notStartedBody'), 3, `<button class="btn primary" data-action="tab" data-tab="event">${icon('play')} ${t('tables.goStart')}</button>`);
  }
  const r = selectedRound(e);
  const cur = currentRound(e);
  const cards = [];
  for (let tb = 1; tb <= e.tables; tb++) {
    const m = matchAt(r, tb);
    cards.push(m ? tableCard(m) : `<div class="tcard open"><span class="tc-num">${tb}</span><span class="muted">${t('openPlay')}</span></div>`);
  }
  const resting = restingIn(e, r);
  return `
  ${e.status === 'done' ? championBanner(e) : ''}
  ${roundBar(e, r, cur)}
  <div class="tcards">${cards.join('')}</div>
  ${resting.length ? `<p class="resting-line">${icon('pause')} ${t('tables.restingRound')}: ${restingChips(resting)}</p>` : ''}`;
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
  const startLabel = !idle.length ? t('tables.allRunning') : t(anyStarted ? 'tables.resume' : 'tables.start', { what: t(idle.length > 1 || !live.length ? 'tables.allTables' : 'tables.oneTable') });
  const status = playable.length
    ? t('tables.liveOf', { live: live.length, total: plural(playable.length, 'table') })
    : e.matches.filter((m) => m.round === r).every((m) => m.winner) ? t('tables.roundDone') : t('tables.waitingEarlier');
  return `<div class="roundbar anim">
    <div class="rb-top">
      <div class="rb-title"><span class="eyebrow">${roundStage(e, r)}</span><h2>${roundTitle(r)} <span class="muted">${t('tables.of', { n: e.rounds })}</span></h2></div>
      <div class="rchips" aria-label="${t('rounds')}">${chips.join('')}</div>
    </div>
    <div class="rb-bottom">
      <div class="rb-status">
        ${longest ? `<span class="clock md" data-timer="${longest.id}">${fmt(timeLeft(longest))}</span>` : ''}
        <span class="muted small">${status}</span>
        ${r !== cur ? `<button class="btn ghost sm" data-action="pick-round" data-round="">${icon('arrowRight')} ${t('tables.backTo', { n: cur })}</button>` : ''}
      </div>
      <div class="btn-row">
        <button class="btn primary" data-action="round" data-type="start" data-round="${r}" ${idle.length ? '' : 'disabled'}>${icon('play')} ${startLabel}</button>
        <button class="btn ghost" data-action="round" data-type="pause" data-round="${r}" ${live.length ? '' : 'disabled'}>${icon('pause')} ${t('tables.pauseAll')}</button>
        <button class="btn ghost" data-action="round" data-type="add" data-round="${r}" ${playable.length ? '' : 'disabled'}>${icon('plus')} ${t('tables.addAll')}</button>
      </div>
    </div>
  </div>`;
}

function tableCard(m) {
  const head = `<header class="tc-head">
    <span class="tc-num">${m.table}</span>
    <div class="tc-title"><b>${t('table', { n: m.table })}</b><small>${m.stage === 'group' ? groupName(m.group) : stageName(m.stage)}</small></div>
    ${m.status === 'live' && m.timer.durationMs ? livePill() : statusTag(m, '')}
    ${m.timer.durationMs ? `<span class="clock sm tc-clock" data-timer="${m.id}">${fmt(timeLeft(m))}</span>` : ''}
  </header>`;
  const fx = `${S.fx.finished.has(m.id) ? 'just-won' : ''} ${S.fx.started.has(m.id) ? 'kick' : ''}`;

  if (m.status === 'waiting') {
    return `<article class="tcard st-waiting" data-mid="${m.id}">${head}
      <div class="tc-wait"><span>${esc(slotName(m, 'a'))}</span><span class="c-vs">${t('vs')}</span><span>${esc(slotName(m, 'b'))}</span></div>
      <p class="muted small center-text">${t('tables.unlocks')}</p></article>`;
  }

  const teamRowHtml = (s) => {
    const left = ballsLeft(m, s);
    const g = groupOf(m, s);
    const cls = m.winner === s ? 'win' : m.winner ? 'lose' : '';
    return `<div class="tc-team ${cls}">
      ${avatar(teamName(m[s]))}
      <div class="min0"><div class="tc-name truncate">${esc(teamName(m[s]))}</div><div class="muted xs truncate">${esc(memberLine(m[s]))}</div></div>
      ${g ? groupChip(g) : ''}
      <div class="tc-left">${m.winner === s ? `<span class="tc-trophy">${icon('trophy')}</span>` : left === null ? '<b>–</b>' : `<b>${left}</b>`}<small>${m.winner === s ? t('winner') : t('left')}</small></div>
    </div>`;
  };

  if (m.status === 'done') {
    return `<article class="tcard st-done ${fx}" data-mid="${m.id}">${head}
      ${teamRowHtml('a')}${teamRowHtml('b')}
      <div class="tc-actions"><span class="muted small">${t(m.result === 'timeout' ? 'tables.decidedTime' : 'tables.over')} · ${t('tables.ballsDown', { n: m.potted.length })}</span>
        <button class="btn ghost sm" data-action="m" data-type="undo" data-id="${m.id}">${icon('undo')} ${t('undo')}</button></div>
    </article>`;
  }

  const A = esc(teamName(m.a));
  const rackGroup = (balls, g) => `<div class="tc-set">${balls.map((n) => `<button class="ball-btn ${m.potted.includes(n) ? 'in' : ''}" data-action="m" data-type="ball" data-id="${m.id}" data-ball="${n}" aria-pressed="${m.potted.includes(n)}" title="${t('ball.n', { n })}">${matchBall(m, n, 30)}</button>`).join('')}${g ? `<span class="set-owner">${esc(teamName(m[g]))}</span>` : ''}</div>`;
  const ownerOf = (group) => (m.groupA ? (m.groupA === group ? 'a' : 'b') : null);
  const live = m.status === 'live';
  return `<article class="tcard st-${m.status} ${fx}" data-mid="${m.id}">${head}
    ${teamRowHtml('a')}${teamRowHtml('b')}
    <div class="tc-groups">
      <button class="seg-btn ${m.groupA === 'solids' ? 'on' : ''}" data-action="m" data-type="groups" data-id="${m.id}" data-group="solids">${ball(1, 16)}<span class="truncate">${A}: ${suitName('solids')}</span></button>
      <button class="seg-btn ${m.groupA ? '' : 'on'}" data-action="m" data-type="groups" data-id="${m.id}" data-group="">${t('tables.open')}</button>
      <button class="seg-btn ${m.groupA === 'stripes' ? 'on' : ''}" data-action="m" data-type="groups" data-id="${m.id}" data-group="stripes">${ball(9, 16)}<span class="truncate">${A}: ${suitName('stripes')}</span></button>
    </div>
    <div class="tc-rack felt">
      ${rackGroup(SOLIDS, ownerOf('solids'))}
      <button class="ball-btn eight-btn ${m.potted.includes(8) ? 'in' : ''}" data-action="m" data-type="ball" data-id="${m.id}" data-ball="8" aria-pressed="${m.potted.includes(8)}" title="${t('ball.eight')}">${matchBall(m, 8, 40)}</button>
      ${rackGroup(STRIPES, ownerOf('stripes'))}
    </div>
    <div class="tc-actions">
      <div class="btn-row">
        ${live
          ? `<button class="btn ghost sm" data-action="m" data-type="pause" data-id="${m.id}">${icon('pause')} ${t('pause')}</button>`
          : `<button class="btn primary sm" data-action="m" data-type="start" data-id="${m.id}">${icon('play')} ${t(m.startedAt ? 'resume' : 'start')}</button>`}
        <button class="btn ghost sm" data-action="m" data-type="add" data-id="${m.id}" title="${t('tables.addMinute')}">${icon('plus')} 1</button>
        <button class="icon-btn" data-action="m-more" data-id="${m.id}" title="${t('tables.more')}" aria-label="${t('tables.more')}">${icon('gear')}</button>
      </div>
      <div class="btn-row winners">
        <button class="btn win sm" data-action="m-winner" data-id="${m.id}" data-slot="a">${icon('trophy')}<span class="truncate">${A}</span></button>
        <button class="btn win sm" data-action="m-winner" data-id="${m.id}" data-slot="b">${icon('trophy')}<span class="truncate">${esc(teamName(m.b))}</span></button>
      </div>
    </div>
    <p class="tc-warn">${icon('clock')} ${t('tables.timeUpWarn')}</p>
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

function confirmDialog({ title, body, confirmLabel = t('confirm'), danger = false }) {
  return new Promise((resolve) => {
    const done = (ok) => {
      closeModal();
      resolve(ok);
    };
    openModal(
      `<h2>${esc(title)}</h2><p class="muted">${esc(body)}</p>
       <div class="modal-actions">
         <button class="btn ghost" data-choice="no">${t('cancel')}</button>
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
      return `<button class="choice" data-choice="${s}">${avatar(teamName(m[s]), 'lg')}<span>${esc(teamName(m[s]))}</span>${left !== null ? `<small class="muted">${t('modal.ballsLeft', { balls: plural(left, 'ball') })}</small>` : ''}</button>`;
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
  if (a === null) return t('timeup.open');
  if (a === b) return t('timeup.tied', { n: a });
  const lead = a < b ? 'a' : 'b';
  return t('timeup.lead', { team: esc(teamName(m[lead])), min: Math.min(a, b), max: Math.max(a, b) });
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
    title: t('timeup.title', { n: m.table }),
    body: ballVerdict(m),
    kind: 'timeup',
    iconName: 'clock',
    extras: [['later', t('timeup.later')], ['extend', `${icon('plus')} ${t('timeup.extend')}`]],
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
    `<h2>${t('table', { n: m.table })}</h2><p class="muted">${esc(teamName(m.a))} ${t('vs')} ${esc(teamName(m.b))}</p>
     <form class="inline-form" data-modal-form>
       <label class="field grow"><span>${t('more.clock')}</span><input name="minutes" type="number" min="0" max="180" step="0.5" value="${m.timer.durationMs / 60000}"></label>
       <button class="btn ghost" type="submit">${t('more.setClock')}</button>
     </form>
     <div class="modal-list">
       <button class="btn ghost block" data-choice="reset">${icon('rotate')} ${t('more.resetClock')}</button>
       <button class="btn ghost block danger-text" data-choice="restart">${icon('undo')} ${t('more.restart')}</button>
     </div>
     <div class="modal-actions"><button class="btn ghost" data-choice="close">${t('close')}</button></div>`,
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
          const ok = await confirmDialog({ title: t('more.restartTitle'), body: t('more.restartBody'), confirmLabel: t('more.restartOk'), danger: true });
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
    const step = (time) => {
      const k = Math.min(1, (time - start) / 700);
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
  const [name, sub] = location.hash.replace(/^#\/?/, '').split(/[?]/)[0].split('/');
  return { name: ['schedule', 'rules', 'admin'].includes(name) ? name : 'home', sub };
}

function view(r) {
  if (!S.state) return `<div class="loading">${ball(8, 48)}<span>${t('loading')}</span></div>`;
  if (r.name === 'admin') return adminView();
  if (r.name === 'schedule') return scheduleView();
  if (r.name === 'rules') return rulesView(r.sub);
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
  const scroll = [...$app.querySelectorAll('[data-scroll-id]')].map((el) => [el.dataset.scrollId, el.scrollLeft, el.scrollTop]);
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
  for (const [id, left, top] of scroll) {
    const el = $app.querySelector(`[data-scroll-id="${id}"]`);
    if (!el) continue;
    el.scrollLeft = left;
    el.scrollTop = top;
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
  document.documentElement.lang = S.lang;
  $nav.innerHTML = navView(r);
  $app.innerHTML = view(r);
  if (snapshot) restoreUi(snapshot);
  if (S.ai.stick) {
    S.ai.stick = false;
    const log = $app.querySelector('.ai-log');
    if (log) log.scrollTop = log.scrollHeight;
  }
  if (isAdmin() && r.name === 'admin') loadAi();
  S.renderedKey = S.state ? location.hash : null; // the loading screen doesn't count as having entered
  filterGlossary();

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
    case 'lang':
      S.lang = d.lang;
      writeStored('pm_lang', d.lang);
      return render();
    case 'logout':
      await api('POST', '/api/logout').catch(() => {});
      setSession(null, { role: null });
      return toast(t('toast.signedOut'));
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
    case 'jump': {
      const target = document.getElementById(d.target);
      return target?.scrollIntoView({ behavior: REDUCED_MOTION ? 'auto' : 'smooth', block: 'start' });
    }

    // Gemini
    case 'ai-new':
      if (S.ai.open.id) S.ai.open = { id: null, messages: [] }; // only a blank page: the chat starts with the first question
      render();
      return document.getElementById('ai-input')?.focus();
    case 'ai-open': {
      const a = S.ai;
      const chat = { id: d.id, messages: [] };
      a.open = chat;
      render();
      const res = await api('GET', `/api/ai/chats/${d.id}`);
      if (a.open !== chat) return;
      chat.messages = res.messages;
      a.stick = true;
      return render();
    }
    case 'ai-del': {
      const a = S.ai;
      const title = a.chats.find((c) => c.id === d.id)?.title ?? '';
      const ok = await confirmDialog({ title: t('ai.deleteTitle'), body: t('ai.deleteBody', { title: esc(title) }), confirmLabel: t('ai.deleteOk'), danger: true });
      if (!ok) return;
      await api('DELETE', `/api/ai/chats/${d.id}`);
      if (a.open.id === d.id) a.open = { id: null, messages: [] };
      await aiRefreshList(a);
      return render();
    }
    case 'ai-key-del': {
      const ok = await confirmDialog({ title: t('ai.keyRemoveTitle'), body: t('ai.keyRemoveBody'), confirmLabel: t('ai.keyRemove'), danger: true });
      if (!ok) return;
      S.ai.status = await api('DELETE', '/api/ai/key');
      toast(t('toast.aiKeyRemoved'));
      return render();
    }

    // Teams
    case 'team-add': {
      const res = await api('POST', '/api/teams', {});
      S.focusAfter = `tn-${res.id}`;
      return;
    }
    case 'team-del': {
      const ok = await confirmDialog({ title: t('teams.removeTitle', { name: teamName(d.id) }), body: t('teams.removeBody'), confirmLabel: t('teams.removeOk'), danger: true });
      if (ok) await api('DELETE', `/api/teams/${d.id}`);
      return;
    }
    case 'team-move':
      return api('POST', `/api/teams/${d.id}/move`, { by: Number(d.by) });
    case 'team-shuffle': {
      const ok = await confirmDialog({ title: t('teams.shuffleTitle'), body: t('teams.shuffleBody'), confirmLabel: t('teams.shuffle') });
      if (ok) await api('POST', '/api/teams/shuffle');
      return;
    }

    // Tournament
    case 'event-start': {
      const ok = await confirmDialog({ title: t('ev.startTitle'), body: t('ev.startBody', { teams: plural(S.state.teams.length, 'team') }), confirmLabel: t('ev.start') });
      if (!ok) return;
      await api('POST', '/api/event/start');
      S.adminTab = 'tables';
      S.adminRound = null;
      writeStored('pm_tab', 'tables');
      return toast(t('toast.started'), 'success');
    }
    case 'event-reset': {
      const done = e.status === 'done';
      const ok = await confirmDialog({
        title: t(done ? 'ev.newTitle' : 'ev.resetTitle'),
        body: t(done ? 'ev.newBody' : 'ev.resetBody'),
        confirmLabel: t(done ? 'ev.new' : 'ev.resetOk'),
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
        const ok = await confirmDialog({ title: t('undoTitle'), body: t('undoBody'), confirmLabel: t('undoOk') });
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
        title: t('winnerTitle', { team: teamName(m[d.slot]) }),
        body: t(m.stage === 'group' ? 'winnerBodyGroup' : 'winnerBodyKo'),
        confirmLabel: t('winnerOk'),
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
    title: t('eight.title', { n: m.table }),
    body: t('eight.body'),
    kind: 'eight',
    iconName: 'zap',
    extras: [['undo', `${icon('undo')} ${t('eight.putBack')}`], ['later', t('eight.notYet')]],
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
      return toast(t('toast.adminOn'), 'success');
    }
    case 'event':
      await api('PATCH', '/api/event', {
        name: data.get('name'),
        clockMinutes: data.get('clockMinutes'),
        thirdPlace: data.get('thirdPlace') === 'on',
      });
      return toast(t('toast.saved'), 'success');
    case 'ai-settings': {
      const input = document.getElementById('ai-key');
      S.ai.status = await api('PUT', '/api/ai/settings', { apiKey: data.get('apiKey') || undefined, model: data.get('model') });
      input.value = '';
      render();
      return toast(t('toast.aiSaved'), 'success');
    }
    case 'ai-send':
      return aiSend();
  }
}

/** Inline edits save when the field loses focus (or on Enter). */
function saveInline(el) {
  if (!el.isConnected || el.value === el.defaultValue) return;
  const { id, index } = el.dataset;
  const value = el.value.trim();
  if (!value) {
    el.value = el.defaultValue;
    return toast(t('toast.emptyName'), 'error');
  }
  const url = el.dataset.edit === 'team-name' ? `/api/teams/${id}` : `/api/teams/${id}/members/${index}`;
  el.defaultValue = value; // don't save twice if focus moves around
  run(() => api('PATCH', url, { name: value }));
}

document.addEventListener('focusout', (e) => {
  if (e.target.matches?.('input[data-edit$="-name"]')) saveInline(e.target);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.target.id === 'ai-input') {
    e.preventDefault();
    e.target.form.requestSubmit();
  }
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

document.addEventListener('input', (e) => {
  if (e.target.id === 'ai-input') S.ai.draft = e.target.value;
  if (e.target.dataset?.filter === 'glossary') {
    S.glossQuery = e.target.value;
    filterGlossary();
  }
});

window.addEventListener('hashchange', () => {
  const r = route();
  if (r.name === 'rules') {
    S.rulesTab = r.sub === 'full' ? 'full' : 'basics';
    writeStored('pm_rules', S.rulesTab);
  }
  render();
  window.scrollTo(0, 0);
});

/* =====================================================================
   Session & live connection
   ===================================================================== */

function setSession(token, me) {
  S.token = token;
  S.me = me;
  S.ai = emptyAi(); // chats never outlive the session
  writeStored('pm_token', token);
  render();
}

function applyState(state) {
  S.fx = diffState(S.state, state);
  S.state = state;
  S.offset = state.serverTime - Date.now();
  S.teams = new Map(state.teams.map((tm) => [tm.id, tm]));
  S.online = true;
  render();
}

function markOffline() {
  S.online = false;
  $nav.querySelector('.conn')?.classList.remove('on');
}

/** Live updates over SSE; falls back to polling when nothing arrives (some proxies block streams). */
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
