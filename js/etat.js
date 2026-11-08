/* =====================================================================
   ÉTAT — ce que l'app a en main pendant qu'elle tourne
   donnees : le budget (les Réglages + ex, les lignes + rec, les récurrentes), tel que la feuille le garde.
   Le reste : ce que l'écran montre (la page, l'année, les filtres…).
   ===================================================================== */

/* Le budget. Il arrive de la mémoire de l'appareil (memoire.js), puis de la feuille (serveur.js) */
let donnees = budgetVide();
function budgetVide() {
  return { p: ['', ''], cats: [], gone: [], tiers: [], modes: [], env: [], ic: {}, cc: {}, yrs: [], ex: [], rec: [], cu: 0 };
}

/* La lecture de la feuille quand l'appareil n'a encore rien : 'attente', 'echec' (pas pu être lue), '' (lue).
   Rien ne s'ajoute avant : sinon des Réglages vides écraseraient ceux de la feuille */
let lecture = 'attente';
const PAS_LUES = 'Les dépenses ne sont pas encore lues.';

/* « Qui paie » : un placement (dans le formulaire Paiement) */
const PLACEMENT = '@p';

/* L'écran.
   vue : home (Accueil) · list (Dépenses) · env (Placements) · pl (un placement) · ti (Tiers) · more (Plus) · cpt (Comptes)
         · cl (un compte) · gl (le GL : toutes les lignes) · cmp (Comparatif) · rel (un relevé)
   modeAccueil, filtres.p, cmpMode : '' = les communes, 't' = tout, sinon le nom d'une personne (son perso) */
let anneeCourante = new Date().getFullYear();
let vue = 'home';
let filtres = { m: '', c: '', p: '', q: '' };
let tri = 'd';            // d : par date · a : par montant
let niveau = 'c';         // c : par catégories · d : le détail
let modeAccueil = '';
let tiersOuvert = '';
let placementOuvert = '';
let compteOuvert = '';
let moisLignes = '';
let cmpMode = '';
let cmpPeriode = 'p';     // p : même période · c : années complètes
let releve = null;        // le relevé de la banque en cours (releve.js)
let ligneReleve = -1;     // la ligne du relevé ouverte dans un formulaire

/* Le comparatif : les années décochées restent décochées sur cet appareil */
let decochees = [];
try { decochees = JSON.parse(localStorage.getItem('budgetCmp')) || []; } catch (e) { decochees = []; }

/* La fenêtre ouverte (un formulaire) sait se refaire (rouvrir) avec ce qui est tapé (lireEtat) */
let rouvrir = () => {};
let lireEtat = () => ({});
