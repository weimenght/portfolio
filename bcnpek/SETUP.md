# Twilight Handoff — Setup Guide

This guide takes you from nothing to a working, private app for two people. It takes about 20 minutes, plus another 15 if you want push notifications.

If you are **upgrading an existing installation**, follow every step too. Step 4 tells you what happens to your existing data.

---

## 0. What's in the folder

| File | What it is | Where it goes |
|---|---|---|
| `index.html` | The app | Your web host |
| `sw.js`, `manifest.json`, `icon.svg`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` | Offline support, install-to-home-screen and icons | Your web host, same folder |
| `supabase.txt.example` | Template for your public connection settings | Copy to `supabase.txt` on your web host |
| `schema.sql` | The whole database: tables, security rules, functions and storage | Paste into the Supabase SQL Editor once |
| `supabase/functions/notify/index.ts` | Sends push notifications (optional) | Deployed to Supabase with the CLI |

---

## 1. What the security fixes do

| Problem before | Now |
|---|---|
| Your "partner" was whoever last updated their account, so any third sign-up could appear as your partner | You **pair once with a 6-character invite code**. It is single-use and expires after 24 hours. Only the two paired accounts can see each other. |
| Incoming messages weren't filtered by recipient | The server returns only capsules **sent by you or addressed to you** |
| The "locked" text was sent to the browser, where it was readable in developer tools | The full text lives in a table nobody can read directly (`capsule_secrets`). It is returned **only after the receiver unlocks**, and the guess is scored on the server. |
| No Row Level Security, so anyone with the public key could read or change everything | RLS is on for **every table**. You can only change your own profile fields. Messages, pairing and unlocking go through checked server functions. |
| Voice clips were public links | The voice-clip bucket is **private**. Clips play through signed links that expire after 1 hour, and your partner's link works only after they unlock. |
| Realtime broadcast every change to everyone | Realtime subscribes **only** to your row, your partner's row and capsules involving you, with RLS enforced on top |
| Usernames became fake `name@handoff.app` emails, a domain someone else owns | **Real email addresses** by default. Usernames only work with a domain you own (step 3d). The app also refuses to start if someone pastes the secret service key into `supabase.txt`. |

---

## 2. Create the Supabase project

1. Go to <https://supabase.com>, sign in and click **New project**.
2. Choose a name (e.g. `handoff`), set a strong **database password** and store it somewhere safe.
3. Pick the **region** closest to the two of you, or halfway between you if you're far apart.
4. Wait about 2 minutes for the project to finish setting up.

> Upgrading? Make a backup first. Go to **Database → Backups**, or in **SQL Editor** export your `accounts` and `capsules` tables as CSV.

---

## 3. Authentication settings

Open **Authentication** in the left sidebar. Dashboard menu names occasionally move; search the dashboard for the setting name if you can't find it.

### 3a. Email sign-in
**Authentication → Sign In / Providers → Email**
- **Enable Email provider:** on
- **Minimum password length:** 8 or more. The app's own minimum is 6, and the server's setting wins.

### 3b. Confirm email: choose one

**Option A — On (recommended).** Each person confirms their address once from an email.
1. **Authentication → URL Configuration**
   - **Site URL:** your app's address, e.g. `https://handoff.yourname.com/`
   - **Redirect URLs:** add the same address. Add `http://localhost:8080/` too if you test locally.
2. Supabase's built-in email sender is rate-limited and meant for testing. For two people it is usually enough. If confirmation emails don't arrive, set up your own SMTP under **Authentication → Emails → SMTP Settings** (Resend, Postmark, Brevo and similar services work).

**Option B — Off.** Sign-up logs you straight in. This is simpler, and fine for a private two-person app, as long as you complete step 3c.

The app handles both options. With A, it shows "Check your inbox…" after sign-up. After confirming, you return and sign in.

### 3c. Close sign-ups once you both have accounts (important)
After you **both** have accounts and have paired (step 8), go to **Authentication → Sign In / Providers** and turn **off "Allow new users to sign up"**. Nobody else can then create an account. That isn't needed for privacy, but it keeps the project tidy.

### 3d. Optional: sign in with a username instead of an email
Only do this if you own a domain.
- Turn **Confirm email** off (3b, option B).
- Add `USERNAME_DOMAIN=users.yourdomain.com` to `supabase.txt`. Typing `wei` then means `wei@users.yourdomain.com`.
- Supabase rejects some domains outright, such as `example.com` and very short domains. Use a real domain you control.
- Without this line, the sign-in field asks for an email address.

---

## 4. Create the database (`schema.sql`)

1. Open **SQL Editor → New query**.
2. Paste the **entire** contents of `schema.sql` and click **Run**.
3. You should see "Success. No rows returned". The script is safe to run again whenever you like.

