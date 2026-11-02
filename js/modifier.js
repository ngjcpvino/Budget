/* =====================================================================
   MODIFIER : les catégories, les tiers, les placements, les comptes (Plus → Modifier),
   et les petites fenêtres partagées (demander un texte, confirmer)
   Renommer réécrit toutes les lignes qui portent l'ancien nom : elles sont toutes envoyées à la feuille.
   ===================================================================== */

const iconeCategorie = c => (donnees.ic && donnees.ic[c]) || '';
const iconeEnveloppe = x => (x && x.ic) || '💰';
const TITRES_LISTES = { cats: 'Catégories', tiers: 'Tiers', modes: 'Comptes', env: 'Placements' };
const lireListe = k => k === 'modes' ? donnees.modes.map(cleCompte) : k === 'env' ? donnees.env.map(x => x.n) : donnees[k];

/* ----- Demander un texte (un nom) : Annuler · Enregistrer ----- */
let rappelTexte = null, rappelRetour = fermerFenetre;
function demanderTexte(titre, valeur, siOk, siAnnule) {
  rappelTexte = siOk;
  rappelRetour = siAnnule || fermerFenetre;
  ouvrirFenetre(`<h2>${titre}</h2><input id=f_ask value="${securiser(valeur)}" autocomplete=off><div class="boutons espace-haut"><button onclick="rappelRetour()">Annuler</button><button class=bouton-principal onclick="validerTexte()">Enregistrer</button></div>`);
  setTimeout(() => { const x = trouver('#f_ask'); if (x) x.focus(); }, 60);
}
function validerTexte() {
  const v = trouver('#f_ask').value.trim();
  if (v) rappelTexte(v);
}

/* ----- Confirmer : Annuler · Confirmer ----- */
let rappelConfirmer = null, rappelAnnulerConfirmation = fermerFenetre;
function confirmer(titre, siOui, siNon) {
  rappelConfirmer = siOui;
  rappelAnnulerConfirmation = siNon || fermerFenetre;
  ouvrirFenetre(`<h2>${titre}</h2><div class="boutons espace-haut"><button onclick="rappelAnnulerConfirmation()">Annuler</button><button class=bouton-danger onclick="rappelConfirmer()">Confirmer</button></div>`);
}

/* ----- Une liste à modifier (toucher un nom = le modifier; + Ajouter) ----- */
function listeModifiable(k) {
  const action = (x, i) => k === 'cats' ? `pageCategorie(${i})` : k === 'env' ? `pageEnveloppe(${i})` : k === 'modes' ? `pageCompte(${i},'l')` : `renommerNom('${k}',${i})`;
  const icone = (x, i) => k === 'cats' ? `<span class=icone>${iconeCategorie(x)}</span>` : k === 'env' ? `<span class=icone>${iconeEnveloppe(donnees.env[i])}</span>` : '';
  const ajouter = k === 'cats' ? 'pageCategorie()' : k === 'env' ? 'pageEnveloppe()' : k === 'modes' ? `pageCompte(null,'l')` : `ajouterNom('${k}')`;
  ouvrirFenetre(`<h2>${TITRES_LISTES[k]}</h2>` + lireListe(k).map((x, i) => `<div class=ligne-depense onclick="${action(x, i)}">${icone(x, i)}<div><b>${securiser(x)}</b></div><small>Modifier</small></div>`).join('')
    + `<div class="boutons espace-haut"><button onclick="fermerFenetre();afficher()">Fermer</button><button class=bouton-principal onclick="${ajouter}">+ Ajouter</button></div>`);
}
function ajouterNom(k) {
  demanderTexte('Nouveau nom', '', nom => {
    if (lireListe(k).includes(nom)) return afficherMessage('Ce nom existe déjà.');
    donnees[k].push(nom);
    changerReglages();
    listeModifiable(k);
  }, () => listeModifiable(k));
}
function renommerNom(k, i) {
  const ancien = lireListe(k)[i];
  demanderTexte('Modifier le nom', ancien, nom => {
    if (nom !== ancien && lireListe(k).includes(nom)) return afficherMessage('Ce nom existe déjà.');
    appliquerRenommage(k, ancien, nom);
    changerReglages();
    listeModifiable(k);
  }, () => listeModifiable(k));
}

