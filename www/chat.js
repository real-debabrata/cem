/* CEM 2.0.0: event chat. 3.1.0: scrolling fixes (the chat fills the screen and only the message list scrolls) and @tagging of members.
   Free-plan design: Firestore only (events/{eventId}/chat/{messageId}). No Cloud Functions, no Storage, no extra service.
   - Every member (also people who join later) can read the whole history; "Load older messages" pages back 40 at a time.
   - Own messages can be edited or deleted for 2 hours (enforced by firestore.rules, not just by this file).
   - Organizer and manager can delete any message. Deleting the event deletes its chat (see chatPurge).
   - Short field names + deflate compression for long messages keep documents small.
   - Reads are kept low: the full listener runs only while the Chat tab is open; otherwise one 1-message listener per event
     drives the unread dot and alerts. */
(function(){
const PAGE=40,WIN=2*36e5,MAXLEN=1000,ZMIN=120;
const CH={},enc=new TextEncoder(),dec=new TextDecoder();
const LS=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))||d}catch(e){return d}};
let SEEN=LS('campus-chat-seen',{});
const $=id=>document.getElementById(id);
const uidNow=()=>window.MYUID||'';
const live=()=>!!(window.firebase&&firebase.apps&&firebase.apps.length&&uidNow());
const db=()=>firebase.firestore();
const col=eid=>db().collection('events').doc(eid).collection('chat');
const SV=()=>firebase.firestore.FieldValue.serverTimestamp();
const ms=t=>t&&t.toMillis?t.toMillis():(+t||Date.now());
const ch=eid=>CH[eid]||(CH[eid]={all:new Map(),q:Promise.resolve(),draft:'',stash:'',sel:null,edit:null,tok:0});
const saveSeen=()=>{try{localStorage.setItem('campus-chat-seen',JSON.stringify(SEEN))}catch(x){}};
const setSeen=(eid,t,force)=>{if(force||t>(SEEN[eid]||0)){SEEN[eid]=t;saveSeen()}};
const fail=(x,w)=>toast(x&&x.code==='permission-denied'?(w==='send'?'Message not sent. You may not have permission to post.':'Not allowed. You can edit or delete your own messages for 2 hours after sending.'):'Chat problem: '+((x&&x.message)||x));

/* ---------- compression (only used when it really saves space) ---------- */
async function zip(u8,op){
 const s=new Blob([u8]).stream().pipeThrough(op==='z'?new CompressionStream('deflate-raw'):new DecompressionStream('deflate-raw'));
 return new Uint8Array(await new Response(s).arrayBuffer());
}
const norm=t=>t.replace(/\r/g,'').replace(/[ \t]+\n/g,'\n').replace(/[ \t]{2,}/g,' ').replace(/\n{3,}/g,'\n\n').trim().slice(0,MAXLEN);
async function pack(text){
 const raw=enc.encode(text);
 if(raw.length>=ZMIN&&window.CompressionStream){
  try{const z=await zip(raw,'z');if(z.length<raw.length*.85)return{t:firebase.firestore.Blob.fromUint8Array(z),c:1}}catch(x){}
 }
 return{t:text};
}
async function read(d){
 const m=d.data({serverTimestamps:'estimate'});let t=m.t;
 if(t&&t.toUint8Array){try{t=dec.decode(await zip(t.toUint8Array(),'u'))}catch(x){t='[message could not be read]'}}
 return{id:d.id,u:m.u||'',n:m.n||'Member',t:String(t||''),at:ms(m.at),ed:m.ed?ms(m.ed):0,mt:Array.isArray(m.m)?m.m:[],p:d.metadata.hasPendingWrites};
}

/* ---------- small helpers ---------- */
const tm=t=>new Date(t).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
const dl=t=>{const d=new Date(t),n=new Date(),s=d.toDateString();return s===n.toDateString()?'Today':s===new Date(n-864e5).toDateString()?'Yesterday':d.toLocaleDateString([],{day:'numeric',month:'short',year:d.getFullYear()===n.getFullYear()?undefined:'numeric'})};
const roleOf=(e,u)=>{const m=(e.members||{})[u];if(!m)return '';return window.roleLabel?roleLabel(e,m.role):''};   // 3.6.1: custom roles show their own name
const hue=u=>{let h=0;for(let i=0;i<u.length;i++)h=(h*31+u.charCodeAt(i))%360;return h};
const link=s=>esc(s).replace(/https?:\/\/[^\s<>]+/g,u=>`<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`);
const myName=e=>{const m=(e.members||{})[uidNow()];return (m&&m.name)||window.MYNAME||'Member'};