**What it creates**
- `accounts`: one row per person. `partner_id` links the two of you.
- `capsules`: what both of you may see, such as the teaser, status, guess and score.
- `capsule_secrets`: the full text and voice-clip path. It has no read access at all; only the server functions return what you're allowed to see.
- `push_subscriptions`: one row per device that has notifications on.
- Server functions: `create_invite`, `accept_invite`, `unpair`, `send_capsule`, `get_capsules`, `unlock_capsule`.
- A trigger that creates your profile automatically when you sign up.
- The private `soundbites` storage bucket and its access rules (clips up to 2 MB, audio files only).
- Realtime for `accounts` and `capsules`. The secrets table is never broadcast.

**If you're upgrading**, the script also does the following automatically:
- Moves every old message's text and voice clip into `capsule_secrets`, then **deletes** the old `full_text` and `audio_url` columns from `capsules`.
- Removes all old (open) security policies.
- Makes the `soundbites` bucket private. Old clips keep working inside the app, and old public links stop working.
- Leaves you both **unpaired**. Pair once with an invite code (step 8). Your old messages stay in your history.

**Check it worked.** Run this in a new query:
```sql
select tablename, rowsecurity from pg_tables where schemaname = 'public' order by 1;
-- every row should show rowsecurity = true

select tablename, policyname, cmd from pg_policies where schemaname = 'public' order by 1, 2;
-- accounts: 3 policies, capsules: 1, push_subscriptions: 1, capsule_secrets: none (on purpose)
```

---

## 5. Check storage

Open **Storage**. You should see a bucket named **`soundbites`** marked **Private**. You don't need to change anything. Files are stored as `soundbites/<your user id>/<random name>`. Only you can upload into your own folder, and your partner can play a clip only after unlocking that capsule.

---

## 6. Check Realtime

Open **Database → Publications → `supabase_realtime`** and make sure **`accounts`** and **`capsules`** are switched on. `capsule_secrets` should **not** be listed. The SQL script already set this up.

---

## 7. Create `supabase.txt` and host the app

### 7a. Get your keys
Open **Project Settings → API Keys** (on older dashboards, **Project Settings → API**).
- **Project URL** or **Project ID**, e.g. `abcdefghijklmnop`
- **anon public** key, or the newer **Publishable** key (`sb_publishable_…`). Either works.

> **Never** use the `service_role` key or a **Secret** key (`sb_secret_…`) in the app. It bypasses every security rule. The app detects it and refuses to start.

The anon/publishable key is *meant* to be public. Everyone who opens the app downloads it. What keeps your data private is the database rules from step 4.

### 7b. Write `supabase.txt`
Copy `supabase.txt.example` to `supabase.txt` and fill it in:
```
SUPABASE_URL=abcdefghijklmnop
SUPABASE_ANON_KEY=eyJhbGciOi...
```

### 7c. Host it
Upload **all** the files from section 0, plus your `supabase.txt`, into one folder on any static host with **HTTPS**. HTTPS is required for the microphone, offline mode, install and notifications. Any of these work:
- **Netlify:** drag the folder onto <https://app.netlify.com/drop>
- **Cloudflare Pages**, **Vercel** or **GitHub Pages:** create a project from the folder or repository
- Your own server: any HTTPS web server serving the files as they are

If you use Option A in step 3b, the address you host at must match the **Site URL** you set there.

**Updating later:** replace the files. The service worker always checks for a new `index.html` first, so people get the update the next time they open the app.

---

## 8. First run: pair the two of you

1. **Both** open the app and choose **First-Time Setup**. Enter your email, a password, your name and your city (pick it from the suggestions).
2. Person A opens the app and taps **Create invite code**. A 6-character code appears. Tap **Share** to send it, or read it out.
3. Person B types the code under **Partner's code** and taps **Join**.
4. Both screens update straight away: clocks, weather, the "together window" and the composer appear.
5. Now do step 3c and turn off new sign-ups.

To unpair later, use **Account → Partner → Unpair**. Both of you keep your past capsules in the Timeline.

**Install it like an app.** On iPhone, open it in Safari and choose **Share → Add to Home Screen**. On Android or desktop Chrome, tap the ⬇ install button at the top, or use the browser menu's **Install app**.

---

## 9. Optional: push notifications

You'll get a notification when your partner leaves a capsule, when a scheduled capsule arrives, and when your capsule is unlocked. Notification text is in each person's chosen language. The full message is **never** included; only the teaser is shown.

### 9a. Create VAPID keys (once)
```bash
npx web-push generate-vapid-keys
```
Keep both keys. The **public** key goes into `supabase.txt`:
```
VAPID_PUBLIC_KEY=BPxxxxxxxx...
```

