/* CEM Pro (CEM 4.2.0): the AI assistant inside every open event (Google Gemini, free tier) through your own Worker (POST /ai/chat).
   Open an event, tap the CEM Pro button. It sits above the phone's bottom bar and opens as a full-screen chat on phones.
   WHAT IT DOES
   - Event page: description, registration questions.   - Team: tasks, items to buy.   - Money: payment links, break-even analysis, budget creation, sponsor tracking.
   - Reach out: email attendees (opens the app's email window with the draft) and sponsor outreach (sends from the organiser's own mailbox, or opens the mail app).
   - Help: how-to questions and common problems are answered from the app's own Help & guides, on the device, with buttons that open Help & guides and the Tutorials page.
   - "What can you do?", greetings, how-to answers and plain break-even questions are answered on the device with no network call.
   PRIVACY BY DESIGN
   - Nothing is sent until the user accepts the notice (stored on this device only; "Privacy" lets them withdraw).
   - Before sending, team names are replaced by tokens (P1, P2, "me") and emails, phone numbers, UPI ids, ID numbers and links are replaced by [..].
     The Worker repeats this check. Real names are put back only on this device.
   - Never sent: attendee lists, registrations, payments, UPI ids, tickets, chat messages, saved budgets/sponsors/contacts. Only the event title/type/date/venue,
     team ROLES (not names), group names and registration question labels go along as context. Break-even is calculated on the device from the real figures.
   - Payee name, UPI id, sponsor contact and sponsor email address are typed into the confirm card and stay on the device. The mailbox login is read from this device only.
   - The AI only PROPOSES. Every action needs a tap on its card button and is checked against the user's role again here. No email leaves without a tap.
   - The conversation lives in memory only and disappears when the app is closed. */
(function(){
'use strict';
const KEY='cem-ai-ok-v1',MAXIN=600,MAXH=8;
const $=id=>document.getElementById(id);
const me=()=>window.MYUID||'me',myNm=()=>String(window.MYNAME||'').trim();
const A={open:false,busy:false,view:'chat',msgs:[],map:{},names:[],left:null,pin:false,jump:null};
let nid=0,pending=0;
const okConsent=()=>{try{return localStorage.getItem(KEY)==='1'}catch(e){return false}};
const setConsent=on=>{try{on?localStorage.setItem(KEY,'1'):localStorage.removeItem(KEY)}catch(e){}};
const API=()=>String(window.OTP_API||'').trim().replace(/\/+$/,'');
const num=(v,max)=>Math.max(0,Math.min(max||1e7,Math.round((+v||0)*100)/100));
const R=n=>window.inr?inr(n):'₹'+(Math.round((+n||0)*100)/100).toLocaleString('en-IN');
const feeOf=E=>Math.max(0,+(E&&E.pay&&E.pay.fee)||0);
const regs=E=>typeof regsOf==='function'?regsOf(E.id):[];

/* ---------- privacy: scrub numbers/addresses, mask names ---------- */
const SCRUBS=[[/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g,'[email]'],[/\b[A-Za-z0-9._-]{2,}@[A-Za-z][A-Za-z0-9]{1,}\b/g,'[upi]'],[/https?:\/\/\S+/gi,'[link]'],
 [/\+\d{1,3}[\s-]?\d[\d\s-]{7,13}\d/g,'[number]'],[/\b\d{5}[\s-]\d{5}\b/g,'[number]'],[/\b\d{4}\s\d{4}\s\d{4}\b/g,'[number]'],[/\d{10,}/g,'[number]']];
function scrub(s){let n=0;s=String(s==null?'':s);SCRUBS.forEach(([re,to])=>{s=s.replace(re,()=>{n++;return to})});return[s,n]}
const esr=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function nameRe(w){try{return new RegExp('(?<![\\p{L}\\p{N}])'+esr(w)+'(?![\\p{L}\\p{N}])','giu')}catch(e){try{return new RegExp('\\b'+esr(w)+'\\b','gi')}catch(x){return null}}}
function mask(text){let n=0,t=String(text==null?'':text);A.names.forEach(([w,tok])=>{const re=nameRe(w);if(re)t=t.replace(re,()=>{n++;return tok})});return[t,n]}
const hide=s=>{const a=mask(s),b=scrub(a[0]);return[b[0],a[1]+b[1]]};
const unmask=s=>String(s==null?'':s).replace(/\bP(\d{1,2})\b/g,(m)=>{const id=A.map[m];if(!id)return m;const p=ppl().find(q=>q.id===id);return p&&p.n?p.n:m});
const cl=(s,n)=>String(s==null?'':s).replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
const clm=(s,n)=>String(s==null?'':s).replace(/\r/g,'').replace(/\n{3,}/g,'\n\n').trim().slice(0,n);
const ppl=()=>{const E=cur();return E&&window.peopleOf?peopleOf(E):[]};
const today=()=>{const t=new Date();return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0')};
const okDate=s=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s||'');if(!m)return false;const d=new Date(+m[1],m[2]-1,+m[3]);return d.getMonth()===m[2]-1&&d.getDate()===+m[3]};

/* ---------- what this user may do (the server is told the same list, and each action is checked again on Confirm) ---------- */
function allowed(E){const a=[];
 if(can(E,'event'))a.push('write_event_description','add_registration_questions');
 if(E.cloud&&can(E,'newlink'))a.push('create_payment_link');
 if(can(E,'addtask'))a.push('assign_task');
 if(can(E,'items'))a.push('add_shopping_item');
 if(can(E,'exp'))a.push('analyze_breakeven','create_budget','add_sponsor','draft_sponsor_email');   // money: the same people who see Expenses and Income
 if(can(E,'regs'))a.push('email_attendees');
 return a}
const selfId=E=>E.cloud?me():'me';
function taskWho(E){const p=peopleOf(E);let l=can(E,'tasks')?p:p.filter(x=>mineIdsOf(E).includes(x.id));const ids=l.map(x=>x.id);ids.push(selfId(E));return[...new Set(ids)]}
function itemWho(E){const ids=peopleOf(E).map(x=>x.id);if(!E.cloud)ids.push('me');return[...new Set(ids)]}
const nameOf=(E,id)=>id==='me'?'Me':id===me()?'Me':(peopleOf(E).find(p=>p.id===id)||{n:'Unassigned'}).n;
function roleTxt(E,p){try{return p.acct&&window.roleLabel?roleLabel(E,p.r):cl(p.r||'Member',30)}catch(e){return 'Member'}}

function build(E){
 A.map={};A.names=[];const list=[],words={};let n=0;
 const P=peopleOf(E),nm=p=>String(p.n||'').trim(),parts=s=>s.split(/\s+/).filter(w=>w.length>=3);
 P.forEach(p=>parts(nm(p)).forEach(w=>{const k=w.toLowerCase();words[k]=(words[k]||0)+1}));
 P.forEach(p=>{const s=nm(p);if(!s)return;let tok;
  if(p.id===me()||p.id==='me')tok='me';else{tok='P'+(++n);A.map[tok]=p.id;list.push({t:tok,role:roleTxt(E,p)})}
  A.names.push([s,tok]);parts(s).forEach(w=>A.names.push([w,words[w.toLowerCase()]>1&&tok!=='me'?'[name]':tok]))});
 const mn=myNm();if(mn&&mn!=='Me'){A.names.push([mn,'me']);parts(mn).forEach(w=>A.names.push([w,'me']))}
 A.names.sort((a,b)=>b[0].length-a[0].length);
 const h=s=>hide(cl(s,100))[0];
 return{today:today(),allow:allowed(E),people:list,event:{name:h(E.name),type:cl(E.type,20),date:cl(E.date,10),time:cl(E.time,5),venue:h(E.venue),cap:+E.cap||0},
  groups:(E.groups||[]).map(g=>h(g.n)),questions:(E.fields||[]).map(f=>h(f.label))}}

/* ---------- network ---------- */
async function token(force){const f=window.firebase,u=f&&f.apps&&f.apps.length&&f.auth().currentUser;if(!u)throw new Error('Sign in to use the AI helper.');return u.getIdToken(!!force)}
async function call(body){
 const base=API();if(!base)throw new Error('The AI helper is not set up (OTP_API is empty).');
 for(let i=0;i<2;i++){
  const tk=await token(i===1);let r,j=null;
  try{r=await fetch(base+'/ai/chat',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tk},body:JSON.stringify(body)})}catch(e){throw new Error('No internet. The AI helper needs a connection.')}
  try{j=await r.json()}catch(e){}
  if(r.status===401&&i===0)continue;
  if(!r.ok||!j||!j.ok)throw new Error((j&&j.message)||'The AI helper is not available right now.');
  return j}}

/* ---------- turn the model's proposals into cards (everything is re-validated here) ---------- */
function mkCard(c,E){
 const a=c.args||{},id='k'+(++nid);let v=null;
 const who=(t,fallback)=>{const s=String(t||'').trim();return A.map[s]||(s==='me'?selfId(E):fallback)};
 switch(c.name){
  case 'write_event_description':{const t=clm(unmask(a.description),500);if(!t)return null;v={desc:t};break}
  case 'create_payment_link':{const t=cl(unmask(a.title),60);if(!t)return null;const p=E.pay||{};
   v={title:t,amt:String(Math.max(0,Math.min(1e6,Math.round((+a.amount||0)*100)/100))),note:cl(unmask(a.note),140),payee:p.payee||'',upi:p.upi||''};break}
  case 'add_registration_questions':{const have=new Set((E.fields||[]).map(f=>String(f.label||'').toLowerCase()));const q=[];
   (Array.isArray(a.questions)?a.questions:[]).slice(0,8).forEach(x=>{if(!x)return;const label=cl(unmask(x.label),60);if(!label||have.has(label.toLowerCase()))return;have.add(label.toLowerCase());
    let type=['text','select','checkbox'].includes(x.type)?x.type:'text',opts=type==='select'?cl(x.options,200).split(',').map(s=>s.trim()).filter(Boolean).slice(0,10).join(','):'';
    if(type==='select'&&opts.split(',').length<2){type='text';opts=''}q.push({label,type,req:!!x.required&&type!=='checkbox',opts,on:true})});
   if(!q.length)return null;v={q};break}
  case 'assign_task':{const t=cl(unmask(a.title),120);if(!t)return null;const gs=E.groups||[],gn=cl(a.group,40).toLowerCase(),g=gs.find(x=>String(x.n||'').toLowerCase()===gn)||gs[0];
   v={t,who:who(a.assignee,selfId(E)),due:okDate(a.due_date)?a.due_date:'',gid:g?g.id:'',desc:clm(unmask(a.details),300)};break}
  case 'add_shopping_item':{const t=cl(unmask(a.item),80);if(!t)return null;
   v={t,q:String(Math.max(1,Math.min(999,Math.round(+a.quantity)||1))),p:String(Math.max(0,Math.min(1e6,Math.round((+a.price_each||0)*100)/100))),who:who(a.assignee,'')};break}
  case 'analyze_breakeven':{if(!can(E,'exp'))return null;const b=String(a.cost_basis||'').toLowerCase();
   v={price:+a.ticket_price>0?String(num(a.ticket_price,1e6)):'',extra:+a.extra_sponsorship>0?String(num(a.extra_sponsorship)):'',basis:b==='budget'?'plan':b==='actual'?'act':''};break}
  case 'create_budget':{const have=new Set((E.bud||[]).map(b=>String(b.n||'').toLowerCase())),seen=new Set(),lines=[];let skip=0;
   (Array.isArray(a.lines)?a.lines:[]).slice(0,12).forEach(x=>{if(!x)return;const n=cl(unmask(x.name),40);if(!n)return;const k=n.toLowerCase();if(have.has(k)||seen.has(k)){skip++;return}seen.add(k);lines.push({n,a:String(num(x.amount)),on:true})});
   if(!lines.length)return null;v={lines,skip};break}
  case 'add_sponsor':{const n=cl(unmask(a.name),60);if(!n)return null;v={n,k:['Sponsor','Donation','Other'].includes(a.kind)?a.kind:'Sponsor',cm:String(num(a.committed)),rc:'0',pr:clm(unmask(a.benefits),300),ct:''};break}
  case 'draft_sponsor_email':{const s=cl(unmask(a.subject),120),b=clm(unmask(a.body),2500);if(!s||!b)return null;v={to:'',sponsor:'',subject:s,body:b};break}
  case 'email_attendees':{const s=cl(unmask(a.subject),120),b=clm(unmask(a.body),2500);if(!s||!b)return null;v={subject:s,body:b,ticket:!!a.include_ticket};break}
  default:return null}
 return{id,name:c.name,eid:E.id,v,st:'open',res:''}}

