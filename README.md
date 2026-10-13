# Campus Events (CEM)

Plan a campus event with your team: registrations, tasks, roles, QR tickets and check-in, online registration, cash or UPI fees, payment links, a budget with bills and vendors, sponsors, and a chat inside every event.

CEM runs as an Android app and as a website, on the free plans of GitHub and Firebase. To publish your own copy, follow **SETUP.md**.

This page explains how to use the app. Inside the app, tap your **profile icon (top right) > Help & guides** for the same guide with search.

---

## 1. Getting started

1. **Sign in** with Google, or with an email and password (a 6-digit code emailed to you confirms a new email account).
2. **Create an event:** *New event* in the top menu. Fill in the name, type, date, venue, capacity and description. Tap **Load form for this type** for a ready-made registration form, then add, remove or rename questions. Tap **Publish event**.
3. **Work with a team:** open the event > **Details** > **Share with team**. You get a 6-letter event code. Events you do not share stay on your device.
4. **Join an event:** use the join option under your profile icon (Account, alerts & join event) and enter the code. New people join as **Member**; the Organizer or a Manager changes the role in the **People** tab.

The top menu has **Dashboard**, **Events**, **My tasks** (everything given to you, across all your events) and **New event**.

---

## 2. The event tabs

**Income** and **Expenses** appear only for roles with the Money permission. A number on a tab means something needs a look.

### Details
Date, venue, description, event code, your role, **Export data** (attendees, payments, bills and sponsors as CSV, or everything as one ZIP), and **Edit event** / **Delete event** (or **Leave event**). The calculator button next to the event name opens on every tab.

### Attendees
Two views, switched by the buttons at the top.

**Attendees**
- **Register attendee** opens a short form, ready for the next person after each save. A College ID that is already registered is refused, and so is a full event.
- **Search and filters:** All, Not checked in, Checked in, and, when there is a ticket price, Unpaid and Cash due.
- **Check in** is one tap; **Undo** reverses it. The **...** menu on an attendee has **Ticket (QR)**, **Mark paid**, the payment mode and collector, and **Remove registration**.
- **Scan tickets:** in the Android app it uses Google's scanner; on the website it uses the camera, or you can type a ticket code or College ID. A used ticket shows when and by whom. An unpaid fee shows a one-tap **Mark as paid**. Open the event once with internet before the gate opens: scanning then works offline and check-ins are sent when you are back online.
- **Import pre-registered attendees:** choose a CSV, TSV, Excel (`.xlsx`, `.xlsm`) or OpenDocument (`.ods`) file. It is read on your device and never uploaded. Your columns are matched to the registration form by name, and you can change every match. Before anything is saved you see how many rows are ready and how many are skipped and why; **Download skipped rows** gives a CSV to fix and import again. Old `.xls` and password-protected files are not supported. Limits: 8 MB, 5,000 rows, 60 columns.

**Registration**
- **Online registration:** **Open online registration** gives you a link and a QR code. People fill in your form without an account. Applications wait under **Applications to review**: **Approve** or **Reject**. The same College ID cannot apply twice. When seats are full people join a **waitlist**; **Promote** moves them in.
- **Customize page and link:** a link name (for example `techfest-2026`), headline, welcome text, colours, banner image and a closing time.
- **Price and settings:** the **ticket price** (0 is free), UPI ID, payee name, waitlist on or off, and a message on the page. This is the only place the ticket price is set, and it works before you open registration too.
- **Cash collectors:** pick people from the event team, or type a name for someone outside the app (such as a faculty coordinator). When the ticket has a price, people registering online choose **UPI** or **Cash**, and for cash they pick the collector. Nothing is marked paid on the applicant's word: tick **Paid** on the attendee after you have the cash or have checked the UTR.

### Tasks
Task groups, tasks and **Items to buy**. Add a task with a title, a person, a due date and an optional brief. Tick the box when done. Items to buy have a quantity, an estimated cost, a person and a budget category; when bought, enter what it really cost.

### People
- Everyone who joined with the code, plus **+ Add person** for volunteers who do not use the app (name, title, phone, who they report to).
- **Roles:** change a person's role with the drop-down next to their name (Organizer and Managers only).
- **Custom roles:** **+ New role**, give it a name, optionally copy permissions from another role, tick what it may do, **Create role**. Editing a role changes everyone who holds it; a role can be deleted only when nobody holds it. Up to 12 per event.
- **Participant teams:** create a team by name, or split the attendees who are not in a team into teams of a size you choose. Add or remove members on each team card.

### Payments
Money that people have sent through payment links. Filter by To check, Verified or Rejected. Check each payment against your bank or UPI app, then **Verify** or **Reject**.

