// Loads the REAL app (www/index.html + every script) with a fake Firebase and checks profile pictures (4.3.0).
// Run: npm install --no-save jsdom && node tests/test-avatar.mjs
import jsdom from 'jsdom';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const { JSDOM, VirtualConsole } = jsdom;
const www = fileURLToPath(new URL('../www/', import.meta.url));
const root = fileURLToPath(new URL('../', import.meta.url));
const wait = ms => new Promise(r => setTimeout(r, ms));
let n = 0; const ok = m => console.log('PASS ' + (++n) + ' ' + m);

/* ---------- a tiny fake of the Firebase calls the app makes ---------- */
function stubFirebase(w) {
  const store = w.__store, writes = w.__writes, hooks = w.__hooks;
  const FV = { delete: () => ({ __del: 1 }), serverTimestamp: () => ({ __ts: 1 }), arrayUnion: (...a) => ({ __au: a }), arrayRemove: (...a) => ({ __ar: a }) };
  const mkDoc = p => ({ id: p.split('/').pop(), exists: p in store, data: () => store[p], ref: { path: p }, metadata: { hasPendingWrites: false, fromCache: false } });
  const fail = (p, op) => (hooks.reject && hooks.reject(p, op)) ? Promise.reject({ code: 'permission-denied', message: 'denied' }) : Promise.resolve();
  const doc = p => ({
    id: p.split('/').pop(), path: p,
    set(d) { writes.push({ op: 'set', path: p, data: d }); return fail(p, 'set'); },
    update(d) { writes.push({ op: 'update', path: p, data: d }); return fail(p, 'update'); },
    delete() { writes.push({ op: 'delete', path: p }); return Promise.resolve(); },
    get(o) { hooks.gets.push({ path: p, o }); return Promise.resolve(mkDoc(p)); },
    collection: c => col(p + '/' + c),
    onSnapshot(cb) { Promise.resolve().then(() => cb(mkDoc(p))); return () => {}; }
  });
  function col(p, q = {}) {
    const snap = () => {
      const depth = p.split('/').length + 1;
      let ids = Object.keys(store).filter(k => k.startsWith(p + '/') && k.split('/').length === depth);
      if (p === 'events') ids = ids.filter(k => (store[k].memberIds || []).includes(w.__uid));
      if (/\/chat$/.test(p)) ids.sort((a, b) => store[b].at - store[a].at);
      if (q.limit) ids = ids.slice(0, q.limit);
      const docs = ids.map(mkDoc);
      return { docs, size: docs.length, empty: !docs.length, docChanges: () => docs.map(d => ({ type: 'added', doc: d })), metadata: { fromCache: false } };
    };
    return {
      doc: id => doc(p + '/' + id),
      where: () => col(p, q), orderBy: () => col(p, q), limit: x => col(p, { ...q, limit: x }), startAfter: () => col(p, q),
      get: () => Promise.resolve(snap()),
      onSnapshot(cb) { Promise.resolve().then(() => cb(snap())); return () => {}; },
      add(d) { writes.push({ op: 'add', path: p, data: d }); return Promise.resolve(); }
    };
  }
  const user = { uid: w.__uid, email: 'me@x.edu', displayName: 'Me Owner', emailVerified: true, updateProfile: async () => {} };
  const auth = { currentUser: null, onAuthStateChanged(cb) { setTimeout(() => { auth.currentUser = user; cb(user); }, 0); return () => {}; }, signOut: async () => {} };
  const db = { enablePersistence: () => Promise.resolve(), collection: p => col(p), batch: () => ({ update() {}, delete() {}, commit: async () => {} }) };
  w.firebase = { apps: [], initializeApp() { this.apps.push({}); }, auth: () => auth, firestore: Object.assign(() => db, { FieldValue: FV, Blob: { fromUint8Array: x => x } }) };
}
// The app runs from a temporary copy of www/ whose three Firebase files are replaced by the fake (works with any jsdom version).
const STUB_JS = '(' + stubFirebase.toString() + ')(window)';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cem-avatar-'));
fs.cpSync(www, tmp, { recursive: true });
fs.writeFileSync(path.join(tmp, 'vendor/firebase-app-compat.js'), STUB_JS);
fs.writeFileSync(path.join(tmp, 'vendor/firebase-auth-compat.js'), '');
fs.writeFileSync(path.join(tmp, 'vendor/firebase-firestore-compat.js'), '');
process.on('exit', () => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {} });

