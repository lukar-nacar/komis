// Service worker: przechowuje pliki aplikacji, żeby otwierała się szybko i bez sieci.
// Dane z arkusza zawsze idą prosto z Google (nie są zapisywane w pamięci telefonu).
const VERSION = 'komis-v2';
const SHELL = ['./', 'index.html', 'app.css', 'config.js', 'api.js', 'model.js', 'demo.js', 'ui.js', 'app.js',
  'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'lukar.svg', 'nacar.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // Google API, czcionki itp. – bez cache
  // Najpierw sieć (świeża wersja aplikacji), a bez sieci – kopia z pamięci.
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone();
    caches.open(VERSION).then(c => c.put(e.request, copy));
    return r;
  }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});
