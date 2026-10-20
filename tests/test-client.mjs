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
assert.match($('app').innerHTML, /data-mail="1"/); assert.match($('app').innerHTML, />Email attendees</); ok('"Email attendees" button shows on the Attendees tab for the event owner');

// open the window
const tick = ms => new Promise(r => setTimeout(r, ms));
const srcdoc = () => $('mlpvf').srcdoc;
w.document.querySelector('[data-mail="1"]').click();
assert.ok($('ml')); ok('window opens');
assert.equal(w.document.querySelectorAll('#mlsteps button').length, 3); assert.match($('mlsteps').textContent, /People.*Message.*Send/s); ok('three steps are shown: People, Message, Send');

// ---- step 1: people
assert.match($('mls').textContent, /Not emailed\s*3/); assert.match($('mls').textContent, /Emailed\s*0/); assert.match($('mls').textContent, /No email\s*1/);
assert.match($('mls').textContent, /3\s*people get the next email/); ok('step 1 counts: 3 not emailed, 0 emailed, 1 without an email address');
assert.match($('mls').textContent, /Asha Rao/); assert.match($('mls').textContent, /asha@students\.example/); ok('the Not emailed tab lists the attendees with their addresses');
assert.equal(w.document.querySelectorAll('#ml .link').length, 0); ok('there are no text-link buttons left in the window');
w.document.querySelector('[data-mltab="noem"]').click();
const inp = w.document.querySelector('[data-mlem="tkt3cccccccc"]'); assert.ok(inp); ok('the No email tab offers an input for Chitra');
inp.value = 'chitra@students.example'; inp.dispatchEvent(new w.Event('change', { bubbles: true }));
assert.equal(ev(`S.regs.find(r=>r.id==='tkt3cccccccc').em`), 'chitra@students.example'); assert.match($('mls').textContent, /Not emailed\s*4/); assert.match($('mls').textContent, /Everyone has an email address/); ok('typing a missing email saves it on the attendee and the counts update');
w.document.querySelector('[data-mltab="done"]').click(); assert.match($('mls').textContent, /Nobody has been emailed yet/); ok('the Emailed tab is empty before anything is sent');
w.document.querySelector('[data-mltab="pending"]').click();

