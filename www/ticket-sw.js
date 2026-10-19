/* CEM 3.11.0: offline copy of the ticket page.
   Only ticket.html and the few files it needs are kept (the ticket itself is drawn on the phone from the link, so nothing else is needed).
   Everything else, including the whole app, passes straight through to the network exactly as before: this worker never answers for it.
   Network first: when there is internet the newest files are used and the copy is refreshed; without internet the kept copy opens. */
const V='cem-ticket-3.11.0';
const FILES=['ticket.html','ticketart.js','qrcode.js','fonts.css','splash.css','splash.js','manifest.webmanifest',
 'fonts/poppins-400.woff2','fonts/poppins-500.woff2','fonts/poppins-600.woff2','fonts/poppins-700.woff2','fonts/poppins-800.woff2',
 'icons/favicon.svg','icons/apple-touch-icon.png','favicon.ico'];
const base=new URL('./',self.registration.scope).pathname;
const mine=new Set(FILES.map(f=>base+f));

self.addEventListener('install',e=>{
 e.waitUntil(caches.open(V).then(c=>Promise.all(FILES.map(f=>c.add(new Request(f,{cache:'reload'})).catch(()=>{})))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
 e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.indexOf('cem-ticket-')===0&&k!==V).map(k=>caches.delete(k)))));
});
self.addEventListener('fetch',e=>{
 const r=e.request;if(r.method!=='GET')return;
 const u=new URL(r.url);if(u.origin!==location.origin||!mine.has(u.pathname))return;   // not ours: do nothing, the browser handles it
 e.respondWith(fetch(r).then(res=>{
  if(res&&res.ok){const copy=res.clone();caches.open(V).then(c=>c.put(r,copy)).catch(()=>{})}
  return res;
 }).catch(()=>caches.match(r,{ignoreSearch:true}).then(m=>m||Response.error())));
});
