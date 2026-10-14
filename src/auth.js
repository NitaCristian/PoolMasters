'use strict';

const crypto = require('node:crypto');
const { fail } = require('./errors');

const MAX_FAILURES = 5;
const LOCK_MS = 5 * 60 * 1000;

const normalize = (raw) => String(raw ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');

/** Returns the cleaned display name, or null when it is not allowed. */
function cleanName(raw) {
  const name = normalize(raw);
  const ok = name.length >= 2 && name.length <= 24 && /^[\p{L}\p{N} ._'-]+$/u.test(name);
  return ok ? name : null;
}

/** Case-insensitive key used to enforce unique names ("Eddie" == "eddie"). */
const nameKey = (raw) => normalize(raw).toLowerCase();

const validPin = (pin) => /^\d{4,6}$/.test(String(pin ?? ''));

function hashPin(pin) {
  const pinSalt = crypto.randomBytes(16).toString('hex');
  const pinHash = crypto.scryptSync(String(pin), pinSalt, 32).toString('hex');
  return { pinSalt, pinHash };
}

function checkPin(pin, player) {
  const actual = crypto.scryptSync(String(pin ?? ''), player.pinSalt, 32);
  return crypto.timingSafeEqual(actual, Buffer.from(player.pinHash, 'hex'));
}

function safeEqual(a, b) {
  const digest = (s) => crypto.createHash('sha256').update(String(s)).digest();
  return crypto.timingSafeEqual(digest(a), digest(b));
}

const newId = () => crypto.randomBytes(6).toString('base64url');
const newToken = () => crypto.randomBytes(24).toString('base64url');

// In-memory brute-force protection: 5 wrong attempts locks the key for 5 minutes.
const failures = new Map();

function assertNotLocked(key) {
  const f = failures.get(key);
  if (f && f.lockedUntil > Date.now()) {
    const minutes = Math.ceil((f.lockedUntil - Date.now()) / 60000);
    fail(429, `Too many wrong attempts. Try again in ${minutes} min.`);
  }
}

function recordFailure(key) {
  const f = failures.get(key) ?? { count: 0, lockedUntil: 0 };
  f.count += 1;
  if (f.count >= MAX_FAILURES) {
    f.count = 0;
    f.lockedUntil = Date.now() + LOCK_MS;
  }
  failures.set(key, f);
}

const clearFailures = (key) => failures.delete(key);

module.exports = {
  cleanName,
  nameKey,
  validPin,
  hashPin,
  checkPin,
  safeEqual,
  newId,
  newToken,
  assertNotLocked,
  recordFailure,
  clearFailures,
};
