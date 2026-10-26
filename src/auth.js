'use strict';

const crypto = require('node:crypto');
const { fail } = require('./errors');

const MAX_FAILURES = 5;
const LOCK_MS = 5 * 60 * 1000;

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

module.exports = { safeEqual, newId, newToken, assertNotLocked, recordFailure, clearFailures };
