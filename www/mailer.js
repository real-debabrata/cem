/* CEM 3.10.0: bulk ticket email.  Attendees > Email tickets  (roles with "Attendees and check-in": Organizer, Manager, Treasurer,
   Team lead, Coordinator, Registration desk, and custom roles that have it. Nobody has to be added; the role decides.)

   Two ways to send, both from the organiser's OWN mailbox:
   1) My mail app   - the phone's or computer's default mail app opens with the attendee's name, message and personal ticket link
                      already filled in. The organiser taps Send, comes back, taps "Open next". (A web page or app cannot press Send
                      inside another app for you; that is how every mail app works.)
   2) SMTP (automatic) - the organiser's own Gmail / Zoho / Brevo / college mail login. The app sends batches of 8 through the
                      Worker (worker/otp-worker.js, /mail/send), which signs in to that mail server and sends every email with the
                      attendee's own QR picture inside. The login is kept only on this device (localStorage), never in the event data,
                      so teammates cannot read it.

   The QR is the same ticket the app already uses:  CEM1:<event code>:<ticket id>  (scan.js). Nothing about check-in changes.
   Each attendee row gets ml (time) and mlv ('app' or 'smtp') when their email went out; the list shows an "Emailed" tag.
   Works in the Android app unchanged: mailto: links open the phone's mail app, and SMTP is a normal HTTPS call. */
(function(){
const $=id=>document.getElementById(id);
const LS={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}},del(k){try{localStorage.removeItem(k)}catch(e){}}};
const EMAIL=/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]{2,}$/,BATCH=8,CID='ticket-qr@cem.local';
const SMTP_KEY='cem-mail-smtp',TPL_KEY=id=>'cem-mail-tpl:'+id;
const later=fn=>{clearTimeout(later.t);later.t=setTimeout(fn,160)};
const slug=s=>String(s||'event').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)||'event';

const DEF_SUBJECT='Your ticket for {event}';
const DEF_BODY='Hi {first_name},\n\nYou are registered for {event}.\nWhen: {date} {time}\nWhere: {venue}\n\nYour personal QR ticket:\n{qr}\n\nShow it at the entrance. It works only once, so please do not forward it.\n\nSee you there!\n{organizer}';
const TAGS=[['first_name','First name'],['name','Full name'],['event','Event name'],['date','Event date'],['time','Event time'],['venue','Venue'],['qr','QR ticket (picture in automatic emails, link in your mail app)'],['ticket_link','Link to the ticket page'],['college_id','College ID']];
const KNOWN=TAGS.map(t=>t[0]).concat(['ticket_id','email','organizer']);
const PROV={
 gmail:{n:'Gmail or Google Workspace',host:'smtp.gmail.com',port:465,note:'Use an app password: Google account &gt; Security &gt; 2-Step Verification must be on, then App passwords. Your normal password will not work.'},
 zoho:{n:'Zoho Mail (India)',host:'smtp.zoho.in',port:465,note:'Use an app-specific password from Zoho Accounts &gt; Security. Outside India use the global server smtp.zoho.com.'},
 zohog:{n:'Zoho Mail (global)',host:'smtp.zoho.com',port:465,note:'Use an app-specific password from Zoho Accounts &gt; Security.'},
 yahoo:{n:'Yahoo Mail',host:'smtp.mail.yahoo.com',port:465,note:'Create an app password in Yahoo Account Security.'},
 brevo:{n:'Brevo (free, 300 emails a day)',host:'smtp-relay.brevo.com',port:587,note:'Username is the SMTP login shown in Brevo &gt; SMTP &amp; API (it may look like abc123@smtp-brevo.com). Password is an SMTP key. Put your verified sender address in Send from.'},
 outlook:{n:'Outlook or Microsoft 365',host:'smtp.office365.com',port:587,note:'Microsoft is switching off password sign-in for SMTP at the end of December 2026, so this may stop working. Gmail, Zoho or Brevo are safer choices.'},
 custom:{n:'Another mail server',host:'',port:587,note:'Ask your mail administrator for the SMTP server, port (465 or 587), username and password.'}
};

let M={eid:null,scope:'pending',mode:'app',tpl:null,smtp:null,run:null,all:false,msg:''};

