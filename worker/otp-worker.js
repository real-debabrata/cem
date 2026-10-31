/**
 * Campus Events: sign-up OTP service (v3.2.0)
 *
 * Runs free on Cloudflare Workers. One file, no dependencies.
 *
 *   POST /send    { email, name, cf }                    -> emails a 6-digit code
 *   POST /verify  { email, name, password, code }        -> checks the code, creates the Firebase account
 *
 * Why the account is created HERE and not in the browser:
 * Firebase's public sign-up API can be called by any bot that has your (public) API key. Once you switch off
 * "Enable create (sign-up)" in Firebase console > Authentication > Settings > User actions, the ONLY way to make
 * an account is through this Worker, and this Worker only does it after the emailed code is proven.
 * Sign-in is untouched: it still talks to Firebase directly and needs no code.
 *
 * Secrets / settings (Cloudflare dashboard > your Worker > Settings > Variables and Secrets):
 *   FIREBASE_SA        secret   the whole service-account JSON (Firebase console > Project settings > Service accounts)
 *   BREVO_API_KEY      secret   Brevo API key (free plan: 300 emails/day)
 *   OTP_PEPPER         secret   any long random string; codes are stored only as salted hashes
 *   TURNSTILE_SECRET   secret   OPTIONAL. Cloudflare Turnstile secret key (free captcha). Leave unset to skip.
 *   FROM_EMAIL         text     sender address you verified in Brevo
 *   FROM_NAME          text     OPTIONAL, default "Campus Events"
 *   ALLOWED_ORIGINS    text     comma list of sites allowed to call this Worker (see SETUP.md)
 *   ALLOWED_EMAIL_DOMAINS text  OPTIONAL, e.g. "college.edu.in" to accept only college addresses
 *   BLOCKED_EMAIL_DOMAINS text  OPTIONAL, extra throwaway domains to refuse
 * KV namespace binding: OTP_KV
 *
 * v3.10.0 adds bulk ticket email through the organiser's OWN mail account (SMTP). Same Worker, no new setting is required:
 *   POST /mail/verify  { smtp:{host,port,user,pass} }                      -> connects and logs in, sends nothing
 *   POST /mail/send    { smtp, from:{email,name}, messages:[{to,name,subject,text,html,qr,ticket,file}] }  -> sends (max 20 per call)
 *                      v3.11.0: ticket = the attendee's designed ticket picture (PNG as base64, up to ~520 KB; real ones are ~60 KB). It is shown in the email and also
 *                      attached as <file>. Without it the small QR picture (qr) is shown, as in v3.10.0. The answer includes ticketPng:true.
 * Both need the header  Authorization: Bearer <Firebase ID token>  (only signed-in app users may use them).
 * v4.1.0 adds the AI helper (Google Gemini, free tier). Same Worker, one new secret:
 *   POST /ai/chat      { ctx, contents:[{role,text}] }                     -> { ok, text, calls:[{name,args}], left }
 *   GEMINI_API_KEY     secret  your key from aistudio.google.com (free, no card). Without it the helper says it is not set up.
 *   GEMINI_MODEL       text    OPTIONAL, default "gemini-3.8-flash"
 *   AI_DAILY_LIMIT     text    OPTIONAL, AI messages one signed-in user may send per day (default 40)
 * Privacy: the app removes names/emails/phones/UPI ids before sending, and this Worker removes them again. Message text is never
 * stored or logged here; only a per-user daily COUNT is kept (under a hashed id). Needs the same Firebase sign-in token as /mail.
 * The SMTP password is used for that one request and is never stored or logged. Optional settings:
 *   MAIL_DAILY_LIMIT    text  emails one signed-in user may send per day through this Worker (default 1000)
 *   SMTP_ALLOWED_HOSTS  text  OPTIONAL comma list, e.g. "smtp.gmail.com,smtp-relay.brevo.com"; leave out to allow any mail server
 */
import { connect } from 'cloudflare:sockets';

const OTP_TTL_MS = 10 * 60 * 1000;   // a code works for 10 minutes
const MAX_TRIES = 5;                  // wrong guesses allowed per code
const RESEND_GAP_MS = 60 * 1000;      // minimum gap between codes for one email
const MAX_SENDS_PER_EMAIL = 5;        // codes per email per hour
const MAX_SENDS_PER_IP = 10;          // codes per network (IP) per hour
const HOUR = 60 * 60 * 1000;

// Common throwaway-mail domains. Add more with BLOCKED_EMAIL_DOMAINS.
const DISPOSABLE = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'guerrillamail.biz',
  'guerrillamail.de', 'sharklasers.com', 'grr.la', '10minutemail.com', '10minutemail.net', 'tempmail.com',
  'temp-mail.org', 'tempmailo.com', 'tempail.com', 'yopmail.com', 'yopmail.net', 'trashmail.com',
  'getnada.com', 'dispostable.com', 'maildrop.cc', 'throwawaymail.com', 'fakeinbox.com', 'mintemail.com',
  'mohmal.com', 'emailondeck.com', 'burnermail.io', 'moakt.com', 'spamgourmet.com', 'mailnesia.com',
  'mytemp.email', 'inboxkitten.com', 'discard.email', 'getairmail.com', 'mail.tm', 'tmpmail.org',
  'tmpmail.net', 'fakemail.net', 'emailfake.com', 'crazymailing.com', 'mailcatch.com', 'trash-mail.com'
]);

class HttpError extends Error {
  constructor(status, message, retryAfter) { super(message); this.status = status; this.retryAfter = retryAfter; }
}

const enc = new TextEncoder();

/* ---------- small helpers ---------- */
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const pemToDer = pem => {
  const bin = atob(pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
};
const sha = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))].map(x => x.toString(16).padStart(2, '0')).join('');
const safeEq = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const list = v => String(v || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);

// Uniformly random 6-digit code (rejection sampling, no modulo bias).
function makeOtp() {
  const a = new Uint32Array(1), lim = Math.floor(0x100000000 / 1000000) * 1000000;
  do { crypto.getRandomValues(a); } while (a[0] >= lim);
  return String(a[0] % 1000000).padStart(6, '0');
}

