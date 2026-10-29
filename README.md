<div align="center">
  <img src="brand/logo.svg" alt="Campus Events app icon" width="116" height="116" />
  <h1>Campus Events</h1>
  <p><strong>Plan together. Run events smoothly.</strong></p>
  <p>A practical event-management app for campus teams — from registration and QR check-in to tasks, payments, budgets, sponsors and team chat.</p>

  <p>
    <a href="https://downloadcem.deba.indevs.in/">
      <img src="https://img.shields.io/badge/Download_for_Android-Get_the_app-5948F5?style=for-the-badge&logo=android&logoColor=white" alt="Download Campus Events for Android" />
    </a>
    &nbsp;
    <a href="https://cem.deba.indevs.in/">
      <img src="https://img.shields.io/badge/Open_Web_App-Launch_CEM-10172B?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Open Campus Events web app" />
    </a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/Platform-Android%20%7C%20Web-5948F5?style=flat-square" alt="Android and Web" />
    <img src="https://img.shields.io/badge/Backend-Firebase-FFB547?style=flat-square&logo=firebase&logoColor=10172B" alt="Firebase" />
    <img src="https://img.shields.io/badge/License-See%20LICENCE-35C9A5?style=flat-square" alt="Licence information" />
  </p>
</div>

---

## Overview

Campus Events (CEM) brings the moving parts of a campus event into one place. Create an event, invite your team, organise responsibilities, manage registrations and keep track of money without switching between multiple tools.

### Everything your event team needs

| | Feature | What you can do |
|:---:|---|---|
| 📝 | **Registration** | Publish a registration page, share a link or QR code, review applications and manage a waitlist. |
| 🎟️ | **QR tickets & check-in** | Issue designed ticket pictures (Gradient or Flat look, one QR code), scan at the gate and check attendees in — including offline check-in after the event is opened online. |
| ✉️ | **Email attendees** | Three simple steps: see who has and has not been emailed, write the message, then send. Choose a **ticket** (each attendee gets their own designed ticket PNG with a QR code) or a plain **invitation** for events that need no ticket. Send from your own mailbox, through your device's mail app, or automatically with Gmail, Outlook, Yahoo, Zoho or Brevo (SMTP). |
| ✅ | **Tasks & shopping list** | Assign tasks, set due dates, organise task groups and track items to buy. |
| 👥 | **Roles & teams** | Work with organisers, managers, volunteers and custom roles with configurable permissions. |
| 💳 | **Payments** | Track cash and UPI payments, review payment-link submissions and verify transactions. |
| 📊 | **Budget & expenses** | Manage income, sponsors, vendors, bills and break-even estimates. |
| 💬 | **Event chat** | Keep event-related conversations and mentions with the team. |
| 📤 | **Data export & import** | Export event records and import attendee lists from supported spreadsheet formats. |

## Get started

### Use the app

