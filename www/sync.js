(function(){
const C=window.FB_CONFIG||{};
const ready=!!(window.firebase&&C.apiKey&&!/YOUR_/.test(C.apiKey));
const LS=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))||d}catch(e){return d}};
let P=Object.assign({tasks:1,people:1,money:1,event:1,chat:1,mention:1,ntfy:0},LS('campus-prefs',{}));
let N=LS('campus-notes',[]);
let U=null,db,unsub,applying=false;const sent={},owners={};
// 3.5.0: the event document keeps KEYS. The money data (FINK) lives in events/{id}/fin/data, which only owner, manager and treasurer can read or write.
//   bud=budget lines, ven=vendors, exp=vendor bills, payments=earlier payments, don=donations, spn=sponsors and other income.
// MAPK fields are stored one entry per field (forms.<id>, itm.<id>, regs.<id>, croles.<id>) so two people never overwrite each other. 3.6.1: croles = custom roles (written by organizer and manager only).
const KEYS=['info','team','groups','tasks','teams','pay','regs','forms','itm','croles'],FINK=['don','bud','ven','exp','payments','spn'],MAPK=['forms','itm','regs','croles'],ALLK=KEYS.concat(FINK),LEGACY=['bud','ven','exp','payments','don'];
const arr=o=>Array.isArray(o)?o:Object.values(o||{}).sort((a,b)=>(a.at||0)-(b.at||0));
const toMap=a=>Object.fromEntries((a||[]).map((x,i)=>[x.id||('i'+i),x]));
const withIds=(a,p)=>arr(a).map((x,i)=>x&&x.id?x:Object.assign({id:p+i},x));
const nest=o=>{const r={};Object.keys(o).forEach(k=>{const q=k.split('.');let c=r;q.slice(0,-1).forEach(z=>{c=c[z]=c[z]||{}});c[q[q.length-1]]=o[k]});return r};
const legacyRegs={},finUn={},finLoaded={},migrated={};
const clean=o=>JSON.parse(JSON.stringify(o));
const me=()=>((U&&(U.displayName||U.email.split('@')[0]))||'').toLowerCase();
const err=x=>toast(x.code==='permission-denied'?'No permission. Check the Firestore rules.':'Sync problem: '+(x.message||x.code));
const persist=()=>{try{localStorage.setItem('campus-events-v1',JSON.stringify(S))}catch(e){}};

// v3.1.0: a payment link works until the end of the event day (+ optional extra days set in Payments).
window.untilOf=e=>{const t=new Date((e.date||'')+'T23:59:59.999').getTime();return (isNaN(t)?Date.now()+864e5:t)+Math.max(0,Math.min(30,+((e.pay||{}).grace)||0))*864e5};

const st=document.createElement('style');
st.textContent='#tp{position:fixed;right:10px;top:calc(60px + env(safe-area-inset-top,0px));width:min(360px,94vw);max-height:78vh;overflow:auto;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px;z-index:20;box-shadow:0 8px 30px rgba(0,0,0,.25)}#au{position:fixed;inset:0;z-index:30}#au{display:grid;grid-template-columns:1.15fr 1fr;color:#fff;overflow:auto;background:radial-gradient(900px 520px at 0% 0%,rgba(89,72,245,.42),transparent 62%),#10172b}#au .hero{padding:8vh 6vw;display:flex;flex-direction:column;justify-content:center;gap:16px}#au .brand{display:flex;align-items:center;gap:12px;font:800 22px Poppins,system-ui,sans-serif}#au h1{font-size:clamp(30px,4.4vw,52px);line-height:1.05}#au .hero p{color:#c6c9e0;max-width:46ch;margin:0}#au ul{list-style:none;padding:0;margin:8px 0 0;display:grid;gap:10px}#au li{color:#e6e8f5;padding-left:26px;position:relative}#au li:before{content:"";position:absolute;left:0;top:6px;width:12px;height:12px;border-radius:50%;background:#ffb547}#au .pane{display:flex;align-items:center;justify-content:center;padding:20px}#au .glass{width:min(400px,100%);background:var(--card);color:var(--ink);border-radius:20px;padding:26px;box-shadow:0 24px 70px rgba(0,0,0,.45)}#au .seg{display:grid;grid-template-columns:1fr 1fr;background:var(--bg);border-radius:10px;padding:4px;margin:14px 0 6px}#au .seg button{border:0;background:none;color:var(--mute);font:inherit;font-weight:700;padding:8px;border-radius:8px;cursor:pointer}#au .seg button.on{background:var(--card);color:var(--ink);box-shadow:0 1px 4px rgba(0,0,0,.2)}#au .go{width:100%;padding:12px;background:#5948f5;color:#fff;border-radius:10px}@media(max-width:760px){#au{grid-template-columns:1fr}#au .hero{padding:28px 22px 6px}#au ul,#au .hero p{display:none}}.hid{display:none!important}';
document.head.append(st);

