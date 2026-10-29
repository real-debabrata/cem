# Campus Events: shared version setup

## 1. Firebase (free Spark plan, no card)
1. console.firebase.google.com > Add project > "Campus Events".
2. Project home > web icon (</>) > register an app. Copy the firebaseConfig values.
3. Build > Authentication > Get started > enable Email/Password. (From 3.3.0 also enable Google: see "Upgrade to 3.3.0".)
4. Build > Firestore Database > Create database > pick a nearby location > Production mode.
5. Firestore > Rules tab > paste the contents of firestore.rules > Publish.

## 2. Add your config
Open www/firebase-config.js and replace the placeholder values with yours.

## 3. Upload and build
1. Create a GitHub repository and upload this whole folder (keep the .github folder).
2. Actions > "Build APK" > Run workflow. Download the APK artifact when it finishes.
3. For the web version: Settings > Pages > Source: GitHub Actions, then Actions > "Deploy web version" > Run workflow.
4. Firebase console > Authentication > Settings > Authorized domains > add yourusername.github.io.

## 4. Use it
- Everyone creates an account (name, email, password) and confirms it with a 6-digit code emailed to them (3.2.0 and later, see "Upgrade to 3.2.0"). Signing in never asks for a code.
- The organizer opens an event and taps "Share with team" to get a 6-letter code.
- Members tap Team > Join an event and enter the code.
- Team > "Notify me about" controls which alerts you get.

## Notes
- Alerts appear while the app is open or recently in the background. Android may stop a swiped-away app.
- For alerts to a closed app, turn on the ntfy option and have members install the free ntfy app and subscribe to the topic shown on the event page.
- Any member can edit the event. Only the organizer can delete it; other members leave it instead.
- Spark limits: 50K reads and 20K writes per day. If a cap is hit, writes pause until the next day.

## IMPORTANT: activate the workflows (one-time, 2 minutes)
GitHub only runs workflows from a folder named ".github/workflows". Dot-folders are hidden on many computers, so this zip ships it as "github/workflows". After uploading to GitHub, for EACH of the two files (build-apk.yml and pages.yml):
1. Open the file in your repository (github/workflows/...).
2. Click the pencil icon (Edit).
3. In the file name box at the top, change the path from "github/workflows/build-apk.yml" to ".github/workflows/build-apk.yml" (add the dot in front of github).
4. Click Commit changes.
Then the Actions tab will show "Build APK" and "Deploy web version".

## Public payment links (update)
1. Firestore > Rules: paste the new firestore.rules and Publish (required, the old rules block payment pages).
2. Replace/add in www/: app2.js, sync.js, pay.html (and firebase-config.js if you set PAY_BASE).
3. Run "Deploy web version" so pay.html goes live, then rebuild the APK.
4. In the app: Event > Payments > Create a payment link > copy or share the link. Payers need no account.
5. Old payment forms made before this update have no public page. Delete and recreate them.

## Sign-in page (update)
- login.html is now a separate sign-in and sign-up page. The app (index.html) redirects there until you sign in.
- Sign-in sticks on the device, so the app opens and works offline afterwards. The first sign-in needs internet.
- Update these files in www/: index.html, sync.js, app2.js, and add login.html. Firestore rules are unchanged.

## Upgrade to 2.0.0: event chat, task descriptions, loading screen

### Files to upload
In `www/` replace: index.html, sync.js, app2.js, ui.js, login.html, pay.html.
In `www/` add (new): chat.js, splash.css, splash.js.
In the repo root replace: firestore.rules, package.json, README.md, SETUP.md.
Delete `www/firestore.rules` if you still have it. It is an old, outdated copy; the real one is `firestore.rules` in the repo root.

### Set up the chat, free (about 10 minutes)
Chat reuses the Firebase project, sign-in and Firestore database you already have. There is nothing to buy or switch on: no Blaze plan, no card, no Cloud Functions, no Storage.
1. Open console.firebase.google.com > your project > Build > Firestore Database > Rules.
2. Select everything in the editor, paste the new `firestore.rules` from the repo root, click Publish. (Skip this and the Chat tab shows "Could not load messages (permission-denied)".)
3. No index is needed. Firestore creates the one the chat uses on its own.
4. Upload the files above to GitHub and commit to main. The "Build APK" workflow runs by itself. For the website, run Actions > "Deploy web version" > Run workflow.
5. Optional: in Firestore > Data > appconfig > version, set `latest` to 2.0.0 (and `notes`) so phones with an older APK get the update banner.
6. Test it:
   - Open a shared event > Chat tab > send a message.
   - Sign in on a second device or browser, join with the event code, open Chat. The old messages are there.
   - Tap one of your messages > Edit or Delete. After 2 hours these buttons disappear, and Firestore refuses the change as well.
   - Delete a test event, then check Firestore > Data: the event and its `chat` messages are both gone.

### How the chat works
- Messages live in Firestore at `events/{code}/chat/{message}`. The rules reuse the event's member list, so only members can read or write, and viewers can read but not post.
- Each message stores only: sender id (`u`), name (`n`), text (`t`), server time (`at`), and `ed` when edited. The name must match the member's name in the event and the time is set by the server, so nobody can impersonate or back-date.
- Roles in brackets are read live from the event's member list, so they update when a role changes.
- Messages of 120+ characters are deflate-compressed and stored as bytes when that saves at least 15%. Short messages stay plain text because compressing them would make them bigger.
- Deleting an event: Firestore does not remove sub-collections on its own, so the organizer's app deletes the chat messages first and then the event. If that fails (for example no internet), the event comes back so you can delete it again.
- Alerts: with the Chat tab closed, the app watches only the newest message of each event to show an unread dot and a notification. Under Team > "Notify me about", "Chat messages" turns these on or off. If the ntfy option is on, a "new chat message from NAME" ping (never the message text) is also sent to the event's ntfy topic for closed apps.
- To show "Cashier" instead of "Treasurer", change `treasurer:'Treasurer'` to `treasurer:'Cashier'` on the second line of `www/app2.js`.

### Free-plan budget (Spark: 50,000 reads, 20,000 writes, 20,000 deletes per day, 1 GiB stored)
- Opening a chat reads up to 40 messages. "Load older messages" reads up to 40 more each time.
- Each message sent is 1 write. Every member whose app is open reads it once, so reads are about `messages x active members`.
  Example: 20 members and 150 messages in a day is about 150 writes and 3,000 reads.
- Security rule checks also count as reads. Reads and writes are the limit to watch, not storage: 1 GiB holds millions of short messages.
- Deleting an event with a long chat costs one read and one delete per message.
- If a daily limit is reached, the affected action pauses until the quota resets. Watch Firebase console > Firestore > Usage.

### Task descriptions
- Create a task with the optional "Description for the assignee" box, or tap "+ Brief" on an existing task.
- The brief is folded to save space. Tap "Brief" to open or close it. The task's creator, team leads, managers and the organizer can edit it ("Edit brief").
- The assignee sees it under Tasks and under My tasks. Max 600 characters.

### Loading screen
- The animated logo shows on index.html, login.html and pay.html while the page boots, for at least about 1.2 seconds on the first open and 0.5 seconds after.
- Look and timing: `www/splash.css` and `www/splash.js` (the `MIN` value).

## Upgrade to 3.1.0: expenses, payment-link expiry, name change, chat tagging

Everything stays on the free Spark plan. There is no new service, no Cloud Functions, no Blaze plan and no card.

### Files to upload
In `www/` replace: index.html, sync.js, app2.js, chat.js, ui.js, pay.html.
In `www/` add (new): expenses.js.
In the repo root replace: firestore.rules, package.json, README.md, SETUP.md.
Not changed: login.html, splash.css, splash.js, firebase-config.js, vendor/, the workflows.

### Steps (about 10 minutes)
1. **Publish the new rules first.** Firebase console > Firestore Database > Rules > select everything, paste the new `firestore.rules` from the repo root > Publish. The new rules do three things: members can tag members in chat, payment links carry an expiry (`until`) and stop working when it passes or the event is gone, and payers cannot submit to a dead link.
2. **Upload the files** above to GitHub and commit to main. The "Build APK" workflow starts by itself and builds 3.1.0 (the version comes from `APP_VERSION` in www/ui.js).
3. **Deploy the website.** Actions > "Deploy web version" > Run workflow. This puts the new `pay.html` (the "link expired" message) and the web app live.
4. **Tell the app a new version exists.** Firebase console > Firestore > Data > `appconfig` > `version`: set `latest` to `3.1.0` and add `notes`. Also set `min` to `3.1.0` if you want to block old APKs: from step 1 on, a 2.x app can no longer create payment links (the rules now require the expiry that only 3.1.0 writes).
5. **Open the new app once as the organizer (or treasurer).** Payment links made before 3.1.0 have no expiry, so they would stay open forever. The app stamps the expiry on them automatically the first time an organizer, manager, treasurer or the link's creator opens it (one read per old link, once per device). Check one in Firebase console > Firestore > Data > `payforms` > a document > field `until`.
6. **Test it** (use a test event):
   - *Name*: avatar menu > Account, alerts & join event > change "Your name" > Save. The avatar letter, the People table and new chat messages use the new name on every device.
   - *Close buttons*: the account / alerts panel, the join popup (avatar menu or "Join team") and the About popup each have a ✕. The account panel also closes with Esc or a tap outside.
   - *Chat scrolling*: open a shared event > Chat. The page no longer scrolls; the message list does. Open the keyboard, type, and have someone send a message from another device: the keyboard stays open and the list stays where it was.
   - *Tagging*: type `@` (or tap the @ button), pick a member. On the other device the message is outlined and a "tagged you" alert appears (Account > Notify me about > Chat mentions).
   - *Budget*: Event > Expenses > add budget lines.
   - *Vendor payment*: add a vendor with a UPI ID, add a payment "To pay", tap Pay via UPI, then Mark paid with a UTR. The Spent and Left numbers move.
   - *Items*: add an item and allocate it to a member. That member sees an alert and the item under My tasks. They tap Mark bought and enter the real cost.
   - *Payment link expiry*: create a payment link and open it in a private window. Set the event date to yesterday (Edit event): after a few seconds, reload the link. It shows "This payment link has expired", and the Payments tab shows "Expired". Set the date back, or use Payments > Link expiry > "Keep links open" for extra days, and it works again.
   - *Event deletion*: delete the test event. In Firestore > Data, the `events` document, its `chat` messages, the event's `payforms` documents and their `subs` are all gone. The old link now shows "expired".

