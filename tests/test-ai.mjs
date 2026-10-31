// Worker /ai/chat test: auth gate, privacy scrubbing, tool filtering, daily limit, error handling. Run: node tests/test-ai.mjs
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, '../worker/otp-worker.js'), 'utf8').replace(/^import .*cloudflare:sockets.*$/m, 'const connect = () => { throw new Error("no sockets in test"); };');
const tmp = path.join(os.tmpdir(), 'worker-ai-test.mjs'); fs.writeFileSync(tmp, src);

const PROJECT = 'event-management-cfc44';
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
const b64u = b => Buffer.from(b).toString('base64url');
const token = (sub = 'uid-1') => { const now = Math.floor(Date.now() / 1000);
  const h = b64u(JSON.stringify({ alg: 'RS256', kid: 'k1', typ: 'JWT' })), p = b64u(JSON.stringify({ aud: PROJECT, iss: 'https://securetoken.google.com/' + PROJECT, sub, iat: now - 10, exp: now + 3600 }));
  return h + '.' + p + '.' + b64u(crypto.sign('RSA-SHA256', Buffer.from(h + '.' + p), privateKey)); };

let gemini = null, geminiReq = null;
globalThis.fetch = async (u, o) => {
  u = String(u);
  if (u.includes('securetoken@system.gserviceaccount.com')) return new Response(JSON.stringify({ keys: [jwk] }), { status: 200 });
  if (u.startsWith('https://generativelanguage.googleapis.com/')) { geminiReq = { url: u, headers: o.headers, body: JSON.parse(o.body) }; return gemini(); }
  throw new Error('unexpected fetch ' + u);
};
const logs = []; for (const k of ['log', 'error', 'warn']) console[k] = (...a) => logs.push(a.join(' '));
const say = (...a) => process.stdout.write(a.join(' ') + '\n');

const worker = (await import(pathToFileURL(tmp).href)).default;
const kv = new Map();
const env = { FIREBASE_PROJECT_ID: PROJECT, ALLOWED_ORIGINS: 'https://cem.example', GEMINI_API_KEY: 'AQ.test-key-123', AI_DAILY_LIMIT: '3',
  OTP_KV: { get: async k => kv.get(k) ?? null, put: async (k, v) => { kv.set(k, v); } } };
