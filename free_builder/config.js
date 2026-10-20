/* FREE//BUILDER — one Supabase project for every live demo.
 * Used by Room Mode (/free_builder/room), Inbox Runner and KILL//SWITCH (/free_builder/launchpad).
 * Paste from Supabase → Project Settings → API:
 *   url      = Project URL, e.g. https://abcdxyz.supabase.co
 *   anonKey  = the "anon" / public key (never the service_role key)
 * realtimeUrl (optional) = your Cloudflare Worker relay for mainland China, e.g. wss://room.wei-meng.org
 * Leave url empty and every demo keeps running offline, on the device. */
window.FB_SUPABASE = { url: "", anonKey: "", realtimeUrl: "" };
