/* CEM 3.6.0: import pre-registered attendees from a CSV, Excel (.xlsx) or OpenDocument (.ods) file. Attendees tab > Import attendees.
   Who: owner, manager, treasurer and team lead (the people who may add and change attendees).
   Flow:  choose a file (or drop it)  ->  the app reads it on the device (sheet.js, nothing is uploaded)  ->  it matches your columns to the registration form
          (you can change every match)  ->  a check shows who will be added and who will be skipped and why  ->  Import.
   Checks:  the name and every required question must be filled in; the same College ID (or, when there is none, the same email or phone) is not added twice,
            neither against attendees already registered nor inside the file; seats are never exceeded (the rest are listed as skipped).
   Skipped rows can be downloaded as a CSV with the reason in the first columns, so nothing is lost and the sheet can be fixed and imported again.
   Imported attendees are marked "Imported" and get a QR ticket like everyone else. Paid / payment mode / collector / UTR columns are read when the ticket has a price. */
(function(){
const $=id=>document.getElementById(id);
const feeOf=e=>Math.max(0,+(e.pay||{}).fee||0);
const norm=s=>String(s==null?'':s).toLowerCase().replace(/[^a-z0-9]/g,'');
const digits=s=>String(s==null?'':s).replace(/\D/g,'');
const YES=/^(y|yes|true|1|paid|done|received|ok|x|\u2713|\u2714)$/i;
const SYN={
 name:['name','fullname','studentname','participantname','attendeename','candidatename'],
 cid:['collegeid','studentid','rollno','rollnumber','roll','enrollment','enrollmentno','enrolmentno','enrolment','registrationno','registrationnumber','regno','idno','id','uid'],
 em:['email','emailid','emailaddress','mail','mailid'],
 ph:['phone','phoneno','phonenumber','mobile','mobileno','mobilenumber','whatsapp','whatsappno','whatsappnumber','contact','contactno','contactnumber'],
 paid:['paid','paymentstatus','feepaid','feestatus','paymentdone','ispaid'],
 pm:['mode','paymentmode','paidvia','paymentmethod','method','paymenttype','paidby'],
 cc:['collector','collectedby','receivedby','paidto','cashier','cashcollector','receiver','cashpaidto'],
 utr:['utr','utrno','utrnumber','transactionid','txnid','upiref','upireference','reference','refno','transactionref']};
const MAXREG=1500;   // the Firestore rules stop at this many attendees per event

/* ---------- what can be filled ---------- */
// extra header names for common questions (abbreviations people really use in sheets)
function labelSyn(l){
 const t=norm(l),o=[];
 if(/department|branch|dept/.test(t))o.push('dept','dep','branch','stream','course');
 if(/year/.test(t))o.push('year','yos','yearofstudy','class','semester','sem');
 if(/team/.test(t))o.push('team','teamname','group');
 if(/event|contest|activit/.test(t))o.push('event','events','contest','activity');
 if(/shirt|size/.test(t))o.push('tshirt','shirtsize','size');
 if(/experience|level/.test(t))o.push('experience','level','skill');
 if(/laptop/.test(t))o.push('laptop','haslaptop');
 return o;
}
function targets(e){
 const fl=e.fields||[],cf=window.cidField&&cidField(e),T=[];
 fl.forEach((f,i)=>T.push({k:'f:'+f.id,label:f.label,req:i===0||!!f.req,f,syn:i===0?SYN.name:(cf&&cf.id===f.id?SYN.cid:labelSyn(f.label))}));
 if(!cf)T.push({k:'cid',label:'College ID',syn:SYN.cid});
 T.push({k:'em',label:'Email',syn:SYN.em},{k:'ph',label:'Phone / WhatsApp',syn:SYN.ph});
 if(feeOf(e)>0){
  T.push({k:'paid',label:'Paid? (yes / no)',syn:SYN.paid},{k:'pm',label:'Payment mode (cash / UPI)',syn:SYN.pm});
  if((window.cashiersOf?cashiersOf(e):[]).length)T.push({k:'cc',label:'Cash collected by',syn:SYN.cc});
  T.push({k:'utr',label:'UTR / reference',syn:SYN.utr});
 }
 return T;
}
function guess(T,head){
 const H=head.map(norm),used=new Set(),map={};
 const claim=(t,test)=>{if(map[t.k]!==undefined)return;const i=H.findIndex((h,j)=>h&&!used.has(j)&&test(h));if(i>=0){map[t.k]=i;used.add(i)}};
 T.forEach(t=>{const n=[norm(t.label)].concat(t.syn||[]);claim(t,h=>n.indexOf(h)>=0)});
 T.forEach(t=>{const n=[norm(t.label)].concat(t.syn||[]).filter(x=>x.length>=4);claim(t,h=>n.some(x=>h.indexOf(x)>=0||(h.length>=4&&x.indexOf(h)>=0)))});
 T.forEach(t=>{if(map[t.k]===undefined)map[t.k]=-1});
 return map;
}
const colName=i=>{let s='',n=i+1;while(n>0){const m=(n-1)%26;s=String.fromCharCode(65+m)+s;n=Math.floor((n-1)/26)}return s};

/* ---------- turn the rows into attendees ---------- */
function convert(f,v){
 v=String(v==null?'':v).replace(/\s+/g,' ').trim();
 if(f.type==='checkbox')return YES.test(v)?'Yes':'No';
 if(f.type==='select'&&v){const o=String(f.opts||'').split(',').map(x=>x.trim()).find(x=>x.toLowerCase()===v.toLowerCase());return o||v.slice(0,200)}
 return v.slice(0,200);
}
function plan(e,st){
 const sh=st.sheets[st.si],T=targets(e),map=st.map,start=st.hdr?1:0,fee=feeOf(e),cs=window.cashiersOf?cashiersOf(e):[];
 const get=(r,k)=>{const i=map[k];return i>=0&&i!==undefined?(r[i]||''):''};
 const cf=window.cidField&&cidField(e),regs=regsOf(e.id),have=new Set(),inFile=new Set(),ready=[],skipped=[],W={badEmail:0,badPhone:0,badCollector:0,badMode:0};
 regs.forEach(r=>{const c=window.regCid?regCid(e,r):r.cid;if(c)have.add('c:'+c);if(r.em)have.add('e:'+String(r.em).toLowerCase());const p=digits(r.ph).slice(-10);if(p.length>=7)have.add('p:'+p)});
 const limit=Math.min(+e.cap||0,MAXREG);let room=Math.max(0,limit-regs.length),n=0;
 const emF=(e.fields||[]).find(f=>f.type!=='checkbox'&&/e-?mail/i.test(f.label)),phF=(e.fields||[]).find(f=>f.type!=='checkbox'&&/phone|mobile|whatsapp/i.test(f.label));
 for(let i=start;i<sh.rows.length;i++){
  const row=sh.rows[i],num=sh.nums[i];n++;
  const skip=why=>skipped.push({n:num,reason:why,cells:row});
  const data={};(e.fields||[]).forEach(f=>{data[f.id]=convert(f,get(row,'f:'+f.id))});
  const first=(e.fields||[])[0],name=String(first?data[first.id]:'').trim();
  if(!name){skip('Name is empty');continue}
  const miss=(e.fields||[]).find(f=>f.req&&f.type!=='checkbox'&&!String(data[f.id]).trim());
  if(miss){skip('Missing: '+miss.label);continue}
  const cid=window.normId?normId(cf?data[cf.id]:get(row,'cid')):'';
  let em=String(get(row,'em')||(emF?data[emF.id]:'')).trim(),ph=String(get(row,'ph')||(phF?data[phF.id]:'')).replace(/[^\d+]/g,'').slice(0,20);
  if(em&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)){em='';W.badEmail++}
  if(ph&&digits(ph).length<7){ph='';W.badPhone++}
  const key=cid?'c:'+cid:em?'e:'+em.toLowerCase():ph?'p:'+digits(ph).slice(-10):'';
  if(key){
   if(have.has(key)){skip('Already registered ('+(cid?'College ID '+cid:em||ph)+')');continue}
   if(inFile.has(key)){skip('Appears twice in the file ('+(cid?'College ID '+cid:em||ph)+')');continue}
  }
  if(room<=0){skip(limit<(+e.cap||0)?'Limit of '+MAXREG+' attendees per event':'Event is full ('+e.cap+' seats)');continue}
  if(key)inFile.add(key);room--;
  const r={id:rid(),   // the secure 12-character id from index.html: it is the secret inside the QR ticket
  eid:e.id,data,name:name.slice(0,80),in:false,at:Date.now(),src:'import',by:window.MYUID||''};
  if(cid)r.cid=cid;if(em)r.em=em.slice(0,100);if(ph)r.ph=ph;
  if(fee>0){
   const pmv=String(get(row,'pm')).toLowerCase();
   if(pmv){if(/cash/.test(pmv))r.pm='cash';else if(/upi|gpay|google|phonepe|paytm|bhim|online|qr/.test(pmv))r.pm='upi';else W.badMode++}
   const cv=String(get(row,'cc')).trim().toLowerCase();
   if(cv&&r.pm!=='upi'){
    let c=cs.find(x=>x.n.toLowerCase()===cv);if(!c){const m=cs.filter(x=>x.n.toLowerCase().indexOf(cv)>=0||cv.indexOf(x.n.toLowerCase())>=0);if(m.length===1)c=m[0]}
    if(c){r.cc=c.id;r.cn=c.n;if(!r.pm)r.pm='cash'}else W.badCollector++;
   }
   const u=window.normId?normId(get(row,'utr')):'';if(u.length>=6){r.utr=u;if(!r.pm)r.pm='upi'}
   if(map.paid>=0?YES.test(String(get(row,'paid')).trim()):!!st.allPaid){r.paid=true;r.pt=Date.now()}
  }
  ready.push(r);
 }
 return{ready,skipped,W,n,room};
}

/* ---------- the card ---------- */
const ACCEPT='.csv,.tsv,.txt,.xlsx,.xlsm,.ods,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.oasis.opendocument.spreadsheet';
function pick(e,err){
 return `<div class="sh"><h3>Import pre-registered attendees</h3></div>
  ${err?`<div class="note" role="alert" style="margin-bottom:10px">${esc(err)}</div>`:''}
  <div class="row"><button class="btn" data-im="pick">Choose spreadsheet</button><button class="btn ghost" data-im="tpl">Download blank template</button></div>
  <input type="file" id="impf" accept="${ACCEPT}" hidden aria-label="Spreadsheet file">`;
}
function mapUI(e,st){
 const sh=st.sheets[st.si],T=targets(e),hdr=st.hdr,head=hdr?sh.rows[0]||[]:[],ncol=Math.max.apply(null,sh.rows.slice(0,50).map(r=>r.length).concat([1]));
 const cols=Array.from({length:ncol},(_,i)=>({i,t:(hdr&&head[i])?colName(i)+': '+head[i]:'Column '+colName(i)}));
 const first=sh.rows.slice(hdr?1:0,(hdr?1:0)+5);
 const smp=k=>{const i=st.map[k];if(i==null||i<0)return '';const v=first.map(r=>r[i]).filter(Boolean).slice(0,2).join(' | ');return v?'e.g. '+esc(v.slice(0,50)):''};
 const p=plan(e,st),fee=feeOf(e);
 const rows=T.map(t=>`<div class="li"><div class="main"><div class="ttl">${esc(t.label)}${t.req?' *':''}</div><div class="sub">${smp(t.k)||'&nbsp;'}</div></div>
  <select class="sel-s" style="max-width:230px" data-imc="${esc(t.k)}" aria-label="Column for ${esc(t.label)}"><option value="-1">Not in my file</option>${cols.map(c=>`<option value="${c.i}" ${st.map[t.k]===c.i?'selected':''}>${esc(c.t.slice(0,40))}</option>`).join('')}</select></div>`).join('');
 const reasons={};p.skipped.forEach(s=>{const k=s.reason.replace(/\(.*\)/,'').trim();reasons[k]=(reasons[k]||0)+1});
 const W=p.W,warn=[W.badEmail?W.badEmail+' email(s) not valid, left empty':'',W.badPhone?W.badPhone+' phone number(s) too short, left empty':'',W.badCollector?W.badCollector+' collector name(s) not on your cash collectors list, ignored':'',W.badMode?W.badMode+' payment mode(s) not understood, ignored':''].filter(Boolean);
 return `<div class="sh"><h3>Import: ${esc(st.name)}</h3><button class="btn ghost sm" data-im="x">Cancel</button></div>
  <p class="meta" style="margin:0 0 8px">${p.n} row${p.n===1?'':'s'} found${st.sheets.length>1?'':' in the file'}.</p>
  <div class="row" style="margin-bottom:6px">${st.sheets.length>1?`<label style="margin:0" for="ims">Sheet</label><select id="ims" class="sel-s">${st.sheets.map((s,i)=>`<option value="${i}" ${i===st.si?'selected':''}>${esc(s.name)} (${s.rows.length} rows)</option>`).join('')}</select>`:''}
   <label style="margin:0;font-weight:400"><input type="checkbox" id="imh" ${hdr?'checked':''}> First row has column names</label></div>
  ${rows}
  ${fee>0&&!(st.map.paid>=0)?`<label style="margin:10px 0 0;font-weight:400"><input type="checkbox" id="imp" ${st.allPaid?'checked':''}> These attendees have already paid the ticket fee (₹${fee})</label>`:''}
  <div class="${p.ready.length?'scres ok':'scres warn'}" style="margin-top:12px" role="status"><b>${p.ready.length} ready to import</b>${p.skipped.length?`${p.skipped.length} will be skipped: ${Object.keys(reasons).map(k=>esc(k)+' ('+reasons[k]+')').join(', ')}.`:'No problems found.'}${warn.length?`<br>${esc(warn.join('; '))}.`:''}</div>
  <div class="acts row" style="margin-top:10px"><button class="btn" data-im="go" ${p.ready.length?'':'disabled'}>Import ${p.ready.length} attendee${p.ready.length===1?'':'s'}</button>${p.skipped.length?'<button class="btn ghost" data-im="skip">Download skipped rows</button>':''}<button class="btn ghost" data-im="x">Cancel</button></div>`;
}
function doneUI(st){
 const d=st.done;
 return `<div class="sh"><h3>Import finished</h3></div>
  <div class="scres ok" role="status"><b>${d.n} attendee${d.n===1?'':'s'} imported</b>${d.skipped.length?d.skipped.length+' row'+(d.skipped.length===1?'':'s')+' skipped.':'Nothing was skipped.'} Open an attendee's ... menu for the QR ticket.</div>
  <div class="row" style="margin-top:10px">${d.skipped.length?'<button class="btn" data-im="skip">Download skipped rows</button>':''}<button class="btn ghost" data-im="again">Import another file</button><button class="btn ghost" data-im="x">Close</button></div>`;
}
function inner(e){
 const st=V.imp;
 if(!st)return pick(e,'');
 if(st.err&&!st.sheets)return pick(e,st.err);
 return st.done?doneUI(st):mapUI(e,st);
}
window.importV=function(e){
 if(!window.can||!can(e,'regs'))return '';
 return `<div class="card" id="impc">${inner(e)}</div>`;
};
const redraw=()=>{const E=cur(),c=$('impc');if(E&&c)c.innerHTML=inner(E)};

/* ---------- actions ---------- */
async function load(file){
 const E=cur();if(!E||!can(E,'regs'))return;
 const c=$('impc');if(c)c.innerHTML='<p class="meta" style="margin:0">Reading '+esc(file.name)+'...</p>';
 try{
  if(!window.CEMSheet)throw new Error('The spreadsheet reader did not load. Reload the app.');
  const r=await CEMSheet.read(file);
  const sheets=r.sheets.filter(s=>s.rows.length);
  if(!sheets.length)throw new Error('No rows found in this file.');
  if(sheets.every(s=>s.rows.length<2))throw new Error('This file has only one row. It needs a header row and at least one attendee.');
  const si=Math.max(0,sheets.findIndex(s=>s.rows.length>1));
  V.imp={name:file.name,kind:r.kind,sheets,si,hdr:true,allPaid:false,map:guess(targets(E),sheets[si].rows[0]||[])};
 }catch(x){V.imp={err:(x&&x.message)||String(x)}}
 redraw();
}
function skippedCsv(E,st){
 const d=st.done||{},sk=d.skipped||plan(E,st).skipped,sh=st.sheets[st.si],hdr=st.hdr?(sh.rows[0]||[]):[];
 const ncol=Math.max.apply(null,sk.map(s=>s.cells.length).concat([hdr.length,1]));
 const head=['Row in file','Why skipped'].concat(Array.from({length:ncol},(_,i)=>hdr[i]||'Column '+colName(i)));
 return window.cemCsv(head,sk.map(s=>[s.n,s.reason].concat(s.cells)));
}
const slug=s=>String(s||'event').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)||'event';
document.addEventListener('click',x=>{
 const t=x.target.closest('button[data-im]');if(!t)return;
 const E=cur();if(!E||V.tab!=='detail'||!can(E,'regs'))return;
 const a=t.dataset.im,st=V.imp;
 if(a==='pick'||a==='again'){if(a==='again'){V.imp=null;redraw()}const f=$('impf');if(f){f.value='';f.click()}}
 else if(a==='x'){V.imp=null;redraw()}
 else if(a==='tpl'){
  const head=targets(E).map(q=>q.label);
  window.cemSave&&cemSave(slug(E.name)+'-attendee-template.csv','text/csv;charset=utf-8',cemCsv(head,[]));
 }
 else if(a==='skip'&&st){window.cemSave&&cemSave(slug(E.name)+'-skipped-rows.csv','text/csv;charset=utf-8',skippedCsv(E,st))}
 else if(a==='go'&&st&&st.sheets&&!st.done){
  const p=plan(E,st);if(!p.ready.length)return;
  if(regsOf(E.id).length+p.ready.length>(+E.cap||0))return toast('Not enough seats');
  p.ready.forEach(r=>S.regs.push(r));
  st.done={n:p.ready.length,skipped:p.skipped};
  sv();toast(p.ready.length+' attendee'+(p.ready.length===1?'':'s')+' imported');
 }
});
document.addEventListener('change',x=>{
 const t=x.target;if(!t||V.tab!=='detail')return;
 if(t.id==='impf'){const E=cur();if(E&&can(E,'regs')&&t.files&&t.files[0])load(t.files[0]);return}
 const st=V.imp,E=cur();if(!st||!st.sheets||!E||!can(E,'regs'))return;
 if(t.dataset&&t.dataset.imc){st.map[t.dataset.imc]=+t.value;redraw()}
 else if(t.id==='imh'){st.hdr=t.checked;const T=targets(E);st.map=st.hdr?guess(T,st.sheets[st.si].rows[0]||[]):Object.fromEntries(T.map(q=>[q.k,-1]));redraw()}
 else if(t.id==='ims'){st.si=+t.value;st.map=guess(targets(E),st.hdr?(st.sheets[st.si].rows[0]||[]):[]);redraw()}
 else if(t.id==='imp'){st.allPaid=t.checked;redraw()}
});
// drop a file on the card
document.addEventListener('dragover',x=>{if(x.target.closest&&x.target.closest('#impc')){x.preventDefault()}});
document.addEventListener('drop',x=>{
 const c=x.target.closest&&x.target.closest('#impc');if(!c)return;x.preventDefault();
 const f=x.dataTransfer&&x.dataTransfer.files&&x.dataTransfer.files[0];if(f)load(f);
});
})();
