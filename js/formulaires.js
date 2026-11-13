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
  const retour = apresFenetre;
  apresFenetre = null;
  if (retour) retour();
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

/* Un champ de montant au format d'ici (« 83,40 $ »); auto : le montant y a été mis tout seul (data-auto le garde, pour savoir s'il a été changé à la main) */
const champMontant = (id, v, classe, auto) => {
  const texte = v === '' || v == null || isNaN(+v) ? '' : argent(v);
  return `<input id=${id}${classe ? ' class=' + classe : ''} type=text inputmode=decimal autocomplete=off placeholder="0,00 $" value="${texte}"${auto && texte ? ` data-auto="${texte}"` : ''} onblur="formaterMontant(this)" oninput="majPartCommune();majPhrasePaiement()">`;
};
function formaterMontant(champ) {
  const n = lireMontant(champ.value);
  champ.value = n === '' ? '' : argent(n);
  if (champ.id === 'f_amt' && n !== '') completerParts(n);
}
/* Le montant tapé ou changé : les parts « Juste pour » vides ou mises toutes seules sont refaites, dans l'ordre (chacune prend ce qui reste);
   une part tapée à la main ne bouge pas */
function completerParts(montant) {
  const parts = lireParts(), aRefaire = p => p[0] && p[0] !== '+' && (p[1] === '' || p[2]);
  parts.forEach(p => { if (aRefaire(p)) p[1] = ''; });
  parts.forEach((p, i) => {
    if (!aRefaire(p)) return;
    const champ = trouver('#f_z' + i), reste = auCent(montant - parts.reduce((s, q, j) => s + (j !== i && q[0] ? +q[1] || 0 : 0), 0));
    p[1] = reste || '';
    champ.value = reste ? argent(reste) : '';
    if (reste) champ.dataset.auto = champ.value;
    else delete champ.dataset.auto;
  });
  majPartCommune();
}

/* Ce que le formulaire d'une dépense (ou d'une récurrente) contient */
/* Une part : [le nom, le montant, mise toute seule (pas changée à la main)] */
const lireParts = () => [0, 1, 2].filter(i => trouver('#f_q' + i)).map(i => {
  const champ = trouver('#f_z' + i), v = lireMontant(champ.value);
  return [lireChamp('f_q' + i), v, v !== '' && champ.dataset.auto !== undefined && lireMontant(champ.dataset.auto) === v];
});
const lireFormulaire = () => ({
  type: lc('f_t') || 'e', d: lc('f_d'), desc: lc('f_desc'), cat: lc('f_cat'), amt: lireMontant(lc('f_amt')), by: lc('f_by'), mode: lc('f_mode'),
  ...(trouver('#f_nzf') ? { nzf: lireChamp('f_nzf') } : {}),
  env: lc('f_env'), pj: trouver('#f_q0') ? lireParts() : null
});

/* ----- « Juste pour… » : une rangée par part (3 au plus); un nom déjà pris n'est plus offert; « — » enlève la rangée ----- */
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
    // Mise toute seule, ou une seule part égale au montant (tout pour une personne) : elle suivra le montant
    const auto = p[2] || (parts.length === 1 && p[1] !== '' && auCent(+p[1]) === auCent(+e.amt));
    return `<div class=part><select id=f_q${i} onchange="changerPart(this)">${options([['', '—'], ...noms.filter(n => !pris.includes(n)), ['+', '+ Ajouter un tiers']], p[0])}</select>${champMontant('f_z' + i, p[1], '', auto)}${plus}</div>`;
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

