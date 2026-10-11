# Campus Events (CEM) 3.6.1

Plan campus events with your team: registrations, tasks, roles, UPI payment links, a chat inside every event, a budget with bills and vendors, public self-registration, QR tickets with scan-to-check-in, and an income and sponsor tracker.
Runs as an Android app (APK built by GitHub, no installs) and as a website. Everything fits in the free plans of GitHub and Firebase (Spark).

## What's new in 3.6.1: more roles, custom roles, and a tidier app with Help & guides
Everything stays free (no new service, no new npm package, no Cloud Functions). **This release changes `firestore.rules`, so republish the rules before anyone uses a new role** (SETUP.md > Upgrade to 3.6.1, about 10 minutes, nothing to convert). Existing events, members and the six classic roles are untouched.

### 1. Five more built-in roles
| Role | What it is for | Permissions |
| --- | --- | --- |
| **Coordinator** | Runs the day: task groups, items, attendees, the volunteer list | Team member basics, Manage tasks, Items to buy, Volunteer list, Attendees and check-in |
| **Registration desk** | Gate and desk volunteers: register walk-ins, check in, scan, mark fees paid | Team member basics, Attendees and check-in |
| **Logistics lead** | Task groups, tasks and items to buy, given to anyone | Team member basics, Manage tasks, Items to buy |
| **Sponsorship lead** | Sponsors and the money side | Team member basics, Money |
| **Volunteer** | Ticks off the tasks given to them and chats | Tick off own tasks |

They sit next to the classic roles (Organizer, Manager, Treasurer, Team lead, Member, Viewer) in the People tab's role drop-down.

### 2. Custom roles, with permissions you tick (`app2.js`, `firestore.rules`)
People tab > **Custom roles** (organizer and managers only, shared events) > **+ New role**. Give it a name, optionally **Copy permissions from** an existing role, tick what it may do, **Create role**. Give it to people with the same drop-down. Editing a role changes every holder at once; a role can be deleted only when nobody holds it; an event can have up to 12.

| Permission | Allows |
| --- | --- |
| Tick off own tasks | Mark the tasks given to them as done |
| Team member basics | Tick own tasks, add people who report to them, create payment links, register attendees (no check-in) |
| Manage tasks | Task groups and tasks, given to anyone |
| Items to buy | Add items to buy and give them to people |
| Volunteer list | Add and remove people without an account, set who reports to whom |
| Attendees and check-in | Register, check in, scan tickets, mark fees paid, import a list, participant teams |
| Edit event and registrations | Edit the event details, remove registrations, delete any chat message |
| Payments and online registration | Verify payments, payment links, UPI settings, online registration, cash collectors |
| Money | Budget, vendors, bills, sponsors, and the Income and Expenses tabs |

- **Enforced by the database, not just hidden buttons.** Each role is a list of permission keys. `firestore.rules` opens each field of the event document only to roles that hold a matching permission (`customFieldsOk`, `regsOk`), and the money document, payment links, online registration and chat check the same lists (`canExp`, `canPay`, `canChat`, `canMod`). A custom role is stored as `croles.<id>` in the event document (one entry per role, like attendees), and a member's `role` is that id.
- **Not delegable:** changing roles and making custom roles (organizer and managers), deleting the event (organizer), the ntfy topic. A custom role with nothing ticked is read only.
- The five new built-in roles are listed twice, in `permsOf` in `firestore.rules` and in `BASE` in `www/app2.js`. Keep them identical if you change either.
- Chat now needs any one permission to post (a Viewer or an empty custom role can read only). Ticking a task needs Tick off own tasks (or Team member basics, or Manage tasks): a Viewer can no longer tick a task that was given to them (the rules always refused it; the box is now disabled instead of failing).
- Role names show everywhere (People, Details, chat names, alerts such as "Your role is now Gate").

### 3. An uncluttered app, and one place for help (`help.js`)
- The explanatory paragraphs that sat at the top of tabs, under forms and in cards are gone: the role guide, tab introductions, "how it works" notes, import and registration blurbs, payment-link notes, expense and income hints, the chat header text and the preset note on the event form. What is left in the tabs is status (counts, "Open", "Expired"), empty states and the few prompts that explain why something is unavailable (for example "Share the event first").
- **Profile icon > Help & guides** (right after "Account, alerts & join event") opens one searchable panel with 14 folding sections: Getting started, Details, Attendees and tickets (with the spreadsheet import), Online registration, Cash or UPI, Tasks and items, People, **Roles and permissions** (built-in roles, how to make your own, every permission, and the custom roles of the event you have open), Payments, Expenses and Income, Chat, Calculator, Account and updates, and Troubleshooting.
- The event's **Details** tab has a short note ("Need help or a guide? Tap your profile icon...") with a button that opens the panel.
- Not changed on purpose: the public pages (`login.html`, `register.html`, `pay.html`, `ticket.html`) keep their own instructions, because those are for visitors who never see the app menu.