- **Android:** [Download Campus Events](https://downloadcem.deba.indevs.in/) — download the APK from the official download page. If Android asks, allow your browser to install unknown apps, then open the downloaded file and install it.
- **Web:** [Open Campus Events](https://cem.deba.indevs.in/).

### Create or join an event

1. Sign in with Google or with an email and password. A six-digit email code confirms a new email account.
2. Choose **New event**, enter the event details and publish it.
3. To collaborate, open the event and select **Details → Share with team**. Copy the six-letter event code.
4. Teammates can join using the join option under the profile menu. New joiners start as **Member**; an Organizer or Manager can update roles in **People**.

The top menu includes **Dashboard**, **Events**, **My tasks** and **New event**. Events that are not shared stay on your device.

## User guide

For the searchable in-app guide, open the profile menu and choose **Help & guides**.

### Event tabs

**Income** and **Expenses** appear only for roles that have the **Money** permission. A number shown on a tab means something needs attention.

#### Details

View the event date, venue, description, event code and your role. Use **Export data** to export attendees, payments, bills and sponsors as CSV, or all available data as a ZIP. Depending on your permissions, you can edit or delete the event, or leave it. The calculator button beside the event name is available on every tab.

#### Attendees and registration

The Attendees area has two views: **Attendees** and **Registration**.

**Attendees**

- **Register attendee** opens a short form that is ready for the next person after saving. A duplicate College ID or a full event is rejected.
- Search and filter attendees by all, not checked in, checked in and — where ticket prices apply — unpaid or cash due.
- Check in with one tap and use **Undo** to reverse it. The attendee's **…** menu includes **Ticket (QR)**, **Mark paid**, payment mode, collector and **Remove registration**.
- On Android, ticket scanning uses Google's scanner. On the website, use the camera or enter a ticket code or College ID. A used ticket shows when and by whom it was checked in. Unpaid fees can be marked paid from the scan flow.
- For offline check-in, open the event once with internet before the gate opens. Scans can then work offline and synchronise when the device is online again.
- **Email attendees** (Attendees tab) is a three-step window: **People** (the *Not emailed*, *Emailed* and *No email* lists), **Message** (write or edit it; the **Send a ticket with a QR code** box is ticked by default, untick it for a plain invitation) and **Send**. **This device's mail app** opens your default mail app pre-filled for each person; **My email account (automatic)** sends everything for you after you tap your provider (Gmail, Outlook, Yahoo Mail, Zoho, Brevo or Other) and enter your login, which stays on your device. Available to every role with *Attendees and check-in*; setup is in **Help & guides > Email attendees (tickets or invitations)**.
- Import attendees from CSV, TSV, Excel (`.xlsx`, `.xlsm`) or OpenDocument (`.ods`). The file is processed on your device, not uploaded. Match file columns to registration questions, review skipped rows and download them as CSV to fix and re-import. Old `.xls` and password-protected files are not supported. Limits: 8 MB, 5,000 rows and 60 columns.

**Registration**

- Choose **Open online registration** to generate a public link and QR code. Applicants can submit the form without an account. Review submissions under **Applications to review**, then approve or reject them.
- Only the email address is always required on the public form. The College ID, phone and all other questions follow the event's own form and its **Required** ticks, so outsiders without a College ID can register. The same email address cannot apply twice. When the event is full, applicants can join a waitlist; use **Promote** to move someone into an available place.
- Customise the public page with a link name (for example, `techfest-2026`), headline, welcome message, colours, banner image and closing time.
- Set the ticket price (use `0` for free), UPI ID, payee name, waitlist setting and a message for applicants. The ticket price is configured here, even before online registration opens.
- Choose event-team members as cash collectors, or enter the name of someone outside the app. Applicants paying online can select UPI or cash and, for cash, choose a collector. Mark a fee as paid only after receiving the cash or verifying the UTR.

#### Tasks

Create task groups, tasks and **Items to buy**. A task can include a title, assignee, due date and optional brief. Tick it off when complete. Shopping items can have a quantity, estimated cost, assignee and budget category; record the actual cost after purchase.

#### People

- View everyone who joined with the event code. Use **+ Add person** to add volunteers who do not use the app, including their name, title, phone number and reporting line.
- Organizers and Managers can change roles from the drop-down beside a person's name.
- Create a custom role with **+ New role**. Give it a name, optionally copy another role's permissions, select what it can do and choose **Create role**. Editing a role affects everyone assigned to it. A role can be deleted only when nobody holds it. Each event supports up to 12 custom roles.
- Create participant teams by name, or split attendees who are not assigned to a team into teams of a chosen size. Add or remove attendees from each team card.

#### Payments

Review payments submitted through payment links. Filter by **To check**, **Verified** or **Rejected**. Check each submission against your bank or UPI app before verifying or rejecting it.

#### Income

- **Break-even:** compare ticket revenue at capacity plus sponsorships with the budget, or with money already spent plus bills still to pay. Switch views with one tap to see how many tickets are needed.
- **Cash and UPI summary:** see how many attendees selected each cash collector, amounts received and amounts outstanding. **Show unpaid cash** opens the attendee list filtered to unpaid cash.
- **Sponsors and other income:** record pledged and received amounts, commitments and whether promised benefits have been delivered.
- **Payment links:** use **+ New link** to create a fee or donation link with a title, optional amount, UPI ID, payee and note. Payers scan the QR code and submit their name and UTR. Links stop working at the end of the event day by default; **Link settings** can keep them open for up to 30 extra days and stores your public site address. Link payments appear in the **Payments** tab.

#### Expenses

- **Budget:** choose a common category or enter a custom one with a planned amount.
- **Bills:** track vendor amounts due and paid. Overdue bills appear first. If a vendor has a UPI ID, use **Pay via UPI** to show a QR code, then mark the bill paid with the payment mode and UTR.
- **Vendors:** save contact information, UPI IDs, paid amounts and outstanding balances.

#### Chat

Chat is available in shared events. Type `@` to mention someone. You can edit or delete your own message within two hours. People who join later can read the full history.

### Roles and permissions

| Role | Main responsibilities |
|---|---|
| **Organizer** | Full access, including deleting the event. |
| **Manager** | Edits the event and manages people, roles, tasks, payments, expenses and budget. |
| **Treasurer** | Verifies payments; manages budget, bills, vendors and income; plus member capabilities. |
| **Team lead** | Creates task groups, assigns tasks and items to anyone, and checks in attendees. |
| **Coordinator** | Handles task groups, shopping items, attendees, check-in and volunteer lists. |
| **Registration desk** | Registers walk-ins, checks in attendees, scans tickets and marks fees paid. |
| **Logistics lead** | Manages task groups, tasks and shopping items assigned to anyone. |
| **Sponsorship lead** | Manages income, budget, bills and vendors. |
| **Member** | Completes own tasks, adds people who report to them and registers attendees. |
| **Volunteer** | Completes assigned tasks and joins the chat. |
| **Viewer** | Can read event information but cannot change it. |

Custom roles use the following permissions:

| Permission | Allows |
|---|---|
| **Tick off own tasks** | Mark assigned tasks as complete. |
| **Team member basics** | Complete own tasks, add direct reports and register attendees (without check-in). |
| **Manage tasks** | Manage task groups and tasks assigned to anyone. |
| **Items to buy** | Add shopping items and assign them to people. |
| **Volunteer list** | Add and remove people without an account and set reporting lines. |
| **Attendees and check-in** | Register, check in and scan attendees; mark fees paid; import attendee lists; manage participant teams. |
| **Edit event and registrations** | Edit event details, remove registrations and delete any chat message. |
| **Payments and online registration** | Verify payments; manage payment-link and UPI settings, online registration and cash collectors. |
| **Money** | Manage budget, vendors, bills, sponsors and payment links, and access Income and Expenses. |

Permissions are enforced by the database, not only by the interface. Changing roles, creating custom roles and deleting events cannot be delegated. A custom role with no permissions is read-only.

### Event desk calculator

The calculator button beside the event name provides four tools:

- **Calculator:** supports shop-style percentage calculations (`200 + 10%` gives `220`).
- **Change:** calculate the price multiplied by quantity, record the amount received and calculate the change to return.
- **Cash count:** compare the notes and coins in the cash box with the amount the app records as received.
- **Split:** divide a bill among people, rounding up to the rupee.

Calculator values stay on your device.

### Account settings

Open the profile menu to access:

- **Account, alerts & join event:** change your name, join an event, choose notifications, send changes to the event's free ntfy topic for phone alerts or sign out.
- **Help & guides:** open the searchable guide.
- **Terms & Conditions** and **Privacy Policy:** read how Campus Events works and how personal data is handled. Both are also linked from the sign-in page and at the bottom of the Account panel.
- **Theme:** switch between Auto, Light and Dark.
- **Update app** (Android app only): checks GitHub for a newer version, downloads it inside the app and installs it with Android's normal update screen. No download website needed.
- **About & updates:** view the installed version and check for updates.

## Important notes

- Events are cached on the phone and synchronise when you are online. Chat, payment links and online registration require an internet connection and a shared event.
- **“No permission”** means your role does not allow the action, or the latest `firestore.rules` have not been published in Firebase. Ask the Organizer or a Manager.
- Every event member can read the attendee list, including College IDs, phone numbers and email addresses. Share the event code only with people you trust with that information. Money data is restricted to roles with the Money permission.
- The public registration form does not have a rate limit. If it is flooded, close online registration or remove the applications.
- A QR ticket can be used by whoever holds it, but only once. A second scan displays a warning.
- Around 800 attendees per event is comfortable; 1,500 is the hard limit.

## For developers and maintainers

CEM runs as an Android app and a website. The project is designed to be publishable using the free plans of GitHub and Firebase.

| Resource | Purpose |
|---|---|
| [`SETUP.md`](./SETUP.md) | Publish the website, build the Android app and configure Firebase. |
| [`firestore.rules`](./firestore.rules) | Database-enforced permission rules; publish these rules to your Firebase project. |
| [`www/`](./www/) | Web app source code. |
| [`tutorials/`](./tutorials/README.md) | Animated how-to pages, published at `/tutorials/` on the website and not included in the app. Upload an `.html` file there and the tutorials page gets a new button. |
| [`brand/README.md`](./brand/README.md) | Brand assets, colour list and icon-generator details. |
| [`LICENCE`](./LICENCE) | Licence terms. |
| [`www/terms.html`](./www/terms.html) | The app's Terms & Conditions page. Update the date at the top when the terms change. |
| [`www/privacy.html`](./www/privacy.html) | The app's public Privacy Policy page (also the link Google asks for on the OAuth consent screen). Update the date at the top when it changes. |

The built-in role permissions must match in both `permsOf` in `firestore.rules` and `BASE` in `www/app2.js`.

Main application modules in `www/` include `event.js` (event page, attendees and participant teams), `signup.js` (online registration), `payment.js` (cash collectors and cash/UPI summary), `income.js` (income tab and exports), `app2.js` (roles, tasks, people, payments and payment links), `expenses.js`, `chat.js`, `scan.js`, `import.js` and `sheet.js` (spreadsheet import), `calc.js` and `help.js`. Public pages include `register.html`, `pay.html`, `ticket.html` and `login.html`.

Android launcher icons are copied into the APK build by `scripts/patch-icons.sh`. See the brand documentation for the project's logo, colours and icon generator.

---

<div align="center">
  <p><strong>Ready to organise your next campus event?</strong></p>
  <p>
    <a href="https://downloadcem.deba.indevs.in/">Download for Android</a>
    &nbsp;•&nbsp;
    <a href="https://cem.deba.indevs.in/">Open the Web App</a>
  </p>
  <sub>Campus Events · Organise better, together.</sub>
</div>