/* ---------- test data ---------- */
const PIC = k => 'data:image/webp;base64,' + 'QUJD'.repeat(k || 10);   // looks like a real tiny picture to the strict check
const EVIL1 = 'javascript:alert(1)', EVIL2 = 'data:image/webp;base64,AAAAAAAAAAAAAAAAAAAAAAAA" onerror="alert(1)';
const evDoc = members => ({
  info: { name: 'Ignite Fest', type: 'Fest', date: '2030-01-10', time: '10:00', venue: 'Hall', cap: 50, desc: '', fields: [{ id: 'f1', label: 'Full name', type: 'text', req: true, opts: '' }] },
  team: [], groups: [], tasks: [], teams: [], pay: { upi: '', payee: '', fee: 0 }, regs: {}, forms: {}, itm: {}, croles: {},
  owner: 'U1', ntfy: 't', members, memberIds: Object.keys(members)
});
const baseMembers = () => ({ U1: { name: 'Me Owner', role: 'owner' }, U2: { name: 'Bob Stone', role: 'member', pic: PIC() }, U3: { name: 'Eve', role: 'member', pic: EVIL1 }, U4: { name: 'Zed', role: 'member', pic: EVIL2 } });

// fake 2D canvas: remembers what was drawn; toDataURL returns text whose length depends on the quality asked for
function fakeCanvas(w, sizeFor) {
  w.__canvasCalls = [];
  w.HTMLCanvasElement.prototype.getContext = function () {
    const c = this;
    return { fillRect() {}, drawImage(...a) { w.__canvasCalls.push({ el: c, a }); }, set fillStyle(v) {}, set imageSmoothingEnabled(v) {}, set imageSmoothingQuality(v) {} };
  };
  w.HTMLCanvasElement.prototype.toDataURL = function (type, q) {
    const t = type || 'image/png', len = sizeFor(this.width, q);
    return 'data:' + t + ';base64,' + 'A'.repeat(len);
  };
}

async function boot(opt = {}) {
  const vc = new VirtualConsole(), errors = [];
  vc.on('jsdomError', e => { const s = String(e.stack || e); if (/avatar|cemAv|cemPic|cemStack/.test(s)) errors.push(s); });
  const dom = await JSDOM.fromFile(path.join(tmp, 'index.html'), {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      w.__store = opt.store || { 'events/ABCDEF': evDoc(baseMembers()) };
      w.__writes = []; w.__hooks = { gets: [], reject: null }; w.__uid = 'U1';
      fakeCanvas(w, (px, q) => Math.round(5000 * q));
      w.matchMedia = () => ({ matches: !!opt.wide, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
      const mem = new Map(Object.entries(opt.ls || {}));
      Object.defineProperty(w, 'localStorage', { value: { getItem: k => mem.has(k) ? mem.get(k) : null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k), clear: () => mem.clear() } });
      w.__mem = mem;
      w.scrollTo = () => {}; w.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
    }
  });
  const w = dom.window; await new Promise(r => w.addEventListener('load', r)); await wait(500);
  const $ = s => w.document.querySelector(s), $$ = s => [...w.document.querySelectorAll(s)];
  const ev = code => w.eval(code);
  const open = async (dt, id = 'ABCDEF') => { ev(`resetEv();V.dt=${JSON.stringify(dt)};go('detail',${JSON.stringify(id)})`); await wait(150); };
  return { w, $, $$, ev, open, errors, writes: () => w.__writes, close: () => w.close() };
}

/* ---------- 1. files, version, rules ---------- */
{
  const ui = fs.readFileSync(www + 'ui.js', 'utf8'), pkg = JSON.parse(fs.readFileSync(root + 'package.json', 'utf8'));
  assert.equal(/APP_VERSION='([0-9.]+)'/.exec(ui)[1], '4.3.0'); assert.equal(pkg.version, '4.3.0');
  assert.ok(fs.existsSync(root + 'release-notes/v4.3.0.md'));
  assert.ok(fs.readFileSync(www + 'index.html', 'utf8').indexOf('<script src="avatar.js"></script>') < fs.readFileSync(www + 'index.html', 'utf8').indexOf('<script src="ui.js"></script>'), 'avatar.js loads before ui.js');
  ok('version is 4.3.0 in ui.js and package.json, release notes exist, avatar.js loads before ui.js');
  const r = fs.readFileSync(root + 'firestore.rules', 'utf8');
  assert.equal((r.match(/hasOnly\(\['name','role','pic'\]\)/g) || []).length, 3, 'own name, join and role change all allow pic');
  assert.ok(/match \/users\/\{uid\}/.test(r) && /function picOk/.test(r));
  assert.ok(!/hasOnly\(\['name','role'\]\)/.test(r), 'no member rule still rejects a pic');
  ok('firestore.rules allow a pic in all three member rules and define users/{uid}');
}

