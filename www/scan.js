/* CEM 3.5.0: QR tickets and scan-to-check-in.
   Ticket:  every attendee has a QR code holding  CEM1:<event code>:<ticket id>.  The ticket id is the attendee's own random id (12 characters
            from the browser's secure random generator), so it cannot be guessed. Open it from Attendees > ... > Ticket (QR), then share the
            link (ticket.html#...), save the QR image, or send it by WhatsApp or email.
   Scan:    Attendees > Scan tickets (owner, manager, treasurer, team lead).
            - In the Android app: the free @capacitor-mlkit/barcode-scanning plugin (Google's scanner screen, no camera permission needed).
            - On the website: the browser's built-in BarcodeDetector where it exists (Chrome, Edge, Android), otherwise the small jsQR library
              (vendor/jsQR.js, loaded only when needed).
            - Typing a ticket code or a College ID works everywhere as a fallback.
   The check-in happens on the attendee list that is already on the phone, so it works offline; Firestore sends the change when the network
   is back. A ticket that is already checked in is shown as a warning, never toggled back.
   Two gate volunteers never overwrite each other: each attendee is its own entry and only the changed fields (in, inAt, inBy) are written. */
(function(){
const K=()=>window.Capacitor,nat=()=>{const c=K();return !!(c&&c.isNativePlatform&&c.isNativePlatform()&&c.Plugins)};
const NP=n=>nat()&&K().Plugins[n];
const $=id=>document.getElementById(id);
const tm=t=>new Date(t).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
const vib=p=>{try{navigator.vibrate&&navigator.vibrate(p)}catch(e){}};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const payload=(e,r)=>'CEM1:'+e.id+':'+r.id;
const findReg=(eid,rid)=>S.regs.find(x=>x.eid===eid&&x.id===rid);

const css=document.createElement('style');
css.textContent=`#tk,#sc{position:fixed;inset:0;z-index:60;display:grid;place-items:center;background:rgba(16,23,43,.7);backdrop-filter:blur(4px);padding:14px;overflow:auto}
#tk .box,#sc .box{position:relative;background:var(--card);color:var(--ink);border-radius:18px;padding:20px;width:min(420px,100%);box-shadow:0 24px 70px rgba(0,0,0,.5)}
#tk .tq{background:#fff;border-radius:14px;padding:10px;margin:12px auto;max-width:300px}#tk .tq svg{display:block;width:100%;height:auto}
#tk .x{position:absolute;top:10px;right:10px;float:none;margin:0}
#sc .scv{position:relative;background:#000;border-radius:14px;overflow:hidden;aspect-ratio:1/1;margin:10px 0}
#sc video{width:100%;height:100%;object-fit:cover;display:block}
#sc .scf{position:absolute;inset:18%;border:3px solid rgba(255,255,255,.85);border-radius:16px;box-shadow:0 0 0 999px rgba(0,0,0,.28);pointer-events:none}
#sc .scn{display:grid;place-items:center;height:100%;color:#fff;text-align:center;padding:20px;font-size:14px}
.scres{border-radius:12px;padding:12px 14px;margin:8px 0;font-size:14px;border:1px solid var(--line);background:var(--bg)}
.scres b{display:block;font-size:17px}.scres.ok{background:color-mix(in srgb,var(--ok) 14%,var(--card));border-color:var(--ok)}
.scres.warn{background:color-mix(in srgb,var(--warn) 14%,var(--card));border-color:var(--warn)}.scres.bad{background:color-mix(in srgb,var(--bad) 14%,var(--card));border-color:var(--bad)}
.scres .btn{margin-top:8px}`;
document.head.append(css);

/* ---------- save a PNG from an SVG (used for QR images) ---------- */
window.savePng=function(svgEl,name,size){
 size=size||720;
 const img=new Image();
 img.onload=()=>{const c=document.createElement('canvas');c.width=c.height=size;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,size,size);x.drawImage(img,0,0,size,size);
  c.toBlob(b=>{if(!b)return;if(window.cemSave)cemSave(name,'image/png',b);else{const a=document.createElement('a');a.download=name;a.href=URL.createObjectURL(b);document.body.append(a);a.click();a.remove()}},'image/png')};
 img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(svgEl));
};

