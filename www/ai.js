/* CEM 4.1.0: AI helper (Google Gemini, free tier) through your own Worker (POST /ai/chat). Open an event, tap the AI button.
   PRIVACY BY DESIGN
   - Nothing is sent until the user accepts the notice (stored on this device only; "Privacy" lets them withdraw).
   - Before sending, team names are replaced by tokens (P1, P2, "me") and emails, phone numbers, UPI ids, ID numbers and links are replaced by [..].
     The Worker repeats this check. Real names are put back only on this device.
   - Never sent: attendee lists, registrations, payments, UPI ids, budgets, tickets, chat messages. Only the event title/type/date/venue,
     team ROLES (not names), group names and registration question labels go along as context.
   - Payee name and UPI id are typed into the confirm card and stay on the device.
   - The AI only PROPOSES. Every action needs a tap on Confirm and is checked against the user's role again here.
   - The conversation lives in memory only and disappears when the app is closed. */
(function(){
'use strict';
const KEY='cem-ai-ok-v1',MAXIN=600,MAXH=8;
const $=id=>document.getElementById(id);
const me=()=>window.MYUID||'me',myNm=()=>String(window.MYNAME||'').trim();
const A={open:false,busy:false,view:'chat',msgs:[],map:{},names:[],left:null};
let nid=0,pending=0;
const okConsent=()=>{try{return localStorage.getItem(KEY)==='1'}catch(e){return false}};
const setConsent=on=>{try{on?localStorage.setItem(KEY,'1'):localStorage.removeItem(KEY)}catch(e){}};
const API=()=>String(window.OTP_API||'').trim().replace(/\/+$/,'');

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
   E.itm.push({id:uid(),t,q:Math.max(1,Math.round(+v.q)||1),p:Math.max(0,Math.round((+v.p||0)*100)/100),c:'',who:v.who||'',s:'todo',by:me(),at:Date.now()});sv();return[1,'Item added.']}}
 return[0,'Unknown action.']}

/* ---------- UI ---------- */
function css(){if($('cem-ai-css'))return;const s=document.createElement('style');s.id='cem-ai-css';s.textContent=`
#cem-ai-fab{position:fixed;right:14px;bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:40;border:0;border-radius:999px;background:var(--acc,#5948f5);color:#fff;font:600 14px var(--txt,system-ui);padding:12px 16px;box-shadow:var(--pop,0 8px 24px rgba(0,0,0,.25));cursor:pointer}
#cem-ai-fab[hidden],#cem-ai[hidden]{display:none}
#cem-ai{position:fixed;z-index:59;right:12px;bottom:12px;width:min(430px,calc(100vw - 24px));height:min(640px,calc(100dvh - 24px - env(safe-area-inset-top,0px)));display:flex;flex-direction:column;background:var(--card,#fff);color:var(--ink,#10172b);border:1px solid var(--line,#e6e8f1);border-radius:var(--r,16px);box-shadow:var(--pop);font:14px/1.45 var(--txt,system-ui);overflow:hidden}
#cem-ai header{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--line,#e6e8f1)}
#cem-ai header b{font:700 15px var(--disp,system-ui)}#cem-ai header small{color:var(--mute,#626a86);font-size:12px}
#cem-ai header .x{margin-left:auto;border:0;background:none;color:inherit;font-size:22px;line-height:1;cursor:pointer;padding:2px 6px}
#ai-msgs{flex:1;overflow:auto;padding:12px 14px;display:flex;flex-direction:column;gap:10px}
.aib{max-width:88%;padding:9px 12px;border-radius:14px;white-space:pre-wrap;word-break:break-word}
.aib.u{align-self:flex-end;background:var(--acc,#5948f5);color:#fff;border-bottom-right-radius:4px}
.aib.a{align-self:flex-start;background:var(--tint,#eeecfe);border-bottom-left-radius:4px}
.aib.e{align-self:flex-start;background:none;border:1px solid var(--warn,#9a5b00);color:var(--warn,#9a5b00)}
.aih{align-self:flex-end;font-size:11px;color:var(--mute,#626a86);margin-top:-6px}
.aik{align-self:stretch;border:1px solid var(--line,#e6e8f1);border-radius:var(--r-sm,10px);padding:10px 12px;display:flex;flex-direction:column;gap:8px}
.aik h4{margin:0;font:700 13px var(--disp,system-ui)}
.aif{display:flex;flex-direction:column;gap:3px;font-size:12px;color:var(--mute,#626a86)}
.aif input,.aif textarea,.aif select{font:14px var(--txt,system-ui);color:var(--ink,#10172b);background:var(--bg,#f7f8fc);border:1px solid var(--line,#e6e8f1);border-radius:8px;padding:8px;width:100%;box-sizing:border-box}
.aiq{display:flex;gap:8px;align-items:flex-start;font-size:13px}.aiq small{display:block;color:var(--mute,#626a86)}
.ain{font-size:11px;color:var(--mute,#626a86)}
.aiact{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
#cem-ai button.p{border:0;border-radius:8px;background:var(--acc,#5948f5);color:#fff;font:600 13px var(--txt,system-ui);padding:8px 14px;cursor:pointer}
#cem-ai button.g{border:1px solid var(--line,#e6e8f1);border-radius:8px;background:none;color:inherit;font:600 13px var(--txt,system-ui);padding:8px 12px;cursor:pointer}
#cem-ai button:disabled{opacity:.5;cursor:default}
.aires{font-size:13px}.aires.ok{color:#1a7f4b}.aires.bad{color:var(--warn,#9a5b00)}
.aichips{display:flex;flex-wrap:wrap;gap:6px}.aichips button{border:1px solid var(--line,#e6e8f1);background:var(--bg,#f7f8fc);color:inherit;border-radius:999px;padding:6px 11px;font:13px var(--txt,system-ui);cursor:pointer}
#cem-ai form{display:flex;gap:8px;padding:10px 12px;border-top:1px solid var(--line,#e6e8f1)}
#cem-ai form textarea{flex:1;resize:none;font:14px var(--txt,system-ui);color:var(--ink,#10172b);background:var(--bg,#f7f8fc);border:1px solid var(--line,#e6e8f1);border-radius:10px;padding:9px;max-height:90px}
#cem-ai footer{display:flex;gap:12px;align-items:center;padding:0 14px 10px;font-size:12px;color:var(--mute,#626a86)}
#cem-ai footer button{border:0;background:none;color:var(--acc,#5948f5);font:600 12px var(--txt,system-ui);padding:0;cursor:pointer}
.aip{padding:14px;overflow:auto;flex:1}.aip h3{margin:0 0 8px;font:700 16px var(--disp,system-ui)}.aip ul{padding-left:18px;margin:6px 0 12px}.aip li{margin:4px 0}
.aip label{display:flex;gap:8px;align-items:flex-start;margin:12px 0}`;document.head.append(s)}