/* ---------- 2. drawing: People, Details, Events list, side panel, header ---------- */
{
  const t = await boot({ ls: { 'campus-pic': JSON.stringify({ u: 'U1', pic: PIC(12), at: 5, chk: Date.now() }) } });
  assert.deepEqual(t.errors, []); assert.equal(typeof t.w.cemAv, 'function');
  ok('app boots with avatar.js and no script errors');
  assert.equal(t.ev('S.events.length'), 1); assert.equal(t.ev('window.MYUID'), 'U1');

  await t.open('people');
  const items = t.$$('.li .cav');
  assert.equal(items.length, 4, 'one avatar per member');
  assert.ok(items[0].querySelector('img'), 'owner (me) shows my own photo from this phone');
  const html = t.$('#app').innerHTML;
  assert.ok(!/javascript:/i.test(html) && !/onerror/i.test(html), 'a forged picture value never reaches the page');
  const withImg = items.filter(x => x.querySelector('img')).length;
  assert.equal(withImg, 2, 'me and Bob have photos; Eve and Zed fall back to letters');
  assert.equal(items[2].textContent.trim() !== '', true);
  ok('People list: photos for valid ones, letters for missing or forged ones, nothing injected');

  await t.open('info');
  assert.ok(t.$('.cstack'), 'team faces on Details'); assert.equal(t.$$('.cstack .cav').length, 4);
  ok('Details tab shows the team faces');

  t.ev("go('events')"); await wait(100);
  assert.ok(t.$('.evm .cstack'), 'Events list shows faces when someone has a photo');
  assert.equal(t.$$('.evm .cstack .cav').length, 4);
  ok('Events list row shows team faces');

  const hdr = t.$('#av'); assert.ok(hdr.querySelector('img') && hdr.classList.contains('hp'), 'top-bar circle shows my photo');
  t.ev("go('dash')"); await wait(80);
  assert.ok(t.$('#drw .dr-who .dr-pic img'), 'side panel shows my photo when no event is open');
  ok('top-bar circle and side panel show my photo');

  t.close();

  // an event where nobody (me included) has a photo: the Events list stays quiet, Details still shows letters
  const q = await boot({ store: { 'events/ABCDEF': evDoc({ U1: { name: 'Me Owner', role: 'owner' }, U2: { name: 'Bob', role: 'member' } }) } });
  q.ev("go('events')"); await wait(100);
  assert.ok(q.$('.evr') && !q.$('.evm .cstack'), 'no photos anywhere: no face row on the Events list');
  await q.open('info');
  assert.equal(q.$$('.cstack .cav').length, 2); assert.ok(!q.$('.cstack img'));
  ok('with no photos yet the Events list is unchanged and Details shows coloured letters');
  q.close();
}

/* ---------- 3. chat: one face at the start of each run, never on my own messages ---------- */
{
  const store = { 'events/ABCDEF': evDoc(baseMembers()) };
  const T = 1893456000000;
  store['events/ABCDEF/chat/m1'] = { u: 'U2', n: 'Bob Stone', t: 'hello', at: T };
  store['events/ABCDEF/chat/m2'] = { u: 'U2', n: 'Bob Stone', t: 'second in a row', at: T + 20000 };
  store['events/ABCDEF/chat/m3'] = { u: 'U1', n: 'Me Owner', t: 'my reply', at: T + 40000 };
  store['events/ABCDEF/chat/m4'] = { u: 'U3', n: 'Eve', t: 'hi from eve', at: T + 60000 };
  store['events/ABCDEF/chat/m5'] = { u: 'U9', n: 'Gone Person', t: 'I left the event', at: T + 80000 };
  const t = await boot({ store });
  await t.open('chat'); await wait(250);
  assert.deepEqual(t.errors, []);
  const rows = t.$$('#cm .cw');
  assert.equal(rows.length, 5, 'five messages drawn');
  const av = rows.map(r => r.querySelector(':scope > .cavc'));
  assert.ok(av[0] && av[0].querySelector('img'), 'Bob first message: his photo');
  assert.equal(av[1], null, 'Bob second message in the same run: no repeat');
  assert.equal(av[2], null, 'my own message: no face');
  assert.ok(av[3] && !av[3].querySelector('img'), 'Eve (forged picture): a letter');
  assert.ok(av[4] && av[4].textContent.trim() === 'G', 'someone no longer in the event: a letter from the name on the message');
  assert.ok(!/javascript:/i.test(t.$('#cm').innerHTML));
  ok('chat shows the sender photo once per run, none on my messages, letters for missing or removed members');
  // the @tag list
  const ta = t.$('#cin'); ta.value = '@'; ta.setSelectionRange(1, 1); ta.dispatchEvent(new t.w.Event('input', { bubbles: true })); await wait(50);
  assert.ok(t.$('#cmn .cmi .cav'), 'tag list rows carry a small face');
  ok('the @tag list shows small faces');
  assert.equal(t.writes().filter(w => /\/chat$/.test(w.path)).length, 0, 'the chat message format is unchanged and nothing was written');
  t.close();
}

