// Loads the REAL app (www/index.html + every script) and checks the navigation shell (sidepanel.js):
// sidebar, context bottom bar, section strip, quick find, dashboard shortcuts.
// Run: npm install --no-save jsdom && node tests/test-sidepanel.mjs
import { JSDOM, VirtualConsole } from 'jsdom';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const www = fileURLToPath(new URL('../www/', import.meta.url));
const wait = ms => new Promise(r => setTimeout(r, ms));

async function boot(wide = false) {
  const vc = new VirtualConsole(); vc.on('jsdomError', e => { if (/sidepanel|index\.html/.test(String(e.stack))) console.error(e); });
  const dom = await JSDOM.fromFile(www + 'index.html', {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      w.HTMLCanvasElement.prototype.getContext = () => ({ fillRect() {}, set fillStyle(v) {} });
      w.matchMedia = () => ({ matches: wide, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
      const mem = new Map();
      const ev = { id: 'e1', name: 'Ignite Fest', type: 'Fest', date: '2030-01-10', time: '10:00', venue: 'Hall', cap: 50, desc: '', fields: [{ id: 'f1', label: 'Full name', type: 'text', req: true, opts: '' }, { id: 'f2', label: 'College ID', type: 'text', req: true, opts: '' }] };
      mem.set('campus-events-v1', JSON.stringify({ events: [ev], regs: [{ id: 'r1', eid: 'e1', data: { f1: 'Asha', f2: 'A1' }, name: 'Asha', in: false, at: 1 }] }));
      Object.defineProperty(w, 'localStorage', { value: { getItem: k => mem.has(k) ? mem.get(k) : null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k), clear: () => mem.clear() } });
      w.scrollTo = () => {}; w.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
    } });
  const w = dom.window; await new Promise(r => w.addEventListener('load', r)); await wait(400);
  const $ = s => w.document.querySelector(s), $$ = s => [...w.document.querySelectorAll(s)];
  return { w, $, $$, bar: () => $$('#bn button').map(b => b.querySelector('span').textContent.trim()), barOn: () => $$('#bn button.on').map(b => b.querySelector('span').textContent.trim()),
    strip: () => $$('.sx .sx-t').map(b => b.querySelector('span').textContent.trim()), stripOn: () => $$('.sx .sx-t.on').map(b => b.querySelector('span').textContent.trim()),
    V: () => w.eval('V'), tap: s => { const b = $(s); assert.ok(b, 'no element: ' + s); b.click(); },
    tab: l => { const b = $$('.sx .sx-t').find(x => x.querySelector('span').textContent.trim() === l); assert.ok(b, 'no strip tab: ' + l); b.click(); },
    area: l => { const b = $$('#bn button').find(x => x.querySelector('span').textContent.trim() === l); assert.ok(b, 'no bar item: ' + l); b.click(); },
    qf: { open: () => $('#qfb').click(), box: () => $('#qfi'), type: v => { const i = $('#qfi'); i.value = v; i.dispatchEvent(new w.Event('input', { bubbles: true })); },
          key: k => $('#qfi').dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })), shown: () => !$('#qf').hidden, rows: () => $$('#qfl .qf-o .qf-l').map(x => x.textContent.trim()) } };
}
const txt = b => [...b.children].map(c => c.textContent.trim()).filter(Boolean).join(' ');
let n = 0; const ok = m => console.log('PASS ' + (++n) + ' ' + m);

