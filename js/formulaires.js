/* =====================================================================
   LA FENÊTRE ET LES FORMULAIRES : dépense, placement, intérêts, remise, paiement
   Enregistrer : la ligne est d'abord gardée dans l'appareil, puis envoyée à la feuille (memoire.js, serveur.js).
   ===================================================================== */

/* Fermer vide la fenêtre : un 2e toucher sur Enregistrer ne trouve plus de formulaire, donc ne double jamais une ligne
   (et on quitte la ligne du relevé) */
function ouvrirFenetre(html) {
  trouver('#feuille').innerHTML = html;
  trouver('#modale').classList.add('actif');
}
function fermerFenetre() {
  trouver('#modale').classList.remove('actif');
  trouver('#feuille').innerHTML = '';
  ligneReleve = -1;
}

/* La valeur d'un champ : un groupe de boutons garde son choix dans data-v; lc : '' si le champ n'est pas là */
const lireChamp = id => {
  const x = trouver('#' + id);
  return x.dataset.v !== undefined ? x.dataset.v : x.value;
};
const lc = id => trouver('#' + id) ? lireChamp(id) : '';

/* Un groupe de boutons (un seul choisi). re : choisir refait la fenêtre (d'autres champs en dépendent) */
const choixBoutons = (id, liste, choisi, re) => `<div class=choix id=${id} data-v="${securiser(choisi)}" ${re ? 'data-re=1' : ''}>`
  + liste.map(x => {
    const [valeur, texte] = Array.isArray(x) ? x : [x, x];
    return `<button type=button data-v="${securiser(valeur)}" class="${valeur == choisi ? 'actif' : ''}" onclick="choisirBouton(this)">${securiser(texte)}</button>`;
  }).join('') + '</div>';

/* Changer qui paie une dépense remet le mode de paiement à la carte de cette personne */
function choisirBouton(bouton) {
  const groupe = bouton.parentNode;
  groupe.dataset.v = bouton.dataset.v;
  [...groupe.children].forEach(x => x.classList.toggle('actif', x === bouton));
  if (groupe.id === 'f_by' && lc('f_t') === 'e' && trouver('#f_mode')) trouver('#f_mode').dataset.v = '';
  if (groupe.dataset.re) rafraichirFormulaire();
}
const rafraichirFormulaire = () => rouvrir(lireEtat());

/* Un champ de montant au format d'ici (« 83,40 $ ») */
const champMontant = (id, v, classe) => `<input id=${id}${classe ? ' class=' + classe : ''} type=text inputmode=decimal autocomplete=off placeholder="0,00 $" value="${v === '' || v == null || isNaN(+v) ? '' : argent(v)}" onblur="formaterMontant(this)" oninput="majPartCommune()">`;
function formaterMontant(champ) {
  const n = lireMontant(champ.value);
  champ.value = n === '' ? '' : argent(n);
}

/* Ce que le formulaire d'une dépense (ou d'une récurrente) contient */
const lireParts = () => [0, 1, 2].filter(i => trouver('#f_q' + i)).map(i => [lireChamp('f_q' + i), lireMontant(lireChamp('f_z' + i))]);
const lireFormulaire = () => ({
  type: lc('f_t') || 'e', d: lc('f_d'), desc: lc('f_desc'), cat: lc('f_cat'), amt: lireMontant(lc('f_amt')), by: lc('f_by'), mode: lc('f_mode'),
  ...(trouver('#f_nzf') ? { nzf: lireChamp('f_nzf') } : {}),
  env: lc('f_env'), pj: trouver('#f_q0') ? lireParts() : null
});

