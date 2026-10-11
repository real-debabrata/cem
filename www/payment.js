/* CEM 3.6.0: Cash or UPI for every attendee, and the people who collect the cash.
   - Cash collectors: owner, manager and treasurer pick who may receive cash (Attendees > Cash collectors). Pick people from the event team,
     or type a name for someone outside the app (for example a faculty coordinator). Stored in the event's payment settings: pay.cashiers = [{id, n, u?}].
   - Public registration page (register.html): when the ticket has a price, the applicant chooses UPI or Cash. For cash they pick the collector
     from a drop-down (the collectors above) and say whether they have already paid or will pay later. UPI works as before (QR + optional UTR).
   - Register attendee (inside the app): a "Payment" block with the same choices.
   - Each attendee stores  pm = 'cash' | 'upi',  cc = collector id,  cn = collector name,  paid, pt (paid time), utr.
     A cash payment is only marked paid by someone who can mark paid (organizer, manager, treasurer, team lead): the person who collected tells them, or they
     tick it after counting. Tip: give the collectors the Treasurer role if they should tick "paid" themselves.
   - "Cash and UPI at a glance" shows, for each collector, how many attendees chose them, what has been received and what is still to collect. */
(function(){
const R=n=>window.inr?inr(n):'₹'+n;
const feeOf=e=>Math.max(0,+(e.pay||{}).fee||0);
const list=e=>Array.isArray((e.pay||{}).cashiers)?e.pay.cashiers:[];
const mname=m=>m==='cash'?'Cash':m==='upi'?'UPI':'';
const newId=()=>'c'+Math.random().toString(36).slice(2,7);
window.cashiersOf=list;
window.payTagV=r=>r.pm?`<span class="pill acc">${mname(r.pm)}${r.pm==='cash'&&r.cn?': '+esc(r.cn):''}</span> `:'';

/* ---------- Cash collectors (organizer, manager, treasurer) ---------- */
window.cashSetupV=function(e){
 if(!window.can||!can(e,'pay'))return '';
 const cs=list(e),fee=feeOf(e),taken=new Set(cs.map(c=>c.u).filter(Boolean));
 const avail=(window.peopleOf?peopleOf(e):[]).filter(p=>!taken.has(p.id));
 const rs=regsOf(e.id);
 const row=c=>{
  const mine=rs.filter(r=>r.pm==='cash'&&r.cc===c.id),got=mine.filter(r=>r.paid).length;
  return `<div class="li"><div class="main"><div class="ttl">${esc(c.n)}</div><div class="sub">${c.u?'Event team':'Added by name'}${mine.length?`, ${mine.length} attendee${mine.length===1?'':'s'} chose them (${got} received)`:''}</div></div>
   <div class="act"><button class="btn ghost sm del" data-cs="rm" data-id="${esc(c.id)}" aria-label="Remove ${esc(c.n)} from cash collectors">Remove</button></div></div>`;
 };
 return `<div class="card"><div class="sh"><h3>Cash collectors</h3><span class="meta">${cs.length} selected</span></div>
  ${fee>0?'':'<p class="meta" style="margin:0 0 10px">Set a ticket price first (Price and settings, or the Income tab).</p>'}
  ${cs.map(row).join('')}
  <form id="csf" class="row" style="margin-top:10px"><select name="u" aria-label="Add a collector from the event team" style="flex:1;min-width:170px"><option value="">Add from the event team</option>${avail.map(p=>`<option value="${esc(p.id)}">${esc(p.n)} (${esc((window.LBL||{})[p.r]||p.r||'')})</option>`).join('')}</select><button class="btn sm" type="submit">Add</button></form>
  <form id="csn" class="row" style="margin-top:8px"><input name="n" maxlength="40" placeholder="Or type a name, e.g. Faculty coordinator" aria-label="Collector name" style="flex:1;min-width:170px"><button class="btn ghost sm" type="submit">Add name</button></form></div>`;
};

/* ---------- Cash and UPI at a glance ---------- */
window.cashSummaryV=function(e){
 const fee=feeOf(e);if(!fee||!window.can||!can(e,'regs'))return '';
 const rs=regsOf(e.id),cs=list(e),cash=rs.filter(r=>r.pm==='cash'),upi=rs.filter(r=>r.pm==='upi');
 if(!cash.length&&!upi.length&&!cs.length)return '';
 const by={};cs.forEach(c=>by[c.id]={n:c.n,due:0,got:0});
 cash.forEach(r=>{const k=r.cc&&by[r.cc]?r.cc:(r.cc||'-');if(!by[k])by[k]={n:r.cn||(r.cc?'Removed collector':'No collector chosen'),due:0,got:0};by[k][r.paid?'got':'due']++});
 const line=(n,got,due)=>`<div class="li"><div class="main"><div class="ttl">${esc(n)}</div><div class="sub">${got} paid (${R(got*fee)}), ${due} still to collect (${R(due*fee)})</div></div></div>`;
 const rows=Object.keys(by).filter(k=>by[k].got||by[k].due||k!=='-').map(k=>line(by[k].n,by[k].got,by[k].due)).join('');
 const ug=upi.filter(r=>r.paid).length;
 return `<div class="card"><div class="sh"><h3>Cash and UPI at a glance</h3><span class="meta">Ticket ₹${fee}</span></div>
  <div class="li"><div class="main"><div class="ttl">UPI</div><div class="sub">${ug} paid (${R(ug*fee)}), ${upi.length-ug} still to confirm (${R((upi.length-ug)*fee)})</div></div></div>
  ${rows?`<p class="meta" style="margin:10px 0 0"><b>Cash, by collector</b></p>${rows}`:''}
  ${cash.filter(r=>!r.paid).length?`<p class="meta" style="margin:8px 0 0"><button class="btn ghost sm" data-rf="cash">Show unpaid cash (${cash.filter(r=>!r.paid).length})</button></p>`:''}</div>`;
};

/* ---------- block inside the in-app "Register attendee" form ---------- */
window.payBlockV=function(e){
 const fee=feeOf(e);if(!fee)return '';
 const cs=list(e),recv=window.can&&can(e,'regs');
 return `<div class="rw payb"><label for="pmode">Ticket fee ₹${fee}: how is it paid?</label>
  <select id="pmode" name="p_mode"><option value="">Not paid yet</option><option value="cash">Cash</option><option value="upi">UPI</option></select>
  <div data-pcash class="hid"><label for="pcc">Paid to, or will pay to${cs.length?' *':''}</label>${cs.length?`<select id="pcc" name="p_cc"><option value="">Choose who collects the cash</option>${cs.map(c=>`<option value="${esc(c.id)}">${esc(c.n)}</option>`).join('')}</select>`:'<p class="meta" style="margin:0">No cash collectors yet.</p>'}</div>
  <div data-pupi class="hid"><label for="putr">UTR / reference (optional)</label><input id="putr" name="p_utr" maxlength="40" autocomplete="off" autocapitalize="characters"></div>
  ${recv?'<label class="chk" data-prcv style="display:none"><input type="checkbox" name="p_recv"> Payment received now</label>':''}</div>`;
};
// reads the block into the new attendee r; returns an error text or ''
window.regPayFrom=function(e,fd,r){
 if(!feeOf(e))return '';
 const m=(fd.get('p_mode')||'').toString();if(m!=='cash'&&m!=='upi')return '';
 r.pm=m;
 if(m==='cash'){
  const cs=list(e),id=(fd.get('p_cc')||'').toString();
  if(cs.length&&!id)return 'Choose who the cash is paid to';
  const c=cs.find(x=>x.id===id);if(c){r.cc=c.id;r.cn=c.n}
 }else{
  const u=window.normId?normId(fd.get('p_utr')):'';
  if(u){if(u.length<6)return 'The UTR must be at least 6 characters, or leave it empty';r.utr=u}
 }
 if(fd.get('p_recv')&&window.can&&can(e,'regs')){r.paid=true;r.pt=Date.now()}
 return '';
};

/* ---------- change one attendee's payment later (the ... menu) ---------- */
window.payEditV=function(e,r){
 if(!feeOf(e)||!window.can||!can(e,'regs'))return '';
 const cs=list(e);
 return `<select class="sel-s" data-pm="${esc(r.id)}" aria-label="Paid how, for ${esc(r.name)}"><option value="">Paid how?</option><option value="cash" ${r.pm==='cash'?'selected':''}>Cash</option><option value="upi" ${r.pm==='upi'?'selected':''}>UPI</option></select>`
  +(r.pm==='cash'&&cs.length?`<select class="sel-s" data-pc="${esc(r.id)}" aria-label="Cash collector for ${esc(r.name)}"><option value="">Collector?</option>${cs.map(c=>`<option value="${esc(c.id)}" ${r.cc===c.id?'selected':''}>${esc(c.n)}</option>`).join('')}</select>`:'');
};

/* ---------- actions ---------- */
function saveCashiers(E,arr){E.pay=Object.assign({upi:'',payee:'',fee:0},E.pay||{});E.pay.cashiers=arr.slice(0,20);sv()}
document.addEventListener('click',x=>{
 const t=x.target.closest('button[data-cs]');if(!t)return;
 const E=cur();if(!E||V.tab!=='detail'||!can(E,'pay'))return;
 if(t.dataset.cs==='rm'){
  const c=list(E).find(z=>z.id===t.dataset.id);if(!c)return;
  const n=regsOf(E.id).filter(r=>r.pm==='cash'&&r.cc===c.id&&!r.paid).length;
  if(!confirm('Remove '+c.n+' from the cash collectors?'+(n?' '+n+' attendee'+(n===1?'':'s')+' chose them and have not paid yet. They keep their choice.':'')))return;
  saveCashiers(E,list(E).filter(z=>z.id!==c.id));toast('Collector removed');
 }
});
document.addEventListener('submit',x=>{
 const f=x.target;if(f.id!=='csf'&&f.id!=='csn')return;x.preventDefault();
 const E=cur();if(!E||!can(E,'pay'))return;
 const fd=new FormData(f),cs=list(E).slice();
 if(cs.length>=20)return toast('Up to 20 collectors');
 if(f.id==='csf'){
  const p=(window.peopleOf?peopleOf(E):[]).find(z=>z.id===fd.get('u'));if(!p)return toast('Choose a person from the list');
  if(cs.some(c=>c.u===p.id))return toast('Already a collector');
  cs.push({id:newId(),n:String(p.n).slice(0,40),u:p.id});
 }else{
  const n=String(fd.get('n')||'').replace(/\s+/g,' ').trim();
  if(n.length<2)return toast('Type at least 2 letters');
  if(cs.some(c=>c.n.toLowerCase()===n.toLowerCase()))return toast('That name is already a collector');
  cs.push({id:newId(),n:n.slice(0,40)});
 }
 saveCashiers(E,cs);toast('Collector added');
});
document.addEventListener('change',x=>{
 const t=x.target;if(!t||V.tab!=='detail')return;
 if(t.name==='p_mode'){   // show only what the chosen mode needs
  const f=t.form;if(!f)return;
  const set=(sel,on)=>{const el=f.querySelector(sel);if(el){el.classList.toggle('hid',!on);if(sel==='[data-prcv]')el.style.display=on?'':'none'}};
  set('[data-pcash]',t.value==='cash');set('[data-pupi]',t.value==='upi');set('[data-prcv]',!!t.value);return;
 }
 const D=t.dataset||{};if(!D.pm&&!D.pc)return;
 const E=cur();if(!E||!can(E,'regs'))return;
 const r=S.regs.find(q=>q.id===(D.pm||D.pc));if(!r)return;
 if(D.pm){
  if(!t.value){delete r.pm;delete r.cc;delete r.cn}
  else{r.pm=t.value;if(t.value!=='cash'){delete r.cc;delete r.cn}}
 }else{
  const c=list(E).find(z=>z.id===t.value);if(c){r.cc=c.id;r.cn=c.n}else{delete r.cc;delete r.cn}
 }
 sv();
});
})();
