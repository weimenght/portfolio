# Twilight Handoff — setup

## Files

| File | Purpose |
|---|---|
| `index.html` | The app |
| `sw.js` | Service worker: offline shell + push notifications |
| `manifest.json`, `icon*.png`, `icon.svg`, `apple-touch-icon.png` | Install-to-home-screen metadata and icons |
| `migration.sql` | New columns and tables — **required** |
| `supabase/functions/notify/index.ts` | Edge function that sends push notifications — optional |
| `supabase.txt` | Your keys (you create this; not included) |

Serve the whole folder over HTTPS, as before.

## 1. Run the migration (required)

Paste `migration.sql` into Supabase → SQL Editor and run it. It adds:

- `accounts`: `lat`, `lon`, `tz`, `sleep_start`, `sleep_end`
- `capsules`: `deliver_at`, `guess_score`, `unlocked_at`, `notified_at`
- a new `push_subscriptions` table

Existing accounts keep working. Each account's coordinates are filled in automatically the next time that person opens the app.

## 2. supabase.txt

```
SUPABASE_URL=your-project-ref
SUPABASE_ANON_KEY=eyJ...
VAPID_PUBLIC_KEY=BD...        # optional, only for push notifications
```

The plain 3-line format (URL / anon key / VAPID public key) also works.

## 3. Push notifications (optional)

Without this step, everything else works, and the Account screen shows "Push isn't set up".

1. Generate VAPID keys: `npx web-push generate-vapid-keys`
2. Put the **public** key in `supabase.txt`, as shown above.
3. Deploy the function and set its secrets:
   ```bash
   supabase functions deploy notify --no-verify-jwt
   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... \
     VAPID_SUBJECT=mailto:you@example.com WEBHOOK_SECRET=$(openssl rand -hex 24)
   ```
4. Create a webhook in Database → Webhooks with these settings:
   - Table: `capsules`
   - Events: Insert and Update
   - Type: Supabase Edge Function → `notify`
   - HTTP header: `x-webhook-secret: <WEBHOOK_SECRET>`
5. For scheduled ("deliver when they wake") capsules, enable `pg_cron` and `pg_net`, then run the commented `cron.schedule` block at the bottom of `migration.sql`.
6. In the app, go to Account → Notifications → Turn on.

On iPhone, this requires iOS 16.4 or later and the app added to the Home Screen.
