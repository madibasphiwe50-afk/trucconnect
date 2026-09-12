// ══════════════════════════════════════════════════════════════════════════
// TruckConnect-SW.js
// Shared service worker for the / scope — used by BOTH the
// Customer and Driver apps (they register the same file/scope).
//
// Handles two jobs:
//   1. Offline support — basic cache-first for the app shell.
//   2. FCM background push — receives notifications when the app is closed
//      or the phone is locked, and routes taps to the right screen.
//
// Deploy this at: /TruckConnect-SW.js
// ══════════════════════════════════════════════════════════════════════════

// ── Firebase (compat build — required inside service workers) ──────────────
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

// ── 1. OFFLINE CACHE (app shell) ────────────────────────────────────────────
const CACHE_NAME = 'truckconnect-v1';
const APP_SHELL = [
  '/',
];

self.addEventListener('install', function(event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(APP_SHELL).catch(function() { /* ignore missing files */ });
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n !== CACHE_NAME; })
             .map(function(n) { return caches.delete(n); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(event) {
  // Network-first for navigation requests, cache-first for everything else.
  // Never intercept Firestore/Firebase/API calls — let those hit the network directly.
  var url = event.request.url;
  if (url.indexOf('firestore.googleapis.com') !== -1 ||
      url.indexOf('firebaseio.com') !== -1 ||
      url.indexOf('googleapis.com') !== -1) {
    return;
  }
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      return cached || fetch(event.request).catch(function() {
        return caches.match('/');
      });
    })
  );
});

// ── 2. FCM BACKGROUND MESSAGES ──────────────────────────────────────────────
// Fires when a push arrives while the app is closed, backgrounded, or the
// phone is locked. `payload.data` carries routing info set by the sender
// (Admin app / Cloudflare Worker) — e.g. { screen: "loadDetails", loadId: "..." }
messaging.onBackgroundMessage(function(payload) {
  var n = payload.notification || {};
  var title = n.title || 'TruckConnect';
  var options = {
    body: n.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: payload.data || {},
    tag: (payload.data && payload.data.tag) || undefined,
  };
  self.registration.showNotification(title, options);
});

// ── 3. TAP-TO-NAVIGATE ──────────────────────────────────────────────────────
// When the user taps the notification, focus an open tab if there is one
// (and tell it which screen to jump to), otherwise open a new one with the
// routing info in the URL so the app can read it on load.
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var data = event.notification.data || {};
  var screen = data.screen || '';
  var targetUrl = '/' + (screen ? ('?screen=' + encodeURIComponent(screen) +
                    (data.id ? '&id=' + encodeURIComponent(data.id) : '')) : '');

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if ('focus' in client) {
          client.postMessage({ type: 'TC_NOTIFICATION_CLICK', data: data });
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
