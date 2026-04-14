// ============================================================
// SERVICE WORKER - JIRAMA CHARGE MANAGER
// Version 4 - Full offline support
// ============================================================

const CACHE_NAME    = 'jirama-v4';
const CACHE_CDN     = 'jirama-cdn-v4';
const CACHE_FONTS   = 'jirama-fonts-v4';

// ── Fichiers locaux : cache obligatoire ──────────────────────
const LOCAL_FILES = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './database.js',
    './cloud-storage.js',
    './worker.js',
    './offline.html',
    './manifest.json',
];

// ── Ressources CDN critiques : cache au premier chargement ───
const CDN_FILES = [
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/webfonts/fa-solid-900.woff2',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/webfonts/fa-regular-400.woff2',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/webfonts/fa-brands-400.woff2',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
    'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js',
];

// ── Install : cache tous les fichiers locaux + CDN ───────────
self.addEventListener('install', event => {
    event.waitUntil(
        Promise.all([
            // Cache fichiers locaux (critique - doit réussir)
            caches.open(CACHE_NAME).then(cache => {
                return cache.addAll(LOCAL_FILES).catch(err => {
                    console.error('[SW] Erreur cache local:', err);
                    // Essai fichier par fichier pour identifier lequel échoue
                    return Promise.all(
                        LOCAL_FILES.map(url =>
                            cache.add(url).catch(e => console.warn('[SW] Skip:', url, e.message))
                        )
                    );
                });
            }),
            // Cache CDN (non-critique - on continue si ça échoue)
            caches.open(CACHE_CDN).then(cache => {
                return Promise.all(
                    CDN_FILES.map(url =>
                        fetch(url, { cache: 'force-cache' })
                            .then(r => r.ok ? cache.put(url, r) : null)
                            .catch(() => console.warn('[SW] CDN non disponible:', url))
                    )
                );
            }),
        ])
    );
    self.skipWaiting();
});

// ── Activate : nettoyer anciens caches ───────────────────────
self.addEventListener('activate', event => {
    const keep = [CACHE_NAME, CACHE_CDN, CACHE_FONTS];
    event.waitUntil(
        caches.keys().then(names =>
            Promise.all(
                names.filter(n => !keep.includes(n)).map(n => {
                    console.log('[SW] Suppression ancien cache:', n);
                    return caches.delete(n);
                })
            )
        )
    );
    self.clients.claim();
});

// ── Fetch : stratégie selon le type de ressource ─────────────
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Ignorer les requêtes non-GET et les APIs Google/EmailJS en ligne
    if (event.request.method !== 'GET') return;
    if (url.hostname === 'apis.google.com') return;
    if (url.hostname === 'accounts.google.com') return;

    // ── Fichiers locaux : Cache First, réseau en fallback ─────
    if (url.origin === location.origin) {
        event.respondWith(
            caches.match(event.request).then(cached => {
                if (cached) return cached;
                return fetch(event.request)
                    .then(response => {
                        if (response && response.status === 200) {
                            const clone = response.clone();
                            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
                        }
                        return response;
                    })
                    .catch(() => {
                        // Page HTML → retourner index.html
                        if (event.request.headers.get('accept') &&
                            event.request.headers.get('accept').includes('text/html')) {
                            return caches.match('./index.html');
                        }
                        return caches.match('./offline.html');
                    });
            })
        );
        return;
    }

    // ── Google Fonts : Stale While Revalidate ─────────────────
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
        event.respondWith(
            caches.open(CACHE_FONTS).then(cache =>
                cache.match(event.request).then(cached => {
                    const fetchPromise = fetch(event.request)
                        .then(response => {
                            if (response && response.status === 200) {
                                cache.put(event.request, response.clone());
                            }
                            return response;
                        })
                        .catch(() => null);
                    return cached || fetchPromise;
                })
            )
        );
        return;
    }

    // ── CDN (Font Awesome, Chart.js, html2pdf, EmailJS) ───────
    // Cache First : si en cache on sert immédiatement, sinon réseau
    if (url.hostname.includes('cdnjs.cloudflare.com') ||
        url.hostname.includes('cdn.jsdelivr.net') ||
        url.hostname.includes('unpkg.com')) {
        event.respondWith(
            caches.match(event.request).then(cached => {
                if (cached) return cached;
                return fetch(event.request)
                    .then(response => {
                        if (response && response.status === 200) {
                            const clone = response.clone();
                            caches.open(CACHE_CDN).then(c => c.put(event.request, clone));
                        }
                        return response;
                    })
                    .catch(() => null);
            })
        );
        return;
    }

    // ── Autres requêtes réseau : réseau avec fallback cache ────
    event.respondWith(
        fetch(event.request)
            .catch(() => caches.match(event.request))
    );
});

// ── Messages ─────────────────────────────────────────────────
self.addEventListener('message', event => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
    if (event.data === 'clearCache') {
        caches.keys().then(names => Promise.all(names.map(n => caches.delete(n))));
    }
});