function selOpts(list,val){return list.map(o=>`<option value="${esc(o[0])}"${o[0]===val?' selected':''}>${esc(o[1])}</option>`).join('')}
function cardHtml(c){
 const E=ev(c.eid)||{},v=c.v,dis=c.st!=='open'?' disabled':'';
 const f=(k,lab,type,ex)=>`<label class="aif"><span>${lab}</span><input data-c="${c.id}" data-f="${k}" type="${type||'text'}" value="${esc(v[k])}"${ex||''}${dis}></label>`;
 let t='',b='',go='Confirm';
 switch(c.name){
  case 'write_event_description':t='Event description';go='Save description';b=`<label class="aif"><span>Text (you can edit it)</span><textarea data-c="${c.id}" data-f="desc" rows="5" maxlength="500"${dis}>${esc(v.desc)}</textarea></label>`;break;
  case 'create_payment_link':t='Payment link';go='Create link';b=f('title','Title','text',' maxlength="60"')+f('amt','Amount in ₹ (0 = payer chooses)','number',' min="0" step="0.01" inputmode="decimal"')+f('note','Note (optional)','text',' maxlength="140"')+
   `<div class="ain">🔒 Payee and UPI ID are typed here only. They are never sent to the AI.</div>`+f('payee','Payee name','text',' maxlength="60" autocomplete="off"')+f('upi','UPI ID','text',' autocapitalize="off" autocomplete="off" spellcheck="false"');break;
  case 'add_registration_questions':t='Registration questions (added at the end)';go='Add questions';
   b=v.q.map((q,i)=>`<label class="aiq"><input type="checkbox" data-c="${c.id}" data-q="${i}"${q.on?' checked':''}${dis}><span><b>${esc(q.label)}</b><small>${q.type}${q.req?' · required':''}${q.opts?' · '+esc(q.opts):''}</small></span></label>`).join('');break;
  case 'assign_task':{t='Task';go='Add task';const who=taskWho(E).map(id=>[id,nameOf(E,id)]),gr=(E.groups||[]).map(g=>[g.id,g.n]);
   b=f('t','Task','text',' maxlength="120"')+`<label class="aif"><span>Assign to</span><select data-c="${c.id}" data-f="who"${dis}>${selOpts(who,v.who)}</select></label>`+f('due','Due date','date')+
    (gr.length?`<label class="aif"><span>Group</span><select data-c="${c.id}" data-f="gid"${dis}>${selOpts(gr,v.gid)}</select></label>`:'')+(v.desc?`<div class="ain">${esc(v.desc)}</div>`:'');break}
  case 'add_shopping_item':{t='Item to buy';go='Add item';const who=[['','Anyone'],...itemWho(E).map(id=>[id,nameOf(E,id)])];
   b=f('t','Item','text',' maxlength="80"')+f('q','Quantity','number',' min="1" max="999" inputmode="numeric"')+f('p','Price each in ₹ (optional)','number',' min="0" step="0.01" inputmode="decimal"')+`<label class="aif"><span>Buy by</span><select data-c="${c.id}" data-f="who"${dis}>${selOpts(who,v.who)}</select></label>`;break}}
 const foot=c.st==='open'?`<div class="aiact"><button class="p" data-a="ok" data-c="${c.id}">${go}</button><button class="g" data-a="no" data-c="${c.id}">Dismiss</button></div>${c.res?`<div class="aires bad">${esc(c.res)}</div>`:''}`
  :c.st==='done'?`<div class="aires ok">✓ ${esc(c.res)}</div>${c.link?`<div class="aiact"><button class="g" data-a="copy" data-c="${c.id}">Copy link</button>${navigator.share?`<button class="g" data-a="share" data-c="${c.id}">Share</button>`:''}</div>`:''}`:`<div class="aires">Dismissed</div>`;
 return`<div class="aik"><h4>${t}</h4>${b}${foot}</div>`}