const st=document.createElement('style');
st.textContent=`.chat{display:flex;flex-direction:column;height:min(72vh,640px);padding:0!important;overflow:hidden;position:relative}
.chat .ch{padding:9px 14px;border-bottom:1px solid var(--line);font-size:12px;color:var(--mute)}
#cm{flex:1;overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;background:var(--bg);overscroll-behavior:contain}
.cw{display:flex;flex-direction:column;align-self:flex-start;max-width:86%;margin-top:7px}.cw.g{margin-top:2px}.cw.me{align-self:flex-end;align-items:flex-end}
.cb{padding:6px 10px 4px;border-radius:14px;background:var(--card);border:1px solid var(--line);cursor:pointer;min-width:64px;overflow-wrap:anywhere}
.cw.me .cb{background:var(--acc);color:var(--accink);border-color:transparent}.cw.pend .cb{opacity:.7}
.cs{font-size:12px;font-weight:700}.cw.me .cs{opacity:.85}
.ct{white-space:pre-wrap;font-size:14.5px;line-height:1.4}.ct a{color:inherit;text-decoration:underline}
.cmeta{font-size:10.5px;opacity:.65;text-align:right;margin-top:1px}
.ca{display:flex;gap:6px;margin-top:4px;flex-wrap:wrap}
.cd{align-self:center;margin:12px 0 4px}.cd span{background:var(--card);border:1px solid var(--line);color:var(--mute);font-size:11.5px;padding:2px 10px;border-radius:10px}
.cn{text-align:center;color:var(--mute);font-size:13px;padding:14px}
.cc{display:flex;gap:8px;align-items:flex-end;padding:10px;border-top:1px solid var(--line);background:var(--card)}
.cc textarea{flex:1;resize:none;max-height:120px;border-radius:18px;padding:9px 14px}
.ce{display:flex;justify-content:space-between;align-items:center;padding:6px 14px;font-size:12.5px;color:var(--mute);border-top:1px solid var(--line);background:var(--card)}
.cj{position:absolute;left:50%;transform:translateX(-50%);bottom:74px;box-shadow:0 4px 14px rgba(0,0,0,.3)}
.chat #cm{min-height:0;overflow-anchor:none;touch-action:pan-y;-webkit-overflow-scrolling:touch}
html.chatmode,html.chatmode body{overflow:hidden;height:100%}
html.chatmode main{padding:8px 12px 0!important;max-width:760px}
html.chatmode .hc{display:none}
html.chatmode .chips{margin-bottom:8px}
html.typing #bn{display:none!important}
.cmn{position:absolute;left:10px;right:10px;z-index:3;background:var(--card);border:1px solid var(--line);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.25);overflow:hidden;max-height:210px;overflow-y:auto}
.cmi{padding:10px 12px;cursor:pointer;font-size:14px}.cmi small{color:var(--mute);margin-left:4px}.cmi.on,.cmi:hover{background:var(--bg)}
.mt{font-weight:700;color:var(--acc);background:color-mix(in srgb,var(--acc) 14%,transparent);border-radius:4px;padding:0 2px}
.cw.me .mt{color:inherit;background:rgba(255,255,255,.22);text-decoration:underline}
.cw.ment .cb{box-shadow:0 0 0 2px color-mix(in srgb,var(--acc) 70%,transparent)}
.cat{flex:none;padding:9px 12px}
.cdot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#ffb547;margin-left:6px;vertical-align:middle}`;
document.head.append(st);