### Known limits of 3.6.1 (please read)
- **The new rules could not be run against the Firebase emulator when this release was prepared** (it needs a download that was not available). The app was tested in a headless browser against a mock database (roles, the role form, sync of `croles`, Help & guides, all tabs for all roles) and the rules were checked by reading and for balanced syntax, not by running them. Run the test checklist in SETUP.md > Upgrade to 3.6.1, including the **Rules Playground** step, before you rely on it.
- The rules cannot loop over a map. So a custom role's name and permission list are not validated entry by entry (only the number of roles, at most 20, and who may write them: organizer and managers), and they cannot stop someone deleting a role that is still in use. The app refuses that; if it happens from two devices at once, the holder shows **Role removed** and has no permissions until you give them another role.
- As before, per-attendee limits are not possible: a role allowed to change attendees could change any attendee's fields. And `tasks`, `team` and `teams` are still whole-field writes.
- A 3.6.0 app does not know the new roles: a person holding one sees a read-only event until they update the app.
- Not tested on a real phone or against the real Firebase project.

## What was new in 3.6.0: spreadsheet import, custom registration link, cash or UPI, calculator
Everything stays free (no new service, no new npm package, no Cloud Functions). **This release adds two collections to `firestore.rules`, so republish the rules** (SETUP.md > Upgrade to 3.6.0, about 10 minutes, nothing to convert).

### 1. Import pre-registered attendees from CSV, Excel or a spreadsheet (`sheet.js`, `import.js`)
Attendees tab > **Import pre-registered attendees** (organizer, manager, treasurer, team lead).
- **Formats:** CSV, TSV, Excel `.xlsx` / `.xlsm`, OpenDocument `.ods`. CSV can use commas, semicolons, tabs or pipes, UTF-8, UTF-16 or Windows-1252 (what Excel writes in India and Europe), and Excel's `sep=;` line. The old binary `.xls` is **not** supported (the app says so and asks for Save as `.xlsx` or CSV); neither are password-protected files.
- **Private and library-free.** The file is read on the phone or computer, never uploaded, and the reader is about 220 lines in `www/sheet.js` (no SheetJS or other package to download or patch). Only stored values are read: formulas and macros are never run. Limits: 8 MB, 5,000 rows, 60 columns.
- **Column matching.** The app matches your columns to the registration form by name (it knows "Roll No", "Mobile", "Dept", "E-mail ID", and similar), you can change every match, and it shows a sample value next to each. Extra columns it understands: **Email, Phone, Paid, Payment mode, Cash collected by, UTR**. "Download blank template" gives a CSV with the right headings.
- **Checks before anything is written:** name and every required question filled in; no College ID (or, when there is none, no email or phone) twice, neither against attendees already registered nor inside the file; seats never exceeded. The result is shown first ("38 ready, 7 skipped: Already registered (3), Name is empty (2)...") and **Download skipped rows** gives a CSV with the reason in the first columns, so you can fix the sheet and import again. Numbers keep their digits (phone numbers, roll numbers), dates become `YYYY-MM-DD`, and the leading `'` that our own CSV export adds to cells starting with `+ = - @` is removed again.
- Imported people are tagged **Imported**, get a QR ticket like everyone else, and show as "Imported from file" in the attendee CSV.

### 2. Fully customisable registration link and page (`signup.js`, `register.html`, `404.html`)
Attendees tab > Online registration > **Customize page and link** (available even before you open registration).
- **Link name:** `techfest-2026` gives `https://your-site/r/techfest-2026`. Names are first come, first served across your whole Firebase project, are claimed in a new public collection `regslugs`, and cannot be taken over by another event (enforced by the rules; renaming frees the old name, deleting the event frees it too). `www/404.html` turns `/r/<name>` into `register.html?r=<name>` (GitHub Pages serves it for unknown addresses; it also works under `https://you.github.io/repo/r/<name>`). The **backup link** `register.html?r=<name>` always works, and the old `register.html?e=CODE` links keep working.
- **Page look:** headline, welcome text, button text, thank-you message, accent colour, six background themes (Indigo night, Sunset, Ocean, Forest, Graphite, Light), optional banner image link (https only), show or hide seats left.
- **Closing time:** pick the date and time registration closes (default is the end of the event day). It is enforced by the database rules, not just the page.
- **Preview page** opens the live page in a new tab. Share and QR image use the short link.