const call = async (body, { tok = token(), origin = 'https://cem.example', e = env } = {}) => {
  const r = await worker.fetch(new Request('https://w.example/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: JSON.stringify(body) }), e);
  return { s: r.status, j: await r.json() };
};
const reply = parts => () => new Response(JSON.stringify({ candidates: [{ content: { role: 'model', parts } }] }), { status: 200 });
const ctx = { today: '2026-11-01', allow: ['assign_task', 'add_shopping_item'], people: [{ t: 'P1', role: 'Volunteer' }], event: { name: 'Tech Fest', type: 'Fest', date: '2026-11-10', time: '10:00', venue: 'Main hall', cap: 200 }, groups: ['Logistics'], questions: ['Full name'] };
let n = 0; const ok = m => say('  ok ' + (++n) + ' ' + m);

// auth
assert.equal((await call({ contents: [] }, { tok: '' })).s, 401); ok('no token -> 401');
assert.equal((await call({ contents: [] }, { origin: 'https://evil.example' })).s, 403); ok('unknown site -> 403');
assert.equal((await call({ contents: [{ role: 'user', text: 'hi' }], ctx }, { e: { ...env, GEMINI_API_KEY: '' } })).s, 503); ok('no key configured -> 503, friendly message');

// happy path + privacy
gemini = reply([{ text: 'Here is a draft.' }, { functionCall: { name: 'assign_task', args: { title: 'Print posters', assignee: 'P1', due_date: '2026-11-05' } } },
  { functionCall: { name: 'write_event_description', args: { description: 'not allowed for this user' } } }]);
const secret = 'Mail rahul.s@college.edu or call 9876543210, pay to rahul@okhdfc, aadhaar 1234 5678 9012, see https://x.example/a?b=1. Budget 500 on 2026-11-05 500';
let r = await call({ ctx, contents: [{ role: 'user', text: secret }] });
assert.equal(r.s, 200); assert.equal(r.j.ok, true); assert.equal(r.j.calls.length, 1); assert.equal(r.j.calls[0].name, 'assign_task'); assert.equal(r.j.left, 2);
ok('proposal returned; a function the user may not use is dropped; allowance counted');
const sent = JSON.stringify(geminiReq.body);
for (const bad of ['rahul.s@college.edu', '9876543210', 'rahul@okhdfc', '1234 5678 9012', 'x.example']) assert.ok(!sent.includes(bad), 'leaked ' + bad);
assert.ok(sent.includes('Budget 500 on 2026-11-05 500'), 'amounts and dates must survive scrubbing');
ok('emails, phone, UPI id, ID number and links never reach Gemini; amounts and dates are kept');
assert.equal(geminiReq.headers['x-goog-api-key'], 'AQ.test-key-123'); assert.ok(geminiReq.url.includes('/models/gemini-3.8-flash:generateContent')); assert.ok(!geminiReq.url.includes('key='));
ok('key travels in the x-goog-api-key header (not the URL); default model is gemini-3.8-flash');
const names = geminiReq.body.tools[0].functionDeclarations.map(f => f.name).sort(); assert.deepEqual(names, ['add_shopping_item', 'assign_task']);
assert.ok(!('thinkingConfig' in geminiReq.body.generationConfig)); assert.match(geminiReq.body.systemInstruction.parts[0].text, /P1 \(Volunteer\)/);
ok('only the allowed functions are offered; no thinkingConfig (so the "minimal" error cannot happen)');

// no tools when nothing is allowed
await call({ ctx: { ...ctx, allow: [] }, contents: [{ role: 'user', text: 'hi' }] }); assert.ok(!geminiReq.body.tools); ok('viewer role -> no tools offered');
// bad shapes
assert.equal((await call({ ctx, contents: [{ role: 'model', text: 'only me' }] })).s, 400); ok('conversation must end with a user turn -> 400');
// limit: 3 allowed, 2 used so far (the proposal call and the viewer call)
assert.equal((await call({ ctx, contents: [{ role: 'user', text: 'third' }] })).s, 200);
assert.equal((await call({ ctx, contents: [{ role: 'user', text: 'fourth' }] })).s, 429); ok('daily limit enforced -> 429 on the 4th message');
assert.equal((await call({ ctx, contents: [{ role: 'user', text: 'x' }] }, { tok: token('uid-2') })).s, 200); ok('limit is per user');
assert.ok([...kv.keys()].every(k => /^ai:[0-9a-f]{16}:\d{4}-\d{2}-\d{2}$/.test(k)) && ![...kv.keys()].some(k => k.includes('uid-')) && ![...kv.values()].some(v => /[a-z]/i.test(v)));
ok('KV holds only a hashed id and a number, no text');

// errors from Gemini
kv.clear(); gemini = () => new Response(JSON.stringify({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'quota for: ' + secret } }), { status: 429 });
r = await call({ ctx, contents: [{ role: 'user', text: secret }] }); assert.equal(r.s, 429); assert.match(r.j.message, /wait a minute/); ok('Gemini free-rate limit -> friendly 429');
gemini = () => new Response(JSON.stringify({ error: { code: 401, status: 'UNAUTHENTICATED', message: 'echo ' + secret, details: [{ reason: 'ACCESS_TOKEN_TYPE_UNSUPPORTED' }] } }), { status: 401 });
r = await call({ ctx, contents: [{ role: 'user', text: secret }] }); assert.equal(r.s, 502); assert.ok(!JSON.stringify(r.j).includes('rahul'));
assert.ok(logs.some(l => l.includes('ACCESS_TOKEN_TYPE_UNSUPPORTED')) ); ok('key rejected -> 502 with admin hint; reason code logged');
assert.ok(!logs.join('\n').includes('rahul') && !logs.join('\n').includes('9876543210')); ok('no message text in any log line');
gemini = () => new Response(JSON.stringify({ candidates: [] }), { status: 200 });
assert.equal((await call({ ctx, contents: [{ role: 'user', text: 'hi' }] })).s, 502); ok('empty answer -> 502, not a crash');
assert.equal(kv.size, 0); ok('failed calls do not use up the daily allowance');
say('ALL ' + n + ' AI WORKER TESTS PASSED');
