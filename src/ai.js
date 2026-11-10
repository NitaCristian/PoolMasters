'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { DATA_DIR } = require('./store');
const { fail } = require('./errors');
const { STRINGS, RULEBOOK, GLOSSARY } = require('../public/i18n');

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = 'gemini-3.8-flash';
// Tried in turn when the chosen model is overloaded. Older models are busy less often.
const FALLBACK_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash-lite'];
const TIMEOUT_MS = 40 * 1000; // one attempt; a model that hangs this long counts as busy
const ASK_BUDGET_MS = 90 * 1000; // all attempts together, so the admin never waits minutes
const BUSY = 'Gemini is very busy right now. Try again in a minute.';
const SECRETS_FILE = path.join(DATA_DIR, 'secrets.json');

// ---------------------------------------------------------------- API key at rest

// The key lives in memory and, encrypted with the admin password, in its own file.
// It is never written to db.json and no route ever returns it.
let apiKey = null;

const cipherKey = (password, salt) => crypto.scryptSync(password, salt, 32);

function encrypt(text, password) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', cipherKey(password, salt), iv);
  const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return Object.fromEntries(Object.entries({ salt, iv, tag: cipher.getAuthTag(), data }).map(([k, v]) => [k, v.toString('base64')]));
}

function decrypt(box, password) {
  const [salt, iv, tag, data] = [box.salt, box.iv, box.tag, box.data].map((v) => Buffer.from(v, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', cipherKey(password, salt), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/** Reads the saved key. After a password change it can't be decrypted, so it has to be entered again. */
function loadKey(password) {
  try {
    apiKey = decrypt(JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf8')), password);
  } catch (err) {
    apiKey = null;
    if (err.code !== 'ENOENT') console.warn('[ai] The saved Gemini key could not be read. Enter it again in the admin settings.');
  }
}

function saveKey(key, password) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${SECRETS_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(encrypt(key, password)), { mode: 0o600 });
  fs.renameSync(tmp, SECRETS_FILE);
  apiKey = key;
}

function clearKey() {
  fs.rmSync(SECRETS_FILE, { force: true });
  apiKey = null;
}

const hasKey = () => Boolean(apiKey);
const keyHint = () => (apiKey ? apiKey.slice(-4) : null);

// ---------------------------------------------------------------- what Gemini knows

const plain = (html) => html.replace(/<[^>]+>/g, '');

/** The Basics tab of the rules page, as text. */
function basics(lang, clock) {
  const strings = STRINGS[lang];
  const fill = (s) => plain(s).replace(/\{\w+\}/g, (m) => (m === '{min}' ? clock : '')).trim();
  const rules = Object.keys(strings)
    .filter((key) => /^rules\.\w+\.t$/.test(key))
    .map((key) => `- ${fill(strings[key])}: ${fill(strings[key.replace(/t$/, 'b')])}`);
  const format = ['group', 'qf', 'sf', 'final'].map((key) => `- ${fill(strings[`rules.fmt.${key}`])}`);
  return [...rules, ...format].join('\n');
}

/** Sent with every request: the API keeps no memory, so this is what makes Gemini know our rules. */
function systemPrompt(lang, clock) {
  const book = RULEBOOK.map((section, i) => {
    const { title, items } = section[lang];
    const lines = items.map((item) => (item.startsWith('!') ? `- [HOUSE RULE] ${plain(item.slice(1))}` : `- ${plain(item)}`));
    return `### ${i + 1}. ${title}\n${lines.join('\n')}`;
  }).join('\n\n');
  const glossary = GLOSSARY.map((entry) => `- ${entry[lang][0]}: ${entry[lang][1]}`).join('\n');
  return `You help the admin of PoolMasters, a pool tournament for teams of two, to settle questions about the rules of 8-ball.

Below are the rules this tournament already uses. They are the final word:
- Answer from these rules first, and name the section you used.
- Items marked [HOUSE RULE] were chosen for this tournament and may differ from official rules. They still apply.
- If the rules below do not cover something, say so clearly, then give the usual rule (for example from the WPA) as a suggestion.
- If you think one of our rules is unclear or differs from the official rule, say so, but never pretend it says something else.
- Keep answers short and practical: the admin is usually standing at the table.
- Reply in the language of the admin's latest message.

## Quick rules
${basics(lang, clock)}

## Full rulebook
${book}

## Glossary
${glossary}`;
}

const rulesInfo = () => ({ sections: RULEBOOK.length, terms: GLOSSARY.length });

// ---------------------------------------------------------------- talking to Gemini

/** Never passes Google's own error text on: we show our own message and nothing about the request. */
async function request(url, { key, timeoutMs = TIMEOUT_MS, ...options }, rejected) {
  let res;
  let data;
  try {
    res = await fetch(url, {
      ...options,
      headers: { ...options.headers, 'x-goog-api-key': key ?? apiKey }, // a header, because URLs end up in logs
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
    });
    data = await res.json().catch(() => ({}));
  } catch (err) {
    if (err.name === 'TimeoutError') fail(503, BUSY);
    fail(502, 'Could not reach Gemini. Try again.');
  }
  if (res.ok) return data;
  if (res.status === 400 && /thinking/i.test(data.error?.message ?? '')) fail(422, 'thinking'); // see generate()
  if (res.status === 401 || res.status === 403 || /api.key/i.test(data.error?.message ?? '')) fail(502, rejected);
  if (res.status === 429) fail(429, 'Gemini is busy or the key is out of quota. Try again in a minute.');
  if (res.status === 404) fail(502, 'Gemini does not know that model. Check the model name in the settings.');
  if (res.status === 503 || res.status === 500) fail(503, BUSY);
  fail(502, 'Gemini could not answer. Try again.');
}

/** A cheap call that only succeeds with a working key. */
function verifyKey(key) {
  return request(`${API_BASE}/models?pageSize=1`, { key }, 'Gemini rejected this API key.');
}

/** Google often answers 503 "high demand" or hangs: then the fallback models are tried in turn. */
async function ask(model, system, messages) {
  const attempts = [model, ...FALLBACK_MODELS.filter((m) => m !== model)];
  const deadline = Date.now() + ASK_BUDGET_MS;
  for (const [i, attempt] of attempts.entries()) {
    const left = deadline - Date.now();
    if (left < 5000) break;
    try {
      return await generate(attempt, system, messages, Math.min(TIMEOUT_MS, left));
    } catch (err) {
      if (err.status !== 503 || i === attempts.length - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  return fail(503, BUSY);
}

// Costs: the hidden "thinking" is billed like an answer. Low thinking cut it from ~300 to ~100 tokens
// per question with the same answers, and halved the wait. The cap stops a runaway answer.
const GENERATION = { maxOutputTokens: 2048, thinkingConfig: { thinkingLevel: 'low' } };

async function generate(model, system, messages, timeoutMs, generationConfig = GENERATION) {
  let data;
  try {
    data = await request(
      `${API_BASE}/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        timeoutMs,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
          generationConfig,
        }),
      },
      'Gemini rejected the API key. Check it in the settings.',
    );
  } catch (err) {
    // A model without a thinking setting rejects it: ask again without.
    if (err.status === 422) return generate(model, system, messages, timeoutMs, { maxOutputTokens: GENERATION.maxOutputTokens });
    throw err;
  }
  const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim();
  return text || fail(502, 'Gemini returned no answer. Try rephrasing the question.');
}

module.exports = { DEFAULT_MODEL, loadKey, saveKey, clearKey, hasKey, keyHint, systemPrompt, rulesInfo, verifyKey, ask };
