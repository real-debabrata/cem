/* CEM 3.6.1: Help & guides. Every explanation that used to sit inside the tabs lives here now, so the tabs stay clean.
   Open it from the profile icon (top right) > Help & guides, or from the button on an event's Details tab.
   - Sections fold open one by one; the search box filters them as you type.
   - "Roles and permissions" is built from app2.js (LBL, ROLEINFO, ROLEBASE, PERMCAT), so it also lists the custom roles of the event you have open.
   Nothing here reads or writes event data. */
(function(){
const $=id=>document.getElementById(id);
const L=(a)=>'<ul>'+a.map(x=>'<li>'+x+'</li>').join('')+'</ul>';

/* ---------- roles section (dynamic) ---------- */
function rolesHtml(){
 const LBL=window.LBL||{},INFO=window.ROLEINFO||{},BASE=window.ROLEBASE||{},CAT=window.PERMCAT||[];
 const pn={};CAT.forEach(g=>g[1].forEach(k=>pn[k[0]]=k[1]));
 const order=['owner','manager','treasurer','coord','lead','spons','logi','desk','member','vol','viewer'];
 const perms=r=>{const p=(BASE[r]||[]).filter(k=>pn[k]);const x=p.includes('write')?p.filter(k=>k!=='tick'):p;return x.length?x.map(k=>pn[k]).join(', '):'Read only';};
 const E=(typeof V!=='undefined'&&V.tab==='detail'&&typeof cur==='function')?cur():null;   // V and cur are top-level let/const in index.html, not window properties
 let cust='';
 if(E){
  const list=(window.customRolesOf?customRolesOf(E):[]),mine=window.myRole?myRole(E):'';
  cust=`<h4>This event: ${esc(E.name)}</h4><p>Your role here: <b>${esc(window.roleLabel?roleLabel(E,mine):mine)}</b>.</p>`+
   (list.length?'<p>Custom roles in this event:</p>'+L(list.map(c=>`<b>${esc(c.n)}</b>: ${(c.p||[]).filter(k=>pn[k]).length?(c.p.includes('write')?c.p.filter(k=>k!=='tick'):c.p).filter(k=>pn[k]).map(k=>esc(pn[k])).join(', '):'read only'}`)):'<p>No custom roles in this event yet.</p>');
 }
 return `<h4>Built-in roles</h4>`+L(order.map(r=>`<b>${esc(LBL[r]||r)}</b>: ${esc(INFO[r]||'')} <span class="hgm">Permissions: ${esc(perms(r))}.</span>`))+
 `<h4>Who can change roles</h4>`+L([
  'The <b>Organizer</b> can give any role except Organizer. A <b>Manager</b> can give any role except Manager and Organizer, and cannot change another Manager or the Organizer.',
  'Open the <b>People</b> tab and use the role drop-down next to a person. Everyone can change their own name (profile icon > Account, alerts &amp; join event) or leave an event.'])+
 `<h4>Make your own role</h4>`+L([
  'Only the Organizer and Managers can do this, in a shared event: <b>People</b> tab &gt; <b>Custom roles</b> &gt; <b>+ New role</b>.',
  'Give it a name (2 to 24 letters). To save time, pick <b>Copy permissions from</b> an existing role, then tick or untick what you want. Tap <b>Create role</b>.',
  'Give it to someone with the role drop-down in the People list; your custom roles are listed under <b>Custom roles</b>.',
  '<b>Edit</b> changes the permissions of everyone who holds the role straight away. A role can be <b>deleted</b> only when nobody holds it. An event can have up to 12 custom roles.',
  'A role with no permission ticked is read only, like a Viewer.'])+
 `<h4>What each permission allows</h4>`+CAT.map(g=>`<p class="hgm" style="margin:8px 0 2px"><b>${esc(g[0])}</b></p>`+L(g[1].map(k=>`<b>${esc(k[1])}</b>: ${esc(k[2])}`))).join('')+
 `<h4>What cannot be handed out</h4>`+L([
  'Changing roles and making custom roles, deleting the event, and the event\'s ntfy topic stay with the Organizer (and, for roles, Managers).',
  'These limits are enforced by the database rules (<code>firestore.rules</code>), not only by hiding buttons. Publish the latest rules from the repository or the newer roles will not work.'])+cust;
}

/* ---------- the sections ---------- */
const SECS=()=>[
['start','Getting started',
 L(['<b>Create an event:</b> New event in the top menu. Fill in the name, type, date, venue, capacity and description. Pick the type and tap <b>Load form for this type</b> for a ready-made registration form, then add, remove or rename questions. Tap <b>Publish event</b>.',
  '<b>Work with a team:</b> open the event &gt; <b>Details</b> &gt; <b>Share with team</b> (you must be signed in). You get a 6-letter event code. Events you do not share stay on your device.',
  '<b>Join an event:</b> tap the join-team icon in the top bar, or profile icon &gt; Account, alerts &amp; join event &gt; Join an event, and type the code. New people join as <b>Member</b>; the Organizer or a Manager can change the role in the People tab.',
  '<b>The tabs:</b> Details, Attendees, Tasks, People, Payments, Income, Expenses and Chat. Income and Expenses show only for roles with the Money permission. Small numbers count items; a red number means something needs a look (payments to check, overdue bills, online applications).',
  '<b>My tasks</b> (top menu) lists every task and item to buy given to you, and to people who report to you, across all your events.'])],
['details','Details tab',
 L(['The tiles (registered, checked in, open tasks, people, budget left) open the matching tab.',
  '<b>Event code:</b> share it so people can join. The <b>ntfy topic</b> is for optional free phone alerts: install the ntfy app, subscribe to that topic, and switch on &ldquo;Also send my changes to the event\'s ntfy topic&rdquo; in Account, alerts &amp; join event.',
  '<b>Export data:</b> attendees, payments, bills and sponsors as CSV, or everything in one ZIP. You only get the parts your role may see. On Android it opens the share sheet.',
  '<b>Edit event</b> needs the Organizer, a Manager, or a role with the Edit event permission. The Organizer can <b>Delete event</b> (its chat, payment links, expenses, sponsors and online registrations are deleted with it). Everyone else can <b>Leave event</b>.'])],
['att','Attendees, check-in and tickets',
 L(['<b>Register attendee</b> opens a short form and is ready for the next person after each save. A College ID that is already registered is refused, and so is a full event.',
  '<b>Search and filters:</b> All, Not checked in, Checked in, and (when there is a fee) Unpaid and Cash due. <b>Check in</b> is one tap; <b>Undo</b> reverses it.',
  'The <b>&hellip;</b> menu on an attendee: <b>Ticket (QR)</b>, Mark paid, change the payment mode and collector, and Remove registration (needs the Edit event permission).',
  '<b>Ticket (QR):</b> share the ticket link, copy it, save the QR image, or send it by WhatsApp or email. A shareable link needs your public site address (Income &gt; Link settings).',
  '<b>Scan tickets:</b> in the Android app it uses Google\'s scanner screen; on the website it uses the camera, or you can type a ticket code or College ID. A ticket already used shows when and by whom, and an unpaid fee shows a one-tap <b>Mark as paid</b>. Open the event once with internet before the gate opens: scanning then works offline and check-ins are sent when the connection returns.',
    '<b>Who can do what:</b> roles with Attendees and check-in (Organizer, Manager, Treasurer, Team lead, Coordinator, Registration desk) check in, scan, mark paid, import and make teams (teams are in the People tab). Team member basics can add attendees but not check them in.'])+
 `<h4>Import pre-registered attendees</h4>`+L([
  'Attendees tab &gt; <b>Import pre-registered attendees</b>. Choose a CSV, TSV, Excel (<code>.xlsx</code>, <code>.xlsm</code>) or OpenDocument (<code>.ods</code>) file. Old <code>.xls</code> files: open them in Excel and Save as .xlsx first. Password-protected files are not supported.',
  'The file is read on your device and never uploaded. The first row should hold the column names (you can switch this off). Limits: 8 MB, 5,000 rows, 60 columns.',
  'Your columns are matched to the registration form by name (it knows &ldquo;Roll No&rdquo;, &ldquo;Mobile&rdquo;, &ldquo;Dept&rdquo; and similar). Check every match; you can change them. Extra columns it understands: Email, Phone, Paid, Payment mode, Cash collected by, UTR. <b>Download blank template</b> gives you the right headings.',
  'Before anything is saved it checks: name filled, every required question answered, no duplicate College ID (or email or phone when there is no College ID), and the seat limit. The result is shown first. <b>Download skipped rows</b> gives a CSV with the reason, so you can fix it and import again.',
  'Imported people show an <b>Imported</b> tag and get a QR ticket like everyone else. Importing only adds attendees; it never changes or deletes existing ones.',
  'More than about 800 attendees in one event: see the README note on document size (1,500 is the hard limit).'])],
['online','Online registration',
 L(['Attendees tab &gt; <b>Registration</b> (the second button at the top) &gt; <b>Open online registration</b>. Needs a shared event and your public site address (you can type it right there, or under Income &gt; Link settings). Needs the Payments and online registration permission (Organizer, Manager, Treasurer).',
  'Share the link or QR image, <b>Copy link</b>, <b>Share</b>, <b>Save QR image</b>, or <b>Preview page</b>. The <b>Backup link</b> always works. People need no account.',
  'The page shows your registration form questions (change them with Edit event) and, if you wish, the seats left. The page closes at the end of the event day unless you set a closing time. This is checked by the database as well as the page.',
  '<b>Customize page and link</b> (works even before you open registration): link name (3 to 40 letters, digits or hyphens, for example <code>techfest-2026</code> gives <code>your-site/r/techfest-2026</code>), headline, welcome text, accent colour, six background themes, button text, thank-you message, an optional banner image (https only; that site sees visitors\' IP addresses) and a closing time. A link name can be used by one event only, first come first served in your whole project. Renaming frees the old name. Changes go live a moment after you save.',
  '<b>Price and settings</b> (available before you open registration too): ticket price (0 is free; this is the only place the ticket price is set), UPI ID and payee name for the fee, waitlist on or off, and a message on the page.',
  '<b>Applications to review:</b> <b>Approve</b> or <b>Reject</b>. The same College ID cannot apply twice. When seats are full people join a <b>waitlist</b>; <b>Promote</b> (or <b>Promote next</b>) moves them in, and approval re-checks the seats so the event is never overbooked. <b>Approve and mark paid</b> appears when the person gave a UTR or says they paid cash; use it only after you checked your UPI app or the collector.'])],
['cash','Cash or UPI, and cash collectors',
 L(['Set a ticket price first (Attendees &gt; Registration &gt; Price and settings).',
  'In the <b>Cash collectors</b> card (Attendees &gt; Registration, right under online registration) pick people from the event team, or type a name for someone outside the app, such as a faculty coordinator. Up to 20.',
  'When at least one collector is chosen, <b>Cash</b> appears on the registration page next to UPI. The applicant picks who they pay and says &ldquo;I will pay later&rdquo; or &ldquo;I have already paid this person&rdquo;. If only one method is available the choice is not shown.',
  'Nothing is marked paid on the applicant\'s word alone. Tick <b>Paid</b> on the attendee (&hellip; menu) after the cash is in hand or the UTR is confirmed.',
  '<b>Who can tick Paid:</b> roles with Attendees and check-in. If the people who collect cash should tick it themselves, give them the Treasurer, Registration desk or a custom role with that permission.',
  '<b>Cash and UPI at a glance</b> (Income tab) shows, for each collector, how many attendees chose them, what was received and what is still to collect. <b>Show unpaid cash</b> opens the attendee list filtered to unpaid cash. The CSV exports include payment mode and collector.'])],
['tasks','Tasks and items to buy',
 L(['<b>Task groups</b> keep tasks tidy. Use <b>+ New group</b> or <b>Add standard groups</b> (Logistics, Marketing, Finance, Hospitality, Tech and AV).',
  '<b>+ Add task:</b> a title, who it is for, an optional due date and an optional <b>Brief</b> (steps, links, deadlines). Tap <b>Brief</b> on a task to open or close it. Tick the box when it is done.',
  '<b>Who can assign what:</b> roles with Manage tasks can give a task to anyone. Others can give tasks to themselves and to people who report to them.',
  'The filter row (All, Mine and my team, To do, Done) applies to tasks and items together. The progress bar counts both.',
  '<b>Items to buy:</b> <b>+ Add item</b> with a quantity, an estimated cost, a person and a budget category. The person is alerted and also sees it in My tasks. When it is bought, tick it and enter what it really cost. A bought item counts as spent; an item not yet bought counts as money to pay, at its estimate. <b>Show who is buying what</b> sums it up per person.',
  'Deleting a task, a group with tasks, a team, a registration, a category, a vendor or a bill asks first.'])],
['people','People and volunteers',
 L(['Everyone who joins with the event code appears in the People tab and can be given tasks.',
  '<b>+ Add person</b> is for people who do not use the app, such as volunteers. Give a name, a title and a phone number, and say who they report to. They can be given tasks and items to buy.',
  'Removing someone makes their tasks unassigned.',
  '<b>Participant teams</b> (below the roles): create a team by name, or split the attendees who are not in a team into teams of a size you choose. Add or remove members on each team card.',
  'Roles and custom roles are explained under <b>Roles and permissions</b>.'])],
['roles','Roles and permissions',rolesHtml()],
['pay','Payments and payment links',
 L(['Payment links are in the <b>Income</b> tab (below the sponsors). The <b>Payments</b> tab lists what people have paid.',
  '<b>+ New link</b> creates a payment link for a registration fee or a donation: a title, an optional amount (blank means any amount), a UPI ID, a payee name and a note. Anyone with the link can pay by scanning the QR code and then send their name and UTR on the page. They need no account. Needs a shared event and your public site address.',
  '<b>Every link belongs to its event.</b> It stops working at the end of the event day. Under <b>Link settings</b> (Income tab) you can keep links open for up to 30 extra days. Expired links say so, and deleting the event deletes its links and the payments sent through them.',
  '<b>Payments received:</b> check each one against your bank or UPI app, then <b>Verify</b> or <b>Reject</b>. Filter by To check, Verified or Rejected. The red number on the tab counts payments waiting to be checked.',
  '<b>Who can do what:</b> payment links are made in the Income tab, which needs the Money permission. Verifying payments and the link settings need the Payments and online registration permission.',
  '<b>Site address:</b> payment links, tickets and registration open pages on your website. Save its address once (Income &gt; Link settings, or in Attendees &gt; Registration), for example <code>https://yourname.github.io/your-repo/</code>.'])],
['money','Expenses and Income',
 L(['These two tabs are for roles with the <b>Money</b> permission (Organizer, Manager, Treasurer, Sponsorship lead and custom roles with it).'])+
 `<h4>Expenses (money going out)</h4>`+L([
  'The top card shows how much you can still spend, or how far over you are. Solid is spent, hatched is still to pay.',
  '<b>Budget:</b> tap a common category or type your own, with a planned amount. Tap a category card to see the bills and items inside and to change the planned amount. Choose a category when you add a bill or an item so it counts against a budget line; the rest shows as <b>No category</b>.',
  '<b>Bills:</b> money you owe vendors, or have paid. Overdue ones come first, labelled &ldquo;Due in 3 days&rdquo; or &ldquo;Overdue by 2 days&rdquo;. <b>+ Add bill</b> takes what it is for, who you pay, the amount, a category and a due date; <b>Add as already paid</b> records something already settled. For a vendor with a UPI ID, <b>Pay via UPI</b> shows a QR code to scan with any UPI app, and an <b>Open UPI app</b> button on a phone. Then tap <b>Mark paid</b> and add the mode and UTR. Paid bills are behind <b>Show paid bills</b>.',
  '<b>Vendors:</b> contact, UPI ID, what you have paid and still owe each one, and an <b>Add bill</b> shortcut.',
  'Bills still to pay count in your budget as money about to go out. Items to buy count too (see Tasks).'])+
 `<h4>Income</h4>`+L([
  'Ticket fees and sponsors, compared with what the event costs.',
  '<b>Cash and UPI at a glance:</b> how much attendee money came in by cash (per collector) and by UPI.',
  '<b>Sponsors and other income:</b> for each one record what was committed, what has arrived, what you promised in return and whether it is delivered.',
  '<b>Break-even:</b> ticket price x seats plus sponsorship, against the cost (your budget, or what you have spent plus still have to pay; one tap switches). It tells you how many tickets you need, or that even a full house falls short. The ticket price comes from Attendees &gt; Registration &gt; Price and settings.',
  '<b>Payment links</b> are made and shared here.',
  '<b>Export data</b> is also here.'])],
['chat','Chat',
 L(['Chat works in shared events. Everyone with at least one permission can write; a Viewer, or a custom role with nothing ticked, can read only.',
  'Type <b>@</b> or tap the <b>@</b> button to tag someone. They get an alert (Chat mentions) and see the message outlined.',
  'You can edit or delete your own message for 2 hours. The Organizer, Managers and roles with the Edit event permission can delete any message.',
  'People who join later can read the whole history; <b>Load older messages</b> pages back 40 at a time. The chat is deleted with the event.'])],
['calc','Calculator for the event desk',
 L(['The calculator button next to the event name (on every tab) has four tools.',
  '<b>Calculator:</b> + &minus; &times; &divide; % and brackets, a tape of results, and the keyboard works. <code>200 + 10%</code> gives 220 like a shop calculator.',
  '<b>Change:</b> price x quantity, tap the notes received, and see the change to give back.',
  '<b>Cash count:</b> how many of each note and coin are in the box, the total, and the difference against the cash the system says was received (all collectors or one). <b>Use cash received so far</b> fills the expected amount.',
  '<b>Split:</b> share a bill between people, rounded up to the rupee.',
  'Values stay on your device so an interrupted count is not lost. Nothing is sent anywhere.'])],
['acct','Account, alerts and updates',
 L(['<b>Account, alerts &amp; join event</b> (profile icon): change <b>Your name</b> (2 to 40 characters; it changes in all your events, old chat messages keep the name they were sent with), join an event with a code, choose what you are notified about (Tasks, People, Money, Event changes, Chat messages, Chat mentions), send your changes to the ntfy topic, read recent updates, and sign out.',
  '<b>Theme</b> cycles Auto, Light and Dark.',
  '<b>About &amp; updates</b> shows the version. In the Android app it also checks for a newer one, and a new APK installs over the old one when it is built from the same repository with the same signing key. The website is always the latest version, so it never shows an update banner; if it looks old, tap <b>Reload</b>.',
  'You can sign in with Google or with email and password. Creating an account with email sends a 6-digit code.'])],
['fix','Good to know and troubleshooting',
 L(['<b>&ldquo;No permission&rdquo;</b> means your role does not allow that, or the latest <code>firestore.rules</code> are not published in Firebase. Ask the Organizer or a Manager.',
  '<b>&ldquo;Role removed&rdquo;</b> next to a name means the custom role they held no longer exists. Give them another role.',
  'Your events are cached on the phone and sync when you are online. Chat, payment links and online registration need a connection and a shared event.',
  'Every member, including viewers, can read the attendee list with College IDs, phones and emails. Share the event code only with people you trust with those details. Money data is visible only to roles with the Money permission.',
  'The registration form has no rate limit. If someone floods it with junk applications, close online registration or remove the applications.',
  'More help for whoever maintains the app: README.md and SETUP.md in the repository.'])]
];

/* ---------- panel ---------- */
const css=document.createElement('style');
css.textContent=`#hg{position:fixed;inset:0;z-index:45;display:flex;align-items:center;justify-content:center;background:rgba(16,23,43,.55);backdrop-filter:blur(4px);padding:calc(12px + env(safe-area-inset-top,0px)) 12px calc(12px + env(safe-area-inset-bottom,0px))}
#hg .hgb{position:relative;background:var(--card);color:var(--ink);border-radius:18px;width:min(720px,100%);max-height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.45);outline:0}
#hg .hgh,#hg .hgs{flex:none}#hg .hgh{display:flex;align-items:center;gap:10px;padding:16px 18px 10px}#hg .hgh h3{flex:1;font-size:18px}
#hg .hgx{width:34px;height:34px;border:1px solid var(--line);border-radius:50%;background:var(--card);color:var(--ink);font:700 15px/1 system-ui,sans-serif;cursor:pointer}
#hg .hgs{padding:0 18px 10px}#hg .hgs input{width:100%}
#hg .hgc{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;padding:0 18px 18px;-webkit-overflow-scrolling:touch}
#hg details{border:1px solid var(--line);border-radius:12px;margin:0 0 8px;background:var(--bg)}
#hg summary{cursor:pointer;font-weight:600;padding:12px 14px;list-style:none;display:flex;justify-content:space-between;gap:8px}
#hg summary::-webkit-details-marker{display:none}#hg summary:after{content:'+';color:var(--mute);font-weight:700}#hg details[open] summary:after{content:'\\2212'}
#hg .hgd{padding:0 14px 12px;font-size:14px}#hg .hgd ul{margin:6px 0;padding-left:20px}#hg .hgd li{margin:0 0 7px}
#hg .hgd h4{margin:14px 0 4px;font-size:14px}#hg .hgd code{font-size:12.5px;background:var(--card);border:1px solid var(--line);border-radius:5px;padding:0 4px;overflow-wrap:anywhere}
#hg .hgm{color:var(--mute)}#hg .hgn{text-align:center;color:var(--mute);padding:18px}`;
document.head.append(css);

let box;
function build(){
 box=document.createElement('div');box.id='hg';box.className='hid';
 box.innerHTML=`<div class="hgb" role="dialog" aria-modal="true" aria-label="Help and guides" tabindex="-1"><div class="hgh"><h3>Help &amp; guides</h3><button type="button" class="hgx" data-hgx="1" aria-label="Close">&#10005;</button></div>
  <div class="hgs"><input id="hgq" type="search" placeholder="Search help" aria-label="Search help" autocomplete="off"></div><div class="hgc" id="hgc"></div></div>`;
 document.body.append(box);
}
function fill(open){
 $('hgc').innerHTML=SECS().map(s=>`<details id="hg_${s[0]}" ${s[0]===open?'open':''}><summary>${s[1]}</summary><div class="hgd">${s[2]}</div></details>`).join('')+'<div class="hgn hid" id="hgnone">Nothing matches. Try another word.</div>';
}
window.openHelp=function(sec){
 if(!box)build();
 fill(sec||'');$('hgq').value='';box.classList.remove('hid');document.documentElement.style.overflow='hidden';
 const t=sec&&$('hg_'+sec);if(t)setTimeout(()=>t.scrollIntoView({block:'start'}),0);
 box.querySelector('.hgb').focus();
};
function close(){if(box)box.classList.add('hid');document.documentElement.style.overflow=''}
document.addEventListener('click',e=>{
 if(!box||box.classList.contains('hid'))return;
 if(e.target===box||e.target.closest('[data-hgx]'))close();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&box&&!box.classList.contains('hid')){close();e.stopPropagation()}},true);
document.addEventListener('input',e=>{
 if(e.target.id!=='hgq')return;
 const q=e.target.value.trim().toLowerCase();let n=0;
 document.querySelectorAll('#hgc details').forEach(d=>{
  const hit=!q||d.textContent.toLowerCase().includes(q);d.style.display=hit?'':'none';if(hit)n++;
  if(q)d.open=hit;
 });
 const none=$('hgnone');if(none)none.classList.toggle('hid',n>0);
});
})();