/* ---------- applying a confirmed card ---------- */
function apply(c){
 const E=ev(c.eid);if(!E)return[0,'That event is no longer here.'];if(typeof ensure==='function')ensure(E);const v=c.v;
 switch(c.name){
  case 'write_event_description':{if(!can(E,'event'))return[0,'Your role cannot edit the event.'];const t=clm(v.desc,500);if(!t)return[0,'The description is empty.'];E.desc=t;sv();return[1,'Description saved.']}
  case 'create_payment_link':{
   if(!E.cloud)return[0,'Share this event with your team first (payment links need an online event).'];if(!can(E,'newlink'))return[0,'Your role cannot create payment links.'];
   const title=cl(v.title,60),amt=Math.max(0,Math.min(1e6,Math.round((+v.amt||0)*100)/100)),upi=String(v.upi||'').trim(),payee=cl(v.payee,60);
   if(!title)return[0,'Add a title.'];if(!payee)return[0,'Type the payee name (stays on this device).'];if(!/^[\w.\-]{2,}@[A-Za-z][A-Za-z0-9]{1,}$/.test(upi))return[0,'Type a valid UPI ID, like name@bank (stays on this device).'];
   if(window.untilOf&&Date.now()>untilOf(E))return[0,'This event is over, so the link would already be expired.'];
   const id=(uid()+uid()).slice(0,12),fm={id,title,amt,upi,payee,note:cl(v.note,140),by:me(),byName:window.MYNAME||'Me',at:Date.now()};
   E.forms.push(fm);if(can(E,'pay'))E.pay=Object.assign(E.pay||{},{upi,payee});if(window.pubForm)window.pubForm(fm,E);sv();
   const b=window.siteBase?siteBase():'';c.link=b?b+'pay.html?f='+id:'';return[1,'Payment link created.'+(c.link?'':' Open the Payments tab to copy it.')]}
  case 'add_registration_questions':{
   if(!can(E,'event'))return[0,'Your role cannot edit the event.'];E.fields=E.fields||[];const add=v.q.filter(q=>q.on&&cl(q.label,60));
   if(!add.length)return[0,'Tick at least one question.'];if(E.fields.length+add.length>14)return[0,'A form can have up to 14 questions.'];
   add.forEach(q=>E.fields.push({id:uid(),label:cl(q.label,60),type:q.type,req:!!q.req,opts:q.type==='select'?q.opts:''}));sv();return[1,add.length+' question'+(add.length>1?'s':'')+' added.']}
  case 'assign_task':{
   if(!can(E,'addtask'))return[0,'Your role cannot add tasks.'];const t=cl(v.t,120);if(!t)return[0,'Add a task title.'];
   if(!taskWho(E).includes(v.who))return[0,'You can only assign to yourself or the people who report to you.'];if(v.due&&!okDate(v.due))return[0,'That date is not valid.'];
   let gid=v.gid;if(!(E.groups||[]).some(g=>g.id===gid)){if(!can(E,'tasks'))return[0,'Ask a manager to create a task group first.'];gid=uid();E.groups.push({id:gid,n:'General'})}
   const tk={id:uid(),gid,t,who:v.who,due:v.due||'',done:false,by:me()};const d=clm(v.desc,600);if(d)tk.desc=d;E.tasks.push(tk);sv();return[1,'Task added for '+nameOf(E,v.who)+'.']}
  case 'add_shopping_item':{
   if(!can(E,'items'))return[0,'Your role cannot add items.'];const t=cl(v.t,80);if(!t)return[0,'Add an item name.'];if(v.who&&!itemWho(E).includes(v.who))return[0,'Pick someone from the list.'];
   E.itm.push({id:uid(),t,q:Math.max(1,Math.round(+v.q)||1),p:Math.max(0,Math.round((+v.p||0)*100)/100),c:'',who:v.who||'',s:'todo',by:me(),at:Date.now()});sv();return[1,'Item added.']}
  case 'create_budget':{
   if(!can(E,'exp'))return[0,'Your role cannot edit the budget.'];E.bud=E.bud||[];
   const have=new Set(E.bud.map(b=>String(b.n||'').toLowerCase())),add=[];
   v.lines.forEach(l=>{const n=cl(l.n,40);if(!l.on||!n||have.has(n.toLowerCase()))return;have.add(n.toLowerCase());add.push({id:uid(),n,a:num(l.a),at:Date.now()})});
   if(!add.length)return[0,'Tick at least one line with a new name.'];if(E.bud.length+add.length>40)return[0,'A budget can have up to 40 lines.'];
   E.bud.push(...add);sv();return[1,add.length+' budget line'+(add.length>1?'s':'')+' added, '+R(add.reduce((t,x)=>t+x.a,0))+' in total.']}
  case 'add_sponsor':{
   if(!can(E,'exp'))return[0,'Your role cannot manage sponsors.'];const n=cl(v.n,60);if(!n)return[0,'Add the sponsor name.'];
   E.spn=E.spn||[];E.spn.push({id:uid(),at:Date.now(),by:me(),n,k:['Sponsor','Donation','Other'].includes(v.k)?v.k:'Sponsor',cm:num(v.cm),rc:num(v.rc),pr:clm(v.pr,500),ct:cl(v.ct,100)});sv();
   return[1,n+' added to sponsors.']}
  case 'email_attendees':{
   if(!can(E,'regs'))return[0,'Your role cannot email attendees.'];if(typeof window.openMailer!=='function')return[0,'The email window is not available in this version.'];
   const s=cl(v.subject,120),tk=!!v.ticket;let b=clm(v.body,2500);if(!s||!b)return[0,'Add a subject and a message.'];
   b=b.replace(/\{(?:qr|ticket_link)\}/g,'').replace(/\n{3,}/g,'\n\n').trim();if(tk)b+='\n\nYour personal ticket:\n{qr}';
   let old={};try{old=JSON.parse(localStorage.getItem('cem-mail-tpl:'+E.id)||'{}')||{}}catch(e){}
   try{localStorage.setItem('cem-mail-tpl:'+E.id,JSON.stringify({ticket:tk,subject:s,body:b,fromName:old.fromName!=null?old.fromName:(E.name||'Event')+' team'}))}catch(e){return[0,'This device would not save the draft.']}
   shut();setTimeout(()=>window.openMailer(E.id),60);return[1,'Draft sent to the email window. Choose who gets it and press Send there.']}}
 return[0,'Unknown action.']}

/* ---------- brand + icons ---------- */
const MARK='<svg viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="120" fill="#5948F5"/><path fill="#F6F7FB" transform="translate(136.4 105.2) scale(1.3)" d="M34 0 H160 A24 24 0 0 1 184 24 A24 24 0 0 1 160 48 H62 A14 14 0 0 0 48 62 V78 A14 14 0 0 0 62 92 H160 A24 24 0 0 1 184 116 A24 24 0 0 1 160 140 H62 A14 14 0 0 0 48 154 V170 A14 14 0 0 0 62 184 H160 A24 24 0 0 1 184 208 A24 24 0 0 1 160 232 H34 A34 34 0 0 1 0 198 V34 A34 34 0 0 1 34 0 Z"/></svg>';
const IC={
 chart:'<path d="M4 20V11M10 20V4M16 20v-6M22 20H2"/>',
 wallet:'<path d="M3 7a2 2 0 0 1 2-2h12v3"/><path d="M3 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2z"/><circle cx="16.5" cy="14.5" r="1"/>',
 star:'<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
 mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
 send:'<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>',
 link:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
 task:'<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h9"/>',
 cart:'<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.6 12.4a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L21 7H6"/>',
 doc:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
 form:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
 lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
 trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
 close:'<path d="M6 6l12 12M18 6L6 18"/>',
 help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.6a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/>',
 bolt:'<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
 book:'<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M9 7h6"/>',
 play:'<circle cx="12" cy="12" r="9"/><path d="M10 8.5l5 3.5-5 3.5z"/>'};
const ic=n=>`<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${IC[n]||''}</svg>`;
const av=()=>`<span class="aiav">${MARK}</span>`;

/* ---------- what CEM Pro can do (also drives the menu and the "what can you do?" answer) ---------- */
const GROUPS=['Money','Reach out','Team','Event page','Help'];
const CAP=[
 {k:'analyze_breakeven',g:'Money',ic:'chart',t:'Break-even analysis',d:'Tickets needed to cover costs, with what-if pricing',q:'Break-even',p:'Run a break-even analysis for this event.'},
 {k:'create_budget',g:'Money',ic:'wallet',t:'Budget creation',d:'Draft budget lines that fit your total',q:'Budget',p:'Create a budget for this event with a total of ₹',fill:1},
 {k:'add_sponsor',g:'Money',ic:'star',t:'Sponsor tracking',d:'Record a sponsor, amount and what you offer back',q:'Sponsor',p:'Add a sponsor: ',fill:1},
 {k:'create_payment_link',g:'Money',ic:'link',t:'Payment link',d:'A page where people pay by UPI',q:'Payment link',p:'Create a payment link for the entry fee of ₹',fill:1},
 {k:'draft_sponsor_email',g:'Reach out',ic:'send',t:'Sponsor outreach',d:'Write a sponsorship request and send it',q:'Sponsor email',p:'Write a sponsorship request email to a local company for this event.'},
 {k:'email_attendees',g:'Reach out',ic:'mail',t:'Email attendees',d:'Reminders and updates, sent from your own mailbox',q:'Email attendees',p:'Draft a reminder email for all attendees of this event.'},
 {k:'assign_task',g:'Team',ic:'task',t:'Assign a task',d:'Give work to a teammate with a due date',q:'Task',p:'Assign a task: ',fill:1},
 {k:'add_shopping_item',g:'Team',ic:'cart',t:'Item to buy',d:'Add to the shopping list with a price',q:'Item to buy',p:'Add an item to buy: ',fill:1},
 {k:'write_event_description',g:'Event page',ic:'doc',t:'Event description',d:'A short, clear write-up for the event page',q:'Description',p:'Write a short, exciting description for this event.'},
 {k:'add_registration_questions',g:'Event page',ic:'form',t:'Registration questions',d:'Questions that suit this type of event',q:'Questions',p:'Add registration questions suitable for this event.'},
 {k:'faq',always:1,g:'Help',ic:'help',t:'How-to questions',d:'Step-by-step answers about the app',q:'How-to',p:'How do I ',fill:1},
 {k:'fix',always:1,g:'Help',ic:'bolt',t:'Fix a problem',d:'Solutions to common issues',q:'Fix a problem',p:'I have a problem: ',fill:1},
 {k:'guide',always:1,act:'help',g:'Help',ic:'book',t:'Help & guides',d:'The full written guide',q:'Help & guides'},
 {k:'tut',always:1,act:'tut',g:'Help',ic:'play',t:'Tutorials',d:'Short animated walkthroughs',q:'Tutorials'}];
const firstName=()=>{const n=myNm();return n&&n!=='Me'?n.split(/\s+/)[0]:''};