const json = (obj, status, headers) => new Response(JSON.stringify(obj), { status, headers: { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

function corsHeaders(req, env) {
  const origin = req.headers.get('Origin') || '';
  const h = { 'Vary': 'Origin', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '86400' };
  const ok = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (origin && ok.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}

async function readJson(req) {
  const t = await req.text();
  if (t.length > 2048) throw new HttpError(413, 'Request too large.');
  let b; try { b = JSON.parse(t); } catch (e) { throw new HttpError(400, 'Bad request.'); }
  if (!b || typeof b !== 'object') throw new HttpError(400, 'Bad request.');
  return b;
}

/* ---------- input checks ---------- */
function cleanEmail(v) {
  const e = String(v || '').trim().toLowerCase();
  if (e.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) throw new HttpError(400, 'Enter a valid email address.');
  return e;
}
function cleanName(v) {
  const n = String(v || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
  if (!n) throw new HttpError(400, 'Enter your name.');
  return n;
}
function cleanPw(v) {
  const p = typeof v === 'string' ? v : '';
  if (p.length < 6) throw new HttpError(400, 'Use a password with at least 6 characters.');
  if (p.length > 128) throw new HttpError(400, 'That password is too long (128 characters max).');
  return p;
}
function checkDomain(email, env) {
  const d = email.split('@')[1];
  const allow = list(env.ALLOWED_EMAIL_DOMAINS);
  if (allow.length && !allow.some(a => d === a || d.endsWith('.' + a))) throw new HttpError(400, 'Please use your ' + allow.join(' or ') + ' email address.');
  if (DISPOSABLE.has(d) || list(env.BLOCKED_EMAIL_DOMAINS).includes(d)) throw new HttpError(400, 'Temporary email addresses are not accepted. Use your real email.');
}
function needConfig(env) {
  const miss = ['OTP_KV', 'OTP_PEPPER', 'FIREBASE_SA', 'BREVO_API_KEY', 'FROM_EMAIL'].filter(k => !env[k]);
  if (miss.length) { console.error('Missing settings: ' + miss.join(', ')); throw new HttpError(500, 'Sign-up is not set up yet. Please tell the admin.'); }
}

/* ---------- Cloudflare Turnstile (optional free captcha) ---------- */
async function checkTurnstile(env, token, ip) {
  if (!token || typeof token !== 'string') throw new HttpError(400, 'Security check missing. Wait for it to finish and try again.');
  const f = new FormData();
  f.append('secret', env.TURNSTILE_SECRET); f.append('response', token); if (ip !== 'unknown') f.append('remoteip', ip);
  let j = {};
  try { j = await (await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: f })).json(); } catch (e) { /* treated as failure */ }
  if (!j.success) throw new HttpError(400, 'Security check failed. Please try again.');
}

/* ---------- Firebase Auth admin (REST, no SDK needed) ---------- */
let SA = null, gTok = null, gExp = 0;
function serviceAccount(env) {
  if (!SA) {
    try { SA = JSON.parse(env.FIREBASE_SA); } catch (e) { console.error('FIREBASE_SA is not valid JSON'); throw new HttpError(500, 'Sign-up is not set up yet. Please tell the admin.'); }
    if (!SA.client_email || !SA.private_key || !SA.project_id) { SA = null; console.error('FIREBASE_SA is missing client_email, private_key or project_id'); throw new HttpError(500, 'Sign-up is not set up yet. Please tell the admin.'); }
  }
  return SA;
}
async function googleToken(env) {
  if (gTok && Date.now() < gExp - 60000) return gTok;
  const sa = serviceAccount(env), now = Math.floor(Date.now() / 1000);
  const part = o => b64u(enc.encode(JSON.stringify(o)));
  const unsigned = part({ alg: 'RS256', typ: 'JWT' }) + '.' + part({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600
  });
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(unsigned));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + unsigned + '.' + b64u(sig)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) { console.error('Google token error', r.status, JSON.stringify(j)); throw new HttpError(502, 'Could not reach the account service. Try again.'); }
  gTok = j.access_token; gExp = Date.now() + (j.expires_in || 3600) * 1000;
  return gTok;
}
async function firebase(env, path, body) {
  const sa = serviceAccount(env), tok = await googleToken(env);
  const r = await fetch('https://identitytoolkit.googleapis.com/v1/projects/' + sa.project_id + path, {
    method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) };
}
async function userExists(env, email) {
  const r = await firebase(env, '/accounts:lookup', { email: [email] });
  if (!r.ok) { console.error('lookup failed', r.status, JSON.stringify(r.data)); throw new HttpError(502, 'Could not reach the account service. Try again.'); }
  return Array.isArray(r.data.users) && r.data.users.length > 0;
}

/* ---------- email (Brevo) ---------- */
async function sendMail(env, email, name, otp) {
  const safe = esc(name);
  const html = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:420px;margin:auto;color:#14213d">' +
    '<h2 style="margin:0 0 8px">Campus Events</h2><p>Hi ' + safe + ',</p>' +
    '<p>Use this code to finish creating your account:</p>' +
    '<p style="font-size:34px;font-weight:700;letter-spacing:8px;margin:16px 0">' + otp + '</p>' +
    '<p style="color:#5b6678;font-size:13px">It expires in 10 minutes. If you did not try to sign up, ignore this email. Nobody can use the code without your inbox.</p></div>';
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST', headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: env.FROM_NAME || 'Campus Events', email: env.FROM_EMAIL }, to: [{ email, name }],
      subject: otp + ' is your Campus Events code', htmlContent: html,
      textContent: 'Your Campus Events code is ' + otp + '. It expires in 10 minutes. If you did not try to sign up, ignore this email.'
    })
  });
  if (!r.ok) { console.error('Brevo error', r.status, await r.text().catch(() => '')); throw new HttpError(502, 'Could not send the email. Please try again in a minute.'); }
}

/* ---------- routes ---------- */
const ttlFor = (w, now) => Math.max(60, Math.ceil((w + HOUR - now) / 1000)); // KV needs at least 60 s

