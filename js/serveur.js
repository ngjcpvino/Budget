/* =====================================================================
   LA FEUILLE GOOGLE (le serveur, Api.gs) : envoyer les changements, recevoir ceux de l'autre appareil
   - Enregistrer : le changement entre dans l'app, dans la mémoire de l'appareil et dans la file des envois (memoriser),
     puis part tout de suite. Sans réseau, il attend dans la file (« Hors ligne : sera envoyé plus tard. ») et repart seul :
     au retour du réseau, au retour dans l'app, et aux 30 secondes.
   - Recevoir : seulement ce qui a changé depuis le curseur (la dernière rangée du Journal vue par cet appareil).
     Une ligne qui attend encore son envoi garde la version de l'appareil.
   - La feuille vérifie tout et décide de la version (son heure à elle) : l'horloge de l'appareil ne compte pas.
   ===================================================================== */

const API_URL = window.BUDGET_API || 'https://script.google.com/macros/s/AKfycbwhcPGCW-l4odWfpw_DDBycANrEKn87DXGaiW2qlu62CT34C5vBT4lvq75aP5hS2p2ZIg/exec';

let cleAppareil = '';        // la clé de cet appareil (reçue une fois, avec un code de liaison)
let nomAppareil = '';        // « iPad », « Ordi » : ce que le Journal de la feuille note
let curseur = 0;             // la dernière rangée du Journal que l'appareil a vue
let generation = '';         // change quand toute la feuille doit être relue
let fileEnvois = [];         // les changements pas encore reçus par la feuille : { n, genre, objet | id, base }
let synchroEnCours = false, synchroARefaire = false, toutARelire = false, dernierChargement = 0, minuterieReessai = null;
let numeroEnvoi = 0;
let messageApres = '';       // un message à montrer une fois la synchronisation finie (un refus de la feuille)

/* Un appel au serveur → son résultat; une erreur : « reseau », « CLE:… », « CODE:… », « LIAISON:… » ou un texte */
async function appelServeur(action, data = {}, delai = 30000) {
  const controleur = new AbortController(), minuterie = setTimeout(() => controleur.abort(), delai);
  let reponse;
  try {
    reponse = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action, data, cle: cleAppareil, empreinte: code.e || '' }), signal: controleur.signal });
  } catch (e) {
    throw new Error('reseau');
  } finally {
    clearTimeout(minuterie);
  }
  let r;
  try { r = await reponse.json(); } catch (e) { throw new Error('reseau'); }
  if (!r.ok) throw new Error(r.erreur || 'Le serveur ne répond pas comme prévu.');
  return r.resultat;
}

/* ----- Enregistrer : dans l'app (déjà fait par l'appelant), dans l'appareil, dans la file; puis l'envoi -----
   changements : [{ genre: 'ligne' | 'creer', objet }, { genre: 'supprimer', id }, { genre: 'rec', objet }, { genre: 'supprimerRec', id }] */
function memoriser(changements) {
  const lignes = [], recurrentes = [], envois = [];
  changements.forEach(c => {
    const envoi = { n: Date.now() * 1000 + (numeroEnvoi++ % 1000), genre: c.genre };
    if (c.objet) envoi.objet = JSON.parse(JSON.stringify(c.objet));
    else envoi.id = c.id;
    envois.push(envoi);
    if (c.genre === 'ligne' || c.genre === 'creer') lignes.push(c.objet);
    else if (c.genre === 'supprimer') lignes.push(donnees.ex.find(e => e.id === c.id));
    else if (c.genre === 'rec') recurrentes.push(c.objet);
    else if (c.genre === 'supprimerRec') recurrentes.push(donnees.rec.find(r => r.id === c.id));
  });
  fileEnvois.push(...envois);
  ecrireMemoire({ lignes: lignes.filter(Boolean), recurrentes: recurrentes.filter(Boolean), envois });
  synchroniser();
}

/* Les Réglages ont changé (une catégorie, un tiers, un compte…) : ils partent d'un bloc, avec la version lue (base).
   Un seul envoi des Réglages attend à la fois : le plus récent remplace les autres */
