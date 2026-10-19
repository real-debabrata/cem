import { SMTPServer } from 'smtp-server';
import { simpleParser } from 'mailparser';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const PROJECT = 'event-management-cfc44';
// ---- fake Google keys + token signer
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
const b64u = b => Buffer.from(b).toString('base64url');
function token(over = {}, key = privateKey, kid = 'k1') {
  const now = Math.floor(Date.now() / 1000);
  const claims = Object.assign({ aud: PROJECT, iss: 'https://securetoken.google.com/' + PROJECT, sub: 'uid-organiser', iat: now - 10, exp: now + 3600, email: 'o@college.edu' }, over);
  const h = b64u(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' })), p = b64u(JSON.stringify(claims));
  const sig = crypto.sign('RSA-SHA256', Buffer.from(h + '.' + p), key);
  return h + '.' + p + '.' + b64u(sig);
}
const realFetch = globalThis.fetch;
globalThis.fetch = async (u, o) => String(u).includes('securetoken@system.gserviceaccount.com')
  ? new Response(JSON.stringify({ keys: [jwk] }), { status: 200 }) : realFetch(u, o);

// ---- fake mail servers
const got = [];
const onAuth = (a, s, cb) => (a.username === 'organiser@college.edu' && a.password === 'apppassword1234') ? cb(null, { user: 1 }) : cb(new Error('Invalid login'));
const handlers = {
  onAuth,
  onRcptTo(addr, s, cb) { addr.address.startsWith('bad@') ? cb(Object.assign(new Error('Mailbox unavailable'), { responseCode: 550 })) : cb(); },
  onData(stream, s, cb) { simpleParser(stream).then(m => { got.push(m); cb(); }); }
};
const mk = o => new Promise(r => { const s = new SMTPServer({ logger: false, ...handlers, ...o }); s.listen(o.port, '127.0.0.1', () => r(s)); });
const servers = [
  await mk({ port: 587, secure: false }),                                  // STARTTLS
  await mk({ port: 465, secure: true }),                                   // implicit TLS
  await mk({ port: 2525, secure: false, disabledCommands: ['STARTTLS'], allowInsecureAuth: true })  // no encryption offered
];

// ---- load the worker
const worker = (await import('./worker-under-test.mjs')).default;
const kv = new Map();
const env = { FIREBASE_SA: JSON.stringify({ client_email: 'x@y', private_key: 'k', project_id: PROJECT }), ALLOWED_ORIGINS: 'https://cem.example', OTP_KV: { get: async k => kv.get(k) ?? null, put: async (k, v) => { kv.set(k, v); } } };
const call = (path, body, { tok = token(), origin = 'https://cem.example', e = env } = {}) =>
  worker.fetch(new Request('https://w.example' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: JSON.stringify(body) }), e).then(async r => ({ s: r.status, j: await r.json() }));

const good = { host: 'smtp.college.example', port: 587, user: 'organiser@college.edu', pass: 'apppassword1234' };
let n = 0; const ok = (name) => console.log('  ok ' + (++n) + ' ' + name);

// 1 auth gate
assert.equal((await call('/mail/verify', { smtp: good }, { tok: '' })).s, 401); ok('no token -> 401');
assert.equal((await call('/mail/verify', { smtp: good }, { tok: token({}, other.privateKey) })).s, 401); ok('token signed with a different key -> 401');
assert.equal((await call('/mail/verify', { smtp: good }, { tok: token({ exp: Math.floor(Date.now() / 1000) - 5 }) })).s, 401); ok('expired token -> 401');
assert.equal((await call('/mail/verify', { smtp: good }, { tok: token({ aud: 'someone-else' }) })).s, 401); ok('token for another Firebase project -> 401');
assert.equal((await call('/mail/verify', { smtp: good }, { origin: 'https://evil.example' })).s, 403); ok('site not in ALLOWED_ORIGINS -> 403');

// 2 verify
let r = await call('/mail/verify', { smtp: good }); assert.equal(r.s, 200); assert.ok(r.j.ok); ok('verify over STARTTLS (587) logs in');
r = await call('/mail/verify', { smtp: { ...good, port: 465 } }); assert.equal(r.s, 200); ok('verify over implicit TLS (465) logs in');
r = await call('/mail/verify', { smtp: { ...good, pass: 'wrong' } }); assert.equal(r.s, 401); assert.equal(r.j.stage, 'auth'); assert.match(r.j.message, /app password/); ok('wrong password -> friendly auth error: ' + r.j.message.slice(0, 50) + '...');
r = await call('/mail/verify', { smtp: { ...good, port: 2525 } }); assert.equal(r.j.stage, 'tls'); ok('server without encryption is refused, password never sent');
for (const bad of [{ host: 'localhost' }, { host: '127.0.0.1' }, { host: '10.0.0.5' }, { port: 25 }, { port: 22 }, { host: 'a b.com' }]) {
  r = await call('/mail/verify', { smtp: { ...good, ...bad } }); assert.equal(r.s, 400, JSON.stringify(bad));
}
ok('localhost / IP addresses / port 25 / port 22 rejected');

