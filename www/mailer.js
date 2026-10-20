/* CEM 3.12.0: Email attendees, in three simple steps.
   (3.12.0: the window is now a short guided flow: 1 People, 2 Message, 3 Send. People shows who has and has not been emailed. Message has a tick box to
   send a ticket (QR) or just a plain invitation, because not every event needs a ticket. Send is where you pick your device's mail app or set up
   your email account (SMTP) by tapping a provider with its logo. Every action is a button now, not a text link. No Worker change is needed.)
   (3.11.0: automatic emails carry the designed ticket PNG, inline and as an attachment, and the ticket link opens the same picture with Save and
   offline support. The picture comes from ticketart.js; the QR inside it is unchanged.)
   (3.10.0: bulk ticket email.)  Attendees > Email attendees  (roles with "Attendees and check-in": Organizer, Manager, Treasurer, Team lead,
   Coordinator, Registration desk, and custom roles that have it. Nobody has to be added; the role decides.)

   Two ways to send, both from the organiser's OWN mailbox:
   1) This device's mail app - the phone's or computer's default mail app opens with the attendee's name, message and (if tickets are on) personal
                      ticket link already filled in. The organiser taps Send, comes back, taps "Open next". (A web page or app cannot press Send
                      inside another app for you; that is how every mail app works.)
   2) My email account (SMTP, automatic) - the organiser's own Gmail / Outlook / Yahoo / Zoho / Brevo / college mail login. The app sends batches of 4
                      through the Worker (worker/otp-worker.js, /mail/send), which signs in to that mail server and sends every email (with the
                      attendee's own ticket picture inside when tickets are on). The login is kept only on this device (localStorage), never in the
                      event data, so teammates cannot read it.

   Ticket on (default): the QR is the same ticket the app already uses:  CEM1:<event code>:<ticket id>  (scan.js). Nothing about check-in changes.
   Ticket off: a plain invitation. No QR, no ticket picture, no ticket link. The tick is remembered per event on this device.
   Each attendee row gets ml (time), mlv ('app' or 'smtp') and mlk ('t' ticket or 'i' invitation) when their email went out.
   Works in the Android app unchanged: mailto: links open the phone's mail app, and SMTP is a normal HTTPS call.
   Gmail, Zoho and Brevo logos: simple-icons (CC0). Yahoo and Outlook are simple lettermark badges drawn here. All names and logos belong to their owners. */
(function(){
const $=id=>document.getElementById(id);
const LS={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}},del(k){try{localStorage.removeItem(k)}catch(e){}}};
const EMAIL=/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]{2,}$/,BATCH=4,CID='ticket-qr@cem.local';   // 3.11.0: 4 per request, because each email can carry a ticket picture (about 60 KB)
const SMTP_KEY='cem-mail-smtp',MODE_KEY='cem-mail-mode',TPL_KEY=id=>'cem-mail-tpl:'+id;
const later=fn=>{clearTimeout(later.t);later.t=setTimeout(fn,160)};
const slug=s=>String(s||'event').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)||'event';

// Standard texts. One pair for a ticket email, one pair for a plain invitation.
const DEF_SUBJECT='Your ticket for {event}';
const DEF_BODY='Hi {first_name},\n\nYou are registered for {event}.\nWhen: {date} {time}\nWhere: {venue}\n\nYour personal ticket:\n{qr}\n\nShow the QR code at the entrance. Save the ticket picture to your phone so it opens even without internet. It works only once, so please do not forward it.\n\nSee you there!\n{organizer}';
const INV_SUBJECT='You are invited to {event}';
const INV_BODY='Hi {first_name},\n\nYou are invited to {event}.\nWhen: {date} {time}\nWhere: {venue}\n\nWe would love to see you there.\n\nSee you soon!\n{organizer}';
const defs=t=>t?{s:DEF_SUBJECT,b:DEF_BODY}:{s:INV_SUBJECT,b:INV_BODY};
// [tag, button label, longer hint]
const TAGS=[['first_name','First name'],['name','Full name'],['event','Event name'],['date','Date'],['time','Time'],['venue','Venue'],['qr','Ticket QR','The QR ticket: a picture in automatic emails, a link in your mail app'],['ticket_link','Ticket link','A link to the ticket page'],['college_id','College ID']];
const TICKET_TAGS=['qr','ticket_link'];
const KNOWN=TAGS.map(t=>t[0]).concat(['ticket_id','email','organizer']);

/* ---------- logos (Gmail, Zoho, Brevo: simple-icons, CC0. Yahoo, Outlook, Other: simple badges drawn here) ---------- */
const badge=(bg,inner)=>`<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="6" fill="${bg}"/>${inner}</svg>`;
const ICON={
 gmail:'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#EA4335" d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/></svg>',
 zoho:'<svg class="wide" viewBox="0 5.5 24 13" aria-hidden="true"><path fill="#E42527" d="M8.66 6.897a1.299 1.299 0 0 0-1.205.765l-.642 1.44-.062-.385A1.291 1.291 0 0 0 5.27 7.648l-4.185.678A1.291 1.291 0 0 0 .016 9.807l.678 4.18a1.293 1.293 0 0 0 1.27 1.087c.074 0 .143-.01.216-.017l4.18-.678c.436-.07.784-.351.96-.723l2.933 1.307a1.304 1.304 0 0 0 .988.026c.321-.12.575-.365.716-.678l.28-.629.038.276a1.297 1.297 0 0 0 1.455 1.103l3.712-.501a1.29 1.29 0 0 0 1.03.514h4.236c.713 0 1.29-.58 1.291-1.291V9.545c0-.712-.58-1.291-1.291-1.291h-4.236c-.079 0-.155.008-.23.022a1.309 1.309 0 0 0-.275-.288c-.275-.21-.614-.3-.958-.253l-4.197.571c-.155.021-.3.07-.432.14L9.159 7.01a1.27 1.27 0 0 0-.499-.113zm-.025.705c.077 0 .159.013.24.052l2.971 1.324c-.128.238-.18.508-.142.782l.357 2.596h.002l-.745 1.672a.59.59 0 0 1-.777.296l-3.107-1.385-.004-.041-.41-2.526L8.1 7.95a.589.589 0 0 1 .536-.348zm-3.159.733c.125 0 .245.039.343.112.13.09.21.227.237.382l.234 1.446-.56 1.259a1.27 1.27 0 0 0-.026.987c.12.322.364.575.678.717l.295.131a.585.585 0 0 1-.428.314l-4.185.678a.59.59 0 0 1-.674-.485l-.678-4.18a.588.588 0 0 1 .485-.674l4.185-.678c.03-.004.064-.01.094-.01zm11.705.09a.59.59 0 0 1 .415.173 1.287 1.287 0 0 0-.416.947v4.237c0 .033.003.065.005.097l-3.55.482a.586.586 0 0 1-.66-.502l-.191-1.403.899-2.017a1.29 1.29 0 0 0-.333-1.5l3.754-.51c.026-.004.051-.004.077-.004zm1.3.532h4.227c.326 0 .588.266.588.588v4.237a.589.589 0 0 1-.588.588h-4.237a.564.564 0 0 1-.12-.013c.47-.246.758-.765.684-1.318zm-5.988.309.254.113c.296.133.43.48.296.777l-.432.97-.207-1.465a.58.58 0 0 1 .09-.395zm5.39.538.453 3.325a.583.583 0 0 1-.453.65zM6.496 11.545l.17 1.052a.588.588 0 0 1-.293-.776zm3.985 4.344a.588.588 0 0 0-.612.603c0 .358.244.61.601.61a.582.582 0 0 0 .607-.608c0-.35-.242-.605-.596-.605zm5.545 0a.588.588 0 0 0-.612.603c0 .358.245.61.602.61a.582.582 0 0 0 .606-.608c0-.35-.24-.605-.596-.605zm-8.537.018a.047.047 0 0 0-.048.047v.085c0 .026.021.047.048.047h.52l-.623.9a.052.052 0 0 0-.009.027v.027c0 .026.021.047.048.047h.815a.047.047 0 0 0 .047-.047v-.085a.047.047 0 0 0-.047-.047h-.55l.606-.9a.05.05 0 0 0 .008-.026v-.028a.047.047 0 0 0-.047-.047zm5.303 0a.047.047 0 0 0-.047.047v1.086c0 .026.02.047.047.047h.135a.047.047 0 0 0 .047-.047v-.454h.545v.454c0 .026.02.047.047.047h.134a.047.047 0 0 0 .047-.047v-1.086a.047.047 0 0 0-.047-.047h-.134a.047.047 0 0 0-.047.047v.453h-.545v-.453a.047.047 0 0 0-.047-.047zm-2.324.164c.25 0 .372.194.372.425 0 .219-.109.425-.358.426-.242 0-.375-.197-.375-.419 0-.235.108-.432.36-.432zm5.545 0c.25 0 .372.194.372.425 0 .219-.108.425-.358.426-.242 0-.374-.197-.374-.419 0-.235.108-.432.36-.432z"/></svg>',
 brevo:'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#0B996E" d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zM7.2 4.8h5.747c2.34 0 3.895 1.406 3.895 3.516 0 1.022-.348 1.862-1.09 2.588C17.189 11.812 18 13.22 18 14.785c0 2.86-2.64 5.016-6.164 5.016H7.199v-15zm2.085 1.952v5.537h.07c.233-.432.858-.796 2.249-1.226 2.039-.659 3.037-1.52 3.037-2.655 0-.998-.766-1.656-1.924-1.656H9.285zm4.87 5.266c-.766.385-1.67.748-2.76 1.11-1.229.387-2.11 1.386-2.11 2.407v2.315h2.365c2.387 0 4.149-1.34 4.149-3.155 0-1.067-.625-2.087-1.645-2.677z"/></svg>',
 yahoo:badge('#6001D2','<path d="M5.5 7l4 6.2V18M13.5 7l-4 6.2" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M17.5 6.5v5.5" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><circle cx="17.5" cy="15.8" r="1.3" fill="#fff"/>'),
 outlook:badge('#0078D4','<circle cx="12" cy="12" r="4.6" fill="none" stroke="#fff" stroke-width="2.4"/>'),
 custom:badge('#626a86','<rect x="5" y="6" width="14" height="5" rx="1.5" fill="none" stroke="#fff" stroke-width="1.6"/><rect x="5" y="13" width="14" height="5" rx="1.5" fill="none" stroke="#fff" stroke-width="1.6"/><circle cx="8" cy="8.5" r=".9" fill="#fff"/><circle cx="8" cy="15.5" r=".9" fill="#fff"/>'),
 app:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3.5 7.5l8.5 6 8.5-6"/></svg>',
 auto:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 3L10.5 13.5"/><path d="M21 3l-6.5 18-4-7.5L3 9.5z"/></svg>'
};
ICON.zohog=ICON.zoho;