### 3. Cash or UPI in the registration form, and who collects the cash (`payment.js`)
- **Cash collectors** (Attendees tab, organizer / manager / treasurer): pick people from the event team, or type a name for someone outside the app (for example a faculty coordinator). Up to 20.
- **Public page:** when the ticket has a price, the applicant chooses **UPI** (QR, optional UTR, as before) or **Cash**. For cash they pick the collector from a drop-down and say **"I will pay later"** or **"I have already paid this person"**. If only one method is available the choice is not shown. The rules check that the collector is one of the published ones.
- **Register attendee (inside the app):** a Payment block with Not paid yet / Cash / UPI, the collector drop-down (required when collectors exist), a UTR box, and "Payment received now" for people who may mark paid.
- **Applications to review** show "Cash: Meera (pays later)" or "UPI"; **Approve and mark paid** appears when the person says they already paid cash or gave a UTR. Nothing is marked paid on the applicant's word alone: you tick it after checking with the collector or your UPI app.
- **Attendees:** a tag shows the mode and collector; the ... menu changes the mode and collector later; a new **Cash due** filter lists unpaid cash.
- **Cash and UPI at a glance:** for each collector, how many attendees chose them, what is received and what is still to collect. The Income tab and the CSV exports (attendees and payments) now include payment mode and collector.
- **Who can tick "Paid":** organizer, manager, treasurer and team lead (the existing rule). A collector with the plain Member role cannot; give the people who collect cash the **Treasurer** role if they should tick it themselves.

### 4. Calculator for the event desk (`calc.js`)
The calculator button next to the event name (every tab). Four tools: **Calculator** (+ - x / % and brackets, tape of results, keyboard works; `200 + 10%` = 220 like a shop calculator; its own small parser, never `eval`), **Change** (price x quantity, tap the notes received, change to give back), **Cash count** (notes and coins in the box, total, and difference against the cash the system says was received, for all collectors or one) and **Split** (share a bill, rounded up to the rupee). Values stay on the device so a count is not lost if you are interrupted; nothing is sent anywhere.

### Known limits of 3.6.0 (please read)
- **The new rules could not be run against the Firebase emulator when this release was prepared.** The app logic was tested against a mock database (import, link names, applications, the public page, the calculator) and the rules were checked by reading, not by running. Run the test checklist in SETUP.md > Upgrade to 3.6.0 on a test event first.
- A custom link name changes the **address**, not what the page contains: the public page document still holds the event code (as in 3.5.0), and anyone with the link can see it.
- A first-come link name can be claimed by any organizer, manager or treasurer of any event in your project. Names cannot be reserved for a future event.
- The banner image is loaded from the address you give, so that site sees visitors' IP addresses. Leave it empty if that matters.
- Cash "already paid" is the applicant's claim. The collector cannot confirm inside the app unless they can tick Paid (see above).
- Spreadsheet import: no `.xls` (old Excel) and no password-protected files. Import adds attendees; it never changes or deletes existing ones. More than about 800 attendees per event: see the 3.5.0 note below (Firestore indexes up to 40,000 entries per document; 1,500 is the hard stop in the rules).
- Not tested on a real phone: the file picker inside the APK (it uses the system file chooser; the website path was tested).

## What was new in 3.5.0: safer data, self-registration, QR tickets, sponsors
Everything stays on the free plans (GitHub, Firebase Spark, no Cloud Functions, no card). **This upgrade needs new `firestore.rules` and converts old events once, so read SETUP.md > Upgrade to 3.5.0 before you start** (about 20 minutes).

### 1. Permissions fixed (`firestore.rules`)
Before 3.5.0 any member could write any field of the event, including their own role, and the budget, vendors and bills sat in the event document where every member could read them. Now:

| Role | May change in the event document |
| --- | --- |
| Organizer (owner) | everything except who the owner is |
| Manager | everything except the owner, other managers' roles and the notification topic |
| Treasurer | their own tasks, people they add, teams, payment settings (`pay`), attendees (add and change, never delete), payment links, items to buy |
| Team lead | task groups, tasks, people they add, teams, attendees (add and change, never delete), items to buy, payment links |
| Member | tasks they may tick, people who report to them, teams, items they were given, payment links, and **adding** attendees (no check-in, no deleting) |
| Viewer | nothing |

- **Roles can only be changed by organizer and manager.** The owner can set manager, treasurer, lead, member, viewer; a manager can set treasurer, lead, member, viewer and cannot touch another manager or the owner. Everyone can still change their own display name or leave an event.
- **Money data moved to a staff-only document** `events/{id}/fin/data`: budget lines (`bud`), vendors (`ven`), vendor bills (`exp`), earlier payments (`payments`), donations (`don`) and the new sponsors (`spn`). Only organizer, manager and treasurer can read or write it. Members and viewers no longer receive it at all (before, the app only hid it).
- The conversion of an existing event is automatic: the first time the organizer or a manager opens the new app, the money data is copied to the staff-only document, removed from the event document, and the attendee array is converted. Nothing is overwritten and it is safe to repeat.

