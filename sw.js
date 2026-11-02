/* =====================================================================
   SW.JS — la copie de l'app dans l'appareil : elle s'ouvre tout de suite, même sans réseau
   La copie répond d'abord (rapide, même avec le VPN); en même temps, le site est relu et la copie refaite :
   une nouvelle version de l'app paraît à l'ouverture suivante.
   Ne touche jamais à la feuille (les appels POST vers Apps Script).
   ===================================================================== */

const CACHE_APP = 'budget-app-v2';

const FICHIERS = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest', 'icone-152.png', 'icone-167.png', 'icone-180.png', 'icone-512.png',
  'js/socle.js', 'js/etat.js', 'js/modele.js', 'js/memoire.js', 'js/serveur.js', 'js/pages-accueil.js', 'js/pages-depenses.js',
  'js/pages-placements.js', 'js/pages-comptes.js', 'js/pages-tiers-plus.js', 'js/formulaires.js', 'js/modifier.js',
  'js/recurrentes.js', 'js/releve.js', 'js/code.js', 'js/demarrage.js'
];
/* La police Nunito (Google Fonts) : gardée aussi, au premier passage */
const POLICES = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];

const aGarder = url => {
  const u = new URL(url);
  if (u.origin === self.location.origin) return !u.pathname.endsWith('/sw.js');
  return POLICES.includes(u.origin);
};
const cleCache = url => url.split('?')[0];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_APP).then(cache => Promise.all(FICHIERS.map(f => fetch(f, { cache: 'no-cache' })
    .then(rep => rep.ok ? cache.put(cleCache(new URL(f, self.location).href), rep) : null).catch(() => null)))));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(cles => Promise.all(cles.filter(k => k.startsWith('budget-app') && k !== CACHE_APP).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || !aGarder(req.url)) return;
  e.respondWith(copiePuisReseau(req, e));
});

/* La copie tout de suite; le réseau refait la copie pour la prochaine fois. Sans copie : le réseau */
function copiePuisReseau(req, e) {
  const cle = cleCache(req.url);
  const reseau = fetch(req).then(rep => {
    if (rep && (rep.ok || rep.type === 'opaque')) {
      const copie = rep.clone();
      caches.open(CACHE_APP).then(cache => cache.put(cle, copie));
    }
    return rep;
  });
  e.waitUntil(reseau.catch(() => null));
  return caches.match(cle).then(copie => copie || reseau);
}
