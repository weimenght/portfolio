/**
 * FREE//BUILDER · Room Mode — Cloudflare Worker relay for Supabase Realtime
 *
 * Why: phones in some networks (e.g. mainland China) reach Cloudflare more
 * reliably than *.supabase.co. This Worker forwards the Realtime WebSocket
 * unchanged — it stores nothing and sees only anonymous room messages.
 *
 * Deploy:
 *   1. Cloudflare dashboard → Workers & Pages → Create → Worker → paste this file.
 *   2. Settings → Variables: SUPABASE_URL = https://YOUR-PROJECT.supabase.co
 *   3. (Optional) add a custom domain, e.g. room.wei-meng.org
 *   4. In /free_builder/room/index.html set
 *        ROOM_CONFIG.realtimeUrl = "wss://room.wei-meng.org"
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("FREE//BUILDER Room relay — WebSocket only.", { status: 426 });
    }
    const target = new URL(env.SUPABASE_URL);
    url.protocol = target.protocol;
    url.host = target.host;
    if (url.pathname === "/" || url.pathname === "") url.pathname = "/realtime/v1/websocket";
    if (!url.pathname.startsWith("/realtime/")) return new Response("Not found", { status: 404 });
    return fetch(new Request(url.toString(), request));
  }
};
