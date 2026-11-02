/* CEM 4.2.0: side panel.
   The event page used to show every section (Details, Attendees, Tasks, People, Payments, Income, Expenses, Chat) as one
   crowded tab strip, with more sub-menus inside Attendees and Expenses. They now live in a side panel instead:
     Main     Dashboard, Events, My tasks, New event
     Event    Details
     Attendees  All attendees, Check-in, Add attendee, Email attendees, Online sign-ups
     Team     Tasks, People, Chat
     Money    Payments, Income, Budget, Bills, Vendors
   - Phones and narrow screens: the menu button (top left) slides the panel in over the page. Phones can also swipe it away.
   - Wide screens (1100px and up): the panel stays open on the left.
   - The event groups appear only while an event is open, and only the items your role may use (same rules as before).
   Nothing about the data or the other screens changes: the panel just sets the same view state the tabs used to set
   (V.dt, V.av, V.xv) and calls render(). Loads last, after event.js, ui.js and motion.js. */
(function(){
'use strict';
const hdr=document.querySelector('header');
if(!hdr||typeof render!=='function'||typeof ev!=='function')return;
const root=document.documentElement,body=document.body;

const LS={get(k,d){try{return JSON.parse(localStorage.getItem(k))||d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const KEY='cem-drawer-closed-v2',COL=LS.get(KEY,{});   // groups the person has folded: {attendees:true}

/* ---------- icons ---------- */
const svg=p=>`<svg class="dr-i" viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
const P={
 dash:'<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
 events:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
 mine:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
 add:'<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
 users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
 scan:'<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10"/>',
 userplus:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
 mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
 globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
 tasks:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="m9 9 1.5 1.5L14 7M9 16h6"/>',
 people:'<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c.5-3.2 3-5 6-5s5.5 1.8 6 5M16 14.5c2.6 0 4.5 1.4 5 4"/>',
 chat:'<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
 card:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
 income:'<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
 budget:'<path d="M21 12A9 9 0 1 1 12 3v9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>',
 bill:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
 store:'<path d="M4 9l1.5-5h13L20 9"/><path d="M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9"/><path d="M5 12v8h14v-8"/>',
 help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/>',
 acct:'<circle cx="12" cy="8" r="4"/><path d="M4 21c.7-4 3.7-6 8-6s7.3 2 8 6"/>',
 chev:'<path d="m6 9 6 6 6-6"/>',
 swap:'<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
 x:'<path d="M6 6l12 12M18 6 6 18"/>',
 menu:'<path d="M4 7h16M4 12h16M4 17h16"/>'
};
const LOGO='<svg class="dr-logo" viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="120" fill="#5948F5"/><path fill="#F6F7FB" transform="translate(136.4 105.2) scale(1.3)" d="M34 0 H160 A24 24 0 0 1 184 24 A24 24 0 0 1 160 48 H62 A14 14 0 0 0 48 62 V78 A14 14 0 0 0 62 92 H160 A24 24 0 0 1 184 116 A24 24 0 0 1 160 140 H62 A14 14 0 0 0 48 154 V170 A14 14 0 0 0 62 184 H160 A24 24 0 0 1 184 208 A24 24 0 0 1 160 232 H34 A34 34 0 0 1 0 198 V34 A34 34 0 0 1 34 0 Z"/></svg>';

/* ---------- what goes in the panel ---------- */
const mineN=()=>{const m=window.mineCount?/\d+/.exec(mineCount()):null;return m?+m[0]:0};
const curEvent=()=>V.tab==='detail'?ev(V.eid):null;

// global items: they reuse the app's own data-go buttons
function mainItems(){
 return [
  {k:'go:dash',l:'Dashboard',i:'dash',go:'dash',on:V.tab==='dash'},
  {k:'go:events',l:'Events',i:'events',go:'events',on:V.tab==='events',n:S.events.length},
  {k:'go:mine',l:'My tasks',i:'mine',go:'mine',on:V.tab==='mine',n:mineN(),hot:1},
  {k:'go:new',l:'New event',i:'add',go:'new',on:V.tab==='new'}];
}

// event groups: same permission rules as the old tab strip (event.js: tabsFor, avViews)
function eventGroups(e){
 const can_=a=>window.can?can(e,a):true;
 const rs=regsOf(e.id),pn=window.regPendingN?regPendingN(e):0;
 const open=(e.tasks||[]).filter(t=>!t.done).length+(e.itm||[]).filter(i=>i.s!=='bought').length;
 const G=[{id:'event',t:'Event',items:[{k:'info',l:'Details',i:'info',dt:'info'}]}];
 const a=[{k:'regs',l:'All attendees',i:'users',dt:'regs',av:'list',n:rs.length}];
 if(can_('regs'))a.push({k:'in',l:'Check-in',i:'scan',dt:'regs',av:'in'});
 if(can_('addreg')||can_('regs'))a.push({k:'add',l:'Add attendee',i:'userplus',dt:'regs',av:'add'});
 if(can_('regs'))a.push({k:'mail',l:'Email attendees',i:'mail',dt:'regs',av:'mail'});
 if(can_('pay'))a.push({k:'reg',l:'Online sign-ups',i:'globe',dt:'regs',av:'reg',n:pn,hot:1});
 G.push({id:'attendees',t:'Attendees',items:a});
 G.push({id:'team',t:'Team',items:[
  {k:'tasks',l:'Tasks',i:'tasks',dt:'tasks',n:open},
  {k:'people',l:'People',i:'people',dt:'people',n:window.peopleOf?peopleOf(e).length:0},
  {k:'chat',l:'Chat',i:'chat',dt:'chat',dot:!!(window.chatDot&&chatDot(e))}]});
 const m=[{k:'pay',l:'Payments',i:'card',dt:'pay',n:window.payPendingN?payPendingN(e):0,hot:1}];
 if(can_('exp')){
  const bills=(e.exp||[]).filter(x=>x.s!=='paid').length,od=window.billsOverdueN?billsOverdueN(e):0;
  m.push({k:'inc',l:'Income',i:'income',dt:'inc'},
   {k:'xb',l:'Budget',i:'budget',dt:'exp',xv:'budget'},
   {k:'xl',l:'Bills',i:'bill',dt:'exp',xv:'bills',n:bills,hot:od>0},
   {k:'xv',l:'Vendors',i:'store',dt:'exp',xv:'vendors',n:(e.ven||[]).length});
 }
 G.push({id:'money',t:'Money',items:m});
 G.forEach(g=>g.items.forEach(it=>{it.on=V.tab==='detail'&&V.dt===it.dt&&(!it.av||(V.av||'list')===it.av)&&(!it.xv||(V.xv||'budget')===it.xv)}));
 return G;
}

// events to jump to when none is open: upcoming first, then the most recent past ones
function jumpItems(){
 const d=new Date(),t=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
 const key=e=>(e.date||'')+' '+(e.time||'00:00');
 const up=S.events.filter(e=>(e.date||'')>=t).sort((a,b)=>key(a).localeCompare(key(b)));
 const past=S.events.filter(e=>(e.date||'')<t).sort((a,b)=>key(b).localeCompare(key(a)));
 return up.concat(past).slice(0,5).map(e=>({k:'open:'+e.id,l:e.name||'Untitled event',open:e.id,color:(window.TYPES&&TYPES[e.type])||'var(--acc)'}));
}

/* ---------- drawing ---------- */
const initials=s=>{const w=String(s||'').split(/[^A-Za-z0-9]+/).filter(Boolean);return ((w[0]||'?')[0]+(w[1]?w[1][0]:'')).toUpperCase()};
let ix=0;   // position in the entrance sequence (CSS --i), reset on every paint
const st=()=>` style="--i:${Math.min(ix++,14)}"`;
function item(it){
 const at=it.go?`data-go="${it.go}"`:it.open?`data-open="${esc(it.open)}"`:`data-sp-dt="${it.dt}"${it.av?` data-sp-av="${it.av}"`:''}${it.xv?` data-sp-xv="${it.xv}"`:''}`;
 const lead=it.i?svg(P[it.i]):`<span class="dr-i dr-sw" style="--c:${it.color}"></span>`;
 const tail=it.n>0?`<em class="dr-n${it.hot?' hot':''}">${it.n}</em>`:it.dot?'<i class="dr-dot" role="img" aria-label="Unread messages"></i>':'';
 return `<button type="button" class="dr-it${it.on?' on':''}" data-spk="${esc(it.k)}" ${at}${it.on?' aria-current="page"':''}${st()}>${lead}<span class="dr-l">${esc(it.l)}</span>${tail}</button>`;
}
function group(g){
 const c=!!COL[g.id];
 return `<section class="dr-g"><button type="button" class="dr-gh" data-spk="g:${g.id}" data-sp-g="${g.id}" aria-expanded="${!c}" aria-controls="drg-${g.id}"${st()}><span>${esc(g.t)}</span>${svg(P.chev)}</button><div class="dr-gb${c?' c':''}" id="drg-${g.id}"><div class="dr-gbi">${g.items.map(item).join('')}</div></div></section>`;
}
function who(e){
 if(e){
  const c=(window.TYPES&&TYPES[e.type])||'#5948f5',d0=new Date((e.date||'')+'T00:00'),dt=isNaN(d0)?'':d0.toLocaleDateString([],{day:'numeric',month:'short'});
  return `<button type="button" class="dr-who" data-go="events" data-spk="who" aria-label="Open event: ${esc(e.name)}. Switch to another event"${st()}><span class="dr-av" style="--c:${c}">${esc(initials(e.name))}</span><span class="dr-wt"><b>${esc(e.name)}</b><small>${esc(e.type)}${dt?' · '+esc(dt):''}</small></span>${svg(P.swap)}</button>`;
 }
 const nm=String(window.MYNAME||'').trim()||'Guest',n=S.events.length,pic=window.cemPicOf?cemPicOf(null,window.MYUID):'';   // 4.3.0: profile photo
 return `<div class="dr-who"${st()}><span class="dr-av${pic?' dr-pic':''}">${pic?`<img src="${esc(pic)}" alt="">`:esc(initials(nm))}</span><span class="dr-wt"><b>${esc(nm)}</b><small>${n} event${n===1?'':'s'}</small></span></div>`;
}

const dr=document.createElement('aside'),scrim=document.createElement('div'),hb=document.createElement('button');
dr.id='drw';dr.className='dr';dr.setAttribute('aria-label','Main menu');
// the frame is built once; only the event card and the list are redrawn, so the active-item pill can glide between items
dr.innerHTML=`<div class="dr-top" style="--i:0">${LOGO}<span class="dr-brand">Campus <b>Events</b></span><button type="button" class="dr-x" data-sp-close="1" aria-label="Close menu">${svg(P.x)}</button></div><div id="drs"></div><div class="dr-nav" id="drn"><i class="dr-pill" id="drp" aria-hidden="true"></i><div id="drc"></div></div><div class="dr-foot"><button type="button" class="dr-it" data-u="help" data-spk="help" style="--i:13">${svg(P.help)}<span class="dr-l">Help &amp; guides</span></button><button type="button" class="dr-it" data-u="acct" data-spk="acct" style="--i:14">${svg(P.acct)}<span class="dr-l">Account &amp; join event</span></button></div>`;
const slot=dr.querySelector('#drs'),cont=dr.querySelector('#drc'),pill=dr.querySelector('#drp');
scrim.id='drx';scrim.className='dr-scrim';
hb.id='drb';hb.type='button';hb.className='drb';hb.setAttribute('aria-label','Open menu');hb.setAttribute('aria-controls','drw');hb.setAttribute('aria-expanded','false');hb.innerHTML=svg(P.menu);
hdr.insertBefore(hb,hdr.firstChild);body.append(scrim,dr);

let isOpen=false,returnTo=null,placed=false,enterT=0;
const mq=window.matchMedia?matchMedia('(min-width:1100px)'):{matches:false};
const docked=()=>!!mq.matches;

// the purple pill sits behind the active item and glides to the next one
function place(snap){
 const on=cont.querySelector('.dr-it.on');
 if(!on||on.closest('.dr-gb.c')){pill.classList.remove('show');return}
 const y=on.offsetTop,h=on.offsetHeight;
 if(!h)return;   // panel not laid out (yet)
 if(snap||!placed)pill.style.transition='none';
 else if(pill.style.transition==='none'){void pill.offsetWidth;pill.style.transition=''}
 pill.style.transform=`translateY(${y}px)`;pill.style.height=h+'px';
 pill.classList.add('show');placed=true;
}
// while a group folds or unfolds, keep the pill on its item frame by frame
function track(){
 const t0=performance.now(),f=()=>{place(true);if(performance.now()-t0<360)requestAnimationFrame(f)};
 requestAnimationFrame(f);
}

function paint(){
 const e=curEvent(),keep=document.activeElement,fk=keep&&dr.contains(keep)?keep.getAttribute('data-spk'):null;
 ix=1;
 slot.innerHTML=who(e);
 let h=`<div class="dr-main">${mainItems().map(item).join('')}</div>`;
 if(e)h+=eventGroups(e).map(group).join('');
 else if(S.events.length)h+=group({id:'jump',t:'Your events',items:jumpItems()});
 else h+='<p class="dr-hint">Create an event to manage attendees, tasks and money from here.</p>';
 cont.innerHTML=h;
 if(fk){const f=[...dr.querySelectorAll('[data-spk]')].find(x=>x.getAttribute('data-spk')===fk);if(f)f.focus({preventScroll:true})}
 place(!(isOpen||docked()));
}

function sync(){   // panel mode (docked / slide-over) and the state that depends on it
 const dk=docked();
 body.classList.toggle('dr-dock',dk);
 dr.setAttribute('role',dk?'navigation':'dialog');
 if(dk&&isOpen)setOpen(false,true);
 dr.toggleAttribute('inert',!dk&&!isOpen);
 hb.hidden=dk;
 place(true);
}
function setOpen(v,quiet){
 if(docked())v=false;
 isOpen=v;
 dr.classList.toggle('open',v);scrim.classList.toggle('on',v);
 root.classList.toggle('dr-lock',v);
 hb.setAttribute('aria-expanded',String(v));
 dr.toggleAttribute('inert',!v&&!docked());
 clearTimeout(enterT);
 if(v){dr.setAttribute('aria-modal','true');returnTo=document.activeElement;
  dr.classList.remove('dr-enter');paint();place(true);
  void dr.offsetWidth;dr.classList.add('dr-enter');enterT=setTimeout(()=>dr.classList.remove('dr-enter'),900);   // one staggered entrance per opening
  const t=dr.querySelector('#drc .dr-it.on')||dr.querySelector('.dr-it');
  if(t){t.focus({preventScroll:true});t.scrollIntoView&&t.scrollIntoView({block:'nearest'});place(true)}}
 else{dr.classList.remove('dr-enter');dr.removeAttribute('aria-modal');
  if(!quiet&&returnTo&&returnTo.focus&&document.contains(returnTo))returnTo.focus({preventScroll:true});returnTo=null}
}

/* ---------- section title (replaces the old tab strip on the event page) ---------- */
function sectionBar(e){
 for(const g of eventGroups(e))for(const it of g.items)if(it.on)
  return `<div class="dr-bar"><h3>${esc(it.l)}</h3>${g.id==='event'?'':`<span>${esc(g.t)}</span>`}</div>`;
 return '';
}
const eventPage0=window.eventPage;
if(typeof eventPage0==='function')window.eventPage=function(e){
 const h=eventPage0.apply(this,arguments);
 let bar='';try{bar=sectionBar(e)}catch(x){}
 return h.replace(/<div class="tabs"[\s\S]*?<\/div>/,()=>bar);
};

// repaint the panel after every screen change (active item, badges, event groups)
const render0=window.render;
window.render=function(){
 const r=render0.apply(this,arguments);
 try{paint()}catch(x){if(window.console)console.error('side panel',x)}
 return r;
};

/* ---------- actions ---------- */
// capture phase: runs before the app's own listeners, which re-render the page (and this panel) and would detach the clicked button
document.addEventListener('click',x=>{
 if(x.target===scrim){setOpen(false);return}
 const b=x.target.closest('button');if(!b)return;
 if(b===hb){setOpen(!isOpen);return}
 if(!dr.contains(b))return;
 const D=b.dataset;
 if(D.spClose!==undefined){setOpen(false);return}
 if(D.spG){   // fold / unfold in place (no redraw), so the height and the arrow animate
  const c=!COL[D.spG];COL[D.spG]=c;LS.set(KEY,COL);
  const gb=b.closest('.dr-g').querySelector('.dr-gb');gb.classList.toggle('c',c);b.setAttribute('aria-expanded',String(!c));track();return;
 }
 if(D.spDt){
  const E=curEvent();if(!E)return;
  V.dt=D.spDt;
  if(D.spAv){if(V.av!==D.spAv)V.rq='';V.av=D.spAv}
  if(D.spXv){V.xv=D.spXv;V.xa=false;V.xq=null;V.xp=null;V.xvp=''}
  render();scrollTo(0,0);
 }
 // data-go / data-open / data-u buttons are handled by the app's own listeners; the panel only closes
 setOpen(false);
},true);
document.addEventListener('keydown',x=>{
 if(!isOpen)return;
 if(x.key==='Escape'){x.preventDefault();setOpen(false);return}
 if(x.key!=='Tab')return;
 const f=[...dr.querySelectorAll('button:not([hidden])')].filter(b=>b.offsetParent!==null||b===document.activeElement);
 if(!f.length)return;
 const a=f[0],z=f[f.length-1];
 if(x.shiftKey&&(document.activeElement===a||!dr.contains(document.activeElement))){x.preventDefault();z.focus()}
 else if(!x.shiftKey&&(document.activeElement===z||!dr.contains(document.activeElement))){x.preventDefault();a.focus()}
});
// swipe the panel to the left to close it (phones)
let sx=null,sy=0;
dr.addEventListener('touchstart',x=>{const t=x.touches[0];sx=t.clientX;sy=t.clientY},{passive:true});
dr.addEventListener('touchend',x=>{
 if(sx===null)return;const t=x.changedTouches[0],dx=t.clientX-sx,dy=Math.abs(t.clientY-sy);sx=null;
 if(isOpen&&dx<-60&&dy<50)setOpen(false);
},{passive:true});
if(mq.addEventListener)mq.addEventListener('change',sync);else if(mq.addListener)mq.addListener(sync);

body.classList.add('dr-on');
sync();paint();render();
})();