{
  const t = await boot();
  assert.ok(t.$('#drw') && t.$('#bn') && t.$('#qfb') && t.$('#qf'), 'sidebar, bottom bar, quick-find button and dialog exist');
  assert.ok(!t.$('#drb') && !t.$('#drx'), 'the hamburger and the slide-over scrim are gone');
  assert.equal(t.$('#qf').hidden, true);
  assert.deepEqual(t.bar(), ['Dashboard', 'Events', 'My tasks', 'New event']); assert.deepEqual(t.barOn(), ['Dashboard']);
  const side = [...t.$$('#drn .dr-it')].map(b => b.querySelector('.dr-l').textContent.trim());
  assert.deepEqual(side.slice(0, 3), ['Dashboard', 'Events', 'My tasks']); assert.ok(side.includes('Ignite Fest'), 'upcoming events are one click away');
  assert.ok(t.$('#drw .dr-new[data-go="new"]'), 'New event is an action button, not a menu row');
  assert.ok(t.$('#drw .dr-who'), 'account row'); assert.equal(t.$('#bn').getAttribute('aria-label'), 'Main');
  ok('shell is built: sidebar + bottom bar + quick find, no hamburger; Dashboard is active');

  t.tap('#drw [data-open="e1"]');
  assert.equal(t.V().tab, 'detail'); assert.equal(t.V().dt, 'info');
  assert.deepEqual(t.bar(), ['Details', 'Attendees', 'Team', 'Money'], 'the bottom bar switches to the event areas'); assert.deepEqual(t.barOn(), ['Details']);
  assert.equal(t.$('#bn').getAttribute('aria-label'), 'Event sections');
  assert.equal(t.$('.ep h2').textContent, 'Ignite Fest'); assert.ok(t.$('.ep .ep-scan'), 'Scan tickets is in the event header');
  assert.ok(!t.$('.sx'), 'Details has one section, so no strip'); assert.ok(!t.$('.eh'), 'old event header replaced');
  assert.equal([...t.$$('#app h2')].filter(h => h.textContent === 'Ignite Fest').length, 1, 'the event name is shown once on Details');
  assert.deepEqual([...t.$$('#drw .dr-g .dr-it.on')].map(b => b.querySelector('.dr-l').textContent), ['Details']);
  ok('opening an event: the bar becomes Details / Attendees / Team / Money, header carries Scan, name shown once');

  t.area('Attendees');
  assert.deepEqual(t.strip(), ['List', 'Check-in', 'Add', 'Email', 'Sign-ups']); assert.deepEqual(t.stripOn(), ['List']); assert.deepEqual(t.barOn(), ['Attendees']);
  assert.ok(/Asha/.test(t.$('#app').textContent));
  t.tab('Check-in'); assert.equal(t.V().av, 'in'); assert.deepEqual(t.stripOn(), ['Check-in']); assert.ok(/Scan tickets/.test(t.$('#app').textContent)); assert.ok(!t.$('.ep .ep-scan'), 'no duplicate Scan button on the check-in screen');
  t.tab('Add'); assert.equal(t.V().av, 'add'); assert.ok(/Register an attendee/.test(t.$('#app').textContent));
  t.tab('Email'); assert.equal(t.V().av, 'mail'); assert.ok(/Email attendees/.test(t.$('#app').textContent));
  t.tab('List'); assert.equal(t.V().av, 'list'); assert.ok(t.$('.ep .ep-scan'));
  assert.equal(t.$$('.avn').length, 1, 'the old Attendees switch is still in the page (hidden by CSS), nothing removed from the screens');
  ok('Attendees: List, Check-in, Add, Email, Sign-ups are one always-visible strip');

  t.area('Team'); assert.deepEqual(t.strip(), ['Tasks', 'People', 'Chat']); assert.equal(t.V().dt, 'tasks');
  t.tab('People'); assert.equal(t.V().dt, 'people'); t.tab('Chat'); assert.equal(t.V().dt, 'chat');
  t.area('Money'); assert.deepEqual(t.strip(), ['Payments', 'Income', 'Budget', 'Bills', 'Vendors']); assert.equal(t.V().dt, 'pay');
  t.tab('Income'); assert.equal(t.V().dt, 'inc');
  t.tab('Budget'); assert.equal(t.V().dt, 'exp'); assert.equal(t.V().xv, 'budget'); assert.deepEqual(t.stripOn(), ['Budget']);
  t.tab('Bills'); assert.equal(t.V().xv, 'bills'); assert.deepEqual(t.stripOn(), ['Bills']);
  t.tab('Vendors'); assert.equal(t.V().xv, 'vendors'); assert.deepEqual(t.stripOn(), ['Vendors']);
  assert.equal(t.$$('.seg[aria-label="Expenses sections"]').length, 1, 'old Budget/Bills/Vendors switch is still in the DOM');
  ok('Team (Tasks, People, Chat) and Money (Payments, Income, Budget, Bills, Vendors) open the right screens');

  // tapping an area returns to the section you last used there
  t.area('Attendees'); t.tab('Check-in'); t.area('Team'); t.area('Attendees');
  assert.equal(t.V().av, 'in'); assert.deepEqual(t.stripOn(), ['Check-in']);
  t.area('Money'); assert.equal(t.V().xv, 'vendors', 'Money returns to Vendors');
  ok('each area remembers the last section used');

  t.tap('.ep-back'); assert.equal(t.V().tab, 'events'); assert.deepEqual(t.bar(), ['Dashboard', 'Events', 'My tasks', 'New event']); assert.deepEqual(t.barOn(), ['Events']);
  ok('Back to Events restores the main bar');
  t.w.close();
}