/* ---------- ticket window ---------- */
const ticketLink=(e,r)=>{
 const b=window.siteBase?siteBase():'';if(!b)return '';
 const p=new URLSearchParams({e:e.id,r:r.id,n:r.name||'',t:e.name||'',d:e.date||'',v:/^https?:/i.test(e.venue||'')?'':(e.venue||'')});
 return b+'ticket.html#'+p.toString();
};
const waNum=p=>{let d=String(p||'').replace(/\D/g,'');if(d.length===10)d='91'+d;return d.length>=11?d:''};
function showTicket(eid,rid){
 const e=S.events.find(x=>x.id===eid),r=e&&findReg(eid,rid);if(!r)return;
 let svg='';try{const q=qrcode(0,'M');q.addData(payload(e,r));q.make();svg=q.createSvgTag(8,4)}catch(x){}
 const url=ticketLink(e,r),msg='Your ticket for '+e.name+': '+url,wa=waNum(r.ph);
 let m=$('tk');if(!m){m=document.createElement('div');m.id='tk';document.body.append(m)}
 m.innerHTML=`<div class="box" role="dialog" aria-label="Ticket"><button type="button" class="x" data-tkx="1" aria-label="Close">✕</button>
  <p class="meta" style="margin:0">${esc(e.name)}</p><h3 style="margin:2px 0 0">${esc(r.name)}</h3>${r.cid?`<p class="meta" style="margin:2px 0 0">College ID ${esc(r.cid)}</p>`:''}
  <div class="tq" id="tkq">${svg||'<p class="meta">QR library did not load.</p>'}</div>
  <p class="meta" style="margin:0;text-align:center">Ticket ${esc(r.id)}${r.in?' · checked in':''}</p>
  <div class="row" style="margin-top:12px;justify-content:center">
   ${url?`<button class="btn sm" data-tka="share">Share ticket link</button><button class="btn ghost sm" data-tka="copy">Copy link</button>`:''}
   <button class="btn ghost sm" data-tka="png">Save QR image</button>
   ${url&&wa?`<a class="btn ghost sm" style="text-decoration:none" target="_blank" rel="noopener" href="https://wa.me/${wa}?text=${encodeURIComponent(msg)}">WhatsApp</a>`:''}
   ${url&&r.em?`<a class="btn ghost sm" style="text-decoration:none" href="mailto:${esc(r.em)}?subject=${encodeURIComponent('Your ticket: '+e.name)}&body=${encodeURIComponent(msg)}">Email</a>`:''}</div>
  ${url?'':'<p class="meta" style="margin:10px 0 0">Set your public site address (Income tab, Link settings) to get a shareable ticket link.</p>'}</div>`;
 m._u=url;m._m=msg;m._n=r.name;
}
const closeTk=()=>{const m=$('tk');if(m)m.remove()};

