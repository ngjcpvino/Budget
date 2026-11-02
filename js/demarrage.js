/* =====================================================================
   LE DÉMARRAGE : la mémoire de l'appareil d'abord (l'app s'affiche tout de suite, derrière l'écran du code),
   puis l'écran du code (ou de la liaison); la feuille est lue une fois le code entré.
   ===================================================================== */
(async function demarrer() {
  afficher();
  const m = await lireMemoire(), etat = m.etat;
  cleAppareil = etat.cle || '';
  nomAppareil = etat.appareil || '';
  curseur = etat.curseur || 0;
  generation = etat.generation || '';
  code = etat.code || {};
  courrielLiaison = etat.courriel || '';
  if (etat.reglages) {
    appliquerReglages(etat.reglages);
    donnees.ex = m.lignes;
    donnees.rec = m.recurrentes;
  }
  fileEnvois = m.envois;
  lecture = donnees.ex.length ? '' : 'attente';
  afficher();
  verrouiller();
  /* La copie de l'app dans l'appareil (sw.js) : elle s'ouvre même sans réseau. Et demander que sa mémoire ne soit jamais vidée */
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
})();
