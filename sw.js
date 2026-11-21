// Service worker: პირველივე გახსნისას ყველა ფაილი ქეშირდება, შემდეგ აპლიკაცია სრულად offline-ში მუშაობს.
// განახლება: შეცვალე CACHE_VERSION (მაგ. abacus-v2) — ძველი ქეში წაიშლება და ახალი ფაილები ჩაიტვირთება.

const CACHE_VERSION = 'abacus-v4';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/ui.js',
  './js/soroban.js',
  './js/soroban-view.js',
  './js/techniques.js',
  './js/generator.js',
  './js/levels.js',
  './js/lessons.js',
  './js/progress.js',
  './js/lesson-player.js',
  './js/exercise.js',
  './js/muldiv.js',
  './js/exam.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      // cache: 'reload' — ვიღებთ ახალ ფაილებს სერვერიდან და არა ბრაუზერის HTTP ქეშიდან
      .then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('abacus-') && k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // ნავიგაცია (აპლიკაციის გახსნა): ყოველთვის ქეშირებული index.html — offline-შიც
    event.respondWith(
      caches.match('./index.html').then((cached) => cached || fetch(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        }
        return res;
      });
    })
  );
});
