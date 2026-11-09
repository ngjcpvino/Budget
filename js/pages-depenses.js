/* =====================================================================
   PAGE DÉPENSES, et les morceaux partagés par toutes les listes
   (le menu déroulant, la case de la date, la rangée d'une ligne)
   ===================================================================== */

/* Les choix d'un menu : l = [valeur] ou [[valeur, texte]]; s = le choisi; tous = un 1er choix vide (« Toute l'année ») */
const options = (liste, choisi, tous) => (tous ? `<option value="">${tous}</option>` : '') + liste.map(x => {
  const valeur = Array.isArray(x) ? x[0] : x, texte = Array.isArray(x) ? x[1] : x;
  return `<option value="${securiser(valeur)}" ${valeur == choisi ? 'selected' : ''}>${securiser(texte)}</option>`;
}).join('');

const CHOIX_MOIS = () => MOIS_LONGS.map((m, i) => [String(i + 1), m]);
const CHOIX_TRI = [['d', 'Par date'], ['a', 'Par montant']];

/* La date dans sa petite case : « 20 / oct. » (une ligne sans date : « ? ») */
const caseDate = d => `<div class=case-date>${d ? `<b>${+d.slice(8)}</b><small>${MOIS_ABREGES[+d.slice(5, 7) - 1]}</small>` : '<b>?</b>'}</div>`;

/* Une rangée de liste (Dépenses, un placement, un compte, le GL) : la date, l'icône, la description, le numéro d'écriture au début
   de la petite ligne grise (J-C, 2026-11-09), le montant; toucher = son formulaire. notes (le GL) : titre (une annulation), apres (« annulée par… ») */
function rangee(ligne, montant, notes = {}) {
  const [N, J] = donnees.p;
  const couleur = ligne.by === N ? 'texte-n' : ligne.by === J ? 'texte-jc' : '';
  return `<div class=ligne-depense onclick="editerEntree('${ligne.id}')">${caseDate(ligne.d)}<span class=icone>${ICONES_TYPE[ligne.type] || iconeCategorie(ligne.cat)}</span>`
    + `<div><b>${securiser(notes.titre || ligne.desc || ligne.cat || LIBELLES_TYPE[ligne.type] || '')}</b><small>${ligne.no ? 'n° ' + ligne.no + ' · ' : ''}${detailsLigne(ligne)}${notes.apres || ''}</small></div>`
    + `<b class="${couleur}">${argent(montant)}</b></div>`;
}

/* La petite ligne grise : qui paie et avec quoi (une dépense), qui paie qui (un paiement), ou le placement */
function detailsLigne(e) {
  if (e.type === 'f') return 'Placement ' + securiser(e.env);
  if (e.type === 'p') return 'Placement ' + securiser(e.env) + ' → ' + securiser(nomCompte(e.to));
  if (e.type === 't' || e.type === 'r') return securiser(e.by || proprietaireCompte(e.mode)) + ' → ' + securiser(e.type === 'r' ? e.nzf : nomCompte(e.to));
  const parts = partsDe(e);
  const texteParts = parts.length ? ' · payé ' + argent(e.amt) + parts.map(([qui, z]) => ' · ' + (estPersonne(qui) ? 'perso ' + argent(z) + ' (' + securiser(qui) + ')' : argent(z) + ' pour ' + securiser(qui))).join('') : '';
  return securiser(e.by) + ' · ' + securiser(nomCompte(e.mode)) + (e.env ? ' · ' + securiser(e.env) : '') + texteParts;
}

/* Même règle que l'Accueil : en communes ou en perso, une ligne montre seulement cette part; « Tout » montre toutes les lignes */
function pageDepenses() {
  const choix = filtres.p, recherche = (filtres.q || '').toLowerCase(), valeur = e => partDe(e, choix);
  let lignes = depensesAnnee().filter(e => (!filtres.m || +e.d.slice(5, 7) == filtres.m)
    && (!recherche || (e.desc + ' ' + e.cat).toLowerCase().includes(recherche))
    && (choix === 't' || Math.abs(valeur(e)) > 0.004));
  const titre = libelleMode(choix) + ' ' + (filtres.m ? MOIS_LONGS[filtres.m - 1].toLowerCase() + ' ' : '') + anneeCourante;
  const haut = `<div class=filtres><button class="${niveau === 'c' ? 'bouton-principal' : ''}" onclick="niveau='c';afficher()">Catégories</button><button class="${niveau === 'd' ? 'bouton-principal' : ''}" onclick="niveau='d';afficher()">Détail</button></div>`
    + `<div class=filtres><select onchange="filtres.m=this.value;afficher()">${options(CHOIX_MOIS(), filtres.m, "Toute l'année")}</select><select onchange="filtres.p=this.value;afficher()">${options(MODES(), choix)}</select></div>`
    + `<input type=search placeholder="Rechercher" value="${securiser(filtres.q || '')}" onchange="filtres.q=this.value;afficher()">`;

  if (niveau === 'c') {
    const total = {}, nombre = {};
    lignes.filter(compteDansBudget).forEach(e => {
      total[e.cat] = (total[e.cat] || 0) + valeur(e);
      nombre[e.cat] = (nombre[e.cat] || 0) + 1;
    });
    const categories = Object.keys(total).filter(k => total[k] > 0.005).sort((x, y) => x.localeCompare(y, 'fr', { sensitivity: 'base' }));
    const somme = categories.reduce((s, k) => s + total[k], 0);
    return haut + `<div class="carte grande"><small>${securiser(titre)}</small><b>${argent(somme)}</b></div>`
      + (categories.map(k => carteCategorie(k, total[k], somme, nombre[k] + ' ligne(s)', "filtres.c='" + js(k) + "';niveau='d';afficher()")).join('') || '<div class=vide>Aucune dépense.</div>');
  }

  lignes = lignes.filter(e => !filtres.c || e.cat === filtres.c);
  lignes.sort(tri === 'd' ? (x, y) => y.d.localeCompare(x.d) : (x, y) => valeur(y) - valeur(x));
  const somme = lignes.filter(compteDansBudget).reduce((s, e) => s + valeur(e), 0);
  return haut + `<div class=filtres><select onchange="filtres.c=this.value;afficher()">${options(donnees.cats, filtres.c, 'Toutes catégories')}</select><select onchange="tri=this.value;afficher()">${options(CHOIX_TRI, tri)}</select></div>`
    + `<div class=texte-discret>${lignes.length} ligne(s) · ${argent(somme)}</div>`
    + (lignes.map(e => rangee(e, valeur(e))).join('') || '<div class=vide>Rien à afficher.</div>');
}