/* ----- « Juste pour… » : une rangée par part (3 au plus); un nom déjà pris n'est plus offert; « Personne » enlève la rangée ----- */
const partsFormulaire = e => {
  if (e.pj) return e.pj;
  const l = [[e.nzf || (+e.nz ? e.by : ''), e.nz], [e.nzf2, e.nz2], [e.nzf3, e.nz3]].filter(p => p[0] && +p[1]);
  return l.length ? l : [['', '']];
};
function champsParts(e) {
  const parts = partsFormulaire(e), noms = [...donnees.p, ...donnees.tiers];
  const rangeePart = (p, i) => {
    const pris = parts.filter((x, j) => j !== i).map(x => x[0]);
    const plus = i === parts.length - 1 && p[0] && parts.length < 3 ? '<button type=button class="carre texte-principal" onclick="ajouterPart()" aria-label="Une autre part">+</button>' : '<span></span>';
    return `<div class=part><select id=f_q${i} onchange="changerPart(this)">${options([['', 'Personne'], ...noms.filter(n => !pris.includes(n)), ['+', '+ Ajouter un tiers']], p[0])}</select>${champMontant('f_z' + i, p[1])}${plus}</div>`;
  };
  return `<label>Juste pour…${parts.map(rangeePart).join('')}${parts.some(p => p[0]) ? `<p class="texte-discret sous-texte" id=f_pc>${textePartCommune(e.amt, parts)}</p>` : ''}</label>`;
}

/* La part commune (le montant moins les « Juste pour »), sous les parts dès qu'une personne est choisie; en rouge si les parts dépassent le montant */
const textePartCommune = (montant, parts) => {
  const c = auCent((+montant || 0) - parts.reduce((s, p) => s + (p[0] ? +p[1] || 0 : 0), 0));
  return 'Part commune : ' + (c * Math.sign(+montant || 1) < 0 ? `<b class=negatif>${argent(c)}</b>` : argent(c));
};
function majPartCommune() {
  const x = trouver('#f_pc');
  if (x) x.innerHTML = textePartCommune(lireMontant(lc('f_amt')), lireParts());
}

/* Choisir une personne met le montant qui reste (le montant moins les autres parts), seulement si sa case est vide */
const remplirPart = (o, i) => {
  const p = o.pj[i];
  if (!p[0] || p[0] === '+' || +p[1] || o.amt === '') return;
  const reste = auCent(o.amt - o.pj.reduce((s, q, j) => s + (j !== i && q[0] ? +q[1] || 0 : 0), 0));
  if (reste) p[1] = reste;
};
function changerPart(menu) {
  const i = +menu.id.slice(3), o = lireEtat();
  if (menu.value === '+') {
    o.pj[i][0] = '';
    return demanderTexte('Nom du tiers', '', nom => {
      if (o.pj.some((p, j) => j !== i && p[0] === nom)) return afficherMessage('Ce nom est déjà choisi.');
      if (!estPersonne(nom) && !donnees.tiers.includes(nom)) {
        donnees.tiers.push(nom);
        changerReglages();
      }
      o.pj[i][0] = nom;
      remplirPart(o, i);
      rouvrir(o);
    }, () => rouvrir(o));
  }
  if (!menu.value && o.pj.length > 1) o.pj.splice(i, 1);
  else remplirPart(o, i);
  rouvrir(o);
}
function ajouterPart() {
  const o = lireEtat();
  o.pj.push(['', '']);
  rouvrir(o);
}

/* Les parts du formulaire vont dans nz/nzf, nz2/nzf2, nz3/nzf3; renvoie un message si quelque chose cloche.
   Une dépense peut être négative (un retour) : ses parts sont alors négatives elles aussi */
function appliquerParts(o) {
  const parts = o.type === 'e' ? (o.pj || []).filter(p => p[0]) : [], signe = o.amt < 0 ? -1 : 1, sansMontant = parts.find(p => !(p[1] * signe > 0));
  if (sansMontant) return 'Entre le montant juste pour ' + sansMontant[0] + (signe < 0 ? ', négatif comme la dépense.' : '.');
  if (parts.reduce((s, p) => s + p[1] * signe, 0) > o.amt * signe + 0.004) return 'Les parts « Juste pour » dépassent le montant.';
  ['', 2, 3].forEach((suite, i) => {
    o['nz' + suite] = parts[i] ? parts[i][1] : 0;
    if (o.type !== 'r' || suite) o['nzf' + suite] = parts[i] ? parts[i][0] : '';
  });
  delete o.pj;
}