// ---------- notifications ----------
function ping(title,body){
 const LN=window.Capacitor&&Capacitor.Plugins&&Capacitor.Plugins.LocalNotifications;
 if(LN){LN.schedule({notifications:[{id:Date.now()%2147483000,title,body}]}).catch(()=>{})}
 else if('Notification' in window&&Notification.permission==='granted'){try{new Notification(title,{body})}catch(e){}}
}
function askPerm(){
 const LN=window.Capacitor&&Capacitor.Plugins&&Capacitor.Plugins.LocalNotifications;
 if(LN)LN.requestPermissions().catch(()=>{});else if('Notification' in window&&Notification.permission==='default')Notification.requestPermission();
}
function notify(list){
 const shown=list.filter(m=>P[m.cat]);
 if(!shown.length)return;
 shown.forEach(m=>N.unshift({t:Date.now(),text:m.n+': '+m.text}));
 N=N.slice(0,50);localStorage.setItem('campus-notes',JSON.stringify(N));badge();
 const hi=shown.filter(m=>m.me);
 if(shown.length>3&&!hi.length)ping('Campus Events',shown.length+' updates in your events');
 else shown.forEach(m=>ping(m.me?'For you':m.n,m.me?m.text:m.text));
 toast(shown.length===1?shown[0].text:shown.length+' new updates');
}
function snapOf(e){
 const o={info:{name:e.name,type:e.type,date:e.date,time:e.time,venue:e.venue,cap:e.cap,desc:e.desc,fields:e.fields},
  team:e.team||[],groups:e.groups||[],tasks:e.tasks||[],teams:e.teams||[],don:e.don||[],pay:e.pay||{upi:'',payee:'',fee:0},
  regs:S.regs.filter(r=>r.eid===e.id).map(r=>{const c=Object.assign({},r);delete c.eid;return c}),   // 3.5.0: no eid inside the stored entry
  forms:e.forms||[],payments:e.payments||[],bud:e.bud||[],ven:e.ven||[],exp:e.exp||[],itm:e.itm||[],spn:e.spn||[],croles:e.croles||[],members:e.members||{}};
 return clean(o);
}
const parts=e=>{const o=snapOf(e),r={};ALLK.forEach(k=>r[k]=JSON.stringify(o[k]));return r};
const finParts=e=>{const o=snapOf(e),r={};FINK.forEach(k=>r[k]=JSON.stringify(o[k]));return r};
function diff(o,n,who){
 const out=[],added=(a,b)=>b.filter(x=>!a.some(y=>y.id===x.id));
 const nm=id=>((n.team.find(m=>m.id===id)||{}).n||'').toLowerCase();
 const nr=added(o.regs,n.regs);
 if(nr.length)out.push({cat:'people',text:nr.length+' new registration'+(nr.length>1?'s':'')+': '+nr.slice(0,3).map(r=>r.name).join(', ')});
 added(o.tasks,n.tasks).forEach(t=>{const mine=t.who===window.MYUID||(who&&nm(t.who)===who);out.push({cat:'tasks',me:mine,text:(mine?'Task assigned to you: ':'New task: ')+t.t})});
 n.tasks.forEach(t=>{const p=o.tasks.find(y=>y.id===t.id);if(!p)return;
  if(t.done&&!p.done)out.push({cat:'tasks',text:'Task done: '+t.t});
  if(t.who!==p.who&&(t.who===window.MYUID||(who&&nm(t.who)===who)))out.push({cat:'tasks',me:true,text:'Task assigned to you: '+t.t})});
 added(o.groups,n.groups).forEach(g=>out.push({cat:'tasks',text:'New task group: '+g.n}));
 added(o.team,n.team).forEach(m=>out.push({cat:'people',text:m.n+' joined the core team as '+m.r}));
 added(o.teams,n.teams).forEach(t=>out.push({cat:'people',text:'New team: '+t.n}));
 added(o.don,n.don).forEach(x=>out.push({cat:'money',text:'Donation of ₹'+x.a+' from '+x.n}));
 const np=n.regs.filter(r=>{const p=o.regs.find(y=>y.id===r.id);return p&&r.paid&&!p.paid}).length;
 if(np)out.push({cat:'money',text:np+' fee payment'+(np>1?'s':'')+' recorded'});
 const om=o.members||{},nmem=n.members||{};
 Object.keys(nmem).filter(k=>!om[k]).forEach(k=>out.push({cat:'people',text:nmem[k].name+' joined the event'}));
 Object.keys(nmem).forEach(k=>{if(om[k]&&om[k].role!==nmem[k].role&&k===window.MYUID)out.push({cat:'people',me:true,text:'Your role is now '+(window.roleLabel?roleLabel({croles:n.croles||[]},nmem[k].role):nmem[k].role)})});
 added(o.payments||[],n.payments||[]).forEach(p=>out.push({cat:'money',text:'Payment of ₹'+p.a+' from '+p.n+' submitted'}));
 const mineItem=i=>i.who&&(i.who===window.MYUID||(who&&nm(i.who)===who));   // 3.1.0: items to buy assigned to you
 added(o.itm||[],n.itm||[]).forEach(i=>{if(mineItem(i))out.push({cat:'tasks',me:true,text:'Item to buy assigned to you: '+i.t})});
 (n.itm||[]).forEach(i=>{const p=(o.itm||[]).find(y=>y.id===i.id);if(p&&i.who!==p.who&&mineItem(i))out.push({cat:'tasks',me:true,text:'Item to buy assigned to you: '+i.t})});
 const a=o.info,b=n.info;
 if(a.name!==b.name||a.date!==b.date||a.time!==b.time||a.venue!==b.venue)out.push({cat:'event',text:'Event details changed'});
 return out;
}
const badge=()=>{const b=document.getElementById('tb');if(b)b.textContent=N.length?'('+N.length+')':''};