function capsHtml(E,hello){
 const al=allowed(E),rows=CAP.filter(c=>c.always||al.includes(c.k)),nm=esc(E.name||'this event'),hi=hello&&firstName()?'Hi '+esc(firstName())+'. ':'',acts=rows.some(c=>!c.always);
 const intro=acts?`${hi}I'm <b>CEM Pro</b>, your planning assistant for <b>${nm}</b>. I draft, you confirm: nothing changes until you tap the button on a card. Money figures are worked out on this device. Ask me how to do something, or what went wrong, and I will point you to Help &amp; guides.`
  :`${hi}I'm <b>CEM Pro</b>. Your role in <b>${nm}</b> lets you chat but not draft changes, but I can still answer how-to questions and point you to Help &amp; guides.`;
 return`<div class="air">${av()}<div class="aib a">${intro}</div></div>
 <div class="aicaps">${GROUPS.map(g=>{const l=rows.filter(c=>c.g===g);return l.length?`<div class="aicg"><h5>${g}</h5><div class="gr">${l.map(c=>`<button type="button" class="aicap" data-a="chip" data-i="${CAP.indexOf(c)}"><i>${ic(c.ic)}</i><b>${c.t}</b><small>${c.d}</small></button>`).join('')}</div></div>`:''}).join('')}</div>`}

/* ---------- break-even, worked out on this device from the real figures (nothing is sent) ---------- */
function beCalc(E,v){
 const mb=window.moneyBrief?moneyBrief(E):{plan:0,paid:0,due:0},rs=regs(E),spn=E.spn||[];
 const basis=v.basis||(mb.plan>0?'plan':'act'),cost=basis==='plan'?mb.plan:(mb.paid+mb.due);
 const price=v.price!==''&&v.price!=null?num(v.price,1e6):feeOf(E),cap=+E.cap||0,extra=num(v.extra);
 const spIn=spn.reduce((t,s)=>t+(+s.rc||0),0),spOut=spn.reduce((t,s)=>t+Math.max(0,(+s.cm||0)-(+s.rc||0)),0),spAll=spIn+spOut+extra;
 const gap=cost-spAll,need=gap<=0?0:(price>0?Math.ceil(gap/price):Infinity),full=price*cap+spAll;
 return{basis,cost,price,cap,spAll,extra,gap,need,n:rs.length,paidN:rs.filter(r=>r.paid).length,full,surplus:full-cost,
  priceFull:cap>0&&gap>0?Math.ceil(gap/cap):0,price70:cap>0&&gap>0?Math.ceil(gap/(cap*.7)):0}}
function beVerdict(f){
 if(f.cost<=0)return['','No costs to compare yet','Ask me to create a budget, or record bills in Expenses, then run this again.'];
 if(f.gap<=0)return['ok','Costs are already covered','Sponsorship of '+R(f.spAll)+' covers the '+R(f.cost)+' cost, so every ticket is surplus.'];
 if(f.price<=0)return['warn','Set a ticket price','Costs are '+R(f.cost)+' and sponsorship covers '+R(f.spAll)+', so '+R(f.gap)+' is not covered. Enter a price below to test.'];
 if(f.cap>0&&f.need>f.cap)return['bad','A full house will not cover the costs','You would be '+R(f.cost-f.full)+' short. Raise the price, add sponsors or cut costs.'];
 const left=f.need-f.n;
 return[left<=0?'ok':'warn','Break even at '+f.need+' ticket'+(f.need===1?'':'s'),(f.cap>0?'That is '+Math.round(f.need/f.cap*100)+'% of your '+f.cap+' seats. ':'')+(left<=0?'You already have '+f.n+' registered.':left+' more registration'+(left===1?'':'s')+' to go ('+f.n+' registered).')]}
function beResHtml(c){
 const E=ev(c.eid);if(!E)return'';const f=beCalc(E,c.v),b=beVerdict(f),fin=isFinite(f.need);
 const pct=fin&&f.need>0?Math.min(100,Math.round(f.n/f.need*100)):(f.gap<=0&&f.cost>0?100:0);
 const cells=[['Total cost',R(f.cost)],['Sponsorship',R(f.spAll)],['Ticket price',R(f.price)],['Break-even',f.gap<=0?'Covered':fin?f.need+' tickets':'Set a price'],['If every seat sells',R(f.full)],[f.surplus>=0?'Surplus':'Shortfall',R(Math.abs(f.surplus))]];
 return`<div class="aiv ${b[0]}"><b>${esc(b[1])}</b><span>${esc(b[2])}</span></div>`+
 (fin&&f.need>0?`<div class="aim"><div><span>Registered toward break-even</span><b>${Math.min(f.n,f.need)} of ${f.need}</b></div><div class="aitr" role="img" aria-label="${f.n} registered, ${f.need} needed"><i style="width:${pct}%"></i></div></div>`:'')+
 `<div class="aigrid">${cells.map(x=>`<div><span>${x[0]}</span><b>${esc(x[1])}</b></div>`).join('')}</div>`+
 (f.gap>0&&f.cap>0?`<div class="ain">To break even with only 70% of seats sold, price tickets at ${R(f.price70)} or more. With every seat sold, ${R(f.priceFull)}.</div>`:'')+
 `<div class="ain">${R(f.price)} × ${f.cap} seats = ${R(f.price*f.cap)}, plus sponsorship ${R(f.spAll)}, against costs of ${R(f.cost)} (${f.basis==='plan'?'budget':'spent + still to pay'}).</div>`}

/* ---------- FAQ: how-to answers and fixes, taken from Help & guides (answered on the device, so it never invents a step) ----------
   t = question, k = keywords, p = a problem (solution) rather than a how-to, sec = Help & guides section, tut = tutorial page, do = a CEM Pro function that can do it for the user.
   Words between *stars* are shown bold. Keep every answer in line with help.js. */
