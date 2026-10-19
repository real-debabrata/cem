/* CEM 3.8.0: smooth motion (see motion.js). This file is unchanged apart from the version.
   CEM 3.7.2: update banner / update check only in the Android app, never on the website (the website is always the latest deployed version).
   CEM 3.7.0: new brand (Indigo #5948F5, Amber, Midnight Navy, Cloud White, Fresh Mint) and new logo.
   Campus Events: menu bar, UI polish, app version control. Loads after sync.js/app2.js; no core code is modified. */
(function(){
const APP_VERSION='3.11.0',BUILD='2026-10-19';   // bump these on every release
const $=s=>document.querySelector(s),LS=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))||d}catch(e){return d}};
const root=document.documentElement;
let theme=localStorage.getItem('campus-theme')||'auto',CFG=LS('campus-ver',null);
const applyTheme=()=>theme==='auto'?root.removeAttribute('data-theme'):root.setAttribute('data-theme',theme);applyTheme();

// ---- one-time cleanup of the old built-in demo events (only if untouched) ----
if(!localStorage.getItem('campus-demo-purged')){
 const dn={e1:'Ignite Tech Fest 2026',e2:'Careers in AI Seminar',e3:'Product Design Webinar',e4:'Intro to Git & GitHub'};
 const ids=S.events.filter(e=>!e.cloud&&dn[e.id]===e.name&&!S.regs.some(r=>r.eid===e.id&&!/^r[123]$/.test(r.id))).map(e=>e.id);
 if(ids.length){S.events=S.events.filter(e=>!ids.includes(e.id));S.regs=S.regs.filter(r=>!ids.includes(r.eid));save()}
 localStorage.setItem('campus-demo-purged','1');
}

// ---- styles ----
const css=document.createElement('style');css.textContent=`
:root{--r:14px;--sh:0 1px 2px rgba(16,24,40,.06),0 8px 24px -10px rgba(16,24,40,.14)}
body{background:radial-gradient(900px 400px at 0% -10%,color-mix(in srgb,var(--acc) 14%,transparent),transparent 60%),var(--bg)}
header{backdrop-filter:saturate(1.4) blur(14px);background:color-mix(in srgb,var(--card) 80%,transparent)!important;gap:10px}
header>.btn,#nav{display:none!important}
#mb{display:flex;gap:2px;background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:3px}
#mb button,#bn button{position:relative;display:flex;align-items:center;gap:7px;border:0;background:none;color:var(--mute);font:inherit;font-weight:600;font-size:14px;padding:7px 12px;border-radius:9px;cursor:pointer;transition:.18s}
#mb button:hover{color:var(--ink)}#mb button.on{background:var(--card);color:var(--acc);box-shadow:0 1px 4px rgba(0,0,0,.15)}
svg.i{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
#mb em,#bn em{font-style:normal;background:var(--acc);color:var(--accink);border-radius:9px;font-size:11px;padding:0 6px;font-weight:700}
#av{width:36px;height:36px;border-radius:50%;border:0;background:#5948f5;color:#fff;font-weight:800;cursor:pointer}
#bn{display:none}
@media(max-width:720px){#mb{display:none}#bn{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:15;background:color-mix(in srgb,var(--card) 88%,transparent);backdrop-filter:blur(14px);border-top:1px solid var(--line);padding:6px 6px calc(6px + env(safe-area-inset-bottom,0px))}
#bn button{flex:1;flex-direction:column;gap:2px;font-size:11px;padding:6px 2px}#bn button.on{color:var(--acc)}#bn em{position:absolute;top:0;right:22%}main{padding-bottom:96px}.toast{bottom:calc(84px + env(safe-area-inset-bottom,0px))!important}}
.card,.stat,.ev{border-radius:var(--r);box-shadow:var(--sh);border-color:transparent}
.ev{transition:transform .18s,box-shadow .18s}.ev:hover{transform:translateY(-3px)}
.stat b{color:var(--acc)}
#app{animation:fi .25s ease}@keyframes fi{from{opacity:0;transform:translateY(6px)}}
.btn{transition:.15s;border-radius:10px}.btn:not(.ghost){background:var(--acc)}.btn:active{transform:scale(.97)}
input:focus,select:focus,textarea:focus{border-color:var(--acc);box-shadow:0 0 0 3px color-mix(in srgb,var(--acc) 22%,transparent);outline:0}
th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--mute)}.chip{transition:.15s}
.empty{border:1px dashed var(--line);border-radius:var(--r)}.empty .btn{margin-top:10px}
#um{position:fixed;right:12px;top:calc(62px + env(safe-area-inset-top,0px));z-index:25;width:min(280px,92vw);background:var(--card);border:1px solid var(--line);border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.3);padding:6px;animation:fi .15s}
#um .uh{padding:10px 12px;border-bottom:1px solid var(--line);margin-bottom:4px}#um .uh b,#um .uh span{display:block}#um .uh span{color:var(--mute);font-size:12px}
#um button{display:flex;justify-content:space-between;width:100%;border:0;background:none;color:var(--ink);font:inherit;padding:10px 12px;border-radius:9px;cursor:pointer;text-align:left}#um button:hover{background:var(--bg)}#um .dg{color:var(--bad)}#um small{color:var(--mute)}
#tp{top:calc(62px + env(safe-area-inset-top,0px))!important;border-radius:14px!important}
#vs,#vb,#js{position:fixed;inset:0;z-index:40;display:grid;place-items:center;background:rgba(16,23,43,.55);backdrop-filter:blur(4px);padding:16px}
#vs .box,#vb .box,#js .box{background:var(--card);border-radius:18px;padding:22px;width:min(380px,100%);box-shadow:0 24px 70px rgba(0,0,0,.45)}
#ub{display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:center;padding:8px 14px;background:#5948f5;color:#fff;font-size:14px}#ub button{border:0;border-radius:8px;padding:4px 10px;font:inherit;font-weight:700;cursor:pointer}
#jt{display:flex;align-items:center;gap:6px;border:0;border-radius:10px;padding:8px 14px;background:#5948f5;color:#fff;font:inherit;font-weight:700;font-size:14px;cursor:pointer;box-shadow:0 4px 14px -4px rgba(89,72,245,.6);transition:.15s}#jt:hover{filter:brightness(1.1)}#jt:active{transform:scale(.97)}
#vs .box,#vb .box,#js .box{position:relative}
.x{float:right;position:sticky;top:0;z-index:2;display:grid;place-items:center;width:32px;height:32px;margin:-6px -6px 0 8px;padding:0;border:1px solid var(--line);border-radius:50%;background:var(--card);color:var(--ink);font:700 15px/1 system-ui,sans-serif;cursor:pointer}.x:hover{background:var(--bg)}
#js .x,#vs .x{position:absolute;float:none;top:10px;right:10px;margin:0}
#js input{text-transform:uppercase;letter-spacing:.3em;text-align:center;font-size:20px;font-weight:700}#js .btn:not(.ghost){background:var(--acc)}#jmsg{color:var(--bad);min-height:20px;font-size:13px;margin:8px 0 0}
@media(max-width:400px){#jt span{display:none}#jt{padding:8px 10px}}
`;document.head.append(css);

