/* The event page.
   - A slim header (back, name, calculator) and one scrollable tab strip.
   - Details: date, venue, description, event code, your role, export, edit / delete.
   - Attendees: one job per view, switched by the small nav under the tabs.
       List (search + filters + the people), Check-in (scan tickets, check in by name), Add (register one person, import a file),
       Email (ticket or invitation emails), Sign-ups (online registration page and cash collectors).
   - People: the team, roles and the participant team maker (teamsV below).
   Tasks, People and Payments are drawn by app2.js, Expenses and Items to buy by expenses.js, Income by income.js, Chat by chat.js. */
(function(){
const R=n=>window.inr?inr(n):'₹'+n;
const loc=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const chev='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';
const $=id=>document.getElementById(id);
// College ID helpers (3.5.0): used by the duplicate check, the public registration page and the CSV export
window.normId=s=>String(s==null?'':s).toUpperCase().replace(/[^A-Z0-9]/g,'');
window.cidField=e=>(e.fields||[]).find(f=>f.type!=='checkbox'&&/college\s*id|student\s*id|roll\s*(no|number)|enrol|registration\s*(no|number|id)|reg\.?\s*(no|number)/i.test(f.label));
window.cidOf=(e,data)=>{const f=cidField(e);return f?normId((data||{})[f.id]):''};
window.regCid=(e,r)=>r.cid||cidOf(e,r.data);
const hm=t=>new Date(t).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});

// per-event view state; cleared whenever another event is opened
window.resetEv=function(){
 Object.assign(V,{av:'list',rf:'all',rq:'',rmo:null,tf:'all',ta:null,tg:false,pad:false,crd:null,pfl:'all',pnw:false,pst:false,
  xv:'budget',xa:false,xc:null,xq:null,xp:null,xb:null,xw:false,xvp:'',xsp:null,ia:false,te:null,sgs:false,sgc:false,sgh:false,spa:false,spe:null,ibs:'',imp:null});
};

/* ---------- shell ---------- */
const TABS=[['info','Details'],['regs','Attendees'],['tasks','Tasks'],['people','People'],['pay','Payments'],['inc','Income'],['exp','Expenses'],['chat','Chat']];
const tabsFor=e=>TABS.filter(t=>(t[0]!=='exp'&&t[0]!=='inc')||can(e,'exp'));   // Income and Expenses: organizer, manager, treasurer
function badge(e,k){
 const em=(n,hot,t)=>n?`<em${hot?' class="hot"':''}${t?` title="${t}"`:''}>${n}</em>`:'';
 if(k==='regs'){const pn=window.regPendingN?regPendingN(e):0;return em(regsOf(e.id).length)+em(pn,1,'Online registrations waiting for approval')}
 if(k==='tasks')return em(e.tasks.filter(t=>!t.done).length+(e.itm||[]).filter(i=>i.s!=='bought').length,0,'Open tasks and items to buy');
 if(k==='people')return em(window.peopleOf?peopleOf(e).length:0);
 if(k==='pay')return em(window.payPendingN?payPendingN(e):0,1,'Payments waiting to be checked');
 if(k==='exp')return em(window.billsOverdueN?billsOverdueN(e):0,1,'Overdue bills');
 if(k==='chat')return window.chatDot?chatDot(e):'';
 return '';
}
const header=e=>`<div class="eh" style="--tc:${TYPES[e.type]||'#5948f5'}"><button class="btn ghost sm" data-go="events" aria-label="Back to all events">${chev}Events</button><h2 title="${esc(e.name)}">${esc(e.name)}</h2><span class="tg">${esc(e.type)}</span>${window.calcBtnV||''}</div>`;
const tabs=e=>`<div class="tabs" role="tablist" aria-label="Event sections">${tabsFor(e).map(t=>`${t[0]==='tasks'||t[0]==='pay'||t[0]==='chat'?'<span class="tsp"></span>':''}<button class="tab ${V.dt===t[0]?'on':''}" role="tab" aria-selected="${V.dt===t[0]}" data-dt="${t[0]}">${t[1]}${badge(e,t[0])}</button>`).join('')}</div>`;
function centerTab(){const c=document.querySelector('.tabs'),b=c&&c.querySelector('.tab.on');if(c&&b)c.scrollLeft=Math.max(0,b.offsetLeft-(c.clientWidth-b.offsetWidth)/2)}

