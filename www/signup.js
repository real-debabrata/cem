/* CEM 3.5.0: public self-registration, organizer side (the public page is register.html).
   Same idea as payment links (pay.html): a public form  ->  "pending"  ->  an organizer approves it.
   - The organizer switches online registration on in Attendees. That writes a small public document regpages/{event code} with the
     event name, date, seats taken, the form questions and (optionally) the ticket price and UPI details.
   - A person opens register.html?e=CODE, fills the form and sends it. It lands in regpages/{code}/subs/{COLLEGE ID} as "pending".
     The document id is the College ID, so the same College ID cannot apply twice (enforced by firestore.rules).
   - If the seats shown on the page are all taken the application is stored as "waitlist" instead.
   - Owner, manager and treasurer see the applications here and tap Approve. Approving re-checks the seats and the College ID against the
     attendees already registered, then adds the person to the attendee list (a QR ticket is created for them). Reject keeps them out.
   - A waitlisted person is promoted with Approve (or "Promote next") once a seat is free.
   - Fee: if a ticket price is set, the public page shows the UPI QR (optional payment). A UTR typed by the applicant is shown here; "Approve and mark paid"
     records the fee as paid after you have checked your UPI app.
   Free-plan cost: one read per application per organizer device, one write per application, a handful of writes when seats change. */