/* Dépense et placement : catégorie, qui a payé, avec quel compte. Intérêts et remise : seulement le placement où ils vont */
function champsFormulaire(e, recurrente) {
  const [N, J] = donnees.p, interetsOuRemise = e.type === 'f';
  const comptes = donnees.modes.filter(m => !m.o || m.o === e.by).map(m => [cleCompte(m), m.n]), cles = comptes.map(x => x[0]);
  const compteChoisi = cles.includes(e.mode) ? e.mode : e.type === 'e' && cles.includes(carteDe(e.by)) ? carteDe(e.by) : cles[0];
  return (recurrente ? `<label>Genre${choixBoutons('f_t', [['e', 'Dépense'], ['m', 'Placement']], e.type || 'e', 1)}</label>` : `<div id=f_t data-v="${e.type || 'e'}" hidden></div>`)
    + champMontant('f_amt', e.amt, 'champ-montant') + '\n'
    + `<div class=deux-colonnes><label>${recurrente ? 'Première date' : 'Date'}<input id=f_d type=date value="${e.d || e.start || ''}"></label><label>Description<input id=f_desc value="${securiser(e.desc)}"></label></div>\n`
    + (interetsOuRemise ? '' : `<label>Catégorie<select id=f_cat>${options(donnees.cats, e.cat, e.cat ? '' : 'Choisis une catégorie')}</select></label>`) + '\n'
    + (e.type === 'e' ? '' : `<label>Placement<select id=f_env>${options(donnees.env.map(x => x.n), e.env)}</select></label>`) + '\n'
    + (interetsOuRemise ? '' : `<label>Qui a payé${choixBoutons('f_by', [N, J], e.by, 1)}</label>${e.type === 'e' ? champsParts(e) : ''}<label>Mode de paiement${choixBoutons('f_mode', comptes, compteChoisi)}</label>`);
}

/* ----- Le + de l'en-tête : une bande de 5 boutons par-dessus la page (le + devient un ✕); un choix referme la bande et ouvre son formulaire ----- */
const ENTREES = [['🧾', 'Dépense', 'editerEntree()'], ['💳', 'Paiement', 'editerPaiement()'], ['🏦', 'Placement', "editerEntree(null,{type:'m'})"],
  ['📈', 'Intérêts', "editerEntree(null,{type:'f',desc:'Intérêts'})"], ['🎁', 'Remise', "editerEntree(null,{type:'f',desc:'Remise'})"]];
function nouvelleEntree(ouvrir) {
  const bande = trouver('#bande');
  if (!bande) return;
  if (lecture && ouvrir !== false) return afficherMessage(PAS_LUES);
  ouvrir = ouvrir ?? !bande.classList.contains('ouvert');
  bande.classList.toggle('ouvert', ouvrir);
  trouver('.bouton-ajouter').classList.toggle('ouvert', ouvrir);
  bande.innerHTML = ouvrir ? ENTREES.map(x => `<button class=icone-mot onclick="nouvelleEntree(false);${x[2]}"><span class=icone>${x[0]}</span>${x[1]}</button>`).join('') : '';
  if (ouvrir) placerBande(bande);
}
/* La bande prend la place de « Dépenses communes » : le haut du 1er bloc de la page, jusqu'à sa ligne (le cadre se superpose au sien).
   Bloc caché sous l'en-tête : juste sous l'en-tête */
function placerBande(bande) {
  const bloc = trouver('#contenu').firstElementChild, r = bloc && bloc.getBoundingClientRect(), ligne = bloc && bloc.querySelector('.separe');
  const basEnTete = trouver('header').getBoundingClientRect().bottom, page = trouver('#contenu').getBoundingClientRect(), visible = r && r.top >= basEnTete - 1;
  bande.style.top = scrollY + (visible ? r.top : basEnTete + 14) + 'px';
  bande.style.left = (visible ? r.left : page.left + 16) + 'px';
  bande.style.width = (visible ? r.width : page.width - 32) + 'px';
  bande.style.height = (visible && ligne ? ligne.getBoundingClientRect().top + 1 - r.top : 92) + 'px';
}

