/* CEM expenses.js. 3.6.1: the explanatory paragraphs moved to Help & guides (help.js). 3.1.0: budget, vendors, payments to vendors, items to buy.
   3.4.0: redesigned.
   - Expenses tab (organizer, manager, treasurer): a summary card on top, then three views: Budget (category cards), Bills (what you owe
     or have paid vendors) and Vendors. Forms open from buttons, so the page stays short.
   - Items to buy now live in the Tasks tab (itemsV below). Their cost still counts in the budget: bought items as spent, items still
     to buy as "to pay" (their estimate).
   3.5.0: bud, ven and exp (budget lines, vendors, bills) now live in the staff-only document events/{id}/fin/data (see sync.js), not in the event
   document, so members cannot read or change them. itm (items to buy) stays in the event document because every member sees it. Budget categories
   are only known to staff, so the category picker in the item form shows only for them.
   Who can do what (see PERM in app2.js):
   - exp   (owner, manager, treasurer): budget, vendors, bills. Other roles do not see the Expenses tab.
   - items (owner, manager, treasurer, lead): add items and allocate them. Everybody sees the list; the person an item is
     allocated to (or their manager) ticks it as bought and enters the real cost. */
(function(){
const R=n=>'₹'+(Math.round((+n||0)*100)/100).toLocaleString('en-IN');window.inr=R;
const sum=(l,k)=>l.reduce((t,x)=>t+(+x[k]||0),0);
const num=v=>Math.max(0,Math.round((+v||0)*100)/100);
const me=()=>window.MYUID||'me';
const loc=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const dayDiff=(a,b)=>{const p=s=>{const m=s.split('-');return Date.UTC(+m[0],+m[1]-1,+m[2])};return Math.round((p(a)-p(b))/864e5)};
const shortDate=s=>{const t=new Date(s+'T00:00:00');return isNaN(t)?s:t.toLocaleDateString([],{day:'numeric',month:'short'})};
const people=e=>window.peopleOf?peopleOf(e):[];
const pname=(e,id)=>window.pnOf?pnOf(e,id):'Unassigned';
const mineIds=e=>window.mineIdsOf?mineIdsOf(e):[me()];
const isMine=(e,i)=>!!i.who&&(mineIds(e).includes(i.who)||(!e.cloud&&i.who==='me'));
const canBuy=(e,i)=>can(e,'items')||(can(e,'write')&&isMine(e,i));   // 3.6.1: writing items needs Items to buy or Team member basics, as in firestore.rules
const upiOk=u=>/^[\w.\-]{2,}@[\w]{2,}$/.test(u||'');
const enc=encodeURIComponent;
const SUG=['Venue','Food and refreshments','Decor','Printing','Prizes','Travel','Marketing','Equipment','Miscellaneous'];
const chev='<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
const catOpts=(e,sel)=>`<option value="">No category</option>`+(e.bud||[]).map(b=>`<option value="${b.id}" ${b.id===sel?'selected':''}>${esc(b.n)}</option>`).join('');
const assignees=e=>{let l=people(e);if(!e.cloud)l=[{id:'me',n:'Me'},...l];return [...l].sort((a,b)=>(b.id===me())-(a.id===me()))};

/* ---------- numbers ---------- */
function calc(e){
 const bud=e.bud||[],ex=e.exp||[],it=e.itm||[],known=new Set(bud.map(b=>b.id));
 const part=cid=>{const inC=o=>cid===null?!known.has(o.c):o.c===cid;
  return{paid:sum(ex.filter(x=>inC(x)&&x.s==='paid'),'a')+sum(it.filter(i=>inC(i)&&i.s==='bought'),'ac'),
         due:sum(ex.filter(x=>inC(x)&&x.s!=='paid'),'a')+sum(it.filter(i=>inC(i)&&i.s!=='bought'),'p')}};
 const rows=bud.map(b=>Object.assign({b},part(b.id))),oth=part(null);
 const plan=sum(bud,'a'),paid=rows.reduce((t,r)=>t+r.paid,0)+oth.paid,due=rows.reduce((t,r)=>t+r.due,0)+oth.due;
 return{rows,oth,plan,paid,due,left:plan-paid-due};
}
window.moneyBrief=e=>{const C=calc(e);return{plan:C.plan,paid:C.paid,due:C.due,left:C.left,over:C.plan>0&&C.left<0}};
window.billsOverdueN=e=>{const t=loc();return (e.exp||[]).filter(x=>x.s!=='paid'&&x.due&&x.due<t).length};

const dueTag=x=>{
 if(!x.due)return '<span class="pill">No due date</span>';
 const d=dayDiff(x.due,loc());
 if(d<0)return `<span class="pill bad">Overdue by ${-d} day${d===-1?'':'s'}</span>`;
 if(d===0)return '<span class="pill warn">Due today</span>';
 if(d<=7)return `<span class="pill warn">Due in ${d} day${d===1?'':'s'}</span>`;
 return `<span class="pill">Due ${shortDate(x.due)}</span>`;
};

/* ---------- summary card (always on top) ---------- */
function hero(e,C){
 const used=C.paid+C.due,over=C.plan>0&&used>C.plan,it=e.itm||[],bought=it.filter(i=>i.s==='bought').length;
 const sp=C.plan>0?Math.min(100,C.paid/C.plan*100):0,tp=C.plan>0?Math.min(100-sp,C.due/C.plan*100):0;
 const top=C.plan>0
  ?`<div class="xl">${over?'Over budget by':'Left to spend'}</div><div class="big ${over?'over':''}">${R(Math.abs(C.left))}</div><div class="of">of your ${R(C.plan)} budget</div>`
  :`<div class="xl">Planned spending</div><div class="big">${R(used)}</div><div class="of">No budget set yet.</div>`;
 const bar=C.plan>0?`<div class="mbar ${over?'over':''}" role="progressbar" aria-label="Budget used" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100,Math.round(sp+tp))}"><i class="sp" style="width:${sp}%"></i><i class="tp" style="width:${tp}%"></i></div>`:'';
 return `<div class="card xh">${top}${bar}
  <div class="mlg"><span><i class="a"></i>Spent <b>${R(C.paid)}</b></span><span><i class="b"></i>To pay <b>${R(C.due)}</b></span></div>
  ${it.length?`<div class="xitems"><span>Items to buy: <b>${bought} of ${it.length}</b> bought.</span><button class="btn ghost sm" data-x="igo" data-e="${e.id}">Open in Tasks</button></div>`:''}</div>`;
}
function seg(e){
 const n=(e.exp||[]).filter(x=>x.s!=='paid').length,od=billsOverdueN(e),nv=(e.ven||[]).length,v=V.xv||'budget';
 const t=[['budget','Budget',''],['bills','Bills',n?`<em${od?' class="hot"':''}>${n}</em>`:''],['vendors','Vendors',nv?`<em>${nv}</em>`:'']];
 return `<div class="seg" role="group" aria-label="Expenses sections">${t.map(s=>`<button class="${v===s[0]?'on':''}" data-x="xv" data-e="${e.id}" data-v="${s[0]}">${s[1]}${s[2]}</button>`).join('')}</div>`;
}

/* ---------- Budget view ---------- */
function catCard(e,r){
 const b=r.b,used=r.paid+r.due,over=used>b.a,open=V.xc===b.id,left=b.a-used;
 const st=over?`<span class="pill bad">Over by ${R(used-b.a)}</span>`:(b.a>0&&used/b.a>=.85)?'<span class="pill warn">Almost used</span>':used===0?'<span class="pill">Nothing spent yet</span>':'<span class="pill ok">On track</span>';
 const sp=b.a>0?Math.min(100,r.paid/b.a*100):(used>0?100:0),tp=b.a>0?Math.min(100-sp,r.due/b.a*100):0;
 const bills=(e.exp||[]).filter(x=>x.c===b.id),items=(e.itm||[]).filter(i=>i.c===b.id);
 const lines=bills.map(x=>{const p=x.s==='paid';return `<div class="xln"><span>${esc(x.t)}<br><span class="meta">${esc((e.ven||[]).find(v=>v.id===x.v)?.n||x.vn||'')}</span></span><b>${R(x.a)}</b><span class="pill ${p?'ok':''}">${p?'Paid':'To pay'}</span></div>`}).join('')
  +items.map(i=>{const p=i.s==='bought';return `<div class="xln"><span>${esc(i.t)}${i.q>1?' ×'+i.q:''}<br><span class="meta">Item to buy</span></span><b>${R(p?i.ac:i.p)}</b><span class="pill ${p?'ok':''}">${p?'Bought':'To buy'}</span></div>`}).join('');
 const body=open?`<div class="xcb"><div class="pl"><label style="margin:0" for="xb_${b.id}">Planned amount ₹</label><input id="xb_${b.id}" class="xin" type="number" min="0" step="any" inputmode="decimal" data-xb="${e.id}|${b.id}" value="${b.a}"></div>
   ${lines||`<p class="meta" style="margin:0 0 8px">Nothing recorded under ${esc(b.n)} yet.</p>`}
   <div style="margin-top:10px"><button class="btn ghost sm del" data-x="bdel" data-e="${e.id}" data-i="${b.id}">Delete category</button></div></div>`:'';
 return `<div class="xc"><button class="xch" data-x="xcat" data-e="${e.id}" data-i="${b.id}" aria-expanded="${open}">
   <span class="r1"><span class="xn">${esc(b.n)}</span>${st}${chev}</span>
   <span class="r2"><span><b>${R(used)}</b> of ${R(b.a)}</span><span>${left>=0?R(left)+' left':R(-left)+' over'}</span></span>
   <span class="mbar ${over?'over':''}" style="height:8px" role="progressbar" aria-label="${esc(b.n)} used" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100,Math.round(sp+tp))}"><i class="sp" style="width:${sp}%"></i><i class="tp" style="width:${tp}%"></i></span></button>${body}</div>`;
}
function budgetView(e,C){
 const has=(e.bud||[]).length>0,open=V.xa||!has;
 const taken=new Set((e.bud||[]).map(b=>b.n.toLowerCase())),sugs=SUG.filter(s=>!taken.has(s.toLowerCase()));
 const form=open?`<form id="xbf" class="fp" data-e="${e.id}">
   ${sugs.length?`<label>Tap a common category, or type your own</label><div class="sugs">${sugs.map(s=>`<button type="button" class="chip" data-x="xsug" data-e="${e.id}" data-v="${esc(s)}">${esc(s)}</button>`).join('')}</div>`:''}
   <div class="rg"><div><label>Category *</label><input name="n" required maxlength="40" placeholder="Food and refreshments"></div>
   <div><label>Planned amount in ₹ *</label><input name="a" type="number" min="0" step="any" inputmode="decimal" required></div></div>
   <div class="acts"><button class="btn" type="submit">Add category</button>${has?'<button type="button" class="btn ghost" data-x="xat" data-e="'+e.id+'">Close</button>':''}</div></form>`:'';
 const oth=(C.oth.paid||C.oth.due)?`<div class="xc"><div class="xch" style="cursor:default"><span class="r1"><span class="xn">No category</span><span class="pill">Not in the budget</span></span><span class="r2"><span><b>${R(C.oth.paid+C.oth.due)}</b> spent or to pay</span></span></div></div>`:'';
 return `<div class="card"><div class="sh"><h3>Budget by category</h3>${has?`<button class="btn sm" data-x="xat" data-e="${e.id}">${V.xa?'Close form':'+ Add category'}</button>`:''}</div>
  ${form}${C.rows.map(r=>catCard(e,r)).join('')}${oth}</div>`;
}

/* ---------- Bills view (what you owe or have paid vendors) ---------- */
function billRow(e,x){
 const v=(e.ven||[]).find(z=>z.id===x.v),to=v?v.n:(x.vn||'No name'),cat=(e.bud||[]).find(b=>b.id===x.c),paid=x.s==='paid',canUpi=!paid&&v&&upiOk(v.upi);
 const sub=[esc(to),cat?esc(cat.n):''].filter(Boolean).join(', ')+(paid&&(x.m||x.ref)?`<br>${esc(x.m||'')}${x.ref?' reference '+esc(x.ref):''}`:'');
 const status=paid?`<span class="pill ok">Paid ${new Date(x.pd||x.at).toLocaleDateString([],{day:'numeric',month:'short'})}</span>`:dueTag(x);
 const del=`<button class="btn ghost sm del" data-x="xdel" data-e="${e.id}" data-i="${x.id}">Delete</button>`;
 const act=paid?`<button class="btn ghost sm" data-x="xun" data-e="${e.id}" data-i="${x.id}">Undo</button>${del}`
  :`${canUpi?`<button class="btn ghost sm" data-x="xq" data-e="${e.id}" data-i="${x.id}" aria-expanded="${V.xq===x.id}">Pay via UPI</button>`:''}<button class="btn sm" data-x="xpd" data-e="${e.id}" data-i="${x.id}" aria-expanded="${V.xp===x.id}">Mark paid</button>${del}`;
 let sf='';
 if(V.xq===x.id&&canUpi){const l=`upi://pay?pa=${enc(v.upi)}&pn=${enc(v.n)}&am=${x.a}&cu=INR&tn=${enc(x.t)}`;
  sf+=`<div class="xsub"><div class="xqr">${qrSvg(l)}<div><p class="meta" style="margin:0 0 8px">Pay ${R(x.a)} to ${esc(v.n)} (${esc(v.upi)}).</p><a class="btn sm" href="${esc(l)}" style="text-decoration:none;display:inline-block">Open UPI app</a></div></div></div>`}
 if(V.xp===x.id&&!paid)sf+=`<div class="xsub"><form id="xpf" class="row" data-e="${e.id}" data-i="${x.id}"><select name="m" aria-label="Paid by">${['UPI','Cash','Bank transfer','Other'].map(m=>`<option ${x.m===m?'selected':''}>${m}</option>`).join('')}</select><input name="r" maxlength="40" value="${esc(x.ref||'')}" placeholder="UTR / reference (optional)" style="flex:1;min-width:150px" aria-label="UTR or reference"><button class="btn sm" type="submit">Confirm paid</button><button type="button" class="btn ghost sm" data-x="xpc" data-e="${e.id}">Cancel</button></form></div>`;
 return `<div class="li"><div class="main"><div class="ttl">${esc(x.t)}</div><div class="sub">${sub}</div></div><span class="amt">${R(x.a)}</span>${status}<div class="act">${act}</div>${sf}</div>`;
}
function billsView(e){
 const ex=e.exp||[],td=loc(),due=ex.filter(x=>x.s!=='paid'),paid=ex.filter(x=>x.s==='paid');
 due.sort((a,b)=>{const ka=a.due||'9999-99-99',kb=b.due||'9999-99-99';return ka<kb?-1:ka>kb?1:(b.at||0)-(a.at||0)});
 paid.sort((a,b)=>(b.pd||b.at||0)-(a.pd||a.at||0));
 const od=due.filter(x=>x.due&&x.due<td).length,open=V.xa||!ex.length,showPaid=V.xsp==null?!due.length:V.xsp;
 const form=open?`<form id="xef" class="fp" data-e="${e.id}"><div class="rg"><div class="rw"><label>What is it for? *</label><input name="t" required maxlength="80" placeholder="Sound system rental"></div>
   <div><label>Pay to *</label><input name="v" required maxlength="60" list="xvl" value="${esc(V.xvp||'')}" placeholder="Vendor or person"></div>
   <div><label>Amount in ₹ *</label><input name="a" type="number" min="1" step="any" inputmode="decimal" required></div>
   <div><label>Budget category</label><select name="c">${catOpts(e)}</select></div>
   <div><label>Due date</label><input name="d" type="date"></div></div>
  <details style="margin-top:10px"><summary class="meta" style="cursor:pointer">Already paid? Add how you paid</summary><div class="rg" style="margin-top:8px"><div><label>Paid by</label><select name="m">${['UPI','Cash','Bank transfer','Other'].map(m=>`<option>${m}</option>`).join('')}</select></div><div><label>UTR / reference</label><input name="r" maxlength="40"></div></div></details>
  <datalist id="xvl">${(e.ven||[]).map(v=>`<option value="${esc(v.n)}"></option>`).join('')}</datalist>
  <div class="acts"><button class="btn" type="submit" name="s" value="due">Add to bills</button><button class="btn ghost" type="submit" name="s" value="paid">Add as already paid</button>${ex.length?'<button type="button" class="btn ghost" data-x="xat" data-e="'+e.id+'">Close</button>':''}</div></form>`:'';
 return `<div class="card"><div class="sh"><h3>Bills</h3>${ex.length?`<button class="btn sm" data-x="xat" data-e="${e.id}">${V.xa?'Close form':'+ Add bill'}</button>`:''}</div>
  ${form}
  ${ex.length?`<div class="xtot"><span>To pay <b>${R(sum(due,'a'))}</b> (${due.length})</span><span>Paid <b>${R(sum(paid,'a'))}</b> (${paid.length})</span>${od?`<span class="pill bad">${od} overdue</span>`:''}</div>`:''}
  ${due.length?due.map(x=>billRow(e,x)).join(''):(ex.length&&!open?'<p class="meta" style="margin:8px 0">Nothing left to pay.</p>':'')}
  ${paid.length?`<div style="margin-top:10px"><button class="link" data-x="xsp" data-e="${e.id}" aria-expanded="${!!showPaid}">${showPaid?'Hide':'Show'} paid bills (${paid.length})</button></div>${showPaid?paid.map(x=>billRow(e,x)).join(''):''}`:''}</div>`;
}

/* ---------- Vendors view ---------- */
function vendorsView(e){
 const ex=e.exp||[],ven=e.ven||[],open=V.xa||!ven.length;
 const form=open?`<form id="xvf" class="fp" data-e="${e.id}"><div class="rg"><div><label>Name *</label><input name="n" required maxlength="60" placeholder="Sharma Caterers"></div><div><label>UPI ID (optional)</label><input name="u" placeholder="name@bank"></div><div><label>Phone (optional)</label><input name="p" maxlength="20" inputmode="tel"></div></div>
  <div class="acts"><button class="btn" type="submit">Add vendor</button>${ven.length?'<button type="button" class="btn ghost" data-x="xat" data-e="'+e.id+'">Close</button>':''}</div></form>`:'';
 const rows=ven.map(v=>{const mine=ex.filter(x=>x.v===v.id);
  return `<div class="li"><div class="main"><div class="ttl">${esc(v.n)}</div><div class="sub">${v.ph?`<a href="tel:${esc(v.ph)}">${esc(v.ph)}</a>`:'No phone'}, ${v.upi?'UPI '+esc(v.upi):'no UPI ID'}</div><div class="vcard"><span>Paid <b>${R(sum(mine.filter(x=>x.s==='paid'),'a'))}</b></span><span>To pay <b>${R(sum(mine.filter(x=>x.s!=='paid'),'a'))}</b></span></div></div>
   <div class="act"><button class="btn ghost sm" data-x="vbill" data-e="${e.id}" data-i="${v.id}">Add bill</button><button class="btn ghost sm del" data-x="vdel" data-e="${e.id}" data-i="${v.id}">Delete</button></div></div>`}).join('');
 return `<div class="card"><div class="sh"><h3>Vendors and parties</h3>${ven.length?`<button class="btn sm" data-x="xat" data-e="${e.id}">${V.xa?'Close form':'+ Add vendor'}</button>`:''}</div>
  ${form}${rows}</div>`;
}

window.expV=function(e){
 if(!can(e,'exp'))return '<div class="empty">You do not have access to this section.</div>';
 const C=calc(e),v=V.xv||'budget';
 return `${hero(e,C)}${seg(e)}${v==='bills'?billsView(e):v==='vendors'?vendorsView(e):budgetView(e,C)}`;
};

/* ---------- Items to buy (drawn inside the Tasks tab) ---------- */
window.itemsV=function(e){
 const all=e.itm||[],f=V.tf||'all',itp=can(e,'items');
 const vis=all.filter(i=>f==='mine'?isMine(e,i):f==='open'?i.s!=='bought':f==='done'?i.s==='bought':true);
 if(!all.length&&!itp)return{html:'',n:0};
 if(f!=='all'&&!vis.length&&!(itp&&V.ia))return{html:'',n:0};
 const est=sum(all.filter(i=>i.s!=='bought'),'p'),spent=sum(all.filter(i=>i.s==='bought'),'ac'),done=all.filter(i=>i.s==='bought').length,ass=assignees(e);
 const row=i=>{
  const bought=i.s==='bought',ok=canBuy(e,i),mine=isMine(e,i),cat=(e.bud||[]).find(b=>b.id===i.c);
  const who=itp?`<select data-xa="${e.id}|${i.id}" aria-label="Allocated to">${(ass.some(a=>a.id===i.who)?ass:[{id:i.who,n:pname(e,i.who)},...ass]).map(a=>`<option value="${a.id}" ${a.id===i.who?'selected':''}>${esc(a.n)}</option>`).join('')}<option value="" ${i.who?'':'selected'}>Unassigned</option></select>`
   :`<span>${esc(i.who?pname(e,i.who):'Unassigned')}${mine?' (you)':''}</span>`;
  const sf=V.xb===i.id&&!bought&&ok?`<form id="xgf" class="fp row" data-e="${e.id}" data-i="${i.id}"><input name="ac" type="number" min="0" step="any" inputmode="decimal" required value="${i.p||''}" placeholder="What did it cost? ₹" style="width:170px" aria-label="Actual cost in rupees"><button class="btn sm" type="submit">Confirm bought</button><button type="button" class="btn ghost sm" data-x="xbc" data-e="${e.id}">Cancel</button></form>`:'';
  return `<div class="tkr"><div class="t1"><input type="checkbox" data-ib="${e.id}|${i.id}" ${bought?'checked':''} ${ok?'':'disabled'} aria-label="Mark ${esc(i.t)} as bought"><span class="tt ${bought?'dn':''}">${esc(i.t)}${i.q>1?' ×'+i.q:''}</span><span class="amt">${bought?R(i.ac):(i.p?'est. '+R(i.p):'')}</span></div>
   <div class="t2">${who}${cat?`<span class="pill">${esc(cat.n)}</span>`:''}${bought?'<span class="pill ok">Bought</span>':''}${itp?`<span class="ta"><button class="btn ghost sm del" data-x="idel" data-e="${e.id}" data-i="${i.id}">Delete</button></span>`:''}</div>${sf}</div>`};
 const form=itp&&V.ia?`<form id="xif" class="fp" data-e="${e.id}"><div class="rg"><div class="rw"><label>Item *</label><input name="t" required maxlength="80" placeholder="Banner, 3 x 6 ft"></div>
   <div><label>Quantity</label><input name="q" type="number" min="1" step="1" value="1" inputmode="numeric"></div>
   <div><label>Estimated cost in ₹ (whole line)</label><input name="p" type="number" min="0" step="any" inputmode="decimal"></div>
   <div><label>Allocate to</label><select name="w"><option value="">Unassigned</option>${ass.map(a=>`<option value="${a.id}">${esc(a.n)}</option>`).join('')}</select></div>
   ${(e.bud||[]).length?`<div><label>Budget category</label><select name="c">${catOpts(e)}</select></div>`:''}</div>
   <div class="acts"><button class="btn" type="submit">Add item</button><button type="button" class="btn ghost" data-x="ia" data-e="${e.id}">Close</button></div></form>`:'';
 const by={};all.forEach(i=>{const k=i.who||'';(by[k]=by[k]||[]).push(i)});
 const who=Object.keys(by).map(k=>{const l=by[k];return `<div class="li" style="padding:7px 0"><div class="main"><div class="ttl">${esc(k?pname(e,k):'Unassigned')}${k&&k===me()?' <span class="pill">you</span>':''}</div><div class="sub">${l.length} item${l.length>1?'s':''}, ${l.filter(i=>i.s==='bought').length} bought</div></div><span class="sub">To buy ${R(sum(l.filter(i=>i.s!=='bought'),'p'))}, spent ${R(sum(l.filter(i=>i.s==='bought'),'ac'))}</span></div>`}).join('');
 const html=`<div class="card"><div class="sh"><h3>Items to buy</h3><div class="row"><span class="meta">${done} of ${all.length} bought</span>${itp?`<button class="btn ghost sm" data-x="ia" data-e="${e.id}">${V.ia?'Close form':'+ Add item'}</button>`:''}</div></div>
  ${form}${vis.map(row).join('')||`<p class="meta" style="margin:8px 0 0">${all.length?'Nothing in this filter.':'No items yet.'}</p>`}
  ${all.length?`<p class="meta" style="margin:10px 0 0">Still to buy (estimate): <b>${R(est)}</b>. Spent on bought items: <b>${R(spent)}</b>.</p><div style="margin-top:6px"><button class="link" data-x="xw" data-e="${e.id}" aria-expanded="${!!V.xw}">${V.xw?'Hide':'Show'} who is buying what</button></div>${V.xw?who:''}`:''}</div>`;
 return{html,n:vis.length};
};

/* ---------- "My tasks" integration ---------- */
window.mineItemsN=e=>(e.itm||[]).filter(i=>i.s!=='bought'&&isMine(e,i)).length;
window.mineItemsV=e=>{
 const l=(e.itm||[]).filter(i=>isMine(e,i));if(!l.length)return '';
 return `<h4 style="margin:12px 0 4px;font-size:14px">Items to buy</h4>`+l.map(i=>`<div class="li" style="padding:8px 0"><span class="main ${i.s==='bought'?'meta':''}" style="${i.s==='bought'?'text-decoration:line-through':''}">${esc(i.t)}${i.q>1?' ×'+i.q:''}</span><span class="meta">${i.s==='bought'?'Bought '+R(i.ac):(i.p?'est. '+R(i.p):'')}</span>${i.s==='bought'?'':`<button class="btn ghost sm" data-x="igo" data-e="${e.id}">Open</button>`}</div>`).join('');
};

/* ---------- actions ---------- */
document.addEventListener('click',x=>{
 const t=x.target.closest('button[data-x]');if(!t)return;
 const D=t.dataset,E=S.events.find(z=>z.id===D.e);if(!E)return;
 const id=D.i,a=D.x,item=()=>(E.itm||[]).find(z=>z.id===id),bill=()=>(E.exp||[]).find(z=>z.id===id);
 if(a==='xv'){V.xv=D.v;V.xa=false;V.xq=null;V.xp=null;V.xvp='';render()}
 else if(a==='xat'){V.xa=!V.xa;if(!V.xa)V.xvp='';render();if(V.xa){const i=document.querySelector('.fp input:not([type=checkbox])');if(i)i.focus()}}
 else if(a==='xsug'){const f=document.querySelector('#xbf');if(f){f.elements.n.value=D.v;f.elements.a.focus()}}
 else if(a==='xcat'){V.xc=V.xc===id?null:id;render()}
 else if(a==='bdel'&&can(E,'exp')){const b=(E.bud||[]).find(z=>z.id===id);if(!b)return;if(!confirm('Delete the "'+b.n+'" budget line? Bills and items in it move to "No category".'))return;E.bud=E.bud.filter(z=>z.id!==id);if(V.xc===id)V.xc=null;sv()}
 else if(a==='vdel'&&can(E,'exp')){const v=(E.ven||[]).find(z=>z.id===id);if(!v||!confirm('Delete '+v.n+'? Their bills stay in the list.'))return;E.ven=E.ven.filter(z=>z.id!==id);sv()}
 else if(a==='vbill'&&can(E,'exp')){const v=(E.ven||[]).find(z=>z.id===id);V.xv='bills';V.xa=true;V.xvp=v?v.n:'';render();const i=document.querySelector('#xef input[name=t]');if(i)i.focus()}
 else if(a==='xdel'&&can(E,'exp')){if(!confirm('Delete this bill?'))return;E.exp=E.exp.filter(p=>p.id!==id);if(V.xp===id)V.xp=null;if(V.xq===id)V.xq=null;sv()}
 else if(a==='xq'){V.xq=V.xq===id?null:id;V.xp=null;render()}
 else if(a==='xpd'&&can(E,'exp')){V.xp=V.xp===id?null:id;V.xq=null;render()}
 else if(a==='xpc'){V.xp=null;render()}
 else if(a==='xun'&&can(E,'exp')){const p=bill();if(p){p.s='due';delete p.pd;sv()}}
 else if(a==='xsp'){const showing=V.xsp==null?!(E.exp||[]).some(p=>p.s!=='paid'):V.xsp;V.xsp=!showing;render()}
 else if(a==='ia'&&can(E,'items')){V.ia=!V.ia;render();if(V.ia){const i=document.querySelector('#xif input[name=t]');if(i)i.focus()}}
 else if(a==='idel'&&can(E,'items')){const i=item();if(!i||!confirm('Delete "'+i.t+'" from the list?'))return;E.itm=E.itm.filter(z=>z.id!==id);if(V.xb===id)V.xb=null;sv()}
 else if(a==='xbc'){V.xb=null;render()}
 else if(a==='xw'){V.xw=!V.xw;render()}
 else if(a==='igo'){V.dt='tasks';V.tf='all';go('detail',E.id)}
});
document.addEventListener('change',x=>{
 const t=x.target;
 if(t.dataset.xb){const q=t.dataset.xb.split('|'),E=S.events.find(z=>z.id===q[0]),b=E&&(E.bud||[]).find(z=>z.id===q[1]);if(b&&can(E,'exp')){b.a=num(t.value);sv()}}
 else if(t.dataset.xa){const q=t.dataset.xa.split('|'),E=S.events.find(z=>z.id===q[0]),i=E&&(E.itm||[]).find(z=>z.id===q[1]);
  if(i&&can(E,'items')&&(t.value===''||assignees(E).some(a=>a.id===t.value))){i.who=t.value;sv()}else render()}
 else if(t.dataset.ib){const q=t.dataset.ib.split('|'),E=S.events.find(z=>z.id===q[0]),i=E&&(E.itm||[]).find(z=>z.id===q[1]);
  if(!i||!canBuy(E,i))return render();
  if(t.checked){V.xb=i.id;render();const c=document.querySelector('#xgf input[name=ac]');if(c){c.focus();c.select()}}   // ask for the real cost first
  else{i.s='todo';delete i.ac;delete i.bt;V.xb=null;sv()}}
});
document.addEventListener('submit',x=>{
 const f=x.target,E=S.events.find(z=>z.id===f.dataset.e);if(!E||!/^x[bvefigp]f$/.test(f.id))return;
 x.preventDefault();
 const fd=new FormData(f),g=k=>(fd.get(k)||'').toString().replace(/\s+/g,' ').trim();
 if(f.id==='xbf'&&can(E,'exp')){if(!g('n'))return;E.bud.push({id:uid(),n:g('n').slice(0,40),a:num(g('a')),at:Date.now()});sv();toast('Category added');setTimeout(()=>{const i=document.querySelector('#xbf input[name=n]');if(i)i.focus()},0)}
 else if(f.id==='xvf'&&can(E,'exp')){const u=g('u');if(u&&!upiOk(u))return toast('That UPI ID does not look right');
  E.ven.push({id:uid(),n:g('n').slice(0,60),upi:u,ph:g('p').slice(0,20),at:Date.now()});V.xa=false;sv();toast('Vendor added')}
 else if(f.id==='xef'&&can(E,'exp')){
  const a=num(g('a'));if(!g('t')||!g('v')||!(a>0))return toast('Fill in what it is for, who to pay and the amount');
  const nm=g('v').toLowerCase(),v=(E.ven||[]).find(z=>z.n.toLowerCase()===nm),paid=(x.submitter&&x.submitter.value)==='paid';
  const p={id:uid(),t:g('t').slice(0,80),v:v?v.id:'',vn:(v?v.n:g('v')).slice(0,60),c:g('c'),a,s:paid?'paid':'due',m:g('m'),ref:g('r').slice(0,40),due:g('d'),by:me(),at:Date.now()};
  if(paid)p.pd=Date.now();E.exp.push(p);V.xa=false;V.xvp='';sv();toast(paid?'Payment recorded':'Added to bills')}
 else if(f.id==='xpf'&&can(E,'exp')){const p=(E.exp||[]).find(z=>z.id===f.dataset.i);if(p){p.s='paid';p.pd=Date.now();p.m=g('m');p.ref=g('r').slice(0,40);V.xp=null;sv();toast('Marked as paid')}}
 else if(f.id==='xif'&&can(E,'items')){
  const w=g('w');if(w&&!assignees(E).some(a=>a.id===w))return toast('Pick someone from the list');
  E.itm.push({id:uid(),t:g('t').slice(0,80),q:Math.max(1,Math.round(+g('q'))||1),p:num(g('p')),c:g('c'),who:w,s:'todo',by:me(),at:Date.now()});sv();toast('Item added');setTimeout(()=>{const i=document.querySelector('#xif input[name=t]');if(i)i.focus()},0)}
 else if(f.id==='xgf'){const i=(E.itm||[]).find(z=>z.id===f.dataset.i);if(i&&canBuy(E,i)){i.s='bought';i.ac=num(g('ac'));i.bt=Date.now();V.xb=null;sv();toast('Marked as bought')}}
});
})();