// ---- step 2: message (ticket on by default)
w.document.querySelector('[data-mlgo="2"]').click();
assert.equal($('mltk').checked, true); ok('the ticket tick box is ON by default');
assert.equal($('mlsub').value, 'Your ticket for {event}'); assert.ok($('mlbody').value.startsWith('Hi {first_name}')); ok('default ticket subject and message are filled');
assert.ok(w.document.querySelector('[data-mltag="qr"]') && w.document.querySelector('[data-mltag="ticket_link"]')); ok('Ticket QR and Ticket link buttons are offered while tickets are on');
await tick(300);
assert.match($('mlpv').textContent, /Your ticket for TechFest 2026/); assert.match(srcdoc(), /Hi Asha,/); assert.match(srcdoc(), /Main Auditorium/);
assert.match(srcdoc(), /ticket\.html#e=ABCDEF&amp;r=tkt1aaaaaaaa/); ok('preview merges name, event, venue and the real personal ticket link');
w.document.querySelector('[data-mltag="first_name"]').click(); assert.match($('mlbody').value, /\{first_name\}/); ok('tapping a detail button inserts that detail into the message');
w.document.querySelector('[data-mlrst]').click(); assert.ok(!/^\{first_name\}/.test($('mlbody').value));

// ---- invitation (ticket off)
$('mltk').checked = false; $('mltk').dispatchEvent(new w.Event('change', { bubbles: true })); await tick(300);
assert.equal($('mltk').checked, false); assert.equal($('mlsub').value, 'You are invited to {event}'); assert.match($('mlbody').value, /You are invited to \{event\}/); ok('unticking swaps in the standard invitation subject and message');
assert.ok(!w.document.querySelector('[data-mltag="qr"]') && !w.document.querySelector('[data-mltag="ticket_link"]')); ok('ticket buttons disappear while tickets are off');
assert.ok(!w.document.querySelector('.tkt')); ok('the ticket picture picker is hidden while tickets are off');
assert.doesNotMatch(srcdoc(), /ticket\.html|cid:ticket-qr|Open my ticket/); assert.match(srcdoc(), /You are invited to TechFest 2026/); ok('the invitation preview has no ticket, no QR and no ticket link');
assert.equal(JSON.parse(w.localStorage.getItem('cem-mail-tpl:ABCDEF')).ticket, false); ok('the choice is remembered for this event on this device');
// the organiser's own words are never overwritten by the swap
$('mlbody').value = 'Come to the {event}! {qr}'; $('mlbody').dispatchEvent(new w.Event('input', { bubbles: true })); await tick(300);
assert.match($('mlwarn').textContent, /Tickets are switched off/); assert.match($('mlwarn').textContent, /Reset message/); ok('ticket parts in a message are flagged while tickets are off, with a hint to use Reset message');
$('mltk').checked = true; $('mltk').dispatchEvent(new w.Event('change', { bubbles: true })); await tick(100);
assert.equal($('mlbody').value, 'Come to the {event}! {qr}'); assert.equal($('mlsub').value, 'Your ticket for {event}'); ok('ticking again keeps the organiser\'s own message but restores the standard subject');
$('mlbody').value = 'No ticket here {foo}'; $('mlbody').dispatchEvent(new w.Event('input', { bubbles: true })); await tick(300);
assert.match($('mlwarn').textContent, /no ticket in it/); ok('a ticket message without a ticket is flagged');
$('mlbody').value = 'Hello {name} ({college_id}) - {qr} - {foo}'; $('mlbody').dispatchEvent(new w.Event('input', { bubbles: true })); await tick(300);
assert.match($('mlwarn').textContent, /Unknown detail: \{foo\}/); ok('an unknown tag is flagged');
w.document.querySelector('[data-mlrst]').click(); assert.equal($('mlbody').value.startsWith('Hi {first_name}'), true); ok('reset restores the default message');

// ---- step 3: send. Nothing is pre-selected for a first-time user.
w.document.querySelector('[data-mlgo="3"]').click();
assert.ok(w.document.querySelector('[data-mlm="app"]') && w.document.querySelector('[data-mlm="smtp"]')); assert.ok(!w.document.querySelector('[data-mlnext]')); ok('step 3 first asks which way to send (nothing chosen yet)');
assert.match($('mlm').textContent, /4\s*people get a ticket/); ok('step 3 says how many people get a ticket');
let opened = []; const origClick = w.HTMLAnchorElement.prototype.click;
w.HTMLAnchorElement.prototype.click = function () { if (/^mailto:/.test(this.href)) opened.push(this.href); else origClick.call(this); };
w.document.querySelector('[data-mlm="app"]').click();
w.document.querySelector('[data-mlnext]').click();
assert.equal(opened.length, 1); const u = new URL(opened[0]); assert.equal(u.pathname, 'asha@students.example');
assert.match(decodeURIComponent(u.search), /subject=Your ticket for TechFest 2026/); assert.match(decodeURIComponent(u.search), /Hi Asha,/); assert.match(decodeURIComponent(u.search), /ticket\.html#e=ABCDEF&r=tkt1aaaaaaaa/);
assert.ok(ev(`S.regs[0].ml>0`)); assert.equal(ev(`S.regs[0].mlv`), 'app'); assert.equal(ev(`S.regs[0].mlk`), 't'); ok('"Open next" opens a mailto: for Asha with her own ticket link and marks her emailed (ticket)');
w.document.querySelector('[data-mlnext]').click(); w.document.querySelector('[data-mlnext]').click();
assert.deepEqual(opened.map(h => new URL(h).pathname), ['asha@students.example', 'bilal@students.example', 'chitra@students.example']); ok('each tap moves on to the next person, nobody twice');
assert.match($('app').innerHTML, /Emailed/); assert.match($('app').innerHTML, /title="Ticket emailed"/); ok('attendee list shows the "Emailed" tag');
// invitation by mail app to the last person
w.document.querySelector('[data-mlgo="2"]').click(); $('mltk').checked = false; $('mltk').dispatchEvent(new w.Event('change', { bubbles: true }));
w.document.querySelector('[data-mlgo="3"]').click();
assert.match($('mlm').textContent, /1\s*person gets a simple invitation/); ok('step 3 says "simple invitation" when tickets are off');
w.document.querySelector('[data-mlnext]').click();
const inv = new URL(opened[3]), invText = decodeURIComponent(inv.search);
assert.equal(inv.pathname, 'fail@students.example'); assert.match(invText, /subject=You are invited to TechFest 2026/); assert.doesNotMatch(invText, /ticket\.html/);
assert.equal(ev(`S.regs.find(r=>r.id==='tkt4dddddddd').mlk`), 'i'); assert.match($('app').innerHTML, /title="Invitation emailed"/); ok('an invitation opens a mailto: with no ticket link and is marked as an invitation');

// ---- step 1 again: Emailed tab
w.document.querySelector('[data-mlstep="1"]').click();
assert.match($('mls').textContent, /Not emailed\s*0/); assert.match($('mls').textContent, /Emailed\s*4/); assert.match($('mls').textContent, /0\s*people get/);
w.document.querySelector('[data-mltab="done"]').click();
assert.match($('mls').textContent, /Asha Rao/); assert.match($('mls').textContent, /Ticket emailed/); assert.match($('mls').textContent, /Invitation emailed/); ok('the Emailed tab lists who got a ticket and who got an invitation');
w.document.querySelector('[data-mlagain]').checked = true; w.document.querySelector('[data-mlagain]').dispatchEvent(new w.Event('change', { bubbles: true }));
assert.match($('mls').textContent, /4\s*people get the next email, including people emailed before/); ok('"email these again too" adds the already-emailed people to the next send');
w.document.querySelector('[data-mlclr]').click();
assert.equal(ev(`S.regs.filter(r=>r.ml||r.mlk).length`), 0); assert.match($('mls').textContent, /Not emailed\s*4/); ok('Clear emailed marks puts everyone back in Not emailed (and removes the kind too)');

// ---- SMTP: needs sign-in
w.document.querySelector('[data-mlgo="2"]').click(); w.document.querySelector('[data-mlgo="3"]').click();
w.document.querySelector('[data-mlm="smtp"]').click();
assert.match($('mlm').textContent, /Sign in to the app/); ok('SMTP panel asks to sign in when signed out');
w.firebase = { apps: [1], auth: () => ({ currentUser: { getIdToken: async () => 'FAKE.ID.TOKEN' } }) };
w.document.querySelector('[data-mlm="smtp"]').click();
const tiles = [...w.document.querySelectorAll('.mlpt')];
assert.equal(tiles.length, 7); assert.ok(tiles.every(t => t.querySelector('svg') && t.textContent.trim().length > 2)); ok('7 provider tiles, each with a logo and a name');
for (const nm of ['Gmail', 'Outlook', 'Yahoo Mail', 'Zoho Mail (India)', 'Zoho Mail (World)', 'Brevo', 'Other']) assert.ok(tiles.some(t => t.textContent.trim() === nm), nm); ok('tile names: Gmail, Outlook, Yahoo Mail, Zoho (India and World), Brevo, Other');
assert.equal(w.document.querySelector('.mlpt.on').textContent.trim(), 'Gmail'); assert.equal(w.document.querySelectorAll('#mlm .mlpt svg path, #mlm .mlpt svg rect').length > 7, true); ok('Gmail is selected by default');
assert.equal($('mlhost'), null); assert.equal($('mlfrom'), null); ok('server and "send from" are hidden for Gmail (simple login: email and password)');
w.document.querySelector('[data-mlguide]').click(); assert.match(w.document.querySelector('.mlgd').textContent, /App passwords/);
const gl = w.document.querySelector('.mlgd a.btn'); assert.equal(gl.getAttribute('href'), 'https://myaccount.google.com/apppasswords'); assert.equal(gl.getAttribute('rel'), 'noopener noreferrer'); ok('"How do I get this password?" shows the steps and a real button to the Google App passwords page');
w.document.querySelector('[data-mladv]').click(); assert.equal($('mlhost').value, 'smtp.gmail.com'); assert.equal($('mlport').value, '465'); ok('"Server settings" reveals smtp.gmail.com and port 465');
w.document.querySelector('[data-mladv]').click(); assert.equal($('mlhost'), null);
$('mluser').value = 'organiser@college.edu'; $('mlpass').value = 'abcd efgh ijkl mnop';
w.document.querySelector('[data-mlshow]').click(); assert.equal($('mlpass').type, 'text'); w.document.querySelector('[data-mlshow]').click(); assert.equal($('mlpass').type, 'password'); ok('the Show button reveals and hides the password');
w.document.querySelector('[data-mltest="conn"]').click(); await tick(50);
assert.equal(fetchLog.at(-1).url.endsWith('/mail/verify'), true); assert.equal(fetchLog.at(-1).auth, 'Bearer FAKE.ID.TOKEN'); assert.equal(fetchLog.at(-1).body.smtp.user, 'organiser@college.edu');
assert.equal(fetchLog.at(-1).body.smtp.host, 'smtp.gmail.com'); assert.equal(fetchLog.at(-1).body.smtp.port, 465);
assert.match($('mlst').textContent, /Connected and logged in/); ok('Test connection uses the Gmail preset even with server settings hidden, sends the Firebase token and shows success');
assert.equal(JSON.parse(w.localStorage.getItem('cem-mail-smtp')).user, 'organiser@college.edu'); ok('login saved on this device only (localStorage), because "Remember" is on');
assert.ok(!JSON.stringify(ev('S')).includes('abcd efgh')); ok('the password is NOT anywhere in the event data that syncs to Firestore');
w.document.querySelector('[data-mltest="mail"]').click(); await tick(50);
const t = fetchLog.at(-1); assert.equal(t.body.messages.length, 1); assert.equal(t.body.messages[0].to, 'organiser@college.edu'); assert.match(t.body.messages[0].subject, /^\[Test\]/);
assert.match(t.body.messages[0].subject, /invited/); assert.equal(t.body.messages[0].qr, ''); assert.equal(t.body.messages[0].ticket, ''); assert.doesNotMatch(t.body.messages[0].html, /cid:ticket-qr@cem\.local/);
assert.match($('mlst').textContent, /Test email sent/); ok('with tickets off the test email is a plain invitation: no QR, no ticket picture, no cid image');
// tickets back on
w.document.querySelector('[data-mlgo="2"]').click(); $('mltk').checked = true; $('mltk').dispatchEvent(new w.Event('change', { bubbles: true })); w.document.querySelector('[data-mlgo="3"]').click();
assert.equal($('mluser').value, 'organiser@college.edu'); assert.equal($('mlpass').value, 'abcd efgh ijkl mnop'); ok('what was typed in step 3 is still there after visiting another step');
w.document.querySelector('[data-mltest="mail"]').click(); await tick(50);
const t2 = fetchLog.at(-1).body.messages[0]; assert.ok(t2.qr.length > 5); assert.match(t2.html, /cid:ticket-qr@cem\.local/); assert.match(t2.subject, /^\[Test\] Your ticket/); ok('with tickets on the test email carries the QR image and cid reference');

// other providers
w.document.querySelector('[data-mlprov="brevo"]').click();
assert.equal(w.document.querySelector('.mlpt.on').textContent.trim(), 'Brevo'); assert.ok($('mlfrom')); assert.match($('mlm').textContent, /SMTP login from Brevo/); assert.equal($('mluser').value, 'organiser@college.edu'); assert.equal($('mlhost'), null);
w.document.querySelector('[data-mladv]').click(); assert.equal($('mlhost').value, 'smtp-relay.brevo.com'); assert.equal($('mlport').value, '587'); w.document.querySelector('[data-mladv]').click();
w.document.querySelector('[data-mlguide]').click(); assert.equal(w.document.querySelector('.mlgd a.btn').getAttribute('href'), 'https://app.brevo.com/settings/keys/smtp'); ok('Brevo shows its own labels, the sender field, the right server and a button to Brevo\'s SMTP page');
w.document.querySelector('[data-mlprov="custom"]').click(); assert.ok($('mlhost')); assert.ok($('mlfrom')); ok('"Other" shows the server fields straight away');
w.document.querySelector('[data-mlprov="zohog"]').click(); w.document.querySelector('[data-mladv]').click(); assert.equal($('mlhost').value, 'smtp.zoho.com'); w.document.querySelector('[data-mladv]').click();
w.document.querySelector('[data-mlprov="zoho"]').click(); w.document.querySelector('[data-mladv]').click(); assert.equal($('mlhost').value, 'smtp.zoho.in'); w.document.querySelector('[data-mladv]').click();
w.document.querySelector('[data-mlprov="yahoo"]').click(); w.document.querySelector('[data-mladv]').click(); assert.equal($('mlhost').value, 'smtp.mail.yahoo.com'); w.document.querySelector('[data-mladv]').click();
w.document.querySelector('[data-mlprov="outlook"]').click(); w.document.querySelector('[data-mladv]').click(); assert.equal($('mlhost').value, 'smtp.office365.com'); assert.equal($('mlport').value, '587'); w.document.querySelector('[data-mladv]').click(); ok('every provider fills in its own server and port');
w.document.querySelector('[data-mlprov="gmail"]').click();

// reset marks and send 23 attendees to check batching
ev(`S.regs=S.regs.filter(r=>r.eid!=='ABCDEF'||/tkt/.test(r.id));for(let i=0;i<19;i++)S.regs.push({id:'bulk'+String(i).padStart(8,'0'),eid:'ABCDEF',name:'Guest '+i,data:{f1:'Guest '+i,f2:'G'+i},em:'g'+i+'@students.example',in:false,at:100+i});S.regs.forEach(r=>{delete r.ml;delete r.mlv;delete r.mlk});render()`);
w.document.querySelector('[data-mlstep="1"]').click(); w.document.querySelector('[data-mlstep="3"]').click();
const total = ev(`S.regs.filter(r=>r.eid==='ABCDEF'&&r.em).length`);
w.document.querySelector('[data-mlsend]').click();
w.document.querySelector('[data-mlstep="1"]') && w.document.querySelector('[data-mlstep="1"]').click();   // blocked while sending
assert.ok($('mlrun')); ok('you cannot leave step 3 while a send is running');
for (let i = 0; i < 60 && $('mlrun').textContent.includes('Sending'); i++) await tick(50);
const sent = fetchLog.filter(f => f.url.endsWith('/mail/send')).slice(-6), sizes = sent.map(f => f.body.messages.length);
console.log('    batches of:', sizes.join(', '), 'for', total, 'attendees');
assert.ok(sizes.every(x => x <= 4)); ok('large sends are split into batches of at most 4');
assert.ok(sent.every(f => f.body.messages.every(m => m.qr.length > 5 && /cid:/.test(m.html)))); ok('every email in a ticket send carries its QR picture');
assert.equal(ev(`S.regs.filter(r=>r.eid==='ABCDEF'&&r.mlv==='smtp'&&r.mlk==='t').length`), total - 1); ok('everyone delivered is marked emailed as a ticket (the refused mailbox is not)');
assert.match($('mlrun').textContent, /1 failed/); assert.match($('mlrun').textContent, /Mailbox unavailable/); assert.match($('mlrun').textContent, /Fail Case/); ok('the failure is listed by name with the reason, and the rest carried on');
w.document.querySelector('[data-mlstep="1"]').click();
assert.match($('mls').textContent, /Not emailed\s*1/); assert.match($('mls').textContent, new RegExp('Emailed\\s*' + (total - 1))); ok('People now shows only the failed one under Not emailed, ready for a retry');
ev(`for(let i=0;i<12;i++)S.regs.push({id:'more'+String(i).padStart(8,'0'),eid:'ABCDEF',name:'Extra '+i,data:{f1:'Extra '+i,f2:'X'+i},em:'x'+i+'@students.example',in:false,at:300+i,ml:Date.now(),mlv:'smtp',mlk:'t'})`); w.document.querySelector('[data-mlstep="1"]').click();
const emailed = total - 1 + 12;
w.document.querySelector('[data-mltab="done"]').click(); assert.equal(w.document.querySelectorAll('#mls .li').length, 30); assert.match($('mls').textContent, new RegExp('Show all ' + emailed)); ok('a long list shows 30 people and a "Show all" button');
w.document.querySelector('[data-mlmore="done"]').click(); assert.equal(w.document.querySelectorAll('#mls .li').length, emailed); ok('"Show all" shows everyone');
ev(`S.regs=S.regs.filter(r=>!/^more/.test(r.id))`);

// invitation send by SMTP to the one left
w.document.querySelector('[data-mlgo="2"]').click(); w.document.querySelector('[data-mlgo="3"]').click();
w.document.querySelector('[data-mlgo="2"]').click(); $('mltk').checked = false; $('mltk').dispatchEvent(new w.Event('change', { bubbles: true })); w.document.querySelector('[data-mlgo="3"]').click();
ev(`S.regs.find(r=>r.id==='tkt4dddddddd').em='fine@students.example'`);
w.document.querySelector('[data-mlsend]').click(); await tick(300);
const last = fetchLog.filter(f => f.url.endsWith('/mail/send')).at(-1).body.messages;
assert.equal(last.length, 1); assert.equal(last[0].qr, ''); assert.equal(last[0].ticket, ''); assert.match(last[0].subject, /^You are invited/); assert.doesNotMatch(last[0].html, /cid:|ticket\.html/); assert.doesNotMatch(last[0].text, /ticket\.html/);
assert.equal(ev(`S.regs.find(r=>r.id==='tkt4dddddddd').mlk`), 'i'); ok('an automatic invitation goes out with no QR, no ticket picture and no ticket link, and is marked as an invitation');

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