const TUT_URL=(window.TUT_URL||'https://cem.deba.indevs.in/tutorials/');
const FAQ=[
{id:'create-event',t:'How do I create an event?',k:['create event','new event','add event','make event','publish event','start an event','set up an event'],sec:'start',tut:'create-event.html',ol:1,
 a:['Tap *New event* in the top menu.','Fill in the name, type, date, venue, capacity and description.','Pick the type and tap *Load form for this type* for a ready-made registration form. Add, remove or rename questions as you like.','Tap *Publish event*.']},
{id:'edit-event',t:'How do I change the date, venue or registration questions?',k:['edit event','change date','change the date','change venue','change the venue','registration question','registration form','rename event','update event','change description'],sec:'details',do:'add_registration_questions',ol:1,
 a:['Open the event, go to the *Details* tab and choose *Edit event*.','You need to be the Organizer, a Manager, or have a role with the *Edit event* permission.'],n:'CEM Pro can also write the description or add registration questions for you. Just ask.'},
{id:'join-team',r:['cant-join','roles'],t:'How do I get the event code and join a team?',k:['join','event code','invite code','team code','invite','share with team','join event','join team','6 letter'],sec:'start',tut:'join-organising-team.html',ol:1,
 a:['Organizer: open the event, go to *Details* and tap *Share with team* (you must be signed in). You get a 6-letter event code.','Send the code to your team, for example on WhatsApp.','Everyone else: tap the join-team icon in the top bar (or profile icon > *Account, alerts & join event* > *Join an event*) and type the code.','New people join as *Member*. The Organizer or a Manager can change the role in the *People* tab.']},
{id:'cant-join',r:['join-team'],t:'I cannot join an event with the code',k:['join','cant join','cannot join','code not working','invalid code','wrong code','code doesnt work','wont join','join failed'],p:1,sec:'start',tut:'join-organising-team.html',
 a:['The event must be shared first: the Organizer opens *Details* and taps *Share with team*. Events that are not shared stay on one device only.','Check the code: it is 6 letters and is shown on the event\'s *Details* tab. Ask the Organizer to send it again.','You must be signed in to join.']},
{id:'roles',r:['no-permission'],t:'How do roles and custom roles work?',k:['role','custom role','permission','manager','treasurer','change role','give role','make someone'],sec:'roles',tut:'roles-and-custom-roles.html',ol:1,
 a:['Open the *People* tab and use the role drop-down next to a person. The Organizer can give any role except Organizer; a Manager can give any role except Manager and Organizer.','Custom role: *People* tab > *Custom roles* > *+ New role*. Name it, optionally copy permissions from another role, tick what you want and tap *Create role*.','Give it to someone with the role drop-down. Editing a role changes it for everyone who holds it.','A role with nothing ticked can only read, like a Viewer.']},
{id:'no-permission',r:['roles'],t:'It says "No permission" or a tab or button is missing',k:['permission','no permission','not allowed','cant edit','cannot edit','cant see','cannot see','missing tab','missing button','button missing','tab missing','income tab','expenses tab','dont see','access denied'],p:1,sec:'roles',tut:'roles-and-custom-roles.html',
 a:['Your role in this event does not allow that. Ask the Organizer or a Manager to change your role in the *People* tab.','The *Income* and *Expenses* tabs show only for roles with the Money permission (Organizer, Manager, Treasurer, Sponsorship lead, or a custom role with it).','If a newer role does not work for anyone, the administrator may not have published the latest *firestore.rules* in Firebase.']},
{id:'tasks',r:['people'],t:'How do I assign tasks and items to buy?',k:['task','assign','task group','item to buy','shopping list','my tasks','add task','add item'],sec:'tasks',tut:'assign-tasks-and-track-items.html',do:'assign_task',ol:1,
 a:['Open the *Tasks* tab. Use *+ New group* or *Add standard groups* to keep tasks tidy.','Tap *+ Add task*: a title, who it is for, an optional due date and an optional *Brief*. Tick the box when it is done.','Items: tap *+ Add item* with a quantity, estimated cost and the person who buys it. When it is bought, tick it and enter the real cost.','Everyone sees their own work under *My tasks* in the top menu.'],n:'Roles with Manage tasks can assign to anyone. Others can assign to themselves and to people who report to them.'},
{id:'payment-link',r:['payment-link-fix'],t:'How do I create a payment link and verify a payment?',k:['payment link','pay link','upi link','collect payment','collect money','donation link','verify payment','utr','create link','accept payment','take payment'],sec:'pay',tut:'create-payment-link.html',do:'create_payment_link',ol:1,
 a:['Open the *Income* tab and tap *+ New link*. Add a title, an optional amount (blank means any amount), your UPI ID, payee name and a note.','Share the link. The payer scans the QR code, pays, then sends their name and UTR on the page. They need no account.','Open the *Payments* tab, check each payment against your bank or UPI app, then tap *Verify* or *Reject*.'],n:'Needs a shared event and your public site address (Income > Link settings).'},
{id:'payment-link-fix',r:['payment-link'],t:'My payment link is not working or has expired',k:['payment link','expired','link not working','link expired','link closed','payment link not','cant create link','cannot create link','link stopped','link doesnt work','site address','public site'],p:1,sec:'pay',tut:'create-payment-link.html',
 a:['Payment links need a *shared* event and your public site address. Save the address once under *Income* > *Link settings*, for example https://yourname.github.io/your-repo/.','A link stops working at the end of the event day. In *Link settings* you can keep links open for up to 30 extra days.','You need the Money permission to create links, and the Payments and online registration permission to verify payments and change link settings.']},
{id:'online-reg',r:['online-reg-fix','cash'],t:'How do I open online registration?',k:['online registration','registration link','register online','registration page','waitlist','approve application','application','qr registration','open registration'],sec:'online',ol:1,
 a:['Open *Attendees* > *Registration* > *Open online registration*. You need a shared event and your public site address.','Share the link or QR image. People need no account.','Set the ticket price in *Price and settings* (0 is free) and style the page in *Customize page and link*.','Review applications: *Approve* or *Reject*. When seats are full people join a waitlist; use *Promote* to move them in.'],n:'Needs the Payments and online registration permission (Organizer, Manager, Treasurer).'},
{id:'online-reg-fix',r:['online-reg'],t:'Online registration problems: link closed, junk applications, full event',k:['registration','registration closed','registration link not','junk applications','spam applications','flooded','fake applications','cant register','cannot register','already applied','same email','event full','registration not working'],p:1,sec:'online',
 a:['The page closes at the end of the event day unless you set a closing time in *Customize page and link*.','The same email address cannot apply twice. A College ID that is already registered is refused, and so is a full event (people join the waitlist instead).','If someone floods the form with junk, close online registration or remove those applications.']},
{id:'checkin',r:['scan-fix','tickets'],t:'How do I register attendees and check people in?',k:['check in','checkin','scan ticket','register attendee','add attendee','gate'],sec:'att',ol:1,
 a:['Open the *Attendees* tab. *Register attendee* opens a short form and is ready for the next person after each save.','*Check in* is one tap; *Undo* reverses it.','*Scan tickets*: the Android app uses Google\'s scanner; the website uses the camera, or you can type a ticket code or College ID.','Open the event once with internet before the gate opens. Scanning then works offline and check-ins are sent when the connection returns.'],n:'Needs a role with Attendees and check-in (Organizer, Manager, Treasurer, Team lead, Coordinator, Registration desk).'},
{id:'scan-fix',r:['checkin','tickets'],t:'Scanning or check-in is not working',k:['scan','scanning','check in','scan not working','cant scan','cannot scan','camera not working','ticket already used','already used','duplicate','not checked in','check in not working','qr not scanning','camera'],p:1,sec:'att',
 a:['A ticket that was already used shows when and by whom. A ticket works only once.','If a fee is unpaid, the scan shows a one-tap *Mark as paid*.','On the website the scanner needs camera permission. If the camera will not start, type the ticket code or the College ID instead.','Open the event once with internet before the gate opens so scanning also works offline.','You need a role with Attendees and check-in.']},
{id:'tickets',r:['email-attendees','checkin'],t:'How do I save or share a ticket (QR)?',k:['ticket','save ticket','share ticket','ticket png','qr code','ticket link','whatsapp ticket'],sec:'att',ol:1,
 a:['Open the attendee\'s *...* menu and choose *Ticket (QR)*.','Tap *Save ticket (PNG)*, share the picture or the ticket link, or send it by WhatsApp or email. Pick the *Gradient* or *Flat* look.','To send tickets to many people at once use *Email attendees*.'],n:'A shareable link needs your public site address (Income > Link settings).'},
{id:'import',t:'How do I import pre-registered attendees?',k:['import','csv','excel','xlsx','bulk upload','upload attendees','spreadsheet','import not working','import failed','xls'],sec:'att',ol:1,
 a:['Open *Attendees* > *Import pre-registered attendees*.','Choose a CSV, TSV, Excel (.xlsx, .xlsm) or OpenDocument (.ods) file.','Old .xls files: open them in Excel and *Save as .xlsx* first. Password-protected files are not supported.']},
{id:'email-attendees',r:['smtp','email-fix'],t:'How do I email tickets or invitations to attendees?',k:['email attendees','email tickets','send tickets','send invitation','invitation','bulk email','mass email','mail merge','email everyone','send email'],sec:'mail',tut:'setup-email-smtp.html',do:'email_attendees',ol:1,
 a:['Open *Attendees* > *Email attendees*. It has three steps: *People*, *Message* and *Send*.','In *Message*, tick or untick *Send a ticket with a QR code*. Unticked sends a plain invitation.','In *Send*, choose *This device\'s mail app* (one tap per person) or *My email account* (automatic, through SMTP).'],n:'Needs the Attendees and check-in permission. Every email goes from your own mailbox. CEM Pro can write the message for you.'},
{id:'smtp',r:['email-fix','email-attendees'],t:'How do I set up automatic email (SMTP)?',k:['smtp','app password','automatic email','send automatically','email account','gmail','brevo','zoho','yahoo','mail server','set up email','setup email'],sec:'mail',tut:'setup-email-smtp.html',ol:1,
 a:['Gmail: turn on 2-Step Verification in your Google account, open *App passwords*, create one called Campus Events and copy the 16 letters.','In the app: *Attendees* > *Email attendees* > *Send* > *My email account*. Tap *Gmail*, enter your full email address and paste the app password (not your normal password).','Always tap *Test connection*, then *Send a test email to me* before the real send.','No Gmail? Brevo is free (300 emails a day): verify your sender, create an *SMTP key* and tap *Brevo* in the app.'],n:'Your login stays on your device, never in the event. On a shared phone tap *Forget the saved login* when done.'},
{id:'email-fix',r:['smtp','email-attendees'],t:'Emails are not sending or the login fails',k:['email','email not sending','emails not sending','smtp failed','login failed','authentication','wrong password','app passwords missing','email failed','mail not sending','test connection','cant send email','cannot send email','email error','email problem','newer worker'],p:1,sec:'mail',tut:'setup-email-smtp.html',
 a:['Use an *app password*, not your normal password. Gmail needs 2-Step Verification turned on first.','If *App passwords* is missing, your college administrator has switched it off. Ask them, or use Brevo.','Brevo: the login is the SMTP login Brevo shows, the password is the SMTP key, and the sender email must be verified.','Outlook or Microsoft 365 may have password sign-in for SMTP switched off. Use Gmail, Brevo, Zoho or Yahoo instead.','If the app says it needs the newer Worker, send that line to the administrator. You must also be signed in and online.','If nothing opens in your mail app on a computer, set a default mail app or use the automatic option.'],n:'Limits: about 500 recipients a day on a personal Gmail, 2,000 on Workspace.'},
{id:'cash',t:'How do I take cash and UPI, and use cash collectors?',k:['cash','cash collector','collector','mark paid','paid','cash payment','upi payment','unpaid','cash due'],sec:'cash',ol:1,
 a:['Set a ticket price first: *Attendees* > *Registration* > *Price and settings*.','In the *Cash collectors* card pick people from the team, or type a name for someone outside the app.','Applicants then choose cash or UPI on the registration page.','Nothing is marked paid on the applicant\'s word. Tick *Paid* on the attendee after the cash is in hand or the UTR is confirmed.']},
{id:'budget',r:['sponsors','breakeven'],t:'How do I set a budget and record bills?',k:['budget','expense','bill','vendor','category','budget category','overdue','spend','spent'],sec:'money',do:'create_budget',ol:1,
 a:['Open the *Expenses* tab (needs the Money permission).','*Budget*: tap a common category or type your own, with a planned amount.','*Bills*: tap *+ Add bill* with what it is for, who you pay, the amount, a category and a due date. For a vendor with a UPI ID, *Pay via UPI* shows a QR code. Then tap *Mark paid* and add the mode and UTR.','The top card shows how much you can still spend. Bills still to pay and items to buy count as money about to go out.'],n:'CEM Pro can draft a whole budget from a total you give it.'},
{id:'sponsors',r:['breakeven','budget'],t:'How do I record sponsors and other income?',k:['sponsor','sponsorship','donation','donor','income','committed','received','promised'],sec:'money',do:'add_sponsor',ol:1,
 a:['Open the *Income* tab and find *Sponsors and other income*.','Tap *Add sponsor*. Record what was committed, what has arrived, what you promised in return, and whether it is delivered.','Sponsorship counts toward your break-even.'],n:'CEM Pro can add a sponsor for you or write the sponsorship request email.'},
{id:'breakeven',r:['budget','sponsors'],t:'What is break-even and how is it worked out?',k:['break even','breakeven','how many tickets','tickets needed','cover costs','profit','loss','full house'],sec:'money',do:'analyze_breakeven',
 a:['Income if every seat sells = ticket price x seats, plus sponsorship (received and still expected).','Cost = your budget, or what you have spent plus still have to pay. One tap switches between them.','Tickets needed = (cost - sponsorship) / ticket price, rounded up.','The ticket price comes from *Attendees* > *Registration* > *Price and settings*.'],n:'Ask CEM Pro to run a break-even analysis to test a different price or extra sponsorship.'},
{id:'export',t:'How do I export or download my data?',k:['export','download data','download','csv export','zip','backup','get data'],sec:'details',
 a:['Open the *Details* tab (or the *Income* tab) and use *Export data*.','Choose attendees, payments, bills or sponsors as CSV, or everything in one ZIP.','You only get the parts your role may see. On Android it opens the share sheet.']},
{id:'signin',r:['otp'],t:'How do I sign in or create an account?',k:['sign in','sign up','signin','signup','create account','login','log in','register account','google sign','new account','sign out','log out'],sec:'acct',tut:'signin&signup.html',
 a:['You can sign in with Google, or with an email and password.','To create an account with email, enter your details. The app sends a 6-digit code to that address; type it to finish.','To sign out, tap the profile icon and choose *Account, alerts & join event*.']},
{id:'otp',r:['signin'],t:'I did not get the 6-digit code',k:['code not received','didnt get code','didnt receive','otp','verification code','6 digit','not receiving code','no code','code not coming','code email'],p:1,sec:'acct',tut:'signin&signup.html',
 a:['Check your spam or junk folder and make sure the email address is typed correctly.','If the app asks for a particular college email address, use that one.','Wait a moment, then ask for a new code.','You can also sign in with Google instead.']},
{id:'chat',t:'How does the event chat work?',k:['chat','mention','tag someone','delete message','edit message'],sec:'chat',
 a:['Chat works in shared events. Everyone with at least one permission can write; a Viewer can only read.','Type *@* or tap the *@* button to tag someone. They get an alert.','You can edit or delete your own message for 2 hours. The Organizer, Managers and roles with Edit event can delete any message.']},
{id:'people',r:['tasks','roles'],t:'How do I add volunteers or make teams?',k:['volunteer','add person','participant team','team','make teams','people tab','remove person','remove member'],sec:'people',
 a:['Everyone who joins with the event code appears in the *People* tab.','*+ Add person* is for people who do not use the app, such as volunteers. Give a name, a title, a phone number and who they report to. They can be given tasks and items.','Participant teams: create a team by name, or split attendees into teams of a size you choose.','Removing someone makes their tasks unassigned.']},
{id:'calc',t:'What is the calculator for?',k:['calculator','calculate change','give change','cash count','split bill','event desk'],sec:'calc',
 a:['The calculator button next to the event name has four tools: *Calculator*, *Change* (price x quantity and the notes received), *Cash count* and *Split*.','Values stay on your device so an interrupted count is not lost.']},
{id:'account',t:'How do I change my name, theme or notifications?',k:['change name','my name','theme','dark mode','light mode','notification','alerts','ntfy','profile'],sec:'acct',
 a:['Tap the profile icon > *Account, alerts & join event*.','There you can change *Your name*, choose what you are notified about, join an event with a code and sign out.','*Theme* cycles Auto, Light and Dark.']},
{id:'update',r:['offline'],t:'How do I update the app, or why does it look old?',k:['update app','new version','apk','version','old version','looks old','reload','latest version','update'],sec:'acct',
 a:['Android app: profile icon > *About & updates* checks for a newer version. A new APK installs over the old one when it was built from the same repository with the same signing key.','Website: it is always the latest version. If it looks old, tap *Reload*.']},
{id:'offline',r:['update'],t:'Is my data safe offline, or not syncing?',k:['offline','no internet','sync','syncing','not syncing','data missing','not updating','cache','connection'],p:1,sec:'fix',
 a:['Your events are saved on the phone and sync when you are online.','Chat, payment links and online registration need a connection and a shared event.','Events that are not shared stay on your device only.','For scanning, open the event once with internet before the gate opens. Check-ins are sent when the connection returns.','On the website, if it looks out of date, tap *Reload*.']},
{id:'delete',t:'How do I delete or leave an event, or remove someone?',k:['delete event','leave event','remove registration','delete task','remove attendee','delete'],sec:'details',
 a:['The Organizer can open *Details* and tap *Delete event*. Its chat, payment links, expenses, sponsors and online registrations are deleted with it.','Everyone else sees *Leave event*.','To remove a registration open the attendee\'s *...* menu (needs the Edit event permission). Deleting asks first.']},
{id:'privacy',t:'Who can see attendee and money data?',k:['who can see','privacy','data safe','attendee data','private','visible','secure','safe'],sec:'fix',
 a:['Every member, including viewers, can read the attendee list with College IDs, phones and emails. Share the event code only with people you trust with those details.','Money data is visible only to roles with the Money permission.','CEM Pro hides names, numbers and contacts before anything is sent. Tap the lock icon at the top of this chat for details.']},
{id:'cem-pro-fix',t:'CEM Pro is not working or says "not set up"',k:['cem pro','ai not working','ai busy','messages left','ai limit','not set up','assistant not working','gemini','ai problem','ai error'],p:1,
 a:['"Not set up yet": the administrator must add the *GEMINI_API_KEY* secret to the Worker (see AI-SETUP.md).','"Busy" or "free AI limit": wait a minute and send again.','There is a daily limit per person; the counter shows under the message box. Greetings, "what can you do?", how-to answers and plain break-even run on your device and do not count.','"Sign in to use": CEM Pro needs a signed-in account and internet.']}
];
const norm=s=>' '+String(s||'').toLowerCase().replace(/['’]/g,'').replace(/[^a-z0-9 ]+/g,' ').replace(/\b(a|an|the|my|our|your)\b/g,' ').replace(/\s+/g,' ').trim()+' ';
FAQ.forEach(f=>{f.re=f.k.map(k=>{const p=norm(k).trim();return[new RegExp('\\b'+p.replace(/ /g,'\\s+')+'(?:s|es|ed|ing)?\\b'),p.includes(' ')?3:2]})});
const FAILRE=/\b(not working|not sending|not showing|doesnt work|wont work|failed|fails|failing|error|problem|issue|broken|not loading|not opening|not syncing|not get|not received)\b/;
const HELP_START=/^ (how|why|what|who|where|which|when|can i|can we|is there|is it|do i|do we|does|help|steps|explain|tell me how|i have a problem|problem|issue)\b/;   // a question, not an order
const HELP_ANY=/\b(how do|how can|how to|how should|cant|cannot|wont|doesnt|didnt|did not|isnt|not working|not sending|not showing|not loading|not opening|not syncing|not get|not received|not receiving|error|problems?|issues?|trouble|stuck|failed|fails|unable|broken|missing|wrong|invalid|faq|tutorial|guide)\b/;
const isHelp=q=>HELP_START.test(q)||HELP_ANY.test(q);
const PROB_RE=/\b(cant|cannot|wont|doesnt|dont|isnt|not|error|fail|failed|problem|issue|trouble|stuck|unable|missing|wrong|invalid|broken|why|problems|issues)\b/;
const APP_RE=/\b(app|tab|button|event|attendee|attendees|ticket|tickets|scan|check in|payment|link|email|smtp|role|permission|register|registration|sign|login|account|code|team|task|item|expense|income|sponsor|chat|notification|export|import|offline|sync|update|version|qr|upi|cash|budget|csv)\b/;
function faqRank(q){
 const prob=PROB_RE.test(q);
 return FAQ.map(f=>{let s=0;f.re.forEach(r=>{if(r[0].test(q))s+=r[1]});if(s){if(prob)s+=f.p?3:-1;else if(f.p)s-=1;if(f.p&&FAILRE.test(q))s+=1}return{f,s}}).filter(x=>x.s>0).sort((a,b)=>b.s-a.s)}
const fm=s=>esc(s).replace(/\*(.+?)\*/g,'<b>$1</b>');
function faqCard(f,E,rank){return{id:'k'+(++nid),name:'faq',eid:E.id,v:{id:f.id,rel:(f.r&&f.r.length?f.r:(rank||[]).filter(x=>x.f.id!==f.id&&x.s>=2).map(x=>x.f.id)).slice(0,2)},st:'open',res:''}}
function faqReply(text,E){
 const q=norm(text);if(!isHelp(q))return null;
 const r=faqRank(q);
 if(r.length&&(r[0].s>=3||(r[0].s>=2&&(r.length===1||r[0].s>r[1].s)))){const f=r[0].f;
  return{r:'a',t:'Here is the short answer. For the full walkthrough, open Help & guides'+(f.tut?' or watch the tutorial':'')+'.',cards:[faqCard(f,E,r)]}}
 if(APP_RE.test(q))return{r:'a',t:'I could not find that in the guide.',cards:[{id:'k'+(++nid),name:'faq_none',eid:E.id,v:{q:text},st:'open',res:''}]};
 return null}
function openHelpGuide(sec){if(typeof window.openHelp==='function'){shut();setTimeout(()=>window.openHelp(sec||''),60)}else toast('Open the profile icon > Help & guides')}
function openTutorial(file){try{window.open(TUT_URL+(file?encodeURIComponent(file):''),'_blank','noopener,noreferrer')}catch(e){toast(TUT_URL)}}
function faqAsk(f){const E=cur();if(!E)return;A.msgs.push({r:'u',t:f.t,s:'',h:0});A.jump=A.msgs.length;A.msgs.push({r:'a',t:'',cards:[faqCard(f,E,faqRank(norm(f.t)))]});paint()}

/* ---------- answers that never leave the device ---------- */
function localReply(text,E){
 const t=text.toLowerCase().replace(/\s+/g,' ').trim();
 if(/^(hi+|hello+|hey+|hola|namaste|yo)\b[\s!.,?]*(cem( pro)?)?[\s!.?]*$/.test(t))return{r:'a',t:'',caps:'hello'};
 if(/what (can|could|do|all can) (you|cem pro)|what (are|r) (you|u)\b|who (are|r) (you|u)|what can i (ask|do|say)|(your|ur) (features|capabilit|skills|functions|powers)|\bcapabilit|^(help|menu|features|options)\b[\s?!.]*$|how (can|do) you help|how do you work|show (me )?(the )?(menu|options)/.test(t))return{r:'a',t:'',caps:'menu'};
 if(/break[\s-]?even/.test(t)&&!/\d/.test(t)&&!/what is|what does|explain|meaning|formula|how is|how are|calculated|worked out/.test(t)){
  if(!can(E,'exp'))return{r:'a',t:'Break-even uses budget and sponsor figures, which your role cannot see. Ask the organizer or treasurer to run it.'};
  const c=mkCard({name:'analyze_breakeven',args:{}},E);
  return{r:'a',t:'Here is the break-even picture, worked out on this device from your budget, sponsors, ticket price and registrations. Change a number to test a what-if.',cards:c?[c]:null}}
  const fq=faqReply(text,E);if(fq)return fq;   // how-to and problem questions: answered from the guide, with links to Help & guides and the tutorials
 return null}

/* ---------- sponsor / attendee email helpers ---------- */
function mergeTags(E,s,extra){
 const w=new Date(E.date+'T'+(E.time||'00:00')),ok=!isNaN(w);
 const vals=Object.assign({event:E.name||'',date:ok?w.toLocaleDateString([],{weekday:'long',day:'numeric',month:'long',year:'numeric'}):(E.date||''),time:ok&&E.time?w.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'',venue:E.venue||'',organizer:myNm()||(E.name||'Event')+' team'},extra||{});
 return String(s==null?'':s).replace(/\{(\w+)\}/g,(m,k)=>k in vals?vals[k]:m).replace(/[ \t]+$/gm,'').replace(/\n{3,}/g,'\n\n').trim()}
const EMAILRE=/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]{2,}$/;
function sponsorMsg(c,E){const x={sponsor:cl(c.v.sponsor,60)||'Sir/Madam'};return{subject:mergeTags(E,cl(c.v.subject,120),x).replace(/\s+/g,' '),text:mergeTags(E,clm(c.v.body,2500),x)}}
async function smtpSend(E,c){
 let s=null;try{s=JSON.parse(localStorage.getItem('cem-mail-smtp')||'null')}catch(e){}
 if(!s||!s.host||!s.user||!s.pass)throw new Error('NO_SMTP');
 const base=API();if(!base)throw new Error('The email service is not set up (OTP_API is empty).');
 const m=sponsorMsg(c,E),html='<div style="font:15px/1.6 system-ui,sans-serif;color:#10172b">'+esc(m.text).replace(/\n/g,'<br>')+'</div>';
 const body={smtp:{host:s.host,port:s.port,user:s.user,pass:s.pass},from:{email:s.from||s.user,name:myNm()||E.name||'Event team'},messages:[{to:c.v.to.trim(),name:cl(c.v.sponsor,60),subject:m.subject,text:m.text,html}]};
 for(let i=0;i<2;i++){
  const tk=await token(i===1);let r,j=null;
  try{r=await fetch(base+'/mail/send',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tk},body:JSON.stringify(body)})}catch(e){throw new Error('No internet. Sending email needs a connection.')}
  try{j=await r.json()}catch(e){}
  if(r.status===401&&i===0&&!(j&&j.stage))continue;
  if(r.status===404)throw new Error('The email service needs the newer Worker (SETUP.md).');
  if(!r.ok||!j||!j.ok)throw new Error((j&&j.message)||'The email could not be sent.');
  const x=(j.results||[])[0];if(x&&x.ok===false)throw new Error(x.error||'The mail server refused this email.');
  return true}}