/* ---------- unread dot (one tiny listener per event while the chat is closed) ---------- */
function unread(e){const c=CH[e.id];return !!(c&&!c.un&&c.last&&c.lastU&&c.lastU!==uidNow()&&c.last>(SEEN[e.id]||0))}
window.chatDot=e=>unread(e)?'<i class="cdot" aria-label="Unread messages"></i>':'';
function dot(eid){
 const b=document.querySelector('button[data-dt="chat"]');if(!b||V.eid!==eid)return;
 const d=b.querySelector('.cdot'),e=ev(eid);if(d)d.remove();
 if(e&&unread(e))b.insertAdjacentHTML('beforeend',chatDot(e));
}
function tail(e){
 const c=ch(e.id);if(c.tail||c.un||!live())return;
 const t0=Date.now();let first=true;
 c.tail=col(e.id).orderBy('at','desc').limit(1).onSnapshot(sn=>{
  const f=first;first=false;const d=sn.docs[0];if(!d)return;
  const m=d.data({serverTimestamps:'estimate'});c.last=ms(m.at);c.lastU=m.u;
  if(!(e.id in SEEN))setSeen(e.id,c.last,true);   // messages that existed before this device first saw the event count as read
  else if(!f&&!d.metadata.hasPendingWrites&&m.u!==uidNow()&&c.last>(SEEN[e.id]||0)&&c.last>=t0-6e4&&window.notify)
   read(d).then(x=>{const tg=x.mt.includes(uidNow());notify([{cat:tg?'mention':'chat',me:tg,n:e.name,text:x.n+(tg?' tagged you: ':': ')+x.t.slice(0,60)}])});
  dot(e.id);
 },()=>{});
}
const stopTail=c=>{if(c.tail){c.tail();c.tail=null}};
window.chatSync=()=>{if(!live())return;S.events.filter(e=>e.cloud).forEach(e=>{const c=ch(e.id);if(c.un)stopTail(c);else tail(e)})};

/* ---------- live window (only while the Chat tab is open) ---------- */
function open(e){
 const c=ch(e.id);if(c.un||!live())return;
 stopTail(c);const tok=++c.tok;
 c.all=new Map();c.cur=null;c.more=false;c.ready=false;c.err='';c.t0=Date.now();c.q=Promise.resolve();c.shown=0;
 let first=true;
 c.un=col(e.id).orderBy('at','desc').limit(PAGE).onSnapshot(sn=>{
  const f=first;first=false;
  c.q=c.q.then(()=>onSnap(e,sn,f,tok)).catch(()=>{});
 },x=>{c.ready=true;c.err=x.code||'error';paint(e.id,'bottom')});
}
function stopFull(eid){const c=CH[eid];if(!c||!c.un)return;c.un();c.un=null;c.tok++;c.sel=null;c.all=new Map();c.ready=false;c.below=false;if(c.edit){c.edit=null;c.draft=c.stash||''}}
async function onSnap(e,sn,isFirst,tok){
 const c=CH[e.id];if(!c||!c.un||c.tok!==tok)return;
 const docs=sn.docs,full=sn.size>=PAGE,oldest=docs.length?ms(docs[docs.length-1].data({serverTimestamps:'estimate'}).at):0,fresh=[];
 for(const x of sn.docChanges()){
  const d=x.doc;
  if(x.type==='removed'){
   // a doc that merely slid out of the 40-message window is older than the window; a real delete is not
   if(!full||ms(d.data({serverTimestamps:'estimate'}).at)>=oldest)c.all.delete(d.id);
   continue;
  }
  const m=await read(d);if(c.tok!==tok)return;
  c.all.set(d.id,m);
  if(x.type==='added'&&!isFirst&&!d.metadata.hasPendingWrites&&m.u!==uidNow()&&m.at>=c.t0-6e4)fresh.push(m);
 }
 if(isFirst){c.cur=docs[docs.length-1]||null;c.more=full}
 c.ready=true;
 const top=[...c.all.values()].reduce((a,m)=>Math.max(a,m.at),0);
 if(top){c.last=top;const lm=[...c.all.values()].find(m=>m.at===top);c.lastU=lm&&lm.u;setSeen(e.id,top,!(e.id in SEEN))}
 paint(e.id,isFirst||c.stick?'bottom':undefined,fresh.length);c.stick=0;
 if(fresh.length&&document.hidden&&window.notify)notify(fresh.slice(-3).map(m=>{const tg=m.mt.includes(uidNow());return{cat:tg?'mention':'chat',me:tg,n:e.name,text:m.n+(tg?' tagged you: ':': ')+m.t.slice(0,60)}}));
}
async function older(eid){
 const c=CH[eid];if(!c||!c.cur||c.busy)return;c.busy=1;
 try{
  const sn=await col(eid).orderBy('at','desc').startAfter(c.cur).limit(PAGE).get();
  for(const d of sn.docs)c.all.set(d.id,await read(d));
  if(sn.docs.length)c.cur=sn.docs[sn.docs.length-1];c.more=sn.size>=PAGE;
 }catch(x){fail(x)}
 c.busy=0;paint(eid,'older');
}