window.eventPage=function(e){
 if(!tabsFor(e).some(t=>t[0]===V.dt))V.dt='info';
 const body={info:infoV,regs:regsV,tasks:window.tasksV2,people:window.peopleV,pay:window.payV2,inc:window.incV,exp:window.expV,chat:window.chatV}[V.dt];
 setTimeout(centerTab,0);
 return header(e)+tabs(e)+(body?body(e):'');
};

/* ---------- Details tab ---------- */
function infoV(e){
 const rs=regsOf(e.id),n=rs.length,ci=rs.filter(r=>r.in).length,mr=myRole(e),mgr=can(e,'event');
 const open=e.tasks.filter(k=>!k.done).length+(e.itm||[]).filter(i=>i.s!=='bought').length;
 const mb=window.moneyBrief&&can(e,'exp')?moneyBrief(e):null;
 const when=new Date(e.date+'T'+(e.time||'00:00')),okd=!isNaN(when);
 const dateTxt=okd?when.toLocaleDateString([],{weekday:'long',day:'numeric',month:'long',year:'numeric'}):esc(e.date||'');
 const timeTxt=okd&&e.time?when.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'';
 const venue=/^https?:\/\//i.test(e.venue||'')?`<a href="${esc(e.venue)}" target="_blank" rel="noopener noreferrer">${esc(e.venue)}</a>`:(esc(e.venue)||'<span class="meta">Not set</span>');
 const past=e.date&&e.date<loc();
 const share=e.cloud?`<div class="code"><b aria-label="Event code">${esc(e.id)}</b><button class="btn ghost sm" data-copy="${esc(e.id)}">Copy code</button></div>
   <p class="meta" style="margin:8px 0 0">${Object.keys(e.members||{}).length} member(s). ntfy topic: ntfy.sh/${esc(e.ntfy||'')}</p>`
  :(window.shareBar?shareBar(e):'');
 return `<div class="card" style="border-left:6px solid ${TYPES[e.type]||'#5948f5'}">
  <div class="sh" style="margin-bottom:0"><div class="row"><span class="tag" style="color:${TYPES[e.type]}">${esc(e.type)}</span>${past?'<span class="pill">Past event</span>':''}</div>${mgr?`<button class="btn ghost sm" data-edit="${e.id}">Edit event</button>`:''}</div>
  <h2 style="margin-top:6px">${esc(e.name)}</h2>
  <dl class="kv"><dt>Date</dt><dd>${dateTxt}</dd>${timeTxt?`<dt>Time</dt><dd>${timeTxt}</dd>`:''}<dt>Venue</dt><dd>${venue}</dd><dt>Seats</dt><dd>${e.cap} (${n} registered)</dd></dl>
  ${e.desc?`<p class="about-d">${esc(e.desc)}</p>`:'<p class="meta" style="margin:12px 0 0">No description yet.</p>'}</div>
 <div class="glance">
  <button class="gl" data-dt="regs"><b>${n}<small>/${e.cap}</small></b><span>Registered</span></button>
  <button class="gl" data-dt="regs"><b>${ci}</b><span>Checked in</span></button>
  <button class="gl" data-dt="tasks"><b>${open}</b><span>Tasks and items open</span></button>
  <button class="gl" data-dt="people"><b>${window.peopleOf?peopleOf(e).length:0}</b><span>People</span></button>
  ${mb?`<button class="gl ${mb.over?'warn':''}" data-dt="exp"><b>${mb.plan?R(Math.abs(mb.left)):'-'}</b><span>${mb.plan?(mb.over?'Over budget':'Budget left'):'No budget set'}</span></button>`:''}</div>
 ${share?`<div class="card"><h3 style="margin-bottom:10px">Invite your team</h3>${share}</div>`:''}
 <div class="card"><div class="sh" style="margin:0"><div style="flex:1 1 220px"><h3 style="margin-bottom:2px">Your role: ${esc(window.roleLabel?roleLabel(e,mr):mr)}</h3><p class="meta" style="margin:0">Need help or a guide? Tap your profile icon (the circle with your initial, top right), then <b>Help &amp; guides</b>.</p></div><button class="btn ghost sm" data-u="help">Open Help &amp; guides</button></div></div>
 ${window.exportV?exportV(e):''}
 ${mgr||e.cloud?`<div class="row" style="justify-content:center;margin-top:6px"><button class="btn ghost sm del" data-del="${e.id}">${mr==='owner'?'Delete event':'Leave event'}</button></div>`:''}`;
}

