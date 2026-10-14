'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const empty = () => ({
  version: 1,
  settings: { requirePin: true },
  players: {},
  sessions: {},
  tournaments: {},
});

function load() {
  let raw;
  try {
    raw = fs.readFileSync(DB_FILE, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return empty();
    throw err;
  }
  try {
    const data = JSON.parse(raw);
    return { ...empty(), ...data, settings: { ...empty().settings, ...data.settings } };
  } catch {
    // Never silently overwrite a file we could not parse — keep it for recovery.
    const backup = path.join(DATA_DIR, `db.corrupt-${Date.now()}.json`);
    fs.renameSync(DB_FILE, backup);
    console.error(`[store] db.json was unreadable; moved it to ${backup} and started fresh.`);
    return empty();
  }
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

module.exports = { load, save, flush, DB_FILE };
