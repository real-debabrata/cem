/* CEM 3.11.0: the ticket picture.
   One place draws every ticket PNG: the organizer's Ticket window (scan.js), the emailed ticket (mailer.js) and the attendee's own
   ticket page (ticket.html). Nothing is uploaded; the picture is drawn on a canvas from the data already in the ticket link.

   Two looks, both a tall ticket with side notches and a tear-off stub:
     'gradient'  purple gradient with the QR on top and a light stub (the default)
     'flat'      white ticket with striped edges, soft rings and the QR at the bottom
   The only code on the ticket is ONE QR code holding  CEM1:<event code>:<ticket id>  (the same text scan.js reads). No barcode.

   window.cemTicket:
     STYLES                         {gradient:'Gradient', flat:'Flat'}
     styleOf(eventCode) / setStyle(eventCode, style)   remembered on this device
     render(o)  -> Promise<canvas>   o = {style, event, type, name, date:'YYYY-MM-DD', time:'HH:MM', venue, id, code}
     blob(o)    -> Promise<Blob>     PNG
     b64(o)     -> Promise<{b64,w,h}> PNG as base64 (used for emails)
     fileName(name)                  ticket-asha-rao.png
     canShareFiles() / share(blob,name,title,text)   the phone's share sheet with the picture attached
   The picture is 720 x 1440 pixels with a transparent margin that holds the soft shadow, saved as a 256-colour PNG of about 40-70 KB. */