function msgHtml(m){
 if(m.r==='u')return`<div class="aib u">${esc(m.t)}</div>${m.h?`<div class="aih">🔒 ${m.h} detail${m.h>1?'s':''} hidden before sending</div>`:''}`;
 if(m.r==='e')return`<div class="aib e">${esc(m.t)}</div>`;
 return(m.t?`<div class="aib a">${esc(m.t)}</div>`:'')+(m.cards||[]).map(cardHtml).join('')}
const CHIPS=[['Write a description','Write a short, exciting description for this event.'],['Payment link','Create a payment link for the entry fee of 100 rupees.'],['Registration questions','Add registration questions suitable for this event.'],['Assign a task','Assign a task: '],['Item to buy','Add an item to buy: ']];
function paint(){
 const p=$('cem-ai');if(!p)return;const E=cur();
 if(A.view==='consent'||!okConsent()){p.innerHTML=consentHtml();return}
 const m=$('ai-msgs'),keep=m?m.scrollTop:0,stick=!m||m.scrollHeight-m.scrollTop-m.clientHeight<80;
 p.innerHTML=`<header><div><b>✨ AI helper</b><br><small>🔒 Names and numbers are hidden before sending</small></div><button class="x" data-a="close" aria-label="Close">×</button></header>
 <div id="ai-msgs" aria-live="polite">${A.msgs.length?A.msgs.map(msgHtml).join(''):`<div class="aib a">${E?'Tell me what to do for <b>'+esc(E.name||'this event')+'</b>. I only draft; you confirm each change.':'Open an event first, then ask me.'}</div><div class="aichips">${CHIPS.map((c,i)=>`<button data-a="chip" data-i="${i}">${c[0]}</button>`).join('')}</div>`}${A.busy?'<div class="aib a">Thinking…</div>':''}</div>
 <form id="ai-f"><textarea id="ai-in" rows="1" maxlength="${MAXIN}" placeholder="e.g. Assign poster printing to Rahul by Friday" aria-label="Message"></textarea><button class="p" type="submit"${A.busy?' disabled':''}>Send</button></form>
 <footer><button data-a="clear">Clear chat</button><button data-a="priv">Privacy</button><span>${A.left!=null?A.left+' messages left today':''}</span></footer>`;
 const mm=$('ai-msgs');if(mm)mm.scrollTop=stick?mm.scrollHeight:keep}
function consentHtml(){const on=okConsent();return`<header><b>✨ AI helper · Privacy</b><button class="x" data-a="${on?'back':'close'}" aria-label="Close">×</button></header><div class="aip">
 <h3>Before you use it</h3><b>Sent to Google Gemini</b><ul><li>What you type here, with team names, emails, phone, UPI and ID numbers replaced first.</li><li>Event title, type, date, venue, team roles (not names), group names and registration question labels.</li></ul>
 <b>Never sent</b><ul><li>Attendee lists, registrations, payments, UPI IDs, budgets, tickets, chat messages.</li></ul>
 <b>Please know</b><ul><li>This runs on Google's <u>free plan</u>: Google may use these prompts to improve its products, and people may review them. Do not type private details.</li><li>A name that is not on your team list cannot be recognised, so avoid typing names of attendees.</li><li>The AI only drafts. Nothing changes until you tap Confirm. The chat is kept in memory and erased when you close the app.</li></ul>
 ${on?`<div class="aiact"><button class="p" data-a="back">Back to chat</button><button class="g" data-a="revoke">Turn off and forget</button></div>`:`<label><input type="checkbox" id="ai-ok"><span>I understand and want to use the AI helper.</span></label><div class="aiact"><button class="p" data-a="agree">Turn on</button><button class="g" data-a="close">Not now</button></div>`}</div>`}