/* ---------- styles ---------- */
const css=document.createElement('style');
css.textContent=`#ml{position:fixed;inset:0;z-index:58;display:grid;place-items:start center;background:rgba(16,23,43,.7);backdrop-filter:blur(4px);padding:14px;overflow:auto;-webkit-overflow-scrolling:touch}
#ml .box{position:relative;background:var(--card);color:var(--ink);border-radius:18px;padding:18px;width:min(580px,100%);margin:auto;box-shadow:0 24px 70px rgba(0,0,0,.5);outline:0}
#ml .box>.card{border-radius:12px}#ml .box>.card:last-child{margin-bottom:0}
#ml textarea{min-height:150px;resize:vertical;line-height:1.45}
#ml .pv{background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:10px 12px;font-size:14px}
#ml .pv pre{margin:6px 0 0;white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}
#ml iframe{width:100%;height:340px;border:1px solid var(--line);border-radius:12px;background:#f6f7fb;margin-top:6px}
#ml .chip{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px}
#ml details{border:1px solid var(--line);border-radius:12px;margin:10px 0 0;padding:0 12px}#ml summary{cursor:pointer;padding:10px 0;font-weight:600;font-size:14px}
#ml .mi{display:flex;gap:8px;align-items:center;padding:6px 0;border-top:1px solid var(--line)}#ml .mi span{flex:1 1 40%;min-width:0;overflow-wrap:anywhere;font-size:14px}#ml .mi input{flex:1 1 55%;min-width:0}
#ml .bad{color:var(--bad)}#ml .errs{max-height:150px;overflow:auto;font-size:13px;margin-top:8px}
#hg{z-index:70!important}`;
document.head.append(css);

/* ---------- data ---------- */
const emailOf=(e,r)=>{
 const c=[r.em];(e.fields||[]).forEach(f=>{if(f.type!=='checkbox'&&/e-?mail/i.test(f.label||''))c.push(r.data&&r.data[f.id])});
 for(const v of c){const s=String(v||'').trim();if(EMAIL.test(s))return s}
 return '';
};
function lists(e){
 const rs=regsOf(e.id).slice().sort((a,b)=>(a.at||0)-(b.at||0)),withMail=[],noMail=[];
 rs.forEach(r=>{const em=emailOf(e,r);(em?withMail:noMail).push({r,em})});
 return{withMail,noMail,pending:withMail.filter(x=>!x.r.ml),done:withMail.filter(x=>x.r.ml)};
}
const pool=e=>{const L=lists(e);return M.scope==='all'?L.withMail:L.pending};
const ticketLink=(e,r)=>window.ticketLinkOf?ticketLinkOf(e,r):'';
const can_=e=>!!(e&&window.can&&can(e,'regs'));

function vals(e,x){
 const r=x.r,nm=String(r.name||'Guest').trim()||'Guest',when=new Date(e.date+'T'+(e.time||'00:00')),ok=!isNaN(when);
 return{name:nm,first_name:nm.split(/\s+/)[0]||nm,event:e.name||'',
  date:ok?when.toLocaleDateString([],{weekday:'long',day:'numeric',month:'long',year:'numeric'}):(e.date||''),
  time:ok&&e.time?when.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'',venue:e.venue||'',
  ticket_link:ticketLink(e,r),ticket_id:r.id||'',college_id:r.cid||(window.regCid?regCid(e,r):'')||'',email:x.em||'',organizer:M.tpl.fromName||''};
}
const tidy=t=>t.replace(/[ \t]+$/gm,'').replace(/^[A-Za-z ]{2,20}:[ \t]*\n/gm,'').replace(/\n{3,}/g,'\n\n').trim();   // drops "Where:" when the venue is empty
const mergeText=(tpl,v)=>String(tpl||'').replace(/\{(\w+)\}/g,(m,k)=>k==='qr'?(v.ticket_link||''):(k in v?v[k]:m));
const qrBlock=(v,sz)=>`<div data-qr="1" style="text-align:center;margin:18px 0 8px"><img src="cid:${CID}" width="${sz}" height="${sz}" alt="QR ticket for ${esc(v.name)}" style="display:inline-block;border:1px solid #e1e4ef;border-radius:12px;padding:6px;background:#ffffff"></div>`+
 (v.ticket_link?`<div style="text-align:center;margin:0 0 10px"><a href="${esc(v.ticket_link)}" style="background:#5948f5;color:#ffffff;text-decoration:none;font-weight:700;padding:11px 20px;border-radius:9px;display:inline-block">Open my ticket</a></div>`:'');
