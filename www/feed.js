/* CEM 4.5.0: Discover layout. Dashboard and Events become a feed of horizontal rails with poster cards.

   Dashboard   Next up and Needs attention stay exactly as they were (they come from dash() in index.html).
               Below them: At a glance, This week, Coming up, Filling fast, Your people, Recently ended.
   Events      Search, a sticky strip of event types (replaces the Type dropdown; same V.filter), then rails:
               This week, Coming up, Filling fast, Past events. With a search, a status filter or another sort order
               the same cards show in a wrapping grid instead.

   Nothing about the data, permissions or the event screens changes. This file only replaces how dash(), list(), evView()
   and evRow() draw (the click handlers in index.html still work: data-open, data-go, data-nx, data-clr, data-ef).
   Loads last, after sidepanel.js. Motion: only what answers a tap (strip marker glides, results fade in, card lifts). */
(function(){
'use strict';
const app=document.getElementById('app');
if(!app||typeof render!=='function'||typeof dash!=='function'||typeof list!=='function'||typeof evView!=='function'||typeof evRow!=='function'||typeof evPaint!=='function'||typeof TYPES==='undefined')return;

const reduce=window.matchMedia?matchMedia('(prefers-reduced-motion: reduce)'):{matches:false};
const EASE='cubic-bezier(.22,1,.36,1)';
const KEY=e=>(e.date||'')+' '+(e.time||'00:00');
const asc=(a,b)=>KEY(a.e).localeCompare(KEY(b.e)),desc=(a,b)=>asc(b,a);
const all=()=>{const c={};S.regs.forEach(r=>{c[r.eid]=(c[r.eid]||0)+1});return S.events.map(e=>({e,g:dayGap(e),n:c[e.id]||0}))};
const pct=x=>+x.e.cap>0?Math.min(100,Math.round(x.n/+x.e.cap*100)):0;
const venueTxt=v=>{v=String(v||'').trim();if(/^https?:\/\//i.test(v)){try{return new URL(v).hostname.replace(/^www\./,'')}catch(x){}}return v};
const CHEV='<svg class="ei" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';

/* ---------- poster card ---------- */
function pc(x){
 const e=x.e,g=x.g,n=x.n,cap=+e.cap>0?+e.cap:0,full=!!cap&&n>=cap;
 const dt=/^\d{4}-\d{2}-\d{2}$/.test(e.date||'')?new Date(e.date+'T00:00'):null;
 const flag=g<0?'Ended':g===0?'Today':g===1?'Tomorrow':full?'Full':'';
 const when=g<0&&dt?dt.toLocaleDateString([],{weekday:'short',day:'numeric',month:'short'}):evWhen(e,g),v=venueTxt(e.venue);
 const long=dt?dt.toLocaleDateString([],{weekday:'long',day:'numeric',month:'long'}):'';
 return `<button type="button" class="pc${g<0?' past':g===0?' today':''}" data-open="${esc(e.id)}" style="--tc:${TYPES[e.type]||'var(--acc)'}" aria-label="${esc(e.name)}. ${esc(long)}${flag?', '+flag:''}. ${esc(e.type)}.">
<span class="pc-art" aria-hidden="true"><span class="pc-m">${dt?esc(dt.toLocaleDateString([],{month:'short'})):''}</span><span class="pc-k">${esc(e.type)}</span><b class="pc-d">${dt?dt.getDate():'\u2013'}</b>${flag?`<span class="pc-f">${g===0?'<i></i>':''}${flag}</span>`:''}${window.cemStack?cemStack(e,3,20,1):''}</span>
<span class="pc-t">${esc(e.name)}</span><span class="pc-s">${esc(when)}</span>${v?`<span class="pc-s">${esc(v)}</span>`:''}${cap?`<span class="bar"><i style="width:${pct(x)}%"></i></span>`:''}
<span class="pc-n">${full?`Full (${n} of ${cap})`:cap?`<b>${n}</b> of ${cap} registered`:`<b>${n}</b> registered`}</span></button>`;
}
window.evRow=pc;   // anything that still asks for an event row now gets a poster card

/* ---------- rail ---------- */
function rail(title,html,count,o){
 if(!html)return '';o=o||{};
 return `<section class="rl${o.cls?' '+o.cls:''}" aria-label="${esc(title)}"><div class="rl-h"><h3>${esc(title)}</h3>${count?`<span class="rl-c">${count}</span>`:''}${o.all?'<button type="button" class="rl-all" data-go="events">See all</button>':''}<span class="rl-nav" aria-hidden="true"><button type="button" class="rl-b prev" data-rl="-1" tabindex="-1">${CHEV}</button><button type="button" class="rl-b" data-rl="1" tabindex="-1">${CHEV}</button></span></div><div class="rl-t">${html}</div></section>`;
}
const cards=a=>a.map(pc).join('');

/* ---------- people on your teams ---------- */
function people(){
 const out=[],names=new Set(),add=(e,id,n,r)=>{n=String(n||'').trim();const k=n.toLowerCase();if(!n||names.has(k))return;names.add(k);out.push({e,id,n,r:String(r||'')})};
 S.events.forEach(e=>{if(e.members)Object.keys(e.members).forEach(id=>{const m=e.members[id]||{};add(e,id,m.name,m.role)})});   // accounts first: they may have a photo
 S.events.forEach(e=>(e.team||[]).forEach(t=>add(e,'',t.n,t.r)));
 return out.slice(0,24);
}
function person(p){
 const first=p.n.split(/\s+/)[0],role=p.r?p.r.charAt(0).toUpperCase()+p.r.slice(1):'';
 return `<button type="button" class="pp" data-nx="${esc(p.e.id)}|people" aria-label="${esc(p.n)}${role?', '+esc(role):''}, ${esc(p.e.name)}">${window.cemAv?cemAv(p.e,p.id,p.n,72):''}<span class="pp-n">${esc(first)}</span>${role?`<span class="pp-r">${esc(role)}</span>`:''}</button>`;
}

/* ---------- Dashboard ---------- */
const dash0=window.dash;
window.dash=function(){
 const h=dash0.apply(this,arguments),i=h.indexOf('<div class="stats">');
 if(i<0)return h;
 const a=all(),up=a.filter(x=>x.g>=0).sort(asc),past=a.filter(x=>x.g<0).sort(desc);
 const hero=up[0],week=up.filter(x=>x!==hero&&x.g<=7),later=up.filter(x=>x.g>7);
 const fill=up.filter(x=>pct(x)>=70).sort((p,q)=>pct(q)-pct(p));
 const tot=S.regs.length,ci=S.regs.filter(r=>r.in).length,cap=S.events.reduce((s,e)=>s+(+e.cap||0),0);
 const stats=`<section class="rl rl-stats" aria-label="At a glance"><div class="rl-h"><h3>At a glance</h3></div><div class="rl-t">
<div class="stat"><b>${S.events.length}</b><span>Events</span></div><div class="stat"><b>${tot}</b><span>Registrations</span></div><div class="stat"><b>${ci}</b><span>Checked in</span></div><div class="stat"><b>${cap?Math.round(tot/cap*100):0}%</b><span>Seats filled</span></div></div></section>`;
 const pp=people();
 return h.slice(0,i)+stats
  +rail('This week',cards(week),week.length,{all:1})
  +rail('Coming up',cards(later),later.length,{all:1})
  +rail('Filling fast',cards(fill),fill.length)
  +rail('Your people',pp.map(person).join(''),pp.length,{cls:'rl-pp'})
  +rail('Recently ended',cards(past.slice(0,10)),past.length>10?10:past.length)
  +(up.length?'':'<div class="empty">No upcoming events. Create one from New event.</div>');
};

/* ---------- Events ---------- */
const evView0=window.evView;
window.evView=function(){
 const q=V.q.trim().toLowerCase(),a=all(),total=a.length;
 let it=a.filter(x=>(V.filter==='All'||x.e.type===V.filter)&&(V.es==='all'||(V.es==='up'?x.g>=0:x.g<0))&&(!q||[x.e.name,x.e.venue,x.e.type].some(s=>String(s||'').toLowerCase().includes(q))));
 if(!it.length)return evView0();
 const count=it.length===total?`${total} event${total===1?'':'s'}`:`${it.length} of ${total} events`;
 if(V.eo==='date'&&V.es==='all'&&!q){
  const up=it.filter(x=>x.g>=0).sort(asc),past=it.filter(x=>x.g<0).sort(desc);
  const week=up.filter(x=>x.g<=7),later=up.filter(x=>x.g>7),fill=V.filter==='All'?up.filter(x=>pct(x)>=70).sort((p,q)=>pct(q)-pct(p)):[];
  return{count,html:rail('This week',cards(week),week.length)+rail('Coming up',cards(later),later.length)+rail('Filling fast',cards(fill),fill.length)+rail('Past events',cards(past),past.length)};
 }
 const by={date:(x,y)=>((x.g<0)-(y.g<0))||(x.g<0?desc(x,y):asc(x,y)),new:desc,name:(x,y)=>String(x.e.name).localeCompare(String(y.e.name),undefined,{sensitivity:'base'}),reg:(x,y)=>(y.n-x.n)||asc(x,y)};
 it.sort(by[V.eo]||by.date);
 return{count,html:`<div class="pgrid">${cards(it)}</div>`};
};

const list0=window.list;
window.list=function(){
 if(!S.events.length)return list0();
 const v=evView(),tc={},st={up:0,past:0};
 S.events.forEach(e=>{tc[e.type]=(tc[e.type]||0)+1;st[dayGap(e)<0?'past':'up']++});
 const types=[...new Set([...Object.keys(TYPES),...Object.keys(tc)])].filter(t=>tc[t]||t===V.filter);
 const sOpts=[['all','All ('+S.events.length+')','All'],['up','Upcoming ('+st.up+')','Upcoming'],['past','Past ('+st.past+')','Past']];
 const chip=(k,n)=>`<button type="button" class="fd-t${V.filter===k?' on':''}" data-ft="${esc(k)}" aria-pressed="${V.filter===k}">${esc(k)}<em>${n}</em></button>`;
 return `<h2 class="evhd">Events</h2>
<div class="evbar" role="search">
 <div class="evq${V.q?' has':''}">${ei('search')}<input id="evq" type="search" inputmode="search" enterkeyhint="search" autocomplete="off" placeholder="Search by name, venue or type" aria-label="Search events" value="${esc(V.q)}"><button type="button" class="evx" data-clr="q" aria-label="Clear search">${ei('x')}</button></div>
 ${evSel('es','Status',V.es,sOpts,V.es!=='all')}
</div>
<div class="fd-tabs" role="group" aria-label="Event type">${chip('All',S.events.length)}${types.map(t=>chip(t,tc[t]||0)).join('')}<i class="fd-ind"></i></div>
<div class="evsum"><span><span id="evc" aria-live="polite">${v.count}</span><button type="button" class="evclr" id="evclr" data-clr="all"${evActive()?'':' hidden'}>Clear filters</button></span>${evSel('eo','Sort',V.eo,EV_SORT,false,'evs')}</div>
<div id="evres">${v.html}</div>`;
};

/* ---------- behaviour ---------- */
// the strip marker sits under the active type; it glides when the type changes and is placed instantly on a fresh draw
function place(s,anim){
 const on=s.querySelector('.fd-t.on'),m=s.querySelector('.fd-ind');
 if(!on||!m||!on.offsetWidth)return;
 m.style.transition=anim&&!reduce.matches?'':'none';
 m.style.width=(on.offsetWidth-16)+'px';m.style.transform=`translateX(${on.offsetLeft+8}px)`;
 const left=on.offsetLeft-(s.clientWidth-on.offsetWidth)/2;
 if(Math.abs(s.scrollLeft-left)>2)s.scrollTo({left:Math.max(0,left),behavior:anim&&!reduce.matches?'smooth':'auto'});
}
document.addEventListener('click',e=>{
 const t=e.target.closest&&e.target.closest('[data-ft]');
 if(t){
  V.filter=t.dataset.ft;const s=t.closest('.fd-tabs');
  s.querySelectorAll('.fd-t').forEach(x=>{const on=x===t;x.classList.toggle('on',on);x.setAttribute('aria-pressed',on)});
  place(s,true);evPaint();
  const r=document.getElementById('evres');
  if(r&&r.animate&&!reduce.matches)r.animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'none'}],{duration:280,easing:EASE});
  return;
 }
 const b=e.target.closest&&e.target.closest('[data-rl]');
 if(b){const r=b.closest('.rl').querySelector('.rl-t');r.scrollBy({left:(+b.dataset.rl)*Math.max(200,r.clientWidth*.85),behavior:reduce.matches?'auto':'smooth'})}
});

// arrows and edge fades only show in the direction a rail can still scroll
function state(t){const max=t.scrollWidth-t.clientWidth,r=t.parentNode;r.classList.toggle('can-l',t.scrollLeft>4);r.classList.toggle('can-r',t.scrollLeft<max-4)}
document.addEventListener('scroll',e=>{const t=e.target;if(t&&t.classList&&t.classList.contains('rl-t'))state(t)},true);
let q=0;
const sync=()=>{q=0;app.querySelectorAll('.rl-t').forEach(state);app.querySelectorAll('.fd-tabs').forEach(s=>place(s,false))};
const later=()=>{if(!q)q=requestAnimationFrame(sync)};
new MutationObserver(later).observe(app,{childList:true,subtree:true});
addEventListener('resize',later);
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(later);
later();
render();   // draw the current screen once with the new layout
})();
