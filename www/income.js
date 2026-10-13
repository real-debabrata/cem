/* Income tab (ticket income, break-even, cash and UPI at a glance, sponsors, payment links) and the CSV export. Plain client-side code, nothing to install, no new service.
   Who: owner, manager and treasurer (the same people who see Expenses). Sponsors are stored in the staff-only document events/{id}/fin/data, field spn.
   Sponsor entry: { id, n: name, k: Sponsor | Donation | Other, cm: amount committed, rc: amount received, pr: what you promised them,
                    dl: 1 when the promises are delivered, ct: contact, at }.
   Break-even:  income if every seat sells = ticket price x seats + sponsorship (received + still expected)
                cost = the budget, or what you have spent plus still to pay (your choice)
                tickets needed = (cost - sponsorship) / ticket price, rounded up.
   The ticket price is set in Attendees > Registration > Price and settings.
   Export:  attendees, payments, bills and sponsors as CSV (UTF-8 with a BOM, so Excel opens rupee signs and accents correctly), or all in one ZIP.
            Cells that start with = + - @ get a leading ' so a spreadsheet never runs them as a formula. */
(function(){
const R=n=>window.inr?inr(n):'₹'+n;
const num=v=>Math.max(0,Math.round((+v||0)*100)/100);
const sum=(l,k)=>l.reduce((t,x)=>t+(+x[k]||0),0);
const me=()=>window.MYUID||'me';
const KINDS=['Sponsor','Donation','Other'];
const pad=n=>String(n).padStart(2,'0');
const dt=t=>{if(!t)return '';const d=new Date(t);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+' '+pad(d.getHours())+':'+pad(d.getMinutes())};
const day=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};
const slug=s=>String(s||'event').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)||'event';