// ---- menu bar (desktop top menu + mobile bottom tabs); buttons reuse the app's data-go navigation ----
const I=p=>`<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
const IC={dash:I('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
 events:I('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
 mine:I('<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>'),new:I('<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>')};
const hdr=$('header'),nav=$('#nav'),tb=hdr.querySelector(':scope>button.btn');
const mk=(t,id)=>{const e=document.createElement(t);if(id)e.id=id;return e};
const mb=mk('div','mb'),bn=mk('div','bn'),av=mk('button','av'),um=mk('div','um'),vs=mk('div','vs'),vb=mk('div','vb'),ub=mk('div','ub');
[um,vs,vb,ub].forEach(e=>e.classList.add('hid'));
const jt=mk('button','jt'),js=mk('div','js');jt.dataset.u='join';jt.setAttribute('aria-label','Join team');jt.innerHTML=I('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-3.5 3.2-5.5 6.5-5.5s6 2 6.5 5.5M19 8v6M16 11h6"/>')+'<span>Join team</span>';jt.classList.add('hid');js.classList.add('hid');
av.setAttribute('aria-label','Account menu');hdr.insertBefore(mb,nav);hdr.append(jt,av);hdr.after(ub);document.body.append(bn,um,vs,vb,js);
function paint(){
 const h=[...nav.querySelectorAll('button')].map(b=>{const m=b.textContent.match(/^(.*?)\s*\((\d+)\)\s*$/),on=b.classList.contains('on'),g=b.dataset.go;
  return `<button data-go="${g}" class="${on?'on':''}" ${on?'aria-current="page"':''}>${IC[g]||''}<span>${m?m[1]:b.textContent}</span>${m?`<em>${m[2]}</em>`:''}</button>`}).join('');
 mb.innerHTML=h;bn.innerHTML=h;av.textContent=(window.MYNAME||'?').trim().slice(0,1).toUpperCase();
}
new MutationObserver(paint).observe(nav,{childList:true});
new MutationObserver(()=>{const e=$('#app .empty');if(e&&/^No upcoming/.test(e.textContent)&&!e.querySelector('button'))e.insertAdjacentHTML('beforeend','<div><button class="btn" data-go="new">Create your first event</button></div>')}).observe($('#app'),{childList:true});
paint();render();

// ---- version control (Firestore doc appconfig/version, read-only for the app, edited in the Firebase console) ----
const cmp=(a,b)=>{a=String(a).split('.').map(Number);b=String(b).split('.').map(Number);for(let i=0;i<3;i++){const d=(a[i]||0)-(b[i]||0);if(d)return d>0?1:-1}return 0};
// 3.7.2: only the installed Android app (Capacitor) can be out of date. The website always serves the latest deployed files.
const isApp=()=>{const K=window.Capacitor;return !!(K&&K.isNativePlatform&&K.isNativePlatform())};
const newer=()=>isApp()&&CFG&&CFG.latest&&cmp(APP_VERSION,CFG.latest)<0;
function gate(){
 if(!isApp()){vb.classList.add('hid');ub.classList.add('hid');return}   // website: never block or nag
 if(CFG&&CFG.min&&cmp(APP_VERSION,CFG.min)<0){vb.innerHTML=`<div class="box"><h3>Update required</h3><p class="meta">This version (v${APP_VERSION}) is no longer supported. Please update to v${esc(CFG.latest||CFG.min)} to continue.</p>${CFG.notes?`<p class="meta">${esc(CFG.notes)}</p>`:''}<button class="btn" data-u="upd" style="width:100%">Update now</button></div>`;vb.classList.remove('hid');return}
 vb.classList.add('hid');
 if(newer()&&localStorage.getItem('campus-ver-dismiss')!==String(CFG.latest)){ub.innerHTML=`<span>Version ${esc(CFG.latest)} is available.</span><button data-u="upd">Update</button><button data-u="about">What's new</button><button data-u="dis" aria-label="Dismiss">✕</button>`;ub.classList.remove('hid')}else ub.classList.add('hid');
}
async function check(force){
 if(!isApp()){gate();if(force)about();return}   // website: no version lookup (also saves a Firestore read)
 if(force||!CFG||Date.now()-(CFG.t||0)>6*36e5){   // at most one Firestore read per 6 hours (free-plan friendly)
  try{if(window.firebase&&firebase.apps.length){const s=await firebase.firestore().collection('appconfig').doc('version').get();
   if(s.exists){CFG=Object.assign({t:Date.now()},s.data());localStorage.setItem('campus-ver',JSON.stringify(CFG))}else if(force)toast('No version info published yet')}}
  catch(e){if(force)toast('Could not check for updates')}
 }
 gate();if(force)about();
}
const update=()=>isApp()&&CFG&&CFG.url?window.open(CFG.url,'_blank'):location.replace(location.pathname+'?v='+Date.now());
function about(){
 if(!isApp()){   // website: no update status, only a reload for a stale browser cache
  vs.innerHTML=`<div class="box"><button type="button" class="x" data-u="x" aria-label="Close">✕</button><h3>Campus Events</h3><p class="meta">Version ${APP_VERSION} · build ${BUILD}</p><p><b>Web version</b></p><p class="meta">The website always uses the latest version. If something looks old, reload to fetch the newest files.</p>
 <div class="row"><button class="btn" data-u="upd">Reload</button><button class="btn ghost" data-u="x">Close</button></div></div>`;vs.classList.remove('hid');return}
 const c=CFG||{},st=!c.latest?'Not checked yet':newer()?'Update available: v'+c.latest:'You are up to date';
 vs.innerHTML=`<div class="box"><button type="button" class="x" data-u="x" aria-label="Close">✕</button><h3>Campus Events</h3><p class="meta">Version ${APP_VERSION} · build ${BUILD}</p><p><b>${esc(st)}</b></p>${c.notes?`<p class="meta">${esc(c.notes)}</p>`:''}
 <div class="row"><button class="btn" data-u="chk">Check for updates</button>${newer()?'<button class="btn" data-u="upd">Update now</button>':''}<button class="btn ghost" data-u="x">Close</button></div></div>`;vs.classList.remove('hid');
}