/* ---------- Attendees tab ---------- */
const regField=f=>`<div class="${f.type==='checkbox'?'rw':''}">${fieldInput(f)}</div>`;
const ICO={
 list:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
 in:'<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10"/>',
 add:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
 mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
 reg:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'
};
const ico=k=>`<svg viewBox="0 0 24 24" aria-hidden="true">${ICO[k]}</svg>`;
const noOne=e=>`<div class="empty">No attendees yet.${can(e,'addreg')?'<div style="margin-top:14px"><button class="btn" data-av="add">Add the first attendee</button></div>':''}</div>`;
const searchBox=()=>`<input id="rq" type="search" class="avq" placeholder="Search by name, ID or email" value="${esc(V.rq||'')}" aria-label="Search attendees">`;

// mode 'in' = the check-in view: ignores the List filters, shows people still to arrive first, no "..." menu
function regRows(e,mode){
 const gate=mode==='in',rs=regsOf(e.id),fee=!!(e.pay&&e.pay.fee),q=(V.rq||'').trim().toLowerCase(),f=gate?'all':(V.rf||'all'),canReg=can(e,'regs'),canRm=can(e,'event');
 if(!rs.length)return noOne(e);
 let list=rs.filter(r=>{
  if(f==='in'&&!r.in)return false;if(f==='out'&&r.in)return false;if(f==='unpaid'&&r.paid)return false;if(f==='cash'&&!(r.pm==='cash'&&!r.paid))return false;
  return !q||(r.name+' '+Object.values(r.data||{}).join(' ')).toLowerCase().includes(q);
 });
 if(!list.length)return `<div class="empty">${gate?'No one matches. Check the spelling or try the ID.':'No one matches. Clear the search or pick another filter.'}</div>`;
 if(gate)list=list.slice().sort((a,b)=>(a.in?1:0)-(b.in?1:0));
 return list.map(r=>{
  const sub=e.fields.slice(1,4).map(x=>{const v=r.data&&r.data[x.id];return x.type==='checkbox'?(v==='Yes'?x.label:''):(v||'')}).filter(Boolean).join(', ');
  const tk=can(e,'addreg'),sec=!gate&&((fee&&canReg)||canRm||tk),more=V.rmo===r.id&&sec;
  const tags=(r.in?`<span class="pill ok">Checked in${r.inAt?' '+hm(r.inAt):''}</span> `:'')+(r.ml?`<span class="pill" title="${r.mlk==='i'?'Invitation':'Ticket'} emailed">Emailed</span> `:'')+(r.src==='form'?'<span class="pill acc">Online</span> ':r.src==='import'?'<span class="pill acc">Imported</span> ':'')+(fee?(r.paid?'<span class="pill ok">Paid</span> ':'<span class="pill warn">Unpaid</span> ')+(window.payTagV?payTagV(r):''):'');
  return `<div class="li"><div class="main"><div class="ttl">${esc(r.name)}</div>${tags||sub?`<div class="sub">${tags}${esc(sub)}</div>`:''}</div>
   <div class="act">${canReg?`<button class="btn sm${r.in?' ghost':''}" data-ci="${r.id}">${r.in?'Undo':'Check in'}</button>`:''}${sec?`<button class="btn ghost sm" data-rmo="${r.id}" aria-expanded="${more}" aria-label="More actions for ${esc(r.name)}" title="More">&hellip;</button>`:''}</div>
   ${more?`<div class="more">${tk?`<button class="btn ghost sm" data-tk="${r.id}">Ticket (QR)</button>`:''}${fee&&canReg?`<button class="btn ghost sm" data-paid="${r.id}">${r.paid?'Mark unpaid':'Mark paid'}</button>`:''}${fee&&canReg&&window.payEditV?payEditV(e,r):''}${canRm?`<button class="btn ghost sm del" data-rm="${r.id}">Remove registration</button>`:''}</div>`:''}</div>`;
 }).join('');
}