/* ================= files: CSV, ZIP, save ================= */
const cell=v=>{if(v==null)return '';if(typeof v==='number')return String(v);let s=String(v);if(/^[=+\-@\t\r]/.test(s))s="'"+s;return /[",\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};
const toCsv=(head,rows)=>'\ufeff'+[head].concat(rows).map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n';
window.cemCsv=toCsv;

// a store-only ZIP (no compression), enough to carry a few CSV files in one download
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
const crc32=u=>{let c=0xFFFFFFFF;for(let i=0;i<u.length;i++)c=CRC[(c^u[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0};
function zipStore(files){   // files: [{name, text}]
 const te=new TextEncoder(),d=new Date(),dtm=(d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1),ddt=((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate();
 const parts=[],cen=[];let off=0;
 files.forEach(f=>{
  const nm=te.encode(f.name),data=te.encode(f.text),crc=crc32(data);
  const lh=new DataView(new ArrayBuffer(30));
  lh.setUint32(0,0x04034b50,true);lh.setUint16(4,20,true);lh.setUint16(6,0x0800,true);lh.setUint16(8,0,true);lh.setUint16(10,dtm,true);lh.setUint16(12,ddt,true);
  lh.setUint32(14,crc,true);lh.setUint32(18,data.length,true);lh.setUint32(22,data.length,true);lh.setUint16(26,nm.length,true);lh.setUint16(28,0,true);
  parts.push(new Uint8Array(lh.buffer),nm,data);
  const ch=new DataView(new ArrayBuffer(46));
  ch.setUint32(0,0x02014b50,true);ch.setUint16(4,20,true);ch.setUint16(6,20,true);ch.setUint16(8,0x0800,true);ch.setUint16(10,0,true);ch.setUint16(12,dtm,true);ch.setUint16(14,ddt,true);
  ch.setUint32(16,crc,true);ch.setUint32(20,data.length,true);ch.setUint32(24,data.length,true);ch.setUint16(28,nm.length,true);
  ch.setUint32(42,off,true);
  cen.push(new Uint8Array(ch.buffer),nm);
  off+=30+nm.length+data.length;
 });
 const cl=cen.reduce((t,p)=>t+p.length,0),end=new DataView(new ArrayBuffer(22));
 end.setUint32(0,0x06054b50,true);end.setUint16(8,files.length,true);end.setUint16(10,files.length,true);end.setUint32(12,cl,true);end.setUint32(16,off,true);
 return new Blob(parts.concat(cen,[new Uint8Array(end.buffer)]),{type:'application/zip'});
}
window.cemZip=zipStore;

// Save or share a file. Android app: write to the cache and open the share sheet (Save to Drive, WhatsApp, Files...). Website: normal download.
window.cemSave=async function(name,mime,data){
 const blob=data instanceof Blob?data:new Blob([data],{type:mime});
 const c=window.Capacitor,P=c&&c.Plugins;
 if(c&&c.isNativePlatform&&c.isNativePlatform()&&P&&P.Filesystem&&P.Share){
  try{
   const b64=await new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(String(r.result).split(',')[1]);r.onerror=no;r.readAsDataURL(blob)});
   const w=await P.Filesystem.writeFile({path:name,data:b64,directory:'CACHE'});
   await P.Share.share({title:name,url:w.uri,dialogTitle:'Save or share '+name});
   return true;
  }catch(x){if(/cancel/i.test(String((x&&x.message)||x)))return false}
 }
 try{const a=document.createElement('a'),u=URL.createObjectURL(blob);a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000);return true}
 catch(x){toast('Could not save the file');return false}
};

/* ================= the CSV files ================= */
const feeOf=e=>Math.max(0,+(e.pay||{}).fee||0);
function attendeesCsv(e){
 const fee=feeOf(e),fl=e.fields||[],used={};
 const labels=fl.map(f=>{let l=f.label||'Question';if(used[l]){used[l]++;l+=' ('+used[l]+')'}else used[l]=1;return l});
 const hasCid=!!(window.cidField&&cidField(e));   // when the form already asks for the College ID, do not repeat it
 const head=['Ticket ID','Name'].concat(hasCid?[]:['College ID'],labels,['Email','Phone','Checked in','Checked in at','Checked in by','Fee (INR)','Paid','Payment mode','Cash collector','UTR','Team','Source','Registered at']);
 const rows=regsOf(e.id).slice().sort((a,b)=>(a.at||0)-(b.at||0)).map(r=>{const t=(e.teams||[]).find(x=>x.id===r.team);
  return [r.id,r.name].concat(hasCid?[]:[regCid(e,r)],fl.map(f=>r.data&&r.data[f.id]),[r.em||'',r.ph||'',r.in?'Yes':'No',dt(r.inAt),r.inBy||'',fee,r.paid?'Yes':'No',r.pm==='cash'?'Cash':r.pm==='upi'?'UPI':'',r.pm==='cash'?(r.cn||''):'',r.utr||'',t?t.n:'',r.src==='form'?'Online form':r.src==='import'?'Imported from file':'Entered by team',dt(r.at)])});
 return toCsv(head,rows);
}
const ST={pending:'To check',verified:'Verified',rejected:'Rejected'};
function paymentsCsv(e){
 const fee=feeOf(e),rows=(window.payRowsOf?payRowsOf(e):[]).map(p=>[p.title,p.n,p.a,p.utr,ST[p.s]||p.s,dt(p.at),'UPI','']);
 if(fee>0)regsOf(e.id).filter(r=>r.paid).forEach(r=>rows.push(['Attendee fee (marked paid)',r.name,fee,r.utr||'','Paid',dt(r.pt||r.at),r.pm==='cash'?'Cash':r.pm==='upi'?'UPI':'',r.pm==='cash'?(r.cn||''):'']));
 rows.sort((a,b)=>String(b[5]).localeCompare(String(a[5])));
 return toCsv(['Source','Name','Amount (INR)','UTR / reference','Status','Date','Mode','Cash collector'],rows);
}
function billsCsv(e){
 const rows=(e.exp||[]).slice().sort((a,b)=>(a.at||0)-(b.at||0)).map(x=>{const v=(e.ven||[]).find(z=>z.id===x.v),c=(e.bud||[]).find(b=>b.id===x.c);
  return [x.t,v?v.n:(x.vn||''),c?c.n:'',+x.a||0,x.s==='paid'?'Paid':'To pay',x.due||'',x.pd?dt(x.pd):'',x.m||'',x.ref||'']});
 return toCsv(['Description','Pay to','Budget category','Amount (INR)','Status','Due date','Paid on','Paid by','Reference'],rows);
}
function sponsorsCsv(e){
 const rows=(e.spn||[]).slice().sort((a,b)=>(a.at||0)-(b.at||0)).map(s=>[s.n,s.k||'Sponsor',+s.cm||0,+s.rc||0,Math.max(0,(+s.cm||0)-(+s.rc||0)),s.pr||'',s.dl?'Yes':'No',s.ct||'',dt(s.at)]);
 return toCsv(['Name','Kind','Committed (INR)','Received (INR)','Outstanding (INR)','Promised in return','Delivered','Contact','Added'],rows);
}
function exportFiles(e,which){
 const A=can(e,'regs'),P=can(e,'pay'),B=can(e,'exp'),s=slug(e.name),d=day(),all=[];
 if(A)all.push({k:'att',name:s+'-attendees-'+d+'.csv',make:attendeesCsv});
 if(P)all.push({k:'pay',name:s+'-payments-'+d+'.csv',make:paymentsCsv});
 if(B)all.push({k:'bills',name:s+'-bills-'+d+'.csv',make:billsCsv});
 if(B)all.push({k:'spn',name:s+'-sponsors-'+d+'.csv',make:sponsorsCsv});
 return which==='all'?all:all.filter(f=>f.k===which);
}
window.exportV=function(e){
 const A=can(e,'regs'),P=can(e,'pay'),B=can(e,'exp');
 if(!A&&!P&&!B)return '';
 const b=(k,t)=>`<button class="btn ghost sm" data-ex="${k}">${t}</button>`;
 return `<div class="card"><h3 style="margin-bottom:10px">Export data</h3>
  <div class="row"><button class="btn sm" data-ex="all">Download everything (ZIP)</button>${A?b('att','Attendees'):''}${P?b('pay','Payments'):''}${B?b('bills','Bills'):''}${B?b('spn','Sponsors'):''}</div></div>`;
};
async function runExport(e,which){
 const fs=exportFiles(e,which);if(!fs.length)return toast('Nothing to export for your role');
 if(which==='all'){await cemSave(slug(e.name)+'-data-'+day()+'.zip','application/zip',zipStore(fs.map(f=>({name:f.name,text:f.make(e)}))));return}
 const f=fs[0];await cemSave(f.name,'text/csv;charset=utf-8',f.make(e));
}

/* ================= Income tab ================= */
function figures(e){
 const rs=regsOf(e.id),price=feeOf(e),cap=+e.cap||0,paidN=rs.filter(r=>r.paid).length,spn=e.spn||[];
 const spIn=sum(spn,'rc'),spOut=spn.reduce((t,s)=>t+Math.max(0,(+s.cm||0)-(+s.rc||0)),0),spAll=spIn+spOut;
 const mb=window.moneyBrief?moneyBrief(e):{plan:0,paid:0,due:0},actual=mb.paid+mb.due;
 const basis=V.ibs||(mb.plan>0?'plan':'act'),cost=basis==='plan'?mb.plan:actual;
 const tIn=paidN*price,tDue=(rs.length-paidN)*price,tFull=price*cap,gap=cost-spAll;
 const need=gap<=0?0:(price>0?Math.ceil(gap/price):Infinity),full=tFull+spAll;
 return{rs,price,cap,paidN,spIn,spOut,spAll,mb,actual,basis,cost,tIn,tDue,tFull,gap,need,full};
}
function breakEven(f){
 if(f.cost<=0)return '<p class="meta" style="margin:10px 0 0">Add a budget or some costs in Expenses to see the break-even point.</p>';
 let t;
 if(f.gap<=0)t=`Sponsorship alone covers the cost of ${R(f.cost)}. Every ticket sold is extra.`;
 else if(f.price<=0)t=`Costs are ${R(f.cost)} and sponsorship covers ${R(f.spAll)}. The ticket price is not set, so ${R(f.gap)} is not covered yet. Set it in Attendees > Registration > Price and settings.`;
 else if(f.need>f.cap)t=`Even a full house does not cover the costs: you would be ${R(f.cost-f.full)} short. Raise the price, add sponsors or cut costs.`;
 else t=`You break even at ${f.need} ticket${f.need===1?'':'s'} (${Math.round(f.need/Math.max(1,f.cap)*100)}% of ${f.cap} seats). ${f.rs.length>=f.need?`You already have ${f.rs.length} registered, so the costs are covered once they pay.`:`${f.need-f.rs.length} more registration${f.need-f.rs.length===1?'':'s'} to go (${f.rs.length} registered).`}`;
 const mx=Math.max(f.cost,f.full,1),w=v=>Math.max(0,Math.min(100,v/mx*100)).toFixed(2),cp=Math.min(99,f.cost/mx*100).toFixed(2);
 const seg=[['ba',f.spIn,'Sponsor money received'],['bb',f.tIn,'Ticket fees paid'],['bc',f.spOut,'Sponsor money still expected'],['bd',Math.max(0,f.tFull-f.tIn),'Tickets not yet paid or sold']];
 return `<p style="margin:12px 0 8px"><b>${esc(t)}</b></p>
  <div class="be" role="img" aria-label="Income compared with cost. ${esc(seg.map(s=>s[2]+' '+R(s[1])).join('. '))}. Cost ${R(f.cost)}.">${seg.map(s=>`<i class="${s[0]}" style="width:${w(s[1])}%"></i>`).join('')}<span class="bm" style="left:${cp}%"><em>Cost ${R(f.cost)}</em></span></div>
  <div class="mlg" style="margin-top:14px">${seg.map(s=>`<span><i class="${s[0]}"></i>${s[2]} <b>${R(s[1])}</b></span>`).join('')}</div>`;
}
function spForm(e,s){
 const x=s||{};
 return `<form id="spf" class="fp" data-i="${esc(x.id||'')}"><div class="rg"><div><label>Name *</label><input name="n" required maxlength="60" value="${esc(x.n||'')}" placeholder="Acme Bank"></div>
  <div><label>Kind</label><select name="k">${KINDS.map(k=>`<option ${k===(x.k||'Sponsor')?'selected':''}>${k}</option>`).join('')}</select></div>
  <div><label>Amount committed in ₹ *</label><input name="cm" type="number" min="0" step="any" inputmode="decimal" required value="${x.cm!=null?x.cm:''}"></div>
  <div><label>Amount received so far in ₹</label><input name="rc" type="number" min="0" step="any" inputmode="decimal" value="${x.rc!=null?x.rc:0}"></div>
  <div class="rw"><label>What you promised them (logo, stall, stage mention...)</label><textarea name="pr" rows="2" maxlength="500">${esc(x.pr||'')}</textarea></div>
  <div class="rw"><label>Contact (optional)</label><input name="ct" maxlength="100" value="${esc(x.ct||'')}" placeholder="Name, phone or email"></div></div>
  <div class="acts"><button class="btn" type="submit">${s?'Save changes':'Add'}</button><button type="button" class="btn ghost" data-ic="spx">Cancel</button></div></form>`;
}
function spRow(e,s){
 const cm=+s.cm||0,rc=+s.rc||0,out=Math.max(0,cm-rc),pc=cm>0?Math.min(100,rc/cm*100):(rc>0?100:0);
 return `<div class="li"><div class="main"><div class="ttl">${esc(s.n)} <span class="pill">${esc(s.k||'Sponsor')}</span> ${out===0&&cm>0?'<span class="pill ok">Received</span>':rc>0?'<span class="pill warn">Part received</span>':'<span class="pill warn">Pledged</span>'}</div>
  <div class="sub">Committed <b>${R(cm)}</b>, received <b>${R(rc)}</b>${out?`, <span class="xo">${R(out)} still to come</span>`:''}${s.ct?', '+esc(s.ct):''}</div>
  <div class="prog" style="height:6px;margin:6px 0"><i style="width:${pc}%"></i></div>
  ${s.pr?`<div class="sub"><b style="color:var(--ink)">Promised:</b> ${esc(s.pr)}</div><label class="sub" style="display:flex;gap:8px;align-items:center;margin:4px 0 0"><input type="checkbox" data-spdl="${esc(s.id)}" ${s.dl?'checked':''}> Promises delivered</label>`:''}</div>
  <div class="act">${out?`<button class="btn ghost sm" data-ic="spr" data-id="${esc(s.id)}">Mark fully received</button>`:''}<button class="btn ghost sm" data-ic="spe" data-id="${esc(s.id)}">Edit</button><button class="btn ghost sm del" data-ic="spd" data-id="${esc(s.id)}">Delete</button></div></div>`;
}
window.incV=function(e){
 if(!can(e,'exp'))return '<div class="empty">You do not have access to this section.</div>';
 const f=figures(e),spn=e.spn||[],tin=f.tIn+f.spIn,exp=f.tDue+f.spOut;
 const surplus=f.full-f.cost;
 const open=V.spa||V.spe;
 const list=spn.slice().sort((a,b)=>(a.at||0)-(b.at||0)).map(s=>V.spe===s.id?spForm(e,s):spRow(e,s)).join('');
 return `<div class="stats"><div class="stat"><b>${R(tin)}</b><span>Received so far</span></div><div class="stat"><b>${R(exp)}</b><span>Still expected</span></div><div class="stat"><b>${R(f.cost)}</b><span>${f.basis==='plan'?'Budget (cost)':'Spent and to pay (cost)'}</span></div><div class="stat"><b class="${surplus<0?'xo':''}" style="${surplus<0?'-webkit-text-fill-color:var(--bad)':''}">${surplus<0?'-':''}${R(Math.abs(surplus))}</b><span>${surplus<0?'Shortfall':'Surplus'} if every seat sells</span></div></div>
 <div class="card"><div class="sh"><h3>Break-even</h3><div class="seg" style="margin:0;min-width:230px" role="group" aria-label="Cost to compare with"><button class="${f.basis==='plan'?'on':''}" data-ic="bas" data-v="plan">Budget</button><button class="${f.basis==='act'?'on':''}" data-ic="bas" data-v="act">Spent + to pay</button></div></div>
  <p class="meta" style="margin:4px 0 0">${R(f.price)} x ${f.cap} seats = ${R(f.tFull)}, plus sponsorship ${R(f.spAll)} = <b>${R(f.full)}</b> against costs of <b>${R(f.cost)}</b>.</p>
  ${breakEven(f)}
  <p class="meta" style="margin:12px 0 0">Attendees paid: ${f.paidN} of ${f.rs.length} registered (${R(f.tIn)} received, ${R(f.tDue)} still to collect).${(()=>{const pc=f.rs.filter(r=>r.paid&&r.pm==='cash').length,pu=f.rs.filter(r=>r.paid&&r.pm==='upi').length;return pc||pu?` Of the paid: ${pc} by cash (${R(pc*f.price)}), ${pu} by UPI (${R(pu*f.price)}).`:''})()}</p></div>
 ${window.cashSummaryV?cashSummaryV(e):''}
 <div class="card"><div class="sh"><h3>Sponsors and other income (${spn.length})</h3>${V.spe?'':`<button class="btn sm" data-ic="spa">${V.spa?'Close form':'+ Add'}</button>`}</div>
  ${V.spa&&!V.spe?spForm(e):''}${list||(open?'':'<p class="meta" style="margin:0">No sponsors yet.</p>')}</div>
 ${window.linksV?linksV(e):''}
 ${exportV(e)}`;
};

/* ================= actions ================= */
document.addEventListener('click',x=>{
 const t=x.target.closest('button[data-ic],button[data-ex]');if(!t)return;
 const E=cur();if(!E||V.tab!=='detail')return;
 if(t.dataset.ex){runExport(E,t.dataset.ex);return}
 if(!can(E,'exp'))return;
 const a=t.dataset.ic,id=t.dataset.id,s=(E.spn||[]).find(z=>z.id===id);
 if(a==='bas'){V.ibs=t.dataset.v;render()}
 else if(a==='spa'){V.spa=!V.spa;V.spe=null;render()}
 else if(a==='spx'){V.spa=false;V.spe=null;render()}
 else if(a==='spe'&&s){V.spe=id;V.spa=false;render()}
 else if(a==='spr'&&s){s.rc=Math.max(+s.rc||0,+s.cm||0);sv();toast('Marked as received')}
 else if(a==='spd'&&s){if(!confirm('Delete "'+s.n+'" from the income list?'))return;E.spn=E.spn.filter(z=>z.id!==id);sv()}
});
document.addEventListener('change',x=>{
 const id=x.target.dataset&&x.target.dataset.spdl;if(!id)return;
 const E=cur(),s=E&&(E.spn||[]).find(z=>z.id===id);
 if(s&&can(E,'exp')){if(x.target.checked)s.dl=1;else delete s.dl;sv()}
});
document.addEventListener('submit',x=>{
 const f=x.target;if(f.id!=='spf')return;
 x.preventDefault();const E=cur();if(!E||!can(E,'exp'))return;
 const fd=new FormData(f),g=k=>(fd.get(k)||'').toString().replace(/\s+/g,' ').trim();
 const n=g('n').slice(0,60);if(!n)return;
 const o={n,k:KINDS.includes(g('k'))?g('k'):'Sponsor',cm:num(g('cm')),rc:num(g('rc')),pr:(fd.get('pr')||'').toString().replace(/\r/g,'').trim().slice(0,500),ct:g('ct').slice(0,100)};
 const id=f.dataset.i;
 if(id){const s=(E.spn||[]).find(z=>z.id===id);if(!s)return;Object.assign(s,o);if(!o.pr)delete s.dl}
 else E.spn.push(Object.assign({id:uid(),at:Date.now(),by:me()},o));
 V.spa=false;V.spe=null;sv();toast(id?'Saved':'Added');
});
})();