/* ---------- scanner ---------- */
let SC=null;   // {eid, alive, stream, last, lastAt, pause}
function scan(eid){
 const E=S.events.find(x=>x.id===eid);if(!E||!can(E,'regs'))return;
 stopScan();closeTk();
 SC={eid,alive:true,stream:null,last:'',lastAt:0,pause:0};
 const isNat=!!NP('BarcodeScanner');
 let m=$('sc');if(!m){m=document.createElement('div');m.id='sc';document.body.append(m)}
 m.innerHTML=`<div class="box" role="dialog" aria-label="Scan tickets"><div class="sh" style="margin-bottom:0"><h3>Scan tickets</h3><button class="btn ghost sm" data-scx="1">Close</button></div>
  <p class="meta" style="margin:2px 0 0">${esc(E.name)}</p>
  ${isNat?'':'<div class="scv"><video id="scvid" playsinline muted></video><div class="scf"></div><div class="scn" id="scmsg">Starting the camera...</div></div>'}
  <div class="scres" id="scr" role="status" aria-live="polite">Point the camera at a ticket QR code.</div>
  ${isNat?'<button class="btn" id="scnext" data-scnext="1" style="width:100%">Scan next ticket</button>':''}
  <form id="scm" class="row" style="margin-top:10px"><input id="scmi" placeholder="Or type a ticket code or College ID" autocomplete="off" autocapitalize="characters" style="flex:1;min-width:180px" aria-label="Ticket code or College ID"><button class="btn ghost sm" type="submit">Check in</button></form>
  <p class="meta" id="scs" style="margin:8px 0 0"></p></div>`;
 if(isNat)nativeScan();else webScan();
}
function stopScan(){
 if(SC){SC.alive=false;if(SC.stream)SC.stream.getTracks().forEach(t=>t.stop());SC=null}
 const m=$('sc');if(m)m.remove();
}
function show(kind,title,text,extra){
 const r=$('scr');if(!r)return;
 r.className='scres '+kind;r.innerHTML='<b>'+esc(title)+'</b>'+(text?esc(text):'')+(extra||'');
}
function handle(raw){
 if(!SC)return;
 const E=S.events.find(x=>x.id===SC.eid);if(!E)return;
 const t=String(raw||'').trim(),m=/^CEM1:([A-Z]{6}):([A-Za-z0-9_-]{4,40})$/.exec(t);
 let r=null;
 if(m){
  if(m[1]!==E.id){vib([120,60,120]);return show('bad','Wrong event','This ticket is for a different event.')}
  r=findReg(E.id,m[2]);
  if(!r){vib([120,60,120]);return show('bad','Ticket not found','Not registered, removed, or this phone has not synced yet. Check the connection and try again.')}
 }else{
  // typed input: a ticket id, or a College ID
  const q=window.normId?normId(t):t.toUpperCase();
  r=S.regs.find(x=>x.eid===E.id&&x.id===t)||S.regs.find(x=>x.eid===E.id&&q&&regCid(E,x)===q);
  if(!r){vib([120,60,120]);return show('bad',/^CEM/i.test(t)?'Not a ticket for this app':'Nothing found',/^CEM/i.test(t)?'This code is not a valid ticket.':'No attendee has that ticket code or College ID.')}
 }
 checkIn(E,r);
}
function checkIn(E,r){
 const fee=!!(E.pay&&+E.pay.fee);
 if(r.in){vib([200,80,200]);return show('warn','Already checked in: '+r.name,(r.inAt?'at '+tm(r.inAt):'')+(r.inBy?' by '+r.inBy:''))}
 r.in=true;r.inAt=Date.now();r.inBy=window.MYNAME||'';sv();
 vib(80);
 if(fee&&!r.paid)show('warn','Checked in: '+r.name,'The fee is not marked as paid.',`<br><button class="btn sm" data-scpaid="${esc(r.id)}">Mark as paid</button>`);
 else show('ok','Checked in: '+r.name,E.fields.slice(1,3).map(f=>r.data&&r.data[f.id]).filter(Boolean).join(', '));
}

// Android app: Google's scanner screen through the free ML Kit plugin
async function nativeScan(){
 const BS=NP('BarcodeScanner'),btn=$('scnext'),say=t=>{const s=$('scs');if(s)s.textContent=t||''};
 if(!BS||!SC)return;
 if(btn)btn.disabled=true;
 try{
  if(K().getPlatform&&K().getPlatform()==='android'&&BS.isGoogleBarcodeScannerModuleAvailable){
   let a=await BS.isGoogleBarcodeScannerModuleAvailable();
   if(!a.available){
    say('Getting the scanner ready (one time, needs internet)...');
    await BS.installGoogleBarcodeScannerModule();
    for(let i=0;i<90&&SC&&!a.available;i++){await sleep(1000);a=await BS.isGoogleBarcodeScannerModuleAvailable()}
    if(!a.available)throw new Error('The scanner component could not be installed. Connect to the internet and try again.');
    say('');
   }
  }
  if(!SC)return;
  const res=await BS.scan({formats:['QR_CODE']});
  const code=res&&res.barcodes&&res.barcodes[0]&&(res.barcodes[0].rawValue||res.barcodes[0].displayValue);
  if(code)handle(code);else show('warn','Nothing scanned','Tap Scan next ticket to try again.');
 }catch(x){
  const msg=String((x&&x.message)||x||'');
  if(/cancel/i.test(msg))show('warn','Scan cancelled','Tap Scan next ticket to continue.');
  else show('bad','Scanner problem',msg+' You can still type the ticket code or College ID below.');
 }
 if(btn)btn.disabled=false;
}

