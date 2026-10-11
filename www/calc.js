/* CEM 3.6.0: a small calculator for the desk during the event. Open it with the calculator button next to the event name (every tab).
   Four tabs:
   - Calculator: + - x / % and brackets, with a tape of your last results. Works with the keyboard too. "200 + 10%" gives 220, "50 x 10%" gives 5,
                 like a shop calculator. It uses its own small parser, never eval, so nothing typed can run as code.
   - Change:     price x quantity, money received (tap the notes), and the change to give back or the amount still due.
   - Cash count: how many notes and coins of each kind are in the box, the total, and whether it matches what the system says was received in cash
                 (all collectors or one). Shows the difference as short or over.
   - Split:      divide a bill between people: exact share, rounded up to the rupee, and how much extra the rounding collects.
   Nothing here is sent anywhere. The last values are kept on this device (localStorage) so an interrupted count is not lost; "Reset" clears them. */
(function(){
const $=id=>document.getElementById(id);
const KEY='cem-calc-v1';
const DEN=[500,200,100,50,20,10,5,2,1],NOTES=[10,20,50,100,200,500,2000];
const feeOf=e=>Math.max(0,+(e&&e.pay&&e.pay.fee)||0);
const load=()=>{try{return JSON.parse(localStorage.getItem(KEY))||{}}catch(x){return {}}};
const K=Object.assign({tab:'calc',expr:'',tape:[],chg:{price:'',qty:'1',got:''},cash:{n:{},exp:'',who:''},spl:{total:'',n:'2'}},load());
K.tab='calc';K.expr='';   // always start on the calculator
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify({tape:K.tape.slice(0,20),chg:K.chg,cash:K.cash,spl:K.spl}))}catch(x){}};
const fmt=(v,d)=>Number(v).toLocaleString('en-IN',{maximumFractionDigits:d==null?2:d});
const rup=v=>'₹'+fmt(v,2);
const n0=v=>{const x=parseFloat(String(v).replace(/,/g,''));return isFinite(x)?x:0};

/* ---------- the expression parser ---------- */
function calc(src){
 const s=String(src).replace(/[×x*]/g,'*').replace(/[÷\/]/g,'/').replace(/[−–]/g,'-').replace(/,/g,'').replace(/\s+/g,'');
 let i=0;
 const bad=()=>{throw new Error('syntax')};
 function atom(){
  if(s[i]==='('){i++;const v=expr();if(s[i]===')')i++;return{v}}   // a missing closing bracket at the end is closed for you
  const m=/^(\d+\.?\d*|\.\d+)/.exec(s.slice(i));if(!m)bad();i+=m[0].length;return{v:parseFloat(m[0])};
 }
 function factor(){
  let sg=1;while(s[i]==='-'||s[i]==='+'){if(s[i]==='-')sg=-sg;i++}
  let a=atom(),pct=false;while(s[i]==='%'){a={v:a.v/100};pct=true;i++}
  return{v:sg*a.v,pct};
 }
 function term(){
  let a=factor();
  while(s[i]==='*'||s[i]==='/'){const op=s[i++],b=factor();if(op==='*')a={v:a.v*b.v};else{if(b.v===0)throw new Error('div0');a={v:a.v/b.v}}}
  return a;
 }
 function expr(){
  let a=term();
  while(s[i]==='+'||s[i]==='-'){const op=s[i++],b=term(),bv=b.pct?a.v*b.v:b.v;a={v:op==='+'?a.v+bv:a.v-bv}}   // 200 + 10% = 200 + (10% of 200)
  return a.v;
 }
 if(!s)bad();
 const v=expr();if(i<s.length)bad();
 if(!isFinite(v)||Math.abs(v)>=1e15)throw new Error('range');
 return Math.round(v*1e8)/1e8;
}
const plain=v=>v.toFixed(8).replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'');   // never scientific notation, so a result can be used in the next sum
const emsg=(x,live)=>x.message==='div0'?'Cannot divide by 0':x.message==='range'?'Number too large':(live?'…':'Check the expression');
window.cemCalc=calc;

