/* CEM tutorial engine, shared by every tutorial page (cursor, taps, typing, sound, step list, controls). */
let F,run=0,paused=false,fast=false,fin=false,cI=0,cx=0,cy=0,T,resume=[];
const $=s=>document.querySelector(s),E={};document.querySelectorAll('[id]').forEach(e=>E[e.id]=e);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function W(ms){if(fast)return;const id=run;let t=0;while(t<ms){if(id!==run)throw 0;if(paused){await new Promise(r=>resume.push(r));continue}await wait(40);t+=40}if(id!==run)throw 0}
const S=()=>E.ph.getBoundingClientRect().width/404;
const foc=k=>document.querySelectorAll('.in').forEach(e=>e.classList.toggle('f',e.id===k));
function pt(el,fx=.5,fy=.5){const p=E.ph.getBoundingClientRect(),r=el.getBoundingClientRect(),s=S();return[(r.left-p.left+r.width*fx)/s,(r.top-p.top+r.height*fy)/s]}
async function move(x,y){const ms=fast?0:Math.min(900,250+Math.hypot(x-cx,y-cy)*1.6);E.cur.style.transitionDuration=ms+'ms';E.cur.style.transform=`translate(${x}px,${y}px)`;cx=x;cy=y;await W(ms+60)}
function rip(x,y){if(fast)return;snd('tap');const r=document.createElement('i');r.className='rp';r.style.left=x+'px';r.style.top=y+'px';E.ph.appendChild(r);setTimeout(()=>r.remove(),700)}
async function see(el){const b=E.body,r=el.getBoundingClientRect(),c=b.getBoundingClientRect(),s=S();let d=0;if(r.bottom>c.bottom-20*s)d=r.bottom-c.bottom+28*s;else if(r.top<c.top+44*s)d=r.top-c.top-52*s;if(d<0&&b.scrollTop===0)d=0;if(d){b.scrollTo({top:b.scrollTop+d/s,behavior:fast?'auto':'smooth'});await W(fast?0:550)}}
async function tap(el,fx=.5,fy=.5){if(el.closest('#body'))await see(el);el.classList.add('hl');const[x,y]=pt(el,fx,fy);await move(x,y);await W(300);E.cur.classList.add('dn');rip(x,y);el.classList.add('tp');await W(170);E.cur.classList.remove('dn');el.classList.remove('tp','hl');await W(150)}
async function kbc(){E.kb.classList.remove('up');E.scr.style.setProperty('--kb','0px');await W(380)}
function key(c){snd('key');const k=E.kb.querySelector(`[data-k="${c.toLowerCase()}"]`);if(k){k.classList.add('p');setTimeout(()=>k.classList.remove('p'),90)}}
async function type(k,txt){for(const c of txt){F[k]+=c;draw(k);key(c);await W(65+Math.random()*50)}}
let AC,snOn=true;
function aud(){if(!AC){try{AC=new(window.AudioContext||window.webkitAudioContext)()}catch(e){}}if(AC&&AC.state==='suspended')AC.resume();return AC}
['pointerdown','keydown'].forEach(ev=>addEventListener(ev,aud,true));
function tone(f,t0,d,v,type='sine',f2){const n=AC.currentTime,o=AC.createOscillator(),g=AC.createGain();o.type=type;o.frequency.setValueAtTime(f,n+t0);if(f2)o.frequency.exponentialRampToValueAtTime(f2,n+t0+d);g.gain.setValueAtTime(v,n+t0);g.gain.exponentialRampToValueAtTime(.0001,n+t0+d);o.connect(g);g.connect(AC.destination);o.start(n+t0);o.stop(n+t0+d+.02)}
function snd(k){if(fast||!snOn||!AC||AC.state!=='running')return;
if(k==='tap'){tone(900,0,.07,.18,'sine',420);tone(2200,0,.02,.05,'triangle')}
else if(k==='key')tone(1500+Math.random()*200,0,.03,.05,'triangle');
else if(k==='ding'){tone(880,0,.4,.14);tone(1320,.14,.5,.12)}
else if(k==='ok'){[660,880,1320].forEach((f,i)=>tone(f,i*.11,.35,.12))}}
const lab=()=>E.bPl.textContent=fin?'Replay':paused?'Play':'Pause';
function ui(i){cI=i;[...E.steps.children].forEach((li,k)=>li.className=k<i?'done':k===i?'on':'');[...E.prog.children].forEach((s,k)=>s.className=k<i?'d':k===i?'c':'');const s=T.st[i];E.tip.innerHTML=s?'<b>Tip:</b> '+s.tip:''}
function mount(n){T=n==='A'?TA:TB;E.tA.className=n==='A'?'on':'';E.tB.className=n==='B'?'on':'';E.h.textContent=T.h;E.steps.innerHTML=T.st.map((s,k)=>`<li data-n="${k+1}"><b>${s.t}</b><p>${s.d}</p></li>`).join('');E.prog.innerHTML=T.st.map(()=>'<i></i>').join('')}
async function load(i,id){fast=true;E.ph.classList.add('instant');reset();for(let k=0;k<i;k++)await T.st[k].run();void E.ph.offsetWidth;E.ph.classList.remove('instant');fast=false;await new Promise(r=>requestAnimationFrame(r));if(id!==run)throw 0}
async function play(i){const id=++run;resume.splice(0).forEach(f=>f());paused=false;document.body.classList.remove('paused');fin=false;lab();try{await load(i,id);for(let k=i;k<T.st.length;k++){ui(k);await T.st[k].run();await W(700)}ui(T.st.length);fin=true;lab()}catch(e){if(e!==0)throw e}}
E.steps.onclick=e=>{const li=e.target.closest('li');if(li)play([...E.steps.children].indexOf(li))};
E.bPl.onclick=()=>{if(fin)return play(0);paused=!paused;document.body.classList.toggle('paused',paused);if(!paused)resume.splice(0).forEach(f=>f());lab()};
E.bN.onclick=()=>play(Math.min(cI+1,T.st.length-1));E.bP.onclick=()=>play(Math.max(cI-1,0));E.bR.onclick=()=>play(0);
E.bS.onclick=()=>{snOn=!snOn;E.bS.textContent=snOn?'Sound on':'Sound off';aud()};E.tA.onclick=()=>{mount('A');play(0)};E.tB.onclick=()=>{mount('B');play(0)};
function fit(){const w=Math.min(innerWidth-32,document.querySelector('.stage').clientWidth||440);E.fb.style.setProperty('--s',Math.min(1,(innerHeight-150)/804,w/404))}
