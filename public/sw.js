self.addEventListener('push', (event) => {
  let payload = {
    title: 'OutdoorAdvisor',
    body: 'You have a new outdoor safety update.',
    url: '/',
  };

  try {
    const data = event.data?.json?.();
    if (data) payload = { ...payload, ...data };
  } catch {}

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: payload.tag || 'outdooradvisor-alert',
      data: {
        url: payload.url || '/',
      },
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate?.(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