/* ---------- styles ---------- */
const css=document.createElement('style');
css.textContent=`#cl{position:fixed;inset:0;z-index:60;display:grid;place-items:center;background:rgba(8,12,30,.7);backdrop-filter:blur(4px);padding:14px;overflow:auto}
#cl .box{position:relative;background:var(--card);color:var(--ink);border-radius:18px;padding:18px;width:min(380px,100%);max-height:calc(100vh - 28px);overflow:auto;box-shadow:0 24px 70px rgba(0,0,0,.5)}
#cl .x{position:absolute;top:12px;right:12px;float:none;margin:0;background:none;border:0;color:var(--mute);font:inherit;font-size:18px;cursor:pointer;padding:4px 8px;border-radius:8px}
#cl h3{font-size:16px;margin:0 28px 10px 0}
#cl .cld{background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:10px 14px;text-align:right;margin-bottom:10px;min-height:76px}
#cl .cle{font-size:15px;color:var(--mute);min-height:22px;overflow-wrap:anywhere;word-break:break-all}
#cl .clr{font:700 30px 'Poppins',system-ui,sans-serif;font-variant-numeric:tabular-nums;line-height:1.2;min-height:38px;overflow-wrap:anywhere}
#cl .clr.er{font-size:15px;color:var(--bad);font-weight:600}
#cl .kp{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
#cl .kp button{font:inherit;font-weight:700;font-size:20px;padding:13px 0;border-radius:12px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer}
#cl .kp button:active{transform:scale(.97)}#cl .kp .op{background:color-mix(in srgb,var(--acc) 14%,var(--card));color:var(--acc)}
#cl .kp .eq{background:var(--acc);color:var(--accink);border-color:var(--acc)}#cl .kp .cl{color:var(--bad)}
#cl .tp{margin-top:10px;max-height:120px;overflow:auto}
#cl .tp button{display:flex;justify-content:space-between;gap:10px;width:100%;text-align:left;background:none;border:0;border-bottom:1px solid var(--line);padding:6px 2px;font:inherit;font-size:13px;color:var(--ink);cursor:pointer}
#cl .tp span{color:var(--mute);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#cl .tp b{white-space:nowrap}
#cl .out{background:color-mix(in srgb,var(--acc) 10%,var(--card));border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin-top:12px}
#cl .out div{display:flex;justify-content:space-between;gap:10px;font-size:14px;padding:2px 0}#cl .out b{font-variant-numeric:tabular-nums}
#cl .out .big{font-size:18px}#cl .out .ok b{color:var(--ok)}#cl .out .bd b{color:var(--bad)}
#cl .dn{display:grid;grid-template-columns:70px 1fr 90px;gap:8px;align-items:center;margin:4px 0}
#cl .dn b{font-variant-numeric:tabular-nums}#cl .dn .sub{text-align:right;color:var(--mute);font-size:13px;font-variant-numeric:tabular-nums}
#cl .dn input{padding:6px 8px}
#cl .qn{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 0}#cl .qn button{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:20px;padding:4px 10px;font:inherit;font-size:13px;cursor:pointer}
#cl .seg{margin-bottom:12px}#cl .seg button{font-size:13px;padding:7px 4px}
#cl label{margin:8px 0 3px}
.eh .cb{flex:none;padding:5px 8px;display:inline-flex}.eh .cb svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}`;
document.head.append(css);

window.calcBtnV='<button class="btn ghost sm cb" data-calc="1" aria-label="Open calculator" title="Calculator"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="2.5" width="14" height="19" rx="2.5"/><path d="M8.5 7h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01"/></svg></button>';