(function(){
'use strict';
const W=720,H=1440,PAD=36,TW=W-2*PAD,Y0=30,TH=1380,R=40;
const FONT="'Poppins','Figtree','Segoe UI','Nirmala UI','Noto Sans',system-ui,-apple-system,Roboto,sans-serif";
const MONO="ui-monospace,'SF Mono',Menlo,Consolas,'Courier New',monospace";
const font=(w,s,it)=>(it?'italic ':'')+w+' '+s+'px '+FONT;
const STYLES={gradient:'Gradient',flat:'Flat'};
const SKEY=id=>'cem-ticket-style:'+id;
const styleOf=id=>{try{const v=localStorage.getItem(SKEY(id));return STYLES[v]?v:'gradient'}catch(e){return 'gradient'}};
const setStyle=(id,s)=>{try{if(STYLES[s])localStorage.setItem(SKEY(id),s)}catch(e){}};
const slug=s=>String(s||'attendee').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,30)||'attendee';
const fileName=n=>'ticket-'+slug(n)+'.png';

/* ---------- fonts: wait for the bundled Poppins before drawing, or the first picture would use a fallback face ---------- */
let fontsP=null;
const fontsReady=()=>fontsP||(fontsP=(async()=>{
 try{if(document.fonts&&document.fonts.load)await Promise.all(['400','500','600','700','800'].map(w=>document.fonts.load(w+' 24px Poppins')).concat([document.fonts.load('italic 400 24px Poppins')]))}catch(e){}
})());

/* ---------- drawing helpers ---------- */
function rr(c,x,y,w,h,r){r=Math.min(r,w/2,h/2);c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()}
// The ticket outline: rounded corners and a half-circle bite out of both sides at the tear line (ny).
function ticketPath(x,y,w,h,r,ny,nr){
 const p=new Path2D(),PI=Math.PI;
 p.moveTo(x+r,y);p.lineTo(x+w-r,y);p.arcTo(x+w,y,x+w,y+r,r);
 p.lineTo(x+w,ny-nr);p.arc(x+w,ny,nr,-PI/2,PI/2,true);
 p.lineTo(x+w,y+h-r);p.arcTo(x+w,y+h,x+w-r,y+h,r);
 p.lineTo(x+r,y+h);p.arcTo(x,y+h,x,y+h-r,r);
 p.lineTo(x,ny+nr);p.arc(x,ny,nr,PI/2,-PI/2,true);
 p.lineTo(x,y+r);p.arcTo(x,y,x+r,y,r);p.closePath();return p;
}
// Soft shadow first (a solid fill), then everything else is clipped to the ticket shape.
function shell(c,P,under){c.save();c.shadowColor='rgba(24,18,80,.30)';c.shadowBlur=36;c.shadowOffsetY=16;c.fillStyle=under;c.fill(P);c.restore();c.save();c.clip(P)}
// Letter-spaced text without ctx.letterSpacing (older Safari and Firefox do not have it).
function spaced(c,t,x,y,sp,align){
 const ch=Array.from(String(t)),ws=ch.map(k=>c.measureText(k).width);let w=sp*Math.max(0,ch.length-1);ws.forEach(a=>{w+=a});
 let sx=align==='center'?x-w/2:align==='right'?x-w:x;const old=c.textAlign;c.textAlign='left';
 ch.forEach((k,i)=>{c.fillText(k,sx,y);sx+=ws[i]+sp});c.textAlign=old;
}
// Word wrap with a line limit. Very long words are broken; the last line ends in an ellipsis when the text does not fit.
function wrap(c,text,maxW,maxLines){
 const words=String(text||'').trim().split(/\s+/).filter(Boolean),out=[];let cur='';
 for(let w of words){
  while(c.measureText(w).width>maxW&&w.length>1){let k=w.length-1;while(k>1&&c.measureText(w.slice(0,k)).width>maxW)k--;if(cur){out.push(cur);cur=''}out.push(w.slice(0,k));w=w.slice(k)}
  const t=cur?cur+' '+w:w;
  if(c.measureText(t).width<=maxW)cur=t;else{if(cur)out.push(cur);cur=w}
 }
 if(cur)out.push(cur);
 if(out.length>maxLines){const keep=out.slice(0,maxLines);let l=keep[maxLines-1];while(l.length>1&&c.measureText(l+'\u2026').width>maxW)l=l.slice(0,-1);keep[maxLines-1]=l.trimEnd()+'\u2026';return{lines:keep,cut:true}}
 return{lines:out,cut:false};
}
// First size that fits. A step is a size, or [size, lines] when smaller text may use more lines.
// If even the last step is too long, it is cut with an ellipsis.
function fit(c,text,maxW,maxLines,sizes,weight){
 const st=sizes.map(z=>Array.isArray(z)?z:[z,maxLines]);
 for(const z of st){c.font=font(weight,z[0]);const r=wrap(c,text,maxW,z[1]);if(!r.cut)return{size:z[0],lines:r.lines}}
 const z=st[st.length-1];c.font=font(weight,z[0]);return{size:z[0],lines:wrap(c,text,maxW,z[1]).lines};
}
function qrDraw(c,payload,x,y,size,fg){
 const q=qrcode(0,'M');q.addData(payload);q.make();
 const n=q.getModuleCount(),px=Math.max(2,Math.floor(size/(n+8))),qs=px*n,ox=x+Math.round((size-qs)/2),oy=y+Math.round((size-qs)/2);
 c.fillStyle=fg;for(let i=0;i<n;i++)for(let j=0;j<n;j++)if(q.isDark(i,j))c.fillRect(ox+j*px,oy+i*px,px,px);
}
// The Campus Events mark (same shape as brand/logo.svg).
const MARK='M34 0 H160 A24 24 0 0 1 184 24 A24 24 0 0 1 160 48 H62 A14 14 0 0 0 48 62 V78 A14 14 0 0 0 62 92 H160 A24 24 0 0 1 184 116 A24 24 0 0 1 160 140 H62 A14 14 0 0 0 48 154 V170 A14 14 0 0 0 62 184 H160 A24 24 0 0 1 184 208 A24 24 0 0 1 160 232 H34 A34 34 0 0 1 0 198 V34 A34 34 0 0 1 34 0 Z';
function logo(c,x,y,s,bg,fg){
 c.save();c.fillStyle=bg;rr(c,x,y,s,s,s*.234);c.fill();
 c.translate(x,y);c.scale(s/512,s/512);c.translate(136.4,105.2);c.scale(1.3,1.3);c.fillStyle=fg;c.fill(new Path2D(MARK));c.restore();
}

/* ---------- what goes on the ticket ---------- */
function prep(o){
 const s=v=>String(v==null?'':v).replace(/\s+/g,' ').trim();
 const d=o.date?new Date(o.date+'T'+(o.time||'00:00')):null,ok=!!(d&&!isNaN(d));
 const id=s(o.id),grp=id.toUpperCase().replace(/(.{4})(?=.)/g,'$1-');
 return{style:STYLES[o.style]?o.style:'gradient',event:s(o.event)||'Event',type:s(o.type),name:s(o.name)||'Guest',venue:s(o.venue),id,idShow:grp,code:s(o.code).toUpperCase(),
  date:ok?d.toLocaleDateString([],{day:'numeric',month:'short',year:'numeric'}).toUpperCase():s(o.date).toUpperCase(),
  time:ok&&o.time?d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}).toUpperCase():'',
  payload:'CEM1:'+s(o.code).toUpperCase()+':'+id};
}

