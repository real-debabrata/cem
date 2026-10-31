// Client test for www/ai.js: name hiding, confirm cards, role checks. Run: npm install --no-save jsdom && node tests/test-ai-client.mjs
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const code = fs.readFileSync(path.join(here, '../www/ai.js'), 'utf8');

const dom = new JSDOM('<!doctype html><body><div id="app"></div></body>', { runScripts: 'dangerously', url: 'https://cem.example/', pretendToBeVisual: true });
const w = dom.window;
w.matchMedia = () => ({ matches: false });
const run = c => { const el = w.document.createElement('script'); el.textContent = c; w.document.body.append(el); };
// stand-ins for what index.html / app2.js provide (as real scripts, so let/const are global like in the app)
run(`
 const uid=()=>Math.random().toString(36).slice(2,9);
 const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 let S={events:[{id:'e1',name:'Tech Fest',type:'Fest',date:'2026-11-10',time:'10:00',venue:'Main hall',cap:200,cloud:true,desc:'',
   fields:[{id:'f1',label:'Full name',type:'text',req:true,opts:''}],groups:[{id:'g1',n:'Logistics'}],tasks:[],itm:[],forms:[],bud:[],exp:[],team:[
   {id:'t1',n:'Rahul Sharma',r:'Volunteer',boss:'u-me'},{id:'t2',n:'Priya Nair',r:'Lead',boss:'u-me'}],members:{'u-me':{name:'Deba Das',role:'owner'}},pay:{upi:'',payee:''}}],regs:[]};
 let V={tab:'detail',eid:'e1'};
 const ev=id=>S.events.find(e=>e.id===id), cur=()=>ev(V.eid);
 const ensure=e=>e; let saves=0; const sv=()=>{saves++}; const toasts=[]; const toast=m=>toasts.push(m);
 window.MYUID='u-me'; window.MYNAME='Deba Das'; window.PERMS=['event','newlink','pay','addtask','tasks','items'];
 window.can=(e,a)=>window.PERMS.includes(a);
 window.peopleOf=e=>[...Object.entries(e.members||{}).map(([id,m])=>({id,n:m.name,r:m.role,acct:1})),...(e.team||[]).map(m=>({id:m.id,n:m.n,r:m.r,boss:m.boss}))];
 window.mineIdsOf=e=>['u-me',...(e.team||[]).filter(m=>m.boss==='u-me').map(m=>m.id)];
 window.roleLabel=(e,r)=>r==='owner'?'Owner':r;
 window.siteBase=()=>'https://cem.example/'; window.pubForm=(f,e)=>{window.published=f}; window.OTP_API='https://w.example';
 window.firebase={apps:[1],auth:()=>({currentUser:{getIdToken:async()=>'tok'}})};
`);
let sentBody = null, reply = null;
w.fetch = async (u, o) => { sentBody = JSON.parse(o.body); assert.equal(u, 'https://w.example/ai/chat'); assert.equal(o.headers.Authorization, 'Bearer tok');
  return { status: 200, ok: true, json: async () => reply }; };
run(code);
const $ = s => w.document.querySelector(s), $$ = s => [...w.document.querySelectorAll(s)];
const tick = () => new Promise(r => setTimeout(r, 20));
const click = el => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const type = (el, v) => { el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
const E = () => w.eval('S.events[0]');
const send = async text => { type($('#ai-in'), text); $('#ai-f').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); await tick(); };
let n = 0; const ok = m => console.log('  ok ' + (++n) + ' ' + m);

await tick();
assert.equal($('#cem-ai-fab').hidden, false); ok('AI button appears when an event is open');
run("V.tab='dash'"); await new Promise(r => setTimeout(r, 800)); assert.equal($('#cem-ai-fab').hidden, true); run("V.tab='detail'"); await new Promise(r => setTimeout(r, 800)); assert.equal($('#cem-ai-fab').hidden, false); ok('button hidden outside an event');
click($('#cem-ai-fab')); assert.match($('#cem-ai').textContent, /Before you use it/); assert.equal($('#ai-in'), null); ok('first open shows the privacy notice, no chat yet');
click($('[data-a=agree]')); assert.equal($('#ai-in'), null); $('#ai-ok').checked = true; click($('[data-a=agree]')); assert.ok($('#ai-in')); ok('must tick the box before the chat unlocks');