/* ---------- panels ---------- */
const TABS=[['calc','Calculator'],['chg','Change'],['cash','Cash count'],['spl','Split']];
function keys(){
 const rows=[['C','⌫','%','÷'],['7','8','9','×'],['4','5','6','−'],['1','2','3','+'],['0','.','( )','=']];
 return rows.map(r=>r.map(k=>`<button type="button" data-ck="${k}" class="${k==='='?'eq':'C⌫'.includes(k)&&k?'cl':'%÷×−+'.includes(k)?'op':''}" aria-label="${({'C':'Clear','⌫':'Backspace','÷':'divide','×':'multiply','−':'minus','+':'plus','%':'percent','=':'equals','( )':'bracket'})[k]||k}">${k}</button>`).join('')).join('');
}
function pCalc(){
 return `<div class="cld"><div class="cle" id="cle"></div><div class="clr" id="clr" role="status" aria-live="polite">0</div></div>
  <div class="kp">${keys()}</div>
  <div class="row" style="margin-top:10px"><button class="btn ghost sm" data-cl="copy">Copy result</button><button class="btn ghost sm" data-cl="ctape">Clear history</button></div>
  <div class="tp" id="ctp"></div>`;
}
function pChg(E){
 const f=feeOf(E);if(!K.chg.price&&f)K.chg.price=String(f);
 return `<div class="rg" style="grid-template-columns:1fr 1fr;gap:0 10px"><div><label for="cgp">Price each (₹)</label><input id="cgp" type="number" min="0" step="any" inputmode="decimal" value="${K.chg.price}"></div>
  <div><label for="cgq">Quantity</label><input id="cgq" type="number" min="0" step="1" inputmode="numeric" value="${K.chg.qty}"></div></div>
  <label for="cgg">Money received (₹)</label><input id="cgg" type="number" min="0" step="any" inputmode="decimal" value="${K.chg.got}">
  <div class="qn" role="group" aria-label="Add a note">${NOTES.map(n=>`<button type="button" data-cl="note" data-v="${n}">+${n}</button>`).join('')}<button type="button" data-cl="note" data-v="0">Clear</button></div>
  <div class="out" id="cgo"></div>`;
}
function whoOpts(E){
 const cs=window.cashiersOf?cashiersOf(E):[];
 return cs.length?`<label for="ccw">Compare with cash received by</label><select id="ccw"><option value="">All collectors</option>${cs.map(c=>`<option value="${esc(c.id)}" ${K.cash.who===c.id?'selected':''}>${esc(c.n)}</option>`).join('')}</select>`:'';
}
function pCash(E){
 const f=feeOf(E);
 return `${DEN.map(d=>`<div class="dn"><b>₹${d}</b><input type="number" min="0" step="1" inputmode="numeric" data-dn="${d}" value="${K.cash.n[d]||''}" placeholder="0" aria-label="Number of ₹${d}"><span class="sub" id="dns${d}">₹0</span></div>`).join('')}
  ${f?whoOpts(E):''}
  <label for="cce">Expected cash (₹)</label><div class="row"><input id="cce" type="number" min="0" step="any" inputmode="decimal" value="${K.cash.exp}" style="flex:1">${f&&E?'<button type="button" class="btn ghost sm" data-cl="usecash">Use cash received so far</button>':''}</div>
  <div class="out" id="cco"></div><div class="row" style="margin-top:10px"><button class="btn ghost sm" data-cl="rcash">Reset counts</button></div>`;
}
function pSpl(){
 return `<div class="rg" style="grid-template-columns:1fr 1fr;gap:0 10px"><div><label for="csb">Total bill (₹)</label><input id="csb" type="number" min="0" step="any" inputmode="decimal" value="${K.spl.total}"></div>
  <div><label for="csn2">People</label><input id="csn2" type="number" min="1" step="1" inputmode="numeric" value="${K.spl.n}"></div></div>
  <div class="out" id="cso"></div>`;
}
const PANEL={calc:pCalc,chg:pChg,cash:pCash,spl:pSpl};

