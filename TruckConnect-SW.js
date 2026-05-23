// ══════════════════════════════════════════════════════════════════════════
// TruckConnect Combined Service Worker
// Handles: OneSignal push notifications + offline PWA caching
// Single SW eliminates scope conflicts between OneSignal and PWA caching
// ══════════════════════════════════════════════════════════════════════════

// OneSignal MUST be imported first — it intercepts push events
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

var CACHE_NAME    = 'truckconnect-v3';
var TILE_CACHE    = 'truckconnect-tiles-v3';
var TILE_MAX      = 800;   // max tiles to cache

// App shell — cached on install
var SHELL_URLS = [
  '/trucconnect/TruckConnect_Driver_v12-3-1.html',
  '/trucconnect/TruckConnect_Customer_v12-1.html',
  'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js',
  'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css',
  'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'
];

// ── INSTALL: cache app shell ──────────────────────────────────────────────
self.addEventListener('install', function(event) {
  console.log('[TC SW] Installing — caching app shell');
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      // Cache each resource individually so one failure doesn't break all
      return Promise.allSettled(
        SHELL_URLS.map(function(url) {
          return cache.add(url).catch(function(e) {
            console.warn('[TC SW] Failed to cache:', url, e.message);
          });
        })
      );
    }).then(function() {
      console.log('[TC SW] Shell cached — skipping wait');
      return self.skipWaiting();
    })
  );
});

// ── ACTIVATE: clean old caches ────────────────────────────────────────────
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME && k !== TILE_CACHE; })
            .map(function(k) { console.log('[TC SW] Removing old cache:', k); return caches.delete(k); })
      );
    }).then(function() { return self.clients.claim(); })
  );
  console.log('[TC SW] Activated');
});

// ── FETCH: serve from cache with network fallback ─────────────────────────
self.addEventListener('fetch', function(event) {
  var url = event.request.url;

  // Map tiles — cache with tile-specific store (LRU limited)
  if (isTileRequest(url)) {
    event.respondWith(handleTile(event.request));
    return;
  }

  // Navigation requests (HTML pages) — network first, cache fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(function() {
        return caches.match(event.request) ||
               caches.match('/trucconnect/TruckConnect_Customer_v12-1.html');
      })
    );
    return;
  }

  // Everything else — cache first, network fallback
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;
      return fetch(event.request).then(function(response) {
        // Cache successful JS/CSS responses
        if (response.ok && shouldCache(url)) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(c) { c.put(event.request, clone); });
        }
        return response;
      }).catch(function() {
        // Offline fallback for fonts/scripts
        return new Response('', { status: 503, statusText: 'Offline' });
      });
    })
  );
});

// ── TILE HANDLER (LRU cap) ────────────────────────────────────────────────
function handleTile(request) {
  return caches.open(TILE_CACHE).then(function(cache) {
    return cache.match(request).then(function(cached) {
      if (cached) return cached;
      return fetch(request).then(function(response) {
        if (!response.ok) return response;
        var clone = response.clone();
        // Enforce tile cache limit
        cache.keys().then(function(keys) {
          if (keys.length > TILE_MAX) cache.delete(keys[0]);
        });
        cache.put(request, clone);
        return response;
      }).catch(function() {
        // Return blank tile when offline
        return new Response('', { status: 204, statusText: 'No tile cached' });
      });
    });
  });
}

function isTileRequest(url) {
  return url.includes('maptiler.com/tiles') ||
         url.includes('maptiler.com/maps') ||
         url.includes('openfreemap.org') ||
         url.includes('/tiles/') ||
         /\/{z}\/{x}\/{y}/.test(url) ||
         /\/\d+\/\d+\/\d+\.(png|pbf|mvt|jpg)/.test(url);
}

function shouldCache(url) {
  return url.includes('unpkg.com') ||
         url.includes('cdn.onesignal') ||
         url.includes('gstatic.com/firebasejs') ||
         url.includes('.css') ||
         (url.includes('.js') && !url.includes('analytics'));
}

// ── PUSH NOTIFICATIONS ───────────────────────────────────────────────────
// Handled by OneSignal SDK imported above.
// notificationclick is kept for route-update dispatch actions.

// ── NOTIFICATION CLICK: re-fetch route if emergency update ────────────────
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var notifData = event.notification.data || {};
  // Open correct app based on notification target
  var targetUrl = notifData.url ||
    (notifData.role === 'customer'
      ? '/trucconnect/TruckConnect_Customer_v12-1.html'
      : '/trucconnect/TruckConnect_Driver_v12-3-1.html');

  // If dispatch sends emergency route change — signal app to re-fetch
  if (notifData.action === 'ROUTE_UPDATE') {
    event.waitUntil(
      self.clients.matchAll({ type:'window' }).then(function(clients) {
        clients.forEach(function(client) {
          client.postMessage({ type:'ROUTE_UPDATE', data: notifData });
        });
        if (clients.length) return clients[0].focus();
        return self.clients.openWindow(targetUrl);
      })
    );
  } else {
    event.waitUntil(
      self.clients.matchAll({ type:'window' }).then(function(clients) {
        for (var i=0; i<clients.length; i++) {
          if (clients[i].url.indexOf('trucconnect') !== -1) return clients[i].focus();
        }
        return self.clients.openWindow(targetUrl);
      })
    );
  }
});

console.log('[TC SW] Service worker loaded — TruckConnect PWA');
