// Supabase Edge Function: sends Web Push notifications for Twilight Handoff.
//
// Called two ways (both must send header `x-webhook-secret: <WEBHOOK_SECRET>`):
//   1. Database Webhook on public.capsules (INSERT, UPDATE)
//        - new capsule (deliverable now)  → notify receiver
//        - capsule unlocked               → notify sender
//   2. pg_cron every 5 min with body {"sweep": true}
//        - scheduled capsules whose deliver_at has passed → notify receiver
//
// Deploy:  supabase functions deploy notify --no-verify-jwt
// Secrets: supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... \
//            VAPID_SUBJECT=mailto:you@example.com WEBHOOK_SECRET=...

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

const SECRET = Deno.env.get("WEBHOOK_SECRET") ?? "";

type Lang = "en" | "zh-CN" | "zh-TW" | "es" | "ca";
const T: Record<Lang, { newTitle: string; unlockTitle: string; sound: string; noGuess: string; guessed: string }> = {
  "en":    { newTitle: "{name} left you a capsule",   unlockTitle: "{name} unlocked your capsule", sound: "🎙️ A sound is waiting", noGuess: "Revealed without a guess", guessed: "Their guess: “{guess}”" },
  "zh-CN": { newTitle: "{name} 给你留了一枚胶囊",      unlockTitle: "{name} 解锁了你的胶囊",        sound: "🎙️ 有一段声音在等你",    noGuess: "未猜测直接揭晓",          guessed: "对方的猜测：“{guess}”" },
  "zh-TW": { newTitle: "{name} 給你留了一枚膠囊",      unlockTitle: "{name} 解鎖了你的膠囊",        sound: "🎙️ 有一段聲音在等你",    noGuess: "未猜測直接揭曉",          guessed: "對方的猜測：「{guess}」" },
  "es":    { newTitle: "{name} te dejó una cápsula",  unlockTitle: "{name} abrió tu cápsula",      sound: "🎙️ Un sonido te espera", noGuess: "Revelado sin adivinar",    guessed: "Su suposición: «{guess}»" },
  "ca":    { newTitle: "{name} t’ha deixat una càpsula", unlockTitle: "{name} ha obert la teva càpsula", sound: "🎙️ Un so t’espera", noGuess: "Revelat sense endevinar", guessed: "La seva suposició: «{guess}»" },
};
const fmt = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");
const strings = (lang: string) => T[(lang as Lang)] ?? T.en;

type Capsule = {
  id: string | number; sender_id: string; receiver_id: string | null; sender_name: string;
  teaser: string | null; full_text: string; audio_url: string | null;
  unlocked: boolean; guess: string | null; deliver_at: string | null; notified_at: string | null;
};

async function pushTo(userId: string, build: (lang: string) => { title: string; body: string; tag: string }) {
  const { data: subs } = await db.from("push_subscriptions").select("*").eq("user_id", userId);
  for (const s of subs ?? []) {
    const msg = build(s.lang);
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ ...msg, url: "./" }),
        { TTL: 60 * 60 * 24 },
      );
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await db.from("push_subscriptions").delete().eq("id", s.id); // expired
      else console.error("push failed", code, err);
    }
  }
}

async function notifyNew(c: Capsule) {
  if (!c.receiver_id) return;
  const soundOnly = !!c.audio_url && (c.full_text === "🎙️" || c.full_text === "🎙️ (6s)");
  await pushTo(c.receiver_id, (lang) => {
    const s = strings(lang);
    return {
      title: fmt(s.newTitle, { name: c.sender_name }),
      body: soundOnly ? s.sound : (c.teaser ? `•••• ${c.teaser}` : "••••"),
      tag: `capsule-${c.id}`,
    };
  });
  await db.from("capsules").update({ notified_at: new Date().toISOString() }).eq("id", c.id);
}

async function notifyUnlock(c: Capsule) {
  if (!c.receiver_id) return;
  const { data: receiver } = await db.from("accounts").select("name").eq("id", c.receiver_id).maybeSingle();
  const name = receiver?.name ?? "";
  await pushTo(c.sender_id, (lang) => {
    const s = strings(lang);
    return {
      title: fmt(s.unlockTitle, { name }),
      body: c.guess ? fmt(s.guessed, { guess: c.guess }) : s.noGuess,
      tag: `unlock-${c.id}`,
    };
  });
}

const isDue = (c: Capsule) => !c.deliver_at || Date.parse(c.deliver_at) <= Date.now();

Deno.serve(async (req) => {
  if (!SECRET || req.headers.get("x-webhook-secret") !== SECRET) {
    return new Response("unauthorized", { status: 401 });
  }
  const body = await req.json().catch(() => ({}));

  if (body.sweep) {
    const { data: due } = await db.from("capsules").select("*")
      .is("notified_at", null).not("receiver_id", "is", null)
      .eq("unlocked", false).lte("deliver_at", new Date().toISOString())
      .limit(50);
    for (const c of (due ?? []) as Capsule[]) await notifyNew(c);
    return Response.json({ swept: due?.length ?? 0 });
  }

  if (body.table === "capsules") {
    const c = body.record as Capsule;
    const old = body.old_record as Capsule | null;
    if (body.type === "INSERT" && !c.notified_at && isDue(c)) await notifyNew(c);
    if (body.type === "UPDATE" && old && !old.unlocked && c.unlocked) await notifyUnlock(c);
  }
  return Response.json({ ok: true });
});