// s = name on the tile. simple = the login is just the email address and the password, so nothing else is shown unless "Server settings" is opened.
const PROV={
 gmail:{s:'Gmail',n:'Gmail or Google Workspace',host:'smtp.gmail.com',port:465,simple:1,ph:'name@gmail.com',ul:'Your Gmail address',pl:'App password (16 letters)',
  hint:'Gmail needs a special app password, not your normal password.',
  steps:['Open your Google account and go to Security.','Make sure 2-Step Verification is on.','Open App passwords, type Campus Events as the name and tap Create.','Copy the 16-letter password and paste it below.','If App passwords is missing, your college may have switched it off. Use Brevo instead.'],
  link:['Open Google App passwords','https://myaccount.google.com/apppasswords']},
 outlook:{s:'Outlook',n:'Outlook or Microsoft 365',host:'smtp.office365.com',port:587,simple:1,ph:'name@outlook.com',ul:'Your Outlook address',pl:'Password or app password',
  hint:'Microsoft is switching off password sign-in for SMTP at the end of December 2026, so this may stop working. Gmail, Zoho or Brevo are safer choices.'},
 yahoo:{s:'Yahoo Mail',n:'Yahoo Mail',host:'smtp.mail.yahoo.com',port:465,simple:1,ph:'name@yahoo.com',ul:'Your Yahoo address',pl:'App password',
  hint:'Yahoo needs an app password, not your normal password.',
  steps:['Sign in to Yahoo Mail, tap your picture and open Account info.','Open Account security.','Choose Generate app password, name it Campus Events and tap Generate.','Copy the password and paste it below.']},
 zoho:{s:'Zoho Mail (India)',n:'Zoho Mail (India)',host:'smtp.zoho.in',port:465,simple:1,ph:'name@yourdomain.in',ul:'Your Zoho address',pl:'App password',
  hint:'For accounts in India. Use Zoho Mail (World) if your account is on zoho.com.',
  steps:['Sign in to Zoho Accounts (accounts.zoho.in) and open Security.','Open App Passwords and generate a new one named Campus Events.','Copy it and paste it below.']},
 zohog:{s:'Zoho Mail (World)',n:'Zoho Mail (global)',host:'smtp.zoho.com',port:465,simple:1,ph:'name@yourdomain.com',ul:'Your Zoho address',pl:'App password',
  hint:'For accounts outside India (zoho.com).',
  steps:['Sign in to Zoho Accounts (accounts.zoho.com) and open Security.','Open App Passwords and generate a new one named Campus Events.','Copy it and paste it below.']},
 brevo:{s:'Brevo',n:'Brevo (free, 300 emails a day)',host:'smtp-relay.brevo.com',port:587,ph:'abc123@smtp-brevo.com',ul:'SMTP login from Brevo',pl:'SMTP key',fl:'Sender email (the one you verified in Brevo)',
  hint:'Free for 300 emails a day. The login is the SMTP login Brevo shows you (it can look like abc123@smtp-brevo.com).',
  steps:['Sign up at brevo.com and verify your sender email address under Senders.','Open SMTP and API and create an SMTP key.','Paste the SMTP login and the SMTP key below.','Type your verified sender address in Sender email.'],
  link:['Open Brevo SMTP page','https://app.brevo.com/settings/keys/smtp']},
 custom:{s:'Other',n:'Another mail server',host:'',port:587,ph:'name@college.edu',ul:'Username',pl:'Password',
  hint:'Ask your mail administrator for the SMTP server, port (465 or 587), username and password.'}
};

let M={eid:null,step:1,tab:'pending',scope:'pending',mode:'',tpl:null,smtp:null,run:null,more:{},msg:'',pvt:0,guide:false,adv:false};
const tkOn=()=>!M.tpl||M.tpl.ticket!==false;

