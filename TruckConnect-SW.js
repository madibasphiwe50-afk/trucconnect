// TruckConnect-SW.js  (v2)
// Shared service worker used by the Customer AND Driver apps.
// Put this file in the SAME folder as the app's HTML file.
//
//  1. Offline shell (network first).
//  2. FCM background push. The Worker sends DATA-ONLY messages
//     ({title, body, screen, id, kind, tag}) and this file shows them,
//     so every push appears exactly once.
//  3. Tapping a notification opens/focuses the app and routes to the right screen.

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyD0dRuRqbsJr0-Kv29xcpQGjW-1DiYPNLo",
  authDomain: "truck-connect-c0c67.firebaseapp.com",
  projectId: "truck-connect-c0c67",
  storageBucket: "truck-connect-c0c67.firebasestorage.app",
  messagingSenderId: "313065662016",
  appId: "1:313065662016:web:a43aecfce5d7db205d61a5",
});

const messaging = firebase.messaging();
const SCOPE = self.registration.scope;               // e.g. https://user.github.io/repo/
const CACHE_NAME = 'truckconnect-v2';

// ── 1. OFFLINE SHELL ────────────────────────────────────────────────────
self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.add(SCOPE).catch(function () {});
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.filter(function (n) { return n !== CACHE_NAME; })
                              .map(function (n) { return caches.delete(n); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = req.url;
  // Never touch Firebase / Google / Worker / map traffic.
  if (url.indexOf('googleapis.com') !== -1 || url.indexOf('gstatic.com') !== -1 ||
      url.indexOf('firebaseio.com') !== -1 || url.indexOf('workers.dev') !== -1 ||
      url.indexOf(self.location.origin) !== 0) return;
  event.respondWith(
    fetch(req).then(function (res) {
      if (req.mode === 'navigate' && res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function (c) { c.put(SCOPE, copy); }).catch(function () {});
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) { return hit || caches.match(SCOPE); });
    })
  );
});

// ── 2. BACKGROUND PUSH ──────────────────────────────────────────────────
messaging.onBackgroundMessage(function (payload) {
  // If a message ever arrives WITH a "notification" block, Firebase already shows it — don't show twice.
  if (payload.notification) return;
  var d = payload.data || {};
  var isJob = d.kind === 'new_job';
  var options = {
    body: d.body || '',
    icon: SCOPE + 'icon-192.png',
    badge: SCOPE + 'icon-192.png',
    data: d,
    tag: d.tag || undefined,
    renotify: !!d.tag,
    requireInteraction: isJob,               // job requests stay on screen until the driver reacts
    vibrate: isJob ? [300, 150, 300, 150, 300] : [200, 100, 200],
    actions: isJob ? [{ action: 'open', title: 'View job' }] : []
  };
  return self.registration.showNotification(d.title || 'TruckConnect', options);
});

// ── 3. TAP → OPEN THE RIGHT SCREEN ──────────────────────────────────────
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var data = event.notification.data || {};
  var screen = data.screen || '';
  var targetUrl = SCOPE + (screen ? ('?screen=' + encodeURIComponent(screen) +
                  (data.id ? '&id=' + encodeURIComponent(data.id) : '')) : '');

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (c.url.indexOf(SCOPE) === 0 && 'focus' in c) {
          c.postMessage({ type: 'TC_NOTIFICATION_CLICK', data: data });
          return c.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