function openMailApp(url){const a=document.createElement('a');a.href=url;a.rel='noopener';a.style.display='none';document.body.append(a);a.click();a.remove()}

/* ---------- UI ---------- */
function css(){if($('cem-ai-css'))return;const s=document.createElement('style');s.id='cem-ai-css';s.textContent=`
#cem-ai-fab{position:fixed;right:14px;bottom:calc(var(--cem-bn,0px) + 16px);z-index:40;width:52px;height:52px;padding:0;border:0;border-radius:16px;background:none;cursor:pointer;filter:drop-shadow(0 6px 14px rgba(15,21,53,.35));-webkit-tap-highlight-color:transparent;transition:transform .15s}
#cem-ai-fab:active{transform:scale(.94)}#cem-ai-fab svg{display:block;width:52px;height:52px;border-radius:16px}
#cem-ai-fab .bd{position:absolute;right:-5px;top:-6px;background:#0f1535;color:#fff;font:700 10px/1 var(--txt,system-ui);padding:4px 6px;border-radius:99px;border:2px solid var(--bg,#f7f8fc)}
#cem-ai-fab[hidden],#cem-ai[hidden]{display:none}
#cem-ai-fab:focus-visible,#cem-ai :focus-visible{outline:2px solid var(--acc,#5948f5);outline-offset:2px}
#cem-ai{position:fixed;z-index:59;left:0;right:0;top:0;bottom:0;width:100%;height:100vh;height:100dvh;display:flex;flex-direction:column;background:var(--bg,#f7f8fc);color:var(--ink,#10172b);font:14px/1.5 var(--txt,system-ui);overflow:hidden;animation:cpup .22s ease-out}
@keyframes cpup{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
@media(min-width:721px){#cem-ai{left:auto;top:auto;right:20px;bottom:20px;width:420px;height:min(700px,calc(100dvh - 40px));border:1px solid var(--line,#e6e8f1);border-radius:20px;box-shadow:var(--pop,0 24px 60px -16px rgba(16,23,43,.4))}}
@media(prefers-reduced-motion:reduce){#cem-ai{animation:none}.aity span{animation:none!important}}
#cem-ai .cph{flex:none;display:flex;align-items:center;gap:6px;background:#0f1535;color:#fff;padding:calc(12px + env(safe-area-inset-top,0px)) 8px 12px 14px}
@media(min-width:721px){#cem-ai .cph{padding-top:12px}}
#cem-ai .cph .logo{margin-right:5px}#cem-ai .cph .logo svg{display:block;width:38px;height:38px;border-radius:11px}
#cem-ai .cph .tt{min-width:0;flex:1}#cem-ai .cph .tt b{display:block;font:700 17px/1.1 var(--disp,system-ui);letter-spacing:-.015em}
#cem-ai .cph .tt small{display:block;margin-top:3px;color:#aab1d6;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#cem-ai .cph button{flex:none;width:38px;height:38px;border:0;border-radius:10px;background:none;color:#cdd2ee;display:grid;place-items:center;cursor:pointer;padding:0}
#cem-ai .cph button:hover{background:rgba(255,255,255,.1);color:#fff}
#cem-ai svg.i{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
#cem-ai .cps{flex:none;display:flex;gap:7px;align-items:center;padding:7px 14px;background:var(--tint,#eeecfe);color:var(--mute,#626a86);font-size:12px;border-bottom:1px solid var(--line,#e6e8f1)}#cem-ai .cps svg.i{width:14px;height:14px}
#ai-msgs{flex:1;overflow:auto;overscroll-behavior:contain;padding:14px;display:flex;flex-direction:column;gap:14px}
.air{display:flex;gap:8px;align-items:flex-start;max-width:100%}.aiav{flex:none;width:26px;height:26px}.aiav svg{display:block;width:26px;height:26px;border-radius:8px}
.aib{max-width:86%;padding:10px 13px;border-radius:16px;white-space:pre-wrap;word-break:break-word}.air .aib{white-space:normal}
.aib.u{align-self:flex-end;background:var(--acc,#5948f5);color:var(--accink,#fff);border-bottom-right-radius:5px}
.aib.a{background:var(--card,#fff);border:1px solid var(--line,#e6e8f1);border-top-left-radius:5px}
.aib.e{align-self:flex-start;background:none;border:1px solid var(--warn,#9a5b00);color:var(--warn,#9a5b00)}
.mw{display:flex;flex-direction:column;gap:6px}.mw>.air+.aik,.mw>.aicaps{margin-top:6px}
.aih{align-self:flex-end;font-size:11px;color:var(--mute,#626a86)}
.aity{display:flex;gap:4px;padding:13px 14px}.aity span{width:6px;height:6px;border-radius:50%;background:var(--mute,#626a86);opacity:.4;animation:cpdot 1s infinite}.aity span:nth-child(2){animation-delay:.15s}.aity span:nth-child(3){animation-delay:.3s}
@keyframes cpdot{50%{opacity:1;transform:translateY(-2px)}}
.aicaps{display:flex;flex-direction:column;gap:14px;margin-top:2px}.aicg h5{margin:0 0 6px 2px;font:600 12px var(--txt,system-ui);color:var(--mute,#626a86)}
.aicg .gr{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.aicap{display:flex;flex-direction:column;align-items:flex-start;gap:5px;text-align:left;padding:10px 11px;border:1px solid var(--line,#e6e8f1);background:var(--card,#fff);border-radius:12px;color:inherit;cursor:pointer;font:inherit}
.aicap:hover{border-color:var(--acc,#5948f5)}.aicap i{width:30px;height:30px;border-radius:9px;background:var(--tint,#eeecfe);color:var(--acc,#5948f5);display:grid;place-items:center;margin-bottom:2px}.aicap i svg.i{width:17px;height:17px}
.aicap b{font:650 13px var(--txt,system-ui)}.aicap small{color:var(--mute,#626a86);font-size:12px;line-height:1.35}
.aik{align-self:stretch;background:var(--card,#fff);border:1px solid var(--line,#e6e8f1);border-radius:14px;overflow:hidden}
.aikh{display:flex;align-items:center;gap:9px;padding:10px 12px;border-bottom:1px solid var(--line,#e6e8f1)}
.aikh i{flex:none;width:28px;height:28px;border-radius:8px;background:var(--tint,#eeecfe);color:var(--acc,#5948f5);display:grid;place-items:center}.aikh i svg.i{width:16px;height:16px}
.aikh h4{margin:0;flex:1;font:700 14px var(--disp,system-ui);letter-spacing:-.01em}.aipl{font-size:11px;font-weight:600;color:var(--mute,#626a86);background:var(--bg,#f7f8fc);border:1px solid var(--line,#e6e8f1);border-radius:99px;padding:2px 8px}
.aikb{padding:12px;display:flex;flex-direction:column;gap:10px}
.aif{display:flex;flex-direction:column;gap:3px;font-size:12px;font-weight:500;color:var(--mute,#626a86);margin:0}
.aif input,.aif textarea,.aif select,.aibl input:not([type=checkbox]),#ai-in{font:14px var(--txt,system-ui);color:var(--ink,#10172b);background:var(--bg,#f7f8fc);border:1px solid var(--line,#e6e8f1);border-radius:9px;padding:8px 9px;width:100%;box-sizing:border-box}
.aif input:focus,.aif textarea:focus,.aif select:focus,.aibl input:focus,#ai-in:focus{outline:none;border-color:var(--acc,#5948f5);box-shadow:0 0 0 3px color-mix(in srgb,var(--acc,#5948f5) 20%,transparent)}
.aiq{display:flex;gap:8px;align-items:flex-start;font-size:13px;margin:0;font-weight:400;color:inherit}.aiq small{display:block;color:var(--mute,#626a86)}
.ain{font-size:12px;color:var(--mute,#626a86)}
.aibl{display:grid;grid-template-columns:22px 1fr 92px;gap:6px;align-items:center}#cem-ai input[type=checkbox]{accent-color:var(--acc,#5948f5)}.aibl input[type=checkbox]{width:auto;margin:0}
.aibt{display:flex;justify-content:space-between;font-size:13px;padding-top:4px;border-top:1px dashed var(--line,#e6e8f1)}.aibt b{font:700 14px var(--disp,system-ui)}
.aiact{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
#cem-ai button.p,#cem-ai button.g{border-radius:9px;font:600 13px var(--txt,system-ui);padding:9px 14px;cursor:pointer;min-height:38px}
#cem-ai button.p{border:0;background:var(--acc,#5948f5);color:var(--accink,#fff)}#cem-ai button.g{border:1px solid var(--line,#e6e8f1);background:none;color:inherit}
#cem-ai button:disabled{opacity:.5;cursor:default}
.aires{font-size:13px}.aires.ok{color:var(--ok,#1a7f4b)}.aires.bad{color:var(--warn,#9a5b00)}
.aiv{border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:2px;background:var(--tint,#eeecfe)}.aiv b{font:700 15px var(--disp,system-ui)}.aiv span{font-size:13px;color:var(--mute,#626a86)}
.aiv.ok{background:color-mix(in srgb,var(--ok,#1a7f4b) 13%,transparent)}.aiv.ok b{color:var(--ok,#1a7f4b)}.aiv.warn{background:color-mix(in srgb,var(--warn,#9a5b00) 13%,transparent)}.aiv.warn b{color:var(--warn,#9a5b00)}.aiv.bad{background:color-mix(in srgb,var(--bad,#c2331f) 13%,transparent)}.aiv.bad b{color:var(--bad,#c2331f)}
.aim>div:first-child{display:flex;justify-content:space-between;font-size:12px;color:var(--mute,#626a86);margin-bottom:5px}.aim b{color:var(--ink,#10172b)}
.aitr{height:6px;border-radius:99px;background:var(--line,#e6e8f1);overflow:hidden}.aitr i{display:block;height:100%;background:var(--acc,#5948f5);border-radius:99px}
.aigrid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.aigrid>div{background:var(--bg,#f7f8fc);border:1px solid var(--line,#e6e8f1);border-radius:10px;padding:8px 10px}
.aigrid span{display:block;font-size:11.5px;color:var(--mute,#626a86)}.aigrid b{font:700 16px var(--disp,system-ui);letter-spacing:-.01em}
.aifl{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px;font-size:13.5px}.aifl li::marker{color:var(--acc,#5948f5);font-weight:700}
.aifr{display:flex;flex-direction:column;gap:6px;align-items:flex-start;font-size:12px;color:var(--mute,#626a86)}.aifr button{border:1px solid var(--line,#e6e8f1);background:var(--bg,#f7f8fc);color:var(--ink,#10172b);border-radius:10px;padding:7px 10px;font:600 12.5px var(--txt,system-ui);text-align:left;cursor:pointer}.aifr button:hover{border-color:var(--acc,#5948f5)}
.aiduo{display:grid;grid-template-columns:1fr 1fr;gap:8px}
#cem-ai .cpd{flex:none;background:var(--card,#fff);border-top:1px solid var(--line,#e6e8f1);padding-bottom:env(safe-area-inset-bottom,0px)}
.aiqs{display:flex;gap:6px;overflow-x:auto;padding:9px 12px 0;scrollbar-width:none}.aiqs::-webkit-scrollbar{display:none}
.aiqs button{flex:none;border:1px solid var(--line,#e6e8f1);background:var(--bg,#f7f8fc);color:inherit;border-radius:99px;padding:6px 12px;font:600 12.5px var(--txt,system-ui);cursor:pointer}.aiqs button:hover{border-color:var(--acc,#5948f5)}
#ai-f{display:flex;align-items:flex-end;gap:8px;padding:10px 12px 4px}
#ai-in{flex:1;resize:none;min-height:42px;max-height:110px;border-radius:14px;padding:10px 12px;font-size:15px;line-height:1.4}
#ai-f .send{flex:none;width:42px;height:42px;border-radius:50%;border:0;background:var(--acc,#5948f5);color:var(--accink,#fff);display:grid;place-items:center;cursor:pointer;padding:0}#ai-f .send svg.i{width:19px;height:19px}
#ai-f .send:disabled{opacity:.45}
.cpn{padding:2px 14px 9px;font-size:11.5px;color:var(--mute,#626a86);display:flex;justify-content:space-between;gap:8px}
.aip{padding:16px 16px 28px;overflow:auto;flex:1}.aip h3{margin:0 0 8px;font:700 17px var(--disp,system-ui)}.aip ul{padding-left:18px;margin:6px 0 14px}.aip li{margin:4px 0}
.aip label{display:flex;gap:8px;align-items:flex-start;margin:14px 0;font-size:14px;font-weight:500;color:var(--ink,#10172b)}
@media(max-width:720px){.aif input,.aif textarea,.aif select,.aibl input:not([type=checkbox]),#ai-in{font-size:16px}}`;document.head.append(s)}

