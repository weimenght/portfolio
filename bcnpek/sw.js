// Twilight Handoff service worker: offline shell + Web Push.
const CACHE = 'handoff-shell-v2';
const SHELL = ['./', './index.html', './manifest.json', './icon.svg', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

// Network-first for page loads (so updates arrive), cache fallback when offline.
// Everything else (Supabase, Open-Meteo, CDNs, supabase.txt) goes straight to the network.
self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET' || req.mode !== 'navigate') return;
    event.respondWith(
        fetch(req)
            .then((res) => {
                const copy = res.clone();
                caches.open(CACHE).then((c) => c.put('./index.html', copy));
                return res;
            })
            .catch(() => caches.match('./index.html'))
    );
});

self.addEventListener('push', (event) => {
    let data = {};
    try { data = event.data ? event.data.json() : {}; } catch (e) { data = { title: 'Handoff', body: event.data ? event.data.text() : '' }; }
    const title = data.title || 'Handoff';
    event.waitUntil((async () => {
        await self.registration.showNotification(title, {
            body: data.body || '',
            tag: data.tag || 'handoff',
            renotify: true,
            icon: './icon-192.png',
            badge: './icon-192.png',
            data: { url: data.url || './' }
        });
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        clients.forEach((c) => c.postMessage({ type: 'refresh' }));
    })());
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const target = new URL(event.notification.data?.url || './', self.registration.scope).href;
    event.waitUntil((async () => {
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const c of clients) {
            if (c.url.startsWith(self.registration.scope)) { await c.focus(); return; }
        }
        await self.clients.openWindow(target);
    })());
});