/* ----- Dépense, placement, intérêts, remise ----- */
/* Une ligne « Fermeture » d'une vieille année importée (elle ramène l'année à zéro le 31 décembre) ne se modifie pas */
function editerEntree(id, pre) {
  if (id && /^imp\d{4}-fermeture/.test(id)) return afficherMessage("Ligne de fermeture de l'année : elle ne se modifie pas.");
  const base = id ? donnees.ex.find(x => x.id === id)
    : { type: 'e', d: aujourdhui(), by: donnees.p[0], mode: '', cat: donnees.cats[0], amt: '', desc: '', env: vue === 'pl' ? placementOuvert : '' };
  const e = { ...base, ...(pre || {}) };
  if (['t', 'r', 'p'].includes(e.type)) return editerPaiement(id, pre);
  rouvrir = o => editerEntree(id, o);
  lireEtat = lireFormulaire;
  const titre = (TITRES_FENETRE[e.type === 'f' && /intér/i.test(e.desc || '') ? 'i' : e.type] || TITRES_FENETRE.e)[id ? 1 : 0];
  ouvrirFenetre(`<h2>${titre}</h2>${champsFormulaire(e)}${boutonsBas(id, 'enregistrerEntree')}`);
}

/* Les boutons du bas; pour une ligne du relevé : Annuler · Valider (elle revient cochée, rien n'entre encore) */
const boutonsBas = (id, enregistrer) => '<div class="boutons espace-haut">' + (ligneReleve >= 0
  ? '<button onclick="fermerFenetre()">Annuler</button><button class=bouton-principal onclick="validerReleve()">Valider</button>'
  : (id ? `<button class=bouton-danger onclick="supprimerEntree('${id}')">Supprimer</button>` : '')
    + `<button onclick="fermerFenetre()">Annuler</button><button class=bouton-principal onclick="${enregistrer}(${id ? `'${id}'` : 'null'})">Enregistrer</button>`) + '</div>';

/* Le formulaire devient une ligne; s'il manque quelque chose : un message, et rien */
function objetEntree() {
  const o = lireFormulaire();
  if (!dateValide(o.d) || (o.type === 'e' ? !o.amt : !(o.amt > 0))) return afficherMessage('Entre une date et un montant.');
  if (o.type !== 'e' && !o.env) return afficherMessage('Choisis un placement (à créer dans Plus).');
  if (o.type !== 'f' && !o.cat) return afficherMessage('Choisis une catégorie.');
  const erreur = appliquerParts(o);
  if (erreur) return afficherMessage(erreur);
  return o;
}

/* Une ligne neuve ou changée : dans l'app, gardée dans l'appareil, envoyée à la feuille */
function garderLigne(id, o) {
  let ligne;
  if (id) ligne = Object.assign(donnees.ex.find(x => x.id === id), o, { u: Date.now() });
  else donnees.ex.push(ligne = { ...o, id: nouvelId(), u: Date.now() });
  memoriser([{ genre: 'ligne', objet: ligne }]);
  fermerFenetre();
  afficher();
}
function enregistrerEntree(id) {
  if (!trouver('#f_amt')) return;
  const o = objetEntree();
  if (o) garderLigne(id, o);
}
function supprimerEntree(id) {
  confirmer('Supprimer cette ligne ?', () => {
    const ligne = donnees.ex.find(x => x.id === id);
    ligne.del = true;
    ligne.u = Date.now();
    memoriser([{ genre: 'supprimer', id }]);
    fermerFenetre();
    afficher();
  }, () => editerEntree(id));
}

/* ----- Paiement : qui paie (une personne, un tiers, un placement), puis à qui (la carte, une personne; un placement paie seulement la carte,
   en choisissant la catégorie à diminuer). Dans la feuille : sur la carte = Transfert; à une personne = Remboursement; par un placement = Payé par l'enveloppe ----- */