/* ---------- @tagging (3.1.0) ---------- */
// Tagged people are stored as a list of member ids (field m) next to the text, so alerts and highlights survive edits.
const escRe=t=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function mentionsOf(e,text){
 const c=ch(e.id),me=uidNow(),by={},isW=k=>!!k&&/[\p{L}\p{N}_]/u.test(k);let low=text.toLowerCase();
 Object.entries(e.members||{}).forEach(([id,m])=>{if(id===me)return;const n=String(m.name||'').trim().toLowerCase();if(n)(by[n]=by[n]||[]).push(id)});
 const out=new Set();
 Object.keys(by).sort((a,b)=>b.length-a.length).forEach(n=>{   // longest name first, so "@Rohit Sharma" is not also read as "@Rohit"
  const key='@'+n;let i=low.indexOf(key),hit=false;
  while(i>=0){
   if((i===0||/\s/.test(low[i-1]))&&!isW(low[i+key.length])){hit=true;low=low.slice(0,i)+'\u0001'.repeat(key.length)+low.slice(i+key.length)}
   i=low.indexOf(key,i+1);
  }
  if(hit){const tg=(c.tags||{})[n];(by[n].includes(tg)?[tg]:by[n]).forEach(id=>out.add(id))}
 });
 return [...out].slice(0,20);
}
function mnState(t,e){
 const pos=t.selectionStart,m=/(^|\s)@([^\n@]{0,30})$/.exec(t.value.slice(0,pos));if(!m)return null;
 const q=m[2],lq=q.toLowerCase(),all=Object.entries(e.members||{}).filter(([id])=>id!==uidNow()).map(([id,x])=>({id,n:x.name||'Member',r:roleOf(e,id)}));
 const items=[...all.filter(x=>x.n.toLowerCase().startsWith(lq)),...(q.length>1?all.filter(x=>!x.n.toLowerCase().startsWith(lq)&&x.n.toLowerCase().includes(lq)):[])].slice(0,6);
 return{start:pos-q.length-1,items};
}
function hideMn(){const p=$('cmn');if(p)p.remove();const c=CH[V.eid];if(c)c.mn=null}
function showMn(e,t){
 const c=ch(e.id),box=$('chat');if(!box)return;
 const st=mnState(t,e);c.mn=st;
 if(!st||!st.items.length){const p0=$('cmn');if(p0)p0.remove();return}
 c.mi=Math.min(c.mi||0,st.items.length-1);
 let p=$('cmn');if(!p){p=document.createElement('div');p.id='cmn';p.className='cmn';p.setAttribute('role','listbox');box.append(p)}
 const cc=box.querySelector('.cc');p.style.bottom=(cc?cc.offsetHeight+6:64)+'px';
 p.innerHTML=st.items.map((x,i)=>`<div class="cmi${i===c.mi?' on':''}" role="option" data-mn="${x.id}"><b>${esc(x.n)}</b>${x.r?`<small>${esc(x.r)}</small>`:''}</div>`).join('');
}
function pickMn(uid){
 const e=ev(V.eid),c=CH[V.eid],t=$('cin');if(!e||!c||!c.mn||!t)return;
 const m=(e.members||{})[uid];if(!m)return;
 const name=m.name||'Member',st=c.mn,rest=t.value.slice(t.selectionStart),caret=st.start+name.length+2;
 t.value=t.value.slice(0,st.start)+'@'+name+' '+rest;c.draft=t.value;
 (c.tags=c.tags||{})[name.toLowerCase()]=uid;   // two members with the same name: remember which one was picked
 t.focus();t.setSelectionRange(caret,caret);grow(t);hideMn();
}
// message text with the tagged names highlighted
function rich(e,m){
 const h=link(m.t),names=(m.mt||[]).map(u=>((e.members||{})[u]||{}).name).filter(Boolean).sort((a,b)=>b.length-a.length);
 if(!names.length)return h;
 const re=new RegExp('(^|\\s)(@(?:'+names.map(n=>escRe(esc(n))).join('|')+'))(?![\\p{L}\\p{N}_])','giu');
 return h.replace(re,'$1<span class="mt">$2</span>');
}

