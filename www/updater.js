/* CEM 3.14.0: in-app updates (Android app only).
   Profile menu > "Update app":
     1) asks GitHub Releases for the newest version (same source as the download website),
     2) if it is newer than the installed app, downloads the APK inside the app with a progress bar,
     3) shows an "Update" button that opens Android's normal installer ("Do you want to update this app?").
   The download itself is done by the native plugin scripts/native/ApkUpdaterPlugin.java (Capacitor.Plugins.ApkUpdater),
   because a web page cannot save and install files. The website never shows any of this.
   Public API: window.CEMUpdater = { available(), open({fallbackUrl}) }.
   If you ever rename the GitHub repository, change OWNER/REPO below AND ALLOWED_PATH in scripts/native/ApkUpdaterPlugin.java. */
(function(){
'use strict';

const OWNER='real-debabrata',REPO='cem';
const API='https://api.github.com/repos/'+OWNER+'/'+REPO+'/releases?per_page=10';
const RELEASES_PAGE='https://github.com/'+OWNER+'/'+REPO+'/releases';
const CACHE_KEY='campus-gh-latest',CACHE_MS=5*60*1000;   // GitHub allows 60 anonymous requests per hour per network; a college Wi-Fi shares one address, so cache briefly

const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mb=b=>(b/1048576).toFixed(1)+' MB';
const isApp=()=>{const K=window.Capacitor;return !!(K&&K.isNativePlatform&&K.isNativePlatform())};
const plugin=()=>{const K=window.Capacitor;return(isApp()&&K.Plugins&&K.Plugins.ApkUpdater)||null};

/* ---------- versions & GitHub ---------- */
const clean=v=>String(v||'').trim().replace(/^v/i,'');
const valid=v=>/^\d+(\.\d+){0,3}$/.test(v);
function cmp(a,b){a=clean(a).split('.').map(Number);b=clean(b).split('.').map(Number);
  for(let i=0;i<Math.max(a.length,b.length);i++){const d=(a[i]||0)-(b[i]||0);if(d)return d>0?1:-1}return 0}
// same asset choice as the download website
const apkOf=r=>{const a=(r.assets||[]).filter(x=>/\.apk$/i.test(x.name)&&(!x.state||x.state==='uploaded')&&x.browser_download_url);
  return a.find(x=>/universal/i.test(x.name))||a.find(x=>!/(debug|arm|x86)/i.test(x.name))||a[0]};

async function latest(force){
  if(!force){try{const c=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');if(c&&Date.now()-c.t<CACHE_MS&&c.rel)return c.rel}catch(e){}}
  let res;
  try{res=await fetch(API,{headers:{Accept:'application/vnd.github+json'}})}
  catch(e){throw new Error('offline')}
  if(res.status===403||res.status===429)throw new Error('limit');
  if(!res.ok)throw new Error('http '+res.status);
  const list=await res.json();
  const best=(Array.isArray(list)?list:[]).filter(r=>!r.draft&&!r.prerelease).map(r=>({r,v:clean(r.tag_name),a:apkOf(r)}))
    .filter(x=>x.a&&valid(x.v)).sort((x,y)=>cmp(y.v,x.v))[0];
  if(!best)throw new Error('none');
  const rel={version:best.v,notes:best.r.body||'',size:best.a.size||0,url:best.a.browser_download_url,
    sha256:/^sha256:[0-9a-f]{64}$/i.test(best.a.digest||'')?best.a.digest.slice(7).toLowerCase():''};   // GitHub adds a checksum to release assets; used when present
  try{localStorage.setItem(CACHE_KEY,JSON.stringify({t:Date.now(),rel}))}catch(e){}
  return rel;
}

/* ---------- overlay ---------- */
let ov=null,box=null,timer=null,open_=false,fallback=RELEASES_PAGE;
let cur=null,rel=null,st=null,view='checking',errMsg='',waitingPerm=false,busy=false;

function css(){
  if(document.getElementById('uv-css'))return;
  const s=document.createElement('style');s.id='uv-css';
  s.textContent=`#uv{position:fixed;inset:0;z-index:50;display:grid;place-items:center;background:rgba(16,23,43,.55);backdrop-filter:blur(4px);padding:16px}
#uv.hid{display:none}
#uv .box{position:relative;background:var(--card);color:var(--ink);border-radius:22px;padding:22px;width:min(400px,100%);max-height:calc(100vh - 32px);overflow:auto;box-shadow:0 24px 70px rgba(0,0,0,.45)}
#uv h3{margin:0 40px 6px 0}#uv p{margin:8px 0}#uv .meta{font-size:14px;color:var(--mute)}
#uv .x{position:absolute;top:10px;right:10px;display:grid;place-items:center;width:32px;height:32px;padding:0;border:1px solid var(--line);border-radius:50%;background:var(--card);color:var(--ink);font:700 15px/1 system-ui,sans-serif;cursor:pointer}
#uv .uv-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}#uv .uv-row .btn{flex:1;min-width:120px}
#uv .uv-bar{height:10px;border-radius:99px;background:var(--line);overflow:hidden;margin:14px 0 6px}
#uv .uv-bar i{display:block;height:100%;width:0;background:var(--acc);border-radius:99px;transition:width .35s ease}
#uv .uv-bar.ind i{width:35%;animation:uvslide 1.1s ease-in-out infinite alternate}@keyframes uvslide{from{margin-left:0}to{margin-left:65%}}
#uv .uv-notes{max-height:150px;overflow:auto;margin:10px 0 0;padding:10px 12px;border:1px solid var(--line);border-radius:12px;font-size:13px;color:var(--mute);background:var(--bg)}
#uv .uv-notes ul{margin:0;padding-left:18px}#uv .uv-notes p{margin:4px 0}
#uv .uv-ok{color:var(--acc);font-weight:700}#uv .uv-err{color:var(--bad,#c62828);font-weight:600}
@media(prefers-reduced-motion:reduce){#uv .uv-bar i,#uv .uv-bar.ind i{transition:none;animation:none}}`;
  document.head.append(s);
}
function build(){
  if(ov)return;css();
  ov=document.createElement('div');ov.id='uv';ov.className='hid';
  ov.innerHTML='<div class="box" role="dialog" aria-modal="true" aria-labelledby="uvt"></div>';
  box=ov.firstChild;document.body.append(ov);
  ov.addEventListener('click',e=>{
    if(e.target===ov)return close();
    const b=e.target.closest('[data-up]');if(b)act(b.dataset.up);
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&open_)close()});
  // coming back from Android's settings page or from the installer
  document.addEventListener('visibilitychange',async()=>{
    if(document.hidden||!open_)return;
    const P=plugin();if(!P)return;
    try{st=await P.status()}catch(e){return}
    if(waitingPerm&&st.state==='ready'){
      if(st.canInstall){waitingPerm=false;return install()}   // the person just allowed it: carry on
      return paint();
    }
    if(view==='installing'){view='ready';paint()}              // installer was dismissed: offer the button again
  });
}
function show(){build();open_=true;ov.classList.remove('hid')}
function close(){open_=false;stopPoll();if(ov)ov.classList.add('hid')}

/* ---------- notes (tiny, safe markdown: everything is escaped first) ---------- */
function notesHtml(src){
  const inl=t=>esc(t).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>');
  let h='',ul=false;
  for(const raw of String(src||'').split(/\r?\n/)){
    const l=raw.trim(),li=l.match(/^[-*+]\s+(.*)/),hd=l.match(/^#{1,6}\s+(.*)/);
    if(li){if(!ul){h+='<ul>';ul=true}h+='<li>'+inl(li[1])+'</li>';continue}
    if(ul){h+='</ul>';ul=false}
    if(hd)h+='<p><b>'+inl(hd[1])+'</b></p>';else if(l)h+='<p>'+inl(l)+'</p>';
  }
  return(ul?h+'</ul>':h);
}

/* ---------- views ---------- */
const head=t=>`<button type="button" class="x" data-up="close" aria-label="Close">✕</button><h3 id="uvt">${esc(t)}</h3>`;
const vline=()=>`<p class="meta">Installed: v${esc(cur?cur.versionName:'?')}${rel?' · Latest: v'+esc(rel.version):''}</p>`;
const notes=()=>rel&&rel.notes.trim()?`<div class="uv-notes">${notesHtml(rel.notes)}</div>`:'';

function paint(){
  if(!box)return;
  let h='';
  const newV=(rel&&rel.version)||(st&&st.version)||'';
  if(view==='checking'){
    h=head('Checking for updates…')+`<div class="uv-bar ind" aria-hidden="true"><i></i></div><p class="meta">Looking for the newest version on GitHub.</p>`;
  }else if(view==='uptodate'){
    h=head('You are up to date')+`<p class="uv-ok">Campus Events v${esc(cur?cur.versionName:'')}</p><p class="meta">This is the newest version.</p>
      <div class="uv-row"><button class="btn ghost" data-up="recheck">Check again</button><button class="btn" data-up="close">Close</button></div>`;
  }else if(view==='downloading'){
    const tot=st&&st.total>0?st.total:(rel?rel.size:0),dl=st?st.downloaded:0,pct=tot>0?Math.min(100,Math.floor(dl*100/tot)):0;
    h=head('Downloading v'+newV)+vline()+
      `<div class="uv-bar${tot>0?'':' ind'}" data-prog role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>
       <p class="meta" data-prog-text aria-live="polite">${tot>0?mb(dl)+' of '+mb(tot)+' · '+pct+'%':mb(dl)}</p><p class="meta">Keep the app open until the download finishes.</p>${notes()}
       <div class="uv-row"><button class="btn ghost" data-up="cancel">Cancel</button></div>`;
  }else if(view==='idle'){
    h=head('Update available')+vline()+`<p>Version ${esc(newV)} is available.</p>${notes()}
      <div class="uv-row"><button class="btn" data-up="download">Download now</button><button class="btn ghost" data-up="close">Later</button></div>`;
  }else if(view==='ready'){
    h=head('Update ready')+vline()+`<p>Version ${esc(newV)} has been downloaded.</p><p class="meta">Tap Update and confirm in the Android screen that opens. The app will close and reopen after the update.</p>${notes()}
      <div class="uv-row"><button class="btn" data-up="install">Update</button><button class="btn ghost" data-up="close">Later</button></div>`;
  }else if(view==='perm'){
    h=head('One-time permission')+`<p>Android needs your permission before Campus Events can install updates.</p>
      <p class="meta">On the settings page that opened, turn on <b>Allow from this source</b>, then press back to return here. The update will continue by itself.</p>
      <div class="uv-row"><button class="btn" data-up="install">Open settings again</button><button class="btn ghost" data-up="close">Later</button></div>`;
  }else if(view==='installing'){
    h=head('Confirm the update')+`<p>Android is asking you to confirm the update.</p><p class="meta">Tap <b>Update</b> there. When it finishes, open Campus Events again.</p>
      <div class="uv-row"><button class="btn ghost" data-up="close">Close</button></div>`;
  }else if(view==='legacy'){
    h=head('Update by download once')+`<p>This installed version cannot update itself yet.</p><p class="meta">Download the latest version once from the download page and install it. From then on, updates happen inside the app (Profile menu &gt; Update app).</p>
      <div class="uv-row"><button class="btn" data-up="web">Open download page</button><button class="btn ghost" data-up="close">Close</button></div>`;
  }else{ // error
    h=head('Could not update')+`<p class="uv-err" role="alert">${esc(errMsg||'Something went wrong.')}</p>
      <div class="uv-row"><button class="btn" data-up="retry">Try again</button><button class="btn ghost" data-up="web">Open download page</button></div>
      <div class="uv-row" style="margin-top:8px"><button class="btn ghost" data-up="close">Close</button></div>`;
  }
  box.innerHTML=h;
}
const go=(v,msg)=>{view=v;if(msg!==undefined)errMsg=msg;paint()};

/* ---------- download progress ---------- */
function stopPoll(){if(timer){clearInterval(timer);timer=null}}
function poll(){
  stopPoll();const P=plugin();if(!P)return;
  timer=setInterval(async()=>{
    let s;try{s=await P.status()}catch(e){return}
    st=s;
    if(s.state==='downloading'){
      view='downloading';if(!open_)return;
      const bar=box&&box.querySelector('[data-prog]'),txt=box&&box.querySelector('[data-prog-text]');
      if(bar&&txt&&s.total>0){const p=Math.min(100,Math.floor(s.downloaded*100/s.total));
        bar.firstChild.style.width=p+'%';bar.setAttribute('aria-valuenow',p);txt.textContent=mb(s.downloaded)+' of '+mb(s.total)+' · '+p+'%'}
      else paint();
      return}
    stopPoll();
    if(s.state==='ready')view='ready';
    else if(s.state==='error'){view='error';errMsg=s.error||'The download failed. Please try again.'}
    else view=rel&&cur&&cmp(rel.version,cur.versionName)>0?'idle':'uptodate';
    if(open_)paint();
  },400);
}

/* ---------- main flow ---------- */
const readable=e=>{const m=String(e&&e.message||e);
  if(m==='offline')return'No internet connection. Check your network and try again.';
  if(m==='limit')return'GitHub is limiting requests from this network right now. Please try again in a few minutes, or use the download page.';
  if(m==='none')return'No downloadable version was found on GitHub yet.';
  return'Could not check for updates ('+m+'). Please try again.'};

async function run(force){
  if(busy)return;busy=true;
  const P=plugin();
  try{
    go('checking');
    cur=await P.info();st=await P.status();rel=null;
    try{rel=await latest(!!force)}
    catch(e){
      // offline but an update was already downloaded earlier: still let the person install it
      if(st.state==='ready'&&st.version&&cmp(st.version,cur.versionName)>0){view='ready';paint();return}
      if(st.state==='downloading'){view='downloading';paint();poll();return}
      throw e;
    }
    if(cmp(rel.version,cur.versionName)<=0){go('uptodate');return}   // installed is the newest (or newer)
    // an update exists
    if(st.state==='ready'&&st.version===rel.version){view='ready';paint();return}
    if(st.state==='downloading'&&st.version===rel.version){view='downloading';paint();poll();return}
    if(st.state==='downloading'||st.state==='ready')st=await P.cancel();   // leftover of an older version
    st=await P.start({url:rel.url,version:rel.version,size:rel.size,sha256:rel.sha256});
    if(st.state==='ready'){view='ready';paint();return}   // the same file was already on the phone and is intact
    view='downloading';paint();poll();
  }catch(e){
    go('error',readable(e));
  }finally{busy=false}
}

async function install(){
  const P=plugin();if(!P)return;
  try{
    const r=await P.install();
    if(r&&r.needsPermission){waitingPerm=true;go('perm');return}
    waitingPerm=false;go('installing');
  }catch(e){
    waitingPerm=false;
    go('error',String(e&&e.message||e||'Could not start the installer.'));
  }
}

async function act(a){
  const P=plugin();
  if(a==='close')return close();
  if(a==='web'){try{window.open(fallback,'_blank')}catch(e){}return}
  if(a==='recheck'||a==='retry')return run(true);
  if(a==='install')return install();
  if(a==='cancel'){stopPoll();try{st=await P.cancel()}catch(e){}return go('idle')}   // stays cancelled until the person taps Download now
  if(a==='download')return run(false);
}

/* ---------- public ---------- */
function openUpdater(o){
  if(!isApp()){return}                       // website: nothing to update, it always serves the newest files
  fallback=(o&&o.fallbackUrl)||RELEASES_PAGE;
  show();
  if(!plugin()){go('legacy');return}         // an APK built before 3.14.0 has no native updater
  run(false);
}
window.CEMUpdater={available:()=>isApp()&&!!plugin(),open:openUpdater};
})();