### 2. One entry per attendee
Attendees are stored as `regs.<id>`, one map entry each, the same way bills and vendors already were (`MAPK` in `www/sync.js`). Two gate volunteers checking in different people no longer overwrite each other. The app also writes **only the fields that changed** (`in`, `inAt`, `inBy`), so a check-in and a "paid" tick on the *same* person both survive. One Firestore document holds 1 MiB. That is plenty for a few hundred attendees (an attendee with a few answers is roughly 300 to 500 bytes). The rules stop at 1,500 entries as a safety net; **if you expect more than about 800 attendees, move attendees to a sub-collection** (`events/{id}/regs/{rid}`), which also allows rules per attendee.

### 3. Public self-registration (`register.html`)
Works like `pay.html`: public form, then pending, then approve.
- Attendees tab > **Open online registration** (organizer, manager, treasurer). You get a link and a QR code to share; the page shows the event, seats left and **your own registration form questions**. No account needed.
- **Duplicate check on College ID.** The application is stored under the College ID, so the same ID cannot apply twice (enforced by the rules, not just the page). Approving also checks the ID against the attendees you already have, and adding an attendee by hand does the same.
- **Waitlist.** When the seats are full the page says so and stores applications as *waitlist*. When a seat frees up, **Promote** (or **Promote next**) moves people in. Approval re-checks the seats, so the event can never be overbooked by the form.
- **Optional fee.** Set a ticket price and UPI ID (Price and settings). The page shows the UPI QR, exactly like a payment link, and an optional UTR box. Pay-later is fine. **Approve and mark paid** records the fee after you checked your UPI app.
- Free-plan cost: one write per application and one read per application per organizer device. A public form is tiny next to Spark's daily limits (50,000 reads, 20,000 writes).

