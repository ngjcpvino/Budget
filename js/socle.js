/* =====================================================================
   SOCLE — les outils de base partagés par toute l'app
   (texte sûr, argent, dates, constantes). Aucune donnée personnelle ici :
   les noms, les catégories et les montants viennent tous de la feuille.
   ===================================================================== */

const trouver = selecteur => document.querySelector(selecteur);

/* Un texte qu'on glisse dans la page : jamais interprété comme du HTML */
const securiser = texte => String(texte ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* Un texte glissé dans un onclick="…('texte')" */
const js = texte => securiser(texte).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

/* 1234.5 → « 1 234,50 $ » */
const argent = n => (Math.round(+n * 100) / 100 || 0).toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' $';

/* Un montant tapé (« 1 234,56 $ », « 12.5 »…) devient un nombre; vide ou illisible : '' */
const lireMontant = texte => {
  const n = parseFloat(String(texte ?? '').replace(/[\s$]/g, '').replace(',', '.'));
  return isNaN(n) ? '' : n;
};

/* Arrondi au cent (les montants additionnés gardent des poussières de virgule) */
const auCent = n => Math.round((+n || 0) * 100) / 100;

/* Un identifiant neuf, propre à cet appareil */
const nouvelId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* Une date du calendrier → « 2026-10-19 » (heure locale) */
const dateIso = jour => jour.getFullYear() + '-' + String(jour.getMonth() + 1).padStart(2, '0') + '-' + String(jour.getDate()).padStart(2, '0');
const aujourdhui = () => dateIso(new Date());

/* « 2026-10-19 » est-elle une vraie date ? */
const dateValide = texte => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(texte || ''));
  return !!m && dateIso(new Date(+m[1], m[2] - 1, +m[3])) === texte;
};

const MOIS_COURTS = ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];
const MOIS_ABREGES = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MOIS_LONGS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

/* « 19 oct. », ou « sans date » */
const dateCourte = d => d ? +d.slice(8) + ' ' + MOIS_ABREGES[+d.slice(5, 7) - 1] : 'sans date';

/* « 3 lignes », « 1 ligne » */
const pluriel = (n, mot) => n + ' ' + mot + (n > 1 ? 's' : '');

/* Pour comparer des noms : sans accents, sans majuscules, sans ponctuation */
const simplifier = texte => String(texte || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/* x : un modèle, sans date (il ne s'ajoute jamais seul) */
const FREQUENCES = { w: 'Chaque semaine', b: 'Aux 2 semaines', m: 'Chaque mois', q: 'Chaque trimestre', s: 'Aux 6 mois', x: 'Sans date' };

/* Les genres de lignes. Dans la feuille, la colonne Type garde ses mots (Transfert, Remboursement, Payé par l'enveloppe…).
   e dépense · m placement (mise de côté) · f intérêts ou remise · t paiement sur une carte · r paiement à une personne · p un placement paie la carte */
const LIBELLES_TYPE = { e: 'Dépense', r: 'Paiement', m: 'Placement', f: 'Intérêts ou remise', p: 'Payé par un placement', t: 'Paiement' };
const ICONES_TYPE = { r: '💳', m: '🏦', f: '📈', p: '💳', t: '💳' };
const TITRES_FENETRE = {
  e: ['Nouvelle dépense', 'Modifier la dépense'],
  m: ['Nouveau placement', 'Modifier le placement'],
  f: ['Nouvelle remise', 'Modifier la remise'],
  i: ['Nouveaux intérêts', 'Modifier les intérêts']
};

/* Les couleurs des catégories : --categorie-1 à --categorie-12 dans styles.css */
const NB_COULEURS = 12;

/* La grille d'emojis, la même pour les catégories et les placements */
const ICONES_CHOIX = ['🚗', '🖥️', '🎁', '💇', '🏦', '🧩', '🛒', '⛽', '📶', '🌊', '🎟️', '🚙', '💝', '↩️', '💊', '🔨', '🍽️', '🔒', '✈️', '👕',
  '💰', '🍁', '🌴', '🏠', '☕', '📱', '💡', '💧', '🔥', '🐶', '🎓', '🎬', '💼', '🧾', '🛠️', '❤️', '🧒', '🏋️', '🎵', '📚', '🚌', '🧴', '🪴',
  '🍺', '🧹', '🚲', '🛍️', '🍕', '🧳', '🏥', '🎮', '🐱', '🌳'];
