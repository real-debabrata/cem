/* CEM app2.js. 3.6.1: more roles (Coordinator, Registration desk, Logistics lead, Sponsorship lead, Volunteer) and custom roles that the organizer or a manager builds by ticking permissions
   (People tab > Custom roles). Every role is a list of permission keys (BASE below); firestore.rules enforces the same lists. The explanatory paragraphs that used to sit in the tabs moved to Help & guides (help.js).
   3.5.0: payment-link forms no longer write the event's UPI details unless you are organizer, manager or treasurer (the rules allow only those roles to change them); payRowsOf and siteBase are shared with income.js, signup.js and scan.js.
   Roles and permissions, Tasks (with Items to buy), People, Payments (money in) and "My tasks".
   3.4.0: Tasks now also lists Items to buy (drawn by expenses.js), People no longer holds the participant teams (they moved to
   Attendees, see event.js), and Payments is reorganised: payments to check first, forms behind buttons, settings tucked away.
   Roles, permissions and the stored data are unchanged. */
(function(){
const LBL={owner:'Organizer',manager:'Manager',treasurer:'Treasurer',lead:'Team lead',coord:'Coordinator',desk:'Registration desk',logi:'Logistics lead',spons:'Sponsorship lead',member:'Member',vol:'Volunteer',viewer:'Viewer'};window.LBL=LBL;
window.ROLEINFO={
 owner:'Everything, including deleting the event.',
 manager:'Edits the event and manages people, roles, tasks, payments, expenses and the budget.',
 treasurer:'Verifies payments and manages the budget, bills, vendors and income, plus everything a member can do.',
 lead:'Creates task groups, assigns tasks and items to anyone, and checks in attendees.',
 coord:'Runs the day: task groups, items to buy, attendees and check-in, and the volunteer list.',
 desk:'Staffs the registration desk: registers walk-ins, checks in, scans tickets and marks fees paid.',
 logi:'Plans logistics: task groups, tasks and items to buy, given to anyone.',
 spons:'Handles sponsors and the money side: income, budget, bills and vendors.',
 member:'Ticks their own tasks, adds people who report to them, creates payment links and registers attendees.',
 vol:'Ticks off the tasks given to them and joins the chat.',
 viewer:'Reads the event but cannot change it.'};
// What each permission opens, grouped as the tick-boxes of the custom role form. [key, short name, what it allows]
const PCAT=[
 ['Everyday work',[['tick','Tick off own tasks','Mark the tasks given to them as done.'],['write','Team member basics','Tick own tasks, add people who report to them, create payment links and register attendees (no check-in).']]],
 ['Running the event',[['tasks','Manage tasks','Create task groups and tasks and give them to anyone.'],['items','Items to buy','Add items to buy and give them to people.'],['people','Volunteer list','Add and remove people without an account and set who reports to whom.'],['regs','Attendees and check-in','Register, check in, scan tickets, mark fees paid, import a list and make participant teams.']]],
 ['Admin',[['event','Edit event and registrations','Edit the event details, remove registrations and delete any chat message.'],['pay','Payments and online registration','Verify payments, payment links, UPI settings, online registration and cash collectors.'],['exp','Money','See and manage the budget, vendors, bills, sponsors and the Income and Expenses tabs.']]]];
const PN=PCAT.flatMap(g=>g[1]),ALLP=PN.map(k=>k[0]);
// Permission list of every built-in role. The five newest (coord, desk, logi, spons, vol) are repeated in firestore.rules (permsOf): keep them identical.
const BASE={owner:[...ALLP,'roles'],manager:[...ALLP,'roles'],treasurer:['tick','write','items','regs','pay','exp'],lead:['tick','write','tasks','items','regs'],
 coord:['tick','write','tasks','items','regs','people'],desk:['tick','write','regs'],logi:['tick','write','tasks','items'],spons:['tick','write','exp'],member:['tick','write'],vol:['tick'],viewer:[]};
window.PERMCAT=PCAT;window.ROLEBASE=BASE;
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const crl=e=>Array.isArray(e.croles)?e.croles:[];
const crOf=(e,id)=>/^c_/.test(id||'')?crl(e).find(c=>c.id===id):null;
const norm=r=>r==='organizer'?'owner':r;
window.rolePerms=(e,r)=>{r=norm(r);if(own(BASE,r))return BASE[r];const c=crOf(e,r);return c&&Array.isArray(c.p)?c.p.filter(k=>ALLP.includes(k)):[]};
window.roleLabel=(e,r)=>{r=norm(r);if(own(LBL,r))return LBL[r];const c=crOf(e,r);return c?c.n:'Role removed'};
window.customRolesOf=crl;
const IMPLY={tick:['tick','write','tasks'],addreg:['write','regs','pay'],addtask:['write','tasks'],addperson:['write','people'],newlink:['write','pay']};   // derived actions: allowed when the role holds any of these
const me=()=>window.MYUID||'me',myName=()=>window.MYNAME||'Me';
window.myRole=e=>{if(!e.cloud)return 'owner';const m=(e.members||{})[me()],r=m&&m.role;return r==='organizer'?'owner':(r||'viewer')};
window.can=(e,a)=>{const p=rolePerms(e,myRole(e));return a==='chat'?p.length>0:(IMPLY[a]||[a]).some(k=>p.includes(k))};   // chat: any role with at least one permission (a viewer only reads)
const people=e=>[...Object.entries(e.members||{}).map(([id,m])=>({id,n:m.name,r:m.role==='organizer'?'owner':m.role,acct:1})),...(e.team||[]).map(m=>({id:m.id,n:m.n,r:m.r,p:m.p,boss:m.boss}))];
const mineIds=e=>[me(),...(e.team||[]).filter(m=>m.boss===me()).map(m=>m.id)];
const pn=(e,id)=>id==='me'?'Me':(people(e).find(p=>p.id===id)||{n:'Unassigned'}).n;
window.peopleOf=people;window.mineIdsOf=mineIds;window.pnOf=pn;   // used by expenses.js and event.js
const canTick=(e,k)=>can(e,'tasks')||(can(e,'tick')&&mineIds(e).includes(k.who));
const assignees=e=>{let l=can(e,'tasks')?people(e):people(e).filter(p=>mineIds(e).includes(p.id));if(!e.cloud)l=[{id:'me',n:'Me'},...l];return [...l].sort((a,b)=>(b.id===me())-(a.id===me()))};
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const dShort=s=>{const t=new Date(s+'T00:00:00');return isNaN(t)?s:t.toLocaleDateString([],{day:'numeric',month:'short'})};
const hue=s=>{let h=0;s=String(s);for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))%360;return h};