window.notify=notify;   // used by chat.js
// ---------- apply remote data ----------
function apply(id,d){
 let e=S.events.find(x=>x.id===id);const old=e?snapOf(e):null;
 if(!e){e={id};S.events.push(e)}
 Object.assign(e,d.info||{},{team:d.team||[],groups:d.groups||[],tasks:d.tasks||[],teams:d.teams||[],
  pay:d.pay||{upi:'',payee:'',fee:0},forms:arr(d.forms),itm:arr(d.itm),croles:arr(d.croles),cloud:1,owner:d.owner,ntfy:d.ntfy||'',members:d.members||{}});
 // 3.5.0: money data comes from events/{id}/fin/data (see watchFin). Events not yet converted still carry it here; staff see it until the one-time conversion runs.
 FINK.forEach(k=>{if(!Array.isArray(e[k]))e[k]=[]});
 let lg=0;if(!finLoaded[id]&&window.can&&can(e,'exp'))FINK.forEach(k=>{if(d[k]!==undefined){e[k]=withIds(d[k],k[0]);lg=1}});
 legacyRegs[id]=Array.isArray(d.regs);
 S.regs=S.regs.filter(r=>r.eid!==id).concat(arr(d.regs).filter(r=>r&&r.name).map(r=>Object.assign({},r,{eid:id})));   // an entry without a name is a stray field write for an attendee that was deleted
 const prev=sent[id];owners[id]=d.owner;sent[id]=parts(e);
 if(prev&&!lg)FINK.forEach(k=>{sent[id][k]=prev[k]});   // money data is not in this snapshot: keep what was last confirmed so an unsent local edit is still sent
 return old;
}
// ---------- money data (3.5.0): events/{id}/fin/data, staff only ----------
function watchFin(){
 if(!U||!window.can)return;
 const want={};S.events.filter(e=>e.cloud&&can(e,'exp')).forEach(e=>want[e.id]=1);
 Object.keys(finUn).forEach(id=>{if(!want[id]){finUn[id]();delete finUn[id];delete finLoaded[id]}});
 Object.keys(want).forEach(id=>{
  if(finUn[id])return;
  finUn[id]=db.collection('events').doc(id).collection('fin').doc('data').onSnapshot(sn=>{
   const E=S.events.find(x=>x.id===id);if(!E)return;
   if(sn.exists){const d=sn.data();FINK.forEach(k=>{E[k]=arr(d[k])});finLoaded[id]=1}
   if(sent[id])Object.assign(sent[id],finParts(E));
   persist();render();
  },x=>{if(x.code!=='permission-denied')err(x)});
 });
}
const dropFin=()=>{Object.keys(finUn).forEach(i=>{finUn[i]();delete finUn[i]});Object.keys(finLoaded).forEach(i=>delete finLoaded[i])};
// One-time conversion of an event made before 3.5.0. Money data is copied to the staff-only document (nothing is overwritten) and then
// removed from the event document; the attendee array becomes one entry per attendee. Safe to repeat: it does nothing once converted.
async function migrate(id,d){
 if(migrated[id]||!U)return;
 const E=S.events.find(x=>x.id===id);if(!E)return;
 const leg=LEGACY.filter(k=>d[k]!==undefined),rg=Array.isArray(d.regs);
 if(!leg.length&&!rg)return;
 migrated[id]=1;
 const ref=db.collection('events').doc(id),fref=ref.collection('fin').doc('data');
 try{
  if(leg.length&&can(E,'exp')){
   const fs=await fref.get({source:'server'}),have=fs.exists?fs.data():{},add={};
   leg.forEach(k=>{const m=toMap(withIds(d[k],k[0])),h=have[k]||{},x={};Object.keys(m).forEach(i=>{if(!(i in h))x[i]=m[i]});if(Object.keys(x).length)add[k]=x});
   if(Object.keys(add).length)await fref.set(add,{merge:true});
   if(can(E,'event')){const del={};leg.forEach(k=>del[k]=firebase.firestore.FieldValue.delete());await ref.update(del)}
  }
  if(rg&&can(E,'event'))await ref.update({regs:toMap(withIds(d.regs,'r').filter(r=>r&&r.name).map(r=>{const c=Object.assign({},r);delete c.eid;return c}))});
 }catch(x){migrated[id]=0;if(x.code!=='permission-denied')err(x)}
}
async function purgeSubs(ref){
 // 3.6.0: give the custom link name back (regslugs/{name}) before the page document that remembers it is deleted
 try{const pg=await ref.get({source:'server'}),sl=pg.exists&&pg.data().slug;if(sl)await db.collection('regslugs').doc(sl).delete()}
 catch(x){if(x.code!=='permission-denied'&&x.code!=='not-found')throw x}
 try{for(let i=0;i<200;i++){const sn=await ref.collection('subs').limit(400).get({source:'server'});if(sn.empty)break;const b=db.batch();sn.docs.forEach(d=>b.delete(d.ref));await b.commit()}}
 catch(x){if(x.code!=='permission-denied')throw x}
 await ref.delete().catch(x=>{if(x.code!=='permission-denied'&&x.code!=='not-found')throw x});
}
// Deleting an event also deletes its money document and its public registration page with the applications.
const purgeExtras=id=>db.collection('events').doc(id).collection('fin').doc('data').delete().catch(x=>{if(x.code!=='permission-denied'&&x.code!=='not-found')throw x})
 .then(()=>purgeSubs(db.collection('regpages').doc(id)));
