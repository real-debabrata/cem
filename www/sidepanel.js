/* CEM 4.4.0: navigation shell (this file replaces the 4.2.0 side panel; the file name is kept so nothing else has to change).

   One structure at every screen size, two levels deep, nothing folded or hidden:

     Areas      where you are.   No event open:  Dashboard, Events, My tasks, (New event)
                                 Event open:      Details, Attendees, Team, Money
                Wide screens: a sidebar on the left.  Phones and tablets: the bottom bar, which switches with the context.
     Sections   what you do there. A sticky tab strip under the top bar, always visible:
                Attendees  List, Check-in, Add, Email, Sign-ups
                Team       Tasks, People, Chat
                Money      Payments, Income, Budget, Bills, Vendors
     Quick find Ctrl/Cmd+K, "/" or the search button: type to jump to any event or function.

   Nothing about the data or the screens themselves changes. This file only sets the same view state the old tabs set
   (V.dt, V.av, V.xv) and calls render(). Same permission rules as before (event.js: tabsFor, avViews).
   Loads last, after event.js, ui.js and motion.js. */
(function(){
'use strict';
const hdr=document.querySelector('header');
if(!hdr||typeof render!=='function'||typeof ev!=='function')return;
const root=document.documentElement,body=document.body;

/* ---------- icons ---------- */
const svg=(p,c)=>`<svg class="${c||'dr-i'}" viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
const P={
 dash:'<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
 events:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
 mine:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
 add:'<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
 users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
 scan:'<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10"/>',
 userplus:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
 mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
 globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
 list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
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
 join:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-3.5 3.2-5.5 6.5-5.5s6 2 6.5 5.5M19 8v6M16 11h6"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
 back:'<path d="m15 18-6-6 6-6"/>',
 right:'<path d="m9 6 6 6-6 6"/>',
 edit:'<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/>',
 calc:'<rect x="5" y="2.5" width="14" height="19" rx="2.5"/><path d="M8.5 7h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01"/>',
 theme:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
 out:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
 phone:'<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M11 18h2"/>',
 doc:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>'
};
const LOGO='<svg class="dr-logo" viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="120" fill="#5948F5"/><path fill="#F6F7FB" transform="translate(136.4 105.2) scale(1.3)" d="M34 0 H160 A24 24 0 0 1 184 24 A24 24 0 0 1 160 48 H62 A14 14 0 0 0 48 62 V78 A14 14 0 0 0 62 92 H160 A24 24 0 0 1 184 116 A24 24 0 0 1 160 140 H62 A14 14 0 0 0 48 154 V170 A14 14 0 0 0 62 184 H160 A24 24 0 0 1 184 208 A24 24 0 0 1 160 232 H34 A34 34 0 0 1 0 198 V34 A34 34 0 0 1 34 0 Z"/></svg>';

/* ---------- the model: areas and sections ---------- */
// TYPES is a top-level const in index.html (not a window property)
const typeColor=(e,d)=>(typeof TYPES!=='undefined'&&TYPES[e.type])||(d===undefined?'#5948f5':d);
const mineN=()=>{const m=window.mineCount?/\d+/.exec(mineCount()):null;return m?+m[0]:0};
const curEvent=()=>V.tab==='detail'?ev(V.eid):null;
const LAST={};   // last section the person used in each area, so tapping an area returns to it

// global areas (no event open)
function mainAreas(){
 return [
  {id:'dash',l:'Dashboard',i:'dash',go:'dash',on:V.tab==='dash'},
  {id:'events',l:'Events',i:'events',go:'events',on:V.tab==='events',n:S.events.length,quiet:1},
  {id:'mine',l:'My tasks',i:'mine',go:'mine',on:V.tab==='mine',n:mineN(),hot:1},
  {id:'new',l:'New event',i:'add',go:'new',on:V.tab==='new'}];
}

// event areas, each with its sections. Same permission rules as the old tab strip (event.js: tabsFor, avViews)
function areasOf(e){
 const c=a=>window.can?can(e,a):true;
 const rs=regsOf(e.id),pn=window.regPendingN?regPendingN(e):0;
 const open=(e.tasks||[]).filter(t=>!t.done).length+(e.itm||[]).filter(i=>i.s!=='bought').length;
 const A=[];
 A.push({id:'details',l:'Details',i:'info',secs:[
  {k:'info',l:'Details',s:'Details',i:'info',dt:'info',kw:'overview event info date venue code invite team export download delete leave'}]});
 const a=[{k:'regs',l:'All attendees',s:'List',i:'list',dt:'regs',av:'list',n:rs.length,kw:'people registered search find list names'}];
 if(c('regs'))a.push({k:'in',l:'Check-in',s:'Check-in',i:'scan',dt:'regs',av:'in',kw:'scan qr ticket gate arrive arrival door entry'});
 if(c('addreg')||c('regs'))a.push({k:'add',l:'Add attendee',s:'Add',i:'userplus',dt:'regs',av:'add',kw:'register new person manual import csv spreadsheet'});
 if(c('regs'))a.push({k:'mail',l:'Email attendees',s:'Email',i:'mail',dt:'regs',av:'mail',kw:'mail invite invitation ticket send message'});
 if(c('pay'))a.push({k:'reg',l:'Online sign-ups',s:'Sign-ups',i:'globe',dt:'regs',av:'reg',n:pn,hot:1,kw:'registration form link approve approval waitlist cash collector public'});
 A.push({id:'attendees',l:'Attendees',i:'users',secs:a,badge:{n:pn,hot:1}});
 const t=[
  {k:'tasks',l:'Tasks',s:'Tasks',i:'tasks',dt:'tasks',n:open,kw:'todo to-do shopping list items to buy groups assign due'},
  {k:'people',l:'People',s:'People',i:'people',dt:'people',n:window.peopleOf?peopleOf(e).length:0,kw:'team members roles permissions participants teams'},
  {k:'chat',l:'Chat',s:'Chat',i:'chat',dt:'chat',dot:!!(window.chatDot&&chatDot(e)),kw:'message discuss talk group'}];
 A.push({id:'team',l:'Team',i:'people',secs:t,badge:{dot:t[2].dot}});
 const pp=window.payPendingN?payPendingN(e):0,m=[{k:'pay',l:'Payments',s:'Payments',i:'card',dt:'pay',n:pp,hot:1,kw:'upi cash paid fee collect money'}];
 let od=0;
 if(c('exp')){
  const bills=(e.exp||[]).filter(x=>x.s!=='paid').length;od=window.billsOverdueN?billsOverdueN(e):0;
  m.push({k:'inc',l:'Income',s:'Income',i:'income',dt:'inc',kw:'sponsor sponsors donation revenue earn'},
   {k:'xb',l:'Budget',s:'Budget',i:'budget',dt:'exp',xv:'budget',kw:'plan spend categories expenses cost'},
   {k:'xl',l:'Bills',s:'Bills',i:'bill',dt:'exp',xv:'bills',n:bills,hot:od>0,kw:'expenses invoice due overdue pay vendor'},
   {k:'xv',l:'Vendors',s:'Vendors',i:'store',dt:'exp',xv:'vendors',n:(e.ven||[]).length,kw:'suppliers contacts shops'});
 }
 A.push({id:'money',l:'Money',i:'card',secs:m,badge:{n:pp+od,hot:1}});
 A.forEach(a=>{
  a.secs.forEach(s=>{s.on=V.tab==='detail'&&V.dt===s.dt&&(!s.av||(V.av||'list')===s.av)&&(!s.xv||(V.xv||'budget')===s.xv);s.area=a.id});
  a.on=a.secs.some(s=>s.on);
  const on=a.secs.find(s=>s.on);if(on)LAST[e.id+':'+a.id]=on.k;
 });
 return A;
}

function goSec(s){
 V.dt=s.dt;
 if(s.av){if(V.av!==s.av)V.rq='';V.av=s.av}
 if(s.xv){V.xv=s.xv;V.xa=false;V.xq=null;V.xp=null;V.xvp=''}
 render();scrollTo(0,0);
}
// open an event straight on a section (dashboard shortcuts, quick find)
window.cemOpen=function(eid,dt,av,xv){
 if(!ev(eid))return;
 window.resetEv&&resetEv();V.dt=dt||'info';
 if(av)V.av=av;if(xv)V.xv=xv;
 go('detail',eid);
};

/* ---------- drawing: sidebar (wide screens) and bottom bar (phones, tablets) ---------- */
const initials=s=>{const w=String(s||'').split(/[^A-Za-z0-9]+/).filter(Boolean);return ((w[0]||'?')[0]+(w[1]?w[1][0]:'')).toUpperCase()};
const badge=a=>{
 if(a.dot)return '<i class="dr-dot" role="img" aria-label="Unread messages"></i>';
 const n=a.n||0;if(n<=0)return '';
 return `<em class="dr-n${a.hot?' hot':''}${a.quiet?' quiet':''}">${n>99?'99+':n}</em>`;
};
function sideItem(a){
 const at=a.go?`data-go="${a.go}"`:`data-sp-area="${a.id}"`;
 return `<button type="button" class="dr-it${a.on?' on':''}" data-spk="${a.id}" ${at}${a.on?' aria-current="page"':''}>${svg(P[a.i])}<span class="dr-l">${esc(a.l)}</span>${badge(a.badge||a)}</button>`;
}
// events to jump to when none is open: upcoming first, then the most recent past ones
function upcoming(){
 const key=e=>(e.date||'')+' '+(e.time||'00:00'),gap=typeof dayGap==='function'?dayGap:()=>0;
 const up=S.events.filter(e=>gap(e)>=0).sort((a,b)=>key(a).localeCompare(key(b)));
 return up.length?up.slice(0,5):S.events.slice().sort((a,b)=>key(b).localeCompare(key(a))).slice(0,3);
}
function jumpItem(e){
 const g=typeof dayGap==='function'?dayGap(e):0,c=typeColor(e,'var(--acc)');
 const when=g<0?'Ended':g===0?'Today':g===1?'Tomorrow':new Date((e.date||'')+'T00:00').toLocaleDateString([],{day:'numeric',month:'short'});
 return `<button type="button" class="dr-it" data-spk="open:${esc(e.id)}" data-open="${esc(e.id)}"><span class="dr-sw" style="--c:${c}"></span><span class="dr-l">${esc(e.name||'Untitled event')}</span><em class="dr-n quiet">${esc(when)}</em></button>`;
}
function eventCard(e){
 const c=typeColor(e),g=typeof dayGap==='function'?dayGap(e):0;
 const when=g<0?'Ended':g===0?'Today':g===1?'Tomorrow':new Date((e.date||'')+'T00:00').toLocaleDateString([],{day:'numeric',month:'short'});
 return `<div class="dr-ev" style="--c:${c}"><span class="dr-av">${esc(initials(e.name))}</span><span class="dr-wt"><b>${esc(e.name)}</b><small>${esc(e.type)} · ${esc(when)}</small></span></div>`;
}
const side=document.createElement('aside');side.id='drw';side.className='dr';side.setAttribute('aria-label','Sidebar');
side.innerHTML=`<div class="dr-top">${LOGO}<span class="dr-brand">Campus <b>Events</b></span></div>
 <button type="button" class="dr-new" data-go="new">${svg(P.plus)}<span>New event</span></button>
 <nav class="dr-nav" id="drn" aria-label="Primary"></nav>
 <div class="dr-foot"><button type="button" class="dr-it" data-u="help" data-spk="help">${svg(P.help)}<span class="dr-l">Help &amp; guides</span></button><button type="button" class="dr-who" id="drwho" data-u="acct" data-spk="acct" aria-label="Account and join event"></button></div>`;
body.append(side);
const nav=side.querySelector('#drn'),who=side.querySelector('#drwho');
// account row: my photo (avatar.js) or initial, my name. Opens the same account menu as the top-bar circle
function paintWho(){
 const nm=String(window.MYNAME||'').trim()||'Guest',pic=window.cemPicOf?cemPicOf(null,window.MYUID):'';
 who.innerHTML=`<span class="dr-av${pic?' dr-pic':''}">${pic?`<img src="${esc(pic)}" alt="">`:esc(initials(nm))}</span><span class="dr-wt"><b>${esc(nm)}</b><small>Account &amp; join event</small></span>`;
}

let bar=document.getElementById('bn');
if(!bar){bar=document.createElement('div');bar.id='bn';body.append(bar)}
bar.setAttribute('role','navigation');

function barItem(a){
 const at=a.go?`data-go="${a.go}"`:`data-sp-area="${a.id}"`;
 return `<button type="button" ${at} class="${a.on?'on':''}"${a.on?' aria-current="page"':''}>${svg(P[a.i],'i')}<span>${esc(a.l)}</span>${badge(a.badge||(a.quiet?{}:a)).replace('dr-n','bn-n').replace('dr-dot','bn-dot')}</button>`;
}

function paint(){
 const e=curEvent(),keep=document.activeElement,fk=keep&&side.contains(keep)?keep.getAttribute('data-spk'):null;
 root.classList.toggle('in-event',!!e);
 let h=`<div class="dr-g"><div class="dr-gl">Workspace</div>${mainAreas().filter(a=>a.id!=='new').map(sideItem).join('')}</div>`;
 let items=mainAreas();
 if(e){
  const A=areasOf(e);
  h+=`<div class="dr-g">${eventCard(e)}${A.map(sideItem).join('')}</div>`;
  items=A;
 }else if(S.events.length)h+=`<div class="dr-g"><div class="dr-gl">Upcoming</div>${upcoming().map(jumpItem).join('')}</div>`;
 nav.innerHTML=h;paintWho();
 bar.innerHTML=items.map(barItem).join('');
 bar.setAttribute('aria-label',e?'Event sections':'Main');
 if(fk){const f=[...side.querySelectorAll('[data-spk]')].find(x=>x.getAttribute('data-spk')===fk);if(f)f.focus({preventScroll:true})}
 const sx=document.querySelector('.sx-t.on'),box=sx&&sx.parentElement;
 if(box&&box.scrollWidth>box.clientWidth)box.scrollLeft=Math.max(0,sx.offsetLeft-(box.clientWidth-sx.offsetWidth)/2);
}

/* ---------- event page: header and the section strip (replaces the old tab strip) ---------- */
function eventHead(e){
 const c=typeColor(e),g=typeof dayGap==='function'?dayGap(e):0;
 const when=typeof evWhen==='function'?evWhen(e,g):'';
 const v=typeof evVenue==='function'?evVenue(e.venue):'';
 const cap=+e.cap>0?+e.cap:0,n=regsOf(e.id).length;
 const scan=(!window.can||can(e,'regs'))&&!(V.dt==='regs'&&V.av==='in')
  ?`<button type="button" class="btn ep-scan" data-scan="1" aria-label="Scan tickets">${svg(P.scan,'ei')}<span>Scan tickets</span></button>`:'';
 return `<div class="ep${g===0?' today':g<0?' past':''}" style="--tc:${c}">
  <button type="button" class="ep-back" data-go="events" aria-label="Back to all events">${svg(P.back,'ei')}<span>Events</span></button>
  <div class="ep-t"><h2 title="${esc(e.name)}">${esc(e.name)}</h2>
   <div class="ep-m"><span class="evk"><i></i>${esc(e.type)}</span>${when?`<span class="ep-w">${esc(when)}</span>`:''}${v?`<span class="ep-v">${v}</span>`:''}<span class="ep-n">${n}${cap?' / '+cap:''} registered</span></div></div>
  <div class="ep-a">${scan}${window.calcBtnV||''}</div></div>`;
}
function strip(e){
 const a=areasOf(e).find(x=>x.on);
 if(!a||a.secs.length<2)return '';
 return `<div class="tabs sx" role="navigation" aria-label="${esc(a.l)} sections">${a.secs.map(s=>{
  const t=s.dot?'<i class="sx-dot" role="img" aria-label="Unread messages"></i>':s.n>0?`<em class="${s.hot?'hot':''}">${s.n>99?'99+':s.n}</em>`:'';
  return `<button type="button" class="sx-t${s.on?' on':''}" data-sp-dt="${s.dt}"${s.av?` data-sp-av="${s.av}"`:''}${s.xv?` data-sp-xv="${s.xv}"`:''}${s.on?' aria-current="page"':''}><span>${esc(s.s)}</span>${t}</button>`}).join('')}</div>`;
}
const eventPage0=window.eventPage;
if(typeof eventPage0==='function')window.eventPage=function(e){
 let h=eventPage0.apply(this,arguments);
 try{
  h=h.replace(/<div class="eh"[\s\S]*?<\/div>/,()=>eventHead(e));
  h=h.replace(/<div class="tabs"[\s\S]*?<\/div>/,()=>strip(e));
  if(V.dt==='info')h=h.replace(/<h2 style="margin-top:6px">[\s\S]*?<\/h2>/,'');   // the page header already shows the name
 }catch(x){if(window.console)console.error('shell',x)}
 return h;
};

// repaint after every screen change (active item, badges, event areas)
const render0=window.render;
window.render=function(){
 const r=render0.apply(this,arguments);
 try{paint()}catch(x){if(window.console)console.error('shell',x)}
 return r;
};

/* ---------- navigation clicks ---------- */
// capture phase: runs before the app's own listeners, which re-render the page and would detach the clicked button
document.addEventListener('click',x=>{
 const b=x.target.closest('button');if(!b)return;
 const D=b.dataset;
 if(D.spArea){
  const E=curEvent();if(!E)return;
  const a=areasOf(E).find(z=>z.id===D.spArea);if(!a)return;
  const s=a.on?a.secs.find(z=>z.on):(a.secs.find(z=>z.k===LAST[E.id+':'+a.id])||a.secs[0]);
  if(a.on&&a.secs.length>1){scrollTo({top:0,behavior:'smooth'});return}   // already here: tapping again scrolls to the top
  goSec(s);return;
 }
 if(D.spDt){
  if(!curEvent())return;
  goSec({dt:D.spDt,av:D.spAv,xv:D.spXv});return;
 }
 if(D.nx){   // "event id | section | view": dashboard shortcuts
  const p=D.nx.split('|');window.cemOpen(p[0],p[1],p[2],p[3]);
 }
},true);

/* ---------- quick find ---------- */
const mac=/Mac|iPhone|iPad/.test(navigator.platform||navigator.userAgent||'');
const qb=document.createElement('button');
qb.id='qfb';qb.type='button';qb.className='qfb';qb.setAttribute('aria-haspopup','dialog');qb.setAttribute('aria-label','Search events and functions');
qb.innerHTML=`${svg(P.search,'ei')}<span class="qfb-t">Search events and functions</span><kbd>${mac?'\u2318K':'Ctrl K'}</kbd>`;
const jt0=document.getElementById('jt');
hdr.insertBefore(qb,jt0||document.getElementById('av'));

const qf=document.createElement('div');qf.id='qf';qf.hidden=true;
qf.innerHTML=`<div class="qf-box" role="dialog" aria-modal="true" aria-label="Quick find">
 <div class="qf-in">${svg(P.search,'ei')}<input id="qfi" type="text" role="combobox" aria-expanded="true" aria-controls="qfl" aria-autocomplete="list" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="go" placeholder="Find an event or a function" aria-label="Find an event or a function"><button type="button" class="qf-x" data-qf="close" aria-label="Close"><span class="qk">Esc</span><span class="qt">Close</span></button></div>
 <div class="qf-list" id="qfl" role="listbox" aria-label="Results"></div>
 <div class="qf-ft"><span><kbd>\u2191</kbd><kbd>\u2193</kbd> to move</span><span><kbd>Enter</kbd> to open</span></div></div>`;
body.append(qf);
const qi=qf.querySelector('#qfi'),ql=qf.querySelector('#qfl');
let QR=[],QA=0,QBack=null;

// a button the app's own handlers (ui.js data-u, scan.js data-scan, ...) already understand
function fire(k,v){const b=document.createElement('button');b.type='button';b.hidden=true;b.dataset[k]=v;body.append(b);b.click();b.remove()}
const signedIn=()=>{const j=document.getElementById('jt');return !!j&&!j.classList.contains('hid')};

function qItems(){
 const E=curEvent(),L=[];
 if(E){
  const g=E.name||'This event';
  areasOf(E).forEach(a=>a.secs.forEach(s=>L.push({g,gp:0,l:s.l,h:a.id==='details'?'':a.l,i:s.i,kw:s.kw+' '+a.l,on:s.on,run:()=>goSec(s)})));
  if(!window.can||can(E,'regs'))L.push({g,gp:0,pri:.5,l:'Scan tickets',h:'Check-in',i:'scan',kw:'qr camera gate check in open scanner',run:()=>fire('scan','1')});
  if(!window.can||can(E,'event'))L.push({g,gp:0,l:'Edit event',h:'Details',i:'edit',kw:'change rename date venue capacity form questions',run:()=>fire('edit',E.id)});
  if(window.calcBtnV)L.push({g,gp:0,l:'Calculator',h:'',i:'calc',kw:'calculate sum maths',run:()=>fire('calc','1')});
 }
 mainAreas().forEach(a=>L.push({g:'Go to',gp:1,l:a.l,h:'',i:a.i,kw:a.id==='mine'?'my assigned tasks to do':a.id==='new'?'create add event publish':a.id==='dash'?'home overview next up':'all events list',on:a.on&&!E,run:()=>{if(a.go==='new')V.draft=newDraft();go(a.go)}}));
 const key=e=>(e.date||'')+' '+(e.time||'00:00'),t=typeof dayGap==='function'?dayGap:()=>0;
 [...S.events].sort((a,b)=>(t(a)<0)-(t(b)<0)||(t(a)<0?key(b).localeCompare(key(a)):key(a).localeCompare(key(b)))).forEach(e=>{
  if(E&&E.id===e.id)return;
  L.push({g:'Events',gp:2,l:e.name||'Untitled event',h:e.type,i:'events',kw:(e.venue||'')+' '+e.type,color:typeColor(e,''),run:()=>{window.cemOpen(e.id,'info')}});
 });
 const A=[['acct','Account, alerts & join event','acct','profile notifications code team join'],['help','Help & guides','help','how to guide tutorial support learn'],['tut','Tutorials','doc','video guide learn'],['pic','Profile photo','acct','avatar picture picture'],['theme','Switch theme','theme','dark light mode appearance colour color'],['about','About & updates','phone','version update what is new']];
 if(signedIn())A.splice(1,0,['join','Join a team with an event code','join','code invite member']);
 A.forEach(x=>L.push({g:'Account and help',gp:3,l:x[1],h:'',i:x[2],kw:x[3],run:()=>fire('u',x[0])}));
 if(signedIn())L.push({g:'Account and help',gp:3,l:'Sign out',h:'',i:'out',kw:'log out logout leave account',run:()=>fire('u','out')});
 return L;
}
function qScore(it,toks){
 const lab=it.l.toLowerCase(),hay=lab+' '+(it.h||'').toLowerCase()+' '+(it.kw||'').toLowerCase();
 let s=0;
 for(const t of toks){
  if(!hay.includes(t))return -1;
  if(lab.startsWith(t))s+=4;else if(lab.split(/[^a-z0-9]+/).some(w=>w.startsWith(t)))s+=3;else if(lab.includes(t))s+=2;else s+=1;
 }
 return s+(it.pri||0);   // small boost so a direct action wins a tie with the screen of the same name
}
function qRun(){
 const q=qi.value.trim().toLowerCase(),toks=q.split(/\s+/).filter(Boolean),all=qItems();
 let L;
 if(!toks.length){
  const E=curEvent(),seen={};
  L=all.filter(it=>{const k=it.gp;seen[k]=(seen[k]||0)+1;return k===0||k===1||(k===2&&seen[k]<=5)||(k===3&&seen[k]<=3)});
 }else{
  L=all.map(it=>({it,s:qScore(it,toks)})).filter(x=>x.s>=0).sort((a,b)=>b.s-a.s||a.it.gp-b.it.gp).map(x=>x.it).slice(0,12);
 }
 QR=L;QA=0;qDraw(!toks.length);
}
function qDraw(grouped){
 if(!QR.length){ql.innerHTML=`<div class="qf-empty"><b>Nothing matches \u201c${esc(qi.value.trim())}\u201d</b><span>Try a shorter word, like \u201cscan\u201d, \u201cbill\u201d or an event name.</span></div>`;qi.removeAttribute('aria-activedescendant');return}
 let h='',last=null;
 QR.forEach((it,i)=>{
  if(grouped&&it.g!==last){h+=`<div class="qf-g" role="presentation">${esc(it.g)}</div>`;last=it.g}
  const lead=it.color?`<span class="qf-i qf-sw" style="--c:${it.color}"></span>`:`<span class="qf-i">${svg(P[it.i]||P.right,'ei')}</span>`;
  h+=`<div class="qf-o${i===QA?' act':''}${it.on?' here':''}" role="option" id="qfo${i}" data-qi="${i}" aria-selected="${i===QA}">${lead}<span class="qf-l">${esc(it.l)}</span>${it.h&&!grouped?`<span class="qf-h">${esc(it.h)}</span>`:it.on?'<span class="qf-h">You are here</span>':''}${svg(P.right,'ei qf-c')}</div>`;
 });
 ql.innerHTML=h;qi.setAttribute('aria-activedescendant','qfo'+QA);
}
function qMove(d){
 if(!QR.length)return;
 QA=(QA+d+QR.length)%QR.length;
 ql.querySelectorAll('.qf-o').forEach((n,i)=>{n.classList.toggle('act',i===QA);n.setAttribute('aria-selected',String(i===QA))});
 const n=ql.querySelector('#qfo'+QA);qi.setAttribute('aria-activedescendant','qfo'+QA);if(n&&n.scrollIntoView)n.scrollIntoView({block:'nearest'});
}
function qOpen(){
 if(!qf.hidden)return;
 QBack=document.activeElement;
 const um=document.getElementById('um');if(um)um.classList.add('hid');
 qf.hidden=false;root.classList.add('qf-lock');qi.value='';qRun();
 qi.focus();   // synchronously, inside the tap: iOS only opens the keyboard for focus that happens in the gesture
 if(document.activeElement!==qi)requestAnimationFrame(()=>qi.focus());
}
function qClose(back){
 if(qf.hidden)return;
 qf.hidden=true;root.classList.remove('qf-lock');
 if(back!==false&&QBack&&QBack.focus&&document.contains(QBack))QBack.focus({preventScroll:true});QBack=null;
}
function qGo(i){
 const it=QR[i];if(!it)return;
 qClose(false);
 setTimeout(()=>{try{it.run()}catch(x){if(window.console)console.error('quick find',x)}},0);   // after the dialog is gone, so a screen the action opens gets the focus
}
qi.addEventListener('input',qRun);
qi.addEventListener('keydown',x=>{
 if(x.key==='ArrowDown'){x.preventDefault();qMove(1)}
 else if(x.key==='ArrowUp'){x.preventDefault();qMove(-1)}
 else if(x.key==='Enter'){x.preventDefault();qGo(QA)}
 else if(x.key==='Escape'){x.preventDefault();qClose()}
 else if(x.key==='Tab'){x.preventDefault()}
});
qf.addEventListener('mousedown',x=>{if(x.target.closest('.qf-o'))x.preventDefault()});   // keep the cursor in the box
qf.addEventListener('click',x=>{
 const o=x.target.closest('.qf-o');
 if(o){qGo(+o.dataset.qi);return}
 if(x.target===qf||x.target.closest('[data-qf="close"]'))qClose();
});
qf.addEventListener('mousemove',x=>{const o=x.target.closest('.qf-o');if(o&&+o.dataset.qi!==QA)qMove(+o.dataset.qi-QA)});
qb.addEventListener('click',qOpen);
document.addEventListener('keydown',x=>{
 const t=x.target,typing=t&&(/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)||t.isContentEditable);
 if((x.ctrlKey||x.metaKey)&&!x.altKey&&x.key.toLowerCase()==='k'){x.preventDefault();qf.hidden?qOpen():qClose();return}
 if(x.key==='/'&&!typing&&!x.ctrlKey&&!x.metaKey&&!x.altKey&&qf.hidden){x.preventDefault();qOpen()}
});

paint();render();
})();