// 1) privacy masking on the way out, unmasking on the way back
reply = { ok: true, text: 'Here is a draft for P1.', left: 39, calls: [{ name: 'assign_task', args: { title: 'Print posters', assignee: 'P1', due_date: '2026-11-05', group: 'Logistics' } }] };
await send('Assign poster printing to Rahul Sharma by Friday, his email is rahul@college.edu and phone 9876543210. Priya will help.');
const out = JSON.stringify(sentBody);
for (const bad of ['Rahul', 'Sharma', 'Priya', 'rahul@college.edu', '9876543210', 'Deba']) assert.ok(!out.includes(bad), 'leaked ' + bad);
assert.match(sentBody.contents.at(-1).text, /P1 P2|P1/); ok('names, email and phone are replaced before the request leaves the device: ' + sentBody.contents.at(-1).text.slice(0, 70) + '…');
assert.deepEqual(sentBody.ctx.people.map(p => p.t), ['P1', 'P2']); assert.ok(!JSON.stringify(sentBody.ctx).match(/Rahul|Priya|Deba|attendee|regs/i)); ok('context holds roles and tokens only, no names, no attendee data');
assert.deepEqual(sentBody.ctx.allow.sort(), ['add_shopping_item', 'assign_task', 'create_payment_link', 'write_event_description', 'add_registration_questions'].sort()); ok('allowed actions follow the role');
assert.match($('.aih').textContent, /hidden before sending/); assert.match($('.aib.a').textContent, /Rahul Sharma/); ok('chat shows the hidden-details note and puts the real name back locally');

// 2) confirm card applies the task
assert.equal(E().tasks.length, 0, 'nothing changes before Confirm');
assert.equal($('select[data-f=who]').selectedOptions[0].textContent, 'Rahul Sharma'); assert.equal($('input[data-f=due]').value, '2026-11-05'); ok('card is pre-filled; nothing saved yet');
click($('[data-a=ok]')); const tk = E().tasks[0];
assert.equal(tk.t, 'Print posters'); assert.equal(tk.who, 't1'); assert.equal(tk.gid, 'g1'); assert.equal(tk.due, '2026-11-05'); assert.equal(tk.by, 'u-me'); assert.equal(tk.done, false); ok('Confirm creates the task in the same shape the app uses');

// 3) edits in the card are respected, bad assignee is refused
reply = { ok: true, text: '', calls: [{ name: 'assign_task', args: { title: 'Book sound', assignee: 'P9' } }, { name: 'add_shopping_item', args: { item: 'Masking tape', quantity: 4, price_each: 35.5, assignee: 'P2' } }] };
await send('book sound and buy 4 tape'); assert.equal($$('.aik').length, 3); const c2 = $$('.aik')[2]; type(c2.querySelector('input[data-f=q]'), '6'); click(c2.querySelector('[data-a=ok]'));
const it = E().itm[0]; assert.equal(it.t, 'Masking tape'); assert.equal(it.q, 6); assert.equal(it.p, 35.5); assert.equal(it.who, 't2'); assert.equal(it.s, 'todo'); ok('edited quantity is used; item matches the app shape');
assert.equal($$('.aik')[1].querySelector('select[data-f=who]').value, 'u-me'); ok('unknown assignee token falls back to yourself, never to a guess');

