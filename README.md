<div align="center">
  <img src="brand/logo.svg" alt="Campus Events" width="96" height="96" />
  <h1>Campus Events</h1>
  <p><strong>Plan together. Run events smoothly.</strong></p>
  <p>
    <a href="https://downloadcem.deba.indevs.in/">Download for Android</a> ·
    <a href="https://cem.deba.indevs.in/">Open web app</a>
  </p>
</div>

A simple event-management app for campus teams: registrations, QR tickets and check-in, tasks, payments and budgets in one place.

## What it does

- **Registration:** online sign-up page, link or QR code, waitlist and approvals.
- **Tickets & check-in:** QR tickets, scan at the gate, works offline once the event is open.
- **Email:** send each attendee a ticket or an invitation.
- **Tasks & team:** task groups, shopping list, roles and permissions, event chat.
- **Money:** cash and UPI payments, income, bills, vendors and budget.
- **Export & import:** CSV / ZIP export, attendee import from spreadsheets.

## Using the app

1. Sign in with Google or email.
2. Tap **New event**, fill in the details and publish.
3. Open the **menu** (top left). With an event open, the side panel has everything for it:

| Group | Sections |
|---|---|
| Event | Details |
| Attendees | All attendees, Check-in, Add attendee, Email attendees, Online sign-ups |
| Team | Tasks, People, Chat |
| Money | Payments, Income, Budget, Bills, Vendors |

Without an event open it shows Dashboard, Events, My tasks and New event. To work as a team, share the 6-letter event code from **Details** so others can join.

## Build & run

Plain HTML/JS in `www/`, Firebase for sign-in and sync, Capacitor for the Android app. The APK is built by GitHub Actions (**Actions → Build APK**). Full setup steps are in [SETUP.md](SETUP.md).

## Licence

See [LICENCE](LICENCE).