// Website: BarcodeDetector if the browser has it, jsQR otherwise
const loadJsQR=()=>window.jsQR?Promise.resolve():new Promise((ok,no)=>{const s=document.createElement('script');s.src='vendor/jsQR.js';s.onload=ok;s.onerror=()=>no(new Error('jsQR did not load'));document.head.append(s)});
async function webScan(){
 const msg=t=>{const n=$('scmsg');if(!n)return;if(t){n.textContent=t;n.style.display=''}else n.style.display='none'};
 const my=SC;
 if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)return msg('This browser cannot use the camera here (it needs https). Type the ticket code below instead.');
 let stream;
 try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false})}
 catch(x){return msg('The camera is blocked. Allow camera access for this site, or type the ticket code below.')}
 if(SC!==my){stream.getTracks().forEach(t=>t.stop());return}
 my.stream=stream;
 const v=$('scvid');if(!v)return;v.srcObject=stream;
 try{await v.play()}catch(x){}
 let det=null;
 if('BarcodeDetector' in window){try{const f=await BarcodeDetector.getSupportedFormats();if(f.includes('qr_code'))det=new BarcodeDetector({formats:['qr_code']})}catch(x){}}
 if(!det){try{await loadJsQR()}catch(x){return msg('Camera scanning is not available in this browser. Type the ticket code below instead.')}}
 msg('');
 const cv=document.createElement('canvas'),cx=cv.getContext('2d',{willReadFrequently:true});
 const tick=async()=>{
  if(!my.alive||SC!==my)return;
  if(v.readyState>=2&&Date.now()>my.pause){
   try{
    let raw='';
    if(det){const r=await det.detect(v);raw=(r[0]&&r[0].rawValue)||''}
    else{const w=v.videoWidth,h=v.videoHeight;if(w&&h){const s=Math.min(1,640/Math.max(w,h));cv.width=Math.round(w*s);cv.height=Math.round(h*s);cx.drawImage(v,0,0,cv.width,cv.height);
     const im=cx.getImageData(0,0,cv.width,cv.height),q=jsQR(im.data,im.width,im.height,{inversionAttempts:'dontInvert'});raw=q?q.data:''}}
    if(raw&&(raw!==my.last||Date.now()>my.lastAt+4000)){my.last=raw;my.lastAt=Date.now();my.pause=Date.now()+1500;handle(raw)}
   }catch(x){}
  }
  setTimeout(tick,det?120:160);
 };
 tick();
}

/* ---------- clicks ---------- */
document.addEventListener('click',x=>{
 const t=x.target.closest('button,a');if(!t)return;const D=t.dataset||{};
 if(D.tk){const E=cur();if(E)showTicket(E.id,D.tk)}
 else if(D.tkx!==undefined)closeTk();
 else if(D.tka){
  const m=$('tk');if(!m)return;
  if(D.tka==='png'){const s=document.querySelector('#tkq svg');if(s)savePng(s,'ticket-'+String(m._n||'attendee').replace(/[^A-Za-z0-9]+/g,'-').slice(0,30)+'.png')}
  else if(D.tka==='copy'){try{navigator.clipboard.writeText(m._u);toast('Ticket link copied')}catch(e){toast(m._u)}}
  else if(D.tka==='share'){if(navigator.share)navigator.share({title:'Your ticket',text:m._m}).catch(()=>{});else{try{navigator.clipboard.writeText(m._u);toast('Ticket link copied')}catch(e){}}}
 }
 else if(D.scan){const E=cur();if(E)scan(E.id)}
 else if(D.scx!==undefined)stopScan();
 else if(D.scnext!==undefined)nativeScan();
 else if(D.scpaid){const r=SC&&findReg(SC.eid,D.scpaid),E=SC&&S.events.find(z=>z.id===SC.eid);if(r&&E&&can(E,'regs')){r.paid=true;sv();show('ok','Checked in and paid: '+r.name,'')}}
});
document.addEventListener('submit',x=>{
 if(x.target.id!=='scm')return;x.preventDefault();
 const i=$('scmi');if(i&&i.value.trim()){handle(i.value);i.value='';i.focus()}
});
document.addEventListener('keydown',x=>{if(x.key==='Escape'){stopScan();closeTk()}});
window.showTicket=showTicket;window.openScanner=scan;
})();
