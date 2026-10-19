-- =============================================================================
-- Twilight Handoff — secure database schema
-- Run the whole file in Supabase → SQL Editor → New query → Run.
-- Safe to run on a fresh project AND on a project that already has the old
-- `accounts` / `capsules` tables (existing data is migrated). Safe to re-run.
--
-- What this sets up
--   • accounts          one row per person; partner_id links exactly two people
--   • capsules          what both partners may see (teaser, status, guess)
--   • capsule_secrets   the full text + voice-clip path — never readable directly;
--                       only returned by the functions below once allowed
--   • push_subscriptions  one row per device for notifications
--   • RPC functions     create_invite / accept_invite / unpair /
--                       send_capsule / get_capsules / unlock_capsule
--   • Row Level Security on every table, column-level write limits
--   • private `soundbites` bucket with per-capsule read access
--   • a trigger that creates the profile row when someone signs up
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TABLES
-- -----------------------------------------------------------------------------
create table if not exists public.accounts (
  id                uuid primary key references auth.users (id) on delete cascade,
  email             text,
  name              text not null default '',
  city              text not null default '',
  lat               double precision,
  lon               double precision,
  tz                text,
  sleep_start       smallint not null default 23,
  sleep_end         smallint not null default 7,
  mood              text not null default 'warm',
  partner_id        uuid,
  invite_code       text,
  invite_expires_at timestamptz,
  updated_at        timestamptz not null default now()
);

-- Columns that older versions of the table may be missing
alter table public.accounts add column if not exists email             text;
alter table public.accounts add column if not exists lat               double precision;
alter table public.accounts add column if not exists lon               double precision;
alter table public.accounts add column if not exists tz                text;
alter table public.accounts add column if not exists sleep_start       smallint not null default 23;
alter table public.accounts add column if not exists sleep_end         smallint not null default 7;
alter table public.accounts add column if not exists mood              text not null default 'warm';
alter table public.accounts add column if not exists partner_id        uuid;
alter table public.accounts add column if not exists invite_code       text;
alter table public.accounts add column if not exists invite_expires_at timestamptz;
alter table public.accounts add column if not exists updated_at        timestamptz not null default now();

do $$ begin
  alter table public.accounts add constraint accounts_partner_fk
    foreign key (partner_id) references public.accounts (id) on delete set null;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.accounts add constraint accounts_sleep_hours_chk
    check (sleep_start between 0 and 23 and sleep_end between 0 and 23);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.accounts add constraint accounts_not_self_partner_chk check (partner_id is null or partner_id <> id);
exception when duplicate_object then null; end $$;

create unique index if not exists accounts_invite_code_key on public.accounts (invite_code) where invite_code is not null;
create index if not exists accounts_partner_idx on public.accounts (partner_id);

create table if not exists public.capsules (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references public.accounts (id) on delete cascade,
  receiver_id  uuid references public.accounts (id) on delete cascade,
  sender_name  text not null default '',
  sender_city  text not null default '',
  teaser       text not null default '',
  sound_only   boolean not null default false,
  deliver_at   timestamptz,
  unlocked     boolean not null default false,
  guess        text not null default '',
  guess_score  real,
  unlocked_at  timestamptz,
  notified_at  timestamptz,
  created_at   timestamptz not null default now()
);

alter table public.capsules add column if not exists sender_name text not null default '';
alter table public.capsules add column if not exists sender_city text not null default '';
alter table public.capsules add column if not exists teaser      text not null default '';
alter table public.capsules add column if not exists sound_only  boolean not null default false;
alter table public.capsules add column if not exists deliver_at  timestamptz;
alter table public.capsules add column if not exists unlocked    boolean not null default false;
alter table public.capsules add column if not exists guess       text not null default '';
alter table public.capsules add column if not exists guess_score real;
alter table public.capsules add column if not exists unlocked_at timestamptz;
alter table public.capsules add column if not exists notified_at timestamptz;
alter table public.capsules add column if not exists created_at  timestamptz not null default now();

create index if not exists capsules_sender_created_idx   on public.capsules (sender_id, created_at desc);
create index if not exists capsules_receiver_created_idx on public.capsules (receiver_id, created_at desc);
create index if not exists capsules_due_idx on public.capsules (deliver_at) where notified_at is null;

-- capsule_secrets.capsule_id must have the same type as capsules.id
-- (uuid on fresh projects; whatever the old table used otherwise).
do $$
declare id_type text;
begin
  select format_type(a.atttypid, a.atttypmod) into id_type
  from pg_attribute a
  where a.attrelid = 'public.capsules'::regclass and a.attname = 'id';

  execute format($f$
    create table if not exists public.capsule_secrets (
      capsule_id  %s primary key references public.capsules (id) on delete cascade,
      full_text   text not null default '',
      hidden_part text,
      audio_path  text
    )$f$, id_type);