/* view 1: List. Only finding people: search, filters, the rows. */
function listPanel(e){
 const rs=regsOf(e.id),n=rs.length,ci=rs.filter(r=>r.in).length,full=n>=e.cap,fee=!!(e.pay&&e.pay.fee),f=V.rf||'all';
 const pc=Math.min(100,Math.round(n/Math.max(1,e.cap)*100)),cd=rs.filter(r=>r.pm==='cash'&&!r.paid).length;
 const chips=[['all','All',n],['out','Not checked in',n-ci],['in','Checked in',ci]].concat(fee?[['unpaid','Unpaid',rs.filter(r=>!r.paid).length]]:[]).concat(cd?[['cash','Cash due',cd]]:[]);
 return `<div class="card">
  <div class="sh"><h3>${n} of ${e.cap} seats filled</h3>${full?'<span class="pill warn">Event is full</span>':`<span class="meta">${ci} checked in</span>`}</div>
  <div class="prog" role="progressbar" aria-label="Seats filled" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pc}"><i style="width:${pc}%;background:var(--acc)"></i></div>
  ${n?`<div style="margin-top:14px">${searchBox()}</div>
  <div class="chips" style="margin:12px 0 0">${chips.map(c=>`<button class="chip ${f===c[0]?'on':''}" data-rf="${c[0]}">${c[1]} (${c[2]})</button>`).join('')}</div>`:''}
  <div id="rlist" style="margin-top:6px">${regRows(e)}</div></div>`;
}

/* view 2: Check-in. Scan a ticket, or find the person by name. */
function checkinPanel(e){
 const rs=regsOf(e.id),n=rs.length,ci=rs.filter(r=>r.in).length,pc=n?Math.round(ci/n*100):0;
 return `<div class="card"><div class="avh"><span class="ic">${ico('in')}</span><div class="tx"><h3>Scan tickets</h3><p class="meta">Point the camera at an attendee's QR ticket to check them in.</p></div><button class="btn" data-scan="1">Open scanner</button></div>
  <div class="prog" style="margin-top:16px" role="progressbar" aria-label="Checked in" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pc}"><i style="width:${pc}%;background:var(--acc)"></i></div>
  <p class="meta" style="margin:8px 0 0">${ci} of ${n} checked in</p></div>
 <div class="card"><div class="sh" style="margin-bottom:2px"><h3>Check in by name</h3></div>
  <p class="meta" style="margin:0 0 12px">No ticket? Search for the person and tap Check in.</p>
  ${n?searchBox():''}
  <div id="rlist" style="margin-top:6px">${regRows(e,'in')}</div></div>`;
}

/* view 3: Add. Register one person, or import a whole file. */
function addPanel(e){
 const n=regsOf(e.id).length,left=e.cap-n,w=can(e,'addreg');
 const form=!w?'':left<=0
  ?`<div class="card"><div class="sh" style="margin-bottom:4px"><h3>Event is full</h3><span class="pill warn">${n} of ${e.cap}</span></div><p class="meta" style="margin:0">All seats are taken.</p></div>`
  :`<div class="card"><div class="sh"><h3>Register an attendee</h3><span class="meta">${left} seat${left===1?'':'s'} left</span></div>
   <form id="reg" class="fp" data-eid="${e.id}" style="margin:0"><div class="rg">${e.fields.map(regField).join('')}${window.payBlockV?payBlockV(e):''}</div><div class="acts"><button class="btn" type="submit">Register</button></div></form></div>`;
 return form+(window.importV?importV(e):'')||'<div class="empty">You do not have permission to add attendees.</div>';
}