### 9b. Deploy the function
You need [Node.js](https://nodejs.org) installed. In a terminal, inside the project folder:
```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_ID
npx supabase functions deploy notify --no-verify-jwt
npx supabase secrets set \
  VAPID_PUBLIC_KEY="BP..." \
  VAPID_PRIVATE_KEY="..." \
  VAPID_SUBJECT="mailto:you@example.com" \
  WEBHOOK_SECRET="$(openssl rand -hex 24)"
```
Write down the `WEBHOOK_SECRET` value you set; you need it in 9c and 9d. On Windows without `openssl`, use any long random string.

`--no-verify-jwt` is correct here. The function checks its own `x-webhook-secret` header instead, and rejects any request without it.

### 9c. Database webhook (new capsules, unlocks)
**Database → Webhooks → Create a new hook** (enable webhooks first if asked):
- **Name:** `notify`
- **Table:** `capsules`
- **Events:** ✅ Insert ✅ Update
- **Type:** *Supabase Edge Functions*, then choose `notify`
- **Method:** POST
- **HTTP headers:** add `x-webhook-secret` = *your WEBHOOK_SECRET*

### 9d. Scheduled delivery sweep ("deliver when they wake")
1. **Database → Extensions:** enable **pg_cron** and **pg_net**.
2. In **SQL Editor**, run the commented block at the very bottom of `schema.sql`. Remove the `--` at the start of each line and replace `<PROJECT_REF>` and `<WEBHOOK_SECRET>`. It checks every 5 minutes for capsules that have just become due.

### 9e. Turn notifications on
In the app, open **Account → Notifications → Turn on** on each device.
- **iPhone/iPad:** requires iOS 16.4 or later **and** the app added to the Home Screen first. Open it from the Home Screen icon, then turn notifications on.
- **Android/desktop:** works directly in Chrome, Edge and Firefox.

---

## 10. Who can see what

| Data | You | Your partner | Anyone else (even with the public key) |
|---|---|---|---|
| Your profile (name, city, mood, sleep hours) | read & edit | read | nothing |
| Your pairing (`partner_id`, invite code) | read; change only via invite / unpair | read | nothing |
| A capsule you sent | everything | teaser once delivered; full text and audio **after they unlock** | nothing |
| Guess & score | sees their guess | sees own guess | nothing |
| Voice clip files | your own | after unlocking | nothing |
| Push subscriptions | your own devices | nothing | nothing |

Deleting a person under **Authentication → Users** deletes their profile, capsules, secrets and push subscriptions with them.

---

## 11. Troubleshooting

| What you see | What to do |
|---|---|
| "Email address … is invalid" at sign-up | Supabase rejects some domains (e.g. `example.com`, very short domains). Use a real address, or a real domain for `USERNAME_DOMAIN`. |
| "Check your inbox…" but no email arrives | Check spam. The built-in sender is rate-limited, so set up SMTP (step 3b) or switch Confirm email off. |
| The confirmation link opens the wrong site | Set **Site URL** and **Redirect URLs** (step 3b) to the address you host the app at. |
| "Please sign in with your email address" | You typed a username, but `USERNAME_DOMAIN` isn't set. Use your email address (step 3d). |
| Banner: "supabase.txt not found" or "Unsafe key" | `supabase.txt` is missing, isn't next to `index.html`, or contains a secret key. Use the anon/publishable key. |
| "That code is wrong or has expired" | Codes are single-use and last 24 hours. Create a new one. |
| "One of you is already paired" | That person must unpair first (Account → Partner → Unpair). |
| Something fails with "permission denied" | Run `schema.sql` again. It's safe to repeat. |
| Partner's changes only show after reloading | Check step 6, i.e. that both tables are in the `supabase_realtime` publication. |
| A voice clip won't play after the app has been open a long time | Links expire after an hour. Switch away from the app and back (it refreshes them), or reload. |
| "Microphone unavailable" | The page must be on **HTTPS**, and the browser must be allowed to use the microphone. |
| Notifications don't arrive | Check the webhook header matches `WEBHOOK_SECRET`. Check **Edge Functions → notify → Logs**. On iPhone, open the app from the Home Screen icon. |

---

## 12. Good to know

- **Invite codes** use 32 easy-to-read characters, about a billion combinations. They are single-use, expire after 24 hours, and only work while both people are unpaired.
- **Scheduled capsules:** the app hides the teaser until delivery time. Someone determined who queried the database directly before then could see only the teaser (the last few words), never the message.
- **The guess score** compares your guess to the hidden part of the sentence, letter pair by letter pair. It works for Chinese as well as European languages: 85% or more is "Spot on", 55% or more is "So close".
- **Limits:** messages up to 500 characters in the app (1,000 enforced by the server), voice clips up to 6 seconds and 2 MB, scheduled delivery up to 2 days ahead.