function editerPaiement(id, pre) {
  const [N, J] = donnees.p, carte = carteDe(N), b = id ? donnees.ex.find(x => x.id === id) : null;
  const e = {
    d: aujourdhui(), desc: '', amt: '', by: N, aq: 'mc', env: '', cat: donnees.cats[0],
    ...(b ? { d: b.d, desc: b.desc, amt: b.amt, by: b.type === 'p' ? PLACEMENT : b.by || proprietaireCompte(b.mode), aq: b.type === 'r' ? b.nzf : b.to === carte ? 'mc' : proprietaireCompte(b.to) || 'mc', env: b.env, cat: b.cat } : {}),
    ...(pre || {})
  };
  e.env = e.env || (vue === 'pl' ? placementOuvert : (donnees.env[0] || {}).n) || '';
  e.cat = e.cat || donnees.cats[0];
  rouvrir = o => editerPaiement(id, o);
  lireEtat = () => ({ d: lc('f_d'), desc: lc('f_desc'), amt: lireMontant(lc('f_amt')), by: lc('f_by'), aq: lc('f_aq') || 'mc', env: lc('f_env'), cat: lc('f_cat') });
  const parPlacement = e.by === PLACEMENT;
  const aQui = [...(carte ? [['mc', nomCompte(carte)]] : []), N, J].filter(x => x !== e.by);
  const aQuiChoisi = aQui.some(x => (Array.isArray(x) ? x[0] : x) === e.aq) ? e.aq : Array.isArray(aQui[0]) ? aQui[0][0] : aQui[0];
  const choixPlacement = `<div class=deux-colonnes><label>Placement<select id=f_env onchange="rafraichirFormulaire()">${options(donnees.env.map(x => x.n), e.env)}</select></label>`
    + `<label>Catégorie à diminuer<select id=f_cat onchange="rafraichirFormulaire()">${options(donnees.cats, e.cat)}</select></label></div>`;
  ouvrirFenetre(`<h2>${id ? 'Modifier le paiement' : 'Nouveau paiement'}</h2>${champMontant('f_amt', e.amt, 'champ-montant')}`
    + `<div class=deux-colonnes><label>Date<input id=f_d type=date value="${e.d}"></label><label>Description<input id=f_desc value="${securiser(e.desc)}"></label></div>`
    + `<label>Qui paie${choixBoutons('f_by', [N, J, ...donnees.tiers, ...(carte ? [[PLACEMENT, 'Un placement']] : [])], e.by, 1)}</label>`
    + (parPlacement ? choixPlacement : `<label>À qui${choixBoutons('f_aq', aQui, aQuiChoisi, 1)}</label>`)
    + `<p class=texte-discret>${phrasePaiement(e.by, parPlacement ? 'mc' : aQuiChoisi, e.env, e.cat)}</p>${boutonsBas(id, 'enregistrerPaiement')}`);
}

/* La petite phrase sous les choix : ce que le paiement va faire */
function phrasePaiement(qui, aQui, placement, categorie) {
  const [N, J] = donnees.p, carte = securiser(nomCompte(carteDe(N))), Q = securiser(qui), A = securiser(aQui);
  if (!qui) return 'Choisis qui paie.';
  if (qui === PLACEMENT) return `Le placement ${securiser(placement)} baisse du montant, la ${carte} aussi, et les communes baissent du montant dans la catégorie ${securiser(categorie)}.`;
  if (aQui === 'mc') return estPersonne(qui) ? `La ${carte} baisse du montant, et la part de ${Q} aussi.` : `La dette de ${Q} baisse du montant, et la ${carte} aussi.`;
  return estPersonne(qui) ? `La part de ${Q} sur la ${carte} baisse du montant, celle de ${A} monte d'autant.`
    : `La dette de ${Q} envers ${A} baisse du montant; ce qui dépasse cette dette baisse sa dette envers ${securiser(aQui === N ? J : N)}, et ${A} le lui doit alors.`;
}

function objetPaiement() {
  const [N] = donnees.p, carte = carteDe(N), s = lireEtat(), parPlacement = s.by === PLACEMENT;
  if (!dateValide(s.d) || !(s.amt > 0)) return afficherMessage('Entre une date et un montant.');
  if (!s.by) return afficherMessage('Choisis qui paie.');
  if (parPlacement && !s.env) return afficherMessage('Choisis un placement (à créer dans Plus).');
  return {
    d: s.d, desc: s.desc, amt: s.amt, cat: parPlacement ? s.cat : '', env: parPlacement ? s.env : '', mode: '', nz: 0, nzf: '', nz2: 0, nzf2: '', nz3: 0, nzf3: '',
    ...(parPlacement ? { type: 'p', by: N, to: carte } : s.aq === 'mc' ? { type: 't', by: s.by, to: carte } : { type: 'r', by: s.by, nzf: s.aq, to: '' })
  };
}
function enregistrerPaiement(id) {
  if (!trouver('#f_amt')) return;
  const o = objetPaiement();
  if (o) garderLigne(id, o);
}
