/* CEM 3.8.0: motion layer. Smooth transitions so the app feels alive.
   Loads after ui.js and splash.js. It changes no existing code: it only adds CSS and watches the page.

   What moves, and why (motion answers what the person just did; nothing loops):
   - Opening a screen or switching a tab: the content rises in; dashboard numbers count up and progress bars fill.
   - Event tabs, Attendees/Registration switch, top menu: the active marker glides to the new place.
   - Check in, tick a task, mark paid: the row that changed flashes, a new "Checked in" pill pops.
   - Panels that open (more actions, forms, budget categories): they ease open.
   - Menus, dialogs, help, toasts: they fade and scale in AND out.
   - Theme switch: colours cross-fade. Header gets a soft shadow once the page scrolls.

   Motion is skipped completely when the device asks for reduced motion.
   Plain typing (search boxes) and background data updates never replay the entrance, so nothing flickers. */
(function(){
'use strict';
const root=document.documentElement,app=document.getElementById('app');
if(!app||typeof V==='undefined')return;

const EASE='cubic-bezier(.22,1,.36,1)',SPRING='cubic-bezier(.34,1.56,.64,1)';
const mq=window.matchMedia?matchMedia('(prefers-reduced-motion: reduce)'):{matches:false};
const still=()=>mq.matches||!Element.prototype.animate;

/* ---------- CSS: overlays, toasts, press feedback (pure CSS, so it also works for panels other scripts open and close) ---------- */
const css=document.createElement('style');
css.textContent=`
:root{--ease:${EASE};--spring:${SPRING}}
#app{animation:none}
.stat b,.gl b,.xh .big{font-variant-numeric:tabular-nums}
.bar i,.prog i,.mbar i{transform-origin:left center}

/* menus and dialogs keep their .hid switch. Opening plays a keyframe animation (so even the first open animates);
   closing is a transition on .hid, so they fade and scale away instead of vanishing. */
#um:not(.hid),#tp:not(.hid){animation:cem-pop .22s var(--ease)}
#vs:not(.hid),#vb:not(.hid),#js:not(.hid),#hg:not(.hid){animation:cem-fade .2s ease}
#vs:not(.hid) .box,#vb:not(.hid) .box,#js:not(.hid) .box,#hg:not(.hid) .hgb{animation:cem-rise .34s var(--spring)}
#um,#tp{transform-origin:top right}
#um.hid,#tp.hid,#vs.hid,#vb.hid,#js.hid,#hg.hid{visibility:hidden;opacity:0;pointer-events:none;animation:none;transition:opacity .15s ease,transform .15s ease,visibility 0s linear .16s}
#um.hid,#tp.hid{display:block!important;transform:translateY(-8px) scale(.96)}
#vs.hid,#vb.hid,#js.hid{display:grid!important}
#hg.hid{display:flex!important}
#vs.hid .box,#vb.hid .box,#js.hid .box,#hg.hid .hgb{transform:translateY(18px) scale(.96);opacity:0;animation:none;transition:transform .15s ease,opacity .15s ease}
@keyframes cem-pop{from{opacity:0;transform:translateY(-8px) scale(.96)}}

/* dialogs that are created on demand (ticket, scanner, calculator) fade in */
#tk,#sc,#cl{animation:cem-fade .2s ease both}
#tk .box,#sc .box,#cl .box{animation:cem-rise .34s var(--spring) both}
@keyframes cem-fade{from{opacity:0}}
@keyframes cem-rise{from{opacity:0;transform:translateY(18px) scale(.96)}}

/* toasts: in, hold, out. The app removes a toast after 1.8 s, so the animation lasts the same 1.8 s. */
.toast{pointer-events:none;animation:cem-toast 1.8s var(--ease) both}
@keyframes cem-toast{
 0%{opacity:0;transform:translate(-50%,16px) scale(.94)}
 10%{opacity:1;transform:translate(-50%,0) scale(1)}
 84%{opacity:1;transform:translate(-50%,0) scale(1)}
 100%{opacity:0;transform:translate(-50%,8px) scale(.98)}}

/* help sections ease open */
#hg details[open]>.hgd{animation:cem-drop .24s var(--ease)}
@keyframes cem-drop{from{opacity:0;transform:translateY(-6px)}}

/* gliding markers (drawn by motion.js inside tab strips, segmented controls and the menu bar) */
.g-ind{position:absolute;left:0;top:0;pointer-events:none;transform-origin:0 0;will-change:transform}
.tabs>.g-ind{top:auto;bottom:-1px;height:3px;border-radius:3px 3px 0 0;background:var(--acc);z-index:1}
.seg>.g-ind,#mb>.g-ind{border-radius:9px;background:var(--card);box-shadow:0 1px 4px rgba(0,0,0,.15)}
#bn>.g-ind{height:3px;border-radius:0 0 4px 4px;background:var(--acc)}
.tabs.has-g .tab.on{border-bottom-color:transparent}
.seg,#mb{position:relative}
.seg.has-g>button,#mb.has-g>button{position:relative;z-index:1}
.seg.has-g>button.on,#mb.has-g>button.on{background:none;box-shadow:none}

/* press and focus feedback */
.chip,.tab,.gl,.xch,.seg button,#mb button,#bn button,#av,.link{transition:transform .15s var(--ease),background-color .18s,color .18s,border-color .18s}
.chip:active,.tab:active,.gl:active,.xch:active,.seg button:active,#mb button:active,#bn button:active,.ev:active{transform:scale(.97)}
#av:active{transform:scale(.92)}#av{transition:transform .15s var(--ease)}
input,select,textarea{transition:border-color .15s,box-shadow .15s}
.ev:hover{box-shadow:0 14px 30px -14px rgba(16,24,40,.28)}
header{transition:box-shadow .25s ease}header.scrolled{box-shadow:0 8px 24px -14px rgba(16,24,40,.45)}

/* theme switch: colours cross-fade for a moment */
html.tfade *,html.tfade *:before,html.tfade *:after{transition:background-color .35s ease,color .35s ease,border-color .35s ease,fill .35s ease,stroke .35s ease,box-shadow .35s ease!important}

@media(prefers-reduced-motion:reduce){
 #um.hid,#tp.hid,#vs.hid,#vb.hid,#js.hid,#hg.hid,#vs.hid .box,#vb.hid .box,#js.hid .box,#hg.hid .hgb,.chip,.tab,.gl,.xch,.seg button,#mb button,#bn button,#av,header,input,select,textarea{transition:none!important}
 #um:not(.hid),#tp:not(.hid),#vs:not(.hid),#vb:not(.hid),#js:not(.hid),#hg:not(.hid),#vs:not(.hid) .box,#vb:not(.hid) .box,#js:not(.hid) .box,#hg:not(.hid) .hgb,#tk,#sc,#cl,#tk .box,#sc .box,#cl .box,#hg details[open]>.hgd{animation:none!important}
 .toast{animation:none}
 .ev:active,.chip:active,.tab:active,.gl:active,.xch:active{transform:none}
}`;
document.head.append(css);

/* ---------- small helpers ---------- */
const inView=el=>{const r=el.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight+40};
const FLAT='.stats,.grid,.glance';

function rise(els,o){
 if(still())return;
 o=o||{};const y=o.y==null?10:o.y,dur=o.dur||420,step=o.step==null?40:o.step,max=o.max||12,base=o.delay||0;
 els.filter(inView).slice(0,max).forEach((el,i)=>el.animate(
  [{opacity:0,transform:`translateY(${y}px)`},{opacity:1,transform:'none'}],
  {duration:dur,delay:base+i*step,easing:EASE,fill:'backwards'}));
}
function countUp(el){
 const m=/^(\d[\d,]*)(%?)$/.exec(el.textContent.trim());if(!m||el.children.length)return;
 const end=+m[1].replace(/,/g,''),suf=m[2],txt=el.textContent;tween(el,0,end,suf,txt,650);
}
function tween(el,from,to,suf,final,dur){
 if(still()||from===to)return;
 const t0=performance.now(),big=to>=1000;
 (function f(t){
  const k=Math.min(1,(t-t0)/dur),v=Math.round(from+(to-from)*(1-Math.pow(1-k,3)));
  el.textContent=k>=1?final:(big?v.toLocaleString():String(v))+suf;
  if(k<1)requestAnimationFrame(f);
 })(t0);
}
function fillBars(scope){
 if(still())return;
 scope.querySelectorAll('.bar i,.prog i,.mbar i').forEach(i=>{
  if(!inView(i))return;
  const sib=[...i.parentNode.children].indexOf(i),card=i.closest('.ev'),idx=card?[...card.parentNode.children].indexOf(card):0;
  i.animate([{transform:'scaleX(0)'},{transform:'scaleX(1)'}],{duration:700,delay:220+Math.min(idx,8)*45+sib*90,easing:EASE,fill:'backwards'});
 });
}
function figures(scope){scope.querySelectorAll('.stat b,.gl b').forEach(countUp);fillBars(scope)}

/* ---------- view changes: which kind of change was it? ---------- */
const screenKey=()=>V.tab+'|'+(V.eid||'');
const majorKey=()=>screenKey()+'|'+(V.tab==='detail'?V.dt:'');
const minorKey=()=>V.tab==='events'?V.filter:V.tab==='detail'?[V.av,V.rf,V.tf,V.pfl,V.xv].join('|'):'';
let kScreen=screenKey(),kMajor=majorKey(),kMinor=minorKey();

function enterScreen(){
 const t=[];[...app.children].forEach(c=>{if(c.matches(FLAT))t.push(...c.children);else t.push(c)});
 rise(t,{y:12,dur:460,step:42,max:12});figures(app);
}
function enterTab(){
 let seen=false;const t=[...app.children].filter(c=>{if(c.classList.contains('tabs')){seen=true;return false}return seen});
 const f=[];t.forEach(c=>{if(c.matches(FLAT))f.push(...c.children);else f.push(c)});
 rise(f,{y:8,dur:340,step:34,max:8});figures(app);
}
function enterList(){rise([...app.querySelectorAll('.ev,.li,.tkr,.xc')],{y:6,dur:240,step:22,max:12})}

/* ---------- echo: show what just changed after a tap ---------- */
let pend=null;
const selFor=t=>{
 const a=[...t.attributes].filter(x=>x.name.indexOf('data-')===0);if(!a.length)return null;
 return t.tagName.toLowerCase()+a.map(x=>`[${x.name}="${CSS.escape(x.value)}"]`).join('');
};
document.addEventListener('click',e=>{
 const t=e.target.closest&&e.target.closest('#app button,#app input[type=checkbox]');
 pend=t?{sel:selFor(t),at:performance.now()}:null;
},true);

const PANEL='.fp,.more,.xcb,.tdb,.xqr';
const sig=n=>{const h=n.outerHTML,d=/data-[a-z]+="[^"]*"/.exec(h);return h.slice(0,h.indexOf('>')+1)+(d?d[0]:'')};
function openPanel(p){
 const cs=getComputedStyle(p),h=p.offsetHeight;if(!h)return;
 p.style.overflow='hidden';
 const a=p.animate([
  {height:'0px',opacity:0,paddingTop:'0px',paddingBottom:'0px',marginTop:'0px',marginBottom:'0px'},
  {height:h+'px',opacity:1,paddingTop:cs.paddingTop,paddingBottom:cs.paddingBottom,marginTop:cs.marginTop,marginBottom:cs.marginBottom}],
  {duration:280,easing:EASE});
 a.onfinish=a.oncancel=()=>{p.style.overflow=''};
}
function flash(row){
 const acc=getComputedStyle(root).getPropertyValue('--acc').trim()||'#5948f5';
 const c=`color-mix(in srgb,${acc} 18%,transparent)`,z='color-mix(in srgb,'+acc+' 0%,transparent)';
 const keep=row.style.borderRadius;row.style.borderRadius='8px';
 const a=row.animate([{backgroundColor:c,boxShadow:`0 0 0 6px ${c}`},{backgroundColor:z,boxShadow:`0 0 0 6px ${z}`}],{duration:950,easing:'ease-out'});
 a.onfinish=a.oncancel=()=>{row.style.borderRadius=keep};
}
const pop=el=>el&&el.animate([{transform:'scale(.55)',opacity:.2},{transform:'scale(1)',opacity:1}],{duration:420,easing:SPRING});

function echo(oldRoot){
 if(still())return;
 /* panels that were not there before ease open */
 const had=new Set([...oldRoot.querySelectorAll(PANEL)].map(sig));
 const fresh=[...app.querySelectorAll(PANEL)].filter(p=>!had.has(sig(p)));
 fresh.forEach(openPanel);

 /* numbers that changed count to their new value; tab badges pop */
 const oldNums=[...oldRoot.querySelectorAll('.stat b,.gl b')],newNums=[...app.querySelectorAll('.stat b,.gl b')];
 if(oldNums.length===newNums.length)newNums.forEach((n,i)=>{
  const a=/^(\d[\d,]*)(%?)$/.exec(oldNums[i].textContent.trim()),b=/^(\d[\d,]*)(%?)$/.exec(n.textContent.trim());
  if(a&&b&&a[2]===b[2]&&a[1]!==b[1]&&!n.children.length)tween(n,+a[1].replace(/,/g,''),+b[1].replace(/,/g,''),b[2],n.textContent,420);
 });
 const ob={};oldRoot.querySelectorAll('.tab[data-dt]').forEach(t=>{const em=t.querySelector('em');ob[t.dataset.dt]=em?em.textContent:''});
 app.querySelectorAll('.tab[data-dt]').forEach(t=>{const em=t.querySelector('em');if(em&&t.dataset.dt in ob&&ob[t.dataset.dt]!==em.textContent)pop(em)});

 /* the row the person tapped, if it really changed */
 if(!pend||performance.now()-pend.at>900||!pend.sel)return;
 const nEl=app.querySelector(pend.sel),oEl=oldRoot.querySelector(pend.sel);if(!nEl||!oEl)return;
 const R='.li,.tkr,.xc',nRow=nEl.closest(R),oRow=oEl.closest(R);if(!nRow||!oRow)return;
 if(fresh.some(p=>nRow.contains(p)))return;
 if(nRow.textContent!==oRow.textContent||(nEl.type==='checkbox'&&nEl.checked!==oEl.checked)){
  flash(nRow);
  const was=oRow.querySelectorAll('.pill.ok').length,now=nRow.querySelectorAll('.pill.ok');
  if(now.length>was)pop(now[0]);
 }
}

/* ---------- gliding markers ---------- */
const last={};
const GL={tabs:['.tabs','.tab.on','tabs','line'],seg:['.seg','button.on','seg','pill'],mb:['#mb','button.on','mb','pill'],bn:['#bn','button.on','bn','bar']};
function glideBox(g,box,n){
 box.querySelectorAll(':scope>.g-ind').forEach(x=>x.remove());
 const on=box.querySelector(g[1]);
 if(!on||!box.offsetWidth)return;
 const key=g[2]+n+'|'+(g[2]==='tabs'?V.eid:g[2]==='seg'?V.eid+'|'+V.dt:'');
 const kids=[...box.children].filter(c=>c.tagName==='BUTTON'),id=kids.indexOf(on)+':'+on.textContent.trim().slice(0,12);
 let x=on.offsetLeft,y=on.offsetTop,w=on.offsetWidth,h=on.offsetHeight;
 if(g[3]==='bar'){w=26;x=on.offsetLeft+(on.offsetWidth-26)/2;y=0;h=3}
 const ind=document.createElement('i');ind.className='g-ind';
 ind.style.width=w+'px';
 if(g[3]!=='line'){ind.style.height=h+'px';ind.style.top=y+'px'}
 ind.style.transform=`translateX(${x}px)`;
 box.prepend(ind);box.classList.add('has-g');
 const p=last[key];
 if(p&&p.id!==id&&!still())ind.animate([{transform:`translateX(${p.x}px) scaleX(${p.w/w})`},{transform:`translateX(${x}px) scaleX(1)`}],{duration:380,easing:EASE});
 last[key]={id,x,w};
}
function glide(scope,list){list.forEach(g=>scope.querySelectorAll(g[0]).forEach((box,n)=>glideBox(g,box,n)))}

/* ---------- watch the page ---------- */
let intro=false;
function onApp(records){
 const old=document.createElement('div');
 [...records[0].removedNodes].forEach(n=>old.append(n));
 const s=screenKey(),m=majorKey(),n=minorKey();
 const sChanged=s!==kScreen,mChanged=m!==kMajor,nChanged=n!==kMinor;
 kScreen=s;kMajor=m;kMinor=n;
 try{
  glide(app,[GL.tabs,GL.seg]);
  if(!intro)return;                     // the first screen waits for the loader to lift
  if(sChanged)enterScreen();
  else if(mChanged)enterTab();
  else if(nChanged)enterList();
  else if(old.firstChild)echo(old);
 }catch(x){}   // motion must never break the app
 pend=null;
}
new MutationObserver(onApp).observe(app,{childList:true});

/* the menu bar is redrawn by ui.js on every render. The marker lives inside it, so the observer is paused while the marker is drawn
   (otherwise drawing the marker would trigger the observer again, forever). */
[['#mb',GL.mb],['#bn',GL.bn]].forEach(a=>{
 const el=document.querySelector(a[0]);if(!el)return;
 const o=new MutationObserver(()=>{o.disconnect();try{glide(document,[a[1]])}catch(x){}o.observe(el,{childList:true})});
 o.observe(el,{childList:true});
});
try{glide(app,[GL.tabs,GL.seg]);glide(document,[GL.mb,GL.bn])}catch(x){}

/* first screen: starts as the loader lifts */
function start(){intro=true;if(!still()){enterScreen()}}
const sp=document.getElementById('splash');
if(sp&&!sp.classList.contains('out')){
 const o=new MutationObserver(()=>{if(sp.classList.contains('out')){o.disconnect();start()}});
 o.observe(sp,{attributes:true,attributeFilter:['class']});
 setTimeout(()=>{if(!intro)start()},13000);   // splash.js gives up after 12 s
}else start();

/* ---------- theme cross-fade and header shadow ---------- */
document.addEventListener('click',e=>{
 const t=e.target.closest&&e.target.closest('[data-u="theme"]');
 if(t&&!still()){root.classList.add('tfade');setTimeout(()=>root.classList.remove('tfade'),450)}
},true);
const hd=document.querySelector('header');let tick=0;
if(hd)addEventListener('scroll',()=>{if(tick)return;tick=requestAnimationFrame(()=>{tick=0;hd.classList.toggle('scrolled',scrollY>6)})},{passive:true});
})();
