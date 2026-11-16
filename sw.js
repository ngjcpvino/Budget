/* =====================================================================
   SW.JS — la copie de l'app dans l'appareil : elle s'ouvre tout de suite, même sans réseau.
   Une version = tous les fichiers de l'app ensemble. Leurs empreintes (EMPREINTES) et la VERSION sont écrites par
   outils/version-page.js à chaque publication : un sw.js qui change = une nouvelle version.
   - Une nouvelle version s'installe au complet ou pas du tout : chaque fichier reçu doit avoir la bonne empreinte
     (sinon l'appareil garde l'ancienne, entière, et réessaie plus tard). Jamais un mélange de deux versions.
   - L'app répond toujours avec la version installée; elle se recharge d'elle-même vers la nouvelle quand c'est sans risque (js/demarrage.js).
   Ne touche jamais à la feuille (les appels POST vers Apps Script).
   ===================================================================== */

const VERSION = '3b0ac05da83a';
const EMPREINTES = {
  './': 'dee1825ae3af220f',
  'index.html': 'dee1825ae3af220f',
  'styles.css': 'e550bcdc5a93d1ec',
  'manifest.webmanifest': 'e55f769e98754cb5',
  'icone-trait-152.png': 'c144399751ee225e',
  'icone-trait-167.png': 'a3c8961aee4e56d5',
  'icone-trait-180.png': '4b75c4bd42ab3aa7',
  'icone-trait-512.png': 'ff41c3d9dcf7309e',
  'js/socle.js': '10fa5bdfe93037bf',
  'js/etat.js': 'c8ef18c897f7b319',
  'js/modele.js': '6b6ebd6f814079cc',
  'js/memoire.js': 'a8dbde51882722b9',
  'js/serveur.js': '9cc1dd765242c877',
  'js/pages-accueil.js': 'cb3c34ea697a3541',
  'js/pages-depenses.js': '62472ae0fad9417e',
  'js/pages-placements.js': '795b89223fbf83c1',
  'js/pages-comptes.js': 'a9bcdb74abf1dde0',
  'js/pages-tiers-plus.js': '7a7e25b9ed850f06',
  'js/formulaires.js': '71b6f3d87eef2d2e',
  'js/modifier.js': '91d0642e5757d20a',
  'js/recurrentes.js': 'e428dcd0c7ae913a',
  'js/releve.js': '7911b83d79226c6e',
  'js/code.js': 'e6327a12f2c1abb1',
  'js/demarrage.js': '3038a81d08ec8db1'
};
const CACHE_APP = 'budget-app-' + VERSION;

/* La police Nunito (Google Fonts) : gardée à part, au premier passage (elle ne change pas d'une version à l'autre) */
const CACHE_POLICES = 'budget-polices';
const POLICES = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];

const cleCache = url => url.split('#')[0].split('?')[0];
const hexa = octets => [...new Uint8Array(octets)].map(b => b.toString(16).padStart(2, '0')).join('');

/* Installer : tous les fichiers, chacun vérifié; un seul de travers et rien n'est gardé */
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_APP)
    .then(cache => Promise.all(Object.keys(EMPREINTES).map(async f => {
      const url = new URL(f, self.location).href, rep = await fetch(url, { cache: 'reload' });
      if (!rep.ok) throw new Error(f + ' : ' + rep.status);
      const empreinte = hexa(await crypto.subtle.digest('SHA-256', await rep.clone().arrayBuffer())).slice(0, 16);
      if (empreinte !== EMPREINTES[f]) throw new Error(f + ' : pas encore la nouvelle version');
      await cache.put(cleCache(url), rep);
    })))
    .then(() => self.skipWaiting())
    .catch(async erreur => { await caches.delete(CACHE_APP); throw erreur; }));
});

/* La nouvelle version prend la place : les anciennes copies partent */
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(cles => Promise.all(cles.filter(k => k.startsWith('budget-app') && k !== CACHE_APP).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request, origine = new URL(req.url).origin;
  if (req.method !== 'GET') return;
  if (origine === self.location.origin && !new URL(req.url).pathname.endsWith('/sw.js')) e.respondWith(versionInstallee(req));
  else if (POLICES.includes(origine)) e.respondWith(police(req));
});

/* Un fichier de l'app : celui de la version installée (le réseau seulement s'il manque) */
function versionInstallee(req) {
  return caches.open(CACHE_APP).then(cache => cache.match(cleCache(req.url))).then(copie => copie || fetch(req));
}
function police(req) {
  return caches.open(CACHE_POLICES).then(cache => cache.match(req.url).then(copie => copie || fetch(req).then(rep => {
    if (rep && (rep.ok || rep.type === 'opaque')) cache.put(req.url, rep.clone());
    return rep;
  })));
}
