// Loads the REAL app (www/index.html + every script) and checks the side panel.
// Run: npm install --no-save jsdom && node tests/test-sidepanel.mjs
import { JSDOM, VirtualConsole } from 'jsdom';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const www = fileURLToPath(new URL('../www/', import.meta.url));
const wait = ms => new Promise(r => setTimeout(r, ms));

async function boot(wide = false) {
  const vc = new VirtualConsole(); vc.on('jsdomError', e => { if (/sidepanel/.test(String(e.stack))) console.error(e); });
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
  return { w, $, $$, labels: () => $$('#drw .dr-it').map(txt), active: () => $$('#drw .dr-it.on').map(txt) };
}
const txt = b => [...b.children].map(c => c.textContent.trim()).filter(Boolean).join(' ');
let n = 0; const ok = m => console.log('PASS ' + (++n) + ' ' + m);

{
  const t = await boot();
  assert.ok(t.$('#drw') && t.$('#drb') && t.$('#drx'), 'panel, menu button and scrim exist');
  assert.equal(t.$('#drb').getAttribute('aria-expanded'), 'false'); assert.ok(t.$('#drw').hasAttribute('inert'), 'closed panel is inert');
  ok('panel is built and closed on start');

  t.$('#drb').click();
  assert.ok(t.$('#drw').classList.contains('open')); assert.equal(t.$('#drb').getAttribute('aria-expanded'), 'true'); assert.ok(!t.$('#drw').hasAttribute('inert'));
  assert.deepEqual(t.labels().slice(0, 4), ['Dashboard', 'Events 1', 'My tasks', 'New event']);
  assert.ok(t.labels().includes('Ignite Fest'), 'quick list of events'); assert.ok(!t.labels().includes('Check-in'), 'no event groups yet');
  ok('menu button opens the panel: Dashboard, Events, My tasks, New event + event shortcuts');

  t.$('#drw [data-open="e1"]').click();
  assert.ok(!t.$('#drw').classList.contains('open'), 'panel closes after choosing');
  assert.equal(t.w.eval('V').tab, 'detail'); assert.equal(t.w.eval('V').dt, 'info');
  assert.equal(t.$$('.tabs').length === 0, true, 'tab strip is gone');
  assert.equal(t.$('.dr-bar h3').textContent, 'Details');
  t.$('#drb').click();
  const L = t.labels();
  for (const x of ['Details', 'All attendees 1', 'Check-in', 'Add attendee', 'Email attendees', 'Tasks', 'People', 'Chat', 'Payments', 'Income', 'Budget', 'Bills', 'Vendors'])
    assert.ok(L.some(l => l.startsWith(x)), 'missing: ' + x + ' in ' + L.join(' | '));
  assert.deepEqual(t.active(), ['Details']);
  assert.deepEqual(t.$$('.dr-gh').map(b => b.textContent.trim()), ['Event', 'Attendees', 'Team', 'Money']);
  ok('with an event open the panel lists every section; Details is active and the tab strip is hidden');

  const press = k => { t.$(`#drw [data-spk="${k}"]`).click(); if (!t.$('#drw').classList.contains('open')) t.$('#drb').click(); };
  press('in'); assert.equal(t.w.eval('V').dt, 'regs'); assert.equal(t.w.eval('V').av, 'in'); assert.deepEqual(t.active(), ['Check-in']);
  assert.ok(/Scan tickets/.test(t.$('#app').textContent), 'check-in screen is shown'); assert.equal(t.$('.dr-bar h3').textContent, 'Check-in'); assert.equal(t.$('.dr-bar span').textContent, 'Attendees');
  press('add'); assert.equal(t.w.eval('V').av, 'add'); assert.ok(/Register an attendee/.test(t.$('#app').textContent));
  press('mail'); assert.equal(t.w.eval('V').av, 'mail'); assert.ok(/Email attendees/.test(t.$('#app').textContent));
  press('regs'); assert.equal(t.w.eval('V').av, 'list'); assert.ok(/Asha/.test(t.$('#app').textContent));
  ok('Attendees entries switch between list, check-in, add and email');

  press('tasks'); assert.equal(t.w.eval('V').dt, 'tasks'); assert.deepEqual(t.active(), ['Tasks']);
  press('people'); assert.equal(t.w.eval('V').dt, 'people');
  press('chat'); assert.equal(t.w.eval('V').dt, 'chat');
  press('pay'); assert.equal(t.w.eval('V').dt, 'pay');
  press('inc'); assert.equal(t.w.eval('V').dt, 'inc');
  ok('Team and Money entries open their screens');

  press('xb'); assert.equal(t.w.eval('V').dt, 'exp'); assert.equal(t.w.eval('V').xv, 'budget'); assert.deepEqual(t.active(), ['Budget']);
  press('xl'); assert.equal(t.w.eval('V').xv, 'bills'); assert.deepEqual(t.active(), ['Bills']);
  press('xv'); assert.equal(t.w.eval('V').xv, 'vendors'); assert.deepEqual(t.active(), ['Vendors']);
  assert.equal(t.$$('.seg[aria-label="Expenses sections"]').length, 1, 'old Budget/Bills/Vendors switch is still in the DOM (hidden by CSS)');
  ok('Budget, Bills and Vendors open the matching Expenses view');

  // fold a group, it stays folded after a repaint
  t.$('#drw [data-sp-g="money"]').click();
  assert.equal(t.$('#drw [data-sp-g="money"]').getAttribute('aria-expanded'), 'false'); assert.ok(t.$('#drg-money').hidden);
  ok('tapping a group name folds it');

  // Escape and scrim close it; the app's own buttons still work (glance tile on Details)
  t.$('#drw [data-spk="info"]').click(); assert.equal(t.w.eval('V').dt, 'info');
  t.$('#drb').click(); t.w.document.dispatchEvent(new t.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.ok(!t.$('#drw').classList.contains('open'));
  t.$('#drb').click(); t.$('#drx').click(); assert.ok(!t.$('#drw').classList.contains('open'));
  t.$('[data-dt="regs"].gl').click(); assert.equal(t.w.eval('V').dt, 'regs'); t.$('#drb').click(); assert.deepEqual(t.active(), ['All attendees 1']);
  ok('Escape and the scrim close the panel; the Details tiles still navigate and the panel follows');

  t.$('#drw [data-go="events"]').click(); assert.equal(t.w.eval('V').tab, 'events'); t.$('#drb').click();
  assert.deepEqual(t.active(), ['Events 1']); assert.ok(!t.labels().includes('Check-in'));
  t.$('#drw [data-go="new"]').click(); assert.equal(t.w.eval('V').tab, 'new');
  ok('Main entries (Events, New event) use the app navigation; event groups disappear outside an event');
}

{
  const t = await boot(true);
  assert.ok(t.w.document.body.classList.contains('dr-dock'), 'docked on wide screens'); assert.ok(t.$('#drb').hidden);
  assert.ok(!t.$('#drw').hasAttribute('inert')); assert.equal(t.$('#drw').getAttribute('role'), 'navigation');
  t.$('#drw [data-open="e1"]').click(); assert.equal(t.w.eval('V').tab, 'detail'); assert.ok(t.labels().includes('Check-in'));
  t.$('#drw [data-spk="tasks"]').click(); assert.equal(t.w.eval('V').dt, 'tasks'); assert.deepEqual(t.active(), ['Tasks']);
  ok('wide screen: panel is docked, always usable, no menu button');
}
console.log('\nAll ' + n + ' checks passed');
process.exit(0);