function ensureUi(){css();if($('cem-ai'))return;
 const b=document.createElement('button');b.id='cem-ai-fab';b.type='button';b.textContent='✨ AI';b.hidden=true;b.setAttribute('aria-label','Open AI helper');b.dataset.a='open';
 const p=document.createElement('div');p.id='cem-ai';p.hidden=true;p.setAttribute('role','dialog');p.setAttribute('aria-label','AI helper');document.body.append(b,p);
 document.addEventListener('click',onClick);p.addEventListener('input',onInput);p.addEventListener('change',onInput);p.addEventListener('submit',e=>{e.preventDefault();const t=$('ai-in');if(t){const x=t.value;t.value='';send(x)}});
 p.addEventListener('keydown',e=>{if(e.target.id==='ai-in'&&e.key==='Enter'&&!e.shiftKey&&matchMedia('(pointer:fine)').matches){e.preventDefault();const x=e.target.value;e.target.value='';send(x)}})}
const cardOf=id=>{for(const m of A.msgs)for(const c of m.cards||[])if(c.id===id)return c};
function onInput(e){const t=e.target,c=t.dataset&&t.dataset.c&&cardOf(t.dataset.c);if(!c||c.st!=='open')return;
 if(t.dataset.q!==undefined)c.v.q[+t.dataset.q].on=t.checked;else if(t.dataset.f)c.v[t.dataset.f]=t.value}
function onClick(e){const t=e.target.closest&&e.target.closest('[data-a]');if(!t)return;const a=t.dataset.a,c=t.dataset.c&&cardOf(t.dataset.c);
 if(a==='open'){A.open=true;$('cem-ai').hidden=false;$('cem-ai-fab').hidden=true;paint();return}
 if(!$('cem-ai')||!$('cem-ai').contains(t))return;
 if(a==='close'){A.open=false;A.view='chat';$('cem-ai').hidden=true;tick();return}
 if(a==='agree'){if(!$('ai-ok')||!$('ai-ok').checked)return toast('Tick the box to continue');setConsent(true);A.view='chat';paint();return}
 if(a==='priv'){A.view='consent';paint();return}
 if(a==='back'){A.view='chat';paint();return}
 if(a==='revoke'){setConsent(false);A.msgs=[];A.left=null;A.view='chat';paint();toast('AI helper turned off');return}
 if(a==='clear'){A.msgs=[];paint();return}
 if(a==='chip'){const x=CHIPS[+t.dataset.i][1],i=$('ai-in');if(/: $/.test(x)){i.value=x;i.focus()}else send(x);return}
 if(!c)return;
 if(a==='no'){c.st='no';paint();return}
 if(a==='ok'){const r=apply(c);if(r[0]){c.st='done';c.res=r[1]}else c.res=r[1];paint();return}
 if(a==='copy'&&c.link){(navigator.clipboard?navigator.clipboard.writeText(c.link):Promise.reject()).then(()=>toast('Link copied'),()=>toast(c.link));return}
 if(a==='share'&&c.link){navigator.share({title:c.v.title,url:c.link}).catch(()=>{})}}

async function send(raw){
 if(A.busy)return;const text=String(raw||'').trim().slice(0,MAXIN);if(!text)return;
 if(!okConsent()){A.view='consent';paint();return}
 const E=cur();if(!E){toast('Open an event first');return}
 const ctx=build(E),hid=hide(text);
 A.msgs.push({r:'u',t:text,s:hid[0],h:hid[1]});A.busy=true;paint();
 let h=A.msgs.filter(m=>(m.r==='u'||m.r==='a')&&m.s).slice(-MAXH).map(m=>({role:m.r==='u'?'user':'model',text:m.s}));
 while(h.length&&h[0].role!=='user')h.shift();
 try{
  const j=await call({ctx,contents:h});A.left=j.left;
  const cards=(j.calls||[]).map(c=>mkCard(c,E)).filter(Boolean);
  const sum=(j.calls||[]).map(c=>'[proposed '+c.name+': '+JSON.stringify(c.args||{}).slice(0,200)+']').join(' ');
  A.msgs.push({r:'a',t:unmask(j.text||''),s:((j.text||'')+' '+sum).trim()||'(no reply)',cards:cards.length?cards:null});
  if(!j.text&&!cards.length)A.msgs.push({r:'e',t:'I could not turn that into an action. Try rephrasing.'})
 }catch(err){A.msgs.push({r:'e',t:err.message||'Something went wrong.'})}
 A.busy=false;paint()}

function tick(){const b=$('cem-ai-fab');if(!b)return;let show=false;try{show=!A.open&&V.tab==='detail'&&!!cur()}catch(e){}b.hidden=!show}
function init(){ensureUi();setInterval(tick,700);tick()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
