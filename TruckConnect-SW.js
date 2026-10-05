/* ============================================================
   TRUCK CONNECT — SERVICE WORKER (FCM push, web)
   File name must stay: TruckConnect-SW.js
   (both apps register './TruckConnect-SW.js')

   Push + in-app together:
   - App closed / in background -> onBackgroundMessage shows the push
   - App open (foreground)      -> the page receives the message and
     asks this worker (TC_SHOW_NOTIFICATION) to show the SAME push,
     while the in-app popup / toast / banner shows at the same time
   ============================================================ */

importScripts(
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js"
);

/* ============================================================
   FIREBASE CONFIG
   ============================================================ */

firebase.initializeApp({
  apiKey: "AIzaSyD0dRuRqbsJr0-Kv29xcpQGjW-1DiYPNLo",
  authDomain: "truck-connect-c0c67.firebaseapp.com",
  projectId: "truck-connect-c0c67",
  storageBucket: "truck-connect-c0c67.firebasestorage.app",
  messagingSenderId: "313065662016",
  appId: "1:313065662016:web:a43aecfce5d7db205d61a5"
});

const messaging = firebase.messaging();

/* ============================================================
   SETTINGS
   ============================================================ */

const WORKER_URL =
  "https://truckconnect-fcm.madibasphiwe50.workers.dev";

/* Folder this service worker controls (always ends with "/"). */
const SCOPE = self.registration.scope;

/* The HTML file of each app, used when the app is closed and a
   notification is tapped. Leave "" for index.html.
   These MUST match the deployed file names in the same GitHub Pages folder
   (your GitHub Pages folder). If you rename or
   re-version an HTML file, change it here too. */
const DRIVER_PAGE = "driver.html";
const CUSTOMER_PAGE = "customer.html";

/* Notification icon. Use a 192x192 PNG when you have one. */
const ICON = SCOPE + "favicon.ico";

/* new_job pushes belong to the Driver app, driver_accepted pushes
   belong to the Customer app. */
const DRIVER_KINDS = ["new_job", "job_cancelled", "job_taken"];
const CUSTOMER_KINDS = [
  "driver_accepted", "driver_arrived", "driver_declined",
  "trip_started", "trip_completed", "cancellation", "status"
];

/* The Worker puts app: "driver" | "customer" in every push, so that wins.
   Falls back to the kind for older pushes. "" = unknown (any app tab). */
function pageFor(kind, app) {
  if (app === "driver") return DRIVER_PAGE;
  if (app === "customer") return CUSTOMER_PAGE;
  if (DRIVER_KINDS.indexOf(kind) !== -1) return DRIVER_PAGE;
  if (CUSTOMER_KINDS.indexOf(kind) !== -1) return CUSTOMER_PAGE;
  return "";
}

function screenFor(kind, data) {
  if (kind === "new_job") return "job";
  if (kind === "driver_accepted") return "tracking";
  return (data && data.screen) || "home";
}

/* ============================================================
   BUILD A NOTIFICATION FROM FCM DATA
   (used by both background pushes and foreground pushes)
   ============================================================ */

function buildNotification(data) {
  data = data || {};

  const kind = data.kind || "";

  const title = data.title || "Truck Connect";

  const body = data.body || "You have a new notification.";

  const bookingId = data.bookingId || data.id || "";

  const app = data.app || "";

  const options = {
    body: body,
    icon: ICON,
    badge: ICON,
    silent: false, /* let the phone play its notification sound */
    timestamp: Date.now()
  };

  /* ---------------- NEW TRUCK JOB ---------------- */

  if (kind === "new_job") {
    options.tag = data.tag || "truckconnect-job-" + bookingId;
    options.renotify = true;
    options.requireInteraction = true;
    options.vibrate = [200, 100, 200];
    options.data = {
      kind: "new_job",
      bookingId: bookingId,
      id: bookingId,
      actionToken: data.actionToken || "",
      screen: "job",
      app: "driver"
    };
    /* LEFT = DECLINE, RIGHT = ACCEPT */
    options.actions = [
      { action: "decline", title: "DECLINE" },
      { action: "accept", title: "ACCEPT" }
    ];

    return { title: title, options: options };
  }

  /* ---------------- DRIVER ACCEPTED ---------------- */

  if (kind === "driver_accepted") {
    options.tag = data.tag || "truckconnect-accepted-" + bookingId;
    options.data = {
      kind: "driver_accepted",
      bookingId: bookingId,
      id: bookingId,
      screen: "tracking",
      app: "customer"
    };

    return { title: title, options: options };
  }

  /* ---------------- OTHER NOTIFICATIONS ---------------- */

  options.tag = data.tag || "truckconnect-" + kind + "-" + bookingId;
  options.data = {
    kind: kind,
    bookingId: bookingId,
    id: bookingId,
    screen: data.screen || "home",
    app: app
  };
  /* status pushes (picked up / delivered / declined) should wake the screen */
  options.renotify = true;
  options.vibrate = [150, 80, 150];

  return { title: title, options: options };
}

/* ============================================================
   BACKGROUND FCM MESSAGE (app closed or not in front)
   ============================================================ */

messaging.onBackgroundMessage((payload) => {
  /* Display is handled by the raw "push" listener below, which shows the
     notification every time. Showing here too would double it. */
  console.log("[TruckConnect SW] Background message:", payload);
});

/* ============================================================
   RAW PUSH LISTENER - ALWAYS SHOW THE NOTIFICATION
   Firebase only calls onBackgroundMessage when it thinks no app tab is
   visible. On a locked phone Chrome can still report the tab as visible, so
   Firebase hands the push to the (frozen) page and nothing shows until the
   app is opened. This listener shows it straight away, locked or not.
   The tag is the same everywhere, so a repeat replaces instead of stacking.
   ============================================================ */

