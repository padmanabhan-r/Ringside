// Mike's app service worker: keeps a branded offline screen for the dashboard, and shows Mike's job notifications
// (web push). Everything else goes to the network, so jobs and money are always live; nothing about jobs or payments
// is cached.
const CACHE = "mikes-app-v2";
const OFFLINE = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([OFFLINE, "/icons/icon-192.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE)));
});

// A job event from the server (src/lib/push.ts): { title, body, url, tag, at }. One notification per job, so a newer
// event replaces the older one, and it buzzes again.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const tag = typeof data.tag === "string" ? data.tag : undefined;
  event.waitUntil(
    self.registration.showNotification(data.title || "Mike’s Plumbing", {
      body: data.body || "Something changed on one of your jobs.",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag,
      renotify: Boolean(tag),
      timestamp: typeof data.at === "number" ? data.at : Date.now(),
      data: { url: typeof data.url === "string" && data.url.startsWith("/dashboard") ? data.url : "/dashboard" },
    }),
  );
});

// A tap opens the job: focus a window already on it, else steer an open dashboard window there, else open one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/dashboard", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const exact = windows.find((w) => w.url === url);
      if (exact) return exact.focus();
      const dashboard = windows.find((w) => new URL(w.url).pathname.startsWith("/dashboard"));
      if (dashboard) {
        await dashboard.focus();
        const moved = await dashboard.navigate(url).catch(() => null);
        if (moved) return moved;
      }
      return self.clients.openWindow(url);
    })(),
  );
});