/* Renommer réécrit toutes les lignes (dépenses et récurrentes) qui portent l'ancien nom, parts 2 et 3 comprises.
   Les Réglages (la liste des noms) sont envoyés ensuite par l'appelant (changerReglages), une fois tout changé */
function appliquerRenommage(k, ancien, nouveau) {
  const t = Date.now(), lignes = new Set(), recurrentes = new Set();
  const changer = champ => {
    donnees.ex.forEach(e => { if (e[champ] === ancien) { e[champ] = nouveau; e.u = t; lignes.add(e); } });
    donnees.rec.forEach(r => { if (r[champ] === ancien) { r[champ] = nouveau; r.u = t; recurrentes.add(r); } });
  };
  if (k === 'cats') {
    donnees.ic[nouveau] = iconeCategorie(ancien);
    donnees.cc[nouveau] = indexCouleur(ancien);
    donnees.cats[donnees.cats.indexOf(ancien)] = nouveau;
    changer('cat');
  } else if (k === 'tiers') {
    donnees.tiers[donnees.tiers.indexOf(ancien)] = nouveau;
    ['by', 'nzf', 'nzf2', 'nzf3'].forEach(changer);
  } else if (k === 'modes') ['mode', 'to'].forEach(changer);
  else if (k === 'env') changer('env');
  memoriser(changementsDe(lignes, recurrentes));
}
const changementsDe = (lignes, recurrentes) => [...lignes].map(objet => ({ genre: 'ligne', objet })).concat([...recurrentes].map(objet => ({ genre: 'rec', objet })));

/* ----- La grille d'emojis, la même pour les catégories et les placements ----- */
const grilleIcones = choisi => {
  const liste = ICONES_CHOIX.includes(choisi) ? ICONES_CHOIX : [choisi, ...ICONES_CHOIX];
  return `<label>Icône<div class=choix-icones id=f_ic data-v="${choisi}">${liste.map(x => `<button type=button data-v="${x}" class="${x === choisi ? 'actif' : ''}" onclick="choisirBouton(this)">${x}</button>`).join('')}</div></label>`;
};

/* ----- Un placement ----- */
function pageEnveloppe(i) {
  const o = i == null ? { n: '', s: 0 } : donnees.env[i];
  ouvrirFenetre(`<h2>${i == null ? 'Nouveau placement' : 'Modifier le placement'}</h2><label>Nom<input id=f_nm value="${securiser(o.n)}" autocomplete=off></label>`
    + `<label>Solde de départ (argent déjà dans le compte)<input id=f_solde type=text inputmode=decimal autocomplete=off value="${o.s || ''}"></label>${grilleIcones(iconeEnveloppe(o))}`
    + `<div class="boutons espace-haut">${i == null ? '' : `<button class=bouton-danger onclick="supprimerEnveloppe(${i})">Supprimer</button>`}<button onclick="listeModifiable('env')">Annuler</button><button class=bouton-principal onclick="enregistrerEnveloppe(${i == null ? 'null' : i})">Enregistrer</button></div>`);
}
function enregistrerEnveloppe(i) {
  const nom = trouver('#f_nm').value.trim(), solde = +lireMontant(trouver('#f_solde').value) || 0, icone = trouver('#f_ic').dataset.v;
  if (!nom) return afficherMessage('Entre un nom.');
  if (donnees.env.some((x, j) => x.n === nom && j !== i)) return afficherMessage('Ce nom existe déjà.');
  if (i == null) donnees.env.push({ n: nom, s: solde, ic: icone });
  else {
    const ancien = donnees.env[i].n;
    donnees.env[i] = { n: nom, s: solde, ic: icone };
    if (ancien !== nom) appliquerRenommage('env', ancien, nom);
  }
  changerReglages();
  listeModifiable('env');
}
function supprimerEnveloppe(i) {
  const nom = donnees.env[i].n;
  if ([...donnees.ex, ...donnees.rec].some(e => !e.del && e.env === nom)) return afficherMessage('Ce placement contient des lignes : impossible de le supprimer.');
  confirmer('Supprimer « ' + securiser(nom) + ' » ?', () => {
    donnees.env.splice(i, 1);
    changerReglages();
    listeModifiable('env');
  }, () => pageEnveloppe(i));
}