/* ---------- one task row (used in Tasks and in My tasks) ---------- */
const dueTag=k=>{if(!k.due)return '';if(k.done)return `<span>Due ${dShort(k.due)}</span>`;const t=today();return k.due<t?`<span class="pill bad">Was due ${dShort(k.due)}</span>`:k.due===t?'<span class="pill warn">Due today</span>':`<span>Due ${dShort(k.due)}</span>`};
const row=(e,k,del)=>{
 const own=assignees(e),ok=canTick(e,k),key=e.id+'|'+k.id,open=(V.td||{})[key],canEd=can(e,'tasks')||k.by===me();
 const opts=(own.some(x=>x.id===k.who)?own:[{id:k.who,n:pn(e,k.who)},...own]).map(x=>`<option value="${x.id}" ${x.id===k.who?'selected':''}>${esc(x.n)}</option>`).join('');
 const who=ok?`<select data-ra="${e.id}|${k.id}" aria-label="Assigned to">${opts}</select>`:`<span>${esc(pn(e,k.who))}</span>`;
 const bt=k.desc?`<button class="btn ghost sm" data-td="${key}" aria-expanded="${open?'true':'false'}">Brief ${open?'&#9652;':'&#9662;'}</button>`:(canEd?`<button class="btn ghost sm" data-tde="${key}">+ Brief</button>`:'');
 const body=V.te===key?`<div class="tdb"><textarea id="tdx" rows="4" maxlength="600" placeholder="What should the assignee know? Steps, links, deadlines..." aria-label="Task description">${esc(k.desc||'')}</textarea><div class="row" style="margin-top:6px"><button class="btn sm" data-tds="${key}">Save</button><button class="btn ghost sm" data-tdc="1">Cancel</button></div></div>`
  :(open&&k.desc?`<div class="tdb">${esc(k.desc)}${canEd?`<div style="margin-top:6px"><button class="btn ghost sm" data-tde="${key}">Edit brief</button></div>`:''}</div>`:'');
 return `<div class="tkr"><div class="t1"><input type="checkbox" data-mt="${e.id}|${k.id}" ${k.done?'checked':''} ${ok?'':'disabled'} aria-label="Mark done"><span class="tt ${k.done?'dn':''}">${esc(k.t)}</span></div><div class="t2">${who}${dueTag(k)}<span class="ta">${bt}${del&&(can(e,'tasks')||k.by===me())?`<button class="btn ghost sm del" data-tkdel="${k.id}">Delete</button>`:''}</span></div>${body}</div>`;
};
window.mineCount=()=>{let n=0;S.events.forEach(e=>{const ids=mineIds(e);n+=(e.tasks||[]).filter(k=>!k.done&&ids.includes(k.who)).length+(window.mineItemsN?mineItemsN(e):0)});return n?' ('+n+')':''};
window.mine=()=>{
 const b=S.events.map(e=>{const ids=mineIds(e),ts=(e.tasks||[]).filter(k=>ids.includes(k.who)),it=window.mineItemsV?mineItemsV(e):'';return ts.length||it?`<div class="card"><h3 style="margin-bottom:6px">${esc(e.name)}</h3>${ts.map(k=>row(e,k,0)).join('')}${it}</div>`:''}).join('');
 return '<h2 style="margin-bottom:12px">My tasks</h2>'+(b||'<div class="empty">Nothing assigned to you yet.</div>');
};