/* ---------- styles ---------- */
const css=document.createElement('style');
css.textContent=`#ml{position:fixed;inset:0;z-index:58;display:grid;place-items:center;background:rgba(16,23,43,.7);backdrop-filter:blur(4px);padding:14px}
#ml .box{position:relative;display:flex;flex-direction:column;background:var(--card);color:var(--ink);border-radius:18px;width:min(640px,100%);max-height:calc(100vh - 28px);max-height:calc(100dvh - 28px);box-shadow:0 24px 70px rgba(0,0,0,.5);outline:0;overflow:hidden}
#ml .mlhd{padding:16px 18px 0}
#ml .mlst{display:flex;gap:6px;padding:10px 18px 0}
#ml .mlst button{flex:1;display:flex;align-items:center;gap:8px;border:0;border-bottom:2px solid var(--line);background:none;padding:8px 4px;color:var(--mute);font:600 14px var(--txt);cursor:pointer;text-align:left}
#ml .mlst button.on{color:var(--ink);border-bottom-color:var(--acc)}
#ml .mlst button.done{color:var(--ink);border-bottom-color:var(--ok)}
#ml .mlst b{display:grid;place-items:center;flex:none;width:24px;height:24px;border-radius:50%;background:var(--line);color:var(--ink);font-size:12px}
#ml .mlst button.on b{background:var(--acc);color:#fff}
#ml .mlst button.done b{background:var(--ok);color:#10172b}
#ml .mlmn{flex:1;min-height:0;overflow:auto;padding:16px 18px;-webkit-overflow-scrolling:touch}
#ml .mlft{display:flex;gap:10px;justify-content:space-between;align-items:center;padding:12px 18px;border-top:1px solid var(--line)}
#ml .mlft .btn{flex:0 1 auto}
#ml button:focus-visible,#ml summary:focus-visible{outline:2px solid var(--acc);outline-offset:2px}
#ml h4{margin:0 0 4px;font:650 16px var(--txt)}
#ml .mlsum{display:flex;align-items:baseline;gap:8px;margin:12px 0 10px;font-size:15px}
#ml .mlsum b{font:700 22px var(--disp);letter-spacing:-.02em}
#ml .mltick{display:flex;gap:12px;align-items:flex-start;padding:14px;margin:0 0 14px;border:1.5px solid var(--line);border-radius:14px;cursor:pointer;font-weight:400;color:var(--ink)}
#ml .mltick:has(input:checked){border-color:var(--acc);background:var(--tint)}
#ml .mltick input{flex:none;width:22px;height:22px;padding:0;margin:1px 0 0;accent-color:var(--acc)}
#ml .mltx{display:block;min-width:0}#ml .mltx b{display:block;font-size:15px}#ml .mltx em{display:block;font-style:normal;font-size:13.5px;color:var(--mute);line-height:1.4;margin-top:2px}
#ml .mlagain{display:flex;gap:8px;align-items:center;font-weight:500;margin:0;color:var(--ink)}#ml .mlagain input{width:18px;height:18px;padding:0;margin:0;accent-color:var(--acc)}
#ml .mlbig{display:flex;gap:12px;align-items:center;text-align:left;width:100%;padding:14px;margin:0 0 8px;border:1.5px solid var(--line);border-radius:14px;background:var(--card);color:var(--ink);font:inherit;cursor:pointer}
#ml .mlbig:hover{border-color:color-mix(in srgb,var(--ink) 28%,var(--line))}
#ml .mlbig.on{border-color:var(--acc);background:var(--tint)}
#ml .mlbig svg{flex:none;width:34px;height:34px;color:var(--acc)}
#ml .mlpg{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:8px;margin:0 0 12px}
#ml .mlpt{display:flex;flex-direction:column;align-items:center;gap:8px;padding:12px 6px 10px;border:1.5px solid var(--line);border-radius:14px;background:var(--card);color:var(--ink);font:600 13px/1.25 var(--txt);cursor:pointer;text-align:center}
#ml .mlpt:hover{border-color:color-mix(in srgb,var(--ink) 28%,var(--line))}
#ml .mlpt.on{border-color:var(--acc);background:var(--tint)}
#ml .mlic{display:grid;place-items:center;width:48px;height:40px;border-radius:10px;background:#fff;border:1px solid var(--line)}
#ml .mlpt svg{width:28px;height:28px}#ml .mlpt svg.wide{width:40px}
#ml .mlpw{display:flex;gap:8px;align-items:center}#ml .mlpw input{flex:1;min-width:0}
#ml .mlgd{margin:10px 0 0;padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:var(--bg);font-size:14px}
#ml .mlgd ol{margin:0 0 10px;padding-left:20px}#ml .mlgd li{margin:3px 0}
#ml .btn{text-decoration:none;display:inline-flex;align-items:center;justify-content:center}
#ml textarea{min-height:150px;resize:vertical;line-height:1.45}
#ml .pv{background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:10px 12px;font-size:14px}
#ml .tkt{display:flex;gap:12px;align-items:center;margin-top:6px}#ml .tkt .th{flex:0 0 84px;aspect-ratio:1/2;border-radius:10px;background:var(--bg);border:1px solid var(--line);overflow:hidden;display:grid;place-items:center;font-size:11px;color:var(--mute)}#ml .tkt .th img{display:block;width:100%;height:auto}#ml .tkt .seg{margin:0 0 6px}
#ml iframe{width:100%;height:420px;border:1px solid var(--line);border-radius:12px;background:#f6f7fb;margin-top:6px}
#ml .chip{font-size:13px}
#ml .mi{display:flex;gap:8px;align-items:center;padding:6px 0;border-top:1px solid var(--line)}#ml .mi span{flex:1 1 40%;min-width:0;overflow-wrap:anywhere;font-size:14px}#ml .mi input{flex:1 1 55%;min-width:0}
#ml .bad{color:var(--bad)}#ml .errs{max-height:150px;overflow:auto;font-size:13px;margin-top:8px}
#ml .mlbar{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin:0 0 6px}
@media(max-width:520px){#ml{padding:0;place-items:end center}#ml .box{border-radius:18px 18px 0 0;max-height:96vh;max-height:96dvh}#ml .mlst button{font-size:13px;gap:6px}}
#hg{z-index:70!important}`;
document.head.append(css);

/* ---------- data ---------- */
const emailOf=(e,r)=>{
 const c=[r.em];(e.fields||[]).forEach(f=>{if(f.type!=='checkbox'&&/e-?mail/i.test(f.label||''))c.push(r.data&&r.data[f.id])});
 for(const v of c){const s=String(v||'').trim();if(EMAIL.test(s))return s}
 return '';
};
function lists(e){
 const rs=regsOf(e.id).slice().sort((a,b)=>(a.at||0)-(b.at||0)),withMail=[],noMail=[];
 rs.forEach(r=>{const em=emailOf(e,r);(em?withMail:noMail).push({r,em})});
 return{withMail,noMail,pending:withMail.filter(x=>!x.r.ml),done:withMail.filter(x=>x.r.ml)};
}
// sync.js apply() swaps in fresh attendee objects every time Firestore echoes a save back, so a saved reference goes stale.
// Always find the attendee by id at the moment of marking, and keep a list so late echoes can be corrected (see sendAll).
// force = true on a real send, so a person emailed a second time gets the new time and kind. The late-echo fix never forces.
const markOne=(eid,id,how,t,kind,force)=>{const r=S.regs.find(q=>q.eid===eid&&q.id===id);if(!r||(r.ml&&!force))return false;r.ml=t;r.mlv=how;r.mlk=kind;return true};
const kindNow=()=>tkOn()?'t':'i';
const pool=e=>{const L=lists(e);return M.scope==='all'?L.withMail:L.pending};
const ticketLink=(e,r)=>window.ticketLinkOf?ticketLinkOf(e,r):'';
const can_=e=>!!(e&&window.can&&can(e,'regs'));
const dayOf=t=>{const d=new Date(t);return isNaN(d)?'':d.toLocaleDateString([],{day:'numeric',month:'short'})};

