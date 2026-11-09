/* =====================================================================
   LE DÉMARRAGE : la mémoire de l'appareil d'abord (l'app s'affiche tout de suite, derrière l'écran du code),
   puis l'écran du code (ou de la liaison); la feuille est lue une fois le code entré.
   ===================================================================== */
let avaitUneVersion = false, versionPrete = false;   // la mise à jour toute seule (plus bas)
(async function demarrer() {
  afficher();
  const m = await lireMemoire(), etat = m.etat;
  cleAppareil = etat.cle || '';
  nomAppareil = etat.appareil || '';
  curseur = etat.curseur || 0;
  generation = etat.generation || '';
  code = etat.code || {};
  if (etat.reglages) {
    appliquerReglages(etat.reglages);
    donnees.ex = m.lignes;
    donnees.rec = m.recurrentes;
  }
  fileEnvois = m.envois;
  lecture = donnees.ex.length ? '' : 'attente';
  afficher();
  verrouiller();
  try {
    if (sessionStorage.getItem('budgetMiseAJour')) { sessionStorage.removeItem('budgetMiseAJour'); afficherMessage("L'app vient de se mettre à jour."); }
  } catch (e) { /* sans sessionStorage : pas de message, rien d'autre */ }
  /* La copie de l'app dans l'appareil (sw.js) : elle s'ouvre même sans réseau. Et demander que sa mémoire ne soit jamais vidée */
  if ('serviceWorker' in navigator) {
    avaitUneVersion = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', nouvelleVersionInstallee);
    navigator.serviceWorker.register('sw.js').then(r => r.update()).catch(() => {});
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
})();

/* ----- La mise à jour toute seule (J-C, 2026-11-09) -----
   À l'ouverture et à chaque retour dans l'app, on demande s'il y a une nouvelle version. Elle s'installe au complet dans l'appareil
   (sw.js), puis la page se recharge d'elle-même quand c'est sans risque : sur l'écran du code avant le premier chiffre, ou quand on quitte
   l'app; jamais avec une fenêtre ouverte ou un relevé en cours. Rien ne se perd : ce qui attend d'être envoyé est dans la mémoire de l'appareil.
   La première installation (aucune version avant) ne recharge rien */
function nouvelleVersionInstallee() {
  if (!avaitUneVersion) { avaitUneVersion = true; return; }
  versionPrete = true;
  rechargerSiPossible(false);
}
function rechargerSiPossible(enQuittant) {
  if (!versionPrete) return;
  if (trouver('#modale').classList.contains('actif') || (vue === 'rel' && releve)) return;
  if (!enQuittant && !(verrou && !verrou.ch && !verrou.premier)) return;
  versionPrete = false;
  try { sessionStorage.setItem('budgetMiseAJour', '1'); } catch (e) { /* sans sessionStorage : pas de message */ }
  location.reload();
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return rechargerSiPossible(true);
  if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistration().then(r => r && r.update()).catch(() => {});
});