/* ---------- look 1: gradient ---------- */
function drawGradient(c,t){
 const x=PAD,w=TW,cx=x+w/2,ny=Y0+1060,nr=34,P=ticketPath(x,Y0,w,TH,R,ny,nr);
 shell(c,P,'#5b3df5');
 // top: violet gradient with soft swirls. The gradient runs straight down and the swirls are flat see-through shapes:
 // that keeps the PNG small enough to email (a diagonal or radial gradient made it 3x bigger).
 let g=c.createLinearGradient(0,Y0,0,ny);g.addColorStop(0,'#4c3bf2');g.addColorStop(.5,'#6a3df3');g.addColorStop(1,'#9b3df2');
 c.fillStyle=g;c.fillRect(x,Y0,w,ny-Y0);
 c.save();c.beginPath();c.rect(x,Y0,w,ny-Y0);c.clip();
 c.fillStyle='rgba(255,255,255,.06)';c.beginPath();c.arc(x+w+10,Y0+60,330,0,Math.PI*2);c.fill();
 c.fillStyle='rgba(255,255,255,.07)';c.beginPath();c.moveTo(x-40,Y0+330);c.bezierCurveTo(x+170,Y0+190,x+360,Y0+520,x+w+40,Y0+300);c.lineTo(x+w+40,Y0+560);c.bezierCurveTo(x+450,Y0+420,x+200,Y0+780,x-40,Y0+600);c.closePath();c.fill();
 c.fillStyle='rgba(255,255,255,.06)';c.beginPath();c.moveTo(x-40,Y0+700);c.bezierCurveTo(x+200,Y0+620,x+420,Y0+900,x+w+40,Y0+760);c.lineTo(x+w+40,Y0+1100);c.lineTo(x-40,Y0+1100);c.closePath();c.fill();
 c.strokeStyle='rgba(255,255,255,.12)';c.lineWidth=2;c.beginPath();c.moveTo(x-30,Y0+410);c.bezierCurveTo(x+200,Y0+300,x+380,Y0+600,x+w+30,Y0+400);c.stroke();
 c.restore();
 // brand row
 logo(c,x+40,Y0+36,48,'rgba(255,255,255,.18)','#ffffff');
 c.fillStyle='#fff';c.textBaseline='alphabetic';c.font=font(700,24);c.textAlign='left';c.fillText('Campus Events',x+100,Y0+69);
 if(t.type){c.font=font(600,20);const tw=Math.min(210,c.measureText(t.type.toUpperCase()).width+40);
  c.strokeStyle='rgba(255,255,255,.65)';c.lineWidth=2;rr(c,x+w-40-tw,Y0+40,tw,40,20);c.stroke();
  c.fillStyle='#fff';c.textAlign='center';let ty=t.type.toUpperCase();while(ty.length>3&&c.measureText(ty).width>tw-24)ty=ty.slice(0,-1);c.fillText(ty,x+w-40-tw/2,Y0+67)}
 // QR
 const qs=352,qx=cx-qs/2,qy=Y0+118;
 c.save();c.shadowColor='rgba(20,10,90,.35)';c.shadowBlur=26;c.shadowOffsetY=10;c.fillStyle='#fff';rr(c,qx,qy,qs,qs,28);c.fill();c.restore();
 qrDraw(c,t.payload,qx,qy,qs,'#16123a');
 c.fillStyle='rgba(255,255,255,.88)';c.font=font(600,19);spaced(c,'SCAN AT THE GATE',cx,qy+qs+44,4,'center');
 const dots=yy=>{c.save();c.setLineDash([1,11]);c.lineCap='round';c.lineWidth=4;c.strokeStyle='rgba(255,255,255,.55)';c.beginPath();c.moveTo(x+60,yy);c.lineTo(x+w-60,yy);c.stroke();c.restore()};
 dots(Y0+566);
 // event name, centred between the two dotted lines
 const nm=fit(c,t.event,w-96,2,[54,48,42,[37,3],[33,3],[30,3]],800),lh=Math.round(nm.size*1.2),bh=(nm.lines.length-1)*lh+nm.size*.72;
 const y1=Y0+566,y2=Y0+790,top=y1+(y2-y1-bh)/2+nm.size*.72;
 c.fillStyle='#fff';c.textAlign='center';c.font=font(800,nm.size);nm.lines.forEach((l,i)=>c.fillText(l,cx,Math.round(top+i*lh)));
 // details
 dots(Y0+790);
 c.fillStyle='rgba(255,255,255,.75)';c.font=font(600,18);spaced(c,'DETAILS',cx,Y0+836,5,'center');
 const lab=(s,px,py)=>{c.fillStyle='rgba(255,255,255,.7)';c.font=font(500,17);spaced(c,s,px,py,3,'center')};
 const val=(s,px,py,sz)=>{c.fillStyle='#fff';c.font=font(700,sz||29);c.textAlign='center';c.fillText(s,px,py)};
 if(t.time){lab('DATE',x+w*.29,Y0+886);val(t.date,x+w*.29,Y0+926,t.date.length>11?25:29);lab('TIME',x+w*.73,Y0+886);val(t.time,x+w*.73,Y0+926)}
 else{lab('DATE',cx,Y0+886);val(t.date||'To be announced',cx,Y0+926)}
 if(t.venue){lab('VENUE',cx,Y0+964);const v=fit(c,t.venue,w-100,2,[28,25,22],600);c.fillStyle='#fff';c.font=font(600,v.size);c.textAlign='center';v.lines.forEach((l,i)=>c.fillText(l,cx,Y0+1004+i*Math.round(v.size*1.3)))}
 // stub
 g=c.createLinearGradient(0,ny,0,Y0+TH);g.addColorStop(0,'#fdfdff');g.addColorStop(1,'#e6e7f1');c.fillStyle=g;c.fillRect(x,ny,w,Y0+TH-ny);
 c.save();c.setLineDash([9,9]);c.lineWidth=3;c.strokeStyle='rgba(91,61,245,.35)';c.beginPath();c.moveTo(x+nr+18,ny);c.lineTo(x+w-nr-18,ny);c.stroke();c.restore();
 c.fillStyle='#5b3df5';c.textAlign='center';c.font=font(800,38);spaced(c,'ADMIT ONE',cx,ny+82,6,'center');
 c.font=font(500,22);c.fillStyle='#4d5069';let ev=t.event;while(ev.length>4&&c.measureText(ev).width>w-90)ev=ev.slice(0,-1);if(ev!==t.event)ev=ev.trimEnd()+'\u2026';c.fillText(ev,cx,ny+118);
 const an=fit(c,t.name,w-90,1,[36,32,[28,2],[25,2],[22,2]],700),alh=Math.round(an.size*1.15);c.fillStyle='#7a3cf0';c.font=font(700,an.size);an.lines.forEach((l,i)=>c.fillText(l,cx,ny+176+i*alh));
 const iy=Math.max(ny+236,ny+176+(an.lines.length-1)*alh+54);
 c.fillStyle='#8b8fa8';c.font=font(500,16);spaced(c,'TICKET ID',cx,iy,4,'center');
 c.fillStyle='#23253d';c.font='600 26px '+MONO;spaced(c,t.idShow,cx,iy+36,3,'center');
 c.restore();
}