// 3 send
const png = crypto.randomBytes(300);   // stands in for a QR PNG
const msgs = [
  { to: 'asha@students.example', name: 'Asha Rao', subject: 'Your ticket for TechFest', text: 'Hi Asha,\n.hidden dot line\nBye', html: '<p>Hi Asha <img src="cid:ticket-qr@cem.local"></p>', qr: png.toString('base64') },
  { to: 'bad@students.example', name: 'Nope', subject: 'x', text: 'hello' },
  { to: 'zoë@students.example'.replace('ë', 'e'), name: 'Zoë Müller 日本', subject: 'Ticket ✓ für das Fest', text: 'Grüße\nTicket: https://cem.example/ticket.html#e=ABCDEF&r=xyz', html: '<b>hi</b>', qr: png.toString('base64') },
  { to: 'inj@students.example', name: 'Eve\r\nBcc: spy@evil.example', subject: 'Hello\r\nBcc: spy@evil.example', text: 'plain only' }
];
got.length = 0;
r = await call('/mail/send', { smtp: { ...good, port: 465 }, from: { email: 'organiser@college.edu', name: 'TechFest Team' }, messages: msgs });
assert.equal(r.s, 200, JSON.stringify(r.j)); assert.equal(r.j.sent, 3);
assert.deepEqual(r.j.results.map(x => x.ok), [true, false, true, true]); assert.match(r.j.results[1].error, /Mailbox unavailable/);
ok('batch of 4: 3 delivered, the refused mailbox is reported on its own, the rest carry on');
assert.equal(got.length, 3);
const a = got[0];
assert.equal(a.subject, 'Your ticket for TechFest'); assert.equal(a.to.value[0].name, 'Asha Rao'); assert.equal(a.to.value[0].address, 'asha@students.example');
assert.equal(a.from.value[0].name, 'TechFest Team'); assert.equal(a.from.value[0].address, 'organiser@college.edu');
assert.match(a.text, /\.hidden dot line/); assert.match(a.html, /cid:ticket-qr@cem\.local|data:image/);
assert.equal(a.attachments.length, 1); assert.equal(a.attachments[0].contentType, 'image/png'); assert.ok(a.attachments[0].content.equals(png)); assert.equal(a.attachments[0].cid, 'ticket-qr@cem.local');
ok('MIME parses: names, subject, text, HTML, inline QR image identical to what was sent, dot-stuffing intact');
const z = got[1];
assert.equal(z.subject, 'Ticket ✓ für das Fest'); assert.equal(z.to.value[0].name, 'Zoë Müller 日本'); assert.match(z.text, /Grüße/);
ok('non-English names and subjects survive (UTF-8 encoded headers)');
const inj = got[2];
assert.ok(!inj.headers.has('bcc')); assert.equal(inj.to.value.length, 1); assert.equal(inj.to.value[0].address, 'inj@students.example'); assert.ok(!/\n/.test(inj.subject)); assert.equal(inj.html, false);
ok('header injection through name or subject does not create a Bcc');
assert.equal(kv.get('mail:uid-organiser:' + new Date().toISOString().slice(0, 10)), '3'); ok('daily counter counted the 3 delivered emails');