function selOpts(list,val){return list.map(o=>`<option value="${esc(o[0])}"${o[0]===val?' selected':''}>${esc(o[1])}</option>`).join('')}
function budTotal(c){return c.v.lines.filter(l=>l.on).reduce((t,l)=>t+num(l.a),0)}
function cardHtml(c){
 const E=ev(c.eid)||{},v=c.v,dis=c.st!=='open'?' disabled':'';
 const f=(k,lab,type,ex)=>`<label class="aif"><span>${lab}</span><input data-c="${c.id}" data-f="${k}" type="${type||'text'}" value="${esc(v[k])}"${ex||''}${dis}></label>`;
 const ta=(k,lab,rows,max)=>`<label class="aif"><span>${lab}</span><textarea data-c="${c.id}" data-f="${k}" rows="${rows}" maxlength="${max}"${dis}>${esc(v[k])}</textarea></label>`;
 let t='',b='',go='Confirm',icon='doc',pill='Draft',foot=null;
 switch(c.name){
  case 'write_event_description':t='Event description';go='Save description';icon='doc';b=ta('desc','Text (you can edit it)',5,500);break;
  case 'create_payment_link':t='Payment link';go='Create link';icon='link';b=f('title','Title','text',' maxlength="60"')+f('amt','Amount in ₹ (0 = payer chooses)','number',' min="0" step="0.01" inputmode="decimal"')+f('note','Note (optional)','text',' maxlength="140"')+
   `<div class="ain">Payee and UPI ID are typed here only. They are never sent to the AI.</div>`+f('payee','Payee name','text',' maxlength="60" autocomplete="off"')+f('upi','UPI ID','text',' autocapitalize="off" autocomplete="off" spellcheck="false"');break;
  case 'add_registration_questions':t='Registration questions';go='Add questions';icon='form';
   b=v.q.map((q,i)=>`<label class="aiq"><input type="checkbox" data-c="${c.id}" data-q="${i}"${q.on?' checked':''}${dis}><span><b>${esc(q.label)}</b><small>${q.type}${q.req?' · required':''}${q.opts?' · '+esc(q.opts):''}</small></span></label>`).join('')+`<div class="ain">Added at the end of the form.</div>`;break;
  case 'assign_task':{t='Task';go='Add task';icon='task';const who=taskWho(E).map(id=>[id,nameOf(E,id)]),gr=(E.groups||[]).map(g=>[g.id,g.n]);
   b=f('t','Task','text',' maxlength="120"')+`<label class="aif"><span>Assign to</span><select data-c="${c.id}" data-f="who"${dis}>${selOpts(who,v.who)}</select></label>`+f('due','Due date','date')+
    (gr.length?`<label class="aif"><span>Group</span><select data-c="${c.id}" data-f="gid"${dis}>${selOpts(gr,v.gid)}</select></label>`:'')+(v.desc?`<div class="ain">${esc(v.desc)}</div>`:'');break}
  case 'add_shopping_item':{t='Item to buy';go='Add item';icon='cart';const who=[['','Anyone'],...itemWho(E).map(id=>[id,nameOf(E,id)])];
   b=f('t','Item','text',' maxlength="80"')+`<div class="aiduo">${f('q','Quantity','number',' min="1" max="999" inputmode="numeric"')}${f('p','Price each in ₹','number',' min="0" step="0.01" inputmode="decimal"')}</div>`+`<label class="aif"><span>Buy by</span><select data-c="${c.id}" data-f="who"${dis}>${selOpts(who,v.who)}</select></label>`;break}
  case 'analyze_breakeven':{t='Break-even analysis';icon='chart';pill='Live';foot='';
   b=`<div class="aiduo">${f('price','What-if ticket price (₹)','number',' min="0" step="1" inputmode="decimal" placeholder="'+esc(String(feeOf(E)))+'"')}${f('extra','Extra sponsorship (₹)','number',' min="0" step="100" inputmode="decimal" placeholder="0"')}</div>`+
    `<label class="aif"><span>Compare with</span><select data-c="${c.id}" data-f="basis"${dis}>${selOpts([['plan','Budget'],['act','Spent + still to pay']],v.basis||((window.moneyBrief&&moneyBrief(E).plan>0)?'plan':'act'))}</select></label>`+
    `<div data-res="${c.id}" style="display:flex;flex-direction:column;gap:10px">${beResHtml(c)}</div><div class="ain">Worked out on this device from your own figures. Nothing is sent.</div>`;break}
  case 'create_budget':{t='Budget draft';go='Add to budget';icon='wallet';
   b=`<div class="ain">Amounts in ₹. Untick a line to leave it out.</div>`+v.lines.map((l,i)=>`<div class="aibl"><input type="checkbox" data-c="${c.id}" data-bl="${i}" data-k="on"${l.on?' checked':''}${dis} aria-label="Include"><input type="text" data-c="${c.id}" data-bl="${i}" data-k="n" value="${esc(l.n)}" maxlength="40"${dis} aria-label="Category"><input type="number" data-c="${c.id}" data-bl="${i}" data-k="a" value="${esc(l.a)}" min="0" step="100" inputmode="decimal"${dis} aria-label="Amount in rupees"></div>`).join('')+
    `<div class="aibt"><span>Total of ticked lines</span><b data-tot="${c.id}">${R(budTotal(c))}</b></div>`+(v.skip?`<div class="ain">${v.skip} line${v.skip>1?'s':''} skipped because ${v.skip>1?'they are':'it is'} already in your budget.</div>`:'');break}
  case 'add_sponsor':{t='Sponsor';go='Add sponsor';icon='star';
   b=f('n','Name','text',' maxlength="60"')+`<label class="aif"><span>Type</span><select data-c="${c.id}" data-f="k"${dis}>${selOpts([['Sponsor','Sponsor'],['Donation','Donation'],['Other','Other']],v.k)}</select></label>`+
    `<div class="aiduo">${f('cm','Committed (₹)','number',' min="0" step="100" inputmode="decimal"')}${f('rc','Received (₹)','number',' min="0" step="100" inputmode="decimal"')}</div>`+ta('pr','What you offer in return',3,500)+
    f('ct','Contact (typed here only)','text',' maxlength="100" autocomplete="off"')+`<div class="ain">Counts toward your break-even once saved.</div>`;break}
  case 'draft_sponsor_email':{t='Sponsor email';icon='send';
   b=f('to','To (typed here only)','email',' autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="name@company.com"')+f('sponsor','Company or person (fills {sponsor})','text',' maxlength="60" autocomplete="off"')+f('subject','Subject','text',' maxlength="120"')+ta('body','Message (you can edit it)',9,2500)+
    `<div class="ain">Words in { } such as {event} and {date} are filled in when it is sent. Sends from your own mailbox if you set it up in Attendees > Email attendees; otherwise use Mail app.</div>`;
   foot=c.st==='open'?`<div class="aiact"><button class="p" data-a="mail-send" data-c="${c.id}"${c.busy?' disabled':''}>${c.busy?'Sending…':'Send email'}</button><button class="g" data-a="mail-app" data-c="${c.id}">Mail app</button><button class="g" data-a="mail-copy" data-c="${c.id}">Copy</button><button class="g" data-a="no" data-c="${c.id}">Dismiss</button></div>${c.res?`<div class="aires bad">${esc(c.res)}</div>`:''}`:null;break}
  case 'faq':{const f=FAQ.find(x=>x.id===v.id);if(!f)return'';const E0=ev(c.eid),al=E0?allowed(E0):[];t=esc(f.t);icon=f.p?'bolt':'help';pill=f.p?'Fix':'How-to';
   const tag=f.ol?'ol':'ul',dk=f.do&&al.includes(f.do)?CAP.find(x=>x.k===f.do):null;
   b=`<${tag} class="aifl">${f.a.map(x=>`<li>${fm(x)}</li>`).join('')}</${tag}>`+(f.n?`<div class="ain">${fm(f.n)}</div>`:'');
   foot=`<div class="aiact"><button class="p" data-a="faq-help" data-c="${c.id}">Open Help &amp; guides</button>${f.tut?`<button class="g" data-a="faq-tut" data-c="${c.id}">Watch tutorial</button>`:''}${dk?`<button class="g" data-a="faq-do" data-c="${c.id}">Do it with CEM Pro</button>`:''}</div>`+
    ((v.rel||[]).length?`<div class="aifr"><span>Related</span>${v.rel.map(id=>{const r=FAQ.find(x=>x.id===id);return r?`<button type="button" data-a="faq" data-id="${r.id}">${esc(r.t)}</button>`:''}).join('')}</div>`:'');break}
  case 'faq_none':{t='Not in the guide yet';icon='help';pill='Help';
   b=`<ul class="aifl"><li>Open <b>Help &amp; guides</b> and use its search box. It covers every tab.</li><li>Try the <b>Tutorials</b> for short animated walkthroughs.</li><li>Or I can try to answer it as a planning question.</li></ul>`;
   foot=`<div class="aiact"><button class="p" data-a="faq-help" data-c="${c.id}">Open Help &amp; guides</button><button class="g" data-a="faq-tut" data-c="${c.id}">Tutorials</button><button class="g" data-a="faq-ai" data-c="${c.id}">Ask CEM Pro anyway</button></div>`;break}
  case 'email_attendees':{t='Email to attendees';go='Review and send';icon='mail';
   b=f('subject','Subject','text',' maxlength="120"')+ta('body','Message (you can edit it)',9,2500)+
    `<label class="aiq"><input type="checkbox" data-c="${c.id}" data-f="ticket"${v.ticket?' checked':''}${dis}><span><b>Include each person's ticket QR</b><small>Off sends a plain message</small></span></label>`+
    `<div class="ain">Opens the email window with this draft. You choose who gets it and press Send there. {first_name}, {event}, {date} and the like are filled in for each person.</div>`;break}}
 if(foot===null)foot=c.st==='open'?`<div class="aiact"><button class="p" data-a="ok" data-c="${c.id}">${go}</button><button class="g" data-a="no" data-c="${c.id}">Dismiss</button></div>${c.res?`<div class="aires bad">${esc(c.res)}</div>`:''}`
  :c.st==='done'?`<div class="aires ok">✓ ${esc(c.res)}</div>${c.link?`<div class="aiact"><button class="g" data-a="copy" data-c="${c.id}">Copy link</button>${navigator.share?`<button class="g" data-a="share" data-c="${c.id}">Share</button>`:''}</div>`:''}`:`<div class="aires">Dismissed</div>`;
 const pl=c.st==='open'?`<span class="aipl">${pill}</span>`:'';
 return`<div class="aik"><div class="aikh"><i>${ic(icon)}</i><h4>${t}</h4>${pl}</div><div class="aikb">${b}${foot}</div></div>`}