/* ---------- Tasks tab: task groups, then Items to buy ---------- */
window.tasksV2=function(e){
 const all=e.tasks,itm=e.itm||[],f=V.tf||'all',ids=mineIds(e),mgr=can(e,'tasks'),w=can(e,'addtask');
 const pass=k=>f==='mine'?ids.includes(k.who):f==='open'?!k.done:f==='done'?!!k.done:true;
 const dn=all.filter(k=>k.done).length+itm.filter(i=>i.s==='bought').length,tot=all.length+itm.length,p=tot?Math.round(dn/tot*100):0;
 const opts=assignees(e).map(a=>`<option value="${a.id}">${esc(a.n)}</option>`).join('');
 let shown=0;
 const groups=e.groups.map(g=>{
  const gt=all.filter(k=>k.gid===g.id),vis=gt.filter(pass);
  if(f!=='all'&&!vis.length)return '';
  shown+=vis.length;
  const form=!w?'':V.ta===g.id?`<form class="tk2 fp" data-gid="${g.id}"><div class="rg"><div class="rw"><label>Task *</label><input name="t" required maxlength="120" placeholder="What needs to be done?"></div>
    <div><label>Assign to</label><select name="w">${opts}</select></div><div><label>Due date</label><input name="d" type="date"></div>
    <div class="rw"><label>Brief (optional)</label><textarea name="x" rows="2" maxlength="600" placeholder="Steps, links, deadlines..." aria-label="Task description"></textarea></div></div>
    <div class="acts"><button class="btn" type="submit">Add task</button><button type="button" class="btn ghost" data-ta="${g.id}">Cancel</button></div></form>`
   :`<div style="margin-top:8px"><button class="btn ghost sm" data-ta="${g.id}">+ Add task</button></div>`;
  return `<div class="card"><div class="sh"><h3>${esc(g.n)}</h3><div class="row"><span class="meta">${gt.filter(k=>k.done).length} of ${gt.length} done</span>${mgr?`<button class="btn ghost sm del" data-grdel="${g.id}">Delete group</button>`:''}</div></div>
   ${vis.map(k=>row(e,k,1)).join('')||'<p class="meta" style="margin:0">No tasks here yet.</p>'}${form}</div>`;
 }).join('');
 const items=window.itemsV?itemsV(e):{html:'',n:0};
 shown+=items.n;
 const empty=!e.groups.length?(mgr?`<div class="empty"><p style="margin:0 0 10px">No task groups yet.</p><div class="row" style="justify-content:center"><button class="btn" data-grstd="1">Add standard groups</button><button class="btn ghost" data-tg="1">New group</button></div></div>`:'<div class="empty">No tasks yet.</div>'):'';
 const none=(f!=='all'&&!shown&&(e.groups.length||itm.length))?'<div class="empty">Nothing here for this filter.</div>':'';
 const grpForm=mgr&&V.tg?`<form id="grf" class="fp row"><input name="n" required maxlength="40" placeholder="Group name, e.g. Logistics" style="flex:1;min-width:160px" aria-label="Group name"><button class="btn" type="submit">Add group</button><button type="button" class="btn ghost" data-tg="0">Cancel</button></form>`:'';
 return `<div class="card"><div class="sh"><h3>Tasks and items to buy</h3><span class="meta">${dn} of ${tot} done</span></div>
  <div class="prog" role="progressbar" aria-label="Progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}"><i style="width:${p}%"></i></div>
  <div class="chips" style="margin:14px 0 0">${[['all','All'],['mine','Mine and my team'],['open','To do'],['done','Done']].map(c=>`<button class="chip ${f===c[0]?'on':''}" data-tf="${c[0]}">${c[1]}</button>`).join('')}</div>
  ${mgr&&e.groups.length?`<div class="row" style="margin-top:12px"><button class="btn ghost sm" data-tg="${V.tg?0:1}">${V.tg?'Close':'+ New group'}</button><button class="btn ghost sm" data-grstd="1">Add standard groups</button></div>`:''}${grpForm}</div>
 ${empty}${groups}${none}${items.html}`;
};