/* view 4: Email. See who has been emailed, then write and send. */
function mailPanel(e){
 const rs=regsOf(e.id),n=rs.length,sent=rs.filter(r=>r.ml).length;
 if(!n)return noOne(e);
 return `<div class="card"><div class="avh"><span class="ic">${ico('mail')}</span><div class="tx"><h3>Email attendees</h3><p class="meta">Send each person their QR ticket, or a plain invitation. Three quick steps: see who has been emailed, write the message, send.</p></div></div>
  <div class="avs"><div><b>${n}</b><span>Attendees</span></div><div><b>${sent}</b><span>Emailed</span></div><div><b>${n-sent}</b><span>Not emailed</span></div></div>
  <div class="acts" style="margin-top:16px"><button class="btn" data-mail="1">Write and send email</button></div></div>`;
}

/* ---------- participant teams (drawn inside the People tab) ---------- */
function teamsPanel(e){
 const w=can(e,'regs'),rs=regsOf(e.id),free=rs.filter(r=>!e.teams.some(t=>t.id===r.team));
 const head=`<div class="card"><div class="sh"><h3>Participant teams</h3><span class="meta">${e.teams.length} team${e.teams.length===1?'':'s'}, ${free.length} attendee${free.length===1?'':'s'} not in a team</span></div>
  ${!rs.length?'<p class="meta" style="margin:8px 0 0">Register attendees first.</p>':w?`<form id="tnf" class="row" style="margin-top:12px"><input name="n" required maxlength="40" placeholder="Team name" style="flex:1;min-width:160px" aria-label="Team name"><button class="btn" type="submit">Create team</button></form>
  <form id="atf" class="row" style="margin-top:10px"><label style="margin:0">Or auto-build teams of</label><input name="s" type="number" min="2" value="4" style="width:80px" aria-label="Team size"><button class="btn ghost" type="submit">Split unassigned attendees</button></form>`:''}</div>`;
 const cards=e.teams.length?`<div class="grid">${e.teams.map(t=>{const ms=rs.filter(r=>r.team===t.id);
  return `<div class="card"><div class="sh"><h3>${esc(t.n)} <span class="pill">${ms.length}</span></h3>${w?`<button class="btn ghost sm del" data-tdel="${t.id}">Delete</button>`:''}</div>
   ${ms.length?ms.map(r=>`<div class="li" style="padding:6px 0"><div class="main">${esc(r.name)}</div>${w?`<button class="btn ghost sm" data-tmrm="${r.id}" aria-label="Remove ${esc(r.name)} from ${esc(t.n)}">Remove</button>`:''}</div>`).join(''):'<p class="meta">No members yet.</p>'}
   ${w&&free.length?`<select data-tmadd="${t.id}" style="margin-top:8px" aria-label="Add attendee to ${esc(t.n)}"><option value="">Add attendee</option>${free.map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join('')}</select>`:''}</div>`}).join('')}</div>`
  :(rs.length?'<div class="empty">No teams yet. Create one above or auto-build them.</div>':'');
 return head+cards;
}
window.teamsV=function(e){
 if(!can(e,'regs')&&!e.teams.length)return '';
 return teamsPanel(e);
};
// which views this person may use
function avViews(e){
 const pn=window.regPendingN?regPendingN(e):0,v=[['list','List',regsOf(e.id).length]];
 if(can(e,'regs'))v.push(['in','Check-in',0]);
 if(can(e,'addreg')||can(e,'regs'))v.push(['add','Add',0]);
 if(can(e,'regs'))v.push(['mail','Email',0]);
 if(can(e,'pay'))v.push(['reg','Sign-ups',pn,1]);
 return v;
}
function regsV(e){
 const vs=avViews(e);if(!vs.some(v=>v[0]===V.av))V.av='list';
 const nav=vs.length<2?'':`<div class="avn" role="group" aria-label="Attendees sections">${vs.map(v=>`<button class="${V.av===v[0]?'on':''}" data-av="${v[0]}" aria-pressed="${V.av===v[0]}">${ico(v[0])}<span class="lb">${v[1]}${v[2]?`<em${v[3]?' class="hot"':''}>${v[2]}</em>`:''}</span></button>`).join('')}</div>`;
 const body={list:listPanel,in:checkinPanel,add:addPanel,mail:mailPanel,reg:e=>(window.signupV?signupV(e):'')+(window.cashSetupV?cashSetupV(e):'')}[V.av];
 return nav+body(e);
}