function msgHtml(m){
 if(m.r==='u')return`<div class="aib u">${esc(m.t)}</div>${m.h?`<div class="aih">${m.h} detail${m.h>1?'s':''} hidden before sending</div>`:''}`;
 if(m.r==='e')return`<div class="aib e">${esc(m.t)}</div>`;
 const E=cur();
 return(m.caps&&E?capsHtml(E,m.caps==='hello'):'')+(m.t?`<div class="air">${av()}<div class="aib a">${esc(m.t)}</div></div>`:'')+(m.cards||[]).map(cardHtml).join('')}
function masthead(E,sub,btns){return`<div class="cph"><span class="logo">${MARK}</span><div class="tt"><b>CEM Pro</b><small>${sub}</small></div>${btns}</div>`}
function paint(){
 const p=$('cem-ai');if(!p)return;const E=cur();
 if(A.view==='consent'||!okConsent()){p.innerHTML=consentHtml();return}
 const m=$('ai-msgs'),keep=m?m.scrollTop:0,stick=A.pin||!m||m.scrollHeight-m.scrollTop-m.clientHeight<80,jump=A.jump,old=$('ai-in')?$('ai-in').value:'';A.pin=false;A.jump=null;
 const al=E?allowed(E):[],qs=CAP.filter(c=>al.includes(c.k)||c.act==='help');
 p.innerHTML=masthead(E,E?esc(E.name||'Untitled event')+(E.type?' · '+esc(E.type):''):'Open an event to start',
   `<button type="button" data-a="priv" aria-label="Privacy" title="Privacy">${ic('lock')}</button><button type="button" data-a="clear" aria-label="Clear chat" title="Clear chat">${ic('trash')}</button><button type="button" data-a="close" aria-label="Close" title="Close">${ic('close')}</button>`)+
  `<div class="cps">${ic('lock')}<span>Names, numbers and contacts are hidden before anything is sent.</span></div>
  <div id="ai-msgs" aria-live="polite">${A.msgs.length?A.msgs.map((x,i)=>`<div class="mw" data-mi="${i}">${msgHtml(x)}</div>`).join(''):(E?capsHtml(E,true):`<div class="air">${av()}<div class="aib a">Open an event first, then ask me.</div></div>`)}${A.busy?`<div class="air">${av()}<div class="aib a aity" aria-label="CEM Pro is thinking"><span></span><span></span><span></span></div></div>`:''}</div>
  <div class="cpd">${A.msgs.length&&qs.length?`<div class="aiqs">${qs.map(c=>`<button type="button" data-a="chip" data-i="${CAP.indexOf(c)}">${c.q}</button>`).join('')}</div>`:''}
   <form id="ai-f"><textarea id="ai-in" rows="1" maxlength="${MAXIN}" placeholder="Ask CEM Pro, e.g. what can you do?" aria-label="Message"></textarea><button class="send" type="submit" aria-label="Send"${A.busy?' disabled':''}>${ic('send')}</button></form>
   <div class="cpn"><span>CEM Pro drafts. You confirm.</span><span>${A.left!=null?A.left+' messages left today':''}</span></div></div>`;
 const mm=$('ai-msgs'),ii=$('ai-in');if(ii&&old){ii.value=old;grow(ii)}if(mm){   // an empty chat starts at its greeting; a short reply scrolls to the bottom; a tall reply (a card) is shown from its first line
  const g=jump!=null&&mm.querySelector('.mw[data-mi="'+jump+'"]');
  if(!A.msgs.length)mm.scrollTop=0;
  else if(g)mm.scrollTop=g.offsetHeight>mm.clientHeight*.6?g.getBoundingClientRect().top-mm.getBoundingClientRect().top+mm.scrollTop-10:mm.scrollHeight;
  else mm.scrollTop=stick?mm.scrollHeight:keep}}