/* ---------- People tab ---------- */
const ORDER=['owner','manager','treasurer','coord','lead','spons','logi','desk','member','vol','viewer'],rk=r=>{const i=ORDER.indexOf(r);return i<0?ORDER.length:i};
const emptyRole=()=>({id:'',n:'',p:['tick','write']});
// Custom roles card: only organizer and manager see it (they are the only ones the rules let change roles).
function rolesCard(e){
 if(!e.cloud||!can(e,'roles'))return '';
 const list=crl(e),cnt=id=>Object.values(e.members||{}).filter(m=>m.role===id).length,d=V.crd;
 const chips=pl=>{const k=PN.filter(x=>pl.includes(x[0])||(x[0]==='tick'&&pl.includes('write')));return k.length?k.map(x=>`<span class="pill">${esc(x[1])}</span>`).join(' '):'<span class="meta">View only</span>'};
 const rows=list.map(c=>`<div class="li"><div class="main"><div class="ttl">${esc(c.n)} <span class="meta">${cnt(c.id)} ${cnt(c.id)===1?'person':'people'}</span></div><div class="sub rchips">${chips(c.p||[])}</div></div><div class="act"><button class="btn ghost sm" data-cre="${c.id}">Edit</button><button class="btn ghost sm del" data-crx="${c.id}">Delete</button></div></div>`).join('');
 const others=d?list.filter(c=>c.id!==d.id):[];
 const copy=`<optgroup label="Built-in roles">${ORDER.filter(r=>r!=='owner').map(r=>`<option value="${r}">${LBL[r]}</option>`).join('')}</optgroup>${others.length?`<optgroup label="Custom roles">${others.map(c=>`<option value="${c.id}">${esc(c.n)}</option>`).join('')}</optgroup>`:''}`;
 const form=d?`<form id="crf" class="fp"><div class="rg"><div><label for="crn">Role name *</label><input id="crn" name="n" required maxlength="24" value="${esc(d.n)}" placeholder="Stage manager, Photographer" autocomplete="off"></div>
   <div><label for="crs">Copy permissions from</label><select id="crs" data-crs="1"><option value="">Choose a role (optional)</option>${copy}</select></div></div>
   ${PCAT.map(g=>`<fieldset class="pkg"><legend>${g[0]}</legend>${g[1].map(k=>{const impl=k[0]==='tick'&&d.p.includes('write');return `<label class="pk"><input type="checkbox" data-cp="${k[0]}" ${d.p.includes(k[0])||impl?'checked':''} ${impl?'disabled':''}><span><b>${k[1]}</b><small>${k[2]}</small></span></label>`}).join('')}</fieldset>`).join('')}
   <div class="acts"><button class="btn" type="submit">${d.id?'Save role':'Create role'}</button><button type="button" class="btn ghost" data-cr="0">Cancel</button></div></form>`:'';
 return `<div class="card"><div class="sh"><h3>Custom roles (${list.length})</h3>${d?'':`<button class="btn sm" data-cr="1">+ New role</button>`}</div>${form}${rows||(d?'':'<p class="meta" style="margin:0">No custom roles yet.</p>')}</div>`;
}
window.peopleV=function(e){
 const mr=myRole(e),asg=[...(mr==='owner'?['manager']:[]),'treasurer','lead','coord','spons','logi','desk','member','vol','viewer'];
 const canRole=p=>can(e,'roles')&&p.id!==me()&&p.r!=='owner'&&(mr==='owner'||p.r!=='manager');
 const all=people(e).sort((a,b)=>(a.acct?rk(a.r):99)-(b.acct?rk(b.r):99)||String(a.n).localeCompare(String(b.n)));
 const w=can(e,'addperson');
 const sel=p=>{
  if(!canRole(p))return `<span class="pill acc">${esc(p.acct?roleLabel(e,p.r):(p.r||'Member'))}</span>`;
  const known=asg.includes(p.r)||crOf(e,p.r);
  return `<select class="sel-s" data-role="${p.id}" aria-label="Role of ${esc(p.n)}">${known?'':`<option value="${esc(p.r)}" selected disabled>${esc(roleLabel(e,p.r))}</option>`}${asg.map(r=>`<option value="${r}" ${p.r===r?'selected':''}>${LBL[r]}</option>`).join('')}${crl(e).length?`<optgroup label="Custom roles">${crl(e).map(c=>`<option value="${c.id}" ${p.r===c.id?'selected':''}>${esc(c.n)}</option>`).join('')}</optgroup>`:''}</select>`};
 const li=p=>{
  const t=e.tasks.filter(k=>k.who===p.id),prog=t.length?`${t.filter(k=>k.done).length} of ${t.length} tasks done`:'No tasks yet';
  const act=p.acct?(canRole(p)?`<button class="btn ghost sm del" data-rmm="${p.id}">Remove</button>`:''):(can(e,'people')||p.boss===me()?`<button class="btn ghost sm del" data-tmdel="${p.id}">Remove</button>`:'');
  const sub=p.acct?prog:[esc(p.r||'Member'),p.boss?'reports to '+esc(pn(e,p.boss)):'',p.p?`<a href="tel:${esc(p.p)}">${esc(p.p)}</a>`:'',prog].filter(Boolean).join(', ');
  return `<div class="li"><span class="av2" style="--h:${hue(p.id)}" aria-hidden="true">${esc((p.n||'?').trim().slice(0,1).toUpperCase())}</span><div class="main"><div class="ttl">${esc(p.n)}${p.id===me()?' <span class="pill">you</span>':''}</div><div class="sub">${sub}</div></div><div class="act">${p.acct?sel(p):''}${act}</div></div>`};
 const boss=can(e,'people')?`<div><label>Reports to</label><select name="b"><option value="">Nobody (top level)</option>${all.map(p=>`<option value="${p.id}">${esc(p.n)}</option>`).join('')}</select></div>`:'';
 const form=w&&V.pad?`<form id="mbf" class="fp"><div class="rg"><div><label>Name *</label><input name="n" required maxlength="40"></div><div><label>Title</label><input name="r" maxlength="40" placeholder="Volunteer, Designer"></div><div><label>Phone</label><input name="p" maxlength="20" inputmode="tel"></div>${boss}</div><div class="acts"><button class="btn" type="submit">Add person</button><button type="button" class="btn ghost" data-pad="0">Cancel</button></div></form>`:'';
 return `<div class="card"><div class="sh"><h3>People (${all.length})</h3>${w?`<button class="btn sm" data-pad="${V.pad?0:1}">${V.pad?'Close form':'+ Add person'}</button>`:''}</div>
  ${form}${all.length?`<div>${all.map(li).join('')}</div>`:'<p class="meta">No one yet.</p>'}</div>${rolesCard(e)}`;
};