end $$;

create index if not exists capsule_secrets_audio_idx on public.capsule_secrets (audio_path) where audio_path is not null;

-- Move secrets out of the old capsules table (old versions stored full_text /
-- audio_url there, readable by anyone with the anon key).
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'capsules' and column_name = 'full_text') then

    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'capsules' and column_name = 'audio_url') then
      execute $m$
        insert into public.capsule_secrets (capsule_id, full_text, audio_path)
        select id, coalesce(full_text, ''), substring(audio_url from '/soundbites/(.+)$')
        from public.capsules
        on conflict (capsule_id) do nothing
      $m$;
      execute $m$
        update public.capsules set sound_only = true
        where audio_url is not null and full_text in ('🎙️', '🎙️ (6s)')
      $m$;
    else
      execute $m$
        insert into public.capsule_secrets (capsule_id, full_text)
        select id, coalesce(full_text, '') from public.capsules
        on conflict (capsule_id) do nothing
      $m$;
    end if;

    alter table public.capsules drop column full_text;
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'capsules' and column_name = 'audio_url') then
    alter table public.capsules drop column audio_url;
  end if;
end $$;

create table if not exists public.push_subscriptions (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  lang       text not null default 'en',
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 2. HELPER FUNCTIONS (security definer: they read past RLS on purpose)
-- -----------------------------------------------------------------------------
create or replace function public.my_partner_id()
returns uuid
language sql stable security definer set search_path = public
as $$ select partner_id from public.accounts where id = auth.uid() $$;

-- Can the current user stream this voice clip?
create or replace function public.can_read_audio(p_path text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.capsule_secrets s
    join public.capsules c on c.id = s.capsule_id
    where s.audio_path = p_path
      and (c.sender_id = auth.uid() or (c.receiver_id = auth.uid() and c.unlocked))
  )
$$;

-- Sørensen–Dice similarity on character bigrams (works for Latin and CJK).
create or replace function public.dice_similarity(a text, b text)
returns real
language plpgsql immutable
as $$
declare
  ab text[]; bb text[]; x text; idx int; inter int := 0; na int; nb int;
begin
  a := regexp_replace(lower(coalesce(a, '')), '[[:space:][:punct:]]', '', 'g');
  b := regexp_replace(lower(coalesce(b, '')), '[[:space:][:punct:]]', '', 'g');
  if a = '' or b = '' then return 0; end if;
  if a = b then return 1; end if;
  ab := case when char_length(a) < 2 then array[a]
             else array(select substr(a, g, 2) from generate_series(1, char_length(a) - 1) g) end;
  bb := case when char_length(b) < 2 then array[b]
             else array(select substr(b, g, 2) from generate_series(1, char_length(b) - 1) g) end;
  na := cardinality(ab); nb := cardinality(bb);
  foreach x in array bb loop
    idx := array_position(ab, x);
    if idx is not null then inter := inter + 1; ab[idx] := null; end if;
  end loop;
  return (2.0 * inter) / (na + nb);
end
$$;

-- -----------------------------------------------------------------------------
-- 3. PROFILE CREATION ON SIGN-UP
--    Works even when email confirmation is on (no session at sign-up time).
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  num text := '^-?[0-9]+(\.[0-9]+)?$';
begin
  insert into public.accounts (id, email, name, city, lat, lon, tz)
  values (
    new.id,
    new.email,
    left(coalesce(nullif(trim(m->>'name'), ''), split_part(new.email, '@', 1)), 60),
    left(coalesce(m->>'city', ''), 100),
    case when (m->>'lat') ~ num then (m->>'lat')::double precision end,
    case when (m->>'lon') ~ num then (m->>'lon')::double precision end,
    nullif(left(coalesce(m->>'tz', ''), 64), '')
  )
  on conflict (id) do nothing;
  return new;
end
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 4. PAIRING
-- -----------------------------------------------------------------------------
create or replace function public.create_invite()
returns json
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  code text;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from public.accounts where id = me and partner_id is not null) then
    raise exception 'already_paired';
  end if;
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * 32)::int, 1);
    end loop;
    exit when not exists (select 1 from public.accounts where invite_code = code);
  end loop;
  update public.accounts
     set invite_code = code, invite_expires_at = now() + interval '24 hours'
   where id = me;
  return json_build_object('code', code, 'expires_at', now() + interval '24 hours');
end
$$;