### How it works
- **Name change.** Firebase sign-in keeps your display name; the app also copies it into `members.<your id>.name` of each event you are in, because the chat rules compare a message's name with that field. Old chat messages keep the name they were sent with.
- **Expenses data** lives in the event document as four map fields: `bud` (budget lines), `ven` (vendors), `exp` (payments to vendors), `itm` (items to buy). Each entry is its own field (`itm.<id>`), so two people editing different items never overwrite each other, the same way payment links already work. It syncs and works offline like the rest of the event, and adds no reads. A Firestore document holds up to 1 MiB, which fits well over a thousand entries.
- **Spent / to pay.** Spent = vendor payments marked paid + bought items at their real cost. Still to pay = unpaid vendor payments + items not bought yet at their estimate. Left = budget - spent - still to pay. Entries without a category are counted in the totals and shown as "No category".
- **Payment link expiry.** Each `payforms` document stores `until` (milliseconds). It is the end of the event day plus the optional "keep links open" days (Payments > Link expiry, 0 to 30; stored in the event's `pay.grace`). When the event date or the extra days change, the app updates `until` on all of the event's links. The rules (`liveForm` in firestore.rules) make a link unreadable and unsubmittable once `until` has passed **or** the event document no longer exists, so a link also dies at once if a clean-up could not finish.
- **Clean-up on delete.** Firestore does not remove sub-collections on its own. When the organizer deletes an event, the app deletes the chat messages, then each payment link with its submissions, then the event. If anything fails (for example no internet) the event comes back and you can delete it again. Deleting a single payment link also deletes its submissions (the app asks first).
- **Tagging.** A tagged message stores a list `m` of member ids next to its text. The rules accept only ids of people in the event (max 20). The mention alert follows "Chat mentions" in the account panel, not "Chat messages".
- **Chat layout.** In the Chat tab the app adds the class `chatmode` to the page: the event card is hidden, the page cannot scroll, and the chat card is sized to the visible area (`visualViewport`, so it follows the phone keyboard). When the keyboard is open the bottom menu is hidden.

### Free-plan budget (Spark: 50,000 reads, 20,000 writes, 20,000 deletes per day)
- Expenses: one write per change (adding an item, ticking it bought, editing a budget amount). Members already read the event document, so there are no extra reads.
- Name change: one write per event you are in.
- Tagging: no extra reads or writes (it is a field on the message).
- Payment links: a payer opening a link is 1 read (plus the rules' event check, billed as a read) and a submission is 1 write with a few rule reads. Deleting an event or a link costs one read and one delete per submission.
- Deleting an event with a long chat and many submissions can use a few hundred operations in one go. That is fine within the daily limits. Watch Firebase console > Firestore > Usage.

## Upgrade to 3.2.0: email-code (OTP) sign-up, free

Stops bots and mass junk accounts. A new account is created only after the person types a 6-digit code sent to their email. Signing in does **not** ask for a code.

Everything here is free and needs **no credit card**: Brevo (email, 300 a day), Cloudflare Workers (the small server), and Firebase stays on Spark. Firestore rules are unchanged.

### Why it needs a small server
Firebase's sign-up call is public: any bot with your web API key can create accounts without ever opening your app. A code check inside the page would not help, because a bot would simply skip the page. So the plan is:
1. A free Cloudflare Worker (`worker/otp-worker.js`) emails the code, checks it, and creates the account with admin rights.
2. You switch off **Firebase's own sign-up**. From then on the Worker is the only way to create an account, and it does so only after the correct code.

### Files
In `www/` replace: login.html, firebase-config.js (it keeps your Firebase values and adds two lines; see step 5), ui.js.
In the repo root add (new): the `worker/` folder (otp-worker.js, wrangler.toml). Replace: package.json, README.md, SETUP.md.
The `worker/` folder is never published: the website deploys only `www/`, and the APK uses only `www/`.

### Steps (about 30 minutes, in this order)

**1. Brevo: the free email sender**
1. Create a free account at brevo.com (no card).
2. Open Senders, Domains & Dedicated IPs > Senders > add a sender with an email address you own, and click the verification link Brevo emails you. This is the "from" address of the codes.
3. Open SMTP & API > API Keys > Generate a new API key. Copy it. You will paste it into Cloudflare in step 3.
Tip: an address on your own domain is less likely to land in spam than a free Gmail address. While testing, always check the Spam folder.

**2. Firebase: a key that lets the Worker create accounts**
1. Firebase console > gear icon > Project settings > Service accounts > Generate new private key. A .json file downloads.
2. Open it in a text editor. You will paste the whole text into Cloudflare in step 3.
3. This file is a password for your project. Never upload it to GitHub or share it. Delete it from your computer after step 3 if you like (you can always generate a new one).

**3. Cloudflare: the Worker**
1. Create a free account at dash.cloudflare.com (no card).
2. Storage & databases > Workers KV > Create a namespace, name it `cem-otp`.
3. Workers & Pages > Create > Create Worker > name it `cem-otp` > Deploy. Then click Edit code, select everything, paste the contents of `worker/otp-worker.js`, and Deploy.
4. Open the Worker > Settings > Bindings > Add > KV namespace. Variable name `OTP_KV`, namespace `cem-otp`.
5. Settings > Variables and Secrets > add these (type "Secret" for the first three, "Text" for the rest), then Deploy:

   | Name | Type | Value |
   | --- | --- | --- |
   | FIREBASE_SA | Secret | the whole text of the .json file from step 2 |
   | BREVO_API_KEY | Secret | the key from step 1 |
   | OTP_PEPPER | Secret | any long random text (30+ characters). Make one up and keep it |
   | FROM_EMAIL | Text | the sender address you verified in Brevo |
   | FROM_NAME | Text | Campus Events |
   | ALLOWED_ORIGINS | Text | `https://cem.deva.indevs.in,https://YOUR_USERNAME.github.io,https://localhost,capacitor://localhost` (your website addresses, then the Android app. Use your real ones, no trailing slash or path) |
   | ALLOWED_EMAIL_DOMAINS | Text, optional | e.g. `yourcollege.edu.in` to accept only college addresses |

6. Copy the Worker address shown at the top (like `https://cem-otp.yourname.workers.dev`). Open it in a browser: you should see `{"ok":true,"service":"campus-events-otp"}`.

Prefer the command line? `worker/wrangler.toml` lists the same settings and the commands.

**4. Optional but recommended: free captcha (Cloudflare Turnstile)**
It makes bots solve a check before they can trigger an email, and it protects your free email and storage allowance from being used up by spam.
1. Cloudflare dashboard > Turnstile > Add widget. Hostnames: your website host (for example `cem.deva.indevs.in`), `YOUR_USERNAME.github.io` and `localhost` (for the Android app). Mode: Managed.
2. Copy the **Site key** into `TURNSTILE_SITE_KEY` in `www/firebase-config.js` (step 5).
3. Add the **Secret key** to the Worker as a Secret named `TURNSTILE_SECRET`, then Deploy.
Set both or neither. The captcha has not been tested inside the Android app on a real phone; if it does not appear in the APK, check that `localhost` is in the widget's hostnames.

**5. Point the app at the Worker**
1. Open `www/firebase-config.js`. Replace `https://cem-otp.YOUR_SUBDOMAIN.workers.dev` in `window.OTP_API` with your Worker address from step 3.6 (no trailing slash). Leave your Firebase values as they are.
2. Upload the files listed above to GitHub and commit to main. "Build APK" starts by itself.
3. Actions > "Deploy web version" > Run workflow, so the new login page goes live on the website.

**6. Test before switching anything off**
1. Open the website > Create account > enter name, email, password > Send verification code.
2. The email arrives within a minute (check Spam). Enter the code. You should land in the app.
3. Firebase console > Authentication > Users: the new user is listed with your name.
If it fails, see Troubleshooting below. Do not do step 7 until this works.

**7. Switch off Firebase's public sign-up (this is what stops the bots)**
> **Superseded in 3.3.0.** Google sign-in cannot create new users while this is switched off, so 3.3.0 asks you to switch it back **on** and moves the bot protection into `firestore.rules`. If you have not done this step yet, skip it and follow "Upgrade to 3.3.0" instead.

1. Firebase console > Authentication > Settings > User actions > untick **Enable create (sign-up)** > Save.
2. Test again: create another account through the app. It still works, because the Worker creates it with admin rights.
3. Prove the back door is shut: open the login page, press F12 > Console and run
   `firebase.auth().createUserWithEmailAndPassword('bot@example.com','123456')`
   It must fail with `auth/admin-restricted-operation`. Existing users and normal sign-in are not affected.

**8. Update old apps**
Old APKs (3.1.x) try to create accounts directly and now get an error. In Firebase console > Firestore > Data > `appconfig` > `version`, set `latest` to `3.2.0` (and `notes`), and set `min` to `3.2.0` to require the update.

### Troubleshooting
| What you see | Cause and fix |
| --- | --- |
| "Sign-up is not set up yet. Add the OTP service address..." | `OTP_API` in firebase-config.js still has the placeholder, or the new file was not deployed. |
| "This site is not allowed to use the sign-up service." | The address you opened is missing from `ALLOWED_ORIGINS` (scheme and host only, for example `https://cem.deva.indevs.in`). |
| "Sign-up is not set up yet. Please tell the admin." | A Worker setting is missing. Worker > Logs shows `Missing settings: ...`. |
| "Could not send the email." | Brevo sender not verified, wrong `BREVO_API_KEY`, or the 300 a day limit was reached. Worker > Logs shows Brevo's reason. |
| "Could not reach the account service." | `FIREBASE_SA` is not the full JSON, or it belongs to a different Firebase project. Generate a new key from the right project. |
| "Security check failed" | Turnstile site key and secret are from different widgets, or the site is missing from the widget's hostnames. |
| Email in Spam | Common with free sender addresses. Use an address on your own domain, and ask users to mark it "Not spam". |
| "Too many requests" or "Please wait" | The built-in limits (below) working as intended. |

### How it works
- **Send.** The app calls `POST /send` with the name and email (never the password). The Worker rejects bad or throwaway addresses, checks the captcha if enabled, checks the email is not already registered, then makes a random 6-digit code, stores only a salted hash of it for 10 minutes, and emails it through Brevo.
- **Verify.** The app calls `POST /verify` with the code, name, email and password. If the code matches, the Worker creates the Firebase user (name set, email marked verified) using the Firebase admin API, deletes the code, and the app signs in normally.
- **Limits.** 5 wrong guesses lock a code; a new code needs a new email. One code per email per minute, 5 per email per hour, 10 per network address per hour. A code works once, and only for the email it was sent to.
- **Cheapest checks run first.** Captcha, address checks and the registered-email check happen before anything is written to storage, so spam cannot use up the free storage allowance.
- **Only sign-up changed.** Sign-in, password reset and everything in the app talk to Firebase exactly as before.
- Old sign-up code inside `www/sync.js` is no longer reachable (the app redirects to login.html) and would be refused by Firebase anyway.

### Free-plan budget
- **Brevo:** 300 emails a day. Every code and every resend is one email, so about 300 sign-up attempts a day.
- **Cloudflare Workers:** 100,000 requests a day. Far more than sign-up needs.
- **Cloudflare KV storage:** 1,000 writes a day. A code request uses 2 and a wrong guess uses 1, so roughly 400 code requests a day. If a limit is reached, only creating accounts pauses until the next day (UTC midnight). Signing in is not affected.
- **Firebase:** stays on Spark. Creating a user through the admin API costs no Firestore reads or writes.
- Limits are checked against Cloudflare's storage, which can take up to about a minute to update between locations, so they are approximate. That is fine against a bot but not a guarantee against a determined person with many real inboxes: use the captcha and `ALLOWED_EMAIL_DOMAINS` for that.

## Upgrade to 3.3.0: Google sign-up and sign-in, free

Adds a **Continue with Google** button on the website and in the Android app. Email and password keep working.

Everything is free and needs **no credit card**. Google sign-in is part of Firebase Authentication on the Spark plan. If any Firebase page ever asks you to "Upgrade", "Identity Platform" or add a billing account for this, stop and do not continue: Google sign-in does not need it.

### One important change: Firebase sign-up goes back ON
Google can create a new user only while **Enable create (sign-up)** is ticked in Firebase. (3.2.0 told you to untick it.) With it ticked again, anyone with your public API key could make a password account, so 3.3.0 adds a rule to the database: **only accounts with a confirmed email can read or write anything.** Google accounts and accounts made through the OTP Worker are confirmed automatically. Bot-made accounts are not, so they get nothing. Old email accounts that never confirmed get a free Firebase confirmation link when they next sign in.

### Files
Replace in `www/`: login.html, sync.js, ui.js.
Replace in the repo root: firestore.rules, package.json, capacitor.config.json, README.md, SETUP.md.
Replace: `.github/workflows/build-apk.yml`.
Add (new): `.npmrc`, `scripts/patch-google-signin.sh`, `.github/workflows/show-key-fingerprint.yml`.
In the zip the two dot-names have no dot (`github/` and `npmrc`). After uploading, rename them in GitHub: open the file > pencil (edit) > in the path box add the dot (`github/workflows/build-apk.yml` becomes `.github/workflows/build-apk.yml`, `npmrc` becomes `.npmrc`) > Commit.
`firebase-config.js`, the `worker/` folder and `signing/` are **not** changed. Do not overwrite them.

### Part A: website (about 10 minutes)

**A1. Turn on Google in Firebase**
1. console.firebase.google.com > your project > Build > Authentication > **Sign-in method**.
2. **Add new provider** > **Google** > switch **Enable** on.
3. Set the **public-facing name** (for example "Campus Events") and pick your **support email**. Save.

**A2. Allow your website address**
1. Authentication > **Settings** > **Authorized domains** > **Add domain**.
2. Add the address people open the site on, for example `cem.deva.indevs.in` (just the host, no `https://`). Add `yourusername.github.io` too if you use it. `localhost` is already there.

**A3. Switch sign-up back on** (skip if you never switched it off)
1. Authentication > **Settings** > **User actions** > tick **Enable create (sign-up)** > Save.

**A4. Publish the new database rules**
1. Firestore Database > **Rules** tab > select everything > paste the new `firestore.rules` > **Publish**.
2. Do this together with A3. Do not leave sign-up on with the old rules.

**A5. Upload and deploy**
1. On GitHub upload the files listed above (keep the folder structure; "Add file > Upload files" works, and the `.github/workflows/` and `scripts/` folders must keep their paths). Commit.
2. Actions > **Deploy web version** > Run workflow.

**A6. Test on the website**
1. Open the site in a private window > **Continue with Google** > pick an account. You land in the app.
2. Firebase console > Authentication > Users: the Google user is listed with provider Google.
3. Sign out from the account menu and sign in with email and password. It still works.

### Part B: Android app (about 15 minutes)
Do Part A1 first. Google creates the app's "web client" when you switch Google on, and the Android file in step B4 needs it.

**B1. Get your key's SHA-1**
1. GitHub > Actions > **Show signing key fingerprint (SHA-1)** > Run workflow.
2. Open the finished run > the summary shows **SHA-1** (20 pairs like `AB:CD:...`). Copy it.
3. If it says the key or `KEYSTORE_PASSPHRASE` is missing, finish the permanent-key setup from the APK section of README.md first.

**B2. Register the Android app in Firebase**
1. Firebase console > gear icon > **Project settings** > **General** > **Your apps** > **Add app** > Android icon.
2. **Android package name:** `com.campus.events` (exactly). Nickname: anything. **Debug signing certificate SHA-1:** paste the SHA-1 from B1. Click **Register app**.
3. The wizard then shows steps about downloading a file and adding the SDK. You can click **Next** through them. The build does that for you.
4. If you registered the app earlier without the SHA-1: Project settings > Your apps > the Android app > **Add fingerprint** > paste it > Save.

**B3. Download `google-services.json` (after B2)**
1. Project settings > General > Your apps > the Android app > **google-services.json** (download).
2. Open it in a text editor. It must contain both `"client_type": 1` (your Android app) and `"client_type": 3` (the web client). If either is missing, you downloaded too early: check A1 and B2, then download it again.

**B4. Give the file to the build**
1. GitHub repo > Settings > **Secrets and variables** > **Actions** > **New repository secret**.
2. Name: `GOOGLE_SERVICES_JSON`. Value: paste the **whole** file contents. Save.
   (The values in this file are not passwords, but a secret keeps the repo clean. The build checks the file and stops with a clear message if it is wrong.)

**B5. Build and install**
1. Actions > **Build APK** > Run workflow. Download the APK artifact.
2. Install it over the old app. It updates in place because it is signed with the same permanent key.
3. Open the app > **Continue with Google**. Choose your account.

**B6. Optional: ask people to update**
Firestore > `appconfig` > `version`: set `latest` to `3.3.0` and add `notes`.

### Existing users
- **Email accounts made through the code step (3.2.0) and Google accounts:** nothing to do.
- **Email accounts made before 3.2.0** (never confirmed): on the next sign-in they see "Please confirm your email first" and get a link from Firebase. They open it and sign in again. Check spam.
- **Someone with an email account who now taps Google with the same email:** Firebase normally ties it to the same account, so their events are still there. If instead they see "This email already has an account with a password", they sign in with the password.

### Troubleshooting
| What you see | Cause and fix |
| --- | --- |
| "This website address is not allowed for Google sign-in yet" | A2: the exact host is missing from Authorized domains. |
| "Google sign-in is not switched on in Firebase yet" | A1: Google is not enabled in Sign-in method. |
| "New accounts are switched off in Firebase..." | A3: **Enable create (sign-up)** is still unticked. |
| Google window never opens on the website | The browser blocked pop-ups. The page then switches to a redirect by itself; allow pop-ups for the site if it keeps failing. |
| Signed in with Google but the app shows no data or permission errors | A4: the new rules were not published, or the old ones are still active. |
| In the APK: "Google sign-in is missing from this app build" | You installed an older APK. Build and install 3.3.0 (B5). |
| In the APK: Google shows an error with code 10 or "DEVELOPER_ERROR" | The SHA-1 in Firebase does not match the APK, or the package name is not exactly `com.campus.events`. Redo B1 and B2, download `google-services.json` again, update the secret, rebuild. |
| In the APK: nothing happens or a generic failure | `GOOGLE_SERVICES_JSON` secret missing (the Build APK log shows a yellow warning on "Add Google sign-in"), or the phone has no Google Play services. |
| Build APK stops at "Add Google sign-in" with an error | The message says which part of `google-services.json` is missing (no web client, no Android client, wrong package). Fix it and download the file again. |
| Account menu shows the wrong name | Google supplies the name from the Google profile. Change it in the app: account menu > Account > Your name. |

### How it works
- **Website.** `login.html` opens Google's pop-up through Firebase's web SDK. A blocked pop-up falls back to a full-page redirect.
- **Android app.** The plugin `@capacitor-firebase/authentication` shows Google's native account chooser and returns a Google ID token. With `skipNativeAuth` on, the plugin does not sign in natively; the page signs in to Firebase with that token using the same web SDK as before, so Firestore, chat and offline caching are unchanged.
- **The database rule.** `firestore.rules` calls `signedIn()` everywhere it used to check for a login. `signedIn()` also requires `email_verified`. This is what replaces "sign-up switched off".
- **Build.** `scripts/patch-google-signin.sh` enables the plugin's Google libraries and writes `google-services.json` from the secret. Without the secret the APK still builds, but the Google button in the APK fails.
- **Sign-out** goes through one function (`cemSignOut` in sync.js), which also signs out of the native Google account.

### Free-plan budget
- **Firebase Authentication with Google:** no per-user or per-sign-in charge on the Spark plan.
- **Firestore:** unchanged. Sign-in itself uses no reads or writes.
- **GitHub Actions, GitHub Pages, Cloudflare Worker, Brevo:** unchanged.
- **Junk accounts:** with sign-up on, bots can still add empty entries to the Authentication > Users list. They cannot use the database. You can delete them in the console.

## Upgrade to 3.4.0: the new event page (files only)

3.4.0 reorganises the event screen (new Details tab, Teams inside Attendees, Items to buy inside Tasks, a redesigned Expenses & Budget). It is **a files-only upgrade**:
- No change to Firebase, `firestore.rules`, the Cloudflare Worker, secrets or the signing key. Do not touch them.
- No data migration. Events, attendees, tasks, items, budget lines, bills and vendors are stored in the same fields as before and show up in the new layout straight away.
- Mixed versions are safe. People on 3.3.0 and 3.4.0 can use the same event at the same time.

**A1. Replace and add files in `www/`**

| Action | Files |
| --- | --- |
| Replace | `index.html`, `app2.js`, `expenses.js`, `ui.js` |
| Add (new) | `event.js`, `event.css` |
| Leave alone | `sync.js`, `chat.js`, `login.html`, `pay.html`, `firebase-config.js`, `splash.js`, `splash.css` |

Also replace `README.md`, `SETUP.md` and `package.json` if you want the new docs and version number. If you edited `firebase-config.js`, `treasurer:'Cashier'` in `app2.js`, or anything else by hand, re-apply it to the new `app2.js`.

Using the zip: unzip it over your repository folder (same paths), commit and push to `main`. Using GitHub in the browser: open the `www` folder > **Add file > Upload files**, drag in all files from the zip's `www` folder, then commit.

**A2. Update the website**
Pushing alone does **not** update the website. Go to **Actions > Deploy web version > Run workflow** and wait for the green tick (about a minute). Then open the site and refresh once (on a phone, pull down, or close and reopen the tab). Open the account menu > **About & updates**: it shows **v3.4.0** when it worked.

**A3. Update the Android app (optional)**
Pushing to `main` starts **Build APK** by itself (or run it from Actions). Download the APK artifact and install it over the old app. It updates in place because it uses the same permanent key. The version is read from `APP_VERSION` in `www/ui.js`, which is now `3.4.0`.

**A4. Optional: ask people to update**
Firestore > `appconfig` > `version`: set `latest` to `3.4.0` and add `notes` such as "New event page". Leave `min` alone, because 3.3.0 still works.

### Quick check after upgrading (3 minutes)
1. Open an event. You land on **Details**, and the other tabs show only the event name above them.
2. **Attendees**: tap **Register attendee**, add someone, search for them, tap **Check in**. Switch to **Teams** at the top and create a team.
3. **Tasks**: you see your task groups and, below them, **Items to buy**. Tick an item: it asks what it cost.
4. **Expenses** (as organizer): the summary card shows spent, to pay and left. Add a category with a suggestion chip, open **Bills** and add a bill, open **Vendors**.
5. Sign in as a plain member (second account): the **Expenses** tab is not shown, and Tasks still lists the items given to them.

### What changed for each role
| Role | Difference |
| --- | --- |
| Organizer, Manager | Same powers, new layout. Edit and delete moved to **Details**. |
| Treasurer | Sees **Expenses** and **Payments**. |
| Team lead | Adds and allocates items from the **Tasks** tab (they used to do it under Expenses). Still checks in attendees. |
| Member | No longer sees the **Expenses** tab (it only showed them the items list, which now lives in **Tasks**; their own items are also in **My tasks**). |
| Viewer | Read only. Can no longer register attendees or change teams. |

### Rolling back
Keep a copy of the old `www` files before you replace them. To go back, restore `index.html`, `app2.js`, `expenses.js`, `ui.js`, delete `event.js` and `event.css`, then run **Deploy web version** again. Because no data changed shape, nothing needs undoing.

### Troubleshooting
| What you see | Cause and fix |
| --- | --- |
| "The event page did not load. Reload the app." | `event.js` is missing from `www/`, or the browser kept an old copy. Check that `www/event.js` and `www/event.css` were uploaded, redeploy, and refresh. |
| The page looks unstyled (no tab bar) | `event.css` is missing or was not uploaded. |
| Old layout still shows | The website was not redeployed (A2), or the browser cache needs a refresh. |
| A member asks where Expenses went | By design: only organizer, manager and treasurer have it. Items to buy are in **Tasks**. |


## Upgrade to 3.5.0: safer permissions, self-registration, QR tickets, sponsors

3.5.0 is **not** a files-only upgrade. It needs new Firestore rules, new files, a one-time conversion of your existing events, and (for scanning inside the APK) three new npm packages. Everything stays free: no Cloud Functions, no Blaze plan, no card.

**Read this first**
- **Old apps cannot work with the new rules.** An app older than 3.5.0 will show "No permission" when it tries to save attendees, budget items or roles. Update the website and the APK, then set `min` to `3.5.0` (step 5).
- **Do the steps in the order below**, close together (the whole thing is about 20 minutes). The new app writes to a new place that the old rules do not allow, and the new rules reject old apps.
- **Before you start,** if the budget matters, note down or screenshot your budgets, bills and vendors for each event. Your data is copied, not moved blindly, and the old copy is only removed after the new one is written, but a safety copy costs nothing.

### Files
In the repo root replace: `firestore.rules`, `package.json`, `README.md`, `SETUP.md`.
In `www/` replace: `index.html`, `sync.js`, `app2.js`, `expenses.js`, `event.js`, `event.css`, `ui.js`.
In `www/` add (new): `signup.js`, `scan.js`, `income.js`, `register.html`, `ticket.html`, and `vendor/jsQR.js` with `vendor/jsQR.LICENSE.txt`.
In `scripts/` add (new): `patch-scanner.sh`. In `.github/workflows/` replace: `build-apk.yml`.
Not changed: `login.html`, `pay.html`, `chat.js`, `splash.js`, `splash.css`, `firebase-config.js`, the Worker, the signing key, your secrets.

### Steps
1. **Upload the files** above to GitHub and commit to `main`. Pushing starts **Build APK** by itself (it now also adds the scanner, see "Android" below). Do not install that APK yet.
2. **Publish the new rules.** Firebase console > Firestore Database > **Rules** > select everything > paste the new `firestore.rules` > **Publish**. Confirm there are no red error markers in the editor before you publish.
3. **Deploy the website straight away.** Actions > **Deploy web version** > Run workflow. Wait for the green tick, open the site, refresh once, and check account menu > About & updates shows **v3.5.0**.
4. **Convert your events (the organizer does this once).** Open the new website or APK **as the organizer (or a manager)** and open each existing shared event once. Within a few seconds the app:
   - copies budget lines, vendors, bills, earlier payments and donations into `events/{code}/fin/data`, then removes them from the event document, and
   - turns the attendee list into one entry per attendee.

   Check it: Firebase console > Firestore > Data > `events` > your event. You should see a `fin` sub-collection with a `data` document, and `regs` as a map of attendees (not a list). Open the Expenses tab: the budget must look as before. A **treasurer** who opens the app first sees the budget straight away and copies the money data across, but only the organizer or a manager can remove the old copy and convert the attendee list. Until then people with the member role cannot add attendees (the rules wait for the conversion). Events that are not shared (only on one phone) need nothing.
5. **Ask people to update.** Firestore > `appconfig` > `version`: set `latest` and `min` to `3.5.0` and add `notes` such as "Safer permissions, online registration, QR tickets". Install the new APK over the old one (Actions > Build APK > download the artifact).
6. **Run the test checklist below on a test event** before the real event.

### Android: scanning inside the APK
`npm install` now also installs `@capacitor-mlkit/barcode-scanning`, `@capacitor/filesystem` and `@capacitor/share` (all free). The new workflow step `scripts/patch-scanner.sh` adds the camera permission and the scanner meta-data to the generated manifest, so there is nothing to do by hand. Notes:
- Scanning uses Google's scanner screen (Google Play services), which needs no camera permission at run time. The first scan on a phone may download the scanner component (a few seconds, needs internet; if you pre-install the app with internet it is fetched at install time). A phone without Google Play services cannot scan; use the box for typing the ticket code or College ID.
- CSV and ZIP files open the Android share sheet (Save to Drive, WhatsApp, Files).
- If you build on your own computer (Option B in the README), run `bash scripts/patch-scanner.sh` after `npx cap add android`.

### Test checklist (15 minutes, test event with a second account)
1. **Rules and roles.** Sign in as a plain *member* on a second account. Check that the **Income** and **Expenses** tabs are missing, **Scan tickets** is missing, and there is no **Check in** button. As organizer, change that account's role to *treasurer*: Income and Expenses appear. A member can still tick their own tasks and **Register attendee**.
2. **Staff-only money.** In Firebase console > Firestore > Data, open `events/{code}`: no `bud`, `ven`, `exp`, `payments` or `don` fields. They are under `fin` > `data`.
3. **Two volunteers, one list.** On two devices (organizer and a team lead) check in two *different* attendees at the same moment. Both stay checked in. Check in the same person on one device and mark them paid on the other: both stay.
4. **Self-registration.** Attendees > **Open online registration**. Open the link in a private window. Register with a College ID. It appears under **Applications to review**. Open the link again and use the **same** College ID: it must say it was already registered. Set the event capacity to the number of attendees you have and register a new person: the page says the event is full and offers the waitlist; the application lands under **Waitlist**. Raise the capacity and tap **Promote**.
5. **Fee.** In **Price and settings** set a ticket price and UPI ID. The public page shows the UPI QR and an optional UTR box. Submit with a UTR and use **Approve and mark paid**: the attendee shows **Paid**.
6. **Tickets and scanning.** Attendees > **...** > **Ticket (QR)**: share the link and open it on a phone. **Scan tickets**: scan the QR (APK, or Chrome on a phone). The attendee is checked in. Scan again: "Already checked in". Switch the phone to airplane mode, scan another ticket, then switch the network back: the check-in reaches the other device.
7. **Income.** Income tab: set a ticket price, add a sponsor with a promise, tick "Promises delivered", and check the break-even text and bar move when you change the budget.
8. **Export.** Details tab > **Download everything (ZIP)** and open a CSV in Excel or Google Sheets.
9. **Delete.** Delete the test event. In Firestore > Data the event, its `fin` document, the `regpages/{code}` document and its `subs` are gone.

### How it works
- **Rules per role.** `firestore.rules` lists, for each role, the top-level fields of the event document it may change (`fieldsOk`). Attendee changes are checked per entry: organizer and manager anything, treasurer and team lead add and change but not remove, member add only (`regsOk`). Roles are changed by sending the member's new role together with a small witness field `rc = {u, r, at}`; the rules require that exactly the member named in `rc` changed and that the new role matches (`peopleOk`), because rules cannot loop over the members list. Own name change, leaving an event and joining by code are separate narrow rules.
- **Money data.** `events/{id}/fin/data` holds one map per kind (`bud`, `ven`, `exp`, `payments`, `don`, `spn`), one entry per item (`exp.<id>`), so two treasurers adding different bills never overwrite each other. Only owner, manager and treasurer can read or write it, enforced by `isStaff` in the rules.
- **Attendees.** `regs.<id>` is one map entry per attendee. The app writes only changed fields (`regs.<id>.in`). An entry that is missing a name is ignored when loading (it can only come from a stale device writing to an attendee someone deleted).
- **Public registration.** `regpages/{event code}` is a small public document written by staff devices: event name, date, seats taken, the form questions, price and UPI details, and an `open` switch and closing time (end of the event day). The page is readable only while it is open, the closing time has not passed and the event still exists (`liveReg`). Applications go to `regpages/{code}/subs/{COLLEGE ID}`: create-only for the public, with a size limit and a College ID check in the rules; read and approve for staff. Approving writes the attendee into the event and sets the application to `approved`.
- **Tickets.** The QR holds `CEM1:{event code}:{attendee id}`. The ticket page carries name and event in the link, so it needs no database.
- **Clean-up on delete.** Deleting an event also deletes its `fin` document, its registration page and the applications under it (Firestore never removes sub-collections by itself).

### Free-plan budget (Spark: 50,000 reads, 20,000 writes, 20,000 deletes per day)
- Each organizer, manager or treasurer device adds one more listener per event (the `fin` document) and, when online registration is on, one listener on the applications. That is one read when it starts plus one per change.
- Opening the public page is 1 read (the rules' event-exists check is billed as a read too). An application is 1 write plus a few rule reads. Approving is 1 write to the event and 1 to the application.
- Attendee changes are one write each, as before. Seats-taken updates to the public page are one write per change.
- A 500-person event with 500 applications is a few thousand operations in total, well inside one day's limits.

### Rolling back
Re-publish the 3.4.0 rules (they are in the repository history) and restore the 3.4.0 files. **Converted events keep their money data in `events/{id}/fin/data`**, which the 3.4.0 app does not read, so budgets look empty there until you copy those fields back into the event document by hand in the Firebase console. If you may need to go back, do not run the conversion (step 4) until you have tested.

### Troubleshooting
| What you see | Cause and fix |
| --- | --- |
| "No permission. Check the Firestore rules." right after the upgrade | The device runs an old app (3.4.0 or older). Refresh the website, install the new APK, and set `min` to `3.5.0`. |
| Rules editor shows a red error and will not publish | The file was cut or edited. Paste the whole `firestore.rules` again. |
| Treasurer or manager sees an empty budget | The event has not been converted yet. The organizer opens the event once (step 4). Check `events/{code}/fin/data` in the console. |
| A member cannot add attendees after the upgrade | The attendee list is still the old list. The organizer or a manager opens the event once; it converts in a few seconds. |
| The role drop-down does nothing, or "No permission" on role change | Only organizer and manager change roles, and a manager cannot change another manager or the owner. |
| Online registration link says "unavailable" or "closed" | The page is switched off, the event day has passed, or the event was deleted. Open Attendees and check it says **Open**. |
| "Set your public site address first" | Payments tab > Link settings > Site address (the APK needs it for registration and ticket links; `PAY_BASE` in `firebase-config.js` does the same). |
| A person says their College ID "has already registered" | They applied before, or a team member added them. Find them under handled applications (Remove lets the same ID apply again) or in the attendee list. |
| Scan tickets does nothing in the APK | The APK was built before 3.5.0, or the build skipped `patch-scanner.sh`. Rebuild; check that the workflow log shows "Add ticket scanner (Android)". Type the code in the box as a fallback. |
| "Scanner problem" on first scan | Google's scanner component is still downloading or the phone has no Google Play services. Connect to the internet and tap Scan next ticket, or use the typing box. |
| Camera does not start on the website | The browser blocked the camera or the site is not on https. Allow camera access, or type the ticket code. |
| Break-even says "Add a budget or some costs" | Add budget categories or bills in Expenses, or switch the cost basis to Spent + to pay. |


## Upgrade to 3.6.0: spreadsheet import, custom registration link, cash or UPI, calculator

3.6.0 needs **one change in Firebase** (republish the rules) and new files. There is nothing to convert, no new npm package, no change to the workflows, the Worker or the signing key. Free plans only. Allow about 10 minutes.

**Read this first**
- **Old apps keep working** with the new rules (they only add things), but they do not show the new features. The registration page works for everyone as soon as the website is redeployed.
- **Order:** upload files, publish the rules, deploy the website. Do the rules before you test the link name or cash payments, because the new `regslugs` collection and the cash fields are refused by the 3.5.0 rules.

### Files
In the repo root replace: `firestore.rules`, `package.json`, `README.md`, `SETUP.md`.
In `www/` replace: `index.html`, `event.js`, `signup.js`, `register.html`, `income.js`, `sync.js`, `ui.js`.
In `www/` add (new): `sheet.js`, `import.js`, `payment.js`, `calc.js`, `404.html`.
Not changed: `.github/` (nothing there changes), `scripts/`, `worker/`, `app2.js`, `expenses.js`, `chat.js`, `scan.js`, `login.html`, `pay.html`, `ticket.html`, `firebase-config.js`, `event.css`, `vendor/`.

### Steps
1. **Upload the files** above to GitHub and commit to `main`. Build APK is started by hand (Actions > Build APK > Run workflow).
2. **Publish the new rules.** Firebase console > Firestore Database > **Rules** > select everything > paste the new `firestore.rules` > **Publish**. Check there are no red error markers before you publish. If the editor shows an error, do not publish; paste the whole file again and tell whoever maintains the project what the marker says.
3. **Deploy the website.** Actions > **Deploy web version** > Run workflow. Wait for the green tick, open the site, refresh once, and check account menu > About & updates shows **v3.6.0**. The deploy publishes the `www` folder, so `404.html` goes live with it. That file is what makes `https://your-site/r/<name>` work.
4. **Install the new APK** over the old one if you use the app (Actions > Build APK). Optionally set `latest` to `3.6.0` in Firestore > `appconfig` > `version`. Do **not** raise `min`: 3.5.0 apps still work.
5. **Run the test checklist below** on a test event.

### Test checklist (15 minutes, test event, a second device or a private window)
1. **Link name.** Attendees > Online registration > **Customize page and link**. Enter a link name, a headline, pick an accent colour and a background, **Save**. Open **Open online registration**. Open the short link (`https://your-site/r/<name>`) in a private window: it shows your headline, colours and button text. Also open the **Backup link**. Open `register.html?e=<event code>`: it still works.
2. **Names are unique.** On a second event try the same link name: "already used by another event". Rename the first event's link: the old address stops working (page says it does not exist), the new one works.
3. **Closing time.** Set a closing time a few minutes ahead. After it passes the page says registration is closed (this is checked by the rules too: a saved copy of the page cannot submit).
4. **Cash collectors.** Set a ticket price and a UPI ID (Price and settings). In **Cash collectors** add one person from the team and one typed name. Open the public page in a private window: you can choose **UPI** or **Cash**; Cash shows a drop-down with both names and "I will pay later / I have already paid this person".
5. **Cash application.** Apply with Cash, a collector and "already paid". In Applications to review you see "Cash: <name> (says already paid)" and **Approve and mark paid**. Approve it: the attendee shows **Paid** and the tag **Cash: <name>**. Apply with UPI and a UTR and approve it: tag **UPI**.
6. **Rules check for cash.** Open the page's source or use the browser console to send a registration with a collector id that is not in the list (for example `cc: "zzzzz"`): the database must refuse it (the page then says the College ID has already registered or registration is closed). A normal cash application must work.
7. **Register attendee in the app.** Open the form: there is a Payment block. Choose Cash without a collector: it asks for one. Choose Cash with a collector and tick **Payment received now**: the attendee is saved as paid.
8. **Cash and UPI at a glance.** The card shows each collector with received and still-to-collect. **Show unpaid cash** filters the list. In an attendee's ... menu change the payment mode and collector.
9. **Import.** Make a small test sheet (or press **Download blank template** and fill it in Excel or Google Sheets): five people, one with an empty name, one College ID twice, one already registered. Import as `.xlsx` and again as CSV. Check the summary lists the skipped rows with reasons, **Download skipped rows** works, and the imported people show **Imported**. Import the same file again: nothing is ready (no duplicates). Try an old `.xls`: it should tell you to save as `.xlsx` or CSV.
10. **Calculator.** Open it from the header on the Attendees tab. `200 + 10 %` shows 220. In **Change**: price 150, quantity 3, tap +500: change 50. In **Cash count** enter some notes and use **Use cash received so far**: it shows matches, short or over.
11. **Delete.** Delete the test event: in Firestore > Data its `regpages/{code}` page and the `regslugs/<name>` document are gone.
12. **On a phone (APK).** Choose a spreadsheet from Drive or the phone's files with **Choose spreadsheet**. If the file chooser does not open on your phone model, tell the maintainer; the website works in the phone's browser meanwhile.

### How it works
- **Spreadsheet import** runs entirely on the device (`sheet.js`). An `.xlsx` or `.ods` file is a ZIP of XML files; the reader finds the ZIP directory, inflates only the sheets, shared strings and styles it needs with the browser's built-in `DecompressionStream`, and never runs formulas or macros. Attendees are written like hand-registered ones: one `regs.<id>` entry each, with `src: "import"`.
- **Link names.** `regslugs/{name}` holds `{eid, by, at}`. The public page reads that one document (anyone may read one name, nobody may list them), then loads `regpages/{event code}`. The rules allow creating a name only to a staff member of the event it points to, and changing or deleting it only to staff of that event. The name is also stored in the page document (`slug`) so deleting the event can free it.
- **Page settings** (headline, colours, closing time...) live in the event's payment settings (`pay.rp`) and are copied to the public page document (`th`, `until`) whenever they change. The closing time is the `until` field the rules already used.
- **Cash and UPI.** Collectors are `pay.cashiers = [{id, n, u?}]`. The public page document carries their ids and names (`cash`, `cids`). An application may carry `pm` (`upi` or `cash`), `cc` (collector id, must be in `cids`) and `cp` (the applicant says they paid). The attendee keeps `pm`, `cc`, `cn` (collector name at that time), `paid`, `pt` and `utr`.

### Free-plan budget (Spark: 50,000 reads, 20,000 writes, 20,000 deletes per day)
- Opening the public page by link name is **one extra read** (the name document) on top of the page document.
- Claiming or releasing a link name is 1 to 2 writes. Saving page settings is 1 write to the event and 1 to the public page.
- An import of 300 attendees is **one** write to the event document (all new entries go in one update), plus the usual seats-taken update of the public page.
- Cash fields add a few bytes to each application and attendee.

### Rolling back
Re-publish the 3.5.0 rules and restore the 3.5.0 files. Attendees keep their extra fields (`pm`, `cc`, `cn`), which 3.5.0 ignores. Link names stay in `regslugs` and can be deleted in the console; links with `/r/` stop working because the old `register.html` does not know them, but `register.html?e=<code>` works.

### Troubleshooting
| What you see | Cause and fix |
| --- | --- |
| "Could not claim that link name" | The 3.6.0 rules are not published yet (step 2), or you are not organizer, manager or treasurer of this event. |
| "That link name is already used by another event" | Another event in your project holds it. Pick another name, or delete the document in Firebase console > Firestore > `regslugs` if it is left over from an event you no longer need. |
| `/r/<name>` shows "Page not found" | `404.html` was not uploaded to `www/`, the website was not redeployed, or the name has a typo (letters, digits and hyphens only). Use the **Backup link** meanwhile. |
| `/r/<name>` works on the website but is slow to open | It loads the short address first and then redirects, which is normal. The backup link opens directly. |
| The public page shows the old colours or text | Settings are copied a moment after Save. Refresh the page. If it stays old, open the event once on an organizer device while online (it re-sends the page). |
| Cash is not offered on the public page | There must be a ticket price, at least one cash collector, and the page must be re-synced (open the event once as organizer). With only a UPI ID and no collectors the page offers UPI only. |
| Cash application fails with "already registered or closed" | The collector was removed from the list after the page was loaded, or the 3.6.0 rules are not published. Refresh the page and choose again. |
| Import says "This file has only one row" | The first row is the heading. Add at least one attendee row, or untick "First row has column names" if the sheet has no headings. |
| Import shows everyone as skipped, "Name is empty" | The name column was matched to the wrong column. Change the match for the first form question at the top of the list. |
| Phone numbers lose a leading 0 or show as 9.8765E+09 | The sheet stored them as numbers. Format that column as Text in Excel or Sheets before saving, or ignore the leading 0 (WhatsApp links use the digits). |
| "This is an old Excel (.xls) file" | Open it in Excel or Google Sheets and use Save as / Download as `.xlsx` or CSV. |
| "This browser cannot open Excel files" | The browser is too old to unzip (needs Chrome / Edge 103+, Firefox 113+, Safari 16.4+). Update it or save the sheet as CSV. |
| Calculator button missing | `calc.js` was not uploaded, or the old page is cached. Redeploy and refresh. |

---

## Upgrade to 3.6.1: more roles, custom roles, and Help & guides

3.6.1 needs **one change in Firebase** (republish the rules) and new files. There is nothing to convert, no new npm package, no change to the workflows, the Worker or the signing key. Free plans only. Allow about 10 minutes.

**Read this first**
- **Publish the rules before anyone uses a new role.** The 3.6.0 rules do not know the new roles or the `croles` field, so creating a custom role, or giving someone a new role, shows "No permission" until the 3.6.1 rules are live.
- **Ask people to update the app.** A 3.6.0 app does not know the new roles: someone holding one would see an unknown role name and a read-only event. The website updates by itself once it is redeployed. Optionally set `latest` to `3.6.1` in Firestore > `appconfig` > `version`. Do **not** raise `min`: 3.6.0 apps still work for everyone who keeps a classic role.
- Existing events and members are untouched. Every member keeps the role they have; the six classic roles behave exactly as before.

### Files
In the repo root replace: `firestore.rules`, `package.json`, `README.md`, `SETUP.md`.
In `www/` replace: `index.html`, `app2.js`, `event.js`, `event.css`, `sync.js`, `ui.js`, `chat.js`, `expenses.js`, `income.js`, `signup.js`, `payment.js`, `import.js`, `calc.js`.
In `www/` add (new): `help.js`.
Not changed: `.github/`, `scripts/`, `worker/`, `scan.js`, `sheet.js`, `404.html`, `login.html`, `register.html`, `pay.html`, `ticket.html`, `firebase-config.js`, `vendor/`.

### Steps
1. **Upload the files** above to GitHub and commit to `main`. Build APK is started by hand (Actions > Build APK > Run workflow).
2. **Publish the new rules.** Firebase console > Firestore Database > **Rules** > select everything > paste the new `firestore.rules` > **Publish**. Check there are no red error markers before you publish. If the editor shows an error, do not publish; keep the old rules and note the line the marker points to.
3. **Deploy the website.** Actions > **Deploy web version** > Run workflow. Open the site, refresh once, and check profile icon > About & updates shows **v3.6.1**.
4. **Install the new APK** over the old one if you use the app (Actions > Build APK).
5. **Run the test checklist below** on a test event with a second account.

### What is new
- **Five more built-in roles:** Coordinator, Registration desk, Logistics lead, Sponsorship lead, Volunteer. They appear in the role drop-down of the People tab.
- **Custom roles:** People tab > **Custom roles** (organizer and managers only) > **+ New role**. Name it, optionally copy the permissions of an existing role, and tick the permissions. Nine permissions exist: Tick off own tasks, Team member basics, Manage tasks, Items to buy, Volunteer list, Attendees and check-in, Edit event and registrations, Payments and online registration, Money.
- **Help & guides:** every explanatory paragraph that used to sit inside the tabs is now in one place: profile icon > **Help & guides** (right after "Account, alerts & join event"). It has a search box, and its "Roles and permissions" section also lists the custom roles of the event you have open. The event's **Details** tab has a short note that says where to find it.

### Test checklist (15 minutes, test event, a second account joined with the event code)
1. **Rules published.** Firebase > Firestore > Rules shows the new text (search for `permsOf`).
2. **New built-in role.** On the organizer account open People and set the second account to **Registration desk**. On the second account (refresh it): Attendees shows **Register attendee**, **Check in** and **Scan tickets**; Tasks has no "+ New group"; there is no Expenses or Income tab.
3. **Custom role.** On the organizer account: People > Custom roles > + New role. Name it `Gate`, choose **Copy permissions from** Registration desk, tick **Money**, **Create role**. Give it to the second account. On that account (refresh): the **Expenses** and **Income** tabs appear and Details says **Your role: Gate**.
4. **Server check (the important one).** The app hides buttons the moment a role changes, so test the rules themselves with Firebase's **Rules Playground** (Firestore > Rules > Rules Playground). Simulate a **get** on `/databases/(default)/documents/events/<event code>/fin/data`, switch **Authenticated** on and enter the second account's UID (Firebase > Authentication > Users); if the playground offers an email-verified option, tick it. With **Money** ticked on the role it must say **Allowed**. Untick Money on the role (Edit > Save role), wait a few seconds, run the same simulation again: **Denied**. Repeat with a **get** on `.../regpages/<event code>` and the permission **Payments and online registration**.
5. **Field limits.** With a custom role that has only **Tick off own tasks**, the second account can tick a task given to them but cannot add a task group, edit the event, or register an attendee.
6. **Chat.** A **Volunteer** can chat. A custom role with nothing ticked can read the chat but the message box is replaced by a note.
7. **Roles stay with the top.** On the second account (as Registration desk or any custom role) the People tab shows no role drop-downs and no Custom roles card.
8. **Delete rules.** Try to delete a custom role while someone holds it: the app refuses. Move the person to another role and delete it.
9. **Help & guides.** Profile icon > Help & guides opens, the search finds "cash", Esc closes it. Open an event > Details: the note about Help & guides is there, and its button opens the panel. The tabs no longer show intro paragraphs.
10. **Alerts.** When you change the second account's role, it gets "Your role is now Gate" (the custom role's name, not an id).

### How it works
- **Permissions are lists.** Each role is a list of permission keys. The six classic roles keep their original rules in `firestore.rules`. The five new roles are listed in the function `permsOf` in the rules and in `BASE` in `www/app2.js` (**keep the two lists identical** if you ever change one). A custom role is stored in the event document as `croles.<id> = { id, n, p, at }`, with an id like `c_k3j2m1`; the member's `role` is that id.
- **What the rules check.** `customFieldsOk()` allows each top-level field of the event document only if the role holds a permission that opens it (for example `groups` needs Manage tasks, `info` needs Edit event). `regsOk()` decides who may add, change and remove attendees. The money document needs Money, and payment links, online registration and link names need Payments and online registration. Chat needs at least one permission. Changing roles, defining custom roles and deleting the event stay with the organizer and managers (the organizer for deleting). The rules cap `croles` at 20 entries; the app allows 12.
- **Custom roles are data, not code.** Nothing is deployed when a role is created or edited. Editing a role changes every holder at once.

### Free-plan budget
No new reads. Creating or editing a role is one write to the event document; giving a role is the same single write as before.

### Rolling back
Re-publish the 3.6.0 rules and restore the 3.6.0 files. Anyone holding a new or custom role then has no permissions in the old app (read only), and you can set them back to a classic role from the People tab. The `croles` field stays in the event document and is ignored.

### Troubleshooting
| What you see | Cause and fix |
| --- | --- |
| "No permission" when creating a role or giving a new role | The 3.6.1 rules are not published (step 2), or you are not the organizer or a manager. |
| "No permission" when someone with a custom role does something their role should allow | The role is missing the permission that opens that field (see "How it works"), or their app is older than 3.6.1 and shows buttons the rules refuse. Update the app. |
| A person shows **Role removed** | The custom role they held was deleted from another device. Give them another role. |
| The Custom roles card is missing | You are not the organizer or a manager, or the event is not shared yet. |
| Help & guides does not open | `help.js` was not uploaded to `www/`, or the website was not redeployed. |


## Upgrade to 3.14.0: update the app from inside the app

Adds **Profile menu > Update app** to the Android app. It asks GitHub Releases for the newest version, downloads the APK inside the app with a progress bar, then shows an **Update** button that opens Android's normal update screen. Nobody has to visit the download website any more. The website (`downloadcem.deba.indevs.in`) keeps working as before, and is still how a brand new user installs the app.

**No Firebase rules change, no Worker change, no new secret.** The website (pages workflow) is not affected: the menu entry only appears inside the Android app.

### How it works (so you can trust it)
A web page cannot save and install files, so the Build APK workflow now also adds a small native Android plugin (`scripts/native/ApkUpdaterPlugin.java`) to the app it builds. `www/updater.js` is the window the user sees. The plugin downloads only from `github.com/real-debabrata/cem/releases/download/...` (every redirect must stay on GitHub), checks the file size and checksum, checks that it is a newer version of this same app signed with the same key, then hands it to Android's installer. Android always shows its own confirmation screen: an app cannot install silently.

### Files
In the repo root replace: `package.json`, `README.md`, `SETUP.md`. Add `release-notes/v3.14.0.md`.
In `.github/workflows/` replace: `build-apk.yml` (it gains one step, "Add in-app updater (Android)").
In `scripts/` add: `patch-updater.sh`, and the folder `native/` with `ApkUpdaterPlugin.java`.
In `www/` add: `updater.js`. Replace: `ui.js`, `index.html`.
In `tests/` add (optional): `test-updater.mjs`, `test-update-menu.mjs`.

### Steps (about 10 minutes)
1. Upload the files above (keep the folder structure), commit.
2. **Actions > Build APK > Run workflow** as usual. The version becomes 3.14.0. Check the log of the step **Add in-app updater (Android)**: it must print `ApkUpdaterPlugin.java copied`, `MainActivity: ApkUpdaterPlugin registered` and `REQUEST_INSTALL_PACKAGES added`.
3. **One time only:** install this 3.14.0 APK the old way (download website, or the Release page). Older apps cannot update themselves, because they do not contain the updater yet. (Run **Deploy web version** too if you want the website on 3.14.0 as well.)
4. **Test the real thing:** bump `APP_VERSION` in `www/ui.js` to the next number (for example 3.14.1), build and publish a Release as usual. On the phone that has 3.14.0, open the profile menu, tap **Update app**. You should see: Checking, Downloading with a progress bar, Update ready. Tap **Update**.
5. The first time only, Android sends you to a settings page: turn on **Allow from this source**, press back, and the update continues. Confirm on Android's update screen. The app closes while it updates. Open it again: it is now 3.14.1.

### Rules you must keep
- **Raise the version on every release** (`APP_VERSION` in `www/ui.js`). The updater compares the Release tag (for example `v3.14.1`) with the installed version. Re-running the build for the *same* version replaces the file on that Release, but phones that already have that version will not be offered it.
- **Keep one signing key.** The workflow already guarantees this. If the key ever changes, in-app updates (and normal updates) will be refused by Android; the app says so clearly.
- **Release must be public and not a draft or pre-release**, and the APK must be attached. This is how the download website already works.
- **If you rename the GitHub repository**, change `OWNER`/`REPO` at the top of `www/updater.js` and `ALLOWED_PATH` in `scripts/native/ApkUpdaterPlugin.java`.

### Small details
- GitHub allows 60 anonymous checks per hour per network. The app caches the answer for 5 minutes and only checks when the user taps **Update app**, so a whole college on one Wi-Fi is fine. If the limit is ever hit, the window says so and offers the download page.
- If an update was downloaded but not installed, it stays on the phone and is offered again instantly (and is cleaned up automatically once installed).
- Play Protect may show "Install anyway" for a sideloaded update. That is Android's normal behaviour for apps not from the Play Store.
- **Privacy Policy:** the app now also contacts GitHub (to look for updates). Consider changing the GitHub row in section 5 of `www/privacy.html` from "Hosts the website" to "Hosts the website and app updates", and updating its `POLICY-DATE`.

### Rolling back
Restore the 3.13.0 versions of `build-apk.yml`, `ui.js`, `index.html` and `package.json`. `updater.js`, `patch-updater.sh` and `native/` can stay or be deleted.

## Upgrade to 3.12.3: Privacy Policy page

Adds a public Privacy Policy page (`privacy.html`) and links it next to the Terms everywhere: the sign-in page ("By continuing, you agree to our Terms & Conditions. Read our Privacy Policy."), the profile menu, and the bottom of the Account panel. The Terms page now links to it, and its wording about the saved mail login is corrected (the "Remember this login" box is ticked by default).

**Files only.** No Firebase rules change, no Worker change, no new variable or secret, no Android plugin. This version also contains the 3.12.2 changes (Terms page), so you can go straight from 3.12.1.

### Files
In the repo root replace: `package.json`, `README.md`, `SETUP.md`. Add `release-notes/v3.12.2.md` and `release-notes/v3.12.3.md`.
In `www/` add: `terms.html`, `privacy.html`. Replace: `login.html`, `sync.js`, `ui.js`, `help.js`.

### Steps (about 3 minutes)
1. Upload the files, commit, and let the *pages* workflow publish the site.
2. Open `https://cem.deba.indevs.in/privacy.html` in a private window. It must open without signing in.
3. On the sign-in page, check the new line under **Forgot password?** and that both links work.
4. Sign in and open the profile menu: **Terms & Conditions** and **Privacy Policy** sit between **Help & guides** and **Theme**. Both are also at the bottom of **Account, alerts & join event**.
5. Android: run **Actions > Build APK > Run workflow** as usual. The version becomes 3.12.3. Both pages are bundled inside the app.

### Show the app name and logo on Google's sign-in screen
This is set in Google Cloud Console (same project as Firebase), not in the app. Google shows the name and logo only after it verifies your branding.
1. **Google Auth Platform > Branding:** set App name (Campus Events), the logo, and your support and developer email.
2. Under **App domain** enter: Home page `https://cem.deba.indevs.in/`, Privacy policy `https://cem.deba.indevs.in/privacy.html`, Terms of service `https://cem.deba.indevs.in/terms.html`.
3. Add your domain under **Authorized domains** and verify it in Google Search Console.
4. **Audience:** External, In production. Then **Verify branding** and, once approved, **Publish branding**.
The Privacy Policy and Terms must stay public (no sign-in needed) and the home page must link to the Privacy Policy. The sign-in page does both.

### Small details
- **Change the contact or the date.** In `www/privacy.html` search for `CONTACT` and `POLICY-DATE`. In `www/terms.html` search for `CONTACT` and `TERMS-DATE`. The contact is cem@deba.indevs.in. Change the date whenever a policy changes.
- **Keep the policy true.** If you add a new service that handles personal data (analytics, a new email provider, a new payment tool), add it to the table in section 5 of the Privacy Policy.

### Rolling back
Restore the 3.12.1 versions of `login.html`, `sync.js`, `ui.js` and `help.js`. `terms.html` and `privacy.html` can stay or be deleted.

## Upgrade to 3.12.2: Terms & Conditions page

Adds a Terms & Conditions page (`terms.html`). The sign-in page says "By continuing, you agree to our Terms & Conditions", and the page is also linked from the profile menu and from the bottom of the Account panel.

**Files only.** No Firebase rules change, no Worker change, no new variable or secret, no Android plugin.

### Files
In the repo root replace: `package.json`, `README.md`, `SETUP.md`. Add `release-notes/v3.12.2.md`.
In `www/` add: `terms.html`. Replace: `login.html`, `sync.js`, `ui.js`, `help.js`.

### Steps (about 2 minutes)
1. Upload the files, commit, and let the *pages* workflow publish the site.
2. Open the sign-in page: you should see the new line under **Forgot password?**, and the link should open the Terms.
3. Sign in, open the profile menu: **Terms & Conditions** is between **Help & guides** and **Theme**. Open **Account, alerts & join event** and scroll down: the link is above **Sign out**.
4. Android: run **Actions > Build APK > Run workflow** as usual. The version becomes 3.12.2. The page is bundled inside the app, so it also opens offline.

### Small details
- **Change the contact or the date.** Open `www/terms.html` and search for `CONTACT` (the contact box in section 17, which uses cem@deba.indevs.in) and `TERMS-DATE` (the "Effective / Last updated" line). Change the date whenever the terms change.
- **It follows the app's theme.** If the person chose Light or Dark in the profile menu, the Terms page uses it. With Auto it follows the device.
- **The Back button** returns to the page the person came from (sign-in or the app).

### Rolling back
Restore the 3.12.1 versions of `login.html`, `sync.js`, `ui.js` and `help.js`. `terms.html` can stay or be deleted.

## Upgrade to 3.12.1: registration without a College ID (only the email is required)

The public registration page used to demand a College ID from everybody, which locked out outsiders and guests. Now only the **email address** is always required. The College ID, phone and every other answer follow the event's own form (the questions you add and their **Required** tick). Each email address can apply once per event (it used to be each College ID).

**Needs one change in Firebase: republish `firestore.rules`.** The old rules require a College ID and use it as the application's id, so with the old rules the new form is refused. No Worker change, no new variable or secret, no Android plugin.

### Files
In the repo root replace: `firestore.rules`, `package.json`, `README.md`, `SETUP.md`. Add `release-notes/v3.12.1.md`.
In `www/` replace: `register.html`, `signup.js`, `help.js`, `ui.js`.

### Steps (about 3 minutes)
1. **Publish the rules first.** Firebase console > Firestore Database > Rules > select everything, paste the new `firestore.rules` from the repo root > Publish.
2. Upload the other files, commit, and let the *pages* workflow publish the site.
3. Open an event > **Attendees** > **Registration** > **Preview page**. You should see **Email \*** and no fixed College ID box. Submit a test application with an email only (and no College ID), then approve it.
4. Android: run **Actions > Build APK > Run workflow** as usual. The version becomes 3.12.1.

### Small details
- Events made from a template (Fest, Seminar, Workshop, Cultural, Sports) still start with a **College ID** question ticked **Required**. For an event open to outsiders, untick **Required** (or delete the question) in the event's form. Existing events are not changed.
- If the event already has an **Email** or a **Phone / Mobile / WhatsApp** question (the Webinar template has Email), the page uses that question instead of showing a second box. The email question always shows the \* because it is always required.
- If the first question (the name) is not required and is left empty, the part of the email before the @ is used as the name.
- Applications already received under the old rules are filed under the College ID. They still show up and can be approved. A person who applied that way and applies again with their email is caught at **Approve**, because the app checks the College ID and the email against the attendees.

### Rolling back
Restore the 3.12.0 versions of `register.html`, `signup.js`, `help.js`, `ui.js` and `firestore.rules` (publish the old rules again). Approve or reject any application received while 3.12.1 was live first: those have no College ID, and the 3.12.0 organizer screen cannot handle that.

## Upgrade to 3.12.0: Email attendees in three simple steps (ticket or invitation)

The email window is now a short guided flow, so a person who has never heard of SMTP can use it:

1. **People:** tabs **Not emailed**, **Emailed** and **No email** show who has and has not been emailed (with the date, and whether each person got a ticket or an invitation). **Email these again too** and **Clear emailed marks** are buttons here.
2. **Message:** write or edit the subject and message. The box **Send a ticket with a QR code** is **ticked by default**. Untick it for an event that needs no ticket: attendees get a plain invitation with no QR code, no ticket picture and no ticket link. The tick is remembered per event on that device.
3. **Send:** pick **This device's mail app** (no setup) or **My email account (automatic)**. For the second, tap your provider (**Gmail, Outlook, Yahoo Mail, Zoho Mail (India), Zoho Mail (World), Brevo, Other**, each with its logo and name), then enter your email address and app password. Server and port are filled in; **Server settings** shows them. A **How do I get this password?** button shows the steps, with a button to the Google or Brevo page where those apply.

Every former text link in this window is now a real button. **No Worker change, no new variable or secret, no Firestore rules change and no new Android plugin.** The Worker from 3.11.0 already accepts an email without a ticket picture (the test suite now proves it).

### Files
In `www/` replace: `mailer.js`, `event.js`, `help.js`, `ui.js`.
In the repo root replace: `package.json`, `README.md`, `SETUP.md`. Add `release-notes/v3.12.0.md`. In `tests/` replace `test-client.mjs` and `test-worker.mjs`.
`worker/` is **unchanged**.

### Steps (about 3 minutes)
1. Upload the files above, commit, and let the *pages* workflow publish the site.
2. Open an event > **Attendees** > **Email attendees**. Walk through the three steps. Try unticking **Send a ticket with a QR code** and watch the preview turn into an invitation.
3. Android: run **Actions > Build APK > Run workflow** as usual. The version becomes 3.12.0.

### Small details
- Attendees get one more optional field, `mlk` (`t` ticket or `i` invitation), next to the existing `ml` and `mlv`. Older emailed marks without it count as tickets.
- The **Emailed** tag in the attendee list now says *Ticket emailed* or *Invitation emailed* when you hover it.
- Standard invitation text: *You are invited to {event}* ... *We would love to see you there.* Texts you wrote yourself are never replaced when you tick or untick; use **Reset message** to get the standard text for the current choice.
- Gmail, Zoho and Brevo logos come from the open `simple-icons` set (CC0). Yahoo and Outlook are plain lettermark badges drawn in code. All names and logos belong to their owners.

### Rolling back
Restore the 3.11.0 versions of `mailer.js`, `event.js`, `help.js` and `ui.js`. Attendee marks written by 3.12.0 are still read correctly (`ml` and `mlv` are unchanged).

### Troubleshooting
| What you see | Cause and fix |
| --- | --- |
| The window still looks like the old single screen | The browser cached the old `mailer.js`. Hard refresh, or reopen the app. |
| *Automatic sending is not set up yet* | `OTP_API` is missing in `firebase-config.js`, as in 3.10.0. |
| *Tickets are switched off, so the ticket parts of your message are left out* | You edited the message and then unticked the ticket box. Tap **Reset message** for the standard invitation. |
| *Your message has no ticket in it* | The ticket box is ticked but the message has no **Ticket QR** or **Ticket link**. Tap one of those buttons, or untick the box. |
| Gmail says the login was refused | Use an app password, not your normal password. If **App passwords** is missing in your Google account, your college may have turned it off: use **Brevo**. |

## Upgrade to 3.11.0: designed ticket pictures (PNG), emailed and saved for offline use

Tickets are now a proper ticket **picture** instead of a bare QR code: attendee name, event, date, time, venue and **one QR code** (no barcode). Two looks, chosen by the organizer: **Gradient** (purple, QR on top, tear-off stub) and **Flat** (white with striped edges, QR at the bottom).

- **Attendee:** the ticket link opens the picture with **Save ticket (PNG)** and **Share or save to Photos**. The page remembers the ticket on that phone and keeps its own files (a small service worker), so the link also opens without internet.
- **Organizer:** *Attendees > ... > Ticket* shows the picture with a style switch, **Save ticket (PNG)**, **Share image**, link, WhatsApp and email. *Email tickets* has the same style switch and a live preview.
- **Automatic (SMTP) emails** show the attendee's own ticket picture inside the email **and attach it** as `ticket-<name>.png`. **My mail app** mode sends the ticket link, which opens the same picture (a web page cannot attach files to another mail app).
- The QR is the same `CEM1:<event code>:<ticket id>` as before. Scanning, offline check-in and the one-use rule are unchanged. Old ticket links keep working. Firestore rules are **unchanged** and the Android app needs **no new plugin**.

### Files
In `www/` add (new): `ticketart.js`, `ticket-sw.js`. Replace: `ticket.html`, `scan.js`, `mailer.js`, `index.html`, `help.js`, `ui.js`.
In `worker/` replace: `otp-worker.js` (and optionally `wrangler.toml`; only a comment changed).
In the repo root replace: `package.json`, `README.md`, `SETUP.md`. Add `release-notes/v3.11.0.md`. In `tests/` replace `test-worker.mjs`.
`index.html` only gained one line (`<script src="ticketart.js"></script>` before `scan.js`).

### Steps (about 10 minutes)

**Part A: website (works as soon as it is published)**
1. Upload the files above, commit, and let the *pages* workflow publish the site.
2. Open an event > **Attendees** > an attendee's **...** > **Ticket (QR)**. The ticket picture appears. Try the **Gradient / Flat** switch and **Save ticket (PNG)**.
3. Open the ticket link on a phone. Save the picture, then switch on airplane mode and open the link again: it still opens.

**Part B: automatic emails with the picture attached: update the Worker once (administrator, about 3 minutes)**

Same steps as in 3.10.0, Part B. **No new variable or secret.**
1. Cloudflare dashboard > **Workers & Pages** > your Worker (`cem-otp`) > **Edit code**.
2. Select everything, delete it, paste the whole content of `worker/otp-worker.js` from this release, and press **Deploy**.
3. In the app: **Email tickets > Automatic (SMTP) > Send a test email to me**. The email shows the ticket picture and has `ticket-asha-rao.png` (or similar) attached.

If you skip Part B nothing breaks: emails still go out with the small QR picture like in 3.10.x, and the app shows a note that the Worker is older.

**Part C: the Android app**
Run **Actions > Build APK > Run workflow** as usual. The version becomes 3.11.0. No new plugin, permission or signing change. In the app, **Save ticket (PNG)** opens the phone's share sheet (Save to Drive, WhatsApp, Files, Gallery).

### What changed under the hood
- `ticketart.js` draws the picture on a canvas (720 x 1440 px, saved as a 256-colour PNG of about 40-70 KB so emails stay light). One drawing routine serves the organizer window, the emailed picture and the attendee page, so they always match.
- The ticket link now also carries `tm` (time), `ty` (event type) and `s` (look, only when it is Flat): `ticket.html#e=...&r=...&n=...&t=...&d=...&tm=19:30&ty=Seminar&s=flat`.
- The Worker accepts `ticket` (PNG as base64, up to about 520 KB) and `file` per email, shows the picture inline and attaches it. Its answer now includes `ticketPng:true`, which is how the app knows the Worker is current.
- Because every email is a little bigger, automatic sending goes **4 emails per request** (was 8).
- `ticket-sw.js` only answers for `ticket.html` and the few files it needs (network first, so updates always win). Everything else in the app goes to the network exactly as before.

### Rolling back
Restore the 3.10.0 versions of the changed files and delete `ticketart.js` and `ticket-sw.js`. The 3.11.0 Worker also works with the 3.10.0 app. Ticket links created by 3.11.0 still open in 3.10.0 (they show the plain QR).

### Troubleshooting
| What you see | Cause and fix |
| --- | --- |
| The ticket shows a plain QR, not the picture | `ticketart.js` was not uploaded to `www/`, or `ticket.html` is the old file. Upload both and redeploy. |
| Emails arrive with a small QR only, and the app says the email service is an older version | The Worker was not updated. Do Part B. |
| *A ticket picture is not valid* | The Worker is new but the browser sent something that is not a PNG. Reload the app (hard refresh) so it loads the new `mailer.js` and `ticketart.js`. |
| Worker logs show *Exceeded CPU* | On the free plan, lower `BATCH` in `www/mailer.js` from 4 to 2. |
| The ticket link does not open offline | Open it once with internet first (the phone then keeps the page). Browsers that block service workers (some private modes) cannot do this; the saved PNG always works. |
| Text looks different in the picture | The bundled Poppins font did not load. Check that `www/fonts/` and `www/fonts.css` are uploaded. |


## Upgrade to 3.10.0: bulk ticket email (your mail app, or automatic SMTP)

Organizers no longer send tickets one by one. **Attendees > Email tickets** sends every attendee their own message with their own name and their own QR ticket, from the organizer's **own mailbox**. Two ways:

- **My mail app:** the phone's or computer's mail app opens pre-filled for each attendee; tap Send, come back, tap *Open next*. Needs no setup at all.
- **Automatic (SMTP):** the organizer enters their own Gmail / Zoho / Brevo / college mail login once, and the app sends every email by itself (8 at a time in 3.10.0, 4 at a time since 3.11.0, with progress and retry), each with the attendee's QR picture inside.

Nothing has to be switched on per organizer. The button appears for every role that has the **Attendees and check-in** permission (Organizer, Manager, Treasurer, Team lead, Coordinator, Registration desk, and custom roles with it), the moment they have that role. Firestore rules are **unchanged**, and the Android app needs **no new plugin**.

### Files
In `www/` add (new): `mailer.js`. Replace: `index.html`, `event.js`, `scan.js`, `help.js`, `ui.js`.
In `worker/` replace: `otp-worker.js` (and optionally `wrangler.toml`).
In the repo root replace: `package.json`, `README.md`, `SETUP.md`. Add `release-notes/v3.10.0.md`.
Only `index.html`, `event.js`, `scan.js`, `help.js` and `ui.js` had a few lines changed; everything else in them is as before.

### Steps (about 15 minutes)

**Part A: website and "My mail app" mode (works as soon as the site is published)**
1. Upload the files above to your GitHub repository (same way as earlier upgrades), commit, and let the *pages* workflow publish the site.
2. Open the site, sign in, open an event with attendees, go to **Attendees** and tap **Email tickets**. Done: the mail-app mode works now.

**Part B: Automatic (SMTP) mode: update the Worker once (administrator, about 5 minutes)**

This reuses the Worker you already made in *Upgrade to 3.2.0*. **No new variable, secret or Worker is required.** It already has the Firebase project (`FIREBASE_SA`), the `OTP_KV` store and your `ALLOWED_ORIGINS`.
1. Cloudflare dashboard > **Workers & Pages** > your Worker (`cem-otp`) > **Edit code**.
2. Select everything in the editor, delete it, paste the whole content of `worker/otp-worker.js` from this release, and press **Deploy**.
3. Check that `ALLOWED_ORIGINS` (Settings > Variables) contains your website address, `https://localhost` and `capacitor://localhost` (the Android app). If sign-up already works in the website and the APK, it does.
4. `www/firebase-config.js` already has `window.OTP_API = "https://...workers.dev"` from 3.2.0. The email service uses the same address. Nothing to change.
5. Open `https://YOUR-WORKER.workers.dev/` in a browser: it must show `{"ok":true,"service":"campus-events-otp"}`.
6. In the app: **Email tickets > Automatic (SMTP)**, choose a provider, **Test connection**, then **Send a test email to me**.

Optional Worker settings (Settings > Variables and Secrets, type *Text*):

| Name | What it does |
| --- | --- |
| `MAIL_DAILY_LIMIT` | Emails one signed-in person may send per day through your Worker. Default 1000. |
| `SMTP_ALLOWED_HOSTS` | Comma list such as `smtp.gmail.com,smtp-relay.brevo.com`. Only those mail servers can be used. Leave out to allow any. |

**Part C: the Android app**
1. Run **Actions > Build APK > Run workflow** as usual. The version becomes 3.10.0 and the new screen is inside the APK, because the app is the `www/` folder. No new Android plugin, permission or signing change.
2. Install the new APK over the old one. In the app, the mail-app mode opens Gmail (or whichever mail app is the phone's default); press Back after sending to return. SMTP mode works over the normal internet connection.

### Which mail account should organizers use?
| Provider | Setup | Notes |
| --- | --- | --- |
| Gmail or Google Workspace | Turn on 2-Step Verification, create an **App password** (Google account > Security). Server `smtp.gmail.com`, port 465, username = full email. | About 500 recipients a day (2,000 on Workspace). A college administrator may have switched App passwords off. |
| Brevo | Verify your sender, then SMTP & API > create an **SMTP key**. Server `smtp-relay.brevo.com`, port 587. Username = the SMTP login Brevo shows; fill **Send from** with the verified sender. | Free plan: 300 a day. |
| Zoho Mail | App-specific password. Server `smtp.zoho.in` (India) or `smtp.zoho.com`, port 465. | |
| Yahoo | App password. Server `smtp.mail.yahoo.com`, port 465. | |
| Outlook / Microsoft 365 | Server `smtp.office365.com`, port 587. | Microsoft switches off password SMTP by default at the end of December 2026, so do not rely on it. |

### Test checklist (10 minutes, test event with 3 attendees that have email addresses you own)
1. Attendees tab shows **Email tickets** (as Organizer). Sign in as a Viewer on a second account: the button is not there.
2. Open it. The preview shows the first attendee's name, the event and a ticket link.
3. **My mail app:** tap *Open next*. The mail app opens addressed to the first attendee with the message filled in. Send it, come back, tap again for the second. The attendee list now shows **Emailed** tags.
4. Open the ticket link from the email on a phone: the QR page appears. Scan it with **Scan tickets** in the app: it checks the person in.
5. **Automatic:** choose Gmail (or another), **Test connection** says *Connected and logged in*, **Send a test email to me** arrives in your inbox with the QR picture. Then *Everyone with an email* > send. Progress reaches 100 % and your own mailbox's Sent folder shows the emails.
6. Put a wrong password on purpose: the message says to use an app password. Use a made-up address for one attendee: that one is listed as failed and the others still go out.

### How it works
- The QR is the ticket the app already had: `CEM1:<event code>:<ticket id>`. The email only carries it. Check-in, offline scanning and the one-use rule are unchanged.
- **My mail app** builds a `mailto:` link per attendee. A web page or app cannot press *Send* inside another mail app; that is why this mode is one tap per person.
- **SMTP:** a browser cannot speak SMTP, so the app sends each batch (8 emails in 3.10.0, 4 since 3.11.0 because each one now carries a ticket picture) to your Cloudflare Worker (`/mail/send`). The Worker first checks the caller's Firebase sign-in token against Google's public keys (signed-in app users only), then opens an encrypted connection (port 465, or 587 with STARTTLS; port 25 is blocked by Cloudflare) to the mail server, logs in with the organizer's own login, and sends. It refuses servers that cannot encrypt, never stores or logs the password, and counts emails per person per day.
- The organizer's SMTP login is kept only in that device's browser or app storage, never in Firestore, so teammates cannot read it. Tapping **Forget the saved login** removes it.
- Each attendee gets `ml` (time) and `mlv` (`app` or `smtp`) when emailed. These are ordinary fields of the attendee entry, so the existing rules already allow roles with *Attendees and check-in* to write them.

### Free-plan budget
- Cloudflare Workers free plan: 100,000 requests a day. A batch of 8 emails is one request (4 since 3.11.0), so 1,000 emails is about 125 requests (250 since 3.11.0). One KV write per batch (the daily counter): the KV free plan allows 1,000 writes a day, which the sign-up codes share. About 500 emails a day per organizer is comfortable; raise nothing unless you run many events on the same day.
- Free-plan Workers have a small CPU allowance per request. Batches are well inside it. If you ever see *Exceeded CPU* in the Worker logs, reduce `BATCH` in `www/mailer.js` (see the 3.11.0 section).
- Firebase: marking attendees as emailed is one small write per attendee.

### Rolling back
Restore the 3.8.0 versions of the changed files and delete `www/mailer.js`. The Worker keeps working for sign-up either way. Attendee entries may keep harmless `ml` and `mlv` fields.

### Troubleshooting
| What you see | Cause and fix |
| --- | --- |
| *needs the newer Worker* | The Worker still has the old code. Do Part B, steps 1 and 2. |
| *This app is not allowed to use the email service* | `ALLOWED_ORIGINS` in the Worker does not contain the address you opened the app from. Add it (website address, `https://localhost`, `capacitor://localhost`). |
| *Please sign in again* | The sign-in expired. Sign out and in. If it persists, `FIREBASE_SA` in the Worker belongs to a different Firebase project than the app. |
| *The mail server refused the login* | A normal password was used. Use an app password (Gmail, Yahoo, Zoho) or an SMTP key (Brevo). |
| *Could not connect* | Wrong server or port. Use 465 or 587. |
| *does not offer an encrypted connection* | The server is not suitable. Use port 465 or another provider. |
| *Daily limit reached* | The provider's limit or `MAIL_DAILY_LIMIT`. Continue tomorrow; *Not emailed yet* resumes where it stopped. |
| Emails go to Spam | Ask attendees to mark them *not spam*; send a test to yourself first; keep the message short. |
| Nothing opens in *My mail app* on a computer | No default mail app is set in the system. Set one, or use Automatic. |

## Upgrade to 3.8.0: smooth motion

3.8.0 is a **look-and-feel release**. The app now moves: screens rise in, numbers count up, progress bars fill, the active tab and menu marker glide, rows flash when you check someone in or tick a task, panels ease open, and menus, dialogs and toasts fade in and out. Nothing changes in Firebase, the rules, the Worker, the workflows or the signing key, and no new npm package is needed. Free plans only. It all runs on the phone and uses no extra data.

- **Nothing is hidden behind motion.** If the phone or browser is set to reduce motion, all of it is switched off and the app looks as it did before.
- **Typing never replays the entrance.** Search boxes and background syncs do not trigger it, so nothing flickers while you work.
- **The version is 3.8.0.** The APK version name is read from `www/ui.js`, so Build APK picks it up by itself.

**Files:** add the new `www/motion.js`, and replace `www/index.html`, `www/ui.js`, `package.json` and `SETUP.md`.

**Steps**
1. Commit the five files to `main`. Nothing builds by itself: Build APK and Deploy web version are both started by hand.
2. **Deploy the website.** Actions > **Deploy web version** > Run workflow. Open the site, refresh once, and check profile icon > About & updates: it shows **v3.8.0**. Open the Dashboard and the numbers count up.
3. **Build the APK.** Actions > **Build APK** > Run workflow. Type the release notes in the box (points separated by `|`) and keep **Publish a GitHub Release** ticked.
4. Optional: set `latest` to `3.8.0` in Firestore > `appconfig` > `version` so installed APKs see the banner. Do **not** raise `min`.

If something looks wrong, delete the `<script src="motion.js"></script>` line from `www/index.html` and redeploy: the app goes back to exactly how 3.7.2 looked.

## Upgrade to 3.7.2: no update banner on the website

3.7.2 is a **small fix**. The "Version x is available" banner and the "Update required" screen are only for the Android app. The website is always the latest deployed version, so it no longer shows them (and no longer reads `appconfig/version` from Firestore). Nothing changes in Firebase, the rules, the Worker, the workflows or the signing key.

**Files:** replace `package.json`, `SETUP.md`, `www/ui.js` and `www/help.js`.

**Steps**
1. Commit the four files to `main`. Nothing builds by itself: Build APK and Deploy web version are both started by hand.
2. **Deploy the website.** Actions > **Deploy web version** > Run workflow. Open the site, refresh once, and check profile icon > About & updates: it shows **v3.7.2**, "Web version" and a **Reload** button.
3. **Build the APK.** Actions > **Build APK** > Run workflow. Type the release notes in the box (points separated by `|`) and keep **Publish a GitHub Release** ticked.
4. Optional: set `latest` to `3.7.2` in Firestore > `appconfig` > `version` so installed APKs see the banner. Do **not** raise `min`.

## Upgrade to 3.7.0: new brand, logo and icons

3.7.0 is a **look-and-feel release**. There is nothing to change in Firebase, no new npm package, no change to the workflows, the Worker or the signing key, and the rules are unchanged. Free plans only. Allow about 10 minutes.

**Read this first**
- **No data is touched.** Events, members, roles and registration pages stay exactly as they are. Registration pages that picked the "Indigo night" background keep it (it is now called **Midnight** in the drop-down; the stored value is still `indigo`). Pages that chose their own accent colour keep it.
- **The version is 3.7.0.** The APK version name is read from `www/ui.js`, so Build APK picks it up by itself. Optionally set `latest` to `3.7.0` in Firestore > `appconfig` > `version` so existing users see the update banner. Do **not** raise `min`: nothing in 3.7.0 is required.
- **Link previews.** `index.html`, `login.html` and `register.html` now carry Open Graph tags that point to `https://cem.deba.indevs.in/icons/og-image.png` (the address in `CNAME`). If you host the site somewhere else, replace that address in those three files.

### Files
In the repo root replace: `package.json`, `README.md`, `SETUP.md`.
In `scripts/` replace: `patch-android.sh`. In `scripts/` add (new): `patch-icons.sh`.
In `www/` replace: `index.html`, `login.html`, `register.html`, `pay.html`, `ticket.html`, `404.html`, `splash.css`, `event.css`, `ui.js`, `sync.js`, `signup.js`, `event.js`, `chat.js`, `scan.js`, `calc.js`, `help.js`.
In `www/` add (new): `favicon.ico`, `manifest.webmanifest`, and the folder `icons/` (10 files).
In the repo root add (new): the folder `brand/` (logo, icon generator and the Android launcher icons).
Not changed: `.github/`, `worker/`, `firestore.rules`, the other files in `www/`, `vendor/`, `fonts/`.

### Steps
1. **Upload the files** above to GitHub and commit to `main`. Keep the folder structure (`www/icons/...`, `brand/android/res/...`). Build APK is started by hand (Actions > Build APK > Run workflow).
2. **Deploy the website.** Actions > **Deploy web version** > Run workflow. Open the site, refresh once, and check profile icon > About & updates shows **v3.7.0**.
3. **Install the new APK** over the old one. The launcher icon and round icon are now the new "E" logo.
4. **Run the check list below.**

### What is new
- **New logo** (the rounded "E") in the loading screen, the sign-in, registration, payment and ticket pages and the app header.
- **New colours.** Primary `#5948F5` (buttons, links, logo), Warm Amber `#FFB547` (unread dots, count badges on tabs, the loading ring), Midnight Navy `#10172B` (dark theme and the sign-in and public pages), Cloud White `#F6F7FB` (light theme) and Fresh Mint `#35C9A5` (check-ins, completed tasks and progress). The pink-to-blue gradients are gone: buttons are solid.
- **Dark theme** uses a lighter tint of the primary (`#8F84FF`) for links and buttons, because `#5948F5` alone is too dark to read on navy. Success text on light backgrounds uses a deeper mint (`#087A62`) for the same reason; Fresh Mint itself is used for fills and in the dark theme.
- **Favicon, home-screen icon and web manifest.** Browser tab icon, iPhone and Android "Add to home screen" icon, and a link-preview image for shared registration links. There is no service worker, so nothing is cached for offline use and nothing else changes.
- **Android launcher icon and launch image.** `scripts/patch-android.sh` now also runs `scripts/patch-icons.sh`, which copies `brand/android/res` over the icon files Capacitor generates. It only replaces files that already exist under the same name, so it cannot break the Gradle build.
- **Event-type tags** adapt to the theme so they stay readable in dark mode. Seminar now uses the primary colour.

### Check list (5 minutes)
1. Open the site: browser tab shows the new E icon; the loading screen shows the E with an amber ring.
2. Sign in. Header shows the new logo; buttons are solid indigo. Open the profile icon menu and tap **Theme** until it says dark: buttons and the active tab turn a lighter indigo.
3. Event > Registration: a pending-registration count shows as an **amber** badge. Task progress and seats-filled bars fill in **mint**.
4. Open a registration link (`/r/<name>`) on a phone: navy page with the new logo. Share the link in a chat app: the preview shows the new image (some apps cache old previews for a few days).
5. Install the APK: the launcher icon is the new E. On Android 11 and older the app also opens on a navy launch screen; Android 12 and newer show their own system launch screen with the app icon.

### Changing the logo or colours later
Edit `brand/logo.svg` (and the shapes at the top of `brand/make-icons.py` if the logo geometry changes), then run `pip install cairosvg pillow fonttools brotli` and `python3 brand/make-icons.py` from the repo root. It rewrites every icon under `www/` and `brand/android/res`. The colour values used in the app are listed in `brand/README.md`.

### Rolling back
Restore the 3.6.1 versions of the files listed above and delete the new ones. Nothing in Firebase needs to change.

### Troubleshooting
| What you see | Cause and fix |
| --- | --- |
| The old icon still shows in the browser tab | Browsers cache favicons hard. Close the tab, or open `/favicon.ico` and refresh it once. |
| The APK still has the old launcher icon | The `brand/` folder was not uploaded, or the Build APK log says `brand/android/res not found`. Upload `brand/android/res/...` with its sub-folders and run Build APK again. Uninstall and reinstall if the phone launcher keeps the old picture. |
| Link preview shows no image | Check that `https://<your-site>/icons/og-image.png` opens, and that the address in the `og:image` tags matches your site. Chat apps cache previews; try a new link. |
| Icons missing on the site | The `www/icons/` folder or `www/manifest.webmanifest` was not uploaded, or the website was not redeployed. |