function vals(e,x){
 const r=x.r,nm=String(r.name||'Guest').trim()||'Guest',when=new Date(e.date+'T'+(e.time||'00:00')),ok=!isNaN(when);
 return{name:nm,first_name:nm.split(/\s+/)[0]||nm,event:e.name||'',
  date:ok?when.toLocaleDateString([],{weekday:'long',day:'numeric',month:'long',year:'numeric'}):(e.date||''),
  time:ok&&e.time?when.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'',venue:e.venue||'',
  ticket_link:tkOn()?ticketLink(e,r):'',ticket_id:r.id||'',college_id:r.cid||(window.regCid?regCid(e,r):'')||'',email:x.em||'',organizer:M.tpl.fromName||''};
}
const tidy=t=>t.replace(/[ \t]+$/gm,'').replace(/^[A-Za-z ]{2,20}:[ \t]*\n/gm,'').replace(/\n{3,}/g,'\n\n').trim();   // drops "Where:" when the venue is empty
const mergeText=(tpl,v)=>String(tpl||'').replace(/\{(\w+)\}/g,(m,k)=>k==='qr'?(v.ticket_link||''):(k in v?v[k]:m));
const qrBlock=(v)=>`<div data-qr="1" style="text-align:center;margin:18px 0 8px"><img src="cid:${CID}" width="340" alt="Ticket for ${esc(v.name)}" style="display:inline-block;width:100%;max-width:340px;height:auto;border:0"></div>`+
 (v.ticket_link?`<div style="text-align:center;margin:0 0 10px"><a href="${esc(v.ticket_link)}" style="background:#5948f5;color:#ffffff;text-decoration:none;font-weight:700;padding:11px 20px;border-radius:9px;display:inline-block">Open my ticket</a></div>`:'');
function mergeHtml(tpl,v,sz){
 const tk=tkOn();
 const inner=String(tpl||'').split(/(\{\w+\})/).map(p=>{
  const m=/^\{(\w+)\}$/.exec(p);
  if(!m)return esc(p).replace(/\r?\n/g,'<br>');
  const k=m[1];
  if(k==='qr')return tk?qrBlock(v):'';
  if(k==='ticket_link')return v.ticket_link?`<a href="${esc(v.ticket_link)}" style="color:#5948f5">${esc(v.ticket_link)}</a>`:'';
  return k in v?esc(v[k]):esc(p);
 }).join('').replace(/(<br>\s*)+(<div data-qr)/g,'$2').replace(/(<\/div>)(\s*<br>)+/g,'$1');
 return `<!doctype html><html><body style="margin:0;padding:16px;background:#f6f7fb"><div style="max-width:480px;margin:0 auto;background:#ffffff;color:#10172b;font:15px/1.55 Arial,Helvetica,sans-serif;border:1px solid #e1e4ef;border-radius:14px;padding:22px">${inner}</div></body></html>`;
}
// QR as a PNG (base64) drawn from the same library the ticket page uses. Same payload as scan.js.
function qrPng(text){
 try{
  const q=qrcode(0,'M');q.addData(text);q.make();
  const n=q.getModuleCount(),px=Math.max(4,Math.floor(264/(n+8))),m=4*px,s=n*px+2*m,c=document.createElement('canvas');
  c.width=c.height=s;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,s,s);g.fillStyle='#000';
  for(let i=0;i<n;i++)for(let j=0;j<n;j++)if(q.isDark(i,j))g.fillRect(m+j*px,m+i*px,px,px);
  return{b64:c.toDataURL('image/png').split(',')[1],size:s};
 }catch(x){return{b64:'',size:240}}
}
// 3.11.0: the designed ticket as PNG (base64). Same picture as the Ticket window and the ticket page. Kept for the preview only.
const TC=new Map();
async function ticketPng(e,r,keep){
 const o=window.ticketOptsOf?ticketOptsOf(e,r):null;if(!o||!window.cemTicket)throw new Error('no ticket art');
 const k=JSON.stringify(o);if(keep&&TC.has(k))return TC.get(k);
 const t=await cemTicket.b64(o);if(keep){if(TC.size>=4)TC.delete(TC.keys().next().value);TC.set(k,t)}return t;
}
function mailto(e,x){
 const v=vals(e,x),s=mergeText(M.tpl.subject,v).replace(/\s+/g,' ').trim(),b=tidy(mergeText(M.tpl.body,v));
 return 'mailto:'+encodeURIComponent(x.em).replace(/%40/g,'@')+'?subject='+encodeURIComponent(s)+'&body='+encodeURIComponent(b);
}
function openMail(url){const a=document.createElement('a');a.href=url;a.rel='noopener';a.style.display='none';document.body.append(a);a.click();a.remove()}
const sample=e=>{const f=lists(e).withMail[0]||lists(e).noMail[0];return f?{r:f.r,em:f.em||'name@example.com'}:{r:{id:'sampleticket1',name:'Asha Rao'},em:'asha@example.com'}};

/* ---------- storage (this device only) ---------- */
function load(e){
 const t=LS.get(TPL_KEY(e.id),{}),tk=t.ticket!==false,d=defs(tk);
 M.tpl={ticket:tk,subject:t.subject||d.s,body:t.body||d.b,fromName:t.fromName!=null?t.fromName:(e.name||'Event')+' team'};
 const s=LS.get(SMTP_KEY,null);
 M.smtp=Object.assign({prov:'gmail',host:PROV.gmail.host,port:PROV.gmail.port,user:'',pass:'',from:'',remember:true},s||{});
 if(!PROV[M.smtp.prov])M.smtp.prov='custom';
 const md=LS.get(MODE_KEY,'');M.mode=md==='app'||md==='smtp'?md:'';
}
const saveTpl=()=>LS.set(TPL_KEY(M.eid),M.tpl);

/* ---------- the window ---------- */
function open(eid){
 const e=S.events.find(x=>x.id===eid);if(!can_(e))return toast('You need the Attendees and check-in permission for this.');
 M.eid=eid;M.step=1;M.tab='pending';M.scope='pending';M.run=null;M.more={};M.msg='';M.guide=false;M.adv=false;load(e);
 let m=$('ml');if(!m){m=document.createElement('div');m.id='ml';document.body.append(m)}
 m.innerHTML=`<div class="box" role="dialog" aria-modal="true" aria-label="Email attendees" tabindex="-1">
  <div class="mlhd"><div class="sh" style="margin-bottom:0"><h3>Email attendees</h3><button type="button" class="btn ghost sm" data-mlx="1">Close</button></div><p class="meta" style="margin:2px 0 0">${esc(e.name)}</p></div>
  <div class="mlst" id="mlsteps" role="group" aria-label="Steps"></div>
  <div class="mlmn" id="mlmain"></div>
  <div class="mlft" id="mlnav"></div></div>`;
 drawAll();m.querySelector('.box').focus();
}
function close(){
 if(M.run&&M.run.active){if(!confirm('Sending is still running. Stop and close?'))return;M.run.stop=true}
 const m=$('ml');if(m)m.remove();M.eid=null;
}
const cur_=()=>S.events.find(x=>x.id===M.eid);
function drawAll(){if(!cur_())return;drawSteps();drawStep();drawNav()}
function go(n){
 if(n<1||n>3||n===M.step)return;
 if(M.run&&M.run.active)return toast('Sending is still running. Press Stop first.');
 if(M.step===3)readSmtp();   // keep what was typed
 M.step=n;drawAll();const m=$('mlmain');if(m)m.scrollTop=0;
}
function drawSteps(){
 const b=$('mlsteps');if(!b)return;
 b.innerHTML=['People','Message','Send'].map((nm,i)=>{const k=i+1,c=k===M.step?'on':k<M.step?'done':'';
  return `<button type="button" data-mlstep="${k}" class="${c}" ${k===M.step?'aria-current="step"':''}><b aria-hidden="true">${k<M.step?'&#10003;':k}</b>${nm}</button>`}).join('');
}
function drawNav(){
 const b=$('mlnav');if(!b)return;const n=M.step;
 b.innerHTML=(n>1?`<button type="button" class="btn ghost" data-mlgo="${n-1}">Back</button>`:'<span></span>')+
  (n<3?`<button type="button" class="btn" data-mlgo="${n+1}">${n===1?'Next: write your message':'Next: choose how to send'}</button>`:'<span></span>');
}
function drawStep(){
 const e=cur_(),m=$('mlmain');if(!e||!m)return;
 if(M.step===1){m.innerHTML='<div id="mls"></div>';drawPeople()}
 else if(M.step===2){m.innerHTML='<div id="mled"></div><div id="mlpv"></div>';drawEditor();drawPreview()}
 else{m.innerHTML='<div id="mlm"></div>';drawMethod()}
}
// after attendee marks change: update whatever is on screen
function refresh(){drawSteps();if(M.step===1)drawPeople();else if(M.step===3)drawMethod()}