function changerReglages() {
  donnees.cats.sort((x, y) => x.localeCompare(y, 'fr', { sensitivity: 'base' }));
  trierComptes();
  const vieux = fileEnvois.filter(e => e.genre === 'cfg' && !e.parti).map(e => e.n);
  fileEnvois = fileEnvois.filter(e => !vieux.includes(e.n));
  const envoi = { n: Date.now() * 1000 + (numeroEnvoi++ % 1000), genre: 'cfg', objet: JSON.parse(JSON.stringify(configuration())), base: donnees.cu || 0 };
  fileEnvois.push(envoi);
  ecrireMemoire({ etat: { reglages: { ...configuration(), u: donnees.cu || 0 } }, envois: [envoi], retirer: vieux });
  synchroniser();
}
function configuration() {
  return { p: donnees.p, cats: donnees.cats, tiers: donnees.tiers, modes: donnees.modes, ic: donnees.ic || {}, cc: donnees.cc || {}, gone: donnees.gone || [], yrs: donnees.yrs || [], env: donnees.env || [] };
}

/* ----- Les messages en haut de l'écran ----- */
let minuterieMessage = null;
function afficherStatut(texte) {
  const x = trouver('#message');
  x.textContent = texte;
  x.style.display = texte ? 'block' : 'none';
}
function afficherMessage(texte) {
  afficherStatut(texte);
  clearTimeout(minuterieMessage);
  minuterieMessage = setTimeout(() => afficherStatut(fileEnvois.length && !navigator.onLine ? 'Hors ligne : sera envoyé plus tard.' : ''), 3500);
}

/* ----- Synchroniser : envoyer la file, recevoir ce qui a changé (ou tout relire) ----- */
async function synchroniser({ tout = false } = {}) {
  if (tout) toutARelire = true;
  if (verrou || !cleAppareil) return;
  if (synchroEnCours) { synchroARefaire = true; return; }
  synchroEnCours = true;
  synchroARefaire = false;
  clearTimeout(minuterieReessai);
  dernierChargement = Date.now();
  let echec = false;
  try {
    if (toutARelire || lecture || !generation) {
      if (lecture === 'echec') { lecture = 'attente'; afficher(); }
      afficherStatut('Chargement…');
      const r = await appelServeur('lire', {}, 90000);
      toutARelire = false;
      await appliquerTout(r);
    } else if (fileEnvois.length) {
      const lot = fileEnvois.slice();
      lot.forEach(e => { e.parti = true; });
      afficherStatut('Enregistrement…');
      const r = await appelServeur('ecrire', { changements: lot.map(({ n, parti, ...reste }) => reste), curseur, appareil: nomAppareil });
      fileEnvois = fileEnvois.filter(e => !lot.includes(e));
      await appliquerReponse(r, lot.map(e => e.n));
    } else {
      const r = await appelServeur('changements', { curseur, generation });
      if (r.complet) await appliquerTout(r); else await appliquerReponse(r, []);
    }
    lecture = '';
    genererRecurrentes();
    attribuerCouleurs();
    afficherStatut('');
    afficher();
    if (messageApres && !toutARelire) { afficherMessage(messageApres); messageApres = ''; }
  } catch (e) {
    echec = true;
    fileEnvois.forEach(x => { delete x.parti; });
    if (erreurCle(e) || erreurCode(e)) return;
    if (lecture) { lecture = 'echec'; afficher(); }
    afficherStatut(fileEnvois.length ? 'Hors ligne : sera envoyé plus tard.' : e.message === 'reseau' ? '' : 'Connexion impossible : ' + e.message);
  } finally {
    synchroEnCours = false;
    if (!echec && (synchroARefaire || fileEnvois.length || toutARelire)) synchroniser();
    else if (fileEnvois.length) minuterieReessai = setTimeout(synchroniser, 30000);
  }
}

/* Actualiser (Plus) et Réessayer : tout relire */
function actualiser() {
  synchroniser({ tout: true });
}

/* Les identifiants des changements qui attendent encore (leur version de l'appareil gagne sur celle qui arrive) */
function enAttente() {
  const s = new Set();
  fileEnvois.forEach(e => {
    if (e.genre === 'cfg') return;
    s.add((e.genre === 'rec' || e.genre === 'supprimerRec' ? 'r:' : 'l:') + (e.id || e.objet.id));
  });
  return s;
}

/* Les Réglages reçus de la feuille */
function appliquerReglages(cfg) {
  ['p', 'cats', 'tiers', 'modes', 'gone', 'yrs', 'env'].forEach(k => { donnees[k] = cfg[k] || []; });
  donnees.ic = cfg.ic || {};
  donnees.cc = cfg.cc || {};
  donnees.cu = cfg.u || 0;
  normaliserComptes();
  donnees.cats = donnees.cats.filter(c => !donnees.gone.includes(c)).sort((x, y) => x.localeCompare(y, 'fr', { sensitivity: 'base' }));
}