self.addEventListener("push", (event) => {
  let payload = null;

  try {
    payload = event.data ? event.data.json() : null;
  } catch (e) {
    payload = null;
  }

  const data = payload && payload.data ? payload.data : null;

  if (!data || !data.kind) return;

  const n = buildNotification(data);

  event.waitUntil(self.registration.showNotification(n.title, n.options));
});

/* ============================================================
   MESSAGES FROM THE PAGE (app open)
   ============================================================ */

self.addEventListener("message", (event) => {
  const msg = event.data || {};

  /* App is open: show the same push as when the app is closed */
  if (msg.type === "TC_SHOW_NOTIFICATION") {
    const n = buildNotification(msg.data);

    event.waitUntil(self.registration.showNotification(n.title, n.options));

    return;
  }

  /* Driver accepted / declined inside the app: remove the push */
  if (msg.type === "TC_CLOSE_NOTIFICATIONS" && msg.bookingId) {
    event.waitUntil(closeJobNotifications(String(msg.bookingId)));
  }
});

async function closeJobNotifications(bookingId) {
  try {
    const list = await self.registration.getNotifications();

    list.forEach((n) => {
      const d = n.data || {};

      if ((d.bookingId || d.id) === bookingId && d.kind === "new_job") {
        n.close();
      }
    });
  } catch (e) {
    console.log("[TruckConnect SW] Close notifications failed:", e);
  }
}

/* ============================================================
   NOTIFICATION CLICK
   ============================================================ */

self.addEventListener("notificationclick", (event) => {
  const notification = event.notification;

  const data = notification.data || {};

  const action = event.action || "";

  const kind = data.kind || "";

  const bookingId = data.bookingId || data.id || "";

  const app = data.app || "";

  console.log("[TruckConnect SW] Notification clicked:", action, data);

  notification.close();

  /* ---------- ACCEPT / DECLINE BUTTONS ---------- */

  if (kind === "new_job" && (action === "accept" || action === "decline")) {
    event.waitUntil(handleJobAction(action, data, bookingId));
    return;
  }

  /* ---------- NORMAL TAP ---------- */

  event.waitUntil(openApp(kind, screenFor(kind, data), bookingId, app));
});

/* ============================================================
   ACCEPT / DECLINE REQUEST
   ============================================================ */

async function handleJobAction(action, data, bookingId) {
  let response = null;

  let result = null;

  try {
    response = await fetch(WORKER_URL + "/notification-action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: data.actionToken || "",
        action: action
      })
    });

    try {
      result = await response.json();
    } catch (e) {
      result = null;
    }

    console.log(
      "[TruckConnect SW] Action response:",
      response.status,
      result
    );
  } catch (error) {
    console.error("[TruckConnect SW] Action request failed:", error);

    /* No network. For accept, open the app so the driver can
       accept manually. */
    if (action === "accept") {
      return openApp("new_job", "job", bookingId, "driver");
    }

    return;
  }

  /* DECLINE: do not open the app */
  if (action === "decline") return;

  /* ACCEPT SUCCESS: open the accepted job */
  if (response.ok && result && result.ok) {
    return openApp("new_job", "job", bookingId, "driver");
  }

  /* ACCEPT FAILED: tell the driver why */
  console.error("[TruckConnect SW] Accept failed:", response.status, result);

  const reason = result && result.reason;

  let title = "Could not accept the job";
  let body = "Tap to open the app and try again.";
  let screen = "job";

  if (
    reason === "job-already-taken" ||
    reason === "job-no-longer-available"
  ) {
    title = "Job no longer available";
    body = "Another driver got this job.";
    screen = "home";
  } else if (response.status === 401) {
    title = "Request expired";
    body = "Tap to open the app and check if the job is still available.";
  }

  /* Short error code so a failed Accept can be diagnosed from the phone. */
  if (screen === "job") {
    body = body + " (error " + (response ? response.status : "?") + ")";
  }

  return self.registration.showNotification(title, {
    body: body,
    icon: ICON,
    badge: ICON,
    tag: "truckconnect-result-" + bookingId,
    data: {
      kind: "info",
      bookingId: bookingId,
      id: bookingId,
      screen: screen
    }
  });
}

/* ============================================================
   OPEN / FOCUS THE APP
   - app already open: tell the page where to go (no reload)
   - app closed: open it with ?screen=&id= so it can route itself
   ============================================================ */

async function openApp(kind, screen, id, app) {
  const page = pageFor(kind, app);

  let url = SCOPE + page;

  if (screen && screen !== "home") {
    url +=
      "?screen=" +
      encodeURIComponent(screen) +
      (id ? "&id=" + encodeURIComponent(id) : "");
  }

  try {
    const windowClients = await clients.matchAll({
      type: "window",
      includeUncontrolled: true
    });

    for (const client of windowClients) {
      if (!client.url.startsWith(SCOPE)) continue;

      if (page && client.url.indexOf(page) === -1) continue;

      if (screen && screen !== "home") {
        client.postMessage({
          type: "TC_NOTIFICATION_CLICK",
          data: { screen: screen, id: id, kind: kind }
        });
      }

      try {
        if ("focus" in client) return await client.focus();
      } catch (e) {
        console.log("[TruckConnect SW] Focus failed:", e);
      }

      return client;
    }
  } catch (error) {
    console.error("[TruckConnect SW] Client lookup failed:", error);
  }

  return clients.openWindow(url);
}

/* ============================================================
   INSTALL / ACTIVATE
   ============================================================ */

self.addEventListener("install", () => {
  console.log("[TruckConnect SW] Installed");

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("[TruckConnect SW] Activated");

  event.waitUntil(self.clients.claim());
});