/* ---------- step 1: people ---------- */
function pRow(x,extra){return `<div class="li"><div class="main"><div class="ttl">${esc(x.r.name)}</div><div class="sub">${esc(x.em)}</div></div>${extra?`<div class="act">${extra}</div>`:''}</div>`}
function drawPeople(){
 const e=cur_(),box=$('mls');if(!e||!box)return;
 const L=lists(e),n=pool(e).length,t=M.tab,CAP=30,all=!!M.more[t];
 const seg=[['pending','Not emailed',L.pending.length],['done','Emailed',L.done.length],['noem','No email',L.noMail.length]];
 const cut=a=>all?a:a.slice(0,CAP),more=a=>!all&&a.length>CAP?`<button type="button" class="btn ghost sm" data-mlmore="${t}" style="margin-top:10px">Show all ${a.length}</button>`:'';
 let body='';
 if(t==='pending'){
  body=(L.pending.length?`<div class="mlbar"><p class="meta" style="margin:0;flex:1 1 200px">These people have not been emailed yet.</p><button type="button" class="btn ghost sm" data-mlmarkall="1">Mark all as emailed</button></div>
   ${cut(L.pending).map(x=>pRow(x)).join('')}${more(L.pending)}`
   :`<div class="empty" style="padding:28px 16px">${L.withMail.length?'Everyone with an email address has been emailed.':'No attendee has an email address yet. Open the No email tab to add some.'}</div>`);
 }else if(t==='done'){
  body=(L.done.length?`<div class="mlbar"><label class="mlagain"><input type="checkbox" data-mlagain="1" ${M.scope==='all'?'checked':''}><span>Email these ${L.done.length} again too</span></label><button type="button" class="btn ghost sm" data-mlclr="1">Clear emailed marks</button></div>
   ${cut(L.done).map(x=>pRow(x,`<span class="pill ok" title="${esc(x.r.mlv==='smtp'?'Sent automatically':'Opened in the mail app')}">${x.r.mlk==='i'?'Invitation':'Ticket'} emailed ${esc(dayOf(x.r.ml))}</span>`)).join('')}${more(L.done)}`
   :'<div class="empty" style="padding:28px 16px">Nobody has been emailed yet.</div>');
 }else{
  body=(L.noMail.length?`<p class="meta" style="margin:0 0 6px">Type an email address to include them. It is saved on the attendee.</p>
   ${cut(L.noMail).map(x=>`<div class="mi"><span>${esc(x.r.name)}</span><input type="email" inputmode="email" placeholder="name@example.com" data-mlem="${esc(x.r.id)}" aria-label="Email for ${esc(x.r.name)}"></div>`).join('')}${more(L.noMail)}
   <p class="meta" style="margin:8px 0 0">Imported spreadsheets can include an Email column.</p>`
   :'<div class="empty" style="padding:28px 16px">Everyone has an email address.</div>');
 }
 box.innerHTML=`<h4>Who gets the email?</h4><p class="meta" style="margin:0">Look through the tabs to see who has and has not been emailed.</p>
  <div class="mlsum"><b>${n}</b><span>${n===1?'person gets':'people get'} the next email${M.scope==='all'?', including people emailed before':''}</span></div>
  <div class="seg" role="group" aria-label="Attendee lists">${seg.map(s=>`<button type="button" data-mltab="${s[0]}" class="${t===s[0]?'on':''}" aria-pressed="${t===s[0]}">${s[1]} <em>${s[2]}</em></button>`).join('')}</div>${body}`;
}

/* ---------- step 2: message ---------- */
function drawEditor(){
 const b=$('mled');if(!b)return;const tk=tkOn(),base=window.siteBase?siteBase():'',tags=TAGS.filter(t=>tk||!TICKET_TAGS.includes(t[0]));
 b.innerHTML=`<h4>Write your message</h4>
  <label class="mltick"><input type="checkbox" id="mltk" ${tk?'checked':''}><span class="mltx"><b>Send a ticket with a QR code</b><em>${tk?'Each person gets their own ticket to show at the entrance. Untick this for an event that needs no ticket.':'Off: attendees get a simple invitation. No ticket and no QR code are sent.'}</em></span></label>
  ${tk&&!base?'<div class="note" style="margin-bottom:12px"><b>Set your public site address first.</b> Ticket links need it: Income &gt; Link settings, or Attendees &gt; Registration.</div>':''}
  <div class="card" style="margin:0 0 12px"><label for="mlsub" style="margin-top:0">Subject</label><input id="mlsub" maxlength="150" value="${esc(M.tpl.subject)}">
  <label for="mlbody">Message</label><textarea id="mlbody">${esc(M.tpl.body)}</textarea>
  <p class="meta" style="margin:8px 0 6px">Tap a button to add a detail where your cursor is. Every person gets their own.</p>
  <div class="chips" style="margin:0" aria-label="Add a detail">${tags.map(t=>`<button type="button" class="chip" data-mltag="${t[0]}" title="${esc(t[2]||t[1])}">${esc(t[1])}</button>`).join('')}</div>
  ${tk?`<label style="margin-bottom:0">Ticket picture</label>
  <div class="tkt"><div class="th" id="mlth">...</div><div style="flex:1;min-width:0"><div class="seg" id="mlst2" role="group" aria-label="Ticket style"></div><p class="meta" style="margin:0">Each attendee gets their own picture with their name and QR code. Automatic emails attach it so they can save it for offline use.</p></div></div>`:''}
  <label for="mlfn">Your name or team (shown as the sender)</label><input id="mlfn" maxlength="60" value="${esc(M.tpl.fromName)}">
  <p class="meta" id="mlwarn" style="margin:8px 0 0"></p>
  <div class="row" style="margin-top:10px"><button type="button" class="btn ghost sm" data-mlrst="1">Reset message</button><button type="button" class="btn ghost sm" data-mlhelp="1">Help</button></div></div>`;
 if(tk)drawStyle();
}
function drawWarn(){
 const w=$('mlwarn');if(!w)return;const tk=tkOn(),b=M.tpl.body,all=b+' '+M.tpl.subject,u=[...new Set(all.match(/\{\w+\}/g)||[])].filter(t=>!KNOWN.includes(t.slice(1,-1)));
 w.className='meta bad';
 w.textContent=tk&&!/\{(qr|ticket_link)\}/.test(b)?'Your message has no ticket in it, so attendees would not get one. Tap Ticket QR to add it, or untick the ticket box above.':
  !tk&&/\{(qr|ticket_link)\}/.test(all)?'Tickets are switched off, so the ticket parts of your message are left out. Tap Reset message to use the standard invitation.':
  u.length?'Unknown detail: '+u.join(' ')+'. Use the buttons above.':'';
}
function drawStyle(){
 const e=cur_(),b=$('mlst2');if(!e||!b||!window.cemTicket)return;
 const st=cemTicket.styleOf(e.id);
 b.innerHTML=Object.keys(cemTicket.STYLES).map(k=>`<button type="button" data-mlstyle="${k}" class="${k===st?'on':''}" aria-pressed="${k===st}">${cemTicket.STYLES[k]}</button>`).join('');
 const th=$('mlth'),x=sample(e);if(!th)return;
 th.textContent='...';
 ticketPng(e,x.r,true).then(t=>{const n=$('mlth');if(n&&cur_()&&cemTicket.styleOf(e.id)===st)n.innerHTML='<img alt="Ticket preview" src="data:image/png;base64,'+t.b64+'">'}).catch(()=>{const n=$('mlth');if(n)n.textContent='n/a'});
}
function drawPreview(){
 const e=cur_(),box=$('mlpv');if(!e||!box)return;drawWarn();
 const x=sample(e),v=vals(e,x),sub=mergeText(M.tpl.subject,v),tok=++M.pvt,tk=tkOn();
 box.innerHTML=`<div class="card" style="margin:0"><p class="meta" style="margin:0 0 6px">Preview for ${esc(x.r.name)}</p><div class="pv"><b>${esc(sub)}</b></div><iframe id="mlpvf" sandbox="" title="Preview of the email"></iframe>
  ${tk?'<p class="meta" style="margin:8px 0 0">With your email account the ticket picture is inside the email. With your device mail app it is a link that opens the ticket picture.</p>':''}</div>`;
 const put=b64=>{const f=$('mlpvf');if(f&&tok===M.pvt)f.srcdoc=mergeHtml(M.tpl.body,v).split('cid:'+CID).join('data:image/png;base64,'+b64)};
 if(!tk)return put('');
 const f0=$('mlpvf');if(f0)f0.srcdoc='<p style="font:14px Arial;padding:14px;color:#5b6380">Drawing the ticket...</p>';
 ticketPng(e,x.r,true).then(t=>put(t.b64)).catch(()=>put(qrPng('CEM1:'+e.id+':'+x.r.id).b64));
}

