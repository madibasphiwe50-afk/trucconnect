// firebase-messaging-sw.js
// Deploy this file in the SAME folder as your HTML files on GitHub Pages.
// e.g. https://madibasphiwe50-afk.github.io/trucconnect/firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            "AIzaSyD0dRuRqbsJr0-Kv29xcpQGjW-1DiYPNLo",
  authDomain:        "truck-connect-c0c67.firebaseapp.com",
  projectId:         "truck-connect-c0c67",
  storageBucket:     "truck-connect-c0c67.firebasestorage.app",
  messagingSenderId: "313065662016",
  appId:             "1:313065662016:web:a43aecfce5d7db205d61a5"
});

const messaging = firebase.messaging();

// Handle notifications received while the app is in the BACKGROUND or CLOSED.
messaging.onBackgroundMessage(function(payload) {
  const notification = payload.notification || {};
  const title = notification.title || 'TruckConnect';
  const body  = notification.body  || '';
  self.registration.showNotification(title, {
    body:  body,
    icon:  'https://madibasphiwe50-afk.github.io/trucconnect/icon-192.png',
    badge: 'https://madibasphiwe50-afk.github.io/trucconnect/badge-72.png',
    data:  payload.data || {}
  });
});
