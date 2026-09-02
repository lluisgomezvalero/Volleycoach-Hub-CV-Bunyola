const CACHE_PREFIX = 'volleycoach-react-pwa-';
const CACHE_VERSION = '20260902-production-ready-v1';
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;
const OFFLINE_SHELL = ['./', './manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try { await cache.addAll(OFFLINE_SHELL); } catch (_) {}
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || request.mode !== 'navigate') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    try {
      return await fetch(request);
    } catch (error) {
      const cache = await caches.open(CACHE_NAME);
      const fallback = await cache.match('./');
      if (fallback) return fallback;
      throw error;
    }
  })());
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data?.json?.() || {}; } catch (_) {
    try { data = JSON.parse(event.data?.text?.() || '{}'); } catch (_) {}
  }

  const icon = new URL('./assets/pwa-icon-192.png', self.registration.scope).href;
  const title = data.title || 'VolleyCoach Hub';
  const options = {
    body: data.body || 'Tienes una tarea pendiente en el equipo.',
    tag: data.tag || 'volleycoach-notification',
    icon,
    badge: icon,
    data: { url: data.url || '#/', eventId: data.eventId || null },
    vibrate: [120, 60, 120]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const relative = event.notification?.data?.url || '#/';
  const targetUrl = new URL(relative, self.registration.scope).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('focus' in client) {
        await client.navigate(targetUrl);
        return client.focus();
      }
    }
    return self.clients.openWindow(targetUrl);
  })());
});
