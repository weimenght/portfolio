// Handoff moved to https://www.freebuilder.net/handoff/ (its own app).
// This worker stays only so phones that installed Handoff from here keep getting their notifications,
// and every tap opens Handoff at its new home. It no longer keeps an offline copy of the old app.
const HOME = 'https://www.freebuilder.net/handoff/';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('push', (event) => {
    let data = {};
    try { data = event.data ? event.data.json() : {}; } catch (e) { data = { title: 'Handoff', body: event.data ? event.data.text() : '' }; }
    event.waitUntil(self.registration.showNotification(data.title || 'Handoff', {
        body: data.body || '', tag: data.tag || 'handoff', renotify: true,
        icon: './icon-192.png', badge: './icon-192.png', data: { url: HOME }
    }));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(self.clients.openWindow(HOME));
});