function mergeHtml(tpl,v,sz){
 const inner=String(tpl||'').split(/(\{\w+\})/).map(p=>{
  const m=/^\{(\w+)\}$/.exec(p);
  if(!m)return esc(p).replace(/\r?\n/g,'<br>');
  const k=m[1];
  if(k==='qr')return qrBlock(v,sz);
  if(k==='ticket_link')return v.ticket_link?`<a href="${esc(v.ticket_link)}" style="color:#5948f5">${esc(v.ticket_link)}</a>`:'';
  return k in v?esc(v[k]):esc(p);
 }).join('').replace(/(<br>\s*)+(<div data-qr)/g,'$2').replace(/(<\/div>)(\s*<br>)+/g,'$1');
 return `<!doctype html><html><body style="margin:0;padding:16px;background:#f6f7fb"><div style="max-width:480px;margin:0 auto;background:#ffffff;color:#10172b;font:15px/1.55 Arial,Helvetica,sans-serif;border:1px solid #e1e4ef;border-radius:14px;padding:22px">${inner}</div></body></html>`;
}
// QR as a PNG (base64) drawn from the same library the ticket page uses. Same payload as scan.js.
function qrPng(text){
 try{
  const q=qrcode(0,'M');q.addData(text);q.make();
  const n=q.getModuleCount(),px=Math.max(4,Math.floor(264/(n+8))),m=4*px,s=n*px+2*m,c=document.createElement('canvas');
  c.width=c.height=s;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,s,s);g.fillStyle='#000';
  for(let i=0;i<n;i++)for(let j=0;j<n;j++)if(q.isDark(i,j))g.fillRect(m+j*px,m+i*px,px,px);
  return{b64:c.toDataURL('image/png').split(',')[1],size:s};
 }catch(x){return{b64:'',size:240}}
}
function mailto(e,x){
 const v=vals(e,x),s=mergeText(M.tpl.subject,v).replace(/\s+/g,' ').trim(),b=tidy(mergeText(M.tpl.body,v));
 return 'mailto:'+encodeURIComponent(x.em).replace(/%40/g,'@')+'?subject='+encodeURIComponent(s)+'&body='+encodeURIComponent(b);
}
function openMail(url){const a=document.createElement('a');a.href=url;a.rel='noopener';a.style.display='none';document.body.append(a);a.click();a.remove()}
const sample=e=>{const f=lists(e).withMail[0]||lists(e).noMail[0];return f?{r:f.r,em:f.em||'name@example.com'}:{r:{id:'sampleticket1',name:'Asha Rao'},em:'asha@example.com'}};

/* ---------- storage (this device only) ---------- */
function load(e){
 const t=LS.get(TPL_KEY(e.id),{});
 M.tpl={subject:t.subject||DEF_SUBJECT,body:t.body||DEF_BODY,fromName:t.fromName!=null?t.fromName:(e.name||'Event')+' team'};
 const s=LS.get(SMTP_KEY,null);
 M.smtp=Object.assign({prov:'gmail',host:PROV.gmail.host,port:PROV.gmail.port,user:'',pass:'',from:'',remember:true},s||{});
 M.mode=LS.get('cem-mail-mode','app');
}
const saveTpl=()=>LS.set(TPL_KEY(M.eid),M.tpl);

/* ---------- the window ---------- */
function open(eid){
 const e=S.events.find(x=>x.id===eid);if(!can_(e))return toast('You need the Attendees and check-in permission for this.');
 M.eid=eid;M.scope='pending';M.run=null;M.all=false;M.msg='';load(e);
 let m=$('ml');if(!m){m=document.createElement('div');m.id='ml';document.body.append(m)}
 m.innerHTML=`<div class="box" role="dialog" aria-modal="true" aria-label="Email tickets" tabindex="-1">
  <div class="sh" style="margin-bottom:0"><h3>Email tickets</h3><button type="button" class="btn ghost sm" data-mlx="1">Close</button></div>
  <p class="meta" style="margin:2px 0 0">${esc(e.name)}</p>
  <div id="mls" style="margin-top:12px"></div><div id="mled"></div><div id="mlpv"></div>
  <div class="seg" role="group" aria-label="How to send" style="margin-top:14px"><button type="button" data-mlm="app">My mail app</button><button type="button" data-mlm="smtp">Automatic (SMTP)</button></div>
  <div id="mlm"></div></div>`;
 drawEditor();drawAll();m.querySelector('.box').focus();
}
function close(){
 if(M.run&&M.run.active){if(!confirm('Sending is still running. Stop and close?'))return;M.run.stop=true}
 const m=$('ml');if(m)m.remove();M.eid=null;
}
const cur_=()=>S.events.find(x=>x.id===M.eid);
function drawAll(){const e=cur_();if(!e)return;drawSummary();drawPreview();drawMethod();document.querySelectorAll('#ml [data-mlm]').forEach(b=>b.classList.toggle('on',b.dataset.mlm===M.mode))}