// ---- account menu ----
function openUM(){
 const u=window.firebase&&firebase.apps.length?firebase.auth().currentUser:null;
 um.innerHTML=`<div class="uh"><b>${esc(window.MYNAME||'Guest')}</b><span>${esc(u?u.email:'Not signed in')}</span></div>
 <button data-u="acct">Account, alerts & join event</button><button data-u="help">Help & guides</button><button data-u="theme">Theme <small>${theme}</small></button>
 <button data-u="about">About & updates <small>v${APP_VERSION}</small></button>${u?'<button data-u="out" class="dg">Sign out</button>':''}`;
 um.classList.toggle('hid');
}
document.addEventListener('click',e=>{
 const t=e.target.closest('button');
 if(e.target===vs)vs.classList.add('hid');if(e.target===js)js.classList.add('hid');
 if(!e.target.closest('#um')&&t!==av)um.classList.add('hid');
 if(t===av)return openUM();
 const u=t&&t.dataset.u;if(!u)return;um.classList.add('hid');
 if(u==='acct'){const p=$('#tp');if(tb&&(!p||p.classList.contains('hid')))tb.click()}   // open (never toggle shut) the account / alerts / join panel
 else if(u==='theme'){theme={auto:'light',light:'dark',dark:'auto'}[theme];localStorage.setItem('campus-theme',theme);applyTheme();toast('Theme: '+theme)}
 else if(u==='help'){if(window.openHelp)openHelp();else toast('Help did not load. Reload the app.')}
 else if(u==='about')about();
 else if(u==='chk')check(true);
 else if(u==='upd')update();
 else if(u==='dis'){localStorage.setItem('campus-ver-dismiss',String(CFG.latest));ub.classList.add('hid')}
 else if(u==='x')vs.classList.add('hid');
 else if(u==='join'){js.innerHTML='<div class="box"><button type="button" class="x" data-u="jx" aria-label="Close">✕</button><h3>Join a team</h3><p class="meta">Enter the 6-letter event code your organiser shared with you.</p><input id="jcode" maxlength="6" autocomplete="off" autocapitalize="characters" aria-label="Event code"><p id="jmsg" role="alert"></p><div class="row" style="margin-top:6px"><button class="btn" data-u="jgo">Join</button><button class="btn ghost" data-u="jx">Cancel</button></div></div>';js.classList.remove('hid');setTimeout(()=>{const i=$('#jcode');i&&i.focus()},50)}
 else if(u==='jgo')joinEvent($('#jcode').value);
 else if(u==='jx')js.classList.add('hid');
 else if(u==='out'&&window.firebase)(window.cemSignOut?window.cemSignOut():firebase.auth().signOut());
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){um.classList.add('hid');vs.classList.add('hid');js.classList.add('hid');const p=$('#tp');if(p)p.classList.add('hid')}if(e.key==='Enter'&&e.target.id==='jcode')joinEvent(e.target.value)});
// tapping outside the account / alerts panel closes it (the path is read now, because the panel may redraw itself during the click)
document.addEventListener('click',e=>{
 const p=$('#tp');if(!p||p.classList.contains('hid'))return;
 const path=e.composedPath?e.composedPath():[];
 if(path.some(n=>n&&(n===tb||n.id==='tp'||n.id==='um'||n.id==='av'||n.id==='jt'||n.id==='js'||(n.dataset&&n.dataset.u))))return;   // n===tb: the menu opens the panel by clicking the hidden Team button; that click must not count as "outside"
 p.classList.add('hid');
});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)check()});