/* ---------- look 2: flat ---------- */
function drawFlat(c,t){
 const x=PAD,w=TW,cx=x+w/2,ny=Y0+940,nr=34,B='#4f7df3',P=ticketPath(x,Y0,w,TH,R,ny,nr);
 shell(c,P,'#fbfcff');
 c.fillStyle='#fbfcff';c.fillRect(x,Y0,w,TH);
 // soft rings
 c.strokeStyle='#e9eefc';c.lineWidth=46;[[x+150,Y0+270,118],[x+540,Y0+640,96],[x+110,Y0+800,64],[x+560,Y0+1230,110],[x+90,Y0+1300,70]].forEach(r=>{c.beginPath();c.arc(r[0],r[1],r[2],0,Math.PI*2);c.stroke()});
 // striped top and bottom edges
 const stripes=yy=>{c.save();c.beginPath();c.rect(x,yy,w,26);c.clip();c.fillStyle='#fbfcff';c.fillRect(x,yy,w,26);c.strokeStyle='#9db3ee';c.lineWidth=13;
  for(let k=-60;k<w+60;k+=34){c.beginPath();c.moveTo(x+k,yy+30);c.lineTo(x+k+34,yy-4);c.stroke()}c.restore()};
 stripes(Y0);stripes(Y0+TH-26);
 // brand row
 logo(c,x+44,Y0+58,46,B,'#fff');c.textAlign='left';c.fillStyle='#10172b';c.font=font(700,24);c.fillText('Campus Events',x+102,Y0+91);
 if(t.type){c.font=font(600,19);const tw=Math.min(210,c.measureText(t.type).width+38);c.fillStyle=B;rr(c,x+w-44-tw,Y0+60,tw,42,21);c.fill();
  c.fillStyle='#fff';c.textAlign='center';let ty=t.type;while(ty.length>3&&c.measureText(ty).width>tw-22)ty=ty.slice(0,-1);c.fillText(ty,x+w-44-tw/2,Y0+88)}
 const L=x+48,lab=(s,px,py,al)=>{c.fillStyle='#8a94b0';c.font=font(400,22,true);c.textAlign=al||'left';c.fillText(s,px,py)};
 const txt=(s,px,py,sz,al)=>{c.fillStyle='#10172b';c.font=font(700,sz);c.textAlign=al||'left';c.fillText(s,px,py)};
 lab('Ticket code',cx,Y0+186,'center');c.font=font(700,30);c.fillStyle='#10172b';c.textAlign='center';
 const code=(t.code?t.code+'-':'')+t.idShow.replace(/-/g,'');c.font=font(700,30);let cs=30;while(cs>20&&c.measureText(code).width>w-80){cs--;c.font=font(700,cs)}c.fillText(code,cx,Y0+228);
 lab('Event',L,Y0+302);const ev=fit(c,t.event,w-96,2,[38,34,30,26],700),elh=Math.round(ev.size*1.25);c.fillStyle='#10172b';c.font=font(700,ev.size);c.textAlign='left';ev.lines.forEach((l,i)=>c.fillText(l,L,Y0+346+i*elh));
 let yy=Y0+346+(ev.lines.length-1)*elh+70;
 lab('Date',L,yy);if(t.time)lab('Time',x+w/2+20,yy);
 txt(t.date||'To be announced',L,yy+44,t.date.length>11?29:33);if(t.time)txt(t.time,x+w/2+20,yy+44,33);
 yy+=118;lab('Attendee',L,yy);const an=fit(c,t.name,w-96,1,[36,32,[30,2],[27,2],[24,2]],700),alh=Math.round(an.size*1.2);
 c.fillStyle='#10172b';c.font=font(700,an.size);c.textAlign='left';an.lines.forEach((l,i)=>c.fillText(l,L,yy+44+i*alh));yy+=(an.lines.length-1)*alh;
 if(t.venue){yy+=118;lab('Place',L,yy);const v=fit(c,t.venue,w-96,2,[32,28,25],700);c.fillStyle='#10172b';c.font=font(700,v.size);c.textAlign='left';v.lines.forEach((l,i)=>c.fillText(l,L,yy+44+i*Math.round(v.size*1.25)))}
 // tear line
 c.save();c.setLineDash([10,10]);c.lineWidth=3;c.strokeStyle='#c4d0f3';c.beginPath();c.moveTo(x+nr+18,ny);c.lineTo(x+w-nr-18,ny);c.stroke();c.restore();
 // QR with "SCAN ME!"
 const qs=270,qx=cx-qs/2,qy=ny+(Y0+TH-26-ny-qs)/2+6;
 c.fillStyle='#fff';c.strokeStyle='#dfe6fa';c.lineWidth=3;rr(c,qx-6,qy-6,qs+12,qs+12,20);c.fill();c.stroke();
 qrDraw(c,t.payload,qx,qy,qs,'#10172b');
 c.fillStyle=B;c.font=font(800,30);c.textAlign='right';c.fillText('SCAN',qx-22,qy+qs/2+11);c.textAlign='left';c.fillText('ME!',qx+qs+24,qy+qs/2+11);
 c.restore();
}