/* ---------- step 3: send ---------- */
function drawMethod(){
 const e=cur_(),box=$('mlm');if(!e||!box)return;
 const n=pool(e).length,tk=tkOn();
 box.innerHTML=`<h4>How do you want to send?</h4>
  <p class="meta" style="margin:0 0 12px"><b>${n}</b> ${n===1?'person gets':'people get'} ${tk?'a ticket':'a simple invitation'}. Pick one way to send.</p>
  <div role="group" aria-label="How to send">
   <button type="button" class="mlbig ${M.mode==='app'?'on':''}" data-mlm="app" aria-pressed="${M.mode==='app'}">${ICON.app}<span class="mltx"><b>This device&rsquo;s mail app</b><em>Nothing to set up. Your mail app opens for each person and you tap Send.</em></span></button>
   <button type="button" class="mlbig ${M.mode==='smtp'?'on':''}" data-mlm="smtp" aria-pressed="${M.mode==='smtp'}">${ICON.auto}<span class="mltx"><b>My email account (automatic)</b><em>Sign in once with Gmail, Outlook, Yahoo, Zoho or another provider. The app sends every email for you (SMTP).</em></span></button>
  </div>
  <div style="margin-top:14px">${M.mode==='smtp'?smtpPanel(e):M.mode==='app'?appPanel(e):''}</div>`;
 drawRun();
}
function appPanel(e){
 const L=pool(e),left=L.filter(x=>!x.r.ml).length,rows=(M.more.app?L:L.slice(0,12));
 return `<div class="card" style="margin:0"><p style="margin:0 0 10px">Your mail app opens with the name and message filled in${tkOn()?', plus the personal ticket link':''}. Tap <b>Send</b> there, press Back to return here, then open the next one.</p>
  <button type="button" class="btn" data-mlnext="1" style="width:100%" ${left?'':'disabled'}>${left?`Open next (${left} left)`:'All opened'}</button>
  ${tkOn()?'<p class="meta" style="margin:8px 0 0">The ticket link opens that person&rsquo;s own ticket picture, with a Save button. For the picture inside the email itself (also attached, ready to save), use My email account.</p>':''}
  ${rows.length?`<div style="margin-top:8px">${rows.map(x=>`<div class="li"><div class="main"><div class="ttl">${esc(x.r.name)}</div><div class="sub">${esc(x.em)}</div></div><div class="act">${x.r.ml?'<span class="pill ok">Opened</span> ':''}<button type="button" class="btn ${x.r.ml?'ghost ':''}sm" data-mlone="${esc(x.r.id)}">${x.r.ml?'Open again':'Open'}</button></div></div>`).join('')}${!M.more.app&&L.length>12?`<button type="button" class="btn ghost sm" data-mlmore="app" style="margin-top:8px">Show all ${L.length}</button>`:''}</div>`:'<p class="meta" style="margin:10px 0 0">Nobody to email. Go back to People to choose who gets it.</p>'}
  <div class="row" style="margin-top:12px"><button type="button" class="btn ghost sm" data-mlcsv="1">Download mail-merge file (CSV)</button></div></div>`;
}
const signed=()=>!!(window.firebase&&firebase.apps&&firebase.apps.length&&firebase.auth().currentUser);
function smtpPanel(e){
 const s=M.smtp,api=String(window.OTP_API||'').trim(),n=pool(e).length,p=PROV[s.prov]||PROV.custom;
 if(!api)return '<div class="note">Automatic sending is not set up yet. The app administrator must add the email service address (<code>OTP_API</code>) to <code>firebase-config.js</code> and update the Worker. Steps: Help &amp; guides &gt; Email attendees.</div>';
 if(!signed())return '<div class="note">Sign in to the app to send email automatically.</div>';
 const simple=!!p.simple,srv=s.prov==='custom'||M.adv,frm=!simple||M.adv;
 const tiles=Object.keys(PROV).map(k=>`<button type="button" class="mlpt ${k===s.prov?'on':''}" data-mlprov="${k}" aria-pressed="${k===s.prov}"><span class="mlic">${ICON[k]}</span><span>${PROV[k].s}</span></button>`).join('');
 const guide=M.guide&&(p.steps||p.link)?`<div class="mlgd"><ol>${(p.steps||[]).map(t=>`<li>${esc(t)}</li>`).join('')}</ol>${p.link?`<a class="btn ghost sm" target="_blank" rel="noopener noreferrer" href="${esc(p.link[1])}">${esc(p.link[0])}</a>`:''}</div>`:'';
 return `<h4>Choose your email provider</h4>
  <div class="mlpg" role="group" aria-label="Email provider">${tiles}</div>
  <div class="card" style="margin:0 0 12px"><p class="meta" style="margin:0 0 8px">The login stays on this device and is never shared with your team.</p>
  <p style="margin:0;font-size:14px">${esc(p.hint)}</p>
  ${p.steps?`<button type="button" class="btn ghost sm" data-mlguide="1" aria-expanded="${!!M.guide}" style="margin-top:8px">${M.guide?'Hide the steps':'How do I get this password?'}</button>`:''}${guide}
  <label for="mluser" style="margin-top:14px">${esc(p.ul)}</label><input id="mluser" type="email" inputmode="email" placeholder="${esc(p.ph||'')}" value="${esc(s.user)}" autocapitalize="off" autocomplete="off" spellcheck="false">
  <label for="mlpass">${esc(p.pl)}</label><div class="mlpw"><input id="mlpass" type="password" value="${esc(s.pass)}" autocomplete="off"><button type="button" class="btn ghost sm" data-mlshow="1">Show</button></div>
  ${frm?`<label for="mlfrom">${esc(p.fl||'Send from (leave empty to use the login above)')}</label><input id="mlfrom" type="email" inputmode="email" value="${esc(s.from)}" autocapitalize="off" autocomplete="off" spellcheck="false">`:''}
  ${srv?`<div class="two"><div><label for="mlhost">Server</label><input id="mlhost" value="${esc(s.host)}" autocapitalize="off" autocomplete="off" spellcheck="false"></div><div><label for="mlport">Port</label><select id="mlport"><option value="465" ${+s.port===465?'selected':''}>465 (SSL)</option><option value="587" ${+s.port===587?'selected':''}>587 (STARTTLS)</option></select></div></div>`:''}
  ${s.prov!=='custom'?`<div style="margin-top:10px"><button type="button" class="btn ghost sm" data-mladv="1" aria-expanded="${!!M.adv}">${M.adv?'Hide server settings':'Server settings'}</button></div>`:''}
  <label class="mlagain" style="margin-top:14px"><input type="checkbox" id="mlrem" ${s.remember?'checked':''}><span>Remember this login on this device</span></label>
  ${LS.get(SMTP_KEY,null)?'<div style="margin-top:8px"><button type="button" class="btn ghost sm" data-mlforget="1">Forget the saved login</button></div>':''}
  <div class="row" style="margin-top:14px"><button type="button" class="btn ghost sm" data-mltest="conn">Test connection</button><button type="button" class="btn ghost sm" data-mltest="mail">Send a test email to me</button></div>
  <p class="meta" id="mlst" role="status" aria-live="polite" style="margin:8px 0 0">${esc(M.msg)}</p></div>
  <div id="mlrun"></div>
  <button type="button" class="btn" data-mlsend="1" style="width:100%" ${n&&!(M.run&&M.run.active)?'':'disabled'}>Send to ${n} ${n===1?'person':'people'}</button>
  <p class="meta" style="margin:8px 0 0">${tkOn()?'Each email has that person&rsquo;s own ticket picture, shown in the email and attached. ':''}Gmail allows about 500 recipients a day (2,000 for Google Workspace).</p>`;
}
function drawRun(){
 const b=$('mlrun');if(!b)return;const r=M.run;
 if(!r||r.test){b.innerHTML='';return}
 const pc=r.total?Math.round(r.done/r.total*100):0;
 b.innerHTML=`<div class="card"><div class="sh" style="margin-bottom:6px"><h3 style="font-size:15px">${r.active?'Sending...':r.fatal?'Stopped':r.stop?'Stopped':'Finished'}</h3>${r.active?'<button type="button" class="btn ghost sm" data-mlstop="1">Stop</button>':''}</div>
  <div class="prog" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pc}"><i style="width:${pc}%"></i></div>
  <p class="meta" style="margin:8px 0 0" role="status" aria-live="polite">${r.ok} sent${r.fail?`, <b class="bad">${r.fail} failed</b>`:''} of ${r.total}.${r.fatal?` <b class="bad">${esc(r.fatal)}</b>`:''}${!r.active&&(r.fail||r.fatal||r.stop)?' Go to People and open Not emailed to see who is left, then send again to retry.':''}</p>
  ${r.note?`<p class="meta bad" style="margin:8px 0 0">${esc(r.note)}</p>`:''}
  ${r.errs.length?`<div class="errs">${r.errs.map(x=>`<div><b>${esc(x.name)}</b> (${esc(x.em)}): ${esc(x.why)}</div>`).join('')}</div>`:''}</div>`;
}