function listen(){
 if(unsub)unsub();let first=true;
 unsub=db.collection('events').where('memberIds','array-contains',U.uid).onSnapshot(snap=>{
  const msgs=[];
  snap.docChanges().forEach(c=>{
   const id=c.doc.id,d=c.doc.data();
   if(c.type==='removed'){delete sent[id];delete legacyRegs[id];if(finUn[id]){finUn[id]();delete finUn[id]}S.events=S.events.filter(e=>e.id!==id);S.regs=S.regs.filter(r=>r.eid!==id);window.chatDrop&&chatDrop(id);return}
   const old=apply(id,d);migrate(id,d);
   if(old&&!first&&!c.doc.metadata.hasPendingWrites)diff(old,snapOf(S.events.find(e=>e.id===id)),me()).forEach(m=>msgs.push(Object.assign(m,{n:d.info.name})));
  });
  first=false;persist();render();watchSubs();watchFin();window.regWatch&&regWatch();fixForms();window.chatSync&&chatSync();if(msgs.length)notify(msgs);
 },err);
}

// ---------- push local changes ----------
let tm;
window.onSave=()=>{if(!U)return;clearTimeout(tm);tm=setTimeout(()=>{flush();watchSubs()},500)};
function flush(){
 Object.keys(sent).forEach(id=>{
  if(S.events.some(e=>e.id===id))return;
  const ref=db.collection('events').doc(id),old=sent[id];delete sent[id];
  if(owners[id]===U.uid){   // chat messages and payment links (with their submissions) go first, then the event; on failure the event comes back
   let fids=[];try{fids=JSON.parse(old.forms).map(f=>f.id)}catch(x){}
   (window.chatPurge?chatPurge(id):Promise.resolve()).then(()=>purgeForms(fids)).then(()=>purgeExtras(id)).then(()=>ref.delete()).catch(x=>{err(x);listen()});
  }
  else ref.update({['members.'+U.uid]:firebase.firestore.FieldValue.delete(),memberIds:firebase.firestore.FieldValue.arrayRemove(U.uid)}).catch(err);
 });
 S.events.filter(e=>e.cloud&&sent[e.id]).forEach(e=>{
  const cur=parts(e),old=sent[e.id],upd={},fu={},staff=can(e,'exp');
  ALLK.forEach(k=>{
   if(cur[k]===old[k])return;
   const fin=FINK.includes(k);
   if(fin&&!staff){cur[k]=old[k];return}                          // only owner, manager and treasurer write money data
   if(k==='regs'&&legacyRegs[e.id]){cur[k]=old[k];return}         // wait for the one-time conversion to one entry per attendee
   const tgt=fin?fu:upd;
   if(fin||MAPK.includes(k)){
    const a=toMap(JSON.parse(old[k])),b=toMap(JSON.parse(cur[k])),same=(x,y)=>JSON.stringify(x)===JSON.stringify(y);
    for(const i in b){
     if(same(b[i],a[i]))continue;
     if(k==='regs'&&a[i]&&typeof a[i]==='object'){   // 3.5.0: only the fields that changed, so a check-in and a "paid" tick on the same attendee both survive
      for(const f in b[i])if(!same(b[i][f],a[i][f]))tgt[k+'.'+i+'.'+f]=b[i][f];
      for(const f in a[i])if(!(f in b[i]))tgt[k+'.'+i+'.'+f]=firebase.firestore.FieldValue.delete();
     }else tgt[k+'.'+i]=b[i];
    }
    for(const i in a)if(!(i in b))tgt[k+'.'+i]=firebase.firestore.FieldValue.delete();
   }else tgt[k]=JSON.parse(cur[k]);
  });
  if(!Object.keys(upd).length&&!Object.keys(fu).length){sent[e.id]=cur;return}
  if(upd.info||upd.pay)(e.forms||[]).forEach(f=>db.collection('payforms').doc(f.id).update({until:untilOf(e),evName:e.name}).catch(()=>{}));   // event date or "keep open" days changed
  if(P.ntfy&&e.ntfy){
   const o={};ALLK.forEach(k=>o[k]=JSON.parse(old[k]));
   const nn=snapOf(e);o.members=nn.members;const msg=diff(o,nn,'').map(m=>m.text).join('; ');
   if(msg)fetch('https://ntfy.sh/'+e.ntfy,{method:'POST',body:e.name+' - '+msg}).catch(()=>{});
  }
  sent[e.id]=cur;
  if(Object.keys(upd).length)db.collection('events').doc(e.id).update(upd).catch(err);
  if(Object.keys(fu).length)db.collection('events').doc(e.id).collection('fin').doc('data').set(nest(fu),{merge:true}).catch(err);
  window.regPubSync&&regPubSync(e);   // seats taken / form questions changed: refresh the public registration page
 });
}