/* ---------- drawing ---------- */
function actions(e,m){
 const mine=m.u===uidNow(),w=can(e,'chat'),ok=mine&&w&&Date.now()-m.at<WIN,b=[`<button class="btn ghost sm" data-ch="copy" data-mid="${m.id}">Copy</button>`];
 if(ok)b.push(`<button class="btn ghost sm" data-ch="edit" data-mid="${m.id}">Edit</button>`);
 if(ok||can(e,'event'))b.push(`<button class="btn ghost sm del" data-ch="del" data-mid="${m.id}">Delete</button>`);
 return `<div class="ca">${b.join('')}</div>`;
}
function msgsHtml(e){
 const c=ch(e.id),list=[...c.all.values()].sort((a,b)=>a.at-b.at),me=uidNow();
 if(c.err&&!list.length)return `<div class="cn">Could not load messages (${esc(c.err)}). Publish the latest firestore.rules in the Firebase console.</div>`;
 if(!c.ready)return '<div class="cn">Loading messages...</div>';
 let h=c.more?'<div class="cn"><button class="btn ghost sm" data-ch="older">Load older messages</button></div>':'',pd='',pu='',pt=0;
 if(!list.length)h+='<div class="cn">No messages yet.</div>';
 list.forEach(m=>{
  const d=dl(m.at);if(d!==pd){h+=`<div class="cd"><span>${esc(d)}</span></div>`;pd=d;pu=''}
  const mine=m.u===me,grp=m.u===pu&&m.at-pt<3e5,r=roleOf(e,m.u);pu=m.u;pt=m.at;
  const nm=(mine?'You':esc(m.n))+(r?' ('+esc(r)+')':''),clr=mine?'inherit':'hsl('+hue(m.u)+' 65% 55%)';
  const tagged=!mine&&(m.mt||[]).includes(me);
  h+=`<div class="cw${mine?' me':''}${grp?' g':''}${m.p?' pend':''}${tagged?' ment':''}"><div class="cb" data-cs="${m.id}">${grp?'':`<div class="cs" style="color:${clr}">${nm}</div>`}<div class="ct">${rich(e,m)}</div><div class="cmeta">${m.ed?'edited · ':''}${tm(m.at)}${m.p?' · sending':''}</div></div>${c.sel===m.id?actions(e,m):''}</div>`;
 });
 return h;
}
function paint(eid,mode,nf){
 const c=CH[eid],el=$('cm');if(!c||!el||V.tab!=='detail'||V.dt!=='chat'||V.eid!==eid)return;
 const e=ev(eid);if(!e)return;
 const near=el.scrollHeight-el.scrollTop-el.clientHeight<140,t0=el.scrollTop,h0=el.scrollHeight;
 el.innerHTML=msgsHtml(e);
 if(mode==='bottom'||(mode===undefined&&near)){el.scrollTop=el.scrollHeight;c.below=false}
 else if(mode==='older')el.scrollTop=t0+(el.scrollHeight-h0);
 else{el.scrollTop=t0;if(mode===undefined&&nf)c.below=true}
 if(c.sel){const a=el.querySelector('.ca');if(a)a.scrollIntoView({block:'nearest'})}   // a tapped message keeps its Edit / Delete buttons in view
 const j=$('cj');if(j)j.classList.toggle('hid',!c.below);
}
window.chatV=e=>{
 if(!e.cloud)return '<div class="card empty">Chat needs a shared event. Share it from the Details tab first.</div>';
 const c=ch(e.id),w=can(e,'chat');
 return `<div class="card chat" id="chat"><div class="ch"><b>${esc(e.name)}</b> · ${Object.keys(e.members||{}).length} member(s)</div>
 <div id="cm">${msgsHtml(e)}</div><button class="cj btn sm hid" id="cj" data-ch="jump">New messages</button>
 ${c.edit?'<div class="ce"><span>Editing message</span><button class="btn ghost sm" data-ch="cancel">Cancel</button></div>':''}
 ${w?`<div class="cc"><textarea id="cin" rows="1" maxlength="${MAXLEN}" placeholder="Message" aria-label="Message">${esc(c.draft)}</textarea><button class="btn ghost cat" data-ch="at" aria-label="Tag a member" title="Tag a member">@</button><button class="btn" data-ch="send">Send</button></div>`:'<div class="cc"><span class="meta">You can read the chat but not send messages.</span></div>'}</div>`;
};
const grow=t=>{t.style.height='auto';t.style.height=Math.min(t.scrollHeight,120)+'px'};