function drawSummary(){
 const e=cur_(),box=$('mls');if(!e||!box)return;
 const L=lists(e),n=pool(e).length,base=window.siteBase?siteBase():'',wasOpen=!!($('mlmiss')&&$('mlmiss').open);
 const miss=L.noMail.length?`<details id="mlmiss" ${wasOpen?'open':''}><summary>${L.noMail.length} attendee${L.noMail.length===1?' has':'s have'} no email address</summary><p class="meta" style="margin:0 0 6px">Type an email to include them. It is saved on the attendee.</p>${L.noMail.slice(0,25).map(x=>`<div class="mi"><span>${esc(x.r.name)}</span><input type="email" inputmode="email" placeholder="name@example.com" data-mlem="${esc(x.r.id)}" aria-label="Email for ${esc(x.r.name)}"></div>`).join('')}${L.noMail.length>25?`<p class="meta" style="margin:6px 0 10px">Showing 25 of ${L.noMail.length}. Imported spreadsheets can include an Email column.</p>`:''}</details>`:'';
 box.innerHTML=`${base?'':'<div class="note" style="margin-bottom:10px"><b>Set your public site address first.</b> Ticket links need it: Income &gt; Link settings, or Attendees &gt; Registration.</div>'}
  <div class="chips" style="margin:0 0 6px"><button type="button" class="chip ${M.scope==='pending'?'on':''}" data-mls="pending">Not emailed yet (${L.pending.length})</button><button type="button" class="chip ${M.scope==='all'?'on':''}" data-mls="all">Everyone with an email (${L.withMail.length})</button></div>
  <p class="meta" style="margin:0">${n} will be emailed${L.done.length?`, ${L.done.length} already done`:''}.${L.done.length?' <button type="button" class="link" data-mlclr="1">Clear &ldquo;emailed&rdquo; marks</button>':''}</p>${miss}`;
}
function drawEditor(){
 const b=$('mled');if(!b)return;
 b.innerHTML=`<div class="card" style="margin:12px 0"><label for="mlsub" style="margin-top:0">Subject</label><input id="mlsub" maxlength="150" value="${esc(M.tpl.subject)}">
  <label for="mlbody">Message</label><textarea id="mlbody">${esc(M.tpl.body)}</textarea>
  <div class="chips" style="margin:8px 0 0" aria-label="Insert a detail">${TAGS.map(t=>`<button type="button" class="chip" data-mltag="${t[0]}" title="${esc(t[1])}">{${t[0]}}</button>`).join('')}</div>
  <label for="mlfn">Your name or team (the From name, and {organizer})</label><input id="mlfn" maxlength="60" value="${esc(M.tpl.fromName)}">
  <p class="meta" id="mlwarn" style="margin:8px 0 0"></p>
  <div class="row" style="margin-top:6px"><button type="button" class="link" data-mlrst="1">Reset message</button><button type="button" class="link" data-mlhelp="1">Setup guide</button></div></div>`;
}
function drawWarn(){
 const w=$('mlwarn');if(!w)return;const b=M.tpl.body,u=[...new Set((b+' '+M.tpl.subject).match(/\{\w+\}/g)||[])].filter(t=>!KNOWN.includes(t.slice(1,-1)));
 w.className='meta bad';
 w.textContent=!/\{(qr|ticket_link)\}/.test(b)?'Your message has no {qr} or {ticket_link}, so attendees would not get their ticket.':u.length?'Unknown tag: '+u.join(' ')+'. Use the buttons above.':'';
}
function drawPreview(){
 const e=cur_(),box=$('mlpv');if(!e||!box)return;drawWarn();
 const x=sample(e),v=vals(e,x),sub=mergeText(M.tpl.subject,v);
 let body;
 if(M.mode==='smtp'){const q=qrPng('CEM1:'+e.id+':'+x.r.id),h=mergeHtml(M.tpl.body,v,q.size).split('cid:'+CID).join('data:image/png;base64,'+q.b64);body=`<iframe sandbox="" title="Preview of the email" srcdoc="${h.replace(/&/g,'&amp;').replace(/"/g,'&quot;')}"></iframe>`}
 else body=`<pre>${esc(tidy(mergeText(M.tpl.body,v)))}</pre>`;
 box.innerHTML=`<div class="card" style="margin:0 0 4px"><p class="meta" style="margin:0 0 6px">Preview for ${esc(x.r.name)}</p><div class="pv"><b>${esc(sub)}</b>${M.mode==='smtp'?'':body}</div>${M.mode==='smtp'?body:''}</div>`;
}

