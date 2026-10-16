// public/sw.js
const CACHE_NAME = 'clear-system-v1';

// Install event - basic setup
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Fetch event - Network first strategy to ensure live financial records are always fetched
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests (like server action POSTs)
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});