/* ----- Une catégorie ----- */
function pageCategorie(i) {
  const nom = i == null ? '' : donnees.cats[i];
  ouvrirFenetre(`<h2>${nom ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</h2><label>Nom<input id=f_nm value="${securiser(nom)}" autocomplete=off></label>${grilleIcones(iconeCategorie(nom) || '🧩')}`
    + `<div class="boutons espace-haut">${nom ? `<button class=bouton-danger onclick="supprimerCategorie(${i})">Supprimer</button>` : ''}<button onclick="listeModifiable('cats')">Annuler</button><button class=bouton-principal onclick="enregistrerCategorie(${i == null ? 'null' : i})">Enregistrer</button></div>`);
}
function enregistrerCategorie(i) {
  const nom = trouver('#f_nm').value.trim(), icone = trouver('#f_ic').dataset.v;
  if (!nom) return afficherMessage('Entre un nom.');
  if (donnees.cats.some((c, j) => c === nom && j !== i)) return afficherMessage('Ce nom existe déjà.');
  const ancien = i == null ? null : donnees.cats[i];
  if (ancien === null) donnees.cats.push(nom);
  else if (ancien !== nom) appliquerRenommage('cats', ancien, nom);
  donnees.ic[nom] = icone;
  indexCouleur(nom);
  changerReglages();
  listeModifiable('cats');
}
function supprimerCategorie(i) {
  const c = donnees.cats[i], n = donnees.ex.filter(e => !e.del && e.cat === c).length + donnees.rec.filter(r => !r.del && r.cat === c).length;
  confirmer('Supprimer « ' + securiser(c) + ' » ?' + (n ? '<br><small class=texte-discret>' + n + ' ligne(s) la gardent et restent comptées.</small>' : ''), () => {
    donnees.gone = [...new Set([...(donnees.gone || []), c])];
    donnees.cats.splice(i, 1);
    changerReglages();
    listeModifiable('cats');
  }, () => listeModifiable('cats'));
}

/* ----- Les couleurs des catégories (--categorie-1 à --categorie-12 dans styles.css) : chaque catégorie garde son numéro, attribué dans l'ordre ----- */
function indexCouleur(nom) {
  if (typeof donnees.cc[nom] !== 'number') {
    const prises = Object.values(donnees.cc).filter(v => typeof v === 'number');
    let i = 0;
    while (i < NB_COULEURS && prises.includes(i)) i++;
    donnees.cc[nom] = i < NB_COULEURS ? i : Object.keys(donnees.cc).length % NB_COULEURS;
  }
  return donnees.cc[nom];
}
const couleurCategorie = nom => `var(--categorie-${indexCouleur(nom) + 1})`;

/* Une catégorie sans couleur en reçoit une, une fois, et la feuille la garde (sinon chaque appareil choisirait la sienne) */
function attribuerCouleurs() {
  const sans = donnees.cats.filter(c => typeof donnees.cc[c] !== 'number');
  sans.forEach(indexCouleur);
  if (sans.length) changerReglages();
}

/* Une carte de catégorie : l'emoji et le nom à gauche, le montant et son (%) à droite, la barre dessous */
function carteCategorie(nom, valeur, total, sousTexte, action) {
  const p = total > 0 ? valeur / total * 100 : 0;
  return `<div class="carte carte-categorie" onclick="${action}" style="--c:${couleurCategorie(nom)}"><div class=categorie-nom><span>${iconeCategorie(nom)} ${securiser(nom)}</span>`
    + `<b>${argent(valeur)} <span class=texte-discret>(${p < 1 ? '< 1' : Math.round(p)}&nbsp;%)</span></b></div><div class=piste><i style="width:${Math.max(p, 0)}%"></i></div>${sousTexte ? `<div class=sous-texte>${sousTexte}</div>` : ''}</div>`;
}