function drawMethod(){
 const e=cur_(),box=$('mlm');if(!e||!box)return;
 box.innerHTML=M.mode==='smtp'?smtpPanel(e):appPanel(e);
 drawRun();
}
function appPanel(e){
 const L=pool(e),left=L.filter(x=>!x.r.ml).length,rows=(M.all?L:L.slice(0,12));
 return `<div class="card" style="margin-top:0"><p style="margin:0 0 10px">Your mail app opens with the name, message and personal ticket link filled in. Tap <b>Send</b> there, press Back to return here, then open the next one.</p>
  <button type="button" class="btn" data-mlnext="1" style="width:100%" ${left?'':'disabled'}>${left?`Open next (${left} left)`:'All opened'}</button>
  <p class="meta" style="margin:8px 0 0">The ticket link shows each person's own QR code. For the QR picture inside the email itself, use Automatic (SMTP).</p>
  ${rows.length?`<div style="margin-top:8px">${rows.map(x=>`<div class="li"><div class="main"><div class="ttl">${esc(x.r.name)}</div><div class="sub">${esc(x.em)}</div></div><div class="act">${x.r.ml?'<span class="pill ok">Opened</span> ':''}<button type="button" class="btn ${x.r.ml?'ghost ':''}sm" data-mlone="${esc(x.r.id)}">${x.r.ml?'Open again':'Open'}</button></div></div>`).join('')}${!M.all&&L.length>12?`<button type="button" class="link" data-mlall="1" style="margin-top:8px">Show all ${L.length}</button>`:''}</div>`:'<p class="meta" style="margin:10px 0 0">Nobody to email in this selection.</p>'}
  <div class="row" style="margin-top:12px"><button type="button" class="link" data-mlcsv="1">Download mail-merge file (CSV)</button></div></div>`;
}
const signed=()=>!!(window.firebase&&firebase.apps&&firebase.apps.length&&firebase.auth().currentUser);
function smtpPanel(e){
 const s=M.smtp,api=String(window.OTP_API||'').trim(),n=pool(e).length,p=PROV[s.prov]||PROV.custom;
 if(!api)return '<div class="note">Automatic sending is not set up yet. The app administrator must add the email service address (<code>OTP_API</code>) to <code>firebase-config.js</code> and update the Worker. Steps: Help &amp; guides &gt; Email tickets.</div>';
 if(!signed())return '<div class="note">Sign in to the app to send email automatically.</div>';
 return `<div class="card" style="margin-top:0"><p class="meta" style="margin:0 0 8px">Uses <b>your own</b> mail account. The login stays on this device and is never shared with your team.</p>
  <label for="mlprov" style="margin-top:0">Mail provider</label><select id="mlprov">${Object.keys(PROV).map(k=>`<option value="${k}" ${k===s.prov?'selected':''}>${PROV[k].n}</option>`).join('')}</select>
  <p class="meta" id="mlpn" style="margin:6px 0 0">${p.note}</p>
  <div class="two"><div><label for="mlhost">Server</label><input id="mlhost" value="${esc(s.host)}" autocapitalize="off" autocomplete="off" spellcheck="false"></div><div><label for="mlport">Port</label><select id="mlport"><option value="465" ${+s.port===465?'selected':''}>465 (SSL)</option><option value="587" ${+s.port===587?'selected':''}>587 (STARTTLS)</option></select></div></div>
  <label for="mluser">Username (usually your email)</label><input id="mluser" type="email" value="${esc(s.user)}" autocapitalize="off" autocomplete="off" spellcheck="false">
  <label for="mlpass">Password or app password</label><input id="mlpass" type="password" value="${esc(s.pass)}" autocomplete="off"><label style="display:flex;gap:6px;align-items:center;font-weight:500;margin:6px 0 0"><input type="checkbox" id="mlshow"> Show password</label>
  <label for="mlfrom">Send from (leave empty to use the username)</label><input id="mlfrom" type="email" value="${esc(s.from)}" autocapitalize="off" autocomplete="off" spellcheck="false">
  <label style="display:flex;gap:6px;align-items:center;font-weight:500;margin:10px 0 0"><input type="checkbox" id="mlrem" ${s.remember?'checked':''}> Remember this login on this device</label>
  ${LS.get(SMTP_KEY,null)?'<button type="button" class="link" data-mlforget="1" style="margin-top:4px">Forget the saved login</button>':''}
  <div class="row" style="margin-top:12px"><button type="button" class="btn ghost sm" data-mltest="conn">Test connection</button><button type="button" class="btn ghost sm" data-mltest="mail">Send a test email to me</button></div>
  <p class="meta" id="mlst" role="status" aria-live="polite" style="margin:8px 0 0">${esc(M.msg)}</p></div>
  <div id="mlrun"></div>
  <button type="button" class="btn" data-mlsend="1" style="width:100%" ${n&&!(M.run&&M.run.active)?'':'disabled'}>Send to ${n} attendee${n===1?'':'s'}</button>
  <p class="meta" style="margin:8px 0 0">Each email has that person's own QR picture. Gmail allows about 500 recipients a day (2,000 for Google Workspace).</p>`;
}
function drawRun(){
 const b=$('mlrun');if(!b)return;const r=M.run;
 if(!r||r.test){b.innerHTML='';return}
 const pc=r.total?Math.round(r.done/r.total*100):0;
 b.innerHTML=`<div class="card"><div class="sh" style="margin-bottom:6px"><h3 style="font-size:15px">${r.active?'Sending...':r.fatal?'Stopped':r.stop?'Stopped':'Finished'}</h3>${r.active?'<button type="button" class="btn ghost sm" data-mlstop="1">Stop</button>':''}</div>
  <div class="prog" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pc}"><i style="width:${pc}%"></i></div>
  <p class="meta" style="margin:8px 0 0" role="status" aria-live="polite">${r.ok} sent${r.fail?`, <b class="bad">${r.fail} failed</b>`:''} of ${r.total}.${r.fatal?` <b class="bad">${esc(r.fatal)}</b>`:''}${!r.active&&(r.fail||r.fatal||r.stop)?' Choose &ldquo;Not emailed yet&rdquo; and send again to retry the rest.':''}</p>
  ${r.errs.length?`<div class="errs">${r.errs.map(x=>`<div><b>${esc(x.name)}</b> (${esc(x.em)}): ${esc(x.why)}</div>`).join('')}</div>`:''}</div>`;
}