/* ---------- hook into the app's render() so the chat starts/stops with the tab ---------- */
const r0=window.render;
window.render=function(){
 const el=$('cm'),pos=el?{t:el.scrollTop,b:el.scrollHeight-el.scrollTop-el.clientHeight<140}:null;
 const ta=$('cin'),had=!!ta&&document.activeElement===ta,ss=had?ta.selectionStart:0,se=had?ta.selectionEnd:0;
 const x=r0.apply(this,arguments);after(pos);
 // an incoming sync redraws the page; keep the cursor (and the phone keyboard) in the message box
 const nt=$('cin');if(had&&nt&&document.activeElement!==nt){try{nt.focus({preventScroll:true});nt.setSelectionRange(ss,se)}catch(k){}}
 document.documentElement.classList.toggle('typing',!!document.activeElement&&document.activeElement.id==='cin');fit();
 return x;
};
// Chat screen: the page itself does not scroll, the card fills what is left under the header and only the message list scrolls.
function fit(){
 const root=document.documentElement,c=$('chat');
 root.classList.toggle('chatmode',!!c);if(!c)return;
 const vv=window.visualViewport,vh=vv?vv.height:window.innerHeight,bn=$('bn'),bh=bn&&getComputedStyle(bn).display!=='none'?bn.offsetHeight:0;
 const el=$('cm'),near=!el||el.scrollHeight-el.scrollTop-el.clientHeight<140;
 if(window.scrollY)window.scrollTo(0,0);
 c.style.height=Math.max(240,Math.floor(vh-c.getBoundingClientRect().top-bh-8))+'px';
 if(el&&near)el.scrollTop=el.scrollHeight;
}
window.addEventListener('resize',fit);if(window.visualViewport)visualViewport.addEventListener('resize',fit);
document.addEventListener('focusin',x=>{if(x.target.id==='cin'){document.documentElement.classList.add('typing');setTimeout(fit,60);setTimeout(fit,350)}});
document.addEventListener('focusout',x=>{if(x.target.id==='cin')setTimeout(()=>{if(document.activeElement&&document.activeElement.id==='cin')return;document.documentElement.classList.remove('typing');hideMn();fit()},150)});
// tapping the tag list or the Send / @ buttons must not take the cursor out of the message box
document.addEventListener('mousedown',x=>{if(x.target.closest('.cmn,.cc button'))x.preventDefault()});
function after(pos){
 const e=(V.tab==='detail'&&V.dt==='chat')?ev(V.eid):null;
 Object.keys(CH).forEach(id=>{if((!e||e.id!==id)&&CH[id].un)stopFull(id)});
 if(e&&e.cloud)open(e);
 chatSync();
 const el=$('cm');
 if(el&&e){
  el.scrollTop=pos&&!pos.b?pos.t:el.scrollHeight;
  el.onscroll=()=>{const c=CH[e.id];if(c&&c.below&&el.scrollHeight-el.scrollTop-el.clientHeight<140){c.below=false;const j=$('cj');j&&j.classList.add('hid')}};
  const t=$('cin');if(t)grow(t);
 }
}