// ---------- change your name (v3.1.0) ----------
async function rename(raw){
 const nm=(raw||'').replace(/\s+/g,' ').trim();
 if(nm.length<2||nm.length>40)return toast('Use 2 to 40 characters for your name');
 if(nm===(U.displayName||''))return toast('That is already your name');
 try{
  await U.updateProfile({displayName:nm});
  window.MYNAME=nm;
  const mine=S.events.filter(e=>e.cloud&&e.members&&e.members[U.uid]);
  if(mine.length){const b=db.batch();mine.forEach(e=>{e.members[U.uid].name=nm;b.update(db.collection('events').doc(e.id),{['members.'+U.uid+'.name']:nm})});await b.commit()}
  persist();render();panel();toast('Name changed to '+nm);
 }catch(x){err(x)}
}

// ---------- share and join ----------
const rnd=n=>Array.from({length:n},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random()*24)]).join('');
window.shareBar=e=>{
 if(!ready||!U)return '';
 if(e.cloud)return `<p class="meta">Event code: <b>${esc(e.id)}</b>, ${Object.keys(e.members||{}).length} member(s). <button class="btn ghost sm" data-copy="${esc(e.id)}">Copy code</button><br>ntfy topic: ntfy.sh/${esc(e.ntfy||'')}</p>`;
 return `<p><button class="btn sm" data-share="${e.id}">Share with team</button></p>`;
};
async function share(id){
 const e=S.events.find(x=>x.id===id);if(!e)return;
 let code;for(let i=0;i<5;i++){code=rnd(6);const g=await db.collection('events').doc(code).get().catch(()=>null);if(g&&!g.exists)break}
 const regs=S.regs.filter(r=>r.eid===id);
 S.regs.forEach(r=>{if(r.eid===id)r.eid=code});
 e.id=code;e.cloud=1;e.owner=U.uid;e.ntfy='campus-'+code+'-'+rnd(8).toLowerCase();e.members={[U.uid]:{name:U.displayName||U.email,role:'owner'}};
 const o=snapOf(e),fin={};FINK.forEach(k=>{fin[k]=toMap(o[k]);delete o[k]});['forms','itm','regs','croles'].forEach(k=>{o[k]=toMap(o[k])});
 try{await db.collection('events').doc(code).set(Object.assign(o,{owner:U.uid,ntfy:e.ntfy,members:e.members,memberIds:[U.uid]}));
  if(FINK.some(k=>Object.keys(fin[k]).length))await db.collection('events').doc(code).collection('fin').doc('data').set(fin);
  sent[code]=parts(e);owners[code]=U.uid;V.eid=code;persist();render();toast('Shared. Code: '+code)}
 catch(x){e.id=id;e.cloud=0;S.regs.forEach(r=>{if(r.eid===code)r.eid=id});err(x)}
}
async function join(code){
 code=code.trim().toUpperCase();if(!code)return;
 try{const ref=db.collection('events').doc(code),g=await ref.get();
  if(!g.exists)return toast('Code not found');
  await ref.update({['members.'+U.uid]:{name:U.displayName||U.email,role:'member'},memberIds:firebase.firestore.FieldValue.arrayUnion(U.uid)});
  toast('Joined');document.getElementById('tp').classList.add('hid');go('events')}
 catch(x){err(x)}
}