/* ---------- sending ---------- */
const token=force=>{const u=signed()&&firebase.auth().currentUser;if(!u)return Promise.reject(new Error('signin'));return u.getIdToken(!!force)};
async function api(path,body,again){
 const base=String(window.OTP_API||'').replace(/\/+$/,'');
 let tk;try{tk=await token(again)}catch(x){throw new Error('Please sign in again to send email.')}
 let r;try{r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tk},body:JSON.stringify(body)})}
 catch(x){throw new Error('Could not reach the email service. Check your internet connection.')}
 const j=await r.json().catch(()=>({ok:false,message:'The email service sent an unexpected answer.'}));
 if(r.status===401&&!j.stage&&!again)return api(path,body,true);
 if(r.status===404)return{ok:false,message:'The email service needs the newer Worker. Update it (SETUP.md, Upgrade to 3.10.0).'};
 if(r.status===403)return{ok:false,message:'This app is not allowed to use the email service. Add its address to ALLOWED_ORIGINS in the Worker.'};
 return j;
}
function readSmtp(){
 const g=id=>($(id)||{}).value||'',s=M.smtp;
 s.prov=g('mlprov')||s.prov;s.host=g('mlhost').trim().toLowerCase();s.port=+g('mlport')||465;s.user=g('mluser').trim();s.pass=g('mlpass');s.from=g('mlfrom').trim();s.remember=!!($('mlrem')&&$('mlrem').checked);
 return s;
}
function checkSmtp(s){
 if(!s.host)return 'Enter the mail server.';if(!s.user)return 'Enter your username.';if(!s.pass)return 'Enter the password or app password.';
 if(!EMAIL.test(s.from||s.user))return 'Enter the email address to send from.';return '';
}
const keep=s=>{if(s.remember)LS.set(SMTP_KEY,{prov:s.prov,host:s.host,port:s.port,user:s.user,pass:s.pass,from:s.from,remember:true});else LS.del(SMTP_KEY)};
const say=t=>{M.msg=t;const n=$('mlst');if(n)n.textContent=t};
const creds=s=>({host:s.host,port:s.port,user:s.user,pass:s.pass});