/* Une lecture complète : tout est remplacé, sauf ce qui attend encore son envoi */
async function appliquerTout(r) {
  const attente = enAttente(), garder = (prefixe, liste) => liste.filter(x => attente.has(prefixe + x.id));
  const lignes = new Map(r.ex.map(e => [e.id, e])), recurrentes = new Map(r.rec.map(x => [x.id, x]));
  garder('l:', donnees.ex).forEach(e => lignes.set(e.id, e));
  garder('r:', donnees.rec).forEach(x => recurrentes.set(x.id, x));
  donnees.ex = [...lignes.values()];
  donnees.rec = [...recurrentes.values()];
  if (r.cfg && !fileEnvois.some(e => e.genre === 'cfg')) appliquerReglages(r.cfg);
  curseur = r.curseur;
  generation = r.generation;
  await ecrireMemoire({ vider: true, lignes: donnees.ex, recurrentes: donnees.rec, etat: { curseur, generation, reglages: { ...configuration(), u: donnees.cu } } });
}

/* La réponse à un envoi (ou les changements) : ce qui a changé depuis le curseur, ce qui a été reçu, ce qui a été refusé */
async function appliquerReponse(r, partis) {
  const attente = enAttente(), lignesChangees = [], recChangees = [];
  /* Une ligne « creer » que la feuille avait déjà (l'autre appareil l'a ajoutée, peut-être corrigée) : la version de la feuille */
  (r.acceptes || []).filter(a => a.objet && a.genre === 'ligne').forEach(a => r.ex.push(a.objet));
  if (r.ex.length) {
    const parId = new Map(donnees.ex.map(e => [e.id, e]));
    r.ex.forEach(o => { if (!attente.has('l:' + o.id)) { parId.set(o.id, o); lignesChangees.push(o); } });
    donnees.ex = [...parId.values()];
  }
  if (r.rec.length) {
    const parId = new Map(donnees.rec.map(x => [x.id, x]));
    r.rec.forEach(o => { if (!attente.has('r:' + o.id)) { parId.set(o.id, o); recChangees.push(o); } });
    donnees.rec = [...parId.values()];
  }
  /* Les Réglages reçus (le cas échéant), et la version à donner aux Réglages qui attendent encore */
  (r.acceptes || []).filter(a => a.genre === 'cfg').forEach(a => {
    donnees.cu = a.u;
    fileEnvois.filter(e => e.genre === 'cfg').forEach(e => { e.base = a.u; });
  });
  if (r.cfg && !fileEnvois.some(e => e.genre === 'cfg')) appliquerReglages(r.cfg);
  /* Ce que la feuille a refusé : on le dit, et on reprend la version de la feuille */
  (r.refuses || []).forEach(x => {
    toutARelire = true;
    messageApres = x.raison === 'REGLAGES:changes' ? "Les réglages ont changé sur l'autre appareil : refais ton dernier changement."
      : 'Pas enregistré (' + x.raison + ') : vérifie la ligne et recommence.';
  });
  if (r.generation && generation && r.generation !== generation) toutARelire = true;
  curseur = r.curseur;
  await ecrireMemoire({ lignes: lignesChangees, recurrentes: recChangees, retirer: partis, etat: { curseur, generation, reglages: { ...configuration(), u: donnees.cu } } });
}

/* Le serveur ne reconnaît pas la clé de l'appareil (jamais relié, ou retiré) : l'écran de liaison */
function erreurCle(e) {
  if (!/^CLE:/.test(String(e && e.message))) return false;
  cleAppareil = '';
  ecrireMemoire({ etat: { cle: '' } });
  afficherStatut('');
  verrouiller('liaison');
  return true;
}

/* Revenir à l'app (pas plus d'une fois aux 30 secondes), et le retour du réseau : on se remet à jour.
   Après 5 minutes sans s'en servir, l'app revient plutôt sur l'écran du code */
document.addEventListener('visibilitychange', () => {
  if (document.hidden || verrou) return;
  if (Date.now() - derniereActivite > DELAI_CODE) verrouiller();
  else if (Date.now() - dernierChargement > 30000 || fileEnvois.length) synchroniser();
});
window.addEventListener('online', () => {
  if (!verrou) synchroniser();
  else if (verrou.etape === 'reseau') verrouiller();
});