(function(){
const RSUBS=window.RSUBS=window.RSUBS||{},rsUn={},RPSENT={};
const fb=()=>!!(window.firebase&&firebase.apps&&firebase.apps.length&&window.MYUID);
const pcol=eid=>firebase.firestore().collection('regpages').doc(eid);
const bad=x=>toast(x&&x.code==='permission-denied'?'No permission for that.':'Problem: '+((x&&x.message)||x));
const upiOk=u=>/^[\w.\-]{2,}@[\w]{2,}$/.test(u||'');
const subsOf=e=>RSUBS[e.id]||[];
const regUntil=e=>{const t=new Date((e.date||'')+'T23:59:59.999').getTime();return isNaN(t)?Date.now()+864e5:t};   // closes at the end of the event day
const link=e=>{const b=window.siteBase?siteBase():'';return b?b+'register.html?e='+e.id:''};
const when=t=>new Date(t).toLocaleString([],{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'});
window.regPendingN=e=>(e.cloud&&window.can&&can(e,'pay'))?subsOf(e).filter(x=>x.s==='pending').length:0;

/* ---------- the public page document ---------- */
function pubDoc(e){
 const p=e.pay||{};
 return{eid:e.id,name:e.name||'',type:e.type||'',date:e.date||'',time:e.time||'',venue:e.venue||'',desc:(e.desc||'').slice(0,600),
  cap:+e.cap||0,taken:regsOf(e.id).length,fee:Math.max(0,+p.fee||0),upi:p.upi||'',payee:p.payee||'',
  fields:(e.fields||[]).map(f=>({id:f.id,label:f.label,type:f.type,req:!!f.req,opts:f.opts||''})),
  wl:p.wl===0?0:1,msg:(p.regmsg||'').slice(0,300),open:!!p.reg,until:regUntil(e),at:Date.now()};
}
const sig=d=>{const c=Object.assign({},d);delete c.at;return JSON.stringify(c)};
// keeps the public page in step (seats taken, questions, price). Called after every sync of an event whose page is on.
function pubSync(e){
 if(!fb()||!e.cloud||!window.can||!can(e,'pay')||!(e.pay&&e.pay.reg))return;
 const d=pubDoc(e),g=sig(d);
 if(RPSENT[e.id]===g)return;RPSENT[e.id]=g;
 pcol(e.id).set(d).catch(x=>{delete RPSENT[e.id]});
}
window.regPubSync=pubSync;

/* ---------- live list of applications (owner, manager, treasurer, only for events with the page on) ---------- */
function regWatch(){
 if(!fb()||!window.can)return;
 const want={};S.events.filter(e=>e.cloud&&can(e,'pay')&&e.pay&&e.pay.reg).forEach(e=>want[e.id]=e);
 Object.keys(rsUn).forEach(id=>{if(!want[id]){rsUn[id]();delete rsUn[id];delete RSUBS[id]}});
 Object.keys(want).forEach(id=>{
  if(rsUn[id])return;let first=true;
  rsUn[id]=pcol(id).collection('subs').onSnapshot(sn=>{
   const msgs=[];
   if(!first)sn.docChanges().forEach(c=>{if(c.type==='added'&&!c.doc.metadata.hasPendingWrites){const d=c.doc.data();msgs.push({cat:'people',n:want[id].name,text:'New online registration: '+d.n+(d.s==='waitlist'?' (waitlist)':'')})}});
   first=false;
   RSUBS[id]=sn.docs.map(d=>Object.assign({id:d.id},d.data())).sort((a,b)=>(a.at||0)-(b.at||0));
   render();if(msgs.length&&window.notify)notify(msgs);
  },()=>{});
 });
 Object.values(want).forEach(pubSync);
}
window.regWatch=regWatch;
window.regDrop=()=>{Object.keys(rsUn).forEach(i=>{rsUn[i]();delete rsUn[i];delete RSUBS[i]})};

/* ---------- the panel at the top of Attendees ---------- */
window.signupV=function(e){
 if(!window.can||!can(e,'pay'))return '';
 const p=e.pay||{},on=!!p.reg,url=link(e);
 if(!e.cloud)return `<div class="card"><h3 style="margin-bottom:6px">Online registration</h3><p class="meta" style="margin:0">Let people register themselves with a public link. Share the event with your team first (Details tab, Share with team), then come back here.</p></div>`;
 if(!on)return `<div class="card"><div class="sh"><h3>Online registration</h3><button class="btn sm" data-sg="on">Open online registration</button></div>
  <p class="meta" style="margin:0">Give people a link where they register themselves with your registration form. You approve each application, duplicate College IDs are caught, and when the seats are full people join a waitlist. A ticket price and UPI payment are optional.</p></div>`;
 const subs=subsOf(e),pend=subs.filter(x=>x.s==='pending'),wl=subs.filter(x=>x.s==='waitlist'),done=subs.filter(x=>x.s==='approved'||x.s==='rejected');
 const taken=regsOf(e.id).length,left=Math.max(0,e.cap-taken),fee=Math.max(0,+p.fee||0),regs=regsOf(e.id);
 const row=x=>{
  const ex=regs.find(r=>regCid(e,r)===x.cid),dupU=x.utr&&subs.some(y=>y.id!==x.id&&y.utr===x.utr);
  const handled=x.s==='approved'||x.s==='rejected',mine=regs.find(r=>r.id===x.ri);
  const info=[`College ID ${esc(x.cid)}`,x.ph?`<a href="tel:${esc(x.ph)}">${esc(x.ph)}</a>`:'',x.em?`<a href="mailto:${esc(x.em)}">${esc(x.em)}</a>`:'',when(x.at)].filter(Boolean).join(', ');
  const tags=(x.s==='waitlist'?'<span class="pill warn">Waitlist</span> ':'')+(x.s==='approved'?'<span class="pill ok">Approved</span> ':'')+(x.s==='rejected'?'<span class="pill bad">Rejected</span> ':'')
   +(ex&&!handled?'<span class="pill bad">Already registered</span> ':'')+(x.utr?`<span class="pill ${dupU?'bad':'acc'}">UTR ${esc(x.utr)}${dupU?' (also on another application)':''}</span> `:'');
  const noSeat=!ex&&left<=0;
  const acts=handled?`${x.s==='approved'&&mine?`<button class="btn ghost sm" data-tk="${esc(mine.id)}">Ticket (QR)</button>`:''}<button class="btn ghost sm del" data-sg="del" data-id="${esc(x.id)}">Remove</button>`
   :`<button class="btn sm" data-sg="ap" data-id="${esc(x.id)}" ${noSeat?'disabled title="All seats are taken"':''}>${x.s==='waitlist'?'Promote':'Approve'}</button>${fee>0&&x.utr?`<button class="btn ghost sm" data-sg="apd" data-id="${esc(x.id)}" ${noSeat?'disabled':''}>Approve and mark paid</button>`:''}<button class="btn ghost sm del" data-sg="rj" data-id="${esc(x.id)}">Reject</button>`;
  return `<div class="li"><div class="main"><div class="ttl">${esc(x.n)}</div><div class="sub">${tags}${info}</div></div><div class="act">${acts}</div></div>`;
 };
 const cfg=V.sgs?`<form id="sgf" class="fp"><div class="rg"><div><label>Ticket price in ₹ (0 = free)</label><input name="fee" type="number" min="0" step="1" inputmode="numeric" value="${fee||0}"></div>
   <div><label>UPI ID for the fee (optional)</label><input name="u" value="${esc(p.upi||'')}" placeholder="name@bank"></div>
   <div><label>Payee name</label><input name="p" maxlength="60" value="${esc(p.payee||'')}"></div>
   <div><label>When seats are full</label><label style="margin:0;font-weight:400"><input type="checkbox" name="wl" ${p.wl===0?'':'checked'}> Offer a waitlist</label></div>
   <div class="rw"><label>Message shown on the page (optional)</label><input name="m" maxlength="300" value="${esc(p.regmsg||'')}" placeholder="Bring your college ID card to the venue"></div></div>
   <p class="meta" style="margin:8px 0 0">The questions on the page are your registration form (Edit event). The page closes at the end of the event day.</p>
   <div class="acts"><button class="btn" type="submit">Save</button><button type="button" class="btn ghost" data-sg="cfg">Cancel</button></div></form>`:'';
 const handledBox=done.length?`<div style="margin-top:10px"><button class="link" data-sg="hid" aria-expanded="${!!V.sgh}">${V.sgh?'Hide':'Show'} handled (${done.length})</button></div>${V.sgh?done.map(row).join(''):''}`:'';
 return `<div class="card"><div class="sh"><h3>Online registration <span class="pill ok">Open</span></h3><div class="row"><button class="btn ghost sm" data-sg="cfg">${V.sgs?'Close settings':'Price and settings'}</button><button class="btn ghost sm del" data-sg="off">Close registration</button></div></div>
  ${url?`<input readonly value="${esc(url)}" onclick="this.select()" aria-label="Registration link"><div class="row" style="margin-top:8px"><button class="btn sm" data-sg="cp">Copy link</button><button class="btn ghost sm" data-sg="sh">Share</button><button class="btn ghost sm" data-sg="qr">Save QR image</button></div><div id="sgqr" style="margin-top:8px">${qrSvg(url)}</div>`
   :'<div class="note" style="margin:0 0 8px">Set your public site address first (Payments tab, Link settings), then the registration link appears here.</div>'}
  ${cfg}
  <p class="meta" style="margin:10px 0 0">${taken} of ${e.cap} seats taken${left?`, ${left} left`:', full'}${fee?`, ticket ₹${fee}`:', free'}. ${pend.length} waiting for approval${wl.length?`, ${wl.length} on the waitlist`:''}.</p></div>
  <div class="card"><div class="sh"><h3>Applications to review (${pend.length})</h3></div>${pend.length?pend.map(row).join(''):'<p class="meta" style="margin:0">Nothing waiting. New applications appear here by themselves.</p>'}</div>
  ${wl.length?`<div class="card"><div class="sh"><h3>Waitlist (${wl.length})</h3>${left>0?'<button class="btn sm" data-sg="pn">Promote next</button>':'<span class="meta">Promote people when a seat frees up</span>'}</div>${wl.map(row).join('')}</div>`:''}
  ${handledBox?`<div class="card" style="padding-top:8px">${handledBox}</div>`:''}`;
};

/* ---------- actions ---------- */
function setSub(eid,id,patch,msg){
 return pcol(eid).collection('subs').doc(id).update(patch).then(()=>{if(msg)toast(msg)}).catch(bad);
}
// Approve: re-check College ID and seats, then add the person as an attendee.
function approve(E,sub,paid,quiet){
 if(!can(E,'pay'))return false;
 if(sub.s==='approved'){if(!quiet)toast('Already approved');return false}
 const regs=regsOf(E.id),ex=regs.find(r=>regCid(E,r)===sub.cid);
 if(ex){setSub(E.id,sub.id,{s:'approved',ri:ex.id});if(!quiet)toast('This College ID is already registered. Linked to the existing attendee.');return false}
 if(regs.length>=E.cap){if(sub.s!=='waitlist')setSub(E.id,sub.id,{s:'waitlist'});if(!quiet)toast('All '+E.cap+' seats are taken, so this person is on the waitlist');return false}
 let vals={};try{vals=JSON.parse(sub.x||'{}')}catch(x){}
 const data={};(E.fields||[]).forEach(f=>{const v=vals[f.id];data[f.id]=f.type==='checkbox'?(v==='Yes'?'Yes':'No'):String(v==null?'':v).slice(0,200)});
 const first=(E.fields||[])[0],r={id:rid(),eid:E.id,data,name:String(sub.n||(first&&data[first.id])||'Guest').slice(0,80),cid:sub.cid,in:false,at:Date.now(),src:'form',by:window.MYUID};
 if(sub.em)r.em=sub.em;if(sub.ph)r.ph=sub.ph;if(sub.utr)r.utr=sub.utr;
 if(paid&&(+(E.pay||{}).fee||0)>0){r.paid=true;r.pt=Date.now()}
 S.regs.push(r);sv();setSub(E.id,sub.id,{s:'approved',ri:r.id});
 if(!quiet)toast('Approved. Open Ticket (QR) to send their ticket');
 return true;
}
function promote(E){
 const wl=subsOf(E).filter(x=>x.s==='waitlist');let n=0;
 for(const x of wl){if(regsOf(E.id).length>=E.cap)break;if(approve(E,x,false,true))n++}
 toast(n?n+' promoted from the waitlist':'No free seat to promote into');
}
async function setOpen(E,on){
 const p=E.pay=Object.assign({upi:'',payee:'',fee:0},E.pay||{}),was=p.reg;p.reg=on?1:0;
 const d=pubDoc(E);d.open=!!on;
 try{await pcol(E.id).set(d);RPSENT[E.id]=sig(d)}catch(x){p.reg=was;return bad(x)}
 sv();regWatch();toast(on?'Online registration is open':'Online registration is closed');
}
document.addEventListener('click',x=>{
 const t=x.target.closest('button[data-sg]');if(!t)return;
 const E=cur();if(!E||V.tab!=='detail'||!can(E,'pay'))return;
 const a=t.dataset.sg,id=t.dataset.id,sub=subsOf(E).find(z=>z.id===id),url=link(E);
 if(a==='on')setOpen(E,true);
 else if(a==='off'){if(confirm('Close online registration? The link stops working at once. Applications already received stay here.'))setOpen(E,false)}
 else if(a==='cfg'){V.sgs=!V.sgs;render()}
 else if(a==='hid'){V.sgh=!V.sgh;render()}
 else if(a==='cp'){try{navigator.clipboard.writeText(url);toast('Link copied')}catch(q){toast(url)}}
 else if(a==='sh'){if(navigator.share)navigator.share({title:E.name+': register',url}).catch(()=>{});else{try{navigator.clipboard.writeText(url);toast('Link copied')}catch(q){}}}
 else if(a==='qr'){const el=document.querySelector('#sgqr svg');if(el&&window.savePng)savePng(el,'registration-qr.png')}
 else if(a==='ap'&&sub)approve(E,sub,false);
 else if(a==='apd'&&sub)approve(E,sub,true);
 else if(a==='rj'&&sub)setSub(E.id,id,{s:'rejected'},'Rejected');
 else if(a==='del'&&sub){pcol(E.id).collection('subs').doc(id).delete().then(()=>toast('Removed. The same College ID can apply again.')).catch(bad)}
 else if(a==='pn')promote(E);
});
document.addEventListener('submit',x=>{
 const f=x.target;if(f.id!=='sgf')return;x.preventDefault();
 const E=cur();if(!E||!can(E,'pay'))return;
 const fd=new FormData(f),g=k=>(fd.get(k)||'').toString().trim(),u=g('u');
 if(u&&!upiOk(u))return toast('That UPI ID does not look right');
 E.pay=Object.assign({upi:'',payee:'',fee:0},E.pay||{},{fee:Math.max(0,Math.round(+g('fee')||0)),upi:u,payee:g('p').slice(0,60),wl:fd.get('wl')?1:0,regmsg:g('m').slice(0,300)});
 V.sgs=false;sv();pubSync(E);toast('Saved');
});
})();