function build(e,x,s,test){
 const v=vals(e,x),q=qrPng('CEM1:'+e.id+':'+x.r.id);
 return{to:test?(s.from||s.user):x.em,name:test?'You (test)':x.r.name,subject:(test?'[Test] ':'')+mergeText(M.tpl.subject,v).replace(/\s+/g,' ').trim(),
  text:tidy(mergeText(M.tpl.body,v)),html:mergeHtml(M.tpl.body,v,q.size),qr:q.b64};
}
async function testSmtp(kind){
 const e=cur_();if(!can_(e))return;const s=readSmtp(),bad=checkSmtp(s);if(bad)return say(bad);
 say(kind==='conn'?'Connecting...':'Sending a test email...');
 try{
  const j=kind==='conn'?await api('/mail/verify',{smtp:creds(s)}):await api('/mail/send',{smtp:creds(s),from:{email:s.from||s.user,name:M.tpl.fromName},messages:[build(e,sample(e),s,true)]});
  if(!j.ok)return say(j.message||'It did not work.');
  keep(s);
  if(kind==='conn')say('Connected and logged in. You can send now.');
  else{const q=(j.results||[])[0];say(q&&q.ok?'Test email sent to '+(s.from||s.user)+'. Check your inbox (and spam).':'The test email failed: '+((q&&q.error)||'unknown error'))}
 }catch(x){say(x.message)}
}
async function sendAll(){
 const e=cur_();if(!can_(e))return toast('You no longer have permission to send.');
 const L=pool(e);if(!L.length)return;const s=readSmtp(),bad=checkSmtp(s);if(bad)return say(bad);
 if(!confirm('Send '+L.length+' email'+(L.length===1?'':'s')+' from '+(s.from||s.user)+'?\n\nEach person gets their own ticket QR.'))return;
 M.run={active:true,total:L.length,done:0,ok:0,fail:0,errs:[],fatal:'',stop:false};drawMethod();
 const r=M.run;
 for(let i=0;i<L.length&&!r.stop;i+=BATCH){
  if(!can_(cur_())){r.fatal='Your permission to send was removed.';break}
  const chunk=L.slice(i,i+BATCH);let j;
  try{j=await api('/mail/send',{smtp:creds(s),from:{email:s.from||s.user,name:M.tpl.fromName},messages:chunk.map(x=>build(e,x,s,false))})}
  catch(x){r.fatal=x.message||'Network problem.';break}
  if(!j.ok){r.fatal=j.message||'The email service refused the request.';break}
  if(i===0)keep(s);
  (j.results||[]).forEach((q,k)=>{const x=chunk[k];if(!x)return;r.done++;
   if(q.ok){r.ok++;x.r.ml=Date.now();x.r.mlv='smtp'}else{r.fail++;r.errs.push({name:x.r.name,em:x.em,why:q.error||'Not sent'})}});
  save();drawRun();drawSummary();
 }
 r.active=false;if(!$('ml'))return;drawMethod();drawSummary();sv();
}

/* ---------- mail-merge file ---------- */
function csv(){
 const e=cur_();if(!e||!window.cemSave||!window.cemCsv)return;const L=pool(e);if(!L.length)return toast('Nobody to export');
 const rows=L.map(x=>{const v=vals(e,x);return[v.name,v.first_name,x.em,v.ticket_link,x.r.id,v.college_id,mergeText(M.tpl.subject,v),tidy(mergeText(M.tpl.body,v))]});
 cemSave(slug(e.name)+'-mail-merge.csv','text/csv;charset=utf-8',cemCsv(['Name','First name','Email','Ticket link','Ticket ID','College ID','Subject','Message'],rows));
}