/* Choisir une personne met le montant qui reste (le montant moins les autres parts), seulement si sa case est vide; il suivra le montant */
const remplirPart = (o, i) => {
  const p = o.pj[i];
  if (!p[0] || p[0] === '+' || +p[1] || o.amt === '') return;
  const reste = auCent(o.amt - o.pj.reduce((s, q, j) => s + (j !== i && q[0] ? +q[1] || 0 : 0), 0));
  if (reste) {
    p[1] = reste;
    p[2] = true;
  }
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
    + (recurrente && e.freq === 'x' ? `<label>Description<input id=f_desc value="${securiser(e.desc)}"></label>\n`
      : `<div class=deux-colonnes><label>${recurrente ? 'Première date' : 'Date'}<input id=f_d type=date value="${e.d || e.start || ''}"></label><label>Description<input id=f_desc value="${securiser(e.desc)}"></label></div>\n`)
    + (interetsOuRemise ? '' : `<label>Catégorie<select id=f_cat>${options(donnees.cats, e.cat, e.cat ? '' : 'Choisis une catégorie')}</select></label>`) + '\n'
    + (e.type === 'e' ? '' : `<label>Placement<select id=f_env>${options(donnees.env.map(x => x.n), e.env)}</select></label>`) + '\n'
    + (interetsOuRemise ? '' : `<label>Qui a payé${choixBoutons('f_by', [N, J], e.by, 1)}</label>${e.type === 'e' ? champsParts(e) : ''}<label>Mode de paiement${choixBoutons('f_mode', comptes, compteChoisi)}</label>`);
}

/* ----- Le + de l'en-tête : une bande de 5 boutons par-dessus la page (le + devient un ✕); un choix referme la bande et ouvre son formulaire ----- */
const ENTREES = [['📥', 'Import', "trouver('#fr').click()"], ['🧾', 'Dépense', 'editerEntree()'], ['💳', 'Paiement', 'editerPaiement()'], ['🏦', 'Placement', "editerEntree(null,{type:'m'})"],
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
  if (id && !enLecture && ecritureFermee(id)) return consulterEcriture(id);
  const base = id ? donnees.ex.find(x => x.id === id)
    : { type: 'e', d: '', by: donnees.p[0], mode: '', cat: '', amt: '', desc: '', env: vue === 'pl' ? placementOuvert : '' };
  const e = { ...base, ...(pre || {}) };
  if (['t', 'r', 'p'].includes(e.type)) return editerPaiement(id, pre);
  rouvrir = o => editerEntree(id, e.refaire ? { ...o, refaire: 1 } : o);
  lireEtat = lireFormulaire;
  const titre = (TITRES_FENETRE[e.type === 'f' && /intér/i.test(e.desc || '') ? 'i' : e.type] || TITRES_FENETRE.e)[id ? 1 : 0];
  ouvrirFenetre(`<h2>${titre}</h2>${id || e.refaire || ligneReleve >= 0 || !['e', 'm'].includes(e.type) ? '' : choixModeles()}${champsFormulaire(e)}${boutonsBas(id, 'enregistrerEntree')}`);
}

/* ----- Les modèles (des récurrentes « Aléatoire ») : en haut d'une nouvelle dépense; en toucher un remplit le formulaire ----- */
const modeles = () => donnees.rec.filter(r => !r.del && r.freq === 'x');
const choixModeles = () => modeles().length ? `<label>Partir d'un modèle<div class=choix>`
  + modeles().map(r => `<button type=button onclick="partirDuModele('${r.id}')">${ICONES_TYPE[r.type] || iconeCategorie(r.cat)} ${securiser(r.desc)}</button>`).join('') + '</div></label>' : '';