/* ---------- Payments tab (money coming in) ---------- */
const ST={pending:'To check',verified:'Verified',rejected:'Rejected'},STC={pending:'warn',verified:'ok',rejected:'bad'};
const payBase=()=>{const c=window.PAY_BASE;if(c)return c.replace(/\/?$/,'/');if(/^https?:/.test(location.protocol)&&!/^(localhost|127\.)/.test(location.hostname))return location.origin+location.pathname.replace(/[^/]*$/,'');try{return localStorage.getItem('pay-base')||''}catch(x){return ''}};
const ulink=f=>`upi://pay?pa=${encodeURIComponent(f.upi)}&pn=${encodeURIComponent(f.payee||'')}${f.amt?'&am='+f.amt:''}&cu=INR&tn=${encodeURIComponent(f.title)}`;
function payData(e){
 const base=payBase(),mgr=can(e,'pay'),fs=(e.forms||[]).filter(f=>mgr||f.by===me());
 const subs=fs.flatMap(f=>((window.SUBS||{})[f.id]||[]).map(x=>Object.assign({},x,{fid:f.id,key:f.id+'|'+x.id,pub:1})));
 const leg=mgr?(e.payments||[]).map(p=>Object.assign({},p,{key:p.id,pub:0})):[];
 return{base,mgr,fs,rows:[...subs,...leg].sort((x,y)=>(y.at||0)-(x.at||0))};
}
window.payPendingN=e=>payData(e).rows.filter(p=>p.s==='pending').length;
window.siteBase=payBase;   // public site address (pay.html, register.html, ticket.html live there)
// every payment shown in the Payments tab as plain rows, for the CSV export
window.payRowsOf=e=>{const d=payData(e);return d.rows.map(p=>({title:((d.fs.find(f=>f.id===p.fid)||{}).title)||'Earlier payment',n:p.n,a:p.a,utr:p.utr||'',s:p.s,at:p.at}))};
window.payV2=function(e){
 const {base,mgr,fs,rows}=payData(e),w=can(e,'newlink'),f=V.pfl||'all';
 const sum=s=>rows.filter(p=>p.s===s).reduce((t,p)=>t+p.a,0),old=mgr?(e.don||[]).reduce((t,x)=>t+x.a,0):0,pend=rows.filter(p=>p.s==='pending').length;
 const until=window.untilOf?untilOf(e):0,over=!!until&&Date.now()>until,grace=Math.max(0,Math.min(30,+((e.pay||{}).grace)||0));
 const dts=t=>new Date(t).toLocaleDateString([],{day:'numeric',month:'short',year:'numeric'}),link=x=>base+'pay.html?f='+x.id;
 const shown=rows.filter(p=>f==='all'||p.s===f);
 const rcv=shown.map(p=>{const fm=fs.find(q=>q.id===p.fid),ok=p.pub?true:mgr,pre=p.pub?'s':'p';
  return `<div class="li"><div class="main"><div class="ttl">${esc(p.n)}</div><div class="sub">${esc(fm?fm.title:'Earlier payment')}, ${new Date(p.at).toLocaleDateString([],{day:'numeric',month:'short'})}${p.utr?', UTR '+esc(p.utr):''}</div></div>
   <span class="amt">₹${p.a}</span><span class="pill ${STC[p.s]||''}">${ST[p.s]||esc(p.s)}</span>
   ${ok?`<div class="act">${p.s!=='verified'?`<button class="btn sm" data-act="${pre}v" data-id="${p.key}">Verify</button>`:''}${p.s!=='rejected'?`<button class="btn ghost sm" data-act="${pre}r" data-id="${p.key}">Reject</button>`:''}<button class="btn ghost sm del" data-act="${pre}d" data-id="${p.key}">Delete</button></div>`:''}</div>`}).join('');
 const canNew=w&&e.cloud&&!over;
 const form=canNew&&V.pnw?`<form id="pfc" class="fp"><div class="rg"><div><label>Title *</label><input name="t" required placeholder="Registration fee, Donation"></div><div><label>Amount in ₹ (blank for any)</label><input name="a" type="number" min="1"></div><div><label>UPI ID *</label><input name="u" required value="${esc((e.pay||{}).upi||'')}" placeholder="name@bank"></div><div><label>Payee name *</label><input name="p" required value="${esc((e.pay||{}).payee||'')}"></div><div class="rw"><label>Note shown to payers</label><input name="n"></div></div><div class="acts"><button class="btn" type="submit">Create link</button><button type="button" class="btn ghost" data-pnw="0">Cancel</button></div></form>`:'';
 const lnote=!e.cloud?'<p class="meta" style="margin:0">Share the event first (Details tab) to create payment links.</p>':(w&&over?'<p class="meta" style="margin:0">This event is over, so a new link would already be expired.</p>':'');
 const cards=fs.length?`<div class="grid" style="margin-top:12px">${fs.map(x=>`<div class="card" style="margin:0;border:1px solid var(--line)"><div class="sh" style="margin-bottom:4px"><h3>${esc(x.title)}</h3>${mgr||x.by===me()?`<button class="btn ghost sm del" data-act="fd" data-id="${x.id}">Delete</button>`:''}</div>
   <p class="meta" style="margin:0 0 8px">${x.amt?'Amount: ₹'+x.amt:'Any amount'}, created by ${esc(x.byName||'')}<br>${over?'<span class="pill bad">Expired</span> on '+dts(until):'Valid until '+dts(until)}</p>${over?'':qrSvg(ulink(x))}
   <p class="meta" style="margin:8px 0">UPI ID: <b>${esc(x.upi)}</b><br>Payee: <b>${esc(x.payee)}</b></p>
   ${over?'':base?`<input readonly value="${esc(link(x))}" onclick="this.select()" aria-label="Payment link"><div class="row" style="margin-top:8px"><button class="btn sm" data-copy="${esc(link(x))}">Copy link</button><button class="btn ghost sm" data-shl="${esc(link(x))}" data-t="${esc(x.title)}">Share</button></div>`:''}</div>`).join('')}</div>`:'';
 const settings=V.pst?`<div class="fp">${e.cloud&&mgr?`<form id="pgf" class="row"><label style="margin:0">Keep links open</label><input name="g" type="number" min="0" max="30" value="${grace}" style="width:80px" aria-label="Extra days"><span class="meta">extra days after the event</span><button class="btn sm" type="submit">Save</button></form>
`:''}
   ${base?`<form id="pbf" class="row" style="margin-top:12px"><label style="margin:0">Site address</label><input name="b" required value="${esc(base)}" style="flex:1;min-width:200px" aria-label="Public site address"><button class="btn sm" type="submit">Save</button></form>`:''}</div>`:'';
 return `<div class="stats"><div class="stat"><b>₹${sum('verified')+old}</b><span>Verified</span></div><div class="stat"><b>₹${sum('pending')}</b><span>Waiting to be checked</span></div><div class="stat"><b>${rows.length}</b><span>Submissions</span></div><div class="stat"><b>${fs.length}</b><span>Payment links</span></div></div>
 ${base?'':`<div class="note"><b>Set your public site address first.</b><form id="pbf" class="row" style="margin-top:8px"><input name="b" required placeholder="https://yourname.github.io/your-repo/" style="flex:1;min-width:200px" aria-label="Public site address"><button class="btn" type="submit">Save</button></form></div>`}
 <div class="card"><div class="sh"><h3>Payments received (${rows.length})</h3>${pend?`<span class="pill warn">${pend} to check</span>`:''}</div>
  ${rows.length?`<div class="chips" style="margin:0 0 6px">${[['all','All'],['pending','To check'],['verified','Verified'],['rejected','Rejected']].map(c=>`<button class="chip ${f===c[0]?'on':''}" data-pfl="${c[0]}">${c[1]}</button>`).join('')}</div>${rcv||'<p class="meta">Nothing in this filter.</p>'}`:'<p class="meta" style="margin:0">No payments yet.</p>'}</div>
 <div class="card"><div class="sh"><h3>Payment links (${fs.length})</h3>${canNew?`<button class="btn sm" data-pnw="${V.pnw?0:1}">${V.pnw?'Close form':'+ New link'}</button>`:''}</div>${form}${lnote}${cards||(canNew&&!V.pnw?'<p class="meta" style="margin:0">No links yet.</p>':'')}</div>
 ${(e.cloud&&mgr)||base?`<div style="margin-bottom:16px"><button class="link" data-pst="${V.pst?0:1}" aria-expanded="${!!V.pst}">${V.pst?'Hide link settings':'Link settings'}</button>${settings}</div>`:''}`;
};