/* ---------- live updates (no re-render, so the keyboard stays open) ---------- */
function showCalc(){
 const e=$('cle'),r=$('clr');if(!e||!r)return;
 e.textContent=K.expr.replace(/\*/g,'×');r.classList.remove('er');
 if(!K.expr){r.textContent='0'}
 else{try{r.textContent=fmt(calc(K.expr),8)}catch(x){r.textContent=emsg(x,1);if(x.message==='div0'||x.message==='range')r.classList.add('er')}}
 const t=$('ctp');if(t)t.innerHTML=K.tape.slice(0,6).map((x,i)=>`<button type="button" data-cl="tape" data-i="${i}" aria-label="Use ${esc(String(x.r))}"><span>${esc(x.e.replace(/\*/g,'×'))}</span><b>= ${fmt(x.r,8)}</b></button>`).join('');
}
function press(k){
 const L=K.expr.slice(-1);
 if(k==='C')K.expr='';
 else if(k==='⌫')K.expr=K.expr.slice(0,-1);
 else if(k==='='){
  try{const v=calc(K.expr);if(K.expr&&!/^-?\d+(\.\d+)?$/.test(K.expr)){K.tape.unshift({e:K.expr,r:v});K.tape=K.tape.slice(0,20)}K.expr=plain(v);save()}
  catch(x){const r=$('clr');if(r){r.classList.add('er');r.textContent=emsg(x,0);return}}
 }
 else if(k==='( )'){
  const o=(K.expr.match(/\(/g)||[]).length,c=(K.expr.match(/\)/g)||[]).length;
  K.expr+=(o>c&&/[\d)%]/.test(L))?')':(/[\d)%]/.test(L)?'×(':'(');
 }
 else if('+−×÷'.includes(k)){
  if(!K.expr){if(k==='−')K.expr='−';}
  else if('+−×÷'.includes(L)&&K.expr.length>1)K.expr=K.expr.slice(0,-1)+k;   // change your mind about the operator
  else if(L!=='−'||K.expr.length>1)K.expr+=k;
 }
 else if(k==='%'){if(/[\d)]/.test(L))K.expr+='%'}
 else if(k==='.'){const seg=K.expr.split(/[+−×÷()%]/).pop();if(!seg.includes('.'))K.expr+=(/\d/.test(L)?'.':'0.')}
 else if(/\d/.test(k)){if(K.expr.length<60)K.expr+=(L===')'||L==='%')?'×'+k:k}
 showCalc();
}
function showChg(){
 const o=$('cgo');if(!o)return;
 const p=n0(K.chg.price),q=n0(K.chg.qty),g=n0(K.chg.got),tot=p*q,d=g-tot;
 o.innerHTML=`<div><span>Total (${fmt(q,4)} × ${rup(p)})</span><b>${rup(tot)}</b></div><div><span>Received</span><b>${rup(g)}</b></div>
  <div class="big ${d>=0?'ok':'bd'}"><span>${d>=0?'Change to give back':'Still to collect'}</span><b>${rup(Math.abs(d))}</b></div>`;
}
const cashTotal=()=>DEN.reduce((t,d)=>t+d*Math.max(0,Math.floor(n0(K.cash.n[d]))),0);
function showCash(){
 const o=$('cco');if(!o)return;
 DEN.forEach(d=>{const s=$('dns'+d);if(s)s.textContent=rup(d*Math.max(0,Math.floor(n0(K.cash.n[d]))))});
 const t=cashTotal(),pieces=DEN.reduce((s,d)=>s+Math.max(0,Math.floor(n0(K.cash.n[d]))),0),ex=n0(K.cash.exp),has=String(K.cash.exp).trim()!=='',d=t-ex;
 o.innerHTML=`<div class="big"><span>Counted (${pieces} piece${pieces===1?'':'s'})</span><b>${rup(t)}</b></div>${has?`<div><span>Expected</span><b>${rup(ex)}</b></div><div class="${d===0?'ok':'bd'}"><span>${d===0?'Matches':d<0?'Short by':'Over by'}</span><b>${d===0?'✓':rup(Math.abs(d))}</b></div>`:'<div><span class="meta">Enter the expected cash to compare.</span></div>'}`;
}
function showSpl(){
 const o=$('cso');if(!o)return;
 const t=n0(K.spl.total),n=Math.max(1,Math.floor(n0(K.spl.n))),each=t/n,up=Math.ceil(each-1e-9);
 o.innerHTML=`<div class="big"><span>Each person pays</span><b>${rup(Math.round(each*100)/100)}</b></div><div><span>Rounded up to the rupee</span><b>₹${fmt(up,0)}</b></div><div><span>Collected at ₹${fmt(up,0)} each</span><b>${rup(up*n)}</b></div><div><span>Extra from rounding</span><b>${rup(Math.max(0,up*n-t))}</b></div>`;
}
function cashSoFar(E){
 const f=feeOf(E),who=K.cash.who;
 return regsOf(E.id).filter(r=>r.pm==='cash'&&r.paid&&(!who||r.cc===who)).length*f;
}