async function handleSend(b, req, env, cors) {
  needConfig(env);
  const email = cleanEmail(b.email), name = cleanName(b.name);
  const ip = req.headers.get('CF-Connecting-IP') || 'unknown';

  // Cheap checks first, so bots never reach the (limited) KV writes or the email quota.
  if (env.TURNSTILE_SECRET) await checkTurnstile(env, b.cf, ip);
  checkDomain(email, env);
  if (await userExists(env, email)) throw new HttpError(409, 'An account with this email already exists. Try signing in.');

  const now = Date.now();
  const ipKey = 'ip:' + ip + ':' + Math.floor(now / HOUR);
  const ipN = parseInt(await env.OTP_KV.get(ipKey) || '0', 10);
  if (ipN >= MAX_SENDS_PER_IP) throw new HttpError(429, 'Too many requests from this network. Try again in an hour.');

  const key = 'otp:' + email;
  const old = await env.OTP_KV.get(key, 'json');
  let w = now, sends = 0;
  if (old && now - old.w < HOUR) {
    w = old.w; sends = old.sends;
    const wait = RESEND_GAP_MS - (now - old.last);
    if (wait > 0) throw new HttpError(429, 'Please wait ' + Math.ceil(wait / 1000) + ' seconds before asking for another code.', Math.ceil(wait / 1000));
    if (sends >= MAX_SENDS_PER_EMAIL) throw new HttpError(429, 'Too many codes requested for this email. Try again in an hour.');
  }

  const otp = makeOtp();
  const rec = { h: await sha(env.OTP_PEPPER + ':' + email + ':' + otp), exp: now + OTP_TTL_MS, tries: 0, sends: sends + 1, last: now, w };
  await env.OTP_KV.put(key, JSON.stringify(rec), { expirationTtl: ttlFor(w, now) });
  await env.OTP_KV.put(ipKey, String(ipN + 1), { expirationTtl: 3700 });
  await sendMail(env, email, name, otp);
  return json({ ok: true, expiresIn: OTP_TTL_MS / 1000, retryAfter: RESEND_GAP_MS / 1000 }, 200, cors);
}

async function handleVerify(b, req, env, cors) {
  needConfig(env);
  const email = cleanEmail(b.email), name = cleanName(b.name), password = cleanPw(b.password);
  const code = String(b.code || '').replace(/\D/g, '');
  if (code.length !== 6) throw new HttpError(400, 'Enter the 6-digit code.');

  const key = 'otp:' + email, now = Date.now();
  const rec = await env.OTP_KV.get(key, 'json');
  if (!rec || now > rec.exp) throw new HttpError(400, 'This code has expired. Request a new one.');
  if (rec.tries >= MAX_TRIES) throw new HttpError(429, 'Too many wrong attempts. Request a new code.');

  const h = await sha(env.OTP_PEPPER + ':' + email + ':' + code);
  if (!safeEq(h, rec.h)) {
    rec.tries += 1;
    await env.OTP_KV.put(key, JSON.stringify(rec), { expirationTtl: ttlFor(rec.w, now) });
    const left = MAX_TRIES - rec.tries;
    throw new HttpError(400, left > 0 ? 'Wrong code. ' + left + (left === 1 ? ' try' : ' tries') + ' left.' : 'Too many wrong attempts. Request a new code.');
  }

  const r = await firebase(env, '/accounts', { email, password, displayName: name, emailVerified: true });
  if (!r.ok) {
    const m = (r.data && r.data.error && r.data.error.message) || '';
    if (/EMAIL_EXISTS/.test(m)) throw new HttpError(409, 'An account with this email already exists. Try signing in.');
    if (/WEAK_PASSWORD/.test(m)) throw new HttpError(400, 'Use a password with at least 6 characters.');
    if (/INVALID_EMAIL/.test(m)) throw new HttpError(400, 'Enter a valid email address.');
    console.error('createUser failed', r.status, JSON.stringify(r.data));
    throw new HttpError(502, 'Could not create the account. Please try again.');
  }
  await env.OTP_KV.delete(key); // a code works once
  return json({ ok: true }, 200, cors);
}

/* ======================================================================================================
   Bulk ticket email (v3.10.0): send through the organiser's own mail account (SMTP)
   A browser cannot speak SMTP, so the app hands each batch to this Worker, which opens an encrypted
   connection to the organiser's mail server (Gmail, Zoho, Brevo, a college server...) and sends from there.
   - Only signed-in app users: the Firebase ID token is verified here against Google's public keys.
   - Only encrypted connections: port 465 (TLS) or STARTTLS. If the server offers neither, nothing is sent.
   - Ports 465, 587, 2465 and 2525 only. Cloudflare blocks port 25.
   - The SMTP password lives in memory for this request only. It is never written to KV, never logged.
   ====================================================================================================== */
const MAIL_MAX_MESSAGES = 20;            // emails in one request (the app sends 8 at a time)
const MAIL_MAX_BODY = 4 * 1024 * 1024;   // bytes in one request (v3.11.0: each email can carry a ticket picture of about 60 KB)
const TICKET_MAX_B64 = 700000;           // longest accepted ticket picture, as base64 text (about 520 KB of PNG)
const MAIL_PORTS = new Set([465, 587, 2465, 2525]);
const MAIL_IMPLICIT_TLS = new Set([465, 2465]);
const QR_CID = 'ticket-qr@cem.local';    // the app writes <img src="cid:ticket-qr@cem.local"> in the HTML part
const mEnc = new TextEncoder();

/* ---------- small helpers ---------- */
const bytesToB64 = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };
const wrap76 = s => (String(s).match(/.{1,76}/g) || []).join('\r\n');
const b64Text = str => wrap76(bytesToB64(mEnc.encode(str)));
const b64uToBytes = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const bin = atob(s); const o = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i); return o; };
const hexRand = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map(x => x.toString(16).padStart(2, '0')).join(''); };

async function readJsonMax(req, max) {
  const t = await req.text();
  if (t.length > max) throw new HttpError(413, 'That batch is too large. Try fewer attendees at a time.');
  let b; try { b = JSON.parse(t); } catch (e) { throw new HttpError(400, 'Bad request.'); }
  if (!b || typeof b !== 'object') throw new HttpError(400, 'Bad request.');
  return b;
}