/* Les parts d'un modèle : gardées par leur nom, même sans montant (sans montant : la part prendra ce qui reste) */
const partsModele = r => {
  const parts = [[r.nzf || (+r.nz ? r.by : ''), r.nz], [r.nzf2, r.nz2], [r.nzf3, r.nz3]].filter(p => p[0]).map(p => [p[0], +p[1] ? +p[1] : '']);
  return parts.length ? parts : [['', '']];
};
/* Le modèle donne ce qu'il sait; la date, et le montant s'il n'en a pas, restent tels que tapés. Une part sans montant prend ce qui reste */
function partirDuModele(idModele) {
  const r = donnees.rec.find(x => x.id === idModele), s = lireEtat();
  if (!r) return;
  const o = { ...s, type: r.type || 'e', desc: r.desc, cat: r.cat, by: r.by, mode: r.mode, env: r.env || '', amt: +r.amt ? +r.amt : s.amt, pj: partsModele(r) };
  o.pj.forEach((p, i) => remplirPart(o, i));
  rouvrir(o);
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

/* ----- Rien ne s'efface (J-C, 2026-11-09 : « en comptabilité on efface rien ») -----
   Une ligne déjà partie vers la feuille ne change jamais : la supprimer = une écriture d'annulation (la même ligne, la même date,
   les montants et les parts à l'inverse); la modifier = l'annulation, puis la nouvelle ligne. La feuille bâtit l'annulation elle-même
   et donne les numéros; l'app montre tout de suite ce qu'elle bâtira (identifiant de la ligne + « ~a »).
   Une ligne pas encore partie (sans réseau : elle attend dans la file) n'est pas encore écrite : elle se change sur place */
const brouillon = x => !!x && !x.no && fileEnvois.some(e => !e.parti && (e.genre === 'ligne' || e.genre === 'creer') && e.objet && e.objet.id === x.id);
function annulationDe(x, t) {
  const a = { ...x, id: x.id + '~a', amt: -(+x.amt || 0), an: x.no || 0, no: 0, u: t };
  ['nz', 'nz2', 'nz3'].forEach(k => { if (+a[k]) a[k] = -a[k]; });
  delete a.del;
  return a;
}
/* Une annulation, ou une ligne déjà annulée, ne se modifie plus (le GL les montre) */
const ecritureFermee = id => /~a$/.test(id) || donnees.ex.some(x => x.id === id + '~a');

/* Toucher une écriture fermée l'ouvre pour la consulter : son formulaire habituel, grisé, rien ne se change
   (J-C, 2026-11-12, choix 1). Refaire ouvre une nouvelle entrée déjà remplie avec la ligne d'origine */
let enLecture = false;
const nomEcriture = e => ({ e: 'Dépense', m: 'Placement', f: /intér/i.test(e.desc || '') ? 'Intérêts' : 'Remise' })[e.type] || 'Paiement';
function consulterEcriture(id) {
  const e = donnees.ex.find(x => x.id === id);
  if (!e) return;
  const origine = estAnnulation(e) ? donnees.ex.find(x => x.id === idAnnule(e)) || e : e, annulation = donnees.ex.find(x => x.id === origine.id + '~a');
  enLecture = true;
  try { editerEntree(id); } finally { enLecture = false; }
  const f = trouver('#feuille'), titre = f.querySelector('h2');
  f.querySelectorAll('input,select,button,textarea').forEach(x => { x.disabled = true; });
  if (trouver('#f_phrase')) trouver('#f_phrase').remove();
  titre.textContent = estAnnulation(e) ? 'Annulation du n° ' + (origine.no || '') : nomEcriture(e) + (e.no ? ' n° ' + e.no : '');
  titre.insertAdjacentHTML('afterend', '<p class=texte-discret>' + (estAnnulation(e)
    ? `Cette écriture annule le n° ${origine.no || ''} : elle ne se modifie plus.`
    : `Écriture annulée${annulation && annulation.no ? ' par le n° ' + annulation.no : ''} : elle ne se modifie plus.`) + '</p>');
  const boutons = f.querySelectorAll('.boutons');
  boutons[boutons.length - 1].outerHTML = `<div class="boutons espace-haut"><button onclick="fermerFenetre()">Fermer</button><button class=bouton-principal onclick="refaire('${origine.id}')">Refaire</button></div>`;
}
/* Refaire : une nouvelle entrée, déjà remplie avec la ligne d'origine (la même date), sans lien avec elle; on la corrige, puis Enregistrer */
function refaire(id) {
  const o = donnees.ex.find(x => x.id === id);
  fermerFenetre();
  if (!o) return;
  const { id: _, no, an, u, del, rid, nb, ...copie } = o;
  if (['t', 'r', 'p'].includes(o.type)) editerPaiement(null, etatDePaiement(o));
  else editerEntree(null, { ...copie, refaire: 1 });
}
/* Rien de changé dans le formulaire : rien à écrire */
const CHAMPS_ECRITURE = ['d', 'type', 'desc', 'cat', 'env', 'amt', 'by', 'mode', 'to', 'nz', 'nzf', 'nz2', 'nzf2', 'nz3', 'nzf3'];
const memeEcriture = (x, o) => CHAMPS_ECRITURE.every(k => !(k in o) || (/^(amt|nz\d?)$/.test(k) ? (+x[k] || 0) === (+o[k] || 0) : String(x[k] || '') === String(o[k] || '')));

/* Une ligne neuve, ou changée : dans l'app, gardée dans l'appareil, envoyée à la feuille */
function garderLigne(id, o) {
  const t = Date.now(), x = id ? donnees.ex.find(e => e.id === id) : null;
  if (!x) {
    const ligne = { ...o, id: nouvelId(), u: t };
    donnees.ex.push(ligne);
    memoriser([{ genre: 'ligne', objet: ligne }]);
  } else if (brouillon(x)) {
    Object.assign(x, o, { u: t });
    memoriser([{ genre: 'ligne', objet: x }]);
  } else if (!memeEcriture(x, o)) {
    const nouvelle = { ...x, ...o, id: nouvelId(), u: t, no: 0, an: 0 };
    delete nouvelle.del;
    donnees.ex.push(annulationDe(x, t), nouvelle);
    memoriser([{ genre: 'modifier', id, objet: nouvelle }]);
  }
  fermerFenetre();
  afficher();
}
function enregistrerEntree(id) {
  if (!trouver('#f_amt')) return;
  const o = objetEntree();
  if (o) garderLigne(id, o);
}
function supprimerEntree(id) {
  const x = donnees.ex.find(e => e.id === id), pasEcrite = brouillon(x);
  confirmer(pasEcrite ? 'Supprimer cette ligne ?' : "Supprimer cette ligne ? Une écriture d'annulation sera ajoutée.", () => {
    if (pasEcrite) oublierBrouillon(x);
    else {
      donnees.ex.push(annulationDe(x, Date.now()));
      memoriser([{ genre: 'annuler', id }]);
    }
    fermerFenetre();
    afficher();
  }, () => editerEntree(id));
}

/* ----- Paiement : qui paie (une personne, un tiers, un placement), puis à qui (la carte, une personne; un placement paie seulement la carte,
   en choisissant la catégorie à diminuer). Dans la feuille : sur la carte = Transfert; à une personne = Remboursement; par un placement = Payé par l'enveloppe ----- */
/* Ce qu'un tiers doit en tout (à l'un et à l'autre), au 31 décembre de l'année choisie, comme la page Tiers */
const montantDu = t => auCent(Object.values(soldesAu(anneeCourante).ti[t] || {}).reduce((s, x) => s + Math.max(+x || 0, 0), 0));

function editerPaiement(id, pre) {
  if (id && !enLecture && ecritureFermee(id)) return consulterEcriture(id);
  const [N, J] = donnees.p, carte = carteDe(N), b = id ? donnees.ex.find(x => x.id === id) : null;
  const e = { d: '', desc: '', amt: '', du: '', by: N, aq: 'mc', env: '', cat: '', ...(b ? etatDePaiement(b) : {}), ...(pre || {}) };
  e.env = e.env || (vue === 'pl' ? placementOuvert : (donnees.env[0] || {}).n) || '';
  /* Un nouveau paiement d'un tiers : le montant qu'il doit se met tout seul (on peut le changer). Changer de payeur le refait,
     seulement si le montant n'a pas été changé à la main (du = le montant mis tout seul) */
  if (!id && (e.amt === '' || e.amt === e.du)) {
    const tiers = e.by && e.by !== PLACEMENT && !estPersonne(e.by), du = tiers ? montantDu(e.by) : 0;
    e.amt = e.du = du > 0 ? du : '';
  }
  rouvrir = o => editerPaiement(id, o);
  lireEtat = () => ({ d: lc('f_d'), desc: lc('f_desc'), amt: lireMontant(lc('f_amt')), du: lireMontant(lc('f_du')), by: lc('f_by'), aq: lc('f_aq') || 'mc', env: lc('f_env'), cat: lc('f_cat') });
  const parPlacement = e.by === PLACEMENT;
  const aQui = [...(carte ? [['mc', nomCompte(carte)]] : []), N, J].filter(x => x !== e.by);
  const aQuiChoisi = aQui.some(x => (Array.isArray(x) ? x[0] : x) === e.aq) ? e.aq : Array.isArray(aQui[0]) ? aQui[0][0] : aQui[0];
  const choixPlacement = `<div class=deux-colonnes><label>Placement<select id=f_env onchange="rafraichirFormulaire()">${options(donnees.env.map(x => x.n), e.env)}</select></label>`
    + `<label>Catégorie à diminuer<select id=f_cat onchange="rafraichirFormulaire()">${options(donnees.cats, e.cat, e.cat ? '' : 'Choisis une catégorie')}</select></label></div>`;
  ouvrirFenetre(`<h2>${id ? 'Modifier le paiement' : 'Nouveau paiement'}</h2>${champMontant('f_amt', e.amt, 'champ-montant')}<input type=hidden id=f_du value="${e.du}">`
    + `<div class=deux-colonnes><label>Date<input id=f_d type=date value="${e.d}" onchange="majPhrasePaiement()"></label><label>Description<input id=f_desc value="${securiser(e.desc)}"></label></div>`
    + `<label>Qui paie${choixBoutons('f_by', [N, J, ...donnees.tiers, ...(carte ? [[PLACEMENT, 'Un placement']] : [])], e.by, 1)}</label>`
    + (parPlacement ? choixPlacement : `<label>À qui${choixBoutons('f_aq', aQui, aQuiChoisi, 1)}</label>`)
    + `<p id=f_phrase class=texte-discret data-id="${securiser(id || '')}">${phrasePaiement({ ...e, aq: parPlacement ? 'mc' : aQuiChoisi }, id)}</p>${boutonsBas(id, 'enregistrerPaiement')}`);
}

/* La petite phrase sous les choix : ce que ce paiement change, avec le montant tapé (J-C, 2026-11-12 : l'effet, pas la règle).
   Sur la MC : la part de chacun, comme sur l'Accueil (la 2e personne = ce qu'elle doit à la 1re; un tiers = ce qu'il doit à la 1re;
   la 1re = le reste de la carte). À part : le placement qui paie, la dette d'un tiers envers la 2e personne (pas sur la MC),
   et ce qu'une personne doit à un tiers qui a payé plus que ses dettes. Calculé à la date du paiement (le partage d'un tiers en dépend);
   sans date : au 31 décembre de l'année choisie, comme l'Accueil et le montant dû d'un tiers */
function phrasePaiement(s, id) {
  if (!s.by) return 'Choisis qui paie.';
  if (!(s.amt > 0)) return 'Entre le montant.';
  const [N, J] = donnees.p, carte = carteDe(N), d = dateValide(s.d) ? s.d : anneeCourante + '-12-31';
  const ligne = { ...lignePaiement(s), id: '~', d };
  const base = lignesVivantes().filter(e => e.d <= d && e.id !== id), av = soldes(base), ap = soldes(base.concat([ligne]));
  const positif = x => Math.max(+x || 0, 0), signe = x => (x > 0 ? '+' : '−') + argent(Math.abs(x));
  const dette = (o, t, p) => (o.ti[t] || {})[p];
  const parts = { [J]: auCent(ap.solde - av.solde) }, autres = [];
  if (carte) {
    donnees.tiers.forEach(t => { parts[t] = auCent(positif(dette(ap, t, N)) - positif(dette(av, t, N))); });
    parts[N] = auCent(montantPourCompte(ligne, carte) - donnees.tiers.reduce((x, t) => x + parts[t], parts[J]));
  } else if (parts[J]) autres.push(`${securiser(J)} doit ${argent(Math.abs(parts[J]))} de ${parts[J] < 0 ? 'moins' : 'plus'} à ${securiser(N)}.`);
  donnees.tiers.forEach(t => (carte ? [J] : [N, J]).forEach(p => {
    const x = auCent(positif(dette(ap, t, p)) - positif(dette(av, t, p)));
    if (x) autres.push(`${securiser(t)} doit ${argent(Math.abs(x))} de ${x < 0 ? 'moins' : 'plus'} à ${securiser(p)}.`);
  }));
  donnees.tiers.forEach(t => [N, J].forEach(p => {
    if (positif(-dette(ap, t, p)) > positif(-dette(av, t, p)) + 0.004) autres.push(`${securiser(p)} doit ${argent(positif(-dette(ap, t, p)))} à ${securiser(t)}.`);
  }));
  const ordre = [...new Set([s.by, s.aq, N, J, ...donnees.tiers])].filter(n => carte && Math.abs(parts[n] || 0) >= 0.005);
  return [
    ligne.type === 'p' && ligne.env ? `${securiser(ligne.env)} : ${signe(-ligne.amt)}.` : '',
    ordre.length ? ordre.map(n => `${securiser(n)} : ${signe(parts[n])}`).join(' · ') + ` sur la ${securiser(nomCompte(carte))}.` : '',
    ...autres
  ].filter(Boolean).join(' ') || (carte ? `Rien ne change sur la ${securiser(nomCompte(carte))}.` : 'Rien ne change.');
}
function majPhrasePaiement() {
  const p = trouver('#f_phrase');
  if (p) p.innerHTML = phrasePaiement(lireEtat(), p.dataset.id);
}

/* Les choix du formulaire Paiement, tirés d'une ligne (modifier, consulter, refaire) */
function etatDePaiement(b) {
  const carte = carteDe(donnees.p[0]);
  return { d: b.d, desc: b.desc, amt: b.amt, by: b.type === 'p' ? PLACEMENT : b.by || proprietaireCompte(b.mode), aq: b.type === 'r' ? b.nzf : b.to === carte ? 'mc' : proprietaireCompte(b.to) || 'mc', env: b.env, cat: b.cat };
}
/* La ligne d'un paiement, telle que les choix la donnent (sans vérifier) */
function lignePaiement(s) {
  const [N] = donnees.p, carte = carteDe(N), parPlacement = s.by === PLACEMENT;
  return {
    d: s.d, desc: s.desc, amt: s.amt, cat: parPlacement ? s.cat : '', env: parPlacement ? s.env : '', mode: '', nz: 0, nzf: '', nz2: 0, nzf2: '', nz3: 0, nzf3: '',
    ...(parPlacement ? { type: 'p', by: N, to: carte } : s.aq === 'mc' ? { type: 't', by: s.by, to: carte } : { type: 'r', by: s.by, nzf: s.aq, to: '' })
  };
}
function objetPaiement() {
  const s = lireEtat(), parPlacement = s.by === PLACEMENT;
  if (!dateValide(s.d) || !(s.amt > 0)) return afficherMessage('Entre une date et un montant.');
  if (!s.by) return afficherMessage('Choisis qui paie.');
  if (parPlacement && !s.env) return afficherMessage('Choisis un placement (à créer dans Plus).');
  if (parPlacement && !s.cat) return afficherMessage('Choisis une catégorie.');
  return lignePaiement(s);
}
function enregistrerPaiement(id) {
  if (!trouver('#f_amt')) return;
  const o = objetPaiement();
  if (o) garderLigne(id, o);
}