/* ---------- open, close, tabs ---------- */
let opener=null;
function body(){
 const E=cur(),b=$('clb');if(!b)return;
 b.innerHTML=PANEL[K.tab](E);
 ({calc:showCalc,chg:showChg,cash:showCash,spl:showSpl})[K.tab]();
 const t=$('cltabs');if(t)t.innerHTML=TABS.map(x=>`<button type="button" class="${K.tab===x[0]?'on':''}" data-cl="tab" data-t="${x[0]}" role="tab" aria-selected="${K.tab===x[0]}">${x[1]}</button>`).join('');
}
function open(){
 if($('cl'))return;
 opener=document.activeElement;
 const d=document.createElement('div');d.id='cl';
 d.innerHTML=`<div class="box" role="dialog" aria-modal="true" aria-label="Calculator" tabindex="-1"><button type="button" class="x" data-cl="x" aria-label="Close calculator">✕</button><h3>Calculator</h3><div class="seg" id="cltabs" role="tablist" aria-label="Calculator tools"></div><div id="clb"></div></div>`;
 document.body.append(d);body();
 const bx=d.querySelector('.box');bx&&bx.focus();
}
function close(){const d=$('cl');if(d)d.remove();if(opener&&opener.focus)try{opener.focus()}catch(x){}opener=null}
window.openCalc=open;

document.addEventListener('click',x=>{
 const o=x.target.closest('[data-calc]');if(o){open();return}
 const cl=$('cl');if(!cl)return;
 if(x.target===cl){close();return}
 const k=x.target.closest('button[data-ck]');if(k){press(k.dataset.ck);return}
 const t=x.target.closest('button[data-cl]');if(!t)return;
 const D=t.dataset,a=D.cl,E=cur();
 if(a==='x')close();
 else if(a==='tab'){K.tab=D.t;body()}
 else if(a==='tape'){const e=K.tape[+D.i];if(e){K.expr=plain(e.r);showCalc()}}
 else if(a==='ctape'){K.tape=[];save();showCalc()}
 else if(a==='copy'){let v='';try{v=plain(calc(K.expr||'0'))}catch(z){}if(!v)return toast('Nothing to copy');try{navigator.clipboard.writeText(v);toast('Copied '+v)}catch(z){toast(v)}}
 else if(a==='note'){const v=+D.v;K.chg.got=v?String(n0(K.chg.got)+v):'';const i=$('cgg');if(i)i.value=K.chg.got;save();showChg()}
 else if(a==='rcash'){K.cash.n={};K.cash.exp='';save();body()}
 else if(a==='usecash'&&E){K.cash.exp=String(cashSoFar(E));const i=$('cce');if(i)i.value=K.cash.exp;save();showCash()}
});
document.addEventListener('input',x=>{
 if(!$('cl'))return;const t=x.target;
 if(t.id==='cgp')K.chg.price=t.value;else if(t.id==='cgq')K.chg.qty=t.value;else if(t.id==='cgg')K.chg.got=t.value;
 else if(t.id==='cce')K.cash.exp=t.value;else if(t.dataset&&t.dataset.dn)K.cash.n[t.dataset.dn]=t.value;
 else if(t.id==='csb')K.spl.total=t.value;else if(t.id==='csn2')K.spl.n=t.value;else return;
 const fn={cgp:showChg,cgq:showChg,cgg:showChg,cce:showCash,csb:showSpl,csn2:showSpl}[t.id]||showCash;
 save();fn();
});
document.addEventListener('change',x=>{
 if(x.target.id==='ccw'){K.cash.who=x.target.value;const E=cur();if(E){K.cash.exp=String(cashSoFar(E));const i=$('cce');if(i)i.value=K.cash.exp}save();showCash()}
});
document.addEventListener('keydown',x=>{
 if(!$('cl'))return;
 if(x.key==='Escape'){x.stopPropagation();close();return}
 if(K.tab!=='calc'||x.ctrlKey||x.metaKey||x.altKey)return;
 const tg=x.target&&x.target.tagName;if(tg==='INPUT'||tg==='TEXTAREA'||tg==='SELECT')return;
 const m={'*':'×','x':'×','X':'×','/':'÷','-':'−','+':'+','.':'.',',':'.','%':'%','(':'( )',')':'( )'},k=x.key;
 if(/^\d$/.test(k)){press(k);x.preventDefault()}
 else if(m[k]){press(m[k]);x.preventDefault()}
 else if(k==='Enter'||k==='='){press('=');x.preventDefault()}
 else if(k==='Backspace'){press('⌫');x.preventDefault()}
 else if(k==='Delete'||k==='c'||k==='C'){press('C');x.preventDefault()}
});
})();