### Income
Everything coming in, next to what the event costs.
- **Break-even:** ticket price x seats plus sponsorship, against your budget (or what you have spent plus still have to pay; one tap switches). It tells you how many tickets you need.
- **Cash and UPI at a glance:** for each cash collector, how many attendees chose them, what is received and what is still to collect; the same for UPI. **Show unpaid cash** opens the attendee list filtered to unpaid cash.
- **Sponsors and other income:** for each one, what was committed, what has arrived, what you promised in return, and whether it is delivered.
- **Payment links:** **+ New link** creates a link for a fee or donation (title, optional amount, UPI ID, payee, note). Anyone with the link pays by scanning the QR code and sends their name and UTR on the page. A link stops working at the end of the event day; **Link settings** keeps links open for up to 30 extra days and saves your public site address (for example `https://yourname.github.io/your-repo/`). Payments from links appear in the **Payments** tab.

### Expenses
- **Budget:** tap a common category or type your own, with a planned amount.
- **Bills:** money you owe vendors, or have paid. Overdue ones come first. For a vendor with a UPI ID, **Pay via UPI** shows a QR code, then **Mark paid** with the mode and UTR.
- **Vendors:** contact, UPI ID, what you have paid and still owe.

### Chat
Works in shared events. Type **@** to tag someone. You can edit or delete your own message within 2 hours. People who join later can read the whole history.

---

## 3. Roles

| Role | What it is for |
| --- | --- |
| **Organizer** | Everything, including deleting the event |
| **Manager** | Edits the event and manages people, roles, tasks, payments, expenses and the budget |
| **Treasurer** | Verifies payments and manages the budget, bills, vendors and income, plus everything a member can do |
| **Team lead** | Creates task groups, assigns tasks and items to anyone, checks in attendees |
| **Coordinator** | Runs the day: task groups, items to buy, attendees and check-in, the volunteer list |
| **Registration desk** | Registers walk-ins, checks in, scans tickets and marks fees paid |
| **Logistics lead** | Task groups, tasks and items to buy, given to anyone |
| **Sponsorship lead** | Income, budget, bills and vendors |
| **Member** | Ticks their own tasks, adds people who report to them and registers attendees |
| **Volunteer** | Ticks off the tasks given to them and joins the chat |
| **Viewer** | Reads the event but cannot change it |

A custom role is built from these permissions:

| Permission | Allows |
| --- | --- |
| Tick off own tasks | Mark the tasks given to them as done |
| Team member basics | Tick own tasks, add people who report to them, register attendees (no check-in) |
| Manage tasks | Task groups and tasks, given to anyone |
| Items to buy | Add items to buy and give them to people |
| Volunteer list | Add and remove people without an account, set who reports to whom |
| Attendees and check-in | Register, check in, scan tickets, mark fees paid, import a list, participant teams |
| Edit event and registrations | Edit the event details, remove registrations, delete any chat message |
| Payments and online registration | Verify payments, payment link settings, UPI settings, online registration, cash collectors |
| Money | Budget, vendors, bills, sponsors, payment links, and the Income and Expenses tabs |

The database enforces these permissions, not just the buttons. Changing roles, making custom roles and deleting the event cannot be handed out. A custom role with nothing ticked can only read.

---

## 4. Calculator for the event desk

The calculator button next to the event name has four tools: **Calculator** (`200 + 10%` gives 220, like a shop calculator), **Change** (price x quantity, notes received, change to give back), **Cash count** (notes and coins in the box against the cash the system says was received) and **Split** (share a bill, rounded up to the rupee). Values stay on your device.

---

## 5. Your account

Tap your **profile icon**:
- **Account, alerts & join event:** change your name, join an event, choose what you are notified about, send changes to the event's free ntfy topic for phone alerts, sign out.
- **Help & guides:** the searchable guide.
- **Theme:** cycles Auto, Light and Dark.
- **About & updates:** shows the installed version and checks for a newer one.

---

## 6. Good to know

- Your events are cached on the phone and sync when you are online. Chat, payment links and online registration need a connection and a shared event.
- **"No permission"** means your role does not allow that action, or the latest `firestore.rules` have not been published in Firebase. Ask the Organizer or a Manager.
- Every member can read the attendee list, including College IDs, phones and emails. Share the event code only with people you trust with those details. Money data is visible only to roles with the Money permission.
- The public registration form has no rate limit. If someone floods it, close online registration or remove the applications.
- A QR ticket works for whoever holds it, once; a second scan shows a warning.
- About 800 attendees per event is comfortable; 1,500 is the hard limit.

---

## 7. For whoever maintains the app

- **SETUP.md** explains how to publish the website, build the Android app and set up Firebase.
- **firestore.rules** must be published in your Firebase project; it holds the permission rules.
- The permission list of each built-in role exists in two places and must match: `permsOf` in `firestore.rules` and `BASE` in `www/app2.js`.
- App code is in `www/`: `event.js` (event page, Attendees, participant teams), `signup.js` (online registration), `payment.js` (cash collectors and the cash and UPI summary), `income.js` (Income tab and exports), `app2.js` (roles, tasks, people, payments, payment links), `expenses.js`, `chat.js`, `scan.js`, `import.js` and `sheet.js` (spreadsheet import), `calc.js`, `help.js`. The public pages are `register.html`, `pay.html`, `ticket.html` and `login.html`.

Licence: see `LICENCE`.