### 4. QR tickets and scan-to-check-in
- Every attendee has a QR ticket (Attendees > **...** > **Ticket (QR)**). Share a ticket link (`ticket.html`), copy it, save the QR image, or send it by WhatsApp or email. Approved online applications show a **Ticket (QR)** button too.
- **Scan tickets** (organizer, manager, treasurer, team lead). **Android app:** the free `@capacitor-mlkit/barcode-scanning` plugin (Google's scanner screen). **Website:** the browser's built-in `BarcodeDetector` where it exists, otherwise the small `jsQR` library (`www/vendor/jsQR.js`, Apache-2.0, loaded only when needed). A box for typing a ticket code or College ID works everywhere.
- Already-checked-in tickets show a warning with the time and who checked them in. Unpaid fees show a one-tap **Mark as paid**.
- **Offline:** scanning uses the attendee list already cached on the phone and Firestore queues the check-ins until the network returns. Open the event once with a connection before the gate opens.

### 5. Income, sponsors, break-even, CSV export
- **Income tab** (organizer, manager, treasurer): for each sponsor (or donation / other income) the amount **committed**, the amount **received**, what you **promised** them and whether it is **delivered**.
- **Break-even:** `ticket price x seats + sponsorship` against total cost (your budget, or what you spent plus still have to pay, one tap to switch). It tells you how many tickets you need, how many registrations to go, or that even a full house falls short, with a bar showing income against the cost line.
- **Export data** (Details and Income tabs): attendees, payments, bills and sponsors as CSV, or everything in one ZIP. On Android it opens the share sheet (Drive, WhatsApp, Files). Cells starting with `= + - @` are escaped so spreadsheets never run them as formulas.

### Known limits (please read)
- The rules cannot loop over a map, so per-attendee field rules are not possible while attendees are map entries. They enforce the role table above (for example a member can add attendees but not check them in); a volunteer who is allowed to change attendees could still edit another attendee's fields.
- `tasks`, `team` and `teams` are still whole-field writes, so two people ticking different tasks at the same instant can overwrite each other (attendees, bills, vendors, items, payment links and sponsors cannot).
- Every member (including viewers) can still read the attendee list with College IDs, phones and emails. Money data is now staff-only; attendee contact details are not.
- The public registration form has no rate limit (Firestore rules cannot count requests). The College ID rule stops duplicates and the size limits stop huge documents, but someone could send many applications with different made-up IDs. Close the page, or delete applications (Remove), if that happens. Adding Firebase App Check later is the free next step.
- A QR ticket is a bearer ticket: whoever has the link or image can use it once (the second scan warns). The ticket id is 12 random characters, so it cannot be guessed.
- The new rules could not be run against the Firebase emulator when this release was prepared (it needs downloads that were not available). The app logic was tested against a mock database; **run the checklist in SETUP.md > Upgrade to 3.5.0 on a test event before you rely on it.**

## What was new in 3.4.0: a tidier event page
A redesign of the event screen. **Your data, sign-in, rules and Cloudflare Worker are untouched**, so upgrading is just replacing a few files (**SETUP.md > Upgrade to 3.4.0**, about 5 minutes, nothing to migrate).

**Where things are now**

| Tab | What is in it |
| --- | --- |
| **Details** (new) | Date, time, venue, description, seats, a tappable summary (registered, checked in, open tasks, people, budget left), the event code to invite people, your role, Edit / Delete / Leave. The old header card that repeated on every tab is gone; every tab now starts with just the event name. |
| **Attendees** | Search, filters (all / not checked in / checked in), one-tap **Check in**, and a **Register attendee** form that stays closed until you need it and is ready for the next person after each save. The **participant Team maker moved here** (switch between *Attendees* and *Teams* at the top). |
| **Tasks** | Task groups **and Items to buy** in one place, with one progress bar and one filter row (All / Mine and my team / To do / Done) that applies to both. Add forms open from "+ Add task" / "+ Add item". Ticking an item asks what it really cost. |
| **People** | Everyone on the event, sorted by role, with their role, task progress and phone. Add volunteers who have no account with "+ Add person". The role guide is one tap away. |
| **Payments** | Money coming in. Payments waiting to be checked are first, with filters; payment links come next; link settings are tucked away. |
| **Expenses** | Money going out: **Budget**, **Bills**, **Vendors** (see below). Only organizer, manager and treasurer see this tab. |
| **Chat** | As before. |

The tab bar scrolls sideways on a phone and shows small counters: attendees, open tasks, people, and in **red** payments waiting to be checked and overdue bills.

**Expenses & Budget, redesigned**
- **Summary card** at the top: how much you can still spend (or how far over you are), with one bar: solid = spent, hatched = still to pay.
- **Budget view**: one card per category with a status ("On track", "Almost used", "Over by ₹1,500"). Tap a card to see every bill and item inside it and to change the planned amount. Adding a category is one tap on a suggestion (Venue, Food, Decor...) plus an amount.
- **Bills view** (was "Payments to vendors"): what you owe, sorted with **overdue first** and labelled "Due in 3 days" or "Overdue by 2 days". **Pay via UPI** shows the QR code in place; **Mark paid** takes the mode and UTR. Paid bills are tucked behind "Show paid bills". The add form is short; to record something already paid, use **Add as already paid**.
- **Vendors view**: contact, UPI ID, how much you have paid and still owe each one, and an **Add bill** shortcut.
- Items to buy still count in the budget (bought = spent at the real cost, not yet bought = to pay at the estimate). The summary card links to them in Tasks.

**Small things**
- Deleting a task, a task group that has tasks, a team, a registration, a category, a vendor or a bill now asks first.
- Viewers can no longer register attendees or edit teams (they could before; the roles table already said read-only). Check-in still needs team lead or above.
- Cancelling "Edit event" returns to the event instead of the list. Opening an event lands on Details.

## What was new in 3.3.0
- **Sign in or sign up with Google**, on the website and inside the Android app. One tap, no password, no emailed code (Google has already confirmed the address). Email and password still work exactly as before.
  - **Website:** a Google pop-up (it switches to a full-page redirect if the browser blocks pop-ups).
  - **Android app:** a pop-up cannot work inside an app, so the app uses the free `@capacitor-firebase/authentication` plugin to get a Google token and signs in to Firebase with it. The rest of the app is unchanged.
  - **Free, no card:** Google sign-in is part of Firebase Authentication on the Spark plan. Do not upgrade to "Identity Platform".
- **Firebase's public sign-up must be switched back ON.** Google can only create new accounts while it is on. The bot protection that 3.2.0 got from switching it off now comes from `firestore.rules`: the database accepts only accounts with a **confirmed email**. Google accounts and OTP-Worker accounts are always confirmed; a bot-made account never is, so it can read and write nothing.
- **Old email accounts** that were created before the code step existed (never confirmed) get a Firebase confirmation link the next time they sign in, then sign in again. This is free and built in.
- Sign-out also forgets the Google account in the APK, so the next sign-in shows the account chooser.
- New helper workflow **Show signing key fingerprint (SHA-1)**, because Firebase needs that SHA-1 for Google sign-in in the APK.
- Setup: **SETUP.md > Upgrade to 3.3.0** (about 25 minutes). Until the Android part is done, the website works and the APK still builds; only the Google button inside the APK will not work.

## What was new in 3.2.0
- **Email code (OTP) when creating an account.** Choose "Create account", enter name, email and password, and a 6-digit code is emailed to you. The account exists only after you type the code. **Signing in never asks for a code.**
  - Stops bots and mass junk accounts: nobody can create an account without a real inbox, and (until 3.3.0) Firebase's own public sign-up was switched off so the code step could not be skipped. From 3.3.0 the database rules do that job instead; see above.
  - Extra guards: codes expire in 10 minutes, 5 wrong tries lock a code, one code per email per minute, 5 codes per email and 10 per network per hour, throwaway-mail domains (mailinator and similar) are refused, and an optional free captcha (Cloudflare Turnstile) and college-email-only mode can be switched on.
  - Still **free, no card**: a small Cloudflare Worker (`worker/otp-worker.js`) sends the code through Brevo (300 emails a day free) and creates the Firebase account. Firebase stays on the Spark plan; there are no Cloud Functions.
  - Setup is a one-time job of about 30 minutes: **SETUP.md > Upgrade to 3.2.0**. Until it is done, "Create account" shows "Sign-up is not set up yet" (sign-in keeps working).
  - Old APKs (3.1.x) cannot create accounts through the code flow. Set `min` to `3.2.0` (or `3.3.0`) in Firestore > appconfig > version to ask people to update.

## What was new in 3.1.0
- **Expenses tab** (Event > Expenses).
  - *Budget*: add budget lines (Food, Venue, Decor...) with a planned amount. Each line shows spent, still to pay, what is left and a bar that turns red when you go over.
  - *Vendors and parties*: save who you pay, with an optional UPI ID and phone.
  - *Payments to vendors*: record what you owe or have paid. For a vendor with a UPI ID, **Pay via UPI** shows a QR code and an "Open UPI app" button with the amount filled in. **Mark paid** stores the mode and UTR.
  - *Items to buy*: build a shopping list (item, quantity, estimated cost, category) and **allocate each item to a member**. The member gets an alert, sees the item under **My tasks**, and marks it bought with the real cost. A "Who is buying what" table shows each member's share.
  - Who sees what: organizer, manager and treasurer manage budget, vendors and payments. Organizer, manager, treasurer and team lead add and allocate items. Everyone else sees only the items list.
- **Payment links belong to the event.** A link stops working at the end of the event day (organizers can keep it open up to 30 extra days under Payments > Link expiry), and when the event is deleted its links and the payments submitted through them are deleted too. Expiry is enforced by the Firestore rules, so an old link cannot be used even if someone saved the page.
- **Change your name**: Account menu > Account, alerts & join event > Your name. It updates your name in every event you are in.
- **Chat**: fixed the scrolling (the chat now fills the screen and only the message list scrolls, the keyboard no longer closes when a sync arrives, new messages no longer jump the list). **Tag members** by typing @ or tapping the @ button; tagged people get an alert (Chat mentions) and see the message outlined.
- **Close buttons** on the account / alerts panel, the join-event popup and the About popup. The account panel also closes with Esc or by tapping outside.

## What was new in 2.0.0
- **Event chat.** Every shared event has a Chat tab, like a group chat. Names show their role, for example `Rohit (Treasurer)` and `Ronit (Member)`.
  - People who join later can read the whole history ("Load older messages" pages back 40 at a time).
  - Edit or delete your own message within 2 hours of sending. Organizer and managers can delete any message.
  - The chat is deleted together with the event.
  - Long messages are compressed to save space; the unread dot and alerts keep Firestore reads low.
- **Task descriptions.** Add a brief when you create a task (or later with "+ Brief"). It is folded by default; tap "Brief" to open or close it. Assignees see it in My tasks too.
- **Animated logo loader** while the app starts, on the app, sign-in and payment pages, so the first screen never looks blank.
- Roles, payment links and sign-in work as before.

## Build the APK
### Option A: no installs, GitHub builds it for you
1. Create a new GitHub repository and upload everything in this folder (keep the .github and scripts folders; the 3.6.1 files are all under www/ and need no workflow change).
2. **One time only:** create the permanent signing key (see "APK updates and signing" below). Without it the build stops with a clear error.
3. Open the Actions tab, pick "Build APK", click Run workflow (it also runs on every push to main).
4. When it finishes (about 5 minutes), download "campus-events-apk" from the run page and unzip it.
5. Copy campus-events-vX.Y.Z.apk to your phone and open it. Allow "Install unknown apps" if asked. Over an older version it shows "Update", not "Install".

### Option B: build on your computer
Needs Node 20, JDK 17 and Android Studio.

    npm install
    npx cap add android
    npx cap sync android
    npx cap open android     (then Build > Build APK)

## APK updates and signing
Android installs a new APK **over** the installed app only when all three are true:
1. same package name (`com.campus.events`),
2. signed with the **same key** as the installed app,
3. a **higher `versionCode`** than the installed app.

If any one fails, the phone shows "App not installed as package conflicts with an existing package", "package already installed" or just refuses the update.

### What was wrong and what changed
- The old workflow printed only a warning when the signing key was missing and carried on, so that build got a **random key**. Every build with a random key is a different "developer" to Android and can never update the previous one. It now **stops with an error** instead.
- The key was found only through the hidden default path `~/.android/debug.keystore`. `scripts/patch-android.sh` now writes the key path into `android/app/build.gradle` explicitly.
- `versionCode` used GitHub's `run_number`, which does not rise on a re-run and restarts at 1 in a new or copied repository, so a new APK could look older than the installed one. It is now the number of minutes since 1970: it always goes up.
- After building, the workflow runs `apksigner` and **fails if the APK is not signed with the permanent key**. The run summary shows the certificate fingerprint and the version code, so you can compare builds.

### One-time setup of the permanent key
1. Choose a long passphrase and **save it somewhere safe** (password manager). If it is lost, the key is lost.
2. GitHub repository > Settings > Secrets and variables > Actions > New repository secret. Name: `KEYSTORE_PASSPHRASE`, value: your passphrase.
3. Actions > **Create signing key (run once)** > Run workflow. It adds `signing/debug.keystore.gpg` (encrypted) to the repository. It refuses to overwrite an existing key. Never delete this file or change the secret afterwards.
4. Actions > **Build APK** > Run workflow. In the run page, open the summary and note the **signing certificate SHA-256**. It must be the same on every later build.

### One-time cleanup of the phone (only if updating already fails)
An app installed from a build that used a random key (or a different key) can never be updated. Remove it once, then install the new APK:
1. Optional: open the app and make sure your events are synced (shared events live in Firebase; events kept only on that phone are lost on uninstall).
2. Long-press the app > Uninstall (or Settings > Apps > Campus Events > Uninstall). If you use several profiles or a work profile, uninstall it in each.
3. Install the new `campus-events-vX.Y.Z.apk`.
4. From now on every APK from this repository installs as an **update** and keeps your data.

### Checks and troubleshooting
| What you see | Cause and fix |
| --- | --- |
| Build fails at "Restore permanent signing key": secret missing | Add `KEYSTORE_PASSPHRASE` (step 2 above), then run the build again. |
| Build fails: `signing/debug.keystore.gpg is missing` | Run "Create signing key (run once)". |
| Build fails: `gpg: decryption failed` | The secret does not match the passphrase used to create the key. Put back the original passphrase. If it is lost, delete `signing/debug.keystore.gpg`, set a new secret, run "Create signing key" again, and do the phone cleanup above once. |
| Build fails: `APK is NOT signed with the permanent key` | Something overrode the signing config. Check that `scripts/patch-android.sh` ran. |
| Phone still says package conflict | The installed app was signed with a different key. Do the phone cleanup once. |
| Phone says it cannot downgrade | The installed app has a higher `versionCode` than this APK (for example it came from a build made by someone else). Uninstall once. |
| Check from a computer (USB debugging on) | `adb shell dumpsys package com.campus.events | grep -E "versionCode|versionName"` shows the installed version. |

Notes: the app version people see (`APP_VERSION` in www/ui.js) and Android's `versionCode` are separate. Bump `APP_VERSION` for what users read; `versionCode` is set automatically on every build. If you build on your computer (Option B), make sure the same key is used, otherwise that APK cannot update one built by GitHub.

## Set up Firebase, chat and the website
Follow **SETUP.md** (Firebase project, rules, GitHub Pages, and the upgrade steps: **"Upgrade to 3.5.0" (new rules, self-registration, QR tickets, sponsors: read this one first)**, "Upgrade to 3.4.0" (new event page, files only), "Upgrade to 2.0.0" (chat), "Upgrade to 3.1.0" (expenses, payment-link expiry, tagging) **"Upgrade to 3.2.0" (email-code sign-up)** and **"Upgrade to 3.3.0" (Google sign-in)**, **"Upgrade to 3.6.0"** (spreadsheet import, link names, cash or UPI) and **"Upgrade to 3.6.1"** (more roles, custom roles, Help & guides: republish the rules)).

## Files
| Path | What it does |
| --- | --- |
| www/index.html | Main app shell: dashboard, event list, event form, registration actions |
| www/event.js | The event page: header, tab bar, Details, Attendees and the Team maker (3.4.0); Income tab, Scan and Ticket buttons (3.5.0) |
| www/signup.js | Online registration, organizer side: open/close, link and QR, review applications, approve, waitlist (new in 3.5.0). 3.6.0: custom link name, page customisation, cash/UPI on applications |
| www/register.html | The public self-registration page (new in 3.5.0). 3.6.0: link names, themes, UPI or cash with collector drop-down |
| www/scan.js | QR tickets, ticket window and the ticket scanner (new in 3.5.0) |
| www/ticket.html | A person's QR ticket page, opened from a link (new in 3.5.0) |
| www/income.js | Income tab, sponsors, break-even, CSV and ZIP export (new in 3.5.0) |
| www/sheet.js | Reads CSV, TSV, XLSX and ODS files in the browser, no library (new in 3.6.0) |
| www/import.js | Import pre-registered attendees: column matching, checks, skipped-rows CSV (new in 3.6.0) |
| www/payment.js | Cash or UPI, cash collectors, "Cash and UPI at a glance", payment block of the Register form (new in 3.6.0) |
| www/calc.js | Calculator, change, cash count and split for the event desk (new in 3.6.0) |
| www/404.html | Turns short registration links `/r/<name>` into `register.html?r=<name>` (new in 3.6.0) |
| www/vendor/jsQR.js | QR decoder for browsers without BarcodeDetector. Apache-2.0, see vendor/jsQR.LICENSE.txt (new in 3.5.0) |
| www/event.css | Styles for the event page: tabs, lists, status pills, budget cards (new in 3.4.0) |
| www/sync.js | Firebase sign-in, live sync, alerts. 3.5.0: staff-only money document, one entry per attendee, one-time conversion of old events |
| www/app2.js | Roles and permissions (built-in and custom, 3.6.1), Tasks, People with the custom roles card, Payments (money in) and payment-link expiry |
| www/help.js | Help & guides panel: every explanation that used to sit in the tabs, searchable, opened from the profile icon menu (new in 3.6.1) |
| www/expenses.js | Expenses & Budget (budget, bills, vendors) and the Items to buy list shown in Tasks (3.1.0, redesigned in 3.4.0) |
| www/chat.js | Event chat, @tagging, full-screen layout |
| www/ui.js | Menu bar, profile menu (Account, Help & guides, Theme, About), themes, version control. `APP_VERSION` lives here |
| www/splash.css, www/splash.js | Animated logo loader (new in 2.0.0) |
| www/login.html, www/pay.html | Sign-in and sign-up page (Google button; email sign-up asks for an emailed code), public payment page |
| www/firebase-config.js | Your Firebase keys, plus `OTP_API` (address of the OTP Worker) and the optional `TURNSTILE_SITE_KEY` |
| worker/otp-worker.js | Free Cloudflare Worker: emails the code, checks it, creates the account (new in 3.2.0). Never uploaded to the website; paste it into Cloudflare |
| worker/wrangler.toml | Optional settings file, only if you deploy from the command line |
| .github/workflows/build-apk.yml | Builds the APK with the permanent key, sets the version, verifies the signature |
| .github/workflows/create-signing-key.yml | Run once: creates and encrypts the permanent key |
| scripts/patch-google-signin.sh | Turns on the Google libraries in the generated Android project and writes `google-services.json` from the `GOOGLE_SERVICES_JSON` secret (new in 3.3.0) |
| .github/workflows/show-key-fingerprint.yml | Run once: prints the SHA-1 of your permanent key for Firebase (new in 3.3.0) |
| .npmrc | Stops npm from downloading an unused copy of the `firebase` package (new in 3.3.0) |
| scripts/patch-scanner.sh | Adds the camera permission and the scanner meta-data to the generated Android manifest (new in 3.5.0) |
| scripts/patch-android.sh | Writes the signing key path and an ever-increasing versionCode into the generated Android project |
| signing/debug.keystore.gpg | Your encrypted permanent key. Never delete it |
| firestore.rules | Security rules (3.6.1: permission lists for the five new roles and custom roles, `croles`; 3.6.0: link names in `regslugs`, cash fields on applications; 3.5.0: field limits per role, staff-only money document, public registration pages; 3.3.0: only confirmed emails). Paste into Firebase console > Firestore > Rules |

## Notes
- **Google sign-in and the confirmed-email rule (3.3.0).** `firestore.rules` has one switch, `requireVerifiedEmail()`, set to `true`. Leave it on. Turning it off while Firebase's public sign-up is on lets bots create accounts that can use your free Firestore quota.
- **Google sign-in in the APK needs three things to line up:** the SHA-1 of your permanent key registered in Firebase, the Android app registered with package name `com.campus.events`, and the `GOOGLE_SERVICES_JSON` secret downloaded *after* the first two. Phones without Google Play services cannot use the Google button (email sign-in still works).
- Event data is cached on the phone and synced through Firebase. Chat and payment links need a shared event.
- Since 3.5.0 the budget, vendors, bills, donations and sponsors live in a separate document that only organizer, manager and treasurer can read (see above). Items to buy, tasks, attendees and payment links are still in the event document, which every member can read, so do not share an event code with people you do not trust with attendee details.
- **Sign-up codes and free limits.** Brevo's free plan sends 300 emails a day, so at most about 300 codes a day (a resend is another email). Cloudflare's free plan is 100,000 requests a day and 1,000 stored writes a day; each code request uses 2 of those writes, so roughly 400 requests a day before it pauses. Nothing but sign-up is affected when a limit is reached: sign-in goes straight to Firebase.
- **What the code does and does not do.** It proves the person owns the email address and makes bulk sign-up slow and costly. It cannot stop someone who really owns many inboxes. Turn on the Turnstile captcha and `ALLOWED_EMAIL_DOMAINS` (for example your college domain) in the Worker for stronger protection.
- Keep the Firebase service-account key and the Brevo key only as Cloudflare secrets. Never put them in this repository. The `worker/` folder is not part of the website or the APK.
- The APK is a debug build for sideloading, signed with your permanent key so it updates in place. For Play Store, create a separate signed release build.
- To change the app, edit the files in www/, push to GitHub, and the workflow rebuilds the APK. Bump `APP_VERSION` in www/ui.js on every release.