/* ---------- who is calling: verify the Firebase ID token (RS256) with Google's public keys ---------- */
let JWKS = null, jwksAt = 0;
async function googleKeys(force) {
  if (!force && JWKS && Date.now() - jwksAt < 3600 * 1000) return JWKS;
  const r = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
  if (!r.ok) throw new Error('jwks ' + r.status);
  JWKS = (await r.json()).keys || []; jwksAt = Date.now();
  return JWKS;
}
function mailProjectId(env) {
  if (env.FIREBASE_PROJECT_ID) return String(env.FIREBASE_PROJECT_ID);
  try { return serviceAccount(env).project_id; } catch (e) { throw new HttpError(500, 'Email sending is not set up yet. Please tell the admin.'); }
}
async function verifyIdToken(env, token) {
  const pid = mailProjectId(env), parts = String(token || '').split('.');
  if (parts.length !== 3) throw new HttpError(401, 'Please sign in again.');
  let head, claims;
  try { head = JSON.parse(new TextDecoder().decode(b64uToBytes(parts[0]))); claims = JSON.parse(new TextDecoder().decode(b64uToBytes(parts[1]))); }
  catch (e) { throw new HttpError(401, 'Please sign in again.'); }
  if (head.alg !== 'RS256' || !head.kid) throw new HttpError(401, 'Please sign in again.');
  let jwk = (await googleKeys(false)).find(k => k.kid === head.kid);
  if (!jwk) jwk = (await googleKeys(true)).find(k => k.kid === head.kid);
  if (!jwk) throw new HttpError(401, 'Please sign in again.');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64uToBytes(parts[2]), mEnc.encode(parts[0] + '.' + parts[1]));
  const now = Math.floor(Date.now() / 1000);
  if (!ok || claims.aud !== pid || claims.iss !== 'https://securetoken.google.com/' + pid || !(claims.exp > now) || !(claims.iat <= now + 300) || typeof claims.sub !== 'string' || !claims.sub)
    throw new HttpError(401, 'Please sign in again.');
  return { uid: claims.sub, email: claims.email || '' };
}
async function authUser(req, env) {
  const m = /^Bearer (.+)$/.exec(req.headers.get('Authorization') || '');
  if (!m) throw new HttpError(401, 'Please sign in again.');
  try { return await verifyIdToken(env, m[1]); }
  catch (e) { if (e instanceof HttpError) throw e; console.error('token check failed', e && e.message); throw new HttpError(401, 'Please sign in again.'); }
}

/* ---------- input checks ---------- */
const MAIL_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const HOST_RE = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
const mailAddr = (v, what) => { const e = String(v || '').trim(); if (e.length > 254 || !MAIL_RE.test(e)) throw new HttpError(400, 'The ' + what + ' email address is not valid.'); return e; };
const oneLine = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

function cleanSmtp(o, env) {
  o = o && typeof o === 'object' ? o : {};
  const host = String(o.host || '').trim().toLowerCase(), port = parseInt(o.port, 10);
  if (!HOST_RE.test(host)) throw new HttpError(400, 'Enter the mail server name, for example smtp.gmail.com.');
  if (!MAIL_PORTS.has(port)) throw new HttpError(400, 'Use port 465 (SSL) or 587 (STARTTLS). Port 25 is not available.');
  const allow = list(env.SMTP_ALLOWED_HOSTS);
  if (allow.length && !allow.some(a => host === a || host.endsWith('.' + a))) throw new HttpError(400, 'This mail server is not allowed by the app administrator.');
  const user = String(o.user || '').trim(); let pass = String(o.pass == null ? '' : o.pass);
  if (!user || user.length > 254 || /[\u0000\r\n]/.test(user)) throw new HttpError(400, 'Enter the mail account username (usually your full email address).');
  if (!pass || pass.length > 256 || /[\u0000\r\n]/.test(pass)) throw new HttpError(400, 'Enter the password (for Gmail, an app password).');
  if (host === 'smtp.gmail.com') pass = pass.replace(/\s+/g, '');   // Google shows app passwords in groups of four
  return { host, port, user, pass };
}

