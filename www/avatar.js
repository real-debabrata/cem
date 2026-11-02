/* CEM 4.3.0: profile pictures.
   Free-plan design: no Firebase Storage (it needs the paid Blaze plan), no new service, no extra reads while you use the app.
   - The photo is cropped and shrunk ON THE PHONE to 64 x 64 (WebP, or JPEG where WebP is not available) and kept under about 3 KB as text.
   - It is saved in two places:
       users/{uid}                          your own copy (one small document, the source of truth)
       events/{id}.members.{uid}.pic        a copy inside every event you belong to
     The second copy is why events, the people list and chat show faces with ZERO extra reads: the member list is already
     downloaded with the event. Chat messages carry no picture; chat looks the sender up by user id.
   - Changing or removing the photo costs 1 write for the users document plus 1 write per event you are in. Showing it costs nothing.
   - One read of users/{uid} when a device has no copy of your photo yet, then at most once every 12 hours.
   - A photo someone else uploaded is only drawn if it passes the strict data-URL check below (firestore.rules checks the same pattern).
   Public helpers used by the other files: cemPicOf, cemAv, cemStack, cemPaintSelf, cemPicOpen. */
(function(){
'use strict';
const OUT=64,CAP=3500,MAXFILE=15*1024*1024,TTL=12*36e5,V=256;
const OK=/^data:image\/(?:jpeg|webp);base64,[A-Za-z0-9+\/=]{20,4000}$/;   // same shape as picOk() in firestore.rules
const KEY='campus-pic';
const LS={get(k,d){try{return JSON.parse(localStorage.getItem(k))||d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const $=s=>document.querySelector(s);
const hue=s=>{let h=0;s=String(s==null?'':s);for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))%360;return h};
const ini=n=>(String(n||'?').trim().slice(0,1).toUpperCase())||'?';
const valid=p=>typeof p==='string'&&OK.test(p)?p:'';
const myUid=()=>window.MYUID||'';
const say=m=>{if(typeof toast==='function')toast(m)};
let L=LS.get(KEY,{});                 // this device's copy of my photo: {u, pic, at, chk}
const healed={};                      // event id -> picture last sent by heal(), so a failed write is never retried in a loop
let warned=false;

/* ---------- lookups ---------- */
const mine=()=>L.u&&L.u===myUid()?valid(L.pic):'';
// the picture to draw for a person. e = the event (or null), uid = the account id. My own photo is read from this device first.
window.cemPicOf=(e,uid)=>{
 if(!uid)return '';
 if(uid===myUid()){const m=mine();if(m)return m}
 const mem=e&&e.members&&e.members[uid];
 return mem?valid(mem.pic):'';
};
// round avatar: the photo, or the first letter on a colour taken from the id. px = size, cls = extra class
window.cemAv=(e,uid,name,px,cls)=>{
 const p=cemPicOf(e,uid),st=`--s:${+px||32}px;--h:${hue(uid||name)}`;
 return p?`<span class="cav ${cls||''}" style="${st}"><img src="${esc(p)}" alt="" decoding="async"></span>`
         :`<span class="cav ${cls||''}" style="${st}" aria-hidden="true">${esc(ini(name))}</span>`;
};
const hasPhoto=(e,id)=>!!cemPicOf(e,id);
// overlapping faces of an event's team. photoOnly: draw nothing unless somebody has a photo (keeps the Events list quiet until photos exist)
window.cemStack=(e,max,px,photoOnly)=>{
 if(!e||!e.cloud||!e.members)return '';
 const ids=Object.keys(e.members);if(!ids.length)return '';
 if(photoOnly&&!ids.some(id=>hasPhoto(e,id)))return '';
 const rank=id=>(e.members[id].role==='owner'||e.members[id].role==='organizer'?0:hasPhoto(e,id)?1:2);
 ids.sort((a,b)=>rank(a)-rank(b)||String(e.members[a].name||'').localeCompare(String(e.members[b].name||'')));
 const n=Math.max(1,max||4),show=ids.slice(0,n),extra=ids.length-show.length,s=+px||22;
 return `<span class="cstack" title="${ids.length} member${ids.length===1?'':'s'}">${show.map(id=>cemAv(e,id,e.members[id].name,s,'cs')).join('')}${extra>0?`<span class="cav cs more" style="--s:${s}px">+${extra}</span>`:''}</span>`;
};
// the round button in the top bar (ui.js calls this every time the menu is redrawn)
window.cemPaintSelf=btn=>{
 const p=mine();
 btn.classList.toggle('hp',!!p);
 if(p)btn.innerHTML=`<img src="${esc(p)}" alt="">`;else btn.textContent=ini(window.MYNAME);
};

/* ---------- styles ---------- */
const st=document.createElement('style');
st.textContent=`.cav{display:inline-grid;place-items:center;flex:none;width:var(--s,32px);height:var(--s,32px);border-radius:50%;overflow:hidden;box-sizing:border-box;vertical-align:middle;
font-family:var(--disp,inherit);font-weight:700;font-size:calc(var(--s,32px)*.42);line-height:1;color:#fff;background:hsl(var(--h,220) 52% 46%);user-select:none}
.cav img{display:block;width:100%;height:100%;object-fit:cover}
.cstack{display:inline-flex;align-items:center;align-self:flex-start;margin-top:2px}
.cstack .cs{border:2px solid var(--card);margin-left:-7px}.cstack .cs:first-child{margin-left:0}
.cstack .more{background:var(--line);color:var(--ink);font-size:10px}
.cw:not(.me){position:relative;padding-left:34px}.cw>.cavc{position:absolute;left:0;top:0}
.cmi .cav{margin-right:8px}
#av.hp{padding:0;overflow:hidden;background:var(--line)}#av img{display:block;width:100%;height:100%;object-fit:cover}
.dr-av.dr-pic{padding:0;overflow:hidden;background:var(--line)}.dr-pic img{display:block;width:100%;height:100%;object-fit:cover}
.tpp{display:flex;align-items:center;gap:12px;margin:12px 0 2px}
#pp{position:fixed;inset:0;z-index:50;display:grid;place-items:center;background:rgba(16,23,43,.55);backdrop-filter:blur(4px);padding:16px}
#pp .box{position:relative;background:var(--card);color:var(--ink);border-radius:18px;padding:22px;width:min(380px,100%);max-height:100%;overflow:auto;box-shadow:0 24px 70px rgba(0,0,0,.45)}
#pp .ppv{display:grid;place-items:center;margin:14px 0 6px}
#pp canvas,#pp .ppcur{width:160px;height:160px;border-radius:50%;background:var(--bg);box-shadow:0 0 0 3px var(--line)}
#pp canvas{touch-action:none;cursor:grab}#pp canvas:active{cursor:grabbing}
#pp .ppcur .cav{width:160px;height:160px;font-size:64px}
#pp input[type=range]{padding:0}
#pp .row{margin-top:10px}#pp #ppm{color:var(--bad);min-height:20px;font-size:13px;margin:8px 0 0}`;
document.head.append(st);

/* ---------- reading the photo the person picked ---------- */
async function load(file){
 if(!/^image\//.test(file.type)||/svg/.test(file.type))throw new Error('Choose a photo (JPG, PNG or WebP).');
 if(file.size>MAXFILE)throw new Error('That photo is too large. Choose one under 15 MB.');
 try{if(window.createImageBitmap)return await createImageBitmap(file,{imageOrientation:'from-image'})}catch(e){}   // also applies the camera's rotation
 return await new Promise((ok,no)=>{
  const u=URL.createObjectURL(file),i=new Image();
  i.onload=()=>{URL.revokeObjectURL(u);ok(i)};
  i.onerror=()=>{URL.revokeObjectURL(u);no(new Error('That file could not be read as a photo. Try a JPG or PNG.'))};
  i.src=u;
 });
}
const WEBP=(()=>{try{return document.createElement('canvas').toDataURL('image/webp').indexOf('data:image/webp')===0}catch(e){return false}})();

/* ---------- the crop box: drag to move, slider or mouse wheel to zoom ---------- */
let img=null,iw=0,ih=0,base=1,view={z:1,ox:0,oy:0},drag=null;
const cv=()=>$('#ppc');
function clamp(){
 const s=base*view.z,mx=Math.max(0,(iw*s-V)/2),my=Math.max(0,(ih*s-V)/2);
 view.ox=Math.min(mx,Math.max(-mx,view.ox));view.oy=Math.min(my,Math.max(-my,view.oy));
}
function draw(){
 const c=cv();if(!c||!img)return;
 const x=c.getContext('2d'),s=base*view.z;
 x.fillStyle='#fff';x.fillRect(0,0,V,V);x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';
 x.drawImage(img,V/2+view.ox-iw*s/2,V/2+view.oy-ih*s/2,iw*s,ih*s);
}
// Shrinks what the crop box shows to 64 x 64 and lowers the quality until the text is short enough. Tries 56 and 48 pixels as a last resort.
function encode(src){
 const o=document.createElement('canvas');
 for(const px of [OUT,56,48]){
  o.width=o.height=px;const x=o.getContext('2d');
  x.fillStyle='#fff';x.fillRect(0,0,px,px);x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';x.drawImage(src,0,0,px,px);
  for(const q of [.85,.75,.65,.55,.45,.35]){
   const u=o.toDataURL(WEBP?'image/webp':'image/jpeg',q);
   if(typeof u==='string'&&u.length<=CAP&&OK.test(u))return u;
  }
 }
 return '';
}
window.cemPicEncode=encode;   // used by tests/test-avatar.mjs

/* ---------- the window ---------- */
let box=null;
function ensureBox(){
 if(box)return box;
 box=document.createElement('div');box.id='pp';box.className='hid';box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-labelledby','pptl');
 box.innerHTML=`<div class="box"><button type="button" class="x" data-pp="x" aria-label="Close">\u2715</button><h3 id="pptl">Profile photo</h3>
  <p class="meta" style="margin:6px 0 0">Your teammates see it in events, the people list and chat. It is shrunk on your phone to about 3 KB, so it uses almost no storage.</p>
  <div class="ppv"><div class="ppcur" id="ppcur"></div><canvas id="ppc" width="${V}" height="${V}" class="hid" tabindex="0" aria-label="Drag or use the arrow keys to move the photo"></canvas></div>
  <div id="ppz" class="hid"><label for="ppr">Zoom</label><input id="ppr" type="range" min="1" max="4" step="0.01" value="1" aria-label="Zoom"></div>
  <input type="file" id="ppf" accept="image/*" hidden>
  <div class="row"><button type="button" class="btn" data-pp="pick">Choose photo</button><button type="button" class="btn" data-pp="save" disabled>Save</button></div>
  <div class="row"><button type="button" class="btn ghost del" data-pp="rm">Remove photo</button><button type="button" class="btn ghost" data-pp="x">Cancel</button></div>
  <p id="ppm" role="alert"></p></div>`;
 document.body.append(box);
 return box;
}
const msg=t=>{const m=$('#ppm');if(m)m.textContent=t||''};
function showCurrent(){
 const u=firebase.auth().currentUser,cur=$('#ppcur');if(!cur||!u)return;
 cur.innerHTML=cemAv(null,u.uid,window.MYNAME||u.displayName||u.email,160);
 cur.classList.remove('hid');cv().classList.add('hid');$('#ppz').classList.add('hid');
 box.querySelector('[data-pp=save]').disabled=true;
 box.querySelector('[data-pp=rm]').classList.toggle('hid',!mine());
}
function release(){if(img&&img.close)try{img.close()}catch(e){}img=null;drag=null}
function close(){if(!box)return;release();box.classList.add('hid');msg('')}
window.cemPicOpen=function(){
 if(!(window.firebase&&firebase.apps&&firebase.apps.length&&firebase.auth().currentUser))return say('Sign in to add a profile photo');
 ensureBox();release();showCurrent();msg('');box.classList.remove('hid');
 const b=box.querySelector('[data-pp=pick]');if(b)b.focus();
};
async function picked(file){
 if(!file)return;msg('');
 try{
  const im=await load(file);release();img=im;iw=im.naturalWidth||im.width;ih=im.naturalHeight||im.height;
  if(!iw||!ih)throw new Error('That file could not be read as a photo.');
  base=V/Math.min(iw,ih);view={z:1,ox:0,oy:0};$('#ppr').value='1';
  $('#ppcur').classList.add('hid');cv().classList.remove('hid');$('#ppz').classList.remove('hid');
  box.querySelector('[data-pp=save]').disabled=false;draw();
 }catch(x){msg(x.message||'That file could not be used.')}
}
function saveClick(){
 const c=cv();if(!img||!c)return;
 draw();const pic=encode(c);
 if(!pic)return msg('Could not make that photo small enough. Try another one.');
 close();setPic(pic);
}
document.addEventListener('click',x=>{
 const b=x.target.closest&&x.target.closest('[data-pp]');
 if(b&&box&&box.contains(b)){
  const a=b.dataset.pp;
  if(a==='x')close();
  else if(a==='pick'){const f=$('#ppf');f.value='';f.click()}
  else if(a==='save')saveClick();
  else if(a==='rm'){close();setPic('')}
  return;
 }
 if(box&&x.target===box)close();   // tap outside the white box
});
document.addEventListener('change',x=>{if(x.target.id==='ppf')picked(x.target.files&&x.target.files[0])});
document.addEventListener('input',x=>{if(x.target.id==='ppr'&&img){view.z=+x.target.value||1;clamp();draw()}});
document.addEventListener('keydown',x=>{
 if(x.key==='Escape'&&box&&!box.classList.contains('hid')){close();return}
 const d={ArrowLeft:[-12,0],ArrowRight:[12,0],ArrowUp:[0,-12],ArrowDown:[0,12]}[x.key];
 if(d&&img&&x.target.id==='ppc'){x.preventDefault();view.ox+=d[0];view.oy+=d[1];clamp();draw()}
});
document.addEventListener('pointerdown',x=>{
 if(!img||x.target.id!=='ppc')return;
 drag={x:x.clientX,y:x.clientY,ox:view.ox,oy:view.oy};
 try{x.target.setPointerCapture(x.pointerId)}catch(e){}
});
document.addEventListener('pointermove',x=>{
 if(!drag||!img)return;
 const c=cv(),k=V/((c&&c.getBoundingClientRect().width)||160);   // screen pixels -> crop-box pixels
 view.ox=drag.ox+(x.clientX-drag.x)*k;view.oy=drag.oy+(x.clientY-drag.y)*k;clamp();draw();
});
const endDrag=()=>{drag=null};
document.addEventListener('pointerup',endDrag);document.addEventListener('pointercancel',endDrag);
document.addEventListener('wheel',x=>{
 if(!img||!x.target.closest||!x.target.closest('#ppc'))return;
 x.preventDefault();view.z=Math.min(4,Math.max(1,view.z*(x.deltaY<0?1.08:1/1.08)));$('#ppr').value=String(view.z);clamp();draw();
},{passive:false});

/* ---------- saving and spreading the photo ---------- */
const mineEvents=uid=>S.events.filter(e=>e.cloud&&e.members&&e.members[uid]);
function applyLocal(uid,pic){   // change my entry inside the events already on this device, so the screen is right before the server answers
 mineEvents(uid).forEach(e=>{if(pic)e.members[uid].pic=pic;else delete e.members[uid].pic});
 try{localStorage.setItem('campus-events-v1',JSON.stringify(S))}catch(e){}
}
function repaint(){
 const t=$('#tpav'),u=window.MYUID;if(t&&u)t.innerHTML=cemAv(null,u,window.MYNAME,56);
 if(typeof render==='function')render();
}
function fail(x,what){
 if(x&&x.code==='not-found')return;   // the event was deleted a moment ago
 if(warned)return;warned=true;
 say(x&&x.code==='permission-denied'?'Photo not saved. Publish the latest firestore.rules in the Firebase console (see START-HERE.txt).':'Photo problem: '+((x&&x.message)||x));
}
// one write per event (not one batch), so a single event you were removed from cannot stop the others
function pushEvents(uid,pic,list){
 const db=firebase.firestore(),FV=firebase.firestore.FieldValue;
 (list||mineEvents(uid)).forEach(e=>db.collection('events').doc(e.id).update({['members.'+uid+'.pic']:pic||FV.delete()}).catch(fail));
}
function setPic(pic){
 const u=firebase.auth().currentUser;if(!u)return say('Sign in first');
 const prev=L,at=Date.now();
 warned=false;
 L={u:u.uid,pic,at,chk:at};LS.set(KEY,L);applyLocal(u.uid,pic);repaint();
 say(pic?'Profile photo updated':'Profile photo removed');
 firebase.firestore().collection('users').doc(u.uid).set({pic,at})
  .then(()=>pushEvents(u.uid,pic))
  .catch(x=>{L=prev;LS.set(KEY,L);applyLocal(u.uid,prev.u===u.uid?valid(prev.pic):'');repaint();fail(x)});
}
window.cemSetPic=setPic;   // used by tests/test-avatar.mjs

// After you join or share an event the new member entry has no photo. This adds it (never replaces a different photo someone already stored).
function heal(){
 const uid=myUid(),p=mine();
 if(!uid||!p||!window.firebase||!firebase.apps||!firebase.apps.length)return;
 const todo=mineEvents(uid).filter(e=>!e.members[uid].pic&&healed[e.id]!==p);
 if(!todo.length)return;
 todo.forEach(e=>{healed[e.id]=p});
 pushEvents(uid,p,todo);
}
const r0=window.render;
if(typeof r0==='function')window.render=function(){const r=r0.apply(this,arguments);try{heal()}catch(x){}return r};

// Reads users/{uid} only when this device has no copy yet or the copy is older than 12 hours.
async function pull(u){
 if(L.u!==u.uid){L={u:u.uid,pic:'',at:0,chk:0};LS.set(KEY,L)}   // another person used this phone before
 if(Date.now()-(L.chk||0)<TTL)return;
 try{
  const sn=await firebase.firestore().collection('users').doc(u.uid).get({source:'server'}),d=sn.exists?sn.data():{};
  L={u:u.uid,pic:valid(d.pic),at:d.at||0,chk:Date.now()};LS.set(KEY,L);
  repaint();
 }catch(x){/* offline, or firestore.rules not published yet: keep what this device has */}
}
if(window.firebase&&firebase.apps&&firebase.apps.length)firebase.auth().onAuthStateChanged(u=>{
 if(u&&u.emailVerified)pull(u);
 else if(!u){L={};LS.set(KEY,L);for(const k in healed)delete healed[k];warned=false}   // signed out: this phone forgets the photo
});
})();