/* ---------- actions ---------- */
document.addEventListener('click',x=>{
 const t=x.target.closest('button');if(!t)return;const D=t.dataset,E=cur();
 if(D.tf!==undefined){V.tf=D.tf;render()}
 else if(D.ta!==undefined){V.ta=V.ta===D.ta?null:D.ta;render();const i=document.querySelector('.tk2 input[name=t]');if(V.ta&&i)i.focus()}
 else if(D.tg!==undefined){V.tg=D.tg==='1';render();const i=document.querySelector('#grf input');if(V.tg&&i)i.focus()}
 else if(D.pad!==undefined){V.pad=D.pad==='1';render()}
 else if(D.cr!==undefined){V.crd=D.cr==='1'?emptyRole():null;render();const i=document.getElementById('crn');if(V.crd&&i)i.focus()}
 else if(D.cre&&E){const c=crOf(E,D.cre);if(c&&can(E,'roles')){V.crd={id:c.id,n:c.n,p:[...(c.p||[])].filter(k=>ALLP.includes(k))};render();const i=document.getElementById('crn');if(i)i.focus()}}
 else if(D.crx&&E){const c=crOf(E,D.crx);if(!c||!can(E,'roles'))return;const used=Object.values(E.members||{}).filter(m=>m.role===c.id).length;
  if(used)return toast('Give the '+used+' '+(used===1?'person':'people')+' with this role another role first');
  if(!confirm('Delete the role "'+c.n+'"?'))return;E.croles=crl(E).filter(z=>z.id!==c.id);if(V.crd&&V.crd.id===c.id)V.crd=null;sv();toast('Role deleted')}
 else if(D.pfl){V.pfl=D.pfl;render()}
 else if(D.pst!==undefined){V.pst=D.pst==='1';render()}
 else if(D.pnw!==undefined){V.pnw=D.pnw==='1';render()}
 else if(D.td){V.td=V.td||{};V.td[D.td]=!V.td[D.td];render()}
 else if(D.tde){V.td=V.td||{};V.td[D.tde]=1;V.te=D.tde;render();const a=document.getElementById('tdx');if(a)a.focus()}
 else if(D.tdc){V.te=null;render()}
 else if(D.tds){const q=D.tds.split('|'),e1=S.events.find(z=>z.id===q[0]),k=e1&&e1.tasks.find(z=>z.id===q[1]);
  if(k&&(can(e1,'tasks')||k.by===me())){const v=(document.getElementById('tdx').value||'').replace(/\r/g,'').replace(/\n{3,}/g,'\n\n').trim().slice(0,600);if(v)k.desc=v;else delete k.desc;V.te=null;V.td=V.td||{};V.td[D.tds]=!!v;sv()}}
 else if(D.rmm&&E){if(confirm('Remove this member from the event?'))window.rmMember(E.id,D.rmm)}
 else if(D.tmdel&&E){if(!confirm('Remove this person? Their tasks become unassigned.'))return;E.team=E.team.filter(m=>m.id!==D.tmdel);E.tasks.forEach(k=>{if(k.who===D.tmdel)k.who=''});(E.itm||[]).forEach(i=>{if(i.who===D.tmdel)i.who=''});sv()}
 else if(D.grdel&&E){if(!can(E,'tasks'))return;const n=E.tasks.filter(k=>k.gid===D.grdel).length;if(n&&!confirm('Delete this group and its '+n+' task'+(n>1?'s':'')+'?'))return;E.groups=E.groups.filter(g=>g.id!==D.grdel);E.tasks=E.tasks.filter(k=>k.gid!==D.grdel);sv()}
 else if(D.grstd&&E){if(!can(E,'tasks'))return;['Logistics','Marketing','Finance','Hospitality','Tech and AV'].forEach(n=>{if(!E.groups.some(g=>g.n===n))E.groups.push({id:uid(),n})});sv()}
 else if(D.tkdel&&E){const k=E.tasks.find(z=>z.id===D.tkdel);if(!k||!(can(E,'tasks')||k.by===me()))return;if(!confirm('Delete this task?'))return;E.tasks=E.tasks.filter(z=>z.id!==D.tkdel);sv()}
 else if(D.shl){if(navigator.share)navigator.share({title:D.t,url:D.shl}).catch(()=>{});else{try{navigator.clipboard.writeText(D.shl);toast('Link copied')}catch(q){}}}
 else if(D.act&&E){const k=D.act;
  if(k[0]==='s'){const p=D.id.split('|');window.subAct(p[0],p[1],k)}
  else if(k==='fd'){if(!confirm('Delete this payment link and the payments submitted through it?'))return;E.forms=E.forms.filter(f=>f.id!==D.id);if(window.pubDel)pubDel(D.id);sv()}
  else{const p=E.payments.find(q=>q.id===D.id);if(!p)return;
   if(k==='pv')p.s='verified';else if(k==='pr')p.s='rejected';else if(k==='pd')E.payments=E.payments.filter(q=>q.id!==D.id);sv()}}
});
document.addEventListener('change',x=>{
 const t=x.target;
 if(t.dataset.mt){const [eid,tid]=t.dataset.mt.split('|'),ev1=S.events.find(q=>q.id===eid),k=ev1&&ev1.tasks.find(q=>q.id===tid);if(k&&canTick(ev1,k)){k.done=t.checked;sv()}}
 else if(t.dataset.ra){const q=t.dataset.ra.split('|'),ev1=S.events.find(z=>z.id===q[0]),k=ev1&&ev1.tasks.find(z=>z.id===q[1]);if(k&&canTick(ev1,k)&&assignees(ev1).some(a=>a.id===t.value)){k.who=t.value;sv()}else render()}
 else if(t.dataset.role){const E=cur();if(E&&can(E,'roles')&&((own(LBL,t.value)&&t.value!=='owner')||crOf(E,t.value)))window.setRole(E.id,t.dataset.role,t.value);else render()}
 else if(t.dataset.cp&&V.crd){const k=t.dataset.cp,l=V.crd.p;V.crd.p=t.checked?[...new Set([...l,k])]:l.filter(z=>z!==k);if(k==='write'){render();const c=document.querySelector('[data-cp="write"]');if(c)c.focus()}}
 else if(t.dataset.crs&&V.crd){const E=cur();if(t.value&&E){V.crd.p=[...rolePerms(E,t.value)].filter(k=>ALLP.includes(k));render();const c=document.getElementById('crs');if(c)c.focus()}}
});
document.addEventListener('input',x=>{if(x.target.id==='crn'&&V.crd)V.crd.n=x.target.value});
document.addEventListener('submit',x=>{
 const f=x.target,E=cur(),fd=new FormData(f),g=k=>(fd.get(k)||'').toString().trim();
 if(f.id==='crf'){
  const d=V.crd;if(!E||!d||!can(E,'roles'))return;
  const n=g('n').replace(/\s+/g,' ').slice(0,24),low=n.toLowerCase();
  if(n.length<2)return toast('Give the role a name of at least 2 letters');
  if(Object.keys(LBL).some(k=>LBL[k].toLowerCase()===low)||crl(E).some(c=>c.id!==d.id&&c.n.toLowerCase()===low))return toast('There is already a role with that name');
  if(!d.id&&crl(E).length>=12)return toast('You can have up to 12 custom roles');
  let pl=[...new Set(d.p.filter(k=>ALLP.includes(k)))];if(pl.includes('write'))pl=pl.filter(k=>k!=='tick');
  if(d.id){const c=crOf(E,d.id);if(!c)return;c.n=n;c.p=pl}
  else{let id;do{id='c_'+(Math.random().toString(36)+'000000').slice(2,8)}while(crOf(E,id));E.croles=[...crl(E),{id,n,p:pl,at:Date.now()}]}
  V.crd=null;sv();toast(d.id?'Role saved':'Role created');return}
 if(f.id==='pgf'){if(!can(E,'pay'))return;const g2=Math.max(0,Math.min(30,Math.round(+g('g'))||0));E.pay=Object.assign(E.pay||{},{grace:g2});sv();toast(g2?'Links stay open '+g2+' extra day'+(g2>1?'s':''):'Links close at the end of the event day')}
 else if(f.id==='pfc'){if(!E.cloud)return;if(window.untilOf&&Date.now()>untilOf(E))return toast('This event is over, so the link would already be expired');const id=(uid()+uid()).slice(0,12),fm={id,title:g('t'),amt:+g('a')||0,upi:g('u'),payee:g('p'),note:g('n'),by:me(),byName:myName(),at:Date.now()};E.forms.push(fm);if(can(E,'pay'))E.pay=Object.assign(E.pay||{},{upi:g('u'),payee:g('p')});window.pubForm(fm,E);V.pnw=false;sv();toast('Payment link created')}
 else if(f.id==='pbf'){try{localStorage.setItem('pay-base',g('b').replace(/\/?$/,'/'))}catch(q){}render();toast('Site address saved')}
 else if(f.id==='grf'){if(!can(E,'tasks')||!g('n'))return;E.groups.push({id:uid(),n:g('n').slice(0,40)});V.tg=false;sv();toast('Group added')}
 else if(f.classList.contains('tk2')){const w=g('w')||me();if(!assignees(E).some(a=>a.id===w))return toast('You can only assign to yourself or your subordinates');
  const dsc=(fd.get('x')||'').toString().replace(/\r/g,'').replace(/\n{3,}/g,'\n\n').trim().slice(0,600),tk={id:uid(),gid:f.dataset.gid,t:g('t'),who:w,due:g('d'),done:false,by:me()};if(dsc)tk.desc=dsc;E.tasks.push(tk);sv();toast('Task added');setTimeout(()=>{const i=document.querySelector('.tk2 input[name=t]');if(i)i.focus()},0)}
 else if(f.id==='mbf'){E.team.push({id:uid(),n:g('n'),r:g('r')||'Member',p:g('p'),boss:can(E,'people')?g('b'):me()});V.pad=false;sv();toast('Person added')}
});
})();
