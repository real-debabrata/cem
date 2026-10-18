import { JSDOM, VirtualConsole } from 'jsdom';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const www = '/home/claude/cem/www/';
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => { if (!/Could not load|Not implemented|navigation/i.test(String(e.message))) errors.push('jsdom: ' + e.message.slice(0, 160)); });
vc.on('error', e => errors.push('console.error: ' + String(e).slice(0, 160)));

const fetchLog = [];
const dom = await JSDOM.fromFile(www + 'index.html', {
  runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(w) {
    // canvas: tiny stub so the QR PNG code path runs
    w.HTMLCanvasElement.prototype.getContext = () => ({ fillRect() {}, set fillStyle(v) {} });
    w.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,iVBORw0KGgo=';
    w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
    const mem = new Map(); Object.defineProperty(w, 'localStorage', { value: { getItem: k => mem.has(k) ? mem.get(k) : null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k), clear: () => mem.clear() } });
    w.scrollTo = () => {};
    w.confirm = () => true;
    w.fetch = async (url, opt) => {
      const body = JSON.parse(opt.body); fetchLog.push({ url, auth: opt.headers.Authorization, body });
      if (url.endsWith('/mail/verify')) return new Response(JSON.stringify({ ok: true, message: 'Connected' }), { status: 200 });
      return new Response(JSON.stringify({ ok: true, sent: body.messages.length, results: body.messages.map(m => /fail@/.test(m.to) ? { to: m.to, ok: false, error: 'Mailbox unavailable' } : { to: m.to, ok: true }) }), { status: 200 });
    };
  }
});
const w = dom.window;
await new Promise(r => w.addEventListener('load', r)); await new Promise(r => setTimeout(r, 500));
const $ = id => w.document.getElementById(id);
const ev = s => w.eval(s);
let n = 0; const ok = m => console.log('  ok ' + (++n) + ' ' + m);

assert.equal(typeof w.openMailer, 'function'); ok('mailer.js loaded inside the real app (all other scripts too)');
assert.equal(typeof w.ticketLinkOf, 'function'); ok('scan.js shares ticketLinkOf');

// an event with attendees
ev(`S.events=[{id:'ABCDEF',name:'TechFest 2026',type:'Fest',date:'2026-12-20',time:'10:00',venue:'Main Auditorium',cap:100,desc:'',fields:[{id:'f1',label:'Full name',type:'text',req:true,opts:''},{id:'f2',label:'College ID',type:'text',req:true,opts:''}],team:[],groups:[],tasks:[],teams:[],don:[],forms:[],payments:[],bud:[],ven:[],exp:[],itm:[],spn:[],croles:[],pay:{upi:'',payee:'',fee:0}}];
 S.regs=[
  {id:'tkt1aaaaaaaa',eid:'ABCDEF',name:'Asha Rao',data:{f1:'Asha Rao',f2:'CS21'},em:'asha@students.example',in:false,at:1},
  {id:'tkt2bbbbbbbb',eid:'ABCDEF',name:'Bilal Khan',data:{f1:'Bilal Khan',f2:'CS22'},em:'bilal@students.example',in:false,at:2},
  {id:'tkt3cccccccc',eid:'ABCDEF',name:'Chitra Das',data:{f1:'Chitra Das',f2:'CS23'},in:false,at:3},
  {id:'tkt4dddddddd',eid:'ABCDEF',name:'Fail Case',data:{f1:'Fail Case',f2:'CS24'},em:'fail@students.example',in:false,at:4}];
 V.tab='detail';V.eid='ABCDEF';V.dt='regs';render();`);
assert.match($('app').innerHTML, /data-mail="1"/); ok('"Email tickets" button shows on the Attendees tab for the event owner');