/* ---------- 4. changing and removing the photo ---------- */
{
  const t = await boot();
  t.ev("go('dash')"); await wait(50);
  assert.ok(!t.$('#av img'), 'no photo yet: a letter');
  const P = PIC(20);
  t.w.cemSetPic(P); await wait(60);
  const wr = t.writes();
  const us = wr.find(x => x.path === 'users/U1');
  assert.ok(us && us.op === 'set' && us.data.pic === P && typeof us.data.at === 'number' && Object.keys(us.data).sort().join() === 'at,pic', 'users/U1 gets exactly {pic, at}');
  const up = wr.filter(x => x.path === 'events/ABCDEF' && x.op === 'update');
  assert.equal(up.length, 1); assert.equal(Object.keys(up[0].data).join(), 'members.U1.pic'); assert.equal(up[0].data['members.U1.pic'], P);
  assert.equal(wr.length, 2, 'one write for the profile + one per event, nothing else');
  assert.ok(t.$('#av img') && t.$('#av').classList.contains('hp'), 'header updates at once');
  assert.equal(t.ev("S.events[0].members.U1.pic"), P, 'the event on this phone is updated before the server answers');
  assert.equal(JSON.parse(t.w.__mem.get('campus-pic')).pic, P, 'kept on this phone for the next launch');
  ok('changing the photo: 1 write for you + 1 per event, header updates immediately');

  t.w.__writes.length = 0;
  t.w.cemSetPic(''); await wait(60);
  const wr2 = t.writes();
  assert.equal(wr2.find(x => x.path === 'users/U1').data.pic, '');
  const rm = wr2.find(x => x.path === 'events/ABCDEF');
  assert.equal(JSON.stringify(rm.data['members.U1.pic']), '{"__del":1}', 'the field is deleted from the event, not left empty');   // JSON: the sentinel comes from another realm
  assert.ok(!t.$('#av img') && !t.ev("'pic' in S.events[0].members.U1"));
  ok('removing the photo deletes it from the profile and every event');

  // cross check: the update paths we write are the ones the rules accept (a single dotted field under members.<me>)
  assert.ok(/^members\.U1\.pic$/.test(Object.keys(rm.data)[0]));
  t.close();
}

/* ---------- 5. a failed save puts everything back ---------- */
{
  const t = await boot();
  t.w.__hooks.reject = (p, op) => p === 'users/U1';
  t.w.cemSetPic(PIC(15)); await wait(120);
  assert.ok(!t.$('#av img'), 'header back to a letter');
  assert.ok(!t.ev("'pic' in S.events[0].members.U1"), 'event copy on this phone put back');
  assert.equal(t.writes().filter(x => x.path === 'events/ABCDEF').length, 0, 'no event writes after the profile write failed');
  assert.ok(/firestore\.rules/.test(t.$$('.toast').map(x => x.textContent).join(' ')), 'tells the person to publish the rules');
  ok('a refused save is rolled back and explains what to do');
  t.close();
}