/* ---------- building the email (MIME) ---------- */
function encWord(s) {
  s = String(s).replace(/[\r\n]+/g, ' ').trim();
  if (/^[\x20-\x7e]*$/.test(s)) return s;
  const out = []; let cur = '', n = 0;
  for (const ch of s) { const k = mEnc.encode(ch).length; if (n + k > 45) { out.push(cur); cur = ''; n = 0; } cur += ch; n += k; }
  if (cur) out.push(cur);
  return out.map(p => '=?UTF-8?B?' + bytesToB64(mEnc.encode(p)) + '?=').join('\r\n ');
}
function addrHeader(name, email) {
  const n = String(name || '').replace(/[\r\n]+/g, ' ').trim();
  if (!n) return '<' + email + '>';
  return (/^[\x20-\x7e]*$/.test(n) ? '"' + n.replace(/(["\\])/g, '\\$1') + '"' : encWord(n)) + ' <' + email + '>';
}
function buildMime(from, m) {
  const text = String(m.text || '').replace(/\r?\n/g, '\r\n'), html = m.html ? String(m.html).replace(/\r?\n/g, '\r\n') : '';
  const head = [
    'From: ' + addrHeader(from.name, from.email),
    'To: ' + addrHeader(m.name, m.to),
    'Subject: ' + encWord(m.subject),
    'Date: ' + new Date().toUTCString().replace('GMT', '+0000'),
    'Message-ID: <' + hexRand(16) + '@' + from.email.split('@')[1] + '>',
    'MIME-Version: 1.0',
    'X-Mailer: Campus Events'
  ];
  const part = (type, body) => 'Content-Type: ' + type + '\r\nContent-Transfer-Encoding: base64\r\n\r\n' + body;
  if (!html) { head.push('Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64'); return head.join('\r\n') + '\r\n\r\n' + b64Text(text) + '\r\n'; }
  const b1 = '=_rel' + hexRand(10), b2 = '=_alt' + hexRand(10);
  const alt = '--' + b2 + '\r\n' + part('text/plain; charset=UTF-8', b64Text(text)) + '\r\n--' + b2 + '\r\n' + part('text/html; charset=UTF-8', b64Text(html)) + '\r\n--' + b2 + '--';
  if (!m.qr && !m.ticket) { head.push('Content-Type: multipart/alternative; boundary="' + b2 + '"'); return head.join('\r\n') + '\r\n\r\n' + alt + '\r\n'; }
  // v3.11.0: m.ticket is the designed ticket picture. It is shown in the email (inline, same Content-ID) AND attached under the attendee's file name,
  // so they can save it. Without it (older app) m.qr, the small QR picture, is shown inline exactly as in v3.10.0.
  const inl = m.ticket || m.qr, inName = m.ticket ? 'ticket.png' : 'ticket-qr.png';
  const img = '--' + b1 + '\r\nContent-Type: image/png; name="' + inName + '"\r\nContent-Transfer-Encoding: base64\r\nContent-ID: <' + QR_CID + '>\r\nContent-Disposition: inline; filename="' + inName + '"\r\n\r\n' + wrap76(inl);
  const rel = '--' + b1 + '\r\nContent-Type: multipart/alternative; boundary="' + b2 + '"\r\n\r\n' + alt + '\r\n' + img + '\r\n--' + b1 + '--';
  if (!m.ticket) {
    head.push('Content-Type: multipart/related; type="multipart/alternative"; boundary="' + b1 + '"');
    return head.join('\r\n') + '\r\n\r\n' + rel + '\r\n';
  }
  const b0 = '=_mix' + hexRand(10), fn = m.file || 'ticket.png';
  const att = '--' + b0 + '\r\nContent-Type: image/png; name="' + fn + '"\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename="' + fn + '"\r\n\r\n' + wrap76(m.ticket);
  const mixed = '--' + b0 + '\r\nContent-Type: multipart/related; type="multipart/alternative"; boundary="' + b1 + '"\r\n\r\n' + rel + '\r\n' + att + '\r\n--' + b0 + '--';
  head.push('Content-Type: multipart/mixed; boundary="' + b0 + '"');
  return head.join('\r\n') + '\r\n\r\n' + mixed + '\r\n';
}

/* ---------- a small SMTP client over Cloudflare's TCP sockets ---------- */
class SmtpError extends Error { constructor(stage, message, code) { super(message); this.stage = stage; this.code = code; } }
const withTimeout = (p, ms, stage) => { let t; return Promise.race([p, new Promise((_, no) => { t = setTimeout(() => no(new SmtpError(stage, 'The mail server did not answer in time. Try again.')), ms); })]).finally(() => clearTimeout(t)); };

function smtpFail(stage, r) {
  const first = (r.lines[0] || '').replace(/^\d{3}[ -]/, '').slice(0, 200);
  if (stage === 'auth') {
    const bad = [534, 535, 454, 530].includes(r.code) || /5\.7\.(8|0|9)/.test(first);
    return new SmtpError('auth', bad ? 'The mail server refused the login. Check the username and password. Gmail, Yahoo and Zoho need an app password, not your normal password.' : 'Login failed: ' + first, r.code);
  }
  return new SmtpError(stage, first || ('The mail server answered with error ' + r.code + '.'), r.code);
}

async function smtpOpen(cfg) {
  const implicit = MAIL_IMPLICIT_TLS.has(cfg.port);
  let socket;
  try { socket = connect({ hostname: cfg.host, port: cfg.port }, { secureTransport: implicit ? 'on' : 'starttls', allowHalfOpen: false }); }
  catch (e) { throw new SmtpError('connect', 'Could not connect to ' + cfg.host + ' on port ' + cfg.port + '. Check the server name and port.'); }
  const dec = new TextDecoder();
  const s = { socket, buf: '', rd: null, wr: null };
  const attach = () => { s.rd = s.socket.readable.getReader(); s.wr = s.socket.writable.getWriter(); s.buf = ''; };
  s.read = async (stage, ms) => {
    const lines = [];
    for (;;) {
      let i;
      while ((i = s.buf.indexOf('\n')) < 0) {
        const r = await withTimeout(s.rd.read(), ms || 20000, stage);
        if (r.done) throw new SmtpError(stage, 'The mail server closed the connection.');
        s.buf += dec.decode(r.value, { stream: true });
        if (s.buf.length > 65536) throw new SmtpError(stage, 'Unexpected answer from the mail server.');
      }
      const line = s.buf.slice(0, i).replace(/\r$/, ''); s.buf = s.buf.slice(i + 1);
      lines.push(line);
      if (/^\d{3}( |$)/.test(line)) return { code: +line.slice(0, 3), lines, text: lines.join('\n') };
    }
  };
  s.send = str => s.wr.write(mEnc.encode(str));
  s.cmd = async (line, stage, ok, ms) => { await s.send(line + '\r\n'); const r = await s.read(stage, ms); if (!ok.includes(r.code)) throw smtpFail(stage, r); return r; };
  s.close = () => { try { s.rd.releaseLock(); } catch (e) {} try { s.wr.releaseLock(); } catch (e) {} try { s.socket.close(); } catch (e) {} };

  try {
    if (socket.opened) await withTimeout(socket.opened, 12000, 'connect');
    attach();
    const g = await s.read('connect');
    if (g.code !== 220) throw smtpFail('connect', g);
    let ehlo = await s.cmd('EHLO cem.mailer', 'hello', [250]);
    if (!implicit) {
      if (!/^250[ -]STARTTLS\s*$/im.test(ehlo.text)) throw new SmtpError('tls', 'This mail server does not offer an encrypted connection (STARTTLS), so the app will not send your password to it. Use port 465 or another server.');
      await s.cmd('STARTTLS', 'tls', [220]);
      s.rd.releaseLock(); s.wr.releaseLock();
      s.socket = s.socket.startTls(); attach();
      ehlo = await s.cmd('EHLO cem.mailer', 'hello', [250]);
    }
    const mech = (ehlo.text.match(/^250[ -]AUTH[ =](.*)$/im) || [])[1] || '';
    const b64 = x => bytesToB64(mEnc.encode(x));
    if (/\bPLAIN\b/i.test(mech)) await s.cmd('AUTH PLAIN ' + b64('\u0000' + cfg.user + '\u0000' + cfg.pass), 'auth', [235]);
    else if (/\bLOGIN\b/i.test(mech)) { await s.cmd('AUTH LOGIN', 'auth', [334]); await s.cmd(b64(cfg.user), 'auth', [334]); await s.cmd(b64(cfg.pass), 'auth', [235]); }
    else throw new SmtpError('auth', 'This mail server does not accept a username and password (PLAIN or LOGIN).');
    return s;
  } catch (e) {
    s.close();
    if (e instanceof SmtpError) throw e;
    throw new SmtpError('connect', 'Could not connect to ' + cfg.host + ' on port ' + cfg.port + '. Check the server name and port.');
  }
}

const FATAL = /limit|quota|too many|exceeded|\brate\b|blocked|suspend|spam|5\.4\.5|4\.7\.0/i;
async function smtpSendAll(s, from, msgs) {
  const out = []; let stopped = '';
  for (const m of msgs) {
    if (stopped) { out.push({ to: m.to, ok: false, error: 'Not sent. ' + stopped }); continue; }
    try {
      await s.cmd('MAIL FROM:<' + from.email + '>', 'mail', [250]);
      await s.cmd('RCPT TO:<' + m.to + '>', 'rcpt', [250, 251]);
      await s.cmd('DATA', 'data', [354]);
      await s.send(buildMime(from, m).replace(/^\./gm, '..').replace(/\r\n$/, '') + '\r\n.\r\n');
      const r = await s.read('data', 60000);
      if (r.code !== 250) throw smtpFail('data', r);
      out.push({ to: m.to, ok: true });
    } catch (e) {
      if (!(e instanceof SmtpError)) throw e;
      out.push({ to: m.to, ok: false, error: e.message, code: e.code });
      const hard = e.code === 421 || e.stage === 'mail' || FATAL.test(e.message);   // a refused sender or a server limit will not get better with the next email
      try { if (!hard) await s.cmd('RSET', 'rset', [250]); } catch (x) { stopped = 'The connection to the mail server was lost.'; }
      if (hard) stopped = 'The mail server stopped accepting email: ' + e.message;
    }
  }
  return out;
}

/* ---------- routes ---------- */
async function handleMail(path, req, env, cors) {
  const user = await authUser(req, env);
  const b = await readJsonMax(req, MAIL_MAX_BODY);
  const cfg = cleanSmtp(b.smtp, env);
  const fail = e => json({ ok: false, stage: e.stage, message: e.message }, e.stage === 'auth' ? 401 : 502, cors);

  if (path === '/mail/verify') {
    let s; try { s = await smtpOpen(cfg); } catch (e) { if (e instanceof SmtpError) return fail(e); throw e; }
    try { await s.cmd('QUIT', 'quit', [221]); } catch (e) { /* closing anyway */ }
    s.close();
    return json({ ok: true, message: 'Connected to ' + cfg.host + ' and logged in.' }, 200, cors);
  }

  const from = { email: mailAddr(b.from && b.from.email, 'sender'), name: oneLine(b.from && b.from.name, 60) };
  const raw = Array.isArray(b.messages) ? b.messages : [];
  if (!raw.length) throw new HttpError(400, 'There is nothing to send.');
  if (raw.length > MAIL_MAX_MESSAGES) throw new HttpError(400, 'At most ' + MAIL_MAX_MESSAGES + ' emails can be sent at once.');
  const msgs = raw.map(m => {
    m = m && typeof m === 'object' ? m : {};
    const text = String(m.text || '').slice(0, 20000), html = String(m.html || '').slice(0, 60000), qr = String(m.qr || '');
    if (!text.trim()) throw new HttpError(400, 'An email has no text.');
    if (qr && (!/^[A-Za-z0-9+/=]+$/.test(qr) || qr.length > 40000)) throw new HttpError(400, 'A QR image is not valid.');
    let ticket = String(m.ticket || '');
    if (ticket && (ticket.length > TICKET_MAX_B64 || !/^[A-Za-z0-9+/=]+$/.test(ticket) || !ticket.startsWith('iVBORw0KGgo'))) throw new HttpError(400, 'A ticket picture is not valid.');
    let file = String(m.file || '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[.-]+/, '').slice(0, 60);
    if (!/\.png$/i.test(file)) file = 'ticket.png';
    return { to: mailAddr(m.to, 'recipient'), name: oneLine(m.name, 80), subject: oneLine(m.subject, 200) || 'Your ticket', text, html, qr, ticket, file };
  });

  const limit = Math.max(1, parseInt(env.MAIL_DAILY_LIMIT || '1000', 10) || 1000);
  const dayKey = 'mail:' + user.uid + ':' + new Date().toISOString().slice(0, 10);
  const used = env.OTP_KV ? parseInt(await env.OTP_KV.get(dayKey) || '0', 10) : 0;
  if (used + msgs.length > limit) throw new HttpError(429, 'Daily limit reached (' + limit + ' emails a day through this app). Try again tomorrow.');

  let s; try { s = await smtpOpen(cfg); } catch (e) { if (e instanceof SmtpError) return fail(e); throw e; }
  let results;
  try { results = await smtpSendAll(s, from, msgs); }
  catch (e) {
    s.close();
    if (e instanceof SmtpError) return fail(e);
    console.error('mail io error', e && e.message);
    return json({ ok: false, stage: 'connect', message: 'The connection to the mail server was lost. Try again.' }, 502, cors);
  }
  try { await s.cmd('QUIT', 'quit', [221]); } catch (e) { /* closing anyway */ }
  s.close();
  const sent = results.filter(r => r.ok).length;
  if (env.OTP_KV && sent) await env.OTP_KV.put(dayKey, String(used + sent), { expirationTtl: 172800 });
  return json({ ok: true, sent, results, ticketPng: true }, 200, cors);   // ticketPng tells the app this Worker is v3.11.0 or newer
}

/* ---------- v4.1.0: AI helper (Gemini free tier) ---------- */
const AI_MAX_BODY = 14000, AI_MAX_TURNS = 10, AI_MAX_TEXT = 1200, AI_MAX_CALLS = 6;

// Privacy backstop. The app already hides names and numbers before sending; this removes anything that still looks like contact or payment data.
function aiScrub(v, n) {
  let s = String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ');
  s = s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g, '[email]')
       .replace(/\b[A-Za-z0-9._-]{2,}@[A-Za-z][A-Za-z0-9]{1,}\b/g, '[upi]')
       .replace(/https?:\/\/\S+/gi, '[link]')
       .replace(/\+\d{1,3}[\s-]?\d[\d\s-]{7,13}\d/g, '[number]')
       .replace(/\b\d{5}[\s-]\d{5}\b/g, '[number]')
       .replace(/\b\d{4}\s\d{4}\s\d{4}\b/g, '[number]')
       .replace(/\d{10,}/g, '[number]');
  return s.trim().slice(0, n || AI_MAX_TEXT);
}
const aiLine = (v, n) => aiScrub(v, n).replace(/\s+/g, ' ');

const AI_STR = (d, extra) => Object.assign({ type: 'STRING', description: d }, extra || {});
const AI_DECL = {
  write_event_description: { name: 'write_event_description', description: 'Write or rewrite the public description of the open event.',
    parameters: { type: 'OBJECT', properties: { description: AI_STR('Final text: 2 to 4 short sentences, max 500 characters, plain text, no hashtags, no contact details.') }, required: ['description'] } },
  create_payment_link: { name: 'create_payment_link', description: 'Prepare a payment link (a page where people pay by UPI). The app fills in the payee and UPI id itself. Never ask for them.',
    parameters: { type: 'OBJECT', properties: { title: AI_STR('Short title, e.g. "Entry fee".'), amount: { type: 'NUMBER', description: 'Amount in rupees. 0 means the payer types the amount.' }, note: AI_STR('Optional one-line note shown on the payment page.') }, required: ['title', 'amount'] } },
  add_registration_questions: { name: 'add_registration_questions', description: 'Add questions to the registration form of the open event (they are added after the existing ones).',
    parameters: { type: 'OBJECT', properties: { questions: { type: 'ARRAY', description: 'Up to 8 new questions.', items: { type: 'OBJECT', properties: {
      label: AI_STR('The question, max 60 characters.'), type: AI_STR('Answer type.', { enum: ['text', 'select', 'checkbox'] }), required: { type: 'BOOLEAN' }, options: AI_STR('For type select only: choices separated by commas.') }, required: ['label', 'type'] } } }, required: ['questions'] } },
  assign_task: { name: 'assign_task', description: 'Create a task and give it to someone on the team.',
    parameters: { type: 'OBJECT', properties: { title: AI_STR('What must be done, max 120 characters.'), assignee: AI_STR('A person token such as "P2", or "me".'), due_date: AI_STR('YYYY-MM-DD, or empty if no date was given.'), group: AI_STR('Name of an existing task group, if one clearly fits.'), details: AI_STR('Optional extra detail, max 300 characters.') }, required: ['title'] } },
  add_shopping_item: { name: 'add_shopping_item', description: 'Add an item to the "items to buy" list.',
    parameters: { type: 'OBJECT', properties: { item: AI_STR('Item name, max 80 characters.'), quantity: { type: 'INTEGER' }, price_each: { type: 'NUMBER', description: 'Estimated price per piece in rupees, or 0 if unknown.' }, assignee: AI_STR('A person token such as "P2" who should buy it, or empty.') }, required: ['item'] } }
};

function aiContext(c) {
  c = c && typeof c === 'object' ? c : {};
  const ev = c.event && typeof c.event === 'object' ? c.event : {};
  const arr = (x, n) => (Array.isArray(x) ? x : []).slice(0, n);
  const today = /^\d{4}-\d{2}-\d{2}$/.test(String(c.today || '')) ? c.today : new Date().toISOString().slice(0, 10);
  const allow = arr(c.allow, 8).filter(k => Object.prototype.hasOwnProperty.call(AI_DECL, k));
  const people = arr(c.people, 40).map(p => ({ t: /^P\d{1,2}$/.test(String(p && p.t)) ? p.t : '', r: aiLine(p && p.role, 30) })).filter(p => p.t);
  return { today, allow, people,
    event: { name: aiLine(ev.name, 80), type: aiLine(ev.type, 20), date: aiLine(ev.date, 10), time: aiLine(ev.time, 5), venue: aiLine(ev.venue, 80), cap: Math.max(0, Math.min(1e6, Math.round(+ev.cap || 0))) },
    groups: arr(c.groups, 12).map(g => aiLine(g, 40)).filter(Boolean), questions: arr(c.questions, 14).map(q => aiLine(q, 60)).filter(Boolean) };
}
function aiSystem(x) {
  return [
    'You are the helper inside Campus Events, an event-management app for college teams. You work on ONE event at a time (below).',
    'Your job: propose actions using the provided functions, or answer short questions about planning this event.',
    'Rules:',
    '- You only PROPOSE. The user confirms every action in the app, so say "Here is a draft", never "Done".',
    '- People appear only as tokens (P1, P2, ...) or "me". Use tokens exactly as given. Never invent a name or token.',
    '- Never ask for, guess or repeat emails, phone numbers, UPI ids, bank or ID numbers. The app fills in payment details itself.',
    '- If something essential is missing (for example the amount of a fee), ask ONE short question instead of guessing.',
    '- Several requests in one message mean several function calls (at most ' + AI_MAX_CALLS + ').',
    '- Dates: write YYYY-MM-DD. Today is ' + x.today + '.',
    '- Replies: under 60 words, plain text, no markdown. If the request has nothing to do with this event, say you can only help plan it.',
    '- Available functions: ' + (x.allow.length ? x.allow.join(', ') : 'none (this user may only chat)') + '. If an action is not available, say the user\'s role does not allow it.',
    '',
    'EVENT: ' + x.event.name + ' | type ' + x.event.type + ' | ' + x.event.date + ' ' + x.event.time + ' | venue ' + x.event.venue + ' | capacity ' + x.event.cap,
    'TEAM (tokens only): ' + (x.people.length ? x.people.map(p => p.t + ' (' + (p.r || 'member') + ')').join(', ') : 'nobody else yet'),
    'TASK GROUPS: ' + (x.groups.join(', ') || 'none'),
    'EXISTING REGISTRATION QUESTIONS: ' + (x.questions.join(' | ') || 'none')
  ].join('\n');
}
async function aiHash(uid) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('cem-ai|' + uid));
  return [...new Uint8Array(d)].slice(0, 8).map(x => x.toString(16).padStart(2, '0')).join('');
}
async function handleAi(req, env, cors) {
  const user = await authUser(req, env);
  if (!env.GEMINI_API_KEY) throw new HttpError(503, 'The AI helper is not set up yet. Please tell the admin.');
  const model = String(env.GEMINI_MODEL || 'gemini-3.8-flash').trim();
  if (!/^[a-z0-9][a-z0-9.-]{2,60}$/i.test(model)) throw new HttpError(500, 'The AI helper is not set up correctly. Please tell the admin.');
  const t = await req.text();
  if (t.length > AI_MAX_BODY) throw new HttpError(413, 'That message is too long.');
  let b; try { b = JSON.parse(t); } catch (e) { throw new HttpError(400, 'Bad request.'); }
  if (!b || typeof b !== 'object' || !Array.isArray(b.contents)) throw new HttpError(400, 'Bad request.');

  let turns = b.contents.slice(-AI_MAX_TURNS).map(m => ({ role: m && m.role === 'model' ? 'model' : 'user', text: aiScrub(m && m.text) })).filter(m => m.text);
  while (turns.length && turns[0].role !== 'user') turns.shift();
  if (!turns.length || turns[turns.length - 1].role !== 'user') throw new HttpError(400, 'Bad request.');

  // daily allowance per signed-in user (only a number is stored, under a hashed id)
  const limit = Math.max(1, Math.min(500, parseInt(env.AI_DAILY_LIMIT, 10) || 40));
  const dayKey = env.OTP_KV ? 'ai:' + await aiHash(user.uid) + ':' + new Date().toISOString().slice(0, 10) : '';
  const used = dayKey ? (parseInt(await env.OTP_KV.get(dayKey), 10) || 0) : 0;
  if (used >= limit) throw new HttpError(429, 'You have used today\'s ' + limit + ' AI messages. Try again tomorrow.');

  const x = aiContext(b.ctx);
  const body = {
    systemInstruction: { parts: [{ text: aiSystem(x) }] },
    contents: turns.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
    generationConfig: { temperature: 0.4, maxOutputTokens: 1500 }
  };
  if (x.allow.length) { body.tools = [{ functionDeclarations: x.allow.map(k => AI_DECL[k]) }]; body.toolConfig = { functionCallingConfig: { mode: 'AUTO' } }; }

  const ac = new AbortController(), timer = setTimeout(() => ac.abort(), 28000);
  let r, j = null;
  try {
    r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': String(env.GEMINI_API_KEY) }, body: JSON.stringify(body), signal: ac.signal });
    try { j = await r.json(); } catch (e) { j = null; }
  } catch (e) {
    throw new HttpError(504, 'The AI took too long to answer. Please try again.');
  } finally { clearTimeout(timer); }

  if (!r.ok) {
    // log only the error CODE, never the message (it could echo the prompt)
    const er = (j && j.error) || {}, why = ((er.details || []).find(d => d && d.reason) || {}).reason || '';
    console.error('Gemini error', r.status, er.status || '', why);
    if (r.status === 429) throw new HttpError(429, 'The free AI limit is reached for a moment. Please wait a minute and try again.');
    throw new HttpError(502, 'The AI service refused the request. The admin should check GEMINI_API_KEY and GEMINI_MODEL (Worker > Logs).');
  }
  const parts = (((j && j.candidates && j.candidates[0]) || {}).content || {}).parts || [];
  const text = aiLine(parts.filter(p => p && typeof p.text === 'string' && !p.thought).map(p => p.text).join(' '), 700);
  const calls = parts.filter(p => p && p.functionCall && AI_DECL[p.functionCall.name] && x.allow.includes(p.functionCall.name))
    .slice(0, AI_MAX_CALLS).map(p => ({ name: p.functionCall.name, args: p.functionCall.args && typeof p.functionCall.args === 'object' ? p.functionCall.args : {} }));
  if (!text && !calls.length) throw new HttpError(502, 'The AI had no answer for that. Try saying it differently.');
  if (dayKey) await env.OTP_KV.put(dayKey, String(used + 1), { expirationTtl: 172800 });
  return json({ ok: true, text, calls, left: Math.max(0, limit - used - 1) }, 200, cors);
}

export default {
  async fetch(req, env) {
    const cors = corsHeaders(req, env), path = new URL(req.url).pathname.replace(/\/+$/, '') || '/';
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method === 'GET' && path === '/') return json({ ok: true, service: 'campus-events-otp' }, 200, cors);
    try {
      const isMail = path === '/mail/verify' || path === '/mail/send', isAi = path === '/ai/chat';
      if (req.method !== 'POST' || (path !== '/send' && path !== '/verify' && !isMail && !isAi)) throw new HttpError(404, 'Not found.');
      if (!cors['Access-Control-Allow-Origin']) throw new HttpError(403, 'This site is not allowed to use the sign-up service.');
      if (isAi) return await handleAi(req, env, cors);
      if (isMail) return await handleMail(path, req, env, cors);
      const body = await readJson(req);
      return path === '/send' ? await handleSend(body, req, env, cors) : await handleVerify(body, req, env, cors);
    } catch (e) {
      if (e instanceof HttpError) return json({ ok: false, message: e.message, retryAfter: e.retryAfter }, e.status, cors);
      console.error('Unhandled', e && e.stack || e);
      return json({ ok: false, message: 'Server error. Please try again.' }, 500, cors);
    }
  }
};