// ---- join by code. Works with the private rules (no read of the event is needed before joining) ----
async function joinEvent(code){
 code=(code||'').trim().toUpperCase();const m=js.classList.contains('hid')?null:$('#jmsg'),say=t=>m?m.textContent=t:toast(t);
 if(!/^[A-Z]{6}$/.test(code))return say('Enter the 6-letter event code.');
 const u=firebase.auth().currentUser;if(!u)return say('Sign in first.');
 if(S.events.some(e=>e.id===code))return say('You are already in this event.');
 try{await firebase.firestore().collection('events').doc(code).update({['members.'+u.uid]:{name:u.displayName||u.email,role:'member'},memberIds:firebase.firestore.FieldValue.arrayUnion(u.uid)});
  js.classList.add('hid');$('#tp').classList.add('hid');toast('Joined the team');go('events')}
 catch(x){say(x.code==='permission-denied'||x.code==='not-found'?'Invalid code. Check it with your organiser.':'Could not join: '+(x.message||x.code))}
}
// the old Join button inside the account panel uses the same private-safe flow
document.addEventListener('click',e=>{if(e.target.closest('#jb')){e.stopPropagation();joinEvent(($('#jc')||{}).value)}},true);

// ---- privacy on shared phones: show the join button only when signed in; drop another user's cached team events ----
if(window.firebase&&firebase.apps.length)firebase.auth().onAuthStateChanged(u=>{
 jt.classList.toggle('hid',!u);
 const last=localStorage.getItem('campus-uid');
 if(!u||(last&&last!==u.uid)){S.events=S.events.filter(e=>!e.cloud);const ok=new Set(S.events.map(e=>e.id));S.regs=S.regs.filter(r=>ok.has(r.eid));try{localStorage.setItem('campus-events-v1',JSON.stringify(S))}catch(x){}render()}
 if(u)localStorage.setItem('campus-uid',u.uid);
});
gate();check();
})();