/* ---------- events ---------- */
document.addEventListener('click',x=>{
 const t=x.target.closest('button');if(!t)return;const D=t.dataset;
 if(D.mail!==undefined){const E=cur();if(E)open(E.id);return}
 if(!$('ml')||!$('ml').contains(t))return;
 const e=cur_();
 if(D.mlx!==undefined)close();
 else if(D.mlm){if(M.run&&M.run.active)return;M.mode=D.mlm;LS.set('cem-mail-mode',M.mode);drawAll()}
 else if(D.mls){M.scope=D.mls;M.all=false;drawSummary();drawMethod()}
 else if(D.mltag){const a=$('mlbody');if(!a)return;const p=a.selectionStart==null?a.value.length:a.selectionStart,q=a.selectionEnd==null?p:a.selectionEnd,ins='{'+D.mltag+'}';
  a.value=a.value.slice(0,p)+ins+a.value.slice(q);a.focus();a.selectionStart=a.selectionEnd=p+ins.length;M.tpl.body=a.value;saveTpl();drawPreview()}
 else if(D.mlrst!==undefined){if(!confirm('Put back the standard subject and message?'))return;M.tpl.subject=DEF_SUBJECT;M.tpl.body=DEF_BODY;saveTpl();drawEditor();drawPreview()}
 else if(D.mlhelp!==undefined){if(window.openHelp)openHelp('mail')}
 else if(D.mlclr!==undefined){if(!can_(e)||!confirm('Clear the "emailed" mark on everyone? They will count as not emailed yet.'))return;regsOf(e.id).forEach(r=>{delete r.ml;delete r.mlv});sv();drawSummary();drawMethod()}
 else if(D.mlall!==undefined){M.all=true;drawMethod()}
 else if(D.mlnext!==undefined||D.mlone){
  if(!can_(e))return;const L=pool(e),x1=D.mlone?L.find(z=>z.r.id===D.mlone):L.find(z=>!z.r.ml);if(!x1)return;
  openMail(mailto(e,x1));x1.r.ml=Date.now();x1.r.mlv='app';sv();drawSummary();drawMethod();
 }
 else if(D.mlcsv!==undefined)csv();
 else if(D.mltest)testSmtp(D.mltest);
 else if(D.mlsend!==undefined)sendAll();
 else if(D.mlstop!==undefined){if(M.run)M.run.stop=true;drawRun()}
 else if(D.mlforget!==undefined){LS.del(SMTP_KEY);M.smtp.pass='';M.smtp.user='';drawMethod();say('Saved login removed from this device.')}
});
document.addEventListener('input',x=>{
 const t=x.target;if(!t.id||!$('ml')||!$('ml').contains(t))return;
 if(t.id==='mlsub'){M.tpl.subject=t.value;saveTpl();later(drawPreview)}
 else if(t.id==='mlbody'){M.tpl.body=t.value;saveTpl();later(drawPreview)}
 else if(t.id==='mlfn'){M.tpl.fromName=t.value;saveTpl();later(drawPreview)}
 else if(t.id==='mlshow'){const p=$('mlpass');if(p)p.type=t.checked?'text':'password'}
});
document.addEventListener('change',x=>{
 const t=x.target;if(!$('ml')||!$('ml').contains(t))return;
 if(t.id==='mlprov'){const p=PROV[t.value]||PROV.custom;readSmtp();M.smtp.prov=t.value;if(p.host)M.smtp.host=p.host;M.smtp.port=p.port;drawMethod()}
 else if(t.dataset&&t.dataset.mlem){
  const e=cur_(),v=t.value.trim();if(!can_(e))return;
  if(!EMAIL.test(v)){if(v)toast('That email address does not look right');return}
  const r=S.regs.find(q=>q.eid===e.id&&q.id===t.dataset.mlem);if(r){r.em=v.slice(0,100);sv();drawSummary();drawMethod()}
 }
});
document.addEventListener('keydown',x=>{const hg=$('hg');if(x.key==='Escape'&&$('ml')&&!(hg&&!hg.classList.contains('hid')))close()});
window.openMailer=open;
})();
