-- Twilight Handoff — schema additions for the improved app.
-- Run once in Supabase → SQL Editor. Safe to re-run.
-- (Pairing / RLS on accounts & capsules are intentionally NOT changed here.)

-- ── accounts: stored coordinates + personal sleep hours ─────────────────────
alter table public.accounts add column if not exists lat double precision;
alter table public.accounts add column if not exists lon double precision;
alter table public.accounts add column if not exists tz  text;
alter table public.accounts add column if not exists sleep_start smallint not null default 23;
alter table public.accounts add column if not exists sleep_end   smallint not null default 7;

do $$ begin
  alter table public.accounts add constraint accounts_sleep_hours_chk
    check (sleep_start between 0 and 23 and sleep_end between 0 and 23);
exception when duplicate_object then null; end $$;

-- ── capsules: scheduled delivery, guess score, notification bookkeeping ─────
alter table public.capsules add column if not exists deliver_at  timestamptz;
alter table public.capsules add column if not exists guess_score real;
alter table public.capsules add column if not exists unlocked_at timestamptz;
alter table public.capsules add column if not exists notified_at timestamptz;

create index if not exists capsules_sender_created_idx   on public.capsules (sender_id, created_at desc);
create index if not exists capsules_receiver_created_idx on public.capsules (receiver_id, created_at desc);
create index if not exists capsules_due_idx on public.capsules (deliver_at) where notified_at is null;

-- ── push subscriptions (one row per device/browser) ─────────────────────────
create table if not exists public.push_subscriptions (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  lang       text not null default 'en',
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "own push subscriptions" on public.push_subscriptions;
create policy "own push subscriptions" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── realtime: make sure both tables broadcast changes ───────────────────────
do $$ begin
  alter publication supabase_realtime add table public.accounts;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.capsules;
exception when duplicate_object then null; end $$;

-- ── scheduled-capsule sweep (only needed for push notifications) ────────────
-- Enable the pg_cron and pg_net extensions (Database → Extensions), then
-- replace <PROJECT_REF> and <WEBHOOK_SECRET> and run:
--
-- select cron.schedule(
--   'handoff-deliver-sweep',
--   '*/5 * * * *',
--   $$
--   select net.http_post(
--     url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/notify',
--     headers := jsonb_build_object('Content-Type', 'application/json',
--                                   'x-webhook-secret', '<WEBHOOK_SECRET>'),
--     body    := '{"sweep": true}'::jsonb
--   );
--   $$
-- );
