// TruckConnect — Combined Service Worker
// OneSignal handles all push delivery (web + Android PWA)
// Firebase background messaging is bridged through OneSignal

importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

// Firebase compat for background message fallback
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

var firebaseConfig = {
  apiKey: "AIzaSyD0dRuRqbsJr0-Kv29xcpQGjW-1DiYPNLo",
  authDomain: "truck-connect-c0c67.firebaseapp.com",
  projectId: "truck-connect-c0c67",
  storageBucket: "truck-connect-c0c67.firebasestorage.app",
  messagingSenderId: "313065662016",
  appId: "1:313065662016:web:a43aecfce5d7db205d61a5"
};

try {
  firebase.initializeApp(firebaseConfig);
  var messaging = firebase.messaging();

  // Background message handler — fires when app is closed or in background
  messaging.onBackgroundMessage(function(payload) {
    console.log('[TruckConnect SW] Background message received:', payload);
    var n = payload.notification || {};
    var title = n.title || 'TruckConnect';
    var body  = n.body  || '';
    self.registration.showNotification(title, {
      body: body,
      icon: '/trucconnect/icon-192.png',
      badge: '/trucconnect/icon-192.png',
      tag: 'truckconnect-notification',
      renotify: true,
      data: payload.data || {}
    });
  });
} catch(e) {
  console.warn('[TruckConnect SW] Firebase init failed:', e.message);
}

// Handle notification click — open the app
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        if (clientList[i].url.indexOf('trucconnect') !== -1 && 'focus' in clientList[i]) {
          return clientList[i].focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('https://madibasphiwe50-afk.github.io/trucconnect/TruckConnect_Customer_v12-1.html');
      }
    })
  );
});

console.log('[TruckConnect SW] Service worker loaded successfully');
