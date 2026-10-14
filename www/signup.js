/* Online registration, organizer side (the public page is register.html). Shown in Attendees > Registration, together with the cash collectors.
   - Open online registration writes a small public document regpages/{event code}: event name, date, seats taken, the form questions and, if set, the ticket price and UPI details.
   - A person opens the link, fills the form and sends it. It lands in regpages/{code}/subs/{COLLEGE ID} as "pending", so the same College ID cannot apply twice (enforced by firestore.rules).
   - When the seats are full the application is stored as "waitlist". Approve (or Promote) re-checks the seats and the College ID, then adds the person as an attendee with a QR ticket.
   - Customize page and link: link name (regslugs/{name}), headline, welcome text, colours, banner, closing time. Price and settings: ticket price, UPI ID, payee, waitlist, message.
   - Cash or UPI: the applicant's choice, and the cash collector they picked (payment.js), is shown on each application and carried into the attendee. */
(function(){
const RSUBS=window.RSUBS=window.RSUBS||{},rsUn={},RPSENT={};
const fb=()=>!!(window.firebase&&firebase.apps&&firebase.apps.length&&window.MYUID);
const pcol=eid=>firebase.firestore().collection('regpages').doc(eid);
const bad=x=>toast(x&&x.code==='permission-denied'?'No permission for that.':'Problem: '+((x&&x.message)||x));
const upiOk=u=>/^[\w.\-]{2,}@[\w]{2,}$/.test(u||'');
const subsOf=e=>RSUBS[e.id]||[];
const rp=e=>(e.pay&&e.pay.rp)||{};
const slugOf=e=>rp(e).slug||'';
const SLUG_RE=/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const regUntil=e=>{const c=+rp(e).cl;if(c>0)return c;const t=new Date((e.date||'')+'T23:59:59.999').getTime();return isNaN(t)?Date.now()+864e5:t};   // closes at the time you set, or at the end of the event day
const base=()=>window.siteBase?siteBase():'';
const link=e=>{const b=base();if(!b)return '';const s=slugOf(e);return s?b+'r/'+s:b+'register.html?e='+e.id};
const plainLink=e=>{const b=base(),s=slugOf(e);return b&&s?b+'register.html?r='+s:''};   // always works, even without 404.html
const BGS={indigo:'Midnight',sunset:'Sunset',ocean:'Ocean',forest:'Forest',graphite:'Graphite',light:'Light'};
const theme=e=>{const r=rp(e);return{ac:/^#[0-9a-f]{6}$/i.test(r.ac||'')?r.ac:'#5948f5',bg:BGS[r.bg]?r.bg:'indigo',hd:String(r.hd||'').slice(0,80),in:String(r.in||'').slice(0,400),bt:String(r.bt||'').slice(0,30),ty:String(r.ty||'').slice(0,200),bn:/^https:\/\/[^\s"'<>]{4,290}$/i.test(r.bn||'')?r.bn:'',ss:r.ss===0?0:1}};
const dtl=t=>{if(!t)return '';const d=new Date(t),p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes())};
const when=t=>new Date(t).toLocaleString([],{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'});
window.regPendingN=e=>(e.cloud&&window.can&&can(e,'pay'))?subsOf(e).filter(x=>x.s==='pending').length:0;

/* ---------- the public page document ---------- */
function pubDoc(e){
 const p=e.pay||{};
 return{eid:e.id,name:e.name||'',type:e.type||'',date:e.date||'',time:e.time||'',venue:e.venue||'',desc:(e.desc||'').slice(0,600),
  cap:+e.cap||0,taken:regsOf(e.id).length,fee:Math.max(0,+p.fee||0),upi:p.upi||'',payee:p.payee||'',
  fields:(e.fields||[]).map(f=>({id:f.id,label:f.label,type:f.type,req:!!f.req,opts:f.opts||''})),
  wl:p.wl===0?0:1,msg:(p.regmsg||'').slice(0,300),open:!!p.reg,until:regUntil(e),at:Date.now(),
  th:theme(e),slug:slugOf(e),
  cash:(+p.fee>0?(window.cashiersOf?cashiersOf(e):[]):[]).map(c=>({id:c.id,n:c.n})),   // names only; the rules check the ids in cids
  cids:(+p.fee>0?(window.cashiersOf?cashiersOf(e):[]):[]).map(c=>c.id)};
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
 const p=e.pay||{},on=!!p.reg,url=link(e),fee=Math.max(0,+p.fee||0);
 const cfg=V.sgs?`<form id="sgf" class="fp"><div class="rg"><div><label>Ticket price in ₹ (0 = free)</label><input name="fee" type="number" min="0" step="1" inputmode="numeric" value="${fee||0}"></div>
   <div><label>UPI ID for the fee (optional)</label><input name="u" value="${esc(p.upi||'')}" placeholder="name@bank"></div>
   <div><label>Payee name</label><input name="p" maxlength="60" value="${esc(p.payee||'')}"></div>
   <div><label>When seats are full</label><label style="margin:0;font-weight:400"><input type="checkbox" name="wl" ${p.wl===0?'':'checked'}> Offer a waitlist</label></div>
   <div class="rw"><label>Message shown on the page (optional)</label><input name="m" maxlength="300" value="${esc(p.regmsg||'')}" placeholder="Bring your college ID card to the venue"></div></div>
   <div class="acts"><button class="btn" type="submit">Save</button><button type="button" class="btn ghost" data-sg="cfg">Cancel</button></div></form>`:'';
 const cfgBtn=`<button class="btn ghost sm" data-sg="cfg">${V.sgs?'Close settings':'Price and settings'}</button>`;
 if(!e.cloud)return `<div class="card"><div class="sh"><h3>Online registration</h3>${cfgBtn}</div><p class="meta" style="margin:0">Share the event first (Details tab) to open online registration.</p>${cfg}</div>`;
 const sl=slugOf(e),pl=plainLink(e);
 if(!on)return `<div class="card"><div class="sh"><h3>Online registration</h3><div class="row"><button class="btn ghost sm" data-sg="cust" aria-expanded="${!!V.sgc}">${V.sgc?'Close':'Customize page and link'}</button>${cfgBtn}<button class="btn sm" data-sg="on">Open online registration</button></div></div>
  ${sl&&url?`<p class="meta" style="margin:8px 0 0;overflow-wrap:anywhere">Your link: <b>${esc(url)}</b></p>`:''}${custV(e)}${cfg}</div>`;
 const subs=subsOf(e),pend=subs.filter(x=>x.s==='pending'),wl=subs.filter(x=>x.s==='waitlist'),done=subs.filter(x=>x.s==='approved'||x.s==='rejected');
 const taken=regsOf(e.id).length,left=Math.max(0,e.cap-taken),regs=regsOf(e.id);
 const row=x=>{
  const ex=regs.find(r=>regCid(e,r)===x.cid),dupU=x.utr&&subs.some(y=>y.id!==x.id&&y.utr===x.utr);
  const handled=x.s==='approved'||x.s==='rejected',mine=regs.find(r=>r.id===x.ri);
  const info=[`College ID ${esc(x.cid)}`,x.ph?`<a href="tel:${esc(x.ph)}">${esc(x.ph)}</a>`:'',x.em?`<a href="mailto:${esc(x.em)}">${esc(x.em)}</a>`:'',when(x.at)].filter(Boolean).join(', ');
  const tags=(x.s==='waitlist'?'<span class="pill warn">Waitlist</span> ':'')+(x.s==='approved'?'<span class="pill ok">Approved</span> ':'')+(x.s==='rejected'?'<span class="pill bad">Rejected</span> ':'')
   +(ex&&!handled?'<span class="pill bad">Already registered</span> ':'')+(x.pm==='cash'?`<span class="pill acc">Cash: ${esc((((e.pay||{}).cashiers||[]).find(c=>c.id===x.cc)||{}).n||'collector')}${x.cp?' (says already paid)':' (pays later)'}</span> `:x.pm==='upi'?'<span class="pill acc">UPI</span> ':'')+(x.utr?`<span class="pill ${dupU?'bad':'acc'}">UTR ${esc(x.utr)}${dupU?' (also on another application)':''}</span> `:'');
  const noSeat=!ex&&left<=0;
  const acts=handled?`${x.s==='approved'&&mine?`<button class="btn ghost sm" data-tk="${esc(mine.id)}">Ticket (QR)</button>`:''}<button class="btn ghost sm del" data-sg="del" data-id="${esc(x.id)}">Remove</button>`
   :`<button class="btn sm" data-sg="ap" data-id="${esc(x.id)}" ${noSeat?'disabled title="All seats are taken"':''}>${x.s==='waitlist'?'Promote':'Approve'}</button>${fee>0&&(x.utr||(x.pm==='cash'&&x.cp))?`<button class="btn ghost sm" data-sg="apd" data-id="${esc(x.id)}" ${noSeat?'disabled':''}>Approve and mark paid</button>`:''}<button class="btn ghost sm del" data-sg="rj" data-id="${esc(x.id)}">Reject</button>`;
  return `<div class="li"><div class="main"><div class="ttl">${esc(x.n)}</div><div class="sub">${tags}${info}</div></div><div class="act">${acts}</div></div>`;
 };
 const handledBox=done.length?`<div style="margin-top:10px"><button class="link" data-sg="hid" aria-expanded="${!!V.sgh}">${V.sgh?'Hide':'Show'} handled (${done.length})</button></div>${V.sgh?done.map(row).join(''):''}`:'';
 return `<div class="card"><div class="sh"><h3>Online registration <span class="pill ok">Open</span></h3><div class="row"><button class="btn ghost sm" data-sg="cust" aria-expanded="${!!V.sgc}">${V.sgc?'Close':'Customize page and link'}</button>${cfgBtn}<button class="btn ghost sm del" data-sg="off">Close registration</button></div></div>
  ${url?`<input readonly value="${esc(url)}" onclick="this.select()" aria-label="Registration link"><div class="row" style="margin-top:8px"><button class="btn sm" data-sg="cp">Copy link</button><button class="btn ghost sm" data-sg="sh">Share</button><button class="btn ghost sm" data-sg="qr">Save QR image</button><button class="btn ghost sm" data-sg="pv">Preview page</button></div>${pl?`<p class="meta" style="margin:8px 0 0;overflow-wrap:anywhere">Backup link that always works: ${esc(pl)} <button class="link" data-sg="cpp">Copy</button></p>`:''}<div id="sgqr" style="margin-top:8px">${qrSvg(url)}</div>`
   :(window.siteFormV?siteFormV():'')}
  ${custV(e)}${cfg}
  <p class="meta" style="margin:10px 0 0">${taken} of ${e.cap} seats taken${left?`, ${left} left`:', full'}${fee?`, ticket ₹${fee}`:', free'}. ${pend.length} waiting for approval${wl.length?`, ${wl.length} on the waitlist`:''}.</p></div>
  <div class="card"><div class="sh"><h3>Applications to review (${pend.length})</h3></div>${pend.length?pend.map(row).join(''):'<p class="meta" style="margin:0">Nothing waiting.</p>'}</div>
  ${wl.length?`<div class="card"><div class="sh"><h3>Waitlist (${wl.length})</h3>${left>0?'<button class="btn sm" data-sg="pn">Promote next</button>':'<span class="meta">Promote people when a seat frees up</span>'}</div>${wl.map(row).join('')}</div>`:''}
  ${handledBox?`<div class="card" style="padding-top:8px">${handledBox}</div>`:''}`;
};

/* ---------- customize page and link ---------- */
function custV(e){
 if(!V.sgc)return '';
 const r=rp(e),t=theme(e),b=base(),sl=slugOf(e);
 return `<form id="sgc" class="fp" style="margin-top:12px"><h3 style="margin-bottom:8px;font-size:15px">Customize the registration page</h3><div class="rg">
  <div class="rw"><label for="sg_slug">Link name</label><div class="row" style="flex-wrap:nowrap"><span class="meta" style="white-space:nowrap">${esc(b?b+'r/':'.../r/')}</span><input id="sg_slug" name="slug" maxlength="40" autocapitalize="none" autocomplete="off" spellcheck="false" value="${esc(sl)}" placeholder="techfest-2026" style="flex:1;min-width:0"></div>
   <p class="meta" style="margin:4px 0 0">3 to 40 letters, digits or hyphens, for example <b>techfest-2026</b>.</p></div>
  <div class="rw"><label for="sg_hd">Headline (default: the event name)</label><input id="sg_hd" name="hd" maxlength="80" value="${esc(t.hd)}" placeholder="${esc(e.name||'')}"></div>
  <div class="rw"><label for="sg_in">Welcome text under the headline</label><textarea id="sg_in" name="in" rows="3" maxlength="400" placeholder="Who should come, what to bring, any rules...">${esc(t.in)}</textarea></div>
  <div><label for="sg_ac">Accent colour</label><input id="sg_ac" name="ac" type="color" value="${esc(t.ac)}" style="height:42px;padding:3px"></div>
  <div><label for="sg_bg">Background</label><select id="sg_bg" name="bg">${Object.keys(BGS).map(k=>`<option value="${k}" ${t.bg===k?'selected':''}>${BGS[k]}</option>`).join('')}</select></div>
  <div><label for="sg_bt">Button text</label><input id="sg_bt" name="bt" maxlength="30" value="${esc(t.bt)}" placeholder="Send registration"></div>
  <div><label for="sg_cl">Close registration at (optional)</label><input id="sg_cl" name="cl" type="datetime-local" value="${esc(dtl(+r.cl||0))}"></div>
  <div class="rw"><label for="sg_ty">Thank-you message after sending</label><input id="sg_ty" name="ty" maxlength="200" value="${esc(t.ty)}" placeholder="See you at the event!"></div>
  <div class="rw"><label for="sg_bn">Banner image link (optional, must start with https://)</label><input id="sg_bn" name="bn" maxlength="300" value="${esc(t.bn)}" placeholder="https://..."></div>
  <div class="rw"><label style="margin:0;font-weight:400"><input type="checkbox" name="ss" ${t.ss?'checked':''}> Show how many seats are left</label></div></div>
  <div class="acts"><button class="btn" type="submit">Save</button><button type="button" class="btn ghost" data-sg="cust">Cancel</button></div></form>`;
}
// A link name is claimed in regslugs/{name}. Only a staff member of the event can create, keep or delete it, so a name already used by another event is refused by the rules.
async function claimSlug(E,slug,old){
 if(!fb())throw 'Sign in and go online to change the link name.';
 const db=firebase.firestore(),col=db.collection('regslugs'),b=db.batch();
 if(slug){
  let d;try{d=await col.doc(slug).get({source:'server'})}catch(x){throw 'Could not check that link name. Check your connection.'}
  if(d.exists&&d.data().eid!==E.id)throw 'That link name is already used by another event. Try another.';
  if(!d.exists)b.set(col.doc(slug),{eid:E.id,by:window.MYUID,at:Date.now()});
 }
 if(old&&old!==slug)b.delete(col.doc(old));
 try{await b.commit()}catch(x){throw x&&x.code==='permission-denied'?'Could not claim that link name. Try another one.':'Could not save the link name. Check your connection.'}
}

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
 const first=(E.fields||[])[0],r={id:rid(),eid:E.id,data,name:String((first&&data[first.id])||sub.n||'Guest').slice(0,80),cid:sub.cid,in:false,at:Date.now(),src:'form',by:window.MYUID};
 if(sub.em)r.em=sub.em;if(sub.ph)r.ph=sub.ph;if(sub.utr)r.utr=sub.utr;
 if(sub.pm==='cash'||sub.pm==='upi')r.pm=sub.pm;
 if(sub.pm==='cash'&&sub.cc){const c=((E.pay||{}).cashiers||[]).find(z=>z.id===sub.cc);if(c){r.cc=c.id;r.cn=c.n}}
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
 else if(a==='cust'){V.sgc=!V.sgc;render()}
 else if(a==='pv'){if(url)window.open(url,'_blank','noopener')}
 else if(a==='cpp'){const pl=plainLink(E);try{navigator.clipboard.writeText(pl);toast('Backup link copied')}catch(q){toast(pl)}}
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
document.addEventListener('submit',async x=>{
 const f=x.target;if(f.id!=='sgc')return;x.preventDefault();
 const E=cur();if(!E||!can(E,'pay'))return;
 const fd=new FormData(f),g=k=>(fd.get(k)||'').toString().trim(),slug=g('slug').toLowerCase().replace(/\s+/g,'-'),old=slugOf(E);
 if(slug&&!SLUG_RE.test(slug))return toast('Link name: 3 to 40 letters, digits or hyphens, not starting or ending with a hyphen');
 const bn=g('bn');if(bn&&!/^https:\/\/[^\s"'<>]{4,290}$/i.test(bn))return toast('The banner image link must start with https://');
 const cl=g('cl')?new Date(g('cl')).getTime():0;
 if(g('cl')&&!isFinite(cl))return toast('That closing time is not valid');
 if(cl&&cl<Date.now())return toast('Pick a closing time in the future. To stop registration now, use Close registration.');
 if(slug!==old){try{await claimSlug(E,slug,old)}catch(m){return toast(String(m))}}
 const ac=g('ac');
 E.pay=Object.assign({upi:'',payee:'',fee:0},E.pay||{},{rp:{slug,hd:g('hd').slice(0,80),in:g('in').slice(0,400),bt:g('bt').slice(0,30),ty:g('ty').slice(0,200),ac:/^#[0-9a-f]{6}$/i.test(ac)?ac:'#5948f5',bg:BGS[g('bg')]?g('bg'):'indigo',bn,ss:fd.get('ss')?1:0,cl}});
 V.sgc=false;sv();pubSync(E);toast(slug?'Saved. Your link: /r/'+slug:'Saved');
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
