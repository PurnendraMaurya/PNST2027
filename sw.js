// ============================================================
//  PNST Mock Test 2026 — Service Worker v3
//  Purnendra Maurya
// ============================================================

const CACHE_NAME = 'pnst-2026-v3';
const BASE = '/PNST2027';
const OFFLINE_PAGE = BASE + '/index.html';

const PRECACHE_URLS = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/manifest.json',
  BASE + '/biology_questions.json',
  BASE + '/chemistry_questions.json',
  BASE + '/physics_questions.json',
  BASE + '/gk_questions.json',
  BASE + '/english_questions.json',
  BASE + '/biology.html',
  BASE + '/chemistry.html',
  BASE + '/physics.html',
  BASE + '/gk.html',
  BASE + '/english.html',
  BASE + '/icons/icon-192.png',
  BASE + '/icons/icon-512.png',
  BASE + '/icons/icon-144.png',
  BASE + '/icons/icon-96.png',
  BASE + '/icons/icon-72.png'
];

// ============================================================
//  INSTALL
// ============================================================
self.addEventListener('install', function(event) {
  console.log('[SW] Installing PNST v3...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      // Required HTML/JSON files — ek ek try karo taaki ek fail se sab na ruke
      return Promise.allSettled(
        PRECACHE_URLS.map(function(url) {
          return cache.add(url).catch(function(e) {
            console.warn('[SW] Could not cache:', url, e.message);
          });
        })
      ).then(function() {
        // External fonts bhi try karo
        return Promise.allSettled([
          cache.add('https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Noto+Sans:wght@400;500;700;800&display=swap'),
          cache.add('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2')
        ]);
      });
    }).catch(function(err) {
      console.warn('[SW] Install error:', err.message);
    })
  );
  self.skipWaiting();
});

// ============================================================
//  ACTIVATE
// ============================================================
self.addEventListener('activate', function(event) {
  console.log('[SW] Activating PNST v3...');
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function(name) { return name !== CACHE_NAME; })
          .map(function(name) {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(function() {
      console.log('[SW] PNST v3 activated!');
      return self.clients.claim();
    })
  );
});

// ============================================================
//  FETCH
// ============================================================
self.addEventListener('fetch', function(event) {
  var url = event.request.url;

  // API calls — NEVER cache
  if (url.includes('supabase.co') || url.includes('supabase.io') ||
      url.includes('groq.com') || url.includes('openai.com') ||
      url.includes('accounts.google.com') || url.includes('googleapis.com/oauth') ||
      url.includes('anthropic.com')) {
    return; // browser handle kare
  }

  // Question JSON — Cache first, background update
  if (url.includes('_questions.json')) {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        var fetchPromise = fetch(event.request).then(function(response) {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, response.clone());
            });
          }
          return response;
        }).catch(function() { return cached; });
        return cached || fetchPromise;
      })
    );
    return;
  }

  // HTML pages — Network first, cache fallback
  if (event.request.mode === 'navigate' || url.endsWith('.html') || url.endsWith('/')) {
    event.respondWith(
      fetch(event.request).then(function(response) {
        if (response && response.status === 200) {
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, response.clone());
          });
        }
        return response;
      }).catch(function() {
        return caches.match(event.request).then(function(cached) {
          return cached || caches.match(OFFLINE_PAGE);
        });
      })
    );
    return;
  }

  // CSS, JS, Fonts, Images — Cache first
  if (url.endsWith('.css') || url.endsWith('.js') || url.endsWith('.png') ||
      url.endsWith('.jpg') || url.endsWith('.svg') || url.endsWith('.woff2') ||
      url.includes('fonts.googleapis') || url.includes('fonts.gstatic') ||
      url.includes('jsdelivr.net')) {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        return cached || fetch(event.request).then(function(response) {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, response.clone());
            });
          }
          return response;
        }).catch(function() { return cached; });
      })
    );
    return;
  }

  // Default — Network first
  event.respondWith(
    fetch(event.request).catch(function() {
      return caches.match(event.request);
    })
  );
});

// ============================================================
//  PUSH NOTIFICATIONS
// ============================================================
self.addEventListener('push', function(event) {
  var data = event.data ? event.data.json() : {};
  var title = data.title || 'PNST 2026 — Daily Quiz!';
  var options = {
    body: data.body || 'Aaj ka Daily Quiz ready hai. Ab test do!',
    icon: BASE + '/icons/icon-192.png',
    badge: BASE + '/icons/icon-96.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || BASE + '/index.html' },
    actions: [
      { action: 'open', title: '🎯 Test Do' },
      { action: 'dismiss', title: '❌ Baad Mein' }
    ]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.action === 'dismiss') return;
  var url = (event.notification.data && event.notification.data.url) || BASE + '/index.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        if (clientList[i].url === url && 'focus' in clientList[i]) return clientList[i].focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

console.log('[SW] PNST Mock Test 2026 Service Worker v3 loaded!');