/* permissions: same rules as the old tab strip */
{
  const t = await boot();
  t.w.can = (e, a) => !['exp', 'regs', 'pay'].includes(a);
  t.tap('#drw [data-open="e1"]');
  assert.ok(!t.$('.ep .ep-scan'), 'no Scan button without check-in rights');
  t.area('Attendees'); assert.deepEqual(t.strip(), ['List', 'Add']);
  t.area('Money'); assert.equal(t.V().dt, 'pay'); assert.deepEqual(t.strip(), [], 'only Payments is left, so there is no strip: no Income / Budget / Bills / Vendors without expense rights');
  ok('sections follow the same permission rules as before');
  t.w.close();
}

/* quick find */
{
  const t = await boot();
  t.qf.open(); assert.ok(t.qf.shown()); assert.equal(t.w.document.activeElement.id, 'qfi', 'focus goes to the search box');
  let r = t.qf.rows(); assert.ok(r.includes('Dashboard') && r.includes('My tasks') && r.includes('New event') && r.includes('Ignite Fest') && r.includes('Help & guides'), r.join('|'));
  t.qf.key('Escape'); assert.ok(!t.qf.shown());
  t.w.document.dispatchEvent(new t.w.KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })); assert.ok(t.qf.shown(), 'Ctrl+K opens');
  t.w.document.dispatchEvent(new t.w.KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true })); assert.ok(!t.qf.shown(), 'Cmd+K toggles');
  t.w.document.dispatchEvent(new t.w.KeyboardEvent('keydown', { key: '/', bubbles: true })); assert.ok(t.qf.shown(), '"/" opens'); t.qf.key('Escape');
  ok('quick find opens from the button, Ctrl/Cmd+K and "/", focuses the box, closes on Esc');

  t.qf.type('ignite'); assert.deepEqual(t.qf.rows(), ['Ignite Fest']); t.qf.key('Enter'); await wait(30);
  assert.ok(!t.qf.shown()); assert.equal(t.V().tab, 'detail'); assert.equal(t.V().eid, 'e1');
  ok('typing an event name and Enter opens that event');

  r = (t.qf.open(), t.qf.rows());
  for (const x of ['Details', 'All attendees', 'Check-in', 'Add attendee', 'Email attendees', 'Online sign-ups', 'Tasks', 'People', 'Chat', 'Payments', 'Income', 'Budget', 'Bills', 'Vendors', 'Scan tickets', 'Edit event'])
    assert.ok(r.includes(x), 'missing ' + x + ' in ' + r.join('|'));
  assert.ok(t.$('#qfl .qf-g') && t.$('#qfl .qf-g').textContent === 'Ignite Fest', 'functions are grouped under the event name');
  t.qf.type('bil'); assert.equal(t.qf.rows()[0], 'Bills'); t.qf.key('Enter'); await wait(30);
  assert.equal(t.V().dt, 'exp'); assert.equal(t.V().xv, 'bills'); assert.deepEqual(t.stripOn(), ['Bills']);
  t.qf.open(); t.qf.type('qr'); assert.equal(t.qf.rows()[0], 'Scan tickets', 'synonyms: "qr" finds Scan tickets'); t.qf.key('Escape');
  t.qf.open(); t.qf.type('sponsor'); assert.equal(t.qf.rows()[0], 'Income', 'synonyms: "sponsor" finds Income'); t.qf.key('ArrowDown'); t.qf.key('ArrowUp'); t.qf.key('Escape');
  t.qf.open(); t.qf.type('zzzz'); assert.ok(/Nothing matches/.test(t.$('#qfl').textContent)); t.qf.key('Escape');
  t.qf.open(); t.qf.type('edit'); t.qf.key('Enter'); await wait(30); assert.equal(t.V().tab, 'new', 'Edit event opens the editor');
  ok('with an event open every function is listed; search by name or synonym; Enter runs it; empty result is explained');
  t.w.close();
}

/* dashboard */
{
  const t = await boot();
  assert.ok(t.$('.nx'), 'Next up card'); assert.ok(/Ignite Fest/.test(t.$('.nx h3').textContent)); assert.equal(t.$('.nx .nx-k').textContent.trim(), 'Next up');
  const acts = [...t.$$('.nx .nx-b')].map(b => b.textContent); assert.deepEqual(acts, ['Open event', 'Check-in', 'Add attendee', 'Tasks']);
  t.tap('.nx [data-nx="e1|regs|in"]'); assert.equal(t.V().tab, 'detail'); assert.equal(t.V().dt, 'regs'); assert.equal(t.V().av, 'in'); assert.deepEqual(t.stripOn(), ['Check-in']);
  t.tap('.ep-back'); t.area('Dashboard'); t.tap('.nx [data-nx="e1|tasks"]'); assert.equal(t.V().dt, 'tasks');
  ok('dashboard: Next up card with one-tap Check-in / Add attendee / Tasks');
  t.w.close();
}

console.log('\nALL ' + n + ' PASSED');