/* ---------- sending ---------- */
const token=force=>{const u=signed()&&firebase.auth().currentUser;if(!u)return Promise.reject(new Error('signin'));return u.getIdToken(!!force)};
async function api(path,body,again){
 const base=String(window.OTP_API||'').replace(/\/+$/,'');
 let tk;try{tk=await token(again)}catch(x){throw new Error('Please sign in again to send email.')}
 let r;try{r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tk},body:JSON.stringify(body)})}
 catch(x){throw new Error('Could not reach the email service. Check your internet connection.')}
 const j=await r.json().catch(()=>({ok:false,message:'The email service sent an unexpected answer.'}));
 if(r.status===401&&!j.stage&&!again)return api(path,body,true);
 if(r.status===404)return{ok:false,message:'The email service needs the newer Worker. Update it (SETUP.md, Upgrade to 3.11.0).'};
 if(r.status===403)return{ok:false,message:'This app is not allowed to use the email service. Add its address to ALLOWED_ORIGINS in the Worker.'};
 return j;
}
// Reads the form. A field that is hidden (for example Server settings) keeps the value it already has.
function readSmtp(){
 const s=M.smtp,g=(id,d)=>{const n=$(id);return n?n.value:d};
 s.host=g('mlhost',s.host).trim().toLowerCase();s.port=+g('mlport',s.port)||465;s.user=g('mluser',s.user).trim();s.pass=g('mlpass',s.pass);s.from=g('mlfrom',s.from).trim();
 s.remember=$('mlrem')?$('mlrem').checked:s.remember;
 return s;
}
function checkSmtp(s){
 const p=PROV[s.prov]||PROV.custom;
 if(!s.host)return 'Enter the mail server (open Server settings).';if(!s.user)return p.simple?'Enter your email address.':'Enter your login.';if(!s.pass)return 'Enter the password or app password.';
 if(!EMAIL.test(s.from||s.user))return p.simple?'Enter your full email address.':'Enter the email address to send from.';return '';
}
const keep=s=>{if(s.remember)LS.set(SMTP_KEY,{prov:s.prov,host:s.host,port:s.port,user:s.user,pass:s.pass,from:s.from,remember:true});else LS.del(SMTP_KEY)};
const say=t=>{M.msg=t;const n=$('mlst');if(n)n.textContent=t};
const creds=s=>({host:s.host,port:s.port,user:s.user,pass:s.pass});

const OLD_WORKER='Your email service is an older version, so these emails carry only the small QR picture. Update the Worker (SETUP.md, Upgrade to 3.11.0) to send the full ticket picture.';
async function build(e,x,s,test){
 const v=vals(e,x),tk=tkOn();let q={b64:''},png=null;
 if(tk){q=qrPng('CEM1:'+e.id+':'+x.r.id);try{png=await ticketPng(e,x.r,false)}catch(err){}}   // if the picture cannot be drawn the email still goes out with the small QR
 return{to:test?(s.from||s.user):x.em,name:test?'You (test)':x.r.name,subject:(test?'[Test] ':'')+mergeText(M.tpl.subject,v).replace(/\s+/g,' ').trim(),
  text:tidy(mergeText(M.tpl.body,v)),html:mergeHtml(M.tpl.body,v),qr:q.b64,ticket:png?png.b64:'',file:png?cemTicket.fileName(x.r.name):''};
}
async function testSmtp(kind){
 const e=cur_();if(!can_(e))return;const s=readSmtp(),bad=checkSmtp(s);if(bad)return say(bad);
 say(kind==='conn'?'Connecting...':'Sending a test email...');
 try{
  const j=kind==='conn'?await api('/mail/verify',{smtp:creds(s)}):await api('/mail/send',{smtp:creds(s),from:{email:s.from||s.user,name:M.tpl.fromName},messages:[await build(e,sample(e),s,true)]});
  if(!j.ok)return say(j.message||'It did not work.');
  keep(s);
  if(kind==='conn')say('Connected and logged in. You can send now.');
  else{const q=(j.results||[])[0];say(q&&q.ok?'Test email sent to '+(s.from||s.user)+'. Check your inbox (and spam).'+(tkOn()&&!j.ticketPng?' '+OLD_WORKER:''):'The test email failed: '+((q&&q.error)||'unknown error'))}
 }catch(x){say(x.message)}
}
async function sendAll(){
 const e=cur_();if(!can_(e))return toast('You no longer have permission to send.');
 const L=pool(e);if(!L.length)return;const s=readSmtp(),bad=checkSmtp(s);if(bad)return say(bad);
 const tk=tkOn(),kind=kindNow();
 if(!confirm('Send '+L.length+' email'+(L.length===1?'':'s')+' from '+(s.from||s.user)+'?\n\n'+(tk?'Each person gets their own ticket picture.':'This is a simple invitation. No ticket is sent.')))return;
 M.run={active:true,total:L.length,done:0,ok:0,fail:0,errs:[],fatal:'',stop:false,sentIds:[]};drawMethod();
 const r=M.run;
 for(let i=0;i<L.length&&!r.stop;i+=BATCH){
  if(!can_(cur_())){r.fatal='Your permission to send was removed.';break}
  const chunk=L.slice(i,i+BATCH);let j;
  try{j=await api('/mail/send',{smtp:creds(s),from:{email:s.from||s.user,name:M.tpl.fromName},messages:await Promise.all(chunk.map(x=>build(e,x,s,false)))})}
  catch(x){r.fatal=x.message||'Network problem.';break}
  if(!j.ok){r.fatal=j.message||'The email service refused the request.';break}
  if(i===0){keep(s);if(tk&&!j.ticketPng)r.note=OLD_WORKER}
  (j.results||[]).forEach((q,k)=>{const x=chunk[k];if(!x)return;r.done++;
   if(q.ok){r.ok++;const t=Date.now();r.sentIds.push([x.r.id,t]);markOne(e.id,x.r.id,'smtp',t,kind,true)}else{r.fail++;r.errs.push({name:x.r.name,em:x.em,why:q.error||'Not sent'})}});
  save();drawRun();drawSteps();if(M.step===1)drawPeople();
 }
 r.active=false;
 // A cloud echo can still arrive after the last batch and replace the attendee objects. Re-apply every mark that went missing, a few times.
 const fix=()=>{let c=0;r.sentIds.forEach(([id,t])=>{if(markOne(e.id,id,'smtp',t,kind))c++});if(c){save();if($('ml'))refresh();sv()}};
 fix();[2500,7000].forEach(ms=>setTimeout(fix,ms));
 if(!$('ml'))return;refresh();drawNav();sv();
}

