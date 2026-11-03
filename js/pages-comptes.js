/* =====================================================================
   COMPTES (Plus → Voir les soldes des comptes), la page d'un compte, et le formulaire d'un compte
   Une carte de crédit : « à payer ». Un débit ou un comptant : « payé en » (l'app ne voit pas l'argent qui y entre).
   Les chiffres viennent du modèle (calculerComptes, montantPourCompte).
   ===================================================================== */

/* Les comptes sont gardés en ordre alphabétique (le nom, puis le propriétaire) : toutes les listes suivent */
function trierComptes() {
  donnees.modes.sort((a, b) => (a.n + ' · ' + (a.o || '')).localeCompare(b.n + ' · ' + (b.o || ''), 'fr', { sensitivity: 'base' }));
}
/* Un compte sans genre : un débit ou un comptant est un actif, le reste une carte */
function normaliserComptes() {
  donnees.modes.forEach(m => {
    if (m.k !== 'a' && m.k !== 'p') m.k = /comptant|d[ée]bit|cash/i.test(m.n) ? 'a' : 'p';
    m.s = +m.s || 0;
  });
  trierComptes();
}

function pageComptes() {
  const comptes = calculerComptes(), y = anneeCourante, fin = finAnnee(y);
  if (!comptes.length) return `<div class=carte><div class=vide>Aucun compte.<br>Crée-en un dans Plus.</div></div>`;
  const cartes = comptes.filter(x => x.k === 'p'), autres = comptes.filter(x => x.k !== 'p');
  const bloc = (titre, liste, libelle) => liste.length ? `<div class="titre-date texte-discret">${titre}</div>` + liste.map(x => `<div class=carte onclick="voirCompte('${js(x.cle)}')"><h3>${securiser(x.nom)}${x.o ? ' · ' + securiser(x.o) : ''}</h3>`
    + `<div class=gros-chiffre><small>${libelle}</small><b class="${x.valeur < 0 ? 'negatif' : ''}">${argent(x.valeur)}</b></div></div>`).join('') : '';
  return `<div class="carte grande"><small>À payer sur les cartes${fin}</small><b>${argent(cartes.reduce((s, x) => s + x.valeur, 0))}</b></div>`
    + bloc('Cartes de crédit', cartes, 'À payer' + fin) + bloc('Débit et comptant', autres, 'Payé en ' + y)
    + `<div class=texte-discret>Touche un compte pour voir ses lignes.</div><div class="boutons espace-haut"><button onclick="pageCompte()">+ Ajouter un compte</button></div>`;
}

/* La page d'un compte : ses lignes, comme celles d'un placement. Une carte : ce qui en sort en plus, les paiements reçus en moins,
   et « Reporté » (ce qui restait à payer au 31 décembre d'avant). Un débit ou un comptant : ce qui a été payé avec lui, sans report */
function voirCompte(cle) {
  compteOuvert = cle;
  aller('cl');
}
function pageCompteLignes() {
  const y = anneeCourante, x = calculerComptes().find(c => c.cle === compteOuvert);
  if (!x) {
    vue = 'cpt';
    return pageComptes();
  }
  const carte = x.k === 'p', montantDe = e => montantPourCompte(e, x.cle), lignes = lignesQui(montantDe);
  return pageLignes({
    haut: securiser(x.nom) + (x.o ? ' · ' + securiser(x.o) : '') + ' · ' + (carte ? 'à payer' + finAnnee(y) : 'payé en ' + y),
    valeur: x.valeur, lignes, montantDe, report: carte ? reportAvant(x.depart, lignes, montantDe) : 0, icone: ICONES_TYPE.t, texteReport: 'À payer au 31 décembre'
  });
}

/* ----- Le formulaire d'un compte. Pas de compte commun : chaque compte a son propriétaire, et deux personnes peuvent avoir un compte du même nom.
   Le solde de départ ne sert qu'à une carte de crédit : changer le type refait la fenêtre ----- */
let sourceCompte = '';
const retourCompte = () => {
  if (sourceCompte === 'l') listeModifiable('modes');
  else { fermerFenetre(); afficher(); }
};
function pageCompte(i, source, pre) {
  sourceCompte = source || '';
  const [N, J] = donnees.p, o = { ...(i == null ? { n: '', o: N, k: 'a', s: 0 } : donnees.modes[i]), ...(pre || {}) };
  rouvrir = x => pageCompte(i, sourceCompte, x);
  lireEtat = () => ({ n: trouver('#f_nm').value, k: lireChamp('f_k'), o: lireChamp('f_o'), s: trouver('#f_solde') ? trouver('#f_solde').value : o.s });
  ouvrirFenetre(`<h2>${i == null ? 'Nouveau compte' : 'Modifier le compte'}</h2><label>Nom<input id=f_nm value="${securiser(o.n)}" autocomplete=off></label>`
    + `<label>Type${choixBoutons('f_k', [['a', 'Actif (débit, comptant)'], ['p', 'Passif (carte de crédit)']], o.k || 'a', 1)}</label><label>Propriétaire${choixBoutons('f_o', [N, J], o.o || N)}</label>`
    + (o.k === 'p' ? `<label>Solde de départ (ce qui restait à payer)<input id=f_solde type=text inputmode=decimal autocomplete=off value="${o.s || ''}"></label>` : '')
    + `<div class="boutons espace-haut">${i == null ? '' : `<button class=bouton-danger onclick="supprimerCompte(${i})">Supprimer</button>`}<button onclick="retourCompte()">Annuler</button><button class=bouton-principal onclick="enregistrerCompte(${i == null ? 'null' : i})">Enregistrer</button></div>`);
}
function enregistrerCompte(i) {
  if (!trouver('#f_nm')) return;
  const nom = trouver('#f_nm').value.trim(), genre = lireChamp('f_k'), proprietaire = lireChamp('f_o');
  const solde = genre === 'p' && trouver('#f_solde') ? +lireMontant(trouver('#f_solde').value) || 0 : 0, compte = { n: nom, o: proprietaire, k: genre, s: solde };
  if (!nom) return afficherMessage('Entre un nom.');
  if (donnees.modes.some((m, j) => cleCompte(m) === cleCompte(compte) && j !== i)) return afficherMessage(proprietaire + ' a déjà un compte « ' + nom + ' ».');
  if (i == null) donnees.modes.push(compte);
  else {
    const ancien = cleCompte(donnees.modes[i]);
    if (ancien !== cleCompte(compte)) appliquerRenommage('modes', ancien, cleCompte(compte));
    donnees.modes[i] = compte;
  }
  changerReglages();
  retourCompte();
}
function supprimerCompte(i) {
  const cle = cleCompte(donnees.modes[i]);
  if ([...donnees.ex, ...donnees.rec].some(e => !e.del && (e.mode === cle || e.to === cle))) return afficherMessage('Ce compte est utilisé : impossible de le supprimer.');
  confirmer('Supprimer « ' + securiser(cle) + ' » ?', () => {
    donnees.modes.splice(i, 1);
    changerReglages();
    retourCompte();
  }, () => pageCompte(i, sourceCompte));
}