// 3b v3.11.0: the designed ticket picture is shown in the email AND attached
{
  const pngHead = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);   // PNG signature + IHDR chunk start, like every real PNG
  const ticket = Buffer.concat([pngHead, crypto.randomBytes(240 * 1024)]);   // about the size of a real ticket picture
  got.length = 0;
  r = await call('/mail/send', { smtp: { ...good, port: 465 }, from: { email: 'organiser@college.edu', name: 'TechFest Team' }, messages: [
    { to: 'asha@students.example', name: 'Asha Rao', subject: 'Your ticket', text: 'Hi Asha', html: '<p><img src="cid:ticket-qr@cem.local"></p>', qr: png.toString('base64'), ticket: ticket.toString('base64'), file: 'ticket-asha-rao.png' },
    { to: 'ravi@students.example', name: 'Ravi', subject: 'Your ticket', text: 'Hi Ravi', html: '<p><img src="cid:ticket-qr@cem.local"></p>', ticket: ticket.toString('base64'), file: '../../evil.sh' }
  ] });
  assert.equal(r.s, 200, JSON.stringify(r.j)); assert.equal(r.j.sent, 2); assert.equal(r.j.ticketPng, true); ok('send answers ticketPng:true so the app knows the Worker is current');
  const t1 = got[0], inl = t1.attachments.find(x => x.cid), att = t1.attachments.find(x => x.contentDisposition === 'attachment');
  assert.equal(t1.attachments.length, 2); assert.ok(inl && att, 'one inline and one attached picture');
  assert.ok(inl.content.equals(ticket), 'inline picture is the ticket, not the small QR'); assert.equal(inl.cid, 'ticket-qr@cem.local');
  assert.ok(att.content.equals(ticket)); assert.equal(att.filename, 'ticket-asha-rao.png'); assert.equal(att.contentType, 'image/png');
  assert.match(t1.html, /cid:ticket-qr@cem\.local|data:image/); assert.equal(t1.text.trim(), 'Hi Asha');   // the parser may inline the cid image as a data: URI
  ok('ticket picture is inline (cid) and attached as ticket-asha-rao.png, byte for byte');
  assert.equal(got[1].attachments.find(x => x.contentDisposition === 'attachment').filename, 'ticket.png'); ok('a hostile file name falls back to ticket.png');
  got.length = 0;
  r = await call('/mail/send', { smtp: good, from: { email: 'organiser@college.edu' }, messages: [{ to: 'a@b.example', text: 'x', html: '<b>x</b>', qr: png.toString('base64') }] });
  assert.equal(r.j.sent, 1); assert.equal(got[0].attachments.length, 1); ok('older app (QR only, no ticket) still works exactly as in 3.10.0');
  r = await call('/mail/send', { smtp: good, from: { email: 'organiser@college.edu' }, messages: [{ to: 'a@b.example', text: 'x', ticket: Buffer.from('not a png at all').toString('base64') }] }); assert.equal(r.s, 400); ok('ticket that is not a PNG -> 400');
  r = await call('/mail/send', { smtp: good, from: { email: 'organiser@college.edu' }, messages: [{ to: 'a@b.example', text: 'x', ticket: 'iVBORw0KGgo' + 'A'.repeat(720000) }] }); assert.equal(r.s, 400); ok('oversized ticket picture -> 400');
  got.length = 0;
}

// 4 limits and shape checks
r = await call('/mail/send', { smtp: good, from: { email: 'organiser@college.edu' }, messages: Array.from({ length: 21 }, () => ({ to: 'a@b.example', text: 'x' })) }); assert.equal(r.s, 400); ok('more than 20 emails in one call -> 400');
r = await call('/mail/send', { smtp: good, from: { email: 'organiser@college.edu' }, messages: [{ to: 'not-an-email', text: 'x' }] }); assert.equal(r.s, 400); ok('invalid recipient -> 400');
r = await call('/mail/send', { smtp: good, from: { email: 'organiser@college.edu' }, messages: [{ to: 'a@b.example', text: 'x', qr: '<script>' }] }); assert.equal(r.s, 400); ok('non-base64 QR -> 400');
r = await call('/mail/send', { smtp: good, from: { email: 'organiser@college.edu' }, messages: [{ to: 'a@b.example', text: 'x' }] }, { e: { ...env, MAIL_DAILY_LIMIT: '3' } }); assert.equal(r.s, 429); ok('daily limit (MAIL_DAILY_LIMIT=3, 3 already used) -> 429');
r = await call('/mail/send', { smtp: { ...good, host: 'smtp.other.example' }, from: { email: 'organiser@college.edu' }, messages: [{ to: 'a@b.example', text: 'x' }] }, { e: { ...env, SMTP_ALLOWED_HOSTS: 'college.example' } }); assert.equal(r.s, 400); ok('SMTP_ALLOWED_HOSTS blocks other servers');
r = await call('/mail/send', { smtp: good, from: { email: 'organiser@college.edu' }, messages: [{ to: 'a@b.example', text: 'plain mail, no html' }] }); assert.equal(r.j.sent, 1); assert.equal(got.at(-1).text.trim(), 'plain mail, no html'); ok('plain-text-only email works');

// 5 OTP routes still behave
const o = await worker.fetch(new Request('https://w.example/', { method: 'GET' }), env); assert.equal((await o.json()).service, 'campus-events-otp'); ok('GET / health check unchanged');
const o2 = await worker.fetch(new Request('https://w.example/send', { method: 'POST', headers: { Origin: 'https://cem.example', 'Content-Type': 'application/json' }, body: '{"email":"x"}' }), { ...env, OTP_PEPPER: 'p', BREVO_API_KEY: 'b', FROM_EMAIL: 'f@x.example' }); assert.equal(o2.status, 400); ok('OTP /send route still validates input as before');
const pre = await worker.fetch(new Request('https://w.example/mail/send', { method: 'OPTIONS', headers: { Origin: 'https://cem.example' } }), env);
assert.match(pre.headers.get('Access-Control-Allow-Headers'), /Authorization/); ok('CORS preflight allows the Authorization header');

console.log('\nALL ' + n + ' WORKER CHECKS PASSED');
servers.forEach(s => s.close()); setTimeout(() => process.exit(0), 100);