/* ---------- mail-merge file ---------- */
function csv(){
 const e=cur_();if(!e||!window.cemSave||!window.cemCsv)return;const L=pool(e);if(!L.length)return toast('Nobody to export');
 const rows=L.map(x=>{const v=vals(e,x);return[v.name,v.first_name,x.em,v.ticket_link,x.r.id,v.college_id,mergeText(M.tpl.subject,v),tidy(mergeText(M.tpl.body,v))]});
 cemSave(slug(e.name)+'-mail-merge.csv','text/csv;charset=utf-8',cemCsv(['Name','First name','Email','Ticket link','Ticket ID','College ID','Subject','Message'],rows));
}

/* ---------- events ---------- */
document.addEventListener('click',x=>{
 const t=x.target.closest('button');if(!t)return;const D=t.dataset;
 if(D.mail!==undefined){const E=cur();if(E)open(E.id);return}
 if(!$('ml')||!$('ml').contains(t))return;
 const e=cur_();
 if(D.mlx!==undefined)close();
 else if(D.mlgo)go(+D.mlgo);
 else if(D.mlstep)go(+D.mlstep);
 else if(D.mltab){M.tab=D.mltab;drawPeople()}
 else if(D.mlmore){M.more[D.mlmore]=true;if(D.mlmore==='app')drawMethod();else drawPeople()}
 else if(D.mlm){if(M.run&&M.run.active)return;readSmtp();M.mode=D.mlm;LS.set(MODE_KEY,M.mode);drawMethod()}
 else if(D.mlprov){if(M.run&&M.run.active)return;readSmtp();const p=PROV[D.mlprov];if(!p)return;M.smtp.prov=D.mlprov;if(p.host)M.smtp.host=p.host;M.smtp.port=p.port;M.guide=false;drawMethod()}
 else if(D.mlguide!==undefined){readSmtp();M.guide=!M.guide;drawMethod()}
 else if(D.mladv!==undefined){readSmtp();M.adv=!M.adv;drawMethod()}
 else if(D.mlshow!==undefined){const p=$('mlpass');if(p){const h=p.type==='password';p.type=h?'text':'password';t.textContent=h?'Hide':'Show'}}
 else if(D.mlstyle){if(window.cemTicket){cemTicket.setStyle(M.eid,D.mlstyle);drawStyle();drawPreview()}}
 else if(D.mltag){const a=$('mlbody');if(!a)return;const p=a.selectionStart==null?a.value.length:a.selectionStart,q=a.selectionEnd==null?p:a.selectionEnd,ins='{'+D.mltag+'}';
  a.value=a.value.slice(0,p)+ins+a.value.slice(q);a.focus();a.selectionStart=a.selectionEnd=p+ins.length;M.tpl.body=a.value;saveTpl();drawPreview()}
 else if(D.mlrst!==undefined){if(!confirm('Put back the standard subject and message?'))return;const d=defs(tkOn());M.tpl.subject=d.s;M.tpl.body=d.b;saveTpl();drawEditor();drawPreview()}
 else if(D.mlhelp!==undefined){if(window.openHelp)openHelp('mail')}
 else if(D.mlclr!==undefined){if(!can_(e)||!confirm('Clear the "emailed" mark on everyone? They will count as not emailed yet.'))return;regsOf(e.id).forEach(r=>{delete r.ml;delete r.mlv;delete r.mlk});M.scope='pending';sv();refresh()}
 else if(D.mlmarkall!==undefined){if(!can_(e))return;const L=lists(e).pending;if(!L.length||!confirm('Mark '+L.length+' attendee'+(L.length===1?'':'s')+' as already emailed? Use this if you sent their email another way. Nobody is emailed now.'))return;const t0=Date.now();L.forEach(x=>markOne(e.id,x.r.id,'app',t0,kindNow()));sv();refresh()}
 else if(D.mlnext!==undefined||D.mlone){
  if(!can_(e))return;const L=pool(e),x1=D.mlone?L.find(z=>z.r.id===D.mlone):L.find(z=>!z.r.ml);if(!x1)return;
  openMail(mailto(e,x1));markOne(e.id,x1.r.id,'app',Date.now(),kindNow(),true);sv();refresh();
 }
 else if(D.mlcsv!==undefined)csv();
 else if(D.mltest)testSmtp(D.mltest);
 else if(D.mlsend!==undefined)sendAll();
 else if(D.mlstop!==undefined){if(M.run)M.run.stop=true;drawRun()}
 else if(D.mlforget!==undefined){LS.del(SMTP_KEY);M.smtp.pass='';M.smtp.user='';drawMethod();say('Saved login removed from this device.')}
});
document.addEventListener('input',x=>{
 const t=x.target;if(!t.id||!$('ml')||!$('ml').contains(t))return;
 if(t.id==='mlsub'){M.tpl.subject=t.value;saveTpl();later(drawPreview)}
 else if(t.id==='mlbody'){M.tpl.body=t.value;saveTpl();later(drawPreview)}
 else if(t.id==='mlfn'){M.tpl.fromName=t.value;saveTpl();later(drawPreview)}
});
document.addEventListener('change',x=>{
 const t=x.target;if(!$('ml')||!$('ml').contains(t))return;
 if(t.id==='mltk'){
  // Switching the tick swaps the standard texts, but never overwrites words the organiser wrote.
  const from=defs(tkOn()),to=defs(t.checked);
  if(M.tpl.subject===from.s)M.tpl.subject=to.s;if(M.tpl.body===from.b)M.tpl.body=to.b;
  M.tpl.ticket=t.checked;saveTpl();drawEditor();drawPreview();
 }
 else if(t.dataset&&t.dataset.mlagain!==undefined){M.scope=t.checked?'all':'pending';drawPeople()}
 else if(t.dataset&&t.dataset.mlem){
  const e=cur_(),v=t.value.trim();if(!can_(e))return;
  if(!EMAIL.test(v)){if(v)toast('That email address does not look right');return}
  const r=S.regs.find(q=>q.eid===e.id&&q.id===t.dataset.mlem);if(r){r.em=v.slice(0,100);sv();refresh()}
 }
});
document.addEventListener('keydown',x=>{const hg=$('hg');if(x.key==='Escape'&&$('ml')&&!(hg&&!hg.classList.contains('hid')))close()});
window.openMailer=open;
})();