/* ---------- 6. joining or sharing: the missing photo is filled in once, never replaced ---------- */
{
  const store = { 'events/ABCDEF': evDoc({ U1: { name: 'Me Owner', role: 'owner' }, U2: { name: 'Bob', role: 'member' } }) };
  const mine = PIC(18);
  const t = await boot({ store, ls: { 'campus-pic': JSON.stringify({ u: 'U1', pic: mine, at: 9, chk: Date.now() }) } });
  await wait(100);
  let up = t.writes().filter(x => x.path === 'events/ABCDEF' && x.op === 'update');
  assert.equal(up.length, 1, 'my photo is added to the event I am in without one');
  assert.equal(up[0].data['members.U1.pic'], mine);
  t.ev('render();render();render()'); await wait(60);
  up = t.writes().filter(x => x.path === 'events/ABCDEF' && x.op === 'update');
  assert.equal(up.length, 1, 'repeated redraws do not write again');
  ok('an event without my photo gets it once (no write loop)');
  t.close();

  const other = PIC(25);
  const store2 = { 'events/ABCDEF': evDoc({ U1: { name: 'Me Owner', role: 'owner', pic: other } }) };
  const t2 = await boot({ store: store2, ls: { 'campus-pic': JSON.stringify({ u: 'U1', pic: mine, at: 9, chk: Date.now() }) } });
  await wait(100);
  assert.equal(t2.writes().filter(x => x.path === 'events/ABCDEF').length, 0, 'a different photo already stored is never overwritten from a possibly older copy');
  t2.close();
  ok('a photo already stored in an event is never overwritten by this repair');
}

/* ---------- 7. reads: users/{uid} is read only when needed ---------- */
{
  const fresh = JSON.stringify({ u: 'U1', pic: PIC(11), at: 1, chk: Date.now() - 36e5 });
  let t = await boot({ ls: { 'campus-pic': fresh } });
  assert.equal(t.w.__hooks.gets.filter(g => g.path === 'users/U1').length, 0, 'copy younger than 12 hours: no read');
  t.close();
  const stale = JSON.stringify({ u: 'U1', pic: PIC(11), at: 1, chk: Date.now() - 13 * 36e5 });
  const store = { 'events/ABCDEF': evDoc(baseMembers()), 'users/U1': { pic: PIC(30), at: 99 } };
  t = await boot({ ls: { 'campus-pic': stale }, store });
  assert.equal(t.w.__hooks.gets.filter(g => g.path === 'users/U1').length, 1, 'older copy: exactly one read');
  assert.equal(JSON.parse(t.w.__mem.get('campus-pic')).pic, PIC(30), 'the server copy replaces the old one');
  t.close();
  t = await boot({ ls: { 'campus-pic': JSON.stringify({ u: 'SOMEONE_ELSE', pic: PIC(11), at: 1, chk: Date.now() }) }, store });
  assert.equal(t.w.__hooks.gets.filter(g => g.path === 'users/U1').length, 1, "another person's copy on a shared phone is dropped and re-read");
  assert.ok(!t.$('#av img') || JSON.parse(t.w.__mem.get('campus-pic')).u === 'U1');
  assert.notEqual(t.w.cemPicOf(null, 'SOMEONE_ELSE'), PIC(11));
  t.close();
  t = await boot({ ls: {} });
  assert.equal(t.w.__hooks.gets.filter(g => g.path === 'users/U1').length, 1, 'new device: one read');
  assert.equal(t.writes().length, 0, 'and reading never writes');
  t.close();
  ok('users/{uid} is read once on a new device, not at all within 12 hours, never for someone else\'s copy');
}