/* ---------- actions ---------- */
function ntfyPush(e,n){
 if(!LS('campus-prefs',{}).ntfy||!e.ntfy)return;
 fetch('https://ntfy.sh/'+e.ntfy,{method:'POST',body:e.name+' - new chat message from '+n}).catch(()=>{});   // never includes the message text
}
async function send(){
 const eid=V.eid,e=ev(eid),c=CH[eid],t=$('cin');if(!e||!c||!t||!live())return;
 const text=norm(t.value);if(!text)return;
 const edit=c.edit,p=await pack(text),mt=mentionsOf(e,text);
 if(edit){
  const m=c.all.get(edit);
  if(m&&m.t!==text)col(eid).doc(edit).update({t:p.t,ed:SV(),c:p.c?1:firebase.firestore.FieldValue.delete(),m:mt.length?mt:firebase.firestore.FieldValue.delete()}).catch(x=>fail(x,'edit'));
  c.edit=null;c.draft=c.stash||'';c.stash='';render();
 }else{
  const o={u:uidNow(),n:myName(e),t:p.t,at:SV()};if(p.c)o.c=1;if(mt.length)o.m=mt;
  c.stick=1;c.draft='';c.tags={};t.value='';hideMn();grow(t);
  col(eid).add(o).catch(x=>{c.stick=0;fail(x,'send')});
  ntfyPush(e,o.n);
 }
}
function act(a,id){
 const eid=V.eid,e=ev(eid),c=CH[eid];if(!e||!c)return;
 if(a==='send')send();
 else if(a==='older')older(eid);
 else if(a==='at'){const t=$('cin');if(!t)return;t.focus();const p=t.selectionStart,v=t.value,pre=p>0&&!/\s/.test(v[p-1])?' ':'';
  t.value=v.slice(0,p)+pre+'@'+v.slice(t.selectionEnd);const np=p+pre.length+1;t.setSelectionRange(np,np);c.draft=t.value;c.mi=0;grow(t);showMn(e,t)}
 else if(a==='jump'){const el=$('cm');el.scrollTop=el.scrollHeight;c.below=false;$('cj').classList.add('hid')}
 else if(a==='copy'){const m=c.all.get(id);if(m){try{navigator.clipboard.writeText(m.t);toast('Copied')}catch(x){}}c.sel=null;paint(eid,'keep')}
 else if(a==='edit'){const m=c.all.get(id);if(!m)return;if(!c.edit)c.stash=c.draft;c.draft=m.t;c.edit=id;c.sel=null;render();const t=$('cin');if(t){t.focus();grow(t)}}
 else if(a==='cancel'){c.draft=c.stash||'';c.stash='';c.edit=null;render()}
 else if(a==='del'){
  if(!confirm('Delete this message for everyone?'))return;c.sel=null;
  col(eid).doc(id).delete().then(()=>{c.all.delete(id);paint(eid,'keep')}).catch(x=>fail(x,'del'));
 }
}
document.addEventListener('click',x=>{
 const tg=x.target.closest('.cmi[data-mn]');if(tg){pickMn(tg.dataset.mn);return}
 const b=x.target.closest('button[data-ch]');
 if(b){act(b.dataset.ch,b.dataset.mid);return}
 const m=x.target.closest('.cb[data-cs]');
 if(m&&!x.target.closest('a')){const c=CH[V.eid];if(c){c.sel=c.sel===m.dataset.cs?null:m.dataset.cs;paint(V.eid,'keep')}}
});
document.addEventListener('input',x=>{if(x.target.id!=='cin')return;
 const c=CH[V.eid],e=ev(V.eid),el=$('cm'),near=!el||el.scrollHeight-el.scrollTop-el.clientHeight<140;
 if(c){c.draft=x.target.value;c.mi=0}
 grow(x.target);if(el&&near)el.scrollTop=el.scrollHeight;   // growing the box shrinks the list; keep the newest message visible
 if(e&&e.cloud)showMn(e,x.target);
});
document.addEventListener('keyup',x=>{if(x.target.id==='cin'&&/^Arrow(Left|Right)|Home|End$/.test(x.key)){const e=ev(V.eid);if(e&&e.cloud)showMn(e,x.target)}});
document.addEventListener('keydown',x=>{
 if(x.target.id==='cin'){
  const c=CH[V.eid];
  if(c&&c.mn&&c.mn.items.length&&$('cmn')){
   if(x.key==='ArrowDown'||x.key==='ArrowUp'){x.preventDefault();const n=c.mn.items.length;c.mi=((c.mi||0)+(x.key==='ArrowDown'?1:n-1))%n;showMn(ev(V.eid),x.target);return}
   if(x.key==='Enter'||x.key==='Tab'){x.preventDefault();pickMn(c.mn.items[c.mi||0].id);return}
   if(x.key==='Escape'){x.preventDefault();hideMn();return}
  }
 }
 if(x.target.id==='cin'&&x.key==='Enter'&&!x.shiftKey&&window.matchMedia&&matchMedia('(pointer:fine)').matches){x.preventDefault();send()}   // phones: Enter = new line, use the Send button
});

/* ---------- called by sync.js ---------- */
window.chatDrop=eid=>{
 (eid?[eid]:Object.keys(CH)).forEach(id=>{const c=CH[id];if(!c)return;if(c.un)c.un();if(c.tail)c.tail();delete CH[id];if(eid){delete SEEN[id]}});
 if(eid)saveSeen();
};
// Firestore does not delete sub-collections when the parent is deleted, so the organizer's app removes the messages first.
window.chatPurge=async eid=>{
 window.chatDrop(eid);
 for(let i=0;i<500;i++){
  const sn=await col(eid).limit(400).get({source:'server'});
  if(sn.empty)return;
  const b=db().batch();sn.docs.forEach(d=>b.delete(d.ref));await b.commit();
 }
};
})();
