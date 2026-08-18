import { NextResponse } from 'next/server';

/**
 * The service worker that receives web push, served as a route rather than
 * dropped in /public.
 *
 * A worker has to be served from the origin root to control the whole origin,
 * which is why the path looks like a file. It cannot be a static file though:
 * it needs the Firebase project config, and putting that in /public would mean
 * hardcoding values that already live in environment variables. Generating it
 * here keeps one source of truth and lets a preview deployment point at a
 * different project without editing a checked-in file.
 *
 * The config below is not secret. Firebase publishes it in every web app that
 * uses it, and what protects the project is the security rules and the service
 * account key, neither of which is here.
 *
 * importScripts from gstatic rather than bundling: a service worker is its own
 * script outside the app bundle, and the compat build is the only one Firebase
 * ships that works inside one.
 */
export async function GET() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
  };

  const body = `
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp(${JSON.stringify(config)});
const messaging = firebase.messaging();

/**
 * A notification that arrives while no tab is focused.
 *
 * Only fires for a data-only message; a message with a \`notification\` block is
 * displayed by the browser itself, and handling it here as well would show it
 * twice. The sender uses the notification block, so this is the fallback.
 */
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? 'MatricMate';
  self.registration.showNotification(title, {
    body: payload.notification?.body ?? '',
    icon: '/icon.png',
    badge: '/icon.png',
    tag: payload.data?.kind ?? 'matricmate',
    data: { target: payload.data?.target ?? 'home' },
  });
});

/** Where each destination name lives on this app. Mirrors NotificationTarget. */
const ROUTE = {
  home: '/dashboard',
  study: '/study',
  practice: '/practice',
  progress: '/progress',
  'session-setup': '/session/setup',
  report: '/insights/report',
  payments: '/account/payments',
  subscription: '/account/subscription',
};

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = ROUTE[event.notification.data?.target] || '/dashboard';
  event.waitUntil(
    // Focus a tab that is already open rather than piling up new ones.
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((all) => {
      for (const client of all) {
        if (client.url.includes(path) && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(path);
    }),
  );
});
`.trimStart();

  return new NextResponse(body, {
    headers: {
      'content-type': 'application/javascript; charset=utf-8',
      // Lets a worker served from this path control the whole origin.
      'service-worker-allowed': '/',
      // Short, not immutable: the config can change with a deployment, and a
      // stale worker is one that registers against the wrong project.
      'cache-control': 'public, max-age=0, must-revalidate',
    },
  });
}