window.rmMember=(id,uid)=>{const e=S.events.find(x=>x.id===id);if(!e||!e.members)return;delete e.members[uid];e.tasks.forEach(k=>{if(k.who===uid)k.who=''});save();render();if(db&&U)db.collection('events').doc(id).update({['members.'+uid]:firebase.firestore.FieldValue.delete(),memberIds:firebase.firestore.FieldValue.arrayRemove(uid),rc:{u:uid,r:'-',at:Date.now()}}).catch(err)};
window.setRole=(id,uid,role)=>{const e=S.events.find(x=>x.id===id);if(!e||!e.members||!e.members[uid])return;e.members[uid].role=role;persist();render();if(db&&U)db.collection('events').doc(id).update({['members.'+uid+'.role']:role,rc:{u:uid,r:role,at:Date.now()}}).catch(err)};   // 3.5.0: rc tells the rules exactly which member changed
window.SUBS=window.SUBS||{};const subUn={};
window.pubForm=(f,e)=>{if(db&&U){markFixed(f.id);db.collection('payforms').doc(f.id).set({eid:e.id,evName:e.name,title:f.title,amt:f.amt||0,upi:f.upi,payee:f.payee,note:f.note||'',by:U.uid,byName:f.byName||'',at:f.at,until:untilOf(e)}).catch(err)}};
// Deleting a link also deletes the payments people submitted through it (Firestore never removes sub-collections by itself).
async function purgeForm(fid){
 const ref=db.collection('payforms').doc(fid);
 try{for(let i=0;i<200;i++){const sn=await ref.collection('subs').limit(400).get({source:'server'});if(sn.empty)break;const b=db.batch();sn.docs.forEach(d=>b.delete(d.ref));await b.commit()}}
 catch(x){if(x.code!=='permission-denied')throw x}
 await ref.delete().catch(x=>{if(x.code!=='permission-denied'&&x.code!=='not-found')throw x});
}
const purgeForms=ids=>Promise.all((ids||[]).map(purgeForm));
window.pubDel=id=>{if(db&&U)purgeForm(id).catch(()=>{})};
// Links made before 3.1.0 have no expiry. The first organiser/creator who opens the new app stamps one (one read per old link, once per device).
const FIXED=LS('campus-pf-fixed',{});
const markFixed=id=>{FIXED[id]=1;try{localStorage.setItem('campus-pf-fixed',JSON.stringify(FIXED))}catch(x){}};
function fixForms(){
 if(!U||!window.can)return;
 S.events.filter(e=>e.cloud).forEach(e=>(e.forms||[]).forEach(f=>{
  if(FIXED[f.id]||!(f.by===U.uid||can(e,'pay')))return;markFixed(f.id);
  db.collection('payforms').doc(f.id).get().then(d=>{if(d.exists&&typeof d.data().until!=='number')return d.ref.update({until:untilOf(e),evName:e.name})}).catch(()=>{delete FIXED[f.id]});
 }));
}
window.subAct=(fid,sid,a)=>{if(!db)return;const r=db.collection('payforms').doc(fid).collection('subs').doc(sid);(a==='sd'?r.delete():r.update({s:a==='sv'?'verified':'rejected'})).catch(err)};
function watchSubs(){
 if(!U||!window.can)return;const want={};
 S.events.filter(e=>e.cloud).forEach(e=>(e.forms||[]).forEach(f=>{if(can(e,'pay')||f.by===U.uid)want[f.id]=f}));
 Object.keys(subUn).forEach(id=>{if(!want[id]){subUn[id]();delete subUn[id];delete SUBS[id]}});
 Object.keys(want).forEach(id=>{if(subUn[id])return;const f=want[id];let first=true;
  subUn[id]=db.collection('payforms').doc(id).collection('subs').onSnapshot(sn=>{
   const msgs=[];
   if(!first)sn.docChanges().forEach(c=>{if(c.type==='added'&&!c.doc.metadata.hasPendingWrites){const d=c.doc.data();msgs.push({cat:'money',n:f.title,text:'Payment of ₹'+d.a+' from '+d.n+' submitted'})}});
   first=false;SUBS[id]=sn.docs.map(d=>Object.assign({id:d.id},d.data()));render();if(msgs.length)notify(msgs);
  },()=>{});
 });
}
// ---------- UI ----------
const hdr=document.querySelector('header');
const tbtn=document.createElement('button');tbtn.className='btn ghost sm';tbtn.innerHTML='Team <span id="tb"></span>';hdr.append(tbtn);
const tp=document.createElement('div');tp.id='tp';tp.className='hid';document.body.append(tp);
function panel(){
 if(!ready){tp.innerHTML='<h3>Sync is off</h3><p class="meta">Add your Firebase config in firebase-config.js to share events with your team and get live alerts.</p>';return}
 if(!U){tp.innerHTML='<p class="meta">Not signed in.</p>';return}
 tp.innerHTML=`<button type="button" class="x" id="tpx" aria-label="Close">✕</button><h3>${esc(U.displayName||'Member')}</h3><p class="meta">${esc(U.email)}</p>
 <label for="nmi">Your name</label><div class="row"><input id="nmi" maxlength="40" value="${esc(U.displayName||'')}" autocomplete="name" style="flex:1"><button class="btn" id="nmb">Save</button></div>
 <label>Join an event</label><div class="row"><input id="jc" placeholder="Event code" style="flex:1;text-transform:uppercase"><button class="btn" id="jb">Join</button></div>
 <label>Notify me about</label><div class="row">${[['tasks','Tasks'],['people','People'],['money','Money'],['event','Event changes'],['chat','Chat messages'],['mention','Chat mentions']].map(k=>`<label style="margin:0"><input type="checkbox" data-p="${k[0]}" ${P[k[0]]?'checked':''}> ${k[1]}</label>`).join('')}</div>
 <label><input type="checkbox" data-p="ntfy" ${P.ntfy?'checked':''}> Also send my changes to the event's ntfy topic</label>
 <h3 style="margin-top:14px">Recent updates</h3>${N.length?N.slice(0,15).map(n=>`<div class="meta" style="padding:4px 0;border-bottom:1px solid var(--line)">${esc(n.text)}</div>`).join(''):'<p class="meta">Nothing yet.</p>'}
 <p class="meta" style="margin:14px 0 0"><a href="terms.html" id="tcl" style="color:var(--acc);font-weight:600">Terms &amp; Conditions</a> &nbsp;·&nbsp; <a href="privacy.html" id="pvl" style="color:var(--acc);font-weight:600">Privacy Policy</a></p>
 <div class="row" style="margin-top:12px"><button class="btn ghost sm" id="clr">Clear updates</button><button class="btn ghost sm del" id="so">Sign out</button></div>`;
}
let AM='in';
function authUI(){location.replace('login.html')}
// 3.3.0: one sign-out for everything. In the Android app it also forgets the Google account so the next sign-in shows the account chooser.
window.cemSignOut=async()=>{
 try{const K=window.Capacitor,P=K&&K.isNativePlatform&&K.isNativePlatform()&&K.Plugins&&K.Plugins.FirebaseAuthentication;if(P)await P.signOut()}catch(e){}
 return firebase.auth().signOut();
};
document.addEventListener('click',async e=>{
 const t=e.target.closest('button');if(!t)return;
 const g=id=>document.getElementById(id);
 if(t===tbtn){panel();tp.classList.toggle('hid')}
 else if(t.dataset.share)share(t.dataset.share);
 else if(t.dataset.copy){try{await navigator.clipboard.writeText(t.dataset.copy);toast('Code copied')}catch(x){toast('Code: '+t.dataset.copy)}}
 else if(t.id==='jb')join(g('jc').value);
 else if(t.id==='clr'){N=[];localStorage.setItem('campus-notes','[]');badge();panel()}
 else if(t.id==='so'){tp.classList.add('hid');window.cemSignOut()}
 else if(t.id==='tpx')tp.classList.add('hid');
 else if(t.id==='nmb')rename(g('nmi').value);
 else if(t.id==='off')g('au').remove();
 else if(t.dataset.m){AM=t.dataset.m;authUI(true)}
 else if(t.id==='go'){
  const em=g('ae').value.trim(),pw=g('ap').value,nmv=g('an').value.trim();
  try{if(AM==='in')await firebase.auth().signInWithEmailAndPassword(em,pw);
   else{const c=await firebase.auth().createUserWithEmailAndPassword(em,pw);await c.user.updateProfile({displayName:nmv||em.split('@')[0]})}}
  catch(x){g('am').textContent=x.message.replace('Firebase: ','')}
 }
});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='nmi'){e.preventDefault();rename(e.target.value)}});
document.addEventListener('change',e=>{
 const k=e.target.dataset&&e.target.dataset.p;
 if(k){P[k]=e.target.checked?1:0;localStorage.setItem('campus-prefs',JSON.stringify(P))}
});
badge();

if(!ready)document.documentElement.classList.remove('gate');
if(ready){
 firebase.initializeApp(C);db=firebase.firestore();
 db.enablePersistence({synchronizeTabs:true}).catch(()=>{});
 firebase.auth().onAuthStateChanged(u=>{
  // 3.3.0: the database accepts only confirmed emails. A leftover unconfirmed session goes back to the sign-in page, which sends a confirmation link.
  if(u&&!u.emailVerified){firebase.auth().signOut();return}
  U=u;window.MYUID=u?u.uid:'';window.MYNAME=u?(u.displayName||u.email.split('@')[0]):'';
  if(u){document.documentElement.classList.remove('gate');askPerm();listen();render()}
  else{if(unsub)unsub();dropFin();window.regDrop&&regDrop();window.chatDrop&&chatDrop();Object.keys(subUn).forEach(i=>{subUn[i]();delete subUn[i]});authUI()}
 });
}
})();