function consentHtml(){const on=okConsent(),E=cur();return masthead(E,'Privacy',`<button type="button" data-a="${on?'back':'close'}" aria-label="Close" title="Close">${ic('close')}</button>`)+`<div class="aip">
 <h3>Before you use it</h3><b>Sent to Google Gemini</b><ul><li>What you type here, with team names, emails, phone, UPI and ID numbers replaced first. Amounts, sponsor names and ideas you type are sent as written.</li><li>Event title, type, date, venue, team roles (not names), group names and registration question labels.</li></ul>
 <b>Never sent</b><ul><li>Attendee lists, registrations, payments, UPI IDs, tickets, chat messages, and your saved budget, sponsor and contact details. Break-even is worked out on this device.</li><li>Email addresses and passwords. Sponsor emails and your mailbox login stay on this device.</li></ul>
 <b>Please know</b><ul><li>This runs on Google's <u>free plan</u>: Google may use these prompts to improve its products, and people may review them. Do not type private details.</li><li>A name that is not on your team list cannot be recognised, so avoid typing names of attendees.</li><li>CEM Pro only drafts. Nothing changes and no email goes out until you tap the button on a card. The chat is kept in memory and erased when you close the app.</li></ul>
 ${on?`<div class="aiact"><button class="p" data-a="back">Back to chat</button><button class="g" data-a="revoke">Turn off and forget</button></div>`:`<label><input type="checkbox" id="ai-ok"><span>I understand and want to use CEM Pro.</span></label><div class="aiact"><button class="p" data-a="agree">Turn on</button><button class="g" data-a="close">Not now</button></div>`}</div>`}

let prevOv='';
function lock(){if(matchMedia('(max-width:720px)').matches){prevOv=document.body.style.overflow;document.body.style.overflow='hidden'}}
function unlock(){document.body.style.overflow=prevOv;prevOv=''}
function shut(){A.open=false;A.view='chat';const p=$('cem-ai');if(p)p.hidden=true;unlock();tick()}
const grow=t=>{t.style.height='auto';t.style.height=Math.min(110,t.scrollHeight||42)+'px'};

function ensureUi(){css();if($('cem-ai'))return;
 const b=document.createElement('button');b.id='cem-ai-fab';b.type='button';b.innerHTML=MARK+'<span class="bd">Pro</span>';b.hidden=true;b.setAttribute('aria-label','Open CEM Pro');b.dataset.a='open';
 const p=document.createElement('div');p.id='cem-ai';p.hidden=true;p.setAttribute('role','dialog');p.setAttribute('aria-label','CEM Pro');document.body.append(b,p);
 document.addEventListener('click',onClick);p.addEventListener('input',onInput);p.addEventListener('change',onInput);p.addEventListener('submit',e=>{e.preventDefault();const t=$('ai-in');if(t){const x=t.value;t.value='';grow(t);send(x)}});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&A.open)shut()});
 p.addEventListener('keydown',e=>{if(e.target.id==='ai-in'&&e.key==='Enter'&&!e.shiftKey&&matchMedia('(pointer:fine)').matches){e.preventDefault();const x=e.target.value;e.target.value='';grow(e.target);send(x)}})}
const cardOf=id=>{for(const m of A.msgs)for(const c of m.cards||[])if(c.id===id)return c};
function onInput(e){const t=e.target;
 if(t.id==='ai-in'){grow(t);return}
 const c=t.dataset&&t.dataset.c&&cardOf(t.dataset.c);if(!c||c.st!=='open')return;
 if(t.dataset.q!==undefined)c.v.q[+t.dataset.q].on=t.checked;
 else if(t.dataset.bl!==undefined){const l=c.v.lines[+t.dataset.bl],k=t.dataset.k;if(l){l[k]=k==='on'?t.checked:t.value;const o=document.querySelector('[data-tot="'+c.id+'"]');if(o)o.textContent=R(budTotal(c))}}
 else if(t.dataset.f){c.v[t.dataset.f]=t.type==='checkbox'?t.checked:t.value;
  if(c.name==='analyze_breakeven'){const r=document.querySelector('[data-res="'+c.id+'"]');if(r)r.innerHTML=beResHtml(c)}}}
async function sendSponsor(c){
 const E=ev(c.eid);if(!E)return;
 if(!can(E,'exp')){c.res='Your role cannot send sponsor emails.';paint();return}
 const to=String(c.v.to||'').trim();if(!EMAILRE.test(to)){c.res='Type the sponsor\'s email address in the To box (it stays on this device).';paint();return}
 if(!cl(c.v.subject,120)||!clm(c.v.body,2500)){c.res='Add a subject and a message.';paint();return}
 c.busy=true;c.res='';paint();
 try{await smtpSend(E,c);c.busy=false;c.st='done';c.res='Email sent to '+to+'.'}
 catch(err){c.busy=false;c.res=err.message==='NO_SMTP'?'No email account is set up on this device yet. Add one in Attendees > Email attendees > Send, or tap Mail app to send it from your phone.':(err.message||'The email could not be sent.')}
 paint()}
function onClick(e){const t=e.target.closest&&e.target.closest('[data-a]');if(!t)return;const a=t.dataset.a,c=t.dataset.c&&cardOf(t.dataset.c);
 if(a==='open'){A.open=true;$('cem-ai').hidden=false;$('cem-ai-fab').hidden=true;lock();paint();if(matchMedia('(pointer:fine)').matches&&$('ai-in'))$('ai-in').focus();return}
 if(!$('cem-ai')||!$('cem-ai').contains(t))return;
 if(a==='close'){shut();return}
 if(a==='agree'){if(!$('ai-ok')||!$('ai-ok').checked)return toast('Tick the box to continue');setConsent(true);A.view='chat';paint();return}
 if(a==='priv'){A.view='consent';paint();return}
 if(a==='back'){A.view='chat';paint();return}
 if(a==='revoke'){setConsent(false);A.msgs=[];A.left=null;A.view='chat';paint();toast('CEM Pro turned off');return}
 if(a==='clear'){A.msgs=[];paint();return}
 if(a==='faq'){const f=FAQ.find(x=>x.id===t.dataset.id);if(f)faqAsk(f);return}
 if(a==='chip'){const k=CAP[+t.dataset.i];if(!k)return;if(k.act==='help'){openHelpGuide();return}if(k.act==='tut'){openTutorial();return}const i=$('ai-in');if(k.fill&&i){i.value=k.p;grow(i);i.focus();i.setSelectionRange(k.p.length,k.p.length)}else send(k.p);return}
 if(!c)return;
 if(a==='no'){c.st='no';paint();return}
 if(a==='ok'){const r=apply(c);if(r[0]){c.st='done';c.res=r[1];if(c.name!=='email_attendees')paint()}else{c.res=r[1];paint()}return}
 if(a==='faq-help'){const f=FAQ.find(x=>x.id===(c.v&&c.v.id));openHelpGuide(f&&f.sec);return}
 if(a==='faq-tut'){const f=FAQ.find(x=>x.id===(c.v&&c.v.id));openTutorial(f&&f.tut);return}
 if(a==='faq-do'){const f=FAQ.find(x=>x.id===c.v.id),k=f&&CAP.find(x=>x.k===f.do);if(!k)return;const i=$('ai-in');if(k.fill&&i){i.value=k.p;grow(i);i.focus()}else send(k.p);return}
 if(a==='faq-ai'){send(c.v.q,true);return}
 if(a==='mail-send'){if(!c.busy)sendSponsor(c);return}
 if(a==='mail-app'){const E=ev(c.eid),to=String(c.v.to||'').trim();if(!E)return;const m=sponsorMsg(c,E);
  openMailApp('mailto:'+(EMAILRE.test(to)?encodeURIComponent(to).replace(/%40/g,'@'):'')+'?subject='+encodeURIComponent(m.subject)+'&body='+encodeURIComponent(m.text));return}
 if(a==='mail-copy'){const E=ev(c.eid);if(!E)return;const m=sponsorMsg(c,E),x=m.subject+'\n\n'+m.text;(navigator.clipboard?navigator.clipboard.writeText(x):Promise.reject()).then(()=>toast('Email copied'),()=>toast('Could not copy'));return}
 if(a==='copy'&&c.link){(navigator.clipboard?navigator.clipboard.writeText(c.link):Promise.reject()).then(()=>toast('Link copied'),()=>toast(c.link));return}
 if(a==='share'&&c.link){navigator.share({title:c.v.title,url:c.link}).catch(()=>{})}}

async function send(raw,force){
 if(A.busy)return;const text=String(raw||'').trim().slice(0,MAXIN);if(!text)return;
 if(!okConsent()){A.view='consent';paint();return}
 const E=cur();if(!E){toast('Open an event first');return}
 const loc=force?null:localReply(text,E);   // greetings, "what can you do?" and plain break-even are answered here: instant, free, nothing sent
 if(loc){A.msgs.push({r:'u',t:text,s:'',h:0});A.jump=A.msgs.length;A.msgs.push(loc);paint();return}
 const ctx=build(E),hid=hide(text);
 A.msgs.push({r:'u',t:text,s:hid[0],h:hid[1]});A.busy=true;A.pin=true;paint();
 let h=A.msgs.filter(m=>(m.r==='u'||m.r==='a')&&m.s).slice(-MAXH).map(m=>({role:m.r==='u'?'user':'model',text:m.s}));
 while(h.length&&h[0].role!=='user')h.shift();
 try{
  const j=await call({ctx,contents:h});A.left=j.left;
  const cards=(j.calls||[]).map(c=>mkCard(c,E)).filter(Boolean);A.jump=A.msgs.length;
  const sum=(j.calls||[]).map(c=>'[proposed '+c.name+': '+JSON.stringify(c.args||{}).slice(0,200)+']').join(' ');
  A.msgs.push({r:'a',t:unmask(j.text||''),s:((j.text||'')+' '+sum).trim()||'(no reply)',cards:cards.length?cards:null});
  if(!j.text&&!cards.length)A.msgs.push({r:'e',t:'I could not turn that into an action. Try rephrasing.'})
 }catch(err){A.jump=A.msgs.length;A.msgs.push({r:'e',t:err.message||'Something went wrong.'})}
 A.busy=false;paint()}

function tick(){const b=$('cem-ai-fab');if(!b)return;let show=false;try{show=!A.open&&V.tab==='detail'&&!!cur()}catch(e){}b.hidden=!show;
 const n=document.getElementById('bn'),h=n&&n.offsetHeight?n.offsetHeight:0;   // keep the button above the phone's bottom bar instead of on top of it
 if(tick.h!==h){tick.h=h;document.documentElement.style.setProperty('--cem-bn',h+'px')}}
function init(){ensureUi();setInterval(tick,700);tick()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
