/* Amader™ service worker.
 *
 * Deliberately does ONE job: receive push and open the right page when the
 * notification is tapped. It does not cache, does not intercept fetch, and does
 * not try to make the site work offline — a caching service worker that gets a
 * detail wrong serves stale prices, and price is the last thing this shop can
 * afford to be stale about.
 *
 * This file is served from the site root, which is what gives it the scope to
 * receive push for the whole origin.
 */

// Take over as soon as it is installed rather than waiting for every tab using
// the old worker to close — otherwise a fix to this file can sit unused for days.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  // A push with no payload is legitimate (some services strip it); show
  // something rather than nothing, because the notification has already been
  // promised to the user by this point.
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { body: event.data.text() };
    }
  }

  const title = data.title || 'আমাদের | Amader';
  const options = {
    body: data.body || '',
    icon: data.icon || '/favicon-default.png',
    badge: data.badge || '/favicon-default.png',
    // Replaces an earlier notification with the same tag instead of stacking:
    // two reminders about one cart should read as one reminder, updated.
    tag: data.tag || 'amader',
    renotify: Boolean(data.tag),
    data: { url: data.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    // Focus an existing tab on this origin rather than opening a duplicate —
    // someone who already has the shop open should be taken to the page, not
    // given a second copy of the site.
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});

// The browser can rotate a subscription on its own. When it does, the old
// endpoint stops working, so the new one has to be registered or this device
// goes quiet without anyone noticing.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const applicationServerKey =
        (event.oldSubscription && event.oldSubscription.options.applicationServerKey) || null;
      if (!applicationServerKey) return;
      const fresh = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
      const json = fresh.toJSON();
      await fetch('/api/backend/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: fresh.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        }),
      });
    })(),
  );
});