create or replace function public.accept_invite(p_code text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  other uuid;
begin
  if me is null then raise exception 'not_authenticated'; end if;

  select id into other
    from public.accounts
   where invite_code = upper(trim(coalesce(p_code, '')))
     and invite_expires_at > now()
   for update;

  if other is null then raise exception 'invalid_code'; end if;
  if other = me then raise exception 'own_code'; end if;

  perform 1 from public.accounts where id = me for update;
  if exists (select 1 from public.accounts where id in (me, other) and partner_id is not null) then
    raise exception 'already_paired';
  end if;

  update public.accounts set partner_id = other, invite_code = null, invite_expires_at = null, updated_at = now() where id = me;
  update public.accounts set partner_id = me,    invite_code = null, invite_expires_at = null, updated_at = now() where id = other;
  return other;
end
$$;

create or replace function public.unpair()
returns void
language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); other uuid;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  select partner_id into other from public.accounts where id = me for update;
  update public.accounts set partner_id = null, updated_at = now()
   where id = me or (other is not null and id = other and partner_id = me);
end
$$;

-- -----------------------------------------------------------------------------
-- 5. CAPSULES
-- -----------------------------------------------------------------------------
create or replace function public.send_capsule(
  p_full_text  text,
  p_teaser     text,
  p_hidden     text,
  p_sound_only boolean,
  p_audio_path text,
  p_deliver_at timestamptz
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  me public.accounts;
  new_row public.capsules;
begin
  select * into me from public.accounts where id = auth.uid();
  if me.id is null then raise exception 'not_authenticated'; end if;
  if me.partner_id is null then raise exception 'no_partner'; end if;
  if char_length(coalesce(p_full_text, '')) = 0 and p_audio_path is null then raise exception 'empty'; end if;
  if char_length(coalesce(p_full_text, '')) > 1000 then raise exception 'too_long'; end if;
  if p_audio_path is not null and split_part(p_audio_path, '/', 1) <> me.id::text then
    raise exception 'bad_audio_path';
  end if;
  if p_deliver_at is not null and (p_deliver_at < now() - interval '5 minutes' or p_deliver_at > now() + interval '2 days') then
    raise exception 'bad_deliver_at';
  end if;

  insert into public.capsules (sender_id, receiver_id, sender_name, sender_city, teaser, sound_only, deliver_at)
  values (me.id, me.partner_id, me.name, me.city, left(coalesce(p_teaser, ''), 200), coalesce(p_sound_only, false), p_deliver_at)
  returning * into new_row;

  insert into public.capsule_secrets (capsule_id, full_text, hidden_part, audio_path)
  values (new_row.id, coalesce(p_full_text, ''), left(p_hidden, 1000), p_audio_path);

  return row_to_json(new_row);
end
$$;

-- Everything the current user may see: their sent capsules (with full text) and
-- capsules sent to them (full text / audio only once unlocked; teaser only once delivered).
create or replace function public.get_capsules(p_limit int default 60)
returns json
language sql stable security definer set search_path = public
as $$
  select coalesce(json_agg(x order by x.created_at desc), '[]'::json)
  from (
    select
      c.id, c.sender_id, c.receiver_id, c.sender_name, c.sender_city,
      case when c.sender_id = auth.uid() or c.deliver_at is null or c.deliver_at <= now() then c.teaser else '' end as teaser,
      c.sound_only, c.deliver_at, c.unlocked, c.guess, c.guess_score, c.unlocked_at, c.created_at,
      case when c.sender_id = auth.uid() or c.unlocked then s.full_text  end as full_text,
      case when c.sender_id = auth.uid() or c.unlocked then s.audio_path end as audio_path
    from public.capsules c
    left join public.capsule_secrets s on s.capsule_id = c.id
    where auth.uid() is not null
      and (c.sender_id = auth.uid() or c.receiver_id = auth.uid())
    order by c.created_at desc
    limit greatest(1, least(coalesce(p_limit, 60), 200))
  ) x
$$;

-- The guess is scored on the server, against text the receiver has never seen.
create or replace function public.unlock_capsule(p_id text, p_guess text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  c public.capsules;
  s public.capsule_secrets;
  g text := left(trim(coalesce(p_guess, '')), 300);
  score real;
begin
  select * into c from public.capsules where id::text = p_id for update;
  if c.id is null or c.receiver_id is distinct from auth.uid() then raise exception 'not_found'; end if;
  if c.deliver_at is not null and c.deliver_at > now() then raise exception 'not_delivered'; end if;

  select * into s from public.capsule_secrets where capsule_id = c.id;

  if not c.unlocked then
    if g <> '' then
      score := greatest(
        public.dice_similarity(g, coalesce(nullif(s.hidden_part, ''), s.full_text)),
        public.dice_similarity(g, s.full_text)
      );
    end if;
    update public.capsules
       set unlocked = true, guess = g, guess_score = round(score::numeric, 2), unlocked_at = now()
     where id = c.id
    returning * into c;
  end if;

  return (row_to_json(c)::jsonb || jsonb_build_object('full_text', s.full_text, 'audio_path', s.audio_path))::json;
end
$$;

-- -----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY + PRIVILEGES
-- -----------------------------------------------------------------------------
-- Remove every existing policy on these tables (old versions may have had open ones).
do $$
declare p record;
begin
  for p in select policyname, tablename from pg_policies
           where schemaname = 'public' and tablename in ('accounts', 'capsules', 'capsule_secrets', 'push_subscriptions')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

alter table public.accounts           enable row level security;
alter table public.capsules           enable row level security;
alter table public.capsule_secrets    enable row level security;
alter table public.push_subscriptions enable row level security;

-- accounts: see yourself and your partner; edit only your own profile fields.
create policy accounts_select_self_or_partner on public.accounts
  for select to authenticated
  using (id = auth.uid() or id = public.my_partner_id());
create policy accounts_insert_self on public.accounts
  for insert to authenticated
  with check (id = auth.uid());
create policy accounts_update_self on public.accounts
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

revoke all on public.accounts from anon, authenticated;
grant select on public.accounts to authenticated;
grant insert (id, email, name, city, lat, lon, tz, sleep_start, sleep_end, mood, updated_at) on public.accounts to authenticated;
grant update (name, city, lat, lon, tz, sleep_start, sleep_end, mood, updated_at)          on public.accounts to authenticated;
-- partner_id / invite_code can only change through the pairing functions.

-- capsules: read-only for the two people involved; all writes go through functions.
create policy capsules_select_involved on public.capsules
  for select to authenticated
  using (sender_id = auth.uid() or receiver_id = auth.uid());
revoke all on public.capsules from anon, authenticated;
grant select on public.capsules to authenticated;

-- capsule_secrets: no direct access at all (no policies + no grants).
revoke all on public.capsule_secrets from anon, authenticated;

-- push_subscriptions: each person manages only their own devices.
create policy push_own on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- Functions: callable by signed-in users only.
revoke execute on function public.my_partner_id()                     from public, anon;
revoke execute on function public.can_read_audio(text)                from public, anon;
revoke execute on function public.dice_similarity(text, text)         from public, anon, authenticated;
revoke execute on function public.handle_new_user()                   from public, anon, authenticated;
revoke execute on function public.create_invite()                     from public, anon;
revoke execute on function public.accept_invite(text)                 from public, anon;
revoke execute on function public.unpair()                            from public, anon;
revoke execute on function public.send_capsule(text, text, text, boolean, text, timestamptz) from public, anon;
revoke execute on function public.get_capsules(int)                   from public, anon;
revoke execute on function public.unlock_capsule(text, text)          from public, anon;

grant execute on function public.my_partner_id()                     to authenticated;
grant execute on function public.can_read_audio(text)                to authenticated;
grant execute on function public.create_invite()                     to authenticated;
grant execute on function public.accept_invite(text)                 to authenticated;
grant execute on function public.unpair()                            to authenticated;
grant execute on function public.send_capsule(text, text, text, boolean, text, timestamptz) to authenticated;
grant execute on function public.get_capsules(int)                   to authenticated;
grant execute on function public.unlock_capsule(text, text)          to authenticated;

-- -----------------------------------------------------------------------------
-- 7. PRIVATE STORAGE FOR VOICE CLIPS
--    Files live at  soundbites/<sender user id>/<random>.<ext>
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('soundbites', 'soundbites', false, 2097152, array['audio/*'])
on conflict (id) do update
  set public = false, file_size_limit = 2097152, allowed_mime_types = array['audio/*'];

drop policy if exists "soundbites_insert_own_folder" on storage.objects;
drop policy if exists "soundbites_select_allowed"    on storage.objects;
drop policy if exists "soundbites_delete_own"        on storage.objects;

create policy "soundbites_insert_own_folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'soundbites' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "soundbites_select_allowed" on storage.objects
  for select to authenticated
  using (bucket_id = 'soundbites'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.can_read_audio(name)));

create policy "soundbites_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'soundbites' and (storage.foldername(name))[1] = auth.uid()::text);

-- -----------------------------------------------------------------------------
-- 8. REALTIME (only the two non-secret tables broadcast changes; RLS applies)
-- -----------------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table public.accounts;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.capsules;
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- 9. OPTIONAL: scheduled-capsule push sweep (see SETUP.md, step 8)
--    Needs the pg_cron and pg_net extensions. Replace the two placeholders.
-- -----------------------------------------------------------------------------
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