// 4) payment link: payee and UPI are typed locally, validated
reply = { ok: true, text: 'Draft ready.', calls: [{ name: 'create_payment_link', args: { title: 'Entry fee', amount: 100, note: 'Pay before 9 Nov' } }] };
await send('payment link for entry fee 100'); let card = $$('.aik').at(-1); click(card.querySelector('[data-a=ok]')); assert.equal(E().forms.length, 0); assert.match(card.textContent + $$('.aik').at(-1).textContent, /payee name/i); ok('link refused until payee is typed');
card = $$('.aik').at(-1); type(card.querySelector('[data-f=payee]'), 'Tech Club'); type(card.querySelector('[data-f=upi]'), 'not-a-upi'); click(card.querySelector('[data-a=ok]')); assert.equal(E().forms.length, 0); ok('invalid UPI id refused');
card = $$('.aik').at(-1); type(card.querySelector('[data-f=upi]'), 'techclub@okhdfc'); click(card.querySelector('[data-a=ok]'));
const fm = E().forms[0]; assert.equal(fm.amt, 100); assert.equal(fm.upi, 'techclub@okhdfc'); assert.equal(fm.payee, 'Tech Club'); assert.equal(fm.id.length, 12); assert.equal(w.published.id, fm.id); assert.equal(E().pay.upi, 'techclub@okhdfc');
assert.match($('#cem-ai').textContent, /Copy link/); ok('payment link created and published through the app\'s own pubForm');
reply = { ok: true, text: 'ok', calls: [] }; await send('thanks'); assert.ok(!JSON.stringify(sentBody).includes('techclub') && !JSON.stringify(sentBody).includes('Tech Club')); ok('UPI id and payee never appear in a later request');

// 5) description + registration questions
reply = { ok: true, text: 'Draft:', calls: [{ name: 'write_event_description', args: { description: 'Join us for a day of talks and demos.' } }, { name: 'add_registration_questions', args: { questions: [{ label: 'Full name', type: 'text' }, { label: 'Year of study', type: 'select', options: '1st, 2nd, 3rd', required: true }, { label: 'Need lunch?', type: 'checkbox' }, { label: 'Bad select', type: 'select', options: 'only' }] } }] };
await send('describe it and add questions'); const cs = $$('.aik').slice(-2); click(cs[0].querySelector('[data-a=ok]')); assert.equal(E().desc, 'Join us for a day of talks and demos.');
assert.equal($$('.aik').at(-1).querySelectorAll('input[type=checkbox]').length, 3, 'duplicate "Full name" dropped'); const box = $$('.aik').at(-1).querySelector('input[data-q="2"]'); box.checked = false; box.dispatchEvent(new w.Event('change', { bubbles: true }));
click($$('.aik').at(-1).querySelector('[data-a=ok]')); const f = E().fields; assert.equal(f.length, 3); assert.equal(f[1].label, 'Year of study'); assert.equal(f[1].opts, '1st,2nd,3rd'); assert.equal(f[1].req, true); assert.equal(f[2].label, 'Need lunch?'); ok('description saved; duplicate question dropped; unticked question skipped; select with one option becomes text');

// 6) role limits are enforced again on Confirm
run("window.PERMS=['items']");
reply = { ok: true, text: 'Draft', calls: [{ name: 'write_event_description', args: { description: 'Sneaky' } }] }; await send('rewrite'); assert.ok(!sentBody.ctx.allow.includes('write_event_description'), 'ctx no longer offers it');
click($$('.aik').at(-1).querySelector('[data-a=ok]')); assert.notEqual(E().desc, 'Sneaky'); assert.match($('#cem-ai').textContent, /cannot edit the event/); ok('a role without permission is refused even if the server proposes it');

// 7) errors, privacy controls
reply = null; w.fetch = async () => { throw new Error('offline'); }; await send('hello'); assert.match($('.aib.e').textContent, /No internet/); ok('offline -> clear message');
click($('[data-a=clear]')); assert.equal($$('.aib.u').length, 0); ok('Clear chat empties the conversation');
click($('[data-a=priv]')); click($('[data-a=revoke]')); assert.equal(w.localStorage.getItem('cem-ai-ok-v1'), null); assert.match($('#cem-ai').textContent, /Before you use it/); ok('"Turn off and forget" withdraws consent');
console.log('ALL ' + n + ' AI CLIENT TESTS PASSED');
process.exit(0);
