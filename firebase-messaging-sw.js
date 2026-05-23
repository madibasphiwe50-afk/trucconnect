// TruckConnect — Firebase Background Messaging Service Worker
// NOTE: OneSignalSDKWorker.js handles all OneSignal push delivery.
// This file handles Firebase Cloud Messaging background messages ONLY
// (e.g. direct FCM sends from Cloud Functions that bypass OneSignal).

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
    console.log('[TruckConnect SW] Background FCM message received:', payload);
    var n = payload.notification || {};
    var title = n.title || 'TruckConnect';
    var body  = n.body  || '';
    self.registration.showNotification(title, {
      body: body,
      icon: '/trucconnect/icon-192.png',
      badge: '/trucconnect/icon-192.png',
      tag: 'truckconnect-fcm',
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
        return clients.openWindow('https://madibasphiwe50-afk.github.io/trucconnect/');
      }
    })
  );
});

console.log('[TruckConnect SW] firebase-messaging-sw.js loaded');