/* ---------- actions ---------- */
document.addEventListener('click',x=>{
 const t=x.target.closest('button');if(!t||V.tab!=='detail')return;const D=t.dataset,E=cur();if(!E)return;
 if(D.dt){V.dt=D.dt;render();scrollTo(0,0)}
 else if(D.av){if(V.av!==D.av)V.rq='';V.av=D.av;render()}
 else if(D.rf){V.rf=D.rf;if(V.dt!=='regs'){V.dt='regs';V.av='list'}render();scrollTo(0,0)}
 else if(D.rmo){V.rmo=V.rmo===D.rmo?null:D.rmo;render()}
 else if(D.paid){if(!can(E,'regs'))return;const r=S.regs.find(q=>q.id===D.paid);if(r){r.paid=!r.paid;sv()}}
 else if(D.tdel){if(!can(E,'regs')||!confirm('Delete this team? Its members stay registered.'))return;E.teams=E.teams.filter(q=>q.id!==D.tdel);S.regs.forEach(r=>{if(r.team===D.tdel)r.team=''});sv()}
 else if(D.tmrm){if(!can(E,'regs'))return;const r=S.regs.find(q=>q.id===D.tmrm);if(r){r.team='';sv()}}
});
document.addEventListener('change',x=>{
 const t=x.target;if(!t.dataset||!t.dataset.tmadd||!t.value)return;const E=cur();
 if(!E||!can(E,'regs'))return;const r=S.regs.find(q=>q.id===t.value);if(r){r.team=t.dataset.tmadd;sv()}
});
document.addEventListener('submit',x=>{
 const f=x.target,E=cur();if(!E||V.tab!=='detail')return;
 if(f.id==='tnf'||f.id==='atf'){x.preventDefault();if(!can(E,'regs'))return;const fd=new FormData(f);
  if(f.id==='tnf'){const n=(fd.get('n')||'').toString().trim();if(!n)return;E.teams.push({id:uid(),n:n.slice(0,40)});sv();toast('Team created')}
  else{const n=Math.max(2,+fd.get('s')||4),pool=regsOf(E.id).filter(r=>!E.teams.some(t=>t.id===r.team)).sort(()=>Math.random()-.5);
   if(!pool.length)return toast('Everyone is already in a team');
   for(let i=0;i<pool.length;i+=n){const t={id:uid(),n:'Team '+(E.teams.length+1)};E.teams.push(t);pool.slice(i,i+n).forEach(r=>r.team=t.id)}
   sv();toast('Teams built')}
 }
 else if(f.id==='reg'){setTimeout(()=>{const i=document.querySelector('#reg input:not([type=checkbox]),#reg select');if(i)i.focus()},0)}   // ready for the next person
});
// search: only the list is redrawn, so the keyboard stays open
document.addEventListener('input',x=>{
 if(x.target.id!=='rq')return;const E=cur();if(!E)return;
 V.rq=x.target.value;const l=$('rlist');if(l)l.innerHTML=regRows(E,V.av==='in'?'in':'');
});
})();
