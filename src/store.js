'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const VERSION = 2;

const newEvent = (prev = {}) => ({
  name: prev.name ?? 'Pool Night',
  status: 'setup', // -> 'live' -> 'done'
  clockMinutes: prev.clockMinutes ?? 15,
  thirdPlace: prev.thirdPlace ?? true,
  tableCount: prev.tableCount ?? 4, // tables at the venue; the schedule fits into these
  groups: [],
  groupRounds: 0,
  rounds: 0,
  tables: 0,
  advance: 0,
  matches: [],
  championId: null,
  startedAt: null,
  completedAt: null,
});

const empty = () => ({
  version: VERSION,
  sessions: {},
  teams: [], // [{ id, name, members: [{ name, active }], createdAt }] — order = seed
  event: newEvent(),
  history: [], // finished nights: { name, completedAt, podium: [{ name, members }], ... }
  ai: { model: null }, // Gemini settings; the API key is NOT here (see src/ai.js)
  chats: [], // admin only, never in the public state: { id, title, lang, createdAt, updatedAt, messages: [{ role, text, at }] }
});

/** Moves a file we will not use out of the way, so it is never overwritten. */
function setAside(label) {
  const backup = path.join(DATA_DIR, `db.${label}-${Date.now()}.json`);
  fs.renameSync(DB_FILE, backup);
  return backup;
}

function load() {
  let raw;
  try {
    raw = fs.readFileSync(DB_FILE, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return empty();
    throw err;
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    console.error(`[store] db.json was unreadable; moved it to ${setAside('corrupt')} and started fresh.`);
    return empty();
  }
  if (data.version !== VERSION) {
    // v1 had players, PINs and brackets — nothing that maps onto teams. Keep it for reference.
    console.warn(`[store] db.json is from an older version; moved it to ${setAside(`v${data.version ?? 1}`)} and started fresh.`);
    return empty();
  }
  return { ...empty(), ...data, event: { ...newEvent(), ...data.event } };
}

function write(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

let pending = null;

function save(db) {
  clearTimeout(pending);
  pending = setTimeout(() => write(db), 150);
}

function flush(db) {
  clearTimeout(pending);
  write(db);
}

module.exports = { load, save, flush, newEvent, DB_FILE, DATA_DIR };