/* ---------- 8. the picker window: choose, drag, zoom, save ---------- */
{
  const t = await boot();
  t.w.createImageBitmap = async () => ({ width: 800, height: 600, close() {} });
  t.ev("go('dash')"); await wait(50);
  t.$('#av').click(); await wait(30);
  const entry = t.$$('#um button').find(b => /Profile photo/.test(b.textContent));
  assert.ok(entry, 'account menu has a Profile photo entry'); entry.click(); await wait(50);
  assert.ok(t.$('#pp') && !t.$('#pp').classList.contains('hid'), 'window opens');
  assert.ok(t.$('#pp [data-pp=save]').disabled && t.$('#pp [data-pp=rm]').classList.contains('hid'), 'Save is off until a photo is chosen; nothing to remove yet');
  // choose a file
  const f = new t.w.File([new Uint8Array(2000)], 'me.jpg', { type: 'image/jpeg' });
  const input = t.$('#ppf'); Object.defineProperty(input, 'files', { value: [f], configurable: true });
  input.dispatchEvent(new t.w.Event('change', { bubbles: true })); await wait(80);
  assert.ok(!t.$('#ppc').classList.contains('hid') && !t.$('#pp [data-pp=save]').disabled, 'crop box and Save are on');
  // zoom + drag change what is drawn
  const before = t.w.__canvasCalls.length;
  const z = t.$('#ppr'); z.value = '2'; z.dispatchEvent(new t.w.Event('input', { bubbles: true }));
  assert.ok(t.w.__canvasCalls.length > before, 'zoom redraws');
  const last = t.w.__canvasCalls[t.w.__canvasCalls.length - 1].a;
  assert.ok(Math.abs(last[3] - 800 * (256 / 600) * 2) < 0.01, 'zoom 2x of a "cover" fit');
  // not draggable beyond the photo edge
  const c = t.$('#ppc');
  c.dispatchEvent(new t.w.MouseEvent('pointerdown', { bubbles: true, clientX: 0, clientY: 0 }));
  t.w.document.dispatchEvent(Object.assign(new t.w.MouseEvent('pointermove', { bubbles: true, clientX: 5000, clientY: 5000 })));
  const d = t.w.__canvasCalls[t.w.__canvasCalls.length - 1].a;
  assert.ok(Math.abs(d[1]) < 0.001 && Math.abs(d[2]) < 0.001 && d[1] + d[3] >= 255.999 && d[2] + d[4] >= 255.999, 'dragged far: the photo stops at its edge, so the circle is never left with a gap');
  t.w.document.dispatchEvent(new t.w.MouseEvent('pointerup', { bubbles: true }));
  ok('picker: opens from the menu, Save needs a photo, zoom and drag redraw and stay inside the photo');
  // save
  t.$('#pp [data-pp=save]').click(); await wait(80);
  assert.ok(t.$('#pp').classList.contains('hid'), 'window closes');
  const us = t.writes().find(x => x.path === 'users/U1');
  assert.ok(us && /^data:image\/(webp|jpeg);base64,A+$/.test(us.data.pic), 'a picture was saved');
  assert.ok(us.data.pic.length <= 3500, 'under the size cap (' + us.data.pic.length + ' chars)');
  assert.equal(us.data.pic.length, 'data:image/webp;base64,'.length + 3250, 'first quality step that fits was used (q 0.65)');
  assert.ok(t.$('#av img'));
  ok('Save shrinks to under 3.5 KB, saves, closes and updates the top bar');

  // reopen: Remove is offered now
  t.ev("go('dash')"); t.$('#av').click(); [...t.$$('#um button')].find(b => /Profile photo/.test(b.textContent)).click(); await wait(40);
  assert.ok(!t.$('#pp [data-pp=rm]').classList.contains('hid'));
  t.$('#pp [data-pp=rm]').click(); await wait(60);
  assert.ok(!t.$('#av img') && t.$('#pp').classList.contains('hid'));
  ok('Remove is offered once a photo exists and works');

  // rejecting files
  t.w.cemPicOpen(); await wait(20);
  for (const [file, re] of [[new t.w.File([1], 'a.svg', { type: 'image/svg+xml' }), /Choose a photo/], [new t.w.File([1], 'a.pdf', { type: 'application/pdf' }), /Choose a photo/]]) {
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new t.w.Event('change', { bubbles: true })); await wait(40);
    assert.ok(re.test(t.$('#ppm').textContent), 'message for ' + file.type);
  }
  const big = new t.w.File([new Uint8Array(1)], 'big.jpg', { type: 'image/jpeg' }); Object.defineProperty(big, 'size', { value: 16 * 1024 * 1024 });
  Object.defineProperty(input, 'files', { value: [big], configurable: true });
  input.dispatchEvent(new t.w.Event('change', { bubbles: true })); await wait(40);
  assert.ok(/under 15 MB/.test(t.$('#ppm').textContent));
  ok('SVG, non-image and oversized files are refused with a clear message');
  t.close();
}

/* ---------- 9. shrinking: fallbacks and the hard cap ---------- */
{
  const t = await boot();
  const mk = f => { t.w.HTMLCanvasElement.prototype.toDataURL = function (type, q) { return 'data:' + type + ';base64,' + 'A'.repeat(f(this.width, q)); }; };
  const src = t.w.document.createElement('canvas'); src.width = src.height = 256;
  mk((px, q) => 6000);   // never fits at 64: must try 56, then 48
  assert.equal(t.w.cemPicEncode(src), '', 'nothing fits -> empty (the window says so)');
  mk((px, q) => px === 48 ? 3000 : 6000);
  const r = t.w.cemPicEncode(src); assert.ok(r && r.length <= 3500, 'falls back to 48 px');
  mk((px, q) => 3400); assert.ok(t.w.cemPicEncode(src).length <= 3500);
  mk((px, q) => 3600); assert.equal(t.w.cemPicEncode(src), '');
  ok('shrinking tries lower quality, then 56 px and 48 px, and never returns more than 3500 characters');
  t.close();
}

console.log('\nAll ' + n + ' checks passed.');
process.exit(0);
