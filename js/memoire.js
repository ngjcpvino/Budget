/* =====================================================================
   LA MÉMOIRE DE L'APPAREIL (IndexedDB, la base « budget »)
   Tout le budget y est gardé : l'app s'ouvre tout de suite, même sans réseau.
   Une entrée y est écrite AVANT d'être envoyée (avec son envoi en attente, dans la même opération),
   et son envoi n'en sort qu'une fois que la feuille a répondu « reçu » : rien ne se perd si le réseau tombe ou si l'app se ferme.
     lignes      : les lignes (par identifiant)
     recurrentes : les récurrentes (par identifiant)
     etat        : reglages, curseur, generation (où en est l'appareil avec la feuille), cle et appareil (la liaison), code (le code d'entrée)
     envois      : la file des changements pas encore reçus par la feuille, dans l'ordre (n)
   ===================================================================== */

let memoireOuverte = null;
let memoireFragile = false;   // IndexedDB refusé (navigation privée…) : l'app marche, mais ne garde rien d'une fois à l'autre

function ouvrirMemoire() {
  if (!memoireOuverte) memoireOuverte = new Promise(ok => {
    if (!window.indexedDB) return ok(null);
    let demande;
    try { demande = indexedDB.open('budget', 1); } catch (e) { return ok(null); }
    demande.onupgradeneeded = () => {
      const base = demande.result;
      base.createObjectStore('lignes', { keyPath: 'id' });
      base.createObjectStore('recurrentes', { keyPath: 'id' });
      base.createObjectStore('etat');
      base.createObjectStore('envois', { keyPath: 'n' });
    };
    demande.onsuccess = () => ok(demande.result);
    demande.onerror = () => ok(null);
    demande.onblocked = () => ok(null);
  }).then(base => {
    memoireFragile = !base;
    return base;
  });
  return memoireOuverte;
}

const resultat = demande => new Promise(ok => {
  demande.onsuccess = () => ok(demande.result);
  demande.onerror = () => ok(undefined);
});

/* Tout ce que l'appareil garde */
async function lireMemoire() {
  const vide = { lignes: [], recurrentes: [], etat: {}, envois: [] }, base = await ouvrirMemoire();
  if (!base) return vide;
  try {
    const t = base.transaction(['lignes', 'recurrentes', 'etat', 'envois'], 'readonly');
    const [lignes, recurrentes, cles, valeurs, envois] = await Promise.all([
      resultat(t.objectStore('lignes').getAll()), resultat(t.objectStore('recurrentes').getAll()),
      resultat(t.objectStore('etat').getAllKeys()), resultat(t.objectStore('etat').getAll()), resultat(t.objectStore('envois').getAll())
    ]);
    const etat = {};
    (cles || []).forEach((cle, i) => { etat[cle] = valeurs[i]; });
    return { lignes: lignes || [], recurrentes: recurrentes || [], etat, envois: (envois || []).sort((a, b) => a.n - b.n) };
  } catch (e) {
    return vide;
  }
}

/* Une seule opération : tout passe, ou rien. vider : remplacer toutes les lignes et récurrentes (après une lecture complète) */
async function ecrireMemoire({ lignes = [], recurrentes = [], etat = {}, envois = [], retirer = [], vider = false }) {
  const base = await ouvrirMemoire();
  if (!base) return false;
  return new Promise(ok => {
    let t;
    try { t = base.transaction(['lignes', 'recurrentes', 'etat', 'envois'], 'readwrite'); } catch (e) { return ok(false); }
    t.oncomplete = () => ok(true);
    t.onerror = () => ok(false);
    t.onabort = () => ok(false);
    const L = t.objectStore('lignes'), R = t.objectStore('recurrentes'), E = t.objectStore('etat'), F = t.objectStore('envois');
    if (vider) { L.clear(); R.clear(); }
    lignes.forEach(x => L.put(x));
    recurrentes.forEach(x => R.put(x));
    Object.keys(etat).forEach(cle => E.put(etat[cle], cle));
    envois.forEach(x => F.put(x));
    retirer.forEach(n => F.delete(n));
  });
}

/* Oublier tout ce que l'appareil garde (un appareil qu'on ne relie plus) */
async function effacerMemoire() {
  const base = await ouvrirMemoire();
  if (!base) return;
  const t = base.transaction(['lignes', 'recurrentes', 'etat', 'envois'], 'readwrite');
  ['lignes', 'recurrentes', 'etat', 'envois'].forEach(s => t.objectStore(s).clear());
}
