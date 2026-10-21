/* FREE//BUILDER — offline cache for the demos (upload to /free_builder/sw.js)
 * Pages: network first, so updates show up straight away; the cached copy is used when offline.
 * Fonts and vendor scripts: cache first. Nothing about the people using the demos is stored here. */
const VERSION = "fb-2026-10-21d";
// Launchpad (1.3 MB) is cached when first opened, not up front.
const PAGES = ["listen", "questions", "thanks", "swap", "repair", "teachback", "discovery", "room", "design", "guide", "coach", "cq", "diagnose", "cost", "impact", "adapted", "ai", "frontline", "circles", "rituals", "facilitator", "kit", "twotruths", "prompt", "museum", "manual", "dial", "decide", "managers"].map(n => `/free_builder/${n}/`);
const FONTS = [
  "/fonts/fonts.css",
  "/fonts/syne-latin-600-normal.woff2", "/fonts/syne-latin-700-normal.woff2", "/fonts/syne-latin-800-normal.woff2",
  "/fonts/plus-jakarta-sans-latin-300-normal.woff2", "/fonts/plus-jakarta-sans-latin-400-normal.woff2", "/fonts/plus-jakarta-sans-latin-500-normal.woff2",
  "/fonts/plus-jakarta-sans-latin-600-normal.woff2", "/fonts/plus-jakarta-sans-latin-700-normal.woff2",
  "/fonts/space-mono-latin-400-normal.woff2", "/fonts/space-mono-latin-700-normal.woff2",
  "/fonts/instrument-serif-latin-400-normal.woff2", "/fonts/instrument-serif-latin-400-italic.woff2",
  "/fonts/special-elite-latin-400-normal.woff2", "/fonts/press-start-2p-latin-400-normal.woff2"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all([...FONTS, ...PAGES].map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("fb-") && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const withSlash = u => (u.pathname.endsWith("/") || /\.[a-z0-9]+$/i.test(u.pathname)) ? u.pathname : u.pathname + "/";

self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.startsWith("/fonts/") || url.pathname.startsWith("/free_builder/vendor/")) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res; })));
    return;
  }
  if (req.mode === "navigate" && url.pathname.startsWith("/free_builder/")) {
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(withSlash(url), copy)); }
        return res;
      }).catch(() => caches.match(withSlash(url)).then(hit => hit || caches.match(req)).then(hit => hit || new Response(
        "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>Offline</title><body style='font-family:system-ui;padding:32px;background:#F7F6F2;color:#17171A'><h1>You're offline.</h1><p>This page wasn't saved on this device yet. Open it once while online and it will work offline next time.</p><p>离线中。这个页面还没有保存在本设备上。联网时打开一次，下次即可离线使用。</p><p>Sin conexión. Abre esta página una vez con conexión y funcionará sin ella la próxima vez.</p>",
        { headers: { "Content-Type": "text/html; charset=utf-8" } })))
    );
  }
});
