# AI helper: setup (about 10 minutes, works from a phone browser)

Adds a ✨ AI button inside every open event. It drafts event descriptions, payment links, registration questions, tasks and items to buy.
It only proposes. You tap **Confirm** before anything is saved.

## Privacy in one minute
- Names of your team are swapped for codes (P1, P2) on the phone, and emails, phone numbers, UPI IDs, ID numbers and links are swapped for placeholders. The Worker checks again.
- Never sent: attendee lists, registrations, payments, UPI IDs and payee names (typed on the phone only), budgets, tickets, chat.
- The Worker keeps no message text, only a per-user daily count under a hashed ID.
- Google's **free** plan may use prompts to improve its products. The app shows this notice before first use. For stricter privacy, link billing to the Google project (paid plan: not used to improve products).

## 1. Get the free key (Google AI Studio)
1. Open aistudio.google.com/apikey, sign in, **Create API key**. No card needed.
2. The key may start with `AQ.` (new format). That is normal.
3. Do not link a billing account if you want to stay free.

## 2. Update the Worker (Cloudflare dashboard)
1. Workers & Pages > **cem-otp** > **Edit code**.
2. Replace everything with the new `otp-worker.js` and **Deploy**.
3. **Settings > Variables and Secrets > Add**:
   - Type **Secret**, name `GEMINI_API_KEY`, value = your key.
   - Optional text vars: `GEMINI_MODEL` (default `gemini-3.8-flash`), `GEMINI_FALLBACK_MODEL` (used when Google says the main model is busy; default `gemini-3.6-flash`, `off` to disable), `AI_DAILY_LIMIT` (default `40` messages per user per day).
4. Your existing `ALLOWED_ORIGINS` and the `OTP_KV` binding are reused. Nothing else to add.

## 3. Update the app
1. Add the new file `www/ai.js`.
2. In `www/index.html`, add `<script src="ai.js"></script>` right after the line `<script src="help.js"></script>` (already done in the updated file).
3. Replace `www/privacy.html` with the updated one (new "AI helper" section).
4. Commit. Your usual build/deploy publishes the site and the APK.

## 4. Try it
Sign in, open an event, tap **✨ AI**, accept the notice, then try:
- "Write a short, exciting description"
- "Payment link for the entry fee, 150 rupees" (type payee and UPI ID in the card)
- "Assign poster printing to <teammate> by Friday"
- "Buy 6 rolls of masking tape, about 40 rupees each"
- "Add registration questions for a workshop"

## If something fails
| Message | Fix |
|---|---|
| "The AI helper is not set up yet" | Add the `GEMINI_API_KEY` secret and redeploy. |
| "The AI service refused the request" | Worker > Logs shows a reason code. `ACCESS_TOKEN_TYPE_UNSUPPORTED`: the key type is not accepted on this route, create a new key in AI Studio. `NOT_FOUND`: set `GEMINI_MODEL` to a model listed in AI Studio. |
| "Google's AI is busy right now" | Google answered 503 (overloaded). The Worker already retries once and then tries the fallback model. Wait a minute and resend. |
| "free AI limit is reached" | Wait a minute. The free plan has low per-minute limits. |
| "Sign in to use the AI helper" | The helper needs a signed-in account. |

KV note: each AI message writes one counter to `OTP_KV` (Cloudflare's free plan allows 1,000 writes a day, shared with sign-up codes).

## Tests
`node tests/test-ai.mjs` (Worker) and `npm install --no-save jsdom && node tests/test-ai-client.mjs` (panel).