// open the window
w.document.querySelector('[data-mail="1"]').click();
assert.ok($('ml')); ok('window opens');
assert.match($('mls').textContent, /Not emailed yet \(3\)/); assert.match($('mls').textContent, /1 attendee has no email/); ok('3 ready, 1 without email is counted and offered an input');
const sub = $('mlsub').value, body = $('mlbody').value;
assert.equal(sub, 'Your ticket for {event}'); ok('default subject and message are filled');
assert.match($('mlpv').textContent, /Your ticket for TechFest 2026/); assert.match($('mlpv').textContent, /Hi Asha,/); assert.match($('mlpv').textContent, /Main Auditorium/);
assert.match($('mlpv').textContent, /ticket\.html#e=ABCDEF&r=tkt1aaaaaaaa/); ok('preview merges name, event, venue and the real personal ticket link');

// permission: add the missing email inline
const inp = w.document.querySelector('[data-mlem="tkt3cccccccc"]'); inp.value = 'chitra@students.example'; inp.dispatchEvent(new w.Event('change', { bubbles: true }));
assert.equal(ev(`S.regs.find(r=>r.id==='tkt3cccccccc').em`), 'chitra@students.example'); assert.match($('mls').textContent, /Not emailed yet \(4\)/); ok('typing a missing email saves it on the attendee and the count updates');

// ---- mail app mode
let opened = []; const origClick = w.HTMLAnchorElement.prototype.click;
w.HTMLAnchorElement.prototype.click = function () { if (/^mailto:/.test(this.href)) opened.push(this.href); else origClick.call(this); };
w.document.querySelector('[data-mlnext]').click();
assert.equal(opened.length, 1); const u = new URL(opened[0]); assert.equal(u.pathname, 'asha@students.example');
assert.match(decodeURIComponent(u.search), /subject=Your ticket for TechFest 2026/); assert.match(decodeURIComponent(u.search), /Hi Asha,/); assert.match(decodeURIComponent(u.search), /ticket\.html#e=ABCDEF&r=tkt1aaaaaaaa/);
assert.ok(ev(`S.regs[0].ml>0`)); assert.equal(ev(`S.regs[0].mlv`), 'app'); ok('"Open next" opens a mailto: for Asha with her own ticket link and marks her emailed');
w.document.querySelector('[data-mlnext]').click(); w.document.querySelector('[data-mlnext]').click();
assert.deepEqual(opened.map(h => new URL(h).pathname), ['asha@students.example', 'bilal@students.example', 'chitra@students.example']); ok('each tap moves on to the next person, nobody twice');
assert.match($('app').innerHTML, /Emailed/); ok('attendee list shows the "Emailed" tag');
assert.match($('mls').textContent, /Not emailed yet \(1\)/); ok('queue count went down');

// custom message & tags
$('mlbody').value = 'Hello {name} ({college_id}) - {qr} - {foo}'; $('mlbody').dispatchEvent(new w.Event('input', { bubbles: true }));
await new Promise(r => setTimeout(r, 300));
assert.match($('mlwarn').textContent, /Unknown tag: \{foo\}/); ok('unknown tag is flagged');
$('mlbody').value = 'No ticket here'; $('mlbody').dispatchEvent(new w.Event('input', { bubbles: true })); await new Promise(r => setTimeout(r, 300));
assert.match($('mlwarn').textContent, /no \{qr\} or \{ticket_link\}/); ok('a message without {qr}/{ticket_link} is flagged');
w.document.querySelector('[data-mlrst]').click(); assert.equal($('mlbody').value.startsWith('Hi {first_name}'), true); ok('reset restores the default message');

// ---- SMTP mode
w.document.querySelector('[data-mlm="smtp"]').click();
assert.match($('mlm').textContent, /Sign in to the app/); ok('SMTP panel asks to sign in when signed out');
w.firebase = { apps: [1], auth: () => ({ currentUser: { getIdToken: async () => 'FAKE.ID.TOKEN' } }) };
w.document.querySelector('[data-mlm="smtp"]').click();
assert.ok($('mlhost')); assert.equal($('mlhost').value, 'smtp.gmail.com'); ok('Gmail preset selected by default (smtp.gmail.com, 465)');
assert.ok(w.document.querySelector('#mlpv iframe')); ok('SMTP mode shows the HTML email preview');
$('mluser').value = 'organiser@college.edu'; $('mlpass').value = 'abcd efgh ijkl mnop';
w.document.querySelector('[data-mltest="conn"]').click(); await new Promise(r => setTimeout(r, 50));
assert.equal(fetchLog.at(-1).url.endsWith('/mail/verify'), true); assert.equal(fetchLog.at(-1).auth, 'Bearer FAKE.ID.TOKEN'); assert.equal(fetchLog.at(-1).body.smtp.user, 'organiser@college.edu');
assert.match($('mlst').textContent, /Connected and logged in/); ok('Test connection calls /mail/verify with the Firebase token and shows success');
assert.equal(JSON.parse(w.localStorage.getItem('cem-mail-smtp')).user, 'organiser@college.edu'); ok('login saved on this device only (localStorage), because "Remember" is on');
assert.ok(!JSON.stringify(ev('S')).includes('abcd efgh')); ok('the password is NOT anywhere in the event data that syncs to Firestore');

w.document.querySelector('[data-mltest="mail"]').click(); await new Promise(r => setTimeout(r, 50));
const t = fetchLog.at(-1); assert.equal(t.body.messages.length, 1); assert.equal(t.body.messages[0].to, 'organiser@college.edu'); assert.match(t.body.messages[0].subject, /^\[Test\]/); assert.ok(t.body.messages[0].qr.length > 5); assert.match(t.body.messages[0].html, /cid:ticket-qr@cem\.local/);
assert.match($('mlst').textContent, /Test email sent/); ok('test email goes to the organiser, tagged [Test], with the QR image and cid reference');

// reset marks and send 20 attendees to check batching
ev(`S.regs=S.regs.filter(r=>r.eid!=='ABCDEF'||/tkt/.test(r.id));for(let i=0;i<19;i++)S.regs.push({id:'bulk'+String(i).padStart(8,'0'),eid:'ABCDEF',name:'Guest '+i,data:{f1:'Guest '+i,f2:'G'+i},em:'g'+i+'@students.example',in:false,at:100+i});S.regs.forEach(r=>{delete r.ml;delete r.mlv});render()`);
w.document.querySelector('[data-mls="pending"]').click();
const total = ev(`S.regs.filter(r=>r.eid==='ABCDEF'&&r.em).length`);
w.document.querySelector('[data-mlsend]').click();
for (let i = 0; i < 40 && ev('1') && $('mlrun').textContent.includes('Sending'); i++) await new Promise(r => setTimeout(r, 50));
const sizes = fetchLog.filter(f => f.url.endsWith('/mail/send')).slice(-3).map(f => f.body.messages.length);
console.log('    batches of:', sizes.join(', '), 'for', total, 'attendees');
assert.ok(sizes.every(x => x <= 8)); ok('large sends are split into batches of at most 8');
assert.equal(ev(`S.regs.filter(r=>r.eid==='ABCDEF'&&r.mlv==='smtp').length`), total - 1); ok('everyone delivered is marked emailed (the refused mailbox is not)');
assert.match($('mlrun').textContent, /1 failed/); assert.match($('mlrun').textContent, /Mailbox unavailable/); assert.match($('mlrun').textContent, /Fail Case/); ok('the failure is listed by name with the reason, and the rest carried on');
assert.match($('mls').textContent, /Not emailed yet \(1\)/); ok('"Not emailed yet" now holds only the failed one, ready for a retry');

w.chatSync = () => {}; w.chatDot = () => '';
// ---- permission gate: a viewer must not get the window or the button
ev(`S.events[0].cloud=true;S.events[0].members={'someone-else':{role:'owner',name:'x'}};window.MYUID='me-viewer';S.events[0].members['me-viewer']={role:'viewer',name:'v'};render()`);
const viewerHasBtn = /data-mail="1"/.test($('app').innerHTML);
w.document.getElementById('ml') && w.document.getElementById('ml').remove();
w.openMailer('ABCDEF'); const viewerOpened = !!$('ml');
console.log('    viewer sees button:', viewerHasBtn, '| viewer can open window:', viewerOpened);
assert.equal(viewerHasBtn, false); assert.equal(viewerOpened, false); ok('a Viewer gets neither the button nor the window');
ev(`S.events[0].members['me-viewer'].role='desk';render()`);
assert.match($('app').innerHTML, /data-mail="1"/); ok('the moment someone is given a role with Attendees and check-in (Registration desk), the button appears: no manual setup');

console.log('\nruntime errors during test:', errors.length ? errors : 'none');
console.log('ALL ' + n + ' CLIENT CHECKS PASSED'); process.exit(0);