/* ---------- small PNG: palette (indexed colour) encoder ----------
   The browser's own PNG is always full colour and came out at 130-270 KB. These tickets use few colours, so the picture is reduced to a
   256-colour palette (median cut, transparency kept) and written as an indexed PNG: about 30-90 KB, and the QR stays pure dark on white.
   Falls back to the browser's PNG when CompressionStream is missing. */
const CRCT=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
const crc32=(b,a,z)=>{let c=-1;for(let i=a;i<z;i++)c=CRCT[(c^b[i])&255]^(c>>>8);return(c^-1)>>>0};
function pngChunk(type,data){const o=new Uint8Array(12+data.length),v=new DataView(o.buffer);v.setUint32(0,data.length);for(let i=0;i<4;i++)o[4+i]=type.charCodeAt(i);o.set(data,8);v.setUint32(8+data.length,crc32(o,4,8+data.length));return o}
async function zlib(u8){const cs=new CompressionStream('deflate'),w=cs.writable.getWriter();w.write(u8);w.close();return new Uint8Array(await new Response(cs.readable).arrayBuffer())}
function quantize(d,maxC){
 // histogram of 6-bit colours (4-bit alpha), keeping the true average of each bucket
 const map=new Map(),ks=[],cnt=[],sr=[],sg=[],sb=[],sa=[],n=d.length>>2,keyOf=new Uint32Array(n);
 for(let i=0,p=0;i<n;i++,p+=4){
  const a=d[p+3],r=a?d[p]:0,g=a?d[p+1]:0,b=a?d[p+2]:0,k=a?(((r>>2)<<16)|((g>>2)<<10)|((b>>2)<<4)|(a>>4))+1:0;
  keyOf[i]=k;let j=map.get(k);if(j===undefined){j=ks.length;map.set(k,j);ks.push(k);cnt.push(0);sr.push(0);sg.push(0);sb.push(0);sa.push(0)}
  cnt[j]++;sr[j]+=r;sg[j]+=g;sb[j]+=b;sa[j]+=a;
 }
 const m=ks.length,col=j=>[sr[j]/cnt[j],sg[j]/cnt[j],sb[j]/cnt[j],sa[j]/cnt[j]],C=[];for(let j=0;j<m;j++)C.push(col(j));
 let boxes=[Array.from({length:m},(_,j)=>j)];
 const ext=bx=>{const lo=[255,255,255,255],hi=[0,0,0,0];bx.forEach(j=>{for(let c=0;c<4;c++){if(C[j][c]<lo[c])lo[c]=C[j][c];if(C[j][c]>hi[c])hi[c]=C[j][c]}});let bc=0,bv=-1;for(let c=0;c<4;c++){const v=(hi[c]-lo[c])*(c===3?1.2:1);if(v>bv){bv=v;bc=c}}return{c:bc,v:bv}};
 const info=new Map();const score=bx=>{let t=0;bx.forEach(j=>{t+=cnt[j]});const e=ext(bx);return{e,w:e.v*Math.sqrt(t)}};
 const sc=boxes.map(score);
 while(boxes.length<maxC){
  let bi=-1,bw=0;for(let i=0;i<boxes.length;i++)if(boxes[i].length>1&&sc[i].w>bw){bw=sc[i].w;bi=i}
  if(bi<0)break;
  const bx=boxes[bi],ch=sc[bi].e.c;bx.sort((x,y)=>C[x][ch]-C[y][ch]);
  let tot=0;bx.forEach(j=>{tot+=cnt[j]});let acc=0,cut=1;for(let i=0;i<bx.length-1;i++){acc+=cnt[bx[i]];cut=i+1;if(acc>=tot/2)break}
  const A=bx.slice(0,cut),B=bx.slice(cut);boxes[bi]=A;sc[bi]=score(A);boxes.push(B);sc.push(score(B));
 }
 const pal=[],idxOfKey=new Map();
 boxes.forEach((bx,pi)=>{let t=0,r=0,g=0,b=0,a=0;bx.forEach(j=>{t+=cnt[j];r+=sr[j];g+=sg[j];b+=sb[j];a+=sa[j];idxOfKey.set(ks[j],pi)});pal.push([Math.round(r/t),Math.round(g/t),Math.round(b/t),Math.round(a/t)])});
 const px=new Uint8Array(n);for(let i=0;i<n;i++)px[i]=idxOfKey.get(keyOf[i]);
 return{pal,px};
}
async function indexedPng(cv){
 const w=cv.width,h=cv.height,d=cv.getContext('2d').getImageData(0,0,w,h).data,q=quantize(d,256),px=q.px;
 // per-row filter (none, sub, up, paeth): whichever gives the smallest sum of absolute values
 const out=new Uint8Array(h*(w+1)),cand=[0,1,2,4].map(()=>new Uint8Array(w));
 for(let y=0;y<h;y++){
  const o=y*w,up=y?o-w:-1;let best=0,bs=1e12;
  for(let f=0;f<4;f++){
   const t=cand[f],ft=[0,1,2,4][f];let s=0;
   for(let x=0;x<w;x++){
    const a=x?px[o+x-1]:0,b=up>=0?px[up+x]:0,c=up>=0&&x?px[up+x-1]:0,v=px[o+x];let p=0;
    if(ft===1)p=a;else if(ft===2)p=b;else if(ft===4){const pp=a+b-c,pa=Math.abs(pp-a),pb=Math.abs(pp-b),pc=Math.abs(pp-c);p=pa<=pb&&pa<=pc?a:pb<=pc?b:c}
    const r=(v-p)&255;t[x]=r;s+=r<128?r:256-r;
   }
   if(s<bs){bs=s;best=f}
  }
  out[y*(w+1)]=[0,1,2,4][best];out.set(cand[best],y*(w+1)+1);
 }
 const z=await zlib(out),np=q.pal.length,plte=new Uint8Array(np*3),trns=new Uint8Array(np);let ht=false;
 q.pal.forEach((c,i)=>{plte[i*3]=c[0];plte[i*3+1]=c[1];plte[i*3+2]=c[2];trns[i]=c[3];if(c[3]<255)ht=true});
 const ih=new Uint8Array(13),dv=new DataView(ih.buffer);dv.setUint32(0,w);dv.setUint32(4,h);ih[8]=8;ih[9]=3;
 const parts=[new Uint8Array([137,80,78,71,13,10,26,10]),pngChunk('IHDR',ih),pngChunk('PLTE',plte)];
 if(ht)parts.push(pngChunk('tRNS',trns));parts.push(pngChunk('IDAT',z),pngChunk('IEND',new Uint8Array(0)));
 return new Blob(parts,{type:'image/png'});
}
const nativePng=cv=>new Promise((ok,no)=>cv.toBlob(b=>b?ok(b):no(new Error('Could not make the picture.')),'image/png'));
async function pngOf(cv){
 if(typeof CompressionStream==='function'){try{return await indexedPng(cv)}catch(e){}}
 return nativePng(cv);
}
const toB64=async b=>{const u=new Uint8Array(await b.arrayBuffer());let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s)};

/* ---------- public ---------- */
async function render(o){
 if(typeof qrcode!=='function')throw new Error('The QR library did not load.');
 await fontsReady();
 const t=prep(o||{}),cv=document.createElement('canvas');cv.width=W;cv.height=H;
 const c=cv.getContext('2d');(t.style==='flat'?drawFlat:drawGradient)(c,t);
 return cv;
}
const blob=async o=>pngOf(await render(o));
const b64=async o=>{const cv=await render(o),b=await pngOf(cv);return{b64:await toB64(b),w:cv.width,h:cv.height}};
function canShareFiles(){try{return !!(navigator.canShare&&navigator.share&&navigator.canShare({files:[new File([new Blob(['x'])],'t.png',{type:'image/png'})]}))}catch(e){return false}}
async function share(b,name,title,text){
 try{const f=new File([b],name,{type:'image/png'});
  if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],title:title||'Ticket',text:text||''});return true}}
 catch(e){if(e&&e.name==='AbortError')return true}
 return false;
}
window.cemTicket={STYLES,styleOf,setStyle,render,blob,b64,fileName,canShareFiles,share,W,H};
})();
